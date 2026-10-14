import type { Lesson } from '../types.ts';

export const c1_l1: Lesson = {
  id: 'c1-l1',
  title: 'Bài 01: Từ Phần Cứng Đến Runtime: Bản Chất Long-Running Process & Bài Toán C10K',
  duration: '60 phút',
  tag: 'Hardware & OS Layer',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Khoa học Máy tính và Hệ điều hành từ cơ bản đến chuyên sâu cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Mô hình tiến trình và trạng thái bộ nhớ:** Hiểu rõ bản chất của Chương trình (Program), Tiến trình (Process), Luồng (Thread) dưới góc nhìn Hệ điều hành; phân biệt cơ chế vận hành giữa môi trường thực thi ngắn hạn (Client Runtime) và tiến trình máy chủ chạy dài hạn (Long-Running Daemon); giải thích cơ chế phát sinh lỗi nhiễm chéo dữ liệu (Data Bleed) và phong tỏa luồng chính (Main Thread Blocking).
> 2. **Phân cấp phần cứng và cơ chế đa hợp I/O (I/O Multiplexing):** Phân tích định lượng độ trễ truyền dẫn giữa CPU, bộ nhớ đệm (Cache L1/L2/L3), RAM, ổ cứng và mạng; chứng minh nguyên nhân vật lý khiến mô hình đa luồng truyền thống (Thread-per-Request) suy thoái tại ngưỡng 10,000 kết nối đồng thời (Bài toán C10K) và cơ chế hoạt động của \`epoll\` / \`kqueue\` ở tầng nhân hệ điều hành.
> 3. **Kiến trúc bộ nhớ tiến trình (\`Resident Set Size\`) và bộ thu gom rác V8:** Phân biệt bộ nhớ ảo (Virtual Memory) và bộ nhớ vật lý (\`RSS\`); nắm vững cơ chế cấp phát ngăn xếp (\`Stack\`), bộ nhớ động phân tầng thế hệ (\`V8 Generational Heap\`), bộ nhớ ngoài (\`C++ External Memory\`) và phương pháp thiết lập ngân sách bộ nhớ cho container trên môi trường Production.

---

# 1. BẢN CHẤT TIẾN TRÌNH HỆ ĐIỀU HÀNH VÀ MÔ HÌNH THỰC THI DÀI HẠN (LONG-RUNNING PROCESS)

### 1.1 Khái niệm nền tảng: Chương trình (Program), Tiến trình (Process) và Luồng (Thread)

Để hiểu cách một ứng dụng máy chủ Node.js và NestJS vận hành trên phần cứng thực tế, trước hết cần phân biệt chính xác ba khái niệm cơ sở của Hệ điều hành:

1. **Chương trình (Program):**
   Là tập hợp các tập tin mã nguồn hoặc mã máy được lưu trữ tĩnh trên thiết bị lưu trữ thứ cấp (ổ đĩa SSD/HDD), chẳng hạn như thư mục \`dist/\` sau khi biên dịch mã nguồn TypeScript. Ở trạng thái này, chương trình là một thực thể thụ động, không chiếm dụng bộ nhớ RAM và không tiêu thụ chu kỳ xử lý của CPU.
2. **Tiến trình (Process):**
   Khi người vận hành thực thi câu lệnh \`node dist/main.js\`, nhân hệ điều hành (OS Kernel) nạp mã thực thi của Node.js cùng mã nguồn ứng dụng vào bộ nhớ RAM và khởi tạo một thực thể đang hoạt động gọi là **Tiến trình**. Mỗi tiến trình được hệ điều hành định danh bằng một mã số duy nhất (**PID - Process ID**) và được cấp phát một **Không gian địa chỉ bộ nhớ ảo (Virtual Address Space)** cô lập hoàn toàn với các tiến trình khác trên cùng máy chủ. Không gian địa chỉ này bao gồm:
   - **Text Segment (Code Segment):** Chứa các chỉ thị mã máy đã biên dịch (chỉ đọc).
   - **Data & BSS Segment:** Chứa các biến toàn cục và biến tĩnh được khởi tạo ở cấp độ C/C++ của Runtime.
   - **Heap Segment:** Vùng nhớ cấp phát động trong quá trình chạy để lưu trữ các đối tượng dữ liệu phức hợp.
   - **Stack Segment:** Vùng nhớ ngăn xếp lưu trữ ngữ cảnh của các lời gọi hàm đang thực thi.
3. **Luồng thực thi (Thread):**
   Nếu **Tiến trình** là đơn vị để hệ điều hành *cấp phát và cô lập tài nguyên bộ nhớ*, thì **Luồng** là đơn vị nhỏ nhất để bộ lập lịch của hệ điều hành (OS Scheduler) *giao cho lõi CPU thực thi các tập lệnh*. Một tiến trình bắt buộc phải có ít nhất một luồng chính (**Main Thread**). Trong trường hợp một tiến trình tạo ra nhiều luồng (Multi-threading), toàn bộ các luồng này sẽ **dùng chung không gian bộ nhớ Heap và bảng mô tả tệp tin (File Descriptor Table)** của tiến trình mẹ, nhưng mỗi luồng sở hữu bộ thanh ghi CPU (Registers) và một vùng nhớ ngăn xếp (**Call Stack**) riêng biệt để quản lý chuỗi hàm mà luồng đó đang chạy.

### 1.2 Đối chiếu kiến trúc thực thi: Client Runtime (Ephemeral) và Server Runtime (Daemon)

Mặc dù cả trình duyệt web (như Google Chrome) và máy chủ Node.js đều sử dụng chung bộ máy thực thi JavaScript là **V8 Engine**, mô hình kiến trúc hệ thống của hai môi trường này hoàn toàn đối lập nhau. Việc áp dụng nguyên vẹn tư duy lập trình phía giao diện (Client-side) sang phía máy chủ (Server-side) là nguyên nhân hàng đầu dẫn đến các lỗi rò rỉ dữ liệu và suy giảm hiệu năng hệ thống.

| Tiêu chí học thuật | Client Runtime (Mô hình tiến trình ngắn hạn - Ephemeral) | Server Runtime (Mô hình tiến trình chạy nền - Long-Running Daemon) |
| :--- | :--- | :--- |
| **Đơn vị cô lập tài nguyên** | Cô lập theo từng Tab trình duyệt (Multi-process Sandbox); mỗi người dùng chạy trên thiết bị vật lý riêng | Một tiến trình máy chủ duy nhất tiếp nhận và xử lý đồng thời hàng chục nghìn yêu cầu (HTTP Requests) từ nhiều người dùng |
| **Thời gian sống của tiến trình** | Ngắn hạn (vài giây đến vài chục phút); kết thúc ngay khi người dùng đóng Tab hoặc tải lại trang (F5) | Dài hạn (nhiều tuần hoặc nhiều tháng liên tục) kể từ thời điểm khởi chạy dịch vụ cho tới khi triển khai phiên bản mới |
| **Phạm vi bộ nhớ Heap** | Riêng biệt cho từng cá nhân; dữ liệu trên bộ nhớ Heap chỉ thuộc về một phiên làm việc của một người dùng duy nhất | Dùng chung toàn cục (Single Shared Heap); mọi yêu cầu gửi tới máy chủ đều đọc và ghi trên cùng một không gian bộ nhớ V8 |
| **Cơ chế thu hồi tài nguyên** | Hệ điều hành tự động thu hồi toàn bộ các trang nhớ vật lý ngay khi người dùng đóng Tab trình duyệt | Phụ thuộc hoàn toàn vào bộ thu gom rác (Garbage Collector) và kỷ luật giải phóng tham chiếu của lập trình viên |
| **Hệ quả khi rò rỉ bộ nhớ** | Chỉ làm chậm hoặc dừng Tab trình duyệt trên máy cá nhân của một người dùng đang thao tác | Tích lũy dần qua hàng triệu yêu cầu cho đến khi làm cạn kiệt RAM vật lý và gây sập toàn bộ tiến trình máy chủ (\`OOMKilled\`) |
| **Hệ quả khi biến trạng thái sai lệch** | Hiển thị sai dữ liệu cục bộ trên màn hình của chính người dùng đó | Gây nhiễm chéo dữ liệu giữa các người dùng hoặc giữa các tổ chức khách hàng khác nhau (Cross-tenant Data Bleed) |

### 1.3 Cơ chế quản lý trạng thái trong Singleton Service và bài toán nhiễm chéo dữ liệu (Data Bleed)

Trong kiến trúc của NestJS, bộ quản lý phụ thuộc (**IoC Container - Inversion of Control Container**) mặc định khởi tạo các lớp dịch vụ (\`@Injectable()\`) theo mẫu thiết kế **Singleton** (\`Scope.DEFAULT\`). Điều này có nghĩa là trong suốt vòng đời hàng tháng của tiến trình máy chủ, NestJS chỉ cấp phát **một đối tượng (instance) duy nhất** cho mỗi lớp \`Controller\`, \`Service\`, hoặc \`Repository\` trên vùng nhớ V8 Heap.

Lý do kiến trúc của thiết kế này là tối ưu hóa bộ nhớ và tốc độ: nếu khởi tạo lại toàn bộ cây phụ thuộc cho mỗi HTTP request (\`Scope.REQUEST\`), máy chủ xử lý 5,000 request/giây sẽ phải cấp phát và thu hồi hàng chục nghìn đối tượng dịch vụ mỗi giây, gây áp lực lớn lên bộ thu gom rác (Garbage Collector). Tuy nhiên, việc dùng chung một đối tượng Singleton đòi hỏi các lớp dịch vụ bắt buộc phải tuân thủ tính chất **Phi trạng thái theo yêu cầu (Request-Stateless)**.

Một ngộ nhận phổ biến ở giai đoạn đầu tiếp cận Node.js là: *"Vì Node.js thực thi mã nguồn JavaScript trên một luồng duy nhất (Single-threaded), nên một yêu cầu phải chạy xong từ đầu đến cuối rồi yêu cầu tiếp theo mới được xử lý"*. Trên thực tế, Node.js vận hành theo cơ chế **Đa nhiệm hợp tác bất đồng bộ (Asynchronous Cooperative Multitasking)**: luồng chính chỉ chạy độc quyền các đoạn mã đồng bộ, và ngay khi gặp một thao tác nhập/xuất bất đồng bộ (\`await\`), hàm hiện tại sẽ tạm dừng để nhường luồng chính cho các yêu cầu khác.

Hãy phân tích sự khác biệt giữa thiết kế sai (lưu trạng thái vào thuộc tính của Singleton) và thiết kế chuẩn thông qua mã nguồn dưới đây:

\`\`\`typescript
// File: src/billing/billing.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Lưu trạng thái của từng request lên thuộc tính của Singleton Service
@Injectable()
export class BillingServiceBroken {
  // Thuộc tính cấp đối tượng (Instance Property) nằm cố định trên vùng nhớ Shared Heap
  private currentClinicId: string = '';

  async generateFinancialReport(clinicId: string) {
this.currentClinicId = clinicId; // Bước 1: Ghi đè lên vùng nhớ dùng chung
await this.auditService.logReportRequest(clinicId); // Bước 2: Tạm dừng hàm để chờ I/O mạng
// Bước 3: Khi hàm tiếp tục chạy sau await, this.currentClinicId đã bị request khác thay đổi
return this.prisma.invoice.findMany({
  where: { clinicId: this.currentClinicId },
});
  }
}

// 2. THIẾT KẾ CHUẨN (STATELESS SERVICE): Truyền ngữ cảnh qua tham số hàm nằm trong phạm vi cục bộ
@Injectable()
export class BillingServiceSafe {
  // Thuộc tính của Singleton chỉ dùng để giữ các kết nối hạ tầng hoặc dependency cố định
  constructor(
private readonly prisma: PrismaService,
private readonly auditService: AuditService,
  ) {}

  async generateFinancialReport(clinicId: string) {
// Tham số clinicId được bảo toàn riêng biệt trong ngữ cảnh thực thi (Execution Context) của từng lần gọi hàm
await this.auditService.logReportRequest(clinicId);
return this.prisma.invoice.findMany({
  where: { clinicId },
});
  }
}
\`\`\`

Để thấy rõ cơ chế gây lỗi ở cấp độ bộ nhớ của lớp \`BillingServiceBroken\`, bảng dưới đây truy vết trạng thái của luồng thực thi chính và vùng nhớ Heap theo từng mốc mili-giây khi có hai yêu cầu đồng thời từ hai phòng khám khác nhau:

| Mốc thời gian | Yêu cầu đang giữ Main Thread | Thao tác thực thi trên CPU / I/O | Giá trị \`this.currentClinicId\` trên Shared Heap | Trạng thái của Yêu cầu A và Yêu cầu B |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Yêu cầu A (\`clinic-saigon\`) | Gọi hàm \`generateFinancialReport('clinic-saigon')\`, thực thi dòng gán thuộc tính | \`'clinic-saigon'\` | Yêu cầu A đang chạy trên Main Thread |
| **\`t = 1 ms\`** | Yêu cầu A (\`clinic-saigon\`) | Gặp từ khóa \`await logReportRequest()\`; gửi gói tin TCP sang Database và tạm dừng hàm | \`'clinic-saigon'\` | Yêu cầu A chuyển sang trạng thái chờ I/O; Main Thread được giải phóng |
| **\`t = 4 ms\`** | Yêu cầu B (\`clinic-hanoi\`) | Event Loop tiếp nhận Yêu cầu B; gọi hàm \`generateFinancialReport('clinic-hanoi')\` trên cùng instance | \`'clinic-hanoi'\` (Đã ghi đè giá trị của Yêu cầu A) | Yêu cầu A đang chờ I/O; Yêu cầu B đang chạy trên Main Thread |
| **\`t = 5 ms\`** | Yêu cầu B (\`clinic-hanoi\`) | Gặp từ khóa \`await logReportRequest()\` của Yêu cầu B và tạm dừng để chờ Database | \`'clinic-hanoi'\` | Cả Yêu cầu A và Yêu cầu B cùng chờ phản hồi I/O |
| **\`t = 12 ms\`** | Yêu cầu A (\`clinic-saigon\`) | Database phản hồi cho Yêu cầu A; luồng chính khôi phục khung hàm của Yêu cầu A để chạy lệnh \`findMany\` | \`'clinic-hanoi'\` | Yêu cầu A đọc \`this.currentClinicId\` (\`'clinic-hanoi'\`) và trả về dữ liệu của Hà Nội cho Sài Gòn |

### 1.4 Cơ chế đơn luồng hướng sự kiện và hiện tượng phong tỏa luồng chính (Main Thread Blocking)

Trong lý thuyết hệ thống phân tán và lý thuyết hàng đợi (**Queueing Theory**), luồng thực thi chính của Node.js hoạt động tương đương với một bộ phục vụ đơn kênh. Mọi yêu cầu đi vào hệ thống đều được chia thành các chặng xử lý nhỏ xen kẽ giữa **CPU Burst** (thời gian CPU chạy mã JavaScript đồng bộ) và **I/O Wait** (thời gian chờ thiết bị ngoại vi xử lý).

Để phân tích hiệu năng hệ thống, kỹ sư cần phân loại mọi tác vụ xử lý thành hai nhóm bản chất:

1. **Tác vụ giới hạn bởi nhập/xuất (I/O-bound Operations):**
   Bao gồm các thao tác truy vấn cơ sở dữ liệu (PostgreSQL, MongoDB), đọc/ghi bộ nhớ đệm (Redis), đọc tệp tin từ ổ đĩa hoặc gọi HTTP sang dịch vụ khác. Trong các tác vụ này, CPU chỉ mất khoảng \`0.1 ms – 0.5 ms\` để đóng gói yêu cầu và gửi đi, trong khi thời gian chờ mạng hoặc ổ đĩa phản hồi kéo dài từ \`5 ms\` đến hàng trăm mili-giây. Đây là nhóm tác vụ mà kiến trúc Event Loop phát huy hiệu suất tối đa.
2. **Tác vụ giới hạn bởi tính toán (CPU-bound Operations):**
   Bao gồm các thuật toán băm mật khẩu đồng bộ (\`bcrypt.hashSync\`, \`crypto.pbkdf2Sync\`), nén/giải nén dữ liệu dung lượng lớn (\`zlib.gzipSync\`), phân tích cú pháp chuỗi JSON kích thước hàng chục MB (\`JSON.parse\`), khớp biểu thức chính quy phức tạp (Catastrophic Backtracking Regex), hoặc duyệt vòng lặp qua hàng triệu phần tử trong bộ nhớ. Trong suốt thời gian chạy các hàm này, đơn vị số học và logic (**ALU**) của CPU bị chiếm giữ liên tục 100%, khiến Event Loop không thể chuyển sang bất kỳ yêu cầu nào khác.

Nếu một yêu cầu thực thi tác vụ đồng bộ chiếm dụng CPU trong khoảng thời gian \`T_CPU = 250 ms\`, và có \`N = 40\` yêu cầu gửi đến cùng thời điểm, thời gian chờ trong hàng đợi của yêu cầu thứ \`N\` sẽ tăng tuyến tính theo công thức:

\`\`\`
Thời gian chờ của Request thứ N = (N - 1) × T_CPU = 39 × 250 ms = 9,750 ms (9.75 giây)
\`\`\`

Trong suốt \`9.75 giây\` đó, toàn bộ các yêu cầu khác — bao gồm cả yêu cầu kiểm tra trạng thái sống (\`Liveness Probe: GET /health\`) từ bộ cân bằng tải (Load Balancer / Kubernetes) — đều bị chặn ngoài hàng đợi. Khi thời gian phản hồi vượt ngưỡng timeout của probe (thường từ 2 đến 5 giây), hạ tầng điều phối sẽ kết luận tiến trình đã bị treo cứng (Deadlock) và cưỡng bức khởi động lại container, gây gián đoạn toàn bộ các giao dịch đang xử lý dở dang.

> **Tổng kết học thuật Phần 1 (Hai quy tắc thiết kế bất biến trên Long-Running Process):**
> 1. **Tính bất biến của trạng thái dịch vụ (Stateless Singleton Invariant):** Các thuộc tính (\`properties\`) của một class \`@Injectable()\` ở chế độ Singleton chỉ được phép lưu trữ các đối tượng phụ thuộc (Dependencies) hoặc cấu hình hằng số được khởi tạo một lần lúc khởi động. Mọi dữ liệu gắn với từng yêu cầu của người dùng bắt buộc phải truyền qua tham số hàm hoặc lưu trong vùng nhớ theo dõi ngữ cảnh bất đồng bộ (\`AsyncLocalStorage\`).
> 2. **Giới hạn thời gian chiếm dụng CPU trên mỗi nhịp sự kiện (Event Loop Tick Budget):** Không thực thi các thuật toán đồng bộ tốn quá vài mili-giây trực tiếp trên luồng chính. Các tác vụ nặng về tính toán (CPU-bound) bắt buộc phải chuyển sang hàm bất đồng bộ chạy trên Libuv Threadpool, tách sang \`Worker Threads\`, hoặc đẩy vào hàng đợi xử lý nền (Message Queue / Worker Process).

---

# 2. PHÂN CẤP ĐỘ TRỄ PHẦN CỨNG, BÀI TOÁN C10K VÀ CƠ CHẾ ĐA HỢP I/O (I/O MULTIPLEXING)

### 2.1 Phân cấp bộ nhớ máy tính và độ trễ truyền dẫn vật lý (Memory & I/O Latency Hierarchy)

Trong kiến trúc máy tính hiện đại, một lõi vi xử lý (CPU Core) hoạt động ở tần số xung nhịp \`3.0 GHz\` có khả năng thực hiện 3 tỷ chu kỳ xung nhịp mỗi giây (tương đương \`0.33 ns\` cho một chu kỳ). Tuy nhiên, tốc độ xử lý thực tế của một chương trình không chỉ phụ thuộc vào xung nhịp CPU, mà bị giới hạn bởi **thời gian vận chuyển dữ liệu từ nơi lưu trữ vào các thanh ghi (Registers) của CPU**.

Do giới hạn vật lý về khoảng cách mạch điện và công nghệ chế tạo bán dẫn, bộ nhớ càng có tốc độ truy xuất nhanh (như SRAM trên L1 Cache) thì chi phí sản xuất càng đắt và dung lượng càng nhỏ (chỉ vài chục Kilobyte trên mỗi lõi). Ngược lại, bộ nhớ có dung lượng lớn (như DRAM hoặc ổ cứng NVMe SSD) lại có độ trễ truy xuất chậm hơn từ hàng trăm đến hàng trăm nghìn lần.

Bảng dưới đây thống kê độ trễ truy xuất vật lý tiêu chuẩn giữa các tầng phần cứng và quy đổi theo tỷ lệ xích **1 nanosecond (\`1 ns\`) tương đương \`1 giây\`** để thể hiện trực quan khoảng cách tốc độ:

| Tầng phần cứng trong kiến trúc máy tính | Dung lượng điển hình | Độ trễ vật lý thực tế | Quy đổi tỷ lệ (1 ns = 1 giây) | Bản chất kỹ thuật ở cấp độ vi mạch và hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **Thanh ghi CPU (CPU Registers)** | Vài trăm Bytes | ~0.3 ns – 0.5 ns | 0.5 giây | Nằm trực tiếp bên trong lõi thực thi ALU; truy xuất tức thì trong 1 chu kỳ xung nhịp |
| **Bộ nhớ đệm L1 / L2 Cache (SRAM)** | 32 KB – 1 MB / lõi | ~1 ns – 4 ns | 1 – 4 giây | Bộ nhớ tĩnh tốc độ cao tích hợp sát lõi CPU để lưu các dòng lệnh và biến đang dùng lặp lại |
| **Bộ nhớ đệm L3 Cache (Shared SRAM)** | 16 MB – 64 MB | ~10 ns – 20 ns | 10 – 20 giây | Bộ nhớ đệm dùng chung giữa tất cả các lõi trên cùng một đế vi xử lý (CPU Socket) |
| **Bộ nhớ chính (Main Memory - DRAM)** | 16 GB – 128 GB | ~80 ns – 100 ns | 1 phút 40 giây | Khi dữ liệu không có trong Cache (Cache Miss), CPU phải đọc qua đường truyền Memory Bus từ thanh RAM |
| **Ổ cứng thể rắn (NVMe SSD I/O)** | Hàng Terabytes | ~100,000 ns (100 µs) | 1 ngày 3 giờ | Truyền dữ liệu qua giao tiếp PCIe và hệ thống tệp tin của nhân hệ điều hành; chậm hơn CPU 100,000 lần |
| **Truyền dẫn mạng (Network Roundtrip)** | Không giới hạn | ~40,000,000 ns (40 ms) | 1 năm 3 tháng | Gói tin đi qua TCP/IP Stack, cáp quang và bộ định tuyến liên vùng; chậm hơn CPU 40 triệu lần |

Sự chênh lệch tới **7 bậc độ lớn (10⁷ lần)** giữa tốc độ xử lý của CPU (\`1 ns\`) và thời gian chờ mạng (\`40,000,000 ns\`) được gọi là **Khoảng trống hiệu năng nhập/xuất (I/O Performance Gap)**. Trong một hệ thống Backend điển hình, khi xử lý một HTTP request (xác thực token trên Redis, truy vấn dữ liệu từ PostgreSQL, ghi nhận sự kiện sang dịch vụ khác), hơn 95% tổng thời gian của request nằm ở việc chờ đợi dữ liệu di chuyển qua mạng. Nếu thiết kế hệ thống buộc luồng thực thi phải dừng lại để chờ các thao tác I/O này hoàn tất (Blocking I/O), tài nguyên phần cứng sẽ bị lãng phí nghiêm trọng.

### 2.2 Mô hình đa luồng truyền thống (Thread-per-Request) và giới hạn vật lý tại ngưỡng C10K

Năm 1999, kỹ sư hệ thống Dan Kegel đã đặt ra **Bài toán C10K (Concurrent 10,000 Connections)**: *Làm thế nào để một máy chủ vật lý duy nhất có thể duy trì và xử lý đồng thời 10,000 kết nối mạng từ khách hàng, ngay cả khi băng thông đường truyền và tốc độ CPU hoàn toàn đủ đáp ứng?*

Trong mô hình máy chủ truyền thống (điển hình là Apache HTTPD chế độ prefork/worker hoặc các máy chủ ứng dụng đồng bộ thế hệ cũ), kiến trúc xử lý dựa trên nguyên tắc **Mỗi kết nối một luồng hệ điều hành (Thread-per-Request)**:
- Khi một kết nối HTTP được thiết lập, máy chủ lấy một luồng hệ điều hành (Kernel Thread / POSIX \`pthread\`) từ bể luồng (Thread Pool) để gắn độc quyền cho kết nối đó.
- Khi luồng này gửi câu lệnh SQL sang cơ sở dữ liệu và gọi hàm đọc mạng đồng bộ (\`read()\` / \`recv()\`), nhân hệ điều hành sẽ chuyển trạng thái của luồng từ \`TASK_RUNNING\` sang trạng thái ngủ (\`TASK_INTERRUPTIBLE\`) cho tới khi gói tin phản hồi từ cơ sở dữ liệu quay về.

Khi số lượng kết nối đồng thời tăng lên mức hàng nghìn (C10K), mô hình Thread-per-Request vấp phải hai rào cản vật lý không thể vượt qua bằng cách viết code thông thường:

1. **Sự cạn kiệt bộ nhớ do chi phí ngăn xếp tĩnh (Thread Stack Memory Footprint):**
   Trên hệ điều hành Linux 64-bit, mỗi khi một luồng hệ điều hành được khởi tạo thông qua lời gọi hệ thống \`clone()\`, nhân hệ điều hành phải cấp phát cấu trúc quản lý luồng (\`task_struct\` và \`Kernel Stack\` trong vùng nhớ nhân) cùng với một vùng nhớ ngăn xếp riêng biệt ở không gian người dùng (**User-space Call Stack**, thường có dung lượng cam kết thực tế từ \`1 MB\` đến \`2 MB\` cho mỗi luồng).
   - Phép tính định lượng: Để duy trì đồng thời 10,000 luồng cho 10,000 kết nối đang mở, hệ thống tiêu tốn:
 \`\`\`
 Dung lượng RAM cho Stack = 10,000 luồng × 1.5 MB/luồng ≈ 15 GB RAM
 \`\`\`
   - Điều đáng chú ý là gần như toàn bộ \`15 GB RAM\` này chỉ dùng để lưu trữ ngăn xếp của các luồng đang nằm chờ phản hồi mạng chứ không thực hiện bất kỳ phép tính nào.
2. **Sự suy thoái hiệu năng CPU do chuyển đổi ngữ cảnh (Context Switching & Cache Thrashing):**
   Khi số lượng luồng đang hoạt động lớn hơn nhiều lần số lõi CPU vật lý (ví dụ: 2,000 luồng tranh chấp trên một máy chủ 8 lõi CPU), bộ lập lịch của nhân hệ điều hành (**Linux Completely Fair Scheduler - CFS**) buộc phải liên tục ngắt các luồng sau mỗi lát cắt thời gian (Time Slice, khoảng vài mili-giây) để chia đều CPU. Mỗi lần chuyển đổi ngữ cảnh từ Luồng A sang Luồng B kéo theo hai nhóm chi phí phần cứng:
   - **Chi phí trực tiếp trên CPU (Direct Switching Cost):** CPU phải chuyển từ chế độ người dùng (*User Mode - Ring 3*) sang chế độ đặc quyền của nhân (*Kernel Mode - Ring 0*), lưu toàn bộ giá trị hiện tại của các thanh ghi phần cứng (con trỏ lệnh \`RIP\`, con trỏ ngăn xếp \`RSP\`, các thanh ghi đa dụng \`RAX\`..\`R15\`) của Luồng A xuống bộ nhớ RAM, sau đó nạp bộ thanh ghi của Luồng B từ RAM lên CPU.
   - **Chi phí gián tiếp làm mất hiệu lực bộ nhớ đệm (Indirect Cache & TLB Thrashing):** Đây là nguyên nhân chính làm sụt giảm thông lượng hệ thống. Khi Luồng B bắt đầu thực thi, nó truy xuất vào các vùng địa chỉ bộ nhớ hoàn toàn khác với Luồng A. Hệ quả là toàn bộ các dòng dữ liệu (Cache Lines kích thước \`64 bytes\`) mà Luồng A vừa nạp lên **L1/L2 Cache** cùng với bảng ánh xạ địa chỉ ảo trong **TLB (Translation Lookaside Buffer)** bị đẩy ra ngoài để nhường chỗ cho dữ liệu của Luồng B. Khi đến lượt Luồng A được chạy lại ở chu kỳ sau, mọi thao tác đọc biến của Luồng A đều rơi vào trạng thái **trượt bộ nhớ đệm (Cache Miss)**, buộc CPU phải dừng lại chờ đọc từ DRAM (chậm hơn 100 lần). Khi số lượng luồng tăng quá ngưỡng, CPU dành phần lớn chu kỳ xung nhịp chỉ để nạp/xả thanh ghi và chờ RAM thay vì chạy logic nghiệp vụ.

### 2.3 Kiến trúc Non-blocking I/O và cơ chế đa hợp sự kiện nhân hệ điều hành (\`epoll\` / \`kqueue\` / \`IOCP\`)

Để vượt qua giới hạn C10K mà không cần cấp phát hàng chục nghìn luồng hệ điều hành, Node.js (thông qua thư viện C cấp thấp **Libuv**) kết hợp hai cơ chế: **Socket phi chặn (Non-blocking Socket)** và **Đa hợp sự kiện nhập/xuất ở tầng nhân (Kernel-level I/O Multiplexing)**.

Để nắm vững cơ chế này từ gốc, sinh viên cần theo dõi vòng đời của một kết nối mạng từ tầng phần cứng lên tới tầng Runtime qua 4 bước tuần tự:

1. **Biểu diễn kết nối bằng Mô tả tệp tin (File Descriptor - FD):**
   Theo kiến trúc của hệ điều hành họ Unix/Linux, mọi kết nối mạng (Socket), tệp tin hoặc đường ống dữ liệu đều được nhân quản lý thông qua một bảng chỉ mục gọi là **File Descriptor Table**. Khi một khách hàng mở kết nối TCP tới cổng \`3000\` của máy chủ NestJS, nhân Linux khởi tạo một cấu trúc dữ liệu socket trong vùng nhớ Kernel (gồm bộ đệm nhận \`Receive Buffer\` và bộ đệm gửi \`Send Buffer\`) và trả về cho tiến trình Node.js một số nguyên định danh gọi là **File Descriptor** (ví dụ: \`FD = 12\`). Libuv lập tức thiết lập cờ \`O_NONBLOCK\` trên \`FD\` này: mọi thao tác đọc/ghi trên socket sẽ trả về ngay lập tức mà không bao giờ được phép khóa luồng gọi.
2. **Hạn chế của thế hệ đa hợp cũ (\`select\` và \`poll\` — Độ phức tạp \`O(N)\`):**
   Trong các hệ thống cũ sử dụng lời gọi hệ thống \`select()\` hoặc \`poll()\`, để kiểm tra xem kết nối nào trong số \`N = 10,000\` kết nối đang có dữ liệu mới, tiến trình phải truyền toàn bộ mảng 10,000 số \`FD\` xuống nhân ở mỗi vòng lặp. Nhân hệ điều hành buộc phải chạy vòng lặp duyệt tuần tự qua từng \`FD\` từ 1 đến 10,000 để kiểm tra bộ đệm mạng. Chi phí CPU tăng tuyến tính \`O(N)\` theo tổng số kết nối đang mở, ngay cả khi chỉ có 1 kết nối thực sự gửi dữ liệu.
3. **Cấu trúc dữ liệu nội bộ của \`epoll\` trên nhân Linux (Độ phức tạp \`O(1)\`):**
   Trên hệ điều hành Linux (tương ứng là \`kqueue\` trên macOS/BSD và \`IOCP\` trên Windows), cơ chế \`epoll\` thay thế hoàn toàn việc quét tuyến tính bằng mô hình đăng ký sự kiện thông qua 3 lời gọi hệ thống:
   - \`epoll_create()\`: Khởi tạo một đối tượng ngữ cảnh \`epoll\` bên trong vùng nhớ của nhân Linux. Bên trong đối tượng này, nhân duy trì hai cấu trúc dữ liệu cốt lõi:
 - Một **Cây Đỏ-Đen (Red-Black Tree):** Lưu trữ toàn bộ danh sách các \`FD\` mà tiến trình Node.js yêu cầu theo dõi. Nhờ cấu trúc cây nhị phân cân bằng, việc thêm mới, sửa đổi hoặc hủy theo dõi một kết nối trong tổng số hàng trăm nghìn kết nối chỉ có độ phức tạp \`O(log N)\`.
 - Một **Danh sách liên kết đôi chứa các kết nối sẵn sàng (Ready List):** Chỉ chứa riêng các \`FD\` đã thực sự nhận được dữ liệu hoặc sẵn sàng ghi.
   - \`epoll_ctl()\`: Khi có khách hàng mới kết nối, Libuv gọi hàm này một lần để gắn \`FD\` của khách hàng vào Cây Đỏ-Đen và đăng ký một hàm gọi ngược (Kernel Callback) với trình điều khiển mạng.
   - **Cơ chế đánh thức qua Ngắt phần cứng (Hardware Interrupt & DMA):** Khi card mạng (**NIC**) nhận được gói tin TCP từ khách hàng, nó sao chép thẳng dữ liệu vào bộ đệm RAM thông qua cơ chế truy cập bộ nhớ trực tiếp (**DMA - Direct Memory Access**) mà không làm bận CPU, sau đó phát một tín hiệu ngắt phần cứng (**IRQ**). Nhân Linux nhận ngắt, xác định đúng \`FD\` tương ứng và tự động chèn \`FD\` đó vào **Ready List** với độ phức tạp **\`O(1)\`**.
   - \`epoll_wait()\`: Ở pha **Poll Phase** của mỗi vòng lặp sự kiện, luồng chính của Node.js chỉ cần gọi \`epoll_wait()\`. Nhân Linux lập tức trả về các phần tử đang nằm sẵn trong **Ready List** (độ phức tạp \`O(1)\` theo số lượng kết nối hoạt động).
4. **Hiệu quả tài nguyên đạt được:**
   Nhờ kiến trúc này, 10,000 kết nối đang mở nhưng chưa gửi dữ liệu chỉ tồn tại dưới dạng 10,000 nút nhỏ trên Cây Đỏ-Đen trong nhân hệ điều hành (mỗi nút chỉ tốn vài trăm Bytes bộ nhớ Kernel) và tiêu tốn **0% chu kỳ CPU**. Luồng chính của Node.js chỉ làm việc khi dữ liệu đã nằm sẵn trong bộ đệm RAM, giữ cho dữ liệu trên **CPU L1/L2 Cache** luôn nóng (Warm Cache) và loại bỏ hoàn toàn chi phí chuyển đổi ngữ cảnh giữa các luồng người dùng.

---

# 3. KIẾN TRÚC BỘ NHỚ TIẾN TRÌNH NODE.JS (RESIDENT SET SIZE) VÀ CƠ CHẾ CẤP PHÁT V8

### 3.1 Cấu trúc không gian bộ nhớ vật lý của tiến trình (Resident Set Size - RSS)

Trong hệ điều hành hiện đại, một tiến trình không làm việc trực tiếp với địa chỉ vật lý trên thanh RAM mà thông qua cơ chế **Bộ nhớ ảo phân trang (Paged Virtual Memory)** do bộ quản lý bộ nhớ phần cứng (**MMU - Memory Management Unit**) trên CPU điều khiển. Khi giám sát một tiến trình Node.js trên máy chủ Linux, kỹ sư cần phân biệt rõ hai chỉ số cấp hệ điều hành:

- **VSZ (Virtual Memory Size):** Tổng dung lượng không gian địa chỉ ảo mà tiến trình đã đăng ký với nhân hệ điều hành (bao gồm cả các vùng nhớ chỉ mới đặt chỗ trước nhưng chưa từng được ghi dữ liệu).
- **RSS (Resident Set Size):** Tổng dung lượng các trang nhớ thực tế (Memory Pages, mỗi trang thường có kích thước \`4 KB\`) đang hiện diện trực tiếp trên các thanh RAM vật lý của máy chủ.

Khi vận hành ứng dụng trong môi trường container (Docker / Kubernetes), bộ kiểm soát tài nguyên của nhân Linux (**cgroups - Control Groups**) căn cứ vào bộ nhớ vật lý thực tế (\`RSS\` / \`Working Set\`) chứ không căn cứ riêng vào bộ nhớ JavaScript. Nếu tổng \`RSS\` của tiến trình chạm ngưỡng \`resources.limits.memory\` đã cấu hình cho Pod, cơ chế **Linux OOM Killer (Out-Of-Memory Killer)** sẽ gửi tín hiệu cưỡng bức \`SIGKILL (Signal 9)\` để tiêu hủy tiến trình ngay lập tức, trả về mã thoát **\`Exit Code 137\`** (\`128 + 9\`).

Đây là lý do nhiều kỹ sư gặp sự cố container bị \`OOMKilled\` dù đã đặt cờ giới hạn \`--max-old-space-size=1024\` (1024 MB) cho V8. Như sơ đồ dưới đây thể hiện, **V8 Heap Space** chỉ là một trong ba phân vùng cấu thành nên tổng bộ nhớ **RSS** của tiến trình:

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

### 3.2 Cơ chế cấp phát bộ nhớ ngăn xếp (V8 Stack) và bộ nhớ động (V8 Generational Heap)

Khi một đoạn mã TypeScript/JavaScript thực thi, V8 Engine phân loại và lưu trữ dữ liệu vào hai vùng nhớ có cơ chế vật lý hoàn toàn khác nhau là **Stack** và **Heap**. Hãy quan sát đoạn mã xử lý đơn hàng dưới đây để theo dõi đường đi của từng biến trong bộ nhớ:

\`\`\`typescript
// File: src/orders/order-memory-trace.ts
interface OrderPayload {
  orderId: string;
  items: number[];
}

function calculateTax(baseAmount: number, taxRate: number): number {
  const taxValue = baseAmount * taxRate; // Biến nguyên thủy cục bộ nằm trên Stack Frame
  return taxValue;
}

function processOrder(unitPrice: number, quantity: number) {
  const baseAmount = unitPrice * quantity; // Nằm trên Stack Frame của hàm processOrder
  const tax = calculateTax(baseAmount, 0.1); // Đẩy thêm 1 Stack Frame mới cho calculateTax

  // Đối tượng phức hợp được cấp phát trên V8 Heap (Young Generation);
  // Biến cục bộ 'payload' trên Stack chỉ lưu con trỏ địa chỉ (Reference Pointer) trỏ sang Heap
  const payload: OrderPayload = {
orderId: 'ORD-2026-01',
items: [unitPrice, quantity, tax],
  };
  return payload;
}
\`\`\`

#### 1. Cơ chế hoạt động của V8 Stack Space (Bộ nhớ ngăn xếp)
- **Tổ chức dữ liệu:** Hoạt động như một ngăn xếp tuyến tính liền kề theo nguyên tắc **LIFO (Last In, First Out - Vào sau, Ra trước)**.
- **Khung gọi hàm (Call Frame / Stack Frame):** Khi hàm \`processOrder\` được gọi, CPU cấp phát một khối nhớ gọi là \`Stack Frame\` chứa các tham số \`unitPrice\`, \`quantity\` và biến nguyên thủy \`baseAmount\`. Khi \`processOrder\` gọi tiếp \`calculateTax\`, một \`Stack Frame\` thứ hai được đặt chồng lên đỉnh ngăn xếp.
- **Cấp phát và giải phóng bằng phần cứng:** Toàn bộ việc cấp phát và thu hồi trên Stack được thực hiện thông qua thanh ghi con trỏ ngăn xếp (**Stack Pointer - \`RSP\`**) của CPU. Ngay khi hàm \`calculateTax\` thực thi lệnh \`return\`, CPU chỉ cần cộng một số nguyên vào thanh ghi \`RSP\` để lùi con trỏ về lại khung của \`processOrder\`. Vùng nhớ của \`calculateTax\` được giải phóng tức thì trong **1 chu kỳ lệnh của CPU** mà không cần bất kỳ sự can thiệp nào của bộ thu gom rác (0% Garbage Collection overhead).
- **Giới hạn vật lý:** Vì vùng nhớ Stack đòi hỏi các ô nhớ vật lý phải nằm liền kề nhau và có kích thước nhỏ (mặc định khoảng \`984 KB\` trên V8 64-bit, điều chỉnh qua cờ \`--stack-size\`), nó chỉ dùng để lưu các giá trị có kích thước cố định đã biết trước lúc biên dịch (số nguyên, boolean, và các con trỏ địa chỉ). Nếu gọi đệ quy không có điều kiện dừng làm số lượng \`Stack Frame\` vượt quá dung lượng này, V8 sẽ ném lỗi \`RangeError: Maximum call stack size exceeded\`.

#### 2. Cơ chế hoạt động của V8 Heap Space (Bộ nhớ cấp phát động theo thế hệ)
Mọi cấu trúc dữ liệu có kích thước biến động hoặc cần tồn tại sau khi hàm kết thúc (như \`Object\`, \`Array\`, \`Function Closure\`, \`Class Instance\`) đều được cấp phát trên **V8 Heap**. Trên Stack lúc này chỉ lưu một **con trỏ tham chiếu (Reference Pointer)** chứa địa chỉ ô nhớ của đối tượng đó trên Heap.

Để thu hồi các đối tượng không còn sử dụng mà không làm dừng luồng thực thi chính quá lâu (Stop-The-World Pause), V8 thiết kế bộ nhớ Heap dựa trên **Giả thuyết thế hệ (Weak Generational Hypothesis)**: *Trong hầu hết các chương trình máy tính, phần lớn các đối tượng được cấp phát đều có vòng đời rất ngắn và trở thành rác ngay sau khi hoàn tất tác vụ ngắn hạn*. Từ giả thuyết này, V8 chia Heap thành hai thế hệ chính:

1. **Phân vùng thế hệ trẻ (Young Generation / New Space — Dung lượng \`16 MB – 64 MB\`):**
   - Là nơi tiếp nhận hầu hết các đối tượng mới khởi tạo (như đối tượng \`req\`, \`res\`, DTO kiểm tra dữ liệu, kết quả truy vấn tạm thời trong một HTTP request).
   - Được chia thành hai nửa bằng nhau gọi là **Semi-spaces**: \`From-Space\` (vùng đang hoạt động) và \`To-Space\` (vùng dự phòng trống).
   - **Cấp phát con trỏ tịnh tiến (Bump-pointer Allocation):** V8 duy trì một con trỏ cấp phát tại \`From-Space\`. Khi tạo đối tượng mới, V8 chỉ việc dịch con trỏ này đi một đoạn bằng kích thước đối tượng, đạt tốc độ cấp phát gần tương đương với Stack.
   - **Thu gom rác thế hệ trẻ (Minor GC / Scavenger):** Khi \`From-Space\` đầy, V8 kích hoạt thuật toán sao chép của Cheney (**Cheney's Copying Algorithm**). Bộ thu gom rác bắt đầu từ các gốc tham chiếu (**GC Roots** — bao gồm các biến trên Call Stack hiện tại và các biến toàn cục), tìm các đối tượng vẫn còn đang được trỏ tới trên \`From-Space\` và sao chép chúng sang nằm liền kề nhau bên \`To-Space\`. Đối với một máy chủ xử lý HTTP, các request đã trả xong kết quả sẽ không còn nằm trên Call Stack, do đó 90%–95% đối tượng của các request cũ không còn đường dẫn từ GC Roots và bị bỏ lại. Cuối cùng, V8 xóa trắng toàn bộ \`From-Space\` chỉ bằng một thao tác đặt lại con trỏ và hoán đổi vai trò giữa \`From-Space\` và \`To-Space\`. Quá trình này chỉ mất từ \`1 ms\` đến vài mili-giây.
2. **Phân vùng thế hệ già (Old Generation / Old Space — Mặc định \`~1.4 GB – 4 GB\`, cấu hình qua \`--max-old-space-size\`):**
   - Những đối tượng sống sót qua **2 chu kỳ Minor GC liên tiếp** ở Young Generation (hoặc các đối tượng lớn) sẽ được thăng cấp (**Promotion**) sang \`Old Generation\`. Trong ứng dụng NestJS, vùng này chứa các đối tượng \`Singleton Controller/Service\`, cấu hình hệ thống, bể kết nối cơ sở dữ liệu (Connection Pools), bộ nhớ đệm nội bộ (In-memory Cache), và các đối tượng bị rò rỉ bộ nhớ.
   - **Thu gom rác thế hệ già (Major GC / Mark-Sweep-Compact):** Do dung lượng \`Old Generation\` lên tới hàng Gigabyte, V8 không thể dùng phương pháp chia đôi bộ nhớ để sao chép như ở Young Generation mà phải kết hợp 3 pha xử lý:
 - **Mark (Đánh dấu):** Sử dụng thuật toán đánh dấu ba màu (**Tri-color Marking — Trắng, Xám, Đen**) duyệt theo chiều sâu từ \`GC Roots\` qua toàn bộ đồ thị đối tượng để đánh dấu màu Đen cho các đối tượng còn đang được sử dụng.
 - **Sweep (Quét thu hồi):** Quét qua vùng nhớ để đưa các khoảng trống của những đối tượng màu Trắng (đối tượng mồ côi không còn tham chiếu) vào danh sách vùng nhớ tự do (**Free-lists**) phục vụ cho các lần cấp phát sau.
 - **Compact (Dồn nén chống phân mảnh):** Khi các trang nhớ bị phân mảnh nhiều lỗ chỗ sau nhiều lần xóa, V8 di chuyển các đối tượng còn sống về sát nhau để tạo ra vùng nhớ trống liên tục.
   - Nếu ứng dụng bị rò rỉ bộ nhớ khiến \`Old Generation\` bị lấp đầy và Major GC không thể thu hồi thêm dung lượng, tiến trình sẽ dừng hoạt động với lỗi \`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\`.

### 3.3 Bộ nhớ ngoài V8 Heap (C++ External Memory) và phương pháp chẩn đoán rò rỉ bộ nhớ

Bên cạnh Stack và V8 Heap, phân vùng thứ ba quyết định sự sống còn của tiến trình là **C++ Non-Heap (External Memory)**.

Khi ứng dụng Node.js xử lý tệp tin, luồng mạng hoặc dữ liệu nhị phân thông qua lớp \`Buffer\` (ví dụ: \`Buffer.alloc(50 * 1024 * 1024)\` hoặc \`fs.readFileSync()\`), công cụ nén \`zlib\`, hàm mã hóa \`crypto\`, hoặc thực thi truy vấn qua **Prisma Query Engine** (bộ máy viết bằng Rust biên dịch ra thư viện C++ Native Addon), toàn bộ khối dữ liệu nhị phân đó được cấp phát trực tiếp từ hệ điều hành bằng lời gọi \`malloc()\` ở tầng C++ chứ không nằm trong V8 Heap. Trên V8 Heap chỉ lưu một đối tượng vỏ bọc nhỏ (JavaScript Wrapper Object khoảng vài chục Bytes) chứa con trỏ địa chỉ trỏ ra vùng nhớ C++ đó.

Thiết kế này giúp bộ thu gom rác của V8 không phải tốn CPU để di chuyển các khối nhị phân hàng chục Megabyte trong các pha Scavenge hay Compact. Tuy nhiên, nó cũng dẫn đến hệ quả là vùng nhớ \`External\` không bị giới hạn bởi cờ \`--max-old-space-size\`.

Bảng dưới đây cung cấp phương pháp đọc và chẩn đoán chính xác 5 chỉ số trả về từ hàm \`process.memoryUsage()\` (đơn vị tính bằng Byte):

| Trường thông số | Công thức & Bản chất kỹ thuật | Phương pháp đọc triệu chứng và định vị nguyên nhân lỗi trên Production |
| :--- | :--- | :--- |
| **\`rss\`** | Tổng dung lượng RAM vật lý mà hệ điều hành đang cấp cho tiến trình (\`RSS = V8 Heap Total + Stack + C++ External + Mã thực thi & Thư viện liên kết\`) | Chỉ số quyết định việc container có bị hệ điều hành giết (\`OOMKilled - Exit Code 137\`) hay không; bắt buộc phải đặt cảnh báo khi \`rss\` vượt 85% giới hạn RAM của container |
| **\`heapTotal\`** | Tổng dung lượng các trang nhớ mà V8 Engine đã xin hệ điều hành cấp phát cho khu vực Heap (bao gồm cả vùng đang chứa đối tượng và vùng dự phòng trống) | Phản ánh quy mô bộ nhớ V8 đã cam kết; chỉ số này tăng lên khi lưu lượng truy cập tăng và giảm xuống sau khi Major GC trả lại các trang nhớ trống cho hệ điều hành |
| **\`heapUsed\`** | Tổng dung lượng thực tế đang bị chiếm giữ bởi các đối tượng JavaScript còn sống trên cả \`Young Generation\` và \`Old Generation\` (\`heapUsed <= heapTotal\`) | Dùng để phát hiện rò rỉ bộ nhớ ở tầng code TypeScript/JS: nếu đồ thị \`heapUsed\` có dạng răng cưa nhưng đáy sau luôn cao hơn đáy trước qua từng chu kỳ GC, đang có biến toàn cục hoặc Singleton tích trữ đối tượng không giải phóng |
| **\`external\`** | Tổng dung lượng bộ nhớ của các đối tượng C++ nằm ngoài V8 Heap nhưng được gắn kết vòng đời với các đối tượng vỏ bọc JavaScript (bao gồm cả \`Buffer\`) | Nếu \`heapUsed\` phẳng và thấp nhưng \`external\` cùng \`rss\` tăng vọt, nguyên nhân nằm ở việc nạp toàn bộ tệp tin lớn/báo cáo vào \`Buffer\` trong RAM thay vì xử lý theo luồng (\`Readable/Writable Stream\`) |
| **\`arrayBuffers\`** | Dung lượng bộ nhớ cấp phát riêng cho các đối tượng \`ArrayBuffer\` và \`SharedArrayBuffer\` (đây là một tập con đã được tính bên trong \`external\`) | Tăng đột biến khi ứng dụng thực hiện chuyển đổi dữ liệu nhị phân hàng loạt (xử lý Excel, PDF, hình ảnh) hoặc truyền dữ liệu qua lại với \`Worker Threads\` |

> **Tổng kết học thuật Phần 3 (Quy tắc lập ngân sách bộ nhớ - Container Memory Budgeting):**
> Khi triển khai tiến trình Node.js/NestJS trên Docker hoặc Kubernetes, tổng giới hạn RAM của Container (\`Container Limit\`) luôn phải đủ chứa cả 4 thành phần:
> \`Container Limit >= Old Generation (--max-old-space-size) + Young Generation (~64 MB) + C++ External / Buffers + Stack & Runtime Binary (~100 MB)\`
> Do đó, quy tắc chuẩn trong kỹ thuật vận hành là cấu hình \`--max-old-space-size\` ở mức **70% đến 75%** dung lượng RAM tối đa của Container (ví dụ: với Container giới hạn \`1024 MB\`, thiết lập \`NODE_OPTIONS="--max-old-space-size=768"\`), dành 25%–30% dung lượng còn lại làm vùng đệm an toàn cho \`C++ External Memory\`, \`Buffer\` và \`Young Generation\`.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống (System Taxonomy Map)
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

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Đa Kết Nối (Thread-per-Request vs Event Loop)
\`\`\`diagram
MÔ HÌNH CŨ: THREAD-PER-REQUEST (APACHE / PHP-FPM)
Client 1 ──► [ OS Thread 1 (2MB Stack) ] ──► Chờ I/O ──► CPU BỊ NGHẼN KHÔNG LÀM GÌ
Client 2 ──► [ OS Thread 2 (2MB Stack) ] ──► Chờ I/O ──► CPU BỊ NGHẼN KHÔNG LÀM GÌ
10,000 Users = Tốn 20GB RAM chỉ để giữ các luồng ngủ.

MÔ HÌNH HIỆN ĐẠI: EVENT LOOP & NON-BLOCKING I/O (NODE.JS / NESTJS)
Client 1 ──┐
Client 2 ──┼──► [ 1 Main Thread Duy Nhất ] ──► Giao I/O cho OS Kernel (epoll)
Client 3 ──┘           │                         Main Thread lập tức rảnh tay
                   └──► Luôn hoạt động ────► đón tiếp Client 4, 5, 6...
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Phân Vùng Bộ Nhớ V8)
\`\`\`diagram
                 DỮ LIỆU TIẾN TRÌNH NẰM Ở ĐÂU TRONG RAM TIẾN TRÌNH?
                                         │
                                         ▼
                            Kiểu dữ liệu là gì?
                            /                 \\
              NGUYÊN THỦY (Number, Bool, Con trỏ)   PHỨC HỢP (Object, Array, Closure)
                           /                                   \\
                          ▼                                     ▼
                 [ V8 STACK MEMORY ]                 Tuổi thọ của đối tượng?
                 - Cấp phát tức thì (LIFO)            /                   \\
                 - Tự động pop khi hết hàm       DƯỚI 2 CHU KỲ GC        SỐNG LÂU / SINGLETON
                 - 0% áp lực lên GC                      /                         \\
                                                        ▼                           ▼
                                               [ YOUNG GENERATION ]         [ OLD GENERATION ]
                                               - Vùng From / To             - Mark-Sweep-Compact
                                               - Thuật toán Scavenge        - Chống phân mảnh
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Concurrency Models Matrix)

| Tiêu Chí So Sánh | Thread-per-Request (Truyền thống) | Coroutine / Green Threads (Go / Java Loom) | Single-threaded Event Loop (Node.js) |
| :--- | :--- | :--- | :--- |
| **Tiêu tốn bộ nhớ / kết nối** | Rất cao (~1-2MB / Thread) | Rất thấp (~2-4KB / Goroutine) | Tối thiểu (~vài trăm bytes socket) |
| **Chi phí Context Switch** | Cao (Lưu registers, TLB flush) | Thấp (Chuyển ngữ cảnh ở User-space) | Không phát sinh giữa các request |
| **Tận dụng CPU Multi-core** | Tự động phân bổ qua OS Threads | Tự động phân bổ M:N trên các lõi | Cần chạy Cluster Mode hoặc nhiều Pods |
| **Rủi ro sập hệ thống** | Cạn kiệt RAM khi số kết nối tăng đột biến | Dễ phát sinh Race Condition trên vùng nhớ chung | Nghẽn toàn bộ tiến trình nếu có vòng lặp chiếm CPU |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`HealthController\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề cô lập trạng thái trên tiến trình dài hạn:** Trong kiến trúc Long-Running Process, không gian bộ nhớ V8 Heap và các đối tượng Singleton Service được chia sẻ giữa toàn bộ người dùng. Dù mã nguồn chạy trên một luồng duy nhất, sự đan xen thực thi tại các điểm tạm dừng \`await\` sẽ làm rò rỉ dữ liệu giữa các yêu cầu nếu lưu trữ biến trạng thái trực tiếp trên thuộc tính của Singleton.
2. **Định đề bảo toàn luồng sự kiện chính:** Thông lượng của máy chủ đơn luồng hướng sự kiện phụ thuộc vào việc từng nhịp thực thi trên Main Thread phải kết thúc trong thời gian cực ngắn. Mọi tác vụ tính toán đồng bộ kéo dài (CPU-bound) đều làm tăng độ trễ hàng đợi theo cấp số nhân cho toàn bộ các kết nối đang mở, kể cả các endpoint giám sát hạ tầng (\`/health\`, \`/ready\`).
3. **Định đề đa hợp I/O cấp nhân (\`epoll\` / \`kqueue\`):** Khả năng xử lý 10,000 kết nối đồng thời (C10K) của Node.js đạt được nhờ việc loại bỏ hoàn toàn mô hình cấp phát ngăn xếp \`1–2 MB\` cho mỗi luồng chờ và loại bỏ hiện tượng trượt bộ nhớ đệm (\`CPU Cache / TLB Thrashing\`) do chuyển đổi ngữ cảnh. Thay vào đó, nhân hệ điều hành theo dõi các File Descriptors thông qua Cây Đỏ-Đen và chỉ đánh thức Event Loop qua danh sách sẵn sàng (\`Ready List\`) với độ phức tạp \`O(1)\`.
4. **Định đề toàn vẹn bộ nhớ tiến trình (\`RSS\`):** Giới hạn \`--max-old-space-size\` chỉ kiểm soát phân vùng \`Old Generation\` của V8 Heap. Để ngăn chặn sự cố \`OOMKilled (Exit Code 137)\` trên môi trường Container, kỹ sư bắt buộc phải giám sát tổng dung lượng \`RSS\` — bao gồm cả \`V8 Stack\`, \`Young Generation\` và vùng nhớ \`C++ Non-Heap (External / Buffers)\`.
  `,
  realCodeSnippet: `// File: src/health/health.controller.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Probe Giám Sát Hạ Tầng & Kết Nối Mạng TCP
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
        'Vì hệ điều hành giới hạn bảng mô tả tệp tin (ulimit -n) khiến nhân Linux tự động hủy toàn bộ gói tin TCP SYN khi số kết nối vượt quá hàng đợi backlog của socket mạng.',
        'Vì mỗi OS Thread ngốn 1-2MB RAM Stack riêng (10K threads tốn 10-20GB RAM) và chi phí Context Switching liên tục làm mất hiệu lực bộ nhớ đệm CPU (Cache Thrashing).',
        'Vì nhân Linux sử dụng cơ chế Spinlock toàn cục trên bảng định tuyến mạng, khiến hàng nghìn luồng bị kẹt trong trạng thái Uninterruptible Sleep (D-state) tranh chấp mutex.',
        'Vì thời gian chuyển đổi ngữ cảnh giữa các luồng tăng theo hàm lũy thừa O(2^N), làm cạn kiệt 100% băng thông thanh ghi CPU bất kể dung lượng bộ nhớ RAM vật lý còn trống.'
      ],
      correctIndex: 1,
      explanation: 'Mỗi thread của Linux cần 1-2MB bộ nhớ Stack riêng biệt. 10,000 kết nối làm mất 10-20GB RAM chỉ để chứa call stack rỗng. Đồng thời, CPU tốn phần lớn chu kỳ chỉ để lưu/nạp thanh ghi và làm mất hiệu lực CPU Cache L1/L2 (Context Switching Overhead).'
    },
    {
      id: 'c1-l1-q2',
      question: 'Chỉ số process.memoryUsage().external trong Node.js phản ánh phân vùng bộ nhớ thực tế nào sau đây của tiến trình?',
      options: [
        'Bộ nhớ thuộc phân vùng Large Object Space của V8 Heap dùng để lưu trữ trực tiếp các mảng và chuỗi ký tự JavaScript có kích thước vượt quá ngưỡng 512KB trên máy chủ.',
        'Bộ nhớ dùng chung (Shared Memory) được cấp phát qua đối tượng SharedArrayBuffer để truyền dữ liệu nhị phân không qua sao chép giữa các luồng Worker Threads độc lập.',
        'Bộ nhớ cấp phát bằng malloc ở tầng C++ nằm ngoài V8 Heap (điển hình như dữ liệu nhị phân của Buffer, ngữ cảnh mã hóa của module crypto, và các luồng nén zlib).',
        'Dung lượng bộ nhớ ảo (Virtual Memory) của tiến trình đã bị nhân hệ điều hành hoán đổi (swap) ra ổ đĩa NVMe khi máy chủ chạm ngưỡng cạn kiệt bộ nhớ vật lý.'
      ],
      correctIndex: 2,
      explanation: 'Chỉ số external phản ánh bộ nhớ C++ malloc nằm ngoài V8 Heap. Điển hình nhất là các đối tượng Buffer: trên V8 Heap nó chỉ là JS wrapper nhỏ ~32 bytes, nhưng dữ liệu nhị phân thực tế lại nằm trong vùng nhớ external C++ này, không chịu sự quản lý trực tiếp của giới hạn max-old-space-size.'
    },
    {
      id: 'c1-l1-q3',
      question: 'Khác biệt căn bản nhất giữa cơ chế giải phóng bộ nhớ trên Stack Memory và Heap Memory của V8 Engine là gì?',
      options: [
        'Stack giải phóng tức thì theo LIFO bằng phép dịch con trỏ thanh ghi RSP khi kết thúc hàm (0% GC overhead), còn Heap cấp phát động nên cần Garbage Collector duyệt đồ thị tham chiếu.',
        'Stack phân bổ các đối tượng có kích thước biến động và được dọn dẹp bằng thuật toán Cheney Scavenge, trong khi Heap chỉ lưu địa chỉ trả về cố định và được CPU thu hồi tự động.',
        'Stack thu hồi bộ nhớ bằng cách đếm số lượng con trỏ tham chiếu (Reference Counting) ngay khi biến ra khỏi block scope, trong khi Heap chỉ dọn dẹp khi tiến trình nhận tín hiệu dừng.',
        'Stack sử dụng cơ chế bảo vệ phân trang nhớ (Memory Page Protection) của nhân Linux để đánh dấu vùng nhớ khả dụng, còn Heap sử dụng bảng băm con trỏ nội bộ để ghi đè dữ liệu cũ.'
      ],
      correctIndex: 0,
      explanation: 'Stack Memory hoạt động theo cơ chế LIFO: khi một hàm kết thúc, con trỏ Stack Pointer của CPU chỉ việc lùi lại (pop stack frame) để giải phóng toàn bộ vùng nhớ của hàm đó trong 1 chu kỳ xung nhịp. Heap Memory phân bổ động nên bắt buộc phải có GC chạy thuật toán quét đồ thị tham chiếu phức tạp.'
    },
    {
      id: 'c1-l1-q4',
      question: 'Hiện tượng CPU Cache Thrashing (mất hiệu lực bộ nhớ đệm CPU L1/L2/L3) xảy ra nghiêm trọng nhất trong tình huống nào đối với các máy chủ I/O?',
      options: [
        'Khi luồng thực thi duyệt một mảng 2 chiều theo thứ tự cột thay vì hàng trên bộ nhớ Heap, làm dữ liệu nạp vào mỗi dòng Cache Line 64-byte không được tái sử dụng.',
        'Khi hai luồng phần cứng chạy trên hai lõi CPU khác nhau cùng cập nhật hai biến nguyên thủy độc lập nhưng vô tình nằm chung trên một dòng Cache Line vật lý (False Sharing).',
        'Khi tiến trình truy cập vào các trang bộ nhớ ảo chưa được ánh xạ vào RAM vật lý, buộc bộ điều khiển MMU phải dừng luồng thực thi để đọc dữ liệu từ ổ cứng qua Page Fault.',
        'Khi hệ thống duy trì quá nhiều OS Threads khiến CPU liên tục chuyển đổi ngữ cảnh (Context Switching), phải nạp/xả thanh ghi và làm mất tính cục bộ dữ liệu trên L1/L2 Cache.'
      ],
      correctIndex: 3,
      explanation: 'Khi CPU chuyển từ Thread A sang Thread B, dữ liệu của Thread A trên L1/L2 Cache trở nên vô dụng và bị đẩy ra ngoài để nạp dữ liệu của Thread B vào. Khi quay lại Thread A, CPU lại bị Cache Miss và phải đọc từ RAM (chậm hơn 100 lần). Kiến trúc đơn luồng Event Loop của Node.js giữ vững Cache Locality tối ưu trên CPU core.'
    },
    {
      id: 'c1-l1-q5',
      question: 'Tại sao việc lưu trữ dữ liệu của request vào thuộc tính của một Singleton Service trong NestJS (ví dụ: this.currentUser = req.user) lại dẫn đến sự cố bảo mật rò rỉ dữ liệu chéo (Cross-tenant Data Bleed) ngay cả trên môi trường đơn luồng của Node.js?',
      options: [
        'Vì đối tượng currentUser bị đẩy thẳng vào phân vùng Old Generation của V8 Heap khiến bộ thu gom rác không thể giải phóng, làm tràn bộ nhớ máy chủ sau vài nghìn truy vấn.',
        'Vì các luồng Worker Threads trong bể luồng Libuv của Node.js cùng lúc ghi dữ liệu vào cùng một địa chỉ thuộc tính của đối tượng Service mà không có khóa đồng bộ Mutex.',
        'Vì Singleton Service chỉ có một instance duy nhất; khi một request tạm dừng tại điểm await chờ I/O, Event Loop sẽ chạy request khác xen vào và ghi đè lên thuộc tính dùng chung đó.',
        'Vì NestJS IoC Container tự động sao chép nông (shallow clone) đối tượng Service mỗi khi phát hiện thay đổi thuộc tính, làm hỏng toàn bộ cây phụ thuộc Dependency Injection.'
      ],
      correctIndex: 2,
      explanation: 'Trong kiến trúc Long-Running Process của NestJS, các Service mặc định là Singleton. Mọi request đều dùng chung một instance duy nhất. Khi một request gặp điểm await (I/O chờ DB), Event Loop nhường quyền cho request khác. Request thứ hai ghi đè this.currentUser. Khi request một tiếp tục chạy, nó sẽ đọc dữ liệu của request hai, dẫn đến rò rỉ dữ liệu chéo rất nghiêm trọng.'
    },
    {
      id: 'c1-l1-q6',
      question: 'Cơ chế nào ở tầng nhân hệ điều hành (OS Kernel) giúp Libuv và Node.js giám sát hàng chục nghìn kết nối mạng đồng thời mà không làm tiêu hao chu kỳ CPU khi các kết nối đang rảnh rỗi (Idle)?',
      options: [
        'Sử dụng lời gọi hệ thống select() hoặc poll() để duyệt tuần tự với độ phức tạp O(N) qua toàn bộ mảng file descriptors trong một vòng lặp liên tục ở không gian người dùng.',
        'Sử dụng syscall I/O Multiplexing hướng sự kiện (epoll trên Linux, kqueue trên macOS) giúp tiến trình nghỉ và chỉ được nhân đánh thức với độ phức tạp O(1) khi socket có dữ liệu.',
        'Sử dụng giao diện POSIX AIO (aio_read/aio_write) bắt buộc nhân hệ điều hành tự động khởi tạo một luồng kernel thread riêng biệt cho từng socket TCP để chờ dữ liệu ngầm.',
        'Sử dụng kỹ thuật Kernel Bypass (DPDK) truyền các gói tin trực tiếp từ card mạng vật lý NIC vào vùng nhớ Heap của V8 mà không đi qua ngăn xếp TCP/IP của hệ điều hành.'
      ],
      correctIndex: 1,
      explanation: 'Node.js đạt hiệu năng C10K nhờ Libuv sử dụng các syscall I/O Multiplexing phi chặn của Kernel (epoll trên Linux, kqueue trên macOS/BSD, IOCP trên Windows). Thay vì tốn CPU thăm dò O(N), hệ điều hành sẽ đưa tiến trình vào trạng thái ngủ và chỉ đánh thức Event Loop khi có sự kiện mạng thực sự xảy ra trên socket.'
    },
    {
      id: 'c1-l1-q7',
      question: 'Khi dung lượng phân vùng Old Generation của V8 Heap chạm ngưỡng giới hạn mặc định (~1.4GB trên máy chủ 64-bit), điều gì sẽ xảy ra và cờ tham số nào của Node.js giúp mở rộng giới hạn này?',
      options: [
        'V8 sẽ di chuyển toàn bộ đối tượng còn sống sang phân vùng To-Space của Young Generation; kỹ sư có thể mở rộng dung lượng phân vùng này thông qua cờ --max-semi-space-size.',
        'Node.js tự động khởi tạo thêm các luồng Worker Thread chạy ngầm để chia sẻ bớt các đối tượng trên Heap; có thể cấu hình ngưỡng này qua cờ --experimental-worker-memory.',
        'Nhân hệ điều hành tự động nén và hoán đổi phân vùng bộ nhớ Old Generation ra phân vùng swap trên ổ đĩa cứng; có thể điều chỉnh hạn mức qua cờ --max-swap-allocation.',
        'V8 chạy liên tục các chu kỳ Major GC nhưng không thu hồi thêm được vùng nhớ trống, khiến tiến trình dừng với lỗi "JavaScript heap out of memory"; mở rộng qua cờ --max-old-space-size.'
      ],
      correctIndex: 3,
      explanation: 'Mặc định trên kiến trúc 64-bit, V8 giới hạn Old Generation ở mức ~1.4GB để đảm bảo thời gian tạm dừng thu gom rác (GC pause time) không vượt quá ngưỡng chấp nhận được của trình duyệt. Trên máy chủ backend, nếu cần xử lý dữ liệu lớn, ta dùng cờ --max-old-space-size=4096 (để cấp 4GB RAM) hoặc cấu hình trong môi trường container.'
    },
    {
      id: 'c1-l1-q8',
      question: 'Ý nghĩa kỹ thuật chính xác của chỉ số Resident Set Size (RSS) khi so sánh với Heap Total trong telemetry của Node.js là gì?',
      options: [
        'RSS là tổng RAM vật lý thực tế mà OS cấp cho tiến trình (gồm V8 Heap, C++ External, Stack và mã thực thi), còn Heap Total chỉ là vùng nhớ V8 đã xin cấp riêng cho đối tượng JS.',
        'RSS là tổng không gian địa chỉ bộ nhớ ảo (Virtual Memory Size) mà tiến trình đăng ký với nhân Linux, trong khi Heap Total là dung lượng trang RAM vật lý thực tế đang chiếm giữ.',
        'RSS là phần bộ nhớ dùng chung giữa tiến trình Node.js và các tiến trình khác trong cùng Linux cgroups, trong khi Heap Total là bộ nhớ riêng tư độc quyền của trình biên dịch V8.',
        'RSS chỉ thống kê dung lượng của các đối tượng Buffer nhị phân và thư viện C++ Native Addons, trong khi Heap Total bao gồm toàn bộ mã thực thi và ngăn xếp Call Stack của tiến trình.'
      ],
      correctIndex: 0,
      explanation: 'RSS (Resident Set Size) là dung lượng RAM vật lý thực tế mà OS cấp phát cho toàn bộ tiến trình. Nó bao gồm V8 Heap (heapTotal/heapUsed), bộ nhớ C++ malloc (external, Buffer), Call Stack của các thread, và chính mã nhị phân thực thi của Node.js runtime. Giám sát RSS là cách duy nhất để ngăn chặn container bị OOMKilled.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Quy Đổi V8 Heap & Phân Loại Trạng Thái Bộ Nhớ',
    description: 'Trong Node.js, `process.memoryUsage().heapUsed` trả về dung lượng bộ nhớ theo đơn vị **Bytes**, trong khi cờ cấu hình `--max-old-space-size` lại tính bằng **Megabytes (MB)**. Hãy viết hàm `checkHeapStatus(heapUsedBytes, maxHeapMb)` để quy đổi `heapUsedBytes` sang MB (`heapUsedMb`), tính tỷ lệ phần trăm sử dụng (`usagePercent`), và phân loại trạng thái `status` theo 3 ngưỡng: `"CRITICAL"` nếu `usagePercent >= 85`, `"WARNING"` nếu `70 <= usagePercent < 85`, và `"HEALTHY"` nếu `< 70`. Mọi số thực trả về đều làm tròn đến 2 chữ số thập phân.',
    guidedSteps: [
      'Bước 1 (Quy đổi Bytes sang MB): Lấy `heapUsedBytes` chia cho `1024 * 1024`, sau đó làm tròn 2 chữ số thập phân bằng công thức `Math.round(val * 100) / 100` để lưu vào biến `heapUsedMb`.',
      'Bước 2 (Tính phần trăm sử dụng): Lấy `(heapUsedMb / maxHeapMb) * 100`, rồi tiếp tục làm tròn 2 chữ số thập phân bằng `Math.round(val * 100) / 100` để lưu vào `usagePercent`.',
      'Bước 3 (Phân loại ngưỡng cảnh báo): Kiểm tra nếu `usagePercent >= 85` thì `status = "CRITICAL"`; ngược lại nếu `usagePercent >= 70` thì `status = "WARNING"`; còn lại `status = "HEALTHY"`.',
      'Bước 4 (Đóng gói kết quả): Trả về object `{ heapUsedMb, usagePercent, status }` đúng tên thuộc tính như đặc tả Input/Output bên dưới.'
    ],
    hints: [
      '`1 MB = 1024 KB = 1024 * 1024 Bytes = 1,048,576 Bytes`. Ví dụ: `524288000 / (1024 * 1024) = 500 MB`.',
      'Để làm tròn số `x` đến 2 chữ số thập phân và giữ nguyên kiểu dữ liệu `number`, hãy dùng: `Math.round(x * 100) / 100`. Không dùng `x.toFixed(2)` vì hàm đó trả về kiểu `string`.'
    ],
    starterCode: `function checkHeapStatus(heapUsedBytes, maxHeapMb) {
  // Bước 1: Quy đổi heapUsedBytes sang MB (chia cho 1024 * 1024) và làm tròn 2 chữ số thập phân
  
  // Bước 2: Tính phần trăm sử dụng (heapUsedMb / maxHeapMb) * 100 và làm tròn 2 chữ số thập phân
  
  // Bước 3: Xác định status ("HEALTHY" | "WARNING" | "CRITICAL")
  
  // Bước 4: Trả về { heapUsedMb, usagePercent, status }
}`,
    solution: `function checkHeapStatus(heapUsedBytes, maxHeapMb) {
  const round2 = (num) => Math.round(num * 100) / 100;
  const heapUsedMb = round2(heapUsedBytes / (1024 * 1024));
  const usagePercent = round2((heapUsedMb / maxHeapMb) * 100);

  let status = 'HEALTHY';
  if (usagePercent >= 85) {
status = 'CRITICAL';
  } else if (usagePercent >= 70) {
status = 'WARNING';
  }

  return {
heapUsedMb,
usagePercent,
status
  };
}`,
    testCases: [
      {
        name: 'Trạng thái HEALTHY (Sử dụng 500MB / 1000MB = 50%)',
        input: [524288000, 1000],
        expected: { heapUsedMb: 500, usagePercent: 50, status: 'HEALTHY' },
        hidden: false
      },
      {
        name: 'Trạng thái WARNING (Sử dụng 750MB / 1000MB = 75%)',
        input: [786432000, 1000],
        expected: { heapUsedMb: 750, usagePercent: 75, status: 'WARNING' },
        hidden: false
      },
      {
        name: 'Trạng thái CRITICAL (Sử dụng 900MB / 1000MB = 90%)',
        input: [943718400, 1000],
        expected: { heapUsedMb: 900, usagePercent: 90, status: 'CRITICAL' },
        hidden: false
      },
      {
        name: 'Biên chính xác 85% -> Phải kích hoạt CRITICAL',
        input: [891289600, 1000],
        expected: { heapUsedMb: 850, usagePercent: 85, status: 'CRITICAL' },
        hidden: true
      },
      {
        name: 'Làm tròn số thập phân lẻ (300MB / 1024MB = 29.3%)',
        input: [314572800, 1024],
        expected: { heapUsedMb: 300, usagePercent: 29.3, status: 'HEALTHY' },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Quy Đổi V8 Heap & Phân Loại Trạng Thái Bộ Nhớ',
      description: 'Trong Node.js, `process.memoryUsage().heapUsed` trả về dung lượng bộ nhớ theo đơn vị **Bytes**, trong khi cờ cấu hình `--max-old-space-size` lại tính bằng **Megabytes (MB)**. Hãy viết hàm `checkHeapStatus(heapUsedBytes, maxHeapMb)` để quy đổi `heapUsedBytes` sang MB (`heapUsedMb`), tính tỷ lệ phần trăm sử dụng (`usagePercent`), và phân loại trạng thái `status` theo 3 ngưỡng: `"CRITICAL"` nếu `usagePercent >= 85`, `"WARNING"` nếu `70 <= usagePercent < 85`, và `"HEALTHY"` nếu `< 70`. Mọi số thực trả về đều làm tròn đến 2 chữ số thập phân.',
      guidedSteps: [
        'Bước 1 (Quy đổi Bytes sang MB): Lấy `heapUsedBytes` chia cho `1024 * 1024`, sau đó làm tròn 2 chữ số thập phân bằng công thức `Math.round(val * 100) / 100` để lưu vào biến `heapUsedMb`.',
        'Bước 2 (Tính phần trăm sử dụng): Lấy `(heapUsedMb / maxHeapMb) * 100`, rồi tiếp tục làm tròn 2 chữ số thập phân bằng `Math.round(val * 100) / 100` để lưu vào `usagePercent`.',
        'Bước 3 (Phân loại ngưỡng cảnh báo): Kiểm tra nếu `usagePercent >= 85` thì `status = "CRITICAL"`; ngược lại nếu `usagePercent >= 70` thì `status = "WARNING"`; còn lại `status = "HEALTHY"`.',
        'Bước 4 (Đóng gói kết quả): Trả về object `{ heapUsedMb, usagePercent, status }` đúng tên thuộc tính như đặc tả Input/Output bên dưới.'
      ],
      hints: [
        '`1 MB = 1024 KB = 1024 * 1024 Bytes = 1,048,576 Bytes`. Ví dụ: `524288000 / (1024 * 1024) = 500 MB`.',
        'Để làm tròn số `x` đến 2 chữ số thập phân và giữ nguyên kiểu dữ liệu `number`, hãy dùng: `Math.round(x * 100) / 100`. Không dùng `x.toFixed(2)` vì hàm đó trả về kiểu `string`.'
      ],
      starterCode: `function checkHeapStatus(heapUsedBytes, maxHeapMb) {
  // Bước 1: Quy đổi heapUsedBytes sang MB (chia cho 1024 * 1024) và làm tròn 2 chữ số thập phân
  
  // Bước 2: Tính phần trăm sử dụng (heapUsedMb / maxHeapMb) * 100 và làm tròn 2 chữ số thập phân
  
  // Bước 3: Xác định status ("HEALTHY" | "WARNING" | "CRITICAL")
  
  // Bước 4: Trả về { heapUsedMb, usagePercent, status }
}`,
      solution: `function checkHeapStatus(heapUsedBytes, maxHeapMb) {
  const round2 = (num) => Math.round(num * 100) / 100;
  const heapUsedMb = round2(heapUsedBytes / (1024 * 1024));
  const usagePercent = round2((heapUsedMb / maxHeapMb) * 100);

  let status = 'HEALTHY';
  if (usagePercent >= 85) {
status = 'CRITICAL';
  } else if (usagePercent >= 70) {
status = 'WARNING';
  }

  return {
heapUsedMb,
usagePercent,
status
  };
}`,
      testCases: [
        {
          name: 'Trạng thái HEALTHY (Sử dụng 500MB / 1000MB = 50%)',
          input: [524288000, 1000],
          expected: { heapUsedMb: 500, usagePercent: 50, status: 'HEALTHY' },
          hidden: false
        },
        {
          name: 'Trạng thái WARNING (Sử dụng 750MB / 1000MB = 75%)',
          input: [786432000, 1000],
          expected: { heapUsedMb: 750, usagePercent: 75, status: 'WARNING' },
          hidden: false
        },
        {
          name: 'Trạng thái CRITICAL (Sử dụng 900MB / 1000MB = 90%)',
          input: [943718400, 1000],
          expected: { heapUsedMb: 900, usagePercent: 90, status: 'CRITICAL' },
          hidden: false
        },
        {
          name: 'Biên chính xác 85% -> Phải kích hoạt CRITICAL',
          input: [891289600, 1000],
          expected: { heapUsedMb: 850, usagePercent: 85, status: 'CRITICAL' },
          hidden: true
        },
        {
          name: 'Làm tròn số thập phân lẻ (300MB / 1024MB = 29.3%)',
          input: [314572800, 1024],
          expected: { heapUsedMb: 300, usagePercent: 29.3, status: 'HEALTHY' },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Hình Hàng Đợi M/M/1 & Dự Báo Độ Trễ Event Loop',
      description: 'Áp dụng mô hình hàng đợi đơn kênh **M/M/1** đã học ở Phần 1 để tính độ trễ phản hồi trên luồng Event Loop duy nhất của Node.js. Viết hàm `analyzeEventLoopQueue(arrivalRateLambda, cpuTimePerReqMs)` nhận vào tốc độ request đi vào hệ thống `arrivalRateLambda` (req/giây) và thời gian xử lý CPU đồng bộ của mỗi request `cpuTimePerReqMs` (mili-giây). Hãy tính: năng lực xử lý tối đa `capacityMu` (`μ = 1000 / cpuTimePerReqMs`), hệ số tải `utilizationRho` (`ρ = arrivalRateLambda / μ`), cờ quá tải `isOverloaded` (`true` nếu `arrivalRateLambda >= μ`), và tổng độ trễ kỳ vọng `expectedLatencyMs` (`1000 / (μ - arrivalRateLambda)`, hoặc `null` nếu `isOverloaded === true`). Làm tròn các số thực đến 2 chữ số thập phân.',
      guidedSteps: [
        'Bước 1 (Tính năng lực phục vụ tối đa): Vì 1 giây = `1000 ms`, số request tối đa Event Loop xử lý được trong 1 giây là `rawMu = 1000 / cpuTimePerReqMs`. Làm tròn 2 chữ số thập phân để lưu vào `capacityMu`.',
        'Bước 2 (Tính hệ số tải): Lấy `arrivalRateLambda / rawMu` rồi làm tròn 2 chữ số thập phân để lưu vào `utilizationRho`.',
        'Bước 3 (Kiểm tra điều kiện bão hòa hàng đợi): Nếu `arrivalRateLambda >= rawMu`, hàng đợi sẽ phình tới vô cực -> đặt `isOverloaded = true`, ngược lại `false`.',
        'Bước 4 (Tính độ trễ kỳ vọng): Nếu `isOverloaded` là `true` thì gán `expectedLatencyMs = null`. Nếu `false`, tính `1000 / (rawMu - arrivalRateLambda)` và làm tròn 2 chữ số thập phân.'
      ],
      hints: [
        'Khi tính `utilizationRho` và `expectedLatencyMs`, hãy dùng giá trị `rawMu = 1000 / cpuTimePerReqMs` (chưa làm tròn) rồi mới làm tròn kết quả cuối bằng `Math.round(val * 100) / 100` để đạt độ chính xác cao nhất.',
        'Đối chiếu với ví dụ trong bài học: khi `arrivalRateLambda = 800` req/s và `cpuTimePerReqMs = 1` ms -> `rawMu = 1000` req/s, `utilizationRho = 0.8`, và `expectedLatencyMs = 1000 / (1000 - 800) = 5` ms.'
      ],
      starterCode: `function analyzeEventLoopQueue(arrivalRateLambda, cpuTimePerReqMs) {
  const round2 = (num) => Math.round(num * 100) / 100;

  // Bước 1: Tính rawMu = 1000 / cpuTimePerReqMs và làm tròn thành capacityMu
  
  // Bước 2: Tính hệ số tải utilizationRho = round2(arrivalRateLambda / rawMu)
  
  // Bước 3: Kiểm tra quá tải isOverloaded (arrivalRateLambda >= rawMu)
  
  // Bước 4: Tính expectedLatencyMs (null nếu quá tải, ngược lại round2(1000 / (rawMu - arrivalRateLambda)))
  
}`,
      solution: `function analyzeEventLoopQueue(arrivalRateLambda, cpuTimePerReqMs) {
  const round2 = (num) => Math.round(num * 100) / 100;
  const rawMu = 1000 / cpuTimePerReqMs;
  const capacityMu = round2(rawMu);
  const utilizationRho = round2(arrivalRateLambda / rawMu);
  const isOverloaded = arrivalRateLambda >= rawMu;
  const expectedLatencyMs = isOverloaded
? null
: round2(1000 / (rawMu - arrivalRateLambda));

  return {
capacityMu,
utilizationRho,
isOverloaded,
expectedLatencyMs
  };
}`,
      testCases: [
        {
          name: 'Tải 80% (800 req/s, 1ms CPU/req -> Độ trễ kỳ vọng 5ms)',
          input: [800, 1],
          expected: { capacityMu: 1000, utilizationRho: 0.8, isOverloaded: false, expectedLatencyMs: 5 },
          hidden: false
        },
        {
          name: 'Tải 99% sát ngưỡng bão hòa (990 req/s, 1ms CPU/req -> Độ trễ vọt lên 100ms)',
          input: [990, 1],
          expected: { capacityMu: 1000, utilizationRho: 0.99, isOverloaded: false, expectedLatencyMs: 100 },
          hidden: false
        },
        {
          name: 'Bão hòa hàng đợi (600 req/s nhưng mỗi req tốn 2ms CPU -> mu = 500 req/s)',
          input: [600, 2],
          expected: { capacityMu: 500, utilizationRho: 1.2, isOverloaded: true, expectedLatencyMs: null },
          hidden: false
        },
        {
          name: 'Biên chạm ngưỡng mu (lambda = 500, cpuTime = 2ms -> isOverloaded = true)',
          input: [500, 2],
          expected: { capacityMu: 500, utilizationRho: 1, isOverloaded: true, expectedLatencyMs: null },
          hidden: true
        },
        {
          name: 'Tác vụ nhẹ 0.5ms CPU/req ở mức tải 1500 req/s',
          input: [1500, 0.5],
          expected: { capacityMu: 2000, utilizationRho: 0.75, isOverloaded: false, expectedLatencyMs: 2 },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Memory Footprint Tracker & Defensive Guard',
      description: 'Kết hợp toàn bộ kiến thức về cấu trúc bộ nhớ tiến trình (`heapUsed`, `external`, `rss`) và kỹ thuật lập trình phòng thủ (Defensive Programming). Viết hàm `trackMemoryThreshold(maxHeapMb, currentUsageBytes)` nhận vào giới hạn `maxHeapMb` (MB) và object `currentUsageBytes` (`{ heapUsed, external, rss }` tính bằng Bytes). Trả về `{ heapUsedMb, externalMb, rssMb, isCritical, retainedRatio }` trong đó `isCritical` là `true` nếu `heapUsedMb > maxHeapMb * 0.85`, và `retainedRatio` là tỷ lệ `heapUsed / rss` (làm tròn 2 chữ số thập phân). Nếu bất kỳ tham số nào không hợp lệ (`maxHeapMb <= 0`, `currentUsageBytes` null/không phải object, hoặc `heapUsed`/`external`/`rss` không phải `number` hay `rss <= 0`), phải lập tức ném lỗi `throw new Error("INVALID_MEMORY_TELEMETRY")`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra hợp lệ tham số đầu vào): Kiểm tra nếu `typeof maxHeapMb !== "number" || maxHeapMb <= 0 || !currentUsageBytes || typeof currentUsageBytes !== "object"` thì lập tức `throw new Error("INVALID_MEMORY_TELEMETRY")`.',
        'Bước 2 (Kiểm tra các trường trong currentUsageBytes): Trích xuất `{ heapUsed, external, rss } = currentUsageBytes`. Kiểm tra nếu bất kỳ trường nào không phải kiểu `"number"`, hoặc `heapUsed < 0`, `external < 0`, hay `rss <= 0` thì `throw new Error("INVALID_MEMORY_TELEMETRY")`.',
        'Bước 3 (Quy đổi Bytes sang MB): Dùng hàm phụ `toMb(bytes) = Math.round((bytes / 1024 / 1024) * 100) / 100` để tính `heapUsedMb`, `externalMb`, và `rssMb`.',
        'Bước 4 (Tính chỉ số cảnh báo & tỷ lệ chiếm dụng): Đặt `isCritical = heapUsedMb > maxHeapMb * 0.85` và `retainedRatio = Math.round((heapUsed / rss) * 100) / 100`, sau đó trả về object kết quả.'
      ],
      hints: [
        'Trong JavaScript, `typeof null === "object"`, nên bạn phải kiểm tra đồng thời `(!currentUsageBytes || typeof currentUsageBytes !== "object")` trước khi destructuring.',
        'Chú ý điều kiện của bài nâng cao: `isCritical` là `true` khi `heapUsedMb > maxHeapMb * 0.85` (lớn hơn nghiêm ngặt), và `retainedRatio` được tính trực tiếp từ `(heapUsed / rss)` rồi làm tròn 2 chữ số thập phân.'
      ],
      starterCode: `function trackMemoryThreshold(maxHeapMb, currentUsageBytes) {
  // Bước 1 & 2: Kiểm tra tính hợp lệ của dữ liệu đầu vào (ném Error("INVALID_MEMORY_TELEMETRY") nếu sai)
  
  // Bước 3: Quy đổi heapUsed, external, rss từ Bytes sang MB (làm tròn 2 chữ số thập phân)
  
  // Bước 4: Tính isCritical (heapUsedMb > maxHeapMb * 0.85) và retainedRatio (heapUsed / rss)
  
}`,
      solution: `function trackMemoryThreshold(maxHeapMb, currentUsageBytes) {
  if (typeof maxHeapMb !== 'number' || maxHeapMb <= 0 || !currentUsageBytes || typeof currentUsageBytes !== 'object') {
throw new Error("INVALID_MEMORY_TELEMETRY");
  }
  const { heapUsed, external, rss } = currentUsageBytes;
  if (
typeof heapUsed !== 'number' ||
typeof external !== 'number' ||
typeof rss !== 'number' ||
heapUsed < 0 ||
external < 0 ||
rss <= 0
  ) {
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
          name: 'Dưới ngưỡng an toàn (Heap 500MB / 1024MB, RSS 800MB)',
          input: [1024, { heapUsed: 524288000, external: 104857600, rss: 838860800 }],
          expected: { heapUsedMb: 500, externalMb: 100, rssMb: 800, isCritical: false, retainedRatio: 0.63 },
          hidden: false
        },
        {
          name: 'Vượt ngưỡng nguy cấp >85% (Heap 900MB / 1000MB, RSS 1000MB)',
          input: [1000, { heapUsed: 943718400, external: 52428800, rss: 1048576000 }],
          expected: { heapUsedMb: 900, externalMb: 50, rssMb: 1000, isCritical: true, retainedRatio: 0.9 },
          hidden: false
        },
        {
          name: 'Input currentUsageBytes bị null -> Ném lỗi INVALID_MEMORY_TELEMETRY',
          input: [1000, null],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Tham số maxHeapMb âm -> Ném lỗi INVALID_MEMORY_TELEMETRY',
          input: [-500, { heapUsed: 100, external: 50, rss: 200 }],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
