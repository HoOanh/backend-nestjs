import type { Lesson } from '../types.ts';

export const c4_l2: Lesson = {
  id: 'c4-l2',
  title: 'Bài 03: NestJS Request Lifecycle Pipeline: Middleware -> Guard -> Interceptor -> Pipe -> Filter',
  duration: '60 phút',
  tag: 'Execution Pipeline & Filters',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Kiến trúc Đường ống Thực thi Yêu cầu (Request Execution Pipeline) và Lập trình Hướng Khía cạnh (Aspect-Oriented Programming - AOP) trong \`@nestjs/core\` cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Kiến trúc Đường ống Thực thi 5 Tầng (\`Middleware\` $\rightarrow$ \`Guard\` $\rightarrow$ \`Interceptor\` $\rightarrow$ \`Pipe\` $\rightarrow$ \`Filter\`) và Ngữ cảnh Đa giao thức \`ExecutionContext\`:** Hiểu rõ lý do kỹ thuật khiến chuỗi \`Express Middleware\` truyền thống thất bại trong việc đọc siêu dữ liệu phân quyền; nắm vững cấu trúc kế thừa \`ArgumentsHost\` $\rightarrow$ \`ExecutionContext\` và cơ chế hợp nhất siêu dữ liệu qua \`Reflector.getAllAndOverride()\`.
> 2. **Cơ chế Can thiệp Hai chiều của \`RxJS Interceptor\`, Kiểm định Payload trong \`ValidationPipe\` và Quy tắc Ngắt mạch Ngoại lệ:** Phân tích luồng \`Observable\` trước và sau khi gọi \`CallHandler.handle()\`, chi phí biến đổi kiểu của \`class-transformer\`, và quy trình nhảy cóc thẳng tới \`ExceptionFilter\` khi một trạm kiểm soát ném lỗi.
> 3. **Cơ chế Đăng ký Toàn cục Có Tiêm Phụ thuộc (\`APP_GUARD\`, \`APP_INTERCEPTOR\`, \`APP_PIPE\`, \`APP_FILTER\`) và Chẩn đoán Sự cố Production:** Phân biệt sự khác biệt vùng nhớ giữa \`app.useGlobal*()\` trong \`main.ts\` và đăng ký Token \`APP_*\` trong \`Module\`; nắm vững quy tắc đảo ngược thứ tự của \`Exception Filters\` và kỹ thuật chuẩn hóa phản hồi/lỗi.

---

# 1. KIẾN TRÚC CHUỖI ĐƯỜNG ỐNG THỰC THI 5 TẦNG (5-STAGE EXECUTION PIPELINE) VÀ TRỪU TƯỢNG HÓA ĐA GIAO THỨC EXECUTIONCONTEXT

### 1.1 Khái niệm nền tảng: Hạn chế của Chuỗi Express Middleware và Sự phân tách Trách nhiệm 5 Tầng trong NestJS

Trong các khung làm việc thế hệ cũ như \`Express.js\` hoặc \`Koa\`, toàn bộ các mối bận tâm cắt ngang hệ thống (**\`Cross-Cutting Concerns\`** như ghi nhật ký, xác thực danh tính, phân quyền vai trò, kiểm tra định dạng dữ liệu đầu vào và định dạng chuẩn đầu ra) đều bị dồn chung vào một khái niệm duy nhất là **Hàm Trung gian Tuyến tính (\`Middleware: (req, res, next) => void\`)**. Khi hệ thống mở rộng lên hàng trăm điểm cuối (\`Endpoints\`) và đa giao thức (\`HTTP REST\`, \`gRPC\`, \`WebSockets\`, \`Kafka Consumer\`), mô hình Middleware thuần túy bộc lộ 3 điểm mù kiến trúc không thể khắc phục:

1. **Điểm mù Ngữ nghĩa Định tuyến (\`Routing Context Blindness\`):**
   Hàm \`Middleware\` của Express chạy **trước khi** bộ định tuyến của ứng dụng xác định được hàm xử lý đích (\`Target Controller & Route Handler Method\`). Khi đứng bên trong \`Middleware\`, bạn chỉ có đối tượng \`req.url\` thô và **hoàn toàn không biết yêu cầu này sắp đi vào lớp \`Controller\` nào hay phương thức nào**, dẫn tới việc không thể đọc được các siêu dữ liệu khai báo bằng Decorator trên phương thức đích (như \`@Roles('ADMIN')\`, \`@Public()\`, \`@RateLimit(10)\`)!
2. **Sự bất lực trong Can thiệp Hai chiều (\`Lack of Two-Way AOP Wrapping\`):**
   Khi \`Middleware\` gọi hàm \`next()\`, nó trao quyền điều khiển đi tiếp nhưng không nhận lại được một luồng dữ liệu trả về chuẩn hóa từ \`Controller\`. Để biến đổi kết quả JSON trả về hoặc đo chính xác thời gian thực thi của riêng hàm \`Controller\`, lập trình viên Express buộc phải dùng thủ thuật ghi đè hàm gốc \`res.send = ...\` (\`Monkey-Patching\`) cực kỳ dễ phát sinh lỗi rò rỉ bộ nhớ và xung đột thư viện.
3. **Sự trói buộc Cứng vào Giao thức HTTP (\`Protocol Lock-in\`):**
   Chữ ký hàm \`(req: Request, res: Response, next: NextFunction)\` gắn chết vào giao thức HTTP của Express/Fastify. Khi doanh nghiệp chuyển cùng một hàm nghiệp vụ sang nhận bản tin từ \`RabbitMQ\`, \`Kafka\` hoặc \`gRPC\`, toàn bộ logic phân quyền và kiểm tra dữ liệu viết trong Express Middleware đều bị vô hiệu hóa!

Để giải quyết triệt để cả 3 bài toán trên, \`@nestjs/core\` chia nhỏ chu trình xử lý yêu cầu thành một **Đường ống Thực thi 5 Tầng Chuyên biệt (\`5-Stage Execution Pipeline\`)** tuân thủ nghiêm ngặt Nguyên lý Đơn trách nhiệm (\`Single Responsibility Principle\`):
- **Tầng 1 — \`Middleware\` (Tiền xử lý Mạng Thô):** Chạy trước khi định tuyến; chỉ dùng cho các tác vụ cấp giao thức HTTP như \`CORS\`, \`Helmet\`, nén \`Compression\`, khởi tạo \`AsyncLocalStorage\` hoặc gán mã vết \`x-correlation-id\`.
- **Tầng 2 — \`Guards\` (Chốt chặn Xác thực & Phân quyền — \`CanActivate\`):** Chạy ngay sau khi đã xác định được \`Controller\` và \`Handler\` đích; có toàn quyền truy cập \`ExecutionContext\` và \`Reflector\` để đọc siêu dữ liệu \`@Roles()\` và quyết định cho phép (\`true\`) hay từ chối ngay lập tức (\`false\` $\rightarrow$ ném \`403 ForbiddenException\`).
- **Tầng 3 — \`Interceptors\` (Lập trình Hướng Khía cạnh — \`NestInterceptor\`):** Bao bọc hai chiều xung quanh lời gọi hàm nhờ luồng **\`RxJS Observable\`**; thực thi logic **trước khi** vào \`Pipe/Controller\` và biến đổi dữ liệu trả về, bộ nhớ đệm (\`Caching\`), hoặc áp đặt thời gian chờ (\`Timeout\`) **sau khi** \`Controller\` hoàn tất.
- **Tầng 4 — \`Pipes\` (Chuyển đổi Kiểu & Kiểm định Dữ liệu — \`PipeTransform\`):** Chạy ngay sát trước khi truyền đối số vào hàm \`Controller\`; chuyên trách ép kiểu (\`ParseIntPipe\`, \`ParseUUIDPipe\`) và kiểm định tính toàn vẹn của \`DTO\` (\`ValidationPipe\`).
- **Tầng 5 — \`Exception Filters\` (Lưới Hứng và Chuẩn hóa Ngoại lệ — \`ExceptionFilter\`):** Chỉ kích hoạt khi bất kỳ tầng nào phía trước ném ra ngoại lệ chưa được bắt; chịu trách nhiệm ghi nhật ký sự cố và chuyển đổi lỗi thành cấu trúc phản hồi đồng nhất (\`RFC 7807 Problem Details\`).

### 1.2 Đối chiếu kiến trúc: Middleware, Guard, Interceptor, Pipe và Exception Filter

Bảng dưới đây phân tích chi tiết ranh giới kỹ thuật, quyền truy cập ngữ cảnh và cơ chế thực thi của cả 5 thành phần trong Pipeline:

| Thành phần Pipeline | Giao diện Thực thi (\`Interface\`) | Quyền Truy cập \`ExecutionContext\` & \`Reflector\` | Khả năng Biến đổi Dữ liệu Đầu vào / Đầu ra | Hành vi Khi Phát sinh Lỗi hoặc Từ chối |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`Middleware\`** | \`NestMiddleware\` (\`use(req, res, next)\`) | **Không có**: Chỉ nhận \`req, res, next\` thô của Express/Fastify | Sửa đổi thuộc tính trên \`req\` (ví dụ \`req.traceId\`), không chạm vào kết quả \`Controller\` | Nếu gọi \`next(err)\` hoặc ném lỗi, nhảy thẳng tới \`Exception Filter\` |
| **2. \`Guard\`** | \`CanActivate\` (\`canActivate(context)\`) | **Đầy đủ 100%**: Biết rõ \`getClass()\` và \`getHandler()\` sắp chạy | **Không biến đổi dữ liệu**: Chỉ trả về \`boolean\` / \`Promise<boolean>\` / \`Observable<boolean>\` | Trả về \`false\` tự động ném \`403 ForbiddenException\` và ngắt toàn bộ các bước sau |
| **3. \`Interceptor\`** | \`NestInterceptor\` (\`intercept(context, next)\`) | **Đầy đủ 100%**: Truy cập cả \`ExecutionContext\` lẫn \`CallHandler\` | **Can thiệp 2 chiều**: Biến đổi luồng đầu ra qua toán tử RxJS (\`map\`, \`catchError\`) hoặc trả thẳng từ Cache | Có thể bắt lỗi của \`Controller/Pipe\` bằng \`catchError()\` trước khi lỗi rơi xuống \`Filter\` |
| **4. \`Pipe\`** | \`PipeTransform\` (\`transform(value, metadata)\`) | **Không nhận \`ExecutionContext\`**: Chỉ nhận giá trị tham số và \`ArgumentMetadata\` (\`body\`, \`param\`, \`query\`) | **Biến đổi trực tiếp Đầu vào**: Giá trị trả về từ \`transform()\` sẽ thay thế đối số truyền vào \`Controller\` | Ném \`400 BadRequestException\` ngay khi dữ liệu vi phạm, **tuyệt đối không gọi \`Controller\`** |
| **5. \`Exception Filter\`** | \`ExceptionFilter\` (\`catch(exception, host)\`) | Nhận **\`ArgumentsHost\`** (lớp cha của \`ExecutionContext\`) để lấy đối tượng phản hồi theo giao thức | Toàn quyền định dạng lại thân bản tin lỗi (\`Error Response Payload\`) và mã trạng thái HTTP/gRPC | Là điểm kết thúc cuối cùng để gửi phản hồi lỗi an toàn về cho máy khách |

### 1.3 Cơ chế Trừu tượng hóa Ngữ cảnh \`ArgumentsHost\` & \`ExecutionContext\` và Phản chiếu Metadata qua \`Reflector\`

Làm thế nào một \`AuthGuard\` duy nhất có thể kiểm tra quyền truy cập cho cả yêu cầu \`HTTP REST\`, cuộc gọi \`gRPC Microservice\` lẫn kết nối \`WebSocket\`? Bí quyết nằm ở kiến trúc phân cấp hai lớp của \`@nestjs/common\`:
1. **Lớp cơ sở \`ArgumentsHost\` (Trừu tượng hóa Tham số Giao thức):**
   Đóng vai trò là lớp vỏ bọc chứa mảng đối số thô mà bộ điều hợp bên dưới truyền lên. Đối với HTTP, mảng đối số là \`[req, res, next]\`; đối với gRPC là \`[payload, metadata, call]\`; đối với WebSockets là \`[clientSocket, data]\`. Bằng phương thức \`host.getType()\` (\`'http' | 'rpc' | 'ws'\`) kết hợp các bộ chuyển đổi \`host.switchToHttp()\`, \`host.switchToRpc()\`, \`host.switchToWs()\`, mã nguồn có thể trích xuất thông tin định danh an toàn trên mọi giao thức.
2. **Lớp kế thừa \`ExecutionContext extends ArgumentsHost\` (Ngữ cảnh Phản chiếu Đích đến):**
   Bổ sung thêm hai phương thức quan trọng bậc nhất cho \`Guards\` và \`Interceptors\`: **\`getClass(): Type<any>\`** (trả về hàm khởi tạo của lớp \`Controller\` đích) và **\`getHandler(): Function\`** (trả về tham chiếu tới chính phương thức sẽ xử lý yêu cầu đó).

Hãy đối chiếu phản mẫu kiểm tra quyền trong \`Middleware\` và thiết kế \`RolesGuard\` chuẩn Production kết hợp \`Reflector.getAllAndOverride()\` dưới đây:

\`\`\`typescript
// File: src/common/guards/roles-authorization.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_METADATA_KEY = 'arc_required_roles';
export type SystemRole = 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'STUDENT';

export const Roles = (...roles: SystemRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);

// 1. THIẾT KẾ SAI (ANTI-PATTERN): Cố gắng phân quyền theo URL cứng trong Middleware
export class HardcodedUrlAuthMiddlewareBroken {
  // LỖI KIẾN TRÚC:
  // - Middleware chạy trước Router nên không thể đọc @Roles() metadata trên Controller/Method!
  // - Phải viết biểu thức chính quy (Regex) khớp URL thủ công -> Chỉ cần đổi đường dẫn trong @Get()
  //   mà quên sửa Middleware là lập tức tạo ra lỗ hổng leo thang đặc quyền (Privilege Escalation)!
  checkUrlAccessBroken(url: string, userRole: string): boolean {
    if (url.startsWith('/api/v1/admin') && userRole !== 'ADMIN') {
      return false;
    }
    return true;
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION GUARD PATTERN): Kết hợp ExecutionContext & Reflector.getAllAndOverride
@Injectable()
export class EnterpriseRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Đọc metadata theo thứ tự ưu tiên: Nếu Method Handler có gắn @Roles() thì lấy của Method,
    // nếu không có mới lấy @Roles() gắn ở cấp Class Controller!
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nếu cả Method và Controller đều không yêu cầu Role đặc biệt -> Cho phép đi qua
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; roles?: SystemRole[] };
    }>();

    const userRoles = request.user?.roles ?? [];
    const hasPermission = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasPermission) {
      throw new ForbiddenException('INSUFFICIENT_ROLE_PRIVILEGES');
    }

    return true;
  }
}
\`\`\`

Để nắm chắc thứ tự thực thi tuyệt đối khi một yêu cầu HTTP đi qua đầy đủ các cấp độ **\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\`**, hãy theo dõi bảng truy vết thực thi theo từng mốc mili-giây dưới đây:

| Mốc thời gian | Tầng Pipeline & Phạm vi (\`Scope\`) | Thao tác Thực thi Cụ thể trên Luồng Yêu cầu | Trạng thái Ngữ cảnh & Luồng \`RxJS Observable\` | Hệ quả nếu Bất kỳ Bước nào Thất bại |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **1. Middleware** (\`Global\` $\rightarrow$ \`Module\`) | Gắn \`req.traceId = uuid()\`; khởi tạo vùng nhớ \`AsyncLocalStorage.run()\` | Chưa có \`ExecutionContext\`; chạy trên tầng Express/Fastify Router | Nếu gọi \`next(err)\`, bỏ qua toàn bộ Guard/Interceptor/Pipe/Controller |
| **\`t = 1 ms\`** | **2. Guards** (\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\`) | \`JwtAuthGuard\` giải mã Token gán \`req.user\`; sau đó \`RolesGuard\` đọc \`Reflector\` | Đã có \`ExecutionContext\`; chạy tuần tự từ ngoài vào trong | Nếu \`JwtAuthGuard\` trả về \`false\`, **không gọi \`RolesGuard\`**, ném ngay \`401/403\` |
| **\`t = 2 ms\`** | **3. Interceptors (Pre)** (\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\`) | Ghi nhận \`startTime = performance.now()\` trước khi gọi hàm \`next.handle()\` | Khởi tạo chuỗi bao bọc \`Observable\` theo cấu trúc củ hành (\`Onion Model\`) | Nếu trả về \`of(cachedData)\` (Cache Hit), **bỏ qua luôn cả \`Pipe\` và \`Controller\`**! |
| **\`t = 4 ms\`** | **4. Pipes** (\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\` $\rightarrow$ \`Param\`) | \`ValidationPipe\` kiểm định \`@Body()\`; \`ParseUUIDPipe\` kiểm tra tham số \`@Param('id')\` | Chạy ngay khi \`next.handle()\` được đăng ký (\`subscribe\`), xử lý từng tham số hàm | Nếu \`@Body()\` sai định dạng, ném \`400 BadRequestException\`, **không gọi \`Controller\`** |
| **\`t = 6 ms\`** | **5. Controller & Service** (\`Route Handler\`) | Thực thi phương thức \`OrdersController.createOrder(dto)\` và gọi xuống tầng \`Service\` | Đảm bảo 100% dữ liệu chạm tới \`Service\` đã sạch và đủ quyền hạn | Nếu ném lỗi nghiệp vụ, lỗi đi ngược qua \`catchError\` của Interceptor rồi xuống \`Filter\` |
| **\`t = 18 ms\`** | **6. Interceptors (Post)** (\`Route\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Global\`) | Dữ liệu chảy ngược qua các toán tử \`.pipe(map(...), tap(...))\` theo thứ tự **từ trong ra ngoài**! | \`Route Interceptor\` biến đổi kết quả trước, rồi mới tới \`Global Interceptor\` bọc vỏ ngoài cùng | Hoàn tất đóng gói chuẩn \`ApiResponseEnvelope\` và ghi nhật ký thời gian \`18 ms\` |

### 1.4 Định lượng Thứ tự Thực thi Phân cấp (Global, Controller, Route) và Độ trễ Tích lũy Pipeline

Một quy tắc bất biến thường gây nhầm lẫn về thứ tự thực thi của **\`Interceptors\`** so với **\`Guards / Pipes\`**:
- Ở chiều đi vào (**\`Inbound / Pre-Controller\`**): \`Guards\`, \`Interceptors (Pre)\`, và \`Pipes\` đều thực thi theo thứ tự **Từ Ngoài Vào Trong (\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\`)**.
- Nhưng ở chiều đi ra (**\`Outbound / Post-Controller RxJS Stream\`**): Vì \`Global Interceptor\` gọi \`next.handle()\` bọc bên ngoài \`Controller Interceptor\`, và \`Controller Interceptor\` bọc bên ngoài \`Route Interceptor\`, nên khi \`Controller\` trả kết quả về, luồng \`Observable\` sẽ chảy ngược **Từ Trong Ra Ngoài (\`Route\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Global\`)** — giống hệt cấu trúc ngăn xếp \`LIFO (Last-In, First-Out)\`!

\`\`\`
Tổng số Trạm Kiểm soát thực thi trên 1 Request thành công (Total_Stages) = N_Middleware + N_Guards + N_Interceptors_Pre + N_Pipes + 1 (Handler) + N_Interceptors_Post
Độ trễ Phạt của Pipeline (Pipeline_Overhead_Ms) = T_Middleware + T_Guards_Auth + T_Pipes_Validation + T_Interceptors_Serialization
Thứ tự Thực thi Post-Interceptor (LIFO Unwinding): Route_Interceptor.map() -> Controller_Interceptor.map() -> Global_Interceptor.map()
Ví dụ định lượng: Nếu Route Interceptor trả về { item: "A" }, Controller Interceptor bọc thành { result: data }, và Global Interceptor bọc thành { status: 200, payload: data }:
-> Kết quả JSON cuối cùng trả về Client sẽ là: { status: 200, payload: { result: { item: "A" } } }!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc bất biến của Request Pipeline):**
> 1. **Quy tắc Cắt mạch Sớm (\`Fail-Fast Short-Circuiting\`):** Chi phí tính toán tăng dần từ ngoài vào trong (\`Guard\` kiểm tra RAM/JWT rất nhẹ $\rightarrow$ \`Pipe\` chạy phản chiếu \`class-validator\` nặng hơn $\rightarrow$ \`Controller\` truy vấn Database nặng nhất). Việc đặt xác thực/phân quyền ở \`Guard\` đảm bảo các yêu cầu trái phép bị chặn đứng ngay tại \`t = 1 ms\` trước khi tốn CPU chạy \`ValidationPipe\` hay tốn kết nối Database.
> 2. **Quy tắc Củ hành (\`Onion Unwinding\`) của \`Interceptor\`:** Phần mã trước \`next.handle()\` chạy theo chiều \`Global -> Controller -> Route\`, nhưng phần mã trong \`.pipe(map(...))\` sau \`next.handle()\` luôn chạy theo chiều ngược lại \`Route -> Controller -> Global\`.

---

# 2. LẬP TRÌNH HƯỚNG KHÍA CẠNH (AOP) VỚI RXJS INTERCEPTORS, BIẾN ĐỔI DỮ LIỆU QUA PIPES VÀ LƯỚI AN TOÀN EXCEPTION FILTERS

### 2.1 Giải phẫu Vòng lặp Hai chiều của \`NestInterceptor\` và Luồng \`RxJS Observable\` (\`CallHandler.handle()\`)

Trong \`@nestjs/common\`, giao diện \`NestInterceptor<T, R>\` yêu cầu hiện thực phương thức \`intercept(context: ExecutionContext, next: CallHandler<T>): Observable<R> | Promise<Observable<R>>\`. Điểm mấu chốt nằm ở tham số thứ hai **\`next: CallHandler\`**:
- Nếu bạn **không gọi \`next.handle()\`**, phương thức tại \`Controller\` sẽ **không bao giờ được kích hoạt** (rất hữu ích khi viết \`CacheInterceptor\`: nếu tìm thấy dữ liệu trong Redis, chỉ cần trả về \`of(cachedValue)\` để cắt mạch ngay lập tức!).
- Khi bạn gọi \`next.handle()\`, NestJS đóng gói lời gọi hàm \`Pipes + Controller Method\` thành một luồng **\`RxJS Observable\`** lạnh (\`Cold Observable\`) và trả về cho bạn gắn thêm các toán tử biến đổi dòng dữ liệu.

Bảng dưới đây tổng hợp 5 toán tử \`RxJS\` quan trọng nhất được sử dụng trong \`NestInterceptor\` trên các hệ thống Production:

| Toán tử \`RxJS\` (\`rxjs/operators\`) | Mục đích Kỹ thuật trong \`NestInterceptor\` | Tác động lên Dữ liệu Trả về của \`Controller\` | Kịch bản Ứng dụng Thực tế Điển hình | Lưu ý Vận hành & Phòng tránh Lỗi |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`map(data => ...)\`** | Biến đổi cấu trúc dữ liệu đầu ra đồng bộ trước khi tuần tự hóa sang JSON | Thay thế trực tiếp đối tượng trả về bằng kết quả của hàm \`map\` | Bọc kết quả vào phong bì chuẩn \`{ success: true, data }\` hoặc ẩn trường \`passwordHash\` | Không dùng hàm \`async\` bên trong \`map\` (nếu cần xử lý bất đồng bộ phải dùng \`mergeMap\` / \`switchMap\`) |
| **2. \`tap({ next, error })\`** | Thực thi tác vụ phụ (\`Side-effect\`) quan sát luồng mà không làm thay đổi dữ liệu | **Giữ nguyên 100%** dữ liệu gốc của \`Controller\` | Đo thời gian thực thi (\`Latency Telemetry\`), ghi nhật ký kiểm toán (\`Audit Log\`), đếm chỉ số Prometheus | Tuyệt đối không thực hiện tác vụ chặn CPU lâu bên trong hàm \`tap\` |
| **3. \`timeout(ms)\`** | Áp đặt thời gian chờ tối đa cho việc thực thi của \`Controller\` | Huỷ đăng ký (\`unsubscribe\`) luồng nếu quá hạn và ném lỗi \`TimeoutError\` | Bảo vệ API Gateway khỏi các yêu cầu bị treo quá \`5000 ms\`, chuyển thành mã lỗi \`408 Request Timeout\` | Kết hợp với \`catchError\` để biến \`TimeoutError\` của RxJS thành \`RequestTimeoutException\` của NestJS |
| **4. \`catchError(err => ...)\`** | Đón bắt ngoại lệ phát sinh từ \`Pipe\` hoặc \`Controller\` ngay trong luồng | Có thể biến đổi lỗi sang một mã lỗi chuẩn khác rồi ném lại qua \`throwError(() => newErr)\` | Ánh xạ lỗi mã nội bộ của Database (\`code: '23505'\`) sang \`409 ConflictException\` của HTTP | Phải trả về \`throwError(() => ...)\` hoặc một \`Observable\` dự phòng để kết thúc luồng hợp lệ |
| **5. \`of(cachedPayload)\`** | Tạo luồng phát ra ngay lập tức một giá trị có sẵn mà **không gọi \`next.handle()\`** | Bỏ qua hoàn toàn việc thực thi \`Pipes\` và \`Controller Handler\` | Hiện thực bộ nhớ đệm phản hồi tự động (\`Idempotency / HTTP Response Cache Interceptor\`) | Chỉ áp dụng cho các phương thức đọc an toàn (\`GET\`) hoặc khi khớp khóa \`Idempotency-Key\` |

### 2.2 Cơ chế Biến đổi và Kiểm định Payload của \`ValidationPipe\` (\`class-transformer\` & \`class-validator\`)

Tại sao trong TypeScript, dù bạn đã khai báo \`@Body() dto: CreateUserDto\`, nếu một kẻ tấn công gửi gói tin JSON \`{ "email": 12345, "isAdmin": true }\`, ứng dụng của bạn vẫn nhận nguyên đối tượng độc hại đó nếu không bật \`ValidationPipe\`?
- Như đã học ở Bài 01, do cơ chế **Xóa kiểu (\`Type Erasure\`)**, ở thời điểm Runtime đối tượng \`req.body\` do Express/Fastify phân tích chỉ là một **Đối tượng JavaScript thuần túy (\`Plain Old JavaScript Object — POJO\`)** không hề có nguyên mẫu (\`Prototype\`) của lớp \`CreateUserDto\` và không có bất kỳ bước kiểm tra kiểu nào!
- Khi kích hoạt **\`ValidationPipe\`** toàn cục, NestJS đọc siêu dữ liệu \`design:paramtypes\` của phương thức \`Controller\` để biết tham số đó thuộc lớp \`CreateUserDto\`, sau đó thực hiện quy trình 3 bước:
  1. **Lọc bỏ Trường Độc hại (\`whitelist: true\` & \`forbidNonWhitelisted: true\`):** Quét toàn bộ các thuộc tính trong \`req.body\`; bất kỳ trường nào không được gắn decorator của \`class-validator\` trong lớp \`CreateUserDto\` (ví dụ trường \`"isAdmin": true\` do hacker tự chèn thêm để tấn công **\`Mass Assignment Vulnerability\`**) sẽ bị xóa sạch (\`whitelist\`) hoặc bị chặn lại ngay lập tức với lỗi \`400 Bad Request\` (\`forbidNonWhitelisted\`)!
  2. **Khôi phục Bản thể Lớp (\`plainToInstance\` khi bật \`transform: true\`):** Chuyển đổi đối tượng JSON thô thành một bản thể thực sự của lớp \`new CreateUserDto()\`, đồng thời ép kiểu tự động các tham số chuỗi trên URL (\`@Param('id')\`, \`@Query('page')\`) sang kiểu \`number / boolean\` tương ứng.
  3. **Kiểm định Ràng buộc (\`validate(instance)\`):** Chạy toàn bộ các quy tắc kiểm tra (\`@IsEmail()\`, \`@Min(18)\`, \`@IsUUID()\`). Nếu có bất kỳ lỗi nào, \`ValidationPipe\` lập tức ném \`BadRequestException\` và ngắt mạch trước khi hàm \`Controller\` được gọi.

\`\`\`
Độ trễ Kiểm định DTO (T_Validation_Ms) = T_plainToInstance (O(Fields_Count)) + T_validateRules (O(Rules_Count))
Tỷ lệ Yêu cầu Rác bị chặn trước Database (Blocked_Malformed_Ratio) = (Rejected_At_Guard + Rejected_At_Pipe) / Total_Incoming_Requests
Quy tắc Cấu hình Bảo mật Bắt buộc cho ValidationPipe: { whitelist: true, forbidNonWhitelisted: true, transform: true }
\`\`\`

### 2.3 Chiến lược Bắt Ngoại lệ Phân tầng với \`@Catch()\` và Thứ tự Ưu tiên Đảo ngược của \`ExceptionFilter\`

Khi một ngoại lệ bị ném ra từ bất kỳ đâu trong Pipeline, NestJS chuyển luồng điều khiển sang tầng **\`Exception Filters\`**. Có một quy tắc cực kỳ quan trọng mà kỹ sư phải đặc biệt lưu ý: **Thứ tự ưu tiên của \`Exception Filters\` và danh sách đăng ký trong cùng một mảng bị ĐẢO NGƯỢC so với \`Guards\` và \`Pipes\`**:
1. **Ưu tiên từ Cụ thể đến Toàn cục (\`Route\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Global\`):**
   Khi lỗi xảy ra, NestJS tìm kiếm \`ExceptionFilter\` gắn trực tiếp tại **\`Route Method\`** trước tiên; nếu không có (hoặc Filter đó không khớp kiểu lỗi trong \`@Catch(SpecificException)\`), nó mới tìm lên cấp **\`Controller\`**, và cuối cùng mới rơi xuống **\`Global Exception Filter\`**.
2. **Thứ tự trong mảng \`useGlobalFilters(new FilterA(), new FilterB())\` hoặc \`providers: [APP_FILTER]\`:**
   Do kiến trúc ngăn xếp bắt lỗi của NestJS duyệt từ phần tử đăng ký sau cùng về phần tử đầu tiên, nếu bạn đăng ký một bộ lọc bắt tất cả mọi lỗi (**\`@Catch()\` không đối số — Catch-All Filter**) cùng với một bộ lọc chuyên biệt (**\`@Catch(HttpException)\`**), bạn bắt buộc phải đặt **\`Catch-All Filter\` ở vị trí ĐẦU TIÊN** và đặt **\`Specific Filter\` ở vị trí PHÍA SAU** để bộ lọc chuyên biệt được kiểm tra trước!

> **Tổng kết học thuật Phần 2 (Hai quy tắc bảo mật và bắt lỗi trong Pipeline):**
> 1. **Chống lỗ hổng \`Mass Assignment\` tại \`ValidationPipe\`:** Luôn cấu hình \`whitelist: true\` và \`forbidNonWhitelisted: true\` trên \`ValidationPipe\` toàn cục để ngăn chặn triệt để việc người dùng tự ý gửi thêm các trường nhạy cảm (\`role\`, \`balance\`, \`isVerified\`) vào thân bản tin JSON.
> 2. **Quy tắc Sắp xếp Bộ lọc Ngoại lệ (\`Specific Overrides Catch-All\`):** Bộ lọc tổng quát \`@Catch()\` (không tham số) luôn đóng vai trò là lưới an toàn cuối cùng để ẩn giấu \`Stack Trace\` của các lỗi hệ thống (\`TypeError\`, \`DatabaseError\`), trả về mã chuẩn \`500 Internal Server Error\` mà không làm lộ cấu trúc bảng hay đường dẫn tệp tin nội bộ ra ngoài Internet.

---

# 3. ĐĂNG KÝ PIPELINE TOÀN CỤC CÓ TIÊM PHỤ THUỘC (APP_GUARD, APP_INTERCEPTOR, APP_PIPE, APP_FILTER) VÀ CHẨN ĐOÁN SỰ CỐ PRODUCTION

### 3.1 Cạm bẫy Mất Kết nối IoC Container khi dùng \`app.useGlobal*()\` trong \`main.ts\` và Giải pháp Token \`APP_*\`

Trong tài liệu cơ bản, nhiều lập trình viên thường đăng ký các thành phần toàn cục bên trong tệp \`main.ts\` bằng câu lệnh:
\`app.useGlobalGuards(new JwtAuthGuard());\` hoặc \`app.useGlobalInterceptors(new LoggingInterceptor());\`.
- **Cạm bẫy Kiến trúc:** Khi bạn tự tay gọi toán tử \`new JwtAuthGuard()\` ở bên trong hàm \`bootstrap()\` của \`main.ts\`, đối tượng đó được khởi tạo **ở bên ngoài ranh giới của \`NestContainer\`**! Hệ quả là \`JwtAuthGuard\` hoàn toàn **không thể sử dụng Dependency Injection** để tiêm các dịch vụ khác như \`ConfigService\`, \`RedisBlacklistService\` hay \`Reflector\` vào hàm khởi tạo của nó!
- **Giải pháp Kiến trúc Chuẩn Production:** Thay vì khởi tạo thủ công trong \`main.ts\`, NestJS cung cấp 4 hằng số Injection Token đặc biệt từ gói \`@nestjs/core\`:
  1. **\`APP_GUARD\`**: Đăng ký Guard toàn cục ngay bên trong mảng \`providers\` của \`AppModule\` (hoặc bất kỳ Module nào).
  2. **\`APP_INTERCEPTOR\`**: Đăng ký Interceptor toàn cục có tiêm đầy đủ \`LoggerService\`, \`MetricsService\`, \`CacheManager\`.
  3. **\`APP_PIPE\`**: Đăng ký \`ValidationPipe\` toàn cục dưới sự quản lý của IoC Container.
  4. **\`APP_FILTER\`**: Đăng ký \`ExceptionFilter\` toàn cục có thể tiêm trực tiếp \`SentryService\` hoặc \`AuditLogService\`.

### 3.2 Hiện thực Chuỗi \`ResponseTransformInterceptor\` & \`AllExceptionsFilter\` Chuẩn Production

Đoạn mã dưới đây minh họa cách thiết lập trọn vẹn cặp đôi **Bộ biến đổi Phản hồi Chuẩn hóa (\`ResponseTransformInterceptor\`)** và **Lưới Hứng Ngoại lệ Toàn cục (\`AllExceptionsFilter\`)** được đăng ký qua Token \`APP_INTERCEPTOR\` và \`APP_FILTER\` bên trong \`CorePipelineModule\`:

\`\`\`typescript
// File: src/common/pipeline/enterprise-response-pipeline.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardApiResponse<T> {
  readonly success: boolean;
  readonly statusCode: number;
  readonly path: string;
  readonly durationMs: number;
  readonly data: T | null;
  readonly errorCode?: string;
}

@Injectable()
export class StandardizedEnvelopeInterceptor<T>
  implements NestInterceptor<T, StandardApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<StandardApiResponse<T>> {
    const startMs = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest<{ url: string }>();
    const res = http.getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      map((payload: T): StandardApiResponse<T> => ({
        success: true,
        statusCode: res.statusCode || HttpStatus.OK,
        path: req.url,
        durationMs: Date.now() - startMs,
        data: payload,
      })),
    );
  }
}

@Catch()
@Injectable()
export class GlobalCatchAllExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): StandardApiResponse<null> {
    const http = host.switchToHttp();
    const req = http.getRequest<{ url: string }>();

    const isHttpEx = exception instanceof HttpException;
    const statusCode = isHttpEx
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Bảo mật Production: Không bao giờ phơi bày message/stack của lỗi 500 nội bộ ra ngoài!
    const errorCode = isHttpEx ? exception.message : 'INTERNAL_SYSTEM_ERROR';

    return {
      success: false,
      statusCode,
      path: req?.url ?? '/unknown',
      durationMs: 0,
      data: null,
      errorCode,
    };
  }
}

@Module({
  providers: [
    // Đăng ký qua Token APP_* để NestContainer tự động quản lý vòng đời Singleton và DI:
    {
      provide: APP_INTERCEPTOR,
      useClass: StandardizedEnvelopeInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalCatchAllExceptionFilter,
    },
  ],
})
export class CorePipelineModule {}
\`\`\`

### 3.3 Phương pháp Chẩn đoán và Xử lý Sự cố Request Pipeline trên Môi trường Production

Bảng dưới đây tổng hợp 5 sự cố vận hành thực tế thường gặp nhất liên quan đến thứ tự thực thi và rò rỉ dữ liệu trong NestJS Request Pipeline:

| Triệu chứng Sự cố trên Production | Nguyên nhân Gốc rễ trong Thiết kế Pipeline | Cơ chế Thực thi Nội tại Gây Lỗi | Rủi ro Bảo mật / Hiệu năng | Giải pháp Khắc phục Triệt để Chuẩn Kiến trúc |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`Reflector\` trong \`RolesGuard\` luôn trả về \`undefined\` hoặc lỗi \`Cannot read properties of undefined\`** | Khởi tạo \`app.useGlobalGuards(new RolesGuard())\` trong \`main.ts\` mà không truyền \`Reflector\` | Toán tử \`new\` trong \`main.ts\` nằm ngoài \`IoC Container\` nên tham số \`constructor(private reflector: Reflector)\` bị \`undefined\` | Toàn bộ hệ thống phân quyền RBAC bị tê liệt hoặc ném lỗi 500 trên mọi API | Đăng ký thông qua \`{ provide: APP_GUARD, useClass: RolesGuard }\` bên trong mảng \`providers\` của \`AppModule\` |
| **2. \`RolesGuard\` báo lỗi \`req.user is undefined\` dù đã gắn cả \`JwtAuthGuard\` lẫn \`RolesGuard\`** | Khai báo sai thứ tự: \`@UseGuards(RolesGuard, JwtAuthGuard)\` | Các Guard chạy tuần tự từ trái sang phải; \`RolesGuard\` chạy trước khi \`JwtAuthGuard\` kịp giải mã JWT gán vào \`req.user\` | Mọi người dùng hợp lệ đều bị chặn nhầm với lỗi \`403 Forbidden\` | Luôn đặt \`JwtAuthGuard\` đứng trước \`RolesGuard\` (hoặc đăng ký \`JwtAuthGuard\` làm \`APP_GUARD\` đầu tiên) |
| **3. Kẻ tấn công gửi thêm trường \`"role": "ADMIN"\` trong JSON Body và chiếm quyền quản trị thành công** | Không bật \`whitelist: true\` trong \`ValidationPipe\` và truyền thẳng \`@Body() dto\` vào \`repo.save(dto)\` | Do \`Type Erasure\`, các trường thừa trong JSON không bị xóa bỏ nếu thiếu cờ \`whitelist: true\` | Lỗ hổng bảo mật nghiêm trọng **\`Mass Assignment / Over-posting\`** (OWASP API3) | Bắt buộc cấu hình \`new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })\` |
| **4. Khi \`Controller\` ném lỗi \`BadRequestException\`, toán tử \`map()\` của \`Interceptor\` không chạy** | Lập trình viên đặt logic ghi nhật ký lỗi hoặc dọn dẹp tài nguyên bên trong toán tử \`map()\` của RxJS | Khi có ngoại lệ, luồng \`Observable\` chuyển sang kênh \`Error Notification\`, bỏ qua toàn bộ các toán tử \`map()\` phía sau | Mất dấu nhật ký kiểm toán (\`Audit Trail\`) đối với các yêu cầu thất bại hoặc rò rỉ tài nguyên | Sử dụng toán tử **\`catchError()\`** hoặc **\`finalize()\`** trong chuỗi \`.pipe()\` của \`Interceptor\` |
| **5. Dữ liệu phản hồi bị bọc 2 lần phong bì (\`{ data: { data: ... } }\`) hoặc lỗi \`ERR_HTTP_HEADERS_SENT\`** | Sử dụng \`@Res() res: Response\` trực tiếp trong \`Controller\` kết hợp với \`ResponseTransformInterceptor\` | Khi dùng \`@Res()\` không có cờ \`{ passthrough: true }\`, NestJS tắt chế độ quản lý phản hồi chuẩn và xung đột với \`Interceptor\` | Treo kết nối HTTP hoặc làm sập tiến trình Node.js do ghi Header hai lần | Luôn dùng **\`@Res({ passthrough: true })\`** nếu chỉ cần đọc/gán Cookie hoặc Header để giữ nguyên luồng \`Interceptor\` |

> **Tổng kết học thuật Phần 3 (Quy tắc Bảo toàn Luồng Chuẩn với \`passthrough: true\`):**
> Khi cần thao tác với đối tượng \`Response\` gốc của Express/Fastify bên trong \`Controller\` (ví dụ để đính kèm \`res.cookie()\` hoặc \`res.header()\`), kỹ sư bắt buộc phải khai báo **\`@Res({ passthrough: true })\`**. Nếu quên cờ \`passthrough: true\`, bạn đã vô hiệu hóa toàn bộ tầng \`Interceptors (Post-controller)\` và quy trình tuần tự hóa tự động của NestJS!

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Chuỗi Thực Thi Request Pipeline Trong NestJS (Request Lifecycle Pipeline Architecture)
\`\`\`diagram
[TOPOLOGY: pipeline-feedback-loop]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG TIỀN XỬ LÝ MẠNG & BẢO VỆ QUYỀN HẠN (INGRESS MIDDLEWARE & AUTH GUARDS) │
│    ├── Middleware (Global -> Module): Gắn Trace-ID, CORS và AsyncLocalStorage │
│    ├── ExecutionContext & Reflector: Đọc Metadata @Roles, @Public đa giao thức│
│    └── Guards (Global -> Controller -> Route): Xác thực JWT & Phân quyền RBAC │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Cho phép đi tiếp (canActivate = true) vào Vòng bọc AOP
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG BAO BỌC AOP & KIỂM ĐỊNH DỮ LIỆU (RXJS INTERCEPTORS & VALIDATION PIPES)│
│    ├── Interceptors Pre-Controller: Khởi tạo đồng hồ đo Latency & Check Cache │
│    ├── Pipes (Global -> Route -> Param): Whitelist DTO & Ép kiểu dữ liệu      │
│    └── Controller Route Handler: Thực thi nghiệp vụ lõi tại Singleton Service │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Luồng Kết quả RxJS Observable hoặc Nhảy cóc khi Ném lỗi
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG BIẾN ĐỔI PHẢN HỒI & LƯỚI HỨNG NGOẠI LỆ (POST-STREAM & EXCEPTION FILTERS)│
│    ├── Interceptors Post-Stream (LIFO): Bọc Envelope qua RxJS map/tap/timeout │
│    ├── Exception Filters (Route -> Global): Hứng lỗi & Ẩn Stack Trace 500     │
│    └── Outgoing Protocol Adapter: Trả bản tin JSON/Protobuf về cho Client     │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Chuỗi Middleware Tuyến Tính (Express) Và Pipeline Phân Tầng Đa Giao Thức (NestJS Execution Pipeline)
\`\`\`diagram
MÔ HÌNH CŨ: CHUỖI EXPRESS MIDDLEWARE TUYẾN TÍNH MÙ NGỮ CẢNH (CONTEXT-BLIND LINEAR MIDDLEWARE)
Request ──► [ Middleware (Không biết Handler đích) ] ──► [ Không đọc được @Roles / Không bọc được đầu ra ] ──► LỖ HỔNG MASS ASSIGNMENT & LEAK STACK TRACE
100 Endpoints = Phải viết Regex khớp URL thủ công, không dùng lại được cho gRPC/WebSockets, lỗi 500 làm lộ cấu trúc DB.

MÔ HÌNH HIỆN ĐẠI: ĐƯỜNG ỐNG THỰC THI 5 TẦNG NESTJS VỚI EXECUTIONCONTEXT & RXJS OBSERVABLE
HTTP / gRPC / WS ──┐
Guard (Reflector) ─┼──► [ Interceptor Pre -> ValidationPipe (Whitelist) -> Controller ] ──► Interceptor Post (RxJS Envelope)
Exception Filter ──┘                                  │
                                                      └──► Bất kỳ tầng nào lỗi đều nhảy thẳng xuống Filter ────► Chuẩn hóa JSON an toàn 100%
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Lựa Chọn Thành Phần Can Thiệp Vào Vòng Đời Request)
\`\`\`diagram
                  CẦN HIỆN THỰC MỘT LOGIC CAN THIỆP XUYÊN SUỐT (CROSS-CUTTING CONCERN) VÀO REQUEST?
                                                          │
                                                          ▼
                       Logic đó cần thực thi ở giai đoạn nào và có cần can thiệp vào dữ liệu trả về không?
                       /                                                                                 \\
        CHỈ KIỂM TRA / BIẾN ĐỔI TRƯỚC KHI VÀO CONTROLLER                                  CẦN BAO BỌC CẢ ĐẦU VÀO LẪN ĐẦU RA HOẶC BẮT LỖI
                        /                                                                                   \\
                       ▼                                                                                     ▼
     Mục tiêu cụ thể của việc kiểm tra đầu vào là gì?                                      Bạn cần biến đổi luồng thành công hay xử lý khi có ngoại lệ?
     /                                                \\                                    /                                                          \\
XÁC THỰC & PHÂN QUYỀN (@ROLES)               ÉP KIỂU & KIỂM ĐỊNH PAYLOAD DTO       BAO BỌC LUỒNG THÀNH CÔNG / CACHE / TIMEOUT                 CHUẨN HÓA PHẢN HỒI KHI CÓ LỖI
            /                                                  \\                                  /                                                            \\
           ▼                                                    ▼                                ▼                                                              ▼
[ DÙNG NESTJS GUARD (CHUẨN) ]                        [ DÙNG NESTJS PIPE (CHUẨN) ]      [ DÙNG RXJS INTERCEPTOR (TỐI ƯU) ]                           [ DÙNG EXCEPTION FILTER (CHUẨN) ]
- Đọc Metadata qua Reflector                         - Bật whitelist: true             - Đo thời gian chạy qua RxJS tap()                           - Đăng ký qua token APP_FILTER
- Chặn sớm 401/403 trước Pipe                        - Chặn lỗi 400 Bad Request        - Bọc chuẩn JSON Envelope qua map()                          - Ẩn Stack Trace của lỗi 500
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu Đăng Ký Qua main.ts, Decorator @Use* Và Custom Token APP_*)

| Tiêu Chí So Sánh | \`app.useGlobal*()\` (Trong \`main.ts\`) | \`@UseGuards / @UseInterceptors\` (Truyền Class) | \`@Use*(new Instance())\` (Truyền Bản thể) | \`provide: APP_*\` (Trong \`@Module\`) |
| :--- | :--- | :--- | :--- | :--- |
| **Khả năng Tiêm Phụ thuộc (\`DI\`)** | **Không thể**: Tạo bằng \`new\` ở ngoài ranh giới \`NestContainer\` | **Đầy đủ 100%**: Container tự khởi tạo và tiêm các \`Service\` phụ thuộc | **Không thể**: Tự gọi \`new\` thủ công làm mất khả năng tiêm phụ thuộc | **Đầy đủ 100%**: Nằm trọn vẹn trong đồ thị DI của \`Module\` đăng ký |
| **Phạm vi Áp dụng (\`Scope\`)** | Toàn cục (\`Global\` cho mọi \`Controller\`) | Cục bộ theo từng \`Controller\` hoặc từng phương thức \`Route\` | Cục bộ theo từng \`Controller\`, \`Route\` hoặc từng tham số \`@Param\` | Toàn cục (\`Global\` cho toàn bộ ứng dụng dù khai báo ở Module con) |
| **Tác động Bộ nhớ V8 Heap** | 1 bản thể duy nhất tạo lúc chạy \`main.ts\` | Tái sử dụng bản thể \`Singleton\` trong \`InstanceWrapper\` | **Lãng phí RAM**: Mỗi nơi gọi \`@Use*(new X())\` tạo ra 1 bản sao mới! | Tái sử dụng 1 bản thể \`Singleton\` duy nhất trên toàn hệ thống |
| **Mức độ Khuyến nghị Production** | Chỉ dùng cho \`Pipe\` đơn giản không cần DI | **Khuyên dùng** cho phân quyền/kiểm tra đặc thù của từng Route | **Hạn chế tối đa** (Chỉ dùng khi truyền cấu hình tĩnh vào \`Pipe\`) | **Chuẩn Vàng (Golden Pattern)** cho mọi Guard/Interceptor/Filter toàn cục |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`ResponseTransformInterceptor\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Thứ tự Thực thi Bất biến và Tháo gỡ LIFO (\`Deterministic Pipeline & LIFO Unwinding Invariant\`):** Mọi yêu cầu đi vào NestJS đều đi qua chuỗi **\`Middleware\` $\rightarrow$ \`Guards\` $\rightarrow$ \`Interceptors (Pre)\` $\rightarrow$ \`Pipes\` $\rightarrow$ \`Controller Handler\`** theo thứ tự phân cấp từ ngoài vào trong (\`Global\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Route\`). Tuy nhiên, luồng dữ liệu trả về qua \`RxJS Observable\` trong **\`Interceptors (Post)\`** luôn tháo gỡ theo thứ tự ngược lại **từ trong ra ngoài (\`Route\` $\rightarrow$ \`Controller\` $\rightarrow$ \`Global\`)**.
2. **Định đề Tách biệt Phân quyền và Kiểm định (\`Authorization Before Validation Invariant\`):** \`Guards\` luôn chạy trước \`Pipes\` để bảo đảm các yêu cầu không có quyền truy cập bị từ chối ngay lập tức (\`401/403\`) nhờ đọc siêu dữ liệu qua \`ExecutionContext\` và \`Reflector\`, tránh lãng phí chu kỳ CPU cho việc giải tuần tự hóa và kiểm định \`DTO\` phức tạp tại \`ValidationPipe\`.
3. **Định đề Khử Nhiễm Dữ liệu Đầu vào (\`DTO Whitelisting & Mass Assignment Invariant\`):** Do hiện tượng xóa kiểu (\`Type Erasure\`) của TypeScript, khai báo kiểu \`DTO\` không tự bảo vệ hệ thống lúc Runtime. Hệ thống bắt buộc phải đăng ký \`ValidationPipe\` với cấu hình **\`whitelist: true\`** và **\`forbidNonWhitelisted: true\`** để loại bỏ hoàn toàn các thuộc tính trái phép trước khi dữ liệu chạm vào tầng \`Service\`.
4. **Định đề Đăng ký Toàn cục Nội bộ Container (\`Container-Managed Global Binding Invariant\`):** Mọi \`Guard\`, \`Interceptor\`, \`Pipe\` và \`ExceptionFilter\` toàn cục có nhu cầu tiêm phụ thuộc (\`Reflector\`, \`ConfigService\`, \`Logger\`) đều bắt buộc phải được đăng ký bên trong mảng \`providers\` của một \`Module\` thông qua các Token định danh **\`APP_GUARD\`**, **\`APP_INTERCEPTOR\`**, **\`APP_PIPE\`** và **\`APP_FILTER\`** thay vì khởi tạo thủ công bằng \`app.useGlobal*()\` ngoài \`main.ts\`.
  `,
  realCodeSnippet: `// File: src/common/interceptors/response-transform.interceptor.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Chuẩn hóa API Envelope, Telemetry & Timeout Protection
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { tap, map, catchError, timeout } from 'rxjs/operators';

export interface HttpRequestContext {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string | undefined>;
}

export interface HttpResponseContext {
  readonly statusCode: number;
}

export interface ApiResponseEnvelope<T> {
  readonly success: boolean;
  readonly statusCode: number;
  readonly traceId: string;
  readonly timestamp: string;
  readonly durationMs: number;
  readonly path: string;
  readonly data: T;
}

/**
 * ADR-0043: Lập trình Hướng Khía cạnh (AOP) với RxJS Interceptor:
 * 1. Ghi nhận mốc thời gian Pre-controller trước khi gọi next.handle().
 * 2. Áp đặt ngưỡng thời gian chờ tối đa (timeout 15000ms) để giải phóng kết nối bị treo.
 * 3. Đóng gói kết quả trả về từ Controller vào cấu trúc ApiResponseEnvelope đồng nhất qua toán tử map().
 * 4. Ghi nhật ký độ trễ (durationMs) và mã vết (x-trace-id) qua toán tử tap() và catchError().
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T>>
{
  private readonly logger = new Logger(ResponseTransformInterceptor.name);
  private readonly defaultTimeoutMs = 15000;

  public intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseEnvelope<T>> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<HttpRequestContext>();
    const response = httpContext.getResponse<HttpResponseContext>();
    const traceId = request.headers?.['x-trace-id'] ?? 'TRACE_UNASSIGNED';

    return next.handle().pipe(
      timeout(this.defaultTimeoutMs),
      map((data: T): ApiResponseEnvelope<T> => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode || HttpStatus.OK;
        return {
          success: true,
          statusCode,
          traceId,
          timestamp: new Date().toISOString(),
          durationMs,
          path: request.url,
          data,
        };
      }),
      tap((envelope) => {
        this.logger.log(
          \`[\${traceId}] \${request.method} \${request.url} -> \${envelope.statusCode} (\${envelope.durationMs}ms)\`,
        );
      }),
      catchError((err: unknown) => {
        const durationMs = Date.now() - startTime;
        this.logger.error(
          \`[\${traceId}] \${request.method} \${request.url} -> FAILED (\${durationMs}ms)\`,
          err instanceof Error ? err.stack : undefined,
        );
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('UPSTREAM_HANDLER_TIMEOUT'));
        }
        return throwError(() => err);
      }),
    );
  }
}`,
  quiz: [
    {
      id: 'c4-l2-q1',
      question: 'Vì sao trong kiến trúc NestJS, Guard luôn được ưu tiên sử dụng để phân quyền truy cập (Authorization) thay vì dùng Express Middleware?',
      options: [
        'Vì Guard có quyền truy cập vào ExecutionContext để đọc siêu dữ liệu (@Roles) của Controller và Method đích thông qua Reflector.',
        'Vì Guard được biên dịch thành mã máy chạy trực tiếp trong nhân hệ điều hành Linux nên kiểm tra chữ ký JWT nhanh hơn gấp mười lần.',
        'Vì hàm Middleware của Express hoàn toàn không được phép đọc các trường tiêu đề bảo mật như Authorization hoặc Cookie của yêu cầu.',
        'Vì Guard tự động mã hóa lại toàn bộ nội dung phản hồi JSON bằng thuật toán đối xứng AES-256 trước khi trả dữ liệu về cho trình duyệt.'
      ],
      correctIndex: 0,
      explanation: 'Express Middleware chạy trước khi bộ định tuyến xác định được đích đến, nên nó chỉ biết URL thô mà không biết hàm Controller nào sắp chạy. Ngược lại, Guard chạy sau khi định tuyến, sở hữu đối tượng ExecutionContext (với getClass() và getHandler()) kết hợp cùng Reflector để đọc chính xác các metadata như @Roles("ADMIN") gắn trên phương thức đích.'
    },
    {
      id: 'c4-l2-q2',
      question: 'Chuỗi thứ tự thực thi nào sau đây mô tả chính xác 100% đường đi của một HTTP Request thành công qua toàn bộ Pipeline của NestJS?',
      options: [
        'Global Pipes -> Module Middleware -> Route Guards -> Route Interceptors -> Controller Handler -> Global Exception Filters -> Response.',
        'Route Guards -> Module Middleware -> Controller Pipes -> Controller Handler -> Post-Interceptor Stream -> Global Middleware -> Response.',
        'Middleware -> Guards (Global->Controller->Route) -> Interceptors Pre -> Pipes -> Controller Handler -> Interceptors Post (Route->Controller->Global).',
        'Controller Handler -> Interceptors Pre -> Global Guards -> Validation Pipes -> Module Middleware -> Interceptors Post -> Outgoing Response.'
      ],
      correctIndex: 2,
      explanation: 'Một yêu cầu đi qua tuần tự: 1) Middleware (Global -> Module) -> 2) Guards (Global -> Controller -> Route) -> 3) Interceptors Pre-controller (Global -> Controller -> Route) -> 4) Pipes (Global -> Controller -> Route -> Param) -> 5) Controller Handler -> 6) Interceptors Post-controller chảy ngược theo cấu trúc LIFO (Route -> Controller -> Global).'
    },
    {
      id: 'c4-l2-q3',
      question: 'Khi một yêu cầu gửi dữ liệu JSON không hợp lệ và bị chặn lại tại ValidationPipe, điều gì sẽ diễn ra tiếp theo trong vòng đời Request?',
      options: [
        'Yêu cầu vẫn tiếp tục đi vào phương thức của Controller nhưng tham số DTO sẽ được gán giá trị rỗng để lớp dịch vụ tự xử lý nhánh dự phòng.',
        'ValidationPipe lập tức ném BadRequestException, ngắt mạch hoàn toàn việc gọi Controller và chuyển thẳng xuống Exception Filter xử lý lỗi 400.',
        'Interceptor ở chiều đi ra sẽ tự động lấy dữ liệu mẫu từ bộ nhớ đệm Redis để điền vào các trường bị thiếu rồi gọi lại phương thức Controller.',
        'Tiến trình Node.js phát sinh sự kiện uncaughtException làm khởi động lại toàn bộ cụm máy chủ ứng dụng để bảo vệ tính toàn vẹn của bộ nhớ.'
      ],
      correctIndex: 1,
      explanation: 'Pipes chạy ngay trước khi phương thức Controller được gọi. Khi ValidationPipe phát hiện dữ liệu vi phạm ràng buộc, nó lập tức ném ra ngoại lệ BadRequestException; toàn bộ việc thực thi Controller Handler bị hủy bỏ (Short-circuit) và luồng điều khiển nhảy thẳng tới Exception Filter để trả về mã lỗi 400 Bad Request.'
    },
    {
      id: 'c4-l2-q4',
      question: 'Khả năng kỹ thuật đặc trưng nào của NestJS Interceptor mà các thành phần khác như Guard hoặc Pipe hoàn toàn không thể thực hiện được?',
      options: [
        'Ép kiểu một tham số chuỗi ký tự trên đường dẫn URL thành kiểu số nguyên trước khi truyền vào đối số của phương thức xử lý trong Controller.',
        'Đọc địa chỉ IP nguồn của gói tin mạng để từ chối kết nối ngay tại tầng giao vận TCP trước khi bản tin HTTP được giải mã hoàn chỉnh.',
        'Tự động quét và khởi tạo các bảng dữ liệu còn thiếu trong cơ sở dữ liệu PostgreSQL tại thời điểm ứng dụng bắt đầu quá trình khởi động.',
        'Bao bọc hai chiều lời gọi hàm Handler nhờ luồng RxJS Observable: vừa chạy logic trước Controller, vừa biến đổi kết quả hoặc áp đặt Timeout sau đó.'
      ],
      correctIndex: 3,
      explanation: 'Interceptor hiện thực mô hình Lập trình Hướng Khía cạnh (AOP) dựa trên RxJS Observable thông qua CallHandler.handle(). Nhờ đó, nó là thành phần duy nhất có thể chạy code TRƯỚC khi vào Controller, quyết định có gọi Controller hay không (Cache Hit với of()), và dùng các toán tử map, tap, timeout, catchError để biến đổi kết quả SAU KHI Controller hoàn tất.'
    },
    {
      id: 'c4-l2-q5',
      question: 'Lớp trừu tượng ExecutionContext đóng vai trò kiến trúc quan trọng như thế nào khi xây dựng hệ thống Hybrid Microservices trong NestJS?',
      options: [
        'Kế thừa từ ArgumentsHost, cung cấp getClass(), getHandler() và các hàm switchToHttp/Rpc/Ws giúp dùng chung Guard và Interceptor trên mọi giao thức.',
        'Tự động phân phối tải đều theo thuật toán vòng tròn giữa các tiến trình Worker Threads bên trong cùng một máy chủ vật lý mà không cần cấu hình.',
        'Đồng bộ hóa trực tiếp các biến trạng thái trong bộ nhớ V8 Heap giữa nhiều cụm máy chủ chạy trên các vùng địa lý đám mây khác nhau.',
        'Biên dịch tự động các lớp DTO viết bằng TypeScript sang tệp định nghĩa giao diện nhị phân Protocol Buffers ngay trong lúc ứng dụng đang chạy.'
      ],
      correctIndex: 0,
      explanation: 'ExecutionContext kế thừa ArgumentsHost, bổ sung khả năng phản chiếu đích đến (getClass(), getHandler()) và cung cấp các phương thức chuyển đổi ngữ cảnh giao thức (switchToHttp(), switchToRpc(), switchToWs()). Nhờ đó, một Guard hoặc Interceptor duy nhất có thể chạy xuyên suốt trên HTTP REST, gRPC và WebSockets.'
    },
    {
      id: 'c4-l2-q6',
      question: 'Để đăng ký một LoggingInterceptor ở phạm vi toàn cục (Global Scope) nhưng vẫn cho phép tiêm ConfigService vào constructor của nó, cách nào đúng chuẩn?',
      options: [
        'Gọi hàm app.useGlobalInterceptors(new LoggingInterceptor()) bên trong tệp main.ts và truyền giá trị undefined vào vị trí tham số constructor.',
        'Khai báo tên lớp LoggingInterceptor vào mục globalInterceptors bên trong tệp cấu hình biên dịch tsconfig.json ở thư mục gốc của dự án.',
        'Đăng ký một Custom Provider với token APP_INTERCEPTOR và useClass: LoggingInterceptor ngay trong mảng providers của AppModule hoặc CoreModule.',
        'Gắn trực tiếp decorator @Global() lên phía trên từ khóa khai báo class LoggingInterceptor mà không cần đưa vào bất kỳ mảng providers nào.'
      ],
      correctIndex: 2,
      explanation: 'Nếu khởi tạo bằng app.useGlobalInterceptors(new LoggingInterceptor()) trong main.ts, đối tượng được tạo bên ngoài IoC Container nên không thể tiêm bất kỳ phụ thuộc nào. Cách chuẩn mực là đăng ký { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor } trong mảng providers của một Module để NestContainer quản lý và tiêm đầy đủ dependencies.'
    },
    {
      id: 'c4-l2-q7',
      question: 'Khi xây dựng một lớp Exception Filter và gắn decorator @Catch() hoàn toàn trống (không truyền bất kỳ tham số nào), hành vi của Filter đó là gì?',
      options: [
        'Chỉ đón bắt duy nhất các ngoại lệ có mã trạng thái 404 NotFoundException phát sinh khi người dùng gọi sai đường dẫn định tuyến của API.',
        'Bị bộ máy IoC Container của NestJS bỏ qua hoàn toàn và không bao giờ được kích hoạt trong suốt thời gian máy chủ hoạt động trên Production.',
        'Chỉ đón bắt các lỗi cú pháp biên dịch tĩnh phát sinh từ trình kiểm tra kiểu của TypeScript trước khi mã nguồn được đóng gói sang JavaScript.',
        'Trở thành bộ lọc bắt toàn bộ (Catch-All Exception Filter), đón bắt mọi ngoại lệ chưa được xử lý (cả HttpException lẫn Error hệ thống) để chuẩn hóa.'
      ],
      correctIndex: 3,
      explanation: 'Khi gọi @Catch() không truyền danh sách lớp ngoại lệ, NestJS hiểu đây là một Catch-All Filter có nhiệm vụ hứng mọi lỗi chưa được xử lý trong toàn bộ Pipeline (bao gồm cả lỗi runtime như TypeError, ReferenceError hay lỗi kết nối DB), giúp ẩn giấu Stack Trace nhạy cảm và trả về phản hồi lỗi 500 an toàn.'
    },
    {
      id: 'c4-l2-q8',
      question: 'Cấu hình nào trên ValidationPipe là bắt buộc để ngăn chặn lỗ hổng bảo mật Mass Assignment (người dùng tự chèn thêm trường isAdmin: true vào JSON)?',
      options: [
        'Bật đồng thời hai tùy chọn whitelist: true và forbidNonWhitelisted: true để tự động lọc bỏ hoặc từ chối ngay các trường không có decorator hợp lệ.',
        'Đặt tùy chọn disableErrorMessages: false để máy chủ trả về danh sách chi tiết toàn bộ các dòng mã nguồn bị lỗi cho trình duyệt của khách hàng.',
        'Chuyển phạm vi của ValidationPipe sang chế độ Scope.REQUEST để tạo mới lại bộ kiểm tra dữ liệu trên từng yêu cầu gửi tới máy chủ.',
        'Sử dụng hàm JSON.stringify kết hợp JSON.parse bên trong tầng Express Middleware trước khi chuyển gói tin vào bên trong bộ định tuyến.'
      ],
      correctIndex: 0,
      explanation: 'Khi bật whitelist: true, ValidationPipe sẽ tự động tước bỏ mọi thuộc tính trong JSON body không được khai báo kèm decorator kiểm định trong lớp DTO. Kết hợp thêm forbidNonWhitelisted: true sẽ lập tức ném lỗi 400 Bad Request nếu phát hiện bất kỳ trường lạ nào được gửi kèm, chặn đứng hoàn toàn tấn công Mass Assignment.'
    }
  ],
  codeChallenge: {
    id: 'c4-l2-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Mô Phỏng Trạm Kiểm Soát Guard & ValidationPipe Cắt Mạch Sớm (Short-Circuit)',
    description: 'Hiện thực hàm `runBasicPipeline(request)` nhận vào đối tượng `request: { token?: string; role?: string; age?: number }` và mô phỏng quy trình kiểm tra tuần tự qua 3 trạm của NestJS Pipeline:\n1. **Trạm Guard (Xác thực & Phân quyền):**\n   - Nếu thiếu `request.token` hoặc chuỗi `request.token.trim() === ""` -> Ngắt mạch trả về `{ status: 401, stage: "GUARD", body: "UNAUTHORIZED" }`.\n   - Nếu `request.role !== "ADMIN"` và `request.role !== "OPERATOR"` -> Ngắt mạch trả về `{ status: 403, stage: "GUARD", body: "FORBIDDEN_ROLE" }`.\n2. **Trạm Pipe (Kiểm định dữ liệu):**\n   - Nếu `typeof request.age !== "number"` hoặc `Number.isNaN(request.age)` hoặc `request.age < 18` -> Ngắt mạch trả về `{ status: 400, stage: "PIPE", body: "INVALID_AGE" }`.\n3. **Trạm Handler (Thực thi thành công):**\n   - Nếu vượt qua cả Guard và Pipe -> Trả về `{ status: 200, stage: "HANDLER", body: { allowed: true, role: request.role, age: request.age } }`.',
    guidedSteps: [
      'Bước 1 (Kiểm tra danh tính tại Guard - 401): Nếu !request || typeof request.token !== "string" || request.token.trim() === "" thì trả về ngay { status: 401, stage: "GUARD", body: "UNAUTHORIZED" }.',
      'Bước 2 (Kiểm tra vai trò tại Guard - 403): Nếu request.role !== "ADMIN" && request.role !== "OPERATOR" thì trả về ngay { status: 403, stage: "GUARD", body: "FORBIDDEN_ROLE" }.',
      'Bước 3 (Kiểm định độ tuổi tại Pipe - 400): Nếu typeof request.age !== "number" || Number.isNaN(request.age) || request.age < 18 thì trả về ngay { status: 400, stage: "PIPE", body: "INVALID_AGE" }.',
      'Bước 4 (Thực thi Controller Handler - 200): Trả về { status: 200, stage: "HANDLER", body: { allowed: true, role: request.role, age: request.age } }.'
    ],
    hints: [
      'Nguyên tắc cốt lõi của NestJS Pipeline là Guard luôn chạy trước Pipe: nếu một request vừa thiếu token vừa sai tuổi (age: 10), hệ thống phải trả về 401 tại GUARD chứ không được trả về 400 tại PIPE!',
      'Dùng Number.isNaN(request.age) để phòng trường hợp age truyền vào là NaN.'
    ],
    starterCode: `function runBasicPipeline(request) {
  // Bước 1: Kiểm tra token tại Guard (401 UNAUTHORIZED)
  
  // Bước 2: Kiểm tra role tại Guard (403 FORBIDDEN_ROLE)
  
  // Bước 3: Kiểm tra age tại Pipe (400 INVALID_AGE)
  
  // Bước 4: Trả về kết quả thành công tại Handler (200 HANDLER)
}`,
    solution: `function runBasicPipeline(request) {
  if (!request || typeof request.token !== 'string' || request.token.trim() === '') {
    return { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' };
  }

  if (request.role !== 'ADMIN' && request.role !== 'OPERATOR') {
    return { status: 403, stage: 'GUARD', body: 'FORBIDDEN_ROLE' };
  }

  if (
    typeof request.age !== 'number' ||
    Number.isNaN(request.age) ||
    request.age < 18
  ) {
    return { status: 400, stage: 'PIPE', body: 'INVALID_AGE' };
  }

  return {
    status: 200,
    stage: 'HANDLER',
    body: {
      allowed: true,
      role: request.role,
      age: request.age,
    },
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Chặn sớm tại Guard (401) khi thiếu token dù age cũng không hợp lệ',
        input: [{ role: 'ADMIN', age: 12 }],
        expected: { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Chặn tại Guard (403) khi token hợp lệ nhưng role là GUEST',
        input: [{ token: 'jwt-valid', role: 'GUEST', age: 25 }],
        expected: { status: 403, stage: 'GUARD', body: 'FORBIDDEN_ROLE' },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Vượt qua Guard nhưng bị chặn tại Pipe (400) do age < 18',
        input: [{ token: 'jwt-valid', role: 'OPERATOR', age: 16 }],
        expected: { status: 400, stage: 'PIPE', body: 'INVALID_AGE' },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Thực thi thành công qua toàn bộ Pipeline với role ADMIN và age = 18',
        input: [{ token: 'jwt-admin', role: 'ADMIN', age: 18 }],
        expected: {
          status: 200,
          stage: 'HANDLER',
          body: { allowed: true, role: 'ADMIN', age: 18 }
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Token chỉ chứa khoảng trắng rỗng -> Chặn ngay tại Guard (401)',
        input: [{ token: '    ', role: 'ADMIN', age: 30 }],
        expected: { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      id: 'c4-l2-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Mô Phỏng Trạm Kiểm Soát Guard & ValidationPipe Cắt Mạch Sớm (Short-Circuit)',
      description: 'Hiện thực hàm `runBasicPipeline(request)` nhận vào đối tượng `request: { token?: string; role?: string; age?: number }` và mô phỏng quy trình kiểm tra tuần tự qua 3 trạm của NestJS Pipeline:\n1. **Trạm Guard (Xác thực & Phân quyền):**\n   - Nếu thiếu `request.token` hoặc chuỗi `request.token.trim() === ""` -> Ngắt mạch trả về `{ status: 401, stage: "GUARD", body: "UNAUTHORIZED" }`.\n   - Nếu `request.role !== "ADMIN"` và `request.role !== "OPERATOR"` -> Ngắt mạch trả về `{ status: 403, stage: "GUARD", body: "FORBIDDEN_ROLE" }`.\n2. **Trạm Pipe (Kiểm định dữ liệu):**\n   - Nếu `typeof request.age !== "number"` hoặc `Number.isNaN(request.age)` hoặc `request.age < 18` -> Ngắt mạch trả về `{ status: 400, stage: "PIPE", body: "INVALID_AGE" }`.\n3. **Trạm Handler (Thực thi thành công):**\n   - Nếu vượt qua cả Guard và Pipe -> Trả về `{ status: 200, stage: "HANDLER", body: { allowed: true, role: request.role, age: request.age } }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra danh tính tại Guard - 401): Nếu !request || typeof request.token !== "string" || request.token.trim() === "" thì trả về ngay { status: 401, stage: "GUARD", body: "UNAUTHORIZED" }.',
        'Bước 2 (Kiểm tra vai trò tại Guard - 403): Nếu request.role !== "ADMIN" && request.role !== "OPERATOR" thì trả về ngay { status: 403, stage: "GUARD", body: "FORBIDDEN_ROLE" }.',
        'Bước 3 (Kiểm định độ tuổi tại Pipe - 400): Nếu typeof request.age !== "number" || Number.isNaN(request.age) || request.age < 18 thì trả về ngay { status: 400, stage: "PIPE", body: "INVALID_AGE" }.',
        'Bước 4 (Thực thi Controller Handler - 200): Trả về { status: 200, stage: "HANDLER", body: { allowed: true, role: request.role, age: request.age } }.'
      ],
      hints: [
        'Nguyên tắc cốt lõi của NestJS Pipeline là Guard luôn chạy trước Pipe: nếu một request vừa thiếu token vừa sai tuổi (age: 10), hệ thống phải trả về 401 tại GUARD chứ không được trả về 400 tại PIPE!',
        'Dùng Number.isNaN(request.age) để phòng trường hợp age truyền vào là NaN.'
      ],
      starterCode: `function runBasicPipeline(request) {
  // Bước 1: Kiểm tra token tại Guard (401 UNAUTHORIZED)
  
  // Bước 2: Kiểm tra role tại Guard (403 FORBIDDEN_ROLE)
  
  // Bước 3: Kiểm tra age tại Pipe (400 INVALID_AGE)
  
  // Bước 4: Trả về kết quả thành công tại Handler (200 HANDLER)
}`,
      solution: `function runBasicPipeline(request) {
  if (!request || typeof request.token !== 'string' || request.token.trim() === '') {
    return { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' };
  }

  if (request.role !== 'ADMIN' && request.role !== 'OPERATOR') {
    return { status: 403, stage: 'GUARD', body: 'FORBIDDEN_ROLE' };
  }

  if (
    typeof request.age !== 'number' ||
    Number.isNaN(request.age) ||
    request.age < 18
  ) {
    return { status: 400, stage: 'PIPE', body: 'INVALID_AGE' };
  }

  return {
    status: 200,
    stage: 'HANDLER',
    body: {
      allowed: true,
      role: request.role,
      age: request.age,
    },
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Chặn sớm tại Guard (401) khi thiếu token dù age cũng không hợp lệ',
          input: [{ role: 'ADMIN', age: 12 }],
          expected: { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Chặn tại Guard (403) khi token hợp lệ nhưng role là GUEST',
          input: [{ token: 'jwt-valid', role: 'GUEST', age: 25 }],
          expected: { status: 403, stage: 'GUARD', body: 'FORBIDDEN_ROLE' },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Vượt qua Guard nhưng bị chặn tại Pipe (400) do age < 18',
          input: [{ token: 'jwt-valid', role: 'OPERATOR', age: 16 }],
          expected: { status: 400, stage: 'PIPE', body: 'INVALID_AGE' },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Thực thi thành công qua toàn bộ Pipeline với role ADMIN và age = 18',
          input: [{ token: 'jwt-admin', role: 'ADMIN', age: 18 }],
          expected: {
            status: 200,
            stage: 'HANDLER',
            body: { allowed: true, role: 'ADMIN', age: 18 }
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Token chỉ chứa khoảng trắng rỗng -> Chặn ngay tại Guard (401)',
          input: [{ token: '    ', role: 'ADMIN', age: 30 }],
          expected: { status: 401, stage: 'GUARD', body: 'UNAUTHORIZED' },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l2-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Truy Vết Thứ Tự Thực Thi Củ Hành (Onion LIFO Trace) Của Multi-Scope Interceptors',
      description: 'Hiện thực hàm `traceRequestExecutionOrder(interceptorNames, pipeNames, shouldFailAtPipe)` để mô phỏng chính xác nhật ký thực thi (`executionLog: string[]`) của một Request đi qua các `Interceptors` (ví dụ `["GLOBAL", "CONTROLLER", "ROUTE"]`) và các `Pipes`.\nQuy tắc:\n1. **Pha Pre-Controller của Interceptors (Từ Ngoài vào Trong):** Duyệt `interceptorNames` từ đầu đến cuối, đẩy `"PRE_INTERCEPTOR:" + name` vào `executionLog`.\n2. **Pha Pipes (Từ Ngoài vào Trong):** Duyệt `pipeNames` từ đầu đến cuối, đẩy `"PIPE:" + p` vào `executionLog`. Nếu `shouldFailAtPipe === true`, ngay sau khi chạy xong Pipe đầu tiên trong danh sách, đẩy `"EXCEPTION_FILTER:400_BAD_REQUEST"` vào `executionLog` và dừng ngay lập tức (không chạy các Pipe còn lại, không gọi Controller, không chạy Post-Interceptor!).\n3. **Pha Controller Handler:** Nếu không lỗi tại Pipe, đẩy `"CONTROLLER_HANDLER"` vào `executionLog`.\n4. **Pha Post-Controller RxJS Stream của Interceptors (Từ Trong ra Ngoài - LIFO):** Duyệt ngược mảng `interceptorNames` từ cuối về đầu, đẩy `"POST_INTERCEPTOR:" + name` vào `executionLog`.\nTrả về `{ executionLog, totalSteps: executionLog.length, completedNormally: !shouldFailAtPipe }`.',
      guidedSteps: [
        'Bước 1 (Ghi nhận pha Pre-Interceptor): Duyệt mảng interceptorNames theo chiều thuận (0 -> length - 1) và đẩy "PRE_INTERCEPTOR:" + name vào executionLog.',
        'Bước 2 (Ghi nhận pha Pipe và xử lý ngắt mạch): Duyệt mảng pipeNames; đẩy "PIPE:" + p vào executionLog. Nếu shouldFailAtPipe === true thì đẩy thêm "EXCEPTION_FILTER:400_BAD_REQUEST" và trả về ngay { executionLog, totalSteps: executionLog.length, completedNormally: false }.',
        'Bước 3 (Ghi nhận Controller Handler): Đẩy "CONTROLLER_HANDLER" vào executionLog.',
        'Bước 4 (Ghi nhận pha Post-Interceptor theo thứ tự đảo ngược LIFO): Duyệt ngược mảng interceptorNames từ phần tử cuối về phần tử đầu, đẩy "POST_INTERCEPTOR:" + name và trả về kết quả.'
      ],
      hints: [
        'Để duyệt ngược mảng interceptorNames mà không làm biến đổi mảng gốc, hãy dùng vòng lặp for (let i = interceptorNames.length - 1; i >= 0; i--) hoặc [...interceptorNames].reverse().',
        'Lưu ý khi shouldFailAtPipe === true: Pipe đầu tiên vẫn được ghi vào log ("PIPE:" + pipeNames[0]) trước khi ném ngoại lệ sang "EXCEPTION_FILTER:400_BAD_REQUEST".'
      ],
      starterCode: `function traceRequestExecutionOrder(interceptorNames, pipeNames, shouldFailAtPipe) {
  // Bước 1: Duyệt thuận interceptorNames đẩy "PRE_INTERCEPTOR:<name>"
  
  // Bước 2: Duyệt pipeNames đẩy "PIPE:<name>"; nếu shouldFailAtPipe === true thì đẩy "EXCEPTION_FILTER:400_BAD_REQUEST" và dừng
  
  // Bước 3: Đẩy "CONTROLLER_HANDLER"
  
  // Bước 4: Duyệt ngược (LIFO) interceptorNames đẩy "POST_INTERCEPTOR:<name>" và trả về kết quả
}`,
      solution: `function traceRequestExecutionOrder(interceptorNames, pipeNames, shouldFailAtPipe) {
  const executionLog = [];
  const interceptors = Array.isArray(interceptorNames) ? interceptorNames : [];
  const pipes = Array.isArray(pipeNames) ? pipeNames : [];

  for (const name of interceptors) {
    executionLog.push(\`PRE_INTERCEPTOR:\${name}\`);
  }

  for (const pipe of pipes) {
    executionLog.push(\`PIPE:\${pipe}\`);
    if (shouldFailAtPipe) {
      executionLog.push('EXCEPTION_FILTER:400_BAD_REQUEST');
      return {
        executionLog,
        totalSteps: executionLog.length,
        completedNormally: false,
      };
    }
  }

  executionLog.push('CONTROLLER_HANDLER');

  for (let i = interceptors.length - 1; i >= 0; i--) {
    executionLog.push(\`POST_INTERCEPTOR:\${interceptors[i]}\`);
  }

  return {
    executionLog,
    totalSteps: executionLog.length,
    completedNormally: true,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Thực thi thành công qua 3 cấp Interceptor (Global -> Controller -> Route) và tháo gỡ ngược LIFO',
          input: [['GLOBAL', 'CONTROLLER', 'ROUTE'], ['VALIDATION_PIPE'], false],
          expected: {
            executionLog: [
              'PRE_INTERCEPTOR:GLOBAL',
              'PRE_INTERCEPTOR:CONTROLLER',
              'PRE_INTERCEPTOR:ROUTE',
              'PIPE:VALIDATION_PIPE',
              'CONTROLLER_HANDLER',
              'POST_INTERCEPTOR:ROUTE',
              'POST_INTERCEPTOR:CONTROLLER',
              'POST_INTERCEPTOR:GLOBAL'
            ],
            totalSteps: 8,
            completedNormally: true
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Lỗi tại Pipe đầu tiên làm ngắt mạch, bỏ qua Pipe thứ 2, Controller và Post-Interceptors',
          input: [['GLOBAL', 'ROUTE'], ['GLOBAL_PIPE', 'PARAM_PIPE'], true],
          expected: {
            executionLog: [
              'PRE_INTERCEPTOR:GLOBAL',
              'PRE_INTERCEPTOR:ROUTE',
              'PIPE:GLOBAL_PIPE',
              'EXCEPTION_FILTER:400_BAD_REQUEST'
            ],
            totalSteps: 4,
            completedNormally: false
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Endpoint không gắn Interceptor hay Pipe nào',
          input: [[], [], false],
          expected: {
            executionLog: ['CONTROLLER_HANDLER'],
            totalSteps: 1,
            completedNormally: true
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: 1 Global Interceptor kết hợp 2 Pipes chạy thành công',
          input: [['GLOBAL'], ['PARSE_UUID', 'VALIDATION'], false],
          expected: {
            executionLog: [
              'PRE_INTERCEPTOR:GLOBAL',
              'PIPE:PARSE_UUID',
              'PIPE:VALIDATION',
              'CONTROLLER_HANDLER',
              'POST_INTERCEPTOR:GLOBAL'
            ],
            totalSteps: 5,
            completedNormally: true
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Kiểm tra thứ tự LIFO với 2 Interceptors',
          input: [['LOGGING', 'TRANSFORM'], [], false],
          expected: {
            executionLog: [
              'PRE_INTERCEPTOR:LOGGING',
              'PRE_INTERCEPTOR:TRANSFORM',
              'CONTROLLER_HANDLER',
              'POST_INTERCEPTOR:TRANSFORM',
              'POST_INTERCEPTOR:LOGGING'
            ],
            totalSteps: 5,
            completedNormally: true
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l2-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng ValidationPipe Chống Mass Assignment (Whitelist & ForbidNonWhitelisted Engine)',
      description: 'Hiện thực hàm `sanitizeAndValidateDto(rawPayload, allowedFields, forbidNonWhitelisted)` mô phỏng thuật toán bảo mật cốt lõi của `ValidationPipe` trong NestJS.\nTham số:\n- `rawPayload`: Đối tượng JSON đầu vào cần kiểm định.\n- `allowedFields`: Mảng cấu hình các trường hợp lệ trong DTO `Array<{ field: string; type: "string" | "number" | "boolean"; required: boolean }>`.\n- `forbidNonWhitelisted`: Cờ boolean.\nRàng buộc Phòng thủ (Defensive Guards):\n1. Nếu `!rawPayload` hoặc `typeof rawPayload !== "object"` hoặc `Array.isArray(rawPayload)` hoặc `!Array.isArray(allowedFields)` hoặc `allowedFields.length === 0`, chủ động `throw new Error("INVALID_PIPE_CONFIGURATION")`.\n2. Tìm tất cả các khóa có trong `rawPayload` nhưng KHÔNG nằm trong danh sách `allowedFields` đưa vào mảng `strippedFields`. Nếu `forbidNonWhitelisted === true` và `strippedFields.length > 0`, chủ động `throw new Error("MASS_ASSIGNMENT_FORBIDDEN_FIELDS")`.\n3. Duyệt qua `allowedFields`: nếu trường có `required === true` mà giá trị trong `rawPayload` là `undefined` hoặc `null`, hoặc nếu trường có mặt trong `rawPayload` (khác `undefined`/`null`) nhưng `typeof rawPayload[field] !== item.type`, chủ động `throw new Error("DTO_VALIDATION_FAILED")`.\n4. Sao chép các trường hợp lệ sang đối tượng `sanitizedDto` và trả về `{ sanitizedDto, strippedFields, strippedCount: strippedFields.length }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra cấu hình đầu vào): Nếu rawPayload không phải plain object hoặc allowedFields không phải mảng có phần tử, throw new Error("INVALID_PIPE_CONFIGURATION").',
        'Bước 2 (Phát hiện các trường lạ - Mass Assignment): Lọc các key của Object.keys(rawPayload) không nằm trong allowedFields vào mảng strippedFields. Nếu forbidNonWhitelisted && strippedFields.length > 0 thì throw new Error("MASS_ASSIGNMENT_FORBIDDEN_FIELDS").',
        'Bước 3 (Kiểm định kiểu dữ liệu và trường bắt buộc): Duyệt từng cấu hình trong allowedFields; kiểm tra required và typeof val === item.type. Nếu vi phạm thì throw new Error("DTO_VALIDATION_FAILED").',
        'Bước 4 (Đóng gói DTO sạch): Đưa các trường hợp lệ có mặt trong rawPayload vào sanitizedDto và trả về { sanitizedDto, strippedFields, strippedCount: strippedFields.length }.'
      ],
      hints: [
        'Khi kiểm tra typeof val === "number", hãy kiểm tra thêm !Number.isNaN(val) để đảm bảo giá trị số hợp lệ.',
        'Nếu một trường có required: false và giá trị trong rawPayload là undefined, không đưa khóa đó vào sanitizedDto và cũng không báo lỗi.'
      ],
      starterCode: `function sanitizeAndValidateDto(rawPayload, allowedFields, forbidNonWhitelisted) {
  // Bước 1: Kiểm tra tính hợp lệ của rawPayload và allowedFields ("INVALID_PIPE_CONFIGURATION")
  
  // Bước 2: Tìm các trường không nằm trong whitelist; nếu forbidNonWhitelisted === true và có trường lạ thì ném "MASS_ASSIGNMENT_FORBIDDEN_FIELDS"
  
  // Bước 3: Kiểm tra các trường required và kiểu dữ liệu ("DTO_VALIDATION_FAILED")
  
  // Bước 4: Trả về { sanitizedDto, strippedFields, strippedCount }
}`,
      solution: `function sanitizeAndValidateDto(rawPayload, allowedFields, forbidNonWhitelisted) {
  if (
    !rawPayload ||
    typeof rawPayload !== 'object' ||
    Array.isArray(rawPayload) ||
    !Array.isArray(allowedFields) ||
    allowedFields.length === 0
  ) {
    throw new Error('INVALID_PIPE_CONFIGURATION');
  }

  const allowedMap = new Map();
  for (const item of allowedFields) {
    allowedMap.set(item.field, item);
  }

  const strippedFields = [];
  for (const key of Object.keys(rawPayload)) {
    if (!allowedMap.has(key)) {
      strippedFields.push(key);
    }
  }

  if (forbidNonWhitelisted === true && strippedFields.length > 0) {
    throw new Error('MASS_ASSIGNMENT_FORBIDDEN_FIELDS');
  }

  const sanitizedDto = {};
  for (const rule of allowedFields) {
    const val = rawPayload[rule.field];
    if (val === undefined || val === null) {
      if (rule.required) {
        throw new Error('DTO_VALIDATION_FAILED');
      }
      continue;
    }

    if (
      typeof val !== rule.type ||
      (rule.type === 'number' && Number.isNaN(val))
    ) {
      throw new Error('DTO_VALIDATION_FAILED');
    }

    sanitizedDto[rule.field] = val;
  }

  return {
    sanitizedDto,
    strippedFields,
    strippedCount: strippedFields.length,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Tước bỏ thành công các trường độc hại (isAdmin, balance) khi bật whitelist (forbidNonWhitelisted = false)',
          input: [
            { email: 'dev@arc.tech', age: 24, isAdmin: true, balance: 999999 },
            [
              { field: 'email', type: 'string', required: true },
              { field: 'age', type: 'number', required: false }
            ],
            false
          ],
          expected: {
            sanitizedDto: { email: 'dev@arc.tech', age: 24 },
            strippedFields: ['isAdmin', 'balance'],
            strippedCount: 2
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Ném lỗi MASS_ASSIGNMENT_FORBIDDEN_FIELDS khi forbidNonWhitelisted = true và có trường lạ',
          input: [
            { email: 'hacker@arc.tech', role: 'SUPER_ADMIN' },
            [{ field: 'email', type: 'string', required: true }],
            true
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 3 công khai: Ném lỗi DTO_VALIDATION_FAILED khi kiểu dữ liệu sai (age là string thay vì number)',
          input: [
            { email: 'user@arc.tech', age: '25' },
            [
              { field: 'email', type: 'string', required: true },
              { field: 'age', type: 'number', required: true }
            ],
            true
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ném lỗi DTO_VALIDATION_FAILED khi thiếu trường bắt buộc (required: true)',
          input: [
            { age: 30 },
            [
              { field: 'email', type: 'string', required: true },
              { field: 'age', type: 'number', required: false }
            ],
            false
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Ném lỗi INVALID_PIPE_CONFIGURATION khi rawPayload là mảng hoặc null',
          input: [null, [{ field: 'email', type: 'string', required: true }], true],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
