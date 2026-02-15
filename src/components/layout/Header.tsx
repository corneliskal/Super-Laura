import { useLocation, useNavigate } from 'react-router-dom'
import { Home, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/constants'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const isHome = location.pathname === '/'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
      <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
        {/* Left side */}
        <div className="flex items-center gap-1">
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Terug naar home"
            >
              <Home size={20} />
            </button>
          )}
        </div>
        <h1 className="flex-1 text-center text-lg font-bold tracking-tight">
          {APP_NAME}
        </h1>
        <div className="flex items-center gap-1">
          {isHome && (
            <button
              onClick={() => navigate('/instellingen')}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Instellingen"
            >
              <Settings size={20} />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Uitloggen"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  )
}
