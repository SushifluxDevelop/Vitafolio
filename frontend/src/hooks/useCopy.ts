import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Puts text on the clipboard. navigator.clipboard only exists in a secure context (https, localhost); the app can also be
 * opened over plain http on a home network, so a hidden text area and execCommand serve as the fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission refused: try the fallback below.
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/** A copy action with a short "copied" state for the confirmation. */
export function useCopy(getText: () => string, resetAfterMs = 1800) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(async () => {
    const ok = await copyToClipboard(getText())
    setState(ok ? 'copied' : 'failed')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), resetAfterMs)
  }, [getText, resetAfterMs])

  return { state, copy }
}
