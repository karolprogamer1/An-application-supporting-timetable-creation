const express = require('express');
const router = express.Router();
const pool = require('../db');
router.get('/dostepnosc', async (req, res) => {
  try {
    const { wykladowca_id } = req.query;
    if (!wykladowca_id) {
      return res.status(400).json({ error: 'Brak parametru wykladowca_id' });
    }
    const idNum = parseInt(wykladowca_id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr wykladowca_id musi być liczbą' });
    }

    // Pobierz dostępność z tabeli dostepnosc_wykladowcy
    const result = await pool.query(
      'SELECT slot_id, czy_dostepny FROM dostepnosc_wykladowcy WHERE wykladowca_id = $1',
      [idNum]
    );
    // Zwróć tablicę obiektów { slot_id, czy_dostepny }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania dostępności' });
  }
});
router.put('/dostepnosc', async (req, res) => {
  try {
    const updates = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Oczekiwano tablicy aktualizacji' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const item of updates) {
        const { wykladowca_id, slot_id, czy_dostepny } = item;
        // Dodatkowa walidacja, aby upewnić się, że wszystkie pola są obecne
        if (wykladowca_id == null || slot_id == null || czy_dostepny == null) {
          throw new Error(
            `Brak wymaganych pól w jednym z elementów: ${JSON.stringify(item)}`
          );
        }

        // Insert or update
        await client.query(
          `INSERT INTO dostepnosc_wykladowcy (wykladowca_id, slot_id, czy_dostepny)
           VALUES ($1, $2, $3)
           ON CONFLICT (wykladowca_id, slot_id)
           DO UPDATE SET czy_dostepny = EXCLUDED.czy_dostepny`,
          [wykladowca_id, slot_id, czy_dostepny]
        );
      }
      await client.query('COMMIT');
      res.json({ message: 'Dostępność zaktualizowana' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd zapisu dostępności' });
  }
});
module.exports = router;
