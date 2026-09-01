-- Henima Studio — product photo editor (background replace). Additive.

CREATE TABLE IF NOT EXISTS public.module_sales_studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  sales_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  product_id TEXT,
  product_name TEXT,
  preset TEXT NOT NULL,
  frame TEXT NOT NULL DEFAULT 'square',
  prompt TEXT,
  original_path TEXT NOT NULL,
  result_path TEXT NOT NULL,
  provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_studio_assets_biz
  ON public.module_sales_studio_assets (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_assets_product
  ON public.module_sales_studio_assets (business_id, product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE public.module_sales_studio_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_studio_owner" ON public.module_sales_studio_assets FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'henima-studio',
    'henima-studio',
    false,
    8388608,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 8388608;

  DROP POLICY IF EXISTS "henima_studio_owner_read" ON storage.objects;
  CREATE POLICY "henima_studio_owner_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'henima-studio'
      AND split_part(name, '/', 1) IN (
        SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip henima-studio storage setup: %', SQLERRM;
END $$;
