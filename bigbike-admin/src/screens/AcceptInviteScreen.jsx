import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

  const pwId = useId()
  const confirmId = useId()

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
                  <label htmlFor={pwId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                    {t('acceptInvite.passwordLabel')}
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
                    disabled={submitting}
                    className="bb-input"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label htmlFor={confirmId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                    {t('acceptInvite.confirmLabel')}
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
                    disabled={submitting}
                    className="bb-input"
                  />
                </div>
                <button type="submit" className="bb-btn bb-btn-primary bb-btn-lg" disabled={submitting} style={{ width: '100%' }}>
                  {submitting ? t('common.saving') : t('acceptInvite.submit')}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
