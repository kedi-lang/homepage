import { notebookTimeline, notebookDuration } from '../lib/notebook-timeline';
import { initRecordedPlayback } from './recorded-playback';

export function initNotebookPlayback() {
  const player = document.querySelector<HTMLElement>('[data-notebook-player]');
  if (!player) return;
  const runtime = player.querySelector<HTMLElement>('[data-notebook-runtime]')!;
  const cells = Array.from(
    player.querySelectorAll<HTMLElement>('[data-notebook-cell]'),
  ).map((element) => ({
    element,
    status: element.querySelector<HTMLElement>('[data-notebook-cell-status]')!,
    output: element.querySelector<HTMLElement>('.notebook-cell-output'),
    lines: Array.from(
      element.querySelectorAll<HTMLElement>('[data-notebook-line]'),
    ).map((element) => ({
      element,
      live: element.querySelector<HTMLElement>('.notebook-live')!,
      tokens: Array.from(
        element.querySelectorAll<HTMLElement>('[data-notebook-token]'),
      ).map((element) => ({ element, text: element.textContent! })),
    })),
  }));

  function render(position: number, playing: boolean, reducedMotion: boolean) {
    let active = 'Ready';
    cells.forEach((cell, index) => {
      const timing = notebookTimeline[index];
      const phase =
        position < timing.start
          ? 'queued'
          : position < timing.typedAt
            ? 'editing'
            : position < timing.outputAt
              ? 'running'
              : 'complete';
      cell.element.dataset.phase = phase;
      cell.status.textContent = {
        queued: 'Queued',
        editing: 'Editing',
        running: 'Running',
        complete: 'Done',
      }[phase];
      if (phase === 'editing' || phase === 'running')
        active = `${phase === 'running' ? 'Running' : 'Editing'} cell ${index + 1}`;
      let remaining = reducedMotion
        ? timing.input.length
        : Math.max(0, Math.floor((position - timing.start) / 36));
      cell.lines.forEach((line) => {
        line.live.style.visibility = phase === 'queued' ? 'hidden' : 'visible';
        const length = line.tokens.reduce(
          (sum, token) => sum + token.text.length,
          0,
        );
        line.element.classList.toggle(
          'is-typing',
          phase === 'editing' &&
            playing &&
            !reducedMotion &&
            remaining >= 0 &&
            remaining < length,
        );
        for (const token of line.tokens) {
          const text = token.text.slice(0, Math.max(0, remaining));
          if (token.element.textContent !== text)
            token.element.textContent = text;
          remaining -= token.text.length;
        }
        remaining -= 1; // Account for the newline between editor lines.
      });
      if (cell.output)
        cell.output.style.visibility =
          phase === 'complete' ? 'visible' : 'hidden';
    });
    runtime.textContent =
      !playing && position < notebookDuration ? 'Paused' : active;
  }

  const playback = initRecordedPlayback(player, {
    prefix: 'notebook',
    label: 'notebook session',
    duration: notebookDuration,
    render,
  });
  player
    .querySelectorAll<HTMLButtonElement>('[data-notebook-cell-play]')
    .forEach((button) => {
      button.disabled = false;
      button.addEventListener('click', () =>
        playback.playFrom(
          notebookTimeline[Number(button.dataset.notebookCellPlay)].start,
        ),
      );
    });
}
