import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* Ein Konto aendern, proved against the running application.
 *
 * These are the checks feature 16d's spec asked for that a passing build cannot
 * answer: that each card reaches its real endpoint, that a change turns up in the
 * list without a reload, that a locked account really is refused at sign-in, that
 * a new password really is the one stored, and that the two things nobody may do
 * to their own account are said before they are attempted rather than after.
 *
 * Controls are addressed by their accessible role and name throughout, which does
 * double duty: a selector that cannot find "the button named Konto sperren" is a
 * control a screen reader cannot announce either.
 *
 * **These tests never touch the three accounts the other specs sign in as.** Each
 * one creates a throwaway account of its own with a random address and changes
 * that. Renaming E2E_EMAIL_EINREICHER here would break every other suite in the
 * repository, and the failure would look like something else entirely.
 */

const ADMIN = konto('admin')
const PRUEFER = konto('pruefer')

test.skip(ADMIN === null || PRUEFER === null, FEHLENDE_KONTEN)

const LISTE = '/verwaltung/benutzer'
const NEU = '/verwaltung/benutzer/neu'

/* Long enough for the backend's twelve character minimum, and not a real
   password: these accounts exist on a throwaway development database. */
const PASSWORT = 'ein-langes-testpasswort'
const NEUES_PASSWORT = 'ein-anderes-langes-passwort'

function neueAdresse(): string {
  return `e2e16d-${Date.now()}-${Math.floor(Math.random() * 1000)}@test.de`
}

/* A throwaway account to experiment on, made through the screen that makes them.
 *
 * Through the browser rather than the API, so a run also proves the two screens
 * still fit together: 16c creates the account, and the list's own button is what
 * gets to 16d's page.
 */
async function legeKontoAn(page: Page, rolle = 'Einreicher'): Promise<string> {
  const email = neueAdresse()

  await page.goto(NEU)
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort', { exact: true }).fill(PASSWORT)
  await page.getByRole('checkbox', { name: rolle, exact: true }).check()

  /* The coupling, on the screen that creates accounts: a regional role with no
     number is refused, so an account cannot be born in that state. This is why
     the edit test below starts from an account that already carries a region,
     which is the case a create form cannot produce and this feature can. */
  if (rolle === 'Regierungspräsidium') {
    await page.getByRole('combobox', { name: 'Regierungspräsidium' }).click()
    await page.getByRole('option', { name: 'Regierungspräsidium Karlsruhe' }).click()
  }

  await page.getByRole('button', { name: 'Konto anlegen' }).click()
  await expect(page.getByRole('status')).toContainText(email)

  return email
}

/* The way back, which is the breadcrumb above the heading rather than a button
   among the save actions.
 *
 * Scoped to its own nav landmark on purpose: the header carries a
 * "Benutzerverwaltung" link to the same place, so the name alone names two
 * controls. That the crumb needs scoping is the point of it being a landmark. */
function krume(page: Page) {
  return page
    .getByRole('navigation', { name: 'Sie sind hier' })
    .getByRole('link', { name: 'Benutzerverwaltung' })
}

/** From the list to that account's own page, the way a person gets there. */
async function oeffne(page: Page, email: string): Promise<void> {
  await page.goto(LISTE)
  /* A link, not a button. The row's action is a MUI Button rendered as a router
     Link, so what a screen reader and Playwright both see is an anchor. */
  await page.getByRole('link', { name: `Konto ${email} ändern` }).click()
  await expect(page.getByRole('heading', { level: 1, name: email })).toBeVisible()
}

test.describe('Ein Konto aendern', () => {
  test('aendert die Adresse und zeigt sie in der Liste', async ({ page, browser }) => {
    await anmelden(page, ADMIN!)
    const alt = await legeKontoAn(page)
    await oeffne(page, alt)

    const neu = neueAdresse()
    await page.getByLabel('E-Mail-Adresse').fill(neu)
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()

    /* The heading follows the account, which is the confirmation that the save
       took: the page is named after the address it is about. */
    await expect(page.getByRole('heading', { level: 1, name: neu })).toBeVisible()

    /* And the list agrees without a reload, which is what the cache invalidation
       in useKontoAendern is for. */
    await krume(page).click()
    /* exact, because the row's action cell carries the address in its accessible
       name as well ("Konto x@y.de aendern"), which is the whole point of that
       label: twenty buttons all announcing "Aendern" name nothing. */
    await expect(page.getByRole('cell', { name: neu, exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: alt, exact: true })).toBeHidden()

    /* The address is the login identifier, so the change has to have reached the
       thing that actually signs people in. A fresh context, because the first one
       already holds the administrator's session cookie. */
    const zweiter = await browser.newContext()
    try {
      const seite = await zweiter.newPage()
      await anmelden(seite, { email: neu, passwort: PASSWORT })
      await seite.goto('/')
      await expect(seite.getByRole('heading', { level: 1 })).toBeVisible()
    } finally {
      await zweiter.close()
    }
  })

  test('nimmt eine Rolle hinzu', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    await page.getByRole('checkbox', { name: 'Prüfer', exact: true }).check()
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByRole('status')).toContainText('gespeichert')

    await krume(page).click()
    const zeile = page.getByRole('row', { name: new RegExp(email) })
    await expect(zeile).toContainText('Prüfer')
    await expect(zeile).toContainText('Einreicher')
  })

  test('sagt es, wenn es nichts zu speichern gibt', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    /* Nothing touched, so nothing is sent. Not an error: nothing went wrong,
       there was simply no request to make. */
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByRole('status')).toContainText('nichts zu speichern')
  })

  test('das Regierungspraesidium kommt und geht mit seiner Rolle', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page, 'Regierungspräsidium')
    await oeffne(page, email)

    /* The account was created as Karlsruhe, so this is the case a create form
       cannot reach: a region that is already set and is being changed. */
    const feld = page.getByRole('combobox', { name: 'Regierungspräsidium' })
    await expect(feld).toHaveText('Regierungspräsidium Karlsruhe')

    await feld.click()
    await page.getByRole('option', { name: 'Regierungspräsidium Freiburg' }).click()
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByRole('status')).toContainText('gespeichert')

    await krume(page).click()
    await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Freiburg')

    /* The one that has to be right: taking the role away has to clear the number
       in the same request, because the backend refuses a leftover number rather
       than tidying it up. Before kontoAenderung did this, the save came back
       refused. */
    await oeffne(page, email)
    /* Another role first. An account must hold at least one, so unticking the only
       one it has is refused before any request is made, which is the app being
       right and this test being wrong the first time it was written. Ticking
       Einreicher in the same save also makes this the case that matters: the roles
       and the region change together, in one request. */
    await page.getByRole('checkbox', { name: 'Einreicher', exact: true }).check()
    await page.getByRole('checkbox', { name: 'Regierungspräsidium' }).uncheck()
    await expect(feld).toBeHidden()
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByRole('status')).toContainText('gespeichert')

    await krume(page).click()
    await expect(page.getByRole('row', { name: new RegExp(email) })).not.toContainText('Freiburg')
  })

  test('sperrt ein Konto und gibt es wieder frei', async ({ page, browser }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    /* The dialog names the account, because somebody with three of these screens
       open has only the address to tell them apart. Cancelling changes nothing. */
    await page.getByRole('button', { name: 'Konto sperren', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(email)
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    /* Gone, not merely closing. MUI animates the dialog out, so reopening while
       the old one is still in the DOM gives the next locator a node that detaches
       under it. */
    await expect(dialog).toBeHidden()
    await expect(page.getByText(/ist aktiv/)).toBeVisible()

    await page.getByRole('button', { name: 'Konto sperren', exact: true }).click()
    /* Waited for rather than clicked straight away: MUI's Dialog animates in, and
       a click that lands mid-transition is retried against an element that has
       already been detached. */
    const zweiteFrage = page.getByRole('dialog')
    await expect(zweiteFrage).toBeVisible()
    await zweiteFrage.getByRole('button', { name: 'Konto sperren' }).click()
    await expect(page.getByText(/ist gesperrt/)).toBeVisible()

    /* A lock takes effect at once, because aktueller_benutzer loads the account
       row on every single request. This is the check the password card's wording
       leans on. */
    const zweiter = await browser.newContext()
    try {
      const seite = await zweiter.newPage()
      const antwort = await seite.request.post('/api/v1/anmeldung', {
        data: { email, passwort: PASSWORT },
      })
      expect(antwort.ok()).toBe(false)
    } finally {
      await zweiter.close()
    }

    await krume(page).click()
    await expect(page.getByRole('row', { name: new RegExp(email) })).toContainText('Gesperrt')

    /* And back again. Unlocking asks nothing: it gives an account its access back,
       which is neither destructive nor hard to undo. */
    await oeffne(page, email)
    await page.getByRole('button', { name: 'Konto entsperren' }).click()
    await expect(page.getByText(/ist aktiv/)).toBeVisible()
  })

  test('setzt ein neues Passwort, und das alte gilt nicht mehr', async ({ page, browser }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    await page.getByLabel('Neues Passwort').fill(NEUES_PASSWORT)
    await page.getByRole('button', { name: 'Neues Passwort setzen' }).click()

    /* The panel, and the two things the administrator now has to pass on. The
       password is shown deliberately: reading it out is the only reason the panel
       exists. */
    await expect(page.getByRole('status')).toContainText(email)
    await expect(page.getByText(NEUES_PASSWORT, { exact: true })).toBeVisible()

    /* And it says the two things that have to be exactly true rather than
       reassuring: a running session is not ended, and nobody can change their own
       password in this application yet. */
    await expect(page.getByText(/acht Stunden/)).toBeVisible()
    await expect(page.getByText(/nicht selbst ändern/)).toBeVisible()

    const zweiter = await browser.newContext()
    try {
      const seite = await zweiter.newPage()
      const alt = await seite.request.post('/api/v1/anmeldung', {
        data: { email, passwort: PASSWORT },
      })
      expect(alt.ok()).toBe(false)

      await anmelden(seite, { email, passwort: NEUES_PASSWORT })
      await seite.goto('/')
      await expect(seite.getByRole('heading', { level: 1 })).toBeVisible()
    } finally {
      await zweiter.close()
    }

    /* Leaving the page loses it, which is correct: from then on the copy that
       matters belongs to its owner. */
    await page.reload()
    await expect(page.getByText(NEUES_PASSWORT, { exact: true })).toBeHidden()
    await expect(page.getByLabel('Neues Passwort')).toHaveValue('')
  })

  test('ein zu kurzes Passwort wird am Feld gemeldet', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    await page.getByLabel('Neues Passwort').fill('zu-kurz')
    await page.getByRole('button', { name: 'Neues Passwort setzen' }).click()

    await expect(page.getByRole('alert')).toContainText('12 Zeichen')
  })

  test('eine vergebene Adresse wird am Feld gemeldet und verschwindet wieder', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await oeffne(page, email)

    await page.getByLabel('E-Mail-Adresse').fill(ADMIN!.email)
    await page.getByRole('button', { name: 'Änderungen speichern' }).click()

    const meldung = page.getByRole('alert')
    await expect(meldung).toContainText('bereits ein Konto')

    /* Nothing is cleared by a refusal, and the sentence goes as soon as the thing
       it is about is corrected rather than waiting for the next submit. */
    await page.getByLabel('E-Mail-Adresse').fill(neueAdresse())
    await expect(meldung).toBeHidden()
  })

  test('das eigene Konto laesst sich nicht entmachten', async ({ page }) => {
    await anmelden(page, ADMIN!)
    await oeffne(page, ADMIN!.email)

    /* Said rather than only marked, because which account is yours decides what
       this screen will not let you do to it. */
    await expect(page.getByText('Das ist Ihr eigenes Konto.')).toBeVisible()

    /* No lock button at all, and a sentence in its place. An action that can only
       ever fail is worse than no action. */
    await expect(page.getByRole('button', { name: 'Konto sperren', exact: true })).toBeHidden()
    await expect(page.getByText(/eigenes Konto können Sie nicht sperren/)).toBeVisible()

    /* And the role rule is said as the box is unticked, before the button is
       pressed, rather than after a wasted round trip. */
    /* "Administration" is what common.rollen calls SUPER_ADMIN, and the sentence
       this uncheck produces has to use the same word: a message naming a role by a
       name that appears nowhere on the screen is a message about nothing. */
    await page.getByRole('checkbox', { name: 'Administration', exact: true }).uncheck()
    await expect(page.getByText(/nicht selbst entziehen/)).toBeVisible()
  })

  test('eine unbekannte Adresse sagt, dass es das Konto nicht gibt', async ({ page }) => {
    await anmelden(page, ADMIN!)

    /* A well-formed uuid that names nothing, so the answer comes from the backend
       rather than from a route that failed to match. */
    await page.goto('/verwaltung/benutzer/00000000-0000-4000-8000-000000000000')

    await expect(page.getByRole('heading', { name: /Konto gibt es nicht/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zur Benutzerliste' })).toBeVisible()
    /* Not an error to retry: an id that names no account will name none however
       many times it is asked for. */
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeHidden()
  })

  test('ein Pruefer wird in Worten abgewiesen', async ({ page }) => {
    await anmelden(page, ADMIN!)
    const email = await legeKontoAn(page)
    await page.goto(LISTE)
    const adresse = await page
      .getByRole('link', { name: `Konto ${email} ändern` })
      .getAttribute('href')

    await page.context().clearCookies()
    await anmelden(page, PRUEFER!)
    await page.goto(adresse!)

    await expect(page.getByRole('heading', { name: /nicht für Ihr Konto/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zu meinen Protokollen' })).toBeVisible()
  })
})
