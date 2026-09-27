const pool = require('./backend/db.js');
const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  try {
    const report = await pool.query(
      'SELECT r.zawartosc FROM raport r JOIN plan p ON r.plan_id_fk = p.id_plan ORDER BY p.data_utworzenia DESC LIMIT 1'
    );
    const raw = report.rows[0].zawartosc;
    const data = typeof raw === 'object' ? raw : JSON.parse(raw);
    const courseIds = Array.from(new Set(Object.values(data.results || {}).flatMap(v => Array.isArray(v.plan) ? v.plan.map(e => e.courseId) : [])));
    const numericIds = courseIds.map(c => typeof c === 'string' ? parseInt(c.split('-')[0], 10) : c).filter(Number.isFinite);
    console.log('courseIds', courseIds);
    console.log('numericIds', numericIds);

    const whereClause = numericIds.length > 0 ? `WHERE g.zajecia_id = ANY($1::int[])` : 'WHERE false';
    const students = await pool.query(
      `SELECT s.idstudent, s.uzytkownicy_id, u.login, g.zajecia_id
       FROM student s
       JOIN grupa g ON s.idstudent = g.student_id
       JOIN uzytkownicy u ON s.uzytkownicy_id = u.id
       ${whereClause}
       LIMIT 20`,
      [numericIds]
    );
    console.log('matching students', students.rows.length);
    students.rows.forEach(row => console.log(row));

    if (students.rows.length > 0) {
      const student = students.rows[0];
      const url = `http://localhost:5000/api/plan/student/${student.idstudent}`;
      console.log('fetching', url);
      const res = await fetch(url);
      console.log('status', res.status);
      const json = await res.json();
      console.log('body', JSON.stringify(json, null, 2));
    }
  } catch (err) {
    console.error('error', err);
  } finally {
    process.exit(0);
  }
})();
