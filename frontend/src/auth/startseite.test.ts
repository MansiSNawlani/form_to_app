import { describe, expect, it } from 'vitest'
import { MEINE_PROTOKOLLE, PRUEFLISTE, startseite, zielNachAnmeldung } from './startseite'

describe('startseite', () => {
  it('sends the three FFS roles to the review queue', () => {
    expect(startseite(['REVIEWER'])).toBe(PRUEFLISTE)
    expect(startseite(['DATA_STEWARD'])).toBe(PRUEFLISTE)
    expect(startseite(['SUPER_ADMIN'])).toBe(PRUEFLISTE)
  })

  it('sends everybody else to their own protocols', () => {
    expect(startseite(['SUBMITTER'])).toBe(MEINE_PROTOKOLLE)
    expect(startseite(['INTEGRATION'])).toBe(MEINE_PROTOKOLLE)
    expect(startseite([])).toBe(MEINE_PROTOKOLLE)
  })

  /* Read-only over its own region, refused by the Pruefliste endpoint today, and
     given a view of its own in feature 13. Landing it on a page that refuses it
     would be a worse first impression than landing it on a list. */
  it('does not send a Regierungspraesidium account to a page that refuses it', () => {
    expect(startseite(['REGIERUNGSPRAESIDIUM'])).toBe(MEINE_PROTOKOLLE)
  })

  /* Somebody who both files and reviews protocols is at work on the queue. Their
     own list is one click away in the header. */
  it('sends an account that both files and reviews to the queue', () => {
    expect(startseite(['SUBMITTER', 'REVIEWER'])).toBe(PRUEFLISTE)
  })
})

describe('zielNachAnmeldung', () => {
  it('honours a page that was actually asked for, whoever is signing in', () => {
    const ziel = '/protokolle/abc/pruefung'
    expect(zielNachAnmeldung(ziel, ['REVIEWER'])).toBe(ziel)
    expect(zielNachAnmeldung(ziel, ['SUBMITTER'])).toBe(ziel)
  })

  it('falls back to the account starting point when no page was asked for', () => {
    expect(zielNachAnmeldung(null, ['REVIEWER'])).toBe(PRUEFLISTE)
    expect(zielNachAnmeldung(null, ['SUBMITTER'])).toBe(MEINE_PROTOKOLLE)
  })

  /* weiter.ts leaves the parameter off for the home page, so an explicit "/" and
     no parameter at all are the same request: no particular page. */
  it('treats an explicit home page as no particular page', () => {
    expect(zielNachAnmeldung('/', ['REVIEWER'])).toBe(PRUEFLISTE)
  })

  /* An address bar value is untrusted whoever sent the link, and sichererWeiterPfad
     already refuses anything that leaves this site. What matters here is that the
     refusal does not then strand a reviewer on the wrong list. */
  it('refuses an address that leaves this site, and still starts the account correctly', () => {
    expect(zielNachAnmeldung('https://example.com/phish', ['REVIEWER'])).toBe(PRUEFLISTE)
    expect(zielNachAnmeldung('//example.com', ['SUBMITTER'])).toBe(MEINE_PROTOKOLLE)
  })
})
