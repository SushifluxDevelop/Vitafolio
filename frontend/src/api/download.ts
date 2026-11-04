import { apiResponse } from './client'

/** The file name a "Content-Disposition" header proposes (RFC 6266: "filename*" wins over "filename"), or undefined. */
export function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (extended?.[1]) {
    try {
      return decodeURIComponent(extended[1].trim())
    } catch {
      // A malformed escape: fall through to the plain name.
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header)
  return plain?.[1]?.trim()
}

/** Strips anything that could act as a path from a proposed name; the browser saves into its own download folder anyway. */
export function safeFilename(name: string | undefined, fallback: string): string {
  const cleaned = [...(name ?? '')]
    .map((char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? '_' : char))
    .join('')
    .trim()
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? fallback : cleaned
}

/** POSTs to a download endpoint and hands the file to the browser's own download (the answer is a file stream). */
export async function downloadPost(path: string, body: unknown, fallbackName: string): Promise<string> {
  const response = await apiResponse('POST', path, body)
  const name = safeFilename(filenameFromDisposition(response.headers.get('Content-Disposition')), fallbackName)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked a little later: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return name
}
