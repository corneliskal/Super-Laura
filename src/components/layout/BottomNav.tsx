import { NavLink, useLocation } from 'react-router-dom'
import { Home, FileText, Car, FileSpreadsheet } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/bonnetjes', label: 'Bonnetjes', icon: FileText, prefix: '/bonnetjes' },
  { to: '/reiskosten', label: 'Reiskosten', icon: Car, prefix: '/reiskosten' },
  { to: '/management-fee', label: 'Factuur', icon: FileSpreadsheet, prefix: '/management-fee' },
]

export function BottomNav() {
  const location = useLocation()

  // Also highlight Bonnetjes for /nieuw and /indienen (legacy receipt routes)
  const isReceiptRoute = location.pathname === '/nieuw' || location.pathname === '/indienen'

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : item.prefix
              ? location.pathname.startsWith(item.prefix) || (item.prefix === '/bonnetjes' && isReceiptRoute)
              : false

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[64px] ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <item.icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-xs ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
