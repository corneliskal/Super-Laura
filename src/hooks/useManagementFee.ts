import { useState, useCallback } from 'react'
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage'
import { db, storage, auth } from '@/lib/firebase'
import type { ManagementFeeTemplate, ManagementFeeInvoice } from '@/types/managementfee'

const INVOICES_COLLECTION = 'management_fee_invoices'

export function useManagementFee() {
  const [template, setTemplate] = useState<ManagementFeeTemplate | null>(null)
  const [invoices, setInvoices] = useState<ManagementFeeInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTemplate = useCallback(async () => {
    const userId = auth.currentUser?.uid
    if (!userId) return null

    try {
      const docRef = doc(db, 'users', userId, 'settings', 'managementfee')
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const data = snap.data() as ManagementFeeTemplate
        setTemplate(data)
        return data
      }
      setTemplate(null)
      return null
    } catch (err) {
      console.error('Error loading management fee template:', err)
      return null
    }
  }, [])

  const saveTemplate = useCallback(async (data: Omit<ManagementFeeTemplate, 'createdAt' | 'updatedAt'>) => {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Niet ingelogd')

    const now = new Date().toISOString()
    const existing = template
    const templateData: ManagementFeeTemplate = {
      ...data,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    const docRef = doc(db, 'users', userId, 'settings', 'managementfee')
    await setDoc(docRef, templateData)
    setTemplate(templateData)
    return templateData
  }, [template])

  const uploadSamplePdf = useCallback(async (file: File): Promise<{ path: string; url: string }> => {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Niet ingelogd')

    const path = `management-fee-templates/${userId}/sample.pdf`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
    const url = await getDownloadURL(storageRef)
    return { path, url }
  }, [])

  const fetchInvoices = useCallback(async (month?: number, year?: number) => {
    const userId = auth.currentUser?.uid
    if (!userId) { setLoading(false); return }

    setLoading(true)
    setError(null)
    try {
      let q
      if (month && year) {
        q = query(
          collection(db, INVOICES_COLLECTION),
          where('userId', '==', userId),
          where('month', '==', month),
          where('year', '==', year)
        )
      } else {
        q = query(
          collection(db, INVOICES_COLLECTION),
          where('userId', '==', userId),
          orderBy('year', 'desc'),
          orderBy('month', 'desc')
        )
      }

      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ManagementFeeInvoice[]
      setInvoices(data)
    } catch (err) {
      console.error('Error fetching invoices:', err)
      setError('Kon facturen niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  const getInvoiceForMonth = useCallback(async (month: number, year: number): Promise<ManagementFeeInvoice | null> => {
    const userId = auth.currentUser?.uid
    if (!userId) return null

    try {
      const q = query(
        collection(db, INVOICES_COLLECTION),
        where('userId', '==', userId),
        where('month', '==', month),
        where('year', '==', year),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const d = snapshot.docs[0]
      return { id: d.id, ...d.data() } as ManagementFeeInvoice
    } catch (err) {
      console.error('Error getting invoice:', err)
      return null
    }
  }, [])

  const getLastAmount = useCallback(async (): Promise<number | null> => {
    const userId = auth.currentUser?.uid
    if (!userId) return null

    try {
      const q = query(
        collection(db, INVOICES_COLLECTION),
        where('userId', '==', userId),
        orderBy('year', 'desc'),
        orderBy('month', 'desc'),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      return (snapshot.docs[0].data().amount as number) || null
    } catch (err) {
      console.error('Error getting last amount:', err)
      return null
    }
  }, [])

  return {
    template,
    invoices,
    loading,
    error,
    loadTemplate,
    saveTemplate,
    uploadSamplePdf,
    fetchInvoices,
    getInvoiceForMonth,
    getLastAmount,
  }
}
