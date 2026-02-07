import { useLocation, useNavigate } from 'react-router-dom'
import { Home, LogOut } from 'lucide-react'
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
        {!isHome && (
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-2 mr-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Terug naar home"
          >
            <Home size={20} />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-tight">
          {APP_NAME}
        </h1>
        <div className="ml-auto">
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
