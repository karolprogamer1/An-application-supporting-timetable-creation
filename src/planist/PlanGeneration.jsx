import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api';
import PlanViewer from './PlanViewer.jsx';
import { getGenerationPlanCollections } from './planGenerationUtils.mjs';
import '../App.css';

function PlanGeneration({ onBack }) {
    const [options, setOptions] = useState({ semesterOptions: [], lecturerOptions: [], roomOptions: [], subjectOptions: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedSemesters, setSelectedSemesters] = useState([]);
    const [planDescription, setPlanDescription] = useState('');
    const [generationResult, setGenerationResult] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState('plan');

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                setLoading(true);
                const res = await apiFetch('/planista/options');
                if (!res.ok) {
                    throw new Error('Nie udało się załadować opcji generatora.');
                }
                const data = await res.json();
                setOptions(data);
            } catch (err) {
                setError(err.message || 'Nie udało się załadować opcji generatora.');
            } finally {
                setLoading(false);
            }
        };

        fetchOptions();
    }, []);

    const handleGenerate = async () => {
        if (selectedSemesters.length === 0) {
            setError('Wybierz co najmniej jeden semestr do zaplanowania.');
            return;
        }

        setIsGenerating(true);
        setError('');
        setGenerationResult(null);

        try {
            const res = await apiFetch('/planista/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedSemesters: selectedSemesters.map((item) => item.value),
                    opis: planDescription,
                    algorithm: 'heuristic',
                    maxTimeSeconds: 8,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Wystąpił błąd podczas generowania planu.');
            }
            setGenerationResult(data);
            setActiveTab('plan');
        } catch (err) {
            setError(err.message || 'Wystąpił błąd podczas generowania planu.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSemesterChange = (event) => {
        const selectedValues = Array.from(event.target.selectedOptions, (option) => option.value);
        const selected = options.semesterOptions.filter((opt) => selectedValues.includes(opt.value));
        setSelectedSemesters(selected);
    };

    const { allScheduled, allUnscheduled, isResultEmpty } = useMemo(
        () => getGenerationPlanCollections(generationResult),
        [generationResult],
    );

    return (
        <div className="student-menu-page plan-viewer-page">
            <div className="student-plan-card">
                <div className="plan-header">
                    <h2>Generator planu zajęć</h2>
                    <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
                </div>

                {error && <p className="error-message">{error}</p>}

                <div className="admin-student-form">
                    <label>
                        Opis planu (opcjonalnie)
                        <input
                            type="text"
                            value={planDescription}
                            onChange={(event) => setPlanDescription(event.target.value)}
                            placeholder="np. Plan na semestr zimowy 2026/2027"
                            disabled={isGenerating}
                        />
                    </label>

                    <label>
                        Wybierz semestry do zaplanowania
                        {loading ? (
                            <p>Ładowanie semestrów...</p>
                        ) : (
                            <select
                                multiple
                                value={selectedSemesters.map((item) => item.value)}
                                onChange={handleSemesterChange}
                                style={{ height: '200px' }}
                                disabled={isGenerating}
                            >
                                {options.semesterOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        )}
                    </label>

                    <div className="admin-form-actions">
                        <button type="button" onClick={handleGenerate} disabled={isGenerating || loading || selectedSemesters.length === 0}>
                            {isGenerating ? 'Generowanie...' : 'Generuj plan'}
                        </button>
                    </div>
                </div>

                {isGenerating && <p>Trwa generowanie planu, to może potrwać kilka minut...</p>}

                {generationResult && (
                    <div className="generation-results">
                        <h3>Wyniki generowania</h3>

                        {generationResult.metadata && (
                            <div className="plan-metadata" style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', border: '1px solid #ddd' }}>
                                <p><strong>ID planu:</strong> {generationResult.metadata.id_plan}</p>
                                <p><strong>Opis:</strong> {generationResult.metadata.opis || 'Brak'}</p>
                                <p><strong>Data utworzenia:</strong> {new Date(generationResult.metadata.data_utworzenia).toLocaleString('pl-PL')}</p>
                            </div>
                        )}

                        {isResultEmpty ? (
                            <div className="empty-state" style={{ marginTop: '1rem' }}>
                                <p>Generator nie umieścił żadnych zajęć w planie.</p>
                                <p>Sprawdź konfigurację semestrów, dostępność sal i wykładowców.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                                    <button type="button" className="card-back-button" onClick={() => setActiveTab('plan')} style={{ width: 'auto', ...(activeTab !== 'plan' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' }) }}>Zaplanowane ({allScheduled.length})</button>
                                    <button type="button" className="card-back-button" onClick={() => setActiveTab('unscheduled')} style={{ width: 'auto', ...(activeTab !== 'unscheduled' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' }) }}>Niezaplanowane ({allUnscheduled.length})</button>
                                    {generationResult.statistics && (
                                        <button type="button" className="card-back-button" onClick={() => setActiveTab('stats')} style={{ width: 'auto', ...(activeTab !== 'stats' && { background: '#f0f0f0', color: '#333', boxShadow: 'none' }) }}>Statystyki</button>
                                    )}
                                </div>

                                {activeTab === 'plan' && (allScheduled.length > 0 ? <PlanViewer plansData={generationResult} /> : <p>Brak zaplanowanych zajęć.</p>)}

                                {activeTab === 'unscheduled' && (
                                    <div className="unscheduled-list">
                                        {allUnscheduled.length > 0 ? (
                                            <ul className="groups-list">
                                                {allUnscheduled.map((item) => (
                                                    <li key={item.id || `${item.name}-${item.group}`} className="group-item">
                                                        <strong>{item.name} ({item.type})</strong>
                                                        <span>Grupa: {item.group}, Wykładowca: {item.lecturer}</span>
                                                        <span>Powód: {item.reason || 'Brak dostępnych terminów lub sal.'}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p>Wszystkie zajęcia zostały pomyślnie zaplanowane.</p>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'stats' && generationResult.statistics && (
                                    <div className="stats-container">
                                        <p><strong>Liczba zaplanowanych zajęć:</strong> {generationResult.statistics.scheduledCount}</p>
                                        <p><strong>Liczba niezaplanowanych zajęć:</strong> {generationResult.statistics.unscheduledCount}</p>
                                        {generationResult.statistics.totalCost != null && <p><strong>Całkowity koszt:</strong> {generationResult.statistics.totalCost?.toFixed(2)}</p>}
                                        <p><strong>Czas generowania:</strong> {(generationResult.statistics.generationTimeMs / 1000).toFixed(2)} s</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlanGeneration;
