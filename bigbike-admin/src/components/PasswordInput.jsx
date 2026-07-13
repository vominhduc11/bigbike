import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * PasswordInput — ô mật khẩu kèm nút hiện/ẩn (con mắt) dùng chung.
 *
 * Là control độc lập (không kèm label) để mỗi màn tự giữ label/lỗi riêng.
 * Nút con mắt nằm bên phải trong ô; ô chừa padding phải (`pr-10` = bề rộng nút) để
 * chữ không đè lên nút. Mọi prop khác (value, onChange, onBlur, id, placeholder,
 * aria, disabled, v.v.) chuyển thẳng xuống Input; `className` cho phép giữ style
 * riêng của màn.
 */
export function PasswordInput({ className, style, disabled, ...props }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  const toggleLabel = show ? t('common.hidePassword') : t('common.showPassword')
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        disabled={disabled}
        className={cn('pr-10', className)}
        style={style}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        aria-label={toggleLabel}
        title={toggleLabel}
        className="absolute inset-y-0 right-0 h-auto w-10 rounded-none bg-transparent px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </Button>
    </div>
  )
}
