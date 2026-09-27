const pool = require('./db');

(async () => {
  try {
    // Sprawdzenie kolumn w tabeli student
    const cols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'student'
      ORDER BY ordinal_position
    `);
    
    console.log('Kolumny w tabeli student:');
    cols.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Pobranie jednego studenta z danymi
    const students = await pool.query(`
      SELECT s.idstudent, s.nr_albumu, s.rok_semestr, s.tryb, u.login
      FROM student s
      LEFT JOIN uzytkownicy u ON s.uzytkownicy_id = u.id
      LIMIT 1
    `);
    
    console.log('\nPrzykładowy student:');
    console.log(students.rows[0] || 'Brak studentów');

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Błąd:', err.message);
    process.exit(1);
  }
})();
