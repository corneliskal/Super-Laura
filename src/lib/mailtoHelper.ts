import { RECIPIENT_EMAIL, USER_NAME } from './constants'
import { DUTCH_MONTHS } from '@/types/receipt'
import { formatEuro } from './dateUtils'

/**
 * Build a mailto: link with pre-filled subject and body.
 * Note: mailto: cannot include attachments — Laura will attach the ZIP manually.
 */
export function buildMailtoLink(month: number, year: number, count: number, total: number): string {
  const monthName = DUTCH_MONTHS[month - 1]
  const subject = encodeURIComponent(`Bonnetjes ${monthName} ${year} - ${USER_NAME}`)

  const totalFormatted = formatEuro(total)

  const body = encodeURIComponent(
    `Hallo,\r\n\r\n` +
    `Hierbij de bonnetjes van ${monthName} ${year}.\r\n\r\n` +
    `Aantal bonnetjes: ${count}\r\n` +
    `Totaal bedrag: ${totalFormatted}\r\n\r\n` +
    `Het ZIP-bestand bevat:\r\n` +
    `- Excel overzicht (.xlsx)\r\n` +
    `- PDF overzicht (.pdf)\r\n` +
    `- Alle bonnetje foto's\r\n\r\n` +
    `Vergeet niet het ZIP-bestand als bijlage toe te voegen!\r\n\r\n` +
    `Groetjes,\r\n${USER_NAME}`
  )

  return `mailto:${RECIPIENT_EMAIL}?subject=${subject}&body=${body}`
}
