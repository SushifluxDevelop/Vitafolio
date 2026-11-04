import { useQueryClient } from '@tanstack/react-query'
import { accountApi } from '../api/endpoints'
import type { LanguageCode, ThemePreference } from '../api/types'
import { useAppState } from '../auth/AppState'
import { ME_KEY } from '../auth/useAuth'
import type { Session } from '../auth/useAuth'
import { applyLanguage } from '../i18n'
import { useTheme } from './ThemeProvider'

/**
 * Theme and language changes: applied immediately and kept in this browser; when somebody is signed in the choice is
 * also saved to the account. The account copy is best effort - the local copy already works, so a failed save is not
 * worth interrupting the user for.
 */
export function useAppearance() {
  const theme = useTheme()
  const { session } = useAppState()
  const queryClient = useQueryClient()
  const signedIn = session.user !== null

  const remember = (patch: Partial<{ theme: ThemePreference; language: LanguageCode }>) => {
    queryClient.setQueryData<Session>(ME_KEY, (current) =>
      current?.user ? { ...current, user: { ...current.user, ...patch } } : current,
    )
    if (signedIn) accountApi.savePreferences(patch).catch(() => undefined)
  }

  return {
    preference: theme.preference,
    resolved: theme.resolved,
    setTheme(preference: ThemePreference) {
      theme.setPreference(preference)
      remember({ theme: preference })
    },
    async setLanguage(language: LanguageCode) {
      await applyLanguage(language)
      remember({ language })
    },
  }
}
