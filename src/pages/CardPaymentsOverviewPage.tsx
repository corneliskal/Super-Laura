import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PlusCircle, Search } from 'lucide-react'
import { useCardPayments } from '@/hooks/useCardPayments'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS } from '@/types/receipt'

export function CardPaymentsOverviewPage() {
  const location = useLocation()
  const navState = location.state as { month?: number; year?: number } | null
  const { payments, fetchPayments, loading, error } = useCardPayments()
  const [month, setMonth] = useState(navState?.month || currentMonthYear().month)
  const [year, setYear] = useState(navState?.year || currentMonthYear().year)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchPayments(month, year)
  }, [fetchPayments, month, year])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
  }

  const filtered = payments.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      r.store_name?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    )
  })

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0)
  const monthName = DUTCH_MONTHS[month - 1]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Kaartbetalingen</h2>
        <Link
          to="/kaartbetalingen/nieuw"
          state={{ month, year }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
        >
          <PlusCircle size={16} />
          Nieuw
        </Link>
      </div>

      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Zoek op winkel of omschrijving..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          <div className="flex items-center justify-between text-sm text-gray-600 px-1">
            <span>{filtered.length} verstuurd in {monthName}</span>
            <span className="font-semibold text-gray-900">{formatEuro(totalAmount)}</span>
          </div>

          <div className="space-y-2">
            {filtered.map((payment) => (
              <ReceiptCard key={payment.id} receipt={payment} basePath="/kaartbetalingen" />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-4xl mb-3">💳</p>
          <p className="text-gray-500 font-medium">Geen kaartbetalingen</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery
              ? 'Probeer een andere zoekopdracht'
              : 'Voeg een bonnetje toe via de + knop'}
          </p>
        </div>
      )}
    </div>
  )
}
