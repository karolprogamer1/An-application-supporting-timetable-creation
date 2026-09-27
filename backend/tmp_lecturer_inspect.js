const pool = require('./db');
(async () => {
  try {
    const lecturerId = 131;
    const lecturer = await pool.query('SELECT idwykladowca, uzytkownicy_id, imie, nazwisko, tytul_naukowy FROM wykladowca WHERE idwykladowca = $1', [lecturerId]);
    console.log('lecturer', lecturer.rows);
    const byZajecia = await pool.query(
      `SELECT z.idzajecia, z.wykladowca_id, z.przedmiot_id, pr.wykladowca_id AS przedmiot_wykladowca_id, pr.nazwa, z.grupa
       FROM zajecia z
       LEFT JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
       WHERE z.wykladowca_id = $1 OR pr.wykladowca_id = $1
       ORDER BY z.idzajecia LIMIT 20`,
      [lecturerId]
    );
    console.log('zajecia count', byZajecia.rows.length);
    console.log(byZajecia.rows.slice(0, 20));
    const planZajec = await pool.query(
      `SELECT pz.id_plan_zajec, pz.plan_id, pz.zajecia_id, pz.day_of_week, pz.start_time, pz.end_time,
              z.wykladowca_id, pr.wykladowca_id AS przedmiot_wykladowca_id, z.grupa
       FROM plan_zajec pz
       JOIN zajecia z ON pz.zajecia_id = z.idzajecia
       LEFT JOIN przedmiot pr ON z.przedmiot_id = pr.idprzedmiotu
       WHERE z.wykladowca_id = $1 OR pr.wykladowca_id = $1
       ORDER BY pz.plan_id, pz.day_of_week, pz.start_time
       LIMIT 50`,
      [lecturerId]
    );
    console.log('plan_zajec count', planZajec.rows.length);
    console.log(planZajec.rows.slice(0, 20));
    const report = await pool.query('SELECT zawartosc FROM raport WHERE plan_id_fk = (SELECT id_plan FROM plan ORDER BY data_utworzenia DESC LIMIT 1)');
    if (report.rows.length) {
      const content = report.rows[0].zawartosc;
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      const lecturers = new Set();
      Object.values(parsed.results).forEach(group => {
        const entries = Array.isArray(group) ? group : Array.isArray(group.plan) ? group.plan : [];
        entries.forEach(e => {
          if (e && e.lecturer) lecturers.add(e.lecturer);
        });
      });
      console.log('report lecturers', Array.from(lecturers).slice(0, 30));
      const matches = [];
      Object.entries(parsed.results).forEach(([key, group]) => {
        const entries = Array.isArray(group) ? group : Array.isArray(group.plan) ? group.plan : [];
        entries.forEach(e => {
          if (e && e.lecturer && (e.lecturer === 'Paweł Kowalski' || e.lecturer === 'Łukasz Żołędziewski')) {
            matches.push({ key, entry: e });
          }
        });
      });
      console.log('sample matches count', matches.length);
      if (matches.length) console.log('sample match', matches.slice(0, 10));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
