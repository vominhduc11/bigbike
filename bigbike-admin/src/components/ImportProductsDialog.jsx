import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'
import { Modal } from '@/components/layout/Modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { AdminTable } from '@/components/AdminTable'
import { toast } from '@/lib/toast'
import {
  ApiClientError,
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

export function ImportProductsDialog({ file, open, onClose }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [step, setStep] = useState('validating')
  const [report, setReport] = useState(null)
  const [excludedRowKeys, setExcludedRowKeys] = useState(new Set())
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open || !file) return
    let cancelled = false
    importProductsValidate(file).then((result) => {
      if (cancelled) return
      setReport(result)
      setExcludedRowKeys(new Set(result.rows.filter((r) => r.status === 'ERROR').map((r) => r.rowKey)))
      setStep('review')
    }).catch((err) => {
      if (cancelled) return
      // Chỉ hiện thông báo từ máy chủ (ApiClientError, đã thân thiện); lỗi kỹ thuật khác → thông báo chung.
      setError(err instanceof ApiClientError ? err.message : t('import.error'))
      setStep('error')
    })
    return () => { cancelled = true }
  }, [open, file, t])

  function handleClose() {
    // Chặn đóng khi đang lưu để không bỏ dở giữa chừng (backdrop/Esc/nút X đều gọi hàm này).
    if (step === 'committing') return
    onClose?.()
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
      // Chỉ hiện thông báo từ máy chủ (ApiClientError, đã thân thiện); lỗi kỹ thuật khác → thông báo chung.
      setError(err instanceof ApiClientError ? err.message : t('import.error'))
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

  const reportRows = (report?.rows ?? []).map((row) => ({ ...row, id: row.rowKey }))
  const renderDetails = (row) => (
    <>
      {row.errors?.map((item, index) => (
        <div key={`e-${index}`} className="text-danger">{item.message}</div>
      ))}
      {row.warnings?.map((item, index) => (
        <div key={`w-${index}`} className="text-warning">{item.message}</div>
      ))}
    </>
  )
  const reportColumns = [
    ...(step === 'review' ? [{
      key: 'selection',
      label: <span className="sr-only">{t('common.selectRow', { defaultValue: 'Chọn hàng' })}</span>,
      render: (row) => (
        <Checkbox
          disabled={row.status === 'ERROR'}
          checked={!excludedRowKeys.has(row.rowKey)}
          onCheckedChange={() => toggleRow(row.rowKey)}
          aria-label={t('import.rowCheckboxLabel', { name: row.productName || row.rowKey })}
        />
      ),
      headerClassName: 'w-10',
    }] : []),
    { key: 'rowNumber', label: t('import.colRow') },
    { key: 'productName', label: t('import.colProduct'), render: (row) => row.productName || '—' },
    { key: 'action', label: t('import.colAction'), render: (row) => actionLabel(t, row.action) },
    { key: 'status', label: t('import.colStatus'), render: (row) => <StatusBadge t={t} status={row.status} /> },
    { key: 'detail', label: t('import.colDetail'), render: renderDetails },
  ]

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('import.dialogTitle')}
      contentClassName="p-0 flex flex-col max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl"
      actions={actions}
    >
      {(step === 'validating' || step === 'committing') && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center" role="status" aria-live="polite">
          <Loader2 size={16} className="animate-spin" aria-hidden />
          {t(step === 'validating' ? 'import.validating' : 'import.committing')}
        </div>
      )}

      {step === 'error' && (
        <div className="text-sm text-danger py-6" role="alert">{error}</div>
      )}

      {(step === 'review' || step === 'done') && report && (
        <div className="space-y-3">
          {error ? <div className="text-sm text-danger" role="alert">{error}</div> : null}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" role="status" aria-live="polite">
            <span className="text-success">{t('import.okCount', { count: report.okCount })}</span>
            <span className="text-warning">{t('import.warningCount', { count: report.warningCount })}</span>
            <span className="text-danger">{t('import.errorCount', { count: report.errorCount })}</span>
            {report.skippedCount > 0 && (
              <span className="text-muted-foreground">{t('import.skippedCount', { count: report.skippedCount })}</span>
            )}
          </div>
          <AdminTable
            columns={reportColumns}
            rows={reportRows}
            caption={t('import.tableCaption', { defaultValue: 'Kết quả kiểm tra từng dòng sản phẩm trong tệp nhập' })}
            containerClassName="max-h-[50vh] rounded-[var(--admin-radius-card)] border border-border"
            mobileCard={(row) => ({
              title: row.productName || '—',
              subtitle: `${t('import.colRow')}: ${row.rowNumber}`,
              status: <StatusBadge t={t} status={row.status} />,
              meta: [
                { label: t('import.colAction'), value: actionLabel(t, row.action) },
                { label: t('import.colDetail'), value: renderDetails(row) },
              ],
              selectable: step === 'review' && row.status !== 'ERROR',
              selected: !excludedRowKeys.has(row.rowKey),
              onSelectChange: () => toggleRow(row.rowKey),
              selectionLabel: t('import.rowCheckboxLabel', { name: row.productName || row.rowKey }),
            })}
          />
        </div>
      )}
    </Modal>
  )
}
