const { solveSchedule } = require('./common/scheduler');

const items3 = [
  { id: 3001, subjectId: 220, name: 'Zajęcia D', lecturerId: 4, lecturer: 'Dr D', duration: 45, type: 'Wykład', group: 'D', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 3002, subjectId: 221, name: 'Zajęcia E', lecturerId: 5, lecturer: 'Dr E', duration: 45, type: 'Wykład', group: 'E', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
  { id: 3003, subjectId: 222, name: 'Zajęcia F', lecturerId: 6, lecturer: 'Dr F', duration: 45, type: 'Wykład', group: 'F', data_rozpoczecia: '2026-02-01', data_zakonczenia: '2026-06-30' },
];

const availability3 = {
  4: { explicit: true, slots: {
      'Poniedzialek|480': true,
      'Poniedzialek|495': true,
      'Poniedzialek|510': true,
      'Poniedzialek|525': true,
      'Poniedzialek|540': true,
      'Poniedzialek|555': true,
      'Poniedzialek|570': true,
      'Poniedzialek|585': true,
      'Poniedzialek|600': true,
      'Poniedzialek|615': true,
    },
  },
  5: { explicit: true, slots: {
      'Poniedzialek|480': true,
      'Poniedzialek|495': true,
      'Poniedzialek|510': true,
      'Poniedzialek|525': true,
      'Poniedzialek|540': true,
      'Poniedzialek|555': true,
      'Poniedzialek|570': true,
      'Poniedzialek|585': true,
      'Poniedzialek|600': true,
      'Poniedzialek|615': true,
    },
  },
  6: { explicit: true, slots: {
      'Poniedzialek|480': true,
      'Poniedzialek|495': true,
      'Poniedzialek|510': true,
      'Poniedzialek|525': true,
      'Poniedzialek|540': true,
      'Poniedzialek|555': true,
      'Poniedzialek|570': true,
      'Poniedzialek|585': true,
      'Poniedzialek|600': true,
      'Poniedzialek|615': true,
    },
  },
};

const allowedDays = ['Poniedzialek'];
const allowedSlotsByDay = { Poniedzialek: [480, 495, 510, 525, 540, 555, 570, 585, 600, 615] };
const preferences = { preferredLecturerDays: [], windowPreference: 50, latePreference: 50, spreadPreference: 50 };
const allowedRoomIds = [101];
const roomNamesMap = { 101: 'Sala test' };

const result = solveSchedule(items3, allowedDays, allowedSlotsByDay, preferences, availability3, allowedRoomIds, roomNamesMap, 24 * 60);
console.log(JSON.stringify(result, null, 2));
