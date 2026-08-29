-- Henima Sales CRM + Telegram (additive, idempotent).
-- Does NOT drop tables, truncate, or rewrite existing POS/kasir data.
-- orders.source = 'henima_sales' isolates these rows from F&B / AI Kasir.

-- ---------------------------------------------------------------------------
-- 0) Bootstrap tabel Gercep yang mungkin belum ada di project ini
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_businesses_user ON public.businesses(user_id);

CREATE TABLE IF NOT EXISTS public.module_crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  nama TEXT NOT NULL,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_module_crm_biz ON public.module_crm_customers(business_id);
ALTER TABLE public.module_crm_customers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "module_crm_own" ON public.module_crm_customers FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  total NUMERIC DEFAULT 0,
  diskon NUMERIC DEFAULT 0,
  hpp NUMERIC DEFAULT 0,
  laba NUMERIC DEFAULT 0,
  metode_bayar TEXT DEFAULT 'tunai',
  catatan TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_biz_date ON public.orders(business_id, order_date);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id UUID,
  qty NUMERIC DEFAULT 1,
  harga_jual NUMERIC DEFAULT 0,
  hpp NUMERIC DEFAULT 0,
  laba NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID,
  type TEXT,
  scope TEXT DEFAULT 'bisnis',
  category TEXT,
  description TEXT,
  amount NUMERIC DEFAULT 0,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  business_id UUID,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  photo_url TEXT,
  stock NUMERIC DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  price NUMERIC,
  cost NUMERIC,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  product_id BIGINT,
  type TEXT,
  reason TEXT,
  quantity NUMERIC DEFAULT 0,
  note TEXT,
  profit_loss NUMERIC DEFAULT 0,
  movement_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 1) Extend CRM customers
-- ---------------------------------------------------------------------------
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS kota TEXT;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS phone_normalized TEXT;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS assigned_sales_id UUID;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'NEW';
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS first_purchase_at DATE;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS last_purchase_at DATE;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS total_items NUMERIC DEFAULT 0;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS total_spent NUMERIC DEFAULT 0;
ALTER TABLE public.module_crm_customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.module_crm_customers
SET phone_normalized = regexp_replace(coalesce(whatsapp_phone, telepon, ''), '[^0-9]', '', 'g')
WHERE phone_normalized IS NULL
  AND coalesce(whatsapp_phone, telepon, '') <> '';

CREATE INDEX IF NOT EXISTS idx_crm_customers_phone_norm
  ON public.module_crm_customers (business_id, phone_normalized);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_crm_customers_phone_unique'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.module_crm_customers
      WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
      GROUP BY business_id, phone_normalized
      HAVING COUNT(*) > 1
    ) THEN
      CREATE UNIQUE INDEX idx_crm_customers_phone_unique
        ON public.module_crm_customers (business_id, phone_normalized)
        WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_customers_sales
  ON public.module_crm_customers (assigned_sales_id)
  WHERE assigned_sales_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_status
  ON public.module_crm_customers (business_id, status);

-- ---------------------------------------------------------------------------
-- 2) Extend orders / order_items / transactions
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sales_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name_snapshot TEXT;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ref_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_orders_henima_biz_date
  ON public.orders (business_id, order_date DESC)
  WHERE source = 'henima_sales' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_henima_sales
  ON public.orders (sales_id, order_date DESC)
  WHERE source = 'henima_sales' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_henima_customer
  ON public.orders (customer_id, order_date DESC)
  WHERE source = 'henima_sales' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_henima_payment
  ON public.orders (business_id, payment_status)
  WHERE source = 'henima_sales' AND deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_orders_idempotency_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_orders_idempotency_unique
      ON public.orders (business_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_ref_order
  ON public.transactions (ref_order_id)
  WHERE ref_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Sales staff (RBAC + Telegram link)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_sales_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_user_id BIGINT,
  role TEXT NOT NULL CHECK (role IN ('FOUNDER', 'LEADER', 'SALES')),
  leader_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  nama TEXT NOT NULL,
  telepon TEXT,
  invite_code TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_staff_telegram
  ON public.module_sales_staff (telegram_user_id)
  WHERE telegram_user_id IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_staff_invite
  ON public.module_sales_staff (invite_code)
  WHERE invite_code IS NOT NULL AND invite_code <> '';

CREATE INDEX IF NOT EXISTS idx_sales_staff_biz ON public.module_sales_staff (business_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_staff_user ON public.module_sales_staff (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_staff_leader ON public.module_sales_staff (leader_id) WHERE leader_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'module_crm_customers_assigned_sales_fkey'
  ) THEN
    ALTER TABLE public.module_crm_customers
      ADD CONSTRAINT module_crm_customers_assigned_sales_fkey
      FOREIGN KEY (assigned_sales_id) REFERENCES public.module_sales_staff(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip crm assigned_sales fk: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Follow-ups, testimonials, targets, commissions, audit, telegram
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.module_sales_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.module_crm_customers(id) ON DELETE CASCADE,
  sales_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  scheduled_at DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONTACTED', 'INTERESTED', 'NO_RESPONSE', 'REPEAT_ORDER', 'NOT_INTERESTED')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_biz_date
  ON public.module_sales_follow_ups (business_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_sales
  ON public.module_sales_follow_ups (sales_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_customer
  ON public.module_sales_follow_ups (customer_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS public.module_sales_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.module_crm_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  sales_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_testimonials_biz ON public.module_sales_testimonials (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_sales ON public.module_sales_testimonials (sales_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_customer ON public.module_sales_testimonials (customer_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_order ON public.module_sales_testimonials (order_id);

CREATE TABLE IF NOT EXISTS public.module_sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_id UUID REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  quantity_target NUMERIC NOT NULL DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_lookup
  ON public.module_sales_targets (business_id, sales_id, period_type, active);

CREATE TABLE IF NOT EXISTS public.module_sales_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_id UUID REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('FOUNDER', 'LEADER', 'SALES')),
  product_id TEXT,
  fixed_amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_biz
  ON public.module_sales_commission_rules (business_id, active, effective_from);

CREATE TABLE IF NOT EXISTS public.module_sales_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sales_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  product_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  rule_id UUID REFERENCES public.module_sales_commission_rules(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_order ON public.module_sales_commission_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_sales ON public.module_sales_commission_ledger (sales_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_ledger_unique
  ON public.module_sales_commission_ledger (order_id, sales_id, role);

CREATE TABLE IF NOT EXISTS public.module_sales_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_telegram_id BIGINT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_audit_biz ON public.module_sales_audit_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_audit_entity ON public.module_sales_audit_logs (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.module_sales_telegram_sessions (
  telegram_user_id BIGINT PRIMARY KEY,
  business_id UUID,
  staff_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_sales_telegram_updates (
  update_id BIGINT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_updates_created
  ON public.module_sales_telegram_updates (created_at);

-- ---------------------------------------------------------------------------
-- 5) RLS — owners can use dashboard client; Telegram/staff go through service role
-- ---------------------------------------------------------------------------
ALTER TABLE public.module_sales_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_telegram_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_telegram_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_staff_owner" ON public.module_sales_staff FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_follow_ups_owner" ON public.module_sales_follow_ups FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_testimonials_owner" ON public.module_sales_testimonials FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_targets_owner" ON public.module_sales_targets FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_comm_rules_owner" ON public.module_sales_commission_rules FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_comm_ledger_owner" ON public.module_sales_commission_ledger FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_audit_owner_read" ON public.module_sales_audit_logs FOR SELECT
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Telegram session tables: no authenticated policies (service role only)
DO $$ BEGIN
  CREATE POLICY "sales_tg_sessions_deny" ON public.module_sales_telegram_sessions
    FOR ALL USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "sales_tg_updates_deny" ON public.module_sales_telegram_updates
    FOR ALL USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 6) Private testimonials bucket
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('testimonials', 'testimonials', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

  DROP POLICY IF EXISTS "testimonials_owner_read" ON storage.objects;
  CREATE POLICY "testimonials_owner_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'testimonials'
      AND split_part(name, '/', 1) IN (
        SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip testimonials storage setup: %', SQLERRM;
END $$;

-- Writes go through service role (Telegram / API). No authenticated insert policy.

-- ---------------------------------------------------------------------------
-- 7) Atomic confirm / reverse RPCs (service_role only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.henima_pick_commission_rule(
  p_business_id UUID,
  p_sales_id UUID,
  p_role TEXT,
  p_product_id TEXT,
  p_on DATE
) RETURNS public.module_sales_commission_rules
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
  FROM public.module_sales_commission_rules r
  WHERE r.business_id = p_business_id
    AND r.active = true
    AND r.effective_from <= p_on
    AND (r.effective_to IS NULL OR r.effective_to >= p_on)
    AND (r.sales_id = p_sales_id OR r.sales_id IS NULL)
    AND (r.role = p_role OR r.role IS NULL)
    AND (r.product_id = p_product_id OR r.product_id IS NULL)
  ORDER BY
    (r.sales_id IS NOT NULL)::int DESC,
    (r.product_id IS NOT NULL)::int DESC,
    (r.role IS NOT NULL)::int DESC,
    r.effective_from DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.henima_confirm_sale(
  p_business_id UUID,
  p_owner_user_id UUID,
  p_sales_staff_id UUID,
  p_idempotency_key TEXT,
  p_customer_id UUID,
  p_product_id TEXT,
  p_product_name TEXT,
  p_quantity NUMERIC,
  p_unit_price NUMERIC,
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
  v_total NUMERIC;
  v_cost NUMERIC := 0;
  v_laba NUMERIC := 0;
  v_stock NUMERIC;
  v_new_stock NUMERIC;
  v_counts INTEGER;
  v_items NUMERIC;
  v_spent NUMERIC;
  v_status TEXT;
  v_sales public.module_sales_staff%ROWTYPE;
  v_leader public.module_sales_staff%ROWTYPE;
  v_rule public.module_sales_commission_rules%ROWTYPE;
  v_amt NUMERIC;
  v_prod_cost NUMERIC := 0;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity_invalid';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'price_invalid';
  END IF;
  v_total := round(p_quantity * p_unit_price - coalesce(p_discount, 0));
  IF v_total < 0 THEN
    RAISE EXCEPTION 'total_invalid';
  END IF;

  SELECT id INTO v_existing
  FROM public.orders
  WHERE business_id = p_business_id
    AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'order_id', v_existing);
  END IF;

  SELECT * INTO v_sales FROM public.module_sales_staff WHERE id = p_sales_staff_id AND business_id = p_business_id;
  IF v_sales.id IS NULL THEN
    RAISE EXCEPTION 'sales_not_found';
  END IF;

  SELECT cost, stock INTO v_prod_cost, v_stock
  FROM public.products WHERE id::text = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;
  v_cost := coalesce(v_prod_cost, 0) * p_quantity;
  v_laba := v_total - v_cost;

  v_new_stock := coalesce(v_stock, 0) - p_quantity;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'stock_insufficient';
  END IF;
  UPDATE public.products SET stock = v_new_stock WHERE id::text = p_product_id;

  INSERT INTO public.orders (
    user_id, business_id, total, diskon, hpp, laba, metode_bayar, catatan, order_date,
    source, status, customer_id, sales_id, payment_status, idempotency_key, updated_at
  ) VALUES (
    p_owner_user_id, p_business_id, v_total, coalesce(p_discount, 0), v_cost, v_laba,
    p_payment_method, p_notes, p_order_date,
    'henima_sales', 'completed', p_customer_id, p_sales_staff_id, p_payment_status,
    p_idempotency_key, now()
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (order_id, product_id, qty, harga_jual, hpp, laba, product_name_snapshot)
  VALUES (
    v_order_id, p_product_id, p_quantity, p_unit_price,
    coalesce(v_prod_cost, 0), (p_unit_price - coalesce(v_prod_cost, 0)) * p_quantity, p_product_name
  );

  BEGIN
    INSERT INTO public.stock_movements (user_id, product_id, type, reason, quantity, note, profit_loss, movement_date)
    VALUES (
      p_owner_user_id, p_product_id::bigint, 'keluar', 'terjual', p_quantity,
      'Henima sales ' || v_order_id::text, v_laba, p_order_date
    );
  EXCEPTION WHEN others THEN
    NULL; -- stock already updated; movement is audit-only
  END;

  IF p_payment_status = 'PAID' THEN
    INSERT INTO public.transactions (
      user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
    ) VALUES (
      p_owner_user_id, p_business_id, 'pemasukan', 'bisnis', 'Penjualan Sales',
      'Sales CRM · ' || p_product_name || ' x' || p_quantity::text,
      v_total, p_order_date, v_order_id
    );
  END IF;

  -- Customer aggregates (paid only)
  IF p_payment_status = 'PAID' THEN
    SELECT
      COUNT(*)::int,
      coalesce(SUM(oi.qty), 0),
      coalesce(SUM(o.total), 0)
    INTO v_counts, v_items, v_spent
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.customer_id = p_customer_id
      AND o.source = 'henima_sales'
      AND o.deleted_at IS NULL
      AND o.payment_status = 'PAID';

    v_status := CASE
      WHEN v_counts >= 2 THEN 'REPEAT_CUSTOMER'
      WHEN v_counts = 1 THEN 'ACTIVE'
      ELSE 'NEW'
    END;

    UPDATE public.module_crm_customers SET
      first_purchase_at = coalesce(first_purchase_at, p_order_date),
      last_purchase_at = p_order_date,
      total_orders = v_counts,
      total_items = v_items,
      total_spent = v_spent,
      status = v_status,
      updated_at = now()
    WHERE id = p_customer_id;
  END IF;

  -- Commission only on paid
  IF p_payment_status = 'PAID' THEN
    v_rule := public.henima_pick_commission_rule(p_business_id, p_sales_staff_id, v_sales.role, p_product_id, p_order_date);
    IF v_rule.id IS NOT NULL THEN
      v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_total * coalesce(v_rule.percentage, 0) / 100);
      INSERT INTO public.module_sales_commission_ledger
        (business_id, order_id, sales_id, role, product_id, amount, rule_id)
      VALUES (p_business_id, v_order_id, p_sales_staff_id, v_sales.role, p_product_id, v_amt, v_rule.id);
    END IF;

    IF v_sales.leader_id IS NOT NULL THEN
      SELECT * INTO v_leader FROM public.module_sales_staff WHERE id = v_sales.leader_id;
      IF v_leader.id IS NOT NULL THEN
        v_rule := public.henima_pick_commission_rule(p_business_id, v_leader.id, v_leader.role, p_product_id, p_order_date);
        IF v_rule.id IS NOT NULL THEN
          v_amt := round(coalesce(v_rule.fixed_amount, 0) + v_total * coalesce(v_rule.percentage, 0) / 100);
          INSERT INTO public.module_sales_commission_ledger
            (business_id, order_id, sales_id, role, product_id, amount, rule_id)
          VALUES (p_business_id, v_order_id, v_leader.id, v_leader.role, p_product_id, v_amt, v_rule.id);
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

CREATE OR REPLACE FUNCTION public.henima_soft_delete_sale(
  p_order_id UUID,
  p_business_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_counts INTEGER;
  v_items NUMERIC;
  v_spent NUMERIC;
  v_last DATE;
  v_status TEXT;
  v_prod_type TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders
  WHERE id = p_order_id AND business_id = p_business_id AND source = 'henima_sales'
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;
  IF v_order.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;

  UPDATE public.orders SET deleted_at = now(), status = 'voided', updated_at = now()
  WHERE id = p_order_id;

  SELECT data_type INTO v_prod_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'stock_movements' AND column_name = 'product_id';

  FOR v_item IN
    SELECT product_id, qty FROM public.order_items WHERE order_id = p_order_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock = coalesce(stock, 0) + v_item.qty
      WHERE id::text = v_item.product_id;

      IF v_prod_type IS DISTINCT FROM 'uuid' THEN
        INSERT INTO public.stock_movements (user_id, product_id, type, reason, quantity, note, profit_loss, movement_date)
        VALUES (v_order.user_id, v_item.product_id::bigint, 'masuk', 'void_sales', v_item.qty,
                'Hapus sales ' || p_order_id::text, 0, CURRENT_DATE);
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.module_sales_commission_ledger WHERE order_id = p_order_id;

  IF v_order.payment_status = 'PAID' THEN
    INSERT INTO public.transactions (
      user_id, business_id, type, scope, category, description, amount, transaction_date, ref_order_id
    ) VALUES (
      v_order.user_id, v_order.business_id, 'pengeluaran', 'bisnis', 'Koreksi Sales',
      'Void sales CRM', v_order.total, CURRENT_DATE, p_order_id
    );
  END IF;

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
      status = v_status,
      updated_at = now()
    WHERE id = v_order.customer_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'already_deleted', false);
END;
$$;

REVOKE ALL ON FUNCTION public.henima_confirm_sale(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.henima_soft_delete_sale(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.henima_pick_commission_rule(UUID, UUID, TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.henima_confirm_sale(
  UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE
) TO service_role;
GRANT EXECUTE ON FUNCTION public.henima_soft_delete_sale(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.henima_pick_commission_rule(UUID, UUID, TEXT, TEXT, DATE) TO service_role;

NOTIFY pgrst, 'reload schema';
