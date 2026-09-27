-- 003_refactor_plan_zajec_use_time.sql

-- Usunięcie zależności od tabeli slots w plan_zajec
ALTER TABLE plan_zajec DROP CONSTRAINT IF EXISTS fk_slot;
ALTER TABLE plan_zajec DROP COLUMN IF EXISTS slot_id;

-- Dodanie kolumn przechowujących informacje o czasie bezpośrednio w tabeli
ALTER TABLE plan_zajec ADD COLUMN IF NOT EXISTS day_of_week VARCHAR(20);
ALTER TABLE plan_zajec ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE plan_zajec ADD COLUMN IF NOT EXISTS end_time TIME;