import { useState } from 'react'
import { Icon } from '../../components/ui/Icon'
import { Button } from '../../components/ui/Button'
import { useGapAnalyzer } from './useGapAnalyzer'
import type { Profile } from '../../api/types'

interface GapAnalyzerCardProps {
  profile: Profile
  onQuickAdd?: (gapStart: string, gapEnd: string, suggestedTitle: string) => void
}

export function GapAnalyzerCard({ profile, onQuickAdd }: GapAnalyzerCardProps) {
  const analysis = useGapAnalyzer(profile)
  const [expanded, setExpanded] = useState(false)

  if (!analysis.hasGaps && !analysis.isContinuous) {
    return null
  }

  if (analysis.isContinuous) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center justify-between text-xs text-ink mb-4">
        <div className="flex items-center gap-2">
          <Icon name="circleCheck" className="h-4 w-4 text-success flex-shrink-0" />
          <span className="font-medium text-success-strong">
            Lücken-Check bestanden: Ihr Werdegang ist lückenlos dokumentiert.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3.5 text-xs text-ink mb-4 space-y-2">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2 font-medium text-warning-strong">
          <Icon name="alertTriangle" className="h-4 w-4 text-warning flex-shrink-0" />
          <span>
            Lücken-Analyse:{' '}
            <strong>
              {analysis.totalGapsCount} {analysis.totalGapsCount === 1 ? 'Lücke' : 'Lücken'}
            </strong>{' '}
            im zeitlichen Ablauf gefunden.
          </span>
        </div>
        <button
          type="button"
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          {expanded ? 'Details verbergen' : 'Details & Tipps anzeigen'}
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="pt-2 border-t border-warning/20 space-y-3">
          <p className="text-ink-muted">
            Personaler achten im Lebenslauf auf zeitliche Kontinuität. Ab etwa 1–2 Monaten Unterbrechung
            empfiehlt sich eine kurze, transparente Angabe, um Nachfragen im Vorstellungsgespräch souverän zu begegnen.
          </p>

          <div className="space-y-2">
            {analysis.gaps.map((gap) => (
              <div
                key={gap.id}
                className="p-2.5 rounded bg-canvas border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-ink">
                    {gap.startFormatted} – {gap.endFormatted} ({gap.durationMonths}{' '}
                    {gap.durationMonths === 1 ? 'Monat' : 'Monate'})
                  </span>
                  <div className="text-ink-muted text-[11px] mt-0.5">
                    Zwischen: <span className="text-ink">{gap.previousTitle}</span> ➔{' '}
                    <span className="text-ink">{gap.nextTitle}</span>
                  </div>
                </div>

                {onQuickAdd && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      small
                      variant="secondary"
                      onClick={() => onQuickAdd(gap.startFormatted, gap.endFormatted, 'Berufliche Neuorientierung')}
                    >
                      + Neuorientierung
                    </Button>
                    <Button
                      small
                      variant="secondary"
                      onClick={() => onQuickAdd(gap.startFormatted, gap.endFormatted, 'Weiterbildung & Qualifizierung')}
                    >
                      + Weiterbildung
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
