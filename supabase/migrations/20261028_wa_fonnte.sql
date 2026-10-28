-- Token perangkat Fonnte untuk balasan WhatsApp otomatis. Additive.

ALTER TABLE public.module_wa_reply_links
  ADD COLUMN IF NOT EXISTS fonnte_token TEXT,
  ADD COLUMN IF NOT EXISTS fonnte_device TEXT,
  ADD COLUMN IF NOT EXISTS fonnte_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_reply_links_fonnte_key
  ON public.module_wa_reply_links (fonnte_key)
  WHERE fonnte_key IS NOT NULL;
