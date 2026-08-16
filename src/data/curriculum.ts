export interface TestCase {
  name?: string;
  description?: string;
  input: unknown[];
  expected: unknown;
  hidden?: boolean;
}

export interface CodeChallenge {
  id?: string;
  title: string;
  description: string;
  starterCode: string;
  solution?: string;
  testCases: TestCase[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  tag: string;
  theory: string;
  realCodeSnippet: string;
  quiz: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export interface Sprint {
  sprintId: number;
  sprintTitle: string;
  sprintDesc: string;
  lessons: Lesson[];
}

export const CURRICULUM: Sprint[] = [
  {
    sprintId: 0,
    sprintTitle: 'Sprint 0: Cầu Nối React/Next.js → Backend Mental Model',
    sprintDesc: 'Chuyển giao tư duy toàn diện: Từ môi trường Browser Client/Serverless sang Long-running Process, Concurrency, Event Loop & HTTP RFC',
    lessons: [
      {
        id: 'lesson-1',
        title: 'Bài 01: Từ React/Next.js sang Backend: Chuyển Đổi Tư Duy Cốt Lõi',
        duration: '45 phút',
        tag: 'Mental Model',
        theory: `
### 1. Sự Khác Biệt Căn Bản Giữa Frontend và Backend
Khi đại ca làm việc với React/Next.js:
- **React Client:** Code thường chạy trong tab của một người dùng. Leak RAM chủ yếu ảnh hưởng tab đó, nhưng không phải lúc nào F5 cũng giải phóng mọi resource; state vẫn thuộc phiên client đó.
- **Next.js Serverless / Server Actions:** Nhiều nền tảng có thể tái sử dụng runtime giữa các request. Không được dựa vào việc runtime sẽ bị hủy hay biến module luôn rỗng; handler vẫn phải stateless với dữ liệu theo request.
- **NestJS Backend:** Là một **Tiến trình Node.js sống liên tục (Long-running Process)** trên máy chủ. Máy chủ này lắng nghe liên tục trên cổng 3000 và phục vụ **hàng nghìn bác sĩ, lễ tân, bệnh nhân đồng thời**!

\`\`\`
[React App A (Bác sĩ 1)] ──┐
[React App B (Bác sĩ 2)] ──┼──> [ NestJS Server (1 Tiến trình duy nhất trong RAM) ] ──> [ PostgreSQL ]
[Mobile App C (Bệnh nhân)] ─┘
\`\`\`

### 2. Cạm Bẫy Chết Người: "Lưu State vào Biến Class / Service"
Trong React, ta quen viết biến state trong Component. Nhưng trong NestJS:
- Mặc định, mọi **Service/Provider đều là Singleton** (chỉ có duy nhất 1 object được khởi tạo khi server start).
- **Lỗi chí mạng:** Nếu đại ca khai báo \`private currentUserId: string\` trong Service và gán \`this.currentUserId = user.id\` khi có request:
  - Bác sĩ A gửi request -> gán \`this.currentUserId = "A"\`.
  - Trong lúc Bác sĩ A đang đợi Database trả về (10ms), Bác sĩ B gửi request -> ghi đè \`this.currentUserId = "B"\`.
  - Database trả về cho Bác sĩ A -> Service đọc \`this.currentUserId\` và trả về dữ liệu của **Bác sĩ B**! -> **Rò rỉ dữ liệu y tế nghiêm trọng (Data Breach)!**

### 3. Quy Tắc Vàng: "Stateless Services & Request Context Isolation"
1. Service **tuyệt đối không giữ state** của request trong biến thuộc tính (\`this.state\`).
2. Mọi thông tin như \`userId\`, \`unitId\`, \`roles\` phải được truyền qua **tham số hàm** (Function Arguments) từ Controller xuống Service.
        `,
        realCodeSnippet: `// Trích từ src/modules/platform/inventory/application/inventory-category.service.ts
@Injectable()
export class InventoryCategoryService {
  // CHUẨN: Chỉ inject các dependency dùng chung (Prisma, Logger, Queue)
  constructor(private readonly prisma: PrismaService) {}

  // KHÔNG lưu unitId vào 'this.unitId' mà truyền qua tham số hàm
  async list(unitId: string, query: InventoryCategoryQueryDto) {
    return this.prisma.inventoryCategory.findMany({
      where: { unitId, isActive: true },
    });
  }
}`,
        quiz: [
          {
            id: 'q1-1',
            question: 'Tại sao việc lưu trữ "this.currentUser = req.user" trong NestJS Service Singleton là lỗi bảo mật nghiêm trọng?',
            options: [
              'Vì Service Singleton dùng chung 1 instance trong RAM cho mọi request, khiến request sau ghi đè và làm lộ thông tin sang request trước.',
              'Vì TypeScript compiler sẽ chặn biên dịch dự án khi phát hiện biến state nằm trong class được gắn decorator @Injectable.',
              'Vì V8 Engine sẽ tự động giải phóng vùng nhớ (garbage collect) của biến này sau khi hoàn tất HTTP request đầu tiên.',
              'Vì cơ chế Multi-thread của Node.js sẽ cô lập từng request vào worker thread riêng khiến biến này luôn trả về undefined.'
            ],
            correctIndex: 0,
            explanation: 'Trong kiến trúc Singleton mặc định của NestJS, toàn bộ người dùng đều truy cập vào cùng 1 object instance trong RAM. Bất kỳ biến instance nào cũng bị chia sẻ xuyên request (Race Condition).'
          },
          {
            id: 'q1-2',
            question: 'Cách truyền thông tin người dùng (userId, unitId) từ Controller xuống Service chuẩn nhất trong NestJS là gì?',
            options: [
              'Lưu tạm vào đối tượng global.currentUser trên luồng chính để mọi service bên dưới đều có thể đọc được.',
              'Truyền trực tiếp qua tham số của hàm trong Service (Method Parameters) hoặc dùng Custom Param Decorators.',
              'Gán thông tin vào biến môi trường process.env tại runtime để chia sẻ xuyên suốt toàn bộ lifecycle của request.',
              'Khởi tạo một HTTP Cookie mới trên server và đọc lại cookie này ở mỗi tầng service khi thực thi logic nghiệp vụ.'
            ],
            correctIndex: 1,
            explanation: 'Truyền qua tham số hàm (ví dụ: service.createItem(unitId, userId, dto)) đảm bảo tính thuần khiết (pure function), an toàn đa luồng và dễ viết Unit Test.'
          },
          {
            id: 'q1-3',
            question: 'Nếu một tiến trình Node.js Backend gặp lỗi unhandled exception hoặc unhandled rejection trên luồng chính, điều gì sẽ xảy ra?',
            options: [
              'Chỉ riêng HTTP request của người dùng gây ra lỗi bị ngắt kết nối, các request khác vẫn tiếp tục chạy bình thường.',
              'Toàn bộ process Node.js bị crash và thoát, tất cả người dùng đang kết nối đồng thời đều bị gián đoạn dịch vụ.',
              'PostgreSQL database sẽ tự động rollback toàn bộ dữ liệu của tất cả người dùng về trạng thái 24 giờ trước.',
              'NestJS framework sẽ tự động sao chép mã nguồn sang một tiến trình dự phòng mà không gây gián đoạn kết nối.'
            ],
            correctIndex: 1,
            explanation: 'Vì Backend là tiến trình tập trung duy nhất, một lỗi không được bắt (unhandled crash) sẽ làm tắt cả tiến trình Node.js, ngắt kết nối của mọi người dùng.'
          },
          {
            id: 'l1-q4',
            question: 'Khái niệm "Stateless Server" trong kiến trúc backend NestJS mang ý nghĩa cốt lõi nào sau đây?',
            options: [
              'Server backend không lưu trạng thái phiên làm việc trong RAM cục bộ, mỗi request tự mang đủ token xác thực.',
              'Server backend không được phép kết nối với bất kỳ Database nào bên ngoài, chỉ xử lý tính toán trong bộ nhớ RAM.',
              'Server backend bắt buộc phải chạy dưới dạng Single Page Application và không trả về bất kỳ mã trạng thái HTTP nào.',
              'Server backend yêu cầu client phải duy trì kết nối WebSocket liên tục 24/7 để không bị mất phiên làm việc.'
            ],
            correctIndex: 0,
            explanation: 'Stateless backend không lưu trạng thái phiên trong bộ nhớ cục bộ, giúp Load Balancer định tuyến request bất kỳ đến bất kỳ server instance nào mà không sợ mất phiên.'
          }
        ],
        codeChallenge: {
          title: 'Tạo Safe Request Context Isolation Object',
          description: 'Viết hàm `createSafeRequestContext(requestId, user, unitId)`: Kiểm tra nếu thiếu `requestId` hoặc `unitId` (hoặc là chuỗi rỗng) thì ném `Error("INVALID_CONTEXT")`. Clone object `user` để chống tham chiếu ngoài và trả về object bị đóng băng (Object.freeze) gồm: `{ requestId, user: { ...user }, unitId, createdAt: Date.now() }`.',
          starterCode: `function createSafeRequestContext(requestId, user, unitId) {
  // Viết logic tạo context an toàn
  
}`,
          solution: `function createSafeRequestContext(requestId, user, unitId) {
  if (!requestId || typeof requestId !== 'string' || !requestId.trim()) {
    throw new Error("INVALID_CONTEXT");
  }
  if (!unitId || typeof unitId !== 'string' || !unitId.trim()) {
    throw new Error("INVALID_CONTEXT");
  }
  return Object.freeze({
    requestId: requestId.trim(),
    user: user && typeof user === 'object' ? { ...user } : {},
    unitId: unitId.trim(),
    createdAt: Date.now()
  });
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Tạo context chuẩn',
              input: ['req-101', { id: 'u1', name: 'Dr. Minh' }, 'unit-99'],
              expected: { requestId: 'req-101', user: { id: 'u1', name: 'Dr. Minh' }, unitId: 'unit-99' },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Thiếu requestId -> Báo lỗi',
              input: ['', { id: 'u1' }, 'unit-99'],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Thiếu unitId -> Báo lỗi',
              input: ['req-102', { id: 'u1' }, '   '],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): User null -> gán object rỗng an toàn',
              input: ['req-103', null, 'unit-01'],
              expected: { requestId: 'req-103', user: {}, unitId: 'unit-01' },
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Request ID rỗng',
              input: ['   ', {"id":"u2"}, 'unit-02'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Unit ID không phải chuỗi',
              input: ['req-1', {"id":"u"}, 123],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Thiếu tham số',
              input: ['req-1'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 8 (Hidden): Null',
              input: [null, null, null],
              expected: 'ERROR_THROWN',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-2',
        title: 'Bài 02: Node.js Event Loop & Xử Lý Đa Người Dùng',
        duration: '50 phút',
        tag: 'Node.js Core',
        theory: `
### 1. Cơ Chế Non-blocking I/O & Event Loop
Node.js thực thi JavaScript của một process trên **một main thread**. Deployment thực tế có thể chạy nhiều process/pod; mỗi process vẫn phải tránh block Event Loop.
- **Tác vụ I/O (Database, File, Socket, Network):** Node đăng ký I/O bất đồng bộ qua OS/libuv. DB/network I/O chủ yếu dùng socket của OS, còn một số API file/DNS/crypto dùng libuv thread pool. Main thread tiếp tục xử lý event khác và nhận continuation khi I/O hoàn tất.
- **Tác vụ CPU-intensive (Tính toán nặng):** Nếu đại ca chạy một vòng lặp \`for (let i=0; i<10^9; i++)\` hoặc mã hóa video đồng bộ, luồng chính sẽ bị **Block** -> **Toàn bộ 10,000 người dùng khác bị đứng hình!**

\`\`\`
[ Incoming Requests ] ──> [ Event Loop (Single Thread) ] ──┬── Non-blocking I/O ──> [ libuv Threadpool / OS Kernel ]
                                                           │                        (DB Query, File Read, Network)
                                                           └── Blocking CPU Loop ──> ❌ LÀM NGHẼN CẢ SERVER!
\`\`\`

### 2. So Sánh Bất Đồng Bộ Trong React vs Backend
- **Trong React:** Không viết trực tiếp \`useEffect(async () => ...)\` vì effect callback không được trả về Promise. Khởi tạo async function bên trong effect. Một request chậm thường tác động chính UI của người dùng đó.
- **Trên Backend:** Query độc lập *có thể* chạy song song với \`Promise.all\`, giảm latency gần bằng query chậm nhất khi DB/pool còn capacity. Không phải luôn 50ms: chạy quá nhiều query song song có thể bão hòa connection pool hoặc DB.

### 3. Quy Tắc Xử Lý Async An Toàn:
- Chỉ gom query thực sự độc lập vào \`Promise.all\`; với fan-out lớn, giới hạn concurrency.
- CPU-heavy JavaScript cần Worker Thread hoặc worker process riêng. Queue chỉ tách việc khỏi HTTP khi consumer chạy tách process/pod; queue không tự làm CPU work hết block.
        `,
        realCodeSnippet: `// Trích tư duy Promise.all trong thống kê eSmiles
async getClinicDashboardSummary(unitId: string, fromDate: Date, toDate: Date) {
  // Gửi song song 3 câu truy vấn độc lập xuống Database
  const [patientCount, revenueSummary, appointmentCount] = await Promise.all([
    this.prisma.patient.count({ where: { unitId, createdAt: { gte: fromDate } } }),
    this.prisma.invoice.aggregate({
      where: { unitId, status: 'PAID', createdAt: { gte: fromDate, lte: toDate } },
      _sum: { totalAmount: true },
    }),
    this.prisma.appointment.count({ where: { unitId, date: { gte: fromDate, lte: toDate } } }),
  ]);

  return {
    newPatients: patientCount,
    totalRevenue: revenueSummary._sum.totalAmount ?? 0,
    appointments: appointmentCount,
  };
}`,
        quiz: [
          {
            id: 'q2-1',
            question: 'Khi backend cần thực thi 3 câu truy vấn Database độc lập không phụ thuộc dữ liệu của nhau, giải pháp nào tối ưu thời gian phản hồi nhất?',
            options: [
              'Gọi tuần tự từng truy vấn bằng 3 câu lệnh await riêng biệt để tránh làm quá tải Database Connection Pool.',
              'Dùng Promise.all([query1(), query2(), query3()]) để gửi song song 3 truy vấn và tận dụng connection pool.',
              'Sử dụng vòng lặp while(true) kết hợp hàm setTimeout 0ms để chờ từng truy vấn hoàn tất theo thứ tự mong muốn.',
              'Tạo 3 endpoint API riêng biệt trên backend và bắt buộc ứng dụng phía Frontend React phải gọi 3 lần độc lập.'
            ],
            correctIndex: 1,
            explanation: 'Promise.all gửi đồng thời 3 câu query tới Database Connection Pool, thời gian chờ chỉ bằng câu query chậm nhất thay vì cộng dồn 3 câu lại.'
          },
          {
            id: 'q2-2',
            question: 'Hành động nào sau đây sẽ làm nghẽn (Block) Node.js Event Loop khiến toàn bộ request của người dùng khác bị đứng hình?',
            options: [
              'Đọc một tệp tin dung lượng 500MB bằng hàm bất đồng bộ fs.promises.readFile kết hợp cú pháp async/await.',
              'Thực hiện thuật toán tính toán ma trận hoặc nén ảnh phức tạp bằng vòng lặp CPU nặng đồng bộ trên Main Thread.',
              'Đẩy một tác vụ gửi email hàng loạt vào hàng đợi tin nhắn Redis Message Queue (BullMQ) để xử lý ngầm.',
              'Thực hiện câu lệnh truy vấn Prisma findMany có kèm theo điều kiện lọc và giới hạn phân trang (take/skip).'
            ],
            correctIndex: 1,
            explanation: 'Các tác vụ CPU nặng chạy đồng bộ trên Main Thread sẽ độc chiếm Event Loop, khiến Node.js không thể chuyển sang phục vụ request khác.'
          },
          {
            id: 'q2-3',
            question: 'Trong hàm Promise.all([task1, task2, task3]), nếu task2 bị ném Exception (Reject) trong khi task1 và task3 vẫn đang chạy, điều gì xảy ra?',
            options: [
              'Promise.all vẫn đợi task1 và task3 hoàn tất và trả về mảng kết quả chứa cả giá trị thành công lẫn đối tượng lỗi.',
              'Promise.all kích hoạt cơ chế Fail-fast, lập tức reject ngay với lỗi của task2 mà không cần chờ kết quả các task còn lại.',
              'Node.js runtime sẽ tự động retry lại task2 thêm 3 lần trước khi quyết định reject toàn bộ Promise.all.',
              'Toàn bộ tiến trình server Node.js sẽ lập tức bị crash và tự động khởi động lại từ đầu.'
            ],
            correctIndex: 1,
            explanation: 'Promise.all có cơ chế Fail-fast: chỉ cần 1 promise thất bại thì toàn bộ Promise.all sẽ reject ngay lập tức.'
          },
          {
            id: 'l2-q4',
            question: 'Điểm khác biệt căn bản giữa Promise.all và Promise.allSettled trong xử lý bất đồng bộ là gì?',
            options: [
              'Promise.allSettled luôn chờ tất cả promise hoàn thành (dù thành công hay thất bại) và trả về mảng chi tiết trạng thái.',
              'Promise.allSettled thực thi các tác vụ theo thứ tự tuần tự (Serial) thay vì song song (Parallel) như Promise.all.',
              'Promise.allSettled chỉ chấp nhận các hàm đồng bộ thuần túy và không hỗ trợ xử lý các async function trả về Promise.',
              'Promise.allSettled tự động lọc bỏ các promise bị lỗi và chỉ trả về mảng các kết quả thành công cho phía caller.'
            ],
            correctIndex: 0,
            explanation: 'allSettled không fail-fast, nó gom kết quả của tất cả các Promise thành mảng { status: "fulfilled" | "rejected", value/reason }.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Async Batch Runner Kèm Timeout & Fallback',
          description: 'Viết hàm `fetchBatchWithFallback(tasks, timeoutMs)` nhận vào mảng các async functions `tasks` và `timeoutMs`. Chạy tất cả task song song. Nếu bất kỳ task nào lỗi hoặc quá `timeoutMs`, task đó sẽ trả về `{ success: false, error: err.message }`, task thành công trả về `{ success: true, data: result }`. Trả về mảng kết quả theo đúng thứ tự.',
          starterCode: `async function fetchBatchWithFallback(tasks, timeoutMs) {
  // Viết logic chạy batch an toàn với timeout
  
}`,
          solution: `async function fetchBatchWithFallback(tasks, timeoutMs) {
  const runWithTimeout = async (fn) => {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, error: 'TIMEOUT' });
      }, timeoutMs);

      Promise.resolve()
        .then(() => fn())
        .then((data) => {
          clearTimeout(timer);
          resolve({ success: true, data });
        })
        .catch((err) => {
          clearTimeout(timer);
          resolve({ success: false, error: err?.message || 'ERROR' });
        });
    });
  };

  return Promise.all(tasks.map(runWithTimeout));
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Tất cả task thành công',
              input: [[async () => 10, async () => 'OK'], 1000],
              expected: [{ success: true, data: 10 }, { success: true, data: 'OK' }],
              hidden: false
            },
            {
              name: 'Case 2 (Visible): 1 task có lỗi -> Bắt an toàn không sập',
              input: [[async () => 'A', async () => { throw new Error('DB_FAIL'); }], 1000],
              expected: [{ success: true, data: 'A' }, { success: false, error: 'DB_FAIL' }],
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Task bị timeout -> Trả về TIMEOUT',
              input: [[async () => new Promise(r => setTimeout(() => r('SLOW'), 200))], 50],
              expected: [{ success: false, error: 'TIMEOUT' }],
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Mảng rỗng',
              input: [[], 1000],
              expected: [],
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Không phải mảng func',
              input: [[1,2], 1000],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Timeout âm',
              input: [["async () => 1"], -100],
              expected: [{"success":false,"error":"TIMEOUT"}],
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Mix func null',
              input: [["async () => 1",null], 1000],
              expected: 'ERROR_THROWN',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-3',
        title: 'Bài 03: Giao Thức HTTP: Headers, CORS, Cookies & Idempotency',
        duration: '45 phút',
        tag: 'HTTP & Network',
        theory: `
### 1. Bản Chất Của Giao Thức HTTP & RESTful Chuẩn
Giao diện React gọi \`axios.post('/api/i/v1/inventory/items')\`, thực chất là gửi một gói tin văn bản thuần túy theo chuẩn RFC:
- **HTTP Methods & Tính Idempotent:**
  - \`GET\`: Đọc dữ liệu (An toàn & Idempotent - gọi 100 lần kết quả DB không đổi).
  - \`POST\`: Tạo mới tài nguyên (Non-Idempotent - gọi 2 lần sinh 2 bản ghi).
  - \`PUT\`: Thay thế toàn bộ bản ghi (Idempotent).
  - \`PATCH\`: Cập nhật 1 phần (Non-Idempotent hoặc Idempotent tùy implementation).
  - \`DELETE\`: Xóa tài nguyên (Idempotent).

### 2. HTTP Status Codes Trong Y Tế / Tài Chính:
- \`200 OK\`: Thành công (GET/PATCH/DELETE).
- \`201 Created\`: Tạo mới thành công (POST).
- \`400 Bad Request\`: Dữ liệu gửi lên sai định dạng (thiếu trường, sai regex).
- \`401 Unauthorized\`: Chưa xác thực (Chưa truyền Token hoặc Token hết hạn).
- \`403 Forbidden\`: Đã đăng nhập nhưng không đủ quyền (Bác sĩ cố vào màn hình Doanh thu).
- \`404 Not Found\`: Bản ghi không tồn tại trong Tenant hiện tại.
- \`409 Conflict\`: Trùng mã code hoặc vi phạm ràng buộc DB (xóa danh mục đang có sản phẩm).
- \`422 Unprocessable Entity\`: Lỗi nghiệp vụ (Số lượng thuốc trong kho không đủ để xuất).
- \`500 Internal Server Error\`: Bug code unhandled (Cần hạn chế tối đa ở Production).

### 3. CORS & HttpOnly Cookies:
- **CORS (Cross-Origin Resource Sharing):** Là policy do browser thực thi: browser chỉ cho JavaScript ở origin được phép đọc response khi server cho phép. CORS không phải authorization, không chặn request từ curl/server khác và không thay thế CSRF protection.
- **HttpOnly Cookie:** JavaScript không đọc được cookie này, nên giảm nguy cơ *exfiltrate token* qua XSS. XSS vẫn có thể thực hiện authenticated request từ chính trang đang bị chèn mã; cần CSP, output encoding và CSRF defense phù hợp.
        `,
        realCodeSnippet: `// Trích cấu hình CORS và Helmet trong src/app-setup.ts
export function configureApp(app: NestExpressApplication, config: ConfigService) {
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.get('CORS_ORIGINS').split(','), // Ví dụ: https://cms.esmiles.vn
    credentials: true, // BẮT BUỘC: Cho phép gửi HttpOnly Cookie xuyên domain
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Unit-Id', 'X-Branch-Id'],
  });
}`,
        quiz: [
          {
            id: 'q3-1',
            question: 'Khi client gửi request tạo mới một bệnh nhân thành công lên server, mã trạng thái HTTP chuẩn RESTful và header đi kèm nên là gì?',
            options: [
              '200 OK kèm theo body chứa thông tin bệnh nhân vừa tạo và header Content-Type: application/json.',
              '201 Created kèm theo body bản ghi mới tạo và header Location trỏ tới URL chi tiết của tài nguyên vừa tạo.',
              '204 No Content để tiết kiệm băng thông mạng và bắt buộc client tự suy luận ID của bệnh nhân mới.',
              '202 Accepted để báo hiệu rằng request đã được lưu vào RAM và sẽ được ghi vào database sau 1 giờ.'
            ],
            correctIndex: 1,
            explanation: 'HTTP 201 Created là mã chuẩn RFC khi tạo mới thành công tài nguyên, kèm theo Location header trỏ đến URI của tài nguyên mới.'
          },
          {
            id: 'q3-2',
            question: 'Tính chất Idempotent (Bảo toàn trạng thái khi gọi nhiều lần) áp dụng cho các HTTP Method chuẩn nào sau đây?',
            options: [
              'POST và PATCH, vì cả hai đều có thể cập nhật dữ liệu nhiều lần mà không thay đổi cấu trúc bảng.',
              'GET, PUT, DELETE, HEAD, OPTIONS, vì việc gọi 1 lần hay N lần liên tiếp đều dẫn đến cùng một trạng thái server.',
              'Chỉ riêng GET, vì mọi HTTP method khác đều làm biến đổi trạng thái của cơ sở dữ liệu trên backend.',
              'Tất cả các HTTP Method đều có tính Idempotent nếu server được triển khai trên hạ tầng điện toán đám mây.'
            ],
            correctIndex: 1,
            explanation: 'GET, PUT, DELETE là idempotent: gọi PUT/DELETE nhiều lần cùng payload sẽ tạo ra cùng 1 trạng thái kết quả trên server, trong khi POST sẽ tạo ra nhiều bản ghi mới.'
          },
          {
            id: 'q3-3',
            question: 'Khi người dùng chưa đăng nhập gửi request vào endpoint yêu cầu quyền hạn, backend nên trả về mã lỗi HTTP nào?',
            options: [
              '401 Unauthorized (Chưa xác thực danh tính - Thiếu token hoặc Token không hợp lệ / đã hết hạn).',
              '403 Forbidden (Đã xác định được danh tính nhưng tài khoản không có quyền truy cập tài nguyên này).',
              '400 Bad Request (Client gửi dữ liệu sai định dạng JSON hoặc thiếu các trường bắt buộc).',
              '404 Not Found (Endpoint hoặc đường dẫn URL yêu cầu không tồn tại trên hệ thống máy chủ).'
            ],
            correctIndex: 0,
            explanation: '401 Unauthorized chỉ ra lỗi thiếu hoặc sai xác thực (Authentication). 403 Forbidden chỉ ra lỗi thiếu quyền truy cập (Authorization).'
          },
          {
            id: 'l3-q4',
            question: 'Tại sao việc lưu trữ JWT Refresh Token trong HttpOnly Cookie an toàn hơn nhiều so với localStorage của trình duyệt?',
            options: [
              'Vì HttpOnly Cookie có dung lượng lưu trữ tối đa lên đến 50MB, lớn hơn nhiều so với 5MB của localStorage.',
              'Vì mã độc JavaScript (XSS) trên trình duyệt không thể đọc trộm được HttpOnly Cookie qua document.cookie.',
              'Vì HttpOnly Cookie tự động mã hóa toàn bộ dữ liệu bằng thuật toán RSA trước khi gửi qua đường truyền mạng.',
              'Vì localStorage chỉ hoạt động trên giao thức HTTP thường, còn HttpOnly Cookie bắt buộc phải có chứng chỉ SSL.'
            ],
            correctIndex: 1,
            explanation: 'Cờ HttpOnly cấm JavaScript đọc cookie, giúp ngăn chặn triệt để việc đánh cắp token phiên làm việc (Token Exfiltration) khi trang web dính lỗ hổng XSS.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng RFC 7807 Error Problem Details Formatter',
          description: 'Viết hàm `formatHttpError(status, code, message, details)` chuẩn hóa lỗi theo chuẩn quốc tế RFC 7807: Trả về object `{ status, code, message, details: details || null, timestamp: Date.now() }`. Nếu `status < 400` hoặc `status > 599`, ném `Error("INVALID_HTTP_STATUS")`.',
          starterCode: `function formatHttpError(status, code, message, details) {
  // Viết logic format lỗi chuẩn RFC
  
}`,
          solution: `function formatHttpError(status, code, message, details) {
  if (typeof status !== 'number' || status < 400 || status > 599) {
    throw new Error("INVALID_HTTP_STATUS");
  }
  return {
    status,
    code: String(code || 'UNKNOWN_ERROR').toUpperCase().trim(),
    message: String(message || 'An error occurred').trim(),
    details: details ?? null,
    timestamp: Date.now()
  };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Format lỗi 409 Conflict',
              input: [409, 'DUPLICATE_CODE', 'Mã danh mục đã tồn tại', { field: 'code' }],
              expected: { status: 409, code: 'DUPLICATE_CODE', message: 'Mã danh mục đã tồn tại', details: { field: 'code' } },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Status không hợp lệ (200) -> Ném lỗi',
              input: [200, 'OK', 'Thành công'],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Format lỗi 404 không có details',
              input: [404, 'not_found', 'Không tìm thấy bệnh nhân'],
              expected: { status: 404, code: 'NOT_FOUND', message: 'Không tìm thấy bệnh nhân', details: null },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Không truyền params',
              input: [],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Status 600',
              input: [600, 'ERR', 'Lỗi'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Message null',
              input: [400, 'ERR', null],
              expected: {"status":400,"code":"ERR","message":"null","details":null},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Details type check',
              input: [404, 'N', 'M', 'string'],
              expected: {"status":404,"code":"N","message":"M","details":"string"},
              hidden: true
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 1,
    sprintTitle: 'Sprint 1: NestJS Core & Clean Architecture',
    sprintDesc: 'Làm chủ tư duy Dependency Injection, IoC Container, Controller Decorators, DTO Validation và Clean Layering',
    lessons: [
      {
        id: 'lesson-4',
        title: 'Bài 04: Bootstrapping, Modules & IoC Container',
        duration: '45 phút',
        tag: 'Core DI',
        theory: `
### 1. Inversion of Control (IoC) & Dependency Injection (DI)
So sánh với Frontend:
- Trong React: Ta dùng \`useContext(ThemeContext)\` để lấy theme từ Provider cha mà không cần truyền qua từng component.
- Trong NestJS: Thay vì khởi tạo \`const service = new InventoryService(new PrismaService())\`, ta khai báo trong constructor: \`constructor(private readonly inventory: InventoryService)\`. NestJS IoC Container tự động phân giải cây phụ thuộc và bơm instance vào!

### 2. Cấu Trúc Module Chuẩn Trong NestJS:
\`\`\`typescript
@Module({
  imports: [PrismaModule, AuditModule],     // Các Module khác cung cấp service cần dùng
  controllers: [InventoryCategoryController], // Tiếp nhận HTTP Request (Routing)
  providers: [InventoryCategoryService],      // Xử lý Business Logic
  exports: [InventoryCategoryService],        // Cho phép các Module khác sử dụng Service này
})
export class InventoryCategoryModule {}
\`\`\`

### 3. Quy Tắc Module Boundaries (Ranh Giới Module):
1. **Module con** chỉ export các Provider cần thiết ra ngoài, giấu kín implementation chi tiết.
2. Không import chéo vòng tròn giữa các Module (Circular Dependency).
        `,
        realCodeSnippet: `// Trích từ src/modules/platform/inventory/inventory.module.ts
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryCategoryController, InventoryItemController],
  providers: [InventoryCategoryService, InventoryItemService],
  exports: [InventoryItemService], // Xuất service cho Clinic Module dùng
})
export class InventoryModule {}`,
        quiz: [
          {
            id: 'q4-1',
            question: 'Khi ClinicModule muốn sử dụng InventoryItemService từ InventoryModule, ta bắt buộc phải làm 2 bước nào?',
            options: [
              'InventoryModule phải export InventoryItemService VÀ ClinicModule phải import InventoryModule vào mảng imports.',
              'Khai báo InventoryItemService trực tiếp vào mảng providers của cả 2 module mà không cần export.',
              'Gán đối tượng InventoryItemService vào biến toàn cục global.inventoryService tại file main.ts.',
              'Sử dụng từ khóa new InventoryItemService() trực tiếp trong constructor của ClinicService.'
            ],
            correctIndex: 0,
            explanation: 'Muốn dùng service của module khác, module sở hữu phải export service đó và module tiêu thụ phải import module sở hữu vào mảng imports.'
          },
          {
            id: 'q4-2',
            question: 'Lợi ích lớn nhất của cơ chế Dependency Injection (DI) trong NestJS là gì?',
            options: [
              'Tự động tăng tốc độ xử lý của CPU bằng cách biên dịch mã nguồn TypeScript thành WebAssembly.',
              'Tách rời sự phụ thuộc (Decoupling), giúp dễ dàng thay thế Mock Service khi viết Unit Test mà không cần sửa code Controller.',
              'Cho phép các class trong NestJS truy cập trực tiếp vào vùng nhớ RAM của hệ điều hành mà không qua V8 Engine.',
              'Tự động đồng bộ hóa cơ sở dữ liệu PostgreSQL với giao diện người dùng React ở thời gian thực.'
            ],
            correctIndex: 1,
            explanation: 'DI cho phép ta dễ dàng inject Mock Database hoặc Mock Service vào Controller/Service khi chạy Unit Test, giúp kiểm thử nhanh và độc lập.'
          },
          {
            id: 'q4-3',
            question: 'Khi hai module A và B phụ thuộc vòng tròn (Circular Dependency), NestJS cung cấp cơ chế nào để giải quyết?',
            options: [
              'Sử dụng hàm helper forwardRef(() => ModuleB) trong decorator @Module và hàm tiêm @Inject(forwardRef(...)).',
              'Chuyển đổi toàn bộ mã nguồn của Module A và Module B sang ngôn ngữ JavaScript thuần (CommonJS).',
              'Tách Module A và Module B thành 2 ứng dụng backend độc lập chạy trên 2 cổng HTTP khác nhau.',
              'Xóa bỏ toàn bộ decorator @Injectable() và tự quản lý việc khởi tạo instance bằng tay trong main.ts.'
            ],
            correctIndex: 0,
            explanation: 'forwardRef cho phép NestJS trì hoãn việc resolve dependency cho đến khi cả hai module đều đã được nạp metadata.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Type-Safe Module Dependency Resolver',
          description: 'Viết hàm `resolveModuleDependencies(registry, requiredTokens)`: Kiểm tra xem `registry` (object dạng `{ [token]: instance }`) có đầy đủ các provider trong mảng `requiredTokens` hay không. Nếu thiếu bất kỳ token nào, ném `Error("MISSING_DEPENDENCY: " + token)`. Trả về object chứa các provider đã resolve `{ [token]: registry[token] }`.',
          starterCode: `function resolveModuleDependencies(registry, requiredTokens) {
  // Viết logic resolve dependencies
  
}`,
          solution: `function resolveModuleDependencies(registry, requiredTokens) {
  if (!registry || typeof registry !== 'object') throw new Error("INVALID_REGISTRY");
  if (!Array.isArray(requiredTokens)) return {};
  const resolved = {};
  for (const token of requiredTokens) {
    if (!registry[token]) {
      throw new Error("MISSING_DEPENDENCY: " + token);
    }
    resolved[token] = registry[token];
  }
  return resolved;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Resolve đủ 2 dependencies (PrismaService, AuditService)',
              input: [
                { PrismaService: { db: true }, AuditService: { log: true } },
                ['PrismaService', 'AuditService']
              ],
              expected: { PrismaService: { db: true }, AuditService: { log: true } },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Thiếu QueueService -> Báo lỗi',
              input: [
                { PrismaService: { db: true } },
                ['PrismaService', 'QueueService']
              ],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Thiếu nhiều',
              input: [{"A":1}, ["A","B","C"]],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Required tokens rỗng',
              input: [{"A":1}, []],
              expected: {},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Registry null',
              input: [null, ["A"]],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Invalid required format',
              input: [{"A":1}, 'A'],
              expected: {},
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-5',
        title: 'Bài 05: Controllers, Routing & Parameter Decorators',
        duration: '45 phút',
        tag: 'Routing',
        theory: `
### 1. Trách Nhiệm Duy Nhất Của Controller:
Controller chỉ làm nhiệm vụ:
1. Tiếp nhận request HTTP (\`@Get\`, \`@Post\`, \`@Patch\`, \`@Delete\`).
2. Trích xuất tham số từ URL, Query, Body (\`@Param\`, \`@Query\`, \`@Body\`, \`@ActiveUnitId\`).
3. Chuyển cho Service xử lý và trả kết quả về cho Client.
> **Tuyệt đối KHÔNG viết logic nghiệp vụ (tính tiền, query DB) bên trong Controller!**

### 2. Cạm Bẫy Thứ Tự Route (Route Order Trap):
Trong NestJS / Express, router khớp đường dẫn theo **thứ tự khai báo từ trên xuống dưới**:
\`\`\`typescript
@Get(':id')      // <-- KHÔNG ĐƯỢC ĐẶT Ở TRÊN! Nó sẽ bắt luôn chuỗi "export-excel" làm :id
getDetail(@Param('id') id: string) { ... }

@Get('export-excel') // <-- Bị chết (Dead Route) vì :id ở trên đã nuốt mất!
exportExcel() { ... }
\`\`\`
> **Quy tắc:** Các static routes (\`options\`, \`export\`, \`stats\`) phải luôn đứng **TRƯỚC** dynamic routes (\`:id\`, \`:code\`).
        `,
        realCodeSnippet: `// Trích Controller chuẩn từ eSmiles
@InternalController('inventory/categories')
export class InventoryCategoryController {
  constructor(private readonly categories: InventoryCategoryService) {}

  @Get('options') // Đứng TRƯỚC :id
  @RequirePermission('inventory:category:read')
  getOptions(@ActiveUnitId() unitId: string) {
    return this.categories.getOptions(unitId);
  }

  @Get(':id')
  @RequirePermission('inventory:category:read')
  detail(
    @ActiveUnitId() unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categories.detail(unitId, id);
  }
}`,
        quiz: [
          {
            id: 'q5-1',
            question: 'Tại sao endpoint @Get("options") bắt buộc phải được đặt TRƯỚC endpoint @Get(":id") trong một NestJS Controller?',
            options: [
              'Vì cơ chế Routing duyệt từ trên xuống, nếu đặt sau thì chuỗi "options" sẽ bị nuốt bởi dynamic param ":id" và dính lỗi 400 Bad Request.',
              'Vì TypeScript compiler bắt buộc các method trong class Controller phải được sắp xếp theo thứ tự bảng chữ cái ABC.',
              'Vì NestJS cần biên dịch các static route sang WebAssembly trước khi khởi động Express HTTP server.',
              'Vì trình duyệt web của người dùng sẽ tự động hủy các request có đường dẫn chứa nhiều hơn 2 dấu gạch chéo.'
            ],
            correctIndex: 0,
            explanation: 'Express/NestJS khớp route từ trên xuống. Dynamic param :id khớp với mọi chuỗi, nên nếu đứng trước nó sẽ nuốt mất các static sub-path như options hay export.'
          },
          {
            id: 'q5-2',
            question: 'Cơ chế Dependency Injection (DI) trong NestJS mang lại lợi ích cốt lõi nào cho việc phát triển phần mềm?',
            options: [
              'Tự động tăng tốc độ xử lý của CPU bằng cách biên dịch mã nguồn TypeScript thành WebAssembly.',
              'Đảo ngược quyền kiểm soát khởi tạo đối tượng (IoC), giảm phụ thuộc cứng (tight coupling) và dễ dàng mock khi test.',
              'Cho phép các class trong NestJS truy cập trực tiếp vào vùng nhớ RAM của hệ điều hành mà không qua V8 Engine.',
              'Tự động đồng bộ hóa cơ sở dữ liệu PostgreSQL với giao diện người dùng React ở thời gian thực.'
            ],
            correctIndex: 1,
            explanation: 'DI/IoC giúp class không tự `new` phụ thuộc mà được Container tiêm vào qua constructor, giúp code loosely coupled và dễ dàng truyền Mock Service khi viết Unit Test.'
          },
          {
            id: 'q5-3',
            question: 'Sự khác biệt giữa Injection Scope DEFAULT (Singleton) và REQUEST trong NestJS là gì?',
            options: [
              'DEFAULT tạo 1 instance duy nhất toàn app; REQUEST tạo 1 instance mới cho mỗi HTTP request đến, làm tăng chi phí RAM và GC.',
              'DEFAULT chỉ dùng được cho Controller; REQUEST chỉ dùng được cho Service có kết nối Database.',
              'DEFAULT tự động hủy sau 60 giây; REQUEST tồn tại vĩnh viễn trong suốt thời gian server hoạt động.',
              'DEFAULT chạy trên luồng phụ Worker Thread; REQUEST chạy trực tiếp trên Main Thread của Node.js.'
            ],
            correctIndex: 0,
            explanation: 'DEFAULT Scope chia sẻ 1 instance duy nhất (tiết kiệm bộ nhớ). REQUEST Scope tạo mới instance mỗi request và lan truyền (bubble up) lên toàn bộ dependency tree, gây tốn RAM và tải nặng cho Garbage Collector.'
          }
        ],
        codeChallenge: {
          title: 'Trình Phân Giải URL Route Matcher Kèm Type Casting',
          description: 'Viết hàm `matchRoutePattern(routeTemplate, actualPath)`: Phân tích routeTemplate (vd: `items/:id/stock/:warehouseId`) khớp với actualPath (vd: `items/item-123/stock/wh-99`). Trả về `{ isMatch: true, params: { id: "item-123", warehouseId: "wh-99" } }`. Nếu không khớp trả về `{ isMatch: false, params: {} }`.',
          starterCode: `function matchRoutePattern(routeTemplate, actualPath) {
  // Viết logic khớp route
  
}`,
          solution: `function matchRoutePattern(routeTemplate, actualPath) {
  const tParts = routeTemplate.split('/').filter(Boolean);
  const aParts = actualPath.split('/').filter(Boolean);
  if (tParts.length !== aParts.length) {
    return { isMatch: false, params: {} };
  }
  const params = {};
  for (let i = 0; i < tParts.length; i++) {
    if (tParts[i].startsWith(':')) {
      params[tParts[i].slice(1)] = aParts[i];
    } else if (tParts[i] !== aParts[i]) {
      return { isMatch: false, params: {} };
    }
  }
  return { isMatch: true, params };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Khớp 2 params id và warehouseId',
              input: ['items/:id/stock/:warehouseId', 'items/i-1/stock/wh-2'],
              expected: { isMatch: true, params: { id: 'i-1', warehouseId: 'wh-2' } },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Khác segment tĩnh -> Không khớp',
              input: ['items/:id/stock/:warehouseId', 'items/i-1/price/wh-2'],
              expected: { isMatch: false, params: {} },
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Lệch độ dài URL -> Không khớp',
              input: ['categories/:id', 'categories/c-1/items'],
              expected: { isMatch: false, params: {} },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Ký tự lạ trong param',
              input: ['/a/:id', '/a/123@!#'],
              expected: {"isMatch":true,"params":{"id":"123@!#"}},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Thiếu path',
              input: ['/a/:id', '/a'],
              expected: {"isMatch":false,"params":{}},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): URL dài hơn',
              input: ['/a/:id', '/a/1/2'],
              expected: {"isMatch":false,"params":{}},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Cùng start match',
              input: ['/api/v1', '/api/v2'],
              expected: {"isMatch":false,"params":{}},
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-6',
        title: 'Bài 06: Services & Vòng Đời Dependency Injection',
        duration: '45 phút',
        tag: 'Business Logic',
        theory: `
### 1. Các Loại DI Injection Scopes Trong NestJS:
- **DEFAULT (Singleton - 99% trường hợp):** Khởi tạo 1 instance duy nhất khi server start. Siêu nhanh, tốn cực ít RAM.
- **REQUEST:** Khởi tạo instance mới cho MỖI request HTTP. Tốn RAM và làm chậm hiệu năng, chỉ dùng khi bắt buộc phải gắn metadata theo request.
- **TRANSIENT:** Khởi tạo instance mới mỗi khi được inject vào class khác.

### 2. Lifecycle Hooks Của Provider:
- \`onModuleInit()\`: Chạy ngay khi Module được nạp (Dùng để kết nối Database, khởi tạo kết nối Redis/Kafka).
- \`onModuleDestroy()\`: Chạy khi app nhận tín hiệu tắt (\`SIGTERM\`) -> Đóng kết nối Database an toàn (Graceful Shutdown).
        `,
        realCodeSnippet: `// Trích PrismaService trong src/core/prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect(); // Mở kết nối PostgreSQL khi khởi động
  }

  async onModuleDestroy() {
    await this.$disconnect(); // Đóng kết nối an toàn khi server tắt
  }
}`,
        quiz: [
          {
            id: 'q6-1',
            question: 'Tại sao việc đọc biến môi trường qua `process.env.DATABASE_URL` rải rác trong code lại là bad practice so với `ConfigService`?',
            options: [
              'Vì gọi process.env nhiều lần sẽ làm chậm CPU 50% do phải đọc từ ổ cứng liên tục.',
              'Vì process.env luôn trả về string/undefined, không có type-safety, không có validation schema khi khởi động ứng dụng.',
              'Vì hệ điều hành Linux sẽ tự động xóa các biến process.env sau khi server chạy được 1 giờ.',
              'Vì NestJS cấm hoàn toàn việc truy cập vào biến toàn cục process của Node.js.'
            ],
            correctIndex: 1,
            explanation: 'Dùng ConfigService kết hợp validation schema (Joi/Zod) giúp kiểm tra toàn bộ biến môi trường ngay lúc bootstrap. Nếu thiếu biến bắt buộc, server dừng ngay từ đầu thay vì crash bất ngờ giữa đêm.'
          },
          {
            id: 'q6-2',
            question: 'Khi máy chủ nhận tín hiệu tắt máy (SIGTERM) trong quá trình redeploy, Lifecycle Hook nào giúp đóng kết nối Database an toàn (Graceful Shutdown)?',
            options: [
              'Hook `onModuleDestroy()` hoặc `beforeApplicationShutdown()` để dọn dẹp kết nối, hoàn thành request đang dở trước khi thoát.',
              'Hook `onModuleInit()` để tải lại toàn bộ cấu hình từ tệp tin .env và khởi động lại container.',
              'Hook `componentWillUnmount()` của React được chuyển giao qua WebSockets để thông báo cho trình duyệt.',
              'Hook `ngOnDestroy()` của Angular được kích hoạt tự động bởi V8 Engine khi bộ nhớ RAM đạt ngưỡng 90%.'
            ],
            correctIndex: 0,
            explanation: 'onModuleDestroy và beforeApplicationShutdown được NestJS gọi khi app.enableShutdownHooks() bắt được tín hiệu SIGTERM/SIGINT, cho phép đóng database pool an toàn.'
          },
          {
            id: 'q6-3',
            question: 'Dynamic Module trong NestJS (ví dụ: `ConfigModule.forRootAsync(...)`) thường được sử dụng trong trường hợp nào?',
            options: [
              'Khi module cần nhận các tham số cấu hình bất đồng bộ (như đọc DB, vault, env) trước khi khởi tạo providers.',
              'Khi muốn chuyển đổi ứng dụng backend từ kiến trúc monolithic sang serverless chỉ bằng một dòng lệnh.',
              'Khi cần nạp các component giao diện React JSX vào bên trong Express HTTP pipeline.',
              'Khi module chỉ được phép chạy duy nhất một lần và tự động xóa mã nguồn sau khi thực thi.'
            ],
            correctIndex: 0,
            explanation: 'Dynamic Module cung cấp các phương thức tĩnh như forRoot(), registerAsync() để truyền tham số runtime và cấu hình provider động.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Pagination & Sort Query Calculator',
          description: 'Viết hàm `buildPaginationMeta(total, page, pageSize, maxPageSize)`: Ép `pageSize` không vượt quá `maxPageSize` (mặc định 100), `page` tối thiểu là 1. Tính toán: `page`, `pageSize`, `total`, `totalPages`, `skip`, `take`, `hasNext`, `hasPrev`.',
          starterCode: `function buildPaginationMeta(total, page, pageSize, maxPageSize = 100) {
  // Viết logic tính toán phân trang
  
}`,
          solution: `function buildPaginationMeta(total, page, pageSize, maxPageSize = 100) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const rawSize = Math.max(1, parseInt(pageSize, 10) || 20);
  const safeSize = Math.min(rawSize, maxPageSize);
  const totalCount = Math.max(0, parseInt(total, 10) || 0);
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / safeSize) : 0;

  return {
    page: safePage,
    pageSize: safeSize,
    total: totalCount,
    totalPages,
    skip: (safePage - 1) * safeSize,
    take: safeSize,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1 && totalPages > 0
  };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): 95 items, page 1, size 20',
              input: [95, 1, 20, 100],
              expected: { page: 1, pageSize: 20, total: 95, totalPages: 5, skip: 0, take: 20, hasNext: true, hasPrev: false },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Cắt bớt pageSize khi vượt maxPageSize',
              input: [50, 1, 500, 50],
              expected: { page: 1, pageSize: 50, total: 50, totalPages: 1, skip: 0, take: 50, hasNext: false, hasPrev: false },
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Trang 3 của 5 trang -> hasNext & hasPrev đều true',
              input: [100, 3, 20, 100],
              expected: { page: 3, pageSize: 20, total: 100, totalPages: 5, skip: 40, take: 20, hasNext: true, hasPrev: true },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Âm total',
              input: [-10, 1, 20, 100],
              expected: {"page":1,"pageSize":20,"total":0,"totalPages":0,"skip":0,"take":20,"hasNext":false,"hasPrev":false},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Page âm',
              input: [100, -5, 20, 100],
              expected: {"page":1,"pageSize":20,"total":100,"totalPages":5,"skip":0,"take":20,"hasNext":true,"hasPrev":false},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Chuỗi rác',
              input: ['abc', 'def', 'ghi', 100],
              expected: {"page":1,"pageSize":100,"total":0,"totalPages":0,"skip":0,"take":100,"hasNext":false,"hasPrev":false},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Page zero',
              input: [50, 0, 10, 20],
              expected: {"page":1,"pageSize":10,"total":50,"totalPages":5,"skip":0,"take":10,"hasNext":true,"hasPrev":false},
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-7',
        title: 'Bài 07: DTOs, Validation Pipe & Swagger OpenAPI',
        duration: '45 phút',
        tag: 'Validation',
        theory: `
### 1. Tại Sao DTO Phải Dùng Class Thay Vì Interface?
- **TypeScript Interface:** Bị xóa sổ hoàn toàn sau khi compile sang JavaScript (\`tsc\`). Ở runtime không còn thông tin gì để validate!
- **TypeScript Class:** Được giữ lại ở runtime JavaScript. Thư viện \`class-validator\` và \`class-transformer\` sử dụng Metadata Reflection để đọc các decorator (\`@IsString()\`, \`@IsNotEmpty()\`, \`@Min(0)\`) và tự động chặn request sai trước khi chạm vào Controller!

### 2. Validation Pipe & Tự Động Xóa Dữ Liệu Rác (Whitelist):
\`\`\`typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true, // Tự động xóa sạch các trường không khai báo trong DTO (Chống Mass Assignment Attack)
  forbidNonWhitelisted: true, // Báo lỗi 400 nếu client cố tình gửi trường lạ
  transform: true, // Tự ép kiểu string "20" sang number 20
}));
\`\`\`
        `,
        realCodeSnippet: `// Trích DTO chuẩn từ eSmiles
export class CreateInventoryItemDto {
  @ApiProperty({ description: 'Mã vật tư', example: 'VTTH-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Giá bán', example: 150000 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price!: number;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}`,
        quiz: [
          {
            id: 'q7-1',
            question: 'Khi cấu hình `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, hành vi của server là gì khi client gửi thêm trường lạ?',
            options: [
              'Server tự động lưu trường lạ đó vào một bảng tạm thời trong cơ sở dữ liệu để kiểm tra sau.',
              'Server lập tức từ chối request và trả về lỗi 400 Bad Request kèm thông báo trường không được phép tồn tại.',
              'Server âm thầm bỏ qua trường lạ đó và chỉ xử lý các trường đã được khai báo trong class DTO.',
              'Server tự động mã hóa trường lạ đó bằng thuật toán SHA256 trước khi chuyển tiếp cho Controller.'
            ],
            correctIndex: 1,
            explanation: 'whitelist: true lọc bỏ thuộc tính thừa; forbidNonWhitelisted: true sẽ ném lỗi HTTP 400 nếu phát hiện thuộc tính thừa, ngăn chặn tấn công Over-posting / Mass Assignment.'
          },
          {
            id: 'q7-2',
            question: 'Tại sao trong NestJS DTO bắt buộc phải dùng `class` thay vì `interface` của TypeScript?',
            options: [
              'Vì TypeScript Interface bị xóa bỏ hoàn toàn (type erasure) khi compile sang JavaScript, không còn metadata runtime cho class-validator đọc.',
              'Vì NestJS compiler không hỗ trợ cú pháp interface trong các thư mục src của dự án backend.',
              'Vì class có tốc độ xử lý nhanh hơn interface gấp 10 lần trong V8 Engine của Node.js.',
              'Vì interface chỉ dùng được cho các ứng dụng chạy trên trình duyệt web Frontend.'
            ],
            correctIndex: 0,
            explanation: 'Interface chỉ tồn tại ở thời điểm compile. Khi sang JS runtime, interface biến mất hoàn toàn. Class được giữ lại dưới dạng Constructor Function và chứa Decorator Metadata để class-validator và Reflection API hoạt động.'
          },
          {
            id: 'q7-3',
            question: 'Decorator `@Type(() => Number)` từ thư viện class-transformer có nhiệm vụ quan trọng nào khi nhận Query Params?',
            options: [
              'Chuyển đổi chuỗi ký tự string từ URL (vd: "20") thành số number thực tế để các decorator @Min / @Max validate chính xác.',
              'Tự động tăng giá trị số đó lên gấp đôi trước khi lưu trữ vào bảng cơ sở dữ liệu PostgreSQL.',
              'Mã hóa giá trị số thành chuỗi nhị phân bảo mật để truyền tải qua giao thức HTTPS.',
              'Kiểm tra xem số đó có phải là số nguyên tố trong thuật toán mã hóa khóa công khai RSA.'
            ],
            correctIndex: 0,
            explanation: 'Query parameters luôn được HTTP parser nạp dưới dạng string. @Type(() => Number) chỉ định class-transformer parse sang number trước khi validation rule chạy.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Whitelist DTO Sanitizer & Validator',
          description: 'Viết hàm `sanitizeAndValidateDto(schema, rawInput)`: 1. Chỉ giữ lại các trường có trong `schema` (Whitelist). 2. Kiểm tra các trường bắt buộc (`required: true`) phải có và không rỗng. 3. Ép kiểu: `type: "number"` chuyển thành số, `type: "boolean"` chuyển thành boolean. Nếu lỗi ném `Error("VALIDATION_FAILED: " + field)`.',
          starterCode: `function sanitizeAndValidateDto(schema, rawInput) {
  // Viết logic whitelist & validate DTO
  
}`,
          solution: `function sanitizeAndValidateDto(schema, rawInput) {
  if (!rawInput || typeof rawInput !== 'object') {
    throw new Error("VALIDATION_FAILED: payload");
  }
  const result = {};
  for (const [field, rules] of Object.entries(schema)) {
    let val = rawInput[field];
    if (rules.required && (val === undefined || val === null || val === '')) {
      throw new Error("VALIDATION_FAILED: " + field);
    }
    if (val !== undefined && val !== null) {
      if (rules.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) throw new Error("VALIDATION_FAILED: " + field);
        val = num;
      } else if (rules.type === 'boolean') {
        val = Boolean(val);
      } else if (rules.type === 'string') {
        val = String(val).trim();
      }
      result[field] = val;
    }
  }
  return result;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Whitelist trường và ép kiểu number',
              input: [
                { code: { required: true, type: 'string' }, price: { required: true, type: 'number' } },
                { code: '  VTTH ', price: '15000', hackerField: 'IS_ADMIN' }
              ],
              expected: { code: 'VTTH', price: 15000 },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Thiếu trường bắt buộc -> Ném lỗi',
              input: [
                { name: { required: true, type: 'string' } },
                { code: 'VTTH' }
              ],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Sai kiểu number (truyền chuỗi không phải số) -> Ném lỗi',
              input: [
                { price: { required: true, type: 'number' } },
                { price: 'NOT_A_NUMBER' }
              ],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Payload rỗng, DTO có required',
              input: [{}, {"name":"required"}],
              expected: {"isValid":false,"errors":["name:required"]},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): DTO sai rule',
              input: [{"a":1}, {"a":"string"}],
              expected: {"isValid":false,"errors":["a:string"]},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Thừa trường (không bị bắt)',
              input: [{"a":1,"b":2}, {"a":"number"}],
              expected: {"isValid":true,"errors":[]},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Null object',
              input: [null, {}],
              expected: {"isValid":false,"errors":[]},
              hidden: true
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 2,
    sprintTitle: 'Sprint 2: Cơ Sở Dữ Liệu PostgreSQL & Prisma 7',
    sprintDesc: 'Làm chủ Data Modeling, Multi-file Schema, Quan hệ 1-N/N-N, Transactions ACID, Concurrency Locking & Multi-Tenancy',
    lessons: [
      {
        id: 'lesson-8',
        title: 'Bài 08: Tư Duy Thiết Kế Database Quan Hệ & Indexing',
        duration: '50 phút',
        tag: 'Database Modeling',
        theory: `
### 1. Sự Khác Biệt Giữa Lưu JSON Trên FE và PostgreSQL Relational DB
- Trên FE: Dữ liệu là JSON lồng nhau tùy biến (\`{ order: { items: [...] } }\`).
- Trên PostgreSQL: Dữ liệu được **chuẩn hóa (Normalized)** thành các bảng phẳng:
  - Khóa chính (Primary Key - UUIDv4) định danh bản ghi toàn cục.
  - Khóa ngoại (Foreign Key) thiết lập mối quan hệ: 1-1, 1-N, N-N.
  - Ràng buộc \`onDelete: Restrict\` (Bảo vệ dữ liệu y tế - cấm xóa danh mục đang có sản phẩm liên kết).

### 2. Tối Ưu Tốc Độ Bằng B-Tree Index:
Nếu bảng \`Appointment\` có 1,000,000 dòng:
- **Không có Index:** PostgreSQL phải duyệt qua cả 1,000,000 dòng (Sequential Scan - mất 800ms) -> Server quá tải.
- **Có Index (\`@@index([unitId, date])\`):** PostgreSQL tìm kiếm bằng cây nhị phân B-Tree chỉ mất **2ms**!
        `,
        realCodeSnippet: `// Trích từ prisma/schema/inventory.prisma
model InventoryItem {
  id          String   @id @default(uuid()) @db.Uuid
  unitId      String   @map("unit_id") @db.Uuid
  categoryId  String   @map("category_id") @db.Uuid
  code        String   @db.VarChar(50)
  name        String   @db.VarChar(255)
  price       Decimal  @db.Decimal(15, 2)
  isActive    Boolean  @default(true) @map("is_active")

  category InventoryCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@unique([unitId, code], name: "uq_inventory_item_unit_code")
  @@index([unitId, categoryId])
  @@index([unitId, isActive])
  @@map("inventory_item")
}`,
        quiz: [
          {
            id: 'q8-1',
            question: 'Tại sao trong hệ thống y tế như eSmiles, quan hệ giữa Bệnh Nhân và Bệnh Án phải đặt "onDelete: Restrict" thay vì "onDelete: Cascade"?',
            options: [
              'Để tăng tốc độ load trang và tiết kiệm băng thông mạng khi người dùng thao tác xóa trên giao diện Frontend.',
              'Để bảo vệ pháp lý: Không cho phép bất kỳ ai vô tình xóa mất hồ sơ bệnh án y khoa đã phát sinh của bệnh nhân.',
              'Vì Prisma 7 và cơ sở dữ liệu PostgreSQL không hỗ trợ cơ chế Cascade đối với các bảng có khóa chính là UUID.',
              'Để hệ điều hành Linux không phải kích hoạt cơ chế dọn dẹp rác (Garbage Collection) trên đĩa cứng máy chủ.'
            ],
            correctIndex: 1,
            explanation: 'Restrict là cơ chế bảo vệ tính toàn vẹn và tính pháp lý của dữ liệu y khoa, ngăn chặn việc xóa cha làm biến mất hàng loạt dữ liệu con quan trọng.'
          },
          {
            id: 'q8-2',
            question: 'B-Tree Index trong PostgreSQL tác động như thế nào đến hiệu năng của các thao tác dữ liệu?',
            options: [
              'Tăng tốc truy vấn SELECT/WHERE theo cấp số nhân, nhưng làm chậm nhẹ các thao tác ghi INSERT/UPDATE/DELETE.',
              'Làm chậm đáng kể các câu lệnh SELECT và chỉ có tác dụng tăng tốc độ khi thực hiện câu lệnh chèn INSERT.',
              'Tăng tốc đồng đều tất cả mọi thao tác đọc/ghi mà hoàn toàn không tiêu tốn thêm dung lượng đĩa cứng lưu trữ.',
              'Chỉ có tác dụng đối với các cột có kiểu dữ liệu là số nguyên (INTEGER) và vô tác dụng với chuỗi ký tự hay UUID.'
            ],
            correctIndex: 0,
            explanation: 'Index giúp truy vấn SELECT nhanh gấp hàng trăm lần, nhưng mỗi khi INSERT/UPDATE, DB phải cập nhật lại cấu trúc cây Index trên đĩa.'
          },
          {
            id: 'q8-3',
            question: 'Ràng buộc Composite Unique `@@unique([unitId, code])` mang ý nghĩa bảo mật và thiết kế nào trong kiến trúc Multi-tenancy?',
            options: [
              'Mã code của sản phẩm bắt buộc phải là duy nhất trên toàn cầu đối với tất cả các phòng khám trong hệ thống.',
              'Mã code là duy nhất trong phạm vi từng chi nhánh (unitId), hai phòng khám khác nhau vẫn có thể đặt trùng mã code.',
              'Cơ sở dữ liệu PostgreSQL sẽ tự động tạo chuỗi ngẫu nhiên cho cột code nếu người dùng gửi giá trị rỗng lên server.',
              'Khóa ngoại của bảng cha sẽ tự động cập nhật giá trị mới khi cột code của bảng con bị thay đổi giá trị.'
            ],
            correctIndex: 1,
            explanation: 'Composite Unique đảm bảo tính duy nhất theo phạm vi từng tenant, cho phép các phòng khám độc lập tự đặt mã sản phẩm mà không bị xung đột nhau.'
          }
        ],
        codeChallenge: {
          title: 'Dynamic Multi-Field Prisma Query Filter Builder',
          description: 'Viết hàm `buildDynamicPrismaFilter(unitId, filters)` nhận `unitId` và `filters: { q?: string, status?: string, minPrice?: number, maxPrice?: number }`. Trả về Prisma Where Clause Object an toàn: bắt buộc có `unitId`, tìm kiếm case-insensitive trên `name` hoặc `code` khi có `q`, lọc theo `status`, và khoảng giá `price: { gte, lte }`.',
          starterCode: `function buildDynamicPrismaFilter(unitId, filters) {
  // Viết logic xây dựng where clause
  
}`,
          solution: `function buildDynamicPrismaFilter(unitId, filters) {
  if (!unitId || typeof unitId !== 'string') throw new Error("INVALID_UNIT_ID");
  const where = { unitId: unitId.trim() };
  if (filters?.status) {
    where.status = String(filters.status).trim();
  }
  if (filters?.q && String(filters.q).trim()) {
    const term = String(filters.q).trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { code: { contains: term, mode: 'insensitive' } }
    ];
  }
  const priceFilter = {};
  if (typeof filters?.minPrice === 'number' && !isNaN(filters.minPrice)) {
    priceFilter.gte = filters.minPrice;
  }
  if (typeof filters?.maxPrice === 'number' && !isNaN(filters.maxPrice)) {
    priceFilter.lte = filters.maxPrice;
  }
  if (Object.keys(priceFilter).length > 0) {
    where.price = priceFilter;
  }
  return where;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Lọc theo q và khoảng giá',
              input: ['u-10', { q: 'kim tiêm', minPrice: 10000, maxPrice: 50000 }],
              expected: {
                unitId: 'u-10',
                OR: [{ name: { contains: 'kim tiêm', mode: 'insensitive' } }, { code: { contains: 'kim tiêm', mode: 'insensitive' } }],
                price: { gte: 10000, lte: 50000 }
              },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Thiếu unitId -> Ném lỗi',
              input: ['', { q: 'test' }],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Lọc theo status',
              input: ['u-20', { status: 'ACTIVE' }],
              expected: { unitId: 'u-20', status: 'ACTIVE' },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Không có tenantId',
              input: ['SELECT * FROM user', ''],
              expected: 'SELECT * FROM user',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): SQL injection attempt',
              input: ['SELECT * FROM t', '1 OR 1=1'],
              expected: 'SELECT * FROM (SELECT * FROM t) AS T WHERE tenant_id = \'1 OR 1=1\'',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Table name rác',
              input: ['DROP TABLE', '123'],
              expected: 'SELECT * FROM (DROP TABLE) AS T WHERE tenant_id = \'123\'',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): SQL complex',
              input: ['SELECT a, b FROM c JOIN d', 'u1'],
              expected: 'SELECT * FROM (SELECT a, b FROM c JOIN d) AS T WHERE tenant_id = \'u1\'',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-9',
        title: 'Bài 09: Prisma 7 Multi-file Schema & Migrations',
        duration: '45 phút',
        tag: 'Prisma ORM',
        theory: `
### 1. Kiến Trúc Multi-File Schema Trong eSmiles
Dự án eSmiles sử dụng **Prisma 7 Early Access** cho phép chia nhỏ schema thành nhiều file độc lập trong \`prisma/schema/\`:
- \`tenancy.prisma\`: Cấu trúc Group, Unit, Branch.
- \`identity.prisma\`: Account, Role, Permission.
- \`inventory.prisma\`: Warehouse, Category, Item, StockBalance.
- \`scheduling.prisma\`: Appointment, Chair, DoctorWorkingShift.

### 2. Chu Trình Quản Lý Database Migration:
1. Sửa file \`*.prisma\`.
2. Chạy \`pnpm prisma:generate\` để sinh lại TypeScript Type.
3. Chạy \`pnpm prisma:migrate\` để sinh file SQL migration trong \`prisma/migrations/\`.
4. Chạy \`pnpm db:seed:core\` để nạp dữ liệu cơ sở ban đầu.
        `,
        realCodeSnippet: `// Trích cấu hình prisma.config.ts trong eSmiles
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema', // Đọc toàn bộ thư mục schema
});`,
        quiz: [
          {
            id: 'q9-1',
            question: 'Lợi ích lớn nhất của tính năng Multi-file Schema trong Prisma 7 (`prisma/schema/*.prisma`) là gì?',
            options: [
              'Tránh việc toàn bộ 50+ bảng dữ liệu bị nhồi nhét vào 1 file duy nhất, giúp các team làm việc song song không bị xung đột Git conflict.',
              'Tự động tăng tốc độ xử lý các câu lệnh JOIN bảng lên gấp đôi nhờ việc chia nhỏ file trên đĩa cứng máy chủ.',
              'Cho phép kết nối đồng thời với 10 cơ sở dữ liệu khác nhau (MySQL, MongoDB, PostgreSQL) trong cùng một service.',
              'Tự động sao lưu toàn bộ dữ liệu ra các file Excel trên Google Drive mỗi khi có lệnh migration được kích hoạt.'
            ],
            correctIndex: 0,
            explanation: 'Multi-file schema giúp phân tách ranh giới module rõ ràng, tránh merge conflict khi nhiều team cùng phát triển các domain khác nhau.'
          },
          {
            id: 'q9-2',
            question: 'Khi triển khai ứng dụng lên môi trường Production qua CI/CD Pipeline, câu lệnh nào là chuẩn mực để chạy Migration?',
            options: [
              'Lệnh `npx prisma migrate dev` để tạo tự động các file SQL migration mới trực tiếp trên máy chủ Production.',
              'Lệnh `npx prisma migrate deploy` để áp dụng các file SQL migration đã kiểm duyệt vào DB mà không sinh thêm file mới.',
              'Lệnh `npx prisma db push --force-reset` để xóa toàn bộ cấu trúc cũ và tạo lại bảng mới từ schema hiện tại.',
              'Lệnh `npx prisma studio` để mở giao diện quản trị đồ họa và nhấn nút đồng bộ cơ sở dữ liệu bằng tay.'
            ],
            correctIndex: 1,
            explanation: 'prisma migrate deploy chỉ áp dụng các migration SQL chưa chạy vào Production mà không tạo migration mới và không reset database.'
          },
          {
            id: 'q9-3',
            question: 'Tại sao tuyệt đối KHÔNG ĐƯỢC sử dụng câu lệnh `prisma db push` trên môi trường Production của doanh nghiệp?',
            options: [
              'Vì `db push` có thể tự ý drop bảng hoặc xóa cột gây mất vĩnh viễn dữ liệu người dùng mà không lưu lại lịch sử migration có thể rollback.',
              'Vì lệnh `db push` chỉ hoạt động được trên hệ điều hành Windows và hoàn toàn không tương thích với máy chủ Linux/Docker.',
              'Vì câu lệnh này bắt buộc phải có kết nối Bluetooth trực tiếp với máy chủ cơ sở dữ liệu mới có thể thực thi.',
              'Vì `db push` sẽ tự động chuyển toàn bộ cơ sở dữ liệu PostgreSQL sang dạng NoSQL MongoDB mà không báo trước.'
            ],
            correctIndex: 0,
            explanation: 'prisma db push đồng bộ trực tiếp schema lên DB và sẵn sàng drop table/column nếu phát hiện thay đổi, rất nguy hiểm cho Production.'
          }
        ],
        codeChallenge: {
          title: 'Database Table & Column Name Naming Convention Sanitizer',
          description: 'Viết hàm `toSnakeCaseColumnName(propertyName)` chuyển đổi tên thuộc tính camelCase (vd: `patientMedicalRecordId`) thành snake_case chuẩn Database (`patient_medical_record_id`). Đảm bảo xử lý đúng cả trường hợp có số (vd: `step2Action` -> `step_2_action`).',
          starterCode: `function toSnakeCaseColumnName(propertyName) {
  // Viết logic chuyển đổi camelCase sang snake_case
  
}`,
          solution: `function toSnakeCaseColumnName(propertyName) {
  if (!propertyName || typeof propertyName !== 'string') return '';
  return propertyName
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/([a-zA-Z])([0-9])/g, '$1_$2')
    .replace(/([0-9])([a-zA-Z])/g, '$1_$2')
    .toLowerCase();
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): patientMedicalRecordId -> patient_medical_record_id',
              input: ['patientMedicalRecordId'],
              expected: 'patient_medical_record_id',
              hidden: false
            },
            {
              name: 'Case 2 (Visible): step2Action -> step_2_action',
              input: ['step2Action'],
              expected: 'step_2_action',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Chuỗi rỗng -> chuỗi rỗng',
              input: [''],
              expected: '',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Schema rỗng',
              input: [''],
              expected: [],
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Models không có field',
              input: ['model A {}'],
              expected: ["A"],
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Nhiều model và enum',
              input: ['model A{} enum B{} model C{}'],
              expected: ["A","C"],
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Dư model trong string',
              input: ['model   test  {'],
              expected: ["test"],
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-10',
        title: 'Bài 10: Prisma CRUD & Giải Quyết Triệt Để N+1 Query',
        duration: '50 phút',
        tag: 'Query Optimization',
        theory: `
### 1. Hiểm Họa N+1 Query Trong Backend
Xem đoạn code sai lầm sau:
\`\`\`typescript
// SAI: 1 câu lấy danh sách + 100 câu lấy tên bác sĩ = 101 CÂU QUERY XUỐNG DATABASE!
const appointments = await prisma.appointment.findMany({ take: 100 });
for (const appt of appointments) {
  appt.doctor = await prisma.doctorProfile.findUnique({ where: { id: appt.doctorId } });
}
\`\`\`

### 2. Hai Giải Pháp Chuẩn Mực Trong eSmiles:
- **Cách 1: Prisma \`include\` / \`select\` (JOIN ngầm):**
  \`\`\`typescript
  const appointments = await prisma.appointment.findMany({
    include: { doctor: { select: { id: true, fullName: true } } },
  });
  \`\`\`
- **Cách 2: Batch ID Lookup (Kỹ thuật DataLoader):** Gom tất cả \`doctorIds\` duy nhất, gửi đúng 1 câu \`findMany({ where: { id: { in: uniqueIds } } })\` rồi map bằng \`Map<id, name>\` trong RAM.
        `,
        realCodeSnippet: `// Trích resolver tên bác sĩ trong eSmiles
export async function resolveDoctorNames(prisma: PrismaService, unitId: string, doctorIds: string[]) {
  const uniqueIds = Array.from(new Set(doctorIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map<string, string>();

  const doctors = await prisma.doctorProfile.findMany({
    where: { unitId, id: { in: uniqueIds } },
    select: { id: true, fullName: true },
  });

  return new Map(doctors.map(d => [d.id, d.fullName]));
}`,
        quiz: [
          {
            id: 'q10-1',
            question: 'Tại sao việc gọi query Database lặp đi lặp lại bên trong vòng lặp for (N+1 Query) là nguyên nhân hàng đầu làm suy kiệt hệ thống?',
            options: [
              'Vì làm cạn kiệt Connection Pool của Database và làm tăng thời gian phản hồi API từ vài mili-giây lên hàng chục giây.',
              'Vì TypeScript runtime sẽ tự động ngắt kết nối mạng khi phát hiện có nhiều hơn 5 câu query trong 1 hàm.',
              'Vì cơ sở dữ liệu PostgreSQL sẽ tự động khóa bảng ở chế độ Read-Only vĩnh viễn để bảo vệ đĩa cứng.',
              'Vì trình duyệt web của người dùng sẽ tự động gửi mã độc lên máy chủ khi thời gian chờ vượt quá 100ms.'
            ],
            correctIndex: 0,
            explanation: 'Mỗi câu query tốn chi phí mở kết nối, truyền gói tin mạng TCP và thực thi trên DB. 100 câu query lặp làm nghẽn toàn bộ Connection Pool của hệ thống.'
          },
          {
            id: 'q10-2',
            question: 'Trong Prisma, khi chỉ cần hiển thị một số trường nhất định của bảng liên kết, ta nên dùng tùy chọn nào để tối ưu RAM và băng thông?',
            options: [
              'Tùy chọn `select: { id: true, fullName: true }` để DB chỉ serialize và trả về đúng các cột được yêu cầu.',
              'Tùy chọn `include: { _all: true }` để nạp toàn bộ các bảng con vào bộ nhớ đệm RAM của máy chủ Node.js.',
              'Tùy chọn `where: { isActive: true }` kết hợp với việc xóa bớt các thuộc tính thừa bằng lệnh delete trong JS.',
              'Tùy chọn `orderBy: { createdAt: "desc" }` để DB tự động sắp xếp và nén dữ liệu nhị phân trước khi gửi.'
            ],
            correctIndex: 0,
            explanation: 'select cho phép chỉ định chính xác các cột cần lấy từ DB, giảm dung lượng dữ liệu truyền qua mạng và RAM của server.'
          },
          {
            id: 'q10-3',
            question: 'Kỹ thuật Batching (`id: { in: uniqueIds }`) giải quyết triệt để bài toán N+1 Query theo cơ chế nào?',
            options: [
              'Thu thập toàn bộ N ID cần tìm trong mảng và gửi đúng 1 câu query duy nhất với mệnh đề SQL `WHERE id IN (...)`.',
              'Tạo ra N tiến trình con chạy song song trên N lõi CPU để thực thi N câu lệnh truy vấn cùng một lúc.',
              'Lưu trữ toàn bộ cơ sở dữ liệu PostgreSQL vào một file JSON tĩnh trong thư mục public của Frontend.',
              'Sử dụng hàm setTimeout 10ms giữa mỗi câu query để Database có thời gian nghỉ ngơi giải phóng RAM.'
            ],
            correctIndex: 0,
            explanation: 'Thay vì N câu query riêng lẻ, Batching chỉ thực hiện 1 câu query duy nhất gom tất cả ID lại với độ phức tạp O(1) round-trip mạng.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng High-Performance Batch Entity Mapper',
          description: 'Viết hàm `batchMapRelatedEntities(primaryList, foreignKey, lookupData, targetField)`: Nhận vào `primaryList: Array<Object>`, `foreignKey: string`, `lookupData: Array<{ id: string, name: string }>` và gán `{ [targetField]: lookupMap.get(item[foreignKey]) || null }` cho từng item. Không làm biến đổi mảng gốc (Immutability).',
          starterCode: `function batchMapRelatedEntities(primaryList, foreignKey, lookupData, targetField) {
  // Viết logic map batch hiệu năng cao bằng Map O(1)
  
}`,
          solution: `function batchMapRelatedEntities(primaryList, foreignKey, lookupData, targetField) {
  if (!Array.isArray(primaryList)) return [];
  const map = new Map((lookupData || []).map(item => [item.id, item.name]));
  return primaryList.map(row => ({
    ...row,
    [targetField]: map.get(row[foreignKey]) || null
  }));
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Map categoryName vào danh sách sản phẩm',
              input: [
                [{ id: 'i1', categoryId: 'c1' }, { id: 'i2', categoryId: 'c2' }],
                'categoryId',
                [{ id: 'c1', name: 'Vật tư tiêu hao' }, { id: 'c2', name: 'Thuốc kháng sinh' }],
                'categoryName'
              ],
              expected: [
                { id: 'i1', categoryId: 'c1', categoryName: 'Vật tư tiêu hao' },
                { id: 'i2', categoryId: 'c2', categoryName: 'Thuốc kháng sinh' }
              ],
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Item không có categoryId -> Trả về null an toàn',
              input: [
                [{ id: 'i3', categoryId: 'c99' }],
                'categoryId',
                [{ id: 'c1', name: 'VTTH' }],
                'categoryName'
              ],
              expected: [{ id: 'i3', categoryId: 'c99', categoryName: null }],
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): List rỗng',
              input: [[], []],
              expected: [],
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Không có parent khớp',
              input: [[{"id":1,"pId":99}], []],
              expected: [{"id":1,"pId":99,"parent":null}],
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Nhiều phần tử trỏ cùng 1 parent',
              input: [[{"id":1,"pId":10},{"id":2,"pId":10}], [{"id":10,"name":"P"}]],
              expected: [{"id":1,"pId":10,"parent":{"id":10,"name":"P"}},{"id":2,"pId":10,"parent":{"id":10,"name":"P"}}],
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Không pId',
              input: [[{"id":1}], [{"id":1}]],
              expected: [{"id":1,"parent":null}],
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-11',
        title: 'Bài 11: Database Transactions & Concurrency Locking',
        duration: '50 phút',
        tag: 'Transactions & ACID',
        theory: `
### 1. Tính Chất ACID Của Database Giao Dịch
Trong hệ thống tài chính & kho vận eSmiles:
- **Atomicity (Nguyên tử):** Thao tác chuyển tiền từ Kho A sang Kho B gồm: Trừ kho A và Cộng kho B. Nếu cộng kho B bị lỗi mạng -> Trừ kho A phải **tự động Rollback** quay về như cũ! Không bao giờ có chuyện mất tiền giữa chừng.
- **Consistency (Nhất quán):** Dữ liệu không bao giờ vi phạm ràng buộc (vd: số lượng tồn kho không được âm).
- **Isolation (Cô lập):** Hai bác sĩ cùng bấm kê đơn thuốc cuối cùng không được phép làm số lượng âm.
- **Durability (Bền vững):** Dữ liệu đã commit sẽ lưu an toàn vào ổ cứng dù server bị mất điện ngay sau đó.

### 2. Transaction Trong Prisma 7:
\`\`\`typescript
await this.prisma.$transaction(async (tx) => {
  const debited = await tx.stockBalance.updateMany({
    where: { warehouseId: fromWh, itemId, unitId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (debited.count !== 1) throw new Error("INSUFFICIENT_STOCK");
  await tx.stockBalance.update({
    where: { warehouseId_itemId: { warehouseId: toWh, itemId } },
    data: { quantity: { increment: qty } },
  });
});
\`\`\`
        `,
        realCodeSnippet: `// Trích Transaction chuyển kho an toàn trong eSmiles
async transferStock(unitId: string, fromWh: string, toWh: string, itemId: string, qty: number) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Conditional update: chỉ trừ nếu số dư đủ, tránh đọc rồi ghi bị race.
    const debited = await tx.stockBalance.updateMany({
      where: { warehouseId: fromWh, itemId, unitId, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_STOCK");

    // 2. Cộng kho đích
    return tx.stockBalance.upsert({
      where: { warehouseId_itemId_unitId: { warehouseId: toWh, itemId, unitId } },
      create: { warehouseId: toWh, itemId, unitId, quantity: qty },
      update: { quantity: { increment: qty } },
    });
  });
}`,
        quiz: [
          {
            id: 'q11-1',
            question: 'Trong khối `prisma.$transaction(async (tx) => { ... })`, nếu câu lệnh thứ 2 ném Exception thì điều gì xảy ra với câu lệnh thứ 1?',
            options: [
              'Câu lệnh thứ 1 vẫn lưu vào Database, chỉ câu lệnh thứ 2 bị hủy bỏ và ghi log cảnh báo.',
              'Toàn bộ Transaction tự động Rollback (hủy bỏ hoàn toàn các thay đổi của câu 1), Database quay về nguyên trạng ban đầu.',
              'Cơ sở dữ liệu PostgreSQL sẽ bị khóa vĩnh viễn và yêu cầu khởi động lại máy chủ vật lý.',
              'Tiến trình server Node.js sẽ tự động crash và xóa toàn bộ dữ liệu tạm thời trong RAM.'
            ],
            correctIndex: 1,
            explanation: 'Tính chất Atomicity (Nguyên tử) đảm bảo nguyên tắc: Tất cả các câu lệnh cùng thành công hoặc không có bất kỳ câu lệnh nào được lưu.'
          },
          {
            id: 'q11-2',
            question: 'Để chống Race Condition khi 2 bác sĩ cùng đặt 1 lịch hẹn hoặc trừ tồn kho cùng lúc, giải pháp chuẩn trong Prisma là gì?',
            options: [
              'Đọc dữ liệu ra RAM, kiểm tra bằng câu lệnh if/else trong JavaScript rồi mới gọi lệnh update thông thường.',
              'Sử dụng Database Transaction kết hợp Conditional Update (updateMany có where số lượng >= cần trừ) hoặc Pessimistic Locking.',
              'Tăng thêm dung lượng RAM của máy chủ Node.js lên gấp đôi để xử lý 2 request nhanh hơn.',
              'Sử dụng hàm setTimeout 500ms giữa 2 request để tránh việc 2 người bấm nút cùng một giây.'
            ],
            correctIndex: 1,
            explanation: 'Atomic Conditional Update (`UPDATE items SET quantity = quantity - X WHERE id = Y AND quantity >= X`) xử lý triệt để Race Condition ngay tại mức Engine Database mà không sợ lag giữa tầng Node.js và DB.'
          },
          {
            id: 'q11-3',
            question: 'Mức độ cô lập giao dịch (Transaction Isolation Level) mặc định của PostgreSQL là gì và đảm bảo điều gì?',
            options: [
              'Read Committed: Giao dịch chỉ đọc được những dữ liệu đã được Commit bởi các giao dịch khác trước đó.',
              'Read Uncommitted: Cho phép đọc dữ liệu rác (Dirty Read) đang được chỉnh sửa dở dang bởi transaction khác.',
              'Serializable: Khóa toàn bộ bảng dữ liệu và chỉ cho phép duy nhất một người dùng kết nối tại một thời điểm.',
              'Repeatable Read: Tự động nhân bản bảng dữ liệu ra nhiều bản sao tạm thời trong bộ nhớ đệm RAM.'
            ],
            correctIndex: 0,
            explanation: 'Read Committed là mức cô lập mặc định của PostgreSQL, ngăn chặn Dirty Read và cân bằng giữa tính toàn vẹn dữ liệu và hiệu năng concurrency.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Transactional Ledger Balance Runner',
          description: 'Viết hàm `executeLedgerTransfer(dbMock, fromAccountId, toAccountId, amount)`: 1. Nếu `amount <= 0` ném `Error("INVALID_AMOUNT")`. 2. Nếu `fromAccountId === toAccountId` ném `Error("SAME_ACCOUNT")`. 3. Thực hiện trong `dbMock.$transaction`: gọi `dbMock.debit(fromAccountId, amount)` (nếu số dư còn lại < 0 thì ném `Error("INSUFFICIENT_FUNDS")`), gọi `dbMock.credit(toAccountId, amount)`. Trả về `{ success: true, transferredAmount: amount }`.',
          starterCode: `async function executeLedgerTransfer(dbMock, fromAccountId, toAccountId, amount) {
  // Viết logic transaction an toàn
  
}`,
          solution: `async function executeLedgerTransfer(dbMock, fromAccountId, toAccountId, amount) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  if (fromAccountId === toAccountId) {
    throw new Error("SAME_ACCOUNT");
  }
  return dbMock.$transaction(async (tx) => {
    const fromAcc = await tx.debit(fromAccountId, amount);
    if (fromAcc.balance < 0) {
      throw new Error("INSUFFICIENT_FUNDS");
    }
    await tx.credit(toAccountId, amount);
    return { success: true, transferredAmount: amount };
  });
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Chuyển tiền thành công',
              input: [
                {
                  $transaction: async (fn) => fn({
                    debit: async () => ({ balance: 500000 }),
                    credit: async () => true
                  })
                },
                'acc-1',
                'acc-2',
                200000
              ],
              expected: { success: true, transferredAmount: 200000 },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Số tiền âm -> Báo lỗi',
              input: [{}, 'acc-1', 'acc-2', -50000],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Trùng tài khoản gửi và nhận -> Báo lỗi',
              input: [{}, 'acc-1', 'acc-1', 100000],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Lỗi tx bị reject',
              input: [async () => { throw new Error('fail'); }],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Không callback',
              input: [null],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Return object rỗng',
              input: [async () => ({})],
              expected: {"success":true,"result":{}},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Error normal string',
              input: [async () => { throw 'error'; }],
              expected: 'ERROR_THROWN',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-12',
        title: 'Bài 12: Multi-Tenancy Isolation & Bảo Mật Tenant Scope',
        duration: '45 phút',
        tag: 'Multi-Tenancy',
        theory: `
### 1. Mô Hình Đa Chi Nhánh (Multi-Tenancy) Của eSmiles
Hệ thống eSmiles phục vụ cùng lúc hàng trăm chuỗi nha khoa:
- **Group (Tập đoàn):** Cấp cao nhất (ví dụ: Tập đoàn Nha Khoa eSmiles Holdings).
- **Unit (Phòng khám / Pháp nhân):** Đơn vị cô lập dữ liệu chính. Toàn bộ Bệnh nhân, Kho, Bác sĩ, Doanh thu thuộc về Unit.
- **Branch (Chi nhánh phòng khám):** Địa điểm đặt ghế khám trực thuộc Unit.

\`\`\`
[ Group: eSmiles Group ]
   ├── [ Unit: Nha Khoa Quận 1 ] ──┬── [ Branch: Cơ sở Nguyễn Huệ ]
   │                               └── [ Branch: Cơ sở Hai Bà Trưng ]
   └── [ Unit: Nha Khoa Cần Thơ ] ─── [ Branch: Cơ sở Ninh Kiều ]
\`\`\`

### 2. Quy Tắc Bất Biến: Chống Lỗ Hổng IDOR Xuyên Tenant
> **Mọi truy cập tenant-scoped phải chứng minh active scope ở tầng truy vấn hoặc qua relation/compound key tương đương.** Với entity thuộc Unit trực tiếp, điều đó thường là \`where: { id, unitId }\`.
Không có một cú pháp duy nhất cho mọi query: platform-admin và aggregate có scope khác. Invariant cần giữ là request của Unit A không thể đọc/ghi tài nguyên của Unit B, kể cả khi client đoán đúng \`id\`.
        `,
        realCodeSnippet: `// Trích Service đảm bảo Tenant Isolation 100% trong eSmiles
async update(unitId: string, id: string, dto: UpdateInventoryCategoryDto) {
  // Cập nhật có scope nguyên tử; count = 0 không tiết lộ có bản ghi tenant khác hay không.
  const updated = await this.prisma.inventoryCategory.updateMany({
    where: { id, unitId },
    data: { name: dto.name },
  });
  if (updated.count !== 1) throw new NotFoundException('Không tìm thấy danh mục');
}`,
        quiz: [
          {
            id: 'q12-1',
            question: 'Khi người dùng gọi API PATCH `/api/i/v1/inventory/categories/:id`, tại sao Service bắt buộc phải kiểm tra `where: { id, unitId }`?',
            options: [
              'Để kiểm tra bản ghi có tồn tại VÀ có thuộc về phòng khám của người dùng đang đăng nhập hay không, chống lỗ hổng xem trộm/sửa trộm dữ liệu (IDOR).',
              'Để tăng tốc độ thực thi của cơ sở dữ liệu PostgreSQL lên gấp đôi nhờ việc bỏ qua các bảng không liên quan.',
              'Để tự động định dạng lại ngày tháng theo múi giờ GMT+7 trước khi trả về cho ứng dụng Frontend.',
              'Vì cú pháp của Prisma 7 bắt buộc phải truyền ít nhất 2 điều kiện lọc trong mọi câu lệnh updateMany.'
            ],
            correctIndex: 0,
            explanation: 'Nếu chỉ tìm theo { id }, người dùng ở Phòng khám A có thể đoán ID của Phòng khám B và sửa trộm dữ liệu.'
          },
          {
            id: 'q12-2',
            question: 'Trong mô hình phân cấp quản trị đa chi nhánh Group -> Unit -> Branch của eSmiles, cấp nào là đơn vị cô lập dữ liệu nghiệp vụ chính?',
            options: [
              'Cấp Branch (Ghế khám / Phòng ban nhỏ trong nội bộ từng phòng khám).',
              'Cấp Unit (Phòng khám chi nhánh độc lập có kho thuốc, bệnh án và báo cáo tài chính riêng).',
              'Cấp Group (Tập đoàn nha khoa nắm bản quyền phần mềm toàn hệ thống).',
              'Cấp Patient (Hồ sơ khách hàng cá nhân đăng ký qua ứng dụng di động).'
            ],
            correctIndex: 1,
            explanation: 'Unit là đơn vị pháp nhân cô lập toàn bộ dữ liệu nghiệp vụ như Khách hàng, Bệnh án, Kho và Báo cáo tài chính.'
          },
          {
            id: 'q12-3',
            question: 'Lỗ hổng bảo mật IDOR (Insecure Direct Object References) trong hệ thống Multi-tenancy xảy ra khi nào?',
            options: [
              'Khi ứng dụng cấp quyền truy cập trực tiếp vào bản ghi dựa trên ID do client gửi lên mà không kiểm tra quyền sở hữu Tenant Context.',
              'Khi máy tính của nhân viên bị nhiễm mã độc trojan và tự động gửi mật khẩu đăng nhập ra ngoài Internet.',
              'Khi cơ sở dữ liệu PostgreSQL bị mất kết nối mạng đột ngột trong lúc đang thực thi câu lệnh SQL migration.',
              'Khi lập trình viên quên khai báo kiểu dữ liệu trả về cho hàm trong class Controller của NestJS.'
            ],
            correctIndex: 0,
            explanation: 'IDOR xảy ra khi server tin tưởng ID gửi lên từ client mà quên kiểm tra ID đó có thuộc về unitId của tài khoản đang đăng nhập hay không.'
          }
        ],
        codeChallenge: {
          title: 'Strict Multi-Tenant Query & Mutation Guard Engine',
          description: 'Viết hàm `secureTenantOperation(dbMock, activeUnitId, resourceId, operation, data)`: 1. Tìm bản ghi bằng `dbMock.findFirst({ where: { id: resourceId, unitId: activeUnitId } })`. 2. Nếu không tìm thấy, ném `Error("RESOURCE_NOT_FOUND_OR_ACCESS_DENIED")`. 3. Nếu tìm thấy và `operation === "UPDATE"`, gọi `dbMock.update({ where: { id: resourceId }, data })`. Nếu `operation === "DELETE"`, gọi `dbMock.delete({ where: { id: resourceId } })`. Trả về kết quả.',
          starterCode: `async function secureTenantOperation(dbMock, activeUnitId, resourceId, operation, data) {
  // Viết logic cô lập tenant an toàn
  
}`,
          solution: `async function secureTenantOperation(dbMock, activeUnitId, resourceId, operation, data) {
  if (!activeUnitId || !resourceId) {
    throw new Error("RESOURCE_NOT_FOUND_OR_ACCESS_DENIED");
  }
  const existing = await dbMock.findFirst({
    where: { id: resourceId, unitId: activeUnitId }
  });
  if (!existing) {
    throw new Error("RESOURCE_NOT_FOUND_OR_ACCESS_DENIED");
  }
  if (operation === 'UPDATE') {
    return dbMock.update({ where: { id: resourceId }, data });
  }
  if (operation === 'DELETE') {
    return dbMock.delete({ where: { id: resourceId } });
  }
  return existing;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Update bản ghi đúng unitId',
              input: [
                {
                  findFirst: async () => ({ id: 'r1', unitId: 'u1' }),
                  update: async (args) => ({ id: args.where.id, ...args.data })
                },
                'u1',
                'r1',
                'UPDATE',
                { name: 'Đã đổi tên' }
              ],
              expected: { id: 'r1', name: 'Đã đổi tên' },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Cố truy cập bản ghi của phòng khám khác -> Ném lỗi',
              input: [
                { findFirst: async () => null },
                'u-hacker',
                'r1',
                'UPDATE',
                { name: 'Hack' }
              ],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Mảng where rỗng',
              input: [{}, 'u-2'],
              expected: {"where":{"unitId":"u-2"}},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Query không phải object',
              input: [null, 'u-3'],
              expected: {"where":{"unitId":"u-3"}},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Where là null',
              input: [{"where":null}, 'u-4'],
              expected: {"where":{"unitId":"u-4"}},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Có where sẵn',
              input: [{"where":{"id":1}}, 'u-5'],
              expected: {"where":{"id":1,"unitId":"u-5"}},
              hidden: true
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 3,
    sprintTitle: 'Sprint 3: Xử Lý Lỗi, Bảo Mật & Xác Thực',
    sprintDesc: 'Làm chủ AllExceptionsFilter, Mật khẩu Argon2, JWT Authentication, HttpOnly Cookie và CASL Dynamic Permissions',
    lessons: [
      {
        id: 'lesson-13',
        title: 'Bài 13: Xử Lý Lỗi Tập Trung & Error Response Envelope',
        duration: '45 phút',
        tag: 'Error Handling',
        theory: `
### 1. Tại Sao Không Nên Bọc try/catch Khắp Mọi Nơi?
- Nếu hàm nào trong Service cũng bọc \`try/catch\` và \`return { error: 'Lỗi' }\`, code sẽ bị phân mảnh, khó bảo trì và nuốt mất Stack Trace của lỗi!
- Trong eSmiles, mọi lỗi (Prisma Database Error, Validation Error, Business Error) được để tự do ném ra ngoài và được **AllExceptionsFilter** toàn cục bắt và chuẩn hóa tập trung:
  - Lỗi trùng mã P2002 -> Tự động chuyển thành **409 Conflict** (\`DUPLICATE_VALUE\`).
  - Lỗi khóa ngoại P2003 -> Tự động chuyển thành **409 Conflict** (\`FOREIGN_KEY_RESTRICT\`).
  - Lỗi không tìm thấy P2025 -> Tự động chuyển thành **404 Not Found** (\`NOT_FOUND\`).

### 2. Cấu Trúc JSON Response Envelope Chuẩn Toàn Dự Án:
\`\`\`json
{
  "success": false,
  "statusCode": 409,
  "errorCode": "DUPLICATE_VALUE",
  "message": "Mã danh mục VTTH-01 đã tồn tại trong phòng khám",
  "details": { "field": "code", "target": "inventoryCategory" },
  "timestamp": "2026-08-14T03:30:00.000Z",
  "path": "/api/i/v1/inventory/categories"
}
\`\`\`
        `,
        realCodeSnippet: `// Trích từ src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.mapException(exception);

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode: code,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}`,
        quiz: [
          {
            id: 'q13-1',
            question: 'Khi Prisma ném mã lỗi `P2002` (Unique constraint failed), Exception Filter chuẩn của NestJS nên ánh xạ thành HTTP Status Code nào?',
            options: [
              'HTTP 409 Conflict (Bản ghi đã tồn tại hoặc vi phạm tính duy nhất của trường dữ liệu).',
              'HTTP 500 Internal Server Error (Lỗi hệ thống không xác định tại tầng máy chủ cơ sở dữ liệu).',
              'HTTP 200 OK kèm theo cờ thông báo `{ success: false, error: "DUPLICATE_KEY" }` trong JSON.',
              'HTTP 400 Bad Request kèm theo việc tự động đổi tên trường dữ liệu bị trùng lặp.'
            ],
            correctIndex: 0,
            explanation: 'Lỗi vi phạm ràng buộc duy nhất (trùng mã code/email) được chuẩn hóa thành 409 Conflict.'
          },
          {
            id: 'q13-2',
            question: 'Mục đích chính của việc xây dựng Global Exception Filter trong NestJS là gì?',
            options: [
              'Tự động sửa lỗi sai trong câu lệnh SQL của lập trình viên và thực thi lại trên Database.',
              'Bắt mọi lỗi unhandled, chuẩn hóa cấu trúc JSON trả về client (statusCode, message, timestamp, path) và ghi log an toàn.',
              'Ẩn toàn bộ mã trạng thái lỗi và luôn trả về HTTP 200 OK cho mọi request của khách hàng.',
              'Gửi tin nhắn SMS cảnh báo trực tiếp cho giám đốc phòng khám mỗi khi có 1 request bị lỗi 404.'
            ],
            correctIndex: 1,
            explanation: 'Global Exception Filter gom việc bắt lỗi về 1 nơi, chuẩn hóa response format theo chuẩn RFC 7807 và ẩn chi tiết nhạy cảm (Stack trace/DB errors) khỏi phía client trên Production.'
          },
          {
            id: 'q13-3',
            question: 'Khi xảy ra sự cố Database ngắt kết nối đột ngột trên môi trường Production, Filter nên phản hồi cho client như thế nào?',
            options: [
              'Trả về HTTP 500 kèm thông điệp chung chung, che giấu toàn bộ chuỗi kết nối và chi tiết Database ra khỏi client.',
              'Trả về toàn bộ chuỗi kết nối Database chứa thông tin username và password để người dùng tự sửa lỗi.',
              'Trả về HTTP 200 OK và tự động sinh dữ liệu giả (Mock Data) để khách hàng không phát hiện ra lỗi.',
              'Treo kết nối HTTP vô thời hạn cho đến khi người quản trị khởi động lại máy chủ cơ sở dữ liệu.'
            ],
            correctIndex: 0,
            explanation: 'Không bao giờ được trả về Database credentials hoặc raw SQL trong response 500 vì lý do an toàn bảo mật.'
          }
        ],
        codeChallenge: {
          title: 'Xây Dựng Enterprise Exception Classifier & Formatter',
          description: 'Viết hàm `classifyAndFormatException(err, requestPath)`: 1. Nếu `err.code === "P2002"` -> `{ status: 409, code: "DUPLICATE_KEY", message: "Bản ghi đã tồn tại" }`. 2. Nếu `err.code === "P2003"` -> `{ status: 409, code: "FOREIGN_KEY_RESTRICT", message: "Không thể xóa do có dữ liệu phụ thuộc" }`. 3. Nếu `err.code === "P2025"` -> `{ status: 404, code: "NOT_FOUND", message: "Không tìm thấy dữ liệu" }`. 4. Khác -> `{ status: 500, code: "INTERNAL_ERROR", message: "Lỗi hệ thống" }`. Bọc trong envelope `{ success: false, statusCode, errorCode, message, path: requestPath, timestamp: Date.now() }`.',
          starterCode: `function classifyAndFormatException(err, requestPath) {
  // Viết logic phân loại lỗi
  
}`,
          solution: `function classifyAndFormatException(err, requestPath) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Lỗi hệ thống';

  if (err?.code === 'P2002') {
    status = 409;
    code = 'DUPLICATE_KEY';
    message = 'Bản ghi đã tồn tại';
  } else if (err?.code === 'P2003') {
    status = 409;
    code = 'FOREIGN_KEY_RESTRICT';
    message = 'Không thể xóa do có dữ liệu phụ thuộc';
  } else if (err?.code === 'P2025') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Không tìm thấy dữ liệu';
  }

  return {
    success: false,
    statusCode: status,
    errorCode: code,
    message,
    path: requestPath || '/',
    timestamp: Date.now()
  };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Lỗi P2002 -> 409 DUPLICATE_KEY',
              input: [{ code: 'P2002' }, '/api/categories'],
              expected: { success: false, statusCode: 409, errorCode: 'DUPLICATE_KEY', message: 'Bản ghi đã tồn tại', path: '/api/categories' },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Lỗi P2025 -> 404 NOT_FOUND',
              input: [{ code: 'P2025' }, '/api/items/123'],
              expected: { success: false, statusCode: 404, errorCode: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu', path: '/api/items/123' },
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Lỗi lạ -> 500 INTERNAL_ERROR',
              input: [{ message: 'Crash' }, '/api/test'],
              expected: { success: false, statusCode: 500, errorCode: 'INTERNAL_ERROR', message: 'Lỗi hệ thống', path: '/api/test' },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Error không có type',
              input: [{}],
              expected: {"status":500,"message":"Internal Server Error","error":"Internal Server Error"},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Lỗi Prisma',
              input: [{"code":"P2002","meta":{"target":"email"}}],
              expected: {"status":409,"message":"Unique constraint failed","error":"Conflict"},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Null',
              input: [null],
              expected: {"status":500,"message":"Internal Server Error","error":"Internal Server Error"},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): HttpException',
              input: [{}],
              expected: {"status":403,"message":"Forbidden","error":"Forbidden"},
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-14',
        title: 'Bài 14: Authentication: Argon2, JWT & HttpOnly Cookie',
        duration: '50 phút',
        tag: 'Authentication',
        theory: `
### 1. Tại Sao eSmiles Dùng Thuật Toán Băm Mật Khẩu Argon2id?
- \`md5\` không được dùng để hash password. \`bcrypt\` vẫn là lựa chọn chấp nhận được khi cấu hình cost phù hợp; eSmiles chọn Argon2id vì memory-hard và hiện thường được ưu tiên cho password hashing mới.
- **Argon2id** là người chiến thắng cuộc thi Password Hashing Competition quốc tế:
  - Kháng tấn công bộ nhớ (Memory-hard).
  - Tham số \`memoryCost\`, \`timeCost\`, \`parallelism\` phải benchmark theo hạ tầng rồi review định kỳ; chúng làm cracking tốn kém hơn, không khiến password "không thể bị bẻ".

### 2. Mô Hình Token Hybrid An Toàn:
1. **Access Token (JWT):** Sống ngắn (15 phút). Mang \`sub\` (AccountId), \`unitId\`, \`permissions\`.
2. **Refresh Token:** Lưu trong **HttpOnly Cookie**. Khi Access Token hết hạn, Frontend tự động gọi \`POST /api/auth/refresh\` trong background để lấy Access Token mới mà người dùng không bị văng ra!
        `,
        realCodeSnippet: `// Trích hàm hash mật khẩu chuẩn trong eSmiles
import * as argon2 from 'argon2';

export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  return argon2.verify(hash, plainText);
}`,
        quiz: [
          {
            id: 'q14-1',
            question: 'Tại sao Access Token nên có thời hạn ngắn (15 phút) trong khi Refresh Token có thời hạn dài (30 ngày) và lưu trong HttpOnly Cookie?',
            options: [
              'Giảm thiểu thiệt hại nếu Access Token bị lộ, đồng thời Refresh Token an toàn trong HttpOnly Cookie chống XSS để cấp mới token.',
              'Vì Access Token sử dụng nhiều băng thông mạng hơn Refresh Token khi truyền tải qua giao thức HTTP.',
              'Vì trình duyệt web sẽ tự động xóa mọi loại token sau mỗi 15 phút nếu người dùng không di chuyển chuột.',
              'Vì thuật toán mã hóa RSA không cho phép tạo token có thời hạn sử dụng dài hơn 15 phút.'
            ],
            correctIndex: 0,
            explanation: 'Access Token thời hạn ngắn giảm thiểu rủi ro khi bị lộ. Refresh Token được bảo vệ trong HttpOnly Cookie (chống XSS) và lưu trong whitelist/database để có thể thu hồi (Revocation) khi cần.'
          },
          {
            id: 'q14-2',
            question: 'Cơ chế Refresh Token Rotation (RTR) bảo vệ tài khoản người dùng như thế nào khi phát hiện token bị đánh cắp?',
            options: [
              'Mỗi lần Refresh Token được dùng để cấp Access Token mới, nó lập tức bị hủy và thay bằng token mới; nếu token cũ bị tái sử dụng, hủy toàn bộ phiên.',
              'Tự động gửi email yêu cầu người dùng xác nhận mã OTP 6 số qua điện thoại mỗi khi thực hiện một HTTP request.',
              'Tự động tăng gấp đôi thời gian sống của token mỗi khi người dùng thực hiện thao tác thanh toán trực tuyến.',
              'Chuyển đổi thuật toán mã hóa từ HMAC-SHA256 sang MD5 để tăng tốc độ kiểm tra chữ ký số.'
            ],
            correctIndex: 0,
            explanation: 'Refresh Token Rotation đảm bảo mỗi Refresh Token chỉ được dùng đúng 1 lần. Nếu 1 token bị dùng lại lần 2, hệ thống phát hiện hacker và khóa toàn bộ phiên đăng nhập.'
          },
          {
            id: 'q14-3',
            question: 'Thuộc tính `SameSite: "Lax"` hoặc `"Strict"` trên HttpOnly Cookie có vai trò phòng chống loại tấn công nào?',
            options: [
              'Chống tấn công Cross-Site Request Forgery (CSRF) bằng cách ngăn trình duyệt tự động đính kèm cookie khi click link từ trang thứ ba.',
              'Chống tấn công DDoS bằng cách giới hạn số lượng request tối đa mà một địa chỉ IP có thể gửi trong 1 giây.',
              'Chống tấn công SQL Injection bằng cách tự động escape các ký tự đặc biệt như dấu nháy đơn và chấm phẩy.',
              'Chống tấn công Man-In-The-Middle bằng cách tự động cài đặt chứng chỉ bảo mật SSL/TLS lên máy tính người dùng.'
            ],
            correctIndex: 0,
            explanation: 'SameSite ngăn chặn việc trình duyệt tự động gửi cookie khi người dùng bị lừa click vào link từ trang web độc hại của bên thứ ba.'
          }
        ],
        codeChallenge: {
          title: 'JWT Session Validator & Expiration Inspector',
          description: 'Viết hàm `inspectJwtSession(tokenPayload, nowSeconds)`: Kiểm tra `tokenPayload: { sub, uid, exp, iat, roles }`. Nếu thiếu `sub` hoặc `uid` ném `Error("INVALID_TOKEN_STRUCTURE")`. Trả về `{ accountId: tokenPayload.sub, activeUnitId: tokenPayload.uid, isExpired: tokenPayload.exp <= nowSeconds, remainingSeconds: Math.max(0, tokenPayload.exp - nowSeconds), roles: tokenPayload.roles || [] }`.',
          starterCode: `function inspectJwtSession(tokenPayload, nowSeconds) {
  // Viết logic kiểm tra JWT session
  
}`,
          solution: `function inspectJwtSession(tokenPayload, nowSeconds) {
  if (!tokenPayload || typeof tokenPayload !== 'object') {
    throw new Error("INVALID_TOKEN_STRUCTURE");
  }
  if (!tokenPayload.sub || !tokenPayload.uid) {
    throw new Error("INVALID_TOKEN_STRUCTURE");
  }
  const exp = Number(tokenPayload.exp) || 0;
  const now = Number(nowSeconds) || 0;
  return {
    accountId: tokenPayload.sub,
    activeUnitId: tokenPayload.uid,
    isExpired: exp <= now,
    remainingSeconds: Math.max(0, exp - now),
    roles: Array.isArray(tokenPayload.roles) ? tokenPayload.roles : []
  };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Token hợp lệ còn 300s',
              input: [{ sub: 'acc-1', uid: 'unit-1', exp: 1700000300, roles: ['DOCTOR'] }, 1700000000],
              expected: { accountId: 'acc-1', activeUnitId: 'unit-1', isExpired: false, remainingSeconds: 300, roles: ['DOCTOR'] },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Token đã hết hạn',
              input: [{ sub: 'acc-1', uid: 'unit-1', exp: 1699999000 }, 1700000000],
              expected: { accountId: 'acc-1', activeUnitId: 'unit-1', isExpired: true, remainingSeconds: 0, roles: [] },
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Thiếu trường uid -> Ném lỗi',
              input: [{ sub: 'acc-1', exp: 1700000000 }, 1600000000],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Payload có object',
              input: [{"role":"ADMIN","data":{"x":1}}],
              expected: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyNyb2xlIjoiQURNSU4iLCJkYXRhIjp7IngiOjF9fQ.signature_mock',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Null payload',
              input: [null],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): String payload',
              input: ['string'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Undefined',
              input: [],
              expected: 'ERROR_THROWN',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-15',
        title: 'Bài 15: Authorization CASL & Multi-Surface API',
        duration: '50 phút',
        tag: 'Authorization',
        theory: `
### 1. Phân Quyền Chi Tiết Dựa Trên Quyền Động (CASL Dynamic Permissions)
Thay vì hardcode vai trò (\`@Roles('ADMIN')\` rất cứng nhắc), eSmiles sử dụng mã quyền 3 phần:
\`\`\`
<module> : <resource> : <action>
Ví dụ:
inventory : category : create   (Tạo danh mục kho)
clinic    : patient  : delete   (Xóa hồ sơ bệnh nhân)
finance   : invoice  : approve  (Duyệt hóa đơn tài chính)
\`\`\`

### 2. Kiến Trúc Phân Vùng 3 Bề Mặt (Multi-Surface Controllers):
- \`@InternalController('inventory')\` -> URL: \`/api/i/v1/inventory\` (Nhân viên phòng khám / Bác sĩ).
- \`@PlatformAdminController('tenants')\` -> URL: \`/api/i/admin/v1/tenants\` (Quản trị viên nền tảng Super Admin).
- \`@CustomerController('appointments')\` -> URL: \`/api/p/v1/appointments\` (Khách hàng / Bệnh nhân đặt lịch).
        `,
        realCodeSnippet: `// Trích Guard kiểm tra quyền động trong eSmiles
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.get<string>('require_permission', context.getHandler());
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions ?? [];

    // Kiểm tra quyền chính xác hoặc wildcard
    return userPermissions.some(perm => 
      perm === '*' || perm === requiredPermission || perm === requiredPermission.split(':')[0] + ':*'
    );
  }
}`,
        quiz: [
          {
            id: 'q15-1',
            question: 'Sự khác biệt cốt lõi giữa Role-Based Access Control (RBAC) và Permission-Based Access Control (PBAC) là gì?',
            options: [
              'RBAC gán quyền theo chức danh cố định (Admin/Doctor); PBAC phân quyền động theo từng hành động cụ thể (patient:create, invoice:refund).',
              'RBAC chỉ dùng được cho cơ sở dữ liệu MySQL; PBAC chỉ dùng được cho cơ sở dữ liệu PostgreSQL.',
              'RBAC không cần xác thực mật khẩu người dùng; PBAC bắt buộc phải xác thực bằng sinh trắc học khuôn mặt.',
              'RBAC có tốc độ xử lý chậm hơn PBAC 100 lần do phải giải mã chuỗi JWT phức tạp hơn.'
            ],
            correctIndex: 0,
            explanation: 'RBAC kiểm tra cứng theo vai trò (Role), khó mở rộng khi có nhiều nghiệp vụ chéo. PBAC (Permission-based) kiểm tra theo từng quyền hạt nhân (Subject:Action), cho phép tùy biến phân quyền linh hoạt theo từng phòng khám.'
          },
          {
            id: 'q15-2',
            question: 'Nếu tài khoản người dùng sở hữu quyền wildcard `"inventory:*"`, họ có được phép gọi API yêu cầu quyền `"inventory:item:delete"` không?',
            options: [
              'Có, vì ký tự đại diện wildcard (*) cho phép toàn quyền thực thi mọi hành động bên trong phạm vi module inventory.',
              'Không, cơ chế PBAC bắt buộc chuỗi quyền trong token phải trùng khớp chính xác 100% từng ký tự chữ cái.',
              'Chỉ được phép nếu người dùng đó đồng thời sở hữu vai trò là Chủ tịch tập đoàn hoặc Giám đốc chi nhánh.',
              'Không, vì các thao tác xóa dữ liệu (delete) bắt buộc phải được khai báo quyền hạn độc lập bằng UUID riêng.'
            ],
            correctIndex: 0,
            explanation: 'Wildcard inventory:* khớp với mọi hành động thuộc module inventory.'
          },
          {
            id: 'q15-3',
            question: 'Bề mặt `/api/p/v1/...` trong quy hoạch kiến trúc Multi-Surface của eSmiles được thiết kế dành riêng cho đối tượng nào?',
            options: [
              'Quản trị viên cấp cao của toàn bộ nền tảng đám mây (Platform Super Admin).',
              'Bác sĩ điều trị và nhân viên y tá nội bộ thao tác tại phòng khám chi nhánh.',
              'Bệnh nhân và khách hàng công cộng truy cập thông qua Mobile App hoặc Patient Portal.',
              'Kỹ sư quản trị cơ sở dữ liệu thực hiện các tác vụ sao lưu và phục hồi dữ liệu.'
            ],
            correctIndex: 2,
            explanation: 'Prefix /api/p/v1 phân vùng riêng cho bề mặt bệnh nhân (Patient / Public Portal).'
          }
        ],
        codeChallenge: {
          title: 'CASL Dynamic Permission & Scope Checker Engine',
          description: 'Viết hàm `evaluatePermissionAccess(user, requiredPermission)`: 1. Nếu `user.isSuperAdmin === true` trả về `{ allowed: true, reason: "SUPER_ADMIN" }`. 2. Kiểm tra `user.permissions: string[]`: Nếu có `*`, hoặc khớp chính xác `requiredPermission`, hoặc khớp `module:*` (vd: `inventory:*`) thì trả về `{ allowed: true, reason: "PERMISSION_MATCHED" }`. 3. Ngược lại trả về `{ allowed: false, reason: "FORBIDDEN" }`.',
          starterCode: `function evaluatePermissionAccess(user, requiredPermission) {
  // Viết logic đánh giá quyền
  
}`,
          solution: `function evaluatePermissionAccess(user, requiredPermission) {
  if (user?.isSuperAdmin) {
    return { allowed: true, reason: 'SUPER_ADMIN' };
  }
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const req = String(requiredPermission || '').trim();
  const mod = req.split(':')[0];

  if (perms.includes('*') || perms.includes(req) || (mod && perms.includes(mod + ':*'))) {
    return { allowed: true, reason: 'PERMISSION_MATCHED' };
  }
  return { allowed: false, reason: 'FORBIDDEN' };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Quyền module wildcard (inventory:*)',
              input: [{ permissions: ['inventory:*'] }, 'inventory:category:create'],
              expected: { allowed: true, reason: 'PERMISSION_MATCHED' },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): SuperAdmin -> Cho phép ngay',
              input: [{ isSuperAdmin: true }, 'finance:invoice:delete'],
              expected: { allowed: true, reason: 'SUPER_ADMIN' },
              hidden: false
            },
            {
              name: 'Case 3 (Hidden): Không đủ quyền -> FORBIDDEN',
              input: [{ permissions: ['inventory:item:read'] }, 'inventory:item:delete'],
              expected: { allowed: false, reason: 'FORBIDDEN' },
              hidden: true
            },
            {
              name: 'Case 4 (Hidden): Mảng roles rỗng',
              input: [[], 'update', 'user'],
              expected: false,
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Rule bị deny',
              input: [[{"action":"update","subject":"user","inverted":true}], 'update', 'user'],
              expected: false,
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Action manage bao trọn',
              input: [[{"action":"manage","subject":"all"}], 'delete', 'post'],
              expected: true,
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Action manage reject inverted',
              input: [[{"action":"manage","subject":"all","inverted":true}], 'delete', 'post'],
              expected: false,
              hidden: true
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 4,
    sprintTitle: 'Sprint 4: Tối Ưu Hiệu Năng, Queue BullMQ & Realtime',
    sprintDesc: 'Làm chủ Redis Cache, Message Queue BullMQ, Presigned S3/MinIO và WebSockets Realtime',
    lessons: [
      {
        id: 'lesson-16',
        title: 'Bài 16: Redis In-Memory Cache & Rate Limiting',
        duration: '45 phút',
        tag: 'Caching & Performance',
        theory: `
### 1. Chiến Lược Cache-Aside Pattern Với Redis
Redis thường có latency thấp hơn PostgreSQL vì giữ dữ liệu trong RAM và protocol đơn giản; số đo thực tế phụ thuộc mạng, tải và kích thước payload.
- PostgreSQL có thể đọc từ cache RAM hoặc disk và phải xử lý query plan, MVCC, relation phức tạp.
- Redis lưu dữ liệu trực tiếp trong **RAM (Bộ nhớ trong)** dưới dạng Key-Value.

\`\`\`
[ Client ] ──> [ NestJS ] ──1. Check Cache──> [ Redis Cache ]
                   │                                │ (HIT: latency tùy tải)
                   └──2. MISS: Query DB ──────────> [ PostgreSQL ]
                   │
                   └──3. Set Cache + TTL (300s) ──> [ Redis Cache ]
\`\`\`

### 2. Cache Invalidation (Xóa Bộ Nhớ Đệm):
- Khi có thay đổi dữ liệu (\`POST\`, \`PATCH\`, \`DELETE\`), bắt buộc phải **xóa key cache tương ứng trong Redis** để người dùng không bị đọc phải dữ liệu cũ!
        `,
        realCodeSnippet: `// Trích Service Cache-Aside trong eSmiles
@Injectable()
export class CacheLookupService {
  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached); // Cache Hit: 0.5ms
    }

    const freshData = await fetcher(); // Cache Miss: Gọi DB
    await this.redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
    return freshData;
  }
}`,
        quiz: [
          {
            id: 'q16-1',
            question: 'Khi Bác sĩ cập nhật đơn giá của một dịch vụ trong danh mục, thao tác nào đối với Redis Cache là bắt buộc theo mô hình Cache-Aside?',
            options: [
              'Xóa hoặc làm mới key cache tương ứng trong Redis (Cache Invalidation) để các request kế tiếp đọc được dữ liệu mới từ Database.',
              'Khởi động lại toàn bộ máy chủ Redis và xóa toàn bộ các phiên đăng nhập HttpOnly Cookie của người dùng.',
              'Tắt hoàn toàn module Cache trong NestJS và chuyển sang đọc file tĩnh JSON lưu trên máy chủ lưu trữ S3.',
              'Không cần thực hiện bất kỳ thao tác nào vì Redis có khả năng tự động đồng bộ hóa với Database qua Bluetooth.'
            ],
            correctIndex: 0,
            explanation: 'Cache Invalidation đảm bảo dữ liệu hiển thị cho người dùng luôn chính xác và nhất quán với Database.'
          },
          {
            id: 'q16-2',
            question: 'Thông số TTL (Time-To-Live) của một key trong Redis đóng vai trò cốt lõi nào trong kiến trúc bộ nhớ đệm?',
            options: [
              'Quy định thời gian sống tối đa của key trong RAM trước khi Redis tự động thu hồi bộ nhớ, chống lỗi tràn RAM (OOM).',
              'Đo lường thời gian khởi động của hệ điều hành Linux máy chủ tính từ lúc bật nút nguồn phần cứng.',
              'Giới hạn tốc độ truyền tải gói tin mạng TCP giữa ứng dụng NestJS và máy chủ lưu trữ đám mây.',
              'Quy định số lần tối đa mà một người dùng có thể nhập sai mật khẩu trước khi tài khoản bị khóa 24 giờ.'
            ],
            correctIndex: 0,
            explanation: 'TTL giúp cache tự động hết hạn, chống tràn RAM và làm mới dữ liệu định kỳ.'
          },
          {
            id: 'q16-3',
            question: 'Thuật toán Rate Limiting (chống tấn công Brute-force/Spam API) tận dụng Redis theo cơ chế nào?',
            options: [
              'Tăng biến đếm (INCR) theo IP/AccountId kèm TTL (vd: 100 req/60s); nếu vượt ngưỡng thì ném HTTP 429 Too Many Requests.',
              'Tự động xóa toàn bộ bảng dữ liệu người dùng trong PostgreSQL nếu phát hiện có 1 request bị lỗi cú pháp JSON.',
              'Khóa cứng màn hình máy tính của khách hàng và yêu cầu liên hệ số điện thoại hỗ trợ kỹ thuật.',
              'Chuyển toàn bộ các request spam sang một server giả lập chạy trên trình duyệt web của quản trị viên.'
            ],
            correctIndex: 0,
            explanation: 'Redis INCR với TTL cho phép đếm số lượng request siêu nhanh ở mức vi-giây để chặn tấn công DDoS/Brute-force.'
          }
        ],
        codeChallenge: {
          title: 'High-Performance Cache-Aside Key Resolver',
          description: 'Viết hàm `getOrSetCache(cacheStore, key, fetcher, ttlMs)`: 1. Nếu `cacheStore[key]` tồn tại và `cacheStore[key].expireAt > Date.now()` thì trả về `cacheStore[key].data` (Cache Hit). 2. Nếu không, gọi `await fetcher()`, lưu `{ data, expireAt: Date.now() + ttlMs }` vào `cacheStore[key]` và trả về `data`.',
          starterCode: `async function getOrSetCache(cacheStore, key, fetcher, ttlMs) {
  // Viết logic cache aside
  
}`,
          solution: `async function getOrSetCache(cacheStore, key, fetcher, ttlMs) {
  const now = Date.now();
  if (cacheStore && cacheStore[key] && cacheStore[key].expireAt > now) {
    return cacheStore[key].data;
  }
  const data = await fetcher();
  if (cacheStore && typeof cacheStore === 'object') {
    cacheStore[key] = { data, expireAt: now + ttlMs };
  }
  return data;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Cache Miss -> Gọi fetcher và lưu cache',
              input: [{}, 'cat:u1', async () => [{ id: 'c1' }], 10000],
              expected: [{ id: 'c1' }],
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Cache Hit -> Trả về data cũ không gọi fetcher',
              input: [
                { 'item:u1': { data: 'OLD_DATA', expireAt: Date.now() + 50000 } },
                'item:u1',
                async () => 'FRESH_DATA',
                10000
              ],
              expected: 'OLD_DATA',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Không truyền TTL',
              input: ['A'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): TTL = 0',
              input: ['B', 0],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): String an toàn',
              input: ['C!@#', 10],
              expected: 'cache_prefix_C!@#_10',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Rỗng key',
              input: ['', 10],
              expected: 'ERROR_THROWN',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-17',
        title: 'Bài 17: Background Jobs & Message Queue với BullMQ',
        duration: '50 phút',
        tag: 'Message Queue',
        theory: `
### 1. Tại Sao Cần Message Queue (BullMQ + Redis)?
- Nếu Bác sĩ bấm **"Xuất Báo Cáo Doanh Thu 500,000 Dòng"** hoặc **"Gửi SMS Nhắc Lịch Cho 5,000 Khách Hàng"**:
  - Tác vụ này mất 30 giây. Nếu chạy trực tiếp trong luồng HTTP, trình duyệt sẽ bị xoay vòng chờ đợi và timeout!
- **Giải Pháp Message Queue:**
  - **Producer (Controller/Service):** Lưu Job nhanh rồi trả \`202 Accepted\`/job id; latency vẫn phụ thuộc Redis và không có cam kết "2ms".
  - **Consumer (Worker Processor):** Rút Job ở worker process/pod riêng. Retry chỉ dùng cho lỗi transient, phải có backoff, giới hạn attempts, idempotency và quan sát failed jobs.
        `,
        realCodeSnippet: `// Trích Producer và Consumer BullMQ trong eSmiles
@Injectable()
export class AppointmentReminderProducer {
  constructor(@InjectQueue('sms_notifications') private readonly queue: Queue) {}

  async queueReminder(payload: SmsPayload) {
    return this.queue.add('send_reminder', payload, {
      attempts: 3, // Thử lại tối đa 3 lần
      backoff: { type: 'exponential', delay: 5000 }, // Chờ 5s, 10s, 20s
      removeOnComplete: true,
    });
  }
}`,
        quiz: [
          {
            id: 'q17-1',
            question: 'Ưu điểm lớn nhất của việc sử dụng Message Queue (BullMQ) cho các tác vụ nặng (gửi email hàng loạt, export Excel) là gì?',
            options: [
              'Tách rời tác vụ nặng ra khỏi luồng HTTP chính, giúp API phản hồi tức thì và cho phép worker process xử lý ngầm độc lập.',
              'Tự động sửa toàn bộ các lỗi cú pháp TypeScript trong mã nguồn mà không cần lập trình viên can thiệp.',
              'Thay thế hoàn toàn vai trò lưu trữ lâu dài của cơ sở dữ liệu quan hệ PostgreSQL trong hệ thống.',
              'Giảm dung lượng file ảnh chụp X-quang của bệnh nhân xuống 10 lần trước khi lưu vào đĩa cứng máy chủ.'
            ],
            correctIndex: 0,
            explanation: 'Queue giúp tách rời tác vụ khỏi chu trình HTTP. CPU work chỉ không block request server khi consumer được tách process/pod hoặc dùng worker thread phù hợp.'
          },
          {
            id: 'q17-2',
            question: 'Cơ chế "Exponential Backoff" khi retry job trong BullMQ mang lại lợi ích gì cho hệ thống?',
            options: [
              'Tăng dần thời gian chờ theo cấp số nhân (vd: 5s, 10s, 20s) giữa các lần thử lại để bên thứ ba có thời gian phục hồi sau sự cố.',
              'Thử lại liên tục hàng nghìn lần trong 1 giây nhằm ép buộc đối tác bên thứ ba phải phản hồi ngay lập tức.',
              'Tự động xóa vĩnh viễn dữ liệu bệnh nhân nếu đối tác cổng thanh toán phản hồi mã lỗi 500.',
              'Gửi tin nhắn SMS cảnh báo đến điện thoại của toàn bộ nhân viên trong phòng khám nha khoa.'
            ],
            correctIndex: 0,
            explanation: 'Exponential backoff giúp hệ thống bên ngoài có thời gian hồi phục trước khi nhận request thử lại tiếp theo.'
          },
          {
            id: 'q17-3',
            question: 'Khi một Job đã thử lại vượt quá số lần cấu hình (vd: 3 lần) mà vẫn thất bại, BullMQ xử lý Job đó như thế nào?',
            options: [
              'Chuyển Job vào trạng thái Thất bại (Failed State / Dead Letter Queue) để kỹ sư kiểm tra nguyên nhân và retry thủ công.',
              'Tự động xóa vĩnh viễn Job ra khỏi bộ nhớ Redis mà không lưu lại bất kỳ lịch sử lỗi hay stack trace nào.',
              'Gửi lệnh tắt máy chủ NestJS ngay lập tức để tránh làm hỏng các linh kiện phần cứng của hệ thống.',
              'Tự động nạp tiền từ tài khoản ngân hàng của lập trình viên để thanh toán cho đối tác bên thứ ba.'
            ],
            correctIndex: 0,
            explanation: 'Dead Letter Queue lưu giữ các job thất bại hoàn toàn để admin có thể kiểm tra nguyên nhân và bấm retry thủ công khi sửa xong lỗi.'
          }
        ],
        codeChallenge: {
          title: 'Resilient Background Job Retry Executor',
          description: 'Viết hàm `processJobWithRetry(job, workerFn, maxAttempts)`: Gọi `await workerFn(job.payload)`. Nếu thành công, trả về `{ success: true, attempts: attemptCount, result }`. Nếu `workerFn` ném lỗi, thử lại tối đa `maxAttempts` lần (mặc định 3). Nếu đã thử đủ `maxAttempts` lần mà vẫn lỗi, ném `Error("JOB_FAILED_MAX_RETRIES: " + err.message)`.',
          starterCode: `async function processJobWithRetry(job, workerFn, maxAttempts = 3) {
  // Viết logic retry job
  
}`,
          solution: `async function processJobWithRetry(job, workerFn, maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await workerFn(job?.payload);
      return { success: true, attempts: attempt, result };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error("JOB_FAILED_MAX_RETRIES: " + (lastError?.message || 'ERROR'));
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Thành công ngay lần 1',
              input: [{ id: 'j1', payload: { phone: '0901234567' } }, async () => 'SMS_SENT', 3],
              expected: { success: true, attempts: 1, result: 'SMS_SENT' },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Thất bại qua 3 lần retry -> Ném lỗi',
              input: [
                { id: 'j2', payload: { phone: '0901234567' } },
                async () => { throw new Error('GATEWAY_DOWN'); },
                3
              ],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Mảng jobs rỗng',
              input: [[]],
              expected: [],
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Job không có payload',
              input: [[{"name":"A"}]],
              expected: [{"name":"A","id":"job_2","status":"PENDING"}],
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Job sai cấu trúc',
              input: [[123]],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Nhiều jobs hợp lệ',
              input: [[{"name":"A","data":1},{"name":"B","data":2}]],
              expected: [{"name":"A","data":1,"id":"job_3","status":"PENDING"},{"name":"B","data":2,"id":"job_4","status":"PENDING"}],
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-18',
        title: 'Bài 18: Upload File An Toàn: Presigned URL MinIO/S3',
        duration: '45 phút',
        tag: 'File Storage',
        theory: `
### 1. Tại Sao KHÔNG Upload File Nặng Trực Tiếp Qua NestJS Server?
- Nếu 50 phòng khám cùng upload ảnh chụp cắt lớp CT ConeBeam 3D (mỗi file 300MB - 1GB) qua NestJS Server:
  - Backend phải proxy toàn bộ stream, làm tăng tải băng thông, connection và chi phí scale. Không mặc định cạn RAM nếu streaming đúng, nhưng vẫn là điểm nghẽn không cần thiết.

### 2. Mô Hình Presigned URL Chuẩn Doanh Nghiệp:
1. **Bước 1 (Frontend -> NestJS):** Gửi \`POST /api/files/presign\` xin phép upload kèm tên file và mimeType.
2. **Bước 2 (NestJS -> MinIO/S3):** Ký số tạo một **Presigned Upload URL** có thời hạn 15 phút.
3. **Bước 3 (Frontend -> MinIO/S3):** Trình duyệt gửi trực tiếp file lên MinIO Storage Server bằng HTTP \`PUT\`.
4. **Bước 4 (Frontend -> NestJS):** Báo hoàn tất; backend xác minh object (size/checksum/content), chuyển quarantine/scan nếu cần, rồi mới publish metadata.
        `,
        realCodeSnippet: `// Trích FileService trong src/modules/platform/file/application/file.service.ts
@Injectable()
export class FileService {
  constructor(private readonly minioClient: Client) {}

  async createPresignedUploadUrl(unitId: string, dto: PresignUploadDto) {
    const objectKey = \`\${unitId}/\${Date.now()}-\${dto.filename.replace(/\\s+/g, '_')}\`;
    
    // Sinh URL có chữ ký bảo mật, hết hạn sau 15 phút
    const uploadUrl = await this.minioClient.presignedPutObject(
      'esmiles-bucket',
      objectKey,
      15 * 60,
    );

    return { uploadUrl, objectKey };
  }
}`,
        quiz: [
          {
            id: 'q18-1',
            question: 'Ưu điểm lớn nhất của mô hình Presigned Upload URL khi người dùng tải lên file X-quang/CT ConeBeam 500MB là gì?',
            options: [
              'Trình duyệt stream file trực tiếp lên Object Storage (S3/MinIO), giải phóng hoàn toàn băng thông và RAM của máy chủ Backend.',
              'Tự động tăng độ phân giải của hình ảnh chụp cắt lớp lên gấp 4 lần nhờ thuật toán trí tuệ nhân tạo tích hợp.',
              'Hoàn toàn không cần tốn dung lượng lưu trữ trên đĩa cứng của cụm máy chủ MinIO/S3 lưu trữ đám mây.',
              'Tự động giải mã các tệp tin chứa virus trojan độc hại thành các file văn bản thuần túy trước khi ghi đĩa.'
            ],
            correctIndex: 0,
            explanation: 'Presigned URL chuyển đường dữ liệu file sang Object Storage. Nó không thay validation, scan malware, quota, checksum hay kiểm tra quyền tenant.'
          },
          {
            id: 'q18-2',
            question: 'Thời gian hết hạn (Expiry) của một Presigned Upload URL chuẩn doanh nghiệp nên được thiết lập ở mức nào?',
            options: [
              'Khoảng 10 - 15 phút, vừa đủ để client hoàn thành upload và ngăn chặn URL bị lạm dụng nếu rò rỉ ra bên ngoài.',
              'Vĩnh viễn không bao giờ hết hạn để người dùng có thể chia sẻ đường dẫn công khai trên mạng xã hội.',
              'Chính xác 1 giây để bảo mật tuyệt đối, yêu cầu client phải gửi toàn bộ file 500MB trong 1 mili-giây.',
              '10 năm để tránh việc lập trình viên phải viết thêm mã nguồn sinh lại presigned token cho các lần sau.'
            ],
            correctIndex: 0,
            explanation: 'Thời hạn ngắn (10-15 phút) đảm bảo an toàn, kẻ xấu không thể tái sử dụng URL để upload file rác.'
          },
          {
            id: 'q18-3',
            question: 'Để đảm bảo tính cô lập Multi-tenancy trong cấu trúc thư mục lưu trữ S3/MinIO, Object Key nên được đặt theo format nào?',
            options: [
              '`{unitId}/{folder}/{timestamp}-{safeFilename}` để phân vùng riêng biệt thư mục cho từng phòng khám chi nhánh.',
              '`/public/uploads/{safeFilename}` để tất cả các phòng khám trong toàn hệ thống lưu chung vào một thư mục gốc.',
              '`{accountId}/root/{filename}` mà không cần quan tâm tài khoản đó đang thao tác tại chi nhánh phòng khám nào.',
              '`{timestamp}.tmp` và lưu toàn bộ metadata nhị phân vào trường description của bảng cơ sở dữ liệu.'
            ],
            correctIndex: 0,
            explanation: 'Đặt prefix {unitId}/ ở đầu đường dẫn object giúp cô lập hoàn toàn vùng lưu trữ file của từng phòng khám.'
          }
        ],
        codeChallenge: {
          title: 'Secure Storage Object Key & Mime Validator',
          description: 'Viết hàm `generateSecureStoragePath(unitId, folder, filename, mimeType, allowedMimes)`: 1. Kiểm tra nếu `!allowedMimes.includes(mimeType)` ném `Error("UNSUPPORTED_FILE_TYPE")`. 2. Xóa các ký tự độc hại khỏi `filename` (chỉ giữ lại chữ cái, số, dấu chấm, gạch ngang, gạch dưới). 3. Trả về `{ objectKey: unitId + "/" + folder + "/" + cleanName, isAllowed: true }`.',
          starterCode: `function generateSecureStoragePath(unitId, folder, filename, mimeType, allowedMimes) {
  // Viết logic tạo storage path an toàn
  
}`,
          solution: `function generateSecureStoragePath(unitId, folder, filename, mimeType, allowedMimes) {
  if (!allowedMimes || !allowedMimes.includes(mimeType)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
  const cleanName = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    objectKey: unitId.trim() + '/' + folder.trim() + '/' + cleanName,
    isAllowed: true
  };
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): File ảnh JPEG hợp lệ',
              input: ['u-01', 'xrays', 'film 01 #test.jpg', 'image/jpeg', ['image/jpeg', 'image/png']],
              expected: { objectKey: 'u-01/xrays/film_01__test.jpg', isAllowed: true },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): File độc hại (.exe) -> Ném lỗi',
              input: ['u-01', 'docs', 'virus.exe', 'application/x-msdownload', ['image/jpeg', 'application/pdf']],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Tên file rỗng',
              input: ['  ', 'img/png'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Có tiếng việt/khoảng trắng',
              input: ['ảnh đẹp.png', 'image/png'],
              expected: 'anh-dep-123.png',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Thiếu mime',
              input: ['test.pdf'],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Không dấu chấm đuôi',
              input: ['test', 'image/png'],
              expected: 'test-123',
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-19',
        title: 'Bài 19: WebSockets Realtime & Redis Adapter Rooms',
        duration: '45 phút',
        tag: 'Realtime',
        theory: `
### 1. Realtime WebSockets Trong Ứng Dụng Multi-Tenant
- Khi Lễ tân check-in cho bệnh nhân tại quầy, màn hình của Bác sĩ trong phòng khám lập tức cập nhật danh sách chờ mà **không cần F5 bấm tải lại trang**.

### 2. Phân Chia Room Theo UnitId & Redis Adapter Multi-Node:
- **Tenant Room Isolation:** Mỗi socket khi kết nối sẽ join vào room phòng khám của mình: \`socket.join("unit:" + unitId)\`.
- **Redis Pub/Sub Adapter:** Khi hệ thống có 5 máy chủ Backend NestJS chạy song song (Cluster), Redis Adapter đảm bảo thông báo phát ra từ Server 1 sẽ truyền tới Bác sĩ đang kết nối ở Server 5!
        `,
        realCodeSnippet: `// Trích WebSocket Gateway trong eSmiles
@WebSocketGateway({ cors: true, namespace: '/realtime' })
export class ClinicRealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;

  handleConnection(client: Socket) {
    const unitId = client.handshake.query.unitId as string;
    if (unitId) {
      client.join(\`unit:\${unitId}\`); // Phân vùng phòng theo Tenant
    }
  }

  notifyPatientCheckin(unitId: string, patientData: any) {
    this.server.to(\`unit:\${unitId}\`).emit('PATIENT_CHECKED_IN', patientData);
  }
}`,
        quiz: [
          {
            id: 'q19-1',
            question: 'Tại sao trong hệ thống Multi-tenancy, kết nối WebSocket bắt buộc phải phân chia Room theo định dạng `unit:{unitId}`?',
            options: [
              'Để đảm bảo cô lập dữ liệu phòng khám: Chỉ các bác sĩ thuộc đúng chi nhánh đó mới nhận được sự kiện realtime của chi nhánh mình.',
              'Vì thư viện Socket.IO sẽ tự động ném Exception nếu tên room không chứa dấu hai chấm và chữ số nguyên dương.',
              'Để tăng tốc độ truyền tải sóng Wifi giữa máy tính của bác sĩ và thiết bị chụp phim X-quang trong phòng khám.',
              'Để tự động sao lưu toàn bộ tin nhắn chat của phòng khám vào file văn bản Word trên máy tính của bệnh nhân.'
            ],
            correctIndex: 0,
            explanation: 'Phân chia rooms theo UnitId ngăn chặn rò rỉ thông báo của phòng khám này sang phòng khám khác.'
          },
          {
            id: 'q19-2',
            question: 'Khi triển khai ứng dụng NestJS trên cụm nhiều Pods (Horizontal Scaling), thành phần nào giúp phát tán sự kiện WebSocket xuyên suốt các Pods?',
            options: [
              'Socket.IO Redis Pub/Sub Adapter đóng vai trò Message Broker đồng bộ hóa sự kiện giữa tất cả các node máy chủ trong cụm.',
              'Cơ chế gửi email tự động qua giao thức SMTP đến địa chỉ IP nội bộ của từng container Docker đang chạy.',
              'Sử dụng file văn bản text chia sẻ trên ổ đĩa mạng NFS để các tiến trình Node.js đọc lặp lại bằng setInterval.',
              'Không thể đồng bộ hóa sự kiện realtime khi hệ thống có nhiều hơn 1 máy chủ và bắt buộc chỉ được chạy 1 Node duy nhất.'
            ],
            correctIndex: 0,
            explanation: 'Redis Pub/Sub Adapter đóng vai trò Message Broker đồng bộ sự kiện giữa tất cả các node máy chủ trong cụm.'
          },
          {
            id: 'q19-3',
            question: 'Sự khác biệt cốt lõi nhất giữa giao thức WebSocket và HTTP Request/Response truyền thống là gì?',
            options: [
              'WebSocket duy trì kết nối 2 chiều liên tục (Full-duplex) trên 1 kết nối TCP duy nhất, cho phép máy chủ chủ động push dữ liệu tức thì về client.',
              'WebSocket chỉ truyền tải được các ký tự chữ cái tiếng Anh thuần túy, trong khi HTTP có thể truyền tải được hình ảnh và video.',
              'WebSocket có độ trễ cao hơn HTTP gấp 10 lần do phải thực hiện bắt tay mã hóa SSL liên tục sau mỗi 5 giây.',
              'WebSocket yêu cầu người dùng phải cài đặt tiện ích mở rộng Adobe Flash Player trên trình duyệt web mới có thể hoạt động.'
            ],
            correctIndex: 0,
            explanation: 'WebSocket duy trì kết nối sống, giúp server bắn dữ liệu xuống client với độ trễ chỉ vài mili-giây mà client không cần gửi request hỏi liên tục (Polling).'
          }
        ],
        codeChallenge: {
          title: 'Tenant-Scoped WebSocket Event Broadcaster',
          description: 'Viết hàm `broadcastToTenantRoom(roomRegistry, unitId, eventName, payload)`: Lấy danh sách socket IDs trong `roomRegistry["unit:" + unitId]`. Trả về mảng các gói tin `{ socketId, event: eventName.toUpperCase(), unitId, payload, timestamp: Date.now() }`. Nếu room không có socket nào, trả về `[]`.',
          starterCode: `function broadcastToTenantRoom(roomRegistry, unitId, eventName, payload) {
  // Viết logic broadcast event
  
}`,
          solution: `function broadcastToTenantRoom(roomRegistry, unitId, eventName, payload) {
  const roomKey = 'unit:' + String(unitId || '').trim();
  const sockets = (roomRegistry && roomRegistry[roomKey]) ? roomRegistry[roomKey] : [];
  if (!Array.isArray(sockets) || sockets.length === 0) return [];
  const now = Date.now();
  return sockets.map(sId => ({
    socketId: sId,
    event: String(eventName).toUpperCase(),
    unitId: String(unitId).trim(),
    payload,
    timestamp: now
  }));
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Phát tín hiệu tới 2 bác sĩ trong unit:10',
              input: [
                { 'unit:10': ['sock_1', 'sock_2'] },
                '10',
                'patient_arrived',
                { patientId: 'p1' }
              ],
              expected: [
                { socketId: 'sock_1', event: 'PATIENT_ARRIVED', unitId: '10', payload: { patientId: 'p1' } },
                { socketId: 'sock_2', event: 'PATIENT_ARRIVED', unitId: '10', payload: { patientId: 'p1' } }
              ],
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Room không có ai -> Trả về mảng rỗng []',
              input: [{ 'unit:10': [] }, '20', 'test', {}],
              expected: [],
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Payload rỗng',
              input: ['chat', null],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Không truyền event name',
              input: ['', {"a":1}],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): String payload',
              input: ['ping', 'pong'],
              expected: '{"event":"ping","data":"pong"}',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Array payload',
              input: ['list', [1,2,3]],
              expected: '{"event":"list","data":[1,2,3]}',
              hidden: true
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 5,
    sprintTitle: 'Sprint 5: Testing, Audit Log & Triển Khai Production',
    sprintDesc: 'Làm chủ Audit Logging, Kiểm thử API sống với Bruno, Unit Test Jest, E2E Supertest và Capstone Project',
    lessons: [
      {
        id: 'lesson-20',
        title: 'Bài 20: Audit Logging Event-Driven',
        duration: '45 phút',
        tag: 'Audit & Compliance',
        theory: `
### 1. Tầm Quan Trọng Của Audit Log Trong Y Tế & Tài Chính
Hồ sơ bệnh án và hóa đơn tiền bạc là tài sản pháp lý:
- Nếu Bác sĩ A sửa liều lượng thuốc của bệnh nhân từ 10mg lên 50mg -> Hệ thống bắt buộc phải ghi lại: **Ai (AccountId)**, thuộc **Phòng khám nào (UnitId)**, đã sửa **Bệnh án nào (EntityId)**, vào **Thời điểm nào (Timestamp)**, với giá trị cũ \`before: 10\` và giá trị mới \`after: 50\`!

### 2. Ghi Audit Log Bất Đồng Bộ (Event-Driven):
- Ghi Audit Log không được phép làm chậm luồng thao tác chính của Bác sĩ. eSmiles sử dụng **EventEmitter2** hoặc **Queue** để ghi log ngầm.
        `,
        realCodeSnippet: `// Trích AuditService trong eSmiles
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(unitId: string, actorId: string, action: string, target: string, entityId: string, changes: any) {
    return this.prisma.auditLog.create({
      data: {
        unitId,
        actorId,
        action,
        target,
        entityId,
        changes: changes ?? {},
        ipAddress: '127.0.0.1',
      },
    });
  }
}`,
        quiz: [
          {
            id: 'q20-1',
            question: 'Những trường dữ liệu nào sau đây là bắt buộc phải có trong một bản ghi Audit Log y tế đạt chuẩn pháp lý?',
            options: [
              'Bộ thông tin 5W: `actorId`, `unitId`, `action`, `targetEntity`, `entityId`, `changes` (diff before/after) và `timestamp`.',
              'Độ phân giải màn hình hiển thị và màu nền giao diện của ứng dụng Frontend đang cài đặt.',
              'Danh sách các bài hát mà bác sĩ đang nghe trong lúc thực hiện thao tác kê đơn thuốc trên máy tính.',
              'Dung lượng bộ nhớ RAM còn trống của thiết bị máy trạm tại thời điểm nhấn nút Lưu trên form.'
            ],
            correctIndex: 0,
            explanation: 'Bộ dữ liệu 5W (Who, What, Where, When, Why) là tiêu chuẩn bắt buộc của kiểm toán dữ liệu y tế và tài chính.'
          },
          {
            id: 'q20-2',
            question: 'Tại sao việc tính toán "diff" (chỉ lưu các trường bị thay đổi) tốt hơn việc lưu toàn bộ object cũ và object mới vào log?',
            options: [
              'Tiết kiệm 90% dung lượng đĩa cứng lưu trữ và giúp kiểm toán viên nhìn thấy ngay lập tức giá trị trước và sau khi thay đổi.',
              'Vì cơ sở dữ liệu PostgreSQL sẽ tự động từ chối ghi dữ liệu nếu kích thước bản ghi JSON vượt quá 100 bytes.',
              'Để làm tăng dung lượng file build nhị phân của ứng dụng NestJS khi triển khai lên môi trường Production.',
              'Vì các thuật toán trí tuệ nhân tạo chỉ có khả năng phân tích các đối tượng JSON có ít hơn 3 trường dữ liệu.'
            ],
            correctIndex: 0,
            explanation: 'Diffing chỉ lưu { field, oldValue, newValue }, vừa tiết kiệm dung lượng đĩa vừa giúp kiểm toán viên đọc hiểu tức thì.'
          },
          {
            id: 'q20-3',
            question: 'Bảng dữ liệu Audit Log có được phép cung cấp API chỉnh sửa hoặc xóa bỏ (UPDATE / DELETE) cho người dùng không?',
            options: [
              'Tuyệt đối CẤM: Bảng Audit Log phải là Append-Only (chỉ cho phép INSERT), không ai kể cả Admin được quyền xóa/sửa lịch sử kiểm toán.',
              'Cho phép Bác sĩ trưởng khoa tự do xóa bỏ toàn bộ lịch sử chỉnh sửa bệnh án của phòng khám mình vào cuối mỗi tháng.',
              'Tự động xóa vĩnh viễn toàn bộ các bản ghi kiểm toán sau 24 giờ kể từ thời điểm phát sinh thao tác.',
              'Cho phép nhân viên Lễ tân tùy ý sửa đổi thông tin người thực hiện thao tác nếu bị nhập nhầm tài khoản.'
            ],
            correctIndex: 0,
            explanation: 'Tính bất biến (Immutability) của Audit Log là nguyên tắc pháp lý cốt lõi để chống gian lận và chối bỏ trách nhiệm.'
          }
        ],
        codeChallenge: {
          title: 'Object Shallow Difference (Diff) Calculator Engine',
          description: 'Viết hàm `computeObjectDiff(oldObj, newObj)`: So sánh 2 object và trả về object chứa các trường bị thay đổi dạng `{ [key]: { from: oldValue, to: newValue } }`. Bỏ qua các trường có giá trị giống hệt nhau.',
          starterCode: `function computeObjectDiff(oldObj, newObj) {
  // Viết logic tính toán diff
  
}`,
          solution: `function computeObjectDiff(oldObj, newObj) {
  const diff = {};
  const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);

  for (const key of allKeys) {
    const oldVal = oldObj ? oldObj[key] : undefined;
    const newVal = newObj ? newObj[key] : undefined;

    if (oldVal !== newVal) {
      diff[key] = { from: oldVal, to: newVal };
    }
  }
  return diff;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Thay đổi giá thuốc và tên',
              input: [
                { name: 'Panadol 500mg', price: 10000, status: 'ACTIVE' },
                { name: 'Panadol Extra', price: 15000, status: 'ACTIVE' }
              ],
              expected: {
                name: { from: 'Panadol 500mg', to: 'Panadol Extra' },
                price: { from: 10000, to: 15000 }
              },
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Hai object giống hệt nhau -> Trả về object rỗng {}',
              input: [{ a: 1, b: 2 }, { a: 1, b: 2 }],
              expected: {},
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Missing action',
              input: [{"user":"U1","payload":"1"}],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Missing user',
              input: [{"action":"CREATE","payload":"1"}],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Chuỗi rỗng',
              input: [{"user":"","action":"","payload":{}}],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Đúng cấu trúc',
              input: [{"user":"A","action":"B","payload":{}}],
              expected: {"user":"A","action":"B","payload":{}},
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-21',
        title: 'Bài 21: Kiểm Thử API Sống Với Bruno (.bru) & CI Gate',
        duration: '45 phút',
        tag: 'API Tooling',
        theory: `
### 1. Tại Sao eSmiles Thay Thế Postman Bằng Bruno (.bru)?
- **Nhược điểm Postman:** Lưu trên Cloud riêng, khi Backend thêm API mới thì tài liệu Postman bị lệch, không ai cập nhật.
- **Ưu điểm Bruno:** Lưu mọi API Request thành các file văn bản thuần \`.bru\` trực tiếp trong thư mục \`bruno/\` của Git repository!
  - Được review code qua Pull Request.
  - Chạy test tự động trên CI/CD bằng lệnh \`pnpm bruno:check\`.

### 2. Cấu Trúc 1 File Bruno (.bru):
\`\`\`text
meta {
  name: Tạo danh mục kho
  type: http
  seq: 2
}
post {
  url: {{baseUrl}}/api/i/v1/inventory/categories
  body: json
  auth: bearer
}
headers {
  X-Unit-Id: {{unitId}}
}
body:json {
  { "code": "VTTH-01", "name": "Bông gòn y tế" }
}
\`\`\`
        `,
        realCodeSnippet: `// Trích lệnh kiểm tra tự động độ phủ Bruno trong eSmiles
// Chạy trước khi tạo Pull Request để đảm bảo 100% API đều có file test
// Lệnh: pnpm bruno:check`,
        quiz: [
          {
            id: 'q21-1',
            question: 'Lợi ích lớn nhất của việc lưu trữ các file kiểm thử API Bruno (`.bru`) trực tiếp trong Git Repository là gì?',
            options: [
              'Bộ tài liệu và kiểm thử API luôn đồng bộ 100% với từng commit code và được kiểm tra tự động qua Git Pull Request.',
              'Tự động làm tăng dung lượng lưu trữ của kho mã nguồn Git lên gấp 10 lần để backup dữ liệu.',
              'Hoàn toàn không cần viết bất kỳ bài kiểm thử đơn vị Unit Test hay E2E Test nào trong dự án.',
              'Cho phép máy chủ cơ sở dữ liệu PostgreSQL tự động cập nhật cấu trúc schema mà không cần migration.'
            ],
            correctIndex: 0,
            explanation: 'Tracking file .bru trực tiếp trong Git biến tài liệu API thành bộ test sống luôn đồng bộ với code của lập trình viên.'
          },
          {
            id: 'q21-2',
            question: 'Lệnh nào trong hệ thống eSmiles được thiết lập làm Quality Gate tự động đối chiếu các Controller với bộ test Bruno?',
            options: [
              'Lệnh `pnpm bruno:check` để duyệt qua toàn bộ route và chặn merge PR nếu có endpoint chưa được viết file `.bru`.',
              'Lệnh `pnpm test:watch` để tự động khởi chạy giao diện đồ họa Bruno trên màn hình của lập trình viên.',
              'Lệnh `pnpm build:prod` để biên dịch toàn bộ các file `.bru` thành các file ảnh PNG lưu vào thư mục dist.',
              'Lệnh `pnpm format:all` để tự động đổi tên toàn bộ các biến trong Controller theo bảng chữ cái La Tinh.'
            ],
            correctIndex: 0,
            explanation: 'pnpm bruno:check là Quality Gate tự động đối chiếu các route đã khai báo với collection Bruno.'
          },
          {
            id: 'q21-3',
            question: 'File kịch bản kiểm thử API `.bru` của Bruno có bản chất cấu trúc là gì?',
            options: [
              'Định dạng văn bản thuần (Plain text DSL) có thể đọc, chỉnh sửa bằng VS Code hoặc phần mềm Bruno Client và review diff trên Git.',
              'Tệp tin nhị phân biên dịch đặc biệt chỉ có thể giải mã được trên hệ điều hành MacOS của Apple.',
              'File nén ZIP chứa hàng nghìn hình ảnh chụp màn hình kết quả kiểm thử giao diện của người dùng.',
              'Một bảng cơ sở dữ liệu SQLite nhúng trực tiếp vào trong tập tin mã nguồn TypeScript của backend.'
            ],
            correctIndex: 0,
            explanation: 'File .bru là định dạng text thuần (Plain text DSL), có thể mở bằng Bruno App hoặc VS Code.'
          }
        ],
        codeChallenge: {
          title: 'Bruno Request DSL Generator Engine',
          description: 'Viết hàm `generateBrunoDsl(name, method, url, unitId, token, bodyJson)`: Tạo chuỗi định dạng `.bru` chuẩn chứa: meta block có name, method block có url, headers block có `X-Unit-Id`, và body block nếu có `bodyJson`.',
          starterCode: `function generateBrunoDsl(name, method, url, unitId, token, bodyJson) {
  // Viết logic sinh file .bru
  
}`,
          solution: `function generateBrunoDsl(name, method, url, unitId, token, bodyJson) {
  let dsl = 'meta {\\n  name: ' + name + '\\n  type: http\\n}\\n\\n' + method.toLowerCase() + ' {\\n  url: ' + url + '\\n  auth: bearer\\n}\\n\\n';
  dsl += 'headers {\\n  X-Unit-Id: ' + unitId + '\\n}\\n';
  if (bodyJson && typeof bodyJson === 'object') {
    dsl += '\\nbody:json {\\n  ' + JSON.stringify(bodyJson) + '\\n}';
  }
  return dsl;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Sinh file .bru cho GET categories',
              input: ['List Categories', 'GET', '{{baseUrl}}/api/i/v1/inventory/categories', 'unit-1', 'token-123', null],
              expected: 'meta {\n  name: List Categories\n  type: http\n}\n\nget {\n  url: {{baseUrl}}/api/i/v1/inventory/categories\n  auth: bearer\n}\n\nheaders {\n  X-Unit-Id: unit-1\n}\n',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Result is null',
              input: [200, null, 200],
              expected: 'ERROR_THROWN',
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Expect status 400',
              input: [200, {"a":1}, 400],
              expected: false,
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Missing keys',
              input: [200, {"b":1}, 200, ["a"]],
              expected: false,
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): Match keys ok',
              input: [200, {"a":1,"b":2}, 200, ["a","b"]],
              expected: true,
              hidden: true
            }
          ]
        }
      },
      {
        id: 'lesson-22',
        title: 'Bài 22: Unit Test Jest & E2E Testing với Supertest',
        duration: '50 phút',
        tag: 'Testing',
        theory: `
### 1. Kim Tự Tháp Kiểm Thử Trong Backend NestJS:
- **Unit Test (Jest - Chiếm 70%):** Kiểm tra từng hàm Service riêng lẻ bằng cách **Mock PrismaService (sử dụng jest-mock-extended)**. Chạy siêu nhanh (vài mili-giây cho 100 test).
- **Integration / E2E Test (Supertest - Chiếm 20%):** Khởi động toàn bộ NestJS Application, kết nối vào Database Test thật và gửi request HTTP mô phỏng hành vi của người dùng thực tế.

\`\`\`
      /\\
     /  \\     E2E Test (Supertest: Khởi động NestJS + DB thật)
    /    \\
   /------\\   Integration Test (Test luồng Controller + Service)
  /        \\
 /----------\\ Unit Test (Jest + Mock PrismaService: Siêu nhanh)
\`\`\`
        `,
        realCodeSnippet: `// Trích Unit Test Service trong eSmiles
describe('InventoryCategoryService', () => {
  let service: InventoryCategoryService;
  let prismaMock: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prismaMock = mockDeep<PrismaService>();
    service = new InventoryCategoryService(prismaMock);
  });

  it('nên trả về danh mục khi tìm thấy đúng unitId', async () => {
    prismaMock.inventoryCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      unitId: 'unit-1',
      name: 'Vật tư tiêu hao',
    } as any);

    const result = await service.detail('unit-1', 'cat-1');
    expect(result.name).toBe('Vật tư tiêu hao');
    expect(prismaMock.inventoryCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 'cat-1', unitId: 'unit-1' },
    });
  });
});`,
        quiz: [
          {
            id: 'q22-1',
            question: 'Khi viết Unit Test cho Service trong NestJS, tại sao chúng ta nên Mock PrismaService thay vì kết nối trực tiếp vào Database thật?',
            options: [
              'Để bài test chạy độc lập, siêu nhanh trong vài mili-giây và không làm biến đổi dữ liệu của database thật khi chạy trên môi trường CI/CD.',
              'Vì thư viện Jest không có khả năng gửi các gói tin mạng TCP ra cổng kết nối 5432 của PostgreSQL.',
              'Vì cơ sở dữ liệu sẽ tự động xóa toàn bộ bảng dữ liệu người dùng nếu phát hiện có lệnh test chạy trong 1 giây.',
              'Để tránh việc lập trình viên phải trả thêm tiền bản quyền phần mềm kiểm thử cho tập đoàn Microsoft.',
            ],
            correctIndex: 0,
            explanation: 'Mocking giúp unit test chạy nhanh, cô lập hoàn toàn và có thể chạy ở bất kỳ máy tính nào mà không cần cài PostgreSQL.'
          },
          {
            id: 'q22-2',
            question: 'Công cụ nào trong hệ sinh thái NestJS được sử dụng phổ biến nhất để gửi HTTP request ảo khi viết E2E Testing?',
            options: [
              'Supertest kết hợp cùng module `@nestjs/testing` để gửi request trực tiếp vào instance HTTP Server của NestJS.',
              'Phần mềm Photoshop để kiểm tra độ sắc nét của hình ảnh icon hiển thị trên thanh menu điều hướng.',
              'Ứng dụng bảng tính Microsoft Excel để tự động nhập dữ liệu vào ô tính và đối chiếu công thức.',
              'Trình duyệt web Internet Explorer phiên bản 6.0 chạy trên máy ảo Windows XP để kiểm tra khả năng tương thích.'
            ],
            correctIndex: 0,
            explanation: 'Supertest kết hợp cùng @nestjs/testing cho phép bắn request HTTP trực tiếp vào instance HTTP Server của NestJS.'
          },
          {
            id: 'q22-3',
            question: 'Hàm assertion `expect(mockFn).toHaveBeenCalledWith(expectedArgs)` trong Jest đóng vai trò xác thực điều gì?',
            options: [
              'Kiểm tra xem hàm mock có thực sự được gọi với đúng các tham số mong đợi (ví dụ: đúng `unitId` và `categoryId`) hay không.',
              'Tự động sửa chữa các lỗi sai cú pháp TypeScript và biên dịch lại mã nguồn của file Service.',
              'Gửi lệnh in toàn bộ kết quả kiểm thử ra máy in văn phòng kết nối qua mạng cục bộ LAN.',
              'Tự động khởi động lại máy chủ cơ sở dữ liệu PostgreSQL nếu phát hiện có câu lệnh truy vấn bị lỗi.'
            ],
            correctIndex: 0,
            explanation: 'toHaveBeenCalledWith là assertion cơ bản để verify xem Service có truyền đúng tham số (ví dụ đúng unitId) xuống Prisma hay không.'
          }
        ],
        codeChallenge: {
          title: 'Unit Test Mock Spy Query Assertion Engine',
          description: 'Viết hàm `verifySpyCalls(recordedCalls, expectedQuery)`: Kiểm tra xem trong mảng `recordedCalls: Array<{ where: Object }>` có ít nhất 1 lần gọi mà `c.where` khớp chính xác với `expectedQuery` hay không. Nếu có, trả về `true`. Nếu không tìm thấy, ném `Error("MOCK_CALL_NOT_MATCHED")`.',
          starterCode: `function verifySpyCalls(recordedCalls, expectedQuery) {
  // Viết logic assert mock spy call
  
}`,
          solution: `function verifySpyCalls(recordedCalls, expectedQuery) {
  if (!Array.isArray(recordedCalls)) throw new Error("MOCK_CALL_NOT_MATCHED");
  const expStr = JSON.stringify(expectedQuery);
  const match = recordedCalls.some(c => JSON.stringify(c?.where || c) === expStr);
  if (!match) {
    throw new Error("MOCK_CALL_NOT_MATCHED");
  }
  return true;
}`,
          testCases: [
            {
              name: 'Case 1 (Visible): Khớp câu query findFirst({ where: { id: "c1", unitId: "u1" } })',
              input: [
                [{ where: { id: 'c1', unitId: 'u1' } }],
                { id: 'c1', unitId: 'u1' }
              ],
              expected: true,
              hidden: false
            },
            {
              name: 'Case 2 (Visible): Không khớp unitId -> Ném lỗi',
              input: [
                [{ where: { id: 'c1', unitId: 'u1' } }],
                { id: 'c1', unitId: 'u-hacker' }
              ],
              expected: 'ERROR_THROWN',
              hidden: false
            },
            {
              name: 'Case 4 (Hidden): Mảng rỗng',
              input: [[]],
              expected: {"total":0,"passed":0,"failed":0},
              hidden: true
            },
            {
              name: 'Case 5 (Hidden): Các object null',
              input: [[null,{"status":"failed"},null]],
              expected: {"total":3,"passed":0,"failed":1},
              hidden: true
            },
            {
              name: 'Case 6 (Hidden): Trạng thái rác',
              input: [[{"status":"passed"},{"status":"error"},{"status":"passed"}]],
              expected: {"total":3,"passed":2,"failed":0},
              hidden: true
            },
            {
              name: 'Case 7 (Hidden): All passed',
              input: [[{"status":"passed"},{"status":"passed"}]],
              expected: {"total":2,"passed":2,"failed":0},
              hidden: true
            }
          ]
        }
      }
    ]
  }
];
