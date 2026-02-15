import { useState, useEffect } from 'react'
// GEDEACTIVEERD: Link en Sparkles waren voor Superheld Avatar feature
// import { Link } from 'react-router-dom'
// import { Sparkles } from 'lucide-react'
import { Save, Lock, Eye, EyeOff } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'

export function SettingsPage() {
  const { user, changePassword } = useAuth()
  const { settings, loading, saveSettings } = useSettings()
  const { showToast } = useToast()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [employeeName, setEmployeeName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [saving, setSaving] = useState(false)

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (!loading) {
      setRecipientEmail(settings.recipientEmail)
      setEmployeeName(settings.employeeName)
      setBankAccount(settings.bankAccount)
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
        bankAccount: bankAccount.trim(),
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

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('error', 'Vul alle wachtwoord velden in')
      return
    }

    if (newPassword.length < 6) {
      showToast('error', 'Nieuw wachtwoord moet minimaal 6 tekens zijn')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('error', 'Nieuwe wachtwoorden komen niet overeen')
      return
    }

    setChangingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      showToast('success', 'Wachtwoord succesvol gewijzigd')
      // Reset form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)
    } catch (err: any) {
      console.error('Error changing password:', err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showToast('error', 'Huidig wachtwoord is onjuist')
      } else {
        showToast('error', 'Kon wachtwoord niet wijzigen')
      }
    } finally {
      setChangingPassword(false)
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
        {/* Account email info */}
        {user?.email && (
          <div className="pb-4 border-b border-gray-100">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Account e-mailadres
            </label>
            <p className="text-sm text-gray-700">{user.email}</p>
          </div>
        )}

        {/* Password change section */}
        <div className="pb-4 border-b border-gray-100">
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
          >
            <Lock size={16} />
            {showPasswordChange ? 'Annuleer wachtwoord wijzigen' : 'Wachtwoord wijzigen'}
          </button>

          {showPasswordChange && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Huidig wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nieuw wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimaal 6 tekens</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Bevestig nieuw wachtwoord
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handlePasswordChange}
                disabled={changingPassword}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Lock size={16} />
                {changingPassword ? 'Wijzigen...' : 'Wachtwoord wijzigen'}
              </button>
            </div>
          )}
        </div>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Bankrekeningnummer (IBAN)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Wordt gebruikt op de declaratieformulieren
          </p>
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            placeholder="NL00 BANK 0000000000"
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
