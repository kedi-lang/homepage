import { highlight } from '../lib/highlight';

export function initCaptureDemo() {
  const demo = document.querySelector<HTMLElement>('[data-capture-demo]')!;
  const buttons = [
    ...demo.querySelectorAll<HTMLButtonElement>('[data-capture]'),
  ];
  let selected = 'output';
  const paint = (value: string) => {
    demo.dataset.selection = value;
    buttons.forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.capture === value),
      ),
    );
  };
  const choose = (button: HTMLButtonElement) => {
    selected = button.dataset.capture!;
    paint(selected);
  };
  buttons.forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => choose(button));
    button.addEventListener('focus', () => choose(button));
    button.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') paint(button.dataset.capture!);
    });
    button.addEventListener('pointerleave', () => paint(selected));
  });
}

export function initScopeInspector() {
  const demo = document.querySelector<HTMLElement>('[data-scope-demo]')!;
  const buttons = [...demo.querySelectorAll<HTMLButtonElement>('[data-scope]')];
  const panels = [...demo.querySelectorAll<HTMLElement>('[data-scope-panel]')];
  const lines = [...demo.querySelectorAll<HTMLElement>('[data-line]')];
  const select = (button: HTMLButtonElement) => {
    const selectedLines = new Set(button.dataset.lines!.split(','));
    buttons.forEach((item) =>
      item.setAttribute('aria-pressed', String(item === button)),
    );
    panels.forEach(
      (panel) =>
        (panel.hidden = panel.dataset.scopePanel !== button.dataset.scope),
    );
    lines.forEach((line) =>
      line.classList.toggle(
        'is-inspected',
        selectedLines.has(line.dataset.line!),
      ),
    );
  };
  buttons.forEach((button, index) => {
    button.disabled = false;
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', (event) => {
      let target: HTMLButtonElement | undefined;
      if (event.key === 'ArrowDown')
        target = buttons[(index + 1) % buttons.length];
      if (event.key === 'ArrowUp')
        target = buttons[(index - 1 + buttons.length) % buttons.length];
      if (event.key === 'Home') target = buttons[0];
      if (event.key === 'End') target = buttons.at(-1);
      if (target) {
        event.preventDefault();
        select(target);
        target.focus();
      }
    });
  });
  select(
    buttons.find((button) => button.getAttribute('aria-pressed') === 'true')!,
  );
}

export function initDecisionDemo() {
  const demo = document.querySelector<HTMLElement>('[data-decision-demo]')!;
  const slider = demo.querySelector<HTMLInputElement>('input[type="range"]')!;
  const reset = demo.querySelector<HTMLButtonElement>(
    '[data-reset-threshold]',
  )!;
  const source = demo.querySelector<HTMLTextAreaElement>('.copy-source')!;
  const original = source.value;
  const marker = 'churn >= 0.80';
  const sourceLines = original.split('\n');
  const lineIndex = sourceLines.findIndex((line) => line.includes(marker));
  const codeLine = demo.querySelector<HTMLElement>(
    `[data-line="${lineIndex + 1}"] .line-source`,
  )!;
  const probability = Number(demo.dataset.probability);
  const displayedProbability = probability.toFixed(2);
  const thresholdValue = demo.querySelector<HTMLOutputElement>(
    '[data-threshold-value]',
  )!;
  const comparison = demo.querySelector<HTMLElement>(
    '[data-decision-comparison]',
  )!;
  const result = demo.querySelector<HTMLElement>('[data-priority-result]')!;
  const resultRow = demo.querySelector<HTMLElement>('[data-priority]')!;

  const update = () => {
    const threshold = Number(slider.value) / 100;
    const formatted = threshold.toFixed(2);
    // Both sides use hundredths, including equality at the decision boundary.
    const priority = Math.round(probability * 100) >= Number(slider.value);
    slider.style.setProperty('--threshold', `${slider.value}%`);
    slider.setAttribute('aria-valuetext', formatted);
    thresholdValue.value = formatted;
    comparison.textContent = `${displayedProbability} >= ${formatted}`;
    result.textContent = `priority: ${priority ? 'True' : 'False'}`;
    resultRow.dataset.priority = String(priority);
    reset.disabled = slider.value === slider.defaultValue;
    source.value = original.replace(marker, `churn >= ${formatted}`);
    const updatedLine = sourceLines[lineIndex].replace(
      marker,
      `churn >= ${formatted}`,
    );
    codeLine.replaceChildren(
      ...highlight(updatedLine).map((token) => {
        const span = document.createElement('span');
        if (token.kind) span.className = `syntax-${token.kind}`;
        const offset =
          token.kind === 'python' ? token.text.indexOf(formatted) : -1;
        if (offset < 0) span.textContent = token.text;
        else {
          const value = document.createElement('mark');
          value.className = 'threshold-code-value';
          value.textContent = formatted;
          span.append(
            token.text.slice(0, offset),
            value,
            token.text.slice(offset + formatted.length),
          );
        }
        return span;
      }),
    );
  };
  slider.disabled = false;
  slider.addEventListener('input', update);
  reset.addEventListener('click', () => {
    slider.value = slider.defaultValue;
    update();
    slider.focus();
  });
  update();
}
