import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import vi from '../locales/vi.json'

// Giao diện admin KHOÁ CỨNG tiếng Việt — chữ menu/nút/nhãn không đổi theo nút
// VI/EN ở header. Nút đó chỉ đổi ngôn ngữ NỘI DUNG (xem lib/contentLang.js).
i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: vi },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = 'vi'

// Nhãn giao diện tiếng Anh KHÔNG nằm trong gói tải-lần-đầu (giao diện admin luôn
// hiển thị tiếng Việt nên en.json — ~142KB — chỉ là tải thừa). Nếu sau này cần
// hiển thị nhãn bản tiếng Anh, gọi hàm này để nạp động bundle 'en' khi đó.
let enLoadPromise = null
export function loadEnglishMessages() {
  if (!enLoadPromise) {
    enLoadPromise = import('../locales/en.json').then(({ default: en }) => {
      i18n.addResourceBundle('en', 'translation', en, true, true)
    })
  }
  return enLoadPromise
}

export default i18n
