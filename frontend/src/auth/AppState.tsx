import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { AppState } from './useAuth'

const AppStateContext = createContext<AppState | null>(null)

/** Provides the resolved bootstrap data and session to everything below the app gate. */
export function AppStateProvider({ value, children }: { value: AppState; children: ReactNode }) {
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (!state) throw new Error('useAppState needs the app gate above it')
  return state
}

/** The signed-in user; only for routes behind the sign-in guard. */
export function useUser() {
  const { session } = useAppState()
  if (!session.user) throw new Error('useUser is only available behind the sign-in guard')
  return session.user
}
