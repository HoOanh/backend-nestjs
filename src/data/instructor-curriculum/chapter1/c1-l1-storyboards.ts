import type { InstructorStoryboard } from '../types';

const process = (caption: string): InstructorStoryboard => ({ kind: 'process', caption });
const race = (caption: string, variant: 'shared' | 'local' = 'shared'): InstructorStoryboard => ({ kind: 'request-race', caption, variant });
const loop = (caption: string, variant: 'io' | 'blocked' = 'io'): InstructorStoryboard => ({ kind: 'event-loop', caption, variant });

/** Authored scene choices: the renderer never guesses meaning from a slide title. */
export const c1l1Storyboards: Record<string, InstructorStoryboard> = {
  'opening-incident': race('Hai người đặt lịch, một server đang phục vụ.'),
  'lesson-roadmap': process('Từ một file tới những lần chạy có tài nguyên riêng.'),
  'program-to-process': process('Một file. Hai lệnh chạy. Hai PID.'),
  'process-and-thread': { kind: 'process', variant: 'threads', caption: 'Process giữ tài nguyên; thread mang ngữ cảnh thực thi.' },
  'thread-context': race('Hai lần gọi có thể gặp cùng một object service.'),
  'virtual-address-space': { kind: 'process', caption: 'Cùng giá trị địa chỉ ảo chưa chắc cùng trang vật lý.', variant: 'isolated' },
  'file-descriptor-ownership': { kind: 'multiplexing', variant: 'fd', caption: 'Process dùng FD để tham chiếu tới socket trong kernel.' },
  'server-lifetime': race('Request kết thúc, service vẫn tiếp tục sống.'),
  'data-bleed-trace': race('Theo đường đi của A, rồi quan sát B đổi trạng thái chung.'),
  'stateless-repair': race('Mỗi lần gọi tiếp tục giữ tenant của chính nó.', 'local'),
  'data-bleed-test': race('Giữ A ở điểm chờ, cho B chạy, rồi mới mở cổng cho A.'),
  'async-request-context': race('Context đi theo lời gọi, không đi qua một biến current chung.', 'local'),
  'cooperative-runtime': loop('Trong lúc A chờ I/O, main thread có thể nhận việc B.'),
  'blocking-main-thread': loop('Vòng lặp chưa kết thúc: callback khác phải đợi.', 'blocked'),
  'async-versus-parallel': loop('Từ async không tự di chuyển vòng lặp sang lõi CPU khác.', 'blocked'),
  'microtask-starvation': loop('Nhường cho Promise chưa bảo đảm I/O có cơ hội được chạy.', 'blocked'),
  'latency-scale': loop('Tách đoạn đang chạy CPU khỏi khoảng đang chờ I/O.'),
  'little-law-worked-example': { kind: 'queue', caption: 'Giữ tốc độ, tăng thời gian lưu lại: lượng việc trong hệ thống tăng.' },
  'latency-waterfall': { kind: 'queue', caption: 'Phân biệt thời gian trung bình với phần đuôi phân bố.' },
  'thread-per-connection-cost': { kind: 'multiplexing', caption: 'Kết nối còn mở không có nghĩa callback đang chạy.' },
  'multiplexing': { kind: 'multiplexing', caption: 'Đăng ký nhiều socket; nhận những sự kiện sẵn sàng.' },
  'socket-event-trace': { kind: 'multiplexing', caption: 'Ready → đọc byte → driver xử lý → JavaScript tiếp tục.' },
  'connection-capacity-limits': { kind: 'multiplexing', caption: 'Quản lý chờ hiệu quả không xoá các giới hạn tài nguyên.' },
  'memory-regions': { kind: 'memory', caption: 'Heap chỉ là một phần trong các trang resident của process.' },
  'memory-metric-triage': { kind: 'memory', caption: 'Buffer bị giữ có thể tăng ngay khi heap ít thay đổi.' },
  'container-memory-budget': { kind: 'memory', caption: 'Giới hạn container và metric process là hai ranh giới khác nhau.' },
  'guided-production-case': { kind: 'diagnosis', caption: 'Theo bằng chứng để tìm chỗ request đang chờ.' },
  'diagnostic-decision-order': { kind: 'diagnosis', caption: 'Chọn một phép đo trước khi chọn một cách sửa.' },
  'lesson-recap': { kind: 'diagnosis', caption: 'Dữ liệu của ai? Đang chờ gì? Đang giữ tài nguyên nào?' },
  'closing-recap': { kind: 'diagnosis', caption: 'Quan sát → dự đoán → kiểm chứng.' }
};
