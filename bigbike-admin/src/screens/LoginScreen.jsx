import { useState } from 'react'
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

  return (
    <div className="full-page-state">
      <form className="login-card" onSubmit={onSubmit}>
        <header>
          <p className="eyebrow">{t('auth.title')}</p>
          <h1>{t('auth.login')}</h1>
          <p>{t('auth.subtitle')}</p>
        </header>

        {error ? (
          <StatePanel tone="danger" title={t('auth.loginError')} description={error} />
        ) : null}

        <label>
          {t('auth.email')}
          <input
            className="control-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
          />
        </label>

        <label>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span>{t('auth.password')}</span>
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--admin-color-brand-red)',
                fontSize: 'var(--admin-text-xs)',
                fontWeight: 600,
                padding: 0,
                lineHeight: 1,
              }}
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <input
            className="control-input"
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
          />
        </label>

        {showForgot && (
          <div style={{
            padding: 'var(--admin-space-3) var(--admin-space-4)',
            background: 'var(--admin-color-status-info-bg)',
            border: '1px solid var(--admin-color-status-info-border)',
            borderRadius: 'var(--admin-radius-sm)',
            fontSize: 'var(--admin-text-sm)',
            color: 'var(--admin-color-status-info-text)',
            lineHeight: 1.5,
          }}>
            {t('auth.forgotPasswordNote')}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('auth.loggingIn') : t('auth.login')}
        </button>

        <div style={{
          paddingTop: 'var(--admin-space-3)',
          borderTop: '1px solid var(--admin-color-border-subtle)',
          textAlign: 'center',
          fontSize: 'var(--admin-text-xs)',
          color: 'var(--admin-color-text-muted)',
        }}>
          {t('auth.supportContact')}:{' '}
          <a
            href="mailto:admin@bigbike.vn"
            style={{ color: 'var(--admin-color-brand-red)', fontWeight: 600 }}
          >
            admin@bigbike.vn
          </a>
        </div>
      </form>
    </div>
  )
}
