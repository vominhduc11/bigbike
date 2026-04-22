import { useEffect, useState } from 'react'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchSettings, updateSetting } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

export function SettingsScreen({ canUpdate }) {
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let active = true
    fetchSettings()
      .then((r) => { if (!active) return; setState({ status: 'success', items: r.items, warning: r.mode === 'mock' ? r.warning : '' }) })
      .catch((e) => { if (!active) return; setState({ status: 'error', items: [], warning: '', error: e.message }) })
    return () => { active = false }
  }, [])

  async function handleSave(key) {
    const value = editing[key]
    setSaving((p) => ({ ...p, [key]: true }))
    setErrors((p) => ({ ...p, [key]: '' }))
    try {
      const r = await updateSetting(key, value)
      setState((p) => ({ ...p, items: p.items.map((s) => s.key === key ? r.item : s) }))
      setEditing((p) => { const n = { ...p }; delete n[key]; return n })
    } catch (e) {
      setErrors((p) => ({ ...p, [key]: e.message || 'Lỗi lưu setting' }))
    } finally {
      setSaving((p) => ({ ...p, [key]: false }))
    }
  }

  if (state.status === 'loading') return <StatePanel tone="info" title="Đang tải settings" description="Vui lòng chờ..." />
  if (state.status === 'error') return <StatePanel tone="danger" title="Lỗi tải settings" description={state.error} />

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">Hệ thống</p>
          <h1>Cài đặt website</h1>
          <p>Các thông số vận hành toàn trang.</p>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.items.length === 0 ? (
        <StatePanel tone="neutral" title="Chưa có cài đặt" description="Settings trống hoặc chưa được import." />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--c-border)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 0' }}>Key</th>
              <th style={{ padding: '0.75rem 0' }}>Value</th>
              <th style={{ padding: '0.75rem 0' }}>Cập nhật</th>
              {canUpdate && <th style={{ padding: '0.75rem 0', textAlign: 'right' }}>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {state.items.map((setting) => {
              const isEditing = setting.key in editing
              return (
                <tr key={setting.key} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '0.75rem 0', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--c-text-muted)' }}>{setting.key}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {isEditing ? (
                      <input className="control-input" style={{ width: '100%' }}
                        value={editing[setting.key]}
                        onChange={(e) => setEditing((p) => ({ ...p, [setting.key]: e.target.value }))} />
                    ) : (
                      <span>{setting.value || <em style={{ color: 'var(--c-text-muted)' }}>trống</em>}</span>
                    )}
                    {errors[setting.key] && <p style={{ color: 'var(--c-danger)', fontSize: '0.8rem' }}>{errors[setting.key]}</p>}
                  </td>
                  <td style={{ padding: '0.75rem 0', fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>{formatDateTime(setting.updatedAt)}</td>
                  {canUpdate && (
                    <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>
                      {isEditing ? (
                        <span style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }}
                            onClick={() => handleSave(setting.key)} disabled={saving[setting.key]}>
                            {saving[setting.key] ? 'Lưu...' : 'Lưu'}
                          </button>
                          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }}
                            onClick={() => setEditing((p) => { const n = { ...p }; delete n[setting.key]; return n })}>
                            Huỷ
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }}
                          onClick={() => setEditing((p) => ({ ...p, [setting.key]: setting.value || '' }))}>
                          Sửa
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
