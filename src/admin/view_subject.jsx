import React, { useMemo, useState } from 'react'

const SortHeader = ({ label, sortKey, activeKey, direction, onSort }) => {
  const isActive = activeKey === sortKey
  const arrow = isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : ''

  return (
    <th
      onClick={() => onSort(sortKey)}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label}
      {arrow}
    </th>
  )
}

export default function SubjectList({
  style,
  subjects = [],
  onAdd,
  onEdit,
  onDelete,
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

  const getSubjectStringValue = (subject, key) => {
    switch (key) {
      case 'id':
        return subject?.id ?? null
      case 'name':
        return subject?.name ?? null
      case 'semestr':
        return subject?.semestr ?? null
      case 'tryb':
        return subject?.tryb ?? null
      case 'specjalnosc':
        return subject?.specjalnosc ?? null
      case 'lecturer':
        return (subject?.lecturerName || subject?.lecturerTitle || subject?.lecturerId) ?? null
      case 'lecturerId':
        return subject?.lecturerId ?? null
      default:
        return null
    }
  }


  const filteredSubjects = useMemo(() => {
    const q = String(filterText || '').trim().toLowerCase()
    if (!q) return subjects

    return subjects.filter((s) => {
      const haystack = [
        s.id,
        s.name,
        s.semestr,
        s.tryb,
        s.lecturerId,
        s.specjalnosc,
      ]
        .filter((x) => x != null)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [subjects, filterText])

  const getSemesterSortValue = (value) => {
    if (value == null || value === '') return Number.POSITIVE_INFINITY
    const numberValue = Number(value)
    if (Number.isFinite(numberValue)) return numberValue
    return String(value).toLowerCase()
  }

  const sortedSubjects = useMemo(() => {
    const dir = sortConfig.direction === 'asc' ? 1 : -1

    const toNumber = (v) => {
      if (v == null) return null
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    return [...filteredSubjects].sort((a, b) => {
      const semA = getSemesterSortValue(a?.semestr)
      const semB = getSemesterSortValue(b?.semestr)

      if (semA !== semB) {
        if (typeof semA === 'number' && typeof semB === 'number') return semA - semB
        return String(semA).localeCompare(String(semB))
      }

      if (!sortConfig.key) {
        const nameA = String(a?.name || '')
        const nameB = String(b?.name || '')
        return nameA.localeCompare(nameB)
      }

      const va = getSubjectStringValue(a, sortConfig.key)
      const vb = getSubjectStringValue(b, sortConfig.key)

      const na = toNumber(va)
      const nb = toNumber(vb)

      if (na != null && nb != null) return (na - nb) * dir
      if (va == null && vb == null) return 0
      if (va == null) return 1 * dir
      if (vb == null) return -1 * dir

      return String(va).toLowerCase().localeCompare(String(vb).toLowerCase()) * dir
    })
  }, [filteredSubjects, sortConfig])

  const groupedSubjects = useMemo(() => {
    return sortedSubjects.reduce((acc, subject) => {
      const semesterKey = String(subject?.semestr || 'Brak semestru')
      if (!acc[semesterKey]) {
        acc[semesterKey] = {}
      }
      const modeKey = String(subject?.tryb || 'Brak trybu')
      if (!acc[semesterKey][modeKey]) {
        acc[semesterKey][modeKey] = {}
      }
      const specKey = String(subject?.specjalnosc || 'Ogólne')
      if (!acc[semesterKey][modeKey][specKey]) {
        acc[semesterKey][modeKey][specKey] = []
      }
      acc[semesterKey][modeKey][specKey].push(subject)
      return acc;
    }, {});
  }, [sortedSubjects]);

  const semesterKeys = useMemo(() => Object.keys(groupedSubjects).sort((a, b) => {
    if (a === 'Brak semestru') return 1;
    if (b === 'Brak semestru') return -1;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }), [groupedSubjects]);

  return (
    <div className="student-menu-page" style={{ ...style, width: '100%', maxWidth: '100%' }}>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu administratora</strong>
            <div className="student-menu-user-info">Zarządzanie przedmiotami</div>
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
            <div className="plan-label">Przedmioty</div>
            <h1>Lista przedmiotów</h1>
            <p className="plan-subtitle">Zarządzaj przedmiotami: dodawaj, edytuj lub usuwaj.</p>
          </div>
        </div>

        <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
          <button type="button" onClick={onAdd}>
            Dodaj przedmiot
          </button>
          <button type="button" onClick={onImportCsv}>
            Import CSV
          </button>
          <button type="button" onClick={onImportExcel}>
            Import Excel
          </button>
        </div>

        <div className="admin-student-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ flex: '1 1 auto', minWidth: '220px' }}>
            Szukaj
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="np. nazwa, semestr, typ..."
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
                <SortHeader label="ID" sortKey="id" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <th>L.P.</th>
                <SortHeader label="Nazwa" sortKey="name" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <SortHeader label="Semestr" sortKey="semestr" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <SortHeader label="Tryb" sortKey="tryb" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <SortHeader label="Specjalność" sortKey="specjalnosc" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <SortHeader label="Godziny" sortKey="hours" activeKey={sortConfig.key} direction={sortConfig.direction} onSort={requestSort} />
                <th>Wykładowca</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {semesterKeys.length > 0
                ? semesterKeys.map((semesterKey) => {
                    const modes = groupedSubjects[semesterKey] || {}
                    const modeKeys = Object.keys(modes).sort()
                    return (
                      <React.Fragment key={semesterKey}>
                        {modeKeys.map((modeKey) => {
                          const specializations = modes[modeKey] || {}
                          const specializationKeys = Object.keys(specializations).sort((a, b) => {
                            if (a === 'Ogólne') return -1
                            if (b === 'Ogólne') return 1
                            return a.localeCompare(b)
                          })

                          return (
                            <React.Fragment key={`${semesterKey}-${modeKey}`}>
                              <tr className="subject-group-row">
                                <td colSpan="9" style={{ fontWeight: 'bold', backgroundColor: '#f0f8ff' }}>
                                  Semestr: {semesterKey} ({modeKey === 'Brak trybu' ? 'Ogólne' : modeKey})
                                </td>
                              </tr>
                              {specializationKeys.map((specKey) => {
                                const rows = specializations[specKey] || []
                                return (
                                  <React.Fragment key={`${semesterKey}-${modeKey}-${specKey}`}>
                                    <tr className="subject-group-row-sub">
                                      <td colSpan="9" style={{ fontWeight: 'bold', backgroundColor: '#f8f9fa', paddingLeft: '20px' }}>
                                        Specjalność: {specKey}
                                      </td>
                                    </tr>
                                    {rows.map((subject, idx) => (
                                      <tr key={subject.id}>
                                        <td>{subject.id}</td>
                                        <td>{idx + 1}</td>
                                        <td>{subject.name}</td>
                                        <td>{subject.semestr || '-'}</td>
                                        <td>{subject.tryb || '-'}</td>
                                        <td>{subject.specjalnosc || '-'}</td>
                                        <td>{subject.hours || '-'}</td>
                                        <td>{subject.lecturerName || subject.lecturerTitle || '-'}</td>
                                        <td className="admin-actions-cell">
                                          <button type="button" onClick={() => onEdit(subject)}>Edytuj</button>
                                          <button type="button" className="delete-button" onClick={() => onDelete(subject.id)}>Usuń</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })
                : (
                <tr>
                  <td colSpan="9">Brak dopasowanych przedmiotów.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
