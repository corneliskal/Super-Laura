import { useState, useEffect, useCallback } from 'react'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { KM_RATE, type TravelExpense, type TravelExpenseFormData, type TravelSubmission } from '@/types/receipt'

const TRAVEL_COLLECTION = 'travel_expenses'
const TRAVEL_SUBMISSIONS_COLLECTION = 'travel_submissions'

function docToTravelExpense(docSnap: { id: string; data: () => Record<string, unknown> }): TravelExpense {
  const d = docSnap.data()
  return {
    id: docSnap.id,
    date: (d.date as string) || '',
    project_code: (d.project_code as string) || '',
    project_name: (d.project_name as string) || '',
    description: (d.description as string) || '',
    travel_cost: (d.travel_cost as number) || 0,
    kilometers: (d.kilometers as number) || 0,
    km_reimbursement: (d.km_reimbursement as number) || 0,
    total_reimbursement: (d.total_reimbursement as number) || 0,
    is_submitted: (d.is_submitted as boolean) || false,
    submission_id: (d.submission_id as string) || null,
    created_at: (d.created_at as string) || new Date().toISOString(),
    updated_at: (d.updated_at as string) || new Date().toISOString(),
  }
}

export function useTravel() {
  const [expenses, setExpenses] = useState<TravelExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async (month?: number, year?: number) => {
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
          collection(db, TRAVEL_COLLECTION),
          where('date', '>=', startDate),
          where('date', '<', endDate),
          orderBy('date', 'desc')
        )
      } else {
        q = query(
          collection(db, TRAVEL_COLLECTION),
          orderBy('date', 'desc')
        )
      }

      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(docToTravelExpense)
      setExpenses(data)
    } catch (err) {
      console.error('Error fetching travel expenses:', err)
      setError('Kon reiskosten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  const createExpense = useCallback(async (formData: TravelExpenseFormData): Promise<TravelExpense | null> => {
    try {
      const now = new Date().toISOString()
      const kilometers = parseFloat(formData.kilometers) || 0
      const travelCost = parseFloat(formData.travel_cost) || 0
      const kmReimbursement = Math.round(kilometers * KM_RATE * 100) / 100
      const totalReimbursement = Math.round((travelCost + kmReimbursement) * 100) / 100

      const expenseData = {
        date: formData.date,
        project_code: formData.project_code,
        project_name: formData.project_name,
        description: formData.description,
        travel_cost: travelCost,
        kilometers,
        km_reimbursement: kmReimbursement,
        total_reimbursement: totalReimbursement,
        is_submitted: false,
        submission_id: null,
        created_at: now,
        updated_at: now,
      }

      const docRef = await addDoc(collection(db, TRAVEL_COLLECTION), expenseData)

      return {
        id: docRef.id,
        ...expenseData,
      }
    } catch (err) {
      console.error('Error creating travel expense:', err)
      throw err
    }
  }, [])

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, TRAVEL_COLLECTION, id))
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      console.error('Error deleting travel expense:', err)
      throw err
    }
  }, [])

  const getExpensesByMonth = useCallback(async (month: number, year: number): Promise<TravelExpense[]> => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const q = query(
      collection(db, TRAVEL_COLLECTION),
      where('date', '>=', startDate),
      where('date', '<', endDate),
      orderBy('date', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(docToTravelExpense)
      .filter((e) => !e.is_submitted)
  }, [])

  const getSubmittedExpensesByMonth = useCallback(async (month: number, year: number): Promise<TravelExpense[]> => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const q = query(
      collection(db, TRAVEL_COLLECTION),
      where('date', '>=', startDate),
      where('date', '<', endDate),
      orderBy('date', 'asc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs
      .map(docToTravelExpense)
      .filter((e) => e.is_submitted)
  }, [])

  const markAsSubmitted = useCallback(async (expenseIds: string[], submissionId: string) => {
    const batch = writeBatch(db)

    for (const id of expenseIds) {
      const docRef = doc(db, TRAVEL_COLLECTION, id)
      batch.update(docRef, {
        is_submitted: true,
        submission_id: submissionId,
        updated_at: new Date().toISOString(),
      })
    }

    await batch.commit()

    setExpenses((prev) =>
      prev.map((e) =>
        expenseIds.includes(e.id)
          ? { ...e, is_submitted: true, submission_id: submissionId }
          : e
      )
    )
  }, [])

  const createSubmission = useCallback(async (
    month: number,
    year: number,
    totalAmount: number,
    entryCount: number
  ): Promise<TravelSubmission> => {
    const submissionData = {
      month,
      year,
      total_amount: totalAmount,
      entry_count: entryCount,
      status: 'exported' as const,
      created_at: new Date().toISOString(),
    }

    const docRef = await addDoc(collection(db, TRAVEL_SUBMISSIONS_COLLECTION), submissionData)

    return {
      id: docRef.id,
      ...submissionData,
    }
  }, [])

  return {
    expenses,
    loading,
    error,
    fetchExpenses,
    createExpense,
    deleteExpense,
    getExpensesByMonth,
    getSubmittedExpensesByMonth,
    markAsSubmitted,
    createSubmission,
  }
}

/**
 * Hook for getting travel expense stats for the current month
 */
export function useTravelStats() {
  const [stats, setStats] = useState<{
    count: number
    totalKm: number
    totalReimbursement: number
    loading: boolean
  }>({ count: 0, totalKm: 0, totalReimbursement: 0, loading: true })

  useEffect(() => {
    async function fetchStats() {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, '0')}-01`

      try {
        const q = query(
          collection(db, TRAVEL_COLLECTION),
          where('date', '>=', startDate),
          where('date', '<', endDate)
        )

        const snapshot = await getDocs(q)
        const data = snapshot.docs.map((d) => d.data())
        const count = data.length
        const totalKm = data.reduce((sum, r) => sum + ((r.kilometers as number) || 0), 0)
        const totalReimbursement = data.reduce((sum, r) => sum + ((r.total_reimbursement as number) || 0), 0)
        setStats({ count, totalKm, totalReimbursement, loading: false })
      } catch (err) {
        console.error('Error fetching travel stats:', err)
        setStats({ count: 0, totalKm: 0, totalReimbursement: 0, loading: false })
      }
    }

    fetchStats()
  }, [])

  return stats
}
