const pool = require('./db');
(async () => {
  const res = await pool.query("SELECT idprzedmiotu, nazwa, semestr, tryb, specjalnosc FROM przedmiot WHERE semestr IS NOT NULL AND semestr <> '' ORDER BY nazwa LIMIT 20");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
