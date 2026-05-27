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
import { Alert } from '@/components/ui/alert'
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

      {zonesStatus === 'loading' && <StatePanel tone="info" title={t('shipping.loading')} description={t('common.pleaseWait')} />}
      {zonesStatus === 'error' && <StatePanel tone="danger" title={t('shipping.error')} description={zonesError} actionLabel={t('common.retry')} onAction={loadZones} />}

      {zonesStatus === 'success' && (
        <div className="settings-shell">
          {/* Zone sidebar — prototype settings-nav */}
          <nav className="settings-nav" aria-label={t('shipping.zonesTitle')}>
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className={selectedZoneId === zone.id ? 'active' : ''}
                onClick={() => setSelectedZoneId(zone.id)}
              >
                <span style={{ flex: 1 }}>
                  {zone.name}
                  <span className={`block text-xs ${zone.enabled ? 'text-success' : 'muted'}`}>
                    {zone.enabled ? t('common.on') : t('common.off')}
                  </span>
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
                      <div className="grid-2">
                        <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                          <span>{t('shipping.formTitle')} *</span>
                          <Input required value={methodForm.title} onChange={(e) => setMethodForm((p) => ({ ...p, title: e.target.value }))} />
                        </label>
                        <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                          <span>{t('shipping.formDescription')}</span>
                          <Input value={methodForm.description} onChange={(e) => setMethodForm((p) => ({ ...p, description: e.target.value }))} />
                        </label>
                        <label className="form-field">
                          <span>{t('shipping.formCost')}</span>
                          <Input type="number" min="0" value={methodForm.cost} onChange={(e) => setMethodForm((p) => ({ ...p, cost: e.target.value }))} />
                        </label>
                        <label className="form-field">
                          <span>{t('shipping.formFreeThreshold')}</span>
                          <Input type="number" min="0" placeholder={t('shipping.formFreeThresholdHint')} value={methodForm.freeShippingThreshold} onChange={(e) => setMethodForm((p) => ({ ...p, freeShippingThreshold: e.target.value }))} />
                        </label>
                      </div>
                      <label className="mt-2 flex items-center gap-2.5 p-2.5 border border-border text-sm cursor-pointer hover:bg-muted w-fit">
                        <Checkbox checked={methodForm.enabled} onCheckedChange={(checked) => setMethodForm((p) => ({ ...p, enabled: checked }))} />
                        <span>{t('shipping.formEnabled')}</span>
                      </label>
                      <div className="mt-4 flex gap-2">
                        <Button type="submit" loading={methodFormSaving}>{editMethodId ? t('common.save') : t('common.add')}</Button>
                        <Button variant="secondary" type="button" onClick={() => { setShowMethodForm(false); setEditMethodId(null) }}>{t('common.cancel')}</Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Methods card */}
                <div className="bb-card">
                  <div className="bb-card-header">
                    <div>
                      <h2>{selectedZone?.name}</h2>
                      <p className="sub">{t('shipping.methodsTitle')}</p>
                    </div>
                    {canUpdate && (
                      <button
                        type="button"
                        className="bb-btn bb-btn-primary bb-btn-sm"
                        onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setShowMethodForm(!showMethodForm) }}
                      >
                        {showMethodForm ? t('common.cancel') : t('shipping.addMethod')}
                      </button>
                    )}
                  </div>
                  <div className="bb-card-body bb-card-body--flush">
                    {methodsStatus === 'loading' && (
                      <div className="state-panel"><p>{t('shipping.loading')}</p></div>
                    )}
                    {methodsStatus === 'error' && (
                      <div className="state-panel"><p className="text-danger">{t('shipping.methodsLoadError')}</p></div>
                    )}
                    {methodsStatus === 'success' && methods.length === 0 && (
                      <div className="state-panel">
                        <h3>{t('shipping.methodsTitle')}</h3>
                        <p>{t('shipping.noMethods')}</p>
                      </div>
                    )}
                    {methodsStatus === 'success' && methods.length > 0 && (
                      <div className="bb-table-wrap">
                        <table className="bb-table">
                          <thead>
                            <tr>
                              <th>{t('shipping.colTitle')}</th>
                              <th className="num">{t('shipping.colCost')}</th>
                              <th>{t('shipping.colStatus')}</th>
                              {canUpdate && <th />}
                            </tr>
                          </thead>
                          <tbody>
                            {[...methods].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                              <tr key={m.id}>
                                <td className="fw-600">{m.title}</td>
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
                                      onClick={() => { setEditMethodId(m.id); setMethodForm({ title: m.title, description: m.description || '', cost: String(m.cost), freeShippingThreshold: m.freeShippingThreshold != null ? String(m.freeShippingThreshold) : '', enabled: m.enabled }); setShowMethodForm(true) }}
                                    >
                                      {t('common.edit')}
                                    </button>
                                    <button type="button" className="bb-btn bb-btn-ghost bb-btn-sm text-danger" onClick={() => handleDeleteMethod(m.id)}>
                                      {t('common.delete')}
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
