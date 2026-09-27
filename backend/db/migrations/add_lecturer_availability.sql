-- Migration: add lecturer availability storage
-- Assumes PostgreSQL

CREATE TABLE IF NOT EXISTS wykladowca_availability (
  wykladowca_id INT PRIMARY KEY,
  availability JSONB NOT NULL,
  CONSTRAINT fk_wykladowca_availability
    FOREIGN KEY (wykladowca_id)
    REFERENCES wykladowca(idwykladowca)
    ON DELETE CASCADE
);

