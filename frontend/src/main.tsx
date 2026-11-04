import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import './i18n'
import './styles/index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { ErrorDialogProvider } from './components/ui/ErrorDialog'
import { router } from './router'
import { ThemeProvider } from './theme/ThemeProvider'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root is missing in index.html.')

// The error boundary sits outside everything else so it still renders when a provider itself crashes.
createRoot(root).render(
  <ErrorBoundary>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ConfirmProvider>
            <ErrorDialogProvider>
              <RouterProvider router={router} />
            </ErrorDialogProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  </ErrorBoundary>,
)
