import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* The map beside the boundary coordinates in section 1, against the running
 * application and the real basemap.de background.
 *
 * The conversion between the form's metres and the map's degrees is proved in
 * src/protokoll/karte/umrechnung.test.ts. What only a browser can answer is
 * whether the two halves are wired together: typed numbers put a marker on the
 * map, a click on the map puts numbers in the boxes, and the boxes still work
 * when the background map cannot be reached.
 *
 * MapLibre draws onto a canvas, but its markers are ordinary elements, so they
 * are found by role and name like every other control in this suite.
 */

const EINREICHER = konto('einreicher')

test.skip(EINREICHER === null, FEHLENDE_KONTEN)

async function neuerEntwurf(page: Page): Promise<string> {
  const antwort = await page.request.post('/api/v1/protokolle')
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()).id as string
}

/** Section 1 of a fresh draft, with the map loaded. */
async function abschnitt1MitKarte(page: Page) {
  await page.goto(`/protokolle/${await neuerEntwurf(page)}/abschnitt/1`)
  const flaeche = page.locator('.probestreckenkarte__flaeche')
  await flaeche.scrollIntoViewIfNeeded()
  await expect(flaeche).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 })
  return flaeche
}

test.beforeEach(async ({ page }) => {
  await anmelden(page, EINREICHER!)
})

test('eingetippte Koordinaten setzen die Marke', async ({ page }) => {
  await abschnitt1MitKarte(page)
  const marke = page.getByRole('img', { name: 'Untere Grenze' })
  await expect(marke).toHaveCount(0)

  await page.getByLabel('Untere Grenze, Rechtswert').fill('513224')
  await page.getByLabel('Untere Grenze, Hochwert').fill('5402838')
  await expect(marke).toBeVisible()

  // A number outside Baden-Wuerttemberg is the rule's to complain about, not a marker.
  await page.getByLabel('Untere Grenze, Rechtswert').fill('700000')
  await expect(marke).toHaveCount(0)
})

/* Wuerzburg sits inside the old rectangle, so only the real border, since feature
   18b, catches it. Kehl is on the French half of the Rhein, within the 2 km margin. */
test('ein Punkt ausserhalb des Landes bekommt eine Meldung und keine Marke', async ({ page }) => {
  await abschnitt1MitKarte(page)
  const marke = page.getByRole('img', { name: 'Untere Grenze' })
  const meldung = page.getByText('Dieser Punkt liegt mehr als 2 km außerhalb Baden-Württembergs.', {
    exact: false,
  })

  await page.getByLabel('Untere Grenze, Rechtswert').fill('566895')
  await page.getByLabel('Untere Grenze, Hochwert').fill('5515841')
  await page.getByLabel('Untere Grenze, Hochwert').blur()
  await expect(meldung).toHaveCount(2)
  await expect(marke).toHaveCount(0)

  await page.getByLabel('Untere Grenze, Rechtswert').fill('411403')
  await page.getByLabel('Untere Grenze, Hochwert').fill('5380353')
  await page.getByLabel('Untere Grenze, Hochwert').blur()
  await expect(meldung).toHaveCount(0)
  await expect(marke).toBeVisible()
})

test('ein Klick in die Karte fuellt die untere Grenze', async ({ page }) => {
  const flaeche = await abschnitt1MitKarte(page)
  const wahl = page.getByRole('group', { name: 'Ein Klick in die Karte setzt die' })
  await expect(wahl.getByRole('button', { name: 'Untere Grenze' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  /* The middle, because the map opens on all of Baden-Wuerttemberg and the
     middle is always inside it. Near an edge a click can land in France, which
     correctly fills the boxes and shows no marker. */
  await flaeche.click()

  await expect(page.getByRole('img', { name: 'Untere Grenze' })).toBeVisible()
  await expect(page.getByLabel('Untere Grenze, Rechtswert')).toHaveValue(/^\d{6}$/)
  await expect(page.getByLabel('Untere Grenze, Hochwert')).toHaveValue(/^\d{7}$/)
  await expect(page.getByLabel('Obere Grenze, Rechtswert')).toHaveValue('')
})

test('ohne Hintergrundkarte bleiben die Felder benutzbar', async ({ page }) => {
  await page.route('https://sgx.geodatenzentrum.de/**', (route) => route.abort())
  await page.goto(`/protokolle/${await neuerEntwurf(page)}/abschnitt/1`)

  await expect(
    page.getByText('Die Hintergrundkarte von basemap.de ließ sich nicht laden', { exact: false }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('group', { name: 'Ein Klick in die Karte setzt die' })).toHaveCount(0)

  await page.getByLabel('Untere Grenze, Rechtswert').fill('513224')
  await expect(page.getByLabel('Untere Grenze, Rechtswert')).toHaveValue('513224')
})
