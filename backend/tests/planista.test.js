const assert = require('assert');
const { solveSchedule, matchesCourseFilter, buildSelectionResults, filterClassesForScheduling } = require('../common/scheduler');
const { getSemesterNumbers, buildItemsFromRows } = require('../common/utils');

assert.equal(
  matchesCourseFilter(
    { semestr: '3', tryb: 'STAC', specjalnosc: null },
    [{ semestrs: ['3'], tryb: 'STAC', specjalnosc: null }]
  ),
  true,
  'Powinno dopasować przedmiot ogólny, gdy specjalizacja jest pusta lub null'
);

assert.deepEqual(
  getSemesterNumbers('3/5'),
  ['5'],
  'Powinno traktować 3/5 jako rok 3, semestr 5 i nie tworzyć duplikatów zajęć'
);

assert.deepEqual(
  getSemesterNumbers('2024/1'),
  ['1'],
  'Powinno traktować 2024/1 jako semestr 1 w formacie rok/semestr'
);

const semesterSplitRows = buildItemsFromRows([
  {
    idzajecia: 777,
    idprzedmiotu: 333,
    nazwa: 'Zajęcia testowe',
    typ: 'Wykład',
    tryb: 'STAC',
    specjalnosc: '',
    czas: null,
    ilosc_godz: 1,
    wykładowca_id: null,
    sala_id: null,
    grupa: 'A',
    semestr: '3/5',
  },
]);

assert.equal(
  semesterSplitRows.length,
  1,
  'Powinno wygenerować tylko jedno zadanie dla zapisu semestrów 3/5 zamiast wielu duplikatów'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '3', tryb: 'STAC', specjalnosc: 'PBDiOU' },
    [{ semestrs: ['3'], tryb: 'STAC', specjalnosc: null }]
  ),
  true,
  'Powinno dopasować przedmiot ze specjalizacją, gdy wybrano ogólny semestr'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '3', tryb: 'STAC', specjalnosc: null },
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: null }]
  ),
  true,
  'Powinno traktować przedmiot z semestru 3 jako pasujący do wyboru semestru 5/6 w planisty'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '5', tryb: 'STAC', specjalnosc: 'PBDiOU' },
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: null }]
  ),
  true,
  'Powinno dopasować przedmiot ze specjalizacją, gdy wybrano ogólny semestr 5/6'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK+M3D' },
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: 'M3D' }]
  ),
  false,
  'Nie powinno dopasować przedmiotu ASiSK+M3D do filtra M3D'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '5', tryb: 'STAC', specjalnosc: 'M3D' }, // Przedmiot tylko dla M3D
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: 'ASiSK+M3D' }] // Filtr dla studenta z ASiSK i M3D
  ),
  true,
  'Powinno dopasować przedmiot M3D do filtra ASiSK+M3D, ponieważ student z obu specjalizacji uczęszcza na zajęcia z każdej z nich'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK+PBDiOU+M3D' },
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: 'ASiSK+M3D' }]
  ),
  false,
  'Nie powinno dopasować przedmiotu ASiSK+PBDiOU+M3D do filtra ASiSK+M3D'
);

assert.equal(
  matchesCourseFilter(
    { semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK+PBDiOU' },
    [{ semestrs: ['5'], tryb: 'STAC', specjalnosc: 'ASiSK+M3D' }]
  ),
  false,
  'Nie powinno dopasować przedmiotu ASiSK+PBDiOU do filtra ASiSK+M3D'
);

const result = solveSchedule(
  [
    {
      id: 1,
      subjectId: 10,
      name: 'Testowe zajęcia',
      lecturerId: 1,
      lecturer: 'Test',
      duration: 45,
      type: 'Wykład',
      group: 'A',
    },
  ],
  ['Poniedzialek'],
  [480],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101],
  { 101: 'Sala test' }
);

assert.ok(result.plan.length > 0, 'Powinno znaleźć miejsce dla zajęcia o długości 45 minut');
assert.equal(result.unscheduled.length, 0, 'Zajęcie nie powinno zostać odrzucone');

const conflictResult = solveSchedule(
  [
    {
      id: 1,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
    },
    {
      id: 2,
      subjectId: 11,
      name: 'Ćwiczenia B',
      lecturerId: 2,
      lecturer: 'Dr B',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'B',
    },
  ],
  ['Poniedzialek'],
  [480, 480],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101],
  { 101: 'Sala test' }
);

assert.equal(conflictResult.plan.length, 1, 'Na tym samym dniu nie można mieć dwóch zajęć o tych samych godzinach');
assert.equal(conflictResult.unscheduled.length, 1, 'Jedno zajęcie powinno zostać odrzucone przy kolizji czasu');

const availabilityStartPreferenceResult = solveSchedule(
  [
    {
      id: 1,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
      semestr: '3',
      tryb: 'STAC',
    },
  ],
  ['Poniedzialek'],
  [480, 525],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
    studyMode: 'STAC',
    selectedSemesters: ['3'],
  },
  {
    1: {
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
      },
      segmentStarts: { Poniedzialek: new Set([480]) },
      segmentRanges: { Poniedzialek: [{ start: 480, end: 585 }] },
    },
  },
  [101],
  { 101: 'Sala test' }
);

assert.equal(availabilityStartPreferenceResult.plan.length, 1, 'Zajęcie powinno zostać zaplanowane');
assert.equal(availabilityStartPreferenceResult.plan[0].start, 480, 'Zajęcia powinny zaczynać się na początku dostępnego segmentu wykładowcy');
assert.notEqual(availabilityStartPreferenceResult.plan[0].start, 525, 'Krótsze zajęcie nie powinno zaczynać się w środku pojedynczego segmentu dostępności');

const emptyAvailabilityResult = solveSchedule(
  [
    {
      id: 3,
      subjectId: 12,
      name: 'Zajęcia bez zgłoszonych godzin',
      lecturerId: 3,
      lecturer: 'Dr C',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'C',
      semestr: '3',
      tryb: 'STAC',
    },
  ],
  ['Poniedzialek'],
  [480, 495, 510],
  { studyMode: 'STAC' },
  { 3: { '3|STAC|': { explicit: true, slots: {}, segmentRanges: {} } } },
  [101],
  { 101: 'Sala test' }
);

assert.equal(emptyAvailabilityResult.plan.length, 1, 'Pusty rekord dostępności nie powinien blokować planowania zajęć');
assert.equal(emptyAvailabilityResult.unscheduled.length, 0, 'Zajęcia bez zgłoszonych godzin powinny otrzymać losowy termin');

const lectureLabConflictResult = solveSchedule(
  [
    {
      id: 1,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
      semestr: '3',
    },
    {
      id: 2,
      subjectId: 11,
      name: 'Laboratorium B',
      lecturerId: 2,
      lecturer: 'Dr B',
      duration: 60,
      type: 'Laboratorium',
      group: 'B',
      semestr: '3',
    },
  ],
  ['Poniedzialek'],
  [480, 480],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101],
  { 101: 'Sala test' }
);

assert.equal(lectureLabConflictResult.plan.length, 1, 'Wykład i laboratorium nie mogą odbywać się w tym samym czasie');
assert.equal(lectureLabConflictResult.unscheduled.length, 1, 'Jedno zajęcie powinno zostać odrzucone, gdy ma miejsce konflikt wykład/laboratorium');

const groupAdjacencyResult = solveSchedule(
  [
    {
      id: 301,
      subjectId: 30,
      name: 'Projekt zespołowy',
      lecturerId: 3,
      lecturer: 'mgr inż. A. Stojek',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'ASiSK + PBDiOU + M3D',
      semestr: '8',
    },
    {
      id: 302,
      subjectId: 31,
      name: 'Troubleshooting',
      lecturerId: 4,
      lecturer: 'mgr inż. A. Górka',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'ASiSK + PBDiOU + M3D',
      semestr: '8',
    },
  ],
  ['Poniedzialek'],
  [480, 540],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101],
  { 101: 'Sala test' },
  24 * 60
);

assert.equal(groupAdjacencyResult.plan.length, 2, 'Zajęcia tej samej grupy powinny zostać zaplanowane');
assert.equal(groupAdjacencyResult.unscheduled.length, 0, 'Zajęcia tej samej grupy nie powinny zostać odrzucone');

const sortedGroupAdjacencyPlan = groupAdjacencyResult.plan.sort((a, b) => a.start - b.start);
assert.equal(sortedGroupAdjacencyPlan[0].start, 480, 'Pierwsze zajęcie powinno zaczynać się o 480');
assert.equal(sortedGroupAdjacencyPlan[1].start, 540, 'Drugie zajęcie powinno zaczynać się o 540');

const studentConflictResult = solveSchedule(
  [
    {
      id: 101,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
      semestr: '3',
      students: new Set([1, 2]),
    },
    {
      id: 102,
      subjectId: 11,
      name: 'Ćwiczenia B',
      lecturerId: 2,
      lecturer: 'Dr B',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'A',
      semestr: '3',
      students: new Set([2, 3]),
    },
  ],
  ['Poniedzialek'],
  [480],
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101, 102],
  { 101: 'Sala 1', 102: 'Sala 2' }
);

assert.equal(studentConflictResult.plan.length, 1, 'Studenci nie mogą mieć dwóch zajęć jednocześnie, nawet w różnych salach');
assert.equal(studentConflictResult.unscheduled.length, 1, 'Drugie zajęcie powinno zostać odrzucone ze względu na konflikt studenta');

const constrainedResult = solveSchedule(
  [
    {
      id: 1,
      subjectId: 10,
      name: 'Zajęcia B',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Ćwiczenia',
      group: 'B',
    },
    {
      id: 2,
      subjectId: 11,
      name: 'Zajęcia A',
      lecturerId: 2,
      lecturer: 'Dr B',
      duration: 60,
      type: 'Wykład',
      group: 'A',
    },
  ],
  ['Poniedzialek', 'Wtorek'],
  {
    Poniedzialek: [480],
    Wtorek: [480],
  },
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {
    1: {
      explicit: true,
      slots: {
        'Poniedzialek|480': true,
        'Poniedzialek|495': true,
        'Poniedzialek|510': true,
        'Poniedzialek|525': true,
        'Wtorek|480': true,
        'Wtorek|495': true,
        'Wtorek|510': true,
        'Wtorek|525': true,
      },
    },
  },
  [101],
  { 101: 'Sala test' },
  24 * 60
);

assert.equal(constrainedResult.plan.length, 2, 'Należy rozmieścić oba zajęcia, gdy jedno z nich ma ograniczoną dostępność');
assert.equal(constrainedResult.unscheduled.length, 0, 'Zajęcia z ograniczoną dostępnością nie powinny być pomijane, jeśli da się je rozmieścić');

const duplicateLogicalItemsResult = solveSchedule(
  [
    {
      id: 101,
      originalId: 1001,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
      semestr: '3',
    },
    {
      id: 102,
      originalId: 1002,
      subjectId: 10,
      name: 'Wykład A',
      lecturerId: 1,
      lecturer: 'Dr A',
      duration: 60,
      type: 'Wykład',
      group: 'A',
      semestr: '3',
    },
  ],
  ['Poniedzialek', 'Wtorek'],
  {
    Poniedzialek: [480],
    Wtorek: [480],
  },
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
  },
  {},
  [101],
  { 101: 'Sala test' }
);

assert.equal(duplicateLogicalItemsResult.plan.length, 1, 'Logiczne duplikaty powinny być zredukowane do jednego miejsca');
assert.equal(duplicateLogicalItemsResult.unscheduled.length, 0, 'Dodatkowy duplikat nie powinien być odrzucony, bo powinien został zredukowany wcześniej');

const performanceStart = Date.now();
const largeBatchItems = Array.from({ length: 60 }, (_, index) => ({
  id: index + 1,
  originalId: index + 1,
  subjectId: index + 1,
  name: `Wielka partia ${index + 1}`,
  lecturerId: (index % 8) + 1,
  lecturer: `Wykładowca ${(index % 8) + 1}`,
  duration: 45,
  type: index % 2 === 0 ? 'Wykład' : 'Laboratorium',
  semestr: '5',
  tryb: 'STAC',
  specjalnosc: '',
  students: new Set([((index * 3) % 24) + 1, ((index * 5) % 24) + 1]),
  group: [`G${(index % 5) + 1}`],
}));
const largeBatchDayNames = ['Poniedzialek', 'Wtorek', 'Sroda', 'Czwartek', 'Piatek'];
const largeBatchSlots = Object.fromEntries(
  largeBatchDayNames.map((day) => [day, Array.from({ length: 50 }, (_, slotIndex) => 8 * 60 + slotIndex * 15)])
);
const largeBatchAvailability = Object.fromEntries(
  Array.from({ length: 8 }, (_, lecturerIndex) => {
    const daySlots = Object.fromEntries(
      largeBatchDayNames.map((day) => {
        const enabled = {};
        for (let minute = 8 * 60; minute < 16 * 60; minute += 15) {
          enabled[`${day}|${minute}`] = true;
        }
        return [day, enabled];
      })
    );
    return [
      lecturerIndex + 1,
      {
        '5|STAC|': {
          slots: Object.assign({}, ...Object.values(daySlots)),
          segmentStarts: Object.fromEntries(largeBatchDayNames.map((day) => [day, new Set([8 * 60])])),
          segmentRanges: Object.fromEntries(
            largeBatchDayNames.map((day) => [day, [{ start: 8 * 60, end: 16 * 60 }]])
          ),
        },
      },
    ];
  })
);
const largeBatchResult = solveSchedule(
  largeBatchItems,
  largeBatchDayNames,
  largeBatchSlots,
  {
    preferredLecturerDays: [],
    windowPreference: 50,
    latePreference: 50,
    spreadPreference: 50,
    studyMode: 'STAC',
    selectedSemesters: ['5|STAC|'],
    lecturerPreferences: {},
  },
  largeBatchAvailability,
  [],
  {},
  24 * 60
);
const largeBatchElapsed = Date.now() - performanceStart;
assert.ok(largeBatchResult.plan.length > 0, 'Duża partia zadań powinna dać jakikolwiek plan');
assert.ok(largeBatchElapsed < 3000, `Generowanie planu dla dużej partii powinno być szybkie; trwało ${largeBatchElapsed} ms`);

const sharedSelectionResults = buildSelectionResults(
  [{ id: 10, semestr: '3', tryb: 'STAC', specjalnosc: '' }],
  [{ courseId: 10, day: 'Poniedzialek', start: 480, duration: 60, name: 'Wykład', lecturer: 'Dr A' }],
  [],
  ['5|STAC|', '6|STAC|']
);

assert.equal(sharedSelectionResults['5|Ogólne|STAC']?.plan.length, 1, 'Pierwsza zgodna grupa semestrów powinna zawierać zajęcie');
// Po zmianach usuwających logikę "zużywania" przedmiotów, oczekujemy, że przedmiot
// z 3. roku (pasujący do sem. 5 i 6) pojawi się w obu planach, jeśli oba zostaną wybrane.
assert.ok(sharedSelectionResults['6|Ogólne|STAC'], 'Druga grupa semestrów powinna teraz tworzyć osobny wpis');
assert.equal(sharedSelectionResults['6|Ogólne|STAC']?.plan.length, 1, 'Druga grupa semestrów również powinna zawierać to samo zajęcie');

const specializationSelectionResults = buildSelectionResults(
  [
    { id: 10, semestr: '5', tryb: 'STAC', specjalnosc: 'M3D' },
    { id: 11, semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK' },
  ],
  [
    { courseId: 10, day: 'Poniedzialek', start: 480, duration: 60, name: 'Wykład M3D', lecturer: 'Dr A' },
    { courseId: 11, day: 'Poniedzialek', start: 540, duration: 60, name: 'Wykład ASiSK', lecturer: 'Dr B' },
  ],
  [],
  ['5|STAC|ASiSK+M3D', '5|STAC|M3D']
);

assert.equal(typeof specializationSelectionResults['5|ASiSK+M3D|STAC'], 'object', 'Powinien istnieć plan dla opcji ASiSK+M3D');
assert.equal(typeof specializationSelectionResults['5|M3D|STAC'], 'object', 'Powinien istnieć plan dla opcji M3D');

const mergedSelectionResults = buildSelectionResults(
  [
    { id: 10, semestr: '5', tryb: 'STAC', specjalnosc: '' }, // General
    { id: 11, semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK' }, // Spec
  ],
  [
    { courseId: 10, day: 'Poniedzialek', start: 480, duration: 60, name: 'Wykład Ogólny', lecturer: 'Dr A' },
    { courseId: 11, day: 'Wtorek', start: 480, duration: 60, name: 'Wykład ASiSK', lecturer: 'Dr B' },
  ],
  [],
  ['5|STAC|', '5|STAC|ASiSK'], // Select both general and specialization
  {}
);

assert.ok(mergedSelectionResults['5|ASiSK|STAC'], 'Plan dla specjalizacji powinien istnieć');
assert.equal(mergedSelectionResults['5|ASiSK|STAC'].plan.length, 2, 'Plan dla specjalizacji powinien zawierać 2 zajęcia (ogólne + specjalizacyjne)');
assert.equal(mergedSelectionResults['5|Ogólne|STAC'], undefined, 'Plan ogólny powinien zostać usunięty po złączeniu');

const combinedSelectionResults = buildSelectionResults(
  [
    { id: 10, semestr: '5', tryb: 'STAC', specjalnosc: '' }, // General
    { id: 11, semestr: '5', tryb: 'STAC', specjalnosc: 'ASiSK' }, // Spec 1
    { id: 12, semestr: '5', tryb: 'STAC', specjalnosc: 'M3D' }, // Spec 2
    { id: 13, semestr: '6', tryb: 'STAC', specjalnosc: '' }, // Other semester
  ],
  [
    { courseId: 10, day: 'Poniedzialek', start: 480, duration: 60, name: 'Wykład Ogólny 5', lecturer: 'Dr A' },
    { courseId: 11, day: 'Wtorek', start: 480, duration: 60, name: 'Wykład ASiSK', lecturer: 'Dr B' },
    { courseId: 12, day: 'Sroda', start: 480, duration: 60, name: 'Wykład M3D', lecturer: 'Dr C' },
    { courseId: 13, day: 'Czwartek', start: 480, duration: 60, name: 'Wykład Ogólny 6', lecturer: 'Dr D' },
  ],
  [],
  ['5|STAC|ASiSK', '5|STAC|M3D', '6|STAC|'], // Select two specs for sem 5, and one general for sem 6
  {}
);

assert.ok(combinedSelectionResults['5|ASiSK+M3D|STAC'], 'Połączony plan dla semestru 5 powinien istnieć');
assert.equal(combinedSelectionResults['5|ASiSK+M3D|STAC'].plan.length, 3, 'Połączony plan dla semestru 5 powinien zawierać 3 zajęcia (Ogólne + ASiSK + M3D)');
assert.equal(combinedSelectionResults['5|ASiSK|STAC'], undefined, 'Osobny plan dla ASiSK nie powinien istnieć, gdy jest częścią połączonego');
assert.equal(combinedSelectionResults['5|M3D|STAC'], undefined, 'Osobny plan dla M3D nie powinien istnieć, gdy jest częścią połączonego');
assert.ok(combinedSelectionResults['6|Ogólne|STAC'], 'Plan dla semestru 6 powinien istnieć');
assert.equal(combinedSelectionResults['6|Ogólne|STAC'].plan.length, 1, 'Plan dla semestru 6 powinien zawierać 1 zajęcie');

const fallbackSelection = filterClassesForScheduling(
  [{ idzajecia: 1, idprzedmiotu: 10, wykladowca_id: 100, tryb: 'STAC', semestr: '5', specjalnosc: '' }],
  {
    subjectIds: [10],
    lecturerIds: [100],
    parsedSemesterFilters: [{ semestrs: ['7'], tryb: 'STAC', specjalnosc: null }],
    studyMode: 'STAC',
  }
);

assert.equal(fallbackSelection.length, 1, 'Powinno zachować zajęcia po nieudanym dopasowaniu filtrów semestrów, jeśli pasują do trybu i wyboru przedmiotu/wykładowcy');

console.log('planista test passed');
