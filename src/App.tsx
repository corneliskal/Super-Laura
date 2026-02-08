import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { HomePage } from '@/pages/HomePage'
import { AddReceiptPage } from '@/pages/AddReceiptPage'
import { ReceiptsOverviewPage } from '@/pages/ReceiptsOverviewPage'
import { ReceiptDetailPage } from '@/pages/ReceiptDetailPage'
import { TravelOverviewPage } from '@/pages/TravelOverviewPage'
import { AddTravelPage } from '@/pages/AddTravelPage'
import { SettingsPage } from '@/pages/SettingsPage'
// GEDEACTIVEERD: Superheld Avatar feature (geparkeerd)
// import { OnboardingPage } from '@/pages/OnboardingPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Publieke routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registreren" element={<RegisterPage />} />

            {/* Beschermde routes */}
            <Route element={<ProtectedRoute />}>
              {/* GEDEACTIVEERD: Superheld Avatar onboarding (geparkeerd)
              <Route path="/onboarding" element={<OnboardingPage />} />
              */}

              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />

                {/* Bonnetjes (Receipts) */}
                <Route path="/nieuw" element={<AddReceiptPage />} />
                <Route path="/bonnetjes" element={<ReceiptsOverviewPage />} />
                <Route path="/bonnetjes/:id" element={<ReceiptDetailPage />} />

                {/* Reiskosten (Travel expenses) */}
                <Route path="/reiskosten" element={<TravelOverviewPage />} />
                <Route path="/reiskosten/nieuw" element={<AddTravelPage />} />

                {/* Instellingen (Settings) */}
                <Route path="/instellingen" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
