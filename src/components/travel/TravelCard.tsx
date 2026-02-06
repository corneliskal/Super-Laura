import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { formatDateShort } from '@/lib/dateUtils'
import type { TravelExpense } from '@/types/receipt'

interface TravelCardProps {
  expense: TravelExpense
  linkTo?: string
}

export function TravelCard({ expense, linkTo }: TravelCardProps) {
  const content = (
    <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
        <MapPin size={18} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">
          {expense.project_code}{expense.project_name ? ` — ${expense.project_name}` : ''}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {formatDateShort(expense.date)} · {expense.description}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900 text-sm">
          € {expense.total_reimbursement.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">{expense.kilometers} km</p>
      </div>
    </div>
  )

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>
  }

  return content
}
