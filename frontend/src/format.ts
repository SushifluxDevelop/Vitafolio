/** Date, time and size formatting in the active interface language. */

export function formatDateTime(iso: string | null | undefined, language: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatDate(iso: string | null | undefined, language: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(date)
}

export function formatBytes(bytes: number, language: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = new Intl.NumberFormat(language, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)
  return `${text} ${units[unit]}`
}

/** "Chrome · Windows" from a user-agent string; the raw text when nothing is recognised. */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return '-'
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : undefined
  const system = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : undefined
  const parts = [browser, system].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : userAgent
}
