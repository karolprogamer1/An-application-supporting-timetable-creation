import React, { useMemo, useState } from 'react'

export default function AssignStudentToGroup({
  style,
  title = 'Przydziel studenta do grupy',
  students = [],
  classes = [],
  formData = { studentIds: [], zajeciaId: '' },
  onChange,
  onCancel,
  onSave,
  status,
}) {
  const [localError, setLocalError] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [pastedText, setPastedText] = useState('')

  const studentOptions = useMemo(() => students || [], [students]) // All students are options
  const classesOptions = useMemo(() => classes || [], [classes])

  const handleChange = (e) => {
    const { name, value } = e.target
    setLocalError('')
    
    if (e.target.multiple) {
      const values = Array.from(e.target.selectedOptions).map((option) => option.value)
      onChange({ ...formData, [name]: values }) // No filtering based on zajeciaId here
    } else {
      onChange({ ...formData, [name]: value })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const { studentIds, zajeciaId } = formData

    if (!studentIds || studentIds.length === 0) {
      setLocalError('Wybierz przynajmniej jednego studenta.')
      return
    }
    if (!zajeciaId) {
      setLocalError('Wybierz zajęcia.')
      return
    }

    onSave({
      studentIds: studentIds.map(id => Number(id)),
      zajeciaId: Number(zajeciaId),
    })
  }

  const handleBulkResolve = () => {
    // Split by any whitespace (space, tab, newline) or common separators
    const items = pastedText.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)
    const foundIds = []
    const missing = []

    items.forEach(item => {
      const s = students.find(st => 
        String(st.indexNumber) === item || 
        String(st.nr_albumu) === item || 
        st.login === item ||
        st.user_login === item
      )
      if (s) {
        foundIds.push(String(s.id)); // No zajeciaId filtering for bulk
      }
      else missing.push(item)
    })

    if (missing.length > 0) setLocalError(`Nie znaleziono studentów: ${missing.join(', ')}`)
    else setLocalError('')

    onChange({ ...formData, studentIds: Array.from(new Set([...(formData.studentIds || []), ...foundIds])) })
    setPastedText('')
  }

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">{title}</div>
            <h1>{title}</h1>
            <p className="plan-subtitle">Wybierz studentów i zajęcia. System automatycznie zaktualizuje ich przypisanie do zajęć w bazie oraz doda ich do grupy.</p>
          </div>
        </div>

        {(status?.message || localError) && (
          <div
            className={`admin-status-message ${status?.type || (localError ? 'error' : 'success')}`}
            style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}
          >
            {localError || status?.message}
          </div>
        )}

        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>
            Zajęcia
            <select name="zajeciaId" value={formData.zajeciaId || ''} onChange={handleChange}>
              <option value="">-- najpierw wybierz zajęcia --</option>
              {classesOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} {c.subjectName ? `| ${c.subjectName}` : ''} {c.groupId ? ` (Gr. ${c.groupId})` : ''} {c.type ? `| ${c.type}` : ''} {c.time ? `| ${c.time}` : ''}
                </option>
              ))}
            </select>
            <small style={{ color: '#666' }}>Wszyscy studenci są dostępni. Ich przypisanie do zajęć zostanie zaktualizowane automatycznie przy zapisie.</small>
          </label>

          <hr style={{ margin: '1.5rem 0', opacity: 0.2 }} />

          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button" 
              style={{ flex: 1, background: !bulkMode ? '#007bff' : '#f0f0f0', color: !bulkMode ? '#fff' : '#333', border: '1px solid #ddd' }}
              onClick={() => setBulkMode(false)}
            >
              Wybór z listy
            </button>
            <button 
              type="button" 
              style={{ flex: 1, background: bulkMode ? '#007bff' : '#f0f0f0', color: bulkMode ? '#fff' : '#333', border: '1px solid #ddd' }}
              onClick={() => setBulkMode(true)}
            >
              Wklej z Excela
            </button>
          </div>

          {!bulkMode ? (
            <label>
              Studenci (wybór wielokrotny: Ctrl + kliknięcie)
              <select 
                name="studentIds" 
                multiple 
                style={{ height: '150px' }} 
                value={formData.studentIds || []} 
                onChange={handleChange}
              >
                {studentOptions.map((s) => ( // Use all student options
                  <option key={s.id} value={s.id}>
                    {s.indexNumber || s.nr_albumu || '-'} / {s.login || s.user_login || '-'}
                  </option>
                ))}
              </select>
              <small style={{ display: 'block', marginTop: '4px' }}>
                Dostępnych: {studentOptions.length}. Wybrano: {formData.studentIds?.length || 0}.
              </small>
            </label>
          ) : (
            <label>
              Wklej dane (nr albumu lub login)
              <textarea
                style={{ height: '100px', width: '100%', padding: '0.5rem', marginTop: '0.5rem', fontFamily: 'monospace' }}
                placeholder="Wklej kolumnę z Excela tutaj..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={handleBulkResolve} style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                  Dodaj rozpoznanych studentów
                </button>
                <button type="button" className="card-back-button" onClick={() => onChange({ ...formData, studentIds: [] })} style={{ width: 'auto', padding: '0.5rem 1rem' }}>
                  Wyczyść wybór ({formData.studentIds?.length || 0})
                </button>
              </div>
            </label>
          )}



          <div className="admin-form-actions">
            <button type="submit">Przydziel</button>
            <button type="button" className="card-back-button" onClick={onCancel}>
              Anuluj
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
