import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ApiError, onSessionLost, onTwoFactorSetupRequired } from '../api/client'
import { authApi, publicApi } from '../api/endpoints'
import type { Bootstrap, User } from '../api/types'

export const BOOTSTRAP_KEY = ['bootstrap'] as const
export const ME_KEY = ['me'] as const

/** Who is signed in. `user` is null when nobody is; `twoFactorSetupRequired` when the server demands the 2FA setup first. */
export interface Session {
  user: User | null
  twoFactorSetupRequired: boolean
}

export const SIGNED_OUT: Session = { user: null, twoFactorSetupRequired: false }

/** Public facts about the instance (mode, rules, whether setup is needed), fetched once and kept. */
export function useBootstrapQuery() {
  return useQuery({ queryKey: BOOTSTRAP_KEY, queryFn: publicApi.bootstrap, staleTime: 60_000, retry: false })
}

async function loadSession(): Promise<Session> {
  try {
    const { user } = await authApi.me()
    return { user, twoFactorSetupRequired: user.mustSetupTwoFactor }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return SIGNED_OUT
      // The server answers everything except the 2FA setup with this until the setup is done.
      if (error.code === 'auth.twofactor_setup_required') return { user: null, twoFactorSetupRequired: true }
    }
    throw error
  }
}

/** The signed-in session; also reacts to the API client reporting that the session is gone for good. */
export function useSessionQuery() {
  const queryClient = useQueryClient()
  useEffect(() => onSessionLost(() => queryClient.setQueryData(ME_KEY, SIGNED_OUT)), [queryClient])
  // The session query never refetches on its own; when the server demands the 2FA setup it has to be looked at again.
  useEffect(() => onTwoFactorSetupRequired(() => void queryClient.invalidateQueries({ queryKey: ME_KEY })), [queryClient])
  return useQuery({ queryKey: ME_KEY, queryFn: loadSession, staleTime: Infinity, retry: false })
}

/** A bootstrap + session pair that is known (the guards only render routes once both are). */
export interface AppState {
  bootstrap: Bootstrap
  session: Session
}

/** Only an http(s)-free, same-app path may be a "return to" target (no open redirect). */
export function safeReturnPath(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : '/'
}
