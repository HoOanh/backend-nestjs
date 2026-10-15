import type { Lesson } from '../types.ts';

export const c2_l3: Lesson = {
  id: 'c2-l3',
  title: 'Bài 03: Quản Trị Event Loop Lag, Worker Threads & Xử Lý Tác Vụ Tính Toán Nặng (CPU Offloading)',
  duration: '60 phút',
  tag: 'Profiling & Multi-threading',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Giám sát Hiệu năng Thời gian thực (Real-time Runtime Telemetry) và Kiến trúc Đa luồng Cô lập (Multi-Isolate Worker Thread Architecture) từ cấp độ tập lệnh nguyên tử CPU đến quản trị tải trên Kubernetes cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Định lượng Độ trễ Vòng lặp (Event Loop Lag HDR Histogram), Hiệu suất Sử dụng (ELU) và Hiệu ứng Bão Thử lại (Retry Storm):** Hiểu rõ nguyên lý đo đạc độ trễ bằng đồng hồ phân giải nano-giây \`perf_hooks.monitorEventLoopDelay\`, công thức tính **Event Loop Utilization (\`ELU\`)**, và cơ chế sụp đổ dây chuyền dẫn tới lỗi **\`Kubernetes CrashLoopBackOff\`** khi một tác vụ CPU-bound chặn luồng chính.
> 2. **Giải phẫu Kiến trúc \`worker_threads\` (Multi-Isolate) và Cơ chế Truyền Bộ nhớ Không sao chép (Zero-Copy & Shared Memory):** Phân biệt rạch ròi giữa \`child_process.fork()\`, \`Libuv Threadpool\` và \`worker_threads\` (\`V8 Isolate\` độc lập trong cùng tiến trình OS); nắm vững sự đánh đổi giữa thuật toán nhân bản **\`Structured Clone\`**, chuyển quyền sở hữu con trỏ **\`ArrayBuffer TransferList (Zero-Copy)\`** và bộ nhớ dùng chung **\`SharedArrayBuffer + Atomics\`**.
> 3. **Thiết kế Bể Luồng Công nhân Tái sử dụng (Bounded Worker Pool) và Cơ chế Cắt tải Chủ động (Adaptive Load Shedding) trong NestJS:** Loại bỏ phản mẫu khởi tạo \`new Worker()\` trên mỗi HTTP Request; làm chủ kỹ thuật định cỡ Worker Pool theo số lõi vCPU, thiết kế hàng đợi có áp lực ngược (\`Backpressure\`) và ngắt mạch sớm (\`Circuit Breaking\`) khi \`P99 Lag\` hoặc \`ELU\` vượt ngưỡng an toàn.

---

# 1. ĐỊNH LƯỢNG EVENT LOOP LAG, CHỈ SỐ ELU VÀ THẢM HỌA DÂY CHUYỀN RETRY STORM TRÊN KUBERNETES

### 1.1 Khái niệm nền tảng: Giả thuyết Tác vụ Ngắn (Short-Tick Assumption), Event Loop Lag và Event Loop Utilization (ELU)

Toàn bộ sức mạnh xử lý hàng chục nghìn kết nối đồng thời của kiến trúc Reactor trong Node.js được xây dựng dựa trên một tiên đề duy nhất gọi là **Giả thuyết Tác vụ Ngắn (\`Short-Tick Assumption\`)**: *Mọi hàm callback chạy trên \`V8 Call Stack\` của luồng chính chỉ được phép tiêu tốn từ vài chục micro-giây đến tối đa vài mili-giây trước khi trả lại quyền điều khiển cho Libuv*.

Khi một lập trình viên vô tình đặt một tác vụ **Tính toán Nặng trên CPU (\`CPU-Bound Task\`)** ngay trên luồng chính — chẳng hạn phân tích cú pháp \`JSON.parse()\` cho chuỗi dữ liệu \`50 MB\`, chạy biểu thức chính quy bị suy thoái mũ (\`Catastrophic Backtracking — ReDoS\`), xuất báo cáo Excel 100,000 dòng, hoặc gọi hàm đồng bộ \`crypto.pbkdf2Sync()\` — tiên đề trên lập tức bị phá vỡ. Để đo lường chính xác mức độ suy thoái của luồng chính trên môi trường Production, kỹ sư hệ thống không thể chỉ nhìn vào chỉ số \`% CPU\` của hệ điều hành (vốn tính trung bình trên toàn bộ các lõi CPU), mà bắt buộc phải giám sát hai đại lượng toán học cốt lõi trong module \`node:perf_hooks\`:

1. **Độ trễ Vòng lặp Sự kiện (\`Event Loop Lag / Event Loop Delay\`):**
   Là khoảng thời gian chênh lệch ($\Delta t$) giữa **thời điểm một bộ hẹn giờ dự kiến được kích hoạt** so với **thời điểm thực tế luồng chính V8 rảnh tay để thực thi bộ hẹn giờ đó**.
   - Bên trong hàm \`perf_hooks.monitorEventLoopDelay({ resolution: 10 })\`, Libuv khởi tạo một luồng hẹn giờ nội bộ kiểm tra sau mỗi \`10 ms\`. Nếu vòng lặp hoàn toàn khỏe mạnh, nó thức dậy đúng tại \`10.02 ms\` $\rightarrow$ **\`Lag = 0.02 ms\`**. Nhưng nếu luồng chính đang bị kẹt cứng trong hàm \`JSON.parse()\` mất \`450 ms\`, thì phải đến mốc \`450 ms\` phép đo mới được ghi nhận $\rightarrow$ **\`Lag = 440 ms\`**!
   - Các giá trị đo được lưu vào cấu trúc **Biểu đồ Tần suất Dải Động Cao (\`HDR Histogram — High Dynamic Range Histogram\`)** tính bằng đơn vị nano-giây (\`ns\`), cho phép trích xuất tức thì các phân vị thống kê **\`P50\` (Trung vị)**, **\`P90\`**, **\`P99\` (Độ trễ đuôi)** và **\`Max\`** với chi phí bộ nhớ cố định cực nhỏ.
2. **Tỷ lệ Chiếm dụng Vòng lặp (\`Event Loop Utilization — ELU\`):**
   Tại sao chỉ đo \`Event Loop Lag\` đôi khi vẫn chưa đủ? Hãy xét trường hợp máy chủ liên tục nhận các tác vụ nhỏ \`2 ms\` nối đuôi nhau không nghỉ một giây nào. Vì mỗi tác vụ chỉ dài \`2 ms\`, chỉ số \`Lag\` đo được có thể vẫn thấp (\`~2 – 5 ms\`), nhưng thực chất luồng chính đã bận **\`99.5%\`** thời gian và chỉ cần thêm 10% lưu lượng nữa là hệ thống sẽ sụp đổ hoàn toàn!
   - Để khắc phục điểm mù này, Node.js cung cấp hàm \`performance.eventLoopUtilization(elu2, elu1)\` đo trực tiếp thời gian luồng chính thực sự thức để làm việc (**\`active\`**) so với thời gian nằm ngủ chờ gói tin mạng bên trong hàm \`epoll_wait()\` tại Pha 4 (**\`idle\`**). Chỉ số \`ELU = active / (active + idle)\` (từ \`0.0\` đến \`1.0\`, hay \`0% – 100%\`) là thước đo trung thực tuyệt đối về tải thực tế của luồng chính V8.

### 1.2 Đối chiếu các Chỉ số Giám sát Sức khỏe Runtime trên Môi trường Production

Bảng dưới đây đối chiếu 5 chỉ số giám sát sống còn giúp kỹ sư phân biệt chính xác hiện tượng nghẽn CPU luồng chính với các điểm nghẽn hạ tầng khác:

| Chỉ số Giám sát (\`Telemetry Metric\`) | Công cụ / API Thu thập trong Node.js | Ý nghĩa Vật lý Chính xác | Ngưỡng Vận hành An toàn (SLA) | Điểm mù nếu Chỉ Dùng Đơn độc Chỉ số này |
| :--- | :--- | :--- | :--- | :--- |
| **\`OS Process CPU %\`** | \`process.cpuUsage()\` hoặc Prometheus \`container_cpu_usage\` | Tổng thời gian thực thi của **toàn bộ các luồng** trong tiến trình (gồm cả Main Thread, GC Threads và Libuv Pool) | \`< 70%\` tổng hạn ngạch \`limits.cpu\` của Container | Trên máy 8 cores, nếu V8 Main Thread bị treo cứng 100% ở 1 core thì tổng CPU toàn máy chỉ báo \`12.5%\` (Báo động giả an toàn!) |
| **\`Event Loop Lag P50\` (Median)** | \`histogram.percentile(50) / 1e6\` (\`perf_hooks\`) | Độ trễ vòng lặp mà 50% số chu kỳ lấy mẫu gặp phải (phản ánh trạng thái trung bình) | **\`< 5 ms\`** | Hoàn toàn che giấu các đợt giật lag đột biến (\`Micro-bursts\`) xảy ra ở 1% số request nặng |
| **\`Event Loop Lag P99\` (Tail Lag)** | \`histogram.percentile(99) / 1e6\` (\`perf_hooks\`) | Độ trễ vòng lặp ở phân vị thứ 99 (phản ánh các cú chặn luồng do \`Major GC\` hoặc \`JSON.parse\` lớn) | **\`< 20 ms\`** (Cảnh báo ở \`50 ms\`, Nguy kịch ở \`> 100 ms\`) | Chỉ báo hiệu sau khi cú chặn luồng đã xảy ra; không dự báo trước khi luồng chính bị lấp đầy bởi nhiều việc nhỏ |
| **\`Event Loop Utilization (ELU)\`** | \`performance.eventLoopUtilization().utilization\` | Tỷ lệ thời gian luồng chính bận xử lý ngoài \`epoll_wait\` trên tổng thời gian đồng hồ trôi qua | **\`0.10 – 0.65\` (\`10% – 65%\`)**; Nguy kịch khi **\`> 0.85 (85%)\`** | Không cho biết luồng đang bận vì chạy 10,000 việc nhỏ \`0.1 ms\` hay đang bị kẹt bởi 1 việc khổng lồ \`1,000 ms\` |
| **\`Active Requests / Handles\`** | \`process.getActiveResourcesInfo()\` | Số lượng tài nguyên I/O đang bay (\`FSReqCallback\`, \`TCPSocketWrap\`) chờ hoàn tất | Ổn định theo lưu lượng đồng thời (\`Concurrency\`) | Không phản ánh việc V8 Call Stack có đang bị khóa cứng bởi phép toán đồng bộ thuần JavaScript hay không |

### 1.3 Cơ chế Sụp đổ Dây chuyền: Từ Chặn Luồng Chính đến \`Retry Storm\` và \`Kubernetes CrashLoopBackOff\`

Khi một endpoint trong NestJS thực hiện tác vụ CPU-bound chặn luồng chính trong **\`3.5 giây\`**, nó không chỉ làm chậm duy nhất người dùng gọi endpoint đó, mà kích hoạt một chuỗi phản ứng dây chuyền đánh sập toàn bộ cụm máy chủ theo 4 giai đoạn:

1. **Giai đoạn 1 — Đóng băng Toàn cục Pha Poll (\`Global I/O Freeze\`):**
   Trong suốt \`3,500 ms\` mà V8 Call Stack bị chiếm giữ, Libuv không thể bước vào Pha 4 (\`Poll\`). Hàng nghìn gói tin HTTP của các khách hàng khác gửi tới được Card mạng chép vào \`TCP Receive Buffer\` và nằm xếp hàng chết cứng trong hàng đợi \`SYN/Accept Backlog\` của nhân Linux.
2. **Giai đoạn 2 — Bão Thử lại từ Client & API Gateway (\`Retry Storm / Thundering Herd\`):**
   Các dịch vụ gọi đến (hoặc API Gateway có ngưỡng \`timeout = 2,000 ms\`) thấy quá 2 giây không nhận được phản hồi liền ngắt kết nối và **tự động bắn lại yêu cầu lần 2, lần 3 (\`Automated Retries\`)**. Khi luồng chính vừa thoát khỏi cú chặn \`3.5 giây\`, nó lập tức đối mặt với lượng lưu lượng gấp 3 lần bình thường, trong đó 2/3 là các yêu cầu đã bị client hủy bỏ (**Zombie Requests**), nhưng Node.js không hề biết và vẫn tiếp tục tốn CPU xử lý từng yêu cầu một!
3. **Giai đoạn 3 — Tử hình bởi Đầu dò Sức khỏe Kubernetes (\`Liveness Probe Assassination\`):**
   Trong lúc luồng chính đang vật lộn với bão Retry, dịch vụ \`kubelet\` của Kubernetes gửi một yêu cầu HTTP \`GET /healthz\` để kiểm tra xem Pod còn sống hay không (với cấu hình mặc định \`timeoutSeconds: 1\` hoặc \`3\`, \`failureThreshold: 3\`). Vì yêu cầu \`GET /healthz\` cũng phải đi qua cùng một Pha \`Poll\` và cùng một \`V8 Main Thread\` đang bị nghẽn cứng, nó không thể trả về mã \`200 OK\` đúng hạn!
4. **Giai đoạn 4 — Vòng lặp Tử thần (\`CrashLoopBackOff\`):**
   \`kubelet\` kết luận Pod đã bị khóa chết (\`Deadlocked\`) và gửi tín hiệu \`SIGTERM / SIGKILL\` tiêu diệt Pod đó. Ngay khi Pod này chết, toàn bộ lưu lượng của nó bị Load Balancer đổ dồn sang các Pod còn sống bên cạnh $\rightarrow$ làm các Pod bên cạnh quá tải \`ELU = 100%\` và lần lượt chết theo hiệu ứng quân bài Domino!

Hãy đối chiếu hai thiết kế dịch vụ kiểm tra sức khỏe và tiếp nhận tác vụ nặng dưới đây để thấy cách áp dụng **Cắt tải Chủ động (\`Adaptive Load Shedding\`)** nhằm bảo vệ sinh mạng của Pod:

\`\`\`typescript
// File: src/modules/resilience/adaptive-load-shedder.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Chạy tác vụ CPU-bound trực tiếp và không có rào chắn bảo vệ Liveness Probe
@Injectable()
export class UnprotectedReportBrokenService {
  generateHeavySignatureSync(payload: string, rounds: number): string {
    // LỖI CHÍ MẠNG: Băm đồng bộ hàng trăm nghìn vòng ngay trên V8 Main Thread!
    // Khi có 10 request cùng gọi hàm này (mỗi hàm tốn 400ms), Event Loop bị khóa cứng 4 giây,
    // làm timeout toàn bộ Kubernetes Liveness Probe (/healthz) và khiến Pod bị giết!
    let currentHash = payload;
    for (let i = 0; i < rounds; i++) {
      currentHash = crypto.createHash('sha256').update(currentHash).digest('hex');
    }
    return currentHash;
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION LOAD SHEDDING): Giám sát P99 Lag & ELU để ngắt mạch sớm (HTTP 503)
@Injectable()
export class AdaptiveLoadShedderSafeService implements OnModuleInit, OnModuleDestroy {
  private histogram: IntervalHistogram | null = null;
  private lastElu: EventLoopUtilization = performance.eventLoopUtilization();
  private readonly maxAllowedP99LagMs = 45;
  private readonly maxAllowedEluRatio = 0.85;

  onModuleInit(): void {
    this.histogram = monitorEventLoopDelay({ resolution: 10 });
    this.histogram.enable();
  }

  onModuleDestroy(): void {
    this.histogram?.disable();
  }

  assertLoopCapacityAvailable(): { p99LagMs: number; currentElu: number } {
    const currentEluObj = performance.eventLoopUtilization();
    const deltaElu = performance.eventLoopUtilization(currentEluObj, this.lastElu);
    this.lastElu = currentEluObj;

    const p99LagMs = this.histogram ? Math.round((this.histogram.percentile(99) / 1e6) * 100) / 100 : 0;
    const currentElu = Math.round(deltaElu.utilization * 1000) / 1000;

    // Nếu vòng lặp đã chạm ngưỡng nguy hiểm, lập tức từ chối nhận thêm việc nặng (Fail-Fast < 0.01ms)
    // để bảo toàn 15% năng lực CPU còn lại phục vụ các request đang chạy và trả lời Kubernetes Probe!
    if (p99LagMs > this.maxAllowedP99LagMs || currentElu > this.maxAllowedEluRatio) {
      throw new ServiceUnavailableException('EVENT_LOOP_OVERLOADED_SHEDDING_LOAD');
    }

    return { p99LagMs, currentElu };
  }
}
\`\`\`

### 1.4 Định lượng Chỉ số ELU và Công thức tính Thời gian Đóng băng Tích lũy

Các chỉ số hiệu năng vòng lặp trong \`perf_hooks\` được tính toán theo hệ công thức toán học chính xác sau:

\`\`\`
Tỷ lệ chiếm dụng vòng lặp (ELU) = Active_Time_Ms / (Active_Time_Ms + Idle_Epoll_Wait_Ms)
Độ trễ vòng lặp tức thời (Event_Loop_Lag_Ms) = max(0, Actual_Wakeup_Timestamp_Ms - (Scheduled_Timestamp_Ms + Resolution_Ms))
Thời gian đóng băng tích lũy (Queue_Blocking_Ms) = Concurrent_CPU_Requests × Single_Sync_Task_Duration_Ms
Ví dụ định lượng: Trong chu kỳ 1,000 ms, luồng chính ngủ ở epoll_wait 120 ms và chạy code 880 ms -> ELU = 880 / 1000 = 0.88 (88% -> Vượt ngưỡng 0.85, kích hoạt Load Shedding!)
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc bảo vệ Vòng lặp và Đầu dò Kubernetes):**
> 1. **Tách biệt Liveness Probe và Readiness Probe:** Trên Kubernetes, endpoint **\`Liveness Probe\` (\`/health/live\`)** chỉ được phép trả về \`200 OK\` nhẹ nhàng để kiểm tra tiến trình chưa bị treo cứng với \`timeoutSeconds >= 5\`; tuyệt đối không kiểm tra kết nối Database hay chạy logic nặng trong Liveness Probe. Nếu \`P99 Lag\` hoặc \`ELU\` tăng cao tạm thời, hãy báo cho **\`Readiness Probe\` (\`/health/ready\`)** trả về \`503\` để Kubernetes tạm ngưng bơm thêm traffic mới vào Pod thay vì giết chết Pod!
> 2. **Kết hợp kép \`P99 Lag\` và \`ELU\`:** Luôn giám sát đồng thời cả \`P99 Event Loop Lag\` (phát hiện tác vụ đơn lẻ chặn luồng lâu) lẫn \`Event Loop Utilization\` (phát hiện bão tác vụ nhỏ làm cạn kiệt thời gian nghỉ của CPU).

---

# 2. GIẢI PHẪU KIẾN TRÚC WORKER THREADS (MULTI-ISOLATE) VÀ CƠ CHẾ TRUYỀN BỘ NHỚ KHÔNG SAO CHÉP (ZERO-COPY)

### 2.1 Khái niệm nền tảng: V8 Isolate Độc lập trong Cùng Không gian Địa chỉ Tiến trình

Khi ứng dụng Backend bắt buộc phải thực hiện các phép toán CPU-bound thuần JavaScript/TypeScript hoặc WebAssembly (như xác thực chữ ký số hàng loạt, biến đổi dữ liệu lớn, nén/giải mã tệp tin, chạy mô hình suy luận AI/ML hoặc phân tích cú pháp JSON khổng lồ), việc dùng \`setImmediate\` chunking vẫn tiêu tốn thời gian của luồng chính, còn \`Libuv Threadpool\` thì chỉ dành riêng cho các hàm C++ nội bộ của Node.js (\`fs\`, \`crypto\`, \`zlib\`) chứ **không thể chạy mã JavaScript của người dùng**.

Giải pháp kiến trúc chuẩn mực được giới thiệu từ Node.js 12+ là module **\`node:worker_threads\`**. Để hiểu rõ bản chất của \`Worker Threads\`, kỹ sư cần nắm vững khái niệm **\`V8 Isolate\`**:

1. **Một Tiến trình Hệ điều hành — Nhiều Máy ảo \`V8 Isolate\` Độc lập:**
   Khác với \`child_process.fork()\` hoặc module \`cluster\` (vốn gọi system call \`fork()\` của Linux để nhân bản ra một tiến trình hệ điều hành hoàn toàn mới với bảng phân trang bộ nhớ ảo riêng biệt), một \`new Worker('./worker.js')\` chỉ khởi tạo một **luồng cấp nhân (\`POSIX pthread\`)** nằm ngay bên trong **cùng một tiến trình Node.js hiện tại**.
   - Trên luồng mới này, Node.js khởi tạo một thực thể máy ảo V8 hoàn toàn độc lập gọi là **\`V8 Isolate\`**.
   - Mỗi \`Worker Isolate\` sở hữu riêng cho mình: **(a) Một \`V8 Call Stack\` riêng**, **(b) Một vùng nhớ \`V8 Heap\` riêng (Young Gen + Old Gen + Orinoco GC riêng)**, **(c) Hai hàng đợi \`nextTickQueue\` / \`Promise Microtask Queue\` riêng**, và **(d) Một vòng lặp sự kiện \`Libuv uv_loop_t\` riêng biệt**!
   - Nhờ kiến trúc cô lập này (**Shared-Nothing Isolate Model**), nếu một \`Worker Thread\` chạy vòng lặp \`while(true)\` đốt 100% CPU trên lõi số 2 hoặc kích hoạt \`Stop-The-World Major GC\` mất \`100 ms\`, thì **\`Main Thread\` đang chạy trên lõi số 1 vẫn hoàn toàn miễn nhiễm (Lag = 0ms)** và tiếp tục phục vụ hàng chục nghìn HTTP Request bình thường!
2. **Dùng chung \`Libuv Worker Threadpool\` ở tầng đáy:**
   Một chi tiết kiến trúc cực kỳ quan trọng: mặc dù mỗi \`Worker Thread\` có vòng lặp \`uv_loop_t\` riêng, nhưng toàn bộ các \`Worker Threads\` trong cùng một tiến trình Node.js đều **chia sẻ chung cùng một bể luồng C++ \`Libuv Threadpool\`** (4 luồng mặc định đã học ở Bài 02)!

### 2.2 Đối chiếu 3 Cơ chế Truyền Dữ liệu Giữa Main Thread và Worker Thread

Vì mỗi \`V8 Isolate\` có vùng nhớ \`V8 Heap\` tách biệt để tránh xung đột bộ thu gom rác, một \`Worker Thread\` không thể đọc trực tiếp biến đối tượng JavaScript của \`Main Thread\`. Việc trao đổi dữ liệu qua kênh \`parentPort.postMessage()\` hỗ trợ 3 cơ chế có hiệu năng chênh lệch nhau hàng vạn lần:

| Tiêu chí học thuật | 1. \`Structured Clone\` (Mặc định) | 2. \`TransferList\` (Zero-Copy Ownership Transfer) | 3. \`SharedArrayBuffer\` + \`Atomics\` (Shared RAM) |
| :--- | :--- | :--- | :--- |
| **Cú pháp kích hoạt trong Node.js** | \`worker.postMessage(plainObj)\` | \`worker.postMessage(uint8.buffer, [uint8.buffer])\` | \`worker.postMessage(new SharedArrayBuffer(size))\` |
| **Bản chất hoạt động ở tầng bộ nhớ** | Duyệt đệ quy đối tượng nguồn, tuần tự hóa thành mảng byte rồi cấp phát và dựng lại bản sao mới trên Heap của luồng đích | **Chuyển giao thẳng địa chỉ con trỏ vùng nhớ C++ Backing Store** từ Isolate nguồn sang Isolate đích mà không chép 1 byte dữ liệu nào | Cả hai luồng cùng trỏ vào **đúng một vùng trang nhớ vật lý (\`Physical RAM Pages\`)** và có thể đọc/ghi đồng thời |
| **Độ phức tạp Thời gian & Bộ nhớ** | **Tuyến tính \`O(N)\` theo kích thước dữ liệu**; tiêu tốn **gấp đôi (\`2x\`) dung lượng RAM** trong lúc truyền | **Hằng số \`O(1)\` (\`~0.005 ms\` bất kể dữ liệu lớn \`1 KB\` hay \`1 GB\`)**; không tốn thêm bất kỳ byte RAM nào (\`0% copy\`) | **Khởi tạo và truyền con trỏ \`O(1)\`**; truy xuất đọc/ghi phần tử trực tiếp ở tốc độ thanh ghi CPU |
| **Quyền truy cập ở luồng gửi sau khi gửi** | Luồng gửi vẫn giữ nguyên bản gốc; hai bản sửa đổi độc lập nhau | Vùng nhớ ở luồng gửi lập tức bị **Vô hiệu hóa (\`Detached / byteLength = 0\`)** để đảm bảo tại 1 thời điểm chỉ có 1 chủ sở hữu | Cả luồng chính lẫn tất cả các luồng Worker đều đọc và ghi trực tiếp vào vùng nhớ chung mọi lúc |
| **Rủi ro & Điều kiện bắt buộc** | **Làm nghẽn cả Main Thread lẫn Worker** nếu truyền đối tượng/chuỗi lớn hơn \`5 MB – 10 MB\` | Chỉ áp dụng được cho các đối tượng thuộc diện \`Transferable\` (\`ArrayBuffer\`, \`MessagePort\`, \`FileHandle\`) | Nguy cơ **Xung đột dữ liệu (\`Data Race / Tearing\`)** rất cao; bắt buộc phải đồng bộ hóa bằng đối tượng **\`Atomics\`** |

### 2.3 Phép toán Nguyên tử (\`Atomics\`) trên \`SharedArrayBuffer\` và Hiện tượng Xé dữ liệu (\`Data Race\`)

Tại sao khi hai \`Worker Threads\` cùng thực hiện phép cộng đơn giản \`sharedInt32Array[0]++\` trên một vùng nhớ dùng chung \`SharedArrayBuffer\` sebanyak \`1,000,000\` lần, kết quả cuối cùng lại luôn bị thiếu hụt (ví dụ chỉ ra \`1,420,850\` thay vì \`2,000,000\`)?

1. **Giải phẫu lỗi \`Read-Modify-Write Race Condition\` ở cấp độ Thanh ghi Vi xử lý:**
   Ở tầng mã máy Assembly, câu lệnh \`arr[0]++\` không phải là một thao tác đơn lẻ, mà bị tách thành **3 chu kỳ lệnh CPU rời rạc**:
   - **Lệnh 1 (\`LOAD\`):** Đọc giá trị hiện tại từ địa chỉ RAM vào thanh ghi nội bộ của Lõi CPU #1 (\`MOV EAX, [MEM]\`).
   - **Lệnh 2 (\`ADD\`):** Cộng thêm 1 vào thanh ghi nội bộ (\`INC EAX\`).
   - **Lệnh 3 (\`STORE\`):** Ghi giá trị từ thanh ghi ngược trở lại địa chỉ RAM (\`MOV [MEM], EAX\`).
   Nếu tại cùng một nano-giây, cả Lõi CPU #1 và Lõi CPU #2 cùng thực hiện bước \`LOAD\` (cùng đọc được giá trị \`100\`), cùng cộng lên \`101\`, rồi lần lượt ghi đè \`101\` xuống RAM, thì một phép cộng đã bị bốc hơi hoàn toàn (**Lost Update**)!
2. **Khóa Đường truyền Bus/Cache bằng Tập lệnh Nguyên tử (\`Atomics\`):**
   Để giải quyết triệt để bài toán này mà không cần dùng khóa Mutex cấp hệ điều hành đắt đỏ, đối tượng chuẩn **\`Atomics\`** của JavaScript dịch trực tiếp sang các tập lệnh phần cứng có tiền tố khóa đường truyền của CPU (như **\`LOCK XADD\`** hoặc **\`LOCK CMPXCHG\`** trên kiến trúc x86_64, và \`LDREX/STREX\` trên ARM64):
   - **\`Atomics.add(typedArray, index, value)\`:** Khóa dòng bộ nhớ đệm (**Cache Line Locking**) tại địa chỉ đó để đảm bảo toàn bộ chu trình \`Đọc - Cộng - Ghi\` diễn ra như một khối nguyên tử không thể bị bất kỳ lõi CPU nào khác chen ngang.
   - **\`Atomics.compareExchange(typedArray, index, expectedValue, replacementValue)\`:** Nền tảng của mọi cấu trúc dữ liệu không khóa (**Lock-Free Algorithms / CAS — Compare-And-Swap**): chỉ cập nhật giá trị mới nếu giá trị hiện tại trên RAM vẫn khớp với \`expectedValue\`.
   - **\`Atomics.wait(int32, index, value, timeout)\` & \`Atomics.notify(int32, index, count)\`:** Tương đương với cơ chế \`futex (Fast Userspace Mutex)\` của nhân Linux, cho phép một \`Worker Thread\` tự đưa mình vào trạng thái ngủ đông tiêu thụ \`0% CPU\` chờ đến khi luồng khác gọi \`Atomics.notify\` đánh thức (Lưu ý: Không bao giờ gọi \`Atomics.wait\` trên \`Main Thread\` vì nó sẽ chặn đứng Event Loop!).

\`\`\`
Thời gian truyền bằng Structured Clone (T_clone_ms) = Payload_Size_MB × (T_serialize_per_MB + T_deserialize_per_MB)
Thời gian truyền bằng TransferList Zero-Copy (T_transfer_ms) = Constant_Pointer_Move_Cost ≈ 0.005 ms (Độc lập với Payload_Size_MB)
Ví dụ định lượng (Truyền Buffer ảnh 200 MB sang Worker):
-> Dùng postMessage(buf) mặc định (Structured Clone, ~1.2 ms/MB): Tốn 200 × 1.2 = 240 ms chặn luồng + tốn thêm 200 MB RAM!
-> Dùng postMessage(ab, [ab]) (Zero-Copy TransferList): Tốn 0.005 ms + tốn 0 MB RAM mới (Nhanh hơn 48,000 lần!)
\`\`\`

> **Tổng kết học thuật Phần 2 (Hai quy tắc truyền dữ liệu qua \`Worker Threads\`):**
> 1. **Ưu tiên tuyệt đối \`TransferList\` cho Dữ liệu Lớn:** Khi chuyển các khối dữ liệu nhị phân hoặc chuỗi JSON lớn (đã chuyển thành \`Uint8Array\`) sang \`Worker Thread\`, bắt buộc phải truyền \`[uint8Array.buffer]\` vào tham số thứ hai (**\`transferList\`**) của \`postMessage\` để đạt tốc độ chuyển giao con trỏ **Zero-Copy \`O(1)\`**.
> 2. **Bắt buộc dùng \`Atomics\` trên \`SharedArrayBuffer\`:** Mọi thao tác đọc/ghi cờ trạng thái hoặc bộ đếm dùng chung giữa các luồng trên \`SharedArrayBuffer\` đều phải đi qua \`Atomics.load\`, \`Atomics.store\`, \`Atomics.add\` hoặc \`Atomics.compareExchange\` để ngăn chặn lỗi \`Data Race\` và hiện tượng đảo thứ tự lệnh của CPU (**Memory Reordering**).

---

# 3. THIẾT KẾ BỂ LUỒNG CÔNG NHÂN TÁI SỬ DỤNG (WORKER POOL) TRONG NESTJS & CHẨN ĐOÁN PRODUCTION

### 3.1 Tại sao khởi tạo \`new Worker()\` trên mỗi HTTP Request là Phản mẫu Tự sát (Anti-pattern)?

Khi mới học về \`worker_threads\`, nhiều lập trình viên viết ngay dòng lệnh \`const worker = new Worker('./task.js')\` bên trong phương thức của NestJS Controller hoặc Service mỗi khi có người dùng gọi API. Trên môi trường Production tải cao, thiết kế này sẽ đánh sập máy chủ chỉ sau vài giây vì 3 chi phí vật lý khổng lồ:

1. **Chi phí Khởi động Máy ảo V8 Isolate (\`Isolate Bootstrapping Overhead\`):**
   Mỗi lần gọi \`new Worker()\`, Node.js phải yêu cầu nhân hệ điều hành cấp phát vùng nhớ Stack cho luồng mới, khởi tạo toàn bộ cấu trúc \`V8 Isolate\`, nạp bản chụp bộ nhớ khởi đầu (\`V8 Startup Snapshot\`), tạo vòng lặp \`uv_loop_t\` mới, rồi đọc và biên dịch lại các tệp mã nguồn JavaScript từ đầu. Quá trình này tiêu tốn từ **\`15 ms – 40 ms\` thời gian CPU** và ngốn ngay lập tức **\`20 MB – 45 MB\` bộ nhớ RAM (\`RSS\`)** cho mỗi Worker!
2. **Nổ Bộ nhớ OOM và Bão Chuyển ngữ cảnh khi Bơm tải Đồng thời:**
   Nếu có \`200\` HTTP Request cùng gọi vào API đó trong 1 giây, việc gọi \`new Worker()\` theo từng request sẽ cố gắng sinh ra **\`200 Worker Isolates\`** cùng lúc $\rightarrow$ tiêu tốn \`200 × 30 MB = 6,000 MB (6 GB RAM)\`, làm nổ tung giới hạn bộ nhớ Container (\`OOMKilled - Exit Code 137\`) và đẩy 200 luồng vào tranh chấp trên vài lõi vCPU!
3. **Giải pháp Kiến trúc Chuẩn: Bể Luồng Công nhân Tĩnh có Giới hạn (\`Bounded Reusable Worker Pool\`):**
   Trong NestJS, các \`Worker Threads\` bắt buộc phải được khởi tạo sẵn **một lần duy nhất** lúc ứng dụng khởi động (\`OnModuleInit\`) với số lượng cố định dựa theo số lõi vCPU vật lý:
   - Công thức định cỡ chuẩn: **\`Pool_Size = max(1, Number_Of_Physical_vCPUs - 1)\`** (Chừa lại tối thiểu \`1 vCPU\` dành riêng cho \`V8 Main Thread\` và \`Event Loop\` xử lý I/O mạng!).
   - Khi có yêu cầu tính toán nặng đi vào, \`WorkerPoolService\` chỉ việc đẩy dữ liệu qua \`MessagePort\` tới một Worker đang rảnh rỗi sẵn có (mất \`0 ms\` chi phí khởi tạo!). Nếu toàn bộ Worker trong bể đều đang bận, yêu cầu mới sẽ được xếp vào một **Hàng đợi Có Giới hạn (\`Bounded Task Queue\`)** kèm cơ chế kiểm tra thời hạn chờ (\`Queue Timeout / Backpressure\`).

### 3.2 Đối chiếu Mã nguồn Thực thi và Truy vết Hiệu năng Worker Pool

Hãy đối chiếu hai thiết kế dịch vụ phân tích dữ liệu lớn dưới đây để thấy sự khác biệt giữa phản mẫu tạo Worker theo từng request và kiến trúc Bể luồng Tái sử dụng kết hợp Zero-Copy Transfer:

\`\`\`typescript
// File: src/modules/compute/worker-pool-orchestrator.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Tạo mới Worker trên mỗi HTTP Request và copy dữ liệu bằng Structured Clone
@Injectable()
export class PerRequestWorkerBrokenService {
  async processBufferUnbounded(rawBuffer: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
      // LỖI 1: Tạo mới V8 Isolate trên mỗi request (Tốn 30ms CPU + 35MB RAM mỗi lần gọi!)
      // Nếu 100 người gọi cùng lúc -> Sinh 100 Isolates -> Crash OOM ngay lập tức!
      const worker = new Worker('./dist/workers/checksum.worker.js');

      worker.once('message', (checksum: number) => {
        void worker.terminate();
        resolve(checksum);
      });
      worker.once('error', reject);

      // LỖI 2: Không truyền TransferList -> V8 phải nhân bản toàn bộ mảng byte (Structured Clone)!
      worker.postMessage({ payload: rawBuffer });
    });
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION WORKER POOL): Tái sử dụng cố định N Workers + Zero-Copy ArrayBuffer Transfer
@Injectable()
export class BoundedWorkerPoolSafeService implements OnModuleInit, OnModuleDestroy {
  private readonly poolSize = Math.max(1, os.availableParallelism() - 1);
  private readonly maxQueueSize = 250;
  private readonly idleWorkers: Worker[] = [];
  private readonly taskQueue: Array<{
    buffer: ArrayBuffer;
    resolve: (res: number) => void;
    reject: (err: Error) => void;
  }> = [];

  onModuleInit(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.idleWorkers.push(new Worker('./dist/workers/checksum.worker.js'));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.idleWorkers.map((w) => w.terminate()));
  }

  executeZeroCopyTask(rawBuffer: Uint8Array): Promise<number> {
    if (this.taskQueue.length >= this.maxQueueSize && this.idleWorkers.length === 0) {
      return Promise.reject(new Error('WORKER_POOL_BACKPRESSURE_QUEUE_FULL'));
    }

    return new Promise<number>((resolve, reject) => {
      this.taskQueue.push({ buffer: rawBuffer.buffer as ArrayBuffer, resolve, reject });
      this.dispatchNext();
    });
  }

  private dispatchNext(): void {
    if (this.idleWorkers.length === 0 || this.taskQueue.length === 0) return;

    const worker = this.idleWorkers.pop()!;
    const task = this.taskQueue.shift()!;

    worker.once('message', (checksum: number) => {
      this.idleWorkers.push(worker);
      task.resolve(checksum);
      this.dispatchNext();
    });

    // Chuyển quyền sở hữu ArrayBuffer sang Worker trong O(1) (Zero-Copy TransferList)
    worker.postMessage(task.buffer, [task.buffer]);
  }
}
\`\`\`

Bảng dưới đây truy vết diễn biến tài nguyên hệ thống trên một Kubernetes Pod (\`4 vCPU, 1024 MB RAM\`) khi tiếp nhận đồng thời \`50\` yêu cầu xử lý khối dữ liệu \`20 MB\` (mỗi yêu cầu cần \`30 ms\` tính toán CPU):

| Mốc thời gian | Chỉ số đo đạc trên Pod | Trạng thái ở \`BrokenService\` (\`new Worker\` mỗi request) | Trạng thái ở \`SafeService\` (\`Bounded Pool = 3 Workers\` + Zero-Copy) | Hệ quả Vận hành Thực tế |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | \`50\` yêu cầu (mỗi yêu cầu \`20 MB\`) ập đến cùng lúc | Bắt đầu gọi \`new Worker()\` 50 lần và nhân bản \`50 × 20 MB = 1,000 MB\` qua \`Structured Clone\` | Lấy ngay \`3\` Worker đã khởi tạo sẵn; chuyển con trỏ \`ArrayBuffer\` trong \`0.005 ms\` (\`0 MB\` copy); \`47\` việc xếp hàng | \`Broken\`: Luồng chính bị đơ vì copy \`1 GB\` RAM; \`Safe\`: Luồng chính tốn \`< 0.5 ms\` |
| **\`t = 25 ms\`** | Dung lượng RAM vật lý (\`RSS\`) & Số luồng OS | \`50\` V8 Isolates vừa tạo ngốn thêm \`1,500 MB\` + \`1,000 MB\` bản sao $\rightarrow$ **Tổng \`RSS > 2.5 GB\`** | Số luồng giữ cố định ở **\`3 Workers\`**; không phát sinh bất kỳ byte bản sao nào | **\`BrokenService\` bị Linux OOM Killer bắn chết (\`Exit Code 137\`) ngay tại \`t = 25 ms\`!** |
| **\`t = 30 ms\`** | Tiến độ xử lý trên \`4 vCPU\` | Tiến trình đã sập, toàn bộ 50 khách hàng nhận lỗi \`502 Bad Gateway\` | \`3\` Worker trên Lõi #2, #3, #4 hoàn thành xong 3 yêu cầu đầu tiên và lấy tiếp yêu cầu \`#4, #5, #6\` | Lõi #1 (\`Main Thread\`) vẫn rảnh rỗi 98%, phản hồi các API nhẹ khác trong \`1 ms\` |
| **\`t = 510 ms\`** | Hoàn tất toàn bộ lô 50 yêu cầu | Pod đang kẹt trong trạng thái \`CrashLoopBackOff\` | Hoàn thành trọn vẹn cả 50 yêu cầu (\`17 đợt × 30 ms = 510 ms\`) với \`RSS\` phẳng lặng | Hệ thống sống sót 100% trước đỉnh tải đột biến mà không rớt một kết nối nào |

### 3.3 Bảng Chẩn đoán Toàn diện các Sự cố Nghẽn CPU & Đa luồng trên Production

| Triệu chứng quan sát trên Production | Công cụ Chẩn đoán Chuyên sâu | Chỉ số / Dấu hiệu Nhận diện Kỹ thuật | Nguyên nhân Gốc rễ (\`Root Cause\`) | Giải pháp Kiến trúc Chuẩn Production |
| :--- | :--- | :--- | :--- | :--- |
| **Pod liên tục bị Kubernetes Restart (\`Exit 137\` / \`Unhealthy\`) khi có người xuất báo cáo** | \`monitorEventLoopDelay()\` và \`node --cpu-prof\` (V8 CPU Flamegraph) | Trên biểu đồ Flamegraph xuất hiện một thanh ngang rất rộng (\`Wide Flame Bar\`) kéo dài hàng giây trên Main Thread | Chạy thuật toán tạo Excel/PDF hoặc \`JSON.stringify\` khổng lồ đồng bộ ngay trên \`V8 Call Stack\` | Chuyển tác vụ sang **Bounded Worker Pool** (như thư viện \`Piscina\`) hoặc đẩy vào hàng đợi bất đồng bộ **BullMQ Worker** |
| **Một request gửi chuỗi đầu vào lạ dài vài KB làm treo cứng 100% CPU trong nhiều phút** | Chạy \`node --prof\` hoặc kiểm tra cảnh báo bảo mật \`ReDoS\` | Hàm \`RegExp.prototype.exec\` hoặc \`.test\` chiếm 99.9% thời gian CPU trên đỉnh Call Stack | Biểu thức chính quy có nhóm lặp lồng nhau (ví dụ \`/^([a-zA-Z0-9]+)*$/\`) gây **Catastrophic Backtracking (\`O(2^N)\`)** | Thay thế bằng biểu thức chính quy tuyến tính, giới hạn độ dài chuỗi đầu vào trong \`ValidationPipe\`, hoặc dùng động cơ **\`RE2\`** (\`O(N)\`) |
| **Độ trễ truyền dữ liệu vào Worker Thread còn lâu hơn cả thời gian Worker tính toán** | Đo thời gian quanh lệnh \`worker.postMessage(data)\` | Riêng lệnh \`postMessage\` làm chặn luồng chính mất \`50 ms – 200 ms\` cho mỗi lần gửi | Truyền đối tượng lồng nhau phức tạp hoặc \`Buffer\` lớn khiến V8 phải chạy **\`Structured Clone\`** đắt đỏ | Đóng gói dữ liệu dạng nhị phân phẳng (\`TypedArray / FlatBuffers\`) và truyền qua **\`TransferList\` (\`Zero-Copy\`)** hoặc \`SharedArrayBuffer\` |
| **Kết quả tính toán thống kê trên \`SharedArrayBuffer\` bị sai lệch ngẫu nhiên dưới tải cao** | Kiểm tra mã nguồn thao tác trên \`Int32Array\` / \`Float64Array\` dùng chung | Giá trị tổng cộng luôn nhỏ hơn giá trị lý thuyết khi chạy từ 2 Worker trở lên | Dùng các toán tử số học thông thường (\`+=\`, \`++\`, \`=\`) gây lỗi **\`Read-Modify-Write Data Race\`** giữa các lõi CPU | Thay thế toàn bộ bằng các phương thức nguyên tử của **\`Atomics\`** (\`Atomics.add\`, \`Atomics.sub\`, \`Atomics.compareExchange\`) |
| **Sử dụng \`Worker Threads\` nhưng tổng thông lượng không tăng mà CPU System % lại vọt cao** | Kiểm tra cấu hình \`limits.cpu\` của Pod và kích thước \`Worker Pool\` | Khởi tạo Pool gồm \`16\` hoặc \`32\` Worker trên một Container chỉ được cấp giới hạn \`1000m\` (\`1 vCPU\`) | 32 luồng V8 Isolate bị ép chia sẻ hạn ngạch thời gian (\`CFS Quota Throttling\`) trên 1 vCPU duy nhất | Luôn lấy số lõi thực tế qua **\`os.availableParallelism()\`** (hàm này trên Node 19.4+ tự động đọc đúng giới hạn \`cgroups\` của Container!) |

> **Tổng kết học thuật Phần 3 (Quy tắc lấy số lõi CPU trong Container với \`os.availableParallelism()\`):**
> Khi định cỡ \`Worker Pool\` trên Kubernetes Container, **tuyệt đối không dùng \`os.cpus().length\`** ở các phiên bản cũ vì hàm đó trả về tổng số lõi của **máy chủ vật lý bên dưới (Host Node — ví dụ 64 cores)** ngay cả khi Pod của bạn chỉ được cấp giới hạn \`2 vCPU\`! Hãy luôn sử dụng hàm **\`os.availableParallelism()\`** (tích hợp sẵn từ Node.js 19.4+) để đọc chính xác hạn ngạch CPU thực tế được \`Linux cgroups v2\` cấp cho Container.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Giám Sát Vòng Lặp & Đa Luồng Cô Lập (Telemetry & Multi-Isolate Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG GIÁM SÁT SỨC KHỎE & BẢO VỆ LUỒNG CHÍNH (MAIN THREAD GUARD LAYER)      │
│    [ HDR Histogram Lag (P99 < 20ms) ] ◄───► [ ELU Monitor (< 0.85) ] ◄───► [ Load Shedder (HTTP 503) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Chuyển giao việc nặng qua Bounded Worker Pool Queue
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG KÊNH TRUYỀN BỘ NHỚ LIÊN LUỒNG (INTER-ISOLATE MEMORY TRANSFER LAYER)   │
│    ├── Structured Clone: Nhân bản sâu đối tượng nhỏ (<100KB), tốn O(N) CPU    │
│    ├── TransferList (Zero-Copy): Chuyển quyền sở hữu ArrayBuffer trong O(1)   │
│    └── SharedArrayBuffer + Atomics: Chia sẻ RAM vật lý với khóa nguyên tử CPU │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Thực thi song song trên các lõi vCPU riêng biệt
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG MÁY ẢO WORKER ISOLATES SONG SONG (PARALLEL V8 WORKER ISOLATES LAYER)  │
│    ├── Worker Isolate #1..#N: Call Stack, V8 Heap và Event Loop độc lập 100%  │
│    ├── Định cỡ chuẩn Container: Pool_Size = max(1, availableParallelism() - 1)│
│    └── Vòng đời cố định: Khởi tạo 1 lần ở OnModuleInit, tái sử dụng liên tục  │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Tác Vụ Tính Toán Nặng (Main Thread Blocking vs Bounded Worker Pool Offloading)
\`\`\`diagram
MÔ HÌNH CŨ: CHẠY TÁC VỤ CPU-BOUND TRÊN MAIN THREAD HOẶC TẠO WORKER THEO REQUEST
Nhận 50 việc nặng ──► [ Chặn Call Stack 3.5 giây ] ──► [ Đóng băng Pha Poll ] ──► K8S KILL POD (CRASHLOOP)
5,000 HTTP Requests = Bị treo Timeout 504, kích hoạt Bão Retry đánh sập toàn bộ cụm máy chủ.

MÔ HÌNH HIỆN ĐẠI: CẮT TẢI THÔNG MINH & BỂ LUỒNG TÁI SỬ DỤNG ZERO-COPY (BOUNDED WORKER POOL)
Request nặng 1 ──┐
Request nặng 2 ──┼──► [ Kiểm tra ELU/Lag & Chuyển Zero-Copy sang Worker Pool ] ──► Tính trên vCPU phụ
Request nặng 3 ──┘                              │
                                                └──► Main Thread rảnh 99% ────► Phục vụ HTTP & Probe < 2ms
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Xử Lý Tác Vụ CPU-Bound & Truyền Dữ Liệu Đa Luồng)
\`\`\`diagram
                   CẦN XỬ LÝ MỘT TÁC VỤ TÍNH TOÁN CPU-BOUND TRONG BACKEND NESTJS?
                                                   │
                                                   ▼
                          Thời gian chiếm dụng CPU của tác vụ trên 1 lần gọi là bao nhiêu?
                          /                                                        \\
        RẤT NGẮN (< 5 MS) NHƯNG LẶP NHIỀU PHẦN TỬ                 TRUNG BÌNH ĐẾN NẶNG (>= 10 MS TRÊN CPU)
                      /                                                                        \\
                     ▼                                                                          ▼
    [ PHÂN MẢNH HỢP TÁC SETIMMEDIATE (CHUẨN) ]                   Đẩy sang Bounded Worker Thread Pool bằng cơ chế truyền nào?
    - Chia lô theo ngân sách thời gian <= 2ms                    /                                                       \\
    - Chạy ngay trên Main Thread, không tốn phí IPC    DỮ LIỆU ĐỘC LẬP (JSON / BUFFER LỚN)                CẦN ĐỌC/GHI ĐỒNG THỜI NHIỀU LUỒNG
    - Nhường luồng đều đặn cho Pha Poll đọc HTTP                /                                                         \\
                                                               ▼                                                           ▼
                                              [ DÙNG TRANSFERLIST ZERO-COPY (TỐI ƯU) ]                   [ DÙNG SHAREDARRAYBUFFER + ATOMICS (CHUẨN) ]
                                              - Truyền [arrayBuffer] chuyển quyền sở hữu O(1)            - Chia sẻ trực tiếp trang nhớ RAM vật lý
                                              - Tuyệt đối không tạo new Worker() mỗi request!            - Bắt buộc dùng Atomics để chống Data Race
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Kiến Trúc Thực Thi Song Song Trong Node.js)

| Tiêu Chí So Sánh | Main Thread Chunking (\`setImmediate\`) | \`Libuv Threadpool\` (\`fs\`, \`crypto\`, \`zlib\`) | \`Worker Threads Pool\` (\`worker_threads\`) | \`Child Process / Cluster\` (\`fork\`) |
| :--- | :--- | :--- | :--- | :--- |
| **Khả năng chạy mã JS/TS tùy chỉnh** | **Có** (Chạy xen kẽ trên cùng 1 lõi CPU của luồng chính) | **Không thể**: Chỉ chạy được các hàm C++ đóng sẵn của Node.js | **Có (100%)**: Chạy mọi thuật toán JS/TS/WASM song song trên nhiều lõi CPU | **Có (100%)**: Chạy trên một tiến trình hệ điều hành độc lập hoàn toàn |
| **Chi phí Khởi tạo & Bộ nhớ RAM** | \`0 ms\`, \`0 MB\` RAM phụ thêm | Rất thấp (\`~2 MB\` Stack cho mỗi luồng C++) | Trung bình (\`~15 – 30 ms\` khởi tạo, \`~25 – 40 MB\` Heap cho mỗi Worker Isolate) | Rất cao (\`~50 – 150 ms\` khởi tạo, nhân bản toàn bộ tiến trình \`> 60 MB\` RAM) |
| **Cơ chế Giao tiếp & Chia sẻ Bộ nhớ** | Truy cập trực tiếp biến cục bộ trong cùng V8 Heap | Qua con trỏ C++ nội bộ và báo thức \`eventfd\` | **Hỗ trợ Zero-Copy \`TransferList\` và \`SharedArrayBuffer\` tốc độ cao** | Chỉ giao tiếp qua đường ống OS IPC Pipe (bắt buộc phải Serialize/Deserialize) |
| **Kịch bản Ứng dụng Chuẩn mực** | Duyệt mảng vừa phải (\`5 ms – 20 ms\` tổng cộng), biến đổi DTO | Đọc ghi tệp tin đĩa, phân giải \`dns.lookup\`, băm \`pbkdf2\`, nén \`gzip\` | Phân tích dữ liệu lớn, tạo báo cáo Excel/PDF, xử lý ảnh, thuật toán nặng CPU | Chạy tệp thực thi nhị phân ngoài (FFmpeg, Python CLI) hoặc nhân bản toàn bộ HTTP Server |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`AdaptiveWorkerPoolGuardService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Giám sát Kép \`P99 Lag\` và \`ELU\` (\`Dual Lag-ELU Telemetry Invariant\`):** Một dịch vụ Node.js chỉ thực sự khỏe mạnh khi đồng thời thỏa mãn **\`P99 Event Loop Lag < 20 ms\`** và **\`Event Loop Utilization (ELU) < 0.85\`**. Khi một trong hai chỉ số vượt ngưỡng nguy kịch, tầng cổng vào phải kích hoạt cơ chế **Cắt tải Chủ động (\`Adaptive Load Shedding — HTTP 503\`)** ngay lập tức để ngăn chặn hiệu ứng **Bão Thử lại (\`Retry Storm\`)** và bảo vệ sinh mạng của Pod trước **\`Kubernetes Liveness Probe\`**.
2. **Định đề Cô lập Máy ảo \`V8 Isolate\` (\`Shared-Nothing Isolate Invariant\`):** Mỗi \`Worker Thread\` là một thực thể \`V8 Isolate\` độc lập với \`Call Stack\`, \`V8 Heap\`, \`Garbage Collector\` và vòng lặp \`uv_loop_t\` riêng biệt nằm trong cùng một tiến trình hệ điều hành. Do chi phí khởi tạo một Isolate rất đắt đỏ (\`~20 – 40 MB\` RAM và hàng chục mili-giây CPU), nghiêm cấm khởi tạo \`new Worker()\` theo từng request mà bắt buộc phải dùng **Bể Luồng Tái sử dụng (\`Bounded Worker Pool\`)** có kích thước \`max(1, availableParallelism() - 1)\`.
3. **Định đề Chuyển giao Không sao chép (\`Zero-Copy Ownership Transfer Invariant\`):** Khi truyền các khối dữ liệu lớn (\`> 100 KB\`) qua \`postMessage\`, thuật toán mặc định \`Structured Clone\` sẽ nhân bản toàn bộ dữ liệu với độ phức tạp \`O(N)\` làm nghẽn cả luồng gửi lẫn luồng nhận. Kỹ sư bắt buộc phải đóng gói dữ liệu trong \`ArrayBuffer / TypedArray\` và truyền qua danh sách **\`transferList\`** để di chuyển con trỏ vùng nhớ với chi phí **\`O(1)\` (\`0% Memory Copy\`)**.
4. **Định đề Đồng bộ hóa Nguyên tử trên Bộ nhớ Chung (\`Shared Memory Atomic Synchronization Invariant\`):** Khi nhiều luồng cùng truy cập ghi vào một vùng nhớ vật lý \`SharedArrayBuffer\`, các phép toán gán hoặc cộng trừ thông thường của JavaScript sẽ bị xé lẻ ở cấp độ thanh ghi CPU gây lỗi mất dữ liệu (\`Data Race\`). Mọi thao tác đọc-sửa-ghi trên bộ nhớ chia sẻ đều bắt buộc phải thực hiện thông qua các tập lệnh nguyên tử phần cứng của đối tượng **\`Atomics\`**.
  `,
  realCodeSnippet: `// File: src/infrastructure/compute/adaptive-worker-pool-guard.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Hệ Thống Điều Phối Worker Pool Kết Hợp Cắt Tải Chủ Động Theo P99 Lag & ELU
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  IntervalHistogram,
  EventLoopUtilization,
  monitorEventLoopDelay,
  performance,
} from 'node:perf_hooks';
import * as os from 'node:os';

export interface LoopProtectionDecision {
  readonly allowed: boolean;
  readonly reason: 'HEALTHY' | 'SHED_LOAD_HIGH_P99_LAG' | 'SHED_LOAD_HIGH_ELU' | 'SHED_LOAD_QUEUE_FULL';
  readonly p99LagMs: number;
  readonly eluRatio: number;
  readonly recommendedWorkerPoolSize: number;
  readonly activeWorkers: number;
  readonly queuedTasks: number;
}

/**
 * Dịch vụ Bảo vệ Vòng lặp & Điều phối Hạn ngạch Worker Pool (ADR-0034):
 * 1. Giám sát liên tục P99 Event Loop Delay (nano-giây -> ms) và Event Loop Utilization (ELU).
 * 2. Định cỡ số lượng Worker tối ưu theo giới hạn cgroups của Container qua os.availableParallelism().
 * 3. Kích hoạt Adaptive Load Shedding (Fail-Fast) trước khi Pod bị Kubernetes Liveness Probe tiêu diệt.
 */
@Injectable()
export class AdaptiveWorkerPoolGuardService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdaptiveWorkerPoolGuardService.name);
  private readonly recommendedWorkerPoolSize: number;
  private readonly maxQueueCapacity = 200;
  private readonly maxAllowedP99LagMs = 50.0;
  private readonly maxAllowedEluRatio = 0.85;

  private histogram: IntervalHistogram | null = null;
  private lastEluSnapshot: EventLoopUtilization = performance.eventLoopUtilization();
  private activeWorkers = 0;
  private queuedTasks = 0;

  constructor() {
    const containerCores = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    // Luôn chừa lại tối thiểu 1 vCPU dành riêng cho V8 Main Thread và Pha Poll I/O
    this.recommendedWorkerPoolSize = Math.max(1, containerCores - 1);
  }

  public onModuleInit(): void {
    this.histogram = monitorEventLoopDelay({ resolution: 10 });
    this.histogram.enable();
    this.lastEluSnapshot = performance.eventLoopUtilization();
    this.logger.log(
      \`Khởi tạo AdaptiveWorkerPoolGuardService: RecommendedWorkers=\${this.recommendedWorkerPoolSize}, MaxP99Lag=\${this.maxAllowedP99LagMs}ms\`,
    );
  }

  public onModuleDestroy(): void {
    if (this.histogram) {
      this.histogram.disable();
      this.histogram = null;
    }
  }

  public evaluateAdmissionControl(): LoopProtectionDecision {
    const currentElu = performance.eventLoopUtilization();
    const deltaElu = performance.eventLoopUtilization(currentElu, this.lastEluSnapshot);
    this.lastEluSnapshot = currentElu;

    const rawP99Ms = this.histogram ? this.histogram.percentile(99) / 1e6 : 0;
    const p99LagMs = Math.round(rawP99Ms * 100) / 100;
    const eluRatio = Math.round(deltaElu.utilization * 1000) / 1000;

    if (this.histogram) {
      this.histogram.reset();
    }

    if (p99LagMs > this.maxAllowedP99LagMs) {
      return this.buildDecision(false, 'SHED_LOAD_HIGH_P99_LAG', p99LagMs, eluRatio);
    }
    if (eluRatio > this.maxAllowedEluRatio) {
      return this.buildDecision(false, 'SHED_LOAD_HIGH_ELU', p99LagMs, eluRatio);
    }
    if (this.activeWorkers >= this.recommendedWorkerPoolSize && this.queuedTasks >= this.maxQueueCapacity) {
      return this.buildDecision(false, 'SHED_LOAD_QUEUE_FULL', p99LagMs, eluRatio);
    }

    return this.buildDecision(true, 'HEALTHY', p99LagMs, eluRatio);
  }

  private buildDecision(
    allowed: boolean,
    reason: LoopProtectionDecision['reason'],
    p99LagMs: number,
    eluRatio: number,
  ): LoopProtectionDecision {
    return {
      allowed,
      reason,
      p99LagMs,
      eluRatio,
      recommendedWorkerPoolSize: this.recommendedWorkerPoolSize,
      activeWorkers: this.activeWorkers,
      queuedTasks: this.queuedTasks,
    };
  }
}`,
  quiz: [
    {
      id: 'c2-l3-q1',
      question: 'Khi một tác vụ CPU-bound (như JSON.parse chuỗi 100MB) chiếm giữ luồng chính trong 4 giây, tại sao Pod Node.js trên Kubernetes thường rơi vào vòng lặp khởi động lại CrashLoopBackOff?',
      options: [
        'Vì nhân hệ điều hành Linux phát hiện mức sử dụng của một lõi CPU đạt 100% liên tục quá 3 giây nên tự động bắn tín hiệu SIGKILL để bảo vệ an toàn nhiệt độ cho vi xử lý máy chủ.',
        'Vì luồng chính bị đóng băng không thể vào pha Poll để phản hồi yêu cầu HTTP GET /healthz của Liveness Probe đúng hạn; kubelet coi Pod đã treo và tiến hành giết rồi khởi động lại.',
        'Vì hàm JSON.parse tự động chiếm giữ toàn bộ 4 luồng C++ trong Libuv Threadpool khiến phân vùng bộ nhớ ảo Swap của hệ điều hành bị tràn và ném ra ngoại lệ Out-Of-Memory.',
        'Vì mạng ảo CNI của Kubernetes tự động cắt đứt vĩnh viễn địa chỉ IP của bất kỳ Pod nào không gửi gói tin nhịp tim UDP ra ngoài cụm máy chủ trong khoảng thời gian 2000ms.'
      ],
      correctIndex: 1,
      explanation: 'Dịch vụ kubelet của Kubernetes định kỳ gửi HTTP request đến endpoint Liveness Probe để kiểm tra xem ứng dụng còn phản hồi hay không. Vì yêu cầu kiểm tra sức khỏe này cũng phải đi qua cùng một pha Poll của Libuv và cùng một luồng chính V8 đang bị chặn cứng bởi JSON.parse, nó sẽ bị timeout; kubelet kết luận Pod đã chết và tiêu diệt container, dẫn tới tình trạng CrashLoopBackOff.'
    },
    {
      id: 'c2-l3-q2',
      question: 'Khi cần chuyển giao một khối dữ liệu nhị phân lớn (200MB) từ Main Thread sang Worker Thread để xử lý, kỹ thuật nào giúp đạt tốc độ O(1) và tiêu tốn 0 byte bộ nhớ sao chép (Zero-Copy)?',
      options: [
        'Chuyển đổi toàn bộ khối dữ liệu nhị phân thành chuỗi văn bản Base64 bằng hàm Buffer.toString("base64") rồi gửi qua phương thức worker.postMessage() theo cơ chế tiêu chuẩn.',
        'Gắn khối dữ liệu vào một thuộc tính của đối tượng toàn cục globalThis trên Main Thread để các luồng Worker Thread đọc trực tiếp từ không gian biến toàn cục của tiến trình.',
        'Ghi toàn bộ 200MB dữ liệu ra tệp tin tạm trong thư mục bộ nhớ /dev/shm rồi gửi đường dẫn tuyệt đối của tệp sang cho Worker Thread gọi hàm đồng bộ fs.readFileSync.',
        'Đưa đối tượng ArrayBuffer vào mảng tham số thứ hai (transferList) của worker.postMessage(arrayBuffer, [arrayBuffer]) để chuyển quyền sở hữu con trỏ hoặc dùng SharedArrayBuffer.'
      ],
      correctIndex: 3,
      explanation: 'Theo mặc định, postMessage sử dụng thuật toán Structured Clone để nhân bản sâu toàn bộ dữ liệu (tốn thêm 200MB RAM và hàng trăm ms CPU). Khi truyền ArrayBuffer vào danh sách transferList (tham số thứ hai của postMessage), V8 chỉ di chuyển con trỏ vùng nhớ C++ Backing Store sang cho Worker Isolate trong thời gian O(1) (~0.005ms) mà không cần sao chép bất kỳ byte dữ liệu nào.'
    },
    {
      id: 'c2-l3-q3',
      question: 'Tại sao việc gọi câu lệnh new Worker("./worker.js") trực tiếp bên trong hàm xử lý của mỗi HTTP Request trong NestJS lại là một phản mẫu kiến trúc (Anti-pattern) cực kỳ nguy hiểm?',
      options: [
        'Vì nhân hệ điều hành Linux giới hạn cứng mỗi tiến trình ứng dụng chỉ được phép khởi tạo tối đa 4 luồng POSIX pthread trong suốt toàn bộ thời gian vận hành của container.',
        'Vì mỗi lệnh new Worker() phải khởi tạo một máy ảo V8 Isolate mới (tốn ~20-40MB RAM và 15-30ms CPU); khi có hàng trăm request đồng thời sẽ làm nổ OOM và gây bão chuyển ngữ cảnh.',
        'Vì các luồng Worker Thread mới được tạo sẽ tự động xóa sạch toàn bộ các bộ hẹn giờ đang nằm trong cấu trúc cây nhị phân Min-Heap của vòng lặp sự kiện trên luồng chính.',
        'Vì bộ khung NestJS Dependency Injection Container hoàn toàn không cho phép sử dụng từ khóa new bên trong các phương thức bất đồng bộ của lớp @Injectable() Service.'
      ],
      correctIndex: 1,
      explanation: 'Mỗi Worker Thread trong Node.js chứa một V8 Isolate độc lập hoàn chỉnh với V8 Heap, Call Stack, bộ thu gom rác Orinoco và vòng lặp Libuv riêng. Chi phí khởi tạo một Isolate rất đắt đỏ cả về CPU (15-30ms) lẫn RAM (20-40MB). Do đó, trong môi trường Production bắt buộc phải khởi tạo sẵn một Bể luồng Tái sử dụng (Bounded Worker Pool) khi khởi động ứng dụng.'
    },
    {
      id: 'c2-l3-q4',
      question: 'Chỉ số Event Loop Utilization (ELU) từ hàm performance.eventLoopUtilization() mang lại ưu điểm vượt trội nào so với việc chỉ theo dõi chỉ số % CPU của hệ điều hành?',
      options: [
        'ELU đo chính xác tỷ lệ thời gian luồng chính V8 thức xử lý công việc so với thời gian nghỉ trong epoll_wait(), không bị làm nhiễu bởi các luồng phụ của GC hay Threadpool trên máy đa nhân.',
        'ELU tự động tính toán tổng dung lượng băng thông mạng đang truyền qua card mạng vật lý (NIC) và dự báo chính xác trước thời điểm ổ cứng lưu trữ SSD NVMe bị lấp đầy.',
        'ELU có khả năng tự động hủy bỏ các câu lệnh truy vấn SQL chạy chậm trên máy chủ cơ sở dữ liệu PostgreSQL từ xa mỗi khi phát hiện độ trễ phản hồi vượt quá ngưỡng 100ms.',
        'ELU cho biết chính xác số lượng đối tượng đang bị rò rỉ bên trong phân vùng Old Generation của bộ nhớ V8 Heap mà kỹ sư không cần phải thực hiện chụp Heap Snapshot.'
      ],
      correctIndex: 0,
      explanation: 'Trên một máy chủ nhiều lõi (ví dụ 8 vCPU), nếu luồng chính V8 bị bão hòa 100% ở 1 lõi thì chỉ số tổng CPU của toàn hệ thống chỉ hiển thị 12.5%, gây cảm giác an toàn giả tạo. Hơn nữa, CPU % còn bị pha trộn bởi các luồng của Garbage Collector và Libuv Threadpool. Ngược lại, ELU đo trực tiếp tỷ lệ active / (active + idle_in_epoll_wait) của riêng vòng lặp sự kiện chính.'
    },
    {
      id: 'c2-l3-q5',
      question: 'Sự khác biệt cốt lõi về kiến trúc tài nguyên và cơ chế giao tiếp giữa module worker_threads và child_process.fork() trong Node.js là gì?',
      options: [
        'worker_threads tạo các V8 Isolate trên các luồng trong cùng một tiến trình OS và chia sẻ được RAM qua SharedArrayBuffer, còn child_process.fork() tạo tiến trình OS mới với địa chỉ cô lập.',
        'child_process.fork() dùng chung khung ngăn xếp V8 Call Stack với tiến trình cha, trong khi các luồng của worker_threads bắt buộc phải giao tiếp qua card mạng vật lý bên ngoài.',
        'worker_threads chỉ có thể thực thi các tệp nhị phân C++ đã biên dịch sẵn từ trước, còn child_process.fork() mới có khả năng thông dịch mã nguồn JavaScript và TypeScript.',
        'child_process.fork() có thời gian khởi tạo nhanh gấp 50 lần và tiêu tốn ít bộ nhớ RAM hơn hẳn worker_threads vì không cần phải khởi tạo vòng lặp sự kiện Libuv riêng.'
      ],
      correctIndex: 0,
      explanation: 'child_process.fork() tạo ra một tiến trình hệ điều hành (OS Process) hoàn toàn mới với bảng phân trang bộ nhớ ảo tách biệt, nên tốn nhiều RAM và chỉ có thể giao tiếp qua đường ống IPC kèm tuần tự hóa dữ liệu. Ngược lại, worker_threads tạo các luồng bên trong cùng một tiến trình OS; mỗi luồng có V8 Isolate riêng nhưng nằm chung không gian địa chỉ ảo nên có thể chuyển con trỏ Zero-Copy hoặc chia sẻ RAM qua SharedArrayBuffer.'
    },
    {
      id: 'c2-l3-q6',
      question: 'Tại sao khi nhiều Worker Threads cùng đọc và tăng giá trị của một bộ đếm nằm trên vùng nhớ dùng chung SharedArrayBuffer, lập trình viên bắt buộc phải sử dụng các phương thức của đối tượng Atomics (như Atomics.add)?',
      options: [
        'Vì vùng nhớ SharedArrayBuffer luôn được lưu trữ nén dưới định dạng chuỗi văn bản JSON nên các toán tử số học thông thường của JavaScript không thể phân tích cú pháp được.',
        'Vì phép cộng thông thường (arr[0]++) bị tách thành 3 chu kỳ lệnh CPU rời rạc (Đọc - Cộng - Ghi) gây lỗi mất dữ liệu (Data Race) khi hai lõi CPU cùng chạy; Atomics khóa dòng cache để đảm bảo tính nguyên tử.',
        'Vì nếu không sử dụng đối tượng Atomics, bộ thu gom rác Orinoco sẽ tự động thu hồi và xóa trắng vùng nhớ SharedArrayBuffer ngay sau khi hàm callback hiện tại kết thúc.',
        'Vì đối tượng Atomics tự động chuyển đổi toàn bộ các phép toán số nguyên sang chạy trên bộ vi xử lý đồ họa rời GPU để tăng tốc độ tính toán ma trận gấp hàng nghìn lần.'
      ],
      correctIndex: 1,
      explanation: 'Ở cấp độ phần cứng vi xử lý, toán tử ++ hay += thực chất gồm 3 bước: tải dữ liệu từ RAM lên thanh ghi của lõi CPU (LOAD), tính toán trên thanh ghi (ADD), và ghi ngược xuống RAM (STORE). Khi hai luồng trên hai lõi CPU cùng chạy đồng thời trên SharedArrayBuffer, chúng sẽ ghi đè kết quả của nhau (Race Condition). Đối tượng Atomics phát ra các tập lệnh phần cứng có khóa nguyên tử (như LOCK XADD / CMPXCHG) giúp gộp cả chu trình thành một thao tác không thể chia cắt.'
    },
    {
      id: 'c2-l3-q7',
      question: 'Khi định cỡ số lượng luồng cho Worker Pool của một ứng dụng NestJS chạy bên trong Kubernetes Container có giới hạn CPU (cgroups CPU limits), tại sao nên dùng os.availableParallelism() thay vì os.cpus().length?',
      options: [
        'Vì phương thức os.cpus().length là một hàm hệ thống chạy đồng bộ chặn luồng trên Libuv Threadpool có nguy cơ cao gây khóa chết luồng chính khi khởi động ứng dụng.',
        'Vì trên nhiều môi trường, os.cpus().length trả về tổng số lõi của máy chủ vật lý (ví dụ 64 cores) thay vì hạn ngạch cgroups cấp cho Container (2 vCPU), gây tạo thừa Worker và CPU Thrashing.',
        'Vì hàm os.availableParallelism() tự động nhân đôi dung lượng bộ nhớ V8 Heap tối đa được phép sử dụng cho từng thực thể máy ảo Worker Isolate bên trong bể luồng.',
        'Vì hàm os.cpus().length chỉ đếm được các lõi tiết kiệm điện năng, hoàn toàn không nhận diện được các lõi hiệu năng cao trên kiến trúc vi xử lý đa nhân hiện đại.'
      ],
      correctIndex: 1,
      explanation: 'Khi chạy một Pod chỉ được cấp giới hạn 2 vCPU trên một máy chủ vật lý (Host Node) có 64 lõi, việc dùng os.cpus().length có thể trả về 64 khiến ứng dụng khởi tạo tới 63 Worker Threads. Cả 63 Worker này khi chạy sẽ bị bộ lập lịch CFS của Linux bóp nghẹt (CPU Throttling) trên 2 vCPU, gây bão chuyển ngữ cảnh. Hàm os.availableParallelism() đọc chính xác giới hạn cgroups của Container để trả về con số thực tế (2).'
    },
    {
      id: 'c2-l3-q8',
      question: 'Hiện tượng "Bão Thử lại" (Retry Storm / Thundering Herd) làm sụp đổ hoàn toàn dịch vụ NestJS sau một đợt Event Loop Lag kéo dài diễn ra theo cơ chế nào?',
      options: [
        'Khi Libuv Threadpool bị đầy, trình điều khiển card mạng tự động nhân bản mọi gói tin TCP SYN đang có trong bộ đệm lên gấp 100 lần và phát tán ra toàn bộ mạng nội bộ.',
        'Khi luồng chính bị chặn làm các yêu cầu vượt quá Timeout của Client/Gateway, phía gọi tự động gửi lặp lại các yêu cầu mới trong khi máy chủ vẫn phải gồng mình xử lý cả các Zombie Requests cũ.',
        'Khi bộ thu gom rác của V8 phát hiện độ trễ vòng lặp cao, nó tự động gọi lại toàn bộ các hàm Controller từ đầu để kiểm tra tính toàn vẹn của dữ liệu trong bộ nhớ.',
        'Khi cơ sở dữ liệu thấy tiến trình Node.js phản hồi chậm sẽ tự động mở thêm hàng nghìn kết nối ngược về cổng HTTP của NestJS để đẩy hết dữ liệu tồn đọng trong bảng.'
      ],
      correctIndex: 1,
      explanation: 'Khi một tác vụ CPU-bound làm nghẽn Event Loop vượt quá ngưỡng timeout của Client hoặc API Gateway, phía gọi sẽ ngắt kết nối và tự động bắn thêm các request retry mới. Tuy nhiên, các request cũ vẫn nằm trong hàng đợi của Node.js và tiếp tục tiêu tốn CPU khi tới lượt (Zombie Requests), cộng dồn với làn sóng request retry mới đổ vào tạo thành hiệu ứng tuyết lở (Retry Storm) đánh sập hoàn toàn máy chủ.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Event Loop Utilization (ELU), P99 Lag & Quyết Định Cắt Tải (ELU & Lag Load Shedder)',
    description: 'Áp dụng công thức định lượng sức khỏe vòng lặp ở Phần 1 và `AdaptiveWorkerPoolGuardService`. Viết hàm `evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores)` nhận vào:\n- `activeTimeMs`: Thời gian luồng chính thức làm việc (ms).\n- `idleTimeMs`: Thời gian luồng chính nằm ngủ chờ trong `epoll_wait` (ms).\n- `p99LagNano`: Chỉ số phân vị P99 đọc từ `histogram.percentile(99)` tính bằng **nano-giây (`ns`)**.\n- `maxAllowedLagMs`: Ngưỡng độ trễ P99 tối đa cho phép (ms, ví dụ `50`).\n- `maxAllowedEluRatio`: Ngưỡng tỷ lệ chiếm dụng vòng lặp tối đa (từ `0` đến `1`, ví dụ `0.85`).\n- `containerCores`: Số lõi vCPU khả dụng của Container đọc từ `os.availableParallelism()`.\n\nYêu cầu tính toán:\n1. Chuyển đổi độ trễ P99 từ nano-giây sang mili-giây: `p99LagMs = p99LagNano / 1e6` (làm tròn 2 chữ số thập phân).\n2. Tính tỷ lệ chiếm dụng vòng lặp `eluRatio = (activeTimeMs + idleTimeMs) === 0 ? 0 : activeTimeMs / (activeTimeMs + idleTimeMs)` (làm tròn **3 chữ số thập phân** bằng `Math.round(x * 1000) / 1000`).\n3. Tính kích thước Worker Pool khuyến nghị (chừa 1 lõi cho Main Thread): `recommendedWorkers = Math.max(1, containerCores - 1)`.\n4. Đánh giá quyết định tiếp nhận `decision`:\n   - Nếu `p99LagMs > maxAllowedLagMs`: `decision = "SHED_LOAD_LAG_EXCEEDED"`.\n   - Ngược lại, nếu `eluRatio > maxAllowedEluRatio`: `decision = "SHED_LOAD_ELU_EXCEEDED"`.\n   - Ngược lại: `decision = "ACCEPT_TRAFFIC"`.\nTrả về `{ p99LagMs, eluRatio, recommendedWorkers, decision }`.',
    guidedSteps: [
      'Bước 1 (Đổi đơn vị P99 Lag sang ms): Tính `p99LagMs = Math.round((p99LagNano / 1000000) * 100) / 100`.',
      'Bước 2 (Tính chỉ số ELU làm tròn 3 chữ số thập phân): Tính `total = activeTimeMs + idleTimeMs`, nếu `total === 0` thì `eluRatio = 0`, ngược lại `Math.round((activeTimeMs / total) * 1000) / 1000`.',
      'Bước 3 (Tính số lượng Worker khuyến nghị): Tính `recommendedWorkers = Math.max(1, containerCores - 1)`.',
      'Bước 4 (Kiểm tra ngưỡng cắt tải và trả về): Kiểm tra `p99LagMs > maxAllowedLagMs` trước, sau đó đến `eluRatio > maxAllowedEluRatio`, rồi trả về `{ p99LagMs, eluRatio, recommendedWorkers, decision }`.'
    ],
    hints: [
      'Lưu ý `histogram.percentile(99)` của module `perf_hooks` luôn trả về đơn vị nano-giây (`1 ms = 1,000,000 ns = 1e6 ns`).',
      'Chú ý `eluRatio` được yêu cầu làm tròn đến **3 chữ số thập phân** (`Math.round(val * 1000) / 1000`), còn `p99LagMs` làm tròn đến **2 chữ số thập phân**.'
    ],
    starterCode: `function evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores) {
  // Bước 1: Đổi p99LagNano sang p99LagMs (chia cho 1e6, làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính eluRatio = activeTimeMs / (activeTimeMs + idleTimeMs) (làm tròn 3 chữ số thập phân)
  
  // Bước 3: Tính recommendedWorkers = Math.max(1, containerCores - 1)
  
  // Bước 4: Xác định decision ("SHED_LOAD_LAG_EXCEEDED" | "SHED_LOAD_ELU_EXCEEDED" | "ACCEPT_TRAFFIC") và trả về kết quả
}`,
    solution: `function evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores) {
  const p99LagMs = Math.round((p99LagNano / 1e6) * 100) / 100;
  const totalTime = activeTimeMs + idleTimeMs;
  const eluRatio = totalTime === 0 ? 0 : Math.round((activeTimeMs / totalTime) * 1000) / 1000;
  const recommendedWorkers = Math.max(1, containerCores - 1);

  let decision = 'ACCEPT_TRAFFIC';
  if (p99LagMs > maxAllowedLagMs) {
    decision = 'SHED_LOAD_LAG_EXCEEDED';
  } else if (eluRatio > maxAllowedEluRatio) {
    decision = 'SHED_LOAD_ELU_EXCEEDED';
  }

  return {
    p99LagMs,
    eluRatio,
    recommendedWorkers,
    decision
  };
}`,
    testCases: [
      {
        name: 'Vòng lặp khỏe mạnh (Active 350ms, Idle 650ms -> ELU 0.35, P99 Lag 4.25ms) trên 4 vCPU -> ACCEPT_TRAFFIC',
        input: [350, 650, 4250000, 50, 0.85, 4],
        expected: {
          p99LagMs: 4.25,
          eluRatio: 0.35,
          recommendedWorkers: 3,
          decision: 'ACCEPT_TRAFFIC'
        },
        hidden: false
      },
      {
        name: 'Độ trễ P99 vọt lên 78.5ms (> 50ms) do JSON.parse lớn -> Cắt tải SHED_LOAD_LAG_EXCEEDED',
        input: [600, 400, 78500000, 50, 0.85, 8],
        expected: {
          p99LagMs: 78.5,
          eluRatio: 0.6,
          recommendedWorkers: 7,
          decision: 'SHED_LOAD_LAG_EXCEEDED'
        },
        hidden: false
      },
      {
        name: 'P99 Lag thấp (12ms) nhưng ELU chạm 0.92 (> 0.85) trên Pod 1 vCPU -> Cắt tải SHED_LOAD_ELU_EXCEEDED',
        input: [920, 80, 12000000, 50, 0.85, 1],
        expected: {
          p99LagMs: 12,
          eluRatio: 0.92,
          recommendedWorkers: 1,
          decision: 'SHED_LOAD_ELU_EXCEEDED'
        },
        hidden: false
      },
      {
        name: 'Test biên ẩn: Chạm đúng ngưỡng biên (Lag == 50ms, ELU == 0.85) -> Vẫn cho phép ACCEPT_TRAFFIC',
        input: [850, 150, 50000000, 50, 0.85, 2],
        expected: {
          p99LagMs: 50,
          eluRatio: 0.85,
          recommendedWorkers: 1,
          decision: 'ACCEPT_TRAFFIC'
        },
        hidden: true
      },
      {
        name: 'Test ẩn: Làm tròn 3 chữ số thập phân cho ELU lẻ (200 / 300 = 0.667)',
        input: [200, 100, 15456000, 50, 0.85, 6],
        expected: {
          p99LagMs: 15.46,
          eluRatio: 0.667,
          recommendedWorkers: 5,
          decision: 'ACCEPT_TRAFFIC'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Event Loop Utilization (ELU), P99 Lag & Quyết Định Cắt Tải (ELU & Lag Load Shedder)',
      description: 'Áp dụng công thức định lượng sức khỏe vòng lặp ở Phần 1 và `AdaptiveWorkerPoolGuardService`. Viết hàm `evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores)` nhận vào:\n- `activeTimeMs`: Thời gian luồng chính thức làm việc (ms).\n- `idleTimeMs`: Thời gian luồng chính nằm ngủ chờ trong `epoll_wait` (ms).\n- `p99LagNano`: Chỉ số phân vị P99 đọc từ `histogram.percentile(99)` tính bằng **nano-giây (`ns`)**.\n- `maxAllowedLagMs`: Ngưỡng độ trễ P99 tối đa cho phép (ms, ví dụ `50`).\n- `maxAllowedEluRatio`: Ngưỡng tỷ lệ chiếm dụng vòng lặp tối đa (từ `0` đến `1`, ví dụ `0.85`).\n- `containerCores`: Số lõi vCPU khả dụng của Container đọc từ `os.availableParallelism()`.\n\nYêu cầu tính toán:\n1. Chuyển đổi độ trễ P99 từ nano-giây sang mili-giây: `p99LagMs = p99LagNano / 1e6` (làm tròn 2 chữ số thập phân).\n2. Tính tỷ lệ chiếm dụng vòng lặp `eluRatio = (activeTimeMs + idleTimeMs) === 0 ? 0 : activeTimeMs / (activeTimeMs + idleTimeMs)` (làm tròn **3 chữ số thập phân** bằng `Math.round(x * 1000) / 1000`).\n3. Tính kích thước Worker Pool khuyến nghị (chừa 1 lõi cho Main Thread): `recommendedWorkers = Math.max(1, containerCores - 1)`.\n4. Đánh giá quyết định tiếp nhận `decision`:\n   - Nếu `p99LagMs > maxAllowedLagMs`: `decision = "SHED_LOAD_LAG_EXCEEDED"`.\n   - Ngược lại, nếu `eluRatio > maxAllowedEluRatio`: `decision = "SHED_LOAD_ELU_EXCEEDED"`.\n   - Ngược lại: `decision = "ACCEPT_TRAFFIC"`.\nTrả về `{ p99LagMs, eluRatio, recommendedWorkers, decision }`.',
      guidedSteps: [
        'Bước 1 (Đổi đơn vị P99 Lag sang ms): Tính `p99LagMs = Math.round((p99LagNano / 1000000) * 100) / 100`.',
        'Bước 2 (Tính chỉ số ELU làm tròn 3 chữ số thập phân): Tính `total = activeTimeMs + idleTimeMs`, nếu `total === 0` thì `eluRatio = 0`, ngược lại `Math.round((activeTimeMs / total) * 1000) / 1000`.',
        'Bước 3 (Tính số lượng Worker khuyến nghị): Tính `recommendedWorkers = Math.max(1, containerCores - 1)`.',
        'Bước 4 (Kiểm tra ngưỡng cắt tải và trả về): Kiểm tra `p99LagMs > maxAllowedLagMs` trước, sau đó đến `eluRatio > maxAllowedEluRatio`, rồi trả về `{ p99LagMs, eluRatio, recommendedWorkers, decision }`.'
      ],
      hints: [
        'Lưu ý `histogram.percentile(99)` của module `perf_hooks` luôn trả về đơn vị nano-giây (`1 ms = 1,000,000 ns = 1e6 ns`).',
        'Chú ý `eluRatio` được yêu cầu làm tròn đến **3 chữ số thập phân** (`Math.round(val * 1000) / 1000`), còn `p99LagMs` làm tròn đến **2 chữ số thập phân**.'
      ],
      starterCode: `function evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores) {
  // Bước 1: Đổi p99LagNano sang p99LagMs (chia cho 1e6, làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính eluRatio = activeTimeMs / (activeTimeMs + idleTimeMs) (làm tròn 3 chữ số thập phân)
  
  // Bước 3: Tính recommendedWorkers = Math.max(1, containerCores - 1)
  
  // Bước 4: Xác định decision ("SHED_LOAD_LAG_EXCEEDED" | "SHED_LOAD_ELU_EXCEEDED" | "ACCEPT_TRAFFIC") và trả về kết quả
}`,
      solution: `function evaluateEventLoopAdmission(activeTimeMs, idleTimeMs, p99LagNano, maxAllowedLagMs, maxAllowedEluRatio, containerCores) {
  const p99LagMs = Math.round((p99LagNano / 1e6) * 100) / 100;
  const totalTime = activeTimeMs + idleTimeMs;
  const eluRatio = totalTime === 0 ? 0 : Math.round((activeTimeMs / totalTime) * 1000) / 1000;
  const recommendedWorkers = Math.max(1, containerCores - 1);

  let decision = 'ACCEPT_TRAFFIC';
  if (p99LagMs > maxAllowedLagMs) {
    decision = 'SHED_LOAD_LAG_EXCEEDED';
  } else if (eluRatio > maxAllowedEluRatio) {
    decision = 'SHED_LOAD_ELU_EXCEEDED';
  }

  return {
    p99LagMs,
    eluRatio,
    recommendedWorkers,
    decision
  };
}`,
      testCases: [
        {
          name: 'Vòng lặp khỏe mạnh (Active 350ms, Idle 650ms -> ELU 0.35, P99 Lag 4.25ms) trên 4 vCPU -> ACCEPT_TRAFFIC',
          input: [350, 650, 4250000, 50, 0.85, 4],
          expected: {
            p99LagMs: 4.25,
            eluRatio: 0.35,
            recommendedWorkers: 3,
            decision: 'ACCEPT_TRAFFIC'
          },
          hidden: false
        },
        {
          name: 'Độ trễ P99 vọt lên 78.5ms (> 50ms) do JSON.parse lớn -> Cắt tải SHED_LOAD_LAG_EXCEEDED',
          input: [600, 400, 78500000, 50, 0.85, 8],
          expected: {
            p99LagMs: 78.5,
            eluRatio: 0.6,
            recommendedWorkers: 7,
            decision: 'SHED_LOAD_LAG_EXCEEDED'
          },
          hidden: false
        },
        {
          name: 'P99 Lag thấp (12ms) nhưng ELU chạm 0.92 (> 0.85) trên Pod 1 vCPU -> Cắt tải SHED_LOAD_ELU_EXCEEDED',
          input: [920, 80, 12000000, 50, 0.85, 1],
          expected: {
            p99LagMs: 12,
            eluRatio: 0.92,
            recommendedWorkers: 1,
            decision: 'SHED_LOAD_ELU_EXCEEDED'
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Chạm đúng ngưỡng biên (Lag == 50ms, ELU == 0.85) -> Vẫn cho phép ACCEPT_TRAFFIC',
          input: [850, 150, 50000000, 50, 0.85, 2],
          expected: {
            p99LagMs: 50,
            eluRatio: 0.85,
            recommendedWorkers: 1,
            decision: 'ACCEPT_TRAFFIC'
          },
          hidden: true
        },
        {
          name: 'Test ẩn: Làm tròn 3 chữ số thập phân cho ELU lẻ (200 / 300 = 0.667)',
          input: [200, 100, 15456000, 50, 0.85, 6],
          expected: {
            p99LagMs: 15.46,
            eluRatio: 0.667,
            recommendedWorkers: 5,
            decision: 'ACCEPT_TRAFFIC'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Định Lượng Chi Phí Truyền Tin IPC: Structured Clone vs Zero-Copy TransferList (IPC Transfer Cost Simulator)',
      description: 'Mô phỏng sự chênh lệch về thời gian chặn Main Thread và dung lượng RAM tiêu thụ khi gửi các khối dữ liệu sang `Worker Thread` bằng `Structured Clone` so với `TransferList (Zero-Copy)`. Viết hàm `compareWorkerIpcStrategies(payloadSizesMb, cloneSerializeMsPerMb, workerComputeMsPerMb)` nhận vào:\n- `payloadSizesMb`: Mảng chứa kích thước (tính bằng Megabytes) của từng lô dữ liệu cần đẩy sang Worker.\n- `cloneSerializeMsPerMb`: Thời gian Main Thread bị chặn để tuần tự hóa `1 MB` dữ liệu theo thuật toán `Structured Clone` (ms/MB).\n- `workerComputeMsPerMb`: Thời gian Worker Thread tính toán trên `1 MB` dữ liệu (ms/MB).\n\nQuy tắc tính toán:\n1. Với mỗi lô dữ liệu `sizeMb` trong `payloadSizesMb`:\n   - Nếu dùng **Structured Clone**: Main Thread bị chặn `sizeMb * cloneSerializeMsPerMb` (ms), và tốn thêm đúng `sizeMb` (MB) bộ nhớ bản sao.\n   - Nếu dùng **Zero-Copy TransferList**: Main Thread chỉ tốn hằng số `0.005 ms` cho mỗi lần chuyển con trỏ (`payloadSizesMb.length * 0.005`), và tốn `0 MB` bộ nhớ bản sao!\n2. Tính các chỉ số tổng hợp (làm tròn 2 chữ số thập phân):\n   - `structuredCloneMainThreadBlockMs = sum(sizeMb * cloneSerializeMsPerMb)`.\n   - `zeroCopyMainThreadBlockMs = payloadSizesMb.length * 0.005`.\n   - `savedRamMb = sum(payloadSizesMb)` (Tổng dung lượng RAM không bị nhân đôi nhờ Zero-Copy).\n   - `totalWorkerComputeMs = sum(sizeMb * workerComputeMsPerMb)`.\n3. Khuyến nghị chiến lược `recommendedStrategy`: Nếu `savedRamMb >= 5` hoặc `structuredCloneMainThreadBlockMs >= 10` thì trả về `"USE_TRANSFER_LIST_ZERO_COPY"`, ngược lại `"STRUCTURED_CLONE_ACCEPTABLE"`.\nTrả về `{ structuredCloneMainThreadBlockMs, zeroCopyMainThreadBlockMs, savedRamMb, totalWorkerComputeMs, recommendedStrategy }`.',
      guidedSteps: [
        'Bước 1 (Tính tổng kích thước dữ liệu): Duyệt mảng `payloadSizesMb` để tính tổng `totalMb = sum(payloadSizesMb)`.',
        'Bước 2 (Tính thời gian chặn Main Thread của 2 phương pháp): Tính `structuredCloneMainThreadBlockMs = Math.round((totalMb * cloneSerializeMsPerMb) * 100) / 100` và `zeroCopyMainThreadBlockMs = Math.round((payloadSizesMb.length * 0.005) * 100) / 100`.',
        'Bước 3 (Tính RAM tiết kiệm được và thời gian Worker tính toán): `savedRamMb = Math.round(totalMb * 100) / 100` và `totalWorkerComputeMs = Math.round((totalMb * workerComputeMsPerMb) * 100) / 100`.',
        'Bước 4 (Đưa ra khuyến nghị và trả về): Nếu `savedRamMb >= 5 || structuredCloneMainThreadBlockMs >= 10` thì `"USE_TRANSFER_LIST_ZERO_COPY"`, ngược lại `"STRUCTURED_CLONE_ACCEPTABLE"`.'
      ],
      hints: [
        'Vì phép nhân có tính phân phối, `sum(sizeMb * cloneSerializeMsPerMb)` chính bằng `totalMb * cloneSerializeMsPerMb`.',
        'Đừng quên làm tròn cả 4 chỉ số số học đến 2 chữ số thập phân bằng `Math.round(val * 100) / 100`.'
      ],
      starterCode: `function compareWorkerIpcStrategies(payloadSizesMb, cloneSerializeMsPerMb, workerComputeMsPerMb) {
  // Bước 1: Tính tổng dung lượng dữ liệu totalMb từ mảng payloadSizesMb
  
  // Bước 2: Tính structuredCloneMainThreadBlockMs và zeroCopyMainThreadBlockMs
  
  // Bước 3: Tính savedRamMb và totalWorkerComputeMs
  
  // Bước 4: Xác định recommendedStrategy và trả về kết quả
}`,
      solution: `function compareWorkerIpcStrategies(payloadSizesMb, cloneSerializeMsPerMb, workerComputeMsPerMb) {
  let totalMb = 0;
  for (let i = 0; i < payloadSizesMb.length; i++) {
    totalMb += payloadSizesMb[i];
  }

  const structuredCloneMainThreadBlockMs = Math.round(totalMb * cloneSerializeMsPerMb * 100) / 100;
  const zeroCopyMainThreadBlockMs = Math.round(payloadSizesMb.length * 0.005 * 100) / 100;
  const savedRamMb = Math.round(totalMb * 100) / 100;
  const totalWorkerComputeMs = Math.round(totalMb * workerComputeMsPerMb * 100) / 100;

  const recommendedStrategy =
    savedRamMb >= 5 || structuredCloneMainThreadBlockMs >= 10
      ? 'USE_TRANSFER_LIST_ZERO_COPY'
      : 'STRUCTURED_CLONE_ACCEPTABLE';

  return {
    structuredCloneMainThreadBlockMs,
    zeroCopyMainThreadBlockMs,
    savedRamMb,
    totalWorkerComputeMs,
    recommendedStrategy
  };
}`,
      testCases: [
        {
          name: 'Truyền 4 Buffer lớn (50MB/Buffer = 200MB) -> Structured Clone chặn luồng chính 240ms, Zero-Copy chỉ tốn 0.02ms!',
          input: [[50, 50, 50, 50], 1.2, 3.5],
          expected: {
            structuredCloneMainThreadBlockMs: 240,
            zeroCopyMainThreadBlockMs: 0.02,
            savedRamMb: 200,
            totalWorkerComputeMs: 700,
            recommendedStrategy: 'USE_TRANSFER_LIST_ZERO_COPY'
          },
          hidden: false
        },
        {
          name: 'Truyền 2 đối tượng cấu hình rất nhỏ (0.5MB/mục) -> STRUCTURED_CLONE_ACCEPTABLE',
          input: [[0.5, 0.5], 1.5, 4.0],
          expected: {
            structuredCloneMainThreadBlockMs: 1.5,
            zeroCopyMainThreadBlockMs: 0.01,
            savedRamMb: 1,
            totalWorkerComputeMs: 4,
            recommendedStrategy: 'STRUCTURED_CLONE_ACCEPTABLE'
          },
          hidden: false
        },
        {
          name: 'Tổng dung lượng 4MB (< 5MB) nhưng chi phí tuần tự hóa cao (12ms >= 10ms) -> USE_TRANSFER_LIST_ZERO_COPY',
          input: [[2, 2], 3.0, 5.0],
          expected: {
            structuredCloneMainThreadBlockMs: 12,
            zeroCopyMainThreadBlockMs: 0.01,
            savedRamMb: 4,
            totalWorkerComputeMs: 20,
            recommendedStrategy: 'USE_TRANSFER_LIST_ZERO_COPY'
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Mảng rỗng không có tác vụ nào',
          input: [[], 1.2, 3.0],
          expected: {
            structuredCloneMainThreadBlockMs: 0,
            zeroCopyMainThreadBlockMs: 0,
            savedRamMb: 0,
            totalWorkerComputeMs: 0,
            recommendedStrategy: 'STRUCTURED_CLONE_ACCEPTABLE'
          },
          hidden: true
        },
        {
          name: 'Test ẩn: Chạm đúng ngưỡng 5MB savedRamMb -> USE_TRANSFER_LIST_ZERO_COPY',
          input: [[2.5, 2.5], 1.0, 2.5],
          expected: {
            structuredCloneMainThreadBlockMs: 5,
            zeroCopyMainThreadBlockMs: 0.01,
            savedRamMb: 5,
            totalWorkerComputeMs: 12.5,
            recommendedStrategy: 'USE_TRANSFER_LIST_ZERO_COPY'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Bộ Lập Lịch Bounded Worker Pool Có Kiểm Soát Áp Lực Ngược & Queue Timeout (Production Worker Pool Scheduler)',
      description: 'Mô phỏng bộ điều phối `BoundedWorkerPoolSafeService` trên Production có giới hạn hàng đợi (`maxQueueSize`) và kiểm tra thời gian chờ tối đa trong hàng đợi (`maxQueueWaitMs` — tránh xử lý Zombie Requests). Viết hàm `simulateBoundedWorkerPool(tasks, poolSize, maxQueueSize, maxQueueWaitMs)` nhận vào:\n- `tasks`: Mảng các tác vụ đến tại cùng thời điểm `t = 0`, mỗi phần tử có dạng `{ id: string, durationMs: number }`.\n- `poolSize`: Số lượng Worker Isolates trong bể luồng (số nguyên `>= 1`).\n- `maxQueueSize`: Số lượng tác vụ tối đa được phép nằm chờ trong hàng đợi khi tất cả Worker đều bận tại `t = 0` (số nguyên `>= 0`).\n- `maxQueueWaitMs`: Thời gian đứng chờ tối đa cho phép trước khi bắt đầu được Worker lấy ra chạy (số thực `>= 0`).\n\nQuy tắc kiểm tra đầu vào (Validation):\n- Nếu `!Array.isArray(tasks)` hoặc có bất kỳ phần tử nào thiếu `id` hoặc `typeof t.durationMs !== "number" || !Number.isFinite(t.durationMs) || t.durationMs <= 0`, hoặc `!Number.isInteger(poolSize) || poolSize < 1`, hoặc `!Number.isInteger(maxQueueSize) || maxQueueSize < 0`, hoặc `typeof maxQueueWaitMs !== "number" || !Number.isFinite(maxQueueWaitMs) || maxQueueWaitMs < 0`: Ném lỗi `throw new Error("INVALID_WORKER_POOL_INPUT")`.\n\nQuy tắc mô phỏng điều phối tại `t = 0`:\n1. **Kiểm tra tràn hàng đợi (`Backpressure Overflow`)**: Vì tất cả `tasks` đều đến tại `t = 0`, `poolSize` tác vụ đầu tiên được vào thẳng Worker ngay lập tức (`waitMs = 0`), và tối đa `maxQueueSize` tác vụ tiếp theo được nhận vào hàng đợi. Do đó, tổng số tác vụ tối đa được chấp nhận vào hệ thống là `maxAdmitted = poolSize + maxQueueSize`. Bất kỳ tác vụ nào có chỉ số `index >= maxAdmitted` sẽ bị từ chối ngay lập tức và đưa `id` vào mảng `rejectedOverflowIds`.\n2. **Lập lịch và kiểm tra hết hạn chờ (`Queue Timeout Expiration`)**: Khởi tạo mảng `workerFreeAt = new Array(poolSize).fill(0)`. Duyệt qua các tác vụ đã được nhận (`index < maxAdmitted`):\n   - Tìm Worker rảnh sớm nhất `bestIdx` có `waitMs = workerFreeAt[bestIdx]` nhỏ nhất.\n   - Nếu `waitMs > maxQueueWaitMs`: Tác vụ này đã chờ quá lâu trong hàng đợi (Zombie Request)! Đưa `task.id` vào mảng `expiredTimeoutIds` và **KHÔNG** cộng `durationMs` của nó vào `workerFreeAt[bestIdx]` (Worker đó lập tức xét tác vụ kế tiếp ở cùng mốc thời gian `waitMs`).\n   - Ngược lại (`waitMs <= maxQueueWaitMs`): Tác vụ được thực thi thành công! Đưa `task.id` vào `completedIds` và cập nhật `workerFreeAt[bestIdx] = waitMs + task.durationMs`.\n3. Tính `poolMakespanMs = Math.round(Math.max(0, ...workerFreeAt) * 100) / 100`.\nTrả về `{ completedIds, expiredTimeoutIds, rejectedOverflowIds, poolMakespanMs }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra tính hợp lệ của tham số): Kiểm tra `Array.isArray(tasks)`, `poolSize >= 1` (số nguyên), `maxQueueSize >= 0` (số nguyên), `maxQueueWaitMs >= 0` và mọi `task.durationMs > 0`. Nếu sai, `throw new Error("INVALID_WORKER_POOL_INPUT")`.',
        'Bước 2 (Tách các tác vụ vượt sức chứa maxAdmitted): Tính `maxAdmitted = poolSize + maxQueueSize`. Các tác vụ từ vị trí `maxAdmitted` trở đi được đẩy `id` vào `rejectedOverflowIds`.',
        'Bước 3 (Mô phỏng Worker Pool và lọc Zombie Request quá hạn chờ): Khởi tạo `workerFreeAt = new Array(poolSize).fill(0)`. Với mỗi tác vụ được nhận, tìm worker có `waitMs = workerFreeAt[bestIdx]` nhỏ nhất. Nếu `waitMs > maxQueueWaitMs`, đẩy `id` vào `expiredTimeoutIds` (không tăng `workerFreeAt`). Ngược lại, đẩy `id` vào `completedIds` và cộng `workerFreeAt[bestIdx] += task.durationMs`.',
        'Bước 4 (Tính poolMakespanMs và trả về): Tính `poolMakespanMs = Math.round(Math.max(0, ...workerFreeAt) * 100) / 100` và trả về `{ completedIds, expiredTimeoutIds, rejectedOverflowIds, poolMakespanMs }`.'
      ],
      hints: [
        'Điểm mấu chốt chống Zombie Request: khi một tác vụ trong hàng đợi bị phát hiện đã chờ quá hạn (`waitMs > maxQueueWaitMs`), Worker sẽ vứt bỏ nó ngay lập tức mà **không tốn thời gian chạy `durationMs`**, nên `workerFreeAt[bestIdx]` giữ nguyên!',
        'Tổng số tác vụ được hệ thống tiếp nhận tại `t = 0` bằng `poolSize` (vào thẳng Worker) cộng với `maxQueueSize` (nằm trong hàng đợi).'
      ],
      starterCode: `function simulateBoundedWorkerPool(tasks, poolSize, maxQueueSize, maxQueueWaitMs) {
  // Bước 1: Kiểm tra tính hợp lệ của đầu vào; ném Error("INVALID_WORKER_POOL_INPUT") nếu sai
  
  // Bước 2: Xác định maxAdmitted = poolSize + maxQueueSize và tách rejectedOverflowIds
  
  // Bước 3: Lập lịch các tác vụ được nhận trên workerFreeAt; kiểm tra waitMs > maxQueueWaitMs
  
  // Bước 4: Tính poolMakespanMs và trả về { completedIds, expiredTimeoutIds, rejectedOverflowIds, poolMakespanMs }
}`,
      solution: `function simulateBoundedWorkerPool(tasks, poolSize, maxQueueSize, maxQueueWaitMs) {
  if (
    !Array.isArray(tasks) ||
    !Number.isInteger(poolSize) ||
    poolSize < 1 ||
    !Number.isInteger(maxQueueSize) ||
    maxQueueSize < 0 ||
    typeof maxQueueWaitMs !== 'number' ||
    !Number.isFinite(maxQueueWaitMs) ||
    maxQueueWaitMs < 0
  ) {
    throw new Error('INVALID_WORKER_POOL_INPUT');
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (
      !t ||
      typeof t.id !== 'string' ||
      !t.id ||
      typeof t.durationMs !== 'number' ||
      !Number.isFinite(t.durationMs) ||
      t.durationMs <= 0
    ) {
      throw new Error('INVALID_WORKER_POOL_INPUT');
    }
  }

  const completedIds = [];
  const expiredTimeoutIds = [];
  const rejectedOverflowIds = [];
  const workerFreeAt = new Array(poolSize).fill(0);
  const maxAdmitted = poolSize + maxQueueSize;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (i >= maxAdmitted) {
      rejectedOverflowIds.push(task.id);
      continue;
    }

    let bestIdx = 0;
    for (let w = 1; w < poolSize; w++) {
      if (workerFreeAt[w] < workerFreeAt[bestIdx]) {
        bestIdx = w;
      }
    }

    const waitMs = workerFreeAt[bestIdx];
    if (waitMs > maxQueueWaitMs) {
      expiredTimeoutIds.push(task.id);
    } else {
      completedIds.push(task.id);
      workerFreeAt[bestIdx] = waitMs + task.durationMs;
    }
  }

  const poolMakespanMs = Math.round(Math.max(0, ...workerFreeAt) * 100) / 100;

  return {
    completedIds,
    expiredTimeoutIds,
    rejectedOverflowIds,
    poolMakespanMs
  };
}`,
      testCases: [
        {
          name: 'Pool 2 Workers, Queue tối đa 3 (MaxAdmitted = 5), 6 tasks đến -> Task 6 bị từ chối Overflow, các task 1..5 chạy thành công',
          input: [
            [
              { id: 'T1', durationMs: 40 },
              { id: 'T2', durationMs: 40 },
              { id: 'T3', durationMs: 40 },
              { id: 'T4', durationMs: 40 },
              { id: 'T5', durationMs: 40 },
              { id: 'T6', durationMs: 40 }
            ],
            2,
            3,
            100
          ],
          expected: {
            completedIds: ['T1', 'T2', 'T3', 'T4', 'T5'],
            expiredTimeoutIds: [],
            rejectedOverflowIds: ['T6'],
            poolMakespanMs: 120
          },
          hidden: false
        },
        {
          name: 'Loại bỏ Zombie Requests khi thời gian chờ vượt quá maxQueueWaitMs (50ms) -> Không tốn CPU chạy T5, T6',
          input: [
            [
              { id: 'T1', durationMs: 30 },
              { id: 'T2', durationMs: 30 },
              { id: 'T3', durationMs: 30 },
              { id: 'T4', durationMs: 30 },
              { id: 'T5', durationMs: 30 },
              { id: 'T6', durationMs: 30 }
            ],
            2,
            4,
            50
          ],
          expected: {
            completedIds: ['T1', 'T2', 'T3', 'T4'],
            expiredTimeoutIds: ['T5', 'T6'],
            rejectedOverflowIds: [],
            poolMakespanMs: 60
          },
          hidden: false
        },
        {
          name: 'Không cho phép xếp hàng (maxQueueSize = 0) trên Pool 3 Workers -> Chỉ nhận đúng 3 tác vụ đầu tiên',
          input: [
            [
              { id: 'A', durationMs: 25 },
              { id: 'B', durationMs: 50 },
              { id: 'C', durationMs: 35 },
              { id: 'D', durationMs: 20 }
            ],
            3,
            0,
            10
          ],
          expected: {
            completedIds: ['A', 'B', 'C'],
            expiredTimeoutIds: [],
            rejectedOverflowIds: ['D'],
            poolMakespanMs: 50
          },
          hidden: false
        },
        {
          name: 'Test ẩn: poolSize không hợp lệ (<= 0) -> Ném lỗi INVALID_WORKER_POOL_INPUT',
          input: [[{ id: 'T1', durationMs: 10 }], 0, 5, 50],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Test ẩn: durationMs âm hoặc bằng 0 -> Ném lỗi INVALID_WORKER_POOL_INPUT',
          input: [[{ id: 'T1', durationMs: -15 }], 2, 5, 50],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
