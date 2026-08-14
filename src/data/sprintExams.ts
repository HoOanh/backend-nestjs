import type { QuizQuestion, CodeChallenge } from './curriculum.ts';

export interface SprintExam {
  sprintId: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questions: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export const SPRINT_EXAMS: SprintExam[] = [
  {
    sprintId: 0,
    title: 'Bài Kiểm Tra Sprint 0: Cầu Nối React/Next.js → Backend Mental Model',
    description: 'Đánh giá chuyên sâu kiến thức chuyển đổi tư duy: Long-running Process, Concurrency, Event Loop, Non-blocking I/O và Giao thức HTTP RFC.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's0-q1',
        question: 'Tại sao việc lưu trữ state của người dùng vào biến thuộc tính của NestJS Service (Singleton) là lỗi nghiêm trọng?',
        options: [
          'Vì Service là Singleton được chia sẻ cho toàn bộ hàng nghìn người dùng, request của người sau sẽ ghi đè và làm lộ dữ liệu sang người trước (Race Condition)',
          'Vì TypeScript compiler sẽ báo lỗi không cho build',
          'Vì làm chậm tốc độ mạng',
          'Không có rủi ro gì'
        ],
        correctIndex: 0,
        explanation: 'Singleton Service chia sẻ 1 instance duy nhất trong RAM cho toàn bộ ứng dụng, mọi request đều dùng chung các biến thuộc tính của nó.'
      },
      {
        id: 's0-q2',
        question: 'Để không làm nghẽn (block) Node.js Event Loop, các tác vụ I/O (Query DB, gọi API ngoài) phải được thực thi như thế nào?',
        options: [
          'Dùng vòng lặp while',
          'Dùng bất đồng bộ (Non-blocking I/O) với async/await hoặc Promise',
          'Chạy đồng bộ trên Main Thread',
          'Tắt Node.js'
        ],
        correctIndex: 1,
        explanation: 'Async/await non-blocking I/O cho phép Node.js phục vụ các request khác trong khi chờ kết quả từ Database/Mạng.'
      },
      {
        id: 's0-q3',
        question: 'Khi client gọi API gửi request body sai định dạng, mã HTTP Status Code chuẩn nào cần trả về?',
        options: [
          '400 Bad Request',
          '500 Internal Server Error',
          '200 OK',
          '401 Unauthorized'
        ],
        correctIndex: 0,
        explanation: '400 Bad Request là mã chuẩn cho lỗi validation phía client.'
      },
      {
        id: 's0-q4',
        question: 'Tại sao Refresh Token nên được lưu trong HttpOnly Cookie thay vì localStorage?',
        options: [
          'Vì JavaScript trên trình duyệt không thể đọc được HttpOnly Cookie, bảo vệ phiên đăng nhập khỏi bị đánh cắp khi web bị dính mã độc XSS',
          'Vì Cookie có dung lượng lớn hơn 100MB',
          'Vì Cookie giúp tải trang nhanh hơn',
          'Không có sự khác biệt'
        ],
        correctIndex: 0,
        explanation: 'HttpOnly ngăn JavaScript đọc cookie nên giảm token exfiltration qua XSS; nó không ngăn XSS thực hiện authenticated request và cần kết hợp CSP/CSRF defense phù hợp.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 0: Safe Async Execution Wrapper',
      description: 'Viết hàm `safeAsyncExecutor(asyncFn)`: gọi `await asyncFn()`. Nếu thành công trả về `{ ok: true, data: result }`, nếu ném lỗi thì trả về `{ ok: false, error: err.message }` mà không làm crash app.',
      starterCode: `async function safeAsyncExecutor(asyncFn) {
  // Viết logic bọc async an toàn
  
}`,
      solution: `async function safeAsyncExecutor(asyncFn) {
  try {
    const data = await asyncFn();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || 'ERROR' };
  }
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Thực thi async thành công',
          input: [async () => 'OK_DATA'],
          expected: { ok: true, data: 'OK_DATA' },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Có lỗi -> Bắt an toàn không sập app',
          input: [async () => { throw new Error('DB_DOWN'); }],
          expected: { ok: false, error: 'DB_DOWN' },
          hidden: false
        }
      ]
    }
  },
  {
    sprintId: 1,
    title: 'Bài Kiểm Tra Sprint 1: NestJS Core & Clean Architecture',
    description: 'Đánh giá kiến thức về Bootstrapping, IoC Container, Dependency Injection, Controller routing và DTO Validation Pipe.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's1-q1',
        question: 'Trong NestJS, thứ tự thực thi chính xác của các thành phần khi một HTTP request đi vào là gì?',
        options: [
          'Controller -> Service -> Guard -> Pipe',
          'Middleware -> Guard -> Interceptor (Pre) -> Pipe -> Controller -> Service -> Interceptor (Post) -> Exception Filter',
          'Pipe -> Guard -> Middleware -> Controller -> Service',
          'Service -> Repository -> Controller -> Guard'
        ],
        correctIndex: 1,
        explanation: 'Vòng đời chuẩn của NestJS: Middleware -> Guard -> Interceptor -> Pipe -> Controller/Service -> Filter.'
      },
      {
        id: 's1-q2',
        question: 'Tại sao DTO trong NestJS nên dùng Class thay vì TypeScript Interface?',
        options: [
          'Vì Interface bị xóa bỏ sau khi compile sang JS, còn Class được giữ lại ở runtime giúp class-validator và Swagger hoạt động',
          'Vì Interface tốn nhiều RAM hơn',
          'Vì NestJS cấm dùng Interface',
          'Để code chạy nhanh hơn'
        ],
        correctIndex: 0,
        explanation: 'Class được giữ lại ở runtime JavaScript cho phép reflect-metadata và class-validator thực thi validation.'
      },
      {
        id: 's1-q3',
        question: 'Muốn chia sẻ một Service cho các Module khác trong NestJS, ta bắt buộc phải làm gì?',
        options: [
          'Khai báo service đó vào mảng exports của module sở hữu và import module đó vào nơi cần dùng',
          'Khai báo service đó vào mảng controllers',
          'Tạo biến global',
          'Dùng new Service()'
        ],
        correctIndex: 0,
        explanation: 'Chỉ các provider nằm trong mảng exports mới có thể được các module khác sử dụng.'
      },
      {
        id: 's1-q4',
        question: 'Cờ "whitelist: true" trong ValidationPipe có tác dụng bảo vệ gì?',
        options: [
          'Tự động loại bỏ tất cả các trường dữ liệu mà client gửi lên nếu trường đó không được định nghĩa trong DTO (chống Mass Assignment)',
          'Cho phép mọi người dùng truy cập API không cần mật khẩu',
          'Bật giao diện màu trắng cho Swagger',
          'Tắt kiểm tra dữ liệu'
        ],
        correctIndex: 0,
        explanation: 'Whitelist lọc sạch các trường lạ, ngăn chặn hacker chèn thêm các quyền giả mạo.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 1: Clean DTO Normalizer',
      description: 'Viết hàm `processItemCreation(rawInput)`: trim `code` và `name`. Nếu thiếu `code` hoặc `name` ném `Error("INVALID_PAYLOAD")`. Trả về `{ code: code.toUpperCase(), name, price: rawInput.price || 0, isActive: rawInput.isActive ?? true }`.',
      starterCode: `function processItemCreation(rawInput) {
  // Viết logic chuẩn hóa
  
}`,
      solution: `function processItemCreation(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') throw new Error("INVALID_PAYLOAD");
  const code = (rawInput.code || '').trim();
  const name = (rawInput.name || '').trim();
  if (!code || !name) throw new Error("INVALID_PAYLOAD");
  return {
    code: code.toUpperCase(),
    name: name,
    price: typeof rawInput.price === 'number' ? rawInput.price : 0,
    isActive: typeof rawInput.isActive === 'boolean' ? rawInput.isActive : true
  };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Chuẩn hóa thành công',
          input: [{ code: '  vtth-01 ', name: ' Bông gòn ', price: 15000 }],
          expected: { code: 'VTTH-01', name: 'Bông gòn', price: 15000, isActive: true },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Thiếu code -> Báo lỗi',
          input: [{ name: 'Bông gòn' }],
          expected: 'ERROR_THROWN',
          hidden: false
        }
      ]
    }
  },
  {
    sprintId: 2,
    title: 'Bài Kiểm Tra Sprint 2: PostgreSQL & Prisma 7',
    description: 'Đánh giá kiến thức về Database Schema, Quan hệ 1-N, Transaction ACID, Concurrency Locking và Multi-Tenancy.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's2-q1',
        question: 'Nguyên tắc vàng nào bắt buộc phải tuân theo khi viết mọi hàm query trong tầng Service của eSmiles?',
        options: [
          'Luôn luôn ép điều kiện where: { unitId } để cô lập dữ liệu phòng khám (Tenant Isolation)',
          'Luôn luôn trả về kiểu any',
          'Dùng console.log()',
          'Không bao giờ dùng async/await'
        ],
        correctIndex: 0,
        explanation: 'Multi-tenancy bắt buộc mọi truy vấn phải có unitId để đảm bảo dữ liệu của các phòng khám không bị rò rỉ lẫn nhau.'
      },
      {
        id: 's2-q2',
        question: 'Khi thực hiện xóa một Danh mục đang có Sản phẩm liên kết với khóa ngoại onDelete: Restrict, lỗi DB sẽ được map thành mã HTTP nào?',
        options: [
          '409 Conflict',
          '200 OK',
          '500 Internal Server Error',
          '401 Unauthorized'
        ],
        correctIndex: 0,
        explanation: 'Khóa ngoại Restrict ngăn chặn xóa cha khi còn con và được map thành 409 Conflict.'
      },
      {
        id: 's2-q3',
        question: 'Trong Prisma, khi chỉ cần lấy một số cột cần thiết từ bảng quan hệ, ta dùng tùy chọn nào để tối ưu băng thông?',
        options: [
          'select',
          'include',
          'where',
          'orderBy'
        ],
        correctIndex: 0,
        explanation: 'select cho phép chỉ định chính xác các cột cần lấy từ DB, giảm dung lượng truyền tải.'
      },
      {
        id: 's2-q4',
        question: 'Tính chất Atomicity (Nguyên tử) trong Transaction Database đảm bảo điều gì?',
        options: [
          'Tất cả các câu lệnh trong transaction cùng thành công, hoặc nếu 1 câu lỗi thì toàn bộ tự động Rollback về như cũ',
          'Dữ liệu tự động nhân đôi',
          'Database không bao giờ bị tắt',
          'Tăng tốc độ mạng'
        ],
        correctIndex: 0,
        explanation: 'Atomicity đảm bảo tính toàn vẹn tuyệt đối: Tất cả cùng thành công hoặc không có gì thay đổi.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 2: Safe Tenant Updater',
      description: 'Viết hàm `safeUpdateItem(dbMock, unitId, itemId, updateData)`: 1. Tìm item với `where: { id: itemId, unitId }`. 2. Nếu không tìm thấy, ném `Error("NOT_FOUND")`. 3. Nếu tìm thấy, gọi `dbMock.update({ where: { id: itemId }, data: updateData })` và trả về kết quả.',
      starterCode: `async function safeUpdateItem(dbMock, unitId, itemId, updateData) {
  // Viết logic cập nhật an toàn
  
}`,
      solution: `async function safeUpdateItem(dbMock, unitId, itemId, updateData) {
  const existing = await dbMock.findFirst({
    where: { id: itemId, unitId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  return dbMock.update({
    where: { id: itemId },
    data: updateData
  });
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Cập nhật thành công',
          input: [
            {
              findFirst: async () => ({ id: 'i1', unitId: 'u1' }),
              update: async (args: any) => ({ id: args.where.id, ...args.data })
            },
            'u1',
            'i1',
            { name: 'Kim tiêm 5ml' }
          ],
          expected: { id: 'i1', name: 'Kim tiêm 5ml' },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Sai unitId -> Ném lỗi NOT_FOUND',
          input: [
            { findFirst: async () => null },
            'u-hacker',
            'i1',
            { name: 'Kim tiêm 5ml' }
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        }
      ]
    }
  },
  {
    sprintId: 3,
    title: 'Bài Kiểm Tra Sprint 3: Xử Lý Lỗi, Bảo Mật & Xác Thực',
    description: 'Đánh giá kiến thức về AllExceptionsFilter, JWT Bearer/Cookie, CASL Permission Guard và Multi-surface Architecture.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's3-q1',
        question: 'Cấu trúc chuẩn của một mã quyền (Permission) trong hệ thống eSmiles gồm 3 phần là gì?',
        options: [
          'module:resource:action',
          'ROLE:ADMIN:USER',
          'GET:POST:DELETE',
          'URL:CONTROLLER:METHOD'
        ],
        correctIndex: 0,
        explanation: 'eSmiles áp dụng định dạng chuẩn module:resource:action (vd: inventory:category:create).'
      },
      {
        id: 's3-q2',
        question: 'Endpoint nào sau đây thuộc về bề mặt dành riêng cho Quản trị viên nền tảng (Platform Admin)?',
        options: [
          '/api/i/admin/v1/tenants',
          '/api/p/v1/profile',
          '/api/i/v1/appointments',
          '/api/v1/health'
        ],
        correctIndex: 0,
        explanation: '/api/i/admin/v1 là prefix dành cho Platform Admin.'
      },
      {
        id: 's3-q3',
        question: 'Khi Bác sĩ đăng nhập thành công nhưng truy cập vào tính năng không có quyền, Server trả về mã HTTP nào?',
        options: [
          '403 Forbidden',
          '401 Unauthorized',
          '404 Not Found',
          '500 Internal Error'
        ],
        correctIndex: 0,
        explanation: '403 Forbidden là mã chuẩn khi tài khoản đã xác thực nhưng bị từ chối quyền truy cập.'
      },
      {
        id: 's3-q4',
        question: 'Lỗi Prisma P2002 (Unique constraint violation) được Filter toàn cục map thành mã HTTP nào?',
        options: [
          '409 Conflict',
          '200 OK',
          '500 Internal Error',
          '400 Bad Request'
        ],
        correctIndex: 0,
        explanation: 'Trùng mã khóa duy nhất được map thành 409 Conflict.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 3: Multi-Role Authorization Filter',
      description: 'Viết hàm `authorizeUserAction(user, requiredModule, requiredAction)`: nếu `user.isSuperAdmin` hoặc `user.permissions` có `<requiredModule>:<requiredAction>` hoặc `<requiredModule>:*` hoặc `*` thì trả về `{ allowed: true }`, ngược lại trả về `{ allowed: false, reason: "FORBIDDEN" }`.',
      starterCode: `function authorizeUserAction(user, requiredModule, requiredAction) {
  // Viết logic phân quyền
  
}`,
      solution: `function authorizeUserAction(user, requiredModule, requiredAction) {
  if (user?.isSuperAdmin) return { allowed: true };
  const perms = user?.permissions || [];
  const exact = requiredModule + ':' + requiredAction;
  const modWild = (requiredModule.split(':')[0] || '') + ':*';
  if (perms.includes('*') || perms.includes(modWild) || perms.includes(exact) || perms.includes(requiredModule + ':*')) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'FORBIDDEN' };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Quyền chính xác',
          input: [{ permissions: ['inventory:item:create'] }, 'inventory:item', 'create'],
          expected: { allowed: true },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Quyền wildcard module',
          input: [{ permissions: ['inventory:*'] }, 'inventory:item', 'delete'],
          expected: { allowed: true },
          hidden: false
        }
      ]
    }
  },
  {
    sprintId: 4,
    title: 'Bài Kiểm Tra Sprint 4: Queue, Redis, Presigned S3 & Realtime',
    description: 'Đánh giá kiến thức về Redis Caching, BullMQ Queue, MinIO Presigned URLs và WebSocket Rooms.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's4-q1',
        question: 'Tại sao việc upload file X-Quang 500MB nên dùng Presigned URL bắn trực tiếp lên MinIO/S3 thay vì gửi qua NestJS Server?',
        options: [
          'Để giải phóng hoàn toàn băng thông và RAM của máy chủ Backend NestJS, tránh nghẽn luồng xử lý của các bác sĩ khác',
          'Vì MinIO bắt buộc',
          'Để làm ảnh nét hơn',
          'Không có lý do'
        ],
        correctIndex: 0,
        explanation: 'Presigned URL đẩy tải truyền dữ liệu nặng sang Object Storage chuyên dụng.'
      },
      {
        id: 's4-q2',
        question: 'Ưu điểm lớn nhất của việc sử dụng Message Queue (BullMQ) cho tác vụ gửi SMS là gì?',
        options: [
          'API phản hồi ngay lập tức cho người dùng trong 5ms và tự động retry nếu dịch vụ SMS bên thứ ba bị mất mạng',
          'Để thay thế database',
          'Làm ngắn code',
          'Không có tác dụng'
        ],
        correctIndex: 0,
        explanation: 'Queue tách biệt luồng xử lý nặng ra khỏi luồng HTTP chính.'
      },
      {
        id: 's4-q3',
        question: 'Cơ chế Cache Invalidation trong Redis cần được thực hiện khi nào?',
        options: [
          'Ngay khi dữ liệu tương ứng trong Database bị thay đổi (Create/Update/Delete)',
          'Khởi động lại server',
          'Mỗi ngày 1 lần',
          'Không cần xóa'
        ],
        correctIndex: 0,
        explanation: 'Xóa cache khi dữ liệu thay đổi đảm bảo tính nhất quán giữa Redis và Database.'
      },
      {
        id: 's4-q4',
        question: 'WebSocket Rooms phân chia theo "unit:{unitId}" nhằm mục đích gì?',
        options: [
          'Đảm bảo thông báo chỉ phát cho các bác sĩ trong đúng phòng khám đó, tránh lộ dữ liệu sang phòng khám khác',
          'Tăng độ phân giải màn hình',
          'Làm ngắn code',
          'Không có tác dụng'
        ],
        correctIndex: 0,
        explanation: 'Rooms phân vùng sự kiện theo từng Tenant phòng khám.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 4: Job Retry Calculator',
      description: 'Viết hàm `calculateBackoffDelay(attempt, baseDelay, maxDelay)` tính: `delay = baseDelay * (2 ** (attempt - 1))`. Nếu `delay > maxDelay` thì lấy `maxDelay`.',
      starterCode: `function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  // Tính delay
  
}`,
      solution: `function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  const calculated = baseDelay * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(calculated, maxDelay);
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Lần 1: 1000ms',
          input: [1, 1000, 10000],
          expected: 1000,
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Lần 3: 4000ms',
          input: [3, 1000, 10000],
          expected: 4000,
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Chạm ngưỡng maxDelay',
          input: [10, 1000, 10000],
          expected: 10000,
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 5,
    title: 'Bài Kiểm Tra Sprint 5: Testing, Audit Log & Production Gate',
    description: 'Đánh giá kiến thức về Audit Logging, Kiểm thử API sống với Bruno, Unit Test Jest và E2E Testing.',
    timeLimitMinutes: 20,
    passingScore: 80,
    questions: [
      {
        id: 's5-q1',
        question: 'Công cụ nào trong dự án eSmiles được dùng để lưu trữ và chạy thử nghiệm trực tiếp các API request được track trong Git?',
        options: [
          'Bruno (.bru)',
          'Postman Cloud',
          'Swagger UI chỉ để xem',
          'Excel'
        ],
        correctIndex: 0,
        explanation: 'eSmiles sử dụng Bruno (.bru) lưu trực tiếp trong thư mục bruno/ của repo Git.'
      },
      {
        id: 's5-q2',
        question: 'Lệnh nào dùng để kiểm tra tự động xem có Controller endpoint nào bị thiếu file .bru trước khi tạo Pull Request?',
        options: [
          'pnpm bruno:check',
          'pnpm test',
          'pnpm build',
          'pnpm lint'
        ],
        correctIndex: 0,
        explanation: 'pnpm bruno:check đối chiếu toàn bộ router với collection Bruno và báo lỗi nếu có endpoint thiếu tài liệu test.'
      },
      {
        id: 's5-q3',
        question: 'Bảng Audit Log trong cơ sở dữ liệu có được phép UPDATE hoặc DELETE không?',
        options: [
          'Tuyệt đối CẤM: Bảng Audit Log là Append-Only (chỉ cho phép INSERT) để đảm bảo tính pháp lý và chống chối bỏ trách nhiệm',
          'Cho phép sửa thoải mái',
          'Tự động xóa sau 1 ngày',
          'Admin được xóa'
        ],
        correctIndex: 0,
        explanation: 'Tính bất biến của Audit Log là nguyên tắc pháp lý cốt lõi trong y tế và tài chính.'
      },
      {
        id: 's5-q4',
        question: 'Khi viết Unit Test cho Service, tại sao nên Mock PrismaService thay vì kết nối Database thật?',
        options: [
          'Để test chạy độc lập, siêu nhanh trong vài ms và không làm thay đổi dữ liệu thật khi chạy trên CI/CD',
          'Vì Jest không có internet',
          'Vì database bị khóa',
          'Không có lý do'
        ],
        correctIndex: 0,
        explanation: 'Mocking giúp unit test chạy nhanh, cô lập và ổn định ở mọi môi trường.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 5: Comprehensive Audit Dispatcher',
      description: 'Viết hàm `dispatchAuditEvent(logServiceMock, event)`: gọi `await logServiceMock.log({ ...event, timestamp: Date.now() })`. Trả về `{ success: true, loggedEvent: event }`.',
      starterCode: `async function dispatchAuditEvent(logServiceMock, event) {
  // Viết logic dispatch audit
  
}`,
      solution: `async function dispatchAuditEvent(logServiceMock, event) {
  await logServiceMock.log({ ...event, timestamp: Date.now() });
  return { success: true, loggedEvent: event };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Ghi audit thành công',
          input: [
            { log: async () => ({ success: true }) },
            { action: 'UPDATE', userId: 'u1', unitId: 'unit-10' }
          ],
          expected: { success: true, loggedEvent: { action: 'UPDATE', userId: 'u1', unitId: 'unit-10' } },
          hidden: false
        }
      ]
    }
  }
];
