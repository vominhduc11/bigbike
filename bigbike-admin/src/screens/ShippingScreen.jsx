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
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
          <aside>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{t('shipping.zonesTitle').toUpperCase()}</p>
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.6rem 0.75rem', marginBottom: '0.25rem',
                  border: 'none', cursor: 'pointer',
                  background: selectedZoneId === zone.id ? 'var(--c-primary-subtle)' : 'transparent',
                  fontWeight: selectedZoneId === zone.id ? 600 : 400,
                  borderLeft: selectedZoneId === zone.id ? '3px solid var(--c-primary)' : '3px solid transparent',
                }}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                {zone.name}
                <span style={{ fontSize: '0.7rem', color: zone.enabled ? 'var(--c-success)' : 'var(--c-text-muted)', display: 'block' }}>
                  {zone.enabled ? t('common.on') : t('common.off')}
                </span>
              </button>
            ))}
          </aside>

          <main>
            {!selectedZoneId && <StatePanel tone="neutral" title={t('shipping.noZone')} description={t('shipping.noZone')} />}
            {selectedZoneId && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{selectedZone?.name}</h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{t('shipping.methodsTitle')}</p>
                  </div>
                  {canUpdate && (
                    <Button type="button" onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setShowMethodForm(!showMethodForm) }}>
                      {showMethodForm ? t('common.cancel') : t('shipping.addMethod')}
                    </Button>
                  )}
                </div>

                {showMethodForm && (
                  <form onSubmit={handleMethodSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem' }}>{editMethodId ? t('common.edit') : t('shipping.addMethod')}</h4>
                    {methodFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{methodFormError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label style={{ gridColumn: '1 / -1' }}>{t('shipping.formTitle')} * <Input required value={methodForm.title} onChange={(e) => setMethodForm((p) => ({ ...p, title: e.target.value }))} /></label>
                      <label style={{ gridColumn: '1 / -1' }}>{t('shipping.formDescription')} <Input value={methodForm.description} onChange={(e) => setMethodForm((p) => ({ ...p, description: e.target.value }))} /></label>
                      <label>{t('shipping.formCost')} <Input type="number" min="0" value={methodForm.cost} onChange={(e) => setMethodForm((p) => ({ ...p, cost: e.target.value }))} /></label>
                      <label>{t('shipping.formFreeThreshold')} <Input type="number" min="0" placeholder={t('shipping.formFreeThresholdHint')} value={methodForm.freeShippingThreshold} onChange={(e) => setMethodForm((p) => ({ ...p, freeShippingThreshold: e.target.value }))} /></label>
                    </div>
                    <label className="form-checkbox" style={{ marginTop: '0.5rem' }}>
                      <Checkbox checked={methodForm.enabled} onCheckedChange={(checked) => setMethodForm((p) => ({ ...p, enabled: checked }))} />
                      <span>{t('shipping.formEnabled')}</span>
                    </label>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <Button type="submit" disabled={methodFormSaving}>{methodFormSaving ? t('common.saving') : (editMethodId ? t('common.save') : t('common.add'))}</Button>
                      <Button variant="secondary" type="button" onClick={() => { setShowMethodForm(false); setEditMethodId(null) }}>{t('common.cancel')}</Button>
                    </div>
                  </form>
                )}

                {methodsStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
                {methodsStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={t('shipping.methodsLoadError')} actionLabel={t('common.retry')} onAction={() => loadMethods(selectedZoneId)} />}
                {methodsStatus === 'success' && methods.length === 0 && <StatePanel tone="neutral" title={t('shipping.methodsTitle')} description={t('shipping.noMethods')} />}
                {methodsStatus === 'success' && methods.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colTitle')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colCost')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colStatus')}</th>
                        {canUpdate && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...methods].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '0.5rem 0' }}>{m.title}</td>
                          <td style={{ padding: '0.5rem 0' }}>{formatCurrencyVnd(m.cost)}</td>
                          <td style={{ padding: '0.5rem 0' }}>
                            <span style={{ fontSize: '0.8rem', color: m.enabled ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{m.enabled ? t('common.on') : t('common.off')}</span>
                          </td>
                          {canUpdate && (
                            <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                <Button variant="secondary" type="button" style={{ fontSize: '0.75rem' }}
                                  onClick={() => { setEditMethodId(m.id); setMethodForm({ title: m.title, description: m.description || '', cost: String(m.cost), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', enabled: m.enabled }); setShowMethodForm(true) }}>{t('common.edit')}</Button>
                                <Button variant="danger" type="button" style={{ fontSize: '0.75rem' }} onClick={() => handleDeleteMethod(m.id)}>{t('common.delete')}</Button>
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
