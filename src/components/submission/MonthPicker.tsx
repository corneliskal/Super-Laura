import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DUTCH_MONTHS } from '@/types/receipt'

interface MonthPickerProps {
  month: number
  year: number
  onChange: (month: number, year: number) => void
}

export function MonthPicker({ month, year, onChange }: MonthPickerProps) {
  const goBack = () => {
    if (month === 1) {
      onChange(12, year - 1)
    } else {
      onChange(month - 1, year)
    }
  }

  const goForward = () => {
    if (month === 12) {
      onChange(1, year + 1)
    } else {
      onChange(month + 1, year)
    }
  }

  const isCurrentMonth =
    month === new Date().getMonth() + 1 && year === new Date().getFullYear()

  return (
    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
      <button
        onClick={goBack}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Vorige maand"
      >
        <ChevronLeft size={20} className="text-gray-600" />
      </button>

      <div className="text-center">
        <p className="font-bold text-gray-900">
          {DUTCH_MONTHS[month - 1]} {year}
        </p>
        {isCurrentMonth && (
          <p className="text-xs text-primary-600 font-medium">Huidige maand</p>
        )}
      </div>

      <button
        onClick={goForward}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Volgende maand"
      >
        <ChevronRight size={20} className="text-gray-600" />
      </button>
    </div>
  )
}
