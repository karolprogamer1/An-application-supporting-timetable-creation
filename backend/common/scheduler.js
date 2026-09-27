const {
  weekdays,
  dayLabels,
  getSemesterNumbers,
  parseTime,
  formatTime,
  normalizeDay,
  formatDuration,
  buildSlots,
  toNumericIds,
  buildItemsFromRows,
  calculateBadGaps, // Dodano import calculateBadGaps
  shuffleArray,
} = require('./utils');

const haveCommonStudents = (studentsA, studentsB) => {
  if (!studentsA || !studentsB || !(studentsA instanceof Set) || !(studentsB instanceof Set) || studentsA.size === 0 || studentsB.size === 0) {
    return false;
  }
  const [smallerSet, largerSet] = studentsA.size < studentsB.size
    ? [studentsA, studentsB]
    : [studentsB, studentsA];
  for (const studentId of smallerSet) {
    if (largerSet.has(studentId)) return true;
  }
  return false;
};

const isLectureType = (item) => /wykład/i.test(item.type || '');
const isPracticalType = (item) => /ćwic|cwic|lab|proj|sem/i.test(item.type || '');
const isLectureLaboratoryType = (item) => {
  const type = String(item?.type || '').trim().toLowerCase();
  const hasLecture = type.includes('wyklad') || type.includes('wykład') || type.includes('lecture');
  const hasLaboratory = type.includes('lab') || type.includes('laboratorium') || type.includes('prac') || type.includes('cwic') || type.includes('ćwic');
  return hasLecture && hasLaboratory;
};
const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  // Rok akademicki zaczyna się w październiku (miesiąc 9)
  if (month >= 9) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
};

const normalizeStudyMode = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NST' || normalized === 'NSTAC') return 'NSTAC';
  return 'STAC';
};

const getPlannerEquivalentSemesters = (value) => {
  const rawSemesters = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : getSemesterNumbers(value);

  const equivalentSemesters = new Set(rawSemesters.filter(Boolean));
  rawSemesters.forEach((semester) => {
    if (semester === '3') {
      equivalentSemesters.add('5');
      equivalentSemesters.add('6');
    }
    if (semester === '4') {
      equivalentSemesters.add('7');
    }
  });

  return Array.from(equivalentSemesters);
};

const getBestLecturerAvailability = (lecturerId, item, availabilityByLecturerId, preferences = {}) => {
  if (!lecturerId || !availabilityByLecturerId || !availabilityByLecturerId[lecturerId]) {
    return null;
  }

  const allAvailabilitiesForLecturer = availabilityByLecturerId[lecturerId];
  const itemSemesters = getPlannerEquivalentSemesters(item.semestr).map(String);
  const itemMode = normalizeStudyMode(item.tryb);
  const itemSpec = String(item.specjalnosc || '').trim();
  const selectedSemesters = Array.isArray(preferences?.selectedSemesters)
    ? preferences.selectedSemesters.map(String).filter(Boolean)
    : [];

  const prioritizedSemesters = [
    ...new Set([
      ...selectedSemesters.filter((sem) => itemSemesters.includes(sem)),
      ...itemSemesters,
    ]),
  ];

  for (const sem of prioritizedSemesters) {
    const keyWithSpec = `${sem}|${itemMode}|${itemSpec}`;
    if (allAvailabilitiesForLecturer[keyWithSpec]) {
      return allAvailabilitiesForLecturer[keyWithSpec];
    }
  }

  if (itemSpec) {
    for (const sem of prioritizedSemesters) {
      const keyWithoutSpec = `${sem}|${itemMode}|`;
      if (allAvailabilitiesForLecturer[keyWithoutSpec]) {
        return allAvailabilitiesForLecturer[keyWithoutSpec];
      }
    }
  }

  return null;
};

const hasUsableLecturerAvailability = (lecturerId, item, availabilityByLecturerId, preferences = {}) => {
  const availability = getBestLecturerAvailability(lecturerId, item, availabilityByLecturerId, preferences);
  if (!availability) return false;

  return Object.keys(availability.slots || {}).length > 0
    || Object.values(availability.segmentRanges || {}).some((ranges) => Array.isArray(ranges) && ranges.length > 0);
};

const matchesSemesterFilter = (rowSemester, filterSemester) => {
  if (!filterSemester) return true;

  const subjectSemesters = getPlannerEquivalentSemesters(rowSemester);
  const filterSemesters = Array.isArray(filterSemester)
    ? filterSemester.map(String).filter(Boolean)
    : Array.isArray(filterSemester?.semestrs)
      ? filterSemester.semestrs.map(String).filter(Boolean)
      : [String(filterSemester).trim()].filter(Boolean);

  if (subjectSemesters.length > 0 && filterSemesters.length > 0) {
    return subjectSemesters.some((sem) => filterSemesters.includes(sem));
  }

  return String(rowSemester || '').trim() === String(filterSemester || '').trim();
};

const matchesCourseFilter = (row = {}, filters = []) => {
  if (!Array.isArray(filters) || filters.length === 0) {
    return true;
  }

  const rowSemesters = getPlannerEquivalentSemesters(row.semestr);
  const rowMode = normalizeStudyMode(row.tryb);
  const rowSpec = String(row.specjalnosc || '').trim();

  return filters.some((filter) => {
    const filterSemesters = Array.isArray(filter.semestrs)
      ? filter.semestrs.map(String).filter(Boolean)
      : [String(filter.semestr || '').trim()].filter(Boolean);

    const filterMode = normalizeStudyMode(filter.tryb);
    const filterSpec = String(filter.specjalnosc || '').trim();

    if (filterMode && rowMode && filterMode !== rowMode) {
      return false;
    }

    if (filterSemesters.length > 0 && rowSemesters.length > 0) {
      if (!rowSemesters.some((sem) => filterSemesters.includes(sem))) {
        return false;
      }
    }

    if (filterSpec) {
      if (rowSpec === '') return true; // Przedmioty ogólne zawsze pasują.

      const filterSpecsSet = new Set(filterSpec.split('+').map(s => s.trim()));
      const rowSpecsSet = new Set(rowSpec.split('+').map(s => s.trim()));

      // Przedmiot pasuje, jeśli wszystkie jego specjalizacje zawierają się w specjalizacjach filtra.
      // Np. filtr 'ASiSK+M3D' pasuje do przedmiotu 'ASiSK', ale filtr 'ASiSK' nie pasuje do 'ASiSK+M3D'.
      return [...rowSpecsSet].every(spec => filterSpecsSet.has(spec));
    }

    return true;
  });
};

const toSafeInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
};

const getLogicalItemKey = (item) => {
  const normalizedGroup = Array.isArray(item?.group)
    ? [...item.group].sort().join('|')
    : String(item?.group || '');

  return JSON.stringify({
    subjectId: item?.subjectId ?? null,
    name: item?.name ?? '',
    type: item?.type ?? '',
    lecturerId: item?.lecturerId ?? null,
    duration: item?.duration ?? null,
    semestr: item?.semestr ?? '',
    tryb: item?.tryb ?? '',
    specjalnosc: item?.specjalnosc ?? '',
    group: normalizedGroup,
  });
};

const deduplicateItems = (items = []) => {
  const seen = new Set();
  const uniqueItems = [];

  for (const item of items) {
    const key = getLogicalItemKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
};

const deduplicateAssignments = (assignments = []) => {
  const seen = new Set();
  const uniqueAssignments = [];

  for (const assignment of assignments) {
    const key = JSON.stringify({
      sourceId: assignment?.sourceId ?? assignment?.courseId ?? null,
      lecturerId: assignment?.lecturerId ?? null,
      subjectId: assignment?.subjectId ?? null,
      name: assignment?.name ?? '',
      type: assignment?.type ?? '',
      semestr: assignment?.semestr ?? '',
      tryb: assignment?.tryb ?? '',
      specjalnosc: assignment?.specjalnosc ?? '',
      duration: assignment?.duration ?? null,
      day: assignment?.day ?? '',
      start: assignment?.start ?? null,
      roomId: assignment?.roomId ?? null,
      group: Array.isArray(assignment?.group)
        ? [...assignment.group].sort().join('|')
        : String(assignment?.group || ''),
    });

    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueAssignments.push(assignment);
  }

  return uniqueAssignments;
};

const isLecturerAvailable = (lecturerId, item, day, start, duration, availabilityByLecturerId, preferences = {}) => {
  if (!hasUsableLecturerAvailability(lecturerId, item, availabilityByLecturerId, preferences)) {
    return true; // Empty or missing availability means the lecturer did not report hours.
  }

  const availability = getBestLecturerAvailability(lecturerId, item, availabilityByLecturerId, preferences);

  const slots = availability.slots || {};
  const itemEnd = start + duration;

  const segmentRanges = availability.segmentRanges?.[day] || [];
  if (segmentRanges.length > 0) {
    return segmentRanges.some((segment) => start >= segment.start && itemEnd <= segment.end);
  }

  for (let current = start; current < itemEnd; current += 15) {
    const slotKey = `${day}|${current}`;
    if (slots[slotKey] !== true) return false;
  }

  return true;
};

const hasLecturerAvailabilitySlot = (lecturerId, slotKey, availabilityByLecturerId) => {
  const byId = availabilityByLecturerId && availabilityByLecturerId[lecturerId];
  if (!byId) return false;
  for (const semKey of Object.keys(byId)) {
    const availability = byId[semKey];
    if (availability && availability.slots && availability.slots[slotKey] === true) return true;
  }
  return false;
};

const isDifferentLecturerSameAvailability = (placed, assignment, availabilityByLecturerId) => {
  if (!availabilityByLecturerId) return false;
  if (placed.lecturerId == null || assignment.lecturerId == null) return false;
  if (placed.lecturerId === assignment.lecturerId) return false;
  if (placed.day !== assignment.day) return false;

  const getAvailabilityData = (lecturerId) => {
    const byId = availabilityByLecturerId[lecturerId];
    if (!byId) return { slotSet: new Set(), segmentRanges: [] };

    const slotSet = new Set();
    const segmentRanges = [];
    for (const entry of Object.values(byId)) {
      if (!entry) continue;
      if (entry.slots) {
        for (const key of Object.keys(entry.slots)) {
          const [day, time] = String(key).split('|');
          if (day === placed.day && entry.slots[key] === true) {
            slotSet.add(Number(time));
          }
        }
      }
      if (Array.isArray(entry.segmentRanges?.[placed.day])) {
        segmentRanges.push(...entry.segmentRanges[placed.day]);
      }
    }

    return { slotSet, segmentRanges };
  };

  const placedAvailability = getAvailabilityData(placed.lecturerId);
  const assignmentAvailability = getAvailabilityData(assignment.lecturerId);

  const hasSharedDaySlot = [...placedAvailability.slotSet].some((slot) => assignmentAvailability.slotSet.has(slot));
  const hasSharedSegment = placedAvailability.segmentRanges.some((segment) =>
    assignmentAvailability.segmentRanges.some((otherSegment) => {
      const overlapStart = Math.max(segment.start, otherSegment.start);
      const overlapEnd = Math.min(segment.end, otherSegment.end);
      return overlapEnd > overlapStart;
    })
  );

  return hasSharedDaySlot || hasSharedSegment;
};

const getAssignmentsByDay = (plan = []) => {
  const byDay = new Map();
  for (const item of plan) {
    if (!item || !item.day) continue;
    if (!byDay.has(item.day)) {
      byDay.set(item.day, []);
    }
    byDay.get(item.day).push(item);
  }
  return byDay;
};

const scorePlacement = (assignment, currentPlan, preferences, dayUsage, morningStartHourUsage, availabilityByLecturerId, assignmentsByDay = null) => {
  const currentMode = preferences?.studyMode === 'NSTAC' ? 'NSTAC' : 'STAC';
  const sameDayAssignments = assignmentsByDay?.get(assignment.day) || getAssignmentsByDay(currentPlan).get(assignment.day) || [];
  let score = 0;

  // Reguła: Silnie preferuj umieszczanie pierwszych zajęć w pojedynczym, ciągłym
  // bloku dostępności wykładowcy na samym jego początku. To zapobiega rozpoczynaniu
  // zajęć np. o 8:15, gdy wykładowca jest dostępny od 8:00, a slot jest wolny.
  // Zastosowanie bardzo wysokiej punktacji zamiast twardego ograniczenia zapobiega
  // sytuacji, w której zajęcia stają się niemożliwe do umieszczenia, jeśli początek
  // bloku jest zablokowany z innego powodu (np. konflikt sali lub studenta).
  if (assignment.lecturerId != null && availabilityByLecturerId?.[assignment.lecturerId]) {
    const availability = getBestLecturerAvailability(assignment.lecturerId, assignment, availabilityByLecturerId, preferences);
    const daySegmentRanges = availability?.segmentRanges?.[assignment.day] || [];

    if (daySegmentRanges.length === 1) {
      const segment = daySegmentRanges[0];
      const isFirstInSegment = !currentPlan.some(p =>
        p.lecturerId === assignment.lecturerId &&
        p.day === assignment.day &&
        p.start >= segment.start &&
        (p.start + p.duration) <= segment.end
      );

      if (isFirstInSegment) {
        score -= Math.abs(assignment.start - segment.start) * 150; // Duża kara za każdą minutę oddalenia od początku.
      }
    }
  }

  if (Array.isArray(preferences?.preferredLecturerDays) && preferences.preferredLecturerDays.includes(assignment.day)) {
    score += 30;
  }

  const hourIndex = assignment.start / 60;
  score += (24 - hourIndex) * ((Number(preferences?.latePreference) || 50) / 100);
  score += (5 - (dayUsage?.[assignment.day] || 0)) * ((Number(preferences?.spreadPreference) || 50) / 100);

  if (assignment.preferredStart != null) {
    // Zwiększona kara za odchylenie od preferowanej godziny rozpoczęcia.
    score -= Math.abs(assignment.start - assignment.preferredStart) * 120;
  }

  if (availabilityByLecturerId && assignment.lecturerId != null) {
    const availability = getBestLecturerAvailability(assignment.lecturerId, assignment, availabilityByLecturerId, preferences);
    const daySegmentRanges = availability?.segmentRanges?.[assignment.day] || [];
    if (daySegmentRanges.length > 0) {
      const earliestSegmentStart = daySegmentRanges.reduce((minStart, segment) => Math.min(minStart, segment.start), Number.POSITIVE_INFINITY);
      if (Number.isFinite(earliestSegmentStart) && assignment.start > earliestSegmentStart) {
        const delayMinutes = assignment.start - earliestSegmentStart;
        score -= delayMinutes * 180; // Kara za niepotrzebne opóźnianie zajęcia w obrębie segmentu dostępności.
      }
    }
  }

  // Kara za "okienka" - puste przestrzenie między zajęciami.
  // To zniechęca do tworzenia niepotrzebnych przerw i promuje zwarte bloki.
  const breakMinutes = 15; // Standardowa przerwa między zajęciami
  const badGapsBefore = calculateBadGaps(sameDayAssignments, breakMinutes);
  const badGapsAfter = calculateBadGaps([...sameDayAssignments, assignment], breakMinutes);
  const windowPreference = Number(preferences?.windowPreference) || 50;
  if (windowPreference > 0) {
    // Zmniejszono mnożnik kary za "okienka", aby inne reguły (np. `samePeriod`) miały większe znaczenie.
    score -= (badGapsAfter - badGapsBefore) * (windowPreference * 5);
  }

  if (preferences?.studyMode === 'STAC' && morningStartHourUsage) {
    const startHour = Math.floor(assignment.start / 60);
    if (Object.prototype.hasOwnProperty.call(morningStartHourUsage, startHour)) {
      // Zmniejszona kara za koncentrowanie się wielu zajęć o tej samej godzinie.
      // Oryginalna wartość (×100) była zbyt surowa i powodowała brak miejsc.
      const morningPenalty = Number(preferences?.morningPenalty) || 10;
      score -= morningStartHourUsage[startHour] * morningPenalty;
    }
  }

  if (availabilityByLecturerId && assignment.lecturerId != null) {
    const itemSemesters = getPlannerEquivalentSemesters(assignment.semestr).map(String);
    const itemMode = normalizeStudyMode(assignment.tryb);
    const itemSpec = String(assignment.specjalnosc || '').trim();
    const selectedSemesters = Array.isArray(preferences?.selectedSemesters)
      ? preferences.selectedSemesters.map(String).filter(Boolean)
      : [];

    const prioritizedSemesters = [
      ...new Set([
        ...selectedSemesters.filter((sem) => itemSemesters.includes(sem)),
        ...itemSemesters,
      ]),
    ];

    for (const sem of prioritizedSemesters) {
      let availability = availabilityByLecturerId[assignment.lecturerId]?.[`${sem}|${itemMode}|${itemSpec}`];
      if (!availability && itemSpec) {
        availability = availabilityByLecturerId[assignment.lecturerId]?.[`${sem}|${itemMode}|`];
      }

      const daySegmentRanges = availability?.segmentRanges?.[assignment.day] || [];
      if (daySegmentRanges.length > 0) {
        const isLecture = isLectureType(assignment);
        const isLab = /lab/i.test(assignment.type || '');
        let specificRuleApplied = false;

        for (const segment of daySegmentRanges) {
          if (assignment.start >= segment.start && (assignment.start + assignment.duration) <= segment.end) {
            // Reguła 1: Wykłady (45 min) na początku segmentu.
            if (isLecture && assignment.duration === 45) {
              if (assignment.start === segment.start) {
                score += 950; // Duży bonus za umieszczenie na początku.
              } else {
                score -= 800; // Duża kara za umieszczenie w środku.
              }
              specificRuleApplied = true;
              break; // Zastosowano regułę, wyjdź z pętli po segmentach.
            }
            // Reguła 2: Długie laboratoria (90-135 min) na końcu segmentu.
            else if (isLab && assignment.duration >= 90 && assignment.duration <= 135) {
              if (assignment.start + assignment.duration === segment.end) {
                score += 950; // Duży bonus za umieszczenie na końcu.
              } else {
                score -= 800; // Duża kara za umieszczenie w innym miejscu.
              }
              specificRuleApplied = true;
              break; // Zastosowano regułę, wyjdź z pętli po segmentach.
            }
          }
        }

        // Ogólna reguła, jeśli nie zastosowano żadnej specyficznej.
        if (!specificRuleApplied) {
          const daySegmentStarts = availability?.segmentStarts?.[assignment.day];
          if (daySegmentStarts && daySegmentStarts.has(assignment.start)) {
            score += 500; // Ogólny bonus za rozpoczynanie na początku segmentu.
          }
        }
        break; // Zastosuj reguły tylko dla pierwszego pasującego semestru z dostępnością.
      }
    }
  }

  // Prefer placing assignments that belong to the same lecturer and share the same
  // active period (data_rozpoczecia/data_zakonczenia) next to each other.
  // This biases the solver to keep period-bound classes adjacent on the same day.
  const parsePeriod = (val) => {
    try {
      if (!val) return null;
      const d = new Date(val);
      return Number.isFinite(d.getTime()) ? d.getTime() : null;
    } catch (e) {
      return null;
    }
  };

  const normalizeGroupSet = (groupValue) => {
    if (groupValue == null) return new Set();
    const raw = Array.isArray(groupValue) ? groupValue.join(',') : String(groupValue);
    const items = raw.split(/\s*[,+\/;&]\s*/);
    return new Set(items.map((value) => String(value || '').trim()).filter(Boolean));
  };

  const haveCommonGroup = (a, b) => {
    const aSet = normalizeGroupSet(a);
    const bSet = normalizeGroupSet(b);
    for (const value of aSet) {
      if (bSet.has(value)) return true;
    }
    return false;
  };

  for (const placed of currentPlan) {
    if (!placed) continue;
    if (placed.day !== assignment.day) continue;

    const placedStartMs = parsePeriod(placed.data_rozpoczecia);
    const placedEndMs = parsePeriod(placed.data_zakonczenia);
    const assignStartMs = parsePeriod(assignment.data_rozpoczecia);
    const assignEndMs = parsePeriod(assignment.data_zakonczenia);

    const samePeriod = placedStartMs != null && placedEndMs != null && assignStartMs != null && assignEndMs != null
      && !(placedEndMs < assignStartMs || assignEndMs < placedStartMs);

    const placedEnd = placed.start + placed.duration;
    const assignmentEnd = assignment.start + assignment.duration;
    const gapAfter = assignment.start - placedEnd;
    const gapBefore = placed.start - assignmentEnd;
    const exactAdjacent = gapAfter === 0 || gapBefore === 0;
    const shortGap = (gapAfter > 0 && gapAfter <= 15) || (gapBefore > 0 && gapBefore <= 15);

    if (!exactAdjacent && !shortGap) continue; // Rozważaj tylko sąsiadujące lub z krótką przerwą elementy od tego miejsca.

    // Reguła: Dwa różne typy zajęć z okresami, od różnych wykładowców,
    // ale z tą samą dostępnością, powinny stać obok siebie.
    const hasPeriods = (item) => item.data_rozpoczecia != null && item.data_zakonczenia != null;
    const areDifferentTypes = (placed, assignment) => placed.type !== assignment.type;

    if (
      placed.lecturerId != null && assignment.lecturerId != null && placed.lecturerId !== assignment.lecturerId &&
      hasPeriods(placed) && hasPeriods(assignment) &&
      areDifferentTypes(placed, assignment) &&
      isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId)
    ) {
      if (exactAdjacent) {
        score += 10000; // Bardzo silny bonus za dokładne sąsiedztwo
      } else if (shortGap) {
        score += 9500; // Silny bonus za krótką przerwę
      }
      continue; // Zastosowano tę regułę, przejdź do następnego elementu
    }


    // Reguła: Zajęcia typu "wykład/laboratorium" dla tego samego przedmiotu powinny być obok siebie.
    // To jest silniejszy priorytet, ponieważ często reprezentują one jedną, podzieloną całość.
    const isWykLab = (item) => (item.type || '').trim().toLowerCase() === 'wykład/laboratorium';
    const sameSubject = placed.subjectId != null && placed.subjectId === assignment.subjectId;

    if (isWykLab(placed) && isWykLab(assignment) && sameSubject) {
      if (exactAdjacent) {
        score += 20000;
      } else if (shortGap) {
        score += 19500; // Nieco mniejszy bonus za przerwę, ale wciąż ogromny.
      }
      continue; // Zastosowano regułę, przejdź do następnego.
    }

    // Reguła: jeśli różni wykładowcy mają tę samą dostępność dla tego samego slotu,
    // preferuj ustawienie ich zajęć obok siebie, ale tylko gdy nie są to konflikty
    // zasobów ani gdy nie istnieje silniejszy powód do innego rozmieszczenia.
    const sameAvailability = isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId);
    if (sameAvailability && (exactAdjacent || shortGap)) {
      if (exactAdjacent) {
        score += 2000;
      } else if (shortGap) {
        score += 1800;
      }
    }

    // Classes from different active periods but the same reported availability
    // should be packed next to each other as one continuous teaching segment.
    const differentPeriodSameAvailability = sameAvailability && !samePeriod;
    if (differentPeriodSameAvailability && (exactAdjacent || shortGap)) {
      score += exactAdjacent ? 50000 : 48000;
      continue;
    }

    const sameLecturer = placed.lecturerId != null && placed.lecturerId === assignment.lecturerId;
    const sameType = (placed.type || '').trim().toLowerCase() === (assignment.type || '').trim().toLowerCase();
    const commonStudents = haveCommonStudents(placed.students, assignment.students);
    const commonGroup = haveCommonGroup(placed.group, assignment.group);
    const sameLecturerSameSegment = sameLecturer && isInSameAvailabilitySegment(placed, assignment, availabilityByLecturerId);
    const sameLecturerSamePeriodSegment = sameLecturer && samePeriod && currentMode === 'STAC' && isInSameAvailabilitySegment(placed, assignment, availabilityByLecturerId);
    const differentPeriodSameSegment = !samePeriod && (
      sameLecturerSameSegment ||
      sameAvailability
    );

    if (differentPeriodSameSegment && (exactAdjacent || shortGap)) {
      score += exactAdjacent ? 100000 : 98000;
      continue;
    }

    const sharedAvailabilityBlock = ((sameLecturer && sameLecturerSameSegment) || isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId))
      && (exactAdjacent || shortGap)
      && !samePeriod;

    if (sharedAvailabilityBlock) {
      if (exactAdjacent) score += 70000;
      else if (shortGap) score += 68000;
      continue;
    }

    if (sameLecturerSameSegment && (exactAdjacent || shortGap) && !samePeriod) {
      if (exactAdjacent) score += 61000;
      else if (shortGap) score += 59500;
      continue;
    }

    if (samePeriod) {
      if (sameLecturerSamePeriodSegment) {
        const gap = gapAfter >= 0 ? gapAfter : gapBefore;
        if (gap === 15) score += 3000;
        else if (gap === 0) score -= 2000;
        else score -= Math.abs(gap - 15) * 60;
        continue;
      }

      if (sameLecturer) {
        if (exactAdjacent) score += 65200; // Było 15200 + 50000
        else if (shortGap) score += 63800; // Było 14800 + 49000
      } else if (commonStudents || commonGroup) {
        if (exactAdjacent) score += 58200; // Było 13200 + 45000
        else if (shortGap) score += 56800; // Było 12800 + 44000
      } else {
        // Jeśli zajęcia są z tego samego okresu, ale dla różnych wykładowców i grup,
        // wciąż powinny być silnie grupowane, niezależnie od typu.
        if (exactAdjacent) score += 49200; // Było 9200 + 40000
        else if (shortGap) score += 47800; // Było 8800 + 39000
      }
      continue;
    }

    if (commonStudents || commonGroup) {
      // Dla tej samej grupy studentów, preferowane jest umieszczenie zajęć bezpośrednio obok siebie.
      // Zwiększono bonus, aby był on głównym czynnikiem promującym zwarte bloki dla studentów.
      if (exactAdjacent) {
        score += 38500; // Było 8500 + 30000
      } else if (shortGap) {
        score += 37000; // Było 8000 + 29000
      }
      continue;
    }

    // Reguła: Jeśli dwa zajęcia tego samego wykładowcy znajdują się w tym samym ciągłym
    // segmencie jego dostępności, przerwa między nimi powinna wynosić dokładnie 15 minut.
    // Ta reguła powinna być stosowana tylko, jeśli nie ma priorytetu samePeriod.
    if (sameLecturer) {
      const availability = getBestLecturerAvailability(assignment.lecturerId, assignment, availabilityByLecturerId, preferences);
      if (availability) {
        const daySegmentRanges = availability.segmentRanges?.[assignment.day] || [];
        let inSameSegment = false;
        for (const segment of daySegmentRanges) {
          const placedInSegment = placed.start >= segment.start && (placed.start + placed.duration) <= segment.end;
          const assignmentInSegment = assignment.start >= segment.start && (assignment.start + assignment.duration) <= segment.end;
          if (placedInSegment && assignmentInSegment) {
            inSameSegment = true;
            break;
          }
        }

        if (inSameSegment) {
          const gap = gapAfter >= 0 ? gapAfter : gapBefore; // Zakładając brak overlapu, jeden będzie dodatni (przerwa)
          if (gap === 15) {
            score += 3000; // Bardzo silny bonus za preferowaną 15-minutową przerwę.
          } else if (gap === 0) {
            score -= 2000; // Duża kara za brak przerwy wewnątrz segmentu.
          } else {
            score -= Math.abs(gap - 15) * 60; // Zwiększona kara proporcjonalna do odchylenia od 15 minut.
          }
          // Usunięto 'continue', aby umożliwić zastosowanie kolejnych, ważniejszych reguł (np. commonGroup).
        }
      }
    }

    // Bonus: different lecturers who both declared availability for the same slot
    // should be placed next to each other when possible.
    const differentLecturerSameAvailability = (exactAdjacent || shortGap)
      && isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId);

    if (differentLecturerSameAvailability) {
      // Zmniejszono bonus, aby nie konkurował z silniejszymi regułami jak `samePeriod` czy `commonGroup`.
      // Zwiększono bonus, aby silniej promować grupowanie różnych zajęć, w tym typu wykład/laboratorium.
      score += exactAdjacent ? 8000 : 7500;
    }
  }

  return score;
};

const isInSameAvailabilitySegment = (placed, assignment, availabilityByLecturerId) => {
  if (!placed || !assignment) return false;
  if (placed.lecturerId == null || assignment.lecturerId == null || placed.lecturerId !== assignment.lecturerId) return false;
  if (placed.day !== assignment.day) return false;

  const lecturerAvailability = availabilityByLecturerId?.[assignment.lecturerId];
  if (!lecturerAvailability) return false;

  for (const availability of Object.values(lecturerAvailability)) {
    if (!availability || !availability.segmentRanges) continue;

    const dayRanges = availability.segmentRanges[assignment.day] || [];
    for (const segment of dayRanges) {
      const placedInSegment = placed.start >= segment.start && (placed.start + placed.duration) <= segment.end;
      const assignmentInSegment = assignment.start >= segment.start && (assignment.start + assignment.duration) <= segment.end;
      if (placedInSegment && assignmentInSegment) {
        return true;
      }
    }
  }

  return false;
};

const canPlace = (assignment, currentPlan, availabilityByLecturerId = {}, preferences = {}, assignmentsByDay = null) => {
  const currentMode = preferences?.studyMode === 'NSTAC' ? 'NSTAC' : 'STAC';
  const breakMinutes = 15;
  const sameDayAssignments = assignmentsByDay?.get(assignment.day) || getAssignmentsByDay(currentPlan).get(assignment.day) || [];

  const hasAssignedGroup = (item) => {
    if (Array.isArray(item?.group)) {
      return item.group.some((group) => String(group || '').trim() !== '');
    }
    return String(item?.group || '').trim() !== '';
  };

  // Limit simultaneous ungrouped classes so missing group assignments do not
  // make an arbitrary number of classes occupy the same time slot.
  if (!hasAssignedGroup(assignment)) {
    const assignmentEnd = assignment.start + assignment.duration;
    const simultaneousUngroupedCount = sameDayAssignments.filter((placed) => {
      if (hasAssignedGroup(placed)) return false;
      const placedEnd = placed.start + placed.duration;
      return placed.start < assignmentEnd && assignment.start < placedEnd;
    }).length;

    if (simultaneousUngroupedCount >= 3) return false;
  }

  for (const placed of sameDayAssignments) {

    const placedEnd = placed.start + placed.duration;
    const assignmentEnd = assignment.start + assignment.duration;
    const overlap = Math.max(placed.start, assignment.start) < Math.min(placedEnd, assignmentEnd);
    const tooClose = (assignment.start >= placedEnd && assignment.start < placedEnd + breakMinutes) ||
      (placed.start >= assignmentEnd && placed.start < assignmentEnd + breakMinutes);

    // Allow adjacency (no conflict) when two classes are from the same lecturer
    // and belong to the same period (data_rozpoczecia/data_zakonczenia).
    const sameLecturer = placed.lecturerId != null && placed.lecturerId === assignment.lecturerId;
    const parsePeriod = (val) => {
      try {
        if (!val) return null;
        const d = new Date(val);
        return Number.isFinite(d.getTime()) ? d.getTime() : null;
      } catch (e) {
        return null;
      }
    };
    const placedStartMs = parsePeriod(placed.data_rozpoczecia);
    const placedEndMs = parsePeriod(placed.data_zakonczenia);
    const assignStartMs = parsePeriod(assignment.data_rozpoczecia);
    const assignEndMs = parsePeriod(assignment.data_zakonczenia);
    const samePeriod = placedStartMs != null && placedEndMs != null && assignStartMs != null && assignEndMs != null
      && !(placedEndMs < assignStartMs || assignEndMs < placedStartMs);

    const commonGroup = (() => {
      const normalizeGroupSet = (groupValue) => {
        if (groupValue == null) return new Set();
        const raw = Array.isArray(groupValue) ? groupValue.join(',') : String(groupValue);
        const items = raw.split(/\s*[,+\/;&]\s*/);
        return new Set(items.map((value) => String(value || '').trim()).filter(Boolean));
      };

      const aSet = normalizeGroupSet(placed.group);
      const bSet = normalizeGroupSet(assignment.group);
      for (const value of aSet) {
        if (bSet.has(value)) return true;
      }
      return false;
    })();

    const commonStudents = (() => {
      if (!placed.students || !assignment.students || !(placed.students instanceof Set) || !(assignment.students instanceof Set)) {
        return false;
      }
      const [smallerSet, largerSet] = placed.students.size < assignment.students.size
        ? [placed.students, assignment.students]
        : [assignment.students, placed.students];
      for (const studentId of smallerSet) {
        if (largerSet.has(studentId)) return true;
      }
      return false;
    })();

    // A lecturer can never conduct two overlapping classes, regardless of
    // period, availability segment, group, or class type.
    if (overlap && sameLecturer) {
      return false;
    }

    const exactAdjacent = assignment.start === placedEnd || placed.start === assignmentEnd;
    const gapAfter = assignment.start - placedEnd;
    const gapBefore = placed.start - assignmentEnd;
    const shortGap = (gapAfter > 0 && gapAfter <= breakMinutes) || (gapBefore > 0 && gapBefore <= breakMinutes);
    const sameLecturerSameSegment = sameLecturer && isInSameAvailabilitySegment(placed, assignment, availabilityByLecturerId);
    const sameLecturerSamePeriodSegment = sameLecturer && samePeriod && currentMode === 'STAC' && isInSameAvailabilitySegment(placed, assignment, availabilityByLecturerId);
    const sameStartSameAvailabilityBlock = placed.day === assignment.day
      && placed.start === assignment.start
      && !samePeriod
      && ((sameLecturer && sameLecturerSameSegment) || (placed.lecturerId != null && assignment.lecturerId != null && placed.lecturerId !== assignment.lecturerId && isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId)));

    if (sameLecturerSamePeriodSegment && exactAdjacent) {
      return false;
    }

    if (sameStartSameAvailabilityBlock) {
      return false;
    }

    // If two different lecturers reported the same availability, allow their classes
    // to stand directly next to each other or with a short standard break.
    const differentLecturerSameAvailability = (exactAdjacent || shortGap)
      && isDifferentLecturerSameAvailability(placed, assignment, availabilityByLecturerId);
    const lectureLabPairPlacement = (exactAdjacent || shortGap)
      && isLectureLaboratoryType(placed)
      && isLectureLaboratoryType(assignment)
      && (sameLecturer || samePeriod || commonGroup || commonStudents || differentLecturerSameAvailability);

    const sameSubjectPairPlacement = (exactAdjacent || shortGap)
      && placed.subjectId != null
      && assignment.subjectId != null
      && placed.subjectId === assignment.subjectId;

    const allowAdjacent = ((exactAdjacent && !sameLecturerSamePeriodSegment) || shortGap)
      && (commonGroup || commonStudents || samePeriod || sameLecturerSameSegment || sameSubjectPairPlacement || (sameLecturer && samePeriod) || differentLecturerSameAvailability || lectureLabPairPlacement);
    const closeButNotAdjacent = tooClose && !exactAdjacent;
    const timeConflict = overlap || (closeButNotAdjacent && !allowAdjacent);

    if (timeConflict) {
      // Jeśli występuje konflikt czasowy, sprawdzamy, czy zasoby (wykładowca, sala, studenci) są współdzielone.
      // Jeśli nie są, zajęcia mogą odbywać się w tym samym czasie.

      // Konflikt wykładowcy
      if (placed.lecturerId != null && placed.lecturerId === assignment.lecturerId) {
        return false;
      }

      // Konflikt sali
      if (placed.roomId != null && placed.roomId === assignment.roomId) {
        return false;
      }

      // Konflikt studentów
      if (haveCommonStudents(placed.students, assignment.students)) {
        return false;
      }

      // Konflikt na poziomie semestru (wykład ogólny vs inne zajęcia)
      const assignmentSemesters = getPlannerEquivalentSemesters(assignment.semestr);
      const placedSemesters = getPlannerEquivalentSemesters(placed.semestr);
      const semestersIntersection = placedSemesters.filter(s => assignmentSemesters.includes(s));

      if (semestersIntersection.length > 0) {
        const assignmentIsGeneralLecture = isLectureType(assignment) && (!assignment.specjalnosc || String(assignment.specjalnosc).trim() === '');
        const placedIsGeneralLecture = isLectureType(placed) && (!placed.specjalnosc || String(placed.specjalnosc).trim() === '');
        if (assignmentIsGeneralLecture || placedIsGeneralLecture) {
          return false;
        }
      }
    }
  }

  return true;
};

const calculatePreferenceStats = (plan = [], items = [], preferences = {}) => {
  const stats = { ok: 0, total: 0 };

  if (Array.isArray(preferences.preferredLecturerDays) && preferences.preferredLecturerDays.length > 0) {
    stats.total += plan.length;
    stats.ok += plan.filter((assignment) => preferences.preferredLecturerDays.includes(assignment.day)).length;
  }

  (items || []).forEach((item) => {
    if (item.preferredStart == null) return;
    stats.total += 1;
    const placedAssignment = plan.find((assignment) => assignment.courseId === item.id);
    if (placedAssignment && placedAssignment.start === item.preferredStart) {
      stats.ok += 1;
    }
  });

  if (preferences.lecturerPreferences && preferences.timeAndDayToSlotId) {
    plan.forEach((assignment) => {
      const lecturerPrefs = preferences.lecturerPreferences[assignment.lecturerId];
      const daySlots = preferences.timeAndDayToSlotId[assignment.day];
      const slotId = daySlots?.[assignment.start];
      if (!lecturerPrefs || slotId == null) return;

      stats.total += 1;
      if ((Number(lecturerPrefs[slotId]) || 0) === 0) {
        stats.ok += 1;
      }
    });
  }

  if (preferences.availabilityByLecturerId) {
    plan.forEach((assignment) => {
      if (!hasUsableLecturerAvailability(
        assignment.lecturerId,
        assignment,
        preferences.availabilityByLecturerId,
        preferences
      )) return;

      stats.total += 1;
      if (isLecturerAvailable(
        assignment.lecturerId,
        assignment,
        assignment.day,
        assignment.start,
        assignment.duration,
        preferences.availabilityByLecturerId,
        preferences
      )) {
        stats.ok += 1;
      }
    });
  }

  return stats;
};

const calculatePlanStats = (plan, items, preferences) => {
  // 1. Oblicz całkowitą liczbę zapisów studentów na zajęcia, które miały być zaplanowane.
  let totalStudentAssignments = 0;
  (items || []).forEach(item => {
    if (item.students && item.students.size > 0) {
      totalStudentAssignments += item.students.size;
    }
  });

  // 2. Jeśli nie ma żadnych zapisów studentów, użyj prostej metryki (liczba zaplanowanych zajęć).
  if (totalStudentAssignments === 0) {
    const scheduledCount = (plan || []).length;
    const totalItems = (items || []).length;
    const stats = {
      hard: { ok: scheduledCount, total: totalItems },
      soft: { ok: 0, total: 0 },
      prefs: calculatePreferenceStats(plan, items, preferences),
      studentConflicts: { count: 0, totalStudents: 0 },
    };
    const percentages = {
      hardOkPct: stats.hard.total > 0 ? Math.round((stats.hard.ok / stats.hard.total) * 100) : 100,
      softOkPct: 100,
      preferredOkPct: stats.prefs.total > 0 ? Math.round((stats.prefs.ok / stats.prefs.total) * 100) : 100,
    };
    return { ...stats, ...percentages };
  }

  // 3. Jeśli są studenci, kontynuuj z logiką opartą na studentach.
  const allStudents = new Set();
  const studentSchedulesInPlan = {};
  (plan || []).forEach(assignment => {
    if (assignment.students) {
      assignment.students.forEach(studentId => {
        allStudents.add(studentId);
        if (!studentSchedulesInPlan[studentId]) {
          studentSchedulesInPlan[studentId] = [];
        }
        studentSchedulesInPlan[studentId].push(assignment);
      });
    }
  });

  // 4. Znajdź konflikty wewnątrz faktycznie zaplanowanych zajęć.
  const studentsWithConflicts = new Set();
  const conflictingStudentAssignments = new Set();

  for (const studentId in studentSchedulesInPlan) {
    const schedule = studentSchedulesInPlan[studentId];
    if (schedule.length < 2) continue;

    for (let i = 0; i < schedule.length; i += 1) {
      for (let j = i + 1; j < schedule.length; j += 1) {
        const a1 = schedule[i];
        const a2 = schedule[j];

        if (a1.day !== a2.day) continue;

        const end1 = a1.start + a1.duration;
        const end2 = a2.start + a2.duration;
        if (Math.max(a1.start, a2.start) < Math.min(end1, end2)) {
          studentsWithConflicts.add(studentId);
          conflictingStudentAssignments.add(`${studentId}-${a1.courseId}`);
          conflictingStudentAssignments.add(`${studentId}-${a2.courseId}`);
        }
      }
    }
  }

  // 5. Oblicz liczbę zapisów studentów dla niezaplanowanych zajęć.
  const scheduledItemIds = new Set((plan || []).map(a => a.courseId));
  let unscheduledStudentAssignments = 0;
  (items || []).forEach(item => {
    if (!scheduledItemIds.has(item.id) && item.students) {
      unscheduledStudentAssignments += item.students.size;
    }
  });

  // 6. Oblicz ostateczne statystyki.
  const totalHardConflicts = conflictingStudentAssignments.size + unscheduledStudentAssignments;
  const hardOkCount = totalStudentAssignments - totalHardConflicts;

    const stats = {
      hard: { ok: hardOkCount, total: totalStudentAssignments },
      soft: { ok: 0, total: 0 },
      prefs: calculatePreferenceStats(plan, items, preferences),
      studentConflicts: { count: studentsWithConflicts.size, totalStudents: allStudents.size },
  };

  // Soft: Late hours
  if (preferences?.latePreference > 0) {
      stats.soft.total += plan.length;
      plan.forEach(assignment => {
          const hourIndex = assignment.start / 60;
          if (hourIndex < 17) { // Not late is before 5 PM
              stats.soft.ok++;
          }
      });
  }

  // Soft: Windows
  if (preferences?.windowPreference > 0) {
      const breakMinutes = (preferences && preferences.studyMode !== 'STAC') ? 8 : 15;
      for (const day of weekdays) {
          const dayAssignments = plan.filter(item => item.day === day).sort((a, b) => a.start - b.start);
          const gaps = dayAssignments.length > 0 ? dayAssignments.length - 1 : 0;
          stats.soft.total += gaps;
          stats.soft.ok += Math.max(0, gaps - calculateBadGaps(dayAssignments, breakMinutes));
      }
  }

  const percentages = {
      hardOkPct: stats.hard.total > 0 ? Math.round((stats.hard.ok / stats.hard.total) * 100) : 100,
      softOkPct: stats.soft.total > 0 ? Math.max(0, Math.round((stats.soft.ok / stats.soft.total) * 100)) : 100,
      preferredOkPct: stats.prefs.total > 0 ? Math.round((stats.prefs.ok / stats.prefs.total) * 100) : 100,
  };

  return { ...stats, ...percentages };
};
const buildSelectionResults = (allItems = [], dedupedPlan = [], bigUnscheduledItems = [], selectedSemesters = [], preferences = {}) => {
  const results = {};
  let uniqueSemesterSelections = Array.isArray(selectedSemesters) ? [...new Set(selectedSemesters)] : [];

  const finalSelections = uniqueSemesterSelections;

  finalSelections.sort((a, b) => {
    const aIsGeneral = a.endsWith('|');
    const bIsGeneral = b.endsWith('|');
    if (aIsGeneral && !bIsGeneral) return -1;
    if (!aIsGeneral && bIsGeneral) return 1;
    return a.localeCompare(b);
  });

  const createPlanView = (label, items, plan, unscheduledItems, prefs) => {
    const selectionItemKeys = new Set(items.map((item) => item.id));
    const selectionPlanPart = (plan || []).filter((assignment) => selectionItemKeys.has(assignment.courseId));
    const selectionUnscheduledPart = (unscheduledItems || []).filter((item) => selectionItemKeys.has(item.id));

    const columnWidths = {};
    const activeDays = new Set();
    const polishWeekdaysOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    if (selectionPlanPart.length > 0) {
      const dayClasses = {};
      selectionPlanPart.forEach(item => {
        const day = dayLabels[item.day] || item.day;
        if (!dayClasses[day]) {
          activeDays.add(day);
          dayClasses[day] = [];
        }
        dayClasses[day].push({ start: item.start, duration: item.duration });
      });

      Object.keys(dayClasses).forEach(day => {
        const classesOnDay = dayClasses[day].sort((a, b) => a.start - b.start);
        const slots = {};
        classesOnDay.forEach(c => {
          if (!slots[c.start]) slots[c.start] = 0;
          slots[c.start]++;
        });
        const maxHorizontal = Object.values(slots).reduce((max, count) => Math.max(max, count), 0);

        let maxVertical = 0;
        if (classesOnDay.length > 0) {
          maxVertical = 1;
          let currentVertical = 1;
          for (let i = 1; i < classesOnDay.length; i++) {
            const prev = classesOnDay[i - 1];
            const current = classesOnDay[i];
            const prevEnd = prev.start + prev.duration;
            if (current.start === prevEnd || current.start === prevEnd + 15) {
              currentVertical++;
            } else {
              currentVertical = 1;
            }
            maxVertical = Math.max(maxVertical, currentVertical);
          }
        }

        columnWidths[day] = (maxHorizontal >= 3 || maxVertical >= 3) ? 'wide' : 'normal';
      });
    }

    const stats = calculatePlanStats(selectionPlanPart, items, prefs);

    const planView = selectionPlanPart.map((assignment) => ({
      courseId: assignment.courseId,
      day: dayLabels[assignment.day] || assignment.day,
      time: `${formatTime(assignment.start)} - ${formatTime(assignment.start + assignment.duration)}`,
      name: assignment.name.length > 40 ? `${assignment.name.substring(0, 37)}...` : assignment.name,
      nameTitle: assignment.name,
      fullName: assignment.name,
      lecturer: assignment.lecturer,
      room: assignment.room,
      roomId: assignment.roomId,
      type: assignment.type,
      duration: formatDuration(assignment.duration),
      group: assignment.group,
      data_rozpoczecia: assignment.data_rozpoczecia,
      data_zakonczenia: assignment.data_zakonczenia,
      specjalnosc: assignment.specjalnosc,
    }));

    results[label] = {
      plan: planView,
      unscheduled: selectionUnscheduledPart,
      stats,
      columnWidths,
      activeDays: [...activeDays].sort((a, b) => polishWeekdaysOrder.indexOf(a) - polishWeekdaysOrder.indexOf(b)),
    };
  };

  const selectionsBySemMode = new Map();
  for (const selection of finalSelections) {
      const [sem, mode] = selection.split('|');
      const key = `${sem}|${mode || 'STAC'}`;
      if (!selectionsBySemMode.has(key)) {
          selectionsBySemMode.set(key, []);
      }
      selectionsBySemMode.get(key).push(selection);
  }

  const normalizeSpecSet = (specString) => {
      return new Set(String(specString || '').split('+').map((part) => part.trim()).filter(Boolean));
  };

  const isSubset = (subset, superset) => {
      for (const value of subset) {
          if (!superset.has(value)) return false;
      }
      return true;
  };

  const getSelectionPredicate = (selection) => {
      const [semestrNum, tryb, specjalnosc] = selection.split('|');
      const selectionSemesters = getPlannerEquivalentSemesters(semestrNum);
      const filterSpec = String(specjalnosc || '').trim();
      const selectionMode = normalizeStudyMode(tryb || 'STAC');
      const filterSpecsSet = normalizeSpecSet(filterSpec);

      return (item) => {
          const itemSemesters = getPlannerEquivalentSemesters(item.semestr);
          if (!itemSemesters.some((num) => selectionSemesters.includes(num))) return false;

          const itemMode = normalizeStudyMode(item.tryb);
          if (itemMode !== selectionMode) return false;

          const itemSpec = String(item.specjalnosc || '').trim();
          if (!filterSpec) return true;
          if (!itemSpec) return true;

          const itemSpecsSet = normalizeSpecSet(itemSpec);
          return [...itemSpecsSet].every((spec) => filterSpecsSet.has(spec));
      };
  };

  for (const [groupKey, selectionsInGroup] of selectionsBySemMode.entries()) {
      const [groupSem, groupMode] = groupKey.split('|');
      const selectionMeta = selectionsInGroup.map((selection) => {
          const [,, specjalnosc] = selection.split('|');
          return {
              selection,
              specSet: normalizeSpecSet(specjalnosc),
              filterSpec: String(specjalnosc || '').trim(),
          };
      });

      const specSelections = selectionMeta.filter(({ specSet }) => specSet.size > 0);
      const generalSelection = selectionMeta.find(({ specSet }) => specSet.size === 0);
      const selectionPreferences = { ...preferences, studyMode: groupMode };

      const createViewForSelection = (selection) => {
          const items = (allItems || []).filter(getSelectionPredicate(selection));
          const [, tryb, specjalnosc] = selection.split('|');
          const label = `${groupSem}|${specjalnosc || 'Ogólne'}|${tryb || 'STAC'}`;
          createPlanView(label, items, dedupedPlan, bigUnscheduledItems, selectionPreferences);
      };

      const hasSupersetRelation = specSelections.some((outer) =>
          specSelections.some((inner) => outer !== inner && isSubset(inner.specSet, outer.specSet))
      );

      if (specSelections.length === 0) {
          createViewForSelection(selectionsInGroup[0]);
      } else if (specSelections.length === 1 && generalSelection) {
          createViewForSelection(specSelections[0].selection);
      } else if (!hasSupersetRelation && specSelections.length > 1) {
          const combinedSpecSet = new Set();
          specSelections.forEach(({ specSet }) => specSet.forEach((part) => combinedSpecSet.add(part)));
          const specs = [...combinedSpecSet].sort().join('+');
          const label = `${groupSem}|${specs || 'Ogólne (połączone)'}|${groupMode}`;
          const combinedItems = new Map();
          selectionsInGroup.forEach((selection) => {
              const predicate = getSelectionPredicate(selection);
              (allItems || []).forEach((item) => {
                  if (!combinedItems.has(item.id) && predicate(item)) {
                      combinedItems.set(item.id, item);
                  }
              });
          });
          createPlanView(label, Array.from(combinedItems.values()), dedupedPlan, bigUnscheduledItems, selectionPreferences);
      } else {
          selectionMeta.forEach(({ selection }) => {
              if (selection === generalSelection?.selection && specSelections.length > 0) {
                  return;
              }
              createViewForSelection(selection);
          });
      }
  }
  return results;
};

const getDaySlots = (allowedSlotsByDay, day) => { // eslint-disable-line no-unused-vars
  if (Array.isArray(allowedSlotsByDay)) return allowedSlotsByDay;
  if (allowedSlotsByDay && Array.isArray(allowedSlotsByDay[day])) return allowedSlotsByDay[day];
  if (allowedSlotsByDay && allowedSlotsByDay[day]) return allowedSlotsByDay[day];
  return [];
};

const getCandidateStarts = (day, allowedSlotsByDay, endMinutes) => {
  const explicitSlots = getDaySlots(allowedSlotsByDay, day);
  const normalizedSlots = [...new Set((explicitSlots || [])
    .map((slot) => Number(slot))
    .filter((slot) => Number.isFinite(slot)))].sort((a, b) => a - b);

  if (normalizedSlots.length === 0) {
    const slots = [];
    for (let start = 0; start + 15 <= endMinutes; start += 15) {
      slots.push(start);
    }
    return slots;
  }

  const step = normalizedSlots.length > 1 ? normalizedSlots[1] - normalizedSlots[0] : null;
  const isDenseGrid = step === 15 && normalizedSlots.every((slot, index) => index === 0 || slot - normalizedSlots[index - 1] === step);

  if (!isDenseGrid) {
    return normalizedSlots;
  }

  const slots = new Set(normalizedSlots);
  const startBound = normalizedSlots[0] || 0;
  for (let start = startBound; start + 15 <= endMinutes; start += 15) {
    slots.add(start);
  }
  return [...slots].sort((a, b) => a - b);
};

const getItemPlacementCapacity = (item, allowedDays, allowedSlotsByDay, preferences, availabilityByLecturerId = {}, allowedRoomIds = [], endMinutes) => {
  let capacity = 0; // eslint-disable-line no-unused-vars

  for (const day of allowedDays) {
    const daySlots = getCandidateStarts(day, allowedSlotsByDay, endMinutes);
    for (const start of daySlots) {
      if (start + item.duration > endMinutes) continue;
      if (!isLecturerAvailable(item.lecturerId, item, day, start, item.duration, availabilityByLecturerId)) continue;

      const roomsToTry = allowedRoomIds && allowedRoomIds.length ? allowedRoomIds : [null];
      for (const roomId of roomsToTry) {
        if (item.roomId != null && item.roomId !== roomId) continue;
        capacity += 1;
      }
    }
  }

  return capacity;
};

const getCandidateStartsByDay = (allowedDays, allowedSlotsByDay, endMinutes) => Object.fromEntries(
  allowedDays.map((day) => [day, getCandidateStarts(day, allowedSlotsByDay, endMinutes)])
);

const getUsageStats = (plan, preferences) => {
  const dayUsage = Object.fromEntries(weekdays.map((day) => [day, 0]));
  const morningStartHourUsage = { 8: 0, 9: 0, 10: 0, 11: 0 };

  plan.forEach((assignment) => {
    dayUsage[assignment.day] += 1;
    if (preferences.studyMode === 'STAC') {
      const startHour = Math.floor(assignment.start / 60);
      if (morningStartHourUsage.hasOwnProperty(startHour)) {
        morningStartHourUsage[startHour] += 1;
      }
    }
  });

  return { dayUsage, morningStartHourUsage };
};

const buildAssignment = (item, day, start, roomId, roomNamesMap) => ({ // eslint-disable-line no-unused-vars
  courseId: item.id,
  sourceId: item.originalId ?? item.id,
  subjectId: item.subjectId,
  name: item.name,
  lecturer: item.lecturer,
  lecturerId: item.lecturerId,
  duration: item.duration,
  type: item.type,
  semestr: item.semestr,
  tryb: item.tryb,
  specjalnosc: item.specjalnosc,
  preferredStart: item.preferredStart,
  day,
  start,
  roomId,
  room: roomId != null ? (roomNamesMap[roomId]) || `Sala ${roomId}` : null,
  group: item.group,
  students: item.students,
  data_rozpoczecia: item.data_rozpoczecia,
  data_zakonczenia: item.data_zakonczenia,
});

const findPlacementAtSlot = (item, currentPlan, day, start, preferences, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, assignmentsByDay = null) => { // eslint-disable-line no-unused-vars
  if (start + item.duration > endMinutes) return null;
  const availability = getBestLecturerAvailability(item.lecturerId, item, availabilityByLecturerId, preferences);
  if (!isLecturerAvailable(item.lecturerId, item, day, start, item.duration, availabilityByLecturerId)) return null;

  const roomsToTry = allowedRoomIds && allowedRoomIds.length ? allowedRoomIds : [null];
  for (const roomId of roomsToTry) {
    if (item.roomId != null && item.roomId !== roomId) continue;
    const assignment = buildAssignment(item, day, start, roomId, roomNamesMap);
    if (canPlace(assignment, currentPlan, availabilityByLecturerId, preferences, assignmentsByDay)) {
      return { assignment, score: 0 };
    }
  }

  return null;
};

const findBestPlacement = (item, currentPlan, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, candidateStartsByDay = null, assignmentsByDay = null) => { // eslint-disable-line no-unused-vars
  const usage = getUsageStats(currentPlan, preferences);
  const usesReportedAvailability = hasUsableLecturerAvailability(item.lecturerId, item, availabilityByLecturerId, preferences);
  let best = null;
  const randomPlacements = [];

  for (const day of allowedDays) {
    const daySlots = candidateStartsByDay?.[day] || getCandidateStarts(day, allowedSlotsByDay, endMinutes);
    for (const start of daySlots) {
      const placement = findPlacementAtSlot(item, currentPlan, day, start, preferences, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, assignmentsByDay);
      if (!placement) continue;

      if (!usesReportedAvailability) {
        randomPlacements.push(placement);
        continue;
      }

      const score = scorePlacement(placement.assignment, currentPlan, preferences, usage.dayUsage, usage.morningStartHourUsage, availabilityByLecturerId, assignmentsByDay);
      const shouldPreferEarlierSlot = best
        && Math.abs(score - best.score) <= 250
        && placement.assignment.start < best.assignment.start;
      if (!best || score > best.score || shouldPreferEarlierSlot) {
        best = { ...placement, score };
      }
    }
  }

  if (!usesReportedAvailability && randomPlacements.length > 0) {
    return randomPlacements[Math.floor(Math.random() * randomPlacements.length)];
  }

  return best;
};

const MAX_REPAIR_CANDIDATES = 12;

const getCandidatePlacements = (item, currentPlan, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, candidateStartsByDay = null, assignmentsByDay = null) => {
  const usage = getUsageStats(currentPlan, preferences);
  const placements = [];

  for (const day of allowedDays) {
    const daySlots = candidateStartsByDay?.[day] || getCandidateStarts(day, allowedSlotsByDay, endMinutes);
    for (const start of daySlots) {
      const placement = findPlacementAtSlot(item, currentPlan, day, start, preferences, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, assignmentsByDay);
      if (!placement) continue;

      const score = scorePlacement(placement.assignment, currentPlan, preferences, usage.dayUsage, usage.morningStartHourUsage, availabilityByLecturerId, assignmentsByDay);
      placements.push({ ...placement, score });
    }
  }

  placements.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.assignment.day !== b.assignment.day) return weekdays.indexOf(a.assignment.day) - weekdays.indexOf(b.assignment.day);
    return a.assignment.start - b.assignment.start;
  });

  return placements.slice(0, MAX_REPAIR_CANDIDATES);
};

const tryBacktrackingSolve = (orderedItems, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, initialPlan = [], candidateStartsByDay = null) => {
  const maxNodes = 3000;
  let nodesVisited = 0;
  const assignmentsByDay = getAssignmentsByDay(initialPlan);

  const search = (index, currentPlan) => {
    if (nodesVisited >= maxNodes) return null;
    nodesVisited += 1;

    if (index >= orderedItems.length) {
      return currentPlan;
    }

    const item = orderedItems[index];
    const placements = getCandidatePlacements(item, currentPlan, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, candidateStartsByDay, assignmentsByDay);

    if (placements.length === 0) {
      return null;
    }

    for (const placement of placements) {
      const nextPlan = [...currentPlan, placement.assignment];
      assignmentsByDay.get(placement.assignment.day).push(placement.assignment);
      const resolved = search(index + 1, nextPlan);
      if (resolved) return resolved;
      assignmentsByDay.get(placement.assignment.day).pop();
    }

    return null;
  };

  return search(0, [...initialPlan]);
};

const solveSchedule = (items, allowedDays, allowedSlotsByDay, preferences, availabilityByLecturerId = {}, allowedRoomIds = [], roomNamesMap = {}, endMinutes) => {
  const plan = [];
  const unscheduled = [];
  const uniqueItems = deduplicateItems(items || []);
  const candidateStartsByDay = getCandidateStartsByDay(allowedDays, allowedSlotsByDay, endMinutes);
  const assignmentsByDay = new Map(allowedDays.map((day) => [day, []]));
  const capacityByItemId = new Map(uniqueItems.map((item) => [
    item.id,
    getItemPlacementCapacity(item, allowedDays, candidateStartsByDay, preferences, availabilityByLecturerId, allowedRoomIds, endMinutes),
  ]));

  const orderedItems = [...uniqueItems].sort((a, b) => { // eslint-disable-line
    const capacityA = capacityByItemId.get(a.id) || 0;
    const capacityB = capacityByItemId.get(b.id) || 0;

    if (capacityA !== capacityB) return capacityA - capacityB;

    // Priorytet dla grupowania przedmiotów, które należą do tego samego bloku.
    // To pomaga algorytmowi zachłannemu, przetwarzając powiązane elementy po kolei,
    // co daje szansę na zadziałanie bonusów za sąsiedztwo.
    const getBlockKey = (item) => {
      if (!item.data_rozpoczecia && !item.data_zakonczenia) return null;
      const lecturer = item.lecturerId || '';
      return `${item.data_rozpoczecia}|${item.data_zakonczenia}|${lecturer}`;
    };

    const blockKeyA = getBlockKey(a);
    const blockKeyB = getBlockKey(b);

    if (blockKeyA && blockKeyB) {
      if (blockKeyA !== blockKeyB) return blockKeyA.localeCompare(blockKeyB);
    } else if (blockKeyA) { return -1; } else if (blockKeyB) { return 1; }
    // Koniec logiki grupowania

    if (b.duration !== a.duration) return b.duration - a.duration;
    return (a.name || '').localeCompare(b.name || '');
  });

  const placedIds = new Set();
  for (const item of orderedItems) {
    const placement = findBestPlacement(item, plan, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, candidateStartsByDay, assignmentsByDay);
    if (placement) {
      plan.push(placement.assignment);
      assignmentsByDay.get(placement.assignment.day).push(placement.assignment);
      placedIds.add(item.id);
    }
  }

  const scheduledIds = new Set(plan.map((assignment) => assignment.courseId));
  const unscheduledItems = orderedItems.filter((item) => !scheduledIds.has(item.id));
  unscheduledItems.forEach((item) => {
    unscheduled.push({ id: item.id, name: item.name, type: item.type, lecturer: item.lecturer });
  });

  if (unscheduledItems.length > 0 && unscheduledItems.length <= 20) {
    const repairPlan = tryBacktrackingSolve(unscheduledItems, preferences, allowedDays, allowedSlotsByDay, availabilityByLecturerId, allowedRoomIds, roomNamesMap, endMinutes, [...plan], candidateStartsByDay);
    if (repairPlan && repairPlan.length >= plan.length) {
      const repairedAssignments = repairPlan.filter((assignment) => assignment != null);
      const repairedIds = new Set(repairedAssignments.map((assignment) => assignment.courseId));
      const repairedUnscheduled = orderedItems.filter((item) => !repairedIds.has(item.id));

      if (repairedUnscheduled.length < unscheduledItems.length) {
        plan.splice(0, plan.length, ...repairedAssignments);
        assignmentsByDay.clear();
        repairedAssignments.forEach((assignment) => {
          if (!assignmentsByDay.has(assignment.day)) assignmentsByDay.set(assignment.day, []);
          assignmentsByDay.get(assignment.day).push(assignment);
        });
        unscheduled.splice(0, unscheduled.length, ...repairedUnscheduled.map((item) => ({ id: item.id, name: item.name, type: item.type, lecturer: item.lecturer })));
        placedIds.clear();
        repairedAssignments.forEach((assignment) => placedIds.add(assignment.courseId));
      }
    }
  }

  plan.sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day) || a.start - b.start);
  return { plan: deduplicateAssignments(plan), unscheduled: deduplicateItems(unscheduled) };
};

const solveScheduleWithCpSat = async (items, allowedDays, allowedSlotsByDay, preferences, availabilityByLecturerId = {}, allowedRoomIds = [], roomNamesMap = {}, endMinutes) => {
  const { buildAndSolve } = await import('../routes/src/solver.js');
  const slots = [];
  let slotId = 1;

  for (const day of allowedDays) {
    for (const start of getCandidateStarts(day, allowedSlotsByDay, endMinutes)) {
      if (start + 15 > endMinutes) continue;
      slots.push({
        id: slotId++, dayOfWeek: day,
        startTime: formatTime(start), endTime: formatTime(start + 15),
      });
    }
  }

  const rooms = (allowedRoomIds || []).map((id) => ({ id, name: roomNamesMap[id] || `Sala ${id}` }));
  const solverItems = deduplicateItems(items || []).map((item) => ({
    id: item.id,
    przedmiot_id: item.subjectId,
    typ: item.type,
    wykladowca_id: item.lecturerId,
    grupa_id: Array.isArray(item.group) && item.group.length > 0 ? item.group.join('|') : item.id,
    durationMinutes: item.duration,
  }));

  const availability = {};
  const lecturerReportedSlots = new Map();
  Object.entries(availabilityByLecturerId || {}).forEach(([lecturerId, lecturerEntries]) => {
    const reportedSlots = new Set();
    Object.values(lecturerEntries || {}).forEach((entry) => {
      Object.keys(entry?.slots || {}).forEach((key) => {
        if (entry.slots[key] === true) reportedSlots.add(key);
      });
    });
    lecturerReportedSlots.set(Number(lecturerId), reportedSlots);
  });

  const adjacencyPairs = [];
  for (let firstIndex = 0; firstIndex < solverItems.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < solverItems.length; secondIndex += 1) {
      const first = solverItems[firstIndex];
      const second = solverItems[secondIndex];
      if (first.wykladowca_id == null || first.wykladowca_id === second.wykladowca_id) continue;
      const firstSlots = lecturerReportedSlots.get(Number(first.wykladowca_id)) || new Set();
      const secondSlots = lecturerReportedSlots.get(Number(second.wykladowca_id)) || new Set();
      if ([...firstSlots].some((slotKey) => secondSlots.has(slotKey))) {
        adjacencyPairs.push({ firstId: first.id, secondId: second.id });
      }
    }
  }

  solverItems.forEach((solverItem) => {
    const item = items.find((candidate) => candidate.id === solverItem.id);
    if (!item || solverItem.wykladowca_id == null) return;
    availability[solverItem.wykladowca_id] ||= {};
    slots.forEach((slot) => {
      if (!isLecturerAvailable(solverItem.wykladowca_id, item, slot.dayOfWeek, parseTime(slot.startTime), item.duration, availabilityByLecturerId, preferences)) {
        availability[solverItem.wykladowca_id][slot.id] = false;
      }
    });
  });

  const solved = await buildAndSolve({
    zajecia: solverItems,
    slots,
    rooms,
    availability,
    preferences: preferences.lecturerPreferences || {},
    adjacencyPairs,
    maxTimeSeconds: Number(preferences.maxTimeSeconds) || 50,
  });
  const itemById = new Map((items || []).map((item) => [item.id, item]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const plan = solved.planEntries.map((entry) => {
    const item = itemById.get(entry.zajecia_id);
    const slot = slotById.get(entry.slot_id);
    if (!item || !slot) return null;
    return {
      courseId: item.id,
      sourceId: item.originalId ?? item.id,
      subjectId: item.subjectId,
      name: item.name,
      lecturer: item.lecturer,
      lecturerId: item.lecturerId,
      duration: item.duration,
      type: item.type,
      semestr: item.semestr,
      tryb: item.tryb,
      specjalnosc: item.specjalnosc,
      preferredStart: item.preferredStart,
      day: slot.dayOfWeek,
      start: parseTime(slot.startTime),
      roomId: entry.sala_id,
      room: roomNamesMap[entry.sala_id] || `Sala ${entry.sala_id}`,
      group: item.group,
      students: item.students,
      data_rozpoczecia: item.data_rozpoczecia,
      data_zakonczenia: item.data_zakonczenia,
    };
  }).filter(Boolean);
  const scheduledIds = new Set(plan.map((assignment) => assignment.courseId));

  return {
    plan: deduplicateAssignments(plan),
    unscheduled: deduplicateItems((items || []).filter((item) => !scheduledIds.has(item.id)).map((item) => ({
      id: item.id, name: item.name, type: item.type, lecturer: item.lecturer,
    }))),
  };
};

const filterClassesForScheduling = (rows = [], options = {}) => {
  const subjectIds = toNumericIds(options?.subjectIds);
  const lecturerIds = toNumericIds(options?.lecturerIds);
  const parsedSemesterFilters = Array.isArray(options?.parsedSemesterFilters) ? options.parsedSemesterFilters : [];
  const studyMode = normalizeStudyMode(options?.studyMode);

  const matchingRows = rows.filter((row) => {
    const subjectMatches = subjectIds.length === 0 || subjectIds.includes(toSafeInteger(row?.idprzedmiotu));
    const lecturerMatches = lecturerIds.length === 0 || lecturerIds.includes(toSafeInteger(row?.wykladowca_id));
    if (!subjectMatches || !lecturerMatches) return false;
    return matchesCourseFilter(row, parsedSemesterFilters);
  });

  if (matchingRows.length > 0) {
    return matchingRows;
  }

  return rows.filter((row) => {
    const subjectMatches = subjectIds.length === 0 || subjectIds.includes(toSafeInteger(row?.idprzedmiotu));
    const lecturerMatches = lecturerIds.length === 0 || lecturerIds.includes(toSafeInteger(row?.wykladowca_id));
    if (!subjectMatches || !lecturerMatches) return false;

    const rowMode = normalizeStudyMode(row?.tryb);
    if (studyMode && rowMode && studyMode !== rowMode) return false;

    return true;
  });
};

async function generateAndSavePlan(options, pool) {
  let client;
  try {
    const {
      selectedDays = [],
      preferredLecturerDays = [],
      selectedSubjectIds = [],
      selectedLecturerIds = [],
      selectedRoomIds = [],
      selectedSemesters: incomingSemesters = [],
      lecturerPreferences = {},
      windowPreference = 50,
      latePreference = 50,
      spreadPreference = 50,
      studyMode = 'STAC',
      algorithm = 'heuristic',
      randomize,
      maxHour,
      opis,
      wygenerowany_przez,
    } = options || {};

    const selectedSemesters = Array.isArray(incomingSemesters) && incomingSemesters.length > 0
      ? incomingSemesters
      : (Array.isArray(options?.effectiveSelectedSemesters) ? options.effectiveSelectedSemesters : []);

    const allowedDays = Array.isArray(selectedDays) && selectedDays.length > 0
      ? selectedDays.map(normalizeDay).filter((day) => weekdays.includes(day))
      : (studyMode === 'STAC'
        ? ['Poniedzialek', 'Wtorek', 'Sroda', 'Czwartek', 'Piatek']
        : ['Piatek', 'Sobota', 'Niedziela']);

    const preferredDays = Array.isArray(preferredLecturerDays)
      ? preferredLecturerDays.map(normalizeDay).filter((day) => weekdays.includes(day))
      : [];

    const subjectIds = toNumericIds(selectedSubjectIds);
    const lecturerIds = toNumericIds(selectedLecturerIds);
    const roomIds = toNumericIds(selectedRoomIds);

    const parsedSemesterFilters = (Array.isArray(selectedSemesters) ? selectedSemesters : [])
      .map((value) => {
        if (typeof value !== 'string') return null;
        const [semestr, tryb, specjalnosc] = value.split('|');
        const normalizedSemestr = String(semestr || '').trim();
        const semestrs = normalizedSemestr
          ? getSemesterNumbers(normalizedSemestr)
          : [];
        const normalizedTryb = String(tryb || '').trim();
        const normalizedSpec = String(specjalnosc || '').trim();
        return { semestrs, tryb: normalizedTryb || null, specjalnosc: normalizedSpec || null };
      })
      .filter((filter) => Array.isArray(filter?.semestrs) && filter.semestrs.length > 0);

    // Jeśli użytkownik wybrał tylko jeden tryb studiów (np. same NSTAC),
    // użyj tego trybu jako głównego dla całego generowania. To szczególnie
    // ważne dla logiki fallback, która w razie braku dopasowań, będzie
    // szukać jakichkolwiek zajęć z tego trybu.
    const modesInSelection = new Set(parsedSemesterFilters.map(f => f.tryb).filter(Boolean));
    const effectiveStudyMode = modesInSelection.size === 1
      ? [...modesInSelection][0]
      : studyMode;

    const startMinutes = 8 * 60;
    const endMinutes = (maxHour ? Number(maxHour) : 22) * 60;
    const allowedSlotsByDay = {};

    for (const day of allowedDays) {
      allowedSlotsByDay[day] = buildSlots(startMinutes, endMinutes, 15);
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const planResult = await client.query(
      `INSERT INTO plan (data_utworzenia, opis, wygenerowany_przez, selected_semesters, study_mode)
       VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4)
       RETURNING id_plan`,
      [opis || 'Plan wygenerowany przez planistę', wygenerowany_przez || null, JSON.stringify(selectedSemesters || []), normalizeStudyMode(studyMode)]
    );
    const planId = planResult.rows[0].id_plan;

    const classesResult = await client.query(`
      SELECT z.idzajecia, z.czas, z.typ AS zajecia_typ, z.sala_id, z.data_rozpoczecia, z.data_zakonczenia,
             p.specjalnosc, p.idprzedmiotu, p.nazwa, p.semestr, p.ilosc_godz, p.tryb, z.dozwolone_dni,
             z.grupa, COALESCE(z.wykladowca_id, p.wykladowca_id) AS wykladowca_id,
             COALESCE(w.imie || ' ' || w.nazwisko, 'Brak wykładowcy') AS lecturer,
             array_agg(gd.nazwa) FILTER (WHERE gd.nazwa IS NOT NULL) AS grupy
      FROM zajecia z
      JOIN przedmiot p ON z.przedmiot_id = p.idprzedmiotu
      LEFT JOIN wykladowca w ON COALESCE(z.wykladowca_id, p.wykladowca_id) = w.idwykladowca
      LEFT JOIN zajecia_grupy zg ON z.idzajecia = zg.zajecia_id
      LEFT JOIN grupy_dziekanskie gd ON zg.grupa_id = gd.id_grupy
      GROUP BY z.idzajecia, p.idprzedmiotu, w.imie, w.nazwisko, p.specjalnosc
      ORDER BY z.idzajecia
    `);

    let classesFromDb = filterClassesForScheduling(classesResult.rows, {
      subjectIds,
      lecturerIds,
      parsedSemesterFilters,
      studyMode: effectiveStudyMode,
    });

    if (classesFromDb.length === 0) {
      const error = new Error('Brak zajęć pasujących do wybranych kryteriów.');
      error.isUserInputError = true;
      throw error;
    }

    const roomNamesMap = {};
    const timeAndDayToSlotId = {};
    const slotRows = await client.query('SELECT id_slot, day_of_week, start_time FROM slots');
    slotRows.rows.forEach((row) => {
      const day = normalizeDay(row.day_of_week);
      const start = parseTime(row.start_time);
      if (day && start != null) {
        if (!timeAndDayToSlotId[day]) timeAndDayToSlotId[day] = {};
        timeAndDayToSlotId[day][start] = toSafeInteger(row.id_slot);
      }
    });

    const finalRoomIds = roomIds.length > 0
      ? roomIds
      : (await client.query('SELECT id_sala FROM sala')).rows.map((row) => toSafeInteger(row.id_sala)).filter(Boolean);

    if (finalRoomIds.length > 0) {
      const roomRows = await client.query('SELECT id_sala, nazwa FROM sala WHERE id_sala = ANY($1::int[])', [finalRoomIds]);
      roomRows.rows.forEach((row) => {
        roomNamesMap[toSafeInteger(row.id_sala)] = row.nazwa;
      });
    }

    const availabilityByLecturerId = {};
    const lecturerIdsToLoad = lecturerIds.length > 0
      ? lecturerIds
      : [...new Set(classesFromDb.map((row) => toSafeInteger(row.wykladowca_id)).filter(Boolean))];

    const lecturerPreferencesFromDb = {};
    if (lecturerIdsToLoad.length > 0) {
      const preferenceRows = await client.query(
        'SELECT wykladowca_id, slot_id, waga_kary FROM preferencje_wykladowcy WHERE wykladowca_id = ANY($1::int[])',
        [lecturerIdsToLoad]
      );
      preferenceRows.rows.forEach((row) => {
        const lecturerId = toSafeInteger(row.wykladowca_id);
        const slotId = toSafeInteger(row.slot_id);
        if (lecturerId == null || slotId == null) return;
        if (!lecturerPreferencesFromDb[lecturerId]) lecturerPreferencesFromDb[lecturerId] = {};
        lecturerPreferencesFromDb[lecturerId][slotId] = Number(row.waga_kary) || 0;
      });
    }

    if (lecturerIdsToLoad.length > 0) {
      try {
        const currentAcademicYear = getCurrentAcademicYear();
        const availabilityRows = await client.query(
          'SELECT wykladowca_id, availability, semestr_numer, tryb_studiow, specjalnosc FROM wykladowca_availability WHERE wykladowca_id = ANY($1::int[]) AND rok_akademicki = $2',
          [lecturerIdsToLoad, currentAcademicYear]
        );

        for (const row of availabilityRows.rows) {
          const lecturerId = toSafeInteger(row.wykladowca_id);
          if (!lecturerId) continue;

          if (!availabilityByLecturerId[lecturerId]) {
            availabilityByLecturerId[lecturerId] = {};
          }

          const semKey = `${row.semestr_numer}|${normalizeStudyMode(row.tryb_studiow)}|${String(row.specjalnosc || '').trim()}`;
          const availability = row.availability && typeof row.availability === 'object' ? row.availability : {};
          const slots = {};
          const segmentStarts = {};
          const segmentRanges = {};

          for (const [day, dayConfig] of Object.entries(availability)) {
            const normalizedDay = normalizeDay(day);
            if (!normalizedDay || !dayConfig || typeof dayConfig !== 'object') continue;

            for (const segment of Array.isArray(dayConfig.segments) ? dayConfig.segments : []) {
              if (!segment?.start || !segment?.end) continue;
              const startMinutesValue = parseTime(segment.start);
              const endMinutesValue = parseTime(segment.end);
              if (startMinutesValue == null || endMinutesValue == null || endMinutesValue <= startMinutesValue) continue;

              if (!segmentRanges[normalizedDay]) {
                segmentRanges[normalizedDay] = [];
              }
              segmentRanges[normalizedDay].push({ start: startMinutesValue, end: endMinutesValue });

              for (let current = startMinutesValue; current < endMinutesValue; current += 15) {
                slots[`${normalizedDay}|${current}`] = true;
              }
            }
          }
          const mergedSegmentRanges = {};
          const mergedSegmentStarts = {};

          for (const [day, ranges] of Object.entries(segmentRanges)) {
            const sortedRanges = [...ranges].sort((a, b) => a.start - b.start);
            const merged = [];

            for (const range of sortedRanges) {
              const last = merged[merged.length - 1];
              if (!last || range.start > last.end) {
                merged.push({ ...range });
              } else if (range.end > last.end) {
                last.end = range.end;
              }
            }

            mergedSegmentRanges[day] = merged;
            mergedSegmentStarts[day] = new Set(merged.map((range) => range.start));
          }

          availabilityByLecturerId[lecturerId][semKey] = {
            explicit: true,
            slots,
            segmentStarts: mergedSegmentStarts,
            segmentRanges: mergedSegmentRanges,
          };
        }
      } catch (error) {
        console.warn('Could not load lecturer availability, proceeding without it.', error.message);
      }
    }

    let allItems = deduplicateItems(buildItemsFromRows(classesFromDb));

    const zajeciaIds = [...new Set(allItems.map((item) => item.originalId).filter((id) => id != null))];
    const enrollmentsByZajeciaId = {};
    if (zajeciaIds.length > 0) {
      const enrollmentsRes = await client.query('SELECT zajecia_id, student_id FROM grupa WHERE zajecia_id = ANY($1::int[])', [zajeciaIds]);
      for (const row of enrollmentsRes.rows) {
        const zajeciaId = toSafeInteger(row.zajecia_id);
        const studentId = toSafeInteger(row.student_id);
        if (zajeciaId == null || studentId == null) continue;
        if (!enrollmentsByZajeciaId[zajeciaId]) {
          enrollmentsByZajeciaId[zajeciaId] = new Set();
        }
        enrollmentsByZajeciaId[zajeciaId].add(studentId);
      }
    }

    allItems = allItems.map((item) => ({
      ...item,
      students: new Set(enrollmentsByZajeciaId[item.originalId] || []),
    }));

    const studentsByGroup = new Map();
    allItems.forEach((item) => {
      if (isLectureType(item)) return;
      let semNums = getSemesterNumbers(item.semestr);
      if (semNums.length === 1 && semNums[0] === '3') {
        semNums = ['5', '6'];
      }
      const spec = String(item.specjalnosc || '');
      semNums.forEach((sem) => {
        const key = `${sem}|${spec}`;
        if (!studentsByGroup.has(key)) {
          studentsByGroup.set(key, new Set());
        }
        item.students.forEach((studentId) => studentsByGroup.get(key).add(studentId));
      });
    });

    allItems = allItems.map((item) => {
      if (!isLectureType(item)) return item;
      let semNums = getSemesterNumbers(item.semestr);
      if (semNums.length === 1 && semNums[0] === '3') {
        semNums = ['5', '6'];
      }
      const lectureSpec = String(item.specjalnosc || '');
      const lectureStudents = new Set(item.students || []);

      semNums.forEach((sem) => {
        if (lectureSpec) {
          const specKey = `${sem}|${lectureSpec}`;
          const generalKey = `${sem}|`;
          studentsByGroup.get(specKey)?.forEach((studentId) => lectureStudents.add(studentId));
          studentsByGroup.get(generalKey)?.forEach((studentId) => lectureStudents.add(studentId));
        } else {
          for (const [key, studentSet] of studentsByGroup.entries()) {
            if (key.startsWith(`${sem}|`)) {
              studentSet.forEach((studentId) => lectureStudents.add(studentId));
            }
          }
        }
      });

      return { ...item, students: lectureStudents };
    });

    if (randomize) {
      allItems = shuffleArray(allItems);
    } else {
      allItems.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name));
    }

    const generationPreferences = {
      preferredLecturerDays: preferredDays,
      windowPreference: Number(windowPreference) || 50,
      latePreference: Number(latePreference) || 50,
      spreadPreference: Number(spreadPreference) || 50,
      lecturerPreferences: { ...lecturerPreferencesFromDb, ...(lecturerPreferences || {}) },
      timeAndDayToSlotId,
      availabilityByLecturerId,
      studyMode,
      selectedSemesters: [...new Set((Array.isArray(selectedSemesters) ? selectedSemesters : []).map((item) => String(item || '').trim()).filter(Boolean))],
      algorithm,
      maxTimeSeconds: Math.min(Math.max(Number(options?.maxTimeSeconds) || 8, 1), 15),
    };

    const solveResult = generationPreferences.algorithm === 'cp-sat'
      ? await solveScheduleWithCpSat(
        allItems, allowedDays, allowedSlotsByDay, generationPreferences,
        availabilityByLecturerId, finalRoomIds, roomNamesMap, endMinutes
      )
      : solveSchedule(
      allItems,
      allowedDays,
      allowedSlotsByDay,
      generationPreferences,
      availabilityByLecturerId,
      finalRoomIds,
      roomNamesMap,
      endMinutes
      );
    const { plan: bigRawPlan, unscheduled: bigUnscheduled } = solveResult;

    const dedupedPlan = bigRawPlan || [];

    if (dedupedPlan.length > 0) {
      const values = [];
      const placeholders = [];
      let index = 1;

      for (const entry of dedupedPlan) {
        const safeRoomId = toSafeInteger(entry.roomId)
        const safeZajeciaId = toSafeInteger(entry.sourceId ?? entry.courseId);
        if (safeZajeciaId == null) continue;

        const startTimeStr = formatTime(entry.start);
        const endTimeStr = formatTime(entry.start + entry.duration);
        values.push(planId, safeRoomId, safeZajeciaId, entry.day, startTimeStr, endTimeStr);
        placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5})`);
        index += 6;
      }

      if (placeholders.length > 0) {
        await client.query(
          `INSERT INTO plan_zajec (plan_id, sala_id, zajecia_id, day_of_week, start_time, end_time)
           VALUES ${placeholders.join(', ')}`,
          values
        );
      }
    }

    const allResults = {};
    const bigUnscheduledItems = bigUnscheduled || [];

    Object.assign(allResults, buildSelectionResults(allItems, dedupedPlan, bigUnscheduledItems, selectedSemesters, generationPreferences));

    const aggregatedStats = {}; // Aggregation logic can be added here if needed in the future.

    await client.query('INSERT INTO raport (plan_id_fk, zawartosc) VALUES ($1, $2)', [planId, JSON.stringify({ results: allResults, unscheduled: bigUnscheduledItems, stats: aggregatedStats })]);
    await client.query('COMMIT');
    return allResults;
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // ignore
      }
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

module.exports = {
  generateAndSavePlan,
  scorePlacement,
  canPlace,
  solveSchedule,
  calculatePlanStats,
  matchesCourseFilter,
  filterClassesForScheduling,
  buildSelectionResults,
};
