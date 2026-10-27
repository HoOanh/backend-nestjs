export interface NarrationPlaybackProgress {
  sentenceIndex: number;
  progress: number;
  elapsedSeconds: number;
}

interface SentenceTiming {
  segments: Array<{ start: number; end: number }>;
  complete: boolean;
  progress: number;
}

/** Measure audible time within a teaching focus, independent of sentence length. */
export class NarrationFocusClock {
  private focus: number | undefined;
  private startedAt = 0;

  read(focus: number | undefined, elapsedSeconds: number): number {
    if (focus !== this.focus) {
      this.focus = focus;
      this.startedAt = elapsedSeconds;
    }
    return Math.max(0, elapsedSeconds - this.startedAt);
  }
}

/** Reads the media clock, never wall time. Gaps between PCM buffers do not advance it. */
export class NarrationPlaybackClock {
  private readonly sentences = new Map<number, SentenceTiming>();
  constructor(private readonly estimatedSeconds: number[] = []) {}

  record(sentenceIndex: number, start: number, end: number): void {
    const timing = this.sentences.get(sentenceIndex) ?? { segments: [], complete: false, progress: 0 };
    timing.segments.push({ start, end });
    this.sentences.set(sentenceIndex, timing);
  }

  complete(sentenceIndex: number): void {
    const timing = this.sentences.get(sentenceIndex);
    if (timing) timing.complete = true;
  }

  read(now: number): NarrationPlaybackProgress | undefined {
    let current: NarrationPlaybackProgress | undefined;
    let elapsedSeconds = 0;
    for (const [sentenceIndex, timing] of this.sentences) {
      if (now < timing.segments[0].start) break;
      const total = timing.segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
      const played = timing.segments.reduce((sum, segment) => sum + Math.max(0, Math.min(segment.end, now) - segment.start), 0);
      elapsedSeconds += played;
      // Until the final chunk arrives, the sentence's true duration is unknown.
      // Reserve its final portion rather than claiming a partial buffer is a full sentence.
      const duration = timing.complete ? total : Math.max(total, this.estimatedSeconds[sentenceIndex] ?? total);
      const fraction = duration > 0 ? Math.min(timing.complete ? 1 : 0.9, played / duration) : 0;
      timing.progress = Math.max(timing.progress, Math.min(1, fraction));
      current = { sentenceIndex, progress: timing.progress, elapsedSeconds };
    }
    return current;
  }
}

export function narrationStageProgress(sequence: number[], sentenceIndex: number, sentenceProgress: number): number {
  const focus = sequence[sentenceIndex];
  if (focus === undefined) return 0;
  const first = sequence.indexOf(focus);
  const count = sequence.filter((entry) => entry === focus).length;
  return Math.max(0, Math.min(1, (sentenceIndex - first + sentenceProgress) / Math.max(1, count)));
}
