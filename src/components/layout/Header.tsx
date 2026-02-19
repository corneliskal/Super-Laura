import { useLocation, useNavigate } from 'react-router-dom'
import { Home, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BrandLogoHorizontal } from '@/components/BrandLogo'

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
    <header className="sticky top-0 z-40 bg-gradient-to-r from-uf-teal to-uf-teal-dark text-white shadow-md">
      <div className="relative flex items-center h-14 px-4 max-w-lg mx-auto">
        {/* Left */}
        <div className="flex items-center gap-1">
          {!isHome ? (
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Terug naar home"
            >
              <Home size={20} />
            </button>
          ) : (
            <BrandLogoHorizontal />
          )}
        </div>

        {/* Center: logo on sub-pages */}
        {!isHome && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <BrandLogoHorizontal />
          </div>
        )}

        <div className="flex-1" />

        {/* Right */}
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
