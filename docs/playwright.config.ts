import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.SCB_E2E_PORT ?? 4329);
const phone = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${port}/starlight-codeblocks/`,
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    { name: 'desktop-light', use: { colorScheme: 'light' } },
    { name: 'phone', use: { ...phone, colorScheme: 'light' } },
    { name: 'desktop-dark', use: { colorScheme: 'dark' }, grep: /@theme/ },
    { name: 'reduced-motion', use: { colorScheme: 'dark', reducedMotion: 'reduce' }, grep: /@motion/ },
  ],
  // Runs against the existing production build in dist/. `pnpm test:e2e` at the root builds it first.
  webServer: {
    command: `astro preview --port ${port} --ignore-lock`,
    url: `http://localhost:${port}/starlight-codeblocks/`,
    reuseExistingServer: !process.env.CI,
  },
});
