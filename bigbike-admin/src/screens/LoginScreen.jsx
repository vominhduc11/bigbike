import { useState } from 'react'
import { StatePanel } from '../components/StatePanel'
import { ApiClientError } from '../lib/adminApi'
import { useAuth } from '../lib/auth'

export function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(event) {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('Email hoặc mật khẩu không đúng.')
      } else {
        setError(err?.message || 'Đăng nhập thất bại. Vui lòng thử lại.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="full-page-state">
      <form className="login-card" onSubmit={onSubmit}>
        <header>
          <p className="eyebrow">BigBike Admin</p>
          <h1>Đăng nhập</h1>
          <p>Nhập email quản trị và mật khẩu để truy cập bảng điều khiển.</p>
        </header>

        {error ? (
          <StatePanel tone="danger" title="Không thể đăng nhập" description={error} />
        ) : null}

        <label>
          Email
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
          Mật khẩu
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

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  )
}
