import { useEffect, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { useReceipts } from '@/hooks/useReceipts'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { CATEGORIES } from '@/types/receipt'

export function ReceiptsOverviewPage() {
  const { receipts, fetchReceipts, loading } = useReceipts()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchReceipts(month, year)
  }, [fetchReceipts, month, year])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
  }

  // Filter receipts
  const filtered = receipts.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        r.store_name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    if (filterCategory && r.category !== filterCategory) return false
    return true
  })

  const totalAmount = filtered.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Bonnetjes</h2>

      {/* Month picker */}
      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Search + filter */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Zoek op winkel of omschrijving..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-colors ${
              showFilters || filterCategory
                ? 'bg-primary-50 border-primary-300 text-primary-600'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCategory('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !filterCategory
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Alles
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setFilterCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterCategory === cat.name
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 px-1">
        <span>{filtered.length} bonnetje{filtered.length !== 1 ? 's' : ''}</span>
        <span className="font-semibold text-gray-900">{formatEuro(totalAmount)}</span>
      </div>

      {/* Receipt list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
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
        <div className="space-y-2">
          {filtered.map((receipt) => (
            <ReceiptCard key={receipt.id} receipt={receipt} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-4xl mb-3">🧾</p>
          <p className="text-gray-500 font-medium">Geen bonnetjes gevonden</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery || filterCategory
              ? 'Probeer een andere zoekopdracht of filter'
              : 'Voeg een bonnetje toe via het + icoon'}
          </p>
        </div>
      )}
    </div>
  )
}
