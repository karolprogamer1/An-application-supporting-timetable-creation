const { solveSchedule } = require('./common/scheduler');
const allowedDays = ['Poniedzialek'];
const allowedSlotsByDay = { Poniedzialek: [480, 540, 600] };
const preferences = { preferredLecturerDays: [], windowPreference: 50, latePreference: 50, spreadPreference: 50 };
const roomNamesMap = { 101: 'Sala test' };
const items = [
  { id: 1, subjectId: 10, name: 'A', lecturerId: 1, lecturer: 'Dr A', duration: 60, type: 'Wykład/Laboratorium', group: 'G1', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 2, subjectId: 11, name: 'B', lecturerId: 2, lecturer: 'Dr B', duration: 60, type: 'Wykład/Laboratorium', group: 'G2', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
];
const availability = {
  1: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true } },
  2: { slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true } },
};
const { plan } = solveSchedule(items, allowedDays, allowedSlotsByDay, preferences, { 1: availability[1], 2: availability[2] }, [101], roomNamesMap, 24 * 60);
console.log(plan.map((x) => ({ name: x.name, start: x.start, type: x.type, lecturer: x.lecturer })));
