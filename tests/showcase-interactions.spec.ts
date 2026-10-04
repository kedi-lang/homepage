import { test, expect } from '@playwright/test';
import examples from '../src/data/examples.json' with { type: 'json' };

test('scope inspector matches the example and highlights only the selected source', async ({
  page,
}) => {
  await page.goto('/');
  const selected = page.locator(
    '[data-demo="agent"] .is-inspected .line-source',
  );
  await expect(page.locator('[data-scope="researcher"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(selected).toHaveText(
    examples.agent.code.split('\n').slice(3, 7),
  );
  await expect(page.locator('#scope-researcher')).toContainText('list[str]');
  await page.locator('[data-scope="editor"]').click();
  await expect(page.locator('#scope-editor')).toBeVisible();
  await expect(page.locator('#scope-researcher')).toBeHidden();
  await expect(selected).toHaveText(
    [8, 9, 11, 12].map((index) => examples.agent.code.split('\n')[index]),
  );
  await expect(page.locator('#scope-editor')).toContainText(
    'CAPTURE AT THE CALL SITE',
  );
  await page.locator('[data-scope="file"]').click();
  await expect(selected).toHaveText([
    '> import: filesystem',
    '  > use: read_text_file',
  ]);
  await expect(page.locator('#scope-file')).toContainText('filesystem');
  await expect(page.locator('[data-scope][aria-pressed="true"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-demo="agent"] .copy-source')).toHaveValue(
    examples.agent.code,
  );
});

test('scope inspector supports keyboard selection and serves the exact source', async ({
  page,
}) => {
  await page.goto('/');
  const researcher = page.locator('[data-scope="researcher"]');
  await researcher.focus();
  await researcher.press('ArrowDown');
  await expect(page.locator('[data-scope="file"]')).toBeFocused();
  await expect(page.locator('#scope-file')).toBeVisible();
  await page.locator('[data-scope="file"]').press('Home');
  await expect(page.locator('[data-scope="editor"]')).toBeFocused();
  await expect(page.locator('#scope-editor')).toBeVisible();
  await page.locator('[data-scope="editor"]').press('ArrowUp');
  await expect(page.locator('[data-scope="file"]')).toBeFocused();
  const source = await page.request.get('/examples/release_team.kedi');
  expect(source.ok()).toBe(true);
  await expect(
    page.getByRole('link', { name: 'Download release team source' }),
  ).toHaveAttribute('download', 'release_team.kedi');
  expect(await source.text()).toBe(examples.agent.code + '\n');
});

test('capture selection links input and output without altering the program', async ({
  page,
}) => {
  await page.goto('/');
  const demo = page.locator('[data-capture-demo]');
  const input = page.getByRole('button', { name: 'Inspect note input' });
  const output = page.getByRole('button', { name: 'Inspect action capture' });
  await expect(demo).toHaveAttribute('data-selection', 'output');
  await input.hover();
  await expect(demo).toHaveAttribute('data-selection', 'input');
  await page.locator('#language-title').hover();
  await expect(demo).toHaveAttribute('data-selection', 'output');
  await input.click();
  await page.locator('#language-title').hover();
  await expect(input).toHaveAttribute('aria-pressed', 'true');
  await input.press('Tab');
  await expect(output).toBeFocused();
  await expect(demo).toHaveAttribute('data-selection', 'output');
  await expect(page.locator('.capture-values .value-result')).toHaveText(
    examples.template.values.map((value) => value.value),
  );
  await expect(page.locator('[data-demo="template"] .copy-source')).toHaveValue(
    examples.template.code,
  );
  await expect(page.locator('[data-demo="template"] .result-body')).toHaveCount(
    0,
  );
});

test('decision threshold handles equality and endpoints without model requests', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/', { waitUntil: 'networkidle' });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType()))
      requests.push(request.url());
  });
  const slider = page.getByRole('slider', { name: 'Priority threshold' });
  await expect(slider).toBeEnabled();
  for (const value of [0, 93, 94, 100]) {
    await slider.fill(String(value));
    const threshold = (value / 100).toFixed(2);
    await expect(slider).toHaveAttribute('aria-valuetext', threshold);
    await expect(page.locator('[data-threshold-value]')).toHaveText(threshold);
    await expect(page.locator('[data-priority-result]')).toHaveText(
      `priority: ${value <= 93 ? 'True' : 'False'}`,
    );
    await expect(
      page.locator('[data-demo="jev"] .threshold-code-value'),
    ).toHaveText(threshold);
    await expect(page.locator('[data-demo="jev"] .value-result')).toHaveText([
      'billing',
      '0.93',
    ]);
  }
  await page.getByRole('button', { name: 'Copy ticket_triage.kedi' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    examples.jev.code.replace('>= 0.80', '>= 1.00'),
  );
  await page.getByRole('button', { name: 'Reset priority threshold' }).click();
  await expect(slider).toHaveValue('80');
  await expect(slider).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Reset priority threshold' }),
  ).toBeDisabled();
  await expect(page.locator('[data-demo="jev"] .copy-source')).toHaveValue(
    examples.jev.code,
  );
  await slider.press('ArrowRight');
  await expect(page.locator('[data-threshold-value]')).toHaveText('0.81');
  expect(requests).toEqual([]);
});

test('showcases have readable static fallbacks without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    await expect(page.locator('#scope-researcher')).toBeVisible();
    await expect(page.locator('[data-scope="researcher"]')).toBeDisabled();
    await expect(
      page.getByRole('slider', { name: 'Priority threshold' }),
    ).toBeDisabled();
    await expect(page.locator('[data-priority-result]')).toHaveText(
      'priority: True',
    );
    await expect(page.locator('.capture-values .value-result')).toHaveText(
      examples.template.values.map((value) => value.value),
    );
  } finally {
    await context.close();
  }
});

test('touch selection and the native slider work on mobile', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4322/');
    await page.getByRole('button', { name: 'Inspect note input' }).tap();
    await expect(page.locator('[data-capture-demo]')).toHaveAttribute(
      'data-selection',
      'input',
    );
    await page.locator('[data-scope="file"]').tap();
    await expect(page.locator('#scope-file')).toBeVisible();
    const slider = page.getByRole('slider', { name: 'Priority threshold' });
    await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width - 3, box.y + box.height / 2);
    await expect(page.locator('[data-priority-result]')).toHaveText(
      'priority: False',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  } finally {
    await context.close();
  }
});

for (const width of [320, 390, 768, 1440]) {
  test(`interactive showcase layout remains stable at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const inspector = page.locator('.scope-inspector');
    const initial = (await inspector.boundingBox())!;
    for (const scope of ['editor', 'file', 'researcher']) {
      await page.locator(`[data-scope="${scope}"]`).click();
      const current = (await inspector.boundingBox())!;
      expect(Math.abs(current.height - initial.height)).toBeLessThan(1);
      expect(current.x).toBeGreaterThanOrEqual(0);
      expect(current.x + current.width).toBeLessThanOrEqual(width);
    }
    for (const section of ['language', 'agents', 'jev']) {
      await page.locator(`#${section}`).screenshot({
        path: testInfo.outputPath(`${section}-${width}.png`),
        animations: 'disabled',
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  });
}
