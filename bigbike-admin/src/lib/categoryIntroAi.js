import {
  emptyFaq,
  emptyIntro,
  isSafeCategoryIntroInlineHtml,
  sanitizeCategoryIntroInlineHtml,
} from './categoryIntro'

export const CATEGORY_INTRO_LIMITS = Object.freeze({
  eyebrow: 120,
  heading: 255,
  intro: 2000,
  brand: 60,
  question: 300,
  answer: 1500,
})

export const DEFAULT_AI_FAQ_COUNT = 5

const LABEL_GROUPS = [
  { field: 'heading', aliases: ['tiêu đề', 'tieu de', 'title', 'heading'] },
  { field: 'eyebrow', aliases: ['nhãn nhỏ', 'nhan nho', 'small label', 'small-label', 'eyebrow', 'kicker'] },
  { field: 'intro', aliases: ['giới thiệu', 'gioi thieu', 'intro', 'introduction', 'description'] },
  { field: 'brands', aliases: ['thương hiệu', 'thuong hieu', 'brand', 'brands'] },
  { field: 'question', aliases: ['hỏi', 'hoi', 'question'] },
  { field: 'answer', aliases: ['đáp', 'dap', 'answer'] },
  { field: 'question', aliases: ['q'], colonOnly: true },
  { field: 'answer', aliases: ['a'], colonOnly: true },
]

const JSON_ALIASES = {
  heading: ['title', 'heading', 'tieu de', 'tiêu đề'],
  eyebrow: ['eyebrow', 'smallLabel', 'small label', 'nhan nho', 'nhãn nhỏ'],
  intro: ['intro', 'introduction', 'description', 'gioi thieu', 'giới thiệu'],
  brands: ['brands', 'brand', 'thuong hieu', 'thương hiệu'],
  faqs: ['faqs', 'faq', 'questions', 'cau hoi', 'câu hỏi'],
}

const FOOTER_LINES = /^(?:hope this helps|let me know|chúc bạn|chuc ban|nếu cần|neu can|happy to help|feel free to ask|mình hy vọng|i hope)/i

function normalizeLabel(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/[^a-z0-9]+/g, '')
}

function escapeRegex(value) {
  return String(value)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
}

function stripBullet(value) {
  return String(value || '').replace(/^\s*(?:(?:[-*•‣▪]|\d+[.)])\s*)/, '').trim()
}

function labelPattern(alias, colonOnly = false) {
  const source = escapeRegex(alias).replace(/\\ /g, '\\s+')
  const separator = colonOnly
    ? '\\s*[:：]\\s*'
    : '(?:\\s*[:：]\\s*|\\s+|\\s*[-–—]\\s*)'
  return new RegExp(`^${source}(?:${separator}|$)([\\s\\S]*)$`, 'i')
}

function matchKnownLabel(line) {
  const cleaned = stripBullet(line)
  if (!cleaned) return null

  for (const group of LABEL_GROUPS) {
    for (const alias of group.aliases) {
      const match = labelPattern(alias, group.colonOnly).exec(cleaned)
      if (match) {
        return { field: group.field, value: (match[1] || '').trim() }
      }
    }
  }
  return null
}

function unknownSectionLabel(line) {
  const cleaned = stripBullet(line)
  const match = /^([^:：]{2,48})\s*[:：]\s*$/.exec(cleaned)
  if (!match) return ''
  const label = match[1].trim()
  const normalized = normalizeLabel(label)
  const isUppercaseLabel = label === label.toUpperCase() && /[A-ZÀ-Ỵ]{2}/.test(label)
  if (isUppercaseLabel || /(?:bang|table|comparison|sosanh)/i.test(normalized)) return label
  return ''
}

function trimFooter(value) {
  const lines = String(value || '').split(/\r\n?|\n/)
  const footerIndex = lines.findIndex((line) => FOOTER_LINES.test(line.trim()))
  return (footerIndex >= 0 ? lines.slice(0, footerIndex) : lines).join('\n').trim()
}

function toPlainText(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (typeof DOMParser === 'undefined' || !/<[a-z][\s\S]*>/i.test(raw)) return raw
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
  return (doc.body.firstElementChild?.textContent || '').replace(/\s+/g, ' ').trim()
}

function visibleLength(value) {
  return toPlainText(value).length
}

function normalizeInlineValue(value, ignored) {
  const raw = trimFooter(value)
  if (!raw) return ''
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw
  if (!isSafeCategoryIntroInlineHtml(raw)) {
    ignored.push('unsupportedHtml')
  }
  return sanitizeCategoryIntroInlineHtml(raw)
}

function addLengthError(errors, field, value) {
  const limit = CATEGORY_INTRO_LIMITS[field]
  if (limit && visibleLength(value) > limit) {
    errors.push(`${field}:${limit}`)
  }
}

function splitBrands(value) {
  return String(value || '')
    .split(/[,;|\n]+/)
    .flatMap((part) => part.split(/\s+(?:and|và)\s+/i))
    .map((brand) => toPlainText(brand).trim())
    .filter(Boolean)
}

function createResult(source) {
  return {
    source,
    model: emptyIntro(),
    present: { heading: false, eyebrow: false, intro: false, brands: false, faqs: false },
    ignored: [],
    errors: [],
  }
}

function collectLabeledSections(raw) {
  const sections = []
  const ignored = []
  let current = null
  let ignoringUnknown = false

  const flush = () => {
    if (!current) return
    const value = trimFooter(current.lines.join('\n'))
    if (value) sections.push({ field: current.field, value })
    current = null
  }

  String(raw || '').split(/\r\n?|\n/).forEach((line) => {
    const known = matchKnownLabel(line)
    if (known) {
      flush()
      current = { field: known.field, lines: known.value ? [known.value] : [] }
      ignoringUnknown = false
      return
    }

    const unknown = unknownSectionLabel(line)
    if (unknown) {
      flush()
      ignoringUnknown = true
      ignored.push(`unknown:${unknown}`)
      return
    }

    if (ignoringUnknown) return
    if (current) {
      current.lines.push(line)
    } else if (line.trim()) {
      if (!ignored.includes('preamble')) ignored.push('preamble')
    }
  })
  flush()
  return { sections, ignored }
}

function applyLabeledResult(raw) {
  const result = createResult('labels')
  const { sections, ignored } = collectLabeledSections(raw)
  result.ignored.push(...ignored)

  const first = (field) => sections.find((section) => section.field === field)?.value || ''
  const heading = toPlainText(first('heading'))
  const eyebrow = toPlainText(first('eyebrow'))
  const intro = normalizeInlineValue(first('intro'), result.ignored)
  const brandValues = sections.filter((section) => section.field === 'brands').flatMap((section) => splitBrands(section.value))
  const questions = sections.filter((section) => section.field === 'question').map((section) => toPlainText(section.value))
  const answers = sections.filter((section) => section.field === 'answer')
    .map((section) => normalizeInlineValue(section.value, result.ignored))

  if (heading) {
    result.model.heading = heading
    result.present.heading = true
    addLengthError(result.errors, 'heading', heading)
  }
  if (eyebrow) {
    result.model.eyebrow = eyebrow
    result.present.eyebrow = true
    addLengthError(result.errors, 'eyebrow', eyebrow)
  }
  if (intro) {
    result.model.intro = intro
    result.present.intro = true
    addLengthError(result.errors, 'intro', intro)
  }
  if (brandValues.length) {
    result.model.brands = brandValues.filter((brand) => {
      const valid = visibleLength(brand) <= CATEGORY_INTRO_LIMITS.brand
      if (!valid) result.errors.push(`brand:${CATEGORY_INTRO_LIMITS.brand}`)
      return valid
    })
    result.present.brands = result.model.brands.length > 0
  }

  const faqCount = Math.min(questions.length, answers.length)
  if (questions.length !== answers.length) result.ignored.push('incompleteFaq')
  result.model.faqs = Array.from({ length: faqCount }, (_, index) => {
    const question = questions[index]
    const answer = answers[index]
    addLengthError(result.errors, 'question', question)
    addLengthError(result.errors, 'answer', answer)
    return { ...emptyFaq(), question, answer }
  }).filter((faq) => faq.question && faq.answer)
  result.present.faqs = result.model.faqs.length > 0

  return result
}

function getJsonValue(object, field) {
  const aliases = JSON_ALIASES[field].map(normalizeLabel)
  const entry = Object.entries(object).find(([key]) => aliases.includes(normalizeLabel(key)))
  return entry ? entry[1] : undefined
}

function parseJsonCandidate(raw) {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').replace(/```/g, '')
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const value = JSON.parse(text.slice(start, end + 1))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function applyJsonResult(object) {
  const result = createResult('json')
  const recognizedKeys = new Set(Object.values(JSON_ALIASES).flat().map(normalizeLabel))
  Object.keys(object).forEach((key) => {
    if (!recognizedKeys.has(normalizeLabel(key))) result.ignored.push(`json:${key}`)
  })

  const heading = toPlainText(getJsonValue(object, 'heading'))
  const eyebrow = toPlainText(getJsonValue(object, 'eyebrow'))
  const intro = normalizeInlineValue(getJsonValue(object, 'intro'), result.ignored)
  const brandsValue = getJsonValue(object, 'brands')
  const brands = Array.isArray(brandsValue) ? brandsValue.flatMap(splitBrands) : splitBrands(brandsValue)
  const faqsValue = getJsonValue(object, 'faqs')
  const faqs = Array.isArray(faqsValue) ? faqsValue.map((faq) => {
    if (!faq || typeof faq !== 'object') return null
    const question = toPlainText(faq.question ?? faq.q ?? faq.hỏi ?? faq.hoi)
    const answer = normalizeInlineValue(faq.answer ?? faq.a ?? faq.đáp ?? faq.dap, result.ignored)
    return { ...emptyFaq(), question, answer }
  }).filter(Boolean) : []

  if (heading) {
    result.model.heading = heading
    result.present.heading = true
    addLengthError(result.errors, 'heading', heading)
  }
  if (eyebrow) {
    result.model.eyebrow = eyebrow
    result.present.eyebrow = true
    addLengthError(result.errors, 'eyebrow', eyebrow)
  }
  if (intro) {
    result.model.intro = intro
    result.present.intro = true
    addLengthError(result.errors, 'intro', intro)
  }
  if (brands.length) {
    result.model.brands = brands.filter((brand) => {
      const valid = visibleLength(brand) <= CATEGORY_INTRO_LIMITS.brand
      if (!valid) result.errors.push(`brand:${CATEGORY_INTRO_LIMITS.brand}`)
      return valid
    })
    result.present.brands = result.model.brands.length > 0
  }
  result.model.faqs = faqs.filter((faq) => {
    const valid = faq.question && faq.answer
    if (!valid) result.ignored.push('incompleteFaq')
    addLengthError(result.errors, 'question', faq.question)
    addLengthError(result.errors, 'answer', faq.answer)
    return valid
  })
  result.present.faqs = result.model.faqs.length > 0
  return result
}

export function parseCategoryIntroAiInput(raw) {
  const json = parseJsonCandidate(raw)
  const result = json ? applyJsonResult(json) : applyLabeledResult(raw)
  result.hasContent = Object.values(result.present).some(Boolean)
  return result
}

export function mergeCategoryIntroAiModel(current, parsed) {
  const next = { ...emptyIntro(), ...(current || {}) }
  if (parsed.present.heading) next.heading = parsed.model.heading
  if (parsed.present.eyebrow) next.eyebrow = parsed.model.eyebrow
  if (parsed.present.intro) next.intro = parsed.model.intro
  if (parsed.present.brands) next.brands = parsed.model.brands
  if (parsed.present.faqs) next.faqs = parsed.model.faqs
  return { ...next, _legacy: false }
}

function promptCopy(lang) {
  return lang === 'en'
    ? {
      language: 'English',
      labels: ['TITLE', 'SMALL LABEL', 'INTRO', 'BRANDS', 'QUESTION', 'ANSWER'],
      sample: 'TITLE: …\nSMALL LABEL: …\nINTRO: …\nBRANDS: AGV, LS2, Caberg\nQUESTION: …\nANSWER: …',
      limits: `SMALL LABEL max ${CATEGORY_INTRO_LIMITS.eyebrow} characters; TITLE max ${CATEGORY_INTRO_LIMITS.heading}; INTRO max ${CATEGORY_INTRO_LIMITS.intro}; each brand max ${CATEGORY_INTRO_LIMITS.brand}; QUESTION max ${CATEGORY_INTRO_LIMITS.question}; ANSWER max ${CATEGORY_INTRO_LIMITS.answer}.`,
    }
    : {
      language: 'Vietnamese',
      labels: ['TIÊU ĐỀ', 'NHÃN NHỎ', 'GIỚI THIỆU', 'THƯƠNG HIỆU', 'HỎI', 'ĐÁP'],
      sample: 'TIÊU ĐỀ: …\nNHÃN NHỎ: …\nGIỚI THIỆU: …\nTHƯƠNG HIỆU: AGV, LS2, Caberg\nHỎI: …\nĐÁP: …',
      limits: `NHÃN NHỎ tối đa ${CATEGORY_INTRO_LIMITS.eyebrow} ký tự; TIÊU ĐỀ tối đa ${CATEGORY_INTRO_LIMITS.heading}; GIỚI THIỆU tối đa ${CATEGORY_INTRO_LIMITS.intro}; mỗi thương hiệu tối đa ${CATEGORY_INTRO_LIMITS.brand}; HỎI tối đa ${CATEGORY_INTRO_LIMITS.question}; ĐÁP tối đa ${CATEGORY_INTRO_LIMITS.answer} ký tự.`,
    }
}

export function buildCategoryIntroAiPrompt({ categoryName, lang = 'vi', faqCount = DEFAULT_AI_FAQ_COUNT } = {}) {
  const copy = promptCopy(lang)
  const safeName = String(categoryName || '').replace(/\s+/g, ' ').trim() || (lang === 'en' ? 'this category' : 'danh mục này')
  return lang === 'en'
    ? [
      `Write structured introduction content for the BigBike category "${safeName}" in English.`,
      'Return only the labeled format below. Do not return HTML, Markdown, code fences, explanations, tables, or extra labels.',
      `Use exactly ${faqCount} QUESTION/ANSWER pairs. Keep the content useful, factual, concise, and suitable for customers.`,
      copy.limits,
      '',
      copy.sample,
      ...Array.from({ length: Math.max(0, faqCount - 1) }, () => 'QUESTION: …\nANSWER: …'),
      '',
      'Do not invent brands or product facts that are not known. Keep the labels in English and do not add an introduction or closing message.',
    ].join('\n')
    : [
      `Viết nội dung giới thiệu có cấu trúc cho danh mục BigBike "${safeName}" bằng tiếng Việt.`,
      'Chỉ trả về đúng khuôn nhãn bên dưới. Không trả về HTML, Markdown, code fence, lời giải thích, bảng hoặc nhãn khác.',
      `Trả đúng ${faqCount} cặp HỎI/ĐÁP. Nội dung hữu ích, thực tế, ngắn gọn và phù hợp với khách hàng.`,
      copy.limits,
      '',
      copy.sample,
      ...Array.from({ length: Math.max(0, faqCount - 1) }, () => 'HỎI: …\nĐÁP: …'),
      '',
      'Không bịa thương hiệu hoặc thông tin sản phẩm chưa biết. Giữ nhãn bằng tiếng Việt và không thêm lời dẫn hay lời kết.',
    ].join('\n')
}
