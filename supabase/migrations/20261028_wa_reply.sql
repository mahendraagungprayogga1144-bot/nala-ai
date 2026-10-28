-- Tautan balasan WhatsApp. Additive. Tidak mengubah tabel sales atau tracking.

CREATE TABLE IF NOT EXISTS public.module_wa_reply_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  greeting TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id),
  UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.module_wa_reply_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  link_id UUID NOT NULL REFERENCES public.module_wa_reply_links(id) ON DELETE CASCADE,
  visitor_key TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_reply_messages_link_time
  ON public.module_wa_reply_messages (link_id, created_at DESC);

ALTER TABLE public.module_wa_reply_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_wa_reply_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wa_reply_links_owner" ON public.module_wa_reply_links FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "wa_reply_messages_owner" ON public.module_wa_reply_messages FOR ALL
    USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()))
    WITH CHECK (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
