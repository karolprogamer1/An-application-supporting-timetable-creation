import { useState, useMemo, useEffect } from 'react'
import { apiFetch } from '../api'

const dayMap = {
  'poniedziałek': 'monday', 'poniedzialek': 'monday', 'monday': 'monday',
  'wtorek': 'tuesday', 'tuesday': 'tuesday',
  'środa': 'wednesday', 'sroda': 'wednesday', 'wednesday': 'wednesday',
  'czwartek': 'thursday', 'thursday': 'thursday',
  'piątek': 'friday', 'piatek': 'friday', 'friday': 'friday',
  'sobota': 'saturday', 'saturday': 'saturday',
  'niedziela': 'sunday', 'sunday': 'sunday',
}

const fullTimeDaysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const partTimeDaysOrder = ['friday', 'saturday', 'sunday'];
const dayLabels = {
  monday: 'Poniedziałek', tuesday: 'Wtorek', wednesday: 'Środa',
  thursday: 'Czwartek', friday: 'Piątek', saturday: 'Sobota', sunday: 'Niedziela',
}

const formatTime = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return '';
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const getPlanSemester = (plan) => String(plan?.planKey || '').split('|')[0].trim();

function ViewPlan({ user, onBack }) {
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [planList, setPlanList] = useState([]);
  const [selectedPlanValue, setSelectedPlanValue] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('all');
  
  const studyMode = user?.tryb || 'STAC';
  const availableSemesters = useMemo(() => {
    const semesters = new Set(planList.map(getPlanSemester).filter(Boolean));
    return ['all', ...Array.from(semesters).sort((a, b) => Number(a) - Number(b))];
  }, [planList]);

  useEffect(() => {
    const fetchStudentPlan = async () => {
      try {
        setLoading(true);
        const studentId = user?.idstudent || user?.id;
        const availablePlans = await apiFetch('/plan/list');
        if (Array.isArray(availablePlans)) {
          setPlanList(availablePlans);
          if (!selectedPlanValue && availablePlans.length > 0) setSelectedPlanValue(availablePlans[0].value);
        }
        const selectedPlan = availablePlans.find((plan) => plan.value === selectedPlanValue) || availablePlans[0];
        const params = selectedPlan
          ? `?planId=${selectedPlan.planId}${selectedSemester !== 'all' ? `&planKey=${encodeURIComponent(selectedPlan.planKey)}` : ''}`
          : '';
        const studentUrl = studentId ? `/plan/student/${studentId}${params}` : '/plan/last';
        const data = await apiFetch(studentUrl);

        // Normalize payload that may come in different shapes
        const payload = data?.plan || data?.results || data || {};

        // If student has assigned semester, try to pick only variants matching that semester
        const semMatch = user?.rok_semestr ? String(user.rok_semestr).match(/(\d+)$/) : null;
        const studentSem = semMatch ? semMatch[1] : null;

        let entries = [];

        if (studentSem && payload && typeof payload === 'object' && !Array.isArray(payload)) {
          // payload may be an object keyed by variant keys like '5|ASiSK|STAC'
          const source = payload.results && typeof payload.results === 'object' ? payload.results : (payload.plan && typeof payload.plan === 'object' ? payload.plan : payload);
          if (source && typeof source === 'object') {
            for (const key of Object.keys(source)) {
              const [sem] = String(key).split('|');
              if (sem === studentSem) {
                const variant = source[key];
                if (Array.isArray(variant?.plan)) {
                  entries = entries.concat(variant.plan);
                } else if (Array.isArray(variant)) {
                  entries = entries.concat(variant);
                }
              }
            }
          }
        }

        // Fallback: flatten any array shapes in payload
        if (entries.length === 0) {
          const planPayload = data?.plan;
          entries = Array.isArray(planPayload)
            ? planPayload
            : Array.isArray(planPayload?.plan)
              ? planPayload.plan
              : Object.values(planPayload || {}).flatMap(part => Array.isArray(part?.plan) ? part.plan : (Array.isArray(part) ? part : []));
        }

        setPlanData(entries);
        setError(null);
      } catch (err) {
        setError(err.message);
        setPlanData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentPlan();
  }, [user?.id, user?.idstudent, user?.rok_semestr, selectedPlanValue, selectedSemester]);

  const effectivePlan = useMemo(() => {
    return planData.map(item => ({
      day: item.day || item.day_of_week,
      time: item.time || item.time_day,
      name: item.name || item.przedmiot,
      type: item.type || item.typ,
      group: item.group || item.grupa_nazwa,
      room: item.room || (item.sala_id ? `Sala ${item.sala_id}` : ''),
      lecturer: item.lecturer || null,
      start: (item.time || item.time_day || '').split('-')[0]?.trim().slice(0, 5),
      end: (item.time || item.end_time_day || '').split('-')[1]?.trim().slice(0, 5) || item.end_time_day?.slice(0, 5),
    }));
  }, [planData]);

  const groups = useMemo(() => {
    const g = new Set();
    effectivePlan.forEach(item => {
      if (item.group && item.group !== 'Wszyscy') g.add(item.group);
    });
    return ['all', ...Array.from(g).sort()];
  }, [effectivePlan]);

  const daysOrder = studyMode === 'STAC' ? fullTimeDaysOrder : partTimeDaysOrder;

  const filteredPlan = useMemo(() => {
    if (selectedGroup === 'all') return effectivePlan;
    return effectivePlan.filter(item => item.group === selectedGroup);
  }, [effectivePlan, selectedGroup]);

  const schedule = useMemo(() => {
    if (!Array.isArray(filteredPlan) || filteredPlan.length === 0) return [];

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const planWithDuration = filteredPlan.map((item) => {
      const startMinutes = timeToMinutes(item.start);
      const endMinutes = timeToMinutes(item.end);
      const durationInMinutes = (endMinutes > startMinutes) ? (endMinutes - startMinutes) : 90;
      const dayKey = dayMap[item.day?.toLowerCase()] || null;
      return { ...item, duration: durationInMinutes, dayKey };
    });

    const scheduleStartMinutes = 8 * 60;
    const scheduleEndMinutes = 24 * 60;
    const slots = Array.from({ length: (scheduleEndMinutes - scheduleStartMinutes) / 15 }, (_, i) => {
      const totalMinutes = scheduleStartMinutes + i * 15;
      return formatTime(totalMinutes);
    });

    const grid = slots.map((slotTime) => {
      const row = { time: slotTime };
      daysOrder.forEach((day) => {
        row[day] = { items: [], covered: false, rowSpan: 1 };
      });
      return row;
    });

    const itemsByDay = {};
    planWithDuration.forEach((item) => {
      if (!item.dayKey || !item.start || !item.duration) return;
      const startMinutes = timeToMinutes(item.start);
      if (startMinutes < scheduleStartMinutes || startMinutes >= scheduleEndMinutes) return;
      if (!itemsByDay[item.dayKey]) itemsByDay[item.dayKey] = [];
      itemsByDay[item.dayKey].push({ ...item, startMinutes });
    });

    Object.entries(itemsByDay).forEach(([dayKey, items]) => {
      items.sort((a, b) => a.startMinutes - b.startMinutes);
      let previousEnd = null;
      let previousStart = null;
      let layoutStartMinutes = null;

      items.forEach((item) => {
        const sameSegmentAsPrevious = previousStart === item.startMinutes;
        if (!sameSegmentAsPrevious) {
          layoutStartMinutes = item.startMinutes;
        }

        const startSlotIndex = Math.floor((layoutStartMinutes - scheduleStartMinutes) / 15);
        if (startSlotIndex < 0 || startSlotIndex >= grid.length) return;

        const rowSpan = Math.max(1, Math.ceil(item.duration / 15));
        const dayCell = grid[startSlotIndex]?.[dayKey];
        if (!dayCell) return;

        dayCell.items.push({
          name: item.name || 'Zajęcia',
          details: [item.type, item.room].filter(Boolean).join(' • '),
          rowSpan,
          start: formatTime(layoutStartMinutes),
          end: formatTime(layoutStartMinutes + item.duration),
          group: item.group,
        });

        dayCell.rowSpan = Math.max(dayCell.rowSpan || 1, rowSpan);

        for (let i = 1; i < rowSpan; i += 1) {
          const nextSlotIndex = startSlotIndex + i;
          if (nextSlotIndex < grid.length) {
            grid[nextSlotIndex][dayKey].covered = true;
          }
        }

        previousStart = item.startMinutes;
        previousEnd = Math.max(previousEnd || 0, layoutStartMinutes + item.duration);
      });
    });

    grid.forEach((row) => daysOrder.forEach((day) => {
      const cell = row[day];
      if (!cell || cell.items.length < 2) return;
      const sharedStart = Math.min(...cell.items.map((item) => timeToMinutes(item.start)));
      const sharedEnd = Math.max(...cell.items.map((item) => timeToMinutes(item.end)));
      cell.items = cell.items.map((item) => ({ ...item, start: formatTime(sharedStart), end: formatTime(sharedEnd) }));
    }));

    return grid;
  }, [filteredPlan, daysOrder]);

  const dayColumnMinWidth = useMemo(() => {
    const widths = {};
    const sequences = {};
    daysOrder.forEach((day) => {
      widths[day] = undefined;
      sequences[day] = { current: 0, prevEndRow: 0, max: 0 };
    });

    schedule.forEach((row, rowIndex) => {
      daysOrder.forEach((day) => {
        const cell = row[day];
        if (!cell || cell.covered) return;

        if (Array.isArray(cell.items) && cell.items.length >= 3) {
          widths[day] = '280px';
        }

        const seq = sequences[day];
        const startRow = rowIndex;
        const endRow = rowIndex + (cell.rowSpan || 1);

        if (startRow === seq.prevEndRow || startRow === seq.prevEndRow + 1) {
          seq.current += 1;
        } else {
          seq.current = 1;
        }
        seq.prevEndRow = endRow;
        if (seq.current > seq.max) seq.max = seq.current;
      });
    });

    daysOrder.forEach((day) => {
      if (sequences[day].max >= 3) {
        widths[day] = '280px';
      }
    });

    return widths;
  }, [schedule, daysOrder]);

  return (
    <div className="student-plan-page">
      <div className="student-plan-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">Plan zajęć</div>
            <h1>Aktualny plan zajęć</h1>
            <p className="plan-subtitle">
              Zalogowano jako <strong>{user?.login || 'student'}</strong>
            </p>
          </div>

          {availableSemesters.length > 1 && (
            <div className="plan-select">
              <label>
                Semestr
                <select value={selectedSemester} onChange={(e) => {
                  const semester = e.target.value;
                  setSelectedSemester(semester);
                  const matchingPlan = semester === 'all'
                    ? planList[0]
                    : planList.find((plan) => getPlanSemester(plan) === semester);
                  if (matchingPlan) setSelectedPlanValue(matchingPlan.value);
                }} disabled={loading}>
                  {availableSemesters.map((semester) => (
                    <option key={semester} value={semester}>{semester === 'all' ? 'Wszystkie' : `Semestr ${semester}`}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {groups.length > 1 && (
            <div className="plan-select">
              <label>
                Filtruj grupę
                <select value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                  {groups.map(g => (
                    <option key={g} value={g}>
                      {g === 'all' ? 'Wszystkie grupy' : g}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>

        {loading && <p>Ładowanie planu...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && schedule.length > 0 && (
          <div className="schedule-wrapper" style={{ ['--slots-count']: schedule.length, ['--hours-count']: Math.max(1, Math.ceil(schedule.length / 4)), ['--slot-height']: '32px' }}>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '80px' }}>Godzina</th>
                  {daysOrder.map(day => (
                    <th key={day} style={dayColumnMinWidth[day] ? { minWidth: dayColumnMinWidth[day], width: dayColumnMinWidth[day] } : undefined}>
                      {dayLabels[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.time}>
                    <td className="time-cell">{row.time.slice(0, 5)}</td>
                    {daysOrder.map(day => {
                      const cellData = row[day];
                      if (!cellData || cellData.covered) {
                        return null;
                      }
                      return (
                        <td
                          key={day}
                          className="plan-cell"
                          rowSpan={cellData.rowSpan || 1}
                          style={dayColumnMinWidth[day] ? { minWidth: dayColumnMinWidth[day], width: dayColumnMinWidth[day] } : undefined}
                        >
                          {cellData.items.length > 0 && (
                            <div className="plan-cell-content" style={{ gridTemplateColumns: `repeat(${cellData.items.length}, minmax(0, 1fr))` }}>
                              {cellData.items.map((item, itemIdx) => (
                                <div key={itemIdx} className="plan-block plan-block--exercise" style={{ alignSelf: 'start', height: `calc(${item.rowSpan} * var(--slot-height))` }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="plan-block-title" title={item.fullName || item.name}>{item.name}</div>
                                    {item.group && item.group !== 'Wszyscy' && (
                                      <div className="group-badge">gr. {item.group}</div>
                                    )}
                                  </div>
                                  {item.start && item.end && (
                                    <div className="time-label">{item.start} — {item.end}</div>
                                  )}
                                  {item.details && (
                                    <div className="plan-block-details">{item.details}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && schedule.length === 0 && (
          <div className="empty-state">
            <p>Brak danych do wyświetlenia dla wybranych kryteriów.</p>
          </div>
        )}

        <button type="button" className="card-back-button" onClick={onBack}>
          Powrót do menu
        </button>
      </div>
    </div>
  );
}

export default ViewPlan
