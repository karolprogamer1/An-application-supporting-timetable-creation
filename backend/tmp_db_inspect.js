const pool = require('./db');
(async () => {
  try {
    const v = await pool.query('SELECT version()');
    console.log('version:', v.rows[0]);
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='wykladowca_availability'");
    console.log('columns:', cols.rows);
    const tbl = await pool.query('SELECT * FROM wykladowca_availability LIMIT 5');
    console.log('sample rows:', tbl.rows);
  } catch (e) {
    console.error('ERR', e.message, e.code, e.stack);
  } finally {
    await pool.end();
  }
})();