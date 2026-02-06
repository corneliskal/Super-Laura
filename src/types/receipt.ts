export interface Receipt {
  id: string
  photo_path: string
  photo_url?: string
  store_name: string
  description: string
  amount: number
  vat_amount: number | null
  receipt_date: string // ISO date string YYYY-MM-DD
  category: string
  ocr_raw_text: string | null
  notes: string
  is_submitted: boolean
  submission_id: string | null
  created_at: string
  updated_at: string
}

export interface ReceiptFormData {
  store_name: string
  description: string
  amount: string
  vat_amount: string
  receipt_date: string
  category: string
  notes: string
}

export interface Submission {
  id: string
  month: number
  year: number
  total_amount: number
  receipt_count: number
  status: 'draft' | 'exported' | 'sent'
  created_at: string
}

export interface OcrResult {
  raw_text: string
  confidence: number
  parsed: ParsedReceipt
}

export interface ParsedReceipt {
  store_name: string | null
  amount: number | null
  vat_amount: number | null
  date: string | null // YYYY-MM-DD
}

export const CATEGORIES = [
  { name: 'Boodschappen', icon: '🛒' },
  { name: 'Transport', icon: '🚗' },
  { name: 'Kantoorbenodigdheden', icon: '📎' },
  { name: 'Maaltijden', icon: '🍽️' },
  { name: 'Abonnementen', icon: '📱' },
  { name: 'Overig', icon: '📦' },
] as const

export type CategoryName = typeof CATEGORIES[number]['name']

export const DUTCH_MONTHS = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December',
] as const
