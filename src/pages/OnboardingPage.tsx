import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Camera, ImagePlus, RotateCcw, ArrowRight, Sparkles, RefreshCw, SkipForward, Check
} from 'lucide-react'
import { compressImage, fileToBase64 } from '@/lib/imageUtils'
import { requestAvatarGeneration } from '@/lib/avatar'
import { useSettings } from '@/hooks/useSettings'

type Step = 'superhero' | 'photo' | 'generating' | 'done' | 'error'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { settings, saveSettings } = useSettings()

  const [step, setStep] = useState<Step>('superhero')
  const [superhero, setSuperhero] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState('Bezig met superkrachten toevoegen...')

  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const handleSkip = () => {
    navigate('/', { replace: true })
  }

  const handleSuperheroNext = () => {
    if (!superhero.trim()) return
    setStep('photo')
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''

    try {
      // Compress at higher quality for face recognition
      const compressed = await compressImage(file, 800, 0.85)
      const base64 = await fileToBase64(compressed)
      setImageBase64(base64)
      setPreviewUrl(URL.createObjectURL(compressed))
    } catch {
      setError('Kon foto niet verwerken')
    }
  }

  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setImageBase64(null)
  }

  const handleGenerate = async () => {
    if (!imageBase64 || !superhero.trim()) return

    setStep('generating')
    setError(null)
    setLoadingText('Bezig met superkrachten toevoegen...')

    // Progress text updates
    const timer1 = setTimeout(() => setLoadingText('Je superheld-outfit wordt ontworpen...'), 4000)
    const timer2 = setTimeout(() => setLoadingText('Bijna klaar...'), 10000)

    try {
      const url = await requestAvatarGeneration(imageBase64, superhero.trim())
      clearTimeout(timer1)
      clearTimeout(timer2)

      setAvatarUrl(url)

      // Update settings with the new avatar URL
      await saveSettings({
        ...settings,
        avatarUrl: url,
      })

      setStep('done')
    } catch (err) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      console.error('Avatar generation failed:', err)
      setError(err instanceof Error ? err.message : 'Avatar generatie mislukt')
      setStep('error')
    }
  }

  const handleRetry = () => {
    setStep('photo')
    setError(null)
  }

  const handleDone = () => {
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col">
      {/* Skip button */}
      {step !== 'done' && step !== 'generating' && (
        <div className="flex justify-end p-4">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Overslaan
            <SkipForward size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          {/* ==================== STEP: SUPERHERO ==================== */}
          {step === 'superhero' && (
            <div className="space-y-6 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg mx-auto">
                <Zap size={40} className="text-white" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">Maak je superheld-avatar!</h1>
                <p className="text-gray-500 mt-2">
                  We maken een persoonlijk cartoon-logo op basis van jouw favoriete superheld en een selfie.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
                <label className="block text-sm font-medium text-gray-700 text-left">
                  Wie is jouw favoriete superheld?
                </label>
                <input
                  type="text"
                  value={superhero}
                  onChange={(e) => setSuperhero(e.target.value)}
                  placeholder="Spider-Man, Wonder Woman, Batman..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSuperheroNext()}
                />

                <button
                  onClick={handleSuperheroNext}
                  disabled={!superhero.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  Volgende
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ==================== STEP: PHOTO ==================== */}
          {step === 'photo' && (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Maak een selfie</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  We gebruiken je foto als basis voor je {superhero}-avatar
                </p>
              </div>

              {previewUrl ? (
                <div className="relative">
                  <img
                    src={previewUrl}
                    alt="Selfie preview"
                    className="w-full rounded-2xl shadow-md max-h-80 object-contain bg-gray-100"
                  />
                  <button
                    onClick={handleRetake}
                    className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-white transition-colors"
                  >
                    <RotateCcw size={20} className="text-gray-700" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    ref={galleryRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <button
                    onClick={() => cameraRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-3 py-10 px-8 bg-white border-2 border-dashed border-purple-300 rounded-2xl cursor-pointer hover:bg-purple-50 transition-colors"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                      <Camera size={30} className="text-white" />
                    </div>
                    <div>
                      <p className="text-gray-800 font-semibold text-lg">Maak een selfie</p>
                      <p className="text-gray-400 text-sm mt-0.5">Open de camera</p>
                    </div>
                  </button>

                  <button
                    onClick={() => galleryRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-purple-300 transition-colors"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <ImagePlus size={20} className="text-purple-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-gray-800 font-medium">Kies uit fotoalbum</p>
                      <p className="text-gray-400 text-xs">Upload een bestaande foto</p>
                    </div>
                  </button>
                </div>
              )}

              {previewUrl && (
                <button
                  onClick={handleGenerate}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Sparkles size={22} />
                  Avatar maken!
                </button>
              )}
            </div>
          )}

          {/* ==================== STEP: GENERATING ==================== */}
          {step === 'generating' && (
            <div className="space-y-8 text-center py-8">
              {/* Animated superhero icon */}
              <div className="relative mx-auto w-32 h-32">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full animate-pulse opacity-30" />
                <div className="absolute inset-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl">
                  <Sparkles size={48} className="text-white animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">{loadingText}</h2>
                <p className="text-gray-400 text-sm mt-2">Dit kan tot 30 seconden duren</p>
              </div>

              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ==================== STEP: DONE ==================== */}
          {step === 'done' && avatarUrl && (
            <div className="space-y-6 text-center py-4">
              <div className="relative mx-auto w-40 h-40">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-300 via-purple-300 to-pink-300 rounded-full animate-pulse opacity-40" />
                <img
                  src={avatarUrl}
                  alt="Jouw superheld avatar"
                  className="relative w-40 h-40 rounded-full object-cover shadow-2xl border-4 border-white"
                />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-gray-900">Wauw! Je avatar is klaar!</h2>
                <p className="text-gray-500 mt-1">
                  Je persoonlijke {superhero}-avatar is opgeslagen
                </p>
              </div>

              <button
                onClick={handleDone}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Check size={22} />
                Ga door naar de app
              </button>
            </div>
          )}

          {/* ==================== STEP: ERROR ==================== */}
          {step === 'error' && (
            <div className="space-y-6 text-center py-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mx-auto">
                <span className="text-4xl">😔</span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-gray-900">Het lukte helaas niet</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  {error || 'Er ging iets mis bij het maken van je avatar'}
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} />
                  Opnieuw proberen
                </button>

                <button
                  onClick={handleSkip}
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <SkipForward size={18} />
                  Overslaan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
