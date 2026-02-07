import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { RECIPIENT_EMAIL, EMPLOYEE_NAME } from '@/lib/constants'

export interface UserSettings {
  recipientEmail: string
  employeeName: string
}

const DEFAULTS: UserSettings = {
  recipientEmail: RECIPIENT_EMAIL,
  employeeName: EMPLOYEE_NAME,
}

function getSettingsDocRef() {
  const uid = auth.currentUser?.uid
  if (!uid) return null
  return doc(db, 'users', uid, 'settings', 'profile')
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const loadSettings = useCallback(async () => {
    const ref = getSettingsDocRef()
    if (!ref) {
      setLoading(false)
      return
    }

    try {
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const data = snap.data()
        setSettings({
          recipientEmail: (data.recipientEmail as string) || DEFAULTS.recipientEmail,
          employeeName: (data.employeeName as string) || DEFAULTS.employeeName,
        })
      }
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const saveSettings = useCallback(async (newSettings: UserSettings) => {
    const ref = getSettingsDocRef()
    if (!ref) throw new Error('Niet ingelogd')

    await setDoc(ref, {
      recipientEmail: newSettings.recipientEmail,
      employeeName: newSettings.employeeName,
    })

    setSettings(newSettings)
  }, [])

  return { settings, loading, saveSettings, loadSettings }
}
