import JSZip from 'jszip'
import { DUTCH_MONTHS } from '@/types/receipt'

/**
 * Generate a ZIP file containing the Excel, PDF, and all receipt photos.
 */
export async function generateSubmissionZip(
  monthName: string,
  year: number,
  excelBlob: Blob,
  pdfBlob: Blob,
  photos: Array<{ filename: string; blob: Blob }>
): Promise<Blob> {
  const zip = new JSZip()

  // Add Excel and PDF to root
  zip.file(`Bonnetjes_${monthName}_${year}.xlsx`, excelBlob)
  zip.file(`Bonnetjes_${monthName}_${year}.pdf`, pdfBlob)

  // Add photos in subfolder
  if (photos.length > 0) {
    const photosFolder = zip.folder('bonnetje_fotos')
    if (photosFolder) {
      for (const photo of photos) {
        photosFolder.file(photo.filename, photo.blob)
      }
    }
  }

  return zip.generateAsync({ type: 'blob' })
}

/**
 * Get the filename for a submission ZIP.
 */
export function getZipFilename(month: number, year: number): string {
  const monthName = DUTCH_MONTHS[month - 1]
  return `Bonnetjes_${monthName}_${year}.zip`
}
