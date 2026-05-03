import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AdminTable } from '../components/AdminTable'
import { PaginationControls } from '../components/PaginationControls'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import {
  adjustStock,
  fetchAllMovements,
  fetchInventory,
  fetchInventorySummary,
  inventoryExportCsvUrl,
} from '../lib/adminApi'
import { formatCurrencyVnd, formatDateTime } from '../lib/formatters'
import { useDebounce } from '../lib/useDebounce'

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
  if (!summary || summary.totalVariants === 0) return null
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
      {summary.outOfStockCount > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 16px' }}>
          <span style={{ color: '#dc2626', fontWeight: 700 }}>{summary.outOfStockCount}</span>
          <span style={{ color: '#dc2626', marginLeft: 6, fontSize: '0.85rem' }}>Hết hàng</span>
        </div>
      )}
      {summary.lowStockCount > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 16px' }}>
          <span style={{ color: '#d97706', fontWeight: 700 }}>{summary.lowStockCount}</span>
          <span style={{ color: '#d97706', marginLeft: 6, fontSize: '0.85rem' }}>Sắp hết hàng</span>
        </div>
      )}
      <div style={{ background: 'var(--admin-color-surface)', border: '1px solid var(--admin-color-border)', borderRadius: 8, padding: '8px 16px' }}>
        <span style={{ fontWeight: 700 }}>{summary.totalVariants}</span>
        <span style={{ marginLeft: 6, fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>Tổng variants</span>
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
          <textarea
            id="serial-batch-input"
            ref={textareaRef}
            className="control-input"
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
    setFormError('')
    setTimeout(() => qtyRef.current?.focus(), 60)
  }

  function handleChangeVariant() {
    setSelectedItem(null)
    setShowPicker(true)
    setFormError('')
    setTimeout(() => searchRef.current?.focus(), 60)
  }

  function validate() {
    const qty = parseInt(quantity, 10)
    if (!selectedItem?.variantId) {
      return t('inventory.stockIn.errorVariantRequired', { defaultValue: 'Vui lòng chọn variant cần nhập hàng.' })
    }
    if (!quantity || isNaN(qty) || qty < 1) {
      return t('inventory.stockIn.errorQtyRequired')
    }
    if (serials.length < qty) {
      return t('inventory.stockIn.errorSerialCountTooFew', { serials: serials.length, qty })
    }
    if (serials.length > qty) {
      return t('inventory.stockIn.errorSerialCount', { serials: serials.length, qty })
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
      await adjustStock(
        selectedItem.variantId,
        qty,
        'IN',
        note.trim() || undefined,
        serials,
      )
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
                {t('inventory.stockIn.selectVariant', { defaultValue: 'Chọn variant' })}
              </label>
              <input
                id="stock-in-variant-search"
                ref={searchRef}
                type="search"
                className="control-input"
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
                    {t('inventory.stockIn.noVariantResults', { defaultValue: 'Không tìm thấy variant phù hợp.' })}
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
                          {[candidate.variantName, candidate.variantSku].filter(Boolean).join(' · ') || '—'}
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

          {/* Selected variant summary */}
          {selectedItem && (
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
                <div>
                  <span style={{ color: 'var(--admin-color-text-muted)', fontSize: 'var(--admin-text-xs)' }}>
                    {t('inventory.colVariant')}:{' '}
                  </span>
                  <strong>{variantLabel}</strong>
                </div>
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
                  {t('inventory.stockIn.changeVariant', { defaultValue: 'Đổi variant' })}
                </button>
              )}
            </div>
          )}

          {/* Form fields — id links to submit button in footer */}
          <form id="stock-in-form" onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="stock-in-qty">
                {t('inventory.stockIn.labelQty')}{' '}
                <span aria-hidden="true" style={{ color: 'var(--admin-color-brand-red)' }}>*</span>
              </label>
              <input
                id="stock-in-qty"
                ref={qtyRef}
                type="number"
                className="control-input"
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
              <input
                id="stock-in-note"
                type="text"
                className="control-input"
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

// ── All-movements tab ─────────────────────────────────────────────────────────

const INITIAL_MV_QUERY = { page: 1, pageSize: 20, movementType: '', referenceType: '' }

function AllMovementsTab({ refreshKey = 0 }) {
  const [query, setQuery] = useState(INITIAL_MV_QUERY)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null })

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    fetchAllMovements(query)
      .then((r) => { if (active) setState({ status: 'success', items: r.items, pagination: r.pagination }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], pagination: null, error: e.message }) })
    return () => { active = false }
  }, [query, refreshKey])

  const MV_TYPE_OPTIONS = ['', 'IN', 'OUT', 'RETURN']
  const REF_TYPE_OPTIONS = ['', 'ORDER', 'ORDER_CANCEL', 'RETURN', 'MANUAL']

  return (
    <section>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <label>
          Loại biến động
          <select className="control-select" value={query.movementType}
            onChange={(e) => setQuery((q) => ({ ...q, movementType: e.target.value, page: 1 }))}>
            {MV_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'Tất cả'}</option>)}
          </select>
        </label>
        <label>
          Nguồn
          <select className="control-select" value={query.referenceType}
            onChange={(e) => setQuery((q) => ({ ...q, referenceType: e.target.value, page: 1 }))}>
            {REF_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t || 'Tất cả'}</option>)}
          </select>
        </label>
      </div>

      {state.status === 'error' && (
        <StatePanel tone="danger" title="Lỗi tải dữ liệu" description={state.error}
          actionLabel="Thử lại" onAction={() => setQuery((q) => ({ ...q }))} />
      )}
      {state.status === 'success' && state.items.length === 0 && (
        <StatePanel tone="neutral" title="Không có dữ liệu" description="Không tìm thấy biến động nào." />
      )}

      {(state.status === 'loading' || (state.status === 'success' && state.items.length > 0)) && (
        <>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                {['Loại', 'Sản phẩm / Variant', 'Delta', 'Sau', 'Nguồn', 'Serial', 'Ghi chú', 'Thời gian'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.status === 'loading'
                ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}><td colSpan={8} style={{ padding: '8px' }}>
                    <div className="skeleton" style={{ height: 14, width: '100%' }} />
                  </td></tr>
                ))
                : state.items.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--admin-color-border)' }}>
                    <td style={{ padding: '6px 8px' }}><MovementTypeBadge type={m.movementType} /></td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ fontWeight: 500 }}>{m.productName || '—'}</span>
                      {m.variantName && <span style={{ color: 'var(--admin-color-text-muted)', marginLeft: 4 }}>· {m.variantName}</span>}
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
          {state.status === 'success' && state.pagination && (
            <PaginationControls pagination={state.pagination}
              onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
          )}
        </>
      )}
    </section>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const INITIAL_QUERY = { q: '', stockState: 'ALL', page: 1, pageSize: 20 }

export function InventoryScreen({ canUpdate = false }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'movements'
  const [query, setQuery] = useState(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 250)
  const isFirst = useRef(true)
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, warning: '' })
  const [summary, setSummary] = useState(null)
  const [stockInTarget, setStockInTarget] = useState(null)
  const [isStockInOpen, setIsStockInOpen] = useState(false)
  const [inventoryRefreshKey, setInventoryRefreshKey] = useState(0)
  const [movementsRefreshKey, setMovementsRefreshKey] = useState(0)

  useEffect(() => {
    fetchInventorySummary().then(setSummary)
  }, [])

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setQuery((q) => ({ ...q, q: debouncedSearch, page: 1 }))
  }, [debouncedSearch])

  useEffect(() => {
    if (activeTab !== 'stock') return
    let active = true
    Promise.resolve().then(() => {
      if (active) setState((s) => ({ ...s, status: 'loading' }))
    })
    fetchInventory(query)
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, pagination: r.pagination, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], pagination: null, warning: '', error: e.message })
      })
    return () => { active = false }
  }, [query, activeTab, inventoryRefreshKey])

  function handleStockInSuccess() {
    setIsStockInOpen(false)
    setStockInTarget(null)
    setInventoryRefreshKey((k) => k + 1)
    setMovementsRefreshKey((k) => k + 1)
    fetchInventorySummary().then(setSummary)
  }

  function openStockIn(item = null) {
    setStockInTarget(item)
    setIsStockInOpen(true)
  }

  function closeStockIn() {
    setIsStockInOpen(false)
    setStockInTarget(null)
  }

  const columns = useMemo(() => [
    {
      key: 'product', label: t('inventory.colProduct'), skeletonWidth: '80%',
      render: (item) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProductThumbnail image={item.productImage} alt={item.productName} size={40} />
          <span>
            <p style={{ fontWeight: 500 }}>{item.productName}</p>
            {item.productSku && <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)' }}>{item.productSku}</p>}
          </span>
        </span>
      ),
    },
    {
      key: 'variant', label: t('inventory.colVariant'), skeletonWidth: '65%',
      render: (item) => (
        <span>
          <p>{item.variantName}</p>
          {item.variantSku && <p style={{ fontSize: '0.75rem', color: 'var(--admin-color-text-muted)', fontFamily: 'monospace' }}>{item.variantSku}</p>}
        </span>
      ),
    },
    {
      key: 'retailPrice', label: t('inventory.colPrice'), align: 'right', skeletonWidth: '55%',
      render: (item) => formatCurrencyVnd(item.retailPrice),
    },
    {
      key: 'stockState', label: t('inventory.colStockState'), skeletonWidth: '50%',
      render: (item) => <StockBadge state={item.stockState} />,
    },
    {
      key: 'quantityOnHand', label: t('inventory.colQty'), align: 'right', skeletonWidth: '30%',
      render: (item) => <strong style={{ fontSize: '1rem' }}>{item.quantityOnHand}</strong>,
    },
    canUpdate ? {
      key: 'actions', label: t('common.actions'), skeletonWidth: '40%',
      render: (item) => (
        <button
          type="button"
          className="btn btn-secondary"
          style={{ fontSize: '0.8rem', padding: '0.25rem 0.625rem', whiteSpace: 'nowrap' }}
          onClick={() => openStockIn(item)}
        >
          {t('inventory.stockIn.btnLabel')}
        </button>
      ),
    } : null,
  ].filter(Boolean), [t, canUpdate])

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('inventory.eyebrow')}</p>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.description')}</p>
        </div>
        <div className="screen-actions">
          {canUpdate && (
            <button type="button" className="btn btn-primary" onClick={() => openStockIn()}>
              {t('inventory.stockIn.btnLabel')}
            </button>
          )}
          <a href={inventoryExportCsvUrl()} className="btn btn-secondary" download>
            Xuất CSV
          </a>
        </div>
      </header>

      <SummaryBanner summary={summary} />

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--admin-color-border)', marginBottom: 20 }}>
        {[['stock', 'Tồn kho'], ['movements', 'Lịch sử biến động']].map(([id, label]) => (
          <button key={id} type="button"
            style={{
              background: 'none', border: 'none', padding: '8px 20px', cursor: 'pointer',
              fontWeight: activeTab === id ? 700 : 400,
              borderBottom: activeTab === id ? '2px solid var(--admin-color-primary)' : '2px solid transparent',
              marginBottom: -2, color: activeTab === id ? 'var(--admin-color-primary)' : 'var(--admin-color-text-muted)',
            }}
            onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'movements' && <AllMovementsTab refreshKey={movementsRefreshKey} />}

      {activeTab === 'stock' && (
        <>
          {state.warning && <ReadOnlyBanner warning={state.warning} />}

          <section className="filter-bar">
            <label>
              {t('common.search')}
              <input type="search" className="control-input"
                placeholder={t('inventory.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)} />
            </label>
            <label>
              {t('inventory.filterStock')}
              <select className="control-select" value={query.stockState}
                onChange={(e) => setQuery((q) => ({ ...q, stockState: e.target.value, page: 1 }))}>
                {STOCK_STATES.map((s) => (
                  <option key={s} value={s}>{s === 'ALL' ? t('common.all') : s.replace(/_/g, ' ')}</option>
                ))}
              </select>
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
              <AdminTable
                caption={t('inventory.tableCaption')}
                columns={columns}
                rows={state.items}
                loading={state.status === 'loading'}
                pageSize={query.pageSize}
              />
              {state.status === 'success' && state.pagination && (
                <PaginationControls pagination={state.pagination}
                  onPageChange={(p) => setQuery((q) => ({ ...q, page: p }))} />
              )}
            </>
          )}
        </>
      )}

      {isStockInOpen && (
        <StockInModal
          item={stockInTarget}
          onSuccess={handleStockInSuccess}
          onClose={closeStockIn}
        />
      )}
    </section>
  )
}
