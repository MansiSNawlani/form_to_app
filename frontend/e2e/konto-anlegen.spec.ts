import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* Ein Konto anlegen, proved against the running application.
 *
 * These are the checks feature 16c's spec asked for that a passing build cannot
 * answer: that the form reaches the real endpoint, that a new account turns up in
 * the list without a reload, that the region field appears with the role that
 * needs it, that a duplicate address is refused under the address rather than
 * somewhere else, and that somebody without the role is turned away in words.
 *
 * Controls are addressed by their accessible role and name throughout, which does
 * double duty: a selector that cannot find "the textbox named Passwort" is a
 * control a screen reader cannot announce either.
 *
 * **Every account these tests make carries a fresh random address**, so the suite
 * can be run twice against the same database without the second run tripping over
 * the first. Accounts are never deleted in this application, by decision in
 * feature 2a, so a run leaves rows behind on the development database on purpose.
 */

const ADMIN = konto('admin')
const PRUEFER = konto('pruefer')

test.skip(ADMIN === null || PRUEFER === null, FEHLENDE_KONTEN)

const ADRESSE = '/verwaltung/benutzer/neu'
const LISTE = '/verwaltung/benutzer'

/* Long enough for the backend's twelve character minimum, and not a real
   password: these accounts exist on a throwaway development database. */
const PASSWORT = 'ein-langes-testpasswort'

function neueAdresse(): string {
  return `e2e16c-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.de`
}

async function formularAusfuellen(page: Page, email: string): Promise<void> {
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT)
}

test.describe('Ein Konto anlegen', () => {
  test('legt ein Konto an und zeigt die Zugangsdaten', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    const email = neueAdresse()
    await formularAusfuellen(page, email)
    await page.getByRole('checkbox', { name: 'Einreicher' }).check()
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    /* The panel, and the two things the administrator has to pass on. The
       password is shown deliberately: reading it out is the only reason this
       panel exists. */
    await expect(page.getByRole('status')).toContainText(email)
    await expect(page.getByText(PASSWORT, { exact: true })).toBeVisible()

    /* And it says the thing that has to be exactly true: nobody can change their
       own password in this application yet. */
    await expect(page.getByText(/kann ihr Passwort noch nicht selbst ändern/)).toBeVisible()

    /* The list shows it without a reload, which is what the cache invalidation in
       useKontoAnlegen is for. */
    await page.getByRole('link', { name: 'Zur Benutzerliste' }).click()
    /* exact, since feature 16d gave each row an action whose accessible name also
       carries the address ("Konto x@y.de aendern"), so a loose match finds two
       cells in the same row. */
    await expect(page.getByRole('cell', { name: email, exact: true })).toBeVisible()
  })

  test('das neue Konto kann sich anmelden', async ({ page, browser }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    const email = neueAdresse()
    await formularAusfuellen(page, email)
    await page.getByRole('checkbox', { name: 'Einreicher' }).check()
    await page.getByRole('button', { name: 'Konto anlegen' }).click()
    await expect(page.getByRole('status')).toContainText(email)

    /* The proof that the password shown is the password stored. A fresh context,
       because the first one already holds the administrator's session cookie. */
    const zweiter = await browser.newContext()
    try {
      const seite = await zweiter.newPage()
      await anmelden(seite, { email, passwort: PASSWORT })
      await seite.goto('/')
      await expect(seite.getByRole('heading', { level: 1 })).toBeVisible()
    } finally {
      await zweiter.close()
    }
  })

  test('das Regierungspraesidium erscheint mit seiner Rolle', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    const feld = page.getByRole('combobox', { name: 'Regierungspräsidium' })
    await expect(feld).toBeHidden()

    await page.getByRole('checkbox', { name: 'Regierungspräsidium' }).check()
    await expect(feld).toBeVisible()

    /* The four regions out of the list extracted from the legacy form. Karlsruhe
       is number 1 there, which feature 16c step 1 made the command line agree
       with. */
    await feld.click()
    await expect(page.getByRole('option', { name: 'Regierungspräsidium Karlsruhe' })).toBeVisible()
    await page.getByRole('option', { name: 'Regierungspräsidium Freiburg' }).click()

    /* Unticking the role takes the field away and forgets the answer, so ticking
       it again does not offer a region somebody has not chosen this time. */
    await page.getByRole('checkbox', { name: 'Regierungspräsidium' }).uncheck()
    await expect(feld).toBeHidden()
    await page.getByRole('checkbox', { name: 'Regierungspräsidium' }).check()
    await expect(feld).toHaveText('Bitte wählen')
  })

  test('eine bereits vergebene Adresse wird am Feld gemeldet', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    /* The administrator's own address, which certainly exists. */
    const vergeben = ADMIN!.email
    await formularAusfuellen(page, vergeben)
    await page.getByRole('checkbox', { name: 'Einreicher' }).check()
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    /* The backend's own sentence, shown as it arrives. It does not repeat the
       address, and does not need to: it is sitting under the field holding it.
       What it must do is point somewhere the reader can act, which is the list,
       because the usual cause is an account that exists but is locked. */
    const meldung = page.getByRole('alert')
    await expect(meldung).toBeVisible()
    await expect(meldung).toContainText('bereits ein Konto')
    await expect(meldung).toContainText('Benutzerliste')

    /* Nothing is cleared by a refusal. Somebody who mistyped one character
       changes it and presses the button again. */
    await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(vergeben)
    await expect(page.getByLabel('Passwort', { exact: true })).toHaveValue(PASSWORT)

    /* And the refusal goes away as the thing it is about is corrected, rather
       than sitting there still saying the address is taken while a free one is
       on screen. It stayed until the next submit when this was first built. */
    await page.getByLabel('E-Mail-Adresse').fill(neueAdresse())
    await expect(meldung).toBeHidden()
  })

  test('ein zu kurzes Passwort wird am Feld gemeldet', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    await page.getByLabel('E-Mail-Adresse').fill(neueAdresse())
    await page.getByLabel('Passwort', { exact: true }).fill('zu-kurz')
    await page.getByRole('checkbox', { name: 'Einreicher' }).check()
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    await expect(page.getByRole('alert')).toContainText('12 Zeichen')
  })

  test('ohne Rolle wird nichts gesendet', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    await formularAusfuellen(page, neueAdresse())
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    await expect(page.getByRole('alert')).toContainText('mindestens eine Rolle')
  })

  test('das Passwort laesst sich anzeigen und wieder verbergen', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    const feld = page.getByLabel('Passwort', { exact: true })
    await feld.fill(PASSWORT)
    await expect(feld).toHaveAttribute('type', 'password')

    await page.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(feld).toHaveAttribute('type', 'text')

    await page.getByRole('button', { name: 'Verbergen' }).click()
    await expect(feld).toHaveAttribute('type', 'password')
  })

  test('ein Pruefer wird in Worten abgewiesen', async ({ page }) => {
    await anmelden(page, PRUEFER!)
    await page.goto(ADRESSE)

    await formularAusfuellen(page, neueAdresse())
    await page.getByRole('checkbox', { name: 'Einreicher' }).check()
    await page.getByRole('button', { name: 'Konto anlegen' }).click()

    /* The refusal replaces the page: it is about the caller, not about anything
       typed, and trying again would only produce it more slowly. So it names who
       the page is for and offers a way onward rather than a retry. */
    await expect(page.getByRole('heading', { name: /nicht für Ihr Konto/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zu meinen Protokollen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeHidden()
  })

  test('der Weg zurueck zur Liste bricht nichts ab', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await page.goto(ADRESSE)

    await page.getByRole('link', { name: 'Abbrechen' }).click()
    await expect(page).toHaveURL(new RegExp(`${LISTE}$`))
  })
})
