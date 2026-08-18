import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

/**
 * Khối "Yêu cầu cho AI" hiển thị dưới ô dán HTML của các khối PDP (Thông số kỹ
 * thuật / Bảng size / Phù hợp với ai…). Admin thường nhờ AI (ChatGPT/Claude) tạo
 * đoạn HTML rồi dán vào — nhưng AI không biết hệ thiết kế của trang sản phẩm.
 * Nút "Sao chép" đưa sẵn bản brief về đúng khuôn HTML và hồ sơ dữ liệu hiện tại để
 * admin dán sang AI; website tự chịu trách nhiệm về font, màu, cỡ và khoảng cách.
 *
 * `promptKey` trỏ tới nội dung brief riêng của từng khối PDP (ví dụ
 * `products.detail.specStats.aiBriefPrompt`); màn hình khác có thể truyền `prompt` động.
 */
export default function AiHtmlBrief({
  promptKey,
  prompt: promptValue,
  getPrompt,
  title,
  copyLabel,
  copiedMessage,
  copyFailedMessage,
  copyingMessage,
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [dynamicPrompt, setDynamicPrompt] = useState(null)
  const panelId = useId()
  const prompt = dynamicPrompt ?? promptValue ?? (promptKey ? t(promptKey) : '')

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.className = 'fixed -left-full -top-full'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand?.('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard is unavailable')
  }

  async function handleCopy() {
    if (isCopying) return
    setIsCopying(true)
    try {
      const nextPrompt = typeof getPrompt === 'function' ? await getPrompt() : prompt
      setDynamicPrompt(nextPrompt)
      await copyText(nextPrompt)
      toast.success(copiedMessage || t('products.detail.aiBrief.copied'))
    } catch {
      toast.error(copyFailedMessage || t('products.detail.aiBrief.copyFailed'))
    } finally {
      setIsCopying(false)
    }
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
          {title || t('products.detail.aiBrief.title')}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleCopy} disabled={isCopying}>
          <Copy className="size-3.5" aria-hidden="true" />
          {isCopying ? (copyingMessage || t('products.detail.aiBrief.copying')) : (copyLabel || t('products.detail.aiBrief.copy'))}
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
