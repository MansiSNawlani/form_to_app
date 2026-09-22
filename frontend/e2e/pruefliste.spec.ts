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

const OFFEN = 'status=SUBMITTED&status=IN_REVIEW&sortierung=eingereicht_alt'

interface Pruefzeile {
  id: string
  gewaessername: string
}

/** One page of the queue as the endpoint answers it, so tests assert against data. */
async function offeneSeite(
  page: Page,
  seite = 1,
): Promise<{ zeilen: Pruefzeile[]; seiten: number }> {
  const antwort = await page.request.get(`/api/v1/pruefliste?${OFFEN}&seite=${seite}`)
  expect(antwort.ok()).toBe(true)
  const inhalt = await antwort.json()
  return { zeilen: inhalt.zeilen as Pruefzeile[], seiten: inhalt.seiten as number }
}

async function offeneListe(page: Page): Promise<Pruefzeile[]> {
  return (await offeneSeite(page)).zeilen
}

/* The genuinely last protocol in the queue, not the last one on page one.
 *
 * Worth the second request. The first version of this test compared the page
 * against the total and skipped itself the moment the queue outgrew one page,
 * which is exactly when walking to the end stops being trivial: "not run here"
 * must never read as "passed".
 */
async function letztesOffenes(page: Page): Promise<Pruefzeile> {
  const { seiten } = await offeneSeite(page)
  const { zeilen } = await offeneSeite(page, seiten)
  return zeilen[zeilen.length - 1]
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
    for (const name of ['Status', 'Jahr', 'Anlass', 'Art', 'Sortierung']) {
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

    for (const erwartet of ['Status', 'Jahr', 'Anlass', 'Art', 'Sortierung']) {
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
    /* The species picker is an input rather than a MUI Select, so what it is set
       to is its value. Unset, it says so through its placeholder instead of
       standing there as an empty box. */
    const art = page.getByRole('combobox', { name: 'Art' })
    await expect(art).toHaveValue('')
    await expect(art).toHaveAttribute('placeholder', 'Alle Arten')
  })
})

/* Feature 12c. The one filter that is not a column comparison: it reads the
   catch table inside each protocol's answers document.

   Every test asks the endpoint for the same species first and asserts against
   that, rather than against a number written down here. What is in the
   development database is whatever earlier work left in it, and a test expecting
   two rows is a test that starts failing on somebody else's machine. */
test.describe('Die Suche nach Art', () => {
  /* Bachneunauge, adult. Any entry in the picker would do; what this one has is
     a protocol in the development database that names it. */
  const ART = { code: 'BNEA', label: 'Bachneunauge, adult' }

  test.beforeEach(async ({ page }) => {
    await anmelden(page, PRUEFER!)
  })

  /* Skipped rather than passed when the development database holds no protocol
     with this species in it, and the skip says how to stop skipping. The same
     arrangement konten.ts uses for the credentials, and for the same reason: a
     test that quietly proves nothing must not read as a test that passed. */
  async function treffer(page: Page): Promise<number> {
    const anzahl = await gesamt(page, `status=SUBMITTED&status=IN_REVIEW&art=${ART.code}`)
    test.skip(
      anzahl === 0,
      `Kein offenes Protokoll mit der Art ${ART.label} in dieser Datenbank.` +
        ' Eines einreichen, das diese Art in der Fangtabelle nennt.',
    )
    return anzahl
  }

  test('engt die Liste auf die Protokolle mit dieser Art ein', async ({ page }) => {
    const mitArt = await treffer(page)
    const ohneArt = await gesamt(page, 'status=SUBMITTED&status=IN_REVIEW')
    expect(mitArt).toBeLessThan(ohneArt)

    await page.goto('/pruefung')
    await expect(page.getByText(new RegExp(`^${ohneArt} eingereichte`))).toBeVisible()

    await page.getByRole('combobox', { name: 'Art' }).fill(ART.label)
    await page.getByRole('option', { name: ART.label, exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`art=${ART.code}`))
    await expect(page.getByText(new RegExp(`^${mitArt} eingereichte`))).toBeVisible()
  })

  test('ueberlebt einen Reload und laesst sich als Link weitergeben', async ({ page }) => {
    const mitArt = await treffer(page)

    await page.goto(`/pruefung?art=${ART.code}`)

    await expect(page.getByRole('combobox', { name: 'Art' })).toHaveValue(ART.label)
    await expect(page.getByText(new RegExp(`^${mitArt} eingereichte`))).toBeVisible()
  })

  test('macht der Zurueck-Knopf die Artwahl rueckgaengig', async ({ page }) => {
    const mitArt = await treffer(page)
    const ohneArt = await gesamt(page, 'status=SUBMITTED&status=IN_REVIEW')

    await page.goto('/pruefung')

    await page.getByRole('combobox', { name: 'Art' }).fill(ART.label)
    await page.getByRole('option', { name: ART.label, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`art=${ART.code}`))
    /* Waiting for the narrowed list before going back, and not only for the
       address bar. Back pressed inside the same tick as the choice is a race no
       reader can run, and it leaves the screen showing one selection while the
       address carries the other. */
    await expect(page.getByText(new RegExp(`^${mitArt} eingereichte`))).toBeVisible()

    await page.goBack()
    await expect(page.getByText(new RegExp(`^${ohneArt} eingereichte`))).toBeVisible()

    await expect(page).toHaveURL(/\/pruefung$/)
    await expect(page.getByRole('combobox', { name: 'Art' })).toHaveValue('')
  })

  test('zaehlt als Filter, wenn nichts passt', async ({ page }) => {
    /* KNMU is "kein Nachweis, Muscheln", an ordinary entry in the picker that no
       protocol here names. The queue has to say the filters matched nothing and
       offer the way back, rather than reading as an empty database. */
    await page.goto('/pruefung?art=KNMU')

    await expect(page.getByText('Keine Protokolle zu diesen Filtern')).toBeVisible()

    await page.getByRole('button', { name: 'Filter zurücksetzen' }).click()

    await expect(page).toHaveURL(/\/pruefung$/)
  })

  /* A code the picker cannot offer: typed into the address by hand today, and
     one day a protocol frozen on an older form version naming a species the
     current list has dropped. The filter still runs, so the box has to say what
     it is filtering on rather than reading as though nothing were chosen. */
  test('zeigt einen Code, den die Liste nicht kennt, trotzdem an', async ({ page }) => {
    await page.goto('/pruefung?art=GIBTESNICHT')

    await expect(page.getByRole('combobox', { name: 'Art' })).toHaveValue('GIBTESNICHT')
    await expect(page.getByText('Keine Protokolle zu diesen Filtern')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Filter zurücksetzen' })).toBeVisible()
  })

  test('laesst sich mit der Tastatur allein waehlen', async ({ page }) => {
    await page.goto('/pruefung')

    await page.getByRole('combobox', { name: 'Art' }).focus()
    await page.keyboard.type('Hecht')
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/art=HECH/)
    await expect(page.getByRole('combobox', { name: 'Art' })).toHaveValue('Hecht')
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

/* Walking the queue from the reviewer's screen, feature 12d.
 *
 * The protocols come out of the endpoint rather than being named here, because
 * which protocol is next depends on what the development database holds. What is
 * asserted is the relationship between the list and the two buttons, which is
 * the whole of what this feature promises.
 */
test.describe('Durch die Liste blaettern', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await anmelden(page, PRUEFER!)
  })

  test('geht mit Naechstes weiter und mit Vorheriges zurueck', async ({ page }) => {
    const zeilen = await offeneListe(page)
    test.skip(zeilen.length < 3, 'Zu wenige eingereichte Protokolle im Testbestand.')

    await page.goto(`/protokolle/${zeilen[1].id}/pruefung`)

    await page.getByRole('link', { name: /^Nächstes/ }).click()
    await expect(page).toHaveURL(new RegExp(`/protokolle/${zeilen[2].id}/pruefung`))

    await page.getByRole('link', { name: /^Vorheriges/ }).click()
    await expect(page).toHaveURL(new RegExp(`/protokolle/${zeilen[1].id}/pruefung`))
  })

  test('nennt im verborgenen Teil des Knopfes das Gewaesser', async ({ page }) => {
    // Two buttons reading only "Vorheriges" and "Naechstes" announce nothing
    // about where they go. The name is what a screen reader reads out.
    const zeilen = await offeneListe(page)
    test.skip(zeilen.length < 2, 'Zu wenige eingereichte Protokolle im Testbestand.')

    await page.goto(`/protokolle/${zeilen[0].id}/pruefung`)

    /* The name, not an exact string: JSX puts a space between the label and the
       hidden water, so the button announces "Naechstes , Schussen". It reads the
       same aloud, and it is the same shape the queue's Pruefen buttons have. */
    await expect(
      page.getByRole('link', { name: new RegExp(`^Nächstes.*${zeilen[1].gewaessername}`) }),
    ).toBeVisible()
  })

  test('sperrt Vorheriges am Anfang und Naechstes am Ende', async ({ page }) => {
    const zeilen = await offeneListe(page)
    test.skip(zeilen.length < 2, 'Zu wenige eingereichte Protokolle im Testbestand.')

    await page.goto(`/protokolle/${zeilen[0].id}/pruefung`)
    // Drawn, not gone: a button that disappears at the edge makes the head jump
    // about as the reader walks.
    await expect(page.getByRole('button', { name: 'Vorheriges' })).toBeDisabled()
    await expect(page.getByRole('link', { name: /^Nächstes/ })).toBeVisible()

    // The end of the queue, whichever page it falls on.
    const letztes = await letztesOffenes(page)
    await page.goto(`/protokolle/${letztes.id}/pruefung`)
    await expect(page.getByRole('button', { name: 'Nächstes' })).toBeDisabled()
    await expect(page.getByRole('link', { name: /^Vorheriges/ })).toBeVisible()
  })

  test('traegt die Seite ueber die Seitengrenze mit', async ({ page }) => {
    // The one case the queue's own paging makes possible: the last row of a page
    // has its successor on the next one, and the crumb has to follow the reader
    // there rather than sending them back to the page they started on.
    const { zeilen, seiten } = await offeneSeite(page)
    test.skip(seiten < 2, 'Die Liste hat nur eine Seite.')

    const letzteAufSeiteEins = zeilen[zeilen.length - 1]
    const naechsteSeite = await offeneSeite(page, 2)
    const erstesAufSeiteZwei = naechsteSeite.zeilen[0]

    await page.goto(`/protokolle/${letzteAufSeiteEins.id}/pruefung`)
    await page.getByRole('link', { name: /^Nächstes/ }).click()

    await expect(page).toHaveURL(new RegExp(`/protokolle/${erstesAufSeiteZwei.id}/pruefung`))
    await expect(page).toHaveURL(/seite=2/)

    await page.getByRole('main').getByRole('link', { name: 'Prüfliste' }).click()
    await expect(page).toHaveURL(/seite=2/)
  })

  test('nimmt die Filter mit auf den Pruefbildschirm und wieder zurueck', async ({ page }) => {
    await page.goto('/pruefung?status=alle&sortierung=gewaesser')

    await page
      .getByRole('link', { name: /^Prüfen/ })
      .first()
      .click()

    // The queue rides in the address, which is the only thing the reviewer's
    // screen knows about the list it was opened out of.
    await expect(page).toHaveURL(/status=alle/)
    await expect(page).toHaveURL(/sortierung=gewaesser/)

    await page.getByRole('main').getByRole('link', { name: 'Prüfliste' }).click()

    await expect(page).toHaveURL(/\/pruefung\?/)
    await expect(page).toHaveURL(/status=alle/)
    await expect(page).toHaveURL(/sortierung=gewaesser/)
  })

  test('zeigt keine Schritte zu einem Protokoll ausserhalb der Filter', async ({ page }) => {
    // An accepted protocol has left an Offen queue while it is still being read.
    // The crumb stays, because the list is still somewhere to go back to.
    const zeilen = await offeneListe(page)
    test.skip(zeilen.length < 1, 'Kein eingereichtes Protokoll im Testbestand.')

    await page.goto(`/protokolle/${zeilen[0].id}/pruefung?status=REJECTED`)

    await expect(page.getByRole('main').getByRole('link', { name: 'Prüfliste' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Nächstes/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Nächstes' })).toHaveCount(0)
  })

  test('gibt einem Einreicher die Spur zur Pruefliste gar nicht erst', async ({ page }) => {
    await page.context().clearCookies()
    await anmelden(page, EINREICHER!)

    const eigene = await page.request.get('/api/v1/protokolle')
    const eingereicht = ((await eigene.json()) as { id: string; status: string }[]).find(
      (zeile) => zeile.status !== 'DRAFT',
    )
    test.skip(eingereicht === undefined, 'Das Einreicher-Konto hat nichts eingereicht.')

    await page.goto(`/protokolle/${eingereicht!.id}/pruefung`)

    // The queue is not their list. They keep the button that goes where they
    // actually came from.
    await expect(page.getByRole('main').getByRole('link', { name: 'Prüfliste' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Alle Protokolle' })).toBeVisible()
  })
})
