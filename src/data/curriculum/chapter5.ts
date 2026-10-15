import type { Sprint } from './types.ts';
import { c5_l1 } from './chapter5/c5-l1.ts';
import { c5_l2 } from './chapter5/c5-l2.ts';
import { c5_l3 } from './chapter5/c5-l3.ts';

export const chapter5: Sprint = {
  sprintId: 5,
  sprintTitle: 'Chương 5: Cơ Sở Dữ Liệu Quan Hệ: PostgreSQL Engine, B-Tree Internals & Query Optimizer',
  sprintDesc: 'Phân tích cơ chế lõi lưu trữ dữ liệu: Cấu trúc 8KB Page, WAL & Checkpoints, Cơ chế vận hành B-Tree Index, Page Splits và Kỹ thuật đọc EXPLAIN (ANALYZE, BUFFERS)',
  lessons: [
    c5_l1,
    c5_l2,
    c5_l3,
  ],
};
