(async ()=>{
  try{
    const pool = require('./db');
    const classesRes = await pool.query(`SELECT z.idzajecia, z.czas, z.typ AS zajecia_typ, z.sala_id,
            p.idprzedmiotu, p.nazwa, p.typ AS przedmiot_typ, p.semestr, p.ilosc_godz,
            z.grupa,
            COALESCE(z.wykladowca_id, p.wykladowca_id) AS wykladowca_id,
            COALESCE(w.imie || ' ' || w.nazwisko, 'Brak wykładowcy') AS lecturer,
            array_agg(zg.grupa_id) FILTER (WHERE zg.grupa_id IS NOT NULL) as grupy
     FROM zajecia z
     JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
     LEFT JOIN wykladowca w ON COALESCE(z.wykladowca_id, p.wykladowca_id) = w.idwykladowca
     LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
     GROUP BY z.idzajecia, p.idprzedmiotu, w.imie, w.nazwisko
     ORDER BY z.idzajecia`);

    const rows = classesRes.rows;
    console.log('fetched', rows.length, 'rows');
    const semestrValues = ['4'];
    const getSemesterNumber = (s) => {
      if (s == null) return null;
      const str = String(s);
      if (str.includes('/')) {
        const parts = str.split('/').map(p => p.trim()).filter(Boolean);
        return parts.length >= 2 ? parts[1] : parts[0];
      }
      return str;
    };
    const matching = [];
    for (const r of rows) {
      const rowSemNum = getSemesterNumber(r.semestr);
      const semesterMatches = semestrValues.length === 0 || (rowSemNum != null && semestrValues.includes(String(rowSemNum)));
      if (semesterMatches) matching.push({idzajecia:r.idzajecia,semestr:r.semestr,rowSemNum});
    }
    console.log('matching count', matching.length);
    console.log(matching.slice(0,50));
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1);} 
})();
