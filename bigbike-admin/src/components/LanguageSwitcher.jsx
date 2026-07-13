import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setContentLang, useContentLang } from '../lib/contentLang'

// Nút đổi ngôn ngữ NỘI DUNG (tên/mô tả sản phẩm, bài viết, danh mục lấy từ
// server + bản song ngữ đang soạn). KHÔNG đổi ngôn ngữ giao diện admin — giao
// diện luôn cố định tiếng Việt.
const LANGUAGES = [
  { code: 'vi', label: 'VI' },
  { code: 'en', label: 'EN' },
]

export function LanguageSwitcher() {
  const contentLang = useContentLang()
  const { t } = useTranslation()

  return (
    <div
      className="lang-switcher"
      role="group"
      aria-label={t('nav.contentLangLabel', { defaultValue: 'Ngôn ngữ nội dung' })}
    >
      {LANGUAGES.map(({ code, label }) => {
        const active = contentLang === code
        return (
          <Button
            key={code}
            type="button"
            variant="ghost"
            size="sm"
            className={cn('lang-btn rounded-none', active && 'active')}
            onClick={() => setContentLang(code)}
            aria-pressed={active}
          >
            {label}
          </Button>
        )
      })}
    </div>
  )
}
