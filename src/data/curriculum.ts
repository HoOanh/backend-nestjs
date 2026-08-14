export interface TestCase {
  name: string;
  input: unknown[];
  expected: unknown;
  hidden: boolean;
}

export interface CodeChallenge {
  title: string;
  description: string;
  starterCode: string;
  solution: string;
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
              'Vì TypeScript compiler sẽ báo lỗi không cho build',
              'Vì Service Singleton dùng chung cho mọi request, request sau sẽ ghi đè biến này và request trước sẽ đọc nhầm dữ liệu của người khác',
              'Vì làm tăng dung lượng file build',
              'Vì PostgreSQL sẽ từ chối kết nối'
            ],
            correctIndex: 1,
            explanation: 'Trong kiến trúc Singleton, toàn bộ người dùng kết nối đến server đều truy cập vào cùng 1 object instance trong RAM. Bất kỳ biến instance nào cũng bị chia sẻ xuyên request (Race Condition).'
          },
          {
            id: 'q1-2',
            question: 'Cách truyền thông tin người dùng (userId, unitId) từ Controller xuống Service chuẩn nhất trong NestJS là gì?',
            options: [
              'Lưu vào biến global.currentUser',
              'Truyền trực tiếp qua tham số của hàm trong Service (Function Parameters)',
              'Gán vào process.env',
              'Tạo một cookie mới'
            ],
            correctIndex: 1,
            explanation: 'Truyền qua tham số hàm (ví dụ: service.createItem(unitId, userId, dto)) đảm bảo tính thuần khiết (pure function), an toàn đa luồng và dễ viết Unit Test.'
          },
          {
            id: 'q1-3',
            question: 'Nếu một tiến trình Node.js Backend gặp lỗi unhandled exception và crash, điều gì sẽ xảy ra?',
            options: [
              'Chỉ người dùng gây ra lỗi bị ảnh hưởng',
              'Toàn bộ server bị sập, tất cả người dùng khác đang kết nối đều bị gián đoạn cho đến khi tiến trình được restart',
              'Trình duyệt của người dùng tự khởi động lại',
              'Database tự động tắt'
            ],
            correctIndex: 1,
            explanation: 'Vì Backend là tiến trình tập trung duy nhất, một lỗi không được bắt (unhandled crash) sẽ làm tắt cả tiến trình Node.js, ngắt kết nối của mọi người dùng.'
          },
          {
            id: 'l1-q4',
            question: 'Khái niệm "Stateless Server" có nghĩa là gì?',
            options: [
              'Server không bao giờ lỗi',
              'Không lưu trữ trạng thái phiên trong RAM giữa các request',
              'Không kết nối DB',
              'Không có OS'
            ],
            correctIndex: 1,
            explanation: 'Stateless: mỗi request tự chứa đủ thông tin để xử lý.'
          },
          {
            id: 'l1-q5',
            question: 'Trong NestJS, Singleton Pattern có nghĩa là gì?',
            options: [
              'Mỗi user 1 object',
              'Một instance duy nhất chia sẻ toàn app',
              'Class không kế thừa',
              'Chỉ trả về 1 giá trị'
            ],
            correctIndex: 1,
            explanation: 'Singleton là 1 object duy nhất tồn tại xuyên suốt vòng đời app.'
          },
          {
            id: 'l1-q6',
            question: 'Điều gì xảy ra nếu sửa biến global khi đang xử lý request A?',
            options: [
              'Chỉ A thấy',
              'DB rollback',
              'Request B xử lý đồng thời cũng thấy và sai lệch',
              'Trình duyệt báo lỗi'
            ],
            correctIndex: 2,
            explanation: 'Biến global chia sẻ chung gây Race Condition.'
          },
          {
            id: 'l1-q7',
            question: 'Tại sao không dùng fs.readFileSync trong API handler?',
            options: [
              'Block Event Loop, request khác phải chờ',
              'Khóa file',
              'Dữ liệu nhị phân',
              'NestJS cấm fs'
            ],
            correctIndex: 0,
            explanation: 'Hàm sync chặn main thread, giảm concurrency.'
          },
          {
            id: 'l1-q8',
            question: 'Để chia sẻ dữ liệu an toàn xuyên request (như userId), NestJS khuyên dùng gì?',
            options: [
              'Global vars',
              'Static array',
              'Truyền tham số hàm hoặc Request-scoped',
              'Ghi ra file'
            ],
            correctIndex: 2,
            explanation: 'Tham số hàm là cách truyền thống và an toàn nhất.'
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
            question: 'Khi backend cần thực hiện 3 câu query độc lập không phụ thuộc dữ liệu của nhau, cách nào tối ưu thời gian phản hồi nhất?',
            options: [
              'Gọi tuần tự bằng 3 dòng await riêng biệt',
              'Sử dụng Promise.all([query1(), query2(), query3()]) để DB thực thi đồng thời',
              'Viết vòng lặp while để chờ từng câu',
              'Dùng setTimeout ngắt quãng'
            ],
            correctIndex: 1,
            explanation: 'Promise.all gửi đồng thời 3 câu query tới Database Connection Pool, thời gian chờ chỉ bằng câu query chậm nhất thay vì cộng dồn 3 câu lại.'
          },
          {
            id: 'q2-2',
            question: 'Hành động nào sau đây sẽ làm nghẽn (Block) Node.js Event Loop khiến toàn bộ người dùng khác bị đứng hình?',
            options: [
              'Đọc file 500MB bằng fs.promises.readFile (bất đồng bộ)',
              'Thực hiện thuật toán tính toán ma trận / nén file nặng bằng vòng lặp for đồng bộ trên luồng chính',
              'Gửi email thông qua Message Queue (BullMQ)',
              'Thực hiện query Prisma có phân trang'
            ],
            correctIndex: 1,
            explanation: 'Các tác vụ CPU nặng chạy đồng bộ trên Main Thread sẽ độc chiếm Event Loop, khiến Node.js không thể chuyển sang phục vụ request khác.'
          },
          {
            id: 'q2-3',
            question: 'Trong Promise.all([task1, task2, task3]), nếu task2 bị ném Exception (Reject) thì chuyện gì xảy ra?',
            options: [
              'Promise.all vẫn trả về kết quả của task1 và task3',
              'Promise.all bị reject ngay lập tức với lỗi của task2',
              'Server Node.js tự động crash',
              'Task2 sẽ tự động retry 10 lần'
            ],
            correctIndex: 1,
            explanation: 'Promise.all có cơ chế Fail-fast: chỉ cần 1 promise thất bại thì toàn bộ Promise.all sẽ reject ngay lập tức.'
          },
          {
            id: 'l2-q4',
            question: 'Luồng chính (Main Thread) của Node.js xử lý việc gì?',
            options: [
              'Mọi thứ',
              'Chỉ mã JavaScript',
              'Chỉ I/O',
              'Chỉ Network'
            ],
            correctIndex: 1,
            explanation: 'Main thread xử lý JS, I/O đẩy cho libuv/OS.'
          },
          {
            id: 'l2-q5',
            question: 'Threadpool trong Node.js (libuv) dùng làm gì?',
            options: [
              'Chạy mọi async',
              'Chạy API File, DNS, Crypto',
              'Chỉ chạy HTTP',
              'Chạy React'
            ],
            correctIndex: 1,
            explanation: 'Threadpool hỗ trợ các tác vụ không dùng được async I/O của OS.'
          },
          {
            id: 'l2-q6',
            question: 'Tại sao không nên dùng while(true) trong Node.js?',
            options: [
              'Block Event Loop vĩnh viễn',
              'Lỗi cú pháp',
              'Không thể break',
              'Máy tính nổ'
            ],
            correctIndex: 0,
            explanation: 'While true chiếm trọn CPU main thread.'
          },
          {
            id: 'l2-q7',
            question: 'Làm sao xử lý tác vụ CPU nặng mà không block Event Loop?',
            options: [
              'Dùng setTimeout',
              'Dùng Worker Threads hoặc process riêng',
              'Dùng Promise',
              'Dùng async/await'
            ],
            correctIndex: 1,
            explanation: 'Worker Threads chia sẻ CPU ra thread khác.'
          },
          {
            id: 'l2-q8',
            question: 'Promise.allSettled khác Promise.all như thế nào?',
            options: [
              'Chạy nhanh hơn',
              'Đợi tất cả xong dù lỗi hay thành công',
              'Chạy từng cái một',
              'Chỉ trả thành công'
            ],
            correctIndex: 1,
            explanation: 'allSettled không fail-fast, nó gom kết quả của tất cả.'
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
            question: 'Khi Bác sĩ đăng nhập thành công nhưng bấm vào chức năng "Xóa Phòng Khám" mà tài khoản không có quyền, Server phải trả về HTTP Status Code nào?',
            options: [
              '401 Unauthorized',
              '403 Forbidden',
              '404 Not Found',
              '500 Internal Server Error'
            ],
            correctIndex: 1,
            explanation: '401 là chưa biết bạn là ai (chưa đăng nhập). 403 là đã biết bạn là ai nhưng bạn không có quyền thực hiện hành động này.'
          },
          {
            id: 'q3-2',
            question: 'Tại sao việc lưu trữ JWT Refresh Token trong HttpOnly Cookie an toàn hơn nhiều so với localStorage của trình duyệt?',
            options: [
              'Vì HttpOnly Cookie có dung lượng lớn hơn 50MB',
              'Vì mã độc JavaScript (XSS) chạy trên trình duyệt không thể đọc được HttpOnly Cookie',
              'Vì cookie không bao giờ hết hạn',
              'Vì cookie giúp tăng tốc độ mạng'
            ],
            correctIndex: 1,
            explanation: 'Cờ HttpOnly cấm JavaScript đọc cookie, nên giảm nguy cơ token bị exfiltrate qua XSS. XSS vẫn có thể gửi request bằng cookie tự động; cần CSP và CSRF defense phù hợp.'
          },
          {
            id: 'q3-3',
            question: 'Khái niệm "Idempotent" trong HTTP Method có ý nghĩa là gì?',
            options: [
              'API chạy với tốc độ dưới 10ms',
              'Thực hiện gọi API đó 1 lần hay nhiều lần liên tiếp với cùng tham số đều mang lại cùng 1 trạng thái dữ liệu trên hệ thống',
              'API không cần truyền Header',
              'API luôn trả về status 200'
            ],
            correctIndex: 1,
            explanation: 'GET, PUT, DELETE là Idempotent vì dù gọi 1 lần hay 10 lần thì trạng thái cuối cùng của tài nguyên trong database vẫn như nhau.'
          },
          {
            id: 'l3-q4',
            question: 'Preflight request (OPTIONS) sinh ra do đâu?',
            options: [
              'Server',
              'CORS của Trình duyệt tự gửi trước',
              'Database',
              'Router'
            ],
            correctIndex: 1,
            explanation: 'Trình duyệt gửi OPTIONS để kiểm tra quyền CORS trước khi gửi request thực.'
          },
          {
            id: 'l3-q5',
            question: 'Method HTTP nào không an toàn để lặp lại (Non-Idempotent)?',
            options: [
              'GET',
              'PUT',
              'DELETE',
              'POST'
            ],
            correctIndex: 3,
            explanation: 'POST thường tạo bản ghi mới, gọi 2 lần ra 2 bản ghi.'
          },
          {
            id: 'l3-q6',
            question: 'SameSite attribute trong Cookie có tác dụng gì?',
            options: [
              'Ngăn CSRF',
              'Tăng tốc load',
              'Chống XSS',
              'Mã hóa data'
            ],
            correctIndex: 0,
            explanation: 'SameSite=Strict/Lax giúp trình duyệt không gửi cookie trong cross-site request.'
          },
          {
            id: 'l3-q7',
            question: 'Mã lỗi HTTP 422 mang ý nghĩa gì?',
            options: [
              'Lỗi server',
              'Không tìm thấy',
              'Unprocessable Entity (lỗi logic/nghiệp vụ)',
              'Chưa đăng nhập'
            ],
            correctIndex: 2,
            explanation: 'Dữ liệu đúng format nhưng sai về mặt logic hệ thống.'
          },
          {
            id: 'l3-q8',
            question: 'Header Authorization: Bearer thường chứa gì?',
            options: [
              'Password',
              'JWT Access Token',
              'Cookie',
              'Session ID'
            ],
            correctIndex: 1,
            explanation: 'Chuẩn OAuth2 dùng Bearer để truyền JWT token.'
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
              'InventoryModule phải export InventoryItemService VÀ ClinicModule phải import InventoryModule',
              'Khai báo InventoryItemService vào providers của cả 2 module',
              'Tạo biến global window.InventoryItemService',
              'Dùng từ khóa new InventoryItemService()'
            ],
            correctIndex: 0,
            explanation: 'Muốn dùng service của module khác, module sở hữu phải export service đó và module tiêu thụ phải import module sở hữu vào mảng imports.'
          },
          {
            id: 'q4-2',
            question: 'Lợi ích lớn nhất của cơ chế Dependency Injection (DI) trong NestJS là gì?',
            options: [
              'Tự động viết code thay cho lập trình viên',
              'Tách rời sự phụ thuộc (Decoupling), giúp dễ dàng thay thế Mock Service khi viết Unit Test mà không cần sửa code Controller',
              'Làm cho file build có dung lượng nhỏ hơn',
              'Tự động tạo bảng trong Database'
            ],
            correctIndex: 1,
            explanation: 'DI cho phép ta dễ dàng inject Mock Database hoặc Mock Service vào Controller/Service khi chạy Unit Test, giúp kiểm thử nhanh và độc lập.'
          },
          {
            id: 'q4-3',
            question: 'Trong NestJS, decorator nào dùng để đánh dấu một Class có thể được inject bởi IoC Container?',
            options: [
              '@Injectable()',
              '@Controller()',
              '@Entity()',
              '@Component()'
            ],
            correctIndex: 0,
            explanation: '@Injectable() gắn metadata để NestJS IoC Container nhận diện và quản lý vòng đời của class đó.'
          },
          {
            id: 'l4-q4',
            question: 'Trong NestJS, @Module dùng để làm gì?',
            options: [
              'Khai báo DB',
              'Gom nhóm các thành phần liên quan',
              'Chạy script',
              'Cấu hình CORS'
            ],
            correctIndex: 1,
            explanation: 'Tổ chức code thành các khối tính năng.'
          },
          {
            id: 'l4-q5',
            question: 'Mảng "imports" trong @Module làm gì?',
            options: [
              'Nạp các module khác',
              'Import thư viện npm',
              'Chạy middleware',
              'Xuất service'
            ],
            correctIndex: 0,
            explanation: 'Nạp provider từ module khác đã export.'
          },
          {
            id: 'l4-q6',
            question: 'Global module là gì?',
            options: [
              'Có sẵn mọi nơi không cần import',
              'Module lỗi',
              'Module chưa hoàn thành',
              'Module Frontend'
            ],
            correctIndex: 0,
            explanation: '@Global() giúp module có mặt mọi nơi.'
          },
          {
            id: 'l4-q7',
            question: 'Dependency Injection giúp ích gì cho Unit Test?',
            options: [
              'Chạy nhanh',
              'Dễ dàng mock/stub phụ thuộc',
              'Không cần viết test',
              'Tự generate test'
            ],
            correctIndex: 1,
            explanation: 'Ta có thể truyền Mock object vào constructor thay vì object thật.'
          },
          {
            id: 'l4-q8',
            question: 'Circular Dependency xảy ra khi nào?',
            options: [
              'Module A import B, B import A',
              'Module A export B',
              'Module không import',
              'Lỗi DB'
            ],
            correctIndex: 0,
            explanation: 'Vòng lặp phụ thuộc khiến IoC không thể resolve.'
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
            question: 'Tại sao endpoint @Get("options") phải được đặt TRƯỚC endpoint @Get(":id") trong Controller?',
            options: [
              'Vì nếu đặt sau, router sẽ coi chuỗi "options" là giá trị tham số :id và kích hoạt ParseUUIDPipe gây lỗi 400 Bad Request',
              'Để code trông đẹp hơn',
              'Vì TypeScript bắt buộc xếp theo bảng chữ cái',
              'Không có ảnh hưởng gì'
            ],
            correctIndex: 0,
            explanation: 'Express/NestJS khớp route từ trên xuống. Dynamic param :id khớp với mọi chuỗi, nên nếu đứng trước nó sẽ nuốt mất các static sub-path như options hay export.'
          },
          {
            id: 'q5-2',
            question: 'ParseUUIDPipe trong @Param("id", ParseUUIDPipe) có tác dụng gì?',
            options: [
              'Tự động tạo ra một UUID mới',
              'Xác thực chuỗi id từ URL có đúng chuẩn UUID (v4) hay không, nếu sai lập tức trả về 400 Bad Request trước khi vào Controller',
              'Mã hóa id thành base64',
              'Tìm kiếm id trong Database'
            ],
            correctIndex: 1,
            explanation: 'ParseUUIDPipe là built-in pipe của NestJS giúp chặn đứng các request có ID sai định dạng ngay tại tầng HTTP.'
          },
          {
            id: 'q5-3',
            question: 'Decorator nào dùng để trích xuất dữ liệu JSON gửi lên từ payload của request POST/PATCH?',
            options: [
              '@Query()',
              '@Body()',
              '@Param()',
              '@Headers()'
            ],
            correctIndex: 1,
            explanation: '@Body() lấy toàn bộ hoặc một thuộc tính cụ thể từ Request Body JSON.'
          },
          {
            id: 'l5-q4',
            question: 'Decorator @Res() dùng để làm gì?',
            options: [
              'Lấy DB',
              'Truy cập raw Express/Fastify response object',
              'Trả về JSON',
              'Đọc Body'
            ],
            correctIndex: 1,
            explanation: 'Dùng khi cần kiểm soát response hoàn toàn (stream, file download).'
          },
          {
            id: 'l5-q5',
            question: 'DTO nên được hứng bằng decorator nào?',
            options: [
              '@Body()',
              '@Query()',
              'Cả Body và Query',
              'Không dùng decorator'
            ],
            correctIndex: 2,
            explanation: 'Cả Body(POST/PUT) và Query(GET) đều dùng DTO.'
          },
          {
            id: 'l5-q6',
            question: 'Điều gì xảy ra nếu quên @Param() trong tham số controller?',
            options: [
              'Tham số undefined',
              'Crash server',
              'Tự lấy id',
              'Lỗi DB'
            ],
            correctIndex: 0,
            explanation: 'NestJS sẽ không map tham số URL vào biến, biến sẽ là undefined.'
          },
          {
            id: 'l5-q7',
            question: 'ParseIntPipe làm gì?',
            options: [
              'Lọc XSS',
              'Chuyển chuỗi URL parameter sang số nguyên',
              'Kiểm tra mật khẩu',
              'Tìm theo ID'
            ],
            correctIndex: 1,
            explanation: 'Ép kiểu params string thành int.'
          },
          {
            id: 'l5-q8',
            question: 'Controller có nên gọi thẳng database không?',
            options: [
              'Nên',
              'Tuyệt đối KHÔNG, hãy giao cho Service',
              'Chỉ khi query ngắn',
              'Tùy framework'
            ],
            correctIndex: 1,
            explanation: 'Vi phạm Single Responsibility Principle.'
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
            question: 'Scope mặc định của một Service trong NestJS là gì?',
            options: [
              'Request Scope (tạo mới cho mỗi HTTP request)',
              'Singleton Scope (tạo 1 instance duy nhất cho toàn bộ app)',
              'Transient Scope (tạo mới mỗi lần inject)',
              'Prototype Scope'
            ],
            correctIndex: 1,
            explanation: 'Singleton là scope mặc định giúp tối ưu hóa bộ nhớ và tốc độ thực thi của Node.js.'
          },
          {
            id: 'q6-2',
            question: 'Khi máy chủ nhận tín hiệu tắt (SIGTERM) để deploy phiên bản mới, Lifecycle Hook nào được gọi để đóng kết nối Database an toàn?',
            options: [
              'onModuleInit',
              'onModuleDestroy',
              'ngOnDestroy',
              'componentWillUnmount'
            ],
            correctIndex: 1,
            explanation: 'onModuleDestroy (hoặc beforeApplicationShutdown) được gọi trong quá trình Graceful Shutdown để giải phóng tài nguyên.'
          },
          {
            id: 'q6-3',
            question: 'Tại sao nên tránh lạm dụng Scope.REQUEST nếu không thực sự cần thiết?',
            options: [
              'Vì Scope.REQUEST làm tăng độ trễ (latency) và tiêu tốn nhiều RAM do phải khởi tạo lại hàng nghìn object cho mỗi request',
              'Vì TypeScript không hỗ trợ',
              'Vì Scope.REQUEST chỉ chạy được trên Windows',
              'Không có nhược điểm gì'
            ],
            correctIndex: 0,
            explanation: 'Request Scope tạo ra overhead lớn về Garbage Collection (GC) và khởi tạo instance liên tục, làm giảm RPS (Requests Per Second) của server.'
          },
          {
            id: 'l6-q4',
            question: 'OnApplicationBootstrap khác OnModuleInit như nào?',
            options: [
              'Chạy trước',
              'Chạy sau khi TẤT CẢ module đã khởi tạo xong',
              'Không dùng được',
              'Lỗi runtime'
            ],
            correctIndex: 1,
            explanation: 'Bootstrap chạy khi mọi init đã hoàn thành.'
          },
          {
            id: 'l6-q5',
            question: 'Làm sao để inject config tùy chỉnh?',
            options: [
              'process.env',
              'ConfigService',
              'Ghi file',
              'Biến global'
            ],
            correctIndex: 1,
            explanation: 'ConfigService cung cấp type-safety và quản lý env tập trung.'
          },
          {
            id: 'l6-q6',
            question: 'Transient scope là gì?',
            options: [
              '1 instance',
              'Mỗi request 1 instance',
              'Mỗi nơi inject sẽ tạo 1 instance mới',
              'Global instance'
            ],
            correctIndex: 2,
            explanation: 'Cứ Inject là có instance mới, không chia sẻ.'
          },
          {
            id: 'l6-q7',
            question: 'Service A gọi Service B (cùng module), cần import gì ở A?',
            options: [
              'Import Module B',
              'Không cần, chỉ inject ở constructor',
              'Import Controller',
              'Dùng require'
            ],
            correctIndex: 1,
            explanation: 'Cùng module thì IoC đã có sẵn provider.'
          },
          {
            id: 'l6-q8',
            question: 'Graceful shutdown là gì?',
            options: [
              'Rút điện máy chủ',
              'Dừng nhận request mới, xử lý nốt request cũ và tắt DB kết nối',
              'Restart liên tục',
              'Xóa RAM'
            ],
            correctIndex: 1,
            explanation: 'Đóng ứng dụng an toàn không rớt kết nối đột ngột.'
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
            question: 'Tại sao DTO trong NestJS bắt buộc phải dùng Class thay vì TypeScript Interface?',
            options: [
              'Vì TypeScript Interface bị xóa sạch ở runtime khi compile sang JS, còn Class tồn tại ở runtime giúp class-validator và Swagger hoạt động',
              'Vì Class chạy nhanh hơn 10 lần so với Interface',
              'Vì NestJS không cho phép viết Interface',
              'Để tăng dung lượng file'
            ],
            correctIndex: 0,
            explanation: 'TypeScript Interface chỉ tồn tại trong quá trình biên dịch (Compile-time type checking). Class tồn tại ở runtime, cho phép reflect-metadata đọc decorator để validate.'
          },
          {
            id: 'q7-2',
            question: 'Cờ "whitelist: true" trong ValidationPipe có tác dụng bảo mật gì?',
            options: [
              'Cho phép mọi người dùng truy cập API không cần mật khẩu',
              'Tự động loại bỏ tất cả các trường dữ liệu mà client gửi lên nếu trường đó không được định nghĩa trong DTO (chống Mass Assignment)',
              'Bật giao diện màu trắng cho Swagger',
              'Tắt kiểm tra dữ liệu'
            ],
            correctIndex: 1,
            explanation: 'Whitelist ngăn chặn kẻ tấn công gửi thêm các trường nguy hiểm như isSuperAdmin: true hoặc role: "ADMIN" vào body request.'
          },
          {
            id: 'q7-3',
            question: 'Decorator @Type(() => Number) từ thư viện class-transformer có nhiệm vụ gì khi nhận dữ liệu từ Query Params?',
            options: [
              'Chuyển đổi chuỗi string "20" từ URL query thành số number 20 để validate @Min/@Max',
              'Kiểm tra xem số đó có phải số nguyên tố không',
              'Làm tròn số thập phân',
              'Mã hóa số đó'
            ],
            correctIndex: 0,
            explanation: 'Mọi query param trên URL đều là chuỗi (string). class-transformer giúp ép kiểu sang đúng kiểu dữ liệu nguyên thủy mong muốn.'
          },
          {
            id: 'l7-q4',
            question: 'class-validator là thư viện dùng làm gì?',
            options: [
              'Validate Entity',
              'Cung cấp decorator như @IsString() cho DTO',
              'Query DB',
              'Render UI'
            ],
            correctIndex: 1,
            explanation: 'Kết hợp cùng ValidationPipe để kiểm tra request.'
          },
          {
            id: 'l7-q5',
            question: 'transform: true trong ValidationPipe làm gì?',
            options: [
              'Xóa DTO',
              'Tự động ép kiểu (VD: string "123" -> number 123)',
              'Ẩn lỗi',
              'Đổi tên biến'
            ],
            correctIndex: 1,
            explanation: 'Tự convert payload về đúng kiểu khai báo.'
          },
          {
            id: 'l7-q6',
            question: 'forbidNonWhitelisted: true có tác dụng gì?',
            options: [
              'Trả về 400 nếu client gửi thừa trường rác',
              'Cho qua mọi thứ',
              'Chặn IP',
              'Lỗi 500'
            ],
            correctIndex: 0,
            explanation: 'Bảo vệ API khỏi các trường không lường trước.'
          },
          {
            id: 'l7-q7',
            question: '@ApiProperty() dùng để làm gì?',
            options: [
              'Khai báo biến',
              'Tạo document Swagger tự động',
              'Xác thực',
              'Lưu DB'
            ],
            correctIndex: 1,
            explanation: 'Tạo meta cho OpenAPI/Swagger UI.'
          },
          {
            id: 'l7-q8',
            question: 'DTO nên chứa logic nghiệp vụ không?',
            options: [
              'Có',
              'Không, chỉ Data Transfer (cấu trúc)',
              'Tùy',
              'Rất nên'
            ],
            correctIndex: 1,
            explanation: 'DTO chỉ định nghĩa hình dáng và luật lệ validation cơ bản.'
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
              'Để tăng tốc độ load trang',
              'Để bảo vệ pháp lý: Không cho phép bất kỳ ai vô tình xóa mất hồ sơ bệnh án y khoa đã phát sinh của bệnh nhân',
              'Vì Prisma không hỗ trợ Cascade',
              'Để giảm dung lượng ổ cứng'
            ],
            correctIndex: 1,
            explanation: 'Restrict là cơ chế bảo vệ tính toàn vẹn và tính pháp lý của dữ liệu y khoa, ngăn chặn việc xóa cha làm biến mất hàng loạt dữ liệu con quan trọng.'
          },
          {
            id: 'q8-2',
            question: 'B-Tree Index trong PostgreSQL giúp tăng tốc thao tác nào và làm chậm thao tác nào?',
            options: [
              'Tăng tốc SELECT/WHERE, làm chậm nhẹ thao tác INSERT/UPDATE/DELETE (do phải cập nhật lại cây Index)',
              'Làm chậm SELECT, tăng tốc INSERT',
              'Tăng tốc tất cả mọi thao tác mà không có nhược điểm nào',
              'Chỉ có tác dụng với cột kiểu số'
            ],
            correctIndex: 0,
            explanation: 'Index giúp truy vấn SELECT nhanh gấp hàng trăm lần, nhưng mỗi khi INSERT/UPDATE, DB phải cập nhật lại cấu trúc cây Index trên đĩa.'
          },
          {
            id: 'q8-3',
            question: 'Ràng buộc "@@unique([unitId, code])" (Composite Unique) có ý nghĩa gì trong hệ thống Multi-tenancy?',
            options: [
              'Mã code phải là duy nhất trên toàn cầu trong tất cả các phòng khám',
              'Mã code là duy nhất bên trong 1 phòng khám (unitId), hai phòng khám khác nhau vẫn có thể dùng chung mã code "VTTH-01"',
              'Mã code tự động tăng',
              'Mã code không được chứa chữ hoa'
            ],
            correctIndex: 1,
            explanation: 'Composite Unique đảm bảo tính duy nhất theo phạm vi từng tenant, cho phép các phòng khám độc lập tự đặt mã sản phẩm mà không bị xung đột nhau.'
          },
          {
            id: 'l8-q4',
            question: 'Khóa ngoại (Foreign Key) dùng để làm gì?',
            options: [
              'Tạo index',
              'Đảm bảo tính toàn vẹn tham chiếu giữa 2 bảng',
              'Tăng tốc tìm kiếm',
              'Lưu cache'
            ],
            correctIndex: 1,
            explanation: 'Tránh việc bảng A trỏ ID tới bảng B nhưng ID đó không tồn tại.'
          },
          {
            id: 'l8-q5',
            question: 'Composite Index (Index ghép) là gì?',
            options: [
              'Index trên nhiều DB',
              'Index gồm 2 hay nhiều cột kết hợp',
              'Index tự tăng',
              'Index bị lỗi'
            ],
            correctIndex: 1,
            explanation: 'Dùng tối ưu các query WHERE col1 AND col2.'
          },
          {
            id: 'l8-q6',
            question: 'N-N relationship (nhiều-nhiều) thường yêu cầu gì ở DB?',
            options: [
              'Không tạo được',
              'Bảng trung gian (Join table/Pivot table)',
              'Khóa chính kép',
              'JSON field'
            ],
            correctIndex: 1,
            explanation: 'Ví dụ User-Role cần bảng UserRoles trung gian.'
          },
          {
            id: 'l8-q7',
            question: 'Chuẩn hóa DB (Normalization) nhằm mục đích gì?',
            options: [
              'Tăng dữ liệu',
              'Giảm dư thừa dữ liệu (Data Redundancy)',
              'Làm DB chậm hơn',
              'Tạo nhiều view'
            ],
            correctIndex: 1,
            explanation: 'Tránh việc phải update 1 thông tin ở nhiều nơi.'
          },
          {
            id: 'l8-q8',
            question: 'Index B-Tree hoạt động tốt nhất cho phép so sánh nào?',
            options: [
              'LIKE %x%',
              'Dấu Bằng (=) và khoảng (>, <)',
              'REGEX',
              'Đảo chuỗi'
            ],
            correctIndex: 1,
            explanation: 'Cấu trúc cây tìm kiếm tối ưu cho equals và range scan.'
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
            question: 'Lợi ích của việc chia nhỏ schema Prisma thành nhiều file trong thư mục prisma/schema/ là gì?',
            options: [
              'Tránh việc toàn bộ 50+ bảng dữ liệu bị nhồi nhét vào 1 file schema.prisma dài 5,000 dòng, giúp nhiều lập trình viên làm việc cùng lúc không bị conflict Git',
              'Làm cho database chạy nhanh hơn 2 lần',
              'Để không cần cài PostgreSQL',
              'Để tạo backup tự động'
            ],
            correctIndex: 0,
            explanation: 'Multi-file schema giúp phân tách ranh giới module rõ ràng, tránh merge conflict khi nhiều team cùng phát triển các domain khác nhau.'
          },
          {
            id: 'q9-2',
            question: 'Khi triển khai ứng dụng lên môi trường Production (CI/CD), lệnh nào được dùng để áp dụng các file migration vào Database?',
            options: [
              'prisma migrate dev',
              'prisma migrate deploy',
              'prisma db push',
              'prisma studio'
            ],
            correctIndex: 1,
            explanation: 'prisma migrate deploy chỉ áp dụng các migration SQL chưa chạy vào Production mà không tạo migration mới và không reset database.'
          },
          {
            id: 'q9-3',
            question: 'Tại sao tuyệt đối KHÔNG ĐƯỢC dùng "prisma db push" trên môi trường Production?',
            options: [
              'Vì nó có thể tự ý drop bảng hoặc xóa cột gây mất vĩnh viễn dữ liệu người dùng mà không lưu lại lịch sử migration',
              'Vì nó chạy rất chậm',
              'Vì lệnh này chỉ chạy được trên Windows',
              'Không có rủi ro gì'
            ],
            correctIndex: 0,
            explanation: 'prisma db push đồng bộ trực tiếp schema lên DB và sẵn sàng drop table/column nếu phát hiện thay đổi, rất nguy hiểm cho Production.'
          },
          {
            id: 'l9-q4',
            question: 'Lệnh npx prisma format có tác dụng gì?',
            options: [
              'Xóa DB',
              'Định dạng lại file schema.prisma cho chuẩn',
              'Chạy migrate',
              'Tạo API'
            ],
            correctIndex: 1,
            explanation: 'Auto-format indent, references.'
          },
          {
            id: 'l9-q5',
            question: 'Prisma Client được generate ra nằm ở đâu?',
            options: [
              'node_modules/.prisma/client',
              'src/',
              'db/',
              'Không ở đâu cả'
            ],
            correctIndex: 0,
            explanation: 'Được sinh tự động trong node_modules để tiện import.'
          },
          {
            id: 'l9-q6',
            question: 'Lệnh npx prisma db push dùng khi nào?',
            options: [
              'Lên Production',
              'Chỉ dùng ở môi trường DEV (đồng bộ nhanh, không sinh file migration)',
              'Tạo backup',
              'Xóa bảng'
            ],
            correctIndex: 1,
            explanation: 'Push không giữ lịch sử migrate, chỉ dùng lúc Dev.'
          },
          {
            id: 'l9-q7',
            question: 'Khai báo @default(uuid()) trong Prisma làm gì?',
            options: [
              'Lỗi cú pháp',
              'Tự động gán UUID v4 khi insert',
              'Xóa cột',
              'Index cột'
            ],
            correctIndex: 1,
            explanation: 'Sử dụng uuid sinh tự động ở tầng application/DB.'
          },
          {
            id: 'l9-q8',
            question: 'Trong Prisma, dấu ? sau kiểu dữ liệu (String?) ý nghĩa gì?',
            options: [
              'Cột đó nullable (có thể rỗng/null)',
              'Regex',
              'Báo lỗi',
              'Tìm kiếm mờ'
            ],
            correctIndex: 0,
            explanation: 'Biến cột thành kiểu T | null.'
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
            question: 'Tại sao việc gọi query Database lặp đi lặp lại bên trong vòng lặp for (N+1 Query) là nguyên nhân hàng đầu làm sập máy chủ Backend?',
            options: [
              'Vì nó làm cạn kiệt Connection Pool của Database và làm tăng thời gian phản hồi API từ 10ms lên hàng nghìn ms',
              'Vì TypeScript không hỗ trợ vòng lặp for',
              'Vì PostgreSQL sẽ tự động xóa bảng',
              'Không có ảnh hưởng gì'
            ],
            correctIndex: 0,
            explanation: 'Mỗi câu query tốn chi phí mở kết nối, truyền gói tin mạng TCP và thực thi trên DB. 100 câu query lặp làm nghẽn toàn bộ Connection Pool của hệ thống.'
          },
          {
            id: 'q10-2',
            question: 'Trong Prisma, khi chỉ cần hiển thị một số trường nhất định của bảng liên kết (vd: chỉ cần id và fullName của Bác sĩ), ta nên dùng tùy chọn nào để tiết kiệm băng thông?',
            options: [
              'select',
              'include',
              'where',
              'orderBy'
            ],
            correctIndex: 0,
            explanation: 'select cho phép chỉ định chính xác các cột cần lấy từ DB, giảm dung lượng dữ liệu truyền qua mạng và RAM của server.'
          },
          {
            id: 'q10-3',
            question: 'Kỹ thuật Batching (in: uniqueIds) giải quyết bài toán N+1 bằng cách nào?',
            options: [
              'Gom toàn bộ N ID cần tìm và gửi đúng 1 câu query duy nhất với toán tử SQL IN',
              'Tắt chức năng query của database',
              'Lưu toàn bộ database vào file text',
              'Dùng setTimeout'
            ],
            correctIndex: 0,
            explanation: 'Thay vì N câu query riêng lẻ, Batching chỉ thực hiện 1 câu query duy nhất gom tất cả ID lại.'
          },
          {
            id: 'l10-q4',
            question: 'Lệnh include trong Prisma findAll làm gì?',
            options: [
              'Load kèm các bảng có quan hệ (JOIN)',
              'Xóa bảng',
              'Lọc data',
              'Sắp xếp'
            ],
            correctIndex: 0,
            explanation: 'Tương đương Eager Loading / LEFT JOIN.'
          },
          {
            id: 'l10-q5',
            question: 'Vấn đề N+1 Query thường do đâu?',
            options: [
              'Máy chủ yếu',
              'Lặp vòng lặp for và gọi truy vấn cho từng phần tử',
              'DB quá lớn',
              'Dùng ORM'
            ],
            correctIndex: 1,
            explanation: 'Chạy N truy vấn con cho 1 danh sách N phần tử thay vì IN(id).'
          },
          {
            id: 'l10-q6',
            question: 'select trong Prisma khác gì include?',
            options: [
              'Giống hệt',
              'select chỉ lấy ra đúng các cột/relation mình muốn (Tối ưu RAM)',
              'select báo lỗi',
              'select chậm hơn'
            ],
            correctIndex: 1,
            explanation: 'Include lấy tất cả cột, select chọn lọc cột.'
          },
          {
            id: 'l10-q7',
            question: 'Prisma Batching xử lý N+1 như thế nào (DataLoader)?',
            options: [
              'Không xử lý',
              'Tự gom các query trùng lặp/giống nhau gửi 1 lần (query bundling)',
              'Gửi N query',
              'Khóa DB'
            ],
            correctIndex: 1,
            explanation: 'Prisma có Data Loader pattern tích hợp sẵn.'
          },
          {
            id: 'l10-q8',
            question: 'Upsert trong Prisma là hành động gì?',
            options: [
              'Update nếu tồn tại, Insert nếu không tồn tại',
              'Xóa bảng',
              'Sắp xếp ngược',
              'Tạo mới'
            ],
            correctIndex: 0,
            explanation: 'Lệnh cực kỳ hữu ích thay cho kiểm tra find -> if -> create/update.'
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
            question: 'Trong khối this.prisma.$transaction(async (tx) => { ... }), nếu câu lệnh thứ 2 ném ra một Exception thì điều gì xảy ra với câu lệnh thứ 1 đã thực thi trước đó?',
            options: [
              'Câu lệnh thứ 1 vẫn lưu vào Database, chỉ câu lệnh 2 bị hủy',
              'Toàn bộ Transaction tự động Rollback (hủy bỏ hoàn toàn các thay đổi của câu 1), Database quay về nguyên trạng ban đầu',
              'Database bị khóa vĩnh viễn',
              'Server Node.js tự động tắt'
            ],
            correctIndex: 1,
            explanation: 'Tính chất Atomicity (Nguyên tử) đảm bảo nguyên tắc: Tất cả các câu lệnh cùng thành công hoặc không có bất kỳ câu lệnh nào được lưu.'
          },
          {
            id: 'q11-2',
            question: 'Với hai request xuất cùng một mặt hàng, cách nào tránh oversell tốt hơn việc đọc quantity rồi mới decrement?',
            options: [
              'Dùng conditional update `where: { quantity: { gte: qty } }`, decrement trong cùng câu lệnh, rồi kiểm tra số bản ghi được cập nhật',
              'Đọc số lượng hai lần trước khi ghi để chắc chắn hơn',
              'Chỉ kiểm tra `quantity < 0` sau update ngoài transaction',
              'Tin rằng Node.js single-thread nên không cần xử lý concurrent request'
            ],
            correctIndex: 0,
            explanation: 'Transaction hữu ích, nhưng read-then-write vẫn có race tùy cách viết. Conditional update biến điều kiện đủ hàng và decrement thành một thao tác nguyên tử ở DB.'
          },
          {
            id: 'q11-3',
            question: 'Mức độ cô lập giao dịch (Transaction Isolation Level) mặc định của PostgreSQL là gì?',
            options: [
              'Read Uncommitted',
              'Read Committed',
              'Repeatable Read',
              'Serializable'
            ],
            correctIndex: 1,
            explanation: 'Read Committed là mức cô lập mặc định của PostgreSQL, đảm bảo câu query chỉ đọc được dữ liệu đã được commit bởi các transaction khác.'
          },
          {
            id: 'l11-q4',
            question: 'Transaction Isolation Level ngăn ngừa lỗi gì?',
            options: [
              'Sai UI',
              'Các Race Conditions như Dirty Read, Non-Repeatable Read, Phantom Read',
              'Lỗi CPU',
              'Lỗi CSS'
            ],
            correctIndex: 1,
            explanation: 'Mức độ cách ly càng cao càng an toàn nhưng làm giảm tính đồng thời.'
          },
          {
            id: 'l11-q5',
            question: 'Pessimistic Locking (Khóa bi quan) là gì?',
            options: [
              'Khóa ngay từ đầu bằng FOR UPDATE',
              'Không khóa',
              'Khóa UI',
              'Dùng versioning'
            ],
            correctIndex: 0,
            explanation: 'Bắt các transaction khác phải chờ cho đến khi commit.'
          },
          {
            id: 'l11-q6',
            question: 'Optimistic Locking (Khóa lạc quan) thường dùng gì?',
            options: [
              'Cột version hoặc updatedAt',
              'FOR UPDATE',
              'Wait 10s',
              'Block User'
            ],
            correctIndex: 0,
            explanation: 'Cho phép đọc tự do, khi update check version. Nếu version đổi -> Retry.'
          },
          {
            id: 'l11-q7',
            question: 'Prisma Interactive Transaction dùng method gì?',
            options: [
              'prisma.$transaction(async (tx) => {})',
              'prisma.run()',
              'prisma.tx()',
              'prisma.begin()'
            ],
            correctIndex: 0,
            explanation: 'Chạy một callback async với client tx chứa lock.'
          },
          {
            id: 'l11-q8',
            question: 'Deadlock xảy ra khi nào?',
            options: [
              'DB đầy',
              'Hai transaction khóa tài nguyên chéo nhau và chờ đợi vô tận',
              'Quá timeout',
              'Mất mạng'
            ],
            correctIndex: 1,
            explanation: 'Tx1 đợi Lock B của Tx2, Tx2 đợi Lock A của Tx1.'
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
            question: 'Khi người dùng gọi API PATCH /api/i/v1/inventory/categories/:id, tại sao Service phải kiểm tra "where: { id, unitId }"?',
            options: [
              'Để kiểm tra bản ghi có tồn tại VÀ có thuộc về phòng khám của người dùng đang đăng nhập hay không, chống lỗ hổng xem trộm/sửa trộm dữ liệu phòng khám khác (IDOR)',
              'Để database chạy nhanh hơn',
              'Để format lại ngày tháng',
              'Không cần thiết nếu đã có id'
            ],
            correctIndex: 0,
            explanation: 'Nếu chỉ tìm theo { id }, người dùng ở Phòng khám A có thể đoán ID của Phòng khám B và sửa trộm dữ liệu.'
          },
          {
            id: 'q12-2',
            question: 'Trong mô hình phân cấp Group -> Unit -> Branch của eSmiles, cấp nào là đơn vị cô lập dữ liệu nghiệp vụ chính?',
            options: [
              'Branch',
              'Unit (Phòng khám)',
              'Group',
              'User'
            ],
            correctIndex: 1,
            explanation: 'Unit là đơn vị pháp nhân cô lập toàn bộ dữ liệu nghiệp vụ như Khách hàng, Bệnh án, Kho và Báo cáo tài chính.'
          },
          {
            id: 'q12-3',
            question: 'Lỗ hổng bảo mật IDOR (Insecure Direct Object References) là gì?',
            options: [
              'Lỗ hổng xảy ra khi ứng dụng cấp quyền truy cập trực tiếp vào đối tượng dữ liệu dựa trên ID do người dùng cung cấp mà không kiểm tra quyền sở hữu Tenant',
              'Lỗ hổng mất mạng',
              'Lỗ hổng máy tính bị virus',
              'Lỗi cú pháp TypeScript'
            ],
            correctIndex: 0,
            explanation: 'IDOR xảy ra khi server tin tưởng ID gửi lên từ client mà quên kiểm tra ID đó có thuộc về unitId của tài khoản đang đăng nhập hay không.'
          },
          {
            id: 'l12-q4',
            question: 'Row-Level Security (RLS) ở DB giúp ích gì?',
            options: [
              'Lọc Data ở tầng SQL thay vì Code',
              'Làm đẹp DB',
              'Tăng tốc Disk',
              'Giao diện'
            ],
            correctIndex: 0,
            explanation: 'Tránh leak data bằng policy trực tiếp trên DB.'
          },
          {
            id: 'l12-q5',
            question: 'Prisma Client Extension dùng làm gì trong Multi-tenant?',
            options: [
              'Thêm auto query filter { unitId } vào mọi tác vụ CRUD',
              'Đổi màu log',
              'Format JSON',
              'Tự xóa DB'
            ],
            correctIndex: 0,
            explanation: 'Cơ chế can thiệp Prisma để tự đính unitId chống rò rỉ tenant.'
          },
          {
            id: 'l12-q6',
            question: 'Data Leak (rò rỉ dữ liệu) Tenant xảy ra khi nào?',
            options: [
              'Quên WHERE unitId = X khi truy vấn',
              'Lỗi CSS',
              'Sai JWT',
              'Quên mật khẩu'
            ],
            correctIndex: 0,
            explanation: 'Lỗi con người quên where clause khiến trả nhầm data.'
          },
          {
            id: 'l12-q7',
            question: 'Cách thiết kế Multi-tenant 1 Database nhưng nhiều Schema có tên gọi là gì?',
            options: [
              'Shared DB Shared Schema',
              'Shared DB Separate Schema',
              'Separate DB',
              'No DB'
            ],
            correctIndex: 1,
            explanation: 'Dùng schema của PostgreSQL (Namespace).'
          },
          {
            id: 'l12-q8',
            question: 'Với eSmiles, cách triển khai tenant là gì?',
            options: [
              'Nhiều server',
              'Shared DB, chung bảng, phân biệt bằng cột unitId',
              '1 DB 1 User',
              'File XML'
            ],
            correctIndex: 1,
            explanation: 'Row-level tenancy (Shared Database, Shared Schema).'
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
            question: 'Khi Prisma ném ra mã lỗi P2002 (Unique constraint failed), AllExceptionsFilter của eSmiles sẽ map thành HTTP Status Code nào?',
            options: [
              '409 Conflict',
              '500 Internal Server Error',
              '200 OK',
              '400 Bad Request'
            ],
            correctIndex: 0,
            explanation: 'Lỗi vi phạm ràng buộc duy nhất (trùng mã code/email) được chuẩn hóa thành 409 Conflict.'
          },
          {
            id: 'q13-2',
            question: 'Lợi ích của việc xử lý lỗi tập trung bằng Exception Filter trong NestJS là gì?',
            options: [
              'Giữ cho code Service sạch sẽ, không bị lặp lại các khối try/catch giống hệt nhau ở hàng trăm endpoint',
              'Đảm bảo 100% các API trả về cấu trúc lỗi đồng nhất để Frontend dễ dàng bắt và hiển thị thông báo',
              'Cả 2 phương án trên đều đúng',
              'Không có lợi ích gì'
            ],
            correctIndex: 2,
            explanation: 'Exception Filter vừa giúp code tầng Business Logic sạch sẽ, vừa đảm bảo tính nhất quán của API contract.'
          },
          {
            id: 'q13-3',
            question: 'Khi xảy ra lỗi không mong muốn ở tầng hệ thống (ví dụ: Database bị ngắt kết nối đột ngột), Filter nên trả về gì cho client?',
            options: [
              'Mã lỗi 500 kèm theo thông báo an toàn, không để lộ thông tin nhạy cảm (như mật khẩu DB hay câu query raw) ra ngoài',
              'Trả về toàn bộ chuỗi kết nối Database chứa mật khẩu',
              'Trả về status 200 coi như không có chuyện gì',
              'Treo kết nối không phản hồi'
            ],
            correctIndex: 0,
            explanation: 'Không bao giờ được trả về Database credentials hoặc raw SQL trong response 500 vì lý do an toàn bảo mật.'
          },
          {
            id: 'l13-q4',
            question: 'HttpException trong NestJS dùng làm gì?',
            options: [
              'Lỗi UI',
              'Ném ra một Response Error chuẩn có StatusCode xác định',
              'Báo lỗi DB',
              'Tạo file'
            ],
            correctIndex: 1,
            explanation: 'Base class cho mọi error HTTP (BadRequest, NotFound).'
          },
          {
            id: 'l13-q5',
            question: 'Trong ExceptionFilter, làm sao log lỗi 500?',
            options: [
              'Lưu vào DB',
              'Dùng nest Logger, Sentry, hoặc File',
              'Bỏ qua',
              'Gửi email'
            ],
            correctIndex: 1,
            explanation: 'Ghi log (stack trace) ra hệ thống APM (như Sentry).'
          },
          {
            id: 'l13-q6',
            question: 'Bắt lỗi ValidationPipe thuộc loại HTTP status nào?',
            options: [
              '500',
              '400 Bad Request',
              '404',
              '200'
            ],
            correctIndex: 1,
            explanation: 'Dữ liệu đầu vào sai cấu trúc.'
          },
          {
            id: 'l13-q7',
            question: 'Catch-all Exception Filter bắt những gì?',
            options: [
              'Chỉ lỗi 500',
              'Mọi Exception bị ném ra mà chưa có ai catch',
              'Lỗi mạng',
              'Lỗi CSS'
            ],
            correctIndex: 1,
            explanation: 'Bắt tất cả lỗi chưa được xử lý để tránh sập app và che giấu stack trace.'
          },
          {
            id: 'l13-q8',
            question: 'Gửi Stack Trace ra môi trường Production (Client) có sao không?',
            options: [
              'Tốt cho debug',
              'Nguy hiểm, lộ cấu trúc code và bí mật hệ thống',
              'Không ảnh hưởng',
              'Làm app nhanh hơn'
            ],
            correctIndex: 1,
            explanation: 'Chỉ gửi message chung (Internal Error), log stacktrace vào hệ thống nội bộ.'
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
            question: 'Tại sao Access Token chỉ nên có thời hạn sống ngắn (15-30 phút)?',
            options: [
              'Để nếu Access Token bị kẻ xấu đánh cắp qua mạng, token sẽ nhanh chóng hết hạn và vô hiệu hóa sau 15 phút',
              'Vì máy chủ không đủ dung lượng lưu trữ token lâu',
              'Để bắt người dùng phải nhập lại mật khẩu liên tục',
              'Vì quy định của trình duyệt'
            ],
            correctIndex: 0,
            explanation: 'Access Token sống ngắn giúp hạn chế tối đa cửa sổ rủi ro (Blast Radius) nếu token bị rò rỉ.'
          },
          {
            id: 'q14-2',
            question: 'Kỹ thuật Refresh Token Rotation (RTR) hoạt động như thế nào?',
            options: [
              'Mỗi lần client dùng Refresh Token để xin Access Token mới, server lập tức hủy Refresh Token cũ và cấp 1 Refresh Token mới toanh',
              'Xoay vòng token theo bảng chữ cái',
              'Gửi token qua email',
              'Không đổi token bao giờ'
            ],
            correctIndex: 0,
            explanation: 'Refresh Token Rotation đảm bảo mỗi Refresh Token chỉ được dùng đúng 1 lần. Nếu 1 token bị dùng lại lần 2, hệ thống phát hiện hacker và khóa toàn bộ phiên đăng nhập.'
          },
          {
            id: 'q14-3',
            question: 'Cờ "SameSite: Strict" hoặc "SameSite: Lax" trên HttpOnly Cookie có tác dụng bảo vệ gì?',
            options: [
              'Chống tấn công CSRF (Cross-Site Request Forgery)',
              'Tăng tốc độ mạng',
              'Tự động format ngày tháng',
              'Xóa lịch sử duyệt web'
            ],
            correctIndex: 0,
            explanation: 'SameSite ngăn chặn việc trình duyệt tự động gửi cookie khi người dùng bị lừa click vào link từ trang web độc hại của bên thứ ba.'
          },
          {
            id: 'l14-q4',
            question: 'Argon2 vượt trội hơn Bcrypt ở điểm nào?',
            options: [
              'Tốc độ mã hóa 1ms',
              'Bảo vệ mạnh mẽ khỏi các cuộc tấn công bằng GPU/ASIC do đòi hỏi nhiều RAM',
              'Đọc dễ',
              'Sinh ngẫu nhiên'
            ],
            correctIndex: 1,
            explanation: 'Argon2 là chuẩn mã hóa mật khẩu hiện đại nhất (winner của PHC).'
          },
          {
            id: 'l14-q5',
            question: 'Salt (Muối) trong mã hóa mật khẩu dùng làm gì?',
            options: [
              'Cho mặn',
              'Chuỗi ngẫu nhiên nối vào mật khẩu trước khi băm, giúp chặn Rainbow Table Attack',
              'Tăng tốc',
              'Tạo session'
            ],
            correctIndex: 1,
            explanation: 'Đảm bảo cùng 1 mật khẩu băm ra kết quả khác nhau.'
          },
          {
            id: 'l14-q6',
            question: 'Refresh Token khác gì Access Token?',
            options: [
              'Ngắn hơn',
              'Thời gian sống (TTL) dài hơn, dùng để lấy Access Token mới mà không cần đăng nhập lại',
              'Được gửi mọi request',
              'Lưu trên mây'
            ],
            correctIndex: 1,
            explanation: 'Access Token sống ngắn (15m), Refresh Token sống dài (7d).'
          },
          {
            id: 'l14-q7',
            question: 'Thuộc tính Secure trong Cookie làm gì?',
            options: [
              'Mã hóa data',
              'Chỉ gửi cookie nếu đường truyền là HTTPS',
              'Chặn JS',
              'Chặn CORS'
            ],
            correctIndex: 1,
            explanation: 'Tránh gửi cookie dạng bản rõ qua HTTP.'
          },
          {
            id: 'l14-q8',
            question: 'Khi User đổi mật khẩu, hệ thống phải làm gì với Refresh Token cũ?',
            options: [
              'Không làm gì',
              'Thu hồi (Revoke/Xóa) toàn bộ phiên đăng nhập cũ',
              'Sửa lại',
              'Mã hóa lại'
            ],
            correctIndex: 1,
            explanation: 'Đảm bảo kẻ xấu bị văng ra khỏi các thiết bị.'
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
            question: 'Tại sao hệ thống y tế đa chi nhánh như eSmiles nên dùng Permission-based Access Control (PBAC) thay vì chỉ dùng Role-based (RBAC)?',
            options: [
              'Vì mỗi phòng khám có thể tự tạo các chức danh tùy chỉnh (Lễ tân ca tối, Y tá trưởng, Bác sĩ học việc) với tập hợp quyền hạn linh hoạt mà không cần sửa code backend',
              'Vì RBAC không chạy được trên Node.js',
              'Để làm code ngắn hơn',
              'Không có sự khác biệt'
            ],
            correctIndex: 0,
            explanation: 'PBAC cho phép phân quyền động đến từng nút bấm và từng API, trao quyền tự cấu hình cho quản lý phòng khám.'
          },
          {
            id: 'q15-2',
            question: 'Nếu tài khoản người dùng sở hữu quyền "inventory:*", họ có thể gọi API yêu cầu quyền "inventory:item:delete" không?',
            options: [
              'Có, vì ký tự đại diện wildcard (*) cho phép toàn quyền thao tác trên toàn bộ module inventory',
              'Không, phải đúng chính xác từng chữ',
              'Chỉ được gọi nếu là chủ phòng khám',
              'Bị khóa tài khoản'
            ],
            correctIndex: 0,
            explanation: 'Wildcard inventory:* khớp với mọi hành động thuộc module inventory.'
          },
          {
            id: 'q15-3',
            question: 'Bề mặt /api/p/v1/... trong kiến trúc Multi-surface của eSmiles dành cho đối tượng nào?',
            options: [
              'Platform Admin (Quản trị viên hệ thống)',
              'Internal Staff (Bác sĩ, Lễ tân)',
              'Public / Patient (Bệnh nhân sử dụng Mobile App hoặc Cổng bệnh nhân)',
              'Database Administrator'
            ],
            correctIndex: 2,
            explanation: 'Prefix /api/p/v1 phân vùng riêng cho bề mặt bệnh nhân (Patient / Public Portal).'
          },
          {
            id: 'l15-q4',
            question: 'ABAC (Attribute-Based Access Control) khác gì RBAC?',
            options: [
              'Chỉ phân quyền Role',
              'Phân quyền dựa trên thuộc tính của User, Tài nguyên và Môi trường (vd: chỉ được xóa nếu là người tạo)',
              'Cũ hơn',
              'Không dùng database'
            ],
            correctIndex: 1,
            explanation: 'CASL nổi tiếng về ABAC.'
          },
          {
            id: 'l15-q5',
            question: 'Trong CASL, "subject" là gì?',
            options: [
              'Tên bài học',
              'Thực thể bị tác động (User, Invoice, Patient)',
              'Role',
              'Hành động'
            ],
            correctIndex: 1,
            explanation: 'can("update", "Invoice").'
          },
          {
            id: 'l15-q6',
            question: 'Vì sao nên viết Policy Check ở tầng Service thay vì Controller?',
            options: [
              'Controller không hỗ trợ',
              'Service có thể query thêm data từ DB để check quyền ABAC phức tạp (vd: check owner)',
              'Controller làm chậm',
              'Service tự động check'
            ],
            correctIndex: 1,
            explanation: 'Cần logic DB (đọc object ra check) thì phải nằm ở service.'
          },
          {
            id: 'l15-q7',
            question: '@RequirePermission() decorator hoạt động như thế nào?',
            options: [
              'Là một Guard, chạy trước khi vào handler',
              'Sửa DB',
              'Khởi động app',
              'Tạo token'
            ],
            correctIndex: 0,
            explanation: 'Guard kiểm tra metadata của Route so với Token User.'
          },
          {
            id: 'l15-q8',
            question: 'Đại lý (Tenant) Admin có quyền xóa hệ thống không?',
            options: [
              'Có',
              'Không, chỉ SuperAdmin của nền tảng',
              'Tùy chọn',
              'Luôn luôn'
            ],
            correctIndex: 1,
            explanation: 'Tenant Admin chỉ có toàn quyền trong Unit/Tenant của họ.'
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
            question: 'Khi Bác sĩ sửa đổi giá của một dịch vụ khám răng, bước nào đối với Redis Cache là bắt buộc?',
            options: [
              'Xóa hoặc làm mới key cache tương ứng trong Redis (Cache Invalidation) để các request sau đọc được giá mới nhất',
              'Khởi động lại toàn bộ máy chủ Redis',
              'Tắt chức năng cache',
              'Không cần làm gì, cache sẽ tự biết'
            ],
            correctIndex: 0,
            explanation: 'Cache Invalidation đảm bảo dữ liệu hiển thị cho người dùng luôn chính xác và nhất quán với Database.'
          },
          {
            id: 'q16-2',
            question: 'Thông số TTL (Time-To-Live) của một key trong Redis có tác dụng gì?',
            options: [
              'Thời gian tồn tại của key đó trong RAM trước khi Redis tự động xóa nó đi để giải phóng bộ nhớ',
              'Thời gian khởi động của Redis',
              'Tốc độ truyền dữ liệu qua cáp quang',
              'Thời gian chờ kết nối'
            ],
            correctIndex: 0,
            explanation: 'TTL giúp cache tự động hết hạn, chống tràn RAM và làm mới dữ liệu định kỳ.'
          },
          {
            id: 'q16-3',
            question: 'Thuật toán Rate Limiting (chặn spam request) sử dụng Redis như thế nào?',
            options: [
              'Tăng biến đếm (INCR) theo IP/UserId trong 1 cửa sổ thời gian (vd: 100 req/phút), nếu vượt quá thì trả về mã 429 Too Many Requests',
              'Xóa toàn bộ database của người spam',
              'Khóa máy tính của người dùng',
              'Tắt mạng'
            ],
            correctIndex: 0,
            explanation: 'Redis INCR với TTL cho phép đếm số lượng request siêu nhanh ở mức vi-giây để chặn tấn công DDoS/Brute-force.'
          },
          {
            id: 'l16-q4',
            question: 'Redis là gì?',
            options: [
              'Relational DB',
              'In-memory Key-Value Store siêu tốc độ',
              'Web server',
              'Message Queue độc quyền'
            ],
            correctIndex: 1,
            explanation: 'Tốc độ ms nhờ lưu trên RAM.'
          },
          {
            id: 'l16-q5',
            question: 'Lệnh SETEX trong Redis làm gì?',
            options: [
              'Set rỗng',
              'Ghi key-value kèm theo thời gian sống (TTL)',
              'Xóa',
              'Tìm kiếm'
            ],
            correctIndex: 1,
            explanation: 'Tự động bốc hơi khỏi RAM khi hết hạn (Cache Expiration).'
          },
          {
            id: 'l16-q6',
            question: 'Cache Stampede (Thundering Herd) là hiện tượng gì?',
            options: [
              'Redis lỗi',
              'Hàng nghìn request đồng loạt query DB khi 1 Cache Key vừa hết hạn',
              'Xóa cache nhầm',
              'Tràn RAM'
            ],
            correctIndex: 1,
            explanation: 'DB có thể sập tức thì.'
          },
          {
            id: 'l16-q7',
            question: 'Rate Limiting (Token Bucket) dùng Redis để làm gì?',
            options: [
              'Lưu token đăng nhập',
              'Đếm số request của 1 IP/User trong thời gian ngắn để chặn Spam/DDoS',
              'Tăng tốc mạng',
              'Chặn VPN'
            ],
            correctIndex: 1,
            explanation: 'Tăng biến đếm trong Redis, vượt ngưỡng -> 429.'
          },
          {
            id: 'l16-q8',
            question: 'Dữ liệu nào phù hợp nhất để Cache?',
            options: [
              'Mật khẩu',
              'Lịch sử giao dịch 1 lần',
              'Danh mục, cấu hình, dữ liệu đọc nhiều ghi ít',
              'Chat realtime'
            ],
            correctIndex: 2,
            explanation: 'High read - low write ratio (VD: Master Data).'
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
            question: 'Ưu điểm lớn nhất của việc sử dụng Message Queue (BullMQ) cho các tác vụ nặng là gì?',
            options: [
              'Tách công việc khỏi request HTTP để trả sớm; worker riêng có thể retry lỗi transient theo backoff và theo dõi job thất bại',
              'Làm cho code ngắn hơn',
              'Để thay thế PostgreSQL',
              'Không có lợi ích gì'
            ],
            correctIndex: 0,
            explanation: 'Queue giúp tách rời tác vụ khỏi chu trình HTTP. CPU work chỉ không block request server khi consumer được tách process/pod hoặc dùng worker thread phù hợp.'
          },
          {
            id: 'q17-2',
            question: 'Cơ chế "Exponential Backoff" khi retry job có ý nghĩa gì?',
            options: [
              'Tăng thời gian chờ theo hàm mũ giữa các lần thử lại (vd: 1s, 2s, 4s, 8s) để tránh làm nghẽn thêm hệ thống bên thứ ba đang bị quá tải',
              'Thử lại liên tục 1,000 lần trong 1 giây',
              'Xóa job ngay lập tức',
              'Gửi cảnh báo qua email'
            ],
            correctIndex: 0,
            explanation: 'Exponential backoff giúp hệ thống bên ngoài có thời gian hồi phục trước khi nhận request thử lại tiếp theo.'
          },
          {
            id: 'q17-3',
            question: 'Khi một Job đã retry hết số lần cho phép (vd: 3 lần) mà vẫn thất bại, BullMQ sẽ chuyển Job đó vào đâu để lập trình viên điều tra?',
            options: [
              'Failed State / Dead Letter Queue (DLQ)',
              'Tự động xóa vĩnh viễn không để lại dấu vết',
              'Gửi lại vào Database',
              'Làm sập máy chủ'
            ],
            correctIndex: 0,
            explanation: 'Dead Letter Queue lưu giữ các job thất bại hoàn toàn để admin có thể kiểm tra nguyên nhân và bấm retry thủ công khi sửa xong lỗi.'
          },
          {
            id: 'l17-q4',
            question: 'Message Queue (như BullMQ) dùng để làm gì?',
            options: [
              'Thay thế DB',
              'Tách các tác vụ nặng (gửi email, tính toán) chạy nền ở worker riêng',
              'Gửi HTTP',
              'Cache dữ liệu'
            ],
            correctIndex: 1,
            explanation: 'Offload CPU và I/O ra khỏi HTTP Event Loop.'
          },
          {
            id: 'l17-q5',
            question: 'BullMQ sử dụng DB/Store nào làm lõi lưu trữ queue?',
            options: [
              'Postgres',
              'MongoDB',
              'Redis',
              'RabbitMQ'
            ],
            correctIndex: 2,
            explanation: 'BullMQ viết trên Redis Streams.'
          },
          {
            id: 'l17-q6',
            question: 'DLQ (Dead Letter Queue) là gì?',
            options: [
              'Hàng đợi rỗng',
              'Nơi chứa các Job đã retry nhiều lần vẫn thất bại để kỹ sư kiểm tra',
              'Xóa data',
              'Log file'
            ],
            correctIndex: 1,
            explanation: 'Tránh job lỗi cứ retry mãi vòng lặp vô hạn.'
          },
          {
            id: 'l17-q7',
            question: 'Job Idempotency trong Queue quan trọng thế nào?',
            options: [
              'Làm chậm hệ thống',
              'Đảm bảo nếu Worker bị tắt giữa chừng và chạy lại Job, DB không bị trừ/cộng tiền 2 lần',
              'Không cần',
              'Chỉ dùng cho mail'
            ],
            correctIndex: 1,
            explanation: 'Xử lý At-least-once delivery của Queue.'
          },
          {
            id: 'l17-q8',
            question: 'Job Concurrency là gì?',
            options: [
              'Xóa job',
              'Số lượng Job mà Worker xử lý đồng thời',
              'Tốc độ mạng',
              'Thời gian chờ'
            ],
            correctIndex: 1,
            explanation: 'Quy định worker cắn bao nhiêu job cùng lúc.'
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
            question: 'Ưu điểm lớn nhất của mô hình Presigned URL khi upload file X-Quang 500MB là gì?',
            options: [
              'Trình duyệt stream trực tiếp lên Object Storage, giảm tải proxy upload cho Backend; Backend vẫn phải authorize, giới hạn upload và xác minh file sau upload',
              'Làm cho ảnh có độ phân giải cao hơn',
              'Không cần lưu trữ trên đĩa cứng',
              'Để giảm chi phí mạng'
            ],
            correctIndex: 0,
            explanation: 'Presigned URL chuyển đường dữ liệu file sang Object Storage. Nó không thay validation, scan malware, quota, checksum hay kiểm tra quyền tenant.'
          },
          {
            id: 'q18-2',
            question: 'Thời gian hết hạn (Expiry) của một Presigned Upload URL nên đặt là bao lâu?',
            options: [
              'Khoảng 10 - 15 phút, vừa đủ để client hoàn thành upload và ngăn chặn URL bị lạm dụng nếu bị lộ',
              'Vĩnh viễn không bao giờ hết hạn',
              '1 giây',
              '10 năm'
            ],
            correctIndex: 0,
            explanation: 'Thời hạn ngắn (10-15 phút) đảm bảo an toàn, kẻ xấu không thể tái sử dụng URL để upload file rác.'
          },
          {
            id: 'q18-3',
            question: 'Để đảm bảo tính cô lập Multi-tenancy cho file lưu trữ, Object Key nên có cấu trúc như thế nào?',
            options: [
              '{unitId}/{folder}/{timestamp}-{filename}',
              'Chỉ lưu tên file {filename}',
              'Lưu vào thư mục gốc /root',
              'Không cần đặt tên'
            ],
            correctIndex: 0,
            explanation: 'Đặt prefix {unitId}/ ở đầu đường dẫn object giúp cô lập hoàn toàn vùng lưu trữ file của từng phòng khám.'
          },
          {
            id: 'l18-q4',
            question: 'Presigned URL là gì?',
            options: [
              'URL lỗi',
              'URL sinh ra từ server, cho phép Client tải trực tiếp file lên S3/MinIO mà không cần stream qua Backend',
              'URL chứa virus',
              'URL đăng nhập'
            ],
            correctIndex: 1,
            explanation: 'Giảm 100% băng thông và RAM cho Backend.'
          },
          {
            id: 'l18-q5',
            question: 'Tại sao không lưu file thẳng vào thư mục source code hoặc Database?',
            options: [
              'Đỡ tốn điện',
              'Khó scale nhiều server, db phình to, load chậm',
              'Không tạo được file',
              'Vì dễ bị hack'
            ],
            correctIndex: 1,
            explanation: 'Lưu file làm hỏng nguyên lý Stateless Server.'
          },
          {
            id: 'l18-q6',
            question: 'MinIO là phần mềm mô phỏng giao thức của dịch vụ nào?',
            options: [
              'Google Drive',
              'AWS S3',
              'Dropbox',
              'FTP'
            ],
            correctIndex: 1,
            explanation: 'MinIO chuẩn 100% S3 API.'
          },
          {
            id: 'l18-q7',
            question: 'Multipart Upload dùng khi nào?',
            options: [
              'File < 1MB',
              'File siêu lớn (VD: video 5GB), chia nhỏ ra up song song',
              'Up nhiều file',
              'Tạo folder'
            ],
            correctIndex: 1,
            explanation: 'Chia chunk upload an toàn.'
          },
          {
            id: 'l18-q8',
            question: 'Trường MIME Type (ContentType) trong upload làm gì?',
            options: [
              'Mã hóa file',
              'Nói cho trình duyệt biết đây là ảnh (image/jpeg) hay pdf để hiển thị',
              'Check dung lượng',
              'Xóa file'
            ],
            correctIndex: 1,
            explanation: 'Quan trọng để browser không bắt tải về như tệp vô danh.'
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
            question: 'Tại sao cần phân chia WebSocket Rooms theo "unit:{unitId}" trong hệ thống eSmiles?',
            options: [
              'Để đảm bảo Multi-tenancy: Chỉ các bác sĩ thuộc đúng phòng khám đó mới nhận được thông báo của phòng khám mình',
              'Vì Socket.IO bắt buộc',
              'Để giảm số lượng kết nối',
              'Không có lý do'
            ],
            correctIndex: 0,
            explanation: 'Phân chia rooms theo UnitId ngăn chặn rò rỉ thông báo của phòng khám này sang phòng khám khác.'
          },
          {
            id: 'q19-2',
            question: 'Khi triển khai nhiều máy chủ Backend NestJS (Scaling out), công cụ nào giúp đồng bộ hóa các sự kiện WebSocket giữa các server?',
            options: [
              'Socket.IO Redis Adapter (Pub/Sub)',
              'Gửi qua email',
              'Lưu vào file text trên ổ cứng',
              'Không thể đồng bộ'
            ],
            correctIndex: 0,
            explanation: 'Redis Pub/Sub Adapter đóng vai trò Message Broker đồng bộ sự kiện giữa tất cả các node máy chủ trong cụm.'
          },
          {
            id: 'q19-3',
            question: 'Giao thức WebSocket khác gì so với HTTP truyền thống?',
            options: [
              'WebSocket là kết nối 2 chiều liên tục (Full-duplex) qua 1 kết nối TCP duy nhất, cho phép server chủ động đẩy dữ liệu về client tức thì',
              'WebSocket chỉ truyền được text còn HTTP truyền được ảnh',
              'WebSocket chậm hơn HTTP',
              'Không có sự khác biệt'
            ],
            correctIndex: 0,
            explanation: 'WebSocket duy trì kết nối sống, giúp server bắn dữ liệu xuống client với độ trễ chỉ vài mili-giây mà client không cần gửi request hỏi liên tục (Polling).'
          },
          {
            id: 'l19-q4',
            question: 'Giao thức WebSocket hoạt động thế nào?',
            options: [
              'Gửi request nhận response rồi đóng',
              'Duy trì kết nối TCP 2 chiều liên tục (Full-duplex)',
              'Chỉ dùng UDP',
              'Tương đương HTTP'
            ],
            correctIndex: 1,
            explanation: 'Client và Server có thể push data cho nhau bất cứ lúc nào.'
          },
          {
            id: 'l19-q5',
            question: 'Redis Adapter trong Socket.IO giải quyết bài toán gì?',
            options: [
              'Ghi log',
              'Khi có nhiều node Backend, event bắn từ Node A sẽ được chia sẻ sang Node B qua Redis pub/sub',
              'Nén data',
              'Cache HTTP'
            ],
            correctIndex: 1,
            explanation: 'Giúp scale horizontally WebSocket Server.'
          },
          {
            id: 'l19-q6',
            question: 'Rooms trong Socket.IO là khái niệm gì?',
            options: [
              'Phòng chat',
              'Nhóm các kết nối lại (ví dụ theo unitId), server chỉ phát tín hiệu vào nhóm đó',
              'Chặn IP',
              'Gửi toàn bộ'
            ],
            correctIndex: 1,
            explanation: 'Giúp Broadcast tiết kiệm tài nguyên.'
          },
          {
            id: 'l19-q7',
            question: 'Làm sao xác thực (Authenticate) WebSocket connection?',
            options: [
              'Qua Body',
              'Gửi Token ngay khi mở kết nối (Handshake Auth) và check ở Gateway',
              'Không cần',
              'Tự check'
            ],
            correctIndex: 1,
            explanation: 'Chặn từ cửa Handshake để đỡ tốn connection.'
          },
          {
            id: 'l19-q8',
            question: 'Nhược điểm của WebSocket?',
            options: [
              'Chậm',
              'Tốn nhiều TCP Connection và RAM duy trì, khó scale load balancer hơn HTTP stateless',
              'Bảo mật kém',
              'Không gửi JSON được'
            ],
            correctIndex: 1,
            explanation: 'LB phải cấu hình sticky session hoặc Redis Adapter.'
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
            question: 'Thông tin nào sau đây là bắt buộc phải có trong một bản ghi Audit Log y tế chuẩn?',
            options: [
              'actorId, unitId, action, targetEntity, entityId, changes (diff before/after), timestamp',
              'Màu sắc màn hình',
              'Tên bài hát',
              'Dung lượng RAM của máy tính client'
            ],
            correctIndex: 0,
            explanation: 'Bộ dữ liệu 5W (Who, What, Where, When, Why) là tiêu chuẩn bắt buộc của kiểm toán dữ liệu y tế và tài chính.'
          },
          {
            id: 'q20-2',
            question: 'Tại sao việc tính toán "diff" (chỉ ghi lại các trường bị thay đổi) tốt hơn việc lưu toàn bộ object cũ và mới?',
            options: [
              'Tiết kiệm 90% dung lượng lưu trữ Database và giúp người xem log nhìn thấy ngay lập tức trường nào bị chỉnh sửa',
              'Vì database không cho lưu object to',
              'Để tăng dung lượng file build',
              'Không có lợi ích gì'
            ],
            correctIndex: 0,
            explanation: 'Diffing chỉ lưu { field, oldValue, newValue }, vừa tiết kiệm dung lượng đĩa vừa giúp kiểm toán viên đọc hiểu tức thì.'
          },
          {
            id: 'q20-3',
            question: 'Bảng Audit Log có được phép cho người dùng sửa hoặc xóa (UPDATE / DELETE) không?',
            options: [
              'Tuyệt đối CẤM: Bảng Audit Log là Append-Only (chỉ cho phép ghi INSERT), không ai kể cả Admin được quyền chỉnh sửa lịch sử kiểm toán',
              'Cho phép Bác sĩ tự do xóa log của mình',
              'Tự động xóa sau 1 ngày',
              'Được sửa tùy ý'
            ],
            correctIndex: 0,
            explanation: 'Tính bất biến (Immutability) của Audit Log là nguyên tắc pháp lý cốt lõi để chống gian lận và chối bỏ trách nhiệm.'
          },
          {
            id: 'l20-q4',
            question: 'Event-driven Architecture (EDA) khác Rest API như thế nào?',
            options: [
              'Đồng bộ hoàn toàn',
              'Dịch vụ A phát ra Event (Event Publisher), các dịch vụ B, C tự động lắng nghe mà không cần A biết B,C là ai (Decoupling)',
              'A gọi B chờ B xong',
              'Chậm hơn'
            ],
            correctIndex: 1,
            explanation: 'Mô hình Fire-and-Forget giảm Coupling.'
          },
          {
            id: 'l20-q5',
            question: 'Audit Log (Nhật ký kiểm toán) lưu gì?',
            options: [
              'Lỗi code 500',
              'Ghi nhận Ai (User), làm Gì (Action), trên dữ liệu nào (Entity), lúc nào, kết quả ra sao',
              'File css',
              'Log nginx'
            ],
            correctIndex: 1,
            explanation: 'Chức năng pháp lý trong y tế/tài chính.'
          },
          {
            id: 'l20-q6',
            question: 'NestJS EventEmitter2 dùng làm gì?',
            options: [
              'Kafka pubsub',
              'Phát và lắng nghe sự kiện TRONG CÙNG 1 tiến trình Node.js (In-memory)',
              'Redis',
              'DB trigger'
            ],
            correctIndex: 1,
            explanation: 'Gọn nhẹ cho monolith.'
          },
          {
            id: 'l20-q7',
            question: 'Khi ghi Audit Log tốn thời gian, ta nên làm gì?',
            options: [
              'Bỏ qua',
              'Ghi bất đồng bộ (Event) không làm chậm request của User',
              'Khóa DB',
              'Chờ ghi xong'
            ],
            correctIndex: 1,
            explanation: 'Lắng nghe event và insert Audit sau khi trả response.'
          },
          {
            id: 'l20-q8',
            question: 'Eventual Consistency (Nhất quán muộn) là rủi ro gì của Event Driven?',
            options: [
              'Lỗi luôn',
              'Dữ liệu ở các hệ thống không đồng bộ tức thì, cần thời gian trễ',
              'Mất dữ liệu',
              'Bảo mật'
            ],
            correctIndex: 1,
            explanation: 'User update X, nhưng Service Y đọc vẫn thấy cũ trong 1 giây.'
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
            question: 'Lợi ích lớn nhất của việc lưu trữ các file kiểm thử API Bruno (.bru) trực tiếp trong kho mã nguồn Git là gì?',
            options: [
              'Bộ tài liệu và kiểm thử API luôn đồng bộ 100% với từng commit code và được kiểm tra tự động qua Git Pull Request',
              'Để làm tăng dung lượng kho code Git',
              'Để không cần viết unit test',
              'Không có lợi ích gì'
            ],
            correctIndex: 0,
            explanation: 'Tracking file .bru trực tiếp trong Git biến tài liệu API thành bộ test sống luôn đồng bộ với code của lập trình viên.'
          },
          {
            id: 'q21-2',
            question: 'Lệnh nào trong eSmiles dùng để đối chiếu toàn bộ router của Controller với thư mục bruno/ và báo lỗi nếu có endpoint thiếu tài liệu test?',
            options: [
              'pnpm bruno:check',
              'pnpm test',
              'pnpm build',
              'pnpm start'
            ],
            correctIndex: 0,
            explanation: 'pnpm bruno:check là Quality Gate tự động đối chiếu các route đã khai báo với collection Bruno.'
          },
          {
            id: 'q21-3',
            question: 'File .bru có thể được mở và chỉnh sửa bằng công cụ nào?',
            options: [
              'Ứng dụng mã nguồn mở Bruno Client hoặc mở bằng bất kỳ trình soạn thảo mã nguồn nào như VS Code',
              'Chỉ mở được bằng Photoshop',
              'Chỉ mở được trên trình duyệt Safari',
              'Không thể mở'
            ],
            correctIndex: 0,
            explanation: 'File .bru là định dạng text thuần (Plain text DSL), có thể mở bằng Bruno App hoặc VS Code.'
          },
          {
            id: 'l21-q4',
            question: 'CI/CD Gate là gì?',
            options: [
              'Cổng mạng',
              'Tiến trình tự động chặn code merge nếu Test, Lint hoặc Build thất bại',
              'Cổng login',
              'Lỗi DB'
            ],
            correctIndex: 1,
            explanation: 'Giữ code base luôn xanh (Green).'
          },
          {
            id: 'l21-q5',
            question: 'Bruno là công cụ gì?',
            options: [
              'Thay thế Postman/Insomnia, lưu test dạng file text (Bru) dễ đưa lên Git',
              'Web server',
              'Database',
              'IDE code'
            ],
            correctIndex: 0,
            explanation: 'Hoạt động offline và lưu file .bru trực tiếp vào source control.'
          },
          {
            id: 'l21-q6',
            question: 'API Testing Assertions là gì?',
            options: [
              'Bấm gửi',
              'Các câu lệnh kiểm tra xem Response (Status, Body) có đúng kỳ vọng không',
              'Tạo tài liệu',
              'Deploy'
            ],
            correctIndex: 1,
            explanation: 'expect(res.status).toBe(200).'
          },
          {
            id: 'l21-q7',
            question: 'Husky pre-commit hook làm gì?',
            options: [
              'Push code',
              'Tự động chạy script (Lint, Typecheck) TRƯỚC KHI git commit được tạo',
              'Kéo code',
              'Cài gói npm'
            ],
            correctIndex: 1,
            explanation: 'Chặn dev commit code rác lên máy chủ.'
          },
          {
            id: 'l21-q8',
            question: 'Chạy npx tsc --noEmit để làm gì?',
            options: [
              'Tạo file js',
              'Kiểm tra lỗi kiểu dữ liệu (Type check) của TypeScript mà không biên dịch ra file mới',
              'Xóa file',
              'Chạy test'
            ],
            correctIndex: 1,
            explanation: 'Bắt lỗi cú pháp tĩnh nhanh chóng.'
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
              'Để bài test chạy độc lập, siêu nhanh trong vài mili-giây và không làm biến đổi dữ liệu của database thật khi chạy trên môi trường CI/CD',
              'Vì Jest không thể kết nối mạng',
              'Vì database bị khóa',
              'Không có lý do'
            ],
            correctIndex: 0,
            explanation: 'Mocking giúp unit test chạy nhanh, cô lập hoàn toàn và có thể chạy ở bất kỳ máy tính nào mà không cần cài PostgreSQL.'
          },
          {
            id: 'q22-2',
            question: 'Công cụ nào trong NestJS được dùng để gửi request HTTP thực tế khi viết E2E Testing?',
            options: [
              'Supertest',
              'Puppeteer',
              'Photoshop',
              'Excel'
            ],
            correctIndex: 0,
            explanation: 'Supertest kết hợp cùng @nestjs/testing cho phép bắn request HTTP trực tiếp vào instance HTTP Server của NestJS.'
          },
          {
            id: 'q22-3',
            question: 'Hàm expect(mockFn).toHaveBeenCalledWith(expectedArgs) trong Jest có tác dụng gì?',
            options: [
              'Kiểm tra xem hàm mock có thực sự được gọi với đúng các tham số mong đợi hay không',
              'Tự động sửa lỗi code',
              'In kết quả ra máy in',
              'Khởi động lại server'
            ],
            correctIndex: 0,
            explanation: 'toHaveBeenCalledWith là assertion cơ bản để verify xem Service có truyền đúng tham số (ví dụ đúng unitId) xuống Prisma hay không.'
          },
          {
            id: 'l22-q4',
            question: 'Khác biệt giữa Unit Test và E2E Test?',
            options: [
              'Không có',
              'Unit Test giả lập DB (Mock), E2E Test gọi HTTP xuyên thẳng DB thật/test',
              'Unit nhanh hơn',
              'E2E là viết bằng tay'
            ],
            correctIndex: 1,
            explanation: 'Unit test test hàm đơn lẻ. E2E test cả hệ thống.'
          },
          {
            id: 'l22-q5',
            question: 'Jest spyOn() dùng làm gì?',
            options: [
              'Tấn công DB',
              'Theo dõi và thay thế một hàm thật bằng hàm Mock (vd: chặn không cho gửi mail thật)',
              'Đo thời gian',
              'Quay video'
            ],
            correctIndex: 1,
            explanation: 'Đóng thế các side-effects.'
          },
          {
            id: 'l22-q6',
            question: 'Supertest là công cụ gì?',
            options: [
              'Framework E2E',
              'Thư viện giả lập HTTP Request để test API mà không cần mở Port thật',
              'Database in-mem',
              'Check css'
            ],
            correctIndex: 1,
            explanation: 'Gắn thẳng vào app NestJS và gửi request ảo.'
          },
          {
            id: 'l22-q7',
            question: 'Test Coverage là chỉ số gì?',
            options: [
              'Tốc độ test',
              'Tỉ lệ % dòng code đã được chạy qua bởi Test runner',
              'Dung lượng code',
              'Bảo mật'
            ],
            correctIndex: 1,
            explanation: 'Bao nhiêu % file được test quét qua (nhưng 100% chưa chắc không có bug).'
          },
          {
            id: 'l22-q8',
            question: 'Trong Unit Test, beforeEach() làm gì?',
            options: [
              'Chạy sau khi test xong',
              'Chạy 1 block setup (reset mock, nạp data) TRƯỚC MỖI test case (it)',
              'Báo lỗi',
              'Xóa DB'
            ],
            correctIndex: 1,
            explanation: 'Giúp các test case hoàn toàn độc lập, không bị rò rỉ state.'
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
