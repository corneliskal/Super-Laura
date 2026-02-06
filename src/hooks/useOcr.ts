import { useState, useCallback } from 'react'
import { processReceiptOcr } from '@/lib/ocr'
import { fileToBase64 } from '@/lib/imageUtils'
import type { OcrResult } from '@/types/receipt'

interface UseOcrReturn {
  ocrResult: OcrResult | null
  processing: boolean
  error: string | null
  processImage: (imageBlob: Blob) => Promise<OcrResult | null>
  reset: () => void
}

export function useOcr(): UseOcrReturn {
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processImage = useCallback(async (imageBlob: Blob): Promise<OcrResult | null> => {
    setProcessing(true)
    setError(null)
    setOcrResult(null)

    try {
      const base64 = await fileToBase64(imageBlob)
      const result = await processReceiptOcr(base64)
      setOcrResult(result)
      return result
    } catch (err) {
      console.error('OCR error:', err)
      setError('OCR verwerking mislukt. Vul de gegevens handmatig in.')
      return null
    } finally {
      setProcessing(false)
    }
  }, [])

  const reset = useCallback(() => {
    setOcrResult(null)
    setProcessing(false)
    setError(null)
  }, [])

  return { ocrResult, processing, error, processImage, reset }
}
