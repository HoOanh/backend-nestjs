import type { Sprint } from './types.ts';

export const chapter2: Sprint = {
  sprintId: 2,
  sprintTitle: 'Chương 2: Libuv, OS Kernel System Calls & Kiến Trúc Bất Đồng Bộ Non-Blocking',
  sprintDesc: 'Khám phá trái tim điều phối của Node.js: 6 Pha Event Loop, Thứ tự Drain Microtasks, Linux epoll/kqueue vs Libuv Threadpool, và Kỹ thuật điều phối Worker Threads',
  lessons: [
    {
      id: 'c2-l1',
      title: 'Bài 01: The Single-Thread Illusion: Main Thread, Libuv 6 Pha & Thứ Tự Drain Microtasks',
      duration: '60 phút',
      tag: 'Event Loop & Microtasks',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐIỀU PHỐI I/O BẤT ĐỒNG BỘ & THỨ BẬC ƯU TIÊN DRAIN QUEUES

Để vận hành một dịch vụ Backend Node.js đạt hàng trăm nghìn throughput mà không gặp lỗi nghẽn luồng, kỹ sư bắt buộc phải nắm vững mô hình điều phối của Libuv và sự phân tầng hàng đợi:

* **Bản chất của Single-Thread Illusion (Ảo tưởng đơn luồng):**
  - Mọi dòng mã JavaScript trong ứng dụng (bao gồm Controller, Service, Guard, Pipe) đều được thực thi tuần tự trên đúng **một luồng duy nhất (V8 Main Thread)**.
  - Tuy nhiên, Node.js không thực hiện các tác vụ I/O trên luồng này. V8 Main Thread chỉ đóng vai trò điều phối: tiếp nhận request, đăng ký các hàm phản hồi (Event Handlers / Callbacks), ủy thác thao tác chờ đợi I/O xuống nhân hệ điều hành, rồi lập tức giải phóng Call Stack để tiếp tục phục vụ các request khác.

* **Vòng điều phối 6 Pha của Libuv (The 6-Phase Event Loop):**
  - Trái tim của Libuv là một vòng lặp sự kiện tuần tự gồm 6 pha tách biệt: Timers (xử lý setTimeout/setInterval), Pending Callbacks (xử lý lỗi I/O hệ thống), Idle/Prepare (dọn dẹp nội bộ), Poll (chờ đợi và đọc sự kiện mạng mới), Check (thực thi setImmediate), và Close Callbacks (đóng socket, dọn dẹp tài nguyên).
  - Mỗi pha sở hữu một hàng đợi FIFO riêng, được thiết kế để không một loại tác vụ nào có thể chiếm dụng vĩnh viễn vòng lặp.

* **Hiện tượng Starvation từ Microtask Queue (nextTick & Promise Drain):**
  - Khác với 6 pha của Libuv (vốn chỉ xử lý Macrotasks), V8 duy trì hai hàng đợi ưu tiên đặc biệt: \`process.nextTickQueue\` và \`microtaskQueue\` (Promise).
  - **Cơ chế Drain Tuyệt Đối:** Ngay sau khi một tác vụ JavaScript kết thúc ở BẤT KỲ pha nào của Event Loop, V8 bắt buộc phải xả sạch hoàn toàn (Drain completely) toàn bộ các tác vụ trong \`nextTickQueue\`, kế tiếp là \`microtaskQueue\`, trước khi cho phép Libuv chuyển sang pha tiếp theo.
  - **Hiểm họa Starvation trong Production:** Nếu kỹ sư vô tình kích hoạt đệ quy vô hạn \`process.nextTick()\` hoặc chuỗi Promise không hồi kết, Event Loop sẽ bị giam cầm vĩnh viễn giữa hai pha. Toàn bộ pha Poll (đọc I/O mạng) và pha Timers bị tê liệt hoàn toàn, dẫn đến sập hệ thống do nghẽn I/O (Event Loop Starvation).

---

# 2. VÒNG ĐỜI 6 PHA CỦA LIBUV EVENT LOOP & NGUYÊN LÝ DRAIN

Trong mỗi vòng lặp (Tick) của Event Loop, Libuv duyệt qua 6 pha tuần tự:

\`\`\`diagram
   ┌──────────────────────────────────────────────────────────┐
┌─►│ 1. TIMERS (setTimeout, setInterval)                      │
│  └────────────────────────────┬─────────────────────────────┘
│                               │ ◄─── DRAIN MICROTASKS (nextTick -> Promise)
│  ┌────────────────────────────▼─────────────────────────────┐
│  │ 2. PENDING CALLBACKS (I/O errors, system syscall alerts) │
│  └────────────────────────────┬─────────────────────────────┘
│                               │ ◄─── DRAIN MICROTASKS (nextTick -> Promise)
│  ┌────────────────────────────▼─────────────────────────────┐
│  │ 3. IDLE, PREPARE (Libuv internal housekeeping)           │
│  └────────────────────────────┬─────────────────────────────┘
│                               │ ◄─── DRAIN MICROTASKS (nextTick -> Promise)
│  ┌────────────────────────────▼─────────────────────────────┐
│  │ 4. POLL (Retrieve new I/O events; Block if idle)         │
│  └────────────────────────────┬─────────────────────────────┘
│                               │ ◄─── DRAIN MICROTASKS (nextTick -> Promise)
│  ┌────────────────────────────▼─────────────────────────────┐
│  │ 5. CHECK (setImmediate callbacks execution)              │
│  └────────────────────────────┬─────────────────────────────┘
│                               │ ◄─── DRAIN MICROTASKS (nextTick -> Promise)
│  ┌────────────────────────────▼─────────────────────────────┐
│  │ 6. CLOSE CALLBACKS (socket.on('close'), cleanup handles) │
│  └────────────────────────────┬─────────────────────────────┘
└───────────────────────────────┘
\`\`\`

### 2.1 Chi Tiết Từng Pha Thực Thi
1. **Pha Timers:** Thực thi các callback của \`setTimeout()\` và \`setInterval()\` có ngưỡng thời gian đã hết hạn. Libuv lưu các timer trong cấu trúc Min-Heap để lấy ra timer hết hạn sớm nhất với độ phức tạp $O(1)$.
2. **Pha Pending Callbacks:** Thực thi các callback I/O còn tồn đọng từ vòng lặp trước, ví dụ các lỗi mạng cấp thấp như \`ECONNREFUSED\` từ hệ điều hành.
3. **Pha Idle, Prepare:** Sử dụng nội bộ bởi Libuv cho các mục đích dọn dẹp và chuẩn bị trước khi vào pha quan trọng nhất.
4. **Pha Poll:** Trái tim tiếp nhận dữ liệu của Node.js:
   - Tính toán thời gian cần block luồng để chờ kernel báo sự kiện I/O mới (dựa trên timer gần nhất).
   - Đọc dữ liệu từ các socket, network packets gửi đến, xử lý HTTP request mới.
5. **Pha Check:** Dành riêng cho \`setImmediate()\`. Cho phép thực thi mã code ngay sau khi pha Poll hoàn tất đọc I/O mà không cần đợi vòng tick kế tiếp.
6. **Pha Close Callbacks:** Thực thi các sự kiện đóng tài nguyên như \`socket.on('close', ...)\` để giải phóng socket descriptors.

### 2.2 Quy Tắc Drain Microtasks (Node.js 11+)
Trước Node 11, Microtasks chỉ được xả sau khi toàn bộ pha kết thúc. Từ Node 11 trở đi, để đồng bộ với chuẩn Web Browser:
* **Quy tắc xả tức thì:** Giữa mỗi callback đơn lẻ trong bất kỳ pha nào, nếu có Microtask được sinh ra, Node.js sẽ lập tức xả Microtasks Queue.
* **Thứ tự ưu tiên tuyệt đối:**
  $$\\text{process.nextTick Queue} \\longrightarrow \\text{Promise Reaction Queue (Microtasks)} \\longrightarrow \\text{Macrotask tiếp theo}$$
* **Hiểm họa Starvation (Bỏ đói Event Loop):** Nếu đại ca đệ quy \`process.nextTick()\`, Event Loop sẽ bị kẹt vĩnh viễn ở Microtask Queue và **không bao giờ tiến vào pha Poll hay Timers**, khiến toàn bộ server bị tê liệt!

---

# 3. PHÂN BIỆT THỰC NGHIỆM: setImmediate VS setTimeout(0)

Một trong những câu hỏi phỏng vấn Senior kinh điển: Đoạn code sau in ra gì?
\`\`\`typescript
setTimeout(() => console.log('Timeout'), 0);
setImmediate(() => console.log('Immediate'));
\`\`\`
* **Nếu chạy ở Top-level:** Kết quả là **Không xác định (Non-deterministic)**! Lý do: \`setTimeout(fn, 0)\` thực tế bị ép thành \`setTimeout(fn, 1ms)\` do giới hạn chuẩn POSIX. Tùy thuộc vào tốc độ xung nhịp CPU khi process khởi động, nếu việc chuẩn bị Event Loop tốn hơn 1ms thì pha Timers chạy trước (in \`Timeout\`), nếu dưới 1ms thì Timers chưa hết hạn, vòng lặp tiến vào Poll rồi sang Check (in \`Immediate\`).
* **Nếu chạy bên trong một I/O Callback:**
\`\`\`typescript
fs.readFile('config.json', () => {
  setTimeout(() => console.log('Timeout'), 0);
  setImmediate(() => console.log('Immediate'));
});
\`\`\`
Kết quả luôn luôn là: **\`Immediate\` in trước \`Timeout\` $100\\%$!**
Bởi vì callback \`fs.readFile\` được xử lý trong **pha Poll**. Sau khi rời khỏi pha Poll, pha tiếp theo liền kề theo chiều kim đồng hồ chính là **pha Check** (\`setImmediate\`), trong khi pha Timers phải đợi hết 1 vòng lặp để quay lại.

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Thứ Tự Ưu Tiên Phân Cấp Hàng Đợi (Task Hierarchy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THỨ TỰ ƯU TIÊN HÀNG ĐỢI RUNTIME                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. CẤP ĐỘ 0: V8 CALL STACK (Mã JavaScript đồng bộ đang chạy)               │
│    └── fn(), console.log(), JSON.parse(), vòng lặp for/while                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CẤP ĐỘ 1: MICROTASKS TỐI CAO (Xả ngay khi Call Stack trống)             │
│    ├── [Ưu tiên 1]: process.nextTick() queue (Được xả trước tiên)           │
│    └── [Ưu tiên 2]: Promise.then(), catch, finally, queueMicrotask()        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. CẤP ĐỘ 2: MACROTASKS (Duyệt theo từng pha của Libuv Event Loop)         │
│    ├── Pha 1: Timers Min-Heap (setTimeout, setInterval hết hạn)             │
│    ├── Pha 2: Pending Callbacks (I/O syscall errors)                        │
│    ├── Pha 4: Poll Queue (Incoming HTTP connections, Socket data)           │
│    ├── Pha 5: Check Queue (setImmediate)                                    │
│    └── Pha 6: Close Callbacks (socket.destroy cleanup)                      │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Vòng Lặp Tick & Điểm Kiểm Tra Thoát (Lifecycle Flowchart)
\`\`\`diagram
               [ BẮT ĐẦU VÒNG TICK MỚI ]
                          │
                          ▼
            Có Handles hoặc Requests hoạt động? ──► [ KHÔNG ] ──► [ PROCESS.EXIT(0) ]
                          │ (CÓ)
                          ▼
             [ 1. Pha TIMERS ] ───────► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
        [ 2. Pha PENDING CALLBACKS ] ─► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
          [ 3. Pha IDLE / PREPARE ] ──► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
              [ 4. Pha POLL I/O ] ────► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
              [ 5. Pha CHECK ] ───────► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
          [ 6. Pha CLOSE CALLBACKS ] ─► Có Microtask? ──► [ XẢ HẾT MICROTASKS ]
                          │
                          ▼
              [ KẾT THÚC 1 VÒNG TICK ] ──► Quay lại kiểm tra từ đầu
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Chọn Hàm Hoãn Thực Thi (Execution Deferral Decision Tree)
\`\`\`diagram
CẦN HOÃN THỰC THI MỘT CALLBACK TRONG BACKEND?
│
├── Cần chạy NGAY LẬP TỨC trước khi I/O tiếp tục, để xử lý lỗi hoặc khởi tạo state?
│   └──► Chọn: process.nextTick() (Lưu ý: Không dùng vòng lặp đệ quy để tránh starvation)
│
├── Cần xử lý kết quả bất đồng bộ theo chuẩn ECMAScript tương thích đa nền tảng?
│   └──► Chọn: Promise.resolve().then() / queueMicrotask()
│
├── Cần chạy ngay sau khi pha Poll I/O vừa đọc xong dữ liệu?
│   └──► Chọn: setImmediate() (Tối ưu nhất cho việc chia nhỏ tác vụ I/O nặng)
│
└── Cần trì hoãn tối thiểu một khoảng thời gian nhất định (khoảng trễ)?
    └──► Chọn: setTimeout(fn, delayMs) (Dùng Min-Heap kiểm tra thời gian)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế Điều Phối | Thời Điểm Chạy | Mức Tiêu Hao CPU | Rủi Ro Vận Hành Hệ Thống | Ứng Dụng Chuẩn Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **process.nextTick** | Ngay lập tức sau call frame hiện tại | Cực thấp (Array queue) | Gây Starvation tê liệt toàn bộ I/O | Dọn dẹp lỗi khẩn cấp, phát event đồng bộ sau constructor |
| **Promise.then** | Ngay sau khi nextTick queue rỗng | Rất thấp (V8 Microtask) | Trì hoãn macrotask nếu chain promise quá dài | Chuỗi xử lý nghiệp vụ bất đồng bộ, async/await |
| **setImmediate** | Tại pha Check sau khi kết thúc Poll | Thấp (Libuv Check Queue) | Chạy chậm hơn 1 nhịp so với Microtask | Phân mảnh tác vụ CPU-bound lớn thành nhiều chunks |
| **setTimeout(fn, 0)** | Tại pha Timers vòng lặp kế tiếp | Trung bình (Min-Heap traversal) | Độ trễ thực tế bị kẹp tối thiểu 1ms, không ổn định | Tác vụ hẹn giờ thực sự cần delay, retry exponential |
`,
      realCodeSnippet: `// File: src/modules/platform/queues/non-blocking-chunk.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - High-Throughput CPU Chunking Service
import { Injectable, Logger } from '@nestjs/common';

export interface ChunkProgress {
  processedChunks: number;
  totalItems: number;
  durationMs: number;
}

/**
 * Service xử lý hàng triệu phần tử trong NestJS mà không làm chặn V8 Main Thread:
 * - Sử dụng setImmediate để trả quyền điều phối lại cho Libuv Event Loop giữa các chunk.
 * - Cho phép các kết nối HTTP mạng (Poll Phase) và Timers tiếp tục được xử lý mượt mà.
 */
@Injectable()
export class NonBlockingChunkService {
  private readonly logger = new Logger(NonBlockingChunkService.name);

  public async processBatchNonBlocking<T>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => void | Promise<void>,
  ): Promise<ChunkProgress> {
    if (!Array.isArray(items) || items.length === 0 || chunkSize <= 0) {
      throw new Error('INVALID_CHUNK_PARAMETERS');
    }

    const start = Date.now();
    let currentIndex = 0;
    let processedChunks = 0;

    while (currentIndex < items.length) {
      const chunk = items.slice(currentIndex, currentIndex + chunkSize);
      currentIndex += chunkSize;
      processedChunks++;

      // Xử lý chunk hiện tại
      await processor(chunk);

      // Nếu vẫn còn dữ liệu, nhường quyền kiểm soát cho Event Loop (Check Phase)
      if (currentIndex < items.length) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }

    const durationMs = Date.now() - start;
    this.logger.debug(\`Đã hoàn thành \${processedChunks} chunks (\${items.length} items) trong \${durationMs}ms\`);

    return { processedChunks, totalItems: items.length, durationMs };
  }
}`,
      quiz: [
        {
          id: 'c2-l1-q1',
          question: 'Hiện tượng Event Loop Starvation xảy ra khi nào và để lại hậu quả gì nghiêm trọng nhất cho máy chủ backend Node.js/NestJS?',
          options: [
            'Khi V8 Heap vượt quá ngưỡng max-old-space-size, buộc bộ thu gom rác phải kích hoạt chu kỳ Full Mark-Sweep-Compact dừng toàn bộ thế giới (Stop-The-World) kéo dài.',
            'Khi Microtask Queue (process.nextTickQueue hoặc Promise microtasks) liên tục sinh thêm tác vụ đệ quy mới mà không cạn, khiến Event Loop bị giam cầm vĩnh viễn giữa hai pha và không bao giờ tiến vào pha Poll I/O để nhận kết nối HTTP mới.',
            'Khi Libuv Threadpool bị chiếm dụng toàn bộ bởi các tác vụ mã hóa crypto, khiến kernel từ chối tiếp nhận thêm các gói tin TCP SYN trên cổng socket.',
            'Khi số lượng kết nối đồng thời vượt quá giới hạn file descriptor (ulimit -n), khiến hệ điều hành tự động khóa luồng chính của tiến trình Node.js ở chế độ Read-Only.'
          ],
          correctIndex: 1,
          explanation: 'Event Loop Starvation xảy ra khi microtask queue (đặc biệt là process.nextTick đệ quy liên tục) không bao giờ cạn rỗng. Do quy tắc xả cạn kiệt (drain completely) microtask trước khi chuyển pha, Event Loop bị kẹt cứng tại chỗ, không thể tiến vào pha Poll để tiếp nhận kết nối HTTP hay pha Timers, làm máy chủ hoàn toàn tê liệt.'
        },
        {
          id: 'c2-l1-q2',
          question: 'Khi đặt lệnh setTimeout(fn, 0) và setImmediate(fn) bên trong một callback I/O (ví dụ: fs.readFile), thứ tự thực thi chắc chắn sẽ là gì và tại sao?',
          options: [
            'Thứ tự thực thi là không xác định (non-deterministic), phụ thuộc hoàn toàn vào độ trễ phân bổ xung nhịp CPU của hệ điều hành tại thời điểm đọc xong file.',
            'setTimeout luôn chạy trước vì các bộ hẹn giờ có độ ưu tiên cao nhất trong cấu trúc Min-Heap của pha Timers.',
            'setImmediate luôn chạy trước setTimeout 100%, vì callback đọc file được xử lý tại pha Poll; ngay sau khi rời pha Poll theo chiều kim đồng hồ, Event Loop lập tức tiến vào pha Check (nơi xử lý setImmediate) trước khi quay lại pha Timers ở vòng tick tiếp theo.',
            'Cả hai callback được nạp đồng thời vào hai luồng Worker Thread khác nhau của Libuv Threadpool nên hàm nào tính toán xong trước sẽ in trước.'
          ],
          correctIndex: 2,
          explanation: 'Khi fs.readFile hoàn thành, callback của nó được thực thi tại pha Poll. Khi rời khỏi pha Poll theo chiều kim đồng hồ của Event Loop, pha kế tiếp ngay lập tức là pha Check (nơi xử lý setImmediate). Ngược lại, callback của setTimeout(fn, 0) nằm ở pha Timers, bắt buộc phải đợi Event Loop đi hết một vòng lặp trọn vẹn mới được gọi tới.'
        },
        {
          id: 'c2-l1-q3',
          question: 'Điểm khác biệt cốt lõi về cơ chế điều phối giữa process.nextTick() và Promise.resolve().then() trong runtime của Node.js là gì?',
          options: [
            'Node.js duy trì hai hàng đợi microtask tách biệt: process.nextTickQueue có độ ưu tiên tối thượng và luôn được xả sạch hoàn toàn trước khi V8 tiến hành xả các tác vụ trong Promise reaction microtask queue.',
            'Promise.then được quản lý bởi V8 Microtask Queue, trong khi process.nextTick được đẩy xuống pha Timers của Libuv dưới dạng một macrotask trễ 0ms.',
            'Cả hai sử dụng chung một hàng đợi FIFO duy nhất của V8 Engine; hàm nào được đăng ký trước trong mã nguồn JavaScript sẽ được thực thi trước.',
            'Promise.then chạy trên luồng chính của V8, còn process.nextTick được gửi trực tiếp xuống hàng đợi ngắt (Interrupt Queue) của nhân hệ điều hành thông qua Libuv C++ bindings.'
          ],
          correctIndex: 0,
          explanation: 'Trong kiến trúc của Node.js, process.nextTickQueue có độ ưu tiên tuyệt đối cao hơn Promise reaction microtask queue. Khi Call Stack vừa trống, Node.js sẽ luôn xả sạch toàn bộ các callback trong nextTickQueue trước, sau đó mới tiến hành xả các Promise microtask.'
        },
        {
          id: 'c2-l1-q4',
          question: 'Để xử lý một mảng dữ liệu cực lớn (hàng triệu bản ghi) bằng thuật toán CPU-bound trong NestJS mà không làm tê liệt khả năng tiếp nhận HTTP request của Event Loop, giải pháp kỹ thuật nào sau đây là chuẩn xác?',
          options: [
            'Bọc toàn bộ vòng lặp tính toán bên trong một new Promise(resolve => ...) và gọi bằng await để tự động biến nó thành tác vụ bất đồng bộ phi chặn.',
            'Sử dụng setTimeout(..., 0) bên trong mỗi bước lặp vì các trình duyệt và Node.js đều tự động chuyển callback của timer sang lõi CPU phụ rảnh rỗi.',
            'Sử dụng vòng lặp for đồng bộ kết hợp với khối try/catch có lệnh yield để nhân hệ điều hành tự động giải phóng Call Stack khi phát hiện độ trễ vượt quá 10ms.',
            'Chia nhỏ mảng dữ liệu thành từng phần (chunking) và sử dụng setImmediate() giữa các chunk, cho phép Event Loop nhường quyền cho các pha I/O (Poll, Timers) xử lý các request mới trước khi tiếp tục chu kỳ tính toán tiếp theo.'
          ],
          correctIndex: 3,
          explanation: 'Bọc vòng lặp CPU-bound nặng trong Promise hay async/await không hề giải phóng luồng, vì mã tính toán đồng bộ vẫn chiếm giữ Call Stack duy nhất của V8. Kỹ thuật đúng là chia nhỏ thành từng chunk và sử dụng setImmediate() sau mỗi chunk, cho phép Event Loop xen kẽ xử lý các request HTTP ở pha Poll trước khi tiếp tục tính toán.'
        },
        {
          id: 'c2-l1-q5',
          question: 'Cấu trúc dữ liệu nào được Libuv sử dụng để quản lý các bộ hẹn giờ (setTimeout, setInterval) trong Pha Timers nhằm đạt hiệu năng truy xuất tối ưu?',
          options: [
            'Một mảng liên kết đơn (Linked List) được duyệt tuần tự từ đầu đến cuối mỗi khi có tín hiệu ngắt thời gian từ hệ điều hành.',
            'Cây nhị phân Min-Heap sắp xếp theo thời điểm hết hạn (expiration time), cho phép lấy ra timer cần kích hoạt sớm nhất với độ phức tạp O(1).',
            'Bảng băm phân tán (Distributed Hash Map) lưu trữ địa chỉ con trỏ của callback trên bộ nhớ ngoài Heap.',
            'Hàng đợi vòng tròn (Ring Buffer) có kích thước cố định 1024 phần tử được cấp phát sẵn trong bộ nhớ Stack.'
          ],
          correctIndex: 1,
          explanation: 'Libuv lưu trữ các timer trong cấu trúc dữ liệu Min-Heap. Điểm nút gốc của heap luôn là timer hết hạn sớm nhất. Mỗi lần kiểm tra pha Timers, Libuv chỉ cần so sánh thời gian hiện tại với nút gốc O(1), nếu chưa tới hạn thì toàn bộ heap chắc chắn chưa tới hạn, không tốn công duyệt qua toàn bộ danh sách.'
        },
        {
          id: 'c2-l1-q6',
          question: 'Quy tắc xả Microtask Queue trong Node.js từ phiên bản 11 trở đi có sự thay đổi mang tính bước ngoặt nào so với các phiên bản cũ?',
          options: [
            'Microtasks chỉ được xả một lần duy nhất tại điểm kết thúc của toàn bộ một vòng lặp Event Loop sau pha Close Callbacks.',
            'Node.js gom nhóm tất cả các Microtasks và chuyển sang thực thi song song trên Libuv Threadpool.',
            'Ngay sau khi mỗi callback đơn lẻ của bất kỳ pha nào trong Event Loop kết thúc, runtime sẽ lập tức xả sạch Microtask Queue trước khi tiếp tục callback tiếp theo, đồng bộ hoàn toàn với chuẩn Web Browser.',
            'Microtasks bị giới hạn số lượng tối đa 10 tác vụ mỗi chu kỳ; các tác vụ vượt ngưỡng sẽ bị tự động hủy bỏ.'
          ],
          correctIndex: 2,
          explanation: 'Trước Node 11, Node.js chỉ xả Microtasks sau khi toàn bộ một pha của Event Loop kết thúc. Kể từ Node 11, để đồng bộ với tiêu chuẩn của HTML5 và Web Browsers, Node.js xả Microtasks (nextTick rồi Promise) ngay giữa từng callback đơn lẻ của bất kỳ pha nào.'
        },
        {
          id: 'c2-l1-q7',
          question: 'Khi hàng đợi I/O của Pha Poll hoàn toàn trống và không có bất kỳ bộ hẹn giờ nào đang chờ, Libuv sẽ hành xử như thế nào nếu có tác vụ setImmediate() đang chờ trong Pha Check?',
          options: [
            'Libuv sẽ lập tức kết thúc pha Poll và chuyển ngay sang pha Check để thực thi các callback của setImmediate() mà không bị chặn luồng.',
            'Libuv sẽ cưỡng chế đưa luồng chính vào trạng thái ngủ trong 1000ms để chờ có gói tin mạng mới gửi đến.',
            'Libuv sẽ hủy bỏ toàn bộ các callback trong pha Check và quay trở lại pha Timers từ đầu.',
            'Libuv sẽ chuyển các tác vụ setImmediate() sang hàng đợi của process.nextTick để thực thi khẩn cấp.'
          ],
          correctIndex: 0,
          explanation: 'Khi pha Poll rỗng, nếu Libuv phát hiện có script được lên lịch bởi setImmediate(), nó sẽ không ngủ chờ I/O mà sẽ lập tức chuyển sang pha Check để thực thi. Điều này giúp các tác vụ setImmediate() luôn được đảm bảo chạy liền kề sau pha Poll mà không bị delay.'
        },
        {
          id: 'c2-l1-q8',
          question: 'Tại sao việc lạm dụng queueMicrotask() hoặc chuỗi Promise dài trong các NestJS Interceptors có thể gây nguy cơ nghẽn I/O tương tự như process.nextTick()?',
          options: [
            'Vì queueMicrotask() tự động chuyển đổi tiến trình sang chế độ đa luồng làm cạn kiệt tài nguyên CPU.',
            'Vì các microtask được ưu tiên xả sạch hoàn toàn trước khi Event Loop có thể tiến vào pha Poll, việc liên tục tạo thêm microtask mới sẽ ngăn chặn luồng chính tiếp nhận các gói tin mạng HTTP mới.',
            'Vì queueMicrotask() ghi đè lên bộ nhớ Stack của hàm cha và làm mất hiệu lực của các biến trong Closure.',
            'Vì NestJS Interceptors không hỗ trợ xử lý các tác vụ bất đồng bộ dựa trên chuẩn ECMAScript Promise.'
          ],
          correctIndex: 1,
          explanation: 'Dù Promise microtasks có độ ưu tiên sau process.nextTick, nhưng chúng vẫn thuộc tầng Microtask tối cao được xả cạn kiệt (Drain) trước khi Event Loop được phép chuyển sang pha tiếp theo. Nếu một Interceptor hoặc Middleware liên tục sinh ra chuỗi Promise vô tận, Event Loop sẽ bị bỏ đói (Starvation) và không bao giờ đọc được I/O mạng mới.'
        }
      ],
      codeChallenge: {
        id: 'c2-l1-c1',
        title: 'Xây Dựng Queue Chunk Processor Chống Blocking Event Loop',
        description: 'Hiện thực hàm `chunkProcessor<T>(items: T[], chunkSize: number, onChunk: (chunk: T[]) => void): Promise<number>` nhận vào một danh sách items, xử lý từng đợt (chunk) với kích thước chỉ định thông qua callback `onChunk`. Giữa các đợt xử lý, phải trả lại quyền kiểm soát cho Event Loop (dùng Promise với setImmediate) để không làm block luồng. Trả về tổng số chunk đã xử lý thành công. Nếu items rỗng hoặc chunkSize <= 0, trả về 0. Nếu items không phải là mảng, ném Error("INVALID_INPUT_ARRAY").',
        starterCode: `export async function chunkProcessor<T>(
  items: T[],
  chunkSize: number,
  onChunk: (chunk: T[]) => void
): Promise<number> {
  // TODO: Viết thuật toán chunking không chặn Event Loop
  return 0;
}`,
        solution: `export async function chunkProcessor<T>(
  items: T[],
  chunkSize: number,
  onChunk: (chunk: T[]) => void
): Promise<number> {
  if (items === null || items === undefined || !Array.isArray(items)) {
    throw new Error('INVALID_INPUT_ARRAY');
  }
  if (items.length === 0 || typeof chunkSize !== 'number' || chunkSize <= 0) {
    return 0;
  }

  let chunkCount = 0;
  let currentIndex = 0;

  while (currentIndex < items.length) {
    const chunk = items.slice(currentIndex, currentIndex + chunkSize);
    onChunk(chunk);
    chunkCount++;
    currentIndex += chunkSize;

    if (currentIndex < items.length) {
      // Nhường luồng cho Event Loop xử lý I/O mạng
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }

  return chunkCount;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Xử lý mảng rỗng hoặc chunkSize không hợp lệ',
            input: [[], 10, () => {}],
            expected: 0
          },
          {
            name: 'Case 2 (Visible): Chia 10 phần tử với chunkSize 3 (phải ra 4 chunks)',
            input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, () => {}],
            expected: 4
          },
          {
            name: 'Case 3 (Visible): Chia 5 phần tử với chunkSize 5 (phải ra đúng 1 chunk)',
            input: [['a', 'b', 'c', 'd', 'e'], 5, () => {}],
            expected: 1
          },
          {
            name: 'Case 4 (Hidden): Input items null -> Ném lỗi INVALID_INPUT_ARRAY',
            input: [null, 5, () => {}],
            expected: 'ERROR_THROWN'
          },
          {
            name: 'Case 5 (Hidden): chunkSize âm -> Trả về 0',
            input: [[1, 2, 3], -5, () => {}],
            expected: 0
          }
        ]
      }
    },
    {
      id: 'c2-l2',
      title: 'Bài 02: OS Kernel Non-Blocking I/O: Socket Multiplexing, Linux epoll vs Libuv Threadpool',
      duration: '60 phút',
      tag: 'Kernel Syscalls & Libuv',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: CƠ CHẾ CHUYỂN GIAO I/O CẤP KERNEL (EPOLL) & GIỚI HẠN THREADPOOL

Khi một máy chủ Backend phải duy trì 50,000 kết nối TCP (như WebSocket Server hoặc Microservices Gateway), thách thức lớn nhất nằm ở tầng giao tiếp giữa không gian người dùng (User Space) và không gian nhân hệ điều hành (Kernel Space):

* **Sự bất lực của cơ chế Polling truyền thống (\`select\` / \`poll\` System Calls):**
  - Trong các hệ điều hành Unix sơ khai, để kiểm tra xem trong số 10,000 sockets mở có socket nào đã nhận đủ dữ liệu mạng hay chưa, ứng dụng phải truyền một mảng gồm 10,000 File Descriptors (FDs) xuống Kernel ở mỗi vòng lặp.
  - Kernel buộc phải duyệt tuyến tính từ FD số 1 đến FD số 10,000 ($O(N)$ CPU complexity). Ngay cả khi 99.9% socket đang ở trạng thái rảnh rỗi (Idle), CPU vẫn bị thiêu đốt chỉ để quét qua hàng nghìn con trỏ không có dữ liệu.

* **Đột phá kiến trúc I/O Multiplexing hiện đại (Linux \`epoll\` / macOS \`kqueue\`):**
  - \`epoll\` thay đổi hoàn toàn cuộc chơi bằng cách chuyển danh bạ theo dõi File Descriptor vào lưu trữ trực tiếp bên trong cấu trúc cây đỏ-đen (Red-Black Tree) của Kernel (\`epoll_create\`, \`epoll_ctl\`).
  - Khi card mạng (NIC) nhận được gói tin TCP, phần cứng kích hoạt ngắt phần cứng (Hardware Interrupt), Kernel lập tức đưa đúng FD có dữ liệu vào hàng đợi sẵn sàng (\`Ready List\`).
  - Khi Node.js gọi \`epoll_wait()\` trong pha Poll của Libuv, nó chỉ nhận về đúng danh sách các socket thực sự có dữ liệu với độ phức tạp $O(1)$ Event-driven, hoàn toàn không tiêu tốn chu kỳ CPU vô ích.

* **Ranh giới cốt lõi: Khi nào Libuv dùng Kernel và khi nào dùng Threadpool?**
  - **Network I/O (TCP, UDP, UNIX Sockets, HTTP, DNS resolve qua c-ares):** Hoàn toàn là Non-blocking thực sự thông qua cơ chế \`epoll/kqueue\` của Kernel, không tốn bất kỳ thread nền nào của Libuv!
  - **File System (fs), DNS lookup (getaddrinfo), và Crypto (pbkdf2, scrypt):** Nhân hệ điều hành Linux truyền thống KHÔNG hỗ trợ Asynchronous I/O hoàn hảo cho tập tin đĩa (POSIX AIO bị hạn chế). Do đó, Libuv bắt buộc phải chuyển giao (Offload) các tác vụ này sang một **Threadpool nội bộ C++** (mặc định gồm 4 Worker Threads).
  - **Điểm nghẽn Threadpool Starvation:** Nếu 4 request gọi hàm mã hóa mật khẩu nặng đồng thời, toàn bộ 4 thread của Libuv bị chiếm dụng, khiến toàn bộ các lệnh đọc ghi file (\`fs.readFile\`) của hệ thống bị xếp hàng chờ, gây nghẽn nghiêm trọng. Kỹ sư phải chủ động cấu hình biến môi trường \`UV_THREADPOOL_SIZE\` phù hợp.

---

# 2. BẢN CHẤT HỆ THỐNG: SOCKET MULTIPLEXING & CÁC SYSTEM CALLS

Khi Node.js lắng nghe một cổng mạng (ví dụ port 3000), hệ điều hành quản lý việc giao tiếp qua các **File Descriptors (FD)**:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SỰ TIẾN HÓA CỦA I/O MULTIPLEXING                      │
├────────────────────┬────────────────────┬───────────────────────────────────┤
│ System Call        │ Độ Phức Tạp (Time) │ Cơ Chế Hoạt Động                  │
├────────────────────┼────────────────────┼───────────────────────────────────┤
│ select() (1983)    │ O(N)               │ Giới hạn tối đa 1024 FDs, quét mảng│
│ poll() (1997)      │ O(N)               │ Không giới hạn FD nhưng vẫn quét   │
│ epoll() (Linux)    │ O(1)               │ Dùng Red-Black Tree + Ready List  │
│ kqueue() (BSD/Mac) │ O(1)               │ Event Filters cấp Kernel          │
└────────────────────┴────────────────────┴───────────────────────────────────┘
\`\`\`

### 2.1 Kiến Trúc Bên Trong Của Linux epoll
Linux \`epoll\` không kiểm tra thủ công từng socket. Nó duy trì 2 cấu trúc dữ liệu chính trong không gian Kernel:
1. **Red-Black Tree (Cây đỏ đen):** Lưu trữ tập hợp tất cả các File Descriptors mà ứng dụng quan tâm theo dõi. Cho phép thêm, sửa, xóa socket với thời gian $O(\\log N)$.
2. **Ready List (Danh sách liên kết sẵn sàng):** Khi có gói tin TCP ập đến Card mạng (NIC), NIC kích hoạt phần cứng gián đoạn (Hardware Interrupt). Kernel xử lý và đẩy trực tiếp FD tương ứng vào Ready List.
3. Khi Node.js gọi \`epoll_wait()\`, Kernel chỉ việc trả về danh sách các socket thực sự có dữ liệu với độ phức tạp **$O(1)$** mà không tốn công duyệt qua hàng nghìn kết nối đang nhàn rỗi!

---

# 3. KHI NÀO SỬ DỤNG KERNEL EPOLL VÀ KHI NÀO CẦN LIBUV THREADPOOL?

Đây là một trong những hiểu lầm lớn nhất của các kỹ sư: **"Mọi thao tác bất đồng bộ trong Node.js đều chạy bằng Libuv Threadpool."**
> **Sự thật kỹ thuật:** Threadpool chỉ được sử dụng khi hệ điều hành KHÔNG CÓ cơ chế thông báo bất đồng bộ thực sự!

\`\`\`diagram
                              TÁC VỤ BẤT ĐỒNG BỘ TRONG NODE.JS
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
   [ 1. ASYNCHRONOUS NON-BLOCKING ]                             [ 2. THREADPOOL OFFLOADING ]
      (Hoàn toàn KHÔNG dùng luồng)                               (Chạy trên 4 luồng C++ Libuv)
             │                                                               │
  Do OS Kernel trực tiếp đảm nhiệm                             Do hệ điều hành không hỗ trợ I/O
     qua epoll / kqueue / IOCP                                   bất đồng bộ thực sự cho tệp tin
             │                                                               │
  ├── TCP / UDP Sockets (net, http)                            ├── Filesystem Operations (fs.*)
  ├── TLS / SSL Handshake sockets                              ├── DNS Resolution (dns.lookup)
  ├── Child Processes (pipes, signals)                         ├── Cryptography (crypto.pbkdf2, hash)
  └── TTY (console input/output)                               └── Compression (zlib.*)
\`\`\`

### 3.1 Vấn Đề Với Thao Tác Đọc/Ghi Tập Tin (File System)
Tại sao \`fs.readFile\` lại phải dùng Threadpool trong khi socket mạng thì không?
* Trên Linux, tập tin trên đĩa cứng (regular files) **không hỗ trợ cơ chế polling bất đồng bộ thông thường** như socket. Lời gọi hàm \`read()\` trên file thông thường luôn bị block ở tầng kernel cho đến khi ổ đĩa nạp xong dữ liệu vào bộ nhớ đệm (Page Cache).
* Do đó, Libuv bắt buộc phải chuyển các tác vụ \`fs.*\` sang các luồng trong Threadpool để tránh làm đóng băng Main Thread của V8.

### 3.2 Tinh Chỉnh Biến Môi Trường UV_THREADPOOL_SIZE
Mặc định, Libuv chỉ khởi tạo **4 luồng** (\`UV_THREADPOOL_SIZE = 4\`).
Nếu đại ca chạy 8 tác vụ mã hóa mật khẩu \`crypto.pbkdf2()\` đồng thời, 4 tác vụ đầu tiên sẽ chiếm dụng sạch 4 luồng, 4 tác vụ còn lại bị xếp hàng chờ hoàn toàn, làm tăng gấp đôi thời gian đáp ứng!
* **Quy tắc cấu hình Production:** Có thể tăng lên tối đa 128 luồng bằng biến môi trường:
\`\`\`bash
UV_THREADPOOL_SIZE=16 node dist/main.js
\`\`\`
*(Lưu ý: Biến này bắt buộc phải được thiết lập trước khi Node.js khởi động, việc gán \`process.env.UV_THREADPOOL_SIZE\` trong code JavaScript sau khi app đã chạy sẽ hoàn toàn không có tác dụng).*

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Dưới Kernel (Kernel I/O Subsystem Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NODE.JS RUNTIME APIS                               │
│        [ http.get() / socket.write() ]           [ fs.readFile() / crypto ] │
└───────────────────────┬──────────────────────────────────────┬──────────────┘
                        │                                      │
┌───────────────────────▼────────────────────────┐ ┌───────────▼──────────────┐
│ LIBUV NON-BLOCKING SUBSYSTEM                   │ │ LIBUV WORKER THREADPOOL  │
│ (0 Threads - Event Multiplexing)               │ │ (Mặc định 4 OS Threads)  │
└───────────────────────┬────────────────────────┘ └───────────┬──────────────┘
                        │                                      │
┌───────────────────────▼──────────────────────────────────────▼──────────────┐
│ OPERATING SYSTEM KERNEL (LINUX)                                             │
│  ├── epoll_create(), epoll_ctl(), epoll_wait() ◄── Socket Descriptors        │
│  ├── Disk I/O Block Driver (Page Cache / NVMe) ◄── Filesystem Requests      │
│  └── Kernel Network Stack (TCP Receive Buffer) ◄── Network Packets          │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Tiếp Nhận Gói Tin Mạng Cấp Thấp (Network Packet Lifecycle)
\`\`\`diagram
1. Client gửi HTTP GET Request qua mạng Internet
   │
2. Card mạng máy chủ (NIC) nhận gói tin vật lý ──► Kích hoạt CPU Hardware Interrupt
   │
3. Linux Kernel sao chép dữ liệu vào TCP Socket Receive Buffer
   │
4. Kernel tự động thêm Socket File Descriptor vào epoll Ready List
   │
5. Libuv Main Thread đang chờ ở Pha POLL: epoll_wait() thức giấc trong O(1)
   │
6. Libuv đọc dữ liệu thô vào Buffer cấp C++ và kích hoạt callback V8 JavaScript
   │
7. NestJS Controller tiếp nhận Request Object và xử lý logic nghiệp vụ
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý I/O Nặng (I/O Architecture Decision Tree)
\`\`\`diagram
TÁC VỤ CẦN THỰC THI TRONG BACKEND LÀ GÌ?
│
├── Là kết nối Mạng (HTTP, WebSocket, Microservice RPC, Database TCP)?
│   └──► Kernel epoll/kqueue tự động xử lý Non-blocking (Không cần tăng Threadpool)
│
├── Là thao tác Đĩa cứng (Đọc file Excel, ghi Log file, upload ảnh)?
│   ├── Kích thước nhỏ: Sử dụng fs.promises (Dùng Libuv Threadpool)
│   └── File rất lớn (>50MB): BẮT BUỘC dùng Stream (fs.createReadStream) để tránh tràn RAM
│
├── Là tác vụ Mã hóa / Nén (Bcrypt, Crypto hashing, Gzip compress)?
│   ├── Khối lượng vừa phải: Dùng crypto bất đồng bộ, cân nhắc tăng UV_THREADPOOL_SIZE
│   └── Khối lượng cực lớn liên tục: Đẩy sang Worker Threads hoặc tách Microservice chuyên biệt
│
└── Là tác vụ Tính toán CPU thuần túy (Xử lý ảnh, parse CSV hàng triệu dòng)?
    └──► TUYỆT ĐỐI KHÔNG dùng Threadpool (Sẽ block Main Thread) ──► Dùng Worker Threads!
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Kỹ Thuật I/O | Tiêu Hao Bộ Nhớ RAM | Khả Năng Scale Kết Nối | Nguy Cơ Nghẽn Hệ Thống | Kịch Bản Ứng Dụng Lý Tưởng |
| :--- | :--- | :--- | :--- | :--- |
| **Kernel epoll/kqueue** | Cực thấp (~vài KB mỗi socket) | Hơn 100,000 kết nối đồng thời | Hầu như không có, phụ thuộc băng thông mạng | Máy chủ API REST, Gateway WebSocket, Microservices |
| **Libuv Threadpool (Default 4)** | Thấp (~8MB cho 4 threads) | Giới hạn 4 tác vụ song song | Bị nghẽn queue nếu nhiều tác vụ crypto/fs cùng lúc | Đọc file cấu hình, hash mật khẩu thông thường |
| **Libuv Threadpool (Size 64-128)**| Cao hơn (~128MB-256MB RAM stack) | Xử lý được nhiều tác vụ fs/crypto | CPU Context Switching overhead nếu CPU ít core | Máy chủ xử lý chuyển đổi tệp tin, nén ảnh hàng loạt |
| **Worker Threads (Chuyên dụng)** | Cao (~30MB-50MB mỗi Worker Isolate) | Tùy thuộc số lượng Core vật lý của CPU | Nếu spawn quá nhiều worker sẽ làm sập máy chủ do OOM | Tính toán thuật toán nặng, parse file bảng tính phức tạp |
`,
      realCodeSnippet: `// File: src/modules/security/crypto/crypto-threadpool-manager.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - Asynchronous Crypto Offloading & Threadpool Protection
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';

export interface HashTaskResult {
  derivedKey: string;
  durationMs: number;
  threadpoolSaturated: boolean;
}

/**
 * ADR: Quản trị tác vụ CPU-bound mã hóa mật khẩu trên Libuv Threadpool:
 * 1. pbkdf2 chạy bất đồng bộ trên C++ Worker Threadpool của Libuv (mặc định 4 threads).
 * 2. Cần giới hạn số lượng tác vụ đồng thời để tránh làm tắc nghẽn (Threadpool Starvation)
 *    khiến các tác vụ filesystem (fs) và DNS lookup (getaddrinfo) bị chậm trễ.
 */
@Injectable()
export class CryptoThreadpoolManagerService implements OnModuleInit {
  private readonly logger = new Logger(CryptoThreadpoolManagerService.name);
  private activeCryptoTasks = 0;
  private readonly maxConcurrentCryptoTasks = 4; // Bằng kích thước mặc định UV_THREADPOOL_SIZE

  onModuleInit(): void {
    const poolSize = process.env.UV_THREADPOOL_SIZE ?? '4 (default)';
    this.logger.log(\`Khởi tạo CryptoThreadpoolManagerService. Libuv UV_THREADPOOL_SIZE: \${poolSize}\`);
  }

  public async hashPasswordAsync(password: string, salt: string, iterations = 100000): Promise<HashTaskResult> {
    if (!password || !salt) {
      throw new Error('INVALID_CRYPTO_ARGUMENTS');
    }

    const start = Date.now();
    const isSaturated = this.activeCryptoTasks >= this.maxConcurrentCryptoTasks;
    if (isSaturated) {
      this.logger.warn(\`Threadpool cảnh báo quá tải: \${this.activeCryptoTasks} tác vụ crypto đang chiếm dụng thread!\`);
    }

    this.activeCryptoTasks++;
    try {
      const derivedKey = await new Promise<string>((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, key) => {
          if (err) {
            return reject(err);
          }
          resolve(key.toString('hex'));
        });
      });

      const durationMs = Date.now() - start;
      return {
        derivedKey,
        durationMs,
        threadpoolSaturated: isSaturated,
      };
    } finally {
      this.activeCryptoTasks--;
    }
  }
}`,
      quiz: [
        {
          id: 'c2-l2-q1',
          question: 'Vì sao Linux epoll vượt trội hơn hẳn các system call cũ như select() hay poll() khi phục vụ hàng chục nghìn kết nối mạng đồng thời?',
          options: [
            'Vì epoll tự động nén toàn bộ các gói tin TCP ở tầng phần cứng Card mạng (NIC) trước khi nạp vào bộ nhớ RAM.',
            'Vì epoll tạo ra một luồng hệ điều hành riêng biệt cho từng socket mở, giúp tận dụng tối đa số lượng CPU Core.',
            'Vì epoll quản lý danh bạ File Descriptors bằng cây đỏ-đen (Red-Black Tree) trong Kernel và sử dụng Ready List để trả về danh sách các socket có sự kiện với độ phức tạp O(1), thay vì phải quét tuyến tính O(N) qua toàn bộ mảng socket như select/poll.',
            'Vì epoll chỉ hỗ trợ giao thức HTTP/3 qua UDP và tự động loại bỏ các cơ chế bắt tay ba bước phức tạp của TCP.'
          ],
          correctIndex: 2,
          explanation: 'Với select và poll, mỗi lần kiểm tra xem socket nào có dữ liệu, ứng dụng phải gửi toàn bộ danh sách socket xuống kernel để duyệt tuyến tính O(N). Với epoll, kernel duy trì cây đỏ-đen và Ready List; khi socket có dữ liệu do card mạng kích hoạt ngắt, kernel chỉ đưa socket đó vào Ready List, giúp epoll_wait trả về danh sách các socket sẵn sàng trong thời gian O(1).'
        },
        {
          id: 'c2-l2-q2',
          question: 'Những tác vụ nào sau đây trong Node.js thực sự được chuyển giao (offload) sang Libuv Worker Threadpool, thay vì dùng cơ chế Non-blocking I/O hướng sự kiện của Kernel?',
          options: [
            'Kết nối TCP socket, máy chủ HTTP tiếp nhận request và kết nối WebSocket qua mạng.',
            'Thao tác đọc/ghi tệp tin trên ổ đĩa (fs), phân giải DNS qua dns.lookup, hàm băm mật mã (crypto.pbkdf2, scrypt) và nén dữ liệu (zlib).',
            'Phân tích cú pháp chuỗi JSON, thuật toán sắp xếp mảng và các vòng lặp tính toán logic nghiệp vụ JavaScript.',
            'Các hàm điều phối luồng như process.nextTick, Promise microtasks và hàm gán biến môi trường process.env.'
          ],
          correctIndex: 1,
          explanation: 'Nhân Linux không hỗ trợ cơ chế bất đồng bộ hoàn toàn cho tập tin đĩa (regular files) và DNS lookup (hàm getaddrinfo của hệ thống là blocking). Do đó, Libuv bắt buộc phải chuyển giao các tác vụ fs, dns.lookup, crypto và zlib sang Libuv Threadpool (mặc định 4 threads) để tránh làm nghẽn luồng chính V8. Ngược lại, TCP/HTTP network socket dùng epoll/kqueue hoàn toàn non-blocking ở tầng kernel.'
        },
        {
          id: 'c2-l2-q3',
          question: 'Nếu một kỹ sư viết dòng lệnh process.env.UV_THREADPOOL_SIZE = "16" bên trong tệp main.ts của ứng dụng NestJS, kết quả thực tế tại runtime sẽ như thế nào?',
          options: [
            'Hoàn toàn không có tác dụng; Libuv Threadpool đã được khởi tạo kích thước cố định ở tầng C++ ngay khi tiến trình Node.js khởi động, trước khi V8 engine nạp và thực thi dòng code JavaScript đầu tiên.',
            'Threadpool lập tức mở rộng lên 16 worker threads và xử lý song song ngay các tác vụ fs đang xếp hàng.',
            'Node.js ném ra ngoại lệ UnhandledPromiseRejection và buộc tiến trình phải dừng lại do vi phạm quyền ghi biến môi trường hệ thống.',
            'Kích thước threadpool được nâng lên 16 nhưng chỉ có tác dụng đối với các tác vụ mã hóa crypto, còn các tác vụ đọc ghi file vẫn giữ nguyên mức 4 threads.'
          ],
          correctIndex: 0,
          explanation: 'Libuv khởi tạo Threadpool tại thời điểm bootstrap tiến trình C++ của Node.js, trước khi V8 Engine nạp và chạy mã JS. Do đó, việc thay đổi biến process.env trong mã nguồn là quá muộn và không có bất kỳ tác dụng nào. Biến này bắt buộc phải được truyền từ shell trước khi tiến trình khởi chạy (ví dụ: UV_THREADPOOL_SIZE=16 node dist/main.js).'
        },
        {
          id: 'c2-l2-q4',
          question: 'Điều gì xảy ra khi hệ thống backend tiếp nhận 8 yêu cầu băm mật khẩu bằng crypto.pbkdf2() cùng lúc trong khi UV_THREADPOOL_SIZE đang giữ nguyên giá trị mặc định là 4?',
          options: [
            '4 yêu cầu đến sau lập tức bị từ chối với mã phản hồi HTTP 503 Service Unavailable để tránh sập máy chủ.',
            'V8 engine tự động chuyển 4 yêu cầu bị nghẽn sang thực thi đồng bộ ngay trên luồng chính Call Stack.',
            'Cả 8 yêu cầu được chia sẻ thời gian xung nhịp CPU và hoàn thành gần như đồng thời sau cùng một khoảng thời gian.',
            '4 yêu cầu đầu tiên chiếm dụng toàn bộ 4 worker threads của Libuv; 4 yêu cầu đến sau buộc phải nằm chờ trong hàng đợi threadpool, dẫn đến thời gian phản hồi của chúng bị kéo dài gấp đôi.'
          ],
          correctIndex: 3,
          explanation: 'Vì mặc định UV_THREADPOOL_SIZE = 4, 4 tác vụ crypto.pbkdf2 đầu tiên sẽ chiếm giữ toàn bộ 4 worker threads. 4 tác vụ còn lại phải chờ trong hàng đợi Libuv cho đến khi có worker thread rảnh rỗi, dẫn đến tổng thời gian hoàn thành của đợt thứ hai bị nhân đôi (hiện tượng Threadpool Contention).'
        },
        {
          id: 'c2-l2-q5',
          question: 'Tại sao nhân hệ điều hành Linux truyền thống lại không hỗ trợ cơ chế Non-blocking I/O hoàn hảo cho tệp tin thông thường (Regular Files) như đối với Network Sockets?',
          options: [
            'Vì các tập tin trên đĩa cứng luôn được mã hóa ở cấp độ BIOS khiến nhân hệ điều hành không thể đọc trực tiếp.',
            'Vì kiến trúc Linux coi tệp tin cục bộ luôn sẵn sàng thông qua bộ nhớ đệm trang (Page Cache); khi trang bộ nhớ chưa có dữ liệu (Cache Miss), lời gọi read/write buộc phải chặn (block) để chờ phần cứng đĩa nạp dữ liệu.',
            'Vì tập tin trên đĩa không có File Descriptor (FD) mà chỉ được định danh bằng đường dẫn inode.',
            'Vì hệ thống tệp tin Ext4 và XFS không hỗ trợ cấu trúc dữ liệu bảng băm cho các con trỏ tệp.'
          ],
          correctIndex: 1,
          explanation: 'Trong thiết kế Unix/Linux, các tệp tin trên đĩa cứng luôn được ánh xạ qua Page Cache của kernel. Kernel luôn mặc định tệp tin có thể đọc được ngay từ RAM. Nếu xảy ra Page Cache Miss, kernel phải dừng luồng gọi hàm để nạp dữ liệu từ ổ cứng vật lý. Do đó, các cờ O_NONBLOCK không có tác dụng với regular files trên Linux truyền thống, buộc Libuv phải dùng Threadpool.'
        },
        {
          id: 'c2-l2-q6',
          question: 'Trong module DNS của Node.js, điểm khác biệt căn bản giữa dns.lookup() và dns.resolve() là gì?',
          options: [
            'dns.lookup() gọi hàm đồng bộ getaddrinfo() của hệ điều hành nên bị offload sang Libuv Threadpool (có nguy cơ nghẽn pool), trong khi dns.resolve() kết nối trực tiếp đến DNS server qua network socket bằng thư viện c-ares hoàn toàn non-blocking.',
            'dns.lookup() sử dụng giao thức UDP, còn dns.resolve() bắt buộc phải sử dụng giao thức TCP có mã hóa TLS.',
            'dns.lookup() chỉ phân giải được địa chỉ IPv6, còn dns.resolve() chỉ phân giải được địa chỉ IPv4.',
            'dns.lookup() thực thi trực tiếp trên GPU, còn dns.resolve() chạy trên CPU Main Thread.'
          ],
          correctIndex: 0,
          explanation: 'dns.lookup sử dụng hàm getaddrinfo() của thư viện C hệ điều hành, tuân theo file cấu hình /etc/hosts và /etc/resolv.conf, nhưng vì getaddrinfo là blocking nên Libuv phải nạp nó vào Threadpool. Ngược lại, dns.resolve sử dụng thư viện c-ares, tự tạo kết nối mạng UDP/TCP trực tiếp tới DNS server, hoàn toàn non-blocking và không tốn thread trong Libuv Threadpool.'
        },
        {
          id: 'c2-l2-q7',
          question: 'Nếu triển khai một container backend chạy trên máy ảo chỉ có 2 vCPU, việc thiết lập UV_THREADPOOL_SIZE=128 có thể mang lại tác dụng ngược tiêu cực nào?',
          options: [
            'V8 Engine sẽ tự động tắt tính năng thu gom rác Garbage Collector để dành tài nguyên cho các luồng.',
            'Không có tác dụng ngược nào; càng nhiều thread thì hiệu năng xử lý tác vụ đọc ghi tệp và crypto càng tăng tỷ lệ thuận.',
            'Gây ra hiện tượng CPU Thrashing do chi phí chuyển đổi ngữ cảnh (Context Switching) giữa 128 luồng tranh chấp 2 lõi CPU vật lý quá lớn, làm giảm thông lượng tổng thể của hệ thống.',
            'Hệ điều hành Linux sẽ tự động chuyển tiến trình sang chế độ đơn luồng để bảo vệ CPU.'
          ],
          correctIndex: 2,
          explanation: 'Khi số lượng luồng vượt quá xa số lõi CPU vật lý (ví dụ: 128 threads trên 2 vCPU), hệ điều hành phải liên tục dừng một luồng và nạp trạng thái luồng khác (Context Switching Overhead). Chi phí lưu/khôi phục registers, làm mất hiệu lực CPU cache (Cache Invalidation) sẽ ngốn phần lớn chu kỳ CPU, khiến hiệu năng thực tế bị sụt giảm nghiêm trọng (CPU Thrashing).'
        },
        {
          id: 'c2-l2-q8',
          question: 'Ba hàm API cấp thấp của Linux epoll (epoll_create, epoll_ctl, epoll_wait) phối hợp với nhau như thế nào trong vòng đời xử lý I/O mạng của Libuv?',
          options: [
            'epoll_create mở một tệp tin tạm; epoll_ctl ghi dữ liệu vào tệp; epoll_wait đọc dữ liệu từ tệp ra ngoài.',
            'epoll_create cấp phát mảng 1024 phần tử; epoll_ctl duyệt tuyến tính mảng; epoll_wait giải phóng bộ nhớ Stack.',
            'epoll_create khởi tạo socket UDP; epoll_ctl thực hiện bắt tay TLS; epoll_wait đóng kết nối mạng.',
            'epoll_create tạo một epoll instance trong kernel; epoll_ctl đăng ký/sửa/xóa các socket File Descriptor cần theo dõi trên cây Red-Black; epoll_wait đưa luồng chính vào trạng thái ngủ chờ cho đến khi có socket sẵn sàng trong Ready List.'
          ],
          correctIndex: 3,
          explanation: 'epoll_create khởi tạo một đối tượng epoll trong không gian kernel. epoll_ctl thêm, chỉnh sửa hoặc xóa các File Descriptor cần theo dõi trong cây đỏ-đen. epoll_wait đưa luồng gọi vào trạng thái chờ (sleep) cho đến khi kernel ghi nhận có gói tin đến và đưa FD vào Ready List, lúc đó luồng được đánh thức ngay lập tức với chi phí O(1).'
        }
      ],
      codeChallenge: {
        id: 'c2-l2-c1',
        title: 'Giới Hạn Tác Vụ Bất Đồng Bộ Đồng Thời (Concurrency Task Pool)',
        description: 'Hiện thực hàm \`limitConcurrency<T>(tasks: Array<() => Promise<T>>, maxConcurrency: number): Promise<T[]>\` nhận vào danh sách các hàm tác vụ bất đồng bộ \`tasks\` và số lượng tác vụ tối đa được chạy đồng thời \`maxConcurrency\`. Hàm phải điều phối để tại bất kỳ thời điểm nào không có quá \`maxConcurrency\` tác vụ đang được thực thi. Kết quả trả về là một mảng chứa kết quả của từng tác vụ theo đúng thứ tự ban đầu trong mảng \`tasks\`. Nếu \`tasks\` rỗng hoặc \`maxConcurrency <= 0\`, trả về mảng rỗng \`[]\`. Nếu \`tasks\` không phải là mảng, ném Error("INVALID_TASKS_ARRAY").',
        starterCode: `export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number
): Promise<T[]> {
  // TODO: Điều phối thực thi tasks với ngưỡng maxConcurrency
  return [];
}`,
        solution: `export async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrency: number
): Promise<T[]> {
  if (tasks === null || tasks === undefined || !Array.isArray(tasks)) {
    throw new Error('INVALID_TASKS_ARRAY');
  }
  if (tasks.length === 0 || typeof maxConcurrency !== 'number' || maxConcurrency <= 0) {
    return [];
  }

  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      results[taskIndex] = await tasks[taskIndex]();
    }
  };

  const poolSize = Math.min(maxConcurrency, tasks.length);
  const workers = Array.from({ length: poolSize }, () => worker());
  await Promise.all(workers);

  return results;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Chạy 3 tác vụ với maxConcurrency = 2',
            input: [[() => Promise.resolve('A'), () => Promise.resolve('B'), () => Promise.resolve('C')], 2],
            expected: ['A', 'B', 'C'],
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Xử lý tuần tự khi maxConcurrency = 1',
            input: [[() => Promise.resolve(10), () => Promise.resolve(20), () => Promise.resolve(30)], 1],
            expected: [10, 20, 30],
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Danh sách tác vụ rỗng -> Trả về mảng rỗng',
            input: [[], 4],
            expected: [],
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): maxConcurrency <= 0 -> Trả về mảng rỗng',
            input: [[() => Promise.resolve('skip')], -1],
            expected: [],
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): tasks không hợp lệ (null) -> Ném lỗi INVALID_TASKS_ARRAY',
            input: [null, 2],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c2-l3',
      title: 'Bài 03: Quản Trị Event Loop Lag, Worker Threads & Xử Lý Tác Vụ Tính Toán Nặng (CPU Offloading)',
      duration: '60 phút',
      tag: 'Profiling & Multi-threading',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐÁNH ĐỔI GIỮA I/O-BOUND VÀ CPU-BOUND TRÊN KIẾN TRÚC EVENT LOOP

Nguyên lý nền tảng giúp Node.js đạt hiệu năng I/O vượt trội là: **Toàn bộ ứng dụng dựa trên giả định mọi tác vụ trên Main Thread đều kết thúc sau vài phần triệu giây (Microseconds)**.

Khi giả định này bị phá vỡ bởi một tác vụ tính toán CPU nặng (CPU-bound Task), hệ thống sẽ đối mặt với sự sụp đổ dây chuyền:

* **Sự khác biệt bản chất giữa I/O-bound và CPU-bound:**
  - **Tác vụ I/O-bound (Truy vấn DB, đọc Redis, gọi HTTP API bên ngoài):** 99% thời gian là chờ đợi mạng. Luồng chính Node.js không bị chặn vì chỉ việc ủy thác cho Kernel rồi chuyển sang phục vụ request khác.
  - **Tác vụ CPU-bound (Phân tích cú pháp JSON payload 50MB, nén file zip/gzip, xử lý hình ảnh sharp, tính toán thuật toán mã hóa):** CPU core bị ép thực thi tính toán liên tục 100% công suất mà không bao giờ nhường quyền thực thi cho Event Loop.

* **Thảm họa Event Loop Lag trong môi trường Production:**
  - Khi một tác vụ CPU-bound chiếm giữ Main Thread trong 3.5 giây:
    + Toàn bộ 5,000 kết nối HTTP đồng thời khác bị đóng băng tại pha Poll của Libuv.
    + Trình duyệt client bị timeout (\`504 Gateway Timeout\`), người dùng liên tục bấm F5 gửi thêm request mới, gây ra hiện tượng bão request (Retry Storm).
    + Các endpoint giám sát sức khỏe (\`/healthz\` Liveness/Readiness Probe của Kubernetes) không nhận được phản hồi trong ngưỡng 3 giây.
    + **Hệ quả chết người:** Kubernetes nhận định Container đã bị chết đứng (Deadlock/Frozen) và tiến hành tiêu diệt (Restart/Kill Pod). Hàng nghìn người dùng bị rớt kết nối đột ngột, toàn bộ dịch vụ rơi vào vòng lặp CrashLoopBackOff!

* **Giải pháp Kiến trúc Chuẩn Mực: Worker Threads & Multi-Process Clustering:**
  - Không bao giờ chạy tác vụ CPU-bound trên Main Thread.
  - Sử dụng module \`worker_threads\` để tạo các tiến trình con độc lập chạy trên các CPU Cores riêng biệt, giao tiếp bất đồng bộ qua kênh truyền tin \`MessagePort\` (sử dụng cấu trúc sao chép bộ nhớ \`Structured Clone\` hoặc vùng nhớ chia sẻ tốc độ cao \`SharedArrayBuffer\`).
  - Luồng chính chỉ đóng vai trò tiếp nhận, giao việc xuống Worker Thread và trả response cho client ngay khi nhận được tín hiệu hoàn tất.

---

# 2. GIÁM SÁT EVENT LOOP LAG VỚI PERF_HOOKS

Khi hệ thống bị nghẽn CPU, biểu hiện đầu tiên không phải là lỗi 500, mà là **Event Loop Lag (Độ trễ vòng lặp)** tăng vọt:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHU KỲ ĐO ĐẠC EVENT LOOP LAG BÌNH THƯỜNG                  │
│                                                                             │
│  [ Tick 1: 1ms ] ──► [ Tick 2: 1ms ] ──► [ Tick 3: 2ms ] ──► [ Tick 4: 1ms ]│
│  (Mọi HTTP Request được tiếp nhận và phản hồi ngay lập tức trong vài ms)    │
├─────────────────────────────────────────────────────────────────────────────┤
│                   KHI BỊ NGHẼN CPU (JSON.parse file 50MB)                   │
│                                                                             │
│  [ Tick 1: 1ms ] ──► [ TICK 2: NGHẼN 3500ms !!! ] ──► [ Tick 3: 1ms ]      │
│                            │                                                │
│                            └──► Toàn bộ 5,000 HTTP Requests khác bị kẹt,    │
│                                 Health Check Timeout, Kubernetes Kill Pod!  │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Sử Dụng monitorEventLoopDelay Trong Production
Node.js cung cấp module chuẩn \`perf_hooks\` để đo đạc độ trễ Event Loop với độ chính xác nanosecond mà không làm tốn tài nguyên CPU:
\`\`\`typescript
import { monitorEventLoopDelay } from 'perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// Lấy chỉ số phân vị (Percentiles)
console.log('P50 Lag:', histogram.percentile(50) / 1e6, 'ms');
console.log('P99 Lag:', histogram.percentile(99) / 1e6, 'ms');
console.log('Max Lag:', histogram.max / 1e6, 'ms');
\`\`\`
> **Ngưỡng cảnh báo Production:** Nếu chỉ số P99 Lag vượt quá **50ms**, hệ thống đang có nguy cơ nghẽn nghiêm trọng. Nếu vượt quá **1000ms**, Kubernetes Liveness Probe sẽ đánh dấu Pod Unhealthy và Restart liên tục (CrashLoopBackOff)!

---

# 3. WORKER THREADS: KIẾN TRÚC ĐA LUỒNG THỰC SỰ TRONG NODE.JS

Khi buộc phải thực hiện các phép toán nặng (nén video, tạo file PDF hóa đơn hàng nghìn trang, parse file Excel 200MB, thuật toán ML/AI), giải pháp chuẩn là **\`worker_threads\`**:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│ MAIN THREAD PROCESS (Node.js Process)                                       │
│                                                                             │
│  ┌────────────────────────┐                   ┌──────────────────────────┐  │
│  │ V8 Isolate (Main)      │                   │ V8 Isolate (Worker 1)    │  │
│  │ - Call Stack riêng     │                   │ - Call Stack riêng       │  │
│  │ - V8 Heap riêng (2GB)  │                   │ - V8 Heap riêng          │  │
│  │ - Event Loop riêng     │                   │ - Event Loop riêng       │  │
│  └───────────┬────────────┘                   └────────────▲─────────────┘  │
│              │                                             │                │
│              │         MessageChannel (IPC)                │                │
│              └────────► [ postMessage(data) ] ─────────────┘                │
│                         (Structured Clone / SharedArrayBuffer)              │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 3.1 Sự Khác Biệt Giữa Worker Thread và Child Process
1. **Child Process (\`child_process.fork\`):** Khởi tạo một tiến trình OS hoàn toàn mới, tiêu tốn 30MB-50MB RAM tối thiểu, giao tiếp qua IPC socket serialize/deserialize chậm chạp.
2. **Worker Thread (\`worker_threads\`):** Chạy trong cùng một tiến trình OS, có V8 Isolate độc lập (Heap và Stack riêng), nhưng có thể chia sẻ bộ nhớ vật lý cực nhanh thông qua **\`SharedArrayBuffer\`** ($0\\%$ serialization overhead)!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Xử Lý CPU (CPU Offloading Taxonomy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CHIẾN LƯỢC ĐIỀU PHỐI TÁC VỤ BACKEND                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. TÁC VỤ I/O-BOUND (Database, HTTP API, Redis, Socket)                     │
│    └──► Giao cho Main Thread + Libuv epoll (Không cần luồng phụ)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TÁC VỤ CPU-BOUND NHẸ (<10ms: parse object vừa phải, regex ngắn)          │
│    └──► Chạy trực tiếp trên Main Thread                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TÁC VỤ CPU-BOUND TRUNG BÌNH (10ms - 200ms: xuất Excel, resize 1 ảnh)     │
│    └──► Sử dụng Worker Thread Pool (Tái sử dụng luồng, tránh spawn liên tục)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. TÁC VỤ CPU-BOUND NẶNG (>200ms: convert video, AI inference, render PDF)  │
│    └──► Đẩy ra Background Job Queue (BullMQ / Redis Worker) độc lập         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Giao Tiếp Hai Chiều Main - Worker (Thread Communication Flow)
\`\`\`diagram
[ MAIN THREAD (NestJS Service) ]                 [ WORKER THREAD (Background) ]
               │                                                │
               ├── 1. Khởi tạo: new Worker('./calc.worker.js') ──►
               │                                                │
               ├── 2. Gửi dữ liệu: worker.postMessage(payload) ─►
               │                                                ├── 3. Nhận tin: parentPort.on('message')
               │                                                ├── 4. Chạy toán nặng độc lập trên CPU Core riêng
               │                                                │    (Main Thread rảnh tay phục vụ HTTP)
               │                                                │
               │ ◄── 5. Báo kết quả: parentPort.postMessage(res)─┤
               │                                                │
               └── 6. Nhận kết quả: worker.on('message', cb) ───┘
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý CPU Lag (Lag Mitigation Decision Tree)
\`\`\`diagram
HỆ THỐNG GẶP TÌNH TRẠNG EVENT LOOP LAG CAO (>50MS)?
│
├── Nguyên nhân do đâu?
│   ├── Do truy vấn Database chậm?
│   │   └──► Thêm Index, kiểm tra EXPLAIN ANALYZE (Không liên quan đến Worker)
│   │
│   ├── Do JSON.parse hoặc JSON.stringify chuỗi dữ liệu hàng trăm MB?
│   │   └──► Chuyển sang Stream JSON Parser (ví dụ: oboe, stream-json)
│   │
│   ├── Do thuật toán tính toán nặng (Crypto, Băm mã, Xử lý chuỗi đệ quy)?
│   │   ├── Cần phản hồi ngay trong HTTP Request: Dùng Worker Threads Pool (Piscina)
│   │   └── Có thể chạy bất đồng bộ: Đẩy vào Queue BullMQ sang Service chuyên trách
│   │
│   └── Do rò rỉ bộ nhớ khiến Garbage Collector chạy dồn dập (GC Thrashing)?
│       └──► Chụp Heap Snapshot phân tích Retained Size để triệt tiêu Leak
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế Xử Lý | Chi Phí Khởi Tạo (Overhead) | Cơ Chế Giao Tiếp (IPC) | Rủi Ro Vận Hành | Kịch Bản Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **Main Thread trực tiếp** | 0 ms (Có sẵn) | Trực tiếp trong bộ nhớ | Gây tê liệt toàn bộ API của hệ thống | Phép toán cực ngắn (<5ms), logic CRUD chuẩn |
| **Worker Threads** | ~10ms - 30ms (Spawn Isolate) | MessagePort (Structured Clone/ArrayBuffer) | Rò rỉ RAM nếu không dùng Worker Pool tái sử dụng | Xuất báo cáo, nén dữ liệu, tính điểm định kỳ |
| **Child Process (Fork)** | ~50ms - 100ms (New OS Process) | OS Pipe IPC (JSON Serialize) | Ngốn nhiều RAM nhất trong 3 cơ chế | Chạy script Python, thực thi binary CLI riêng |
| **External Queue Worker** | Phụ thuộc độ trễ mạng Redis | Message Broker Network Packets | Tăng độ phức tạp kiến trúc phân tán | Xử lý video, tác vụ chạy ngầm mất nhiều phút |
`,
      realCodeSnippet: `// File: src/modules/health/indicators/event-loop-health.indicator.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - Production Event Loop Lag Health Indicator
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';

export interface EventLoopHealthReport {
  status: 'UP' | 'DOWN';
  p50LagMs: number;
  p90LagMs: number;
  p99LagMs: number;
  maxLagMs: number;
  thresholdMs: number;
}

/**
 * ADR: Giám sát Event Loop Lag theo thời gian thực để bảo vệ Pod Kubernetes:
 * - Sử dụng monitorEventLoopDelay từ perf_hooks với độ phân giải nano giây.
 * - Cung cấp chỉ số P99 Event Loop Delay cho Liveness/Readiness Probe.
 * - Tự động kích hoạt Circuit Breaker khi P99 vượt ngưỡng an toàn (mặc định 50ms).
 */
@Injectable()
export class EventLoopHealthIndicatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLoopHealthIndicatorService.name);
  private histogram: IntervalHistogram | null = null;
  private readonly lagThresholdMs = 50;

  onModuleInit(): void {
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();
    this.logger.log('Khởi tạo EventLoopHealthIndicatorService: Bật perf_hooks event loop delay monitor.');
  }

  onModuleDestroy(): void {
    if (this.histogram) {
      this.histogram.disable();
      this.histogram = null;
    }
  }

  public checkHealth(): EventLoopHealthReport {
    if (!this.histogram) {
      throw new Error('HISTOGRAM_NOT_INITIALIZED');
    }

    const p50LagMs = Number((this.histogram.percentile(50) / 1e6).toFixed(2));
    const p90LagMs = Number((this.histogram.percentile(90) / 1e6).toFixed(2));
    const p99LagMs = Number((this.histogram.percentile(99) / 1e6).toFixed(2));
    const maxLagMs = Number((this.histogram.max / 1e6).toFixed(2));

    const isHealthy = p99LagMs <= this.lagThresholdMs;

    if (!isHealthy) {
      this.logger.warn(\`Event Loop Degraded! P99: \${p99LagMs}ms > Threshold: \${this.lagThresholdMs}ms\`);
    }

    // Reset histogram định kỳ sau mỗi chu kỳ kiểm tra probe để tránh tích lũy độ trễ cũ
    this.histogram.reset();

    return {
      status: isHealthy ? 'UP' : 'DOWN',
      p50LagMs,
      p90LagMs,
      p99LagMs,
      maxLagMs,
      thresholdMs: this.lagThresholdMs,
    };
  }
}`,
      quiz: [
        {
          id: 'c2-l3-q1',
          question: 'Khi một tác vụ CPU-bound (như JSON.parse 100MB) chiếm giữ luồng chính trong 4 giây, vì sao dịch vụ Node.js trên Kubernetes thường bị rơi vào vòng lặp tử thần CrashLoopBackOff?',
          options: [
            'Vì Linux Kernel phát hiện CPU usage đạt 100% trong 4 giây và tự động gửi tín hiệu SIGKILL để bảo vệ phần cứng máy chủ.',
            'Vì luồng chính bị đóng băng nên không thể tiếp nhận và phản hồi HTTP request kiểm tra sức khỏe của Kubernetes Liveness Probe (/healthz); Kubernetes coi Pod đã bị treo (Deadlock) và tiến hành tiêu diệt rồi khởi động lại container liên tục.',
            'Vì Libuv Threadpool bị cạn kiệt bộ nhớ ảo swap, khiến toàn bộ tiến trình V8 bị tràn RAM và ném lỗi Out-Of-Memory.',
            'Vì mạng nội bộ SDN của Kubernetes tự động ngắt kết nối TCP của các Pod có độ trễ phân giải DNS vượt quá 2000ms.'
          ],
          correctIndex: 1,
          explanation: 'Kubelet định kỳ gửi HTTP request đến Liveness Probe endpoint để kiểm tra Pod có còn sống hay không. Khi luồng chính V8 bị chặn bởi tác vụ CPU-bound, request này không được xử lý trong thời gian timeout (thường là 1-3s), Kubelet kết luận container đã chết và kill Pod, gây ra tình trạng CrashLoopBackOff.'
        },
        {
          id: 'c2-l3-q2',
          question: 'Khi cần chuyển giao một khối dữ liệu nhị phân lớn (200MB) giữa Main Thread và Worker Thread trong Node.js, giải pháp nào giúp tối ưu bộ nhớ và loại bỏ hoàn toàn độ trễ sao chép (zero-copy)?',
          options: [
            'Sử dụng JSON.stringify trên Main Thread rồi truyền chuỗi qua cổng IPC socket tiêu chuẩn để Worker parse lại.',
            'Lưu mảng dữ liệu vào biến toàn cục globalThis trên Main Thread để Worker Thread truy cập trực tiếp từ bộ nhớ dùng chung.',
            'Ghi dữ liệu ra tệp tin tạm trên ổ cứng SSD NVMe và truyền đường dẫn tuyệt đối của file sang cho Worker đọc.',
            'Sử dụng SharedArrayBuffer hoặc cơ chế Transfer List của postMessage để chuyển quyền sở hữu bộ nhớ nhị phân mà không cần nhân bản dữ liệu qua thuật toán Structured Clone.'
          ],
          correctIndex: 3,
          explanation: 'Mặc định postMessage sử dụng thuật toán Structured Clone để nhân bản (deep copy) dữ liệu, gây tốn gấp đôi RAM và làm nghẽn luồng. Sử dụng Transfer List (với ArrayBuffer) hoặc SharedArrayBuffer cho phép truyền hoặc chia sẻ trực tiếp con trỏ vùng nhớ vật lý (Zero-copy), mang lại hiệu năng tối đa.'
        },
        {
          id: 'c2-l3-q3',
          question: 'Tại sao trong một hệ thống backend NestJS chịu tải cao, việc khởi tạo new Worker() trực tiếp cho mỗi HTTP request là một phản mẫu kiến trúc (Anti-pattern) nguy hiểm?',
          options: [
            'Vì Node.js giới hạn cứng mỗi tiến trình hệ điều hành chỉ được phép khởi tạo tối đa 8 Worker Threads trong suốt vòng đời.',
            'Vì mỗi Worker Thread khởi tạo một V8 Isolate độc lập (tốn ~20-40MB RAM và 10-30ms CPU bootstrapping); việc tạo mới trên mỗi request sẽ nhanh chóng gây cạn kiệt bộ nhớ và tê liệt CPU do context switching.',
            'Vì các Worker Threads khi khởi tạo sẽ cạnh tranh trực tiếp và ghi đè lên Call Stack duy nhất của Main Thread.',
            'Vì giao thức HTTP trong NestJS chỉ hỗ trợ xử lý đơn luồng đồng bộ theo chuẩn ECMAScript.'
          ],
          correctIndex: 1,
          explanation: 'Mỗi Worker Thread là một V8 Isolate hoàn chỉnh với Call Stack, Microtask Queue và V8 Heap riêng biệt. Chi phí khởi tạo một Isolate là rất đắt đỏ (~20-40MB RAM và hàng chục ms). Trong môi trường sản xuất tải cao, bắt buộc phải sử dụng Worker Pool (như thư viện Piscina) để tái sử dụng các worker có sẵn.'
        },
        {
          id: 'c2-l3-q4',
          question: 'Nếu phát hiện chỉ số P99 Event Loop Lag tăng cao bất thường do xử lý một tệp tin JSON cực lớn (50MB), giải pháp kiến trúc đúng đắn nhất là gì?',
          options: [
            'Bọc lời gọi JSON.parse() trong một Promise và await nó ngay trong service để biến nó thành tác vụ bất đồng bộ.',
            'Đẩy chuỗi JSON vào process.nextTick() để V8 engine cấp độ ưu tiên tính toán cao nhất cho tiến trình phân tích cú pháp.',
            'Sử dụng Stream JSON Parser (như stream-json hoặc oboe) để phân tích cú pháp theo từng chunk nhỏ trực tiếp từ luồng request, hoặc chuyển chuỗi sang Worker Thread xử lý.',
            'Tăng cấu hình UV_THREADPOOL_SIZE lên 64 để Libuv tự động phân chia chuỗi JSON sang các luồng C++ xử lý song song.'
          ],
          correctIndex: 2,
          explanation: 'JSON.parse() là hàm C++ chạy hoàn toàn đồng bộ trên luồng chính V8, không phụ thuộc vào Libuv Threadpool. Cho dù bọc trong async/await hay nextTick, nó vẫn chiếm giữ luồng chính. Cách giải quyết chuẩn là stream-parsing (đọc đến đâu parse đến đó) hoặc offload sang Worker Thread độc lập.'
        },
        {
          id: 'c2-l3-q5',
          question: 'Điểm khác biệt cốt lõi về tài nguyên và cơ chế chia sẻ bộ nhớ giữa worker_threads và child_process.fork() trong Node.js là gì?',
          options: [
            'worker_threads chạy trong cùng tiến trình OS và có thể chia sẻ bộ nhớ zero-copy qua SharedArrayBuffer, trong khi child_process.fork tạo một tiến trình OS riêng biệt hoàn toàn với không gian địa chỉ bộ nhớ cô lập và giao tiếp qua IPC pipe.',
            'child_process.fork chia sẻ chung Call Stack với tiến trình cha, còn worker_threads có Call Stack độc lập hoàn toàn.',
            'worker_threads chỉ chạy được trên hệ điều hành Linux 64-bit, trong khi child_process.fork chỉ chạy được trên Windows và macOS.',
            'child_process.fork có tốc độ khởi tạo nhanh gấp 10 lần worker_threads do không cần nạp lại V8 Engine.'
          ],
          correctIndex: 0,
          explanation: 'child_process.fork sinh ra một OS process mới (tốn nhiều RAM, cô lập hoàn toàn địa chỉ bộ nhớ, IPC thông qua OS pipes với serialization). worker_threads tạo luồng bên trong cùng OS process, mỗi luồng có V8 Isolate riêng nhưng có khả năng chia sẻ trực tiếp bộ nhớ vật lý qua SharedArrayBuffer mà không cần serialize.'
        },
        {
          id: 'c2-l3-q6',
          question: 'Khi nhiều Worker Threads cùng đọc và ghi đồng thời vào một SharedArrayBuffer, cơ chế nào bắt buộc phải được sử dụng để tránh lỗi Race Condition và Data Corruption?',
          options: [
            'Sử dụng cú pháp async/await kết hợp vòng lặp while để kiểm tra cờ trạng thái boolean trên biến JavaScript thông thường.',
            'Sử dụng thư viện RxJS Subject với cơ chế ReplayBuffer để phát lại các giá trị bị ghi đè.',
            'Sử dụng các phép toán nguyên tử của đối tượng Atomics (như Atomics.add, Atomics.compareExchange, Atomics.wait/notify) được hỗ trợ trực tiếp từ CPU instruction level.',
            'Bọc toàn bộ các thao tác ghi dữ liệu bên trong khối lệnh synchronized của TypeScript.'
          ],
          correctIndex: 2,
          explanation: 'Khi dùng bộ nhớ chia sẻ SharedArrayBuffer giữa nhiều luồng, các phép toán số học thông thường không có tính nguyên tử (atomic), dẫn tới race conditions. Đối tượng Atomics cung cấp các phép toán nguyên tử (như Atomics.compareExchange, Atomics.wait, Atomics.notify) hoạt động trực tiếp ở cấp độ tập lệnh CPU để đảm bảo an toàn luồng.'
        },
        {
          id: 'c2-l3-q7',
          question: 'Hiện tượng "Bão Request" (Retry Storm) phát sinh như thế nào khi máy chủ NestJS gặp tình trạng Event Loop Lag kéo dài?',
          options: [
            'Khi Libuv Threadpool bị đầy, card mạng tự động phát sóng liên tục các gói tin TCP RST ra toàn bộ mạng LAN.',
            'Khi cơ sở dữ liệu thấy kết nối bị idle quá lâu sẽ tự động nhân bản 100 truy vấn giống nhau để kiểm tra mạng.',
            'Khi V8 garbage collector kích hoạt chế độ Compaction, nó sẽ gửi tín hiệu yêu cầu tất cả các client kết nối lại ngay lập tức.',
            'Khi luồng chính bị nghẽn khiến API không kịp phản hồi, các client/microservices khác bị timeout và liên tục gửi lại các request cũ; lượng request dồn dập đổ vào một máy chủ đang nghẽn khiến hệ thống sụp đổ hoàn toàn.'
          ],
          correctIndex: 3,
          explanation: 'Khi Event Loop bị nghẽn, thời gian phản hồi vượt quá client timeout (hoặc do người dùng sốt ruột bấm refresh liên tục). Cơ chế tự động thử lại (Retry) của các microservices gọi đến sẽ liên tục bơm thêm request mới vào hàng đợi Poll I/O, tạo ra hiệu ứng tuyết lở (Retry Storm) đánh sập máy chủ.'
        },
        {
          id: 'c2-l3-q8',
          question: 'Một kỹ sư cho rằng: "Vì JSON.stringify() là một hàm tích hợp sẵn của Node.js runtime, nên nó sẽ được Libuv tự động chuyển sang Threadpool để không làm chậm luồng chính". Nhận định này đúng hay sai và vì sao?',
          options: [
            'Hoàn toàn sai; JSON.stringify() là hàm của V8 JavaScript Engine chạy đồng bộ 100% trên Call Stack của Main Thread và không hề liên quan đến Libuv Threadpool.',
            'Hoàn toàn đúng; mọi hàm thuộc tiêu chuẩn ECMAScript đều được Libuv tự động nhận diện và chuyển sang chạy nền trên 4 Worker Threads.',
            'Sai một phần; JSON.stringify() chỉ chạy trên Threadpool khi chuỗi dữ liệu đầu ra có kích thước lớn hơn 1MB.',
            'Đúng một phần; JSON.stringify() chạy trên Threadpool nếu được bọc trong hàm setImmediate().'
          ],
          correctIndex: 0,
          explanation: 'JSON.stringify và JSON.parse là các phương thức nguyên bản của ECMAScript engine (V8), được thực thi đồng bộ ngay trên Call Stack của Main Thread. Libuv Threadpool chỉ dành riêng cho các tác vụ I/O đĩa (fs), DNS lookup (getaddrinfo), crypto và nén zlib.'
        }
      ],
      codeChallenge: {
        id: 'c2-l3-c1',
        title: 'Giám Sát Vòng Lặp & Ngắt Lời Gọi Khi Event Loop Quá Tải',
        description: 'Hiện thực hàm \`executeWithLagGuard<T>(task: () => Promise<T>, currentLagMs: number, maxAllowedLagMs: number): Promise<T>\`. Hàm kiểm tra xem độ trễ Event Loop hiện tại (\`currentLagMs\`) có vượt quá ngưỡng cho phép (\`maxAllowedLagMs\`) hay không. Nếu vượt ngưỡng, lập tức từ chối với Error \`"SERVICE_OVERLOADED_LAG_TOO_HIGH"\` để kích hoạt Circuit Breaker, ngược lại thực thi \`task()\` và trả về kết quả. Nếu \`task\` không phải là function, ném Error("INVALID_TASK_FUNCTION"). Nếu \`maxAllowedLagMs <= 0\` hoặc không phải là number, ném Error("INVALID_LAG_THRESHOLD").',
        starterCode: `export async function executeWithLagGuard<T>(
  task: () => Promise<T>,
  currentLagMs: number,
  maxAllowedLagMs: number
): Promise<T> {
  // TODO: Kiểm tra ngưỡng Lag và bảo vệ hệ thống khỏi quá tải
  return task();
}`,
        solution: `export async function executeWithLagGuard<T>(
  task: () => Promise<T>,
  currentLagMs: number,
  maxAllowedLagMs: number
): Promise<T> {
  if (typeof task !== 'function') {
    throw new Error('INVALID_TASK_FUNCTION');
  }
  if (typeof maxAllowedLagMs !== 'number' || maxAllowedLagMs <= 0) {
    throw new Error('INVALID_LAG_THRESHOLD');
  }
  if (currentLagMs > maxAllowedLagMs) {
    throw new Error('SERVICE_OVERLOADED_LAG_TOO_HIGH');
  }

  return await task();
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Thực thi bình thường khi Lag trong ngưỡng an toàn (20ms < 50ms)',
            input: [async () => 'SYSTEM_HEALTHY', 20, 50],
            expected: 'SYSTEM_HEALTHY',
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Lag chạm ngưỡng cho phép (50ms == 50ms) -> Vẫn cho phép chạy',
            input: [async () => 'BORDERLINE_OK', 50, 50],
            expected: 'BORDERLINE_OK',
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Từ chối tác vụ khi Lag vượt ngưỡng cho phép (80ms > 50ms)',
            input: [async () => 'SHOULD_NOT_RUN', 80, 50],
            expected: 'ERROR_THROWN',
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): task không hợp lệ (null) -> Ném lỗi INVALID_TASK_FUNCTION',
            input: [null, 10, 50],
            expected: 'ERROR_THROWN',
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): maxAllowedLagMs âm hoặc bằng 0 -> Ném lỗi INVALID_LAG_THRESHOLD',
            input: [async () => 'OK', 10, -5],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    }
  ]
};
