import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

/**
 * PasswordInput — ô mật khẩu kèm nút hiện/ẩn (con mắt) dùng chung.
 *
 * Là control độc lập (không kèm label) để mỗi màn tự giữ label/lỗi riêng.
 * Nút con mắt nằm bên phải trong ô; ô chừa padding phải để chữ không đè lên nút
 * (đặt qua inline style để thắng cả class `bb-input` không nằm trong layer Tailwind).
 * Mọi prop khác (value, onChange, onBlur, id, placeholder, aria, disabled, v.v.)
 * chuyển thẳng xuống Input; `className` cho phép giữ style riêng của màn (vd bb-input).
 */
export function PasswordInput({ className, style, disabled, ...props }) {
  const { t } = useTranslation()
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? 'text' : 'password'}
        disabled={disabled}
        className={className}
        style={{ paddingRight: '2.5rem', ...style }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        disabled={disabled}
        aria-label={show ? t('common.hidePassword') : t('common.showPassword')}
        title={show ? t('common.hidePassword') : t('common.showPassword')}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  )
}
