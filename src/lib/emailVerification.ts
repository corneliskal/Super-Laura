import { SEND_VERIFICATION_EMAIL_URL } from './constants'
import { getAuthToken } from './firebase'

export async function sendVerificationEmail(): Promise<void> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Niet ingelogd')
  }

  const response = await fetch(SEND_VERIFICATION_EMAIL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Kon verificatie-e-mail niet versturen')
  }
}
