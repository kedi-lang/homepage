// Timings are paced for readability, not model-latency measurements.
export function recordingTimeline<T extends { input: string; waitMs: number }>(
  steps: T[],
) {
  let cursor = 500;
  const timeline = steps.map((step) => {
    const start = cursor;
    const typedAt = start + step.input.length * 36;
    const outputAt = typedAt + step.waitMs;
    cursor = outputAt + 900;
    return { ...step, start, typedAt, outputAt };
  });
  return { timeline, duration: Math.ceil(cursor / 1000) * 1000 };
}

export function formatPlaybackTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
