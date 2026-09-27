import { useState } from 'react';
import ViewPlan from './view_plan';
import Availability from './Availability';
import ViewPersonalData from './view_personal_data';

function LecturerMenu({ user, onLogout }) {
  const [activeView, setActiveView] = useState(null);

  const handleBack = () => setActiveView(null);

  if (activeView === 'viewPlan') {
    return <ViewPlan user={user} onBack={handleBack} />;
  }

  if (activeView === 'availability') {
    return <Availability user={user} onBack={handleBack} />;
  }

  if (activeView === 'personalData') {
    return <ViewPersonalData user={user} onBack={handleBack} />;
  }

  return (
    <div className="student-menu-page">
      <div className="student-menu-header">
        <div>
          <strong>Menu wykładowcy</strong>
          <div>Jesteś zalogowany jako {user?.login || 'wykładowca'}</div>
        </div>
      </div>
      <div className="student-menu-panel">
        <button type="button" onClick={() => setActiveView('personalData')} title="Wyświetl swoje dane">
          Moje dane
        </button>
        <button type="button" onClick={() => setActiveView('viewPlan')} title="Wyświetl plan prowadzonych przez siebie zajęć">
          Wyświetl mój plan
        </button>
        <button type="button" onClick={() => setActiveView('availability')} title="Zgłoś swoją dostępność planiście poprzez zaznaczenie segmentów godzinowych">
          Zgłoś dostępność
        </button>
        <button type="button" onClick={onLogout}>
          Wyloguj się
        </button>
      </div>
    </div>
  );
}

export default LecturerMenu;