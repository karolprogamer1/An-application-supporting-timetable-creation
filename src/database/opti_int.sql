CREATE TABLE Uzytkownicy (
    id SERIAL PRIMARY KEY,
    rola VARCHAR(50),
    login VARCHAR(50),
    haslo VARCHAR(50)
);

CREATE TABLE wykladowca (
    idwykladowca SERIAL PRIMARY KEY,
    Uzytkownicy_id INT REFERENCES Uzytkownicy(id),
    imie VARCHAR(50),
    nazwisko VARCHAR(50),
    tytul_naukowy VARCHAR(50)
);

CREATE TABLE przedmiot (
    idprzedmiotu SERIAL PRIMARY KEY,
    wykladowca_id INT REFERENCES wykladowca(idwykladowca),
    nazwa VARCHAR(50),
    typ VARCHAR(50),
    ilosc_godz INT
);

CREATE TABLE zajecia (
    idzajecia SERIAL PRIMARY KEY,
    przedmiot_id INT REFERENCES przedmiot(idprzedmiotu),
    typ VARCHAR(50),
    czas TIME NOT NULL
);

CREATE TABLE student (
    idstudent SERIAL PRIMARY KEY,
    zajecia_id INT REFERENCES zajecia(idzajecia),
    Uzytkownicy_id INT REFERENCES Uzytkownicy(id),
    imie VARCHAR(50),
    nazwisko VARCHAR(50),
    nr_albumu INT
);

CREATE TABLE zapisy_studentow (
    id_grupa SERIAL PRIMARY KEY,
    student_zajecia_id INT REFERENCES zajecia(idzajecia),
    student_id INT REFERENCES student(idstudent)
);

CREATE TABLE Plan_zajec (
    id_entry_plan SERIAL PRIMARY KEY,
    plan_id INT NOT NULL REFERENCES plany(id_plan),
    sala_id INT NOT NULL REFERENCES SALE(id_sale),
    slot_id INT NOT NULL REFERENCES slots(id_slot),
    zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia)
);

CREATE TABLE Raport (
    id_raport SERIAL PRIMARY KEY,
    plan_id_fk INT NOT NULL REFERENCES plany(id_plan),
    zawartosc TEXT
);

CREATE TABLE SALE (
    id_sale SERIAL PRIMARY KEY,
    Name VARCHAR(10)
);

CREATE TABLE slots (
    id_slot SERIAL PRIMARY KEY,
    day_of_week VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

CREATE TABLE dostepnosc_wykladowcy (
    wykladowca_id INT NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    slot_id INT NOT NULL REFERENCES slots(id_slot) ON DELETE CASCADE,
    czy_dostepny BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (wykladowca_id, slot_id)
);

CREATE TABLE preferencje_wykladowcy (
    wykladowca_id INT NOT NULL REFERENCES wykladowca(idwykladowca) ON DELETE CASCADE,
    slot_id INT NOT NULL REFERENCES slots(id_slot) ON DELETE CASCADE,
    waga_kary INT NOT NULL DEFAULT 1,
    PRIMARY KEY (wykladowca_id, slot_id)
);

CREATE TABLE zajecia_grupy (
    zajecia_id INT NOT NULL REFERENCES zajecia(idzajecia) ON DELETE CASCADE,
    grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
    PRIMARY KEY (zajecia_id, grupa_id)
);

CREATE TABLE grupy_dziekanskie (
    id_grupy SERIAL PRIMARY KEY,
    nazwa VARCHAR(20) NOT NULL UNIQUE,
    rok_akademicki VARCHAR(10)
);

CREATE TABLE studenci_grupy (
    student_id INT NOT NULL REFERENCES student(idstudent) ON DELETE CASCADE,
    grupa_id INT NOT NULL REFERENCES grupy_dziekanskie(id_grupy) ON DELETE CASCADE,
    PRIMARY KEY (student_id, grupa_id)
);

CREATE TABLE plany (
    id_plan SERIAL PRIMARY KEY,
    data_utworzenia TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opis VARCHAR(255),
    wygenerowany_przez INT REFERENCES Uzytkownicy(id)
);

CREATE INDEX idx_zajecia_przedmiot ON zajecia(przedmiot_id);
CREATE INDEX idx_zajecia_grupy_grupa ON zajecia_grupy(grupa_id);
CREATE INDEX idx_plan_zajec_plan ON Plan_zajec(plan_id);
CREATE INDEX idx_dostepnosc_wykladowca ON dostepnosc_wykladowcy(wykladowca_id);
CREATE INDEX idx_preferencje_wykladowcy ON preferencje_wykladowcy(wykladowca_id);
