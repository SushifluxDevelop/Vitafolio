import { useTranslation } from 'react-i18next'
import type { ScheduleKind } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Icon } from '../../components/ui/Icon'
import { LiveTextField } from '../../components/ui/LiveTextField'
import { MessageSlot } from '../../components/ui/MessageSlot'
import { Segmented } from '../../components/ui/Segmented'
import { Toggle } from '../../components/ui/Toggle'
import { integerCheck } from '../../validation/rules'
import { TimeField } from './TimeField'
import { ALL_WEEKDAYS, LIMITS, nextTimeProposal, problemsOf } from './scheduleModel'
import type { Draft } from './scheduleModel'

interface ScheduleFormProps {
  draft: Draft
  onChange: (draft: Draft) => void
  /** A save was tried: every problem is shown, also in fields nobody touched. */
  attempted: boolean
}

/**
 * The schedule module: the master switch on top (everything below stays visible but disabled while it is off, so nothing
 * jumps), the two event toggles, the schedule kind with its settings, catching up missed backups and the retention.
 */
export function ScheduleForm({ draft, onChange, attempted }: ScheduleFormProps) {
  const { t } = useTranslation()
  const off = !draft.automaticEnabled
  const problems = problemsOf(draft)
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })

  const kinds: { value: ScheduleKind; label: string }[] = [
    { value: 'off', label: t('backups.schedule.kindOff') },
    { value: 'interval', label: t('backups.schedule.kindInterval') },
    { value: 'times', label: t('backups.schedule.kindTimes') },
  ]

  const timeProblems = {
    none: t('backups.schedule.problem.noTimes'),
    duplicate: t('backups.schedule.problem.duplicateTime'),
    invalid: t('backups.schedule.problem.invalidTime'),
    weekdays: t('backups.schedule.problem.noWeekdays'),
  }
  const shownTimeProblem = draft.kind === 'times' && (problems.times || problems.weekdays) ? (problems.times ? timeProblems[problems.times] : timeProblems.weekdays) : undefined

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-line-strong bg-surface-2 p-5">
        <Toggle
          checked={draft.automaticEnabled}
          onChange={(value) => set({ automaticEnabled: value })}
          label={t('backups.schedule.master')}
          description={t('backups.schedule.masterHint')}
        />
      </div>

      <fieldset disabled={off} className={`m-0 flex min-w-0 flex-col gap-6 border-0 p-0 transition-opacity ${off ? 'opacity-55' : ''}`} aria-label={t('backups.schedule.settingsLabel')}>
        <div className="flex flex-col gap-4">
          <Toggle checked={draft.onStart} onChange={(value) => set({ onStart: value })} label={t('backups.schedule.onStart')} description={t('backups.schedule.onStartHint')} disabled={off} />
          <Toggle
            checked={draft.beforeShutdown}
            onChange={(value) => set({ beforeShutdown: value })}
            label={t('backups.schedule.beforeShutdown')}
            description={t('backups.schedule.beforeShutdownHint')}
            disabled={off}
          />
        </div>

        <div>
          <p className="mb-2 font-medium">{t('backups.schedule.title')}</p>
          <Segmented label={t('backups.schedule.title')} value={draft.kind} onChange={(kind) => set({ kind })} options={kinds} disabled={off} />

          {draft.kind === 'interval' && (
            <div className="mt-4 max-w-xs">
              <LiveTextField
                label={t('backups.schedule.intervalLabel')}
                name="intervalHours"
                inputMode="numeric"
                maxLength={3}
                inputClassName="max-w-28 tabular-nums"
                value={draft.intervalHours}
                onValueChange={(value) => set({ intervalHours: value })}
                check={integerCheck('backups.schedule.problem.interval', LIMITS.intervalHours.min, LIMITS.intervalHours.max)}
                attempted={attempted}
                hint={t('backups.schedule.intervalHint')}
                disabled={off}
              />
            </div>
          )}

          {draft.kind === 'times' && (
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('backups.schedule.weekdays')}</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('backups.schedule.weekdays')}>
                  {ALL_WEEKDAYS.map((day) => {
                    const selected = draft.weekdays.includes(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        disabled={off}
                        data-testid={`weekday-${day}`}
                        onClick={() => set({ weekdays: selected ? draft.weekdays.filter((value) => value !== day) : [...draft.weekdays, day] })}
                        className={`flex h-9 w-11 items-center justify-center rounded-sm border text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                          selected ? 'border-indicator bg-select text-select-ink' : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        {t(`backups.weekdays.${day}`)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">{t('backups.schedule.times')}</p>
                <ul className="flex flex-col gap-2">
                  {draft.times.map((time, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <TimeField
                        label={t('backups.schedule.timeN', { n: index + 1 })}
                        invalid={attempted && Boolean(problems.times)}
                        value={time}
                        disabled={off}
                        onChange={(value) => set({ times: draft.times.map((item, position) => (position === index ? value : item)) })}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={t('backups.schedule.removeTime', { time })}
                        disabled={off}
                        onClick={() => set({ times: draft.times.filter((_value, position) => position !== index) })}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    variant="create"
                    small
                    icon="plus"
                    disabled={off || draft.times.length >= LIMITS.maxTimes}
                    onClick={() => set({ times: [...draft.times, nextTimeProposal(draft.times)] })}
                    data-testid="add-time"
                  >
                    {t('backups.schedule.addTime')}
                  </Button>
                  <span className="text-[0.8125rem] text-ink-muted">{t('backups.schedule.maxTimes', { max: LIMITS.maxTimes })}</span>
                </div>
                <div className="mt-2">
                  <MessageSlot message={shownTimeProblem} danger reserve={Object.values(timeProblems)} />
                </div>
              </div>
            </div>
          )}
        </div>

        <Toggle
          checked={draft.catchUpMissed}
          onChange={(value) => set({ catchUpMissed: value })}
          label={t('backups.schedule.catchUp')}
          description={t('backups.schedule.catchUpHint')}
          disabled={off}
        />

      </fieldset>

      <div>
        <p className="mb-2 font-medium">{t('backups.retention.title')}</p>
        <div className="grid max-w-xl grid-cols-2 gap-4">
          <LiveTextField
            label={t('backups.retention.recent')}
            name="keepRecent"
            inputMode="numeric"
            maxLength={3}
            inputClassName="max-w-28 tabular-nums"
            value={draft.keepRecent}
            onValueChange={(value) => set({ keepRecent: value })}
            check={integerCheck('backups.retention.problemRecent', LIMITS.keepRecent.min, LIMITS.keepRecent.max)}
            attempted={attempted}
            hint={t('backups.retention.recentHint', LIMITS.keepRecent)}
          />
          <LiveTextField
            label={t('backups.retention.daily')}
            name="keepDailyDays"
            inputMode="numeric"
            maxLength={4}
            inputClassName="max-w-28 tabular-nums"
            value={draft.keepDailyDays}
            onValueChange={(value) => set({ keepDailyDays: value })}
            check={integerCheck('backups.retention.problemDaily', LIMITS.keepDailyDays.min, LIMITS.keepDailyDays.max)}
            attempted={attempted}
            hint={t('backups.retention.dailyHint', LIMITS.keepDailyDays)}
          />
        </div>
      </div>
    </div>
  )
}
