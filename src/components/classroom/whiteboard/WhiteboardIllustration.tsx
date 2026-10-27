import { useLayoutEffect, useMemo, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'framer-motion';
import type { InstructorStoryboard } from '../../../data/instructor-curriculum/types';
import { createStoryboard, type BoardLabel } from './storyboard';
import { whiteboardDesign as design } from './designSystem';
import { DrawingHand } from './DrawingHand';
import { drawingDuration, penTimeline, splitPenStrokes } from './penTimeline';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function BoardText({ label, phase, clock, order, count, reduced }: {
  label: BoardLabel; phase: number; clock: MotionValue<number>; order: number; count: number; reduced: boolean | null;
}) {
  const start = 0.22 + (order / Math.max(1, count)) * 0.4;
  const opacity = useTransform(clock, (value) => label.at > phase ? 0 : label.at < phase || reduced ? 1 : clamp((value - start) / 0.12));
  const y = useTransform(opacity, (value) => label.y + (1 - value) * 4);
  return <motion.text aria-hidden={label.at > phase} x={label.x} style={{ y, opacity }} fill={label.color || design.ink} fontFamily={design.handwriting} fontSize={label.size || 25}>{label.text}</motion.text>;
}

/** One continuous media-driven choreography: draw, lift, move, annotate, withdraw. */
export function WhiteboardIllustration({ scene, focusIndex, progress, playing = true }: {
  scene: InstructorStoryboard; focusIndex: number; progress?: MotionValue<number>; playing?: boolean;
}) {
  const root = useRef<SVGSVGElement>(null);
  const phase = Math.max(0, Math.min(3, focusIndex));
  const concluded = focusIndex > 3;
  const reduced = useReducedMotion();
  const drawing = useMemo(() => createStoryboard(scene, phase), [scene, phase]);
  const strokes = useMemo(() => drawing.strokes.flatMap((stroke) => splitPenStrokes(stroke.d).map((d, index) => ({ ...stroke, d, id: `${stroke.id}-${index}` }))), [drawing]);
  const preview = useMotionValue(0);
  const animationProgress = useMotionValue(0);
  const clock = progress && !concluded ? progress : preview;
  const handX = useMotionValue(0);
  const handY = useMotionValue(0);
  const handOpacity = useMotionValue(0);
  const handRotation = useMotionValue(0);
  const handScale = useMotionValue(1);
  const { x, y, width: w, height: h } = drawing.focus;
  const outline = `M${x + 18} ${y} C${x + w * 0.35} ${y - 3} ${x + w * 0.72} ${y + 2} ${x + w - 16} ${y} Q${x + w + 2} ${y} ${x + w} ${y + 17} L${x + w + 1} ${y + h - 17} Q${x + w} ${y + h + 2} ${x + w - 18} ${y + h} L${x + 17} ${y + h + 1} Q${x - 2} ${y + h} ${x} ${y + h - 16} L${x - 1} ${y + 17} Q${x} ${y - 1} ${x + 18} ${y}`;

  useLayoutEffect(() => {
    if (concluded || reduced) { preview.set(1); return; }
    if (progress) return;
    if (!playing) return;
    preview.set(0);
    const control = animate(preview, 1, { duration: design.motion.previewStageSeconds, ease: 'linear' });
    return () => control.stop();
  }, [phase, concluded, progress, preview, reduced, playing]);

  useLayoutEffect(() => {
    const paths = Array.from(root.current?.querySelectorAll<SVGPathElement>('[data-draw-at]') ?? []);
    const active = paths.filter((path) => Number(path.dataset.drawAt) === phase);
    const annotation = root.current?.querySelector<SVGPathElement>('[data-focus-outline]');
    const geometry = active.map((path) => ({ length: path.getTotalLength(), start: path.getPointAtLength(0), end: path.getPointAtLength(path.getTotalLength()) }));
    const outlineLength = annotation?.getTotalLength() ?? 0;
    const inkSeconds = drawingDuration(geometry);
    const travelEndSeconds = inkSeconds + (annotation ? design.motion.highlightTravelSeconds : 0);
    const highlightEndSeconds = travelEndSeconds + (annotation ? design.motion.highlightSeconds : 0);
    const totalSeconds = highlightEndSeconds + design.motion.handExitSeconds;
    for (const path of paths) {
      const at = Number(path.dataset.drawAt);
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = at < phase ? '0' : String(length);
      path.style.opacity = at <= phase ? '1' : '0';
      path.style.fillOpacity = at < phase ? '1' : '0';
    }
    if (annotation) annotation.style.strokeDasharray = `${outlineLength} ${outlineLength}`;
    const update = (value: number) => {
      const elapsed = reduced || concluded ? totalSeconds : progress ? Math.max(0, value) : Math.max(0, value) * design.motion.previewStageSeconds;
      const fraction = clamp(elapsed / totalSeconds);
      animationProgress.set(fraction);
      const inkEnd = inkSeconds / totalSeconds;
      const travelEnd = travelEndSeconds / totalSeconds;
      const highlightEnd = highlightEndSeconds / totalSeconds;
      const timeline = penTimeline(geometry, fraction / inkEnd);
      timeline.drawn.forEach((part, index) => {
        active[index].style.strokeDashoffset = String(geometry[index].length * (1 - part));
        active[index].style.fillOpacity = String(clamp((part - 0.85) / 0.15));
      });
      const emphasis = annotation ? clamp((fraction - travelEnd) / (highlightEnd - travelEnd)) : 0;
      if (annotation) annotation.style.strokeDashoffset = String(outlineLength * (1 - emphasis));
      let point: { x: number; y: number } | undefined;
      let lift = timeline.tip.lift;
      const tip = timeline.tip;
      if (fraction > inkEnd && annotation) {
        const from = geometry.at(-1)?.end ?? annotation.getPointAtLength(0);
        const to = annotation.getPointAtLength(0);
        const travel = clamp((fraction - inkEnd) / (travelEnd - inkEnd));
        lift = Math.sin(Math.PI * travel);
        point = emphasis > 0 ? annotation.getPointAtLength(outlineLength * emphasis) : { x: from.x + (to.x - from.x) * travel, y: from.y + (to.y - from.y) * travel - lift * 24 };
      } else if (active[tip.index]) {
        const from = geometry[tip.index - 1]?.end ?? geometry[tip.index].start;
        const to = geometry[tip.index].start;
        point = tip.travel < 1 ? { x: from.x + (to.x - from.x) * tip.travel, y: from.y + (to.y - from.y) * tip.travel - lift * 24 } : active[tip.index].getPointAtLength(geometry[tip.index].length * tip.progress);
      }
      const exitStart = annotation ? highlightEnd : inkEnd;
      const withdraw = clamp((fraction - exitStart) / (1 - exitStart));
      if (point) { handX.set(point.x + withdraw * 110); handY.set(point.y + withdraw * 190); }
      handScale.set(1 + lift * 0.025);
      handRotation.set(-lift * 3);
      // A lifted pen travels visibly; the hand withdraws once the emphasis is complete.
      const visibility = Math.min(clamp(fraction / 0.018), 1 - withdraw);
      handOpacity.set(!reduced && !concluded && playing && active.length ? visibility : 0);
    };
    update(clock.get());
    return clock.on('change', update);
  }, [drawing, phase, concluded, reduced, playing, progress, clock, animationProgress, handX, handY, handOpacity, handRotation, handScale]);

  const currentLabels = drawing.labels.filter((label) => label.at === phase);
  return <svg ref={root} viewBox="0 0 1200 520" role="img" aria-label={scene.caption} className="h-full min-h-[210px] w-full" data-storyboard={scene.kind} data-media-clock={Boolean(progress)}>
    <title>{scene.caption}</title>
    {strokes.map((stroke) => <path key={stroke.id} d={stroke.d} data-draw-at={stroke.at} fill={stroke.fill || 'none'} stroke={stroke.color || design.ink} strokeWidth={stroke.width || 2.8} strokeLinecap="round" strokeLinejoin="round" />)}
    {drawing.labels.map((label) => <BoardText key={label.id} label={label} phase={phase} clock={animationProgress} order={currentLabels.indexOf(label)} count={currentLabels.length} reduced={reduced} />)}
    {focusIndex > 0 && <path key={`focus-${phase}`} d={outline} fill="none" stroke={design.red} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" data-focus-outline="true" />}
    <motion.g style={{ x: handX, y: handY, opacity: handOpacity }} data-drawing-hand="true" className="pointer-events-none">
      <motion.g style={{ rotate: handRotation, scale: handScale }}><DrawingHand /></motion.g>
    </motion.g>
  </svg>;
}
