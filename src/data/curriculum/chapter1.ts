import type { Sprint } from './types.ts';
import { c1_l1 } from './chapter1/c1-l1.ts';
import { c1_l2 } from './chapter1/c1-l2.ts';
import { c1_l3 } from './chapter1/c1-l3.ts';

export const chapter1: Sprint = {
  sprintId: 1,
  sprintTitle: 'Chương 1: Runtime Internals, V8 Engine & Quản Trị Bộ Nhớ Cấp Thấp',
  sprintDesc: 'Làm chủ bản chất vật lý của máy tính: Giới hạn phần cứng, V8 Pipeline (Ignition/TurboFan), Cấp phát bộ nhớ Stack/Heap, V8 Garbage Collection và Kỹ thuật Profiling Memory Leak chuyên sâu',
  lessons: [
    c1_l1,
    c1_l2,
    c1_l3,
  ],
};
