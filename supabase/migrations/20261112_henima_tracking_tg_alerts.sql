-- Dedup + pengingat berulang Telegram HRD owner.
-- kind: senyap | sepi | kembali | laporan | absen | mock | lompatan | zero_visit | belum_pulang
-- Hanya service_role. Tidak mengubah bot FSM sales.

CREATE TABLE IF NOT EXISTS public.module_henima_tracking_tg_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.module_sales_staff(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'senyap', 'sepi', 'kembali', 'laporan', 'absen',
    'mock', 'lompatan', 'zero_visit', 'belum_pulang'
  )),
  send_count INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_henima_tg_alerts_staff_day_kind
  ON public.module_henima_tracking_tg_alerts (business_id, staff_id, day, kind)
  WHERE staff_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_henima_tg_alerts_laporan_day
  ON public.module_henima_tracking_tg_alerts (business_id, day)
  WHERE kind = 'laporan';

CREATE UNIQUE INDEX IF NOT EXISTS idx_henima_tg_alerts_absen_day
  ON public.module_henima_tracking_tg_alerts (business_id, day)
  WHERE kind = 'absen';

CREATE INDEX IF NOT EXISTS idx_henima_tg_alerts_biz_day
  ON public.module_henima_tracking_tg_alerts (business_id, day);

ALTER TABLE public.module_henima_tracking_tg_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.module_henima_tracking_tg_alerts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.module_henima_tracking_tg_alerts TO service_role;

NOTIFY pgrst, 'reload schema';
