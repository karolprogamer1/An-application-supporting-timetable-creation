import { useState, useEffect } from 'react';
import PlanViewer from './PlanViewer.jsx';
import { apiFetch } from '../api';
import '../App.css';

function ViewLastPlan({ onBack }) {
    const [planData, setPlanData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLastPlan = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await apiFetch('/plan/last');
                
                if (!data || !data.results || Object.keys(data.results).length === 0) {
                    setPlanData({ isEmpty: true });
                    setLoading(false);
                    return;
                }

                const processedData = JSON.parse(JSON.stringify(data));
                const results = processedData.results;
                const keys = Object.keys(results);
                const polishWeekdaysOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
                const groups = {};

                keys.forEach(key => {
                    const [sem, spec, mode] = key.split('|');
                    const groupKey = `${sem}|${mode}`;
                    if (!groups[groupKey]) {
                        groups[groupKey] = { general: null, specs: [] };
                    }
                    if (spec === 'Ogólne') {
                        groups[groupKey].general = key;
                    } else {
                        groups[groupKey].specs.push(key);
                    }
                });

                for (const groupKey in groups) {
                    const group = groups[groupKey];
                    if (group.general && group.specs.length > 0) {
                        const generalData = results[group.general];
                        if (!generalData) continue;

                        group.specs.forEach(specKey => {
                            const specData = results[specKey];
                            if (!specData) return;

                            const combinedPlan = [...specData.plan, ...generalData.plan];
                            specData.plan = Array.from(new Map(combinedPlan.map(item => [JSON.stringify(item), item])).values());

                            const combinedUnscheduled = [...(specData.unscheduled || []), ...(generalData.unscheduled || [])];
                            specData.unscheduled = Array.from(new Map(combinedUnscheduled.map(item => [item.id, item])).values());

                            const combinedActiveDays = new Set([...(specData.activeDays || []), ...(generalData.activeDays || [])]);
                            specData.activeDays = [...combinedActiveDays].sort((a, b) => polishWeekdaysOrder.indexOf(a) - polishWeekdaysOrder.indexOf(b));
                        });
                        
                        delete results[group.general];
                    }
                }

                setPlanData(processedData);

            } catch (err) {
                setError(err.message);
                setPlanData(null);
            } finally {
                setLoading(false);
            }
        };
        fetchLastPlan();
    }, []);

    return (
        <div className="student-menu-page plan-viewer-page">
            <div className="student-plan-card">
                <div className="plan-header">
                    <h2>Ostatnio Opublikowany Plan</h2>
                    <button type="button" className="card-back-button" onClick={onBack}>Powrót</button>
                </div>

                {loading && <p>Ładowanie planu...</p>}
                {error && <p className="error-message">{error}</p>}

                {!loading && !error && planData && (
                    planData.isEmpty 
                        ? <div className="empty-state"><p>Żaden plan zajęć nie został jeszcze opublikowany.</p></div>
                        : <PlanViewer plansData={planData} />
                )}
            </div>
        </div>
    );
}

export default ViewLastPlan;