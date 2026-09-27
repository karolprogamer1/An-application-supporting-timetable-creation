const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/slots', async (req, res) => {
  try {
    const result = await pool.query('SELECT id_slot, day_of_week, start_time, end_time FROM slots ORDER BY day_of_week, start_time');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Błąd pobierania slotów' });
  }
});

module.exports = router;
