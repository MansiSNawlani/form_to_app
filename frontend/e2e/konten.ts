import type { Page } from '@playwright/test'

/* The accounts these tests sign in as, and how they get a session.
 *
 * **No password is written down here.** The addresses and the password come from
 * the environment, and a run without them skips with a sentence saying what to
 * set rather than failing, which is the same arrangement backend/conftest.py uses
 * when no database is reachable: "not run here" must never read as "passed".
 *
 * See the Commands section of AGENTS.md for the two commands that create these
 * accounts. They are development accounts on a throwaway database and nothing
 * else; no real account's password belongs in an environment variable.
 */

export interface Konto {
  email: string
  passwort: string
}

function ausUmgebung(schluessel: string): string | undefined {
  const wert = process.env[schluessel]
  return wert === undefined || wert === '' ? undefined : wert
}

/** Null when the environment does not carry the credentials, never a guess. */
export function konto(rolle: 'pruefer' | 'einreicher'): Konto | null {
  const email = ausUmgebung(rolle === 'pruefer' ? 'E2E_EMAIL_PRUEFER' : 'E2E_EMAIL_EINREICHER')
  const passwort = ausUmgebung('E2E_PASSWORT')

  return email !== undefined && passwort !== undefined ? { email, passwort } : null
}

/** What to print when they are missing, so a skip says how to stop skipping. */
export const FEHLENDE_KONTEN =
  'Keine E2E-Konten konfiguriert. E2E_EMAIL_PRUEFER, E2E_EMAIL_EINREICHER und' +
  ' E2E_PASSWORT setzen. Siehe AGENTS.md, Abschnitt Commands.'

/* A session without going through the login screen.
 *
 * Through the page's own request context, so the httpOnly cookie lands in the
 * browser context the test then navigates with. Most of these tests are about what
 * the Pruefliste does once somebody is signed in, and driving the login form for
 * each of them would test the login screen fifteen times over.
 *
 * The two tests that are genuinely about signing in use the form instead.
 */
export async function anmelden(page: Page, konto: Konto): Promise<void> {
  const antwort = await page.request.post('/api/v1/anmeldung', {
    data: { email: konto.email, passwort: konto.passwort },
  })

  if (!antwort.ok()) {
    throw new Error(
      `Anmeldung als ${konto.email} fehlgeschlagen (${antwort.status()}).` +
        ' Existiert das Konto, und stimmt E2E_PASSWORT?',
    )
  }
}

/** Signing in the way a person does, for the tests about where somebody lands. */
export async function ueberFormularAnmelden(page: Page, konto: Konto): Promise<void> {
  await page.getByLabel('E-Mail-Adresse').fill(konto.email)
  await page.getByLabel('Passwort').fill(konto.passwort)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}
