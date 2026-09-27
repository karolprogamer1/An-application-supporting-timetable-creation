import React, { useMemo, useState } from 'react'

export default function LecturerList({
  style,
  lecturers = [],
  onAdd,
  onEdit,
  onDelete,
  onShowAvailability,
  onImportCsv,
  onImportExcel,
  onBack,
  status,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filterText, setFilterText] = useState('')

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getLecturerStringValue = (lecturer, key) => {
    switch (key) {
      case 'id':
        return lecturer?.id ?? null
      case 'firstName':
        return lecturer?.firstName ?? null
      case 'lastName':
        return lecturer?.lastName ?? null
      case 'userId':
        return lecturer?.userId ?? null
      case 'login':
        return lecturer?.login ?? null
      case 'title':
        return lecturer?.title ?? null
      default:
        return null
    }
  }

  const filteredLecturers = useMemo(() => {
    const q = String(filterText || '').trim().toLowerCase()
    if (!q) return lecturers

    return lecturers.filter((l) => {
      // Obsługa wielu możliwych nazw pól z API/CSV
      const haystack = [
        l.id,
        l.firstName,
        l.lastName,
        l.userId,
        l.title,
        l.imie,
        l.nazwisko,
        l.login,
      ]
        .filter((x) => x != null)
        .map((x) => String(x))
        .join(' ')
        .toLowerCase()

      return haystack.includes(q)
    })
  }, [lecturers, filterText])

  const sortedLecturers = useMemo(() => {
    if (!sortConfig.key) return filteredLecturers

    const dir = sortConfig.direction === 'asc' ? 1 : -1

    const toNumber = (v) => {
      if (v == null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    return [...filteredLecturers].sort((a, b) => {
      const va = getLecturerStringValue(a, sortConfig.key)
      const vb = getLecturerStringValue(b, sortConfig.key)

      const na = toNumber(va)
      const nb = toNumber(vb)

      if (na != null && nb != null) return (na - nb) * dir

      if (va == null && vb == null) return 0
      if (va == null) return 1 * dir
      if (vb == null) return -1 * dir

      return String(va).toLowerCase().localeCompare(String(vb).toLowerCase()) * dir
    })
  }, [filteredLecturers, sortConfig])

  const SortHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey
    const arrow = isActive ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

    return (
      <th
        onClick={() => requestSort(sortKey)}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        {label}
        {arrow}
      </th>
    )
  }

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu administratora</strong>
            <div className="student-menu-user-info">Zarządzanie wykładowcami</div>
          </div>
        </div>
      </div>

      {status?.message && (
        <div className={`admin-status-message ${status.type || ''}`} style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}>
          {status.message}
        </div>
      )}

      <div className="student-plan-card">
        <div className="admin-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
          <button type="button" className="card-back-button" onClick={onBack}>
            Powrót do menu
          </button>
        </div>

        <div className="plan-header">
          <div>
            <div className="plan-label">Wykładowcy</div>
            <h1>Lista wykładowców</h1>
            <p className="plan-subtitle">Zarządzaj wykładowcami: dodawaj, edytuj lub usuwaj.</p>
          </div>
        </div>

        <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" onClick={onAdd}>Dodaj wykładowcę</button>
          <button type="button" onClick={onImportCsv}>Import CSV</button>
          <button type="button" onClick={onImportExcel}>Import Excel</button>
        </div>

        <div className="admin-student-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ flex: '1 1 auto', minWidth: '220px' }}>
            Szukaj
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="np. imię, nazwisko, userId..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </label>
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              style={{ alignSelf: 'flex-end', padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', background: '#f0f0f0', color: '#333' }}
            >
              Wyczyść
            </button>
          )}
        </div>

        <div className="admin-table-wrapper">
          <table className="schedule-table admin-table">
            <thead>
              <tr>
                <SortHeader label="ID" sortKey="id" />
                <th>L.P.</th>
                <SortHeader label="Imię" sortKey="firstName" />
                <SortHeader label="Nazwisko" sortKey="lastName" />
                <SortHeader label="Login" sortKey="login" />
                <SortHeader label="Użytkownik ID" sortKey="userId" />
                <SortHeader label="Tytuł" sortKey="title" />
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedLecturers.map((lecturer, idx) => (
                <tr key={lecturer.id ?? idx}>
                  <td>{lecturer.id ?? '-'}</td>
                  <td>{idx + 1}</td>
                  <td>{lecturer.firstName || (lecturer.displayName ? '' : `Wykładowca (ID: ${lecturer.id})`)}</td>
                  <td>{lecturer.lastName || (lecturer.displayName ? '' : '-')}</td>
                  <td>{lecturer.login || '-'}</td>
                  <td>{lecturer.userId ?? '-'}</td>
                  <td>{lecturer.title || '-'}</td>
                  <td className="admin-actions-cell">
                    <button type="button" onClick={() => onEdit(lecturer)}>Edytuj</button>
                    {onShowAvailability && (
                      <button type="button" onClick={() => onShowAvailability(lecturer.id)}>Dostępność</button>
                    )}
                    <button type="button" className="delete-button" onClick={() => onDelete(lecturer.id)}>Usuń</button>
                  </td>
                </tr>
              ))}

              {sortedLecturers.length === 0 && (
                <tr>
                  <td colSpan="7">Brak dopasowanych wykładowców.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
