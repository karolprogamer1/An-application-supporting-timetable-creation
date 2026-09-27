const assert = require('assert');
const { solveSchedule } = require('../common/scheduler');

// Test: two classes with the same lecturer and the same active period
// should be placed adjacent (one after another) when possible.

const items = [
  {
    id: 1001,
    subjectId: 200,
    name: 'Zajęcia A',
    lecturerId: 1,
    lecturer: 'Dr Test',
    duration: 60,
    type: 'Wykład',
    group: 'A',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 1002,
    subjectId: 201,
    name: 'Zajęcia B',
    lecturerId: 1,
    lecturer: 'Dr Test',
    duration: 60,
    type: 'Wykład',
    group: 'B',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const allowedDays = ['Poniedzialek'];
const allowedSlotsByDay = { Poniedzialek: [480, 540] }; // 08:00 and 09:00

const preferences = {
  preferredLecturerDays: [],
  windowPreference: 50,
  latePreference: 50,
  spreadPreference: 50,
};

const availability = {};
const allowedRoomIds = [101];
const roomNamesMap = { 101: 'Sala test' };

const { plan, unscheduled } = solveSchedule(items, allowedDays, allowedSlotsByDay, preferences, availability, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan.length, 2, 'Powinno rozmieścić oba zajęcia');
assert.equal(unscheduled.length, 0, 'Nie powinno być zajęć nieskoordynowanych');

// Sort by start time
plan.sort((a, b) => a.start - b.start);
const first = plan[0];
const second = plan[1];

// Ensure the second starts immediately after the first ends (adjacency)
assert.equal(second.start - (first.start + first.duration), 0, 'Zajęcia powinny być ustawione obok siebie bez przerwy');

console.log('adjacency test passed');
