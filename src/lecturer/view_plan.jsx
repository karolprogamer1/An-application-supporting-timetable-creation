import { useState, useEffect, useMemo } from 'react'
import { apiFetch } from '../api'

const dayMap = {
  poniedziałek: 'monday', poniedzialek: 'monday', monday: 'monday',
  wtorek: 'tuesday', tuesday: 'tuesday',
  środa: 'wednesday', sroda: 'wednesday', wednesday: 'wednesday',
  czwartek: 'thursday', thursday: 'thursday',
  piątek: 'friday', piatek: 'friday', friday: 'friday',
  sobota: 'saturday', saturday: 'saturday',
  niedziela: 'sunday', sunday: 'sunday',
}

const fullTimeDaysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const partTimeDaysOrder = ['friday', 'saturday', 'sunday']
const dayLabels = {
  monday: 'Poniedziałek',
  tuesday: 'Wtorek',
  wednesday: 'Środa',
  thursday: 'Czwartek',
  friday: 'Piątek',
  saturday: 'Sobota',
  sunday: 'Niedziela',
}

const normalizeDayKey = (value) => {
  if (!value) return null
  return dayMap[String(value).trim().toLowerCase()] || null
}

const timeToMinutes = (timeStr) => {
  if (!timeStr) return null
  const parts = String(timeStr).split(':').map((part) => Number(part.trim()))
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null
  return parts[0] * 60 + parts[1]
}

const formatTime = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return ''
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

const parseDurationToMinutes = (duration, start, end) => {
  if (duration != null) {
    if (typeof duration === 'number') return duration
    if (typeof duration === 'string') {
      const normalized = duration.trim().toLowerCase()
      if (normalized.endsWith('min')) {
        return parseInt(normalized, 10)
      }
      if (/^(\d+)(h|g)$/.test(normalized)) {
        return parseInt(normalized, 10) * 60
      }
      const match = normalized.match(/(\d+)h(?:\s*(\d+)min)?/)
      if (match) {
        return Number(match[1]) * 60 + (match[2] ? Number(match[2]) : 0)
      }
      const num = Number(normalized)
      if (!Number.isNaN(num)) return num
    }
  }
  if (start && end) {
    const startMin = timeToMinutes(start)
    const endMin = timeToMinutes(end)
    if (startMin != null && endMin != null && endMin > startMin) {
      return endMin - startMin
    }
  }
  return 90
}

const getPlanSemester = (plan) => String(plan?.planKey || '').split('|')[0].trim()

const normalizeClassType = (type) => {
  if (!type) return 'other'
  const value = String(type).toLowerCase()
  if (value.includes('wyk')) return 'lecture'
  if (value.includes('ćwic') || value.includes('cwic') || value.includes('cwicz')) return 'exercise'
  if (value.includes('lab') || value.includes('labor')) return 'lab'
  if (value.includes('proj')) return 'project'
  if (value.includes('sem')) return 'seminar'
  return 'other'
}

const buildGridRows = (entries, studyMode = 'STAC') => {
  const days = (studyMode === 'NSTAC' || studyMode === 'NS') ? partTimeDaysOrder : fullTimeDaysOrder
  const allRows = Array.from({ length: ((24 - 8) * 60) / 15 }, (_, idx) => {
    const minutes = 8 * 60 + idx * 15
    const time = formatTime(minutes)
    const row = { time }
    days.forEach((day) => {
      row[day] = { items: [], covered: false, rowSpan: 1 }
    })
    return row
  })

  // Collect items per day first so we can enforce a minimum 15-minute gap between them
  const itemsByDay = {}

  entries.forEach((entry) => {
    const dayKey = normalizeDayKey(entry.day || entry.day_of_week || entry.dzien || entry.dzien_tygodnia)
    const rawTime = entry.time || entry.time_day || `${entry.start || ''} - ${entry.end || ''}`.trim()
    if (!dayKey || !rawTime) return

    const parts = rawTime.split('-').map((p) => p.trim())
    const start = parts[0] || ''
    const end = parts[1] || ''
    const duration = parseDurationToMinutes(entry.duration || entry.czas || entry.duration_in_minutes, start, end)
    const startMinutes = timeToMinutes(start)
    if (startMinutes == null) return

    const group = Array.isArray(entry.group) ? entry.group.join(', ') : entry.group || entry.grupa || entry.grupa_nazwa || ''
    const details = [entry.type || entry.typ, entry.specjalnosc || entry.specialization, entry.room || (entry.sala_id ? `Sala ${entry.sala_id}` : null), entry.lecturer].filter(Boolean).join(' • ')

    const item = {
      name: entry.name || entry.przedmiot || 'Zajęcia',
      fullName: entry.fullName || entry.name || entry.przedmiot || 'Zajęcia',
      details,
      duration,
      startMinutes,
      originalStart: start,
      originalEnd: end,
      group,
      planType: normalizeClassType(entry.type || entry.typ),
      data_rozpoczecia: entry.data_rozpoczecia,
      data_zakonczenia: entry.data_zakonczenia,
    }

    if (!itemsByDay[dayKey]) itemsByDay[dayKey] = []
    itemsByDay[dayKey].push(item)
  })

  // For each day, sort items by start and enforce at least 15 minutes gap between consecutive items
  Object.keys(itemsByDay).forEach((dayKey) => {
    const list = itemsByDay[dayKey]
    list.sort((a, b) => a.startMinutes - b.startMinutes)
    let prevEnd = null
    let prevStart = null
    let layoutStartMinutes = null
    list.forEach((item) => {
      const sameSegmentAsPrevious = prevStart != null && item.originalStart === prevStart
      if (!sameSegmentAsPrevious) {
        layoutStartMinutes = item.startMinutes
      }

      const startIndex = Math.floor((layoutStartMinutes - 8 * 60) / 15)
      if (startIndex < 0 || startIndex >= allRows.length) {
        prevEnd = item.startMinutes + item.duration
        return
      }

      const rowSpan = Math.max(1, Math.ceil(item.duration / 15))
      const dayCell = allRows[startIndex][dayKey]
      if (!dayCell) {
        prevEnd = item.startMinutes + item.duration
        return
      }

      const startStr = formatTime(layoutStartMinutes)
      const endStr = formatTime(layoutStartMinutes + item.duration)

      dayCell.items.push({
        name: item.name,
        fullName: item.fullName,
        details: item.details,
        rowSpan,
        start: startStr,
        end: endStr,
        group: item.group,
        planType: item.planType,
        data_rozpoczecia: item.data_rozpoczecia,
        data_zakonczenia: item.data_zakonczenia,
      })
      dayCell.rowSpan = Math.max(dayCell.rowSpan, rowSpan)

      for (let offset = 1; offset < rowSpan; offset += 1) {
        const nextIndex = startIndex + offset
        if (nextIndex < allRows.length) {
          allRows[nextIndex][dayKey].covered = true
        }
      }

      prevStart = item.originalStart
      prevEnd = Math.max(prevEnd || 0, layoutStartMinutes + item.duration)
    })
  })

  allRows.forEach((row) => days.forEach((day) => {
    const cell = row[day]
    if (!cell || cell.items.length < 2) return
    const sharedStart = Math.min(...cell.items.map((item) => timeToMinutes(item.start)))
    const sharedEnd = Math.max(...cell.items.map((item) => timeToMinutes(item.end)))
    cell.items = cell.items.map((item) => ({ ...item, start: formatTime(sharedStart), end: formatTime(sharedEnd) }))
  }))

  // Return the full grid including empty rows so the lecturer view
  // shows the complete time grid (matching other plan views).
  return allRows
}

const ScheduleGrid = ({ schedule, studyMode = 'STAC' }) => {
  const days = (studyMode === 'NSTAC' || studyMode === 'NS') ? partTimeDaysOrder : fullTimeDaysOrder

  return (
    <div className="schedule-wrapper" style={{ ['--slot-height']: '32px' }}>
      <table className="schedule-table">
        <thead>
          <tr>
            <th style={{ minWidth: '80px' }}>Godzina</th>
            {days.map((day) => (
              <th key={day}>{dayLabels[day]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.map((row) => (
            <tr key={row.time}>
              <td className="time-cell">{row.time}</td>
              {days.map((day) => {
                const cell = row[day]
                if (!cell || cell.covered) return null
                return (
                  <td key={day} rowSpan={cell.rowSpan || 1} className="plan-cell">
                    {cell.items.length > 0 ? (
                      <div className="plan-cell-content" style={{ display: 'grid', gridTemplateColumns: `repeat(${cell.items.length}, minmax(0, 1fr))`, gap: '8px', alignItems: 'stretch' }}>
                        {cell.items.map((item, index) => {
                          const blockStyle = {
                            alignSelf: 'start',
                            minHeight: `calc(${item.rowSpan} * var(--slot-height))`,
                            flex: '1 1 0',
                            minWidth: 0,
                          }

                          return (
                            <div key={`${item.name}-${index}`} className={`plan-block plan-block--${item.planType}`} style={blockStyle}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                <div className="plan-block-title" title={item.fullName}>{item.name}</div>
                                {item.group ? <div className="group-badge">gr. {item.group}</div> : null}
                              </div>
                              {item.start && item.end ? <div className="time-label">{item.start} — {item.end}</div> : null}
                              {item.details ? <div className="plan-block-details">{item.details}</div> : null}
                              {(item.data_rozpoczecia || item.data_zakonczenia) ? (
                                <div style={{ marginTop: 'auto', paddingTop: '6px', fontSize: '0.78rem', opacity: 0.85, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                                  {item.data_rozpoczecia || '-'} — {item.data_zakonczenia || '-'}
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ViewPlan({ user, onBack }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [studyMode, setStudyMode] = useState('STAC')
  const [flatEntries, setFlatEntries] = useState([])
  const [planList, setPlanList] = useState([])
  const [selectedPlanValue, setSelectedPlanValue] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('all')

  const availableSemesters = useMemo(() => {
    const semesters = new Set(planList.map(getPlanSemester).filter(Boolean))
    return ['all', ...Array.from(semesters).sort((a, b) => Number(a) - Number(b))]
  }, [planList])

  useEffect(() => {
    const fetchPlan = async () => {
      const lecturerId = user?.id || user?.idwykladowca
      if (!lecturerId) {
        setError('Nieprawidłowy identyfikator wykładowcy')
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
          const listRes = await apiFetch('/plan/list')
        const availablePlans = listRes.ok ? await listRes.json() : []
        if (Array.isArray(availablePlans)) {
          setPlanList(availablePlans)
          if (!selectedPlanValue && availablePlans.length > 0) setSelectedPlanValue(availablePlans[0].value)
        }
        const selectedPlan = availablePlans.find((plan) => plan.value === selectedPlanValue) || availablePlans[0]
        const params = selectedPlan
          ? `?planId=${selectedPlan.planId}${selectedSemester !== 'all' ? `&planKey=${encodeURIComponent(selectedPlan.planKey)}` : ''}`
          : ''
          const res = await apiFetch(`/plan/lecturer/${lecturerId}${params}`)
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error || 'Nie udało się pobrać planu wykładowcy')
        }

        const data = await res.json()

        // Normalize payload that may come in different shapes
        const payload = data?.results || data || {}

        let flattened = []

        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const source = payload.results && typeof payload.results === 'object' ? payload.results : (payload.plan && typeof payload.plan === 'object' ? payload.plan : payload)
          if (source && typeof source === 'object') {
            flattened = Object.values(source).flatMap((value) => {
              if (Array.isArray(value)) return value
              if (Array.isArray(value?.plan)) return value.plan
              return []
            })
          }
        }

        // Also set a flattened deduplicated list as fallback when no variants
        if (Array.isArray(payload)) {
          flattened = payload
        } else if (payload && typeof payload === 'object') {
          flattened = Object.values(payload).flatMap((value) => {
            if (Array.isArray(value)) return value
            if (Array.isArray(value?.plan)) return value.plan
            return []
          })
        }

        // Deduplicate flattened entries
        const seen = new Set()
        flattened = flattened.filter((e) => {
          const startRaw = e.start || (e.time || e.time_day || '').split('-')[0] || ''
          const endRaw = e.end || (e.time || e.time_day || '').split('-')[1] || ''
          const groupRaw = Array.isArray(e.group) ? e.group.join(',') : (e.group || e.grupa || e.grupa_nazwa || '')
          const key = [
            String(e.day || e.day_of_week || e.dzien || '').trim().toLowerCase(),
            String(startRaw).trim(),
            String(endRaw).trim(),
            String(e.name || e.przedmiot || '').trim().toLowerCase(),
            String(groupRaw).trim().toLowerCase(),
          ].join('|')
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        setFlatEntries(flattened)

        if (data?.metadata?.study_mode) {
          setStudyMode(data.metadata.study_mode)
        }
      } catch (fetchError) {
        setError(fetchError.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPlan()
  }, [user?.id, user?.idwykladowca, selectedPlanValue, selectedSemester])

  const displayedEntries = useMemo(() => flatEntries || [], [flatEntries])

  const schedule = useMemo(() => buildGridRows(displayedEntries, studyMode), [displayedEntries, studyMode])

  return (
    <div className="student-plan-page">
      <div className="student-plan-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">Plan zajęć</div>
            <h1>Plan prowadzącego</h1>
            <p className="plan-subtitle">
              Wykładowca: <strong>{user?.login || 'wykładowca'}</strong>
            </p>
          </div>
          {availableSemesters.length > 1 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Semestr:
              <select value={selectedSemester} onChange={(e) => {
                const semester = e.target.value
                setSelectedSemester(semester)
                const matchingPlan = semester === 'all'
                  ? planList[0]
                  : planList.find((plan) => getPlanSemester(plan) === semester)
                if (matchingPlan) setSelectedPlanValue(matchingPlan.value)
              }} disabled={loading}>
                {availableSemesters.map((semester) => (
                  <option key={semester} value={semester}>{semester === 'all' ? 'Wszystkie' : `Semestr ${semester}`}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading && <div>Ładowanie planu...</div>}
        {!loading && error && <div className="error-message">{error}</div>}
        {!loading && !error && displayedEntries.length === 0 && (
          <div className="empty-state">
            <p>Brak zajęć do wyświetlenia dla tego wykładowcy.</p>
          </div>
        )}

        {!loading && !error && displayedEntries.length > 0 && (
          <ScheduleGrid schedule={schedule} studyMode={studyMode} />
        )}

        <div className="admin-form-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="card-back-button" onClick={onBack}>
            Powrót do menu
          </button>
        </div>
      </div>
    </div>
  )
}

export default ViewPlan
