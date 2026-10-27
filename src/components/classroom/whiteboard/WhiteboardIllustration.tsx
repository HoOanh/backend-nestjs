import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import type { InstructorStoryboard } from '../../../data/instructor-curriculum/types';
import { createStoryboard } from './storyboard';
import { whiteboardDesign as design } from './designSystem';
import { DrawingHand } from './DrawingHand';

function FlowPulse({ d, color, reducedMotion }: { d: string; color: string; reducedMotion: boolean | null }) {
  const path = useRef<SVGPathElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  useLayoutEffect(() => {
    const geometry = path.current;
    if (!geometry || reducedMotion) return;
    const length = geometry.getTotalLength();
    const controls = animate(0, 1, {
      delay: 1.3,
      duration: 1.05,
      ease: 'linear',
      onUpdate: (progress) => {
        const point = geometry.getPointAtLength(progress * length);
        x.set(point.x); y.set(point.y);
        opacity.set(progress > 0 && progress < 0.98 ? 1 : 0);
      }
    });
    return () => controls.stop();
  }, [d, reducedMotion, x, y, opacity]);
  return <g aria-hidden="true"><path ref={path} d={d} fill="none" stroke="none" /><motion.circle r={6} fill={color} style={{ x, y, opacity }} data-flow-pulse="true" /></g>;
}

export function WhiteboardIllustration({ scene, focusIndex }: {
  scene: InstructorStoryboard;
  focusIndex: number;
}) {
  const root = useRef<SVGSVGElement>(null);
  const clipId = useId().replace(/:/g, '');
  const phase = Math.max(0, Math.min(3, focusIndex));
  const reducedMotion = useReducedMotion();
  const drawing = useMemo(() => createStoryboard(scene, phase), [scene, phase]);
  const handX = useMotionValue(0);
  const handY = useMotionValue(0);
  const [handVisible, setHandVisible] = useState(false);

  useLayoutEffect(() => {
    const paths = Array.from(root.current?.querySelectorAll<SVGPathElement>('[data-draw-at]') ?? []);
    const activePaths: SVGPathElement[] = [];
    for (const path of paths) {
      const at = Number(path.dataset.drawAt);
      const length = path.getTotalLength();
      path.style.strokeDasharray = String(length);
      path.style.strokeDashoffset = at <= phase ? '0' : String(length);
      path.style.opacity = at <= phase ? '1' : '0';
      if (at === phase && !reducedMotion) {
        path.style.strokeDashoffset = String(length);
        activePaths.push(path);
      }
    }
    if (!activePaths.length) { setHandVisible(false); return; }
    let cancelled = false;
    let stopStroke: (() => void) | undefined;
    const seconds = Math.min(design.motion.strokeSeconds, design.motion.maxStageSeconds / activePaths.length);
    setHandVisible(true);
    void (async () => {
      for (const path of activePaths) {
        if (cancelled) return;
        const length = path.getTotalLength();
        const controls = animate(0, 1, {
          duration: seconds,
          ease: 'linear',
          onUpdate: (progress) => {
            path.style.strokeDashoffset = String(length * (1 - progress));
            const point = path.getPointAtLength(length * progress);
            handX.set(point.x);
            handY.set(point.y);
          }
        });
        stopStroke = () => controls.stop();
        await controls;
      }
      if (!cancelled) setHandVisible(false);
    })();
    return () => { cancelled = true; stopStroke?.(); };
  }, [drawing, phase, reducedMotion, handX, handY]);

  return (
    <svg ref={root} viewBox="0 0 1200 520" role="img" aria-label={scene.caption} className="h-full min-h-[210px] w-full" data-storyboard={scene.kind} data-drawing={handVisible || undefined}>
      <title>{scene.caption}</title>
      {drawing.strokes.map((stroke) => (
        <path key={stroke.id} d={stroke.d} data-draw-at={stroke.at} fill={stroke.fill || 'none'} stroke={stroke.color || design.ink} strokeWidth={stroke.width || 3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {drawing.labels.map((label) => {
        const revealed = label.at <= phase;
        const width = label.text.length * (label.size || 25) * 0.65 + 30;
        const id = `${clipId}-${label.id}`;
        return (
          <g key={label.id} aria-hidden={!revealed}>
            <defs><clipPath id={id}><motion.rect x={label.x-3} y={label.y-40} height={60} initial={{ width: reducedMotion ? width : 0 }} animate={{ width: revealed ? width : 0 }} transition={{ duration: reducedMotion ? 0 : design.motion.labelSeconds, delay: label.at === phase ? 0.12 : 0 }} /></clipPath></defs>
            <text x={label.x} y={label.y} clipPath={`url(#${id})`} fill={label.color || design.ink} fontFamily={design.handwriting} fontSize={label.size || 25}>{label.text}</text>
          </g>
        );
      })}
      {drawing.strokes.filter((stroke) => stroke.at === phase && /^(a-to-service|b-to-service|read-tenant|send-io|return-io|enqueue|complete|ready-events|lookup)$/.test(stroke.id)).map((stroke) => (
        <FlowPulse key={`${phase}-${stroke.id}`} d={stroke.d} color={stroke.color || design.blue} reducedMotion={reducedMotion} />
      ))}
      <motion.g style={{ x: handX, y: handY }} animate={{ opacity: handVisible ? 1 : 0 }} transition={{ duration: 0.12 }} data-drawing-hand="true" className="pointer-events-none">
        <DrawingHand />
      </motion.g>
    </svg>
  );
}
