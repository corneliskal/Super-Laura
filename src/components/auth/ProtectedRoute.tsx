import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [checkingVerification, setCheckingVerification] = useState(true)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    async function checkVerificationStatus() {
      if (!user) {
        setCheckingVerification(false)
        return
      }

      // Skip check for verify-email route
      if (location.pathname === '/verify-email') {
        setCheckingVerification(false)
        return
      }

      try {
        // Check custom verification status in Firestore
        const ref = doc(db, 'email_verifications', user.uid)
        const snap = await getDoc(ref)

        if (snap.exists()) {
          const data = snap.data()
          setIsVerified(data.verified === true)
        } else {
          setIsVerified(false)
        }
      } catch (err) {
        console.error('Error checking verification status:', err)
        setIsVerified(false)
      } finally {
        setCheckingVerification(false)
      }
    }

    if (!loading) {
      checkVerificationStatus()
    }
  }, [user, loading, location.pathname])

  if (loading || checkingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    )
  }

  // Gate 1: Must be authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Gate 2: Email must be verified
  if (!isVerified && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />
  }

  return <Outlet />
}
