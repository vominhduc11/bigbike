import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createShippingMethod, createShippingZone,
  deleteShippingMethod, deleteShippingZone,
  fetchShippingMethods, fetchShippingZones,
  updateShippingMethod, updateShippingZone,
} from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { showConfirm } from '../lib/confirm'
import { formatCurrencyVnd } from '../lib/formatters'

const EMPTY_ZONE_FORM = { name: '', regionCode: '', sortOrder: '0', enabled: true }
const EMPTY_METHOD_FORM = { methodCode: '', title: '', description: '', cost: '0', minOrderAmount: '0', freeShippingThreshold: '', sortOrder: '0', enabled: true }

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

  const [showZoneForm, setShowZoneForm] = useState(false)
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE_FORM)
  const [editZoneId, setEditZoneId] = useState(null)
  const [zoneFormError, setZoneFormError] = useState('')
  const [zoneFormSaving, setZoneFormSaving] = useState(false)

  const [showMethodForm, setShowMethodForm] = useState(false)
  const [methodForm, setMethodForm] = useState(EMPTY_METHOD_FORM)
  const [editMethodId, setEditMethodId] = useState(null)
  const [methodFormError, setMethodFormError] = useState('')
  const [methodFormSaving, setMethodFormSaving] = useState(false)

  function loadZones(autoSelectId = null) {
    setZonesStatus('loading')
    fetchShippingZones({ page: 1, pageSize: 50 })
      .then((r) => {
        setZones(r.items)
        setZonesStatus('success')
        setZonesWarning(r.mode === 'mock' ? r.warning : '')
        if (autoSelectId) setSelectedZoneId(autoSelectId)
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

  async function handleZoneSubmit(e) {
    e.preventDefault()
    if (!zoneForm.name.trim()) { setZoneFormError(t('common.required')); return }
    setZoneFormSaving(true)
    setZoneFormError('')
    try {
      const payload = { name: zoneForm.name.trim(), regionCode: zoneForm.regionCode.trim() || undefined, sortOrder: Number(zoneForm.sortOrder), enabled: zoneForm.enabled }
      if (editZoneId) {
        await updateShippingZone(editZoneId, payload)
        setShowZoneForm(false)
        setEditZoneId(null)
        setZoneForm(EMPTY_ZONE_FORM)
        loadZones()
      } else {
        const r = await createShippingZone(payload)
        setShowZoneForm(false)
        setZoneForm(EMPTY_ZONE_FORM)
        loadZones(r.item?.id ?? null)
      }
    } catch (e) {
      setZoneFormError(e.message || t('shipping.saveError'))
    } finally {
      setZoneFormSaving(false)
    }
  }

  async function handleDeleteZone(zoneId) {
    const confirmed = await showConfirm(t('shipping.deleteConfirm'), t('shipping.deleteTitle'))
    if (!confirmed) return
    setActionError('')
    try {
      await deleteShippingZone(zoneId)
      if (selectedZoneId === zoneId) { setSelectedZoneId(null); setMethods([]) }
      loadZones()
    } catch (e) {
      setActionError(e.message || t('common.error'))
    }
  }

  async function handleMethodSubmit(e) {
    e.preventDefault()
    if (!methodForm.methodCode.trim() || !methodForm.title.trim()) { setMethodFormError(t('common.required')); return }
    setMethodFormSaving(true)
    setMethodFormError('')
    try {
      const payload = {
        methodCode: methodForm.methodCode.trim(),
        title: methodForm.title.trim(),
        description: methodForm.description.trim() || undefined,
        cost: Number(methodForm.cost),
        minOrderAmount: Number(methodForm.minOrderAmount),
        freeShippingThreshold: methodForm.freeShippingThreshold !== '' ? Number(methodForm.freeShippingThreshold) : undefined,
        sortOrder: Number(methodForm.sortOrder),
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

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('shipping.eyebrow')}</p>
          <h1>{t('shipping.title')}</h1>
          <p>{t('shipping.description')}</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditZoneId(null); setZoneForm(EMPTY_ZONE_FORM); setShowZoneForm(!showZoneForm) }}>
            {showZoneForm ? t('common.cancel') : t('shipping.addZone')}
          </button>
        )}
      </header>

      {zonesWarning ? <ReadOnlyBanner warning={zonesWarning} /> : null}

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      {showZoneForm && (
        <form onSubmit={handleZoneSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editZoneId ? t('common.edit') : t('common.create')}</h3>
          {zoneFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{zoneFormError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <label>{t('shipping.zonesTitle')} * <input className="control-input" required value={zoneForm.name} onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>{t('shipping.formRegionCode')} <input className="control-input" value={zoneForm.regionCode} onChange={(e) => setZoneForm((p) => ({ ...p, regionCode: e.target.value }))} /></label>
            <label>{t('shipping.formSortOrder')} <input className="control-input" type="number" value={zoneForm.sortOrder} onChange={(e) => setZoneForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
          </div>
          <label className="form-checkbox" style={{ marginTop: '0.75rem' }}>
            <input type="checkbox" checked={zoneForm.enabled} onChange={(e) => setZoneForm((p) => ({ ...p, enabled: e.target.checked }))} />
            <span>{t('shipping.formEnabled')}</span>
          </label>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={zoneFormSaving}>{zoneFormSaving ? t('common.saving') : (editZoneId ? t('common.save') : t('common.create'))}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowZoneForm(false); setEditZoneId(null) }}>{t('common.cancel')}</button>
          </div>
        </form>
      )}

      {zonesStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
      {zonesStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={zonesError} actionLabel={t('common.retry')} onAction={loadZones} />}
      {zonesStatus === 'success' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
          <aside>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{t('shipping.zonesTitle').toUpperCase()}</p>
            {zones.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>{t('shipping.noZone')}</p>}
            {zones.map((zone) => (
              <div key={zone.id} style={{ marginBottom: '0.5rem' }}>
                <button type="button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', background: selectedZoneId === zone.id ? 'var(--c-primary-subtle)' : 'transparent', fontWeight: selectedZoneId === zone.id ? 600 : 400 }}
                  onClick={() => setSelectedZoneId(zone.id)}>
                  {zone.name}
                  {zone.regionCode && <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', display: 'block' }}>{zone.regionCode}</span>}
                  <span style={{ fontSize: '0.7rem', color: zone.enabled ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{zone.enabled ? t('common.on') : t('common.off')}</span>
                </button>
                {canUpdate && (
                  <div style={{ display: 'flex', gap: '0.25rem', paddingLeft: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => { setEditZoneId(zone.id); setZoneForm({ name: zone.name, regionCode: zone.regionCode || '', sortOrder: String(zone.sortOrder), enabled: zone.enabled }); setShowZoneForm(true) }}>{t('common.edit')}</button>
                    <button type="button" className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => handleDeleteZone(zone.id)}>{t('common.delete')}</button>
                  </div>
                )}
              </div>
            ))}
          </aside>

          <main>
            {!selectedZoneId && <StatePanel tone="neutral" title={t('shipping.noZone')} description={t('shipping.noZone')} />}
            {selectedZoneId && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{t('shipping.methodsTitle')}</h2>
                  {canUpdate && (
                    <button type="button" className="btn btn-primary" onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setShowMethodForm(!showMethodForm) }}>
                      {showMethodForm ? t('common.cancel') : t('shipping.addMethod')}
                    </button>
                  )}
                </div>

                {showMethodForm && (
                  <form onSubmit={handleMethodSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem' }}>{editMethodId ? t('common.edit') : t('shipping.addMethod')}</h4>
                    {methodFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{methodFormError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label>{t('shipping.formCode')} * <input className="control-input" required value={methodForm.methodCode} onChange={(e) => setMethodForm((p) => ({ ...p, methodCode: e.target.value }))} /></label>
                      <label>{t('shipping.formTitle')} * <input className="control-input" required value={methodForm.title} onChange={(e) => setMethodForm((p) => ({ ...p, title: e.target.value }))} /></label>
                      <label style={{ gridColumn: '1 / -1' }}>{t('shipping.formDescription')} <input className="control-input" value={methodForm.description} onChange={(e) => setMethodForm((p) => ({ ...p, description: e.target.value }))} /></label>
                      <label>{t('shipping.formCost')} <input className="control-input" type="number" min="0" value={methodForm.cost} onChange={(e) => setMethodForm((p) => ({ ...p, cost: e.target.value }))} /></label>
                      <label>{t('shipping.formMinOrder')} <input className="control-input" type="number" min="0" value={methodForm.minOrderAmount} onChange={(e) => setMethodForm((p) => ({ ...p, minOrderAmount: e.target.value }))} /></label>
                      <label>{t('shipping.formFreeThreshold')} <input className="control-input" type="number" min="0" placeholder={t('shipping.formFreeThresholdHint')} value={methodForm.freeShippingThreshold} onChange={(e) => setMethodForm((p) => ({ ...p, freeShippingThreshold: e.target.value }))} /></label>
                      <label>{t('shipping.formSortOrder')} <input className="control-input" type="number" value={methodForm.sortOrder} onChange={(e) => setMethodForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
                    </div>
                    <label className="form-checkbox" style={{ marginTop: '0.5rem' }}>
                      <input type="checkbox" checked={methodForm.enabled} onChange={(e) => setMethodForm((p) => ({ ...p, enabled: e.target.checked }))} />
                      <span>{t('shipping.formEnabled')}</span>
                    </label>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={methodFormSaving}>{methodFormSaving ? t('common.saving') : (editMethodId ? t('common.save') : t('common.add'))}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowMethodForm(false); setEditMethodId(null) }}>{t('common.cancel')}</button>
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
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colCode')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colTitle')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colCost')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colMinOrder')}</th>
                        <th style={{ padding: '0.5rem 0' }}>{t('shipping.colStatus')}</th>
                        {canUpdate && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...methods].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '0.5rem 0' }}><code style={{ fontSize: '0.8rem' }}>{m.methodCode}</code></td>
                          <td style={{ padding: '0.5rem 0' }}>{m.title}</td>
                          <td style={{ padding: '0.5rem 0' }}>{formatCurrencyVnd(m.cost)}</td>
                          <td style={{ padding: '0.5rem 0' }}>{m.minOrderAmount > 0 ? formatCurrencyVnd(m.minOrderAmount) : '—'}</td>
                          <td style={{ padding: '0.5rem 0' }}>
                            <span style={{ fontSize: '0.8rem', color: m.enabled ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{m.enabled ? t('common.on') : t('common.off')}</span>
                          </td>
                          {canUpdate && (
                            <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }}
                                  onClick={() => { setEditMethodId(m.id); setMethodForm({ methodCode: m.methodCode, title: m.title, description: m.description || '', cost: String(m.cost), minOrderAmount: String(m.minOrderAmount), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', sortOrder: String(m.sortOrder), enabled: m.enabled }); setShowMethodForm(true) }}>{t('common.edit')}</button>
                                <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDeleteMethod(m.id)}>{t('common.delete')}</button>
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
