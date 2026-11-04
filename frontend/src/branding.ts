import brand from '../../branding.json'
import logoUrl from '../../branding/logo.svg?url'
import wordmarkUrl from '../../branding/wordmark.svg?url'
import wordmarkDarkUrl from '../../branding/wordmark-dark.svg?url'

/**
 * The one place the app reads its identity from: the name from branding.json, the logo and the two wordmark variants
 * from the brand folder. Nothing else in the code types the product name or copies a brand file.
 */
export const branding = {
  name: brand.name,
  logo: logoUrl,
  /** For a light background. */
  wordmark: wordmarkUrl,
  /** For a dark background. */
  wordmarkDark: wordmarkDarkUrl,
} as const
