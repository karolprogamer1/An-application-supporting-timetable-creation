-- add_plan_metadata.sql

ALTER TABLE plan
    ADD COLUMN IF NOT EXISTS selected_semesters TEXT[];

ALTER TABLE plan
    ADD COLUMN IF NOT EXISTS study_mode VARCHAR(20);
