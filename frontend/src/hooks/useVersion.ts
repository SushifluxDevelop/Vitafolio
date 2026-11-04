import { useQuery } from '@tanstack/react-query'
import { publicApi } from '../api/endpoints'

export const VERSION_KEY = ['version'] as const

/** The running version, fetched once (it only changes with a new build, which reloads the page anyway). */
export function useVersion() {
  return useQuery({
    queryKey: VERSION_KEY,
    queryFn: publicApi.version,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
}
