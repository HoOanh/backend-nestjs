import type { Lesson } from '../types.ts';

export const c2_l1: Lesson = {
  id: 'c2-l1',
  title: 'Bài 01: The Single-Thread Illusion: Main Thread, Libuv 6 Pha & Thứ Tự Drain Microtasks',
  duration: '60 phút',
  tag: 'Event Loop & Microtasks',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Điều phối Bất đồng bộ (Asynchronous Event-Driven Orchestration) từ cấp độ cấu trúc dữ liệu vòng lặp C++ của thư viện Libuv đến cơ chế xả hàng đợi của V8 Engine cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Giải phẫu Ảo tưởng Đơn luồng (The Single-Thread Illusion) và Kiến trúc Phân tầng Hàng đợi:** Hiểu rõ sự phân tách nhiệm vụ giữa luồng thực thi mã máy duy nhất của V8 (\`V8 Mutator Main Thread\`) với bộ ghép kênh sự kiện của nhân hệ điều hành; phân biệt chính xác thứ bậc ưu tiên giữa \`V8 Call Stack\`, \`process.nextTickQueue\`, \`Promise Microtask Queue\` và 6 pha \`Macrotask\` của Libuv.
> 2. **Cơ chế vận hành 6 Pha của Libuv Event Loop và Định lượng Độ trễ Hẹn giờ (Timer Drift):** Phân tích cấu trúc dữ liệu cây nhị phân \`Min-Heap\` trong pha \`Timers\`, công thức tính thời gian ngủ chờ \`uv__backend_timeout\` tại pha \`Poll\`, và chứng minh bằng toán học sự khác biệt giữa trạng thái bất định (\`Non-deterministic\`) ở Top-level với trạng thái tất định 100% (\`Deterministic\`) trong I/O Callback khi so sánh \`setTimeout(fn, 0)\` và \`setImmediate(fn)\`.
> 3. **Quy tắc Xả Cạn kiệt Microtasks (Microtask Drain Invariant) và Phòng chống Bỏ đói Vòng lặp (Event Loop Starvation) trong NestJS:** Nắm vững bước ngoặt kiến trúc từ Node.js 11+ (xả Microtask ngay giữa từng callback đơn lẻ); giải phẫu cơ chế gây tê liệt cổng mạng HTTP do đệ quy \`process.nextTick\` hoặc chuỗi Promise dài, và áp dụng kỹ thuật phân mảnh tác vụ (\`Cooperative Task Chunking via setImmediate\`) trên Production.

---

# 1. GIẢI PHẪU ẢO TƯỞNG ĐƠN LUỒNG (THE SINGLE-THREAD ILLUSION) VÀ THỨ BẬC ƯU TIÊN HÀNG ĐỢI RUNTIME

### 1.1 Khái niệm nền tảng: Mô hình Hợp tác Đơn luồng (Cooperative Single-Threaded Model) và Cấu trúc \`uv_loop_t\`

Trong thiết kế máy chủ truyền thống (như Apache HTTP Server hoặc mô hình Thread-per-Request cổ điển trên Java/C#), mỗi kết nối mạng đi vào sẽ được nhân hệ điều hành gán cho một luồng thực thi riêng biệt (**OS Kernel Thread**). Khi luồng đó gửi truy vấn SQL sang cơ sở dữ liệu và chờ phản hồi qua mạng, bộ lập lịch của hệ điều hành (**Preemptive OS Scheduler**) sẽ tước quyền sử dụng CPU của luồng đó, lưu toàn bộ tập thanh ghi phần cứng (**CPU Registers: \`RIP\`, \`RSP\`, \`RBP\`**) vào RAM và nạp ngữ cảnh của một luồng khác lên chạy. Dù mô hình đa luồng ưu tiên (\`Preemptive Multi-threading\`) giúp lập trình viên viết code đồng bộ tuần tự rất dễ hiểu, nó vấp phải hai rào cản vật lý khi lưu lượng vượt mốc 10,000 kết nối đồng thời (**Bài toán C10K**): mỗi luồng ngốn từ \`1 MB – 8 MB\` vùng nhớ Stack, và vi xử lý bị kiệt sức vì chi phí chuyển đổi ngữ cảnh (**Context Switch Overhead**) cùng hiện tượng xóa bẩn bộ nhớ đệm L1/L2 Cache (**Cache Thrashing**).

Node.js giải quyết triệt để bài toán C10K bằng cách áp dụng kiến trúc **Đơn luồng Hợp tác Hướng sự kiện (Single-Threaded Event-Driven Reactor Pattern)**. Tuy nhiên, khái niệm *"Node.js là ngôn ngữ đơn luồng"* thường bị hiểu sai nghiêm trọng. Dưới góc độ kiến trúc hệ thống, "Ảo tưởng Đơn luồng" (**The Single-Thread Illusion**) được định nghĩa chính xác qua 3 tầng vật lý sau:

1. **Tầng Thực thi Mã JavaScript (\`V8 Main Thread / Mutator Thread\` — Duy nhất 1 Luồng):**
   Toàn bộ mã nguồn nghiệp vụ của ứng dụng NestJS — từ \`Controller\`, \`Service\`, \`Guard\`, \`Interceptor\`, \`Pipe\` cho đến các hàm callback của \`Promise\` — đều được thực thi tuần tự trên **đúng một luồng hệ điều hành duy nhất** với một khung ngăn xếp **\`V8 Call Stack\`** duy nhất. Nhờ chỉ có một luồng chạm vào vùng nhớ đối tượng V8 Heap tại một thời điểm, lập trình viên hoàn toàn không cần dùng khóa tương tranh (\`Mutex\`, \`Semaphore\`, \`Spinlock\`) khi thao tác trên biến bộ nhớ, loại bỏ từ gốc nguy cơ khóa chết (**Deadlock**) cấp độ luồng CPU.
2. **Tầng Điều phối Vòng lặp Sự kiện C++ (\`Libuv Event Loop — struct uv_loop_t\`):**
   Bao bọc bên ngoài V8 Engine là thư viện C/C++ đa nền tảng mang tên **Libuv**. Trung tâm của Libuv là cấu trúc dữ liệu trạng thái vòng lặp **\`uv_loop_t\`** (khởi tạo qua hàm \`uv_run(loop, UV_RUN_DEFAULT)\`). Vòng lặp này duy trì hai bộ đếm sống còn để quyết định khi nào tiến trình Node.js được phép thoát (\`process.exit\`):
   - **\`active_handles\` (Các tay cầm tài nguyên dài hạn):** Đại diện cho các đối tượng đang lắng nghe liên tục như \`net.Server\` (TCP Listening Socket), \`setInterval\`, hoặc luồng \`process.stdout\`.
   - **\`active_reqs\` (Các yêu cầu thao tác ngắn hạn đang bay):** Đại diện cho một thao tác I/O cụ thể đang chờ hoàn tất như một lệnh \`fs.readFile\` đang đọc đĩa hoặc một truy vấn phân giải tên miền \`dns.lookup\`.
   Khi và chỉ khi cả hai bộ đếm \`active_handles == 0\` và \`active_reqs == 0\`, hàm \`uv_loop_alive()\` mới trả về \`0\` và kết thúc vòng lặp.
3. **Tầng Thực thi I/O Song song ngầm (\`OS Kernel Multiplexer & Libuv Worker Pool\`):**
   Tại sao 1 luồng V8 lại phục vụ được 50,000 truy vấn cơ sở dữ liệu cùng lúc? Bởi vì luồng chính V8 **không bao giờ tự mình chờ I/O**. Khi gặp một lệnh đọc mạng (\`socket.read\`) hoặc đọc tệp tin (\`fs.readFile\`), V8 chỉ mất khoảng \`2 – 5 micro-giây\` để đóng gói một đối tượng yêu cầu (\`Request Descriptor\`) đẩy xuống tầng C++ của Libuv rồi lập tức giải phóng \`Call Stack\` để xử lý HTTP Request tiếp theo. Việc chờ đợi thực tế được ủy thác xuống **Bộ ghép kênh sự kiện của Nhân hệ điều hành (\`Linux epoll\` / \`macOS kqueue\` / \`Windows IOCP\`)** hoặc **Bể luồng công nhân C++ (\`Libuv Threadpool\` gồm 4 luồng mặc định)**.

### 1.2 Đối chiếu kiến trúc: Phân cấp 4 Tầng Hàng đợi Thực thi trong Node.js Runtime

Để biết chính xác dòng code nào sẽ được CPU thực thi tiếp theo khi \`V8 Call Stack\` vừa trống, kỹ sư Backend bắt buộc phải phân biệt rõ 4 tầng hàng đợi có cơ chế quản lý và độ ưu tiên hoàn toàn khác nhau dưới đây:

| Tiêu chí học thuật | Cấp độ 0: V8 Call Stack (Đồng bộ) | Cấp độ 1A: \`process.nextTickQueue\` | Cấp độ 1B: \`Promise Microtask Queue\` | Cấp độ 2: Libuv Macrotask Queues (6 Pha) |
| :--- | :--- | :--- | :--- | :--- |
| **Đơn vị sở hữu & Quản lý** | **V8 Engine** (Thanh ghi con trỏ ngăn xếp \`RSP\` trên luồng chính) | **Node.js C++ Binding Layer** (Mảng vòng \`TickObject\` quản lý riêng bởi Node) | **V8 Engine** (Hàng đợi chuẩn ECMAScript \`MicrotaskQueue\` cho \`Promise\` / \`queueMicrotask\`) | **Thư viện C++ Libuv** (6 hàng đợi tách biệt nằm trong cấu trúc \`uv_loop_t\`) |
| **Thứ tự ưu tiên thực thi** | **Tuyệt đối (\`#1\`)**: Chạy một mạch đến khi hàm đồng bộ trả về (\`Run-to-Completion\`) | **Tối thượng sau Call Stack (\`#2\`)**: Luôn được xả sạch trước cả \`Promise\` | **Cao (\`#3\`)**: Chạy ngay sau khi \`nextTickQueue\` đã cạn kiệt hoàn toàn | **Thấp nhất (\`#4\`)**: Chỉ được chuyển pha hoặc lấy callback mới khi cả 2 hàng đợi Microtask đã trống |
| **Cơ chế xả hàng đợi (\`Drain Policy\`)** | Đẩy (\`Push\`) và rút (\`Pop\`) khung hàm theo cơ chế LIFO; tràn nếu đệ quy quá sâu | **Xả cạn kiệt (\`Drain to Exhaustion\`)**: Nếu callback sinh thêm \`nextTick\` mới, nó nối đuôi chạy luôn trong cùng đợt xả | **Xả cạn kiệt (\`Drain to Exhaustion\`)**: Nếu \`.then()\` sinh ra \`Promise\` đã giải quyết mới, V8 tiếp tục xả cho đến khi rỗng | **Xả có giới hạn định mức (\`Bounded FIFO / Min-Heap\`)**: Có giới hạn số lượng callback tối đa mỗi vòng để chống đói pha sau |
| **Tác động lên I/O mạng khi bị lạm dụng** | Đóng băng trực tiếp luồng chính; Kernel tích tụ gói tin trong \`TCP Backlog\` | **Gây Bỏ đói Vòng lặp (\`Event Loop Starvation\`) tức thời**: Kẹt vĩnh viễn không bao giờ vào pha \`Poll\` | **Gây Bỏ đói Vòng lặp (\`Microtask Starvation\`)**: Tương tự \`nextTick\`, khóa cứng khả năng nhận I/O mới | Được bảo vệ bởi ranh giới chuyển pha của Libuv; các pha luân phiên nhau nhận CPU |
| **Trường hợp sử dụng chuẩn kiến trúc** | Tính toán biểu thức nhẹ (\`< 1 ms\`), kiểm tra tham số đầu vào, khởi tạo đối tượng | Phát sự kiện sau khi khởi tạo (\`Post-constructor Event\`), trả lỗi đồng bộ về dạng bất đồng bộ | Xử lý chuỗi kết quả bất đồng bộ chuẩn (\`async/await\`, \`Promise.all\`, \`queueMicrotask\`) | Hẹn giờ (\`setTimeout\`), lắng nghe gói tin mạng (\`Poll\`), chia nhỏ việc nặng (\`setImmediate\`) |

### 1.3 Cơ chế Xả Microtask Cưỡng bức và Bài toán Bỏ đói Vòng lặp (Event Loop Starvation)

Quy tắc bất biến quan trọng nhất của Node.js Runtime là: **Libuv hoàn toàn không thể chuyển từ một callback sang callback tiếp theo (hoặc sang pha tiếp theo) nếu \`nextTickQueue\` và \`Promise Microtask Queue\` chưa trống rỗng 100%**.

Mỗi khi một hàm callback của Libuv (chẳng hạn callback đọc xong dữ liệu từ Database hoặc một hàm \`setTimeout\`) vừa thực thi xong lệnh \`return\` cuối cùng và rút khỏi \`V8 Call Stack\`, cổng chuyển tiếp C++/JS của Node.js (\`InternalMakeCallback\`) sẽ lập tức kích hoạt điểm kiểm tra **\`Microtask Checkpoint\`**:
1. Đầu tiên, nó kiểm tra \`process.nextTickQueue\`. Nếu có phần tử, nó lấy từng hàm ra đẩy lên \`Call Stack\` chạy cho đến khi mảng này về \`0\`. Nếu trong quá trình chạy, hàm đó lại gọi tiếp \`process.nextTick()\`, tác vụ mới được chèn vào cuối hàng đợi và được thực thi ngay trong đợt xả hiện tại!
2. Chỉ khi \`nextTickQueue\` đã trống rỗng, Node.js mới gọi xuống V8 để xả tiếp \`Promise Microtask Queue\` (\`Promise.then\`, \`await\`, \`queueMicrotask\`).
3. Nếu trong lúc đang xả \`Promise Microtask\`, có một dòng code gọi \`process.nextTick()\`, ngay sau khi xong các Promise hiện hành, trình điều phối lại vòng ngược lên xả sạch \`nextTickQueue\` một lần nữa!

Hãy đối chiếu hai thiết kế dịch vụ đồng bộ hóa trạng thái bộ nhớ đệm trong NestJS dưới đây để thấy cách một vòng lặp đệ quy \`process.nextTick\` hoặc \`Promise\` làm sập toàn bộ máy chủ HTTP mà không hề ném ra lỗi \`Maximum call stack size exceeded\`:

\`\`\`typescript
// File: src/modules/cache-sync/state-reconciler.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Đệ quy process.nextTick gây Bỏ đói Vòng lặp (Event Loop Starvation)
@Injectable()
export class StateReconcilerBrokenService {
  private processedCount = 0;

  startInfiniteReconciliation(items: ReadonlyArray<string>): void {
    const drainNext = (index: number): void => {
      if (index >= items.length) return;

      // Thực hiện chuẩn hóa chuỗi trên luồng chính
      this.processedCount += items[index].trim().length;

      // LỖI NGHIÊM TRỌNG: Lập trình viên tưởng rằng dùng process.nextTick() sẽ "bất đồng bộ hóa"
      // và nhường luồng cho HTTP Request. Thực tế: nextTick tự chèn vào hàng đợi ưu tiên tối cao,
      // giam cầm vĩnh viễn V8 tại Microtask Checkpoint cho đến khi chạy hết hàng triệu phần tử!
      process.nextTick(() => drainNext(index + 1));
    };

    drainNext(0);
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION PATTERN): Phân mảnh hợp tác qua Pha Check (setImmediate Chunking)
@Injectable()
export class StateReconcilerSafeService {
  private processedCount = 0;
  private readonly chunkSize = 500;

  async reconcileInCooperativeChunks(items: ReadonlyArray<string>): Promise<number> {
    let currentIndex = 0;
    const total = items.length;

    while (currentIndex < total) {
      const end = Math.min(currentIndex + this.chunkSize, total);
      // Xử lý gọn một lô 500 phần tử (~0.3 ms) trên V8 Call Stack
      for (let i = currentIndex; i < end; i++) {
        this.processedCount += items[i].trim().length;
      }
      currentIndex = end;

      // Nếu vẫn còn dữ liệu, đẩy điểm tiếp nối sang Pha CHECK (setImmediate) của vòng Tick kế tiếp.
      // Nhờ đó, Libuv được giải phóng khỏi Microtask Checkpoint để đi qua Pha TIMERS và Pha POLL
      // nhằm tiếp nhận và phản hồi các HTTP Request đang chờ trên Card mạng!
      if (currentIndex < total) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }

    return this.processedCount;
  }
}
\`\`\`

Bảng dưới đây truy vết trạng thái của \`V8 Call Stack\`, \`Microtask Queues\` và \`Pha Poll I/O\` theo từng mili-giây khi hai dịch vụ trên xử lý mảng \`200,000\` bản ghi trong lúc có \`500\` yêu cầu HTTP Health-check đang gọi vào máy chủ:

| Mốc thời gian | Luồng thực thi tại \`BrokenService\` (\`nextTick\`) | Luồng thực thi tại \`SafeService\` (\`setImmediate\`) | Trạng thái Hàng đợi \`nextTick\` & \`Poll I/O\` | Hệ quả vận hành trên Cổng mạng HTTP |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Gọi \`drainNext(0)\`, đăng ký \`nextTick(drainNext(1))\` | Xử lý lô \`0..499\` (\`0.3 ms\`), đăng ký \`setImmediate\` vào \`Check Queue\` | \`Broken\`: \`nextTickQueue\` luôn có \`1\` mục tự sinh; \`Safe\`: \`nextTickQueue\` rỗng | Cả hai vừa bắt đầu; chưa có sự khác biệt bên ngoài |
| **\`t = 1 ms\`** | Đang kẹt ở bước xả \`nextTick\` lần thứ \`2,500\`; **Call Stack chỉ cao 1 frame** (không tràn Stack) | Rời \`Microtask Checkpoint\`, tiến vào **Pha Poll** đọc và trả lời xong \`50\` HTTP Request mới! | \`Broken\`: Kẹt cứng giữa 2 pha; \`Safe\`: Luân chuyển mượt qua \`Poll\` $\rightarrow$ \`Check\` | \`BrokenService\` ngừng nhận kết nối TCP mới; \`SafeService\` phản hồi HTTP trong \`1.2 ms\` |
| **\`t = 50 ms\`** | Vẫn giam cầm CPU trong vòng lặp xả \`nextTick\` lần thứ \`80,000\` | Đã xử lý được \`35,000\` mục xen kẽ với việc phục vụ thành công toàn bộ \`500\` HTTP Request | \`Broken\`: Hàng đợi Socket của Kernel bị dồn ứ \`500\` gói tin chưa được \`epoll_wait\` đọc | Độ trễ P99 của \`BrokenService\` vọt lên \`> 50 ms\`; \`SafeService\` giữ P99 ở mức \`1.8 ms\` |
| **\`t = 180 ms\`** | Hoàn tất \`200,000\` lần \`nextTick\` mới bắt đầu nhả luồng cho Libuv vào Pha Poll | Đã hoàn thành toàn bộ cả lô tính toán lẫn các yêu cầu mạng từ mốc \`t = 135 ms\` | \`Broken\`: Pha Poll bị bỏ đói suốt \`180 ms\` liên tục (**Event Loop Starvation**) | Nếu mảng có \`5,000,000\` phần tử, \`BrokenService\` sẽ treo cứng \`4.5 giây\` và bị Kubernetes giết Pod! |

### 1.4 Định lượng hiệu năng vòng lặp và công thức tính Độ trễ Bỏ đói I/O (Starvation Latency)

Để tính toán chính xác thời gian mà pha \`Poll I/O\` bị bỏ đói khi hệ thống xuất hiện chuỗi Microtask nối đuôi hoặc các lô xử lý đồng bộ quá lớn, ta sử dụng phương trình định lượng chu kỳ vòng lặp (**Event Loop Tick Duration**):

\`\`\`
Tổng thời gian 1 vòng Tick (T_tick) = Sum(T_macro_phases) + Sum(N_microtasks × T_single_microtask)
Thời gian chờ nhận I/O tối đa (Max_IO_Wait_Ms) = T_current_sync_chunk + (N_chained_microtasks × T_microtask)
Ví dụ định lượng: Nếu mỗi chunk xử lý 500 mục tốn 0.4 ms rồi nhường bằng setImmediate -> Max_IO_Wait ≈ 0.4 ms | Nếu nối đuôi 200,000 nextTick (0.001 ms/hàm) -> Max_IO_Wait = 200 ms (Tê liệt toàn bộ cổng HTTP trong 200 ms)
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc bất biến về Đơn luồng và Hàng đợi Microtask):**
> 1. **Đệ quy Microtask không giải phóng Event Loop (Recursive Microtask Trap):** Việc bọc đệ quy trong \`process.nextTick()\` hay \`Promise.resolve().then()\` chỉ giúp làm rỗng \`V8 Call Stack\` (tránh lỗi \`RangeError: Maximum call stack size exceeded\`), nhưng **tuyệt đối không nhường quyền điều khiển cho Libuv Event Loop** vì bộ điều phối bắt buộc phải xả cạn kiệt hàng đợi Microtask trước khi chuyển pha.
> 2. **Nguyên tắc Phân mảnh Hợp tác (Cooperative Chunking Principle):** Mọi tác vụ lặp qua tập dữ liệu lớn trên luồng chính đều phải được cắt thành các lô nhỏ có thời gian chạy dưới **\`1 ms – 2 ms\`** và nhường luồng qua **\`setImmediate()\`** để vòng lặp có thể đi qua pha \`Poll\` phục vụ mạng.

---

# 2. CƠ CHẾ VẬN HÀNH 6 PHA CỦA LIBUV EVENT LOOP VÀ BÀI TOÁN TẤT ĐỊNH HẸN GIỜ

### 2.1 Giải phẫu tuần tự 6 Pha trong hàm \`uv_run()\` của Libuv

Mỗi vòng quay trọn vẹn của Event Loop được gọi là một **Tick**. Bên trong mã nguồn C của Libuv (tệp \`src/unix/core.c\`), hàm \`uv_run()\` thực thi một vòng lặp \`while (r != 0 && loop->stop_flag == 0)\` đi qua đúng **6 pha tuần tự cố định** sau đây:

1. **Pha 1 — \`Timers\` (\`uv__run_timers\`):**
   Kiểm tra và thực thi các callback được đăng ký bởi \`setTimeout()\` và \`setInterval()\` đã tới hoặc vượt quá thời điểm hết hạn (\`expiry <= loop->time\`). Ngay đầu mỗi vòng Tick, Libuv gọi \`uv__update_time(loop)\` để lấy mốc thời gian đơn điệu từ nhân hệ điều hành (\`CLOCK_MONOTONIC\`) và lưu vào bộ nhớ đệm nhằm tránh phải gọi system call lấy giờ quá nhiều lần.
2. **Pha 2 — \`Pending Callbacks\` / I/O Callbacks (\`uv__run_pending\`):**
   Thực thi các callback của những thao tác I/O hệ thống cấp thấp đã bị trì hoãn từ vòng Tick trước đó. Ví dụ điển hình: khi một socket TCP cố gắng kết nối ra ngoài nhưng nhận ngay lỗi từ chối kết nối \`ECONNREFUSED\` trên một số hệ điều hành Unix, nhân OS muốn báo lỗi ngay lập tức nhưng Libuv sẽ đẩy callback báo lỗi đó vào danh sách \`pending_queue\` để thực thi một cách an toàn và đồng nhất tại Pha 2 của vòng Tick kế tiếp.
3. **Pha 3 — \`Idle, Prepare\` (\`uv__run_idle\`, \`uv__run_prepare\`):**
   Hai pha quản trị nội bộ của Libuv và các tiện ích mở rộng C++ Native Addons (chẳng hạn trình thu thập số liệu APM như Datadog/NewRelic dùng \`uv_prepare_t\` để bấm giờ ngay trước khi luồng chính bước vào pha chờ I/O). Lưu ý thuật ngữ: chữ *"Idle"* ở đây là tên của cấu trúc \`uv_idle_t\` chạy ở mỗi vòng lặp chứ không có nghĩa là CPU đang rảnh rỗi.
4. **Pha 4 — \`Poll\` (\`uv__io_poll\` — Trái tim của toàn bộ kiến trúc Bất đồng bộ):**
   Đây là pha quan trọng nhất đảm nhiệm hai trọng trách: **(a)** Tính toán xem luồng chính được phép ngủ chờ gói tin mạng trong tối đa bao nhiêu mili-giây (\`timeout\`), và **(b)** Gọi system call \`epoll_wait()\` (trên Linux) hoặc \`kevent()\` (trên macOS) để thu hoạch toàn bộ các sự kiện dữ liệu mạng mới gửi đến (\`HTTP Request\`, phản hồi \`PostgreSQL/Redis\`, dữ liệu \`Socket\`) cũng như tín hiệu hoàn thành từ \`Libuv Threadpool\` (\`fs.readFile\`, \`crypto.pbkdf2\`), sau đó thực thi các callback tương ứng.
5. **Pha 5 — \`Check\` (\`uv__run_check\`):**
   Pha được thiết kế dành riêng cho hàm **\`setImmediate()\`**. Ngay khi pha \`Poll\` vừa xử lý xong đợt dữ liệu I/O hoặc nhận thấy hàng đợi \`Poll\` đã trống, nếu có bất kỳ callback nào được đăng ký qua \`setImmediate()\`, Libuv sẽ lập tức dừng việc chờ ở pha \`Poll\` để bước thẳng sang pha \`Check\` thực thi chúng.
6. **Pha 6 — \`Close Callbacks\` (\`uv__run_closing_handles\`):**
   Thực thi các hàm dọn dẹp tài nguyên khi một Handle bị đóng cưỡng bức hoặc kết thúc vòng đời (ví dụ: sự kiện \`socket.on('close', ...)\` khi gọi \`socket.destroy()\`), giải phóng vùng nhớ cấu trúc C và đóng hoàn toàn các File Descriptor trên hệ điều hành trước khi khép lại vòng Tick.

Bảng dưới đây tổng hợp thông số kỹ thuật, cấu trúc dữ liệu nội bộ và điều kiện dừng của cả 6 pha trong Libuv:

| Thứ tự Pha | Tên Pha trong Libuv (\`C Function\`) | Nguồn phát sinh Tác vụ JavaScript | Cấu trúc dữ liệu lưu trữ nội bộ | Độ phức tạp truy xuất | Điều kiện kết thúc Pha để chuyển tiếp |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pha 1** | **\`Timers\`** (\`uv__run_timers\`) | \`setTimeout(fn, delay)\`, \`setInterval(fn, delay)\` | **Cây nhị phân \`Min-Heap\`** khóa theo mốc thời gian hết hạn \`expiry\` | Xem đỉnh \`O(1)\`; Chèn/Xóa \`O(log N)\` | Khi nút gốc của \`Min-Heap\` có \`expiry > loop->time\` (chưa tới hạn) |
| **Pha 2** | **\`Pending Callbacks\`** (\`uv__run_pending\`) | Lỗi socket hệ thống trả về trễ (như \`ECONNREFUSED\`, \`EPIPE\`) | Danh sách liên kết vòng đôi (**Intrusive Doubly-Linked Queue**) | Lấy đầu hàng đợi \`O(1)\` | Khi hàng đợi \`pending_queue\` tại thời điểm bắt đầu pha đã được lấy hết |
| **Pha 3** | **\`Idle, Prepare\`** (\`uv__run_idle/prepare\`) | Hook nội bộ của Libuv,V8 Profiler và các thư viện giám sát APM C++ | Danh sách liên kết các cấu trúc \`uv_idle_t\` và \`uv_prepare_t\` đang kích hoạt | Duyệt tuyến tính các handle \`O(H)\` | Khi tất cả các callback quản trị nội bộ đã đăng ký được gọi qua 1 lượt |
| **Pha 4** | **\`Poll\`** (\`uv__io_poll\`) | Kết nối \`net\`, \`http\`, \`https\`, phản hồi \`fs.*\`, \`crypto.*\`, \`dns.*\` | Hàng đợi \`watcher_queue\` kết hợp bảng sự kiện Kernel (\`epoll_event[]\`) | Thu hoạch sự kiện sẵn sàng \`O(1)\` | Khi hết sự kiện I/O sẵn sàng, hết thời gian \`timeout\`, hoặc đạt trần số lượng callback tối đa |
| **Pha 5** | **\`Check\`** (\`uv__run_check\`) | Duy nhất hàm **\`setImmediate(fn)\`** của Node.js | Danh sách liên kết hàng đợi \`check_handles\` theo thứ tự FIFO | Chèn và lấy ra \`O(1)\` | Khi toàn bộ các lệnh \`setImmediate\` đăng ký trước khi vào pha \`Check\` đã chạy xong |
| **Pha 6** | **\`Close Callbacks\`** (\`uv__run_closing_handles\`) | Sự kiện \`.on('close')\` của \`net.Socket\`, \`http.Server\`, \`fs.FSWatcher\` | Danh sách đơn \`closing_handles\` nối các tài nguyên đang chờ hủy | Duyệt và giải phóng bộ nhớ \`O(1)\`/mục | Khi toàn bộ các handle đánh dấu \`UV_HANDLE_CLOSING\` đã được thu hồi xong |

### 2.2 Cấu trúc Min-Heap của Pha Timers và Thuật toán tính \`uv__backend_timeout\` ở Pha Poll

Hai cơ chế toán học tinh vi nhất giúp Libuv vừa đạt độ chính xác cao vừa không tiêu tốn \`100% CPU\` khi rảnh rỗi nằm ở sự phối hợp giữa Pha 1 (\`Timers\`) và Pha 4 (\`Poll\`):

1. **Quản lý hàng chục nghìn bộ hẹn giờ bằng \`Min-Heap\` và Hiện tượng Trôi thời gian (\`Timer Drift\`):**
   Nếu một máy chủ WebSocket duy trì \`50,000\` kết nối và mỗi kết nối đều gắn một bộ hẹn giờ kiểm tra nhịp tim (\`Heartbeat Timeout 30s\`), việc dùng mảng hay danh sách liên kết để kiểm tra xem bộ hẹn giờ nào đã hết hạn ở mỗi vòng Tick sẽ tốn độ phức tạp \`O(N)\`, làm sập CPU ngay lập tức.
   - Thay vào đó, Libuv lưu toàn bộ các bộ hẹn giờ vào cấu trúc **Cây nhị phân \`Min-Heap\`** dựa trên giá trị \`expiry = start_time + delay_ms\`. Phần tử nằm ở nút gốc (\`Root Node\`) của cây luôn luôn là bộ hẹn giờ có thời điểm hết hạn **sớm nhất** trên toàn hệ thống.
   - Khi bước vào Pha 1, Libuv chỉ cần đọc nút gốc với chi phí **\`O(1)\`**. Nếu \`root.expiry > loop->time\`, Libuv kết luận ngay lập tức rằng **không có bất kỳ bộ hẹn giờ nào trong số 50,000 bộ còn lại hết hạn** và lập tức rời khỏi Pha 1 mà không cần kiểm tra phần tử thứ hai!
   - Lưu ý kỹ thuật: Giá trị \`delay\` trong \`setTimeout(fn, 100)\` chỉ đảm bảo callback **không bao giờ chạy trước \`100 ms\`**, chứ không đảm bảo nó chạy đúng tại mốc \`100.0 ms\`. Nếu ở mốc \`t = 95 ms\`, một hàm xử lý ở Pha \`Poll\` chiếm giữ CPU mất \`40 ms\`, thì phải đến \`t = 135 ms\` vòng lặp mới quay lại Pha \`Timers\`, gây ra độ lệch trễ gọi là **\`Timer Drift\`** (\`35 ms\`). Đặc biệt, nếu truyền \`setTimeout(fn, 0)\`, mã nguồn Node.js sẽ tự động ép (clamp) giá trị \`0\` thành **\`1 ms\`** theo quy ước chuẩn POSIX/HTML5.
2. **Thuật toán quyết định thời gian ngủ chờ của Pha Poll (\`uv__backend_timeout\`):**
   Khi luồng chính tiến vào Pha 4 (\`Poll\`) và đã xử lý xong các sự kiện I/O có sẵn, câu hỏi đặt ra là: *Luồng chính nên dừng lại chờ gói tin mạng mới trong bao lâu trước khi đi tiếp sang Pha 5 (\`Check\`)?* Hàm \`uv__backend_timeout(loop)\` tính toán con số này theo 4 quy tắc ưu tiên tuyệt đối:
   - **Trả về \`0 ms\` (Không chờ, đi tiếp ngay lập tức)** nếu: vòng lặp đang chuẩn bị dừng (\`stop_flag != 0\`), hoặc không có handle/request nào hoạt động, hoặc **đang có tác vụ nằm trong \`pending_queue\` (Pha 2)**, hoặc **đang có \`setImmediate\` chờ sẵn trong Pha 5 (\`Check\`)**, hoặc có handle đang chờ đóng ở Pha 6.
   - **Trả về \`-1\` (Chờ vô hạn cho đến khi có gói tin mạng đánh thức)** nếu: \`Min-Heap\` của Pha \`Timers\` hoàn toàn trống rỗng và không thỏa mãn điều kiện trả về \`0\` nào ở trên.
   - **Trả về \`(root_timer.expiry - loop->time) ms\`** nếu: có bộ hẹn giờ đang nằm trong \`Min-Heap\`. Nhờ vậy, \`epoll_wait\` sẽ ngủ đúng bằng khoảng thời gian còn lại của bộ hẹn giờ gần nhất; nếu không có gói tin mạng nào đến, đúng khoảnh khắc bộ hẹn giờ chạm mốc hết hạn, Kernel sẽ đánh thức luồng chính dậy để vòng về Pha 1 thực thi \`setTimeout\`!

\`\`\`
Thời gian ngủ tại Pha Poll (Poll_Block_Timeout_Ms) = 0 (nếu có setImmediate / Pending / Closing) | HOẶC = max(0, MinHeap_Root_Expiry_Ms - Current_Loop_Time_Ms)
Thời điểm thực thi thực tế của setTimeout(fn, D) = Start_Time + max(1, D) + Event_Loop_Phase_Drift_Ms
Ví dụ định lượng: Đăng ký setTimeout(fn, 10) tại t = 0 ms, đồng thời Pha Poll xử lý 1 lô dữ liệu mất 25 ms -> Timer chạy tại t = 25 ms (Độ trễ thực tế = 25 ms, Timer Drift = +15 ms)
\`\`\`

### 2.3 Chứng minh thực nghiệm: \`setTimeout(fn, 0)\` đối đầu \`setImmediate(fn)\`

Từ cấu trúc 6 pha và thuật toán \`uv__backend_timeout\` ở trên, chúng ta có thể giải thích một cách chặt chẽ bằng toán học cho câu hỏi phỏng vấn kiến trúc kinh điển: *Khi gọi song song \`setTimeout(fn, 0)\` và \`setImmediate(fn)\`, hàm nào sẽ chạy trước?*

\`\`\`typescript
// File: src/diagnostics/phase-ordering-verifier.service.ts
// Minh họa sự khác biệt giữa Top-level Non-deterministic và I/O Callback Deterministic
import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PhaseOrderingVerifierService {
  // TRƯỜNG HỢP 1: Chạy trực tiếp ở Top-level Module/Bootstrap -> BẤT ĐỊNH (NON-DETERMINISTIC)
  demonstrateTopLevelRace(): void {
    // Bị Node.js ép thành delay = 1ms và đưa vào Min-Heap của Pha 1 (Timers)
    setTimeout(() => console.info('[Top-Level] 1. setTimeout(0) tại Pha TIMERS'), 0);
    // Đưa vào hàng đợi check_handles của Pha 5 (Check)
    setImmediate(() => console.info('[Top-Level] 2. setImmediate() tại Pha CHECK'));
  }

  // TRƯỜNG HỢP 2: Chạy bên trong một I/O Callback -> TẤT ĐỊNH 100% (DETERMINISTIC)
  demonstrateIoCallbackCertainty(filePath: string): Promise<string[]> {
    return new Promise((resolve) => {
      const executionOrder: string[] = [];

      // Callback của fs.readFile luôn được thực thi ngay bên trong PHA 4 (POLL)
      fs.readFile(filePath, () => {
        setTimeout(() => {
          executionOrder.push('TIMERS_TIMEOUT_0');
          resolve(executionOrder);
        }, 0);

        setImmediate(() => {
          executionOrder.push('CHECK_IMMEDIATE');
        });
      });
    });
  }
}
\`\`\`

1. **Giải thích Trường hợp 1 (Chạy ở Top-level — Không xác định):**
   Khi đăng ký ở ngoài cùng, \`setTimeout(fn, 0)\` được đặt ngưỡng hết hạn là **\`1 ms\`**. Sau khi thực thi xong đoạn script đồng bộ ban đầu, tiến trình bắt đầu bước vào vòng lặp \`uv_run()\` đầu tiên tại **Pha 1 (\`Timers\`)**:
   - Nếu quá trình nạp môi trường và khởi tạo của CPU mất **\`>= 1 ms\`** (do máy chủ đang bận hoặc có thêm vài lệnh đồng bộ), khi kiểm tra \`Min-Heap\`, timer đã chạm ngưỡng \`1 ms\` $\rightarrow$ **\`setTimeout\` chạy trước**, sau đó vòng lặp mới đi qua \`Poll\` xuống \`Check\` để chạy \`setImmediate\`.
   - Ngược lại, nếu CPU cực nhanh và tiến vào Pha 1 khi mới trôi qua **\`0.2 ms\`** (\`< 1 ms\`), timer trong \`Min-Heap\` chưa hết hạn! Libuv bỏ qua Pha 1, đi xuống Pha 4 (\`Poll\`), thấy có \`setImmediate\` đang chờ nên đặt \`timeout = 0\` để nhảy thẳng sang **Pha 5 (\`Check\`)** $\rightarrow$ **\`setImmediate\` chạy trước**, rồi ở vòng Tick thứ 2 mới quay lại Pha 1 chạy \`setTimeout\`!
2. **Giải thích Trường hợp 2 (Chạy bên trong I/O Callback — \`setImmediate\` luôn chạy trước 100%):**
   Callback của \`fs.readFile\` (hoặc bất kỳ sự kiện nhận dữ liệu \`net.Socket\`, \`http.IncomingMessage\` nào) luôn luôn được Libuv gọi khi luồng chính đang đứng ngay tại **Pha 4 (\`Poll\`)**.
   - Ngay khi callback của \`fs.readFile\` kết thúc, cả \`setTimeout\` (nằm ở Pha 1) và \`setImmediate\` (nằm ở Pha 5) đều đã được đăng ký.
   - Theo chiều quay cố định của vòng lặp Libuv, khi rời khỏi **Pha 4 (\`Poll\`)**, bước tiếp theo liền kề bắt buộc phải là **Pha 5 (\`Check\`)**. Do đó, \`setImmediate\` chắc chắn 100% được thực thi ngay trong vòng Tick hiện tại, còn \`setTimeout\` phải đợi khép kín Pha 6 rồi bước sang Pha 1 của vòng Tick kế tiếp mới tới lượt!

> **Tổng kết học thuật Phần 2 (Quy tắc lựa chọn giữa \`setImmediate\` và \`setTimeout(0)\`):**
> Trong kiến trúc Backend Node.js, khi cần hoãn một tác vụ sang pha Macrotask tiếp theo (đặc biệt là bên trong các luồng xử lý I/O), **luôn luôn sử dụng \`setImmediate()\` thay vì \`setTimeout(fn, 0)\`**. \`setImmediate\` quản lý bằng danh sách liên kết \`O(1)\` và chạy ngay ở pha \`Check\` liền sau pha \`Poll\`, giúp loại bỏ hoàn toàn chi phí chèn/xóa cây \`Min-Heap O(log N)\` cũng như độ trễ kẹp tối thiểu \`1 ms\` của bộ hẹn giờ.

---

# 3. QUY TẮC XẢ MICROTASKS TỪ NODE.JS 11+ VÀ CHẨN ĐOÁN NGHẼN LUỒNG TRONG NESTJS

### 3.1 Bước ngoặt lịch sử Node.js 11+: Xả Microtask giữa từng Callback đơn lẻ (Per-Callback Drain)

Một chi tiết kỹ thuật chuyên sâu thường gây nhầm lẫn khi đọc các tài liệu cũ là thời điểm chính xác mà Microtask Queue được xả bên trong một pha của Libuv:

1. **Hành vi cũ (Node.js 10 trở về trước — Phase-boundary Drain):**
   Giả sử trong \`Min-Heap\` của Pha \`Timers\` có **2 hàm** \`timer1\` và \`timer2\` cùng hết hạn một lúc. Ở Node.js 10, Libuv sẽ chạy \`timer1\`, sau đó chạy luôn \`timer2\` cho hết sạch hàng đợi của Pha \`Timers\`, rồi mới dừng lại xả các \`nextTick\` và \`Promise.then\` do \`timer1\` sinh ra. Hành vi này mâu thuẫn với chuẩn HTML5 Event Loop trên các trình duyệt Web.
2. **Hành vi chuẩn hiện đại (Từ Node.js 11+ đến nay — Per-Callback Immediate Drain):**
   Để đồng nhất 100% ngữ nghĩa thực thi JavaScript giữa Server và Browser, kể từ Node.js 11, **ngay sau khi MỖI callback đơn lẻ trong bất kỳ pha nào kết thúc** (tức ngay sau khi \`timer1\` vừa rút khỏi \`Call Stack\` và trước cả khi \`timer2\` được gọi), Node.js sẽ lập tức kích hoạt \`Microtask Checkpoint\` để xả sạch toàn bộ \`process.nextTickQueue\` và \`Promise Microtask Queue\`!
3. **Truyền tải Ngữ cảnh Bất đồng bộ (\`AsyncLocalStorage Context Propagation\`) qua Microtasks:**
   Trong các hệ thống Microservices viết bằng NestJS, để gắn mã truy vết phân tán (\`Correlation ID / Trace ID\`) xuyên suốt từ \`Middleware\` $\rightarrow$ \`Guard\` $\rightarrow$ \`Interceptor\` $\rightarrow$ \`Service\` $\rightarrow$ \`TypeORM Query\` mà không cần truyền tham số \`req\` qua từng hàm, Node.js cung cấp lớp **\`AsyncLocalStorage\`** (dựa trên module nội bộ \`async_hooks\`). Mỗi khi một \`Promise\`, \`nextTick\` hoặc \`setImmediate\` được khởi tạo, V8 và Node.js sẽ tự động sao chép con trỏ ngăn xếp ngữ cảnh (\`ExecutionAsyncResource\`) tại thời điểm đăng ký và khôi phục lại đúng ngữ cảnh đó khi callback được lấy ra thực thi ở các pha sau.

### 3.2 Truy vết thứ tự thực thi đa tầng qua mã nguồn kiểm chứng

Để làm chủ hoàn toàn thứ tự điều phối phức tạp khi một hàm NestJS pha trộn cả mã đồng bộ, \`nextTick\`, chuỗi \`Promise / async-await\`, \`setTimeout\` và \`setImmediate\` bên trong một I/O Callback, hãy phân tích đoạn mã nguồn truy vết chuẩn dưới đây:

\`\`\`typescript
// File: src/diagnostics/execution-trace-analyzer.service.ts
// Mô phỏng và kiểm chứng thứ tự xả hàng đợi đa tầng chuẩn Node.js 11+
import * as fs from 'node:fs';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ExecutionTraceAnalyzerService {
  runDeterministicTrace(sampleFilePath: string): Promise<string[]> {
    return new Promise((resolve) => {
      const traceLog: string[] = [];

      // Bắt đầu từ một I/O Callback tại Pha 4 (POLL)
      fs.readFile(sampleFilePath, () => {
        traceLog.push('1_POLL_IO_SYNC_START');

        setTimeout(() => {
          traceLog.push('7_TIMERS_MACROTASK');
          resolve(traceLog);
        }, 0);

        setImmediate(() => {
          traceLog.push('5_CHECK_IMMEDIATE_MACROTASK');
          // Ngay khi callback của setImmediate kết thúc, Microtask này được xả tức thì trước khi sang Pha Timers!
          Promise.resolve().then(() => {
            traceLog.push('6_PROMISE_INSIDE_IMMEDIATE');
          });
        });

        Promise.resolve().then(() => {
          traceLog.push('4_PROMISE_MICROTASK');
        });

        process.nextTick(() => {
          traceLog.push('3_NEXT_TICK_MICROTASK');
        });

        traceLog.push('2_POLL_IO_SYNC_END');
      });
    });
  }
}
\`\`\`

Bảng dưới đây truy vết chi tiết từng bước chuyển dịch của các hàng đợi trong bộ nhớ kể từ thời điểm \`fs.readFile\` hoàn tất đọc đĩa và được thực thi tại Pha \`Poll\`:

| Bước thực thi | Pha hiện tại của Libuv | Khung hàm đang chạy trên \`V8 Call Stack\` | Trạng thái các Hàng đợi (\`nextTick\` / \`Promise\` / \`Check\` / \`Timers\`) | Dòng nhật ký được ghi vào \`traceLog\` |
| :--- | :--- | :--- | :--- | :--- |
| **\`Bước 1 (t = 0.0 ms)\`** | **Pha 4 (\`Poll\`)** | Chạy thân hàm callback của \`fs.readFile\` (từ đầu đến cuối) | Đăng ký: \`Timers=[cb7]\`, \`Check=[cb5]\`, \`Promise=[cb4]\`, \`nextTick=[cb3]\` | Ghi **\`1_POLL_IO_SYNC_START\`** và **\`2_POLL_IO_SYNC_END\`** |
| **\`Bước 2 (t = 0.1 ms)\`** | Ranh giới sau callback ở **Pha 4 (\`Poll\`)** | \`Call Stack\` trống $\rightarrow$ Kích hoạt **\`Microtask Checkpoint\`** ưu tiên \`nextTickQueue\` | Lấy \`cb3\` khỏi \`nextTickQueue\`; còn lại \`Promise=[cb4]\`, \`Check=[cb5]\`, \`Timers=[cb7]\` | Ghi **\`3_NEXT_TICK_MICROTASK\`** |
| **\`Bước 3 (t = 0.2 ms)\`** | Ranh giới sau callback ở **Pha 4 (\`Poll\`)** | \`nextTickQueue\` đã rỗng $\rightarrow$ Xả tiếp **\`Promise Microtask Queue\`** | Lấy \`cb4\` khỏi \`Promise Queue\`; hai hàng đợi Microtask đã trống 100% | Ghi **\`4_PROMISE_MICROTASK\`** |
| **\`Bước 4 (t = 0.3 ms)\`** | Chuyển sang **Pha 5 (\`Check\`)** | Thực thi callback \`cb5\` của \`setImmediate\` | Trong lúc chạy \`cb5\`, nó đẩy thêm \`cb6\` vào \`Promise Microtask Queue\` | Ghi **\`5_CHECK_IMMEDIATE_MACROTASK\`** |
| **\`Bước 5 (t = 0.4 ms)\`** | Ranh giới ngay sau \`cb5\` ở **Pha 5 (\`Check\`)** | Theo quy tắc Node 11+, xả ngay Microtask phát sinh trước khi rời Pha 5 | Lấy \`cb6\` khỏi \`Promise Queue\`; lúc này chỉ còn \`Timers=[cb7]\` | Ghi **\`6_PROMISE_INSIDE_IMMEDIATE\`** |
| **\`Bước 6 (t = 1.0 ms)\`** | Qua Pha 6, vòng về **Pha 1 (\`Timers\`)** của Tick mới | Thực thi \`cb7\` khi đồng hồ chạm mốc \`1 ms\` và gọi \`resolve(traceLog)\` | Toàn bộ hàng đợi đã được xử lý sạch sẽ | Ghi **\`7_TIMERS_MACROTASK\`** (Hoàn tất chuỗi 1 $\rightarrow$ 7) |

### 3.3 Phương pháp Chẩn đoán & Giám sát Điểm nghẽn Vòng lặp trên Production

Trên môi trường vận hành thực tế, khi một API của NestJS phản hồi chậm bất thường (\`High Latency\`), kỹ sư hệ thống phải xác định ngay lập tức xem nguyên nhân nằm ở **Tác vụ Chặn Luồng Chính (\`Call Stack Blocking\`)**, **Bão Microtask (\`Microtask Starvation\`)**, hay **Quá tải Hàng đợi Hẹn giờ (\`Timer Heap Bloat\`)**. Bảng dưới đây cung cấp ma trận chẩn đoán chuẩn Production:

| Triệu chứng quan sát trên Hệ thống | Công cụ / API Chẩn đoán trong Node.js | Chỉ số định lượng bất thường | Nguyên nhân gốc rễ trong Mã nguồn NestJS | Giải pháp Kiến trúc Khắc phục |
| :--- | :--- | :--- | :--- | :--- |
| **Toàn bộ API và \`/healthz\` treo cứng đồng loạt trong vài giây dù DB vẫn rảnh** | \`perf_hooks.monitorEventLoopDelay()\` và \`process.cpuUsage()\` | \`P99 Event Loop Lag > 500 ms\`; \`User CPU = 100%\` trên 1 lõi duy nhất | Vòng lặp đồng bộ nặng, \`JSON.parse/stringify\` payload lớn, hoặc đệ quy \`process.nextTick\` | Cắt nhỏ bằng **\`setImmediate\` Chunking** hoặc đẩy sang **\`Worker Threads\`** độc lập |
| **Độ trễ của \`setTimeout\` bị trôi xa gấp 10 lần giá trị \`delay\` truyền vào** | So sánh \`performance.now()\` trước và khi vào callback của Timer | Đăng ký \`setTimeout(fn, 50)\` nhưng thực tế mất \`450 ms\` mới được gọi (\`Drift = +400 ms\`) | Một callback ở Pha \`Poll\` hoặc chuỗi \`Promise.all\` hàng chục nghìn phần tử giữ chặt vòng lặp | Giới hạn kích thước lô \`Promise\` và không thực hiện biến đổi mảng lớn đồng bộ trong \`Interceptor\` |
| **Bộ nhớ RAM tăng dần kèm CPU cao ở Pha 1 (\`uv__run_timers\`)** | \`process._getActiveHandles()\` hoặc \`async_hooks\` đếm số lượng \`Timeout\` | Hàng chục nghìn đối tượng \`Timer\` tồn tại trong \`Min-Heap\` không được giải phóng | Tạo \`setTimeout\` làm bộ hẹn giờ hủy (\`Timeout Race\`) cho mỗi request nhưng quên gọi \`clearTimeout()\` khi xong sớm | Luôn gọi **\`clearTimeout(timerId)\`** trong khối \`finally\` hoặc dùng \`AbortSignal.timeout(ms)\` kèm \`.unref()\` |
| **Tiến trình không chịu thoát khi nhận tín hiệu \`SIGTERM\` lúc triển khai mới** | Gọi \`process.getActiveResourcesInfo()\` (Node 17.3+) trong hook \`OnApplicationShutdown\` | Danh sách trả về còn \`TCPSocketWrap\`, \`Timeout\` hoặc \`Immediate\` đang neo giữ \`uv_loop_t\` | Có \`setInterval\` chạy ngầm thu thập metric hoặc kết nối Redis/DB chưa đóng khi Shutdown | Gọi **\`timer.unref()\`** cho các bộ định kỳ nền (để không giữ sống Event Loop) và đóng kết nối trong \`onModuleDestroy\` |
| **Mất mã \`traceId\` của \`AsyncLocalStorage\` ở một số nhánh callback cũ** | Kiểm tra \`asyncLocalStorage.getStore()\` trả về \`undefined\` | Ngữ cảnh bị đứt gãy sau khi đi qua một thư viện dùng hàng đợi mảng tự chế (\`Custom Userland Queue\`) | Thư viện gom nhiều request vào một mảng toàn cục rồi xử lý chung bằng 1 timer khởi tạo từ trước | Bọc hàm callback bằng **\`AsyncResource.bind(fn)\`** để gắn chặt ngữ cảnh tại thời điểm đăng ký |

> **Tổng kết học thuật Phần 3 (Kỷ luật sử dụng \`.unref()\` và quản lý \`Timeout\` trong NestJS):**
> Đối với mọi bộ hẹn giờ định kỳ phục vụ mục đích phụ trợ (như xóa bộ đệm hết hạn mỗi 60 giây hoặc đẩy log nội bộ bằng \`setInterval\`), bắt buộc phải gọi phương thức **\`intervalRef.unref()\`**. Lệnh \`.unref()\` báo cho Libuv không tính bộ hẹn giờ này vào bộ đếm \`active_handles\`, giúp tiến trình NestJS có thể đóng gói và thoát an toàn (\`Graceful Shutdown\`) ngay khi máy chủ HTTP đã ngừng nhận kết nối mà không bị treo lơ lửng.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Điều Phối V8 & Libuv (Runtime Execution & Queue Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG THỰC THI ĐỒNG BỘ TRÊN LUỒNG CHÍNH (V8 SYNCHRONOUS EXECUTION LAYER)    │
│    [ V8 Call Stack (Khung gọi LIFO) ] ◄───► [ NestJS Pipeline (Guards/Pipes/Controllers) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Call Stack trống -> Kích hoạt Microtask Checkpoint
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG HÀNG ĐỢI ƯU TIÊN TỐI CAO (HIGH-PRIORITY MICROTASK DRAIN LAYER)        │
│    ├── Ưu tiên 1 (nextTickQueue): Xả cạn kiệt toàn bộ process.nextTick()      │
│    ├── Ưu tiên 2 (Promise Queue): Xả sạch Promise.then / await / queueMicrotask│
│    └── Rào chắn chuyển pha: Cấm Libuv đi tiếp nếu 2 hàng đợi này chưa rỗng    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Microtasks = 0 -> Tiến vào vòng quay uv_run()
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG VÒNG LẶP SỰ KIỆN 6 PHA LIBUV (LIBUV 6-PHASE MACROTASK ENGINE LAYER)   │
│    ├── Pha 1-3 (Timers & Pending): Duyệt Min-Heap O(1) & xử lý lỗi syscall trễ │
│    ├── Pha 4 (Poll I/O Multiplexing): Thu hoạch gói tin mạng qua epoll/kqueue │
│    └── Pha 5-6 (Check & Close): Chạy setImmediate() & thu hồi File Descriptors │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Lô Dữ Liệu Lớn (Microtask Starvation vs Cooperative setImmediate Chunking)
\`\`\`diagram
MÔ HÌNH CŨ: ĐỆ QUY NEXTTICK HOẶC VÒNG LẶP ĐỒNG BỘ LỚN (EVENT LOOP STARVATION)
Nhận 100,000 mục ──► [ Đệ quy process.nextTick ] ──► [ Kẹt ở Microtask Queue ] ──► TÊ LIỆT PHA POLL I/O
10,000 HTTP Requests = Bị dồn ứ trong Kernel Socket Backlog, gây Timeout 504 hàng loạt.

MÔ HÌNH HIỆN ĐẠI: PHÂN MẢNH HỢP TÁC QUA PHA CHECK (COOPERATIVE SETIMMEDIATE CHUNKING)
Chunk 1 (500 mục) ──┐
Chunk 2 (500 mục) ──┼──► [ Xử lý 0.4ms rồi gọi setImmediate ] ──► Giải phóng sang Pha Poll đọc HTTP
Chunk 3 (500 mục) ──┘                      │
                                           └──► Phục vụ song hành ────► Độ trễ API giữ mức < 2ms
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Lựa Chọn Cơ Chế Lập Lịch & Hoãn Thực Thi Trong Node.js)
\`\`\`diagram
                   CẦN LẬP LỊCH HOẶC HOÃN THỰC THI MỘT TÁC VỤ TRONG BACKEND NODE.JS?
                                                   │
                                                   ▼
                          Mục đích kỹ thuật của việc hoãn thực thi là gì?
                          /                                             \\
        CẦN CHẠY NGAY TRƯỚC KHI LIBUV CHUYỂN PHA                CẦN NHƯỜNG LUỒNG CHO I/O HOẶC HẸN GIỜ
                      /                                                           \\
                     ▼                                                             ▼
    [ SỬ DỤNG MICROTASKS (CHÚ Ý STARVATION) ]               Cần chạy ngay sau pha Poll hay cần trễ theo mốc giờ?
    - Dùng Promise.then / queueMicrotask cho chuẩn chung     /                                                 \\
    - Chỉ dùng process.nextTick cho phát sự kiện khẩn cấp   CHIA NHỎ VIỆC NẶNG / CHẠY SAU POLL         TRÌ HOÃN THEO THỜI GIAN (DELAY MS)
    - Nghiêm cấm đệ quy không điểm dừng!                            /                                                   \\
                                                                   ▼                                                     ▼
                                                  [ DÙNG SETIMMEDIATE TẠI PHA CHECK (TỐI ƯU) ]          [ DÙNG SETTIMEOUT TẠI PHA TIMERS (CHUẨN) ]
                                                  - Hàng đợi liên kết O(1) ngay sau Pha Poll            - Quản lý bằng cấu trúc cây Min-Heap O(log N)
                                                  - Cho phép xen kẽ xử lý các kết nối HTTP mới          - Nhớ gọi clearTimeout() và .unref() cho job nền
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Cơ Chế Điều Phối Tác Vụ Trong Node.js)

| Tiêu Chí So Sánh | \`process.nextTick(fn)\` | \`Promise.then\` / \`queueMicrotask\` | \`setImmediate(fn)\` (Pha Check) | \`setTimeout(fn, delay)\` (Pha Timers) |
| :--- | :--- | :--- | :--- | :--- |
| **Thời điểm kích hoạt chính xác** | Ngay lập tức khi \`Call Stack\` vừa trống, **trước** mọi Promise và I/O | Ngay sau khi \`nextTickQueue\` đã rỗng, giữa mỗi callback của bất kỳ pha nào | Tại **Pha 5 (\`Check\`)**, ngay sau khi Pha 4 (\`Poll\`) hoàn tất đợt đọc I/O | Tại **Pha 1 (\`Timers\`)** của vòng Tick tiếp theo sau khi đã qua tối thiểu \`max(1, delay) ms\` |
| **Cấu trúc dữ liệu & Chi phí CPU** | Mảng vòng C++ (\`O(1)\`), chi phí cực thấp | Hàng đợi nội bộ của V8 Engine (\`O(1)\`), tối ưu hóa cao cho \`async/await\` | Danh sách liên kết đôi của Libuv (\`O(1)\`), không tốn công so sánh đồng hồ | Cây nhị phân **\`Min-Heap\`** (\`O(log N)\` khi thêm/xóa), tốn chi phí duy trì thứ tự thời gian |
| **Khả năng nhường luồng cho I/O mạng** | **Không (0%)**: Chặn đứng việc tiến vào Pha \`Poll\` nếu gọi liên tiếp | **Không (0%)**: Chặn đứng việc chuyển pha của Libuv nếu chuỗi Promise không dứt | **Tuyệt vời (100%)**: Cho phép vòng lặp đi qua Pha \`Timers\` và \`Poll\` ở mỗi chu kỳ | **Có**: Nhường luồng qua các pha nhưng bị phạt độ trễ tối thiểu \`>= 1 ms\` |
| **Rủi ro vận hành trên Production** | Dễ gây **Event Loop Starvation** làm treo cứng máy chủ nếu đệ quy | Có thể làm trễ pha \`Poll\` nếu giải quyết hàng trăm nghìn Promise nối đuôi | Rất an toàn; là công cụ chuẩn để cắt nhỏ vòng lặp lớn trên Main Thread | Rò rỉ bộ nhớ \`Min-Heap\` nếu quên \`clearTimeout\` hoặc giữ treo tiến trình nếu thiếu \`.unref()\` |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`CooperativeBatchSchedulerService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề bất biến về Xả Cạn kiệt Microtasks (\`Microtask Exhaustion Invariant\`):** Kể từ Node.js 11+, ngay sau khi mỗi hàm callback đơn lẻ rút khỏi \`V8 Call Stack\`, runtime bắt buộc phải xả sạch 100% \`process.nextTickQueue\` rồi đến \`Promise Microtask Queue\` trước khi cho phép Libuv bước sang callback kế tiếp hoặc chuyển pha. Mọi vòng lặp đệ quy nằm trên hai hàng đợi này đều sẽ khóa chặt Event Loop và làm tê liệt hoàn toàn Pha \`Poll I/O\`.
2. **Định đề Tất định Hình học của Vòng lặp 6 Pha (\`Clockwise Phase Determinism Invariant\`):** Thứ tự 6 pha của Libuv (\`Timers\` $\rightarrow$ \`Pending\` $\rightarrow$ \`Idle/Prepare\` $\rightarrow$ \`Poll\` $\rightarrow$ \`Check\` $\rightarrow$ \`Close\`) là một chu trình một chiều bất biến. Do mọi callback của I/O mạng và tệp tin đều chạy tại **Pha 4 (\`Poll\`)**, nên bất kỳ lệnh \`setImmediate()\` nào được đăng ký bên trong I/O callback sẽ luôn luôn được thực thi tại **Pha 5 (\`Check\`)** trước khi vòng lặp kịp quay lại **Pha 1 (\`Timers\`)** để chạy \`setTimeout(fn, 0)\`.
3. **Định đề Độ phức tạp \`Min-Heap\` và Độ trễ Trôi Hẹn giờ (\`Timer Min-Heap & Drift Invariant\`):** Libuv quản lý các bộ hẹn giờ bằng cây nhị phân \`Min-Heap\` giúp kiểm tra thời điểm hết hạn gần nhất với chi phí \`O(1)\` và tính toán chính xác thời gian ngủ \`uv__backend_timeout\` cho Pha \`Poll\`. Tuy nhiên, tham số \`delay\` chỉ là ngưỡng chờ tối thiểu (\`Lower Bound\`); thời điểm chạy thực tế luôn bị cộng dồn thêm độ trễ của các tác vụ đồng bộ và Microtask đang chiếm giữ luồng chính (**Timer Drift**).
4. **Định đề Phân mảnh Hợp tác theo Ngân sách Thời gian (\`Time-Budgeted Cooperative Yielding Invariant\`):** Trên luồng chính V8, khi phải duyệt qua một tập dữ liệu lớn mà chưa cần đẩy sang \`Worker Threads\`, kỹ sư phải thiết lập ngân sách thời gian cho mỗi lô xử lý (thường **\`<= 2 ms\`** đến **\`5 ms\`**). Ngay khi chạm ngân sách thời gian của lô hiện tại, hàm phải chủ động gọi \`await new Promise(resolve => setImmediate(resolve))\` để nhường CPU cho Pha \`Poll\` phục vụ các yêu cầu HTTP đang chờ.
  `,
  realCodeSnippet: `// File: src/modules/platform/scheduler/cooperative-batch-scheduler.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Bộ Điều Phối Phân Mảnh Hợp Tác Theo Ngân Sách Thời Gian (Time-Sliced Yielding)
import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';

export interface BatchExecutionMetrics {
  readonly totalItems: number;
  readonly processedItems: number;
  readonly yieldCount: number;
  readonly totalElapsedMs: number;
  readonly maxSliceDurationMs: number;
}

/**
 * Dịch vụ Điều phối Lô dữ liệu lớn không chặn Event Loop (ADR-0024):
 * - Thay vì cắt theo số lượng phần tử cố định (dễ bị lệch nếu mỗi phần tử nặng nhẹ khác nhau),
 *   dịch vụ đo trực tiếp thời gian chiếm dụng V8 Call Stack bằng performance.now().
 * - Ngay khi một lát cắt (Slice) chạm ngưỡng timeBudgetMs (mặc định 2ms), luồng chính lập tức
 *   nhường quyền điều khiển về Pha Check (setImmediate) để Libuv xử lý Pha Poll I/O.
 */
@Injectable()
export class CooperativeBatchSchedulerService {
  private readonly logger = new Logger(CooperativeBatchSchedulerService.name);
  private readonly defaultTimeBudgetMs = 2.0;

  public async executeTimeSlicedBatch<T, R>(
    items: ReadonlyArray<T>,
    processor: (item: T, index: number) => R,
    timeBudgetMs: number = this.defaultTimeBudgetMs,
  ): Promise<{ results: R[]; metrics: BatchExecutionMetrics }> {
    if (!Array.isArray(items)) {
      throw new Error('INVALID_BATCH_ITEMS_ARRAY');
    }
    if (typeof timeBudgetMs !== 'number' || timeBudgetMs <= 0) {
      throw new Error('INVALID_TIME_BUDGET_MS');
    }

    const totalItems = items.length;
    const results: R[] = new Array<R>(totalItems);
    const startOverallMs = performance.now();

    let sliceStartMs = startOverallMs;
    let yieldCount = 0;
    let maxSliceDurationMs = 0;

    for (let i = 0; i < totalItems; i++) {
      results[i] = processor(items[i], i);

      const nowMs = performance.now();
      const currentSliceElapsedMs = nowMs - sliceStartMs;
      if (currentSliceElapsedMs > maxSliceDurationMs) {
        maxSliceDurationMs = currentSliceElapsedMs;
      }

      // Nếu lát cắt hiện tại đã tiêu thụ hết ngân sách thời gian và vẫn còn phần tử phía sau:
      // Chủ động nhường luồng về Pha Check (setImmediate) để chống Event Loop Starvation
      if (currentSliceElapsedMs >= timeBudgetMs && i < totalItems - 1) {
        yieldCount++;
        await new Promise<void>((resolve) => setImmediate(resolve));
        sliceStartMs = performance.now();
      }
    }

    const totalElapsedMs = Math.round((performance.now() - startOverallMs) * 100) / 100;
    const roundedMaxSliceMs = Math.round(maxSliceDurationMs * 100) / 100;

    this.logger.debug(
      \`Hoàn tất lô \${totalItems} mục với \${yieldCount} lần nhường Event Loop (Max Slice: \${roundedMaxSliceMs}ms)\`,
    );

    return {
      results,
      metrics: {
        totalItems,
        processedItems: totalItems,
        yieldCount,
        totalElapsedMs,
        maxSliceDurationMs: roundedMaxSliceMs,
      },
    };
  }
}`,
  quiz: [
    {
      id: 'c2-l1-q1',
      question: 'Hiện tượng Event Loop Starvation xảy ra khi nào và để lại hậu quả gì nghiêm trọng nhất cho máy chủ backend Node.js/NestJS?',
      options: [
        'Khi V8 Heap vượt quá ngưỡng max-old-space-size, buộc bộ thu gom rác Orinoco phải kích hoạt chu kỳ Full Mark-Sweep-Compact dừng toàn bộ luồng thực thi trong nhiều giây liên tục.',
        'Khi Microtask Queue (process.nextTick hoặc Promise) liên tục sinh thêm tác vụ đệ quy mới mà không cạn, khiến Event Loop bị kẹt giữa hai pha và không bao giờ vào pha Poll I/O.',
        'Khi Libuv Threadpool bị chiếm dụng toàn bộ 4 luồng bởi các tác vụ mã hóa crypto, khiến nhân hệ điều hành từ chối tiếp nhận thêm các gói tin TCP SYN trên cổng mạng của máy chủ.',
        'Khi số lượng kết nối đồng thời vượt quá giới hạn file descriptor của tiến trình, khiến nhân hệ điều hành tự động khóa luồng chính của Node.js sang chế độ chỉ đọc bộ nhớ.'
      ],
      correctIndex: 1,
      explanation: 'Event Loop Starvation xảy ra khi microtask queue (đặc biệt là process.nextTick đệ quy liên tục hoặc chuỗi Promise không điểm dừng) không bao giờ cạn rỗng. Do quy tắc bắt buộc phải xả cạn kiệt (drain completely) microtask trước khi chuyển pha, Event Loop bị giam cầm tại chỗ, không thể tiến vào pha Poll để nhận kết nối HTTP hay pha Timers, làm máy chủ hoàn toàn tê liệt.'
    },
    {
      id: 'c2-l1-q2',
      question: 'Khi đặt lệnh setTimeout(fn, 0) và setImmediate(fn) bên trong một callback I/O (ví dụ: fs.readFile), thứ tự thực thi chắc chắn sẽ là gì và tại sao?',
      options: [
        'Thứ tự thực thi là hoàn toàn bất định (non-deterministic), phụ thuộc trực tiếp vào độ trễ phân bổ xung nhịp CPU của bộ lập lịch hệ điều hành tại thời điểm luồng đọc xong tệp tin.',
        'setTimeout luôn chạy trước 100% vì các bộ hẹn giờ có độ ưu tiên cao nhất trong cấu trúc cây nhị phân Min-Heap của pha Timers ngay khi luồng công nhân I/O trả kết quả về.',
        'setImmediate luôn chạy trước setTimeout 100%, vì callback đọc tệp chạy tại pha Poll; ngay khi rời pha Poll theo chiều kim đồng hồ, vòng lặp bước thẳng vào pha Check trước pha Timers.',
        'Cả hai callback được nạp đồng thời vào hai luồng Worker Thread khác nhau của Libuv Threadpool nên hàm nào được nhân hệ điều hành cấp phát lõi vi xử lý trước sẽ in ra trước.'
      ],
      correctIndex: 2,
      explanation: 'Khi fs.readFile hoàn thành, callback của nó được thực thi ngay trong pha Poll (Pha 4). Khi rời khỏi pha Poll theo chiều quay cố định của Event Loop, pha kế tiếp ngay lập tức là pha Check (Pha 5 — nơi xử lý setImmediate). Ngược lại, callback của setTimeout(fn, 0) nằm ở pha Timers (Pha 1), bắt buộc phải đợi Event Loop đi hết vòng lặp hiện tại mới được gọi tới.'
    },
    {
      id: 'c2-l1-q3',
      question: 'Điểm khác biệt cốt lõi về cơ chế điều phối giữa process.nextTick() và Promise.resolve().then() trong runtime của Node.js là gì?',
      options: [
        'Node.js duy trì hai hàng đợi microtask tách biệt: process.nextTickQueue có độ ưu tiên tối thượng và luôn được xả sạch hoàn toàn trước khi V8 bắt đầu xả Promise microtask queue.',
        'Promise.then được quản lý bởi V8 Microtask Queue, trong khi process.nextTick được đẩy xuống pha Timers của thư viện C++ Libuv dưới dạng một macrotask đặc biệt có độ trễ bằng 0ms.',
        'Cả hai sử dụng chung một hàng đợi FIFO duy nhất bên trong V8 Engine; hàm nào được lập trình viên đăng ký trước trong mã nguồn thực thi JavaScript sẽ được lấy ra thực thi trước.',
        'Promise.then chạy trên luồng chính của V8 Engine, còn process.nextTick được gửi trực tiếp xuống hàng đợi ngắt phần cứng (Interrupt Queue) của nhân hệ điều hành qua C++ bindings.'
      ],
      correctIndex: 0,
      explanation: 'Trong kiến trúc của Node.js, process.nextTickQueue được quản lý riêng ở tầng C++ binding của Node và có độ ưu tiên cao hơn Promise reaction microtask queue của V8. Tại mỗi Microtask Checkpoint khi Call Stack vừa trống, Node.js luôn xả sạch toàn bộ các callback trong nextTickQueue trước, sau đó mới chuyển sang xả các Promise microtask.'
    },
    {
      id: 'c2-l1-q4',
      question: 'Để xử lý một mảng dữ liệu lớn bằng thuật toán tính toán trên luồng chính trong NestJS mà không làm tê liệt khả năng tiếp nhận HTTP request của Event Loop, giải pháp nào sau đây là chuẩn xác?',
      options: [
        'Bọc toàn bộ vòng lặp tính toán bên trong một hàm khởi tạo new Promise(resolve => ...) và gọi bằng từ khóa await để tự động biến vòng lặp thành tác vụ bất đồng bộ phi chặn trên nền.',
        'Đệ quy qua từng phần tử bằng process.nextTick() để V8 Engine tự động chia nhỏ tác vụ và xen kẽ việc đọc các gói tin HTTP mới từ card mạng vật lý giữa mỗi lần gọi đệ quy.',
        'Sử dụng vòng lặp for đồng bộ kết hợp với khối lệnh try/catch để nhân hệ điều hành tự động tạm dừng luồng chính và giải phóng Call Stack mỗi khi phát hiện độ trễ vượt quá 10ms.',
        'Chia nhỏ mảng dữ liệu thành từng lô (chunking) theo ngân sách thời gian và dùng setImmediate() giữa các lô, giúp Event Loop đi qua pha Poll xử lý I/O mạng trước khi tính tiếp.'
      ],
      correctIndex: 3,
      explanation: 'Bọc vòng lặp đồng bộ trong Promise hay đệ quy bằng process.nextTick đều giữ chặt luồng chính ở Call Stack hoặc Microtask Checkpoint, khiến Libuv không thể tiến vào pha Poll. Kỹ thuật chuẩn là cắt nhỏ thành từng lô ngắn (~1-2ms) và nhường luồng bằng setImmediate(), cho phép Event Loop đi qua pha Timers và pha Poll để phục vụ các HTTP request mới rồi mới quay lại pha Check chạy lô kế tiếp.'
    },
    {
      id: 'c2-l1-q5',
      question: 'Cấu trúc dữ liệu nào được Libuv sử dụng để quản lý các bộ hẹn giờ (setTimeout, setInterval) trong Pha Timers nhằm đạt hiệu năng kiểm tra tối ưu khi có hàng chục nghìn timers?',
      options: [
        'Một danh sách liên kết đơn (Singly Linked List) được duyệt tuần tự từ đầu đến cuối mỗi khi có tín hiệu ngắt đồng hồ phần cứng từ nhân hệ điều hành gửi lên cho không gian người dùng.',
        'Cây nhị phân Min-Heap sắp xếp theo thời điểm hết hạn (expiry), cho phép kiểm tra bộ hẹn giờ cần kích hoạt sớm nhất ở nút gốc với độ phức tạp O(1) và chèn/xóa trong O(log N).',
        'Bảng băm phân tán (Distributed Hash Table) lưu trữ địa chỉ con trỏ của mọi hàm callback hẹn giờ trực tiếp trên phân vùng Large Object Space của bộ nhớ đối tượng V8 Heap.',
        'Hàng đợi vòng tròn (Circular Ring Buffer) có kích thước cố định 1024 phần tử được cấp phát tĩnh ngay trên khung ngăn xếp Call Stack của luồng chính khi tiến trình khởi động.'
      ],
      correctIndex: 1,
      explanation: 'Libuv lưu trữ toàn bộ các bộ hẹn giờ trong cấu trúc cây nhị phân Min-Heap khóa theo thời điểm hết hạn (expiry). Nút gốc của heap luôn là timer hết hạn sớm nhất. Khi vào pha Timers, Libuv chỉ cần so sánh thời gian hiện tại của vòng lặp với nút gốc trong O(1); nếu nút gốc chưa tới hạn thì toàn bộ cây chắc chắn chưa tới hạn, giúp tiết kiệm tối đa chu kỳ CPU.'
    },
    {
      id: 'c2-l1-q6',
      question: 'Quy tắc xả Microtask Queue trong Node.js kể từ phiên bản 11 trở đi có sự thay đổi mang tính bước ngoặt nào so với các phiên bản Node.js 10 trở về trước?',
      options: [
        'Microtasks chỉ được xả một lần duy nhất tại điểm kết thúc của toàn bộ một vòng lặp Event Loop sau khi đã hoàn thành xong toàn bộ các callback trong pha thứ 6 (Close Callbacks).',
        'Node.js gom nhóm toàn bộ các Microtasks phát sinh trong một pha lại thành một lô duy nhất và đẩy sang thực thi song song trên 4 luồng C++ của Libuv Worker Threadpool.',
        'Ngay sau khi mỗi callback đơn lẻ của bất kỳ pha nào trong Event Loop kết thúc, runtime lập tức xả sạch Microtask Queue trước khi chạy callback tiếp theo trong cùng pha đó.',
        'Microtasks bị giới hạn định mức tối đa 1024 tác vụ mỗi vòng Tick; các tác vụ vượt ngưỡng sẽ tự động bị chuyển xuống hàng đợi của pha Check ở vòng lặp sự kiện kế tiếp.'
      ],
      correctIndex: 2,
      explanation: 'Trước Node 11, Node.js chỉ xả Microtasks khi toàn bộ một pha của Event Loop (ví dụ chạy xong tất cả các timer hết hạn trong pha Timers) kết thúc. Kể từ Node 11 trở đi, để đồng bộ hoàn toàn với chuẩn HTML5 trên trình duyệt, Node.js xả sạch Microtasks (nextTick rồi tới Promise) ngay sau khi mỗi callback đơn lẻ kết thúc.'
    },
    {
      id: 'c2-l1-q7',
      question: 'Khi tiến vào Pha 4 (Poll), hàm uv__backend_timeout(loop) của Libuv sẽ tính toán thời gian ngủ chờ I/O (timeout) như thế nào nếu phát hiện đang có tác vụ setImmediate() chờ sẵn trong Pha 5 (Check)?',
      options: [
        'Hàm trả về timeout = 0, buộc pha Poll không được ngủ chờ gói tin mạng mới mà chỉ thu hoạch nhanh các sự kiện đã sẵn sàng rồi chuyển ngay sang pha Check để chạy setImmediate().',
        'Hàm trả về timeout = 1000ms để cưỡng chế luồng chính ưu tiên ngủ chờ các gói tin HTTP mới trên card mạng trước khi cho phép thực thi các tác vụ nền đang đợi trong pha Check.',
        'Hàm hủy bỏ toàn bộ các callback trong pha Check và cho phép vòng lặp sự kiện quay ngược trực tiếp từ pha Poll về lại pha Timers để kiểm tra cấu trúc cây nhị phân Min-Heap.',
        'Hàm tự động di chuyển các callback của setImmediate() từ hàng đợi pha Check lên hàng đợi process.nextTickQueue để ép V8 Engine thực thi khẩn cấp ngay tại ranh giới pha.'
      ],
      correctIndex: 0,
      explanation: 'Trong thuật toán uv__backend_timeout của Libuv, nếu phát hiện hàng đợi của pha Check (setImmediate) hoặc pha Pending/Close không rỗng, hàm sẽ lập tức trả về thời gian chờ bằng 0. Nhờ đó, pha Poll sẽ không chặn luồng (non-blocking poll) mà chuyển tiếp ngay sang pha Check để thực thi các callback của setImmediate().'
    },
    {
      id: 'c2-l1-q8',
      question: 'Trong kiến trúc NestJS, tại sao các bộ hẹn giờ chạy ngầm định kỳ (như setInterval dọn dẹp bộ đệm nội bộ) nên được gọi kèm phương thức .unref()?',
      options: [
        'Để chuyển bộ hẹn giờ đó từ cây nhị phân Min-Heap của luồng chính sang chạy hoàn toàn độc lập trên một luồng riêng biệt của hệ điều hành Linux mà không tiêu tốn CPU chính.',
        'Để báo cho Libuv không tính timer này vào bộ đếm active_handles, giúp tiến trình Node.js có thể tự động thoát an toàn khi máy chủ HTTP đóng lại trong quá trình Graceful Shutdown.',
        'Để ngăn không cho bộ thu gom rác Orinoco Garbage Collector xóa nhầm hàm callback của bộ hẹn giờ khi dung lượng phân vùng Old Generation trên V8 Heap vượt quá ngưỡng 80%.',
        'Để ép bộ hẹn giờ đó có độ ưu tiên thực thi cao hơn cả process.nextTick() và luôn chạy chính xác tuyệt đối đến từng micro-giây mà không bị ảnh hưởng bởi hiện tượng Timer Drift.'
      ],
      correctIndex: 1,
      explanation: 'Vòng lặp Libuv chỉ kết thúc khi không còn bất kỳ active_handles nào đang hoạt động. Một lệnh setInterval mặc định sẽ giữ active_handles >= 1 vĩnh viễn, khiến tiến trình không thể tự thoát khi Graceful Shutdown. Gọi .unref() giúp tháo handle đó khỏi điều kiện giữ sống vòng lặp mà vẫn cho phép nó chạy bình thường khi các tài nguyên khác (như HTTP Server) còn thức.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Độ Trễ Bỏ Đói I/O & Thời Gian Chờ Pha Poll (Event Loop Tick & Poll Timeout Calculator)',
    description: 'Áp dụng công thức định lượng vòng lặp Libuv ở Phần 1 và Phần 2. Viết hàm `calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate)` nhận vào:\n- `syncExecutionMs`: Thời gian chạy mã đồng bộ trên V8 Call Stack (ms).\n- `nextTickCount`: Tổng số tác vụ trong `process.nextTickQueue`.\n- `promiseCount`: Tổng số tác vụ trong `Promise Microtask Queue`.\n- `avgMicrotaskMs`: Thời gian thực thi trung bình của 1 microtask (ms).\n- `nearestTimerExpiryMs`: Thời gian còn lại của bộ hẹn giờ sớm nhất trên đỉnh `Min-Heap` tính từ lúc vào pha Poll (ms, truyền `-1` nếu không có timer nào).\n- `hasSetImmediate`: Cờ boolean cho biết có tác vụ `setImmediate` đang chờ ở pha Check hay không.\n\nYêu cầu tính toán:\n1. Tổng thời gian xả sạch hai hàng đợi Microtask: `microtaskDrainMs = (nextTickCount + promiseCount) * avgMicrotaskMs` (làm tròn 2 chữ số thập phân).\n2. Tổng thời gian pha Poll bị trì hoãn trước khi được nhận I/O: `ioStarvationDelayMs = syncExecutionMs + microtaskDrainMs` (làm tròn 2 chữ số thập phân).\n3. Thời gian ngủ tối đa tại pha Poll (`pollBlockTimeoutMs`) theo thuật toán `uv__backend_timeout`:\n   - Nếu `hasSetImmediate === true`: `pollBlockTimeoutMs = 0`.\n   - Ngược lại, nếu `nearestTimerExpiryMs < 0`: `pollBlockTimeoutMs = -1` (ngủ vô hạn chờ sự kiện mạng).\n   - Ngược lại: `pollBlockTimeoutMs = Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100)`.\n4. Phân loại trạng thái `status`: Nếu `ioStarvationDelayMs >= 100` thì `"STARVATION_CRITICAL"`, nếu `ioStarvationDelayMs >= 20` thì `"HIGH_DELAY_WARNING"`, ngược lại `"HEALTHY_LOOP"`.\nTrả về `{ microtaskDrainMs, ioStarvationDelayMs, pollBlockTimeoutMs, status }`.',
    guidedSteps: [
      'Bước 1 (Tính thời gian xả Microtask): Tính `microtaskDrainMs = Math.round(((nextTickCount + promiseCount) * avgMicrotaskMs) * 100) / 100`.',
      'Bước 2 (Tính tổng độ trễ bỏ đói I/O): Tính `ioStarvationDelayMs = Math.round((syncExecutionMs + microtaskDrainMs) * 100) / 100`.',
      'Bước 3 (Tính thời gian ngủ ở pha Poll): Nếu `hasSetImmediate` là `true` thì `pollBlockTimeoutMs = 0`; ngược lại nếu `nearestTimerExpiryMs < 0` thì `-1`; ngược lại `Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100)`.',
      'Bước 4 (Phân loại trạng thái và trả về kết quả): So sánh `ioStarvationDelayMs` với các ngưỡng `100` và `20` để gán `status` rồi trả về object `{ microtaskDrainMs, ioStarvationDelayMs, pollBlockTimeoutMs, status }`.'
    ],
    hints: [
      'Khi `hasSetImmediate === true`, Libuv bắt buộc phải trả về `pollBlockTimeoutMs = 0` bất chấp `nearestTimerExpiryMs` bằng bao nhiêu để chuyển ngay từ pha Poll sang pha Check.',
      'Sử dụng `Math.round(val * 100) / 100` để làm tròn chính xác đến 2 chữ số thập phân.'
    ],
    starterCode: `function calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate) {
  // Bước 1: Tính microtaskDrainMs = (nextTickCount + promiseCount) * avgMicrotaskMs (làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính ioStarvationDelayMs = syncExecutionMs + microtaskDrainMs (làm tròn 2 chữ số thập phân)
  
  // Bước 3: Xác định pollBlockTimeoutMs theo quy tắc uv__backend_timeout của Libuv
  
  // Bước 4: Phân loại status ("STARVATION_CRITICAL" | "HIGH_DELAY_WARNING" | "HEALTHY_LOOP") và trả về kết quả
}`,
    solution: `function calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate) {
  const microtaskDrainMs = Math.round(((nextTickCount + promiseCount) * avgMicrotaskMs) * 100) / 100;
  const ioStarvationDelayMs = Math.round((syncExecutionMs + microtaskDrainMs) * 100) / 100;

  let pollBlockTimeoutMs = -1;
  if (hasSetImmediate === true) {
    pollBlockTimeoutMs = 0;
  } else if (nearestTimerExpiryMs < 0) {
    pollBlockTimeoutMs = -1;
  } else {
    pollBlockTimeoutMs = Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100);
  }

  let status = 'HEALTHY_LOOP';
  if (ioStarvationDelayMs >= 100) {
    status = 'STARVATION_CRITICAL';
  } else if (ioStarvationDelayMs >= 20) {
    status = 'HIGH_DELAY_WARNING';
  }

  return {
    microtaskDrainMs,
    ioStarvationDelayMs,
    pollBlockTimeoutMs,
    status
  };
}`,
    testCases: [
      {
        name: 'Vòng lặp khỏe mạnh, có timer hết hạn sau 15ms và không có setImmediate -> HEALTHY_LOOP',
        input: [1.5, 10, 20, 0.05, 15, false],
        expected: {
          microtaskDrainMs: 1.5,
          ioStarvationDelayMs: 3,
          pollBlockTimeoutMs: 15,
          status: 'HEALTHY_LOOP'
        },
        hidden: false
      },
      {
        name: 'Có setImmediate đang chờ ở pha Check -> pollBlockTimeoutMs lập tức bằng 0',
        input: [8, 400, 600, 0.02, 50, true],
        expected: {
          microtaskDrainMs: 20,
          ioStarvationDelayMs: 28,
          pollBlockTimeoutMs: 0,
          status: 'HIGH_DELAY_WARNING'
        },
        hidden: false
      },
      {
        name: 'Bão đệ quy Microtask làm trễ pha Poll trên 100ms -> STARVATION_CRITICAL',
        input: [5, 50000, 10000, 0.002, -1, false],
        expected: {
          microtaskDrainMs: 120,
          ioStarvationDelayMs: 125,
          pollBlockTimeoutMs: -1,
          status: 'STARVATION_CRITICAL'
        },
        hidden: false
      },
      {
        name: 'Test biên ẩn: Không có timer (nearestTimerExpiryMs = -1) và không có setImmediate -> pollBlockTimeoutMs = -1',
        input: [0.5, 0, 0, 0.01, -1, false],
        expected: {
          microtaskDrainMs: 0,
          ioStarvationDelayMs: 0.5,
          pollBlockTimeoutMs: -1,
          status: 'HEALTHY_LOOP'
        },
        hidden: true
      },
      {
        name: 'Test làm tròn số thực ẩn: Chạm đúng ngưỡng 20ms -> HIGH_DELAY_WARNING',
        input: [6.67, 100, 100, 0.06665, 12.345, false],
        expected: {
          microtaskDrainMs: 13.33,
          ioStarvationDelayMs: 20,
          pollBlockTimeoutMs: 12.35,
          status: 'HIGH_DELAY_WARNING'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Độ Trễ Bỏ Đói I/O & Thời Gian Chờ Pha Poll (Event Loop Tick & Poll Timeout Calculator)',
      description: 'Áp dụng công thức định lượng vòng lặp Libuv ở Phần 1 và Phần 2. Viết hàm `calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate)` nhận vào:\n- `syncExecutionMs`: Thời gian chạy mã đồng bộ trên V8 Call Stack (ms).\n- `nextTickCount`: Tổng số tác vụ trong `process.nextTickQueue`.\n- `promiseCount`: Tổng số tác vụ trong `Promise Microtask Queue`.\n- `avgMicrotaskMs`: Thời gian thực thi trung bình của 1 microtask (ms).\n- `nearestTimerExpiryMs`: Thời gian còn lại của bộ hẹn giờ sớm nhất trên đỉnh `Min-Heap` tính từ lúc vào pha Poll (ms, truyền `-1` nếu không có timer nào).\n- `hasSetImmediate`: Cờ boolean cho biết có tác vụ `setImmediate` đang chờ ở pha Check hay không.\n\nYêu cầu tính toán:\n1. Tổng thời gian xả sạch hai hàng đợi Microtask: `microtaskDrainMs = (nextTickCount + promiseCount) * avgMicrotaskMs` (làm tròn 2 chữ số thập phân).\n2. Tổng thời gian pha Poll bị trì hoãn trước khi được nhận I/O: `ioStarvationDelayMs = syncExecutionMs + microtaskDrainMs` (làm tròn 2 chữ số thập phân).\n3. Thời gian ngủ tối đa tại pha Poll (`pollBlockTimeoutMs`) theo thuật toán `uv__backend_timeout`:\n   - Nếu `hasSetImmediate === true`: `pollBlockTimeoutMs = 0`.\n   - Ngược lại, nếu `nearestTimerExpiryMs < 0`: `pollBlockTimeoutMs = -1` (ngủ vô hạn chờ sự kiện mạng).\n   - Ngược lại: `pollBlockTimeoutMs = Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100)`.\n4. Phân loại trạng thái `status`: Nếu `ioStarvationDelayMs >= 100` thì `"STARVATION_CRITICAL"`, nếu `ioStarvationDelayMs >= 20` thì `"HIGH_DELAY_WARNING"`, ngược lại `"HEALTHY_LOOP"`.\nTrả về `{ microtaskDrainMs, ioStarvationDelayMs, pollBlockTimeoutMs, status }`.',
      guidedSteps: [
        'Bước 1 (Tính thời gian xả Microtask): Tính `microtaskDrainMs = Math.round(((nextTickCount + promiseCount) * avgMicrotaskMs) * 100) / 100`.',
        'Bước 2 (Tính tổng độ trễ bỏ đói I/O): Tính `ioStarvationDelayMs = Math.round((syncExecutionMs + microtaskDrainMs) * 100) / 100`.',
        'Bước 3 (Tính thời gian ngủ ở pha Poll): Nếu `hasSetImmediate` là `true` thì `pollBlockTimeoutMs = 0`; ngược lại nếu `nearestTimerExpiryMs < 0` thì `-1`; ngược lại `Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100)`.',
        'Bước 4 (Phân loại trạng thái và trả về kết quả): So sánh `ioStarvationDelayMs` với các ngưỡng `100` và `20` để gán `status` rồi trả về object `{ microtaskDrainMs, ioStarvationDelayMs, pollBlockTimeoutMs, status }`.'
      ],
      hints: [
        'Khi `hasSetImmediate === true`, Libuv bắt buộc phải trả về `pollBlockTimeoutMs = 0` bất chấp `nearestTimerExpiryMs` bằng bao nhiêu để chuyển ngay từ pha Poll sang pha Check.',
        'Sử dụng `Math.round(val * 100) / 100` để làm tròn chính xác đến 2 chữ số thập phân.'
      ],
      starterCode: `function calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate) {
  // Bước 1: Tính microtaskDrainMs = (nextTickCount + promiseCount) * avgMicrotaskMs (làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính ioStarvationDelayMs = syncExecutionMs + microtaskDrainMs (làm tròn 2 chữ số thập phân)
  
  // Bước 3: Xác định pollBlockTimeoutMs theo quy tắc uv__backend_timeout của Libuv
  
  // Bước 4: Phân loại status ("STARVATION_CRITICAL" | "HIGH_DELAY_WARNING" | "HEALTHY_LOOP") và trả về kết quả
}`,
      solution: `function calculateTickAndPollMetrics(syncExecutionMs, nextTickCount, promiseCount, avgMicrotaskMs, nearestTimerExpiryMs, hasSetImmediate) {
  const microtaskDrainMs = Math.round(((nextTickCount + promiseCount) * avgMicrotaskMs) * 100) / 100;
  const ioStarvationDelayMs = Math.round((syncExecutionMs + microtaskDrainMs) * 100) / 100;

  let pollBlockTimeoutMs = -1;
  if (hasSetImmediate === true) {
    pollBlockTimeoutMs = 0;
  } else if (nearestTimerExpiryMs < 0) {
    pollBlockTimeoutMs = -1;
  } else {
    pollBlockTimeoutMs = Math.max(0, Math.round(nearestTimerExpiryMs * 100) / 100);
  }

  let status = 'HEALTHY_LOOP';
  if (ioStarvationDelayMs >= 100) {
    status = 'STARVATION_CRITICAL';
  } else if (ioStarvationDelayMs >= 20) {
    status = 'HIGH_DELAY_WARNING';
  }

  return {
    microtaskDrainMs,
    ioStarvationDelayMs,
    pollBlockTimeoutMs,
    status
  };
}`,
      testCases: [
        {
          name: 'Vòng lặp khỏe mạnh, có timer hết hạn sau 15ms và không có setImmediate -> HEALTHY_LOOP',
          input: [1.5, 10, 20, 0.05, 15, false],
          expected: {
            microtaskDrainMs: 1.5,
            ioStarvationDelayMs: 3,
            pollBlockTimeoutMs: 15,
            status: 'HEALTHY_LOOP'
          },
          hidden: false
        },
        {
          name: 'Có setImmediate đang chờ ở pha Check -> pollBlockTimeoutMs lập tức bằng 0',
          input: [8, 400, 600, 0.02, 50, true],
          expected: {
            microtaskDrainMs: 20,
            ioStarvationDelayMs: 28,
            pollBlockTimeoutMs: 0,
            status: 'HIGH_DELAY_WARNING'
          },
          hidden: false
        },
        {
          name: 'Bão đệ quy Microtask làm trễ pha Poll trên 100ms -> STARVATION_CRITICAL',
          input: [5, 50000, 10000, 0.002, -1, false],
          expected: {
            microtaskDrainMs: 120,
            ioStarvationDelayMs: 125,
            pollBlockTimeoutMs: -1,
            status: 'STARVATION_CRITICAL'
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Không có timer (nearestTimerExpiryMs = -1) và không có setImmediate -> pollBlockTimeoutMs = -1',
          input: [0.5, 0, 0, 0.01, -1, false],
          expected: {
            microtaskDrainMs: 0,
            ioStarvationDelayMs: 0.5,
            pollBlockTimeoutMs: -1,
            status: 'HEALTHY_LOOP'
          },
          hidden: true
        },
        {
          name: 'Test làm tròn số thực ẩn: Chạm đúng ngưỡng 20ms -> HIGH_DELAY_WARNING',
          input: [6.67, 100, 100, 0.06665, 12.345, false],
          expected: {
            microtaskDrainMs: 13.33,
            ioStarvationDelayMs: 20,
            pollBlockTimeoutMs: 12.35,
            status: 'HIGH_DELAY_WARNING'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Trình Điều Phối Hàng Đợi Đa Tầng V8 & Libuv (Multi-Queue Event Loop Simulator)',
      description: 'Mô phỏng chính xác thứ tự xả hàng đợi chuẩn Node.js 11+ khi các tác vụ được đăng ký từ bên trong một I/O Callback (tại Pha 4 - Poll). Viết hàm `simulateIoCallbackQueueDrain(tasks, currentClockMs)` nhận vào danh sách `tasks` gồm các đối tượng `{ id: string, queueType: "SYNC" | "NEXT_TICK" | "PROMISE" | "IMMEDIATE" | "TIMEOUT", delayMs?: number, durationMs: number }` và mốc đồng hồ hiện tại `currentClockMs` (ms).\n\nQuy tắc sắp xếp thứ tự thực thi khi xuất phát từ bên trong I/O Callback (Pha 4 - Poll):\n1. **Cấp ưu tiên 1 (`"SYNC"`)**: Chạy ngay trên V8 Call Stack theo đúng thứ tự xuất hiện ban đầu.\n2. **Cấp ưu tiên 2 (`"NEXT_TICK"`)**: Xả toàn bộ `process.nextTickQueue` theo thứ tự xuất hiện ban đầu.\n3. **Cấp ưu tiên 3 (`"PROMISE"`)**: Xả toàn bộ `Promise Microtask Queue` theo thứ tự xuất hiện ban đầu.\n4. **Cấp ưu tiên 4 (`"IMMEDIATE"`)**: Rời pha Poll bước thẳng sang Pha 5 (`Check`), chạy toàn bộ `setImmediate` theo thứ tự xuất hiện ban đầu.\n5. **Cấp ưu tiên 5 (`"TIMEOUT"`)**: Quay về Pha 1 (`Timers`) của vòng Tick kế tiếp. Các tác vụ `TIMEOUT` được sắp xếp tăng dần theo ngưỡng trễ thực tế `effectiveDelay = Math.max(1, task.delayMs || 0)` (vì Node.js luôn ép delay tối thiểu 1ms); nếu hai timer có cùng `effectiveDelay`, giữ nguyên thứ tự xuất hiện ban đầu.\n\nTính toán:\n- `executionOrder`: Mảng chứa `id` của các tác vụ theo đúng thứ tự được thực thi.\n- `totalBlockingBeforeIoExitMs`: Tổng `durationMs` của các tác vụ `"SYNC"`, `"NEXT_TICK"` và `"PROMISE"` (vì chúng chạy trước khi Libuv có thể rời khỏi ranh giới callback của pha Poll, làm tròn 2 chữ số thập phân).\n- `finalClockMs`: Đồng hồ sau khi chạy xong toàn bộ `tasks`, tính bằng `currentClockMs + sum(all durationMs)` (làm tròn 2 chữ số thập phân).\nTrả về `{ executionOrder, totalBlockingBeforeIoExitMs, finalClockMs }`.',
      guidedSteps: [
        'Bước 1 (Gắn chỉ mục gốc và phân nhóm ưu tiên): Duyệt mảng `tasks`, lưu lại chỉ số xuất hiện ban đầu `originalIndex` và gán trọng số ưu tiên hạng: `SYNC = 1`, `NEXT_TICK = 2`, `PROMISE = 3`, `IMMEDIATE = 4`, `TIMEOUT = 5`.',
        'Bước 2 (Sắp xếp theo quy tắc Event Loop): Sắp xếp các tác vụ theo trọng số hạng tăng dần. Nếu cả hai cùng là `TIMEOUT`, so sánh `Math.max(1, a.delayMs || 0) - Math.max(1, b.delayMs || 0)`. Nếu vẫn bằng nhau (hoặc cùng thuộc các hạng 1..4), so sánh `a.originalIndex - b.originalIndex`.',
        'Bước 3 (Trích xuất executionOrder và tính thời gian chặn): Tạo mảng `executionOrder = sorted.map(t => t.id)`. Cộng tổng `durationMs` của các tác vụ có `queueType` thuộc `["SYNC", "NEXT_TICK", "PROMISE"]` để được `totalBlockingBeforeIoExitMs`.',
        'Bước 4 (Tính finalClockMs và trả về): Cộng tổng `durationMs` của toàn bộ `tasks` vào `currentClockMs`, làm tròn 2 chữ số thập phân và trả về `{ executionOrder, totalBlockingBeforeIoExitMs, finalClockMs }`.'
      ],
      hints: [
        'Đừng quên quy tắc ép ngưỡng tối thiểu của Node.js: `delayMs = 0` và `delayMs = 1` đều có cùng `effectiveDelay = Math.max(1, delayMs) = 1`, nên timer nào đăng ký trước sẽ chạy trước!',
        'Chỉ những tác vụ `SYNC`, `NEXT_TICK` và `PROMISE` mới giữ chân luồng thực thi ngay tại ranh giới của Pha Poll (`totalBlockingBeforeIoExitMs`).'
      ],
      starterCode: `function simulateIoCallbackQueueDrain(tasks, currentClockMs) {
  // Bước 1: Gắn originalIndex và xác định hạng ưu tiên (SYNC=1, NEXT_TICK=2, PROMISE=3, IMMEDIATE=4, TIMEOUT=5)
  
  // Bước 2: Sắp xếp danh sách tác vụ theo hạng ưu tiên, effectiveDelay (cho TIMEOUT) và originalIndex
  
  // Bước 3: Tạo mảng executionOrder và tính totalBlockingBeforeIoExitMs
  
  // Bước 4: Tính finalClockMs và trả về { executionOrder, totalBlockingBeforeIoExitMs, finalClockMs }
}`,
      solution: `function simulateIoCallbackQueueDrain(tasks, currentClockMs) {
  const rankMap = {
    SYNC: 1,
    NEXT_TICK: 2,
    PROMISE: 3,
    IMMEDIATE: 4,
    TIMEOUT: 5
  };

  const indexed = tasks.map((task, idx) => ({
    ...task,
    originalIndex: idx,
    rank: rankMap[task.queueType] || 99,
    effectiveDelay: task.queueType === 'TIMEOUT' ? Math.max(1, task.delayMs || 0) : 0
  }));

  indexed.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    if (a.queueType === 'TIMEOUT' && a.effectiveDelay !== b.effectiveDelay) {
      return a.effectiveDelay - b.effectiveDelay;
    }
    return a.originalIndex - b.originalIndex;
  });

  const executionOrder = indexed.map((t) => t.id);

  let blockingSum = 0;
  let totalDuration = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    totalDuration += t.durationMs;
    if (t.queueType === 'SYNC' || t.queueType === 'NEXT_TICK' || t.queueType === 'PROMISE') {
      blockingSum += t.durationMs;
    }
  }

  const totalBlockingBeforeIoExitMs = Math.round(blockingSum * 100) / 100;
  const finalClockMs = Math.round((currentClockMs + totalDuration) * 100) / 100;

  return {
    executionOrder,
    totalBlockingBeforeIoExitMs,
    finalClockMs
  };
}`,
      testCases: [
        {
          name: 'Đầy đủ 5 loại hàng đợi bên trong I/O Callback: SYNC -> NEXT_TICK -> PROMISE -> IMMEDIATE -> TIMEOUT',
          input: [
            [
              { id: 'T_TIMEOUT_0', queueType: 'TIMEOUT', delayMs: 0, durationMs: 1.2 },
              { id: 'T_IMMEDIATE', queueType: 'IMMEDIATE', durationMs: 0.8 },
              { id: 'T_PROMISE', queueType: 'PROMISE', durationMs: 0.5 },
              { id: 'T_NEXT_TICK', queueType: 'NEXT_TICK', durationMs: 0.3 },
              { id: 'T_SYNC', queueType: 'SYNC', durationMs: 1.0 }
            ],
            100
          ],
          expected: {
            executionOrder: ['T_SYNC', 'T_NEXT_TICK', 'T_PROMISE', 'T_IMMEDIATE', 'T_TIMEOUT_0'],
            totalBlockingBeforeIoExitMs: 1.8,
            finalClockMs: 103.8
          },
          hidden: false
        },
        {
          name: 'Sắp xếp Min-Heap cho nhiều TIMEOUT và giữ nguyên thứ tự khi delayMs=0 bị ép bằng delayMs=1',
          input: [
            [
              { id: 'TIMER_10MS', queueType: 'TIMEOUT', delayMs: 10, durationMs: 1 },
              { id: 'TIMER_0MS', queueType: 'TIMEOUT', delayMs: 0, durationMs: 1 },
              { id: 'TIMER_1MS', queueType: 'TIMEOUT', delayMs: 1, durationMs: 1 },
              { id: 'IMM_1', queueType: 'IMMEDIATE', durationMs: 2 }
            ],
            0
          ],
          expected: {
            executionOrder: ['IMM_1', 'TIMER_0MS', 'TIMER_1MS', 'TIMER_10MS'],
            totalBlockingBeforeIoExitMs: 0,
            finalClockMs: 5
          },
          hidden: false
        },
        {
          name: 'Xen kẽ nhiều NEXT_TICK và PROMISE -> Toàn bộ NEXT_TICK luôn xả hết trước PROMISE',
          input: [
            [
              { id: 'P1', queueType: 'PROMISE', durationMs: 0.4 },
              { id: 'NT1', queueType: 'NEXT_TICK', durationMs: 0.2 },
              { id: 'P2', queueType: 'PROMISE', durationMs: 0.6 },
              { id: 'NT2', queueType: 'NEXT_TICK', durationMs: 0.3 }
            ],
            50
          ],
          expected: {
            executionOrder: ['NT1', 'NT2', 'P1', 'P2'],
            totalBlockingBeforeIoExitMs: 1.5,
            finalClockMs: 51.5
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Danh sách tác vụ rỗng',
          input: [[], 250.5],
          expected: {
            executionOrder: [],
            totalBlockingBeforeIoExitMs: 0,
            finalClockMs: 250.5
          },
          hidden: true
        },
        {
          name: 'Test ẩn: Độ chính xác số thực thập phân với nhiều tầng tác vụ',
          input: [
            [
              { id: 'S1', queueType: 'SYNC', durationMs: 0.33 },
              { id: 'NT1', queueType: 'NEXT_TICK', durationMs: 0.67 },
              { id: 'IM1', queueType: 'IMMEDIATE', durationMs: 1.15 }
            ],
            10.1
          ],
          expected: {
            executionOrder: ['S1', 'NT1', 'IM1'],
            totalBlockingBeforeIoExitMs: 1,
            finalClockMs: 12.25
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Bộ Lập Lịch Phân Mảnh Hợp Tác Theo Ngân Sách Thời Gian (Time-Budgeted Cooperative Chunk Scheduler)',
      description: 'Hiện thực hóa thuật toán trong `CooperativeBatchSchedulerService` (từ `realCodeSnippet`) để chia nhỏ lô dữ liệu lớn bằng `setImmediate` nhằm bảo vệ độ trễ Pha Poll I/O. Viết hàm `planCooperativeTimeSlices(itemCostsMs, maxSliceBudgetMs, incomingHttpWaitMs)` nhận vào:\n- `itemCostsMs`: Mảng số thực chứa thời gian xử lý CPU (ms) của từng phần tử thứ `i`.\n- `maxSliceBudgetMs`: Ngân sách thời gian tối đa cho phép trên mỗi lát cắt đồng bộ trước khi phải gọi `setImmediate` nhường luồng (ms).\n- `incomingHttpWaitMs`: Thời gian xử lý trung bình của một đợt I/O mạng tại Pha Poll xen giữa mỗi lần nhường luồng (ms).\n\nQuy tắc kiểm tra đầu vào (Validation):\n- Nếu `!Array.isArray(itemCostsMs)` hoặc có bất kỳ phần tử nào không phải số thực dương (`typeof c !== "number" || !Number.isFinite(c) || c <= 0`), hoặc `typeof maxSliceBudgetMs !== "number" || maxSliceBudgetMs <= 0`, hoặc `typeof incomingHttpWaitMs !== "number" || incomingHttpWaitMs < 0`: Ném lỗi `throw new Error("INVALID_SCHEDULER_INPUT")`.\n- Nếu `itemCostsMs.length === 0`: Trả về `{ totalSlices: 0, yieldCount: 0, maxSingleSliceMs: 0, totalWallClockMs: 0, slices: [] }`.\n\nQuy tắc gom nhóm lát cắt (Time-Sliced Chunking):\n- Duyệt tuần tự từng phần tử `cost` trong `itemCostsMs` và cộng dồn vào lát cắt hiện tại (`currentSliceMs += cost`, `currentCount++`).\n- Ngay sau khi xử lý xong phần tử thứ `i`, nếu `currentSliceMs >= maxSliceBudgetMs` VÀ vẫn còn phần tử phía sau (`i < itemCostsMs.length - 1`), ta đóng lát cắt hiện tại (làm tròn `durationMs` 2 chữ số thập phân `{ count: currentCount, durationMs }`), tăng `yieldCount++`, và mở lát cắt mới cho phần tử kế tiếp. (Lưu ý: Nếu chỉ 1 phần tử đơn lẻ đã có `cost >= maxSliceBudgetMs`, phần tử đó tự tạo thành 1 lát cắt riêng 1 phần tử rồi nhường luồng ngay sau nó).\n- Tính `maxSingleSliceMs`: Thời gian lớn nhất trong các lát cắt (làm tròn 2 chữ số thập phân).\n- Tính tổng thời gian thực tế `totalWallClockMs = sum(all itemCostsMs) + (yieldCount * incomingHttpWaitMs)` (làm tròn 2 chữ số thập phân).\nTrả về `{ totalSlices, yieldCount, maxSingleSliceMs, totalWallClockMs, slices }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra tính hợp lệ của tham số): Kiểm tra `Array.isArray(itemCostsMs)`, `maxSliceBudgetMs > 0`, `incomingHttpWaitMs >= 0` và mọi phần tử trong `itemCostsMs` đều là số hữu hạn `> 0`. Nếu vi phạm, `throw new Error("INVALID_SCHEDULER_INPUT")`. Xử lý riêng trường hợp mảng rỗng.',
        'Bước 2 (Duyệt và cắt lát theo ngân sách thời gian): Duyệt `i` từ `0` đến `itemCostsMs.length - 1`. Cộng `itemCostsMs[i]` vào `currentSliceMs` và tăng `currentCount`. Nếu `(currentSliceMs >= maxSliceBudgetMs && i < itemCostsMs.length - 1)` hoặc `i === itemCostsMs.length - 1`, đẩy `{ count: currentCount, durationMs: Math.round(currentSliceMs * 100) / 100 }` vào mảng `slices`. Nếu chưa phải phần tử cuối, tăng `yieldCount++` và đặt lại `currentSliceMs = 0, currentCount = 0`.',
        'Bước 3 (Tính các chỉ số tổng hợp): `totalSlices = slices.length`, `maxSingleSliceMs` là giá trị `durationMs` lớn nhất trong `slices`, và `totalWallClockMs = Math.round((totalCpuMs + yieldCount * incomingHttpWaitMs) * 100) / 100`.',
        'Bước 4 (Đóng gói kết quả): Trả về `{ totalSlices, yieldCount, maxSingleSliceMs, totalWallClockMs, slices }`.'
      ],
      hints: [
        'Điều kiện đóng lát cắt rất tự nhiên: sau khi xử lý xong phần tử thứ `i`, kiểm tra xem `currentSliceMs >= maxSliceBudgetMs` (đã chạm/vượt ngân sách) hay chưa. Nếu đã chạm ngân sách và `i < itemCostsMs.length - 1`, lập tức đóng lát cắt và gọi `yieldCount++`.',
        'Nhớ kiểm tra kỹ điều kiện ném lỗi `INVALID_SCHEDULER_INPUT` cho cả trường hợp phần tử trong `itemCostsMs` nhỏ hơn hoặc bằng 0.'
      ],
      starterCode: `function planCooperativeTimeSlices(itemCostsMs, maxSliceBudgetMs, incomingHttpWaitMs) {
  // Bước 1: Kiểm tra đầu vào hợp lệ, ném Error("INVALID_SCHEDULER_INPUT") nếu sai; xử lý mảng rỗng
  
  // Bước 2: Duyệt itemCostsMs và gom thành các lát cắt khi currentSliceMs >= maxSliceBudgetMs
  
  // Bước 3: Tính totalSlices, yieldCount, maxSingleSliceMs và totalWallClockMs
  
  // Bước 4: Trả về { totalSlices, yieldCount, maxSingleSliceMs, totalWallClockMs, slices }
}`,
      solution: `function planCooperativeTimeSlices(itemCostsMs, maxSliceBudgetMs, incomingHttpWaitMs) {
  if (
    !Array.isArray(itemCostsMs) ||
    typeof maxSliceBudgetMs !== 'number' ||
    !Number.isFinite(maxSliceBudgetMs) ||
    maxSliceBudgetMs <= 0 ||
    typeof incomingHttpWaitMs !== 'number' ||
    !Number.isFinite(incomingHttpWaitMs) ||
    incomingHttpWaitMs < 0
  ) {
    throw new Error('INVALID_SCHEDULER_INPUT');
  }

  for (let i = 0; i < itemCostsMs.length; i++) {
    const c = itemCostsMs[i];
    if (typeof c !== 'number' || !Number.isFinite(c) || c <= 0) {
      throw new Error('INVALID_SCHEDULER_INPUT');
    }
  }

  if (itemCostsMs.length === 0) {
    return {
      totalSlices: 0,
      yieldCount: 0,
      maxSingleSliceMs: 0,
      totalWallClockMs: 0,
      slices: []
    };
  }

  const slices = [];
  let currentCount = 0;
  let currentSliceMs = 0;
  let totalCpuMs = 0;
  let yieldCount = 0;
  let maxSingleSliceMs = 0;

  for (let i = 0; i < itemCostsMs.length; i++) {
    const cost = itemCostsMs[i];
    currentCount++;
    currentSliceMs += cost;
    totalCpuMs += cost;

    const isLastItem = i === itemCostsMs.length - 1;
    if (currentSliceMs >= maxSliceBudgetMs || isLastItem) {
      const roundedSliceMs = Math.round(currentSliceMs * 100) / 100;
      slices.push({
        count: currentCount,
        durationMs: roundedSliceMs
      });
      if (roundedSliceMs > maxSingleSliceMs) {
        maxSingleSliceMs = roundedSliceMs;
      }
      if (!isLastItem) {
        yieldCount++;
      }
      currentCount = 0;
      currentSliceMs = 0;
    }
  }

  const totalWallClockMs = Math.round((totalCpuMs + yieldCount * incomingHttpWaitMs) * 100) / 100;

  return {
    totalSlices: slices.length,
    yieldCount,
    maxSingleSliceMs,
    totalWallClockMs,
    slices
  };
}`,
      testCases: [
        {
          name: 'Chia 6 phần tử (0.8ms/phần tử) với ngân sách 2.0ms -> 2 lát cắt (mỗi lát 3 phần tử = 2.4ms) và 1 lần yield',
          input: [[0.8, 0.8, 0.8, 0.8, 0.8, 0.8], 2.0, 1.5],
          expected: {
            totalSlices: 2,
            yieldCount: 1,
            maxSingleSliceMs: 2.4,
            totalWallClockMs: 6.3,
            slices: [
              { count: 3, durationMs: 2.4 },
              { count: 3, durationMs: 2.4 }
            ]
          },
          hidden: false
        },
        {
          name: 'Phần tử đột biến nặng hơn ngân sách (3.5ms > 2.0ms) -> Lập tức nhường luồng ngay sau phần tử đó',
          input: [[1.0, 1.0, 3.5, 0.5, 0.5], 2.0, 1.0],
          expected: {
            totalSlices: 3,
            yieldCount: 2,
            maxSingleSliceMs: 3.5,
            totalWallClockMs: 8.5,
            slices: [
              { count: 2, durationMs: 2 },
              { count: 1, durationMs: 3.5 },
              { count: 2, durationMs: 1 }
            ]
          },
          hidden: false
        },
        {
          name: 'Danh sách phần tử rỗng -> Trả về cấu trúc 0 an toàn',
          input: [[], 2.0, 1.0],
          expected: {
            totalSlices: 0,
            yieldCount: 0,
            maxSingleSliceMs: 0,
            totalWallClockMs: 0,
            slices: []
          },
          hidden: false
        },
        {
          name: 'Test ẩn: Ngân sách thời gian âm hoặc bằng 0 -> Ném lỗi INVALID_SCHEDULER_INPUT',
          input: [[1.0, 2.0], 0, 1.0],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Test ẩn: Chi phí phần tử âm hoặc không hợp lệ -> Ném lỗi INVALID_SCHEDULER_INPUT',
          input: [[1.0, -0.5, 2.0], 2.0, 1.0],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
