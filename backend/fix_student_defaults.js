const pool = require('./db');

(async () => {
  try {
    // Spróbuj UPDATE z odpowiednimi wartościami (maks 10 znaków)
    const result = await pool.query(`
      UPDATE student 
      SET rok_semestr = COALESCE(rok_semestr, '2024/1'),
          tryb = COALESCE(tryb, 'Stacj.'),
          specjalnosc = COALESCE(specjalnosc, '')
      WHERE rok_semestr IS NULL OR tryb IS NULL OR specjalnosc IS NULL
    `);
    console.log('✅ Zaktualizowano ' + result.rowCount + ' studentów');
    
    // Sprawdź wynik
    const check = await pool.query('SELECT COUNT(*) FROM student WHERE rok_semestr IS NOT NULL');
    console.log('✅ Studentów z rok_semestr:', check.rows[0].count);
    
    await pool.end();
  } catch (err) {
    console.error('❌ Błąd:', err.message);
    process.exit(1);
  }
})();
