import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env")) loadEnvFile();

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "móvil", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "npm run start -w apps/api",
      url: "http://127.0.0.1:4400/api/health",
      env: {
        NODE_ENV: "test",
        PORT: "4400",
        WEB_ORIGIN: "http://localhost:4173",
        ALLOW_REGISTRATION: "true",
        DEMO_VIEW: "false",
      },
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command:
        "npm exec -w apps/web -- vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      env: { DEVDESK_PREVIEW_API_PORT: "4400" },
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
