import type { BackupSchedule, BackupSettings, ScheduleKind } from '../../api/types'
import { parseTime } from './nextRuns'

/** The limits of the backup settings (the same the server enforces). */
export const LIMITS = {
  intervalHours: { min: 1, max: 168 },
  keepRecent: { min: 5, max: 500 },
  keepDailyDays: { min: 0, max: 3650 },
  maxTimes: 12,
} as const

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** The form's working copy: numbers are text while they are being typed, so a half-typed value is never lost. */
export interface Draft {
  automaticEnabled: boolean
  onStart: boolean
  beforeShutdown: boolean
  kind: ScheduleKind
  intervalHours: string
  times: string[]
  weekdays: number[]
  catchUpMissed: boolean
  keepRecent: string
  keepDailyDays: string
}

export function toDraft(settings: BackupSettings): Draft {
  return {
    automaticEnabled: settings.automaticEnabled,
    onStart: settings.onStart,
    beforeShutdown: settings.beforeShutdown,
    kind: settings.schedule.kind,
    intervalHours: String(settings.schedule.intervalHours),
    times: [...settings.schedule.times],
    weekdays: [...settings.schedule.weekdays],
    catchUpMissed: settings.catchUpMissed,
    keepRecent: String(settings.keepRecent),
    keepDailyDays: String(settings.keepDailyDays),
  }
}

function integerIn(text: string, min: number, max: number): number | undefined {
  const number = Number(text)
  return text.trim() !== '' && Number.isInteger(number) && number >= min && number <= max ? number : undefined
}

/** What is wrong with the draft, as message keys per place; empty when it can be saved. */
export interface DraftProblems {
  intervalHours?: true
  times?: 'none' | 'duplicate' | 'invalid'
  weekdays?: true
  keepRecent?: true
  keepDailyDays?: true
}

export function problemsOf(draft: Draft): DraftProblems {
  const problems: DraftProblems = {}
  if (draft.kind === 'interval' && integerIn(draft.intervalHours, LIMITS.intervalHours.min, LIMITS.intervalHours.max) === undefined) problems.intervalHours = true
  if (draft.kind === 'times') {
    if (draft.times.length === 0) problems.times = 'none'
    else if (draft.times.some((time) => parseTime(time) === undefined)) problems.times = 'invalid'
    else if (new Set(draft.times).size !== draft.times.length) problems.times = 'duplicate'
    if (draft.weekdays.length === 0) problems.weekdays = true
  }
  if (integerIn(draft.keepRecent, LIMITS.keepRecent.min, LIMITS.keepRecent.max) === undefined) problems.keepRecent = true
  if (integerIn(draft.keepDailyDays, LIMITS.keepDailyDays.min, LIMITS.keepDailyDays.max) === undefined) problems.keepDailyDays = true
  return problems
}

/**
 * The settings to send, or undefined while the draft has problems. Times are sorted, weekdays too; the interval and the
 * times are kept even while the other kind is chosen, so switching the kind back and forth loses nothing.
 */
export function toSettings(draft: Draft, fallback: BackupSettings): BackupSettings | undefined {
  if (Object.keys(problemsOf(draft)).length > 0) return undefined
  const schedule: BackupSchedule = {
    kind: draft.kind,
    intervalHours: integerIn(draft.intervalHours, LIMITS.intervalHours.min, LIMITS.intervalHours.max) ?? fallback.schedule.intervalHours,
    times: [...draft.times].sort(),
    weekdays: [...draft.weekdays].sort((a, b) => a - b),
  }
  return {
    automaticEnabled: draft.automaticEnabled,
    onStart: draft.onStart,
    beforeShutdown: draft.beforeShutdown,
    schedule,
    catchUpMissed: draft.catchUpMissed,
    keepRecent: Number(draft.keepRecent),
    keepDailyDays: Number(draft.keepDailyDays),
  }
}

/** The schedule as the preview should plan it right now (an unfinished number plans nothing instead of guessing). */
export function previewSchedule(draft: Draft, saved: BackupSchedule): BackupSchedule {
  const interval = integerIn(draft.intervalHours, LIMITS.intervalHours.min, LIMITS.intervalHours.max)
  if (!draft.automaticEnabled) return { ...saved, kind: 'off' }
  if (draft.kind === 'interval' && interval === undefined) return { ...saved, kind: 'off' }
  return { kind: draft.kind, intervalHours: interval ?? saved.intervalHours, times: draft.times, weekdays: draft.weekdays }
}

/** True when the draft differs from what is saved (or cannot even be turned into settings). */
export function isDirty(draft: Draft, saved: BackupSettings): boolean {
  const next = toSettings(draft, saved)
  if (!next) return true
  return JSON.stringify(normalize(next)) !== JSON.stringify(normalize(saved))
}

/** Only the settings themselves, in a fixed order (the server's answer also carries next runs, zone and folder). */
function normalize(settings: BackupSettings): BackupSettings {
  return {
    automaticEnabled: settings.automaticEnabled,
    onStart: settings.onStart,
    beforeShutdown: settings.beforeShutdown,
    schedule: {
      kind: settings.schedule.kind,
      intervalHours: settings.schedule.intervalHours,
      times: [...settings.schedule.times].sort(),
      weekdays: [...settings.schedule.weekdays].sort((a, b) => a - b),
    },
    catchUpMissed: settings.catchUpMissed,
    keepRecent: settings.keepRecent,
    keepDailyDays: settings.keepDailyDays,
  }
}

/** The next free time proposal for a new entry in the list (02:00, then hourly after the last one). */
export function nextTimeProposal(times: readonly string[]): string {
  if (times.length === 0) return '02:00'
  const last = [...times].sort().at(-1)!
  const parsed = parseTime(last)
  const hour = parsed ? (parsed[0] + 6) % 24 : 2
  const candidate = `${String(hour).padStart(2, '0')}:${String(parsed?.[1] ?? 0).padStart(2, '0')}`
  return times.includes(candidate) ? '12:00' : candidate
}
