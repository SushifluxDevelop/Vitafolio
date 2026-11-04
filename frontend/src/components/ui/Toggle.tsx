import { useId } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: ReactNode
  disabled?: boolean
}

/**
 * The one on/off switch: green and checkmarked when on, red and crossed when off (own tokens, so the state never
 * depends on colour alone and never reads as grey-on-grey). The state is also spelled out as text next to it.
 */
export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
  const { t } = useTranslation()
  const labelId = useId()
  const descriptionId = useId()

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div id={labelId} className="font-medium text-ink">
          {label}
        </div>
        {description && (
          <p id={descriptionId} className="mt-0.5 text-sm text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className={`w-8 text-right text-sm font-semibold ${checked ? 'text-success-soft-ink' : 'text-danger'}`}>
          {checked ? t('common.on') : t('common.off')}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={description ? descriptionId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-sm transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${checked ? 'bg-toggle-on' : 'bg-toggle-off'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-xs bg-toggle-knob transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
          >
            <Icon name={checked ? 'check' : 'x'} size={14} className={checked ? 'text-toggle-on' : 'text-toggle-off'} />
          </span>
        </button>
      </div>
    </div>
  )
}
