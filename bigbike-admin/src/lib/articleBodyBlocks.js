import { generateId } from './utils'

// Work only in memory. Unknown markup remains an editable HTML paragraph so adding
// another block cannot replace the article's original content.
export function articleBodyBlocks(body) {
  if (!body?.trim()) return []
  const document = new DOMParser().parseFromString(body, 'text/html')
  return [...document.body.childNodes].flatMap((node) => {
    const base = { _key: generateId() }
    if (node.nodeType === 3) {
      if (!node.textContent.trim()) return []
      const paragraph = document.createElement('p')
      paragraph.textContent = node.textContent
      return [{ ...base, type: 'paragraph', html: paragraph.outerHTML }]
    }
    if (node.nodeType !== 1) return []
    const tag = node.tagName.toLowerCase()
    const html = node.outerHTML
    if (tag === 'table') return [{ ...base, type: 'table', html }]
    if (['h2', 'h3'].includes(tag) && !node.children.length && !node.id) {
      return [{ ...base, type: 'heading', level: Number(tag[1]), text: node.textContent }]
    }
    if (tag === 'hr') return [{ ...base, type: 'divider' }]
    if (tag === 'img' && node.getAttribute('src')) {
      return [
        {
          ...base,
          type: 'image',
          url: node.getAttribute('src'),
          alt: node.getAttribute('alt') || '',
          caption: '',
        },
      ]
    }
    if (
      tag === 'figure' &&
      node.querySelector('img[src]') &&
      node.querySelectorAll('img').length === 1 &&
      !node.querySelector('a, video, iframe, table') &&
      [...node.children].every((child) => ['IMG', 'FIGCAPTION'].includes(child.tagName)) &&
      [...node.childNodes].every((child) => child.nodeType !== 3 || !child.textContent.trim())
    ) {
      const img = node.querySelector('img')
      return [
        {
          ...base,
          type: 'image',
          url: img.getAttribute('src'),
          alt: img.getAttribute('alt') || '',
          caption: node.querySelector('figcaption')?.textContent || '',
        },
      ]
    }
    if (
      ['ul', 'ol'].includes(tag) &&
      !node.querySelector('a, img, strong, b, em, i, ul, ol') &&
      !node.hasAttribute('start')
    ) {
      return [
        {
          ...base,
          type: 'list',
          style: tag === 'ol' ? 'numbered' : 'bulleted',
          items: [...node.children].map((item) => item.textContent),
        },
      ]
    }
    return [{ ...base, type: 'paragraph', html }]
  })
}
