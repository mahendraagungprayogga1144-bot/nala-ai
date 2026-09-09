-- Gercep Profit Engine — additive, versioned financial rules.
-- Historical fee/HPP/price rows are never overwritten; new versions get a new effective window.

CREATE TABLE IF NOT EXISTS public.gpe_marketplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.gpe_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  marketplace_id UUID REFERENCES public.gpe_marketplaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  external_id TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  store_id UUID REFERENCES public.gpe_stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sku TEXT,
  marketplace TEXT NOT NULL DEFAULT 'TikTok Shop',
  selling_price NUMERIC NOT NULL DEFAULT 0,
  target_net_margin_pct NUMERIC NOT NULL DEFAULT 15,
  currency TEXT NOT NULL DEFAULT 'IDR',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  selling_price NUMERIC,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_product_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.gpe_product_variants(id) ON DELETE CASCADE,
  material_cost NUMERIC NOT NULL DEFAULT 0,
  bottle_cost NUMERIC NOT NULL DEFAULT 0,
  packaging_cost NUMERIC NOT NULL DEFAULT 0,
  box_cost NUMERIC NOT NULL DEFAULT 0,
  label_cost NUMERIC NOT NULL DEFAULT 0,
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  other_cost NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_price_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  marketplace TEXT,
  selling_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  funded_by TEXT NOT NULL DEFAULT 'SELLER',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  funded_by TEXT NOT NULL DEFAULT 'SELLER',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  platform TEXT NOT NULL,
  fee_name TEXT NOT NULL,
  rate NUMERIC NOT NULL DEFAULT 0,
  fixed_fee NUMERIC NOT NULL DEFAULT 0,
  calculation_base TEXT NOT NULL DEFAULT 'NET_REVENUE',
  program_name TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_affiliate_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  affiliate_type TEXT NOT NULL DEFAULT 'STANDARD',
  affiliate_name TEXT,
  affiliate_id TEXT,
  rate NUMERIC NOT NULL DEFAULT 0,
  calculation_base TEXT NOT NULL DEFAULT 'NET_REVENUE',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  store_id UUID REFERENCES public.gpe_stores(id) ON DELETE SET NULL,
  marketplace TEXT,
  external_id TEXT,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.gpe_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.gpe_product_variants(id) ON DELETE SET NULL,
  sku TEXT,
  product_name TEXT,
  qty NUMERIC NOT NULL DEFAULT 1,
  selling_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_order_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.gpe_orders(id) ON DELETE CASCADE,
  fee_rule_id UUID REFERENCES public.gpe_fee_rules(id) ON DELETE SET NULL,
  fee_name TEXT NOT NULL,
  calculation_base TEXT,
  rate NUMERIC,
  fixed_fee NUMERIC,
  amount NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gpe_order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.gpe_orders(id) ON DELETE CASCADE,
  name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  funded_by TEXT NOT NULL DEFAULT 'SELLER'
);

CREATE TABLE IF NOT EXISTS public.gpe_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  marketplace TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_ad_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.gpe_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_set_id UUID REFERENCES public.gpe_ad_sets(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.gpe_campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_ad_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.gpe_campaigns(id) ON DELETE CASCADE,
  spend_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ad_spend NUMERIC NOT NULL DEFAULT 0,
  clicks NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  conversions NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_ad_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_spend_id UUID REFERENCES public.gpe_ad_spend(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.gpe_campaigns(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.gpe_orders(id) ON DELETE SET NULL,
  attributed_revenue NUMERIC NOT NULL DEFAULT 0,
  ad_orders NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  period TEXT NOT NULL DEFAULT 'monthly',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_cost_id UUID NOT NULL REFERENCES public.gpe_fixed_costs(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.gpe_campaigns(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  allocation_date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS public.gpe_financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_profit_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  period_id UUID REFERENCES public.gpe_financial_periods(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.gpe_products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.gpe_campaigns(id) ON DELETE SET NULL,
  as_of DATE NOT NULL DEFAULT CURRENT_DATE,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_roi_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  snapshot_id UUID REFERENCES public.gpe_profit_snapshots(id) ON DELETE CASCADE,
  business_roi NUMERIC,
  ad_roi NUMERIC,
  invested_capital NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gpe_system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (business_id, key)
);

CREATE TABLE IF NOT EXISTS public.gpe_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gpe_products_biz ON public.gpe_products(business_id);
CREATE INDEX IF NOT EXISTS idx_gpe_fee_rules_biz_plat ON public.gpe_fee_rules(business_id, platform, effective_from);
CREATE INDEX IF NOT EXISTS idx_gpe_affiliate_biz ON public.gpe_affiliate_rules(business_id, effective_from);
CREATE INDEX IF NOT EXISTS idx_gpe_orders_biz_date ON public.gpe_orders(business_id, order_date);
CREATE INDEX IF NOT EXISTS idx_gpe_campaigns_biz ON public.gpe_campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_gpe_ad_spend_biz_date ON public.gpe_ad_spend(business_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_gpe_costs_product_from ON public.gpe_product_costs(product_id, effective_from);

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gpe_marketplaces','gpe_stores','gpe_products','gpe_product_variants','gpe_product_costs',
    'gpe_price_rules','gpe_discounts','gpe_vouchers','gpe_fee_rules','gpe_affiliate_rules',
    'gpe_orders','gpe_order_items','gpe_order_fees','gpe_order_discounts','gpe_campaigns',
    'gpe_ad_sets','gpe_ads','gpe_ad_spend','gpe_ad_attribution','gpe_fixed_costs',
    'gpe_cost_allocations','gpe_financial_periods','gpe_profit_snapshots','gpe_roi_calculations',
    'gpe_system_settings','gpe_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format(
        'CREATE POLICY gpe_own_%I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        t, t
      );
    EXCEPTION
      WHEN undefined_column THEN
        -- child tables without user_id stay parent-scoped
        NULL;
      WHEN duplicate_object THEN
        NULL;
    END;
  END LOOP;
END $$;
