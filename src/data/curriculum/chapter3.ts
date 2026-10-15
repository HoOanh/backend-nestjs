import type { Sprint } from './types.ts';
import { c3_l1 } from './chapter3/c3-l1.ts';
import { c3_l2 } from './chapter3/c3-l2.ts';
import { c3_l3 } from './chapter3/c3-l3.ts';

export const chapter3: Sprint = {
  sprintId: 3,
  sprintTitle: 'Chương 3: Giao Thức Mạng Sâu Sắc: TCP Sockets, HTTP/1.1 Đến HTTP/3, TLS & An Toàn Web',
  sprintDesc: 'Làm chủ tầng mạng Backend: TCP 3-Way Handshake, Head-of-Line Blocking, HTTP/2 Multiplexing, HTTP/3 (QUIC/UDP), Idempotency Keys và Cơ chế CORS/Cookie Security',
  lessons: [
    c3_l1,
    c3_l2,
    c3_l3,
  ],
};
