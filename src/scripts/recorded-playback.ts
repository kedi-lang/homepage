import { formatPlaybackTime } from '../lib/recording';

interface PlaybackOptions {
  prefix: 'repl' | 'notebook';
  label: string;
  duration: number;
  render: (position: number, playing: boolean, reducedMotion: boolean) => void;
}

export function initRecordedPlayback(
  root: HTMLElement,
  { prefix, label, duration, render }: PlaybackOptions,
) {
  const toggle = root.querySelector<HTMLButtonElement>(
    `[data-${prefix}-toggle]`,
  )!;
  const restart = root.querySelector<HTMLButtonElement>(
    `[data-${prefix}-restart]`,
  )!;
  const seek = root.querySelector<HTMLInputElement>(`[data-${prefix}-seek]`)!;
  const clock = root.querySelector<HTMLElement>(`[data-${prefix}-time]`)!;
  const status = root.querySelector<HTMLElement>(`[data-${prefix}-status]`)!;
  const panel = root.closest<HTMLElement>('[role="tabpanel"]')!;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let position = duration;
  let playing = false;
  let frame: number | undefined;
  let startedAt = 0;

  function paint() {
    render(position, playing, reducedMotion.matches);
    seek.value = String(position);
    const time = formatPlaybackTime(position);
    clock.textContent = time;
    seek.setAttribute(
      'aria-valuetext',
      `${time} of ${formatPlaybackTime(duration)}`,
    );
  }

  function syncControls() {
    root.dataset.state = playing
      ? 'playing'
      : position >= duration
        ? 'complete'
        : 'paused';
    toggle.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${label}`);
    toggle.dataset.tooltip = playing ? 'Pause session' : 'Play session';
  }

  function pause() {
    if (!playing) return;
    position = Math.min(duration, performance.now() - startedAt);
    playing = false;
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
    syncControls();
    paint();
    status.textContent = 'Playback paused.';
  }

  function tick(now: number) {
    position = Math.min(duration, now - startedAt);
    if (position >= duration) {
      playing = false;
      frame = undefined;
      syncControls();
      status.textContent = 'Recorded session complete.';
    } else {
      frame = window.requestAnimationFrame(tick);
    }
    paint();
  }

  function playFrom(nextPosition = position >= duration ? 0 : position) {
    if (playing) pause();
    position = Math.max(0, Math.min(duration, nextPosition));
    playing = true;
    startedAt = performance.now() - position;
    syncControls();
    paint();
    status.textContent = 'Playing recorded session.';
    frame = window.requestAnimationFrame(tick);
  }

  toggle.disabled = restart.disabled = seek.disabled = false;
  toggle.addEventListener('click', () => (playing ? pause() : playFrom()));
  restart.addEventListener('click', () => playFrom(0));
  seek.addEventListener('input', () => {
    const nextPosition = Number(seek.value);
    pause();
    position = nextPosition;
    syncControls();
    paint();
  });
  new MutationObserver(() => {
    if (panel.hidden) pause();
  }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) pause();
  }).observe(root);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  document.addEventListener('kedi:motion-change', (event) => {
    if ((event as CustomEvent<boolean>).detail) pause();
  });
  reducedMotion.addEventListener('change', () => {
    pause();
    paint();
  });
  paint();
  return { playFrom };
}
