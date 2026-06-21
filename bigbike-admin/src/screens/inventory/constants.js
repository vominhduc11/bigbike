// Constants and pure helpers for InventoryScreen.
// Extracted from InventoryScreen.jsx to keep the screen file focused on behaviour
// and so fast-refresh stays component-only in the .jsx files.

export const STOCK_STATES = ['ALL', 'IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK']

export const INITIAL_QUERY = { q: '', stockState: 'ALL', page: 1, pageSize: 20 }

export const MOVEMENT_TYPE_CLASSES = { IN: 'text-success', OUT: 'text-danger', RETURN: 'text-info' }

// ── Serial batch helpers ──────────────────────────────────────────────────────

export const SERIAL_PREVIEW_LIMIT = 30

export function parseSerialBatch(text) {
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
export const FILE_IMPORT_SIZE_LIMIT_MB = 5
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
export async function parseSerialFromFile(file) {
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
export async function parseSerialFileAsObjects(file) {
  const serials = await parseSerialFromFile(file)
  return serials.map((s) => ({ serial: s }))
}

// ── Grouped inventory table helpers ───────────────────────────────────────────

// Tách tên biến thể đã ghép ("color: den-do-trang-2, size: m") thành các cặp
// thuộc tính. Trả null khi tên không ở dạng "key: value, …".
export function parseVariantAttrs(variantName) {
  if (!variantName || typeof variantName !== 'string') return null
  const attrs = []
  for (const seg of variantName.split(',')) {
    const part = seg.trim()
    if (!part) continue
    const idx = part.indexOf(':')
    if (idx < 0) return null
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key || !value) return null
    attrs.push({ key, value })
  }
  if (attrs.length < 2) return null
  const [first, ...rest] = attrs
  return {
    groupKey: first.value.toLowerCase(),
    groupLabel: first.value,
    subLabel: rest.map((a) => a.value).join(' · '),
  }
}

// Gom biến thể của một sản phẩm theo thuộc tính đầu tiên (thường là màu). Trả
// { grouped: false } khi tên không tách được hoặc gom cũng không giảm số dòng —
// khi đó caller render danh sách biến thể phẳng như cũ.
export function groupVariantsByColor(variants) {
  if (!Array.isArray(variants) || variants.length < 2) return { grouped: false }
  const map = new Map()
  for (const v of variants) {
    const attrs = parseVariantAttrs(v.variantName)
    if (!attrs) return { grouped: false }
    if (!map.has(attrs.groupKey)) {
      map.set(attrs.groupKey, { key: attrs.groupKey, label: attrs.groupLabel, variants: [] })
    }
    map.get(attrs.groupKey).variants.push({ ...v, subLabel: attrs.subLabel })
  }
  if (map.size >= variants.length) return { grouped: false }
  return { grouped: true, groups: Array.from(map.values()) }
}

// Gộp trạng thái kho của nhiều biến thể về một badge, theo quy ước cấp sản phẩm
// (chỉ cần một biến thể hết hàng là cả nhóm hiển thị hết hàng).
export function aggregateVariantState(variants) {
  if (variants.some((v) => v.stockState === 'OUT_OF_STOCK')) return 'OUT_OF_STOCK'
  if (variants.some((v) => v.stockState === 'LOW_STOCK')) return 'LOW_STOCK'
  if (variants.some((v) => v.stockState === 'IN_STOCK')) return 'IN_STOCK'
  return 'UNKNOWN'
}
