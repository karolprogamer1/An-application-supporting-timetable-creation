import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

function ViewPersonalData({ user, onBack }) {
  const [indexNumber, setIndexNumber] = useState(
    user?.indexNumber || user?.nr_albumu || user?.nrAlbum || user?.nr || user?.index || ''
  )
  const [studyYear, setStudyYear] = useState(user?.rok_semestr || user?.year || '')
  const [studyMode, setStudyMode] = useState(user?.tryb || '');
  const [specialization, setSpecialization] = useState(user?.specjalnosc || '');

  useEffect(() => {
    if ((indexNumber && studyYear && studyMode && specialization) || !user?.idstudent) return

    const controller = new AbortController()

    const fetchStudent = async () => {
      try {
        const data = await apiFetch(`/student/${user.idstudent}`, {
          method: 'GET',
          signal: controller.signal,
        })
        const fetchedIndex = data?.nr_albumu ?? data?.indexNumber ?? data?.nrAlbum ?? data?.nr ?? data?.index
        if (fetchedIndex != null && fetchedIndex !== '') {
          setIndexNumber(String(fetchedIndex))
        }
        const fetchedYear = data?.rok_semestr ?? data?.rokSemestr ?? data?.year
        if (fetchedYear != null && fetchedYear !== '') {
          setStudyYear(String(fetchedYear))
        }
        const fetchedMode = data?.tryb ?? data?.studyMode
        if (fetchedMode != null && fetchedMode !== '') {
          setStudyMode(String(fetchedMode))
        }
        const fetchedSpec = data?.specjalnosc ?? data?.specialization
        if (fetchedSpec != null && fetchedSpec !== '') {
          setSpecialization(String(fetchedSpec))
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch student details:', err)
        }
      }
    }

    fetchStudent()
    return () => controller.abort()
  }, [indexNumber, studyYear, studyMode, specialization, user?.idstudent])

  const studentDetails = {
    fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Jan Kowalski',
    indexNumber: indexNumber || '-',
    email: user?.email || `${user?.login || 'student'}@student.ans-elblag.pl`,
    faculty: user?.faculty || 'Informatyka',
    //program: user?.program || 'Informatyka Stosowana',
    year: studyYear || '-',
    mode: studyMode || '-',
    specialization: specialization || '-',
    login: user?.login || 'student',
    role: user?.rola || 'student',
  }

  return (
    <div className="student-personal-page">
      <div className="student-personal-card">
        <h1>Dane osobowe studenta</h1>
        {/*<div className="personal-field">
          <span>Imię i nazwisko</span>
          <strong>{studentDetails.fullName}</strong>
        </div>*/}
        <div className="personal-field">
          <span>Numer indeksu</span>
          <strong>{studentDetails.indexNumber}</strong>
        </div>
        <div className="personal-field">
          <span>Email</span>
          <strong>{studentDetails.email}</strong>
        </div>
        <div className="personal-field">
          <span>Kierunek</span>
          <strong>{studentDetails.faculty}</strong>
        </div>
        <div className="personal-field">
          <span>Rok / semestr</span>
          <strong>{studentDetails.year}</strong>
        </div>
        <div className="personal-field">
          <span>Tryb studiów</span>
          <strong>{studentDetails.mode}</strong>
        </div>
        <div className="personal-field">
          <span>Specjalność</span>
          <strong>{studentDetails.specialization}</strong>
        </div>
        <div className="personal-field">
          <span>Login systemowy</span>
          <strong>{studentDetails.login}</strong>
        </div>
        <div className="personal-field">
          <span>Rola</span>
          <strong>{studentDetails.role}</strong>
        </div>
        <button type="button" className="card-back-button" onClick={onBack}>
          Powrót do menu
        </button>
      </div>
    </div>
  )
}

export default ViewPersonalData
