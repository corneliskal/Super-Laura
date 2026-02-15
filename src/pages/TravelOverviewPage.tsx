import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Send, Loader2, CheckCircle } from 'lucide-react'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import { TravelCard } from '@/components/travel/TravelCard'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS, type TravelExpense } from '@/types/receipt'
import { SUBMIT_TRAVEL_URL } from '@/lib/constants'
import { getAuthToken } from '@/lib/firebase'
import { useSettings } from '@/hooks/useSettings'
import { SettingsModal } from '@/components/settings/SettingsModal'

export function TravelOverviewPage() {
  const { expenses, fetchExpenses, getSubmittedExpensesByMonth, loading } = useTravel()
  const { settings, loadSettings } = useSettings()
  const { showToast } = useToast()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [submitting, setSubmitting] = useState(false)
  const [submittedExpenses, setSubmittedExpenses] = useState<TravelExpense[]>([])
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  useEffect(() => {
    fetchExpenses(month, year)
    getSubmittedExpensesByMonth(month, year).then(setSubmittedExpenses).catch(() => {})
  }, [fetchExpenses, getSubmittedExpensesByMonth, month, year])

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
      const response = await fetch(SUBMIT_TRAVEL_URL, {
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
      fetchExpenses(month, year)
      getSubmittedExpensesByMonth(month, year).then(setSubmittedExpenses).catch(() => {})
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

  // Only show non-submitted in the main list
  const pendingExpenses = expenses.filter((e) => !e.is_submitted)
  const totalKm = pendingExpenses.reduce((sum, e) => sum + e.kilometers, 0)
  const totalReimbursement = pendingExpenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
  const submittedKm = submittedExpenses.reduce((sum, e) => sum + e.kilometers, 0)
  const submittedTotal = submittedExpenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
  const monthName = DUTCH_MONTHS[month - 1]

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Reiskosten</h2>
        <Link
          to="/reiskosten/nieuw"
          className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus size={16} />
          Nieuw
        </Link>
      </div>

      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Openstaand section */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : pendingExpenses.length > 0 ? (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{pendingExpenses.length} openstaand · {totalKm} km</span>
            <span className="font-semibold text-gray-900">{formatEuro(totalReimbursement)}</span>
          </div>

          {/* Pending list */}
          <div className="space-y-2">
            {pendingExpenses.map((expense) => (
              <TravelCard key={expense.id} expense={expense} />
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
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
          <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Geen openstaande declaraties</p>
          <p className="text-gray-400 text-sm mt-1">
            Voeg een reisdeclaratie toe via de + knop
          </p>
        </div>
      )}

      {/* Al ingediend section */}
      {submittedExpenses.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-500" />
            <h3 className="font-bold text-gray-900">Ingediend in {monthName}</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-700">{submittedExpenses.length}</p>
              <p className="text-xs text-green-500">ritten</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-700">{submittedKm}</p>
              <p className="text-xs text-green-500">km</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-700">{formatEuro(submittedTotal)}</p>
              <p className="text-xs text-green-500">totaal</p>
            </div>
          </div>
          <details>
            <summary className="text-sm text-green-600 font-medium cursor-pointer hover:text-green-700">
              Bekijk ingediende declaraties
            </summary>
            <div className="mt-3 space-y-2">
              {submittedExpenses.map((e) => (
                <div key={e.id} className="opacity-70">
                  <TravelCard expense={e} />
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
