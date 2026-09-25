import { expect, test, type Page } from '@playwright/test'
import { anmelden, FEHLENDE_KONTEN, konto } from './konten'

/* Die Benutzerliste, proved against the running application.
 *
 * These are the checks feature 16b's spec asked for that a passing build cannot
 * answer: that the header offers the page to a Super Admin and to nobody else,
 * that an account without the role is turned away in words rather than shown an
 * empty table, what the table draws, and what the search box does to it.
 *
 * Controls are addressed by their accessible role and name throughout. That is
 * deliberate and does double duty: a selector that cannot find "the link named
 * Benutzerverwaltung" is a control a screen reader cannot announce either, which
 * is the fault feature 12b's branch review found on the screen before this one.
 */

const ADMIN = konto('admin')
const PRUEFER = konto('pruefer')

test.skip(ADMIN === null || PRUEFER === null, FEHLENDE_KONTEN)

const ADRESSE = '/verwaltung/benutzer'

interface Konto {
  id: string
  email: string
  ist_aktiv: boolean
  regierungspraesidium: number | null
}

/* A row found by the address in it, with the address treated as text.
 *
 * Escaped rather than dropped into a RegExp raw: a development account addressed
 * with a plus sign, which is an ordinary way to make one, would otherwise turn
 * into a repetition operator and match nothing. */
function zeileMit(page: Page, email: string) {
  return page.getByRole('row', { name: new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
}

/** What the endpoint says, so the tests assert against the data rather than a guess. */
async function konten(page: Page): Promise<Konto[]> {
  const antwort = await page.request.get('/api/v1/benutzer')
  expect(antwort.ok()).toBe(true)
  return (await antwort.json()) as Konto[]
}

test.describe('Die Benutzerliste, als Super Admin', () => {
  test.beforeEach(async ({ page }) => {
    await anmelden(page, ADMIN!)
  })

  test('ist ueber den Kopfbereich erreichbar und zeigt alle Konten', async ({ page }) => {
    await page.goto('/')

    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Benutzerverwaltung' })
      .click()

    await expect(page).toHaveURL(ADRESSE)
    await expect(page.getByRole('heading', { level: 1, name: 'Benutzerverwaltung' })).toBeVisible()

    /* Against the endpoint rather than a fixed number: this is a shared
       development database and the next feature to add an account must not turn
       this test red. */
    const alle = await konten(page)
    await expect(page.getByRole('row')).toHaveCount(alle.length + 1) // plus the header row

    /* The live region carries the only count on the screen, and says the plain
       total while nothing is being searched for. */
    await expect(page.getByRole('status')).toHaveText(`${alle.length} Konten`)
  })

  test('zeigt Rollen, Regierungspraesidium und Status je Konto', async ({ page }) => {
    await page.goto(ADRESSE)

    const alle = await konten(page)
    const gesperrt = alle.find((eintrag) => !eintrag.ist_aktiv)
    const regional = alle.find((eintrag) => eintrag.regierungspraesidium !== null)

    /* The table is named for a screen reader. A caption rather than an aria-label,
       so it is announced by every reader and lives in the locale file. */
    await expect(page.getByRole('table', { name: 'Alle Konten dieser Anwendung' })).toBeVisible()

    /* The reader's own row is marked, which is what makes 16d's refusals make
       sense before somebody clicks: a Super Admin may not lock their own account. */
    const eigene = zeileMit(page, ADMIN!.email)
    await expect(eigene.getByText('Ihr eigenes Konto')).toBeVisible()
    await expect(eigene.getByText('Administration')).toBeVisible()

    /* Locked is the exception and the only status that gets a badge, so the eye
       goes to the accounts that cannot sign in. The word is printed either way,
       so the colour never carries the meaning on its own. */
    if (gesperrt !== undefined) {
      const zeile = zeileMit(page, gesperrt.email)
      await expect(zeile.getByText('Gesperrt')).toBeVisible()
    }

    /* The region is read out of the extracted option list rather than retyped, so
       the cell says the authority's name and not a bare number. */
    if (regional !== undefined) {
      const zeile = zeileMit(page, regional.email)
      await expect(zeile.getByText(/Regierungspräsidium /)).toBeVisible()
    }
  })

  test('die Suche filtert die Tabelle ohne neue Anfrage', async ({ page }) => {
    await page.goto(ADRESSE)
    const alle = await konten(page)

    /* Nothing is fetched per keystroke: the whole list is already in hand, which
       is the other half of the decision feature 16a made when its endpoint took
       no search parameter. Proved by watching for a request that must not come. */
    let anfragen = 0
    await page.route('**/api/v1/benutzer', async (route) => {
      anfragen += 1
      await route.continue()
    })

    const feld = page.getByLabel('Nach E-Mail-Adresse suchen')
    await feld.fill(ADMIN!.email)

    await expect(page.getByRole('row')).toHaveCount(2) // the match, plus the header
    expect(anfragen).toBe(0)

    /* A term nothing matches says so, and says it differently from "there are no
       accounts", which is the distinction the empty state exists to make. */
    await feld.fill('kein-konto-heisst-so-zander')
    await expect(page.getByRole('heading', { name: 'Kein Konto passt zu Ihrer Suche' })).toBeVisible()

    await page.getByRole('button', { name: 'Suche zurücksetzen' }).click()
    await expect(page.getByRole('row')).toHaveCount(alle.length + 1)

    /* The count has to come back too. Left blank, clearing the box would tell
       somebody using a screen reader nothing at all, so they would hear that the
       list had narrowed and never that it had been restored. */
    await expect(page.getByRole('status')).toHaveText(`${alle.length} Konten`)
  })
})

test.describe('Die Benutzerliste, ohne die Rolle dafuer', () => {
  test.beforeEach(async ({ page }) => {
    await anmelden(page, PRUEFER!)
  })

  /* Hiding a link is a courtesy, never a permission. Both halves are checked
     here: the header does not offer the page, and the page itself refuses
     somebody who types the address anyway. */
  test('bietet der Kopfbereich die Seite nicht an', async ({ page }) => {
    await page.goto('/')

    const navigation = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await expect(navigation.getByRole('link', { name: 'Prüfliste' })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Benutzerverwaltung' })).toHaveCount(0)
  })

  test('weist die Adresse mit einer Erklaerung und einem Weg ab', async ({ page }) => {
    await page.goto(ADRESSE)

    await expect(
      page.getByRole('heading', { name: 'Diese Seite ist nicht für Ihr Konto' }),
    ).toBeVisible()

    /* No table, and no retry: the refusal is settled, so trying again would only
       produce the same no more slowly. */
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Zu meinen Protokollen' }).click()
    await expect(page).toHaveURL('/')
  })
})
