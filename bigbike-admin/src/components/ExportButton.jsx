import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

export function ExportButton({ onExport, filename = 'export.csv', label }) {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await onExport()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('export.success'))
    } catch (err) {
      toast.error(err.message || t('export.error'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={handleExport}
      disabled={exporting}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Download size={14} />
      {exporting ? t('export.exporting') : (label || t('export.exportCsv'))}
    </button>
  )
}
