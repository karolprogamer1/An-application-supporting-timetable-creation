import React from 'react'

export default function AddLecturer({
  style,
  title = 'Dodaj wykładowcę',
  formData = {},
  status = {},
  onChange,
  onCancel,
  onSave,
}) {
  const handleChange = (e) => {
    onChange(e)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">{title}</div>
            <h1>{title}</h1>
            <p className="plan-subtitle">Wypełnij formularz, aby dodać nowego wykładowcę.</p>
          </div>
        </div>

        {status?.message && (
          <div className={`admin-status-message ${status.type || ''}`} style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}>
            {status.message}
          </div>
        )}

        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>
            Użytkownik ID
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="userId"
              placeholder="ID użytkownika"
              value={formData.userId || ''}
              onChange={handleChange}
            />
          </label>

          <label>
            Imię
            <input type="text" name="firstName" placeholder="Imię" value={formData.firstName || ''} onChange={handleChange} />
          </label>

          <label>
            Nazwisko
            <input type="text" name="lastName" placeholder="Nazwisko" value={formData.lastName || ''} onChange={handleChange} />
          </label>

          <label>
            Tytuł naukowy
            <input type="text" name="title" placeholder="Tytuł naukowy" value={formData.title || ''} onChange={handleChange} />
          </label>

          <h2 className="plan-subtitle" style={{ marginTop: '1.5rem' }}>Dane logowania wykładowcy</h2>
          <label>
            Login
            <input type="text" name="login" placeholder="login" value={formData.login || ''} onChange={handleChange} />
          </label>
          <label>
            Hasło
            <input type="password" name="password" placeholder="hasło" value={formData.password || ''} onChange={handleChange} />
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