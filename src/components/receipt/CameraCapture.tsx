import { Camera, RotateCcw, Loader2 } from 'lucide-react'
import { useImageCapture } from '@/hooks/useImageCapture'

interface CameraCaptureProps {
  onImageCaptured: (file: File) => void
  previewUrl: string | null
  onRetake: () => void
  capturing: boolean
}

export function CameraCapture({
  onImageCaptured,
  previewUrl,
  onRetake,
  capturing,
}: CameraCaptureProps) {
  const { inputRef } = useImageCapture()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Quick check: is it an image?
    if (!file.type.startsWith('image/')) {
      return
    }

    onImageCaptured(file)
  }

  if (previewUrl) {
    return (
      <div className="relative">
        <img
          src={previewUrl}
          alt="Bonnetje preview"
          className="w-full rounded-2xl shadow-md max-h-80 object-contain bg-gray-100"
        />
        <button
          onClick={onRetake}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-colors"
          title="Opnieuw"
        >
          <RotateCcw size={20} className="text-gray-700" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="camera-input"
      />
      <label
        htmlFor="camera-input"
        className="flex flex-col items-center justify-center gap-4 py-16 px-8 bg-primary-50 border-2 border-dashed border-primary-300 rounded-2xl cursor-pointer hover:bg-primary-100 transition-colors"
      >
        {capturing ? (
          <>
            <Loader2 size={48} className="text-primary-500 animate-spin" />
            <span className="text-primary-700 font-medium">Foto verwerken...</span>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center shadow-lg">
              <Camera size={36} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-primary-700 font-semibold text-lg">Maak een foto</p>
              <p className="text-primary-500 text-sm mt-1">
                Fotografeer je bonnetje of factuur
              </p>
            </div>
          </>
        )}
      </label>
    </div>
  )
}
