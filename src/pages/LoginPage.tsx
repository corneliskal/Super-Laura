import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/lib/constants'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Already logged in → redirect to home
  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        setError('Onjuist e-mailadres of wachtwoord')
      } else if (code === 'auth/too-many-requests') {
        setError('Te veel pogingen. Probeer het later opnieuw.')
      } else if (code === 'auth/invalid-email') {
        setError('Ongeldig e-mailadres')
      } else {
        setError('Inloggen mislukt. Probeer het opnieuw.')
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
          <p className="text-gray-500 text-sm mt-1">Log in om verder te gaan</p>
        </div>

        {/* Login form */}
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
              placeholder="Wachtwoord"
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            <div className="mt-2 text-right">
              <Link
                to="/wachtwoord-vergeten"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Wachtwoord vergeten?
              </Link>
            </div>
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
                <Loader2 size={18} className="animate-spin" />
                Inloggen...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Inloggen
              </>
            )}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500">
          Nog geen account?{' '}
          <Link to="/registreren" className="text-primary-600 font-medium hover:text-primary-700">
            Registreren
          </Link>
        </p>
      </div>
    </div>
  )
}
