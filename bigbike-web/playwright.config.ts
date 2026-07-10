import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.@(spec|test|e2e).?(c|m)[jt]s?(x)",
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  timeout: 90000,
  use: {
    baseURL: process.env.PW_BASE_URL || "http://localhost:3001",
    actionTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
