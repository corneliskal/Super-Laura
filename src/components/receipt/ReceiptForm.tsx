import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { CATEGORIES, type ReceiptFormData, type ParsedReceipt } from '@/types/receipt'
import { todayISO } from '@/lib/dateUtils'

interface ReceiptFormProps {
  initialData?: ParsedReceipt | null
  defaultMonth?: number
  defaultYear?: number
  onSubmit: (data: ReceiptFormData) => Promise<void>
  saving: boolean
  submitLabel?: React.ReactNode
}

function getDefaultDate(month?: number, year?: number): string {
  if (!month || !year) return todayISO()
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  // If the target month is the current month, use today
  if (month === currentMonth && year === currentYear) return todayISO()
  // Otherwise use the 1st of the target month
  return `${year}-${String(month).padStart(2, '0')}-01`
}

export function ReceiptForm({ initialData, defaultMonth, defaultYear, onSubmit, saving, submitLabel }: ReceiptFormProps) {
  const [formData, setFormData] = useState<ReceiptFormData>({
    store_name: '',
    description: '',
    amount: '',
    vat_amount: '',
    receipt_date: getDefaultDate(defaultMonth, defaultYear),
    category: 'Overig',
    notes: '',
  })

  // Pre-fill from OCR results (but NOT the date - that stays in the selected month)
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        store_name: initialData.store_name || prev.store_name,
        amount: initialData.amount ? String(initialData.amount) : prev.amount,
        vat_amount: initialData.vat_amount ? String(initialData.vat_amount) : prev.vat_amount,
      }))
    }
  }, [initialData])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const isValid = formData.amount && parseFloat(formData.amount) > 0 && formData.receipt_date

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Store name */}
      <div>
        <label htmlFor="store_name" className="block text-sm font-medium text-gray-700 mb-1">
          Winkel / Leverancier
        </label>
        <input
          type="text"
          id="store_name"
          name="store_name"
          value={formData.store_name}
          onChange={handleChange}
          placeholder="bijv. Albert Heijn"
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
        />
      </div>

      {/* Amount + VAT */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
            Bedrag (EUR) *
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0,00"
            step="0.01"
            min="0"
            required
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
          />
        </div>
        <div>
          <label htmlFor="vat_amount" className="block text-sm font-medium text-gray-700 mb-1">
            BTW (EUR)
          </label>
          <input
            type="number"
            id="vat_amount"
            name="vat_amount"
            value={formData.vat_amount}
            onChange={handleChange}
            placeholder="0,00"
            step="0.01"
            min="0"
            className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
          />
        </div>
      </div>

      {/* Date */}
      <div>
        <label htmlFor="receipt_date" className="block text-sm font-medium text-gray-700 mb-1">
          Datum *
        </label>
        <input
          type="date"
          id="receipt_date"
          name="receipt_date"
          value={formData.receipt_date}
          onChange={handleChange}
          required
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
          Categorie
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base bg-white"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Omschrijving
        </label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Korte omschrijving van de aankoop"
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notities
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Optionele notities..."
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-base resize-none"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || saving}
        className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-4 rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md text-base"
      >
        {submitLabel ? submitLabel : saving ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Opslaan...
          </>
        ) : (
          <>
            <Save size={20} />
            Bonnetje opslaan
          </>
        )}
      </button>
    </form>
  )
}
