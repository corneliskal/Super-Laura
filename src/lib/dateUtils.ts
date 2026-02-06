import { DUTCH_MONTHS } from '@/types/receipt'

/**
 * Format a date string (YYYY-MM-DD) to Dutch format (6 februari 2026)
 */
export function formatDateDutch(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDate()
  const month = DUTCH_MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month.toLowerCase()} ${year}`
}

/**
 * Format a date string to short Dutch format (6 feb)
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDate()
  const month = DUTCH_MONTHS[date.getMonth()].slice(0, 3).toLowerCase()
  return `${day} ${month}`
}

/**
 * Format amount as EUR currency (Dutch style: € 12,50)
 */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Get current month and year
 */
export function currentMonthYear(): { month: number; year: number } {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}
