import { describe, expect, it } from 'vitest'
import de from '../../i18n/locales/de.json'
import en from '../../i18n/locales/en.json'
import { ACTIVITY_ACTIONS } from './activityActions'

/** The action codes the server writes (every Record/RecordNow call in its controllers and services). */
const SERVER_ACTIONS = [
  'account.password_changed',
  'admin.emergency_reset',
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.reauth_failed',
  'auth.refresh_reuse',
  'auth.register',
  'auth.twofactor_failed',
  'backup.auto_created',
  'backup.auto_failed',
  'backup.auto_unchanged',
  'backup.created',
  'backup.downloaded',
  'backup.restored',
  'backup.settings_changed',
  'backup.uploaded',
  'session.revoked',
  'settings.changed',
  'setup.completed',
  'twofactor.disabled',
  'twofactor.enabled',
  'twofactor.reset',
  'user.created',
  'user.deleted',
  'user.disabled',
  'user.password_set',
  'user.role_changed',
  'user.updated',
]

/** Looks a dotted code up in the nested locale ("auth.login" -> actions.auth.login). */
function label(locale: { activity: { actions: unknown } }, code: string): unknown {
  return code.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), locale.activity.actions)
}

describe('activity log actions', () => {
  it('offers every action the server writes in the filter', () => {
    expect(SERVER_ACTIONS.filter((code) => !(ACTIVITY_ACTIONS as readonly string[]).includes(code))).toEqual([])
  })

  it.each(['de', 'en'] as const)('has a readable %s label for every action of the filter', (language) => {
    const locale = language === 'de' ? de : en
    for (const code of ACTIVITY_ACTIONS) expect(typeof label(locale, code), `${language}: ${code}`).toBe('string')
  })

  it('has the fallback text for an action a newer server writes', () => {
    expect(de.activity.unknown).toContain('{{code}}')
    expect(en.activity.unknown).toContain('{{code}}')
  })
})
