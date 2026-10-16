import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* Where each boundary point lies on the water, feature 18d.
 *
 * What is decided where is proved beside it: snapping and the reason rule in
 * backend/app/gewaessernetz/einrasten_test.py and absenden_test.py, what an
 * answer writes into the draft in src/protokoll/karte/einrasten.test.ts. What
 * only a browser can answer is whether the request, the ring on the map, the
 * distance line, the button and the reason box are wired together.
 *
 * Needs a release of the network loaded, like gewaessersuche.spec.ts, and skips
 * with a sentence saying how to load one otherwise.
 */

const EINREICHER = konto('einreicher')

test.skip(EINREICHER === null, FEHLENDE_KONTEN)

const KEIN_NETZ =
  'Kein Gewässernetz geladen. befischung gewaessernetz laden ausführen, siehe AGENTS.md,' +
  ' Abschnitt Commands.'

/* In Pforzheim: a few metres north of the Enz, and 800 m from the nearest water
   on the slope above the town. Both checked against the 2025-05-01 release. */
const AN_DER_ENZ = { rw: '476414', hw: '5415203' }
const WEIT_WEG = { rw: '476000', hw: '5416000' }

async function neuerEntwurf(page: Page): Promise<string> {
  const antwort = await page.request.post('/api/v1/protokolle')
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()).id as string
}

async function gespeichert(page: Page, id: string) {
  const antwort = await page.request.get(`/api/v1/protokolle/${id}`)
  return (await antwort.json()).antworten?.probestrecke ?? {}
}

async function untereGrenze(page: Page, punkt: { rw: string; hw: string }) {
  await page.getByLabel('Untere Grenze, Rechtswert').fill(punkt.rw)
  await page.getByLabel('Untere Grenze, Hochwert').fill(punkt.hw)
  await page.getByLabel('Untere Grenze, Hochwert').blur()
}

test.beforeEach(async ({ page }) => {
  await anmelden(page, EINREICHER!)
  const probe = await page.request.get(
    `/api/v1/gewaessernetz/einrasten?rw=${AN_DER_ENZ.rw}&hw=${AN_DER_ENZ.hw}`,
  )
  test.skip((await probe.json()).stand === null, KEIN_NETZ)
})

test('ein Punkt neben der Enz zeigt die Stelle am Gewässer', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  await untereGrenze(page, AN_DER_ENZ)

  await expect(page.getByText(/^Untere Grenze: \d+ m vom Gewässer Enz$/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Untere Grenze am Gewässer' })).toBeVisible()
  await expect.poll(async () => (await gespeichert(page, id)).eingerastet_name_unten).toBe('Enz')

  // The button moves the typed point onto the water, and the distance goes to 0.
  const knopf = page.getByRole('button', { name: 'Untere Grenze auf das Gewässer setzen' })
  await knopf.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Untere Grenze: 0 m vom Gewässer Enz')).toBeVisible()
  await expect(knopf).toHaveCount(0)
  const amWasser = await gespeichert(page, id)
  await expect(page.getByLabel('Untere Grenze, Rechtswert')).toHaveValue(
    amWasser.eingerastet_rw_unten,
  )
})

test('ein ferner Punkt verlangt eine Begründung, wird aber nicht abgelehnt', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  await untereGrenze(page, WEIT_WEG)
  await expect(page.getByRole('alert').filter({ hasText: 'mehr als 100 m' })).toBeVisible()
  const begruendung = page.getByLabel('Begründung für den Abstand zum Gewässer')
  await expect(begruendung).toBeVisible()
  await expect
    .poll(async () => (await gespeichert(page, id)).eingerastet_rw_unten)
    .toMatch(/^\d+$/)

  // The empty draft is refused for many reasons; the reason box is one of them.
  await page.goto(`/protokolle/${id}/abschnitt/7`)
  await page.getByRole('button', { name: 'Protokoll absenden' }).click()
  const [abgelehnt] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/protokolle/${id}/absenden`)),
    page.getByRole('dialog').getByRole('button', { name: 'Jetzt absenden' }).click(),
  ])
  expect(abgelehnt.status()).toBe(422)
  const verstoesse = (await abgelehnt.json()).verstoesse as { pfad: string }[]
  expect(verstoesse.map((v) => v.pfad)).toContain('probestrecke.abstand_begruendung')
  // The coordinates themselves are not what is refused.
  expect(verstoesse.map((v) => v.pfad)).not.toContain('probestrecke.utm_rw_unten')

  await page.goto(`/protokolle/${id}/abschnitt/1`)
  await expect(begruendung).toHaveAttribute('aria-invalid', 'true')
  await expect(begruendung).toHaveAccessibleDescription(/mehr als 100 m vom Gewässer entfernt/)

  await begruendung.fill('Der Graben fehlt in der amtlichen Karte.')
  await begruendung.blur()
  await expect(begruendung).not.toHaveAttribute('aria-invalid', 'true')
})
