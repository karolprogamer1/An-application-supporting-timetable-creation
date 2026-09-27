import React, { useMemo } from 'react';

export default function AddStudent({ style, title = 'Dodaj studenta', formData = {}, status = {}, onChange, onCancel, onSave }) {
  const specializations = ['IOSI', 'CTS', 'ISP'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };

    // If semester changes and it's not 5 or 6, clear specialization
    if (name === 'rokSemestr') {
      const sem = value.match(/\d+$/)?.[0];
      if (!sem || !['5', '6'].includes(sem)) {
        newFormData.specjalnosc = '';
      }
    }
    onChange(newFormData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      indexNumber: formData.indexNumber,
      login: formData.login,
      password: formData.password,
      rok_semestr: formData.rokSemestr,
      tryb: formData.tryb,
      specjalnosc: formData.specjalnosc || null,
    });
  };

  const showSpecialization = useMemo(() => {
    if (!formData.rokSemestr) return false;
    const sem = formData.rokSemestr.match(/\d+$/)?.[0]; // Get semester number from "3/5"
    return sem && ['5', '6'].includes(sem);
  }, [formData.rokSemestr]);

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card admin-form-card">
        <div className="plan-header">
          <h1>{title}</h1>
          <p className="plan-subtitle">Wypełnij formularz, aby dodać nowego studenta.</p>
        </div>

        {status.message && (
          <div className={`admin-status-message ${status.type || ''}`}>{status.message}</div>
        )}

        <form className="admin-student-form" onSubmit={handleSubmit}>
          <label>Numer albumu<input type="text" name="indexNumber" value={formData.indexNumber || ''} onChange={handleChange} required /></label>
          <label>Login (opcjonalnie)<input type="text" name="login" value={formData.login || ''} onChange={handleChange} placeholder="Domyślnie numer albumu" /></label>
          <label>Hasło (opcjonalnie)<input type="password" name="password" value={formData.password || ''} onChange={handleChange} placeholder="Domyślnie 'student'" /></label>
          <label>Rok/Semestr<input type="text" name="rokSemestr" placeholder="np. 3/5" value={formData.rokSemestr || ''} onChange={handleChange} /></label>
          <label>
            Tryb studiów
            <select name="tryb" value={formData.tryb || 'STAC'} onChange={handleChange}>
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

          <div className="admin-form-actions">
            <button type="submit">Zapisz</button>
            <button type="button" className="card-back-button" onClick={onCancel}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  );
}