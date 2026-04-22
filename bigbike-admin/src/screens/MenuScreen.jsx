import { useEffect, useState } from 'react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createMenuItem, deleteMenuItem, fetchMenuDetail, fetchMenus } from '../lib/adminApi'
import { formatText } from '../lib/formatters'

const EMPTY_ITEM = { label: '', url: '', sortOrder: '0', target: '_self' }

export function MenuScreen({ canUpdate }) {
  const [menus, setMenus] = useState([])
  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [menuDetail, setMenuDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [warning, setWarning] = useState('')
  const [error, setError] = useState('')
  const [showItemForm, setShowItemForm] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [itemError, setItemError] = useState('')
  const [itemSaving, setItemSaving] = useState(false)

  useEffect(() => {
    fetchMenus()
      .then((r) => {
        setMenus(r.items)
        setWarning(r.mode === 'mock' ? r.warning : '')
        if (r.items.length > 0) setSelectedMenuId(r.items[0].id)
        setLoading(false)
      })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!selectedMenuId) return
    setDetailLoading(true)
    setMenuDetail(null)
    fetchMenuDetail(selectedMenuId)
      .then((r) => { setMenuDetail(r.item); setDetailLoading(false) })
      .catch(() => setDetailLoading(false))
  }, [selectedMenuId])

  async function handleAddItem(e) {
    e.preventDefault()
    if (!newItem.label.trim() || !newItem.url.trim()) { setItemError('Label và URL không được trống'); return }
    setItemSaving(true)
    setItemError('')
    try {
      await createMenuItem(selectedMenuId, { ...newItem, sortOrder: Number(newItem.sortOrder) })
      const r = await fetchMenuDetail(selectedMenuId)
      setMenuDetail(r.item)
      setShowItemForm(false)
      setNewItem(EMPTY_ITEM)
    } catch (e) {
      setItemError(e.message || 'Lỗi thêm menu item')
    } finally {
      setItemSaving(false)
    }
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm('Xoá menu item này?')) return
    try {
      await deleteMenuItem(selectedMenuId, itemId)
      setMenuDetail((p) => p ? { ...p, items: p.items.filter((i) => i.id !== itemId) } : p)
    } catch (e) { alert(e.message) }
  }

  if (loading) return <StatePanel tone="info" title="Đang tải menu" description="Vui lòng chờ..." />
  if (error) return <StatePanel tone="danger" title="Lỗi tải menu" description={error} />

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Navigation</p>
          <h1>Menu điều hướng</h1>
          <p>Quản lý menu header, footer và navigation.</p>
        </div>
      </header>

      {warning && <ReadOnlyBanner warning={warning} />}

      {menus.length === 0 ? (
        <StatePanel tone="neutral" title="Chưa có menu" description="Chưa có menu nào được tạo." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
          <aside>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>CHỌN MENU</p>
            {menus.map((menu) => (
              <button key={menu.id} type="button"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.25rem', border: 'none', cursor: 'pointer', background: selectedMenuId === menu.id ? 'var(--c-primary-subtle)' : 'transparent', fontWeight: selectedMenuId === menu.id ? 600 : 400 }}
                onClick={() => setSelectedMenuId(menu.id)}>
                {formatText(menu.name)}
                {menu.location && <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', display: 'block' }}>{menu.location}</span>}
              </button>
            ))}
          </aside>

          <main>
            {detailLoading && <StatePanel tone="info" title="Đang tải menu items" description="Vui lòng chờ..." />}
            {!detailLoading && menuDetail && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>{formatText(menuDetail.name)}</h2>
                  {canUpdate && (
                    <button type="button" className="btn btn-primary" onClick={() => setShowItemForm(!showItemForm)}>
                      {showItemForm ? 'Huỷ' : 'Thêm item'}
                    </button>
                  )}
                </div>

                {showItemForm && (
                  <form onSubmit={handleAddItem} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    {itemError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{itemError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      <label>Label <input className="control-input" value={newItem.label} onChange={(e) => setNewItem((p) => ({ ...p, label: e.target.value }))} required /></label>
                      <label>URL <input className="control-input" value={newItem.url} onChange={(e) => setNewItem((p) => ({ ...p, url: e.target.value }))} required /></label>
                      <label>Sort Order <input className="control-input" type="number" value={newItem.sortOrder} onChange={(e) => setNewItem((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={itemSaving}>{itemSaving ? 'Đang thêm...' : 'Thêm'}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowItemForm(false); setNewItem(EMPTY_ITEM) }}>Huỷ</button>
                    </div>
                  </form>
                )}

                {menuDetail.items.length === 0 ? (
                  <p style={{ color: 'var(--c-text-muted)' }}>Menu này chưa có items.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem 0' }}>Order</th>
                        <th style={{ padding: '0.5rem 0' }}>Label</th>
                        <th style={{ padding: '0.5rem 0' }}>URL</th>
                        <th style={{ padding: '0.5rem 0' }}>Target</th>
                        {canUpdate && <th style={{ padding: '0.5rem 0', textAlign: 'right' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {[...menuDetail.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                          <td style={{ padding: '0.5rem 0', width: '50px' }}>{item.sortOrder}</td>
                          <td style={{ padding: '0.5rem 0' }}>{item.label}</td>
                          <td style={{ padding: '0.5rem 0' }}><code style={{ fontSize: '0.8rem' }}>{item.url}</code></td>
                          <td style={{ padding: '0.5rem 0', fontSize: '0.8rem' }}>{item.target}</td>
                          {canUpdate && (
                            <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                              <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDeleteItem(item.id)}>Xoá</button>
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
