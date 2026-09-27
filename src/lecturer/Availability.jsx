import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api';
import '../App.css';

const allWeekdays = [
    { value: 'Poniedzialek', label: 'Poniedziałek' },
    { value: 'Wtorek', label: 'Wtorek' },
    { value: 'Sroda', label: 'Środa' },
    { value: 'Czwartek', label: 'Czwartek' },
    { value: 'Piatek', label: 'Piątek' },
    { value: 'Sobota', label: 'Sobota' },
    { value: 'Niedziela', label: 'Niedziela' },
];

const parseTime = (timeString) => {
  if (typeof timeString !== 'string') return null;
  const [hours, minutes] = timeString.split(':').map((part) => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

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
    if (!availability) return slotMap;

    Object.entries(availability).forEach(([day, dayConfig]) => {
      if (dayConfig.enabled && dayConfig.segments) {
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
        .availability-grid-container { overflow-x: auto; margin-top: 1rem; user-select: none; }
        .availability-grid-table { border-collapse: collapse; width: 100%; }
        .availability-grid-table th, .availability-grid-table td { border: 1px solid #e0e0e0; text-align: center; min-width: 80px; }
        .day-header-cell { padding: 8px; background: #f8f9fa; font-weight: bold; position: sticky; top: 0; z-index: 1; }
        .time-header-cell { background: #f8f9fa; position: sticky; top: 0; z-index: 1; }
        .time-body-cell { padding: 4px 8px; font-size: 0.8rem; color: #495057; background: #f8f9fa; font-weight: bold; position: sticky; left: 0; z-index: 1; }
        .slot-cell { height: 20px; background-color: #fdfdfd; cursor: pointer; transition: background-color 0.1s ease; }
        .slot-cell:hover { background-color: #e9ecef; }
        .slot-cell.selected { background-color: #28a745; }
        .slot-cell.selected:hover { background-color: #218838; }
      `}</style>
    </div>
  );
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
  if (month >= 2 && month <= 8) {
    return 'letni';
  }
  return 'zimowy';
};

function Availability({ user, onBack }) {
  const [structuredAvailability, setStructuredAvailability] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lecturerId, setLecturerId] = useState(null);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [studyMode, setStudyMode] = useState('STAC');
  const [allSemesterOptions, setAllSemesterOptions] = useState([]);
  const [semesterSelection, setSemesterSelection] = useState('');

  const userId = user?.id;

  const semesterOptions = useMemo(() => {
    const mode = studyMode || 'STAC';
    const options = allSemesterOptions.filter(opt => {
        const optMode = opt.value.split('|')[1] || 'STAC';
        return optMode === mode;
    });

    if (mode === 'STAC' && !options.some(opt => opt.value === '1|STAC|IDSI')) {
      options.push({ label: 'Sem. 1 /IDSI', value: '1|STAC|IDSI' });
    }

    return options;
  }, [allSemesterOptions, studyMode]);

  useEffect(() => {
    if (!userId) {
      setError('Brak informacji o zalogowanym użytkowniku.');
      return;
    }

    const fetchOptions = async () => {
        try {
            const res = await apiFetch('/plan/options');
            if (res.ok) {
                const data = await res.json();
                setAllSemesterOptions(data.semesterOptions || []);
            }
        } catch (e) {
            console.error('Błąd pobierania opcji semestrów:', e);
        }
    };
    fetchOptions();

    const findLecturerProfile = async () => {
      try {
        const res = await apiFetch(`/plan/wykladowca/by-user/${userId}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || 'Nie udało się pobrać profilu wykładowcy.');
        }
        const self = await res.json();
        if (self) {
          setLecturerId(self.idwykladowca);
        } else {
          throw new Error('Nie znaleziono profilu wykładowcy dla tego użytkownika.');
        }
      } catch (err) {
        setError(err.message);
      }
    };

    findLecturerProfile();
  }, [userId]);

  const { semesterNumber, specialization } = useMemo(() => {
    const parts = semesterSelection.split('|');
    return {
        semesterNumber: parts[0] || '1',
        specialization: parts[2] || null,
    };
  }, [semesterSelection]);

  useEffect(() => {
    if (semesterOptions.length > 0) {
        const currentSelectionIsValid = semesterOptions.some(opt => opt.value === semesterSelection);
        if (!currentSelectionIsValid) {
            setSemesterSelection(semesterOptions[0]?.value || '');
        }
    }
  }, [semesterOptions, semesterSelection]);

  useEffect(() => {
    if (!lecturerId || !academicYear || !studyMode || !semesterNumber) return;

    const fetchAvailability = async () => {
      setLoading(true);
      setError('');
      try {
        const specParam = specialization ? `&specjalnosc=${encodeURIComponent(specialization)}` : '';
        const res = await apiFetch(`/plan/wykladowca/${lecturerId}/availability?rok_akademicki=${academicYear}&semestr_numer=${semesterNumber}&tryb_studiow=${studyMode}${specParam}`);
        if (!res.ok) throw new Error('Błąd pobierania dostępności');
        const data = await res.json();
        if (data.proposed) {
          // Jeśli jest propozycja, załaduj ją
          setStructuredAvailability(data.proposed.availability || {});
        } else {
          // W przeciwnym razie, załaduj zatwierdzoną wersję
          setStructuredAvailability(data.approved || {});
        }
      } catch (err) {
        setError(err.message || 'Nie udało się pobrać danych o dostępności.');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();
  }, [lecturerId, academicYear, studyMode, semesterNumber, specialization]);

  const handleSave = async () => {
    if (!lecturerId || !academicYear || !studyMode || !semesterNumber) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await apiFetch(`/plan/wykladowca/${lecturerId}/propose-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability: structuredAvailability,
          rok_akademicki: academicYear,
          semestr_numer: semesterNumber,
          tryb_studiow: studyMode,
          specjalnosc: specialization,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Błąd zapisu propozycji');
      }
      setMessage('Twoja propozycja dostępności została zapisana i wysłana do planisty.');
    } catch (err) {
      setError(err.message || 'Nie udało się zapisać propozycji.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-menu-page">
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <h2>Zgłoś swoją dostępność</h2>
          <p>Zaznacz w siatce preferowane godziny pracy. Twoja propozycja zostanie przesłana do planisty do zatwierdzenia.</p>
        </div>

        <div className="form-row" style={{ marginTop: '1rem', gap: '1rem', alignItems: 'center' }}>
            <label>
                Rok akademicki:
                <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                    {getAcademicYearOptions().map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </label>
            <label>
                Tryb studiów:
                <select value={studyMode} onChange={(e) => setStudyMode(e.target.value)}>
                    <option value="STAC">Stacjonarne</option>
                    <option value="NSTAC">Niestacjonarne</option>
                </select>
            </label>
            <label>
                Semestr:
                <select value={semesterSelection} onChange={(e) => setSemesterSelection(e.target.value)}>
                    {semesterOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === '1|STAC|IDSI' ? 'Sem. 1 /IDSI' : opt.label}
                      </option>
                    ))}
                </select>
            </label>
        </div>

        {loading && <p>Ładowanie...</p>}
        {error && <p className="error-message">{error}</p>}
        {message && <p className="success-message">{message}</p>}

        {!loading && (
          <AvailabilityGridEditor
            key={`${lecturerId}-${academicYear}-${semesterSelection}-${studyMode}`}
            availability={structuredAvailability}
            onAvailabilityChange={setStructuredAvailability}
            weekdays={allWeekdays}
          />
        )}

        <div className="admin-form-actions">
          <button type="button" onClick={handleSave} disabled={loading}>
            {loading ? 'Zapisywanie...' : 'Zapisz i wyślij propozycję'}
          </button>
          <button type="button" className="card-back-button" onClick={onBack}>
            Powrót
          </button>
        </div>
      </div>
    </div>
  );
}

export default Availability;