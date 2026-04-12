import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/ToastContainer'
import DashboardPage from './pages/DashboardPage'
import FarmsPage from './pages/FarmsPage'
import RecordingPage from './pages/RecordingPage'
import ChartsPage from './pages/ChartsPage'
import LoginPage from './pages/LoginPage'
import { LayoutDashboard, Home, ClipboardList, BarChart3, Menu } from 'lucide-react'

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const { sidebarOpen, setSidebarOpen } = useApp()
  const { user, authLoading } = useAuth()

  // Auth loading splash
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--bg-primary)',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, background: 'linear-gradient(135deg,#10b981,#059669)',
          borderRadius: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 26,
        }}>🐔</div>
        <div className="spinner" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Memuat...</p>
      </div>
    )
  }

  // Not logged in → show login page
  if (!user) return <LoginPage />

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage onNavigate={setCurrentPage} />
      case 'farms': return <FarmsPage onNavigate={setCurrentPage} />
      case 'recording': return <RecordingPage />
      case 'charts': return <ChartsPage />
      default: return <DashboardPage onNavigate={setCurrentPage} />
    }
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'farms', label: 'Kandang', icon: Home },
    { id: 'recording', label: 'Input', icon: ClipboardList },
    { id: 'charts', label: 'Grafik', icon: BarChart3 },
  ]

  const handleNav = (page) => {
    setCurrentPage(page)
    setSidebarOpen(false)
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={handleNav} />
      <main className="main-content">
        {renderPage()}
      </main>

      {/* Bottom navigation – mobile only */}
      <nav className="bottom-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`bottom-nav-item ${currentPage === id ? 'active' : ''}`}
            onClick={() => handleNav(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
        <button
          className="bottom-nav-menu"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu />
          <span>Menu</span>
        </button>
      </nav>

      <ToastContainer />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  )
}

export default App
