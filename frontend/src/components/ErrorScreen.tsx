import { motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { Wordmark } from './ui/Brand'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import type { IconName } from './ui/Icon'
import { ErrorNotice } from './ui/Notice'

export type ErrorKind = '401' | '403' | '404' | '429' | '500' | '503'

const ICONS: Record<ErrorKind, IconName> = {
  '401': 'lock',
  '403': 'shieldLock',
  '404': 'fileText',
  '429': 'clock',
  '500': 'alertTriangle',
  '503': 'refresh',
}

export function errorKindOf(error: unknown): ErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 401) return '401'
    if (error.status === 403) return '403'
    if (error.status === 404) return '404'
    if (error.status === 429) return '429'
    if (error.status === 503 || error.status === 0 || error.status === 502 || error.status === 504) return '503'
  }
  return '500'
}

interface ErrorScreenProps {
  kind: ErrorKind
  /** The failure behind the screen, shown as a complete, copyable notice below the text. */
  error?: unknown
  /** Offered as "Try again" (a load that failed); without it the screen offers the way home. */
  onRetry?: () => void
  /** Offered for 401: leads to the sign-in page. */
  signInPath?: string
}

/**
 * A full-page status screen for the error routes (401, 403, 404, 429, 500, 503): the icon tile arrives with a spring,
 * the text and the buttons follow slightly staggered. Standalone (no app shell), so it also works while the app itself
 * could not start.
 */
export function ErrorScreen({ kind, error, onRetry, signInPath }: ErrorScreenProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion() ?? false
  const seconds = error instanceof ApiError ? error.retryAfter : undefined

  const fade = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay: reduce ? 0 : delay, ease: 'easeOut' as const },
  })

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg px-6 pt-[max(3rem,12vh)] pb-12" data-testid={`error-screen-${kind}`}>
      <Wordmark height={26} className="mb-12" />
      <div className="w-full max-w-xl text-center">
        <motion.div
          className="mb-6 flex justify-center"
          initial={reduce ? false : { opacity: 0, scale: 0.85, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <span className="card flex h-20 w-20 items-center justify-center text-gold-text">
            <Icon name={ICONS[kind]} size={38} />
          </span>
        </motion.div>

        <motion.div {...fade(0.08)}>
          <p className="font-display text-7xl leading-none tracking-tight text-gold-text">{kind}</p>
          <h1 className="mt-4 text-2xl">{t(`errorScreen.${kind}.title`)}</h1>
          <p className="mx-auto mt-2 max-w-md leading-relaxed text-ink-muted">
            {t(`errorScreen.${kind}.text`, { seconds: seconds ?? 60 })}
          </p>
        </motion.div>

        <motion.div className="mt-8 flex justify-center gap-3" {...fade(0.16)}>
          {onRetry && (
            <Button variant="confirm" icon="refresh" onClick={onRetry}>
              {t('errorScreen.retry')}
            </Button>
          )}
          {signInPath && (
            <Link to={signInPath} className="btn btn-confirm">
              {t('errorScreen.signIn')}
            </Link>
          )}
          <Link to="/" className="btn btn-secondary">
            <Icon name="home" size={17} />
            {t('errorScreen.home')}
          </Link>
        </motion.div>

        {error !== undefined && (
          <motion.div className="mt-8 text-left" {...fade(0.24)}>
            <ErrorNotice error={error} />
          </motion.div>
        )}
      </div>
    </div>
  )
}
