# TODO: Walidacja "student_id nie należy do podanego zajecia_id"

## Krok 1 — Diagnoza
- [x] Odczytano `backend/routes/student.js` i `backend/routes/zajecia.js` (brak walidacji relacji student↔zajecia poza istnieniem encji).
- [x] Ustalono, że błąd pojawia się przy `POST /api/grupa` (Menu.jsx ~1317) oraz odczytano `backend/routes/grupa.js`.

## Krok 2 — Plan walidacji w `grupa`
- [x] Dodać/usprawnić walidację w `POST /grupa`:
  - [x] jeśli podano `zajecia_id` i student ma inny `zajecia_id`, zwrócić dokładnie komunikat: `student_id nie należy do podanego zajecia_id`.
  - [x] upewnić się, że zapytanie sprawdzające używa prawidłowych nazw kolumn (`student.zajecia_id`).

## Krok 3 — Konsystencja logiki w `PUT /grupa/:id`
- [x] Analogiczną walidację dodać również do `PUT /grupa/:id` (aktualizacja student_id / zajecia_id, jeżeli jest przekazywane).

## Krok 4 — Walidacja frontu (opcjonalnie)
- [x] Sprawdzić w `src/student/Menu.jsx` payload wysyłany na `POST /api/grupa` i czy backend spodziewa się `student_id` i `zajecia_id`.

## Krok 5 — Test ręczny
- [x] Wykonać ręczny test: podać zgodny i niezgodny `student_id`+`zajecia_id` i potwierdzić poprawny kod odpowiedzi i komunikat.
