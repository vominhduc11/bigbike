import { useEffect, useRef } from 'react'
import { AlertCircle, Eye, Loader2, Monitor, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Khung xem trước "sống" dùng chung cho mọi loại nội dung (sản phẩm, bài viết…).
 *
 * Nhúng iframe bigbike-web (`previewPath`, ví dụ `/preview/product/` hoặc
 * `/preview/article/`) rồi bơm dữ liệu nháp (đã được backend dry-run map sang public
 * shape) qua postMessage — KHÔNG lưu gì, chỉ render bằng đúng template storefront thật.
 *
 * Chỉ làm UI + cầu nối iframe; phần debounce + gọi API preview do màn hình cha đảm
 * nhiệm và truyền `data` xuống. Nhãn lấy qua `t` + `i18nPrefix` (mỗi feature một bộ
 * key, ví dụ `products.detail.preview` / `content.detail.preview`).
 *
 * Docs: API_CONTRACT "Product/Article preview", WORKFLOW_OVERVIEW "Live Preview".
 */
export function LivePreview({
  open,
  onClose,
  data,
  error,
  loading,
  lang,
  onLangChange,
  device,
  onDeviceChange,
  webOrigin,
  previewPath,
  i18nPrefix,
  t,
}) {
  const iframeRef = useRef(null)
  const readyRef = useRef(false)
  const dataRef = useRef(data)

  // Bắt tay: iframe báo "ready" khi mount → gửi ngay payload hiện tại (đọc qua ref
  // nên không stale, và không setState trong effect).
  useEffect(() => {
    function onMessage(event) {
      if (webOrigin && event.origin !== webOrigin) return
      if (event?.data?.type !== 'bigbike-preview-ready') return
      readyRef.current = true
      const current = dataRef.current
      if (current) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'bigbike-preview', data: current },
          webOrigin || '*',
        )
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [webOrigin])

  // Lưu data mới nhất + gửi sang iframe nếu đã bắt tay xong.
  useEffect(() => {
    dataRef.current = data
    if (readyRef.current && data) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'bigbike-preview', data },
        webOrigin || '*',
      )
    }
  }, [data, webOrigin])

  // Đóng pane → reset readiness (ref mutation, không phải setState).
  useEffect(() => {
    if (!open) readyRef.current = false
  }, [open])

  if (!open) return null

  const frameWidth = device === 'mobile' ? 390 : '100%'
  const previewTitle = t(`${i18nPrefix}.title`, { defaultValue: 'Xem trước' })

  return (
    <div className="fixed inset-0 z-[60] flex">
      {/* Lớp phủ mờ — bấm để đóng */}
      <button
        type="button"
        aria-label={t('common.close', { defaultValue: 'Đóng' })}
        className="flex-1 cursor-default bg-black/40"
        onClick={onClose}
      />

      {/* Panel phải */}
      <aside className="flex h-full w-full max-w-[860px] flex-col border-l border-border bg-muted shadow-xl">
        <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
          <Eye size={16} className="text-primary" />
          <span className="text-sm font-medium">{previewTitle}</span>
          {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}

          <div className="ml-auto flex items-center gap-1.5">
            {/* Ngôn ngữ nội dung — gọi lại dry-run khi đổi */}
            <div className="flex overflow-hidden rounded-md border border-border">
              {['vi', 'en'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLangChange(code)}
                  className={cn(
                    'px-2 py-1 text-xs font-medium uppercase transition-colors',
                    lang === code ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
                  )}
                >
                  {code}
                </button>
              ))}
            </div>

            {/* Thiết bị xem trước */}
            <div className="flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => onDeviceChange('desktop')}
                aria-label={t(`${i18nPrefix}.desktop`, { defaultValue: 'Máy tính' })}
                className={cn(
                  'px-2 py-1 transition-colors',
                  device === 'desktop' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDeviceChange('mobile')}
                aria-label={t(`${i18nPrefix}.mobile`, { defaultValue: 'Điện thoại' })}
                className={cn(
                  'px-2 py-1 transition-colors',
                  device === 'mobile' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                <Smartphone size={14} />
              </button>
            </div>

            <Button variant="ghost" size="icon" type="button" onClick={onClose} aria-label={t('common.close', { defaultValue: 'Đóng' })}>
              <X size={16} />
            </Button>
          </div>
        </header>

        {/* Cảnh báo khi dry-run lỗi (thường là thiếu thông tin bắt buộc) */}
        {error && (
          <div
            className="flex items-start gap-2 border-b border-border px-4 py-2 text-xs"
            style={{
              background: 'var(--admin-color-status-warning-bg)',
              color: 'var(--admin-color-status-warning-text)',
            }}
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>
              {t(`${i18nPrefix}.invalid`, {
                defaultValue: 'Chưa xem trước được — kiểm tra lại các thông tin bắt buộc (ví dụ: danh mục, đường dẫn).',
              })}
              {error.message ? ` (${error.message})` : ''}
            </span>
          </div>
        )}

        {/* Iframe storefront thật */}
        <div className="flex flex-1 justify-center overflow-auto bg-muted p-3">
          <iframe
            ref={iframeRef}
            title={previewTitle}
            src={`${webOrigin}${previewPath}`}
            className="h-full border-0 bg-white shadow"
            style={{ width: frameWidth, maxWidth: '100%' }}
          />
        </div>
      </aside>
    </div>
  )
}
