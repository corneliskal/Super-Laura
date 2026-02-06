import { useState, useCallback, useRef } from 'react'
import { compressImage, createPreviewUrl } from '@/lib/imageUtils'

interface UseImageCaptureReturn {
  imageBlob: Blob | null
  previewUrl: string | null
  capturing: boolean
  error: string | null
  handleCapture: (file: File) => Promise<void>
  reset: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  triggerCapture: () => void
}

export function useImageCapture(): UseImageCaptureReturn {
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleCapture = useCallback(async (file: File) => {
    setCapturing(true)
    setError(null)

    try {
      // Compress the image
      const compressed = await compressImage(file)
      const url = createPreviewUrl(compressed)

      // Clean up previous preview URL
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })

      setImageBlob(compressed)
    } catch (err) {
      console.error('Image capture error:', err)
      setError('Kon de foto niet verwerken. Probeer opnieuw.')
    } finally {
      setCapturing(false)
    }
  }, [])

  const reset = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setImageBlob(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [])

  const triggerCapture = useCallback(() => {
    inputRef.current?.click()
  }, [])

  return {
    imageBlob,
    previewUrl,
    capturing,
    error,
    handleCapture,
    reset,
    inputRef,
    triggerCapture,
  }
}
