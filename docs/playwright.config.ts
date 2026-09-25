import { defineConfig, devices } from '@playwright/test';

const port = 4329;
const phone = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${port}/starlight-codeblocks/`,
  },
  projects: [
    { name: 'desktop-light', use: { colorScheme: 'light' } },
    { name: 'desktop-dark', use: { colorScheme: 'dark' } },
    { name: 'phone-light', use: { ...phone, colorScheme: 'light' } },
    { name: 'phone-dark', use: { ...phone, colorScheme: 'dark' } },
    { name: 'reduced-motion', use: { colorScheme: 'dark', reducedMotion: 'reduce' } },
  ],
  // Runs against the existing production build in dist/. `pnpm test:e2e` at the root builds it first.
  webServer: {
    command: `astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/starlight-codeblocks/`,
    reuseExistingServer: !process.env.CI,
  },
});
