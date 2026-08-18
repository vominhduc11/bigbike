import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormField } from '@/components/layout/FormField'
import { Modal } from '@/components/layout/Modal'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import AiHtmlBrief from '@/components/AiHtmlBrief'
import { RichTextEditor } from '@/components/RichTextEditor'
import { showConfirm } from '../../lib/confirm'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { emptyIntro, emptyFaq, getIntroInputMode, parseIntro, serializeIntro } from '@/lib/categoryIntro'
import {
  buildCategoryIntroAiPrompt,
  CATEGORY_INTRO_LIMITS,
  mergeCategoryIntroAiModel,
  parseCategoryIntroAiInput,
} from '@/lib/categoryIntroAi'

const INTRO_CONTENT_MAX_LENGTH = 50000

/**
 * Ô "Nội dung đầu trang danh mục" có hai công cụ nhập trên cùng một field HTML:
 * form cấu trúc cho khối `bb-cat-intro` và ô nhập nâng cao giữ nguyên markup người viết dán vào.
 * Chỉ khi người dùng sửa form cấu trúc mới serialize model thành HTML; mở/chuyển tab không tự ghi đè.
 */
export function IntroContentField({ value, onChange, disabled, lang = 'vi', categoryName = '' }) {
  const { t } = useTranslation()
  const html = value || ''
  const [mode, setMode] = useState(() => getIntroInputMode(html))
  const [model, setModel] = useState(() => {
    const initialMode = getIntroInputMode(html)
    return initialMode === 'structured' ? parseIntro(html) : emptyIntro()
  })
  const [brandInput, setBrandInput] = useState('')
  const [aiPaste, setAiPaste] = useState('')
  const [aiReview, setAiReview] = useState(null)
  const [aiParseError, setAiParseError] = useState('')
  const lastHtml = useRef(html)
  // Form dài → thu gọn 2 phần ít dùng hơn (Câu hỏi thường gặp, Nút liên hệ). Mở
  // sẵn khi đã có nội dung để không giấu dữ liệu; đóng sẵn khi trống. Đọc giá trị
  // khởi tạo từ `model` (state đã parse sẵn) — không đọc ref trong lúc render.
  const [faqOpen, setFaqOpen] = useState(() => model.faqs.length > 0)
  const [ctaOpen, setCtaOpen] = useState(
    () => Boolean(model.ctaText || model.ctaLabel || model.ctaUrl),
  )

  useEffect(() => {
    if (html !== lastHtml.current) {
      lastHtml.current = html
      const nextMode = getIntroInputMode(html)
      const nextModel = nextMode === 'structured' ? parseIntro(html) : emptyIntro()
      setMode(nextMode)
      setModel(nextModel)
      setBrandInput('')
      setFaqOpen(nextModel.faqs.length > 0)
      setCtaOpen(Boolean(nextModel.ctaText || nextModel.ctaLabel || nextModel.ctaUrl))
    }
  }, [html])

  function commit(next) {
    const cleaned = { ...next, _legacy: false }
    setModel(cleaned)
    const serialized = serializeIntro(cleaned, lang)
    lastHtml.current = serialized
    onChange(serialized)
  }

  function updateAdvancedHtml(nextHtml) {
    lastHtml.current = nextHtml
    onChange(nextHtml)
  }

  function openAiReview() {
    const parsed = parseCategoryIntroAiInput(aiPaste)
    if (!parsed.hasContent) {
      setAiReview(null)
      setAiParseError(t('categories.detail.introAiPasteEmpty'))
      return
    }
    setAiParseError('')
    setAiReview(parsed)
  }

  function confirmAiReview() {
    if (!aiReview || aiReview.errors.length > 0) return
    const nextModel = mergeCategoryIntroAiModel(model, aiReview)
    commit(nextModel)
    setFaqOpen(nextModel.faqs.length > 0)
    setAiPaste('')
    setAiReview(null)
  }

  function reviewFieldLabel(field) {
    const labels = {
      heading: t('categories.detail.introHeading'),
      eyebrow: t('categories.detail.introEyebrow'),
      intro: t('categories.detail.introText'),
      brands: t('categories.detail.introBrands'),
      faqs: t('categories.detail.introSectionFaq'),
    }
    return labels[field] || field
  }

  function formatIgnoredItem(item) {
    const value = String(item || '')
    if (value === 'preamble') return t('categories.detail.introAiIgnoredPreamble')
    if (value === 'unsupportedHtml') return t('categories.detail.introAiIgnoredHtml')
    if (value === 'incompleteFaq') return t('categories.detail.introAiIgnoredIncompleteFaq')
    if (value.startsWith('unknown:')) {
      return t('categories.detail.introAiIgnoredUnknown', { label: value.slice('unknown:'.length) })
    }
    if (value.startsWith('json:')) {
      return t('categories.detail.introAiIgnoredJson', { label: value.slice('json:'.length) })
    }
    return value
  }

  function formatAiError(error) {
    const [field, limit] = String(error || '').split(':')
    return t('categories.detail.introAiTooLong', { field: reviewFieldLabel(field), max: limit })
  }

  const aiReviewReceived = aiReview ? [
    aiReview.present.heading ? reviewFieldLabel('heading') : '',
    aiReview.present.eyebrow ? reviewFieldLabel('eyebrow') : '',
    aiReview.present.intro ? reviewFieldLabel('intro') : '',
    aiReview.present.brands ? t('categories.detail.introAiReviewBrands', { count: aiReview.model.brands.length }) : '',
    aiReview.present.faqs ? t('categories.detail.introAiReviewFaqs', { count: aiReview.model.faqs.length }) : '',
  ].filter(Boolean) : []
  const aiReviewPreserved = aiReview ? Object.keys(aiReview.present)
    .filter((field) => !aiReview.present[field])
    .map((field) => reviewFieldLabel(field)) : []
  const aiPrompt = buildCategoryIntroAiPrompt({ categoryName, lang, faqCount: 5 })

  async function changeMode(next) {
    if (next === mode) return

    if (next === 'structured' && html.trim() && getIntroInputMode(html) === 'advanced') {
      const confirmed = await showConfirm(
        t('categories.detail.introAdvancedSwitchConfirm'),
        t('categories.detail.introAdvancedSwitchTitle'),
        {
          variant: 'default',
          confirmLabel: t('categories.detail.introAdvancedSwitchContinue'),
          cancelLabel: t('categories.detail.introAdvancedSwitchCancel'),
        },
      )
      if (!confirmed) return
    }

    if (next === 'structured') {
      const nextModel = parseIntro(html)
      setModel(nextModel)
      setBrandInput('')
      setFaqOpen(nextModel.faqs.length > 0)
      setCtaOpen(Boolean(nextModel.ctaText || nextModel.ctaLabel || nextModel.ctaUrl))
    }
    setMode(next)
  }

  const setField = (field, v) => commit({ ...model, [field]: v })

  const addFaq = () => commit({ ...model, faqs: [...model.faqs, emptyFaq()] })
  const updateFaq = (i, field, v) =>
    commit({ ...model, faqs: model.faqs.map((f, idx) => (idx === i ? { ...f, [field]: v } : f)) })
  // Xoá câu hỏi là mất nội dung đã nhập — xác nhận trước (không có Hoàn tác).
  const removeFaq = async (i) => {
    const ok = await showConfirm(
      t('categories.detail.introFaqRemoveConfirm', { defaultValue: 'Xoá câu hỏi này? Nội dung câu hỏi và câu trả lời sẽ bị xoá khỏi phần giới thiệu.' }),
      t('categories.detail.introFaqRemoveTitle', { defaultValue: 'Xoá câu hỏi thường gặp?' }),
      { variant: 'danger', confirmLabel: t('common.delete') },
    )
    if (!ok) return
    commit({ ...model, faqs: model.faqs.filter((_, idx) => idx !== i) })
  }
  const moveFaq = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= model.faqs.length) return
    const faqs = [...model.faqs]
    ;[faqs[i], faqs[j]] = [faqs[j], faqs[i]]
    commit({ ...model, faqs })
  }

  function addBrand() {
    const b = brandInput.trim()
    if (!b) return
    if (!model.brands.includes(b)) commit({ ...model, brands: [...model.brands, b] })
    setBrandInput('')
  }
  const removeBrand = (i) => commit({ ...model, brands: model.brands.filter((_, idx) => idx !== i) })

  const sectionClass = 'rounded-[var(--admin-radius-sm)] border border-input p-3 flex flex-col gap-3'
  const legendClass = 'text-sm font-semibold'
  const labelClass = 'text-xs text-muted-foreground'
  const numberLocale = lang === 'en' ? 'en-US' : 'vi-VN'
  const characterCount = t('categories.detail.introCharacterCount', {
    count: html.length.toLocaleString(numberLocale),
    max: INTRO_CONTENT_MAX_LENGTH.toLocaleString(numberLocale),
  })

  return (
    <>
      <Tabs value={mode} onValueChange={changeMode}>
      <TabsList>
        <TabsTrigger value="structured" disabled={disabled}>{t('products.detail.specs.modeStructured')}</TabsTrigger>
        <TabsTrigger value="advanced" disabled={disabled}>{t('products.detail.specs.modeHtml')}</TabsTrigger>
      </TabsList>
      <div className="text-right text-xs tabular-nums text-muted-foreground">{characterCount}</div>

      <TabsContent value="structured">
        <div className="flex flex-col gap-4">

      <div className="flex flex-col gap-3">
        <AiHtmlBrief
          prompt={aiPrompt}
          title={t('categories.detail.introAiPromptTitle')}
          copyLabel={t('categories.detail.introAiPromptCopy')}
          copiedMessage={t('categories.detail.introAiPromptCopied')}
          copyFailedMessage={t('categories.detail.introAiPromptCopyFailed')}
        />
        <FormField
          label={t('categories.detail.introAiPasteLabel')}
          helper={t('categories.detail.introAiPasteHint')}
        >
          <Textarea
            value={aiPaste}
            onChange={(e) => {
              setAiPaste(e.target.value)
              if (aiParseError) setAiParseError('')
            }}
            placeholder={t('categories.detail.introAiPastePlaceholder')}
            disabled={disabled}
            rows={8}
          />
        </FormField>
        {aiParseError ? <Alert tone="danger" size="sm">{aiParseError}</Alert> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openAiReview}
          disabled={disabled || !aiPaste.trim()}
          className="self-start"
        >
          {t('categories.detail.introAiPasteReview')}
        </Button>
      </div>

      {/* Phần 1: Giới thiệu + thương hiệu */}
      <fieldset className={sectionClass} disabled={disabled}>
        <legend className={legendClass}>{t('categories.detail.introSectionAbout')}</legend>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introEyebrow')}</span>
          <Input
            value={model.eyebrow}
            onChange={(e) => setField('eyebrow', e.target.value)}
            placeholder={t('categories.detail.introEyebrowPlaceholder')}
            disabled={disabled}
            maxLength={120}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introHeading')}</span>
          <Input
            value={model.heading}
            onChange={(e) => setField('heading', e.target.value)}
            placeholder={t('categories.detail.introHeadingPlaceholder')}
            disabled={disabled}
            maxLength={255}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introText')}</span>
          <RichTextEditor
            value={model.intro}
            onChange={(next) => setField('intro', next)}
            placeholder={t('categories.detail.introTextPlaceholder')}
            disabled={disabled}
            maxLength={CATEGORY_INTRO_LIMITS.intro}
            inlineOnly
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introBrands')}</span>
          {model.brands.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {model.brands.map((b, i) => (
                <span
                  key={`${b}-${i}`}
                  className="inline-flex items-center gap-1 rounded-[var(--admin-radius-xs)] border border-input px-2 py-0.5 text-xs"
                >
                  {b}
                  <Button
                    variant="unstyled"
                    onClick={() => removeBrand(i)}
                    disabled={disabled}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('categories.detail.introBrandRemove')}
                  >
                    <XIcon size={12} aria-hidden="true" />
                  </Button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addBrand()
                }
              }}
              aria-label={t('categories.detail.introBrands')}
              placeholder={t('categories.detail.introBrandsPlaceholder')}
              disabled={disabled}
              maxLength={60}
            />
            <Button type="button" variant="outline" size="sm" onClick={addBrand} disabled={disabled}>
              {t('categories.detail.introBrandAdd')}
            </Button>
          </div>
        </div>
      </fieldset>

      {/* Phần 2: Câu hỏi thường gặp — thu gọn (form dài) */}
      <CollapsibleSection
        title={t('categories.detail.introSectionFaq')}
        hint={model.faqs.length > 0
          ? t('categories.detail.introFaqCount', { count: model.faqs.length, defaultValue: '{{count}} câu hỏi' })
          : undefined}
        open={faqOpen}
        onToggle={() => setFaqOpen((v) => !v)}
      >
      <fieldset className="flex flex-col gap-3 pt-1" disabled={disabled}>
        {model.faqs.length === 0 && (
          <p className="text-xs text-muted-foreground">{t('categories.detail.introFaqEmpty')}</p>
        )}
        {model.faqs.map((faq, i) => (
          <div key={faq._key} className="flex flex-col gap-2 rounded-[var(--admin-radius-xs)] border border-input p-2">
            <div className="flex items-center justify-between">
              <span className={labelClass}>
                {t('categories.detail.introFaqQuestion')} {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveFaq(i, -1)}
                  disabled={disabled || i === 0}
                  aria-label={t('categories.detail.introFaqMoveUp')}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveFaq(i, 1)}
                  disabled={disabled || i === model.faqs.length - 1}
                  aria-label={t('categories.detail.introFaqMoveDown')}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeFaq(i)}
                  disabled={disabled}
                  aria-label={t('categories.detail.introFaqRemove')}
                >
                  <XIcon size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
            <Input
              value={faq.question}
              onChange={(e) => updateFaq(i, 'question', e.target.value)}
              placeholder={t('categories.detail.introFaqQuestionPlaceholder')}
              disabled={disabled}
              maxLength={300}
            />
            <RichTextEditor
              value={faq.answer}
              onChange={(next) => updateFaq(i, 'answer', next)}
              placeholder={t('categories.detail.introFaqAnswerPlaceholder')}
              disabled={disabled}
              maxLength={CATEGORY_INTRO_LIMITS.answer}
              inlineOnly
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addFaq} disabled={disabled} className="self-start">
          <Plus size={14} aria-hidden="true" /> {t('categories.detail.introFaqAdd')}
        </Button>
      </fieldset>
      </CollapsibleSection>

      {/* Phần 3: Nút liên hệ — thu gọn (form dài) */}
      <CollapsibleSection
        title={t('categories.detail.introSectionCta')}
        open={ctaOpen}
        onToggle={() => setCtaOpen((v) => !v)}
      >
      <fieldset className="flex flex-col gap-3 pt-1" disabled={disabled}>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introCtaText')}</span>
          <Input
            value={model.ctaText}
            onChange={(e) => setField('ctaText', e.target.value)}
            placeholder={t('categories.detail.introCtaTextPlaceholder')}
            disabled={disabled}
            maxLength={255}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introCtaLabel')}</span>
          <Input
            value={model.ctaLabel}
            onChange={(e) => setField('ctaLabel', e.target.value)}
            placeholder={t('categories.detail.introCtaLabelPlaceholder')}
            disabled={disabled}
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introCtaUrl')}</span>
          <Input
            value={model.ctaUrl}
            onChange={(e) => setField('ctaUrl', e.target.value)}
            placeholder={t('categories.detail.introCtaUrlPlaceholder')}
            disabled={disabled}
            maxLength={300}
          />
        </label>
      </fieldset>
      </CollapsibleSection>
        </div>
      </TabsContent>

      <TabsContent value="advanced" className="flex flex-col gap-4">
        <Alert tone="warning" size="sm">
          {t('categories.detail.introAdvancedWarning')}
        </Alert>
        <FormField
          label={t('categories.detail.introAdvancedLabel')}
          helper={t('categories.detail.introAdvancedHint')}
        >
          <Textarea
            className="font-mono text-xs"
            aria-label={t('categories.detail.introAdvancedLabel')}
            placeholder={t('categories.detail.introAdvancedPlaceholder')}
            value={html}
            onChange={(e) => updateAdvancedHtml(e.target.value)}
            disabled={disabled}
            rows={10}
            maxLength={INTRO_CONTENT_MAX_LENGTH}
          />
        </FormField>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('categories.detail.introAdvancedPreviewLabel')}
          </label>
          {html.trim() ? (
            <div
              className="size-guide-preview overflow-x-auto rounded-sm border border-border bg-surface p-3"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('categories.detail.introAdvancedPreviewEmpty')}</p>
          )}
        </div>
      </TabsContent>
      </Tabs>
      {aiReview ? (
        <Modal
          open
          onClose={() => setAiReview(null)}
          title={t('categories.detail.introAiReviewTitle')}
          description={t('categories.detail.introAiReviewDescription')}
          wide
          actions={(
            <>
              <Button type="button" variant="secondary" onClick={() => setAiReview(null)}>
                {t('categories.detail.introAiReviewCancel')}
              </Button>
              <Button type="button" onClick={confirmAiReview} disabled={aiReview.errors.length > 0}>
                {t('categories.detail.introAiReviewConfirm')}
              </Button>
            </>
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[var(--admin-radius-sm)] border border-border bg-surface-raised p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('categories.detail.introAiReviewReceived')}
                </p>
                {aiReviewReceived.length ? (
                  <ul className="m-0 list-disc space-y-1 pl-4 text-sm text-foreground">
                    {aiReviewReceived.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p className="m-0 text-sm text-muted-foreground">{t('categories.detail.introAiReviewNone')}</p>}
              </div>
              <div className="rounded-[var(--admin-radius-sm)] border border-border bg-surface-raised p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('categories.detail.introAiReviewPreserved')}
                </p>
                {aiReviewPreserved.length ? (
                  <ul className="m-0 list-disc space-y-1 pl-4 text-sm text-foreground">
                    {aiReviewPreserved.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : <p className="m-0 text-sm text-muted-foreground">{t('categories.detail.introAiReviewNone')}</p>}
              </div>
              <div className="rounded-[var(--admin-radius-sm)] border border-border bg-surface-raised p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('categories.detail.introAiReviewIgnored')}
                </p>
                {aiReview.ignored.length ? (
                  <ul className="m-0 list-disc space-y-1 pl-4 text-sm text-foreground">
                    {aiReview.ignored.map((item, index) => <li key={`${item}-${index}`}>{formatIgnoredItem(item)}</li>)}
                  </ul>
                ) : <p className="m-0 text-sm text-muted-foreground">{t('categories.detail.introAiReviewNone')}</p>}
              </div>
            </div>
            {aiReview.errors.length ? (
              <Alert tone="danger" size="sm">
                <p className="m-0">{t('categories.detail.introAiReviewTooLong')}</p>
                <ul className="m-0 mt-1 list-disc space-y-1 pl-4">
                  {aiReview.errors.map((error) => <li key={error}>{formatAiError(error)}</li>)}
                </ul>
              </Alert>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  )
}
