import { useState, useCallback } from 'react'
import { Send, Package, Loader2, CheckCircle } from 'lucide-react'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { TravelCard } from '@/components/travel/TravelCard'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS, type TravelExpense } from '@/types/receipt'
import { SUBMIT_TRAVEL_URL } from '@/lib/constants'

export function SubmitTravelPage() {
  const { showToast } = useToast()
  const { getExpensesByMonth, getSubmittedExpensesByMonth } = useTravel()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [expenses, setExpenses] = useState<TravelExpense[]>([])
  const [submittedExpenses, setSubmittedExpenses] = useState<TravelExpense[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true)
    try {
      const [pending, done] = await Promise.all([
        getExpensesByMonth(month, year),
        getSubmittedExpensesByMonth(month, year),
      ])
      setExpenses(pending)
      setSubmittedExpenses(done)
      setLoaded(true)
      setSubmitted(false)
    } catch {
      showToast('error', 'Kon reiskosten niet laden')
    } finally {
      setLoadingExpenses(false)
    }
  }, [month, year, getExpensesByMonth, getSubmittedExpensesByMonth, showToast])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    setLoaded(false)
    setSubmitted(false)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(SUBMIT_TRAVEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verzenden mislukt')
      }

      // Move pending to submitted list
      setSubmittedExpenses((prev) => [...prev, ...expenses])
      setExpenses([])
      setSubmitted(true)
      showToast('success', `${result.message} ✉️`)
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', err instanceof Error ? err.message : 'Verzenden mislukt. Probeer opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalKm = expenses.reduce((sum, e) => sum + e.kilometers, 0)
  const totalReimbursement = expenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
  const submittedKm = submittedExpenses.reduce((sum, e) => sum + e.kilometers, 0)
  const submittedTotal = submittedExpenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
  const monthName = DUTCH_MONTHS[month - 1]

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Reiskosten indienen</h2>

      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Load button */}
      {!loaded && (
        <button
          onClick={loadExpenses}
          disabled={loadingExpenses}
          className="w-full py-4 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
        >
          {loadingExpenses ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Laden...
            </>
          ) : (
            <>
              <Package size={20} />
              Reiskosten ophalen
            </>
          )}
        </button>
      )}

      {/* Loaded content */}
      {loaded && (
        <>
          {/* Pending expenses */}
          {submitted ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✉️</p>
              <p className="text-gray-900 font-bold text-lg">Verstuurd!</p>
              <p className="text-gray-500 text-sm mt-1">
                De reiskosten van {monthName} zijn per e-mail verstuurd
              </p>
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 font-medium">Geen openstaande reiskosten</p>
              <p className="text-gray-400 text-sm mt-1">
                Alle reiskosten van {monthName} zijn al ingediend
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3">Openstaand</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{expenses.length}</p>
                    <p className="text-xs text-blue-500">ritten</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{totalKm}</p>
                    <p className="text-xs text-blue-500">km</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-blue-700">{formatEuro(totalReimbursement)}</p>
                    <p className="text-xs text-blue-500">totaal</p>
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="text-sm text-primary-600 font-medium cursor-pointer hover:text-primary-700">
                    Bekijk alle declaraties
                  </summary>
                  <div className="mt-3 space-y-2">
                    {expenses.map((e) => (
                      <TravelCard key={e.id} expense={e} />
                    ))}
                  </div>
                </details>
              </div>

              {/* Submit button */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
                <p className="text-sm text-gray-600">
                  Er wordt een e-mail gestuurd met het DE UNIE declaratieformulier als Excel-bijlage.
                </p>
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
              </div>
            </>
          )}

          {/* Already submitted expenses */}
          {submittedExpenses.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-500" />
                <h3 className="font-bold text-gray-900">Al ingediend</h3>
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
        </>
      )}
    </div>
  )
}
