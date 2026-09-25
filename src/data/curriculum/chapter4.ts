import type { Sprint } from './types.ts';

export const chapter4: Sprint = {
  sprintId: 4,
  sprintTitle: 'Chương 4: NestJS Core Architecture: IoC Container, Metadata Reflection & Request Pipeline',
  sprintDesc: 'Đào sâu vào động cơ cốt lõi của NestJS: Inversion of Control, Reflect Metadata, Đồ thị phụ thuộc DAG & Circular Dependency, Request Execution Pipeline và Hiểm họa Scopes',
  lessons: [
    {
      id: 'c4-l1',
      title: 'Bài 01: Inversion of Control (IoC), Dependency Injection & TypeScript Reflect Metadata Internals',
      duration: '60 phút',
      tag: 'NestJS Internals & DI',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: SỰ TIẾN HÓA TỪ TIGHT COUPLING SANG INVERSION OF CONTROL & METADATA-DRIVEN ARCHITECTURE (ARCHITECTURAL CONTEXT & CORE PROBLEM)

Trong thiết kế hệ thống phần mềm doanh nghiệp (Enterprise Architecture), sự chuyển dịch từ lập trình hướng đối tượng thủ công sang Inversion of Control (IoC) giải quyết trực diện các bài toán sinh tử về khả năng mở rộng, bảo trì và kiểm thử tự động:
* **Hiểm họa của Liên kết cứng (Tight Coupling):** Khi một Class nghiệp vụ tự khởi tạo các phụ thuộc cấp thấp của nó (\`this.paymentService = new StripePaymentService(new HttpClient())\`), Class này bị gắn chặt với hiện thực cụ thể đó. Hậu quả kỹ thuật: Không thể hoán đổi cổng thanh toán (chẳng hạn sang VNPay hay PayPal) mà không sửa mã nguồn lõi; không thể viết Unit Test cô lập (Unit Isolation Test) vì không thể đưa Mock Service vào kiểm thử; và bất kỳ sự thay đổi constructor nào ở tầng dưới cùng cũng gây hiệu ứng sụp đổ dây chuyền (Cascading Breaking Changes) lên toàn bộ các tầng phía trên.
* **Nguyên lý Đảo ngược Quyền điều khiển (Inversion of Control - IoC):** Thay vì các module nghiệp vụ chủ động khởi tạo và quản lý vòng đời tài nguyên, quyền kiểm soát việc cấp phát, lắp ghép và giải phóng đối tượng được chuyển giao hoàn toàn cho một thực thể trung tâm: **IoC Container**. Module chỉ việc khai báo "Hợp đồng phụ thuộc" thông qua Interface/Type, IoC Container chịu trách nhiệm phân giải đồ thị phụ thuộc (Dependency Graph Resolution) và cung cấp chính xác instance đã sẵn sàng tại thời điểm thực thi.
* **Cơ chế Metadata Reflection & Vấn nạn Type Erasure:** Do TypeScript áp dụng cơ chế xóa kiểu (Type Erasure) khi biên dịch sang JavaScript thuần chạy trên Node.js runtime, toàn bộ Interface và Type Annotations bị biến mất. NestJS giải quyết triệt để rào cản này bằng cách kết hợp Decorator (\`@Injectable()\`, \`@Inject()\`) với chuẩn **\`reflect-metadata\`**, lưu vết định danh kiểu dữ liệu vào runtime metadata (\`design:paramtypes\`), tạo nền tảng để IoC Container tự động phân giải phụ thuộc chính xác mà không đòi hỏi boilerplate code thủ công.

---

# 2. CƠ CHẾ REFLECT METADATA DƯỚI TẦNG TYPESCRIPT

JavaScript thuần túy trong lúc chạy (Runtime) không hề biết \`constructor(private readonly authService: AuthService)\` có kiểu là \`AuthService\`. Tất cả các interface và type annotations đều bị TypeScript compiler xóa sạch (Type Erasure).
Để NestJS có thể tự động "bơm" (Inject) đúng đối tượng, nó dựa vào chuẩn **\`reflect-metadata\`**:

\`\`\`typescript
// Khi bật "emitDecoratorMetadata": true trong tsconfig.json,
// đoạn code NestJS sau:
@Injectable()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}

// Sẽ được TypeScript biên dịch thành JavaScript như sau:
__decorate([
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [UsersService]) // <--- LƯU VẾT THAM CHIẾU CLASS VÀO RUNTIME!
], UsersController);
\`\`\`

### 2.1 Cách IoC Container Phân Giải Phụ Thuộc (Resolution Algorithm)
Khi ứng dụng khởi động (\`NestFactory.create(AppModule)\`), IoC Container thực hiện:
1. Duyệt qua mảng \`providers\` và \`controllers\` của tất cả các Module.
2. Dùng \`Reflect.getMetadata('design:paramtypes', TargetClass)\` để đọc danh sách các class mà Constructor yêu cầu.
3. Nếu dependency chưa được khởi tạo, Container đệ quy đi tìm và khởi tạo dependency đó trước.
4. Sau khi các dependency đã sẵn sàng trong bộ nhớ RAM, gọi \`new TargetClass(...dependencies)\` và lưu instance này vào bộ nhớ đệm Cache (Singleton Registry).

---

# 3. NGUYÊN TẮC THIẾT KẾ DEPENDENCY INVERSION (CHỮ 'D' TRONG SOLID)

Rất nhiều lập trình viên nhầm lẫn giữa **Dependency Injection (DI)** và **Dependency Inversion Principle (DIP)**:
* **Dependency Injection (DI):** Là một mẫu hình thiết kế (Design Pattern) hoặc công cụ kỹ thuật để đưa phụ thuộc từ bên ngoài vào qua Constructor/Setter.
* **Dependency Inversion (DIP):** Là một nguyên lý kiến trúc bậc cao: **Module cấp cao không được phụ thuộc trực tiếp vào module cấp thấp. Cả hai phải cùng phụ thuộc vào sự trừu tượng (Abstraction / Interface).**

\`\`\`diagram
MÔ HÌNH SAI (VI PHẠM DIP):
[ OrderService (Cấp cao) ] ──────phụ thuộc trực tiếp─────► [ StripePayment (Cấp thấp) ]
(Hệ thống bị trói chặt vào Stripe, không thể đổi sang Paypal hay Mock Test)

MÔ HÌNH ĐÚNG (TUÂN THỦ DIP VỚI INJECTION TOKEN):
[ OrderService (Cấp cao) ] ──────► [ Interface: IPaymentGateway ] ◄────── [ StripeService ]
                                                                   ◄────── [ PaypalService ]
                                                                   ◄────── [ MockPaymentService ]
\`\`\`

Trong NestJS, vì TypeScript Interface bị xóa khi chạy runtime, ta sử dụng **Symbol** hoặc **String Token** làm Injection Token:
\`\`\`typescript
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

@Injectable()
export class OrderService {
  constructor(
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway
  ) {}
}
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Cấu Trúc Khối Của IoC Container (Container Taxonomy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NESTJS IOC CONTAINER ROOT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. METADATA REGISTRY (Reflect Metadata)                                     │
│    ├── 'design:paramtypes' (Các class phụ thuộc của Constructor)            │
│    ├── '__injectable__' / '__controller__' flags                            │
│    └── Custom Metadata Keys (@Roles, @SetMetadata)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. INSTANCE WRAPPER REGISTRY (Kho lưu trữ cá thể)                           │
│    ├── Singleton Cache: Map<Token, Instance> (99% Service sống ở đây)       │
│    └── Scoped Provider Factories: Tạo mới instance cho từng Request/Transient│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. MODULE GRAPH (Cây quan hệ Module)                                        │
│    ├── Import / Export Links (Kiểm soát tính đóng gói Encapsulation)        │
│    └── Global Modules Registry (ConfigService, DatabaseService)             │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Khởi Tạo Đối Tượng Tự Động (Instance Resolution Lifecycle)
\`\`\`diagram
Yêu cầu khởi tạo một Controller (vd: UsersController)
   │
   ▼
Đọc Metadata Constructor: Reflect.getMetadata('design:paramtypes')
   │ (Phát hiện cần: [UsersService, ConfigService])
   ▼
Kiểm tra trong Singleton Cache:
   ├── UsersService đã có trong Cache chưa?
   │     ├── [ CHƯA ] ──► Đệ quy khởi tạo UsersService (và các dependency của nó)
   │     └── [ ĐÃ CÓ ] ─► Lấy con trỏ tham chiếu từ Cache
   │
   └── ConfigService đã có trong Cache chưa? ──► Lấy từ Cache
   │
   ▼
Gọi Reflection Constructor: new UsersController(cachedUsersService, cachedConfigService)
   │
   ▼
Đưa Instance vừa tạo vào Container Cache & Gắn Route vào Express/Fastify Adapter
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Cơ Chế Inject (Provider Injection Decision Tree)
\`\`\`diagram
BẠN CẦN ĐĂNG KÝ MỘT PROVIDER VÀO MODULE?
│
├── Là một Class thông thường có @Injectable()?
│   └──► Dùng Class Provider chuẩn: providers: [UsersService]
│
├── Cần hoán đổi linh hoạt theo môi trường (Mock vs Production)?
│   └──► Dùng useClass hoặc useValue:
│        { provide: PAYMENT_SERVICE, useClass: isProd ? StripeService : MockService }
│
├── Cần logic tính toán hoặc đọc cấu hình bất đồng bộ trước khi tạo Service?
│   └──► Dùng Factory Provider:
│        { provide: DB_CONN, useFactory: async (config) => await connect(config), inject: [ConfigService] }
│
└── Cần một hằng số cố định, đối tượng JSON tĩnh hoặc third-party SDK instance?
    └──► Dùng Value Provider:
         { provide: 'APP_CONFIG', useValue: Object.freeze(staticConfig) }
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Kiểu Đăng Ký Provider | Thời Điểm Khởi Tạo | Khả Năng Dynamic Config | Chi Phí Bộ Nhớ | Mức Độ Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Class** | Bootstrapping (Khởi động) | Cố định, không linh hoạt | Cực thấp (1 Instance duy nhất)| Mặc định cho $95\\%$ dịch vụ nội bộ |
| **useValue** | Bootstrapping | Truyền object cố định sẵn | Phụ thuộc object truyền vào | Dành cho SDK client, config tĩnh |
| **useFactory (Async)** | Bootstrapping (Chờ Promise)| Cực kỳ linh hoạt, đọc async | Khởi tạo 1 lần lúc startup | Kết nối Database, Microservice Client |
| **useExisting** | Bootstrapping | Tạo bí danh (Alias) cho token| $0\\%$ (Trỏ chung con trỏ) | Đổi tên token mà không duplicate RAM |
`,
      realCodeSnippet: `// File: src/modules/notification/notification.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - Decoupled Notification Architecture with DIP
import { Injectable, Inject, Logger } from '@nestjs/common';

export const NOTIFICATION_GATEWAY = Symbol('NOTIFICATION_GATEWAY');

export interface NotificationPayload {
  recipient: string;
  subject: string;
  body: string;
}

export interface INotificationGateway {
  send(payload: NotificationPayload): Promise<boolean>;
}

@Injectable()
export class SendGridNotificationGateway implements INotificationGateway {
  private readonly logger = new Logger(SendGridNotificationGateway.name);

  async send(payload: NotificationPayload): Promise<boolean> {
    this.logger.log(\`[SendGrid Gateway] Gửi email đến: \${payload.recipient} - Chủ đề: \${payload.subject}\`);
    return true;
  }
}

/**
 * ADR: Áp dụng Dependency Inversion Principle (DIP):
 * - UserNotificationService (Cấp cao) chỉ phụ thuộc vào Interface INotificationGateway trừu tượng.
 * - Được inject thông qua Symbol NOTIFICATION_GATEWAY, không phụ thuộc vào SendGrid cụ thể.
 * - Cho phép hoán đổi cổng thông báo (AWS SES, Twilio, MockGateway) dễ dàng trong Module configuration.
 */
@Injectable()
export class UserNotificationService {
  constructor(
    @Inject(NOTIFICATION_GATEWAY)
    private readonly gateway: INotificationGateway,
  ) {}

  public async notifyUserWelcome(email: string): Promise<boolean> {
    return this.gateway.send({
      recipient: email,
      subject: 'Chào mừng bạn gia nhập hệ thống!',
      body: 'Tài khoản của bạn đã được kích hoạt thành công.',
    });
  }
}`,
      quiz: [
        {
          id: 'c4-l1-q1',
          question: 'Cơ chế kỹ thuật nào cho phép NestJS IoC Container tự động phân giải đúng các Class Constructor phụ thuộc trong hàm khởi tạo của một Service?',
          options: [
            'Sử dụng thư viện reflect-metadata kết hợp với cờ compiler emitDecoratorMetadata: true của TypeScript để phát sinh metadata design:paramtypes lưu vết tham chiếu của các class tại runtime.',
            'Dựa vào trình phân tích tĩnh (Static AST parser) của Webpack trong quá trình bundle mã nguồn.',
            'Tự động gửi truy vấn kiểm tra danh mục lớp đối tượng lên dịch vụ Cloud Schema Registry.',
            'Phân tích tên biến tham số trong constructor bằng Regular Expression và ánh xạ theo quy tắc CamelCase.'
          ],
          correctIndex: 0,
          explanation: 'Khi bật emitDecoratorMetadata, TypeScript compiler lưu vết các kiểu dữ liệu của constructor parameters vào metadata mang tên "design:paramtypes" tại runtime. NestJS dùng reflect-metadata để đọc các constructor function này và đệ quy khởi tạo dependency.'
        },
        {
          id: 'c4-l1-q2',
          question: 'Vì sao trong NestJS, khi thực thi nguyên lý Dependency Inversion (DIP) để inject một Interface trừu tượng, ta bắt buộc phải sử dụng Custom Token (Symbol hoặc String) đi kèm decorator @Inject()?',
          options: [
            'Vì NestJS IoC Container bị giới hạn chỉ hỗ trợ nạp các class có kích thước dưới 10KB.',
            'Vì việc dùng class làm token sẽ làm chậm tốc độ khởi động của ứng dụng do xung đột bộ nhớ Stack.',
            'Vì TypeScript áp dụng cơ chế Type Erasure (xóa sạch toàn bộ Interface và Type Alias khi biên dịch sang JavaScript thuần), khiến chúng không còn tồn tại ở Runtime để Reflect Metadata có thể lưu vết; do đó cần một giá trị Runtime cụ thể (String/Symbol) làm Injection Token.',
            'Vì chuẩn ECMAScript mới nhất đã cấm hoàn toàn việc sử dụng từ khóa interface trong các ứng dụng máy chủ.'
          ],
          correctIndex: 2,
          explanation: 'Interface chỉ tồn tại trong giai đoạn biên dịch type-check của TypeScript. Khi sang mã JavaScript runtime, interface bị xóa hoàn toàn (Type Erasure). Do đó Reflect.getMetadata("design:paramtypes") trả về Object chung chung chứ không biết interface nào. Ta bắt buộc phải dùng @Inject(CUSTOM_TOKEN) với String hoặc Symbol để định danh dependency.'
        },
        {
          id: 'c4-l1-q3',
          question: 'Điểm khác biệt bản chất giữa Dependency Injection (DI) và Dependency Inversion Principle (DIP) trong thiết kế kiến trúc phần mềm là gì?',
          options: [
            'DI là công cụ biên dịch của Babel, còn DIP là một thư viện kiểm thử tự động của Jest.',
            'DI là một kỹ thuật / thiết kế mẫu (Design Pattern) dùng để truyền đối tượng phụ thuộc vào class từ bên ngoài (thường qua Constructor); còn DIP là một nguyên lý kiến trúc bậc cao (chữ D trong SOLID) yêu cầu các module cấp cao và cấp thấp không được phụ thuộc trực tiếp vào nhau mà phải cùng phụ thuộc vào lớp trừu tượng (Abstraction).',
            'DI chỉ áp dụng được cho cơ sở dữ liệu quan hệ, trong khi DIP chỉ áp dụng cho NoSQL.',
            'Cả hai là một khái niệm duy nhất được dùng thay thế cho nhau tùy theo sở thích ngôn ngữ lập trình.'
          ],
          correctIndex: 1,
          explanation: 'DI chỉ là một phương thức kỹ thuật đưa dependency từ ngoài vào. Bạn hoàn toàn có thể dùng DI nhưng vẫn vi phạm DIP nếu class cấp cao inject trực tiếp class cấp thấp cụ thể (ví dụ: constructor(private stripe: StripeService)). Để tuân thủ DIP, class cấp cao phải inject một Abstraction (ví dụ: @Inject(PAYMENT_GATEWAY) private payment: IPaymentGateway).'
        },
        {
          id: 'c4-l1-q4',
          question: 'Trong NestJS, Provider dạng useFactory vượt trội hơn các dạng Provider khác (useClass, useValue) trong kịch bản kiến trúc nào sau đây?',
          options: [
            'Khi cần khai báo một hằng số chuỗi text bất biến không bao giờ thay đổi trong toàn bộ vòng đời ứng dụng.',
            'Khi cần tối ưu hóa tốc độ tải trang frontend bằng cách nén mã nguồn nhị phân trước khi chạy.',
            'Khi muốn tạo một service chạy trực tiếp trên GPU máy chủ để huấn luyện mô hình học sâu.',
            'Khi việc khởi tạo đối tượng phụ thuộc đòi hỏi phải thực thi logic bất đồng bộ (async/await), kết nối cơ sở dữ liệu động, hoặc inject các provider khác (thông qua mảng inject: [...]) để tính toán cấu hình trước khi trả về instance.'
          ],
          correctIndex: 3,
          explanation: 'useFactory là provider duy nhất cho phép định nghĩa hàm factory bất đồng bộ (async useFactory), có thể nhận các dependency khác thông qua mảng inject (như ConfigService, ConnectionPool) để khởi tạo dynamic client trước khi cung cấp cho IoC Container.'
        },
        {
          id: 'c4-l1-q5',
          question: 'Khi một Provider được đăng ký trong mảng providers của Module A nhưng Module B muốn inject Provider đó, điều kiện bắt buộc nào phải được thỏa mãn theo nguyên lý Encapsulation của NestJS Module?',
          options: [
            'Module B phải được gắn decorator @Global() ở cấp ứng dụng.',
            'Module A bắt buộc phải đưa Provider đó vào mảng exports, và Module B bắt buộc phải khai báo Module A trong mảng imports của mình.',
            'Cả Module A và Module B phải dùng chung một tệp tin cấu hình tsconfig.json.',
            'Provider đó bắt buộc phải sử dụng Scope.REQUEST thay vì Scope.DEFAULT.'
          ],
          correctIndex: 1,
          explanation: 'NestJS module có tính đóng gói (encapsulation) nghiêm ngặt. Mặc định mọi provider trong mảng providers là private đối với module đó. Muốn module khác sử dụng, module sở hữu phải chủ động exports provider đó, và module tiêu thụ phải imports module sở hữu.'
        },
        {
          id: 'c4-l1-q6',
          question: 'Vòng đời phân giải Dependency Graph (Đồ thị phụ thuộc) của NestJS IoC Container diễn ra tại thời điểm nào trong chu kỳ sống của ứng dụng?',
          options: [
            'Tại thời điểm Bootstrap ứng dụng (khi gọi NestFactory.create()), IoC Container quét toàn bộ Module Graph, xây dựng cây DAG (Directed Acyclic Graph), phân giải và khởi tạo toàn bộ các Singleton Providers trước khi server bắt đầu lắng nghe cổng mạng HTTP.',
            'Tại thời điểm HTTP request đầu tiên từ client gửi tới máy chủ backend.',
            'Tại thời điểm trình biên dịch TypeScript build file sang thư mục dist/.',
            'Định kỳ mỗi 60 giây một lần trong suốt quá trình server hoạt động.'
          ],
          correctIndex: 0,
          explanation: 'IoC Container phân giải toàn bộ đồ thị phụ thuộc và khởi tạo các Singleton Provider một lần duy nhất tại bước Bootstrap (NestFactory.create()). Quá trình này hoàn tất trước khi server mở cổng TCP tiếp nhận kết nối (app.listen()), bảo đảm thời gian đáp ứng của HTTP request đầu tiên không bị trễ do tạo service.'
        },
        {
          id: 'c4-l1-q7',
          question: 'Khi sử dụng @Optional() decorator đi kèm với @Inject() trong Constructor của một Service, hành vi của IoC Container sẽ thay đổi như thế nào nếu dependency tương ứng không được tìm thấy trong Container?',
          options: [
            'Container lập tức ném lỗi ngoại lệ Fatal Exception và dừng ngay tiến trình khởi động của ứng dụng.',
            'Container sẽ tự động tạo một instance giả lập (mock instance) rỗng để gán vào tham số.',
            'Container sẽ bỏ qua lỗi không tìm thấy provider và gán giá trị undefined cho tham số đó, cho phép service tự xử lý fallback logic trong mã nguồn.',
            'Container sẽ tự động tìm kiếm trên kho lưu trữ npm để cài đặt gói thư viện tương ứng.'
          ],
          correctIndex: 2,
          explanation: 'Mặc định nếu một dependency bị thiếu trong module graph, NestJS sẽ ném lỗi "Nest can\'t resolve dependencies of..." và dừng app. Decorator @Optional() đánh dấu dependency này là tùy chọn: nếu không tìm thấy provider đăng ký, NestJS sẽ gán undefined thay vì quăng lỗi, rất hữu ích cho các plugin hoặc tính năng tùy biến cấu hình.'
        },
        {
          id: 'c4-l1-q8',
          question: 'Trong NestJS, Provider dạng useExisting (Aliased Provider) được sử dụng nhằm mục đích kỹ thuật nào sau đây?',
          options: [
            'Để nhân bản một class thành 2 instance hoàn toàn độc lập nằm ở 2 vùng nhớ RAM khác nhau.',
            'Để chuyển đổi một provider đồng bộ thành bất đồng bộ mà không cần sửa code.',
            'Để vô hiệu hóa quyền truy cập của các interceptor vào provider đó.',
            'Để tạo ra một bí danh (alias) trỏ về cùng một instance đã tồn tại của một Provider khác (ví dụ: cho phép truy xuất cùng một service thông qua cả Class Token gốc lẫn một Custom Symbol/String Token trừu tượng).'
          ],
          correctIndex: 3,
          explanation: 'useExisting cho phép tạo một token mới trỏ về một provider đã được đăng ký trước đó. Cả hai token sẽ cùng resolve về CHÍNH XÁC CÙNG MỘT INSTANCE (singleton) trong bộ nhớ, thường dùng khi muốn tái cấu trúc (refactoring) hoặc cung cấp nhiều interface cho cùng một service mà không tạo thêm instance thừa.'
        }
      ],
      codeChallenge: {
        id: 'c4-l1-c1',
        title: 'Mô Phỏng Inversion-of-Control (IoC) Container Resolution',
        description: 'Hiện thực hàm \`simulateIoCContainer(operations: Array<{ op: "register"; token: string; instance: unknown } | { op: "resolve"; token: string }>): unknown[]\`. Khi gặp \`op: "register"\`, lưu \`instance\` vào registry với \`token\` tương ứng (cho phép ghi đè nếu token đã tồn tại). Khi gặp \`op: "resolve"\`, nếu \`token\` tồn tại trong registry, đẩy instance vào mảng kết quả; nếu chưa từng đăng ký, ném Error(\`PROVIDER_NOT_FOUND: \${item.token}\`). Nếu tham số \`operations\` rỗng hoặc không phải mảng, trả về mảng rỗng \`[]\`.',
        starterCode: `export function simulateIoCContainer(
  operations: Array<{ op: 'register'; token: string; instance: unknown } | { op: 'resolve'; token: string }>
): unknown[] {
  // TODO: Mô phỏng IoC container register & resolve
  return [];
}`,
        solution: `export function simulateIoCContainer(
  operations: Array<{ op: 'register'; token: string; instance: unknown } | { op: 'resolve'; token: string }>
): unknown[] {
  if (!Array.isArray(operations) || operations.length === 0) {
    return [];
  }

  const registry = new Map<string, unknown>();
  const results: unknown[] = [];

  for (const item of operations) {
    if (item.op === 'register') {
      registry.set(item.token, item.instance);
    } else if (item.op === 'resolve') {
      if (!registry.has(item.token)) {
        throw new Error(\`PROVIDER_NOT_FOUND: \${item.token}\`);
      }
      results.push(registry.get(item.token));
    }
  }

  return results;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Đăng ký và resolve thành công 1 singleton service',
            input: [[
              { op: 'register', token: 'AUTH_SERVICE', instance: { authenticated: true } },
              { op: 'resolve', token: 'AUTH_SERVICE' }
            ]],
            expected: [{ authenticated: true }],
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Resolve token chưa từng được đăng ký -> Ném lỗi',
            input: [[
              { op: 'resolve', token: 'UNKNOWN_SERVICE' }
            ]],
            expected: 'ERROR_THROWN',
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Đăng ký nhiều service và resolve theo thứ tự',
            input: [[
              { op: 'register', token: 'DB', instance: 'PostgresConn' },
              { op: 'register', token: 'CACHE', instance: 'RedisConn' },
              { op: 'resolve', token: 'DB' },
              { op: 'resolve', token: 'CACHE' }
            ]],
            expected: ['PostgresConn', 'RedisConn'],
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Mảng operations rỗng -> Trả về mảng rỗng',
            input: [[]],
            expected: [],
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Đăng ký ghi đè token cũ bằng instance mới',
            input: [[
              { op: 'register', token: 'LOGGER', instance: 'ConsoleLogger' },
              { op: 'register', token: 'LOGGER', instance: 'WinstonLogger' },
              { op: 'resolve', token: 'LOGGER' }
            ]],
            expected: ['WinstonLogger'],
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c4-l2',
      title: 'Bài 02: NestJS Request Lifecycle Pipeline: Middleware -> Guard -> Interceptor -> Pipe -> Filter',
      duration: '60 phút',
      tag: 'Execution Pipeline & Filters',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: THIẾT KẾ EXECUTION PIPELINE PHÂN LỚP & TRỪU TƯỢNG HÓA NGỮ CẢNH (ARCHITECTURAL CONTEXT & CONTEXT PROPAGATION)

Trong các framework Node.js truyền thống (như Express thuần), việc xử lý các mối bận tâm liên quan xuyên suốt (Cross-Cutting Concerns) như Logging, Authentication, Authorization, Request Validation và Exception Handling thường bị dồn chung vào một chuỗi Middleware lỏng lẻo (\`req, res, next\`). Cách tiếp cận này bộc lộ những khiếm khuyết chết người trong kiến trúc quy mô lớn:
* **Hạn chế của Chuỗi Middleware truyền thống:** Middleware chỉ nhận được 2 đối tượng thô (\`Request\` và \`Response\`). Nó hoàn toàn không biết Request đó sắp được chuyển giao tới Controller nào hay Handler cụ thể nào. Do đó, Middleware không thể đọc các Metadata khai báo (như quyền hạn \`@Roles('ADMIN')\` hay giới hạn Rate-limit \`@Throttle()\`). Hơn nữa, Middleware không thể can thiệp hai chiều (Two-way interception): Nó không thể bao bọc việc thực thi Handler để đo đạc thời gian, chuyển đổi định dạng DTO trả về, hoặc bắt lỗi bất đồng bộ mà không phá vỡ dòng chảy chuẩn.
* **Kiến trúc Phân tầng Pipeline của NestJS:** NestJS tái cấu trúc chu trình xử lý một Request thành một **Execution Pipeline** có tính xác định cao với 5 tầng chịu trách nhiệm độc lập:
  - **Middleware:** Tầng giao tiếp thô với Web Server Adapter (Express/Fastify) xử lý các tác vụ tiền định tuyến (CORS, Security Headers, Tracing Headers).
  - **Guards:** Tầng phòng thủ bảo mật danh tính và quyền hạn, sở hữu quyền truy cập vào Metadata của đích đến để ra quyết định sớm (Fail-Fast Authorization).
  - **Interceptors:** Tầng bao bọc hàm (Aspect-Oriented Programming - AOP) dựa trên RxJS Observable, cho phép can thiệp trước khi gọi Handler và biến đổi kết quả trả về sau khi Handler hoàn thành.
  - **Pipes:** Tầng làm sạch và kiểm định tính toàn vẹn của Payload (Transformation & Data Validation) trước khi dữ liệu chạm vào tầng Service.
  - **Exception Filters:** Tầng hứng bắt và chuẩn hóa ngoại lệ toàn cục, bảo vệ hệ thống khỏi việc rò rỉ Stack Trace nhạy cảm ra môi trường Production.
* **Trừu tượng hóa Đa giao thức qua ExecutionContext:** Khác với Express bị trói chặt vào HTTP protocol, NestJS cung cấp lớp trừu tượng \`ExecutionContext\`. Cho dù ứng dụng đang vận hành dưới dạng REST API (HTTP), gRPC Microservices (RPC), WebSockets hay Kafka/RabbitMQ Consumer, các Guard và Interceptor đều tái sử dụng được $100\\%$ logic phân quyền và giám sát mà không cần viết lại.

---

# 2. THỨ TỰ THỰC THI CHÍNH XÁC TUYỆT ĐỐI THEO CHUẨN NESTJS

Rất nhiều kỹ sư Backend phạm sai lầm nghiêm trọng về thứ tự thực thi (ví dụ: dùng Middleware để bắt ngoại lệ của Controller hoặc dùng Pipe để xác thực quyền hạn):

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│              DÒNG CHẢY TUẦN TỰ REQUEST LIFECYCLE TRONG NESTJS               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. INCOMING HTTP REQUEST                                                    │
│    │                                                                        │
│ 2. GLOBAL MIDDLEWARE ──► MODULE MIDDLEWARE (Thuần Express/Fastify)          │
│    │                                                                        │
│ 3. GLOBAL GUARDS ──────► CONTROLLER GUARDS ────► ROUTE GUARDS (Xác thực)    │
│    │                                                                        │
│ 4. GLOBAL INTERCEPTORS (Pre-controller) ───────► ROUTE INTERCEPTORS         │
│    │                                                                        │
│ 5. GLOBAL PIPES ───────► CONTROLLER PIPES ─────► ROUTE / PARAM PIPES (Parse)│
│    │                                                                        │
│ 6. CONTROLLER METHOD HANDLER (Thực thi logic nghiệp vụ tại Service)         │
│    │                                                                        │
│ 7. ROUTE INTERCEPTORS ─► GLOBAL INTERCEPTORS (Post-controller RxJS Stream)  │
│    │                                                                        │
│ 8. EXCEPTION FILTERS (Chỉ kích hoạt nếu có ngoại lệ Uncaught Exception)     │
│    │                                                                        │
│ 9. OUTGOING HTTP RESPONSE TRẢ VỀ CHO CLIENT                                │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Bản Chất Của Từng Thành Phần Trong Pipeline
1. **Middleware:** Chạy trước khi NestJS Router phân giải Route. Thích hợp cho CORS, Helmet, Rate-limit thô, Compression, trích xuất Request ID (\`trace-id\`).
2. **Guards:** Có quyền truy cập vào \`ExecutionContext\`, biết chính xác Handler và Class nào sắp được gọi (\`context.getHandler()\`), cho phép đọc Custom Metadata (\`@Roles('ADMIN')\`). Bắt buộc trả về \`boolean\` hoặc \`Promise<boolean>\`.
3. **Interceptors:** Dựa trên luồng Observable của **RxJS**. Cho phép bao bọc (wrap) việc thực thi hàm: ghi log thời gian chạy, cache dữ liệu, biến đổi cấu trúc response (\`{ data: ... }\`), hoặc tự động retry khi gặp lỗi.
4. **Pipes:** Chuyên trách 2 nhiệm vụ duy nhất: **Transformation** (ép chuỗi sang số, sang boolean) và **Validation** (dùng \`class-validator\` kiểm tra tính hợp lệ của DTO).
5. **Exception Filters:** Lưới an toàn cuối cùng. Bắt các ngoại lệ \`HttpException\` để chuẩn hóa format JSON lỗi, giấu các thông tin stack trace nhạy cảm không để rò rỉ ra ngoài môi trường Production.

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Phân Cấp Phạm Vi Áp Dụng (Scope Hierarchy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PHẠM VI ĐĂNG KÝ (BINDING SCOPES)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. GLOBAL SCOPE (Toàn bộ ứng dụng)                                          │
│    └── app.useGlobalGuards(), app.useGlobalPipes(), APP_INTERCEPTOR         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CONTROLLER SCOPE (Toàn bộ endpoints trong một Controller)                │
│    └── @UseGuards(AuthGuard), @UseInterceptors(LoggingInterceptor)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. METHOD / ROUTE SCOPE (Duy nhất một Endpoint cụ thể)                      │
│    └── @Get('profile') @UseGuards(RolesGuard)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. PARAMETER SCOPE (Duy nhất một tham số hàm)                               │
│    └── @Param('id', ParseIntPipe), @Body(new ValidationPipe())              │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Can Thiệp Hai Chiều Của Interceptor (Two-way RxJS Flow)
\`\`\`diagram
[ HTTP Request Đến ]
        │
        ▼
[ Interceptor: Mã chạy TRƯỚC (Pre-controller) ] ──► (Lưu timestamp Date.now())
        │
        ▼
  [ CallHandler.handle() ] ──► Chạy qua Pipe ──► Vào Controller Method
                                                        │
                                                        ▼
[ Interceptor: Mã chạy SAU (Post-controller RxJS) ] ◄── Trả về kết quả
  - pipe(tap(() => console.log('Thời gian:', Date.now() - start)))
  - pipe(map(data => ({ statusCode: 200, payload: data })))
        │
        ▼
[ HTTP Response Đi ]
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Thành Phần Pipeline (Component Decision Tree)
\`\`\`diagram
BẠN CẦN HIỆN THỰC LOGIC CAN THIỆP VÀO REQUEST?
│
├── Cần kiểm tra định dạng hoặc ghi nhận log toàn bộ request trước khi vào routing?
│   └──► DÙNG: Middleware (Tầng mạng thô của Express)
│
├── Cần kiểm tra quyền hạn (Role, Permission, Token) dựa trên Controller/Method Metadata?
│   └──► DÙNG: Guard (Truy cập ExecutionContext & Reflector)
│
├── Cần biến đổi giá trị tham số (@Param, @Body) hoặc validate DTO?
│   └──► DÙNG: Pipe (ParseUUIDPipe, ValidationPipe)
│
├── Cần đo đạc thời gian, can thiệp cấu trúc dữ liệu trả về, hoặc cache response?
│   └──► DÙNG: Interceptor (RxJS Observable Operators)
│
└── Cần bắt lỗi, ghi log thảm họa và trả về mã lỗi JSON đồng nhất?
    └──► DÙNG: Exception Filter (@Catch(HttpException))
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Thành Phần Pipeline | Khả Năng Đọc Reflector | Can Thiệp Luồng Trả Về | Tự Động Bỏ Qua Khi Lỗi | Điểm Mạnh Nhất |
| :--- | :--- | :--- | :--- | :--- |
| **Middleware** | Không (Chưa có context) | Có thể (thao tác trực tiếp res)| Không | Tích hợp thư viện Express có sẵn |
| **Guard** | Có (Đọc @Roles) | Không (Chỉ cho qua hay chặn) | Chặn ngay, không gọi tiếp| Bảo vệ quyền riêng tư cực sớm |
| **Interceptor** | Có | Có (Cực mạnh qua RxJS)| Bắt lỗi bằng RxJS catchError | Logging, Audit Trail, Response Envelope |
| **Pipe** | Không | Không | Dừng request nếu validate sai | Bảo vệ tính toàn vẹn kiểu dữ liệu |
| **Filter** | Có | Toàn quyền kiểm soát lỗi | Là điểm cuối hứng ngoại lệ | Chuẩn hóa định dạng lỗi toàn cầu |
`,
      realCodeSnippet: `
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

/**
 * ADR: Standardized API Envelope Pattern
 * - Chuẩn hóa toàn bộ phản hồi trả về từ Controller theo cấu trúc Envelope duy nhất.
 * - Đo lường độ trễ (latency durationMs) của từng request phục vụ APM & Metrics.
 * - Đảm bảo bất kể Controller trả về Entity thô hay Array, Client đều nhận định dạng nhất quán.
 */
export interface ApiResponseEnvelope<T> {
  success: boolean;
  statusCode: number;
  timestamp: string;
  durationMs: number;
  path: string;
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T>>
{
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiResponseEnvelope<T>> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      map((data: T): ApiResponseEnvelope<T> => {
        const durationMs = Date.now() - startTime;
        const statusCode = response.statusCode || HttpStatus.OK;
        return {
          success: true,
          statusCode,
          timestamp: new Date().toISOString(),
          durationMs,
          path: request.url,
          data,
        };
      }),
      tap((envelope) => {
        this.logger.log(
          \`[\${request.method}] \${request.url} - \${envelope.statusCode} (\${envelope.durationMs}ms)\`
        );
      }),
      catchError((err: unknown) => {
        const durationMs = Date.now() - startTime;
        this.logger.error(
          \`[\${request.method}] \${request.url} - FAILED (\${durationMs}ms)\`,
          err instanceof Error ? err.stack : undefined
        );
        return throwError(() => err);
      })
    );
  }
}
`,
      quiz: [
        {
          id: 'c4-l2-q1',
          question: 'Vì sao NestJS Guard được ưu tiên sử dụng để phân quyền truy cập (Authorization) thay vì sử dụng Express Middleware thông thường?',
          options: [
            'Vì Guard có quyền truy cập vào ExecutionContext để đọc Metadata khai báo trên Controller/Action (@Roles, @Permissions) thông qua Reflector trước khi cho phép request đi tiếp.',
            'Vì Guard được thực thi ở tầng nhân Linux kernel nên có tốc độ kiểm tra quyền nhanh hơn gấp mười lần Express middleware.',
            'Vì Middleware của Express không thể đọc được nội dung Authorization Header hoặc Bearer Token gửi kèm trong request của client.',
            'Vì Guard tự động mã hóa thông tin người dùng bằng thuật toán RSA-4096 trước khi chuyển tiếp dữ liệu xuống tầng Service.'
          ],
          correctIndex: 0,
          explanation: 'Express Middleware chạy trước khi NestJS thực hiện định tuyến (Routing), do đó Middleware hoàn toàn không biết Request sắp được chuyển vào Controller hay Action nào. Ngược lại, Guard chạy sau khi router đã xác định đích đến, có thể truy cập ExecutionContext và Reflector để đọc các metadata như @Roles("ADMIN"), giúp phân quyền chính xác.'
        },
        {
          id: 'c4-l2-q2',
          question: 'Thứ tự thực thi tuần tự nào sau đây mô tả đúng tuyệt đối chu trình xử lý một HTTP Request đi qua trọn vẹn Execution Pipeline của NestJS?',
          options: [
            'Global Pipes -> Module Middleware -> Route Guards -> Route Interceptors -> Controller Handler -> Global Exception Filters.',
            'Route Guards -> Module Middleware -> Controller Pipes -> Route Handler -> Response Interceptor -> Exception Filters.',
            'Incoming Request -> Middleware (Global -> Module) -> Guards (Global -> Controller -> Route) -> Interceptors Pre-controller -> Pipes (Global -> Controller -> Route/Param) -> Controller Route Handler -> Interceptors Post-controller (RxJS Stream) -> Outgoing Response.',
            'Controller Handler -> Interceptors Pre-controller -> Global Guards -> Pipes -> Middleware -> Interceptors Post-controller -> Outgoing Response.'
          ],
          correctIndex: 2,
          explanation: 'Theo chuẩn NestJS Request Lifecycle: Request đầu tiên đi qua Middleware (tầng ngoài cùng) -> Guards (kiểm tra quyền) -> Interceptors (phần pre-controller) -> Pipes (validate & transform dữ liệu params/body) -> Route Handler (Controller thực thi) -> Interceptors (phần post-controller xử lý kết quả trả về qua RxJS).'
        },
        {
          id: 'c4-l2-q3',
          question: 'Trong kịch bản một tham số Body không hợp lệ bị chặn bởi ValidationPipe, điều gì sẽ xảy ra tiếp theo trong vòng đời Request của NestJS?',
          options: [
            'Request vẫn tiếp tục đi vào Controller Route Handler nhưng đối tượng DTO được gán giá trị null để controller tự quyết định fallback.',
            'ValidationPipe lập tức ném ra ngoại lệ BadRequestException; chuỗi pipeline ngắt ngay lập tức, bỏ qua Controller Handler và chuyển quyền điều khiển trực tiếp tới Exception Filter để định dạng phản hồi lỗi 400.',
            'Interceptor phần Post-controller sẽ tự động phục hồi dữ liệu bị thiếu từ cache Redis và tiếp tục thực thi ngầm.',
            'Tiến trình Node.js kích hoạt sự kiện uncaughtException và tự động khởi động lại tiến trình server thông qua PM2.'
          ],
          correctIndex: 1,
          explanation: 'Khi Pipe phát hiện dữ liệu không hợp lệ (ví dụ BadRequestException từ ValidationPipe), nó lập tức ném ra ngoại lệ. Pipeline dừng ngay lập tức tại Pipe, bỏ qua hoàn toàn việc gọi Controller, và chuyển quyền xử lý trực tiếp sang Exception Filter để tạo mã lỗi 400 Bad Request trả về cho client.'
        },
        {
          id: 'c4-l2-q4',
          question: 'Khả năng độc đáo nào sau đây của NestJS Interceptor mà các thành phần khác như Guard hay Pipe hoàn toàn KHÔNG THỂ thực hiện được?',
          options: [
            'Chuyển đổi một chuỗi ký tự string thành số nguyên integer nguyên thủy trên thanh địa chỉ URL của trình duyệt.',
            'Đọc thông tin IP của client từ network socket để thực hiện chặn tường lửa IP Whitelist ở tầng mạng thô.',
            'Tự động khởi tạo kết nối cơ sở dữ liệu MongoDB trong quá trình ứng dụng khởi động.',
            'Áp dụng tư tưởng Lập trình Hướng khía cạnh (Aspect-Oriented Programming - AOP) để bao bọc (wrap) lời gọi hàm Handler: can thiệp logic cả trước khi Handler chạy và biến đổi luồng dữ liệu trả về (hoặc bắt lỗi/timeout) sau khi Handler kết thúc nhờ luồng Observable của RxJS.'
          ],
          correctIndex: 3,
          explanation: 'Chỉ có Interceptor được xây dựng trên nền tảng RxJS Observable stream. Nhờ phương thức next.handle(), Interceptor có khả năng thực thi code TRƯỚC khi controller chạy, và sử dụng các toán tử RxJS (map, tap, catchError, timeout) để biến đổi, đo đạc, hoặc ghi đè kết quả SAU KHI controller hoàn thành.'
        },
        {
          id: 'c4-l2-q5',
          question: 'Lớp trừu tượng ExecutionContext trong NestJS đóng vai trò quan trọng như thế nào đối với các ứng dụng Microservices hoặc Đa giao thức?',
          options: [
            'Kế thừa từ ArgumentsHost, ExecutionContext cung cấp các phương thức switchToHttp(), switchToRpc(), switchToWs() và getClass(), getHandler() giúp Guard/Interceptor tái sử dụng 100% logic bảo mật và giám sát xuyên suốt HTTP REST, WebSockets, gRPC và Message Queue mà không bị trói buộc vào giao thức cụ thể.',
            'Tự động cân bằng tải Round-Robin giữa các cụm Kubernetes Pods mà không cần thông qua Ingress Controller.',
            'Đồng bộ hóa trạng thái bộ nhớ RAM giữa các Node.js Worker Threads mà không cần serialize dữ liệu.',
            'Tự động biên dịch mã nguồn TypeScript thành WebAssembly để tăng tốc xử lý toán học.'
          ],
          correctIndex: 0,
          explanation: 'ExecutionContext trừu tượng hóa ngữ cảnh thực thi, cho phép truy xuất Controller Class và Method Handler thông qua getClass() / getHandler(), đồng thời cung cấp các bộ chuyển đổi switchToHttp(), switchToRpc(), switchToWs() để truy cập đối tượng ngữ cảnh của từng giao thức tương ứng.'
        },
        {
          id: 'c4-l2-q6',
          question: 'Khi cần đăng ký một Interceptor hoặc Guard ở phạm vi toàn cục (Global Scope) nhưng Interceptor đó CÓ phụ thuộc vào một Service khác (cần Dependency Injection), cách khai báo nào sau đây là CHUẨN XÁC NHẤT trong NestJS?',
          options: [
            'Sử dụng app.useGlobalInterceptors(new MyInterceptor()) trong file main.ts và truyền null vào constructor của MyInterceptor.',
            'Khai báo MyInterceptor trong file package.json dưới mục globalDependencies.',
            'Đăng ký MyInterceptor dưới dạng một Custom Provider với token APP_INTERCEPTOR (hoặc APP_GUARD) trong mảng providers của AppModule hoặc CoreModule.',
            'Gắn decorator @Global() trực tiếp lên trên class MyInterceptor mà không cần khai báo vào bất kỳ module nào.'
          ],
          correctIndex: 2,
          explanation: 'Khi dùng app.useGlobalInterceptors(new Interceptor()), instance được tạo bên ngoài IoC container nên không thể inject bất kỳ dependency nào. Để giải quyết, NestJS cung cấp token đặc biệt APP_INTERCEPTOR (hoặc APP_GUARD, APP_PIPE, APP_FILTER) để đăng ký trực tiếp trong mảng providers của một Module, cho phép container tự inject đầy đủ dependencies.'
        },
        {
          id: 'c4-l2-q7',
          question: 'Khi định nghĩa một Custom Exception Filter trong NestJS bằng decorator @Catch(), nếu decorator này hoàn toàn không truyền tham số nào (@Catch()), hành vi của Filter đó là gì?',
          options: [
            'Filter sẽ chỉ bắt duy nhất ngoại lệ NotFoundException (404) của NestJS.',
            'Filter sẽ bị IoC Container bỏ qua và không bao giờ được kích hoạt trong suốt vòng đời ứng dụng.',
            'Filter sẽ chỉ xử lý các lỗi cú pháp (SyntaxError) phát sinh trong mã nguồn JavaScript.',
            'Filter trở thành một Catch-All Exception Filter, có khả năng tóm bắt mọi ngoại lệ chưa được xử lý (cả HttpException lẫn Error thuần của JavaScript/Node.js) trên toàn hệ thống.'
          ],
          correctIndex: 3,
          explanation: 'Khi để trống tham số @Catch(), Filter sẽ bắt toàn bộ mọi exception unhandled phát sinh trong pipeline mà không phân biệt kiểu (Catch-all). Thường được dùng ở cấp Global để chuẩn hóa mọi lỗi runtime (500 Internal Server Error, TypeErrors, unhandled rejections) thành cấu trúc JSON chuẩn trước khi phản hồi về client.'
        },
        {
          id: 'c4-l2-q8',
          question: 'Hai nhiệm vụ kỹ thuật cốt lõi và duy nhất của NestJS Pipe theo thiết kế chuẩn mực của framework là gì?',
          options: [
            'Authentication (Xác minh danh tính) và Encryption (Mã hóa đường truyền TLS).',
            'Transformation (Chuyển đổi kiểu dữ liệu đầu vào về định dạng mong muốn) và Validation (Kiểm định tính hợp lệ của dữ liệu trước khi chuyển giao cho Route Handler).',
            'Auditing (Ghi log vết kiểm toán vào database) và Caching (Lưu kết quả truy vấn vào Redis).',
            'Rate Limiting (Giới hạn lưu lượng request) và Throttling (Điều tiết băng thông mạng).'
          ],
          correctIndex: 1,
          explanation: 'Pipe trong NestJS có 2 use-cases cốt lõi: 1) Transformation (ví dụ: ParseIntPipe ép chuỗi "123" thành số 123), và 2) Validation (ví dụ: ValidationPipe kết hợp class-validator để kiểm tra schema DTO, nếu không thỏa mãn sẽ ném ngoại lệ 400 Bad Request).'
        }
      ],
      codeChallenge: {
        id: 'c4-l2-c1',
        title: 'Mô Phỏng NestJS Execution Pipeline Chặn Lỗi Chuẩn Xác',
        description: 'Hiện thực hàm \`runPipeline(request: { token?: string; age?: number }): { status: number; body: unknown }\`. Pipeline gồm 3 bước: 1. Guard: nếu không có \`token\` hoặc token là chuỗi rỗng sau khi trim, trả về \`{ status: 401, body: "UNAUTHORIZED" }\`. 2. Pipe: nếu \`age\` không hợp lệ (không phải số hoặc \`age < 18\`), trả về \`{ status: 400, body: "INVALID_AGE" }\`. 3. Handler: nếu hợp lệ, trả về \`{ status: 200, body: { success: true } }\`. Không được gọi các bước sau nếu bước trước đã thất bại.',
        starterCode: `export function runPipeline(request: { token?: string; age?: number }): {
  status: number;
  body: unknown;
} {
  // TODO: Hiện thực các trạm kiểm soát tuần tự
  return { status: 200, body: 'OK' };
}`,
        solution: `export function runPipeline(request: { token?: string; age?: number }): {
  status: number;
  body: unknown;
} {
  // Trạm 1: Guard kiểm tra token danh tính
  if (!request.token || typeof request.token !== 'string' || request.token.trim() === '') {
    return { status: 401, body: 'UNAUTHORIZED' };
  }

  // Trạm 2: Pipe kiểm tra và validate dữ liệu tuổi
  if (request.age === undefined || typeof request.age !== 'number' || isNaN(request.age) || request.age < 18) {
    return { status: 400, body: 'INVALID_AGE' };
  }

  // Trạm 3: Controller Handler thực thi thành công
  return { status: 200, body: { success: true } };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Chặn tại Guard khi thiếu token',
            input: [{ age: 20 }],
            expected: { status: 401, body: 'UNAUTHORIZED' },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Chặn tại Pipe khi age dưới 18 tuổi',
            input: [{ token: 'valid-jwt', age: 16 }],
            expected: { status: 400, body: 'INVALID_AGE' },
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Thực thi thành công qua toàn bộ pipeline',
            input: [{ token: 'valid-jwt', age: 25 }],
            expected: { status: 200, body: { success: true } },
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Token là chuỗi khoảng trắng rỗng -> Chặn tại Guard',
            input: [{ token: '   ', age: 20 }],
            expected: { status: 401, body: 'UNAUTHORIZED' },
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Biên tuổi đúng bằng 18 tuổi -> Cho phép qua pipeline',
            input: [{ token: 'valid-jwt', age: 18 }],
            expected: { status: 200, body: { success: true } },
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c4-l3',
      title: 'Bài 03: Đồ Thị DAG, Circular Dependency (forwardRef) & Hiểm Họa Hiệu Năng Scope.REQUEST',
      duration: '60 phút',
      tag: 'DAG Graph & Scopes Danger',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐỒ THỊ PHỤ THUỘC TUYẾN TÍNH DAG, GIẢI QUYẾT BẾ TẮC VÒNG LẶP & ĐÁNH ĐỔI HIỆU NĂNG INJECTION SCOPES (ARCHITECTURAL CONTEXT & PERFORMANCE PITFALLS)

Trong quá trình khởi tạo ứng dụng (Bootstrapping phase), NestJS xây dựng một Đồ thị Phụ thuộc Có hướng Không chu trình (Directed Acyclic Graph - DAG) để xác định thứ tự nạp các Provider. Hai thách thức cấu trúc phức tạp nhất mà các Kỹ sư Hệ thống thường phải đối mặt bao gồm:
* **Vấn nạn Phụ thuộc Vòng lặp (Circular Dependency Deadlock):** Xảy ra khi Service A yêu cầu Service B trong Constructor, đồng thời Service B lại yêu cầu ngược lại Service A. Thuật toán Sắp xếp Tô pô (Topological Sort) của IoC Container rơi vào bế tắc vô hạn (Cyclic Dependency Graph) do không thể tìm được đỉnh có bậc vào bằng 0. Hệ thống lập tức ném lỗi \`Nest can't resolve dependencies of...\` và từ chối khởi động. Cơ chế \`forwardRef()\` giải quyết tạm thời bằng kỹ thuật Trì hoãn Tham chiếu (Lazy Reference Pointer), nhưng về mặt kiến trúc dài hạn, đây là dấu hiệu cảnh báo Code Smell (vi phạm Single Responsibility) đòi hỏi phải tái cấu trúc tách Domain Event hoặc Mediator Service.
* **Hiểm họa Hiệu năng của Scope.REQUEST & Hiệu ứng Lan truyền (Scope Bubbling):**
  - Mặc định (\`Scope.DEFAULT\`), mọi Provider trong NestJS là **Singleton** (chỉ có 1 instance duy nhất nằm cố định trong Old Generation của V8 Heap). Chi phí cấp phát bộ nhớ bằng 0 sau khi ứng dụng khởi động thành công.
  - Khi một kỹ sư tùy tiện chuyển một Service sang \`Scope.REQUEST\` (ví dụ để lấy \`req.headers\` trực tiếp trong service), họ vô tình kích hoạt **Scope Bubbling**: Mọi Service, Interceptor, Controller phụ thuộc vào Service đó theo chuỗi DI đều bị ép biến thành Request Scope!
  - **Hậu quả trên Production:** Với lưu lượng 2,000 req/s, hệ thống buộc phải liên tục cấp phát và tiêu hủy hàng chục nghìn đối tượng trên Young Generation (Eden Space) mỗi giây. V8 Garbage Collector rơi vào tình trạng **GC Thrashing**, kích hoạt liên tục các đợt tạm dừng Stop-the-World, khiến CPU tăng vọt lên $100\\%$, độ trễ API P99 nhảy vọt từ 10ms lên 800ms, và Pod có nguy cơ bị Kubernetes OOMKilled.
  - **Giải pháp Kiến trúc Đẳng cấp:** Giữ nguyên $100\\%$ Singleton Scope và sử dụng **\`AsyncLocalStorage\`** (Node.js Core API) để chia sẻ Ngữ cảnh Yêu cầu (Request Context / Correlation ID) xuyên suốt các tác vụ bất đồng bộ mà không tốn một byte cấp phát DI instance nào!

---

# 2. ĐỒ THỊ PHỤ THUỘC CÓ HƯỚNG DAG & THUẬT TOÁN TOPOLOGICAL SORT

Khi NestJS nạp các module, nó xây dựng một **Đồ thị có hướng không chu trình (Directed Acyclic Graph - DAG)**:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ĐỒ THỊ DAG CỦA NESTJS MODULES                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                               [ DatabaseModule ]                            │
│                                  ▲         ▲                                │
│                     ┌────────────┘         └────────────┐                   │
│                     │                                   │                   │
│             [ UsersModule ]                     [ OrdersModule ]            │
│                     ▲                                   ▲                   │
│                     │                                   │                   │
│                     └─────────────┬─────────────────────┘                   │
│                                   │                                         │
│                              [ AppModule ]                                  │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Thuật Toán Sắp Xếp Tô Pô (Topological Sort)
Để biết module nào phải khởi tạo trước:
1. IoC Container tính toán bậc vào (In-degree) của từng đỉnh trong đồ thị.
2. Đỉnh nào có \`In-degree = 0\` (không phụ thuộc ai, ví dụ \`DatabaseModule\`) sẽ được khởi tạo trước tiên.
3. Khi phát hiện một chu trình khép kín ($A \\rightarrow B \\rightarrow A$), đồ thị vi phạm tính chất Acyclic (bị chu trình hóa), thuật toán Topological Sort rơi vào bế tắc và ném ra ngoại lệ.
4. **Cơ chế hoạt động của \`forwardRef()\`:** Sử dụng hàm bao bọc \`() => TargetClass\` để trì hoãn việc đọc tham chiếu cho đến khi cả 2 class đều đã được nạp vào bộ nhớ.

---

# 3. HIỂM HỌA HIỆU NĂNG CỦA SCOPE BUBBLING TRONG NESTJS

NestJS cung cấp 3 phạm vi sống (Injection Scopes):
* **\`Scope.DEFAULT\` (Singleton):** 1 instance duy nhất cho toàn bộ vòng đời ứng dụng. An toàn, tốc độ tối đa, tiết kiệm RAM tuyệt đối.
* **\`Scope.TRANSIENT\`:** Mỗi provider inject nó sẽ nhận một instance mới riêng biệt (vẫn giữ cố định trong suốt vòng đời của provider đó).
* **\`Scope.REQUEST\` (Hiểm họa ngầm):** Mỗi HTTP Request đến tạo ra một instance mới hoàn toàn và bị tiêu hủy sau khi request kết thúc.

\`\`\`diagram
                         HIỆN TƯỢNG BUBBLING (LAN TRUYỀN SCOPE)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                [ AuthService ]                       [ LoggingService ]
              (Mặc định: Singleton)                 (Gán: Scope.REQUEST)
                        │                                     ▲
                        └──────────────────┬──────────────────┘
                                           │ Inject
                                           ▼
                                   [ UsersController ]
               (BỊ ÉP BIẾN THÀNH SCOPE.REQUEST TỰ ĐỘNG - BUBBLING EFFECT!)
\`\`\`

> **Quy Tắc Sống Còn Của Senior Architect:** \`Scope.REQUEST\` có tính lây nhiễm (Bubbling)! Nếu một Service ở tận cùng tầng Repository bị đổi sang \`Scope.REQUEST\`, **toàn bộ Service, Controller phụ thuộc vào nó dọc theo chuỗi DI đều bị biến thành \`Scope.REQUEST\` theo!**
> Hệ quả: 1,000 requests/giây sẽ tạo ra hàng chục nghìn object instances mới trên Heap, gây GC Thrashing, làm CPU tăng $300\\%$ và độ trễ API tăng vọt từ 5ms lên 200ms!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Cấu Trúc Vòng Đời Scopes (Scope Architecture Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VÙNG BỘ NHỚ V8 HEAP                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SINGLETON REGISTRY (Scope.DEFAULT)                                       │
│    └── Tồn tại vĩnh viễn trong Old Generation, không bị GC thu gom           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TRANSIENT REGISTRY (Scope.TRANSIENT)                                     │
│    └── Cấp phát tại thời điểm Bootstrapping cho từng Injection Site          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. REQUEST ISOLATION TREE (Scope.REQUEST)                                   │
│    ├── Cấp phát trên Young Generation (Eden Space) cho từng HTTP Request    │
│    ├── Tự động lây nhiễm lên toàn bộ cây phụ thuộc (Scope Bubbling)         │
│    └── Buộc Garbage Collector Scavenge phải chạy dồn dập để dọn dẹp         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Giải Quyết Circular Dependency Với forwardRef (Resolution Flow)
\`\`\`diagram
[ Khởi động Container ]
        │
        ▼
Quét UserService: Thấy cần @Inject(forwardRef(() => OrderService))
        │
        ├── 1. Tạm thời hoãn việc resolve OrderService
        ├── 2. Tạo Lazy Function Reference trỏ tới OrderService
        └── 3. Khởi tạo instance tạm thời của UserService
        │
        ▼
Quét OrderService: Thấy cần @Inject(forwardRef(() => UserService))
        │
        ├── 4. Lấy instance của UserService đã có sẵn
        └── 5. Khởi tạo hoàn tất OrderService
        │
        ▼
Nạp ngược lại OrderService hoàn chỉnh vào UserService ──► Khởi động thành công!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Circular Dependency (Refactoring Decision Tree)
\`\`\`diagram
HỆ THỐNG BỊ DÍNH LỖI CIRCULAR DEPENDENCY GIỮA SERVICE A VÀ SERVICE B?
│
├── Phương Án Tạm Thời (Quick-fix không khuyến khích):
│   └──► Dùng forwardRef(() => ServiceA) ở cả hai bên
│
└── Phương Án Kiến Trúc Chuẩn Mực (Senior Engineering Refactoring):
    ├── Tách logic chung sang một Service thứ 3 (Service C) để cả A và B cùng inject C?
    │   └──► TỐT NHẤT: Triệt tiêu chu trình, đồ thị trở lại thành DAG thuần túy!
    │
    └── Thay đổi giao tiếp trực tiếp thành Event-driven (Phát sự kiện)?
        └──► Dùng EventEmitter2 (@OnEvent) để giao tiếp bất đồng bộ lỏng lẻo (Decoupled)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Phạm Vi (Scope) | Chi Phí Tạo Object | Áp Lực Lên Garbage Collector | Lưu Được State Từng Request | Tốc Độ Xử Lý API |
| :--- | :--- | :--- | :--- | :--- |
| **Scope.DEFAULT** | $0$ sau khi app khởi động | Hoàn toàn bằng $0$ ($0\\%$ GC) | Tuyệt đối KHÔNG (Rò rỉ state)| Tối đa (Cực nhanh) |
| **Scope.TRANSIENT** | Thấp (Tạo lúc startup) | Thấp | Không | Tương đương Singleton |
| **Scope.REQUEST** | Rất cao (Tạo mới mỗi req) | Cực lớn (GC Thrashing liên tục)| Có (Lưu userId, trace-id) | Chậm hơn $3\\times$ - $5\\times$ |
| **AsyncLocalStorage**| Cực thấp (Ngữ cảnh luồng) | Rất thấp (Node core API) | Hoàn hảo cho trace-id/user | Nhanh hơn Scope.REQUEST rất nhiều |
`,
      realCodeSnippet: `
import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { AsyncLocalStorage } from 'async_hooks';

// =========================================================================
// ANTI-PATTERN: DÙNG SCOPE.REQUEST (Tốn CPU/RAM, gây GC Thrashing ở tải cao)
// =========================================================================
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedLoggerService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  public log(message: string): void {
    const traceId = (this.request.headers['x-trace-id'] as string) || 'UNKNOWN';
    console.log(\`[RequestScoped Trace: \${traceId}] \${message}\`);
  }
}

// =========================================================================
// ENTERPRISE PATTERN: DÙNG ASYNCLOCALSTORAGE (Singleton 100% Zero-Allocation)
// =========================================================================
export interface RequestContextStore {
  traceId: string;
  userId?: string;
  tenantId?: string;
  startTime: number;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

@Injectable() // SINGLETON Scope.DEFAULT mặc định - Cực kỳ tiết kiệm bộ nhớ!
export class AsyncLocalStorageContextService {
  public setContext(context: RequestContextStore, next: () => void): void {
    requestContextStorage.run(context, next);
  }

  public getTraceId(): string {
    const store = requestContextStorage.getStore();
    return store?.traceId || 'N/A';
  }

  public getContext(): RequestContextStore | undefined {
    return requestContextStorage.getStore();
  }

  public log(message: string): void {
    const traceId = this.getTraceId();
    console.log(\`[Enterprise ALS Trace: \${traceId}] \${message}\`);
  }
}
`,
      quiz: [
        {
          id: 'c4-l3-q1',
          question: 'Hiện tượng "Scope Bubbling" trong NestJS Dependency Injection gây ra hậu quả tiêu cực nào về mặt hiệu năng hệ thống?',
          options: [
            'Trình biên dịch TypeScript sẽ báo lỗi đỏ toàn bộ dự án và từ chối xuất ra mã JavaScript cho các tệp tin liên quan.',
            'Nếu một Service cấp thấp (như Repository) được cấu hình Scope.REQUEST, toàn bộ các Service và Controller phụ thuộc vào nó dọc theo chuỗi DI đều bị ép biến thành Scope.REQUEST theo, gây bùng nổ cấp phát instance trên Heap.',
            'Các module bị dính Scope Bubbling sẽ tự động ngừng hoạt động sau khi phục vụ đủ một nghìn yêu cầu HTTP từ người dùng.',
            'Dữ liệu của người dùng này sẽ tự động ghi đè lên bộ nhớ của người dùng khác do các luồng bị gộp chung vào một biến static.'
          ],
          correctIndex: 1,
          explanation: 'Scope.REQUEST có tính lan truyền ngược (Bubbling) lên toàn bộ chuỗi dependency. Nếu một Repository hoặc Service sâu bên dưới được cấu hình Scope.REQUEST, tất cả các Service và Controller gián tiếp hoặc trực tiếp inject nó bắt buộc phải được tái tạo lại trên mỗi HTTP request, làm bùng nổ số lượng instance và gây áp lực khủng khiếp lên Garbage Collector.'
        },
        {
          id: 'c4-l3-q2',
          question: 'Tại sao việc lạm dụng Scope.REQUEST để trích xuất Request Context (như userId, traceId) bị coi là một Anti-Pattern nghiêm trọng trong hệ thống High-Concurrency?',
          options: [
            'Vì Scope.REQUEST chỉ hỗ trợ giao thức HTTP/1.0 và hoàn toàn không tương thích với HTTP/2 và HTTP/3.',
            'Vì đối tượng Request trong Node.js không cho phép truy cập vào các trường header xác thực như Authorization.',
            'Vì hệ điều hành Linux sẽ tự động khóa các cổng mạng TCP nếu phát hiện một tiến trình tạo quá nhiều instance.',
            'Vì nó phá hủy hoàn toàn ưu thế tái sử dụng bộ nhớ của Singleton; hàng nghìn request/giây tạo ra hàng chục nghìn instance mới trên Young Generation, khiến V8 Garbage Collector rơi vào tình trạng GC Thrashing và làm độ trễ P99 tăng vọt.'
          ],
          correctIndex: 3,
          explanation: 'Trong môi trường tải cao, việc khởi tạo lại hàng chục service instances cho mỗi request chỉ để đọc một trường userId/traceId gây lãng phí CPU và RAM cực lớn (GC Thrashing). Giải pháp chuẩn của các Senior Architect là giữ toàn bộ Service ở dạng Singleton (Scope.DEFAULT) và sử dụng Node.js AsyncLocalStorage để chia sẻ ngữ cảnh request.'
        },
        {
          id: 'c4-l3-q3',
          question: 'Bản chất kỹ thuật của hàm forwardRef(() => TargetService) trong NestJS giúp giải quyết tình trạng Circular Dependency giữa hai Provider là gì?',
          options: [
            'Bọc tham chiếu class bên trong một hàm callback đóng gói (closure) để trì hoãn việc phân giải token cho đến khi cả hai class đều đã được nạp và khởi tạo trong module context.',
            'Tự động sao chép mã nguồn của service thứ hai ghép vào service thứ nhất để hợp nhất thành một class duy nhất trong RAM.',
            'Chuyển một trong hai service sang thực thi trên một tiến trình Node.js hoàn toàn mới tách biệt ngoài mạng nội bộ.',
            'Lưu trữ toàn bộ phương thức của class vào Redis để hai service có thể gọi RPC không cần thông qua constructor.'
          ],
          correctIndex: 0,
          explanation: 'forwardRef(() => TargetService) trả về một đối tượng chứa hàm callback. Khi file mã nguồn đang được nạp, tham chiếu chưa tồn tại (undefined). Bằng cách bọc trong hàm closure () => TargetService, NestJS trì hoãn việc đánh giá con trỏ cho đến khi toàn bộ các class đã được JavaScript nạp vào bộ nhớ, cho phép giải quyết vòng lặp phụ thuộc.'
        },
        {
          id: 'c4-l3-q4',
          question: 'Cách thức refactor chuẩn mực và triệt để nhất trong thiết kế kiến trúc phần mềm khi phát hiện Circular Dependency giữa UserService và OrderService là gì?',
          options: [
            'Khai báo tất cả các service bị vòng lặp thành biến toàn cục (global variables) gắn trực tiếp vào global object của Node.js.',
            'Chuyển toàn bộ các phương thức của cả hai service sang dạng hàm static đồng bộ để bỏ qua việc inject constructor.',
            'Tách phần logic chung hoặc phụ thuộc lẫn nhau sang một Service trung gian thứ 3 (đưa đồ thị phụ thuộc trở lại dạng DAG không chu trình), hoặc chuyển sang cơ chế giao tiếp lỏng lẻo hướng sự kiện (Event-Driven với EventEmitter).',
            'Tăng thời gian timeout khởi động của NestJS lên sáu mươi giây để hệ điều hành tự động phân giải chu trình.'
          ],
          correctIndex: 2,
          explanation: 'forwardRef() chỉ là giải pháp tạm thời (workaround). Cách refactor chuẩn mực trong kiến trúc phần mềm là: 1) Tách các phương thức dùng chung sang một Service trung gian thứ 3 (đưa đồ thị trở lại dạng DAG thuần túy), hoặc 2) Chuyển mối quan hệ gọi trực tiếp thành cơ chế phát sự kiện bất đồng bộ lỏng lẻo (Event-Driven với EventEmitter hoặc Message Broker).'
        },
        {
          id: 'c4-l3-q5',
          question: 'Thuật toán Sắp xếp Tô pô (Topological Sort) được IoC Container sử dụng để xác định thứ tự khởi tạo các Provider trong đồ thị DAG dựa trên nguyên lý nào?',
          options: [
            'Liên tục tìm và khởi tạo các đỉnh (Provider/Module) có bậc vào bằng không (In-degree = 0, tức không phụ thuộc vào ai), sau đó loại bỏ đỉnh đó khỏi đồ thị và lặp lại quy trình cho đến khi tất cả các đỉnh đều được giải quyết.',
            'Sắp xếp các Provider theo thứ tự bảng chữ cái alphabet của tên Class.',
            'Ưu tiên khởi tạo các Service có dung lượng dòng mã nguồn (LOC) ngắn nhất trước.',
            'Khởi tạo ngẫu nhiên tất cả các Provider cùng một lúc bằng Promise.all() và tự động retry nếu có lỗi.'
          ],
          correctIndex: 0,
          explanation: 'Topological Sort duyệt qua các đỉnh trong Directed Acyclic Graph: đỉnh nào có In-degree = 0 (không có dependency) được đưa vào hàng đợi khởi tạo trước. Khi đỉnh đó khởi tạo xong, các cạnh đi ra từ nó được gỡ bỏ, làm giảm In-degree của các đỉnh phụ thuộc kế tiếp.'
        },
        {
          id: 'c4-l3-q6',
          question: 'Điểm khác biệt bản chất giữa Scope.DEFAULT (Singleton) và Scope.TRANSIENT trong NestJS là gì?',
          options: [
            'Scope.DEFAULT chỉ dùng cho Controller, còn Scope.TRANSIENT chỉ dùng cho Database Repository.',
            'Scope.DEFAULT chia sẻ một instance duy nhất trên toàn bộ ứng dụng; còn Scope.TRANSIENT sẽ tạo ra một instance mới độc lập tại mỗi vị trí được inject (injection site) trong quá trình khởi tạo ứng dụng.',
            'Scope.DEFAULT lưu dữ liệu trên ổ cứng SSD, còn Scope.TRANSIENT lưu dữ liệu trực tiếp trong CPU Cache L1.',
            'Scope.DEFAULT tự động hủy sau mỗi request, còn Scope.TRANSIENT tồn tại vĩnh viễn không bao giờ giải phóng.'
          ],
          correctIndex: 1,
          explanation: 'Scope.DEFAULT duy trì một Singleton duy nhất trong container. Scope.TRANSIENT tạo một instance mới cho mỗi injection site (mỗi khi được inject vào một provider khác), nhưng instance đó vẫn tồn tại theo vòng đời của provider chứa nó và không bị tạo lại theo từng request như Scope.REQUEST.'
        },
        {
          id: 'c4-l3-q7',
          question: 'Để hiện thực giải pháp lưu trữ Request Context (Correlation ID, Tenant ID) bằng AsyncLocalStorage trong NestJS mà không làm ô nhiễm Singleton Scope, vị trí nào trong pipeline là lý tưởng nhất để gọi asyncLocalStorage.run()?',
          options: [
            'Bên trong phương thức onModuleDestroy() của AppModule.',
            'Bên trong Controller Route Handler sau khi đã trả về HTTP Response.',
            'Bên trong Exception Filter khi có ngoại lệ HTTP 500 xảy ra.',
            'Bên trong NestJS Middleware (hoặc Fastify/Express Middleware hook) - nơi đầu tiên tiếp nhận incoming HTTP request để bọc toàn bộ chuỗi thực thi downstream vào ngữ cảnh storage.'
          ],
          correctIndex: 3,
          explanation: 'NestJS Middleware là thành phần đầu tiên trong request pipeline tiếp nhận request. Khi gọi asyncLocalStorage.run(store, () => next()), toàn bộ các bước tiếp theo (Guards, Interceptors, Pipes, Controller, Services, Repositories) chạy trong callback này đều kế thừa và truy xuất được store mà không cần truyền tham số thủ công.'
        },
        {
          id: 'c4-l3-q8',
          question: 'Nếu xảy ra Circular Dependency giữa Module A và Module B (Module A imports Module B và Module B imports Module A) ở cấp độ Module, điều gì sẽ xảy ra lúc khởi động nếu không sử dụng forwardRef() trong mảng imports?',
          options: [
            'NestJS tự động chuyển một trong hai Module sang chế độ hoạt động offline.',
            'Ứng dụng vẫn khởi động bình thường nhưng tốc độ xử lý mạng bị giảm 50%.',
            'Một trong hai Module sẽ nhận giá trị undefined tại thời điểm nạp, dẫn tới lỗi runtime crash ngay lập tức: "Nest cannot create the module instance... circular dependency between modules".',
            'Toàn bộ dữ liệu của cơ sở dữ liệu sẽ bị xóa sạch do cơ chế bảo vệ của NestJS.'
          ],
          correctIndex: 2,
          explanation: 'Khi 2 module import lẫn nhau mà không dùng forwardRef(() => ModuleB) và forwardRef(() => ModuleA), JavaScript module system (CommonJS/ESM) gặp chu trình và gán undefined cho module đang nạp dở, khiến NestJS ném lỗi crash "Nest cannot create the module instance... circular dependency".'
        }
      ],
      codeChallenge: {
        id: 'c4-l3-c1',
        title: 'Phát Hiện Vòng Lặp Phụ Thuộc Trong Đồ Thị Module (Cycle Detector)',
        description: 'Hiện thực hàm \`hasCircularDependency(graph: Record<string, string[]>): boolean\` nhận vào một đồ thị biểu diễn danh sách phụ thuộc giữa các module (key là tên module, value là mảng các module mà nó phụ thuộc vào). Trả về \`true\` nếu đồ thị có chứa chu trình khép kín (Circular Dependency), ngược lại trả về \`false\`. Xử lý chính xác cả đồ thị rỗng và đồ thị gồm nhiều thành phần liên thông rời rạc.',
        starterCode: `export function hasCircularDependency(graph: Record<string, string[]>): boolean {
  // TODO: Phát hiện chu trình khép kín trong đồ thị phụ thuộc
  return false;
}`,
        solution: `export function hasCircularDependency(graph: Record<string, string[]>): boolean {
  if (!graph || typeof graph !== 'object' || Object.keys(graph).length === 0) {
    return false;
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(node: string): boolean {
    visited.add(node);
    recStack.add(node);

    const neighbors = graph[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true; // Phát hiện chu trình!
      }
    }

    recStack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      if (dfs(node)) return true;
    }
  }

  return false;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Đồ thị DAG tuyến tính không có vòng lặp',
            input: [{ A: ['B'], B: ['C'], C: [] }],
            expected: false,
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Phát hiện vòng lặp trực tiếp giữa A và B (A -> B -> A)',
            input: [{ A: ['B'], B: ['A'] }],
            expected: true,
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Phát hiện vòng lặp tam giác (A -> B -> C -> A)',
            input: [{ A: ['B'], B: ['C'], C: ['A'] }],
            expected: true,
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Đồ thị rỗng -> Trả về false',
            input: [{}],
            expected: false,
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Đồ thị có nhiều nhánh rời rạc, nhánh thứ hai có vòng lặp khép kín',
            input: [{ X: ['Y'], Y: [], M: ['N'], N: ['P'], P: ['M'] }],
            expected: true,
            hidden: true
          }
        ]
      }
    }
  ]
};
