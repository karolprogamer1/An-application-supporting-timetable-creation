const pool = require('./db');
const sql = `
CREATE TABLE IF NOT EXISTS student(
    idstudent INT GENERATED ALWAYS AS IDENTITY,
    zajecia_id INT,
    Uzytkownicy_id INT,
    nr_albumu INT,
    rok_semestr VARCHAR(10),
    tryb VARCHAR(20),
    specjalnosc VARCHAR(100),

    PRIMARY KEY(idstudent),

    CONSTRAINT fk_student_uzytkownik
        FOREIGN KEY(Uzytkownicy_id)
        REFERENCES Uzytkownicy(id),

    CONSTRAINT fk_student_zajecia
        FOREIGN KEY(zajecia_id)
        REFERENCES zajecia(idzajecia)
);

CREATE TABLE IF NOT EXISTS grupa(
    id_grupa INT GENERATED ALWAYS AS IDENTITY,
    student_id INT,
    zajecia_id INT,
    ilosc INT,

    PRIMARY KEY(id_grupa),

    CONSTRAINT fk_grupa_student
        FOREIGN KEY(student_id)
        REFERENCES student(idstudent),

    CONSTRAINT fk_grupa_zajecia
        FOREIGN KEY(zajecia_id)
        REFERENCES zajecia(idzajecia)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wykladowca_availability (
    wykladowca_id INT NOT NULL,
    rok_akademicki VARCHAR(9) NOT NULL,
    semestr_numer INT NOT NULL,
    tryb_studiow VARCHAR(10) NOT NULL,
    availability JSONB,
    PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow),
    CONSTRAINT fk_wykladowca_availability_wykladowca
        FOREIGN KEY(wykladowca_id)
        REFERENCES wykladowca(idwykladowca)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wykladowca_availability_proposed (
    wykladowca_id INT NOT NULL,
    rok_akademicki VARCHAR(9) NOT NULL,
    semestr_numer INT NOT NULL,
    tryb_studiow VARCHAR(10) NOT NULL,
    availability JSONB,
    submitted_at TIMESTAMPTZ,
    PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow),
    CONSTRAINT fk_wykladowca_availability_proposed_wykladowca
        FOREIGN KEY(wykladowca_id)
        REFERENCES wykladowca(idwykladowca)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS preferencje_wykladowcy (
    wykladowca_id INT NOT NULL,
    slot_id INT NOT NULL,
    kara INT NOT NULL DEFAULT 0,
    PRIMARY KEY (wykladowca_id, slot_id),
    CONSTRAINT fk_preferencje_wykladowca
        FOREIGN KEY(wykladowca_id)
        REFERENCES wykladowca(idwykladowca)
        ON DELETE CASCADE,
    CONSTRAINT fk_preferencje_slot
        FOREIGN KEY(slot_id)
        REFERENCES slots(id_slot)
        ON DELETE CASCADE
);
`;

pool.query(sql)
  .then(() => { console.log('Tables created'); process.exit(0); })
  .catch(err => { console.error('Error creating tables:', err.message); process.exit(1); });
