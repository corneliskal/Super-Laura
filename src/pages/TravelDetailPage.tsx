import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, CheckCircle, Edit3, MapPin } from 'lucide-react'
import { formatDateDutch, formatEuro } from '@/lib/dateUtils'
import { KM_RATE, type TravelExpense, type TravelExpenseFormData } from '@/types/receipt'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import { TravelForm } from '@/components/travel/TravelForm'

export function TravelDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { getExpense, updateExpense, deleteExpense } = useTravel()
  const [expense, setExpense] = useState<TravelExpense | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const data = await getExpense(id)
        if (!data) {
          showToast('error', 'Declaratie niet gevonden')
          navigate('/reiskosten')
          return
        }
        setExpense(data)
      } catch {
        showToast('error', 'Kon declaratie niet laden')
        navigate('/reiskosten')
        return
      }
      setLoading(false)
    }
    load()
  }, [id, getExpense, navigate, showToast])

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteExpense(id)
      showToast('success', 'Declaratie verwijderd')
      navigate('/reiskosten')
    } catch {
      showToast('error', 'Kon declaratie niet verwijderen')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpdate = useCallback(async (formData: TravelExpenseFormData) => {
    if (!id) return
    setSaving(true)
    try {
      await updateExpense(id, formData)
      const updated = await getExpense(id)
      if (updated) setExpense(updated)
      setEditing(false)
      showToast('success', 'Declaratie bijgewerkt')
    } catch {
      showToast('error', 'Kon declaratie niet bijwerken')
    } finally {
      setSaving(false)
    }
  }, [id, updateExpense, getExpense, showToast])

  if (loading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded" />
        <div className="h-48 bg-gray-200 rounded-2xl" />
        <div className="space-y-3">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
      </div>
    )
  }

  if (!expense) return null

  if (editing) {
    const initialData: TravelExpenseFormData = {
      date: expense.date,
      project_code: expense.project_code,
      project_name: expense.project_name,
      description: expense.description,
      travel_cost: expense.travel_cost ? String(expense.travel_cost) : '',
      kilometers: expense.kilometers ? String(expense.kilometers) : '',
    }

    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">Declaratie bewerken</h2>
        </div>
        <TravelForm
          onSubmit={handleUpdate}
          saving={saving}
          initialData={initialData}
          submitLabel="Wijzigingen opslaan"
        />
      </div>
    )
  }

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
        <div className="flex items-center gap-2">
          {!expense.is_submitted && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
              >
                <Edit3 size={18} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <MapPin size={22} className="text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {expense.project_code}{expense.project_name ? ` — ${expense.project_name}` : ''}
            </h3>
            <p className="text-sm text-gray-500">{expense.description}</p>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <DetailRow label="Datum" value={formatDateDutch(expense.date)} />
          <DetailRow label="Projectcode" value={expense.project_code} />
          {expense.project_name && (
            <DetailRow label="Projectnaam" value={expense.project_name} />
          )}
          <DetailRow label="Omschrijving" value={expense.description} />
          {expense.travel_cost > 0 && (
            <DetailRow label="Reiskosten OV" value={formatEuro(expense.travel_cost)} />
          )}
          {expense.kilometers > 0 && (
            <>
              <DetailRow label="Kilometers" value={`${expense.kilometers} km`} />
              <DetailRow
                label={`Km vergoeding (${expense.kilometers} x ${formatEuro(KM_RATE)})`}
                value={formatEuro(expense.km_reimbursement)}
              />
            </>
          )}

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
            <span className="font-semibold text-gray-700">Totale vergoeding</span>
            <span className="text-xl font-bold text-primary-600">
              {formatEuro(expense.total_reimbursement)}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            {expense.is_submitted ? (
              <>
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm text-green-600 font-medium">Ingediend</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">Nog niet ingediend</span>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Declaratie verwijderen?</h3>
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
