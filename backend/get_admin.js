const pool = require('./db');

(async () => {
  try {
    const r = await pool.query('SELECT id, login, rola FROM uzytkownicy WHERE rola = $1 LIMIT 5', ['administrator']);
    console.log('Admini:');
    console.log(r.rows);
    await pool.end();
  } catch (e) {
    console.error('Błąd:', e.message);
    process.exit(1);
  }
})();
