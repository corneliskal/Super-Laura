import { useState } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { todayISO } from '@/lib/dateUtils'
import { KM_RATE, type TravelExpenseFormData } from '@/types/receipt'

interface TravelFormProps {
  onSubmit: (data: TravelExpenseFormData) => Promise<void>
  saving: boolean
}

export function TravelForm({ onSubmit, saving }: TravelFormProps) {
  const [formData, setFormData] = useState<TravelExpenseFormData>({
    date: todayISO(),
    project_code: '',
    project_name: '',
    description: '',
    travel_cost: '',
    kilometers: '',
  })

  const km = parseFloat(formData.kilometers) || 0
  const travelCost = parseFloat(formData.travel_cost) || 0
  const kmReimbursement = Math.round(km * KM_RATE * 100) / 100
  const totalReimbursement = Math.round((travelCost + kmReimbursement) * 100) / 100

  const handleChange = (field: keyof TravelExpenseFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const isValid = formData.date && formData.project_code && formData.description

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Datum */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Datum *</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => handleChange('date', e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
          required
        />
      </div>

      {/* Project code & naam */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projectcode *</label>
          <input
            type="text"
            value={formData.project_code}
            onChange={(e) => handleChange('project_code', e.target.value)}
            placeholder="bijv. MOZA"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Projectnaam</label>
          <input
            type="text"
            value={formData.project_name}
            onChange={(e) => handleChange('project_name', e.target.value)}
            placeholder="bijv. KC Windmolen"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
          />
        </div>
      </div>

      {/* Omschrijving */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Omschrijving *</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="bijv. OT op locatie"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
          required
        />
      </div>

      {/* Reiskosten OV */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reiskosten OV (€)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={formData.travel_cost}
          onChange={(e) => handleChange('travel_cost', e.target.value)}
          placeholder="0,00"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
        />
      </div>

      {/* Kilometers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kilometers</label>
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={formData.kilometers}
          onChange={(e) => handleChange('kilometers', e.target.value)}
          placeholder="0"
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-gray-900"
        />
      </div>

      {/* Berekening */}
      {(km > 0 || travelCost > 0) && (
        <div className="bg-primary-50 rounded-xl p-4 space-y-2">
          <h4 className="font-medium text-primary-800 text-sm">Berekening</h4>
          {travelCost > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reiskosten OV</span>
              <span className="text-gray-900">€ {travelCost.toFixed(2)}</span>
            </div>
          )}
          {km > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{km} km × € {KM_RATE.toFixed(2)}</span>
              <span className="text-gray-900">€ {kmReimbursement.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-primary-200 pt-2 flex justify-between">
            <span className="font-semibold text-primary-800">Totale vergoeding</span>
            <span className="font-bold text-primary-700 text-lg">€ {totalReimbursement.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={saving || !isValid}
        className="w-full py-4 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Opslaan...
          </>
        ) : (
          <>
            <Save size={20} />
            Reisdeclaratie opslaan
          </>
        )}
      </button>
    </form>
  )
}
