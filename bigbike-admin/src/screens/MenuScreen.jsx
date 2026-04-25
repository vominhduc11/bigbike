import { useEffect, useState } from 'react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { createMenu, createMenuItem, deleteMenu, deleteMenuItem, fetchMenuDetail, fetchMenus, updateMenu, updateMenuItem } from '../lib/adminApi'
import { formatText } from '../lib/formatters'

const EMPTY_ITEM = { label: '', url: '', sortOrder: '0', target: '_self' }
const EMPTY_MENU_FORM = { name: '', location: '', status: 'ACTIVE' }

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
  // Create/edit menu
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [menuForm, setMenuForm] = useState(EMPTY_MENU_FORM)
  const [menuFormError, setMenuFormError] = useState('')
  const [menuFormSaving, setMenuFormSaving] = useState(false)
  const [editMenuId, setEditMenuId] = useState(null)
  // Edit item
  const [editItem, setEditItem] = useState(null)
  const [editItemForm, setEditItemForm] = useState(EMPTY_ITEM)
  const [editItemError, setEditItemError] = useState('')
  const [editItemSaving, setEditItemSaving] = useState(false)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  async function handleMenuFormSubmit(e) {
    e.preventDefault()
    if (!menuForm.name.trim()) { setMenuFormError('Tên menu không được trống'); return }
    setMenuFormSaving(true)
    setMenuFormError('')
    try {
      if (editMenuId) {
        await updateMenu(editMenuId, { name: menuForm.name.trim(), location: menuForm.location.trim() || undefined, status: menuForm.status || undefined })
      } else {
        await createMenu({ name: menuForm.name.trim(), location: menuForm.location.trim() || undefined, status: menuForm.status || 'ACTIVE' })
      }
      const r = await fetchMenus()
      setMenus(r.items)
      if (!editMenuId && r.items.length > 0) setSelectedMenuId(r.items[r.items.length - 1].id)
      setShowMenuForm(false)
      setMenuForm(EMPTY_MENU_FORM)
      setEditMenuId(null)
    } catch (e) {
      setMenuFormError(e.message || 'Lỗi lưu menu')
    } finally {
      setMenuFormSaving(false)
    }
  }

  async function handleDeleteMenu(menuId) {
    if (!window.confirm('Xoá menu này? Tất cả items sẽ bị xoá.')) return
    try {
      await deleteMenu(menuId)
      const r = await fetchMenus()
      setMenus(r.items)
      setSelectedMenuId(r.items.length > 0 ? r.items[0].id : null)
      setMenuDetail(null)
    } catch (e) { alert(e.message) }
  }

  function openEditItem(item) {
    setEditItem(item)
    setEditItemForm({ label: item.label || '', url: item.url || '', sortOrder: String(item.sortOrder ?? '0'), target: item.target || '_self' })
    setEditItemError('')
  }

  async function handleEditItem(e) {
    e.preventDefault()
    if (!editItemForm.label.trim() || !editItemForm.url.trim()) { setEditItemError('Label và URL không được trống'); return }
    setEditItemSaving(true)
    setEditItemError('')
    try {
      await updateMenuItem(selectedMenuId, editItem.id, { ...editItemForm, sortOrder: Number(editItemForm.sortOrder) })
      const r = await fetchMenuDetail(selectedMenuId)
      setMenuDetail(r.item)
      setEditItem(null)
    } catch (e) {
      setEditItemError(e.message || 'Lỗi cập nhật item')
    } finally {
      setEditItemSaving(false)
    }
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
        {canUpdate && (
          <button type="button" className="btn btn-primary" onClick={() => { setEditMenuId(null); setMenuForm(EMPTY_MENU_FORM); setShowMenuForm(!showMenuForm) }}>
            {showMenuForm ? 'Huỷ' : 'Tạo menu'}
          </button>
        )}
      </header>

      {showMenuForm && (
        <form onSubmit={handleMenuFormSubmit} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>{editMenuId ? 'Chỉnh sửa menu' : 'Tạo menu mới'}</h3>
          {menuFormError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{menuFormError}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <label>Tên menu <input className="control-input" required value={menuForm.name} onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))} /></label>
            <label>Location <input className="control-input" value={menuForm.location} placeholder="header, footer..." onChange={(e) => setMenuForm((p) => ({ ...p, location: e.target.value }))} /></label>
            <label>Trạng thái
              <select className="control-select" value={menuForm.status} onChange={(e) => setMenuForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={menuFormSaving}>{menuFormSaving ? 'Đang lưu...' : (editMenuId ? 'Lưu thay đổi' : 'Tạo menu')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowMenuForm(false); setEditMenuId(null) }}>Huỷ</button>
          </div>
        </form>
      )}

      {warning && <ReadOnlyBanner warning={warning} />}

      {menus.length === 0 ? (
        <StatePanel tone="neutral" title="Chưa có menu" description="Chưa có menu nào được tạo." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
          <aside>
            <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>CHỌN MENU</p>
            {menus.map((menu) => (
              <div key={menu.id} style={{ marginBottom: '0.25rem' }}>
                <button type="button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer', background: selectedMenuId === menu.id ? 'var(--c-primary-subtle)' : 'transparent', fontWeight: selectedMenuId === menu.id ? 600 : 400 }}
                  onClick={() => setSelectedMenuId(menu.id)}>
                  {formatText(menu.name)}
                  {menu.location && <span style={{ fontSize: '0.7rem', color: 'var(--c-text-muted)', display: 'block' }}>{menu.location}</span>}
                </button>
                {canUpdate && (
                  <div style={{ display: 'flex', gap: '0.25rem', paddingLeft: '0.75rem' }}>
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => { setEditMenuId(menu.id); setMenuForm({ name: menu.name || '', location: menu.location || '', status: menu.status || 'ACTIVE' }); setShowMenuForm(true) }}>Sửa</button>
                    <button type="button" className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                      onClick={() => handleDeleteMenu(menu.id)}>Xoá</button>
                  </div>
                )}
              </div>
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
                    <h4 style={{ marginBottom: '0.5rem' }}>Thêm item mới</h4>
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

                {editItem && (
                  <form onSubmit={handleEditItem} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-primary)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Chỉnh sửa item</h4>
                    {editItemError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.5rem' }}>{editItemError}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      <label>Label <input className="control-input" value={editItemForm.label} onChange={(e) => setEditItemForm((p) => ({ ...p, label: e.target.value }))} required /></label>
                      <label>URL <input className="control-input" value={editItemForm.url} onChange={(e) => setEditItemForm((p) => ({ ...p, url: e.target.value }))} required /></label>
                      <label>Sort Order <input className="control-input" type="number" value={editItemForm.sortOrder} onChange={(e) => setEditItemForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary" disabled={editItemSaving}>{editItemSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditItem(null)}>Huỷ</button>
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
                              <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={() => openEditItem(item)}>Sửa</button>
                                <button type="button" className="btn btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDeleteItem(item.id)}>Xoá</button>
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
