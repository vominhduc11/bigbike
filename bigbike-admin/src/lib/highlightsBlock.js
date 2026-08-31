import { generateId } from '@/lib/utils'
import { hasHtmlInput, makeHtmlImportResult, textOf } from './htmlImport'

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function topLevelElements(root, selector) {
  return [...root.querySelectorAll(selector)].filter(
    (element) => !element.parentElement?.closest(selector),
  )
}

/** items[] → một danh sách HTML (rỗng nếu không có mục nào có nội dung). */
export function serializeHighlightsToHtml(items, isEn = false) {
  const field = fieldFor(isEn)
  const contents = (items || []).map((item) => item?.[field] || '').filter(hasContent)

  if (contents.length === 0) return ''
  return `<ul class="bb-highlights-list">${contents.map((content) => `<li>${content}</li>`).join('')}</ul>`
}

/** HTML → mảng phần HTML bên trong từng mục; nhận cả list/paragraph thông thường. */
export function parseHighlightsResult(html) {
  const pair = parseHighlightsPairResult(html)
  const items = pair.positive?.length ? pair.positive : pair.negative || []
  return makeHtmlImportResult({
    items,
    skippedCount: pair.skippedCount,
    hasInput: pair.hasInput,
  })
}

export function parseHighlightsFromHtml(html) {
  return parseHighlightsResult(html).items
}

/**
 * Gộp HTML đang soạn vào items. Ở tiếng Việt được thay đổi số mục; ở tiếng Anh chỉ cập nhật
 * nội dung theo vị trí để không phá liên kết song ngữ giữa hai mảng cùng chỉ mục.
 */
export function mergeHighlightsHtmlIntoItems(items, html, isEn = false) {
  const current = Array.isArray(items) ? items : []
  const contents = parseHighlightsResult(html).items
  if (!contents.length) return current

  if (isEn) {
    return current.map((item, index) =>
      index < contents.length ? { ...item, contentEn: contents[index] } : item,
    )
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
export function serializeHighlightsPairToHtml(
  positiveNotes,
  negativeNotes,
  isEn = false,
  labels = {},
) {
  const prosLabel = escapeHtml(labels.prosLabel || 'Ưu điểm')
  const consLabel = escapeHtml(labels.consLabel || 'Nhược điểm')
  const prosList = serializeHighlightsToHtml(positiveNotes, isEn)
  const consList = serializeHighlightsToHtml(negativeNotes, isEn)
  if (!prosList && !consList) return ''
  return (
    `<div class="bb-highlights-pros"><h4>${prosLabel}</h4>${prosList}</div>` +
    `<div class="bb-highlights-cons"><h4>${consLabel}</h4>${consList}</div>`
  )
}

function extractContents(root) {
  if (!root) return { items: [], skippedCount: 0 }
  const listItems = topLevelElements(root, 'li')
  const source = listItems.length ? listItems : topLevelElements(root, 'p')
  const items = source.map((item) => item.innerHTML).filter(hasContent)
  return { items, skippedCount: source.length - items.length }
}

function headingSide(text) {
  const value = text.toLocaleLowerCase()
  if (/(^|\s)(ưu điểm|pros?|advantages?)(\s|$)/i.test(value)) return 'positive'
  if (/(^|\s)(nhược điểm|cons?|disadvantages?)(\s|$)/i.test(value)) return 'negative'
  return null
}

function parseGenericPair(doc) {
  const groups = { positive: [], negative: [] }
  const presentGroups = { positive: false, negative: false }
  let skippedCount = 0
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')]
  headings.forEach((heading) => {
    const side = headingSide(textOf(heading))
    if (!side) return
    presentGroups[side] = true
    let sibling = heading.nextElementSibling
    const wrapper = doc.createElement('div')
    while (sibling && !/^H[1-6]$/.test(sibling.tagName)) {
      wrapper.appendChild(sibling.cloneNode(true))
      sibling = sibling.nextElementSibling
    }
    const parsed = extractContents(wrapper)
    groups[side].push(...parsed.items)
    skippedCount += parsed.skippedCount
  })

  if (presentGroups.positive || presentGroups.negative) {
    return { ...groups, presentGroups, skippedCount }
  }

  // Owner-chosen fallback: an unlabelled ordinary list is treated as Pros.
  const fallback = extractContents(doc)
  if (fallback.items.length) {
    groups.positive = fallback.items
    presentGroups.positive = true
  }
  return {
    ...groups,
    presentGroups,
    skippedCount: fallback.skippedCount + (fallback.items.length ? 0 : 1),
  }
}

/** Detailed parser result for the shared non-destructive HTML import flow. */
export function parseHighlightsPairResult(html) {
  if (!hasHtmlInput(html) || typeof DOMParser === 'undefined') {
    return makeHtmlImportResult({
      items: [],
      hasInput: hasHtmlInput(html),
      positive: [],
      negative: [],
      presentGroups: { positive: false, negative: false },
    })
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const regions = [
      ['positive', doc.querySelector('.bb-highlights-pros')],
      ['negative', doc.querySelector('.bb-highlights-cons')],
    ]
    const presentGroups = { positive: Boolean(regions[0][1]), negative: Boolean(regions[1][1]) }
    const groups = { positive: [], negative: [] }
    let skippedCount = 0
    regions.forEach(([side, root]) => {
      if (!root) return
      const parsed = extractContents(root)
      groups[side] = parsed.items
      skippedCount += parsed.skippedCount
    })

    if (!presentGroups.positive && !presentGroups.negative) {
      const generic = parseGenericPair(doc)
      groups.positive = generic.positive
      groups.negative = generic.negative
      generic.presentGroups.positive && (presentGroups.positive = true)
      generic.presentGroups.negative && (presentGroups.negative = true)
      skippedCount += generic.skippedCount
    }

    const items = [...groups.positive, ...groups.negative]
    return makeHtmlImportResult({
      items,
      acceptedCount: items.length,
      skippedCount: skippedCount + (items.length ? 0 : 1),
      hasInput: true,
      positive: groups.positive,
      negative: groups.negative,
      presentGroups,
    })
  } catch {
    return makeHtmlImportResult({
      skippedCount: 1,
      hasInput: true,
      positive: [],
      negative: [],
      presentGroups: { positive: false, negative: false },
    })
  }
}

/** HTML gộp → { positive: string[], negative: string[] }, giữ API cũ cho caller hiện có. */
export function parseHighlightsPairFromHtml(html) {
  const result = parseHighlightsPairResult(html)
  return { positive: result.positive || [], negative: result.negative || [] }
}

/** Gộp HTML (dạng cặp) đang soạn vào cả 2 mảng positiveNotes/negativeNotes cùng lúc. */
export function mergeHighlightsPairHtmlIntoItems(positiveItems, negativeItems, html, isEn = false) {
  const parsed = parseHighlightsPairResult(html)
  const prosContents = parsed.positive || []
  const consContents = parsed.negative || []

  function mergeSide(items, contents, present) {
    const current = Array.isArray(items) ? items : []
    if (!present) return current
    if (isEn) {
      return current.map((item, index) =>
        index < contents.length ? { ...item, contentEn: contents[index] } : item,
      )
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
    positiveNotes: mergeSide(positiveItems, prosContents, parsed.presentGroups?.positive),
    negativeNotes: mergeSide(negativeItems, consContents, parsed.presentGroups?.negative),
  }
}
