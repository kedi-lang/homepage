import { test, expect } from '@playwright/test';
import {
  notebookTimeline,
  notebookDuration,
} from '../src/lib/notebook-timeline';
import session from '../src/data/notebook-session.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.goto('/#notebook');
  await page.locator('[data-notebook-player]').scrollIntoViewIfNeeded();
});

test('cell copy uses the complete source during playback and restores its feedback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const player = page.locator('[data-notebook-player]');
  await page.clock.install();
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await page.clock.runFor(900);
  for (const [index, step] of session.steps.entries()) {
    const copy = player.getByRole('button', {
      name: `Copy notebook cell ${index + 1}`,
    });
    await copy.click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      step.input,
    );
    await expect(copy).toHaveClass(/is-copied/);
    await expect(copy).toHaveAttribute('data-tooltip', 'Copied');
    await expect(
      player.locator('.notebook-copy-fallback').nth(index),
    ).toBeHidden();
  }
  const copy = player.getByRole('button', { name: 'Copy notebook cell 1' });
  await page.clock.runFor(1000);
  await copy.click();
  await page.clock.runFor(800);
  await expect(copy).toHaveClass(/is-copied/);
  await page.clock.runFor(900);
  await expect(copy).not.toHaveClass(/is-copied/);
  await expect(copy).toHaveAttribute('data-tooltip', 'Copy cell');
});

test('clipboard denial exposes selectable complete source without duplicating animated text', async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Permission denied', 'NotAllowedError');
        },
      },
    });
  });
  const player = page.locator('[data-notebook-player]');
  const copy = player.getByRole('button', { name: 'Copy notebook cell 1' });
  await copy.click();
  const fallback = player.locator('.notebook-copy-fallback').first();
  const source = fallback.getByRole('textbox');
  await expect(fallback).toBeVisible();
  await expect(source).toHaveValue(session.steps[0].input);
  await expect(source).toBeFocused();
  expect(
    await source.evaluate(
      (el: HTMLTextAreaElement) => el.selectionEnd - el.selectionStart,
    ),
  ).toBe(session.steps[0].input.length);
  await expect(copy).toBeEnabled();
  await expect(copy).not.toHaveClass(/is-copied/);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
  });
  await copy.click();
  await expect(fallback).toBeHidden();
  await expect(copy).toHaveClass(/is-copied/);
});

test('touch controls remain usable without overlapping code', async ({
  browser,
  baseURL,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto('/#notebook');
  const player = page.locator('[data-notebook-player]');
  await player.scrollIntoViewIfNeeded();
  for (const button of await player.locator('.icon-button').all()) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await player.screenshot({
    path: testInfo.outputPath('notebook-touch.png'),
    animations: 'disabled',
  });
  await player.getByRole('button', { name: 'Replay notebook cell 2' }).tap();
  await expect(player).toHaveAttribute('data-state', 'playing');
  await context.close();
});

test('notebook replays real cell outputs in order without model requests', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  const player = page.locator('[data-notebook-player]');
  const cells = player.locator('[data-notebook-cell]');
  await expect(player.locator('.notebook-live')).toHaveText(
    session.steps.flatMap((step) => step.input.split('\n')),
  );
  await expect(player.locator('samp')).toHaveText(session.steps[1].output);
  await expect(player).toHaveAttribute('data-state', 'ready');
  await page.clock.install();
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await expect(cells.first()).toHaveAttribute('data-phase', 'queued');
  await expect(player.locator('samp')).toBeHidden();
  await page.clock.runFor(1000);
  await expect(cells.first()).toHaveAttribute('data-phase', 'editing');
  const partial = await player.locator('.notebook-live').first().textContent();
  expect(partial!.length).toBeGreaterThan(0);
  expect(partial!.length).toBeLessThan(
    session.steps[0].input.split('\n')[0].length,
  );
  await page.clock.runFor(notebookTimeline[0].typedAt - 900);
  await expect(cells.first()).toHaveAttribute('data-phase', 'running');
  await expect(player.locator('[data-notebook-runtime]')).toHaveText(
    'Running cell 1',
  );
  await expect(cells.first().locator('.notebook-cell-state svg')).toBeVisible();
  await expect(cells.last()).toHaveAttribute('data-phase', 'queued');
  await player
    .getByRole('button', { name: 'Pause notebook session', exact: true })
    .click();
  const position = await player.getByRole('slider').inputValue();
  await page.clock.runFor(1000);
  await expect(player.getByRole('slider')).toHaveValue(position);
  await expect(player.locator('[data-notebook-runtime]')).toHaveText('Paused');
  await expect(cells.first().locator('.notebook-cell-state svg')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await page.clock.runFor(notebookDuration);
  await expect(player).toHaveAttribute('data-state', 'complete');
  await expect(player.locator('samp')).toBeVisible();
  await expect(player.locator('[data-notebook-runtime]')).toHaveText('Ready');
  await expect(player.locator('.notebook-cell-output')).toHaveCount(1);
  await page.clock.runFor(10000);
  await expect(player).toHaveAttribute('data-state', 'complete');
  expect(requests).toEqual([]);
});

test('individual cell replay preserves prior cells and supports scrubbing and restart', async ({
  page,
}) => {
  const player = page.locator('[data-notebook-player]');
  await page.clock.install();
  await player.getByRole('button', { name: 'Replay notebook cell 2' }).click();
  await expect(player.locator('[data-notebook-cell="0"]')).toHaveAttribute(
    'data-phase',
    'complete',
  );
  await expect(player.locator('[data-notebook-cell="1"]')).toHaveAttribute(
    'data-phase',
    'editing',
  );
  await expect(player.locator('samp')).toBeHidden();
  expect(
    Number(await player.getByRole('slider').inputValue()),
  ).toBeGreaterThanOrEqual(notebookTimeline[1].start - 50);
  const slider = player.getByRole('slider');
  await slider.focus();
  await slider.press('End');
  await expect(player).toHaveAttribute('data-state', 'complete');
  await expect(player.locator('samp')).toBeVisible();
  await slider.press('Home');
  await expect(player).toHaveAttribute('data-state', 'paused');
  await expect(slider).toHaveValue('0');
  await expect(player.locator('.notebook-live').first()).toBeHidden();
  await player
    .getByRole('button', { name: 'Restart notebook session' })
    .click();
  await page.clock.runFor(800);
  expect(Number(await slider.inputValue())).toBeLessThan(1000);
});

test('notebook pauses when hidden or page motion is paused', async ({
  page,
}) => {
  const player = page.locator('[data-notebook-player]');
  await page.clock.install();
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await page.clock.runFor(1000);
  await page.getByRole('tab', { name: 'Terminal REPL', exact: true }).click();
  await expect(player).toHaveAttribute('data-state', 'paused');
  const position = await player
    .getByRole('slider', { includeHidden: true })
    .inputValue();
  await page.clock.runFor(3000);
  await page.getByRole('tab', { name: 'Notebook', exact: true }).click();
  await expect(player.getByRole('slider')).toHaveValue(position);
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(player).toHaveAttribute('data-state', 'paused');
});

test('reduced motion and assistive transcript do not depend on animated characters', async ({
  page,
}) => {
  const player = page.locator('[data-notebook-player]');
  const transcript = page.getByLabel('Recorded Kedi Notebook session');
  await expect(transcript).toContainText(session.steps[1].output[0]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await player
    .getByRole('button', { name: 'Play notebook session', exact: true })
    .click();
  await page.clock.runFor(600);
  await expect(player.locator('.notebook-live').first()).toHaveText(
    session.steps[0].input.split('\n')[0],
  );
  await expect(player.locator('.notebook-live').last()).toBeHidden();
  await expect(player.locator('.notebook-cell-state svg').first()).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(transcript).toContainText(session.steps[1].output[0]);
});

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`notebook stays compact and stable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => document.fonts.ready);
    const player = page.locator('[data-notebook-player]');
    await player.scrollIntoViewIfNeeded();
    const initial = (await player.boundingBox())!;
    expect(initial.height).toBeLessThan(480);
    await expect(player.locator('img')).toHaveJSProperty('complete', true);
    expect(
      await player
        .locator('img')
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBeGreaterThan(0);
    await player.screenshot({
      path: testInfo.outputPath(`notebook-${width}.png`),
      animations: 'disabled',
    });
    await page.clock.install();
    await player
      .getByRole('button', { name: 'Play notebook session', exact: true })
      .click();
    for (const step of notebookTimeline) {
      for (const position of [
        step.start + 300,
        step.typedAt + 100,
        step.outputAt + 100,
      ]) {
        await player.getByRole('slider').evaluate((element, value) => {
          (element as HTMLInputElement).value = String(value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }, position);
        const size = (await player.boundingBox())!;
        expect(size.height).toBe(initial.height);
        expect(size.width).toBe(initial.width);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    }
    if (width === 390 || width === 1440) {
      await page.locator('#notebook').screenshot({
        path: testInfo.outputPath(`notebook-section-${width}.png`),
        animations: 'disabled',
      });
    }
  });
}
