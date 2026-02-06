import * as XLSX from 'xlsx'
import type { TravelExpense } from '@/types/receipt'
import { DUTCH_MONTHS, KM_RATE } from '@/types/receipt'
import { EMPLOYEE_NAME, BANK_ACCOUNT, COMPANY_NAME } from './constants'

/**
 * Generate the DE UNIE declaratieformulier Excel matching their template.
 * Returns a Blob ready for download.
 */
export function generateTravelExcel(expenses: TravelExpense[], month: number, year: number): Blob {
  const monthName = DUTCH_MONTHS[month - 1]

  // Sort by date
  const sorted = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Calculate totals
  const totalKm = sorted.reduce((sum, e) => sum + e.kilometers, 0)
  const totalKmReimbursement = sorted.reduce((sum, e) => sum + e.km_reimbursement, 0)
  const totalTravelCost = sorted.reduce((sum, e) => sum + e.travel_cost, 0)
  const totalReimbursement = sorted.reduce((sum, e) => sum + e.total_reimbursement, 0)

  // Build worksheet data matching the DE UNIE template
  const wsData: (string | number | null)[][] = []

  // Row 1: Title
  wsData.push([`${COMPANY_NAME} declaratieformulier`, null, null, null, null, null, null, null, null])

  // Row 2: empty
  wsData.push([])

  // Row 3-5: Employee info
  wsData.push(['medewerker:', EMPLOYEE_NAME])
  wsData.push(['bank/giro nummer:', BANK_ACCOUNT])
  wsData.push(['datum:', `${new Date().getDate()} ${monthName.toLowerCase()} ${year}`])

  // Row 6: empty
  wsData.push([])

  // Row 7: Column headers
  wsData.push([
    'datum',
    'projectnr.',
    'projectnaam',
    'omschrijving',
    'reiskosten\nOV',
    null,
    "km's",
    `km vergoeding\nbelastingvrij\nx € ${KM_RATE.toFixed(2)}`,
    'overige\nonkosten',
    null,
    'totale\nvergoeding',
  ])

  // Row 8: empty (sub-header spacing)
  wsData.push([])

  // Data rows
  for (const e of sorted) {
    const dateParts = e.date.split('-')
    const dateFormatted = `${parseInt(dateParts[2])} ${DUTCH_MONTHS[parseInt(dateParts[1]) - 1].toLowerCase().substring(0, dateParts[1] === '09' ? 9 : undefined)}`

    wsData.push([
      dateFormatted,
      e.project_code,
      e.project_name,
      e.description,
      e.travel_cost || null,
      null,
      e.kilometers || null,
      e.km_reimbursement || null,
      null,
      null,
      e.total_reimbursement,
    ])
  }

  // Empty row before totals
  wsData.push([])

  // Subtotals row
  wsData.push([
    null, null, null,
    'Subtotalen',
    totalTravelCost || null,
    '€',
    totalKm,
    `€ ${totalKmReimbursement.toFixed(2)}`,
    null,
    '€',
    totalReimbursement,
  ])

  // Af: evt. voorschot row
  wsData.push([null, null, null, 'Af: evt. voorschot', null, null, null, null, null, '€', null])

  // TOTAAL row
  wsData.push([null, null, null, 'TOTAAL', null, null, null, null, null, '€', totalReimbursement])

  // Empty rows
  wsData.push([])
  wsData.push([])

  // Signature rows
  wsData.push(['handtekening werknemer:', null, null, null, null, 'handtekening werkgever:'])

  // Empty rows for signature space
  wsData.push([])
  wsData.push([])
  wsData.push([])

  // Toelichting
  wsData.push(['Toelichting'])
  wsData.push(['Interne declaratie voor vergoeding van reiskosten gemaakt in opdracht en tijdens werktijd en overige declaraties. Declaraties kunnen worden ingeleverd bij de directie'])
  wsData.push(['De vergoedingen worden op basis van de declaraties met het salaris uitbetaald.'])

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths to match template
  ws['!cols'] = [
    { wch: 16 },  // datum
    { wch: 16 },  // projectnr
    { wch: 20 },  // projectnaam
    { wch: 24 },  // omschrijving
    { wch: 12 },  // reiskosten OV
    { wch: 3 },   // €
    { wch: 8 },   // km's
    { wch: 14 },  // km vergoeding
    { wch: 10 },  // overige onkosten
    { wch: 3 },   // €
    { wch: 12 },  // totale vergoeding
  ]

  // Format number cells
  for (let row = 8; row < 8 + sorted.length; row++) {
    // Travel cost (col 4)
    const tcCell = XLSX.utils.encode_cell({ r: row, c: 4 })
    if (ws[tcCell] && typeof ws[tcCell].v === 'number') ws[tcCell].z = '#,##0.00'
    // km reimbursement (col 7)
    const krCell = XLSX.utils.encode_cell({ r: row, c: 7 })
    if (ws[krCell] && typeof ws[krCell].v === 'number') ws[krCell].z = '#,##0.00'
    // total (col 10)
    const totCell = XLSX.utils.encode_cell({ r: row, c: 10 })
    if (ws[totCell] && typeof ws[totCell].v === 'number') ws[totCell].z = '#,##0.00'
  }

  // Create workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `Declaratie ${monthName} ${year}`)

  // Write to buffer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * Get the filename for the travel declaration Excel
 */
export function getTravelExcelFilename(month: number, year: number): string {
  const monthName = DUTCH_MONTHS[month - 1]
  return `Declaratie_${monthName}_${year}.xlsx`
}
