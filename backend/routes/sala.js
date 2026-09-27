const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET list
router.get('/sale', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_sala, nazwa, budynek, limit_studentow FROM sala ORDER BY nazwa');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/sala', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_sala, nazwa, budynek, limit_studentow FROM sala ORDER BY nazwa');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/sale/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    const result = await pool.query('SELECT id_sala, nazwa, budynek, limit_studentow FROM sala WHERE id_sala = $1', [idNum]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono sali' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/sala/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    const result = await pool.query('SELECT id_sala, nazwa, budynek, limit_studentow FROM sala WHERE id_sala = $1', [idNum]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono sali' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/sale', async (req, res) => {
  try {
    const { nazwa, budynek, limit_studentow } = req.body;
    if (!nazwa) return res.status(400).json({ error: 'Nazwa sali jest wymagana' });
    const budynekVal = budynek || null;
    const pojemnosc = limit_studentow != null ? parseInt(limit_studentow, 10) : null;

    const result = await pool.query(
      'INSERT INTO sala (nazwa, budynek, limit_studentow) VALUES($1, $2, $3) RETURNING id_sala, nazwa, budynek, limit_studentow',
      [nazwa, budynekVal, pojemnosc]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Sala o tej nazwie już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/sala', async (req, res) => {
  try {
    const { nazwa, budynek, limit_studentow } = req.body;
    if (!nazwa) return res.status(400).json({ error: 'Nazwa sali jest wymagana' });
    const budynekVal = budynek || null;
    const pojemnosc = limit_studentow != null ? parseInt(limit_studentow, 10) : null;

    const result = await pool.query(
      'INSERT INTO sala (nazwa, budynek, limit_studentow) VALUES($1, $2, $3) RETURNING id_sala, nazwa, budynek, limit_studentow',
      [nazwa, budynekVal, pojemnosc]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Sala o tej nazwie już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.put('/sale/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    const { nazwa, budynek, limit_studentow } = req.body;
    if (!nazwa) return res.status(400).json({ error: 'Nazwa sali jest wymagana' });
    const budynekVal = budynek || null;
    const pojemnosc = limit_studentow != null ? parseInt(limit_studentow, 10) : null;

    const result = await pool.query(
      'UPDATE sala SET nazwa=$1, budynek=$2, limit_studentow=$3 WHERE id_sala=$4 RETURNING id_sala, nazwa, budynek, limit_studentow',
      [nazwa, budynekVal, pojemnosc, idNum]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono sali' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Sala o tej nazwie już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.put('/sala/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    const { nazwa, budynek, limit_studentow } = req.body;
    if (!nazwa) return res.status(400).json({ error: 'Nazwa sali jest wymagana' });
    const budynekVal = budynek || null;
    const pojemnosc = limit_studentow != null ? parseInt(limit_studentow, 10) : null;

    const result = await pool.query(
      'UPDATE sala SET nazwa=$1, budynek=$2, limit_studentow=$3 WHERE id_sala=$4 RETURNING id_sala, nazwa, budynek, limit_studentow',
      [nazwa, budynekVal, pojemnosc, idNum]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Nie znaleziono sali' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Sala o tej nazwie już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.delete('/sale/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    await pool.query('DELETE FROM sala WHERE id_sala=$1', [idNum]);
    res.json({ message: 'Usunięto salę' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.delete('/sala/:id', async (req, res) => {
  try {
    const idNum = parseInt(req.params.id, 10);
    if (Number.isNaN(idNum)) return res.status(400).json({ error: 'Niepoprawne id' });

    await pool.query('DELETE FROM sala WHERE id_sala=$1', [idNum]);
    res.json({ message: 'Usunięto salę' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;
