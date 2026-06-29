import { translateFields } from '@/lib/adminApi'

// VI→EN auto-translation. The Gemini call now runs on the BACKEND (server-side key) — the
// admin only posts the fields it wants translated. Fields/sections the admin edited by hand
// are "locked" (passed in `overrides`) and skipped, so manual English is never overwritten.

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

/** Section override key, e.g. lockKeyFor('specifications') === 'section:specifications'. */
export function sectionKey(name) {
  return `section:${name}`
}

/** Add an English field/section key to the manual-edit lock set (deduped, immutable). */
export function addOverride(overrides, key) {
  const list = Array.isArray(overrides) ? overrides : []
  return list.includes(key) ? list : [...list, key]
}

function toLockSet(overrides) {
  return new Set(Array.isArray(overrides) ? overrides : [])
}

async function callTranslate(sourceObject) {
  if (!sourceObject || Object.keys(sourceObject).length === 0) return {}
  try {
    return await translateFields(sourceObject)
  } catch (error) {
    console.error('Auto-translate error:', error)
    return {}
  }
}

// ── Category Translation ───────────────────────────────────────────────────

export async function translateCategoryForm(form, overrides = []) {
  const locked = toLockSet(overrides)
  const toTranslate = {}
  if (!locked.has('name') && form.name?.trim()) toTranslate.name = form.name.trim()
  if (!locked.has('description') && form.description?.trim()) toTranslate.description = form.description.trim()
  if (!locked.has('introContent') && form.introContent?.trim()) toTranslate.introContent = form.introContent.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()

  const translated = await callTranslate(toTranslate)
  if (Object.keys(translated).length === 0) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    if (!locked.has('slug')) {
      const enSlug = slugify(translated.name)
      if (enSlug && enSlug !== (nextForm.slug || '')) {
        nextForm.translations.en.slug = enSlug
      }
    }
  }
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.introContent) nextForm.translations.en.introContent = translated.introContent
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription

  return nextForm
}

// ── Brand Translation ──────────────────────────────────────────────────────

export async function translateBrandForm(form, overrides = []) {
  const locked = toLockSet(overrides)
  const toTranslate = {}
  if (!locked.has('name') && form.name?.trim()) toTranslate.name = form.name.trim()
  if (!locked.has('description') && form.description?.trim()) toTranslate.description = form.description.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()

  const translated = await callTranslate(toTranslate)
  if (Object.keys(translated).length === 0) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    if (!locked.has('slug')) {
      const enSlug = slugify(translated.name)
      if (enSlug && enSlug !== (nextForm.slug || '')) {
        nextForm.translations.en.slug = enSlug
      }
    }
  }
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription

  return nextForm
}

// ── Content (Article) Translation ───────────────────────────────────────────

export async function translateContentForm(form, overrides = []) {
  const locked = toLockSet(overrides)
  const toTranslate = {}
  if (!locked.has('title') && form.title?.trim()) toTranslate.title = form.title.trim()
  if (!locked.has('excerpt') && form.excerpt?.trim()) toTranslate.excerpt = form.excerpt.trim()
  if (!locked.has('body') && form.body?.trim()) toTranslate.body = form.body.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()
  if (!locked.has('heroTitle') && form.heroTitle?.trim()) toTranslate.heroTitle = form.heroTitle.trim()

  const translated = await callTranslate(toTranslate)
  if (Object.keys(translated).length === 0) return form

  const nextForm = { ...form }
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.title) {
    nextForm.translations.en.title = translated.title
    if (form.type === 'ARTICLE' && !locked.has('slug')) {
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

export async function translateProductForm(form, overrides = []) {
  const locked = toLockSet(overrides)
  const fieldOpen = (key) => !locked.has(key)
  const sectionOpen = (name) => !locked.has(sectionKey(name))
  const toTranslate = {}

  // Flat fields
  if (fieldOpen('name') && form.name?.trim()) toTranslate.name = form.name.trim()
  if (fieldOpen('shortDescription') && form.shortDescription?.trim()) toTranslate.shortDescription = form.shortDescription.trim()
  if (fieldOpen('description') && form.description?.trim()) toTranslate.description = form.description.trim()
  if (fieldOpen('seoTitle') && form.seoTitle?.trim()) toTranslate.seoTitle = form.seoTitle.trim()
  if (fieldOpen('seoDescription') && form.seoDescription?.trim()) toTranslate.seoDescription = form.seoDescription.trim()
  if (fieldOpen('specificationsHtml') && form.specificationsHtml?.trim()) toTranslate.specificationsHtml = form.specificationsHtml.trim()
  if (fieldOpen('specStatsHtml') && form.specStatsHtml?.trim()) toTranslate.specStatsHtml = form.specStatsHtml.trim()
  if (fieldOpen('trustBadgesHtml') && form.trustBadgesHtml?.trim()) toTranslate.trustBadgesHtml = form.trustBadgesHtml.trim()

  // Arrays mapping to flat keys for batch translation (skipped when the section is locked)
  if (sectionOpen('specifications') && Array.isArray(form.specifications)) {
    form.specifications.forEach((s, i) => {
      if (s.name?.trim()) toTranslate[`spec_name_${i}`] = s.name.trim()
      if (s.value?.trim()) toTranslate[`spec_value_${i}`] = s.value.trim()
    })
  }
  if (sectionOpen('specStats') && Array.isArray(form.specStats)) {
    form.specStats.forEach((s, i) => {
      if (s.value?.trim()) toTranslate[`specStats_value_${i}`] = s.value.trim()
      if (s.label?.trim()) toTranslate[`specStats_label_${i}`] = s.label.trim()
    })
  }
  if (sectionOpen('faqs') && Array.isArray(form.faqs)) {
    form.faqs.forEach((f, i) => {
      if (f.question?.trim()) toTranslate[`faq_question_${i}`] = f.question.trim()
      if (f.answer?.trim()) toTranslate[`faq_answer_${i}`] = f.answer.trim()
    })
  }
  if (sectionOpen('commitments') && Array.isArray(form.commitments)) {
    form.commitments.forEach((c, i) => {
      if (c.title?.trim()) toTranslate[`commitment_title_${i}`] = c.title.trim()
      if (c.subtitle?.trim()) toTranslate[`commitment_subtitle_${i}`] = c.subtitle.trim()
    })
  }
  if (sectionOpen('trustBadges') && Array.isArray(form.trustBadges)) {
    form.trustBadges.forEach((b, i) => {
      if (b.content?.trim()) toTranslate[`trustBadge_content_${i}`] = b.content.trim()
    })
  }
  if (sectionOpen('positiveNotes') && Array.isArray(form.positiveNotes)) {
    form.positiveNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`posNote_content_${i}`] = n.content.trim()
    })
  }
  if (sectionOpen('negativeNotes') && Array.isArray(form.negativeNotes)) {
    form.negativeNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`negNote_content_${i}`] = n.content.trim()
    })
  }
  if (sectionOpen('suitabilityCards') && Array.isArray(form.suitabilityCards)) {
    form.suitabilityCards.forEach((c, i) => {
      if (c.audience?.trim()) toTranslate[`suitability_audience_${i}`] = c.audience.trim()
      if (c.advice?.trim()) toTranslate[`suitability_advice_${i}`] = c.advice.trim()
      if (c.linkLabel?.trim()) toTranslate[`suitability_linkLabel_${i}`] = c.linkLabel.trim()
    })
  }

  // Description blocks translation keys
  if (sectionOpen('descriptionBlocks') && Array.isArray(form.descriptionBlocks)) {
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

  const translated = await callTranslate(toTranslate)
  if (Object.keys(translated).length === 0) return form

  const nextForm = JSON.parse(JSON.stringify(form))
  if (!nextForm.translations) nextForm.translations = { en: {} }
  if (!nextForm.translations.en) nextForm.translations.en = {}

  if (translated.name) {
    nextForm.translations.en.name = translated.name
    if (fieldOpen('slug')) {
      const enSlug = slugify(translated.name)
      // Skip if identical to VI slug — backend requires EN slug ≠ VI slug.
      if (enSlug && enSlug !== (nextForm.slug || '')) {
        nextForm.translations.en.slug = enSlug
      }
    }
  }
  if (translated.shortDescription) nextForm.translations.en.shortDescription = translated.shortDescription
  if (translated.description) nextForm.translations.en.description = translated.description
  if (translated.seoTitle) nextForm.translations.en.seoTitle = translated.seoTitle
  if (translated.seoDescription) nextForm.translations.en.seoDescription = translated.seoDescription
  if (translated.specificationsHtml) nextForm.translations.en.specificationsHtml = translated.specificationsHtml
  if (translated.specStatsHtml) nextForm.translations.en.specStatsHtml = translated.specStatsHtml
  if (translated.trustBadgesHtml) nextForm.translations.en.trustBadgesHtml = translated.trustBadgesHtml

  // Array values mapping back — only for sections we actually translated (locked sections keep
  // the admin's existing English untouched).
  if (sectionOpen('specifications') && Array.isArray(nextForm.specifications)) {
    nextForm.specifications = nextForm.specifications.map((s, i) => ({
      ...s,
      nameEn: translated[`spec_name_${i}`] || s.nameEn || '',
      valueEn: translated[`spec_value_${i}`] || s.valueEn || '',
    }))
  }
  if (sectionOpen('specStats') && Array.isArray(nextForm.specStats)) {
    nextForm.specStats = nextForm.specStats.map((s, i) => ({
      ...s,
      valueEn: translated[`specStats_value_${i}`] || s.valueEn || '',
      labelEn: translated[`specStats_label_${i}`] || s.labelEn || '',
    }))
  }
  if (sectionOpen('faqs') && Array.isArray(nextForm.faqs)) {
    nextForm.faqs = nextForm.faqs.map((f, i) => ({
      ...f,
      questionEn: translated[`faq_question_${i}`] || f.questionEn || '',
      answerEn: translated[`faq_answer_${i}`] || f.answerEn || '',
    }))
  }
  if (sectionOpen('commitments') && Array.isArray(nextForm.commitments)) {
    nextForm.commitments = nextForm.commitments.map((c, i) => ({
      ...c,
      titleEn: translated[`commitment_title_${i}`] || c.titleEn || '',
      subtitleEn: translated[`commitment_subtitle_${i}`] || c.subtitleEn || '',
    }))
  }
  if (sectionOpen('trustBadges') && Array.isArray(nextForm.trustBadges)) {
    nextForm.trustBadges = nextForm.trustBadges.map((b, i) => ({
      ...b,
      contentEn: translated[`trustBadge_content_${i}`] || b.contentEn || '',
    }))
  }
  if (sectionOpen('positiveNotes') && Array.isArray(nextForm.positiveNotes)) {
    nextForm.positiveNotes = nextForm.positiveNotes.map((n, i) => ({
      ...n,
      contentEn: translated[`posNote_content_${i}`] || n.contentEn || '',
    }))
  }
  if (sectionOpen('negativeNotes') && Array.isArray(nextForm.negativeNotes)) {
    nextForm.negativeNotes = nextForm.negativeNotes.map((n, i) => ({
      ...n,
      contentEn: translated[`negNote_content_${i}`] || n.contentEn || '',
    }))
  }
  if (sectionOpen('suitabilityCards') && Array.isArray(nextForm.suitabilityCards)) {
    nextForm.suitabilityCards = nextForm.suitabilityCards.map((c, i) => ({
      ...c,
      audienceEn: translated[`suitability_audience_${i}`] || c.audienceEn || '',
      adviceEn: translated[`suitability_advice_${i}`] || c.adviceEn || '',
      linkLabelEn: translated[`suitability_linkLabel_${i}`] || c.linkLabelEn || '',
    }))
  }

  // Description blocks mapping back (clone and map VI blocks to EN blocks) — only when unlocked.
  if (sectionOpen('descriptionBlocks') && Array.isArray(nextForm.descriptionBlocks)) {
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
