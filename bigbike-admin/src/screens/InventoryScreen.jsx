import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { Modal } from '../components/layout'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_CLASSES,
  SERIAL_ALLOWED_TRANSITIONS,
  NOTE_REQUIRED_STATUSES,
} from '../lib/serialStateMachine'
import {
  adjustStock,
  adjustProductStock,
  fetchInventory,
  fetchInventoryGrouped,
  fetchInventorySummary,
  fetchProductMovements,
  fetchVariantMovements,
  fetchSerialInventoryOnly,
  downloadInventoryCsv,
  fetchVariantSerials,
  fetchProductSerials,
  importBulkSerials,
  updateSerialStatus,
} from '../lib/adminApi'
import { StockStatusBadge } from '../components/StatusBadge'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { showConfirm } from '../lib/confirm'
import { useAdminList } from '../lib/useAdminList'
import { useDebounce } from '../lib/useDebounce'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const STOCK_STATES = ['ALL', 'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK']


// ── Components ─────────────────────────────────────────────────────────────────

function ProductThumbnail({ image, alt, size = 40 }) {
  const [errored, setErrored] = useState(false)
  const src = image?.url
  const label = image?.alt || alt || ''

  if (!src || errored) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, flexShrink: 0,
          fontSize: size * 0.45,
        }}
        className="rounded-sm bg-surface-muted border border-border text-muted-foreground"
      >
        ◻
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      style={{
        width: size, height: size, flexShrink: 0,
        objectFit: 'cover',
        display: 'block',
      }}
      className="rounded-sm border border-border"
    />
  )
}

const MOVEMENT_TYPE_CLASSES = { IN: 'text-success', OUT: 'text-danger', RETURN: 'text-info' }

function MovementTypeBadge({ type }) {
  return (
    <span className={`font-semibold text-xs ${MOVEMENT_TYPE_CLASSES[type] ?? 'text-muted-foreground'}`}>
      {type}
    </span>
  )
}

function SummaryBanner({ summary }) {
  const { t } = useTranslation()
  if (!summary || summary.totalItems === 0) return null
  return (
    <div className="flex gap-4 mb-4 flex-wrap">
      {summary.outOfStockCount > 0 && (
        <div className="bg-danger-bg border border-danger-border rounded-sm px-4 py-2">
          <span className="text-danger font-bold">{summary.outOfStockCount}</span>
          <span className="text-danger ml-1.5 text-sm">{t('inventory.summary.outOfStock')}</span>
        </div>
      )}
      {summary.lowStockCount > 0 && (
        <div className="bg-warning-bg border border-warning-border rounded-sm px-4 py-2">
          <span className="text-warning font-bold">{summary.lowStockCount}</span>
          <span className="text-warning ml-1.5 text-sm">{t('inventory.summary.lowStock')}</span>
        </div>
      )}
      <div className="bg-surface border border-border rounded-sm px-4 py-2">
        <span className="font-bold">{summary.totalItems}</span>
        <span className="ml-1.5 text-sm text-muted-foreground">{t('inventory.summary.totalItems')}</span>
      </div>
    </div>
  )
}

// ── Serial batch helpers ──────────────────────────────────────────────────────

const SERIAL_PREVIEW_LIMIT = 30

function parseSerialBatch(text) {
  if (!text) return { raw: [], unique: [], blank: 0, dupeCount: 0, dupeList: [] }
  const lines = text.split('\n')
  let blank = 0
  const raw = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) { blank++; continue }
    raw.push(t)
  }
  const seen = new Set()
  const dupes = new Set()
  const unique = []
  for (const s of raw) {
    if (seen.has(s)) { dupes.add(s) }
    else { seen.add(s); unique.push(s) }
  }
  return { raw, unique, blank, dupeCount: dupes.size, dupeList: Array.from(dupes) }
}

// ── Serial file import helpers ────────────────────────────────────────────────

const SERIAL_HEADER_NAMES = new Set([
  'serial', 'serial_number', 'serialnumber', 'serial number',
  's/n', 'sn', 'imei', 'ma_serial', 'mã serial', 'so_serial', 'số serial',
])
const FILE_IMPORT_SIZE_LIMIT_MB = 5
const FILE_IMPORT_SIZE_LIMIT_BYTES = FILE_IMPORT_SIZE_LIMIT_MB * 1024 * 1024

function detectSerialColumnIndex(firstRow) {
  const idx = firstRow.findIndex(
    (cell) => cell != null && SERIAL_HEADER_NAMES.has(String(cell).trim().toLowerCase()),
  )
  return idx >= 0 ? idx : 0
}

function extractSerialsFromRows(rows) {
  if (rows.length === 0) return []
  const firstRow = rows[0].map((c) => (c == null ? '' : String(c).trim()))
  const colIdx = detectSerialColumnIndex(firstRow)
  const hasHeader = firstRow.some((cell) => SERIAL_HEADER_NAMES.has(cell.toLowerCase()))
  const startRow = hasHeader ? 1 : 0
  const serials = []
  for (let i = startRow; i < rows.length; i++) {
    const cell = rows[i][colIdx]
    if (cell == null) continue
    const val = String(cell).trim()
    if (val) serials.push(val)
  }
  return serials
}

function detectCsvDelimiter(firstLine) {
  const tabs = (firstLine.match(/\t/g) || []).length
  const semis = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length
  if (tabs > semis && tabs > commas) return '\t'
  if (semis > commas) return ';'
  return ','
}

function parseSerialFromCsvText(text) {
  const lines = text.replace(/^\\uFEFF/, '').split(/\r?\n/)
  const delimiter = detectCsvDelimiter(lines[0] || '')
  const rows = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))
  return extractSerialsFromRows(rows)
}

async function parseSerialFromExcelBuffer(buffer) {
  const xlsxModule = await import('xlsx')
  const XLSX = xlsxModule.default ?? xlsxModule
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
  return extractSerialsFromRows(rows)
}

// Returns string[] — serial values only (used by SerialListInput / stock-in form)
async function parseSerialFromFile(file) {
  if (file.size > FILE_IMPORT_SIZE_LIMIT_BYTES) {
    const err = new Error('FILE_TOO_BIG')
    err.limitMb = FILE_IMPORT_SIZE_LIMIT_MB
    throw err
  }
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext === 'csv' || ext === 'txt') {
    return parseSerialFromCsvText(await file.text())
  }
  if (ext === 'xlsx' || ext === 'xls') {
    return parseSerialFromExcelBuffer(await file.arrayBuffer())
  }
  const err = new Error('FILE_UNSUPPORTED')
  throw err
}

// Returns {serial: string}[] — structured shape used by AddSerialsPanel
async function parseSerialFileAsObjects(file) {
  const serials = await parseSerialFromFile(file)
  return serials.map((s) => ({ serial: s }))
}

// ── SerialListInput ───────────────────────────────────────────────────────────

function SerialListInput({ onChange, disabled, maxCount }) {
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
            <Button variant="outline" size="sm"
              onClick={handleClearAll} disabled={disabled || importing}>
              {t('inventory.stockIn.serialsClearAll')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || importing}
          >
            {importing
              ? t('inventory.stockIn.serialsImportFileParsing')
              : t('inventory.stockIn.serialsImportFile')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            aria-label={t('inventory.stockIn.serialsImportFileLabel')}
            className="hidden"
            onChange={handleFileImport}
          />
          <Button variant="outline" size="sm"
            onClick={handleTogglePanel} disabled={disabled || importing}>
            {panelOpen
              ? t('inventory.stockIn.serialsBatchClose')
              : t('inventory.stockIn.serialsBatchTitle')}
          </Button>
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
          <Button variant="outline" size="sm"
            onClick={handleCopyErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsCopyErrors')}
          </Button>
          <Button variant="outline" size="sm"
            onClick={handleDownloadErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsDownloadErrors')}
          </Button>
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

// ── StockInModal ──────────────────────────────────────────────────────────────

function StockInModal({ item, onSuccess, onClose }) {
  const { t } = useTranslation()
  const [selectedItem, setSelectedItem] = useState(item || null)
  const [showPicker, setShowPicker] = useState(!item)
  const [pickerSearch, setPickerSearch] = useState('')
  const debouncedPickerSearch = useDebounce(pickerSearch, 250)
  const [pickerState, setPickerState] = useState({ status: item ? 'idle' : 'loading', items: [] })
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [serials, setSerials] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const searchRef = useRef(null)
  const qtyRef = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => {
      if (item) qtyRef.current?.focus()
      else searchRef.current?.focus()
    }, 60)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (item) return undefined

    let active = true
    Promise.resolve().then(() => {
      if (active) setPickerState((s) => ({ ...s, status: 'loading' }))
    })

    fetchInventory({
      q: debouncedPickerSearch,
      stockState: 'ALL',
      page: 1,
      pageSize: 8,
    })
      .then((r) => {
        if (!active) return
        setPickerState({ status: 'success', items: r.items || [] })
      })
      .catch((e) => {
        if (!active) return
        setPickerState({ status: 'error', items: [], error: e.message })
      })

    return () => { active = false }
  }, [item, debouncedPickerSearch])

  function handleSelectVariant(candidate) {
    setSelectedItem(candidate)
    setShowPicker(false)
    setQuantity('')
    setSerials([])
    setFormError('')
    setTimeout(() => qtyRef.current?.focus(), 60)
  }

  function handleChangeVariant() {
    setSelectedItem(null)
    setShowPicker(true)
    setQuantity('')
    setSerials([])
    setFormError('')
    setTimeout(() => searchRef.current?.focus(), 60)
  }

  const isVariantItem = Boolean(selectedItem?.variantId)

  function validate() {
    const qty = parseInt(quantity, 10)
    if (!selectedItem?.variantId && !selectedItem?.productId) {
      return t('inventory.stockIn.errorVariantRequired', { defaultValue: 'Vui lòng chọn sản phẩm cần nhập hàng.' })
    }
    if (!quantity || isNaN(qty) || qty < 1) {
      return t('inventory.stockIn.errorQtyRequired')
    }
    if (serials.length > qty) {
      return t('inventory.stockIn.errorSerialCount', { serials: serials.length, qty })
    }
    if (serials.length < qty) {
      return t('inventory.stockIn.errorSerialCountTooFew', { serials: serials.length, qty })
    }
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setFormError(validationError); return }
    setFormError('')
    setSubmitting(true)
    try {
      const qty = parseInt(quantity, 10)
      if (isVariantItem) {
        await adjustStock(selectedItem.variantId, qty, 'IN', note.trim() || undefined, serials)
      } else {
        await adjustProductStock(selectedItem.productId, qty, 'IN', note.trim() || undefined, serials)
      }
      toast.success(t('inventory.stockIn.success', { qty }))
      onSuccess()
    } catch (err) {
      setFormError(err.message || t('inventory.stockIn.errorGeneric'))
    } finally {
      setSubmitting(false)
    }
  }

  const variantLabel = selectedItem
    ? [selectedItem.variantName, selectedItem.variantSku].filter(Boolean).join(' · ') || '—'
    : '—'

  return (
    <Modal
      open
      wide
      title={t('inventory.stockIn.title')}
      onClose={submitting ? undefined : onClose}
      actions={
        <>
          {formError && <p className="field-error mr-auto">{formError}</p>}
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="stock-in-form" size="sm" loading={submitting}>
            {t('inventory.stockIn.submit')}
          </Button>
        </>
      }
    >
        <div>

          {/* Variant picker — shown when no pre-selected item and user hasn't chosen yet */}
          {!item && showPicker && (
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-variant-search">
                {t('inventory.stockIn.selectItem', { defaultValue: 'Chọn sản phẩm / biến thể' })}
              </label>
              <Input
                id="stock-in-variant-search"
                ref={searchRef}
                type="search"
                value={pickerSearch}
                onChange={(e) => { setPickerSearch(e.target.value); setFormError('') }}
                placeholder={t('inventory.stockIn.searchPlaceholder', { defaultValue: 'Tìm tên sản phẩm, SKU...' })}
                disabled={submitting}
               />
              <div className="variant-picker-list">
                {pickerState.status === 'loading' && (
                  <div className="p-3 text-muted-foreground">
                    {t('common.loading')}
                  </div>
                )}
                {pickerState.status === 'error' && (
                  <div className="p-3 text-danger">
                    {pickerState.error}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.length === 0 && (
                  <div className="p-3 text-muted-foreground">
                    {t('inventory.stockIn.noItemResults', { defaultValue: 'Không tìm thấy sản phẩm phù hợp.' })}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.map((candidate) => {
                  const isSelected = selectedItem?.variantId === candidate.variantId
                  return (
                    <button
                      key={candidate.variantId || candidate.id}
                      type="button"
                      className={cn('variant-picker-item', isSelected && 'bg-primary/10')}
                      onClick={() => handleSelectVariant(candidate)}
                      disabled={submitting}
                    >
                      <span className="variant-picker-item__name">
                        {candidate.productName || '—'}
                        <span className="variant-picker-item__meta">
                          {candidate.variantId
                            ? ([candidate.variantName, candidate.variantSku].filter(Boolean).join(' · ') || '—')
                            : <em className="italic text-muted-foreground">Không có biến thể</em>
                          }
                        </span>
                      </span>
                      <span className="variant-picker-item__qty">
                        {candidate.quantityOnHand ?? 0}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected item summary */}
          {selectedItem && (
            <>
              <div className="variant-summary">
                <div className="variant-summary__info">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t('inventory.colProduct')}:{' '}
                    </span>
                    <strong className="variant-summary__product-name">
                      {selectedItem.productName || '—'}
                    </strong>
                  </div>
                  {isVariantItem && (
                    <div>
                      <span className="text-muted-foreground text-xs">
                        {t('inventory.colVariant')}:{' '}
                      </span>
                      <strong>{variantLabel}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground text-xs">
                      {t('inventory.stockIn.currentQty')}:{' '}
                    </span>
                    <strong>{selectedItem.quantityOnHand ?? '—'}</strong>
                  </div>
                </div>
                {!item && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleChangeVariant}
                    disabled={submitting}
                  >
                    {t('inventory.stockIn.changeItem', { defaultValue: 'Đổi sản phẩm' })}
                  </Button>
                )}
              </div>
              {selectedItem.forceOutOfStock && (
                <Alert tone="warning" size="sm" className="mb-3">
                  <strong>Lưu ý:</strong> Sản phẩm đang bị khoá trạng thái "Hết hàng" (forceOutOfStock). Sau khi nhập hàng, sản phẩm vẫn hiển thị là "Hết hàng" trên website cho đến khi tắt cờ này trong trang chỉnh sửa sản phẩm.
                </Alert>
              )}
            </>
          )}

          {/* Form fields — id links to submit button in footer */}
          <form id="stock-in-form" onSubmit={handleSubmit}>
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-qty">
                {t('inventory.stockIn.labelQty')}{' '}
                <span aria-hidden="true" className="text-primary">*</span>
              </label>
              <Input
                id="stock-in-qty"
                ref={qtyRef}
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => { setQuantity(e.target.value); setFormError('') }}
                disabled={submitting}
                placeholder="1"
               />
            </div>

            <div className="form-group mb-4">
              <label className="form-label" htmlFor="stock-in-note">
                {t('inventory.stockIn.labelNote')}
              </label>
              <Input
                id="stock-in-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={submitting}
                placeholder={t('inventory.stockIn.notePlaceholder')}
               />
            </div>

            <div className="form-group">
              <SerialListInput
                onChange={(next) => { setSerials(next); setFormError('') }}
                disabled={submitting}
                maxCount={parseInt(quantity, 10) || 0}
              />
            </div>
          </form>
        </div>
    </Modal>
  )
}

// ── Serial management modal ───────────────────────────────────────────────────

function SerialStatusBadge({ status }) {
  const label = SERIAL_STATUS_LABELS[status] || status
  const classes = SERIAL_STATUS_CLASSES[status] || 'text-muted-foreground bg-muted'
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>{label}</span>
}

// ── AddSerialsPanel ────────────────────────────────────────────────────────────

function AddSerialsPanel({ item, onSuccess }) {
  const isVariant = Boolean(item?.variantId)
  const [rows, setRows] = useState([{ serial: '' }])
  const [supplierNote, setSupplierNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // File import state
  const [parsing, setParsing] = useState(false)
  const [parsePreview, setParsePreview] = useState(null) // { total, valid, blank }

  // Result state after submit
  const [importResult, setImportResult] = useState(null) // { inserted, skipped, errors[] }

  function addRow() { setRows((r) => [...r, { serial: '' }]) }
  function removeRow(i) { setRows((r) => r.filter((_, idx) => idx !== i)) }
  function updateRow(i, field, val) {
    setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
    setImportResult(null)
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setParsing(true)
    setParsePreview(null)
    setImportResult(null)
    try {
      const pairs = await parseSerialFileAsObjects(file)
      const valid = pairs.filter((r) => r.serial)
      const blank = pairs.length - valid.length
      setParsePreview({ total: pairs.length, valid: valid.length, blank })
      setRows(valid.length > 0 ? valid : [{ serial: '' }])
      if (valid.length === 0) setError('File không có dòng hợp lệ nào.')
      else setError('')
    } catch (err) {
      const msg = err.message === 'FILE_TOO_BIG' ? 'File quá lớn (tối đa 5 MB).'
               : err.message === 'FILE_UNSUPPORTED' ? 'Chỉ chấp nhận .csv, .txt, .xlsx, .xls.'
               : 'Không thể đọc file. Kiểm tra lại định dạng.'
      setError(msg)
    } finally {
      setParsing(false)
    }
  }

  function handleRetrySkipped() {
    if (!importResult) return
    const errorIndices = new Set(importResult.errors.map((e) => e.rowIndex))
    const failedRows = rows.filter((_, i) => errorIndices.has(i))
    setRows(failedRows.length > 0 ? failedRows : [{ serial: '' }])
    setImportResult(null)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validRows = rows.filter((r) => r.serial.trim())
    if (validRows.length === 0) {
      setError('Vui lòng nhập ít nhất một mã serial.')
      return
    }
    setError('')
    setSubmitting(true)
    setImportResult(null)
    try {
      const importRows = validRows.map((r) => ({
        productId: item.productId,
        variantId: isVariant ? item.variantId : undefined,
        serialNumber: r.serial.trim(),
        note: supplierNote.trim() || undefined,
      }))
      const result = await importBulkSerials(importRows, true)
      setImportResult(result)
      if (result.skipped === 0) {
        toast.success(`Đã nhập ${result.inserted} serial vào kho.`)
        setRows([{ serial: '' }])
        setSupplierNote('')
        setParsePreview(null)
        onSuccess()
      } else {
        toast.success(`Nhập ${result.inserted} serial thành công, bỏ qua ${result.skipped} dòng lỗi.`)
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi nhập serial.')
    } finally {
      setSubmitting(false)
    }
  }

  const validCount = rows.filter((r) => r.serial.trim()).length

  return (
    <form onSubmit={handleSubmit}>
      {/* Supplier note — nổi bật ở đầu form */}
      <div className="form-group mb-4">
        <label className="form-label" htmlFor="serial-supplier-note">
          Số phiếu xuất / hoá đơn nhà phân phối
          <span className="font-normal text-muted-foreground ml-1.5">(tuỳ chọn)</span>
        </label>
        <Input
          id="serial-supplier-note"
          className="w-full"
          placeholder="VD: HD-2025-001, Phiếu xuất kho ABC..."
          value={supplierNote}
          onChange={(e) => setSupplierNote(e.target.value)}
          disabled={submitting}
         />
        <p className="text-xs text-muted-foreground mt-1">
          Ghi chú sẽ được lưu kèm mỗi serial trong lô nhập này.
        </p>
      </div>

      {/* File import */}
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <p className="form-label m-0">Danh sách serial nhận về</p>
        <Button variant="outline" size="sm"
          onClick={() => fileInputRef.current?.click()} disabled={submitting || parsing}>
          {parsing ? 'Đang đọc file…' : 'Import từ file'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls"
          className="hidden" onChange={handleFileImport} />
        <span className="text-xs text-muted-foreground">
          CSV / Excel — 1 cột: Mã serial
        </span>
      </div>

      {/* Parse preview */}
      {parsePreview && (
        <div className="flex flex-wrap gap-4 text-xs text-success bg-success-bg border border-success-border px-3 py-2 mb-2.5">
          <span>Tổng dòng: <strong>{parsePreview.total}</strong></span>
          <span>Hợp lệ: <strong>{parsePreview.valid}</strong></span>
          {parsePreview.blank > 0 && <span>Dòng trống bỏ qua: <strong>{parsePreview.blank}</strong></span>}
        </div>
      )}

      {/* Manual row table */}
      <p className="text-xs text-muted-foreground mb-1.5">
        Mỗi dòng là một sản phẩm — nhập mã serial.
      </p>
      <table className="w-full border-collapse text-xs mb-2.5">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-1 px-1.5 font-semibold w-8">#</th>
            <th className="text-left py-1 px-1.5 font-semibold">Mã serial</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="py-1 px-1.5 text-muted-foreground">{i + 1}</td>
              <td className="py-1 px-1.5">
                <Input className="w-full"
                  placeholder="VD: SN-20240001"
                  value={row.serial}
                  onChange={(e) => updateRow(i, 'serial', e.target.value)}
                  disabled={submitting}  />
              </td>
              <td className="py-1 px-1.5">
                {rows.length > 1 && (
                  <Button variant="ghost" size="icon"
                    onClick={() => removeRow(i)} disabled={submitting} aria-label="Xoá dòng">✕</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="outline" className="mb-3.5"
        onClick={addRow} disabled={submitting}>
        + Thêm dòng
      </Button>

      {error && (
        <p role="alert" className="text-destructive text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <Button type="submit" disabled={submitting || validCount === 0}>
          {submitting ? 'Đang nhập…' : `Nhập ${validCount} serial`}
        </Button>
      </div>

      {/* Import result — skipped rows with reasons */}
      {importResult && importResult.skipped > 0 && (
        <div className="mt-4 bg-warning-bg border border-warning-border px-3.5 py-3">
          <p className="font-semibold text-sm mb-1.5">
            Kết quả: {importResult.inserted} nhập thành công · {importResult.skipped} dòng bị bỏ qua
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-warning-border">
                <th className="text-left py-0.5 px-1.5">Dòng</th>
                <th className="text-left py-0.5 px-1.5">Trường</th>
                <th className="text-left py-0.5 px-1.5">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {importResult.errors.map((err, idx) => (
                <tr key={idx} className="border-b border-warning-border">
                  <td className="py-0.5 px-1.5 font-mono">{err.rowIndex + 1}</td>
                  <td className="text-warning py-0.5 px-1.5">{err.field}</td>
                  <td className="py-0.5 px-1.5">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="outline" size="sm" className="mt-2.5"
            onClick={handleRetrySkipped}>
            Tải lại {importResult.skipped} dòng lỗi để sửa
          </Button>
        </div>
      )}

      {importResult && importResult.skipped === 0 && importResult.inserted > 0 && (
        <div className="mt-3 bg-success-bg border border-success-border px-3.5 py-2.5 text-sm text-success">
          ✓ Đã nhập thành công {importResult.inserted} serial vào kho.
        </div>
      )}
    </form>
  )
}

// ── SerialQrModal ─────────────────────────────────────────────────────────────

function SerialQrModal({ serial, onClose }) {
  const qrRef = useRef(null)
  const qrValue = serial.serialNumber || ''
  const label   = serial.serialNumber || ''

  function handlePrint() {
    const style = document.createElement('style')
    style.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #serial-qr-print, #serial-qr-print * { visibility: visible !important; }
        #serial-qr-print {
          position: fixed !important; inset: 0 !important;
          display: flex !important; flex-direction: column !important;
          align-items: center !important; justify-content: center !important;
          gap: 10px !important; background: white !important;
        }
      }
    `
    document.head.appendChild(style)
    window.print()
    document.head.removeChild(style)
  }

  return (
    <Modal
      open
      title="Mã QR Serial"
      onClose={onClose}
      actions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Đóng</Button>
          <Button type="button" size="sm" onClick={handlePrint} disabled={!qrValue}>In QR</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div id="serial-qr-print" ref={qrRef} className="flex flex-col items-center gap-2">
          {qrValue ? (
            <QRCodeSVG value={qrValue} size={180} level="H" marginSize={2} />
          ) : (
            <p className="text-sm text-muted-foreground">Không có dữ liệu để tạo QR.</p>
          )}
          <p className="font-mono font-bold text-sm tracking-wide">{label}</p>
          {serial.receivedAt && (
            <p className="text-xs text-muted-foreground">Nhập kho: {formatDateTime(serial.receivedAt)}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── SerialListPanel ───────────────────────────────────────────────────────────

function SerialListPanel({ item, refreshKey }) {
  const isVariant = Boolean(item?.variantId)
  const [query, setQuery] = useState({ page: 1, pageSize: 20, status: '' })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })
  const [statusChangeId, setStatusChangeId] = useState(null)
  const [statusChangeValue, setStatusChangeValue] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [changing, setChanging] = useState(false)
  const [qrSerial, setQrSerial] = useState(null)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, status: 'loading' }))
    const fetch = isVariant
      ? fetchVariantSerials(item.variantId, query)
      : fetchProductSerials(item.productId, query)
    fetch.then((data) => {
      if (!active) return
      setState({ status: 'success', items: data.items || [], pagination: data.pagination || null })
    }).catch((err) => {
      if (!active) return
      setState({ status: 'error', items: [], pagination: null, error: err.message })
    })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, query, refreshKey])

  async function handleStatusChange(serialId) {
    if (!statusChangeValue) return
    if (NOTE_REQUIRED_STATUSES.has(statusChangeValue) && !statusNote.trim()) {
      toast.error('Lý do bắt buộc khi chuyển sang trạng thái ' + (SERIAL_STATUS_LABELS[statusChangeValue] ?? statusChangeValue) + '.')
      return
    }
    // SCRAPPED is terminal — require explicit confirmation, consistent with
    // the serial detail modal in SerialListScreen.
    if (statusChangeValue === 'SCRAPPED') {
      const ok = await showConfirm(
        'Chuyển serial sang trạng thái Đã hủy?\n\nTrạng thái này không thể hoàn tác.',
        'Xác nhận hủy serial',
      )
      if (!ok) return
    }
    setChanging(true)
    try {
      const res = await updateSerialStatus(serialId, statusChangeValue, statusNote.trim() || undefined)
      setState((s) => ({
        ...s,
        items: s.items.map((i) => i.id === serialId ? res.item : i),
      }))
      toast.success(`Đã chuyển serial sang ${SERIAL_STATUS_LABELS[statusChangeValue] ?? statusChangeValue}.`)
      setStatusChangeId(null)
      setStatusChangeValue('')
      setStatusNote('')
    } catch (err) {
      toast.error(err.message || 'Lỗi cập nhật trạng thái.')
    } finally {
      setChanging(false)
    }
  }

  if (state.status === 'error') {
    return <p className="text-destructive text-xs">Lỗi: {state.error}</p>
  }

  return (
    <>
      <div className="flex gap-2 mb-3 items-center">
        <label className="text-xs">
          Lọc trạng thái:
          <Select className="ml-1.5" value={(query.status) || '__all__'}
            onValueChange={(val) => { const v = val === '__all__' ? '' : val; setQuery((q) => ({ ...q, status: v, page: 1 })) }}><SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger><SelectContent>
            <SelectItem value="__all__">Tất cả trạng thái</SelectItem>
            {Object.keys(SERIAL_STATUS_LABELS).map((s) => (
              <SelectItem key={s} value={s}>{SERIAL_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </div>

      {state.status === 'loading' && (
        <p className="text-xs text-muted-foreground">Đang tải…</p>
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Chưa có serial nào{query.status ? ` với trạng thái "${SERIAL_STATUS_LABELS[query.status] || query.status}"` : ''}.
        </p>
      )}

      {state.items.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Mã serial', 'Trạng thái', 'Nhập kho', 'Thao tác'].map((h) => (
                <th key={h} className="text-left py-1.5 px-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.items.map((s) => {
              const isChanging = statusChangeId === s.id
              const allowedTo = SERIAL_ALLOWED_TRANSITIONS[s.status] || []
              return (
                <tr key={s.id} className="border-b border-border">
                  <td className="py-1.5 px-2 font-mono">{s.serialNumber || '—'}</td>
                  <td className="py-1.5 px-2"><SerialStatusBadge status={s.status} /></td>
                  <td className="py-1.5 px-2 text-muted-foreground">
                    {s.receivedAt ? formatDateTime(s.receivedAt) : '—'}
                  </td>
                  <td className="py-1.5 px-2">
                    <div className="flex gap-1 items-center flex-wrap">
                      {/* QR button — always visible */}
                      <Button variant="outline" size="sm"
                        title="Xem mã QR"
                        onClick={() => setQrSerial(s)}>
                        QR
                      </Button>

                      {/* Status change */}
                      {allowedTo.length > 0 && !isChanging && (
                        <Button variant="outline" size="sm"
                          onClick={() => { setStatusChangeId(s.id); setStatusChangeValue('') }}>
                          Đổi trạng thái
                        </Button>
                      )}
                      {isChanging && (
                        <div className="flex flex-col gap-1">
                          <Select value={(statusChangeValue) || '__all__'}
                            onValueChange={(val) => setStatusChangeValue(val === '__all__' ? '' : val)} disabled={changing}><SelectTrigger><SelectValue placeholder="-- Chọn --" /></SelectTrigger><SelectContent>
                            {allowedTo.map((st) => (
                              <SelectItem key={st} value={st}>{SERIAL_STATUS_LABELS[st] || st}</SelectItem>
                            ))}
                          </SelectContent></Select>
                          {statusChangeValue === 'SCRAPPED' && (
                            <p className="text-destructive text-xs">Cảnh báo: trạng thái Đã hủy không thể hoàn tác.</p>
                          )}
                          <Input
                            placeholder={NOTE_REQUIRED_STATUSES.has(statusChangeValue) ? 'Lý do (bắt buộc)' : 'Ghi chú (tuỳ chọn)'}
                            value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                            disabled={changing}
                            required={NOTE_REQUIRED_STATUSES.has(statusChangeValue)} />
                          <div className="flex gap-1">
                            <Button size="sm"
                              onClick={() => handleStatusChange(s.id)}
                              disabled={changing || !statusChangeValue}>
                              {changing ? '…' : 'Xác nhận'}
                            </Button>
                            <Button variant="outline" size="sm"
                              onClick={() => { setStatusChangeId(null); setStatusChangeValue(''); setStatusNote('') }}
                              disabled={changing}>
                              Huỷ
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {state.pagination && state.pagination.totalPages > 1 && (
        <PaginationControls pagination={state.pagination}
          onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
      )}

      {qrSerial && (
        <SerialQrModal serial={qrSerial} onClose={() => setQrSerial(null)} />
      )}
    </>
  )
}

function SerialManageModal({ item, onClose }) {
  const [activeTab, setActiveTab] = useState('list')
  const [listRefreshKey, setListRefreshKey] = useState(0)

  const title = [item.productName, item.variantName].filter(Boolean).join(' · ')

  return (
    <Modal open wide title={`Quản lý serial — ${title}`} onClose={onClose}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex -mx-5 px-5 mb-4">
          <TabsTrigger value="list">Danh sách serial</TabsTrigger>
          <TabsTrigger value="add">Thêm serial mới</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-0">
          <SerialListPanel item={item} refreshKey={listRefreshKey} />
        </TabsContent>
        <TabsContent value="add" className="mt-0">
          <AddSerialsPanel
            item={item}
            onSuccess={() => { setActiveTab('list'); setListRefreshKey((k) => k + 1) }}
          />
        </TabsContent>
      </Tabs>
    </Modal>
  )
}

// ── Grouped inventory table ───────────────────────────────────────────────────

function InventoryGroupRow({ group, isExpanded, onToggle, onStockIn, onSerialManage, onViewHistory, canUpdate, serialOnlyMode }) {
  const hasVariants = !group.isNoVariant && group.variants.length > 0

  function buildVariantItem(variant) {
    return {
      productId: group.productId,
      productName: group.productName,
      variantId: variant.variantId,
      variantName: variant.variantName,
      variantSku: variant.variantSku,
      quantityOnHand: variant.quantityOnHand,
      retailPrice: variant.retailPrice,
      trackSerials: variant.trackSerials,
      forceOutOfStock: group.forceOutOfStock,
      productImage: group.productImage,
    }
  }

  function buildProductItem() {
    return {
      productId: group.productId,
      productName: group.productName,
      productSku: group.productSku,
      variantId: null,
      variantName: null,
      variantSku: null,
      quantityOnHand: group.totalQuantity,
      retailPrice: group.minRetailPrice,
      trackSerials: group.trackSerials,
      forceOutOfStock: group.forceOutOfStock,
      productImage: group.productImage,
    }
  }

  return (
    <>
      <tr className="border-b border-border bg-surface-raised">
        <td className="py-1.5 px-2 w-8 align-middle">
          {hasVariants ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              className="bg-transparent border-none cursor-pointer text-muted-foreground flex items-center justify-center p-0 w-5 h-5 text-xs"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="inline-block w-5" aria-hidden="true" />
          )}
        </td>

        <td className="py-2 px-3 align-middle">
          <span className="flex items-center gap-2.5">
            <ProductThumbnail image={group.productImage} alt={group.productName} size={36} />
            <span>
              <p className="font-semibold m-0">{group.productName}</p>
              {group.productSku && (
                <p className="text-xs text-muted-foreground m-0 font-mono">
                  {group.productSku}
                </p>
              )}
            </span>
          </span>
        </td>

        <td className="py-2 px-3 text-sm text-muted-foreground align-middle">
          {group.isNoVariant ? <em>Không có biến thể</em> : `${group.variants.length} biến thể`}
        </td>

        <td className="py-2 px-3 align-middle">
          <StockStatusBadge value={group.aggregateStockState} />
          {group.forceOutOfStock && (
            <span className="ml-1.5 text-xs text-warning font-semibold">
              Khoá
            </span>
          )}
        </td>

        <td className="py-2 px-3 text-right align-middle">
          <strong className="text-base">{group.totalQuantity}</strong>
        </td>

        <td className="py-2 px-3 text-right text-sm align-middle">
          {formatCurrencyVnd(group.minRetailPrice)}
        </td>

        <td className="py-2 px-3 align-middle">
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" className="whitespace-nowrap"
              onClick={() => onViewHistory({
                scope: 'product',
                productId: group.productId,
                productName: group.productName,
                variantName: null,
              })}>
              Lịch sử
            </Button>
            {canUpdate && group.isNoVariant && (
              (group.trackSerials || serialOnlyMode) ? (
                <Button variant="outline" size="sm" className="whitespace-nowrap"
                  onClick={() => onSerialManage(buildProductItem())}>
                  Quản lý serial
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="whitespace-nowrap"
                  onClick={() => onStockIn(buildProductItem())}>
                  Nhập hàng
                </Button>
              )
            )}
          </div>
        </td>
      </tr>

      {hasVariants && isExpanded && group.variants.map((variant) => {
        const item = buildVariantItem(variant)
        return (
          <tr
            key={variant.variantId}
            className="border-b border-border"
          >
            <td className="p-0 w-8" />

            <td className="py-1.5 px-3 pl-10 align-middle">
              <p className="font-medium text-sm m-0">{variant.variantName || '—'}</p>
              {variant.variantSku && (
                <p className="text-xs text-muted-foreground m-0 font-mono">
                  {variant.variantSku}
                </p>
              )}
            </td>

            <td className="py-1.5 px-3" />

            <td className="py-1.5 px-3 align-middle">
              <StockStatusBadge value={variant.stockState} />
            </td>

            <td className="py-1.5 px-3 text-right align-middle">
              <strong>{variant.quantityOnHand}</strong>
              {variant.trackSerials && (
                <span className="block text-primary font-semibold text-xs">
                  Serial
                </span>
              )}
            </td>

            <td className="py-1.5 px-3 text-right text-xs text-muted-foreground align-middle">
              {formatCurrencyVnd(variant.retailPrice)}
            </td>

            <td className="py-1.5 px-3 align-middle">
              <div className="flex gap-1.5 flex-wrap">
                <Button variant="outline" size="sm" className="whitespace-nowrap"
                  onClick={() => onViewHistory({
                    scope: 'variant',
                    variantId: variant.variantId,
                    productName: group.productName,
                    variantName: variant.variantName,
                  })}>
                  Lịch sử
                </Button>
                {canUpdate && ((variant.trackSerials || serialOnlyMode) ? (
                  <Button variant="outline" size="sm" className="whitespace-nowrap"
                    onClick={() => onSerialManage(item)}>
                    Quản lý serial
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="whitespace-nowrap"
                    onClick={() => onStockIn(item)}>
                    Nhập hàng
                  </Button>
                ))}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}

function InventoryGroupedTable({ groups, loading, pageSize, canUpdate, serialOnlyMode, onStockIn, onSerialManage, onViewHistory }) {
  const { t } = useTranslation()
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const prevGroupsRef = useRef(null)

  useEffect(() => {
    if (prevGroupsRef.current !== null && prevGroupsRef.current !== groups) {
      setExpandedIds(new Set())
    }
    prevGroupsRef.current = groups
  }, [groups])

  function toggleGroup(productId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const colCount = 7

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-border">
            <th className="w-8 py-2 px-1" />
            <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colProduct')}
            </th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colVariant')}
            </th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('inventory.colStockState')}
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">
              {t('inventory.colQty')}
            </th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">
              {t('inventory.colPrice')}
            </th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: pageSize }, (_, i) => (
                <tr key={i} className="border-b border-border">
                  <td colSpan={colCount} className="py-2.5 px-3">
                    <div className="skeleton h-3.5 w-full" />
                  </td>
                </tr>
              ))
            : groups.map((group) => (
                <InventoryGroupRow
                  key={group.productId}
                  group={group}
                  isExpanded={expandedIds.has(group.productId)}
                  onToggle={() => toggleGroup(group.productId)}
                  onStockIn={onStockIn}
                  onSerialManage={onSerialManage}
                  onViewHistory={onViewHistory}
                  canUpdate={canUpdate}
                  serialOnlyMode={serialOnlyMode}
                />
              ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ── Movement history modal (per product / per variant) ───────────────────────

function MovementHistoryModal({ scope, onClose }) {
  const [query, setQuery] = useState({ page: 1, pageSize: 20 })
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    const promise = scope.scope === 'variant'
      ? fetchVariantMovements(scope.variantId, query)
      : fetchProductMovements(scope.productId, query)
    promise
      .then((r) => { if (active) setState({ status: 'success', items: r.items || [], pagination: r.pagination || null }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], pagination: null, error: e.message }) })
    return () => { active = false }
  }, [scope, query])

  const title = [scope.productName, scope.variantName].filter(Boolean).join(' · ')

  return (
    <Modal open wide title={`Lịch sử biến động — ${title || '—'}`} onClose={onClose}>
        <div>
          {state.status === 'error' && (
            <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={state.error}
              actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
          )}
          {state.status === 'success' && state.items.length === 0 && (
            <StatePanel tone="neutral" title="Chưa có biến động"
              description="Sản phẩm này chưa có biến động nào được ghi nhận." />
          )}

          {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
            <>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {['Loại', 'Biến thể', 'Delta', 'Sau', 'Nguồn', 'Serial', 'Ghi chú', 'Thời gian'].map((h) => (
                      <th key={h} className="text-left py-1.5 px-2 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading'
                    ? Array.from({ length: 6 }, (_, i) => (
                        <tr key={i}><td colSpan={8} className="p-2">
                          <div className="skeleton h-3.5 w-full" />
                        </td></tr>
                      ))
                    : state.items.map((m) => (
                        <tr key={m.id} className="border-b border-border">
                          <td className="py-1.5 px-2"><MovementTypeBadge type={m.movementType} /></td>
                          <td className="py-1.5 px-2">
                            {m.variantName
                              ? <span>{m.variantName}{m.variantSku ? ` · ${m.variantSku}` : ''}</span>
                              : <em className="text-muted-foreground">(Sản phẩm)</em>}
                          </td>
                          <td className={`py-1.5 px-2 font-bold ${m.quantityDelta > 0 ? 'text-success' : 'text-danger'}`}>
                            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                          </td>
                          <td className="py-1.5 px-2">{m.quantityAfter}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{m.referenceType || '—'}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">
                            {m.serialCount > 0
                              ? <span className="font-mono">{m.serialCount} S/N</span>
                              : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-muted-foreground">{m.note || '—'}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{m.createdAt ? formatDateTime(m.createdAt) : '—'}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {state.status === 'success' && state.pagination && state.pagination.totalPages > 1 && (
                <PaginationControls pagination={state.pagination}
                  onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
              )}
            </>
          )}
        </div>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', stockState: 'ALL', page: 1, pageSize: 20 }

export function InventoryScreen({ canUpdate = false }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [summary, setSummary] = useState(null)
  const [stockInTarget, setStockInTarget] = useState(null)
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [serialTarget, setSerialTarget] = useState(null)
  const [isSerialOpen, setIsSerialOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [csvDownloading, setCsvDownloading] = useState(false)
  const [serialOnlyMode, setSerialOnlyMode] = useState(false)

  const state = useAdminList(['inventory', query], () => fetchInventoryGrouped(query))

  useEffect(() => {
    fetchInventorySummary().then(setSummary)
    fetchSerialInventoryOnly().then(setSerialOnlyMode)
  }, [])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  function handleStockInSuccess() {
    setIsStockInOpen(false)
    setStockInTarget(null)
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    fetchInventorySummary().then(setSummary)
  }

  function openStockIn(item = null) {
    if (serialOnlyMode || item?.trackSerials) {
      openSerialManage(item)
      return
    }
    setStockInTarget(item)
    setIsStockInOpen(true)
  }

  function closeStockIn() {
    setIsStockInOpen(false)
    setStockInTarget(null)
  }

  function openSerialManage(item) {
    setSerialTarget(item)
    setIsSerialOpen(true)
  }

  function closeSerialManage() {
    setIsSerialOpen(false)
    setSerialTarget(null)
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    fetchInventorySummary().then(setSummary)
  }


  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('inventory.eyebrow')}</p>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.description')}</p>
        </div>
        <div className="screen-actions">
          <Button
            variant="outline"
            disabled={csvDownloading}
            onClick={() => {
              setCsvDownloading(true)
              downloadInventoryCsv()
                .catch((err) => toast.error('Xuất CSV thất bại: ' + (err?.message || 'Lỗi không xác định')))
                .finally(() => setCsvDownloading(false))
            }}
          >
            {csvDownloading ? 'Đang xuất…' : 'Xuất CSV'}
          </Button>
        </div>
      </header>

      <SummaryBanner summary={summary} />

      {serialOnlyMode && (
        <Alert tone="info" role="status" className="mb-3 font-semibold">
          Tồn kho đang được tính tự động từ serial. Không thể sửa số lượng thủ công.
        </Alert>
      )}

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <section className="filter-bar">
        <label>
          {t('common.search')}
          <Input type="search"
            placeholder={t('inventory.searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}  />
        </label>
        <label>
          {t('inventory.filterStock')}
          <Select value={query.stockState}
            onValueChange={(val) => setQuery((q) => ({ ...q, stockState: val, page: 1 }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            {STOCK_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s === 'ALL' ? t('common.all') : s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </section>

      {state.status === 'error' && (
        <StatePanel tone="danger" title={t('inventory.loadError')} description={state.error}
          actionLabel={t('common.retry')} onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title={t('inventory.empty')} description={t('inventory.emptyDesc')} />
      )}
      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <InventoryGroupedTable
            groups={state.items}
            loading={state.status === 'loading'}
            pageSize={query.pageSize}
            canUpdate={canUpdate}
            serialOnlyMode={serialOnlyMode}
            onStockIn={openStockIn}
            onSerialManage={openSerialManage}
            onViewHistory={setHistoryTarget}
          />
          {state.status === 'success' && state.pagination && (
            <PaginationControls pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          )}
        </>
      )}

      {isStockInOpen && !serialOnlyMode && (
        <StockInModal
          item={stockInTarget}
          onSuccess={handleStockInSuccess}
          onClose={closeStockIn}
        />
      )}

      {isSerialOpen && serialTarget && (
        <SerialManageModal
          item={serialTarget}
          onClose={closeSerialManage}
        />
      )}

      {historyTarget && (
        <MovementHistoryModal
          scope={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </section>
  )
}
