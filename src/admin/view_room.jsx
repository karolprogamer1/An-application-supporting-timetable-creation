import React, { useMemo, useState } from 'react'

export default function RoomList({ style, rooms = [], onAdd, onEdit, onDelete, onBack, status }) {
  const getLabel = (room) => room?.nazwa || room?.name || `Sala ${room?.id_sala ?? ''}`

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


  const getSortValue = (room, key) => {
    switch (key) {
      case 'name':
        return getLabel(room)
      case 'building':
        return room?.budynek || null
      case 'limit':
        return room?.limit_studentow != null ? room.limit_studentow : null
      default:
        return null
    }
  }

  const sortedRooms = useMemo(() => {
    const text = filterText.trim().toLowerCase()
    const filtered = !text
      ? rooms
      : rooms.filter((r) => {
          const haystack = [
            r.id_sala ?? r.id,
            getLabel(r),
            r.budynek,
            r.limit_studentow,
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

    return [...rooms].sort((a, b) => {
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
  }, [rooms, sortConfig])

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
    <div className="student-menu-page" style={style}>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu administratora</strong>
            <div className="student-menu-user-info">Zarządzanie salami dydaktycznymi</div>
          </div>
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

      <div className="student-plan-card">
        <div className="admin-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
          <button type="button" className="card-back-button" onClick={onBack}>
            Powrót do menu
          </button>
        </div>

        <div className="plan-header">
          <div>
            <div className="plan-label">Sale</div>
            <h1>Lista sal dydaktycznych</h1>
            <p className="plan-subtitle">Dodawaj, edytuj lub usuwaj sale wykorzystywane w planie.</p>
          </div>
        </div>

        <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
          <button type="button" onClick={onAdd}>Dodaj salę</button>
        </div>

        <div className="admin-student-filters" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <label style={{ flex: '2 1 auto', minWidth: '220px' }}>
            Szukaj
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="np. nazwa, budynek"
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
        </div>


        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <SortHeader label="Nazwa" sortKey="name" />
                <SortHeader label="Budynek" sortKey="building" />
                <SortHeader label="Limit studentów" sortKey="limit" />
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {sortedRooms.map((room) => (
                <tr key={room.id_sala ?? room.id}>
                  <td>{getLabel(room)}</td>
                  <td>{room.budynek || '-'}</td>
                  <td>{room.limit_studentow != null ? room.limit_studentow : '-'}</td>
                  <td className="admin-actions-cell">
                    <button type="button" onClick={() => onEdit(room)}>Edytuj</button>
                    <button type="button" className="delete-button" onClick={() => onDelete(room.id_sala ?? room.id)}>
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}

              {sortedRooms.length === 0 && (
                <tr>
                  <td colSpan="4">Brak dopasowanych sal.</td>
                </tr>
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

