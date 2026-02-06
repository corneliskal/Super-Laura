import type { ParsedReceipt } from '@/types/receipt'

/**
 * Parse raw OCR text from a Dutch receipt into structured data.
 */
export function parseReceiptText(rawText: string): ParsedReceipt {
  return {
    store_name: extractStoreName(rawText),
    amount: extractAmount(rawText),
    vat_amount: extractVatAmount(rawText),
    date: extractDate(rawText),
  }
}

// Known Dutch store names for fuzzy matching
const KNOWN_STORES = [
  'Albert Heijn', 'AH', 'Jumbo', 'Lidl', 'Aldi', 'Plus', 'Dirk',
  'HEMA', 'Action', 'Kruidvat', 'Etos', 'Blokker', 'Praxis',
  'Gamma', 'IKEA', 'MediaMarkt', 'Coolblue',
  'Shell', 'BP', 'Esso', 'TotalEnergies', 'Tango',
  'Spar', 'Coop', 'DekaMarkt', 'Vomar', 'Hoogvliet',
  'Xenos', 'Wibra', 'Zeeman', 'Primark', 'H&M',
  'Bruna', 'Primera', 'Intertoys', 'Bart Smit',
  'McDonald', 'Burger King', 'KFC', 'Subway',
]

function extractStoreName(text: string): string | null {
  const upperText = text.toUpperCase()

  // Try to match a known store name
  for (const store of KNOWN_STORES) {
    if (upperText.includes(store.toUpperCase())) {
      return store
    }
  }

  // Fall back to first non-empty line (often the store name on receipts)
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length > 0) {
    const firstLine = lines[0]
    // Only use first line if it looks like a name (not a date/number)
    if (firstLine.length > 2 && firstLine.length < 40 && !/^\d+[\/\-.]/.test(firstLine)) {
      return firstLine
    }
  }

  return null
}

function extractAmount(text: string): number | null {
  // Dutch receipts use comma as decimal separator
  const patterns = [
    /(?:TOTAAL|TE BETALEN|TOTAL|BEDRAG|PIN|PINNEN|CONTANT)\s*[:.]?\s*(?:EUR\s*)?[€]?\s*(\d+)[,.](\d{2})/i,
    /(?:TOTAAL|TE BETALEN|TOTAL|BEDRAG)\s*[:.]?\s*[€]\s*(\d+)[,.](\d{2})/i,
    /[€]\s*(\d+)[,.](\d{2})\s*$/m,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const euros = parseInt(match[1], 10)
      const cents = parseInt(match[2], 10)
      return euros + cents / 100
    }
  }

  // Last resort: find the largest amount on the receipt (likely the total)
  const allAmounts: number[] = []
  const amountRegex = /(\d{1,6})[,.](\d{2})/g
  let m
  while ((m = amountRegex.exec(text)) !== null) {
    const val = parseInt(m[1], 10) + parseInt(m[2], 10) / 100
    if (val > 0 && val < 100000) {
      allAmounts.push(val)
    }
  }

  if (allAmounts.length > 0) {
    return Math.max(...allAmounts)
  }

  return null
}

function extractVatAmount(text: string): number | null {
  const patterns = [
    /BTW\s*(?:21%?)?\s*[:.]?\s*(?:EUR\s*)?[€]?\s*(\d+)[,.](\d{2})/i,
    /BTW\s*(?:9%?)?\s*[:.]?\s*(?:EUR\s*)?[€]?\s*(\d+)[,.](\d{2})/i,
    /BTW\s+(\d+)[,.](\d{2})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return parseInt(match[1], 10) + parseInt(match[2], 10) / 100
    }
  }

  return null
}

const DUTCH_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, mei: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, dec: 12,
}

function extractDate(text: string): string | null {
  // Pattern: DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const numericDate = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/)
  if (numericDate) {
    const day = numericDate[1].padStart(2, '0')
    const month = numericDate[2].padStart(2, '0')
    const year = numericDate[3]
    const monthNum = parseInt(month, 10)
    const dayNum = parseInt(day, 10)
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`
    }
  }

  // Pattern: DD-MM-YY
  const shortYear = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/)
  if (shortYear) {
    const day = shortYear[1].padStart(2, '0')
    const month = shortYear[2].padStart(2, '0')
    const year = `20${shortYear[3]}`
    const monthNum = parseInt(month, 10)
    const dayNum = parseInt(day, 10)
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      return `${year}-${month}-${day}`
    }
  }

  // Pattern: "6 feb 2026" or "6 februari 2026"
  const dutchDate = text.match(
    /(\d{1,2})\s+(jan|feb|mrt|maa|apr|mei|jun|jul|aug|sep|okt|nov|dec)\w*\s+(\d{4})/i
  )
  if (dutchDate) {
    const day = dutchDate[1].padStart(2, '0')
    const monthStr = dutchDate[2].toLowerCase().slice(0, 3)
    const monthNum = DUTCH_MONTHS[monthStr]
    const year = dutchDate[3]
    if (monthNum) {
      return `${year}-${String(monthNum).padStart(2, '0')}-${day}`
    }
  }

  // Default to today
  return null
}
