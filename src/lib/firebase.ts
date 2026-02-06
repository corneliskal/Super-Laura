import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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
export default app
