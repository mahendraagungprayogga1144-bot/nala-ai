-- Ensure produksi recipes tables + FK so PostgREST can embed products via material_id.
-- Fixes empty/failed "Simpan Resep" when tables missing or embed breaks.

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  product_id UUID,
  yield_quantity NUMERIC DEFAULT 1,
  yield_unit TEXT DEFAULT 'pcs',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  material_id UUID NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'gr',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  business_id UUID NOT NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  quantity_produced NUMERIC DEFAULT 0,
  total_material_cost NUMERIC DEFAULT 0,
  additional_cost NUMERIC DEFAULT 0,
  hpp_per_unit NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'selesai',
  production_date DATE DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS yield_quantity NUMERIC DEFAULT 1;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS yield_unit TEXT DEFAULT 'pcs';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS business_id UUID;
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS material_id UUID;
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'gr';

CREATE INDEX IF NOT EXISTS idx_recipes_biz ON public.recipes(business_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_biz ON public.production_logs(business_id);

-- FK so PostgREST embed recipe_ingredients → products works
DO $$ BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_material_id_fkey;
    ALTER TABLE public.recipe_ingredients
      ADD CONSTRAINT recipe_ingredients_material_id_fkey
      FOREIGN KEY (material_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recipe_ingredients FK: %', SQLERRM;
END $$;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes_own" ON public.recipes;
CREATE POLICY "recipes_own" ON public.recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recipe_ingredients_via_recipe" ON public.recipe_ingredients;
CREATE POLICY "recipe_ingredients_via_recipe" ON public.recipe_ingredients
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "production_logs_own" ON public.production_logs;
CREATE POLICY "production_logs_own" ON public.production_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
