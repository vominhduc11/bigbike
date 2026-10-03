import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderTree, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StatePanel } from '../components/StatePanel'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { displayValue as unquote } from './settings/constants'
import {
  BANNER_PAGES,
  EDITABLE_BANNER_KEYS,
  HERO_SYSTEM_BG,
  HERO_SYSTEM_ILLUSTRATION,
  bannerImageSource,
  bannerPreviewTitle,
  heroPreviewGeometry,
  resolveBannerPreviewUrl,
} from './settings/bannerSettings'
import { fetchSettings, batchUpdateSettings, mapValidationErrors } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { setContentLang, useContentLang } from '@/lib/contentLang'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DetailSection } from '@/components/DetailSection'
import { FormField, ScreenHeader, StickyActionBar } from '@/components/layout'

// The same storefront canvas is scaled uniformly into the admin panel.
function PreviewImage({ src, kind, className, t }) {
  const [status, setStatus] = useState('loading')
  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        data-banner-image={kind}
        data-image-status={status}
        className={`${className} ${status === 'ready' ? '' : 'invisible'}`}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
      />
      {status !== 'ready' ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted p-4 text-sm text-muted-foreground"
          role={status === 'error' ? 'alert' : 'status'}
        >
          {t(status === 'error' ? 'imageInput.previewError' : 'imageInput.previewLoading')}
        </div>
      ) : null}
    </>
  )
}

function BannerPreview({ bg, illustration, title, t }) {
  const panelRef = useRef(null)
  const [dimensions, setDimensions] = useState(() => ({
    viewport: window.innerWidth,
    panel: window.innerWidth,
  }))
  useEffect(() => {
    const panel = panelRef.current
    const measure = () => {
      const viewport = window.innerWidth
      const width = panel.clientWidth
      setDimensions((previous) =>
        previous.viewport === viewport && previous.panel === width
          ? previous
          : { viewport, panel: width },
      )
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(panel)
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const geometry = heroPreviewGeometry(dimensions.viewport, dimensions.panel)
  return (
    <div
      ref={panelRef}
      data-banner-preview
      data-source-height={geometry.sourceHeight}
      className="relative w-full overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-muted"
      style={{ height: geometry.height }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left overflow-hidden"
        style={{
          width: dimensions.viewport,
          height: geometry.sourceHeight,
          transform: `scale(${geometry.scale})`,
        }}
      >
        <PreviewImage
          key={bg.src}
          src={bg.src}
          kind="background"
          className="absolute inset-0 h-full w-full object-cover object-center"
          t={t}
        />
        <div
          className="relative mx-auto flex h-full items-center"
          style={{ width: geometry.railWidth }}
        >
          <div className={geometry.desktop ? 'w-1/2' : 'w-full px-4'}>
            <div
              data-banner-title
              className="m-0 text-xl font-semibold leading-tight text-[var(--bb-text-onsidebar-strong)] md:text-2xl"
            >
              {title}
            </div>
            <div className="mt-2 text-sm text-[var(--bb-text-onsidebar-strong)]">
              Bigbike.vn / {title}
            </div>
          </div>
          {geometry.desktop ? (
            <div
              data-banner-illustration
              className="absolute bottom-0 right-4 h-100"
              style={{ width: Math.min(geometry.railWidth / 2, 451) }}
            >
              <PreviewImage
                key={illustration.src}
                src={illustration.src}
                kind="illustration"
                className="absolute inset-0 h-full w-full object-contain"
                t={t}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Source badge (riêng / mặc định / hệ thống) ──────────────────────────────
function SourceBadge({ source, t }) {
  if (source === 'own') return null
  const isDefault = source === 'default'
  return (
    <Badge variant={isDefault ? 'warning' : 'muted'}>
      {isDefault ? t('banners.usingDefault') : t('banners.usingFallback')}
    </Badge>
  )
}

// ── Một ô ảnh ───────────────────────────────────────────────────────────────
function ImageField({
  label,
  hint,
  value,
  onChange,
  alt,
  onAltChange,
  recommend,
  disabled,
  badge,
  error,
}) {
  return (
    <FormField
      label={
        <span className="flex items-center gap-2">
          {label}
          {badge}
        </span>
      }
      helper={hint}
    >
      <ImageUrlInput
        value={value}
        previewUrl={resolveBannerPreviewUrl(value)}
        onChange={onChange}
        alt={alt}
        onAltChange={onAltChange}
        previewAlt={alt}
        recommend={recommend}
        disabled={disabled}
        error={error}
      />
    </FormField>
  )
}

// ── Một ô chữ theo ngôn ngữ nội dung đang chọn ở header ─────────────────────
function TextField({ fieldKey, label, value, onChange, disabled, contentLang, error }) {
  const controlId = `banner-${fieldKey}-${contentLang}`
  return (
    <FormField label={label} htmlFor={controlId} error={error}>
      <Input
        id={controlId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={1000}
      />
    </FormField>
  )
}

// ── Thẻ một trang ────────────────────────────────────────────────────────────
function PageBannerCard({
  page,
  get,
  getEn,
  set,
  setEn,
  defaults,
  canUpdate,
  contentLang,
  t,
  errors,
  errorsEn,
}) {
  const k = (suffix) => `${page.prefix}_${suffix}`
  const ownBg = get(k('image_url'))
  const ownIllu = get(k('illustration_url'))
  const activeValue = contentLang === 'en' ? getEn : get
  const activeSet = contentLang === 'en' ? setEn : set
  const activeErrors = contentLang === 'en' ? errorsEn : errors
  const pageTitle = t(page.titleKey)

  const bg = bannerImageSource(ownBg, defaults.bg, HERO_SYSTEM_BG)
  const illustration = bannerImageSource(ownIllu, defaults.illustration, HERO_SYSTEM_ILLUSTRATION)
  const previewTitle = bannerPreviewTitle(
    get(k('title')),
    getEn(k('title')),
    contentLang,
    t(page.titleKey, { lng: contentLang }),
  )

  return (
    <DetailSection title={pageTitle} headingLevel={3} contentClassName="bb-form-grid">
      <BannerPreview bg={bg} illustration={illustration} title={previewTitle} t={t} />

      <TextField
        fieldKey={k('title')}
        label={t('banners.fieldTitle')}
        value={activeValue(k('title'))}
        onChange={(v) => activeSet(k('title'), v)}
        disabled={!canUpdate}
        contentLang={contentLang}
        t={t}
        error={activeErrors[k('title')]}
      />

      <div className="bb-form-grid bb-form-grid-2">
        <ImageField
          label={t('banners.fieldBgDesktop')}
          hint={t('banners.hintBgDesktop')}
          value={ownBg}
          onChange={(url) => set(k('image_url'), url)}
          alt={activeValue(k('image_alt'))}
          onAltChange={(alt) => activeSet(k('image_alt'), alt)}
          recommend={IMAGE_RECO.bannerWide}
          disabled={!canUpdate}
          badge={<SourceBadge source={bg.source} t={t} />}
          error={errors[k('image_url')]}
        />
        <ImageField
          label={t('banners.fieldIllustration')}
          hint={t('banners.hintIllustration')}
          value={ownIllu}
          onChange={(url) => set(k('illustration_url'), url)}
          recommend={IMAGE_RECO.illustration}
          disabled={!canUpdate}
          badge={<SourceBadge source={illustration.source} t={t} />}
          error={errors[k('illustration_url')]}
        />
      </div>
      <TextField
        fieldKey={k('image_alt')}
        label={t('banners.fieldAlt')}
        value={activeValue(k('image_alt'))}
        onChange={(v) => activeSet(k('image_alt'), v)}
        disabled={!canUpdate}
        contentLang={contentLang}
        t={t}
        error={activeErrors[k('image_alt')]}
      />
    </DetailSection>
  )
}

// ── Thẻ ảnh mặc định chung ───────────────────────────────────────────────────
function DefaultsCard({ get, set, canUpdate, t, errors }) {
  return (
    <DetailSection
      title={t('banners.defaultsTitle')}
      description={t('banners.defaultsDesc')}
      headingLevel={3}
      contentClassName="bb-form-grid"
    >
      <div className="bb-form-grid bb-form-grid-2">
        <ImageField
          label={t('banners.defaultBg')}
          hint={t('banners.hintBgDesktop')}
          value={get('hero_default_bg_url')}
          onChange={(url) => set('hero_default_bg_url', url)}
          recommend={IMAGE_RECO.bannerWide}
          disabled={!canUpdate}
          error={errors['hero_default_bg_url']}
        />
        <ImageField
          label={t('banners.defaultIllustration')}
          hint={t('banners.hintIllustration')}
          value={get('hero_default_illustration_url')}
          onChange={(url) => set('hero_default_illustration_url', url)}
          recommend={IMAGE_RECO.illustration}
          disabled={!canUpdate}
          error={errors['hero_default_illustration_url']}
        />
      </div>
    </DetailSection>
  )
}

// ── Thẻ liên kết tới banner ở nơi khác ───────────────────────────────────────
function CrossLinksCard({ navigate, t }) {
  return (
    <DetailSection
      title={t('banners.elsewhereTitle')}
      headingLevel={3}
      contentClassName="bb-link-card-list"
    >
      <div className="bb-link-card-item">
        <div className="bb-link-card-copy">
          <FolderTree size={18} className="bb-link-card-icon" />
          <div>
            <div className="bb-link-card-title">{t('banners.categoryLinkTitle')}</div>
            <div className="bb-link-card-desc">{t('banners.categoryLinkDesc')}</div>
          </div>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => navigate('/admin/categories')}
        >
          {t('banners.openCategories')}
        </Button>
      </div>
    </DetailSection>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
// `embedded` = render bên trong một tab của màn Cài đặt: bỏ tiêu đề trang riêng
// (tránh trùng heading), chỉ giữ phần mô tả ngắn để có ngữ cảnh.
export function BannerScreen({
  canUpdate = false,
  navigate,
  embedded = false,
  onEditorStateChange,
}) {
  const { t } = useTranslation()
  const contentLang = useContentLang()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState({})
  const [draftsEn, setDraftsEn] = useState({})
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Lỗi gắn theo từng field (key cài đặt) khi lưu thất bại do validate ở backend.
  const [fieldErrors, setFieldErrors] = useState({})
  const [fieldErrorsEn, setFieldErrorsEn] = useState({})

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings })
  const settingsData = settingsQuery.data
  const state = {
    status: settingsQuery.isPending
      ? 'loading'
      : settingsQuery.isError && !settingsData
        ? 'error'
        : 'success',
    items: settingsData?.items || [],
    warning: settingsData?.warning || '',
    error: settingsQuery.error?.message || '',
  }

  const byKey = useMemo(() => {
    const m = new Map()
    for (const s of state.items) m.set(s.key, s)
    return m
  }, [state.items])

  const get = useCallback(
    (key) => (drafts[key] !== undefined ? drafts[key] : unquote(byKey.get(key)?.value)),
    [drafts, byKey],
  )
  const getEn = useCallback(
    (key) => (draftsEn[key] !== undefined ? draftsEn[key] : unquote(byKey.get(key)?.valueEn)),
    [draftsEn, byKey],
  )
  const set = useCallback(
    (key, value) => {
      if (!canUpdate || savingRef.current) return
      setDrafts((previous) => ({ ...previous, [key]: value }))
      setFieldErrors((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
      setSaveError('')
      setSaveSuccess(false)
    },
    [canUpdate],
  )
  const setEn = useCallback(
    (key, value) => {
      if (!canUpdate || savingRef.current) return
      setDraftsEn((previous) => ({ ...previous, [key]: value }))
      setFieldErrorsEn((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
      setSaveError('')
      setSaveSuccess(false)
    },
    [canUpdate],
  )

  const dirtyKeys = useMemo(() => {
    const keys = new Set()
    for (const [k, v] of Object.entries(drafts)) if (v !== unquote(byKey.get(k)?.value)) keys.add(k)
    for (const [k, v] of Object.entries(draftsEn))
      if (v !== unquote(byKey.get(k)?.valueEn)) keys.add(k)
    return [...keys].filter((key) => EDITABLE_BANNER_KEYS.has(key))
  }, [drafts, draftsEn, byKey])

  useEffect(() => {
    onEditorStateChange?.({
      dirtyCount: dirtyKeys.length,
      saving,
      saveSuccess,
      error: saveError,
    })
  }, [dirtyKeys.length, onEditorStateChange, saveError, saveSuccess, saving])

  // F6: cảnh báo khi rời trang lúc còn thay đổi chưa lưu. Đăng ký nav guard nên
  // mọi điều hướng nội bộ qua navigate() (gồm 2 nút trong CrossLinksCard) sẽ hỏi
  // xác nhận, và beforeunload lo reload / đóng tab / điều hướng ra ngoài.
  useUnsavedChanges(dirtyKeys.length > 0)

  const defaults = {
    bg: get('hero_default_bg_url'),
    illustration: get('hero_default_illustration_url'),
  }
  const hasErrorsInOtherLanguage = Object.keys(
    contentLang === 'en' ? fieldErrors : fieldErrorsEn,
  ).some((key) =>
    BANNER_PAGES.some(({ prefix }) => key === `${prefix}_title` || key === `${prefix}_image_alt`),
  )

  const clearDrafts = useCallback(() => {
    setDrafts({})
    setDraftsEn({})
    setSaveError('')
    setFieldErrors({})
    setFieldErrorsEn({})
  }, [])

  // F5: huỷ là hành động phá huỷ (xoá mọi thay đổi chưa lưu, có thể nhiều field × 3
  // trang) nên xác nhận trước khi xoá.
  const handleDiscard = useCallback(async () => {
    if (savingRef.current) return
    if (dirtyKeys.length > 0) {
      const ok = await showConfirm(
        t('banners.discardConfirm', {
          defaultValue: 'Huỷ mọi thay đổi chưa lưu? Các chỉnh sửa sẽ bị mất.',
        }),
        t('banners.discardConfirmTitle', { defaultValue: 'Huỷ thay đổi banner' }),
      )
      if (!ok) return
    }
    if (!savingRef.current) clearDrafts()
  }, [dirtyKeys, clearDrafts, t])

  const handleSave = useCallback(async () => {
    if (!canUpdate || savingRef.current || dirtyKeys.length === 0) return
    savingRef.current = true
    setSaving(true)
    setSaveSuccess(false)
    setSaveError('')
    setFieldErrors({})
    setFieldErrorsEn({})
    const updates = dirtyKeys.map((key) => {
      const u = { key }
      if (drafts[key] !== undefined && drafts[key] !== unquote(byKey.get(key)?.value))
        u.value = drafts[key]
      if (draftsEn[key] !== undefined && draftsEn[key] !== unquote(byKey.get(key)?.valueEn))
        u.valueEn = draftsEn[key]
      return u
    })
    try {
      const result = await batchUpdateSettings(updates)
      queryClient.setQueryData(['settings'], (previous) => {
        const updated = new Map(result.items.map((item) => [item.key, item]))
        return { ...previous, items: (previous?.items || []).map((s) => updated.get(s.key) || s) }
      })
      queryClient.invalidateQueries({ queryKey: ['settings'], refetchType: 'none' })
      const dropSubmitted = (previous, field) => {
        const next = { ...previous }
        for (const update of updates) {
          if (update[field] !== undefined && next[update.key] === update[field])
            delete next[update.key]
        }
        return next
      }
      setDrafts((previous) => dropSubmitted(previous, 'value'))
      setDraftsEn((previous) => dropSubmitted(previous, 'valueEn'))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      // F1: backend validate theo từng update (updates.N.value / updates.N.valueEn).
      // Gắn lỗi về đúng key cài đặt qua thứ tự dirtyKeys để hiện ngay dưới field.
      const detailMap = mapValidationErrors(e, t)
      const byKey = {}
      const byKeyEn = {}
      const formErrors = []
      for (const [path, msg] of Object.entries(detailMap)) {
        const m = /^updates\.(\d+)\.(value|valueEn|key)$/.exec(path)
        const key = m && updates[Number(m[1])]?.key
        if (!key) {
          formErrors.push(msg)
          continue
        }
        if (m[2] === 'valueEn' || (m[2] === 'key' && updates[Number(m[1])].value === undefined))
          byKeyEn[key] = msg
        else byKey[key] = msg
      }
      setFieldErrors(byKey)
      setFieldErrorsEn(byKeyEn)
      setSaveError(
        formErrors.join(' ') ||
          (Object.keys(byKey).length + Object.keys(byKeyEn).length > 0
            ? t('banners.checkFields')
            : e.message || t('banners.saveError')),
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [canUpdate, dirtyKeys, drafts, draftsEn, byKey, queryClient, t])

  if (state.status === 'loading') {
    return (
      <StatePanel tone="info" title={t('banners.loading')} description={t('common.pleaseWait')} />
    )
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('banners.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => settingsQuery.refetch()}
      />
    )
  }

  return (
    <div>
      {!embedded ? <ScreenHeader group="content" title={t('banners.title')} /> : null}

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {!embedded && !canUpdate && !state.warning && (
        <ReadOnlyBanner warning={t('banners.readOnlyHint')} />
      )}

      <div className="bb-stack">
        {BANNER_PAGES.map((page) => (
          <PageBannerCard
            key={page.prefix}
            page={page}
            get={get}
            getEn={getEn}
            set={set}
            setEn={setEn}
            defaults={defaults}
            canUpdate={canUpdate && !saving}
            contentLang={contentLang}
            t={t}
            errors={fieldErrors}
            errorsEn={fieldErrorsEn}
          />
        ))}
        <DefaultsCard
          get={get}
          set={set}
          canUpdate={canUpdate && !saving}
          t={t}
          errors={fieldErrors}
        />
        <CrossLinksCard navigate={navigate} t={t} />
        {hasErrorsInOtherLanguage ? (
          <div role="alert" className="flex items-center gap-2 text-sm text-danger">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setContentLang(contentLang === 'en' ? 'vi' : 'en')}
            >
              {t('banners.reviewOtherLanguage', { language: contentLang === 'en' ? 'VI' : 'EN' })}
            </Button>
          </div>
        ) : null}
      </div>

      {canUpdate && (dirtyKeys.length > 0 || saving || saveSuccess || saveError) && (
        <StickyActionBar
          ariaLabel={t('common.actionBarLabel')}
          info={
            <span
              className={
                saveError
                  ? 'inline-flex items-center gap-2 font-semibold text-danger'
                  : 'inline-flex items-center gap-2 text-muted-foreground'
              }
              role={saveError ? 'alert' : 'status'}
            >
              {saveError ? (
                <>
                  <AlertCircle size={14} aria-hidden="true" /> {saveError}
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 size={15} className="text-success" aria-hidden="true" />{' '}
                  {t('banners.saveSuccess')}
                </>
              ) : (
                <>
                  <AlertCircle size={14} aria-hidden="true" />{' '}
                  {t('banners.unsavedCount', { count: dirtyKeys.length })}
                </>
              )}
            </span>
          }
        >
          {dirtyKeys.length > 0 ? (
            <Button
              className="min-h-11"
              variant="secondary"
              onClick={handleDiscard}
              disabled={saving}
            >
              {t('common.cancel')}
            </Button>
          ) : null}
          <Button
            className="min-h-11"
            onClick={handleSave}
            loading={saving}
            disabled={saving || dirtyKeys.length === 0}
          >
            {t('common.save')}
          </Button>
        </StickyActionBar>
      )}
    </div>
  )
}

export default BannerScreen
