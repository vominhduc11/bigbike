import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

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
    <Button variant="secondary"
      type="button"
      onClick={handleExport}
      disabled={exporting}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Download size={14} />
      {exporting ? t('export.exporting') : (label || t('export.exportCsv'))}
    </Button>
  )
}
