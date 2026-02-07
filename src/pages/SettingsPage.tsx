import { useState, useEffect } from 'react'
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
    </div>
  )
}
