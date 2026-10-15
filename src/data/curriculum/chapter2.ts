import type { Sprint } from './types.ts';
import { c2_l1 } from './chapter2/c2-l1.ts';
import { c2_l2 } from './chapter2/c2-l2.ts';
import { c2_l3 } from './chapter2/c2-l3.ts';

export const chapter2: Sprint = {
  sprintId: 2,
  sprintTitle: 'Chương 2: Libuv, OS Kernel System Calls & Kiến Trúc Bất Đồng Bộ Non-Blocking',
  sprintDesc: 'Phân tích cơ chế lõi điều phối của Node.js: 6 Pha Event Loop, Thứ tự Drain Microtasks, Linux epoll/kqueue vs Libuv Threadpool, và Kỹ thuật điều phối Worker Threads',
  lessons: [
    c2_l1,
    c2_l2,
    c2_l3,
  ],
};
