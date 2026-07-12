// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.CIVICRADAR_TEST_PORT || '8095';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'civicradar.spec.js',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'on-first-retry',
    serviceWorkers: 'block',
    viewport: { width: 390, height: 844 },
    geolocation: { latitude: 19.076, longitude: 72.8777 },
    permissions: ['geolocation'],
  },
  projects: [
    {
      name: 'pixel-5',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
