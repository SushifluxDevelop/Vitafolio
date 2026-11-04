import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/** The action-colour categories: create = gold, confirm = blue, danger = red, secondary/ghost = neutral. */
export type ButtonVariant = 'create' | 'confirm' | 'danger' | 'danger-outline' | 'secondary' | 'ghost'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>
  variant?: ButtonVariant
  small?: boolean
  icon?: IconName
  /** Shows a spinner over the label; the label stays (invisible) so the button keeps its size. */
  busy?: boolean
  children: ReactNode
}

/**
 * The one button. Every action of the same meaning uses the same variant on every page: "+ New" is `create`, "Save" and
 * "Continue" are `confirm`, destructive actions are `danger`. A busy button never changes size.
 */
export function Button({ variant = 'secondary', small = false, icon, busy = false, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`btn btn-${variant} ${small ? 'btn-sm' : ''} relative ${className}`}
      {...rest}
    >
      <span className={`inline-flex items-center gap-2 ${busy ? 'invisible' : ''}`}>
        {icon && <Icon name={icon} size={small ? 15 : 17} />}
        {children}
      </span>
      {busy && <Icon name="loader" size={18} className="absolute animate-spin" />}
    </button>
  )
}
