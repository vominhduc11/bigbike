import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
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
  enableVariantSerialTracking,
  enableProductSerialTracking,
} from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const STOCK_STATES = ['ALL', 'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK']

const STOCK_STATE_COLORS = {
  IN_STOCK: '#16a34a',
  LOW_STOCK: '#d97706',
  OUT_OF_STOCK: '#dc2626',
}

const STOCK_STATE_LABELS = {
  IN_STOCK: 'Còn hàng',
  LOW_STOCK: 'Sắp hết',
  OUT_OF_STOCK: 'Hết hàng',
}

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
          borderRadius: 'var(--admin-radius-sm, 4px)',
          background: 'var(--admin-color-surface-alt, #f3f4f6)',
          border: '1px solid var(--admin-color-border, #e5e7eb)',
          color: 'var(--admin-color-text-muted, #9ca3af)',
          fontSize: size * 0.45,
        }}
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
        borderRadius: 'var(--admin-radius-sm, 4px)',
        border: '1px solid var(--admin-color-border, #e5e7eb)',
        display: 'block',
      }}
    />
  )
}

function StockBadge({ state }) {
  const label = STOCK_STATE_LABELS[state]
  if (!label) return null
  const color = STOCK_STATE_COLORS[state]
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.8rem' }}>
      {label}
    </span>
  )
}

function MovementTypeBadge({ type }) {
  const colors = { IN: '#16a34a', OUT: '#dc2626', RETURN: '#7c3aed' }
  return (
    <span style={{ color: colors[type] ?? '#6b7280', fontWeight: 600, fontSize: '0.78rem' }}>
      {type}
    </span>
  )
}

function SummaryBanner({ summary }) {
  if (!summary || summary.totalItems === 0) return null
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      {summary.outOfStockCount > 0 && (
        <div style={{ background: 'var(--admin-color-status-danger-bg)', border: '1px solid var(--admin-color-status-danger-border)', borderRadius: 'var(--admin-radius-sm)', padding: '8px 16px' }}>
          <span style={{ color: 'var(--admin-color-status-danger-text)', fontWeight: 700 }}>{summary.outOfStockCount}</span>
          <span style={{ color: 'var(--admin-color-status-danger-text)', marginLeft: 6, fontSize: '0.85rem' }}>Hết hàng</span>
        </div>
      )}
      {summary.lowStockCount > 0 && (
        <div style={{ background: 'var(--admin-color-status-warning-bg)', border: '1px solid var(--admin-color-status-warning-border)', borderRadius: 'var(--admin-radius-sm)', padding: '8px 16px' }}>
          <span style={{ color: 'var(--admin-color-status-warning-text)', fontWeight: 700 }}>{summary.lowStockCount}</span>
          <span style={{ color: 'var(--admin-color-status-warning-text)', marginLeft: 6, fontSize: '0.85rem' }}>Sắp hết hàng</span>
        </div>
      )}
      <div style={{ background: 'var(--admin-color-surface-base)', border: '1px solid var(--admin-color-border-subtle)', borderRadius: 'var(--admin-radius-sm)', padding: '8px 16px' }}>
        <span style={{ fontWeight: 700 }}>{summary.totalItems}</span>
        <span style={{ marginLeft: 6, fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>Tổng mục</span>
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

const SERIAL_HEADER_NAMES = new Set(['serial', 'serial_number', 'serial number', 's/n', 'imei', 'sn'])
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
  const lines = text.split(/\r?\n/)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', flexWrap: 'wrap', gap: 6 }}>
        <label className="form-label" style={{ margin: 0 }}>
          {t('inventory.stockIn.labelSerials')}{' '}
          <span aria-hidden="true" style={{ color: 'var(--admin-color-brand-red)' }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {hasContent && (
            <button type="button" className="btn btn-secondary btn-sm"
              onClick={handleClearAll} disabled={disabled || importing}>
              {t('inventory.stockIn.serialsClearAll')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
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
            style={{ display: 'none' }}
            onChange={handleFileImport}
          />
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={handleTogglePanel} disabled={disabled || importing}>
            {panelOpen
              ? t('inventory.stockIn.serialsBatchClose')
              : t('inventory.stockIn.serialsBatchTitle')}
          </button>
        </div>
      </div>

      {/* File import error */}
      {importError && (
        <p role="alert" style={{ color: 'var(--admin-color-danger, #dc2626)', fontSize: '0.8rem', margin: '0 0 0.4rem' }}>
          {importError}
        </p>
      )}

      {/* Batch textarea panel */}
      {panelOpen && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor="serial-batch-input" style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>
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
            style={{ fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical', width: '100%', maxHeight: 320 }}
            aria-label={t('inventory.stockIn.serialsBatchPanelLabel')}
           />
        </div>
      )}

      {/* Summary strip */}
      {hasContent && (
        <div style={{
          background: 'var(--admin-color-surface)',
          border: '1px solid var(--admin-color-border)',
          borderRadius: 4, padding: '0.4rem 0.75rem', marginBottom: '0.5rem',
          fontSize: '0.78rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center',
        }}>
          {safeMax > 0 && (
            <span style={{
              fontWeight: 700,
              color: exceeds
                ? 'var(--admin-color-danger, #dc2626)'
                : underfill
                  ? 'var(--admin-color-state-warning, #d97706)'
                  : 'var(--admin-color-state-success, #16a34a)',
            }}>
              {parsed.unique.length} / {safeMax} serial
            </span>
          )}
          <span>
            <strong>{parsed.raw.length}</strong>{' '}
            {t('inventory.stockIn.serialsSummaryTotal')}
          </span>
          {parsed.blank > 0 && (
            <span style={{ color: 'var(--admin-color-text-muted)' }}>
              <strong>{parsed.blank}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryBlank')}
            </span>
          )}
          {parsed.dupeCount > 0 && (
            <span style={{ color: 'var(--admin-color-state-warning, #d97706)' }}>
              <strong>{parsed.dupeCount}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryDupes')}
            </span>
          )}
          {exceeds && (
            <span style={{ color: 'var(--admin-color-danger, #dc2626)' }}>
              <strong>{parsed.unique.length - safeMax}</strong>{' '}
              {t('inventory.stockIn.serialsSummaryExceeds')}
            </span>
          )}
        </div>
      )}

      {/* Duplicate warning + copy/download actions */}
      {parsed.dupeCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--admin-color-state-warning, #d97706)', flex: 1 }}>
            {t('inventory.stockIn.warnSerialDuplicateAutoRemoved', { count: parsed.dupeCount })}
          </span>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={handleCopyErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsCopyErrors')}
          </button>
          <button type="button" className="btn btn-secondary btn-sm"
            onClick={handleDownloadErrors} disabled={disabled}>
            {t('inventory.stockIn.serialsDownloadErrors')}
          </button>
        </div>
      )}

      {/* Exceed-quantity error */}
      {exceeds && (
        <p role="alert" style={{ color: 'var(--admin-color-danger, #dc2626)', fontSize: '0.8rem', marginBottom: '0.4rem', marginTop: 0 }}>
          {t('inventory.stockIn.errorSerialCount', { serials: parsed.unique.length, qty: safeMax })}
        </p>
      )}

      {/* Underfill error */}
      {hasContent && underfill && (
        <p role="alert" style={{ color: 'var(--admin-color-state-warning, #d97706)', fontSize: '0.8rem', marginBottom: '0.4rem', marginTop: 0 }}>
          {t('inventory.stockIn.errorSerialCountTooFew', { serials: parsed.unique.length, qty: safeMax })}
        </p>
      )}

      {/* Serial preview list (max SERIAL_PREVIEW_LIMIT rows + overflow indicator) */}
      {parsed.unique.length > 0 && (
        <div
          role="list"
          aria-label={t('inventory.stockIn.labelSerials')}
          style={{
            border: '1px solid var(--admin-color-border)',
            borderRadius: 4, maxHeight: 240, overflowY: 'auto',
          }}
        >
          {previewList.map((s, idx) => (
            <div key={idx} role="listitem" style={{
              display: 'flex', alignItems: 'center',
              padding: '3px 8px',
              borderBottom: idx < previewList.length - 1 || hiddenCount > 0
                ? '1px solid var(--admin-color-border-subtle)' : 'none',
              fontSize: '0.78rem',
            }}>
              <span style={{ color: 'var(--admin-color-text-muted)', minWidth: 32, fontSize: '0.7rem', flexShrink: 0 }}>
                {idx + 1}.
              </span>
              <span style={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{s}</span>
              <button
                type="button"
                onClick={() => handleRemoveSerial(idx)}
                disabled={disabled}
                aria-label={`${t('inventory.stockIn.removeSerial')} ${s}`}
                style={{
                  background: 'none', border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  color: 'var(--admin-color-text-muted)',
                  padding: '0 4px', fontSize: '0.85rem', flexShrink: 0,
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div style={{
              padding: '4px 8px', fontSize: '0.75rem',
              color: 'var(--admin-color-text-muted)', textAlign: 'center',
              background: 'var(--admin-color-surface)',
            }}>
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
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-in-title"
    >
      <div className="modal-box modal-box--wide modal-box--flex">

        {/* ── Fixed header ── */}
        <header className="modal-header">
          <h2 id="stock-in-title" className="modal-title">
            {t('inventory.stockIn.title')}
          </h2>
          <button
            type="button"
            className="btn-icon btn-secondary-ghost"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </header>

        {/* ── Scrollable body ── */}
        <div className="modal-body">

          {/* Variant picker — shown when no pre-selected item and user hasn't chosen yet */}
          {!item && showPicker && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
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
                  <div style={{ padding: '0.75rem', color: 'var(--admin-color-text-muted)' }}>
                    {t('common.loading')}
                  </div>
                )}
                {pickerState.status === 'error' && (
                  <div style={{ padding: '0.75rem', color: 'var(--admin-color-status-danger-text)' }}>
                    {pickerState.error}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.length === 0 && (
                  <div style={{ padding: '0.75rem', color: 'var(--admin-color-text-muted)' }}>
                    {t('inventory.stockIn.noItemResults', { defaultValue: 'Không tìm thấy sản phẩm phù hợp.' })}
                  </div>
                )}
                {pickerState.status === 'success' && pickerState.items.map((candidate) => {
                  const isSelected = selectedItem?.variantId === candidate.variantId
                  return (
                    <button
                      key={candidate.variantId || candidate.id}
                      type="button"
                      className="variant-picker-item"
                      onClick={() => handleSelectVariant(candidate)}
                      disabled={submitting}
                      style={isSelected ? { background: 'var(--admin-color-surface-active, rgba(249,6,6,0.10))' } : undefined}
                    >
                      <span className="variant-picker-item__name">
                        {candidate.productName || '—'}
                        <span className="variant-picker-item__meta">
                          {candidate.variantId
                            ? ([candidate.variantName, candidate.variantSku].filter(Boolean).join(' · ') || '—')
                            : <em style={{ fontStyle: 'italic', color: 'var(--admin-color-text-muted)' }}>Không có biến thể</em>
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
                    <span style={{ color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-xs)' }}>
                      {t('inventory.colProduct')}:{' '}
                    </span>
                    <strong className="variant-summary__product-name">
                      {selectedItem.productName || '—'}
                    </strong>
                  </div>
                  {isVariantItem && (
                    <div>
                      <span style={{ color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-xs)' }}>
                        {t('inventory.colVariant')}:{' '}
                      </span>
                      <strong>{variantLabel}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-xs)' }}>
                      {t('inventory.stockIn.currentQty')}:{' '}
                    </span>
                    <strong>{selectedItem.quantityOnHand ?? '—'}</strong>
                  </div>
                </div>
                {!item && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleChangeVariant}
                    disabled={submitting}
                  >
                    {t('inventory.stockIn.changeItem', { defaultValue: 'Đổi sản phẩm' })}
                  </button>
                )}
              </div>
              {selectedItem.forceOutOfStock && (
                <div role="alert" style={{
                  background: 'var(--admin-color-status-warning-bg)',
                  border: '1px solid var(--admin-color-status-warning-border)',
                  borderRadius: 'var(--admin-radius-sm)',
                  padding: '8px 12px', marginBottom: 12,
                  fontSize: '0.82rem', color: 'var(--admin-color-status-warning-text)',
                }}>
                  <strong>Lưu ý:</strong> Sản phẩm đang bị khoá trạng thái "Hết hàng" (forceOutOfStock). Sau khi nhập hàng, sản phẩm vẫn hiển thị là "Hết hàng" trên website cho đến khi tắt cờ này trong trang chỉnh sửa sản phẩm.
                </div>
              )}
            </>
          )}

          {/* Form fields — id links to submit button in footer */}
          <form id="stock-in-form" onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="stock-in-qty">
                {t('inventory.stockIn.labelQty')}{' '}
                <span aria-hidden="true" style={{ color: 'var(--admin-color-brand-red)' }}>*</span>
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

            <div className="form-group" style={{ marginBottom: '1rem' }}>
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

        {/* ── Fixed footer ── */}
        <footer className="modal-footer">
          {formError && (
            <p className="field-error" style={{ marginBottom: '0.5rem' }}>{formError}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--admin-space-2)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="stock-in-form"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? t('inventory.stockIn.submitting') : t('inventory.stockIn.submit')}
            </button>
          </div>
        </footer>

      </div>
    </div>
  )
}

// ── Serial management modal ───────────────────────────────────────────────────

function SerialStatusBadge({ status }) {
  const label = SERIAL_STATUS_LABELS[status] || status
  const classes = SERIAL_STATUS_CLASSES[status] || 'text-muted-foreground bg-muted'
  return <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${classes}`}>{label}</span>
}

// ── File parser: CSV/Excel 1 cột mã serial ────────────────────────────────────

const SERIAL_HEADERS = new Set(['serial', 'serial_number', 'serialnumber', 'ma_serial', 'mã serial', 'so_serial', 'số serial'])

function detectSerialColumn(firstRow) {
  const norm = firstRow.map((c) => (c == null ? '' : String(c).trim().toLowerCase()))
  const serialIdx = norm.findIndex((c) => SERIAL_HEADERS.has(c))
  return { hasHeader: serialIdx >= 0, serialIdx: serialIdx >= 0 ? serialIdx : 0 }
}

function rowsToSerials(dataRows, serialIdx) {
  return dataRows.map((row) => {
    const serial = String(row[serialIdx] ?? '').trim()
    return { serial }
  }).filter((r) => r.serial)
}

async function parseSerialFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (file.size > 5 * 1024 * 1024) throw new Error('FILE_TOO_BIG')

  if (ext === 'csv' || ext === 'txt') {
    const text = await file.text()
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
    const rows  = lines.map((l) => l.split(/[,;\t]/).map((c) => c.trim()))
    if (rows.length === 0) return []
    const { hasHeader, serialIdx } = detectSerialColumn(rows[0])
    return rowsToSerials(hasHeader ? rows.slice(1) : rows, serialIdx)
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const xlsxModule = await import('xlsx')
    const XLSX = xlsxModule.default ?? xlsxModule
    const wb   = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (rows.length === 0) return []
    const { hasHeader, serialIdx } = detectSerialColumn(rows[0])
    return rowsToSerials(hasHeader ? rows.slice(1) : rows, serialIdx)
  }

  throw new Error('FILE_UNSUPPORTED')
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
      const pairs = await parseSerialFile(file)
      const valid = pairs.filter((r) => r.serial)
      const blank = pairs.length - valid.length
      setParsePreview({ total: pairs.length, valid: valid.length, blank })
      setRows(valid.length > 0 ? valid.map((p) => ({ serial: p.serial })) : [{ serial: '' }])
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
        enableTracking: true,
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
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label" htmlFor="serial-supplier-note">
          Số phiếu xuất / hoá đơn nhà phân phối
          <span style={{ fontWeight: 400, color: 'var(--admin-color-text-muted)', marginLeft: 6 }}>(tuỳ chọn)</span>
        </label>
        <Input
          id="serial-supplier-note"
          style={{ width: '100%' }}
          placeholder="VD: HD-2025-001, Phiếu xuất kho ABC..."
          value={supplierNote}
          onChange={(e) => setSupplierNote(e.target.value)}
          disabled={submitting}
         />
        <p style={{ fontSize: '0.76rem', color: 'var(--admin-color-text-muted)', marginTop: 4 }}>
          Ghi chú sẽ được lưu kèm mỗi serial trong lô nhập này.
        </p>
      </div>

      {/* File import */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <p className="form-label" style={{ margin: 0 }}>Danh sách serial nhận về</p>
        <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => fileInputRef.current?.click()} disabled={submitting || parsing}>
          {parsing ? 'Đang đọc file…' : 'Import từ file'}
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,.txt,.xlsx,.xls"
          style={{ display: 'none' }} onChange={handleFileImport} />
        <span style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)' }}>
          CSV / Excel — 1 cột: Mã serial
        </span>
      </div>

      {/* Parse preview */}
      {parsePreview && (
        <div className="flex flex-wrap gap-4 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 mb-2.5">
          <span>Tổng dòng: <strong>{parsePreview.total}</strong></span>
          <span>Hợp lệ: <strong>{parsePreview.valid}</strong></span>
          {parsePreview.blank > 0 && <span>Dòng trống bỏ qua: <strong>{parsePreview.blank}</strong></span>}
        </div>
      )}

      {/* Manual row table */}
      <p style={{ fontSize: '0.78rem', color: 'var(--admin-color-text-muted)', marginBottom: 6 }}>
        Mỗi dòng là một sản phẩm — nhập mã serial.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600, width: 30 }}>#</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Mã serial</th>
            <th style={{ width: 32 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 6px', color: 'var(--admin-color-text-muted)' }}>{i + 1}</td>
              <td style={{ padding: '4px 6px' }}>
                <Input style={{ width: '100%' }}
                  placeholder="VD: SN-20240001"
                  value={row.serial}
                  onChange={(e) => updateRow(i, 'serial', e.target.value)}
                  disabled={submitting}  />
              </td>
              <td style={{ padding: '4px 6px' }}>
                {rows.length > 1 && (
                  <button type="button" className="btn-icon btn-secondary-ghost"
                    onClick={() => removeRow(i)} disabled={submitting} aria-label="Xoá dòng">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-secondary" style={{ marginBottom: 14 }}
        onClick={addRow} disabled={submitting}>
        + Thêm dòng
      </button>

      {error && (
        <p role="alert" className="text-destructive text-xs mb-2">{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary" disabled={submitting || validCount === 0}>
          {submitting ? 'Đang nhập…' : `Nhập ${validCount} serial`}
        </button>
      </div>

      {/* Import result — skipped rows with reasons */}
      {importResult && importResult.skipped > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 px-3.5 py-3">
          <p className="font-semibold text-sm mb-1.5">
            Kết quả: {importResult.inserted} nhập thành công · {importResult.skipped} dòng bị bỏ qua
          </p>
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-amber-200">
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>Dòng</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>Trường</th>
                <th style={{ textAlign: 'left', padding: '3px 6px' }}>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {importResult.errors.map((err, idx) => (
                <tr key={idx} className="border-b border-amber-100">
                  <td style={{ padding: '3px 6px', fontFamily: 'monospace' }}>{err.rowIndex + 1}</td>
                  <td className="text-amber-800" style={{ padding: '3px 6px' }}>{err.field}</td>
                  <td style={{ padding: '3px 6px' }}>{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-secondary mt-2.5 text-xs"
            onClick={handleRetrySkipped}>
            Tải lại {importResult.skipped} dòng lỗi để sửa
          </button>
        </div>
      )}

      {importResult && importResult.skipped === 0 && importResult.inserted > 0 && (
        <div className="mt-3 bg-green-50 border border-green-200 px-3.5 py-2.5 text-sm text-green-700">
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Mã QR serial"
      onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 320, textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="modal-title" style={{ fontSize: '0.95rem' }}>Mã QR Serial</h2>
          <button type="button" className="btn-icon btn-secondary-ghost"
            onClick={onClose} aria-label="Đóng">✕</button>
        </header>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div id="serial-qr-print" ref={qrRef}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {qrValue ? (
              <QRCodeSVG value={qrValue} size={180} level="H" marginSize={2} />
            ) : (
              <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Không có dữ liệu để tạo QR.</p>
            )}
            <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>{label}</p>
            {serial.receivedAt && (
              <p style={{ fontSize: '0.72rem', color: '#6b7280' }}>Nhập kho: {formatDateTime(serial.receivedAt)}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1 }}
              onClick={handlePrint} disabled={!qrValue}>
              In QR
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }}
              onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.82rem' }}>
          Lọc trạng thái:
          <Select style={{ marginLeft: 6 }} value={(query.status) || '__all__'}
            onValueChange={(val) => { const v = val === '__all__' ? '' : val; setQuery((q) => ({ ...q, status: v, page: 1 })) }}><SelectTrigger><SelectValue placeholder="Tất cả" /></SelectTrigger><SelectContent>
            <SelectItem value="__all__">Tất cả trạng thái</SelectItem>
            {Object.keys(SERIAL_STATUS_LABELS).map((s) => (
              <SelectItem key={s} value={s}>{SERIAL_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent></Select>
        </label>
      </div>

      {state.status === 'loading' && (
        <p style={{ fontSize: '0.82rem', color: 'var(--admin-color-text-muted)' }}>Đang tải…</p>
      )}

      {state.status === 'success' && state.items.length === 0 && (
        <p style={{ fontSize: '0.82rem', color: 'var(--admin-color-text-muted)' }}>
          Chưa có serial nào{query.status ? ` với trạng thái "${SERIAL_STATUS_LABELS[query.status] || query.status}"` : ''}.
        </p>
      )}

      {state.items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
              {['Mã serial', 'Trạng thái', 'Nhập kho', 'Thao tác'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '5px 8px', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.items.map((s) => {
              const isChanging = statusChangeId === s.id
              const allowedTo = SERIAL_ALLOWED_TRANSITIONS[s.status] || []
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{s.serialNumber || '—'}</td>
                  <td style={{ padding: '6px 8px' }}><SerialStatusBadge status={s.status} /></td>
                  <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>
                    {s.receivedAt ? formatDateTime(s.receivedAt) : '—'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* QR button — always visible */}
                      <button type="button" className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        title="Xem mã QR"
                        onClick={() => setQrSerial(s)}>
                        QR
                      </button>

                      {/* Status change */}
                      {allowedTo.length > 0 && !isChanging && (
                        <button type="button" className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => { setStatusChangeId(s.id); setStatusChangeValue('') }}>
                          Đổi trạng thái
                        </button>
                      )}
                      {isChanging && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button type="button" className="btn btn-primary"
                              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              onClick={() => handleStatusChange(s.id)}
                              disabled={changing || !statusChangeValue}>
                              {changing ? '…' : 'Xác nhận'}
                            </button>
                            <button type="button" className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                              onClick={() => { setStatusChangeId(null); setStatusChangeValue(''); setStatusNote('') }}
                              disabled={changing}>
                              Huỷ
                            </button>
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
  const [trackingLoading, setTrackingLoading] = useState(false)
  const isVariant = Boolean(item?.variantId)

  const title = [item.productName, item.variantName].filter(Boolean).join(' · ')

  async function handleEnableTracking() {
    setTrackingLoading(true)
    try {
      if (isVariant) {
        await enableVariantSerialTracking(item.variantId, true)
      } else {
        await enableProductSerialTracking(item.productId, true)
      }
      toast.success('Đã bật quản lý serial cho sản phẩm này.')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi bật quản lý serial.')
    } finally {
      setTrackingLoading(false)
    }
  }

  if (!item.trackSerials) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-box">
          <header className="modal-header">
            <h2 className="modal-title">Bật quản lý serial</h2>
            <button type="button" className="btn-icon btn-secondary-ghost"
              onClick={onClose} aria-label="Đóng">✕</button>
          </header>
          <div className="modal-body">
            <p style={{ marginBottom: 12 }}>
              <strong>{title}</strong> hiện dùng quản lý tồn kho thủ công (số lượng).
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--admin-color-text-muted)', marginBottom: 16 }}>
              Bật quản lý serial sẽ chuyển sang theo dõi từng sản phẩm theo mã serial.
              Tồn kho sẽ tự động tính từ số serial đang trạng thái "Có sẵn".
            </p>
            <button type="button" className="btn btn-primary"
              onClick={handleEnableTracking} disabled={trackingLoading}>
              {trackingLoading ? 'Đang bật…' : 'Bật quản lý serial'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box modal-box--wide">
        <header className="modal-header">
          <h2 className="modal-title">Quản lý serial — {title}</h2>
          <button type="button" className="btn-icon btn-secondary-ghost"
            onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--admin-color-border)', padding: '0 24px' }}>
          {[['list', 'Danh sách serial'], ['add', 'Thêm serial mới']].map(([id, label]) => (
            <button key={id} type="button"
              style={{
                background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
                fontWeight: activeTab === id ? 700 : 400,
                borderBottom: activeTab === id ? '2px solid var(--admin-color-primary)' : '2px solid transparent',
                marginBottom: -1,
                color: activeTab === id ? 'var(--admin-color-primary)' : 'var(--admin-color-text-muted)',
              }}
              onClick={() => setActiveTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {activeTab === 'list' && (
            <SerialListPanel item={item} refreshKey={listRefreshKey} />
          )}
          {activeTab === 'add' && (
            <AddSerialsPanel
              item={item}
              onSuccess={() => { setActiveTab('list'); setListRefreshKey((k) => k + 1) }}
            />
          )}
        </div>
      </div>
    </div>
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
      <tr style={{
        borderBottom: '1px solid var(--admin-color-border)',
        background: 'var(--admin-color-surface-raised, var(--admin-color-surface-alt, #f9fafb))',
      }}>
        <td style={{ padding: '6px 4px 6px 8px', width: 32, verticalAlign: 'middle' }}>
          {hasVariants ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Thu gọn' : 'Mở rộng'}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--admin-color-text-muted)',
                fontSize: '0.65rem', width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span style={{ display: 'inline-block', width: 20 }} aria-hidden="true" />
          )}
        </td>

        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProductThumbnail image={group.productImage} alt={group.productName} size={36} />
            <span>
              <p style={{ fontWeight: 600, margin: 0 }}>{group.productName}</p>
              {group.productSku && (
                <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', margin: 0, fontFamily: 'monospace' }}>
                  {group.productSku}
                </p>
              )}
            </span>
          </span>
        </td>

        <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--admin-color-text-muted)', verticalAlign: 'middle' }}>
          {group.isNoVariant ? <em>Không có biến thể</em> : `${group.variants.length} biến thể`}
        </td>

        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
          <StockBadge state={group.aggregateStockState} />
          {group.forceOutOfStock && (
            <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--admin-color-state-warning, #d97706)', fontWeight: 600 }}>
              Khoá
            </span>
          )}
        </td>

        <td style={{ padding: '8px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
          <strong style={{ fontSize: '1rem' }}>{group.totalQuantity}</strong>
        </td>

        <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.85rem', verticalAlign: 'middle' }}>
          {formatCurrencyVnd(group.minRetailPrice)}
        </td>

        <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
              onClick={() => onViewHistory({
                scope: 'product',
                productId: group.productId,
                productName: group.productName,
                variantName: null,
              })}>
              Lịch sử
            </button>
            {canUpdate && group.isNoVariant && (
              (group.trackSerials || serialOnlyMode) ? (
                <button type="button" className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
                  onClick={() => onSerialManage(buildProductItem())}>
                  Quản lý serial
                </button>
              ) : (
                <button type="button" className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
                  onClick={() => onStockIn(buildProductItem())}>
                  Nhập hàng
                </button>
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
            style={{
              borderBottom: '1px solid var(--admin-color-border-subtle, var(--admin-color-border))',
              background: 'transparent',
            }}
          >
            <td style={{ padding: 0, width: 32 }} />

            <td style={{ padding: '6px 12px 6px 40px', verticalAlign: 'middle' }}>
              <p style={{ fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>{variant.variantName || '—'}</p>
              {variant.variantSku && (
                <p style={{ fontSize: '0.72rem', color: 'var(--admin-color-text-muted)', margin: 0, fontFamily: 'monospace' }}>
                  {variant.variantSku}
                </p>
              )}
            </td>

            <td style={{ padding: '6px 12px' }} />

            <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
              <StockBadge state={variant.stockState} />
            </td>

            <td style={{ padding: '6px 12px', textAlign: 'right', verticalAlign: 'middle' }}>
              <strong>{variant.quantityOnHand}</strong>
              {variant.trackSerials && (
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--admin-color-primary)', fontWeight: 600 }}>
                  Serial
                </span>
              )}
            </td>

            <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '0.82rem', color: 'var(--admin-color-text-muted)', verticalAlign: 'middle' }}>
              {formatCurrencyVnd(variant.retailPrice)}
            </td>

            <td style={{ padding: '6px 12px', verticalAlign: 'middle' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
                  onClick={() => onViewHistory({
                    scope: 'variant',
                    variantId: variant.variantId,
                    productName: group.productName,
                    variantName: variant.variantName,
                  })}>
                  Lịch sử
                </button>
                {canUpdate && ((variant.trackSerials || serialOnlyMode) ? (
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
                    onClick={() => onSerialManage(item)}>
                    Quản lý serial
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
                    onClick={() => onStockIn(item)}>
                    Nhập hàng
                  </button>
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
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--admin-color-border)' }}>
            <th style={{ width: 32, padding: '8px 4px 8px 8px' }} />
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('inventory.colProduct')}
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('inventory.colVariant')}
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('inventory.colStockState')}
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('inventory.colQty')}
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('inventory.colPrice')}
            </th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--admin-color-text-muted)' }}>
              {t('common.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: pageSize }, (_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                  <td colSpan={colCount} style={{ padding: '10px 12px' }}>
                    <div className="skeleton" style={{ height: 14, width: '100%' }} />
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
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-box modal-box--wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 className="modal-title">Lịch sử biến động — {title || '—'}</h2>
          <button type="button" className="btn-icon btn-secondary-ghost"
            onClick={onClose} aria-label="Đóng">✕</button>
        </header>

        <div className="modal-body">
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
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                    {['Loại', 'Biến thể', 'Delta', 'Sau', 'Nguồn', 'Serial', 'Ghi chú', 'Thời gian'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.status === 'loading'
                    ? Array.from({ length: 6 }, (_, i) => (
                        <tr key={i}><td colSpan={8} style={{ padding: '8px' }}>
                          <div className="skeleton" style={{ height: 14, width: '100%' }} />
                        </td></tr>
                      ))
                    : state.items.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                          <td style={{ padding: '6px 8px' }}><MovementTypeBadge type={m.movementType} /></td>
                          <td style={{ padding: '6px 8px' }}>
                            {m.variantName
                              ? <span>{m.variantName}{m.variantSku ? ` · ${m.variantSku}` : ''}</span>
                              : <em style={{ color: 'var(--admin-color-text-muted)' }}>(Sản phẩm)</em>}
                          </td>
                          <td style={{ padding: '6px 8px', fontWeight: 700, color: m.quantityDelta > 0 ? '#16a34a' : '#dc2626' }}>
                            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                          </td>
                          <td style={{ padding: '6px 8px' }}>{m.quantityAfter}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.referenceType || '—'}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>
                            {m.serialCount > 0
                              ? <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{m.serialCount} S/N</span>
                              : '—'}
                          </td>
                          <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.note || '—'}</td>
                          <td style={{ padding: '6px 8px', color: 'var(--admin-color-text-muted)' }}>{m.createdAt ? formatDateTime(m.createdAt) : '—'}</td>
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
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', stockState: 'ALL', page: 1, pageSize: 20 }

export function InventoryScreen({ canUpdate = false }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [summary, setSummary] = useState(null)
  const [stockInTarget, setStockInTarget] = useState(null)
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [serialTarget, setSerialTarget] = useState(null)
  const [isSerialOpen, setIsSerialOpen] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0)
  const [csvDownloading, setCsvDownloading] = useState(false)
  const [serialOnlyMode, setSerialOnlyMode] = useState(false)

  useEffect(() => {
    fetchInventorySummary().then(setSummary)
    fetchSerialInventoryOnly().then(setSerialOnlyMode)
  }, [])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    fetchInventoryGrouped(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query, inventoryRefreshKey])

  function handleStockInSuccess() {
    setIsStockInOpen(false)
    setStockInTarget(null)
    setInventoryRefreshKey((k) => k + 1)
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
    setInventoryRefreshKey((k) => k + 1)
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
          <button
            type="button"
            className="btn btn-secondary"
            disabled={csvDownloading}
            onClick={() => {
              setCsvDownloading(true)
              downloadInventoryCsv()
                .catch((err) => toast.error('Xuất CSV thất bại: ' + (err?.message || 'Lỗi không xác định')))
                .finally(() => setCsvDownloading(false))
            }}
          >
            {csvDownloading ? 'Đang xuất…' : 'Xuất CSV'}
          </button>
        </div>
      </header>

      <SummaryBanner summary={summary} />

      {serialOnlyMode && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 8, padding: '10px 16px', marginBottom: 12,
        }}>
          <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
          <span style={{ color: '#1d4ed8', fontWeight: 600, fontSize: '0.875rem' }}>
            Tồn kho đang được tính tự động từ serial. Không thể sửa số lượng thủ công.
          </span>
        </div>
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
