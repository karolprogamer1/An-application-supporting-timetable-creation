-- Migration: add slots and lecturer availability slots
-- Assumes PostgreSQL

CREATE TABLE IF NOT EXISTS slots (
  id_slot SERIAL PRIMARY KEY,
  day_of_week VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  UNIQUE(day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS dostepnosc_wykladowcy (
  wykladowca_id INT NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
  slot_id INT NOT NULL REFERENCES slots(id_slot) ON DELETE CASCADE,
  czy_dostepny BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (wykladowca_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_dostepnosc_wykladowca ON dostepnosc_wykladowcy(wykladowca_id);
