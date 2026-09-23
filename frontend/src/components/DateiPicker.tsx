import Button from '@mui/material/Button'
import { useId, type Ref } from 'react'

interface DateiPickerProps {
  /** The button's own text, already translated. */
  beschriftung: string
  mehrere?: boolean
  /* What to offer in the file dialog, as a media type list. A hint, never a
     check: it is bypassed by choosing "all files" and ignored by a browser that
     has never heard of the type, so the rules decide in every case. Required
     rather than defaulted, because a picker that silently offers the wrong
     kind of file is worse than one that will not compile. */
  akzeptiert: string
  onDateien: (dateien: File[]) => void
  /* Set while a pick is still going up. Without it a slow upload looks exactly
     like a click that did nothing, and the obvious response is to pick the same
     files again. Both the label and the input are disabled: the label carries
     the look and stops a click, the input is the real control and has to stop
     accepting one. */
  gesperrt?: boolean
  /* So a block can put focus back on this control after a removal. Without it,
     focus is left on a button that no longer exists and falls to the top of the
     document, which for a keyboard user means tabbing the section again. */
  ref?: Ref<HTMLInputElement>
}

/* The one control on this application that is a native element by necessity
 * rather than by choice.
 *
 * coding-standards.md says to reach for MUI before writing a native control,
 * and MUI has no file input at all: opening the operating system's file dialog
 * is something only <input type="file"> can do. So the input carries the
 * behaviour and an MUI Button carries the look, which is MUI's own documented
 * pattern for this case.
 *
 * Lived in abschnitte/teil7/ as AnlagenPicker until feature 23c, which picks a
 * PDF on Meine Protokolle and needs the same control. Moved rather than copied,
 * because the three paragraphs below are the whole reason this file exists and a
 * second copy would drift from them by the first bug fix. Its focus-ring rule
 * moved to shell.css with it, which is the stylesheet every page loads; in
 * protokoll.css it would not have reached the list.
 *
 * The input is visually hidden rather than display:none. A hidden input is
 * still the labelled, focusable control a screen reader announces, and
 * display:none would take it out of the accessibility tree entirely, leaving a
 * button that says nothing about what it opens.
 *
 * Which leaves the tab order, and this is the part that is easy to get wrong.
 * MUI's ButtonBase makes the label focusable too, so the obvious composition
 * gives two tab stops for one control, and the second lands on an input clipped
 * to a single pixel where a focus ring cannot be seen. The input keeps the
 * focus, because it is the real control; the label is taken out of the tab
 * order with tabIndex -1 and wears the ring on the input's behalf, through the
 * :has() rule in shell.css. tabIndex -1 still allows focus() to be called on
 * it, which is why a restore targets the input rather than this.
 */
function DateiPicker({
  beschriftung,
  mehrere = false,
  akzeptiert,
  onDateien,
  gesperrt = false,
  ref,
}: DateiPickerProps) {
  const id = useId()

  return (
    <Button
      component="label"
      htmlFor={id}
      variant="outlined"
      tabIndex={-1}
      className="datei-picker"
      disabled={gesperrt}
    >
      {beschriftung}
      <input
        id={id}
        ref={ref}
        type="file"
        multiple={mehrere}
        disabled={gesperrt}
        accept={akzeptiert}
        className="visually-hidden"
        onChange={(event) => {
          const dateien = [...(event.target.files ?? [])]
          /* Cleared before the handler runs, so picking the same file twice in
             a row still fires a change event. Without this, a surveyor who
             fixes a rejected file and picks it again gets nothing at all. */
          event.target.value = ''
          if (dateien.length > 0) onDateien(dateien)
        }}
      />
    </Button>
  )
}

export default DateiPicker
