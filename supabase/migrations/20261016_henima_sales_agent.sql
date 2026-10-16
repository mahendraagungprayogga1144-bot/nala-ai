-- Memori & tugas agent Henima Sales. Additive. Service role only.

CREATE TABLE IF NOT EXISTS public.module_sales_agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  telegram_user_id BIGINT,
  kind TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_agent_memory_staff
  ON public.module_sales_agent_memory (business_id, staff_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.module_sales_agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.module_sales_staff(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_agent_tasks_staff
  ON public.module_sales_agent_tasks (business_id, staff_id, created_at DESC);

ALTER TABLE public.module_sales_agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_sales_agent_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "sales_agent_memory_deny" ON public.module_sales_agent_memory
    FOR ALL USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_agent_tasks_deny" ON public.module_sales_agent_tasks
    FOR ALL USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
