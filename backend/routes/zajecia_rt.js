const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET all – only columns that exist in zajecia
router.get('/zajecia', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT idzajecia, przedmiot_id, typ, czas, sala_id, grupa
       FROM zajecia
       ORDER BY idzajecia`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET by id
router.get('/zajecia/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    const result = await pool.query(
      'SELECT idzajecia, przedmiot_id, typ, czas, sala_id, grupa FROM zajecia WHERE idzajecia = $1',
      [idNum]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Nie znaleziono' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// GET by range
router.get('/zajecia/:id/:idt', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    const idtNum = parseInt(req.params.idt, 10);
    if (isNaN(idNum) || isNaN(idtNum)) {
      return res.status(400).json({ error: 'Parametr id musi być liczbą całkowitą' });
    }
    const result = await pool.query(
      'SELECT idzajecia, przedmiot_id, typ, czas, sala_id, grupa FROM zajecia WHERE idzajecia >= $1 AND idzajecia <= $2',
      [idNum, idtNum]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// POST, PUT, DELETE – keep them but remove references to wykladowca_id if they don't exist
// (or leave them, but they might fail if you use them)

module.exports = router;
