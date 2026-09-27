const assert = require('assert');
const { solveSchedule } = require('../common/scheduler');

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
  {
    id: 1003,
    subjectId: 202,
    name: 'Zajęcia C',
    lecturerId: 1,
    lecturer: 'Dr Test',
    duration: 60,
    type: 'Wykład',
    group: 'C',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const allowedDays = ['Poniedzialek'];
const allowedSlotsByDay = { Poniedzialek: [480, 540, 600] };

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

assert.equal(plan.length, 3, 'Powinno rozmieścić trzy zajęcia');
assert.equal(unscheduled.length, 0, 'Nie powinno być zajęć nieskoordynowanych');

plan.sort((a, b) => a.start - b.start);
assert.equal(plan[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');
assert.equal(plan[2].start, 600, 'Trzecie zajęcie powinno zaczynać się o 600');
assert.equal(plan[1].start - (plan[0].start + plan[0].duration), 0, 'Drugie zajęcie powinno być dokładnie obok pierwszego');
assert.equal(plan[2].start - (plan[1].start + plan[1].duration), 0, 'Trzecie zajęcie powinno być dokładnie obok drugiego');

const items2 = [
  {
    id: 2001,
    subjectId: 210,
    name: 'Zajęcia A',
    lecturerId: 1,
    lecturer: 'Dr A',
    duration: 60,
    type: 'Wykład',
    group: 'A',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 2002,
    subjectId: 211,
    name: 'Zajęcia B',
    lecturerId: 2,
    lecturer: 'Dr B',
    duration: 60,
    type: 'Wykład',
    group: 'B',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 2003,
    subjectId: 212,
    name: 'Zajęcia C',
    lecturerId: 3,
    lecturer: 'Dr C',
    duration: 60,
    type: 'Wykład',
    group: 'C',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const { plan: plan2, unscheduled: unscheduled2 } = solveSchedule(items2, allowedDays, allowedSlotsByDay, preferences, availability, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan2.length, 3, 'Powinno rozmieścić trzy zajęcia różnych wykładowców');
assert.equal(unscheduled2.length, 0, 'Nie powinno być zajęć nieskoordynowanych dla zajęć różnych wykładowców');
plan2.sort((a, b) => a.start - b.start);
assert.equal(plan2[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan2[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');
assert.equal(plan2[2].start, 600, 'Trzecie zajęcie powinno zaczynać się o 600');
assert.equal(plan2[1].start - (plan2[0].start + plan2[0].duration), 0, 'Drugie zajęcie powinno być dokładnie obok pierwszego');
assert.equal(plan2[2].start - (plan2[1].start + plan2[1].duration), 0, 'Trzecie zajęcie powinno być dokładnie obok drugiego');

const items3 = [
  {
    id: 3001,
    subjectId: 220,
    name: 'Zajęcia D',
    lecturerId: 4,
    lecturer: 'Dr D',
    duration: 45,
    type: 'Wykład',
    group: 'D',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 3002,
    subjectId: 221,
    name: 'Zajęcia E',
    lecturerId: 5,
    lecturer: 'Dr E',
    duration: 45,
    type: 'Laboratorium',
    group: 'E',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 3003,
    subjectId: 222,
    name: 'Zajęcia F',
    lecturerId: 6,
    lecturer: 'Dr F',
    duration: 45,
    type: 'Wykład/Laboratorium',
    group: 'F',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability3 = {
  4: {
    explicit: true,
    slots: {
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
  5: {
    explicit: true,
    slots: {
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
  6: {
    explicit: true,
    slots: {
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

const { plan: plan3, unscheduled: unscheduled3 } = solveSchedule(items3, allowedDays, allowedSlotsByDay, preferences, availability3, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan3.length, 3, 'Powinno rozmieścić trzy zajęcia różnych wykładowców z 15-minutowymi przerwami');
assert.equal(unscheduled3.length, 0, 'Nie powinno być zajęć nieskoordynowanych dla trzech wykładowców z tą samą dostępnością');
plan3.sort((a, b) => a.start - b.start);
assert.equal(plan3[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan3[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');
assert.equal(plan3[2].start, 600, 'Trzecie zajęcie powinno zaczynać się o 600');
assert.equal(plan3[1].start - (plan3[0].start + plan3[0].duration), 15, 'Drugie zajęcie powinno mieć krótką przerwę 15 minut po pierwszym');
assert.equal(plan3[2].start - (plan3[1].start + plan3[1].duration), 15, 'Trzecie zajęcie powinno mieć krótką przerwę 15 minut po drugim');

const allowedSlotsByDay15 = { Poniedzialek: [480, 495, 510, 525, 540, 555, 570, 585, 600, 615] };
const { plan: plan3b, unscheduled: unscheduled3b } = solveSchedule(items3, allowedDays, allowedSlotsByDay15, preferences, availability3, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan3b.length, 3, 'Przy siatce co 15 minut powinno rozmieścić trzy zajęcia');
assert.equal(unscheduled3b.length, 0, 'Nie powinno być brakujących zajęć przy co-15-minutowej siatce');
plan3b.sort((a, b) => a.start - b.start);
assert.equal(plan3b[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan3b[1].start, 525, 'Drugie zajęcie powinno zaczynać się bezpośrednio po pierwszym');
assert.equal(plan3b[2].start, 570, 'Trzecie zajęcie powinno zaczynać się bezpośrednio po drugim');
assert.equal(plan3b[1].start - (plan3b[0].start + plan3b[0].duration), 0, 'Drugie zajęcie powinno być dokładnie obok pierwszego');
assert.equal(plan3b[2].start - (plan3b[1].start + plan3b[1].duration), 0, 'Trzecie zajęcie powinno być dokładnie obok drugiego');

const itemsPeriodBreak = [
  {
    id: 3101,
    subjectId: 230,
    name: 'Okres A',
    lecturerId: 31,
    lecturer: 'Dr Period',
    duration: 60,
    type: 'Wykład',
    group: 'P1',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 3102,
    subjectId: 231,
    name: 'Okres B',
    lecturerId: 31,
    lecturer: 'Dr Period',
    duration: 60,
    type: 'Wykład',
    group: 'P2',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availabilityPeriodBreak = {
  31: {
    '3|STAC|': {
      explicit: true,
      slots: {
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
      segmentRanges: { Poniedzialek: [{ start: 480, end: 630 }] },
    },
  },
};

const { plan: planPeriodBreak, unscheduled: unscheduledPeriodBreak } = solveSchedule(
  itemsPeriodBreak,
  allowedDays,
  { Poniedzialek: [480, 540, 555, 570] },
  preferences,
  availabilityPeriodBreak,
  allowedRoomIds,
  roomNamesMap,
  24 * 60
);

assert.equal(planPeriodBreak.length, 2, 'Dwa zajęcia w tym samym okresie powinny zostać zaplanowane');
assert.equal(unscheduledPeriodBreak.length, 0, 'Nie powinno być nieplanowanych zajęć w tym scenariuszu');
planPeriodBreak.sort((a, b) => a.start - b.start);
assert.equal(planPeriodBreak[0].start, 480, 'Pierwsze zajęcie powinno zacząć się na pierwszym dopuszczalnym slotcie');
assert.equal(planPeriodBreak[1].start, 555, 'Drugie zajęcie powinno zostać przesunięte o 15 minut, aby zachować przerwę');
assert.equal(planPeriodBreak[1].start - (planPeriodBreak[0].start + planPeriodBreak[0].duration), 15, 'Dla zajęć z tym samym okresem musi być 15-minutowa przerwa');

const itemsPeriodBreakNstac = [
  {
    id: 3201,
    subjectId: 240,
    name: 'NSTAC A',
    lecturerId: 32,
    lecturer: 'Dr Nstac',
    duration: 60,
    type: 'Wykład',
    group: 'N1',
    semestr: '3',
    tryb: 'NSTAC',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 3202,
    subjectId: 241,
    name: 'NSTAC B',
    lecturerId: 32,
    lecturer: 'Dr Nstac',
    duration: 60,
    type: 'Wykład',
    group: 'N2',
    semestr: '3',
    tryb: 'NSTAC',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const nstacPreferences = {
  ...preferences,
  studyMode: 'NSTAC',
};

const { plan: planPeriodBreakNstac, unscheduled: unscheduledPeriodBreakNstac } = solveSchedule(
  itemsPeriodBreakNstac,
  allowedDays,
  { Poniedzialek: [480, 540, 555, 570] },
  nstacPreferences,
  availabilityPeriodBreak,
  allowedRoomIds,
  roomNamesMap,
  24 * 60
);

assert.equal(planPeriodBreakNstac.length, 2, 'W trybie NSTAC dwa zajęcia z tym samym okresem powinny zostać zaplanowane');
assert.equal(unscheduledPeriodBreakNstac.length, 0, 'W trybie NSTAC nie powinno być niescheduled');
planPeriodBreakNstac.sort((a, b) => a.start - b.start);
assert.equal(planPeriodBreakNstac[1].start - (planPeriodBreakNstac[0].start + planPeriodBreakNstac[0].duration), 0, 'W trybie NSTAC zajęcia z tym samym okresem powinny stać obok siebie');

const itemsPeriodGroup = [
  {
    id: 3301,
    subjectId: 250,
    name: 'Okres 1',
    lecturerId: 33,
    lecturer: 'Dr Group',
    duration: 60,
    type: 'Wykład',
    group: 'G1',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-03-15',
  },
  {
    id: 3302,
    subjectId: 251,
    name: 'Okres 2',
    lecturerId: 33,
    lecturer: 'Dr Group',
    duration: 60,
    type: 'Wykład',
    group: 'G2',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-03-16',
    data_zakonczenia: '2026-06-30',
  },
];

const availabilityPeriodGroup = {
  33: {
    '3|STAC|': {
      explicit: true,
      slots: {
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
      segmentRanges: { Poniedzialek: [{ start: 480, end: 630 }] },
    },
  },
};

const { plan: planPeriodGroup, unscheduled: unscheduledPeriodGroup } = solveSchedule(
  itemsPeriodGroup,
  allowedDays,
  { Poniedzialek: [480, 540, 555, 570] },
  preferences,
  availabilityPeriodGroup,
  allowedRoomIds,
  roomNamesMap,
  24 * 60
);

assert.equal(planPeriodGroup.length, 2, 'Zajęcia z różnymi okresami tego samego wykładowcy powinny zostać zaplanowane');
assert.equal(unscheduledPeriodGroup.length, 0, 'Nie powinno być nieplanowanych zajęć w tym scenariuszu');
planPeriodGroup.sort((a, b) => a.start - b.start);
assert.equal(planPeriodGroup[1].start - (planPeriodGroup[0].start + planPeriodGroup[0].duration), 0, 'Z zajęć z różnymi okresami tego samego wykładowcy powinny stać obok siebie');

const itemsPeriodContinuation = [
  {
    id: 3401,
    subjectId: 260,
    name: 'Kontynuacja 1',
    lecturerId: 34,
    lecturer: 'Dr Continuation',
    duration: 60,
    type: 'Wykład',
    group: 'C1',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-03-15',
  },
  {
    id: 3402,
    subjectId: 261,
    name: 'Kontynuacja 2',
    lecturerId: 34,
    lecturer: 'Dr Continuation',
    duration: 60,
    type: 'Wykład',
    group: 'C2',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-03-16',
    data_zakonczenia: '2026-06-30',
  },
];

const { plan: planPeriodContinuation, unscheduled: unscheduledPeriodContinuation } = solveSchedule(
  itemsPeriodContinuation,
  allowedDays,
  { Poniedzialek: [480, 540, 555, 570] },
  preferences,
  availabilityPeriodGroup,
  allowedRoomIds,
  roomNamesMap,
  24 * 60
);

assert.equal(planPeriodContinuation.length, 2, 'Dwa zajęcia z kolejnymi okresami tego samego wykładowcy powinny zostać zaplanowane');
assert.equal(unscheduledPeriodContinuation.length, 0, 'Nie powinno być nieplanowanych zajęć dla kolejnych okresów');
planPeriodContinuation.sort((a, b) => a.start - b.start);
assert.equal(planPeriodContinuation[1].start - (planPeriodContinuation[0].start + planPeriodContinuation[0].duration), 0, 'Zajęcia z kolejnymi okresami tego samego wykładowcy powinny stać obok siebie');

const itemsSameHoursDifferentLecturers = [
  {
    id: 3411,
    subjectId: 270,
    name: 'Ta sama godzina A',
    lecturerId: 35,
    lecturer: 'Dr SameHours A',
    duration: 60,
    type: 'Wykład',
    group: 'H1',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-03-15',
  },
  {
    id: 3412,
    subjectId: 271,
    name: 'Ta sama godzina B',
    lecturerId: 36,
    lecturer: 'Dr SameHours B',
    duration: 60,
    type: 'Wykład',
    group: 'H2',
    semestr: '3',
    tryb: 'STAC',
    data_rozpoczecia: '2026-03-16',
    data_zakonczenia: '2026-06-30',
  },
];

const availabilitySameHoursDifferentLecturers = {
  35: {
    '3|STAC|': {
      explicit: true,
      slots: {
        'Poniedzialek|480': true,
        'Poniedzialek|495': true,
        'Poniedzialek|510': true,
        'Poniedzialek|525': true,
        'Poniedzialek|540': true,
        'Poniedzialek|555': true,
        'Poniedzialek|570': true,
      },
      segmentRanges: { Poniedzialek: [{ start: 480, end: 600 }] },
    },
  },
  36: {
    '3|STAC|': {
      explicit: true,
      slots: {
        'Poniedzialek|480': true,
        'Poniedzialek|495': true,
        'Poniedzialek|510': true,
        'Poniedzialek|525': true,
        'Poniedzialek|540': true,
        'Poniedzialek|555': true,
        'Poniedzialek|570': true,
      },
      segmentRanges: { Poniedzialek: [{ start: 480, end: 600 }] },
    },
  },
};

const { plan: planSameHoursDifferentLecturers, unscheduled: unscheduledSameHoursDifferentLecturers } = solveSchedule(
  itemsSameHoursDifferentLecturers,
  allowedDays,
  { Poniedzialek: [480, 540, 555, 570] },
  preferences,
  availabilitySameHoursDifferentLecturers,
  allowedRoomIds,
  roomNamesMap,
  24 * 60
);

assert.equal(planSameHoursDifferentLecturers.length, 2, 'Dwa zajęcia w tych samych godzinach od różnych wykładowców powinny zostać zaplanowane');
assert.equal(unscheduledSameHoursDifferentLecturers.length, 0, 'Nie powinno być nieplanowanych zajęć');
planSameHoursDifferentLecturers.sort((a, b) => a.start - b.start);
assert.equal(planSameHoursDifferentLecturers[1].start - (planSameHoursDifferentLecturers[0].start + planSameHoursDifferentLecturers[0].duration), 0, 'Zajęcia z różnymi okresami w tych samych godzinach od różnych wykładowców powinny stać obok siebie');

const items9 = [
  {
    id: 9001,
    subjectId: 280,
    name: 'Zajęcia 1',
    lecturerId: 19,
    lecturer: 'Dr T',
    duration: 45,
    type: 'Wykład',
    group: 'T',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 9002,
    subjectId: 281,
    name: 'Zajęcia 2',
    lecturerId: 20,
    lecturer: 'Dr U',
    duration: 60,
    type: 'Wykład',
    group: 'U',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 9003,
    subjectId: 282,
    name: 'Zajęcia 3',
    lecturerId: 21,
    lecturer: 'Dr V',
    duration: 90,
    type: 'Wykład',
    group: 'V',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 9004,
    subjectId: 283,
    name: 'Zajęcia 4',
    lecturerId: 22,
    lecturer: 'Dr W',
    duration: 45,
    type: 'Wykład',
    group: 'W',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability9 = {
  19: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true, 'Poniedzialek|600': true, 'Poniedzialek|615': true, 'Poniedzialek|630': true, 'Poniedzialek|645': true, 'Poniedzialek|660': true } },
  20: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true, 'Poniedzialek|600': true, 'Poniedzialek|615': true, 'Poniedzialek|630': true, 'Poniedzialek|645': true, 'Poniedzialek|660': true } },
  21: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true, 'Poniedzialek|600': true, 'Poniedzialek|615': true, 'Poniedzialek|630': true, 'Poniedzialek|645': true, 'Poniedzialek|660': true } },
  22: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|495': true, 'Poniedzialek|510': true, 'Poniedzialek|525': true, 'Poniedzialek|540': true, 'Poniedzialek|555': true, 'Poniedzialek|570': true, 'Poniedzialek|585': true, 'Poniedzialek|600': true, 'Poniedzialek|615': true, 'Poniedzialek|630': true, 'Poniedzialek|645': true, 'Poniedzialek|660': true } },
};

const { plan: plan9, unscheduled: unscheduled9 } = solveSchedule(items9, allowedDays, allowedSlotsByDay15, preferences, availability9, allowedRoomIds, roomNamesMap, 24 * 60);
assert.equal(plan9.length, 4, 'Powinno rozmieścić cztery zajęcia, gdy istnieje miejsce na siatce 15-minutowej');
assert.equal(unscheduled9.length, 0, 'Nie powinno odrzucać zajęć, gdy istnieje możliwe rozmieszczenie');

const items4 = [
  {
    id: 4001,
    subjectId: 230,
    name: 'Zajęcia G',
    lecturerId: 7,
    lecturer: 'Dr G',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'G',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 4002,
    subjectId: 231,
    name: 'Zajęcia H',
    lecturerId: 8,
    lecturer: 'Dr H',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'H',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 4003,
    subjectId: 232,
    name: 'Zajęcia I',
    lecturerId: 9,
    lecturer: 'Dr I',
    duration: 60,
    type: 'Wykład',
    group: 'I',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability4 = {
  7: {
    explicit: true,
    slots: {
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
  8: {
    explicit: true,
    slots: {
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
  9: {
    explicit: true,
    slots: {
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

const { plan: plan4, unscheduled: unscheduled4 } = solveSchedule(items4, allowedDays, allowedSlotsByDay, preferences, availability4, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan4.length, 3, 'Powinno rozmieścić trzy zajęcia, w tym dwa typu wykład/laboratorium z innymi wykładowcami');
assert.equal(unscheduled4.length, 0, 'Nie powinno być zajęć nieskoordynowanych dla tego scenariusza');
plan4.sort((a, b) => a.start - b.start);
assert.equal(plan4[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan4[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');
assert.equal(plan4[2].start, 600, 'Trzecie zajęcie powinno zaczynać się o 600');
assert.equal(plan4[1].start - (plan4[0].start + plan4[0].duration), 0, 'Drugie zajęcie powinno być dokładnie obok pierwszego');
assert.equal(plan4[2].start - (plan4[1].start + plan4[1].duration), 0, 'Trzecie zajęcie powinno być dokładnie obok drugiego');

const items5 = [
  {
    id: 5001,
    subjectId: 240,
    name: 'Zajęcia J',
    lecturerId: 10,
    lecturer: 'Dr J',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'J',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 5002,
    subjectId: 241,
    name: 'Zajęcia K',
    lecturerId: 11,
    lecturer: 'Dr K',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'K',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 5003,
    subjectId: 242,
    name: 'Zajęcia L',
    lecturerId: 12,
    lecturer: 'Dr L',
    duration: 60,
    type: 'Wykład',
    group: 'L',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 5004,
    subjectId: 243,
    name: 'Zajęcia M',
    lecturerId: 13,
    lecturer: 'Dr M',
    duration: 60,
    type: 'Wykład',
    group: 'M',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability5 = {
  10: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true } },
  11: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true } },
  12: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true } },
  13: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true, 'Poniedzialek|660': true } },
};
const allowedSlotsByDay5 = { Poniedzialek: [480, 540, 600, 660] };

const { plan: plan5, unscheduled: unscheduled5 } = solveSchedule(items5, allowedDays, allowedSlotsByDay5, preferences, availability5, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan5.length, 4, 'Powinno rozmieścić wszystkie cztery zajęcia, także przy parze wykład/laboratorium');
assert.equal(unscheduled5.length, 0, 'Nie powinno być brakujących zajęć w tym scenariuszu');
plan5.sort((a, b) => a.start - b.start);
assert.equal(plan5[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(plan5[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');
assert.equal(plan5[2].start, 600, 'Trzecie zajęcie powinno zaczynać się o 600');
assert.equal(plan5[3].start, 660, 'Czwarte zajęcie powinno zaczynać się o 660');

const items6 = [
  {
    id: 6001,
    subjectId: 250,
    name: 'Zajęcia N',
    lecturerId: 14,
    lecturer: 'Dr N',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'N',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 6002,
    subjectId: 250,
    name: 'Zajęcia O',
    lecturerId: 14,
    lecturer: 'Dr N',
    duration: 60,
    type: 'Wykład/Laboratorium',
    group: 'O',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability6 = {
  14: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true } },
};

const { plan: plan6, unscheduled: unscheduled6 } = solveSchedule(items6, ['Poniedzialek'], { Poniedzialek: [480, 540, 600] }, preferences, availability6, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan6.length, 2, 'Powinno rozmieścić obie części zajęć typu wykład/laboratorium');
assert.equal(unscheduled6.length, 0, 'Nie powinno być brakujących zajęć w tym scenariuszu');
plan6.sort((a, b) => a.start - b.start);
assert.equal(plan6[0].start, 480, 'Pierwsze zajęcie powinno startować o 480');
assert.equal(plan6[1].start, 540, 'Drugie zajęcie powinno być ustawione bezpośrednio po pierwszym');
assert.equal(plan6[1].start - (plan6[0].start + plan6[0].duration), 0, 'Drugie zajęcie powinno stać obok pierwszego');

const items7 = [
  {
    id: 7001,
    subjectId: 260,
    name: 'Wykład 1',
    lecturerId: 15,
    lecturer: 'Dr P',
    duration: 45,
    type: 'Wykład',
    group: 'P',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 7002,
    subjectId: 261,
    name: 'Wykład 2',
    lecturerId: 16,
    lecturer: 'Dr Q',
    duration: 45,
    type: 'Wykład',
    group: 'Q',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability7 = {
  15: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|525': true, 'Poniedzialek|570': true } },
  16: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|525': true, 'Poniedzialek|570': true } },
};

const { plan: plan7, unscheduled: unscheduled7 } = solveSchedule(items7, ['Poniedzialek'], { Poniedzialek: [480, 525, 570] }, preferences, availability7, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan7.length, 2, 'Powinno rozmieścić oba wykłady 45-minutowe');
assert.equal(unscheduled7.length, 0, 'Nie powinno być brakujących zajęć w tym scenariuszu');
plan7.sort((a, b) => a.start - b.start);
assert.equal(plan7[0].start, 480, 'Pierwszy wykład powinien zacząć się o 480');
assert.equal(plan7[1].start, 525, 'Drugi wykład powinien się zacząć bezpośrednio po pierwszym');
assert.equal(plan7[1].start - (plan7[0].start + plan7[0].duration), 0, 'Wykłady powinny stać obok siebie bez przerwy');

const items8 = [
  {
    id: 8001,
    subjectId: 270,
    name: 'Wykład 3',
    lecturerId: 17,
    lecturer: 'Dr R',
    duration: 60,
    type: 'Wykład',
    group: 'R',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
  {
    id: 8002,
    subjectId: 271,
    name: 'Wykład 4',
    lecturerId: 18,
    lecturer: 'Dr S',
    duration: 60,
    type: 'Wykład',
    group: 'S',
    data_rozpoczecia: '2026-02-01',
    data_zakonczenia: '2026-06-30',
  },
];

const availability8 = {
  17: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true } },
  18: { explicit: true, slots: { 'Poniedzialek|480': true, 'Poniedzialek|540': true, 'Poniedzialek|600': true } },
};

const { plan: plan8, unscheduled: unscheduled8 } = solveSchedule(items8, ['Poniedzialek'], { Poniedzialek: [480, 540, 600] }, preferences, availability8, allowedRoomIds, roomNamesMap, 24 * 60);

assert.equal(plan8.length, 2, 'Powinno rozmieścić oba zajęcia 60-minutowe dla różnych wykładowców');
assert.equal(unscheduled8.length, 0, 'Nie powinno być brakujących zajęć w tym scenariuszu');
plan8.sort((a, b) => a.start - b.start);
assert.equal(plan8[0].start, 480, 'Pierwsze zajęcie powinno zacząć się o 480');
assert.equal(plan8[1].start, 540, 'Drugie zajęcie powinno się zacząć bezpośrednio po pierwszym');
assert.equal(plan8[1].start - (plan8[0].start + plan8[0].duration), 0, 'Zajęcia 60-minutowe powinny stać obok siebie bez przerwy');

console.log('adjacency three test passed');
