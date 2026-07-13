import { useMemo, useEffect, useState, useCallback, Suspense } from 'react'
import { CheckCircle2, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { fetchSettings, batchUpdateSettings } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { formatDateTime } from '../lib/formatters'
import { lazyScreen } from '../lib/lazyScreen'
import { setContentLang } from '../lib/contentLang'
import {
  validateValue, isTranslatableSetting, REQUIRED_SETTING_KEYS, TAB_ORDER, SENSITIVE_SETTING_TABS, HIDDEN_GROUPS, HIDDEN_KEYS,
  TAB_META, FALLBACK_META, tabLabel, BANNERS_TAB_ID, ASSIGN_TAB_ID,
  getAutosaveKey, saveFormToStorage, loadFormFromStorage, clearFormFromStorage,
} from './settings/constants'
import { SettingTabPanel } from './settings/SettingTabPanel'

// Lazy — Cài đặt mở mặc định ở tab chung, không phải tab Banner (496 dòng); tải sẵn tĩnh
// trước đây kéo theo code Banner vào MỌI lần mở Cài đặt dù không xem tab đó.
const BannerScreen = lazyScreen(() => import('./BannerScreen'), 'BannerScreen')
// Lazy — cùng lý do: tab "Phân công" chỉ Super Admin mới thấy, không kéo code
// AssignmentRolesScreen vào mọi lần mở Cài đặt của role khác.
const AssignmentRolesScreen = lazyScreen(() => import('./AssignmentRolesScreen'), 'AssignmentRolesScreen')

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

  // F9: autosave / khôi phục bản nháp — cùng cơ chế localStorage với Sản phẩm/
  // Danh mục/Nội dung. Cài đặt là màn đơn nên key cố định, gộp mọi tab.
  const autosaveKey = getAutosaveKey()
  const [draftRecovery, setDraftRecovery] = useState(null)

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, warning: '' })
        // Bản nháp autosave còn dở từ phiên trước → gợi ý khôi phục.
        const draft = loadFormFromStorage(autosaveKey)
        const hasDraftValues = draft?.form && (
          Object.keys(draft.form.drafts || {}).length > 0 ||
          Object.keys(draft.form.draftsEn || {}).length > 0
        )
        if (hasDraftValues) setDraftRecovery(draft)
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], warning: '', error: e.message })
      })
    return () => { active = false }
  }, [fetchKey, autosaveKey])

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
  // Banner chèn ngay sau Chung (GENERAL) — gần đầu danh sách. (Trước đây chèn sau Trang chủ/
  // PUBLIC_HOME; nhóm đó đã gỡ hẳn V311 nên không còn tab để bám theo.)
  const navTabs = useMemo(() => {
    const tabs = [...groups.keys()].map((group) => ({ id: group, kind: 'group' }))
    const i = tabs.findIndex((tab) => tab.id === 'GENERAL')
    const bannerTab = { id: BANNERS_TAB_ID, kind: 'banners' }
    if (i === -1) tabs.unshift(bannerTab)
    else tabs.splice(i + 1, 0, bannerTab)
    // Tab "Phân công" — synthetic như Banner, nhưng CHỈ Super Admin thấy: nhóm product_assign
    // đã rời khỏi `groups` (HIDDEN_GROUPS) nên mất luôn filter `s.superAdminOnly && !isSuperAdmin`
    // ở trên — phải tự gate ở đây để role khác không thấy tab này.
    if (isSuperAdmin) tabs.push({ id: ASSIGN_TAB_ID, kind: 'assign' })
    return tabs
  }, [groups, isSuperAdmin])

  // Derive active tab: user pick takes priority, else first available tab
  const firstTab = groups.size > 0 ? [...groups.keys()][0] : null
  const isValidOverride = activeTabOverride && (
    groups.has(activeTabOverride) || activeTabOverride === BANNERS_TAB_ID || activeTabOverride === ASSIGN_TAB_ID
  )
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

  // Validate khi rời ô (F3): báo lỗi email/URL/hotline/ngưỡng ngay khi blur,
  // không bắt lỗi từng ký tự lúc đang gõ. handleSave vẫn validate lại lần cuối.
  const handleDraftBlur = useCallback((key, value) => {
    const err = validateValue(key, value)
    setErrors((p) => ({ ...p, [key]: err ? t(err) : '' }))
  }, [t])

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
    if (dirty.length === 0) return
    const newErrors = {}
    for (const s of dirty) {
      if (drafts[s.key] === undefined) continue
      const err = validateValue(s.key, drafts[s.key])
      if (err) newErrors[s.key] = t(err)
    }
    // TRANSLATION_RULE_002: setting vừa dịch-được vừa bắt buộc ở VI (hiện chỉ `site_name`)
    // thì bản tiếng Anh cũng bắt buộc — chặn lưu + tự chuyển sang tab EN để admin bổ sung.
    let missingEn = false
    for (const s of dirty) {
      if (!REQUIRED_SETTING_KEYS.has(s.key) || !isTranslatableSetting(s)) continue
      const effectiveEn = draftsEn[s.key] !== undefined ? draftsEn[s.key] : s.valueEn
      if (!String(effectiveEn ?? '').trim()) {
        newErrors[s.key] = t('settings.errValueEnRequired', { defaultValue: 'Vui lòng nhập bản tiếng Anh cho trường này.' })
        missingEn = true
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((p) => ({ ...p, ...newErrors }))
      if (missingEn) setContentLang('en')
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
      // F9: đã lưu — cập nhật bản nháp autosave (xoá hẳn nếu mọi tab hết dirty,
      // ghi lại phần còn dở của các tab khác nếu còn).
      const remainingDrafts = dropSaved(drafts)
      const remainingDraftsEn = dropSaved(draftsEn)
      if (Object.keys(remainingDrafts).length === 0 && Object.keys(remainingDraftsEn).length === 0) {
        clearFormFromStorage(autosaveKey)
      } else {
        saveFormToStorage(autosaveKey, { drafts: remainingDrafts, draftsEn: remainingDraftsEn })
      }
      setDraftRecovery(null)
    } catch (e) {
      // Show error on all dirty fields — batch is all-or-nothing so mark all dirty fields
      const errMsg = e.message || t('settings.saveError')
      setErrors((p) => ({ ...p, ...Object.fromEntries(dirty.map((s) => [s.key, errMsg])) }))
    } finally {
      setSaving(false)
    }
  }, [activeItems, drafts, draftsEn, activeTab, autosaveKey, t])

  // F6: cảnh báo khi rời màn Cài đặt lúc còn thay đổi chưa lưu (chặn điều hướng
  // nội bộ qua navigate + beforeunload reload/đóng tab). Đổi tab nội bộ KHÔNG mất
  // draft (giữ ở state component) nên chỉ cần chặn khi thực sự rời màn.
  const isDirty = Object.keys(drafts).length > 0 || Object.keys(draftsEn).length > 0
  useUnsavedChanges(isDirty)

  // F9: autosave — lưu bản nháp vào localStorage sau 10s không thao tác khi có
  // thay đổi chưa lưu (mọi tab, không chỉ tab đang xem).
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, { drafts, draftsEn }), 10_000)
    return () => clearTimeout(timer)
  }, [drafts, draftsEn, isDirty, autosaveKey])

  // O3: Ctrl/Cmd+S lưu tab đang xem — chỉ bật khi có quyền sửa, không ở tab Banner
  // (tab đó có luồng lưu riêng của BannerScreen) và tab hiện tại có thay đổi chưa lưu.
  const activeDirtyCount = activeItems.filter((s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined).length
  useSaveShortcut(
    canUpdate && activeTab !== BANNERS_TAB_ID && activeTab !== ASSIGN_TAB_ID && activeDirtyCount > 0,
    handleSave,
  )

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
      {/* Không có quyền sửa mà cũng chưa có cảnh báo read-only từ máy chủ: nêu rõ
          đang ở chế độ chỉ xem để chủ shop không loay hoay tìm nút Lưu. */}
      {!canUpdate && !state.warning && (
        <ReadOnlyBanner warning={t('settings.readOnlyHint', { defaultValue: 'Bạn chỉ có quyền xem cài đặt, không thể chỉnh sửa.' })} />
      )}

      {draftRecovery && (
        <div className="bb-alert info center wrap">
          <Save size={14} className="shrink-0" />
          <span className="bb-alert-main truncate">
            <strong>{t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}</strong>
            {' · '}{formatDateTime(new Date(draftRecovery.ts).toISOString())}
          </span>
          <button
            type="button"
            className="text-xs font-semibold underline hover:no-underline"
            onClick={() => {
              const restoredDrafts = draftRecovery.form?.drafts || {}
              const restoredDraftsEn = draftRecovery.form?.draftsEn || {}
              setDrafts((p) => ({ ...p, ...restoredDrafts }))
              setDraftsEn((p) => ({ ...p, ...restoredDraftsEn }))
              // Nhảy sang tab đầu tiên có field vừa khôi phục để admin thấy ngay,
              // không phải tự dò từng tab theo huy hiệu số thay đổi.
              const targetGroup = [...groups.entries()].find(([, items]) =>
                items.some((s) => restoredDrafts[s.key] !== undefined || restoredDraftsEn[s.key] !== undefined)
              )
              if (targetGroup) setActiveTabOverride(targetGroup[0])
              setDraftRecovery(null)
            }}
          >
            {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
          </button>
          <button
            type="button"
            className="text-xs underline hover:no-underline"
            onClick={() => { clearFormFromStorage(autosaveKey); setDraftRecovery(null) }}
          >
            {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
          </button>
        </div>
      )}

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
                    <span className="flex-1">{tabLabel('PUBLIC_HERO', t)}</span>
                  </button>
                )
              }

              // Tab "Phân công" — nhúng AssignmentRolesScreen, cùng cơ chế với Banner ở trên.
              if (tab.kind === 'assign') {
                const Icon = TAB_META.PRODUCT_ASSIGN.icon
                const isActive = activeTab === ASSIGN_TAB_ID
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={isActive ? 'active' : ''}
                    onClick={() => setActiveTabOverride(ASSIGN_TAB_ID)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <Icon size={15} />
                    <span className="flex-1">{tabLabel('PRODUCT_ASSIGN', t)}</span>
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
                  <span className="flex-1">{label}</span>
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
            {saveSuccess && activeTab !== BANNERS_TAB_ID && activeTab !== ASSIGN_TAB_ID && (
              <div
                role="status"
                className="settings-save-banner mb-3"
              >
                <CheckCircle2 size={15} />
                {t('settings.saveSuccess')}
              </div>
            )}

            {activeTab === BANNERS_TAB_ID && (
              <Suspense fallback={<ScreenSkeleton />}>
                <BannerScreen embedded canUpdate={canUpdate} navigate={navigate} />
              </Suspense>
            )}

            {activeTab === ASSIGN_TAB_ID && (
              <Suspense fallback={<ScreenSkeleton />}>
                <AssignmentRolesScreen embedded canUpdate={canUpdate} />
              </Suspense>
            )}

            {activeTab && activeTab !== BANNERS_TAB_ID && activeTab !== ASSIGN_TAB_ID && (
              <SettingTabPanel
                title={tabLabel(activeTab, t)}
                items={activeItems}
                canUpdate={canUpdate}
                drafts={drafts}
                draftsEn={draftsEn}
                errors={errors}
                onDraftChange={handleDraftChange}
                onDraftChangeEn={handleDraftChangeEn}
                onDraftBlur={handleDraftBlur}
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
