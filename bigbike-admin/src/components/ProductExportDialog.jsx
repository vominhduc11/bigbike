import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { ExportButton } from '@/components/ExportButton'
import {
  PRODUCT_EXPORT_COLUMN_GROUPS,
  PRODUCT_EXPORT_PRESETS,
  columnsForPreset,
} from '@/lib/productExport'

const MAX_SELECTED_IDS = 200

export function ProductExportDialog({
  open,
  onOpenChange,
  query,
  totalItems,
  selectedIds,
  preferences,
  onPreferencesChange,
  onExport,
}) {
  const { t } = useTranslation()
  const [scope, setScope] = useState('FILTERED')
  const [preset, setPreset] = useState(preferences.preset)
  const [selectedColumns, setSelectedColumns] = useState(
    () => preferences.columns || columnsForPreset(preferences.preset),
  )
  const [isCustomColumns, setIsCustomColumns] = useState(Array.isArray(preferences.columns))
  const [includeDraft, setIncludeDraft] = useState(preferences.includeDraft)
  const [includeTrash, setIncludeTrash] = useState(preferences.includeTrash)
  const [columnSearch, setColumnSearch] = useState('')

  useEffect(() => {
    if (!open) return
    // Dialog state is intentionally rehydrated from the per-admin browser preset on open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScope('FILTERED')
    setPreset(preferences.preset)
    setSelectedColumns(preferences.columns || columnsForPreset(preferences.preset))
    setIsCustomColumns(Array.isArray(preferences.columns))
    setIncludeDraft(preferences.includeDraft)
    setIncludeTrash(preferences.includeTrash)
    setColumnSearch('')
  }, [open, preferences])

  const statusIsAll = query.publishStatus === 'ALL' || !query.publishStatus
  const selectedTooMany = selectedIds.length > MAX_SELECTED_IDS
  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns])
  const normalizedSearch = columnSearch.trim().toLowerCase()
  const columnLabel = useCallback(
    (column) =>
      t(`products.exportDialog.columnLabels.${column}`, { defaultValue: t('common.unknown') }),
    [t],
  )

  const visibleGroups = useMemo(
    () =>
      PRODUCT_EXPORT_COLUMN_GROUPS.map((group) => {
        const groupMatches =
          normalizedSearch && t(group.labelKey).toLowerCase().includes(normalizedSearch)
        const columns = groupMatches
          ? group.columns
          : group.columns.filter(
              (column) =>
                column.toLowerCase().includes(normalizedSearch) ||
                columnLabel(column).toLowerCase().includes(normalizedSearch),
            )
        return { ...group, visibleColumns: columns }
      }).filter((group) => group.visibleColumns.length > 0),
    [columnLabel, normalizedSearch, t],
  )

  function rememberPreferences() {
    onPreferencesChange({
      preset,
      columns: isCustomColumns ? selectedColumns : null,
      includeDraft,
      includeTrash,
    })
  }

  function handleOpenChange(nextOpen) {
    if (!nextOpen) rememberPreferences()
    onOpenChange(nextOpen)
  }

  function handlePresetChange(nextPreset) {
    setPreset(nextPreset)
    setSelectedColumns(columnsForPreset(nextPreset))
    setIsCustomColumns(false)
  }

  function toggleColumn(column, checked) {
    if (column === 'sku') return
    setIsCustomColumns(true)
    setSelectedColumns((previous) => {
      if (checked) return previous.includes(column) ? previous : [...previous, column]
      return previous.filter((item) => item !== column)
    })
  }

  function toggleGroup(group, checked) {
    setIsCustomColumns(true)
    setSelectedColumns((previous) => {
      const next = new Set(previous)
      group.columns.forEach((column) => {
        if (column === 'sku') return
        if (checked) next.add(column)
        else next.delete(column)
      })
      next.add('sku')
      return group.columns.length > 0 ? [...next] : previous
    })
  }

  function renderGroup(group) {
    const selectedCount = group.columns.filter((column) => selectedSet.has(column)).length
    const groupChecked = selectedCount === group.columns.length
    const groupState = selectedCount === 0 || groupChecked ? groupChecked : 'indeterminate'
    const groupId = `product-export-group-${group.key.toLowerCase()}`
    const groupLabel = t(group.labelKey)
    return (
      <div
        key={group.key}
        className="rounded-[var(--admin-radius-control)] border border-border p-3"
      >
        <div className="flex items-center gap-3">
          <Checkbox
            id={groupId}
            checked={groupState}
            onCheckedChange={(checked) => toggleGroup(group, checked === true)}
            aria-label={groupLabel}
          />
          <label
            htmlFor={groupId}
            className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 text-sm font-semibold"
          >
            <span>{groupLabel}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {selectedCount}/{group.columns.length}
            </span>
          </label>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {group.visibleColumns.map((column) => {
            const columnId = `product-export-column-${column}`
            const isSku = column === 'sku'
            const label = columnLabel(column)
            return (
              <div key={column} className="flex items-center gap-3">
                <Checkbox
                  id={columnId}
                  checked={selectedSet.has(column)}
                  disabled={isSku}
                  onCheckedChange={(checked) => toggleColumn(column, checked === true)}
                  aria-label={`${label} (${column})`}
                />
                <label
                  htmlFor={columnId}
                  className="flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-3 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  <span className="grid min-w-0 gap-1">
                    <span className="text-sm text-foreground">{label}</span>
                    <span className="break-all font-mono text-xs text-muted-foreground">
                      {column}
                    </span>
                  </span>
                  {isSku ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t('products.exportDialog.skuRequired')}
                    </span>
                  ) : null}
                </label>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const exportDisabled = selectedTooMany || (isCustomColumns && selectedColumns.length === 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('products.exportDialog.title')}</DialogTitle>
          <DialogDescription>{t('products.exportDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('products.exportDialog.scopeLabel')}
            </h3>
            <RadioGroup value={scope} onValueChange={setScope} className="gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-control)] border border-border p-3">
                <RadioGroupItem
                  value="FILTERED"
                  id="product-export-scope-filtered"
                  className="mt-1"
                />
                <span className="grid gap-1 text-sm">
                  <span>{t('products.exportDialog.scopeFiltered', { count: totalItems })}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('products.exportDialog.scopeFilteredHint')}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-control)] border border-border p-3">
                <RadioGroupItem
                  value="SELECTED"
                  id="product-export-scope-selected"
                  disabled={selectedIds.length === 0}
                  className="mt-1"
                />
                <span className="grid gap-1 text-sm">
                  <span>
                    {selectedIds.length > 0
                      ? t('products.exportDialog.scopeSelected', { count: selectedIds.length })
                      : t('products.exportDialog.scopeSelectedEmpty')}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('products.exportDialog.scopeSelectedHint')}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-control)] border border-border p-3">
                <RadioGroupItem value="ALL" id="product-export-scope-all" className="mt-1" />
                <span className="grid gap-1 text-sm">
                  <span>{t('products.exportDialog.scopeAll')}</span>
                  <span className="text-xs text-muted-foreground">
                    {t('products.exportDialog.scopeAllHint')}
                  </span>
                </span>
              </label>
            </RadioGroup>
          </section>

          {scope !== 'ALL' && statusIsAll ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('products.exportDialog.statusLabel')}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox
                    checked={includeDraft}
                    onCheckedChange={(checked) => setIncludeDraft(checked === true)}
                  />
                  <span>{t('products.exportDialog.includeDraft')}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox
                    checked={includeTrash}
                    onCheckedChange={(checked) => setIncludeTrash(checked === true)}
                  />
                  <span>{t('products.exportDialog.includeTrash')}</span>
                </label>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('products.exportDialog.presetLabel')}
            </h3>
            <RadioGroup
              value={preset}
              onValueChange={handlePresetChange}
              className="grid gap-3 sm:grid-cols-2"
            >
              {PRODUCT_EXPORT_PRESETS.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-start gap-3 rounded-[var(--admin-radius-control)] border border-border p-3"
                >
                  <RadioGroupItem
                    value={item.key}
                    id={`product-export-preset-${item.key.toLowerCase()}`}
                    className="mt-1"
                  />
                  <span className="grid gap-1 text-sm">
                    <span className="font-semibold">{t(item.labelKey)}</span>
                    <span className="text-xs text-muted-foreground">{t(item.descriptionKey)}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t('products.exportDialog.columnsLabel')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('products.exportDialog.columnsSummary', { count: selectedColumns.length })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('products.exportDialog.technicalKeyHint')}
                </p>
              </div>
              <Input
                value={columnSearch}
                onChange={(event) => setColumnSearch(event.target.value)}
                placeholder={t('products.exportDialog.columnSearch')}
                aria-label={t('products.exportDialog.columnSearch')}
                className="sm:max-w-64"
              />
            </div>
            <div className="grid max-h-80 gap-3 overflow-y-auto pe-1">
              {visibleGroups.map(renderGroup)}
            </div>
          </section>

          {selectedTooMany ? (
            <Alert tone="warning">{t('products.exportDialog.selectedTooMany')}</Alert>
          ) : null}
          {isCustomColumns && selectedColumns.length === 0 ? (
            <Alert tone="warning">{t('products.exportDialog.noColumns')}</Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('products.exportDialog.cancel')}
          </Button>
          <ExportButton
            disabled={exportDisabled}
            onExport={async () => {
              rememberPreferences()
              await onExport({
                scope,
                preset,
                columns: isCustomColumns ? selectedColumns : undefined,
                includeDraft: statusIsAll && scope !== 'ALL' ? includeDraft : false,
                includeTrash: statusIsAll && scope !== 'ALL' ? includeTrash : false,
              })
            }}
          >
            {t('products.exportDialog.confirm')}
          </ExportButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
