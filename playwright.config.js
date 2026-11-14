export default {
  testDir: './tests/e2e',
  fullyParallel: true,
  // Bound software-rendered browser contention without relaxing test assertions.
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // CI failure traces already include screenshots and interaction steps.
    // Avoid multi-gigabyte MP4 artifacts for large visual-regression matrices.
    video: process.env.CI ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'responsive-audit', testMatch: /independent-responsive/, use: { browserName: 'chromium', viewport: {width:390,height:844}, hasTouch:true } },
    {
      name: 'mobile-chrome',
      testIgnore: /independent-responsive/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-chrome',
      testIgnore: /independent-responsive/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1365, height: 900 },
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
};
