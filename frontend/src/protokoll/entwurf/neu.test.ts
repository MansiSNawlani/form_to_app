import { describe, expect, it } from 'vitest'
import { NEU, istNeu, leererEntwurf, verlaesstProtokoll } from './neu'

describe('istNeu', () => {
  it('recognises the placeholder that stands in for a protocol id', () => {
    expect(istNeu(NEU)).toBe(true)
  })

  /* Real ids are UUIDs, so the placeholder can never be mistaken for one the
     server handed back. */
  it('is not fooled by a real id or by no id at all', () => {
    expect(istNeu('ea6466ae-9faf-4516-8545-926fdfc07ece')).toBe(false)
    expect(istNeu(undefined)).toBe(false)
  })
})

describe('leererEntwurf', () => {
  /* Version 0 never reaches an endpoint: the server's own versions start at 1,
     and the first save replaces this whole object with what the server answers.
     A 0 arriving at the API would be a bug rather than a conflict. */
  it("starts below the server's first version and holds no answers", () => {
    const entwurf = leererEntwurf()

    expect(entwurf.id).toBe(NEU)
    expect(entwurf.version).toBe(0)
    expect(entwurf.antworten).toEqual({})
    expect(entwurf.status).toBe('DRAFT')
  })

  /* The header prints the form version, and only the server knows which one is
     current: it stamps the record when it creates it. Empty is what tells the
     header to leave the line out rather than print a blank. */
  it('has no form version, because no record exists to carry one', () => {
    expect(leererEntwurf().form_version).toBe('')
  })
})

describe('verlaesstProtokoll', () => {
  /* Moving between sections is not leaving. The section bar changes the address
     on every click, so asking "verwerfen?" each time somebody looks at section 3
     would make the question meaningless by the third time they saw it. */
  it('does not count moving between sections as leaving', () => {
    expect(verlaesstProtokoll('/protokolle/neu/abschnitt/1')).toBe(false)
    expect(verlaesstProtokoll('/protokolle/neu/abschnitt/6')).toBe(false)
  })

  /* The address the protocol gets the moment it is created. Counting this as
     leaving would make the page block its own address swap and ask the surveyor
     to confirm the character they just typed. */
  it("does not count the new record's own address as leaving", () => {
    expect(verlaesstProtokoll('/protokolle/ea6466ae-9faf-4516-8545-926fdfc07ece/abschnitt/1')).toBe(
      false,
    )
  })

  it('counts the list, and anything else, as leaving', () => {
    expect(verlaesstProtokoll('/')).toBe(true)
    expect(verlaesstProtokoll('/anmeldung')).toBe(true)
  })
})
