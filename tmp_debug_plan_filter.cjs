const pool = require('./backend/db.js');

const toSafeInteger = (value) => {
  if (value == null) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const getPlanEntryZajeciaId = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const parseCandidate = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') return toSafeInteger(value);
    if (typeof value === 'string') {
      const direct = toSafeInteger(value);
      if (direct != null) return direct;
      const firstPart = value.split('-')[0];
      return toSafeInteger(firstPart);
    }
    return null;
  };
  const candidates = [entry.courseId, entry.sourceId, entry.id, entry.zajecia_id, entry.idzajecia];
  for (const candidate of candidates) {
    const safeValue = parseCandidate(candidate);
    if (safeValue != null) return safeValue;
  }
  return null;
};

(async () => {
  try {
    const studentId = 414;
    const groupsRes = await pool.query('SELECT zajecia_id FROM grupa WHERE student_id = $1', [studentId]);
    console.log('student groups', groupsRes.rows);
    const studentIds = new Set(groupsRes.rows.map(r => r.zajecia_id));
    const reportRes = await pool.query('SELECT r.zawartosc FROM raport r JOIN plan p ON r.plan_id_fk = p.id_plan ORDER BY p.data_utworzenia DESC LIMIT 1');
    const raw = reportRes.rows[0].zawartosc;
    const data = typeof raw === 'object' ? raw : JSON.parse(raw);
    const planData = Object.values(data.results || {})[0];
    console.log('planData has plan?', Array.isArray(planData.plan));
    const entries = planData.plan;
    console.log('entries count', entries.length);
    entries.forEach((entry, idx) => {
      const entryId = getPlanEntryZajeciaId(entry);
      const match = studentIds.has(entryId);
      console.log(idx, entry.courseId, entryId, match, entry.name);
    });
    const studentPlan = entries.filter((entry) => studentIds.has(getPlanEntryZajeciaId(entry)));
    console.log('studentPlan count', studentPlan.length);
    console.log(studentPlan.map(e => ({courseId:e.courseId, id:getPlanEntryZajeciaId(e), name:e.name})));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();