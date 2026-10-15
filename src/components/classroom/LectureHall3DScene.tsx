import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  CameraControls,
  ContactShadows,
  Html
} from '@react-three/drei';
import type { CameraControls as CameraRigHandle } from '@react-three/drei';
import {
  Code2,
  Crosshair,
  Eraser,
  GitBranch,
  Highlighter,
  Lightbulb,
  MousePointer2,
  PenTool,
  Redo2,
  RotateCcw,
  Sparkles,
  Undo2
} from 'lucide-react';
import * as THREE from 'three';
import { MintTeacherModel3D } from './MintTeacherModel3D.tsx';

export type InstructorStagePose =
  | 'podium_speaking'
  | 'pointing_board'
  | 'asking_student'
  | 'listening_student'
  | 'celebrating';

export type CameraPreset = 'pov' | 'instructor' | 'board' | 'wide';

export type BoardDisplayMode = 'keypoints' | 'diagram' | 'code' | 'question';

export interface LectureHall3DProps {
  lessonTitle: string;
  stepTitle: string;
  stepIndex: number;
  totalSteps: number;
  pose: InstructorStagePose;
  cameraPreset: CameraPreset;
  cameraSnap?: number;
  boardMode: BoardDisplayMode;
  keyPoints: string[];
  activePointIndex: number;
  visualDiagramText: string;
  codeSnippet: string;
  activeCodeLine: number;
  questionText?: string;
  voiceAmplitude: number;
  isSpeaking: boolean;
  isListening: boolean;
  onSelectBoardPoint?: (index: number) => void;
  onSelectCodeLine?: (lineIndex: number, lineText: string) => void;
  onSwitchBoardMode?: (mode: BoardDisplayMode) => void;
  onRequestCameraPreset?: (preset: CameraPreset) => void;
  onOpenLaptop?: () => void;
}

interface Shot {
  eye: [number, number, number];
  look: [number, number, number];
}

const CAMERA_SHOTS: Record<CameraPreset, Shot> = {
  pov: { eye: [0.04, 1.16, 2.28], look: [-0.18, 1.58, -3.05] },
  instructor: { eye: [1.72, 1.4, 0.55], look: [0.72, 1.32, -2.35] },
  board: { eye: [-0.12, 1.5, 0.72], look: [-0.18, 1.5, -2.85] },
  wide: { eye: [0.45, 2.12, 5.15], look: [0.05, 1.22, -1.4] }
};

type BoardTool = 'select' | 'pen' | 'marker' | 'eraser';

const PEN_COLORS = ['#0284c7', '#059669', '#d97706', '#e11d48', '#1e293b'];

function poseAnchor(pose: InstructorStagePose): { x: number; z: number } {
  switch (pose) {
    case 'pointing_board':
      return { x: 1.9, z: -2.08 };
    case 'asking_student':
      return { x: 1.08, z: -1.92 };
    case 'listening_student':
      return { x: 1.3, z: -1.9 };
    case 'celebrating':
      return { x: 1.52, z: -1.98 };
    default:
      return { x: 1.9, z: -1.98 };
  }
}

function boardAim(
  mode: BoardDisplayMode,
  pointIndex: number,
  codeLine: number
): [number, number, number] {
  if (mode === 'keypoints') {
    return [-0.28, 1.78 - pointIndex * 0.2, -3.28];
  }
  if (mode === 'code') {
    return [-0.15, 1.62 - Math.min(codeLine, 8) * 0.055, -3.28];
  }
  if (mode === 'diagram') {
    return [-0.1, 1.48, -3.28];
  }
  return [-0.12, 1.55, -3.28];
}

function useRepeatTexture(
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  width: number,
  height: number,
  repeatX: number,
  repeatY: number
): THREE.CanvasTexture | null {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    paint(ctx, width, height);
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.wrapS = THREE.RepeatWrapping;
    next.wrapT = THREE.RepeatWrapping;
    next.repeat.set(repeatX, repeatY);
    next.anisotropy = 8;
    return next;
  }, [paint, width, height, repeatX, repeatY]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  return texture;
}

function paintWood(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = '#c9a36d';
  ctx.fillRect(0, 0, width, height);
  for (let row = 0; row < 8; row += 1) {
    const y = (row / 8) * height;
    ctx.fillStyle = row % 2 === 0 ? '#d7b07a' : '#b88955';
    ctx.fillRect(0, y, width, height / 8 - 2);
    ctx.strokeStyle = 'rgba(92, 58, 28, 0.18)';
    ctx.lineWidth = 2;
    for (let band = 0; band < 5; band += 1) {
      ctx.beginPath();
      const gy = y + 8 + band * 11;
      ctx.moveTo(0, gy);
      ctx.bezierCurveTo(width * 0.3, gy + 6, width * 0.62, gy - 5, width, gy + 2);
      ctx.stroke();
    }
  }
}

function paintPlaster(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 900; i += 1) {
    const x = (i * 47) % width;
    const y = (i * 91) % height;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(180,160,130,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(x, y, 2, 2);
  }
}

function PointerBeam({
  from,
  to,
  active
}: {
  from: [number, number, number];
  to: [number, number, number];
  active: boolean;
}) {
  const markerRef = useRef<THREE.Mesh>(null);
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const delta = end.clone().sub(start);
  const length = Math.max(0.05, delta.length());
  const mid = start.clone().addScaledVector(delta, 0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.normalize()
  );

  useFrame(({ clock }) => {
    const marker = markerRef.current;
    if (!marker) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 5.5) * 0.22;
    marker.scale.setScalar(pulse);
  });

  if (!active) return null;

  return (
    <group>
      <mesh position={mid} quaternion={quat}>
        <cylinderGeometry args={[0.006, 0.006, length, 6]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.88} />
      </mesh>
      <mesh ref={markerRef} position={end}>
        <sphereGeometry args={[0.035, 16, 16]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>
    </group>
  );
}

function TeacherPresence({
  pose,
  voiceAmplitude,
  isSpeaking,
  isListening,
  pointerTargetYPercent
}: {
  pose: InstructorStagePose;
  voiceAmplitude: number;
  isSpeaking: boolean;
  isListening: boolean;
  pointerTargetYPercent: number;
}) {
  const rigRef = useRef<THREE.Group>(null);
  const goal = poseAnchor(pose);

  useFrame((_, delta) => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.position.x = THREE.MathUtils.damp(rig.position.x, goal.x, 3.2, delta);
    rig.position.z = THREE.MathUtils.damp(rig.position.z, goal.z, 3.2, delta);
  });

  return (
    <group ref={rigRef} position={[goal.x, 0, goal.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.04]}>
        <circleGeometry args={[0.34, 24]} />
        <meshBasicMaterial color="#2c2118" transparent opacity={0.28} />
      </mesh>
      <MintTeacherModel3D
        pose={pose}
        voiceAmplitude={voiceAmplitude}
        isSpeaking={isSpeaking}
        isListening={isListening}
      />
      <Html
        transform
        sprite
        center
        position={[0, 1.62, 0]}
        scale={0.00305}
        distanceFactor={400}
        pointerEvents="none"
        zIndexRange={[20, 0]}
      >
        <div className="whitespace-nowrap rounded-full border border-amber-300/90 bg-white/95 px-3 py-1 text-[11px] font-extrabold text-stone-800 shadow-md">
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
      </Html>
    </group>
  );
}

function BoardSpot() {
  const lightRef = useRef<THREE.SpotLight>(null);
  const { scene } = useThree();

  useLayoutEffect(() => {
    const spot = lightRef.current;
    if (!spot) return;
    spot.target.position.set(-0.16, 1.5, -3.4);
    scene.add(spot.target);
    return () => {
      scene.remove(spot.target);
    };
  }, [scene]);

  return (
    <spotLight
      ref={lightRef}
      position={[0.15, 2.85, -0.35]}
      angle={0.55}
      penumbra={0.78}
      intensity={22}
      distance={8}
      color="#fff7ec"
    />
  );
}

function LightMotes() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const t = clock.elapsedTime;
    group.children.forEach((child, index) => {
      child.position.y = 0.7 + ((index * 0.31 + t * 0.07) % 2.15);
      child.position.x = -2.85 + Math.sin(t * 0.35 + index) * 0.28;
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh
          key={index}
          position={[-2.8, 0.8 + index * 0.12, -0.6 + (index % 4) * 0.35]}
        >
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#fff8ea" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function focusToward(
  controls: CameraRigHandle,
  camera: THREE.Camera,
  point: THREE.Vector3
) {
  const eye = camera.position.clone();
  const direction = point.clone().sub(eye);
  const distance = direction.length();
  const nextDistance = THREE.MathUtils.clamp(distance * 0.58, 1.35, distance - 0.35);
  direction.normalize();
  const nextEye = point.clone().sub(direction.multiplyScalar(nextDistance));
  nextEye.y = THREE.MathUtils.clamp(nextEye.y, 1.05, 2.05);
  void controls.setLookAt(nextEye.x, nextEye.y, nextEye.z, point.x, point.y, point.z, true);
}

function ClassroomRoom({
  controlsRef,
  onRequestCameraPreset,
  onOpenLaptop,
  onFreeLook
}: {
  controlsRef: React.RefObject<CameraRigHandle | null>;
  onRequestCameraPreset?: (preset: CameraPreset) => void;
  onOpenLaptop?: () => void;
  onFreeLook: () => void;
}) {
  const wood = useRepeatTexture(paintWood, 512, 512, 3, 4);
  const plaster = useRepeatTexture(paintPlaster, 256, 256, 2, 2);
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f6f1e8',
        map: plaster,
        roughness: 0.94
      }),
    [plaster]
  );
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e4c08a',
        map: wood,
        roughness: 0.62,
        metalness: 0.02
      }),
    [wood]
  );

  useEffect(() => {
    return () => {
      wallMat.dispose();
      floorMat.dispose();
    };
  }, [wallMat, floorMat]);

  const aimAt = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const controls = controlsRef.current;
    if (!controls) return;
    focusToward(controls, event.camera, event.point);
    onFreeLook();
  };

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onDoubleClick={aimAt}>
        <planeGeometry args={[8.4, 7.4]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      <mesh position={[0, 1.6, -3.58]} receiveShadow>
        <boxGeometry args={[8.4, 3.2, 0.12]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[-4.14, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.12, 3.2, 7.4]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[4.14, 1.6, 0]} receiveShadow>
        <boxGeometry args={[0.12, 3.2, 7.4]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[0, 3.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8.4, 7.4]} />
        <meshStandardMaterial color="#ebe4d8" roughness={1} />
      </mesh>

      <mesh position={[0, 0.08, -3.5]}>
        <boxGeometry args={[8.2, 0.16, 0.08]} />
        <meshStandardMaterial color="#8d643c" roughness={0.7} />
      </mesh>
      <mesh position={[-4.02, 0.08, 0]}>
        <boxGeometry args={[0.08, 0.16, 7.2]} />
        <meshStandardMaterial color="#8d643c" roughness={0.7} />
      </mesh>
      <mesh position={[4.02, 0.08, 0]}>
        <boxGeometry args={[0.08, 0.16, 7.2]} />
        <meshStandardMaterial color="#8d643c" roughness={0.7} />
      </mesh>

      <group position={[-4.02, 1.85, -0.35]} onDoubleClick={aimAt}>
        <mesh>
          <boxGeometry args={[0.08, 1.7, 1.35]} />
          <meshStandardMaterial color="#c9854a" roughness={0.55} />
        </mesh>
        <mesh position={[0.02, 0, 0]}>
          <boxGeometry args={[0.02, 1.48, 1.15]} />
          <meshStandardMaterial
            color="#d7ecff"
            emissive="#9ec9ef"
            emissiveIntensity={0.35}
            roughness={0.08}
            metalness={0.05}
            transparent
            opacity={0.72}
          />
        </mesh>
      </group>
      <mesh position={[-2.35, 1.85, -0.15]} rotation={[0, 0.15, -0.55]}>
        <planeGeometry args={[2.8, 3.4]} />
        <meshBasicMaterial
          color="#fff6df"
          transparent
          opacity={0.09}
          depthWrite={false}
        />
      </mesh>

      <group position={[-3.15, 0, -2.55]}>
        <mesh position={[0, 0.95, 0]} castShadow>
          <boxGeometry args={[0.72, 1.9, 0.34]} />
          <meshStandardMaterial color="#a87443" roughness={0.62} />
        </mesh>
        {[0.35, 0.85, 1.35].map((shelfY) => (
          <mesh key={shelfY} position={[0, shelfY, 0.12]}>
            <boxGeometry args={[0.64, 0.04, 0.28]} />
            <meshStandardMaterial color="#8a5a30" />
          </mesh>
        ))}
        {[
          { x: -0.22, h: 0.28, c: '#b91c1c' },
          { x: -0.12, h: 0.34, c: '#1d4ed8' },
          { x: -0.02, h: 0.24, c: '#d97706' },
          { x: 0.08, h: 0.31, c: '#047857' }
        ].map((book) => (
          <mesh key={book.x} position={[book.x, 1.52, 0.12]} castShadow>
            <boxGeometry args={[0.07, book.h, 0.18]} />
            <meshStandardMaterial color={book.c} roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0.18, 1.95, 0]}>
          <sphereGeometry args={[0.11, 18, 18]} />
          <meshStandardMaterial color="#67b7e8" roughness={0.35} />
        </mesh>
      </group>

      <group position={[3.55, 1.7, -1.4]} rotation={[0, -0.6, 0]}>
        <mesh>
          <boxGeometry args={[0.9, 1.15, 0.03]} />
          <meshStandardMaterial color="#fffdf8" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.28, 0.02]}>
          <boxGeometry args={[0.7, 0.08, 0.01]} />
          <meshStandardMaterial color="#bae6fd" />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <boxGeometry args={[0.7, 0.08, 0.01]} />
          <meshStandardMaterial color="#fde68a" />
        </mesh>
        <mesh position={[0, -0.28, 0.02]}>
          <boxGeometry args={[0.7, 0.08, 0.01]} />
          <meshStandardMaterial color="#bbf7d0" />
        </mesh>
      </group>

      <group position={[-0.16, 1.52, -3.34]}>
        <mesh
          castShadow
          onDoubleClick={(event) => {
            event.stopPropagation();
            onRequestCameraPreset?.('board');
          }}
        >
          <boxGeometry args={[2.72, 1.72, 0.08]} />
          <meshStandardMaterial color="#8e98a3" metalness={0.62} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.045]}>
          <boxGeometry args={[2.52, 1.52, 0.02]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.92} />
        </mesh>
      </group>
      <mesh position={[-0.16, 0.2, -3.28]} castShadow>
        <boxGeometry args={[2.4, 0.36, 0.32]} />
        <meshStandardMaterial color="#3f3a36" roughness={0.78} />
      </mesh>

      <group position={[0, 0, 1.05]}>
        <mesh
          position={[0, 0.74, 0]}
          castShadow
          receiveShadow
          onDoubleClick={(event) => {
            event.stopPropagation();
            onRequestCameraPreset?.('pov');
          }}
        >
          <boxGeometry args={[1.85, 0.06, 0.82]} />
          <meshStandardMaterial color="#e6c08a" roughness={0.48} metalness={0.04} />
        </mesh>
        {[
          [-0.82, 0.36, -0.32],
          [0.82, 0.36, -0.32],
          [-0.82, 0.36, 0.32],
          [0.82, 0.36, 0.32]
        ].map((leg) => (
          <mesh key={leg.join('-')} position={leg as [number, number, number]} castShadow>
            <boxGeometry args={[0.06, 0.72, 0.06]} />
            <meshStandardMaterial color="#6b4428" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[-0.48, 0.78, 0.02]} rotation={[-0.04, 0.08, 0]} castShadow>
          <boxGeometry args={[0.28, 0.015, 0.36]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </mesh>
      </group>

      <group
        position={[0.48, 0.86, 1.02]}
        onClick={(event) => {
          event.stopPropagation();
          onOpenLaptop?.();
        }}
        onPointerOver={() => {
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.018, 0.24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.45} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.1, -0.1]} rotation={[-0.42, 0, 0]} castShadow>
          <boxGeometry args={[0.36, 0.22, 0.012]} />
          <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.1, -0.092]} rotation={[-0.42, 0, 0]}>
          <planeGeometry args={[0.3, 0.16]} />
          <meshBasicMaterial color="#7dd3fc" />
        </mesh>
      </group>

      <group position={[0.12, 0, 3.15]}>
        <mesh position={[0, 0.46, 0]} castShadow>
          <boxGeometry args={[0.5, 0.07, 0.48]} />
          <meshStandardMaterial color="#8d5a32" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.78, -0.2]} castShadow>
          <boxGeometry args={[0.5, 0.52, 0.07]} />
          <meshStandardMaterial color="#7a4e2b" roughness={0.74} />
        </mesh>
      </group>

      {[ -1.6, 0, 1.6 ].map((x) => (
        <mesh key={x} position={[x, 3.05, -0.4]}>
          <boxGeometry args={[0.72, 0.04, 0.28]} />
          <meshStandardMaterial
            color="#fffaf3"
            emissive="#fff4d6"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}

      <LightMotes />
      <BoardSpot />
      <ContactShadows
        position={[0, 0.012, -0.2]}
        opacity={0.32}
        scale={12}
        blur={2.2}
        far={4.5}
        color="#3a2a1c"
      />
    </group>
  );
}

function SmartboardPanel(props: LectureHall3DProps) {
  const [tool, setTool] = useState<BoardTool>('select');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [inkVersion, setInkVersion] = useState(0);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);

  const codeLines = (props.codeSnippet || '// Chưa có đoạn code mẫu cho bước này')
    .split('\n')
    .slice(0, 10);

  useEffect(() => {
    const canvas = inkRef.current;
    if (!canvas || tool === 'select') return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(2, Math.round(rect.width * 2));
    const height = Math.max(2, Math.round(rect.height * 2));
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
  }, [tool]);

  useEffect(() => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack.current = [];
    redoStack.current = [];
    setInkVersion((value) => value + 1);
  }, [props.stepIndex]);

  const snapshot = () => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStack.current.length > 14) undoStack.current.shift();
    redoStack.current = [];
  };

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const strokeStyle = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 28;
      return;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.globalAlpha = tool === 'marker' ? 0.32 : 1;
    ctx.lineWidth = tool === 'marker' ? 22 : 3.2;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    const point = pointFromEvent(event);
    if (!canvas || !ctx || !point) return;
    snapshot();
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    strokeStyle(ctx);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = inkRef.current?.getContext('2d');
    const point = pointFromEvent(event);
    if (!ctx || !point) return;
    strokeStyle(ctx);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const endStroke = () => {
    drawingRef.current = false;
    setInkVersion((value) => value + 1);
  };

  const restore = (from: ImageData[], to: ImageData[]) => {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    const frame = from.pop();
    if (!canvas || !ctx || !frame) return;
    to.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(frame, 0, 0);
    setInkVersion((value) => value + 1);
  };

  return (
        <div className="pointer-events-auto flex h-[460px] w-[760px] flex-col overflow-hidden rounded-md bg-[#f8fafc] text-stone-800 shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-200 bg-stone-100 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-sky-600 px-2.5 py-0.5 text-[13px] font-extrabold text-white">
                PHẦN {props.stepIndex + 1}/{props.totalSteps}
              </span>
              <span className="max-w-[520px] truncate text-sm font-bold text-stone-800">
                {props.stepTitle}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'keypoints', label: 'Ý chính', icon: Lightbulb },
                  { id: 'diagram', label: 'Sơ đồ', icon: GitBranch },
                  { id: 'code', label: 'Code', icon: Code2 }
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = props.boardMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => props.onSwitchBoardMode?.(tab.id)}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-bold ${
                      active
                        ? 'bg-sky-600 text-white'
                        : 'border border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <Icon size={13} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-0 flex-1 bg-white">
            <div
              className="grid h-full grid-cols-12 gap-3 p-4"
              style={{
                backgroundImage: 'radial-gradient(#d6dde6 0.8px, transparent 0.8px)',
                backgroundSize: '18px 18px'
              }}
            >
              <div className="col-span-3 flex flex-col gap-2">
                <div className="-rotate-1 rounded-xl border border-amber-300 bg-[#fef08a] p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
                    Trọng tâm
                  </div>
                  <p className="mt-1 line-clamp-4 text-[13px] font-semibold leading-snug">
                    {props.lessonTitle}
                  </p>
                </div>
                <div className="rotate-1 rounded-xl border border-emerald-300 bg-[#d9f99d] p-3">
                  <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-900">
                    Trên lớp
                  </div>
                  <p className="mt-1 text-[12px] leading-snug text-stone-700">
                    Bấm một ý để cô giảng sâu. Chọn bút nếu muốn ghi lên bảng.
                  </p>
                </div>
              </div>

              <div className="col-span-9 pr-2">
                {props.boardMode === 'keypoints' && (
                  <div className="space-y-2">
                    {props.keyPoints.slice(0, 4).map((point, index) => {
                      const focused = index === props.activePointIndex;
                      const clean = point.replace(/`([^`]+)`/g, '$1');
                      return (
                        <button
                          key={`${props.stepIndex}-${index}`}
                          type="button"
                          onClick={() => props.onSelectBoardPoint?.(index)}
                          className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-left ${
                            focused
                              ? 'border-sky-500 bg-sky-50'
                              : 'border-stone-200 bg-white/90'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                              focused ? 'bg-sky-600 text-white' : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            0{index + 1}
                          </span>
                          <span
                            className={`text-[14px] leading-relaxed ${
                              focused ? 'font-bold text-stone-900' : 'font-medium text-stone-700'
                            }`}
                          >
                            {clean}
                          </span>
                          {focused && (
                            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
                              <Crosshair size={10} />
                              Đang chỉ
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {props.boardMode === 'code' && (
                  <div className="h-full overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-2 font-mono text-[13px]">
                    {codeLines.map((lineText, index) => {
                      const focused = index === props.activeCodeLine;
                      return (
                        <button
                          key={`${lineText}-${index}`}
                          type="button"
                          onClick={() => props.onSelectCodeLine?.(index, lineText)}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left ${
                            focused ? 'bg-sky-100 font-bold text-sky-950' : 'text-stone-700'
                          }`}
                        >
                          <span className="w-8 text-stone-400">#{index + 1}</span>
                          <span className="truncate">{lineText || ' '}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {props.boardMode === 'diagram' && (
                  <pre className="h-full overflow-auto rounded-xl border border-sky-200 bg-sky-50/50 p-3 font-mono text-[12px] leading-relaxed text-stone-800">
                    {props.visualDiagramText
                      .replace(/```[a-zA-Z]*\n?/g, '')
                      .replace(/```/g, '')
                      .trim()}
                  </pre>
                )}

                {props.boardMode === 'question' && (
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
                    <div className="text-[12px] font-extrabold text-amber-800">
                      Câu hỏi tại lớp
                    </div>
                    <p className="mt-2 text-[16px] font-extrabold leading-relaxed text-stone-900">
                      {props.questionText}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {tool !== 'select' && (
              <canvas
                ref={inkRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                className="absolute inset-0 z-20 h-full w-full cursor-crosshair touch-none"
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-stone-200 bg-stone-50 py-1.5">
            <div className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1">
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'select' ? 'bg-sky-600 text-white' : 'text-stone-500'}`}
                title="Chọn ý trên bảng"
              >
                <MousePointer2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTool('pen')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'pen' ? 'bg-sky-600 text-white' : 'text-sky-600'}`}
                title="Bút viết"
              >
                <PenTool size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTool('marker')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'marker' ? 'bg-amber-500 text-white' : 'text-amber-500'}`}
                title="Bút dạ"
              >
                <Highlighter size={14} />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`cursor-pointer rounded-full p-1 ${tool === 'eraser' ? 'bg-stone-700 text-white' : 'text-stone-500'}`}
                title="Tẩy"
              >
                <Eraser size={14} />
              </button>
              <span className="mx-1 h-3.5 w-px bg-stone-200" />
              {PEN_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setPenColor(color);
                    if (tool === 'select' || tool === 'eraser') setTool('pen');
                  }}
                  style={{ backgroundColor: color }}
                  className={`h-3.5 w-3.5 cursor-pointer rounded-full ${
                    penColor === color ? 'ring-2 ring-sky-500 ring-offset-1' : ''
                  }`}
                />
              ))}
              <span className="mx-1 h-3.5 w-px bg-stone-200" />
              <button
                type="button"
                onClick={() => restore(undoStack.current, redoStack.current)}
                disabled={undoStack.current.length === 0}
                className="cursor-pointer text-stone-500 disabled:opacity-30"
                title="Hoàn tác nét vẽ"
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => restore(redoStack.current, undoStack.current)}
                disabled={redoStack.current.length === 0}
                className="cursor-pointer text-stone-500 disabled:opacity-30"
                title="Làm lại nét vẽ"
              >
                <Redo2 size={14} />
              </button>
              <span className="sr-only">nét {inkVersion}</span>
            </div>
          </div>
        </div>
  );
}

function BoardProjector({
  target
}: {
  target: React.RefObject<HTMLDivElement | null>;
}) {
  const anchor = useMemo(() => new THREE.Vector3(-0.18, 1.58, -3.02), []);

  useFrame(({ camera, size }) => {
    const el = target.current;
    if (!el) return;
    const projected = anchor.clone().project(camera);
    if (projected.z > 1) {
      el.style.visibility = 'hidden';
      return;
    }
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    const distance = camera.position.distanceTo(anchor);
    const scale = THREE.MathUtils.clamp(3.15 / distance, 0.46, 0.78);
    el.style.visibility = 'visible';
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
  });

  return <group />;
}

function CameraRig({
  controlsRef,
  preset,
  snap,
  onFreeLook,
  onSnap
}: {
  controlsRef: React.RefObject<CameraRigHandle | null>;
  preset: CameraPreset;
  snap: number;
  onFreeLook: () => void;
  onSnap: () => void;
}) {
  const skipSnap = useRef(true);

  useLayoutEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.smoothTime = 0.48;
    controls.draggingSmoothTime = 0.16;
    controls.dollyToCursor = true;
    controls.dollySpeed = 0.42;
    controls.azimuthRotateSpeed = 0.72;
    controls.polarRotateSpeed = 0.55;
    controls.minDistance = 1.2;
    controls.maxDistance = 7.4;
    controls.minPolarAngle = 0.92;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.minAzimuthAngle = -1.15;
    controls.maxAzimuthAngle = 1.2;
  }, [controlsRef]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const shot = CAMERA_SHOTS[preset];
    void controls.setLookAt(
      shot.eye[0],
      shot.eye[1],
      shot.eye[2],
      shot.look[0],
      shot.look[1],
      shot.look[2],
      !skipSnap.current
    );
    skipSnap.current = false;
    onSnap();
  }, [controlsRef, preset, snap, onSnap]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const controls = controlsRef.current;
      if (!controls) return;
      const turn = 0.08;
      if (event.key === 'ArrowLeft') void controls.rotate(turn, 0, true);
      else if (event.key === 'ArrowRight') void controls.rotate(-turn, 0, true);
      else if (event.key === 'ArrowUp') void controls.rotate(0, turn, true);
      else if (event.key === 'ArrowDown') void controls.rotate(0, -turn, true);
      else if (event.key === 'w' || event.key === 'W') void controls.forward(0.28, true);
      else if (event.key === 's' || event.key === 'S') void controls.forward(-0.28, true);
      else return;
      onFreeLook();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controlsRef, onFreeLook]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      onStart={onFreeLook}
    />
  );
}

export const LectureHall3DScene: React.FC<LectureHall3DProps> = (props) => {
  const controlsRef = useRef<CameraRigHandle>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [freeLook, setFreeLook] = useState(false);

  useEffect(() => {
    const kick = window.setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas && canvas.clientWidth < 400) {
        window.dispatchEvent(new Event('resize'));
      }
    }, 160);
    return () => window.clearTimeout(kick);
  }, []);
  const totalPoints = Math.max(1, props.keyPoints.slice(0, 4).length);
  const pointerTargetYPercent =
    props.boardMode === 'keypoints'
      ? 24 + (props.activePointIndex / totalPoints) * 58
      : props.boardMode === 'code'
        ? 22 + Math.min(10, props.activeCodeLine) * 6
        : 45;
  const anchor = poseAnchor(props.pose);
  const aim = boardAim(props.boardMode, props.activePointIndex, props.activeCodeLine);

  const markFree = React.useCallback(() => setFreeLook(true), []);
  const markSnap = React.useCallback(() => setFreeLook(false), []);

  return (
    <div className="absolute inset-0 bg-[#e7e0d4]">
      <Canvas
        shadows
        resize={{ offsetSize: true }}
        dpr={[1, 1.5]}
        camera={{ fov: 36, near: 0.08, far: 40, position: CAMERA_SHOTS.pov.eye }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping
        }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={['#e7e0d4']} />
        <fog attach="fog" args={['#e7e0d4', 9, 18]} />
        <hemisphereLight args={['#f8f4ec', '#c4a574', 0.72]} />
        <ambientLight intensity={0.28} color="#fff8ef" />
        <directionalLight
          position={[-3.4, 4.6, 1.4]}
          intensity={2.15}
          color="#fff3df"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0004}
          shadow-camera-near={0.5}
          shadow-camera-far={16}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        <ClassroomRoom
          controlsRef={controlsRef}
          onRequestCameraPreset={props.onRequestCameraPreset}
          onOpenLaptop={props.onOpenLaptop}
          onFreeLook={markFree}
        />
        <BoardProjector target={boardRef} />
        <TeacherPresence
          pose={props.pose}
          voiceAmplitude={props.voiceAmplitude}
          isSpeaking={props.isSpeaking}
          isListening={props.isListening}
          pointerTargetYPercent={pointerTargetYPercent}
        />
        <PointerBeam
          active={props.pose === 'pointing_board'}
          from={[anchor.x - 0.36, 1.32, anchor.z + 0.08]}
          to={aim}
        />
        <CameraRig
          controlsRef={controlsRef}
          preset={props.cameraPreset}
          snap={props.cameraSnap ?? 0}
          onFreeLook={markFree}
          onSnap={markSnap}
        />
      </Canvas>

      <div
        ref={boardRef}
        className="pointer-events-none absolute left-0 top-0 z-10 origin-center"
        style={{ transform: 'translate(400px, 340px) translate(-50%, -50%) scale(0.6)' }}
      >
        <SmartboardPanel {...props} />
      </div>

      <div className="pointer-events-none absolute bottom-40 left-4 z-20 flex max-w-xl flex-col items-start gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200/90 bg-white/92 px-3 py-2 text-[11px] font-semibold text-stone-600 shadow-md backdrop-blur-md">
          <span>Kéo nhìn quanh</span>
          <span className="text-stone-300">·</span>
          <span>Cuộn lại gần</span>
          <span className="text-stone-300">·</span>
          <span>Chuột phải dịch</span>
          <span className="text-stone-300">·</span>
          <span>Double-click zoom</span>
          <span className="text-stone-300">·</span>
          <span>Phím mũi tên / W S</span>
        </div>
        {freeLook && (
          <button
            type="button"
            onClick={() => props.onRequestCameraPreset?.('pov')}
            className="pointer-events-auto inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-extrabold text-stone-800 shadow-sm"
          >
            <RotateCcw size={12} />
            Ngồi lại ghế học
          </button>
        )}
      </div>
    </div>
  );
};
