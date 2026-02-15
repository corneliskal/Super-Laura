import { useRef } from 'react'
import { Camera, ImagePlus, FileText, RotateCcw, Loader2 } from 'lucide-react'

interface CameraCaptureProps {
  onImageCaptured: (file: File) => void
  previewUrl: string | null
  isPdf?: boolean
  onRetake: () => void
  capturing: boolean
}

export function CameraCapture({
  onImageCaptured,
  previewUrl,
  isPdf,
  onRetake,
  capturing,
}: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return
    }

    onImageCaptured(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  if (previewUrl) {
    return (
      <div className="relative">
        {isPdf ? (
          <div className="w-full rounded-2xl shadow-md bg-gray-100 flex flex-col items-center justify-center py-12 gap-3">
            <FileText size={48} className="text-red-500" />
            <p className="text-sm font-medium text-gray-700">PDF bestand geüpload</p>
          </div>
        ) : (
          <img
            src={previewUrl}
            alt="Bonnetje preview"
            className="w-full rounded-2xl shadow-md max-h-80 object-contain bg-gray-100"
          />
        )}
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

  if (capturing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 bg-primary-50 border-2 border-dashed border-primary-300 rounded-2xl">
        <Loader2 size={48} className="text-primary-500 animate-spin" />
        <span className="text-primary-700 font-medium">Foto verwerken...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex flex-col items-center justify-center gap-3 py-10 px-8 bg-primary-50 border-2 border-dashed border-primary-300 rounded-2xl cursor-pointer hover:bg-primary-100 transition-colors"
      >
        <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg">
          <Camera size={30} className="text-white" />
        </div>
        <div className="text-center">
          <p className="text-primary-700 font-semibold text-lg">Maak een foto</p>
          <p className="text-primary-500 text-sm mt-0.5">Open de camera</p>
        </div>
      </button>

      {/* Gallery / file buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => galleryInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-3 py-4 px-4 bg-white border-2 border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-primary-300 transition-colors"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <ImagePlus size={20} className="text-primary-600" />
          </div>
          <div className="text-left">
            <p className="text-gray-800 font-medium text-sm">Fotoalbum</p>
            <p className="text-gray-400 text-xs">Upload foto</p>
          </div>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-3 py-4 px-4 bg-white border-2 border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-red-300 transition-colors"
        >
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
            <FileText size={20} className="text-red-500" />
          </div>
          <div className="text-left">
            <p className="text-gray-800 font-medium text-sm">PDF bestand</p>
            <p className="text-gray-400 text-xs">Upload PDF</p>
          </div>
        </button>
      </div>
    </div>
  )
}
