import { useState } from 'react'
import './App.css'
import LoginScreen from './auth/LoginScreen.jsx'
import StudentMenu from './student/Menu.jsx'
import LecturerMenu from './lecturer/Menu.jsx'
import AdminMenu from './admin/Menu.jsx'
import PlanistMenu from './planist/Menu.jsx'
import GuestPlan from './public/GuestPlan.jsx'

function App() {
  const [showLogin, setShowLogin] = useState(false)
  const [user, setUser] = useState(null)
  const [showGuestPlan, setShowGuestPlan] = useState(false)

  const normalizeRole = (roleValue) => {
    const normalized = roleValue?.toString?.().toLowerCase?.().trim?.()
    return normalized || ''
  }

  const handleLogin = (userData) => {
    const rawRole = userData?.rola ?? userData?.role ?? ''
    let normalizedRole = normalizeRole(rawRole)
    const login = userData?.login?.toString?.().toLowerCase?.().trim?.() || ''

    if (!normalizedRole && login.includes('admin')) {
      normalizedRole = 'administrator'
    }
    if (!normalizedRole && login.includes('plan')) {
      normalizedRole = 'planista'
    }

    const normalizedUser = {
      ...userData,
      rola: normalizedRole,
      role: normalizedRole,
      login: userData?.login?.toString?.().trim?.() || login || '',
    }

    console.log('[App] handleLogin normalizedUser', normalizedUser)
    setUser(normalizedUser)
    setShowLogin(false)
  }

  const handleLogout = () => {
    setUser(null)
  }

  const ScheduleStyles = () => (
    <style>{`
      /* Poprawka wizualna dla bloków w planie zajęć.
         Zakładamy, że bloki używają jednej z poniższych klas. */
      .schedule-item, .plan-block, .schedule-entry {
        padding: 6px 8px; /* Dodaje wewnętrzny odstęp (góra/dół i lewo/prawo) */
        box-sizing: border-box; /* Zapobiega "rozpychaniu" layoutu przez padding */
        height: auto; /* Pozwala na dopasowanie wysokości do treści */
      }
    `}</style>
  );

  if (user) {
    const userRole = normalizeRole(user.rola ?? user.role)
    const userLogin = user.login?.toString?.().toLowerCase?.().trim?.() || ''

    const roleToMenuMap = {
      student: StudentMenu,
      wykladowca: LecturerMenu,
      wykładowca: LecturerMenu,
      planista: PlanistMenu,
      admin: AdminMenu,
      administrator: AdminMenu,
    };

    const MenuComponent = roleToMenuMap[userRole] || (userRole.includes('admin') ? AdminMenu : null) || (userLogin.includes('admin') ? AdminMenu : null)

    if (MenuComponent) {
      return (
        <>
          <ScheduleStyles />
          <MenuComponent user={user} onLogout={handleLogout} />
        </>
      );
    }
    
    // Fallback dla zalogowanego użytkownika z nierozpoznaną rolą.
    return (
      <div className="main">
        <ScheduleStyles />
        <h1>Zalogowano jako {user.login}</h1>
        <p>
          Twoja rola "{user.rola}" nie jest obecnie obsługiwana. Skontaktuj się z
          administratorem systemu.
        </p>
        <button type="button" onClick={handleLogout}>
          Wyloguj się
        </button>
      </div>
    )
  }

  if (showGuestPlan) {
    return (
      <>
        <ScheduleStyles />
        <GuestPlan onBack={() => setShowGuestPlan(false)} />
      </>
    );
  }

  if (showLogin) {
    return <LoginScreen
      onBack={() => setShowLogin(false)}
      onLogin={handleLogin}
    />
  }

  return (
    <div className="main">
      <h1>Aplikacja do układania planów zajęć</h1>
      <button type="button" onClick={() => setShowGuestPlan(true)} title="Wyświetl plany zajęć">
        Zobacz podgląd planu
      </button>
      <button type="button" onClick={() => setShowLogin(true)} title="Zaloguj się do aplikacji">
        Przejdź do logowania
      </button>
    </div>
  )
}

export default App
