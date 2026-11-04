import type { BackupSchedule } from '../../api/types'

/** The wall-clock parts of an instant in a time zone. */
interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

/** The given zone when the browser knows it, otherwise the browser's own zone (the preview must never throw). */
export function usableTimeZone(timeZone: string | undefined): string {
  if (timeZone) {
    try {
      formatterFor(timeZone)
      return timeZone
    } catch {
      // Unknown zone name: use the browser's.
    }
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function zonedParts(instant: number, timeZone: string): ZonedParts {
  const values: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') values[part.type] = Number(part.value)
  }
  return { year: values.year!, month: values.month!, day: values.day!, hour: values.hour!, minute: values.minute! }
}

/** Offset of a zone from UTC at an instant, in ms. */
function offsetAt(instant: number, timeZone: string): number {
  const p = zonedParts(instant, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000
}

/** The instant at which the wall clock of `timeZone` shows the given date and time (daylight saving handled). */
export function zonedTimeToInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute)
  const first = naive - offsetAt(naive, timeZone)
  // The offset at the first guess can differ from the offset at the real instant across a daylight-saving change.
  return naive - offsetAt(first, timeZone)
}

/** "HH:mm" (24-hour) -> [hour, minute], or undefined when it is not a valid time. */
export function parseTime(value: string): [number, number] | undefined {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  return match ? [Number(match[1]), Number(match[2])] : undefined
}

export const PREVIEW_DAYS = 7

/** The start of each of the preview's days (today first) as instants in the zone, plus the end of the last one. */
export function dayStarts(now: number, timeZone: string, days = PREVIEW_DAYS): number[] {
  const today = zonedParts(now, timeZone)
  return Array.from({ length: days + 1 }, (_unused, index) => {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + index))
    return zonedTimeToInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, timeZone)
  })
}

/**
 * The planned automatic backups from `now` to the end of the seventh day, for the live preview while the schedule is
 * edited. Rules: "interval" = every N hours counted from now (the server counts from the last run); "times" = every
 * listed time on the chosen weekdays (1 = Monday ... 7 = Sunday) in the given time zone; "off" = none. After saving, the
 * server's own list of next runs replaces this.
 */
export function computeNextRuns(schedule: BackupSchedule, now: number, timeZone: string): number[] {
  const zone = usableTimeZone(timeZone)
  const starts = dayStarts(now, zone)
  const end = starts[starts.length - 1]!

  if (schedule.kind === 'interval') {
    // Aligned to local wall-clock time, counted from Monday 2000-01-03 00:00: 6 h gives 00/06/12/18 every day, 168 h
    // every Monday 00:00. A local time that daylight saving skips runs one hour later (zonedTimeToInstant).
    const step = Math.max(1, Math.round(schedule.intervalHours)) * 3_600_000
    const anchor = Date.UTC(2000, 0, 3, 0, 0)
    const here = zonedParts(now, zone)
    const nowWall = Date.UTC(here.year, here.month - 1, here.day, here.hour, here.minute)
    const runs: number[] = []
    for (let slot = Math.floor((nowWall - anchor) / step); ; slot++) {
      const wall = new Date(anchor + slot * step)
      const at = zonedTimeToInstant(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), zone)
      if (at >= end) break
      if (at > now) runs.push(at)
    }
    return runs
  }

  if (schedule.kind === 'times') {
    const times = [...new Set(schedule.times)].map(parseTime).filter((time): time is [number, number] => time !== undefined)
    const runs: number[] = []
    for (let index = 0; index < PREVIEW_DAYS; index++) {
      const dayStart = starts[index]!
      const noon = dayStart + 12 * 3_600_000
      const parts = zonedParts(noon, zone)
      const weekday = ((new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() + 6) % 7) + 1
      if (!schedule.weekdays.includes(weekday)) continue
      for (const [hour, minute] of times) {
        const at = zonedTimeToInstant(parts.year, parts.month, parts.day, hour, minute, zone)
        if (at > now && at < end) runs.push(at)
      }
    }
    return runs.sort((a, b) => a - b)
  }

  return []
}

/** One row of the week strip: the day and the planned runs on it as minutes since midnight of that day. */
export interface PreviewDay {
  start: number
  /** Minutes since the start of the day for each run (0-1439). */
  minutes: number[]
}

/** Sorts planned runs into the preview's seven days; runs outside them are dropped. */
export function groupByDay(runs: readonly number[], now: number, timeZone: string): PreviewDay[] {
  const zone = usableTimeZone(timeZone)
  const starts = dayStarts(now, zone)
  return starts.slice(0, PREVIEW_DAYS).map((start, index) => {
    const next = starts[index + 1]!
    const minutes = runs
      .filter((run) => run >= start && run < next)
      .map((run) => {
        const parts = zonedParts(run, zone)
        return parts.hour * 60 + parts.minute
      })
    return { start, minutes }
  })
}
