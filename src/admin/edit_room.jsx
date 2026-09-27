import React from 'react'

export default function EditRoom({ style, title = 'Edytuj salę', room, formData = {}, onChange, onCancel, onSave, status }) {
  const handleChange = (e) => {
    const { name, value } = e.target
    onChange({ ...formData, [name]: value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    onSave({
      nazwa: formData.nazwa || null,
      budynek: formData.budynek || null,
      limit_studentow: formData.limit_studentow === '' || formData.limit_studentow == null ? null : Number(formData.limit_studentow),
    })
  }

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">{title}</div>
            <h1>{title}</h1>
            <p className="plan-subtitle">Zmień dane sali i zapisz.</p>
          </div>
        </div>

        {status?.message && (
          <div
            className={`admin-status-message ${status.type || ''}`}
            style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}
          >
            {status.message}
          </div>
        )}

        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>
            Nazwa sali
            <input type="text" name="nazwa" placeholder="Np. S1" value={formData.nazwa || ''} onChange={handleChange} required />
          </label>

          <label>
            Budynek
            <input type="text" name="budynek" placeholder="Np. A, B, C" value={formData.budynek || ''} onChange={handleChange} />
          </label>

          <label>
            Limit studentów
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="limit_studentow"
              placeholder="Np. 30"
              value={formData.limit_studentow || ''}
              onChange={handleChange}
            />
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

