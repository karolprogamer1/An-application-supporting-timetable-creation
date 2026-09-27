import { useState, useEffect } from 'react';
import PlanViewer from './PlanViewer.jsx';
import { apiFetch } from '../api';
import '../App.css';

function BrowsePlans({ onBack }) {
    const [planList, setPlanList] = useState([]);
    const [selectedPlanValue, setSelectedPlanValue] = useState('');
    const [planData, setPlanData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch the list of all available plans on component mount
    useEffect(() => {
        const fetchPlanList = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await apiFetch('/plan/list');
                setPlanList(data);
                if (data.length > 0) {
                    // Automatically select the first (most recent) plan
                    setSelectedPlanValue(data[0].value);
                } else {
                    setLoading(false);
                }
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };
        fetchPlanList();
    }, []);

    // Fetch the specific plan data when a plan is selected from the dropdown
    useEffect(() => {
        if (!selectedPlanValue) {
            setPlanData(null);
            return;
        }

        const [planId] = selectedPlanValue.split('|');

        const fetchPlanData = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await apiFetch(`/plan/structured/${planId}`);
                
                // The PlanViewer component expects a payload with a `results` key.
                setPlanData({ results: data });
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPlanData();
    }, [selectedPlanValue]);

    return (
        <div className="student-menu-page plan-viewer-page">
            <div className="student-plan-card">
                <div className="plan-header">
                    <h2>Przeglądaj Zapisane Plany</h2>
                    <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
                </div>

                {error && <p className="error-message">{error}</p>}

                {planList.length > 0 && (
                    <div className="form-row" style={{ alignItems: 'center', marginTop: '1rem', gap: '12px', display: 'flex', flexWrap: 'wrap' }}>
                        <label htmlFor="plan-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>Wybierz plan do wyświetlenia:</label>
                        <select id="plan-select" value={selectedPlanValue} onChange={(e) => setSelectedPlanValue(e.target.value)} disabled={loading}>
                            {planList.map((plan) => (
                                <option key={plan.value} value={plan.value}>{plan.label}</option>
                            ))}
                        </select>
                    </div>
                )}

                {loading && !error && <p>Ładowanie danych...</p>}
                {!loading && !error && planData && <PlanViewer plansData={planData} />}
                {!loading && planList.length === 0 && !error && <p>Nie znaleziono żadnych zapisanych planów.</p>}
            </div>
        </div>
    );
}

export default BrowsePlans;