import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderTree, FileText, ImageIcon, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { ImageUrlInput } from '../components/ImageUrlInput'
import { IMAGE_RECO } from '../lib/imageRecommendations'
import { fetchSettings, batchUpdateSettings, mapValidationErrors } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { resolveDisplayUrl } from '@/lib/contracts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Storefront base — dùng để mở "Xem trên web" và để preview ảnh fallback cứng của theme
// (các ảnh /wp-content/... chỉ tồn tại ở app web, không có trong admin).
const STOREFRONT_BASE = (import.meta.env.VITE_STOREFRONT_BASE_URL ?? 'https://bigbike.vn').replace(/\/$/, '')

// Ảnh fallback cứng baked trong WpCategoryHero (bigbike-web). Chỉ hiển thị khi cả ảnh riêng
// lẫn ảnh mặc định chung đều trống — khớp đúng những gì khách thấy.
const THEME_FALLBACK_BG = '/wp-content/themes/bigbike/images/page-title-bg.png'
const THEME_FALLBACK_ILLUSTRATION = '/wp-content/themes/bigbike/images/mu-bao-hiem.png'

// 3 trang listing không có PageEntity — mỗi trang một bộ key trong group public_hero.
const PAGES = [
  { prefix: 'hero_products', title: 'Tất cả sản phẩm', path: '/san-pham' },
  { prefix: 'hero_brands', title: 'Thương hiệu', path: '/brands' },
  { prefix: 'hero_news', title: 'Tin tức', path: '/tin-tuc' },
]

// Một số giá trị về từ backend có thể bị bọc dấu nháy — gỡ cho sạch trước khi hiển thị.
function unquote(val) {
  if (typeof val === 'string' && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1)
  }
  return val ?? ''
}

// URL để preview: ảnh đã cấu hình → resolveDisplayUrl (rewrite MinIO → /media-proxy);
// ảnh fallback theme → ghép STOREFRONT_BASE vì asset đó nằm ở app web.
function previewSrc(url, { themeAsset = false } = {}) {
  const v = (url || '').trim()
  if (!v) return ''
  if (themeAsset && v.startsWith('/')) return STOREFRONT_BASE + v
  return resolveDisplayUrl(v)
}

// ── Banner preview (composite) ──────────────────────────────────────────────
// Ráp nền + gear + tiêu đề như WpCategoryHero để admin thấy đúng kết quả thật.
function BannerPreview({ bg, illustration, title }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--admin-radius-md)] border border-[var(--bb-border)] bg-[var(--bb-sidebar)]"
      style={{ aspectRatio: '1920 / 460' }}
    >
      {bg.src ? (
        <img src={bg.src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" aria-hidden="true" />
      <div className="absolute inset-y-0 left-0 flex flex-col justify-center gap-1 px-4 sm:px-6">
        <span className="text-base font-bold leading-tight text-white drop-shadow sm:text-xl">{title}</span>
        <span className="text-xs text-white/80">Bigbike.vn / {title}</span>
      </div>
      {illustration.src ? (
        <img
          src={illustration.src}
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 right-2 h-[88%] w-auto object-contain sm:right-4"
          loading="lazy"
        />
      ) : null}
    </div>
  )
}

// ── Source badge (riêng / mặc định / hệ thống) ──────────────────────────────
function SourceBadge({ source, t }) {
  if (source === 'own') return null
  const isDefault = source === 'default'
  return (
    <span
      className="bb-badge"
      style={{
        background: isDefault ? 'var(--bb-warning-bg)' : 'var(--bb-surface-muted)',
        color: isDefault ? 'var(--bb-warning)' : 'var(--bb-text-muted)',
      }}
    >
      {isDefault ? t('banners.usingDefault') : t('banners.usingFallback')}
    </span>
  )
}

// ── Một ô ảnh ───────────────────────────────────────────────────────────────
function ImageField({ label, hint, value, onChange, recommend, disabled, badge, error }) {
  return (
    <div className="form-field">
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {label}
        {badge}
      </span>
      <ImageUrlInput value={value} onChange={onChange} recommend={recommend} disabled={disabled} error={error} />
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

// ── Một ô chữ (VI + EN) ─────────────────────────────────────────────────────
function TextField({ label, value, valueEn, onChange, onChangeEn, onBlur, disabled, t, error, errorEn }) {
  return (
    <div className="form-field">
      <span>{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled} aria-invalid={error ? true : undefined} />
      {error && <small className="field-error" role="alert">{error}</small>}
      <span className="hint" style={{ marginTop: 6 }}>{t('banners.englishLabel')}</span>
      <Input value={valueEn} onChange={(e) => onChangeEn(e.target.value)} disabled={disabled} className="mt-1" aria-invalid={errorEn ? true : undefined} />
      {errorEn && <small className="field-error" role="alert">{errorEn}</small>}
    </div>
  )
}

// ── Thẻ một trang ────────────────────────────────────────────────────────────
function PageBannerCard({ page, get, getEn, set, setEn, defaults, canUpdate, t, errors, errorsEn }) {
  const k = (suffix) => `${page.prefix}_${suffix}`


  const ownBg = get(k('image_url'))
  const ownIllu = get(k('illustration_url'))

  // Cascade preview: ảnh riêng → mặc định chung → fallback theme.
  const bg = ownBg
    ? { src: previewSrc(ownBg), source: 'own' }
    : defaults.bg
      ? { src: previewSrc(defaults.bg), source: 'default' }
      : { src: previewSrc(THEME_FALLBACK_BG, { themeAsset: true }), source: 'fallback' }
  const illustration = ownIllu
    ? { src: previewSrc(ownIllu), source: 'own' }
    : defaults.illustration
      ? { src: previewSrc(defaults.illustration), source: 'default' }
      : { src: previewSrc(THEME_FALLBACK_ILLUSTRATION, { themeAsset: true }), source: 'fallback' }

  return (
    <div className="bb-card">
      <div className="bb-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3>{page.title}</h3>
      </div>
      <div className="bb-card-body" style={{ display: 'grid', gap: 16 }}>
        <BannerPreview bg={bg} illustration={illustration} title={get(k('title')) || page.title} />

        <TextField
          label={t('banners.fieldTitle')}
          value={get(k('title'))}
          valueEn={getEn(k('title'))}
          onChange={(v) => set(k('title'), v)}
          onChangeEn={(v) => setEn(k('title'), v)}
          disabled={!canUpdate}
          t={t}
          error={errors[k('title')]}
          errorEn={errorsEn[k('title')]}
        />

        <div style={{ display: 'grid', gap: 16 }} className="md:grid-cols-2">
          <ImageField
            label={t('banners.fieldBgDesktop')}
            hint={t('banners.hintBgDesktop')}
            value={ownBg}
            onChange={(url) => set(k('image_url'), url)}
            recommend={IMAGE_RECO.bannerWide}
            disabled={!canUpdate}
            badge={<SourceBadge source={bg.source} t={t} />}
            error={errors[k('image_url')]}
          />
          <ImageField
            label={t('banners.fieldBgMobile')}
            hint={t('banners.hintBgMobile')}
            value={get(k('mobile_image_url'))}
            onChange={(url) => set(k('mobile_image_url'), url)}
            recommend={IMAGE_RECO.heroMobile}
            disabled={!canUpdate}
            error={errors[k('mobile_image_url')]}
          />
        </div>

        <div style={{ display: 'grid', gap: 16 }} className="md:grid-cols-2">
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
      </div>
    </div>
  )
}

// ── Thẻ ảnh mặc định chung ───────────────────────────────────────────────────
function DefaultsCard({ get, set, canUpdate, t, errors }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header"><h3>{t('banners.defaultsTitle')}</h3></div>
      <div className="bb-card-body" style={{ display: 'grid', gap: 16 }}>
        <p className="bb-muted" style={{ fontSize: 13, margin: 0 }}>{t('banners.defaultsDesc')}</p>
        <div style={{ display: 'grid', gap: 16 }} className="md:grid-cols-2">
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
      </div>
    </div>
  )
}

// ── Thẻ liên kết tới banner ở nơi khác ───────────────────────────────────────
function CrossLinksCard({ navigate, t }) {
  return (
    <div className="bb-card">
      <div className="bb-card-header"><h3>{t('banners.elsewhereTitle')}</h3></div>
      <div className="bb-card-body" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <FolderTree size={18} style={{ marginTop: 4, color: 'var(--bb-text-muted)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('banners.categoryLinkTitle')}</div>
              <div className="bb-muted" style={{ fontSize: 12 }}>{t('banners.categoryLinkDesc')}</div>
            </div>
          </div>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => navigate('/admin/categories')}>
            {t('banners.openCategories')}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <FileText size={18} style={{ marginTop: 4, color: 'var(--bb-text-muted)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('banners.contentLinkTitle')}</div>
              <div className="bb-muted" style={{ fontSize: 12 }}>{t('banners.contentLinkDesc')}</div>
            </div>
          </div>
          <button type="button" className="bb-btn bb-btn-secondary bb-btn-sm" onClick={() => navigate('/admin/content')}>
            {t('banners.openContent')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
// `embedded` = render bên trong một tab của màn Cài đặt: bỏ tiêu đề trang riêng
// (tránh trùng heading), chỉ giữ phần mô tả ngắn để có ngữ cảnh.
export function BannerScreen({ canUpdate = false, navigate, embedded = false }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [fetchKey, setFetchKey] = useState(0)
  const [drafts, setDrafts] = useState({})
  const [draftsEn, setDraftsEn] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  // Lỗi gắn theo từng field (key cài đặt) khi lưu thất bại do validate ở backend.
  const [fieldErrors, setFieldErrors] = useState({})
  const [fieldErrorsEn, setFieldErrorsEn] = useState({})

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((r) => { if (active) setState({ status: 'success', items: r.items, warning: r.warning || '' }) })
      .catch((e) => { if (active) setState({ status: 'error', items: [], error: e.message }) })
    return () => { active = false }
  }, [fetchKey])

  const byKey = useMemo(() => {
    const m = new Map()
    for (const s of state.items) m.set(s.key, s)
    return m
  }, [state.items])

  const get = useCallback((key) => (drafts[key] !== undefined ? drafts[key] : unquote(byKey.get(key)?.value)), [drafts, byKey])
  const getEn = useCallback((key) => (draftsEn[key] !== undefined ? draftsEn[key] : unquote(byKey.get(key)?.valueEn)), [draftsEn, byKey])
  const set = useCallback((key, value) => setDrafts((p) => ({ ...p, [key]: value })), [])
  const setEn = useCallback((key, value) => setDraftsEn((p) => ({ ...p, [key]: value })), [])

  const dirtyKeys = useMemo(() => {
    const keys = new Set()
    for (const [k, v] of Object.entries(drafts)) if (v !== unquote(byKey.get(k)?.value)) keys.add(k)
    for (const [k, v] of Object.entries(draftsEn)) if (v !== unquote(byKey.get(k)?.valueEn)) keys.add(k)
    return [...keys]
  }, [drafts, draftsEn, byKey])

  // F6: cảnh báo khi rời trang lúc còn thay đổi chưa lưu. Đăng ký nav guard nên
  // mọi điều hướng nội bộ qua navigate() (gồm 2 nút trong CrossLinksCard) sẽ hỏi
  // xác nhận, và beforeunload lo reload / đóng tab / điều hướng ra ngoài.
  useUnsavedChanges(dirtyKeys.length > 0)

  const defaults = {
    bg: get('hero_default_bg_url'),
    illustration: get('hero_default_illustration_url'),
  }

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
    if (dirtyKeys.length > 0) {
      const ok = await showConfirm(
        t('banners.discardConfirm', { defaultValue: 'Huỷ mọi thay đổi chưa lưu? Các chỉnh sửa sẽ bị mất.' }),
        t('banners.discardConfirmTitle', { defaultValue: 'Huỷ thay đổi banner' }),
      )
      if (!ok) return
    }
    clearDrafts()
  }, [dirtyKeys, clearDrafts, t])

  const handleSave = useCallback(async () => {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError('')
    setFieldErrors({})
    setFieldErrorsEn({})
    try {
      const updates = dirtyKeys.map((key) => {
        const u = { key }
        if (drafts[key] !== undefined) u.value = drafts[key]
        if (draftsEn[key] !== undefined) u.valueEn = draftsEn[key]
        return u
      })
      const result = await batchUpdateSettings(updates)
      setState((p) => {
        const updated = new Map(result.items.map((item) => [item.key, item]))
        return { ...p, items: p.items.map((s) => updated.get(s.key) || s) }
      })
      setDrafts({})
      setDraftsEn({})
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      // F1: backend validate theo từng update (updates.N.value / updates.N.valueEn).
      // Gắn lỗi về đúng key cài đặt qua thứ tự dirtyKeys để hiện ngay dưới field.
      const detailMap = mapValidationErrors(e)
      const byKey = {}
      const byKeyEn = {}
      for (const [path, msg] of Object.entries(detailMap)) {
        const m = /^updates\.(\d+)\.(value|valueEn)$/.exec(path)
        if (!m) continue
        const key = dirtyKeys[Number(m[1])]
        if (!key) continue
        if (m[2] === 'valueEn') byKeyEn[key] = msg
        else byKey[key] = msg
      }
      setFieldErrors(byKey)
      setFieldErrorsEn(byKeyEn)
      setSaveError(e.message || t('banners.saveError'))
    } finally {
      setSaving(false)
    }
  }, [dirtyKeys, drafts, draftsEn, t])

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('banners.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('banners.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => setFetchKey((k) => k + 1)}
      />
    )
  }

  return (
    <div>
      {embedded ? (
        <p className="bb-muted" style={{ marginTop: 0, marginBottom: 16 }}>{t('banners.description')}</p>
      ) : (
        <div className="bb-screen-header">
          <div className="bb-screen-title">
            <p className="bb-screen-eyebrow">{t('banners.eyebrow')}</p>
            <h1>{t('banners.title')}</h1>
            <p className="bb-muted">{t('banners.description')}</p>
          </div>
        </div>
      )}

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      <div style={{ display: 'grid', gap: 24 }}>
        {PAGES.map((page) => (
          <PageBannerCard
            key={page.prefix}
            page={page}
            get={get}
            getEn={getEn}
            set={set}
            setEn={setEn}
            defaults={defaults}
            canUpdate={canUpdate}
            t={t}
            errors={fieldErrors}
            errorsEn={fieldErrorsEn}
          />
        ))}
        <DefaultsCard get={get} set={set} canUpdate={canUpdate} t={t} errors={fieldErrors} />
        <CrossLinksCard navigate={navigate} t={t} />
      </div>

      {canUpdate && (dirtyKeys.length > 0 || saveSuccess) && (
        <div
          className="bb-card"
          style={{
            position: 'sticky', bottom: 16, marginTop: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px',
          }}
        >
          <span
            className="bb-muted"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
              color: saveError ? 'var(--bb-danger)' : undefined,
            }}
            role={saveError ? 'alert' : undefined}
          >
            {saveError ? (
              <><AlertCircle size={14} style={{ color: 'var(--bb-danger)' }} /> {saveError}</>
            ) : saveSuccess ? (
              <><CheckCircle2 size={15} style={{ color: 'var(--bb-success)' }} /> {t('banners.saveSuccess')}</>
            ) : (
              <><AlertCircle size={14} /> {t('banners.unsavedCount', { count: dirtyKeys.length })}</>
            )}
          </span>
          <div className="flex gap-2">
            {dirtyKeys.length > 0 && (
              <Button variant="secondary" size="sm" onClick={handleDiscard} disabled={saving}>
                {t('common.cancel')}
              </Button>
            )}
            <Button size="sm" onClick={handleSave} loading={saving} disabled={dirtyKeys.length === 0}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default BannerScreen
