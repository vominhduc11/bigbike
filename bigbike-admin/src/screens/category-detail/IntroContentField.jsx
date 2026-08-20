import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FormField } from '@/components/layout/FormField'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import AiHtmlBrief from '@/components/AiHtmlBrief'
import { DeferredRichTextEditor } from '@/components/DeferredRichTextEditor'
import { showConfirm } from '../../lib/confirm'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { CATEGORY_INTRO_LIMITS, emptyIntro, emptyFaq, getIntroInputMode, parseIntro, patchIntroHtml } from '@/lib/categoryIntro'

const INTRO_CONTENT_MAX_LENGTH = 50000

/**
 * Ô "Nội dung đầu trang danh mục" có hai công cụ nhập trên cùng một field HTML:
 * form cấu trúc cho khối `bb-cat-intro` và ô nhập nâng cao giữ nguyên markup người viết dán vào.
 * HTML hiện có luôn là bản gốc. Form chỉ vá đúng trường được sửa; mở/chuyển tab không tự ghi đè.
 */
export function IntroContentField({ value, onChange, disabled, lang = 'vi', getAiPrompt }) {
  const { t } = useTranslation()
  const html = value || ''
  const [mode, setMode] = useState(() => getIntroInputMode(html))
  const [model, setModel] = useState(() => {
    const initialMode = getIntroInputMode(html)
    return initialMode === 'structured' ? parseIntro(html) : emptyIntro()
  })
  const [brandInput, setBrandInput] = useState('')
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

  function commitField(field, value) {
    const nextModel = { ...model, [field]: value, _legacy: false }
    setModel(nextModel)
    const nextHtml = patchIntroHtml(lastHtml.current, { field, value }, lang)
    lastHtml.current = nextHtml
    onChange(nextHtml)
  }

  function updateAdvancedHtml(nextHtml) {
    lastHtml.current = nextHtml
    onChange(nextHtml)
  }

  function changeMode(next) {
    if (next === mode) return

    if (next === 'structured') {
      const nextModel = parseIntro(html)
      setModel(nextModel)
      setBrandInput('')
      setFaqOpen(nextModel.faqs.length > 0)
      setCtaOpen(Boolean(nextModel.ctaText || nextModel.ctaLabel || nextModel.ctaUrl))
    }
    setMode(next)
  }

  const setField = (field, v) => commitField(field, v)

  const addFaq = () => commitField('faqs', [...model.faqs, emptyFaq()])
  const updateFaq = (i, field, v) =>
    commitField('faqs', model.faqs.map((f, idx) => (idx === i ? { ...f, [field]: v } : f)))
  // Xoá câu hỏi là mất nội dung đã nhập — xác nhận trước (không có Hoàn tác).
  const removeFaq = async (i) => {
    const ok = await showConfirm(
      t('categories.detail.introFaqRemoveConfirm', { defaultValue: 'Xoá câu hỏi này? Nội dung câu hỏi và câu trả lời sẽ bị xoá khỏi phần giới thiệu.' }),
      t('categories.detail.introFaqRemoveTitle', { defaultValue: 'Xoá câu hỏi thường gặp?' }),
      { variant: 'default', confirmLabel: t('common.delete') },
    )
    if (!ok) return
    commitField('faqs', model.faqs.filter((_, idx) => idx !== i))
  }
  const moveFaq = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= model.faqs.length) return
    const faqs = [...model.faqs]
    ;[faqs[i], faqs[j]] = [faqs[j], faqs[i]]
    commitField('faqs', faqs)
  }

  function addBrand() {
    const b = brandInput.trim()
    if (!b) return
    if (!model.brands.includes(b)) commitField('brands', [...model.brands, b])
    setBrandInput('')
  }
  const removeBrand = (i) => commitField('brands', model.brands.filter((_, idx) => idx !== i))

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
          <DeferredRichTextEditor
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
            <DeferredRichTextEditor
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
        <AiHtmlBrief
          prompt={t('categories.detail.introAiBriefPrompt')}
          getPrompt={getAiPrompt}
          title={t('categories.detail.introAiPromptTitle')}
          copyLabel={t('categories.detail.introAiPromptCopy')}
          copiedMessage={t('categories.detail.introAiPromptCopied')}
          copyFailedMessage={t('categories.detail.introAiPromptCopyFailed')}
        />
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
    </>
  )
}
