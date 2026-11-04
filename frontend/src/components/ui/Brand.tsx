import { useTranslation } from 'react-i18next'
import { branding } from '../../branding'
import { useVersion } from '../../hooks/useVersion'

/** The logo: always the icon with its blue plate, never recoloured, the same on light and dark. */
export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <img src={branding.logo} alt={branding.name} width={size} height={size} className={className} draggable={false} />
}

/**
 * The wordmark. On a light surface the light-background file, on a dark one the dark-background file; in the app the
 * theme decides (both are in the page, CSS shows one), on a fixed dark panel pass `onDark`.
 */
export function Wordmark({ height = 28, onDark = false, className = '' }: { height?: number; onDark?: boolean; className?: string }) {
  // Aspect ratio of the artwork: 384.4 x 78.4.
  const width = Math.round((height * 384.4) / 78.4)
  if (onDark) return <img src={branding.wordmarkDark} alt={branding.name} width={width} height={height} className={className} draggable={false} />
  return (
    <>
      <img src={branding.wordmark} alt={branding.name} width={width} height={height} className={`dark:hidden ${className}`} draggable={false} />
      <img src={branding.wordmarkDark} alt={branding.name} width={width} height={height} className={`hidden dark:block ${className}`} draggable={false} />
    </>
  )
}

/**
 * "Mit ♥ gemacht" (German) / "Made with ♥" (English and every other language). The heart is always green, never red,
 * and no location is named.
 */
export function MadeWith({ onDark = false }: { onDark?: boolean }) {
  const { i18n } = useTranslation()
  const german = i18n.language.toLowerCase().startsWith('de')
  const heart = (
    <span aria-label={german ? 'Herz' : 'love'} role="img" className={onDark ? 'text-[#4ade80]' : 'text-heart'}>
      ♥
    </span>
  )
  // One element (not a fragment) so that a flex column does not put every word on its own line.
  return <span className="whitespace-nowrap">{german ? <>Mit {heart} gemacht</> : <>Made with {heart}</>}</span>
}

/** The running version, readable form as the server delivers it; shows nothing until (or unless) it is known. */
export function VersionLabel({ className = '' }: { className?: string }) {
  const { data } = useVersion()
  if (!data) return <span className={`inline-block h-[1.25em] ${className}`} aria-hidden="true" />
  return (
    <span className={className} data-testid="version">
      {data.version || data.short}
    </span>
  )
}
