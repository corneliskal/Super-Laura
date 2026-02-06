import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastContextType {
  showToast: (type: ToastMessage['type'], message: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-16 right-4 left-4 z-50 flex flex-col gap-2 max-w-lg mx-auto pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onClose])

  const icons = {
    success: <CheckCircle size={18} className="text-green-500 shrink-0" />,
    error: <AlertCircle size={18} className="text-red-500 shrink-0" />,
    info: <Info size={18} className="text-blue-500 shrink-0" />,
  }

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  }

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto animate-slide-in ${bgColors[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="text-sm font-medium text-gray-800 flex-1">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="text-gray-400 hover:text-gray-600 shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
