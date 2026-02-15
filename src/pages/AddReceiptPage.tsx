import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const location = useLocation()
  const navState = location.state as { month?: number; year?: number } | null
  const { showToast } = useToast()
  const { imageBlob, previewUrl, capturing, isPdf, handleCapture, reset: resetImage } = useImageCapture()
  const { ocrResult, processing: ocrProcessing, error: ocrError, processImage, reset: resetOcr } = useOcr()
  const { createReceipt } = useReceipts()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'capture' | 'form'>('capture')

  const onImageCaptured = useCallback(async (file: File) => {
    handleCapture(file)

    if (file.type === 'application/pdf') {
      // PDF: send directly to OCR (Gemini can read PDFs)
      await processImage(file)
      setStep('form')
    } else {
      // Image: compress and run OCR
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

  const onSubmitForm = useCallback(async (formData: ReceiptFormData) => {
    if (!imageBlob) {
      showToast('error', 'Geen bestand gevonden. Upload eerst een foto of PDF.')
      return
    }

    setSaving(true)
    try {
      await createReceipt(formData, imageBlob, ocrResult?.raw_text)
      showToast('success', 'Bonnetje opgeslagen! 🎉')
      navigate('/bonnetjes', {
        state: navState ? { month: navState.month, year: navState.year } : undefined,
      })
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
        <ReceiptForm
          initialData={ocrResult?.parsed}
          defaultMonth={navState?.month}
          defaultYear={navState?.year}
          onSubmit={onSubmitForm}
          saving={saving}
        />
      )}
    </div>
  )
}
