import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import vi from '../locales/vi.json'
import en from '../locales/en.json'

// Giao diện admin KHOÁ CỨNG tiếng Việt — chữ menu/nút/nhãn không đổi theo nút
// VI/EN ở header. Nút đó chỉ đổi ngôn ngữ NỘI DUNG (xem lib/contentLang.js).
// Vẫn nạp resource 'en' để màn hình chi tiết hiển thị nhãn bản tiếng Anh khi cần.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: 'vi',
    fallbackLng: 'vi',
    interpolation: { escapeValue: false },
  })

document.documentElement.lang = 'vi'

export default i18n
