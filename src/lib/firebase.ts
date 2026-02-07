import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyC6gq486y7Y2P3QGzft8U01l5OsjGF8AKs",
  authDomain: "super-laura-fb40a.firebaseapp.com",
  projectId: "super-laura-fb40a",
  storageBucket: "super-laura-fb40a.firebasestorage.app",
  messagingSenderId: "589024283",
  appId: "1:589024283:web:15757a92ed4ed2a36b7cbe",
  measurementId: "G-MWP779CPGR"
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)
export const auth = getAuth(app)

/** Get the current user's ID token for Cloud Function auth */
export async function getAuthToken(): Promise<string | undefined> {
  return auth.currentUser?.getIdToken()
}

export default app
