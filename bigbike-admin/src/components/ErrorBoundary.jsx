import { Component } from 'react'
import { Button } from '@/components/ui/button'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to console; wire to Sentry / error reporting service here when available
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset() {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem', textAlign: 'center', gap: '1rem',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Đã xảy ra lỗi không mong đợi</h1>
          <p style={{ color: 'var(--c-text-muted)', maxWidth: '480px' }}>
            {this.state.error?.message || 'Vui lòng tải lại trang hoặc liên hệ kỹ thuật viên.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button
              type="button"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </Button>
            <Button variant="secondary"
              type="button"
              onClick={() => this.handleReset()}
            >
              Thử lại
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
