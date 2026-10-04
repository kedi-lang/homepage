import session from '../data/repl-session.json' with { type: 'json' };
import { recordingTimeline } from './recording';
export { formatPlaybackTime as formatReplTime } from './recording';
export const { timeline: replTimeline, duration: replDuration } =
  recordingTimeline(session.steps);
