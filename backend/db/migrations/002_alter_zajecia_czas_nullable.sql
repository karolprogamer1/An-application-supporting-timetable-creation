-- Zezwala na wartość NULL w kolumnie 'czas' w tabeli 'zajecia'
ALTER TABLE zajecia ALTER COLUMN czas DROP NOT NULL;