import { useEffect, useState } from 'react'
import {
  createShippingMethod, createShippingZone,
  deleteShippingMethod, deleteShippingZone,
  fetchShippingMethods, fetchShippingZones,
  updateShippingMethod, updateShippingZone,
} from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { formatCurrencyVnd } from '../lib/formatters'

const EMPTY_ZONE_FORM = { name: '', regionCode: '', sortOrder: '0', enabled: true }
const EMPTY_METHOD_FORM = { methodCode: '', title: '', description: '', cost: '0', minOrderAmount: '0', sortOrder: '0', enabled: true }

export function ShippingScreen({ canUpdate }) {
  const [zones, setZones] = useState([])
  const [zonesStatus, setZonesStatus] = useState('loading')
  const [zonesWarning, setZonesWarning] = useState('')
  const [zonesError, setZonesError] = useState('')
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [methods, setMethods] = useState([])
  const [methodsStatus, setMethodsStatus] = useState('idle')

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

  function loadZones() {
    setZonesStatus('loading')
    fetchShippingZones({ page: 1, pageSize: 50 })
      .then((r) => { setZones(r.items); setZonesStatus('success'); setZonesWarning(r.mode === 'mock' ? r.warning : '') })
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
    if (!zoneForm.name.trim()) { setZoneFormError('Tên zone không được trống'); return }
    setZoneFormSaving(true)
    setZoneFormError('')
    try {
      const payload = { name: zoneForm.name.trim(), regionCode: zoneForm.regionCode.trim() || undefined, sortOrder: Number(zoneForm.sortOrder), enabled: zoneForm.enabled }
      if (editZoneId) {
        await updateShippingZone(editZoneId, payload)
      } else {
        await createShippingZone(payload)
      }
      setShowZoneForm(false)
      setEditZoneId(null)
      setZoneForm(EMPTY_ZONE_FORM)
      loadZones()
    } catch (e) {
      setZoneFormError(e.message || 'Lỗi lưu zone')
    } finally {
      setZoneFormSaving(false)
    }
  }

  async function handleDeleteZone(zoneId) {
    if (!window.confirm('Xoá shipping zone này? Tất cả methods sẽ bị xoá.')) return
    try {
      await deleteShippingZone(zoneId)
      if (selectedZoneId === zoneId) { setSelectedZoneId(null); setMethods([]) }
      loadZones()
    } catch (e) { alert(e.message) }
  }

  async function handleMethodSubmit(e) {
    e.preventDefault()
    if (!methodForm.methodCode.trim() || !methodForm.title.trim()) { setMethodFormError('Mã và tiêu đề không được trống'); return }
    setMethodFormSaving(true)
    setMethodFormError('')
    try {
      const payload = {
        methodCode: methodForm.methodCode.trim(),
        title: methodForm.title.trim(),
        description: methodForm.description.trim() || undefined,
        cost: Number(methodForm.cost),
        minOrderAmount: Number(methodForm.minOrderAmount),
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
      setMethodFormError(e.message || 'Lỗi lưu method')
    } finally {
      setMethodFormSaving(false)
    }
  }

  async function handleDeleteMethod(methodId) {
    if (!window.confirm('Xoá shipping method này?')) return
    try {
      await deleteShippingMethod(selectedZoneId, methodId)
      loadMethods(selectedZoneId)
    } catch (e) { alert(e.message) }
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Commerce</p>
          <h1>Phí vận chuyển</h1>
          <p>Quản lý vùng vận chuyển và phương thức giao hàng.</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditZoneId(null); setZoneForm(EMPTY_ZONE_FORM); setShowZoneForm(!showZoneForm) }}>
            {showZoneForm ? 'Huỷ' : 'Tạo zone'}
          </button>
        )}
      </header>

      {zonesWarning ? <ReadOnlyBanner warning={zonesWarning} /> : null}

      {showZoneForm && (
        <form onSubmit={handleZoneSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editZoneId ? 'Chỉnh sửa zone' : 'Tạo zone mới'}</h3>
          {zoneFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{zoneFormError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <label>Tên zone * <input className="control-input" required value={zoneForm.name} onChange={(e) => setZoneForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Region Code <input className="control-input" value={zoneForm.regionCode} onChange={(e) => setZoneForm((p) => ({ ...p, regionCode: e.target.value }))} /></label>
            <label>Sort Order <input className="control-input" type="number" value={zoneForm.sortOrder} onChange={(e) => setZoneForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
          </div>
          <label className="form-checkbox" style={{ marginTop: '0.75rem' }}>
            <input type="checkbox" checked={zoneForm.enabled} onChange={(e) => setZoneForm((p) => ({ ...p, enabled: e.target.checked }))} />
            <span>Enabled</span>
          </label>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={zoneFormSaving}>{zoneFormSaving ? 'Đang lưu...' : (editZoneId ? 'Lưu thay đổi' : 'Tạo zone')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowZoneForm(false); setEditZoneId(null) }}>Huỷ</button>
          </div>
        </form>
      )}

      {zonesStatus === 'loading' && <StatePanel tone="info" title="Đang tải zones" description="Vui lòng chờ..." />}
      {zonesStatus === 'error' && <StatePanel tone="danger" title="Lỗi tải zones" description={zonesError} actionLabel="Thử lại" onAction={loadZones} />}
      {zonesStatus === 'success' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
          <aside>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>SHIPPING ZONES</p>
            {zones.length === 0 && <p style={{ color: 'var(--c-text-muted)', fontSize: '0.85rem' }}>Chưa có zone nào.</p>}
            {zones.map((zone) => (
              <div key={zone.id} style={{ marginBottom: '0.5rem' }}>
                <button type="button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', background: selectedZoneId === zone.id ? 'var(--c-primary-subtle)' : 'transparent', fontWeight: selectedZoneId === zone.id ? 600 : 400 }}
                  onClick={() => setSelectedZoneId(zone.id)}>
                  {zone.name}
                  {zone.regionCode && <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', display: 'block' }}>{zone.regionCode}</span>}
                  <span style={{ fontSize: '0.7rem', color: zone.enabled ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{zone.enabled ? 'Enabled' : 'Disabled'}</span>
                </button>
                {canUpdate && (
                  <div style={{ display: 'flex', gap: '0.25rem', paddingLeft: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => { setEditZoneId(zone.id); setZoneForm({ name: zone.name, regionCode: zone.regionCode || '', sortOrder: String(zone.sortOrder), enabled: zone.enabled }); setShowZoneForm(true) }}>Sửa</button>
                    <button type="button" className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => handleDeleteZone(zone.id)}>Xoá</button>
                  </div>
                )}
              </div>
            ))}
          </aside>

          <main>
            {!selectedZoneId && <StatePanel tone="neutral" title="Chọn zone" description="Chọn một shipping zone bên trái để xem và quản lý methods." />}
            {selectedZoneId && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>Shipping Methods</h2>
                  {canUpdate && (
                    <button type="button" className="btn btn-primary" onClick={() => { setEditMethodId(null); setMethodForm(EMPTY_METHOD_FORM); setShowMethodForm(!showMethodForm) }}>
                      {showMethodForm ? 'Huỷ' : 'Thêm method'}
                    </button>
                  )}
                </div>

                {showMethodForm && (
                  <form onSubmit={handleMethodSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.75rem' }}>{editMethodId ? 'Chỉnh sửa method' : 'Thêm method mới'}</h4>
                    {methodFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{methodFormError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <label>Mã method * <input className="control-input" required value={methodForm.methodCode} onChange={(e) => setMethodForm((p) => ({ ...p, methodCode: e.target.value }))} /></label>
                      <label>Tiêu đề * <input className="control-input" required value={methodForm.title} onChange={(e) => setMethodForm((p) => ({ ...p, title: e.target.value }))} /></label>
                      <label>Phí (VND) <input className="control-input" type="number" min="0" value={methodForm.cost} onChange={(e) => setMethodForm((p) => ({ ...p, cost: e.target.value }))} /></label>
                      <label>Đơn tối thiểu <input className="control-input" type="number" min="0" value={methodForm.minOrderAmount} onChange={(e) => setMethodForm((p) => ({ ...p, minOrderAmount: e.target.value }))} /></label>
                      <label>Sort Order <input className="control-input" type="number" value={methodForm.sortOrder} onChange={(e) => setMethodForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
                    </div>
                    <label className="form-checkbox" style={{ marginTop: '0.5rem' }}>
                      <input type="checkbox" checked={methodForm.enabled} onChange={(e) => setMethodForm((p) => ({ ...p, enabled: e.target.checked }))} />
                      <span>Enabled</span>
                    </label>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={methodFormSaving}>{methodFormSaving ? 'Đang lưu...' : (editMethodId ? 'Lưu' : 'Thêm')}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowMethodForm(false); setEditMethodId(null) }}>Huỷ</button>
                    </div>
                  </form>
                )}

                {methodsStatus === 'loading' && <StatePanel tone="info" title="Đang tải methods" description="..." />}
                {methodsStatus === 'success' && methods.length === 0 && <StatePanel tone="neutral" title="Chưa có method" description="Zone này chưa có phương thức vận chuyển." />}
                {methodsStatus === 'success' && methods.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0' }}>Mã</th>
                        <th style={{ padding: '0.5rem 0' }}>Tiêu đề</th>
                        <th style={{ padding: '0.5rem 0' }}>Phí</th>
                        <th style={{ padding: '0.5rem 0' }}>Tối thiểu</th>
                        <th style={{ padding: '0.5rem 0' }}>Status</th>
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
                            <span style={{ fontSize: '0.8rem', color: m.enabled ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{m.enabled ? 'ON' : 'OFF'}</span>
                          </td>
                          {canUpdate && (
                            <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }}
                                  onClick={() => { setEditMethodId(m.id); setMethodForm({ methodCode: m.methodCode, title: m.title, description: m.description || '', cost: String(m.cost), minOrderAmount: String(m.minOrderAmount), sortOrder: String(m.sortOrder), enabled: m.enabled }); setShowMethodForm(true) }}>Sửa</button>
                                <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDeleteMethod(m.id)}>Xoá</button>
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
