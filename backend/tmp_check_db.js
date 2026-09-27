require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
});
(async () => {
  try {
    // Znajdź studentów z zajecia_id ale bez rekordu w tabeli grupa
    const orphans = await pool.query(`
      SELECT s.idstudent, s.nr_albumu, s.zajecia_id
      FROM student s
      LEFT JOIN grupa g ON s.idstudent = g.student_id
      WHERE s.zajecia_id IS NOT NULL AND g.id_grupa IS NULL
    `);
    console.log(`Znaleziono ${orphans.rows.length} studentów z zajecia_id ale bez rekordu w tabeli grupa:`);
    console.table(orphans.rows);

    if (orphans.rows.length > 0) {
      const ids = orphans.rows.map(r => r.idstudent);
      const result = await pool.query(
        'UPDATE student SET zajecia_id = NULL WHERE idstudent = ANY($1::int[])',
        [ids]
      );
      console.log(`\nWyczyszczono zajecia_id dla ${result.rowCount} studentów.`);
    } else {
      console.log('Brak osieroconych rekordów — baza jest spójna.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();