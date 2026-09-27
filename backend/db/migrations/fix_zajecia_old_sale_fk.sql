DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zajecia' AND column_name = 'id_sale'
  ) THEN
    ALTER TABLE zajecia DROP CONSTRAINT IF EXISTS zajecia_id_sale_fkey;
    ALTER TABLE zajecia DROP COLUMN IF EXISTS id_sale;
  END IF;
END $$;
