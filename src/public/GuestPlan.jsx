import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../api';
import PlanViewer from '../planist/PlanViewer.jsx';
import GroupCompositionViewer from '../planist/GroupCompositionViewer.jsx';
import '../App.css';
import {
    normalizeSpecializationValue,
    isGeneralSpecialization,
    normalizeStudyMode,
    getPlannerSemesters,
    planVariantMatchesSelectedSpecialization,
} from '../planist/planFilters.js';
import { collectGuestPlanFilters, filterGuestPlanData } from './guestPlanFilters.js';

function GuestPlan({ onBack }) {
    const [plansData, setPlansData] = useState(null);
    const [planList, setPlanList] = useState([]);
    const [selectedPlanValue, setSelectedPlanValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeView, setActiveView] = useState('plan');
    const [groupViewStudyMode, setGroupViewStudyMode] = useState('STAC');
    const [filterText, setFilterText] = useState('');
    const [specFilter, setSpecFilter] = useState('all');
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [studyModeFilter, setStudyModeFilter] = useState('all');
    const [lecturerFilter, setLecturerFilter] = useState('all');
    const [roomFilter, setRoomFilter] = useState('all');

    useEffect(() => {
        const fetchPlanList = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await apiFetch('/plan/list');
                if (!Array.isArray(data) || data.length === 0) {
                    setPlansData({ results: {}, metadata: null, isEmpty: true });
                    return;
                }

                setPlanList(data);
                setSelectedPlanValue(data[0].value);

            } catch (err) {
                setError(err.message);
                setPlansData({ results: {}, metadata: null, isEmpty: true });
            } finally {
                setLoading(false);
            }
        };
        fetchPlanList();
    }, []);

    useEffect(() => {
        if (!selectedPlanValue) return;

        const selectedPlan = planList.find((plan) => plan.value === selectedPlanValue);
        if (!selectedPlan) return;

        const loadSelectedPlan = async () => {
            setLoading(true);
            setError('');
            try {
                const query = new URLSearchParams({ planKey: selectedPlan.planKey });
                const data = await apiFetch(`/plan/structured/${selectedPlan.planId}?${query}`);
                setPlansData({
                    results: data,
                    metadata: {
                        data_utworzenia: selectedPlan.date,
                        opis: selectedPlan.label,
                    },
                });
            } catch (err) {
                setError(err.message);
                setPlansData(null);
            } finally {
                setLoading(false);
            }
        };

        loadSelectedPlan();
    }, [planList, selectedPlanValue]);

    const { availableSpecs, availableSemesters, availableStudyModes } = useMemo(() => {
        const semesters = new Set(['all']);
        const specs = new Set(['Ogólne']);
        const studyModes = new Set(['all']);
        const allSpecializations = [
            'CTS',
            'IOSI',
            'ISP',
            'CTS+ISP',
            'CTS+IOSI',
            'CTS+IOSI+ISP',
        ];

        planList.forEach((plan) => {
            const [sem, spec, mode] = String(plan.planKey || '').split('|');
            getPlannerSemesters(sem).forEach((value) => semesters.add(value));

            if (['5', '6', '8'].includes(sem)) {
                if (spec && spec !== 'Ogólne') {
                    spec.split('+').forEach((value) => specs.add(value.trim()));
                } else {
                    specs.add('Ogólne');
                }
            }

            const normalizedMode = normalizeStudyMode(mode || 'STAC');
            if (normalizedMode !== 'all') studyModes.add(normalizedMode);
        });

        allSpecializations.forEach((specialization) => specs.add(specialization));

        return {
            availableSpecs: [...specs].sort((a, b) => {
                if (a === 'Ogólne') return -1;
                if (b === 'Ogólne') return 1;
                return a.localeCompare(b, 'pl');
            }),
            availableSemesters: ['all', ...Array.from(semesters).filter((value) => value !== 'all').sort((a, b) => Number(a) - Number(b))],
            availableStudyModes: ['all', ...Array.from(studyModes).filter((value) => value !== 'all').sort()],
        };
    }, [planList]);

    const { availableLecturers, availableRooms } = useMemo(() => collectGuestPlanFilters(plansData), [plansData]);

    const filteredPlansData = useMemo(() => {
        if (!plansData) return null;

        return filterGuestPlanData(plansData, {
            filterText,
            specFilter,
            semesterFilter,
            studyModeFilter,
            lecturerFilter,
            roomFilter,
        });
    }, [plansData, filterText, specFilter, semesterFilter, studyModeFilter, lecturerFilter, roomFilter]);

    return (
        <div className="student-menu-page plan-viewer-page">
            <div className="student-plan-card">
                <div className="plan-header">
                    <h2>{activeView === 'group' ? 'Składy grup' : 'Podgląd planu zajęć'}</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" className="card-back-button" onClick={() => setActiveView('plan')}>Plan</button>
                        <button type="button" className="card-back-button" onClick={() => setActiveView('group')}>Składy grup</button>
                        <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
                    </div>
                </div>

                {loading && <p>Ładowanie planu...</p>}
                {error && <p className="error-message">{error}</p>}

                {!loading && !error && filteredPlansData && (
                    <>
                        {plansData.isEmpty ? (
                            <div className="empty-state">
                                <p>Żaden plan zajęć nie został jeszcze opublikowany.</p>
                                <p>Zapraszamy wkrótce!</p>
                            </div>
                        ) : (
                            <>
                                {plansData.metadata && (
                                    <div className="plan-metadata" style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', border: '1px solid #ddd' }}>
                                        <p><strong>Wyświetlany plan:</strong> {filteredPlansData.metadata.opis || 'Brak opisu'}</p>
                                        <p><strong>Data wygenerowania:</strong> {new Date(filteredPlansData.metadata.data_utworzenia).toLocaleString('pl-PL')}</p>
                                    </div>
                                )}
                                {activeView === 'group' ? (
                                    <>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                            <button
                                                type="button"
                                                className="card-back-button"
                                                onClick={() => setGroupViewStudyMode('STAC')}
                                                style={{
                                                    width: 'auto',
                                                    ...(groupViewStudyMode !== 'STAC' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' })
                                                }}
                                            >
                                                Stacjonarne (STAC)
                                            </button>
                                            <button
                                                type="button"
                                                className="card-back-button"
                                                onClick={() => setGroupViewStudyMode('NSTAC')}
                                                style={{ width: 'auto', ...(groupViewStudyMode !== 'NSTAC' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' }) }}
                                            >
                                                Niestacjonarne (NSTAC)
                                            </button>
                                        </div>
                                        <GroupCompositionViewer studyMode={groupViewStudyMode} />
                                    </>
                                ) : (
                                    <>
                                        <div className="plan-filter-container" style={{ display: 'flex', gap: '1rem', alignItems: 'center', margin: '1rem 0', paddingBottom: '1rem', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
                                            <input
                                                type="text"
                                                placeholder="Filtruj zajęcia (np. nazwa, prowadzący, sala, typ, grupa)..."
                                                value={filterText}
                                                onChange={(e) => setFilterText(e.target.value)}
                                                style={{ flex: '1 1 220px', padding: '0.5rem', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label htmlFor="semester-filter" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>Semestr:</label>
                                                <select
                                                    id="semester-filter"
                                                    value={semesterFilter}
                                                    onChange={(e) => {
                                                        const selectedSemester = e.target.value;
                                                        setSemesterFilter(selectedSemester);
                                                        if (selectedSemester !== 'all') {
                                                            const matchingPlan = planList.find((plan) => {
                                                                const [semester] = String(plan.planKey || '').split('|');
                                                                return getPlannerSemesters(semester).includes(selectedSemester);
                                                            });
                                                            if (matchingPlan) setSelectedPlanValue(matchingPlan.value);
                                                        }
                                                    }}
                                                    style={{ padding: '0.5rem', boxSizing: 'border-box' }}
                                                >
                                                    {availableSemesters.map((semester) => (
                                                        <option key={semester} value={semester}>{semester === 'all' ? 'Wszystkie' : `Semestr ${semester}`}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label htmlFor="study-mode-filter" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>Tryb:</label>
                                                <select
                                                    id="study-mode-filter"
                                                    value={studyModeFilter}
                                                    onChange={(e) => setStudyModeFilter(e.target.value)}
                                                    style={{ padding: '0.5rem', boxSizing: 'border-box' }}
                                                >
                                                    {availableStudyModes.map((mode) => (
                                                        <option key={mode} value={mode}>{mode === 'all' ? 'Wszystkie' : mode}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {availableSpecs.length > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <label htmlFor="spec-filter" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>Specjalność:</label>
                                                    <select
                                                        id="spec-filter"
                                                        value={specFilter}
                                                        onChange={(e) => setSpecFilter(e.target.value)}
                                                        style={{ padding: '0.5rem', boxSizing: 'border-box' }}
                                                    >
                                                        <option value="all">Wszystkie</option>
                                                        {availableSpecs.map((spec) => (
                                                            <option key={spec} value={spec}>{spec}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label htmlFor="lecturer-filter" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>Wykładowca:</label>
                                                <select
                                                    id="lecturer-filter"
                                                    value={lecturerFilter}
                                                    onChange={(e) => setLecturerFilter(e.target.value)}
                                                    style={{ padding: '0.5rem', boxSizing: 'border-box' }}
                                                >
                                                    {availableLecturers.map((lecturer) => (
                                                        <option key={lecturer} value={lecturer}>{lecturer === 'all' ? 'Wszyscy' : lecturer}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label htmlFor="room-filter" style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>Sala:</label>
                                                <select
                                                    id="room-filter"
                                                    value={roomFilter}
                                                    onChange={(e) => setRoomFilter(e.target.value)}
                                                    style={{ padding: '0.5rem', boxSizing: 'border-box' }}
                                                >
                                                    {availableRooms.map((room) => (
                                                        <option key={room} value={room}>{room === 'all' ? 'Wszystkie' : room}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <PlanViewer plansData={filteredPlansData} />
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default GuestPlan;