import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createShippingMethod,
  deleteShippingMethod,
  fetchShippingMethods, fetchShippingZones,
  updateShippingMethod,
} from '../lib/adminApi'
import { GripVertical } from 'lucide-react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { SortableList } from '../components/Sortable'
import { MobileCardList, MobileCard } from '../components/layout/MobileCardList'
import { FormField } from '../components/layout/FormField'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd } from '../lib/formatters'
import { useContentLang } from '../lib/contentLang'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const ZONE_ORDER = ['MB', 'MT', 'MN']

const EMPTY_METHOD_FORM = { title: '', titleEn: '', cost: '0', freeShippingThreshold: '', enabled: true }

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 30) + '-' + Date.now().toString(36)
}

export function ShippingScreen({ canUpdate }) {
  const { t } = useTranslation()
  // Ngôn ngữ NỘI DUNG (nút VI/EN ở header). Chỉ đổi tên hiển thị của phương thức
  // vận chuyển; giao diện admin vẫn cố định tiếng Việt.
  const contentLang = useContentLang()
  const methodTitle = (m) => (contentLang === 'en' ? (m.titleEn || m.title) : m.title)
  const [zones, setZones] = useState([])
  const [zonesStatus, setZonesStatus] = useState('loading')
  const [zonesWarning, setZonesWarning] = useState('')
  const [zonesError, setZonesError] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [methods, setMethods] = useState([])
  const [methodsStatus, setMethodsStatus] = useState('idle')
  const [actionError, setActionError] = useState('')

  const [showMethodForm, setShowMethodForm] = useState(false)
  const [methodForm, setMethodForm] = useState(EMPTY_METHOD_FORM)
  const [editMethodId, setEditMethodId] = useState(null)
  const [methodFormError, setMethodFormError] = useState('')
  const [methodFieldErrors, setMethodFieldErrors] = useState({})
  const [methodFormSaving, setMethodFormSaving] = useState(false)
  // Phản hồi success ngắn sau khi tạo/sửa/xoá phương thức (tự ẩn sau ~4.5s).
  const [successMessage, setSuccessMessage] = useState('')

  // Validate từng field, trả về thông báo lỗi (chuỗi rỗng = hợp lệ). Dùng chung
  // cho cả onBlur (reward early) lẫn submit (chốt chặn).
  function validateTitle(value) {
    return value.trim() ? '' : t('common.required')
  }
  function validateCost(value) {
    // Empty được hiểu là 0 (giữ đúng hành vi cũ); chỉ chặn số âm / không hợp lệ.
    const n = Number(value)
    return (isNaN(n) || n < 0) ? t('shipping.costNonNegative') : ''
  }
  function validateThreshold(value) {
    if (value === '') return ''
    const n = Number(value)
    return (isNaN(n) || n < 0) ? t('shipping.thresholdNonNegative') : ''
  }

  function showSuccess(message) {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(''), 4500)
  }

  function loadZones() {
    setZonesStatus('loading')
    fetchShippingZones({ page: 1, pageSize: 50 })
      .then((r) => {
        const fixed = r.items
          .filter((z) => ZONE_ORDER.includes(z.regionCode))
          .sort((a, b) => ZONE_ORDER.indexOf(a.regionCode) - ZONE_ORDER.indexOf(b.regionCode))
        setZones(fixed)
        setZonesStatus('success')
        setZonesWarning('')
        setSelectedZoneId((prev) => prev ?? (fixed[0]?.id ?? null))
      })
      .catch((e) => { setZonesStatus('error'); setZonesError(e.message) })
  }

  function loadMethods(zoneId) {
    setMethodsStatus('loading')
    setMethods([])
    fetchShippingMethods(zoneId)
      .then((r) => { setMethods(r.items); setMethodsStatus('success') })
      .catch(() => setMethodsStatus('error'))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadZones() }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedZoneId) loadMethods(selectedZoneId) }, [selectedZoneId])

  async function handleMethodSubmit(e) {
    e.preventDefault()
    const thresholdRaw = methodForm.freeShippingThreshold
    const fieldErrors = {
      title: validateTitle(methodForm.title),
      cost: validateCost(methodForm.cost),
      threshold: validateThreshold(thresholdRaw),
    }
    if (fieldErrors.title || fieldErrors.cost || fieldErrors.threshold) {
      setMethodFieldErrors(fieldErrors)
      setMethodFormError('')
      return
    }
    const costVal = Number(methodForm.cost)
    setMethodFieldErrors({})
    setMethodFormSaving(true)
    setMethodFormError('')
    try {
      const payload = {
        methodCode: editMethodId ? undefined : slugify(methodForm.title),
        title: methodForm.title.trim(),
        titleEn: methodForm.titleEn.trim(),

        cost: costVal,
        minOrderAmount: 0,
        freeShippingThreshold: thresholdRaw !== '' ? Number(thresholdRaw) : null,
        // New methods append at the end; editing preserves the method's current
        // position instead of resetting it to 0 (drag-reorder owns sortOrder).
        sortOrder: editMethodId
          ? (methods.find((m) => m.id === editMethodId)?.sortOrder ?? 0)
          : methods.length,
        enabled: methodForm.enabled,
      }
      if (editMethodId) {
        await updateShippingMethod(selectedZoneId, editMethodId, payload)
      } else {
        await createShippingMethod(selectedZoneId, payload)
      }
      setShowMethodForm(false)
      setEditMethodId(null)
      setMethodForm(EMPTY_METHOD_FORM)
      setMethodFieldErrors({})
      showSuccess(t('shipping.saveSuccess', { defaultValue: 'Đã lưu phương thức giao hàng' }))
      loadMethods(selectedZoneId)
    } catch (e) {
      setMethodFormError(e.message || t('shipping.saveError'))
    } finally {
      setMethodFormSaving(false)
    }
  }

  async function handleDeleteMethod(methodId) {
    const target = methods.find((m) => m.id === methodId)
    const name = target ? methodTitle(target) : ''
    const confirmed = await showConfirm(
      name
        ? t('shipping.deleteConfirmNamed', { title: name, defaultValue: 'Xoá phương thức "{{title}}"? Hành động không thể hoàn tác.' })
        : t('shipping.deleteConfirm'),
      t('shipping.deleteTitle'),
      { variant: 'danger', confirmLabel: t('common.delete') },
    )
    if (!confirmed) return
    setActionError('')
    try {
      await deleteShippingMethod(selectedZoneId, methodId)
      showSuccess(t('shipping.deleteSuccess', { defaultValue: 'Đã xoá phương thức giao hàng' }))
      loadMethods(selectedZoneId)
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId)
  // Admin VI/EN switch (strict English): ở EN chỉ hiện phương thức đã có tên tiếng Anh.
  const visibleMethods = contentLang === 'en'
    ? methods.filter((m) => (m.titleEn || '').trim() !== '')
    : methods
  const sortedMethods = [...visibleMethods].sort((a, b) => a.sortOrder - b.sortOrder)

  // Persist a drag-reorder. No batch endpoint and no UNIQUE(zone, sort_order)
  // constraint, so we PATCH each moved method sequentially (recoverable on a
  // partial failure) and roll the list back if any call throws.
  async function handleReorderMethods(next) {
    const previous = methods
    const withOrder = next.map((m, i) => ({ ...m, sortOrder: i }))
    setMethods(withOrder)
    setActionError('')
    try {
      for (const m of withOrder) {
        const before = previous.find((p) => p.id === m.id)
        if (before && before.sortOrder === m.sortOrder) continue
        await updateShippingMethod(selectedZoneId, m.id, { sortOrder: m.sortOrder })
      }
    } catch (e) {
      setMethods(previous)
      setActionError(e.message || t('shipping.saveError'))
    }
  }

  return (
    <div>
      <div className="bb-screen-header">
        <div className="bb-screen-title">
          <p className="bb-screen-eyebrow">{t('shipping.eyebrow')}</p>
          <h1>{t('shipping.title')}</h1>
          <p className="bb-muted">{t('shipping.description')}</p>
        </div>
      </div>

      {zonesWarning ? <ReadOnlyBanner warning={zonesWarning} /> : null}

      {actionError && (
        <Alert tone="danger" dismissible onDismiss={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {successMessage && (
        <Alert tone="success" dismissible onDismiss={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      {zonesStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
      {zonesStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={zonesError} actionLabel={t('common.retry')} onAction={loadZones} />}

      {zonesStatus === 'success' && (
        <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-[200px_1fr]">
          {/* Zone sidebar */}
          <nav
            className="flex flex-col gap-0 border border-border rounded-sm overflow-hidden"
            aria-label={t('shipping.zonesTitle')}
          >
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm border-b border-border last:border-b-0 transition-colors hover:bg-surface-muted ${selectedZoneId === zone.id ? 'bg-brand-subtle font-semibold text-brand' : 'text-foreground'}`}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                <span>{zone.name}</span>
                <span className={`text-xs ${zone.enabled ? 'text-success' : 'text-muted-foreground'}`}>
                  {zone.enabled ? t('common.on') : t('common.off')}
                </span>
              </button>
            ))}
          </nav>

          <div>
            {!selectedZoneId && <StatePanel tone="neutral" title={t('shipping.noZone')} description={t('shipping.noZone')} />}
            {selectedZoneId && (
              <>
                {/* Add/edit method form */}
                {showMethodForm && (
                  <div className="bb-card mb-4">
                    <div className="bb-card-header"><h3>{editMethodId ? t('common.edit') : t('shipping.addMethod')}</h3></div>
                    <form onSubmit={handleMethodSubmit} className="bb-card-body">
                      {methodFormError && <Alert tone="danger" size="sm" className="mb-3">{methodFormError}</Alert>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <FormField
                            htmlFor="shipping-method-title"
                            label={t('shipping.formTitle')}
                            required
                            error={methodFieldErrors.title}
                          >
                            <Input
                              value={methodForm.title}
                              onChange={(e) => {
                                setMethodForm((p) => ({ ...p, title: e.target.value }))
                                if (methodFieldErrors.title) setMethodFieldErrors((p) => ({ ...p, title: '' }))
                              }}
                              onBlur={(e) => setMethodFieldErrors((p) => ({ ...p, title: validateTitle(e.target.value) }))}
                            />
                          </FormField>
                        </div>
                        <div className="col-span-2">
                          <FormField
                            htmlFor="shipping-method-title-en"
                            label={t('shipping.formTitleEn')}
                            helper={t('shipping.formTitleEnHint')}
                          >
                            <Input value={methodForm.titleEn} onChange={(e) => setMethodForm((p) => ({ ...p, titleEn: e.target.value }))} />
                          </FormField>
                        </div>
                        <FormField
                          htmlFor="shipping-method-cost"
                          label={t('shipping.formCost')}
                          error={methodFieldErrors.cost}
                        >
                          <Input
                            type="number"
                            min="0"
                            value={methodForm.cost}
                            onChange={(e) => {
                              setMethodForm((p) => ({ ...p, cost: e.target.value }))
                              if (methodFieldErrors.cost) setMethodFieldErrors((p) => ({ ...p, cost: '' }))
                            }}
                            onBlur={(e) => setMethodFieldErrors((p) => ({ ...p, cost: validateCost(e.target.value) }))}
                          />
                        </FormField>
                        <FormField
                          htmlFor="shipping-method-threshold"
                          label={t('shipping.formFreeThreshold')}
                          helper={t('shipping.formFreeThresholdHint')}
                          error={methodFieldErrors.threshold}
                        >
                          <Input
                            type="number"
                            min="0"
                            value={methodForm.freeShippingThreshold}
                            onChange={(e) => {
                              setMethodForm((p) => ({ ...p, freeShippingThreshold: e.target.value }))
                              if (methodFieldErrors.threshold) setMethodFieldErrors((p) => ({ ...p, threshold: '' }))
                            }}
                            onBlur={(e) => setMethodFieldErrors((p) => ({ ...p, threshold: validateThreshold(e.target.value) }))}
                          />
                        </FormField>
                      </div>
                      <label className="mt-2 flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                        <Checkbox checked={methodForm.enabled} onCheckedChange={(checked) => setMethodForm((p) => ({ ...p, enabled: checked }))} />
                        <span>{t('shipping.formEnabled')}</span>
                      </label>
                      <div className="mt-4 flex gap-2">
                        <Button type="submit" loading={methodFormSaving}>{editMethodId ? t('common.save') : t('common.add')}</Button>
                        <Button variant="secondary" type="button" onClick={() => { setShowMethodForm(false); setEditMethodId(null); setMethodFieldErrors({}); setMethodFormError('') }}>{t('common.cancel')}</Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Methods card */}
                <div className="bb-card">
                  <div className="bb-card-header">
                    <div>
                      <h3>{selectedZone?.name}</h3>
                      <p>{t('shipping.methodsTitle')}</p>
                    </div>
                    {canUpdate && (
                      <Button
                        size="sm"
                        variant={showMethodForm ? 'secondary' : 'default'}
                        onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setMethodFieldErrors({}); setMethodFormError(''); setShowMethodForm(!showMethodForm) }}
                      >
                        {showMethodForm ? t('common.cancel') : t('shipping.addMethod')}
                      </Button>
                    )}
                  </div>
                  <div className="bb-card-body bb-card-body--flush">
                    {methodsStatus === 'loading' && (
                      <StatePanel tone="info" title={t('shipping.loading')} />
                    )}
                    {methodsStatus === 'error' && (
                      <StatePanel tone="danger" title={t('shipping.methodsLoadError')} actionLabel={t('common.retry')} onAction={() => loadMethods(selectedZoneId)} />
                    )}
                    {methodsStatus === 'success' && sortedMethods.length === 0 && (
                      <StatePanel tone="neutral" title={t('shipping.methodsTitle')} description={t('shipping.noMethods')} />
                    )}
                    {methodsStatus === 'success' && sortedMethods.length > 0 && (
                      <>
                      <div className="hide-on-mobile">
                      <div className="bb-table-wrap">
                        <table className="bb-table">
                          <thead>
                            <tr>
                              {canUpdate && <th className="w-10" aria-hidden="true" />}
                              <th>{t('shipping.colTitle')}</th>
                              <th className="num">{t('shipping.colCost')}</th>
                              <th>{t('shipping.colStatus')}</th>
                              {canUpdate && <th />}
                            </tr>
                          </thead>
                          <SortableList
                            as="tbody"
                            items={sortedMethods}
                            disabled={!canUpdate}
                            onReorder={handleReorderMethods}
                            renderItem={(m, sortable) => (
                              <tr
                                ref={sortable.setNodeRef}
                                style={sortable.style}
                                className={sortable.isDragging ? 'opacity-40' : undefined}
                              >
                                {canUpdate && (
                                  <td>
                                    <button
                                      type="button"
                                      {...sortable.handleProps}
                                      className="bb-icon-btn cursor-grab touch-none"
                                      title={t('shipping.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
                                      aria-label={t('shipping.dragToReorder', { defaultValue: 'Kéo để sắp xếp' })}
                                    >
                                      <GripVertical size={16} />
                                    </button>
                                  </td>
                                )}
                                <td className="font-semibold">{methodTitle(m)}</td>
                                <td className="num">{formatCurrencyVnd(m.cost)}</td>
                                <td>
                                  <span className={`bb-badge ${m.enabled ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
                                    <span className="dot" />{m.enabled ? t('common.on') : t('common.off')}
                                  </span>
                                </td>
                                {canUpdate && (
                                  <td className="col-actions">
                                    <button
                                      type="button"
                                      className="bb-btn bb-btn-ghost bb-btn-sm"
                                      onClick={() => { setEditMethodId(m.id); setMethodForm({ title: m.title, titleEn: m.titleEn || '', cost: String(m.cost), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', enabled: m.enabled }); setMethodFieldErrors({}); setMethodFormError(''); setShowMethodForm(true) }}
                                    >
                                      {t('common.edit')}
                                    </button>
                                    <button type="button" className="bb-btn bb-btn-danger-ghost bb-btn-sm" onClick={() => handleDeleteMethod(m.id)}>
                                      {t('common.delete')}
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )}
                          />
                        </table>
                      </div>
                      </div>
                      <MobileCardList>
                        {sortedMethods.map((m) => (
                          <MobileCard
                            key={m.id}
                            title={methodTitle(m)}
                            status={(
                              <span className={`bb-badge ${m.enabled ? 'bb-badge-success' : 'bb-badge-neutral'}`}>
                                <span className="dot" />{m.enabled ? t('common.on') : t('common.off')}
                              </span>
                            )}
                            meta={[
                              { label: t('shipping.colCost'), value: formatCurrencyVnd(m.cost), tone: 'strong' },
                            ]}
                            actions={canUpdate ? (
                              <>
                                <button
                                  type="button"
                                  className="bb-btn bb-btn-ghost bb-btn-sm"
                                  onClick={() => { setEditMethodId(m.id); setMethodForm({ title: m.title, titleEn: m.titleEn || '', cost: String(m.cost), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', enabled: m.enabled }); setMethodFieldErrors({}); setMethodFormError(''); setShowMethodForm(true) }}
                                >
                                  {t('common.edit')}
                                </button>
                                <button type="button" className="bb-btn bb-btn-danger-ghost bb-btn-sm" onClick={() => handleDeleteMethod(m.id)}>
                                  {t('common.delete')}
                                </button>
                              </>
                            ) : undefined}
                          />
                        ))}
                      </MobileCardList>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
