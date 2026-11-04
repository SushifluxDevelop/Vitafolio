import { describe, expect, it } from 'vitest'
import type { BackupSchedule } from '../../api/types'
import { computeNextRuns, groupByDay, parseTime, zonedParts, zonedTimeToInstant } from './nextRuns'

const base: BackupSchedule = { kind: 'times', intervalHours: 6, times: ['02:00'], weekdays: [1, 2, 3, 4, 5, 6, 7] }
const BERLIN = 'Europe/Berlin'
// Wednesday 2026-11-04 10:30 in Berlin (UTC+1 in November).
const now = zonedTimeToInstant(2026, 11, 4, 10, 30, BERLIN)
const wall = (instant: number, zone = BERLIN) => {
  const p = zonedParts(instant, zone)
  const two = (value: number) => String(value).padStart(2, '0')
  return `${p.year}-${two(p.month)}-${two(p.day)} ${two(p.hour)}:${two(p.minute)}`
}

describe('zone arithmetic', () => {
  it('converts wall-clock time of a zone to the right instant', () => {
    expect(new Date(now).toISOString()).toBe('2026-11-04T09:30:00.000Z')
  })

  it('handles the daylight-saving change (clocks go forward on 2026-03-29 in Berlin)', () => {
    expect(new Date(zonedTimeToInstant(2026, 3, 28, 12, 0, BERLIN)).toISOString()).toBe('2026-03-28T11:00:00.000Z')
    expect(new Date(zonedTimeToInstant(2026, 3, 30, 12, 0, BERLIN)).toISOString()).toBe('2026-03-30T10:00:00.000Z')
  })

  it('parses only valid 24-hour times', () => {
    expect(parseTime('02:00')).toEqual([2, 0])
    expect(parseTime('23:59')).toEqual([23, 59])
    expect(parseTime('24:00')).toBeUndefined()
    expect(parseTime('2:00')).toBeUndefined()
    expect(parseTime('')).toBeUndefined()
  })
})

describe('interval schedule', () => {
  it('plans runs aligned to local time (6 h gives 00/06/12/18) until the end of the seventh day', () => {
    const runs = computeNextRuns({ ...base, kind: 'interval', intervalHours: 6 }, now, BERLIN)
    expect(wall(runs[0]!)).toBe('2026-11-04 12:00')
    expect(wall(runs[1]!)).toBe('2026-11-04 18:00')
    // The window ends at midnight of 2026-11-11.
    expect(wall(runs.at(-1)!)).toBe('2026-11-10 18:00')
    expect(runs).toHaveLength(2 + 6 * 4)
  })

  it('ignores the weekdays', () => {
    const all = computeNextRuns({ ...base, kind: 'interval', intervalHours: 24 }, now, BERLIN)
    const none = computeNextRuns({ ...base, kind: 'interval', intervalHours: 24, weekdays: [] }, now, BERLIN)
    expect(none).toEqual(all)
  })

  it('aligns a weekly interval (168 h) to Monday 00:00', () => {
    const runs = computeNextRuns({ ...base, kind: 'interval', intervalHours: 168 }, now, BERLIN)
    expect(runs.map((run) => wall(run))).toEqual(['2026-11-09 00:00'])
  })

  it('plans hourly runs without exceeding the window', () => {
    const runs = computeNextRuns({ ...base, kind: 'interval', intervalHours: 1 }, now, BERLIN)
    expect(runs).toHaveLength(157)
  })
})

describe('fixed times schedule', () => {
  it('plans every listed time on every day, skipping times that already passed today', () => {
    const runs = computeNextRuns({ ...base, times: ['02:00', '12:00'] }, now, BERLIN)
    expect(runs.map((run) => wall(run))).toEqual([
      '2026-11-04 12:00',
      '2026-11-05 02:00',
      '2026-11-05 12:00',
      '2026-11-06 02:00',
      '2026-11-06 12:00',
      '2026-11-07 02:00',
      '2026-11-07 12:00',
      '2026-11-08 02:00',
      '2026-11-08 12:00',
      '2026-11-09 02:00',
      '2026-11-09 12:00',
      '2026-11-10 02:00',
      '2026-11-10 12:00',
    ])
  })

  it('only uses the chosen weekdays (1 = Monday ... 7 = Sunday)', () => {
    // Wednesday 2026-11-04 is weekday 3; Monday 2026-11-09 is weekday 1.
    const early = zonedTimeToInstant(2026, 11, 4, 1, 0, BERLIN)
    const runs = computeNextRuns({ ...base, times: ['03:00'], weekdays: [1, 3] }, early, BERLIN)
    expect(runs.map((run) => wall(run))).toEqual(['2026-11-04 03:00', '2026-11-09 03:00'])
  })

  it('plans nothing without weekdays, without times, with invalid times, or when off', () => {
    expect(computeNextRuns({ ...base, weekdays: [] }, now, BERLIN)).toEqual([])
    expect(computeNextRuns({ ...base, times: [] }, now, BERLIN)).toEqual([])
    expect(computeNextRuns({ ...base, times: ['25:99', ''] }, now, BERLIN)).toEqual([])
    expect(computeNextRuns({ ...base, kind: 'off' }, now, BERLIN)).toEqual([])
  })

  it('runs a local time that daylight saving skips one hour later', () => {
    // 2026-03-29 02:30 does not exist in Berlin (02:00 jumps to 03:00).
    const before = zonedTimeToInstant(2026, 3, 28, 12, 0, BERLIN)
    const runs = computeNextRuns({ ...base, times: ['02:30'], weekdays: [7] }, before, BERLIN)
    expect(runs.map((run) => wall(run))).toEqual(['2026-03-29 03:30'])
  })

  it('counts a duplicated time once', () => {
    const runs = computeNextRuns({ ...base, times: ['02:00', '02:00'], weekdays: [4] }, now, BERLIN)
    expect(runs).toHaveLength(1)
  })

  it('uses the zone of the server, not the browser', () => {
    const tokyo = zonedTimeToInstant(2026, 11, 4, 10, 30, 'Asia/Tokyo')
    const runs = computeNextRuns({ ...base, times: ['02:00'], weekdays: [4] }, tokyo, 'Asia/Tokyo')
    expect(runs.map((run) => wall(run, 'Asia/Tokyo'))).toEqual(['2026-11-05 02:00'])
    expect(new Date(runs[0]!).toISOString()).toBe('2026-11-04T17:00:00.000Z')
  })

  it('falls back to the browser zone for an unknown zone name instead of throwing', () => {
    expect(() => computeNextRuns(base, now, 'Not/AZone')).not.toThrow()
  })
})

describe('groupByDay', () => {
  it('sorts runs into seven days with minutes since midnight', () => {
    const runs = computeNextRuns({ ...base, times: ['02:00', '12:30'] }, now, BERLIN)
    const days = groupByDay(runs, now, BERLIN)
    expect(days).toHaveLength(7)
    expect(days[0]!.minutes).toEqual([12 * 60 + 30])
    expect(days[1]!.minutes).toEqual([120, 12 * 60 + 30])
    expect(days[6]!.minutes).toEqual([120, 12 * 60 + 30])
  })
})
