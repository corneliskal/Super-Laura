import { Link } from 'react-router-dom'
import { MapPin, ChevronRight, CheckCircle } from 'lucide-react'
import { formatDateShort, formatEuro } from '@/lib/dateUtils'
import type { TravelExpense } from '@/types/receipt'

interface TravelCardProps {
  expense: TravelExpense
}

export function TravelCard({ expense }: TravelCardProps) {
  return (
    <Link
      to={`/reiskosten/${expense.id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
        <MapPin size={18} className="text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-900 text-sm truncate">
            {expense.project_code}{expense.project_name ? ` — ${expense.project_name}` : ''}
          </p>
          {expense.is_submitted && (
            <CheckCircle size={14} className="text-green-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">
          {formatDateShort(expense.date)} · {expense.description}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-semibold text-gray-900 text-sm">
          {formatEuro(expense.total_reimbursement)}
        </p>
        <p className="text-xs text-gray-400">{expense.kilometers} km</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </Link>
  )
}
