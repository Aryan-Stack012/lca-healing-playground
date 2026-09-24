// @ts-check
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'https://aryan-stack012.github.io/lca-healing-playground',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    browserName: 'chromium',
  },
});
