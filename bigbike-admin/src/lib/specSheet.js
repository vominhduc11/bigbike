import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult, textOf } from './htmlImport'
import { sanitizeInlineHtml } from './sanitizeHtml'

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

function inlineHtml(s) {
  const raw = String(s ?? '').trim()
  if (!raw) return ''
  return sanitizeInlineHtml(raw)
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
    .map(
      (s) => `<tr><th scope="row">${escapeHtml(s.name)}</th><td>${inlineHtml(s.value)}</td></tr>`,
    )
    .join('')
  return `<table class="shop_attributes"><tbody>${trs}</tbody></table>`
}

function headingSpecPairs(doc) {
  return [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    .map((heading) => {
      const value = heading.nextElementSibling
      return value && textOf(heading) && textOf(value) ? { heading, value } : null
    })
    .filter(Boolean)
}

function parseHeadingSpecs(doc) {
  const rows = []
  headingSpecPairs(doc).forEach(({ heading, value }) => {
    rows.push({ _key: generateId(), name: textOf(heading), value: inlineHtml(value.innerHTML) })
  })
  return rows
}

function parseListSpecs(doc) {
  const rows = []
  let skippedCount = 0
  const listItems = [...doc.querySelectorAll('li')]
  listItems.forEach((item) => {
    const line = textOf(item)
    const match = line.match(/^(.+?)\s*[:：]\s*(.+)$/)
    if (match) rows.push({ _key: generateId(), name: match[1].trim(), value: match[2].trim() })
    else skippedCount += 1
  })
  return { rows, skippedCount }
}

/** Detailed tolerant parser. The model intentionally reads only the first two table cells. */
export function parseSpecsResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({ hasInput: hasHtmlInput(html), items: [], extraColumnCount: 0 })
  }
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const table = doc.querySelector('table')
    if (table) {
      let skippedCount = 0
      let extraColumnCount = 0
      const rows = [...table.querySelectorAll('tr')]
        .filter((tr) => !tr.closest('thead'))
        .map((tr) => {
          const cells = [...tr.querySelectorAll('th, td')]
          if (cells.length > 2) extraColumnCount += cells.length - 2
          const row = {
            _key: generateId(),
            name: (cells[0]?.textContent || '').trim(),
            // Only the second cell belongs to the structured model. Additional cells stay in HTML.
            // Keep safe inline markup (not only text) so editing another row cannot strip
            // <strong>/<em> that the imported template intentionally contains.
            value: inlineHtml(cells[1]?.innerHTML || ''),
          }
          if (!rowHasContent(row)) skippedCount += 1
          return row
        })
        .filter(rowHasContent)
      return makeHtmlImportResult({
        items: rows,
        skippedCount: skippedCount + (rows.length ? 0 : 1),
        hasInput: true,
        extraColumnCount,
      })
    }

    const headingRows = parseHeadingSpecs(doc)
    if (headingRows.length) return makeHtmlImportResult({ items: headingRows, hasInput: true })

    const listRows = parseListSpecs(doc)
    if (listRows.rows.length) {
      return makeHtmlImportResult({
        items: listRows.rows,
        skippedCount: listRows.skippedCount,
        hasInput: true,
      })
    }

    // Fallback: text thuần "tên: giá trị" mỗi dòng.
    const text = (doc.body.textContent || html).replace(/\r/g, '')
    const lines = text
      .split('\n')
      .map((raw) => raw.trim())
      .filter(Boolean)
    const rows = lines
      .map((line) => line.match(/^(.+?)\s*[:：]\s*(.+)$/))
      .filter(Boolean)
      .map(([, name, value]) => ({ _key: generateId(), name: name.trim(), value: value.trim() }))
      .filter(rowHasContent)
    return makeHtmlImportResult({
      items: rows,
      skippedCount: lines.length - rows.length + (rows.length ? 0 : 1),
      hasInput: true,
    })
  } catch {
    return makeHtmlImportResult({ skippedCount: 1, hasInput: true, items: [], extraColumnCount: 0 })
  }
}

/** HTML → items[] (best-effort; giữ API cũ cho caller hiện có). */
export function parseSpecsFromHtml(html) {
  return parseSpecsResult(html).items
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
    const model = (items || []).map(normalizeRow).filter(rowHasContent)
    if (!table) {
      const pairs = headingSpecPairs(doc)
      if (pairs.length && pairs.length === model.length) {
        if (model.length === 0) {
          pairs.forEach(({ heading, value }) => {
            heading.remove()
            value.remove()
          })
        } else {
          model.forEach((row, index) => {
            pairs[index].heading.textContent = row.name
            pairs[index].value.innerHTML = inlineHtml(row.value)
          })
        }
        return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
      }
      return fresh
    }
    const tbody = table?.querySelector('tbody') || table
    if (!table || !tbody) return fresh

    const rows = model
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
        tr.querySelectorAll('th, td').forEach((c) => {
          c.textContent = ''
        })
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
      cells[1].innerHTML = inlineHtml(s.value)
    })

    return doc.body.innerHTML
  } catch {
    return fresh
  }
}
