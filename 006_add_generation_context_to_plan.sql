-- Active: 1780865938388@@127.0.0.1@5432@postgres@public
-- Active: 1780865938388@@127.0.0.1@5432@postgres
-- Dodaje kolumny do tabeli 'plan', aby przechowywać dodatkowy kontekst generowania.
-- Jest to konieczne do poprawnego działania podglądu planów i filtrowania.
-- Poprawia to błąd "kolumna 'selected_semesters' nie istnieje".

ALTER TABLE plan ADD COLUMN IF NOT EXISTS selected_semesters JSONB;
ALTER TABLE plan ADD COLUMN IF NOT EXISTS study_mode VARCHAR(10);