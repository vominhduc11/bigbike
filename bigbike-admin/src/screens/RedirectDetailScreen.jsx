import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteRedirect, fetchRedirectDetail, toggleRedirect, updateRedirect } from '../lib/adminApi'
import { showConfirm } from '../lib/confirm'
import { formatDateTime } from '../lib/formatters'
import { StatePanel } from '../components/StatePanel'

const REDIRECT_TYPE_OPTIONS = ['EXACT', 'PREFIX', 'REGEX']
const STATUS_CODE_OPTIONS = [301, 302, 307, 308]

function buildForm(item) {
  if (!item) return { sourcePattern: '', targetUrl: '', redirectType: 'EXACT', statusCode: '301', notes: '' }
  return {
    sourcePattern: item.sourcePattern || '',
    targetUrl: item.targetUrl || '',
    redirectType: item.redirectType || 'EXACT',
    statusCode: String(item.statusCode || 301),
    notes: item.notes || '',
  }
}

export function RedirectDetailScreen({ redirectId, navigate, canUpdate }) {
  const { t } = useTranslation()
  const [loadState, setLoadState] = useState({ status: 'loading', item: null, error: '' })
  const [form, setForm] = useState(buildForm(null))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    setLoadState({ status: 'loading', item: null, error: '' })
    fetchRedirectDetail(redirectId)
      .then((r) => {
        if (!active) return
        setLoadState({ status: 'success', item: r.item, error: '' })
        setForm(buildForm(r.item))
        setDirty(false)
      })
      .catch((e) => { if (active) setLoadState({ status: 'error', item: null, error: e.message }) })
    return () => { active = false }
  }, [redirectId])

  function handleChange(field, value) {
    setForm((p) => ({ ...p, [field]: value }))
    setDirty(true)
    setSaveError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.sourcePattern.trim() || !form.targetUrl.trim()) { setSaveError(t('redirects.formRequired')); return }
    setSaving(true)
    setSaveError('')
    try {
      const r = await updateRedirect(redirectId, {
        sourcePattern: form.sourcePattern.trim(),
        targetUrl: form.targetUrl.trim(),
        redirectType: form.redirectType,
        statusCode: Number(form.statusCode),
        notes: form.notes.trim() || null,
      })
      setLoadState((p) => ({ ...p, item: r.item }))
      setDirty(false)
    } catch (e) {
      setSaveError(e.message || t('redirects.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    if (!loadState.item) return
    setActionError('')
    try {
      const r = await toggleRedirect(redirectId, !loadState.item.isEnabled)
      setLoadState((p) => ({ ...p, item: r.item }))
    } catch (e) { setActionError(e.message || t('redirects.toggleError')) }
  }

  async function handleDelete() {
    const confirmed = await showConfirm(t('redirects.deleteConfirm'), t('redirects.deleteConfirmTitle'))
    if (!confirmed) return
    setActionError('')
    try {
      await deleteRedirect(redirectId)
      navigate('/admin/redirects')
    } catch (e) { setActionError(e.message || t('redirects.deleteError')) }
  }

  if (loadState.status === 'loading') {
    return <StatePanel tone="info" title={t('redirects.loading')} description="" />
  }

  if (loadState.status === 'error') {
    return (
      <StatePanel tone="danger" title={t('redirects.error')} description={loadState.error}
        actionLabel={t('common.back')} onAction={() => navigate('/admin/redirects')} />
    )
  }

  const item = loadState.item

  return (
    <section className="screen">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('redirects.detailEyebrow')}</p>
          <h1>{t('redirects.detailTitle')}</h1>
          <p>{t('redirects.detailDesc')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/redirects')}>
            ← {t('common.back')}
          </button>
          {canUpdate && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleToggle}>
                {item.isEnabled ? t('common.disable') : t('common.enable')}
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDelete}>
                {t('common.delete')}
              </button>
            </>
          )}
        </div>
      </header>

      {actionError && (
        <p className="inline-error">
          {actionError}
          <button type="button" onClick={() => setActionError('')}>✕</button>
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <form onSubmit={handleSave} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.5rem' }}>
          {saveError && <p style={{ color: 'var(--c-danger)', marginBottom: '0.75rem' }}>{saveError}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label>{t('redirects.formSource')}
              <input className="control-input" required value={form.sourcePattern}
                onChange={(e) => handleChange('sourcePattern', e.target.value)}
                disabled={!canUpdate} placeholder="/duong-dan-cu" />
            </label>
            <label>{t('redirects.formTarget')}
              <input className="control-input" required value={form.targetUrl}
                onChange={(e) => handleChange('targetUrl', e.target.value)}
                disabled={!canUpdate} placeholder="/duong-dan-moi/" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label>{t('redirects.formStatusCode')}
                <select className="control-select" value={form.statusCode}
                  onChange={(e) => handleChange('statusCode', e.target.value)}
                  disabled={!canUpdate}>
                  <option value="301">{t('redirects.code301')}</option>
                  <option value="302">{t('redirects.code302')}</option>
                  <option value="307">{t('redirects.code307')}</option>
                  <option value="308">{t('redirects.code308')}</option>
                </select>
              </label>
              <label>{t('redirects.formMatchType')}
                <select className="control-select" value={form.redirectType}
                  onChange={(e) => handleChange('redirectType', e.target.value)}
                  disabled={!canUpdate}>
                  {REDIRECT_TYPE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>
            <label>{t('redirects.formNotes')}
              <input className="control-input" value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                disabled={!canUpdate} placeholder={t('redirects.formNotesPlaceholder')} />
            </label>
          </div>

          {canUpdate && (
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
                {saving ? t('redirects.saving') : t('redirects.saveBtn')}
              </button>
            </div>
          )}
        </form>

        <aside style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.75rem', fontSize: '0.875rem' }}>
            <dt style={{ color: 'var(--c-text-muted)' }}>ID</dt>
            <dd style={{ margin: 0 }}><code style={{ fontSize: '0.75rem' }}>{item.id}</code></dd>

            {item.legacyId != null && (
              <>
                <dt style={{ color: 'var(--c-text-muted)' }}>{t('redirects.fieldLegacyId')}</dt>
                <dd style={{ margin: 0 }}>{item.legacyId}</dd>
              </>
            )}

            <dt style={{ color: 'var(--c-text-muted)' }}>{t('redirects.colEnabled')}</dt>
            <dd style={{ margin: 0 }}>
              <span className={`status-badge status-${item.isEnabled ? 'success' : 'neutral'}`}>
                {item.isEnabled ? t('common.on') : t('common.off')}
              </span>
            </dd>

            <dt style={{ color: 'var(--c-text-muted)' }}>{t('redirects.fieldHitCount')}</dt>
            <dd style={{ margin: 0 }}>{(item.hitCount || 0).toLocaleString()}</dd>

            <dt style={{ color: 'var(--c-text-muted)' }}>{t('redirects.fieldLastHit')}</dt>
            <dd style={{ margin: 0 }}>{item.lastHitAt ? formatDateTime(item.lastHitAt) : <span style={{ color: 'var(--c-text-muted)' }}>{t('redirects.notHitYet')}</span>}</dd>

            <dt style={{ color: 'var(--c-text-muted)' }}>{t('redirects.fieldCreated')}</dt>
            <dd style={{ margin: 0 }}>{formatDateTime(item.createdAt)}</dd>

            <dt style={{ color: 'var(--c-text-muted)' }}>{t('common.lastUpdated')}</dt>
            <dd style={{ margin: 0 }}>{formatDateTime(item.updatedAt)}</dd>
          </dl>
        </aside>
      </div>
    </section>
  )
}
