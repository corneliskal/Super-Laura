import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Loader2, Save, FileText } from 'lucide-react'
import { useManagementFee } from '@/hooks/useManagementFee'
import { useToast } from '@/components/ui/Toast'
import { ANALYZE_INVOICE_URL } from '@/lib/constants'
import { getAuthToken } from '@/lib/firebase'
import type { ManagementFeeTemplate } from '@/types/managementfee'

type PartialTemplate = Omit<ManagementFeeTemplate, 'createdAt' | 'updatedAt'>

export function ManagementFeeSetupPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { loadTemplate, saveTemplate, uploadSamplePdf } = useManagementFee()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [form, setForm] = useState<PartialTemplate>({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyIban: '',
    companyKvk: '',
    companyBtwNr: '',
    companyBicCode: '',
    companyFooterName: '',
    recipientName: '',
    recipientAttention: '',
    recipientAddress: '',
    descriptionPattern: '',
    btwPercentage: 21,
    fileTitle: '',
    recipientEmail: '',
    samplePdfPath: '',
    samplePdfUrl: '',
    isConfigured: false,
  })

  useEffect(() => {
    loadTemplate().then((t) => {
      if (t) {
        setForm({
          companyName: t.companyName || '',
          companyAddress: t.companyAddress || '',
          companyPhone: t.companyPhone || '',
          companyIban: t.companyIban || '',
          companyKvk: t.companyKvk || '',
          companyBtwNr: t.companyBtwNr || '',
          companyBicCode: t.companyBicCode || '',
          companyFooterName: t.companyFooterName || '',
          recipientName: t.recipientName || '',
          recipientAttention: t.recipientAttention || '',
          recipientAddress: t.recipientAddress || '',
          descriptionPattern: t.descriptionPattern || '',
          btwPercentage: t.btwPercentage || 21,
          fileTitle: t.fileTitle || '',
          recipientEmail: t.recipientEmail || '',
          samplePdfPath: t.samplePdfPath || '',
          samplePdfUrl: t.samplePdfUrl || '',
          isConfigured: t.isConfigured || false,
        })
      }
      setLoading(false)
    })
  }, [loadTemplate])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') {
      showToast('error', 'Upload een PDF bestand')
      return
    }
    e.target.value = ''

    setPdfFile(file)
    setAnalyzing(true)

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      )

      const token = await getAuthToken()
      const response = await fetch(ANALYZE_INVOICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: 'application/pdf',
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Analyse mislukt')

      const data = result.data
      setForm((prev) => ({
        ...prev,
        companyName: data.companyName || prev.companyName,
        companyAddress: data.companyAddress || prev.companyAddress,
        companyPhone: data.companyPhone || prev.companyPhone,
        companyIban: data.companyIban || prev.companyIban,
        companyKvk: data.companyKvk || prev.companyKvk,
        companyBtwNr: data.companyBtwNr || prev.companyBtwNr,
        companyBicCode: data.companyBicCode || prev.companyBicCode,
        companyFooterName: data.companyFooterName || prev.companyFooterName,
        recipientName: data.recipientName || prev.recipientName,
        recipientAttention: data.recipientAttention || prev.recipientAttention,
        recipientAddress: data.recipientAddress || prev.recipientAddress,
        descriptionPattern: data.descriptionPattern || prev.descriptionPattern,
        btwPercentage: data.btwPercentage || prev.btwPercentage,
      }))

      showToast('success', 'Factuur geanalyseerd! Controleer de gegevens.')
    } catch (err) {
      console.error('Analyze error:', err)
      showToast('error', err instanceof Error ? err.message : 'Analyse mislukt')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!form.recipientEmail.trim()) {
      showToast('error', 'Vul een ontvanger e-mailadres in')
      return
    }
    if (!form.fileTitle.trim()) {
      showToast('error', 'Vul een bestandstitel in')
      return
    }

    setSaving(true)
    try {
      let samplePdfPath = form.samplePdfPath
      let samplePdfUrl = form.samplePdfUrl

      // Upload PDF if new one was selected
      if (pdfFile) {
        const uploaded = await uploadSamplePdf(pdfFile)
        samplePdfPath = uploaded.path
        samplePdfUrl = uploaded.url
      }

      await saveTemplate({
        ...form,
        samplePdfPath,
        samplePdfUrl,
        isConfigured: true,
      })

      showToast('success', 'Template opgeslagen!')
      navigate('/management-fee')
    } catch (err) {
      console.error('Save error:', err)
      showToast('error', 'Kon template niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof PartialTemplate, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-gray-900">Management Fee instellen</h2>
      </div>

      {/* Upload PDF */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Voorbeeld factuur</h3>
        <p className="text-sm text-gray-500">
          Upload een voorbeeld van je factuur (PDF). De app analyseert het document en vult de gegevens automatisch in.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
        />

        {analyzing ? (
          <div className="flex items-center justify-center gap-3 py-8 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl">
            <Loader2 size={24} className="text-amber-600 animate-spin" />
            <span className="text-amber-700 font-medium">Factuur analyseren...</span>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-6 bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-100 transition-colors"
          >
            {pdfFile || form.samplePdfUrl ? (
              <>
                <FileText size={24} className="text-amber-600" />
                <span className="text-amber-700 font-medium">
                  {pdfFile ? pdfFile.name : 'PDF opnieuw uploaden'}
                </span>
              </>
            ) : (
              <>
                <Upload size={24} className="text-amber-600" />
                <span className="text-amber-700 font-medium">Upload voorbeeld PDF</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Form fields */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-5">
        {/* Email & file title */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">E-mail instellingen</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ontvanger e-mailadres *
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Naar dit adres wordt de factuur gestuurd
              </p>
              <input
                type="email"
                value={form.recipientEmail}
                onChange={(e) => updateField('recipientEmail', e.target.value)}
                placeholder="email@voorbeeld.nl"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bestandstitel *
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Naam voor de PDF bijlage (bijv. "Factuur management fee LFK")
              </p>
              <input
                type="text"
                value={form.fileTitle}
                onChange={(e) => updateField('fileTitle', e.target.value)}
                placeholder="Factuur management fee LFK"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Company details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Afzender (jouw bedrijf)</h3>

          <div className="space-y-3">
            <InputField label="Bedrijfsnaam" value={form.companyName} onChange={(v) => updateField('companyName', v)} />
            <InputField label="Adres" value={form.companyAddress} onChange={(v) => updateField('companyAddress', v)} placeholder="Straat 1, 1234 AB Plaats" />
            <InputField label="Telefoon" value={form.companyPhone} onChange={(v) => updateField('companyPhone', v)} />
            <InputField label="IBAN" value={form.companyIban} onChange={(v) => updateField('companyIban', v)} />
            <InputField label="KvK-nummer" value={form.companyKvk} onChange={(v) => updateField('companyKvk', v)} />
            <InputField label="BTW-nummer" value={form.companyBtwNr} onChange={(v) => updateField('companyBtwNr', v)} />
            <InputField label="BIC code" value={form.companyBicCode} onChange={(v) => updateField('companyBicCode', v)} />
            <InputField label="Footer bedrijfsnaam" value={form.companyFooterName} onChange={(v) => updateField('companyFooterName', v)} placeholder="Zoals onderaan de factuur" />
          </div>
        </div>

        {/* Recipient details */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Ontvanger (op de factuur)</h3>

          <div className="space-y-3">
            <InputField label="Bedrijfsnaam ontvanger" value={form.recipientName} onChange={(v) => updateField('recipientName', v)} />
            <InputField label="T.a.v." value={form.recipientAttention} onChange={(v) => updateField('recipientAttention', v)} />
            <InputField label="Adres ontvanger" value={form.recipientAddress} onChange={(v) => updateField('recipientAddress', v)} placeholder="Straat 1, 1234 AB Plaats" />
          </div>
        </div>

        {/* Invoice pattern */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Factuur instellingen</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Omschrijving patroon
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Gebruik {'{month}'} voor de maand en {'{year}'} voor het jaar
              </p>
              <input
                type="text"
                value={form.descriptionPattern}
                onChange={(e) => updateField('descriptionPattern', e.target.value)}
                placeholder="Management fee LFK bv maand {month} {year}"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                BTW percentage
              </label>
              <input
                type="number"
                value={form.btwPercentage}
                onChange={(e) => updateField('btwPercentage', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-amber-600 text-white rounded-xl font-semibold text-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-md"
      >
        {saving ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Opslaan...
          </>
        ) : (
          <>
            <Save size={20} />
            Template opslaan
          </>
        )}
      </button>
    </div>
  )
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
      />
    </div>
  )
}
