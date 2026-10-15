import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter2 } from '../curriculum/chapter2.ts';

// Câu hỏi tổng hợp liên bài (Cross-lesson Synthesis Questions) dành riêng cho Kỳ Thi Sprint 2
const sprint2SynthesisQuestions: QuizQuestion[] = [
  {
    id: 'exam-c2-q1',
    question: 'Khi một dịch vụ NestJS vừa thực hiện đệ quy Promise.resolve().then() để duyệt mảng, vừa gọi crypto.pbkdf2() trên 4 luồng mặc định của Libuv, hiện tượng kép nào sẽ xuất hiện trên hệ thống?',
    options: [
      'Các luồng C++ trong Libuv Threadpool vẫn tính xong pbkdf2 và bắn tín hiệu eventfd, nhưng luồng chính V8 bị kẹt cứng ở Microtask Checkpoint nên không thể tiến vào Pha Poll để thu hoạch kết quả.',
      'Hàm crypto.pbkdf2() tự động hủy bỏ toàn bộ hàng đợi Promise Microtask Queue để giành lại quyền điều khiển khung ngăn xếp V8 Call Stack cho các thao tác đọc ghi tệp tin.',
      'Nhân hệ điều hành Linux tự động chuyển toàn bộ các callback của Promise sang chạy song song trên cấu trúc Cây Đỏ-Đen của hệ thống ghép kênh sự kiện epoll.',
      'Bộ hẹn giờ trong Pha Timers tự động nâng kích thước biến môi trường UV_THREADPOOL_SIZE lên 128 luồng để giải phóng áp lực cho luồng thực thi chính của V8 Engine.'
    ],
    correctIndex: 0,
    explanation: 'Các tác vụ crypto.pbkdf2() chạy trên các luồng C++ độc lập của Libuv Threadpool nên vẫn hoàn thành tính toán trên các lõi CPU khác và ghi tín hiệu báo thức vào eventfd. Tuy nhiên, vì luồng chính V8 đang bị giam cầm vĩnh viễn ở bước xả Promise Microtask Queue (Event Loop Starvation), Libuv không bao giờ bước được vào Pha 4 (Poll) để gọi epoll_wait() thu hoạch kết quả từ Threadpool.'
  },
  {
    id: 'exam-c2-q2',
    question: 'Một máy chủ API Gateway viết bằng NestJS chỉ thực hiện chuyển tiếp các gói tin HTTP tới các Microservices nội bộ mà không hề đọc tệp tin hay băm mật khẩu. Tại sao khi tải tăng vọt lên 2,000 request/giây, hệ thống vẫn bị nghẽn ở Libuv Threadpool nếu không bật HTTP Keep-Alive?',
    options: [
      'Vì mỗi khi mở một kết nối TCP mới mà không có Keep-Alive, HTTP Client mặc định gọi hàm dns.lookup() (getaddrinfo) trên Libuv Threadpool 4 luồng, gây tắc nghẽn đầu hàng đợi phân giải tên miền.',
      'Vì giao thức HTTP/1.1 bắt buộc nhân hệ điều hành Linux phải tạo mới một luồng POSIX pthread trong Libuv Threadpool để mã hóa từng tiêu đề gói tin trước khi đẩy xuống Card mạng.',
      'Vì khi tắt chế độ Keep-Alive, toàn bộ các socket mạng sẽ bị loại khỏi cơ chế Linux epoll và buộc phải quay về sử dụng lời gọi hệ thống select() giới hạn ở mức 1024 kết nối.',
      'Vì mỗi yêu cầu HTTP mới sẽ tự động khởi tạo một thực thể máy ảo V8 Isolate bên trong module worker_threads khiến dung lượng bộ nhớ RAM vật lý bị cạn kiệt nhanh chóng.'
    ],
    correctIndex: 0,
    explanation: 'Dù bản thân việc truyền dữ liệu qua socket TCP hoàn toàn dùng epoll phi chặn (0 luồng), nhưng khi không bật Keep-Alive, mỗi HTTP request mới đi ra ngoài đều phải phân giải lại tên miền qua hàm mặc định dns.lookup(). Do dns.lookup() gọi hàm chặn luồng getaddrinfo() trên 4 luồng của Libuv Threadpool, 2,000 request/giây sẽ làm ngập hàng đợi Threadpool ngay lập tức.'
  },
  {
    id: 'exam-c2-q3',
    question: 'Trong một Worker Thread đang thực thi thuật toán nặng trên lõi CPU thứ 2, nếu lập trình viên gọi hàm fs.promises.readFile() để đọc tệp cấu hình, thao tác đọc tệp đó sẽ được xử lý ở đâu?',
    options: [
      'Nó sử dụng chung bể luồng C++ Libuv Worker Threadpool toàn cục của cả tiến trình Node.js, sau đó báo kết quả về riêng vòng lặp uv_loop_t độc lập của chính Worker Thread đó.',
      'Nó bắt buộc phải gửi thông điệp qua kênh MessagePort về lại cho Main Thread đọc tệp giúp vì các luồng Worker Isolate hoàn toàn không có quyền truy cập vào hệ thống tệp tin.',
      'Nó tự động khởi tạo thêm một bể luồng Libuv Threadpool mới gồm 4 luồng C++ dành riêng độc quyền cho mỗi Worker Thread vừa được sinh ra bên trong tiến trình.',
      'Nó bỏ qua hoàn toàn thư viện Libuv và đọc trực tiếp từ bộ nhớ đệm L3 Cache của vi xử lý thông qua các tập lệnh nguyên tử của đối tượng Atomics.'
    ],
    correctIndex: 0,
    explanation: 'Trong kiến trúc đa luồng của Node.js, mỗi Worker Thread sở hữu một V8 Isolate và một vòng lặp sự kiện uv_loop_t riêng biệt, nhưng toàn bộ các Worker Threads trong cùng một tiến trình đều chia sẻ chung duy nhất một bể luồng C++ Libuv Threadpool ở tầng đáy. Khi đọc xong tệp, luồng C++ sẽ báo thức về đúng eventfd của vòng lặp thuộc Worker đã gọi hàm.'
  },
  {
    id: 'exam-c2-q4',
    question: 'Khi thiết kế hệ thống phòng thủ quá tải (Load Shedding) cho dịch vụ NestJS trên Kubernetes, tại sao kỹ sư phải tách biệt hành vi của Liveness Probe (/health/live) và Readiness Probe (/health/ready) khi chỉ số ELU vượt ngưỡng 0.85?',
    options: [
      'Để Liveness Probe vẫn trả về 200 OK giữ cho Pod không bị giết oan, trong khi Readiness Probe trả về 503 để Kubernetes tạm ngưng định tuyến thêm request mới vào Pod đang quá tải.',
      'Để ép dịch vụ kubelet tự động tăng gấp đôi hạn ngạch số lõi vCPU trong Linux cgroups mỗi khi phát hiện Readiness Probe trả về mã trạng thái lỗi 503 liên tiếp.',
      'Để chuyển toàn bộ các kết nối cơ sở dữ liệu từ giao thức TCP sang giao thức UDP nhằm giảm thiểu thời gian chờ đợi tại Pha Poll của vòng lặp sự kiện Libuv.',
      'Để buộc bộ thu gom rác Orinoco dừng hoàn toàn pha Major GC Mark-Sweep-Compact cho đến khi cả hai đầu dò sức khỏe đều nhận được phản hồi thành công.'
    ],
    correctIndex: 0,
    explanation: 'Nếu Liveness Probe bị thất bại hoặc trả về lỗi khi tải cao, Kubernetes sẽ giết chết Pod (SIGKILL) và đẩy toàn bộ tải sang các Pod còn lại gây sập dây chuyền (Cascading Failure). Cách thiết kế chuẩn là giữ Liveness Probe siêu nhẹ (chỉ kiểm tra tiến trình chưa bị deadlock), còn khi ELU hoặc P99 Lag vượt ngưỡng an toàn thì báo 503 ở Readiness Probe để rút Pod tạm thời khỏi Load Balancer cho tới khi xả hết hàng đợi.'
  },
  {
    id: 'exam-c2-q5',
    question: 'Giả sử trong một callback của Pha 4 (Poll), lập trình viên đăng ký đồng thời: (1) setTimeout(fnA, 0), (2) setImmediate(fnB), (3) queueMicrotask(fnC), và (4) process.nextTick(fnD). Thứ tự thực thi chính xác tuyệt đối sẽ là gì?',
    options: [
      'fnD (process.nextTick) -> fnC (queueMicrotask) -> fnB (setImmediate ở Pha Check) -> fnA (setTimeout ở Pha Timers của vòng Tick kế tiếp).',
      'fnC (queueMicrotask) -> fnD (process.nextTick) -> fnA (setTimeout ở Pha Timers) -> fnB (setImmediate ở Pha Check của cùng vòng Tick).',
      'fnB (setImmediate) -> fnD (process.nextTick) -> fnC (queueMicrotask) -> fnA (setTimeout ở Pha Timers sau khi đã chờ đủ 1ms).',
      'fnD (process.nextTick) -> fnA (setTimeout) -> fnB (setImmediate) -> fnC (queueMicrotask ở cuối vòng lặp sự kiện hiện tại).'
    ],
    correctIndex: 0,
    explanation: 'Ngay khi callback ở Pha 4 (Poll) vừa kết thúc, Microtask Checkpoint được kích hoạt: process.nextTickQueue luôn có ưu tiên cao nhất nên fnD chạy đầu tiên, tiếp theo là Promise/Microtask Queue nên fnC chạy thứ hai. Khi cả hai hàng đợi Microtask đã rỗng, vòng lặp Libuv rời Pha 4 (Poll) bước sang Pha 5 (Check) liền kề nên fnB (setImmediate) chạy thứ ba, và cuối cùng mới vòng về Pha 1 (Timers) để chạy fnA.'
  },
  {
    id: 'exam-c2-q6',
    question: 'Tại sao việc gọi phương thức Atomics.wait(sharedInt32Array, 0, 0) trực tiếp trên luồng chính (V8 Main Thread) để chờ kết quả từ Worker Thread lại là một hành vi bị cấm trong kiến trúc Node.js?',
    options: [
      'Vì Atomics.wait() thực hiện khóa đồng bộ cấp độ nhân (futex sleep) làm đóng băng hoàn toàn V8 Main Thread và chặn đứng toàn bộ 6 pha của Libuv Event Loop cho đến khi được đánh thức.',
      'Vì đối tượng Atomics chỉ được trình thông dịch Bytecode Ignition nạp vào bộ nhớ khi mã nguồn đang thực thi bên trong ngữ cảnh của một tiến trình con Child Process.',
      'Vì lệnh Atomics.wait() tự động giải phóng và thu hồi toàn bộ vùng nhớ SharedArrayBuffer về lại cho hệ điều hành ngay sau khi luồng chính vừa đọc xong giá trị.',
      'Vì việc gọi Atomics.wait() trên luồng chính sẽ làm hỏng cấu trúc cây nhị phân Min-Heap của Pha Timers và khiến mọi hàm setTimeout bị trôi thời gian vĩnh viễn.'
    ],
    correctIndex: 0,
    explanation: 'Atomics.wait() đưa luồng gọi hàm vào trạng thái ngủ đông cấp độ nhân hệ điều hành (tương đương syscall futex) cho đến khi có một luồng khác gọi Atomics.notify(). Nếu gọi hàm này trên V8 Main Thread, toàn bộ vòng lặp sự kiện Libuv sẽ bị đóng băng tức khắc và không thể xử lý bất kỳ kết nối mạng hay timer nào nữa. Trên Main Thread, kỹ sư chỉ được phép dùng Atomics.waitAsync() (trả về Promise phi chặn) hoặc lắng nghe sự kiện qua MessagePort.'
  }
];

// Gom các câu hỏi từ 3 bài học của Chương 2 cùng bộ câu hỏi tổng hợp Sprint 2 (Tổng 30 câu)
const examQuestions: QuizQuestion[] = [
  ...chapter2.lessons.flatMap((l) => l.quiz),
  ...sprint2SynthesisQuestions,
];

const examChallenge: CodeChallenge = {
  id: 'exam-c2-challenge',
  level: 'advanced',
  levelLabel: 'Cấp độ 3: Kiến Trúc & Production (Sprint 2 Capstone)',
  title: 'Thiết Kế Bộ Điều Phối Cắt Tải Chủ Động & Phân Tải Worker Pool (Adaptive Loop & Threadpool Orchestrator)',
  description:
    'Trong môi trường Production tải cao, bộ điều phối trung tâm của NestJS phải kết hợp cả 3 bài học của Chương 2: giám sát độ trễ vòng lặp (`P99 Lag` & `ELU`), kiểm soát vách ngăn `Libuv Threadpool` và định tuyến tác vụ sang `Worker Pool` bằng `Zero-Copy`. Hãy hiện thực hàm `orchestrateRuntimeProtection(telemetry, incomingTasks)` theo đặc tả:\n' +
    '1. **Kiểm tra hợp lệ đầu vào (Defensive Validation):**\n' +
    '   - `telemetry` phải là object chứa: `p99LagMs >= 0`, `eluRatio` trong đoạn `[0, 1]`, `freeThreadpoolSlots >= 0` (số nguyên), `freeWorkerIsolates >= 0` (số nguyên).\n' +
    '   - `incomingTasks` phải là mảng các phần tử `{ id: string, kind: "NETWORK_EPOLL" | "FS_THREADPOOL" | "CPU_WORKER", payloadMb: number }` với `payloadMb >= 0`.\n' +
    '   - Nếu bất kỳ điều kiện nào vi phạm, ném ngoại lệ `throw new Error("INVALID_RUNTIME_ORCHESTRATOR_INPUT")`.\n' +
    '2. **Đánh giá Trạng thái Sức khỏe Vòng lặp (`loopState`):**\n' +
    '   - Nếu `telemetry.p99LagMs > 100` hoặc `telemetry.eluRatio > 0.90`: `loopState = "CRITICAL_SHED_ALL_HEAVY"` (Cắt tải khẩn cấp).\n' +
    '   - Ngược lại, nếu `telemetry.p99LagMs > 40` hoặc `telemetry.eluRatio > 0.75`: `loopState = "DEGRADED_THROTTLE"`.\n' +
    '   - Ngược lại: `loopState = "HEALTHY"`.\n' +
    '3. **Định tuyến từng tác vụ trong `incomingTasks` theo thứ tự:**\n' +
    '   - Với `"NETWORK_EPOLL"`: Luôn được chấp nhận đẩy vào mảng `epollAcceptedIds` (vì chạy thuần Kernel `epoll` không tốn luồng), trừ khi `loopState === "CRITICAL_SHED_ALL_HEAVY"` và `task.payloadMb > 10` thì đẩy vào `shedRejectedIds`.\n' +
    '   - Với `"FS_THREADPOOL"`: Nếu `loopState !== "CRITICAL_SHED_ALL_HEAVY"` và vẫn còn `remainingThreadpoolSlots > 0`, giảm `remainingThreadpoolSlots--` và đẩy `id` vào `threadpoolAcceptedIds`; ngược lại đẩy vào `shedRejectedIds`.\n' +
    '   - Với `"CPU_WORKER"`: Nếu `loopState === "HEALTHY"` và vẫn còn `remainingWorkerIsolates > 0`, giảm `remainingWorkerIsolates--`, đẩy `id` vào `workerAcceptedIds`, đồng thời nếu `task.payloadMb >= 5` thì tăng bộ đếm `zeroCopyTransfers++`; ngược lại đẩy `id` vào `shedRejectedIds`.\n' +
    '4. Trả về `{ loopState, epollAcceptedIds, threadpoolAcceptedIds, workerAcceptedIds, shedRejectedIds, zeroCopyTransfers }`.',
  guidedSteps: [
    'Bước 1 (Kiểm tra tham số phòng thủ): Xác thực chặt chẽ đối tượng `telemetry` (`p99LagMs >= 0`, `0 <= eluRatio <= 1`, `freeThreadpoolSlots` và `freeWorkerIsolates` là số nguyên không âm) và mảng `incomingTasks`. Nếu sai, `throw new Error("INVALID_RUNTIME_ORCHESTRATOR_INPUT")`.',
    'Bước 2 (Xác định trạng thái loopState): So sánh `p99LagMs` và `eluRatio` với ngưỡng nguy kịch (`> 100` hoặc `> 0.90` -> `"CRITICAL_SHED_ALL_HEAVY"`) và ngưỡng suy giảm (`> 40` hoặc `> 0.75` -> `"DEGRADED_THROTTLE"`), còn lại là `"HEALTHY"`.',
    'Bước 3 (Duyệt và phân luồng incomingTasks): Sao chép `remainingThreadpoolSlots = telemetry.freeThreadpoolSlots` và `remainingWorkerIsolates = telemetry.freeWorkerIsolates`. Phân nhánh theo `task.kind` (`NETWORK_EPOLL`, `FS_THREADPOOL`, `CPU_WORKER`) đúng theo quy tắc cấp phát và cắt tải.',
    'Bước 4 (Đếm Zero-Copy và trả về): Với mỗi tác vụ `CPU_WORKER` được chấp nhận có `payloadMb >= 5`, tăng `zeroCopyTransfers++`. Trả về đầy đủ 6 trường trong object kết quả.'
  ],
  hints: [
    'Chú ý tác vụ `"CPU_WORKER"` chỉ được phép nhận khi `loopState === "HEALTHY"` và còn `remainingWorkerIsolates > 0`; nếu vòng lặp đang ở trạng thái `"DEGRADED_THROTTLE"` hoặc `"CRITICAL_SHED_ALL_HEAVY"`, mọi tác vụ `"CPU_WORKER"` mới đều bị cắt tải đưa vào `shedRejectedIds`.',
    'Đối với `"NETWORK_EPOLL"`, nó không tiêu tốn bất kỳ slot nào của Threadpool hay Worker Isolate, và chỉ bị từ chối khi `loopState === "CRITICAL_SHED_ALL_HEAVY"` đi kèm `payloadMb > 10`.'
  ],
  starterCode: `function orchestrateRuntimeProtection(telemetry, incomingTasks) {
  // Bước 1: Kiểm tra tính hợp lệ của telemetry và incomingTasks; ném Error("INVALID_RUNTIME_ORCHESTRATOR_INPUT") nếu sai
  
  // Bước 2: Phân loại loopState ("CRITICAL_SHED_ALL_HEAVY" | "DEGRADED_THROTTLE" | "HEALTHY")
  
  // Bước 3: Duyệt incomingTasks để định tuyến vào epollAcceptedIds, threadpoolAcceptedIds, workerAcceptedIds hoặc shedRejectedIds
  
  // Bước 4: Đếm số lần truyền zeroCopyTransfers (cho CPU_WORKER có payloadMb >= 5) và trả về kết quả
}`,
  solution: `function orchestrateRuntimeProtection(telemetry, incomingTasks) {
  if (
    !telemetry ||
    typeof telemetry !== 'object' ||
    typeof telemetry.p99LagMs !== 'number' ||
    !Number.isFinite(telemetry.p99LagMs) ||
    telemetry.p99LagMs < 0 ||
    typeof telemetry.eluRatio !== 'number' ||
    !Number.isFinite(telemetry.eluRatio) ||
    telemetry.eluRatio < 0 ||
    telemetry.eluRatio > 1 ||
    !Number.isInteger(telemetry.freeThreadpoolSlots) ||
    telemetry.freeThreadpoolSlots < 0 ||
    !Number.isInteger(telemetry.freeWorkerIsolates) ||
    telemetry.freeWorkerIsolates < 0 ||
    !Array.isArray(incomingTasks)
  ) {
    throw new Error('INVALID_RUNTIME_ORCHESTRATOR_INPUT');
  }

  const validKinds = new Set(['NETWORK_EPOLL', 'FS_THREADPOOL', 'CPU_WORKER']);
  for (let i = 0; i < incomingTasks.length; i++) {
    const t = incomingTasks[i];
    if (
      !t ||
      typeof t.id !== 'string' ||
      !t.id ||
      !validKinds.has(t.kind) ||
      typeof t.payloadMb !== 'number' ||
      !Number.isFinite(t.payloadMb) ||
      t.payloadMb < 0
    ) {
      throw new Error('INVALID_RUNTIME_ORCHESTRATOR_INPUT');
    }
  }

  let loopState = 'HEALTHY';
  if (telemetry.p99LagMs > 100 || telemetry.eluRatio > 0.9) {
    loopState = 'CRITICAL_SHED_ALL_HEAVY';
  } else if (telemetry.p99LagMs > 40 || telemetry.eluRatio > 0.75) {
    loopState = 'DEGRADED_THROTTLE';
  }

  let remainingPool = telemetry.freeThreadpoolSlots;
  let remainingWorkers = telemetry.freeWorkerIsolates;
  const epollAcceptedIds = [];
  const threadpoolAcceptedIds = [];
  const workerAcceptedIds = [];
  const shedRejectedIds = [];
  let zeroCopyTransfers = 0;

  for (let i = 0; i < incomingTasks.length; i++) {
    const task = incomingTasks[i];
    if (task.kind === 'NETWORK_EPOLL') {
      if (loopState === 'CRITICAL_SHED_ALL_HEAVY' && task.payloadMb > 10) {
        shedRejectedIds.push(task.id);
      } else {
        epollAcceptedIds.push(task.id);
      }
    } else if (task.kind === 'FS_THREADPOOL') {
      if (loopState !== 'CRITICAL_SHED_ALL_HEAVY' && remainingPool > 0) {
        remainingPool--;
        threadpoolAcceptedIds.push(task.id);
      } else {
        shedRejectedIds.push(task.id);
      }
    } else if (task.kind === 'CPU_WORKER') {
      if (loopState === 'HEALTHY' && remainingWorkers > 0) {
        remainingWorkers--;
        workerAcceptedIds.push(task.id);
        if (task.payloadMb >= 5) {
          zeroCopyTransfers++;
        }
      } else {
        shedRejectedIds.push(task.id);
      }
    }
  }

  return {
    loopState,
    epollAcceptedIds,
    threadpoolAcceptedIds,
    workerAcceptedIds,
    shedRejectedIds,
    zeroCopyTransfers
  };
}`,
  testCases: [
    {
      name: 'Hệ thống HEALTHY: Định tuyến chuẩn xác sang epoll, Threadpool và Worker Pool kèm Zero-Copy',
      input: [
        { p99LagMs: 12, eluRatio: 0.45, freeThreadpoolSlots: 2, freeWorkerIsolates: 2 },
        [
          { id: 'HTTP_1', kind: 'NETWORK_EPOLL', payloadMb: 0.5 },
          { id: 'FS_1', kind: 'FS_THREADPOOL', payloadMb: 2 },
          { id: 'CPU_SMALL', kind: 'CPU_WORKER', payloadMb: 1 },
          { id: 'CPU_LARGE', kind: 'CPU_WORKER', payloadMb: 25 },
          { id: 'CPU_OVERFLOW', kind: 'CPU_WORKER', payloadMb: 10 }
        ]
      ],
      expected: {
        loopState: 'HEALTHY',
        epollAcceptedIds: ['HTTP_1'],
        threadpoolAcceptedIds: ['FS_1'],
        workerAcceptedIds: ['CPU_SMALL', 'CPU_LARGE'],
        shedRejectedIds: ['CPU_OVERFLOW'],
        zeroCopyTransfers: 1
      },
      hidden: false
    },
    {
      name: 'Hệ thống DEGRADED_THROTTLE (P99 Lag = 65ms): Cho phép epoll & FS nhưng từ chối toàn bộ CPU_WORKER mới',
      input: [
        { p99LagMs: 65, eluRatio: 0.6, freeThreadpoolSlots: 1, freeWorkerIsolates: 3 },
        [
          { id: 'NET_1', kind: 'NETWORK_EPOLL', payloadMb: 20 },
          { id: 'FS_1', kind: 'FS_THREADPOOL', payloadMb: 1 },
          { id: 'FS_2', kind: 'FS_THREADPOOL', payloadMb: 1 },
          { id: 'CPU_1', kind: 'CPU_WORKER', payloadMb: 8 }
        ]
      ],
      expected: {
        loopState: 'DEGRADED_THROTTLE',
        epollAcceptedIds: ['NET_1'],
        threadpoolAcceptedIds: ['FS_1'],
        workerAcceptedIds: [],
        shedRejectedIds: ['FS_2', 'CPU_1'],
        zeroCopyTransfers: 0
      },
      hidden: false
    },
    {
      name: 'Hệ thống CRITICAL_SHED_ALL_HEAVY (ELU = 0.95): Cắt tải toàn bộ FS, CPU_WORKER và các gói mạng lớn > 10MB',
      input: [
        { p99LagMs: 30, eluRatio: 0.95, freeThreadpoolSlots: 4, freeWorkerIsolates: 4 },
        [
          { id: 'HEALTH_PROBE', kind: 'NETWORK_EPOLL', payloadMb: 0.01 },
          { id: 'BIG_UPLOAD', kind: 'NETWORK_EPOLL', payloadMb: 15 },
          { id: 'FS_READ', kind: 'FS_THREADPOOL', payloadMb: 0.5 },
          { id: 'CPU_JOB', kind: 'CPU_WORKER', payloadMb: 2 }
        ]
      ],
      expected: {
        loopState: 'CRITICAL_SHED_ALL_HEAVY',
        epollAcceptedIds: ['HEALTH_PROBE'],
        threadpoolAcceptedIds: [],
        workerAcceptedIds: [],
        shedRejectedIds: ['BIG_UPLOAD', 'FS_READ', 'CPU_JOB'],
        zeroCopyTransfers: 0
      },
      hidden: false
    },
    {
      name: 'Test biên ẩn: Chạm đúng ngưỡng payloadMb = 5 cho Zero-Copy và ngưỡng biên Lag = 40ms, ELU = 0.75 (vẫn HEALTHY)',
      input: [
        { p99LagMs: 40, eluRatio: 0.75, freeThreadpoolSlots: 1, freeWorkerIsolates: 1 },
        [
          { id: 'W_EXACT_5MB', kind: 'CPU_WORKER', payloadMb: 5 }
        ]
      ],
      expected: {
        loopState: 'HEALTHY',
        epollAcceptedIds: [],
        threadpoolAcceptedIds: [],
        workerAcceptedIds: ['W_EXACT_5MB'],
        shedRejectedIds: [],
        zeroCopyTransfers: 1
      },
      hidden: true
    },
    {
      name: 'Test ẩn: Tham số eluRatio vượt ngoài khoảng [0, 1] -> Ném lỗi INVALID_RUNTIME_ORCHESTRATOR_INPUT',
      input: [
        { p99LagMs: 10, eluRatio: 1.5, freeThreadpoolSlots: 4, freeWorkerIsolates: 2 },
        []
      ],
      expected: 'ERROR_THROWN',
      hidden: true
    }
  ]
};

export const exam2: SprintExam = {
  sprintId: 2,
  title: 'Kỳ Thi Đánh Giá Chương 2: Libuv, OS Kernel System Calls & Non-Blocking Architecture',
  description:
    'Khảo thí chuyên sâu: The Single-Thread Illusion, 6 Pha Libuv Event Loop, Quy tắc Drain Microtasks (Node 11+), Ghép kênh sự kiện Linux epoll/kqueue O(1) đối đầu Libuv Threadpool, và Quản trị Event Loop Lag/ELU với kiến trúc đa luồng Worker Threads Zero-Copy.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
