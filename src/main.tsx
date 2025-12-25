import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ThemeProvider } from './components/ThemeProvider'
import { SettingsProvider } from './contexts/SettingsContext'
import { SolvesProvider } from './contexts/SolvesContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark" storageKey="cutter-cubing-theme">
      <SettingsProvider>
        <SolvesProvider>
          <App />
        </SolvesProvider>
      </SettingsProvider>
    </ThemeProvider>
  </StrictMode>,
)
