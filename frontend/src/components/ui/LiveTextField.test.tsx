import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from 'i18next'
import { useState } from 'react'
import { beforeAll, describe, expect, it } from 'vitest'
import '../../i18n'
import { passwordCheck, repeatCheck } from '../../validation/rules'
import { LiveTextField } from './LiveTextField'
import type { Check } from '../../validation/rules'

beforeAll(async () => {
  await i18n.changeLanguage('de')
})

function Harness({ check, attempted = false, serverError }: { check: Check; attempted?: boolean; serverError?: string }) {
  const [value, setValue] = useState('')
  return <LiveTextField label="Passwort" name="password" value={value} onValueChange={setValue} check={check} attempted={attempted} serverError={serverError} />
}

const policy = { minLength: 12, maxLength: 128 }

describe('LiveTextField', () => {
  it('stays calm while nobody has typed', () => {
    render(<Harness check={passwordCheck(policy)} />)
    expect(screen.getByLabelText('Passwort')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText(/Zu kurz/)).toBeNull()
  })

  it('shows the problem with the live count on every keystroke - before any blur or click', async () => {
    const user = userEvent.setup()
    render(<Harness check={passwordCheck(policy)} />)
    const field = screen.getByLabelText('Passwort')
    await user.type(field, 'abcde')
    expect(screen.getByText('Zu kurz: 5 von mindestens 12 Zeichen.')).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')
    await user.type(field, 'fgh')
    expect(screen.getByText('Zu kurz: 8 von mindestens 12 Zeichen.')).toBeInTheDocument()
  })

  it('removes the message the moment the value is fine', async () => {
    const user = userEvent.setup()
    render(<Harness check={passwordCheck(policy)} />)
    const field = screen.getByLabelText('Passwort')
    await user.type(field, 'abcdefghijkl')
    expect(screen.queryByText(/Zu kurz/)).toBeNull()
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it('says "required" after the user emptied the field again', async () => {
    const user = userEvent.setup()
    render(<Harness check={passwordCheck(policy)} />)
    const field = screen.getByLabelText('Passwort')
    await user.type(field, 'a')
    await user.clear(field)
    expect(screen.getByText('Bitte ein Passwort eingeben.')).toBeInTheDocument()
  })

  it('marks an untouched empty field after a submit attempt', () => {
    render(<Harness check={passwordCheck(policy)} attempted />)
    expect(screen.getByText('Bitte ein Passwort eingeben.')).toBeInTheDocument()
  })

  it('shows the server answer when the value itself has no problem, and the live problem wins over it', async () => {
    const user = userEvent.setup()
    render(<Harness check={passwordCheck(policy)} serverError="Schon vergeben." />)
    expect(screen.getByText('Schon vergeben.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Passwort'), 'abc')
    expect(screen.queryByText('Schon vergeben.')).toBeNull()
    expect(screen.getByText(/Zu kurz/)).toBeInTheDocument()
  })

  it('reserves room for the longest message without putting it into the page text', () => {
    const { container } = render(<Harness check={passwordCheck(policy)} />)
    const reserved = container.querySelectorAll('[data-reserved]')
    expect(reserved.length).toBeGreaterThanOrEqual(3)
    // The reserved copies are drawn from an attribute: no text node, so screen readers and find-in-page never see them.
    expect(screen.queryByText('Zu lang: 227 von höchstens 128 Zeichen.')).toBeNull()
  })

  it('treats an unfinished beginning of a repeat as work in progress until the field is left', async () => {
    const user = userEvent.setup()
    render(<Harness check={repeatCheck('secret password')} />)
    const field = screen.getByLabelText('Passwort')
    await user.type(field, 'secret')
    expect(screen.queryByText('Die beiden Passwörter sind nicht gleich.')).toBeNull()
    await user.tab()
    expect(screen.getByText('Die beiden Passwörter sind nicht gleich.')).toBeInTheDocument()
  })
})
