import type { Sprint } from './types.ts';

export const chapter1: Sprint = {
  sprintId: 1,
  sprintTitle: 'Chương 1: Runtime Internals, V8 Engine & Quản Trị Bộ Nhớ Cấp Thấp',
  sprintDesc: 'Làm chủ bản chất vật lý của máy tính: Giới hạn phần cứng, V8 Pipeline (Ignition/TurboFan), Cấp phát bộ nhớ Stack/Heap, V8 Garbage Collection và Kỹ thuật Profiling Memory Leak chuyên sâu',
  lessons: [
    {
      id: 'c1-l1',
      title: 'Bài 01: Từ Phần Cứng Đến Runtime: Bản Chất Long-Running Process & Bài Toán C10K',
      duration: '60 phút',
      tag: 'Hardware & OS Layer',
      theory: `
# 1. BỐI CẢNH KIẾN TRÚC: CLIENT RUNTIME (EPHEMERAL) VS BACKEND RUNTIME (LONG-RUNNING DAEMON)

Để thiết kế hệ thống có khả năng chịu tải hàng chục nghìn kết nối đồng thời, kỹ sư Backend bắt buộc phải phân biệt sâu sắc sự đối lập về mô hình vận hành giữa Trình duyệt (Browser) và Máy chủ (Node.js/NestJS):

* **Client Runtime (Vòng đời tạm thời - Ephemeral Lifecycle):**
  - Trình duyệt hoạt động theo mô hình Sandbox cô lập trên từng Tab. Vòng đời của một trang web thường chỉ kéo dài từ vài giây đến vài phút.
  - Khi người dùng F5 hoặc đóng Tab, toàn bộ không gian bộ nhớ (V8 Heap, DOM Tree, Event Listeners) lập tức bị hệ điều hành tiêu hủy và thu hồi hoàn toàn.
  - Một lỗi rò rỉ bộ nhớ (Memory Leak) ở Frontend chỉ ảnh hưởng cục bộ đến duy nhất một người dùng đó mà không thể làm gián đoạn trình duyệt của người khác.

* **Backend Runtime (Tiến trình trường tồn - Long-Running Process Daemon):**
  - Khi máy chủ khởi động (\`node dist/main.js\`), nó là một tiến trình Daemon chạy liên tục hàng tháng, hàng năm để phục vụ hàng triệu request.
  - **Không gian bộ nhớ dùng chung (Single Shared Heap):** Mọi request gửi đến hệ thống đều chia sẻ chung một không gian bộ nhớ ảo (V8 Virtual Address Space) và một luồng thực thi chính (Main Thread).
  - **Hệ quả của ô nhiễm trạng thái (Shared State Contamination):** Nếu kỹ sư vô tình lưu dữ liệu của một request vào thuộc tính của một \`Singleton Service\` (ví dụ: \`this.activeTenantId = req.user.tenantId\`), giá trị này sẽ rò rỉ sang các request của các người dùng khác (Data Bleed / Cross-tenant Leakage) — một lỗi bảo mật nghiêm trọng cấp P0.
  - **Hệ quả của nghẽn luồng (Thread Starvation):** Nếu một request chạy một vòng lặp nặng chiếm CPU trong 3 giây (ví dụ: tính toán mã hóa đồng bộ hoặc duyệt mảng đệ quy), luồng chính bị chiếm giữ khiến toàn bộ 10,000 request khác trên cùng máy chủ bị treo cứng (Gateway Timeout 504).

---

# 2. GIỚI HẠN VẬT LÝ CỦA PHẦN CỨNG & BÀI TOÁN C10K

Mọi dòng code chúng ta viết cuối cùng đều phải chịu sự chi phối của tốc độ truyền dẫn vật lý trong vi mạch máy tính:

### 2.1 Sự Chênh Lệch Tốc Độ Khủng Khiếp Của Phần Cứng
* **CPU L1 Cache Reference:** ~1 nanosecond (ns) (xử lý tức thì).
* **RAM Access (Bộ nhớ trong):** ~100 ns (chậm hơn L1 Cache 100 lần).
* **NVMe SSD I/O (Đọc ổ cứng):** ~100,000 ns = 100 microseconds (chậm hơn CPU 100,000 lần).
* **Network Roundtrip (Hà Nội -> Singapore):** ~40,000,000 ns = 40 milliseconds (chậm hơn CPU 40 triệu lần!).

> **Nguyên lý cốt lõi của Kỹ sư:** Nếu CPU Core phải dừng lại (Block) chỉ để đợi mạng hoặc đĩa cứng trả về dữ liệu, nó đang lãng phí hàng chục triệu chu kỳ xung nhịp quý giá mà không làm được gì.

### 2.2 Sự Sụp Đổ Của Mô Hình Đa Luồng Cũ (Thread-per-Request)
Trước khi Node.js ra đời (thời kỳ của Apache HTTPD, PHP-FPM sơ khai), máy chủ xử lý kết nối bằng mô hình: **Mỗi người dùng kết nối đến -> Hệ điều hành cấp phát 1 OS Thread riêng biệt.**
Mô hình này sụp đổ hoàn toàn khi gặp **Bài toán C10K** (10,000 kết nối đồng thời) vì 2 rào cản vật lý:
1. **Lãng phí bộ nhớ Stack:** Mỗi thread trên Linux ngốn tối thiểu 1MB - 2MB RAM. Với 10,000 user, OS mất ngay 10GB - 20GB RAM chỉ để lưu Call Stack rỗng của các thread đang ngủ (Idle).
2. **Context Switching Overhead (Chi phí chuyển đổi ngữ cảnh):** Khi CPU nhảy qua lại giữa hàng nghìn threads, CPU tốn hơn 70% công suất chỉ để lưu/phục hồi thanh ghi (Registers: \`RIP\`, \`RSP\`), làm mất hiệu lực bộ nhớ đệm (Cache Thrashing) và nạp lại bảng phân trang ảo (TLB Invalidation).

Node.js và NestJS giải quyết triệt để bài toán này bằng **Kiến trúc Single-threaded Event Loop kết hợp Non-blocking I/O**: Dùng 1 luồng duy nhất để tiếp nhận tất cả kết nối, ủy thác toàn bộ việc chờ đợi I/O cho hệ điều hành, giúp 1 server 2GB RAM có thể phục vụ hàng chục nghìn kết nối đồng thời một cách nhẹ nhàng.

---

# 3. PHÂN VÙNG BỘ NHỚ RESIDENT SET SIZE (RSS) CỦA TIẾN TRÌNH

Khi đại ca kiểm tra \`process.memoryUsage()\`, hệ điều hành cấp phát các phân vùng vật lý:

\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│                 RESIDENT SET SIZE (RSS) - TOÀN BỘ RAM CỦA TIẾN TRÌNH          │
├────────────────────────────┬─────────────────────────────┬────────────────────┤
│       V8 HEAP SPACE        │      V8 STACK SPACE         │    C++ NON-HEAP    │
├──────────────┬─────────────┼─────────────────────────────┼────────────────────┤
│  Young Gen   │  Old Gen    │ Call Frames, Biến cục bộ,   │ Node.js Buffers,   │
│ (From / To)  │ (Mark-Sweep)│ Con trỏ địa chỉ tham chiếu  │ Crypto C++ Malloc  │
└──────────────┴─────────────┴─────────────────────────────┴────────────────────┘
\`\`\`

1. **Stack Memory:** Quản lý theo cơ chế LIFO (Last In First Out). Lưu trữ các biến nguyên thủy (Primitives), con trỏ tham chiếu trỏ sang Heap và các khung hàm (Call Frames). Cấp phát và thu hồi tức thì theo con trỏ Stack Pointer của CPU (0% GC overhead).
2. **Heap Memory:** Vùng nhớ cấp phát động chứa Objects, Arrays, Closures và Class Instances. Được kiểm soát và thu gom rác tự động bởi V8 Garbage Collector.
3. **C++ Non-Heap (External Memory):** Vùng nhớ cấp phát ngoài V8 Heap thông qua hàm \`malloc()\` trực tiếp tại tầng C++ của Node.js (dành cho Buffer đọc file, socket network, khóa crypto).

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống (System Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG VẬT LÝ & PHẦN CỨNG (HARDWARE LAYER)                                  │
│    [ CPU Cores / L1-L2-L3 Cache ] ◄───► [ RAM 32GB ] ◄───► [ NVMe SSD / NIC ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ System Calls (epoll, socket, read)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG NHÂN HỆ ĐIỀU HÀNH (LINUX OS KERNEL)                                   │
│    ├── File Descriptor Table: Socket [FD: 12] (Listening Port 3000)          │
│    ├── Kernel TCP Buffers: [ Receive Queue ] / [ Send Queue ]                 │
│    └── Epoll / Kqueue Ready List: Theo dõi hàng chục nghìn Socket cùng lúc   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Libuv C-Bindings
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG RUNTIME CẤP THẤP (NODE.JS INTERNALS)                                  │
│    ├── Libuv Event Loop (Poll Phase): Đọc dữ liệu từ Socket không chặn luồng │
│    ├── Libuv Threadpool (4 Threads): Chạy crypto, fs, DNS lookup             │
│    └── V8 Engine (C++): Stack Memory & Heap Memory (Young/Old Gen)           │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Đa Kết Nối (Thread-per-Request vs Event Loop)
\`\`\`diagram
MÔ HÌNH CŨ: THREAD-PER-REQUEST (APACHE / PHP-FPM)
Client 1 ──► [ OS Thread 1 (2MB Stack) ] ──► Chờ I/O ──► CPU BỊ NGHẼN KHÔNG LÀM GÌ!
Client 2 ──► [ OS Thread 2 (2MB Stack) ] ──► Chờ I/O ──► CPU BỊ NGHẼN KHÔNG LÀM GÌ!
10,000 Users = Tốn 20GB RAM chỉ để giữ các luồng ngủ!

MÔ HÌNH HIỆN ĐẠI: EVENT LOOP & NON-BLOCKING I/O (NODE.JS / NESTJS)
Client 1 ──┐
Client 2 ──┼──► [ 1 Main Thread Duy Nhất ] ──► Giao I/O cho OS Kernel (epoll)
Client 3 ──┘           │                         Main Thread lập tức rảnh tay
                       └──► Không bao giờ ngủ! ── đón tiếp Client 4, 5, 6...
\`\`\`

### ⚖️ Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Phân Vùng Bộ Nhớ V8)
\`\`\`diagram
                     DỮ LIỆU CỦA BẠN SẼ NẰM Ở ĐÂU TRONG RAM TIẾN TRÌNH?
                                             │
                                             ▼
                                Kiểu dữ liệu là gì?
                                /                 \\
                  NGUYÊN THỦY (Number, Bool, Con trỏ)   PHỨC HỢP (Object, Array, Closure)
                               /                                   \\
                              ▼                                     ▼
                     [ V8 STACK MEMORY ]                 Tuổi thọ của đối tượng?
                     - Cấp phát cực nhanh (LIFO)          /                   \\
                     - Tự động pop khi hết hàm       DƯỚI 2 CHU KỲ GC        SỐNG LÂU / SINGLETON
                     - 0% áp lực lên GC                      /                         \\
                                                            ▼                           ▼
                                                   [ YOUNG GENERATION ]         [ OLD GENERATION ]
                                                   - Vùng From / To             - Mark-Sweep-Compact
                                                   - Thuật toán Scavenge        - Chống phân mảnh
\`\`\`

### 📊 Sơ đồ 4: Ma Trận Đánh Đổi Kỹ Thuật (Concurrency Models Matrix)

| Tiêu Chí So Sánh | Thread-per-Request (Truyền thống) | Coroutine / Green Threads (Go / Java Loom) | Single-threaded Event Loop (Node.js) |
| :--- | :--- | :--- | :--- |
| **Tiêu tốn bộ nhớ / kết nối** | Cực cao (~1-2MB / Thread) | Rất thấp (~2-4KB / Goroutine) | **Gần như bằng 0 (~vài trăm bytes socket)** |
| **Chi phí Context Switch** | Cực đắt (Lưu registers, TLB flush) | Rất nhẹ (User-space switch) | **0% (Không có context switch giữa request)** |
| **Tận dụng CPU Multi-core** | Tự động phân bổ qua OS Threads | Tự động phân bổ M:N | Cần chạy Cluster Mode hoặc nhiều Pods |
| **Rủi ro sập hệ thống** | Hết RAM khi số lượng kết nối tăng | Dễ dính Race Condition bộ nhớ chia sẻ | **Bị nghẽn toàn bộ nếu dính vòng lặp CPU** |
      `,
      realCodeSnippet: `// File: src/health/health.controller.ts
// Trích dẫn từ dự án thực tế Esmiles Backend - Probe Giám Sát Hạ Tầng & Kết Nối Mạng TCP
import { Controller, Get, Inject, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Public } from '../modules/platform/auth/interface/decorator/public.decorator';

/**
 * Endpoint hạ tầng cho LB / Kubernetes Probe (ADR-0008 §7).
 * Version-neutral + nằm NGOÀI global prefix 'api' để probe ổn định qua mọi version.
 * - Liveness (/health): Đảm bảo V8 Event Loop & Main Thread không bị lock/starve.
 * - Readiness (/ready): Kiểm tra toàn vẹn Socket TCP Pool đến Redis Cache & PostgreSQL DB.
 */
@SkipThrottle() // Probe LB/k8s poll liên tục mỗi 5s, tuyệt đối không được trả HTTP 429
@ApiTags('health')
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('health')
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async readiness() {
    // Ping đồng thời cả 2 kết nối hạ tầng để tránh tăng P99 Latency
    const [redis, db] = await Promise.all([this.pingRedis(), this.pingDb()]);
    const checks = { redis, db };
    const ready = Object.values(checks).every((s) => s === 'up');
    return { status: ready ? 'ok' : 'degraded', checks };
  }

  private async pingRedis(): Promise<'up' | 'down'> {
    try {
      return (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async pingDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw\`SELECT 1\`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}`,
      quiz: [
        {
          id: 'c1-l1-q1',
          question: 'Tại sao mô hình đa luồng truyền thống (Thread-per-Request) bị sụp đổ khi phải đối mặt với Bài toán C10K (10,000 kết nối đồng thời)?',
          options: [
            'Vì hệ điều hành giới hạn bảng mô tả tệp tin (ulimit -n) khiến kernel tự động drop toàn bộ các gói tin TCP SYN khi số kết nối vượt quá backlog queue của socket.',
            'Vì mỗi OS Thread tiêu tốn 1-2MB RAM Stack riêng biệt (10K threads ngốn 10-20GB RAM) và chi phí Context Switching liên tục giữa hàng nghìn threads làm tê liệt CPU Cache (Cache Thrashing).',
            'Vì nhân Linux sử dụng cơ chế Spinlock toàn cục trên bảng định tuyến mạng, khiến hàng nghìn threads bị kẹt trong trạng thái Uninterruptible Sleep (D-state) để tranh chấp socket mutex.',
            'Vì thời gian chuyển đổi ngữ cảnh giữa các threads tăng theo hàm lũy thừa O(2^N), làm cạn kiệt 100% băng thông của thanh ghi CPU mà không phụ thuộc vào dung lượng RAM vật lý.'
          ],
          correctIndex: 1,
          explanation: 'Mỗi thread của Linux cần 1-2MB bộ nhớ Stack riêng biệt. 10,000 kết nối làm mất 10-20GB RAM chỉ để chứa call stack rỗng. Đồng thời, CPU tốn phần lớn chu kỳ chỉ để lưu/nạp thanh ghi và làm mất hiệu lực CPU Cache L1/L2 (Context Switching Overhead).'
        },
        {
          id: 'c1-l1-q2',
          question: 'Chỉ số process.memoryUsage().external trong Node.js phản ánh phân vùng bộ nhớ thực tế nào sau đây của tiến trình?',
          options: [
            'Bộ nhớ thuộc phân vùng Large Object Space của V8 Heap dùng để lưu trữ các mảng và chuỗi ký tự JavaScript có kích thước vượt quá 500KB.',
            'Bộ nhớ dùng chung (Shared Memory) được cấp phát qua SharedArrayBuffer để truyền dữ liệu không qua sao chép giữa các Worker Threads độc lập.',
            'Bộ nhớ cấp phát bằng hàm malloc ở tầng C++ bên ngoài V8 Heap (chẳng hạn như dữ liệu nhị phân của Buffer, ngữ cảnh mã hóa của module crypto, và stream zlib).',
            'Dung lượng bộ nhớ ảo (Virtual Memory) của tiến trình đã bị hệ điều hành hoán đổi (swap) ra ổ đĩa khi máy chủ chạm ngưỡng cạn kiệt bộ nhớ vật lý.'
          ],
          correctIndex: 2,
          explanation: 'Chỉ số external phản ánh bộ nhớ C++ malloc nằm ngoài V8 Heap. Điển hình nhất là các đối tượng Buffer: trên V8 Heap nó chỉ là JS wrapper nhỏ ~32 bytes, nhưng dữ liệu nhị phân thực tế lại nằm trong vùng nhớ external C++ này, không chịu sự quản lý trực tiếp của giới hạn max-old-space-size.'
        },
        {
          id: 'c1-l1-q3',
          question: 'Khác biệt căn bản nhất giữa cơ chế giải phóng bộ nhớ trên Stack Memory và Heap Memory của V8 Engine là gì?',
          options: [
            'Stack được giải phóng tức thì theo cơ chế LIFO bằng một phép toán tịnh tiến con trỏ Stack Pointer của CPU khi kết thúc hàm (0% GC overhead), trong khi Heap là vùng nhớ cấp phát động đòi hỏi Garbage Collector phải duyệt đồ thị tham chiếu để thu hồi.',
            'Stack phân bổ các đối tượng có kích thước biến động và được dọn dẹp bằng thuật toán Cheney Scavenge, trong khi Heap chỉ lưu các địa chỉ trả về cố định và được CPU dọn dẹp theo chu kỳ xung nhịp.',
            'Stack thu hồi bộ nhớ bằng cách đếm số lượng con trỏ tham chiếu (Reference Counting) ngay khi biến ra khỏi block scope, trong khi Heap chỉ được dọn dẹp khi tiến trình nhận tín hiệu kết thúc từ hệ điều hành.',
            'Stack sử dụng cơ chế bảo vệ phân trang nhớ (Memory Page Protection) của nhân kernel để đánh dấu vùng nhớ khả dụng, còn Heap sử dụng bảng băm con trỏ nội bộ để ghi đè dữ liệu cũ.'
          ],
          correctIndex: 0,
          explanation: 'Stack Memory hoạt động theo cơ chế LIFO: khi một hàm kết thúc, con trỏ Stack Pointer của CPU chỉ việc lùi lại (pop stack frame) để giải phóng toàn bộ vùng nhớ của hàm đó trong 1 chu kỳ xung nhịp. Heap Memory phân bổ động nên bắt buộc phải có GC chạy thuật toán quét đồ thị tham chiếu phức tạp.'
        },
        {
          id: 'c1-l1-q4',
          question: 'Hiện tượng CPU Cache Thrashing (mất hiệu lực bộ nhớ đệm CPU L1/L2/L3) xảy ra nghiêm trọng nhất trong tình huống nào đối với các máy chủ I/O?',
          options: [
            'Khi luồng thực thi duyệt một mảng 2 chiều theo thứ tự cột thay vì hàng, làm dữ liệu nạp vào mỗi dòng Cache Line 64-byte không được tái sử dụng.',
            'Khi hai luồng chạy trên hai lõi CPU khác nhau cùng cập nhật hai biến độc lập nhưng vô tình nằm chung trên cùng một Cache Line phần cứng (False Sharing).',
            'Khi tiến trình truy cập vào các trang bộ nhớ ảo không nằm trong RAM thực tế, buộc CPU phải dừng luồng để đọc dữ liệu từ ổ cứng thông qua Page Fault.',
            'Khi hệ thống duy trì quá nhiều OS Threads đồng thời khiến CPU liên tục phải chuyển đổi ngữ cảnh (Context Switching), nạp/xả toàn bộ thanh ghi và làm bốc hơi tính cục bộ dữ liệu (Data Locality) trên L1/L2 Cache.'
          ],
          correctIndex: 3,
          explanation: 'Khi CPU chuyển từ Thread A sang Thread B, dữ liệu của Thread A trên L1/L2 Cache trở nên vô dụng và bị đẩy ra ngoài để nạp dữ liệu của Thread B vào. Khi quay lại Thread A, CPU lại bị Cache Miss và phải đọc từ RAM (chậm hơn 100 lần). Kiến trúc đơn luồng Event Loop của Node.js giữ vững Cache Locality tối ưu trên CPU core.'
        },
        {
          id: 'c1-l1-q5',
          question: 'Tại sao việc lưu trữ dữ liệu của request vào thuộc tính của một Singleton Service trong NestJS (ví dụ: this.currentUser = req.user) lại dẫn đến sự cố bảo mật rò rỉ dữ liệu chéo (Cross-tenant Data Bleed) ngay cả trên môi trường đơn luồng của Node.js?',
          options: [
            'Vì đối tượng currentUser bị đưa vào phân vùng Old Generation của V8 Heap khiến bộ thu gom rác không thể giải phóng, làm sập bộ nhớ máy chủ sau vài nghìn requests.',
            'Vì các Worker Threads chạy ngầm của Node.js cùng lúc ghi dữ liệu vào cùng một ô nhớ thanh ghi mà không có cơ chế Mutex/Lock đồng bộ.',
            'Vì Singleton Service duy trì một instance duy nhất suốt vòng đời tiến trình; trong khi Event Loop xử lý bất đồng bộ, các điểm await làm ngắt quãng luồng xử lý của request này và cho phép request khác xen vào ghi đè lên thuộc tính dùng chung đó.',
            'Vì NestJS IoC Container sẽ tự động nhân bản (clone) đối tượng Service mỗi khi phát hiện có sự thay đổi thuộc tính, làm mất tính toàn vẹn của Dependency Injection Tree.'
          ],
          correctIndex: 2,
          explanation: 'Trong kiến trúc Long-Running Process của NestJS, các Service mặc định là Singleton. Mọi request đều dùng chung một instance duy nhất. Khi một request gặp điểm await (I/O chờ DB), Event Loop nhường quyền cho request khác. Request thứ hai ghi đè this.currentUser. Khi request một tiếp tục chạy, nó sẽ đọc dữ liệu của request hai, dẫn đến rò rỉ dữ liệu chéo cực kỳ nghiêm trọng.'
        },
        {
          id: 'c1-l1-q6',
          question: 'Cơ chế nào ở tầng nhân hệ điều hành (OS Kernel) giúp Libuv và Node.js giám sát hàng chục nghìn kết nối mạng đồng thời mà không làm tiêu hao chu kỳ CPU khi các kết nối đang rảnh rỗi (Idle)?',
          options: [
            'Sử dụng syscall select() hoặc poll() để duyệt tuần tự với độ phức tạp O(N) qua toàn bộ mảng file descriptors trong một vòng lặp liên tục ở chế độ user-space.',
            'Sử dụng các syscall I/O Multiplexing hướng sự kiện (epoll trên Linux, kqueue trên BSD/macOS) cho phép tiến trình chuyển sang trạng thái ngủ và chỉ được kernel đánh thức khi có sự kiện mạng sẵn sàng với độ phức tạp O(1).',
            'Sử dụng cơ chế POSIX AIO (aio_read/aio_write) ép kernel tự động tạo một luồng kernel thread riêng biệt cho từng socket để xử lý ngầm.',
            'Sử dụng kỹ thuật Kernel Bypass (DPDK) truyền dữ liệu trực tiếp từ card mạng NIC vào không gian bộ nhớ của V8 mà không thông qua TCP/IP stack của hệ điều hành.'
          ],
          correctIndex: 1,
          explanation: 'Node.js đạt hiệu năng C10K nhờ Libuv sử dụng các syscall I/O Multiplexing phi chặn của Kernel (epoll trên Linux, kqueue trên macOS/BSD, IOCP trên Windows). Thay vì tốn CPU thăm dò O(N), hệ điều hành sẽ đưa tiến trình vào trạng thái ngủ và chỉ đánh thức Event Loop khi có sự kiện mạng thực sự xảy ra trên socket.'
        },
        {
          id: 'c1-l1-q7',
          question: 'Khi dung lượng phân vùng Old Generation của V8 Heap chạm ngưỡng giới hạn mặc định (~1.4GB trên máy chủ 64-bit), điều gì sẽ xảy ra và cờ tham số nào của Node.js giúp mở rộng giới hạn này?',
          options: [
            'V8 sẽ chuyển toàn bộ object còn sống sang phân vùng To-Space của Young Generation; có thể tăng kích thước phân vùng này qua cờ --max-semi-space-size.',
            'Node.js tự động khởi tạo thêm Worker Thread ngầm để gánh bớt các object dư thừa; có thể điều chỉnh qua cờ --experimental-worker-memory.',
            'Hệ điều hành tự động hoán đổi phân vùng bộ nhớ này ra swap space trên ổ đĩa cứng; có thể cấu hình dung lượng swap qua cờ --max-swap-allocation.',
            'V8 kích hoạt liên tục các chu kỳ Full GC nhưng không giải phóng được bộ nhớ, dẫn đến tiến trình crash tức thì với lỗi "JavaScript heap out of memory"; mở rộng bằng cờ --max-old-space-size=<MB>.'
          ],
          correctIndex: 3,
          explanation: 'Mặc định trên kiến trúc 64-bit, V8 giới hạn Old Generation ở mức ~1.4GB để đảm bảo thời gian tạm dừng thu gom rác (GC pause time) không vượt quá ngưỡng chấp nhận được của trình duyệt. Trên máy chủ backend, nếu cần xử lý dữ liệu lớn, ta dùng cờ --max-old-space-size=4096 (để cấp 4GB RAM) hoặc cấu hình trong môi trường container.'
        },
        {
          id: 'c1-l1-q8',
          question: 'Ý nghĩa kỹ thuật chính xác của chỉ số Resident Set Size (RSS) khi so sánh với Heap Total trong telemetry của Node.js là gì?',
          options: [
            'RSS là tổng dung lượng RAM vật lý thực tế mà hệ điều hành cấp cho toàn bộ tiến trình (gồm V8 Heap, bộ nhớ C++ malloc, Call Stack, và binary thực thi), trong khi Heap Total chỉ là tổng dung lượng bộ nhớ mà V8 đã cam kết dành riêng cho các đối tượng JavaScript.',
            'RSS là tổng không gian địa chỉ bộ nhớ ảo (Virtual Memory) mà tiến trình yêu cầu từ kernel (gồm cả các vùng nhớ chưa map vào RAM), trong khi Heap Total là dung lượng RAM vật lý thực tế đã được cấp phát.',
            'RSS là phần bộ nhớ dùng chung giữa tiến trình Node.js và các tiến trình cha trong Linux cgroups, trong khi Heap Total là bộ nhớ riêng tư (Private Dirty Memory) độc quyền của V8.',
            'RSS chỉ bao gồm dung lượng của các Buffer nhị phân và Native Addons C++, trong khi Heap Total bao gồm toàn bộ mã nguồn JavaScript và Call Stack của tiến trình.'
          ],
          correctIndex: 0,
          explanation: 'RSS (Resident Set Size) là dung lượng RAM vật lý thực tế mà OS cấp phát cho toàn bộ tiến trình. Nó bao gồm V8 Heap (heapTotal/heapUsed), bộ nhớ C++ malloc (external, Buffer), Call Stack của các thread, và chính mã nhị phân thực thi của Node.js runtime. Giám sát RSS là cách duy nhất để ngăn chặn container bị OOMKilled.'
        }
      ],
      codeChallenge: {
        title: 'Xây Dựng Memory Footprint Tracker An Toàn',
        description: 'Viết hàm `trackMemoryThreshold(maxHeapMb, currentUsageBytes)`: Nhận vào `maxHeapMb` (ngưỡng RAM Heap tối đa tính bằng MB) và `currentUsageBytes` (object chứa `heapUsed`, `external`, `rss`). Tính toán: `heapUsedMb`, `externalMb`, `rssMb`, `isCritical` (true nếu `heapUsedMb > maxHeapMb * 0.85`), và `retainedRatio` (tỷ lệ `heapUsed / rss` làm tròn 2 chữ số thập phân). Nếu input không hợp lệ, ném `Error("INVALID_MEMORY_TELEMETRY")`.',
        starterCode: `function trackMemoryThreshold(maxHeapMb, currentUsageBytes) {
  // Viết logic giám sát bộ nhớ chuẩn hệ thống
  
}`,
        solution: `function trackMemoryThreshold(maxHeapMb, currentUsageBytes) {
  if (typeof maxHeapMb !== 'number' || maxHeapMb <= 0 || !currentUsageBytes || typeof currentUsageBytes !== 'object') {
    throw new Error("INVALID_MEMORY_TELEMETRY");
  }
  const { heapUsed, external, rss } = currentUsageBytes;
  if (typeof heapUsed !== 'number' || typeof external !== 'number' || typeof rss !== 'number' || rss <= 0) {
    throw new Error("INVALID_MEMORY_TELEMETRY");
  }
  const toMb = (b) => Math.round((b / 1024 / 1024) * 100) / 100;
  const heapUsedMb = toMb(heapUsed);
  const externalMb = toMb(external);
  const rssMb = toMb(rss);
  const isCritical = heapUsedMb > maxHeapMb * 0.85;
  const retainedRatio = Math.round((heapUsed / rss) * 100) / 100;

  return {
    heapUsedMb,
    externalMb,
    rssMb,
    isCritical,
    retainedRatio
  };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Dưới ngưỡng an toàn',
            input: [1024, { heapUsed: 524288000, external: 104857600, rss: 838860800 }],
            expected: { heapUsedMb: 500, externalMb: 100, rssMb: 800, isCritical: false, retainedRatio: 0.63 },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Vượt ngưỡng nguy cấp (>85%)',
            input: [1000, { heapUsed: 943718400, external: 52428800, rss: 1048576000 }],
            expected: { heapUsedMb: 900, externalMb: 50, rssMb: 1000, isCritical: true, retainedRatio: 0.9 },
            hidden: false
          },
          {
            name: 'Case 3 (Hidden): Input null -> Ném lỗi',
            input: [1000, null],
            expected: 'ERROR_THROWN',
            hidden: true
          },
          {
            name: 'Case 4 (Hidden): maxHeapMb âm -> Ném lỗi',
            input: [-500, { heapUsed: 100, external: 50, rss: 200 }],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c1-l2',
      title: 'Bài 02: V8 Pipeline: Ignition, TurboFan, Hidden Classes & Deoptimization',
      duration: '60 phút',
      tag: 'V8 Engine Internals',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐÁNH ĐỔI GIỮA INTERPRETATION VÀ JIT SPECULATIVE COMPILATION

Trong thiết kế trình biên dịch hiện đại, các ngôn ngữ tĩnh (C++, Rust, Go) được biên dịch trước (Ahead-Of-Time — AOT) thành mã máy Assembly tối ưu trực tiếp cho tập lệnh CPU. Ngược lại, JavaScript là ngôn ngữ kịch bản có kiểu dữ liệu động (Dynamically Typed) và tuân thủ đặc tả ECMAScript linh hoạt.

Mỗi phép toán đơn giản như \`a + b\` trong JavaScript thực chất đòi hỏi hàng chục lệnh kiểm tra ngầm tại runtime: \`a\` có phải số nguyên không? \`b\` có phải chuỗi cần nối không? Đối tượng có ghi đè hàm \`valueOf()\` hay \`Symbol.toPrimitive\` không? Nếu chỉ dựa vào trình thông dịch tuần tự (Pure Interpreter), JavaScript sẽ chậm hơn C++ từ 50 đến 100 lần.

V8 Engine giải quyết bài toán này bằng **Kiến trúc Pipeline Hai Tầng (Two-Tier Execution Pipeline)**:

* **Tầng 1 - Bytecode Interpreter (Ignition):**
  - Ưu tiên hàng đầu: **Độ trễ khởi động tức thì (Zero Startup Latency)** và **tiết kiệm bộ nhớ (Compact Bytecode Footprint)**.
  - Ignition biên dịch AST thành các chỉ lệnh Bytecode nhỏ gọn và thực thi ngay lập tức. Trong quá trình thông dịch, Ignition gắn các sensor ngầm để thu thập **Vector phản hồi kiểu dữ liệu (Type Feedback Vector)** tại mỗi điểm gọi hàm (Call Site): ghi nhận các kiểu dữ liệu thực tế truyền vào qua các lần chạy.

* **Tầng 2 - Optimizing JIT Compiler (TurboFan):**
  - Khi một hàm được thực thi nhiều lần và đạt ngưỡng tần suất cao (trở thành "Hot Function"), V8 kích hoạt TurboFan để biên dịch hàm đó thành mã máy Assembly nguyên bản.
  - **Tối ưu hóa phỏng đoán (Speculative Optimization):** Dựa vào Type Feedback của Ignition, TurboFan đưa ra giả định lạc quan: *"Hàm này đã được gọi 10,000 lần và luôn nhận vào 2 số nguyên 31-bit (Smi)"*. Nhờ giả định đó, TurboFan loại bỏ toàn bộ các bước kiểm tra kiểu runtime, sinh ra chuỗi lệnh Assembly tối ưu trực tiếp trên CPU registers với hiệu năng tương đương mã C++.

* **Hiện tượng Thoát Lui Ngoại Lệ (Deoptimization Bailout):**
  - Nếu tại lần gọi thứ 10,001, mã nguồn bất ngờ truyền vào một tham số khác kiểu (ví dụ: truyền \`String\` hoặc một Object có cấu trúc thuộc tính bị xáo trộn), giả định của TurboFan lập tức bị sụp đổ.
  - V8 buộc phải kích hoạt cơ chế **Deoptimization (Bailout)**: tái cấu trúc lại khung ngăn xếp (On-Stack Replacement — OSR) từ mã máy tối ưu ngược trở lại khung thông dịch Bytecode của Ignition.
  - Việc rơi vào chu kỳ tối ưu rồi lại hủy tối ưu (Deopt Loop) là nguyên nhân hàng đầu gây ra hiện tượng **CPU Spikes** và **P99 Latency Spikes** bất thường trong các hệ thống Backend Node.js tải cao.

---

# 2. KIẾN TRÚC PIPELINE V8: TỪ AST ĐẾN MÃ MÁY TỐI ƯU

\`\`\`diagram
  JavaScript Source Code
           │
           ▼
     [ V8 Parser ]  ──────────► Abstract Syntax Tree (AST)
           │
           ▼
     [ Ignition ]   ──────────► Bytecode (Thực thi tức thì, thu thập Type Feedback)
           │                           ▲
           │ (Hàm chạy nhiều lần)      │ (Deoptimization: Kiểu dữ liệu bị thay đổi)
           ▼                           │
     [ TurboFan ]   ──────────► Optimized Machine Code (Assembly x86/ARM64)
\`\`\`

1. **Ignition (Bytecode Interpreter):** Nhận AST và sinh ra Bytecode. Ignition vừa chạy vừa thu thập **Phản hồi kiểu động (Type Feedback Vector)** để ghi nhận: hàm này thường nhận kiểu dữ liệu gì? (Smi - Small Integer, Double, String hay Object Shape nào?).
2. **TurboFan (Optimizing Compiler):** Khi một hàm trở nên "Hot" (gọi hàng nghìn lần), TurboFan tận dụng Type Feedback để tạo ra mã máy giả định (Speculative Optimization). Nó loại bỏ toàn bộ các bước kiểm tra kiểu runtime dư thừa của JavaScript.
3. **Deoptimization (Bailout):** Khi giả định bị phá vỡ, V8 thực hiện **On-Stack Replacement (OSR)** đảo ngược: tái cấu trúc lại Call Frame trên Stack từ Machine Code về lại Bytecode Frame của Ignition. Quá trình này tiêu tốn hàng nghìn chu kỳ CPU.

---

# 3. HIDDEN CLASSES (SHAPES) & CƠ CHẾ INLINE CACHING (IC)

Trong C++ hoặc Java, các thuộc tính của một Class có vị trí bộ nhớ cố định (Fixed Memory Offset) được trình biên dịch tính toán từ trước. Truy cập \`user.id\` chỉ đơn giản là đọc địa chỉ \`[base_address + 4_bytes]\`.

Trong JavaScript, Object bản chất là một Dictionary (Hash Map) động. Để đạt tốc độ truy xuất ngang ngửa C++, V8 phát minh ra **Hidden Classes (Maps/Shapes)**:

\`\`\`diagram
KHỞI TẠO ĐÚNG THỨ TỰ (CÙNG CHIA SẺ HIDDEN CLASS TREE):
const user1 = {};         const user2 = {};
user1.id = 101;           user2.id = 102;          ──► Cùng chuyển sang Shape C1 (Offset id = 0)
user1.name = "Hùng";      user2.name = "Lan";      ──► Cùng chuyển sang Shape C2 (Offset name = 8)
==> V8 TỐI ƯU HÓA HOÀN HẢO! Inline Cache HIT 100%! Truy xuất O(1)!

KHỞI TẠO NGƯỢC THỨ TỰ (LỆCH NHÁNH TRANSITION TREE):
const user3 = {};
user3.name = "Minh";  ──► Rẽ nhánh sang Shape C3 mới toanh!
user3.id = 103;       ──► Chuyển tiếp sang Shape C4!
==> BẺ GÃY INLINE CACHING! Biến thành Megamorphic Dictionary Lookup O(N)!
\`\`\`

### Cạm Bẫy Tử Huyệt Làm Sập Hiệu Năng: Dùng Lệnh \`delete obj.prop\`
Khi đại ca dùng lệnh \`delete user.age\`, V8 sẽ bẻ gãy hoàn toàn cấu trúc Transition Tree của Hidden Class. Object lập tức bị đẩy về chế độ **Dictionary Mode (Slow Mode)**. Mọi thao tác đọc ghi thuộc tính bị tụt từ $O(1)$ xuống tra cứu bảng băm $O(N)$, làm sụt giảm thông lượng của API hàng chục lần!

> **Quy Tắc Vàng Của Kỹ Sư:** Luôn khởi tạo các thuộc tính trong constructor theo **cùng một thứ tự nghiêm ngặt**, và gán \`user.age = null\` hoặc \`undefined\` thay vì dùng lệnh \`delete\`!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Cây Chuyển Đổi Trạng Thái Hidden Class (Shape Transition Tree)
\`\`\`diagram
                          [ C0: Empty Object {} ]
                                    │
                                    ├─── Gán: .id = 1
                                    ▼
                         [ C1: Shape { id: offset 0 } ]
                                    │
                                    ├─── Gán: .name = "A"
                                    ▼
                     [ C2: Shape { id: offset 0, name: offset 8 } ]
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Inline Caching (Monomorphic -> Polymorphic -> Megamorphic)
\`\`\`diagram
LẦN GỌI ĐẦU TIÊN (MISS) ──► Tra cứu Shape, ghi nhớ offset vào Call Site Cache
          │
          ▼
MONOMORPHIC (1 Shape duy nhất) ──► HIT 100%! Đọc thẳng offset bộ nhớ O(1)
          │
          ▼ Gặp Shape thứ 2, 3, 4
POLYMORPHIC (2-4 Shapes)       ──► Kiểm tra điều kiện if/else nhỏ trong cache
          │
          ▼ Gặp trên 4 Shapes khác nhau
MEGAMORPHIC (Bão hòa Cache)   ──► BỎ CUỘC! Tra cứu bảng băm chậm chạp O(N)!
\`\`\`

### ⚖️ Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Tối Ưu Mã Nguồn Cho TurboFan)
\`\`\`diagram
                     BẠN ĐANG VIẾT MỘT HÀM XỬ LÝ HÀNG TRIỆU RECORD?
                                           │
                                           ▼
                     Kiểu dữ liệu đầu vào có ổn định không?
                                    /           \\
                                  CÓ             KHÔNG (Lúc nhận number, lúc string)
                                  /                 \\
                                 ▼                   ▼
                     [ MONOMORPHIC FUNCTION ]     [ NGUY CƠ DEOPTIMIZATION! ]
                     - TurboFan sinh Machine Code - Hàm liên tục bị Bailout về Bytecode
                     - Tốc độ tối đa CPU         - CPU tăng vọt, P99 latency cao
                     - Giữ nguyên Shape Object   - Giải pháp: Ép kiểu hoặc tách hàm
\`\`\`

### 📊 Sơ đồ 4: Ma Trận Đánh Đổi Kỹ Thuật (Inline Caching States Matrix)

| Trạng Thái Inline Cache | Số Lượng Shape Ghi Nhớ | Cơ Chế Thực Thi Của V8 | Tốc Độ Truy Xuất Thuộc Tính | Khuyến Nghị Kiến Trúc |
| :--- | :--- | :--- | :--- | :--- |
| **Monomorphic** | Đúng 1 Shape duy nhất | Đọc trực tiếp con trỏ offset $O(1)$ | **Nhanh nhất (Ngang ngửa C++)** | Mục tiêu bắt buộc cho hot path |
| **Polymorphic** | Từ 2 đến 4 Shapes | Duyệt mảng điều kiện ngắn | Nhanh vừa phải | Chấp nhận được ở business logic |
| **Megamorphic** | Trên 4 Shapes khác nhau | Tra cứu bảng băm động $O(N)$ | **Chậm nhất (Tụt 10-20 lần)** | Anti-pattern, cần tái cấu trúc |
      `,
      realCodeSnippet: `// File: src/modules/clinical/transformer/monomorphic-record.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - High-Throughput Monomorphic Data Pipeline
import { Injectable, Logger } from '@nestjs/common';

/**
 * Entity chuẩn Monomorphic Shape cho V8 Engine:
 * - Mọi thuộc tính được khởi tạo trong constructor theo thứ tự nghiêm ngặt.
 * - Các thuộc tính tùy chọn (optional) được gán null thay vì undefined hoặc bỏ qua.
 * - Object.seal() để ngăn ngừa việc thêm động thuộc tính ngoài ý muốn làm vỡ Shape.
 */
export class MedicalRecordEntity {
  public readonly id: number;
  public readonly patientCode: string;
  public readonly diagnosis: string;
  public readonly notes: string | null;
  public readonly archivedAt: Date | null;

  constructor(
    id: number,
    patientCode: string,
    diagnosis: string,
    notes: string | null = null,
    archivedAt: Date | null = null,
  ) {
    this.id = id;
    this.patientCode = patientCode;
    this.diagnosis = diagnosis;
    this.notes = notes;
    this.archivedAt = archivedAt;
    Object.seal(this); // Khóa cấu trúc Shape, ép V8 giữ nguyên Monomorphic Inline Cache
  }
}

@Injectable()
export class MonomorphicRecordPipelineService {
  private readonly logger = new Logger(MonomorphicRecordPipelineService.name);

  /**
   * Pipeline xử lý 1,000,000 bản ghi streaming từ Database / Message Queue.
   * Giữ 100% Monomorphic Inline Caching (O(1) Direct Memory Offset) cho TurboFan.
   */
  public sanitizeAndTransformBatch(rawRecords: Array<Record<string, unknown>>): MedicalRecordEntity[] {
    const total = rawRecords.length;
    const sanitized: MedicalRecordEntity[] = new Array(total);

    for (let i = 0; i < total; i++) {
      const raw = rawRecords[i];
      // Luôn tạo object qua constructor chuẩn để đảm bảo cùng 1 Transition Tree
      sanitized[i] = new MedicalRecordEntity(
        Number(raw.id) || 0,
        String(raw.patientCode || '').trim().toUpperCase(),
        String(raw.diagnosis || 'UNSPECIFIED'),
        raw.notes ? String(raw.notes) : null,
        raw.archivedAt ? new Date(String(raw.archivedAt)) : null,
      );
    }

    return sanitized;
  }
}`,
      quiz: [
        {
          id: 'c1-l2-q1',
          question: 'Tại sao việc gán các thuộc tính của cùng một đối tượng theo các thứ tự khác nhau (ví dụ: { a: 1, b: 2 } so với { b: 2, a: 1 }) lại khiến hiệu năng của V8 Engine bị sụt giảm nghiêm trọng?',
          options: [
            'Vì CPU không thể căn chỉnh (memory alignment) các trường dữ liệu theo bội số của 64-bit, gây ra hiện tượng Unaligned Memory Access ở tầng phần cứng.',
            'Vì V8 tạo ra hai nhánh chuyển đổi Hidden Class (Shapes) hoàn toàn khác nhau từ gốc (Root Shape), dẫn đến việc phá vỡ tính đồng nhất tại các vị trí gọi hàm và làm bão hòa Inline Cache.',
            'Vì bộ phân tích cú pháp (Parser) của V8 phải khởi tạo hai cây trừu tượng cú pháp (AST) riêng biệt, làm tăng gấp đôi dung lượng bộ nhớ dành cho Bytecode của hàm.',
            'Vì Garbage Collector phải thiết lập thêm các rào chắn ghi nhớ (Write Barriers) giữa các thuộc tính để theo dõi con trỏ giữa Young Generation và Old Generation.'
          ],
          correctIndex: 1,
          explanation: 'V8 tối ưu hóa việc truy cập thuộc tính bằng cách giả định các object cùng loại sẽ có cùng Hidden Class (Shape) và offset ô nhớ cố định. Khi khởi tạo lệch thứ tự, V8 rẽ nhánh cây chuyển đổi (Transition Tree), sinh ra các Shapes khác nhau, phá vỡ Monomorphic Inline Cache tại call site và đẩy về Megamorphic.'
        },
        {
          id: 'c1-l2-q2',
          question: 'Cơ chế Deoptimization (Bailout) trong V8 Engine xảy ra trong tình huống điển hình nào sau đây?',
          options: [
            'Khi độ sâu của Call Stack vượt quá giới hạn an toàn của V8 khiến tiến trình phải hủy bỏ hàm đang chạy và chuyển quyền thực thi về cho hàm cha.',
            'Khi phân vùng bộ nhớ Young Generation bị tràn, buộc trình biên dịch JIT phải dừng thực thi mã máy để chờ thuật toán Scavenge dọn dẹp xong.',
            'Khi một hàm đã được TurboFan biên dịch sang mã máy tối ưu dựa trên giả định kiểu (Speculative Optimization) đột ngột nhận vào tham số có Hidden Class hoặc kiểu dữ liệu vi phạm giả định đó.',
            'Khi một hàm đồng bộ thực thi quá 50ms, bộ điều phối tiến trình của Libuv buộc phải hủy tối ưu hóa để trả quyền kiểm soát cho pha Poll của Event Loop.'
          ],
          correctIndex: 2,
          explanation: 'TurboFan tối ưu hóa dựa trên giả định kiểu (Type Speculation thu thập từ Ignition). Nếu một hàm cộng add(a, b) vốn chỉ nhận số nguyên đột nhiên nhận vào một Object hoặc String, giả định bị phá vỡ. TurboFan buộc phải Deoptimize (Bailout): vứt bỏ mã máy đã biên dịch và trả quyền thực thi an toàn về cho bộ thông dịch Ignition Bytecode.'
        },
        {
          id: 'c1-l2-q3',
          question: 'Việc sử dụng lệnh delete user.property trong JavaScript gây tác hại kiến trúc nào đối với các đối tượng cần xử lý với tần suất cao trong V8 Engine?',
          options: [
            'Nó tạo ra các lỗ hổng bộ nhớ cục bộ trên phân vùng Young Generation khiến thuật toán Cheney Scavenge bị rơi vào vòng lặp vô tận.',
            'Nó chỉ xóa giá trị của thuộc tính nhưng giữ lại key trong bảng băm của V8, gây ra hiện tượng rò rỉ bộ nhớ tiềm ẩn cho tiến trình.',
            'Nó kích hoạt một chu kỳ Major GC đồng bộ dừng toàn bộ thế giới (Stop-The-World) để sắp xếp lại cấu trúc bộ nhớ của đối tượng.',
            'Nó bẻ gãy Transition Tree của Hidden Class, ép đối tượng chuyển từ chế độ Fast Properties sang Slow Properties (Dictionary Mode), biến mọi thao tác đọc/ghi thuộc tính thành tra cứu bảng băm chậm chạp.'
          ],
          correctIndex: 3,
          explanation: 'Lệnh delete làm biến đổi cấu trúc Shape của đối tượng một cách đột ngột. V8 không duy trì Transition Tree cho trường hợp xóa thuộc tính mà đẩy thẳng đối tượng về Dictionary Mode (Slow Mode), biến việc đọc thuộc tính từ phép cộng offset O(1) thành tra cứu Hash Table chậm chạp hơn hàng chục lần.'
        },
        {
          id: 'c1-l2-q4',
          question: 'Trạng thái Inline Caching nào sau đây mang lại hiệu năng truy xuất thuộc tính nhanh nhất, tương đương với tốc độ truy xuất ô nhớ trực tiếp (Direct Memory Access) trong ngôn ngữ C/C++?',
          options: [
            'Monomorphic: Vị trí gọi hàm chỉ bắt gặp duy nhất 1 Hidden Class xuyên suốt vòng đời, cho phép CPU đọc dữ liệu trực tiếp tại offset bộ nhớ cố định mà không cần kiểm tra lại cấu trúc đối tượng.',
            'Polymorphic: Vị trí gọi hàm bắt gặp từ 2 đến 4 Hidden Class, cho phép V8 thực hiện tra cứu song song trên các thanh ghi vector SIMD của vi xử lý.',
            'Megamorphic: Vị trí gọi hàm bắt gặp nhiều hơn 4 Hidden Class và lưu trữ địa chỉ vào bảng băm toàn cục (Global Megamorphic Stub Cache) với thời gian tra cứu O(1).',
            'Dictionary Mode: Các thuộc tính được chuyển vào một bảng băm riêng biệt nằm ngay cạnh header của đối tượng để loại bỏ hoàn toàn các bước kiểm tra kiểu.'
          ],
          correctIndex: 0,
          explanation: 'Monomorphic Inline Cache là trạng thái lý tưởng nhất: V8 ghi nhớ chính xác offset bộ nhớ của thuộc tính tại điểm gọi. Ở các lần chạy tiếp theo, CPU đọc thẳng ô nhớ bằng 1 lệnh máy duy nhất (Direct Memory Access) sau một lệnh kiểm tra Shape cực nhanh.'
        },
        {
          id: 'c1-l2-q5',
          question: 'Kiến trúc thực thi hai tầng (Execution Pipeline) của V8 Engine kết hợp giữa bộ thông dịch Ignition và trình biên dịch tối ưu TurboFan theo cơ chế nào?',
          options: [
            'TurboFan biên dịch trước (AOT) toàn bộ mã nguồn sang mã máy khi ứng dụng khởi động, còn Ignition chỉ đóng vai trò thông dịch dự phòng khi phát hiện lỗi cú pháp.',
            'Ignition thông dịch nhanh AST thành Bytecode để giảm độ trễ khởi động đồng thời gắn profiler thu thập dữ liệu kiểu (Type Feedback); TurboFan sử dụng dữ liệu này để biên dịch các hàm được gọi thường xuyên (Hot Functions) thành mã máy tối ưu cao.',
            'Ignition chạy trên một luồng hệ điều hành riêng biệt để phân tích cú pháp mã nguồn, trong khi TurboFan chạy trên một luồng khác để đồng thời ghi trực tiếp mã máy vào bộ nhớ chia sẻ.',
            'TurboFan kiểm tra tính tương thích của kiểu dữ liệu TypeScript trong mã nguồn rồi gửi bytecode đã xác thực về cho Ignition thực thi trực tiếp trên thanh ghi CPU.'
          ],
          correctIndex: 1,
          explanation: 'V8 sử dụng pipeline 2 tầng: Ignition dịch nhanh AST thành Bytecode nhỏ gọn để máy chủ khởi động không có độ trễ (Fast Startup). Trong quá trình chạy, Ignition gắn bộ đếm Profiler và ghi nhận kiểu dữ liệu (Type Feedback). Các hàm chạy nhiều (Hot Code) sẽ được nạp sang TurboFan để dịch thành mã máy x86/ARM tối ưu cao.'
        },
        {
          id: 'c1-l2-q6',
          question: 'Tại sao việc tạo ra Mảng thưa (Holey Array, ví dụ: const arr = []; arr[100] = 1;) lại làm giảm sút nghiêm trọng tốc độ xử lý của V8 Engine so với Mảng đặc (Packed Array)?',
          options: [
            'Vì V8 bắt buộc phải cấp phát toàn bộ 100 ô nhớ liên tục trên RAM vật lý ngay lập tức và điền đầy các byte 0 làm tăng đột biến dung lượng Heap.',
            'Vì V8 tự động chuyển cấu trúc dữ liệu của mảng sang ma trận thưa nén (Compressed Sparse Row), đòi hỏi phải giải nén mỗi khi thực hiện phép lặp qua mảng.',
            'Vì khi truy cập vào các chỉ mục trống (Holes), V8 không thể đọc ô nhớ trực tiếp mà bắt buộc phải duyệt ngược lên chuỗi nguyên mẫu (Array.prototype và Object.prototype) để kiểm tra xem có thuộc tính nào được định nghĩa hay không.',
            'Vì các lỗ hổng trong mảng thưa kích hoạt pha Compacting của Garbage Collector liên tục để dồn các phần tử về đầu mảng.'
          ],
          correctIndex: 2,
          explanation: 'Với Packed Array (PACKED_SMI / PACKED_ELEMENTS), V8 chỉ cần truy xuất bộ nhớ theo công thức: base_address + index * element_size (cực nhanh). Nhưng với Holey Array, nếu một index không có giá trị, V8 phải kiểm tra prototype chain của Array để chắc chắn không có ai định nghĩa property trên prototype. Thao tác kiểm tra này phá vỡ tối ưu hóa truy cập mảng.'
        },
        {
          id: 'c1-l2-q7',
          question: 'Điều gì xảy ra ở cấp độ kiến trúc của V8 khi một vị trí gọi hàm (call site) truy cập thuộc tính trên nhiều hơn 4 cấu trúc Hidden Class khác nhau?',
          options: [
            'Vị trí gọi hàm chuyển sang trạng thái Megamorphic (bão hòa), từ bỏ việc lưu cache cấu trúc cục bộ và buộc phải tra cứu qua một bảng băm toàn cục (Megamorphic Stub Cache), làm gia tăng chi phí thời gian và nguy cơ deoptimization.',
            'V8 tự động giáng cấp toàn bộ các đối tượng tham gia lời gọi hàm về phân vùng Young Generation để thu gom rác dọn dẹp lại cấu trúc.',
            'Trình biên dịch TurboFan xóa bỏ hoàn toàn mã Bytecode của hàm và chuyển về chạy lại từ cây cú pháp trừu tượng (AST) nguyên bản.',
            'V8 tự động hợp nhất 4 Hidden Class đó thành một lớp trừu tượng duy nhất (Virtual Superclass) và chèn vào prototype của các đối tượng.'
          ],
          correctIndex: 0,
          explanation: 'V8 giới hạn Polymorphic Inline Cache ở mức tối đa 4 Shapes. Nếu vượt quá ngưỡng này (ví dụ hàm nhận hàng chục object có cấu trúc khác nhau), call site rơi vào trạng thái Megamorphic. V8 không lưu thêm shape vào IC mà chuyển sang tra cứu Global Hash Table, làm tốc độ suy giảm nghiêm trọng.'
        },
        {
          id: 'c1-l2-q8',
          question: 'Để duy trì trạng thái Monomorphic Inline Cache và ngăn chặn hiện tượng Deoptimization trong các Service xử lý nghiệp vụ nặng của NestJS, kỹ sư backend nên áp dụng mẫu hình nào sau đây?',
          options: [
            'Khởi tạo các đối tượng rỗng {} rồi thêm dần các trường dữ liệu tùy theo các nhánh rẽ điều kiện if/else để tối ưu dung lượng RAM ban đầu.',
            'Sử dụng toán tử delete để chủ động gỡ bỏ các trường nhạy cảm (như mật khẩu, token) ra khỏi đối tượng người dùng trước khi trả về client.',
            'Chuyển đổi đối tượng qua chuỗi JSON bằng JSON.stringify rồi parse lại trước khi truyền sang service khác để chuẩn hóa định dạng.',
            'Luôn định nghĩa đầy đủ tất cả các trường dữ liệu trong Constructor của Class hoặc Factory Function theo một thứ tự cố định, gán giá trị mặc định (null hoặc undefined) cho các trường tùy chọn thay vì thêm động sau này.'
          ],
          correctIndex: 3,
          explanation: 'Quy tắc vàng của V8 Optimization: Luôn khởi tạo đầy đủ thuộc tính trong Constructor theo cùng một thứ tự nhất quán. Nếu một trường chưa có giá trị, hãy khởi tạo nó với null thay vì thêm động (obj.field = value) sau này. Tránh xa toán tử delete vì nó đẩy object về Dictionary Mode.'
        }
      ],
      codeChallenge: {
        title: 'Xây Dựng Monomorphic Object Factory Chống Deoptimization',
        description: 'Viết hàm `createMonomorphicRecord(id, code, metadata)`: Đảm bảo đối tượng trả về LUÔN CÓ ĐỦ 4 thuộc tính theo đúng thứ tự nghiêm ngặt: `id` (number), `code` (string viết hoa), `metadata` (object, nếu rỗng thì là `{}`), `archivedAt` (luôn khởi tạo là `null` để giữ nguyên Shape thay vì thêm động sau này). Nếu `id` hoặc `code` không hợp lệ, ném `Error("INVALID_RECORD_PARAMS")`.',
        starterCode: `function createMonomorphicRecord(id, code, metadata) {
  // Viết logic tạo object monomorphic chuẩn V8
  
}`,
        solution: `function createMonomorphicRecord(id, code, metadata) {
  if (typeof id !== 'number' || isNaN(id) || !code || typeof code !== 'string') {
    throw new Error("INVALID_RECORD_PARAMS");
  }
  return {
    id: id,
    code: code.trim().toUpperCase(),
    metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...metadata } : {},
    archivedAt: null
  };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Tạo record chuẩn Shape',
            input: [101, 'vtth-01', { unit: 'cái' }],
            expected: { id: 101, code: 'VTTH-01', metadata: { unit: 'cái' }, archivedAt: null },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Metadata null -> Gán object rỗng an toàn',
            input: [202, ' thuoc-02 ', null],
            expected: { id: 202, code: 'THUOC-02', metadata: {}, archivedAt: null },
            hidden: false
          },
          {
            name: 'Case 3 (Hidden): ID không phải số -> Ném lỗi',
            input: ['101', 'CODE', {}],
            expected: 'ERROR_THROWN',
            hidden: true
          },
          {
            name: 'Case 4 (Hidden): Code rỗng -> Ném lỗi',
            input: [1, '', {}],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c1-l3',
      title: 'Bài 03: V8 Garbage Collection Internals & Quản Trị Memory Leak Thực Chiến',
      duration: '60 phút',
      tag: 'Garbage Collection & Profiling',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: QUẢN TRỊ BỘ NHỚ TỰ ĐỘNG & ĐỘ TRỄ STOP-THE-WORLD (STW)

Trong phát triển phần mềm Backend, việc quản lý bộ nhớ thủ công (như \`malloc()\` và \`free()\` trong C/C++) trao cho kỹ sư quyền kiểm soát tối đa nhưng đi kèm rủi ro bảo mật nghiêm trọng (Use-After-Free, Buffer Overflow, Double Free). V8 Engine sử dụng cơ chế **Thu gom rác tự động (Automated Garbage Collection — GC)** để quản lý vòng đời bộ nhớ Heap.

Tuy nhiên, trong các hệ thống phân tán và ứng dụng backend hiệu năng cao, cơ chế GC tự động đặt ra một thách thức kỹ thuật lớn: **Hiện tượng Dừng Toàn Bộ Luồng Thực Thi (Stop-The-World Latency)**.

* **Bản chất của Stop-The-World (STW):**
  Khi Garbage Collector cần rà soát đồ thị con trỏ tham chiếu (Root Reference Graph) để xác định object nào còn sống và object nào đã chết, nó bắt buộc phải tạm dừng toàn bộ luồng thực thi JavaScript (V8 Main Thread). Nếu tiến trình GC kéo dài 200ms - 500ms, toàn bộ HTTP requests đến máy chủ trong khoảng thời gian đó đều bị đóng băng, làm vọt chỉ số P99 Latency và gây đứt kết nối WebSocket / gRPC.

* **Giả Thuyết Thế Hệ Yếu (Weak Generational Hypothesis):**
  Các nhà khoa học máy tính nhận thấy một quy luật thực nghiệm phổ quát trong phần mềm: **"Đại đa số các đối tượng trong bộ nhớ chết đi ngay sau khi chúng vừa được tạo ra"**.
  - Trong một dịch vụ Backend NestJS: 95% object sinh ra (Request DTO, URL params, local scope variables, validation errors) chỉ tồn tại trong vòng đời vài mili-giây của một HTTP request và trở thành rác ngay sau khi response được trả về.
  - Chỉ có khoảng 5% object (Database Connection Pool, Cache instances, Singleton Services, cấu hình hệ thống) là có nhu cầu tồn tại lâu dài suốt vòng đời máy chủ.

* **Giải pháp Kiến trúc Phân Tầng Bộ Nhớ (Generational GC Architecture):**
  Dựa trên quy luật trên, V8 chia vùng nhớ Heap thành hai phân vùng tách biệt:
  - **Young Generation (Vùng Nhớ Trẻ):** Kích thước nhỏ (16MB - 64MB). Sử dụng thuật toán **Scavenger** sao chép cực nhanh chỉ trong ~1-2ms, dọn dẹp các object ngắn hạn mà không làm gián đoạn hệ thống.
  - **Old Generation (Vùng Nhớ Già):** Chứa các object sống sót qua nhiều chu kỳ GC. Sử dụng thuật toán **Mark-Sweep-Compact** kết hợp kỹ thuật đánh dấu tăng tiến (Incremental Marking) và xử lý nền song song (Concurrent Sweeping) để triệt tiêu tối đa thời gian dừng luồng STW.

---

# 2. THUẬT TOÁN GC DƯỚI NẮP CA-PÔ: SCAVENGE VS MARK-SWEEP-COMPACT

\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│                           V8 HEAP MEMORY ARCHITECTURE                         │
├────────────────────────────────────────┬──────────────────────────────────────┤
│       YOUNG GENERATION (16MB - 64MB)   │     OLD GENERATION (1GB - 4GB)       │
├───────────────────┬────────────────────┼──────────────────────────────────────┤
│    FROM-SPACE     │     TO-SPACE       │   MARK - SWEEP - COMPACT ALGORITHM   │
│ (Cấp phát mới)    │ (Chứa sống sót)    │ 1. Tri-color Marking (Trắng/Xám/Đen) │
│         │         │                    │ 2. Free-List Sweeping                │
│         └──Scavenge Copying──►         │ 3. Memory Compaction (Chống phân mảnh│
│            (Sống 2 chu kỳ -> Promote)──┼──► [ Thăng cấp lên Old Gen ]         │
└────────────────────────────────────────┴──────────────────────────────────────┘
\`\`\`

### 2.1 Young Generation (Minor GC - Thuật toán Cheney Scavenge)
* Không gian bộ nhớ chia đôi thành 2 bán vùng: **From-Space** và **To-Space**.
* Mọi \`new Object()\` hoặc JSON payload mới đều được cấp phát vào \`From-Space\`.
* Khi \`From-Space\` đầy, Minor GC kích hoạt:
  1. Duyệt cây tham chiếu từ Root.
  2. Sao chép nguyên khối các object còn sống sang \`To-Space\` và xếp liên tục nhau.
  3. Xóa trắng toàn bộ \`From-Space\` cũ chỉ bằng 1 thao tác tịnh tiến con trỏ.
  4. Đảo vai trò của 2 vùng nhớ.
  5. **Promotion (Thăng cấp):** Object sống sót qua 2 chu kỳ Minor GC được chuyển thẳng lên **Old Generation**.

### 2.2 Old Generation (Major GC - Thuật toán Mark-Sweep-Compact)
Dành cho các Singleton Services, Connection Pools, Caches. Quá trình gồm 3 pha:
1. **Tri-color Marking (Đánh dấu 3 màu):**
   * **White (Trắng):** Đối tượng chưa được duyệt tới (ứng viên bị tiêu hủy).
   * **Grey (Xám):** Đối tượng đã chạm tới, nhưng các thuộc tính con chưa được duyệt.
   * **Black (Đen):** Đối tượng và toàn bộ cây con của nó đều đã duyệt xong (chắc chắn còn sống).
2. **Sweeping (Quét rác):** Quét toàn bộ Heap, thu hồi các ô nhớ màu Trắng đưa vào danh sách **Free-List** để chuẩn bị cấp phát tiếp.
3. **Compacting (Chống phân mảnh):** Dịch chuyển vật lý các block màu Đen nằm sát lại với nhau, cập nhật con trỏ trên Stack, dồn toàn bộ ô nhớ trống thành một khối liên tục.

---

# 3. KỸ THUẬT BẮT BỆNH MEMORY LEAK VỚI CHROME DEVTOOLS & HEAP SNAPSHOT

Để tìm ra thủ phạm gây rò rỉ RAM trong NestJS, kỹ sư khởi động Node.js với cờ kiểm định:
\`\`\`bash
node --inspect dist/main.js
\`\`\`
Mở \`chrome://inspect\` trên trình duyệt và chụp **Heap Snapshot**.

### Phân Biệt Hai Chỉ Số Bộ Nhớ Sống Còn:
* **Shallow Size:** Dung lượng bộ nhớ thực tế do chính bản thân đối tượng đó chiếm giữ (thường rất nhỏ, chỉ vài chục đến vài trăm bytes để chứa các thuộc tính trực tiếp).
* **Retained Size:** Tổng dung lượng bộ nhớ sẽ được giải phóng nếu đối tượng này bị xóa sổ và toàn bộ cây tham chiếu độc quyền (Dominator Tree) của nó bị GC thu hồi!
> **Quy Tắc Vàng Của Kỹ Sư:** Một đối tượng có Shallow Size chỉ 128 bytes nhưng Retained Size lên tới **800 Megabytes** chính là "Kẻ cầm đầu" đang giữ chặt tham chiếu ngăn cản GC giải phóng bộ nhớ!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Vòng Đời Của Một Đối Tượng Trong V8 Heap
\`\`\`diagram
[ new Object() ] ──► Cấp phát vào From-Space (Young Gen)
                            │
                   Minor GC kích hoạt?
                   /                 \\
               CHẾT                   SỐNG SÓT
               /                         \\
      [ Thu hồi ngay ]             Sao chép sang To-Space
                                         │
                                 Sống sót qua 2 chu kỳ?
                                 /                    \\
                               CHƯA                   CÓ
                               /                        \\
                    Ở lại Young Gen          [ THĂNG CẤP LÊN OLD GENERATION ]
                                             - Quản lý bởi Mark-Sweep-Compact
\`\`\`

### 🔄 Sơ đồ 2: Dominator Tree & Khái Niệm Retained Size
\`\`\`diagram
┌────────────────────────────────────────────────────────┐
│ Global Object / Root Scope                             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ GlobalEventEmitter (Shallow: 128 Bytes)               │ ◄── RETAINED SIZE: 500MB!
└──────────────┬──────────────────────────┬──────────────┘
               │ Tham chiếu               │ Tham chiếu
               ▼                          ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ HugeArrayA (250MB)           │ │ HugeArrayB (250MB)           │
└──────────────────────────────┘ └──────────────────────────────┘
\`\`\`

### ⚖️ Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chẩn Đoán Sự Cố Tràn Bộ Nhớ RAM)
\`\`\`diagram
                     TIẾN TRÌNH NODE.JS BỊ CRASH DO OUT OF MEMORY (OOM)?
                                             │
                                             ▼
                     Kiểm tra heapUsed so với external memory
                                    /           \\
           heapUsed tăng kịch trần                heapUsed rất thấp (~200MB)
           (Gần ngưỡng max-old-space-size)        nhưng Container vẫn bị OOM Kill
                   /                                             \\
                  ▼                                               ▼
     [ RÒ RỈ TRÊN V8 HEAP ]                          [ RÒ RỈ C++ BUFFER NGOÀI HEAP ]
     - Chụp Heap Snapshot bằng Chrome DevTools       - Kiểm tra Buffer.concat() file lớn
     - Tìm đối tượng có Retained Size lớn nhất        - Chuyển sang dùng Stream (pipe)
     - Khắc phục Closure hoặc EventListener leak     - Tránh giữ Buffer trong biến global
\`\`\`

### 📊 Sơ đồ 4: Ma Trận Đánh Đổi Kỹ Thuật (V8 Garbage Collection Modes)

| Cơ Chế Thu Gom Rác | Tần Suất Kích Hoạt | Thời Gian Dừng Luồng (Stop-the-World) | Không Gian Bộ Nhớ | Thuật Toán Sử Dụng |
| :--- | :--- | :--- | :--- | :--- |
| **Minor GC (Scavenge)** | Rất thường xuyên (mỗi khi đầy From-Space) | Cực ngắn (~1 - 2 mili-giây) | Young Generation (16 - 64MB) | Cheney Copying Algorithm |
| **Major GC (Full GC)** | Hiếm hơn (khi Old Gen đạt ngưỡng) | Dài hơn (~50 - 200 mili-giây) | Old Generation (1 - 4GB) | Tri-color Mark-Sweep-Compact |
| **Incremental Marking** | Chạy xen kẽ từng bước nhỏ với code JS | Giảm thiểu tối đa giật lag luồng chính | Old Generation | Cắt nhỏ pha Marking thành các tick |
      `,
      realCodeSnippet: `// File: src/infrastructure/streaming/sse-connection-leak-guard.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - SSE Connection Registry & Memory Leak Guard
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';

interface ClientContext {
  userId: string;
  tenantId: string;
  connectedAt: number;
}

/**
 * Guard chống Memory Leak cho các kết nối Server-Sent Events (SSE) / WebSocket:
 * - Sử dụng FinalizationRegistry để theo dõi và dọn dẹp khi ClientContext bị GC thu hồi.
 * - Gỡ bỏ Subscription triệt để khi connection đóng để ngăn Closure Retaining Path.
 * - Triển khai OnModuleDestroy để giải phóng toàn bộ socket handlers khi Pod shutdown.
 */
@Injectable()
export class SseConnectionLeakGuardService implements OnModuleDestroy {
  private readonly logger = new Logger(SseConnectionLeakGuardService.name);
  private readonly activeStreams = new Map<string, Subject<unknown>>();
  private readonly subscriptions = new Map<string, Subscription>();

  // FinalizationRegistry thông báo khi một đối tượng bị Garbage Collector thu hồi
  private readonly cleanupRegistry = new FinalizationRegistry<string>((clientId) => {
    this.logger.debug(\`GC đã thu hồi ClientContext của [\${clientId}], dọn dẹp stream...\`);
    this.unregisterClient(clientId);
  });

  public registerClient(clientId: string, context: ClientContext): Subject<unknown> {
    const stream$ = new Subject<unknown>();
    this.activeStreams.set(clientId, stream$);

    // Đăng ký theo dõi GC: Khi client context không còn tham chiếu mạnh, registry sẽ trigger
    this.cleanupRegistry.register(context, clientId);

    // Lưu subscription để chủ động hủy (unsubscribe)
    const sub = stream$.subscribe({
      error: () => this.unregisterClient(clientId),
      complete: () => this.unregisterClient(clientId),
    });
    this.subscriptions.set(clientId, sub);

    return stream$;
  }

  public unregisterClient(clientId: string): void {
    const sub = this.subscriptions.get(clientId);
    if (sub) {
      sub.unsubscribe(); // Cắt đứt hoàn toàn Closure Retaining Path
      this.subscriptions.delete(clientId);
    }

    const stream$ = this.activeStreams.get(clientId);
    if (stream$) {
      stream$.complete();
      this.activeStreams.delete(clientId);
    }
  }

  public onModuleDestroy(): void {
    this.logger.log('Dọn dẹp toàn bộ SSE Connections trước khi Pod shutdown...');
    for (const clientId of this.activeStreams.keys()) {
      this.unregisterClient(clientId);
    }
  }
}`,
      quiz: [
        {
          id: 'c1-l3-q1',
          question: 'Ý nghĩa kỹ thuật chính xác nhất của chỉ số Retained Size khi phân tích Heap Snapshot bằng Chrome DevTools là gì?',
          options: [
            'Dung lượng bộ nhớ thực tế chỉ do bản thân cấu trúc và các giá trị nguyên thủy trực tiếp của đối tượng đó chiếm giữ trên Heap (không tính các đối tượng được trỏ tới).',
            'Tổng dung lượng RAM vật lý của toàn bộ tiến trình Node.js bao gồm cả mã máy C++ và Call Stack tại thời điểm chụp snapshot.',
            'Tổng dung lượng bộ nhớ Heap sẽ được giải phóng ngay lập tức nếu đối tượng này bị xóa bỏ và toàn bộ cây con tham chiếu độc quyền phụ thuộc vào nó (Dominator Tree) bị GC thu hồi.',
            'Tổng dung lượng bộ nhớ của tất cả các đối tượng mà đối tượng này có thể chạm tới, kể cả các đối tượng đang được chia sẻ và tham chiếu bởi các GC Root khác.'
          ],
          correctIndex: 2,
          explanation: 'Shallow Size là kích thước của chính đối tượng. Retained Size là tổng dung lượng của đối tượng đó cộng với toàn bộ các đối tượng phụ thuộc chỉ có thể chạm tới duy nhất thông qua nó (Dominator Tree). Đây là chỉ số quan trọng nhất để phát hiện memory leak vì nó phản ánh lượng RAM thực tế thu hồi được nếu loại bỏ object gốc.'
        },
        {
          id: 'c1-l3-q2',
          question: 'Tại sao thuật toán Cheney Scavenge trong phân vùng Young Generation (Semi-space) lại có tốc độ dọn dẹp cực nhanh (thường chỉ mất vài mili-giây) mà không gây dừng tiến trình lâu?',
          options: [
            'Vì nó dựa trên Giả thuyết thế hệ (hầu hết object chết trẻ), chỉ tốn chi phí sao chép số ít object còn sống từ From-Space sang To-Space và xếp liên tục nhau, sau đó hoán đổi hai vùng nhớ và giải phóng toàn bộ From-Space bằng một thao tác con trỏ.',
            'Vì nó duy trì một bộ đếm con trỏ tham chiếu trên từng ô nhớ của Young Generation, giải phóng ngay lập tức các object có bộ đếm về 0 mà không cần duyệt qua đồ thị bộ nhớ.',
            'Vì nó kích hoạt 16 luồng CPU chạy song song để vừa đánh dấu (Marking) vừa quét dọn (Sweeping) trực tiếp trên toàn bộ không gian địa chỉ bộ nhớ ảo của hệ điều hành.',
            'Vì nó chia nhỏ tiến trình thu gom thành các lát cắt thời gian 1 mili-giây xen kẽ giữa các vòng lặp Event Loop để tránh gây hiện tượng chặn luồng chính.'
          ],
          correctIndex: 0,
          explanation: 'Dựa trên giả thuyết thế hệ (Generational Hypothesis), đa số object trong Young Gen đều chết sau thời gian rất ngắn. Thuật toán Scavenge chỉ tốn công sao chép số ít object còn sống sang To-Space và xếp liên tục nhau (vừa dọn rác vừa chống phân mảnh). Toàn bộ From-Space cũ bị xóa sổ ngay tức thì chỉ bằng một thao tác đảo con trỏ.'
        },
        {
          id: 'c1-l3-q3',
          question: 'Hiện tượng Container Node.js chạy trên Kubernetes Pod bị tiêu diệt đột ngột với trạng thái OOMKilled dù chỉ số heapUsed giám sát được vẫn ở mức rất thấp (< 20% limit) bắt nguồn từ nguyên nhân kiến trúc nào?',
          options: [
            'Thuật toán Mark-Sweep-Compact gặp hiện tượng bế tắc (Deadlock) giữa các luồng thu gom rác nền, khiến Kubernetes Probe hiểu lầm là tiến trình bị treo và gửi lệnh hủy Pod.',
            'Bộ nhớ cấp phát bằng malloc ở tầng C++ ngoài V8 Heap (chẳng hạn như dữ liệu nhị phân của Buffer, Stream chưa xả, hoặc thư viện Native C++) tăng vọt làm tổng RSS vượt quá cgroup memory limit của Container.',
            'Hiện tượng phân mảnh bộ nhớ trong Old Generation khiến V8 không thể cấp phát mảng liên tục, dù tổng dung lượng Heap còn trống nhiều.',
            'Call Stack của các luồng trong Libuv Threadpool bị tràn do đệ quy vô hạn, khiến kernel Linux kích hoạt cơ chế bảo vệ phân trang nhớ và tiêu diệt tiến trình.'
          ],
          correctIndex: 1,
          explanation: 'Buffer trong Node.js được cấp phát ngoài V8 Heap (nằm trong process.memoryUsage().external). Do heapUsed vẫn thấp, V8 không nhận thấy áp lực bộ nhớ và không kích hoạt Major GC kịp thời. Nhưng tổng RAM (RSS) của tiến trình đã vượt quá giới hạn cgroup của Container trên Kubernetes Pod, dẫn đến việc bị Linux OOM Killer gửi tín hiệu SIGKILL.'
        },
        {
          id: 'c1-l3-q4',
          question: 'Vai trò kỹ thuật sống còn của pha Compacting (Dồn ô nhớ) trong thuật toán Mark-Sweep-Compact áp dụng cho phân vùng Old Generation là gì?',
          options: [
            'Nén nội dung dữ liệu của các chuỗi ký tự và buffer lớn trên Heap bằng thuật toán nén LZF/gzip để thu nhỏ footprint bộ nhớ.',
            'Chuyển đổi các con trỏ địa chỉ 64-bit thành con trỏ nén 32-bit (Pointer Compression) nhằm giảm 50% dung lượng chiếm dụng của mảng con trỏ.',
            'Đưa các đối tượng có tần suất truy cập thấp quay trở lại phân vùng Young Generation để chuẩn bị cho chu kỳ thu hồi tiếp theo.',
            'Dịch chuyển các đối tượng còn sống nằm sát lại với nhau về một đầu trang bộ nhớ (Page) và cập nhật lại tất cả con trỏ tham chiếu tới chúng, nhằm triệt tiêu hiện tượng phân mảnh bộ nhớ (Memory Fragmentation).'
          ],
          correctIndex: 3,
          explanation: 'Sau nhiều lần giải phóng các object rải rác (Sweeping), bộ nhớ sẽ bị thủng lỗ chỗ (phân mảnh). Khi cần cấp phát một object lớn liên tục, hệ thống sẽ báo lỗi OOM dù tổng dung lượng trống vẫn đủ. Pha Compacting di dời các object sống lại gần nhau, tạo ra một vùng nhớ trống lớn liên tục.'
        },
        {
          id: 'c1-l3-q5',
          question: 'Tại sao việc sử dụng WeakMap lại là giải pháp tối ưu để lưu trữ metadata gắn kèm các đối tượng mà hoàn toàn không gây ra nguy cơ rò rỉ bộ nhớ (Memory Leak)?',
          options: [
            'Vì WeakMap lưu trữ toàn bộ dữ liệu ở vùng nhớ Off-heap do nhân hệ điều hành quản lý, không chịu sự chi phối hay chiếm dụng hạn mức của V8 Heap.',
            'Vì WeakMap tích hợp sẵn cơ chế đếm thời gian sống (TTL), tự động xóa bỏ các cặp key-value sau một khoảng thời gian không có thao tác đọc/ghi.',
            'Vì các khóa (keys) trong WeakMap chỉ được giữ dưới dạng Tham chiếu yếu (Weak Reference); Garbage Collector không coi WeakMap là một điểm neo giữ sống, khi đối tượng key không còn tham chiếu mạnh nào khác thì sẽ được GC thu hồi và tự động giải phóng luôn giá trị tương ứng.',
            'Vì WeakMap chỉ cho phép sử dụng các giá trị nguyên thủy (number, string, symbol) làm khóa, giúp loại bỏ hoàn toàn việc tạo liên kết tham chiếu giữa các đối tượng.'
          ],
          correctIndex: 2,
          explanation: 'Trong Map thông thường, object key được giữ bằng một Strong Reference, ngăn GC thu hồi ngay cả khi toàn bộ ứng dụng không còn dùng object đó nữa. WeakMap chỉ giữ Weak Reference: GC không coi WeakMap là một root sống. Khi đối tượng key không còn tham chiếu nào khác, GC lập tức dọn dẹp nó.'
        },
        {
          id: 'c1-l3-q6',
          question: 'Lỗi rò rỉ bộ nhớ (Memory Leak) kinh điển khi sử dụng EventEmitter trong các Service của NestJS xảy ra do cơ chế ngầm nào sau đây?',
          options: [
            'Do mỗi sự kiện phát ra từ EventEmitter đều sao chép toàn bộ payload thành một đối tượng Buffer C++ mới mà không tự động giải phóng sau khi truyền qua các listener.',
            'Do các hàm callback của listener được đẩy liên tục vào Microtask Queue của V8 khiến Event Loop bị bế tắc và không thể chuyển sang pha tiếp theo.',
            'Do khi vượt quá giới hạn 10 listeners mặc định, EventEmitter tự động sao lưu toàn bộ Call Stack vào bộ nhớ Heap trước khi in ra cảnh báo.',
            'Do đăng ký listener (emitter.on) trong hàm xử lý request mà không gỡ bỏ (removeListener); hàm callback giữ closure scope của request và bị đối tượng Emitter sống lâu (Singleton) lưu giữ vĩnh viễn trong mảng nội bộ.'
          ],
          correctIndex: 3,
          explanation: 'Khi đăng ký emitter.on(\'event\', callback) trong một request handler, mỗi request lại tạo thêm 1 listener mới. Do emitter thường là một Singleton Service (sống suốt đời tiến trình), nó lưu các hàm callback này vào mảng nội bộ. Mỗi callback lại giữ tham chiếu tới toàn bộ biến của request (closure). Kết quả là RAM tăng dần đều cho tới khi sập máy chủ.'
        },
        {
          id: 'c1-l3-q7',
          question: 'Tại sao thuật toán Mark-Sweep (Tracing Garbage Collection) của V8 Engine lại giải quyết triệt để vấn đề tham chiếu vòng (Circular Reference, ví dụ: Object A trỏ Object B và B trỏ ngược lại A) mà thuật toán Reference Counting trước đây bị thất bại?',
          options: [
            'Vì V8 sử dụng thuật toán Tarjan tìm thành phần liên thông mạnh (SCC) để chủ động phát hiện và bẻ gãy các chu trình tham chiếu ngay tại thời điểm gán thuộc tính.',
            'Vì Mark-Sweep bắt đầu duyệt đồ thị từ tập hợp các GC Roots (Global Object, Call Stack, CPU Registers); nếu cụm đối tượng tham chiếu vòng bị cô lập và không có đường đi từ bất kỳ GC Root nào, chúng sẽ không được đánh dấu (Unmarked) và toàn bộ cụm sẽ bị thu hồi.',
            'Vì V8 tự động chuyển đổi một trong hai liên kết tham chiếu vòng thành tham chiếu yếu (Weak Reference) nếu nhận thấy hai đối tượng cùng thuộc một phạm vi hàm.',
            'Vì V8 tách hai đối tượng tham chiếu vòng sang hai phân vùng bộ nhớ vật lý độc lập để ngăn chặn việc đếm trùng lặp số lượng con trỏ.'
          ],
          correctIndex: 1,
          explanation: 'Thuật toán Reference Counting chỉ đếm số lượng con trỏ: A trỏ B (count=1), B trỏ A (count=1). Khi ngắt kết nối với ứng dụng, count vẫn là 1 nên không bao giờ được giải phóng (rò rỉ). Ngược lại, Mark-Sweep bắt đầu duyệt từ GC Roots: bất kỳ node nào không thể đi tới từ Roots đều bị coi là rác (Dead Objects) và bị quét dọn sạch sẽ.'
        },
        {
          id: 'c1-l3-q8',
          question: 'Trong báo cáo Heap Snapshot của Chrome DevTools, chỉ số "Distance" (Khoảng cách) của một đối tượng mang ý nghĩa kỹ thuật chuẩn xác nào?',
          options: [
            'Chiều dài đường đi ngắn nhất (Shortest Path Hops) trên đồ thị tham chiếu từ bất kỳ GC Root nào để chạm tới đối tượng đó; chỉ số này càng nhỏ chứng tỏ đối tượng càng gần với điểm neo giữ gốc của bộ nhớ.',
            'Khoảng cách tính bằng số byte địa chỉ bộ nhớ tương đối từ chân trang nhớ (Page Base Address) đến ô nhớ bắt đầu của đối tượng trên Heap.',
            'Số lượng mắt xích kế thừa trên chuỗi nguyên mẫu (Prototype Chain) từ đối tượng hiện tại ngược lên tới Object.prototype.',
            'Độ sâu của đối tượng trong Dominator Tree tính từ điểm nút lá (Leaf Node) của đồ thị bộ nhớ ngược lên nút cha trực tiếp.'
          ],
          correctIndex: 0,
          explanation: 'Distance biểu thị số bước đi ngắn nhất trên đồ thị tham chiếu từ một GC Root tới đối tượng. Distance = 1 nghĩa là đối tượng được giữ trực tiếp bởi GC Root (ví dụ biến global hoặc stack variable). Khi debug memory leak, đối tượng có Distance ngắn thường là điểm mấu chốt đang neo giữ các cụm rác lớn.'
        }
      ],
      codeChallenge: {
        title: 'Xây Dựng Cache Tự Dọn Dẹp Với Giới Hạn Dung Lượng',
        description: 'Viết class `BoundedCache(maxSize)`: Có 2 phương thức: `set(key, value)` và `get(key)`. Khi số lượng key đạt ngưỡng `maxSize`, nếu thêm key mới thì tự động loại bỏ (evict) key ít được sử dụng nhất gần đây (LRU - Least Recently Used) để chống tràn bộ nhớ Heap. Phương thức `size()` trả về số lượng item hiện tại.',
        starterCode: `class BoundedCache {
  constructor(maxSize) {
    // Khởi tạo cache
  }

  set(key, value) {
    // Lưu và dọn dẹp nếu đầy
  }

  get(key) {
    // Đọc và cập nhật thứ tự truy cập
  }

  size() {
    // Trả về kích thước
  }
}`,
        solution: `class BoundedCache {
  constructor(maxSize) {
    if (typeof maxSize !== 'number' || maxSize <= 0) {
      throw new Error("INVALID_MAX_SIZE");
    }
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  size() {
    return this.cache.size;
  }
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Hoạt động cơ bản và eviction LRU',
            input: [
              2,
              [
                ['set', 'a', 1],
                ['set', 'b', 2],
                ['set', 'c', 3], // Đầy -> Xóa 'a'
                ['get', 'a'],    // Phải là undefined
                ['get', 'b'],    // Phải là 2
                ['size']         // Phải là 2
              ]
            ],
            expected: [undefined, 2, 2],
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Cập nhật vị trí khi get',
            input: [
              2,
              [
                ['set', 'a', 1],
                ['set', 'b', 2],
                ['get', 'a'],    // 'a' được dùng -> 'b' trở thành cũ nhất
                ['set', 'c', 3], // Đầy -> Xóa 'b'
                ['get', 'b'],    // Phải là undefined
                ['get', 'a']     // Phải là 1
              ]
            ],
            expected: [1, undefined, 1],
            hidden: false
          },
          {
            name: 'Case 3 (Hidden): maxSize <= 0 -> Ném lỗi',
            input: [0, []],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    }
  ]
};
