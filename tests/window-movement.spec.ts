import { expect, test, type Locator, type Page } from '@playwright/test';

const heroSelector = '[data-demo="hero"]';

async function dragWindow(page: Page, frame: Locator, x: number, y: number) {
  const title = frame.locator('.window-title');
  await title.scrollIntoViewIfNeeded();
  const rect = (await title.boundingBox())!;
  await page.mouse.move(rect.x + 70, rect.y + 16);
  await page.mouse.down();
  await page.mouse.move(rect.x + 70 + x, rect.y + 16 + y, { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(heroSelector)).toHaveClass(/is-movable/);
});

test('all displaced windows return home after exactly one idle minute', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T00:00:01Z'));
  const frames = [
    page.locator(heroSelector),
    page.locator('[data-demo="template"]'),
  ];
  for (const frame of frames) {
    await frame
      .locator('.window-title')
      .dispatchEvent('keydown', { key: 'ArrowRight' });
  }
  await expect(page.locator('.code-window.is-displaced')).toHaveCount(2);
  await page.clock.runFor(59_999);
  await expect(page.locator('.code-window.is-displaced')).toHaveCount(2);
  await page.clock.runFor(1);
  await expect(page.locator('.code-window.is-displaced')).toHaveCount(0);
  for (const frame of frames) {
    await expect(frame).toHaveCSS('translate', 'none');
    await expect(frame.locator('[data-reset-window]')).toBeDisabled();
  }
});

test('page activity renews the idle deadline', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-04T00:00:01Z'));
  const frame = page.locator(heroSelector);
  await frame
    .locator('.window-title')
    .dispatchEvent('keydown', { key: 'ArrowRight' });
  for (const event of [
    'pointermove',
    'pointerdown',
    'pointerup',
    'keydown',
    'wheel',
    'scroll',
  ]) {
    await page.clock.runFor(45_000);
    await expect(frame).toHaveClass(/is-displaced/);
    await page.evaluate((type) => window.dispatchEvent(new Event(type)), event);
  }
  await page.clock.runFor(59_999);
  await expect(frame).toHaveClass(/is-displaced/);
  await page.clock.runFor(1);
  await expect(frame).not.toHaveClass(/is-displaced/);
});

test('dragging reveals the landscape without changing the page layout', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const frame = page.locator(heroSelector);
  const original = (await frame.boundingBox())!;
  const landscape = await page.locator('.hero-landscape').boundingBox();
  const mascot = await page.locator('.cat-button').boundingBox();
  const install = await page.locator('.hero .install').boundingBox();
  await page.screenshot({ path: testInfo.outputPath('desktop-before.png') });

  await dragWindow(page, frame, -230, 0);
  const moved = (await frame.boundingBox())!;
  expect(moved.x).toBeCloseTo(original.x - 230);
  expect(moved.y).toBeCloseTo(original.y);
  expect(moved.width).toBe(original.width);
  expect(await page.locator('.hero-landscape').boundingBox()).toEqual(
    landscape,
  );
  expect(await page.locator('.cat-button').boundingBox()).toEqual(mascot);
  expect(await page.locator('.hero .install').boundingBox()).toEqual(install);
  expect(
    await page.evaluate(
      ({ x, y }) => {
        const element = document.elementFromPoint(x, y);
        return Boolean(
          element?.closest('.hero') && !element.closest('.code-window'),
        );
      },
      { x: original.x + original.width - 60, y: original.y + 60 },
    ),
  ).toBe(true);
  await expect(frame).not.toHaveClass(/is-dragging/);
  await page.screenshot({ path: testInfo.outputPath('desktop-moved.png') });

  await frame.locator('[data-reset-window]').click();
  expect(await frame.boundingBox()).toEqual(original);
  await expect(frame.locator('[data-reset-window]')).toBeDisabled();
  await expect(frame.locator('.window-title')).toBeFocused();
  expect(errors).toEqual([]);
});

test('drag stays in its section and never creates horizontal overflow', async ({
  page,
}) => {
  const frame = page.locator(heroSelector);
  const area = (await page.locator('.hero').boundingBox())!;
  await dragWindow(page, frame, -3000, -3000);
  let rect = (await frame.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(12);
  expect(rect.y).toBeGreaterThanOrEqual(area.y + 12);
  await dragWindow(page, frame, 3000, 3000);
  rect = (await frame.boundingBox())!;
  expect(rect.x + rect.width).toBeLessThanOrEqual(1440 - 12);
  expect(rect.y + rect.height).toBeLessThanOrEqual(area.y + area.height - 12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1440,
  );
  await frame.locator('.window-title').press('Home');
  await expect(frame).not.toHaveClass(/is-displaced/);
});

test('keyboard, repeated drags, cancellation, and double-click reset', async ({
  page,
}) => {
  const frame = page.locator(heroSelector);
  const title = frame.locator('.window-title');
  const original = (await frame.boundingBox())!;
  await title.focus();
  await title.press('ArrowLeft');
  await title.press('Shift+ArrowUp');
  expect((await frame.boundingBox())!.x).toBeCloseTo(original.x - 10);
  expect((await frame.boundingBox())!.y).toBeCloseTo(original.y - 40);
  await dragWindow(page, frame, 30, 10);
  expect((await frame.boundingBox())!.x).toBeCloseTo(original.x + 20);
  await title.press('Escape');
  expect(await frame.boundingBox()).toEqual(original);

  const rect = (await title.boundingBox())!;
  await page.mouse.move(rect.x + 70, rect.y + 16);
  await page.mouse.down();
  await page.mouse.move(rect.x + 170, rect.y + 16, { steps: 5 });
  await expect(frame).toHaveClass(/is-dragging/);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await expect(frame).not.toHaveClass(/is-dragging/);
  expect(await frame.boundingBox()).toEqual(original);

  await dragWindow(page, frame, -80, 0);
  await title.dblclick({ position: { x: 70, y: 16 } });
  expect(await frame.boundingBox()).toEqual(original);
});

test('copy, replay, and text selection do not move the window', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const frame = page.locator(heroSelector);
  await frame.locator('[data-copy-code]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    'Spirited Away',
  );
  await frame.locator('[data-replay]').click();
  await expect(frame.locator('[data-replay]')).toBeEnabled();
  await expect(frame).not.toHaveClass(/is-displaced/);
  const source = (await frame.locator('.line-source').first().boundingBox())!;
  await page.mouse.move(source.x + 5, source.y + 8);
  await page.mouse.down();
  await page.mouse.move(source.x + 160, source.y + 8, { steps: 5 });
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.getSelection()?.toString().length),
  ).toBeGreaterThan(0);
  await expect(frame).not.toHaveClass(/is-displaced|is-dragging/);
});

test('other code windows move independently, including tabbed examples', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Template loop' }).click();
  const frame = page.locator('[data-demo="loop"]');
  await dragWindow(page, frame, 100, 0);
  await expect(frame).toHaveClass(/is-displaced/);
  await expect(page.locator(heroSelector)).not.toHaveClass(/is-displaced/);
  await page.getByRole('tab', { name: 'Template if' }).click();
  await expect(page.locator('[data-demo="if"]')).not.toHaveClass(
    /is-displaced/,
  );
  await page.getByRole('tab', { name: 'Template loop' }).click();
  await frame.locator('[data-reset-window]').click();
  await expect(frame).not.toHaveClass(/is-displaced/);
});

test('resize restores windows and mobile keeps native touch scrolling', async ({
  page,
}, testInfo) => {
  const frame = page.locator(heroSelector);
  await dragWindow(page, frame, 200, 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(frame).not.toHaveClass(/is-movable|is-displaced/);
  await expect(frame.locator('[data-reset-window]')).toBeHidden();
  await expect(frame.locator('.window-title')).toHaveCSS(
    'touch-action',
    'auto',
  );
  await expect(frame.locator('.window-title')).toHaveAttribute(
    'tabindex',
    '-1',
  );
  await dragWindow(page, frame, 80, 0);
  await expect(frame).not.toHaveClass(/is-displaced/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: testInfo.outputPath('mobile.png'),
    fullPage: true,
  });

  const cdp = await page.context().newCDPSession(page);
  const title = (await frame.locator('.window-title').boundingBox())!;
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 150, y: title.y + 16 }],
  });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 150, y: title.y + 16 - i * 25 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(20);
  await expect(frame).not.toHaveClass(/is-displaced/);
  await cdp.detach();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(frame).toHaveClass(/is-movable/);
  await expect(frame.locator('[data-reset-window]')).toBeVisible();
  await expect(frame.locator('[data-reset-window]')).toBeDisabled();
});
