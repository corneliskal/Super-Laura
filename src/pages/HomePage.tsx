import { Link } from 'react-router-dom'
import { Receipt, Car, FileSpreadsheet, CreditCard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BrandLogoStacked } from '@/components/BrandLogo'

const tiles = [
  {
    to: '/bonnetjes',
    label: 'Bonnetjes',
    description: "Foto's van bonnen & facturen",
    icon: Receipt,
    iconColor: 'text-uf-teal',
    iconBg: 'bg-primary-50',
  },
  {
    to: '/reiskosten',
    label: 'Reiskosten',
    description: 'Reisdeclaraties & km-vergoeding',
    icon: Car,
    iconColor: 'text-uf-teal',
    iconBg: 'bg-primary-50',
  },
  {
    to: '/kaartbetalingen',
    label: 'Kaartbetalingen',
    description: 'Bonnetjes betalingen De Unie kaart',
    icon: CreditCard,
    iconColor: 'text-uf-teal',
    iconBg: 'bg-primary-50',
  },
  {
    to: '/management-fee',
    label: 'Management Fee',
    description: 'Maandelijkse factuur versturen',
    icon: FileSpreadsheet,
    iconColor: 'text-uf-amber',
    iconBg: 'bg-amber-50',
  },
]

export function HomePage() {
  const { user } = useAuth()

  return (
    <div className="p-4 space-y-6">
      {/* Brand logo */}
      <div className="pt-4 pb-2">
        <BrandLogoStacked iconSize={48} />
      </div>

      {/* Tiles */}
      <div className="grid grid-cols-1 gap-4">
        {tiles.map((tile) => (
          <Link
            key={tile.to}
            to={tile.to}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-md active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 ${tile.iconBg} rounded-2xl flex items-center justify-center`}>
                <tile.icon size={28} className={tile.iconColor} strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-uf-slate">{tile.label}</h3>
                <p className="text-uf-slate-light text-sm mt-0.5">{tile.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Subtle email + Corkapps badge */}
      <div className="flex flex-col items-center gap-2 pt-2">
        {user?.email && (
          <p className="text-xs text-uf-warm-gray">
            {user.email}
          </p>
        )}
        <img src="/corkapps-logo.svg" alt="Corkapps" className="h-4 opacity-40 mx-auto block" />
      </div>
    </div>
  )
}
