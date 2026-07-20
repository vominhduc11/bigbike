import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

/**
 * Khối "Yêu cầu cho AI" hiển thị dưới ô dán HTML của các khối PDP (Thông số kỹ
 * thuật / Bảng size / Phù hợp với ai…). Admin thường nhờ AI (ChatGPT/Claude) tạo
 * đoạn HTML rồi dán vào — nhưng AI không biết hệ thiết kế của trang sản phẩm.
 * Nút "Sao chép" đưa sẵn bản brief chứa font/màu/cỡ/khoảng cách thật của web để
 * admin dán kèm nội dung, giúp HTML sinh ra khớp giao diện.
 *
 * `promptKey` là locale key bắt buộc, trỏ tới nội dung brief riêng của từng khối PDP
 * (ví dụ `products.detail.specStats.aiBriefPrompt`).
 */
export default function AiHtmlBrief({ promptKey }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const prompt = t(promptKey)

  function handleCopy() {
    navigator.clipboard?.writeText(prompt)
      .then(() => toast.success(t('products.detail.aiBrief.copied')))
      .catch(() => toast.error(t('products.detail.aiBrief.copyFailed')))
  }

  return (
    <div className="rounded-[var(--admin-radius-card)] border border-border bg-surface-raised">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="h-8 flex-1 justify-start gap-1.5 px-1 text-left text-xs font-medium text-foreground hover:bg-transparent"
        >
          {open
            ? <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
            : <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
          {t('products.detail.aiBrief.title')}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleCopy}>
          <Copy className="size-3.5" aria-hidden="true" />
          {t('products.detail.aiBrief.copy')}
        </Button>
      </div>
      {open && (
        <pre id={panelId} className="whitespace-pre-wrap border-t border-border px-2 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {prompt}
        </pre>
      )}
    </div>
  )
}
