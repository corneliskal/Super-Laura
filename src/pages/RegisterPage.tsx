import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Loader2, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/constants'

export function RegisterPage() {
  const { user, loading, register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already logged in → redirect to home
  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side password match check
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen')
      return
    }

    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens zijn')
      return
    }

    setSubmitting(true)
    try {
      await register(email, password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Dit e-mailadres is al in gebruik')
      } else if (code === 'auth/weak-password') {
        setError('Wachtwoord moet minimaal 6 tekens zijn')
      } else if (code === 'auth/invalid-email') {
        setError('Ongeldig e-mailadres')
      } else {
        setError('Registratie mislukt. Probeer het opnieuw.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo + App name */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Super-Laura"
            className="h-24 mx-auto drop-shadow-lg object-contain"
          />
          <h1 className="mt-3 text-xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-500 text-sm mt-1">Maak een nieuw account aan</p>
        </div>

        {/* Register form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimaal 6 tekens"
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              Wachtwoord bevestigen
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Herhaal wachtwoord"
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <p className="text-xs text-gray-500 text-center">
            Na registratie ontvang je een verificatie-e-mail om je account te activeren
          </p>

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
                <Loader2 size={18} className="animate-spin" />
                Registreren...
              </>
            ) : (
              <>
                <UserPlus size={18} />
                Registreren
              </>
            )}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-sm text-gray-500">
          Al een account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
