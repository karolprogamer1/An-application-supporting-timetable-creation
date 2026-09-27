-- Usuwa wszystkie dane z tabel plan, plan_zajec i raport.
-- Resetuje również sekwencje auto-inkrementacji dla tych tabel.
-- Użyteczne do czyszczenia starych, wygenerowanych planów przed nowym startem.

TRUNCATE plan, plan_zajec, raport RESTART IDENTITY CASCADE;