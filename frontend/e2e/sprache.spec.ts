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

async function wegwerfkonto(
  page: Page,
  { rollen = ['SUBMITTER'], locale = 'de' }: { rollen?: string[]; locale?: 'de' | 'en' } = {},
): Promise<string> {
  const email = `e2e17-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.de`

  await anmelden(page, ADMIN!)
  const angelegt = await page.request.post('/api/v1/benutzer', {
    data: { email, passwort: PASSWORT, rollen, locale },
  })
  expect(angelegt.status()).toBe(201)
  await page.request.post('/api/v1/abmeldung')

  await anmelden(page, { email, passwort: PASSWORT })
  return email
}

test('die gewaehlte Sprache wird im Konto gespeichert und uebersteht einen neuen Browser', async ({
  page,
  baseURL,
}) => {
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
  const neu = await page.context().browser()!.newContext({ baseURL })
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

/* EN, then DE before the EN save has answered. The last click has to win on the
   screen and in the account, however the two answers arrive. */
test('zwei schnelle Klicks enden auf dem zweiten', async ({ page }) => {
  await wegwerfkonto(page)
  await page.goto('/')
  await expect(page.getByRole('group', { name: 'Sprache' })).toBeVisible()

  let erstesLoslassen: () => void = () => {}
  const erstesGehalten = new Promise<void>((r) => (erstesLoslassen = r))
  let erstes = true
  await page.route('**/api/v1/ich', async (route) => {
    if (route.request().method() === 'PATCH' && erstes) {
      erstes = false
      await erstesGehalten
    }
    await route.continue()
  })

  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Deutsch' }).click()
  erstesLoslassen()

  await expect
    .poll(async () => (await (await page.request.get('/api/v1/ich')).json()).locale)
    .toBe('de')
  await page.waitForTimeout(500)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})

/* Feature 17b: the frame and the three lists read in English. The account is made
   in English, so this is about the screens, not about the switch above. All three
   roles, so all three nav links show. */
test('Rahmen und Listen erscheinen auf Englisch', async ({ page }) => {
  await wegwerfkonto(page, { rollen: ['SUBMITTER', 'REVIEWER', 'SUPER_ADMIN'], locale: 'en' })

  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  await nav.getByRole('link', { name: 'My protocols' }).click()
  await expect(page.getByRole('heading', { name: 'My protocols' })).toBeVisible()

  await nav.getByRole('link', { name: 'Review queue' }).click()
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Species (Art)' })).toBeVisible()

  await nav.getByRole('link', { name: 'User administration' }).click()
  await expect(page.getByRole('heading', { name: 'User administration' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'New account' })).toBeVisible()
})

/* Feature 17c: the form itself. Per section a block heading and one control,
   each found by its English name, and the Next button, whose name carries the
   next section's title, so all seven titles are read on the way through. */
type Rolle = 'textbox' | 'spinbutton' | 'checkbox' | 'button'

test('das Formular erscheint auf Englisch, Abschnitt fuer Abschnitt', async ({ page }) => {
  await wegwerfkonto(page, { locale: 'en' })
  const angelegt = await page.request.post('/api/v1/protokolle')
  expect(angelegt.ok()).toBe(true)
  const id = (await angelegt.json()).id as string

  const abschnitte: [string, string, [Rolle, string]][] = [
    ['Occasion and sampling stretch', 'Sampling stretch (Probestrecke)', ['textbox', 'Water body (Gewässer)']],
    ['Measurements and hydrology', 'Measurements', ['spinbutton', 'Water temperature']],
    ['Surrounding land, bank and bed', 'Bank', ['spinbutton', 'Coniferous forest']],
    ['Structures and management', 'Fishery management', ['checkbox', 'Hydropower']],
    ['Equipment and fished areas', 'Fished areas', ['spinbutton', 'Voltage']],
    ['Catch', 'Species found and size classes', ['textbox', 'Additional remarks on the survey or the fish stock']],
    ['Map and photos', 'Photos of the sampling stretch', ['button', 'Choose photos']],
  ]

  await page.goto(`/protokolle/${id}/abschnitt/1`)
  await expect(page.getByRole('button', { name: 'Download as PDF' })).toBeVisible()

  const rechtswert = page.getByRole('spinbutton', { name: 'Lower boundary, easting' })
  await rechtswert.fill('123')
  await rechtswert.blur()
  await expect(page.getByText('The easting lies outside Baden-Württemberg.')).toBeVisible()

  for (const [nr, [titel, block, [rolle, feld]]] of abschnitte.entries()) {
    const abschnitt = page.getByRole('region', { name: titel })
    await expect(abschnitt).toBeVisible()
    await expect(abschnitt.getByRole('group', { name: block, exact: true })).toBeVisible()
    await expect(abschnitt.getByRole(rolle, { name: feld, exact: true }).first()).toBeVisible()

    const naechster = abschnitte[nr + 1]
    if (naechster) await page.getByRole('link', { name: `Next: ${naechster[0]}` }).click()
  }
})

/* Feature 17d: what surrounds the form, and the dropdown entries. Submitting an
   empty protocol never gets past the check, so this changes nothing anybody
   else sees. */
test('Auswahllisten und Absenden erscheinen auf Englisch', async ({ page }) => {
  await wegwerfkonto(page, { locale: 'en' })
  const angelegt = await page.request.post('/api/v1/protokolle')
  expect(angelegt.ok()).toBe(true)
  const id = (await angelegt.json()).id as string

  await page.goto(`/protokolle/${id}/abschnitt/2`)
  await expect(page.getByRole('radio', { name: 'Before the survey' })).toBeVisible()
  await expect(page.getByRole('radio', { name: '0.1 - 0.25' })).toBeVisible()

  await page.goto(`/protokolle/${id}/abschnitt/4`)
  await expect(page.getByRole('radio', { name: '2 - Widespread' }).first()).toBeVisible()

  await page.goto(`/protokolle/${id}/abschnitt/6`)
  const art = page.getByRole('combobox').first()
  await art.fill('No detection')
  await expect(page.getByRole('option', { name: 'No detection, crayfish' })).toBeVisible()
  await art.fill('Bachforelle')
  await expect(page.getByRole('option', { name: 'Bachforelle' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.goto(`/protokolle/${id}/abschnitt/7`)
  await page.getByRole('button', { name: 'Submit protocol' }).click()
  await expect(page.getByRole('dialog', { name: 'Submit protocol?' })).toBeVisible()
  await page.getByRole('button', { name: 'Submit now' }).click()
  await page.getByRole('link', { name: /^1 Occasion and sampling stretch/ }).click()
  await expect(page.getByText('The protocol has not been submitted yet')).toBeVisible()
})

/* The reviewer's side, read without deciding anything: a decision would change a
   protocol the other suites count on. Needs one open protocol in the queue. */
test('die Pruefansicht erscheint auf Englisch', async ({ page }) => {
  await wegwerfkonto(page, { rollen: ['REVIEWER'], locale: 'en' })
  const antwort = await page.request.get('/api/v1/pruefliste?status=SUBMITTED&status=IN_REVIEW')
  const zeilen = (await antwort.json()).zeilen as { id: string }[]
  test.skip(zeilen.length === 0, 'Kein offenes Protokoll in der Pruefliste. Eines einreichen.')

  await page.goto(`/protokolle/${zeilen[0].id}/pruefung`)
  await expect(page.getByRole('heading', { name: 'Decision' })).toBeVisible()
  for (const wahl of ['Accept', 'Request changes', 'Reject']) {
    await expect(page.getByRole('radio', { name: new RegExp(`^${wahl}`) })).toBeVisible()
  }
  await expect(page.getByRole('textbox', { name: 'Reason' })).toBeVisible()
  /* The panel is an unnamed section, so it is found by its heading; scoped so the
     status badge in the page header, which also reads Submitted, cannot match. */
  const verlauf = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'History (Verlauf)' }) })
  await expect(verlauf.getByText('Submitted', { exact: true }).first()).toBeVisible()
})

test('abgemeldet wechselt die Anmeldeseite die Sprache, ohne etwas zu speichern', async ({ page }) => {
  const gesendet: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'PATCH') gesendet.push(r.url())
  })
  await page.goto('/anmeldung')
  await page.getByRole('button', { name: 'English' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('group', { name: 'Language' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible()
  expect(gesendet).toEqual([])
})
