import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { Modal, FormField } from '../../components/layout'
import { FilterSelect } from '../../components/FilterSelect'
import { PageSizeSelect } from '../../components/PageSizeSelect'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ACTOR_OPTIONS, PRESET_KEYS, RESOURCE_OPTIONS, getDatePreset } from './constants'

export function MobileFilterDrawer({
  query,
  searchInput,
  activeFilterCount,
  onApply,
  onReset,
  onClose,
  isFiltered,
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState({
    q: searchInput,
    resourceType: query.resourceType,
    actorType: query.actorType,
    pageSize: query.pageSize,
    from: query.from,
    to: query.to,
  })
  const [activePreset, setActivePreset] = useState(null)

  const dateError =
    draft.from && draft.to && draft.from > draft.to
      ? t('auditLog.dateRangeError', {
          defaultValue: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
        })
      : ''

  function updateDraft(partial) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function applyPreset(preset) {
    setActivePreset(preset)
    updateDraft(getDatePreset(preset))
  }

  function applyFilters() {
    if (dateError) return
    onApply(draft)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('auditLog.mobileFilterLabel')}
      description={
        activeFilterCount > 0
          ? t('auditLog.mobileFiltersApplied', {
              count: activeFilterCount,
              defaultValue: `Đang áp dụng ${activeFilterCount} bộ lọc`,
            })
          : t('auditLog.mobileFilterDescription', {
              defaultValue: 'Thu hẹp danh sách theo người thực hiện, khu vực và thời gian.',
            })
      }
      closeLabel={t('auditLog.drawerClose')}
      actions={
        <>
          {isFiltered ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                onReset()
                onClose()
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              {t('auditLog.mobileFilterResetAll')}
            </Button>
          ) : null}
          <Button className="min-h-11" onClick={applyFilters} disabled={Boolean(dateError)}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            {t('auditLog.mobileFilterApply', { defaultValue: 'Áp dụng bộ lọc' })}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <FormField label={t('auditLog.filterSearch')}>
          <Input
            type="search"
            value={draft.q}
            onChange={(event) => updateDraft({ q: event.target.value })}
            placeholder={t('auditLog.filterSearchPlaceholder')}
            className="min-h-11"
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('auditLog.filterModule')}>
            <FilterSelect
              value={draft.resourceType}
              onValueChange={(value) => updateDraft({ resourceType: value })}
              ariaLabel={t('auditLog.filterModule')}
              className="min-h-11 w-full"
              options={RESOURCE_OPTIONS.map((resourceType) => ({
                value: resourceType,
                label:
                  resourceType === 'ALL'
                    ? t('common.all')
                    : t(`auditLog.module.${resourceType}`, { defaultValue: resourceType }),
              }))}
            />
          </FormField>

          <FormField label={t('auditLog.filterActorType')}>
            <FilterSelect
              value={draft.actorType}
              onValueChange={(value) => updateDraft({ actorType: value })}
              ariaLabel={t('auditLog.filterActorType')}
              className="min-h-11 w-full"
              options={ACTOR_OPTIONS.map((actorType) => ({
                value: actorType,
                label:
                  actorType === 'ALL'
                    ? t('common.all')
                    : t(`auditLog.actorType.${actorType}`, { defaultValue: actorType }),
              }))}
            />
          </FormField>
        </div>

        <FormField label={t('auditLog.pageSizeLabel')}>
          <PageSizeSelect
            value={draft.pageSize}
            onChange={(pageSize) => updateDraft({ pageSize })}
            className="min-h-11 w-full"
          />
        </FormField>

        <fieldset className="grid gap-3">
          <legend className="text-sm font-semibold text-foreground">
            {t('auditLog.filterQuickTime')}
          </legend>
          <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface-muted p-1">
            {PRESET_KEYS.map((key) => (
              <Button
                key={key}
                variant={activePreset === key ? 'default' : 'ghost'}
                size="sm"
                className="min-h-9 flex-1"
                onClick={() => applyPreset(key)}
              >
                {t(`auditLog.preset.${key}`)}
              </Button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('auditLog.filterFrom')}>
            <Input
              type="date"
              value={draft.from}
              aria-invalid={dateError ? true : undefined}
              onChange={(event) => {
                setActivePreset(null)
                updateDraft({ from: event.target.value })
              }}
              className="min-h-11"
            />
          </FormField>
          <FormField label={t('auditLog.filterTo')}>
            <Input
              type="date"
              value={draft.to}
              aria-invalid={dateError ? true : undefined}
              onChange={(event) => {
                setActivePreset(null)
                updateDraft({ to: event.target.value })
              }}
              className="min-h-11"
            />
          </FormField>
        </div>

        {dateError ? (
          <Alert tone="danger" size="sm">
            {dateError}
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
