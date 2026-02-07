import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { AddReceiptPage } from '@/pages/AddReceiptPage'
import { ReceiptsOverviewPage } from '@/pages/ReceiptsOverviewPage'
import { ReceiptDetailPage } from '@/pages/ReceiptDetailPage'
import { TravelOverviewPage } from '@/pages/TravelOverviewPage'
import { AddTravelPage } from '@/pages/AddTravelPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />

            {/* Bonnetjes (Receipts) */}
            <Route path="/nieuw" element={<AddReceiptPage />} />
            <Route path="/bonnetjes" element={<ReceiptsOverviewPage />} />
            <Route path="/bonnetjes/:id" element={<ReceiptDetailPage />} />

            {/* Reiskosten (Travel expenses) */}
            <Route path="/reiskosten" element={<TravelOverviewPage />} />
            <Route path="/reiskosten/nieuw" element={<AddTravelPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
