import { toast } from '@/lib/toast'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
}

async function callGeminiTranslate(sourceObject) {
  if (!API_KEY) {
    toast.error('Chưa cấu hình VITE_GEMINI_API_KEY trong file .env!')
    return null
  }

  // If there's nothing to translate, return empty object
  if (Object.keys(sourceObject).length === 0) {
    return {}
  }

  try {
    const prompt = `Translate the following JSON object's string values from Vietnamese to English. Retain all keys. Translate the values to natural English. If a value is HTML, preserve all HTML tags and properties exactly and translate only the text inside. If a value is already in English, keep it as is. Do not include markdown code block formatting (i.e. return ONLY raw JSON).

JSON to translate:
${JSON.stringify(sourceObject)}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`)
    }

    const data = await response.json()
    const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!resultText) {
      throw new Error('Invalid response structure from Gemini API')
    }

    return JSON.parse(resultText)
  } catch (error) {
    console.error('Gemini translation error:', error)
    toast.error('Lỗi khi tự động dịch bằng Gemini AI. Vui lòng kiểm tra lại cấu hình API key!')
    return null
  }
}

// ── Category Translation ───────────────────────────────────────────────────

export async function translateCategoryForm(form) {
  const toTranslate = {}
  if (form.name?.trim()) toTranslate.name = form.name.trim()
  if (form.description?.trim()) toTranslate.description = form.description.trim()
  if (form.introContent?.trim()) toTranslate.introContent = form.introContent.trim()
  if (form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()

  const translated = await callGeminiTranslate(toTranslate)
  if (!translated) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    nextForm.translations.en.slug = slugify(translated.name)
  }
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.introContent) nextForm.translations.en.introContent = translated.introContent
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription

  return nextForm
}

// ── Brand Translation ──────────────────────────────────────────────────────

export async function translateBrandForm(form) {
  const toTranslate = {}
  if (form.name?.trim()) toTranslate.name = form.name.trim()
  if (form.description?.trim()) toTranslate.description = form.description.trim()
  if (form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()

  const translated = await callGeminiTranslate(toTranslate)
  if (!translated) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    nextForm.translations.en.slug = slugify(translated.name)
  }
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription

  return nextForm
}

// ── Content (Article/Page) Translation ──────────────────────────────────────

export async function translateContentForm(form) {
  const toTranslate = {}
  if (form.title?.trim()) toTranslate.title = form.title.trim()
  if (form.excerpt?.trim()) toTranslate.excerpt = form.excerpt.trim()
  if (form.body?.trim()) toTranslate.body = form.body.trim()
  if (form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()
  if (form.heroTitle?.trim()) toTranslate.heroTitle = form.heroTitle.trim()

  const translated = await callGeminiTranslate(toTranslate)
  if (!translated) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.title) {
    nextForm.translations.en.title = translated.title
    if (form.type === 'ARTICLE') {
      nextForm.translations.en.slug = slugify(translated.title)
    }
  }
  if (translated.excerpt) nextForm.translations.en.excerpt = translated.excerpt
  if (translated.body) nextForm.translations.en.body = translated.body
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription
  if (translated.heroTitle) nextForm.translations.en.heroTitle = translated.heroTitle

  return nextForm
}

// ── Product Translation ───────────────────────────────────────────────────

export async function translateProductForm(form) {
  const toTranslate = {}

  // Flat fields
  if (form.name?.trim()) toTranslate.name = form.name.trim()
  if (form.shortDescription?.trim()) toTranslate.shortDescription = form.shortDescription.trim()
  if (form.description?.trim()) toTranslate.description = form.description.trim()
  if (form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()
  if (form.specificationsHtml?.trim()) toTranslate.specificationsHtml = form.specificationsHtml.trim()
  if (form.specStatsHtml?.trim()) toTranslate.specStatsHtml = form.specStatsHtml.trim()
  if (form.trustBadgesHtml?.trim()) toTranslate.trustBadgesHtml = form.trustBadgesHtml.trim()

  // Arrays mapping to flat keys for batch translation
  if (Array.isArray(form.specifications)) {
    form.specifications.forEach((s, i) => {
      if (s.name?.trim()) toTranslate[`spec_name_${i}`] = s.name.trim()
      if (s.value?.trim()) toTranslate[`spec_value_${i}`] = s.value.trim()
    })
  }
  if (Array.isArray(form.specStats)) {
    form.specStats.forEach((s, i) => {
      if (s.value?.trim()) toTranslate[`specStats_value_${i}`] = s.value.trim()
      if (s.label?.trim()) toTranslate[`specStats_label_${i}`] = s.label.trim()
    })
  }
  if (Array.isArray(form.faqs)) {
    form.faqs.forEach((f, i) => {
      if (f.question?.trim()) toTranslate[`faq_question_${i}`] = f.question.trim()
      if (f.answer?.trim()) toTranslate[`faq_answer_${i}`] = f.answer.trim()
    })
  }
  if (Array.isArray(form.commitments)) {
    form.commitments.forEach((c, i) => {
      if (c.title?.trim()) toTranslate[`commitment_title_${i}`] = c.title.trim()
      if (c.subtitle?.trim()) toTranslate[`commitment_subtitle_${i}`] = c.subtitle.trim()
    })
  }
  if (Array.isArray(form.trustBadges)) {
    form.trustBadges.forEach((b, i) => {
      if (b.content?.trim()) toTranslate[`trustBadge_content_${i}`] = b.content.trim()
    })
  }
  if (Array.isArray(form.positiveNotes)) {
    form.positiveNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`posNote_content_${i}`] = n.content.trim()
    })
  }
  if (Array.isArray(form.negativeNotes)) {
    form.negativeNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`negNote_content_${i}`] = n.content.trim()
    })
  }
  if (Array.isArray(form.suitabilityCards)) {
    form.suitabilityCards.forEach((c, i) => {
      if (c.audience?.trim()) toTranslate[`suitability_audience_${i}`] = c.audience.trim()
      if (c.advice?.trim()) toTranslate[`suitability_advice_${i}`] = c.advice.trim()
      if (c.linkLabel?.trim()) toTranslate[`suitability_linkLabel_${i}`] = c.linkLabel.trim()
    })
  }

  // Description blocks translation keys
  if (Array.isArray(form.descriptionBlocks)) {
    form.descriptionBlocks.forEach((b, i) => {
      if (b.type === 'heading' && b.text?.trim()) {
        toTranslate[`block_heading_text_${i}`] = b.text.trim()
      } else if (b.type === 'paragraph' && b.html?.trim()) {
        toTranslate[`block_paragraph_html_${i}`] = b.html.trim()
      } else if (b.type === 'list' && Array.isArray(b.items)) {
        b.items.forEach((item, j) => {
          if (item?.trim()) toTranslate[`block_list_item_${i}_${j}`] = item.trim()
        })
      } else if (b.type === 'callout' && b.html?.trim()) {
        toTranslate[`block_callout_html_${i}`] = b.html.trim()
      } else if (b.type === 'feature') {
        if (b.title?.trim()) toTranslate[`block_feature_title_${i}`] = b.title.trim()
        if (b.description?.trim()) toTranslate[`block_feature_description_${i}`] = b.description.trim()
        if (Array.isArray(b.items)) {
          b.items.forEach((item, j) => {
            if (item?.trim()) toTranslate[`block_feature_item_${i}_${j}`] = item.trim()
          })
        }
      } else if (b.type === 'suitability' && b.html?.trim()) {
        toTranslate[`block_suitability_html_${i}`] = b.html.trim()
      } else if (b.type === 'sizeGuide' && b.html?.trim()) {
        toTranslate[`block_sizeGuide_html_${i}`] = b.html.trim()
      }
    })
  }

  const translated = await callGeminiTranslate(toTranslate)
  if (!translated) return form

  const nextForm = JSON.parse(JSON.stringify(form))
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    nextForm.translations.en.slug = slugify(translated.name)
  }
  if (translated.shortDescription) nextForm.translations.en.shortDescription = translated.shortDescription
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription
  if (translated.specificationsHtml) nextForm.translations.en.specificationsHtml = translated.specificationsHtml
  if (translated.specStatsHtml) nextForm.translations.en.specStatsHtml = translated.specStatsHtml
  if (translated.trustBadgesHtml) nextForm.translations.en.trustBadgesHtml = translated.trustBadgesHtml

  // Array values mapping back
  if (Array.isArray(nextForm.specifications)) {
    nextForm.specifications = nextForm.specifications.map((s, i) => ({
      ...s,
      nameEn: translated[`spec_name_${i}`] || s.nameEn || '',
      valueEn: translated[`spec_value_${i}`] || s.valueEn || '',
    }))
  }
  if (Array.isArray(nextForm.specStats)) {
    nextForm.specStats = nextForm.specStats.map((s, i) => ({
      ...s,
      valueEn: translated[`specStats_value_${i}`] || s.valueEn || '',
      labelEn: translated[`specStats_label_${i}`] || s.labelEn || '',
    }))
  }
  if (Array.isArray(nextForm.faqs)) {
    nextForm.faqs = nextForm.faqs.map((f, i) => ({
      ...f,
      questionEn: translated[`faq_question_${i}`] || f.questionEn || '',
      answerEn: translated[`faq_answer_${i}`] || f.answerEn || '',
    }))
  }
  if (Array.isArray(nextForm.commitments)) {
    nextForm.commitments = nextForm.commitments.map((c, i) => ({
      ...c,
      titleEn: translated[`commitment_title_${i}`] || c.titleEn || '',
      subtitleEn: translated[`commitment_subtitle_${i}`] || c.subtitleEn || '',
    }))
  }
  if (Array.isArray(nextForm.trustBadges)) {
    nextForm.trustBadges = nextForm.trustBadges.map((b, i) => ({
      ...b,
      contentEn: translated[`trustBadge_content_${i}`] || b.contentEn || '',
    }))
  }
  if (Array.isArray(nextForm.positiveNotes)) {
    nextForm.positiveNotes = nextForm.positiveNotes.map((n, i) => ({
      ...n,
      contentEn: translated[`posNote_content_${i}`] || n.contentEn || '',
    }))
  }
  if (Array.isArray(nextForm.negativeNotes)) {
    nextForm.negativeNotes = nextForm.negativeNotes.map((n, i) => ({
      ...n,
      contentEn: translated[`negNote_content_${i}`] || n.contentEn || '',
    }))
  }
  if (Array.isArray(nextForm.suitabilityCards)) {
    nextForm.suitabilityCards = nextForm.suitabilityCards.map((c, i) => ({
      ...c,
      audienceEn: translated[`suitability_audience_${i}`] || c.audienceEn || '',
      adviceEn: translated[`suitability_advice_${i}`] || c.adviceEn || '',
      linkLabelEn: translated[`suitability_linkLabel_${i}`] || c.linkLabelEn || '',
    }))
  }

  // Description blocks mapping back (clone and map VI blocks to EN blocks)
  if (Array.isArray(nextForm.descriptionBlocks)) {
    nextForm.descriptionBlocksEn = nextForm.descriptionBlocks.map((b, i) => {
      const blockEn = { ...b }
      if (blockEn.type === 'heading') {
        blockEn.text = translated[`block_heading_text_${i}`] || b.text || ''
      } else if (blockEn.type === 'paragraph') {
        blockEn.html = translated[`block_paragraph_html_${i}`] || b.html || ''
      } else if (blockEn.type === 'list' && Array.isArray(b.items)) {
        blockEn.items = b.items.map((item, j) => translated[`block_list_item_${i}_${j}`] || item || '')
      } else if (blockEn.type === 'callout') {
        blockEn.html = translated[`block_callout_html_${i}`] || b.html || ''
      } else if (blockEn.type === 'feature') {
        blockEn.title = translated[`block_feature_title_${i}`] || b.title || ''
        blockEn.description = translated[`block_feature_description_${i}`] || b.description || ''
        if (Array.isArray(b.items)) {
          blockEn.items = b.items.map((item, j) => translated[`block_feature_item_${i}_${j}`] || item || '')
        }
      } else if (blockEn.type === 'suitability') {
        blockEn.html = translated[`block_suitability_html_${i}`] || b.html || ''
      } else if (blockEn.type === 'sizeGuide') {
        blockEn.html = translated[`block_sizeGuide_html_${i}`] || b.html || ''
      }
      return blockEn
    })
  }

  return nextForm
}
