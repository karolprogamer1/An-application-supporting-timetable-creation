const { canPlace } = require('./common/scheduler');

const days = ['Poniedzialek'];
const slots = [480,495,510,525,540,555,570,585,600,615,630,645,660];
const preferences = { preferredLecturerDays: [], windowPreference: 50, latePreference: 50, spreadPreference: 50 };
const roomIds = [101];
const roomNamesMap = { 101: 'Sala' };

function buildAssignment(item, day, start) {
  return {
    courseId: item.id,
    sourceId: item.id,
    subjectId: item.subjectId,
    name: item.name,
    lecturer: item.lecturer,
    lecturerId: item.lecturerId,
    duration: item.duration,
    type: item.type,
    semestr: item.semestr,
    tryb: item.tryb,
    specjalnosc: item.specjalnosc,
    preferredStart: item.preferredStart,
    day,
    start,
    roomId: roomIds[0],
    room: roomNamesMap[101],
    group: item.group,
    students: item.students,
    data_rozpoczecia: item.data_rozpoczecia,
    data_zakonczenia: item.data_zakonczenia,
  };
}

function search(items, availability) {
  const sorted = [...items].sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));
  const results = [];
  function backtrack(index, plan) {
    if (index === sorted.length) {
      results.push(plan);
      return;
    }

    const item = sorted[index];
    for (const start of slots) {
      const assignment = buildAssignment(item, 'Poniedzialek', start);
      const safe = plan.every((placed) => canPlace(assignment, [placed], availability));
      if (!safe) continue;
      backtrack(index + 1, [...plan, assignment]);
      if (results.length > 0) return;
    }
  }
  backtrack(0, []);
  return results[0] || null;
}

function solveGreedy(items, availability) {
  const plan = [];
  const unscheduled = [];
  const ordered = [...items].sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));
  ordered.forEach((item) => {
    let placed = false;
    for (const start of slots) {
      const assignment = buildAssignment(item, 'Poniedzialek', start);
      if (canPlace(assignment, plan, availability)) {
        plan.push(assignment);
        placed = true;
        break;
      }
    }
    if (!placed) unscheduled.push(item);
  });
  return { plan, unscheduled };
}

const durations = [45, 60, 90];
const lecturerCount = 4;

for (let len = 3; len <= 5; len += 1) {
  const items = Array.from({ length: len }, (_, i) => ({
    id: i + 1,
    subjectId: i + 1,
    name: `A${i}`,
    lecturerId: i + 1,
    lecturer: `L${i}`,
    duration: durations[i % durations.length],
    type: 'Wykład',
    group: `${i}`,
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  }));
  const availability = Object.fromEntries(items.map((item) => [item.lecturerId, { explicit: true, slots: Object.fromEntries(slots.map((slot) => [`Poniedzialek|${slot}`, true])) }]));
  const greedy = solveGreedy(items, availability);
  if (greedy.unscheduled.length > 0) {
    const bt = search(items, availability);
    if (bt) {
      console.log(JSON.stringify({ len, items, greedy, bt }, null, 2));
      break;
    }
  }
}
