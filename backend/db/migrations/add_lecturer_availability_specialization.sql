-- Store availability separately for every specialization.
-- Existing records become the general (no-specialization) availability.

ALTER TABLE wykladowca_availability
  ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(100);
ALTER TABLE wykladowca_availability_proposed
  ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(100);

UPDATE wykladowca_availability
  SET specjalnosc = ''
  WHERE specjalnosc IS NULL;
UPDATE wykladowca_availability_proposed
  SET specjalnosc = ''
  WHERE specjalnosc IS NULL;

ALTER TABLE wykladowca_availability
  ALTER COLUMN specjalnosc SET DEFAULT '',
  ALTER COLUMN specjalnosc SET NOT NULL;
ALTER TABLE wykladowca_availability_proposed
  ALTER COLUMN specjalnosc SET DEFAULT '',
  ALTER COLUMN specjalnosc SET NOT NULL;

ALTER TABLE wykladowca_availability
  DROP CONSTRAINT IF EXISTS wykladowca_availability_pkey;
ALTER TABLE wykladowca_availability
  ADD PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc);

ALTER TABLE wykladowca_availability_proposed
  DROP CONSTRAINT IF EXISTS wykladowca_availability_proposed_pkey;
ALTER TABLE wykladowca_availability_proposed
  ADD PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow, specjalnosc);
