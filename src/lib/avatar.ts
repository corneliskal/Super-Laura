import { GENERATE_AVATAR_URL } from './constants'
import { getAuthToken } from './firebase'

/**
 * Request avatar generation from the Cloud Function.
 * Sends the face photo (base64) and superhero name to Gemini.
 * Returns the generated avatar download URL.
 */
export async function requestAvatarGeneration(
  faceImageBase64: string,
  superhero: string
): Promise<string> {
  const token = await getAuthToken()

  const response = await fetch(GENERATE_AVATAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ faceImage: faceImageBase64, superhero }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Avatar generatie mislukt')
  }

  return result.avatarUrl
}
