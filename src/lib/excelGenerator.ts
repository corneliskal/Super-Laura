import * as XLSX from 'xlsx'
import type { Receipt } from '@/types/receipt'
import { DUTCH_MONTHS } from '@/types/receipt'
import { USER_NAME } from './constants'

/**
 * Generate an Excel (.xlsx) file from receipt data for a given month.
 * Returns a Blob ready for download or ZIP inclusion.
 */
export function generateExcel(receipts: Receipt[], month: number, year: number): Blob {
  const monthName = DUTCH_MONTHS[month - 1]

  // Prepare header row
  const headers = ['Nr', 'Datum', 'Winkel', 'Omschrijving', 'Categorie', 'Bedrag (EUR)', 'BTW (EUR)']

  // Prepare data rows sorted by date
  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  )

  const rows = sorted.map((r, i) => [
    i + 1,
    formatDutchDate(r.receipt_date),
    r.store_name || '',
    r.description || '',
    r.category || '',
    r.amount,
    r.vat_amount ?? '',
  ])

  // Add totals row
  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
  const totalVat = receipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0)
  rows.push([
    '',
    '',
    '',
    '',
    'TOTAAL',
    totalAmount,
    totalVat || '',
  ])

  // Create worksheet
  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // Nr
    { wch: 14 },  // Datum
    { wch: 20 },  // Winkel
    { wch: 30 },  // Omschrijving
    { wch: 18 },  // Categorie
    { wch: 14 },  // Bedrag
    { wch: 12 },  // BTW
  ]

  // Format amount columns as numbers with 2 decimals
  const amountCol = 5 // F column (0-indexed)
  const vatCol = 6    // G column
  for (let row = 1; row <= rows.length; row++) {
    const amountCell = XLSX.utils.encode_cell({ r: row, c: amountCol })
    const vatCell = XLSX.utils.encode_cell({ r: row, c: vatCol })
    if (ws[amountCell] && typeof ws[amountCell].v === 'number') {
      ws[amountCell].z = '#,##0.00'
    }
    if (ws[vatCell] && typeof ws[vatCell].v === 'number') {
      ws[vatCell].z = '#,##0.00'
    }
  }

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`)

  // Add a summary sheet
  const summaryData = [
    ['Bonnetjesoverzicht'],
    [],
    ['Maand', `${monthName} ${year}`],
    ['Ingediend door', USER_NAME],
    ['Aantal bonnetjes', receipts.length],
    ['Totaal bedrag', totalAmount],
    ['Totaal BTW', totalVat],
    [],
    ['Gegenereerd op', new Date().toLocaleDateString('nl-NL')],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Samenvatting')

  // Write to buffer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function formatDutchDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
