-- Adds optional sala_id to zajecia (idempotent)
-- zależność: sala(id_sala)


-- column
ALTER TABLE zajecia
  ADD COLUMN IF NOT EXISTS sala_id INT;

-- FK (create only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'zajecia'
      AND constraint_name = 'fk_zajecia_sala'
  ) THEN
    ALTER TABLE zajecia
      ADD CONSTRAINT fk_zajecia_sala
      FOREIGN KEY (sala_id)
      REFERENCES sala(id_sala)
      ON DELETE SET NULL;
  END IF;
END $$;



