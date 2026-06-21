import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { importBulkSerials } from '../../lib/adminApi'
import { Input } from '@/components/ui/input'
import { parseSerialFileAsObjects } from './constants'

export function AddSerialsPanel({ item, onSuccess }) {
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
        <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm"
          onClick={() => fileInputRef.current?.click()} disabled={submitting || parsing}>
          {parsing ? 'Đang đọc file…' : 'Import từ file'}
        </button>
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
      <div className="overflow-x-auto">
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
                    <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm"
                      onClick={() => removeRow(i)} disabled={submitting} aria-label="Xoá dòng">✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm mb-3.5"
        onClick={addRow} disabled={submitting}>
        + Thêm dòng
      </button>

      {error && (
        <p role="alert" className="text-destructive text-xs mb-2">{error}</p>
      )}

      <div className="flex gap-2 items-center flex-wrap">
        <button type="submit" className="bb-btn bb-btn-primary" disabled={submitting || validCount === 0}>
          {submitting ? 'Đang nhập…' : `Nhập ${validCount} serial`}
        </button>
      </div>

      {/* Import result — skipped rows with reasons */}
      {importResult && importResult.skipped > 0 && (
        <div className="mt-4 bg-warning-bg border border-warning-border px-3.5 py-3">
          <p className="font-semibold text-sm mb-1.5">
            Kết quả: {importResult.inserted} nhập thành công · {importResult.skipped} dòng bị bỏ qua
          </p>
          <div className="overflow-x-auto">
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
          </div>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm mt-2.5"
            onClick={handleRetrySkipped}>
            Tải lại {importResult.skipped} dòng lỗi để sửa
          </button>
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
