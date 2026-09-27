import React, { useMemo } from 'react'

export default function EditSubject({ style, title = 'Edytuj przedmiot', subject, formData = {}, status = {}, lecturers = [], onChange, onCancel, onSave }) {
  const specializations = useMemo(() => [
    'IDSI',
    'IOSI', 'CTS', 'ISP',
    'CTS+ISP',
    'CTS+IOSI+ISP',
    'CTS+IOSI',
  ], []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };

    if (name === 'rokSemestr') {
      const sem = value.match(/\d+$/)?.[0];
      if (!sem || !['1', '5', '6', '7', '8'].includes(sem)) {
        newFormData.specjalnosc = '';
      }
    }
    onChange(newFormData);
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave({
      nazwa: formData.name || null,
      ilosc_godz: formData.hours ? Number(formData.hours) : null,
      wykladowca_id: formData.lecturerId ? Number(formData.lecturerId) : null,
      semestr: formData.rokSemestr || null,
      tryb: formData.tryb || null,
      specjalnosc: formData.specjalnosc || null,
    })
  }

  const showSpecialization = useMemo(() => {
    if (!formData.rokSemestr) return false;
    const sem = formData.rokSemestr.match(/\d+$/)?.[0];
    return sem && ['1', '5', '6', '7', '8'].includes(sem);
  }, [formData.rokSemestr]);

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">{title}</div>
            <h1>{title}</h1>
            <p className="plan-subtitle">Zmień dane przedmiotu i zapisz.</p>
          </div>
        </div>
        {status?.message && (
          <div className={`admin-status-message ${status.type || ''}`} style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}>
            {status.message}
          </div>
        )}

        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>
            Nazwa
            <input type="text" name="name" placeholder="Nazwa przedmiotu" value={formData.name || ''} onChange={handleChange} />
          </label>

          <label>
            Rok/Semestr
            <input type="text" name="rokSemestr" placeholder="np. 5 lub V" value={formData.rokSemestr || ''} onChange={handleChange} />
          </label>

          <label>
            Tryb
            <select name="tryb" value={formData.tryb || ''} onChange={handleChange}>
              <option value="">Wszystkie</option>
              <option value="STAC">Stacjonarne (STAC)</option>
              <option value="NST">Niestacjonarne (NST)</option>
            </select>
          </label>

          {showSpecialization && (
            <label>
              Specjalność
              <select name="specjalnosc" value={formData.specjalnosc || ''} onChange={handleChange}>
                <option value="">Brak</option>
                {specializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
              </select>
            </label>
          )}

          <label>
            Ilość godzin
            <input type="number" name="hours" placeholder="Ilość godzin" value={formData.hours || ''} onChange={handleChange} min="0" />
          </label>

          <label>
            Wykładowca
            <select name="lecturerId" value={formData.lecturerId || ''} onChange={handleChange}>
              <option value="">— brak / nie ustawiaj —</option>
              {(lecturers || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {`${l.firstName} ${l.lastName}`.trim()}
                </option>
              ))}
            </select>
          </label>


          <div className="admin-form-actions">
            <button type="submit">Zapisz</button>
            <button type="button" className="card-back-button" onClick={onCancel}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  )
}
