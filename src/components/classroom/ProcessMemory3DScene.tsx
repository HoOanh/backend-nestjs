import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import type { InstructorVisual } from '../../data/instructor-curriculum/types.ts';

type ProcessMemoryRegion = Extract<InstructorVisual, { kind: 'process-memory' }>['regions'][number];

export default function ProcessMemory3DScene({ regions }: { regions: ProcessMemoryRegion[] }) {
  return (
    <Canvas
      camera={{ position: [6.1, 5.1, 7.2], fov: 38 }}
      dpr={[1, 1.5]}
      fallback={<div className="p-6 text-sm text-stone-600">Mô phỏng 3D cần trình duyệt hỗ trợ WebGL.</div>}
    >
      <color attach="background" args={['#f8fbff']} />
      <ambientLight intensity={1.8} />
      <directionalLight position={[5, 8, 5]} intensity={2.2} />
      <gridHelper args={[6, 12, '#cbd5e1', '#e8eef5']} position={[0, -0.08, 0]} />
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[6, 2.8, 3.4]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.16} />
      </mesh>
      {regions.map((region) => (
        <group key={region.id} position={region.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={region.id === 'heap' ? [2.5, 0.8, 1.35] : [1.35, 0.8, 1.15]} />
            <meshStandardMaterial color={region.color} roughness={0.42} metalness={0.04} />
          </mesh>
          <Html position={[0, 0.72, 0]} center distanceFactor={8}>
            <span className="whitespace-nowrap rounded-md border border-white/80 bg-white/95 px-2 py-1 text-[11px] font-extrabold text-stone-800 shadow-md">
              {region.title}
            </span>
          </Html>
        </group>
      ))}
      <OrbitControls
        enablePan={false}
        minDistance={6}
        maxDistance={11}
        minPolarAngle={0.65}
        maxPolarAngle={1.35}
      />
    </Canvas>
  );
}
