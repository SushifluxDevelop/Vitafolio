import { describe, expect, it } from 'vitest'
import type { BackupSettings } from '../../api/types'
import { isDirty, nextTimeProposal, previewSchedule, problemsOf, toDraft, toSettings } from './scheduleModel'

const saved: BackupSettings = {
  automaticEnabled: true,
  onStart: true,
  beforeShutdown: true,
  schedule: { kind: 'times', intervalHours: 6, times: ['02:00', '14:00'], weekdays: [1, 2, 3, 4, 5, 6, 7] },
  catchUpMissed: true,
  keepRecent: 20,
  keepDailyDays: 60,
}

describe('draft of the backup settings', () => {
  it('round-trips the saved settings unchanged', () => {
    expect(toSettings(toDraft(saved), saved)).toEqual(saved)
    expect(isDirty(toDraft(saved), saved)).toBe(false)
  })

  it('is dirty after any change, also a toggled master switch', () => {
    expect(isDirty({ ...toDraft(saved), automaticEnabled: false }, saved)).toBe(true)
    expect(isDirty({ ...toDraft(saved), keepRecent: '21' }, saved)).toBe(true)
  })

  it('reports numbers outside the limits while they are typed', () => {
    expect(problemsOf({ ...toDraft(saved), keepRecent: '4' }).keepRecent).toBe(true)
    expect(problemsOf({ ...toDraft(saved), keepRecent: '501' }).keepRecent).toBe(true)
    expect(problemsOf({ ...toDraft(saved), keepDailyDays: '' }).keepDailyDays).toBe(true)
    expect(problemsOf({ ...toDraft(saved), keepDailyDays: '0' }).keepDailyDays).toBeUndefined()
    expect(problemsOf({ ...toDraft(saved), kind: 'interval', intervalHours: '169' }).intervalHours).toBe(true)
    expect(problemsOf({ ...toDraft(saved), kind: 'interval', intervalHours: '1.5' }).intervalHours).toBe(true)
  })

  it('needs times and weekdays only for the fixed-times kind', () => {
    expect(problemsOf({ ...toDraft(saved), times: [] }).times).toBe('none')
    expect(problemsOf({ ...toDraft(saved), times: ['02:00', '02:00'] }).times).toBe('duplicate')
    expect(problemsOf({ ...toDraft(saved), times: ['26:00'] }).times).toBe('invalid')
    expect(problemsOf({ ...toDraft(saved), weekdays: [] }).weekdays).toBe(true)
    expect(problemsOf({ ...toDraft(saved), kind: 'interval', times: [], weekdays: [] })).toEqual({})
  })

  it('refuses to produce settings while there are problems, and sorts times and weekdays when it does', () => {
    expect(toSettings({ ...toDraft(saved), keepRecent: 'x' }, saved)).toBeUndefined()
    const sorted = toSettings({ ...toDraft(saved), times: ['14:00', '02:00'], weekdays: [7, 1] }, saved)
    expect(sorted?.schedule.times).toEqual(['02:00', '14:00'])
    expect(sorted?.schedule.weekdays).toEqual([1, 7])
  })

  it('plans nothing in the preview when the master switch is off or the interval is unfinished', () => {
    expect(previewSchedule({ ...toDraft(saved), automaticEnabled: false }, saved.schedule).kind).toBe('off')
    expect(previewSchedule({ ...toDraft(saved), kind: 'interval', intervalHours: '' }, saved.schedule).kind).toBe('off')
    expect(previewSchedule({ ...toDraft(saved), kind: 'interval', intervalHours: '12' }, saved.schedule)).toMatchObject({ kind: 'interval', intervalHours: 12 })
  })

  it('proposes a time that is not in the list yet', () => {
    expect(nextTimeProposal([])).toBe('02:00')
    expect(nextTimeProposal(['02:00'])).toBe('08:00')
    expect(nextTimeProposal(['02:00', '08:00'])).toBe('14:00')
  })
})
