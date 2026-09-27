import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

function ViewPersonalData({ user, onBack }) {
  const [lecturerInfo, setLecturerInfo] = useState(null)
  const [lecturerClasses, setLecturerClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const [lecturers, classes] = await Promise.all([
          apiFetch('/wykladowca'),
          apiFetch('/zajecia'),
        ])
        const currentId = user?.idwykladowca ?? user?.lecturerId ?? user?.id
        const currentLogin = String(user?.login || '').trim().toLowerCase()
        const lecturer = (Array.isArray(lecturers) ? lecturers : []).find((item) => {
          const itemId = item.idwykladowca ?? item.id ?? item.id_wykladowca
          const itemLogin = String(item.user_login || item.login || '').trim().toLowerCase()
          return (currentId != null && String(itemId) === String(currentId)) || (currentLogin && itemLogin === currentLogin)
        })
        const lecturerId = lecturer?.idwykladowca ?? lecturer?.id ?? lecturer?.id_wykladowca ?? currentId
        const assignedClasses = (Array.isArray(classes) ? classes : []).filter((item) => {
          const itemLecturerId = item.wykladowca_id ?? item.wykladowcaId
          return lecturerId != null && String(itemLecturerId) === String(lecturerId)
        })

        if (!cancelled) {
          setLecturerInfo(lecturer || {
            imie: user?.firstName || user?.imie || '',
            nazwisko: user?.lastName || user?.nazwisko || '',
            tytul_naukowy: user?.title || user?.tytul_naukowy || '',
            user_login: user?.login || '',
          })
          setLecturerClasses(assignedClasses)
        }
      } catch (fetchError) {
        if (!cancelled) setError(fetchError.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [user?.id, user?.idwykladowca, user?.lecturerId, user?.login, user?.firstName, user?.lastName, user?.title])

  const displayName = [lecturerInfo?.imie, lecturerInfo?.nazwisko].filter(Boolean).join(' ') || 'Wykładowca'
  const login = lecturerInfo?.user_login || lecturerInfo?.login || user?.login || '-'

  return (
    <div className="student-personal-page lecturer-personal-page">
      <div className="student-personal-card lecturer-personal-card">
        <h1>Dane osobowe wykładowcy</h1>
        {loading && <p>Ładowanie danych...</p>}
        {!loading && error && <p className="error-message">{error}</p>}
        {!loading && !error && <>
        {/*<div className="personal-field">
          <span>Wykładowca</span>
          <strong>{displayName}</strong>
        </div>*/}
        <div className="personal-field">
          <span>Imię</span>
          <strong>{lecturerInfo?.imie || '-'}</strong>
        </div>
        <div className="personal-field">
          <span>Nazwisko</span>
          <strong>{lecturerInfo?.nazwisko || '-'}</strong>
        </div>
        <div className="personal-field">
          <span>Tytuł</span>
          <strong>{lecturerInfo?.tytul_naukowy || lecturerInfo?.title || '-'}</strong>
        </div>
        <div className="personal-field">
          <span>Login</span>
          <strong>{login}</strong>
        </div>
        <div className="personal-field">
          <span>Prowadzone zajęcia</span>
          <strong>{lecturerClasses.length}</strong>
        </div>
        {lecturerClasses.length > 0 && <div className="admin-table-wrapper" style={{ marginTop: '1rem' }}>
          <table className="schedule-table admin-table">
            <thead><tr><th className="subject-name-column" style={{ width: '40%' }}>Nazwa przedmiotu</th><th>Semestr</th><th className="class-type-column">Typ</th><th>Czas</th><th className="room-column">Sala</th></tr></thead>
            <tbody>{lecturerClasses.map((classItem, index) => <tr key={classItem.idzajecia ?? classItem.id ?? index}>
              <td className="subject-name-column">{classItem.subject_name_for_display || classItem.subjectNameForDisplay || classItem.przedmiot_nazwa || classItem.nazwa || (classItem.przedmiot_id ? `ID: ${classItem.przedmiot_id}` : '-')}</td>
              <td>{classItem.semestr_for_display || classItem.semestr || '-'}</td>
              <td className="class-type-column">{classItem.typ || classItem.type || '-'}</td>
              <td>{classItem.czas || classItem.time || '-'}</td>
              <td className="room-column">{classItem.sala_nazwa || (classItem.sala_id ? `Nr sali: ${classItem.sala_id}` : '-')}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        </>}
        <button type="button" className="card-back-button" onClick={onBack}>
          Powrót do menu
        </button>
      </div>
    </div>
  )
}

export default ViewPersonalData
