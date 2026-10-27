import { expect, test } from 'bun:test';
import { drawingDuration, penTimeline, splitPenStrokes } from '../src/components/classroom/whiteboard/penTimeline';

const strokes = [
  { length: 100, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
  { length: 100, start: { x: 300, y: 0 }, end: { x: 400, y: 0 } }
];

test('the pen lifts and travels between disconnected marks without drawing a connector', () => {
  const middle = penTimeline(strokes, 0.5);
  expect(middle.drawn).toEqual([1, 0]);
  expect(middle.tip.index).toBe(1);
  expect(middle.tip.lift).toBeGreaterThan(0.8);
  expect(middle.tip.travel).toBeGreaterThan(0);
  expect(middle.tip.travel).toBeLessThan(1);
  expect(penTimeline(strokes, 1).drawn).toEqual([1, 1]);
});

test('disjoint subpaths lift the pen and ink never rewinds as the audio advances', () => {
  expect(splitPenStrokes('M0 0 L10 10 M30 30 L40 40')).toEqual(['M0 0 L10 10 ', 'M30 30 L40 40']);
  let previous = [0, 0];
  for (let frame = 0; frame <= 100; frame += 1) {
    const current = penTimeline(strokes, frame / 100).drawn;
    current.forEach((value, index) => expect(value).toBeGreaterThanOrEqual(previous[index]));
    previous = current;
  }
});

test('ink duration depends on diagram complexity, with practical minimum and maximum', () => {
  expect(drawingDuration([{ length: 30, start: { x: 0, y: 0 }, end: { x: 30, y: 0 } }])).toBe(1.25);
  expect(drawingDuration([{ length: 900, start: { x: 0, y: 0 }, end: { x: 900, y: 0 } }])).toBe(3);
  expect(drawingDuration([{ length: 3000, start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }])).toBe(6);
});
