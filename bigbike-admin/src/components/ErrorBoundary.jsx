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
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center gap-4">
          <h1 className="text-2xl font-bold">Đã xảy ra lỗi không mong đợi</h1>
          <p className="text-muted-foreground max-w-[480px]">
            {this.state.error?.message || 'Vui lòng tải lại trang hoặc liên hệ kỹ thuật viên.'}
          </p>
          <div className="flex gap-3">
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
