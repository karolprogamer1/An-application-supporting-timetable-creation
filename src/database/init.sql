-- Active: 1780865938388@@127.0.0.1@5432@postgres
-- Usunięcie starych tabel w odpowiedniej kolejności, aby uniknąć błędów kluczy obcych
--DROP TABLE IF EXISTS "Plan_zajec", "Raport", "zapisy_studentow", "studenci_grupy", "zajecia_grupy", "preferencje_wykladowcy", "dostepnosc_wykladowcy", "wykladowca_availability", "wykladowca_availability_proposed", "grupa", "student", "zajecia", "przedmiot", "wykladowca", "Uzytkownicy", "SALE", "slots", "grupy_dziekanskie", "plan" CASCADE;

-- Tworzenie tabel w prawidłowej kolejności

CREATE TABLE Uzytkownicy (
    id SERIAL PRIMARY KEY,
    rola VARCHAR(50) NOT NULL,
    login VARCHAR(50) UNIQUE,
    haslo VARCHAR(255)
);
CREATE TABLE wykladowca (
    idwykladowca SERIAL PRIMARY KEY,
    Uzytkownicy_id INT UNIQUE REFERENCES Uzytkownicy(id) ON DELETE SET NULL,
    imie VARCHAR(50),
    nazwisko VARCHAR(50),
    tytul_naukowy VARCHAR(50)
);

CREATE TABLE SALE (
    id_sala SERIAL PRIMARY KEY,
    nazwa VARCHAR(50) NOT NULL,
    budynek VARCHAR(50),
    limit_studentow INTEGER
);

CREATE TABLE grupy_dziekanskie (
    id_grupy SERIAL PRIMARY KEY,
    nazwa VARCHAR(30) NOT NULL UNIQUE,
    rok_akademicki VARCHAR(10)
);

CREATE TABLE przedmiot (
    idprzedmiotu SERIAL PRIMARY KEY,
    wykladowca_id INT REFERENCES wykladowca(idwykladowca) ON DELETE SET NULL,
    nazwa VARCHAR(150),
    ilosc_godz INT,
    semestr VARCHAR(20),
    tryb VARCHAR(20),
    specjalnosc VARCHAR(100),
    typ VARCHAR(50)
);

CREATE TABLE zajecia (
    idzajecia SERIAL PRIMARY KEY,
    przedmiot_id INT REFERENCES przedmiot(idprzedmiotu) ON DELETE CASCADE,
    wykladowca_id INT REFERENCES wykladowca(idwykladowca) ON DELETE SET NULL,
    typ VARCHAR(50),
    czas TIME,
    sala_id INT REFERENCES SALE(id_sala) ON DELETE SET NULL,
    grupa INT, -- Numer grupy w ramach zajęć, nie klucz obcy
    dozwolone_dni TEXT[],
    komentarz TEXT,
    data_rozpoczecia DATE,
    data_zakonczenia DATE
);

CREATE TABLE student (
    idstudent SERIAL PRIMARY KEY,
    Uzytkownicy_id INT UNIQUE REFERENCES Uzytkownicy(id) ON DELETE SET NULL,
    nr_albumu INT UNIQUE,
    rok_semestr VARCHAR(20),
    tryb VARCHAR(20),
    specjalnosc VARCHAR(100)
);

-- Tabela łącząca studentów z grupami zajęciowymi
CREATE TABLE grupa (
    id_grupa SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES student(idstudent) ON DELETE CASCADE,
    zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia) ON DELETE CASCADE,
    CONSTRAINT grupa_student_zajecia_unique UNIQUE (student_id, zajecia_id)
);

-- Tabele związane z planistą
CREATE TABLE slots (
    id_slot SERIAL PRIMARY KEY,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE(day_of_week, start_time, end_time)
);

CREATE TABLE dostepnosc_wykladowcy (
    wykladowca_id INT NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    slot_id INT NOT NULL REFERENCES slots(id_slot) ON DELETE CASCADE,
    czy_dostepny BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (wykladowca_id, slot_id) -- ON CONFLICT
);

CREATE TABLE preferencje_wykladowcy (
    wykladowca_id INT NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    slot_id INT NOT NULL REFERENCES slots(id_slot) ON DELETE CASCADE,
    waga_kary INT NOT NULL DEFAULT 1,
    PRIMARY KEY (wykladowca_id, slot_id) -- ON CONFLICT
);

CREATE TABLE zajecia_grupy (
    zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia) ON DELETE CASCADE,
    grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
    PRIMARY KEY (zajecia_id, grupa_id) -- ON CONFLICT
);

CREATE TABLE studenci_grupy (
    student_id INT NOT NULL REFERENCES student(idstudent) ON DELETE CASCADE,
    grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
    PRIMARY KEY (student_id, grupa_id) -- ON CONFLICT
);

CREATE TABLE plan (
    id_plan SERIAL PRIMARY KEY,
    data_utworzenia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opis VARCHAR(255),
    wygenerowany_przez INT REFERENCES Uzytkownicy(id) ON DELETE SET NULL,
    selected_semesters JSONB,
    study_mode VARCHAR(10)
);

CREATE TABLE Plan_zajec (
    id_entry_plan SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES plan(id_plan) ON DELETE CASCADE,
    sala_id INT REFERENCES SALE(id_sala) ON DELETE SET NULL,
    zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia) ON DELETE CASCADE,
    day_of_week VARCHAR(20),
    start_time TIME,
    end_time TIME
);

CREATE TABLE Raport (
    id_raport SERIAL PRIMARY KEY,
    plan_id_fk INT NOT NULL REFERENCES plan(id_plan) ON DELETE CASCADE,
    zawartosc TEXT
);

CREATE TABLE wykladowca_availability (
    wykladowca_id INTEGER NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    rok_akademicki VARCHAR(10) NOT NULL,
    semestr_numer VARCHAR(10) NOT NULL,
    tryb_studiow VARCHAR(20) NOT NULL,
    availability JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow)
);

CREATE TABLE wykladowca_availability_proposed (
    wykladowca_id INTEGER NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    rok_akademicki VARCHAR(10) NOT NULL,
    semestr_numer VARCHAR(10) NOT NULL,
    tryb_studiow VARCHAR(20) NOT NULL,
    availability JSONB NOT NULL DEFAULT '{}',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wykladowca_id, rok_akademicki, semestr_numer, tryb_studiow)
);

-- Indeksy dla wydajności
CREATE INDEX idx_zajecia_przedmiot ON zajecia(przedmiot_id);
CREATE INDEX idx_zajecia_grupy_grupa ON zajecia_grupy(grupa_id);
CREATE INDEX idx_plan_zajec_plan ON Plan_zajec(plan_id);
CREATE INDEX idx_dostepnosc_wykladowca ON dostepnosc_wykladowcy(wykladowca_id);
CREATE INDEX idx_preferencje_wykladowcy ON preferencje_wykladowcy(wykladowca_id);

INSERT INTO uzytkownicy (rola, login, haslo) VALUES
--('planista', 'planista', 'planista'),
--('admin', 'admin', 'admin'),
('wykladowca', 'd.zarek', 'wykladowca');

---('wykladowca', 't.oberski', 'wykladowca');


--ALTER TABLE wykladowca_availability ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(255);
--ALTER TABLE wykladowca_availability_proposed ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(255);


--czyszczenie tabel jeśli aplikacja będzie działać nieprawidłowo
--TRUNCATE TABLE zajecia RESTART IDENTITY CASCADE;
--
--
--
--
---- Usuwa wszystkie dane z tabeli 'przedmiot' oraz kaskadowo usuwa
-- wszystkie powiązane rekordy w tabelach zależnych (np. 'zajecia', 'plan_zajec').
-- Automatycznie resetuje też sekwencje auto-inkrementacji.
--TRUNCATE TABLE przedmiot RESTART IDENTITY CASCADE;