import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { CameraCapture } from '@/components/receipt/CameraCapture'
import { OcrStatus } from '@/components/receipt/OcrStatus'
import { ReceiptForm } from '@/components/receipt/ReceiptForm'
import { useImageCapture } from '@/hooks/useImageCapture'
import { useOcr } from '@/hooks/useOcr'
import { useCardPayments } from '@/hooks/useCardPayments'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/ui/Toast'
import { compressImage } from '@/lib/imageUtils'
import { getAuthToken } from '@/lib/firebase'
import { SUBMIT_CARD_PAYMENT_URL } from '@/lib/constants'
import { SettingsModal } from '@/components/settings/SettingsModal'
import type { ReceiptFormData } from '@/types/receipt'

export function AddCardPaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as { month?: number; year?: number } | null
  const { showToast } = useToast()
  const { imageBlob, previewUrl, capturing, isPdf, handleCapture, reset: resetImage } = useImageCapture()
  const { ocrResult, processing: ocrProcessing, error: ocrError, processImage, reset: resetOcr } = useOcr()
  const { createCardPayment } = useCardPayments()
  const { settings, loadSettings } = useSettings()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'capture' | 'form'>('capture')
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<ReceiptFormData | null>(null)

  const onImageCaptured = useCallback(async (file: File) => {
    handleCapture(file)

    if (file.type === 'application/pdf') {
      await processImage(file)
      setStep('form')
    } else {
      const compressed = await compressImage(file)
      await processImage(compressed)
      setStep('form')
    }
  }, [handleCapture, processImage])

  const onRetake = useCallback(() => {
    resetImage()
    resetOcr()
    setStep('capture')
  }, [resetImage, resetOcr])

  const sendPayment = useCallback(async (formData: ReceiptFormData) => {
    if (!imageBlob) {
      showToast('error', 'Geen bestand gevonden. Upload eerst een foto of PDF.')
      return
    }

    setSaving(true)
    try {
      // 1. Save to Firestore (is_submitted: true)
      const receiptId = await createCardPayment(formData, imageBlob, ocrResult?.raw_text)

      // 2. Send email immediately via Cloud Function
      const token = await getAuthToken()
      const response = await fetch(SUBMIT_CARD_PAYMENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ receiptId }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Verzenden mislukt')
      }

      showToast('success', 'Bonnetje verstuurd!')
      navigate('/kaartbetalingen', {
        state: navState ? { month: navState.month, year: navState.year } : undefined,
      })
    } catch (err) {
      console.error('Send error:', err)
      showToast('error', err instanceof Error ? err.message : 'Kon bonnetje niet versturen. Probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }, [imageBlob, ocrResult, createCardPayment, navigate, showToast, navState])

  const onSubmitForm = useCallback(async (formData: ReceiptFormData) => {
    // Check if settings are complete
    const hasSettings = settings.employeeName?.trim() && settings.recipientEmail?.trim()
    if (!hasSettings) {
      setPendingFormData(formData)
      setShowSettingsModal(true)
      return
    }
    await sendPayment(formData)
  }, [settings, sendPayment])

  const handleSettingsSaved = async () => {
    setShowSettingsModal(false)
    await loadSettings()
    if (pendingFormData) {
      await sendPayment(pendingFormData)
      setPendingFormData(null)
    }
  }

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
        <h2 className="text-lg font-bold text-gray-900">Nieuw bonnetje kaartbetaling</h2>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className={`flex-1 h-1 rounded-full transition-colors ${
          step === 'capture' ? 'bg-primary-600' : 'bg-primary-600'
        }`} />
        <div className={`flex-1 h-1 rounded-full transition-colors ${
          step === 'form' ? 'bg-primary-600' : 'bg-gray-200'
        }`} />
      </div>

      {/* Camera / file capture */}
      <CameraCapture
        onImageCaptured={onImageCaptured}
        previewUrl={previewUrl}
        isPdf={isPdf}
        onRetake={onRetake}
        capturing={capturing}
      />

      {/* OCR status */}
      {(ocrProcessing || ocrError || ocrResult) && (
        <OcrStatus
          processing={ocrProcessing}
          error={ocrError}
          hasResult={!!ocrResult}
        />
      )}

      {/* Form (shown after photo) */}
      {step === 'form' && (
        <>
          <ReceiptForm
            initialData={ocrResult?.parsed}
            defaultMonth={navState?.month}
            defaultYear={navState?.year}
            onSubmit={onSubmitForm}
            saving={saving}
            submitLabel={
              saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Versturen...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send size={18} />
                  Direct versturen per e-mail
                </span>
              )
            }
          />
        </>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSettingsSaved}
      />
    </div>
  )
}
