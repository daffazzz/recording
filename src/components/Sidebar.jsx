import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, ClipboardList, BarChart3, Home, ChevronRight, LogOut } from 'lucide-react'

export default function Sidebar({ currentPage, onNavigate }) {
    const { farms, selectedFarm, setSelectedFarm, unit, setUnit, sidebarOpen, setSidebarOpen } = useApp()
    const { user, signOut } = useAuth()

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'farms', label: 'Peternakan', icon: Home },
        { id: 'recording', label: 'Input Recording', icon: ClipboardList },
        { id: 'charts', label: 'Grafik & Analisis', icon: BarChart3 },
    ]

    const handleNav = (page) => {
        onNavigate(page)
        setSidebarOpen(false)
    }

    const handleSignOut = async () => {
        if (window.confirm('Yakin ingin keluar?')) {
            await signOut()
        }
    }

    return (
        <>
            {sidebarOpen && (
                <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
            )}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">🐔</div>
                        <div className="sidebar-logo-text">
                            <h1>FarmRecord</h1>
                            <span>Poultry Management</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-title">Menu Utama</div>
                    {navItems.map(item => {
                        const Icon = item.icon
                        return (
                            <button
                                key={item.id}
                                className={`sidebar-link ${currentPage === item.id ? 'active' : ''}`}
                                onClick={() => handleNav(item.id)}
                            >
                                <Icon />
                                {item.label}
                            </button>
                        )
                    })}

                    {farms.length > 0 && (
                        <>
                            <div className="sidebar-section-title">Peternakan</div>
                            {farms.map(farm => (
                                <button
                                    key={farm.id}
                                    className={`sidebar-link ${selectedFarm?.id === farm.id ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedFarm(farm)
                                        handleNav('recording')
                                    }}
                                >
                                    <Home />
                                    <span style={{ flex: 1, textAlign: 'left' }}>{farm.name}</span>
                                    <ChevronRight style={{ width: 14, height: 14, opacity: 0.5 }} />
                                </button>
                            ))}
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-section-title" style={{ marginTop: 0 }}>Satuan</div>
                    <div className="unit-toggle">
                        <button
                            className={unit === 'gram' ? 'active' : ''}
                            onClick={() => setUnit('gram')}
                        >
                            Gram
                        </button>
                        <button
                            className={unit === 'kg' ? 'active' : ''}
                            onClick={() => setUnit('kg')}
                        >
                            Kilogram
                        </button>
                    </div>

                    {/* User info + logout */}
                    {user && (
                        <div className="sidebar-user">
                            <div className="sidebar-user-info">
                                <div className="sidebar-user-avatar">
                                    {user.email?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="sidebar-user-email" title={user.email}>
                                    {user.email}
                                </div>
                            </div>
                            <button
                                className="btn btn-ghost btn-sm sidebar-logout"
                                onClick={handleSignOut}
                                title="Keluar"
                            >
                                <LogOut size={15} />
                                <span>Keluar</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    )
}
