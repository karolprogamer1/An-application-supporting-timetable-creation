-- Rebuild the lessons-to-rooms foreign key so it points to the current sala table
ALTER TABLE zajecia DROP CONSTRAINT IF EXISTS fk_zajecia_sala;

ALTER TABLE zajecia
  ADD CONSTRAINT fk_zajecia_sala
  FOREIGN KEY (sala_id)
  REFERENCES sala(id_sala)
  ON DELETE SET NULL;
