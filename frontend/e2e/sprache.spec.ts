import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* The language switch, proved against the running application.
 *
 * What a unit test cannot answer: that a click reaches PATCH /api/v1/ich, that
 * the account really stores the choice, and that a reload, which starts from the
 * account rather than from anything the page remembered, comes back in it.
 *
 * **Never on the shared test accounts.** The other suites find their controls by
 * German names, so a run that stopped halfway with E2E_EMAIL_EINREICHER left on
 * English would break every one of them in a way that looks like something else
 * entirely. Each test makes a throwaway account through the administrator's API
 * and switches that one.
 */

const ADMIN = konto('admin')

test.skip(ADMIN === null, FEHLENDE_KONTEN)

/* Long enough for the backend's twelve character minimum, and not a real
   password: these accounts exist on a throwaway development database. */
const PASSWORT = 'ein-langes-testpasswort'

async function wegwerfkonto(page: Page): Promise<string> {
  const email = `e2e17a-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.de`

  await anmelden(page, ADMIN!)
  const angelegt = await page.request.post('/api/v1/benutzer', {
    data: { email, passwort: PASSWORT, rollen: ['SUBMITTER'] },
  })
  expect(angelegt.status()).toBe(201)
  await page.request.post('/api/v1/abmeldung')

  await anmelden(page, { email, passwort: PASSWORT })
  return email
}

test('die gewaehlte Sprache wird im Konto gespeichert und uebersteht einen neuen Browser', async ({ page }) => {
  await wegwerfkonto(page)
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Sprache' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')

  const gespeichert = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/ich') && r.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'English' }).click()
  expect((await gespeichert).status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  const konto = await (await page.request.get('/api/v1/ich')).json()
  expect(konto.locale).toBe('en')

  /* A fresh browser context rather than a reload of this one, so nothing the page
     kept in localStorage can be what brings English back. Only the account can. */
  const cookies = await page.context().cookies()
  const neu = await page.context().browser()!.newContext({ baseURL: 'http://localhost:5173' })
  await neu.addCookies(cookies)
  const zweite = await neu.newPage()
  await zweite.goto('/')
  await expect(zweite.getByRole('group', { name: 'Language' })).toBeVisible()
  await expect(zweite.locator('html')).toHaveAttribute('lang', 'en')
  await expect(zweite.getByRole('button', { name: 'English' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await neu.close()
})

test('scheitert das Speichern, bleibt die Sprache hier und die Meldung sagt, wie es weitergeht', async ({ page }) => {
  await wegwerfkonto(page)
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Sprache' })).toBeVisible()

  await page.route('**/api/v1/ich', (route) =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  )
  await page.getByRole('button', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('alert')).toContainText('Click EN again to retry')
  expect((await (await page.request.get('/api/v1/ich')).json()).locale).toBe('de')

  await page.unroute('**/api/v1/ich')
  await page.getByRole('button', { name: 'English' }).click()
  await expect
    .poll(async () => (await (await page.request.get('/api/v1/ich')).json()).locale)
    .toBe('en')
})

test('abgemeldet wechselt die Anmeldeseite die Sprache, ohne etwas zu speichern', async ({ page }) => {
  await page.goto('/anmeldung')
  await page.getByRole('button', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('group', { name: 'Language' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible()
})
