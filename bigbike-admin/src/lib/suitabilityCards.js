/**
 * Chuyển đổi giữa danh sách thẻ "Phù hợp với ai" (model nhập có cấu trúc) và HTML —
 * để tab "Dán mã HTML" của khối luôn hiển thị sẵn mã tương ứng với các thẻ (giống Bảng size),
 * và để chuyển qua lại 2 chế độ không mất nội dung.
 *
 * Mỗi thẻ: { audience, advice }. HTML xuất ra phản chiếu đúng cách web render thẻ:
 * <strong>đối tượng</strong> → lời khuyên.
 *
 * LƯU Ý nguồn sự thật: chế độ có cấu trúc vẫn ghi `cards`, `html` để trống → web render thẻ.
 * HTML sinh ra ở đây chỉ để HIỂN THỊ trong admin; chỉ khi admin tự sửa khác đi thì `html` mới
 * được lưu và "thắng" cards (theo DATA_CONTRACT §khối suitability).
 */

export function emptySuitabilityCard() {
  return { audience: '', advice: '' }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function normalizeCard(c) {
  return {
    audience: (c?.audience || '').trim(),
    advice: (c?.advice || '').trim(),
  }
}

/** Thẻ có nội dung không (dùng để lọc thẻ rỗng khi serialize/parse, và khi admin xoá thẻ/dọn payload). */
export function suitabilityCardHasContent(c) {
  return Boolean(((c?.audience || '') + (c?.advice || '')).trim())
}

/** cards[] → HTML (rỗng nếu không thẻ nào có nội dung). */
export function serializeSuitabilityCards(cards) {
  const items = (cards || []).map(normalizeCard).filter((c) => suitabilityCardHasContent(c))
  if (items.length === 0) return ''
  const lis = items.map((c) => `<li>${cardInnerHtml(c)}</li>`)
  return `<ul class="suitability-list">${lis.join('')}</ul>`
}

/** Dựng nội dung BÊN TRONG một thẻ từ card (giữ phần tử thẻ ngoài + style/class của nó). */
function cardInnerHtml(c) {
  let inner = ''
  if (c.audience) inner += `<strong>${escapeHtml(c.audience)}</strong>`
  if (c.audience && c.advice) inner += ' → '
  if (c.advice) inner += escapeHtml(c.advice)
  return inner
}

/**
 * Ghép danh sách thẻ vào HTML hiện có mà GIỮ NGUYÊN khung thẻ + style/class của nó, chỉ dựng lại
 * phần chữ bên trong (đối tượng → lời khuyên → link). Dùng khi admin sửa ở tab "Có cấu trúc" nhưng
 * HTML đã tùy chỉnh CSS. Thẻ thêm mới nhân bản thẻ cuối (kế thừa CSS); thẻ bớt thì gỡ node.
 * HTML trống / không có <li>|<p> để map → sinh mặc định serializeSuitabilityCards.
 */
export function mergeSuitabilityIntoHtml(cards, existingHtml) {
  const model = (cards || []).map(normalizeCard).filter((c) => suitabilityCardHasContent(c))
  const fresh = serializeSuitabilityCards(model)
  if (!existingHtml || typeof existingHtml !== 'string' || !existingHtml.trim()) return fresh
  if (typeof DOMParser === 'undefined') return fresh
  try {
    const doc = new DOMParser().parseFromString(existingHtml, 'text/html')
    let items = [...doc.querySelectorAll('li')]
    if (!items.length) items = [...doc.querySelectorAll('p')].filter((p) => (p.textContent || '').trim())
    const container = items[0]?.parentElement
    if (!items.length || !container) return fresh

    if (model.length === 0) {
      // Không còn thẻ: gỡ toàn bộ item; nếu container rỗng thì để body rỗng.
      items.forEach((el) => el.remove())
      return doc.body.innerHTML.trim() ? doc.body.innerHTML : ''
    }

    // Thêm/bớt item cho khớp số thẻ (item thêm nhân bản item cuối → giữ style).
    while (items.length < model.length) {
      const clone = items[items.length - 1].cloneNode(true)
      container.appendChild(clone)
      items = [...container.children].filter((el) => el.matches('li, p'))
    }
    while (items.length > model.length) {
      items[items.length - 1].remove()
      items = items.slice(0, -1)
    }
    model.forEach((c, i) => { if (items[i]) items[i].innerHTML = cardInnerHtml(c) })
    return doc.body.innerHTML
  } catch {
    return fresh
  }
}

/** HTML → cards[] (best-effort; đọc lại đúng định dạng do serializeSuitabilityCards tạo ra).
 *  Mỗi <li>/<p>: <strong> → đối tượng, phần chữ còn lại (bỏ dấu → và link cũ nếu có) → lời khuyên. */
export function parseSuitabilityCards(html) {
  if (!html || typeof html !== 'string' || !html.trim()) return []
  if (typeof DOMParser === 'undefined') return []
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const lis = [...doc.querySelectorAll('li')]
    const source = lis.length ? lis : [...doc.querySelectorAll('p')]
    return source
      .map((el) => {
        const strongEl = el.querySelector('strong, b')
        const clone = el.cloneNode(true)
        // Bỏ hẳn <a> (link gợi ý cũ nếu HTML còn giữ) để không lẫn vào lời khuyên.
        clone.querySelectorAll('strong, b, a').forEach((n) => n.remove())
        const advice = (clone.textContent || '').replace(/→/g, ' ').replace(/\s+/g, ' ').trim()
        return normalizeCard({
          audience: strongEl?.textContent || '',
          advice,
        })
      })
      .filter((c) => suitabilityCardHasContent(c))
  } catch {
    return []
  }
}
