const pool = require('./db');
(async () => {
  const res = await pool.query("SELECT z.idzajecia, z.przedmiot_id, p.semestr, p.tryb, p.specjalnosc, z.typ, z.czas, z.wykladowca_id FROM zajecia z JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu ORDER BY z.idzajecia LIMIT 40");
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
