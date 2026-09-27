import { apiFetch } from '../api';
import { useState, useEffect, useMemo, useRef } from 'react'
import '../App.css'

const fullTimeWeekdays = [
  { value: 'Poniedzialek', label: 'Poniedziałek' },
  { value: 'Wtorek', label: 'Wtorek' },
  { value: 'Sroda', label: 'Środa' },
  { value: 'Czwartek', label: 'Czwartek' },
  { value: 'Piatek', label: 'Piątek' },
];

const partTimeWeekdays = [
  { value: 'Piatek', label: 'Piątek' },
  { value: 'Sobota', label: 'Sobota' },
  { value: 'Niedziela', label: 'Niedziela' },
];

const allWeekdays = [
  ...fullTimeWeekdays,
  { value: 'Sobota', label: 'Sobota' },
  { value: 'Niedziela', label: 'Niedziela' },
];

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

const normalizeDay = (day) => legacyDayMap[day] || day;

const normalizeStudyModeValue = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NST' || normalized === 'NSTAC') return 'NSTAC';
  return 'STAC';
};

const getSemesterNumbers = (s) => {
  if (s == null) return [];
  let str = String(s).trim().toLowerCase();

  const romanMap = {
    'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
    'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'
  };
  const semesterRegex = /(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g;

  // Case 1: "semestr X/Y" format, which means year X, semester Y.
  const yearSemMatch = str.match(/semestr\s*(\d+)\s*\/\s*(\d+)/);
  if (yearSemMatch) {
    const semester = yearSemMatch[2]; // The second number is the semester
    if (Number(semester) > 0 && Number(semester) <= 12) {
        return [String(semester)];
    }
  }

  // Case 2: String contains "rok" but not "semestr". Ambiguous, ignore.
  if (str.includes('rok') && !/semestr|sem\./.test(str)) {
    return [];
  }

  // Case 3: String contains "semestr". Remove any "rok" declarations from it.
  if (/semestr|sem\./.test(str)) {
    str = str.replace(/rok\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g, '');
  }
  
  const matches = str.match(semesterRegex);

  if (!matches) return [];

  const semesterNumbers = matches.map(match => {
    if (romanMap[match]) {
      return romanMap[match];
    }
    const num = Number(match);
    if (num > 0 && num <= 12) {
      return String(num);
    }
    return null;
  }).filter(Boolean);

  return [...new Set(semesterNumbers)];
};

const normalizeSemesterValue = (value) => {
  if (value == null) return '';
  const str = String(value).trim().toLowerCase();
  if (!str) return '';
  if (str.startsWith('semestr')) {
    return str.replace(/^semestr\s*/, '').trim();
  }
  return str.replace(/\s+/g, '');
};

const getPlannerEquivalentSemesters = (value) => {
  const rawSemesters = Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : getSemesterNumbers(value);

  const expanded = new Set(rawSemesters.filter(Boolean));
  rawSemesters.forEach((semester) => {
    if (semester === '3') {
      expanded.add('5');
      expanded.add('6');
    }
    if (semester === '4') {
      expanded.add('7'); // Semestr 4 jest powiązany z 7 (inżynierskie), ale nie z 8.
    }
  });

  return [...expanded];
};

const matchesSemesterFilter = (subjectSemester, filterSemester) => {
  const subjectValue = normalizeSemesterValue(subjectSemester);
  const filterValue = normalizeSemesterValue(filterSemester);

  if (!subjectValue || !filterValue) return false;

  const subjectSemesters = getPlannerEquivalentSemesters(subjectSemester);
  const filterSemesters = getPlannerEquivalentSemesters(filterSemester);

  if (subjectSemesters.length > 0 && filterSemesters.length > 0) {
    return subjectSemesters.some(sem => filterSemesters.includes(sem));
  }

  return subjectValue === filterValue;
};

const parseTime = (timeString) => {
  if (typeof timeString !== 'string') return null
  const [hours, minutes] = timeString.split(':').map((part) => Number(part))
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}
const formatTime = (minutes) => {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const AvailabilityGridEditor = ({ availability, onAvailabilityChange, weekdays }) => {
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
      }
    }
    return slots;
  }, []);

  const availableSlots = useMemo(() => {
    const slotMap = new Map();
    if (!availability || typeof availability !== 'object') return slotMap;

    Object.entries(availability).forEach(([day, dayConfig]) => {
      if (dayConfig && dayConfig.enabled && dayConfig.segments) {
        dayConfig.segments.forEach(segment => {
          const startMinutes = parseTime(segment.start);
          const endMinutes = parseTime(segment.end);
          if (startMinutes === null || endMinutes === null) return;

          for (let t = startMinutes; t < endMinutes; t += 15) {
            const time = formatTime(t);
            slotMap.set(`${day}|${time}`, true);
          }
        });
      }
    });
    return slotMap;
  }, [availability]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const updateAvailabilityFromMap = (newSlotMap) => {
    const newAvailability = {};
    weekdays.forEach(day => {
      const dayKey = day.value;
      const daySlots = [];
      timeSlots.forEach(time => {
        if (newSlotMap.get(`${dayKey}|${time}`)) {
          daySlots.push(time);
        }
      });

      const segments = [];
      if (daySlots.length > 0) {
        let currentSegment = null;
        for (let i = 0; i < daySlots.length; i++) {
          const currentTime = daySlots[i];
          const currentMinutes = parseTime(currentTime);
          
          if (!currentSegment) {
            currentSegment = { start: currentTime, end: formatTime(currentMinutes + 15) };
          } else {
            const segmentEndMinutes = parseTime(currentSegment.end);
            if (currentMinutes === segmentEndMinutes) {
              currentSegment.end = formatTime(currentMinutes + 15);
            } else {
              segments.push(currentSegment);
              currentSegment = { start: currentTime, end: formatTime(currentMinutes + 15) };
            }
          }
        }
        if (currentSegment) {
          segments.push(currentSegment);
        }
      }
      
      newAvailability[dayKey] = { enabled: segments.length > 0, segments };
    });
    onAvailabilityChange(newAvailability);
  };

  const handleMouseDown = (day, time) => {
    setIsDragging(true);
    const key = `${day}|${time}`;
    const isSelected = availableSlots.has(key);
    const newDragMode = isSelected ? 'deselect' : 'select';
    setDragMode(newDragMode);

    const newSlotMap = new Map(availableSlots);
    if (newDragMode === 'select') {
      newSlotMap.set(key, true);
    } else {
      newSlotMap.delete(key);
    }
    updateAvailabilityFromMap(newSlotMap);
  };

  const handleMouseEnter = (day, time) => {
    if (!isDragging) return;
    const key = `${day}|${time}`;
    
    const isSelected = availableSlots.has(key);
    if ((dragMode === 'select' && isSelected) || (dragMode === 'deselect' && !isSelected)) {
      return;
    }

    const newSlotMap = new Map(availableSlots);
    if (dragMode === 'select') {
      newSlotMap.set(key, true);
    } else {
      newSlotMap.delete(key);
    }
    updateAvailabilityFromMap(newSlotMap);
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsDragging(false);
      setDragMode(null);
    };
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      window.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []);

  return (
    <div className="availability-grid-container" onMouseLeave={() => setIsDragging(false)}>
      <table className="availability-grid-table">
        <thead>
          <tr>
            <th className="time-header-cell"></th>
            {weekdays.map(day => (
              <th key={day.value} className="day-header-cell">{day.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time}>
              <td className="time-body-cell">{time}</td>
              {weekdays.map(day => {
                const key = `${day.value}|${time}`;
                const isSelected = availableSlots.has(key);
                return (
                  <td
                    key={key}
                    className={`slot-cell ${isSelected ? 'selected' : ''}`}
                    onMouseDown={() => handleMouseDown(day.value, time)}
                    onMouseEnter={() => handleMouseEnter(day.value, time)}
                  ></td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <style>{`
        .availability-grid-container {
          overflow-x: auto;
          margin-top: 1rem;
          user-select: none;
        }
        .availability-grid-table {
          border-collapse: collapse;
          width: 100%;
        }
        .availability-grid-table th, .availability-grid-table td {
          border: 1px solid #e0e0e0;
          text-align: center;
          min-width: 80px;
        }
        .day-header-cell {
          padding: 8px;
          background: #f8f9fa;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .time-header-cell {
          background: #f8f9fa;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .time-body-cell {
          padding: 4px 8px;
          font-size: 0.8rem;
          color: #495057;
          background: #f8f9fa;
          font-weight: bold;
          position: sticky;
          left: 0;
          z-index: 1;
        }
        .slot-cell {
          height: 20px;
          background-color: #fdfdfd;
          cursor: pointer;
          transition: background-color 0.1s ease;
        }
        .slot-cell:hover {
          background-color: #e9ecef;
        }
        .slot-cell.selected {
          background-color: #28a745;
        }
        .slot-cell.selected:hover {
          background-color: #218838;
        }
      `}</style>
    </div>
  );
};
const AvailabilityEditor = () => {
  // This is a placeholder for the old editor which is now removed.
  return null;
};

const normalizeAcademicYear = (value) => {
  if (value == null) return '';
  const normalized = String(value).trim().replace(/\/{2,}/g, '/');
  const match = normalized.match(/^(\d{4})\/+(.+)$/);
  if (!match) return normalized;

  const startYear = Number(match[1]);
  const tail = String(match[2]).replace(/[^\d]/g, '');

  if (!Number.isFinite(startYear) || !tail) return normalized;

  if (tail.length <= 2) {
    return `${startYear}/${startYear + 1}`;
  }

  const secondYear = Number(tail.slice(0, 4));
  if (Number.isFinite(secondYear) && secondYear >= startYear && secondYear <= startYear + 10) {
    return `${startYear}/${startYear + 1}`;
  }

  return `${startYear}/${startYear + 1}`;
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

const getAcademicYearOptions = () => {
  const currentYearStart = parseInt(getCurrentAcademicYear().split('/')[0], 10);
  const options = [];
  for (let i = -1; i <= 2; i++) {
    const year = currentYearStart + i;
    options.push(`${year}/${year + 1}`);
  }
  return options;
};

const getCurrentSemesterType = () => {
  const month = new Date().getMonth(); // 0-11
  // Semestr letni: Marzec (2) - Wrzesień (8)
  return (month >= 2 && month <= 8) ? 'letni' : 'zimowy';
};

export default function Generator({ onBack, onGenerate }) {
  const [selectedDays, setSelectedDays] = useState([])
  const [selectedLecturerForAvailability, setSelectedLecturerForAvailability] = useState(null);
  const [allAvailabilities, setAllAvailabilities] = useState([]);
  const [selectedAvailability, setSelectedAvailability] = useState(null);
  const [structuredAvailability, setStructuredAvailability] = useState({}); // The grid data for the selected semester
  const [proposedAvailability, setProposedAvailability] = useState(null); // The proposal for the selected semester
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [preferences, setPreferences] = useState({});
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');

  const [expandedSemesters, setExpandedSemesters] = useState({});
  const [semesterOptions, setSemesterOptions] = useState([]);
  const [subjectOptions, setSubjectOptions] = useState([]);
  const [lecturerOptions, setLecturerOptions] = useState([]);
  const [roomOptions, setRoomOptions] = useState([]);

  const [subjectSearch, setSubjectSearch] = useState('');
  const [lecturerSearch, setLecturerSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [selectedLecturerIds, setSelectedLecturerIds] = useState([])
  const [selectedRoomIds, setSelectedRoomIds] = useState([])
  const [selectedSemesters, setSelectedSemesters] = useState([])
  const [studyMode, setStudyMode] = useState('STAC');
  const selectedSemestersRef = useRef([]);

  const [windowWeight, setWindowWeight] = useState(50)
  const [lateWeight, setLateWeight] = useState(50)
  const [spreadWeight, setSpreadWeight] = useState(50)
  const [maxHour, setMaxHour] = useState(21)
  const [preferredLecturerDays, setPreferredLecturerDays] = useState([])
  const [generatorMessage, setGeneratorMessage] = useState('')
  const [generatorError, setGeneratorError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lecturerPreferences, setLecturerPreferences] = useState({});
  const [generationStats, setGenerationStats] = useState(null);
  const [lecturers, setLecturers] = useState([]);
  const [slots, setSlots] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await apiFetch('/plan/options');
        if (!response.ok) {
          throw new Error('Błąd pobierania opcji dla generatora');
        }
        const options = await response.json();

        setSemesterOptions(options.semesterOptions || []);
        setLecturerOptions(options.lecturerOptions || []);
        setRoomOptions(options.roomOptions || []);
        setSubjectOptions(options.subjectOptions || []);

        // For availability grid selector
        setLecturers((options.lecturerOptions || []).filter(opt => opt && opt.value != null).map(opt => ({
          idwykladowca: Number(opt.value),
          imie: opt.imie || '',
          nazwisko: opt.nazwisko || '',
        })));
      } catch (err) {
        console.error('Error fetching generator options:', err);
        setGeneratorError(`Nie udało się pobrać danych wykładowców, przedmiotów i zajęć. Szczegóły: ${err.message}`);
      }

      try {
        const slotsRes = await apiFetch('/slots');
        if (slotsRes.ok) {
          setSlots(await slotsRes.json());
        }
      } catch (e) {
        console.error('Could not fetch slots', e);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!selectedLecturerForAvailability) {
      setAllAvailabilities([]);
      setSelectedAvailability(null);
      setStructuredAvailability({});
      setProposedAvailability(null);
      setAvailabilityError('');
      return;
    }

    const fetchAvailability = async () => {
      setAvailabilityLoading(true);
      setAvailabilityError('');
      setAllAvailabilities([]);
      setSelectedAvailability(null);
      setStructuredAvailability({});
      setProposedAvailability(null);
      try {
        const res = await apiFetch(`/plan/wykladowca/${selectedLecturerForAvailability}/availability`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Błąd pobierania dostępności');
        }
        const data = await res.json();
        console.log('Generator: fetched availability', { lecturerId: selectedLecturerForAvailability, status: res.status, data });
        const all = (data.all || []).map((item) => ({
          ...item,
          rok_akademicki: normalizeAcademicYear(item.rok_akademicki),
        }));

        setAllAvailabilities(all);

        if (all.length > 0) {
          // Automatycznie wybierz pierwszy semestr z propozycją, lub po prostu pierwszy z listy
          const firstWithProposal = all.find(a => a.proposed);
          setSelectedAvailability(firstWithProposal || all[0]);
        }

      } catch (err) {
        console.error(err);
        setAvailabilityError(err.message || 'Nie udało się pobrać dostępności dla wybranego wykładowcy.');
      } finally {
        setAvailabilityLoading(false);
      }
    };

    fetchAvailability();
  }, [selectedLecturerForAvailability, availabilityRefreshKey]);

  useEffect(() => {
    if (selectedAvailability) {
      const currentGrid = selectedAvailability.proposed?.availability ?? selectedAvailability.approved ?? {};
      setStructuredAvailability(currentGrid);
      setProposedAvailability(selectedAvailability.proposed);
    } else {
      setStructuredAvailability({});
      setProposedAvailability(null);
    }
  }, [selectedAvailability]);

  const saveAvailability = async () => {
    if (!selectedLecturerForAvailability || !selectedAvailability) return;

    setAvailabilityLoading(true);
    setAvailabilityError('');
    setAvailabilityMessage('');
    try {
      const res = await apiFetch(`/plan/wykladowca/${selectedLecturerForAvailability}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability: structuredAvailability,
          rok_akademicki: selectedAvailability.rok_akademicki,
          semestr_numer: selectedAvailability.semestr_numer,
          tryb_studiow: selectedAvailability.tryb_studiow,
          specjalnosc: selectedAvailability.specjalnosc,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Błąd zapisu dostępności');
      }
      setAvailabilityMessage('Dostępność zatwierdzona i zapisana pomyślnie.');
      // Odśwież dane dla tego wykładowcy
      setAvailabilityRefreshKey(k => k + 1);
    } catch (err) {
      console.error(err);
      setAvailabilityError(err.message || 'Nie udało się zapisać dostępności.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    selectedSemestersRef.current = selectedSemesters;
  }, [selectedSemesters]);

  const normalizeSpecializationValue = (value) => {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/\+\s*/g, '+')
      .replace(/^\+|\+$/g, '');
  };

  const normalizeSelectedSemesterValue = (value) => {
    if (!value) return null;
    const [semRaw = '', trybRaw = '', specRaw = ''] = String(value).split('|');
    const sem = normalizeSemesterValue(semRaw);
    if (!sem) return null;
    const tryb = normalizeStudyModeValue(trybRaw || studyMode);
    const spec = normalizeSpecializationValue(specRaw);
    return spec ? `${sem}|${tryb}|${spec}` : `${sem}|${tryb}`;
  };

  const normalizeSelectedSemesterArray = (items) => {
    return Array.isArray(items)
      ? items.map(normalizeSelectedSemesterValue).filter(Boolean)
      : [];
  };

  const isGeneralSpecialization = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '');
    return normalized === '' || normalized === 'ogólne' || normalized === 'ogolne';
  };

  const specializationMatchesFilter = (itemSpec, filterSpec) => {
    const normalizedFilter = normalizeSpecializationValue(filterSpec);
    const normalizedItem = normalizeSpecializationValue(itemSpec);

    if (!normalizedFilter || normalizedFilter.toLowerCase() === 'all' || normalizedFilter.toLowerCase() === 'wszystkie') {
      return true;
    }

    if (normalizedFilter.toLowerCase() === 'ogolne' || normalizedFilter.toLowerCase() === 'ogólne') {
      return isGeneralSpecialization(normalizedItem);
    }

    if (isGeneralSpecialization(normalizedItem)) {
      return true;
    }

    const filterParts = new Set(normalizedFilter.split('+').filter(Boolean));
    const itemParts = normalizedItem.split('+').filter(Boolean);
    return itemParts.every((part) => filterParts.has(part));
  };

  const matchesSemesterGroup = (subject, group) => {
    const subjectMode = normalizeStudyModeValue(subject.tryb);
    const groupMode = normalizeStudyModeValue(group.tryb);
    if (subjectMode !== groupMode) {
      return false;
    }

    if (!matchesSemesterFilter(subject.semestr, group.sem)) {
      return false;
    }

    const subjectSpec = String(subject.specjalnosc || '').trim();
    const groupSpec = String(group.specjalnosc || '').trim();
    if (groupSpec) {
      return specializationMatchesFilter(subjectSpec, groupSpec);
    }

    return !subjectSpec;
  };

  const syncSelectedSemestersFromSubjects = (nextSubjectIds) => {
    const derivedSemesters = Array.from(new Set((nextSubjectIds || [])
      .map((id) => {
        const subject = (subjectOptions || []).find((option) => Number(option.value) === Number(id));
        if (!subject) return null;

        const semRaw = String(subject.semestr ?? '').trim();
        const tryb = normalizeStudyModeValue(subject.tryb);
        const spec = String(subject.specjalnosc || '').trim();

        return semRaw ? (spec ? `${semRaw}|${tryb}|${spec}` : `${semRaw}|${tryb}`) : null;
      })
      .filter(Boolean)));

    selectedSemestersRef.current = derivedSemesters;
    setSelectedSemesters(derivedSemesters);
  };

  useEffect(() => {
    const currentSemesters = normalizeSelectedSemesterArray(selectedSemestersRef.current);
    const derivedSemesters = Array.from(new Set((selectedSubjectIds || [])
      .map((id) => {
        const subject = (subjectOptions || []).find((option) => Number(option.value) === Number(id));
        if (!subject) return null;

        const semRaw = String(subject.semestr ?? '').trim();
        const tryb = normalizeStudyModeValue(subject.tryb);
        const spec = String(subject.specjalnosc || '').trim();

        return semRaw ? (spec ? `${semRaw}|${tryb}|${spec}` : `${semRaw}|${tryb}`) : null;
      })
      .filter(Boolean)));

    const semesetersChanged = derivedSemesters.length !== currentSemesters.length
      || derivedSemesters.some((value, index) => value !== currentSemesters[index]);

    if (semesetersChanged) {
      selectedSemestersRef.current = derivedSemesters;
      setSelectedSemesters(derivedSemesters);
    }
  }, [selectedSubjectIds, subjectOptions, studyMode]);

  const resolvedSelectedSemesters = useMemo(() => {
    const directSelection = normalizeSelectedSemesterArray(selectedSemesters);
    if (directSelection.length > 0) {
      return directSelection;
    }

    const refSelection = normalizeSelectedSemesterArray(selectedSemestersRef.current);
    if (refSelection.length > 0) {
      return refSelection;
    }

    const derived = new Set();
    (selectedSubjectIds || []).forEach((id) => {
      const subject = (subjectOptions || []).find((option) => Number(option.value) === Number(id));
      if (!subject) return;
      const semRaw = String(subject.semestr ?? '').trim();
      const tryb = normalizeStudyModeValue(subject.tryb);
      const spec = String(subject.specjalnosc || '').trim();
      if (semRaw) {
        derived.add(spec ? `${semRaw}|${tryb}|${spec}` : `${semRaw}|${tryb}`);
      }
    });

    return Array.from(derived);
  }, [selectedSemesters, selectedSubjectIds, subjectOptions]);

  const filteredSubjectOptions = useMemo(() => {
    if (!resolvedSelectedSemesters || resolvedSelectedSemesters.length === 0) {
      return subjectOptions;
    }

    const filters = resolvedSelectedSemesters.map(s => {
      const [semestr, tryb, specjalnosc] = s.split('|');
      return { semestr, tryb, specjalnosc: specjalnosc || null };
    });

    return subjectOptions.filter(subject => {
      const subjectValue = subject.semestr;
      if (!subjectValue) {
        return false;
      }

      return filters.some(filter => {
        if (!matchesSemesterFilter(subjectValue, filter.semestr)) {
          return false;
        }

        const subjectMode = (subject.tryb || 'STAC').toUpperCase();
        if (filter.tryb && !subjectMode.startsWith(filter.tryb)) {
          return false;
        }

        const subjectSpec = String(subject.specjalnosc || '').trim();
        const filterSpec = String(filter.specjalnosc || '').trim();
        if (filterSpec) {
          if (!specializationMatchesFilter(subjectSpec, filterSpec)) {
            return false;
          }
        }

        return true;
      });
    });
  }, [subjectOptions, resolvedSelectedSemesters]);

  useEffect(() => {
    const filteredIds = new Set(filteredSubjectOptions.map(opt => opt.value));
    setSelectedSubjectIds((currentSelected) => {
      const nextSelected = currentSelected.filter((id) => filteredIds.has(id));
      const arraysEqual = nextSelected.length === currentSelected.length
        && nextSelected.every((id, index) => id === currentSelected[index]);
      return arraysEqual ? currentSelected : nextSelected;
    });
  }, [filteredSubjectOptions]);

  const searchedSubjectOptions = useMemo(() => {
    if (!subjectSearch) return filteredSubjectOptions;
    const text = subjectSearch.toLowerCase();
    return filteredSubjectOptions.filter(opt => opt.label.toLowerCase().includes(text));
  }, [filteredSubjectOptions, subjectSearch]);

  const groupedSearchedSubjectOptions = useMemo(() => {
    const groups = {};

    searchedSubjectOptions.forEach((opt) => {
      const key = String(opt.semestr || 'inne').trim();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(opt);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => Number(a || 0) - Number(b || 0))
      .map(([key, options]) => ({
        key,
        label: key === 'inne' ? 'Inne' : `Semestr ${key}`,
        options,
      }));
  }, [searchedSubjectOptions]);

  const searchedLecturerOptions = useMemo(() => {
    if (!lecturerSearch) return lecturerOptions
    const text = lecturerSearch.toLowerCase()
    return lecturerOptions.filter(opt => opt.label.toLowerCase().includes(text))
  }, [lecturerOptions, lecturerSearch]);

  const searchedRoomOptions = useMemo(() => {
    if (!roomSearch) return roomOptions
    const text = roomSearch.toLowerCase()
    return roomOptions.filter(opt => opt.label.toLowerCase().includes(text))
  }, [roomOptions, roomSearch]);


  useEffect(() => {
    if (!selectedLecturerForAvailability) {
      setPreferences({})
      return
    }
    const fetchPreferences = async () => {
      setPreferencesLoading(true)
      try {
        // Uwaga: Endpoint '/api/wykladowca/:id/preferences' wydaje się jeszcze nie istnieć.
        // Do czasu jego implementacji, to zapytanie będzie zwracać błąd 404.
        const res = await apiFetch(`/wykladowca/${encodeURIComponent(selectedLecturerForAvailability)}/preferences`)
        if (!res.ok) throw new Error('Błąd pobierania preferencji')
        const data = await res.json()
        setPreferences(data.preferences || {})
      } catch (err) {
        console.error('Nie udało się pobrać preferencji dla wybranego wykładowcy:', err)
      } finally {
        setPreferencesLoading(false)
      }
    }
    fetchPreferences()
  }, [selectedLecturerForAvailability])

  const handleStudyModeChange = (mode) => {
    setStudyMode(mode);
    setSelectedDays([]);
    // Wyczyść zaznaczenia, aby uniknąć przenoszenia opcji między trybami
    setSelectedSubjectIds([]);
    setSelectedSemesters([]);
    selectedSemestersRef.current = [];
  };

  const semesterDisplayGroups = useMemo(() => {
    const groups = {};
    const activeStudyMode = normalizeStudyModeValue(studyMode);
    const specializedSemModeKeys = new Set();

    (subjectOptions || []).forEach(option => {
      const semRaw = String(option.semestr ?? '').trim();
      const semKey = semRaw || 'inne';
      const optionMode = normalizeStudyModeValue(option.tryb);
      const specRaw = String(option.specjalnosc || '').trim();

      if (['5', '6', '8'].includes(semKey) && specRaw) {
        specializedSemModeKeys.add(`${semKey}|${activeStudyMode}`);
      }
    });

    (subjectOptions || []).forEach(option => {
      const semRaw = String(option.semestr ?? '').trim();
      const semKey = semRaw || 'inne';
      const optionMode = normalizeStudyModeValue(option.tryb);
      const specRaw = String(option.specjalnosc || '').trim();

      // Subjects with a specific mode must match the active mode.
      // Subjects without a mode (tryb is null/empty) are considered universal and are always included.
      if (option.tryb && optionMode !== activeStudyMode) {
        return;
      }

      if (['5', '6', '8'].includes(semKey) && !specRaw && specializedSemModeKeys.has(`${semKey}|${activeStudyMode}`)) {
        return;
      }

      const key = `${semKey}|${activeStudyMode}|${specRaw || 'ogolne'}`;
      if (!groups[key]) {
        const label = specRaw
          ? `Semestr ${semKey} / ${specRaw} (${activeStudyMode})`
          : (semKey === 'inne' ? `Inne (${activeStudyMode})` : `Semestr ${semKey} (${activeStudyMode})`);

        groups[key] = {
          sem: semKey,
          tryb: activeStudyMode,
          specjalnosc: specRaw || null,
          label,
          options: []
        };
      }
      groups[key].options.push(option);
    });

    if (activeStudyMode === 'STAC' && !groups['1|STAC|IDSI']) {
      groups['1|STAC|IDSI'] = {
        sem: '1',
        tryb: 'STAC',
        specjalnosc: 'IDSI',
        label: 'Semestr 1 (IDSI / STAC)',
        options: [],
      };
    }

    return Object.values(groups).sort((a, b) => {
      // Sortowanie po etykiecie jest bardziej przewidywalne i obsługuje wszystkie przypadki.
      return a.label.localeCompare(b.label);
    });
  }, [subjectOptions, studyMode]);

  const toggleSemesterExpand = (sem) => {
    setExpandedSemesters((prev) => ({ ...prev, [sem]: !prev[sem] })) // Use full key
  }

  const toggleGroupSubjects = (group) => {
    const subjectIds = (group.options || [])
      .map(option => Number(option.value))
      .filter(id => !Number.isNaN(id));

    const normalizedGroupSem = normalizeSemesterValue(String(group.sem || ''));
    const normalizedGroupSpec = normalizeSpecializationValue(String(group.specjalnosc || ''));
    const normalizedGroupMode = normalizeStudyModeValue(group.tryb);
    const semesterValue = normalizedGroupSem
      ? (normalizedGroupSpec ? `${normalizedGroupSem}|${normalizedGroupMode}|${normalizedGroupSpec}` : `${normalizedGroupSem}|${normalizedGroupMode}`)
      : null;

    const allSelected = subjectIds.length > 0 && subjectIds.every(id => selectedSubjectIds.includes(id));
    const currentSemesters = normalizeSelectedSemesterArray(selectedSemestersRef.current);

    const nextSemesters = (() => {
      if (!semesterValue) return currentSemesters;
      if (allSelected) {
        return currentSemesters.filter(value => value !== semesterValue);
      }
      return currentSemesters.includes(semesterValue)
        ? currentSemesters
        : [...currentSemesters, semesterValue];
    })();

    if (allSelected) {
      const nextSelectedSubjectIds = selectedSubjectIds.filter(id => !subjectIds.includes(id));
      setSelectedSubjectIds(nextSelectedSubjectIds);
      syncSelectedSemestersFromSubjects(nextSelectedSubjectIds);
      return;
    }

    const nextSelectedSubjectIds = Array.from(new Set([...selectedSubjectIds, ...subjectIds]));
    setSelectedSubjectIds(nextSelectedSubjectIds);
    syncSelectedSemestersFromSubjects(nextSelectedSubjectIds);
  };

  const toggleSubjectSelection = (subjectId) => {
    const subject = (subjectOptions || []).find((option) => Number(option.value) === Number(subjectId));
    const isSelected = selectedSubjectIds.includes(subjectId);

    if (!subject) return;

    const nextSelectedSubjectIds = isSelected
      ? selectedSubjectIds.filter((id) => id !== subjectId)
      : Array.from(new Set([...selectedSubjectIds, subjectId]));

    setSelectedSubjectIds(nextSelectedSubjectIds);
    syncSelectedSemestersFromSubjects(nextSelectedSubjectIds);
  };

  const getSubLabel = (option) => {
    const labelParts = option.label.split(' / ');
    if (labelParts.length > 1) {
        return labelParts[1];
    }
    // If no ' / ', it's a general semester. Extract the mode part.
    const modeMatch = option.label.match(/\(([^)]+)\)/);
    return `Ogólne ${modeMatch ? `(${modeMatch[1]})` : ''}`.trim();
  }

  const currentWeekdays = studyMode === 'STAC' ? fullTimeWeekdays : partTimeWeekdays;

  const toggleDay = (day, setFn, values) => {
    const next = values.includes(day)
      ? values.filter((item) => item !== day)
      : [...values, day]
    setFn(next)
  }

  const togglePreferredLecturerDay = (day) => toggleDay(day, setPreferredLecturerDays, preferredLecturerDays)

  const handleSubjectChange = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => Number(option.value)).filter(
      (value) => !Number.isNaN(value)
    )
    setSelectedSubjectIds(selected)
    syncSelectedSemestersFromSubjects(selected)
  }

  const handleLecturerChange = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => Number(option.value)).filter(
      (value) => !Number.isNaN(value)
    )
    setSelectedLecturerIds(selected)
  }

  const handleRoomChange = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => Number(option.value)).filter(
      (value) => !Number.isNaN(value)
    )
    setSelectedRoomIds(selected)
  }


  const handleGenerate = async () => {
    console.log('slots before generate:', slots);
    setLoading(true)
    setGeneratorError('')
    setGenerationStats(null);
    setGeneratorMessage('')

    // Pobierz preferencje tylko dla małej liczby wykładowców.
    // Dla więksych zestawów nie wykonujemy osobnych requestów, bo
    // to znacząco wydłuża czas oczekiwania w frontendzie, a brak preferencji
    // nie blokuje poprawnego działania generowania.
    const allLecturerPrefs = {};
    const lecturerIdsForPrefs = selectedLecturerIds.slice(0, 20);
    if (lecturerIdsForPrefs.length > 0) {
      try {
        const prefPromises = lecturerIdsForPrefs.map(id =>
          apiFetch(`/wykladowca/${id}/preferences`).then(res => res.ok ? res.json() : Promise.resolve({ preferences: {} }))
        );
        const results = await Promise.allSettled(prefPromises);
        results.forEach((result, index) => {
          if (result.status !== 'fulfilled') return;
          const preferences = result.value?.preferences || {};
          if (preferences && Object.keys(preferences).length > 0) {
            allLecturerPrefs[lecturerIdsForPrefs[index]] = preferences;
          }
        });
      } catch (e) {
        console.error("Błąd podczas pobierania wszystkich preferencji wykładowców:", e);
      }
    }

    const effectiveSelectedSemesters = Array.isArray(selectedSemestersRef.current) && selectedSemestersRef.current.length > 0
      ? selectedSemestersRef.current.filter(Boolean)
      : (Array.isArray(resolvedSelectedSemesters) ? resolvedSelectedSemesters.filter(Boolean) : []);

    if (!effectiveSelectedSemesters.length && !selectedSubjectIds.length) {
      setGeneratorError('Proszę wybrać semestr lub przynajmniej przedmioty przed wygenerowaniem planu.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          selectedDays,
          selectedSubjectIds,
          selectedLecturerIds,
          selectedRoomIds,
          selectedSemesters: effectiveSelectedSemesters,
          effectiveSelectedSemesters,
          algorithm: 'heuristic',
          maxTimeSeconds: 8,
          preferredLecturerDays,
          randomize: true,

          windowPreference: windowWeight,
          latePreference: lateWeight,
          spreadPreference: spreadWeight,
          maxHour,
          lecturerPreferences: allLecturerPrefs,
          studyMode,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Błąd generowania planu')
      }

      // Logika do łączenia planów ogólnych ze specjalizacyjnymi.
      const processedResult = Object.fromEntries(
        Object.entries(result || {}).map(([key, specResult]) => [key, { ...(specResult || {}) }])
      );
      const keys = Object.keys(processedResult);
      const groups = {};

      // 1. Grupuj plany po semestrze i trybie
      keys.forEach(key => {
          const [sem, spec, mode] = key.split('|');
          const groupKey = `${sem}|${mode}`;
          if (!groups[groupKey]) {
              groups[groupKey] = { general: null, specs: [] };
          }
          if (spec === 'Ogólne') {
              groups[groupKey].general = key;
          } else {
              groups[groupKey].specs.push(key);
          }
      });

      // 2. Jeśli w grupie jest plan ogólny i plany specjalizacyjne, połącz je
      for (const groupKey in groups) {
          const group = groups[groupKey];
          if (group.general && group.specs.length > 0) {
              const generalData = processedResult[group.general];
              if (!generalData) continue;

              group.specs.forEach(specKey => {
                  const specData = processedResult[specKey];
                  if (!specData) return;

                  // Połącz i usuń duplikaty z listy zajęć zaplanowanych
                  if (specData.plan && generalData.plan) {
                    const combinedPlan = [...specData.plan, ...generalData.plan];
                    specData.plan = Array.from(new Map(combinedPlan.map(item => [JSON.stringify(item), item])).values());
                  }

                  // Połącz i usuń duplikaty z listy zajęć niezaplanowanych
                  if (specData.unscheduled && generalData.unscheduled) {
                    const combinedUnscheduled = [...specData.unscheduled, ...generalData.unscheduled];
                    specData.unscheduled = Array.from(new Map(combinedUnscheduled.map(item => [item.id, item])).values());
                  }
              });
              
              // Usuń plan ogólny, ponieważ został już włączony do planów specjalizacyjnych
              delete processedResult[group.general];
          }
      }

      const firstSemesterSelection = effectiveSelectedSemesters.length > 0 ? effectiveSelectedSemesters[0] : null;
      const [firstSemesterRaw = ''] = String(firstSemesterSelection || '').split('|');
      const semesterNumbers = getSemesterNumbers(firstSemesterRaw);
      // Bierzemy ostatnią liczbę, ponieważ w przypadku "4/8" (rok/semestr), "8" jest numerem semestru.
      const firstSemester = semesterNumbers.length > 0 ? semesterNumbers[semesterNumbers.length - 1] : null;
      const [semValue = '', modeValue = '', specValue = ''] = String(firstSemesterSelection || '').split('|');
      const normalizedSemValue = normalizeSemesterValue(semValue);
      const normalizedSpecValue = normalizeSpecializationValue(specValue);
      const initialSemesterFilter = normalizedSemValue
        ? (normalizedSpecValue ? `${normalizedSemValue}|${normalizedSpecValue}` : normalizedSemValue)
        : null;
      // Aggregate stats and messages from all generated plans
      const allUnscheduled = Object.values(processedResult).flatMap(specResult => specResult.unscheduled || []);
      const skippedCount = allUnscheduled.length;

      const aggregatedStats = Object.values(processedResult).reduce((acc, specResult) => {
        if (!specResult.stats) return acc;
        // Aggregate hard, soft, prefs stats
        ['hard', 'soft', 'prefs'].forEach(key => {
          if (specResult.stats[key]) {
            if (!acc[key]) acc[key] = { ok: 0, total: 0 };
            acc[key].ok += specResult.stats[key].ok || 0;
            acc[key].total += specResult.stats[key].total || 0;
          }
        });
        if (specResult.stats.generationTimeMs && !acc.generationTimeMs) {
          acc.generationTimeMs = specResult.stats.generationTimeMs;
        }
        return acc;
      }, {});

      const finalStats = Object.keys(aggregatedStats).length > 0 ? {
        ...aggregatedStats,
        hardOkPct: aggregatedStats.hard?.total > 0 ? Math.round((aggregatedStats.hard.ok / aggregatedStats.hard.total) * 100) : 100,
        softOkPct: aggregatedStats.soft?.total > 0 ? Math.round((aggregatedStats.soft.ok / aggregatedStats.soft.total) * 100) : 100,
        preferredOkPct: aggregatedStats.prefs?.total > 0 ? Math.round((aggregatedStats.prefs.ok / aggregatedStats.prefs.total) * 100) : 100,
      } : null;

      setGenerationStats(finalStats);
      onGenerate({
        plan: processedResult,
        plans: processedResult,
        stats: finalStats,
        mode: studyMode,
        semester: firstSemester,
        semesterFilter: initialSemesterFilter,
        studyModeLabel: modeValue || studyMode,
        specializationLabel: normalizedSpecValue || null,
      });

      setGeneratorMessage(
        skippedCount > 0
          ? `Wygenerowano plan częściowy. Nie udało się zaplanować ${skippedCount} zajęć.`
          : 'Plan został wygenerowany pomyślnie.'
      )
    } catch (err) {
      console.error(err)
      setGeneratorError(err.message || 'Błąd generowania planu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="student-menu-page" style={{ maxWidth: 'none', padding: '1rem 2rem' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* --- LEFT COLUMN: Availability & Preferences --- */}
        <div className="student-plan-card admin-form-card" style={{ flex: '1 1 50%', alignSelf: 'stretch' }}>
          <section>
            <div className="plan-header" style={{ padding: 0, border: 0, marginBottom: '1rem' }}>
              <h2>Tablica dostępności wykładowcy</h2>
              <p>Wybierz wykładowcę, aby zobaczyć jego dostępność i preferencje.</p>
            </div>

            <div className="form-row">
              <label>
                Wybierz wykładowcę:
                <select
                  value={selectedLecturerForAvailability || ''}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedLecturerForAvailability(id || null);
                  }}
                >
                  <option value="">-- wybierz --</option>
                  {lecturers.map((lecturer) => (
                    <option key={lecturer.idwykladowca} value={lecturer.idwykladowca}>
                      {`${lecturer.imie || ''} ${lecturer.nazwisko || ''}`.trim() || `Wykładowca ${lecturer.idwykladowca}`}
                    </option>
                  ))}
                </select>
              </label>
              {allAvailabilities.length > 0 && (
                <label>
                  Wybierz semestr:
                  <select
                    value={selectedAvailability ? `${normalizeAcademicYear(selectedAvailability.rok_akademicki)}|${selectedAvailability.semestr_numer}|${selectedAvailability.tryb_studiow}|${selectedAvailability.specjalnosc || ''}` : ''}
                    onChange={(e) => {
                      const [rok, sem, tryb, spec] = e.target.value.split('|');
                      const specVal = spec || null;
                      const normalizedRok = normalizeAcademicYear(rok);
                      const newSelection = allAvailabilities.find(a =>
                        normalizeAcademicYear(a.rok_akademicki) === normalizedRok &&
                        String(a.semestr_numer) === sem &&
                        a.tryb_studiow === tryb &&
                        (a.specjalnosc || null) === specVal
                      ) || null;
                      setSelectedAvailability(newSelection);
                    }}
                  >
                    {allAvailabilities
                      .sort((a, b) => `${normalizeAcademicYear(a.rok_akademicki)}-${a.semestr_numer}-${a.tryb_studiow}-${a.specjalnosc || ''}`.localeCompare(`${normalizeAcademicYear(b.rok_akademicki)}-${b.semestr_numer}-${b.tryb_studiow}-${b.specjalnosc || ''}`))
                      .map(a => {
                        const year = normalizeAcademicYear(a.rok_akademicki) || getCurrentAcademicYear();
                        const isIdsiOption = String(a.semestr_numer) === '1' && a.tryb_studiow === 'STAC' && a.specjalnosc === 'IDSI';
                        const label = isIdsiOption
                          ? `${year} - Sem. 1 /IDSI${a.proposed ? ' (Nowa propozycja!)' : ''}`
                          : `${year} - Sem. ${a.semestr_numer}${a.specjalnosc ? ` / ${a.specjalnosc}` : ''} (${a.tryb_studiow})${a.proposed ? ' (Nowa propozycja!)' : ''}`;
                        const value = `${year}|${a.semestr_numer}|${a.tryb_studiow}|${a.specjalnosc || ''}`;
                        return (
                          <option key={value} value={value}>{label}</option>
                        );
                      })}
                  </select>
                </label>
              )}
              <button type="button" onClick={saveAvailability} disabled={!selectedLecturerForAvailability || !selectedAvailability || availabilityLoading} style={{ minWidth: '160px' }}>
                {proposedAvailability ? 'Zatwierdź i zapisz' : 'Zapisz dostępność'}
              </button>
            </div>

            {availabilityMessage && <p className="success-message">{availabilityMessage}</p>}
            {availabilityLoading && <p>Ładowanie dostępności...</p>}
            {availabilityError && <p className="error-message">{availabilityError}</p>}

            {proposedAvailability && (
              <div style={{ padding: '1rem', margin: '1rem 0', border: '1px solid #fdba74', background: '#fffbeb', borderRadius: '8px' }}>
                <h4 style={{ margin: 0, color: '#b45309' }}>Nowa propozycja dostępności</h4>
                <p style={{ margin: '0.25rem 0 0', color: '#d97706' }}>
                  Wykładowca zgłosił nową dostępność dnia {new Date(proposedAvailability.submitted_at).toLocaleDateString('pl-PL')}. Możesz ją zmodyfikować i zapisać, aby ją zatwierdzić.
                </p>
              </div>
            )}

            {selectedLecturerForAvailability && selectedAvailability && !availabilityLoading && (
              <AvailabilityGridEditor
                key={`${selectedLecturerForAvailability}-${selectedAvailability.rok_akademicki}-${selectedAvailability.semestr_numer}-${selectedAvailability.tryb_studiow}-${selectedAvailability.specjalnosc || ''}`}
                availability={structuredAvailability}
                onAvailabilityChange={setStructuredAvailability}
                weekdays={allWeekdays}
              />
            )}

              <div style={{ marginTop: '2rem' }}>
                <h2>Preferencje czasowe wykładowcy (kary)</h2>
                <p>Wartości kar za umieszczenie zajęć w danym slocie. Wyższa wartość oznacza mniejszą preferencję. 0 oznacza brak zdefiniowanej preferencji.</p>

                {!availabilityLoading && !availabilityError && (
                  <p style={{ color: '#666' }}>Funkcjonalność preferencji czasowych (kar) zostanie zaimplementowana w przyszłości.</p>
                )}
              </div>
          </section>
        </div>

        {/* --- RIGHT COLUMN: Generator Form --- */}
        <div className="student-plan-card admin-form-card generator-form" style={{ flex: '1 1 50%' }}>
          <div className="plan-header">
            <div className="plan-label">Generator planu</div>
            <h1>Ustaw kryteria planu zajęć</h1>
            <p className="plan-subtitle">Wybierz preferencje wykładowców, dni i optymalizację.</p>
          </div>

          <section>
            <h2>Tryb studiów</h2>
            <div className="checkbox-row">
                <label>
                    <input type="radio" name="studyMode" value="STAC" checked={studyMode === 'STAC'} onChange={() => handleStudyModeChange('STAC')} />
                    Stacjonarne
                </label>
                <label>
                    <input type="radio" name="studyMode" value="NSTAC" checked={studyMode === 'NSTAC'} onChange={() => handleStudyModeChange('NSTAC')} />
                    Niestacjonarne
                </label>
            </div>
          </section>

          <section>
            <h2>Wybierz dni tygodnia</h2>
            <div className="checkbox-row">
              {currentWeekdays.map((day) => (
                <label key={day.value}>
                  <input
                    type="checkbox"
                    checked={selectedDays.includes(day.value)}
                    onChange={() => toggleDay(day.value, setSelectedDays, selectedDays)}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </section>
          
          <section>
            <h2>Wybierz dane z bazy danych</h2>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Semestry:</strong>
              <div style={{ marginTop: '0.5rem' }}>
                {semesterDisplayGroups.map((group) => {
                  const groupSubjects = subjectOptions.filter(subject => matchesSemesterGroup(subject, group));
                  const groupSubjectIds = groupSubjects.map(subject => Number(subject.value)).filter(id => !Number.isNaN(id));
                  const semesterValue = `${group.sem}|${normalizeStudyModeValue(group.tryb)}${group.specjalnosc ? `|${group.specjalnosc}` : ''}`;
                  const allGroupSelected = groupSubjectIds.length > 0 && groupSubjectIds.every(id => selectedSubjectIds.includes(id));
                  const isGroupSelected = allGroupSelected || selectedSemesters.includes(semesterValue) || groupSubjectIds.some(id => selectedSubjectIds.includes(id));

                  return (
                    <div key={group.label} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: '8px 12px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', flex: 1, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isGroupSelected}
                            onChange={() => toggleGroupSubjects(group)}
                          />
                          <span>{group.label}</span>
                        </label>
                        <button type="button" onClick={() => toggleSemesterExpand(group.label)} style={{ cursor: 'pointer', padding: '4px 8px' }}>{expandedSemesters[group.label] ? 'Ukryj' : 'Pokaż'}</button>
                      </div>

                      {expandedSemesters[group.label] && (
                        <div style={{ paddingLeft: '28px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {groupSubjects.length === 0 ? (
                              <div style={{ color: '#495057', fontSize: '0.95rem' }}>Brak przedmiotów dla tego semestru.</div>
                            ) : (
                              groupSubjects.map(subject => {
                                const isSelected = selectedSubjectIds.includes(Number(subject.value));
                                return (
                                  <button
                                      key={subject.value}
                                      type="button"
                                      onClick={() => {
                                        const subjectId = Number(subject.value);
                                        toggleSubjectSelection(subjectId);
                                      }}
                                      aria-pressed={isSelected}
                                      style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: '8px 10px',
                                          borderRadius: '6px',
                                          border: isSelected ? '1px solid #2563eb' : '1px solid #d0d7de',
                                          background: isSelected ? '#e8f0fe' : '#fff',
                                          cursor: 'pointer',
                                          textAlign: 'left',
                                          color: isSelected ? '#1d4ed8' : '#1f2937',
                                          fontWeight: isSelected ? 600 : 400,
                                      }}
                                  >
                                      <span>{subject.label}</span>
                                      <span>{isSelected ? '✓' : '›'}</span>
                                  </button>
                                );
                              })
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="form-row">
              <label>
                Przedmioty ({searchedSubjectOptions.length})
                <input
                  type="text"
                  placeholder="Filtruj przedmioty..."
                  value={subjectSearch}
                  onChange={e => setSubjectSearch(e.target.value)}
                  style={{ marginBottom: '5px', width: '100%', boxSizing: 'border-box', padding: '8px' }}
                />
                <select multiple value={selectedSubjectIds.map(String)} onChange={handleSubjectChange}>
                  {groupedSearchedSubjectOptions.map((group) => (
                    <optgroup key={group.key} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                Wykładowcy ({searchedLecturerOptions.length})
                <input
                  type="text"
                  placeholder="Filtruj wykładowców..."
                  value={lecturerSearch}
                  onChange={e => setLecturerSearch(e.target.value)}
                  style={{ marginBottom: '5px', width: '100%', boxSizing: 'border-box', padding: '8px' }}
                />
                <select multiple value={selectedLecturerIds.map(String)} onChange={handleLecturerChange}>
                  {searchedLecturerOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label>
                Sale ({searchedRoomOptions.length})
                <input
                  type="text"
                  placeholder="Filtruj sale..."
                  value={roomSearch}
                  onChange={e => setRoomSearch(e.target.value)}
                  style={{ marginBottom: '5px', width: '100%', boxSizing: 'border-box', padding: '8px' }}
                />
                <select multiple value={selectedRoomIds.map(String)} onChange={handleRoomChange}>
                  {searchedRoomOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section>
            <h2>Preferencje wykładowców</h2>
            <p>Wybierz dni, w których wykładowcy preferują prowadzić zajęcia (używane przy ocenianiu rozwiązań).</p>
            <div className="checkbox-row">
              {allWeekdays.map((d) => (
                <label key={`pref-${d.value}`}>
                  <input
                    type="checkbox"
                    checked={preferredLecturerDays.includes(d.value)}
                    onChange={() => togglePreferredLecturerDay(d.value)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2>Kryteria optymalizacji</h2>
            <label>
              Okienka
              <input
                type="range"
                min="0"
                max="100"
                value={windowWeight}
                onChange={(e) => setWindowWeight(Number(e.target.value))}
              />
            </label>
            <label>
              Późne godziny
              <input
                type="range"
                min="0"
                max="100"
                value={lateWeight}
                onChange={(e) => setLateWeight(Number(e.target.value))}
              />
            </label>
            <label>
              Rozłożenie zajęć
              <input
                type="range"
                min="0"
                max="100"
                value={spreadWeight}
                onChange={(e) => setSpreadWeight(Number(e.target.value))}
              />
            </label>
          </section>

          <section>
            <h2>Ograniczenia czasowe</h2>
            <label>
              Maksymalna godzina zakończenia zajęć
              <select value={maxHour} onChange={(e) => setMaxHour(Number(e.target.value))}>
                {[12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map((h) => (
                  <option key={h} value={h}>
                    {`${String(h).padStart(2, '0')}:00`}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="admin-form-actions">
            <button type="button" disabled={loading} onClick={handleGenerate}>
              {loading ? 'Generuję...' : 'Generuj'}
            </button>
            <button type="button" className="card-back-button" onClick={onBack}>
              Powrót
            </button>
          </div>

          {generatorMessage && <p className="success-message">{generatorMessage}</p>}
          {generationStats && (
            <div className="stats-container">
              <h4>Wyniki optymalizacji:</h4>
              <p>Spełnione ograniczenia twarde: {generationStats.hardOkPct}% ({generationStats.hard.ok}/{generationStats.hard.total})</p>
              <p>Spełnione ograniczenia miękkie: {generationStats.softOkPct}% ({generationStats.soft.ok}/{generationStats.soft.total})</p>
              <p>Spełnione preferencje: {generationStats.preferredOkPct}% ({generationStats.prefs.ok}/{generationStats.prefs.total})</p>
              {generationStats.generationTimeMs != null && (
                <p>Czas generowania: <strong>{(generationStats.generationTimeMs / 1000).toFixed(2)} s</strong></p>
              )}
            </div>
          )}
          {generatorError && <p className="error-message">{generatorError}</p>}
        </div>
      </div>
    </div>
  )
}
