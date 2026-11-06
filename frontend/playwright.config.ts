import { defineConfig, devices } from '@playwright/test'

// Standing end-to-end suite against a running server with a fresh data directory and the built UI. The base URL comes
// from PLAYWRIGHT_BASE_URL; an optional PLAYWRIGHT_WS_ENDPOINT points at a Playwright server (browsers in a container).
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5245'
const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT
// The manual screenshots (e2e/handbuch) are no regression test: they run only with HANDBOOK_CAPTURE=1, and then nothing else does.
const capture = process.env.HANDBOOK_CAPTURE === '1'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // The manual capture does a lot in one test (demo data, many screens)
  timeout: capture ? 300_000 : 60_000,
  // One shared first account whose security settings several tests change: everything runs one after another and every
  // test leaves the account as it found it.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'de-DE',
    trace: 'retain-on-failure',
    // The narrowest supported window is 1024 px; the layout tests resize where they need to.
    viewport: { width: 1280, height: 800 },
    ...(wsEndpoint ? { connectOptions: { wsEndpoint, exposeNetwork: '<loopback>' } } : {}),
  },
  projects: capture
    ? [
        // Creates its own demo data on a fresh server and signs in itself (see the header of the spec)
        { name: 'handbook', testMatch: '**/handbuch/capture.spec.ts', use: { ...devices['Desktop Chrome'] } },
      ]
    : [
        { name: 'setup', testMatch: 'setup.spec.ts', use: { ...devices['Desktop Chrome'] } },
        // The setup test saves the owner's session; the other tests start with it (the sign-in is rate limited on purpose).
        {
          name: 'chromium',
          dependencies: ['setup'],
          testIgnore: ['setup.spec.ts', '**/handbuch/**', 'restore.spec.ts'],
          use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/owner.json' },
        },
        // A restore ends every session (the signing key is replaced), including the one the other tests share, so it runs
        // last and signs in itself.
        { name: 'destructive', dependencies: ['chromium'], testMatch: 'restore.spec.ts', use: { ...devices['Desktop Chrome'] } },
      ],
})
