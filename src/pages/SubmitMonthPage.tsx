import { useState, useCallback } from 'react'
import { Download, Mail, CheckCircle, Package, Loader2 } from 'lucide-react'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { useReceipts } from '@/hooks/useReceipts'
import { useToast } from '@/components/ui/Toast'
import { generateExcel } from '@/lib/excelGenerator'
import { generatePdf } from '@/lib/pdfGenerator'
import { generateSubmissionZip, getZipFilename } from '@/lib/zipGenerator'
import { buildMailtoLink } from '@/lib/mailtoHelper'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'
import { DUTCH_MONTHS, type Receipt } from '@/types/receipt'

export function SubmitMonthPage() {
  const { showToast } = useToast()
  const { getReceiptsByMonth, getPhotoBlob, markAsSubmitted, createSubmission } = useReceipts()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadingReceipts, setLoadingReceipts] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exported, setExported] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadReceipts = useCallback(async () => {
    setLoadingReceipts(true)
    try {
      const data = await getReceiptsByMonth(month, year)
      setReceipts(data)
      setLoaded(true)
      setExported(false)
    } catch {
      showToast('error', 'Kon bonnetjes niet laden')
    } finally {
      setLoadingReceipts(false)
    }
  }, [month, year, getReceiptsByMonth, showToast])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    setLoaded(false)
    setExported(false)
  }

  const handleExport = async () => {
    if (receipts.length === 0) return
    setExporting(true)

    try {
      // Generate Excel
      const excelBlob = generateExcel(receipts, month, year)

      // Generate PDF
      const pdfBlob = generatePdf(receipts, month, year)

      // Download photos
      const photos: Array<{ filename: string; blob: Blob }> = []
      for (let i = 0; i < receipts.length; i++) {
        const r = receipts[i]
        try {
          const blob = await getPhotoBlob(r.photo_path)
          const date = r.receipt_date.replace(/-/g, '')
          const store = (r.store_name || 'onbekend').replace(/[^a-zA-Z0-9]/g, '_')
          photos.push({
            filename: `${String(i + 1).padStart(2, '0')}_${store}_${date}.jpg`,
            blob,
          })
        } catch (err) {
          console.warn(`Could not download photo for receipt ${r.id}:`, err)
        }
      }

      // Generate ZIP
      const monthName = DUTCH_MONTHS[month - 1]
      const zipBlob = await generateSubmissionZip(monthName, year, excelBlob, pdfBlob, photos)

      // Trigger download
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = getZipFilename(month, year)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExported(true)
      showToast('success', 'ZIP-bestand gedownload!')
    } catch (err) {
      console.error('Export error:', err)
      showToast('error', 'Exporteren mislukt. Probeer opnieuw.')
    } finally {
      setExporting(false)
    }
  }

  const handleOpenEmail = () => {
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
    const mailtoUrl = buildMailtoLink(month, year, receipts.length, totalAmount)
    window.open(mailtoUrl, '_blank')
  }

  const handleMarkSent = async () => {
    setSubmitting(true)
    try {
      const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
      const submission = await createSubmission(month, year, totalAmount, receipts.length)
      await markAsSubmitted(
        receipts.map((r) => r.id),
        submission.id
      )
      showToast('success', 'Bonnetjes zijn als ingediend gemarkeerd! ✅')
      setReceipts([])
      setLoaded(false)
    } catch (err) {
      console.error('Submit error:', err)
      showToast('error', 'Kon niet markeren als ingediend')
    } finally {
      setSubmitting(false)
    }
  }

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="p-4 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Maand indienen</h2>

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
          {receipts.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <p className="text-4xl mb-3">✅</p>
              <p className="text-gray-500 font-medium">Geen openstaande bonnetjes</p>
              <p className="text-gray-400 text-sm mt-1">
                Alle bonnetjes van {DUTCH_MONTHS[month - 1]} zijn al ingediend
              </p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3">Overzicht</h3>
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

                {/* Receipt list collapsible */}
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

              {/* Export section */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-900">Bestanden maken & versturen</h3>

                {/* Step 1: Export */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">Download het ZIP-bestand</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Bevat Excel, PDF en alle bonnetje foto's
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {exporting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Bestanden maken...
                      </>
                    ) : exported ? (
                      <>
                        <CheckCircle size={18} />
                        Opnieuw downloaden
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Download ZIP
                      </>
                    )}
                  </button>

                  {exported && (
                    <div className="flex items-center gap-2 text-green-600 text-xs">
                      <CheckCircle size={14} />
                      <span>ZIP-bestand gedownload</span>
                    </div>
                  )}
                </div>

                {/* Step 2: Email */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      exported ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">Open je e-mail</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Er opent een nieuw bericht. Voeg het ZIP-bestand als bijlage toe.
                      </p>
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
                      <div className="w-7 h-7 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                        3
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">Heb je de e-mail verstuurd?</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Markeer als ingediend zodat deze bonnetjes niet opnieuw verschijnen
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={handleMarkSent}
                        disabled={submitting}
                        className="py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <CheckCircle size={18} />
                        )}
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

              {/* Info box */}
              <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 space-y-1">
                <p className="font-medium">💡 Tip</p>
                <p className="text-blue-600 text-xs">
                  Het ZIP-bestand bevat een Excel overzicht, een PDF samenvatting en alle bonnetje foto's.
                  Voeg dit bestand toe als bijlage aan de e-mail.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
