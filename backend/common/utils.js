const weekdays = ['Poniedzialek', 'Wtorek', 'Sroda', 'Czwartek', 'Piatek', 'Sobota', 'Niedziela'];

const dayLabels = {
  Poniedzialek: 'Poniedziałek',
  Wtorek: 'Wtorek',
  Sroda: 'Środa',
  Czwartek: 'Czwartek',
  Piatek: 'Piątek',
  Sobota: 'Sobota',
  Niedziela: 'Niedziela',
};

const legacyDayMap = {
  Poniedzialek: 'Poniedzialek',
  'Poniedziałek': 'Poniedzialek',
  'PoniedziaĹ‚ek': 'Poniedzialek',
  Wtorek: 'Wtorek',
  Sroda: 'Sroda',
  'Środa': 'Sroda',
  'Ĺšroda': 'Sroda',
  Czwartek: 'Czwartek',
  Piatek: 'Piatek',
  'Piątek': 'Piatek',
  'PiÄ…tek': 'Piatek',
  Sobota: 'Sobota',
  Niedziela: 'Niedziela',
};

const getSemesterNumbers = (s) => {
    if (s == null) return [];
    let str = String(s).trim().toLowerCase();
  
    const romanMap = {
      'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
      'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'
    };
    const semesterRegex = /(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g;
    const normalizeSemesterToken = (token) => {
      const normalized = String(token || '').trim().toLowerCase();
      if (romanMap[normalized]) return romanMap[normalized];
      const num = Number(normalized);
      return Number.isInteger(num) && num > 0 && num <= 12 ? String(num) : null;
    };
  
    // Case 1: "semestr X/Y" format, which means year X, semester Y. This is a single semester.
    const yearSemMatch = str.match(/semestr\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)\s*\/\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/i);
    if (yearSemMatch) {
      const semester = normalizeSemesterToken(yearSemMatch[2]);
      if (semester) return [semester];
    }
  
    // Case 1b: plain year/semester values like "3/5" or "2024/1" should be treated as semester Y.
    const simpleYearSemMatch = str.match(/^\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)\s*\/\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)\s*$/i);
    if (simpleYearSemMatch) {
      const semester = normalizeSemesterToken(simpleYearSemMatch[2]);
      if (semester) return [semester];
    }
  
    const isYearDesignation = str.includes('rok') && !/semestr|sem\./.test(str);
  
    // Case 3: String contains "semestr". Remove any "rok" declarations from it, as they are not part of the semester number.
    if (/semestr|sem\./.test(str)) {
      str = str.replace(/rok\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g, '');
    }
    
    const matches = str.match(semesterRegex);
  
    if (!matches) return [];
  
    let semesterNumbers = matches.map(match => normalizeSemesterToken(match)).filter(Boolean);
  
    if (isYearDesignation) {
        const expandedSemesters = new Set();
        semesterNumbers.forEach(yearNum => {
            if (yearNum === '2') {
                expandedSemesters.add('3');
                expandedSemesters.add('4');
            } else if (yearNum === '3') {
                expandedSemesters.add('5');
                expandedSemesters.add('6');
            }
            // Add other year mappings if needed in the future
        });
        semesterNumbers = Array.from(expandedSemesters);
    }
  
    return [...new Set(semesterNumbers)];
};

const parseTime = (time) => {
    if (typeof time !== 'string') return null;
    const [hh, mm] = time.split(':').map((part) => parseInt(part, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return hh * 60 + mm;
};
  
const formatTime = (minutes) => {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
};
  
const normalizeDay = (day) => legacyDayMap[day] || day;
  
const normalizeRoomId = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
};
  
const normalizeDurationMinutes = (value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) return 60;
    // Round up to the nearest 15 minutes to align with the scheduling grid.
    return Math.max(15, Math.ceil(numberValue / 15) * 15);
};
  
const formatDuration = (minutes) => {
    if (minutes % 60 === 0) {
      return `${minutes / 60}h`;
    }
    return `${minutes}min`;
};
  
const buildSlots = (fromMinutes, toMinutes, stepMinutes = 15) => {
    const slots = [];
    for (let t = fromMinutes; t < toMinutes; t += stepMinutes) {
      slots.push(t);
    }
    return slots;
};
  
const calculateBadGaps = (assignments, breakMinutes) => {
    if (assignments.length < 2) {
        return 0;
    }
    const sorted = [...assignments].sort((a, b) => a.start - b.start);
    let totalBadGap = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i+1].start - (sorted[i].start + sorted[i].duration);
        if (gap > breakMinutes) {
            totalBadGap += (gap - breakMinutes);
        }
    }
    return totalBadGap;
};

const isLectureType = (item) => typeof item.type === 'string' && /wyk/i.test(item.type.toLowerCase());

const toNumericIds = (values) => (
    Array.isArray(values)
      ? values.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : []
);

const buildItemsFromRows = (rows) => {
    const allItems = [];
    rows.forEach(row => {
        const baseProps = {
            originalId: row.idzajecia || row.idprzedmiotu,
            subjectId: row.idprzedmiotu,
            name: row.nazwa || 'Nieznany przedmiot',
            type: row.zajecia_typ || 'Wykład',
            tryb: row.tryb,
            specjalnosc: row.specjalnosc,
            duration: (() => {
              const classType = row.zajecia_typ || 'Wykład';
              const isLecture = /wyk/i.test(classType);
              const hourMultiplier = isLecture ? 60 : 45;
              const timeRaw = (row.czas || row.time || '') + '';
              if (timeRaw.includes('-')) {
                const parts = timeRaw.split('-').map(p => p.trim());
                if (parts.length >= 2) {
                  const start = parseTime(parts[0]);
                  const end = parseTime(parts[1]);
                  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
                    row._parsedPreferredStart = start;
                    if (row.ilosc_godz != null && Number.isFinite(Number(row.ilosc_godz)) && Number(row.ilosc_godz) > 0) {
                      return normalizeDurationMinutes(Number(row.ilosc_godz) * hourMultiplier);
                    }
                    return normalizeDurationMinutes(end - start);
                  }
                }
              }
              if (timeRaw.includes(':')) {
                const parts = timeRaw.split(':').map(p => Number(p));
                if (parts.length >= 2 && parts.every(n => Number.isFinite(n))) {
                  const hh = Number(parts[0])
                  const mm = Number(parts[1]) || 0
                  const ss = Number(parts[2]) || 0
                  if (hh >= 6 && hh <= 23) {
                    row._parsedPreferredStart = hh * 60 + mm
                    if (row.ilosc_godz != null && Number.isFinite(Number(row.ilosc_godz))) {
                      return normalizeDurationMinutes(Number(row.ilosc_godz) * hourMultiplier);
                    }
                    return normalizeDurationMinutes(67);
                  }
                  const minutes = hh * 60 + mm + Math.round(ss / 60)
                  return normalizeDurationMinutes(minutes)
                }
              }
              if (row.duration != null && Number.isFinite(Number(row.duration))) {
                return normalizeDurationMinutes(Number(row.duration))
              }
              if (row.ilosc_godz != null && Number.isFinite(Number(row.ilosc_godz))) {
                return normalizeDurationMinutes(Number(row.ilosc_godz) * hourMultiplier);
              }
              return normalizeDurationMinutes(67);
            })(),
            lecturer: row.lecturer || 'Brak',
            lecturerId: row.wykladowca_id || null,
            roomId: normalizeRoomId(row.sala_id ?? row.salaId ?? row.roomId ?? row.id_sale ?? row.id_sala ?? null),
            preferredStart: row._parsedPreferredStart ?? null,
            group: Array.isArray(row.grupy) && row.grupy.length > 0 && row.grupy[0] !== null ? row.grupy : (row.grupa ? [String(row.grupa)] : []),
            students: new Set(),
            allowedDays: row.dozwolone_dni,
            data_rozpoczecia: row.data_rozpoczecia,
            data_zakonczenia: row.data_zakonczenia,
        };

        const semesterNumbers = getSemesterNumbers(row.semestr);

        if (semesterNumbers.length > 1) {
            semesterNumbers.forEach((semNum, index) => {
                allItems.push({
                    ...baseProps,
                    id: `${baseProps.originalId}-${semNum}`, // Unique key for this item instance, using semNum for better identification
                    semestr: semNum, // Override semester to be specific
                });
            });
        } else {
            allItems.push({
                ...baseProps,
                id: `${baseProps.originalId}-${semesterNumbers[0] || '0'}`, // Ensure unique ID even for single semester
                semestr: row.semestr,
            });
        }
    });
    return allItems;
};
  
const shuffleArray = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

module.exports = {
    weekdays,
    dayLabels,
    legacyDayMap,
    getSemesterNumbers,
    parseTime,
    formatTime,
    normalizeDay,
    normalizeRoomId,
    normalizeDurationMinutes,
    formatDuration,
    buildSlots,
    calculateBadGaps,
    isLectureType,
    toNumericIds,
    buildItemsFromRows,
    shuffleArray,
};
