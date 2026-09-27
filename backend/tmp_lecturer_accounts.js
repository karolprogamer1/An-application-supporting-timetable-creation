const pool = require('./db');
(async () => {
  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.login, u.rola, w.idwykladowca, w.uzytkownicy_id
       FROM uzytkownicy u
       LEFT JOIN wykladowca w ON w.uzytkownicy_id = u.id
       WHERE lower(u.rola) = lower('wykladowca')
       ORDER BY u.id`
    );
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    await pool.end();
  }
})();