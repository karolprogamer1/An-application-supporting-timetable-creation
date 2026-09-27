-- Adds wykladowca_id to zajecia (needed by backend/routes/zajecia.js)
-- FK: wykladowca_id -> wykladowca(idwykladowca)
-- Also backfills wykladowca_id from przedmiot.wykladowca_id.

-- Adds wykladowca_id to zajecia (needed by backend/routes/zajecia.js)
-- Note: migration runner in this project appears to use a non-Postgres parser.
-- Therefore we avoid DO/$$ blocks and keep statements simple.

ALTER TABLE zajecia
  ADD COLUMN IF NOT EXISTS wykladowca_id INT;

-- Backfill (safe even if FK isn't present yet)
UPDATE zajecia z
SET wykladowca_id = p.wykladowca_id
FROM przedmiot p
WHERE z.przedmiot_id = p.idprzedmiotu
  AND (z.wykladowca_id IS NULL)
  AND p.wykladowca_id IS NOT NULL;

-- FK (optional). If your runner supports it, you can add this constraint manually.
-- ALTER TABLE zajecia
--   ADD CONSTRAINT fk_zajecia_wykladowca
--   FOREIGN KEY (wykladowca_id)
--   REFERENCES wykladowca(idwykladowca)
--   ON DELETE SET NULL;


