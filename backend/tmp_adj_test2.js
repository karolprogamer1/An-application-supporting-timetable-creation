const { solveSchedule } = require('./common/scheduler');
const allowedDays = ['Poniedzialek'];
const allowedSlotsByDay = { Poniedzialek: [480, 540, 600, 660, 720] };
const preferences = { preferredLecturerDays: [], windowPreference: 50, latePreference: 50, spreadPreference: 50 };
const roomNamesMap = { 101: 'Sala test' };
const items = [
  { id: 1, subjectId: 10, name: 'A', lecturerId: 1, lecturer: 'Dr A', duration: 60, type: 'Wykład/Laboratorium', group: 'G1', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 2, subjectId: 11, name: 'B', lecturerId: 2, lecturer: 'Dr B', duration: 60, type: 'Wykład/Laboratorium', group: 'G2', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 3, subjectId: 12, name: 'C', lecturerId: 3, lecturer: 'Dr C', duration: 60, type: 'Wykład', group: 'G3', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 4, subjectId: 13, name: 'D', lecturerId: 4, lecturer: 'Dr D', duration: 60, type: 'Wykład', group: 'G4', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
];
const availability = {
  1: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true, 'Poniedzialek|720': true } },
  2: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true, 'Poniedzialek|720': true } },
  3: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true, 'Poniedzialek|720': true } },
  4: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true, 'Poniedzialek|720': true } },
};
const { plan, unscheduled } = solveSchedule(items, allowedDays, allowedSlotsByDay, preferences, { 1: availability[1], 2: availability[2], 3: availability[3], 4: availability[4] }, [101], roomNamesMap, 24 * 60);
console.log('scheduled', plan.length);
console.log('unscheduled', unscheduled.length);
console.log(plan.map((x) => ({ name: x.name, start: x.start, type: x.type, lecturer: x.lecturer })));
