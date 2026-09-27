(async ()=>{
  try {
    const pool = require('./db');
    const res = await pool.query(`SELECT p.idprzedmiotu, p.nazwa, p.semestr, z.idzajecia FROM przedmiot p JOIN zajecia z ON z.przedmiot_id = p.idprzedmiotu ORDER BY p.idprzedmiotu`);
    console.log('rows', res.rows.length);
    const sem4 = res.rows.filter(r => String(r.semestr).includes('4'));
    console.log('sem4 count', sem4.length);
    console.log(sem4.slice(0,40));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
