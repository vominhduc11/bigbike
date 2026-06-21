import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { RichTextEditor } from './RichTextEditor'
import { sanitizeHtml } from '../lib/sanitizeHtml'

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

  return (
    <Tabs value={mode} onValueChange={setMode}>
      <TabsList>
        <TabsTrigger value="visual" disabled={disabled}>{t('richEditor.modeVisual')}</TabsTrigger>
        <TabsTrigger value="html" disabled={disabled}>{t('richEditor.modeHtml')}</TabsTrigger>
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

      {/* Tab MÃ HTML thô + xem trước */}
      <TabsContent value="html" className="flex flex-col gap-2">
        <Textarea
          className="font-mono text-xs"
          placeholder={t('richEditor.htmlPlaceholder')}
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          rows={10}
          maxLength={maxLength}
        />
        <p className="text-xs text-muted-foreground">{t('richEditor.htmlHint')}</p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t('richEditor.previewLabel')}
          </label>
          {(value || '').trim() ? (
            <div
              className="size-guide-preview rounded-sm border border-border bg-surface p-3 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
            />
          ) : (
            <p className="list-editor-empty">{t('richEditor.previewEmpty')}</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
