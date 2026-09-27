import React, { useMemo, useState } from 'react'

export default function ViewGroupList({ style, groups = [], onViewDetails, onAssign, onBack, studyMode, onStudyModeChange, onDelete }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filterText, setFilterText] = useState('')

  const filteredByModeGroups = useMemo(() => groups.filter(g => g.tryb === studyMode), [groups, studyMode]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortValue = (g, key) => {
    switch (key) {
      case 'id':
        return g?.id ?? null
      case 'subjectName':
        return g?.subjectName ?? null
      case 'groupId':
        return g?.groupId ?? null
      case 'roomName':
        return g?.roomName ?? null
      case 'type':
        return g?.type ?? null
      case 'time':
        return g?.time ?? null
      case 'count':
        return g?.count ?? null
      case 'semestr':
        return g?.semestr ?? null
      case 'tryb':
        return g?.tryb ?? null
      case 'specjalnosc':
        return g?.specjalnosc ?? null
      default:
        return null
    }
  }

  const [searchKey, setSearchKey] = useState(0)

  const sortedGroups = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    const filtered = !text
      ? filteredByModeGroups
      : filteredByModeGroups.filter((g) => {
          const haystack = [
            g?.id,
            g?.subjectName,
            g?.groupId,
            g?.roomName,
            g?.type,
            g?.time,
            g?.count,
            g?.semestr,
            g?.tryb,
            g?.specjalnosc,
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

    return [...filtered].sort((a, b) => {
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
  }, [filteredByModeGroups, sortConfig, filterText])

  const groupedGroups = useMemo(() => {
    return sortedGroups.reduce((acc, group) => {
      const semester = group.semestr || 'Brak semestru'
      const specialization = group.specjalnosc || 'Ogólne'

      if (!acc[semester]) {
        acc[semester] = {}
      }
      if (!acc[semester][specialization]) {
        acc[semester][specialization] = []
      }
      acc[semester][specialization].push(group)
      return acc;
    }, {})
  }, [sortedGroups]);

  const SortHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey
    const arrow = isActive ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''

    return (
      <th onClick={() => requestSort(sortKey)} role="button" tabIndex={0} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {label}
        {arrow}
      </th>
    )
  }

  return (
    <div className="student-plan-card" style={style}>
      <div className="admin-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
        <button type="button" className="card-back-button" onClick={onBack}>
          Powrót do menu
        </button>
      </div>
      <div className="plan-header">
        <div>
          <div className="plan-label">Grupy</div>
          <h1>Zarządzanie grupami</h1>
          <p className="plan-subtitle">Lista grup utworzonych na podstawie zajęć oraz liczba przypisanych osób.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
        <button
          type="button"
          className="card-back-button"
          onClick={() => onStudyModeChange('STAC')}
          style={{
            width: 'auto',
            ...(studyMode !== 'STAC' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' })
          }}
        >
          Stacjonarne (STAC)
        </button>
        <button
          type="button"
          className="card-back-button"
          onClick={() => onStudyModeChange('NSTAC')}
          style={{ width: 'auto', ...(studyMode !== 'NSTAC' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' }) }}
        >
          Niestacjonarne (NSTAC)
        </button>
      </div>

      <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={onAssign}>
          Przydziel studenta do grupy
        </button>
      </div>

      <div className="admin-student-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', justifyContent: 'flex-start' }}>
        <label style={{ flex: '2 1 auto', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontWeight: 700 }}>Szukaj</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="np. przedmiot, sala, typ..."
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
                whiteSpace: 'nowrap',
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
                whiteSpace: 'nowrap',
              }}
            >
              Wyczyść
            </button>
          </div>
        </label>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <SortHeader label="ID Zajęć" sortKey="id" />
              <th>L.P.</th>
              <SortHeader label="Przedmiot" sortKey="subjectName" />
              <SortHeader label="Semestr" sortKey="semestr" />
              <SortHeader label="Tryb" sortKey="tryb" />
              <SortHeader label="Specjalność" sortKey="specjalnosc" />
              <SortHeader label="Gr." sortKey="groupId" />
              <SortHeader label="Sala" sortKey="roomName" />
              <SortHeader label="Typ" sortKey="type" />
              <SortHeader label="Czas" sortKey="time" />
              <SortHeader label="Liczba osób" sortKey="count" />
              <th>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(groupedGroups).length > 0
              ? Object.keys(groupedGroups).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })).map((semester) => (
                <React.Fragment key={semester}>
                  <tr>
                    <td colSpan="12" style={{ backgroundColor: '#e9ecef', fontWeight: 'bold', padding: '12px 10px', borderTop: '2px solid #dee2e6', fontSize: '1.1em' }}>
                      Semestr: {semester}
                    </td>
                  </tr>
                  {Object.keys(groupedGroups[semester]).sort((a, b) => {
                    if (a === 'Ogólne') return -1;
                    if (b === 'Ogólne') return 1;
                    return a.localeCompare(b);
                  }).map((specialization) => (
                    <React.Fragment key={`${semester}-${specialization}`}>
                      <tr>
                        <td colSpan="12" style={{ backgroundColor: '#f8f9fa', padding: '10px 20px', borderTop: '1px solid #e9e9e9' }}>
                          Specjalność: <strong>{specialization}</strong>
                        </td>
                      </tr>
                      {groupedGroups[semester][specialization].map((g, idx) => (
                        <tr key={g.id}>
                          <td>{g.id}</td>
                          <td>{idx + 1}</td>
                          <td>{g.subjectName}</td>
                          <td>{g.semestr}</td>
                          <td>{g.tryb}</td>
                          <td>{g.specjalnosc || '-'}</td>
                          <td>{g.groupId ? `Gr. ${g.groupId}` : '-'}</td>
                          <td>{g.roomName}</td>
                          <td>{g.type}</td>
                          <td>{g.time}</td>
                          <td style={{ fontWeight: 'bold' }}>{g.count}</td>
                          <td className="admin-actions-cell">
                            <button type="button" onClick={() => onViewDetails(g.id)} title="Pokaż listę studentów w tej grupie i zarządzaj nimi">
                              Pokaż skład
                            </button>
                            <button type="button" onClick={() => onAssign(g.id)} title="Przejdź do formularza, aby dodać studentów do tej grupy">
                              Dodaj studentów
                            </button>
                            {onDelete && (
                              <button type="button" className="delete-button" onClick={() => {
                                if (window.confirm(`Czy na pewno chcesz usunąć te zajęcia (ID: ${g.id})? Spowoduje to również usunięcie wszystkich przypisań studentów do tej grupy.`)) {
                                  onDelete(g.id);
                                }
                              }}>
                                Usuń zajęcia
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))
              : (
              <tr>
                <td colSpan="12">Brak dopasowanych grup.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
