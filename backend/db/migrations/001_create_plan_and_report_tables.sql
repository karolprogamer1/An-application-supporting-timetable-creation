-- 001_create_plan_and_report_tables.sql

-- Tabela do przechowywania metadanych o wygenerowanych planach
CREATE TABLE IF NOT EXISTS plan (
    id_plan SERIAL PRIMARY KEY,
    data_utworzenia TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    opis TEXT,
    wygenerowany_przez TEXT
);

-- Tabela przechowująca konkretne przypisania zajęć w ramach planu
CREATE TABLE IF NOT EXISTS plan_zajec (
    id_plan_zajec SERIAL PRIMARY KEY,
    plan_id INT NOT NULL,
    sala_id INT,
    slot_id INT NOT NULL,
    zajecia_id INT NOT NULL,
    
    CONSTRAINT fk_plan
        FOREIGN KEY(plan_id) 
        REFERENCES plan(id_plan)
        ON DELETE CASCADE,
        
    CONSTRAINT fk_sala
        FOREIGN KEY(sala_id) 
        REFERENCES sala(id_sala)
        ON DELETE SET NULL,

    CONSTRAINT fk_slot
        FOREIGN KEY(slot_id) 
        REFERENCES slots(id_slot)
        ON DELETE CASCADE,

    CONSTRAINT fk_zajecia
        FOREIGN KEY(zajecia_id) 
        REFERENCES zajecia(idzajecia)
        ON DELETE CASCADE
);

-- Tabela do przechowywania raportów z generowania planu
CREATE TABLE IF NOT EXISTS raport (
    id_raport SERIAL PRIMARY KEY,
    plan_id_fk INT NOT NULL,
    zawartosc JSONB,
    data_utworzenia TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_raport_plan
        FOREIGN KEY(plan_id_fk) 
        REFERENCES plan(id_plan)
        ON DELETE CASCADE
);