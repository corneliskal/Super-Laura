import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Trash2, Send } from 'lucide-react'
import { useTravel } from '@/hooks/useTravel'
import { useToast } from '@/components/ui/Toast'
import { TravelCard } from '@/components/travel/TravelCard'
import { MonthPicker } from '@/components/submission/MonthPicker'
import { formatEuro, currentMonthYear } from '@/lib/dateUtils'

export function TravelOverviewPage() {
  const { expenses, fetchExpenses, deleteExpense, loading } = useTravel()
  const { showToast } = useToast()
  const [month, setMonth] = useState(currentMonthYear().month)
  const [year, setYear] = useState(currentMonthYear().year)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchExpenses(month, year)
  }, [fetchExpenses, month, year])

  const handleMonthChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
  }

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Weet je zeker dat je deze declaratie wilt verwijderen?')) return
    setDeleting(id)
    try {
      await deleteExpense(id)
      showToast('success', 'Declaratie verwijderd')
    } catch {
      showToast('error', 'Kon declaratie niet verwijderen')
    } finally {
      setDeleting(null)
    }
  }, [deleteExpense, showToast])

  const totalKm = expenses.reduce((sum, e) => sum + e.kilometers, 0)
  const totalReimbursement = expenses.reduce((sum, e) => sum + e.total_reimbursement, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Reiskosten</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/reiskosten/indienen"
            className="flex items-center gap-1.5 px-3 py-2 bg-white text-primary-600 border border-primary-200 rounded-lg text-sm font-medium hover:bg-primary-50 transition-colors"
          >
            <Send size={16} />
            Indienen
          </Link>
          <Link
            to="/reiskosten/nieuw"
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            Nieuw
          </Link>
        </div>
      </div>

      <MonthPicker month={month} year={year} onChange={handleMonthChange} />

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{expenses.length} declaraties · {totalKm} km</span>
        <span className="font-semibold text-gray-900">{formatEuro(totalReimbursement)}</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : expenses.length > 0 ? (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="relative group">
              <TravelCard expense={expense} />
              {!expense.is_submitted && (
                <button
                  onClick={() => handleDelete(expense.id)}
                  disabled={deleting === expense.id}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-red-50 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all"
                  title="Verwijderen"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
          <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Geen reisdeclaraties</p>
          <p className="text-gray-400 text-sm mt-1">
            Voeg een reisdeclaratie toe via de + knop
          </p>
        </div>
      )}
    </div>
  )
}
