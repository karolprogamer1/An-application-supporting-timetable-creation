# TODO - fix: brak kolumny dostepnosc w tabeli wykladowca

- [x] Zaktualizować `backend/routes/wykladowca.js`: usunąć `dostepnosc` z INSERT/UPDATE do tabeli `wykladowca`.
- [x] Sprawdzić, czy inne miejsca w backendzie nie odwołują się do `wykladowca.dostepnosc` (np. CSV import / inne route).
- [x] Uaktualnić frontend: wyświetlanie dostępności wykładowcy z osobnego endpointu `/api/wykladowca/:id/availability`.
- [x] Uruchomić migracje (jeśli potrzebne) i uruchomić backend, aby potwierdzić brak błędu.

