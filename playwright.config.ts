import { defineConfig } from "@playwright/test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDir = mkdtempSync(join(tmpdir(), "horus-e2e-"));

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 1000 },
    browserName: "chromium",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node server/index.mjs",
    env: {
      NODE_ENV: "production",
      DEMO_MODE: "true",
      COOKIE_SECURE: "false",
      PORT: "3101",
      DATA_DIR: dataDir,
    },
    url: "http://127.0.0.1:3101/api/health",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
