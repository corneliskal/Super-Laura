import { Link } from 'react-router-dom'
import { Receipt, Car, FileSpreadsheet } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
// GEDEACTIVEERD: Superheld Avatar feature (geparkeerd)
// import { useSettings } from '@/hooks/useSettings'

const tiles = [
  {
    to: '/bonnetjes',
    label: 'Bonnetjes',
    description: 'Foto\'s van bonnen & facturen',
    icon: Receipt,
    gradient: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-400/30',
  },
  {
    to: '/reiskosten',
    label: 'Reiskosten',
    description: 'Reisdeclaraties & km-vergoeding',
    icon: Car,
    gradient: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-400/30',
  },
  {
    to: '/management-fee',
    label: 'Management Fee',
    description: 'Maandelijkse factuur versturen',
    icon: FileSpreadsheet,
    gradient: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-400/30',
  },
]

export function HomePage() {
  const { user } = useAuth()

  return (
    <div className="p-4 space-y-6">
      {/* Logo */}
      <div className="text-center pt-4 pb-2">
        <img
          src="/logo.png"
          alt="De Unie Form"
          className="h-32 mx-auto drop-shadow-lg object-contain"
        />
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className={`relative overflow-hidden bg-gradient-to-br ${tile.gradient} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all`}
          >
            {/* Background icon */}
            <tile.icon
              size={100}
              className="absolute -right-3 -bottom-3 opacity-10"
              strokeWidth={1}
            />
            {/* Content */}
            <div className="relative flex items-center gap-4">
              <div className={`w-14 h-14 ${tile.iconBg} rounded-2xl flex items-center justify-center`}>
                <tile.icon size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold">{tile.label}</h3>
                <p className="text-white/80 text-sm mt-0.5">{tile.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Subtle email display */}
      {user?.email && (
        <p className="text-center text-xs text-gray-400 pt-2">
          {user.email}
        </p>
      )}
    </div>
  )
}
