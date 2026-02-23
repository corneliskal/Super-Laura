import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle, ZoomIn, FileText, ExternalLink } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { formatDateDutch, formatEuro } from '@/lib/dateUtils'
import { CATEGORIES, type Receipt } from '@/types/receipt'
import { useCardPayments } from '@/hooks/useCardPayments'
import { useToast } from '@/components/ui/Toast'

export function CardPaymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { deleteCardPayment } = useCardPayments()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [imageZoomed, setImageZoomed] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const docSnap = await getDoc(doc(db, 'card_payments', id))
        if (!docSnap.exists()) {
          showToast('error', 'Bonnetje niet gevonden')
          navigate('/kaartbetalingen')
          return
        }
        const d = docSnap.data()
        setReceipt({
          id: docSnap.id,
          photo_path: d.photo_path || '',
          photo_url: d.photo_url || '',
          store_name: d.store_name || '',
          description: d.description || '',
          amount: d.amount || 0,
          vat_amount: d.vat_amount || null,
          receipt_date: d.receipt_date || '',
          category: d.category || 'Overig',
          file_type: d.file_type || 'image',
          ocr_raw_text: d.ocr_raw_text || null,
          notes: d.notes || '',
          is_submitted: d.is_submitted || false,
          submission_id: d.submission_id || null,
          created_at: d.created_at || '',
          updated_at: d.updated_at || '',
        })
      } catch (err) {
        console.error('Error loading card payment:', err)
        showToast('error', 'Kon bonnetje niet laden')
        navigate('/kaartbetalingen')
        return
      }
      setLoading(false)
    }
    load()
  }, [id, navigate, showToast])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteCardPayment(id)
      showToast('success', 'Bonnetje verwijderd')
      navigate('/kaartbetalingen')
    } catch {
      showToast('error', 'Kon bonnetje niet verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
          <div className="h-4 bg-gray-100 rounded w-40" />
        </div>
      </div>
    )
  }

  if (!receipt) return null

  const category = CATEGORIES.find((c) => c.name === receipt.category)

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors text-red-500"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Photo or PDF */}
      {receipt.photo_url && (
        <div className="relative">
          {receipt.file_type === 'pdf' ? (
            <a
              href={receipt.photo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-2xl shadow-md bg-gray-100 flex flex-col items-center justify-center py-10 gap-3 hover:bg-gray-200 transition-colors block"
            >
              <FileText size={48} className="text-red-500" />
              <p className="text-sm font-medium text-gray-700">PDF bonnetje</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-primary-600 font-medium">
                <ExternalLink size={14} />
                Openen in nieuw tabblad
              </span>
            </a>
          ) : (
            <>
              <img
                src={receipt.photo_url}
                alt="Bonnetje foto"
                onClick={() => setImageZoomed(!imageZoomed)}
                className={`w-full rounded-2xl shadow-md cursor-pointer transition-all ${
                  imageZoomed ? 'max-h-none' : 'max-h-72 object-contain'
                } bg-gray-100`}
              />
              {!imageZoomed && (
                <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full p-1.5">
                  <ZoomIn size={16} className="text-white" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Details card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            {receipt.store_name || 'Onbekende winkel'}
          </h3>
          <span className="text-xl font-bold text-primary-600">
            {formatEuro(receipt.amount)}
          </span>
        </div>

        <div className="space-y-3">
          <DetailRow label="Datum" value={formatDateDutch(receipt.receipt_date)} />
          <DetailRow
            label="Categorie"
            value={category ? `${category.icon} ${category.name}` : receipt.category}
          />
          {receipt.vat_amount && (
            <DetailRow label="BTW" value={formatEuro(receipt.vat_amount)} />
          )}
          {receipt.description && (
            <DetailRow label="Omschrijving" value={receipt.description} />
          )}
          {receipt.notes && (
            <DetailRow label="Notities" value={receipt.notes} />
          )}

          {/* Status */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-sm text-green-600 font-medium">Verstuurd</span>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Bonnetje verwijderen?</h3>
            <p className="text-gray-600 text-sm">
              Weet je het zeker? Dit kan niet ongedaan worden gemaakt.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Verwijderen...' : 'Verwijder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium text-right">{value}</span>
    </div>
  )
}
