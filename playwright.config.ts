import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';

const storageStatePath = process.env.STORAGE_STATE_PATH;
const storageState = storageStatePath && fs.existsSync(storageStatePath) ? storageStatePath : undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'https://aryan-stack012.github.io/lca-healing-playground/',
    storageState,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
