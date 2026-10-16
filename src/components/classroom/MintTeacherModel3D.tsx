import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { InstructorStagePose } from './InteractiveSmartboardClassroom.tsx';

const MODEL_HEIGHT = 1.78;

interface TeacherRig {
  root: THREE.Group;
  bones: {
    pelvis: THREE.Bone;
    spine: THREE.Bone;
    chest: THREE.Bone;
    head: THREE.Bone;
    leftUpperArm: THREE.Bone;
    leftForearm: THREE.Bone;
    rightUpperArm: THREE.Bone;
    rightForearm: THREE.Bone;
  };
}

interface MintTeacherModel3DProps {
  pose: InstructorStagePose;
  voiceAmplitude: number;
  isSpeaking: boolean;
  isListening: boolean;
}

const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

function bone(name: string, position: THREE.Vector3Tuple): THREE.Bone {
  const result = new THREE.Bone();
  result.name = name;
  result.position.set(...position);
  return result;
}

function createRig(scene: THREE.Group): TeacherRig {
  const sourceMeshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) sourceMeshes.push(object as THREE.Mesh);
  });

  const pelvis = bone('Pelvis', [0, -0.14, 0]);
  const spine = bone('Spine', [0, 0.12, 0]);
  const chest = bone('Chest', [0, 0.17, 0]);
  const neck = bone('Neck', [0, 0.1, 0]);
  const head = bone('Head', [0, 0.06, 0]);
  pelvis.add(spine);
  spine.add(chest);
  chest.add(neck);
  neck.add(head);

  const leftShoulder = bone('LeftShoulder', [-0.09, 0.015, 0]);
  const leftUpperArm = bone('LeftUpperArm', [-0.11, 0, 0]);
  const leftForearm = bone('LeftForearm', [-0.15, 0, 0]);
  const leftHand = bone('LeftHand', [-0.13, 0, 0]);
  chest.add(leftShoulder);
  leftShoulder.add(leftUpperArm);
  leftUpperArm.add(leftForearm);
  leftForearm.add(leftHand);

  const rightShoulder = bone('RightShoulder', [0.09, 0.015, 0]);
  const rightUpperArm = bone('RightUpperArm', [0.11, 0, 0]);
  const rightForearm = bone('RightForearm', [0.15, 0, 0]);
  const rightHand = bone('RightHand', [0.13, 0, 0]);
  chest.add(rightShoulder);
  rightShoulder.add(rightUpperArm);
  rightUpperArm.add(rightForearm);
  rightForearm.add(rightHand);

  const leftThigh = bone('LeftThigh', [-0.045, -0.02, 0]);
  const leftCalf = bone('LeftCalf', [0, -0.17, 0]);
  const leftFoot = bone('LeftFoot', [0, -0.17, 0]);
  pelvis.add(leftThigh);
  leftThigh.add(leftCalf);
  leftCalf.add(leftFoot);
  const rightThigh = bone('RightThigh', [0.045, -0.02, 0]);
  const rightCalf = bone('RightCalf', [0, -0.17, 0]);
  const rightFoot = bone('RightFoot', [0, -0.17, 0]);
  pelvis.add(rightThigh);
  rightThigh.add(rightCalf);
  rightCalf.add(rightFoot);

  scene.add(pelvis);
  const allBones = [
    pelvis, spine, chest, neck, head,
    leftShoulder, leftUpperArm, leftForearm, leftHand,
    rightShoulder, rightUpperArm, rightForearm, rightHand,
    leftThigh, leftCalf, leftFoot, rightThigh, rightCalf, rightFoot
  ];
  const boneIndex = new Map(allBones.map((entry, index) => [entry.name, index]));
  const replacements: Array<{ parent: THREE.Object3D; oldMesh: THREE.Mesh; newMesh: THREE.SkinnedMesh }> = [];

  for (const source of sourceMeshes) {
    const geometry = source.geometry.clone();
    const positions = geometry.getAttribute('position');
    const skinIndices = new Uint16Array(positions.count * 4);
    const skinWeights = new Float32Array(positions.count * 4);
    const indexOf = (name: string): number => boneIndex.get(name) ?? 0;

    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const x = positions.getX(vertex);
      const y = positions.getY(vertex);
      const side = x < 0 ? 'Left' : 'Right';
      const absX = Math.abs(x);
      const armWeight = smoothstep(0.09, 0.17, absX) *
        (1 - smoothstep(0.25, 0.33, y)) * smoothstep(0.04, 0.13, y);
      const headWeight = smoothstep(0.22, 0.32, y);
      const legWeight = (1 - smoothstep(-0.22, -0.1, y)) * (1 - headWeight);
      const torsoWeight = Math.max(0, 1 - armWeight - headWeight - legWeight);
      const entries: Array<[number, number]> = [];

      if (armWeight > 0.001) {
        const armT = THREE.MathUtils.clamp((absX - 0.09) / 0.35, 0, 1);
        const shoulder = indexOf(`${side}Shoulder`);
        const upper = indexOf(`${side}UpperArm`);
        const forearm = indexOf(`${side}Forearm`);
        const hand = indexOf(`${side}Hand`);
        if (armT < 0.25) entries.push([shoulder, armWeight * (1 - armT / 0.25)], [upper, armWeight * armT / 0.25]);
        else if (armT < 0.7) entries.push([upper, armWeight * (1 - (armT - 0.25) / 0.45)], [forearm, armWeight * (armT - 0.25) / 0.45]);
        else entries.push([forearm, armWeight * (1 - (armT - 0.7) / 0.3)], [hand, armWeight * (armT - 0.7) / 0.3]);
      }

      if (headWeight > 0.001) {
        const headMix = smoothstep(0.31, 0.39, y);
        entries.push([indexOf('Neck'), headWeight * (1 - headMix)], [indexOf('Head'), headWeight * headMix]);
      }

      if (legWeight > 0.001) {
        const segment = y < -0.36 ? 'Foot' : y < -0.2 ? 'Calf' : 'Thigh';
        entries.push([indexOf(`${side}${segment}`), legWeight]);
      }

      if (torsoWeight > 0.001) {
        const torsoBone = y < -0.06 ? 'Pelvis' : y < 0.06 ? 'Spine' : y < 0.2 ? 'Chest' : 'Neck';
        entries.push([indexOf(torsoBone), torsoWeight]);
      }

      const merged = new Map<number, number>();
      entries.forEach(([joint, weight]) => merged.set(joint, (merged.get(joint) ?? 0) + weight));
      let influences = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      if (influences.length === 0) influences = [[indexOf('Pelvis'), 1]];
      const total = influences.reduce((sum, [, weight]) => sum + weight, 0) || 1;
      influences.forEach(([joint, weight], influence) => {
        skinIndices[vertex * 4 + influence] = joint;
        skinWeights[vertex * 4 + influence] = weight / total;
      });
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    const skinned = new THREE.SkinnedMesh(geometry, source.material);
    skinned.name = source.name;
    skinned.position.copy(source.position);
    skinned.quaternion.copy(source.quaternion);
    skinned.scale.copy(source.scale);
    skinned.castShadow = true;
    skinned.receiveShadow = true;
    if (source.parent) replacements.push({ parent: source.parent, oldMesh: source, newMesh: skinned });
  }

  replacements.forEach(({ parent, oldMesh, newMesh }) => {
    parent.remove(oldMesh);
    parent.add(newMesh);
  });
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(allBones);
  replacements.forEach(({ newMesh }) => {
    newMesh.bind(skeleton);
    newMesh.normalizeSkinWeights();
  });

  return {
    root: scene,
    bones: { pelvis, spine, chest, head, leftUpperArm, leftForearm, rightUpperArm, rightForearm }
  };
}

function poseAngles(pose: InstructorStagePose): { left: number; right: number } {
  switch (pose) {
    case 'pointing_board': return { left: 1.08, right: -0.08 };
    case 'asking_student': return { left: 1.12, right: -0.92 };
    case 'listening_student': return { left: 1.16, right: -1.16 };
    case 'celebrating': return { left: -0.95, right: 0.95 };
    default: return { left: 1.16, right: -1.16 };
  }
}

export const MintTeacherModel3D: React.FC<MintTeacherModel3DProps> = ({
  pose,
  voiceAmplitude,
  isSpeaking,
  isListening
}) => {
  const { scene } = useGLTF('/assets/chestnut-glasses-teacher.glb');
  const rig = useMemo(() => {
    const instance = scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(instance);
    const size = bounds.getSize(new THREE.Vector3());
    const height = size.y || 1;
    const scale = MODEL_HEIGHT / height;
    instance.scale.setScalar(scale);
    const center = bounds.getCenter(new THREE.Vector3());
    instance.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return createRig(instance);
  }, [scene]);
  const modelRef = useRef<THREE.Group>(null);
  const target = useMemo(() => poseAngles(pose), [pose]);

  useEffect(() => () => {
    rig.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }, [rig]);

  useFrame(({ clock }, delta) => {
    const model = modelRef.current;
    if (!model) return;
    const time = clock.elapsedTime;
    const bones = rig.bones;
    const amplitude = isSpeaking ? THREE.MathUtils.clamp(voiceAmplitude, 0, 1) : 0;

    bones.leftUpperArm.rotation.z = THREE.MathUtils.damp(bones.leftUpperArm.rotation.z, target.left, 7, delta);
    bones.rightUpperArm.rotation.z = THREE.MathUtils.damp(bones.rightUpperArm.rotation.z, target.right, 7, delta);
    bones.leftForearm.rotation.z = THREE.MathUtils.damp(bones.leftForearm.rotation.z, pose === 'pointing_board' ? 0.28 : -0.18, 7, delta);
    bones.rightForearm.rotation.z = THREE.MathUtils.damp(bones.rightForearm.rotation.z, pose === 'pointing_board' ? -0.32 : 0.18, 7, delta);
    bones.head.rotation.x = THREE.MathUtils.damp(bones.head.rotation.x, (isListening ? 0.11 : 0) + Math.sin(time * 1.8) * 0.025, 5, delta);
    bones.head.rotation.y = THREE.MathUtils.damp(bones.head.rotation.y, Math.sin(time * 0.55) * 0.035, 4, delta);
    bones.chest.rotation.x = THREE.MathUtils.damp(bones.chest.rotation.x, isListening ? 0.035 : -amplitude * 0.025, 4, delta);
    bones.pelvis.rotation.y = THREE.MathUtils.damp(bones.pelvis.rotation.y, pose === 'pointing_board' ? -0.12 : 0, 4, delta);
    model.position.y = THREE.MathUtils.damp(model.position.y, Math.sin(time * (isSpeaking ? 3.3 : 1.7)) * (0.012 + amplitude * 0.009), 4, delta);
    model.rotation.y = THREE.MathUtils.damp(model.rotation.y, pose === 'pointing_board' ? -0.12 : 0, 4, delta);
  });

  return <primitive ref={modelRef} object={rig.root} dispose={null} />;
};

useGLTF.preload('/assets/chestnut-glasses-teacher.glb');
