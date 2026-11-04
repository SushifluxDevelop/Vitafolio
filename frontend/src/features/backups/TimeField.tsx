import { useTranslation } from 'react-i18next'
import { parseTime } from './nextRuns'

const HOURS = Array.from({ length: 24 }, (_unused, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_unused, minute) => String(minute).padStart(2, '0'))

interface TimeFieldProps {
  /** "HH:mm" in 24-hour form. */
  value: string
  onChange: (value: string) => void
  /** Accessible name of the whole time ("Time 1"). */
  label: string
  disabled?: boolean
  invalid?: boolean
}

/**
 * A 24-hour time of day as two selects. The browser's own time input follows the system locale and shows AM/PM in some of
 * them; the schedule is always 24-hour, so it is drawn here.
 */
export function TimeField({ value, onChange, label, disabled = false, invalid = false }: TimeFieldProps) {
  const { t } = useTranslation()
  const parsed = parseTime(value)
  const [hour, minute] = parsed ? [HOURS[parsed[0]]!, MINUTES[parsed[1]]!] : ['', '']
  const select = 'input w-[4.5rem] px-2 tabular-nums'

  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <select
        className={select}
        aria-label={`${label}: ${t('backups.schedule.hour')}`}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={hour}
        onChange={(event) => onChange(`${event.target.value}:${minute || '00'}`)}
      >
        {hour === '' && <option value="" />}
        {HOURS.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <span aria-hidden="true" className="text-ink-muted">
        :
      </span>
      <select
        className={select}
        aria-label={`${label}: ${t('backups.schedule.minute')}`}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={minute}
        onChange={(event) => onChange(`${hour || '00'}:${event.target.value}`)}
      >
        {minute === '' && <option value="" />}
        {MINUTES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </div>
  )
}
