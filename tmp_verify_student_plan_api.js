const pool = require('./backend/db.js');
const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  try {
    const students = await pool.query(
      `SELECT s.idstudent, s.uzytkownicy_id, s.nr_albumu, s.rok_semestr, s.tryb, s.specjalnosc, u.login
       FROM student s
       LEFT JOIN uzytkownicy u ON s.uzytkownicy_id = u.id
       WHERE s.uzytkownicy_id IS NOT NULL
       LIMIT 5`
    );
    console.log('sample student rows:', students.rows);

    const assigned = await pool.query(
      `SELECT s.idstudent, s.uzytkownicy_id, u.login, g.zajecia_id
       FROM student s
       JOIN grupa g ON s.idstudent = g.student_id
       JOIN uzytkownicy u ON s.uzytkownicy_id = u.id
       LIMIT 5`
    );
    console.log('sample assigned students:', assigned.rows);

    if (assigned.rows.length === 0) {
      console.log('No assigned student found to test.');
      process.exit(0);
    }

    const target = assigned.rows[0];
    console.log('Testing student id:', target.idstudent, 'user id:', target.uzytkownicy_id, 'login:', target.login);

    const urls = [
      `http://localhost:5000/api/plan/student/${target.idstudent}`,
      `http://localhost:5000/api/plan/student/${target.uzytkownicy_id}`,
      `http://localhost:5000/api/student/${target.idstudent}`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('URL:', url, 'status:', res.status);
        console.log('BODY:', text.slice(0, 2000));
      } catch (err) {
        console.error('Fetch error for', url, err.message);
      }
    }
  } catch (err) {
    console.error('DB or runtime error:', err);
  } finally {
    process.exit(0);
  }
})();
