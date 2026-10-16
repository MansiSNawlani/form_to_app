import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* A refused submit marks the field it refused, not only the list above it.
 *
 * Asked for by FFS on 2026-10-15: the list says what is wrong, the red border
 * says where. What a unit test cannot answer is that the mark reaches the real
 * control, that a screen reader is told about it, and that it lifts once the
 * field is filled in. The decision itself is tested in absenden/amFeld.test.ts.
 *
 * An imported protocol takes the same path: the import stores its refusals
 * where a submit does, and the form reads them from there on opening.
 */

const EINREICHER = konto('einreicher')

test.skip(EINREICHER === null, FEHLENDE_KONTEN)

const FEHLT = /zum Absenden gebraucht/
const GRUPPE_FEHLT = /Dieser Block ist noch nicht ausgefüllt/

/** An empty draft through the API, refused through the button, as a person does it. */
async function abgelehnterEntwurf(page: Page): Promise<string> {
  const antwort = await page.request.post('/api/v1/protokolle')
  expect(antwort.ok()).toBe(true)
  const id = (await antwort.json()).id as string

  await page.goto(`/protokolle/${id}/abschnitt/7`)
  await page.getByRole('button', { name: 'Protokoll absenden' }).click()

  /* Waited for by its answer rather than by the panel, which lists only the open
     section's problems, and an empty draft owes nothing in section 7. */
  const [abgelehnt] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/protokolle/${id}/absenden`)),
    page.getByRole('dialog').getByRole('button', { name: 'Jetzt absenden' }).click(),
  ])
  expect(abgelehnt.status()).toBe(422)

  return id
}

test.beforeEach(async ({ page }) => {
  await anmelden(page, EINREICHER!)
})

test('ein abgelehntes Feld ist markiert, bis es ausgefuellt ist', async ({ page }) => {
  const id = await abgelehnterEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  const email = page.getByRole('textbox', { name: 'E-Mail' })
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(email).toHaveAccessibleDescription(FEHLT)

  await email.fill('kartierung@example.org')
  await expect(email).not.toHaveAttribute('aria-invalid', 'true')

  // Emptied again, it is what the server refused again.
  await email.fill('')
  await expect(email).toHaveAttribute('aria-invalid', 'true')
})

test('ein Feld, das der Server nicht nennt, bleibt unmarkiert', async ({ page }) => {
  const id = await abgelehnterEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  await expect(page.getByRole('textbox', { name: 'Telefon' })).not.toHaveAttribute(
    'aria-invalid',
    'true',
  )
})

test('eine abgelehnte Prozentgruppe ist umrandet, bis sie aufgeht', async ({ page }) => {
  const id = await abgelehnterEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/3`)

  const gruppe = page.getByRole('group', { name: 'Nutzung des Umlands' })
  await expect(gruppe).toHaveAccessibleDescription(GRUPPE_FEHLT)
  await expect(gruppe).toHaveCSS('outline-style', 'solid')

  await gruppe.getByRole('spinbutton', { name: 'Nadelwald' }).fill('100')
  await expect(gruppe).not.toHaveAccessibleDescription(GRUPPE_FEHLT)
  await expect(gruppe).toHaveCSS('outline-style', 'none')
})

test('die Markierung uebersteht das Neuladen', async ({ page }) => {
  const id = await abgelehnterEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)
  await page.reload()

  await expect(page.getByRole('textbox', { name: 'E-Mail' })).toHaveAttribute('aria-invalid', 'true')
})
