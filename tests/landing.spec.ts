import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import examples from '../src/data/examples.json' with { type: 'json' };
import { readdirSync } from 'node:fs';

test('social covers are excluded from the publishable output', () => {
  const files = readdirSync('dist', { recursive: true }).map(String);
  expect(
    files.filter((file) => /kedi-cover|assets\/social\//i.test(file)),
  ).toEqual([]);
});

test('brand mark has transparent negative space and an uncropped border', async () => {
  const { data, info } = await sharp('public/assets/kedi-logo.webp')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let ink = 0;
  let transparent = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const alpha = data[i + 3];
      if (alpha === 0) transparent++;
      if (alpha > 128) ink++;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
        expect(alpha).toBe(0);
      }
    }
  }
  expect(ink).toBeGreaterThan(info.width * info.height * 0.1);
  expect(transparent).toBeGreaterThan(info.width * info.height * 0.5);
  const favicon = await sharp('public/assets/kedi-favicon.webp').metadata();
  expect(favicon.width).toBe(64);
  expect(favicon.height).toBe(64);
  expect(favicon.hasAlpha).toBe(false);
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`layout and assets at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle(
      'Kedi - Program with natural language. Typed by design.',
    );
    await expect(page.locator('.hero-statement')).toHaveText(
      /Program with natural language\.\s*Typed by design\./,
    );
    await expect(page.locator('.site-header .brand')).toHaveAccessibleName(
      'Kedi home',
    );
    await expect(page.locator('.site-header .brand span')).toHaveCount(0);
    await expect(page.locator('.site-footer .brand span')).toHaveText('Kedi');
    await expect(
      page.getByRole('heading', { name: 'Kedi', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Kedi Harness', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#agents-title')).toBeVisible();
    await expect(page.locator('#jev-title')).toBeVisible();
    await expect(page.locator('#notebook-title')).toBeVisible();
    for (const member of await page.locator('.team-member').all()) {
      const avatar = await member.locator('.team-avatar').boundingBox();
      const details = await member.locator('.team-details').boundingBox();
      expect(avatar).not.toBeNull();
      expect(details).not.toBeNull();
      expect(Math.abs(avatar!.y - details!.y)).toBeLessThanOrEqual(1);
      expect(details!.x).toBeGreaterThan(avatar!.x + avatar!.width);
    }
    await expect(
      page.locator('.site-footer a[href="https://discord.gg/cuSbZd5he"]'),
    ).toHaveText(/Discord/);
    await expect(
      page.locator('#site-nav a[href="https://discord.gg/cuSbZd5he"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.notebook-launch > .install-command code'),
    ).toHaveText('kedi notebook');
    await expect(page.locator('.harness-section')).toContainText(
      'An agent harness.',
    );
    await expect(page.locator('[data-demo="agent"]')).toContainText(
      '> subagent: researcher',
    );
    await expect(
      page.getByRole('tab', { name: 'Assess & route' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-demo="jev-routing"]')).toContainText(
      'ChoiceCriteria',
    );
    await page.getByRole('tab', { name: 'Draft & review' }).click();
    await expect(page.locator('[data-demo="jev"]')).toBeVisible();
    await expect(page.locator('[data-demo="jev"]')).toContainText(
      'typesafe_threshold: 0.9',
    );
    await expect(page.locator('[data-demo="jev"]')).toContainText(
      'google/gemini-3-flash-preview',
    );
    await page.getByRole('tab', { name: 'Assess & route' }).click();
    await expect(page.locator('[data-demo="jev"]')).toBeHidden();
    await expect(page.locator('.jev-primitives dt')).toHaveText([
      'Score',
      'Choice',
      'Probability',
      'Criteria',
    ]);
    await expect(page.locator('.jev-primitives')).toContainText(
      'Add ChoiceCriteria',
    );
    await expect(page.locator('.jev-primitives')).toContainText(
      'Use BooleanCriteria',
    );
    await expect(
      page.getByRole('link', { name: 'Explore the Jev integration' }),
    ).toHaveAttribute(
      'href',
      'https://kedi-lang.org/docs/agent-adapters/typesafe/',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('[data-demo="template"] .code-line')).toHaveCount(
      examples.template.code.split('\n').length,
    );
    await page.getByRole('tab', { name: 'Loop + map' }).click();
    await expect(page.locator('[data-demo="map"]')).toBeVisible();
    const typeTextLines = await page
      .locator('[data-demo="map"] .value-type')
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      });
    expect(typeTextLines).toBe(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    if (width === 390 || width === 1440) {
      await page.locator('[data-tabs="flow"]').screenshot({
        path: testInfo.outputPath(`map-${width}.png`),
        animations: 'disabled',
      });
    }
    await page.getByRole('tab', { name: 'Template if' }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`hero-${width}.png`),
      animations: 'disabled',
    });
    for (const image of await page.locator('img[loading="lazy"]').all()) {
      // The ferry moves continuously; scrolling must not wait for a stable box.
      await image.evaluate((element) =>
        element.scrollIntoView({ behavior: 'instant', block: 'center' }),
      );
      await expect
        .poll(() =>
          image.evaluate(
            (element) =>
              (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await page.locator('footer').scrollIntoViewIfNeeded();
    await expect
      .poll(async () =>
        page
          .locator('img')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.page).toBeLessThanOrEqual(overflow.viewport);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`landing-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    if (width === 390 || width === 1440) {
      for (const section of ['agents', 'jev', 'notebook', 'team']) {
        await page.locator(`#${section}`).screenshot({
          path: testInfo.outputPath(`${section}-${width}.png`),
          animations: 'disabled',
        });
      }
      await page.getByRole('tab', { name: 'Draft & review' }).click();
      await page.locator('#jev').screenshot({
        path: testInfo.outputPath(`jev-review-${width}.png`),
        animations: 'disabled',
      });
    }
  });
}

test('tabs, keyboard navigation, clipboard, and replay', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Template loop' }).click();
  await expect(
    page.getByRole('tabpanel', { name: 'Template loop' }),
  ).toBeVisible();
  await expect(page.locator('[data-demo="loop"]')).toContainText(
    'makes promises not supported',
  );
  await page.getByRole('tab', { name: 'Template loop' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Template if' })).toBeFocused();
  await expect(
    page.getByRole('tabpanel', { name: 'Template if' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Loop + map' }).click();
  await expect(
    page.getByRole('tabpanel', { name: 'Loop + map' }),
  ).toBeVisible();
  await expect(page.locator('[data-demo="map"]')).toContainText('> map:');
  await page.getByRole('button', { name: 'Copy issue_inbox.kedi' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    examples.map.code,
  );
  await page.getByRole('tab', { name: 'Procedures' }).click();
  await expect(page.locator('[data-demo="procedure"]')).toBeVisible();
  await page.getByRole('tab', { name: 'Tools', exact: true }).click();
  await expect(page.locator('[data-demo="tool"]')).toBeVisible();
  await page.getByRole('button', { name: 'Copy stock_check.kedi' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    examples.tool.code,
  );
  await page.getByRole('button', { name: 'pip', exact: true }).click();
  await expect(page.locator('.install-full code')).toHaveText(
    'pip install kedi',
  );
  await page.locator('.install-full [data-copy-install]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'pip install kedi',
  );
  await page
    .getByRole('button', { name: 'Replay handoff.kedi example' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Replay handoff.kedi example' }),
  ).toBeEnabled();
  await expect(page.locator('[data-demo="hero"]')).not.toHaveAttribute(
    'aria-busy',
  );
  await expect(
    page.locator('[data-demo="hero"] .value-result').first(),
  ).toHaveText('Mira');
  await expect(page.locator('.cat-button')).toHaveCSS('animation-name', 'none');
  await page.getByRole('tab', { name: 'Assess & route' }).click();
  await page.getByRole('button', { name: 'Copy ticket_router.kedi' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    examples.jevRouting.code,
  );
  await page.getByRole('tab', { name: 'Draft & review' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Assess & route' })).toBeFocused();
  await page.getByRole('tab', { name: 'Draft & review' }).click();
  for (const key of ['agent', 'jev'] as const) {
    await page
      .getByRole('button', { name: `Copy ${examples[key].filename}` })
      .click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      examples[key].code,
    );
  }
});

test('team profiles have distinct avatars and accessible social links', async ({
  page,
}) => {
  await page.goto('/#team');
  const team = page.locator('#team');
  await expect(page.locator('#harness + #team')).toHaveCount(1);
  await expect(page.locator('#team + #start:last-child')).toHaveCount(1);
  await expect(
    team.getByRole('heading', { name: 'Mert Sırakaya' }),
  ).toBeVisible();
  await expect(
    team.getByRole('heading', { name: 'Doğukan Yiğit Polat' }),
  ).toBeVisible();
  await expect(team).toContainText('Applied AI Engineer');
  await expect(team).toContainText('PhD Student');
  await expect(team.locator('.team-role span:first-child')).toHaveText([
    'Co-creator',
    'Co-creator',
  ]);
  const links = team.getByRole('link');
  await expect(links).toHaveCount(4);
  const expected = [
    ['Mert Sırakaya', 'X', 'https://x.com/un3valuated'],
    ['Mert Sırakaya', 'LinkedIn', 'https://www.linkedin.com/in/mert-sirakaya/'],
    ['Doğukan Yiğit Polat', 'X', 'https://x.com/dyigitpolat'],
    [
      'Doğukan Yiğit Polat',
      'LinkedIn',
      'https://www.linkedin.com/in/dyigitpolat/',
    ],
  ];
  for (const [name, network, href] of expected) {
    const link = team.getByRole('link', {
      name: `${name} on ${network} (opens in a new tab)`,
      exact: true,
    });
    await expect(link).toHaveAttribute('href', href);
    await expect(link.locator('svg')).toHaveCount(1);
    await link.focus();
    await expect(link).toBeFocused();
    await expect
      .poll(() =>
        link.evaluate(
          (element) => getComputedStyle(element, '::after').opacity,
        ),
      )
      .toBe('1');
  }
  for (const name of ['team-mert', 'team-yigit']) {
    const metadata = await sharp(`public/assets/${name}.webp`).metadata();
    expect(metadata.width).toBe(256);
    expect(metadata.height).toBe(256);
    expect(metadata.hasAlpha).toBe(true);
    await expect(team.locator(`img[src="/assets/${name}.webp"]`)).toBeVisible();
  }
});

test('notebook launch and setup commands are copyable', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/#notebook');
  await page
    .getByRole('button', { name: 'Copy notebook command', exact: true })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'kedi notebook',
  );
  const setup = page.locator('.notebook-setup summary');
  await setup.focus();
  await setup.press('Enter');
  await expect(page.locator('.notebook-setup')).toHaveAttribute('open', '');
  await page
    .getByRole('button', { name: 'Copy notebook setup command' })
    .click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'uv run --extra notebook kedi notebook',
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await expect(
    page.getByRole('link', { name: 'View full-size Kedi Notebook screenshot' }),
  ).toHaveAttribute('href', '/assets/kedi-notebook.png');
  await expect(
    page.getByRole('link', { name: 'Notebook setup guide' }),
  ).toHaveAttribute('href', 'https://kedi-lang.org/docs/tooling/notebook/');
});

test('mobile menu opens, closes on navigation, and supports Escape', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('#site-nav')).toBeVisible();
  await page
    .locator('#site-nav')
    .getByRole('link', { name: 'The language' })
    .click();
  await expect(page.locator('#site-nav')).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open navigation' }),
  ).toBeFocused();
  await expect(page.locator('#site-nav')).toBeHidden();
});

test('motion can be paused and reduced motion is respected', async ({
  page,
}) => {
  await page.goto('/');
  const cat = page.getByRole('button', {
    name: 'Say hello to the Istanbul cat',
  });
  await cat.hover();
  await expect(cat).toHaveAttribute('data-tooltip', 'Meow!');
  await expect(cat).toHaveCSS('transition-duration', '0.7s');
  await cat.click();
  await expect(page.locator('#copy-status')).toHaveText('Meow!');
  await expect(cat).toHaveCSS('animation-name', 'none');
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toHaveAttribute('data-tooltip', 'Pause');
  await expect(pause.locator('svg')).toHaveCount(1);
  await pause.click();
  await expect(page.locator('.ferry')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.ferry')).toHaveCSS(
    'animation-play-state',
    'running',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.ferry')).toHaveCSS('animation-name', 'none');
  await page
    .getByRole('button', { name: 'Say hello to the Istanbul cat' })
    .click();
  await expect(page.locator('.cat-button')).not.toHaveClass(/is-jumping/);
  await expect(cat).toHaveCSS('transition-duration', '0s');
});

test('source remains readable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('[data-demo="hero"]')).toContainText(
    'Shipping needs approval',
  );
  await expect(
    page.locator('[data-demo="hero"] .value-result').first(),
  ).toHaveText('Mira');
  await context.close();
});
