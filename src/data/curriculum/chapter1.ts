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
      realCodeSnippet: `// Trích đoạn mã theo dõi mức tiêu thụ bộ nhớ Resident Set Size (RSS) chuẩn mực
import { memoryUsage } from 'node:process';

export function logMemoryTelemetry(context: string) {
  const usage = memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

  console.log(\`[\${context}] Memory Telemetry:\`);
  console.log(\` - RSS (Toàn bộ RAM tiến trình): \${toMB(usage.rss)} MB\`);
  console.log(\` - Heap Total (V8 cấp phát):      \${toMB(usage.heapTotal)} MB\`);
  console.log(\` - Heap Used (Dữ liệu thực tế):   \${toMB(usage.heapUsed)} MB\`);
  console.log(\` - External (C++ Malloc/Buffer):   \${toMB(usage.external)} MB\`);
}`,
      quiz: [
        {
          id: 'c1-l1-q1',
          question: 'Tại sao mô hình đa luồng truyền thống (Thread-per-Request) bị sụp đổ khi phải đối mặt với Bài toán C10K (10,000 kết nối đồng thời)?',
          options: [
            'Vì giao thức TCP bắt buộc phải ngắt kết nối mạng ngay lập tức nếu phát hiện máy chủ có nhiều hơn 1,000 luồng hệ điều hành.',
            'Vì mỗi OS Thread tiêu tốn 1-2MB RAM Stack và chi phí Context Switching làm tiêu hao phần lớn công suất tính toán của CPU.',
            'Vì cơ sở dữ liệu quan hệ PostgreSQL chỉ cho phép tối đa 50 luồng kết nối đồng thời từ toàn bộ các máy chủ ứng dụng bên ngoài.',
            'Vì bảng phân trang bộ nhớ ảo của hệ điều hành Linux tự động khóa cứng toàn bộ tiến trình nếu vượt quá 100 luồng chạy song song.'
          ],
          correctIndex: 1,
          explanation: 'Mỗi thread của Linux cần 1-2MB bộ nhớ Stack riêng. 10,000 kết nối làm mất 10-20GB RAM chỉ để chứa call stack rỗng. Đồng thời, CPU tốn hơn 70% thời gian chỉ để lưu/nạp thanh ghi và làm mất hiệu lực CPU Cache (Context Switching Overhead).'
        },
        {
          id: 'c1-l1-q2',
          question: 'Chỉ số memoryUsage().external trong Node.js phản ánh phân vùng bộ nhớ thực tế nào sau đây của tiến trình?',
          options: [
            'Dung lượng bộ nhớ tạm thời được hệ điều hành hoán đổi (swap) sang ổ cứng SSD khi máy chủ bị cạn kiệt RAM vật lý.',
            'Tổng dung lượng dữ liệu đang được lưu trữ trên cụm máy chủ Redis Cache phân tán được kết nối qua đường truyền mạng.',
            'Bộ nhớ được cấp phát ngoài V8 Heap thông qua hàm malloc trực tiếp tại tầng C++ của Node.js (dành cho Buffer, Crypto).',
            'Dung lượng các tệp tin hình ảnh và tài liệu tĩnh được lưu trữ trong thư mục public của ứng dụng web đang vận hành.'
          ],
          correctIndex: 2,
          explanation: 'Chỉ số external phản ánh bộ nhớ C++ malloc nằm ngoài V8 Heap. Điển hình nhất là các đối tượng Buffer: trên V8 Heap nó chỉ là wrapper nhỏ ~32 bytes, nhưng dữ liệu nhị phân thực tế lại nằm trong vùng nhớ external C++ này.'
        },
        {
          id: 'c1-l1-q3',
          question: 'Khác biệt căn bản nhất giữa việc giải phóng bộ nhớ trên Stack Memory và Heap Memory của V8 Engine là gì?',
          options: [
            'Stack được giải phóng tức thì thông qua việc dịch chuyển con trỏ Stack Pointer của CPU, còn Heap cần Garbage Collector quét dọn.',
            'Stack đòi hỏi thuật toán Mark-Sweep-Compact phức tạp chạy định kỳ, còn Heap tự động được dọn sạch sau mỗi lời gọi hàm kết thúc.',
            'Stack lưu trữ toàn bộ các đối tượng mảng lớn và instance của class, còn Heap chỉ lưu trữ các số nguyên 31-bit kiểu con trỏ.',
            'Stack có thể mở rộng kích thước vô hạn theo dung lượng RAM của máy chủ, còn Heap bị giới hạn cố định ở mức 64 kilobytes duy nhất.'
          ],
          correctIndex: 0,
          explanation: 'Stack Memory hoạt động theo cơ chế LIFO: khi một hàm kết thúc, con trỏ Stack Pointer của CPU chỉ việc lùi lại (pop stack) để giải phóng toàn bộ vùng nhớ của hàm đó trong 1 chu kỳ xung nhịp. Heap Memory phân bổ động nên bắt buộc phải có GC chạy thuật toán quét đồ thị tham chiếu phức tạp.'
        },
        {
          id: 'c1-l1-q4',
          question: 'Hiện tượng CPU Cache Thrashing (mất hiệu lực bộ nhớ đệm CPU L1/L2) xảy ra nghiêm trọng nhất trong tình huống nào?',
          options: [
            'Khi mã nguồn JavaScript thực thi các câu lệnh toán học thuần túy trên các biến nguyên thủy nằm cố định trong bộ nhớ Stack.',
            'Khi máy chủ backend nhận một gói tin HTTP Request có chứa phần tiêu đề Authorization dài hơn giới hạn quy định của Nginx.',
            'Khi cơ sở dữ liệu PostgreSQL thực hiện quét toàn bộ bảng dữ liệu không có chỉ mục thông qua lệnh Sequential Scan.',
            'Khi hệ thống có quá nhiều luồng hệ điều hành tranh chấp và CPU phải liên tục chuyển đổi ngữ cảnh (Context Switching) giữa các thread.'
          ],
          correctIndex: 3,
          explanation: 'Khi CPU chuyển từ Thread A sang Thread B, dữ liệu của Thread A trên L1/L2 Cache trở nên vô dụng và bị đẩy ra ngoài để nạp dữ liệu của Thread B vào. Khi nhảy lại Thread A, CPU lại bị Cache Miss và phải đọc từ RAM (chậm hơn 100 lần). Đây là lý do kiến trúc đơn luồng Event Loop của Node.js lại có Cache Locality vượt trội.'
        },
        {
          id: 'c1-l1-q5',
          question: 'Tại sao việc lưu trữ dữ liệu của request vào thuộc tính của một Singleton Service trong NestJS (ví dụ: this.currentUser = req.user) lại dẫn đến sự cố bảo mật nghiêm trọng (P0)?',
          options: [
            'Do NestJS sẽ tự động đóng kết nối cơ sở dữ liệu nếu phát hiện thuộc tính class bị biến đổi trong lúc xử lý request.',
            'Do V8 Engine sẽ tự động chuyển tiến trình sang chế độ Read-Only và từ chối ghi nhận thêm bất kỳ request HTTP nào tiếp theo.',
            'Do NestJS Provider mặc định có phạm vi Singleton (chia sẻ chung 1 instance trên toàn tiến trình), dữ liệu của request này sẽ ghi đè và rò rỉ sang các request của người dùng khác (Cross-tenant Data Bleed).',
            'Do hệ điều hành Linux sẽ ngắt quyền thực thi của tiến trình Node.js vì vi phạm quy tắc phân bổ bộ nhớ Stack an toàn.'
          ],
          correctIndex: 2,
          explanation: 'Trong kiến trúc Long-Running Process của NestJS, các Service mặc định là Singleton. Mọi request đều dùng chung một instance duy nhất. Nếu lưu state của request vào thuộc tính instance, biến này sẽ tồn tại suốt vòng đời tiến trình và bị các request đồng thời khác đọc/ghi đè, dẫn đến rò rỉ dữ liệu người dùng cực kỳ nguy hiểm.'
        },
        {
          id: 'c1-l1-q6',
          question: 'Cơ chế nào ở tầng nhân hệ điều hành (OS Kernel) giúp Libuv và Node.js giám sát hàng chục nghìn kết nối mạng đồng thời mà không làm tiêu hao chu kỳ CPU khi các kết nối đang rảnh rỗi (Idle)?',
          options: [
            'Cơ chế Busy Waiting liên tục duyệt qua mảng socket trong vòng lặp while(true) với tần số 1 tỷ lần mỗi giây.',
            'Hệ thống I/O Multiplexing hướng sự kiện (epoll trên Linux, kqueue trên macOS) cho phép luồng chính ngủ và chỉ thức giấc khi kernel thông báo có dữ liệu sẵn sàng trên socket.',
            'Việc ép buộc mỗi card mạng phần cứng (NIC) phải tích hợp sẵn một bộ vi xử lý JavaScript V8 thu nhỏ để xử lý gói tin TCP.',
            'Cơ chế hoán đổi bộ nhớ (RAM Paging) liên tục lưu dữ liệu của các socket rảnh rỗi vào ổ cứng SSD của máy chủ.'
          ],
          correctIndex: 1,
          explanation: 'Node.js đạt hiệu năng C10K nhờ Libuv sử dụng các syscall I/O Multiplexing phi chặn của Kernel (epoll trên Linux, kqueue trên macOS/BSD, IOCP trên Windows). Thay vì tốn CPU thăm dò, hệ điều hành sẽ đưa tiến trình vào trạng thái ngủ và chỉ đánh thức Event Loop khi có sự kiện mạng thực sự xảy ra trên socket.'
        },
        {
          id: 'c1-l1-q7',
          question: 'Khi dung lượng Old Generation của V8 Heap chạm ngưỡng giới hạn mặc định (~1.4GB trên máy chủ 64-bit), điều gì sẽ xảy ra và cờ tham số nào của Node.js giúp mở rộng giới hạn này?',
          options: [
            'Node.js tự động nén toàn bộ RAM sang ổ cứng và tiếp tục chạy mà không làm giảm tốc độ; điều chỉnh qua cờ --enable-swap.',
            'Hệ thống tự động kích hoạt tiến trình con Worker Thread mới để gánh bớt RAM; điều chỉnh qua cờ --auto-fork-memory.',
            'V8 Engine tự động xóa sạch toàn bộ mã nguồn của ứng dụng để giải phóng dung lượng; điều chỉnh qua cờ --clear-code-cache.',
            'Tiến trình crash tức thì với lỗi "JavaScript heap out of memory"; có thể mở rộng bằng cờ --max-old-space-size=<MB>.'
          ],
          correctIndex: 3,
          explanation: 'Mặc định trên kiến trúc 64-bit, V8 giới hạn Old Generation ở mức ~1.4GB để đảm bảo thời gian tạm dừng thu gom rác (GC pause time) không vượt quá ngưỡng chấp nhận được của trình duyệt. Trên máy chủ backend, nếu cần xử lý dữ liệu lớn, ta dùng cờ --max-old-space-size=4096 (để cấp 4GB RAM) hoặc cấu hình trong môi trường container.'
        },
        {
          id: 'c1-l1-q8',
          question: 'Ý nghĩa kỹ thuật chính xác của chỉ số Resident Set Size (RSS) khi so sánh với Heap Total trong telemetry của Node.js là gì?',
          options: [
            'RSS là tổng dung lượng RAM vật lý thực tế mà tiến trình đang chiếm giữ (bao gồm V8 Heap, mã máy C++, Buffer, và Call Stack), trong khi Heap Total chỉ là bộ nhớ ảo do V8 quản lý.',
            'RSS là dung lượng lưu trữ còn trống trên ổ cứng SSD của máy chủ, trong khi Heap Total là dung lượng RAM của toàn bộ hệ điều hành.',
            'RSS là số lượng kết nối WebSocket đang hoạt động đồng thời, trong khi Heap Total là số lượng câu truy vấn SQL đang chờ thực thi.',
            'RSS chỉ tồn tại trên hệ điều hành Windows, trong khi Heap Total chỉ tồn tại trên các bản phân phối của Linux Ubuntu và Alpine.'
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
      realCodeSnippet: `// Đoạn mã đo lường thực tế sự chênh lệch giữa Monomorphic và Deoptimized Shapes
import { performance } from 'node:perf_hooks';

interface UserEntity {
  id?: number;
  role?: string;
}

export function runShapeBenchmark() {
  const TOTAL = 1_000_000;

  // 1. Monomorphic: Thứ tự thuộc tính cố định tuyệt đối
  const startMono = performance.now();
  const arrMono: UserEntity[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const u: UserEntity = {};
    u.id = i;
    u.role = 'DOCTOR';
    arrMono.push(u);
  }
  const timeMono = performance.now() - startMono;

  // 2. Deopt: Thứ tự thuộc tính bị đảo lộn -> sinh ra 2 Hidden Classes khác nhau
  const startDeopt = performance.now();
  const arrDeopt: UserEntity[] = [];
  for (let i = 0; i < TOTAL; i++) {
    const u: UserEntity = {};
    if (i % 2 === 0) {
      u.id = i;
      u.role = 'DOCTOR';
    } else {
      u.role = 'DOCTOR'; // Đảo ngược thứ tự!
      u.id = i;
    }
    arrDeopt.push(u);
  }
  const timeDeopt = performance.now() - startDeopt;

  console.log(\`Monomorphic Time: \${timeMono.toFixed(2)} ms\`);
  console.log(\`Deoptimized Time: \${timeDeopt.toFixed(2)} ms (Chậm hơn \${(timeDeopt / timeMono).toFixed(1)}x!)\`);
}`,
      quiz: [
        {
          id: 'c1-l2-q1',
          question: 'Tại sao việc khởi tạo các thuộc tính của cùng một đối tượng theo các thứ tự khác nhau lại khiến hiệu năng của V8 Engine bị sụt giảm nghiêm trọng?',
          options: [
            'Nó buộc trình biên dịch TypeScript phải nạp lại toàn bộ file khai báo kiểu d.ts từ đĩa cứng trong lúc ứng dụng đang chạy.',
            'Nó tạo ra các nhánh chuyển đổi Hidden Class khác nhau, làm bão hòa Inline Caching và ép V8 tra cứu bảng băm động O(N).',
            'Nó làm cho bộ nhớ Stack của hệ điều hành bị phân mảnh khiến con trỏ Stack Pointer phải đảo chiều liên tục giữa các hàm.',
            'Nó kích hoạt cơ chế khóa bảng dữ liệu của PostgreSQL do nhận thấy các trường dữ liệu JSON bị hoán đổi vị trí bộ nhớ.'
          ],
          correctIndex: 1,
          explanation: 'V8 tối ưu hóa việc truy cập thuộc tính bằng cách giả định các object cùng loại sẽ có cùng Hidden Class (Shape) và offset cố định. Khi khởi tạo lệch thứ tự, V8 sinh ra các Shape khác nhau, phá vỡ Inline Caching từ Monomorphic sang Megamorphic, khiến truy xuất chậm hơn nhiều lần.'
        },
        {
          id: 'c1-l2-q2',
          question: 'Cơ chế Deoptimization (Bailout) trong V8 Engine xảy ra trong tình huống điển hình nào sau đây?',
          options: [
            'Khi dung lượng phân vùng Old Generation vượt quá hạn mức cho phép khiến toàn bộ mã máy của tiến trình bị xóa khỏi RAM.',
            'Khi hệ điều hành Linux gửi tín hiệu phần cứng cảnh báo quạt tản nhiệt của CPU máy chủ đang quay vượt quá tốc độ an toàn.',
            'Khi một hàm đã được TurboFan biên dịch sang mã máy tối ưu đột ngột nhận vào tham số có kiểu dữ liệu khác với Type Feedback trước đó.',
            'Khi một câu lệnh truy vấn bất đồng bộ await bị timeout do đường truyền mạng giữa backend và database bị đứt cáp.'
          ],
          correctIndex: 2,
          explanation: 'TurboFan tối ưu hóa dựa trên giả định kiểu (Type Speculation). Nếu một hàm cộng add(a, b) vốn chỉ nhận số nguyên đột nhiên nhận vào một Object hoặc String, giả định bị phá vỡ. TurboFan buộc phải Deoptimize: vứt bỏ mã máy và trả quyền thực thi về cho Ignition Bytecode.'
        },
        {
          id: 'c1-l2-q3',
          question: 'Lệnh delete user.property trong JavaScript gây tác hại kiến trúc nào đối với các đối tượng cần xử lý với hiệu năng cao?',
          options: [
            'Nó lập tức kích hoạt chu kỳ Major GC khiến toàn bộ tiến trình Node.js bị đóng băng trong khoảng thời gian 5 giây.',
            'Nó xóa vĩnh viễn vùng nhớ Stack của luồng chính khiến toàn bộ các biến cục bộ xung quanh bị biến thành undefined.',
            'Nó làm vô hiệu hóa khả năng giao tiếp của Libuv với các socket mạng của hệ điều hành thông qua epoll event loop.',
            'Nó bẻ gãy Transition Tree của Hidden Class, ép đối tượng chuyển sang Dictionary Mode và làm chậm mọi thao tác đọc ghi.'
          ],
          correctIndex: 3,
          explanation: 'Lệnh delete làm biến đổi cấu trúc Shape của đối tượng một cách đột ngột. V8 không duy trì Transition Tree cho trường hợp xóa thuộc tính mà đẩy thẳng đối tượng về Dictionary Mode (Slow Mode), biến việc đọc thuộc tính thành tra cứu Hash Table chậm chạp.'
        },
        {
          id: 'c1-l2-q4',
          question: 'Trạng thái Inline Caching nào sau đây mang lại hiệu năng truy xuất thuộc tính tương đương với ngôn ngữ biên dịch C++?',
          options: [
            'Monomorphic: Khi tại vị trí gọi hàm chỉ bắt gặp duy nhất một Hidden Class (Shape) cố định xuyên suốt vòng đời.',
            'Megamorphic: Khi tại vị trí gọi hàm bắt gặp hàng chục Hidden Class khác nhau được phân bổ ngẫu nhiên từ client.',
            'Polymorphic: Khi tại vị trí gọi hàm bắt gặp từ 2 đến 4 cấu trúc Hidden Class khác nhau trong danh sách liên kết.',
            'Heterogeneous: Khi các thuộc tính của đối tượng được lưu trữ phân tán trên các luồng Worker Threads độc lập.'
          ],
          correctIndex: 0,
          explanation: 'Monomorphic Inline Cache là trạng thái lý tưởng nhất: V8 ghi nhớ chính xác offset bộ nhớ của thuộc tính tại điểm gọi. Ở các lần chạy tiếp theo, CPU đọc thẳng ô nhớ bằng 1 lệnh máy duy nhất (Direct Memory Access) mà không tốn bất kỳ bước kiểm tra nào.'
        },
        {
          id: 'c1-l2-q5',
          question: 'Kiến trúc thực thi hai tầng (Two-Tier Execution Pipeline) hiện đại của V8 Engine bao gồm bộ thông dịch Ignition và trình tối ưu TurboFan phối hợp với nhau theo nguyên lý nào?',
          options: [
            'Ignition chỉ thực thi mã nguồn viết bằng TypeScript, còn TurboFan chỉ thực thi các tệp tin cấu hình YAML của hệ thống.',
            'Ignition sinh ra Bytecode nhanh chóng để ứng dụng khởi động tức thì và thu thập phản hồi kiểu (Type Feedback); sau đó TurboFan dùng dữ liệu này để biên dịch các hàm thường xuyên được gọi (Hot Code) thành mã máy cực nhanh.',
            'TurboFan chạy trước để quét lỗi cú pháp của toàn bộ dự án, sau đó Ignition mới tiến hành cấp phát bộ nhớ RAM trên máy chủ.',
            'Hai bộ phận này chạy hoàn toàn độc lập trên hai máy chủ vật lý khác nhau và đồng bộ trạng thái qua giao thức gRPC.'
          ],
          correctIndex: 1,
          explanation: 'V8 sử dụng pipeline 2 tầng: Ignition dịch nhanh AST thành Bytecode nhỏ gọn để máy chủ khởi động không có độ trễ (Fast Startup). Trong quá trình chạy, Ignition gắn bộ đếm Profiler và ghi nhận kiểu dữ liệu (Type Feedback). Các hàm chạy nhiều (Hot Code) sẽ được nạp sang TurboFan để dịch thành mã máy x86/ARM tối ưu cao.'
        },
        {
          id: 'c1-l2-q6',
          question: 'Tại sao việc tạo ra Mảng thưa (Holey Array, ví dụ: arr[100] = 1 khi mảng đang rỗng) lại làm giảm hiệu năng xử lý của V8 Engine so với Mảng đặc (Packed Array)?',
          options: [
            'Vì hệ điều hành Linux sẽ khóa luồng thực thi của tiến trình trong 10ms để dọn dẹp các ô nhớ trống trên đĩa cứng.',
            'Vì V8 tự động chuyển đổi toàn bộ mảng dữ liệu sang chuỗi ký tự nhị phân Base64 làm tiêu hao băng thông mạng nội bộ.',
            'Vì khi gặp các ô nhớ trống (Holes), V8 bắt buộc phải duyệt ngược lên chuỗi nguyên mẫu Array.prototype để kiểm tra xem có thuộc tính nào được định nghĩa sẵn hay không, làm mất khả năng đọc trực tiếp ô nhớ.',
            'Vì trình thu gom rác Garbage Collector sẽ lập tức kích hoạt chu kỳ Stop-The-World để xóa sổ các chỉ mục chưa được gán giá trị.'
          ],
          correctIndex: 2,
          explanation: 'Với Packed Array (PACKED_SMI / PACKED_ELEMENTS), V8 chỉ cần truy xuất bộ nhớ theo công thức: base_address + index * element_size (cực nhanh). Nhưng với Holey Array, nếu một index không có giá trị, V8 phải kiểm tra prototype chain của Array để chắc chắn không có ai định nghĩa property trên prototype. Thao tác kiểm tra này phá vỡ tối ưu hóa truy cập mảng.'
        },
        {
          id: 'c1-l2-q7',
          question: 'Điều gì xảy ra với Inline Cache (IC) khi một vị trí gọi hàm (call site) bắt gặp nhiều hơn 4 cấu trúc Hidden Class (Shapes) khác nhau?',
          options: [
            'Inline Cache chuyển sang trạng thái Megamorphic (bão hòa), từ bỏ việc cache cục bộ và chuyển sang tra cứu trên bảng băm toàn cục (Global Megamorphic Stub Cache) chậm hơn rất nhiều.',
            'V8 Engine sẽ lập tức dừng tiến trình và trả về mã lỗi 500 Internal Server Error cho toàn bộ các request tiếp theo.',
            'Hệ thống tự động ép toàn bộ các đối tượng về cùng một kiểu dữ liệu Boolean để bảo vệ bộ nhớ cache L1 của CPU.',
            'Trình biên dịch TurboFan tự động xóa các thuộc tính dư thừa của đối tượng để đưa số lượng Shape trở về mức 1.'
          ],
          correctIndex: 0,
          explanation: 'V8 giới hạn Polymorphic Inline Cache ở mức tối đa 4 Shapes. Nếu vượt quá ngưỡng này (ví dụ hàm nhận hàng chục object có cấu trúc khác nhau), call site rơi vào trạng thái Megamorphic. V8 không lưu thêm shape vào IC mà chuyển sang tra cứu Global Hash Table, làm tốc độ suy giảm nghiêm trọng.'
        },
        {
          id: 'c1-l2-q8',
          question: 'Để duy trì trạng thái Monomorphic và ngăn chặn Deoptimization trong NestJS backend, kỹ sư nên tuân thủ quy tắc lập trình nào sau đây?',
          options: [
            'Thường xuyên sử dụng toán tử delete để xóa các thuộc tính không cần thiết nhằm giảm dung lượng bộ nhớ của object.',
            'Liên tục thay đổi thứ tự các trường dữ liệu trong DTO để kiểm tra tính linh hoạt của trình biên dịch TypeScript.',
            'Chuyển đổi tất cả các đối tượng sang chuỗi JSON bằng JSON.stringify rồi parse lại trước khi truyền qua các service.',
            'Luôn khởi tạo tất cả các thuộc tính của đối tượng trong hàm khởi tạo (constructor) theo một thứ tự cố định, và gán null/undefined cho các thuộc tính chưa có giá trị thay vì thêm động sau này.'
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
      realCodeSnippet: `// Đoạn mã minh họa Memory Leak qua Closure Retaining Path và giải pháp WeakRef
export class TelemetryLeakDemo {
  private listeners = new Map<string, Function>();

  // ❌ NGUY CƠ LEAK: Closure giữ tham chiếu tới scope cha vô thời hạn
  public registerLeakyHandler(id: string, hugeData: ArrayBuffer) {
    this.listeners.set(id, () => {
      console.log('Processed:', id, hugeData.byteLength);
    });
  }

  // ✅ GIẢI PHÁP CHUẨN: Dùng WeakRef để cho phép Garbage Collector thu hồi bộ nhớ
  public registerSafeHandler(id: string, hugeData: ArrayBuffer) {
    const weakData = new WeakRef(hugeData);
    this.listeners.set(id, () => {
      const data = weakData.deref();
      if (!data) {
        console.log('Object đã được GC thu hồi an toàn!');
        return;
      }
      console.log('Processed:', id, data.byteLength);
    });
  }
}`,
      quiz: [
        {
          id: 'c1-l3-q1',
          question: 'Ý nghĩa kỹ thuật chính xác nhất của chỉ số Retained Size khi phân tích Heap Snapshot bằng Chrome DevTools là gì?',
          options: [
            'Dung lượng bộ nhớ thực tế chỉ do bản thân các thuộc tính nguyên thủy trực tiếp của đối tượng đó chiếm giữ trong RAM.',
            'Số lượng chu kỳ xung nhịp CPU mà bộ thu gom rác cần tiêu tốn để chuyển đổi đối tượng từ Young Gen sang Old Gen.',
            'Tổng dung lượng bộ nhớ sẽ được giải phóng nếu đối tượng này bị xóa và toàn bộ cây tham chiếu độc quyền của nó bị GC thu hồi.',
            'Dung lượng bộ nhớ đệm mà hệ điều hành Linux dành riêng để lưu trữ con trỏ Socket File Descriptor của kết nối HTTP.'
          ],
          correctIndex: 2,
          explanation: 'Shallow Size là kích thước của chính đối tượng. Retained Size là tổng dung lượng của đối tượng đó cộng với toàn bộ các đối tượng phụ thuộc chỉ có thể chạm tới thông qua nó (Dominator Tree). Đây là chỉ số quan trọng nhất để phát hiện memory leak.'
        },
        {
          id: 'c1-l3-q2',
          question: 'Tại sao thuật toán Cheney Scavenge trong phân vùng Young Generation lại có tốc độ dọn dẹp cực nhanh chỉ mất vài mili-giây?',
          options: [
            'Nó chỉ sao chép các object còn sống sang To-Space và xóa trắng toàn bộ From-Space cũ bằng một thao tác tịnh tiến con trỏ.',
            'Nó tự động chuyển toàn bộ các object bị lỗi sang ổ cứng SSD của máy chủ mà không cần duyệt cây tham chiếu của V8.',
            'Nó vô hiệu hóa toàn bộ cơ chế bất đồng bộ của Event Loop trong suốt thời gian hệ thống thực hiện dọn dẹp rác.',
            'Nó sử dụng các luồng phần cứng chuyên biệt của card đồ họa GPU để tính toán địa chỉ bộ nhớ song song với luồng chính.'
          ],
          correctIndex: 0,
          explanation: 'Dựa trên giả thuyết thế hệ, đa số object trong Young Gen đều chết. Thuật toán Scavenge chỉ tốn công sao chép số ít object còn sống sang To-Space và xếp liên tục nhau (vừa dọn rác vừa chống phân mảnh). Toàn bộ From-Space cũ bị xóa sổ ngay tức thì.'
        },
        {
          id: 'c1-l3-q3',
          question: 'Hiện tượng Container Node.js bị Kubernetes tiêu diệt với trạng thái OOMKilled dù chỉ số heapUsed rất thấp xảy ra do nguyên nhân nào?',
          options: [
            'Thuật toán Mark-Sweep-Compact gặp hiện tượng bế tắc Deadlock khi dọn dẹp các đối tượng mảng lớn trong phân vùng Young Gen.',
            'Bộ nhớ Buffer cấp phát trực tiếp qua hàm malloc ở tầng C++ ngoài V8 Heap tích tụ quá lớn làm cạn kiệt RAM vật lý của Container.',
            'Hệ điều hành Linux phát hiện V8 Engine đang cố gắng truy cập trái phép vào các thanh ghi nội bộ của vi xử lý CPU máy chủ.',
            'Trình biên dịch TurboFan tự động nhân đôi kích thước của mã máy Assembly sau mỗi lần thực thi cơ chế Deoptimization.'
          ],
          correctIndex: 1,
          explanation: 'Buffer trong Node.js được cấp phát ngoài V8 Heap (nằm trong process.memoryUsage().external). Do heapUsed vẫn thấp, V8 không nhận thấy áp lực bộ nhớ và không kích hoạt Major GC kịp thời. Nhưng tổng RAM (RSS) của tiến trình đã vượt quá giới hạn của Kubernetes Pod, dẫn đến việc bị Linux OOM Killer gửi tín hiệu SIGKILL.'
        },
        {
          id: 'c1-l3-q4',
          question: 'Vai trò của pha Compacting (Thu gom dồn ô nhớ) trong thuật toán Mark-Sweep-Compact của Old Generation là gì?',
          options: [
            'Tự động nén toàn bộ mã nguồn của ứng dụng thành định dạng nhị phân gzip để tiết kiệm dung lượng lưu trữ trên đĩa cứng.',
            'Chuyển đổi toàn bộ các biến số nguyên 64-bit sang định dạng số nguyên 32-bit nhằm tăng tốc độ tính toán của bộ xử lý ALU.',
            'Khóa tạm thời các kết nối mạng gửi đến máy chủ để giải phóng bảng phân trang ảo của nhân hệ điều hành Linux Kernel.',
            'Dịch chuyển các block bộ nhớ còn sống nằm sát lại với nhau để triệt tiêu hiện tượng phân mảnh bộ nhớ (Memory Fragmentation).'
          ],
          correctIndex: 3,
          explanation: 'Sau nhiều lần giải phóng các object rải rác (Sweeping), bộ nhớ sẽ bị thủng lỗ chỗ (phân mảnh). Khi cần cấp phát một object lớn liên tục, hệ thống sẽ báo lỗi OOM dù tổng dung lượng trống vẫn đủ. Pha Compacting di dời các object sống lại gần nhau, tạo ra một vùng nhớ trống lớn liên tục.'
        },
        {
          id: 'c1-l3-q5',
          question: 'Tại sao việc sử dụng WeakMap lại là giải pháp tối ưu để lưu trữ metadata hoặc cache liên quan đến các đối tượng mà không sợ gây ra rò rỉ bộ nhớ (Memory Leak)?',
          options: [
            'Vì WeakMap tự động lưu toàn bộ dữ liệu lên ổ đĩa cứng SSD nên không hề chiếm dụng bộ nhớ RAM của V8 Heap.',
            'Vì WeakMap mã hóa tất cả các giá trị thành chuỗi SHA-256 nên dung lượng của nó luôn cố định ở mức 0 byte.',
            'Vì các khóa (keys) trong WeakMap chỉ là tham chiếu yếu (Weak Reference); khi đối tượng khóa không còn được tham chiếu ở nơi nào khác, Garbage Collector sẽ tự động thu hồi nó và xóa mục tương ứng trong WeakMap.',
            'Vì WeakMap chỉ cho phép tồn tại tối đa 10 phần tử, nếu vượt quá sẽ tự động ném ra ngoại lệ BadRequestException.'
          ],
          correctIndex: 2,
          explanation: 'Trong Map thông thường, object key được giữ bằng một Strong Reference, ngăn GC thu hồi ngay cả khi toàn bộ ứng dụng không còn dùng object đó nữa. WeakMap chỉ giữ Weak Reference: GC không coi WeakMap là một root sống. Khi đối tượng key không còn tham chiếu nào khác, GC lập tức dọn dẹp nó.'
        },
        {
          id: 'c1-l3-q6',
          question: 'Lỗi rò rỉ bộ nhớ (Memory Leak) kinh điển khi sử dụng EventEmitter trong các Service của NestJS xảy ra do cơ chế nào sau đây?',
          options: [
            'Do EventEmitter trong Node.js chỉ có khả năng gửi tối đa 3 sự kiện trước khi tự động khóa toàn bộ tiến trình.',
            'Do giao thức HTTP/2 không hỗ trợ các sự kiện phát ra từ EventEmitter của tầng C++ Libuv.',
            'Do V8 Engine không cho phép các hàm callback trong JavaScript được thực thi quá 500 micro-giây.',
            'Đăng ký event listener (emitter.on) bên trong hàm xử lý request mà quên gỡ bỏ (removeListener); hàm listener giữ tham chiếu closure tới scope của request và bị đối tượng Emitter sống lâu (Singleton) giữ chặt vĩnh viễn.'
          ],
          correctIndex: 3,
          explanation: 'Khi đăng ký emitter.on(\'event\', callback) trong một request handler, mỗi request lại tạo thêm 1 listener mới. Do emitter thường là một Singleton Service (sống suốt đời tiến trình), nó lưu các hàm callback này vào mảng nội bộ. Mỗi callback lại giữ tham chiếu tới toàn bộ biến của request (closure). Kết quả là RAM tăng dần đều cho tới khi sập máy chủ.'
        },
        {
          id: 'c1-l3-q7',
          question: 'Tại sao thuật toán Mark-Sweep của V8 Engine lại giải quyết triệt để vấn đề tham chiếu vòng (Circular Reference, ví dụ: A trỏ B và B trỏ A) mà cơ chế Reference Counting trước đây bị thất bại?',
          options: [
            'Vì V8 tự động chèn một con trỏ NULL vào giữa hai đối tượng tham chiếu vòng ngay khi chúng được khởi tạo.',
            'Vì Mark-Sweep duyệt đồ thị từ các GC Roots (Global, Stack, CPU Registers); nếu cụm tham chiếu vòng bị ngắt kết nối khỏi GC Roots, chúng sẽ không được đánh dấu (Unmarked) và toàn bộ sẽ bị thu hồi dù trỏ lẫn nhau.',
            'Vì hệ điều hành Linux sẽ tự động gửi tín hiệu SIGINT để cắt đứt liên kết giữa hai địa chỉ bộ nhớ RAM.',
            'Vì JavaScript cấm hoàn toàn việc gán thuộc tính của một đối tượng bằng tham chiếu tới đối tượng khác.'
          ],
          correctIndex: 1,
          explanation: 'Thuật toán Reference Counting chỉ đếm số lượng con trỏ: A trỏ B (count=1), B trỏ A (count=1). Khi ngắt kết nối với ứng dụng, count vẫn là 1 nên không bao giờ được giải phóng (rò rỉ). Ngược lại, Mark-Sweep bắt đầu duyệt từ GC Roots: bất kỳ node nào không thể đi tới từ Roots đều bị coi là rác (Dead Objects) và bị quét dọn sạch sẽ.'
        },
        {
          id: 'c1-l3-q8',
          question: 'Trong báo cáo Heap Snapshot của Chrome DevTools, chỉ số "Distance" (Khoảng cách) của một đối tượng mang ý nghĩa kỹ thuật gì?',
          options: [
            'Số bước nhảy liên kết ngắn nhất (Shortest Path Hops) từ bất kỳ GC Root nào trên đồ thị bộ nhớ để chạm tới đối tượng đó; số càng nhỏ thì đối tượng càng gần Root.',
            'Khoảng cách vật lý tính bằng milimet giữa thanh RAM của máy chủ và chip vi xử lý trung tâm CPU.',
            'Số lượng dòng mã nguồn giữa vị trí khai báo biến và vị trí hàm return kết thúc trong file JavaScript.',
            'Thời gian trễ mạng ping giữa máy chủ ứng dụng NestJS và hệ quản trị cơ sở dữ liệu PostgreSQL.'
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
