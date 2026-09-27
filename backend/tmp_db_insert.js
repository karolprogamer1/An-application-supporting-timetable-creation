const pool = require('./db');
(async () => {
  try {
    const id = 6; // use existing wykladowca id
    const avail = {};
    const ins = await pool.query('INSERT INTO wykladowca_availability (wykladowca_id, availability) VALUES ($1,$2)', [id, avail]);
    console.log('insert result', ins.rowCount);
  } catch (e) {
    console.error('ERR', e.message, e.code, e.stack);
  } finally {
    await pool.end();
  }
})();