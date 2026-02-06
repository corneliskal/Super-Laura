import { parseReceiptText } from './receiptParser'
import { OCR_FUNCTION_URL } from './constants'
import type { OcrResult } from '@/types/receipt'

/**
 * Process a receipt image through OCR using Gemini via Firebase Cloud Function.
 * Falls back to empty result if OCR fails.
 */
export async function processReceiptOcr(imageBase64: string): Promise<OcrResult> {
  try {
    const response = await fetch(OCR_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 }),
    })

    if (!response.ok) {
      console.error('OCR Cloud Function error:', response.status)
      return emptyOcrResult()
    }

    const data = await response.json()

    // If Gemini returned structured data directly, use it
    if (data.parsed) {
      return {
        raw_text: data.raw_text || '',
        confidence: data.confidence || 0.9,
        parsed: {
          store_name: data.parsed.store_name || null,
          amount: data.parsed.amount ? parseFloat(data.parsed.amount) : null,
          vat_amount: data.parsed.vat_amount ? parseFloat(data.parsed.vat_amount) : null,
          date: data.parsed.date || null,
        },
      }
    }

    // Fallback: if the function returns raw text, parse it ourselves
    const rawText = data.text || data.raw_text || ''
    return {
      raw_text: rawText,
      confidence: data.confidence || 0,
      parsed: parseReceiptText(rawText),
    }
  } catch (err) {
    console.error('OCR processing failed:', err)
    return emptyOcrResult()
  }
}

function emptyOcrResult(): OcrResult {
  return {
    raw_text: '',
    confidence: 0,
    parsed: {
      store_name: null,
      amount: null,
      vat_amount: null,
      date: null,
    },
  }
}
