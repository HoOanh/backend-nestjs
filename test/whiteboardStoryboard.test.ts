import { describe, expect, test } from 'bun:test';
import { instructor_c1_l1 as plan } from '../src/data/instructor-curriculum/chapter1/c1-l1';
import { createStoryboard } from '../src/components/classroom/whiteboard/storyboard';

describe('narration-driven whiteboard storyboards', () => {
  test('every authored slide has an explicit scene with stable stroke identities', () => {
    const slides = [plan.opening, plan.roadmap, ...plan.sections.flatMap((section) => section.slides), plan.closing];
    for (const slide of slides) {
      if (!slide || slide.visual.kind !== 'worked-example') throw new Error('Missing illustrated slide');
      const scene = slide.visual.storyboard;
      if (!scene) throw new Error(`Missing storyboard: ${slide.id}`);
      const first = createStoryboard(scene, 0);
      const last = createStoryboard(scene, 3);
      expect(new Set(last.strokes.map((stroke) => stroke.id)).size).toBe(last.strokes.length);
      expect(last.strokes.filter((stroke) => stroke.at === 0).map((stroke) => stroke.d)).toEqual(first.strokes.filter((stroke) => stroke.at === 0).map((stroke) => stroke.d));
      for (let phase = 0; phase <= 3; phase += 1) {
        expect(last.strokes.some((stroke) => stroke.at === phase), `${slide.id}: phase ${phase}`).toBe(true);
      }
    }
  });

  test('the unsafe and repaired tenant scenes show different outcomes', () => {
    const shared = createStoryboard({ kind: 'request-race', caption: '', variant: 'shared' }, 3);
    const local = createStoryboard({ kind: 'request-race', caption: '', variant: 'local' }, 3);
    expect(shared.labels.find((label) => label.id === 'read-label')?.text).toBe('A đọc hanoi!');
    expect(local.labels.find((label) => label.id === 'read-label')?.text).toBe('A đọc saigon');
    expect(local.strokes.some((stroke) => stroke.id === 'wrong-circle')).toBe(false);
  });
});
