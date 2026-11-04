interface MessageSlotProps {
  /** Id of the shown message, so a field can point to it with aria-describedby. */
  id?: string
  /** The message to show now (a hint or an error); nothing = the slot stays empty but keeps its room. */
  message?: string | undefined
  /** The message is an error (shown in the danger colour). */
  danger?: boolean
  /** Every text that can show up here, so the room is sized for the longest of them (see TextField "reserve"). */
  reserve: readonly string[]
}

/**
 * Text under something that shows the same room whatever it says: a hint that an error replaces, an answer that
 * appears later. One grid cell holds the visible message and an invisible copy of every possible one; the cell is as
 * tall as the tallest. The copies are drawn from a data attribute, so they are no text in the page: screen readers,
 * find-in-page and tests only ever see the message that is really shown. This is what keeps the layout rigid.
 */
export function MessageSlot({ id, message, danger = false, reserve }: MessageSlotProps) {
  if (!message && reserve.length === 0) return null
  return (
    <div className="grid text-[0.8125rem] leading-snug">
      {message && (
        <p id={id} className={`col-start-1 row-start-1 ${danger ? 'text-danger' : 'text-ink-muted'}`}>
          {message}
        </p>
      )}
      {reserve.map((text, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-reserved={text}
          className="pointer-events-none invisible col-start-1 row-start-1 select-none after:content-[attr(data-reserved)]"
        />
      ))}
    </div>
  )
}
