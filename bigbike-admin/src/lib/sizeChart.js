import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa field chuỗi `sizeGuide` (lưu dạng <table> HTML cho web render) và
 * model nhập có cấu trúc dùng trong admin:
 *   { columns: [{ _key, label }], rows: [{ _key, cells: string[] }], note }
 * SỐ CỘT LINH HOẠT — admin tự thêm/bớt cột bất kỳ (không cố định 4 cột). Mỗi dòng có
 * `cells` dài đúng bằng số cột. Cột rỗng-tên vẫn xuất ra <th></th> để giữ đúng số cột.
 */

export const SIZE_COL2_DEFAULT = 'Vòng đầu (cm)'

/** Model rỗng mặc định: 2 cột (Size + số đo), chưa có dòng. */
export function emptySizeGuide() {
  return {
    columns: [
      { _key: generateId(), label: 'Size' },
      { _key: generateId(), label: SIZE_COL2_DEFAULT },
    ],
    rows: [],
    note: '',
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Lấy phần ghi chú = các <p>/<li> nằm NGOÀI bảng (cell dùng <td>, không lẫn). */
function parseNote(doc) {
  return [...doc.querySelectorAll('p, li')]
    .filter((el) => !el.closest('table'))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean)
    .join('\n')
}

/** HTML <table> (+ <p> ghi chú) đã lưu → model nội bộ. Có fallback cho dữ liệu cũ gõ tay
 *  kiểu "- M: 57-58 cm" để không mất nội dung khi mở lần đầu. */
export function parseSizeGuide(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return emptySizeGuide()
  if (typeof DOMParser === 'undefined') return emptySizeGuide()
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (table) {
      const headerCells = [...table.querySelectorAll('thead th, thead td')]
      const bodyCells = [...table.querySelectorAll('tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td, th')].map((c) => (c.textContent || '').trim()),
      )
      let colCount = Math.max(headerCells.length, ...bodyCells.map((c) => c.length), 0)
      if (colCount < 1) colCount = 2
      const columns = []
      for (let i = 0; i < colCount; i++) {
        columns.push({ _key: generateId(), label: (headerCells[i]?.textContent || '').trim() })
      }
      const rows = bodyCells
        .filter((cells) => cells.some(Boolean))
        .map((cells) => {
          const padded = []
          for (let i = 0; i < colCount; i++) padded.push(cells[i] || '')
          return { _key: generateId(), cells: padded }
        })
      return { columns, rows, note: parseNote(doc) }
    }
    // Fallback: dữ liệu cũ là văn bản thuần (vd "Đo...:\n- M: 57-58 cm\n- L: ...").
    const text = (doc.body.textContent || html).replace(/\r/g, '')
    const rows = []
    const noteLines = []
    text.split('\n').forEach((raw) => {
      const line = raw.trim().replace(/^[-•*]\s*/, '')
      if (!line) return
      const m = line.match(/^([\wÀ-ỹ0-9./+]{1,12})\s*[:：]\s*(.+)$/)
      if (m) rows.push({ _key: generateId(), cells: [m[1].trim(), m[2].trim()] })
      else noteLines.push(line)
    })
    return {
      columns: [
        { _key: generateId(), label: 'Size' },
        { _key: generateId(), label: SIZE_COL2_DEFAULT },
      ],
      rows,
      note: noteLines.join('\n'),
    }
  } catch {
    return emptySizeGuide()
  }
}

/** Model nội bộ → HTML lưu vào `sizeGuide`. Rỗng (không dòng nào có nội dung) → '' phần bảng.
 *  Số cột xuất ra = số cột trong model; ô thiếu coi là rỗng. */
export function serializeSizeGuide(value) {
  if (!value) return ''
  const columns = value.columns || []
  const colCount = columns.length
  const rows = (value.rows || [])
    .map((r) => (r.cells || []).map((c) => (c || '').trim()))
    .filter((cells) => cells.some(Boolean))
  const note = (value.note || '').trim()
  let html = ''
  if (rows.length > 0 && colCount > 0) {
    const head = columns.map((c) => `<th>${escapeHtml((c.label || '').trim())}</th>`).join('')
    html += `<table><thead><tr>${head}</tr></thead><tbody>`
    rows.forEach((cells) => {
      let tds = ''
      for (let i = 0; i < colCount; i++) tds += `<td>${escapeHtml(cells[i] || '')}</td>`
      html += `<tr>${tds}</tr>`
    })
    html += '</tbody></table>'
  }
  if (note) html += `<p>${escapeHtml(note)}</p>`
  return html
}
