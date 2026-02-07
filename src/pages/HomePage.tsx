import { Link } from 'react-router-dom'
import { Receipt, Car } from 'lucide-react'

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
]

export function HomePage() {
  return (
    <div className="p-4 space-y-6">
      {/* Logo */}
      <div className="text-center pt-4 pb-2">
        <img
          src="/logo.png"
          alt="Super-Laura"
          className="w-32 h-32 mx-auto drop-shadow-lg"
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
    </div>
  )
}
