import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/textarea'
import { parseSerialBatch, parseSerialFromFile, SERIAL_PREVIEW_LIMIT, FILE_IMPORT_SIZE_LIMIT_MB } from './constants'

export function SerialListInput({ onChange, disabled, maxCount }) {
  const { t } = useTranslation()
  const [batchText, setBatchText] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const parsed = useMemo(() => parseSerialBatch(batchText), [batchText])

  function handleTextChange(e) {
    const val = e.target.value
    setBatchText(val)
    if (importError) setImportError('')
    onChange(parseSerialBatch(val).unique)
  }

  function handleClearAll() {
    setBatchText('')
    setImportError('')
    onChange([])
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportError('')
    try {
      const rawSerials = await parseSerialFromFile(file)
      const newText = rawSerials.join('\n')
      setBatchText(newText)
      onChange(parseSerialBatch(newText).unique)
      if (!panelOpen) setPanelOpen(true)
    } catch (err) {
      if (err.message === 'FILE_TOO_BIG') {
        setImportError(t('inventory.stockIn.errorFileTooBig', { mb: err.limitMb ?? FILE_IMPORT_SIZE_LIMIT_MB }))
      } else if (err.message === 'FILE_UNSUPPORTED') {
        setImportError(t('inventory.stockIn.errorFileUnsupported'))
      } else {
        setImportError(t('inventory.stockIn.errorFileParseFailed'))
      }
    } finally {
      setImporting(false)
    }
  }

  function handleRemoveSerial(idx) {
    const next = parsed.unique.filter((_, i) => i !== idx)
    setBatchText(next.join('\n'))
    onChange(next)
  }

  function handleCopyErrors() {
    if (parsed.dupeList.length === 0) return
    navigator.clipboard?.writeText(parsed.dupeList.join('\n')).catch(() => {})
  }

  function handleDownloadErrors() {
    if (parsed.dupeList.length === 0) return
    const blob = new Blob([parsed.dupeList.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'serial-duplicates.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleTogglePanel() {
    const next = !panelOpen
    setPanelOpen(next)
    if (next) setTimeout(() => textareaRef.current?.focus(), 60)
  }

  const hasContent = parsed.unique.length > 0 || batchText.trim().length > 0
  const safeMax = Number.isFinite(maxCount) && maxCount > 0 ? maxCount : 0
  const exceeds = safeMax > 0 && parsed.unique.length > safeMax
  const underfill = safeMax > 0 && parsed.unique.length < safeMax
  const previewList = parsed.unique.slice(0, SERIAL_PREVIEW_LIMIT)
  const hiddenCount = parsed.unique.length - previewList.length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1.5">
        <label className="form-label m-0">
          {t('inventory.stockIn.labelSerials')}{' '}
          <span aria-hidden="true" className="text-primary">*</span>
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {hasContent && (
            <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
              onClick={handleClearAll} disabled={disabled || importing}>
              {t('inventory.stockIn.serialsClearAll')}
            </button>
          )}
          <button
            type="button"
            className="bb-btn bb-btn-secondary bb-btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || importing}
          >
            {importing
              ? t('inventory.stockIn.serialsImportFileParsing')
              : t('inventory.stockIn.serialsImportFile')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            aria-label={t('inventory.stockIn.serialsImportFileLabel')}
            className="hidden"
            onChange={handleFileImport}
          />
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
            onClick={handleTogglePanel} disabled={disabled || importing}>
            {panelOpen
              ? t('inventory.stockIn.serialsBatchClose')
              : t('inventory.stockIn.serialsBatchTitle')}
          </button>
        </div>
      </div>

      {/* File import error */}
      {importError && (
        <p role="alert" className="text-danger text-sm mb-1.5">
          {importError}
        </p>
      )}

      {/* Batch textarea panel */}
      {panelOpen && (
        <div className="mb-3">
          <label htmlFor="serial-batch-input" className="text-xs text-muted-foreground block mb-1">
            {t('inventory.stockIn.serialsBatchPanelLabel')}
          </label>
          <Textarea
            id="serial-batch-input"
            ref={textareaRef}
            rows={8}
            value={batchText}
            onChange={handleTextChange}
            disabled={disabled}
            placeholder={t('inventory.stockIn.serialsBulkPlaceholder')}
            className="font-mono text-xs resize-y w-full max-h-80"
            aria-label={t('inventory.stockIn.serialsBatchPanelLabel')}
           />
        </div>
      )}

      {/* Summary strip */}
      {hasContent && (
        <div className="bg-surface border border-border rounded-xs px-3 py-1.5 mb-2 text-xs flex flex-wrap gap-x-4 gap-y-2 items-center">
          {safeMax > 0 && (
            <span className={`font-bold ${exceeds ? 'text-danger' : underfill ? 'text-warning' : 'text-success'}`}>
              {parsed.unique.length} / {safeMax} serial
            </span>
          )}
          <span>
            <strong>{parsed.raw.length}</strong>{' '}
            {t('inventory.stockIn.serialsSummaryTotal')}
          </span>
          {parsed.blank > 0 && (
            <span className="text-muted-foreground">
              <strong>{parsed.blank}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryBlank')}
            </span>
          )}
          {parsed.dupeCount > 0 && (
            <span className="text-warning">
              <strong>{parsed.dupeCount}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryDupes')}
            </span>
          )}
          {exceeds && (
            <span className="text-danger">
              <strong>{parsed.unique.length - safeMax}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryExceeds')}
            </span>
          )}
        </div>
      )}

      {/* Duplicate warning + copy/download actions */}
      {parsed.dupeCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="text-xs text-warning flex-1">
            {t('inventory.stockIn.warnSerialDuplicateAutoRemoved', { count: parsed.dupeCount })}
          </span>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
            onClick={handleCopyErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsCopyErrors')}
          </button>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
            onClick={handleDownloadErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsDownloadErrors')}
          </button>
        </div>
      )}

      {/* Exceed-quantity error */}
      {exceeds && (
        <p role="alert" className="text-danger text-sm mb-1.5">
          {t('inventory.stockIn.errorSerialCount', { serials: parsed.unique.length, qty: safeMax })}
        </p>
      )}

      {/* Underfill error */}
      {hasContent && underfill && (
        <p role="alert" className="text-warning text-sm mb-1.5">
          {t('inventory.stockIn.errorSerialCountTooFew', { serials: parsed.unique.length, qty: safeMax })}
        </p>
      )}

      {/* Serial preview list (max SERIAL_PREVIEW_LIMIT rows + overflow indicator) */}
      {parsed.unique.length > 0 && (
        <div
          role="list"
          aria-label={t('inventory.stockIn.labelSerials')}
          className="border border-border rounded-xs max-h-60 overflow-y-auto"
        >
          {previewList.map((s, idx) => (
            <div key={idx} role="listitem" className={`flex items-center px-2 py-0.5 text-xs${idx < previewList.length - 1 || hiddenCount > 0 ? ' border-b border-border' : ''}`}>
              <span className="text-muted-foreground min-w-8 shrink-0 text-xs">
                {idx + 1}.
              </span>
              <span className="font-mono flex-1 break-all">{s}</span>
              <button
                type="button"
                onClick={() => handleRemoveSerial(idx)}
                disabled={disabled}
                aria-label={`${t('inventory.stockIn.removeSerial')} ${s}`}
                className={`bg-transparent border-none shrink-0 px-1 text-sm text-muted-foreground${disabled ? ' cursor-not-allowed opacity-50' : ' cursor-pointer'}`}
              >
                ✕
              </button>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="px-2 py-1 text-xs text-muted-foreground text-center bg-surface">
              + {hiddenCount} {t('inventory.stockIn.serialsPreviewMore')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
