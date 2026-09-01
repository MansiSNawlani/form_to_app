import { describe, expect, it } from 'vitest'
import { protokollTitel } from './titel'

describe('protokollTitel', () => {
  it('joins the Gewaesser and the Ortsangabe, as the mockup does', () => {
    expect(
      protokollTitel({
        probestrecke: {
          gewaesser: { gewaessername: 'Schussen' },
          ortsangabe: 'Weißenau',
        },
      }),
    ).toBe('Schussen, Weißenau')
  })

  it('is just the Gewaesser when there is no Ortsangabe yet', () => {
    expect(
      protokollTitel({
        probestrecke: { gewaesser: { gewaessername: 'Schussen' } },
      }),
    ).toBe('Schussen')
  })

  it('is just the Ortsangabe when there is no Gewaesser yet', () => {
    expect(protokollTitel({ probestrecke: { ortsangabe: 'Weißenau' } })).toBe(
      'Weißenau',
    )
  })

  /* A draft is named before it is filled in, so the empty case is the one the
     user sees first and the caller has to have a placeholder for it. */
  it('is null on a draft that has neither', () => {
    expect(protokollTitel({})).toBeNull()
  })

  /* Answers are strings straight from an input, so a field the user opened and
     abandoned holds "" or a space, not undefined. */
  it('treats blank and whitespace-only answers as absent', () => {
    expect(
      protokollTitel({
        probestrecke: { gewaesser: { gewaessername: '  ' }, ortsangabe: '' },
      }),
    ).toBeNull()
  })

  it('does not leave a dangling comma when only one side is blank', () => {
    expect(
      protokollTitel({
        probestrecke: { gewaesser: { gewaessername: 'Schussen' }, ortsangabe: ' ' },
      }),
    ).toBe('Schussen')
  })
})
