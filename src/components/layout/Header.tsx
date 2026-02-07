import { useLocation, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'

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
      </div>
    </header>
  )
}
