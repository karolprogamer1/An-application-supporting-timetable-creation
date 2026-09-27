import { useMemo } from 'react'

export const availabilityDays = [
  { key: 'Poniedzialek', label: 'Poniedziałek' },
  { key: 'Wtorek', label: 'Wtorek' },
  { key: 'Sroda', label: 'Środa' },
  { key: 'Czwartek', label: 'Czwartek' },
  { key: 'Piatek', label: 'Piątek' },
  { key: 'Sobota', label: 'Sobota' },
  { key: 'Niedziela', label: 'Niedziela' },
]

export const makeDefaultSegment = () => ({ start: '08:00', end: '16:00' })

const cloneSegments = (segments) => (Array.isArray(segments) ? segments.map((s) => ({ ...s })) : [])

export default function LecturerAvailabilityForm({ availability, onChange, rooms = [] }) {
  const safe = useMemo(() => availability || {}, [availability])


  const ensureDay = (dayKey) => {
    const current = safe[dayKey]
    if (!current || typeof current !== 'object') {
      return { enabled: false, segments: [makeDefaultSegment()] }
    }
    return {
      enabled: Boolean(current.enabled),
      segments: cloneSegments(current.segments).length ? cloneSegments(current.segments) : [makeDefaultSegment()],
    }
  }

  const updateDay = (dayKey, updater) => {
    const current = ensureDay(dayKey)
    const nextDay = updater(current)
    onChange({
      ...safe,
      [dayKey]: nextDay,
    })
  }

  const handleDayToggle = (dayKey) => {
    updateDay(dayKey, (current) => ({ ...current, enabled: !current.enabled }))
  }

  const handleSegmentChange = (dayKey, idx, field) => (e) => {
    const value = e.target.value
    updateDay(dayKey, (current) => {
      const segments = cloneSegments(current.segments)
      segments[idx] = { ...(segments[idx] || makeDefaultSegment()), [field]: value }
      return { ...current, segments }
    })
  }

  const handleAddSegment = (dayKey) => {
    updateDay(dayKey, (current) => ({ ...current, segments: [...cloneSegments(current.segments), makeDefaultSegment()] }))
  }

  const handleRemoveSegment = (dayKey, idx) => {
    updateDay(dayKey, (current) => {
      const segments = cloneSegments(current.segments).filter((_, i) => i !== idx)
      return {
        ...current,
        segments: segments.length ? segments : [makeDefaultSegment()],
      }
    })
  }

  return (
    <div className="lecturer-availability-form">
      <h2>Wybierz godziny prowadzenia zajęć (availability)</h2>
      <p className="plan-subtitle">Dla każdego dnia możesz dodać wiele przedziałów (np. 08:00–10:00 i 12:00–14:00).</p>

      <div className="availability-room-filter" style={{ marginTop: '1rem' }}>
        <h3 style={{ margin: '0.5rem 0' }}>Sale dydaktyczne (dotyczy availability)</h3>
        <p className="plan-subtitle" style={{ marginTop: 0 }}>
          Wybierz sale, dla których obowiązują ustawione godziny. Jeśli nic nie wybierzesz – przyjmujemy wszystkie sale.
        </p>
        <label>
          <select
            multiple
            value={Array.isArray(safe.rooms) ? safe.rooms.map(String) : []}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value)).filter((n) => !Number.isNaN(n))
              onChange({
                ...safe,
                rooms: selected,
              })
            }}
          >
            {Array.isArray(rooms) && rooms.length > 0 ? (
              rooms.map((r) => (
                <option key={r.id_sala} value={r.id_sala}>
                  {r.nazwa || `Sala ${r.id_sala}`}
                </option>
              ))
            ) : (
              <option value="" disabled>
                Brak listy sal (prześlij prop rooms)
              </option>
            )}
          </select>
        </label>
      </div>

      <div className="availability-days">
        {availabilityDays.map((d) => {
          const day = ensureDay(d.key)
          return (
            <div key={d.key} className="availability-day">
              <label className="availability-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(day.enabled)}
                  onChange={() => handleDayToggle(d.key)}
                />
                {d.label}
              </label>

              <div className="availability-times" aria-disabled={!day.enabled}>
                {day.segments.map((seg, idx) => (
                  <div key={`${d.key}-seg-${idx}`} className="availability-segment" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <label>
                      Od
                      <input
                        type="time"
                        value={seg.start || '08:00'}
                        onChange={handleSegmentChange(d.key, idx, 'start')}
                        disabled={!day.enabled}
                      />
                    </label>
                    <label>
                      Do
                      <input
                        type="time"
                        value={seg.end || '16:00'}
                        onChange={handleSegmentChange(d.key, idx, 'end')}
                        disabled={!day.enabled}
                      />
                    </label>
                    <button
                      type="button"
                      className="availability-segment-remove"
                      onClick={() => handleRemoveSegment(d.key, idx)}
                      disabled={!day.enabled}
                      title="Usuń przedział"
                    >
                      Usuń
                    </button>
                  </div>
                ))}

                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleAddSegment(d.key)}
                    disabled={!day.enabled}
                  >
                    + Dodaj kolejny przedział
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
