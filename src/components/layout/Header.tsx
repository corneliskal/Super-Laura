import { APP_NAME } from '@/lib/constants'

interface HeaderProps {
  title?: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
      <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
        <h1 className="text-lg font-bold tracking-tight">
          {title || APP_NAME}
        </h1>
      </div>
    </header>
  )
}
