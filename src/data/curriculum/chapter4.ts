import type { Sprint } from './types.ts';
import { c4_l1 } from './chapter4/c4-l1.ts';
import { c4_l1b } from './chapter4/c4-l1b.ts';
import { c4_l2 } from './chapter4/c4-l2.ts';
import { c4_l3 } from './chapter4/c4-l3.ts';

export const chapter4: Sprint = {
  sprintId: 4,
  sprintTitle: 'Chương 4: NestJS Core Architecture: IoC Container, Metadata Reflection & Request Pipeline',
  sprintDesc: 'Đào sâu vào động cơ cốt lõi của NestJS: Inversion of Control, Reflect Metadata, Đồ thị phụ thuộc DAG & Circular Dependency, Request Execution Pipeline và Hiểm họa Scopes',
  lessons: [
    c4_l1,
    c4_l1b,
    c4_l2,
    c4_l3,
  ],
};
