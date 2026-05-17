import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError } from '../lib/adminApi'
import { useAuth } from '../lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
    <div className="full-page-state relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(var(--admin-color-border-default) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 45%, #000 30%, transparent 100%)',
        }}
      />
      <form
        className="relative grid w-full max-w-[400px] gap-5 rounded-[var(--admin-radius-lg)] border border-border bg-card p-8 shadow-[var(--admin-shadow-md)]"
        onSubmit={onSubmit}
        noValidate
      >
        <header className="grid gap-1.5">
          <p className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-primary">
            {t('auth.title')}
          </p>
          <h1 className="text-[length:var(--admin-text-2xl)] font-bold leading-tight tracking-[-0.02em] text-foreground">
            {t('auth.login')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('auth.subtitle')}
          </p>
        </header>

        {hasError ? (
          <div id={errorId} role="alert">
            <StatePanel
              tone="danger"
              title={t('auth.loginError')}
              description={error}
            />
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <label
            htmlFor={emailId}
            className="text-sm font-medium text-foreground"
          >
            {t('auth.email')}
          </label>
          <Input
            id={emailId}
            type="email"
            autoComplete="email"
            required
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            className="h-10 bg-surface-muted"
          />
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor={passwordId}
            className="text-sm font-medium text-foreground"
          >
            {t('auth.password')}
          </label>
          <Input
            id={passwordId}
            type="password"
            autoComplete="current-password"
            required
            minLength={1}
            maxLength={128}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
            className="h-10 bg-surface-muted"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs font-semibold leading-none"
              onClick={() => setShowForgot((v) => !v)}
              aria-expanded={showForgot}
              aria-controls={forgotId}
            >
              {t('auth.forgotPassword')}
            </Button>
          </div>
        </div>

        {showForgot ? (
          <div
            id={forgotId}
            className="rounded-[var(--admin-radius-xs)] border border-info-border bg-info-bg px-4 py-3 text-sm leading-relaxed text-info"
          >
            {t('auth.forgotPasswordNote')}
          </div>
        ) : null}

        <Button type="submit" size="lg" loading={submitting} disabled={submitting}>
          {submitting ? t('auth.loggingIn') : t('auth.login')}
        </Button>

        <div className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
          {t('auth.supportContact')}:{' '}
          <a
            href="mailto:admin@bigbike.vn"
            className="font-semibold text-primary hover:underline"
          >
            admin@bigbike.vn
          </a>
        </div>
      </form>
    </div>
  )
}
