import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCf49GNUSVnl5Va3waIGFU2WcZsqo8e6Z0",
  authDomain: "the-cork-claude.firebaseapp.com",
  projectId: "the-cork-claude",
  storageBucket: "the-cork-claude.firebasestorage.app",
  messagingSenderId: "315353039539",
  appId: "1:315353039539:web:85f20655096ae78062e6c6",
  measurementId: "G-T2WNRF19ZT"
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
