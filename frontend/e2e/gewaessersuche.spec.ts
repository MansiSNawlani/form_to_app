import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* The Gewaesser field searching LUBW's official network, feature 18c.
 *
 * What is decided where is proved beside it: the search in
 * backend/app/gewaessernetz/suche_test.py, what a pick writes in
 * src/protokoll/gewaessernetz/auswahl.test.ts. What only a browser can answer is
 * whether the list, the five Vorfluter boxes, the identifier line and the
 * automatic save are wired together.
 *
 * Needs a release of the network loaded into the development database, which a
 * fresh checkout does not have. Without one the search answers with no release,
 * and this skips with a sentence saying how to load one rather than failing.
 */

const EINREICHER = konto('einreicher')

test.skip(EINREICHER === null, FEHLENDE_KONTEN)

const KEIN_NETZ =
  'Kein Gewässernetz geladen. befischung gewaessernetz laden ausführen, siehe AGENTS.md,' +
  ' Abschnitt Commands.'

// The Neckar flows straight into the Rhein: a one-link chain, and a stable name.
const NECKAR = '2380000000000'

async function neuerEntwurf(page: Page): Promise<string> {
  const antwort = await page.request.post('/api/v1/protokolle')
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()).id as string
}

async function gespeichert(page: Page, id: string) {
  const antwort = await page.request.get(`/api/v1/protokolle/${id}`)
  return (await antwort.json()).antworten?.probestrecke?.gewaesser ?? {}
}

test.beforeEach(async ({ page }) => {
  await anmelden(page, EINREICHER!)
  const suche = await page.request.get('/api/v1/gewaessernetz/suche?q=Neckar')
  test.skip((await suche.json()).stand === null, KEIN_NETZ)
})

test('ein gewähltes Gewässer bringt Kennung und Vorfluterkette mit', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)
  const feld = page.getByRole('combobox', { name: 'Gewässer', exact: true })

  // Something already in the chain, so the pick has to replace it.
  await page.getByLabel(/^Vorfluter 2(?!\d)/).fill('Irgendwas')

  await feld.fill('Neckar')
  await page.getByRole('option', { name: /^Neckar\s*fließt in Rhein/ }).click()

  await expect(feld).toHaveValue('Neckar')
  await expect(page.getByLabel(/^Vorfluter 1(?!\d)/)).toHaveValue('Rhein')
  await expect(page.getByLabel(/^Vorfluter 2(?!\d)/)).toHaveValue('')
  const zeile = page.getByText(`Amtliche Kennung: ${NECKAR} (AWGN `, { exact: false })
  await expect(zeile).toBeVisible()
  await expect(feld).toHaveAttribute('aria-describedby', /gewaessername-kennung/)

  // Saved, and still there after a reload.
  await expect.poll(async () => (await gespeichert(page, id)).amtliche_id).toBe(NECKAR)
  await page.reload()
  await expect(zeile).toBeVisible()
})

test('den Namen zu überschreiben nimmt die Kennung zurück', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)
  const feld = page.getByRole('combobox', { name: 'Gewässer', exact: true })

  await feld.fill('Neckar')
  await page.getByRole('option', { name: /^Neckar\s*fließt in Rhein/ }).click()
  await expect.poll(async () => (await gespeichert(page, id)).amtliche_id).toBe(NECKAR)

  await feld.press('End')
  await feld.pressSequentially('kanal')

  await expect(page.getByText('Amtliche Kennung:', { exact: false })).toHaveCount(0)
  await expect
    .poll(async () => {
      const gewaesser = await gespeichert(page, id)
      return [gewaesser.gewaessername, gewaesser.amtliche_id, gewaesser.gis_dataset_version]
    })
    .toEqual(['Neckarkanal', '', ''])
})

/* The control changed from a plain text box to a search in 18c, so the mark the
   fix of 2026-10-15 puts on a refused field is held here for this one too. */
test('ein leer abgesendetes Gewässer ist markiert, bis ein Name drinsteht', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/7`)
  await page.getByRole('button', { name: 'Protokoll absenden' }).click()
  const [abgelehnt] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/protokolle/${id}/absenden`)),
    page.getByRole('dialog').getByRole('button', { name: 'Jetzt absenden' }).click(),
  ])
  expect(abgelehnt.status()).toBe(422)

  await page.goto(`/protokolle/${id}/abschnitt/1`)
  const feld = page.getByRole('combobox', { name: 'Gewässer', exact: true })
  await expect(feld).toHaveAttribute('aria-invalid', 'true')
  await expect(feld).toHaveAccessibleDescription(/zum Absenden gebraucht/)

  await feld.fill('Dorfbach')
  await expect(feld).not.toHaveAttribute('aria-invalid', 'true')
})
