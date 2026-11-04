import type { ReactNode } from 'react'

interface AlertSlotProps {
  children?: ReactNode
  /**
   * Every answer this place can show in normal operation (already translated). The slot is sized for the tallest of
   * them at the current width and language, so an alert appearing, changing or going away moves nothing: no card that
   * grows, no button that jumps. Without it the slot is the height of a three-line alert.
   *
   * Rare technical failures (no connection, an unexpected server error with its trace id) are not listed on purpose:
   * reserving room for them would leave a large gap in every form for something that almost never happens.
   */
  reserve?: readonly string[]
  /** For one-line notices without a Copy footer ("saved", hints): the reserved room has no footer either. */
  plain?: boolean
}

/**
 * The fixed place for a form's answer (a failed submit, "saved"). Put it where the answer belongs (usually below the
 * buttons) and keep it there.
 *
 * Only for answers inside a form. Replacing a whole screen (the next sign-in step, a dialog) is a deliberate change
 * of content, not a message.
 */
export function AlertSlot({ children, reserve = [], plain = false }: AlertSlotProps) {
  return (
    // One grid cell holds the real notice and an invisible copy of every possible one, drawn with the notice's own box
    // metrics from a data attribute - so they take room but are no text in the page.
    <div className={`grid ${reserve.length === 0 ? 'min-h-[6.25rem]' : ''}`}>
      <div className="col-start-1 row-start-1">{children}</div>
      {reserve.map((text, index) => (
        <div
          key={index}
          aria-hidden="true"
          data-reserved={text}
          className={`${plain ? 'notice-reserve-plain' : 'notice-reserve'} pointer-events-none invisible col-start-1 row-start-1 select-none`}
        />
      ))}
    </div>
  )
}
