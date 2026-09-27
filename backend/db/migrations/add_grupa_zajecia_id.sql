-- Store the class assignment on each group membership.
-- This allows one student to belong to multiple class groups without overwriting
-- student.zajecia_id.

ALTER TABLE grupa
  ADD COLUMN IF NOT EXISTS zajecia_id INT;

-- Copy legacy values from student.zajecia_id only when the target lesson exists.
UPDATE grupa g
SET zajecia_id = s.zajecia_id
FROM student s
WHERE g.student_id = s.idstudent
  AND g.zajecia_id IS NULL
  AND s.zajecia_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM zajecia z
    WHERE z.idzajecia = s.zajecia_id
  );

-- Remove any remaining invalid references before adding the foreign key.
UPDATE grupa
SET zajecia_id = NULL
WHERE zajecia_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM zajecia z
    WHERE z.idzajecia = grupa.zajecia_id
  );

-- Make sure the constraint can be added safely even if some rows already had bad data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'grupa'
      AND column_name = 'zajecia_id'
  ) THEN
    ALTER TABLE grupa
      ADD COLUMN zajecia_id INT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'grupa'
      AND constraint_name = 'fk_grupa_zajecia'
  ) THEN
    ALTER TABLE grupa
      ADD CONSTRAINT fk_grupa_zajecia
      FOREIGN KEY (zajecia_id)
      REFERENCES zajecia(idzajecia)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grupa_student_zajecia
  ON grupa(student_id, zajecia_id)
  WHERE zajecia_id IS NOT NULL;
