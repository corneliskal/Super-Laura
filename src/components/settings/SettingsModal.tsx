import { useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/hooks/useSettings'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const { user } = useAuth()
  const { saveSettings } = useSettings()

  const [employeeName, setEmployeeName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!employeeName.trim()) {
      setError('Vul je naam in')
      return
    }

    if (!bankAccount.trim()) {
      setError('Vul je bankrekeningnummer in')
      return
    }

    if (!recipientEmail.trim()) {
      setError('Vul het ontvanger e-mailadres in')
      return
    }

    // Email validation
    if (!recipientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Vul een geldig e-mailadres in')
      return
    }

    setSaving(true)
    try {
      await saveSettings({
        employeeName: employeeName.trim(),
        bankAccount: bankAccount.trim(),
        recipientEmail: recipientEmail.trim(),
        avatarUrl: '',
      })
      onSave()
    } catch (err) {
      console.error('Error saving settings:', err)
      setError('Kon instellingen niet opslaan. Probeer het opnieuw.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Vul je gegevens in</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-gray-600">
            Deze gegevens worden gebruikt voor je declaraties en kunnen later worden aangepast in de instellingen.
          </p>

          {/* Employee Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naam medewerker *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Je volledige naam zoals die op declaraties moet staan
            </p>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Voornaam Achternaam"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              required
              autoFocus
            />
          </div>

          {/* Bank Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bankrekeningnummer (IBAN) *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Je IBAN voor uitbetaling van declaraties
            </p>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="NL00 BANK 0000000000"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              required
            />
          </div>

          {/* User Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jouw e-mailadres
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Het e-mailadres waarmee je bent ingelogd
            </p>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
            />
          </div>

          {/* Recipient Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ontvanger e-mailadres *
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Naar dit adres worden je bonnetjes en declaraties verstuurd
            </p>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="email@voorbeeld.nl"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Opslaan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
