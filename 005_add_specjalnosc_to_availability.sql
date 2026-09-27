-- Dodaje kolumnę 'specjalnosc' do tabel przechowujących dostępność wykładowców.
-- Jest to konieczne do wdrożenia funkcjonalności dostępności per specjalność.
-- Poprawia to błąd "kolumna 'specjalnosc' nie istnieje".

ALTER TABLE wykladowca_availability ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(255);
ALTER TABLE wykladowca_availability_proposed ADD COLUMN IF NOT EXISTS specjalnosc VARCHAR(255);