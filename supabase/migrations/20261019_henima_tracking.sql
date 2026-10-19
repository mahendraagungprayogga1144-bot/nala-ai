-- Henima Tracking: jejak lokasi sales. Additive. Tidak mengubah tabel sales lain.

CREATE TABLE IF NOT EXISTS public.module_henima_tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_henima_tracking_links_biz
  ON public.module_henima_tracking_links (business_id);

CREATE TABLE IF NOT EXISTS public.module_henima_tracking_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('checkin_pagi', 'checkin_sore', 'visit', 'ping')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m INTEGER,
  note TEXT,
  photo_path TEXT,
  late BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_henima_tracking_points_staff_time
  ON public.module_henima_tracking_points (staff_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_henima_tracking_points_biz_time
  ON public.module_henima_tracking_points (business_id, recorded_at DESC);

ALTER TABLE public.module_henima_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_henima_tracking_points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "henima_tracking_links_owner" ON public.module_henima_tracking_links FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "henima_tracking_points_owner" ON public.module_henima_tracking_points FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'henima-tracking',
    'henima-tracking',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880;

  DROP POLICY IF EXISTS "henima_tracking_owner_read" ON storage.objects;
  CREATE POLICY "henima_tracking_owner_read" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'henima-tracking'
      AND split_part(name, '/', 1) IN (
        SELECT id::text FROM public.businesses WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'skip henima-tracking storage setup: %', SQLERRM;
END $$;
