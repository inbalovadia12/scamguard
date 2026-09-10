import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { ThemeProvider } from '@/components/ThemeProvider'
import AppErrorBoundary from '@/components/AppErrorBoundary'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)