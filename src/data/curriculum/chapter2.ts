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
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class EventLoopDiagnosticsService {
  private readonly logger = new Logger(EventLoopDiagnosticsService.name);

  /**
   * Minh họa sự khác biệt thứ tự thực thi giữa Microtasks và Macrotasks
   */
  public demonstrateExecutionOrder(): string[] {
    const executionTrace: string[] = [];

    executionTrace.push('1. Synchronous Code (Call Stack)');

    setTimeout(() => {
      executionTrace.push('6. MacroTask: setTimeout (Timers Phase)');
    }, 0);

    setImmediate(() => {
      executionTrace.push('5. MacroTask: setImmediate (Check Phase)');
    });

    Promise.resolve().then(() => {
      executionTrace.push('4. MicroTask: Promise.then (Microtask Queue)');
    });

    process.nextTick(() => {
      executionTrace.push('2. High Priority MicroTask: process.nextTick');
      
      process.nextTick(() => {
        executionTrace.push('3. Nested nextTick (Drained before Promise)');
      });
    });

    return executionTrace;
  }

  /**
   * Kỹ thuật phân tách một mảng lớn thành các chunks nhỏ dùng setImmediate
   * để không làm block Event Loop của NestJS
   */
  public processLargeArrayNonBlocking<T>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      let currentIndex = 0;

      const processNextChunk = () => {
        const chunk = items.slice(currentIndex, currentIndex + chunkSize);
        currentIndex += chunkSize;

        if (chunk.length > 0) {
          processor(chunk);
          // Nhường lại quyền kiểm soát cho Event Loop xử lý I/O rồi mới chạy tiếp chunk sau
          setImmediate(processNextChunk);
        } else {
          resolve();
        }
      };

      processNextChunk();
    });
  }
}
`,
      quiz: [
        {
          id: 'c2-l1-q1',
          question: 'Hiện tượng Event Loop Starvation xảy ra khi nào và để lại hậu quả gì nghiêm trọng nhất cho máy chủ backend Node.js/NestJS?',
          options: [
            'Khi microtask queue liên tục được bơm tác vụ mới khiến Event Loop không thể chuyển sang pha I/O làm toàn bộ HTTP request bị treo.',
            'Khi heap memory vượt quá hạn mức tối đa của V8 khiến garbage collector kích hoạt chế độ dừng toàn hệ thống để thu gom bộ nhớ.',
            'Khi libuv threadpool sử dụng hết toàn bộ bốn luồng mặc định khiến các truy vấn cơ sở dữ liệu đọc file bị từ chối kết nối tức thì.',
            'Khi số lượng kết nối đồng thời vượt quá ngưỡng mười nghìn khiến hệ điều hành từ chối tạo file descriptor mới cho socket mạng.'
          ],
          correctIndex: 0,
          explanation: 'Event Loop Starvation xảy ra khi microtask queue (đặc biệt là process.nextTick đệ quy liên tục) không bao giờ cạn rỗng. Do quy tắc xả cạn kiệt (drain completely) microtask trước khi chuyển pha, Event Loop bị kẹt cứng tại chỗ, không thể tiến vào pha Poll để tiếp nhận kết nối HTTP hay pha Timers, làm máy chủ hoàn toàn tê liệt.'
        },
        {
          id: 'c2-l1-q2',
          question: 'Khi đặt lệnh setTimeout(fn, 0) và setImmediate(fn) bên trong một callback của fs.readFile, thứ tự thực thi chắc chắn sẽ là gì?',
          options: [
            'setImmediate luôn chạy trước setTimeout vì callback đọc file nằm ở pha Poll và pha tiếp theo của vòng lặp là pha Check.',
            'setTimeout luôn chạy trước setImmediate vì các hàm hẹn giờ có mức độ ưu tiên tuyệt đối cao hơn trong cấu trúc min-heap.',
            'Thứ tự hoàn toàn ngẫu nhiên phụ thuộc vào việc hệ điều hành trả về kết quả đọc file nhanh hay chậm tại thời điểm đó.',
            'Cả hai callback được gom nhóm và thực thi song song trên hai luồng khác nhau của thư viện libuv worker threadpool.'
          ],
          correctIndex: 0,
          explanation: 'Khi fs.readFile hoàn thành, callback của nó được thực thi tại pha Poll. Khi rời khỏi pha Poll theo chiều kim đồng hồ của Event Loop, pha kế tiếp ngay lập tức là pha Check (nơi xử lý setImmediate). Ngược lại, callback của setTimeout(fn, 0) nằm ở pha Timers, bắt buộc phải đợi Event Loop đi hết một vòng lặp trọn vẹn mới được gọi tới.'
        },
        {
          id: 'c2-l1-q3',
          question: 'Điểm khác biệt cốt lõi về thứ tự ưu tiên giữa process.nextTick() và Promise.resolve().then() trong Node.js là gì?',
          options: [
            'process.nextTick quản lý hàng đợi riêng và được xả sạch trước khi V8 engine xử lý hàng đợi Promise microtask queue.',
            'Promise.then được đưa vào hàng đợi vi mô của trình duyệt trong khi nextTick được chuyển trực tiếp xuống kernel hệ điều hành.',
            'Cả hai cơ chế sử dụng chung một hàng đợi FIFO duy nhất và tác vụ nào được đăng ký trước theo mã nguồn sẽ chạy trước.',
            'Promise.then có độ ưu tiên cao hơn vì tuân thủ chuẩn ECMAScript toàn cầu trong khi nextTick chỉ là hàm nội bộ thử nghiệm.'
          ],
          correctIndex: 0,
          explanation: 'Trong kiến trúc của Node.js, process.nextTickQueue có độ ưu tiên tuyệt đối cao hơn Promise reaction microtask queue. Khi Call Stack vừa trống, Node.js sẽ luôn xả sạch toàn bộ các callback trong nextTickQueue trước, sau đó mới tiến hành xả các Promise microtask.'
        },
        {
          id: 'c2-l1-q4',
          question: 'Để xử lý một mảng dữ liệu cực lớn gồm hàng triệu phần tử trong NestJS mà không làm chặn (block) Event Loop, giải pháp chuẩn kỹ thuật là gì?',
          options: [
            'Chia nhỏ mảng thành nhiều phần và dùng setImmediate để nhường lượt cho Event Loop xử lý I/O giữa các lần lặp.',
            'Bọc toàn bộ vòng lặp xử lý dữ liệu bên trong một Promise hoặc hàm async/await để biến nó thành bất đồng bộ hoàn toàn.',
            'Chuyển hàm xử lý sang setTimeout với khoảng trễ 0ms để đưa toàn bộ quá trình tính toán sang nhân đồ họa chuyên dụng.',
            'Sử dụng vòng lặp for đồng bộ kết hợp với try/catch để đảm bảo nếu xảy ra nghẽn thì ngoại lệ sẽ tự động giải phóng stack.'
          ],
          correctIndex: 0,
          explanation: 'Bọc vòng lặp CPU-bound nặng trong Promise hay async/await không hề giải phóng luồng, vì mã tính toán đồng bộ vẫn chiếm giữ Call Stack duy nhất của V8. Kỹ thuật đúng là chia nhỏ thành từng chunk và sử dụng setImmediate() sau mỗi chunk, cho phép Event Loop xen kẽ xử lý các request HTTP ở pha Poll trước khi tiếp tục tính toán.'
        }
      ],
      codeChallenge: {
        id: 'c2-l1-c1',
        title: 'Xây Dựng Queue Chunk Processor Chống Blocking Event Loop',
        description: 'Hiện thực hàm \`chunkProcessor<T>(items: T[], chunkSize: number, onChunk: (chunk: T[]) => void): Promise<number>\` nhận vào một danh sách items, xử lý từng đợt (chunk) với kích thước chỉ định thông qua callback \`onChunk\`. Giữa các đợt xử lý, phải trả lại quyền kiểm soát cho Event Loop (dùng Promise với setTimeout/setImmediate) để không làm block luồng. Trả về tổng số chunk đã xử lý thành công.',
        starterCode: `
export async function chunkProcessor<T>(
  items: T[],
  chunkSize: number,
  onChunk: (chunk: T[]) => void
): Promise<number> {
  // TODO: Viết thuật toán chunking không chặn Event Loop
  return 0;
}
`,
        solution: `
export async function chunkProcessor<T>(
  items: T[],
  chunkSize: number,
  onChunk: (chunk: T[]) => void
): Promise<number> {
  if (!items || items.length === 0 || chunkSize <= 0) {
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
      // Nhường luồng cho Event Loop xử lý I/O
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return chunkCount;
}
`,
        testCases: [
          {
            name: 'Xử lý mảng rỗng hoặc chunkSize không hợp lệ',
            input: [[], 10, () => {}],
            expected: 0
          },
          {
            name: 'Chia 10 phần tử với chunkSize 3 (phải ra 4 chunks: 3, 3, 3, 1)',
            input: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, () => {}],
            expected: 4
          },
          {
            name: 'Chia 5 phần tử với chunkSize 5 (phải ra đúng 1 chunk duy nhất)',
            input: [['a', 'b', 'c', 'd', 'e'], 5, () => {}],
            expected: 1
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
      realCodeSnippet: `
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class KernelIoBenchmarkService implements OnModuleInit {
  private readonly logger = new Logger(KernelIoBenchmarkService.name);

  onModuleInit() {
    this.logger.log(\`[System Info] Node.js Version: \${process.version}\`);
    this.logger.log(\`[System Info] UV_THREADPOOL_SIZE mặc định: \${process.env.UV_THREADPOOL_SIZE || '4'}\`);
  }

  /**
   * Benchmark thực nghiệm chứng minh sự cạnh tranh (contention) trên Libuv Threadpool.
   * Chạy song song N tác vụ hash mật khẩu pbkdf2 để thấy rõ tác động của kích thước Pool.
   */
  public async benchmarkThreadpoolContention(taskCount: number = 8): Promise<{
    taskCount: number;
    totalDurationMs: number;
    taskDurations: number[];
  }> {
    const startTime = Date.now();
    const taskPromises: Promise<number>[] = [];

    for (let i = 0; i < taskCount; i++) {
      taskPromises.push(
        new Promise<number>((resolve) => {
          const taskStart = Date.now();
          // pbkdf2 sử dụng Libuv Threadpool ngầm bên dưới
          crypto.pbkdf2('myStrongPassword123!', 'fixedSaltSaltSalt', 100000, 64, 'sha512', () => {
            const taskEnd = Date.now();
            resolve(taskEnd - taskStart);
          });
        })
      );
    }

    const taskDurations = await Promise.all(taskPromises);
    const totalDurationMs = Date.now() - startTime;

    return {
      taskCount,
      totalDurationMs,
      taskDurations
    };
  }
}
`,
      quiz: [
        {
          id: 'c2-l2-q1',
          question: 'Vì sao Linux epoll vượt trội hơn hẳn các system call cũ như select() hay poll() khi phục vụ hàng chục nghìn kết nối mạng đồng thời?',
          options: [
            'Vì epoll duy trì danh sách sẵn sàng trong kernel giúp báo sự kiện với độ phức tạp O(1) thay vì duyệt mảng O(N).',
            'Vì epoll tự động chuyển toàn bộ các socket mạng sang thực thi đa luồng trên card mạng chuyên dụng.',
            'Vì epoll nén toàn bộ dữ liệu gói tin TCP trước khi chuyển lên không gian người dùng giúp tiết kiệm băng thông.',
            'Vì epoll chỉ hỗ trợ duy nhất giao thức HTTP/2 và tự động loại bỏ các kết nối sử dụng phiên bản HTTP/1 cũ.'
          ],
          correctIndex: 0,
          explanation: 'Với select() và poll(), mỗi lần muốn biết socket nào có dữ liệu, ứng dụng phải truyền toàn bộ danh sách socket xuống kernel để kernel quét tuyến tính O(N). Ngược lại, epoll sử dụng Ready List trong không gian kernel; khi gói tin đến, kernel đẩy socket vào Ready List và trả về ngay lập tức với độ phức tạp O(1) cho các socket có hoạt động.'
        },
        {
          id: 'c2-l2-q2',
          question: 'Những tác vụ nào sau đây trong Node.js thực sự sử dụng các luồng trong Libuv Threadpool chứ KHÔNG dùng cơ chế non-blocking socket của kernel?',
          options: [
            'Các thao tác đọc ghi tệp tin fs, phân giải tên miền dns.lookup, hàm băm crypto và nén tệp tin zlib.',
            'Các kết nối TCP socket, máy chủ HTTP tiếp nhận request và các kết nối cơ sở dữ liệu qua mạng.',
            'Các hàm xử lý mảng JavaScript, thuật toán JSON.parse và các vòng lặp tính toán logic nghiệp vụ.',
            'Các hàm điều phối luồng như process.nextTick, Promise.resolve và câu lệnh gán biến môi trường.'
          ],
          correctIndex: 0,
          explanation: 'Hệ điều hành không hỗ trợ API bất đồng bộ hoàn toàn cho tệp tin đĩa cứng (regular files) và việc phân giải DNS (getaddrinfo), do đó Libuv bắt buộc phải chuyển các tác vụ fs, dns.lookup, crypto và zlib sang thực thi trên Libuv Threadpool (mặc định 4 luồng).'
        },
        {
          id: 'c2-l2-q3',
          question: 'Nếu đại ca gán process.env.UV_THREADPOOL_SIZE = 16 bên trong mã nguồn TypeScript của main.ts trong NestJS, kết quả sẽ ra sao?',
          options: [
            'Hoàn toàn không có tác dụng vì Libuv khởi tạo kích thước threadpool từ trước khi V8 engine chạy mã JavaScript.',
            'Threadpool lập tức mở rộng lên mười sáu luồng và giải phóng ngay các tác vụ đọc ghi tệp tin đang xếp hàng.',
            'Hệ thống sẽ ném ra lỗi Runtime Exception và dừng tiến trình do vi phạm quy tắc bảo mật của hệ điều hành.',
            'Kích thước pool được tăng lên nhưng chỉ có tác dụng đối với các tác vụ mã hóa mật khẩu bằng crypto module.'
          ],
          correctIndex: 0,
          explanation: 'Libuv khởi tạo Threadpool tại thời điểm tiến trình C++ Node.js vừa được kích hoạt, trước cả khi V8 Engine nạp và thông dịch dòng code JavaScript/TypeScript đầu tiên. Do đó, việc thay đổi biến process.env bên trong code JS là quá muộn và hoàn toàn không có hiệu lực. Biến này phải được truyền từ môi trường bên ngoài lúc chạy lệnh shell.'
        },
        {
          id: 'c2-l2-q4',
          question: 'Điều gì xảy ra khi hệ thống backend tiếp nhận 8 yêu cầu băm mật khẩu bằng crypto.pbkdf2() cùng lúc trong khi UV_THREADPOOL_SIZE đang để mặc định?',
          options: [
            'Bốn tác vụ đầu chiếm trọn bốn luồng của pool, bốn tác vụ sau phải xếp hàng đợi dẫn đến thời gian đáp ứng bị kéo dài.',
            'Cả tám tác vụ cùng chạy song song trên tám luồng ảo do Node.js tự động chia sẻ thời gian xung nhịp CPU.',
            'Bốn tác vụ đến sau lập tức bị từ chối với mã lỗi 503 Service Unavailable để bảo vệ an toàn cho máy chủ.',
            'V8 engine sẽ tự động chuyển bốn tác vụ bị nghẽn sang thực thi đồng bộ ngay trên Main Thread duy nhất.'
          ],
          correctIndex: 0,
          explanation: 'Vì mặc định UV_THREADPOOL_SIZE = 4, 4 tác vụ đầu tiên sẽ chiếm giữ toàn bộ 4 worker threads của Libuv. 4 tác vụ còn lại buộc phải nằm chờ trong hàng đợi của Libuv cho đến khi các luồng trước hoàn tất, khiến tổng thời gian xử lý của các tác vụ sau tăng vọt.'
        }
      ],
      codeChallenge: {
        id: 'c2-l2-c1',
        title: 'Giả Lập Hệ Thống Giới Hạn Tác Vụ Đồng Thời (Concurrency Worker Pool)',
        description: 'Hiện thực class \`ConcurrentTaskPool\` với phương thức \`runTask<T>(task: () => Promise<T>): Promise<T>\`. Constructor nhận vào tham số \`maxConcurrency: number\`. Class này phải đảm bảo tại một thời điểm chỉ có tối đa \`maxConcurrency\` tác vụ được thực thi song song; các tác vụ vượt ngưỡng phải được xếp vào hàng đợi FIFO và tự động chạy tiếp khi có tác vụ trước hoàn thành.',
        starterCode: `
export class ConcurrentTaskPool {
  constructor(private readonly maxConcurrency: number) {}

  public async runTask<T>(task: () => Promise<T>): Promise<T> {
    // TODO: Hiện thực điều phối luồng tác vụ với giới hạn maxConcurrency
    return task();
  }
}
`,
        solution: `
export class ConcurrentTaskPool {
  private activeCount = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly maxConcurrency: number) {}

  public runTask<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
          }
        }
      };

      if (this.activeCount < this.maxConcurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}
`,
        testCases: [
          {
            name: 'Chạy tác vụ đơn lẻ thành công',
            input: [async () => 'success'],
            expected: 'success'
          },
          {
            name: 'Xử lý tuần tự khi maxConcurrency = 1',
            input: [async () => 100 * 2],
            expected: 200
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
      realCodeSnippet: `
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { monitorEventLoopDelay, IntervalHistogram } from 'perf_hooks';

@Injectable()
export class EventLoopMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventLoopMonitorService.name);
  private histogram!: IntervalHistogram;
  private monitorInterval!: NodeJS.Timeout;

  onModuleInit() {
    // Độ phân giải 20ms: Đo độ trễ vòng lặp liên tục ở cấp độ nano giây
    this.histogram = monitorEventLoopDelay({ resolution: 20 });
    this.histogram.enable();

    // Giám sát định kỳ mỗi 5 giây
    this.monitorInterval = setInterval(() => {
      this.checkHealth();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.histogram) {
      this.histogram.disable();
    }
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  public getMetrics() {
    return {
      p50LagMs: (this.histogram.percentile(50) / 1e6).toFixed(2),
      p99LagMs: (this.histogram.percentile(99) / 1e6).toFixed(2),
      maxLagMs: (this.histogram.max / 1e6).toFixed(2),
    };
  }

  private checkHealth() {
    const p99Ms = this.histogram.percentile(99) / 1e6;
    const maxMs = this.histogram.max / 1e6;

    if (p99Ms > 50) {
      this.logger.warn(
        \`[EVENT LOOP WARNING] P99 Lag vượt ngưỡng an toàn: \${p99Ms.toFixed(2)}ms (Max: \${maxMs.toFixed(2)}ms)\`
      );
    } else {
      this.logger.debug(\`[EVENT LOOP HEALTHY] P99 Lag: \${p99Ms.toFixed(2)}ms\`);
    }

    // Reset histogram định kỳ để tránh dữ liệu cũ làm lệch metric
    this.histogram.reset();
  }
}
`,
      quiz: [
        {
          id: 'c2-l3-q1',
          question: 'Event Loop Lag đo lường điều gì và vì sao chỉ số này là sinh tử đối với độ khả dụng của một dịch vụ Node.js trong môi trường Kubernetes?',
          options: [
            'Đo thời gian chênh lệch giữa lúc timer dự kiến chạy và lúc thực tế chạy; nếu lag quá cao Kubernetes sẽ coi Pod bị treo và khởi động lại.',
            'Đo tổng dung lượng ram vật lý bị chiếm dụng bởi các file buffer; nếu lag cao hệ điều hành sẽ tự động ngắt kết nối mạng của tiến trình.',
            'Đo tốc độ phản hồi trung bình của cơ sở dữ liệu postgresql; nếu lag cao thì nestjs sẽ tự động hủy bỏ các kết nối pool hiện hành.',
            'Đo số lượng luồng đang ngủ bên trong thư viện c++ libuv; nếu lag cao thì hệ thống sẽ tự động chuyển sang mô hình đa luồng apache.'
          ],
          correctIndex: 0,
          explanation: 'Event Loop Lag là khoảng thời gian chậm trễ khi Event Loop hoàn thành một chu kỳ so với thời gian lý tưởng. Khi Main Thread bị nghẽn bởi phép toán CPU-bound, Lag sẽ tăng vọt, khiến endpoint Health Check (/health) không thể phản hồi đúng hạn, dẫn tới việc Kubernetes Liveness Probe báo thất bại và liên tục Restart Pod (CrashLoopBackOff).'
        },
        {
          id: 'c2-l3-q2',
          question: 'Khi cần chuyển một mảng dữ liệu nhị phân dung lượng cực lớn (khoảng 200MB) sang Worker Thread để xử lý, phương án nào tối ưu hiệu năng và bộ nhớ nhất?',
          options: [
            'Sử dụng SharedArrayBuffer để chia sẻ trực tiếp vùng nhớ vật lý giữa hai luồng với chi phí tuần tự hóa bằng không.',
            'Sử dụng JSON.stringify để mã hóa toàn bộ dữ liệu thành chuỗi text rồi truyền qua cổng IPC socket tiêu chuẩn.',
            'Ghi mảng dữ liệu ra một tệp tin tạm trên ổ cứng ssd rồi yêu cầu worker thread đọc lại bằng fs.readFileSync.',
            'Nhân bản dữ liệu bằng cơ chế structured clone mặc định của hàm postMessage để đảm bảo tính độc lập bộ nhớ tuyệt đối.'
          ],
          correctIndex: 0,
          explanation: 'Mặc định postMessage sử dụng thuật toán Structured Clone, tức là phải copy toàn bộ 200MB dữ liệu sang vùng nhớ của Worker, tiêu tốn gấp đôi RAM và gây khựng luồng. Sử dụng SharedArrayBuffer cho phép cả 2 luồng cùng truy cập vào cùng một vùng nhớ vật lý (Zero-copy), mang lại hiệu năng cao nhất.'
        },
        {
          id: 'c2-l3-q3',
          question: 'Vì sao trong một ứng dụng backend NestJS chịu tải cao, chúng ta KHÔNG nên liên tục gọi new Worker() cho từng HTTP request đơn lẻ?',
          options: [
            'Vì mỗi lần khởi tạo Worker tốn chi phí CPU nạp một V8 Isolate mới và ngốn hàng chục MB RAM gây quá tải hệ thống.',
            'Vì hệ điều hành giới hạn mỗi tiến trình Node.js chỉ được phép tạo duy nhất tối đa một worker thread trong suốt vòng đời.',
            'Vì các worker thread được tạo ra sẽ tự động chia sẻ chung một call stack duy nhất khiến xảy ra tình trạng xung đột biến.',
            'Vì giao thức HTTP trong NestJS không tương thích với mô hình đa luồng và sẽ tự động từ chối các request có sử dụng worker.'
          ],
          correctIndex: 0,
          explanation: 'Mỗi Worker Thread tương đương với một môi trường thực thi V8 riêng biệt (V8 Isolate), cần khởi tạo Call Stack, Heap và Context riêng, tiêu tốn từ 20MB đến 40MB RAM và vài chục ms khởi động. Nếu tạo mới trên mỗi request, hệ thống sẽ nhanh chóng cạn kiệt RAM và sập vì CPU Thrashing. Giải pháp chuẩn là dùng Worker Thread Pool (như Piscina).'
        },
        {
          id: 'c2-l3-q4',
          question: 'Nếu phát hiện chỉ số P99 Event Loop Lag tăng cao bất thường do xử lý một tệp tin JSON cực lớn (50MB), giải pháp kiến trúc đúng đắn nhất là gì?',
          options: [
            'Sử dụng kỹ thuật streaming parser để đọc và xử lý từng phần dữ liệu thay vì gọi JSON.parse đồng bộ một khối dữ liệu lớn.',
            'Bọc lệnh JSON.parse trong một hàm async/await để tự động chuyển quá trình parse sang luồng phụ của hệ điều hành.',
            'Tăng biến môi trường UV_THREADPOOL_SIZE lên gấp đôi để thư viện libuv tự động tối ưu hóa việc phân tích chuỗi dữ liệu.',
            'Chuyển hàm JSON.parse vào bên trong một hàm callback của process.nextTick để đảm bảo quyền ưu tiên xử lý cao nhất.'
          ],
          correctIndex: 0,
          explanation: 'JSON.parse() là hàm C++ chạy hoàn toàn đồng bộ trên V8 Main Thread. Cho dù bọc trong async/await hay nextTick, nó vẫn chiếm giữ luồng và làm tê liệt Event Loop suốt thời gian phân tích chuỗi 50MB. Giải pháp đúng đắn là sử dụng Stream JSON Parser (như stream-json, oboe) để phân tích từng phần nhỏ của dữ liệu mà không làm nghẽn luồng.'
        }
      ],
      codeChallenge: {
        id: 'c2-l3-c1',
        title: 'Giám Sát Vòng Lặp & Ngắt Lời Gọi Khi Event Loop Quá Tải',
        description: 'Hiện thực hàm \`executeWithLagGuard<T>(task: () => Promise<T>, currentLagMs: number, maxAllowedLagMs: number): Promise<T>\`. Hàm kiểm tra xem độ trễ Event Loop hiện tại (\`currentLagMs\`) có vượt quá ngưỡng cho phép (\`maxAllowedLagMs\`) hay không. Nếu vượt ngưỡng, lập tức từ chối với Error \`"SERVICE_OVERLOADED_LAG_TOO_HIGH"\` để kích hoạt Circuit Breaker, ngược lại thực thi \`task()\` và trả về kết quả.',
        starterCode: `
export async function executeWithLagGuard<T>(
  task: () => Promise<T>,
  currentLagMs: number,
  maxAllowedLagMs: number
): Promise<T> {
  // TODO: Kiểm tra ngưỡng Lag và bảo vệ hệ thống khỏi quá tải
  return task();
}
`,
        solution: `
export async function executeWithLagGuard<T>(
  task: () => Promise<T>,
  currentLagMs: number,
  maxAllowedLagMs: number
): Promise<T> {
  if (currentLagMs > maxAllowedLagMs) {
    throw new Error('SERVICE_OVERLOADED_LAG_TOO_HIGH');
  }

  return await task();
}
`,
        testCases: [
          {
            name: 'Thực thi bình thường khi Lag trong ngưỡng an toàn (20ms < 50ms)',
            input: [async () => 'OK', 20, 50],
            expected: 'OK'
          },
          {
            name: 'Từ chối tác vụ khi Lag vượt ngưỡng cho phép (80ms > 50ms)',
            input: [
              async () => 'FAIL',
              80,
              50
            ],
            expected: 'THREW_ERROR'
          }
        ]
      }
    }
  ]
};
