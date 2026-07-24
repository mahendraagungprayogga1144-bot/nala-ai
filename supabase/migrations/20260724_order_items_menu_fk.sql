-- PostgREST embed order_items → menus requires a real FK.
-- Without this, Keuangan Bisnis / Owner kasir selects fail with
-- "Could not find a relationship between 'order_items' and 'menus'".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_menu_id_fkey'
  ) THEN
    -- Drop orphan menu_ids that would block the FK.
    UPDATE order_items oi
    SET menu_id = NULL
    WHERE menu_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM menus m WHERE m.id = oi.menu_id);

    ALTER TABLE order_items
      ADD CONSTRAINT order_items_menu_id_fkey
      FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE SET NULL;
  END IF;
END $$;
