import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api';
import PlanViewer from '../planist/PlanViewer.jsx';
import '../App.css';

function ViewGroups({ user, onBack }) {
    const [activeView, setActiveView] = useState('plan'); // 'plan' or 'list'
    const [plansData, setPlansData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // State for the list view
    const [assignedClasses, setAssignedClasses] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState(null);


    const studentYear = useMemo(() => {
        if (!user?.rok_semestr) return null;
        const match = String(user.rok_semestr).match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }, [user?.rok_semestr]);

  useEffect(() => {
    if (activeView !== 'plan') return;
    if (!user?.id) {
        setLoading(false);
        setError('Brak ID użytkownika.');
        return;
    }

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            let data = await apiFetch(`/plan/student/${user.id}`);
            
            if (studentYear === 3 && data.results) {
                const filteredResults = {};
                for (const key in data.results) {
                    const [sem] = key.split('|');
                    if (sem === '5' || sem === '6') {
                        filteredResults[key] = data.results[key];
                    }
                }
                data.results = filteredResults;
            }

            if (!data || !data.results || Object.keys(data.results).length === 0) {
                // Jeśli brak przypisanych zajęć bezpośrednio dla studenta,
                // spróbuj pobrać ostatnio wygenerowany plan i wyświetlić
                // warianty semestru, do którego student jest przypisany.
                if (user?.rok_semestr) {
                    try {
                        const lastData = await apiFetch('/plan/last');
                        if (lastData) {
                            const payload = lastData?.plan || lastData?.results || lastData || {};
                            const semMatch = String(user.rok_semestr).match(/(\d+)$/);
                            const studentSem = semMatch ? semMatch[1] : null;
                            const resultsObj = {};
                            if (payload && typeof payload === 'object') {
                                const source = payload.results && typeof payload.results === 'object' ? payload.results : (payload.plan && typeof payload.plan === 'object' ? payload.plan : payload);
                                for (const key in source) {
                                    const [sem] = String(key).split('|');
                                    if (studentSem && sem === studentSem) {
                                        resultsObj[key] = source[key];
                                    }
                                }
                            }

                            if (Object.keys(resultsObj).length > 0) {
                                setPlansData({ results: resultsObj, isEmpty: false, metadata: lastData?.metadata || {} });
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (err) {
                        // ignoruj i kontynuuj - zostaw plansData jako puste
                    }
                }

                setPlansData({ results: {}, isEmpty: true });
            } else {
                setPlansData(data);
            }

        } catch (err) {
            setError(err.message);
            setPlansData(null);
        } finally {
            setLoading(false);
        }
    }
    loadData();
  }, [user?.id, studentYear, activeView]);

  useEffect(() => {
    if (activeView !== 'list' || !user?.id) return;

    const loadListData = async () => {
        setListLoading(true);
        setListError(null);
        try {
            const data = await apiFetch(`/student/${user.id}/zajecia`);
            const enriched = data.map(item => ({
                id: item.idzajecia,
                subjectName: item.subject_name || '?',
                type: item.typ || 'Zajęcia',
                time: item.czas || '-',
                roomName: item.sala_nazwa ? `${item.sala_nazwa} (${item.sala_budynek || ''})` : 'Brak sali',
                count: item.group_count || 0
            }));
            setAssignedClasses(enriched);
        } catch (err) {
            setListError(err.message);
        } finally {
            setListLoading(false);
        }
    };

    loadListData();
  }, [user?.id, activeView]);

  const translateType = (type) => {
    if (!type) return 'Zajęcia'
    const lower = type.toLowerCase()
    if (lower === 'wyklad' || lower === 'wykład') return 'Wykład'
    if (lower === 'cwiczenia' || lower === 'ćwiczenia') return 'Ćwiczenia'
    if (lower === 'laboratorium' || lower === 'lab') return 'Laboratorium'
    if (lower === 'seminarium' || lower === 'sem') return 'Seminarium'
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <div className="student-menu-page plan-viewer-page">
        <div className="student-plan-card">
            <div className="plan-header">
                <h2>{activeView === 'plan' ? 'Twój plan zajęć' : 'Twoje grupy zajęciowe'}</h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="card-back-button" onClick={() => setActiveView('plan')} style={activeView !== 'plan' ? { background: '#f0f0f0', color: '#333' } : {}}>Plan zajęć</button>
                    <button type="button" className="card-back-button" onClick={() => setActiveView('list')} style={activeView !== 'list' ? { background: '#f0f0f0', color: '#333' } : {}}>Lista grup</button>
                    <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
                </div>
            </div>

            {activeView === 'plan' && (
                <>
                    {loading && <p>Ładowanie planu...</p>}
                    {error && <p className="error-message">{error}</p>}
                    {!loading && !error && plansData && (
                        <>
                            {plansData.isEmpty ? (
                                <div className="empty-state" style={{padding: '2rem'}}>
                                    <p>Nie jesteś przypisany/a do żadnych zajęć w opublikowanym planie.</p>
                                </div>
                            ) : (
                                <PlanViewer plansData={plansData} />
                            )}
                        </>
                    )}
                </>
            )}

            {activeView === 'list' && (
                <>
                    {listLoading && <p className="plan-subtitle">Ładowanie danych grup...</p>}
                    {listError && <p className="plan-subtitle form-error" style={{ padding: '10px', borderRadius: '8px' }}>Błąd: {listError}</p>}
                    
                    {!listLoading && !listError && assignedClasses.length === 0 && (
                      <p className="plan-subtitle">Nie jesteś obecnie przypisany/a do żadnej grupy zajęciowej.</p>
                    )}

                    {!listLoading && !listError && assignedClasses.length > 0 && (
                      <div className="groups-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {assignedClasses.map((item) => (
                          <div key={item.id} className="group-item" style={{
                            padding: '20px',
                            border: '1px solid rgba(15, 41, 64, 0.08)',
                            background: '#f8fbff',
                            borderRadius: '18px',
                            display: 'grid',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '1.2rem', color: '#0f2940' }}>{item.subjectName}</strong>
                              <span className="plan-label" style={{ margin: 0 }}>{translateType(item.type)}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', color: '#556a85' }}>Godzina zajęć</span>
                                <strong style={{ color: '#2c4364', fontSize: '0.95rem' }}>{item.time}</strong>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', color: '#556a85' }}>Sala</span>
                                <strong style={{ color: '#2c4364', fontSize: '0.95rem' }}>{item.roomName}</strong>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', color: '#556a85' }}>Liczba studentów w grupie</span>
                                <strong style={{ color: '#2c4364', fontSize: '0.95rem' }}>{item.count} osób</strong>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </>
            )}
        </div>
    </div>
  )
}

export default ViewGroups
