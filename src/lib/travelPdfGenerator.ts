import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TravelExpense } from '@/types/receipt'
import { DUTCH_MONTHS, KM_RATE } from '@/types/receipt'
import { EMPLOYEE_NAME, BANK_ACCOUNT, COMPANY_NAME } from './constants'
import { formatEuro } from './dateUtils'

function formatDateDutch(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const monthIdx = parseInt(parts[1]) - 1
  return `${parseInt(parts[2])} ${DUTCH_MONTHS[monthIdx].toLowerCase()}`
}

/**
 * Generate a PDF matching the DE UNIE reiskosten declaratieformulier layout.
 * Landscape A4, columns matching the official template.
 * Returns a Blob ready for download.
 */
interface TravelPdfOptions {
  employeeName?: string
  bankAccount?: string
}

export function generateTravelPdf(expenses: TravelExpense[], month: number, year: number, options?: TravelPdfOptions): Blob {
  const name = options?.employeeName || EMPLOYEE_NAME
  const bank = options?.bankAccount || BANK_ACCOUNT
  const monthName = DUTCH_MONTHS[month - 1]
  const doc = new jsPDF({ orientation: 'landscape' })

  const now = new Date()
  const todayStr = `${now.getDate()} ${monthName.toLowerCase()} ${year}`

  // Title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${COMPANY_NAME} declaratieformulier`, 14, 18)

  // Employee info
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('medewerker:', 14, 30)
  doc.text(name, 55, 30)
  doc.text('bank/giro nummer:', 14, 36)
  doc.text(bank, 55, 36)
  doc.text('datum:', 14, 42)
  doc.text(todayStr, 55, 42)

  // Sort by date
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Compute totals
  let totalOv = 0, totalKm = 0, totalKmVerg = 0, totalVerg = 0
  for (const e of sorted) {
    const kmVerg = (e.kilometers || 0) * KM_RATE
    totalOv += e.travel_cost || 0
    totalKm += e.kilometers || 0
    totalKmVerg += kmVerg
    totalVerg += (e.travel_cost || 0) + kmVerg
  }

  // Table data
  const tableData = sorted.map((e) => {
    const kmVerg = (e.kilometers || 0) * KM_RATE
    const total = (e.travel_cost || 0) + kmVerg
    return [
      formatDateDutch(e.date),
      e.project_code || '',
      e.project_name || '',
      e.description || '',
      e.travel_cost ? formatEuro(e.travel_cost) : '',
      e.kilometers ? String(e.kilometers) : '',
      kmVerg ? formatEuro(kmVerg) : '',
      '',
      formatEuro(total),
    ]
  })

  // Main table
  autoTable(doc, {
    head: [[
      'datum',
      'projectnr.',
      'projectnaam',
      'omschrijving',
      'reiskosten\nOV',
      "km's",
      `km vergoeding\nbelastingvrij\nx \u20AC ${KM_RATE.toFixed(2)}`,
      'overige\nonkosten',
      'totale\nvergoeding',
    ]],
    body: tableData,
    startY: 50,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 36 },
      3: { cellWidth: 42 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 28, halign: 'right' },
    },
  })

  // Get Y after table
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 150
  let y = finalY + 3

  // Totals table
  autoTable(doc, {
    body: [
      [
        { content: 'Subtotalen', styles: { fontStyle: 'bold' as const } },
        '', '', '',
        totalOv ? formatEuro(totalOv) : '',
        String(totalKm),
        formatEuro(totalKmVerg),
        '',
        { content: formatEuro(totalVerg), styles: { fontStyle: 'bold' as const } },
      ],
      ['Af: evt. voorschot', '', '', '', '', '', '', '', formatEuro(0)],
      [
        { content: 'TOTAAL', styles: { fontStyle: 'bold' as const } },
        '', '', '', '', '', '', '',
        { content: formatEuro(totalVerg), styles: { fontStyle: 'bold' as const } },
      ],
    ],
    startY: y,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 36 },
      3: { cellWidth: 42 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 16, halign: 'right' },
      6: { cellWidth: 28, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 28, halign: 'right' },
    },
  })

  const finalY2 = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || y + 30
  y = finalY2 + 15

  // Handtekening
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('handtekening werknemer:', 14, y)
  doc.text('handtekening werkgever:', 160, y)
  y += 40

  // Toelichting
  doc.setDrawColor(150)
  doc.line(14, y, 283, y)
  y += 5
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('Toelichting', 14, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.text(
    'Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie',
    14, y, { maxWidth: 269 }
  )
  y += 7
  doc.text(
    'De vergoedingen worden op basis van de declaraties met het salaris uitbetaald.',
    14, y, { maxWidth: 269 }
  )

  return doc.output('blob')
}

/**
 * Get the filename for the travel declaration PDF
 */
export function getTravelPdfFilename(month: number, year: number): string {
  const monthName = DUTCH_MONTHS[month - 1]
  return `Declaratie_${monthName}_${year}.pdf`
}
