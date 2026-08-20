import { Component } from 'react'
import { Button } from '@/components/ui/button'
import i18n from '@/lib/i18n'

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
      // ErrorBoundary là class component nên KHÔNG dùng được hook useTranslation —
      // gọi thẳng instance i18next (mọi text vẫn i18n hoá, kèm defaultValue tiếng Việt).
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-screen p-8 text-center gap-4"
        >
          <h1 className="text-2xl font-bold">
            {i18n.t('errorBoundary.title', { defaultValue: 'Đã xảy ra lỗi không mong đợi' })}
          </h1>
          <p className="text-muted-foreground max-w-[480px]">
            {i18n.t('errorBoundary.description', {
              defaultValue:
                'Vui lòng tải lại trang. Nếu lỗi vẫn tiếp diễn, hãy liên hệ người quản trị.',
            })}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              {i18n.t('errorBoundary.reload', { defaultValue: 'Tải lại trang' })}
            </Button>
            {/* Đường thoát an toàn: bấm "Thử lại" dễ lặp lại đúng lỗi cũ, nên cho về
                route gốc (tải lại sạch state). */}
            <Button variant="secondary" type="button" onClick={() => window.location.assign('/')}>
              {i18n.t('errorBoundary.goHome', { defaultValue: 'Về trang chủ' })}
            </Button>
            <Button variant="ghost" type="button" onClick={() => this.handleReset()}>
              {i18n.t('errorBoundary.retry', { defaultValue: 'Thử lại' })}
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
