import session from '../data/notebook-session.json' with { type: 'json' };
import { recordingTimeline } from './recording';

export const { timeline: notebookTimeline, duration: notebookDuration } =
  recordingTimeline(session.steps);
