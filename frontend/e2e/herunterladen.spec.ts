import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* Downloading a protocol as a PDF, proved against the running application.
 *
 * What a passing build cannot answer: that the button is on the page, that a
 * real browser actually saves a file when it is pressed, and that the file is
 * called what the backend said it should be called. The document's contents are
 * proved in app/protokolle/ausgabe/dokument_test.py, which can read the text
 * back out; here the question is only whether the browser end of it works.
 *
 * Controls are addressed by their accessible role and name, as the whole suite
 * does, so a button a screen reader could not announce would fail here too.
 */

const EINREICHER = konto('einreicher')

test.skip(EINREICHER === null || konto('pruefer') === null, FEHLENDE_KONTEN)

/** A fresh draft through the API, so the test owns what it opens. */
async function neuerEntwurf(page: Page): Promise<string> {
  const antwort = await page.request.post('/api/v1/protokolle')
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()).id as string
}

test.beforeEach(async ({ page }) => {
  await anmelden(page, EINREICHER!)
})

test('der Entwurf laesst sich als PDF herunterladen', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  const knopf = page.getByRole('button', { name: 'Als PDF herunterladen' })
  await expect(knopf).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), knopf.click()])

  expect(download.suggestedFilename()).toMatch(/^Protokoll.*\.pdf$/)
})

test('die gespeicherte Datei ist wirklich eine PDF', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Als PDF herunterladen' }).click(),
  ])

  /* The bytes that actually landed on disk, not a second request to the
     endpoint. What is being proved here is the browser half: that the blob
     survives the object URL and the download attribute intact. Asking the API
     again would prove the API, which app/api/ausgabe_test.py already does. */
  const datei = await download.path()
  expect(datei).not.toBeNull()
  const inhalt = await readFile(datei!)
  expect(inhalt.subarray(0, 5).toString()).toBe('%PDF-')
  expect(inhalt.byteLength).toBeGreaterThan(1000)
})

test('der Knopf ist mit der Tastatur erreichbar', async ({ page }) => {
  const id = await neuerEntwurf(page)
  await page.goto(`/protokolle/${id}/abschnitt/1`)

  const knopf = page.getByRole('button', { name: 'Als PDF herunterladen' })
  await knopf.focus()
  await expect(knopf).toBeFocused()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Enter'),
  ])

  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})
