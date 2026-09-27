-- Add limit_studentow column to sala if it doesn't exist

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sala' AND column_name = 'limit_studentow'
    ) THEN
        ALTER TABLE sala ADD COLUMN limit_studentow INT;
    END IF;
END $$;
