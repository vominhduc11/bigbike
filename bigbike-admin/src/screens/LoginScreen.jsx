import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError } from '../lib/adminApi'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const forgotId = useId()

  async function onSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError(t('auth.invalidCredentials'))
      } else {
        setError(err?.message || t('auth.loginFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hasError = Boolean(error)

  return (
    <div className="bb-login-shell">
      {/* Left panel — brand */}
      <div className="bb-login-left">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--bb-text-onsidebar-dim)', marginBottom: 20 }}>
            BigBike
          </p>
          <h1>
            <span className="brand-dot" />
            Admin
          </h1>
          <p style={{ marginTop: 16, maxWidth: 280 }}>{t('auth.loginTagline', 'Quản lý toàn bộ hoạt động kinh doanh của BigBike tại đây.')}</p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 48 }}>
          <p style={{ fontSize: 12, color: 'var(--bb-text-onsidebar-dim)' }}>
            © {new Date().getFullYear()} BigBike. {t('auth.allRightsReserved', 'Bảo lưu mọi quyền.')}
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="bb-login-right">
        <div className="bb-login-form">
          <h2>{t('auth.login')}</h2>
          <p className="subtitle">{t('auth.subtitle')}</p>

          {hasError ? (
            <div id={errorId} role="alert" style={{ marginBottom: 20 }}>
              <StatePanel
                tone="danger"
                title={t('auth.loginError')}
                description={error}
              />
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor={emailId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                {t('auth.email')}
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? errorId : undefined}
                className="bb-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor={passwordId} style={{ fontSize: 13, fontWeight: 500, color: 'var(--bb-text)' }}>
                  {t('auth.password')}
                </label>
                <button
                  type="button"
                  className="bb-btn bb-btn-ghost bb-btn-sm"
                  style={{ fontSize: 12 }}
                  onClick={() => setShowForgot((v) => !v)}
                  aria-expanded={showForgot}
                  aria-controls={forgotId}
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                required
                minLength={1}
                maxLength={128}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? errorId : undefined}
                className="bb-input"
              />
            </div>

            {showForgot ? (
              <div
                id={forgotId}
                className="bb-alert info"
                style={{ fontSize: 13, lineHeight: 1.6 }}
              >
                {t('auth.forgotPasswordNote')}
              </div>
            ) : null}

            <button
              type="submit"
              className="bb-btn bb-btn-primary bb-btn-lg"
              disabled={submitting}
              style={{ width: '100%' }}
            >
              {submitting ? t('auth.loggingIn') : t('auth.login')}
            </button>
          </form>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--bb-border)', textAlign: 'center', fontSize: 12, color: 'var(--bb-text-muted)' }}>
            {t('auth.supportContact')}:{' '}
            <a href="mailto:admin@bigbike.vn" style={{ fontWeight: 600, color: 'var(--bb-brand)' }}>
              admin@bigbike.vn
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
