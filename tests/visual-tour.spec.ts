import { test } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';

// All static routes from app.routes.ts, admin routes excluded.
// Routes that require ID parameters are excluded (they have no static URL).
const PAGES = [
  { name: 'home',                  path: '/' },
  { name: 'login',                 path: '/login' },
  { name: 'register',              path: '/register' },
  { name: 'restore-password',      path: '/restore-password' },
  { name: 'wipe-out-my-user',      path: '/wipe-out-my-user' },
  { name: 'recovery-codes',        path: '/recovery-codes' },
  { name: 'restoration-codes',     path: '/restoration-codes' },
  { name: 'settings',              path: '/settings' },
  { name: 'direct-chat',           path: '/direct-chat' },
  { name: 'ai-chat',               path: '/ai-chat' },
  { name: 'topic-create',          path: '/topic-create' },
  { name: 'lore-topic-create',     path: '/lore-topic-create' },
  { name: 'episode-create',        path: '/episode-create' },
  { name: 'character-create',      path: '/character-create' },
  { name: 'wanted-character-create', path: '/wanted-character-create' },
  { name: 'character-list',        path: '/character-list' },
  { name: 'wanted-character-list', path: '/wanted-character-list' },
  { name: 'user-list',             path: '/user-list' },
  { name: 'episode-list',          path: '/episode-list' },
  { name: 'active-topics',         path: '/active-topics' },
  { name: 'active-users',          path: '/active-users' },
  { name: 'preview',               path: '/preview' },
  { name: '403',                   path: '/403' },
  { name: '500',                   path: '/500' },
  { name: '404',                   path: '/this-page-does-not-exist' },
];

for (const { name, path } of PAGES) {
  test(`page: ${name}`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('requestfailed', req => {
      networkFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText ?? 'unknown'}`);
    });

    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });

    const debug = {
      page: name,
      url: `${BASE_URL}${path}`,
      finalUrl: page.url(),
      title: await page.title(),
      consoleErrors,
      networkFailures,
      timestamp: new Date().toISOString(),
    };
    await testInfo.attach(`${name}.debug.json`, {
      body: JSON.stringify(debug, null, 2),
      contentType: 'application/json',
    });
  });
}
