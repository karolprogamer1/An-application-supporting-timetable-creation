-- Remove duplicate group assignments for the same student/class combination before
-- introducing a uniqueness rule.
DELETE FROM grupa g
USING (
  SELECT id_grupa,
         ROW_NUMBER() OVER (
           PARTITION BY student_id, zajecia_id
           ORDER BY id_grupa
         ) AS rn
  FROM grupa WHERE zajecia_id IS NOT NULL
) d
WHERE g.id_grupa = d.id_grupa
  AND d.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'grupa'
      AND indexname = 'uq_grupa_student_zajecia'
  ) THEN
    CREATE UNIQUE INDEX uq_grupa_student_zajecia
      ON grupa(student_id, zajecia_id)
      WHERE zajecia_id IS NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.grupa'::regclass
      AND conname = 'grupa_student_zajecia_unique'
  ) THEN
    ALTER TABLE grupa
      ADD CONSTRAINT grupa_student_zajecia_unique
      UNIQUE (student_id, zajecia_id);
  END IF;
END $$;