import React, { useMemo } from 'react'

export default function EditZajecia({ style, title = 'Edytuj zajęcia', classData = {}, formData = {}, status = {}, subjects = [], rooms = [], lecturers = [], weekdays = [], classTypes = [], onChange, onCancel, onSave }) {
  const handleChange = (e) => {
    const { name, options } = e.target;
    if (name === 'allowedDays') {
      const selectedDays = Array.from(options)
        .filter(option => option.selected)
        .map(option => option.value);
      // Pass a synthetic event object to the parent handler
      onChange({ target: { name, value: selectedDays } });
    } else {
      onChange(e);
    }
  }

  const normalizeTime = (value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      return `${trimmed}:00`
    }
    return trimmed
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      subjectId: formData.subjectId || '',
      przedmiot_id: formData.subjectId ? Number(formData.subjectId) : null,
      lecturerId: formData.lecturerId || '',
      wykladowca_id: formData.lecturerId ? Number(formData.lecturerId) : null,
      type: formData.type || null,
      typ: formData.type || null,
      time: normalizeTime(formData.time || ''),
      czas: normalizeTime(formData.time || ''),
      roomId: formData.roomId || '',
      sala_id: formData.roomId ? Number(formData.roomId) : null,
      grupa: formData.groupId ? Number(formData.groupId) : null,
      groupId: formData.groupId || '',
      data_rozpoczecia: formData.data_rozpoczecia || null,
      data_zakonczenia: formData.data_zakonczenia || null,
      allowedDays: formData.allowedDays || [],
    })
  }

  const selectedSubjectTryb = useMemo(() => {
    if (!formData.subjectId) return null
    const subject = subjects.find(s => s.id === Number(formData.subjectId))
    return subject?.tryb || null
  }, [formData.subjectId, subjects])

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">{title}</div>
            <h1>{title}</h1>
            <p className="plan-subtitle">Zmień dane zajęć i zapisz.</p>
          </div>
        </div>

        {status.message && (
          <div className={`admin-status-message ${status.type || ''}`} style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}>
            {status.message}
          </div>
        )}
        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>
            Wykładowca
            <select
              name="lecturerId"
              value={formData.lecturerId || ''}
              onChange={handleChange}
            >
              <option value="">Brak wykładowcy</option>
              {lecturers.map((lect) => (
                <option key={lect.id} value={lect.id}>
                  {lect.firstName && lect.lastName
                    ? `${lect.firstName} ${lect.lastName}${lect.title ? `, ${lect.title}` : ''}`
                    : (lect.id ? `ID: ${lect.id}` : '')}
                </option>
              ))}
            </select>
          </label>

          <label>
            Przedmiot
            <select name="subjectId" value={formData.subjectId || ''} onChange={handleChange} required>
              <option value="">Wybierz przedmiot</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name || `Przedmiot ${subject.id}`} {subject.tryb ? `(${subject.tryb})` : ''}
                </option>
              ))}
            </select>
          </label>
          {subjects.length === 0 && (
            <div style={{ color: '#b22222', marginBottom: '1rem' }}>
              Brak dostępnych przedmiotów. Najpierw dodaj przedmiot w sekcji "Przedmioty".
            </div>
          )}


          <label>
            Grupa
            <input
              type="number"
              name="groupId"
              placeholder="np. 1 (opcjonalnie)"
              value={formData.groupId || ''}
              onChange={handleChange}
            />
          </label>

          <label>
            Dozwolone dni tygodnia (opcjonalnie)
            <select
              name="allowedDays"
              multiple
              value={formData.allowedDays || []}
              onChange={handleChange}
              style={{ height: '150px' }}
            >
              {weekdays.map(day => (
                <option key={day.value} value={day.value}>{day.label}</option>
              ))}
            </select>
          </label>

          <label>
            Data rozpoczęcia
            <input
              type="date"
              name="data_rozpoczecia"
              value={formData.data_rozpoczecia || ''}
              onChange={handleChange}
            />
          </label>

          <label>
            Data zakończenia
            <input
              type="date"
              name="data_zakonczenia"
              value={formData.data_zakonczenia || ''}
              onChange={handleChange}
            />
          </label>

          <label>
            Typ
            <select name="type" value={formData.type || ''} onChange={handleChange} required>
              <option value="">Wybierz typ</option>
              {(classTypes || []).map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Czas
            <input
              type="time"
              name="time"
              placeholder="HH:MM:SS"
              value={formData.time || ''}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Sala
            <select name="roomId" value={formData.roomId ?? ''} onChange={handleChange}>
              <option value="">— brak / nie ustawiaj —</option>

              {(rooms || []).map((r) => (
                <option key={r.id_sala ?? r.id} value={r.id_sala ?? r.id}>
                  {r.nazwa || r.budynek
                    ? `${r.nazwa || r.id} (${r.budynek || '-'})`
                    : `Sala ${(r.id_sala ?? r.id)}`}
                </option>
              ))}
            </select>
          </label>


          <div className="admin-form-actions">
            <button type="submit" disabled={subjects.length === 0}>Zapisz</button>
            <button type="button" className="card-back-button" onClick={onCancel}>
              Anuluj
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
