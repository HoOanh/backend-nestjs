export interface PenStroke {
  length: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function drawingDuration(strokes: PenStroke[]): number {
  const weight = strokes.reduce((sum, stroke, index) => {
    const previous = strokes[index - 1];
    const distance = previous ? Math.hypot(stroke.start.x - previous.end.x, stroke.start.y - previous.end.y) : 0;
    return sum + Math.max(42, stroke.length) + (previous ? Math.min(140, 28 + distance * 0.3) : 0);
  }, 0);
  return Math.max(1.25, Math.min(6, weight / 300));
}

/** Reserve real time for lifting and moving the pen between disconnected strokes. */
export function penTimeline(strokes: PenStroke[], progress: number) {
  const weights = strokes.map((stroke, index) => {
    const previous = strokes[index - 1];
    const distance = previous ? Math.hypot(stroke.start.x - previous.end.x, stroke.start.y - previous.end.y) : 0;
    return { ink: Math.max(42, stroke.length), travel: previous ? Math.min(140, 28 + distance * 0.3) : 0 };
  });
  const total = weights.reduce((sum, weight) => sum + weight.ink + weight.travel, 0);
  let remaining = clamp(progress) * total;
  let tip = { index: 0, progress: 0, lift: 0, travel: 1 };
  const drawn = weights.map((weight, index) => {
    if (remaining < 0) return 0;
    if (weight.travel && remaining < weight.travel) {
      const travel = smooth(clamp(remaining / weight.travel));
      tip = { index, progress: 0, lift: Math.sin(Math.PI * travel), travel };
      remaining = -1;
      return 0;
    }
    remaining -= weight.travel;
    const fraction = clamp(remaining / weight.ink);
    // Gentle acceleration at the start and deceleration at the end of each mark.
    const ink = fraction * 0.65 + smooth(fraction) * 0.35;
    tip = { index, progress: ink, lift: 0, travel: 1 };
    remaining -= weight.ink;
    return ink;
  });
  return { drawn, tip };
}

/** SVG move commands are pen lifts, not continuous drawn connections. */
export function splitPenStrokes(path: string): string[] {
  return path.match(/M[^M]*/gi)?.filter((part) => part.trim().length > 1) ?? [path];
}
