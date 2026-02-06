import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { AddReceiptPage } from '@/pages/AddReceiptPage'
import { ReceiptsOverviewPage } from '@/pages/ReceiptsOverviewPage'
import { ReceiptDetailPage } from '@/pages/ReceiptDetailPage'
import { SubmitMonthPage } from '@/pages/SubmitMonthPage'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/nieuw" element={<AddReceiptPage />} />
            <Route path="/bonnetjes" element={<ReceiptsOverviewPage />} />
            <Route path="/bonnetjes/:id" element={<ReceiptDetailPage />} />
            <Route path="/indienen" element={<SubmitMonthPage />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}
