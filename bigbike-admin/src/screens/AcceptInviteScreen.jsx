import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { acceptAdminInvite, validateAdminInvite } from '../lib/adminApi'

function readToken() {
  try {
    return new URLSearchParams(window.location.search).get('token') || ''
  } catch {
    return ''
  }
}

export function AcceptInviteScreen() {
  const { t } = useTranslation()
  const token = readToken()

  const [phase, setPhase] = useState('validating') // validating | valid | invalid | done
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState({ password: false, confirm: false })

  const pwId = useId()
  const confirmId = useId()

  const passwordError = password.length > 0 && password.length < 8 ? t('acceptInvite.passwordTooShort') : ''
  const confirmError = confirm.length > 0 && confirm !== password ? t('acceptInvite.passwordMismatch') : ''

  useEffect(() => {
    let active = true
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('invalid')
      setError(t('acceptInvite.missingToken'))
      return
    }
    validateAdminInvite(token)
      .then((info) => {
        if (!active) return
        setEmail(info.email)
        setPhase('valid')
      })
      .catch((err) => {
        if (!active) return
        setError(err?.message || t('acceptInvite.invalidToken'))
        setPhase('invalid')
      })
    return () => { active = false }
  }, [token, t])

  async function onSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    if (password.length < 8) {
      setError(t('acceptInvite.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('acceptInvite.passwordMismatch'))
      return
    }
    setSubmitting(true)
    try {
      await acceptAdminInvite(token, password)
      setPhase('done')
    } catch (err) {
      setError(err?.message || t('acceptInvite.acceptFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bb-login-shell">
      <div className="bb-login-left">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bb-text-onsidebar-dim)', marginBottom: 20 }}>
            BigBike
          </p>
          <h1><span className="brand-dot" />Admin</h1>
          <p style={{ marginTop: 16, maxWidth: 280 }}>{t('acceptInvite.tagline')}</p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 48 }}>
          <p style={{ fontSize: 12, color: 'var(--bb-text-onsidebar-dim)' }}>
            © {new Date().getFullYear()} BigBike.
          </p>
        </div>
      </div>

      <div className="bb-login-right">
        <div className="bb-login-form">
          <h2>{t('acceptInvite.title')}</h2>

          {phase === 'validating' && (
            <StatePanel tone="info" title={t('common.loading')} description={t('common.pleaseWait')} />
          )}

          {phase === 'invalid' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatePanel tone="danger" title={t('acceptInvite.invalidTitle')} description={error} />
              <a href="/" className="bb-btn bb-btn-primary bb-btn-lg" style={{ width: '100%', textAlign: 'center' }}>
                {t('acceptInvite.goToLogin')}
              </a>
            </div>
          )}

          {phase === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatePanel tone="success" title={t('acceptInvite.doneTitle')} description={t('acceptInvite.doneDesc')} />
              <a href="/" className="bb-btn bb-btn-primary bb-btn-lg" style={{ width: '100%', textAlign: 'center' }}>
                {t('acceptInvite.goToLogin')}
              </a>
            </div>
          )}

          {phase === 'valid' && (
            <>
              <p className="subtitle">{t('acceptInvite.subtitle', { email })}</p>
              {error ? (
                <div role="alert" style={{ marginBottom: 16 }}>
                  <StatePanel tone="danger" title={t('acceptInvite.errorTitle')} description={error} />
                </div>
              ) : null}
              <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor={pwId} className="bb-label" style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                    {t('acceptInvite.passwordLabel')}
                    <span className="req" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id={pwId}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder={t('acceptInvite.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                    disabled={submitting}
                    aria-invalid={touched.password && passwordError ? true : undefined}
                    aria-describedby={touched.password && passwordError ? `${pwId}-error` : undefined}
                    className="bb-input"
                  />
                  {touched.password && passwordError ? (
                    <span id={`${pwId}-error`} role="alert" style={{ fontSize: 12, color: 'var(--bb-danger)' }}>
                      {passwordError}
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor={confirmId} className="bb-label" style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                    {t('acceptInvite.confirmLabel')}
                    <span className="req" aria-hidden="true"> *</span>
                  </label>
                  <input
                    id={confirmId}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    placeholder={t('acceptInvite.confirmPlaceholder')}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
                    disabled={submitting}
                    aria-invalid={touched.confirm && confirmError ? true : undefined}
                    aria-describedby={touched.confirm && confirmError ? `${confirmId}-error` : undefined}
                    className="bb-input"
                  />
                  {touched.confirm && confirmError ? (
                    <span id={`${confirmId}-error`} role="alert" style={{ fontSize: 12, color: 'var(--bb-danger)' }}>
                      {confirmError}
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: 12, color: 'var(--bb-text-muted)', margin: 0 }}>
                  <span aria-hidden="true" style={{ color: 'var(--bb-danger)' }}>*</span> {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
                </p>
                <button type="submit" className="bb-btn bb-btn-primary bb-btn-lg" disabled={submitting} aria-busy={submitting || undefined} style={{ width: '100%' }}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('acceptInvite.submit')
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
