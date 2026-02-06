import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, TrendingUp, Receipt } from 'lucide-react'
import { useReceipts, useReceiptStats } from '@/hooks/useReceipts'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { formatEuro } from '@/lib/dateUtils'
import { DUTCH_MONTHS } from '@/types/receipt'

export function HomePage() {
  const { receipts, fetchReceipts, loading } = useReceipts()
  const stats = useReceiptStats()
  const now = new Date()
  const currentMonth = DUTCH_MONTHS[now.getMonth()]

  useEffect(() => {
    fetchReceipts()
  }, [fetchReceipts])

  // Show only last 5 receipts
  const recentReceipts = receipts.slice(0, 5)

  return (
    <div className="p-4 space-y-5">
      {/* Logo */}
      <div className="text-center pt-2">
        <img
          src="/logo.png"
          alt="Super-Laura"
          className="w-28 h-28 mx-auto drop-shadow-lg"
        />
      </div>

      {/* Monthly stats card */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} />
          <span className="text-sm font-medium text-primary-200">{currentMonth} {now.getFullYear()}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-3xl font-bold">
              {stats.loading ? '...' : stats.count}
            </p>
            <p className="text-primary-200 text-sm">bonnetjes</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {stats.loading ? '...' : formatEuro(stats.total)}
            </p>
            <p className="text-primary-200 text-sm">totaal</p>
          </div>
        </div>
      </div>

      {/* Quick action */}
      <Link
        to="/nieuw"
        className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow active:scale-[0.98]"
      >
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <PlusCircle size={24} className="text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">Nieuw bonnetje</p>
          <p className="text-sm text-gray-500">Maak een foto van je bon</p>
        </div>
      </Link>

      {/* Recent receipts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900">Recente bonnetjes</h3>
          <Link
            to="/bonnetjes"
            className="text-sm text-primary-600 font-medium hover:text-primary-700"
          >
            Bekijk alles
          </Link>
        </div>

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
        ) : recentReceipts.length > 0 ? (
          <div className="space-y-2">
            {recentReceipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
            <Receipt size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nog geen bonnetjes</p>
            <p className="text-gray-400 text-sm mt-1">
              Maak een foto om te beginnen
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
