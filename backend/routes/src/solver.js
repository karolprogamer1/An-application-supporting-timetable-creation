
import { CpModel, CpSolver, LinearExpr } from 'or-tools-wasm/cp-sat';

/**
 * Buduje i rozwiązuje model CP-SAT dla problemu planowania zajęć.
 * @param {import('./types.js').SchedulerInput} input - dane wejściowe
 * @returns {Promise<import('./types.js').SchedulerOutput>}
 */
export async function buildAndSolve(input) {
  const {
    zajecia,
    slots,
    rooms,
    availability = {},
    preferences = {},
    adjacencyPairs = [],
    maxTimeSeconds = 50.0,
  } = input;

  const numZajecia = zajecia.length;
  const numSlots = slots.length;
  const numRooms = rooms.length;

  // Mapy pomocnicze: ID -> indeks
  const zajeciaIdx = new Map(zajecia.map((z, i) => [z.id, i]));
  const slotIdx = new Map(slots.map((s, i) => [s.id, i]));
  const roomIdx = new Map(rooms.map((r, i) => [r.id, i]));

  // 1. Inicjalizacja modelu
  const model = new CpModel();

  // 2. Zmienne decyzyjne x[z][s][r] – boolowskie
  /** @type {Array<Array<Array<any>>>} */
  const x = [];
  for (let z = 0; z < numZajecia; z++) {
    x[z] = [];
    for (let s = 0; s < numSlots; s++) {
      x[z][s] = [];
      for (let r = 0; r < numRooms; r++) {
        const varName = `x_${zajecia[z].id}_${slots[s].id}_${rooms[r].id}`;
        x[z][s][r] = model.newBoolVar(varName);
      }
    }
  }

  const occupiedSlotIndexes = (zajecie, startSlotIndex) => {
    const start = Date.parse(`1970-01-01T${slots[startSlotIndex].startTime}`);
    const durationMinutes = Number(zajecie.durationMinutes) || 15;
    const end = start + durationMinutes * 60 * 1000;

    return slots.reduce((indexes, slot, index) => {
      const slotStart = Date.parse(`1970-01-01T${slot.startTime}`);
      const slotEnd = Date.parse(`1970-01-01T${slot.endTime}`);
      if (start < slotEnd && end > slotStart) indexes.push(index);
      return indexes;
    }, []);
  };

  // 3. Ograniczenie: każde zajęcia muszą być przypisane do dokładnie 1 slotu i 1 sali
  for (let z = 0; z < numZajecia; z++) {
    const varsForLesson = [];
    for (let s = 0; s < numSlots; s++) {
      for (let r = 0; r < numRooms; r++) {
        varsForLesson.push(x[z][s][r]);
      }
    }
    model.addExactlyOne(varsForLesson);
  }

  // 4. Ograniczenie: grupa nie może mieć dwóch zajęć w tym samym slocie
  // Grupujemy zajęcia po grupa_id
  const groupLessons = new Map();
  for (const z of zajecia) {
    if (!groupLessons.has(z.grupa_id)) groupLessons.set(z.grupa_id, []);
    groupLessons.get(z.grupa_id).push(z.id);
  }

  for (const [grupaId, lessonIds] of groupLessons) {
    for (let s = 0; s < numSlots; s++) {
      const varsInSlot = [];
      for (const lessonId of lessonIds) {
        const zIdx = zajeciaIdx.get(lessonId);
        for (let startSlot = 0; startSlot < numSlots; startSlot++) {
          if (!occupiedSlotIndexes(zajecia[zIdx], startSlot).includes(s)) continue;
          for (let r = 0; r < numRooms; r++) {
            varsInSlot.push(x[zIdx][startSlot][r]);
          }
        }
      }
      if (varsInSlot.length > 1) {
        model.addAtMostOne(varsInSlot);
      }
    }
  }

  // 5. Ograniczenie: prowadzący nie może mieć dwóch zajęć w tym samym slocie
  const lecturerLessons = new Map();
  for (const z of zajecia) {
    if (!lecturerLessons.has(z.wykladowca_id)) lecturerLessons.set(z.wykladowca_id, []);
    lecturerLessons.get(z.wykladowca_id).push(z.id);
  }

  for (const [lecturerId, lessonIds] of lecturerLessons) {
    for (let s = 0; s < numSlots; s++) {
      const varsInSlot = [];
      for (const lessonId of lessonIds) {
        const zIdx = zajeciaIdx.get(lessonId);
        for (let startSlot = 0; startSlot < numSlots; startSlot++) {
          if (!occupiedSlotIndexes(zajecia[zIdx], startSlot).includes(s)) continue;
          for (let r = 0; r < numRooms; r++) {
            varsInSlot.push(x[zIdx][startSlot][r]);
          }
        }
      }
      if (varsInSlot.length > 1) {
        model.addAtMostOne(varsInSlot);
      }
    }
  }

  // 6. Ograniczenie: sala nie może mieć dwóch zajęć w tym samym slocie
  for (let s = 0; s < numSlots; s++) {
    for (let r = 0; r < numRooms; r++) {
      const varsForRoomSlot = [];
      for (let z = 0; z < numZajecia; z++) {
        for (let startSlot = 0; startSlot < numSlots; startSlot++) {
          if (occupiedSlotIndexes(zajecia[z], startSlot).includes(s)) {
            varsForRoomSlot.push(x[z][startSlot][r]);
          }
        }
      }
      model.addAtMostOne(varsForRoomSlot);
    }
  }

  // 7. Ograniczenie: dostępność prowadzącego (jeśli niedostępny -> wymuś 0)
  for (const z of zajecia) {
    const zIdx = zajeciaIdx.get(z.id);
    const lecturerId = z.wykladowca_id;
    const lecturerAvailability = availability[lecturerId] || {};
    for (let s = 0; s < numSlots; s++) {
      const isAvailable = occupiedSlotIndexes(z, s).every((occupiedSlot) => {
        const slotId = slots[occupiedSlot].id;
        return lecturerAvailability[slotId] !== false;
      });
      if (!isAvailable) {
        for (let r = 0; r < numRooms; r++) {
          model.addEquality(x[zIdx][s][r], 0);
        }
      }
    }
  }

  // 8. Funkcja celu: minimalizacja sumy kar (preferencje prowadzących)
  const objectiveVariables = [];
  const objectiveCoefficients = [];
  for (const z of zajecia) {
    const zIdx = zajeciaIdx.get(z.id);
    const lecturerId = z.wykladowca_id;
    const lecturerPrefs = preferences[lecturerId] || {};
    for (let s = 0; s < numSlots; s++) {
      const slotId = slots[s].id;
      const penalty = lecturerPrefs[slotId] || 0;
      if (penalty > 0) {
        for (let r = 0; r < numRooms; r++) {
          objectiveVariables.push(x[zIdx][s][r]);
          objectiveCoefficients.push(penalty);
        }
      }
    }
  }

  const placementVariables = new Map();
  for (let z = 0; z < numZajecia; z++) {
    for (let s = 0; s < numSlots; s++) {
      const placement = model.newBoolVar(`placement_${zajecia[z].id}_${slots[s].id}`);
      model.addMaxEquality(placement, x[z][s]);
      placementVariables.set(`${zajecia[z].id}|${s}`, placement);
    }
  }

  const adjacencyGraph = new Map();
  for (const pair of adjacencyPairs || []) {
    if (!adjacencyGraph.has(pair.firstId)) adjacencyGraph.set(pair.firstId, new Set());
    if (!adjacencyGraph.has(pair.secondId)) adjacencyGraph.set(pair.secondId, new Set());
    adjacencyGraph.get(pair.firstId).add(pair.secondId);
    adjacencyGraph.get(pair.secondId).add(pair.firstId);
  }

  const visitedAdjacencyItems = new Set();
  for (const itemId of adjacencyGraph.keys()) {
    if (visitedAdjacencyItems.has(itemId)) continue;
    const component = [];
    const pending = [itemId];
    visitedAdjacencyItems.add(itemId);
    while (pending.length > 0) {
      const currentId = pending.pop();
      component.push(currentId);
      for (const neighborId of adjacencyGraph.get(currentId) || []) {
        if (visitedAdjacencyItems.has(neighborId)) continue;
        visitedAdjacencyItems.add(neighborId);
        pending.push(neighborId);
      }
    }

    if (component.length < 3) continue;
    for (let s = 0; s < numSlots; s++) {
      const startsInComponent = component
        .map((itemId) => placementVariables.get(`${itemId}|${s}`))
        .filter(Boolean);
      if (startsInComponent.length > 1) model.addAtMostOne(startsInComponent);
    }
  }

  for (const pair of adjacencyPairs || []) {
    const firstIndex = zajeciaIdx.get(pair.firstId);
    const secondIndex = zajeciaIdx.get(pair.secondId);
    if (firstIndex == null || secondIndex == null) continue;

    for (let firstSlot = 0; firstSlot < numSlots; firstSlot++) {
      for (let secondSlot = 0; secondSlot < numSlots; secondSlot++) {
        if (slots[firstSlot].dayOfWeek !== slots[secondSlot].dayOfWeek) continue;

        const firstStart = Date.parse(`1970-01-01T${slots[firstSlot].startTime}`);
        const secondStart = Date.parse(`1970-01-01T${slots[secondSlot].startTime}`);
        const firstEnd = firstStart + (Number(zajecia[firstIndex].durationMinutes) || 15) * 60 * 1000;
        const secondEnd = secondStart + (Number(zajecia[secondIndex].durationMinutes) || 15) * 60 * 1000;
        if (firstEnd !== secondStart && secondEnd !== firstStart) continue;

        const firstPlacement = placementVariables.get(`${pair.firstId}|${firstSlot}`);
        const secondPlacement = placementVariables.get(`${pair.secondId}|${secondSlot}`);
        if (!firstPlacement || !secondPlacement) continue;

        const adjacent = model.newBoolVar(`adjacent_${pair.firstId}_${firstSlot}_${pair.secondId}_${secondSlot}`);
        model.addBoolAnd([firstPlacement, secondPlacement]).onlyEnforceIf(adjacent);
        model.addBoolOr([firstPlacement.not(), secondPlacement.not(), adjacent]);
        model.addImplication(adjacent, firstPlacement);
        model.addImplication(adjacent, secondPlacement);
        objectiveVariables.push(adjacent);
        objectiveCoefficients.push(-10000);
      }
    }
  }
  const objectiveExpr = LinearExpr.weightedSum(objectiveVariables, objectiveCoefficients);
  model.minimize(objectiveExpr);

  // 9. Rozwiązywanie
  const solver = new CpSolver();
  if (maxTimeSeconds) {
    solver.parameters.max_time_in_seconds = maxTimeSeconds;
  }
  const startTime = Date.now();
  const response = await solver.solve(model);
  const solveTime = (Date.now() - startTime) / 1000;

  const status = solver.statusName(response.status);

  // 10. Ekstrakcja wyników
  /** @type {import('./types.js').PlanEntry[]} */
  const planEntries = [];
  for (let z = 0; z < numZajecia; z++) {
    for (let s = 0; s < numSlots; s++) {
      for (let r = 0; r < numRooms; r++) {
        if (solver.value(x[z][s][r]) === 1) {
          planEntries.push({
            zajecia_id: zajecia[z].id,
            sala_id: rooms[r].id,
            slot_id: slots[s].id,
            day_of_week: slots[s].dayOfWeek,
            time_day: slots[s].startTime,
          });
        }
      }
    }
  }

  // 11. Raport
  /** @type {import('./types.js').ReportContent} */
  const reportContent = {
    status,
    totalZajecia: numZajecia,
    plannedEntries: planEntries.length,
    objectiveValue: solver.objectiveValue(),
    solveTimeSeconds: solveTime,
  };

  return {
    status,
    planEntries,
    report: {
      zawartosc: JSON.stringify(reportContent),
    },
  };
}
