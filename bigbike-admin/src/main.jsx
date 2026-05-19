import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

// Design-system fonts — self-hosted so --admin-font-body (Inter) and
// --admin-font-display (Bungee) resolve to real fonts, not the Exo fallback.
// Inter weights match the design source (400/500/600/700/800); Bungee ships
// the vietnamese subset the admin UI needs for full diacritics.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/bungee/latin.css'
import '@fontsource/bungee/latin-ext.css'
import '@fontsource/bungee/vietnamese.css'

import './index.css'
import './lib/i18n'
import { queryClient } from './lib/queryClient'
import { ThemeProvider, useTheme } from './lib/theme'
import App from './App.jsx'

// eslint-disable-next-line react-refresh/only-export-components
function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '0.875rem',
        },
        classNames: {
          success: 'toast-success',
          error: 'toast-error',
        },
      }}
      richColors
      closeButton
    />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
