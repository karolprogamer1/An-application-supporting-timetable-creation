import React, { useState, useMemo } from 'react'

export default function ViewGroupDetails({
  style,
  groupId,
  classes,
  students,
  groupsData,
  onBack,
  onDeleteFromGroup,
  onBulkDeleteFromGroup,
  status,
}) {
  const [selectedStudentIds, setSelectedStudentIds] = useState([])

  const { currentClass, studentsInGroup } = useMemo(() => {
    if (!groupId) return { currentClass: null, studentsInGroup: [] }

    const classInfo = classes.find((c) => c.id === groupId)

    const assignments = groupsData.filter((g) => g.zajecia_id === groupId)

    const studentDetails = assignments
      .map((assignment) => {
        const studentInfo = students.find((s) => s.id === assignment.student_id)
        if (!studentInfo) return null
        return {
          ...studentInfo,
          // Przekazujemy id_grupa, które jest kluczem głównym w tabeli 'grupa' i jest potrzebne do usunięcia wpisu.
          id_grupa: assignment.id_grupa,
        }
      })
      .filter(Boolean)

    return { currentClass: classInfo, studentsInGroup: studentDetails }
  }, [groupId, classes, students, groupsData])

  const allChecked = studentsInGroup.length > 0 && selectedStudentIds.length === studentsInGroup.length
  const someChecked = selectedStudentIds.length > 0 && !allChecked

  const toggleAll = () => {
    if (allChecked) {
      setSelectedStudentIds([])
    } else {
      setSelectedStudentIds(studentsInGroup.map((s) => s.id))
    }
  }

  const toggleOne = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(x => x !== studentId) : [...prev, studentId]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return
    if (!window.confirm(`Usunąć ${selectedStudentIds.length} studentów z grupy?`)) return
    try {
      // Budujemy tablicę { id_grupa, student_id } dla każdego zaznaczonego studenta
      const entries = selectedStudentIds.map(sid => {
        const s = studentsInGroup.find(st => st.id === sid)
        return { id_grupa: s?.id_grupa, student_id: sid }
      })
      await onBulkDeleteFromGroup(entries)
      setSelectedStudentIds([])
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="student-menu-page" style={style}>
      <div className="student-plan-card">
        <div className="admin-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
          <button type="button" className="card-back-button" onClick={onBack}>
            Powrót do listy grup
          </button>
        </div>
        <div className="plan-header">
          <div>
            <div className="plan-label">Szczegóły grupy</div>
            <h1>{currentClass?.subjectNameForDisplay || 'Ładowanie...'} {currentClass?.groupId && `(Gr. ${currentClass.groupId})`}</h1>
            <p className="plan-subtitle">Lista studentów przypisanych do tej grupy (tabela <code>grupa</code>).</p>
          </div>
        </div>

        {status?.message && (
          <div className={`admin-status-message ${status.type || ''}`} style={{ margin: '1rem 0', padding: '0.75rem', borderRadius: '4px' }}>
            {status.message}
          </div>
        )}

        {selectedStudentIds.length > 0 && (
          <div style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#555' }}>Zaznaczono: <strong>{selectedStudentIds.length}</strong></span>
            <button
              type="button"
              className="delete-button"
              onClick={handleBulkDelete}
              style={{ padding: '0.4rem 1rem' }}
            >
              Usuń zaznaczonych ({selectedStudentIds.length})
            </button>
            <button
              type="button"
              className="card-back-button"
              onClick={() => setSelectedStudentIds([])}
              style={{ padding: '0.4rem 1rem' }}
            >
              Odznacz wszystko
            </button>
          </div>
        )}

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '2.5rem', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked }}
                    onChange={toggleAll}
                    title="Zaznacz wszystkich"
                  />
                </th>
                <th>L.P</th>
                <th>Nr albumu</th>
                <th>Login</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {studentsInGroup.map((s, idx) => {
                const isSelected = selectedStudentIds.includes(s.id)
                return (
                  <tr
                    key={s.id ?? `row-${idx}`}
                    style={isSelected ? { background: 'rgba(220,53,69,0.07)' } : {}}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(s.id)}
                      />
                    </td>
                    <td>{idx + 1}</td>
                    <td>{s.indexNumber || '-'}</td>
                    <td>{s.login || '-'}</td>
                    <td className="admin-actions-cell">
                      <button
                        type="button"
                        className="delete-button"
                        onClick={async () => {
                          if (!window.confirm('Usunąć studenta z tej grupy?')) return
                          try {
                            await onDeleteFromGroup(s.id_grupa ?? null, s.id)
                            setSelectedStudentIds(prev => prev.filter(x => x !== s.id))
                          } catch (e) {
                            console.error(e)
                          }
                        }}
                      >
                        Usuń z grupy
                      </button>
                    </td>
                  </tr>
                )
              })}
              {studentsInGroup.length === 0 && (
                <tr>
                  <td colSpan="5">Brak przypisanych studentów do tej grupy.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}