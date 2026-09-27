import React, { useMemo, useState } from 'react'
//STAC - stud. dzienne
//NSTAC - stud. zaoczne
export default function StudentList({ style, user, students = [], classes = [], onAdd, onEdit, onDelete, onAssign, onImportCsv, onImportExcel, onBack, status, filterRokSemestr, filterTryb, filterSpecjalnosc, onFilterChange }) {
  const getAlbumNumber = (student) => student.indexNumber || student.nr_albumu || '-'
  const getLogin = (student) => student.login || student.user_login || '-'

  const [filterText, setFilterText] = useState('')


  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortValue = (student, key) => {
    switch (key) {
      case 'album':
        return getAlbumNumber(student)
      case 'login':
        return getLogin(student)
      case 'rokSemestr':
        return student.rok_semestr && String(student.rok_semestr).toUpperCase() !== 'NULL' ? student.rok_semestr : null
      case 'tryb':
        return student.tryb && String(student.tryb).toUpperCase() !== 'NULL' ? student.tryb : null
      case 'specjalnosc':
        return student.specjalnosc && String(student.specjalnosc).toUpperCase() !== 'NULL' ? student.specjalnosc : null
      case 'groupLabel':
        return student.groupLabel || null
      default:
        return null
    }
  }

  const sortedStudents = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    const filtered = !text
      ? students
      : students.filter((s) => {
          const haystack = [
            s.id,
            s.id,
            s.login,
            s.user_login,
            s.indexNumber,

            s.nr_albumu,
            s.rok_semestr,
            s.tryb,
            s.specjalnosc,
            s.groupLabel,
          ]
            .filter((v) => v != null)
            .map((v) => String(v).toLowerCase())
            .join(' ')

          return haystack.includes(text)
        })

    if (!sortConfig.key) return filtered


    const dir = sortConfig.direction === 'asc' ? 1 : -1

    const toNumber = (v) => {
      if (v == null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    const sorted = [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortConfig.key)
      const vb = getSortValue(b, sortConfig.key)


      const na = toNumber(va)
      const nb = toNumber(vb)

      if (na != null && nb != null) return (na - nb) * dir

      if (va == null && vb == null) return 0
      if (va == null) return 1 * dir
      if (vb == null) return -1 * dir

      return String(va).toLowerCase().localeCompare(String(vb).toLowerCase()) * dir
    })

    return sorted
  }, [students, sortConfig])

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
            <div className="student-menu-user-info">Zarządzanie studentami</div>
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
            <div className="plan-label">Studenci</div>
            <h1>Lista studentów</h1>
            <p className="plan-subtitle">Zarządzaj studentami w bazie danych: dodawaj, edytuj lub usuwaj.</p>
          </div>
        </div>

        <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
          <button type="button" onClick={onAdd}>
            Dodaj studenta
          </button>
          {classes && classes.length > 0 && (
            <button type="button" onClick={onAssign}>
              Przydziel do grupy
            </button>
          )}
          <button type="button" onClick={onImportCsv}>
            Import CSV
          </button>
          <button type="button" onClick={onImportExcel}>
            Import Excel
          </button>
        </div>

      <div className="admin-student-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ flex: '2 1 auto', minWidth: '220px' }}>
            Szukaj
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="np. login, album"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button
                type="button"
                onClick={() => setFilterText((t) => String(t))}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(15, 41, 64, 0.18)',
                  cursor: 'pointer',
                  background: '#0f2940',
                  color: '#fff',
                  fontWeight: 700,
                  boxShadow: '0 10px 20px rgba(15, 41, 64, 0.08)',
                }}
              >
                Szukaj
              </button>
              <button
                type="button"
                onClick={() => setFilterText('')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid rgba(15, 41, 64, 0.18)',
                  cursor: 'pointer',
                  background: '#ffffff',
                  color: '#0f2940',
                  fontWeight: 700,
                }}
              >
                Wyczyść
              </button>

            </div>
          </label>


          <label style={{ flex: '1 1 auto', minWidth: '150px' }}>
            Rok/Semestr

            <select
              name="rokSemestr"
              value={filterRokSemestr}
              onChange={(e) => onFilterChange(e.target.name, e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Wszystkie</option>
              <option value="1/1">1/1</option>
              <option value="1/2">1/2</option>
              <option value="2/3">2/3</option>
              <option value="2/4">2/4</option>
              <option value="3/5">3/5</option>
              <option value="3/6">3/6</option>
              <option value="4/7">4/7</option>
              <option value="4/8">4/8</option>
            </select>
          </label>

          <label style={{ flex: '1 1 auto', minWidth: '150px' }}>
            Tryb
            <select
              name="tryb"
              value={filterTryb}
              onChange={(e) => onFilterChange(e.target.name, e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Wszystkie</option>
              <option value="STAC">STAC</option>
              <option value="NSTAC">NSTAC</option>
            </select>
          </label>

          <label style={{ flex: '1 1 auto', minWidth: '150px' }}>
            Specjalność
            <select
              name="specjalnosc"
              value={filterSpecjalnosc}
              onChange={(e) => onFilterChange(e.target.name, e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Wszystkie</option>
              <option value="ISP">ISP</option>
              <option value="CTS">CTS</option>
              <option value="IOSI">IOSI</option>
            </select>
          </label>

          {(filterRokSemestr || filterTryb || filterSpecjalnosc) && (
            <button
              type="button"
              onClick={() => {
                onFilterChange('rokSemestr', '')
                onFilterChange('tryb', '')
                onFilterChange('specjalnosc', '')
              }}
              style={{ alignSelf: 'flex-end', padding: '8px 16px', borderRadius: '4px', border: '1px solid #ccc', background: '#f0f0f0', color: '#333' }}
            >
              Wyczyść filtry
            </button>
          )}
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>L.P.</th>
                <SortHeader label="Nr albumu" sortKey="album" />
                <SortHeader label="Login" sortKey="login" />
                <SortHeader label="Rok/semestr" sortKey="rokSemestr" />
                <SortHeader label="Tryb" sortKey="tryb" />
                <SortHeader label="Specjalność" sortKey="specjalnosc" />
                <SortHeader label="Grupa" sortKey="groupLabel" />
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map((student, idx) => (
                <tr key={student.id}>
                  <td>{idx + 1}</td>
                  <td>{getAlbumNumber(student)}</td>
                  <td>{getLogin(student)}</td>
                  <td>{student.rok_semestr && String(student.rok_semestr).toUpperCase() !== 'NULL' ? student.rok_semestr : '-'}</td>
                  <td>{student.tryb && String(student.tryb).toUpperCase() !== 'NULL' ? student.tryb : '-'}</td>
                  <td>{student.specjalnosc && String(student.specjalnosc).toUpperCase() !== 'NULL' ? student.specjalnosc : '-'}</td>
                  <td>{student.groupLabel || '-'}</td>
                  <td className="admin-actions-cell">
                    <button type="button" onClick={() => onEdit(student)}>
                      Edytuj
                    </button>
                    <button type="button" className="delete-button" onClick={() => onDelete(student.id)}>
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan="8">Brak dopasowanych studentów.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
