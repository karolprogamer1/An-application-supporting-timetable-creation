const pool = require('./db');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const migrationsDir = path.join(__dirname, 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Znaleziono ${files.length} migracji`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`Wykonywanie: ${file}...`);
      await pool.query(sql);
      console.log(`✓ ${file} ukończona`);
    }

    console.log('\n✓ Wszystkie migracje ukończone!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Błąd podczas migracji:', err.message);
    process.exit(1);
  }
})();
