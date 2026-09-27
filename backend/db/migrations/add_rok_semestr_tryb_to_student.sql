-- Add rok_semestr and tryb columns to student table

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' AND column_name = 'rok_semestr'
    ) THEN
        ALTER TABLE student ADD COLUMN rok_semestr VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student' AND column_name = 'tryb'
    ) THEN
        ALTER TABLE student ADD COLUMN tryb VARCHAR(50);
    END IF;
END $$;

SELECT column_name FROM information_schema.columns WHERE table_name='student' ORDER BY column_name;