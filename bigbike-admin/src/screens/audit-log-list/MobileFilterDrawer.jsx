import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useModalFocusTrap, useBodyScrollLock } from '@/components/media-picker/useModalBehavior'
import { ACTOR_OPTIONS, PRESET_KEYS, RESOURCE_OPTIONS, getDatePreset } from './constants'

export function MobileFilterDrawer({ query, searchInput, onSearch, setSearchInput, onUpdate, onReset, onClose, isFiltered }) {
  const { t } = useTranslation()
  const sheetRef = useRef(null)
  const [localFrom, setLocalFrom] = useState(query.from)
  const [localTo, setLocalTo]     = useState(query.to)

  // Dialog semantics: khoá scroll nền + bẫy focus + Escape để đóng (trước đây thiếu).
  useBodyScrollLock()
  useModalFocusTrap({ modalRef: sheetRef, onClose })

  // Ngày bắt đầu không được sau ngày kết thúc.
  const dateError = localFrom && localTo && localFrom > localTo
    ? t('auditLog.dateRangeError', { defaultValue: 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' })
    : ''

  function applyDates() {
    if (dateError) return
    onUpdate({ from: localFrom, to: localTo }, { resetPage: true })
    onClose()
  }

  function applyPreset(preset) {
    const { from, to } = getDatePreset(preset)
    setLocalFrom(from)
    setLocalTo(to)
    onUpdate({ from, to }, { resetPage: true })
    onClose()
  }

  return (
    <div className="audit-mobile-filter-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={sheetRef}
        className="audit-mobile-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t('auditLog.mobileFilterLabel')}
      >
        <div className="audit-mobile-filter-header">
          <strong>{t('auditLog.mobileFilterLabel')}</strong>
          <Button variant="outline" size="icon" onClick={onClose} aria-label={t('auditLog.drawerClose')}><X size={16} aria-hidden="true" /></Button>
        </div>
        <div className="audit-mobile-filter-body">
          <label>
            <span>{t('auditLog.filterSearch')}</span>
            <div className="flex gap-1.5">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onSearch(); onClose() } }}
                placeholder={t('auditLog.filterSearchPlaceholder')}
               />
              <Button variant="outline" onClick={() => { onSearch(); onClose() }}>
                {t('auditLog.mobileSearchBtn')}
              </Button>
            </div>
          </label>

          <label>
            <span>{t('auditLog.filterModule')}</span>
            <Select value={query.resourceType}
              onValueChange={(val) => onUpdate({ resourceType: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {RESOURCE_OPTIONS.filter((r) => r !== 'ALL').map((r) => (
                <SelectItem key={r} value={r}>{t(`auditLog.module.${r}`, { defaultValue: r })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <label>
            <span>{t('auditLog.filterActorType')}</span>
            <Select value={query.actorType}
              onValueChange={(val) => onUpdate({ actorType: val }, { resetPage: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ALL">{t('common.all')}</SelectItem>
              {ACTOR_OPTIONS.filter((a) => a !== 'ALL').map((a) => (
                <SelectItem key={a} value={a}>{t(`auditLog.actorType.${a}`, { defaultValue: a })}</SelectItem>
              ))}
            </SelectContent></Select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">
              {t('auditLog.filterQuickTime')}
            </span>
            <div className="audit-preset-chips">
              {PRESET_KEYS.map((key) => (
                <Button key={key} variant="outline" size="sm" onClick={() => applyPreset(key)}>
                  {t(`auditLog.preset.${key}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex-1">
              <span>{t('auditLog.filterFrom')}</span>
              <Input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} aria-invalid={dateError ? true : undefined}  />
            </label>
            <label className="flex-1">
              <span>{t('auditLog.filterTo')}</span>
              <Input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} aria-invalid={dateError ? true : undefined}  />
            </label>
          </div>
          {dateError && (
            <span className="flex items-center gap-1.5 text-xs text-danger" role="alert">
              <AlertCircle size={13} aria-hidden="true" /> {dateError}
            </span>
          )}
          <Button className="w-full" onClick={applyDates} disabled={!!dateError}>
            {t('auditLog.mobileFilterApplyDates')}
          </Button>

          {isFiltered && (
            <Button variant="outline" className="w-full" onClick={() => { onReset(); onClose() }}>
              {t('auditLog.mobileFilterResetAll')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
