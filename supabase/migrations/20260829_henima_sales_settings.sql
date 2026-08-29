-- Identitas modul Sales (bukan nama tenant Gercep).
-- Aman, additive. Nama "g" di bisnis Gercep tidak dipakai di Telegram/dashboard sales.

CREATE TABLE IF NOT EXISTS public.module_sales_settings (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Henima Scent',
  tagline TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.module_sales_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_settings_owner" ON public.module_sales_settings FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Isi default untuk bisnis yang sudah punya sales staff
INSERT INTO public.module_sales_settings (business_id, display_name)
SELECT DISTINCT s.business_id, 'Henima Scent'
FROM public.module_sales_staff s
ON CONFLICT (business_id) DO NOTHING;

GRANT ALL ON TABLE public.module_sales_settings TO service_role;

NOTIFY pgrst, 'reload schema';
