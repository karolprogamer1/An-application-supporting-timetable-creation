const pool = require('./backend/db.js');

(async () => {
  try {
    const planRes = await pool.query('SELECT id_plan FROM plan ORDER BY data_utworzenia DESC LIMIT 1');
    if (!planRes.rows.length) {
      console.log('No plan found');
      process.exit(0);
    }
    const planId = planRes.rows[0].id_plan;
    console.log('last plan id', planId);

    const rep = await pool.query('SELECT zawartosc FROM raport WHERE plan_id_fk = $1 LIMIT 1', [planId]);
    if (!rep.rows.length) {
      console.log('No raport found for plan', planId);
      process.exit(0);
    }

    const raw = rep.rows[0].zawartosc;
    const data = typeof raw === 'object' ? raw : JSON.parse(raw);
    const keys = Object.keys(data.results || {});
    console.log('results keys count', keys.length, 'sample keys', keys.slice(0,20));
    if (keys.length === 0) {
      process.exit(0);
    }

    const key = keys[0];
    console.log('first result key', key);
    const planData = data.results[key];
    console.log('planData type', typeof planData, 'keys:', planData ? Object.keys(planData).slice(0,50) : null);
    const plan = Array.isArray(planData?.plan) ? planData.plan : null;
    console.log('plan length', plan?.length);
    if (plan?.length > 0) {
      const entry = plan[0];
      console.log('entry keys', Object.keys(entry).slice(0,40));
      console.log('entry sample', {
        courseId: entry.courseId,
        sourceId: entry.sourceId,
        id: entry.id,
        zajecia_id: entry.zajecia_id,
        idzajecia: entry.idzajecia,
        originalId: entry.originalId,
        name: entry.name,
        group: entry.group,
        day: entry.day,
      });
    }
  } catch (err) {
    console.error('Error inspecting plan report:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
