import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { StatePanel } from '../components/StatePanel'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { PasswordInput } from '../components/PasswordInput'
import { ApiClientError, acceptAdminInvite, validateAdminInvite } from '../lib/adminApi'

function readToken() {
  try {
    return new URLSearchParams(window.location.search).get('token') || ''
  } catch {
    return ''
  }
}

function derivePasswordError(password, t) {
  if (!password) return t('acceptInvite.passwordRequired', { defaultValue: 'Vui lòng nhập mật khẩu.' })
  if (password.length < 8) return t('acceptInvite.passwordTooShort')
  return ''
}

function deriveConfirmError(confirm, password, t) {
  if (!confirm) return t('acceptInvite.confirmRequired', { defaultValue: 'Vui lòng nhập lại mật khẩu.' })
  if (confirm !== password) return t('acceptInvite.passwordMismatch')
  return ''
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

  // Lỗi từng ô (gồm cả trường hợp rỗng "bắt buộc"); chỉ HIỆN khi ô đã touched hoặc sau khi bấm gửi.
  const passwordError = derivePasswordError(password, t)
  const confirmError = deriveConfirmError(confirm, password, t)

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
        if (err instanceof ApiClientError && err.status < 500) {
          // 4xx thật từ backend — token thực sự sai/hết hạn.
          setError(err?.message || t('acceptInvite.invalidToken'))
          setPhase('invalid')
        } else {
          // Lỗi trước khi có phản hồi (offline/DNS/CORS) HOẶC lỗi máy chủ 5xx — không phải token hỏng,
          // nên cho thử lại thay vì báo "token sai" gây hiểu nhầm.
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

  // Khi lời mời hợp lệ, đưa con trỏ vào ô mật khẩu để nhập ngay (không phải tìm/bấm thủ công).
  useEffect(() => {
    if (phase === 'valid') document.getElementById(pwId)?.focus()
  }, [phase, pwId])

  async function onSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    // Ô rỗng/không hợp lệ → hiện lỗi ngay dưới ô (touched=true) và focus ô lỗi đầu tiên, không gọi API.
    if (passwordError || confirmError) {
      setTouched({ password: true, confirm: true })
      document.getElementById(passwordError ? pwId : confirmId)?.focus()
      return
    }
    setSubmitting(true)
    try {
      await acceptAdminInvite(token, password)
      setPhase('done')
    } catch (err) {
      // Phân biệt lỗi backend (giữ message backend) với lỗi mạng (thông báo thân thiện).
      if (err instanceof ApiClientError) setError(err?.message || t('acceptInvite.acceptFailed'))
      else setError(t('acceptInvite.networkError'))
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
              <Button asChild size="lg" className="w-full">
                <a href="/">{t('acceptInvite.goToLogin')}</a>
              </Button>
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
              <Button asChild size="lg" variant="secondary" className="w-full">
                <a href="/">{t('acceptInvite.goToLogin')}</a>
              </Button>
            </div>
          )}

          {phase === 'done' && (
            <div className="bb-login-stack">
              <StatePanel tone="success" title={t('acceptInvite.doneTitle')} description={t('acceptInvite.doneDesc')} />
              <Button asChild size="lg" className="w-full">
                <a href="/">{t('acceptInvite.goToLogin')}</a>
              </Button>
            </div>
          )}

          {phase === 'valid' && (
            <>
              <p className="subtitle">{t('acceptInvite.subtitle', { email })}</p>
              {error ? (
                <Alert tone="danger" size="sm" className="mb-4">{error}</Alert>
              ) : null}
              <form onSubmit={onSubmit} noValidate className="bb-auth-form">
                <div className="bb-auth-field">
                  <label htmlFor={pwId} className="bb-auth-label">
                    {t('acceptInvite.passwordLabel')}
                    <span className="bb-required-mark" aria-hidden="true"> *</span>
                  </label>
                  <PasswordInput
                    id={pwId}
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
                  <PasswordInput
                    id={confirmId}
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
                <Button type="submit" size="lg" className="w-full" disabled={submitting} aria-busy={submitting || undefined}>
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('acceptInvite.submit')
                  )}
                </Button>
                <Button asChild size="lg" variant="secondary" className="w-full">
                  <a href="/">{t('acceptInvite.goToLogin')}</a>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
