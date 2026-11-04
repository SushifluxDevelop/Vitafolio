import { Icon } from './Icon'
import type { IconName } from './Icon'

interface Option<T extends string> {
  value: T
  label: string
  icon?: IconName
}

interface SegmentedProps<T extends string> {
  options: readonly Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  /** Icons only (the label stays as the accessible name and tooltip), segments share the full width. */
  compact?: boolean
  disabled?: boolean
}

/** A short single-choice control (theme, language); the chosen segment is the "selection" category, like the tabs. */
export function Segmented<T extends string>({ options, value, onChange, label, compact = false, disabled = false }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`rounded-sm border border-line-strong bg-surface p-0.5 ${compact ? 'flex' : 'inline-flex'}`}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={compact ? option.label : undefined}
            title={compact ? option.label : undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex min-h-8 items-center justify-center gap-2 rounded-xs px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${compact ? 'flex-1' : ''} ${
              selected ? 'bg-select text-select-ink shadow-[inset_0_-2px_0_var(--indicator)]' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {option.icon && <Icon name={option.icon} size={16} />}
            {!compact && option.label}
          </button>
        )
      })}
    </div>
  )
}
