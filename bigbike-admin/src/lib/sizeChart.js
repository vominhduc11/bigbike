import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult } from './htmlImport'

/**
 * Chuyển đổi giữa field chuỗi `sizeGuide` (lưu dạng <table> HTML cho web render) và
 * model nhập có cấu trúc dùng trong admin:
 *   { columns: [{ _key, label }], rows: [{ _key, cells: string[] }], note }
 * SỐ CỘT LINH HOẠT — admin tự thêm/bớt cột bất kỳ (không cố định 4 cột). Mỗi dòng có
 * `cells` dài đúng bằng số cột. Cột rỗng-tên vẫn xuất ra <th></th> để giữ đúng số cột.
 */

export const SIZE_COL2_DEFAULT = 'Vòng đầu (cm)'

/** Style inline chuẩn mà structured mode hiện có thể sinh ra cho bảng size trên PDP.
 *  AI brief không yêu cầu các thuộc tính trình bày này; website tự lọc và áp dụng CSS. */
const SIZE_TABLE_STYLE =
  'width:100%;min-width:520px;border-collapse:collapse;font-family:var(--bb-font-body);font-size:var(--bb-text-a4-content);line-height:1.5;color:var(--bb-text-primary);margin:0 0 12px 0;'
const SIZE_TH_STYLE =
  'background:var(--bb-bg-surface-raised);color:var(--bb-text-primary);border:1px solid var(--bb-border-subtle);padding:12px 16px;text-align:center;font-weight:700;white-space:nowrap;'
const SIZE_TD_STYLE =
  'border:1px solid var(--bb-border-subtle);padding:12px 16px;text-align:center;vertical-align:middle;'
const SIZE_TD_FIRST_STYLE = `${SIZE_TD_STYLE}font-weight:700;`
const SIZE_NOTE_STYLE =
  'font-family:var(--bb-font-body);font-size:var(--bb-text-a5-meta);line-height:1.5;color:var(--bb-text-secondary);margin:8px 0 0 0;'

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

function isLikelySizeLabel(value) {
  return /^(?:size\s*)?(?:xxxs|xxs|xs|s|m|l|xl|xxl|xxxl|[2-9]xl|small|medium|large|free(?:\s+size)?|\d{1,3})(?:\s*[/,-]\s*[a-z0-9]+)?$/i.test(
    value.trim(),
  )
}

function isLikelySizeMeasurement(value) {
  return /\d/.test(value) && /(?:cm|mm|inch|\bin\b|kg|gram|\bg\b|lb|lbs)/i.test(value)
}

function headingSizePairs(doc) {
  return [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((heading) => {
      const value = heading.nextElementSibling
      const size = (heading.textContent || '').trim()
      const measurement = (value?.textContent || '').trim()
      if (
        !value ||
        value.tagName !== 'P' ||
        !(isLikelySizeLabel(size) || isLikelySizeMeasurement(measurement)) ||
        !measurement
      )
        return null
      return { heading, value, size, measurement }
    })
    .filter(Boolean)
}

function parseSizeList(doc) {
  const rows = []
  const noteLines = []
  const listItems = [...doc.querySelectorAll('li')]
  listItems.forEach((item) => {
    const line = (item.textContent || '').replace(/\s+/g, ' ').trim()
    if (!line) return
    const match = line.match(/^(.+?)\s*(?:[:：]|\s+[–—-]\s+)\s*(.+)$/)
    if (match) rows.push({ _key: generateId(), cells: [match[1].trim(), match[2].trim()] })
    else noteLines.push(line)
  })
  return { rows, note: noteLines.join('\n') }
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
      const allRows = [...table.querySelectorAll('tr')]
      const explicitHeaderRow = table.querySelector('thead tr')
      const firstRow = allRows[0]
      const headerRow =
        explicitHeaderRow ||
        (firstRow && [...firstRow.querySelectorAll('th, td')].every((cell) => cell.tagName === 'TH')
          ? firstRow
          : null)
      const headerCells = headerRow ? [...headerRow.querySelectorAll('th, td')] : []
      const explicitBodyRows = [...table.querySelectorAll('tbody tr')]
      const bodyRows = explicitHeaderRow
        ? explicitBodyRows.length
          ? explicitBodyRows
          : allRows.filter((row) => row !== headerRow && !row.closest('thead'))
        : allRows.filter((row) => row !== headerRow)
      const bodyCells = bodyRows.map((tr) =>
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
    const headingRows = headingSizePairs(doc)
    if (headingRows.length) {
      return {
        columns: [
          { _key: generateId(), label: 'Size' },
          { _key: generateId(), label: SIZE_COL2_DEFAULT },
        ],
        rows: headingRows.map(({ size, measurement }) => ({
          _key: generateId(),
          cells: [size, measurement],
        })),
        note: '',
      }
    }
    const listRows = parseSizeList(doc)
    if (listRows.rows.length) {
      return {
        columns: [
          { _key: generateId(), label: 'Size' },
          { _key: generateId(), label: SIZE_COL2_DEFAULT },
        ],
        rows: listRows.rows,
        note: listRows.note,
      }
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

/** Detailed parser result used by the explicit, non-destructive HTML import flow. */
export function parseSizeGuideResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({ hasInput: hasHtmlInput(html), model: emptySizeGuide() })
  }
  const model = parseSizeGuide(html)
  return makeHtmlImportResult({
    items: model.rows,
    skippedCount: model.rows.length ? 0 : 1,
    hasInput: true,
    model,
  })
}

/**
 * Ghép model có cấu trúc vào HTML hiện có mà CHỈ đổi text, GIỮ NGUYÊN style/class/markup.
 * Dùng khi admin sửa ở tab "Có cấu trúc" nhưng HTML đã được tùy chỉnh CSS — chỉ phần chữ
 * trong các ô đổi theo, định dạng giữ nguyên. Dòng/cột thêm mới nhân bản phần tử cuối (kế thừa
 * CSS); dòng/cột bị bớt thì gỡ node. HTML trống / không phải bảng → sinh mặc định serializeSizeGuide.
 */
export function mergeSizeGuideIntoHtml(value, existingHtml) {
  const fresh = serializeSizeGuide(value)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    const table = doc.querySelector('table')
    const columns = value?.columns || []
    const rows = (value?.rows || [])
      .map((r) => (r.cells || []).map((c) => (c || '').trim()))
      .filter((cells) => cells.some(Boolean))
    if (!table) {
      const pairs = headingSizePairs(doc)
      if (pairs.length && pairs.length === rows.length && columns.length >= 2) {
        rows.forEach((cells, index) => {
          pairs[index].heading.textContent = cells[0] || ''
          pairs[index].value.textContent = cells[1] || ''
        })
        return doc.body.innerHTML
      }
      return fresh
    }

    let headRow = table.querySelector('thead tr')
    if (!headRow) {
      const firstRow = table.querySelector('tr')
      if (!firstRow) return fresh
      const thead = doc.createElement('thead')
      thead.appendChild(firstRow)
      table.insertBefore(thead, table.firstChild)
      headRow = firstRow
    }

    let tbody = table.querySelector('tbody')
    if (!tbody) {
      tbody = doc.createElement('tbody')
      ;[...table.querySelectorAll('tr')]
        .filter((row) => row !== headRow)
        .forEach((row) => tbody.appendChild(row))
      table.appendChild(tbody)
    }

    const colCount = columns.length

    // Bảng không còn nội dung → bỏ bảng, chỉ giữ/đặt ghi chú.
    if (rows.length === 0 || colCount === 0) {
      table.remove()
      applyNote(doc, value?.note)
      return doc.body.innerHTML
    }

    // --- Cột (header) ---
    syncCellCount(doc, headRow, colCount, 'th')
    const headCells = headerCellsOf(headRow)
    columns.forEach((c, i) => {
      if (headCells[i]) headCells[i].textContent = (c.label || '').trim()
    })

    // --- Dòng (body) ---
    syncRowCount(doc, tbody, rows.length, colCount)
    const bodyRows = bodyRowsOf(tbody)
    rows.forEach((cells, ri) => {
      const tr = bodyRows[ri]
      if (!tr) return
      syncCellCount(doc, tr, colCount, 'td')
      const tds = cellsOf(tr)
      for (let i = 0; i < colCount; i++) if (tds[i]) tds[i].textContent = cells[i] || ''
    })

    applyNote(doc, value?.note)
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}

function headerCellsOf(headRow) {
  return [...headRow.querySelectorAll('th, td')]
}
function cellsOf(tr) {
  return [...tr.querySelectorAll('th, td')]
}
function bodyRowsOf(tbody) {
  return [...tbody.querySelectorAll('tr')]
}

/** Thêm/bớt ô trong 1 hàng cho khớp count; ô thêm nhân bản ô cuối (giữ style), rỗng text. */
function syncCellCount(doc, row, count, tag) {
  let cells = cellsOf(row)
  while (cells.length < count) {
    const last = cells[cells.length - 1]
    const cell = last ? last.cloneNode(true) : doc.createElement(tag)
    cell.textContent = ''
    row.appendChild(cell)
    cells = cellsOf(row)
  }
  while (cells.length > count) {
    cells[cells.length - 1].remove()
    cells = cellsOf(row)
  }
}

/** Thêm/bớt dòng tbody cho khớp count; dòng thêm nhân bản dòng cuối (giữ style), text để trống. */
function syncRowCount(doc, tbody, count, colCount) {
  let rows = bodyRowsOf(tbody)
  while (rows.length < count) {
    const last = rows[rows.length - 1]
    let tr
    if (last) {
      tr = last.cloneNode(true)
      cellsOf(tr).forEach((c) => {
        c.textContent = ''
      })
    } else {
      tr = doc.createElement('tr')
      for (let i = 0; i < colCount; i++) tr.appendChild(doc.createElement('td'))
    }
    tbody.appendChild(tr)
    rows = bodyRowsOf(tbody)
  }
  while (rows.length > count) {
    rows[rows.length - 1].remove()
    rows = bodyRowsOf(tbody)
  }
}

/** Cập nhật ghi chú = <p> NGOÀI bảng; giữ <p> đầu (kèm style), bỏ các <p> note thừa. */
function applyNote(doc, rawNote) {
  const note = (rawNote || '').trim()
  const notePs = [...doc.querySelectorAll('p')].filter((p) => !p.closest('table'))
  if (note) {
    if (notePs.length) {
      notePs[0].textContent = note
      notePs.slice(1).forEach((p) => p.remove())
    } else {
      const p = doc.createElement('p')
      p.textContent = note
      doc.body.appendChild(p)
    }
  } else {
    notePs.forEach((p) => p.remove())
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
    const head = columns
      .map((c) => `<th style="${SIZE_TH_STYLE}">${escapeHtml((c.label || '').trim())}</th>`)
      .join('')
    html += `<table style="${SIZE_TABLE_STYLE}"><thead><tr>${head}</tr></thead><tbody>`
    rows.forEach((cells) => {
      let tds = ''
      for (let i = 0; i < colCount; i++) {
        const style = i === 0 ? SIZE_TD_FIRST_STYLE : SIZE_TD_STYLE
        tds += `<td style="${style}">${escapeHtml(cells[i] || '')}</td>`
      }
      html += `<tr>${tds}</tr>`
    })
    html += '</tbody></table>'
  }
  if (note) html += `<p style="${SIZE_NOTE_STYLE}"><em>${escapeHtml(note)}</em></p>`
  return html
}
