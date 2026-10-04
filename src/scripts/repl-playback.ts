import { replTimeline, replDuration } from '../lib/repl-timeline';
import { initRecordedPlayback } from './recorded-playback';

export function initReplPlayback() {
  const player = document.querySelector<HTMLElement>('[data-repl-player]');
  if (!player) return;
  const finalPrompt = player.querySelector<HTMLElement>('.repl-final-prompt')!;
  const steps = Array.from(
    player.querySelectorAll<HTMLElement>('[data-repl-step]'),
  ).map((element) => ({
    input: element.querySelector<HTMLElement>('.repl-input')!,
    outputs: element.querySelectorAll<HTMLElement>('.repl-output'),
    waiting: element.querySelector<HTMLElement>('.repl-waiting'),
    tokens: Array.from(
      element.querySelectorAll<HTMLElement>('[data-repl-token]'),
    ).map((element) => ({ element, text: element.textContent! })),
  }));
  function render(position: number, playing: boolean, reducedMotion: boolean) {
    steps.forEach((step, index) => {
      const timing = replTimeline[index];
      const visible = position >= timing.start;
      const count = reducedMotion
        ? timing.input.length
        : Math.min(
            timing.input.length,
            Math.max(0, Math.floor((position - timing.start) / 36)),
          );
      step.input.style.visibility = visible ? 'visible' : 'hidden';
      step.input.classList.toggle(
        'is-typing',
        visible && position < timing.typedAt && playing,
      );
      if (step.waiting) {
        step.waiting.style.visibility =
          position >= timing.typedAt && position < timing.outputAt
            ? 'visible'
            : 'hidden';
      }
      let remaining = count;
      for (const token of step.tokens) {
        const text = token.text.slice(0, Math.max(0, remaining));
        if (token.element.textContent !== text)
          token.element.textContent = text;
        remaining -= token.text.length;
      }
      step.outputs.forEach((output) => {
        output.style.visibility =
          position >= timing.outputAt ? 'visible' : 'hidden';
      });
    });
    finalPrompt.style.visibility =
      position >= replDuration ? 'visible' : 'hidden';
  }
  initRecordedPlayback(player, {
    prefix: 'repl',
    label: 'recorded session',
    duration: replDuration,
    render,
  });
}
