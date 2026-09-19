import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from '@playwright/test';

const directory = process.argv[2];
const base = directory ? 'http://127.0.0.1:8789' : 'https://kedi-lang.org';
const server = directory
  ? spawn(
      'python',
      [
        '-m',
        'http.server',
        '8789',
        '--bind',
        '127.0.0.1',
        '--directory',
        directory,
      ],
      { stdio: 'ignore' },
    )
  : null;
let browser;
try {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) break;
    } catch {}
    if (server?.exitCode != null || attempt === 49)
      throw new Error('Publication server unavailable');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  if (directory) {
    // Search reads the canonical sitemap; keep pre-release checks local too.
    await page.context().route('https://kedi-lang.org/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({
        url: base + url.pathname + url.search,
      });
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'access-control-allow-origin': '*' },
      });
    });
  }
  const failedAssets = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(base))
      failedAssets.push(response.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  assert.match(await page.title(), /Program with natural language/);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  for (const route of [
    'tooling/notebook/',
    'agent-adapters/typesafe/',
    'core-language/control-flow/',
  ]) {
    await page.goto(`${base}/${route}?source=legacy#top`);
    await page.waitForURL(`${base}/docs/${route}?source=legacy#top`);
    await page.waitForLoadState('networkidle');
    assert.equal(
      await page.locator('link[rel="canonical"]').getAttribute('href'),
      `https://kedi-lang.org/docs/${route}`,
    );
    const markdown = await page
      .locator('link[type="text/markdown"]')
      .getAttribute('href');
    assert.ok(markdown.startsWith('https://kedi-lang.org/docs/'));
    assert.equal((await fetch(base + new URL(markdown).pathname)).status, 200);
  }
  await page.goto(`${base}/docs/`, { waitUntil: 'networkidle' });
  await page.locator('.md-search__button').click();
  const search = page.getByRole('combobox');
  await search.fill('Notebook');
  const result = page.locator('a[href*="/docs/tooling/notebook/?h="]').first();
  await result.waitFor({ state: 'visible' });
  await result.click();
  await page.waitForURL(`${base}/docs/tooling/notebook/**`);
  assert.deepEqual(failedAssets, []);
  for (const route of [
    '/llms.txt',
    '/llms-full.txt',
    '/tooling/notebook.md',
    '/docs/llms.txt',
    '/sitemap.xml',
    '/docs/sitemap.xml',
  ]) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  const revisions = await (await fetch(`${base}/deployment.json`)).json();
  assert.ok(revisions.homepage && revisions.docs && revisions.kedi);
  console.log(
    JSON.stringify({
      base,
      redirects: 3,
      search: 'passed',
      assets: 'passed',
      revisions,
    }),
  );
} finally {
  await browser?.close();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
}
