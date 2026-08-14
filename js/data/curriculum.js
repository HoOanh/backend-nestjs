/**
 * eSmiles Backend Academy - Master Curriculum (22 Comprehensive Lessons across 6 Sprints)
 * Specifically crafted for Frontend (React/Next.js) developers transitioning to Backend NestJS
 */

window.CURRICULUM = [
  {
    sprintId: 0,
    sprintTitle: 'Sprint 0: Cầu Nối React/Next.js → Backend Mental Model',
    sprintDesc: 'Nền tảng chuyển đổi tư duy: Từ môi trường Browser Client/Serverless sang Long-running Process, Concurrency, Event Loop & HTTP',
    lessons: [
      {
        id: 'lesson-1',
        title: 'Bài 01: Từ React/Next.js sang Backend: Chuyển Đổi Tư Duy Cốt Lõi',
        duration: '30 phút',
        tag: 'Mental Model',
        theory: `
### 1. Sự khác biệt lớn nhất giữa Frontend và Backend
Khi viết React trong trình duyệt hoặc Server Actions trong Next.js:
- **Frontend / Next.js SSR:** Mã nguồn chạy trong môi trường của **một người dùng duy nhất** (Client-side) hoặc khởi tạo một hàm Serverless chạy vài mili-giây rồi tắt (Stateless per-request).
- **Backend NestJS:** Là một **tiến trình Node.js sống liên tục (Long-running Process)** trên máy chủ. Máy chủ này phục vụ đồng thời hàng nghìn bác sĩ, lễ tân và bệnh nhân cùng lúc!

### 2. Cảnh báo rủi ro "Global State" trên Backend:
Trong React, đại ca thoải mái dùng biến toàn cục hoặc Zustand store vì nó chỉ nằm trong RAM của 1 máy khách.
Nhưng trên Backend NestJS, **một biến Singleton Service được chia sẻ cho TOÀN BỘ NGƯỜI DÙNG**.
> **Tuyệt đối KHÔNG BAO GIỜ** lưu thông tin cá nhân của một user (\`this.currentUser = ...\`) vào biến thuộc tính của Service! Làm như vậy sẽ khiến User B nhìn thấy dữ liệu của User A!

### 3. Vòng đời Request trong eSmiles:
Mọi request gửi từ React (ví dụ: \`useQuery(['categories'], () => fetch('/api/i/v1/inventory/categories'))\`) sẽ đi qua:
\`Middleware (Helmet/CORS/Pino)\` $\\rightarrow$ \`Guards (Auth/Permission)\` $\\rightarrow$ \`Interceptors\` $\\rightarrow$ \`Pipes (Validate DTO)\` $\\rightarrow$ \`Controller & Service\` $\\rightarrow$ \`Prisma (PostgreSQL)\`.
        `,
        realCodeSnippet: `// Trích từ src/main.ts - Tiến trình Backend khởi chạy và duy trì kết nối
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks(); // Giữ kết nối và đóng graceful khi server tắt
  await app.listen(3000);
}`,
        quiz: [
          {
            id: 'q1-1',
            question: 'Tại sao việc lưu trữ `this.currentUserId = userId` bên trong một NestJS Service thông thường (Singleton) là một lỗi bảo mật nghiêm trọng?',
            options: [
              'Vì TypeScript không cho phép',
              'Vì Service là Singleton dùng chung cho tất cả các request của mọi người dùng, request của user sau sẽ ghi đè và đọc nhầm dữ liệu của user trước',
              'Vì làm cho database bị chậm',
              'Vì NestJS sẽ tự động xóa biến đó'
            ],
            correctIndex: 1,
            explanation: 'Trong NestJS, mặc định các Provider/Service đều là Singleton (chỉ tạo 1 instance duy nhất cho toàn bộ app). Mọi thuộc tính gắn trên instance này sẽ bị dùng chung cho toàn bộ hàng nghìn user đang kết nối.'
          }
        ],
        codeChallenge: {
          title: 'Tạo Request Context Isolation Wrapper',
          description: 'Viết hàm `createSafeRequestContext(requestId, user)` trả về object chứa `requestId`, `user`, và `timestamp: Date.now()`. Đảm bảo object trả về được đóng băng bằng `Object.freeze()` để không bị sửa đổi ngoài ý muốn.',
          starterCode: `function createSafeRequestContext(requestId, user) {
  // Viết logic tạo context an toàn
  
}`,
          solution: `function createSafeRequestContext(requestId, user) {
  return Object.freeze({
    requestId,
    user: { ...user },
    timestamp: Date.now()
  });
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Tạo context hợp lệ',
              input: ['req-001', { id: 'u1', name: 'Dr. Minh' }],
              expected: { requestId: 'req-001', user: { id: 'u1', name: 'Dr. Minh' } },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-2',
        title: 'Bài 02: Node.js Event Loop & Xử Lý Đa Người Dùng',
        duration: '35 phút',
        tag: 'Node.js Core',
        theory: `
### 1. Node.js Single-Threaded nhưng xử lý hàng nghìn request như thế nào?
Node.js chạy JavaScript trên **1 luồng duy nhất (Single Thread)**, nhưng nó ủy thác các tác vụ nặng về I/O (Đọc ghi Database, gọi Redis, gửi mạng) cho hệ điều hành thông qua thư viện **libuv**.

### 2. Quy tắc vàng: "Đừng bao giờ làm nghẽn Event Loop" (Don't block the Event Loop)
- **Tác vụ I/O bất đồng bộ (Non-blocking):** Gọi database \`await prisma.user.findMany()\` $\\rightarrow$ Node.js chuyển sang phục vụ request khác trong lúc đợi DB trả về $\\rightarrow$ Server chạy cực nhanh.
- **Tác vụ CPU đồng bộ nặng (Blocking):** Chạy vòng lặp \`for (let i = 0; i < 1000000000; i++)\` hoặc mã hóa file nặng đồng bộ $\\rightarrow$ Luồng chính bị đơ $\\rightarrow$ **Toàn bộ người dùng khác bị đứng hình!**
        `,
        realCodeSnippet: `// Trích tư duy bất đồng bộ trong Service
// Tốt: Bất đồng bộ không chặn luồng chính
async getDashboardStats(unitId: string) {
  const [appointmentsCount, revenue] = await Promise.all([
    this.prisma.appointment.count({ where: { unitId } }),
    this.prisma.invoice.aggregate({ where: { unitId }, _sum: { totalAmount: true } }),
  ]);
  return { appointmentsCount, revenue: revenue._sum.totalAmount || 0 };
}`,
        quiz: [
          {
            id: 'q2-1',
            question: 'Khi backend cần thực hiện 2 câu query độc lập vào database, cách viết nào tối ưu thời gian phản hồi nhất?',
            options: [
              'Gọi tuần tự: await query1(); await query2();',
              'Gọi song song bằng: await Promise.all([query1(), query2()]);',
              'Dùng vòng lặp while để chờ',
              'Dùng setTimeout'
            ],
            correctIndex: 1,
            explanation: 'Promise.all gửi cả 2 câu query xuống PostgreSQL đồng thời, giúp tổng thời gian chờ chỉ bằng thời gian của câu query lâu hơn thay vì cộng dồn cả hai.'
          }
        ],
        codeChallenge: {
          title: 'Xây dựng Async Batch Fetcher Helper',
          description: 'Viết hàm `fetchBatchData(tasks)` nhận vào một mảng các async functions `tasks: Array<() => Promise<any>>`. Thực thi tất cả các task đồng thời bằng `Promise.all` và trả về mảng kết quả.',
          starterCode: `async function fetchBatchData(tasks) {
  // Viết logic chạy batch async
  
}`,
          solution: `async function fetchBatchData(tasks) {
  return Promise.all(tasks.map(t => t()));
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): 2 async tasks',
              input: [[async () => 10, async () => 20]],
              expected: [10, 20],
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-3',
        title: 'Bài 03: Giao Thức HTTP: Headers, CORS, Cookies & Idempotency',
        duration: '35 phút',
        tag: 'HTTP & Network',
        theory: `
### 1. Bản chất của HTTP Request & Response
Mỗi khi Frontend gọi API, trình duyệt gửi một gói tin HTTP:
- **Method:** \`GET\` (Lấy dữ liệu - Idempotent), \`POST\` (Tạo mới), \`PATCH\` (Cập nhật 1 phần), \`DELETE\` (Xóa).
- **Headers:** \`Authorization: Bearer <token>\`, \`X-Unit-Id: <id>\`, \`Content-Type: application/json\`.
- **Status Codes:**
  - \`200 OK\`, \`201 Created\`
  - \`400 Bad Request\` (Sai format dữ liệu)
  - \`401 Unauthorized\` (Chưa đăng nhập / Token hết hạn)
  - \`403 Forbidden\` (Đã đăng nhập nhưng không có quyền)
  - \`404 Not Found\` (Không tìm thấy bản ghi)
  - \`409 Conflict\` (Trùng mã / Xóa cha đang có con)
  - \`500 Internal Server Error\` (Server gặp lỗi crash không mong muốn)

### 2. CORS (Cross-Origin Resource Sharing):
Trình duyệt chặn không cho Frontend tại \`http://localhost:5173\` gọi tới Backend \`http://localhost:3000\` trừ khi Backend gửi header:
\`Access-Control-Allow-Origin: http://localhost:5173\` và \`Access-Control-Allow-Credentials: true\`.
        `,
        realCodeSnippet: `// Cấu hình CORS và Security Headers trong eSmiles app-setup.ts
export function configureApp(app: NestExpressApplication, config: ConfigService<AppEnv, true>) {
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true, // Cho phép truyền HttpOnly Cookie
  });
  app.use(cookieParser());
}`,
        quiz: [
          {
            id: 'q3-1',
            question: 'Khi client gọi API tạo mới tài nguyên (POST) nhưng gửi thiếu trường bắt buộc, server nên trả về mã HTTP nào?',
            options: [
              '401 Unauthorized',
              '400 Bad Request (hoặc mã lỗi 422)',
              '500 Internal Server Error',
              '200 OK'
            ],
            correctIndex: 1,
            explanation: '400 Bad Request là mã chuẩn khi dữ liệu gửi lên từ client không thỏa mãn điều kiện validation.'
          }
        ],
        codeChallenge: {
          title: 'Xây dựng HTTP Response Envelope Standardizer',
          description: 'Viết hàm `buildSuccessEnvelope(data, meta)` nhận vào `data` và `meta` (tùy chọn). Trả về object chuẩn `{ success: true, data, meta: meta || null, timestamp: Date.now() }`.',
          starterCode: `function buildSuccessEnvelope(data, meta) {
  // Viết logic chuẩn hóa envelope
  
}`,
          solution: `function buildSuccessEnvelope(data, meta) {
  return {
    success: true,
    data,
    meta: meta || null,
    timestamp: Date.now()
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Dữ liệu mảng kèm pagination',
              input: [[{ id: 1 }], { page: 1, pageSize: 20 }],
              expected: { success: true, data: [{ id: 1 }], meta: { page: 1, pageSize: 20 } },
              hidden: false
            }
          ]
        }
      }
    ]
  },
  {
    sprintId: 1,
    sprintTitle: 'Sprint 1: NestJS Core & Clean Architecture',
    sprintDesc: 'Làm chủ tư duy Dependency Injection, Module, Controller, Service và DTO Validation trong NestJS 11',
    lessons: [
      {
        id: 'lesson-4',
        title: 'Bài 04: Bootstrapping, Modules & IoC Container',
        duration: '30 phút',
        tag: 'Core DI',
        theory: `
### 1. Dependency Injection (DI) là gì?
So sánh với React:
- Trong React: Đại ca dùng \`useContext()\` để lấy State / Service từ Component cha mà không cần truyền props qua 10 cấp.
- Trong NestJS: IoC (Inversion of Control) Container tự động khởi tạo Service và truyền vào Constructor của Controller.

### 2. Cấu trúc Module trong NestJS:
\`\`\`typescript
@Module({
  imports: [PrismaModule, AuditModule], // Các module khác cần dùng
  controllers: [InventoryCategoryController], // Nhận HTTP request
  providers: [InventoryCategoryService],      // Xử lý business logic
  exports: [InventoryCategoryService],        // Chia sẻ cho module khác dùng
})
export class InventoryModule {}
\`\`\`
        `,
        realCodeSnippet: `// Trích từ src/modules/platform/inventory/inventory.module.ts
@Module({
  imports: [AuditModule],
  controllers: [InventoryCategoryController, InventoryItemController],
  providers: [InventoryCategoryService, InventoryItemService],
  exports: [InventoryItemService],
})
export class InventoryModule {}`,
        quiz: [
          {
            id: 'q4-1',
            question: 'Muốn chia sẻ một Service cho các Module khác trong NestJS, ta bắt buộc phải làm gì?',
            options: [
              'Khai báo service đó vào mảng controllers',
              'Khai báo service đó vào mảng exports của module sở hữu và import module đó vào nơi cần dùng',
              'Tạo biến global',
              'Dùng new Service()'
            ],
            correctIndex: 1,
            explanation: 'Chỉ các provider nằm trong mảng exports mới có thể được các module khác sử dụng sau khi import module sở hữu.'
          }
        ],
        codeChallenge: {
          title: 'Xây dựng Simple IoC Registry',
          description: 'Viết class `SimpleModuleContainer` có `registerProvider(token, instance)` và `getProvider(token)`. Nếu token không tồn tại, ném `Error("Provider not found: " + token)`.',
          starterCode: `class SimpleModuleContainer {
  constructor() {
    this.providers = new Map();
  }
  registerProvider(token, instance) {
    // Đăng ký
  }
  getProvider(token) {
    // Lấy
  }
}`,
          solution: `class SimpleModuleContainer {
  constructor() {
    this.providers = new Map();
  }
  registerProvider(token, instance) {
    this.providers.set(token, instance);
  }
  getProvider(token) {
    if (!this.providers.has(token)) {
      throw new Error("Provider not found: " + token);
    }
    return this.providers.get(token);
  }
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Đăng ký và lấy instance',
              input: ['PrismaService', { connected: true }],
              expected: { connected: true },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-5',
        title: 'Bài 05: Controllers, Routing & Parameter Decorators',
        duration: '35 phút',
        tag: 'Routing',
        theory: `
### 1. Decorators trong Controller
- \`@Get()\`, \`@Post()\`, \`@Patch(':id')\`, \`@Delete(':id')\`: Định nghĩa method & sub-path.
- \`@Param('id', ParseUUIDPipe)\`: Lấy UUID từ URL \`/categories/:id\`.
- \`@Query()\`: Lấy query params \`?page=1&pageSize=20\`.
- \`@Body()\`: Lấy JSON payload từ request body.
- \`@ActiveUnitId()\`: Custom decorator lấy ID phòng khám hiện tại từ token/header.
        `,
        realCodeSnippet: `// Trích từ src/modules/platform/inventory/interface/inventory-category.controller.ts
@InternalController('inventory/categories')
export class InventoryCategoryController {
  constructor(private readonly categories: InventoryCategoryService) {}

  @Get(':id')
  @RequirePermission('inventory:category:read')
  detail(
    @ActiveUnitId() unitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryCategoryDto> {
    return this.categories.detail(unitId, id);
  }
}`,
        quiz: [
          {
            id: 'q5-1',
            question: 'Tại sao endpoint @Get(\'options\') phải đứng TRƯỚC @Get(\':id\') trong Controller?',
            options: [
              'Vì nếu đặt sau, router sẽ coi chuỗi "options" là giá trị :id và ParseUUIDPipe sẽ báo lỗi 400',
              'Để tăng tốc độ load',
              'Vì TypeScript yêu cầu',
              'Không quan trọng'
            ],
            correctIndex: 0,
            explanation: 'Trong Express/NestJS, route khớp theo thứ tự khai báo. Nếu :id đứng trước, nó sẽ bắt chuỗi "options" làm ID.'
          }
        ],
        codeChallenge: {
          title: 'Route Params Parser Helper',
          description: 'Viết hàm `matchRoute(pattern, path)` nhận vào pattern (vd: `items/:id`) và path thực tế (vd: `items/abc-123`), trả về `{ id: "abc-123" }` hoặc `null` nếu không khớp.',
          starterCode: `function matchRoute(pattern, path) {
  // Viết logic phân tích route
  
}`,
          solution: `function matchRoute(pattern, path) {
  const pParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (pParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < pParts.length; i++) {
    if (pParts[i].startsWith(':')) {
      params[pParts[i].slice(1)] = pathParts[i];
    } else if (pParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Khớp 1 param :id',
              input: ['items/:id', 'items/uuid-100'],
              expected: { id: 'uuid-100' },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-6',
        title: 'Bài 06: Services & Vòng Đời Dependency Injection',
        duration: '35 phút',
        tag: 'Business Logic',
        theory: `
### 1. Vòng đời của Provider (Injection Scopes)
- **DEFAULT (Singleton - 99% trường hợp):** Khởi tạo 1 lần duy nhất khi server start và dùng chung cho toàn bộ app $\\rightarrow$ Siêu nhanh, tiết kiệm RAM.
- **REQUEST-SCOPED:** Khởi tạo instance mới cho MỖI request HTTP $\\rightarrow$ Chậm hơn, tốn RAM, chỉ dùng khi thật sự cần thiết.
- **TRANSIENT:** Khởi tạo instance mới mỗi khi được inject.

### 2. Quy tắc thiết kế Service trong eSmiles:
- Service không phụ thuộc vào HTTP request/response (\`@Req()\`, \`@Res()\`).
- Nhận tham số rõ ràng: \`async list(unitId: string, query: Dto)\`.
        `,
        realCodeSnippet: `// Trích Service chuẩn mực trong eSmiles
@Injectable()
export class InventoryCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(unitId: string, query: InventoryCategoryQueryDto) {
    const { page, pageSize, q } = query;
    const where = {
      unitId,
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryCategory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryCategory.count({ where }),
    ]);
    return { items, page, pageSize, total };
  }
}`,
        quiz: [
          {
            id: 'q6-1',
            question: 'Scope mặc định của một Service trong NestJS là gì?',
            options: [
              'Request-scoped',
              'Singleton (DEFAULT)',
              'Transient',
              'Prototype'
            ],
            correctIndex: 1,
            explanation: 'Singleton là scope mặc định, giúp tái sử dụng đối tượng và tối ưu hóa tài nguyên server.'
          }
        ],
        codeChallenge: {
          title: 'Pagination Calculation Engine',
          description: 'Viết hàm `calculatePagination(total, page, pageSize)` tính toán: `page`, `pageSize`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`.',
          starterCode: `function calculatePagination(total, page, pageSize) {
  // Tính phân trang
  
}`,
          solution: `function calculatePagination(total, page, pageSize) {
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1 && totalPages > 0
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): 45 items, page 1, size 20',
              input: [45, 1, 20],
              expected: { page: 1, pageSize: 20, total: 45, totalPages: 3, hasNextPage: true, hasPrevPage: false },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-7',
        title: 'Bài 07: DTOs, Validation Pipe & Swagger OpenAPI',
        duration: '30 phút',
        tag: 'Validation',
        theory: `
### 1. DTO & Validation trong NestJS
- Sử dụng \`class-validator\` để khai báo quy tắc: \`@IsString()\`, \`@IsNotEmpty()\`, \`@Min(0)\`, \`@MaxLength(50)\`.
- Sử dụng \`class-transformer\` để ép kiểu: \`@Type(() => Number)\`.
- Sử dụng \`@nestjs/swagger\` để tự động sinh tài liệu API: \`@ApiProperty({ description, example })\`.
        `,
        realCodeSnippet: `// Trích DTO chuẩn từ eSmiles
export class CreateInventoryCategoryDto {
  @ApiProperty({ description: 'Mã phân loại', example: 'VTTH' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Tên phân loại', example: 'Vật tư tiêu hao' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}`,
        quiz: [
          {
            id: 'q7-1',
            question: 'Tại sao DTO trong NestJS nên dùng Class thay vì TypeScript Interface?',
            options: [
              'Vì Interface bị xóa sau khi compile sang JS, còn Class được giữ lại ở runtime cho class-validator và Swagger hoạt động',
              'Vì Interface tốn nhiều RAM hơn',
              'Vì NestJS cấm dùng Interface',
              'Không có sự khác biệt'
            ],
            correctIndex: 0,
            explanation: 'TypeScript Interface chỉ tồn tại ở thời điểm compile. Class tồn tại ở runtime giúp decorator validate dữ liệu.'
          }
        ],
        codeChallenge: {
          title: 'Manual DTO Validator Helper',
          description: 'Viết hàm `validateCategoryPayload(payload)` kiểm tra `code` (string không rỗng <= 20 ký tự) và `name` (string không rỗng <= 100 ký tự). Trả về `{ valid: true }` hoặc `{ valid: false, errors: string[] }`.',
          starterCode: `function validateCategoryPayload(payload) {
  // Viết logic validate
  
}`,
          solution: `function validateCategoryPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') return { valid: false, errors: ['Invalid payload'] };
  if (typeof payload.code !== 'string' || !payload.code.trim()) errors.push('code is required');
  else if (payload.code.length > 20) errors.push('code max 20 chars');
  if (typeof payload.name !== 'string' || !payload.name.trim()) errors.push('name is required');
  else if (payload.name.length > 100) errors.push('name max 100 chars');
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Hợp lệ',
              input: [{ code: 'VTTH', name: 'Vật tư tiêu hao' }],
              expected: { valid: true },
              hidden: false
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
        duration: '40 phút',
        tag: 'Database Modeling',
        theory: `
### 1. Khác biệt giữa lưu State ở FE và Database ở BE
- Trên FE: Dữ liệu là JSON lồng nhau tùy ý (\`{ user: { orders: [...] } }\`).
- Trên Backend PostgreSQL: Dữ liệu được **chuẩn hóa quan hệ (Normalized)** thành các bảng phẳng:
  - Khóa chính (Primary Key - UUID).
  - Khóa ngoại (Foreign Key) tạo quan hệ 1-1, 1-N, N-N.
  - Ràng buộc toàn vẹn: \`onDelete: Restrict\` (Không cho xóa cha khi còn con) vs \`Cascade\` (Xóa cha tự xóa con).

### 2. Tầm quan trọng sống còn của Database Indexing (B-Tree Index):
Nếu không đánh index cho cột \`unit_id\`, mỗi khi query, PostgreSQL phải quét toàn bộ hàng triệu dòng trong ổ cứng (**Full Table Scan**). Đánh index giúp tìm kiếm trong thời gian $O(\\log N)$ (chỉ vài mili-giây).
        `,
        realCodeSnippet: `// Trích từ prisma/schema/inventory.prisma
model InventoryCategory {
  id        String   @id @default(uuid()) @db.Uuid
  unitId    String   @map("unit_id") @db.Uuid
  code      String   @db.VarChar(50)
  name      String   @db.VarChar(255)
  isActive  Boolean  @default(true) @map("is_active")

  unit  Unit            @relation(fields: [unitId], references: [id], onDelete: Restrict)
  items InventoryItem[]

  @@unique([unitId, code], name: "uq_inventory_category_unit_code")
  @@index([unitId, isActive])
  @@map("inventory_category")
}`,
        quiz: [
          {
            id: 'q8-1',
            question: 'Tại sao nên dùng onDelete: Restrict cho quan hệ giữa Danh mục (Category) và Sản phẩm (Item)?',
            options: [
              'Để tăng tốc độ load',
              'Để ngăn chặn người dùng vô tình xóa mất một danh mục đang chứa hàng trăm sản phẩm bên trong, gây mồ côi dữ liệu',
              'Vì PostgreSQL bắt buộc',
              'Để tự động đổi tên'
            ],
            correctIndex: 1,
            explanation: 'Restrict là cơ chế bảo vệ an toàn dữ liệu nghiệp vụ, không cho phép xóa danh mục khi vẫn còn sản phẩm đang thuộc danh mục đó.'
          }
        ],
        codeChallenge: {
          title: 'Prisma Where Clause Builder',
          description: 'Viết hàm `buildWhereClause(unitId, filters)` nhận `unitId` và `filters: { q?: string, isActive?: boolean }`. Trả về Prisma Where Object có `unitId` bắt buộc, tìm kiếm `name` hoặc `code` khi có `q`.',
          starterCode: `function buildWhereClause(unitId, filters) {
  // Xây dựng where clause
  
}`,
          solution: `function buildWhereClause(unitId, filters) {
  const where = { unitId };
  if (typeof filters?.isActive === 'boolean') where.isActive = filters.isActive;
  if (filters?.q && filters.q.trim()) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { code: { contains: filters.q, mode: 'insensitive' } }
    ];
  }
  return where;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Có unitId và q',
              input: ['u-1', { q: 'kim tiêm' }],
              expected: { unitId: 'u-1', OR: [{ name: { contains: 'kim tiêm', mode: 'insensitive' } }, { code: { contains: 'kim tiêm', mode: 'insensitive' } }] },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-9',
        title: 'Bài 09: Prisma 7 Multi-file Schema & Migrations',
        duration: '35 phút',
        tag: 'Prisma ORM',
        theory: `
### 1. Prisma 7 Multi-file Schema trong eSmiles
Dự án chia nhỏ schema vào thư mục \`prisma/schema/\`:
- \`tenancy.prisma\`, \`identity.prisma\`, \`inventory.prisma\`, \`scheduling.prisma\`.

### 2. Các lệnh CLI bắt buộc:
\`\`\`bash
pnpm prisma:generate  # Sinh TypeScript client
pnpm prisma:migrate   # Tạo migration mới cho DB dev
pnpm db:seed:core     # Nạp dữ liệu seed ban đầu
\`\`\`
        `,
        realCodeSnippet: `// Trích cấu hình prisma.config.ts trong eSmiles
export default {
  earlyAccess: true,
  schema: 'prisma/schema',
};`,
        quiz: [
          {
            id: 'q9-1',
            question: 'Khi thay đổi trường dữ liệu trong file schema.prisma, lệnh nào cần chạy để cập nhật TypeScript autocomplete cho Prisma Client?',
            options: [
              'pnpm prisma:generate',
              'pnpm start',
              'pnpm lint',
              'pnpm test'
            ],
            correctIndex: 0,
            explanation: 'prisma:generate đọc các file schema và sinh lại mã nguồn TypeScript trong node_modules/@prisma/client.'
          }
        ],
        codeChallenge: {
          title: 'Model Name Mapper Helper',
          description: 'Viết hàm `toDbTableName(modelName)` chuyển đổi tên PascalCase của Model (vd: `InventoryCategory`) sang tên bảng snake_case trong Database (`inventory_category`).',
          starterCode: `function toDbTableName(modelName) {
  // Viết logic convert PascalCase to snake_case
  
}`,
          solution: `function toDbTableName(modelName) {
  return modelName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): InventoryCategory -> inventory_category',
              input: ['InventoryCategory'],
              expected: 'inventory_category',
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-10',
        title: 'Bài 10: Prisma CRUD & Giải Quyết Triệt Để N+1 Query',
        duration: '40 phút',
        tag: 'Query Optimization',
        theory: `
### 1. Vấn nạn N+1 Query là gì?
Nếu lấy danh sách 100 Lịch hẹn, sau đó với mỗi lịch hẹn lại chạy 1 câu query để tìm tên Bác sĩ:
\`\`\`typescript
// SAI: Sinh ra 101 câu query xuống DB -> Làm sập server!
const appointments = await prisma.appointment.findMany();
for (const appt of appointments) {
  appt.doctor = await prisma.doctor.findUnique({ where: { id: appt.doctorId } });
}
\`\`\`

### 2. Cách giải quyết chuẩn trong eSmiles:
- **Cách 1 (Prisma Include/Select):** \`findMany({ include: { doctor: true } })\` $\\rightarrow$ Prisma tự sinh câu JOIN hoặc 2 câu query tối ưu.
- **Cách 2 (Batch ID Resolution):** Lấy danh sách \`doctorIds\` duy nhất, gọi 1 câu \`doctor.findMany({ where: { id: { in: doctorIds } } })\` rồi map vào kết quả.
        `,
        realCodeSnippet: `// Trích giải quyết N+1 query tại verticals/clinic/doctor/application/doctor-names.ts
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
            question: 'Tại sao DTO trả về cho Frontend trong eSmiles KHÔNG nên chỉ trả ID trần (vd: doctorId) mà phải kèm tên hiển thị (doctorName)?',
            options: [
              'Để tránh đẩy bài toán N+1 request sang phía Frontend (Frontend phải gọi thêm 100 API lookup để dịch ID ra tên)',
              'Vì ID chiếm ít dung lượng',
              'Để bảo mật',
              'Không có lý do'
            ],
            correctIndex: 0,
            explanation: 'Trả đủ nhãn render được giúp màn hình FE hiển thị ngay lập tức, không bị giật/chớp giá trị rỗng và không gây quá tải request cho server.'
          }
        ],
        codeChallenge: {
          title: 'Batch Name Resolver Helper',
          description: 'Viết hàm `resolveItemNames(items, nameMap)` nhận vào mảng `items: Array<{ id: string, categoryId: string }>` và `nameMap: Record<string, string>`. Trả về mảng mới có thêm trường `categoryName: nameMap[item.categoryId] || null`.',
          starterCode: `function resolveItemNames(items, nameMap) {
  // Viết logic map tên
  
}`,
          solution: `function resolveItemNames(items, nameMap) {
  return items.map(item => ({
    ...item,
    categoryName: nameMap[item.categoryId] || null
  }));
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Map tên thành công',
              input: [[{ id: 'i1', categoryId: 'c1' }], { c1: 'Vật tư tiêu hao' }],
              expected: [{ id: 'i1', categoryId: 'c1', categoryName: 'Vật tư tiêu hao' }],
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-11',
        title: 'Bài 11: Database Transactions & Concurrency Locking',
        duration: '45 phút',
        tag: 'Transactions & ACID',
        theory: `
### 1. Tính Toàn Vẹn ACID trong Database:
- **Atomicity (Nguyên tử):** Tất cả các câu lệnh cùng thành công, hoặc nếu 1 câu lỗi thì toàn bộ tự động **Rollback** về trạng thái ban đầu.
- **Consistency (Nhất quán):** Dữ liệu không bao giờ bị vi phạm ràng buộc toàn vẹn.
- **Isolation (Cô lập):** Các giao dịch chạy đồng thời không can thiệp làm sai lệch dữ liệu của nhau.
- **Durability (Bền vững):** Dữ liệu đã commit sẽ được lưu an toàn xuống đĩa cứng.

### 2. Bài toán Race Condition (Xung đột đồng thời):
Khi 2 bệnh nhân cùng đặt Lịch hẹn tại Ghế 1 lúc 09:00:00:
- Sử dụng **Prisma Interactive Transaction (\`$transaction\`)** kết hợp kiểm tra trạng thái trước khi ghi để đảm bảo chỉ 1 người thành công.
        `,
        realCodeSnippet: `// Trích Transaction an toàn trong eSmiles
async transferStock(unitId: string, fromWarehouseId: string, toWarehouseId: string, itemId: string, quantity: number) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Trừ kho nguồn (kiểm tra tồn kho đủ)
    const source = await tx.stockBalance.update({
      where: { warehouseId_itemId: { warehouseId: fromWarehouseId, itemId } },
      data: { quantity: { decrement: quantity } },
    });
    if (source.quantity < 0) {
      throw new Error("INSUFFICIENT_STOCK"); // Tự động Rollback toàn bộ!
    }

    // 2. Cộng kho đích
    await tx.stockBalance.upsert({
      where: { warehouseId_itemId: { warehouseId: toWarehouseId, itemId } },
      create: { warehouseId: toWarehouseId, itemId, quantity },
      update: { quantity: { increment: quantity } },
    });
  });
}`,
        quiz: [
          {
            id: 'q11-1',
            question: 'Nếu trong một khối `this.prisma.$transaction(async (tx) => { ... })`, câu lệnh thứ 2 ném ra Exception thì chuyện gì xảy ra với kết quả của câu lệnh thứ 1?',
            options: [
              'Câu 1 vẫn được lưu vào DB',
              'Toàn bộ transaction tự động Rollback (hủy bỏ hoàn toàn các thay đổi của câu 1), DB quay về nguyên vẹn như trước khi chạy transaction',
              'Server bị sập',
              'Database bị xóa'
            ],
            correctIndex: 1,
            explanation: 'Tính chất Atomicity của Transaction đảm bảo nguyên tắc: Hoặc tất cả cùng thành công, hoặc không có gì thay đổi trong Database.'
          }
        ],
        codeChallenge: {
          title: 'Mô phỏng Safe Balance Decrement Helper',
          description: 'Viết hàm `safeDecrementStock(currentStock, quantity)`: nếu `quantity <= 0` ném `Error("INVALID_QUANTITY")`, nếu `currentStock < quantity` ném `Error("INSUFFICIENT_STOCK")`. Trả về `currentStock - quantity`.',
          starterCode: `function safeDecrementStock(currentStock, quantity) {
  // Viết logic trừ tồn kho an toàn
  
}`,
          solution: `function safeDecrementStock(currentStock, quantity) {
  if (quantity <= 0) throw new Error("INVALID_QUANTITY");
  if (currentStock < quantity) throw new Error("INSUFFICIENT_STOCK");
  return currentStock - quantity;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Trừ 10 từ 50 -> 40',
              input: [50, 10],
              expected: 40,
              hidden: false
            },
            {
              name: 'Test Case 2 (Visible): Thiếu tồn kho -> Ném lỗi',
              input: [5, 10],
              expected: 'ERROR_THROWN',
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-12',
        title: 'Bài 12: Multi-Tenancy Isolation & Bảo Mật Tenant Scope',
        duration: '35 phút',
        tag: 'Multi-Tenancy',
        theory: `
### 1. Kiến trúc Đa Chi Nhánh (Multi-tenancy) eSmiles
- **Group (Tập đoàn):** Cấp quản lý cao nhất.
- **Unit (Pháp nhân / Phòng khám):** Đơn vị cô lập dữ liệu chính (Khách hàng, Kho, Bác sĩ, Tiền bạc).
- **Branch (Chi nhánh trực thuộc):** Địa điểm phục vụ khám chữa bệnh.

### 2. Quy tắc bất biến:
> **100% các câu query dữ liệu phòng khám phải có \`where: { unitId }\`.**
Nếu quên \`unitId\`, kẻ xấu có thể đổi ID trên URL để đọc trộm hoặc sửa dữ liệu của phòng khám khác (lỗ hổng IDOR).
        `,
        realCodeSnippet: `// Trích kiểm tra Tenant Scope an toàn trong Service
async detail(unitId: string, id: string): Promise<InventoryCategoryDto> {
  const item = await this.prisma.inventoryCategory.findFirst({
    where: { id, unitId }, // BẮT BUỘC: Ép điều kiện sở hữu phòng khám
  });
  if (!item) {
    throw new CatalogError('NOT_FOUND', { target: 'inventoryCategory', id });
  }
  return item;
}`,
        quiz: [
          {
            id: 'q12-1',
            question: 'Khi người dùng gọi API `PATCH /api/i/v1/inventory/categories/123`, tại sao Service phải kiểm tra `where: { id: "123", unitId }`?',
            options: [
              'Để kiểm tra bản ghi có tồn tại VÀ có thuộc về phòng khám mà người dùng đang đăng nhập hay không, chống sửa trộm dữ liệu phòng khám khác',
              'Để tăng tốc độ mạng',
              'Để format ngày tháng',
              'Không cần thiết'
            ],
            correctIndex: 0,
            explanation: 'Ép điều kiện unitId giúp bảo vệ hệ thống khỏi lỗ hổng IDOR xuyên tenant.'
          }
        ],
        codeChallenge: {
          title: 'Tenant Scope Guard Helper',
          description: 'Viết hàm `assertTenantOwnership(resource, activeUnitId)`: nếu `!resource || resource.unitId !== activeUnitId` thì ném `Error("FORBIDDEN_TENANT_ACCESS")`. Ngược lại trả về `true`.',
          starterCode: `function assertTenantOwnership(resource, activeUnitId) {
  // Kiểm tra tenant
  
}`,
          solution: `function assertTenantOwnership(resource, activeUnitId) {
  if (!resource || resource.unitId !== activeUnitId) {
    throw new Error("FORBIDDEN_TENANT_ACCESS");
  }
  return true;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Đúng unitId -> true',
              input: [{ id: '1', unitId: 'u1' }, 'u1'],
              expected: true,
              hidden: false
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
        duration: '35 phút',
        tag: 'Error Handling',
        theory: `
### 1. Tại sao không nên viết try/catch bừa bãi trong Service?
Trong eSmiles, mọi lỗi Prisma (P2002 Unique, P2003 Foreign Key, P2025 Not Found) được để tự do rò rỉ ra ngoài và được **AllExceptionsFilter** toàn cục bắt và map tự động:
- Unique Violation (P2002) $\\rightarrow$ **409 Conflict** (\`DUPLICATE_VALUE\`).
- Foreign Key Restrict (P2003) $\\rightarrow$ **409 Conflict** (\`FOREIGN_KEY_RESTRICT\`).
- Record Not Found (P2025) $\\rightarrow$ **404 Not Found** (\`NOT_FOUND\`).
        `,
        realCodeSnippet: `// Trích từ src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    // Chuẩn hóa và map lỗi thành JSON Envelope đồng bộ
  }
}`,
        quiz: [
          {
            id: 'q13-1',
            question: 'Khi cố gắng tạo 1 danh mục có mã code đã tồn tại trong cùng phòng khám, AllExceptionsFilter sẽ trả về HTTP Status Code nào?',
            options: [
              '409 Conflict',
              '500 Internal Server Error',
              '200 OK',
              '401 Unauthorized'
            ],
            correctIndex: 0,
            explanation: 'Lỗi trùng mã (Unique Constraint) được map chuẩn xác thành 409 Conflict.'
          }
        ],
        codeChallenge: {
          title: 'Error HTTP Status Mapper Helper',
          description: 'Viết hàm `mapErrorToStatus(code)`: "DUPLICATE_VALUE" -> 409, "NOT_FOUND" -> 404, "UNAUTHORIZED" -> 401, "FORBIDDEN" -> 403, các mã khác -> 500.',
          starterCode: `function mapErrorToStatus(code) {
  // Map mã lỗi
  
}`,
          solution: `function mapErrorToStatus(code) {
  const map = { DUPLICATE_VALUE: 409, NOT_FOUND: 404, UNAUTHORIZED: 401, FORBIDDEN: 403 };
  return map[code] || 500;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): DUPLICATE_VALUE -> 409',
              input: ['DUPLICATE_VALUE'],
              expected: 409,
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-14',
        title: 'Bài 14: Authentication: Argon2, JWT & HttpOnly Cookie',
        duration: '40 phút',
        tag: 'Authentication',
        theory: `
### 1. Bảo mật Mật khẩu: Tại sao dùng Argon2?
- Tuyệt đối KHÔNG BAO GIỜ lưu mật khẩu dạng plain text hoặc mã hóa bằng MD5/SHA256 (dễ bị bẻ khóa bằng Rainbow Table).
- eSmiles sử dụng thuật toán **Argon2** (chuẩn bảo mật hàng đầu thế giới chống tấn công GPU/ASIC).

### 2. Cơ chế Token Hybrid:
- **Access Token:** Mang payload JWT (\`sub\`, \`unitId\`, \`roles\`), sống ngắn (15-30 phút).
- **Refresh Token:** Lưu trong **HttpOnly Cookie** trên Web CMS để chống đánh cắp qua XSS.
        `,
        realCodeSnippet: `// Trích từ src/common/auth/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);`,
        quiz: [
          {
            id: 'q14-1',
            question: 'Tại sao Refresh Token nên lưu trong HttpOnly Cookie thay vì LocalStorage?',
            options: [
              'Vì JavaScript độc hại (XSS) trên trình duyệt không thể đọc được HttpOnly Cookie',
              'Để tăng dung lượng',
              'Vì cookie chạy nhanh hơn',
              'Không quan trọng'
            ],
            correctIndex: 0,
            explanation: 'HttpOnly cookie ngăn chặn hoàn toàn JavaScript truy cập, bảo vệ phiên đăng nhập khỏi hacker khi web bị XSS.'
          }
        ],
        codeChallenge: {
          title: 'JWT Payload Decoder Context Helper',
          description: 'Viết hàm `parseTokenContext(payload, nowMs)`: trả về `{ accountId: payload.sub, activeUnitId: payload.uid, isExpired: (payload.exp * 1000) < nowMs }`.',
          starterCode: `function parseTokenContext(payload, nowMs) {
  // Parse token payload
  
}`,
          solution: `function parseTokenContext(payload, nowMs) {
  return {
    accountId: payload.sub,
    activeUnitId: payload.uid,
    isExpired: (payload.exp * 1000) < nowMs
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Token còn hạn',
              input: [{ sub: 'acc-1', uid: 'u-1', exp: 1900000000 }, 1700000000000],
              expected: { accountId: 'acc-1', activeUnitId: 'u-1', isExpired: false },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-15',
        title: 'Bài 15: Authorization CASL & Multi-Surface API',
        duration: '40 phút',
        tag: 'Authorization',
        theory: `
### 1. Phân Quyền Chi Tiết (Granular Permissions)
Quy ước định dạng quyền chuẩn: \`<module>:<resource>:<action>\` (vd: \`inventory:category:read\`, \`inventory:stocktake:approve\`).

### 2. Multi-Surface Controllers:
- \`@InternalController('path')\` $\\rightarrow$ \`/api/i/v1/...\` (Nhân viên nội bộ).
- \`@CustomerController('path')\` $\\rightarrow$ \`/api/p/v1/...\` (Bệnh nhân).
- \`@PlatformAdminController('path')\` $\\rightarrow$ \`/api/i/admin/v1/...\` (Super Admin).
        `,
        realCodeSnippet: `// Trích từ src/common/auth/require-permission.decorator.ts
export const RequirePermission = (permission: PermissionCode) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);`,
        quiz: [
          {
            id: 'q15-1',
            question: 'Khi một API chỉ dành cho bệnh nhân đặt lịch trên App điện thoại, controller đó sử dụng decorator nào?',
            options: [
              '@CustomerController(\'appointments\')',
              '@InternalController(\'appointments\')',
              '@PlatformAdminController(\'appointments\')',
              '@Controller(\'appointments\')'
            ],
            correctIndex: 0,
            explanation: '@CustomerController phân vùng đường dẫn vào /api/p/v1/appointments cho đối tượng khách hàng.'
          }
        ],
        codeChallenge: {
          title: 'CASL Wildcard Permission Checker Engine',
          description: 'Viết hàm `hasPermission(userPerms, requiredPerm)`: trả về `true` nếu `userPerms` chứa `requiredPerm` hoặc `*` hoặc wildcard module (vd: `inventory:*`).',
          starterCode: `function hasPermission(userPerms, requiredPerm) {
  // Viết logic kiểm tra permission
  
}`,
          solution: `function hasPermission(userPerms, requiredPerm) {
  if (!userPerms || !Array.isArray(userPerms)) return false;
  if (userPerms.includes('*') || userPerms.includes(requiredPerm)) return true;
  const mod = requiredPerm.split(':')[0];
  return userPerms.includes(mod + ':*');
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Khớp chính xác',
              input: [['inventory:category:read'], 'inventory:category:read'],
              expected: true,
              hidden: false
            },
            {
              name: 'Test Case 2 (Visible): Wildcard module',
              input: [['inventory:*'], 'inventory:category:delete'],
              expected: true,
              hidden: false
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
        duration: '35 phút',
        tag: 'Caching & Performance',
        theory: `
### 1. Cache-Aside Pattern với Redis:
1. Khi có request, kiểm tra Redis cache trước.
2. Nếu có (Cache Hit) $\\rightarrow$ Trả về ngay trong 1ms (không chạm vào PostgreSQL).
3. Nếu không có (Cache Miss) $\\rightarrow$ Query từ PostgreSQL $\\rightarrow$ Lưu vào Redis với thời hạn TTL (Time-To-Live) $\\rightarrow$ Trả về cho client.
4. Khi dữ liệu bị sửa/xóa $\\rightarrow$ **Xóa cache Redis (Cache Invalidation)** để tránh trả về dữ liệu cũ.

### 2. Rate Limiting (Chống Spam / DDOS):
Sử dụng Redis Token Bucket để giới hạn mỗi IP chỉ được gọi tối đa 100 requests / phút.
        `,
        realCodeSnippet: `// Trích tư duy Caching với Redis
async getCachedLookup(key: string, fetcher: () => Promise<any>, ttlSeconds = 300) {
  const cached = await this.redis.get(key);
  if (cached) return JSON.parse(cached);
  const freshData = await fetcher();
  await this.redis.set(key, JSON.stringify(freshData), 'EX', ttlSeconds);
  return freshData;
}`,
        quiz: [
          {
            id: 'q16-1',
            question: 'Khi dữ liệu trong bảng danh mục kho bị thay đổi (UPDATE), thao tác nào với Redis Cache là bắt buộc?',
            options: [
              'Xóa hoặc làm mới key cache tương ứng trong Redis (Cache Invalidation) để người dùng không bị đọc phải dữ liệu cũ',
              'Khởi động lại server',
              'Không cần làm gì',
              'Tắt Redis'
            ],
            correctIndex: 0,
            explanation: 'Cache Invalidation đảm bảo tính nhất quán giữa Database và bộ nhớ đệm Redis.'
          }
        ],
        codeChallenge: {
          title: 'Cache Key Generator Helper',
          description: 'Viết hàm `generateCacheKey(prefix, unitId, resourceId)` tạo key Redis dạng `"{prefix}:{unitId}:{resourceId}"` viết thường, không có khoảng trắng thừa.',
          starterCode: `function generateCacheKey(prefix, unitId, resourceId) {
  // Tạo cache key
  
}`,
          solution: `function generateCacheKey(prefix, unitId, resourceId) {
  return [prefix, unitId, resourceId].map(s => String(s).trim().toLowerCase()).join(':');
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Key chuẩn',
              input: ['LOOKUP', 'Unit-01', 'Cat-99'],
              expected: 'lookup:unit-01:cat-99',
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-17',
        title: 'Bài 17: Background Jobs & Message Queue với BullMQ',
        duration: '40 phút',
        tag: 'Message Queue',
        theory: `
### 1. Tại sao cần BullMQ Queue?
Gửi tin nhắn SMS nhắc lịch hẹn hoặc xuất file Excel 50,000 dòng mất 10 giây. Nếu chạy trực tiếp trong luồng HTTP, client sẽ bị xoay vòng chờ đợi và timeout.

### 2. Mô hình Producer - Consumer:
- **Producer (Service):** Đẩy Job vào Queue Redis trong 5ms và trả về ngay \`{ success: true, message: "Đang xử lý ngầm" }\`.
- **Consumer (Processor):** Chạy ngầm rút từng Job ra xử lý, tự động thử lại 3 lần nếu mất mạng, lưu vào Dead Letter Queue (DLQ) nếu thất bại hoàn toàn.
        `,
        realCodeSnippet: `// Producer đẩy job vào Queue
@Injectable()
export class NotificationQueueService {
  constructor(@InjectQueue('notifications') private readonly queue: Queue) {}

  async queueSmsReminder(payload: SmsPayload) {
    await this.queue.add('send-sms', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
    });
  }
}`,
        quiz: [
          {
            id: 'q17-1',
            question: 'Lợi ích chính của việc sử dụng Message Queue (BullMQ) là gì?',
            options: [
              'Tách biệt các tác vụ nặng ra khỏi luồng HTTP chính, giúp API phản hồi tức thì và tự động retry khi gặp lỗi tạm thời',
              'Làm cho file code ngắn hơn',
              'Để thay thế PostgreSQL',
              'Không có lợi ích gì'
            ],
            correctIndex: 0,
            explanation: 'Queue giải phóng luồng HTTP chính, tăng khả năng chịu tải và độ bền vững của hệ thống.'
          }
        ],
        codeChallenge: {
          title: 'Exponential Backoff Delay Calculator',
          description: 'Viết hàm `calculateBackoff(attempt, baseDelay, maxDelay)` tính: `delay = baseDelay * (2 ** (attempt - 1))`. Nếu `delay > maxDelay` thì lấy `maxDelay`.',
          starterCode: `function calculateBackoff(attempt, baseDelay, maxDelay) {
  // Tính backoff
  
}`,
          solution: `function calculateBackoff(attempt, baseDelay, maxDelay) {
  const d = baseDelay * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(d, maxDelay);
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Lần 1: 1000ms',
              input: [1, 1000, 10000],
              expected: 1000,
              hidden: false
            },
            {
              name: 'Test Case 2 (Visible): Lần 3: 4000ms',
              input: [3, 1000, 10000],
              expected: 4000,
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-18',
        title: 'Bài 18: Upload File An Toàn: Presigned URL MinIO/S3',
        duration: '35 phút',
        tag: 'File Storage',
        theory: `
### 1. Tại sao KHÔNG upload file trực tiếp qua NestJS Server?
Nếu 100 bác sĩ cùng upload ảnh chụp CT X-Quang 500MB qua NestJS Server $\\rightarrow$ RAM và băng thông của máy chủ Backend sẽ bị cạn kiệt ngay lập tức!

### 2. Mô hình Presigned URL (Chuẩn Enterprise):
1. **Frontend $\\rightarrow$ NestJS:** Xin cấp quyền upload: \`POST /api/files/presign\` (gửi tên file, kích thước, mimetype).
2. **NestJS $\\rightarrow$ Frontend:** Trả về một **Presigned Upload URL** có chữ ký bảo mật và thời hạn 15 phút.
3. **Frontend $\\rightarrow$ MinIO / S3:** Upload file trực tiếp lên Storage Server bằng lệnh \`PUT\` (không tốn 1 byte RAM nào của NestJS!).
4. **Frontend $\\rightarrow$ NestJS:** Báo hoàn tất upload để lưu metadata vào Database.
        `,
        realCodeSnippet: `// Trích từ src/modules/platform/file/application/file.service.ts
async getPresignedUploadUrl(unitId: string, dto: PresignUploadDto) {
  const objectKey = \`\${unitId}/\${Date.now()}-\${dto.filename}\`;
  const uploadUrl = await this.minioClient.presignedPutObject(
    this.bucketName,
    objectKey,
    15 * 60, // 15 phút hết hạn
  );
  return { uploadUrl, objectKey };
}`,
        quiz: [
          {
            id: 'q18-1',
            question: 'Ưu điểm lớn nhất của mô hình Presigned URL khi upload file là gì?',
            options: [
              'Trình duyệt upload trực tiếp lên Cloud Storage (MinIO/S3), giải phóng hoàn toàn băng thông và RAM của máy chủ Backend NestJS',
              'Làm cho ảnh đẹp hơn',
              'Không cần lưu trữ trên đĩa cứng',
              'Để giảm giá tiền server'
            ],
            correctIndex: 0,
            explanation: 'Presigned URL đẩy tải truyền dữ liệu nặng sang Object Storage chuyên dụng, giữ cho máy chủ backend luôn nhẹ và phản hồi nhanh.'
          }
        ],
        codeChallenge: {
          title: 'Storage Object Key Generator Helper',
          description: 'Viết hàm `buildStorageKey(unitId, folder, filename)` tạo đường dẫn lưu trữ dạng `"{unitId}/{folder}/{cleanFilename}"` với cleanFilename đã xóa các ký tự đặc biệt nguy hiểm.',
          starterCode: `function buildStorageKey(unitId, folder, filename) {
  // Tạo storage key an toàn
  
}`,
          solution: `function buildStorageKey(unitId, folder, filename) {
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return unitId + '/' + folder + '/' + cleanName;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Key chuẩn',
              input: ['u-01', 'xrays', 'film 01 #test.png'],
              expected: 'u-01/xrays/film_01__test.png',
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-19',
        title: 'Bài 19: WebSockets Realtime & Redis Adapter Rooms',
        duration: '35 phút',
        tag: 'Realtime',
        theory: `
### 1. Realtime trong Ứng Dụng Multi-tenancy
Khi có bệnh nhân check-in tại quầy Lễ tân, màn hình Bác sĩ cần cập nhật ngay mà không cần F5.

### 2. Phân chia Room theo Tenant:
- Sử dụng **Socket.IO Rooms**: \`socket.join("unit:" + unitId)\`.
- Khi phát tín hiệu: \`server.to("unit:" + unitId).emit("PATIENT_CHECKED_IN", data)\`.
- Sử dụng **Redis Adapter** để đồng bộ sự kiện giữa nhiều instance server chạy song song.
        `,
        realCodeSnippet: `// Trích WebSocket Gateway eSmiles
@WebSocketGateway({ cors: true, namespace: '/realtime' })
export class ClinicGateway {
  @WebSocketServer() server!: Server;

  notifyCheckin(unitId: string, payload: any) {
    this.server.to(\`unit:\${unitId}\`).emit('PATIENT_CHECKED_IN', payload);
  }
}`,
        quiz: [
          {
            id: 'q19-1',
            question: 'Tại sao cần phân chia WebSocket Rooms theo UnitId trong hệ thống eSmiles?',
            options: [
              'Để đảm bảo Multi-tenancy: Chỉ các bác sĩ thuộc đúng phòng khám đó mới nhận được thông báo của phòng khám mình',
              'Vì Socket.IO bắt buộc',
              'Để giảm số lượng kết nối',
              'Không có lý do'
            ],
            correctIndex: 0,
            explanation: 'Phân chia rooms theo UnitId ngăn chặn việc lộ thông báo của phòng khám này sang phòng khám khác.'
          }
        ],
        codeChallenge: {
          title: 'WebSocket Event Payload Formatter',
          description: 'Viết hàm `formatWsEvent(eventName, payload)` trả về `{ event: eventName.toUpperCase(), payload, timestamp: Date.now() }`.',
          starterCode: `function formatWsEvent(eventName, payload) {
  // Format websocket event
  
}`,
          solution: `function formatWsEvent(eventName, payload) {
  return {
    event: eventName.toUpperCase(),
    payload,
    timestamp: Date.now()
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Event chuẩn',
              input: ['patient_arrived', { patientId: 'p1' }],
              expected: { event: 'PATIENT_ARRIVED', payload: { patientId: 'p1' } },
              hidden: false
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
        duration: '35 phút',
        tag: 'Audit & Compliance',
        theory: `
### 1. Tại sao y tế và tài chính bắt buộc phải có Audit Log?
- Cần biết chính xác: **Ai (Who)**, đã làm **Hành động gì (Action)**, trên **Bản ghi nào (Target)**, vào **Thời điểm nào (When)**, với **Dữ liệu trước và sau khi sửa (Changes)**.
- Khi có sự cố tranh chấp hoặc sửa hồ sơ bệnh án trái phép, Audit Log là bằng chứng pháp lý duy nhất.

### 2. Ghi Audit Log bất đồng bộ:
Ghi log kiểm toán không được làm chậm luồng thao tác chính của bác sĩ (được đẩy qua Event Emitter hoặc Queue).
        `,
        realCodeSnippet: `// Trích decorator @Audit trên Controller
@Patch(':id')
@RequirePermission('inventory:category:update')
@Audit({ target: 'inventoryCategory', action: AuditAction.update })
update(@ActiveUnitId() unitId: string, @Param('id') id: string, @Body() dto: UpdateDto) {
  return this.categories.update(unitId, id, dto);
}`,
        quiz: [
          {
            id: 'q20-1',
            question: 'Thông tin nào sau đây là quan trọng nhất bắt buộc phải có trong 1 bản ghi Audit Log?',
            options: [
              'userId, unitId, action, target, changes (diff), timestamp, clientIp',
              'Màu sắc giao diện',
              'Tên bài hát',
              'Dung lượng ổ cứng'
            ],
            correctIndex: 0,
            explanation: 'Bộ thông tin 5W (Who, What, Where, When, Why) là tiêu chuẩn bắt buộc cho hệ thống kiểm toán y tế và tài chính.'
          }
        ],
        codeChallenge: {
          title: 'Audit Log Record Builder',
          description: 'Viết hàm `buildAuditLog(userId, unitId, action, entityId, changes)` trả về object audit chuẩn.',
          starterCode: `function buildAuditLog(userId, unitId, action, entityId, changes) {
  // Tạo audit log record
  
}`,
          solution: `function buildAuditLog(userId, unitId, action, entityId, changes) {
  return {
    userId,
    unitId,
    action: action.toUpperCase(),
    entityId,
    changes: changes || {},
    timestamp: Date.now()
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Ghi log update',
              input: ['u-1', 'unit-10', 'UPDATE', 'item-9', { name: 'Đổi tên' }],
              expected: { userId: 'u-1', unitId: 'unit-10', action: 'UPDATE', entityId: 'item-9', changes: { name: 'Đổi tên' } },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-21',
        title: 'Bài 21: Kiểm Thử API Sống Với Bruno (`.bru`) & CI Gate',
        duration: '30 phút',
        tag: 'API Tooling',
        theory: `
### 1. Bruno - Bề mặt API sống track trong Git
- Thay vì dùng Postman Cloud dễ bị lệch tài liệu, eSmiles lưu mọi API request thành file text \`.bru\` trong thư mục \`bruno/\`.
- Mọi Pull Request sửa đổi API **bắt buộc** phải cập nhật file \`.bru\` tương ứng.

### 2. Kiểm tra tính đầy đủ:
\`\`\`bash
pnpm bruno:check        # So khớp controller với file .bru
\`\`\`
        `,
        realCodeSnippet: `// Trích file bruno/internal/inventory/categories/list.bru
meta {
  name: Danh sách phân loại kho
  type: http
  seq: 1
}
get {
  url: {{baseUrl}}/api/i/v1/inventory/categories?page=1&pageSize=20
  auth: bearer
}
headers {
  X-Unit-Id: {{unitId}}
}`,
        quiz: [
          {
            id: 'q21-1',
            question: 'Lợi ích của việc lưu file kiểm thử API (.bru) trực tiếp trong Git repo là gì?',
            options: [
              'API docs luôn đồng bộ 100% với từng commit code và được review qua Pull Request',
              'Để tăng dung lượng Git',
              'Để không cần viết unit test',
              'Không có lợi ích gì'
            ],
            correctIndex: 0,
            explanation: 'Tracking file .bru trực tiếp trong Git biến tài liệu API thành bộ test sống đồng bộ với code.'
          }
        ],
        codeChallenge: {
          title: 'Bruno Header Generator Helper',
          description: 'Viết hàm `buildBrunoHeaders(token, unitId)` trả về `{ Authorization: "Bearer " + token, "X-Unit-Id": unitId }`.',
          starterCode: `function buildBrunoHeaders(token, unitId) {
  // Tạo headers cho Bruno
  
}`,
          solution: `function buildBrunoHeaders(token, unitId) {
  return {
    Authorization: 'Bearer ' + token.trim(),
    'X-Unit-Id': unitId.trim()
  };
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Headers chuẩn',
              input: ['jwt-123', 'u-01'],
              expected: { Authorization: 'Bearer jwt-123', 'X-Unit-Id': 'u-01' },
              hidden: false
            }
          ]
        }
      },
      {
        id: 'lesson-22',
        title: 'Bài 22: Unit Test Jest & E2E Testing với Supertest',
        duration: '40 phút',
        tag: 'Testing',
        theory: `
### 1. Phân cấp Testing trong Backend:
- **Unit Test (\`*.spec.ts\`):** Kiểm tra từng hàm Service riêng lẻ bằng cách Mock PrismaService $\\rightarrow$ Chạy siêu nhanh (vài mili-giây).
- **E2E Test (\`test/*.e2e-spec.ts\`):** Khởi động toàn bộ ứng dụng NestJS và dùng **Supertest** bắn request HTTP thực tế vào endpoint để kiểm tra toàn bộ luồng.

### 2. Các lệnh chạy test:
\`\`\`bash
pnpm test          # Chạy unit tests
pnpm test:e2e      # Chạy E2E tests
pnpm test:cov      # Xem độ phủ code (coverage)
\`\`\`
        `,
        realCodeSnippet: `// Trích mẫu Unit Test Service
describe('InventoryCategoryService', () => {
  let service: InventoryCategoryService;
  let prisma: DeepMockProxy<PrismaService>;

  it('should return list of categories', async () => {
    prisma.inventoryCategory.findMany.mockResolvedValue([{ id: '1', name: 'VTTH' }]);
    prisma.inventoryCategory.count.mockResolvedValue(1);

    const result = await service.list('u1', { page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});`,
        quiz: [
          {
            id: 'q22-1',
            question: 'Khi viết Unit Test cho Service, tại sao chúng ta nên Mock PrismaService thay vì kết nối vào Database thật?',
            options: [
              'Để test chạy độc lập, siêu nhanh và không làm biến đổi dữ liệu trong database thật',
              'Vì Jest không thể kết nối database',
              'Vì database bị khóa',
              'Không có lý do'
            ],
            correctIndex: 0,
            explanation: 'Mocking giúp unit test chạy nhanh, cô lập và có thể chạy được ở mọi môi trường CI/CD mà không cần database sẵn sàng.'
          }
        ],
        codeChallenge: {
          title: 'Mock Assertion Verification Engine',
          description: 'Viết hàm `verifyServiceCall(mockDb, expectedCallCount)`: kiểm tra `mockDb.callCount === expectedCallCount`. Trả về `true` nếu bằng, ngược lại ném `Error("ASSERTION_FAILED")`.',
          starterCode: `function verifyServiceCall(mockDb, expectedCallCount) {
  // Viết logic assert
  
}`,
          solution: `function verifyServiceCall(mockDb, expectedCallCount) {
  if (mockDb.callCount !== expectedCallCount) {
    throw new Error("ASSERTION_FAILED");
  }
  return true;
}`,
          testCases: [
            {
              name: 'Test Case 1 (Visible): Khớp callCount',
              input: [{ callCount: 2 }, 2],
              expected: true,
              hidden: false
            }
          ]
        }
      }
    ]
  }
];
