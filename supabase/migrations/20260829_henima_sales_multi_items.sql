-- Satu order, banyak produk (paket Afternoon + The Distance). Additive.
-- Stok setiap SKU berkurang. Soft-delete yang lama sudah restore per order_items.

CREATE OR REPLACE FUNCTION public.henima_confirm_sale_items(
  p_business_id UUID,
  p_owner_user_id UUID,
  p_sales_staff_id UUID,
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_lines JSONB,
  p_discount NUMERIC,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_notes TEXT,
  p_order_date DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
  v_order_id UUID;
  v_total NUMERIC := 0;
  v_cost NUMERIC := 0;
  v_laba NUMERIC := 0;
  v_counts INTEGER;
  v_items NUMERIC;
  v_spent NUMERIC;
  v_status TEXT;
  v_sales public.module_sales_staff%ROWTYPE;
  v_leader public.module_sales_staff%ROWTYPE;
  v_rule public.module_sales_commission_rules%ROWTYPE;
  v_amt NUMERIC;
  v_line RECORD;
  v_stock NUMERIC;
  v_new_stock NUMERIC;
  v_prod_cost NUMERIC;
  v_first_pid TEXT;
  v_names TEXT := '';
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 1 THEN
    RAISE EXCEPTION 'quantity_invalid';
  END IF;

  SELECT id INTO v_existing
  FROM public.orders
  WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_existing);
  END IF;

  SELECT * INTO v_sales FROM public.module_sales_staff WHERE id = p_sales_staff_id AND business_id = p_business_id;
  IF v_sales.id IS NULL THEN
    RAISE EXCEPTION 'sales_not_found';
  END IF;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(product_id text, product_name text, qty numeric, unit_price numeric)
  LOOP
    IF v_line.qty IS NULL OR v_line.qty <= 0 THEN RAISE EXCEPTION 'quantity_invalid'; END IF;
    IF v_line.unit_price IS NULL OR v_line.unit_price < 0 THEN RAISE EXCEPTION 'price_invalid'; END IF;
    SELECT cost, stock INTO v_prod_cost, v_stock
    FROM public.products WHERE id::text = v_line.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
    v_new_stock := coalesce(v_stock, 0) - v_line.qty;
    IF v_new_stock < 0 THEN RAISE EXCEPTION 'stock_insufficient'; END IF;
    v_total := v_total + round(v_line.qty * v_line.unit_price);
    v_cost := v_cost + coalesce(v_prod_cost, 0) * v_line.qty;
    IF v_first_pid IS NULL THEN v_first_pid := v_line.product_id; END IF;
  END LOOP;

  v_total := v_total - coalesce(p_discount, 0);
  IF v_total < 0 THEN RAISE EXCEPTION 'total_invalid'; END IF;
  v_laba := v_total - v_cost;

  -- decrement stock (second pass after validation)
  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(product_id text, product_name text, qty numeric, unit_price numeric)
  LOOP
    UPDATE public.products SET stock = coalesce(stock, 0) - v_line.qty WHERE id::text = v_line.product_id;
  END LOOP;

  INSERT INTO public.orders (
    user_id, business_id, total, diskon, hpp, laba, metode_bayar, catatan, order_date,
    source, status, customer_id, sales_id, payment_status, idempotency_key, updated_at
  ) VALUES (
    p_owner_user_id, p_business_id, v_total, coalesce(p_discount, 0), v_cost, v_laba,
    p_payment_method, p_notes, p_order_date,
    'henima_sales', 'completed', p_customer_id, p_sales_staff_id, p_payment_status,
    p_idempotency_key, now()
  ) RETURNING id INTO v_order_id;

  FOR v_line IN
    SELECT * FROM jsonb_to_recordset(p_lines)
      AS x(product_id text, product_name text, qty numeric, unit_price numeric)
  LOOP
    SELECT cost INTO v_prod_cost FROM public.products WHERE id::text = v_line.product_id;
    INSERT INTO public.order_items (order_id, product_id, qty, harga_jual, hpp, laba, product_name_snapshot)
    VALUES (
      v_order_id, v_line.product_id, v_line.qty, v_line.unit_price,
      coalesce(v_prod_cost, 0),
      (v_line.unit_price - coalesce(v_prod_cost, 0)) * v_line.qty,
      v_line.product_name
    );
    v_names := v_names || CASE WHEN v_names = '' THEN '' ELSE ' + ' END || v_line.product_name || ' x' || v_line.qty::text;
    BEGIN
      INSERT INTO public.stock_movements (user_id, product_id, type, reason, quantity, note, profit_loss, movement_date)
      VALUES (
        p_owner_user_id, v_line.product_id::bigint, 'keluar', 'terjual', v_line.qty,
        'Henima sales ' || v_order_id::text, v_laba, p_order_date
      );
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  IF p_payment_status = 'PAID' THEN
    INSERT INTO public.transactions (
      user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
    ) VALUES (
      p_owner_user_id, p_business_id, 'pemasukan', 'bisnis', 'Penjualan Sales',
      'Sales CRM · ' || v_names, v_total, p_order_date, v_order_id
    );

    SELECT
      (SELECT COUNT(*)::int
       FROM public.orders o
       WHERE o.customer_id = p_customer_id AND o.source = 'henima_sales'
         AND o.deleted_at IS NULL AND o.payment_status = 'PAID'),
      (SELECT coalesce(SUM(oi.qty), 0)
       FROM public.orders o
       JOIN public.order_items oi ON oi.order_id = o.id
       WHERE o.customer_id = p_customer_id AND o.source = 'henima_sales'
         AND o.deleted_at IS NULL AND o.payment_status = 'PAID'),
      (SELECT coalesce(SUM(o.total), 0)
       FROM public.orders o
       WHERE o.customer_id = p_customer_id AND o.source = 'henima_sales'
         AND o.deleted_at IS NULL AND o.payment_status = 'PAID')
    INTO v_counts, v_items, v_spent;

    v_status := CASE WHEN v_counts >= 2 THEN 'REPEAT_CUSTOMER' WHEN v_counts = 1 THEN 'ACTIVE' ELSE 'NEW' END;
    UPDATE public.module_crm_customers SET
      first_purchase_at = coalesce(first_purchase_at, p_order_date),
      last_purchase_at = p_order_date,
      total_orders = v_counts,
      total_items = v_items,
      total_spent = v_spent,
      status = v_status,
      updated_at = now()
    WHERE id = p_customer_id;

    v_rule := public.henima_pick_commission_rule(p_business_id, p_sales_staff_id, v_sales.role, v_first_pid, p_order_date);
    IF v_rule.id IS NOT NULL THEN
      v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_total * coalesce(v_rule.percentage, 0) / 100);
      INSERT INTO public.module_sales_commission_ledger
        (business_id, order_id, sales_id, role, product_id, amount, rule_id)
      VALUES (p_business_id, v_order_id, p_sales_staff_id, v_sales.role, v_first_pid, v_amt, v_rule.id);
    END IF;
    IF v_sales.leader_id IS NOT NULL THEN
      SELECT * INTO v_leader FROM public.module_sales_staff WHERE id = v_sales.leader_id;
      IF v_leader.id IS NOT NULL THEN
        v_rule := public.henima_pick_commission_rule(p_business_id, v_leader.id, v_leader.role, v_first_pid, p_order_date);
        IF v_rule.id IS NOT NULL THEN
          v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_total * coalesce(v_rule.percentage, 0) / 100);
          INSERT INTO public.module_sales_commission_ledger
            (business_id, order_id, sales_id, role, product_id, amount, rule_id)
          VALUES (p_business_id, v_order_id, v_leader.id, v_leader.role, v_first_pid, v_amt, v_rule.id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'order_id', v_order_id, 'total', v_total);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing FROM public.orders
    WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_existing);
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.henima_confirm_sale_items(
  UUID, UUID, UUID, TEXT, UUID, JSONB, NUMERIC, TEXT, TEXT, TEXT, DATE
) TO service_role;

NOTIFY pgrst, 'reload schema';
