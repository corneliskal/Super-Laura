import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Send, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useManagementFee } from '@/hooks/useManagementFee'
import { useToast } from '@/components/ui/Toast'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS } from '@/types/receipt'
import { SUBMIT_MANAGEMENT_FEE_URL } from '@/lib/constants'
import { getAuthToken } from '@/lib/firebase'
import type { ManagementFeeInvoice } from '@/types/managementfee'

export function ManagementFeeOverviewPage() {
  const { showToast } = useToast()
  const { template, loadTemplate, getInvoiceForMonth, getLastAmount } = useManagementFee()
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [amount, setAmount] = useState('')
  const [invoice, setInvoice] = useState<ManagementFeeInvoice | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const [editing, setEditing] = useState(false)

  // Load template and prefill amount on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadTemplate()
      const lastAmt = await getLastAmount()
      if (lastAmt) setAmount(String(lastAmt))
      setLoading(false)
    }
    init()
  }, [loadTemplate, getLastAmount])

  // Check if invoice exists for selected month
  useEffect(() => {
    const checkInvoice = async () => {
      setJustSent(false)
      setEditing(false)
      const inv = await getInvoiceForMonth(month, year)
      setInvoice(inv)
      if (inv) setAmount(String(inv.amount))
    }
    checkInvoice()
  }, [month, year, getInvoiceForMonth])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
  }

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount)
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Vul een geldig bedrag in')
      return
    }

    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const response = await fetch(SUBMIT_MANAGEMENT_FEE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ month, year, amount: numAmount }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Verzenden mislukt')

      showToast('success', result.message)
      setJustSent(true)
      setEditing(false)
      // Refresh invoice status
      const inv = await getInvoiceForMonth(month, year)
      setInvoice(inv)
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', err instanceof Error ? err.message : 'Verzenden mislukt')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    )
  }

  // Not configured - show setup prompt
  if (!template?.isConfigured) {
    return (
      <div className="p-4 space-y-5">
        <h2 className="text-lg font-bold text-gray-900">Management Fee</h2>

        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
          <div>
            <p className="text-gray-900 font-semibold text-lg">Nog niet geconfigureerd</p>
            <p className="text-gray-500 text-sm mt-1 px-6">
              Upload een voorbeeld-factuur om de management fee functie te activeren.
            </p>
          </div>
          <Link
            to="/management-fee/instellen"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-colors shadow-md"
          >
            <Settings size={18} />
            Instellen
          </Link>
        </div>
      </div>
    )
  }

  const numAmount = parseFloat(amount) || 0
  const btwAmount = numAmount * (template.btwPercentage / 100)
  const totalAmount = numAmount + btwAmount
  const monthName = DUTCH_MONTHS[month - 1]
  const invoiceNumber = `${year}-${String(month).padStart(2, '0')}`

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Management Fee</h2>
        <Link
          to="/management-fee/instellen"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Instellingen"
        >
          <Settings size={20} className="text-gray-500" />
        </Link>
      </div>

      {/* Month picker */}
      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Already sent - show summary with edit option */}
      {(invoice || justSent) && !editing && (
        <div className="text-center py-8 bg-white rounded-2xl border border-green-100 space-y-3">
          <CheckCircle size={48} className="text-green-500 mx-auto" />
          <div>
            <p className="text-gray-900 font-bold text-lg">Verstuurd!</p>
            <p className="text-gray-500 text-sm mt-1">
              Factuur {invoice?.invoiceNumber || invoiceNumber} is verstuurd
            </p>
          </div>
          {invoice && (
            <div className="mx-6 bg-green-50 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bedrag excl. BTW</span>
                <span className="font-medium">{formatEuro(invoice.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">BTW {invoice.btwPercentage}%</span>
                <span className="font-medium">{formatEuro(invoice.btwAmount)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-green-200">
                <span className="text-gray-900 font-semibold">Totaal</span>
                <span className="font-bold text-green-700">{formatEuro(invoice.totalAmount)}</span>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setEditing(true)
              if (invoice) setAmount(String(invoice.amount))
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
          >
            <RefreshCw size={16} />
            Wijzig en opnieuw versturen
          </button>
        </div>
      )}

      {/* Amount form - show when no invoice or editing */}
      {(!invoice && !justSent || editing) && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            {editing && (
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
                <RefreshCw size={14} />
                <span>Bedrag wijzigen en opnieuw versturen</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrag excl. BTW
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">&euro;</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg font-semibold"
                />
              </div>
            </div>

            {/* Auto-calculated fields */}
            {numAmount > 0 && (
              <div className="bg-amber-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Factuurnummer</span>
                  <span className="font-medium">{invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bedrag excl. BTW</span>
                  <span className="font-medium">{formatEuro(numAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">BTW {template.btwPercentage}%</span>
                  <span className="font-medium">{formatEuro(btwAmount)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-amber-200">
                  <span className="text-gray-900 font-semibold">Totaal incl. BTW</span>
                  <span className="font-bold text-amber-700">{formatEuro(totalAmount)}</span>
                </div>
                <div className="pt-2 border-t border-amber-200 text-xs text-gray-500">
                  <p>Naar: {template.recipientEmail}</p>
                  <p>Bestand: {template.fileTitle} {monthName.toLowerCase()} {year}.pdf</p>
                </div>
              </div>
            )}
          </div>

          {/* Submit button */}
          <div className="flex gap-3">
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="px-5 py-4 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Annuleer
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || numAmount <= 0}
              className="flex-1 py-4 rounded-xl bg-amber-600 text-white font-bold text-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  Versturen...
                </>
              ) : (
                <>
                  <Send size={22} />
                  {editing ? 'Opnieuw versturen' : 'Verstuur factuur'}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
