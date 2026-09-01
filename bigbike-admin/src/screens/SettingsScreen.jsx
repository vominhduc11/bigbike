import { useMemo, useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { AlertTriangle, Lock, RefreshCw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { ScreenSkeleton } from '../components/ScreenSkeleton'
import { fetchSettings, batchUpdateSettings } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { useUnsavedChanges } from '@/lib/useUnsavedChanges'
import { useSaveShortcut } from '@/lib/useSaveShortcut'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '../lib/formatters'
import { lazyScreen } from '../lib/lazyScreen'
import { setContentLang } from '../lib/contentLang'
import { Screen, ScreenHeader, Tabs } from '@/components/layout'
import { cn } from '@/lib/utils'
import {
  validateValue,
  isTranslatableSetting,
  REQUIRED_SETTING_KEYS,
  TAB_ORDER,
  SENSITIVE_SETTING_TABS,
  HIDDEN_GROUPS,
  HIDDEN_KEYS,
  TAB_META,
  FALLBACK_META,
  tabLabel,
  tabDescription,
  displayValue,
  isSettingDirty,
  BANNERS_TAB_ID,
  ASSIGN_TAB_ID,
  getAutosaveKey,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormFromStorage,
} from './settings/constants'
import { SettingTabPanel } from './settings/SettingTabPanel'
import { DetailSection } from '../components/DetailSection'

// Lazy — Cài đặt mở mặc định ở tab chung, không phải tab Banner (496 dòng); tải sẵn tĩnh
// trước đây kéo theo code Banner vào MỌI lần mở Cài đặt dù không xem tab đó.
const BannerScreen = lazyScreen(() => import('./BannerScreen'), 'BannerScreen')
// Lazy — cùng lý do: tab "Phân công" chỉ Super Admin mới thấy, không kéo code
// AssignmentRolesScreen vào mọi lần mở Cài đặt của role khác.
const AssignmentRolesScreen = lazyScreen(
  () => import('./AssignmentRolesScreen'),
  'AssignmentRolesScreen',
)

// ── SettingsScreen ────────────────────────────────────────────────────────────

export function SettingsScreen({ canUpdate, isSuperAdmin = false, navigate }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [activeTabOverride, setActiveTabOverride] = useState(() => {
    if (typeof window === 'undefined') return null
    const requested = new URLSearchParams(window.location.search).get('group')
    return requested ? requested.toUpperCase() : null
  })
  const [drafts, setDrafts] = useState({})
  const [draftsEn, setDraftsEn] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [embeddedStates, setEmbeddedStates] = useState({})
  const [visitedTabs, setVisitedTabs] = useState(() => new Set())

  // F9: autosave / khôi phục bản nháp — cùng cơ chế localStorage với Sản phẩm/
  // Danh mục/Nội dung. Cài đặt là màn đơn nên key cố định, gộp mọi tab.
  const autosaveKey = getAutosaveKey()
  const [draftRecovery, setDraftRecovery] = useState(null)
  const hasCheckedDraftRef = useRef(false)
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    placeholderData: keepPreviousData,
  })
  const settingsData = settingsQuery.data
  const state = {
    status: settingsQuery.isPending
      ? 'loading'
      : settingsQuery.isError && !settingsData
        ? 'error'
        : 'success',
    items: settingsData?.items ?? [],
    warning: '',
    isRefreshing: settingsQuery.isFetching && Boolean(settingsData),
    refreshError:
      settingsQuery.isError && settingsData
        ? settingsQuery.error?.message || t('settings.refreshError')
        : '',
    error: settingsQuery.error?.message || '',
  }

  useEffect(() => {
    if (!settingsData || hasCheckedDraftRef.current) return
    hasCheckedDraftRef.current = true
    // Bản nháp autosave còn dở từ phiên trước → gợi ý khôi phục.
    const draft = loadFormFromStorage(autosaveKey)
    const hasDraftValues =
      draft?.form &&
      (Object.keys(draft.form.drafts || {}).length > 0 ||
        Object.keys(draft.form.draftsEn || {}).length > 0)
    // Khôi phục bản nháp là phản hồi một lần cho dữ liệu vừa có từ server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasDraftValues) setDraftRecovery(draft)
  }, [autosaveKey, settingsData])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of state.items) {
      if (HIDDEN_KEYS.has(s.key)) continue
      const g = (s.settingGroup || 'GENERAL').toUpperCase()
      if (HIDDEN_GROUPS.has(g)) continue
      // Chỉ dựng các nhóm đã được khai báo trong contract của màn hình. Dữ liệu
      // legacy/nhóm backend đã nghỉ không được tự sinh thành tab mới.
      if (!TAB_ORDER.includes(g)) continue
      // Product-assignment settings remain hidden and have their own synthetic tab below.
      if (s.superAdminOnly && !isSuperAdmin) continue
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    // Sort tabs theo thứ tự đã định nghĩa trong contract.
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
  const isValidOverride =
    activeTabOverride &&
    (groups.has(activeTabOverride) ||
      activeTabOverride === BANNERS_TAB_ID ||
      (activeTabOverride === ASSIGN_TAB_ID && isSuperAdmin))
  const activeTab = isValidOverride ? activeTabOverride : firstTab

  const activeItems = useMemo(() => {
    if (!activeTab) return []
    return groups.get(activeTab) || []
  }, [activeTab, groups])

  useEffect(() => {
    if (activeTab !== BANNERS_TAB_ID && activeTab !== ASSIGN_TAB_ID) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisitedTabs((previous) => {
      if (previous.has(activeTab)) return previous
      const next = new Set(previous)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  const handleEditorStateChange = useCallback((tabId, nextState) => {
    setEmbeddedStates((previous) => {
      const current = previous[tabId]
      if (
        current?.dirtyCount === nextState.dirtyCount &&
        current?.saving === nextState.saving &&
        current?.saveSuccess === nextState.saveSuccess &&
        current?.error === nextState.error
      )
        return previous
      return { ...previous, [tabId]: nextState }
    })
  }, [])
  const handleBannerEditorState = useCallback(
    (nextState) => handleEditorStateChange(BANNERS_TAB_ID, nextState),
    [handleEditorStateChange],
  )
  const handleAssignmentEditorState = useCallback(
    (nextState) => handleEditorStateChange(ASSIGN_TAB_ID, nextState),
    [handleEditorStateChange],
  )

  const handleDraftChange = useCallback(
    (key, value) => {
      const original = displayValue(state.items.find((setting) => setting.key === key)?.value)
      setDrafts((previous) => {
        if (displayValue(value) !== original) return { ...previous, [key]: value }
        if (previous[key] === undefined) return previous
        const next = { ...previous }
        delete next[key]
        return next
      })
      // "Reward early, punish late": khi đang gõ chỉ XÓA lỗi cũ, không bắt lỗi từng
      // ký tự (gõ dở email/URL/hotline không bị báo đỏ ngay). Validate đầy đủ chạy
      // lại ở handleSave trước khi lưu, nên không bỏ sót giá trị sai.
      setErrors((p) => (p[key] ? { ...p, [key]: '' } : p))
      setSaveError('')
    },
    [state.items],
  )

  // English drafts: text-only, no validation (titles/descriptions).
  const handleDraftChangeEn = useCallback(
    (key, value) => {
      const original = displayValue(state.items.find((setting) => setting.key === key)?.valueEn)
      setDraftsEn((previous) => {
        if (displayValue(value) !== original) return { ...previous, [key]: value }
        if (previous[key] === undefined) return previous
        const next = { ...previous }
        delete next[key]
        return next
      })
      setSaveError('')
    },
    [state.items],
  )

  // Validate khi rời ô (F3): báo lỗi email/URL/hotline/ngưỡng ngay khi blur,
  // không bắt lỗi từng ký tự lúc đang gõ. handleSave vẫn validate lại lần cuối.
  const handleDraftBlur = useCallback(
    (key, value) => {
      const err = validateValue(key, value)
      setErrors((p) => ({ ...p, [key]: err ? t(err) : '' }))
    },
    [t],
  )

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
    setSaveError('')
  }, [activeItems])

  const handleSave = useCallback(async () => {
    // Validate all dirty fields in this tab (VI values only; EN is free text)
    const dirty = activeItems.filter((setting) => isSettingDirty(setting, drafts, draftsEn))
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
        newErrors[s.key] = t('settings.errValueEnRequired', {
          defaultValue: 'Vui lòng nhập bản tiếng Anh cho trường này.',
        })
        missingEn = true
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((p) => ({ ...p, ...newErrors }))
      if (missingEn) setContentLang('en')
      return
    }

    if (SENSITIVE_SETTING_TABS.has(activeTab)) {
      const ok = await showConfirm(t('settings.confirmSaveMessage'), t('settings.confirmSaveTitle'))
      if (!ok) return
    }

    setSaving(true)
    setSaveSuccess(false)
    setSaveError('')

    try {
      const result = await batchUpdateSettings(
        dirty.map((s) => {
          const u = { key: s.key }
          if (drafts[s.key] !== undefined) u.value = drafts[s.key]
          if (draftsEn[s.key] !== undefined) u.valueEn = draftsEn[s.key]
          return u
        }),
      )
      // Cập nhật cache ngay để tab hiện tại không chớp rồi làm mới cache chung cho Banner.
      queryClient.setQueryData(['settings'], (previous) => {
        const updated = new Map(result.items.map((item) => [item.key, item]))
        return { ...previous, items: (previous?.items || []).map((s) => updated.get(s.key) || s) }
      })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
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
      if (
        Object.keys(remainingDrafts).length === 0 &&
        Object.keys(remainingDraftsEn).length === 0
      ) {
        clearFormFromStorage(autosaveKey)
      } else {
        saveFormToStorage(autosaveKey, { drafts: remainingDrafts, draftsEn: remainingDraftsEn })
      }
      setDraftRecovery(null)
    } catch (e) {
      // Lỗi mạng/server là lỗi của lần lưu, không phải bằng chứng rằng mọi field sai.
      setSaveError(e.message || t('settings.saveError'))
    } finally {
      setSaving(false)
    }
  }, [activeItems, activeTab, autosaveKey, drafts, draftsEn, queryClient, t])

  // F6: cảnh báo khi rời màn Cài đặt lúc còn thay đổi chưa lưu (chặn điều hướng
  // nội bộ qua navigate + beforeunload reload/đóng tab). Đổi tab nội bộ KHÔNG mất
  // draft (giữ ở state component) nên chỉ cần chặn khi thực sự rời màn.
  const genericDirtyItems = useMemo(
    () => state.items.filter((setting) => isSettingDirty(setting, drafts, draftsEn)),
    [drafts, draftsEn, state.items],
  )
  const isDirty = genericDirtyItems.length > 0
  useUnsavedChanges(isDirty)

  // F9: autosave — lưu bản nháp vào localStorage sau 10s không thao tác khi có
  // thay đổi chưa lưu (mọi tab, không chỉ tab đang xem).
  useEffect(() => {
    if (!isDirty) {
      if (
        state.status === 'success' &&
        (Object.keys(drafts).length > 0 || Object.keys(draftsEn).length > 0)
      )
        clearFormFromStorage(autosaveKey)
      return
    }
    const timer = setTimeout(() => saveFormToStorage(autosaveKey, { drafts, draftsEn }), 10_000)
    return () => clearTimeout(timer)
  }, [drafts, draftsEn, isDirty, autosaveKey, state.status])

  // O3: Ctrl/Cmd+S lưu tab đang xem — chỉ bật khi có quyền sửa, không ở tab Banner
  // (tab đó có luồng lưu riêng của BannerScreen) và tab hiện tại có thay đổi chưa lưu.
  const activeDirtyCount = activeItems.filter((setting) =>
    isSettingDirty(setting, drafts, draftsEn),
  ).length
  useSaveShortcut(
    canUpdate &&
      activeTab !== BANNERS_TAB_ID &&
      activeTab !== ASSIGN_TAB_ID &&
      activeDirtyCount > 0,
    handleSave,
  )

  const anySaving =
    saving || Object.values(embeddedStates).some((editorState) => editorState.saving)

  const getTabInfo = (tab) => {
    if (tab.kind === 'banners') {
      const rawItems = state.items.filter(
        (setting) =>
          (setting.settingGroup || '').toUpperCase() === 'PUBLIC_HERO' &&
          !HIDDEN_KEYS.has(setting.key),
      )
      return {
        ...tab,
        label: tabLabel('PUBLIC_HERO', t),
        description: tabDescription('PUBLIC_HERO', t),
        icon: TAB_META.PUBLIC_HERO.icon,
        itemCount: rawItems.length,
        dirtyCount: embeddedStates[BANNERS_TAB_ID]?.dirtyCount || 0,
        sensitive: false,
        restricted: false,
      }
    }
    if (tab.kind === 'assign') {
      const rawItems = state.items.filter(
        (setting) =>
          (setting.settingGroup || '').toUpperCase() === 'PRODUCT_ASSIGN' &&
          !HIDDEN_KEYS.has(setting.key),
      )
      return {
        ...tab,
        label: tabLabel('PRODUCT_ASSIGN', t),
        description: tabDescription('PRODUCT_ASSIGN', t),
        icon: TAB_META.PRODUCT_ASSIGN.icon,
        itemCount: rawItems.length,
        dirtyCount: embeddedStates[ASSIGN_TAB_ID]?.dirtyCount || 0,
        sensitive: false,
        restricted: true,
      }
    }
    const items = groups.get(tab.id) || []
    const meta = TAB_META[tab.id] || FALLBACK_META
    return {
      ...tab,
      label: tabLabel(tab.id, t),
      description: tabDescription(tab.id, t),
      icon: meta.icon,
      itemCount: items.length,
      dirtyCount: items.filter((setting) => isSettingDirty(setting, drafts, draftsEn)).length,
      sensitive: SENSITIVE_SETTING_TABS.has(tab.id),
      restricted:
        !isSuperAdmin && items.length > 0 && items.every((setting) => setting.superAdminOnly),
    }
  }
  const tabInfos = navTabs.map(getTabInfo)
  const mobileTabItems = tabInfos.map((tab) => {
    const Icon = tab.icon
    return {
      key: tab.id,
      count: tab.dirtyCount > 0 ? tab.dirtyCount : undefined,
      label: (
        <span className="inline-flex items-center gap-2">
          <Icon size={14} aria-hidden="true" />
          <span>{tab.label}</span>
          {tab.restricted ? <Lock size={12} aria-hidden="true" /> : null}
        </span>
      ),
    }
  })

  const header = (
    <ScreenHeader
      group="system"
      title={t('settings.title')}
      badge={
        <span className={canUpdate ? 'bb-badge bb-badge-success' : 'bb-badge bb-badge-warning'}>
          {canUpdate
            ? t('settings.accessEditable', { defaultValue: 'Có thể chỉnh sửa' })
            : t('settings.accessReadOnly', { defaultValue: 'Chỉ xem' })}
        </span>
      }
      actions={
        <Button
          variant="secondary"
          className="min-h-11"
          onClick={() => settingsQuery.refetch()}
          disabled={state.status === 'loading' || state.isRefreshing || anySaving}
        >
          <RefreshCw
            size={16}
            className={state.isRefreshing ? 'animate-spin' : undefined}
            aria-hidden="true"
          />
          {state.isRefreshing ? t('settings.refreshing') : t('settings.refresh')}
        </Button>
      }
    />
  )

  if (state.status === 'loading') {
    return (
      <Screen>
        {header}
        <ScreenSkeleton />
      </Screen>
    )
  }

  if (state.status === 'error') {
    return (
      <Screen>
        {header}
        <StatePanel
          tone="danger"
          title={t('settings.loadError')}
          description={state.error}
          actionLabel={t('common.retry')}
          onAction={() => settingsQuery.refetch()}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      {state.refreshError ? (
        <div className="bb-alert danger" role="alert">
          <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          <span className="bb-alert-main">{state.refreshError}</span>
          <Button variant="secondary" size="sm" onClick={() => settingsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {state.warning && <ReadOnlyBanner warning={state.warning} />}
      {/* Không có quyền sửa mà cũng chưa có cảnh báo read-only từ máy chủ: nêu rõ
          đang ở chế độ chỉ xem để chủ shop không loay hoay tìm nút Lưu. */}
      {!canUpdate && !state.warning && (
        <ReadOnlyBanner
          warning={t('settings.readOnlyHint', {
            defaultValue: 'Bạn chỉ có quyền xem cài đặt, không thể chỉnh sửa.',
          })}
        />
      )}

      {draftRecovery && (
        <div className="bb-alert info center wrap">
          <Save size={14} className="shrink-0" />
          <span className="bb-alert-main truncate">
            <strong>
              {t('products.detail.draftFoundShort', { defaultValue: 'Có bản nháp tạm' })}
            </strong>
            {' · '}
            {formatDateTime(new Date(draftRecovery.ts).toISOString())}
          </span>
          <Button
            variant="unstyled"
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
                items.some(
                  (s) =>
                    restoredDrafts[s.key] !== undefined || restoredDraftsEn[s.key] !== undefined,
                ),
              )
              if (targetGroup) setActiveTabOverride(targetGroup[0])
              setDraftRecovery(null)
            }}
          >
            {t('products.detail.draftRestore', { defaultValue: 'Khôi phục' })}
          </Button>
          <Button
            variant="unstyled"
            type="button"
            className="text-xs underline hover:no-underline"
            onClick={() => {
              clearFormFromStorage(autosaveKey)
              setDraftRecovery(null)
            }}
          >
            {t('products.detail.draftDiscard', { defaultValue: 'Bỏ qua' })}
          </Button>
        </div>
      )}

      {state.items.length === 0 ? (
        <StatePanel
          tone="neutral"
          title={t('settings.noSettings')}
          description={t('settings.noSettingsDesc')}
        />
      ) : (
        <>
          <div className="sticky top-0 z-10 mb-4 bg-background py-2 lg:hidden">
            <Tabs
              items={mobileTabItems}
              value={activeTab}
              onChange={setActiveTabOverride}
              ariaLabel={t('settings.tabsAria')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="hidden lg:block">
              <DetailSection className="sticky top-4" noPadding>
                <nav className="p-2" aria-label={t('settings.tabsAria')}>
                  <div className="border-b border-border px-3 pb-3 pt-2">
                    <p className="m-0 text-sm font-semibold text-foreground">
                      {t('settings.navigatorTitle')}
                    </p>
                    <p className="mb-0 mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t('settings.navigatorDescription')}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1">
                    {tabInfos.map((tab) => {
                      const Icon = tab.icon
                      const isActive = activeTab === tab.id
                      return (
                        <Button
                          variant="unstyled"
                          key={tab.id}
                          type="button"
                          className={cn(
                            'flex min-h-14 w-full items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors',
                            isActive
                              ? 'border-primary bg-surface-selected text-primary'
                              : 'border-transparent text-foreground hover:bg-surface-hover',
                          )}
                          onClick={() => setActiveTabOverride(tab.id)}
                          aria-label={tab.label}
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <Icon size={17} className="mt-1 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{tab.label}</span>
                              {tab.restricted ? (
                                <span className="bb-badge bb-badge-neutral">
                                  <Lock size={11} aria-hidden="true" />{' '}
                                  {t('settings.superAdminOnly')}
                                </span>
                              ) : null}
                              {tab.sensitive ? (
                                <span className="bb-badge bb-badge-warning">
                                  {t('settings.confirmRequired')}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                              {tab.description}
                            </span>
                            <span className="mt-2 flex items-center gap-2 text-xs font-normal text-muted-foreground">
                              <span>{t('settings.itemCountShort', { count: tab.itemCount })}</span>
                              {tab.dirtyCount > 0 ? (
                                <span
                                  className="bb-badge bb-badge-warning"
                                  aria-label={t('settings.tabChangeCount', {
                                    count: tab.dirtyCount,
                                  })}
                                >
                                  {t('settings.unsavedShort', { count: tab.dirtyCount })}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Button>
                      )
                    })}
                  </div>
                </nav>
              </DetailSection>
            </div>

            <div className="min-w-0 lg:col-span-3">
              {visitedTabs.has(BANNERS_TAB_ID) || activeTab === BANNERS_TAB_ID ? (
                <div hidden={activeTab !== BANNERS_TAB_ID}>
                  <Suspense fallback={<ScreenSkeleton />}>
                    <BannerScreen
                      embedded
                      canUpdate={canUpdate}
                      navigate={navigate}
                      onEditorStateChange={handleBannerEditorState}
                    />
                  </Suspense>
                </div>
              ) : null}

              {visitedTabs.has(ASSIGN_TAB_ID) || activeTab === ASSIGN_TAB_ID ? (
                <div hidden={activeTab !== ASSIGN_TAB_ID}>
                  <Suspense fallback={<ScreenSkeleton />}>
                    <AssignmentRolesScreen
                      embedded
                      canUpdate={canUpdate}
                      onEditorStateChange={handleAssignmentEditorState}
                    />
                  </Suspense>
                </div>
              ) : null}

              {activeTab && activeTab !== BANNERS_TAB_ID && activeTab !== ASSIGN_TAB_ID && (
                <SettingTabPanel
                  title={tabLabel(activeTab, t)}
                  description={tabDescription(activeTab, t)}
                  items={activeItems}
                  canUpdate={canUpdate}
                  drafts={drafts}
                  draftsEn={draftsEn}
                  errors={errors}
                  isSuperAdmin={isSuperAdmin}
                  onDraftChange={handleDraftChange}
                  onDraftChangeEn={handleDraftChangeEn}
                  onDraftBlur={handleDraftBlur}
                  onSave={handleSave}
                  onDiscard={handleDiscard}
                  saving={saving}
                  saveSuccess={saveSuccess}
                  saveError={saveError}
                />
              )}
            </div>
          </div>
        </>
      )}
    </Screen>
  )
}
