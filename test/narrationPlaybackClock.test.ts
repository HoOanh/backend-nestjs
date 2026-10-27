import { describe, expect, test } from 'bun:test';
import { NarrationPlaybackClock, narrationStageProgress } from '../src/services/narrationPlaybackClock';
import { classroomPreparationState } from '../src/components/classroom/preparationState';

describe('media-driven narration and drawing', () => {
  test('does not advance before audio starts or across an underrun gap', () => {
    const clock = new NarrationPlaybackClock([4]);
    clock.record(0, 10, 11);
    expect(clock.read(9)).toBeUndefined();
    expect(clock.read(10.5)?.progress).toBeCloseTo(0.125);
    const atGap = clock.read(11)?.progress;
    expect(clock.read(14)?.progress).toBe(atGap);
    clock.record(0, 15, 18);
    clock.complete(0);
    expect(clock.read(16)?.progress).toBeCloseTo(0.5);
    expect(clock.read(18)?.progress).toBe(1);
  });

  test('follows scheduled playback-rate-adjusted audio and keeps sentences separate', () => {
    const clock = new NarrationPlaybackClock();
    clock.record(0, 0, 2); // Four seconds of samples played at 2x.
    clock.complete(0);
    clock.record(1, 2, 6);
    clock.complete(1);
    expect(clock.read(1)).toEqual({ sentenceIndex: 0, progress: 0.5 });
    expect(clock.read(4)).toEqual({ sentenceIndex: 1, progress: 0.5 });
  });

  test('new streamed chunks cannot rewind a sentence or falsely finish it', () => {
    const clock = new NarrationPlaybackClock();
    clock.record(0, 0, 1);
    const before = clock.read(1)?.progress ?? 0;
    expect(before).toBeLessThan(1);
    clock.record(0, 1, 5);
    expect(clock.read(1)?.progress).toBeGreaterThanOrEqual(before);
    clock.complete(0);
    expect(clock.read(5)?.progress).toBe(1);
  });

  test('a multi-sentence teaching beat spreads ink over all its spoken sentences', () => {
    const sequence = [0, 0, 1, 1, 1, 1, 2];
    expect(narrationStageProgress(sequence, 2, 0.5)).toBe(0.125);
    expect(narrationStageProgress(sequence, 4, 0.5)).toBe(0.625);
    expect(narrationStageProgress(sequence, 5, 1)).toBe(1);
  });
});

describe('classroom preparation gate', () => {
  const base = { loadedBytes: 100, totalBytes: 100 };
  test('keeps the gate through cached initialization and first audio generation', () => {
    expect(classroomPreparationState({ ...base, status: 'loading', phase: 'preparing' }, false, null)?.phase).toBe('preparing');
    expect(classroomPreparationState({ ...base, status: 'ready' }, false, null)?.phase).toBe('buffering');
    expect(classroomPreparationState({ ...base, status: 'ready' }, true, null)).toBeNull();
  });
  test('shows errors instead of pretending a loaded model is playable audio', () => {
    expect(classroomPreparationState({ ...base, status: 'ready' }, false, 'empty stream')?.status).toBe('error');
    expect(classroomPreparationState({ ...base, status: 'error' }, false, null)?.status).toBe('error');
  });
});
