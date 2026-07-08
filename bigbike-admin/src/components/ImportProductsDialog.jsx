import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Download, Loader2, Upload, X } from 'lucide-react'
import { Modal } from '@/components/layout/Modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/lib/toast'
import {
  ApiClientError,
  exportProductImportTemplate,
  importProductsCommit,
  importProductsValidate,
} from '@/lib/adminApi'

function actionLabel(t, action) {
  if (action === 'CREATE') return t('import.actionCreate')
  if (action === 'UPDATE') return t('import.actionUpdate')
  return t('import.actionSkipped')
}

function StatusBadge({ t, status }) {
  if (status === 'ERROR') {
    return <span className="flex items-center gap-1 text-danger"><X size={14} aria-hidden />{t('import.statusError')}</span>
  }
  if (status === 'WARNING') {
    return <span className="flex items-center gap-1 text-warning"><AlertTriangle size={14} aria-hidden />{t('import.statusWarning')}</span>
  }
  return <span className="flex items-center gap-1 text-success"><Check size={14} aria-hidden />{t('import.statusOk')}</span>
}

export function ImportProductsDialog({ open, onClose }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef(null)

  const [step, setStep] = useState('pick') // pick | validating | review | committing | done
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [excludedRowKeys, setExcludedRowKeys] = useState(new Set())
  const [error, setError] = useState(null)

  function reset() {
    setStep('pick')
    setFile(null)
    setReport(null)
    setExcludedRowKeys(new Set())
    setError(null)
  }

  function handleClose() {
    reset()
    onClose?.()
  }

  function handleFileChange(e) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setFile(picked)
    runValidate(picked)
  }

  async function runValidate(pickedFile) {
    setStep('validating')
    setError(null)
    try {
      const result = await importProductsValidate(pickedFile)
      setReport(result)
      setExcludedRowKeys(new Set(result.rows.filter((r) => r.status === 'ERROR').map((r) => r.rowKey)))
      setStep('review')
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : (err?.message || t('import.error')))
      setStep('pick')
    }
  }

  async function handleConfirm() {
    if (!file) return
    setStep('committing')
    setError(null)
    try {
      const result = await importProductsCommit(file, Array.from(excludedRowKeys))
      setReport(result)
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(t('import.resultSummary', {
        ok: result.okCount, warn: result.warningCount, err: result.errorCount,
      }))
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : (err?.message || t('import.error')))
      setStep('review')
    }
  }

  function toggleRow(rowKey) {
    setExcludedRowKeys((prev) => {
      const next = new Set(prev)
      if (next.has(rowKey)) next.delete(rowKey)
      else next.add(rowKey)
      return next
    })
  }

  async function handleDownloadTemplate() {
    try {
      await exportProductImportTemplate()
    } catch (err) {
      toast.error(err?.message || t('import.error'))
    }
  }

  const allExcluded = report ? report.rows.every((r) => excludedRowKeys.has(r.rowKey)) : true

  let actions
  if (step === 'review') {
    actions = (
      <>
        <Button variant="ghost" size="sm" onClick={handleClose}>{t('import.close')}</Button>
        <Button size="sm" onClick={handleConfirm} disabled={allExcluded}>
          {t('import.confirmImport')}
        </Button>
      </>
    )
  } else if (step === 'committing') {
    actions = <Button variant="ghost" size="sm" disabled>{t('import.committing')}</Button>
  } else {
    actions = <Button variant="ghost" size="sm" onClick={handleClose}>{t('import.close')}</Button>
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('import.dialogTitle')}
      contentClassName="p-0 flex flex-col max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl"
      actions={actions}
    >
      {(step === 'pick') && (
        <div className="space-y-4">
          {error ? <div className="text-sm text-danger">{error}</div> : null}
          <p className="text-sm text-muted-foreground">{t('import.pickFileHint')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex gap-2">
            <Button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5">
              <Upload size={14} aria-hidden />{t('import.pickFile')}
            </Button>
            <Button variant="secondary" onClick={handleDownloadTemplate} className="flex items-center gap-1.5">
              <Download size={14} aria-hidden />{t('import.downloadCurrent')}
            </Button>
          </div>
        </div>
      )}

      {(step === 'validating' || step === 'committing') && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          {t(step === 'validating' ? 'import.validating' : 'import.committing')}
        </div>
      )}

      {(step === 'review' || step === 'done') && report && (
        <div className="space-y-3">
          {error ? <div className="text-sm text-danger">{error}</div> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="text-success">{t('import.okCount', { count: report.okCount })}</span>
            <span className="text-warning">{t('import.warningCount', { count: report.warningCount })}</span>
            <span className="text-danger">{t('import.errorCount', { count: report.errorCount })}</span>
            {report.skippedCount > 0 && (
              <span className="text-muted-foreground">{t('import.skippedCount', { count: report.skippedCount })}</span>
            )}
          </div>
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {step === 'review' && <th className="p-2 w-8" />}
                  <th className="p-2">{t('import.colRow')}</th>
                  <th className="p-2">{t('import.colProduct')}</th>
                  <th className="p-2">{t('import.colAction')}</th>
                  <th className="p-2">{t('import.colStatus')}</th>
                  <th className="p-2">{t('import.colVariants')}</th>
                  <th className="p-2">{t('import.colDetail')}</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.rowKey} className="border-b border-border last:border-0 align-top">
                    {step === 'review' && (
                      <td className="p-2">
                        <Checkbox
                          disabled={row.status === 'ERROR'}
                          checked={!excludedRowKeys.has(row.rowKey)}
                          onCheckedChange={() => toggleRow(row.rowKey)}
                          aria-label={t('import.rowCheckboxLabel', { name: row.productName || row.rowKey })}
                        />
                      </td>
                    )}
                    <td className="p-2">{row.rowNumber}</td>
                    <td className="p-2">{row.productName || '—'}</td>
                    <td className="p-2">{actionLabel(t, row.action)}</td>
                    <td className="p-2"><StatusBadge t={t} status={row.status} /></td>
                    <td className="p-2 whitespace-nowrap">
                      {row.variantsAdded > 0 && <div>+{row.variantsAdded} {t('import.variantsAdded')}</div>}
                      {row.variantsUpdated > 0 && <div>{row.variantsUpdated} {t('import.variantsUpdated')}</div>}
                      {row.variantsRemoved > 0 && (
                        <div className="text-danger flex items-center gap-1">
                          <AlertTriangle size={12} aria-hidden />
                          -{row.variantsRemoved} {t('import.willRemoveVariants')}
                          {row.removedVariantSkus?.length ? `: ${row.removedVariantSkus.join(', ')}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {row.errors?.map((e, i) => (
                        <div key={`e-${i}`} className="text-danger">{e.message}</div>
                      ))}
                      {row.warnings?.map((w, i) => (
                        <div key={`w-${i}`} className="text-warning">{w.message}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
