import { NavLink } from 'react-router-dom'
import { Home, PlusCircle, FileText, Send } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/bonnetjes', label: 'Bonnetjes', icon: FileText },
  { to: '/nieuw', label: 'Nieuw', icon: PlusCircle },
  { to: '/indienen', label: 'Indienen', icon: Send },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[64px] ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
