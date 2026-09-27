import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';

const normalizeStudyModeValue = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NST' || normalized === 'NSTAC') return 'NSTAC';
  return 'STAC';
};

const normalizeSemesterValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = text.match(/(\d+)/);
  return match ? match[1] : text;
};

export default function GroupCompositionViewer({ studyMode = 'STAC', initialSemester = '', onViewDetails }) {
  const [classes, setClasses] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
          const [classesRes, groupsRes, studentsRes, subjectsRes] = await Promise.all([
            apiFetch('/zajecia'),
            apiFetch('/grupa'),
            apiFetch('/student'),
            apiFetch('/przedmiot'),
        ]);

        const [classesData, groupsData, studentsData, subjectsData] = await Promise.all([
           classesRes,
           groupsRes,
           studentsRes,
           subjectsRes,
        ]);

        setClasses(Array.isArray(classesData) ? classesData : []);
        setGroupAssignments(Array.isArray(groupsData) ? groupsData : []);
        setStudents(Array.isArray(studentsData) ? studentsData : []);
        setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Nie udało się pobrać składów grup.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const semesterSections = useMemo(() => {
    const normalizedMode = normalizeStudyModeValue(studyMode);
    const studentsById = new Map((students || []).map((student) => [String(student.idstudent), student]));
    const subjectsById = new Map((subjects || []).map((subject) => [subject.idprzedmiotu, subject]));
    const sections = new Map();

    (classes || []).forEach((item) => {
      const subject = subjectsById.get(item.przedmiot_id);

      const itemMode = normalizeStudyModeValue(item.tryb_for_display || item.tryb || subject?.tryb || item.tryb_studiow);
      if (itemMode !== normalizedMode) return;

      const semester = normalizeSemesterValue(item.semestr_for_display || item.semestr || subject?.semestr);
      if (!semester) return;

      if (!sections.has(semester)) {
        sections.set(semester, { semester, subjects: new Map(), groups: [] });
      }

      const section = sections.get(semester);
      const subjectName = item.subject_name_for_display || subject?.nazwa || 'Brak nazwy przedmiotu';
      if (!section.subjects.has(subjectName)) {
        section.subjects.set(subjectName, []);
      }

      const groupMembers = (groupAssignments || [])
        .filter((assignment) => Number(assignment.zajecia_id) === Number(item.idzajecia))
        .map((assignment) => {
          const student = studentsById.get(String(assignment.student_id));
          return student
            ? {
                idstudent: student.idstudent,
                nrAlbumu: student.nr_albumu ?? null,
                specjalnosc: student.specjalnosc ?? null,
              }
            : {
                idstudent: assignment.student_id,
                nrAlbumu: null,
                specjalnosc: null,
              };
        })
        .sort((a, b) => Number(a.idstudent) - Number(b.idstudent));

      const group = {
        id: item.idzajecia,
        subjectName,
        type: item.typ || '—',
        groupNumber: item.grupa != null && item.grupa !== '' ? `Gr. ${item.grupa}` : 'Brak grupy',
        time: item.czas || '—',
        members: groupMembers,
      };

      section.groups.push(group);
      section.subjects.get(subjectName).push(group);
    });

    return Array.from(sections.values())
      .map((section) => ({
        ...section,
        subjects: Array.from(section.subjects.entries())
          .map(([name, groups]) => ({ name, groups }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pl')),
        groups: section.groups.sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pl')),
      }))
      .sort((a, b) => Number(a.semester) - Number(b.semester));
  }, [classes, groupAssignments, studyMode, students, subjects]);

  const semesterOptions = useMemo(() => semesterSections.map((section) => section.semester), [semesterSections]);

  useEffect(() => {
    if (initialSemester && initialSemester !== 'all') {
      const nextSemester = String(initialSemester);
      if (semesterOptions.includes(nextSemester)) {
        setSelectedSemester((current) => (current === nextSemester ? current : nextSemester));
        return;
      }
    }

    if (!selectedSemester && semesterOptions.length > 0) {
      setSelectedSemester(String(semesterOptions[0]));
    }
  }, [initialSemester, semesterOptions, selectedSemester]);

  const selectedSection = useMemo(() => {
    return semesterSections.find((section) => section.semester === selectedSemester) || null;
  }, [semesterSections, selectedSemester]);

  return (
    <section style={{ marginTop: '1.25rem' }}>
      <h2>Składy grup</h2>
      <p style={{ marginTop: '-0.25rem', color: '#4b5563' }}>
        Lista składów grup pobrana z danych administratora dla wybranego semestru.
      </p>

      {loading ? (
        <p>Ładowanie składów grup…</p>
      ) : error ? (
        <p style={{ color: '#b91c1c' }}>{error}</p>
      ) : (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontWeight: 600, marginBottom: '0.8rem' }}>
            Semestr
            <select value={selectedSemester} onChange={(event) => setSelectedSemester(event.target.value)}>
              {semesterOptions.map((semester) => (
                <option key={semester} value={semester}>Semestr {semester}</option>
              ))}
            </select>
          </label>

          {!selectedSection ? (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.8rem', background: '#f8fafc' }}>
              Brak grup dla wybranego semestru.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedSection.subjects.map((subject) => (
                <details key={`${selectedSection.semester}-${subject.name}`} open style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem', background: '#fff' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700, listStyle: 'none' }}>
                    {subject.name}
                  </summary>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {subject.groups.map((group) => (
                      <div key={group.id} style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '0.7rem' }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          {group.type} • {group.groupNumber} • {group.time}
                          {onViewDetails && (
                            <button type="button" onClick={() => onViewDetails(group.id)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                              Szczegóły
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {group.members.length > 0 ? (
                            group.members.map((member) => (
                              <span
                                key={`${group.id}-${member.idstudent}`}
                                style={{ background: '#eff6ff', borderRadius: '999px', padding: '0.25rem 0.6rem', fontSize: '0.85rem' }}
                              >
                                {member.nrAlbumu ? `#${member.nrAlbumu}` : `ID ${member.idstudent}`}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Brak przypisanych studentów</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
