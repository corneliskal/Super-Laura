import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface OcrStatusProps {
  processing: boolean
  error: string | null
  hasResult: boolean
}

export function OcrStatus({ processing, error, hasResult }: OcrStatusProps) {
  if (processing) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 text-blue-700 rounded-xl px-4 py-3">
        <Loader2 size={20} className="animate-spin shrink-0" />
        <div>
          <p className="font-medium text-sm">Tekst herkennen...</p>
          <p className="text-xs text-blue-500">Dit kan een paar seconden duren</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-amber-50 text-amber-700 rounded-xl px-4 py-3">
        <AlertCircle size={20} className="shrink-0" />
        <div>
          <p className="font-medium text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (hasResult) {
    return (
      <div className="flex items-center gap-3 bg-green-50 text-green-700 rounded-xl px-4 py-3">
        <CheckCircle size={20} className="shrink-0" />
        <p className="font-medium text-sm">Tekst herkend! Controleer de gegevens hieronder.</p>
      </div>
    )
  }

  return null
}
