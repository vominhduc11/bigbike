import { translateFields } from '@/lib/adminApi'

// VI→EN auto-translation. The Gemini call now runs on the BACKEND (server-side key) — the
// admin only posts the fields it wants translated. Fields/sections the admin edited by hand
// are "locked" (passed in `overrides`) and skipped, so manual English is never overwritten.
//
// `original` (optional 3rd arg on every translate*Form below) is a snapshot of the form taken
// when it was opened (or after the last save) — see each screen's `initialSnapshot`. An unlocked
// field/section is only sent to Gemini when its Vietnamese content changed since that snapshot,
// or its English counterpart is still blank (first translate, or a previous pass left it empty).
// `original` is null on create (nothing to diff against yet) — every non-empty unlocked field is
// sent, same as before this diffing was added.

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

// ── Change/gap detection for the "only translate what actually changed" gate ────────────────

/** True when `key` on `current` differs from the snapshot, or there is no snapshot to diff. */
function isChanged(original, key, currentValue) {
  if (!original) return true
  return (original[key] ?? '') !== (currentValue ?? '')
}

/** Same as {@link isChanged} but for array/object fields (deep compare via JSON). */
function isArrayChanged(original, key, currentValue) {
  if (!original) return true
  return JSON.stringify(original[key] ?? null) !== JSON.stringify(currentValue ?? null)
}

function isEnBlank(value) {
  return !value || !String(value).trim()
}

/** True when any row has a non-blank VI value whose paired EN value is still blank. */
function rowsHaveEnGap(rows, pairs) {
  if (!Array.isArray(rows)) return false
  return rows.some((r) => pairs.some(([viKey, enKey]) => r?.[viKey]?.trim() && isEnBlank(r?.[enKey])))
}

// Text-bearing fields per description-block type, used only for the EN-gap check below (mirrors
// the field set the toTranslate-collection loop reads for each block type further down).
const BLOCK_TEXT_FIELDS = {
  heading: ['text'],
  paragraph: ['html'],
  callout: ['html'],
  suitability: ['html'],
  sizeGuide: ['title', 'html'],
  feature: ['title', 'description'],
}

function blockHasText(block) {
  if (!block) return false
  const fields = BLOCK_TEXT_FIELDS[block.type] || []
  if (fields.some((f) => block[f]?.trim())) return true
  return Array.isArray(block.items) && block.items.some((i) => i?.trim())
}

/** True when the EN mirror block is missing (structurally, or type-mismatched) or a text field it
 * carries is blank while the VI counterpart isn't. */
function blockHasEnGap(viBlock, enBlock) {
  if (!viBlock) return false
  if (!enBlock || enBlock.type !== viBlock.type) return blockHasText(viBlock)
  const fields = BLOCK_TEXT_FIELDS[viBlock.type] || []
  if (fields.some((f) => viBlock[f]?.trim() && isEnBlank(enBlock[f]))) return true
  if (Array.isArray(viBlock.items)) {
    const enItems = Array.isArray(enBlock.items) ? enBlock.items : []
    if (viBlock.items.some((item, j) => item?.trim() && isEnBlank(enItems[j]))) return true
  }
  if (viBlock.type === 'suitability' && Array.isArray(viBlock.cards)) {
    const enCards = Array.isArray(enBlock.cards) ? enBlock.cards : []
    if (viBlock.cards.some((c, j) =>
      (c?.audience?.trim() && isEnBlank(enCards[j]?.audience)) || (c?.advice?.trim() && isEnBlank(enCards[j]?.advice)))) {
      return true
    }
  }
  return false
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

export async function translateCategoryForm(form, overrides = [], original = null) {
  const locked = toLockSet(overrides)
  const needsTranslate = (key) => isChanged(original, key, form[key]) || isEnBlank(form.translations?.en?.[key])
  const toTranslate = {}
  if (!locked.has('name') && form.name?.trim() && needsTranslate('name')) toTranslate.name = form.name.trim()
  if (!locked.has('description') && form.description?.trim() && needsTranslate('description')) toTranslate.description = form.description.trim()
  if (!locked.has('introContent') && form.introContent?.trim() && needsTranslate('introContent')) toTranslate.introContent = form.introContent.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim() && needsTranslate('seoTitle')) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim() && needsTranslate('seoDescription')) toTranslate.seoDescription = form.seoDescription.trim()

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

export async function translateBrandForm(form, overrides = [], original = null) {
  const locked = toLockSet(overrides)
  const needsTranslate = (key) => isChanged(original, key, form[key]) || isEnBlank(form.translations?.en?.[key])
  const toTranslate = {}
  if (!locked.has('name') && form.name?.trim() && needsTranslate('name')) toTranslate.name = form.name.trim()
  if (!locked.has('description') && form.description?.trim() && needsTranslate('description')) toTranslate.description = form.description.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim() && needsTranslate('seoTitle')) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim() && needsTranslate('seoDescription')) toTranslate.seoDescription = form.seoDescription.trim()

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

// ── Settings Translation ────────────────────────────────────────────────────
// Settings has no fixed field set (each row is a dynamic setting_key) and locks per-row with a
// plain boolean instead of an `overrides` array (V309), so the caller (SettingsScreen) pre-filters
// to translatable+unlocked candidates and passes their VI/EN state directly, rather than this
// function reaching into a `form`/`overrides` shape like the entity-based helpers above.

/**
 * Auto-translate dirty site settings VI→EN on save.
 * `candidates`: [{ key, viValue, enValue, viChanged }] — already filtered by the caller to
 * translatable, unlocked settings being saved. Returns { [key]: translatedEnText } for entries
 * actually sent to Gemini (unchanged VI with a non-blank EN are skipped, same cost-saving gate
 * as translateCategoryForm/translateBrandForm).
 */
export async function translateSettingsForm(candidates = []) {
  const toTranslate = {}
  for (const c of candidates) {
    const vi = (c.viValue ?? '').trim()
    if (!vi) continue
    if (c.viChanged || isEnBlank(c.enValue)) {
      toTranslate[c.key] = vi
    }
  }
  return callTranslate(toTranslate)
}

// ── Content (Article) Translation ───────────────────────────────────────────

export async function translateContentForm(form, overrides = [], original = null) {
  const locked = toLockSet(overrides)
  const needsTranslate = (key) => isChanged(original, key, form[key]) || isEnBlank(form.translations?.en?.[key])
  const toTranslate = {}
  if (!locked.has('title') && form.title?.trim() && needsTranslate('title')) toTranslate.title = form.title.trim()
  if (!locked.has('excerpt') && form.excerpt?.trim() && needsTranslate('excerpt')) toTranslate.excerpt = form.excerpt.trim()
  if (!locked.has('body') && form.body?.trim() && needsTranslate('body')) toTranslate.body = form.body.trim()
  if (!locked.has('seoTitle') && form.seoTitle?.trim() && needsTranslate('seoTitle')) toTranslate.seoTitle = form.seoTitle.trim()
  if (!locked.has('seoDescription') && form.seoDescription?.trim() && needsTranslate('seoDescription')) toTranslate.seoDescription = form.seoDescription.trim()
  if (!locked.has('heroTitle') && form.heroTitle?.trim() && needsTranslate('heroTitle')) toTranslate.heroTitle = form.heroTitle.trim()

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

export async function translateProductForm(form, overrides = [], original = null) {
  const locked = toLockSet(overrides)
  const fieldOpen = (key) => !locked.has(key)
  const sectionOpen = (name) => !locked.has(sectionKey(name))
  const needsTranslate = (key) => isChanged(original, key, form[key]) || isEnBlank(form.translations?.en?.[key])
  // enGap: lazy — only computed when the section actually changed check is false, since it walks
  // every row/block.
  const sectionNeedsTranslate = (key, enGap) => isArrayChanged(original, key, form[key]) || enGap()
  const toTranslate = {}

  // Flat fields
  if (fieldOpen('name') && form.name?.trim() && needsTranslate('name')) toTranslate.name = form.name.trim()
  if (fieldOpen('shortDescription') && form.shortDescription?.trim() && needsTranslate('shortDescription')) toTranslate.shortDescription = form.shortDescription.trim()
  if (fieldOpen('description') && form.description?.trim() && needsTranslate('description')) toTranslate.description = form.description.trim()
  if (fieldOpen('seoTitle') && form.seoTitle?.trim() && needsTranslate('seoTitle')) toTranslate.seoTitle = form.seoTitle.trim()
  if (fieldOpen('seoDescription') && form.seoDescription?.trim() && needsTranslate('seoDescription')) toTranslate.seoDescription = form.seoDescription.trim()
  if (fieldOpen('specificationsHtml') && form.specificationsHtml?.trim() && needsTranslate('specificationsHtml')) toTranslate.specificationsHtml = form.specificationsHtml.trim()
  if (fieldOpen('specStatsHtml') && form.specStatsHtml?.trim() && needsTranslate('specStatsHtml')) toTranslate.specStatsHtml = form.specStatsHtml.trim()
  if (fieldOpen('trustBadgesHtml') && form.trustBadgesHtml?.trim() && needsTranslate('trustBadgesHtml')) toTranslate.trustBadgesHtml = form.trustBadgesHtml.trim()

  // Arrays mapping to flat keys for batch translation (skipped when the section is locked, or when
  // unchanged since the snapshot and already fully translated)
  if (sectionOpen('specifications') && Array.isArray(form.specifications)
      && sectionNeedsTranslate('specifications', () => rowsHaveEnGap(form.specifications, [['name', 'nameEn'], ['value', 'valueEn']]))) {
    form.specifications.forEach((s, i) => {
      if (s.name?.trim()) toTranslate[`spec_name_${i}`] = s.name.trim()
      if (s.value?.trim()) toTranslate[`spec_value_${i}`] = s.value.trim()
    })
  }
  if (sectionOpen('specStats') && Array.isArray(form.specStats)
      && sectionNeedsTranslate('specStats', () => rowsHaveEnGap(form.specStats, [['value', 'valueEn'], ['label', 'labelEn']]))) {
    form.specStats.forEach((s, i) => {
      if (s.value?.trim()) toTranslate[`specStats_value_${i}`] = s.value.trim()
      if (s.label?.trim()) toTranslate[`specStats_label_${i}`] = s.label.trim()
    })
  }
  if (sectionOpen('faqs') && Array.isArray(form.faqs)
      && sectionNeedsTranslate('faqs', () => rowsHaveEnGap(form.faqs, [['question', 'questionEn'], ['answer', 'answerEn']]))) {
    form.faqs.forEach((f, i) => {
      if (f.question?.trim()) toTranslate[`faq_question_${i}`] = f.question.trim()
      if (f.answer?.trim()) toTranslate[`faq_answer_${i}`] = f.answer.trim()
    })
  }
  if (sectionOpen('commitments') && Array.isArray(form.commitments)
      && sectionNeedsTranslate('commitments', () => rowsHaveEnGap(form.commitments, [['title', 'titleEn'], ['subtitle', 'subtitleEn']]))) {
    form.commitments.forEach((c, i) => {
      if (c.title?.trim()) toTranslate[`commitment_title_${i}`] = c.title.trim()
      if (c.subtitle?.trim()) toTranslate[`commitment_subtitle_${i}`] = c.subtitle.trim()
    })
  }
  if (sectionOpen('trustBadges') && Array.isArray(form.trustBadges)
      && sectionNeedsTranslate('trustBadges', () => rowsHaveEnGap(form.trustBadges, [['content', 'contentEn']]))) {
    form.trustBadges.forEach((b, i) => {
      if (b.content?.trim()) toTranslate[`trustBadge_content_${i}`] = b.content.trim()
    })
  }
  if (sectionOpen('positiveNotes') && Array.isArray(form.positiveNotes)
      && sectionNeedsTranslate('positiveNotes', () => rowsHaveEnGap(form.positiveNotes, [['content', 'contentEn']]))) {
    form.positiveNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`posNote_content_${i}`] = n.content.trim()
    })
  }
  if (sectionOpen('negativeNotes') && Array.isArray(form.negativeNotes)
      && sectionNeedsTranslate('negativeNotes', () => rowsHaveEnGap(form.negativeNotes, [['content', 'contentEn']]))) {
    form.negativeNotes.forEach((n, i) => {
      if (n.content?.trim()) toTranslate[`negNote_content_${i}`] = n.content.trim()
    })
  }
  if (sectionOpen('suitabilityCards') && Array.isArray(form.suitabilityCards)
      && sectionNeedsTranslate('suitabilityCards', () => rowsHaveEnGap(form.suitabilityCards, [['audience', 'audienceEn'], ['advice', 'adviceEn'], ['linkLabel', 'linkLabelEn']]))) {
    form.suitabilityCards.forEach((c, i) => {
      if (c.audience?.trim()) toTranslate[`suitability_audience_${i}`] = c.audience.trim()
      if (c.advice?.trim()) toTranslate[`suitability_advice_${i}`] = c.advice.trim()
      if (c.linkLabel?.trim()) toTranslate[`suitability_linkLabel_${i}`] = c.linkLabel.trim()
    })
  }

  // Description blocks translation keys. Captured in a flag (not just re-checked inline) because
  // the mapping-back below clones the VI block and only overwrites translated fields — if that ran
  // for a section we didn't actually send, untranslated fields would fall back to VI text and
  // clobber the existing English, not preserve it (unlike the row-array sections above, whose
  // mapping-back falls back to the row's OWN existing *En field).
  const sendDescriptionBlocks = sectionOpen('descriptionBlocks') && Array.isArray(form.descriptionBlocks)
      && sectionNeedsTranslate('descriptionBlocks', () => {
        const enBlocks = Array.isArray(form.descriptionBlocksEn) ? form.descriptionBlocksEn : []
        return form.descriptionBlocks.some((b, i) => blockHasEnGap(b, enBlocks[i]))
      })
  if (sendDescriptionBlocks) {
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

  // Description blocks mapping back (clone and map VI blocks to EN blocks) — only when this
  // section was actually sent above (see `sendDescriptionBlocks`), not merely unlocked.
  if (sendDescriptionBlocks && Array.isArray(nextForm.descriptionBlocks)) {
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
