import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { HomePage } from '@/pages/HomePage'
import { AddReceiptPage } from '@/pages/AddReceiptPage'
import { ReceiptsOverviewPage } from '@/pages/ReceiptsOverviewPage'
import { ReceiptDetailPage } from '@/pages/ReceiptDetailPage'
import { TravelOverviewPage } from '@/pages/TravelOverviewPage'
import { AddTravelPage } from '@/pages/AddTravelPage'
import { TravelDetailPage } from '@/pages/TravelDetailPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { VerifyEmailPage } from '@/pages/VerifyEmailPage'
import { ManagementFeeOverviewPage } from '@/pages/ManagementFeeOverviewPage'
import { ManagementFeeSetupPage } from '@/pages/ManagementFeeSetupPage'
import { CardPaymentsOverviewPage } from '@/pages/CardPaymentsOverviewPage'
import { AddCardPaymentPage } from '@/pages/AddCardPaymentPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Publieke routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registreren" element={<RegisterPage />} />
            <Route path="/wachtwoord-vergeten" element={<ForgotPasswordPage />} />

            {/* Beschermde routes */}
            <Route element={<ProtectedRoute />}>
              {/* Auth flow routes - no AppShell */}
              <Route path="/verify-email" element={<VerifyEmailPage />} />

              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />

                {/* Bonnetjes (Receipts) */}
                <Route path="/nieuw" element={<AddReceiptPage />} />
                <Route path="/bonnetjes" element={<ReceiptsOverviewPage />} />
                <Route path="/bonnetjes/:id" element={<ReceiptDetailPage />} />

                {/* Reiskosten (Travel expenses) */}
                <Route path="/reiskosten" element={<TravelOverviewPage />} />
                <Route path="/reiskosten/nieuw" element={<AddTravelPage />} />
                <Route path="/reiskosten/:id" element={<TravelDetailPage />} />

                {/* Kaartbetalingen (Card Payments) */}
                <Route path="/kaartbetalingen" element={<CardPaymentsOverviewPage />} />
                <Route path="/kaartbetalingen/nieuw" element={<AddCardPaymentPage />} />

                {/* Management Fee */}
                <Route path="/management-fee" element={<ManagementFeeOverviewPage />} />
                <Route path="/management-fee/instellen" element={<ManagementFeeSetupPage />} />

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
