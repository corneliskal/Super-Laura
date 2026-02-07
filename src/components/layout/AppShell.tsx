import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1 pb-8 max-w-lg mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
