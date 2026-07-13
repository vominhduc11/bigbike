import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from './RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'
import { showConfirm } from '../lib/confirm'

// Thẻ HTML mà trình soạn thảo trực quan (TipTap) KHÔNG biểu diễn được. Nếu nội dung đã lưu
// chứa các thẻ này thì mở thẳng tab "Mã HTML" để TipTap không âm thầm cắt mất khi người dùng
// sửa ở tab soạn thảo (bảng, bố cục, figure, iframe...). Bộ thẻ TipTap chỉ gồm
// p/h2/h3/ul/ol/li/blockquote/pre/hr/a/img/strong/em/u/s/code nên không lọt vào danh sách này.
const ADVANCED_HTML =
  /<(table|thead|tbody|tfoot|tr|td|th|caption|div|figure|figcaption|iframe|video|source|section|article|h1|h4|h5|h6|span)[\s/>]/i

function htmlNeedsSource(html) {
  return ADVANCED_HTML.test(html || '')
}

/**
 * RichTextEditorWithSource — bọc {@link RichTextEditor} (trình soạn TipTap) thêm tab "Mã HTML":
 *  • Tab "Soạn thảo": trình soạn trực quan (giới hạn theo bộ thẻ TipTap).
 *  • Tab "Mã HTML": nhập/dán HTML thô + xem trước đã lọc đúng như web hiển thị.
 *
 * Cả hai tab ghi vào CÙNG một chuỗi `value` (HTML) nên chuyển tab không phá dữ liệu:
 * RichTextEditor chỉ phát `onChange` khi người dùng thật sự sửa, KHÔNG phát lúc nạp lại nội dung.
 * TipTap chuẩn hoá HTML khi parse, vì vậy thẻ ngoài bộ nó hiểu chỉ bị rút gọn NẾU người dùng
 * sửa ở tab soạn thảo — nội dung nâng cao được tự mở ở tab Mã HTML để tránh mất ngoài ý muốn.
 * Chế độ KHÔNG lưu vào dữ liệu; mở lại tự nhận diện theo nội dung hiện có.
 */
export function RichTextEditorWithSource({
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
  enableImagePicker = false,
  maxLength = 50000,
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(() => (htmlNeedsSource(value) ? 'html' : 'visual'))

  // Re-seed chế độ khi nội dung THẬT xuất hiện lần đầu (vd form nạp dữ liệu bất đồng bộ sau khi
  // mount với value rỗng). Nếu không, nội dung nâng cao tải muộn sẽ kẹt ở tab Soạn thảo và có thể
  // bị rút gọn khi người dùng sửa. Chỉ chạy MỘT lần (khi content đầu tiên tới) để không đè lựa
  // chọn tab thủ công của người dùng về sau.
  const seededRef = useRef((value || '').trim().length > 0)
  useEffect(() => {
    if (seededRef.current) return
    if ((value || '').trim().length > 0) {
      seededRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(htmlNeedsSource(value) ? 'html' : 'visual')
    }
  }, [value])

  // Chuyển sang Soạn thảo trực quan khi nội dung đang có thẻ nâng cao → xác nhận trước (trình trực
  // quan có thể lược bỏ bảng/bố cục khi sửa). Vẫn cho XEM nguồn kể cả khi disabled (read-only).
  async function changeMode(next) {
    if (next === mode) return
    if (next === 'visual' && htmlNeedsSource(value)) {
      const ok = await showConfirm(
        t('richEditor.switchVisualConfirm', { defaultValue: 'Chuyển sang trình soạn trực quan có thể lược bỏ bảng/bố cục nâng cao khi bạn chỉnh sửa. Tiếp tục?' }),
        t('richEditor.switchVisualTitle', { defaultValue: 'Chuyển chế độ soạn thảo' }),
      )
      if (!ok) return
    }
    setMode(next)
  }

  const count = (value || '').length

  return (
    <Tabs value={mode} onValueChange={changeMode}>
      <TabsList>
        <TabsTrigger value="visual">{t('richEditor.modeVisual')}</TabsTrigger>
        <TabsTrigger value="html">{t('richEditor.modeHtml')}</TabsTrigger>
      </TabsList>

      {/* Tab SOẠN THẢO trực quan */}
      <TabsContent value="visual">
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          hasError={hasError}
          enableImagePicker={enableImagePicker}
        />
      </TabsContent>

      {/* Tab MÃ HTML thô + xem trước — disabled ⇒ read-only để vẫn xem/sao chép được nguồn. */}
      <TabsContent value="html" className="flex flex-col gap-2">
        <Textarea
          className="font-mono text-xs"
          aria-label={t('richEditor.htmlSourceLabel', { defaultValue: 'Mã nguồn HTML' })}
          aria-invalid={hasError ? true : undefined}
          placeholder={t('richEditor.htmlPlaceholder')}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={disabled}
          rows={10}
          maxLength={maxLength}
        />
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t('richEditor.htmlHint')}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count} / {maxLength}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('richEditor.previewLabel')}
          </label>
          {(value || '').trim() ? (
            <div className="rte-canvas-frame">
              <div
                className="rte-canvas rounded-sm p-3 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
              />
            </div>
          ) : (
            <p className="list-editor-empty">{t('richEditor.previewEmpty')}</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
