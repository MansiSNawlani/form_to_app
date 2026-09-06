import Button from '@mui/material/Button'
import { useId, useRef, type Ref } from 'react'
import { ERLAUBTE_TYPEN } from '../../anlagen/regeln'

interface AnlagenPickerProps {
  /** The button's own text, already translated. */
  beschriftung: string
  mehrere?: boolean
  onDateien: (dateien: File[]) => void
  /* So a block can put focus back here after a removal. Without it, focus is
     left on a button that no longer exists and falls to the top of the
     document, which for a keyboard user means tabbing the whole section again. */
  ref?: Ref<HTMLLabelElement>
}

/* The one control on this form that is a native element by necessity rather
 * than by choice.
 *
 * coding-standards.md says to reach for MUI before writing a native control,
 * and MUI has no file input at all: opening the operating system's file dialog
 * is something only <input type="file"> can do. So the input carries the
 * behaviour and an MUI Button carries the look, which is MUI's own documented
 * pattern for this case.
 *
 * The input is visually hidden rather than display:none. A hidden input is
 * still the labelled, focusable control a screen reader announces, and
 * display:none would take it out of the accessibility tree entirely, leaving a
 * button that says nothing about what it opens.
 */
function AnlagenPicker({
  beschriftung,
  mehrere = false,
  onDateien,
  ref,
}: AnlagenPickerProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)

  return (
    <Button component="label" htmlFor={id} variant="outlined" ref={ref}>
      {beschriftung}
      <input
        id={id}
        ref={input}
        type="file"
        multiple={mehrere}
        /* A hint to the file dialog, never a check. The rules decide, because
           this attribute is trivially bypassed by choosing "all files" and
           because a browser that has never heard of a type ignores it. */
        accept={ERLAUBTE_TYPEN.join(',')}
        className="visually-hidden"
        onChange={(event) => {
          const dateien = [...(event.target.files ?? [])]
          /* Cleared before the handler runs, so picking the same file twice in
             a row still fires a change event. Without this, a surveyor who
             fixes a rejected file and picks it again gets nothing at all. */
          if (input.current !== null) input.current.value = ''
          if (dateien.length > 0) onDateien(dateien)
        }}
      />
    </Button>
  )
}

export default AnlagenPicker
