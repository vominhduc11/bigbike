import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StickyActionBar } from '@/components/layout'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { cn } from '@/lib/utils'
import { SettingField } from './SettingField'
import {
  groupBySection,
  isSettingDirty,
  isWideSetting,
  sectionDescription,
  sectionTitle,
  settingWhere,
  SECTION_GUIDE,
} from './constants'

export function SettingTabPanel({
  title, description, items, canUpdate, drafts, draftsEn, errors, onDraftChange, onDraftChangeEn,
  onDraftBlur, onSave, onDiscard, saving, saveSuccess, saveError, isSuperAdmin = false,
}) {
  const { t } = useTranslation()
  const isDirtyField = (setting) => isSettingDirty(setting, drafts, draftsEn)
  const dirtyCount = items.filter(isDirtyField).length
  const hasError = items.some((setting) => errors[setting.key])

  const sections = useMemo(() => groupBySection(items), [items])
  const errorSections = useMemo(
    () => new Set(
      sections
        .slice(1)
        .filter(({ fields }) => fields.some((setting) => errors[setting.key]))
        .map(({ sec }) => sec),
    ),
    [errors, sections],
  )
  const [openOverride, setOpenOverride] = useState({})
  const isOpen = (sec) => errorSections.has(sec) || (openOverride[sec] ?? false)
  const toggle = (sec) => setOpenOverride((previous) => ({
    ...previous,
    [sec]: !(previous[sec] ?? false),
  }))

  const renderFields = (fields) => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {fields.map((setting) => (
        <div key={setting.key} className={cn(isWideSetting(setting) && 'xl:col-span-2')}>
          <SettingField
            setting={setting}
            where={settingWhere(setting, t)}
            canUpdate={canUpdate && (!setting.superAdminOnly || isSuperAdmin)}
            isSuperAdmin={isSuperAdmin}
            draft={drafts[setting.key]}
            draftEn={draftsEn[setting.key]}
            error={errors[setting.key]}
            onChange={onDraftChange}
            onChangeEn={onDraftChangeEn}
            onBlur={onDraftBlur}
          />
        </div>
      ))}
    </div>
  )

  const internalLabel = t('settings.internal', { defaultValue: 'Nội bộ' })
  let actionInfo = null
  if (saveError) {
    actionInfo = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-danger" role="alert">
        <AlertCircle size={14} aria-hidden="true" /> {saveError}
      </span>
    )
  } else if (saving) {
    actionInfo = (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        {t('settings.saving', { defaultValue: 'Đang lưu thay đổi…' })}
      </span>
    )
  } else if (saveSuccess) {
    actionInfo = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-success">
        <CheckCircle2 size={15} aria-hidden="true" />
        {t('settings.saveSuccess')}
      </span>
    )
  } else {
    actionInfo = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
        <AlertCircle size={14} aria-hidden="true" />
        {t('settings.unsavedCount', { count: dirtyCount })}
      </span>
    )
  }

  return (
    <>
      <div className="bb-card overflow-hidden">
        <div className="bb-card-header">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3>{title}</h3>
              {dirtyCount > 0 ? (
                <span className="bb-badge bb-badge-warning">
                  {t('settings.unsavedShort', { count: dirtyCount, defaultValue: '{{count}} chưa lưu' })}
                </span>
              ) : null}
            </div>
            <p>{description || t('settings.panelSummary', { count: items.length, defaultValue: '{{count}} mục cài đặt' })}</p>
          </div>
          <span className="bb-badge bb-badge-neutral">
            {t('settings.panelSummary', { count: items.length, defaultValue: '{{count}} mục cài đặt' })}
          </span>
        </div>

        <div className="bb-card-body space-y-5">
          {sections.map(({ sec, fields }, idx) => {
            const meta = SECTION_GUIDE[sec]
            const secTitle = sectionTitle(sec, t)
            const secDescription = sectionDescription(sec, t)
            const dirtyInSec = fields.filter(isDirtyField).length
            const dirtyBadge = dirtyInSec > 0 ? (
              <span className="bb-badge bb-badge-warning" aria-label={t('settings.tabChangeCount', { count: dirtyInSec })}>
                {dirtyInSec}
              </span>
            ) : null

            if (idx === 0) {
              return (
                <section key={sec} className="rounded-md border border-border bg-surface-muted p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                    <div className="min-w-0">
                      <h4 className="m-0 text-base font-semibold text-foreground">{secTitle}</h4>
                      {secDescription ? (
                        <p className="mb-0 mt-1 text-sm text-muted-foreground">{secDescription}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {meta?.internal ? (
                        <span className="bb-badge bb-badge-neutral">
                          <Lock size={12} aria-hidden="true" /> {internalLabel}
                        </span>
                      ) : null}
                      {dirtyBadge}
                    </div>
                  </div>
                  {renderFields(fields)}
                </section>
              )
            }

            return (
              <CollapsibleSection
                key={sec}
                title={secTitle}
                hint={secDescription || (meta?.internal ? internalLabel : undefined)}
                open={isOpen(sec)}
                onToggle={() => toggle(sec)}
                keepMounted
                badge={dirtyBadge}
              >
                {renderFields(fields)}
              </CollapsibleSection>
            )
          })}
        </div>
      </div>

      {canUpdate && (dirtyCount > 0 || saving || saveSuccess || saveError) ? (
        <StickyActionBar ariaLabel={t('common.actionBarLabel')} info={actionInfo}>
          {dirtyCount > 0 ? (
            <Button className="min-h-11" variant="secondary" onClick={onDiscard} disabled={saving}>
              {t('common.cancel')}
            </Button>
          ) : null}
          {dirtyCount > 0 ? (
            <Button
              className="min-h-11"
              loading={saving}
              disabled={hasError}
              onClick={onSave}
            >
              {t('settings.saveCount', { count: dirtyCount })}
            </Button>
          ) : null}
        </StickyActionBar>
      ) : null}
    </>
  )
}
