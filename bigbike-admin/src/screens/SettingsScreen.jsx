import { useMemo, useEffect, useState, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchSettings, batchUpdateSettings } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import {
  validateValue, TAB_ORDER, SENSITIVE_SETTING_TABS, HIDDEN_GROUPS, HIDDEN_KEYS,
  TAB_META, FALLBACK_META, tabLabel, BANNERS_TAB_ID,
} from './settings/constants'
import { SettingTabPanel } from './settings/SettingTabPanel'
import { BannerScreen } from './BannerScreen'

// ── SettingsScreen ────────────────────────────────────────────────────────────

export function SettingsScreen({ canUpdate, isSuperAdmin = false, navigate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [fetchKey, setFetchKey] = useState(0)
  const [activeTabOverride, setActiveTabOverride] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [draftsEn, setDraftsEn] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, warning: '' })
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
      if (HIDDEN_KEYS.has(s.key)) continue
      // Super-admin-only settings (vd phân công sản phẩm) chỉ hiện với super admin.
      if (s.superAdminOnly && !isSuperAdmin) continue
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
  }, [state.items, isSuperAdmin])

  // Danh sách tab điều hướng = các settingGroup thật + tab "Banner trang" (nhúng BannerScreen).
  // Banner chèn ngay sau Trang chủ (PUBLIC_HOME) cho gần các tab nội dung trang công khai.
  const navTabs = useMemo(() => {
    const tabs = [...groups.keys()].map((group) => ({ id: group, kind: 'group' }))
    const i = tabs.findIndex((tab) => tab.id === 'PUBLIC_HOME')
    const bannerTab = { id: BANNERS_TAB_ID, kind: 'banners' }
    if (i === -1) tabs.push(bannerTab)
    else tabs.splice(i + 1, 0, bannerTab)
    return tabs
  }, [groups])

  // Derive active tab: user pick takes priority, else first available tab
  const firstTab = groups.size > 0 ? [...groups.keys()][0] : null
  const isValidOverride = activeTabOverride && (groups.has(activeTabOverride) || activeTabOverride === BANNERS_TAB_ID)
  const activeTab = isValidOverride ? activeTabOverride : firstTab

  const activeItems = useMemo(() => {
    if (!activeTab) return []
    return groups.get(activeTab) || []
  }, [activeTab, groups])

  const handleDraftChange = useCallback((key, value) => {
    setDrafts((p) => ({ ...p, [key]: value }))
    // "Reward early, punish late": khi đang gõ chỉ XÓA lỗi cũ, không bắt lỗi từng
    // ký tự (gõ dở email/URL/hotline không bị báo đỏ ngay). Validate đầy đủ chạy
    // lại ở handleSave trước khi lưu, nên không bỏ sót giá trị sai.
    setErrors((p) => (p[key] ? { ...p, [key]: '' } : p))
  }, [])

  // English drafts: text-only, no validation (titles/descriptions).
  const handleDraftChangeEn = useCallback((key, value) => {
    setDraftsEn((p) => ({ ...p, [key]: value }))
  }, [])

  const handleDiscard = useCallback(() => {
    const keys = activeItems.map((s) => s.key)
    const dropKeys = (obj) => {
      const n = { ...obj }
      keys.forEach((k) => delete n[k])
      return n
    }
    setDrafts(dropKeys)
    setDraftsEn(dropKeys)
    setErrors(dropKeys)
  }, [activeItems])

  const handleSave = useCallback(async () => {
    // Validate all dirty fields in this tab (VI values only; EN is free text)
    const dirty = activeItems.filter((s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined)
    const newErrors = {}
    for (const s of dirty) {
      if (drafts[s.key] === undefined) continue
      const err = validateValue(s.key, drafts[s.key])
      if (err) newErrors[s.key] = t(err)
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((p) => ({ ...p, ...newErrors }))
      return
    }

    if (SENSITIVE_SETTING_TABS.has(activeTab)) {
      const ok = await showConfirm(
        t('settings.confirmSaveMessage'),
        t('settings.confirmSaveTitle'),
      )
      if (!ok) return
    }

    setSaving(true)
    setSaveSuccess(false)
    try {
      const result = await batchUpdateSettings(
        dirty.map((s) => {
          const u = { key: s.key }
          if (drafts[s.key] !== undefined) u.value = drafts[s.key]
          if (draftsEn[s.key] !== undefined) u.valueEn = draftsEn[s.key]
          return u
        })
      )
      // Update state with fresh items from server
      setState((p) => {
        const updated = new Map(result.items.map((item) => [item.key, item]))
        return { ...p, items: p.items.map((s) => updated.get(s.key) || s) }
      })
      // Clear drafts for saved keys
      const savedKeys = dirty.map((s) => s.key)
      const dropSaved = (obj) => {
        const n = { ...obj }
        savedKeys.forEach((k) => delete n[k])
        return n
      }
      setDrafts(dropSaved)
      setDraftsEn(dropSaved)
      setErrors(dropSaved)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (e) {
      // Show error on all dirty fields — batch is all-or-nothing so mark all dirty fields
      const errMsg = e.message || t('settings.saveError')
      setErrors((p) => ({ ...p, ...Object.fromEntries(dirty.map((s) => [s.key, errMsg])) }))
    } finally {
      setSaving(false)
    }
  }, [activeItems, drafts, draftsEn, activeTab, t])

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
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p className="bb-muted">{t('settings.description')}</p>
        </div>
      </div>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.items.length === 0 ? (
        <StatePanel tone="neutral" title={t('settings.noSettings')} description={t('settings.noSettingsDesc')} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
          {/* Tab sidebar — prototype .settings-nav */}
          <nav className="settings-nav" aria-label={t('settings.tabsAria')}>
            {navTabs.map((tab) => {
              // Tab "Banner trang" — nhúng trình sửa banner, không có settingGroup/đếm dirty riêng.
              if (tab.kind === 'banners') {
                const Icon = TAB_META.PUBLIC_HERO.icon
                const isActive = activeTab === BANNERS_TAB_ID
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={isActive ? 'active' : ''}
                    onClick={() => setActiveTabOverride(BANNERS_TAB_ID)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <Icon size={15} />
                    <span style={{ flex: 1 }}>{tabLabel('PUBLIC_HERO', t)}</span>
                  </button>
                )
              }

              const group = tab.id
              const items = groups.get(group) || []
              const meta = TAB_META[group] || FALLBACK_META
              const Icon = meta.icon
              const label = tabLabel(group, t)
              const isActive = activeTab === group
              const dirtyInGroup = items.filter((s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined).length

              return (
                <button
                  key={group}
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => setActiveTabOverride(group)}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon size={15} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {dirtyInGroup > 0 && (
                    <span className="bb-badge bb-badge-warning" aria-label={t('settings.tabChangeCount', { count: dirtyInGroup })}>
                      {dirtyInGroup}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Content panel */}
          <div>
            {saveSuccess && activeTab !== BANNERS_TAB_ID && (
              <div
                role="status"
                className="settings-save-banner mb-3"
              >
                <CheckCircle2 size={15} />
                {t('settings.saveSuccess')}
              </div>
            )}

            {activeTab === BANNERS_TAB_ID && (
              <BannerScreen embedded canUpdate={canUpdate} navigate={navigate} />
            )}

            {activeTab && activeTab !== BANNERS_TAB_ID && (
              <SettingTabPanel
                title={tabLabel(activeTab, t)}
                items={activeItems}
                canUpdate={canUpdate}
                drafts={drafts}
                draftsEn={draftsEn}
                errors={errors}
                onDraftChange={handleDraftChange}
                onDraftChangeEn={handleDraftChangeEn}
                onSave={handleSave}
                onDiscard={handleDiscard}
                saving={saving}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
