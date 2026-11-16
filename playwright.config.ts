import { defineConfig, devices } from "@playwright/test";
const productionBuild = Boolean(process.env.PLAYWRIGHT_USE_BUILD);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  (productionBuild ? "https://localhost:3100" : "http://localhost:3100");
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: {
    baseURL,
    ignoreHTTPSErrors: productionBuild,
    trace: "retain-on-failure",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
  },
  projects: [
    {
      name: "safari",
      use: { ...devices["Desktop Safari"], launchOptions: {} },
      // WebKit cannot grant automated microphone permissions. Voice is tested
      // in Chromium; Safari's text/recovery flow uses its actual rendering engine.
      grepInvert:
        /voice recording|transcription failure|successful transcription|late microphone/,
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: productionBuild
          ? "node scripts/serve-test-build.mjs"
          : "npm run dev -- --port 3100",
        url: baseURL,
        ignoreHTTPSErrors: productionBuild,
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key",
        },
        timeout: 120000,
      },
});
