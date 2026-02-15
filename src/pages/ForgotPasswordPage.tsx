import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/constants'

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await resetPassword(email)
      setEmailSent(true)
    } catch (err: any) {
      console.error('Error sending password reset email:', err)
      if (err.code === 'auth/user-not-found') {
        setError('Geen account gevonden met dit e-mailadres')
      } else if (err.code === 'auth/invalid-email') {
        setError('Ongeldig e-mailadres')
      } else {
        setError('Kon reset e-mail niet versturen. Probeer het opnieuw.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle className="text-green-600" size={32} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">E-mail verstuurd!</h2>
            <p className="text-sm text-gray-600">
              We hebben een wachtwoord reset link gestuurd naar <strong>{email}</strong>.
            </p>
            <p className="text-xs text-gray-500">
              Check je inbox en spam folder. De link is 1 uur geldig.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors mt-4"
            >
              <ArrowLeft size={16} />
              Terug naar inloggen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + App name */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="De Unie Form"
            className="h-24 mx-auto drop-shadow-lg object-contain"
          />
          <h1 className="mt-3 text-xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-500 text-sm mt-1">Wachtwoord opnieuw instellen</p>
        </div>

        {/* Reset form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <p className="text-sm text-gray-600">
            Vul je e-mailadres in en we sturen je een link om je wachtwoord opnieuw in te stellen.
          </p>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="laura@voorbeeld.nl"
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Mail size={18} className="animate-pulse" />
                Versturen...
              </>
            ) : (
              <>
                <Mail size={18} />
                Verstuur reset link
              </>
            )}
          </button>
        </form>

        {/* Back to login link */}
        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700 inline-flex items-center gap-1">
            <ArrowLeft size={14} />
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
