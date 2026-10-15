import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { InstructorStagePose } from './LectureHall3DScene.tsx';

export interface RealisticTeacherModelProps {
  pose: InstructorStagePose;
  voiceAmplitude: number;
  isSpeaking: boolean;
  isListening: boolean;
  pointerTargetYPercent: number;
  showPointerBeam?: boolean;
}

let cachedCutoutCanvas: HTMLCanvasElement | null = null;

/**
 * Removes the exterior white studio background using border-seeded BFS flood-fill
 * + 2-pass silhouette edge feathering so interior highlights (eyes, teeth, light shirt)
 * remain 100% intact while hair and blazer edges blend smoothly into the classroom.
 */
function createTransparentTeacherCutout(
  img: HTMLImageElement
): HTMLCanvasElement {
  if (cachedCutoutCanvas) return cachedCutoutCanvas;

  const W = img.naturalWidth || 768;
  const H = img.naturalHeight || 1365;
  const offscreen = document.createElement('canvas');
  offscreen.width = W;
  offscreen.height = H;

  const ctx = offscreen.getContext('2d');
  if (!ctx) return offscreen;

  ctx.drawImage(img, 0, 0, W, H);
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  // 0 = unvisited, 1 = exterior background
  const visited = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;

  const isBackgroundCandidate = (idx: number): boolean => {
    const p = idx * 4;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    // Studio background is bright neutral white (low saturation, high brightness)
    return r > 226 && g > 226 && b > 226 && maxC - minC < 26;
  };

  // Seed BFS from all 4 image borders
  for (let x = 0; x < W; x++) {
    const topIdx = x;
    const botIdx = (H - 1) * W + x;
    if (isBackgroundCandidate(topIdx)) {
      visited[topIdx] = 1;
      queue[tail++] = topIdx;
    }
    if (isBackgroundCandidate(botIdx)) {
      visited[botIdx] = 1;
      queue[tail++] = botIdx;
    }
  }
  for (let y = 1; y < H - 1; y++) {
    const leftIdx = y * W;
    const rightIdx = y * W + (W - 1);
    if (isBackgroundCandidate(leftIdx)) {
      visited[leftIdx] = 1;
      queue[tail++] = leftIdx;
    }
    if (isBackgroundCandidate(rightIdx)) {
      visited[rightIdx] = 1;
      queue[tail++] = rightIdx;
    }
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % W;
    const cy = (curr / W) | 0;

    // 4-connected neighbors
    if (cx > 0) {
      const n = curr - 1;
      if (!visited[n] && isBackgroundCandidate(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cx < W - 1) {
      const n = curr + 1;
      if (!visited[n] && isBackgroundCandidate(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cy > 0) {
      const n = curr - W;
      if (!visited[n] && isBackgroundCandidate(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cy < H - 1) {
      const n = curr + W;
      if (!visited[n] && isBackgroundCandidate(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  // Apply transparency to exterior background & soft anti-aliased feathering at boundary
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      const p = idx * 4;
      if (visited[idx] === 1) {
        data[p + 3] = 0;
      } else {
        // Check if adjacent to exterior background for soft edge anti-aliasing
        const bgNeighbors =
          visited[idx - 1] +
          visited[idx + 1] +
          visited[idx - W] +
          visited[idx + W];
        if (bgNeighbors > 0) {
          const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
          // Feather bright edge pixels to eliminate white halo around hair/blazer
          if (lum > 205) {
            const factor = Math.max(0, Math.min(1, (245 - lum) / 40));
            data[p + 3] = Math.round(255 * factor * 0.75);
          } else {
            data[p + 3] = Math.round(255 * (1 - bgNeighbors * 0.12));
          }
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  cachedCutoutCanvas = offscreen;
  return offscreen;
}

export const RealisticTeacherModel: React.FC<RealisticTeacherModelProps> = ({
  pose,
  voiceAmplitude,
  isSpeaking,
  isListening,
  pointerTargetYPercent,
  showPointerBeam = true
}) => {
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(Boolean(cachedCutoutCanvas));

  const latestStateRef = useRef({
    pose,
    voiceAmplitude,
    isSpeaking,
    isListening,
    pointerTargetYPercent
  });
  latestStateRef.current = {
    pose,
    voiceAmplitude,
    isSpeaking,
    isListening,
    pointerTargetYPercent
  };

  useEffect(() => {
    let active = true;
    let animId = 0;

    const startRenderLoop = (cutout: HTMLCanvasElement) => {
      const canvas = renderCanvasRef.current;
      if (!canvas) return;
      const W = cutout.width;
      const H = cutout.height;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const animate = (now: number) => {
        if (!active) return;
        const t = now * 0.001;
        const {
          voiceAmplitude: ampRaw,
          isSpeaking: speaking,
          isListening: listening
        } = latestStateRef.current;

        const amp = speaking ? Math.min(1, Math.max(0.08, ampRaw)) : 0;

        ctx.clearRect(0, 0, W, H);

        // 1. Subtle natural breathing & speaking upper-body motion
        const breathY =
          Math.sin(t * 2.2) * 2.2 + (speaking ? Math.sin(t * 7) * amp * 2.5 : 0);
        const headNodY = listening
          ? Math.sin(t * 4.5) * 3.2
          : speaking
            ? Math.sin(t * 5.5) * amp * 3.0
            : 0;

        // Draw lower body (hips to shoes: 45% .. 100%) stationary on the floor
        const splitY = Math.round(H * 0.45);
        ctx.drawImage(
          cutout,
          0,
          splitY,
          W,
          H - splitY,
          0,
          splitY,
          W,
          H - splitY
        );

        // Draw upper torso (shoulders to waist: 20% .. 46%) with subtle breathing
        const neckY = Math.round(H * 0.205);
        ctx.drawImage(
          cutout,
          0,
          neckY,
          W,
          splitY - neckY + 12,
          0,
          neckY + breathY,
          W,
          splitY - neckY + 12
        );

        // Draw head & hair (0% .. 21%) with gentle expressive nod
        ctx.save();
        const headCenterX = W * 0.595;
        const headCenterY = H * 0.145;
        ctx.translate(headCenterX, headCenterY + breathY + headNodY);
        const tiltRad = listening
          ? 0.025 + Math.sin(t * 2.5) * 0.012
          : speaking
            ? Math.sin(t * 3.2) * (0.01 + amp * 0.018)
            : Math.sin(t * 1.2) * 0.008;
        ctx.rotate(tiltRad);
        ctx.translate(-headCenterX, -headCenterY);

        ctx.drawImage(cutout, 0, 0, W, neckY + 10, 0, 0, W, neckY + 10);

        // 2. Real-Time Photorealistic Jaw & Lip-Sync Articulation when Speaking Vietnamese
        if (speaking && amp > 0.06) {
          // Coordinates of mouth & chin on the 768x1365 portrait
          const mouthLeft = Math.round(W * 0.558);
          const mouthWidth = Math.round(W * 0.072);
          const mouthSplitY = Math.round(H * 0.167);
          const chinHeight = Math.round(H * 0.032);
          const jawDropPx = Math.min(7.5, amp * 7.2);

          // Inner oral cavity shadow behind parted lips
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(
            W * 0.594,
            mouthSplitY + jawDropPx * 0.38,
            mouthWidth * 0.34,
            Math.max(1.5, jawDropPx * 0.58),
            0,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = 'rgba(88, 28, 32, 0.82)';
          ctx.fill();
          ctx.restore();

          // Redraw displaced lower lip + chin slightly lower according to voiceAmplitude
          ctx.drawImage(
            cutout,
            mouthLeft,
            mouthSplitY,
            mouthWidth,
            chinHeight,
            mouthLeft,
            mouthSplitY + jawDropPx * 0.68,
            mouthWidth,
            chinHeight
          );
        }

        ctx.restore();

        animId = requestAnimationFrame(animate);
      };

      animId = requestAnimationFrame(animate);
    };

    if (cachedCutoutCanvas) {
      setIsLoaded(true);
      startRenderLoop(cachedCutoutCanvas);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = '/assets/instructor-teacher.jpg';
      img.onload = () => {
        if (!active) return;
        const cutout = createTransparentTeacherCutout(img);
        setIsLoaded(true);
        startRenderLoop(cutout);
      };
    }

    return () => {
      active = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  // Calculate dynamic laser/pointer line from the tip of her black stylus pen to the active item on the board
  const isPointing = pose === 'pointing_board';
  const targetY = Math.max(15, Math.min(85, pointerTargetYPercent));

  return (
    <motion.div
      animate={{
        x:
          pose === 'pointing_board'
            ? -12
            : pose === 'asking_student'
              ? -28
              : 0
      }}
      transition={{ type: 'spring', stiffness: 85, damping: 16 }}
      className="relative select-none"
      style={{ width: 315, height: 545 }}
    >
      {/* Dynamic Stylus Pointer Beam extending from her pen tip to the Smartboard */}
      {showPointerBeam && isPointing && isLoaded && (
        <svg
          viewBox="0 0 315 545"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="pointerLaser" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.75)" />
              <stop offset="100%" stopColor="rgba(239, 68, 68, 0.9)" />
            </linearGradient>
          </defs>
          {/* Stylus tip is at (44, 138) in 315x545 coordinates */}
          <line
            x1="44"
            y1="138"
            x2="-95"
            y2={40 + (targetY / 100) * 280}
            stroke="url(#pointerLaser)"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />
          <circle
            cx="-95"
            cy={40 + (targetY / 100) * 280}
            r="6"
            fill="#EF4444"
          />
          <circle
            cx="-95"
            cy={40 + (targetY / 100) * 280}
            r="13"
            fill="rgba(239, 68, 68, 0.25)"
          />
        </svg>
      )}

      {/* Photorealistic Cutout Teacher Canvas with Real-Time Lip-Sync & Breathing */}
      <canvas
        ref={renderCanvasRef}
        className="h-full w-full object-contain drop-shadow-[0_16px_28px_rgba(48,36,24,0.28)]"
      />

      {/* Floating Status Badge Above Teacher */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-300/90 bg-white/95 px-3 py-1 text-[11px] font-extrabold text-stone-800 shadow-md">
        {isListening ? (
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            Cô đang lắng nghe em...
          </span>
        ) : isSpeaking ? (
          <span className="flex items-center gap-1.5 text-sky-700">
            <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            Cô đang giảng bài (Tiếng Việt)
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-stone-700">
            <Sparkles size={12} className="text-amber-500" />
            Giảng Viên Trực Tiếp 1-1
          </span>
        )}
      </div>
    </motion.div>
  );
};
