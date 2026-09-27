const pool = require('./db');
const scheduler = require('./common/scheduler');
(async () => {
  const payload = {
    selectedDays: ['Poniedzialek','Wtorek','Sroda','Czwartek','Piatek'],
    selectedSemesters: ['5|STAC|'],
    effectiveSelectedSemesters: ['5|STAC|'],
    studyMode: 'STAC',
  };
  try {
    const result = await scheduler.generateAndSavePlan(payload, pool);
    console.log('result keys', Object.keys(result));
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERR', err && err.message);
    console.error(err && err.stack);
  } finally {
    await pool.end();
  }
})();
