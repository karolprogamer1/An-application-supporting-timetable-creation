-- Repair assignments created while the old backend still used student.zajecia_id
-- as the visible group. Only single group rows per student are repaired, so future
-- multi-group assignments are not collapsed if migrations are run again.

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
  )
  AND (
    SELECT COUNT(*)
    FROM grupa gx
    WHERE gx.student_id = g.student_id
  ) = 1;
