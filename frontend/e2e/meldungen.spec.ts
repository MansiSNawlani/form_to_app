import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* The server's refusals in the chosen language, feature 17e.
 *
 * What a unit test cannot answer: that a real refusal from the real backend
 * reaches the screen through its code, in English when English is chosen and in
 * the backend's own German otherwise.
 *
 * The sign-in tests need no account at all, because an address nobody has gets
 * the same refusal as a wrong password. The import test needs one, and makes a
 * throwaway account through the administrator for the reason sprache.spec.ts
 * gives: the shared test accounts must never be left on English.
 */

const UNBEKANNT = { email: 'niemand-e2e17e@test.de', passwort: 'falsches-passwort-123' }

async function anmeldenVersuchen(page: Page, sprache: 'de' | 'en') {
  await page.goto('/anmeldung')
  if (sprache === 'en') await page.getByRole('button', { name: 'English' }).click()

  const email = sprache === 'en' ? 'Email address' : 'E-Mail-Adresse'
  const passwort = sprache === 'en' ? 'Password' : 'Passwort'
  const absenden = sprache === 'en' ? 'Sign in' : 'Anmelden'

  await page.getByLabel(email).fill(UNBEKANNT.email)
  await page.getByLabel(passwort, { exact: true }).fill(UNBEKANNT.passwort)
  await page.getByRole('button', { name: absenden, exact: true }).click()
}

test('eine abgelehnte Anmeldung steht auf Englisch, wenn Englisch gewaehlt ist', async ({
  page,
}) => {
  await anmeldenVersuchen(page, 'en')

  const meldung = page.getByRole('alert').filter({ hasText: 'password' })
  await expect(meldung).toContainText('The email address or password is not correct.')
  await expect(meldung).not.toContainText('Passwort')
  await page.screenshot({ path: 'test-results/17e-anmeldung-en.png' })
})

test('und auf Deutsch, wortgleich mit dem Backend, wenn Deutsch gewaehlt ist', async ({
  page,
}) => {
  await anmeldenVersuchen(page, 'de')

  const meldung = page.getByRole('alert').filter({ hasText: 'Passwort' })
  await expect(meldung).toContainText('E-Mail-Adresse oder Passwort ist nicht richtig.')
})

const ADMIN = konto('admin')

test.describe('mit Konto', () => {
  test.skip(ADMIN === null, FEHLENDE_KONTEN)

  test('eine Datei, die keine PDF ist, wird auf Englisch und mit ihrem Namen abgelehnt', async ({
    page,
  }) => {
    const email = `e2e17e-${Date.now()}@test.de`
    const passwort = 'ein-langes-testpasswort'

    await anmelden(page, ADMIN!)
    const angelegt = await page.request.post('/api/v1/benutzer', {
      data: { email, passwort, rollen: ['SUBMITTER'], locale: 'en' },
    })
    expect(angelegt.status()).toBe(201)
    await page.request.post('/api/v1/abmeldung')
    await anmelden(page, { email, passwort })

    await page.goto('/')
    /* The picker is a label styled as a button for a hidden file input. The
       button role names both; the label names only the input, which is what
       takes the file. */
    await page.getByLabel('Import PDF').setInputFiles({
      name: 'kein-protokoll.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Das ist keine PDF-Datei.'),
    })

    const meldung = page.getByRole('alert').filter({ hasText: 'kein-protokoll.pdf' })
    await expect(meldung).toContainText('kein-protokoll.pdf: This file could not be opened.')
    await page.screenshot({ path: 'test-results/17e-einlesen-en.png' })
  })
})
