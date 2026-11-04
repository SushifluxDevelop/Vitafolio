import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/ui/Icon'
import { MessageSlot } from '../../components/ui/MessageSlot'
import { groupByDay, usableTimeZone, zonedParts } from './nextRuns'

const HOUR_MARKS = [0, 6, 12, 18, 24]

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export type PreviewState = 'planned' | 'automaticOff' | 'scheduleOff' | 'noneInWindow'

interface WeekPreviewProps {
  runs: readonly number[]
  now: number
  timeZone: string
  state: PreviewState
  /** The draft differs from what is saved: the strip is the client-side preview, not yet the server's plan. */
  unsaved: boolean
  language: string
  /** Backups also happen at start and before shutdown (not on the strip, they have no fixed time). */
  onStart: boolean
  beforeShutdown: boolean
}

/**
 * The next seven days as a strip: one row per day with a marker for every planned backup and the exact times beside it.
 * Updates live while the schedule is edited (planned in the browser with the same rules); once saved, the server's own
 * list of runs is what is drawn. The caption line keeps its room whatever it says, so nothing moves.
 */
export function WeekPreview({ runs, now, timeZone, state, unsaved, language, onStart, beforeShutdown }: WeekPreviewProps) {
  const { t } = useTranslation()
  const zone = usableTimeZone(timeZone)
  const days = groupByDay(runs, now, zone)
  const today = zonedParts(now, zone)
  const nowMinutes = today.hour * 60 + today.minute
  const dayFormat = new Intl.DateTimeFormat(language, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: zone })
  const total = days.reduce((sum, day) => sum + day.minutes.length, 0)

  const captions: Record<PreviewState, string> = {
    planned: t('backups.preview.planned', { count: total }),
    automaticOff: t('backups.preview.automaticOff'),
    scheduleOff: t('backups.preview.scheduleOff'),
    noneInWindow: t('backups.preview.noneInWindow'),
  }

  const events = {
    both: t('backups.preview.eventsBoth'),
    start: t('backups.preview.eventsStart'),
    shutdown: t('backups.preview.eventsShutdown'),
    none: t('backups.preview.eventsNone'),
  }

  return (
    <div data-testid="week-preview">
      <div className="mb-3 flex items-start justify-between gap-4">
        <MessageSlot message={captions[state]} reserve={Object.values(captions)} />
        <span className={`badge badge-warning shrink-0 ${unsaved ? '' : 'invisible'}`} aria-hidden={!unsaved}>
          {t('backups.preview.unsaved')}
        </span>
      </div>

      <div className="grid grid-cols-[9rem_1fr_9.5rem] items-center gap-x-4 gap-y-1.5">
        <span />
        <div className="relative h-4 text-xs text-ink-muted" aria-hidden="true">
          {HOUR_MARKS.map((hour) => (
            <span
              key={hour}
              className="absolute -translate-x-1/2 tabular-nums"
              style={{ left: `${(hour / 24) * 100}%`, ...(hour === 0 ? { transform: 'none' } : hour === 24 ? { transform: 'translateX(-100%)' } : {}) }}
            >
              {String(hour).padStart(2, '0')}
            </span>
          ))}
        </div>
        <span />

        {days.map((day, index) => {
          const label = dayFormat.format(day.start + 12 * 3_600_000)
          const times = day.minutes.map(clock)
          const summary = times.length === 0 ? t('backups.preview.noRun') : times.length <= 3 ? times.join(' · ') : t('backups.preview.manyRuns', { count: times.length })
          return (
            <div key={day.start} className="contents" data-testid="preview-day">
              <span className="flex items-center gap-1.5 text-sm font-medium whitespace-nowrap tabular-nums">
                {label}
                {index === 0 && <span className="badge badge-select !px-1.5 !py-0 text-[0.6875rem]">{t('backups.preview.today')}</span>}
              </span>
              <div
                role="img"
                aria-label={`${label}: ${summary}`}
                className="relative h-7 overflow-hidden rounded-xs border border-line bg-sunken"
              >
                {HOUR_MARKS.slice(1, -1).map((hour) => (
                  <span key={hour} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${(hour / 24) * 100}%` }} />
                ))}
                {index === 0 && <span className="absolute top-0 bottom-0 w-px bg-ink-muted opacity-70" style={{ left: `${(nowMinutes / 1440) * 100}%` }} />}
                {day.minutes.map((minutes, markerIndex) => (
                  <span
                    key={`${minutes}-${markerIndex}`}
                    data-testid="preview-marker"
                    className="absolute top-1 bottom-1 w-1.5 -translate-x-1/2 rounded-xs bg-indicator"
                    style={{ left: `${(minutes / 1440) * 100}%` }}
                  />
                ))}
              </div>
              <span className={`text-[0.8125rem] whitespace-nowrap tabular-nums ${times.length === 0 ? 'text-ink-muted' : 'text-ink'}`}>{summary}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 text-ink-muted">
        <Icon name="infoCircle" size={15} className="mt-0.5 shrink-0" />
        <MessageSlot message={events[onStart ? (beforeShutdown ? 'both' : 'start') : beforeShutdown ? 'shutdown' : 'none']} reserve={Object.values(events)} />
      </div>
    </div>
  )
}
