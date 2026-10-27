import { describe, expect, test } from 'bun:test';
import { instructor_c1_l1 as plan } from '../src/data/instructor-curriculum/chapter1/c1-l1';
import { splitIntoVietnameseSentences } from '../src/utils/speechText';

describe('guided c1-l1 classroom', () => {
  const slides = [plan.opening, ...(plan.roadmap ? [plan.roadmap] : []), ...plan.sections.flatMap((section) => section.slides), plan.closing];

  test('every spoken sentence points to a valid, progressively revealed board entry', () => {
    for (const slide of slides) {
      const sentences = splitIntoVietnameseSentences(slide.narration);
      const sequence = slide.focusSequence ?? [];
      const entries = slide.visual.kind === 'worked-example'
        ? slide.visual.steps.length + 2
        : slide.visual.kind === 'text-slide'
          ? 1 + (slide.visual.points?.length ?? 0) + Number(Boolean(slide.visual.question))
          : 0;
      expect(sequence.length, slide.id).toBe(sentences.length);
      expect(new Set(sequence).size, slide.id).toBe(entries);
      expect(sequence.every((entry, index) => entry >= 0 && entry < entries && (index === 0 || entry >= sequence[index - 1])), slide.id).toBe(true);
      expect(sequence.at(-1), slide.id).toBe(entries - 1);
    }
  });

  test('highlighted code lines exist and each example has a readable sequence of steps', () => {
    for (const slide of slides) {
      if (slide.visual.kind !== 'worked-example') continue;
      const visual = slide.visual;
      expect(visual.steps.length, slide.id).toBeGreaterThanOrEqual(3);
      expect(visual.steps.length, slide.id).toBeLessThanOrEqual(4);
      if (slide.presentationRole === 'detail') {
        expect(Boolean(visual.exhibit.code) !== Boolean(visual.exhibit.rows?.length), slide.id).toBe(true);
      }
      expect(Boolean(visual.exhibit.code) && Boolean(visual.exhibit.rows?.length), slide.id).toBe(false);
      const lineCount = visual.exhibit.code?.split('\n').length ?? 0;
      for (const step of visual.steps) {
        expect((step.lines ?? []).every((line) => line > 0 && line <= lineCount), slide.id).toBe(true);
      }
    }
  });

  test('preserves saved checkpoint IDs and gives each section an applicable check', () => {
    expect(plan.sections.map((section) => section.id)).toEqual([
      'process-model', 'long-running-state', 'event-loop', 'hardware-latency', 'c10k', 'process-memory', 'production-application'
    ]);
    expect(new Set(slides.map((slide) => slide.id)).size).toBe(slides.length);
    for (const section of plan.sections) {
      expect(section.check.options).toHaveLength(4);
      expect(section.check.correctIndex).toBeGreaterThanOrEqual(0);
      expect(section.check.correctIndex).toBeLessThan(4);
      expect(section.check.explanation.length).toBeGreaterThan(100);
    }
  });
});
