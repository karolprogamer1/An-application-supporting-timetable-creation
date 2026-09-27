const assert = require('assert');
const { canPlace } = require('../common/scheduler');

const makeAssignment = (start, lecturerId, group) => ({
  day: 'Poniedzialek',
  start,
  duration: 60,
  lecturerId,
  roomId: lecturerId,
  group,
});

const makeDayAssignments = (assignments) => new Map([['Poniedzialek', assignments]]);

const simultaneousThree = [
  makeAssignment(480, 1),
  makeAssignment(480, 2),
  makeAssignment(480, 3),
];

assert.equal(
  canPlace(makeAssignment(480, 4), simultaneousThree, {}, {}, makeDayAssignments(simultaneousThree)),
  false,
  'Czwarte równoczesne bezgrupowe zajęcie nie powinno zostać zaplanowane',
);

assert.equal(
  canPlace(makeAssignment(480, 4, 'A'), simultaneousThree, {}, {}, makeDayAssignments(simultaneousThree)),
  true,
  'Zajęcie z przypisaną grupą może odbywać się równocześnie',
);

const overlappingThree = [
  makeAssignment(480, 1),
  makeAssignment(510, 2),
  makeAssignment(540, 3),
];

assert.equal(
  canPlace(makeAssignment(525, 4), overlappingThree, {}, {}, makeDayAssignments(overlappingThree)),
  false,
  'Limit powinien uwzględniać także częściowo nakładające się zajęcia',
);

console.log('OK: jednocześnie mogą odbywać się maksymalnie trzy zajęcia bez grup');
