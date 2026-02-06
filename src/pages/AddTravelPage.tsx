import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { TravelForm } from '@/components/travel/TravelForm'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import type { TravelExpenseFormData } from '@/types/receipt'

export function AddTravelPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { createExpense } = useTravel()
  const [saving, setSaving] = useState(false)

  const onSubmit = useCallback(async (formData: TravelExpenseFormData) => {
    setSaving(true)
    try {
      await createExpense(formData)
      showToast('success', 'Reisdeclaratie opgeslagen! 🚗')
      navigate('/reiskosten')
    } catch (err) {
      console.error('Save error:', err)
      showToast('error', 'Kon declaratie niet opslaan. Probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }, [createExpense, navigate, showToast])

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Nieuwe reisdeclaratie</h2>
      </div>

      <TravelForm onSubmit={onSubmit} saving={saving} />
    </div>
  )
}
