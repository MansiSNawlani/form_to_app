import { expect, test, type APIRequestContext } from '@playwright/test'

/* The two demo doors on the sign-in page.
 *
 * Which half runs depends on the backend these tests are pointed at, because
 * DEMO_MODUS is a deployment setting rather than something a test may flip. An
 * ordinary development stack has it off, and there the first test proves the
 * page looks exactly as it did before. A demo stack, set up with
 * `befischung demo zuruecksetzen`, runs the second. Either way the other one
 * skips with a sentence rather than passing quietly.
 */

async function demoIstAn(request: APIRequestContext): Promise<boolean> {
  const antwort = await request.get('/api/v1/anmeldung/demo')
  if (!antwort.ok()) return false
  const koerper = (await antwort.json()) as { aktiv: boolean }
  return koerper.aktiv
}

test('without DEMO_MODUS the sign-in page offers no demo', async ({ page, request }) => {
  test.skip(await demoIstAn(request), 'This backend has DEMO_MODUS on; the demo test below covers it.')

  await page.goto('/anmeldung')
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()

  await expect(page.getByRole('region', { name: 'Ohne Konto ansehen' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Demo:/ })).toHaveCount(0)
})

test('each demo door signs in as its role and lands on its start page', async ({
  page,
  request,
}) => {
  test.skip(
    !(await demoIstAn(request)),
    'DEMO_MODUS is off on this backend. Set DEMO_MODUS=true on a separate demo database, run `befischung demo zuruecksetzen`, and point these tests at it.',
  )

  await page.goto('/anmeldung')
  await page.getByRole('button', { name: 'Demo: als Prüfer ansehen' }).click()
  await expect(page).toHaveURL(/\/pruefung$/)
  await expect(page.getByRole('heading', { name: 'Prüfliste' })).toBeVisible()
  await expect(page.getByText('demo-pruefer@befischung.example')).toBeVisible()

  await page.getByRole('button', { name: 'Abmelden' }).click()

  await page.getByRole('button', { name: 'Demo: als Einreicher ansehen' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Meine Protokolle' })).toBeVisible()
  await expect(page.getByText('demo-einreicher@befischung.example')).toBeVisible()
})
