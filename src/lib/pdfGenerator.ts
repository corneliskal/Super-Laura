import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Receipt } from '@/types/receipt'
import { DUTCH_MONTHS } from '@/types/receipt'
import { USER_NAME } from './constants'
import { formatEuro } from './dateUtils'

/**
 * Generate a PDF overview of receipts for a given month.
 * Returns a Blob ready for download or ZIP inclusion.
 */
export function generatePdf(receipts: Receipt[], month: number, year: number): Blob {
  const monthName = DUTCH_MONTHS[month - 1]
  const doc = new jsPDF()

  // Title
  doc.setFontSize(18)
  doc.text(`Bonnetjesoverzicht`, 14, 22)

  doc.setFontSize(12)
  doc.text(`${monthName} ${year}`, 14, 30)

  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Ingediend door: ${USER_NAME}`, 14, 37)
  doc.text(`Datum: ${new Date().toLocaleDateString('nl-NL')}`, 14, 43)
  doc.setTextColor(0)

  // Sort by date
  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  )

  // Table
  const tableData = sorted.map((r, i) => [
    String(i + 1),
    formatDutchDateShort(r.receipt_date),
    r.store_name || '-',
    r.description || '-',
    r.category || '-',
    formatEuro(r.amount),
    r.vat_amount ? formatEuro(r.vat_amount) : '-',
  ])

  // Totals
  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)
  const totalVat = receipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0)

  tableData.push([
    '',
    '',
    '',
    '',
    'TOTAAL',
    formatEuro(totalAmount),
    totalVat ? formatEuro(totalVat) : '-',
  ])

  autoTable(doc, {
    head: [['Nr', 'Datum', 'Winkel', 'Omschrijving', 'Categorie', 'Bedrag', 'BTW']],
    body: tableData,
    startY: 50,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [124, 58, 237], // primary-600
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 243, 255], // primary-50
    },
    // Bold the totals row
    didParseCell(data) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [237, 233, 254] // primary-100
      }
    },
  })

  // Summary at bottom
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 200
  doc.setFontSize(10)
  doc.text(`Aantal bonnetjes: ${receipts.length}`, 14, finalY + 15)
  doc.text(`Totaal bedrag: ${formatEuro(totalAmount)}`, 14, finalY + 22)

  return doc.output('blob')
}

function formatDutchDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })
}
