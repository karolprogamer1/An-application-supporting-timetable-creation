const pool = require('./db');
(async () => {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LIMIT 50");
    console.log('tables', tables.rows.map(r => r.table_name));
    const raportCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='raport' ORDER BY ordinal_position");
    console.log('raport cols', raportCols.rows);
    const planCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='plan' ORDER BY ordinal_position");
    console.log('plan cols', planCols.rows);
    const planZajecCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='plan_zajec' ORDER BY ordinal_position");
    console.log('plan_zajec cols', planZajecCols.rows);
    const lastPlan = await pool.query('SELECT id_plan FROM plan ORDER BY data_utworzenia DESC LIMIT 1');
    console.log('lastPlan', lastPlan.rows);
    if (lastPlan.rows.length) {
      const planId = lastPlan.rows[0].id_plan;
      const report = await pool.query('SELECT zawartosc FROM raport WHERE plan_id_fk = $1 LIMIT 1', [planId]);
      console.log('report rows', report.rows.length);
      if (report.rows.length) {
        const content = report.rows[0].zawartosc;
        console.log('content type', typeof content);
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        console.log('parsed top keys', Object.keys(parsed).slice(0, 10));
        if (parsed.results) {
          const keys = Object.keys(parsed.results);
          console.log('results keys', keys.slice(0, 5));
          const lecturers = new Set();
          keys.forEach((k) => {
            const group = parsed.results[k];
            const entries = Array.isArray(group) ? group : Array.isArray(group?.plan) ? group.plan : [];
            entries.forEach((entry) => {
              if (entry && entry.lecturer) lecturers.add(entry.lecturer);
            });
          });
          console.log('distinct lecturers', Array.from(lecturers).slice(0, 20));
          if (keys.length) {
            const first = parsed.results[keys[0]];
            console.log('first result type', Array.isArray(first) ? 'array' : typeof first);
            if (Array.isArray(first)) {
              console.log('first result array length', first.length);
              console.log('first entries', JSON.stringify(first.slice(0, 5), null, 2).slice(0, 2000));
            } else if (first && Array.isArray(first.plan)) {
              console.log('first plan length', first.plan.length);
              console.log('first plan sample', JSON.stringify(first.plan.slice(0, 5), null, 2).slice(0, 2000));
            } else if (first && typeof first === 'object') {
              console.log('first object keys', Object.keys(first).slice(0, 20));
              if (first.plan) console.log('first.plan type', Array.isArray(first.plan) ? 'array' : typeof first.plan);
              if (Array.isArray(first.plan)) console.log('first.plan sample', JSON.stringify(first.plan.slice(0, 5), null, 2).slice(0, 2000));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
