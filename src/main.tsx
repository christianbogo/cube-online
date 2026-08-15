import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ThemeProvider } from './components/ThemeProvider'
import { setSearchDebug } from 'cubing/search'

setSearchDebug({
  showWorkerInstantiationWarnings: false,
  prioritizeEsbuildWorkaroundForWorkerInstantiation: true,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="cutter-cubing-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
