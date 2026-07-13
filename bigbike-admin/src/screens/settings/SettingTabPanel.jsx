import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StickyActionBar } from '@/components/layout'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { SettingField } from './SettingField'
import { groupBySection, sectionTitle, settingWhere, SECTION_GUIDE } from './constants'

export function SettingTabPanel({
  title, items, canUpdate, drafts, draftsEn, errors, onDraftChange, onDraftChangeEn,
  onDraftBlur, onSave, onDiscard, saving,
}) {
  const { t } = useTranslation()
  const isDirtyField = (s) => drafts[s.key] !== undefined || draftsEn[s.key] !== undefined
  const dirtyCount = items.filter(isDirtyField).length
  const hasError = items.some((s) => errors[s.key])

  const sections = useMemo(() => groupBySection(items), [items])
  // Chống ngợp: khối đầu (bắt buộc/thường dùng) luôn mở; các khối sau gom vào
  // CollapsibleSection, đóng sẵn — admin bung khi cần. `keepMounted` để không
  // giấu lỗi/không reset ô khi đóng.
  const [openOverride, setOpenOverride] = useState({})
  const isOpen = (sec) => openOverride[sec] ?? false
  const toggle = (sec) => setOpenOverride((p) => ({ ...p, [sec]: !(p[sec] ?? false) }))

  const renderField = (setting) => (
    <SettingField
      key={setting.key}
      setting={setting}
      where={settingWhere(setting, t)}
      canUpdate={canUpdate}
      draft={drafts[setting.key]}
      draftEn={draftsEn[setting.key]}
      error={errors[setting.key]}
      onChange={onDraftChange}
      onChangeEn={onDraftChangeEn}
      onBlur={onDraftBlur}
    />
  )

  const internalLabel = t('settings.internal', { defaultValue: 'Nội bộ' })

  return (
    <>
      <div className="bb-card">
        <div className="bb-card-header">
          <div>
            <h3>{title}</h3>
            <p>{t('settings.panelSummary', { count: items.length, defaultValue: '{{count}} mục cài đặt' })}</p>
          </div>
        </div>
        <div className="bb-card-body">
          {sections.map(({ sec, fields }, idx) => {
            const meta = SECTION_GUIDE[sec]
            const secTitle = sectionTitle(sec, t)
            const dirtyInSec = fields.filter(isDirtyField).length
            const dirtyBadge = dirtyInSec > 0 ? (
              <span className="bb-badge bb-badge-warning" aria-label={t('settings.tabChangeCount', { count: dirtyInSec })}>
                {dirtyInSec}
              </span>
            ) : null

            // Khối đầu: giữ mở, render phẳng như trước (không cần chevron cho khối luôn hiện).
            if (idx === 0) {
              return (
                <div key={sec}>
                  <div className="flex items-center justify-between gap-2 mt-4 mb-3 pb-2 border-b border-border">
                    <span className="font-semibold text-[length:var(--admin-text-sm)]">{secTitle}</span>
                    {meta?.internal ? (
                      <span className="bb-muted inline-flex items-center gap-1 text-xs whitespace-nowrap">
                        <Lock size={12} /> {internalLabel}
                      </span>
                    ) : null}
                  </div>
                  {fields.map(renderField)}
                </div>
              )
            }

            return (
              <CollapsibleSection
                key={sec}
                title={secTitle}
                hint={meta?.internal ? internalLabel : undefined}
                open={isOpen(sec)}
                onToggle={() => toggle(sec)}
                keepMounted
                badge={dirtyBadge}
              >
                {fields.map(renderField)}
              </CollapsibleSection>
            )
          })}
        </div>
      </div>

      {canUpdate && dirtyCount > 0 && (
        <StickyActionBar
          ariaLabel={t('common.actionBarLabel')}
          info={
            <span className="settings-unsaved-hint">
              <AlertCircle size={14} />
              {t('settings.unsavedCount', { count: dirtyCount })}
            </span>
          }
        >
          <Button variant="secondary" size="sm" onClick={onDiscard} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" loading={saving} disabled={hasError} onClick={onSave}>
            {t('settings.saveCount', { count: dirtyCount })}
          </Button>
        </StickyActionBar>
      )}
    </>
  )
}
