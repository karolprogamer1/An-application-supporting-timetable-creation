import React, { useState, useMemo, useEffect } from 'react';

const daysOfWeek = ['Poniedzialek', 'Wtorek', 'Sroda', 'Czwartek', 'Piatek', 'Sobota', 'Niedziela'];
const dayLabels = {
  Poniedzialek: 'Poniedziałek',
  Wtorek: 'Wtorek',
  Sroda: 'Środa',
  Czwartek: 'Czwartek',
  Piatek: 'Piątek',
  Sobota: 'Sobota',
  Niedziela: 'Niedziela',
};

const timeSlots = Array.from({ length: 13 }, (_, i) => {
  const hour = 8 + i;
  return `${String(hour).padStart(2, '0')}:00`;
});

const parseTime = (timeStr) => {
  if (typeof timeStr !== 'string') return null;
  const [hours, minutes] = timeStr.split(':').map(part => Number(part));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const LecturerAvailabilityGrid = ({ availability, lecturerName, onClose }) => {
  const allAvailabilities = availability?.all || [];

  const semesterOptions = useMemo(() => {
    const options = allAvailabilities.map(a => ({
      key: `${a.rok_akademicki}|${a.semestr_numer}|${a.tryb_studiow}|${a.specjalnosc || ''}`,
      availability: a,
    }));
    const years = [...new Set(allAvailabilities.map(a => a.rok_akademicki).filter(Boolean))];

    years.forEach((year) => {
      const key = `${year}|1|STAC|IDSI`;
      if (!options.some(option => option.key === key)) {
        options.push({
          key,
          availability: null,
        });
      }
    });

    return options;
  }, [allAvailabilities]);

  const [selectedSemesterKey, setSelectedSemesterKey] = useState('');

  useEffect(() => {
    if (allAvailabilities.length > 0) {
      const firstWithProposal = allAvailabilities.find(a => a.proposed);
      const first = firstWithProposal || allAvailabilities[0];
      setSelectedSemesterKey(`${first.rok_akademicki}|${first.semestr_numer}|${first.tryb_studiow}|${first.specjalnosc || ''}`);
    } else {
      setSelectedSemesterKey('');
    }
  }, [availability]);

  const selectedAvailabilityData = useMemo(() => {
    if (!selectedSemesterKey || allAvailabilities.length === 0) return null;
    const [rok, sem, tryb, specjalnosc] = selectedSemesterKey.split('|');
    return allAvailabilities.find(a =>
      a.rok_akademicki === rok &&
      String(a.semestr_numer) === sem &&
      a.tryb_studiow === tryb &&
      (a.specjalnosc || '') === specjalnosc
    ) || null;
  }, [selectedSemesterKey, allAvailabilities]);

  const availabilityToShow = selectedAvailabilityData?.proposed?.availability ?? selectedAvailabilityData?.approved ?? null;

  if (allAvailabilities.length === 0) {
    return (
      <div className="availability-grid-container" style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Siatka dostępności: {lecturerName}</h3>
        <p>Brak zdefiniowanej dostępności dla tego wykładowcy.</p>
        <button onClick={onClose} className="card-back-button" style={{ marginTop: '1rem' }}>
          Zamknij
        </button>
      </div>
    );
  }

  const isSlotActive = (day, time) => {
    if (!availabilityToShow) return false;
    const dayConfig = availabilityToShow[day];
    if (!dayConfig || !dayConfig.enabled || !Array.isArray(dayConfig.segments)) {
      return false;
    }

    const slotStart = parseTime(time);
    if (slotStart === null) return false;
    const slotEnd = slotStart + 60; // The grid displays 1-hour slots

    for (const segment of dayConfig.segments) {
      const segStart = parseTime(segment.start);
      const segEnd = parseTime(segment.end);
      if (segStart !== null && segEnd !== null) {
        if (slotStart < segEnd && segStart < slotEnd) { // Check for any overlap
          return true;
        }
      }
    }
    return false;
  };

  return (
    <div className="availability-grid-container" style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Siatka dostępności: {lecturerName}</h3>
        <button onClick={onClose} className="card-back-button" style={{ padding: '0.5rem 1rem' }}>
          Zamknij
        </button>
      </div>

      {allAvailabilities.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <label>
            Wybierz semestr do wyświetlenia:
            <select
              value={selectedSemesterKey}
              onChange={(e) => setSelectedSemesterKey(e.target.value)}
              style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
            >
              {semesterOptions.map(({ key, availability: a }) => {
                const [year, semester, mode, specialization] = key.split('|');
                const isIdsiOption = semester === '1' && mode === 'STAC' && specialization === 'IDSI';
                const label = isIdsiOption
                  ? `${year} - Semestr 1 (IDSI / STAC)${a?.proposed ? ' (Nowa propozycja!)' : ''}`
                  : `${year} - Sem. ${semester}${specialization ? ` / ${specialization}` : ''} (${mode}) ${a?.proposed ? ' (Nowa propozycja!)' : ''}`;
                return <option key={key} value={key}>{label}</option>;
              })}
            </select>
          </label>
        </div>
      )}

      {availabilityToShow ? (
        <div className="admin-table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="admin-table availability-grid">
            <thead>
              <tr>
                <th>Godzina</th>
                {daysOfWeek.map(day => (
                  <th key={day}>{dayLabels[day]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(time => (
                <tr key={time}>
                  <td>{time}</td>
                  {daysOfWeek.map(day => (
                    <td
                      key={`${day}-${time}`}
                      style={{
                        backgroundColor: isSlotActive(day, time) ? '#d4edda' : '#f8d7da',
                        textAlign: 'center',
                      }}
                    >
                      {isSlotActive(day, time) ? '✔' : '✖'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: '1rem' }}>Brak danych o dostępności dla wybranego semestru.</p>
      )}
    </div>
  );
};

export default LecturerAvailabilityGrid;
