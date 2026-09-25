import type { MindMapKnowledgeItem } from './types.ts';

/**
 * Cơ sở tri thức chuyên sâu cho Deep Knowledge Inspector của Sơ đồ tư duy
 */
export const MINDMAP_KNOWLEDGE_BASE: Record<string, MindMapKnowledgeItem> = {
  hub: {
    id: 'hub',
    tierNumber: 'FULLSTACK TAXONOMY',
    tierTitle: 'HỆ THỐNG TOÀN CẢNH ĐA TẦNG',
    tierColor: '#14b8a6',
    nodeTitle: 'Kiến Trúc Phân Tầng Hệ Thống Fullstack (Physical to NestJS)',
    icon: '🧠',
    concept:
      'Sự phối hợp chặt chẽ giữa 4 tầng: Từ xung nhịp bán dẫn phần cứng (1-100ns), quản lý Socket phi chặn của Linux Kernel O(1), động cơ thực thi Libuv & Google V8 JIT, cho tới khung ứng dụng hướng Module Inversion of Control (IoC) của NestJS.',
    specs: [
      { label: 'Phạm vi bao phủ', value: '4 Tầng hoàn chỉnh (Physical -> Kernel -> Runtime -> App)' },
      { label: 'Độ trễ toàn trình', value: 'Từ <1ns (L1 Cache) đến ~1-5ms (REST API Controller)' },
      { label: 'Mô hình luồng', value: '1 Main Loop + 4 Worker Threads + Linux Epoll' },
      { label: 'Tiêu thụ bộ nhớ', value: 'V8 RSS = Stack + Heap + Buffers C++ malloc()' },
    ],
    codeSnippet: `// Vòng đời 1 HTTP Request đi xuyên 4 Tầng:
// 1. Hardware NIC tiếp nhận Ethernet Frame -> Kích hoạt DMA ghi vào RAM
// 2. Linux Kernel ngắt IRQ -> nạp TCP RX Buffer -> Epoll đánh thức tiến trình [FD: 12]
// 3. Libuv Poll Phase nhận socket event -> V8 Main Thread gọi Callback
// 4. NestJS Router phân giải -> ValidationPipe -> Service -> DB Repository`,
    gotchas:
      'Không thể tối ưu mã NestJS ở tầng cao nếu không hiểu rõ cách Node.js tiêu thụ RAM và cách Linux Kernel giao tiếp với Socket. Lập trình viên cấp cao luôn nhìn thấy bức tranh tổng thể đa tầng.',
  },

  // ===== TIER 04: NESTJS APPLICATION FRAMEWORK =====
  't4-root': {
    id: 't4-root',
    tierNumber: 'TIER 04',
    tierTitle: 'TẦNG ỨNG DỤNG DOANH NGHIỆP',
    tierColor: '#8b5cf6',
    nodeTitle: 'NestJS Enterprise Application Framework',
    icon: '🏛️',
    concept:
      'Cung cấp kiến trúc module hóa cấp doanh nghiệp, tự động hóa Dependency Injection (IoC Container), quản lý vòng đời ứng dụng và đóng gói các tầng Controller, Service, Repository chuẩn mực.',
    specs: [
      { label: 'Vòng đời Provider', value: 'Mặc định Singleton (1 instance duy nhất per app)' },
      { label: 'Pipeline Xử lý', value: 'Middleware -> Guards -> Interceptors -> Pipes -> Filters' },
      { label: 'Khung nền tảng', value: 'Express (mặc định) hoặc Fastify (hiệu năng x2)' },
    ],
    codeSnippet: `@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  controllers: [OrderController],
  providers: [OrderService, RedisCacheService],
})
export class OrderModule {}`,
    gotchas:
      'Tuyệt đối tránh chuyển Service sang REQUEST scope trừ khi bắt buộc phải lưu ngữ cảnh đặc thù (như Multi-tenancy động). Request scope tạo instance mới cho mỗi HTTP call, khiến GC V8 quá tải nặng.',
  },

  't4-controllers': {
    id: 't4-controllers',
    tierNumber: 'TIER 04: TRANSPORT',
    tierTitle: 'GIAO DIỆN ĐIỀU HƯỚNG',
    tierColor: '#8b5cf6',
    nodeTitle: 'Controllers & Routers Tier',
    icon: '🎮',
    concept:
      'Điểm tiếp nhận lưu lượng HTTP/REST/WebSocket. Ánh xạ endpoint URL, phân tách headers, query params và điều hướng dữ liệu đến Service xử lý nghiệp vụ.',
    specs: [
      { label: 'Thời gian xử lý', value: '< 0.3ms overhead định tuyến' },
      { label: 'Giao thức hỗ trợ', value: 'HTTP/1.1, HTTP/2, WebSockets, gRPC' },
      { label: 'Binding', value: 'Express Router / Fastify FindMyWay' },
    ],
    codeSnippet: `@Controller('api/v1/orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateOrderDto) {
    return this.orderService.processOrder(dto);
  }
}`,
    gotchas:
      'Viết logic nghiệp vụ hoặc query database trực tiếp trong Controller là vi phạm nghiêm trọng nguyên lý Single Responsibility (SRP). Controller chỉ nên làm nhiệm vụ Input/Output Transport.',
  },

  't4-dto': {
    id: 't4-dto',
    tierNumber: 'TIER 04: VALIDATION',
    tierTitle: 'KIỂM CHỨNG ĐẦU VÀO',
    tierColor: '#8b5cf6',
    nodeTitle: 'DTO & ValidationPipe',
    icon: '🛡️',
    concept:
      'Lớp phòng vệ biên giới ứng dụng. Sử dụng class-validator và class-transformer để kiểm tra kiểu dữ liệu, bắt buộc quy chuẩn payload và lọc bỏ các trường không an toàn (Whitelist).',
    specs: [
      { label: 'Độ an toàn', value: '100% Type-safe tại Runtime' },
      { label: 'Bảo mật', value: 'Chặn Mass Assignment Injection' },
      { label: 'Hiệu năng', value: 'Class transform cache metadata' },
    ],
    codeSnippet: `export class CreateOrderDto {
  @IsUUID()
  customerId: string;

  @IsNumber()
  @Min(1)
  amount: number;
}

// Cấu hình trong main.ts:
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true
}));`,
    gotchas:
      'Dùng TypeScript interface thay vì class cho DTO sẽ khiến validation bị vô hiệu hóa hoàn toàn, vì TypeScript xóa sạch interface sau khi compile sang JavaScript!',
  },

  't4-routes': {
    id: 't4-routes',
    tierNumber: 'TIER 04: PIPELINE',
    tierTitle: 'ĐƯỜNG ỐNG XỬ LÝ',
    tierColor: '#8b5cf6',
    nodeTitle: 'Route Execution Context & Interceptors',
    icon: '⚡',
    concept:
      'Bộ đánh chặn AOP (Aspect-Oriented Programming). Cho phép gắn logic tiền xử lý và hậu xử lý xung quanh lời gọi hàm (như logging thời gian thực thi, cache response, biến đổi output).',
    specs: [
      { label: 'Mô hình luồng', value: 'Dựa trên RxJS Observable streams' },
      { label: 'Timing latency', value: 'Ghi nhận độ trễ request chính xác microsecond' },
      { label: 'Thứ tự thực thi', value: 'Guards -> Interceptors -> Pipes -> Handler' },
    ],
    codeSnippet: `@Injectable()
export class BenchmarkInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = performance.now();
    return next.handle().pipe(
      tap(() => console.log(\`Execution time: \${performance.now() - now}ms\`))
    );
  }
}`,
    gotchas:
      'Quên return Observable từ next.handle() hoặc không quản lý unsubscribe sẽ dẫn đến việc request bị treo vô thời hạn (Request Hanging).',
  },

  't4-services': {
    id: 't4-services',
    tierNumber: 'TIER 04: DOMAIN LOGIC',
    tierTitle: 'NGHIỆP VỤ LÕI',
    tierColor: '#8b5cf6',
    nodeTitle: 'Services & Domain Logic Tier',
    icon: '⚙️',
    concept:
      'Trái tim nghiệp vụ của ứng dụng (Business Core). Chứa các thuật toán xử lý tính toán, luân chuyển dòng tiền, trạng thái đơn hàng. Hoàn toàn phi trạng thái (Stateless).',
    specs: [
      { label: 'Vòng đời', value: 'Singleton (Khởi tạo khi app bootstrap, hủy khi shutdown)' },
      { label: 'Tái sử dụng', value: 'Injectable vào nhiều Controller hoặc Service khác' },
      { label: 'Trạng thái', value: 'Tuyệt đối Stateless để tránh race conditions' },
    ],
    codeSnippet: `@Injectable()
export class OrderService {
  constructor(private readonly orderRepo: OrderRepository) {}

  async processOrder(dto: CreateOrderDto): Promise<OrderResult> {
    // Nghiệp vụ thuần túy, tính toán và lưu DB
    return this.orderRepo.save(dto);
  }
}`,
    gotchas:
      'Khai báo thuộc tính lưu trữ request (như this.userId = dto.userId) trong Service Singleton sẽ gây lỗi kinh điển: Request của người dùng B ghi đè lên dữ liệu người dùng A (Race Condition nguy hiểm).',
  },

  't4-ioc': {
    id: 't4-ioc',
    tierNumber: 'TIER 04: ARCHITECTURE',
    tierTitle: 'NGHỊCH ĐẢO ĐIỀU KHIỂN',
    tierColor: '#8b5cf6',
    nodeTitle: 'IoC Container & Dependency Injection',
    icon: '🔄',
    concept:
      'Bộ chứa quản lý cây phụ thuộc (Dependency Graph). Tự động khởi tạo instance, giải quyết thứ tự tiêm phụ thuộc theo thuật toán Topo sort, loại bỏ việc dùng toán tử new thủ công.',
    specs: [
      { label: 'Thời điểm resolve', value: 'Application Bootstrap Phase' },
      { label: 'Khử phụ thuộc vòng', value: 'forwardRef(() => OtherService)' },
      { label: 'Cơ chế giải quyết', value: 'Directed Acyclic Graph (DAG)' },
    ],
    codeSnippet: `@Injectable()
export class PaymentService {
  constructor(
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService
  ) {}
}`,
    gotchas:
      'Lạm dụng forwardRef() quá nhiều là dấu hiệu cảnh báo kiến trúc module bị kết dính vòng (Circular Dependency), cần xem xét tách sang Domain Event hoặc Module trung gian.',
  },

  't4-repos': {
    id: 't4-repos',
    tierNumber: 'TIER 04: PERSISTENCE',
    tierTitle: 'LƯU TRỮ VÀ BỘ NHỚ ĐỆM',
    tierColor: '#8b5cf6',
    nodeTitle: 'Repositories & Distributed Caching Tier',
    icon: '🗄️',
    concept:
      'Cầu nối dữ liệu bền vững qua TypeORM / Prisma (PostgreSQL) kết hợp lớp đệm phân tán Redis (Cache-Aside pattern) nhằm bảo vệ Database khỏi quá tải khi lưu lượng truy cập cao.',
    specs: [
      { label: 'Connection Pool', value: 'Thường thiết lập 20-50 kết nối / instance' },
      { label: 'Redis Cache Hit', value: 'Độ trễ < 1ms, giảm 90% tải DB' },
      { label: 'Chiến lược Cache', value: 'Cache-Aside + TTL tự động vô hiệu hóa' },
    ],
    codeSnippet: `async getOrder(id: string): Promise<Order> {
  const cached = await this.redis.get(\`order:\${id}\`);
  if (cached) return JSON.parse(cached);

  const order = await this.repo.findOneBy({ id });
  await this.redis.set(\`order:\${id}\`, JSON.stringify(order), 'EX', 300);
  return order;
}`,
    gotchas:
      'Không giới hạn max connection trong DB Pool dẫn đến sập cơ sở dữ liệu PostgreSQL vì tràn số lượng backend processes (FATAL: remaining connection slots are reserved).',
  },

  // ===== TIER 03: NODE.JS RUNTIME ENGINE =====
  't3-root': {
    id: 't3-root',
    tierNumber: 'TIER 03',
    tierTitle: 'TẦNG RUNTIME CẤP THẤP',
    tierColor: '#0284c7',
    nodeTitle: 'Node.js Runtime Engine (Libuv & Google V8)',
    icon: '🔄',
    concept:
      'Tầng động cơ thực thi mã JavaScript: Google V8 biên dịch mã máy JIT và quản lý bộ nhớ, kết hợp Libuv cung cấp kiến trúc I/O bất đồng bộ phi chặn (Non-blocking I/O).',
    specs: [
      { label: 'Mô hình luồng', value: 'Single-threaded Event Loop + 4 Worker Threads' },
      { label: 'Dung lượng Heap mặc định', value: '~1.4GB trên máy chủ 64-bit' },
      { label: 'Cầu nối hệ thống', value: 'Node.js C++ Addons & POSIX Syscalls' },
    ],
    codeSnippet: `// Khởi động Node.js với giám sát GC và giới hạn RAM:
node --max-old-space-size=4096 --trace-gc dist/main.js`,
    gotchas:
      'Chạy tác vụ tính toán nặng (JSON.parse file 200MB, regex catastrophic backtracking) làm đơ hoàn toàn Event Loop, khiến mọi request khác bị treo.',
  },

  't3-libuv': {
    id: 't3-libuv',
    tierNumber: 'TIER 03: I/O ENGINE',
    tierTitle: 'ĐỘNG CƠ BẤT ĐỒNG BỘ',
    tierColor: '#0284c7',
    nodeTitle: 'Libuv Asynchronous Engine Core',
    icon: '⚡',
    concept:
      'Thư viện C đa nền tảng điều phối toàn bộ sự kiện I/O, quản lý vòng lặp Event Loop 6 pha và điều phối Threadpool cho các tác vụ blocking hệ điều hành.',
    specs: [
      { label: 'Nền tảng I/O', value: 'Epoll (Linux), Kqueue (macOS), IOCP (Windows)' },
      { label: 'Threadpool mặc định', value: '4 Threads (UV_THREADPOOL_SIZE)' },
      { label: 'Độ trễ chuyển mạch', value: '< 1 microsecond trong Poll phase' },
    ],
    codeSnippet: `// Điều chỉnh kích thước threadpool trong môi trường:
process.env.UV_THREADPOOL_SIZE = '16';
// Xử lý song song 16 tác vụ crypto / fs cùng lúc`,
    gotchas:
      'Nhầm tưởng Node.js chạy đa luồng toàn bộ code: Chỉ có fs, crypto, zlib, dns.lookup chạy trong threadpool, toàn bộ logic JS chạy trên 1 luồng chính!',
  },

  't3-loop': {
    id: 't3-loop',
    tierNumber: 'TIER 03: EVENT LOOP',
    tierTitle: 'VÒNG LẶP SỰ KIỆN',
    tierColor: '#0284c7',
    nodeTitle: 'Event Loop (1 Main Thread - 6 Phases)',
    icon: '🔁',
    concept:
      'Vòng lặp tuần hoàn 1 luồng chính duyệt qua các hàng đợi callback theo thứ tự: Timers (setTimeout/setInterval) -> Pending I/O -> Idle/Prepare -> Poll (I/O) -> Check (setImmediate) -> Close.',
    specs: [
      { label: 'Thứ tự ưu tiên', value: 'Microtasks (nextTick, Promise) xả hết sau mỗi pha' },
      { label: 'Thời gian dừng Poll', value: 'Tự động tính toán theo timer gần nhất' },
      { label: 'Độ trễ Check phase', value: 'setImmediate chạy ngay sau Poll hoàn tất' },
    ],
    codeSnippet: `// So sánh thứ tự thực thi trong 1 Tick:
setImmediate(() => console.log('Check Phase'));
setTimeout(() => console.log('Timers Phase'), 0);
process.nextTick(() => console.log('Microtask (Ưu tiên số 1)'));`,
    gotchas:
      'Lạm dụng đệ quy process.nextTick() sẽ làm đói (starvation) hoàn toàn hàng đợi I/O, khiến server không tiếp nhận thêm bất kỳ kết nối nào từ bên ngoài.',
  },

  't3-threads': {
    id: 't3-threads',
    tierNumber: 'TIER 03: WORKER POOL',
    tierTitle: 'BỂ LUỒNG NỀN TẢNG',
    tierColor: '#0284c7',
    nodeTitle: 'Libuv Worker Threadpool (4 Threads)',
    icon: '🧵',
    concept:
      'Bể luồng nền C++ xử lý các tác vụ blocking không thể dùng Epoll phi chặn của Linux (như file system POSIX synchronous syscalls, pbkdf2 băm mật khẩu, DNS lookup).',
    specs: [
      { label: 'Kích thước mặc định', value: '4 Threads' },
      { label: 'Kích thước tối đa', value: '1024 Threads (tùy chỉnh UV_THREADPOOL_SIZE)' },
      { label: 'Tác vụ sử dụng', value: 'fs.*, crypto.*, zlib.*, dns.lookup' },
    ],
    codeSnippet: `// Khi 5 request băm password đến cùng lúc với pool = 4:
// Request 1-4 chạy song song trên 4 threads
// Request 5 phải chờ trong Queue -> latency tăng gấp đôi!`,
    gotchas:
      'Gọi đồng thời 5 tác vụ crypto.pbkdf2 với pool 4 thread sẽ khiến tác vụ thứ 5 bị xếp hàng chờ, tăng gấp đôi độ trễ.',
  },

  't3-v8': {
    id: 't3-v8',
    tierNumber: 'TIER 03: V8 ENGINE',
    tierTitle: 'ĐỘNG CƠ GOOGLE V8',
    tierColor: '#0284c7',
    nodeTitle: 'V8 Memory Architecture (Stack & Heap)',
    icon: '🚀',
    concept:
      'Cấu trúc không gian bộ nhớ của V8 gồm Stack Space (ngăn xếp thực thi theo LIFO) và Heap Space (vùng nhớ động quản lý bằng các thuật toán Garbage Collection).',
    specs: [
      { label: 'Stack Memory', value: '1MB per thread, 0% GC overhead' },
      { label: 'Young Generation', value: '16MB - 64MB (Scavenge GC)' },
      { label: 'Old Generation', value: '~1.4GB+ (Mark-Sweep-Compact)' },
    ],
    codeSnippet: `import v8 from 'v8';
const heapStats = v8.getHeapStatistics();
console.log('Heap Limit:', heapStats.heap_size_limit / 1024 / 1024, 'MB');`,
    gotchas:
      'Closures tham chiếu biến lớn không được giải phóng sẽ bị đẩy từ Young Gen lên Old Gen, gây rò rỉ bộ nhớ dài hạn.',
  },

  't3-stack': {
    id: 't3-stack',
    tierNumber: 'TIER 03: MEMORY',
    tierTitle: 'NGĂN XẾP THỰC THI',
    tierColor: '#0284c7',
    nodeTitle: 'V8 Stack Space (Call Frames & Primitives)',
    icon: '🥞',
    concept:
      'Lưu trữ các khung gọi hàm (Call Frames), con trỏ địa chỉ 64-bit và các biến kiểu nguyên thủy. Giải phóng tức thì khi hàm kết thúc mà không cần GC can thiệp.',
    specs: [
      { label: 'Chi phí dọn rác', value: '0% GC Overhead (CPU di chuyển Stack Pointer)' },
      { label: 'Độ trễ giải phóng', value: '0 nanoseconds' },
      { label: 'Giới hạn', value: '~10,000 recursive frames' },
    ],
    codeSnippet: `// Chạy 100% trên Stack - Tốc độ tối đa, không tốn Heap:
function calculateTotal(price: number, qty: number): number {
  const tax = price * 0.1;
  return (price + tax) * qty;
}`,
    gotchas:
      'Đệ quy vô tận hoặc đệ quy quá sâu gây ra lỗi kinh điển: RangeError: Maximum call stack size exceeded.',
  },

  't3-heap': {
    id: 't3-heap',
    tierNumber: 'TIER 03: GARBAGE COLLECTOR',
    tierTitle: 'VÙNG NHỚ ĐỘNG VÀ DỌN RÁC',
    tierColor: '#0284c7',
    nodeTitle: 'V8 Heap Space (Young & Old Generation)',
    icon: '🌱',
    concept:
      'Young Generation dùng Scavenge (From/To Space) dọn rác cực nhanh (~1ms). Các Object sống sót sau 2 chu kỳ sẽ chuyển lên Old Generation (dùng Mark-Sweep-Compact nặng CPU).',
    specs: [
      { label: 'Young Scavenge GC', value: '~1ms (Chỉ copy objects còn sống)' },
      { label: 'Old Mark-Sweep GC', value: 'Vài chục đến hàng trăm ms (Stop-The-World)' },
      { label: 'Tần suất', value: 'Young GC chạy liên tục, Old GC chạy định kỳ' },
    ],
    codeSnippet: `// Giám sát dung lượng Heap trong Runtime:
const mem = process.memoryUsage();
console.log('Heap Used:', Math.round(mem.heapUsed / 1024 / 1024), 'MB');
console.log('Heap Total:', Math.round(mem.heapTotal / 1024 / 1024), 'MB');`,
    gotchas:
      'Rò rỉ bộ nhớ trong Old Gen làm Full GC chạy liên tục, tiêu tốn 100% CPU và cuối cùng dính FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory.',
  },

  't3-buffers': {
    id: 't3-buffers',
    tierNumber: 'TIER 03: EXTERNAL MEMORY',
    tierTitle: 'BỘ NHỚ NGOÀI HEAP',
    tierColor: '#0284c7',
    nodeTitle: 'C++ Non-Heap & Node.js Buffers malloc()',
    icon: '📦',
    concept:
      'Vùng nhớ cấp phát ngoài Heap V8 thông qua hàm malloc() của hệ điều hành, được bọc bởi Node.js Buffer API để truyền tải dữ liệu Stream, File, Network Socket.',
    specs: [
      { label: 'Giới hạn kích thước', value: 'Không bị giới hạn bởi --max-old-space-size' },
      { label: 'Cấp phát', value: 'Trực tiếp qua libc malloc() của OS' },
      { label: 'Đặc tính', value: 'Zero-copy khi truyền qua Network Socket' },
    ],
    codeSnippet: `// Cấp phát 10MB bộ nhớ ngoài V8 Heap:
const buffer = Buffer.allocUnsafe(10 * 1024 * 1024);
// Bộ nhớ này tính vào RSS, nhưng không nằm trong Heap!`,
    gotchas:
      'Cấp phát Buffer liên tục mà quên hủy tham chiếu có thể làm cạn kiệt RAM hệ điều hành (RSS tăng vọt) dù V8 Heap báo cáo vẫn rất thấp!',
  },

  // ===== TIER 02: LINUX OS KERNEL =====
  't2-root': {
    id: 't2-root',
    tierNumber: 'TIER 02',
    tierTitle: 'TẦNG NHÂN HỆ ĐIỀU HÀNH',
    tierColor: '#16a34a',
    nodeTitle: 'Linux OS Kernel & Socket Multiplexing',
    icon: '🐧',
    concept:
      'Lõi nhân Linux quản lý tài nguyên phần cứng, lập lịch tiến trình, cung cấp các hàm gọi hệ thống (Syscalls) và điều phối mạng thông qua Socket Multiplexing phi chặn.',
    specs: [
      { label: 'Cơ chế giám sát Socket', value: 'Epoll (Linux), Kqueue (BSD/macOS) O(1)' },
      { label: 'Giới hạn File Descriptors', value: 'ulimit -n 65535 (khuyên dùng)' },
      { label: 'Quản lý bộ nhớ ảo', value: 'Virtual Memory Paging (4KB Pages)' },
    ],
    codeSnippet: `# Kiểm tra giới hạn file descriptors của hệ điều hành:
ulimit -n
# Điều chỉnh giới hạn cho tải cao:
sysctl -w fs.file-max=2097152`,
    gotchas:
      'Cấu hình mặc định của Linux thường chỉ cho phép 1024 file descriptors mỗi process (ulimit -n 1024), gây lỗi EMFILE: too many open files khi có trên 1000 kết nối đồng thời.',
  },

  't2-sockets': {
    id: 't2-sockets',
    tierNumber: 'TIER 02: NETWORKING',
    tierTitle: 'MẠNG & KẾT NỐI SOCKET',
    tierColor: '#16a34a',
    nodeTitle: 'Linux Sockets & File Descriptor Table',
    icon: '📑',
    concept:
      'Mọi kết nối mạng TCP trong Linux đều được biểu diễn như một File Descriptor (FD). Cổng 3000 được gán một số nguyên FD với cờ phi chặn O_NONBLOCK để Libuv lắng nghe.',
    specs: [
      { label: 'Cờ socket', value: 'O_NONBLOCK (Phi chặn luồng gọi)' },
      { label: 'Bảng quản lý', value: 'Process File Descriptor Table' },
      { label: 'Độ phức tạp tra cứu', value: 'O(1) theo chỉ mục FD' },
    ],
    codeSnippet: `// Đại diện cấu trúc POSIX trong Kernel:
// int socket_fd = socket(AF_INET, SOCK_STREAM, 0);
// fcntl(socket_fd, F_SETFL, O_NONBLOCK);`,
    gotchas:
      'Không đóng socket hoặc file stream bị bỏ quên sẽ làm rò rỉ File Descriptor cho đến khi cạn kiệt bảng chỉ mục FD của process.',
  },

  't2-fd': {
    id: 't2-fd',
    tierNumber: 'TIER 02: DESCRIPTORS',
    tierTitle: 'BẢNG CHỈ MỤC FILE',
    tierColor: '#16a34a',
    nodeTitle: 'File Descriptor Table [FD: 12] (O_NONBLOCK)',
    icon: '🔢',
    concept:
      'Mỗi tiến trình có một bảng mảng con trỏ trỏ tới cấu trúc file/socket của kernel. 0 là stdin, 1 là stdout, 2 là stderr, các socket TCP được đánh số từ 3 trở lên.',
    specs: [
      { label: 'Tra cứu', value: 'O(1) Direct Array Lookup' },
      { label: 'Phạm vi', value: '0 đến ulimit -n' },
    ],
    codeSnippet: `ls -l /proc/<PID>/fd
# Hiển thị tất cả sockets và files đang mở bởi tiến trình Node.js`,
    gotchas:
      'Rò rỉ FD không làm tăng RAM ngay lập tức nhưng sẽ khiến server đột ngột từ chối mọi kết nối mới.',
  },

  't2-buffers': {
    id: 't2-buffers',
    tierNumber: 'TIER 02: TCP STACK',
    tierTitle: 'HÀNG ĐỢI ĐỆM KERNEL TCP',
    tierColor: '#16a34a',
    nodeTitle: 'Kernel TCP Buffers (Receive & Send Queues)',
    icon: '📥',
    concept:
      'Hàng đợi đệm của giao thức TCP nằm trong kernel space. Nhận gói tin mạng từ NIC qua DMA controller và lưu đệm trước khi tiến trình gọi read() / recv().',
    specs: [
      { label: 'Kích thước mặc định', value: 'rmem_default (~212KB)' },
      { label: 'Kích thước tối đa', value: 'rmem_max (Có thể điều chỉnh lên 4-8MB)' },
      { label: 'Cơ chế điều khiển', value: 'TCP Window Sliding & Flow Control' },
    ],
    codeSnippet: `# Điều chỉnh kích thước buffer TCP trong Kernel:
sysctl -w net.ipv4.tcp_rmem="4096 87380 6291456"
sysctl -w net.ipv4.tcp_wmem="4096 65536 6291456"`,
    gotchas:
      'Nếu ứng dụng Node.js xử lý quá chậm khiến Receive Queue bị tràn (Buffer Overflow), TCP sẽ hạ TCP Window Size về 0 hoặc làm drop packet, gây retransmission liên tục.',
  },

  't2-multiplexing': {
    id: 't2-multiplexing',
    tierNumber: 'TIER 02: MULTIPLEXING',
    tierTitle: 'ĐA KÊNH HÓA I/O',
    tierColor: '#16a34a',
    nodeTitle: 'Epoll & I/O Multiplexing System',
    icon: '🎯',
    concept:
      'Cơ chế giám sát I/O đa kênh tối ưu của Linux (Kqueue trên BSD/macOS). Giám sát hàng chục nghìn Socket đồng thời với độ phức tạp O(1) nhờ cấu trúc Red-Black Tree và Ready List.',
    specs: [
      { label: 'Độ phức tạp', value: 'O(1) Bất kể 100 hay 100,000 kết nối' },
      { label: 'Cấu trúc dữ liệu', value: 'Red-Black Tree (đăng ký) + Doubly Linked List (Ready List)' },
      { label: 'Hàm kích hoạt', value: 'epoll_create1, epoll_ctl, epoll_wait' },
    ],
    codeSnippet: `// Trực quan hóa Epoll:
// Khi có dữ liệu gửi đến socket:
// Kernel thêm FD vào Ready List -> epoll_wait() lập tức trả về FD đó cho Libuv`,
    gotchas:
      'Cơ chế cũ select() và poll() có độ phức tạp O(N), phải duyệt toàn bộ mảng socket nên sụp đổ hiệu năng khi số lượng kết nối tăng cao.',
  },

  't2-epoll': {
    id: 't2-epoll',
    tierNumber: 'TIER 02: EPOLL CORE',
    tierTitle: 'EPOLL O(1) ENGINE',
    tierColor: '#16a34a',
    nodeTitle: 'Epoll / Kqueue (10K+ Sockets O(1) Demux)',
    icon: '⚡',
    concept:
      'Giải pháp cho bài toán C10K huyền thoại. Không tốn CPU quét các socket rảnh rỗi; chỉ đánh thức tiến trình Node.js khi có socket thực sự có dữ liệu đến.',
    specs: [
      { label: 'Sức chứa', value: 'Hàng trăm nghìn kết nối đồng thời' },
      { label: 'Độ trễ đánh thức', value: '< 2 microseconds' },
    ],
    codeSnippet: `// Libuv mapping sang epoll_wait:
int nfds = epoll_wait(epoll_fd, events, MAX_EVENTS, timeout);
for (int i = 0; i < nfds; ++i) {
  // Kích hoạt callback JavaScript tương ứng
}`,
    gotchas:
      'Epoll Edge-Triggered (EPOLLET) yêu cầu đọc cạn kiệt buffer bằng vòng lặp while(read > 0), nếu không sẽ bị kẹt dữ liệu vĩnh viễn.',
  },

  't2-paging': {
    id: 't2-paging',
    tierNumber: 'TIER 02: VIRTUAL MEMORY',
    tierTitle: 'BỘ NHỚ ẢO VÀ PHÂN TRANG',
    tierColor: '#16a34a',
    nodeTitle: 'Virtual Memory, Page Tables & RSS Guard',
    icon: '🗺️',
    concept:
      'Hệ thống bộ nhớ ảo phân trang (Paging) ánh xạ địa chỉ ảo sang RAM vật lý qua MMU và bảng Page Table. Quản trị Resident Set Size (RSS) và kích hoạt OOM Killer khi máy chủ cạn RAM.',
    specs: [
      { label: 'Kích thước trang', value: '4KB chuẩn (hoặc 2MB HugePages)' },
      { label: 'Resident Set Size (RSS)', value: 'Dung lượng RAM vật lý thực tế đang chiếm dụng' },
      { label: 'Cơ chế phòng ngừa', value: 'Linux OOM Killer (Out Of Memory Killer)' },
    ],
    codeSnippet: `# Kiểm tra thông tin bộ nhớ chi tiết của tiến trình:
cat /proc/<PID>/status | grep -E "VmRSS|VmSize|VmSwap"`,
    gotchas:
      'RAM vật lý hết sẽ kích hoạt Linux OOM Killer (Out Of Memory Killer) âm thầm gửi tín hiệu SIGKILL (kill -9) hạ gục ngay tiến trình Node.js mà không để lại unhandled exception trong code.',
  },

  // ===== TIER 01: PHYSICAL HARDWARE LAYER =====
  't1-root': {
    id: 't1-root',
    tierNumber: 'TIER 01',
    tierTitle: 'TẦNG VẬT LÝ & PHẦN CỨNG',
    tierColor: '#d97706',
    nodeTitle: 'Physical Hardware Infrastructure (1 - 100ns)',
    icon: '⚡',
    concept:
      'Nền tảng phần cứng cơ sở hạ tầng thực tế gồm CPU x86_64 / ARM64, đường truyền RAM Bus, ổ đĩa lưu trữ NVMe và Card mạng Ethernet 10Gbps.',
    specs: [
      { label: 'Xung nhịp CPU', value: '2.5 - 5.0 GHz' },
      { label: 'Độ trễ phần cứng', value: '1ns (L1) -> 50ns (RAM) -> 10μs (SSD/NIC)' },
      { label: 'Kiến trúc Bus', value: 'PCIe 4.0 / 5.0 x16 & Memory Bus DDR4/DDR5' },
    ],
    codeSnippet: `# Kiểm tra thông tin kiến trúc phần cứng hệ thống:
lscpu
dmidecode -t memory`,
    gotchas:
      'Phần mềm dù viết tối ưu đến đâu cũng không thể vượt qua giới hạn vật lý của độ trễ truy xuất phần cứng (Hardware Latency Floor).',
  },

  't1-cpu': {
    id: 't1-cpu',
    tierNumber: 'TIER 01: PROCESSOR',
    tierTitle: 'BỘ XỬ LÝ TRUNG TÂM',
    tierColor: '#d97706',
    nodeTitle: 'CPU Cores & Cache Hierarchy (L1, L2, L3)',
    icon: '🧠',
    concept:
      'Các lõi tính toán vật lý xung nhịp GHz kết hợp cấu trúc phân cấp bộ đệm siêu tốc: L1 Cache (~1ns, 64KB), L2 Cache (~3-4ns, 512KB-1MB), L3 Cache (~10-12ns, chia sẻ chung nhiều MB).',
    specs: [
      { label: 'L1 Cache Latency', value: '~1 nanosecond (~4 chu kỳ CPU clock)' },
      { label: 'L2 Cache Latency', value: '~3 - 4 nanoseconds (~12 chu kỳ)' },
      { label: 'L3 Cache Latency', value: '~10 - 15 nanoseconds (~40 chu kỳ)' },
    ],
    codeSnippet: `// Tối ưu CPU Cache Locality (Spatial Locality):
// Duyệt mảng tuần tự tận dụng CPU Cache Line 64-byte:
for (let i = 0; i < len; i++) { sum += arr[i]; }`,
    gotchas:
      'Dữ liệu phân tán ngẫu nhiên trên Heap làm tăng tỷ lệ Cache Miss, buộc CPU phải chờ hàng trăm chu kỳ xung nhịp để kéo dữ liệu từ RAM vật lý về.',
  },

  't1-l1l2l3': {
    id: 't1-l1l2l3',
    tierNumber: 'TIER 01: CACHE HIERARCHY',
    tierTitle: 'PHÂN CẤP BỘ NHỚ ĐỆM',
    tierColor: '#d97706',
    nodeTitle: 'CPU L1/L2/L3 Cache (1 - 10ns Clock)',
    icon: '⚡',
    concept:
      'Cầu nối tốc độ giữa CPU Cores và RAM Bus. L1i (Lệnh) và L1d (Dữ liệu) nằm sát ALU tính toán nhất, giúp loại bỏ hoàn toàn độ trễ kéo dữ liệu từ RAM.',
    specs: [
      { label: 'Kích thước Cache Line', value: '64 Bytes tiêu chuẩn' },
      { label: 'Tốc độ so với RAM', value: 'Nhanh hơn RAM từ 10x đến 100x lần' },
    ],
    codeSnippet: `// Mô phỏng chênh lệch tốc độ:
// L1 Cache: 1ns (Tương đương 1 giây của con người)
// RAM chính: 100ns (Tương đương 1.5 phút chờ đợi!)`,
    gotchas:
      'Dính Cache Invalidation do nhiều luồng tranh chấp cùng 1 Cache Line (False Sharing) làm tụt hiệu năng CPU trầm trọng.',
  },

  't1-pipeline': {
    id: 't1-pipeline',
    tierNumber: 'TIER 01: EXECUTION PIPELINE',
    tierTitle: 'ĐƯỜNG ỐNG LỆNH',
    tierColor: '#d97706',
    nodeTitle: 'Branch Predictor & Instructions Pipeline',
    icon: '🎯',
    concept:
      'Khối dự đoán rẽ nhánh phần cứng trong CPU. Đoán trước kết quả của câu lệnh if/else để nạp trước lệnh vào pipeline, duy trì IPC (Instructions Per Cycle) cao.',
    specs: [
      { label: 'Độ chính xác dự đoán', value: '> 95% trên các CPU hiện đại' },
      { label: 'Hình phạt đoán sai (Mispredict)', value: 'Mất 15-20 chu kỳ xung nhịp (Pipeline Flush)' },
    ],
    codeSnippet: `// V8 TurboFan biên dịch JIT tối ưu hóa theo Branch Predictor:
// Mã nguồn có kiểu dữ liệu nhất quán (Monomorphic)
// giúp CPU dự đoán rẽ nhánh chính xác gần như 100%`,
    gotchas:
      'Hàm đa hình (Megamorphic - nhận vào quá nhiều cấu trúc object khác nhau) khiến V8 bail out về bytecode thông dịch và gây bão Branch Misprediction ở phần cứng.',
  },

  't1-io-bus': {
    id: 't1-io-bus',
    tierNumber: 'TIER 01: BUS & I/O',
    tierTitle: 'BĂNG THÔNG BUS VẬT LÝ',
    tierColor: '#d97706',
    nodeTitle: 'RAM Bus Vật Lý & Thiết Bị Ngoại Vi I/O',
    icon: '💾',
    concept:
      'Băng thông bộ nhớ chính truyền dẫn dữ liệu giữa CPU Memory Controller và các thanh RAM qua các kênh Dual/Quad-Channel kết hợp các thiết bị ngoại vi PCIe NVMe SSD và Card mạng NIC 10Gbps.',
    specs: [
      { label: 'Độ trễ RAM Bus', value: '50 - 100 nanoseconds' },
      { label: 'Băng thông RAM', value: '25 - 60 GB/s per channel' },
      { label: 'Độ trễ NVMe / NIC', value: '10 - 100 microseconds' },
    ],
    codeSnippet: `// DMA (Direct Memory Access):
// Card mạng NIC 10Gbps ghi gói tin trực tiếp vào RAM Buffer
// mà không cần CPU tiêu tốn chu kỳ xung nhịp trung gian!`,
    gotchas:
      'Phân mảnh bộ nhớ vật lý khiến Kernel phải kích hoạt kswapd hoặc defragmentation, gây độ trễ ngẫu nhiên (Latency Jitter) cho các HTTP request.',
  },

  't1-ram': {
    id: 't1-ram',
    tierNumber: 'TIER 01: SYSTEM MEMORY',
    tierTitle: 'BỘ NHỚ RAM VẬT LÝ',
    tierColor: '#d97706',
    nodeTitle: 'RAM Bus DDR4/DDR5 (~50 - 100ns)',
    icon: '🧠',
    concept:
      'Bộ nhớ truy xuất ngẫu nhiên động (DRAM). Cần các chu kỳ refresh tụ điện liên tục. Là nơi cư trú của toàn bộ tiến trình Node.js (RSS).',
    specs: [
      { label: 'Chuẩn bộ nhớ', value: 'DDR4 3200MHz / DDR5 5600MHz' },
      { label: 'CAS Latency', value: 'CL16 - CL36 (~10-15ns CAS time)' },
    ],
    codeSnippet: `free -h
# Hiển thị tổng dung lượng RAM vật lý, vùng nhớ đệm Buffers/Cache`,
    gotchas:
      'Khi RAM vật lý cạn kiệt, hệ điều hành buộc phải Swap dữ liệu sang ổ đĩa SSD khiến độ trễ tăng vọt từ 50ns lên 50,000ns (chậm gấp 1000 lần)!',
  },

  't1-nvme-nic': {
    id: 't1-nvme-nic',
    tierNumber: 'TIER 01: PERIPHERALS',
    tierTitle: 'THIẾT BỊ NGOẠI VI TỐC ĐỘ CAO',
    tierColor: '#d97706',
    nodeTitle: 'NVMe SSD PCIe 4.0 & Card Mạng NIC 10Gbps',
    icon: '🌐',
    concept:
      'Thiết bị lưu trữ thể rắn NVMe giao tiếp qua bus PCIe 4.0 x4 đạt hàng triệu IOPS, kết hợp Network Interface Card 10Gbps xử lý hàng chục triệu gói tin mỗi giây.',
    specs: [
      { label: 'Tốc độ NIC', value: '10Gbps (~1.25 GB/s wire speed)' },
      { label: 'NVMe IOPS', value: 'Lên tới 1,000,000 IOPS ngẫu nhiên' },
      { label: 'Giao tiếp', value: 'DMA Controllers + Hardware Interrupts (IRQ)' },
    ],
    codeSnippet: `// Gói tin từ cáp quang vào NIC:
// NIC Chip -> PCIe Bus -> DMA Controller -> RAM Ring Buffer -> CPU IRQ`,
    gotchas:
      'Không cấu hình IRQ Affinity để phân bổ ngắt mạng đều ra các CPU Cores khiến Core 0 bị nghẽn 100% do xử lý SoftIRQ mạng, trong khi các Core khác đang rảnh rỗi.',
  },
};
