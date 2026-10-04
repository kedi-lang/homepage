import { test, expect } from '@playwright/test';
import { replDuration, replTimeline } from '../src/lib/repl-timeline';
import session from '../src/data/repl-session.json' with { type: 'json' };

test.beforeEach(async ({ page }) => {
  await page.goto('/#notebook');
  await page.getByRole('tab', { name: 'Terminal REPL', exact: true }).click();
  await page.locator('[data-repl-player]').scrollIntoViewIfNeeded();
});

test('recorded session plays once, pauses and resumes without any model request', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  const player = page.locator('[data-repl-player]');
  const commands = player.locator('.repl-live');
  await expect(commands.first()).toHaveText('> model: openai/gpt-6-luna');
  await expect(commands.nth(1)).toHaveText('>> [city] is the city of cats.');
  await expect(commands).toHaveText(session.steps.map((step) => step.input));
  await page.clock.install();
  await player
    .getByRole('button', { name: 'Play recorded session', exact: true })
    .click();
  await expect(player).toHaveAttribute('data-state', 'playing');
  await page.clock.runFor(1000);
  const partial = await commands.first().textContent();
  expect(partial!.length).toBeGreaterThan(0);
  expect(partial!.length).toBeLessThan(session.steps[0].input.length);
  await player
    .getByRole('button', { name: 'Pause recorded session', exact: true })
    .click();
  await expect(player).toHaveAttribute('data-state', 'paused');
  const position = await player.locator('input').inputValue();
  await page.clock.runFor(2000);
  await expect(player.locator('input')).toHaveValue(position);
  await player
    .getByRole('button', { name: 'Play recorded session', exact: true })
    .click();
  await page.clock.runFor(replDuration + 100);
  await expect(player).toHaveAttribute('data-state', 'complete');
  await expect(commands).toHaveText(session.steps.map((step) => step.input));
  await expect(player.locator('.repl-output')).toHaveText([
    'ISTANBUL',
    'Cats love Istanbul.',
  ]);
  await expect(player.locator('.repl-final-prompt')).toBeVisible();
  await page.clock.runFor(20000);
  await expect(player).toHaveAttribute('data-state', 'complete');
  expect(requests).toEqual([]);
});

test('seeking updates the transcript and remains paused; restart begins at zero', async ({
  page,
}) => {
  const player = page.locator('[data-repl-player]');
  const seek = player.getByRole('slider');
  await page.clock.install();
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  const target = replTimeline[2].outputAt + 50;
  await seek.evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, target);
  await expect(player).toHaveAttribute('data-state', 'paused');
  expect(Number(await seek.inputValue())).toBeGreaterThan(
    replTimeline[2].outputAt,
  );
  await expect(player.locator('.repl-output').first()).toBeVisible();
  await expect(player.locator('.repl-output').last()).toBeHidden();
  await seek.focus();
  await seek.press('End');
  await expect(player).toHaveAttribute('data-state', 'complete');
  await expect(player.locator('.repl-output').last()).toBeVisible();
  await seek.press('Home');
  await expect(seek).toHaveValue('0');
  await expect(player.locator('.repl-input').first()).toBeHidden();
  await player
    .getByRole('button', { name: 'Restart recorded session' })
    .click();
  await expect(player).toHaveAttribute('data-state', 'playing');
  await page.clock.runFor(800);
  expect(Number(await seek.inputValue())).toBeLessThan(1000);
});

test('model-call indicator appears only while waiting and respects pause and reduced motion', async ({
  page,
}) => {
  const player = page.locator('[data-repl-player]');
  const indicator = player.locator('.repl-waiting');
  const spinner = indicator.locator('svg');
  await expect(indicator).toBeHidden();
  await page.clock.install();
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  await page.clock.runFor(replTimeline[1].typedAt - 100);
  await expect(indicator).toBeHidden();
  await page.clock.runFor(200);
  await expect(indicator).toBeVisible();
  const placement = await indicator.evaluate((element) => {
    const tokens = element.parentElement!.querySelectorAll('[data-repl-token]');
    const textRects = tokens[tokens.length - 1].getClientRects();
    const text = textRects[textRects.length - 1];
    const icon = element.getBoundingClientRect();
    return {
      gap: icon.left - text.right,
      vertical: Math.abs(icon.bottom - text.bottom),
    };
  });
  expect(placement.gap).toBeGreaterThanOrEqual(7);
  expect(placement.gap).toBeLessThanOrEqual(10);
  expect(placement.vertical).toBeLessThanOrEqual(6);
  await expect(spinner).toHaveCSS('animation-play-state', 'running');
  await player.getByRole('button', { name: 'Pause recorded session' }).click();
  await expect(indicator).toBeVisible();
  await expect(spinner).toHaveCSS('animation-play-state', 'paused');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(spinner).toHaveCSS('animation-name', 'none');
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  await page.clock.runFor(2200);
  await expect(indicator).toBeHidden();
});

test('switching tabs and pausing page motion stop playback without restarting it', async ({
  page,
}) => {
  const player = page.locator('[data-repl-player]');
  await page.clock.install();
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  await page.clock.runFor(1000);
  await page.getByRole('tab', { name: 'Notebook', exact: true }).click();
  await expect(player).toHaveAttribute('data-state', 'paused');
  const position = await player.locator('input').inputValue();
  await page.clock.runFor(3000);
  await page.getByRole('tab', { name: 'Terminal REPL', exact: true }).click();
  await expect(player.locator('input')).toHaveValue(position);
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(player).toHaveAttribute('data-state', 'paused');
});

test('reduced motion reveals complete lines instead of animated typing', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  const player = page.locator('[data-repl-player]');
  await player.getByRole('button', { name: 'Play recorded session' }).click();
  await page.clock.runFor(600);
  await expect(player.locator('.repl-live').first()).toHaveText(
    session.steps[0].input,
  );
  await expect(player.locator('.repl-input').nth(1)).toBeHidden();
});

test('full transcript is available to assistive technology independently of playback', async ({
  page,
}) => {
  const transcript = page.getByLabel('Recorded Kedi session');
  await expect(transcript).toContainText('Cats love Istanbul.');
  await expect(transcript).toContainText('ISTANBUL');
  await page.getByRole('button', { name: 'Play recorded session' }).click();
  await expect(transcript).toContainText('Cats love Istanbul.');
  await expect(page.locator('.repl-screen')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
});

for (const width of [320, 390, 768, 1440]) {
  test(`terminal keeps a stable, readable layout at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.evaluate(() => document.fonts.ready);
    const player = page.locator('[data-repl-player]');
    await player.scrollIntoViewIfNeeded();
    const initial = (await player.boundingBox())!;
    expect(initial.height).toBeLessThanOrEqual(width <= 390 ? 380 : 330);
    const welcome = (await player.locator('.repl-welcome').boundingBox())!;
    const firstInput = (await player
      .locator('.repl-input')
      .first()
      .boundingBox())!;
    expect(firstInput.y - welcome.y - welcome.height).toBeLessThanOrEqual(10);
    await player.screenshot({
      path: testInfo.outputPath(`repl-${width}.png`),
      animations: 'disabled',
    });
    await page.clock.install();
    await player.getByRole('button', { name: 'Play recorded session' }).click();
    for (const step of replTimeline) {
      await player.getByRole('slider').evaluate((element, value) => {
        (element as HTMLInputElement).value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }, step.start + 300);
      const playing = (await player.boundingBox())!;
      expect(playing.height).toBe(initial.height);
      expect(playing.width).toBe(initial.width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });
}
