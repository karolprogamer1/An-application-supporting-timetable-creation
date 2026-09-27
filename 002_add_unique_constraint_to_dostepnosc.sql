-- Dodaje ograniczenie unikalności do tabeli dostepnosc_wykladowcy
-- dla kombinacji wykladowca_id i slot_id, co jest wymagane
-- przez zapytanie INSERT ... ON CONFLICT.
ALTER TABLE dostepnosc_wykladowcy
ADD CONSTRAINT dostepnosc_wykladowcy_unique UNIQUE (wykladowca_id, slot_id);