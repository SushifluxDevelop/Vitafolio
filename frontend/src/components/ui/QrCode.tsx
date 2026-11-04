import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** The module matrix of a QR code for `text` (true = dark), error correction level M. */
export function qrMatrix(text: string): boolean[][] {
  const code = qrcode(0, 'M')
  code.addData(text)
  code.make()
  const size = code.getModuleCount()
  return Array.from({ length: size }, (_row, y) => Array.from({ length: size }, (_cell, x) => code.isDark(y, x)))
}

/**
 * A QR code drawn as one SVG path. Always dark on a white plate with the quiet zone the standard asks for, in both
 * themes - scanners need that contrast, so it is deliberately not themed.
 */
export function QrCode({ text, size = 176, label }: { text: string; size?: number; label: string }) {
  const { path, modules } = useMemo(() => {
    const matrix = qrMatrix(text)
    const commands: string[] = []
    matrix.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) commands.push(`M${x} ${y}h1v1h-1z`)
      }),
    )
    return { path: commands.join(''), modules: matrix.length }
  }, [text])
  const quiet = 4

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${modules + quiet * 2} ${modules + quiet * 2}`}
      shapeRendering="crispEdges"
      className="rounded-sm border border-line"
    >
      <rect x={-quiet} y={-quiet} width={modules + quiet * 2} height={modules + quiet * 2} fill="#ffffff" />
      <path d={path} fill="#14213d" />
    </svg>
  )
}
