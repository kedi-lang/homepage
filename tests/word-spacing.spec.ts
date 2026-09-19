import { test, expect } from '@playwright/test';

for (const width of [320, 390, 768, 1440]) {
  test(`responsive line breaks preserve word spacing at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    const sentences = [
      ['#language-title', 'From a sentence to a typed value.'],
      [
        '#language .section-intro',
        'The context, the question, and the shape of the answer. All in the same line of your program.',
      ],
      ['.section-aside h3', 'Not a string you have to untangle.'],
      ['.claim-text', 'Does this API change need a migration?'],
      ['#compose-panel-python h3', 'A backtick away from Python.'],
    ];
    for (const [selector, text] of sentences) {
      await expect(page.locator(selector)).toHaveText(text, {
        useInnerText: true,
      });
    }
    await page.locator('#compose-panel-python .composition-note').screenshot({
      path: testInfo.outputPath(`python-copy-${width}.png`),
      animations: 'disabled',
    });
    await page.getByRole('tab', { name: 'Procedures', exact: true }).click();
    await expect(page.locator('#compose-panel-procedure h3')).toHaveText(
      'A workflow you can call.',
      { useInnerText: true },
    );
    await page
      .locator('#compose-panel-procedure .composition-note')
      .screenshot({
        path: testInfo.outputPath(`procedure-copy-${width}.png`),
        animations: 'disabled',
      });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });
}
