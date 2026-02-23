import { ChevronRight, CheckCircle, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Receipt } from '@/types/receipt'
import { CATEGORIES } from '@/types/receipt'
import { formatDateShort, formatEuro } from '@/lib/dateUtils'

interface ReceiptCardProps {
  receipt: Receipt
  basePath?: string
}

export function ReceiptCard({ receipt, basePath = '/bonnetjes' }: ReceiptCardProps) {
  const category = CATEGORIES.find((c) => c.name === receipt.category)

  return (
    <Link
      to={`${basePath}/${receipt.id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      {/* Category icon */}
      <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-lg shrink-0">
        {category?.icon || '📦'}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-900 truncate text-sm">
            {receipt.store_name || 'Onbekende winkel'}
          </p>
          {receipt.file_type === 'pdf' && (
            <FileText size={14} className="text-red-400 shrink-0" />
          )}
          {receipt.is_submitted && (
            <CheckCircle size={14} className="text-green-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {formatDateShort(receipt.receipt_date)}
          {receipt.description && ` · ${receipt.description}`}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-bold text-gray-900 text-sm">{formatEuro(receipt.amount)}</p>
      </div>

      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </Link>
  )
}
