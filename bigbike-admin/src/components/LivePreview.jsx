import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, Eye, Loader2, Monitor, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDialogA11y } from '@/lib/useDialogA11y'

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
  const frameHostRef = useRef(null)
  const panelRef = useRef(null)
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 })

  // A3: Escape đóng + focus-trap + trả focus cho slide-over tự dựng (không qua Radix).
  useDialogA11y(panelRef, { active: open, onClose })

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

  // Đo vùng hiển thị để scale iframe vừa khung. useLayoutEffect đo trước khi paint
  // nên không nháy. ResizeObserver bắt cả khi cửa sổ/pane đổi kích thước.
  useLayoutEffect(() => {
    if (!open) return undefined
    const el = frameHostRef.current
    if (!el) return undefined
    const measure = () => setHostSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  if (!open) return null

  const previewTitle = t(`${i18nPrefix}.title`, { defaultValue: 'Xem trước' })

  // Bề rộng "logic" để storefront tự quyết layout theo breakpoint: desktop = 1280
  // (vượt mốc >1024 của PDP → ra layout desktop thật), mobile = 390. Khung preview
  // hẹp hơn nên thu nhỏ vừa khít (chỉ scale xuống, tối đa 1 — không phóng to gây mờ).
  // Không làm vậy thì iframe ~860px luôn kẹt ở breakpoint tablet.
  const FRAME_PAD = 12 // = p-3 của vùng chứa
  const targetWidth = device === 'mobile' ? 390 : 1280
  const availWidth = Math.max(0, hostSize.width - FRAME_PAD * 2)
  const availHeight = Math.max(0, hostSize.height - FRAME_PAD * 2)
  const scale = availWidth > 0 ? Math.min(1, availWidth / targetWidth) : 1

  return (
    // Không có lớp phủ full-viewport chặn click: panel chỉ chiếm dải bên phải
    // (max 860px), phần form bên trái vẫn thao tác được trong lúc xem preview —
    // đúng tinh thần "live" (xem cập nhật ngay khi gõ, không phải đóng panel mới
    // sửa tiếp được). Đóng bằng nút X hoặc Escape (useDialogA11y).
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-[var(--admin-z-overlay)] flex w-full max-w-[860px] flex-col border-l border-border bg-muted shadow-xl outline-none"
    >
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

      {/* Iframe storefront thật — render ở bề rộng desktop/mobile thật rồi scale
          vừa khung để thấy đúng layout theo breakpoint, không bị kẹt ở tablet. */}
      <div
        ref={frameHostRef}
        className="flex flex-1 justify-center overflow-hidden bg-muted p-3"
      >
        <div className="rte-canvas-frame">
          <div
            className="shadow"
            style={{ width: Math.round(targetWidth * scale), height: availHeight || '100%' }}
          >
            <iframe
              ref={iframeRef}
              title={previewTitle}
              src={`${webOrigin}${previewPath}`}
              className="border-0 bg-white"
              style={{
                width: targetWidth,
                height: availHeight ? availHeight / scale : '100%',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>
      </div>
    </aside>
  )
}
