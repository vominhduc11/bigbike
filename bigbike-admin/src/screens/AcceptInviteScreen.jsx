import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError, acceptAdminInvite, validateAdminInvite } from '../lib/adminApi'

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

  const [phase, setPhase] = useState('validating') // validating | valid | invalid | network-error | done
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

  // Tracks whether the screen is still mounted so a late-resolving validate/retry call
  // doesn't setState after unmount (e.g. user navigates away before the request settles).
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const runValidate = useCallback(() => {
    setPhase('validating')
    setError('')
    validateAdminInvite(token)
      .then((info) => {
        if (!mountedRef.current) return
        setEmail(info.email)
        setPhase('valid')
      })
      .catch((err) => {
        if (!mountedRef.current) return
        if (err instanceof ApiClientError) {
          // Real HTTP response (4xx from the backend) — token genuinely invalid/expired.
          setError(err?.message || t('acceptInvite.invalidToken'))
          setPhase('invalid')
        } else {
          // Thrown before any HTTP response (offline, DNS, CORS, server down) — distinct
          // from a broken/expired token, and worth a retry instead of a dead end.
          setError(t('acceptInvite.networkError'))
          setPhase('network-error')
        }
      })
  }, [token, t])

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase('invalid')
      setError(t('acceptInvite.missingToken'))
      return
    }
    runValidate()
  }, [token, t, runValidate])

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
          <p className="bb-login-brand-kicker">
            BigBike
          </p>
          <h1><span className="brand-dot" />Admin</h1>
          <p className="bb-login-tagline">{t('acceptInvite.tagline')}</p>
        </div>
        <div className="bb-login-foot">
          <p>
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
            <div className="bb-login-stack">
              <StatePanel tone="danger" title={t('acceptInvite.invalidTitle')} description={error} />
              <a href="/" className="bb-btn bb-btn-primary bb-btn-lg bb-btn-full">
                {t('acceptInvite.goToLogin')}
              </a>
            </div>
          )}

          {phase === 'network-error' && (
            <div className="bb-login-stack">
              <StatePanel
                tone="danger"
                title={t('acceptInvite.networkErrorTitle')}
                description={error}
                actionLabel={t('common.retry')}
                onAction={runValidate}
              />
              <a href="/" className="bb-btn bb-btn-secondary bb-btn-lg bb-btn-full">
                {t('acceptInvite.goToLogin')}
              </a>
            </div>
          )}

          {phase === 'done' && (
            <div className="bb-login-stack">
              <StatePanel tone="success" title={t('acceptInvite.doneTitle')} description={t('acceptInvite.doneDesc')} />
              <a href="/" className="bb-btn bb-btn-primary bb-btn-lg bb-btn-full">
                {t('acceptInvite.goToLogin')}
              </a>
            </div>
          )}

          {phase === 'valid' && (
            <>
              <p className="subtitle">{t('acceptInvite.subtitle', { email })}</p>
              {error ? (
                <div role="alert" className="bb-login-error compact">
                  <StatePanel tone="danger" title={t('acceptInvite.errorTitle')} description={error} />
                </div>
              ) : null}
              <form onSubmit={onSubmit} noValidate className="bb-auth-form">
                <div className="bb-auth-field">
                  <label htmlFor={pwId} className="bb-auth-label">
                    {t('acceptInvite.passwordLabel')}
                    <span className="bb-required-mark" aria-hidden="true"> *</span>
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
                    <span id={`${pwId}-error`} role="alert" className="bb-field-error">
                      {passwordError}
                    </span>
                  ) : null}
                </div>
                <div className="bb-auth-field">
                  <label htmlFor={confirmId} className="bb-auth-label">
                    {t('acceptInvite.confirmLabel')}
                    <span className="bb-required-mark" aria-hidden="true"> *</span>
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
                    <span id={`${confirmId}-error`} role="alert" className="bb-field-error">
                      {confirmError}
                    </span>
                  ) : null}
                </div>
                <p className="bb-required-legend">
                  <span aria-hidden="true" className="bb-required-mark">*</span> {t('common.requiredLegend', { defaultValue: 'Bắt buộc' })}
                </p>
                <button type="submit" className="bb-btn bb-btn-primary bb-btn-lg bb-btn-full" disabled={submitting} aria-busy={submitting || undefined}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('acceptInvite.submit')
                  )}
                </button>
                <a href="/" className="bb-btn bb-btn-secondary bb-btn-lg bb-btn-full">
                  {t('acceptInvite.goToLogin')}
                </a>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
