export interface ManagementFeeTemplate {
  // Afzender (uit template PDF)
  companyName: string
  companyAddress: string
  companyPhone: string
  companyIban: string
  companyKvk: string
  companyBtwNr: string
  companyBicCode: string
  companyFooterName: string

  // Ontvanger (uit template PDF)
  recipientName: string
  recipientAttention: string
  recipientAddress: string

  // Factuur patronen
  descriptionPattern: string   // "Management fee LFK bv maand {month} {year}"
  btwPercentage: number        // 21
  fileTitle: string            // "Factuur management fee LFK"

  // Email (apart van bonnetjes/reiskosten)
  recipientEmail: string

  // Voorbeeld PDF referentie
  samplePdfPath: string
  samplePdfUrl: string

  isConfigured: boolean
  createdAt: string
  updatedAt: string
}

export interface ManagementFeeInvoice {
  id: string
  userId: string
  month: number
  year: number
  amount: number
  btwPercentage: number
  btwAmount: number
  totalAmount: number
  invoiceNumber: string        // "2026-02"
  status: 'draft' | 'sent'
  sentAt: string | null
  created_at: string
  updated_at: string
}
