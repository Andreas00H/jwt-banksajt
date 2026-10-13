import { defineConfig } from "@playwright/test";

// E2E-tester som öppnar banksajten i en riktig webbläsare (Chromium).
// Hela stacken (frontend, backend och en TOM testdatabas) startas först med
// Docker Compose, se "npm run e2e:up". Därför behövs ingen webServer här.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // test.only får inte råka pushas och göra att bara ett test körs i CI
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    // Testmiljöns frontend (docker-compose.test.yml), aldrig den publicerade sajten
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
