import { useState } from 'react'
import '../App.css'
import ViewPlan from './view_plan.jsx'
import ViewGroups from './view_groups.jsx'
import ViewPersonalData from './view_personal_data.jsx'
import ViewSettings from './view_settings.jsx'

function Menu({ user, onLogout }) {
  const [activeView, setActiveView] = useState(null)
  const [fontScale, setFontScale] = useState(100)
  const [contrast, setContrast] = useState(100)

  const handleBack = () => setActiveView(null)
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

  if (activeView === 'plan') {
    return <ViewPlan user={user} onBack={handleBack} />
  }

  if (activeView === 'groups') {
    return <ViewGroups user={user} onBack={handleBack} />
  }

  if (activeView === 'personal') {
    return <ViewPersonalData user={user} onBack={handleBack} />
  }

  if (activeView === 'settings') {
    return (
      <ViewSettings
        fontScale={fontScale}
        contrast={contrast}
        onFontScaleChange={setFontScale}
        onContrastChange={setContrast}
        onBack={handleBack}
      />
    )
  }

  return (
    <div className="student-menu-page" style={pageStyle}>
      <div className="student-menu-header">
        <div className="student-menu-user">
          <div>
            <strong>Menu studenta</strong>
            <div className="student-menu-user-info">Jesteś zalogowany jako {user?.login || 'student'}</div>
          </div>
          
        </div>

        <div className="student-menu-accessibility">
          <button type="button" onClick={() => setFontScale((value) => Math.min(value + 10, 160))}>
            A+
          </button>
          <button type="button" onClick={() => setFontScale((value) => Math.max(value - 10, 80))}>
            A-
          </button>
          <button type="button" onClick={() => setContrast((value) => Math.min(value + 15, 200))}>
            K+
          </button>
          <button type="button" onClick={() => setContrast((value) => Math.max(value - 15, 80))}>
            K-
          </button>
        </div>
      </div>

      <div className="student-menu-panel">
        
        <button type="button" onClick={() => setActiveView('groups')}>
          Wyświetl plan zajęć
        </button>
        <button type="button" onClick={() => setActiveView('personal')}>
          Wyświetl dane o sobie
        </button>
        
        <button type="button" onClick={handleLogout}>
          Wyloguj się
        </button>
      </div>
    </div>
  )
}

export default Menu