import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createShippingMethod,
  deleteShippingMethod,
  fetchShippingMethods, fetchShippingZones,
  updateShippingMethod,
} from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd } from '../lib/formatters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

const ZONE_ORDER = ['MB', 'MT', 'MN']

const EMPTY_METHOD_FORM = { title: '', description: '', cost: '0', freeShippingThreshold: '', enabled: true }

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
  const [methodFormSaving, setMethodFormSaving] = useState(false)

  function loadZones() {
    setZonesStatus('loading')
    fetchShippingZones({ page: 1, pageSize: 50 })
      .then((r) => {
        const fixed = r.items
          .filter((z) => ZONE_ORDER.includes(z.regionCode))
          .sort((a, b) => ZONE_ORDER.indexOf(a.regionCode) - ZONE_ORDER.indexOf(b.regionCode))
        setZones(fixed)
        setZonesStatus('success')
        setZonesWarning(r.mode === 'mock' ? r.warning : '')
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
    if (!methodForm.title.trim()) { setMethodFormError(t('common.required')); return }
    const costVal = Number(methodForm.cost)
    const thresholdRaw = methodForm.freeShippingThreshold
    if (isNaN(costVal) || costVal < 0) { setMethodFormError(t('shipping.costNonNegative')); return }
    if (thresholdRaw !== '' && (isNaN(Number(thresholdRaw)) || Number(thresholdRaw) < 0)) { setMethodFormError(t('shipping.thresholdNonNegative')); return }
    setMethodFormSaving(true)
    setMethodFormError('')
    try {
      const payload = {
        methodCode: editMethodId ? undefined : slugify(methodForm.title),
        title: methodForm.title.trim(),
        description: methodForm.description.trim() || null,
        cost: costVal,
        minOrderAmount: 0,
        freeShippingThreshold: thresholdRaw !== '' ? Number(thresholdRaw) : null,
        sortOrder: 0,
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
      loadMethods(selectedZoneId)
    } catch (e) {
      setMethodFormError(e.message || t('shipping.saveError'))
    } finally {
      setMethodFormSaving(false)
    }
  }

  async function handleDeleteMethod(methodId) {
    const confirmed = await showConfirm(t('shipping.deleteConfirm'), t('shipping.deleteTitle'))
    if (!confirmed) return
    setActionError('')
    try {
      await deleteShippingMethod(selectedZoneId, methodId)
      loadMethods(selectedZoneId)
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }

  const selectedZone = zones.find((z) => z.id === selectedZoneId)

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('shipping.eyebrow')}</p>
          <h1>{t('shipping.title')}</h1>
          <p>{t('shipping.description')}</p>
        </div>
      </header>

      {zonesWarning ? <ReadOnlyBanner warning={zonesWarning} /> : null}

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      {zonesStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
      {zonesStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={zonesError} actionLabel={t('common.retry')} onAction={loadZones} />}
      {zonesStatus === 'success' && (
        <div className="grid gap-6 grid-cols-[220px_1fr]">
          <aside>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">{t('shipping.zonesTitle').toUpperCase()}</p>
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={cn(
                  'block w-full cursor-pointer border-none text-left mb-1 px-3 py-2.5 border-l-[3px] transition-colors',
                  selectedZoneId === zone.id
                    ? 'bg-surface-selected font-semibold border-l-primary'
                    : 'bg-transparent font-normal border-l-transparent'
                )}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                {zone.name}
                <span className={`block text-xs ${zone.enabled ? 'text-success' : 'text-muted-foreground'}`}>
                  {zone.enabled ? t('common.on') : t('common.off')}
                </span>
              </button>
            ))}
          </aside>

          <main>
            {!selectedZoneId && <StatePanel tone="neutral" title={t('shipping.noZone')} description={t('shipping.noZone')} />}
            {selectedZoneId && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="m-0">{selectedZone?.name}</h2>
                    <p className="m-0 text-sm text-muted-foreground">{t('shipping.methodsTitle')}</p>
                  </div>
                  {canUpdate && (
                    <Button type="button" onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setShowMethodForm(!showMethodForm) }}>
                      {showMethodForm ? t('common.cancel') : t('shipping.addMethod')}
                    </Button>
                  )}
                </div>

                {showMethodForm && (
                  <form onSubmit={handleMethodSubmit} className="rounded-sm border border-border bg-surface p-4 mb-4">
                    <h4 className="mb-3">{editMethodId ? t('common.edit') : t('shipping.addMethod')}</h4>
                    {methodFormError && <p className="text-danger mb-2">{methodFormError}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="col-span-full">{t('shipping.formTitle')} * <Input required value={methodForm.title} onChange={(e) => setMethodForm((p) => ({ ...p, title: e.target.value }))} /></label>
                      <label className="col-span-full">{t('shipping.formDescription')} <Input value={methodForm.description} onChange={(e) => setMethodForm((p) => ({ ...p, description: e.target.value }))} /></label>
                      <label>{t('shipping.formCost')} <Input type="number" min="0" value={methodForm.cost} onChange={(e) => setMethodForm((p) => ({ ...p, cost: e.target.value }))} /></label>
                      <label>{t('shipping.formFreeThreshold')} <Input type="number" min="0" placeholder={t('shipping.formFreeThresholdHint')} value={methodForm.freeShippingThreshold} onChange={(e) => setMethodForm((p) => ({ ...p, freeShippingThreshold: e.target.value }))} /></label>
                    </div>
                    <label className="form-checkbox mt-2">
                      <Checkbox checked={methodForm.enabled} onCheckedChange={(checked) => setMethodForm((p) => ({ ...p, enabled: checked }))} />
                      <span>{t('shipping.formEnabled')}</span>
                    </label>
                    <div className="mt-3 flex gap-2">
                      <Button type="submit" loading={methodFormSaving}>{editMethodId ? t('common.save') : t('common.add')}</Button>
                      <Button variant="secondary" type="button" onClick={() => { setShowMethodForm(false); setEditMethodId(null) }}>{t('common.cancel')}</Button>
                    </div>
                  </form>
                )}

                {methodsStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
                {methodsStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={t('shipping.methodsLoadError')} actionLabel={t('common.retry')} onAction={() => loadMethods(selectedZoneId)} />}
                {methodsStatus === 'success' && methods.length === 0 && <StatePanel tone="neutral" title={t('shipping.methodsTitle')} description={t('shipping.noMethods')} />}
                {methodsStatus === 'success' && methods.length > 0 && (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border text-left">
                        <th className="py-2">{t('shipping.colTitle')}</th>
                        <th className="py-2">{t('shipping.colCost')}</th>
                        <th className="py-2">{t('shipping.colStatus')}</th>
                        {canUpdate && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...methods].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                        <tr key={m.id} className="border-b border-border">
                          <td className="py-2">{m.title}</td>
                          <td className="py-2">{formatCurrencyVnd(m.cost)}</td>
                          <td className="py-2">
                            <span className={`text-xs ${m.enabled ? 'text-success' : 'text-muted-foreground'}`}>{m.enabled ? t('common.on') : t('common.off')}</span>
                          </td>
                          {canUpdate && (
                            <td className="py-2 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="secondary" size="sm" type="button"
                                  onClick={() => { setEditMethodId(m.id); setMethodForm({ title: m.title, description: m.description || '', cost: String(m.cost), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', enabled: m.enabled }); setShowMethodForm(true) }}>{t('common.edit')}</Button>
                                <Button variant="danger" size="sm" type="button" onClick={() => handleDeleteMethod(m.id)}>{t('common.delete')}</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </section>
  )
}
