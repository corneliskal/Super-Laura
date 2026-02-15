import { useState, useCallback } from 'react'
import { Send, Package, Loader2, CheckCircle } from 'lucide-react'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { useReceipts } from '@/hooks/useReceipts'
import { useToast } from '@/components/ui/Toast'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS, type Receipt } from '@/types/receipt'
import { SUBMIT_RECEIPTS_URL } from '@/lib/constants'

export function SubmitMonthPage() {
  const { showToast } = useToast()
  const { getReceiptsByMonth, getSubmittedReceiptsByMonth } = useReceipts()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [submittedReceipts, setSubmittedReceipts] = useState<Receipt[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const loadReceipts = useCallback(async () => {
    setLoadingReceipts(true)
    try {
      const [pending, done] = await Promise.all([
        getReceiptsByMonth(month, year),
        getSubmittedReceiptsByMonth(month, year),
      ])
      setReceipts(pending)
      setSubmittedReceipts(done)
      setLoaded(true)
      setSubmitted(false)
    } catch {
      showToast('error', 'Kon bonnetjes niet laden')
    } finally {
      setLoadingReceipts(false)
    }
  }, [month, year, getReceiptsByMonth, getSubmittedReceiptsByMonth, showToast])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    setLoaded(false)
    setSubmitted(false)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(SUBMIT_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verzenden mislukt')
      }

      // Move pending to submitted list
      setSubmittedReceipts((prev) => [...prev, ...receipts])
      setReceipts([])
      setSubmitted(true)
      showToast('success', `${result.message} ✉️`)
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', err instanceof Error ? err.message : 'Verzenden mislukt. Probeer opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
  const submittedTotal = submittedReceipts.reduce((sum, r) => sum + r.amount, 0)
  const monthName = DUTCH_MONTHS[month - 1]

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Bonnetjes indienen</h2>

      {/* Month picker */}
      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Load button */}
      {!loaded && (
        <button
          onClick={loadReceipts}
          disabled={loadingReceipts}
          className="w-full py-4 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
        >
          {loadingReceipts ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Laden...
            </>
          ) : (
            <>
              <Package size={20} />
              Bonnetjes ophalen
            </>
          )}
        </button>
      )}

      {/* Loaded content */}
      {loaded && (
        <>
          {/* Pending receipts */}
          {submitted ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✉️</p>
              <p className="text-gray-900 font-bold text-lg">Verstuurd!</p>
              <p className="text-gray-500 text-sm mt-1">
                De bonnetjes van {monthName} zijn per e-mail verstuurd
              </p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 font-medium">Geen openstaande bonnetjes</p>
              <p className="text-gray-400 text-sm mt-1">
                Alle bonnetjes van {monthName} zijn al ingediend
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3">Openstaand</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-primary-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary-700">{receipts.length}</p>
                    <p className="text-xs text-primary-500">bonnetjes</p>
                  </div>
                  <div className="bg-primary-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-bold text-primary-700">{formatEuro(totalAmount)}</p>
                    <p className="text-xs text-primary-500">totaal</p>
                  </div>
                </div>

                <details className="mt-4">
                  <summary className="text-sm text-primary-600 font-medium cursor-pointer hover:text-primary-700">
                    Bekijk alle bonnetjes
                  </summary>
                  <div className="mt-3 space-y-2">
                    {receipts.map((r) => (
                      <ReceiptCard key={r.id} receipt={r} />
                    ))}
                  </div>
                </details>
              </div>

              {/* Submit button */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
                <p className="text-sm text-gray-600">
                  Er wordt een e-mail gestuurd met een PDF overzicht en alle bonnetje foto's als bijlagen.
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

          {/* Already submitted receipts */}
          {submittedReceipts.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-green-100">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-green-500" />
                <h3 className="font-bold text-gray-900">Al ingediend</h3>
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
        </>
      )}
    </div>
  )
}
