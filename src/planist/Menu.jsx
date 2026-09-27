import { useState,useEffect } from 'react'
import '../App.css'
import Generator from './generator.jsx'
import ViewPlan from './view_plan.jsx'
import GroupCompositionViewer from './GroupCompositionViewer.jsx'
import { apiFetch } from '../api'
const normalizeStudyModeValue = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NST' || normalized === 'NSTAC') return 'NSTAC';
  if (normalized === 'ST' || normalized === 'STAC') return 'STAC';
  return 'STAC';
};

const resolvePlanStudyMode = (planData) => {
  if (!planData || typeof planData !== 'object') return 'STAC';

  const metadataMode = planData?.metadata?.study_mode || planData?.metadata?.studyMode;
  const directCandidates = [
    planData.studyMode,
    planData.mode,
    metadataMode,
    planData?.plan?.studyMode,
    planData?.plan?.mode,
    planData?.results?.studyMode,
    planData?.results?.mode,
    planData?.plans?.studyMode,
    planData?.plans?.mode,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeStudyModeValue(candidate);
    if (normalized === 'STAC' || normalized === 'NSTAC') return normalized;
  }

  return 'STAC';
};

const resolvePlanSemester = (planData) => {
  if (!planData || typeof planData !== 'object') return null;

  const metadataSemesters = Array.isArray(planData?.metadata?.selected_semesters)
    ? planData.metadata.selected_semesters
    : Array.isArray(planData?.selected_semesters)
      ? planData.selected_semesters
      : [];

  const parsedMetadataSemester = metadataSemesters
    .map((value) => String(value || '').trim())
    .find(Boolean);

  const candidates = [
    planData.semester,
    planData.semesterFilter,
    planData.initialSemester,
    parsedMetadataSemester,
    planData?.metadata?.semester,
    planData?.metadata?.semesterFilter,
    planData?.plan?.semester,
    planData?.plan?.semesterFilter,
    planData?.results?.semester,
    planData?.results?.semesterFilter,
    planData?.plans?.semester,
    planData?.plans?.semesterFilter,
  ];

  for (const candidate of candidates) {
    if (candidate == null || candidate === '' || candidate === 'all') continue;
    const normalized = String(candidate).trim();
    if (!normalized) continue;
    const [semesterPart] = normalized.split('|');
    const semesterValue = semesterPart.trim();
    if (semesterValue) return semesterValue;
  }

  return null;
};

function Menu({ user, onLogout }) {
  const [activeView, setActiveView] = useState(null)
  const [hasPlanLoaded, setHasPlanLoaded] = useState(false)
  const [fontScale, setFontScale] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [generatedPlan, setGeneratedPlan] = useState({})
  const [initialSemester, setInitialSemester] = useState(null);
  const [studyMode, setStudyMode] = useState('STAC');
  const [userSelectedStudyMode, setUserSelectedStudyMode] = useState(false);
  const [generationStats, setGenerationStats] = useState(null);
  const [slots, setSlots] = useState([]);
  const [groupCompositionSource, setGroupCompositionSource] = useState(null);

    const handleBack = () => {
    if (activeView === 'groupComposition') {
      setGroupCompositionSource(null);
      setActiveView(groupCompositionSource === 'viewPlan' ? 'viewPlan' : null);
      return;
    }
    setActiveView(null)
  }
  const handleLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout()
      return
    }
    window.location.reload()
  }

  const handlePlanGenerated = ({ plan, plans, stats, mode, semester, semesterFilter, studyModeLabel, specializationLabel }) => {
    const nextPlan = plan ?? plans ?? {};
    setGeneratedPlan(nextPlan);
    setGenerationStats(stats);
    const resolvedMode = normalizeStudyModeValue(mode || resolvePlanStudyMode(nextPlan));
    const resolvedSemester = semester || resolvePlanSemester(nextPlan) || semesterFilter || null;
    if (resolvedMode === 'STAC' || resolvedMode === 'NSTAC') {
      setStudyMode(resolvedMode);
      setUserSelectedStudyMode(true);
    }
    setInitialSemester(resolvedSemester);
    setHasPlanLoaded(true);
    setActiveView('viewPlan');
    if (semesterFilter) {
      sessionStorage.setItem('planist:lastSemesterFilter', semesterFilter);
    }
    if (studyModeLabel) {
      sessionStorage.setItem('planist:lastStudyModeLabel', studyModeLabel);
    }
    if (specializationLabel) {
      sessionStorage.setItem('planist:lastSpecializationLabel', specializationLabel);
    }
  };

  const resolveSelectedPlanFromSavedList = async () => {
    try {
      const listRes = await apiFetch('/plan/list');
      if (!listRes.ok) return null;

      const planList = await listRes.json();
      if (!Array.isArray(planList) || planList.length === 0) return null;

      const storedSemester = sessionStorage.getItem('planist:lastSemesterFilter');
      const storedMode = sessionStorage.getItem('planist:lastStudyModeLabel');
      const normalizedStoredSemester = storedSemester && storedSemester !== 'all' ? String(storedSemester).trim() : null;
      const normalizedStoredMode = storedMode && ['STAC', 'NSTAC'].includes(String(storedMode).trim()) ? String(storedMode).trim() : null;

      const matchedPlan = planList.find((entry) => {
        const planKey = entry?.planKey || '';
        const keyParts = String(planKey).split('|');
        const planSemester = keyParts[0] || '';
        const planMode = keyParts[keyParts.length - 1] || '';

        const matchesSemester = !normalizedStoredSemester || planSemester === normalizedStoredSemester.split('|')[0];
        const matchesMode = !normalizedStoredMode || planMode === normalizedStoredMode;
        const matchesSemesterVariant = !normalizedStoredSemester || planKey.startsWith(`${normalizedStoredSemester.split('|')[0]}|`);

        return matchesSemester && matchesMode && matchesSemesterVariant;
      }) || planList[0];

      if (!matchedPlan?.planId) return null;

      const structuredRes = await apiFetch(`/plan/structured/${matchedPlan.planId}`);
      if (!structuredRes.ok) return null;
      return await structuredRes.json();
    } catch (err) {
      console.error('Błąd rozstrzygania planu z listy zapisanych planów:', err);
      return null;
    }
  };

  const handleViewPlan = async () => {
    try {
      const preferredPlan = await resolveSelectedPlanFromSavedList();
      if (preferredPlan) {
        setGeneratedPlan(preferredPlan);
        setGenerationStats(null);
        if (!userSelectedStudyMode) {
          const planMode = resolvePlanStudyMode(preferredPlan);
          if (planMode === 'STAC' || planMode === 'NSTAC') {
            setStudyMode(planMode);
          }
        }
        const planSemester = resolvePlanSemester(preferredPlan);
        if (planSemester) {
          setInitialSemester(planSemester);
        }
        setHasPlanLoaded(true);
      } else {
        const res = await apiFetch('/plan/last');
        if (res.ok) {
          const data = await res.json();
          setGeneratedPlan(data);
          setGenerationStats(null);
          if (!userSelectedStudyMode) {
            const planMode = resolvePlanStudyMode(data);
            if (planMode === 'STAC' || planMode === 'NSTAC') {
              setStudyMode(planMode);
            }
          }
          const planSemester = resolvePlanSemester(data);
          if (planSemester) {
            setInitialSemester(planSemester);
          }
          setHasPlanLoaded(true);
        } else if (res.status === 404) {
          setGeneratedPlan({});
          setGenerationStats(null);
          setInitialSemester(null);
        } else {
          throw new Error('Nie udało się pobrać ostatniego planu.');
        }
      }
    } catch (err) {
      console.error('Błąd pobierania planu:', err);
      setGeneratedPlan({});
      setGenerationStats(null);
      setInitialSemester(null);
      setHasPlanLoaded(false);
    } finally {
      setActiveView('viewPlan');
    }
  };

  const openGroupComposition = (source = 'menu') => {
    setGroupCompositionSource(source);
    setActiveView('groupComposition');
  };

  useEffect(() => {
    const loadSlots = async () => {
    try {
      const res = await apiFetch('/slots');
      if (!res.ok) throw new Error('Błąd pobierania slotów');
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error(err);
    }
    };
    loadSlots();
    }, []);

  useEffect(() => {
    let cancelled = false;

    const preloadPlan = async () => {
      try {
        const preferredPlan = await resolveSelectedPlanFromSavedList();
        if (preferredPlan && !cancelled) {
          setGeneratedPlan(preferredPlan);
          setGenerationStats(null);
          if (!userSelectedStudyMode) {
            const planMode = resolvePlanStudyMode(preferredPlan);
            if (planMode === 'STAC' || planMode === 'NSTAC') {
              setStudyMode(planMode);
            }
          }
          const planSemester = resolvePlanSemester(preferredPlan);
          if (planSemester) {
            setInitialSemester(planSemester);
          }
          setHasPlanLoaded(true);
          return;
        }

        const res = await apiFetch('/plan/last');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setGeneratedPlan(data);
          setGenerationStats(null);
          if (!userSelectedStudyMode) {
            const planMode = resolvePlanStudyMode(data);
            if (planMode === 'STAC' || planMode === 'NSTAC') {
              setStudyMode(planMode);
            }
          }
          const planSemester = resolvePlanSemester(data);
          if (planSemester) {
            setInitialSemester(planSemester);
          }
          setHasPlanLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Błąd wstępnego pobierania planu:', err);
        }
      }
    };

    if (user) {
      preloadPlan();
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

// Pass slots to Generator
    if (activeView === 'generator') {
  return <Generator user={user} onBack={handleBack} onGenerate={handlePlanGenerated} slots={slots} />;
    }


  const pageStyle = {
    fontSize: `${fontScale}%`,
    filter: `contrast(${contrast}%)`,
  }

  if (activeView === 'viewPlan') {
    return <ViewPlan
      user={user}
      plan={generatedPlan}
      hasPlanLoaded={hasPlanLoaded}
      stats={generationStats}
      onBack={handleBack}
      onClear={() => {
        setGeneratedPlan({});
        setGenerationStats(null);
      }}
      studyMode={studyMode}
      initialSemester={initialSemester}
    />;
  }

  if (activeView === 'groupComposition') {
    return (
      <div className="student-menu-page plan-viewer-page">
        <div className="student-plan-card">
          <div className="plan-header">
            <h2>Składy grup</h2>
            <button type="button" className="card-back-button" onClick={handleBack}>Powrót</button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
            <button
              type="button"
              className="card-back-button"
              onClick={() => {
                setStudyMode('STAC');
                setUserSelectedStudyMode(true);
              }}
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
              onClick={() => {
                setStudyMode('NSTAC');
                setUserSelectedStudyMode(true);
              }}
              style={{
                width: 'auto',
                ...(studyMode !== 'NSTAC' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' })
              }}
            >
              Niestacjonarne (NSTAC)
            </button>
          </div>

          <GroupCompositionViewer studyMode={studyMode} initialSemester={initialSemester} />
        </div>
      </div>
    );
  }

  // jeśli planista nie jest zalogowany, pokazujemy podgląd tylko z wygenerowanego planu
  if (!user && activeView === 'generator') {
    return <Generator user={user} onBack={handleBack} onGenerate={handlePlanGenerated} slots={slots} />
  }

  return (
    <div className="student-menu-page" style={pageStyle}>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu planisty</strong>
            <div className="student-menu-user-info">Jesteś zalogowany jako {user?.login || 'planista'}</div>
          </div>
        </div>

        <div className="student-menu-accessibility">
          <button type="button" onClick={() => setFontScale((value) => Math.min(value + 10, 160))}>A+</button>
          <button type="button" onClick={() => setFontScale((value) => Math.max(value - 10, 80))}>A-</button>
          <button type="button" onClick={() => setContrast((value) => Math.min(value + 15, 200))}>K+</button>
          <button type="button" onClick={() => setContrast((value) => Math.max(value - 15, 80))}>K-</button>
        </div>
      </div>

      <div className="student-menu-panel">
        <button type="button" onClick={handleViewPlan} title="Wyświetl wygenerowany plan zajęć">
          Wyświetl plan zajęć
        </button>
        <button type="button" onClick={() => setActiveView('generator')} title="Przejdź do menu generatora">
          Dodaj nowy plan zajęć
        </button>
        <button type="button" onClick={() => openGroupComposition('menu')} title="Wyświetl składy grup dla semestru">
          Składy grup
        </button>
        <button type="button" onClick={handleLogout}>
          Wyloguj się
        </button>
      </div>
    </div>
  )
}

export default Menu
