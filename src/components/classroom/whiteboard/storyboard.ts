import type { InstructorStoryboard } from '../../../data/instructor-curriculum/types';
import { whiteboardDesign as palette } from './designSystem';

export interface BoardStroke {
  id: string;
  d: string;
  at: number;
  color?: string;
  width?: number;
  fill?: string;
}
export interface BoardLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  at: number;
  color?: string;
  size?: number;
}
export interface BoardFocus { x: number; y: number; width: number; height: number; }
export interface BoardDrawing { strokes: BoardStroke[]; labels: BoardLabel[]; focus: BoardFocus; }

/** Authored focus regions keep the red annotation on the concept being explained. */
function focusRegion(scene: InstructorStoryboard, phase: number): BoardFocus {
  const regions: Record<InstructorStoryboard['kind'], BoardFocus[]> = {
    process: [{ x: 65, y: 110, width: 215, height: 280 }, { x: 502, y: 65, width: 278, height: 185 }, { x: 502, y: 272, width: 278, height: 185 }, { x: 867, y: 190, width: 270, height: 100 }],
    'request-race': [{ x: 53, y: 65, width: 150, height: 215 }, { x: 431, y: 205, width: 330, height: 65 }, { x: 431, y: scene.variant === 'local' ? 260 : 205, width: 330, height: 66 }, { x: 790, y: 122, width: 195, height: 75 }],
    'event-loop': [{ x: 65, y: 115, width: 160, height: 235 }, { x: 445, y: 165, width: 250, height: 175 }, { x: 946, y: 136, width: 210, height: 240 }, { x: 785, y: 380, width: 360, height: 65 }],
    queue: [{ x: 55, y: 95, width: 160, height: 210 }, { x: 420, y: 274, width: 260, height: 70 }, { x: 345, y: 345, width: 570, height: 78 }, { x: 335, y: 425, width: 700, height: 68 }],
    multiplexing: [{ x: 60, y: 75, width: 305, height: 270 }, { x: 489, y: 179, width: 225, height: 65 }, { x: 489, y: 248, width: 225, height: 67 }, { x: 938, y: 240, width: 220, height: 70 }],
    memory: [{ x: 234, y: 48, width: 714, height: 395 }, { x: 265, y: 140, width: 300, height: 190 }, { x: 575, y: 140, width: 330, height: 190 }, { x: 76, y: 209, width: 110, height: 75 }],
    diagnosis: [{ x: 60, y: 200, width: 220, height: 85 }, { x: 461, y: 207, width: 222, height: 70 }, { x: 898, y: 65, width: 280, height: 110 }, { x: 895, y: 348, width: 290, height: 112 }]
  };
  if (scene.kind === 'process' && scene.variant === 'threads') {
    return [{ x: 210, y: 30, width: 805, height: 435 }, { x: 417, y: 108, width: 375, height: 130 }, { x: 258, y: 290, width: 693, height: 130 }, { x: 275, y: 356, width: 655, height: 57 }][phase];
  }
  if (scene.kind === 'multiplexing' && scene.variant === 'fd') return [{ x: 65, y: 105, width: 160, height: 235 }, { x: 355, y: 85, width: 320, height: 320 }, { x: 935, y: 138, width: 205, height: 260 }, { x: 342, y: 428, width: 530, height: 66 }][phase];
  return regions[scene.kind][phase];
}

export function createStoryboard(scene: InstructorStoryboard, phase: number): BoardDrawing {
  const strokes: BoardStroke[] = [];
  const labels: BoardLabel[] = [];
  const line = (id: string, d: string, at = 0, color: string = palette.ink, fill?: string) => strokes.push({ id, d, at, color, fill });
  const label = (id: string, text: string, x: number, y: number, at = 0, color: string = palette.ink, size = 25) => labels.push({ id, text, x, y, at, color, size });
  const box = (id: string, x: number, y: number, w: number, h: number, at = 0, color: string = palette.ink) => line(id, `M${x+12} ${y} Q${x-3} ${y-2} ${x} ${y+14} L${x-1} ${y+h-12} Q${x} ${y+h+3} ${x+15} ${y+h} L${x+w-12} ${y+h+1} Q${x+w+3} ${y+h} ${x+w} ${y+h-15} L${x+w+1} ${y+12} Q${x+w} ${y-3} ${x+w-14} ${y} Z`, at, color, `${color}09`);
  const arrow = (id: string, x: number, y: number, tx: number, ty: number, at: number, color: string = palette.blue) => {
    line(id, `M${x} ${y} C${x+(tx-x)*0.4} ${y-12} ${x+(tx-x)*0.6} ${ty+12} ${tx} ${ty}`, at, color);
    const angle = Math.atan2(ty-y, tx-x);
    line(`${id}-tip`, `M${tx-15*Math.cos(angle-0.5)} ${ty-15*Math.sin(angle-0.5)} L${tx} ${ty} L${tx-15*Math.cos(angle+0.5)} ${ty-15*Math.sin(angle+0.5)}`, at, color);
  };
  const person = (id: string, x: number, y: number, at: number, color: string) => {
    line(`${id}-head`, `M${x+22} ${y} C${x+22} ${y+30} ${x-22} ${y+30} ${x-22} ${y} C${x-22} ${y-30} ${x+22} ${y-30} ${x+22} ${y}`, at, color, '#f5e4d4');
    line(`${id}-body`, `M${x-44} ${y+121} L${x-42} ${y+71} Q${x-40} ${y+50} ${x-16} ${y+43} Q${x} ${y+52} ${x+16} ${y+43} Q${x+40} ${y+50} ${x+42} ${y+71} L${x+44} ${y+121} Q${x} ${y+128} ${x-44} ${y+121} Z`, at, color, `${color}0c`);
  };
  const database = (id: string, x: number, y: number, at: number) => {
    line(id, `M${x} ${y} C${x} ${y-30} ${x+150} ${y-30} ${x+150} ${y} C${x+150} ${y+30} ${x} ${y+30} ${x} ${y} L${x} ${y+105} C${x} ${y+135} ${x+150} ${y+135} ${x+150} ${y+105} L${x+150} ${y} M${x} ${y+52} C${x} ${y+82} ${x+150} ${y+82} ${x+150} ${y+52}`, at);
  };

  if (scene.kind === 'process' && scene.variant === 'threads') {
    box('process', 220, 45, 780, 405);
    label('process-label', 'MỘT PROCESS', 485, 85);
    box('shared-resource', 430, 120, 350, 105, 1, palette.green);
    label('shared-name', 'Tài nguyên dùng chung', 480, 165, 1, palette.green);
    label('shared-detail', 'không gian địa chỉ · FD', 482, 203, 1, palette.ink, 22);
    box('thread-a', 275, 305, 255, 100, 2, palette.blue);
    box('thread-b', 680, 305, 255, 100, 2, palette.orange);
    label('thread-a-name', 'Thread A', 350, 345, 2, palette.blue);
    label('thread-b-name', 'Thread B', 755, 345, 2, palette.orange);
    label('thread-a-stack', 'stack + registers riêng', 303, 385, 3, palette.ink, 23);
    label('thread-b-stack', 'stack + registers riêng', 702, 385, 3, palette.ink, 23);
    line('private-stacks', 'M300 395 L506 395 M704 395 L914 395', 3, palette.orange);
    arrow('access-a', 407, 296, 485, 238, 2);
    arrow('access-b', 810, 296, 720, 238, 2, palette.orange);
    label('isolate-note', 'Worker Threads có isolate riêng; object JS không tự được chia sẻ.', 230, 495, 3, palette.muted, 22);
  } else if (scene.kind === 'process') {
    box('file', 80, 125, 180, 195);
    line('file-fold', 'M205 125 L205 170 L260 170 M110 200 L220 200 M110 225 L200 225 M110 250 L215 250');
    label('file-name', 'server.mjs', 90, 365);
    arrow('start-a', 275, 200, 495, 150, 1);
    box('process-a', 515, 80, 250, 155, 1, palette.blue);
    label('pid-a', 'PROCESS A', 553, 125, 1, palette.blue);
    label('a-context', scene.variant === 'isolated' ? '0x1000 → trang X' : 'PID 1234 · cổng 3000', 535, 175, 1, palette.ink, 23);
    arrow('start-b', 275, 265, 495, 350, 2, palette.green);
    box('process-b', 515, 285, 250, 155, 2, palette.green);
    label('pid-b', 'PROCESS B', 553, 330, 2, palette.green);
    label('b-context', scene.variant === 'isolated' ? '0x1000 → trang Y' : 'PID 5678 · cổng 3001', 535, 380, 2, palette.ink, 23);
    line('ownership-divider', 'M835 95 Q824 260 838 430', 3, palette.orange);
    label('ownership-1', 'Cùng file,', 885, 220, 3);
    label('ownership-2', 'vòng đời riêng.', 885, 258, 3);
    line('ownership-underline', 'M877 272 Q977 280 1105 269', 3, palette.orange);
  } else if (scene.kind === 'request-race') {
    const local = scene.variant === 'local';
    person('a', 130, 100, 0, palette.blue);
    person('b', 130, 320, 2, palette.orange);
    label('a-name', 'Request A', 65, 255, 0, palette.blue);
    label('b-name', 'Request B', 65, 470, 2, palette.orange);
    box('service', 420, 145, 350, 200, 0);
    label('service-name', 'AppointmentService', 457, 185);
    label('tenant-value', local ? 'tenant A = saigon' : `currentTenant = ${phase >= 2 ? 'hanoi' : 'saigon'}`, 449, 245, 1, local ? palette.blue : phase >= 2 ? palette.orange : palette.blue);
    if (local) label('tenant-b-value', 'tenant B = hanoi', 449, 295, 2, palette.orange);
    else line('shared-underline', 'M443 265 Q594 277 748 265', 2, palette.orange);
    arrow('a-to-service', 190, 150, 405, 205, 1);
    arrow('b-to-service', 190, 367, 405, 290, 2, palette.orange);
    label('a-waits', 'A đợi audit...', 220, 115, 1, palette.blue, 22);
    database('db', 965, 210, 3);
    arrow('read-tenant', 785, 245, 943, 245, 3, local ? palette.green : palette.red);
    label('db-name', 'Repository', 970, 385, 3);
    label('read-label', local ? 'A đọc saigon' : 'A đọc hanoi!', 805, 175, 3, local ? palette.green : palette.red, 23);
  } else if (scene.kind === 'event-loop') {
    const blocked = scene.variant === 'blocked';
    box('main-thread', 390, 95, 350, 290);
    label('main-title', 'MAIN THREAD', 465, 135);
    line('loop', 'M642 215 C722 309 456 362 469 245 C474 169 602 167 642 215', 1, blocked ? palette.red : palette.blue);
    arrow('loop-tip', 627, 192, 651, 225, 1, blocked ? palette.red : palette.blue);
    label('loop-work', blocked ? 'CPU đang bận' : 'Chạy callback', 477, 285, 1, blocked ? palette.red : palette.blue, 24);
    person('request', 145, 160, 0, palette.blue);
    label('request-label', 'Request A', 76, 320);
    arrow('request-main', 205, 205, 374, 205, 1);
    database('io-device', 970, 175, 2);
    label('io-label', 'I/O / database', 960, 350, 2);
    arrow('send-io', 755, 195, 949, 195, 2);
    arrow('return-io', 953, 310, 758, 310, 3, blocked ? palette.red : palette.green);
    label('wait-label', blocked ? 'Ready, vẫn chờ JS' : 'I/O xong → tiếp tục', 785, 415, 3, blocked ? palette.red : palette.green, 23);
    label('b-label', blocked ? 'B phải đợi' : 'B có thể được xử lý', 405, 447, 3, blocked ? palette.red : palette.green);
    if (blocked) line('block-cross', 'M792 265 L839 316 M839 265 L792 316', 3, palette.red);
  } else if (scene.kind === 'queue') {
    person('arrivals', 120, 130, 0, palette.blue);
    label('rate', 'λ = 1.000 request/s', 53, 320, 1, palette.blue, 23);
    arrow('enqueue', 200, 205, 360, 205, 1);
    for (let index = 0; index < 5; index += 1) box(`queued-${index}`, 390+index*77, 165, 52, 85, index < 2 ? 1 : 3, index < 2 ? palette.blue : palette.orange);
    label('wait', 'W = 0,2 giây', 450, 310, 1);
    arrow('complete', 790, 205, 960, 205, 2, palette.green);
    label('done', 'Hoàn tất', 980, 218, 2, palette.green);
    label('formula', 'L = λ × W = 200 request', 370, 388, 2, palette.blue, 32);
    line('formula-underline', 'M361 404 Q640 418 895 400', 2, palette.blue);
    label('longer-wait', 'W tăng → nhiều request ở lại hơn', 351, 465, 3, palette.orange, 25);
  } else if (scene.kind === 'multiplexing' && scene.variant === 'fd') {
    person('app', 135, 140, 0, palette.blue);
    label('app-label', 'Process', 80, 315);
    box('fd-table', 370, 100, 290, 290, 1);
    label('fd-title', 'BẢNG FD', 455, 145, 1);
    label('fd-entry-1', '7  →  socket', 425, 220, 1, palette.blue);
    label('fd-entry-2', '8  →  socket', 425, 285, 2, palette.green);
    arrow('handle', 205, 205, 350, 205, 1);
    database('socket', 960, 175, 2);
    label('kernel-socket', 'Socket trong kernel', 920, 370, 2);
    arrow('lookup', 675, 245, 945, 245, 2);
    label('lifetime', 'Kết nối đang chờ vẫn giữ tài nguyên.', 360, 465, 3, palette.orange);
    line('lifetime-underline', 'M358 478 Q590 486 816 476', 3, palette.orange);
  } else if (scene.kind === 'multiplexing') {
    label('connections-title', 'Nhiều socket đang mở', 85, 65);
    for (let index = 0; index < 12; index += 1) {
      const x = 90+(index%4)*66;
      const y = 105+Math.floor(index/4)*80;
      const ready = index === 2 || index === 9;
      box(`socket-${index}`, x, y, 42, 48, 0, ready && phase >= 2 ? palette.blue : palette.muted);
      if (ready) line(`socket-ready-${index}`, `M${x+8} ${y+27} L${x+18} ${y+36} L${x+35} ${y+13}`, 2, palette.blue);
    }
    box('kernel', 470, 110, 270, 230, 1);
    label('kernel-name', 'KERNEL', 555, 155, 1);
    label('interest', 'interest list', 505, 215, 1);
    label('ready-list', 'ready list', 521, 285, 2, palette.blue);
    arrow('registration', 350, 160, 451, 160, 1);
    arrow('ready-events', 755, 250, 930, 250, 2);
    box('runtime', 950, 170, 190, 145, 2, palette.blue);
    label('runtime-title', 'RUNTIME', 986, 215, 2, palette.blue);
    label('callback', 'Đọc → xử lý', 965, 273, 3);
    line('callback-underline', 'M963 287 Q1034 296 1123 284', 3, palette.blue);
    label('ready-note', 'Ready chưa có nghĩa request đã xong.', 410, 415, 3, palette.orange, 26);
    label('scale-note', 'Sơ đồ minh hoạ, không theo tỉ lệ số kết nối.', 80, 475, 0, palette.muted, 20);
  } else if (scene.kind === 'memory') {
    box('process-boundary', 245, 65, 690, 365, 0);
    label('process-title', 'PROCESS · các vùng nhớ', 435, 110);
    box('heap', 280, 155, 270, 160, 1, palette.blue);
    label('heap-title', 'V8 HEAP', 355, 203, 1, palette.blue);
    label('heap-value', 'heapUsed', 365, 260, 1);
    box('buffers', 590, 155, 300, 160, 2, palette.green);
    label('buffer-title', 'BUFFER / NATIVE', 620, 203, 2, palette.green);
    label('buffer-value', 'Ngoài JS heap', 655, 260, 2);
    label('other-regions', 'Code · stack · thư viện', 430, 375, 3);
    line('rss-mark', 'M205 62 Q168 240 202 433 M188 65 L217 65 M188 430 L217 430', 3, palette.orange);
    label('rss', 'RSS', 95, 255, 3, palette.orange, 32);
    label('no-add', 'Đọc từng phạm vi đo, không cộng các metric chồng lấp.', 265, 477, 3, palette.muted, 23);
  } else {
    label('incident', 'API trả chậm', 80, 250, 0, palette.ink, 32);
    line('incident-underline', 'M75 268 Q160 278 264 265');
    arrow('investigate', 268, 240, 420, 240, 1);
    line('decision', 'M570 100 L735 240 L570 380 L405 240 Z', 1);
    label('what-wait', 'Đang chờ gì?', 475, 248, 1, palette.blue, 30);
    arrow('cpu-branch', 675, 170, 900, 100, 2, palette.orange);
    arrow('io-branch', 675, 310, 900, 380, 3, palette.green);
    label('cpu', 'CPU / event loop', 922, 107, 2, palette.orange);
    label('cpu-measure', 'Profile · loop delay', 914, 150, 2, palette.muted, 22);
    label('io', 'Pool / downstream', 912, 390, 3, palette.green);
    label('io-measure', 'Trace · queue · timeout', 912, 435, 3, palette.muted, 22);
  }
  return { strokes, labels, focus: focusRegion(scene, Math.max(0, Math.min(3, phase))) };
}
