const { solveSchedule } = require('./common/scheduler');

const durations = [45,60,75,90];
const slots = [480,495,510,525,540,555,570,585,600,615,630,645,660];
const prefs={preferredLecturerDays:[],windowPreference:50,latePreference:50,spreadPreference:50};

for (let attempt = 0; attempt < 2000; attempt += 1) {
  const items = [];
  const count = 3 + (attempt % 3);
  for (let i = 0; i < count; i += 1) {
    const duration = durations[Math.floor(Math.random() * durations.length)];
    items.push({
      id: i + 1,
      subjectId: i + 1,
      name: `A${i}`,
      lecturerId: i + 1,
      lecturer: `L${i}`,
      duration,
      type: 'Wykład',
      group: `${i}`,
      data_rozpoczecia: '2026-02-01',
      data_zakonczenia: '2026-06-30',
    });
  }
  const availability = Object.fromEntries(items.map((item) => [item.lecturerId, { explicit:true, slots: Object.fromEntries(slots.map((slot) => [`Poniedzialek|${slot}`, true])) }]));
  const res = solveSchedule(items, ['Poniedzialek'], { Poniedzialek: slots }, prefs, availability, [101], { 101: 'Sala' }, 24 * 60);
  const totalDuration = items.reduce((sum, item) => sum + item.duration, 0);
  const hasGap = res.unscheduled.length > 0 && res.plan.length < items.length;
  const canFit = res.plan.length < items.length;
  if (canFit) {
    console.log(JSON.stringify({ attempt, items, res }, null, 2));
    break;
  }
}
