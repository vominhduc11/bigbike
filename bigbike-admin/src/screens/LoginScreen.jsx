import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiClientError, fetchPublicSettings } from '../lib/adminApi'
import { useAuth } from '../lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '../components/PasswordInput'
import { Alert } from '@/components/ui/alert'

export function LoginScreen() {
  const { login } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [canRetry, setCanRetry] = useState(false)
  // Lỗi sai thông tin đăng nhập (401) → đánh dấu cả 2 ô; lỗi mạng/máy chủ KHÔNG đánh dấu ô nào.
  const [credentialError, setCredentialError] = useState(false)
  // Lỗi kiểm tra tại client theo từng ô (email/password) — hiện inline, không gọi API khi có.
  const [fieldErrors, setFieldErrors] = useState({})
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
  const emailErrId = useId()
  const passwordErrId = useId()

  // Kiểm tra client trước khi gọi API (form dùng noValidate nên phải tự validate):
  // email không được rỗng và phải đúng định dạng; mật khẩu không được rỗng.
  function validate() {
    const errs = {}
    const em = email.trim()
    // Kiểm tra định dạng đơn giản (không regex phức tạp): có 1 '@', có '.' sau '@', không khoảng trắng.
    const at = em.indexOf('@')
    const dot = em.lastIndexOf('.')
    const emailWellFormed = at > 0 && dot > at + 1 && dot < em.length - 1 && !/\s/.test(em)
    if (!em) errs.email = t('auth.emailRequired', { defaultValue: 'Vui lòng nhập email.' })
    else if (!emailWellFormed) errs.email = t('auth.emailInvalid', { defaultValue: 'Email không hợp lệ.' })
    if (!password) errs.password = t('auth.passwordRequired', { defaultValue: 'Vui lòng nhập mật khẩu.' })
    return errs
  }

  async function onSubmit(event) {
    event?.preventDefault()
    if (submitting) return
    setError('')
    setCanRetry(false)
    setCredentialError(false)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      document.getElementById(errs.email ? emailId : passwordId)?.focus()
      return
    }
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError(err.code === 'ACCOUNT_LOCKED' ? t('auth.accountLocked') : t('auth.invalidCredentials'))
        setCanRetry(false)
        setCredentialError(true)
        document.getElementById(emailId)?.focus()
      } else {
        // Lỗi mạng/máy chủ — cho phép thử lại tường minh, không đánh dấu ô (thông tin có thể vẫn đúng)
        setError(t('auth.networkError', { defaultValue: 'Không thể kết nối máy chủ. Vui lòng thử lại.' }))
        setCanRetry(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const hasError = Boolean(error)

  // Ô mô tả bởi: lỗi inline của chính ô (nếu có), nếu không thì alert lỗi sai thông tin đăng nhập.
  function fieldDescribedBy(ownErrId, hasOwnErr) {
    if (hasOwnErr) return ownErrId
    if (credentialError) return errorId
    return undefined
  }

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
            <Alert id={errorId} tone="danger" size="sm" className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <span>{error}</span>
                {canRetry ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSubmit()}
                    className="h-auto shrink-0 px-2 py-1 text-danger hover:text-danger"
                  >
                    {t('common.retry')}
                  </Button>
                ) : null}
              </div>
            </Alert>
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
              <Input
                id={emailId}
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })) }}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.email) || credentialError || undefined}
                aria-describedby={fieldDescribedBy(emailErrId, Boolean(fieldErrors.email))}
              />
              {fieldErrors.email ? (
                <span id={emailErrId} role="alert" className="bb-field-error">{fieldErrors.email}</span>
              ) : null}
            </div>

            <div className="bb-auth-field">
              <div className="bb-auth-label-row">
                <label htmlFor={passwordId} className="bb-auth-label">
                  {t('auth.password')}
                  <span aria-hidden="true" className="bb-required-mark"> *</span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForgot((v) => !v)}
                  aria-expanded={showForgot}
                  aria-controls={forgotId}
                >
                  {t('auth.forgotPassword')}
                </Button>
              </div>
              <PasswordInput
                id={passwordId}
                autoComplete="current-password"
                required
                aria-required="true"
                minLength={1}
                maxLength={128}
                placeholder={t('auth.passwordPlaceholder')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })) }}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.password) || credentialError || undefined}
                aria-describedby={fieldDescribedBy(passwordErrId, Boolean(fieldErrors.password))}
              />
              {fieldErrors.password ? (
                <span id={passwordErrId} role="alert" className="bb-field-error">{fieldErrors.password}</span>
              ) : null}
            </div>

            {showForgot ? (
              <div
                id={forgotId}
                className="bb-alert info bb-alert-readable"
              >
                {t('auth.forgotPasswordNote')}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              loading={submitting}
              className="w-full"
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? t('auth.loggingIn') : t('auth.login')}
            </Button>
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
