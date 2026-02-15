import { useState, useCallback, useRef } from 'react'
import { compressImage, fileToBase64 } from '@/lib/imageUtils'
import { processReceiptOcr } from '@/lib/ocr'
import { useReceipts } from '@/hooks/useReceipts'
import type { ReceiptFormData } from '@/types/receipt'

export interface BatchItem {
  id: string
  fileName: string
  status: 'pending' | 'compressing' | 'ocr' | 'saving' | 'done' | 'error'
  error?: string
}

export function useBatchUpload() {
  const { createReceipt } = useReceipts()
  const [items, setItems] = useState<BatchItem[]>([])
  const [active, setActive] = useState(false)
  const abortRef = useRef(false)

  const updateItem = (id: string, update: Partial<BatchItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...update } : item)))
  }

  const startBatch = useCallback(async (
    files: File[],
    defaultMonth?: number,
    defaultYear?: number,
    onEachDone?: () => void,
  ) => {
    if (files.length === 0) return

    abortRef.current = false
    setActive(true)

    const batchItems: BatchItem[] = files.map((f, i) => ({
      id: `batch-${Date.now()}-${i}`,
      fileName: f.name || `Foto ${i + 1}`,
      status: 'pending' as const,
    }))
    setItems(batchItems)

    // Compute default date for auto-fill
    let defaultDate: string
    if (defaultMonth && defaultYear) {
      const now = new Date()
      const isCurrentMonth = defaultMonth === now.getMonth() + 1 && defaultYear === now.getFullYear()
      defaultDate = isCurrentMonth
        ? now.toISOString().split('T')[0]
        : `${defaultYear}-${String(defaultMonth).padStart(2, '0')}-01`
    } else {
      defaultDate = new Date().toISOString().split('T')[0]
    }

    // Process files sequentially to avoid rate limits
    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break

      const file = files[i]
      const item = batchItems[i]

      try {
        // 1. Compress image
        updateItem(item.id, { status: 'compressing' })
        const isPdf = file.type === 'application/pdf'
        const blob = isPdf ? file : await compressImage(file)

        // 2. OCR
        updateItem(item.id, { status: 'ocr' })
        const base64 = await fileToBase64(blob)
        const ocrResult = await processReceiptOcr(base64)

        // 3. Auto-fill form data from OCR
        const formData: ReceiptFormData = {
          store_name: ocrResult.parsed.store_name || '',
          description: '',
          amount: String(ocrResult.parsed.amount || 0),
          vat_amount: ocrResult.parsed.vat_amount ? String(ocrResult.parsed.vat_amount) : '',
          receipt_date: defaultDate,
          category: 'Overig',
          notes: '',
        }

        // 4. Save receipt
        updateItem(item.id, { status: 'saving' })
        await createReceipt(formData, blob, ocrResult.raw_text)

        updateItem(item.id, { status: 'done' })
        onEachDone?.()
      } catch (err) {
        console.error(`Batch item ${item.fileName} failed:`, err)
        updateItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Verwerking mislukt',
        })
      }
    }

    setActive(false)
  }, [createReceipt])

  const dismiss = useCallback(() => {
    if (!active) setItems([])
  }, [active])

  const cancel = useCallback(() => {
    abortRef.current = true
  }, [])

  const completed = items.filter((i) => i.status === 'done').length
  const failed = items.filter((i) => i.status === 'error').length
  const total = items.length

  return {
    items,
    active,
    completed,
    failed,
    total,
    startBatch,
    dismiss,
    cancel,
  }
}
