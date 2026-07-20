import { generateId } from '@/lib/utils'

/**
 * Chuyển đổi danh sách ưu/nhược điểm sang HTML để soạn nhanh trong admin.
 * `items` vẫn là nguồn dữ liệu duy nhất: HTML chỉ được parse ngược vào mảng ngay khi gõ.
 * Chế độ "Dán mã HTML" dùng CHUNG 1 khối cho cả ưu điểm lẫn nhược điểm, phân biệt bằng
 * 2 vùng `.bb-highlights-pros` / `.bb-highlights-cons`.
 */

function fieldFor(isEn) {
  return isEn ? 'contentEn' : 'content'
}

function hasContent(value) {
  return Boolean(String(value ?? '').trim())
}

function topLevelElements(root, selector) {
  return [...root.querySelectorAll(selector)].filter((element) => !element.parentElement?.closest(selector))
}

/** items[] → một danh sách HTML (rỗng nếu không có mục nào có nội dung). */
export function serializeHighlightsToHtml(items, isEn = false) {
  const field = fieldFor(isEn)
  const contents = (items || [])
    .map((item) => item?.[field] || '')
    .filter(hasContent)

  if (contents.length === 0) return ''
  return `<ul class="bb-highlights-list">${contents.map((content) => `<li>${content}</li>`).join('')}</ul>`
}

/** HTML → mảng phần HTML bên trong từng mục. Chỉ lấy <li> ngoài cùng; fallback sang <p>. */
export function parseHighlightsFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const listItems = topLevelElements(doc, 'li')
    const source = listItems.length ? listItems : topLevelElements(doc, 'p')
    return source.map((item) => item.innerHTML)
  } catch {
    return []
  }
}

/**
 * Gộp HTML đang soạn vào items. Ở tiếng Việt được thay đổi số mục; ở tiếng Anh chỉ cập nhật
 * nội dung theo vị trí để không phá liên kết song ngữ giữa hai mảng cùng chỉ mục.
 */
export function mergeHighlightsHtmlIntoItems(items, html, isEn = false) {
  const current = Array.isArray(items) ? items : []
  const contents = parseHighlightsFromHtml(html)

  if (isEn) {
    return current.map((item, index) => (
      index < contents.length ? { ...item, contentEn: contents[index] } : item
    ))
  }

  return contents.map((content, index) => {
    const existing = current[index] || { _key: generateId(), contentEn: '' }
    return {
      ...existing,
      _key: existing._key || generateId(),
      content,
      contentEn: existing.contentEn || '',
    }
  })
}

/**
 * positiveNotes[] + negativeNotes[] → MỘT khối HTML duy nhất, bọc 2 vùng riêng để phân biệt
 * ưu/nhược khi soạn hoặc dán ngược lại. Rỗng nếu cả 2 bên đều không có nội dung.
 */
export function serializeHighlightsPairToHtml(positiveNotes, negativeNotes, isEn = false, labels = {}) {
  const prosLabel = labels.prosLabel || 'Ưu điểm'
  const consLabel = labels.consLabel || 'Nhược điểm'
  const prosList = serializeHighlightsToHtml(positiveNotes, isEn)
  const consList = serializeHighlightsToHtml(negativeNotes, isEn)
  if (!prosList && !consList) return ''
  return (
    `<div class="bb-highlights-pros"><h4>${prosLabel}</h4>${prosList}</div>` +
    `<div class="bb-highlights-cons"><h4>${consLabel}</h4>${consList}</div>`
  )
}

/** HTML gộp → { positive: string[], negative: string[] }, đọc riêng từng vùng .bb-highlights-pros/.bb-highlights-cons. */
export function parseHighlightsPairFromHtml(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return { positive: [], negative: [] }
  if (typeof DOMParser === 'undefined') return { positive: [], negative: [] }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const extract = (root) => {
      if (!root) return []
      const listItems = topLevelElements(root, 'li')
      const source = listItems.length ? listItems : topLevelElements(root, 'p')
      return source.map((item) => item.innerHTML)
    }
    return {
      positive: extract(doc.querySelector('.bb-highlights-pros')),
      negative: extract(doc.querySelector('.bb-highlights-cons')),
    }
  } catch {
    return { positive: [], negative: [] }
  }
}

/** Gộp HTML (dạng cặp) đang soạn vào cả 2 mảng positiveNotes/negativeNotes cùng lúc. */
export function mergeHighlightsPairHtmlIntoItems(positiveItems, negativeItems, html, isEn = false) {
  const { positive: prosContents, negative: consContents } = parseHighlightsPairFromHtml(html)

  function mergeSide(items, contents) {
    const current = Array.isArray(items) ? items : []
    if (isEn) {
      return current.map((item, index) => (
        index < contents.length ? { ...item, contentEn: contents[index] } : item
      ))
    }
    return contents.map((content, index) => {
      const existing = current[index] || { _key: generateId(), contentEn: '' }
      return {
        ...existing,
        _key: existing._key || generateId(),
        content,
        contentEn: existing.contentEn || '',
      }
    })
  }

  return {
    positiveNotes: mergeSide(positiveItems, prosContents),
    negativeNotes: mergeSide(negativeItems, consContents),
  }
}
