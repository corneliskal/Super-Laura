import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  getBlob,
  deleteObject,
} from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import { generatePhotoPath } from '@/lib/imageUtils'
import type { Receipt, ReceiptFormData, Submission } from '@/types/receipt'

const RECEIPTS_COLLECTION = 'receipts'
const SUBMISSIONS_COLLECTION = 'submissions'

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

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReceipts = useCallback(async (month?: number, year?: number) => {
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
          collection(db, RECEIPTS_COLLECTION),
          where('userId', '==', userId),
          where('receipt_date', '>=', startDate),
          where('receipt_date', '<', endDate),
          orderBy('receipt_date', 'desc')
        )
      } else {
        q = query(
          collection(db, RECEIPTS_COLLECTION),
          where('userId', '==', userId),
          orderBy('receipt_date', 'desc')
        )
      }

      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(docToReceipt)
      setReceipts(data)
    } catch (err) {
      console.error('Error fetching receipts:', err)
      setError('Kon bonnetjes niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  const createReceipt = useCallback(async (
    formData: ReceiptFormData,
    photoBlob: Blob,
    ocrRawText?: string
  ): Promise<Receipt | null> => {
    try {
      const tempId = crypto.randomUUID()
      const isPdf = photoBlob.type === 'application/pdf'
      const extension = isPdf ? 'pdf' : 'jpg'
      const contentType = isPdf ? 'application/pdf' : 'image/jpeg'
      const photoPath = generatePhotoPath(tempId, extension)

      // Upload file to Firebase Storage
      const storageRef = ref(storage, `receipt-photos/${photoPath}`)
      await uploadBytes(storageRef, photoBlob, { contentType })

      // Get download URL
      const photoUrl = await getDownloadURL(storageRef)

      // Create receipt document in Firestore
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('Niet ingelogd')

      const now = new Date().toISOString()
      const receiptData = {
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
        is_submitted: false,
        submission_id: null,
        created_at: now,
        updated_at: now,
      }

      const docRef = await addDoc(collection(db, RECEIPTS_COLLECTION), receiptData)

      return {
        id: docRef.id,
        ...receiptData,
      }
    } catch (err) {
      console.error('Error creating receipt:', err)
      throw err
    }
  }, [])

  const updateReceipt = useCallback(async (id: string, updates: Partial<ReceiptFormData>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        ...updates,
        updated_at: new Date().toISOString(),
      }
      if (updates.amount) updateData.amount = parseFloat(updates.amount)
      if (updates.vat_amount) updateData.vat_amount = parseFloat(updates.vat_amount)

      const docRef = doc(db, RECEIPTS_COLLECTION, id)
      await updateDoc(docRef, updateData as { [key: string]: string | number | boolean | null })

      // Re-fetch the updated doc
      const updatedSnap = await getDoc(docRef)
      if (updatedSnap.exists()) {
        const updated = docToReceipt({ id: updatedSnap.id, data: () => updatedSnap.data() as Record<string, unknown> })
        setReceipts((prev) => prev.map((r) => (r.id === id ? updated : r)))
        return updated
      }
    } catch (err) {
      console.error('Error updating receipt:', err)
      throw err
    }
  }, [])

  const deleteReceipt = useCallback(async (id: string) => {
    try {
      const receipt = receipts.find((r) => r.id === id)
      if (receipt && receipt.photo_path) {
        // Delete photo from Firebase Storage
        const storageRef = ref(storage, `receipt-photos/${receipt.photo_path}`)
        try {
          await deleteObject(storageRef)
        } catch {
          console.warn('Photo not found in storage, continuing with delete')
        }
      }

      // Delete document from Firestore
      await deleteDoc(doc(db, RECEIPTS_COLLECTION, id))
      setReceipts((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Error deleting receipt:', err)
      throw err
    }
  }, [receipts])

  const getReceiptsByMonth = useCallback(async (month: number, year: number): Promise<Receipt[]> => {
    const userId = auth.currentUser?.uid
    if (!userId) return []

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const q = query(
      collection(db, RECEIPTS_COLLECTION),
      where('userId', '==', userId),
      where('receipt_date', '>=', startDate),
      where('receipt_date', '<', endDate),
      orderBy('receipt_date', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(docToReceipt)
      .filter((r) => !r.is_submitted)
  }, [])

  const getSubmittedReceiptsByMonth = useCallback(async (month: number, year: number): Promise<Receipt[]> => {
    const userId = auth.currentUser?.uid
    if (!userId) return []

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const q = query(
      collection(db, RECEIPTS_COLLECTION),
      where('userId', '==', userId),
      where('receipt_date', '>=', startDate),
      where('receipt_date', '<', endDate),
      orderBy('receipt_date', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(docToReceipt)
      .filter((r) => r.is_submitted)
  }, [])

  const markAsSubmitted = useCallback(async (receiptIds: string[], submissionId: string) => {
    const batch = writeBatch(db)

    for (const id of receiptIds) {
      const docRef = doc(db, RECEIPTS_COLLECTION, id)
      batch.update(docRef, {
        is_submitted: true,
        submission_id: submissionId,
        updated_at: new Date().toISOString(),
      })
    }

    await batch.commit()

    setReceipts((prev) =>
      prev.map((r) =>
        receiptIds.includes(r.id)
          ? { ...r, is_submitted: true, submission_id: submissionId }
          : r
      )
    )
  }, [])

  const createSubmission = useCallback(async (
    month: number,
    year: number,
    totalAmount: number,
    receiptCount: number
  ): Promise<Submission> => {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Niet ingelogd')

    const submissionData = {
      userId,
      month,
      year,
      total_amount: totalAmount,
      receipt_count: receiptCount,
      status: 'exported' as const,
      created_at: new Date().toISOString(),
    }

    const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), submissionData)

    return {
      id: docRef.id,
      ...submissionData,
    }
  }, [])

  const getPhotoBlob = useCallback(async (photoPath: string): Promise<Blob> => {
    const storageRef = ref(storage, `receipt-photos/${photoPath}`)
    // Use Firebase SDK's getBlob to avoid CORS issues
    return await getBlob(storageRef)
  }, [])

  return {
    receipts,
    loading,
    error,
    fetchReceipts,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    getReceiptsByMonth,
    getSubmittedReceiptsByMonth,
    markAsSubmitted,
    createSubmission,
    getPhotoBlob,
  }
}

/**
 * Hook for getting receipt stats for the current month
 */
export function useReceiptStats() {
  const [stats, setStats] = useState<{
    count: number
    total: number
    loading: boolean
  }>({ count: 0, total: 0, loading: true })

  useEffect(() => {
    async function fetchStats() {
      const userId = auth.currentUser?.uid
      if (!userId) { setStats({ count: 0, total: 0, loading: false }); return }

      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      try {
        const q = query(
          collection(db, RECEIPTS_COLLECTION),
          where('userId', '==', userId),
          where('receipt_date', '>=', startDate),
          where('receipt_date', '<', endDate)
        )

        const snapshot = await getDocs(q)
        const data = snapshot.docs.map((d) => d.data())
        const count = data.length
        const total = data.reduce((sum, r) => sum + ((r.amount as number) || 0), 0)
        setStats({ count, total, loading: false })
      } catch (err) {
        console.error('Error fetching stats:', err)
        setStats({ count: 0, total: 0, loading: false })
      }
    }

    fetchStats()
  }, [])

  return stats
}
