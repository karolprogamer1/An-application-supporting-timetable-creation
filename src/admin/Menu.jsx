import { useEffect, useState, useRef, useMemo } from 'react'
import '../App.css'
import StudentList from './view_student'
import AddStudent from './add_student'
import EditStudent from './edit_student'
import LecturerList from './view_lecturer'
import AddLecturer from './add_lecturer'
import EditLecturer from './edit_lecturer'
import SubjectList from './view_subject'
import AddSubject from './add_subject'
import EditSubject from './edit_subject'
import ZajeciaList from './view_zajecia'
import AddZajecia from './add_zajecia'
import EditZajecia from './edit_zajecia'
import ViewGroupList from './view_groups'
import ViewGroupDetails from './view_group_details'
import AssignStudentToGroup from './assign_student_to_group.jsx'
import RoomList from './view_room.jsx'
import AddRoom from './add_room.jsx'
import EditRoom from './edit_room.jsx'
import GroupCompositionViewer from '../planist/GroupCompositionViewer.jsx';
import LecturerAvailabilityGrid from './LecturerAvailabilityGrid.jsx';
import Generator from '../planist/generator.jsx';
import ViewPlan from '../planist/view_plan.jsx';
import { apiFetch } from '../api';
const fullTimeWeekdays = [
  { value: 'Poniedzialek', label: 'Poniedziałek' },
  { value: 'Wtorek', label: 'Wtorek' },
  { value: 'Sroda', label: 'Środa' },
  { value: 'Czwartek', label: 'Czwartek' },
  { value: 'Piatek', label: 'Piątek' },
  { value: 'Sobota', label: 'Sobota' },
  { value: 'Niedziela', label: 'Niedziela' },
];

const classTypeOptions = [
  { value: 'wykład', label: 'Wykład' },
  { value: 'ćwiczenia', label: 'Ćwiczenia' },
  { value: 'laboratorium', label: 'Laboratorium' },
  { value: 'projekt', label: 'Projekt' },
  { value: 'seminarium', label: 'Seminarium' },
  { value: 'wykład/projekt', label: 'Wykład/Projekt' },
  { value: 'wykład/laboratorium/projekt', label: 'Wykład/Laboratorium/Projekt' },
  { value: 'laboratorium/projekt', label: 'Laboratorium/Projekt' },
  { value: 'wykład/laboratorium', label: 'Wykład/Laboratorium' },
];

const normalizeStudyModeValue = (value) => {
  const upper = String(value || '').trim().toUpperCase();
  if (upper === 'NST') return 'NSTAC';
  if (upper === 'NSTAC') return 'NSTAC';
  return value;
};

function DeanGroupsManager({ onBack, setFormStatus }) {
  const [deanGroups, setDeanGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState(null); // { id_grupy, nazwa } or null
  const [newGroupName, setNewGroupName] = useState('');

  const fetchDeanGroups = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/grupy-dziekanskie');
      if (!res.ok) throw new Error('Błąd pobierania grup dziekańskich');
      const data = await res.json();
      setDeanGroups(data);
    } catch (err) {
      setFormStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeanGroups();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const nameToSave = editingGroup ? editingGroup.nazwa : newGroupName;
    if (!nameToSave.trim()) {
      setFormStatus({ type: 'error', message: 'Nazwa grupy nie może być pusta.' });
      return;
    }

    try {
      const url = editingGroup ? `/grupy-dziekanskie/${editingGroup.id_grupy}` : '/grupy-dziekanskie';
      const method = editingGroup ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazwa: nameToSave }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd zapisu grupy');
      }
      setFormStatus({ type: 'success', message: editingGroup ? 'Zaktualizowano grupę.' : 'Dodano nową grupę.' });
      setEditingGroup(null);
      setNewGroupName('');
      await fetchDeanGroups();
    } catch (err) {
      setFormStatus({ type: 'error', message: err.message });
    }
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę grupę? Może to wpłynąć na istniejące przypisania do zajęć.')) return;
    try {
      const res = await apiFetch(`/grupy-dziekanskie/${groupId}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd usuwania grupy');
      }
      setFormStatus({ type: 'success', message: 'Usunięto grupę.' });
      await fetchDeanGroups();
    } catch (err) {
      setFormStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="student-plan-card">
      <div className="plan-header">
        <h1>Zarządzaj grupami dziekańskimi</h1>
        <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
      </div>
      {/* Tutaj reszta UI komponentu, jak formularz i lista */}
    </div>
  );
}

function AdminMenu({ user, onLogout }) {
  const [groupViewStudyMode, setGroupViewStudyMode] = useState('STAC');
  console.log("AdminMenu rendering. Current user:", user); // Debugging
  const fileInputRef = useRef(null)
  const [activeView, setActiveView] = useState(null)
  const [fontScale, setFontScale] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [importTarget, setImportTarget] = useState(null) // student, lecturer, subject, class
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [isBulkDeleteMode, setIsBulkDeleteMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [formData, setFormData] = useState({ indexNumber: '', login: '', password: '', rokSemestr: '', tryb: '', specjalnosc: '' })
  const [lecturers, setLecturers] = useState([])
  const [selectedLecturer, setSelectedLecturer] = useState(null)
  const [lecturerFormData, setLecturerFormData] = useState({ userId: '', firstName: '', lastName: '', title: '', availabilityGrid: {}, login: '', password: '' })
  const [selectedLecturerForAvailability, setSelectedLecturerForAvailability] = useState(null);
  const [lecturerAvailabilities, setLecturerAvailabilities] = useState({});
  const [subjects, setSubjects] = useState([])
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [subjectFormData, setSubjectFormData] = useState({ name: '', hours: '', lecturerId: '', rokSemestr: '', tryb: '', specjalnosc: '' })
  const [classes, setClasses] = useState([]) 
  const [selectedClass, setSelectedClass] = useState(null)
  const [classFormData, setClassFormData] = useState({ subjectId: '', lecturerId: '', type: '', time: '', roomId: '', groupId: '', allowedDays: [], data_rozpoczecia: '', data_zakonczenia: '' })

  const [rooms, setRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [roomFormData, setRoomFormData] = useState({ nazwa: '', budynek: '', limit_studentow: '' })

  const [saving, setSaving] = useState(false)
  const [formStatus, setFormStatus] = useState({ type: '', message: '' })

  // state dla formularza przydziału studenta do grupy
  const [assignStudentFormData, setAssignStudentFormData] = useState({ studentIds: [], zajeciaId: '', ilosc: '1' })
  const [groupsData, setGroupsData] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [assignGroupFromView, setAssignGroupFromView] = useState('students');

  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [generationStats, setGenerationStats] = useState(null);
  const [generationMode, setGenerationMode] = useState('STAC');
  const [generationSemester, setGenerationSemester] = useState(null);

  useEffect(() => {
    // Poprawiono i uproszczono logikę pobierania danych.
    // Oryginalna implementacja nie pobierała wszystkich zależności dla niektórych widoków,
    // co mogło prowadzić do błędów w renderowaniu i ukrywania przycisku "Przydziel do grupy".
    // Teraz, dla kluczowych widoków, pobieramy komplet danych, aby zapewnić spójność.
    const coreDataViews = ['students', 'lecturers', 'subjects', 'classes', 'groups', 'assignStudentToGroup', 'groupDetails', null];
    const formViews = ['addStudent', 'editStudent', 'addLecturer', 'editLecturer', 'addSubject', 'editSubject', 'addClass', 'editClass'];

    if (coreDataViews.includes(activeView) || formViews.includes(activeView)) {
      fetchStudents();
      fetchLecturers();
      fetchSubjects();
      fetchClasses();
      fetchRooms();
      fetchGroupsData();
    } else if (activeView === 'rooms' || activeView === 'addRoom' || activeView === 'editRoom') {
      fetchRooms();
    }
    // Reset bulk delete mode when changing views
    if (activeView !== 'students') {
      setIsBulkDeleteMode(false);
      setSelectedStudentIds([]);
    }
  }, [activeView])

  const enrichedClasses = useMemo(() => {
    return classes.map((c) => {
      const s = subjects.find((subj) => subj.id === c.subjectId);
      const l = lecturers.find(lect => lect.id === c.wykladowcaId);
      const r = rooms.find(room => Number(room.id_sala ?? room.id) === Number(c.salaId));
      return {
        ...c,
        subjectName: s ? s.name : `Przedmiot ${c.subjectId}`,
        subjectNameForDisplay: c.subjectNameForDisplay ?? c.subject_name_for_display ?? s?.name ?? `Przedmiot ${c.subjectId}`,
        semestr: c.semestr ?? c.semestr_for_display ?? s?.semestr ?? null, // Pozostawiamy null, jeśli semestr nie jest zdefiniowany
        tryb: c.tryb ?? c.tryb_for_display ?? s?.tryb ?? '', // Używamy ?? dla spójności, aby uniknąć błędu
        specjalnosc: c.specjalnosc ?? s?.specjalnosc ?? '',
        lecturerName: l ? `${l.firstName} ${l.lastName}`.trim() : '-',
        roomName: r ? r.nazwa : '-',
      }
    })
  }, [classes, subjects, lecturers, rooms])

  const enrichedSubjects = useMemo(() => {
    return subjects.map(s => {
      const l = lecturers.find(lect => lect.id === s.lecturerId);
      return {
        ...s,
        lecturerName: l ? `${l.firstName} ${l.lastName}`.trim() : null,
        imie: l?.firstName || null,
        specjalnosc: s.specjalnosc || '',
        nazwisko: l?.lastName || null,
        tytul_naukowy: l?.title || null,
      };
    });
  }, [subjects, lecturers]);

  const subjectsForClassForms = useMemo(() => {
    const sortedSubjects = [...enrichedSubjects].sort((a, b) => {
      const semA = String(a.semestr || '99');
      const semB = String(b.semestr || '99');
      const modeA = String(a.tryb || 'Z');
      const modeB = String(b.tryb || 'Z');

      if (semA !== semB) {
        return semA.localeCompare(semB, 'pl', { numeric: true });
      }
      if (modeA !== modeB) {
        return modeA.localeCompare(modeB);
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return sortedSubjects.map((s) => {
      const details = [
        s.tryb,
        s.semestr ? `sem. ${s.semestr}` : null,
        s.specjalnosc,
      ].filter(Boolean).join(', ');

      return {
        ...s,
        name: `${s.name}${details ? ` (${details})` : ''}`,
      };
    });
  }, [enrichedSubjects]);

  const flatGroupsForView = useMemo(() => {
    return enrichedClasses.map((c) => {
        const assigned = groupsData.filter((g) => Number(g.zajecia_id) === Number(c.id));
        return {
            id: c.id,
            subjectName: c.subjectNameForDisplay || '?',
            roomName: rooms.find((r) => (r.id_sala ?? r.id) === c.salaId)?.nazwa || '-',
            type: c.type,
            time: c.time,
            groupId: c.groupId,
            count: assigned.length,
            semestr: c.semestr || 'Nieprzypisany',
            tryb: c.tryb || 'Nieokreślony',
            specjalnosc: c.specjalnosc || '',
        };
    });
  }, [enrichedClasses, groupsData, rooms]);


  const enrichedStudents = useMemo(() => {
    return students.map(s => {
      // Apply filters here before mapping groupLabel
      // Note: Filtering is done on the original 'students' array, then mapped.

      const assignments = groupsData.filter(g => Number(g.student_id) === Number(s.id));
      const labels = assignments.map(g => {
        const cls = classes.find(c => c.id === g.zajecia_id);
        if (!cls) return null;
        const subject = subjects.find(sub => sub.id === cls.subjectId);
        return `${subject?.name || '?'}${cls.groupId ? ` (Gr. ${cls.groupId})` : ''}`;
      }).filter(Boolean);

      return { ...s, groupLabel: labels.length > 0 ? labels.join(', ') : '-' };
    }).filter(Boolean);
  }, [students, classes, subjects, groupsData]);

  const groupedSubjects = useMemo(() => {
    const bySemester = enrichedSubjects.reduce((acc, subject) => {
      const sem = subject.semestr || 'Nieprzypisany';
      if (!acc[sem]) {
        acc[sem] = [];
      }
      acc[sem].push(subject);
      return acc;
    }, {});

    return Object.entries(bySemester)
      .sort(([semA], [semB]) => String(semA).localeCompare(String(semB), 'pl', { numeric: true }))
      .map(([semester, semesterSubjects]) => {
        const byMode = semesterSubjects.reduce((acc, subject) => {
          const mode = subject.tryb || 'Nieokreślony';
          if (!acc[mode]) {
            acc[mode] = [];
          }
          acc[mode].push(subject);
          return acc;
        }, {});

        return {
          semester,
          modes: Object.entries(byMode)
            .sort(([modeA], [modeB]) => modeA.localeCompare(modeB))
            .map(([mode, subjects]) => {
              const bySpecialization = subjects.reduce((acc, subject) => {
                const spec = subject.specjalnosc || 'Ogólne';
                if (!acc[spec]) {
                  acc[spec] = [];
                }
                acc[spec].push(subject);
                return acc;
              }, {});

              return {
                mode,
                specializations: Object.entries(bySpecialization)
                  .sort(([specA], [specB]) => {
                    if (specA === 'Ogólne') return -1;
                    if (specB === 'Ogólne') return 1;
                    return specA.localeCompare(specB);
                  })
                  .map(([name, specializationSubjects]) => ({ name, subjects: specializationSubjects.sort((a, b) => a.name.localeCompare(b.name)) })),
              };
            }),
        };
      });
  }, [enrichedSubjects]);

  const groupedClasses = useMemo(() => {
    const byMode = enrichedClasses.reduce((acc, c) => {
      const mode = c.tryb || 'Nieokreślony';
      if (!acc[mode]) acc[mode] = [];
      acc[mode].push(c);
      return acc;
    }, {});

    return Object.entries(byMode)
      .sort(([modeA], [modeB]) => modeA.localeCompare(modeB))
      .map(([mode, modeClasses]) => {
        const bySemester = modeClasses.reduce((acc, c) => {
          const sem = c.semestr || 'Nieprzypisany';
          if (!acc[sem]) acc[sem] = [];
          acc[sem].push(c);
          return acc;
        }, {});

        return {
          mode,
          semesters: Object.entries(bySemester)
            .sort(([semA], [semB]) => String(semA).localeCompare(String(semB), 'pl', { numeric: true }))
            .map(([semester, semesterClasses]) => {
              const bySpecialization = semesterClasses.reduce((acc, c) => {
                const spec = c.specjalnosc || 'Ogólne';
                if (!acc[spec]) acc[spec] = [];
                acc[spec].push(c);
                return acc;
              }, {});

              return {
                semester,
                specializations: Object.entries(bySpecialization)
                  .sort(([specA], [specB]) => {
                    if (specA === 'Ogólne') return -1;
                    if (specB === 'Ogólne') return 1;
                    return specA.localeCompare(specB);
                  })
                  .map(([name, classes]) => ({ name, classes: classes.sort((a, b) => a.subjectNameForDisplay.localeCompare(b.subjectNameForDisplay)) })),
              };
            }),
        };
      });
  }, [enrichedClasses]);

  const groupedGroupsForView = useMemo(() => {
    const groupsForView = enrichedClasses.map((c) => {
        const assigned = groupsData.filter((g) => Number(g.zajecia_id) === Number(c.id));
        return {
            id: c.id,
            subjectName: c.subjectNameForDisplay || '?',
            roomName: rooms.find((r) => (r.id_sala ?? r.id) === c.salaId)?.nazwa || '-',
            type: c.type,
            time: c.time,
            groupId: c.groupId,
            count: assigned.length,
            semestr: c.semestr || 'Nieprzypisany',
            tryb: c.tryb || 'Nieokreślony',
        };
    });

    const byMode = groupsForView.reduce((acc, group) => {
        const mode = group.tryb;
        if (!acc[mode]) {
            acc[mode] = [];
        }
        acc[mode].push(group);
        return acc;
    }, {});

    return Object.entries(byMode)
        .sort(([modeA], [modeB]) => modeA.localeCompare(modeB))
        .map(([mode, modeGroups]) => {
            const bySemester = modeGroups.reduce((acc, group) => {
                const sem = group.semestr;
                if (!acc[sem]) {
                    acc[sem] = [];
                }
                acc[sem].push(group);
                return acc;
            }, {});

            return {
                mode,
                semesters: Object.entries(bySemester)
                    .sort(([semA], [semB]) => String(semA).localeCompare(String(semB), 'pl', { numeric: true }))
                    .map(([semester, groups]) => ({
                        semester,
                        groups: groups.sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
                    })),
            };
        });
  }, [enrichedClasses, groupsData, rooms]);

  const fetchStudents = async () => {
    try {
      const response = await apiFetch('/student', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Błąd pobierania listy studentów')
      }
      const data = await response.json()
      setStudents(data.map((row) => ({
        id: row.idstudent,
        indexNumber: row.nr_albumu?.toString() || '',
        userId: row.uzytkownicy_id || null,
        login: row.user_login || '',
        rok_semestr: row.rok_semestr ?? '',
        tryb: row.tryb ?? '',
        specjalnosc: row.specjalnosc ?? '',
      })))
    } catch (error) {
      console.error(error)
    }
  }

  const fetchGroupsData = async () => {
    try {
      const response = await apiFetch('/grupa')
      if (!response.ok) throw new Error('Błąd pobierania danych grup')
      const data = await response.json()
      setGroupsData(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const fetchLecturers = async () => {
    try {
      const response = await apiFetch('/wykladowca')
      if (!response.ok) {
        throw new Error('Błąd pobierania listy wykładowców')
      }
      const data = await response.json()
      setLecturers(data.map((row) => ({
        id: row.idwykladowca ?? row.id ?? row.id_wykladowca ?? null,
        userId: row.uzytkownicy_id ?? row.userId ?? null,
        login: row.user_login || row.login || '',
        firstName: row.imie || row.firstName || row.first_name || '',
        lastName: row.nazwisko || row.lastName || row.last_name || '',
        title: row.tytul_naukowy || row.title || '',
        displayName: [row.imie || row.firstName || row.first_name, row.nazwisko || row.lastName || row.last_name].filter(Boolean).join(' ').trim(),
      })))
    }catch (error) {
      console.error(error)
    }
  }

  const fetchSubjects = async () => {
    try {
      const response = await apiFetch('/przedmiot')
      if (!response.ok) {
        throw new Error('Błąd pobierania listy przedmiotów')
      }
      const payload = await response.json()
      const data = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.data) ? payload.data : payload?.rows)
      if (!Array.isArray(data)) {
        throw new Error('Nieprawidłowy format listy przedmiotów')
      }
      setSubjects(data.map((row) => ({
        id: row.idprzedmiotu,
        name: row.nazwa || '',
        hours: row.ilosc_godz?.toString() || '',
        lecturerId: row.wykladowca_id,
        semestr: row.semestr || '',
        tryb: row.tryb || '',
        tryb: normalizeStudyModeValue(row.tryb || ''),
        specjalnosc: row.specjalnosc || '',
      })))
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Nie udało się pobrać listy przedmiotów' })
    }
  }

  const fetchRooms = async () => {
    try {
      const response = await apiFetch('/sale')
      if (!response.ok) {
        throw new Error('Błąd pobierania listy sal')
      }
      const data = await response.json()
      setRooms(data || [])
    } catch (error) {
      console.error(error)
    }
  }

  const mapClassRowToState = (row) => ({
    id: row.idzajecia ?? row.id ?? null,
    subjectId: row.przedmiot_id ?? null,
    subjectNameForDisplay: row.subject_name_for_display || row.subjectNameForDisplay || null,
    semestr: row.semestr_for_display || row.semestr || null,
    tryb: row.tryb_for_display || row.tryb || null,
    tryb: normalizeStudyModeValue(row.tryb_for_display || row.tryb || null),
    specjalnosc: row.specjalnosc || null,
    wykladowcaId: row.wykladowca_id ?? null,
    wykladowca_imie: row.wykladowca_imie || null,
    wykladowca_nazwisko: row.wykladowca_nazwisko || null,
    type: row.typ || '',
    time: row.czas || '',
    salaId: row.sala_id ?? row.salaId ?? null,
    salaNameForDisplay: row.sala_nazwa || row.salaNameForDisplay || row.salaName || null,
    sala_nazwa: row.sala_nazwa || row.salaNameForDisplay || row.salaName || null,
    groupId: row.grupa ?? row.groupId ?? null,
    dozwolone_dni: row.dozwolone_dni || [],
    data_rozpoczecia: row.data_rozpoczecia || null,
    data_zakonczenia: row.data_zakonczenia || null,
  })

  const fetchClasses = async () => {
    try {
      const response = await apiFetch('/zajecia', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Błąd pobierania listy zajęć')
      }
      const data = await response.json()
      setClasses((Array.isArray(data) ? data : []).map(mapClassRowToState))
    } catch (error) {
      console.error(error)
    }
  }


  const parseCsv = (text) => {
    const normalizeValue = (value) => value.trim().replace(/^"|"$/g, '')
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const rows = lines.map((line) => {
      const result = []
      let current = ''
      let insideQuotes = false
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i]
        if (char === '"') {
          insideQuotes = !insideQuotes
          continue
        }
        if (!insideQuotes && (char === ',' || char === ';')) {
          result.push(normalizeValue(current))
          current = ''
          continue
        }
        current += char
      }
      if (current.length > 0 || line.endsWith(',') || line.endsWith(';')) {
        result.push(normalizeValue(current))
      }
      return result
    })

    if (rows.length === 0) {
      return []
    }

    const headerRow = rows[0]
    const headerFields = headerRow.map((value) => value.toLowerCase())
    const knownFields = ['nr_albumu', 'uzytkownicy_id', 'imie', 'nazwisko', 'tytul_naukowy', 'wykladowca_id', 'nazwa', 'typ', 'ilosc_godz', 'przedmiot_id', 'czas', 'indexnumber', 'userid', 'firstname', 'lastname', 'title', 'name', 'type', 'hours']
    const hasHeader = headerFields.some((field) => knownFields.includes(field))
    if (!hasHeader) {
      return rows
    }

    return rows.slice(1).map((row) => {
      const entry = {}
      row.forEach((value, index) => {
        const field = headerFields[index]
        entry[field] = value
      })
      return entry
    })
  }

  const mapCsvRowToPayload = (row, target) => {
    // Tworzymy znormalizowaną wersję wiersza (małe litery, bez spacji w kluczach)
    // ułatwia to dopasowanie nagłówków z Excela (np. "Nr albumu" -> "nralbumu")
    const normalizedRow = {};
    if (!Array.isArray(row)) {
      Object.keys(row).forEach(key => {
        const normKey = key.toLowerCase().trim().replace(/[\s_]/g, '');
        normalizedRow[normKey] = row[key];
      });
    }

    const getValue = (keys) => {
      if (Array.isArray(row)) return null; // Fallback dla starego parsera CSV
      for (const key of keys) {
        const searchKey = key.toLowerCase().trim().replace(/[\s_]/g, '');
        if (normalizedRow[searchKey] != null && normalizedRow[searchKey] !== '') {
          return normalizedRow[searchKey]
        }
      }
      return null
    }

    if (target === 'student') {
      let raw = null
      let login = null
      let haslo = null
      let rok_semestr = null
      let tryb = null
      let specjalnosc = null
      let zajecia_id = null
      const emptyToNull = (v) => {
        if (v == null) return null
        if (typeof v === 'string' && v.trim() === '') return null
        return v
      }

      if (Array.isArray(row)) {
        // Fallback index-based (może się rozjechać przy trailing commas).
        // Priorytetem i tak są klucze header-based, jeśli parseCsv zwróci obiekty.
        raw = row[0]
        login = row[1]
        haslo = row[2]
        rok_semestr = row[3]
        tryb = row[4]
        specjalnosc = row[5]
        zajecia_id = row[6]
      } else {
        // Header-based mapping (dla Twojego CSV: rok_semestr, tryb, ...).
        raw = getValue(['nr_albumu', 'indexnumber', 'nr albumu'])
        login = getValue(['login'])
        haslo = getValue(['haslo', 'password'])
        rok_semestr = getValue(['rok_semestr'])
        tryb = getValue(['tryb', 'mode'])
        specjalnosc = getValue(['specjalnosc', 'specialty'])
        zajecia_id = getValue(['zajecia_id', 'classid', 'class_id'])
      }

      const number = raw != null ? Number(raw) : null
      const zajeciaIdNum = zajecia_id != null ? Number(zajecia_id) : null
      return {
        nr_albumu: Number.isNaN(number) ? null : number,
        login: emptyToNull(login),
        password: emptyToNull(haslo),
        rok_semestr: emptyToNull(rok_semestr) || '2024/1',
        tryb: emptyToNull(tryb) || 'STAC',
        specjalnosc: emptyToNull(specjalnosc) || '',
        zajecia_id: Number.isNaN(zajeciaIdNum) ? null : zajeciaIdNum,
      }
    }

    if (target === 'lecturer') {
      let userId = null
      let imie = null
      let nazwisko = null
      let tytul = null
      if (Array.isArray(row)) {
        // expected order: imie, nazwisko, tytul_naukowy, uzytkownicy_id (optional)
        imie = row[0] || null
        nazwisko = row[1] || null
        tytul = row[2] || null
        userId = row[3] || null
      } else {
        userId = getValue(['uzytkownicy_id', 'userid'])
        imie = getValue(['imie', 'firstname'])
        nazwisko = getValue(['nazwisko', 'lastname'])
        tytul = getValue(['tytul_naukowy', 'title'])
      }
      return {
        uzytkownicy_id: userId ? Number(userId) : null,
        imie: imie,
        nazwisko: nazwisko,
        tytul_naukowy: tytul,
      }
    }

    if (target === 'subject') {
      let lecturerId = null
      let nazwa = null
      let typ = null
      let ilosc_godz = null
      let semestr = null
      let tryb = null
      if (Array.isArray(row)) {
        // expected order: nazwa, typ, ilosc_godz, wykladowca_id (optional)
        nazwa = row[0] || null
        typ = row[1] || null
        ilosc_godz = row[2] != null && row[2] !== '' ? Number(row[2]) : null
        lecturerId = row[3] || null
        semestr = row[4] || null
        tryb = row[5] || null
      } else {
        lecturerId = getValue(['wykladowca_id', 'userid', 'lecturerid'])
        nazwa = getValue(['nazwa', 'name'])
        typ = getValue(['typ', 'type'])
        semestr = getValue(['semestr', 'rok_semestr'])
        tryb = getValue(['tryb'])
        const hoursRaw = getValue(['ilosc_godz', 'hours'])
        ilosc_godz = hoursRaw != null ? Number(hoursRaw) : null
      }
      return {
        wykladowca_id: lecturerId ? Number(lecturerId) : null,
        nazwa,
        typ,
        ilosc_godz: Number.isNaN(ilosc_godz) ? null : ilosc_godz,
        semestr,
        tryb,
      }
    }

    if (target === 'class') {
      let subjectId = null
      let typ = null
      let czas = null
      let wykladowca_id = null
      let sala_id = null
      let grupa = null
      if (Array.isArray(row)) {
        // expected order: przedmiot_id, typ, czas, wykladowca_id, sala_id, grupa
        subjectId = row[0] || null
        typ = row[1] || null
        czas = row[2] || null
        wykladowca_id = row[3] || null
        sala_id = row[4] || null
        grupa = row[5] || null
      } else {
        subjectId = getValue(['przedmiot_id', 'subjectid', 'subjectId'])
        typ = getValue(['typ', 'type'])
        czas = getValue(['czas', 'time'])
        wykladowca_id = getValue(['wykladowca_id', 'lecturerid'])
        sala_id = getValue(['sala_id', 'roomid'])
        grupa = getValue(['grupa', 'groupid'])
      }
      return {
        przedmiot_id: subjectId ? Number(subjectId) : null,
        wykladowca_id: wykladowca_id ? Number(wykladowca_id) : null,
        typ,
        czas,
        sala_id: sala_id ? Number(sala_id) : null,
        grupa: grupa ? Number(grupa) : null,
      }
    }

    return null
  }

  const importCsvRecords = async (records, target) => {
    if (!records.length) {
      setFormStatus({ type: 'error', message: 'Plik CSV nie zawiera danych.' })
      return
    }

    const endpoint = target === 'student'
      ? '/student'
      : target === 'lecturer'
      ? '/wykladowca'
      : target === 'class'
      ? '/zajecia'
      : '/przedmiot'
    const results = await Promise.all(records.map(async (row, index) => {
      const payload = mapCsvRowToPayload(row, target)
      if (!payload) {
        return { index, ok: false, message: 'Niepoprawny wiersz CSV' }
      }
      try {
        const isStudentImport = target === 'student'

        if (isStudentImport) {
          console.log('CSV import payload (student):', payload)
        }

        const response = await apiFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const result = await response.json().catch(() => ({}))

        if (isStudentImport) {
          console.log('CSV import response (student):', {
            status: response.status,
            ok: response.ok,
            body: result,
          })
          if (!response.ok) {
            console.log('CSV import error details (student):', {
              message: result?.error || result?.message,
              errors: result?.errors,
              payload,
            })
          }
        }

        if (!response.ok) {
          return { index, ok: false, message: result.error || result.message || 'Błąd zapisu' }
        }

        return { index, ok: true }
      } catch (err) {
        return { index, ok: false, message: err.message }
      }
    }))

    const successCount = results.filter((item) => item.ok).length
    const failCount = results.length - successCount
    const summary = `Zaimportowano ${successCount} rekordów` + (failCount ? `, ${failCount} nie powiodło się` : '')
    setFormStatus({ type: failCount ? 'error' : 'success', message: summary })

    if (target === 'student') await fetchStudents()
    if (target === 'lecturer') await fetchLecturers()
    if (target === 'subject') await fetchSubjects()
    if (target === 'class') await fetchClasses()
  }

  const triggerImport = (target) => {
    setImportTarget(target)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length) {
      await importCsvRecords(rows, importTarget)
    }
    event.target.value = ''
  }

  const resetForm = () => {
    setSelectedStudent(null)
    setFormData({ indexNumber: '', login: '', password: '', rokSemestr: '', tryb: 'STAC', specjalnosc: '' })
    setSelectedLecturer(null)
    setLecturerFormData({ userId: '', firstName: '', lastName: '', title: '', login: '', password: '', availabilityGrid: {} })
    setSelectedSubject(null)
    setSubjectFormData({ name: '', hours: '', lecturerId: '', rokSemestr: '', tryb: '', specjalnosc: '' })
    setSelectedClass(null)
    setClassFormData({ subjectId: '', lecturerId: '', type: '', time: '', roomId: '', groupId: '', allowedDays: [], data_rozpoczecia: '', data_zakonczenia: '' })
    setFormStatus({ type: '', message: '' })
  }


  const handleBack = () => {
    setActiveView(null)
    resetForm()
  }

  const handleAssignToGroup = (classId = null) => {
    setAssignGroupFromView('groups');
    const initialFormData = { studentIds: [], zajeciaId: '' };
    if (classId) {
        initialFormData.zajeciaId = String(classId);
    }
    // Reset form data but keep the classId if provided
    setAssignStudentFormData(initialFormData);
    setActiveView('assignStudentToGroup');
  };

  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout()
      return
    }
    window.location.reload()
  }

  const pageStyle = {
    fontSize: `${fontScale}%`,
    filter: `contrast(${contrast}%)`,
  }

  const isWideView = ['students', 'lecturers', 'subjects', 'classes', 'rooms', 'groups'].includes(activeView);

  const contentContainerStyle = isWideView
    ? { maxWidth: '100%' }
    : {}

  const renderHeader = () => (
    <div className="student-menu-header">
      <div className="student-menu-user">
        <div>
          <strong>Menu administratora</strong>
          <div className="student-menu-user-info">Jesteś zalogowany jako {user?.login || user?.rola || 'administrator'}</div>
        </div>
      </div>

      <div className="student-menu-accessibility">
        <button type="button" onClick={() => setFontScale((prev) => Math.min(prev + 10, 160))}>
          A+
        </button>
        <button type="button" onClick={() => setFontScale((prev) => Math.max(prev - 10, 80))}>
          A-
        </button>
        <button type="button" onClick={() => setContrast((prev) => Math.min(prev + 15, 200))}>
          K+
        </button>
        <button type="button" onClick={() => setContrast((prev) => Math.max(prev - 15, 80))}>
          K-
        </button>
      </div>
    </div>
  )

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleLecturerFormChange = (event) => {
    const { name, value } = event.target
    setLecturerFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubjectFormChange = (event) => {
    // The child component passes the full new form data object, not an event.
    setSubjectFormData(event);
  }

  const handleClassFormChange = (event) => {
    const { name, value } = event.target
    setClassFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDeleteStudent = async (id) => {
    try {
      setFormStatus({ type: '', message: '' })
      const response = await apiFetch(`/student/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Nie udało się usunąć studenta'))
      }
      await fetchStudents()
      setFormStatus({ type: 'success', message: 'Usunięto studenta' })
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Nie udało się usunąć studenta' })
    }
  }

  const handleDeleteLecturer = async (id) => {
    try {
      setFormStatus({ type: '', message: '' })
      const response = await apiFetch(`/wykladowca/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Nie udało się usunąć wykładowcy'))
      }
      await Promise.all([fetchLecturers(), fetchSubjects(), fetchClasses()])
      setFormStatus({ type: 'success', message: 'Usunięto wykładowcę oraz powiązane przedmioty i zajęcia' })
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Nie udało się usunąć wykładowcy' })
    }
  }

  const handleEditLecturer = (lecturer) => {
    setSelectedLecturer(lecturer)
    setLecturerFormData({
      userId: lecturer.userId?.toString() || '',
      firstName: lecturer.firstName || '',
      lastName: lecturer.lastName || '',
      title: lecturer.title || '',
      login: lecturer.login || '',
      password: '',
      availabilityGrid: lecturer.availabilityGrid || {},
    })
    setActiveView('editLecturer')
  }

  const handleDeleteSubject = async (id) => {
    try {
      setFormStatus({ type: '', message: '' })
      const response = await apiFetch(`/przedmiot/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Nie udało się usunąć przedmiotu'))
      }
      await Promise.all([fetchSubjects(), fetchClasses()])
      setFormStatus({ type: 'success', message: 'Usunięto przedmiot oraz powiązane zajęcia' })
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Nie udało się usunąć przedmiotu' })
    }
  }

  const handleEditSubject = (subject) => {
    setSelectedSubject(subject)
    setSubjectFormData({
      name: subject.name,
      hours: subject.hours,
      lecturerId: subject.lecturerId?.toString() || '',
      rokSemestr: subject.semestr || '',
      tryb: subject.tryb || '',
      specjalnosc: subject.specjalnosc || '',
    })
    setActiveView('editSubject')
  }

  const handleDeleteClass = async (id) => {
    try {
      setFormStatus({ type: '', message: '' })
      const response = await apiFetch(`/zajecia/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Nie udało się usunąć zajęć'))
      }
      await fetchClasses()
      setFormStatus({ type: 'success', message: 'Usunięto zajęcia' })
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Nie udało się usunąć zajęć' })
    }
  }

  const handleEditClass = (classItem) => {
    // Ponieważ lista zajęć wyświetla nazwy zamiast ID, 
    // musimy odnaleźć oryginalny rekord w stanie classes, aby formularz otrzymał poprawne ID.
    const original = classes.find((c) => c.id === classItem.id) || classItem
    setSelectedClass(original)
    setClassFormData({
      subjectId: original.subjectId?.toString() || '',
      lecturerId: original.wykladowcaId != null ? String(original.wykladowcaId) : '',
      type: original.type,
      time: typeof original.time === 'string' ? original.time.slice(0, 5) : '',
      salaId: original.salaId != null ? original.salaId.toString() : '',
      groupId: original.groupId || '',
      allowedDays: original.dozwolone_dni || [],
      data_rozpoczecia: original.data_rozpoczecia ? new Date(original.data_rozpoczecia).toISOString().split('T')[0] : '',
      data_zakonczenia: original.data_zakonczenia ? new Date(original.data_zakonczenia).toISOString().split('T')[0] : '',
    })
    setActiveView('editClass')
  }


  const handleEditStudent = (student) => {
    setSelectedStudent(student)
    setFormData({
      indexNumber: student.indexNumber,
      login: student.login || '',
      password: '',
      rokSemestr: student.rok_semestr ?? '',
      tryb: student.tryb ?? '',
      specjalnosc: student.specjalnosc ?? '',
    })
    setActiveView('editStudent')
  }

  const parseApiError = async (response, defaultMessage) => {
    const result = await response.json().catch(() => ({}))
    if (Array.isArray(result.errors)) {
      return result.errors.map((error) => error.msg || error.message).join('; ')
    }
    return result.error || result.message || defaultMessage
  }

  const handleToggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };


  // View component renders list and actions
  const renderStudentListView = () => (
    <>
      <StudentList
        style={pageStyle}
        user={user}
        students={enrichedStudents}
        classes={enrichedClasses}
        onAdd={() => { resetForm(); setActiveView('addStudent') }}
        isBulkDeleteMode={isBulkDeleteMode}
        selectedStudentIds={selectedStudentIds}
        onToggleSelection={handleToggleStudentSelection}
        setIsBulkDeleteMode={setIsBulkDeleteMode}
        onAssign={() => {
          setAssignGroupFromView('students');
          // Ustawia w formularzu studentów zaznaczonych na liście przed przejściem do widoku.
          setAssignStudentFormData(prev => ({ ...prev, studentIds: selectedStudentIds }));
          setActiveView('assignStudentToGroup');
        }}
        onEdit={(s) => handleEditStudent(s)}
        onDelete={(id) => handleDeleteStudent(id)}
        onBack={handleBack}
        onImportCsv={() => triggerImport('student')}
        onImportExcel={() => triggerImport('student')}
        onBulkDelete={async () => {
          if (selectedStudentIds.length === 0) {
            setFormStatus({ type: 'error', message: 'Nie wybrano żadnych studentów.' });
            return;
          }
          try {
            const response = await apiFetch('/student', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selectedStudentIds }) });
            if (!response.ok) throw new Error(await parseApiError(response, 'Nie udało się usunąć studentów'));
            await fetchStudents();
            setFormStatus({ type: 'success', message: `Usunięto ${selectedStudentIds.length} studentów.` });
            setSelectedStudentIds([]);
            setIsBulkDeleteMode(false);
          } catch (error) {
            setFormStatus({ type: 'error', message: error.message });
          }
        }}
      />
    </>
  )

  const renderStudentFormView = (title) => (
    activeView === 'addStudent' ? (
      <AddStudent
        style={pageStyle}
        title={title}
        formData={formData}
        status={formStatus}
        classes={enrichedClasses}
        onChange={(fd) => setFormData(fd)}
        onCancel={() => setActiveView('students')}
        onSave={async (payload) => {
          setSaving(true)
          setFormStatus({ type: '', message: '' })
          try {
            const response = await apiFetch('/student', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nr_albumu: payload.indexNumber,
                login: payload.login || String(payload.indexNumber),
                password: payload.password || 'student',
                rok_semestr: payload.rok_semestr || payload.rokSemestr,
                tryb: payload.tryb || 'STAC',
                specjalnosc: payload.specjalnosc
              }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || 'Błąd zapisu studenta')
            setFormStatus({ type: 'success', message: 'Dodano nowego studenta' })
            await fetchStudents()
            setSelectedStudent(null)
            setActiveView('students')
            resetForm()
          } catch (err) {
            console.error(err)
            setFormStatus({ type: 'error', message: err.message || 'Błąd zapisu studenta' })
          } finally {
            setSaving(false)
          }
        }}
      />
    ) : (
      <EditStudent
        style={pageStyle}
        title={title}
        formData={formData}
        status={formStatus}
        classes={enrichedClasses}
        onChange={(fd) => setFormData(fd)}
        student={selectedStudent}
        onCancel={() => setActiveView('students')}
        onSave={async (payload) => {
          setSaving(true)
          setFormStatus({ type: '', message: '' })
          try {
            const response = await apiFetch(`/student/${selectedStudent.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nr_albumu: payload.indexNumber,
                login: payload.login,
                password: payload.password,
                rok_semestr: payload.rok_semestr || payload.rokSemestr,
                tryb: payload.tryb,
                specjalnosc: payload.specjalnosc
              }),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || result.message || 'Błąd zapisu studenta')
            setFormStatus({ type: 'success', message: 'Zaktualizowano dane studenta' })
            await fetchStudents()
            setSelectedStudent(null)
            setActiveView('students')
            resetForm()
          } catch (err) {
            console.error(err)
            setFormStatus({ type: 'error', message: err.message || 'Błąd zapisu studenta' })
          } finally {
            setSaving(false)
          }
        }}
      />
    )
  )
  

  const handleSubmitLecturer = async (payload) => {
    setSaving(true)
    setFormStatus({ type: '', message: '' })
    try {
      const url = selectedLecturer ? `/wykladowca/${selectedLecturer.id}` : '/wykladowca'
      const method = selectedLecturer ? 'PUT' : 'POST'
      const apiPayload = {
        uzytkownicy_id: payload.userId && payload.userId !== '0' ? Number(payload.userId) : null,
        imie: payload.firstName,
        nazwisko: payload.lastName,
        tytul_naukowy: payload.title,
        login: payload.login,
        haslo: payload.password,
      };
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response, 'Błąd zapisu wykładowcy')
        throw new Error(errorMessage)
      }
      setFormStatus({
        type: 'success',
        message: selectedLecturer ? 'Zaktualizowano dane wykładowcy' : 'Dodano nowego wykładowcę',
      })
      await Promise.all([fetchLecturers(), fetchSubjects(), fetchClasses()])
      await Promise.all([fetchLecturers(), fetchSubjects(), fetchClasses(), fetchRooms(), fetchGroupsData()])
      setActiveView('lecturers')
      resetForm()
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Błąd zapisu wykładowcy' })
    } finally {
      setSaving(false)
    }
  }

  const handleShowLecturerAvailability = async (lecturerId) => {
    setSelectedLecturerForAvailability(lecturerId);
    try {
      // Zawsze pobieraj świeże dane, aby zobaczyć nowe propozycje. Usunięto warunek `if (lecturerAvailabilities[lecturerId]) return;`
      const response = await apiFetch(`/plan/wykladowca/${lecturerId}/availability`);
      const data = await response.json();
      setLecturerAvailabilities(prev => ({ ...prev, [lecturerId]: data }));
    } catch (error) {
      console.error('Błąd pobierania dostępności wykładowcy:', error);
    }
  };
  const renderLecturerListView = () => (
    <>
      <LecturerList
        style={pageStyle}
        user={user}
        lecturers={lecturers}
        onAdd={() => { resetForm(); setActiveView('addLecturer') }}
        onEdit={(lecturer) => handleEditLecturer(lecturer)}
        onShowAvailability={handleShowLecturerAvailability}
        availabilities={lecturerAvailabilities}
        onDelete={(id) => handleDeleteLecturer(id)}
        onBack={handleBack}
        onImportCsv={() => triggerImport('lecturer')}
        onImportExcel={() => triggerImport('lecturer')}
        status={formStatus}
      />
      {selectedLecturerForAvailability && (
        <LecturerAvailabilityGrid
          lecturerName={lecturers.find(l => l.id === selectedLecturerForAvailability)?.displayName || ''}
          availability={lecturerAvailabilities[selectedLecturerForAvailability]?.all}
          onClose={() => setSelectedLecturerForAvailability(null)}
        />
      )}
    </>
  )

  const renderLecturerFormView = (title) => (
    activeView === 'addLecturer' ? (
      <AddLecturer
        style={pageStyle}
        title={title}
        formData={lecturerFormData}
        status={formStatus}
        onChange={handleLecturerFormChange}
        onCancel={() => setActiveView('lecturers')}
        onSave={async (payload) => {
          await handleSubmitLecturer(payload)
        }}
      />
    ) : (
      <EditLecturer
        style={pageStyle}
        title={title}
        formData={lecturerFormData}
        status={formStatus}
        onChange={handleLecturerFormChange}
        lecturer={selectedLecturer}
        onCancel={() => setActiveView('lecturers')}
        onSave={async (payload) => {
          await handleSubmitLecturer(payload)
        }}
      />
    )
  )

  const handleSubmitSubject = async (payload) => {
    setSaving(true)
    setFormStatus({ type: '', message: '' })
    try {
      const url = selectedSubject ? `/przedmiot/${selectedSubject.id}` : '/przedmiot'
      const method = selectedSubject ? 'PUT' : 'POST'
      const apiPayload = {
        nazwa: payload.nazwa ?? payload.name,
        ilosc_godz: (payload.ilosc_godz ?? payload.hours) ? Number(payload.ilosc_godz ?? payload.hours) : null,
        wykladowca_id: (payload.wykladowca_id ?? payload.lecturerId) && (payload.wykladowca_id ?? payload.lecturerId) !== '0' ? Number(payload.wykladowca_id ?? payload.lecturerId) : null,
        semestr: payload.semestr ?? payload.rokSemestr,
        tryb: payload.tryb ?? '',
        specjalnosc: payload.specjalnosc ?? '',
      };
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response, 'Błąd zapisu przedmiotu')
        throw new Error(errorMessage)
      }
      setFormStatus({
        type: 'success',
        message: selectedSubject ? 'Zaktualizowano dane przedmiotu' : 'Dodano nowy przedmiot',
      })
      await Promise.all([fetchSubjects(), fetchClasses()])
      await Promise.all([fetchLecturers(), fetchSubjects(), fetchClasses(), fetchRooms(), fetchGroupsData()])
      setActiveView('subjects')
      resetForm()
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Błąd zapisu przedmiotu' })
    } finally {
      setSaving(false)
    }
  }

  const renderSubjectListView = () => (
    <SubjectList
      style={pageStyle}
      subjects={enrichedSubjects}
      onAdd={() => { resetForm(); setActiveView('addSubject'); }}
      onEdit={handleEditSubject}
      onDelete={handleDeleteSubject}
      onBack={handleBack}
      onImportCsv={() => triggerImport('subject')}
      onImportExcel={() => triggerImport('subject')}
      status={formStatus}
    />
  );

  const renderSubjectFormView = (title) => (
    activeView === 'addSubject' ? (
      <AddSubject
        style={pageStyle}
        title={title}
        formData={subjectFormData}
        status={formStatus}
        lecturers={lecturers}
        onChange={handleSubjectFormChange}
        onCancel={() => setActiveView('subjects')}
        onSave={async (payload) => {
          await handleSubmitSubject(payload)
        }}
      />
    ) : (
      <EditSubject
        style={pageStyle}
        title={title}
        formData={subjectFormData}
        status={formStatus}
        lecturers={lecturers}
        onChange={handleSubjectFormChange}
        subject={selectedSubject}
        onCancel={() => setActiveView('subjects')}
        onSave={async (payload) => {
          await handleSubmitSubject(payload)
        }}
      />
    )
  )

  const renderClassFormView = (title) => (
    activeView === 'addClass' ? (
      <AddZajecia
        style={pageStyle}
        title={title}
        formData={classFormData}
        status={formStatus}
        subjects={subjectsForClassForms}
        rooms={rooms}
        lecturers={lecturers}
        weekdays={fullTimeWeekdays}
        classTypes={classTypeOptions}
        onChange={handleClassFormChange}
        onCancel={() => setActiveView('classes')}
        onSave={async (payload) => {
          await handleSubmitClass(payload)
        }}
      />
    ) : (
      <EditZajecia
        style={pageStyle}
        title={title}
        classData={selectedClass}
        formData={classFormData}
        status={formStatus}
        subjects={subjectsForClassForms}
        rooms={rooms}
        lecturers={lecturers}
        weekdays={fullTimeWeekdays}
        classTypes={classTypeOptions}
        onChange={handleClassFormChange}
        onCancel={() => setActiveView('classes')}
        onSave={async (payload) => {
          await handleSubmitClass(payload)
        }}
      />
    )
  )

  const normalizeClassTime = (value) => {
    if (typeof value !== 'string') return value ?? ''
    const trimmed = value.trim()
    if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
      return `${trimmed}:00`
    }
    return trimmed
  }

  const handleSubmitClass = async (payload) => {
    const normalizeValue = (value, fallback = null) => (value !== undefined && value !== '' ? value : fallback)

    setSaving(true)
    setFormStatus({ type: '', message: '' })
    try {
      const url = selectedClass ? `/zajecia/${selectedClass.id}` : '/zajecia'
      const method = selectedClass ? 'PUT' : 'POST'

      const apiPayload = {
        ...payload,
        subjectId: normalizeValue(payload.subjectId, payload.przedmiot_id ?? null),
        przedmiot_id: normalizeValue(payload.przedmiot_id, payload.subjectId ?? null),
        lecturerId: normalizeValue(payload.lecturerId, payload.wykladowca_id ?? null),
        wykladowca_id: normalizeValue(payload.wykladowca_id, payload.lecturerId ?? null),
        type: normalizeValue(payload.type, payload.typ ?? null),
        typ: normalizeValue(payload.typ, payload.type ?? null),
        time: normalizeValue(payload.time, payload.czas ?? null),
        czas: normalizeValue(payload.czas, payload.time ?? null),
        roomId: normalizeValue(payload.roomId, payload.sala_id ?? payload.salaId ?? null),
        sala_id: normalizeValue(payload.sala_id, payload.roomId ?? payload.salaId ?? null),
        grupa: normalizeValue(payload.grupa, payload.groupId ?? null),
        groupId: normalizeValue(payload.groupId, payload.grupa ?? null),
        dozwolone_dni: payload.allowedDays && payload.allowedDays.length > 0 ? payload.allowedDays : null,
        data_rozpoczecia: payload.data_rozpoczecia || null,
        data_zakonczenia: payload.data_zakonczenia || null,
      }
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      })
      if (!response.ok) {
        const errorMessage = await parseApiError(response, 'Błąd zapisu zajęć')
        throw new Error(errorMessage)
      }

      const result = await response.json().catch(() => null)
      const mappedClass = result ? mapClassRowToState(result) : null

      setClasses((prev) => {
        if (!mappedClass) return prev
        if (selectedClass) {
          return prev.map((item) => (item.id === selectedClass.id ? mappedClass : item))
        }
        return [mappedClass, ...prev]
      })

      setFormStatus({
        type: 'success',
        message: selectedClass ? 'Zaktualizowano dane zajęć' : 'Dodano nowe zajęcia',
      })
      await Promise.all([fetchClasses(), fetchSubjects(), fetchRooms()])
      await Promise.all([fetchLecturers(), fetchSubjects(), fetchClasses(), fetchRooms(), fetchGroupsData()])
      setActiveView('classes')
      resetForm()
    } catch (error) {
      console.error(error)
      setFormStatus({ type: 'error', message: error.message || 'Błąd zapisu zajęć' })
    } finally {
      setSaving(false)
    }
  }

  const renderClassListView = () => (
    <>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu administratora</strong>
            <div className="student-menu-user-info">Zarządzanie zajęciami</div>
          </div>
        </div>
      </div>
      <div className="student-plan-card">
        <div className="admin-form-actions" style={{ justifyContent: 'flex-start', marginBottom: '1rem' }}>
          <button type="button" className="card-back-button" onClick={handleBack}>
            Powrót do menu
          </button>
        </div>

        <div className="plan-header">
          <div>
            <div className="plan-label">Zajęcia</div>
            <h1>Lista zajęć</h1>
            <p className="plan-subtitle">Dodawaj, edytuj lub usuwaj zajęcia.</p>
          </div>
        </div>

        <div className="admin-student-actions" style={{ gap: '0.5rem', display: 'flex', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { resetForm(); setActiveView('addClass') }}>Dodaj zajęcia</button>
          <button type="button" onClick={() => triggerImport('class')}>Importuj z CSV</button>
        </div>

        <div className="admin-table-wrapper">
          {groupedClasses.map(({ mode, semesters }) => (
            <div key={mode} style={{ marginBottom: '2rem' }}>
              <h2 style={{ padding: '10px', backgroundColor: '#eef7ff', borderRadius: '8px', marginTop: 0 }}>
                Tryb: {mode}
              </h2>
              {semesters.map(({ semester, specializations }) => (
                <div key={semester} style={{ marginLeft: '20px', marginBottom: '1rem' }}>
                  <h3 style={{ borderBottom: '2px solid #eef7ff', paddingBottom: '5px' }}>
                    Semestr: {semester} ({mode})
                  </h3>
                  {specializations.map(({ name, classes: specializationClasses }) => (
                    <div key={name} style={{ marginLeft: '20px', marginBottom: '1rem' }}>
                      <h4 style={{ borderBottom: '1px solid #eef7ff', paddingBottom: '5px', color: '#4a5f72' }}>
                        Specjalność: {name}
                      </h4>
                      {specializationClasses.length > 0 ? (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Przedmiot</th>
                              <th>Typ</th>
                              <th>Wykładowca</th>
                              <th>Sala</th>
                              <th>Czas</th>
                              <th>Grupa</th>
                              <th>Akcje</th>
                            </tr>
                          </thead>
                          <tbody>
                            {specializationClasses.map((classItem) => (
                              <tr key={classItem.id}>
                                <td>{classItem.subjectNameForDisplay}</td>
                                <td>{classItem.type}</td>
                                <td>{classItem.lecturerName}</td>
                                <td>{classItem.roomName}</td>
                                <td>{classItem.time}</td>
                                <td>{classItem.groupId || '-'}</td>
                                <td className="admin-actions-cell">
                                  <button type="button" onClick={() => handleEditClass(classItem)}>Edytuj</button>
                                  <button type="button" className="delete-button" onClick={() => handleDeleteClass(classItem.id)}>Usuń</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p>Brak zajęć dla tej specjalności.</p>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )

  const renderContent = () => {
    if (activeView === 'students') return renderStudentListView()
    if (activeView === 'addStudent') return renderStudentFormView('Dodaj studenta')
    if (activeView === 'editStudent') return renderStudentFormView('Edytuj studenta');
    if (activeView === 'assignStudentToGroup') return <AssignStudentToGroup
      style={pageStyle}
      students={enrichedStudents}
      classes={enrichedClasses}
      formData={assignStudentFormData}
      onChange={setAssignStudentFormData}
      onCancel={() => setActiveView(assignGroupFromView)}
      onSave={async (payload) => {
        setSaving(true);
        setFormStatus({ type: '', message: '' });
        try {
          const response = await apiFetch('/grupa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentIds: payload.studentIds,
              zajeciaId: payload.zajeciaId,
            }),
          });
          if (!response.ok) {
            throw new Error(await parseApiError(response, 'Błąd przypisywania studentów'));
          }
          setFormStatus({ type: 'success', message: 'Pomyślnie przypisano studentów do grupy.' });
          await fetchGroupsData();
          // Zgodnie z prośbą, nie przekierowujemy. Czyścimy wybór studentów, zachowując wybrane zajęcia.
          // Pozwala to na łatwe przypisanie kolejnych studentów do tej samej grupy.
          setAssignStudentFormData(prev => ({ ...prev, studentIds: [] }));
        } catch (err) {
          setFormStatus({ type: 'error', message: err.message });
        } finally {
          setSaving(false);
        }
      }}
      status={formStatus}
    />
    if (activeView === 'lecturers') return renderLecturerListView()
    if (activeView === 'addLecturer') return renderLecturerFormView('Dodaj wykładowcę')
    if (activeView === 'editLecturer') return renderLecturerFormView('Edytuj wykładowcę')
    if (activeView === 'subjects') return renderSubjectListView()
    if (activeView === 'addSubject') return renderSubjectFormView('Dodaj przedmiot')
    if (activeView === 'editSubject') return renderSubjectFormView('Edytuj przedmiot')
    if (activeView === 'classes') return renderClassListView()
    if (activeView === 'addClass') return renderClassFormView('Dodaj zajęcia')
    if (activeView === 'editClass') return renderClassFormView('Edytuj zajęcia')

    if (activeView === 'deanGroups') return <DeanGroupsManager onBack={handleBack} setFormStatus={setFormStatus} />
    if (activeView === 'rooms') return (
      <RoomList
        style={pageStyle}
        rooms={rooms}
        onAdd={() => { setRoomFormData({ nazwa: '', budynek: '', limit_studentow: '' }); setActiveView('addRoom') }}
        onEdit={(room) => {
          setSelectedRoom(room);
          setRoomFormData({ nazwa: room.nazwa || '', budynek: room.budynek || '', limit_studentow: room.limit_studentow != null ? String(room.limit_studentow) : '' });
          setActiveView('editRoom');
        }}
        onDelete={async (id) => {
          try {
            const response = await apiFetch(`/sale/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Błąd usuwania');
            await fetchRooms();
            setFormStatus({ type: 'success', message: 'Usunięto salę' });
          } catch (err) { setFormStatus({ type: 'error', message: err.message }); }
        }}
        onBack={handleBack}
        status={formStatus}
      />
    )

    if (activeView === 'addRoom') return (
      <AddRoom
        style={pageStyle}
        title="Dodaj salę"
        formData={roomFormData}
        status={formStatus}
        onChange={setRoomFormData}
        onCancel={() => setActiveView('rooms')}
        onSave={async (payload) => {
          try {
            const response = await apiFetch('/sale', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (!response.ok) throw new Error('Błąd zapisu')
            await fetchRooms()
            setActiveView('rooms')
            setFormStatus({ type: 'success', message: 'Dodano nową salę.' });
          } catch (err) {
            setFormStatus({ type: 'error', message: err.message })
          }
        }} />
    )

    if (activeView === 'editRoom') return <EditRoom
      style={pageStyle}
      title="Edytuj salę"
      room={selectedRoom}
      formData={roomFormData}
      status={formStatus}
      onChange={setRoomFormData}
      onCancel={() => setActiveView('rooms')}
      onSave={async (payload) => {
        try {
          // Zakładając, że obiekt `selectedRoom` ma właściwość `id_sala`
          const response = await apiFetch(`/sale/${selectedRoom.id_sala}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error('Błąd zapisu');
          await fetchRooms();
          setActiveView('rooms');
          setFormStatus({ type: 'success', message: 'Zaktualizowano salę.' });
        } catch (err) {
          setFormStatus({ type: 'error', message: err.message });
        }
      }}
    />

    if (activeView === 'groups') return <ViewGroupList
      style={pageStyle}
      groups={flatGroupsForView}
      onBack={handleBack}
      onAssign={handleAssignToGroup}
      onViewDetails={(groupId) => {
        setSelectedGroupId(groupId);
        setActiveView('groupDetails');
      }}
      studyMode={groupViewStudyMode}
      onStudyModeChange={setGroupViewStudyMode}
      onDelete={handleDeleteClass}
    />

    if (activeView === 'groupDetails') return <ViewGroupDetails
      style={pageStyle}
      groupId={selectedGroupId}
      classes={enrichedClasses}
      students={enrichedStudents}
      groupsData={groupsData}
      onBack={() => setActiveView('groups')}
      status={formStatus}
      onDeleteFromGroup={async (id_grupa, student_id) => {
        setFormStatus({ type: '', message: '' });
        try {
          const response = await apiFetch('/grupa/student', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            // Backend oczekuje tablicy wpisów, gdzie każdy ma klucz `id_grupa` (PK z tabeli grupa) i `student_id`
            body: JSON.stringify({ entries: [{ id_grupa, student_id }] }),
          });
          if (!response.ok) throw new Error(await parseApiError(response, 'Błąd usuwania studenta z grupy'));
          await fetchGroupsData(); // Odśwież dane o przypisaniach
          setFormStatus({ type: 'success', message: 'Usunięto studenta z grupy.' });
        } catch (err) {
          setFormStatus({ type: 'error', message: err.message });
        }
      }}
      onBulkDeleteFromGroup={async (entries) => {
        setFormStatus({ type: '', message: '' });
        try {
          const response = await apiFetch('/grupa/student', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries }),
          });
          if (!response.ok) throw new Error(await parseApiError(response, 'Błąd usuwania studentów z grupy'));
          await fetchGroupsData(); // Odśwież dane o przypisaniach
          setFormStatus({ type: 'success', message: `Usunięto ${entries.length} studentów z grupy.` });
        } catch (err) {
          setFormStatus({ type: 'error', message: err.message });
        }
      }}
    />

    if (activeView === 'generator') return <Generator onBack={handleBack} onGenerate={({ plan, stats, mode, semester }) => {
      setGeneratedPlan(plan);
      setGenerationStats(stats);
      setGenerationMode(mode);
      setGenerationSemester(semester);
      setActiveView('viewGeneratedPlan');
    }} />

    if (activeView === 'viewGeneratedPlan') return <ViewPlan 
      plan={generatedPlan} 
      stats={generationStats} 
      studyMode={generationMode}
      initialSemester={generationSemester}
      onBack={() => setActiveView('generator')} 
      onClear={() => {
        setGeneratedPlan(null);
        setGenerationStats(null);
      }}
    />

    // Domyślny widok: Główne menu
    return (
      <>
        {renderHeader()}
        <div className="student-menu-panel">
          <button type="button" onClick={() => setActiveView('students')}>Zarządzaj studentami</button>
          <button type="button" onClick={() => setActiveView('lecturers')}>Zarządzaj wykładowcami</button>
          <button type="button" onClick={() => setActiveView('subjects')}>Zarządzaj przedmiotami</button>
          <button type="button" onClick={() => setActiveView('classes')}>Zarządzaj zajęciami</button>
          <button type="button" onClick={() => setActiveView('rooms')}>Zarządzaj salami</button>
          <button type="button" onClick={() => setActiveView('groups')}>Składy grup zajęciowych</button>
          <button type="button" onClick={handleLogout} className="logout-button" style={{ background: '#4a5f72' }}>Wyloguj</button>
        </div>
      </>
    );
  }

  return (
    <div className={`student-menu-page ${isWideView ? 'plan-viewer-page' : ''}`} style={pageStyle}>
      <div className="main" style={contentContainerStyle}>
        {formStatus.message && <div className={`form-notice ${formStatus.type === 'error' ? 'form-error' : 'form-success'}`}>{formStatus.message}</div>}
        {renderContent()}
      </div>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept=".csv, text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
    </div>
  );
}

export default AdminMenu;