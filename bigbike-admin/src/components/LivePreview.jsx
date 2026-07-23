import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
 * Docs: API_CONTRACT "Product/Article preview", WORKFLOW_OVERVIEW "Live Preview".
 */

// Desktop preview renders the storefront at 1280px and scales down. Keep the
// saved width bounded by the actual row width so preview cannot crush the form.
// Below xl, preview becomes a fixed panel instead of taking layout space.
const RESIZE_STORAGE_KEY = 'bb-preview-desktop-width'
const DOCKED_QUERY = '(min-width: 1280px)'
const MIN_PREVIEW_WIDTH = 520
const MOBILE_PREVIEW_WIDTH = 520
const MIN_FORM_WIDTH = 680
const PREVIEW_GAP_WIDTH = 24
const DEFAULT_PREVIEW_RATIO = 0.52
const MAX_PREVIEW_RATIO = 0.62
const FALLBACK_CONTENT_WIDTH = 1440
const MAX_CONTENT_WIDTH = 1700

function getViewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : FALLBACK_CONTENT_WIDTH
}

function getAvailableWidth(containerWidth) {
  if (Number.isFinite(containerWidth) && containerWidth > 0) return containerWidth
  return Math.max(MIN_PREVIEW_WIDTH, Math.min(getViewportWidth() - 48, MAX_CONTENT_WIDTH))
}

function getPreviewBounds(containerWidth) {
  const available = getAvailableWidth(containerWidth)
  const maxByForm = available - MIN_FORM_WIDTH - PREVIEW_GAP_WIDTH
  const maxByRatio = Math.round(available * MAX_PREVIEW_RATIO)
  const max = Math.max(MIN_PREVIEW_WIDTH, Math.min(maxByForm, maxByRatio))
  return {
    min: Math.min(MIN_PREVIEW_WIDTH, max),
    max,
    available,
  }
}

function clampPreviewWidth(w, containerWidth) {
  const { min, max } = getPreviewBounds(containerWidth)
  return Math.max(min, Math.min(max, w))
}

function defaultPreviewWidth(containerWidth) {
  const { available } = getPreviewBounds(containerWidth)
  return clampPreviewWidth(Math.round(available * DEFAULT_PREVIEW_RATIO), containerWidth)
}

function matchesDockedQuery() {
  return typeof window === 'undefined' ? true : window.matchMedia(DOCKED_QUERY).matches
}

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
  const langRef = useRef(lang)
  const frameHostRef = useRef(null)
  const asideRef = useRef(null)
  const dragRef = useRef(null)
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 })
  const [containerWidth, setContainerWidth] = useState(0)
  const [isDocked, setIsDocked] = useState(matchesDockedQuery)

  // Bề rộng khung ở chế độ Máy tính — kéo được, nhớ qua localStorage.
  const [desktopWidth, setDesktopWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(RESIZE_STORAGE_KEY))
      if (Number.isFinite(saved) && saved >= MIN_PREVIEW_WIDTH) return clampPreviewWidth(saved)
    } catch { /* ignore */ }
    return defaultPreviewWidth()
  })

  const persistWidth = useCallback((w) => {
    try { localStorage.setItem(RESIZE_STORAGE_KEY, String(Math.round(w))) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia(DOCKED_QUERY)
    const sync = () => setIsDocked(media.matches)
    sync()
    if (media.addEventListener) {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    const parent = asideRef.current?.parentElement
    if (!parent) return undefined
    const measure = () => setContainerWidth(Math.round(parent.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [open])

  const onHandlePointerDown = useCallback((e) => {
    if (!isDocked) return
    e.preventDefault()
    const startX = e.clientX
    const startWidth = asideRef.current?.offsetWidth || MIN_PREVIEW_WIDTH
    // Keep drag events on this document even if the cursor crosses the iframe.
    const iframeEl = iframeRef.current
    if (iframeEl) iframeEl.style.pointerEvents = 'none'
    // Preview nằm bên phải: kéo chuột sang trái (clientX giảm) → khung rộng ra.
    const onMove = (ev) => setDesktopWidth(clampPreviewWidth(startWidth + (startX - ev.clientX), containerWidth))
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (iframeEl) iframeEl.style.removeProperty('pointer-events')
      document.body.style.removeProperty('user-select')
      document.body.style.removeProperty('cursor')
      persistWidth(clampPreviewWidth(asideRef.current?.offsetWidth || startWidth, containerWidth))
    }
    dragRef.current = onUp
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [containerWidth, isDocked, persistWidth])

  const nudgeWidth = useCallback((delta) => {
    setDesktopWidth((w) => {
      const next = clampPreviewWidth(w + delta, containerWidth)
      persistWidth(next)
      return next
    })
  }, [containerWidth, persistWidth])

  const onHandleKeyDown = useCallback((e) => {
    // Preview bên phải: mũi tên trái làm rộng khung, phải làm hẹp.
    if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeWidth(32) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudgeWidth(-32) }
  }, [nudgeWidth])

  const resetWidth = useCallback(() => {
    const next = defaultPreviewWidth(containerWidth)
    setDesktopWidth(next)
    persistWidth(next)
  }, [containerWidth, persistWidth])

  // Tháo listener kéo còn treo nếu unmount giữa lúc đang kéo.
  useEffect(() => () => { dragRef.current?.() }, [])

  // Panel là NON-MODAL: form bên trái vẫn thao tác được khi đang xem preview, nên KHÔNG
  // trap focus (trap khiến bàn phím không Tab quay lại được form/trigger). Chỉ bắt Escape
  // để đóng — không cướp/giữ focus trong panel.
  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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
          { type: 'bigbike-preview', data: current, lang: langRef.current },
          webOrigin || '*',
        )
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [webOrigin])

  // Lưu data/lang mới nhất + gửi sang iframe nếu đã bắt tay xong. `lang` nằm trong
  // dependency để đổi VI/EN bắn ngay 1 message cập nhật chrome, không phải chờ
  // debounce fetch data mới ở màn hình cha xong mới đồng bộ.
  useEffect(() => {
    dataRef.current = data
    langRef.current = lang
    if (readyRef.current && data) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'bigbike-preview', data, lang },
        webOrigin || '*',
      )
    }
  }, [data, lang, webOrigin])

  // Đóng pane → reset readiness (ref mutation, không phải setState).
  useEffect(() => {
    if (!open) readyRef.current = false
  }, [open])

  // Đo vùng hiển thị để scale iframe vừa khung. useLayoutEffect đo trước khi paint
  // nên không nháy. ResizeObserver bắt cả khi cửa sổ trình duyệt đổi kích thước.
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
  const previewBounds = getPreviewBounds(containerWidth)
  const effectiveDesktopWidth = clampPreviewWidth(desktopWidth, containerWidth)
  const dockedWidth = device === 'desktop'
    ? effectiveDesktopWidth
    : Math.min(MOBILE_PREVIEW_WIDTH, previewBounds.max)
  const panelStyle = isDocked
    ? {
        width: dockedWidth,
        height: 'calc(100vh - var(--bb-topbar-h) - 40px)',
        boxShadow: 'var(--admin-shadow-lg)',
      }
    : {
        boxShadow: 'var(--admin-shadow-lg)',
      }

  return (
    // Dock beside the form on wide screens; float above the form on narrower ones.
    <aside
      ref={asideRef}
      aria-label={previewTitle}
      className="fixed bottom-3 left-3 right-3 top-[calc(var(--bb-topbar-h)+12px)] z-[var(--admin-z-modal)] flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[var(--admin-radius-card)] border border-border bg-muted outline-none xl:sticky xl:bottom-auto xl:left-auto xl:right-auto xl:top-[calc(var(--bb-topbar-h)+20px)] xl:z-[var(--admin-z-overlay)] xl:shrink-0 xl:self-start"
      style={panelStyle}
    >
      {/* Thanh kéo đổi độ rộng (chỉ chế độ Máy tính). Kéo để chia lại form/preview,
          nhấp đúp về mặc định, mũi tên trái/phải cho bàn phím. */}
      {isDocked && device === 'desktop' && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t(`${i18nPrefix}.resize`, { defaultValue: 'Kéo để đổi độ rộng khung xem trước (nhấp đúp để về mặc định)' })}
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onKeyDown={onHandleKeyDown}
          onDoubleClick={resetWidth}
          className="group absolute inset-y-0 left-0 z-20 flex w-2.5 cursor-col-resize touch-none items-center justify-center hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
        >
          <span className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary" aria-hidden="true" />
        </div>
      )}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Eye size={16} className="text-primary" />
        <span className="text-sm font-medium">{previewTitle}</span>
        {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {/* Ngôn ngữ nội dung — gọi lại dry-run khi đổi */}
          <div className="flex overflow-hidden rounded-md border border-border">
            {['vi', 'en'].map((code) => (
              <Button
                variant="unstyled"
                key={code}
                onClick={() => onLangChange(code)}
                className={cn(
                  'px-2 py-1 text-xs font-medium uppercase transition-colors',
                  lang === code ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
                )}
              >
                {code}
              </Button>
            ))}
          </div>

          {/* Thiết bị xem trước */}
          <div className="flex overflow-hidden rounded-md border border-border">
            <Button
              variant="unstyled"
              onClick={() => onDeviceChange('desktop')}
              aria-label={t(`${i18nPrefix}.desktop`, { defaultValue: 'Máy tính' })}
              className={cn(
                'px-2 py-1 transition-colors',
                device === 'desktop' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <Monitor size={14} />
            </Button>
            <Button
              variant="unstyled"
              onClick={() => onDeviceChange('mobile')}
              aria-label={t(`${i18nPrefix}.mobile`, { defaultValue: 'Điện thoại' })}
              className={cn(
                'px-2 py-1 transition-colors',
                device === 'mobile' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              <Smartphone size={14} />
            </Button>
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
            {/* Chi tiết kỹ thuật của lỗi chỉ hiện ở môi trường dev; người dùng thật chỉ thấy thông báo thân thiện. */}
            {import.meta.env?.DEV && error.message ? ` (${error.message})` : ''}
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
