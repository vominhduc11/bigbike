import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi giữa danh sách thông số có cấu trúc (model nhập trong admin) và HTML lưu vào
 * `specifications` — để web render HTML thay cho bảng dòng. Model: [{ _key, name, value }].
 *
 * HTML sinh ra mirror đúng markup web hiện tại (table.shop_attributes, mỗi dòng <th scope="row">
 * tên + <td> giá trị) để giao diện không đổi. Như sizeChart/suitabilityCards: tab "Có cấu trúc"
 * chỉ là công cụ nhập, `specifications` mới là nguồn render.
 */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeRow(s) {
  return { name: (s?.name || '').trim(), value: (s?.value || '').trim() }
}
const rowHasContent = (s) => s.name || s.value

/** items[] ({name,value}) → HTML bảng (rỗng nếu không dòng nào có nội dung). */
export function serializeSpecs(items) {
  const rows = (items || []).map(normalizeRow).filter(rowHasContent)
  if (rows.length === 0) return ''
  const trs = rows
    .map((s) => `<tr><th scope="row">${escapeHtml(s.name)}</th><td>${escapeHtml(s.value)}</td></tr>`)
    .join('')
  return `<table class="shop_attributes"><tbody>${trs}</tbody></table>`
}

/** HTML → items[] (best-effort). Đọc <tr> (ngoài thead): ô đầu = tên, ô sau = giá trị.
 *  Fallback dòng "tên: giá trị" cho HTML cũ gõ tay. */
export function parseSpecsFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (table) {
      return [...table.querySelectorAll('tr')]
        .filter((tr) => !tr.closest('thead'))
        .map((tr) => {
          const cells = [...tr.querySelectorAll('th, td')]
          return {
            _key: generateId(),
            name: (cells[0]?.textContent || '').trim(),
            value: (cells.slice(1).map((c) => (c.textContent || '').trim()).join(' ')).trim(),
          }
        })
        .filter(rowHasContent)
    }
    // Fallback: text thuần "tên: giá trị" mỗi dòng.
    const text = (doc.body.textContent || html).replace(/\r/g, '')
    return text
      .split('\n')
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s*[:：]\s*(.+)$/)
        return m
          ? { _key: generateId(), name: m[1].trim(), value: m[2].trim() }
          : { _key: generateId(), name: line, value: '' }
      })
      .filter(rowHasContent)
  } catch {
    return []
  }
}

function rowsOf(tbody) {
  return [...tbody.querySelectorAll('tr')]
}

/**
 * Ghép model thông số vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/class/markup.
 * Dòng thêm mới nhân bản dòng cuối (kế thừa CSS), bớt thì gỡ node. HTML trống / không phải bảng
 * → sinh mặc định serializeSpecs.
 */
export function mergeSpecsIntoHtml(items, existingHtml) {
  const fresh = serializeSpecs(items)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    const table = doc.querySelector('table')
    const tbody = table?.querySelector('tbody') || table
    if (!table || !tbody) return fresh

    const rows = (items || []).map(normalizeRow).filter(rowHasContent)
    if (rows.length === 0) {
      table.remove()
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    let trs = rowsOf(tbody).filter((tr) => !tr.closest('thead'))
    while (trs.length < rows.length) {
      const last = trs[trs.length - 1]
      let tr
      if (last) {
        tr = last.cloneNode(true)
        tr.querySelectorAll('th, td').forEach((c) => { c.textContent = '' })
      } else {
        tr = doc.createElement('tr')
        const th = doc.createElement('th')
        th.setAttribute('scope', 'row')
        tr.appendChild(th)
        tr.appendChild(doc.createElement('td'))
      }
      tbody.appendChild(tr)
      trs = rowsOf(tbody).filter((t) => !t.closest('thead'))
    }
    while (trs.length > rows.length) {
      trs[trs.length - 1].remove()
      trs = rowsOf(tbody).filter((t) => !t.closest('thead'))
    }

    rows.forEach((s, ri) => {
      const tr = trs[ri]
      if (!tr) return
      let cells = [...tr.querySelectorAll('th, td')]
      while (cells.length < 2) {
        tr.appendChild(doc.createElement('td'))
        cells = [...tr.querySelectorAll('th, td')]
      }
      cells[0].textContent = s.name
      cells[1].textContent = s.value
    })

    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
