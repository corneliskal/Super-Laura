import { useState, useCallback } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import { generatePhotoPath } from '@/lib/imageUtils'
import type { Receipt, ReceiptFormData } from '@/types/receipt'

const COLLECTION = 'card_payments'

function docToReceipt(docSnap: { id: string; data: () => Record<string, unknown> }): Receipt {
  const d = docSnap.data()
  return {
    id: docSnap.id,
    photo_path: (d.photo_path as string) || '',
    photo_url: (d.photo_url as string) || '',
    store_name: (d.store_name as string) || '',
    description: (d.description as string) || '',
    amount: (d.amount as number) || 0,
    vat_amount: (d.vat_amount as number) || null,
    receipt_date: (d.receipt_date as string) || '',
    category: (d.category as string) || 'Overig',
    file_type: (d.file_type as 'image' | 'pdf') || 'image',
    ocr_raw_text: (d.ocr_raw_text as string) || null,
    notes: (d.notes as string) || '',
    is_submitted: (d.is_submitted as boolean) || false,
    submission_id: (d.submission_id as string) || null,
    created_at: (d.created_at as string) || new Date().toISOString(),
    updated_at: (d.updated_at as string) || new Date().toISOString(),
  }
}

export function useCardPayments() {
  const [payments, setPayments] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayments = useCallback(async (month?: number, year?: number) => {
    const userId = auth.currentUser?.uid
    if (!userId) { setLoading(false); return }

    setLoading(true)
    setError(null)
    try {
      let q
      if (month && year) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDate = month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`

        q = query(
          collection(db, COLLECTION),
          where('userId', '==', userId),
          where('receipt_date', '>=', startDate),
          where('receipt_date', '<', endDate),
          orderBy('receipt_date', 'desc')
        )
      } else {
        q = query(
          collection(db, COLLECTION),
          where('userId', '==', userId),
          orderBy('receipt_date', 'desc')
        )
      }

      const snapshot = await getDocs(q)
      setPayments(snapshot.docs.map(docToReceipt))
    } catch (err) {
      console.error('Error fetching card payments:', err)
      setError('Kon kaartbetalingen niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  const createCardPayment = useCallback(async (
    formData: ReceiptFormData,
    photoBlob: Blob,
    ocrRawText?: string
  ): Promise<string> => {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Niet ingelogd')

    const tempId = crypto.randomUUID()
    const isPdf = photoBlob.type === 'application/pdf'
    const extension = isPdf ? 'pdf' : 'jpg'
    const contentType = isPdf ? 'application/pdf' : 'image/jpeg'
    const photoPath = generatePhotoPath(tempId, extension, userId)

    // Upload file to Firebase Storage
    const storageRef = ref(storage, `receipt-photos/${photoPath}`)
    await uploadBytes(storageRef, photoBlob, { contentType })
    const photoUrl = await getDownloadURL(storageRef)

    const now = new Date().toISOString()
    const docData = {
      userId,
      photo_path: photoPath,
      photo_url: photoUrl,
      file_type: isPdf ? 'pdf' as const : 'image' as const,
      store_name: formData.store_name,
      description: formData.description,
      amount: parseFloat(formData.amount) || 0,
      vat_amount: formData.vat_amount ? parseFloat(formData.vat_amount) : null,
      receipt_date: formData.receipt_date,
      category: formData.category,
      ocr_raw_text: ocrRawText || null,
      notes: formData.notes,
      is_submitted: true,
      submission_id: null,
      created_at: now,
      updated_at: now,
    }

    const docRef = await addDoc(collection(db, COLLECTION), docData)
    return docRef.id
  }, [])

  const deleteCardPayment = useCallback(async (id: string) => {
    const payment = payments.find((p) => p.id === id)
    if (payment && payment.photo_path) {
      const storageRef = ref(storage, `receipt-photos/${payment.photo_path}`)
      try {
        await deleteObject(storageRef)
      } catch {
        console.warn('Photo not found in storage, continuing with delete')
      }
    }
    await deleteDoc(doc(db, COLLECTION, id))
    setPayments((prev) => prev.filter((p) => p.id !== id))
  }, [payments])

  return {
    payments,
    loading,
    error,
    fetchPayments,
    createCardPayment,
    deleteCardPayment,
  }
}
