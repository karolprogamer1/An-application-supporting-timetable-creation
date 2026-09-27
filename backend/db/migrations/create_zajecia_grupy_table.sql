CREATE TABLE IF NOT EXISTS zajecia_grupy (
  zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia) ON DELETE CASCADE,
  grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
  PRIMARY KEY (zajecia_id, grupa_id)
);

CREATE TABLE IF NOT EXISTS studenci_grupy (
  student_id INT NOT NULL REFERENCES student(idstudent) ON DELETE CASCADE,
  grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
  PRIMARY KEY (student_id, grupa_id)
);

CREATE INDEX IF NOT EXISTS idx_zajecia_grupy_grupa ON zajecia_grupy(grupa_id);
CREATE INDEX IF NOT EXISTS idx_studenci_grupy_grupa ON studenci_grupy(grupa_id);
