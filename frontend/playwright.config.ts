import { defineConfig, devices } from '@playwright/test'

/* Browser verification, authorised on 2026-09-18 during feature 12b.
 *
 * coding-standards.md had said Playwright was not installed and was not to be
 * added silently mid-feature. It was added on request, because feature 12b is a
 * screen and the checks that matter on it (the columns, the filter bar, the
 * keyboard path, the empty and error states) cannot be proved by a passing build.
 *
 * This does not replace vitest. The split coding-standards.md already draws still
 * holds: logic where a wrong answer is possible gets a unit test beside it, and
 * components and integration surfaces get browser evidence. This is that evidence,
 * written down so it runs again rather than being clicked through once.
 *
 * The tests live in e2e/ and end in .spec.ts, deliberately outside vitest's
 * src/**\/*.test.ts, so neither runner picks up the other's files.
 */
export default defineConfig({
  testDir: './e2e',

  /* One at a time, against one development database. These tests sign in, read a
     shared queue and count rows in it; run in parallel they would race each other
     through the same session cookie and the same data. */
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    /* Kept only when something failed, so a passing run leaves nothing behind and
       a failing one leaves enough to see what happened without running it again. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /* Reuses the dev server somebody already has running rather than starting a
     second one on a port that is taken. The proxy in vite.config.ts is what puts
     the API on the same origin, so these tests need no CORS handling and no
     second base URL. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
