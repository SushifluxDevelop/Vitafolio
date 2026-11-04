import { useTranslation } from 'react-i18next'
import { useCopy } from '../../hooks/useCopy'
import { Icon } from './Icon'

interface CopyButtonProps {
  /** Builds the complete text at the moment of the click. */
  getText: () => string
  className?: string
}

/**
 * "Copy" with a short "Copied" confirmation. All labels are laid over each other in one grid cell, so the button keeps
 * the width of the longest one and the confirmation moves nothing.
 */
export function CopyButton({ getText, className = '' }: CopyButtonProps) {
  const { t } = useTranslation()
  const { state, copy } = useCopy(getText)
  const label = state === 'copied' ? t('common.copied') : state === 'failed' ? t('common.copyFailed') : t('common.copy')

  return (
    <button type="button" className={`btn btn-sm btn-secondary ${className}`} onClick={() => void copy()} data-testid="copy-button">
      <Icon name={state === 'copied' ? 'check' : 'copy'} size={15} />
      <span className="grid">
        {[t('common.copy'), t('common.copied'), t('common.copyFailed')].map((text, index) => (
          <span key={index} className="invisible col-start-1 row-start-1" aria-hidden="true">
            {text}
          </span>
        ))}
        <span className="col-start-1 row-start-1" role="status">
          {label}
        </span>
      </span>
    </button>
  )
}
