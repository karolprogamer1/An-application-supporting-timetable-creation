-- Adds semestr/tryb columns to przedmiot (optional)

ALTER TABLE przedmiot ADD COLUMN IF NOT EXISTS semestr VARCHAR(20);
ALTER TABLE przedmiot ADD COLUMN IF NOT EXISTS tryb VARCHAR(20);


