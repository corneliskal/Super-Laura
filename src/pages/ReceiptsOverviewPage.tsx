import { useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, SlidersHorizontal, PlusCircle, Send, Loader2, CheckCircle, Images, X } from 'lucide-react'
import { useReceipts } from '@/hooks/useReceipts'
import { useBatchUpload } from '@/hooks/useBatchUpload'
import { useToast } from '@/components/ui/Toast'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { CATEGORIES, DUTCH_MONTHS, type Receipt } from '@/types/receipt'
import { SUBMIT_RECEIPTS_URL } from '@/lib/constants'
import { getAuthToken } from '@/lib/firebase'
import { useSettings } from '@/hooks/useSettings'
import { SettingsModal } from '@/components/settings/SettingsModal'

export function ReceiptsOverviewPage() {
  const location = useLocation()
  const navState = location.state as { month?: number; year?: number } | null
  const { receipts, fetchReceipts, getSubmittedReceiptsByMonth, loading, error } = useReceipts()
  const { settings, loadSettings } = useSettings()
  const { showToast } = useToast()
  const [month, setMonth] = useState(navState?.month || currentMonthYear().month)
  const [year, setYear] = useState(navState?.year || currentMonthYear().year)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittedReceipts, setSubmittedReceipts] = useState<Receipt[]>([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const batchInputRef = useRef<HTMLInputElement>(null)
  const batch = useBatchUpload()

  useEffect(() => {
    fetchReceipts(month, year)
    getSubmittedReceiptsByMonth(month, year).then(setSubmittedReceipts).catch(() => {})
  }, [fetchReceipts, getSubmittedReceiptsByMonth, month, year])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
  }

  const handleSubmit = async () => {
    // Check if settings are complete
    const hasSettings = settings.employeeName?.trim() && settings.bankAccount?.trim() && settings.recipientEmail?.trim()

    if (!hasSettings) {
      setShowSettingsModal(true)
      return
    }

    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const response = await fetch(SUBMIT_RECEIPTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ month, year, recipientEmail: settings.recipientEmail, employeeName: settings.employeeName, bankAccount: settings.bankAccount }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verzenden mislukt')
      }

      showToast('success', `${result.message} ✉️`)
      // Refresh both lists
      fetchReceipts(month, year)
      getSubmittedReceiptsByMonth(month, year).then(setSubmittedReceipts).catch(() => {})
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', err instanceof Error ? err.message : 'Verzenden mislukt. Probeer opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSettingsSaved = async () => {
    setShowSettingsModal(false)
    // Reload settings and try submit again
    await loadSettings()
    handleSubmit()
  }

  const handleBatchFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // On mobile, file.type can be empty - accept all files from image picker
    const allFiles = Array.from(files)
    e.target.value = ''

    if (allFiles.length === 0) return

    batch.startBatch(allFiles, month, year, () => {
      fetchReceipts(month, year)
    })
  }

  // Only show non-submitted in the main list
  const pendingReceipts = receipts.filter((r) => !r.is_submitted)

  // Filter pending receipts
  const filtered = pendingReceipts.filter((r) => {
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
  const submittedTotal = submittedReceipts.reduce((sum, r) => sum + r.amount, 0)
  const monthName = DUTCH_MONTHS[month - 1]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Bonnetjes</h2>
        <div className="flex items-center gap-2">
          <input
            ref={batchInputRef}
            type="file"
            accept="image/*,image/heic,image/heif"
            multiple
            onChange={handleBatchFiles}
            className="hidden"
          />
          <button
            onClick={() => batchInputRef.current?.click()}
            disabled={batch.active}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Images size={16} />
            Meerdere
          </button>
          <Link
            to="/nieuw"
            state={{ month, year }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
          >
            <PlusCircle size={16} />
            Nieuw
          </Link>
        </div>
      </div>

      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Batch upload progress */}
      {batch.items.length > 0 && (
        <div className={`rounded-xl p-4 border ${
          batch.active
            ? 'bg-amber-50 border-amber-200'
            : batch.failed > 0
              ? 'bg-red-50 border-red-200'
              : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${
              batch.active ? 'text-amber-800' : batch.failed > 0 ? 'text-red-800' : 'text-green-800'
            }`}>
              {batch.active
                ? `${batch.completed} van ${batch.total} verwerkt...`
                : batch.failed > 0
                  ? `${batch.completed} geslaagd, ${batch.failed} mislukt`
                  : `${batch.completed} bonnetjes toegevoegd!`
              }
            </span>
            {!batch.active && (
              <button onClick={batch.dismiss} className="p-1 hover:bg-black/5 rounded">
                <X size={14} />
              </button>
            )}
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                batch.active ? 'bg-amber-500' : batch.failed > 0 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{ width: `${batch.total > 0 ? ((batch.completed + batch.failed) / batch.total) * 100 : 0}%` }}
            />
          </div>
          {/* Error details */}
          {batch.failed > 0 && (
            <div className="mt-2 space-y-1">
              {batch.items.filter(i => i.status === 'error').map(i => (
                <p key={i.id} className="text-xs text-red-600">{i.fileName}: {i.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Pending receipts */}
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
        <>
          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 px-1">
            <span>{filtered.length} openstaand</span>
            <span className="font-semibold text-gray-900">{formatEuro(totalAmount)}</span>
          </div>

          {/* Receipt list */}
          <div className="space-y-2">
            {filtered.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-green-500 text-white font-bold text-lg hover:bg-green-600 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                Versturen...
              </>
            ) : (
              <>
                <Send size={22} />
                Indienen per e-mail
              </>
            )}
          </button>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-400 text-4xl mb-3">🧾</p>
          <p className="text-gray-500 font-medium">Geen openstaande bonnetjes</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchQuery || filterCategory
              ? 'Probeer een andere zoekopdracht of filter'
              : 'Voeg een bonnetje toe via de + knop'}
          </p>
        </div>
      )}

      {/* Al ingediend section */}
      {submittedReceipts.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-500" />
            <h3 className="font-bold text-gray-900">Ingediend in {monthName}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{submittedReceipts.length}</p>
              <p className="text-xs text-green-500">bonnetjes</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{formatEuro(submittedTotal)}</p>
              <p className="text-xs text-green-500">totaal</p>
            </div>
          </div>
          <details>
            <summary className="text-sm text-green-600 font-medium cursor-pointer hover:text-green-700">
              Bekijk ingediende bonnetjes
            </summary>
            <div className="mt-3 space-y-2">
              {submittedReceipts.map((r) => (
                <div key={r.id} className="opacity-70">
                  <ReceiptCard receipt={r} />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSettingsSaved}
      />
    </div>
  )
}
