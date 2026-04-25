import { useEffect, useState } from 'react'
import { deleteSlider, fetchSliders, upsertSlider } from '../lib/adminApi'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'

const LOCATIONS = ['home', 'category', 'promotion']
const EMPTY_FORM = { location: 'home', sortOrder: '0', desktopImageUrl: '', mobileImageUrl: '', externalLink: '', productId: '' }

export function SliderListScreen({ canUpdate }) {
  const [location, setLocation] = useState('home')
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM, location: 'home' })
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  function load(loc) {
    setState((p) => ({ ...p, status: 'loading' }))
    fetchSliders(loc)
      .then((r) => setState({ status: 'success', items: r.items, warning: r.mode === 'mock' ? r.warning : '' }))
      .catch((e) => setState({ status: 'error', items: [], warning: '', error: e.message }))
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(location) }, [location])

  async function handleUpsert(e) {
    e.preventDefault()
    if (!form.externalLink.trim() && !form.productId.trim()) {
      setFormError('Cần nhập externalLink hoặc productId.')
      return
    }
    setFormSaving(true)
    setFormError('')
    try {
      const payload = {
        location: form.location,
        sortOrder: Number(form.sortOrder),
        externalLink: form.externalLink.trim() || undefined,
        productId: form.productId.trim() || undefined,
      }
      if (form.desktopImageUrl.trim()) {
        payload.desktopImage = { url: form.desktopImageUrl.trim() }
      }
      if (form.mobileImageUrl.trim()) {
        payload.mobileImage = { url: form.mobileImageUrl.trim() }
      }
      await upsertSlider(payload)
      setShowForm(false)
      setForm({ ...EMPTY_FORM, location })
      load(location)
    } catch (e) {
      setFormError(e.message || 'Lỗi lưu slider')
    } finally {
      setFormSaving(false)
    }
  }

  async function handleDelete(sliderId) {
    if (!window.confirm('Xoá slider này?')) return
    try {
      await deleteSlider(sliderId)
      load(location)
    } catch (e) { alert(e.message) }
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Sliders</h1>
          <p>Quản lý banner slider theo vị trí.</p>
        </div>
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_FORM, location }); setShowForm(!showForm) }}>
            {showForm ? 'Huỷ' : 'Thêm slider'}
          </button>
        )}
      </header>

      {state.warning ? <ReadOnlyBanner warning={state.warning} /> : null}

      <section className="filter-bar">
        <label>Vị trí
          <select className="control-select" value={location} onChange={(e) => setLocation(e.target.value)}>
            {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </label>
      </section>

      {showForm && (
        <form onSubmit={handleUpsert} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Thêm / cập nhật slider</h3>
          {formError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{formError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>Vị trí
              <select className="control-select" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}>
                {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </label>
            <label>Sort Order <input className="control-input" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
            <label>Desktop Image URL <input className="control-input" placeholder="https://..." value={form.desktopImageUrl} onChange={(e) => setForm((p) => ({ ...p, desktopImageUrl: e.target.value }))} /></label>
            <label>Mobile Image URL <input className="control-input" placeholder="https://..." value={form.mobileImageUrl} onChange={(e) => setForm((p) => ({ ...p, mobileImageUrl: e.target.value }))} /></label>
            <label>External Link <input className="control-input" placeholder="https://..." value={form.externalLink} onChange={(e) => setForm((p) => ({ ...p, externalLink: e.target.value }))} /></label>
            <label>Product ID <input className="control-input" value={form.productId} onChange={(e) => setForm((p) => ({ ...p, productId: e.target.value }))} /></label>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={formSaving}>{formSaving ? 'Đang lưu...' : 'Lưu slider'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setFormError('') }}>Huỷ</button>
          </div>
        </form>
      )}

      {state.status === 'loading' && <StatePanel tone="info" title="Đang tải sliders" description="Vui lòng chờ..." />}
      {state.status === 'error' && <StatePanel tone="danger" title="Lỗi" description={state.error} actionLabel="Thử lại" onAction={() => load(location)} />}
      {state.status === 'success' && state.items.length === 0 && <StatePanel tone="neutral" title="Chưa có slider" description={`Chưa có slider nào ở vị trí "${location}".`} />}
      {state.status === 'success' && state.items.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[...state.items].sort((a, b) => a.sortOrder - b.sortOrder).map((slider) => (
            <div key={slider.id} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              {slider.desktopImage?.url && (
                <img src={slider.desktopImage.url} alt="" style={{ width: '120px', height: '60px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Slot {slider.sortOrder} — {slider.location}</p>
                {slider.externalLink && <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>Link: {slider.externalLink}</p>}
                {slider.productId && <p style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>Product: {slider.productId}</p>}
              </div>
              {canUpdate && (
                <button type="button" className="btn btn-danger" style={{ fontSize: '0.8rem', flexShrink: 0 }} onClick={() => handleDelete(slider.id)}>Xoá</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
