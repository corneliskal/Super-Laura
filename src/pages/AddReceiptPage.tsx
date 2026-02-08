import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { CameraCapture } from '@/components/receipt/CameraCapture'
import { OcrStatus } from '@/components/receipt/OcrStatus'
import { ReceiptForm } from '@/components/receipt/ReceiptForm'
import { useImageCapture } from '@/hooks/useImageCapture'
import { useOcr } from '@/hooks/useOcr'
import { useReceipts } from '@/hooks/useReceipts'
import { useToast } from '@/components/ui/Toast'
import { compressImage } from '@/lib/imageUtils'
import type { ReceiptFormData } from '@/types/receipt'

export function AddReceiptPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { imageBlob, previewUrl, capturing, handleCapture, reset: resetImage } = useImageCapture()
  const { ocrResult, processing: ocrProcessing, error: ocrError, processImage, reset: resetOcr } = useOcr()
  const { createReceipt } = useReceipts()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'capture' | 'form'>('capture')

  const onImageCaptured = useCallback(async (file: File) => {
    const compressed = await compressImage(file)
    handleCapture(file)

    // Start OCR processing
    const result = await processImage(compressed)
    if (result) {
      setStep('form')
    } else {
      // Even if OCR fails, show the form for manual entry
      setStep('form')
    }
  }, [handleCapture, processImage])

  const onRetake = useCallback(() => {
    resetImage()
    resetOcr()
    setStep('capture')
  }, [resetImage, resetOcr])

  const onSubmitForm = useCallback(async (formData: ReceiptFormData) => {
    if (!imageBlob) {
      showToast('error', 'Geen foto gevonden. Maak eerst een foto.')
      return
    }

    setSaving(true)
    try {
      await createReceipt(formData, imageBlob, ocrResult?.raw_text)
      showToast('success', 'Bonnetje opgeslagen! 🎉')
      navigate('/bonnetjes')
    } catch (err) {
      console.error('Save error:', err)
      showToast('error', 'Kon bonnetje niet opslaan. Probeer opnieuw.')
    } finally {
      setSaving(false)
    }
  }, [imageBlob, ocrResult, createReceipt, navigate, showToast])

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
        <h2 className="text-lg font-bold text-gray-900">Nieuw bonnetje</h2>
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

      {/* Camera capture */}
      <CameraCapture
        onImageCaptured={onImageCaptured}
        previewUrl={previewUrl}
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
        <ReceiptForm
          initialData={ocrResult?.parsed}
          onSubmit={onSubmitForm}
          saving={saving}
        />
      )}
    </div>
  )
}
