-- Adds grupa column to zajecia (group number for class sections)

ALTER TABLE zajecia
  ADD COLUMN IF NOT EXISTS grupa INT;