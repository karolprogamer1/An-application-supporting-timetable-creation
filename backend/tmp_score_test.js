const { scorePlacement, solveSchedule } = require('./common/scheduler');
const prefs = {
  preferredLecturerDays: [],
  windowPreference: 50,
  latePreference: 50,
  spreadPreference: 50,
  studyMode: 'STAC',
  selectedSemesters: ['3'],
};
const currentPlan = [
  {
    courseId: 2001,
    subjectId: 210,
    name: 'A',
    lecturer: 'Dr A',
    lecturerId: 1,
    duration: 60,
    type: 'Wykład',
    day: 'Poniedzialek',
    start: 480,
    roomId: 101,
    room: 'Sala test',
    group: 'A',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];
const assignment540 = {
  courseId: 2002,
  subjectId: 211,
  name: 'B',
  lecturer: 'Dr B',
  lecturerId: 2,
  duration: 60,
  type: 'Wykład',
  day: 'Poniedzialek',
  start: 540,
  roomId: 101,
  room: 'Sala test',
  group: 'B',
  data_rozpoczecia: '2026-02-01',
  data_zakonczenia: '2026-06-30',
};
const assignment600 = {
  courseId: 2003,
  subjectId: 212,
  name: 'C',
  lecturer: 'Dr C',
  lecturerId: 3,
  duration: 60,
  type: 'Wykład',
  day: 'Poniedzialek',
  start: 600,
  roomId: 101,
  room: 'Sala test',
  group: 'C',
  data_rozpoczecia: '2026-02-01',
  data_zakonczenia: '2026-06-30',
};
const dayUsage = { Poniedzialek: 1, Wtorek: 0, Sroda: 0, Czwartek: 0, Piatek: 0 };
const morningStartHourUsage = { 8: 1, 9: 0, 10: 0, 11: 0 };
const avail = {
  1: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true } },
  2: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true } },
  3: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true } },
};
console.log('score 540', scorePlacement(assignment540, currentPlan, prefs, dayUsage, morningStartHourUsage, avail));
console.log('score 600', scorePlacement(assignment600, currentPlan, prefs, dayUsage, morningStartHourUsage, avail));
const items = [currentPlan[0], assignment540, assignment600];
const result = solveSchedule(items, ['Poniedzialek'], { Poniedzialek: [480, 540, 600] }, prefs, avail, [101], { 101: 'Sala test' }, 24 * 60);
console.log('solve', result.plan.map(a => ({ id: a.courseId, start: a.start, lecturer: a.lecturer })));
