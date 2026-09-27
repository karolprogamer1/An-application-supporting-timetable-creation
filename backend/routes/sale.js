const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/sale', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_sala, nazwa FROM sala ORDER BY nazwa');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

module.exports = router;

