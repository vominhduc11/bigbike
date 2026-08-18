const MISSING = {
  vi: 'chưa có',
  en: 'not available yet',
}

const BLOCK_LABELS = {
  vi: {
    category: 'HỒ SƠ DANH MỤC',
    product: 'HỒ SƠ SẢN PHẨM',
    draft: 'Nội dung đang sửa trên màn hình (chưa lưu)',
    saved: 'Nội dung đang hiển thị đã lưu',
    specs: 'Thông số kỹ thuật hiện có',
  },
  en: {
    category: 'CATEGORY PROFILE',
    product: 'PRODUCT PROFILE',
    draft: 'Content currently edited on screen (not saved)',
    saved: 'Currently saved and displayed content',
    specs: 'Existing technical specifications',
  },
}

function languageOf(lang) {
  return lang === 'en' ? 'en' : 'vi'
}

export function missingValue(lang = 'vi') {
  return MISSING[languageOf(lang)]
}

function valueOrMissing(value, lang = 'vi') {
  const normalized = String(value ?? '').trim()
  return normalized || missingValue(lang)
}

function listOrMissing(values, lang = 'vi') {
  const list = Array.isArray(values) ? values.filter(Boolean) : []
  return list.length ? list : [missingValue(lang)]
}

function formatNumber(value, lang) {
  const number = Number(value)
  if (!Number.isFinite(number)) return missingValue(lang)
  return new Intl.NumberFormat(languageOf(lang) === 'en' ? 'en-US' : 'vi-VN').format(number)
}

function formatMoney(value, lang, currency = 'VND') {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return missingValue(lang)
  return new Intl.NumberFormat(languageOf(lang) === 'en' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(number)
}

function storefrontOrigin() {
  const raw = import.meta.env.VITE_STOREFRONT_BASE_URL || 'https://bigbike.vn'
  try {
    return new URL(raw).origin
  } catch {
    return 'https://bigbike.vn'
  }
}

export function categoryUrl({ slug, slugEn }, lang = 'vi') {
  const selectedSlug = languageOf(lang) === 'en' ? (slugEn || slug) : slug
  if (!String(selectedSlug || '').trim()) return missingValue(lang)
  const prefix = languageOf(lang) === 'en' ? '/en/categories/' : '/danh-muc/'
  return `${storefrontOrigin()}${prefix}${String(selectedSlug).trim()}/`
}

function languageValue(form, field, lang) {
  if (languageOf(lang) === 'en') return form?.translations?.en?.[field] || ''
  return form?.[field] || ''
}

function categorySnapshot(form, item, lang) {
  const source = item || {}
  const slug = form?.slug || source.slug || ''
  const slugEn = form?.translations?.en?.slug || source.slugEn || ''
  const name = languageValue(form, 'name', lang) || (languageOf(lang) === 'en' ? source.translations?.en?.name : source.name) || ''
  return {
    name: valueOrMissing(name, lang),
    slug,
    slugEn,
    url: categoryUrl({ slug, slugEn }, lang),
    id: form?.id || source.id || '',
  }
}

function profileLines(profile) {
  return profile.lines.filter((line) => line != null && String(line).trim())
}

function serializeContent(value, lang) {
  if (Array.isArray(value)) {
    return value.length ? JSON.stringify(value, null, 2) : missingValue(lang)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length ? JSON.stringify(value, null, 2) : missingValue(lang)
  }
  return valueOrMissing(value, lang)
}

function normalizeFacetBrands(facets, lang) {
  const brands = Array.isArray(facets?.brands) ? facets.brands : []
  const productWord = languageOf(lang) === 'en' ? 'products' : 'sản phẩm'
  return brands.map((brand) => {
    const label = brand?.label || brand?.name || brand?.key
    return `${valueOrMissing(label, lang)} — ${formatNumber(brand?.count, lang)} ${productWord}`
  })
}

function categoryChildren(tree, categoryId, lang) {
  const items = Array.isArray(tree?.items) ? tree.items : []
  return items
    .filter((item) => String(item?.parentId || '') === String(categoryId || ''))
    .map((item) => `${valueOrMissing(languageOf(lang) === 'en' ? item.translations?.en?.name || item.name : item.name, lang)} — ${categoryUrl({ slug: item.slug, slugEn: item.slugEn }, lang)}`)
}

function categoryBaseLines({ snapshot, lang, facets, tree, savedHtml, draftHtml }) {
  const labels = BLOCK_LABELS[languageOf(lang)]
  const priceRange = facets?.priceRange
  const minPrice = priceRange?.minPrice
  const maxPrice = priceRange?.maxPrice
  const lines = [
    `${labels.category}:`,
    `- ${languageOf(lang) === 'en' ? 'Name' : 'Tên'}: ${snapshot.name}`,
    `- ${languageOf(lang) === 'en' ? 'Language' : 'Ngôn ngữ'}: ${languageOf(lang)}`,
    `- ${languageOf(lang) === 'en' ? 'Category URL' : 'Đường dẫn danh mục'}: ${snapshot.url}`,
    `- ${languageOf(lang) === 'en' ? 'Products currently for sale (unique, including descendants)' : 'Sản phẩm đang bán (duy nhất, gồm cả danh mục con)'}: ${formatNumber(facets?.resultCount, lang)}`,
    `- ${languageOf(lang) === 'en' ? 'Brands and product counts' : 'Thương hiệu và số sản phẩm'}: ${listOrMissing(normalizeFacetBrands(facets, lang), lang).join('; ')}`,
    `- ${languageOf(lang) === 'en' ? 'Child categories and URLs' : 'Danh mục con và đường dẫn'}: ${listOrMissing(categoryChildren(tree, snapshot.id, lang), lang).join('; ')}`,
    `- ${languageOf(lang) === 'en' ? 'Actual effective price range' : 'Khoảng giá hiệu lực thực tế'}: ${minPrice == null || maxPrice == null ? missingValue(lang) : `${formatMoney(minPrice, lang)} – ${formatMoney(maxPrice, lang)}`}`,
    `- ${labels.saved}: ${serializeContent(savedHtml, lang)}`,
    `- ${labels.draft}: ${serializeContent(draftHtml, lang)}`,
  ]
  return lines
}

export async function buildCategoryProfile({
  categoryId,
  lang = 'vi',
  form,
  currentItem,
  fetchCategoryDetail,
  fetchCategoryTree,
  fetchCatalogFacets,
} = {}) {
  const L = languageOf(lang)
  const snapshot = categorySnapshot(form, currentItem, L)
  if (!categoryId) {
    return {
      type: 'category',
      lang: L,
      data: { resultCount: null, brands: [], priceRange: null, children: [] },
      lines: categoryBaseLines({ snapshot, lang: L, facets: {}, tree: {}, savedHtml: '', draftHtml: languageValue(form, 'introContent', L) }),
    }
  }

  const [detailResult, treeResult, facetResult] = await Promise.allSettled([
    fetchCategoryDetail(categoryId),
    fetchCategoryTree(L),
    fetchCatalogFacets({ category: L === 'en' ? (snapshot.slugEn || snapshot.slug) : snapshot.slug, lang: L }),
  ])
  const freshItem = detailResult.status === 'fulfilled' ? detailResult.value?.item || detailResult.value : null
  const freshTree = treeResult.status === 'fulfilled' ? treeResult.value || {} : {}
  const facets = facetResult.status === 'fulfilled' ? facetResult.value || {} : {}
  const freshSnapshot = categorySnapshot({}, freshItem || currentItem, L)
  const draftHtml = languageValue(form, 'introContent', L)
  const savedHtml = L === 'en' ? freshItem?.translations?.en?.introContent || '' : freshItem?.introContent || ''
  const mergedSnapshot = {
    ...freshSnapshot,
    id: snapshot.id || freshSnapshot.id,
    name: snapshot.name === missingValue(L) ? freshSnapshot.name : snapshot.name,
    slug: snapshot.slug || freshSnapshot.slug,
    slugEn: snapshot.slugEn || freshSnapshot.slugEn,
  }
  return {
    type: 'category',
    lang: L,
    data: { resultCount: facets.resultCount ?? null, brands: facets.brands || [], priceRange: facets.priceRange || null, children: categoryChildren(freshTree, categoryId, L) },
    lines: categoryBaseLines({ snapshot: mergedSnapshot, lang: L, facets, tree: freshTree, savedHtml, draftHtml }),
  }
}

function activeProductName(data, form, lang) {
  return languageValue(form, 'name', lang)
    || (languageOf(lang) === 'en' ? data?.translations?.en?.name : data?.name)
    || ''
}

function activeProductContent(data, form, field, lang) {
  if (languageOf(lang) === 'en') return form?.translations?.en?.[field] || data?.translations?.en?.[field] || ''
  return form?.[field] || data?.[field] || ''
}

function blockContent(form, data, blockType, lang) {
  const L = languageOf(lang)
  if (blockType === 'suitability' || blockType === 'sizeGuide') {
    const field = blockType === 'suitability' ? 'suitabilitySection' : 'sizeGuideSection'
    const draft = form?.[field] || {}
    const fresh = data?.[field] || {}
    const activeField = L === 'en' ? 'htmlEn' : 'html'
    return { ...fresh, ...draft, [activeField]: draft[activeField] || fresh[activeField] || '' }
  }
  if (blockType === 'highlights') {
    const field = L === 'en' ? 'contentEn' : 'content'
    return {
      positive: (form?.positiveNotes || data?.positiveNotes || []).map((item) => item?.[field] || item?.content || ''),
      negative: (form?.negativeNotes || data?.negativeNotes || []).map((item) => item?.[field] || item?.content || ''),
    }
  }
  if (blockType === 'faqs') {
    const question = L === 'en' ? 'questionEn' : 'question'
    const answer = L === 'en' ? 'answerEn' : 'answer'
    return (form?.faqs || data?.faqs || []).map((item) => ({ question: item?.[question] || '', answer: item?.[answer] || '' }))
  }
  const field = blockType === 'specifications' ? 'specifications' : blockType === 'specStats' ? 'specStats' : 'trustBadges'
  return activeProductContent(data, form, field, L)
}

function availableVariants(data, form, lang) {
  const variants = (form?.variants?.length ? form.variants : data?.variants) || []
  return variants
    .filter((variant) => variant?.isAvailable !== false)
    .map((variant) => {
      const options = (variant.options || []).map((option) => `${option.name || missingValue(lang)}: ${option.value || missingValue(lang)}`).join(', ')
      return `${variant.sku || variant.name || missingValue(lang)}${options ? ` (${options})` : ''}`
    })
}

function productCategories(data, form, lang) {
  const categories = data?.categories?.length ? data.categories : (form?.categoryOptions || [])
  return categories.map((category) => `${valueOrMissing(languageOf(lang) === 'en' ? category.translations?.en?.name || category.name : category.name, lang)} — ${categoryUrl({ slug: category.slug, slugEn: category.slugEn }, lang)}`)
}

export async function buildProductProfile({
  productId,
  lang = 'vi',
  blockType,
  form,
  categoryOptions,
  brandName,
  fetchProductDetail,
} = {}) {
  const L = languageOf(lang)
  const result = productId ? await fetchProductDetail(productId).catch(() => null) : null
  const fresh = result?.item || result || {}
  const merged = { ...fresh, ...form, translations: { ...fresh.translations, ...form?.translations } }
  const price = fresh.price?.retailPrice || fresh.retailPrice || form?.retailPrice
  const salePrice = fresh.price?.salePrice || fresh.salePrice || form?.salePrice
  const block = blockContent(form, merged, blockType, L)
  const freshName = activeProductName(fresh, {}, L) || activeProductName(merged, form, L)
  const freshVariants = fresh?.variants?.length ? fresh : form
  const lines = [
    `${BLOCK_LABELS[L].product}:`,
    `- ${L === 'en' ? 'Name' : 'Tên sản phẩm'}: ${valueOrMissing(freshName, L)}`,
    `- ${L === 'en' ? 'SKU' : 'Mã sản phẩm'}: ${valueOrMissing(fresh.sku || form?.sku, L)}`,
    `- ${L === 'en' ? 'Brand' : 'Thương hiệu'}: ${valueOrMissing(fresh.brand?.name || fresh.brandName || brandName, L)}`,
    `- ${L === 'en' ? 'Language' : 'Ngôn ngữ'}: ${L}`,
    `- ${L === 'en' ? 'Categories' : 'Danh mục'}: ${listOrMissing(productCategories(fresh, { ...form, categoryOptions }, L), L).join('; ')}`,
    `- ${L === 'en' ? 'Retail price' : 'Giá bán hiện tại'}: ${formatMoney(price, L)}`,
    `- ${L === 'en' ? 'Sale price' : 'Giá khuyến mãi'}: ${formatMoney(salePrice, L)}`,
    `- ${L === 'en' ? 'Available variants, sizes and colours' : 'Biến thể, cỡ và màu đang bán'}: ${listOrMissing(availableVariants(freshVariants, {}, L), L).join('; ')}`,
    `- ${L === 'en' ? 'Content in the block being edited' : 'Nội dung hiện có của khối đang bấm'}: ${serializeContent(block, L)}`,
  ]
  if (['highlights', 'faqs', 'specStats', 'trustBadges'].includes(blockType)) {
    lines.push(`- ${BLOCK_LABELS[L].specs}: ${serializeContent(activeProductContent(fresh, form, 'specifications', L), L)}`)
  }
  return {
    type: 'product',
    lang: L,
    blockType,
    data: { ...merged, block },
    lines,
  }
}

function sharedRules(lang) {
  if (languageOf(lang) === 'en') {
    return `
GLOBAL RULES:
- Use only names, numbers, prices, sizes, specifications, and brands present in the profile. Never remember, infer, or invent anything outside it. If saved content conflicts with the profile, correct it to the profile.
- Do not introduce fonts, font sizes, line heights, uppercase transformations, literal colours, dark backgrounds, shadows, rounded corners, gradients, or emoji. The website owns presentation filtering.
- Use only HTML elements accepted by the existing block template. Return HTML only: no explanation, comments, markdown, or code fences.
- Follow the template already stated above. At the end, leave this owner request placeholder for the shop owner: [OWNER'S EXTRA REQUEST]
`
  }
  return `
QUY TẮC CHUNG:
- Chỉ dùng tên, số liệu, giá, cỡ, thông số và thương hiệu có trong hồ sơ. Cấm nhớ, tự suy ra hoặc bịa thêm dữ liệu ngoài hồ sơ. Nếu nội dung cũ mâu thuẫn hồ sơ thì sửa theo hồ sơ.
- Không tự thêm phông chữ, cỡ chữ, giãn dòng, viết hoa, mã màu, nền tối, đổ bóng, bo góc, chuyển màu hoặc biểu tượng cảm xúc. Website tự quyết định cách trình bày.
- Chỉ dùng thẻ HTML mà khuôn của khối đã nêu chấp nhận. Trả về chỉ HTML, không lời giải thích, chú thích, markdown hoặc hàng rào mã.
- Giữ đúng khuôn đã nêu ở trên. Cuối nội dung chừa chỗ cho owner ghi yêu cầu riêng: [YÊU CẦU RIÊNG CỦA OWNER]
`
}

export function attachProfileToPrompt(basePrompt, profile, lang = 'vi', { category = false } = {}) {
  const L = languageOf(lang)
  const specialCategory = category
    ? L === 'en'
      ? `
CATEGORY INTRO BOUNDARY:
MANDATORY MANAGED PARTS (keep these six separate so the admin form and Google FAQ reader can recognize them): (1) small eyebrow label, (2) heading, (3) intro paragraph, (4) brand chips, (5) every question-answer pair, (6) invitation line and contact button.
FREE PARTS: comparison tables, size charts, lists, subheadings, extra paragraphs, images, and multi-column layouts. They may appear any number of times and between managed parts, but must be standalone sibling blocks, never nested inside the intro paragraph or an FAQ answer. Keep the order intro → FAQ → contact button.
The short example in this brief shows a standalone comparison table between the intro and FAQ. It is only a structural example; profile data is authoritative for all facts.
`
      : `
RANH GIỚI NỘI DUNG ĐẦU TRANG DANH MỤC:
SÁU PHẦN BẮT BUỘC ĐỂ BIỂU MẪU QUẢN LÝ: (1) nhãn nhỏ, (2) tiêu đề, (3) đoạn giới thiệu, (4) thẻ thương hiệu, (5) từng cặp câu hỏi–câu trả lời, (6) dòng chữ mời và nút liên hệ.
PHẦN TỰ DO: bảng so sánh, bảng cỡ, danh sách, tiêu đề phụ, đoạn văn thêm, ảnh và bố cục nhiều cột. Có thể chèn không giới hạn giữa các phần, nhưng phải là khối đứng riêng, không lồng trong đoạn giới thiệu hoặc câu trả lời FAQ. Giữ thứ tự giới thiệu → hỏi–đáp → nút liên hệ.
Ví dụ ngắn trong bản hướng dẫn có một bảng so sánh đứng riêng giữa phần giới thiệu và FAQ. Đây chỉ là ví dụ về bố cục; mọi số liệu phải lấy từ hồ sơ.
`
    : ''
  const title = profile?.type === 'category' ? BLOCK_LABELS[L].category : BLOCK_LABELS[L].product
  return `${String(basePrompt || '').trim()}\n${sharedRules(L)}${specialCategory}\n--- ${title} ---\n${profileLines(profile || { lines: [] }).join('\n')}\n--- END PROFILE ---`
}

export function createCategoryAiPromptBuilder({ categoryId, lang, form, currentItem, fetchCategoryDetail, fetchCategoryTree, fetchCatalogFacets, basePrompt }) {
  return async () => attachProfileToPrompt(
    typeof basePrompt === 'function' ? basePrompt() : basePrompt,
    await buildCategoryProfile({ categoryId, lang, form, currentItem, fetchCategoryDetail, fetchCategoryTree, fetchCatalogFacets }),
    lang,
    { category: true },
  )
}

export function createProductAiPromptBuilder({ productId, lang, form, categoryOptions, brandName, fetchProductDetail }) {
  return async (blockType, basePrompt) => attachProfileToPrompt(
    basePrompt,
    await buildProductProfile({ productId, lang, blockType, form, categoryOptions, brandName, fetchProductDetail }),
    lang,
  )
}
