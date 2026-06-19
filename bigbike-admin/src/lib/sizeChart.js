import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa field chuỗi `sizeGuide` (lưu dạng <table> HTML cho web render) và
 * model nhập theo dòng dùng trong admin:
 *   { col2, col3, col4, rows:[{_key,size,value,value3,value4}], note }.
 * Cột 1 luôn là "Size". Cột 2 (số đo) luôn có. Cột 3 & 4 là TÙY CHỌN — chỉ xuất ra
 * HTML khi admin đặt tên cho cột (vd "Kích cỡ vỏ", "Ghi chú"), nên dữ liệu cũ 2 cột
 * vẫn render đúng 2 cột. Tách khỏi component để SizeChartEditor.jsx chỉ export component.
 */

export const SIZE_COL2_DEFAULT = 'Vòng đầu (cm)'
export const SIZE_COL3_PLACEHOLDER = 'Kích cỡ vỏ'
export const SIZE_COL4_PLACEHOLDER = 'Ghi chú'

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** HTML <table> (+ <p> ghi chú) đã lưu → model nội bộ. Có fallback cho dữ liệu cũ gõ tay
 *  kiểu "- M: 57-58 cm" để không mất nội dung khi mở lần đầu. */
export function parseSizeGuide(html) {
  const empty = { col2: SIZE_COL2_DEFAULT, col3: '', col4: '', rows: [], note: '' }
  if (!html || typeof html !== 'string' || !html.trim()) return empty
  if (typeof DOMParser === 'undefined') return empty
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (table) {
      const headerCells = table.querySelectorAll('thead th, thead td')
      const headText = (i) => (headerCells.length > i ? (headerCells[i].textContent || '').trim() : '')
      const col2 = headText(1)
      const col3 = headText(2)
      const col4 = headText(3)
      const rows = []
      table.querySelectorAll('tbody tr').forEach((tr) => {
        const cells = tr.querySelectorAll('td, th')
        const cellText = (i) => (cells[i]?.textContent || '').trim()
        const size = cellText(0)
        const value = cellText(1)
        const value3 = cellText(2)
        const value4 = cellText(3)
        if (size || value || value3 || value4) {
          rows.push({ _key: generateId(), size, value, value3, value4 })
        }
      })
      const note = [...doc.querySelectorAll('p, li')]
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean)
        .join('\n')
      return { col2: col2 || SIZE_COL2_DEFAULT, col3, col4, rows, note }
    }
    // Fallback: dữ liệu cũ là văn bản thuần (vd "Đo...:\n- M: 57-58 cm\n- L: ...").
    const text = (doc.body.textContent || html).replace(/\r/g, '')
    const rows = []
    const noteLines = []
    text.split('\n').forEach((raw) => {
      const line = raw.trim().replace(/^[-•*]\s*/, '')
      if (!line) return
      const m = line.match(/^([\wÀ-ỹ0-9./+]{1,12})\s*[:：]\s*(.+)$/)
      if (m) rows.push({ _key: generateId(), size: m[1].trim(), value: m[2].trim(), value3: '', value4: '' })
      else noteLines.push(line)
    })
    return { col2: SIZE_COL2_DEFAULT, col3: '', col4: '', rows, note: noteLines.join('\n') }
  } catch {
    return empty
  }
}

/** Model nội bộ → HTML lưu vào `sizeGuide`. Rỗng → '' (ProductDetailScreen quy null).
 *  Cột 3/4 chỉ xuất khi có tên cột (giữ tương thích dữ liệu cũ 2 cột). */
export function serializeSizeGuide(value) {
  if (!value) return ''
  const rows = (value.rows || []).filter(
    (r) => (r.size || '').trim() || (r.value || '').trim() || (r.value3 || '').trim() || (r.value4 || '').trim(),
  )
  const note = (value.note || '').trim()
  const col3 = (value.col3 || '').trim()
  const col4 = (value.col4 || '').trim()
  let html = ''
  if (rows.length > 0) {
    const h2 = escapeHtml((value.col2 || '').trim() || SIZE_COL2_DEFAULT)
    let head = `<th>Size</th><th>${h2}</th>`
    if (col3) head += `<th>${escapeHtml(col3)}</th>`
    if (col4) head += `<th>${escapeHtml(col4)}</th>`
    html += `<table><thead><tr>${head}</tr></thead><tbody>`
    rows.forEach((r) => {
      let cells = `<td>${escapeHtml((r.size || '').trim())}</td><td>${escapeHtml((r.value || '').trim())}</td>`
      if (col3) cells += `<td>${escapeHtml((r.value3 || '').trim())}</td>`
      if (col4) cells += `<td>${escapeHtml((r.value4 || '').trim())}</td>`
      html += `<tr>${cells}</tr>`
    })
    html += '</tbody></table>'
  }
  if (note) html += `<p>${escapeHtml(note)}</p>`
  return html
}
