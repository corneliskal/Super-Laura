import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Receipt } from '@/types/receipt'
import { DUTCH_MONTHS } from '@/types/receipt'
import { EMPLOYEE_NAME, BANK_ACCOUNT, COMPANY_NAME } from './constants'
import { formatEuro } from './dateUtils'

function formatDateDutch(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthIdx = parseInt(parts[1]) - 1
  return `${parseInt(parts[2])} ${DUTCH_MONTHS[monthIdx].toLowerCase()}`
}

/**
 * Generate a PDF matching the DE UNIE bonnetjes declaratieformulier layout.
 * Columns: datum | omschrijving | totale vergoeding
 * Returns a Blob ready for download or ZIP inclusion.
 */
interface PdfOptions {
  employeeName?: string
  bankAccount?: string
}

export function generatePdf(receipts: Receipt[], month: number, year: number, options?: PdfOptions): Blob {
  const name = options?.employeeName || EMPLOYEE_NAME
  const bank = options?.bankAccount || BANK_ACCOUNT
  const monthName = DUTCH_MONTHS[month - 1]
  const doc = new jsPDF()

  const now = new Date()
  const todayStr = `${now.getDate()} ${monthName.toLowerCase()} ${year}`

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${COMPANY_NAME} declaratieformulier`, 14, 20)

  // Employee info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`medewerker: ${name}`, 14, 32)
  doc.text(`bank/giro nummer: Priv\u00E9 rekening- ${bank}`, 14, 38)
  doc.text(`datum: ${todayStr}`, 14, 44)

  // Sort by date
  const sorted = [...receipts].sort(
    (a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()
  )

  // Table data
  const tableData = sorted.map((r) => [
    formatDateDutch(r.receipt_date),
    [r.store_name, r.description].filter(Boolean).join(' - '),
    formatEuro(r.amount),
  ])

  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0)

  // Main table
  autoTable(doc, {
    head: [['datum', 'omschrijving', 'totale\nvergoeding']],
    body: tableData,
    startY: 52,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
    },
  })

  // Get Y after table
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 200
  let y = Math.max(finalY + 5, 200)

  // Subtotalen / Voorschot / TOTAAL
  autoTable(doc, {
    body: [
      [{ content: 'Subtotalen', styles: { fontStyle: 'bold' } }, '', formatEuro(totalAmount)],
      ['Af: evt. voorschot', '', formatEuro(0)],
      [{ content: 'TOTAAL', styles: { fontStyle: 'bold' } }, '', { content: formatEuro(totalAmount), styles: { fontStyle: 'bold' } }],
    ],
    startY: y,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'right' },
    },
  })

  const finalY2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y + 40
  y = finalY2 + 15

  // Handtekening
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('handtekening werknemer:', 14, y)
  y += 40

  // Toelichting
  doc.setDrawColor(150)
  doc.line(14, y, 196, y)
  y += 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Toelichting', 14, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(
    'Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie',
    14, y, { maxWidth: 182 }
  )
  y += 8
  doc.text(
    'De vergoedingen worden op basis van de declaraties met het salaris uitbetaald.',
    14, y, { maxWidth: 182 }
  )

  return doc.output('blob')
}
