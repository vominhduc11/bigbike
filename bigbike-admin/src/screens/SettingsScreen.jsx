import { useMemo, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ReadOnlyBanner } from '../components/ReadOnlyBanner'
import { StatePanel } from '../components/StatePanel'
import { fetchSettings, updateSetting } from '../lib/adminApi'
import { formatDateTime } from '../lib/formatters'

function groupLabel(group, t) {
  const key = `settings.group_${group?.toLowerCase?.() ?? 'general'}`
  const translated = t(key)
  return translated === key ? (group ?? t('settings.groupGeneral')) : translated
}

function SettingGroup({ group, items, canUpdate, editing, saving, errors, onEdit, onSave, onCancel, t }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="settings-group">
      <button
        type="button"
        className="settings-group-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="settings-group-label">{groupLabel(group, t)}</span>
        <span className="settings-group-count">{items.length}</span>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>

      {open && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('settings.colKey')}</th>
                <th scope="col">{t('settings.colValue')}</th>
                <th scope="col">{t('common.lastUpdated')}</th>
                {canUpdate && <th scope="col" className="align-right">{t('settings.colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((setting) => {
                const isEditing = setting.key in editing
                return (
                  <tr key={setting.key}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--admin-color-text-muted)' }}>
                      {setting.key}
                      {setting.description && (
                        <p style={{ fontFamily: 'inherit', fontSize: '0.75rem', marginTop: 2, color: 'var(--admin-color-text-muted)' }}>
                          {setting.description}
                        </p>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="control-input"
                          style={{ width: '100%' }}
                          value={editing[setting.key]}
                          onChange={(e) => onEdit(setting.key, e.target.value)}
                        />
                      ) : (
                        <span>
                          {setting.value || <em style={{ color: 'var(--admin-color-text-muted)' }}>{t('settings.empty')}</em>}
                        </span>
                      )}
                      {errors[setting.key] && (
                        <p className="field-error" style={{ marginTop: 4 }}>{errors[setting.key]}</p>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--admin-color-text-muted)' }}>
                      {formatDateTime(setting.updatedAt)}
                    </td>
                    {canUpdate && (
                      <td className="align-right">
                        {isEditing ? (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => onSave(setting.key)}
                              disabled={saving[setting.key]}
                            >
                              {saving[setting.key] ? t('common.saving') : t('common.save')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem' }}
                              onClick={() => onCancel(setting.key)}
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.8rem' }}
                            onClick={() => onEdit(setting.key, setting.value || '')}
                          >
                            {t('common.edit')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function SettingsScreen({ canUpdate }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading', items: [], warning: '' })
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})
  const [errors, setErrors] = useState({})
  const [fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    let active = true
    setState((p) => ({ ...p, status: 'loading' }))
    fetchSettings()
      .then((r) => {
        if (!active) return
        setState({ status: 'success', items: r.items, warning: r.mode === 'mock' ? r.warning : '' })
      })
      .catch((e) => {
        if (!active) return
        setState({ status: 'error', items: [], warning: '', error: e.message })
      })
    return () => { active = false }
  }, [fetchKey])

  const groups = useMemo(() => {
    const map = new Map()
    for (const s of state.items) {
      const g = s.settingGroup || 'GENERAL'
      if (!map.has(g)) map.set(g, [])
      map.get(g).push(s)
    }
    return [...map.entries()]
  }, [state.items])

  function handleEdit(key, value) {
    setEditing((p) => ({ ...p, [key]: value }))
  }

  function handleCancel(key) {
    setEditing((p) => { const n = { ...p }; delete n[key]; return n })
    setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  async function handleSave(key) {
    const value = editing[key]
    setSaving((p) => ({ ...p, [key]: true }))
    setErrors((p) => ({ ...p, [key]: '' }))
    try {
      const r = await updateSetting(key, value)
      setState((p) => ({ ...p, items: p.items.map((s) => s.key === key ? r.item : s) }))
      handleCancel(key)
    } catch (e) {
      setErrors((p) => ({ ...p, [key]: e.message || t('settings.saveError') }))
    } finally {
      setSaving((p) => ({ ...p, [key]: false }))
    }
  }

  if (state.status === 'loading') {
    return <StatePanel tone="info" title={t('settings.loading')} description={t('common.pleaseWait')} />
  }
  if (state.status === 'error') {
    return (
      <StatePanel
        tone="danger"
        title={t('settings.loadError')}
        description={state.error}
        actionLabel={t('common.retry')}
        onAction={() => setFetchKey((k) => k + 1)}
      />
    )
  }

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('settings.eyebrow')}</p>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.description')}</p>
        </div>
      </header>

      {state.warning && <ReadOnlyBanner warning={state.warning} />}

      {state.items.length === 0 ? (
        <StatePanel tone="neutral" title={t('settings.noSettings')} description={t('settings.noSettingsDesc')} />
      ) : (
        <div className="settings-groups">
          {groups.map(([group, items]) => (
            <SettingGroup
              key={group}
              group={group}
              items={items}
              canUpdate={canUpdate}
              editing={editing}
              saving={saving}
              errors={errors}
              onEdit={handleEdit}
              onSave={handleSave}
              onCancel={handleCancel}
              t={t}
            />
          ))}
        </div>
      )}
    </section>
  )
}
