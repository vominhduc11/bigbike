import { useEffect, useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError, fetchPublicSettings } from '../lib/adminApi'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [contactEmail, setContactEmail] = useState('admin@bigbike.vn')

  useEffect(() => {
    fetchPublicSettings()
      .then((settings) => {
        const found = settings.find((s) => s.settingKey === 'contact_email')
        if (found?.settingValue) {
          setContactEmail(found.settingValue)
        }
      })
      .catch(() => {})
  }, [])

  const emailId = useId()
  const passwordId = useId()
  const errorId = useId()
  const forgotId = useId()

  async function onSubmit(event) {
    event?.preventDefault()
    if (submitting) return
    setError('')
    setCanRetry(false)
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError(err.code === 'ACCOUNT_LOCKED' ? t('auth.accountLocked') : t('auth.invalidCredentials'))
        setCanRetry(false)
      } else {
        // Lỗi mạng/máy chủ — cho phép thử lại tường minh
        setError(err?.message || t('auth.loginFailed'))
        setCanRetry(true)
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
          <p className="bb-login-brand-kicker">
            BigBike
          </p>
          <h1>
            <span className="brand-dot" />
            Admin
          </h1>
          <p className="bb-login-tagline">{t('auth.loginTagline', 'Quản lý toàn bộ hoạt động kinh doanh của BigBike tại đây.')}</p>
        </div>
        <div className="bb-login-foot">
          <p>
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
            <div id={errorId} role="alert" className="bb-login-error">
              <StatePanel
                tone="danger"
                title={t('auth.loginError')}
                description={error}
                actionLabel={canRetry ? t('common.retry') : undefined}
                onAction={canRetry ? () => onSubmit() : undefined}
              />
            </div>
          ) : null}

          <form onSubmit={onSubmit} noValidate className="bb-auth-form">
            <p className="bb-required-legend">
              <span aria-hidden="true" className="bb-required-mark">*</span> {t('common.requiredLegend', 'Bắt buộc')}
            </p>
            <div className="bb-auth-field">
              <label htmlFor={emailId} className="bb-auth-label">
                {t('auth.email')}
                <span aria-hidden="true" className="bb-required-mark"> *</span>
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? errorId : undefined}
                className="bb-input"
              />
            </div>

            <div className="bb-auth-field">
              <div className="bb-auth-label-row">
                <label htmlFor={passwordId} className="bb-auth-label">
                  {t('auth.password')}
                  <span aria-hidden="true" className="bb-required-mark"> *</span>
                </label>
                <button
                  type="button"
                  className="bb-btn bb-btn-ghost bb-btn-sm"
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
                aria-required="true"
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
                className="bb-alert info bb-alert-readable"
              >
                {t('auth.forgotPasswordNote')}
              </div>
            ) : null}

            <button
              type="submit"
              className="bb-btn bb-btn-primary bb-btn-lg bb-btn-full"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                  {t('auth.loggingIn')}
                </>
              ) : (
                t('auth.login')
              )}
            </button>
          </form>

          <div className="bb-login-support">
            {t('auth.supportContact')}:{' '}
            <a href={`mailto:${contactEmail}`} className="bb-login-support-link">
              {contactEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
