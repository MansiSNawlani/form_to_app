import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto, ueberFormularAnmelden } from './konten'

/* The Pruefliste, proved against the running application.
 *
 * These are the checks feature 12b's spec asked for that a passing build cannot
 * answer: what the table draws, what the filters do to the address bar, what
 * happens on a page past the end, and what an account with no business here is
 * told. Written down rather than clicked through once, so the next feature to
 * touch this screen finds out if it broke something.
 *
 * Controls are addressed by their accessible role and name throughout. That is
 * deliberate and does double duty: a selector that cannot find "the combobox named
 * Status" is a control a screen reader cannot announce either, which is exactly
 * the fault the branch review found in the first version of this screen.
 */

const PRUEFER = konto('pruefer')
const EINREICHER = konto('einreicher')

test.skip(PRUEFER === null || EINREICHER === null, FEHLENDE_KONTEN)

/** What the endpoint says, so the tests assert against the data rather than a guess. */
async function gesamt(page: Page, abfrage: string): Promise<number> {
  const antwort = await page.request.get(`/api/v1/pruefliste?${abfrage}`)
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()).gesamt as number
}

test.describe('Die Pruefliste', () => {
  test.beforeEach(async ({ page }) => {
    await anmelden(page, PRUEFER!)
  })

  test('zeigt die offenen Protokolle und zaehlt sie richtig', async ({ page }) => {
    const offen = await gesamt(page, 'status=SUBMITTED&status=IN_REVIEW')

    await page.goto('/pruefung')

    await expect(page.getByRole('heading', { name: 'Prüfliste', level: 1 })).toBeVisible()
    await expect(page.getByText(`${offen} eingereichte Protokolle`)).toBeVisible()

    /* The count is the total over the filters, not the rows on this page. With a
       page size of 25 the two agree until there are 26 protocols, which is exactly
       when a wrong answer here would start to matter. */
    const zeilen = page.getByRole('table', { name: 'Eingereichte Protokolle' }).locator('tbody tr')
    await expect(zeilen).toHaveCount(Math.min(offen, 25))
  })

  test('zeigt niemals einen Entwurf, in keiner Filtereinstellung', async ({ page }) => {
    await page.goto('/pruefung')

    /* The single most important promise this screen makes. A draft is somebody's
       unfinished work and belongs to its owner alone, which is what CONTEXT.md
       says a draft is. */
    await expect(page.getByText('Entwurf', { exact: true })).toHaveCount(0)

    await page.getByRole('combobox', { name: 'Status' }).click()
    await page.getByRole('option', { name: 'Alle' }).click()

    await expect(page.getByText('Entwurf', { exact: true })).toHaveCount(0)
  })

  test('traegt jeden Filter in die Adresszeile ein und ueberlebt einen Reload', async ({
    page,
  }) => {
    await page.goto('/pruefung')

    await page.getByRole('combobox', { name: 'Anlass' }).click()
    await page.getByRole('option', { name: 'Fischmonitoring gemäß WRRL' }).click()

    await expect(page).toHaveURL(/anlass=wrrl/)

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Anlass' })).toContainText(
      'Fischmonitoring gemäß WRRL',
    )
  })

  /* One of the two bugs the branch review found. The reader has narrowed nothing,
     so they must not be told their filters match nothing, and must not be offered
     a reset for filters they never set. */
  test('zeigt hinter der letzten Seite die Blaetterung statt einer Leermeldung', async ({
    page,
  }) => {
    await page.goto('/pruefung?seite=99')

    await expect(page.getByText('Keine Protokolle zu diesen Filtern')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Filter zurücksetzen' })).toHaveCount(0)

    const blaetterung = page.getByRole('navigation', { name: 'Seiten der Prüfliste' })
    await expect(blaetterung).toBeVisible()
    await expect(blaetterung.getByRole('button', { name: 'Zurück' })).toBeEnabled()
  })

  test('bietet einen Weg zurueck, wenn die Filter nichts treffen', async ({ page }) => {
    await page.goto('/pruefung?jahr=2019')

    await expect(page.getByText('Keine Protokolle zu diesen Filtern')).toBeVisible()

    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click()

    await expect(page).toHaveURL(/\/pruefung$/)
    await expect(page.getByRole('table', { name: 'Eingereichte Protokolle' })).toBeVisible()
  })

  /* The other bug the review found. Back has to undo the last thing done to the
     list, not leave the screen, which is what a blanket history replace did. */
  test('macht mit dem Zurueck-Knopf die letzte Filteraenderung rueckgaengig', async ({
    page,
  }) => {
    await page.goto('/pruefung')

    await page.getByRole('combobox', { name: 'Sortierung' }).click()
    await page.getByRole('option', { name: 'Gewässer von A bis Z' }).click()
    await expect(page).toHaveURL(/sortierung=gewaesser/)

    await page.goBack()

    await expect(page).toHaveURL(/\/pruefung$/)
    await expect(page.getByRole('heading', { name: 'Prüfliste', level: 1 })).toBeVisible()
  })

  test('fuehrt aus einer Zeile in die Pruefung des Protokolls', async ({ page }) => {
    await page.goto('/pruefung')

    await page.getByRole('link', { name: /^Prüfen/ }).first().click()

    await expect(page).toHaveURL(/\/protokolle\/[0-9a-f-]+\/pruefung$/)
  })

  /* Every control reachable and announceable. The four dropdowns are the reason
     this test exists: in a MUI Select the operated element is a div with
     role="combobox", so an id passed the ordinary way names a hidden input and
     leaves the real control nameless. Naming them here is what keeps that fixed. */
  test('benennt jedes Bedienelement der Filterleiste', async ({ page }) => {
    await page.goto('/pruefung')

    await expect(page.getByRole('searchbox', { name: 'Suche' })).toBeVisible()
    for (const name of ['Status', 'Jahr', 'Anlass', 'Sortierung']) {
      await expect(page.getByRole('combobox', { name })).toBeVisible()
    }
  })

  /* Every dropdown says what it is currently set to, including when that is
     "everything". The first version of this screen drew Jahr and Anlass as empty
     boxes, because a MUI Select needs displayEmpty to render the entry sitting at
     the empty value, and an unset filter read as a control that had failed to
     load. Neither the unit tests nor the other tests here noticed; looking at it
     did. */
  /* The backend unreachable, without stopping anything: the request is blocked in
     the browser, which is the same thing as far as this screen can tell. Driving
     it from here rather than from docker means the test runs on any machine and
     leaves nothing stopped behind it. */
  test('erklaert einen Fehlschlag und erholt sich beim zweiten Versuch', async ({ page }) => {
    await page.route('**/api/v1/pruefliste*', (route) => route.abort())
    await page.goto('/pruefung')

    await expect(page.getByText('Die Prüfliste konnte nicht geladen werden')).toBeVisible({
      timeout: 15_000,
    })

    await page.unroute('**/api/v1/pruefliste*')
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()

    await expect(page.getByRole('table', { name: 'Eingereichte Protokolle' })).toBeVisible()
    await expect(page.getByText('Die Prüfliste konnte nicht geladen werden')).toHaveCount(0)
  })

  /* The filter bar walked with the keyboard alone, in the order it is drawn. A
     control that is labelled but unreachable is still a control somebody cannot
     use, so naming them is not on its own enough. */
  test('laesst sich mit der Tastatur allein bedienen', async ({ page }) => {
    await page.goto('/pruefung')
    await page.getByRole('searchbox', { name: 'Suche' }).focus()

    for (const erwartet of ['Status', 'Jahr', 'Anlass', 'Sortierung']) {
      await page.keyboard.press('Tab')
      await expect(page.locator(':focus')).toHaveAccessibleName(erwartet)
    }

    /* On from the filter bar into the table, which is where the reader is going.
       The first Pruefen carries the water in its accessible name, so twenty-five
       identical buttons are told apart by a screen reader. */
    let gefunden = false
    for (let schritt = 0; schritt < 12 && !gefunden; schritt += 1) {
      await page.keyboard.press('Tab')
      gefunden = /^Prüfen/.test((await page.locator(':focus').getAttribute('aria-label')) ?? '')
        || /^Prüfen/.test(await page.locator(':focus').innerText().catch(() => ''))
    }
    expect(gefunden).toBe(true)
  })

  test('sagt bei jedem Filter, worauf er gerade steht', async ({ page }) => {
    await page.goto('/pruefung')

    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveText('Offen')
    await expect(page.getByRole('combobox', { name: 'Jahr' })).toHaveText('Alle')
    await expect(page.getByRole('combobox', { name: 'Anlass' })).toHaveText('Alle')
    await expect(page.getByRole('combobox', { name: 'Sortierung' })).toHaveText(
      'Längste Wartezeit zuerst',
    )
  })
})

test.describe('Wer die Pruefliste sehen darf', () => {
  test('weist ein Einreicher-Konto mit einem Weg nach vorn ab', async ({ page }) => {
    await anmelden(page, EINREICHER!)
    await page.goto('/pruefung')

    await expect(page.getByText('Die Prüfliste ist für Mitarbeitende der FFS')).toBeVisible()

    /* Not an error, so no retry: trying again would only produce the same refusal
       more slowly. What it offers instead is somewhere this account can go. */
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Zu meinen Protokollen' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('zeigt den Pruefliste-Link nur den FFS-Konten', async ({ page }) => {
    await anmelden(page, EINREICHER!)
    await page.goto('/')
    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await expect(navigation.getByRole('link', { name: 'Meine Protokolle' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Prüfliste' })).toHaveCount(0)

    await page.context().clearCookies()
    await anmelden(page, PRUEFER!)
    await page.goto('/')
    await expect(navigation.getByRole('link', { name: 'Prüfliste' })).toBeVisible()
  })
})

test.describe('Wo ein Konto nach der Anmeldung landet', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/anmeldung')
  })

  test('bringt ein FFS-Konto auf die Pruefliste', async ({ page }) => {
    await ueberFormularAnmelden(page, PRUEFER!)
    await expect(page).toHaveURL(/\/pruefung$/)
  })

  test('bringt ein Einreicher-Konto auf die eigenen Protokolle', async ({ page }) => {
    await ueberFormularAnmelden(page, EINREICHER!)
    await expect(page).toHaveURL(/\/$/)
  })
})
