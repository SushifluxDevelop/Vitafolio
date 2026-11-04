import { render } from '@testing-library/react'
import i18n from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'
import '../../i18n'
import { REAUTH_ANSWERS, ReauthDialog } from './ReauthDialog'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

function renderDialog() {
  return render(
    <ReauthDialog open onClose={() => undefined} title="Sicherung wiederherstellen" icon="history" confirmLabel="Wiederherstellen" askPassword askCode={false} onConfirm={() => Promise.resolve()}>
      <p>Text</p>
    </ReauthDialog>,
  )
}

describe('ReauthDialog message room', () => {
  it('reserves room for every realistic answer, so a refusal never makes the dialog grow', () => {
    renderDialog()
    const reserved = [...document.querySelectorAll('[data-reserved]')].map((element) => element.getAttribute('data-reserved') ?? '')
    for (const code of ['backup.too_new', 'backup.invalid', 'backup.restore_failed', 'maintenance.busy', 'twofactor.code_already_used', 'twofactor.key_unavailable', 'auth.reauth_failed']) {
      expect(REAUTH_ANSWERS).toContain(code)
    }
    // Both variants of a failed restore (rolled back or not) and the upload limit, with a typical safety backup name filled in.
    expect(reserved.filter((text) => text.includes('Wiederherstellung ist fehlgeschlagen')).length).toBe(2)
    expect(reserved.some((text) => text.includes('app-20261104-223037-pre-restore.db') && !text.includes('{{'))).toBe(true)
    expect(reserved).toContain('Höchstens 10 hochgeladene Sicherungen – bitte erst eine löschen.')
    expect(reserved.filter((text) => text.startsWith('errors.')).length, 'an untranslated key would be reserved as its own text').toBe(0)
    expect(reserved.length).toBeGreaterThanOrEqual(REAUTH_ANSWERS.length)
  })

  it('keeps the reserved copies out of the page text (screen readers and tests never see them)', () => {
    renderDialog()
    expect(document.body.textContent).not.toContain('Die Wiederherstellung ist fehlgeschlagen')
  })
})
