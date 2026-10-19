import { describe, expect, test } from 'bun:test';
import { instructor_c1_l1 } from '../src/data/instructor-curriculum/chapter1/c1-l1.ts';
import { splitIntoVietnameseSentences } from '../src/services/vietnameseVoiceService.ts';
import { buildStableFocusSequence, resolveFocusCue, resolveFocusSequenceIndex } from '../src/components/classroom/focusSequence.ts';

describe('resolveFocusSequenceIndex', () => {
  test('follows authored beats without moving backward', () => {
    expect(resolveFocusSequenceIndex(3, 0, 5, 2)).toBe(3);
    expect(resolveFocusSequenceIndex(1, 4, 5, 3)).toBe(3);
  });

  test('limits inferred focus to one item per spoken sentence', () => {
    expect(resolveFocusSequenceIndex(undefined, 4, 5, -1)).toBe(0);
    expect(resolveFocusSequenceIndex(undefined, 4, 5, 0)).toBe(1);
    expect(resolveFocusSequenceIndex(undefined, 2, 5, 1)).toBe(2);
  });

  test('holds focus when there is no semantic match', () => {
    expect(resolveFocusSequenceIndex(undefined, -1, 5, 2)).toBe(2);
  });

  test('clamps planned focus to visible entries', () => {
    expect(resolveFocusSequenceIndex(8, 0, 4, -1)).toBe(3);
    expect(resolveFocusSequenceIndex(0, 0, 0, -1)).toBe(-1);
  });

  test('precomputes a stable, non-regressing timeline from all spoken sentences', () => {
    expect(buildStableFocusSequence([4, 1, 4, 0], 5)).toEqual([0, 1, 2, 2]);
    expect(buildStableFocusSequence([4, 0, 3], 5, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('opening and roadmap focus maps cover each narrated sentence and visible entry', () => {
    for (const slide of [instructor_c1_l1.opening, instructor_c1_l1.roadmap]) {
      const sentences = splitIntoVietnameseSentences(slide.narration);
      const sequence = slide.focusSequence ?? [];
      const entryCount = slide.visual.kind === 'text-slide'
        ? 1 + (slide.visual.metrics?.length ?? 0) + (slide.visual.points?.length ?? 0) + Number(Boolean(slide.visual.question))
        : 0;

      expect(sequence).toHaveLength(sentences.length);
      expect(sequence.every((index) => index >= 0 && index < entryCount)).toBe(true);
      expect(sequence.every((index, position) => position === 0 || index >= sequence[position - 1])).toBe(true);
    }
  });

  test('shows the default red highlight for inferred focus and respects explicit cue choices', () => {
    expect(resolveFocusCue(undefined, 1)).toBe('highlight');
    expect(resolveFocusCue(['none', 'circle'], 1)).toBe('circle');
    expect(resolveFocusCue(['none'], 0)).toBe('none');
    expect(resolveFocusCue(undefined, -1)).toBe('none');
  });
});
