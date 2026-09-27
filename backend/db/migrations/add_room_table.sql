-- Adds room/sala support

CREATE TABLE IF NOT EXISTS sala(
  id_sala INT GENERATED ALWAYS AS IDENTITY,
  nazwa VARCHAR(50) NOT NULL,
  budynek VARCHAR(50),
  limit_studentow INT,

  PRIMARY KEY(id_sala),
  CONSTRAINT uq_sala_nazwa UNIQUE(nazwa)
);

-- (Optional) seed examples if DB is empty
INSERT INTO sala (nazwa, budynek, limit_studentow)
SELECT v.nazwa, v.budynek, v.limit_studentow
FROM (VALUES
  ('S1', 'Budynek A', 30),
  ('S2', 'Budynek A', 30),
  ('S3', 'Budynek A', 40),
  ('S4', 'Budynek A', 40),
  ('S5', 'Budynek B', 50),
  ('S6', 'Budynek B', 50),
  ('S7', 'Budynek B', 25),
  ('S8', 'Budynek B', 25),
  ('S9', 'Budynek C', 60),
  ('S10', 'Budynek C', 60)
) AS v(nazwa, budynek, limit_studentow)
WHERE NOT EXISTS (
  SELECT 1 FROM sala WHERE nazwa = v.nazwa
);

