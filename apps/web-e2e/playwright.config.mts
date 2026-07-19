import { defineConfig, devices } from '@playwright/test';
import { join } from 'node:path';

// Deliberately NOT using nxE2EPreset / @nx/devkit's workspaceRoot. Importing
// either pulls in nx's native binding, which throws
// "Cannot convert undefined or null to object" when this .mts config is loaded
// through Playwright's ESM path — the config fails before a single test runs.
// The preset only supplied testDir/outputDir/reporter/retries defaults, all
// inlined below, and workspaceRoot is two levels up from apps/web-e2e.
const workspaceRoot = join(import.meta.dirname, '..', '..');

// Dedicated e2e ports so the suite never collides with — or reuses — your dev
// servers (web :3000 / api :3001). The API runs against the isolated
// pickleball_web_e2e database.
const WEB_PORT = 3010;
const API_PORT = 3011;
// The admin console is a separate app now, so the browser suite runs a second
// Next server for it. Admin-driving helpers in support/ui.ts navigate to this
// origin (via ADMIN_BASE_URL) instead of a /admin route on the web app.
const ADMIN_PORT = 3012;
const baseURL = process.env['BASE_URL'] || `http://localhost:${WEB_PORT}`;
const adminBaseURL = process.env['ADMIN_BASE_URL'] || `http://localhost:${ADMIN_PORT}`;
const apiBaseUrl = `http://localhost:${API_PORT}/api`;
// Expose to the test workers (they inherit the runner's environment).
process.env['ADMIN_BASE_URL'] = adminBaseURL;

// Own database, distinct from the api-e2e suite's, so `nx run-many -t e2e`
// can run both suites in parallel without clashing. Note the separate env var:
// sharing E2E_DB_NAME with the api-e2e suite would collapse both onto one
// database the moment it was set, and each suite truncates on startup.
const dbEnv = {
  DB_NAME: process.env.WEB_E2E_DB_NAME || 'pickleball_web_e2e',
  DB_HOST: process.env.DB_HOST || '127.0.0.1',
  DB_PORT: process.env.DB_PORT || '5433',
  DB_USERNAME: process.env.DB_USERNAME || 'acecerio',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: 'false',
  DB_SYNCHRONIZE: 'false',
  DB_LOGGING: 'false',
  JWT_SECRET: 'e2e-web-secret',
  BCRYPT_ROUNDS: '4',
  THROTTLE_LIMIT: '100000',
  // Real Google sign-in can't be automated, so the API accepts the stub token
  // shape instead. GoogleVerifier throws at boot if this is ever combined with
  // NODE_ENV=production, so it cannot leak into a deployed image.
  GOOGLE_AUTH_STUB: '1',
  NODE_ENV: 'test',
};

// The web app only needs a non-empty client id: lib/google.ts refuses to open
// the chooser without one, and the stubbed GIS script ignores its value.
const WEB_GOOGLE_CLIENT_ID = 'e2e-stub-client-id.apps.googleusercontent.com';

export default defineConfig({
  testDir: './src',
  outputDir: join(workspaceRoot, 'dist', '.playwright', 'apps', 'web-e2e', 'test-output'),
  reporter: [
    [
      'html',
      {
        outputFolder: join(
          workspaceRoot,
          'dist',
          '.playwright',
          'apps',
          'web-e2e',
          'playwright-report',
        ),
        open: 'on-failure',
      },
    ],
  ],
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  globalSetup: './src/support/global-setup.ts',
  // Shared DB + a rich UI → run serially for stability. Spec filenames are
  // numbered because order matters: 01 leaves the facility onboarded, and the
  // later specs assume that. Playwright runs files in path order with a single
  // worker.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Create → migrate → truncate → seed the e2e DB, then serve the API.
      // The truncate is what makes runs repeatable: the suite starts with the
      // admin account and nothing else, exactly like a fresh deploy.
      command:
        'node apps/web-e2e/src/support/ensure-db.mjs && npm run migration && node apps/web-e2e/src/support/reset-db.mjs && npm run seed && npm run dev:api',
      url: `${apiBaseUrl}/settings`,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: workspaceRoot,
      env: {
        ...dbEnv,
        PORT: String(API_PORT),
        CORS_ORIGINS: `${baseURL},${adminBaseURL}`,
        // Must match the defaults in support/api.ts, which runs in the test
        // process and so doesn't inherit this env block.
        SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'admin@pickleplay.co',
        SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || 'P@ssw0rd123',
      },
    },
    {
      // Next.js web (customer app) on WEB_PORT, pointed at the e2e API.
      command: 'npx nx run web:dev',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: workspaceRoot,
      env: {
        PORT: String(WEB_PORT),
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: WEB_GOOGLE_CLIENT_ID,
      },
    },
    {
      // Next.js admin console on ADMIN_PORT, same e2e API. Admin uses email +
      // password, so it needs no Google client id.
      command: 'npx nx run admin:dev',
      url: adminBaseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      cwd: workspaceRoot,
      env: {
        PORT: String(ADMIN_PORT),
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
