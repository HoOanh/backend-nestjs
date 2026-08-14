import type { QuizQuestion, CodeChallenge } from './curriculum';

export interface FinalExam {
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questions: QuizQuestion[];
  codeChallenges: CodeChallenge[];
}

export const FINAL_EXAM: FinalExam = {
  title: 'Khảo Thí Tốt Nghiệp: eSmiles Backend Foundations',
  description: 'Bài khảo thí tình huống từ Sprint 0 đến Sprint 5. Chứng chỉ xác nhận hoàn thành curriculum; không thay thế code review hoặc đánh giá production.',
  timeLimitMinutes: 60,
  passingScore: 75,
  questions: [
    {
      id: 'final-q1',
      question: 'Một Singleton service gán `this.activeUnitId = req.user.unitId`, sau đó await Prisma rồi query theo giá trị đó. Rủi ro thực tế là gì?',
      options: [
        'Không có rủi ro vì Node.js chỉ chạy một main thread',
        'Request khác có thể ghi đè giá trị trong lúc request đầu await, làm query chạy dưới tenant sai',
        'Prisma tự cô lập biến instance cho mỗi request',
        'Chỉ làm response chậm hơn'
      ],
      correctIndex: 1,
      explanation: 'Single-thread không có nghĩa request chạy tuần tự qua await. Singleton instance được chia sẻ; scope phải đi qua argument/context an toàn.'
    },
    {
      id: 'final-q2',
      question: 'Một category chỉ thuộc trực tiếp một Unit. Mutation nào không làm lộ việc ID tồn tại ở tenant khác và giữ tenant scope?',
      options: [
        'findUnique({ where: { id } }) rồi update({ where: { id } })',
        'updateMany({ where: { id, unitId }, data }) rồi trả 404 chung nếu count === 0',
        'update({ where: { id } }) rồi kiểm tra unitId ở response',
        'Tin X-Unit-Id do frontend tự gửi mà không lấy active scope từ auth'
      ],
      correctIndex: 1,
      explanation: 'Scope phải bắt nguồn từ auth context và xuất hiện trong mutation. count === 0 có thể trả một lỗi không phân biệt absent/foreign record.'
    },
    {
      id: 'final-q3',
      question: 'Presigned upload URL đã được cấp. Bước nào vẫn cần thiết trước khi file có thể dùng trong bệnh án?',
      options: [
        'Không cần làm gì vì MIME type do client gửi là đáng tin',
        'Backend verify object/size/checksum hoặc content, áp quota và tenant key; scan/quarantine khi chính sách yêu cầu rồi mới publish metadata',
        'Lưu URL vĩnh viễn vào database để tải lại',
        'Upload lại file qua NestJS để chắc chắn'
      ],
      correctIndex: 1,
      explanation: 'Presign chỉ ủy quyền upload giới hạn. Nó không chứng minh object an toàn hay đúng metadata.'
    },
    {
      id: 'final-q4',
      question: 'Để xuất kho an toàn trước hai request đồng thời, query nào thể hiện đúng invariant?',
      options: [
        'Đọc quantity, rồi ở application code kiểm tra và update ở hai request riêng',
        'Cập nhật quantity decrement không điều kiện, rồi nếu âm thì sửa lại',
        'Conditional update với where: { unitId, warehouseId, itemId, quantity: { gte: qty } }, rồi yêu cầu count === 1 trong transaction',
        'Dùng biến currentStock trong singleton service'
      ],
      correctIndex: 2,
      explanation: 'Điều kiện đủ tồn và decrement phải do database thực hiện nguyên tử; transaction bao trùm các mutation còn lại.'
    },
    {
      id: 'final-q5',
      question: 'Với BullMQ, kết luận nào đúng khi xử lý PDF nặng?',
      options: [
        'Đẩy job vào queue luôn loại bỏ event-loop blocking, dù worker chung process',
        'Queue chỉ tách khỏi HTTP khi consumer chạy process/pod khác; CPU-heavy JavaScript cần worker thread/process phù hợp',
        'BullMQ thay thế transaction database',
        'Retry mọi lỗi vô hạn để job chắc chắn thành công'
      ],
      correctIndex: 1,
      explanation: 'Queue là cơ chế điều phối/durability. Isolation CPU phải đến từ nơi worker chạy và thiết kế retry/idempotency.'
    },
    {
      id: 'final-q6',
      question: 'Trong NestJS, Middleware khác với Interceptor ở điểm nào?',
      options: [
        'Middleware chạy sau Interceptor',
        'Middleware không thể thay đổi Request/Response object, chỉ Interceptor mới làm được',
        'Middleware chạy trước Guard và không có context thực thi (ExecutionContext), Interceptor chạy sau Guard và có quyền truy cập context',
        'Middleware chỉ dùng cho GraphQL, Interceptor dùng cho REST'
      ],
      correctIndex: 2,
      explanation: 'Middleware ở mức Express/Fastify thô, chạy trước Guard. Interceptor tích hợp sâu vào NestJS context và chạy sau Guard.'
    },
    {
      id: 'final-q7',
      question: 'Để đảm bảo idempotency (tính lũy đẳng) khi tạo một hóa đơn, cách làm nào là chuẩn xác nhất?',
      options: [
        'Client gửi kèm một Idempotency-Key trong header, backend dùng khóa này để kiểm tra (hoặc lưu Redis/DB) xem request đã xử lý chưa trước khi tạo',
        'Kiểm tra xem user đã tạo hóa đơn nào trong 5 giây qua chưa',
        'Tạo một middleware sleep 1s',
        'Không cần làm gì, Database sẽ tự xử lý'
      ],
      correctIndex: 0,
      explanation: 'Idempotency Key là chuẩn công nghiệp để tránh duplicate request khi mạng chập chờn.'
    },
    {
      id: 'final-q8',
      question: 'Tại sao việc dùng `SELECT * FROM users` hoặc Prisma `findMany()` mà không có select lại nguy hiểm?',
      options: [
        'Gây lỗi cú pháp SQL',
        'Dễ vô tình trả về các trường nhạy cảm như mật khẩu đã hash, token, PII nếu không dùng class-transformer để lọc',
        'Làm database bị sập',
        'Prisma tự động ẩn mật khẩu nên không sao'
      ],
      correctIndex: 1,
      explanation: 'Nếu không explicit select hoặc dùng interceptor lọc, các trường nhạy cảm sẽ bị leak ra client.'
    },
    {
      id: 'final-q9',
      question: 'Khi sử dụng thư viện Argon2 để hash mật khẩu, điều gì làm nó an toàn hơn Bcrypt?',
      options: [
        'Nó dùng ít RAM hơn Bcrypt',
        'Nó tạo ra chuỗi hash ngắn hơn',
        'Nó chống lại các cuộc tấn công bằng GPU/ASIC nhờ chi phí bộ nhớ (memory-hard) có thể cấu hình được',
        'Nó mã hóa hai chiều'
      ],
      correctIndex: 2,
      explanation: 'Argon2 là chuẩn memory-hard, khiến việc dùng phần cứng chuyên dụng để brute-force trở nên đắt đỏ và không khả thi.'
    },
    {
      id: 'final-q10',
      question: 'Khi chạy Unit Test cho một controller trong NestJS có sử dụng JWT AuthGuard, cách tiếp cận tốt nhất là gì?',
      options: [
        'Mock (giả lập) AuthGuard để luôn return true thay vì phải tạo JWT token thực sự cho mỗi test case',
        'Bỏ qua Unit test, chỉ viết E2E test',
        'Kết nối với database thật để tạo user rồi lấy token',
        'Tắt AuthGuard trong file mã nguồn trước khi chạy test'
      ],
      correctIndex: 0,
      explanation: 'Unit test nên cô lập controller khỏi các guard. Ta dùng `.overrideGuard(AuthGuard).useValue({ canActivate: () => true })`.'
    },
    {
      id: 'final-q11',
      question: 'Để xử lý bài toán N+1 query trong Prisma, tính năng nào thường được dùng?',
      options: [
        'Tự viết câu lệnh JOIN bằng $queryRaw',
        'Dùng từ khóa include để Prisma tự gộp các truy vấn con thành một/một vài truy vấn tối ưu',
        'Dùng vòng lặp for...of rồi gọi Prisma findUnique',
        'Không thể xử lý N+1 trong Prisma'
      ],
      correctIndex: 1,
      explanation: 'Prisma dùng cơ chế dataloader ngầm hoặc JOIN khi dùng include để tự động giải quyết N+1 query problem.'
    },
    {
      id: 'final-q12',
      question: 'Trường hợp nào sau đây vi phạm nguyên tắc thiết kế RESTful API?',
      options: [
        'GET /api/v1/patients/123/records',
        'POST /api/v1/patients/123/records',
        'POST /api/v1/patients/123/delete-record',
        'DELETE /api/v1/patients/123/records/456'
      ],
      correctIndex: 2,
      explanation: 'REST sử dụng HTTP methods (DELETE) thay vì động từ trong URL (delete-record).'
    },
    {
      id: 'final-q13',
      question: 'Khi triển khai (deploy) ứng dụng NestJS trên môi trường Production, biến môi trường NODE_ENV nên đặt là gì và tại sao?',
      options: [
        'NODE_ENV=development để log chi tiết lỗi',
        'NODE_ENV=production để bật các tối ưu hóa nội bộ của Node.js, Express và tắt các debug log không cần thiết',
        'NODE_ENV=test',
        'Không cần đặt'
      ],
      correctIndex: 1,
      explanation: 'NODE_ENV=production là cờ chuẩn giúp cải thiện hiệu năng đáng kể (tối ưu cache, bỏ qua warning).'
    },
    {
      id: 'final-q14',
      question: 'Hành vi mặc định của TypeORM hoặc Prisma khi lưu Date vào cơ sở dữ liệu PostgreSQL là gì?',
      options: [
        'Lưu theo múi giờ địa phương của server chạy Node.js',
        'Lưu chuẩn UTC, sau đó client tự chuyển sang múi giờ tương ứng khi hiển thị',
        'Lưu thành chuỗi kiểu dd/MM/yyyy',
        'Bỏ qua phần thời gian (giờ/phút)'
      ],
      correctIndex: 1,
      explanation: 'PostgreSQL timestamp (tz) và Prisma mặc định chuẩn hóa về UTC để tránh sai lệch múi giờ.'
    },
    {
      id: 'final-q15',
      question: 'CORS (Cross-Origin Resource Sharing) bảo vệ ai?',
      options: [
        'Bảo vệ Server khỏi hacker',
        'Bảo vệ Database khỏi bị quá tải',
        'Bảo vệ người dùng khỏi việc các trang web độc hại tự ý gọi API (bằng trình duyệt của người dùng) tới các domain khác',
        'Bảo vệ băng thông mạng'
      ],
      correctIndex: 2,
      explanation: 'CORS là cơ chế bảo mật của trình duyệt để ngăn một origin (domain) thực hiện requests trái phép tới origin khác.'
    },
    {
      id: 'final-q16',
      question: 'Trong kiến trúc Multi-Tenant bằng phương pháp Row-Level Separation (như eSmiles), dữ liệu của tất cả tenant nằm chung một Database. Rủi ro lớn nhất nếu thiếu cẩn trọng là gì?',
      options: [
        'Tốc độ truy vấn bị chậm đi một nửa',
        'Lỗi Cross-Tenant Data Leakage: dev quên thêm điều kiện unitId vào câu truy vấn khiến phòng khám A đọc/sửa được dữ liệu của phòng khám B',
        'Không thể backup dữ liệu',
        'Tràn bộ nhớ RAM của Server'
      ],
      correctIndex: 1,
      explanation: 'Quên lọc theo tenant ID là lỗi bảo mật nghiêm trọng nhất trong thiết kế Row-Level Separation.'
    },
    {
      id: 'final-q17',
      question: 'Tại sao việc validation dữ liệu đầu vào (DTO) phải được thực hiện NGAY LẬP TỨC ở Controller (thông qua Pipe) thay vì ở Service?',
      options: [
        'Để fail-fast: chặn đứng các payload độc hại, sai định dạng trước khi chúng tiến sâu vào business logic gây hao tốn tài nguyên hoặc lỗi ẩn',
        'Vì Service không thể dùng class-validator',
        'Vì viết ở Controller code sẽ đẹp hơn',
        'Để báo lỗi cho frontend nhanh hơn 1ms'
      ],
      correctIndex: 0,
      explanation: 'Validation Pipe hoạt động như một lớp giáp vòng ngoài, bảo vệ lõi logic khỏi dữ liệu bẩn.'
    },
    {
      id: 'final-q18',
      question: 'Khi sử dụng Redis để caching kết quả API, ta phải chú ý điều gì để tránh vấn đề "Stale Data" (dữ liệu cũ)?',
      options: [
        'Tắt tính năng caching',
        'Thiết lập TTL (Time-To-Live) phù hợp và chủ động xóa cache (Invalidation) ngay khi dữ liệu gốc trong Database bị thay đổi',
        'Khởi động lại Redis mỗi giờ',
        'Lưu cache vĩnh viễn'
      ],
      correctIndex: 1,
      explanation: 'Cache Invalidation là bài toán khó nhất trong Caching, cần chiến lược TTL và xóa chủ động (event-driven).'
    },
    {
      id: 'final-q19',
      question: 'Khi một API endpoint xử lý việc upload và phân tích file báo cáo tài chính rất nặng (mất 2 phút), thiết kế nào là phù hợp nhất?',
      options: [
        'Tăng timeout của HTTP request lên 3 phút và để client chờ',
        'Chấp nhận file, lưu vào Storage, ném thông tin vào Message Queue (RabbitMQ/BullMQ), trả về 202 Accepted ngay lập tức. Cung cấp API khác để client poll trạng thái',
        'Chia file thành 100 phần và gọi API 100 lần',
        'Trả về lỗi 413 Payload Too Large'
      ],
      correctIndex: 1,
      explanation: 'Mô hình Asynchronous Processing (Fire-and-Forget) kết hợp Queue và Polling/Webhook là chuẩn mực cho tác vụ dài.'
    },
    {
      id: 'final-q20',
      question: 'Trong NestJS, "Dependency Injection" mang lại lợi ích thực tế gì nhất cho việc viết Unit Test?',
      options: [
        'Làm code chạy nhanh hơn',
        'Giúp tự động tạo bảng trong DB',
        'Cho phép ta dễ dàng tiêm (inject) các phiên bản giả mạo (Mocks/Stubs) của Service/Repository vào Controller để test độc lập mà không cần DB thật',
        'Ngăn chặn lỗi cú pháp TypeScript'
      ],
      correctIndex: 2,
      explanation: 'Inversion of Control qua DI giúp thay thế các dependencies thực bằng các mock objects một cách tự nhiên trong quá trình test.'
    }
  ],
  codeChallenges: [
    {
      title: 'Capstone 1: Atomic Stock Transfer với Tenant Scope',
      description: 'Viết `executeStockTransfer(prismaMock, unitId, payload)`: validate `unitId`, `itemId`, quantity là số nguyên dương và hai kho khác nhau. Trong transaction: dùng `updateMany` conditional debit theo `unitId` và `quantity: { gte: quantity }`; nếu `count !== 1` ném `INSUFFICIENT_STOCK`; cộng kho đích và ghi audit bằng `tx.auditLog.create`. Trả `{ success: true, transferId: payload.idempotencyKey }`.',
      starterCode: `async function executeStockTransfer(prismaMock, unitId, payload) {
  // Viết logic capstone
  
}`,
      solution: `async function executeStockTransfer(prismaMock, unitId, payload) {
  if (!unitId || !payload?.itemId || !payload?.idempotencyKey) {
    throw new Error("INVALID_PAYLOAD");
  }
  if (!Number.isSafeInteger(payload.quantity) || payload.quantity <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
  if (!payload.fromWarehouseId || !payload.toWarehouseId || payload.fromWarehouseId === payload.toWarehouseId) {
    throw new Error("SAME_WAREHOUSE");
  }
  return prismaMock.$transaction(async (tx) => {
    const debited = await tx.stock.updateMany({
      where: { warehouseId: payload.fromWarehouseId, itemId: payload.itemId, unitId, quantity: { gte: payload.quantity } },
      data: { quantity: { decrement: payload.quantity } }
    });
    if (debited.count !== 1) throw new Error("INSUFFICIENT_STOCK");
    await tx.stock.upsert({
      where: { warehouseId_itemId_unitId: { warehouseId: payload.toWarehouseId, itemId: payload.itemId, unitId } },
      create: { warehouseId: payload.toWarehouseId, itemId: payload.itemId, unitId, quantity: payload.quantity },
      update: { quantity: { increment: payload.quantity } }
    });
    await tx.auditLog.create({
      data: { action: 'STOCK_TRANSFER', unitId, entityId: payload.itemId, idempotencyKey: payload.idempotencyKey }
    });
    return { success: true, transferId: payload.idempotencyKey };
  });
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Chuyển kho thành công',
          input: [
            {
              $transaction: async (fn: any) => {
                const tx = {
                  stock: {
                    updateMany: async () => ({ count: 1 }),
                    upsert: async () => true
                  },
                  auditLog: { create: async () => true }
                };
                return fn(tx);
              }
            },
            'unit-10',
            { fromWarehouseId: 'w1', toWarehouseId: 'w2', itemId: 'i1', quantity: 5, idempotencyKey: 'tx-123' }
          ],
          expected: { success: true, transferId: 'tx-123' },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Trùng kho nguồn và đích -> Ném lỗi',
          input: [
            {},
            'unit-10',
            { fromWarehouseId: 'w1', toWarehouseId: 'w1', itemId: 'i1', quantity: 5, idempotencyKey: 'tx-124' }
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Transaction ném lỗi rollback',
          input: [
            {
              $transaction: async (fn: any) => {
                return fn({ stock: { updateMany: async () => ({ count: 0 }), upsert: async () => true }, auditLog: { create: async () => true } });
              }
            },
            'unit-10',
            { fromWarehouseId: 'w1', toWarehouseId: 'w2', itemId: 'i1', quantity: 500, idempotencyKey: 'tx-125' }
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    },
    {
      title: 'Capstone 2: Implement Request Handler với Validation và Error Handling',
      description: 'Viết `handleCreatePatient(req, res, next)`: Lấy `name` và `age` từ `req.body`. Nếu `name` trống hoặc `age < 0`, gọi `res.status(400).json({ error: "BAD_INPUT" })`. Nếu thành công, trả về `res.status(201).json({ success: true })`. Cần bắt lỗi bằng khối `try/catch` và gọi `next(error)` nếu có exception bất ngờ.',
      starterCode: `async function handleCreatePatient(req, res, next) {
  // Viết logic handler
  
}`,
      solution: `async function handleCreatePatient(req, res, next) {
  try {
    const { name, age } = req.body;
    if (!name || typeof age !== 'number' || age < 0) {
      return res.status(400).json({ error: 'BAD_INPUT' });
    }
    return res.status(201).json({ success: true });
  } catch (err) {
    return next(err);
  }
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Valid input',
          input: [
            { body: { name: 'Nguyen Van A', age: 25 } },
            { status: (code: number) => ({ json: (data: any) => ({ statusCode: code, data }) }) },
            (err: any) => err
          ],
          expected: { statusCode: 201, data: { success: true } },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Invalid age',
          input: [
            { body: { name: 'Nguyen Van A', age: -5 } },
            { status: (code: number) => ({ json: (data: any) => ({ statusCode: code, data }) }) },
            (err: any) => err
          ],
          expected: { statusCode: 400, data: { error: 'BAD_INPUT' } },
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Exception caught and sent to next()',
          input: [
            { get body() { throw new Error('DB_DOWN'); } },
            { status: () => ({ json: () => {} }) },
            (err: any) => err.message
          ],
          expected: 'DB_DOWN',
          hidden: true
        }
      ]
    },
    {
      title: 'Capstone 3: Thiết Kế Background Job Với Retry Logic',
      description: 'Viết `processJobWithRetry(job, processFn, maxRetries)`: Thực thi `processFn(job)`. Nếu gặp lỗi, tăng bộ đếm `job.attempts`. Thử lại tối đa `maxRetries` lần. Nếu vượt quá, ném lỗi cuối cùng nhận được. Trả về kết quả nếu thành công.',
      starterCode: `async function processJobWithRetry(job, processFn, maxRetries) {
  // Viết logic retry
  
}`,
      solution: `async function processJobWithRetry(job, processFn, maxRetries) {
  job.attempts = job.attempts || 0;
  while (job.attempts <= maxRetries) {
    try {
      return await processFn(job);
    } catch (err) {
      job.attempts++;
      if (job.attempts > maxRetries) {
        throw err;
      }
    }
  }
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Success on first try',
          input: [
            { attempts: 0 },
            async (j: any) => 'DONE',
            3
          ],
          expected: 'DONE',
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Success on retry',
          input: [
            { attempts: 0 },
            (function() { let count = 0; return async (j: any) => { if(count++ < 2) throw new Error('FAIL'); return 'DONE'; } })(),
            3
          ],
          expected: 'DONE',
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Exceeds max retries',
          input: [
            { attempts: 0 },
            async (j: any) => { throw new Error('FATAL'); },
            2
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
