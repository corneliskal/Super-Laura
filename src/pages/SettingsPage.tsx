import { useState, useEffect } from 'react'
// GEDEACTIVEERD: Link en Sparkles waren voor Superheld Avatar feature
// import { Link } from 'react-router-dom'
// import { Sparkles } from 'lucide-react'
import { Save } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/ui/Toast'

export function SettingsPage() {
  const { settings, loading, saveSettings } = useSettings()
  const { showToast } = useToast()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loading) {
      setRecipientEmail(settings.recipientEmail)
      setEmployeeName(settings.employeeName)
    }
  }, [loading, settings])

  const handleSave = async () => {
    if (!recipientEmail.trim()) {
      showToast('error', 'Vul een e-mailadres in')
      return
    }

    setSaving(true)
    try {
      await saveSettings({
        recipientEmail: recipientEmail.trim(),
        employeeName: employeeName.trim(),
        avatarUrl: settings.avatarUrl,
      })
      showToast('success', 'Instellingen opgeslagen')
    } catch (err) {
      console.error('Error saving settings:', err)
      showToast('error', 'Kon instellingen niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Instellingen</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ontvanger e-mailadres *
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Naar dit adres worden bonnetjes en reiskosten verstuurd
          </p>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="email@voorbeeld.nl"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Naam medewerker
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Wordt gebruikt in de e-mail onderwerpregel en declaratieformulieren
          </p>
          <input
            type="text"
            value={employeeName}
            onChange={(e) => setEmployeeName(e.target.value)}
            placeholder="Voornaam Achternaam"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Save size={18} />
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>

      {/* GEDEACTIVEERD: Superheld Avatar feature (geparkeerd)
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Superheld Avatar</h3>
        <div className="flex items-center gap-4">
          <img
            src={settings.avatarUrl || '/logo.png'}
            alt="Avatar"
            className={`w-16 h-16 ${settings.avatarUrl ? 'rounded-full border-2 border-purple-200' : ''} object-cover`}
          />
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-2">
              {settings.avatarUrl
                ? 'Je hebt een persoonlijke superheld-avatar'
                : 'Je gebruikt het standaard logo'
              }
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              <Sparkles size={14} />
              {settings.avatarUrl ? 'Avatar opnieuw maken' : 'Avatar maken'}
            </Link>
          </div>
        </div>
      </div>
      */}
    </div>
  )
}
