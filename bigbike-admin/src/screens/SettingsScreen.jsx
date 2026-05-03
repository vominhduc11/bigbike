import { useMemo, useEffect, useState, useCallback } from 'react'
import {
  Store, Phone, CreditCard, Truck, Tag, Globe, Settings,
  Shield, Home, Building2,
  CheckCircle2, AlertCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchSettings, updateSetting } from '../lib/adminApi'

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayValue(val) {
  if (typeof val === 'string' && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    return val.slice(1, -1)
  }
  return val ?? ''
}

const INPUT_TYPE_MAP = {
  email: 'email',
  url: 'url',
  href: 'url',
  phone: 'tel',
  hotline: 'tel',
  threshold: 'number',
  price: 'number',
  amount: 'number',
}

function inputTypeFor(key) {
  const k = key.toLowerCase()
  for (const [seg, type] of Object.entries(INPUT_TYPE_MAP)) {
    if (k.includes(seg)) return type
  }
  return 'text'
}

const PLACEHOLDER_MAP = {
  email: 'vd: contact@bigbike.vn',
  url: 'vd: https://bigbike.vn/...',
  href: 'vd: https://bigbike.vn/...',
  phone: 'vd: 0901 234 567',
  hotline: 'vd: 0901 234 567',
  name: 'vd: BigBike Store',
  threshold: 'vd: 2000000',
  price: 'vd: 500000',
}

function placeholderFor(key) {
  const k = key.toLowerCase()
  for (const [seg, ph] of Object.entries(PLACEHOLDER_MAP)) {
    if (k.includes(seg)) return ph
  }
  return ''
}

function validateValue(key, value) {
  if (!value) return null
  const k = key.toLowerCase()
  if (k.includes('email')) {
    if (!value.includes('@')) return 'Nhập đúng định dạng email, vd: ten@bigbike.vn'
  }
  if (k.includes('url') || k.includes('href')) {
    if (!value.startsWith('http://') && !value.startsWith('https://') && !value.startsWith('/')) {
      return 'Nhập đường dẫn web đầy đủ, vd: https://bigbike.vn/khuyen-mai'
    }
  }
  if (k.includes('hotline') || k.includes('phone')) {
    if (!/^[\d\s+\-]+$/.test(value)) return 'Số điện thoại chỉ được chứa chữ số, dấu + hoặc dấu gạch'
  }
  return null
}

// ── Tab config ────────────────────────────────────────────────────────────────

const TAB_ORDER = [
  'GENERAL', 'CONTACT', 'PAYMENT', 'COMMERCE', 'SHIPPING', 'PROMO', 'SOCIAL', 'SEO',
  'PUBLIC_HOME', 'STORE', 'TAX', 'SECURITY',
]

const HIDDEN_GROUPS = new Set(['PAYMENT_SEPAY'])

const TAB_META = {
  GENERAL:     { icon: Store,      labelKey: 'settings.group_general' },
  CONTACT:     { icon: Phone,      labelKey: 'settings.group_contact' },
  PAYMENT:     { icon: CreditCard, labelKey: 'settings.group_payment' },
  COMMERCE:    { icon: CreditCard, labelKey: 'settings.group_commerce' },
  SHIPPING:    { icon: Truck,      labelKey: 'settings.group_shipping' },
  PROMO:       { icon: Tag,        labelKey: 'settings.group_promo' },
  SOCIAL:      { icon: Globe,      labelKey: 'settings.group_social' },
  SEO:         { icon: Globe,      labelKey: 'settings.group_seo' },
  PUBLIC_HOME: { icon: Home,       labelKey: 'settings.group_public_home' },
  STORE:       { icon: Building2,  labelKey: 'settings.group_store' },
  TAX:         { icon: Tag,        labelKey: 'settings.group_tax' },
  SECURITY:    { icon: Shield,     labelKey: 'settings.group_security' },
}

const FALLBACK_META = { icon: Settings, labelKey: null }

function tabLabel(group, t) {
  const meta = TAB_META[group?.toUpperCase()] || FALLBACK_META
  if (!meta.labelKey) return group ?? t('settings.groupGeneral')
  const translated = t(meta.labelKey)
  return translated === meta.labelKey ? (group ?? t('settings.groupGeneral')) : translated
}

// ── SettingField ──────────────────────────────────────────────────────────────

function SettingField({ setting, canUpdate, draft, error, onChange }) {
  const rawValue = displayValue(setting.value)
  const currentValue = draft !== undefined ? draft : rawValue
  const isDirty = draft !== undefined && draft !== rawValue
  const type = inputTypeFor(setting.key)
  const placeholder = placeholderFor(setting.key)

  return (
    <div className={`sv2-field${isDirty ? ' sv2-field--dirty' : ''}`}>
      <div className="sv2-field-label">
        {setting.description || setting.key}
        {isDirty && <span className="sv2-field-dirty-dot" aria-label="Chưa lưu" />}
      </div>

      {canUpdate ? (
        <input
          className={`control-input sv2-field-input${error ? ' sv2-field-input--error' : ''}`}
          type={type}
          inputMode={type === 'number' ? 'numeric' : undefined}
          value={currentValue}
          placeholder={placeholder || (rawValue ? '' : 'Bấm để nhập...')}
          onChange={(e) => onChange(setting.key, e.target.value)}
          aria-describedby={error ? `err-${setting.key}` : undefined}
        />
      ) : (
        <div className="sv2-field-readonly">
          {rawValue || <em className="sv2-empty">Chưa có giá trị</em>}
        </div>
      )}

      {error && (
        <p id={`err-${setting.key}`} className="field-error sv2-field-error">{error}</p>
      )}
    </div>
  )
}

// ── SettingTabPanel ───────────────────────────────────────────────────────────

function SettingTabPanel({ items, canUpdate, drafts, errors, onDraftChange, onSave, onDiscard, saving }) {
  const dirtyCount = Object.keys(drafts).filter(
    (k) => items.some((s) => s.key === k)
  ).length

  const hasError = items.some((s) => errors[s.key])

  return (
    <div className="sv2-panel">
      <div className="sv2-fields">
        {items.map((setting) => (
          <SettingField
            key={setting.key}
            setting={setting}
            canUpdate={canUpdate}
            draft={drafts[setting.key]}
            error={errors[setting.key]}
            onChange={onDraftChange}
          />
        ))}
      </div>

      {canUpdate && dirtyCount > 0 && (
        <div className="sv2-footer">
          <span className="sv2-footer-info">
            <AlertCircle size={14} />
            {dirtyCount === 1 ? '1 thay đổi chưa lưu' : `${dirtyCount} thay đổi chưa lưu`}
          </span>
          <div className="sv2-footer-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onDiscard}
              disabled={saving}
            >
              Huỷ
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={saving || hasError}
            >
              {saving ? 'Đang lưu...' : `Lưu (${dirtyCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SettingsScreen ────────────────────────────────────────────────────────────

export function SettingsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [fetchKey, setFetchKey] = useState(0)
  const [activeTabOverride, setActiveTabOverride] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchSettings()
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], warning: '', error: e.message })
      })
    return () => { active = false }
  }, [fetchKey])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of state.items) {
      const g = (s.settingGroup || 'GENERAL').toUpperCase()
      if (HIDDEN_GROUPS.has(g)) continue
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    // Sort tabs by defined order, unknown groups go last
    const sorted = new Map()
    for (const key of TAB_ORDER) {
      if (map.has(key)) sorted.set(key, map.get(key))
    }
    for (const [key, val] of map) {
      if (!sorted.has(key)) sorted.set(key, val)
    }
    return sorted
  }, [state.items])

  // Derive active tab: user pick takes priority, else first available tab
  const firstTab = groups.size > 0 ? [...groups.keys()][0] : null
  const activeTab = (activeTabOverride && groups.has(activeTabOverride)) ? activeTabOverride : firstTab

  const activeItems = activeTab ? (groups.get(activeTab) || []) : []

  const handleDraftChange = useCallback((key, value) => {
    setDrafts((p) => ({ ...p, [key]: value }))
    // Validate inline
    const err = validateValue(key, value)
    setErrors((p) => ({ ...p, [key]: err || '' }))
  }, [])

  const handleDiscard = useCallback(() => {
    const keys = activeItems.map((s) => s.key)
    setDrafts((p) => {
      const n = { ...p }
      keys.forEach((k) => delete n[k])
      return n
    })
    setErrors((p) => {
      const n = { ...p }
      keys.forEach((k) => delete n[k])
      return n
    })
  }, [activeItems])

  const handleSave = useCallback(async () => {
    // Validate all dirty fields in this tab
    const dirty = activeItems.filter((s) => drafts[s.key] !== undefined)
    const newErrors = {}
    for (const s of dirty) {
      const err = validateValue(s.key, drafts[s.key])
      if (err) newErrors[s.key] = err
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((p) => ({ ...p, ...newErrors }))
      return
    }

    setSaving(true)
    setSaveSuccess(false)
    try {
      const results = await Promise.all(
        dirty.map((s) => updateSetting(s.key, drafts[s.key]))
      )
      // Update state with fresh items from server
      setState((p) => {
        const updated = new Map(results.map((r) => [r.item.key, r.item]))
        return { ...p, items: p.items.map((s) => updated.get(s.key) || s) }
      })
      // Clear drafts for saved keys
      const savedKeys = dirty.map((s) => s.key)
      setDrafts((p) => {
        const n = { ...p }
        savedKeys.forEach((k) => delete n[k])
        return n
      })
      setErrors((p) => {
        const n = { ...p }
        savedKeys.forEach((k) => delete n[k])
        return n
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      // Show error on all dirty fields
      const errMsg = e.message || t('settings.saveError')
      setErrors((p) => ({ ...p, ...Object.fromEntries(dirty.map((s) => [s.key, errMsg])) }))
    } finally {
      setSaving(false)
    }
  }, [activeItems, drafts, t])

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('settings.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('settings.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => setFetchKey((k) => k + 1)}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.items.length === 0 ? (
        <StatePanel tone="neutral" title={t('settings.noSettings')} description={t('settings.noSettingsDesc')} />
      ) : (
        <div className="sv2-layout">
          {/* Tab sidebar */}
          <nav className="sv2-tabs" aria-label="Nhóm cài đặt">
            {[...groups.entries()].map(([group, items]) => {
              const meta = TAB_META[group] || FALLBACK_META
              const Icon = meta.icon
              const label = tabLabel(group, t)
              const isActive = activeTab === group
              const dirtyInGroup = items.filter((s) => drafts[s.key] !== undefined).length

              return (
                <button
                  key={group}
                  type="button"
                  className={`sv2-tab-btn${isActive ? ' active' : ''}`}
                  onClick={() => setActiveTabOverride(group)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon size={16} className="sv2-tab-icon" />
                  <span className="sv2-tab-label">{label}</span>
                  {dirtyInGroup > 0 && (
                    <span className="sv2-tab-badge" aria-label={`${dirtyInGroup} thay đổi`}>{dirtyInGroup}</span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Content panel */}
          <div className="sv2-content">
            {saveSuccess && (
              <div className="sv2-toast" role="status">
                <CheckCircle2 size={15} />
                Đã lưu thành công
              </div>
            )}

            {activeTab && (
              <SettingTabPanel
                items={activeItems}
                canUpdate={canUpdate}
                drafts={drafts}
                errors={errors}
                onDraftChange={handleDraftChange}
                onSave={handleSave}
                onDiscard={handleDiscard}
                saving={saving}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
