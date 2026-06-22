import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

/**
 * Khối "Yêu cầu cho AI" hiển thị dưới ô dán HTML của các khối PDP (Thông số kỹ
 * thuật / Bảng size / Phù hợp với ai…). Admin thường nhờ AI (ChatGPT/Claude) tạo
 * đoạn HTML rồi dán vào — nhưng AI không biết hệ thiết kế của trang sản phẩm.
 * Nút "Sao chép" đưa sẵn bản brief chứa font/màu/cỡ/khoảng cách thật của web để
 * admin dán kèm nội dung, giúp HTML sinh ra khớp giao diện. Brief là 1 chuỗi
 * locale dùng chung (products.detail.aiBrief.prompt) — what-you-see-is-what-you-copy.
 */
export default function AiHtmlBrief() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const prompt = t('products.detail.aiBrief.prompt')

  function handleCopy() {
    navigator.clipboard?.writeText(prompt)
      .then(() => toast.success(t('products.detail.aiBrief.copied')))
      .catch(() => toast.error(t('products.detail.aiBrief.copyFailed')))
  }

  return (
    <div className="rounded-sm border border-border bg-surface-raised">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium text-foreground"
        >
          {open ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          {t('products.detail.aiBrief.title')}
        </button>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleCopy}>
          <Copy className="size-3.5" />
          {t('products.detail.aiBrief.copy')}
        </Button>
      </div>
      {open && (
        <pre className="whitespace-pre-wrap border-t border-border px-2 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {prompt}
        </pre>
      )}
    </div>
  )
}
