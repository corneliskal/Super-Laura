import { useState, useCallback } from 'react'
import { Download, Mail, CheckCircle, Package, Loader2 } from 'lucide-react'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { TravelCard } from '@/components/travel/TravelCard'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import { generateTravelExcel, getTravelExcelFilename } from '@/lib/travelExcelGenerator'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS, KM_RATE, type TravelExpense } from '@/types/receipt'
import { RECIPIENT_EMAIL, EMPLOYEE_NAME } from '@/lib/constants'

export function SubmitTravelPage() {
  const { showToast } = useToast()
  const { getExpensesByMonth, markAsSubmitted, createSubmission } = useTravel()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [expenses, setExpenses] = useState<TravelExpense[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadExpenses = useCallback(async () => {
    setLoadingExpenses(true)
    try {
      const data = await getExpensesByMonth(month, year)
      setExpenses(data)
      setLoaded(true)
      setExported(false)
    } catch {
      showToast('error', 'Kon reiskosten niet laden')
    } finally {
      setLoadingExpenses(false)
    }
  }, [month, year, getExpensesByMonth, showToast])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    setLoaded(false)
    setExported(false)
  }

  const handleExport = async () => {
    if (expenses.length === 0) return
    setExporting(true)

    try {
      // Generate Excel declaratieformulier
      const excelBlob = generateTravelExcel(expenses, month, year)

      // Trigger download
      const url = URL.createObjectURL(excelBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = getTravelExcelFilename(month, year)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExported(true)
      showToast('success', 'Declaratieformulier gedownload!')
    } catch (err) {
      console.error('Export error:', err)
      showToast('error', 'Exporteren mislukt. Probeer opnieuw.')
    } finally {
      setExporting(false)
    }
  }

  const handleOpenEmail = () => {
    const monthName = DUTCH_MONTHS[month - 1]
    const totalReimbursement = expenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
    const totalKm = expenses.reduce((sum, e) => sum + e.kilometers, 0)

    const subject = encodeURIComponent(`Declaratie reiskosten ${monthName} ${year} - ${EMPLOYEE_NAME}`)
    const body = encodeURIComponent(
      `Hallo,\r\n\r\n` +
      `Hierbij mijn declaratie reiskosten van ${monthName} ${year}.\r\n\r\n` +
      `Aantal declaraties: ${expenses.length}\r\n` +
      `Totaal kilometers: ${totalKm}\r\n` +
      `Km vergoeding (${totalKm} × € ${KM_RATE.toFixed(2)}): ${formatEuro(totalReimbursement)}\r\n\r\n` +
      `Het declaratieformulier is bijgevoegd als Excel-bestand.\r\n\r\n` +
      `Vergeet niet het bestand als bijlage toe te voegen!\r\n\r\n` +
      `Groetjes,\r\n${EMPLOYEE_NAME}`
    )

    window.open(`mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`, '_blank')
  }

  const handleMarkSent = async () => {
    setSubmitting(true)
    try {
      const totalAmount = expenses.reduce((sum, e) => sum + e.total_reimbursement, 0)
      const submission = await createSubmission(month, year, totalAmount, expenses.length)
      await markAsSubmitted(
        expenses.map((e) => e.id),
        submission.id
      )
      showToast('success', 'Reiskosten zijn als ingediend gemarkeerd! ✅')
      setExpenses([])
      setLoaded(false)
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', 'Kon niet markeren als ingediend')
    } finally {
      setSubmitting(false)
    }
  }

  const totalKm = expenses.reduce((sum, e) => sum + e.kilometers, 0)
  const totalReimbursement = expenses.reduce((sum, e) => sum + e.total_reimbursement, 0)

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
          {expenses.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 font-medium">Geen openstaande reiskosten</p>
              <p className="text-gray-400 text-sm mt-1">
                Alle reiskosten van {DUTCH_MONTHS[month - 1]} zijn al ingediend
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3">Overzicht</h3>
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

              {/* Export section */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-900">Declaratieformulier versturen</h3>

                {/* Step 1: Export */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">1</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">Download het declaratieformulier</p>
                      <p className="text-xs text-gray-500 mt-0.5">Excel in het DE UNIE template</p>
                    </div>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {exporting ? (
                      <><Loader2 size={18} className="animate-spin" /> Bestand maken...</>
                    ) : exported ? (
                      <><CheckCircle size={18} /> Opnieuw downloaden</>
                    ) : (
                      <><Download size={18} /> Download Excel</>
                    )}
                  </button>
                  {exported && (
                    <div className="flex items-center gap-2 text-green-600 text-xs">
                      <CheckCircle size={14} />
                      <span>Declaratieformulier gedownload</span>
                    </div>
                  )}
                </div>

                {/* Step 2: Email */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${exported ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'}`}>2</div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">Open je e-mail</p>
                      <p className="text-xs text-gray-500 mt-0.5">Voeg het Excel-bestand als bijlage toe.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleOpenEmail}
                    disabled={!exported}
                    className="w-full py-3 rounded-xl border-2 border-primary-600 text-primary-600 font-semibold hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail size={18} />
                    Open e-mail
                  </button>
                </div>

                {/* Step 3: Mark as sent */}
                {exported && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">3</div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">Heb je de e-mail verstuurd?</p>
                        <p className="text-xs text-gray-500 mt-0.5">Markeer als ingediend</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleMarkSent}
                        disabled={submitting}
                        className="py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                        Ja, verstuurd!
                      </button>
                      <button
                        onClick={() => setExported(false)}
                        className="py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Later doen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
