import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { Toaster } from 'sonner'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '../../src/index.css'
import App from '../../src/App.jsx'
import { queryClient } from '../../src/lib/queryClient'
import { ThemeProvider } from '../../src/lib/theme'
import vi from '../../src/locales/vi.json'
import en from '../../src/locales/en.json'

// Chỉ entry kiểm thử dùng nhãn Anh. App, API và dữ liệu vẫn là các nguồn thật.
const testI18n = createInstance()
await testI18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
})

window.setMediaSidebarTestLanguage = async (language) => {
  await testI18n.changeLanguage(language)
  document.documentElement.lang = language
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={testI18n}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
          <Toaster position="top-right" />
        </QueryClientProvider>
      </ThemeProvider>
    </I18nextProvider>
  </StrictMode>,
)
