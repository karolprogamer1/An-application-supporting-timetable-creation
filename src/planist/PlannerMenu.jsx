import { useState } from 'react';
import '../App.css';
import PlanGeneration from './PlanGeneration.jsx';
import BrowsePlans from './BrowsePlans.jsx';
import ViewLastPlan from './ViewLastPlan.jsx';

function PlannerMenu({ user, onLogout }) {
    const [activeView, setActiveView] = useState(null);
    const [fontScale, setFontScale] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [formStatus, setFormStatus] = useState({ type: '', message: '' });

    const handleBack = () => {
        setActiveView(null);
    };

    const handleLogout = () => {
        if (typeof onLogout === 'function') {
            onLogout();
            return;
        }
        window.location.reload();
    };

    const pageStyle = {
        fontSize: `${fontScale}%`,
        filter: `contrast(${contrast}%)`,
    };

    const renderHeader = () => (
        <div className="student-menu-header">
            <div className="student-menu-user">
                <div>
                    <strong>Menu Planisty</strong>
                    <div className="student-menu-user-info">Jesteś zalogowany jako {user?.login || user?.rola || 'planista'}</div>
                </div>
            </div>
            <div className="student-menu-accessibility">
                <button type="button" onClick={() => setFontScale((prev) => Math.min(prev + 10, 160))}>A+</button>
                <button type="button" onClick={() => setFontScale((prev) => Math.max(prev - 10, 80))}>A-</button>
                <button type="button" onClick={() => setContrast((prev) => Math.min(prev + 15, 200))}>K+</button>
                <button type="button" onClick={() => setContrast((prev) => Math.max(prev - 15, 80))}>K-</button>
            </div>
        </div>
    );

    const renderContent = () => {
        if (activeView === 'generatePlan') return <PlanGeneration onBack={handleBack} />;
        if (activeView === 'browsePlans') return <BrowsePlans onBack={handleBack} />;
        if (activeView === 'viewLastPlan') return <ViewLastPlan onBack={handleBack} />;

        // Domyślny widok: Główne menu
        return (
            <>
                {renderHeader()}
                <div className="student-menu-panel">
                    <button type="button" onClick={() => setActiveView('generatePlan')}>Generuj plan</button>
                    <button type="button" onClick={() => setActiveView('viewLastPlan')}>Wyświetl ostatni plan</button>
                    <button type="button" onClick={() => setActiveView('browsePlans')}>Przeglądaj plany</button>
                    <button type="button" onClick={handleLogout} className="logout-button" style={{ background: '#4a5f72' }}>Wyloguj</button>
                </div>
            </>
        );
    };

    return (
        <div className="student-menu-page" style={pageStyle}>
            <div className="main">
                {formStatus.message && <div className={`form-notice ${formStatus.type === 'error' ? 'form-error' : 'form-success'}`}>{formStatus.message}</div>}
                {renderContent()}
            </div>
        </div>
    );
}

export default PlannerMenu;