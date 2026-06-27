import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, X as XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { parseIntro, serializeIntro, emptyFaq } from '@/lib/categoryIntro'

/**
 * Ô "Nội dung đầu trang danh mục" — nhập theo FORM CHUYÊN cho khối `bb-cat-intro`
 * (giới thiệu + thương hiệu / câu hỏi thường gặp / nút Zalo). HTML (`introContent`) vẫn là nguồn
 * web render: form parse HTML → model khi nạp, serialize model → HTML mỗi lần sửa. Chỉ phát
 * onChange khi NGƯỜI DÙNG sửa (không tự ghi đè khi mới mở) — `lastHtml` chặn vòng lặp.
 */
export function IntroContentField({ value, onChange, disabled, lang = 'vi' }) {
  const { t } = useTranslation()
  const html = value || ''
  const [model, setModel] = useState(() => parseIntro(html))
  const [brandInput, setBrandInput] = useState('')
  const lastHtml = useRef(html)

  useEffect(() => {
    if (html !== lastHtml.current) {
      lastHtml.current = html
      setModel(parseIntro(html))
    }
  }, [html])

  function commit(next) {
    const cleaned = { ...next, _legacy: false }
    setModel(cleaned)
    const serialized = serializeIntro(cleaned, lang)
    lastHtml.current = serialized
    onChange(serialized)
  }

  const setField = (field, v) => commit({ ...model, [field]: v })

  const addFaq = () => commit({ ...model, faqs: [...model.faqs, emptyFaq()] })
  const updateFaq = (i, field, v) =>
    commit({ ...model, faqs: model.faqs.map((f, idx) => (idx === i ? { ...f, [field]: v } : f)) })
  const removeFaq = (i) => commit({ ...model, faqs: model.faqs.filter((_, idx) => idx !== i) })
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

  return (
    <div className="flex flex-col gap-4">
      {model._legacy && (
        <p className="rounded-[var(--admin-radius-xs)] border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {t('categories.detail.introLegacyWarning')}
        </p>
      )}

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
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('categories.detail.introText')}</span>
          <Textarea
            value={model.intro}
            onChange={(e) => setField('intro', e.target.value)}
            placeholder={t('categories.detail.introTextPlaceholder')}
            disabled={disabled}
            rows={4}
            maxLength={2000}
          />
        </label>
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
                  <button
                    type="button"
                    onClick={() => removeBrand(i)}
                    disabled={disabled}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={t('categories.detail.introBrandRemove')}
                  >
                    <XIcon size={12} aria-hidden="true" />
                  </button>
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

      {/* Phần 2: Câu hỏi thường gặp */}
      <fieldset className={sectionClass} disabled={disabled}>
        <legend className={legendClass}>{t('categories.detail.introSectionFaq')}</legend>
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
            <Textarea
              value={faq.answer}
              onChange={(e) => updateFaq(i, 'answer', e.target.value)}
              placeholder={t('categories.detail.introFaqAnswerPlaceholder')}
              disabled={disabled}
              rows={3}
              maxLength={1500}
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addFaq} disabled={disabled} className="self-start">
          <Plus size={14} aria-hidden="true" /> {t('categories.detail.introFaqAdd')}
        </Button>
      </fieldset>

      {/* Phần 3: Nút liên hệ */}
      <fieldset className={sectionClass} disabled={disabled}>
        <legend className={legendClass}>{t('categories.detail.introSectionCta')}</legend>
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
    </div>
  )
}
