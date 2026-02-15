import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { sendVerificationEmail as sendCustomVerificationEmail } from '@/lib/emailVerification'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  reloadUser: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const register = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
    // Send custom verification email via Gmail
    await sendCustomVerificationEmail()
    // User stays logged in but unverified - ProtectedRoute will handle redirect
  }

  const logout = async () => {
    await signOut(auth)
  }

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload()
      setUser({ ...auth.currentUser })
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !user?.email) {
      throw new Error('Geen gebruiker ingelogd')
    }
    // Re-authenticate user before password change (Firebase security requirement)
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(auth.currentUser, credential)
    // Update password
    await updatePassword(auth.currentUser, newPassword)
  }

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, reloadUser, changePassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}
