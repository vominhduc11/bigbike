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

  return (
    <div className="lang-switcher" role="group" aria-label="Ngôn ngữ nội dung">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={`lang-btn${contentLang === code ? ' active' : ''}`}
          onClick={() => setContentLang(code)}
          aria-pressed={contentLang === code}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
