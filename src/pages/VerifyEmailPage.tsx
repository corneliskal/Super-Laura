import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Mail, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { sendVerificationEmail } from '@/lib/emailVerification'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { APP_NAME } from '@/lib/constants'

export function VerifyEmailPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Auto-check every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (user) {
        try {
          const ref = doc(db, 'email_verifications', user.uid)
          const snap = await getDoc(ref)
          if (snap.exists() && snap.data().verified === true) {
            navigate('/', { replace: true })
          }
        } catch (err) {
          console.error('Auto-check verification error:', err)
        }
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [user, navigate])

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleCheckVerification = async () => {
    if (!user) return

    setChecking(true)
    setError(null)
    try {
      const ref = doc(db, 'email_verifications', user.uid)
      const snap = await getDoc(ref)

      if (snap.exists() && snap.data().verified === true) {
        navigate('/', { replace: true })
      } else {
        setError('Je e-mailadres is nog niet geverifieerd. Check je inbox.')
      }
    } catch (err) {
      setError('Kon verificatiestatus niet controleren')
    } finally {
      setChecking(false)
    }
  }

  const handleResendEmail = async () => {
    if (!user || resendCooldown > 0) return

    setResending(true)
    setError(null)
    setMessage(null)
    try {
      await sendVerificationEmail()
      setMessage('Verificatie-e-mail opnieuw verstuurd!')
      setResendCooldown(60)
    } catch (err: any) {
      setError(err.message || 'Kon e-mail niet versturen. Probeer het opnieuw.')
    } finally {
      setResending(false)
    }
  }

  const handleBackToLogin = async () => {
    await logout()
    navigate('/login')
  }

  if (!user) {
    return null // Should not happen, ProtectedRoute handles this
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + App name */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-24 mx-auto drop-shadow-lg object-contain"
          />
          <h1 className="mt-3 text-xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-500 text-sm mt-1">Bevestig je e-mailadres</p>
        </div>

        {/* Info card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Mail size={20} className="text-primary-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 mb-1">Verificatie e-mail verstuurd</h2>
              <p className="text-sm text-gray-600">
                We hebben een verificatielink gestuurd naar:
              </p>
              <p className="text-sm font-medium text-gray-900 mt-1">{user.email}</p>
            </div>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900 mb-1">Volgende stappen:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open de e-mail in je inbox</li>
              <li>Klik op de verificatielink</li>
              <li>Kom terug en klik op "Ik heb geverifieerd"</li>
            </ol>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-600">{message}</p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {checking ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Controleren...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  Ik heb mijn e-mail geverifieerd
                </>
              )}
            </button>

            <button
              onClick={handleResendEmail}
              disabled={resending || resendCooldown > 0}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              {resending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Versturen...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <Mail size={16} />
                  Opnieuw versturen ({resendCooldown}s)
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Verificatie e-mail opnieuw versturen
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            Geen e-mail ontvangen? Check je spam folder.
          </p>

          <p className="text-xs text-gray-500 text-center pt-1 border-t border-gray-100 mt-4">
            <button
              onClick={handleBackToLogin}
              className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              Inloggen of registreren met een ander e-mailadres
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
