-- Sinkronkan komisi + kas + CRM setelah updateOrder (mark paid / edit).
-- confirm_sale hanya menulis side effects saat create; soft_delete membalik saat hapus.
-- RPC ini menutup celah PENDING→PAID / edit total PAID / PAID→PENDING.

CREATE OR REPLACE FUNCTION public.henima_sync_sale_side_effects(
  p_order_id UUID,
  p_business_id UUID,
  p_prev_payment_status TEXT,
  p_prev_total NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_sales public.module_sales_staff%ROWTYPE;
  v_leader public.module_sales_staff%ROWTYPE;
  v_rule public.module_sales_commission_rules%ROWTYPE;
  v_item RECORD;
  v_amt NUMERIC;
  v_counts INTEGER;
  v_items NUMERIC;
  v_spent NUMERIC;
  v_last DATE;
  v_status TEXT;
  v_prev_status TEXT := upper(coalesce(p_prev_payment_status, ''));
  v_now_status TEXT;
  v_prev_total NUMERIC := coalesce(p_prev_total, 0);
  v_product_id TEXT;
  v_product_name TEXT;
  v_qty NUMERIC;
  v_txn_updated INTEGER := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND business_id = p_business_id
    AND source = 'henima_sales'
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'deleted');
  END IF;

  v_now_status := upper(coalesce(v_order.payment_status, ''));

  SELECT product_id, product_name_snapshot, qty
  INTO v_product_id, v_product_name, v_qty
  FROM public.order_items
  WHERE order_id = p_order_id
  ORDER BY id
  LIMIT 1;

  -- Commission: selalu rebuild dari status terkini
  DELETE FROM public.module_sales_commission_ledger WHERE order_id = p_order_id;

  IF v_now_status = 'PAID' AND v_order.sales_id IS NOT NULL THEN
    SELECT * INTO v_sales
    FROM public.module_sales_staff
    WHERE id = v_order.sales_id AND business_id = p_business_id;

    IF v_sales.id IS NOT NULL THEN
      v_rule := public.henima_pick_commission_rule(
        p_business_id, v_sales.id, v_sales.role, v_product_id, v_order.order_date
      );
      IF v_rule.id IS NOT NULL THEN
        v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_order.total * coalesce(v_rule.percentage, 0) / 100);
        INSERT INTO public.module_sales_commission_ledger
          (business_id, order_id, sales_id, role, product_id, amount, rule_id)
        VALUES (p_business_id, p_order_id, v_sales.id, v_sales.role, v_product_id, v_amt, v_rule.id);
      END IF;

      IF v_sales.leader_id IS NOT NULL THEN
        SELECT * INTO v_leader FROM public.module_sales_staff WHERE id = v_sales.leader_id;
        IF v_leader.id IS NOT NULL THEN
          v_rule := public.henima_pick_commission_rule(
            p_business_id, v_leader.id, v_leader.role, v_product_id, v_order.order_date
          );
          IF v_rule.id IS NOT NULL THEN
            v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_order.total * coalesce(v_rule.percentage, 0) / 100);
            INSERT INTO public.module_sales_commission_ledger
              (business_id, order_id, sales_id, role, product_id, amount, rule_id)
            VALUES (p_business_id, p_order_id, v_leader.id, v_leader.role, v_product_id, v_amt, v_rule.id);
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Kas (transactions): ikuti pola confirm + soft_delete
  IF v_prev_status = 'PAID' AND v_now_status IS DISTINCT FROM 'PAID' THEN
    INSERT INTO public.transactions (
      user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
    ) VALUES (
      v_order.user_id, v_order.business_id, 'pengeluaran', 'bisnis', 'Koreksi Sales',
      'Unpaid/void sync sales CRM', v_prev_total, coalesce(v_order.order_date, CURRENT_DATE), p_order_id
    );
  ELSIF v_prev_status IS DISTINCT FROM 'PAID' AND v_now_status = 'PAID' THEN
    INSERT INTO public.transactions (
      user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
    ) VALUES (
      v_order.user_id, v_order.business_id, 'pemasukan', 'bisnis', 'Penjualan Sales',
      'Sales CRM · ' || coalesce(v_product_name, 'Produk') || ' x' || coalesce(v_qty, 0)::text,
      v_order.total, coalesce(v_order.order_date, CURRENT_DATE), p_order_id
    );
  ELSIF v_prev_status = 'PAID' AND v_now_status = 'PAID' AND v_prev_total IS DISTINCT FROM v_order.total THEN
    UPDATE public.transactions
    SET amount = v_order.total,
        description = 'Sales CRM · ' || coalesce(v_product_name, 'Produk') || ' x' || coalesce(v_qty, 0)::text
    WHERE ref_order_id = p_order_id
      AND type = 'pemasukan'
      AND category = 'Penjualan Sales';
    GET DIAGNOSTICS v_txn_updated = ROW_COUNT;
    IF v_txn_updated = 0 THEN
      INSERT INTO public.transactions (
        user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
      ) VALUES (
        v_order.user_id, v_order.business_id, 'pemasukan', 'bisnis', 'Penjualan Sales',
        'Sales CRM · ' || coalesce(v_product_name, 'Produk') || ' x' || coalesce(v_qty, 0)::text,
        v_order.total, coalesce(v_order.order_date, CURRENT_DATE), p_order_id
      );
    END IF;
  END IF;

  -- CRM aggregates (paid only)
  IF v_order.customer_id IS NOT NULL THEN
    SELECT COUNT(*)::int, coalesce(SUM(oi.qty), 0), coalesce(SUM(o.total), 0), MAX(o.order_date)
    INTO v_counts, v_items, v_spent, v_last
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = v_order.customer_id
      AND o.source = 'henima_sales'
      AND o.deleted_at IS NULL
      AND o.payment_status = 'PAID';

    v_status := CASE
      WHEN v_counts >= 2 THEN 'REPEAT_CUSTOMER'
      WHEN v_counts = 1 THEN 'ACTIVE'
      ELSE 'INACTIVE'
    END;

    UPDATE public.module_crm_customers SET
      total_orders = v_counts,
      total_items = v_items,
      total_spent = v_spent,
      last_purchase_at = v_last,
      first_purchase_at = coalesce(first_purchase_at, CASE WHEN v_counts >= 1 THEN v_last ELSE NULL END),
      status = v_status,
      updated_at = now()
    WHERE id = v_order.customer_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prev_status', v_prev_status,
    'status', v_now_status,
    'prev_total', v_prev_total,
    'total', v_order.total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.henima_sync_sale_side_effects(UUID, UUID, TEXT, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.henima_sync_sale_side_effects(UUID, UUID, TEXT, NUMERIC)
  TO service_role;
