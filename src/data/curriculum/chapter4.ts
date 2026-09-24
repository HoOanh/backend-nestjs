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
# 1. ẨN DỤ TRỰC QUAN: TỰ CHẾ ĐỒ CHƠI Ở NHÀ VS DÂY CHUYỀN LẮP RÁP NHÀ MÁY TỰ ĐỘNG

Để hiểu sự chuyển dịch tư duy từ lập trình hướng đối tượng cơ bản sang Enterprise Architecture:
* **Tư duy cũ (Tự chế đồ chơi tại nhà):** Một chiếc ô tô đồ chơi cần động cơ và 4 bánh xe. Khi lắp ráp, xe tự đi đúc bánh xe (\`this.wheels = new PlasticWheels()\`) và tự chế động cơ xăng (\`this.engine = new GasEngine()\`). Sự liên kết (Coupling) bị hàn chết cứng ngắc! Nếu ngày mai đại ca muốn thử nghiệm động cơ điện (\`ElectricEngine\`), đại ca buộc phải đập tan chiếc xe ra để hàn lại từ đầu. Không có cách nào kiểm thử (Unit Test) động cơ độc lập!
* **Inversion of Control (Dây chuyền lắp ráp nhà máy tự động):** Chiếc xe không tự tạo bất kỳ linh kiện nào cả! Nó chỉ có sẵn các khe cắm chuẩn hóa: "Tôi cần một vật thể tuân thủ giao diện IEngine và một bộ IWheels". **IoC Container chính là người quản đốc nhà máy tự động:** Quản đốc nhìn vào bản thiết kế (\`@Injectable()\`), tự động đi tìm động cơ điện và 4 bánh xe cao su tốt nhất trong kho, sau đó cắm trực tiếp vào xe khi xe được đưa lên băng chuyền (\`Constructor Injection\`). Chiếc xe hoàn toàn thụ động ("Đảo ngược quyền điều khiển" - Inversion of Control)!
* **Reflect Metadata (Mã vạch QR dán trên linh kiện):** Làm sao quản đốc biết class cần kiểu dữ liệu gì khi TypeScript biên dịch sang JavaScript thuần sẽ bị xóa sạch thông tin kiểu (Type Erasure)? Decorator của NestJS chính là máy in dán một chiếc mã QR (\`design:paramtypes\`) lên linh kiện. Khi khởi động, IoC Container quét mã QR để biết chính xác linh kiện cần nạp!

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
      realCodeSnippet: `
import { Injectable, Inject } from '@nestjs/common';

// 1. Định nghĩa Injection Token bằng Symbol để tránh xung đột chuỗi
export const NOTIFICATION_SERVICE = Symbol('NOTIFICATION_SERVICE');

// 2. Interface trừu tượng tuân thủ Dependency Inversion
export interface INotificationService {
  send(recipient: string, message: string): Promise<boolean>;
}

// 3. Hiện thực cấp thấp: Gửi qua SendGrid
@Injectable()
export class SendGridEmailService implements INotificationService {
  async send(recipient: string, message: string): Promise<boolean> {
    console.log(\`[SendGrid] Đang gửi mail đến \${recipient}: \${message}\`);
    return true;
  }
}

// 4. Hiện thực giả lập cho môi trường Unit Test
@Injectable()
export class MockNotificationService implements INotificationService {
  public sentMessages: Array<{ to: string; msg: string }> = [];

  async send(recipient: string, message: string): Promise<boolean> {
    this.sentMessages.push({ to: recipient, msg: message });
    return true;
  }
}

// 5. Service cấp cao: Hoàn toàn không phụ thuộc vào SendGrid hay Mock
@Injectable()
export class UserRegistrationService {
  constructor(
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifier: INotificationService
  ) {}

  async registerUser(email: string): Promise<void> {
    // Logic tạo tài khoản trong DB...
    await this.notifier.send(email, 'Chào mừng bạn gia nhập eSmiles!');
  }
}
`,
      quiz: [
        {
          id: 'c4-l1-q1',
          question: 'Bản chất cơ chế nào giúp NestJS IoC Container có thể tự động nhận diện và khởi tạo đúng các tham số phụ thuộc trong Constructor của một Service?',
          options: [
            'Sử dụng thư viện reflect-metadata kết hợp cờ emitDecoratorMetadata của TypeScript để đọc kiểu dữ liệu tại runtime.',
            'Quét toàn bộ mã nguồn dạng văn bản thô bằng các biểu thức chính quy regex trong lúc máy chủ đang khởi động.',
            'Dựa vào tên đặt của biến tham số trong constructor để suy đoán loại dịch vụ cần được bơm vào theo quy ước đặt tên.',
            'Bắt buộc lập trình viên phải khai báo thủ công danh sách các con trỏ bộ nhớ RAM trong tệp tin cấu hình package.json.'
          ],
          correctIndex: 0,
          explanation: 'Khi bật cờ emitDecoratorMetadata: true trong tsconfig.json, TypeScript compiler sẽ tự động chèn metadata mang tên "design:paramtypes" vào mã JavaScript lúc biên dịch decorator. NestJS IoC Container sử dụng thư viện reflect-metadata tại thời điểm runtime để đọc ra các class constructor này và tiến hành khởi tạo.'
        },
        {
          id: 'c4-l1-q2',
          question: 'Vì sao trong kiến trúc NestJS chuyên nghiệp, khi áp dụng nguyên lý Dependency Inversion ta bắt buộc phải dùng Custom Token (Symbol hoặc String) thay vì dùng TypeScript Interface?',
          options: [
            'Vì TypeScript Interface bị xóa sạch hoàn toàn trong quá trình biên dịch JavaScript nên không còn tồn tại ở Runtime.',
            'Vì các interface trong TypeScript không hỗ trợ các phương thức bất đồng bộ trả về đối tượng dạng Promise.',
            'Vì NestJS IoC Container từ chối các đối tượng có kích thước lớn hơn một kilobyte bộ nhớ heap theo mặc định.',
            'Vì chuẩn ECMAScript mới nhất đã thay thế hoàn toàn khái niệm Interface bằng các Class trừu tượng thuần túy.'
          ],
          correctIndex: 0,
          explanation: 'TypeScript áp dụng cơ chế Type Erasure: toàn bộ Interface, Type Alias đều bị compiler xóa sạch khi tạo ra mã JavaScript chạy trên Node.js. Do đó, Reflect Metadata không thể lưu vết một Interface tại Runtime. Ta bắt buộc phải dùng một thực thể tồn tại ở Runtime làm định danh (Symbol hoặc chuỗi String Token kèm @Inject()).'
        },
        {
          id: 'c4-l1-q3',
          question: 'Sự khác biệt cốt lõi giữa hai khái niệm Dependency Injection (DI) và Dependency Inversion Principle (DIP) là gì?',
          options: [
            'DI là mẫu hình kỹ thuật truyền phụ thuộc từ ngoài vào, còn DIP là nguyên lý kiến trúc hướng cả hai phụ thuộc vào Interface trừu tượng.',
            'DI là một tính năng độc quyền của NestJS, còn DIP là công cụ tối ưu hóa tốc độ biên dịch của trình thông dịch JavaScript.',
            'Cả hai là một thuật ngữ giống hệt nhau được các kiến trúc sư phần mềm sử dụng thay thế cho nhau tùy theo sở thích cá nhân.',
            'DIP yêu cầu sử dụng cơ chế đa luồng worker threads, trong khi DI chỉ hoạt động trên môi trường đơn luồng của V8 engine.'
          ],
          correctIndex: 0,
          explanation: 'Dependency Injection (DI) chỉ đơn thuần là kỹ thuật đưa instance vào qua Constructor/Setter. Còn Dependency Inversion Principle (DIP) là một nguyên lý SOLID cao cấp hơn: yêu cầu tách rời sự phụ thuộc trực tiếp giữa module cấp cao và cấp thấp thông qua một lớp Abstraction trung gian.'
        },
        {
          id: 'c4-l1-q4',
          question: 'Khi sử dụng Custom Provider dạng useFactory trong NestJS, trường hợp nào sau đây là kịch bản ứng dụng bắt buộc và chuẩn xác nhất?',
          options: [
            'Khi việc tạo đối tượng phụ thuộc đòi hỏi phải thực thi tác vụ bất đồng bộ hoặc đọc cấu hình động trước khi trả về instance.',
            'Khi cần tạo ra một hằng số số học cố định để chia sẻ cho các controller tính toán thuế thu nhập cá nhân.',
            'Khi muốn tự động chuyển đổi toàn bộ mã nguồn của một service sang thực thi trực tiếp trên card đồ họa rời.',
            'Khi muốn vô hiệu hóa hoàn toàn cơ chế thu gom rác tự động của V8 engine cho đối tượng service đó.'
          ],
          correctIndex: 0,
          explanation: 'useFactory là loại Provider duy nhất trong NestJS cho phép viết logic bất đồng bộ (async useFactory) có thể inject các dependency khác (thông qua mảng inject: [...]) để tính toán, kết nối Database, hoặc đọc cấu hình trước khi resolve ra instance cho IoC Container.'
        }
      ],
      codeChallenge: {
        id: 'c4-l1-c1',
        title: 'Xây Dựng Mini Inversion-of-Control (IoC) Container',
        description: 'Hiện thực class \`SimpleIoCContainer\` với hai phương thức: \`register<T>(token: string, instance: T): void\` và \`resolve<T>(token: string): T\`. Nếu token chưa được đăng ký, \`resolve\` phải ném ra Error \`"PROVIDER_NOT_FOUND: \${token}"\`. Đảm bảo container lưu trữ và trả về đúng đối tượng Singleton đã đăng ký.',
        starterCode: `
export class SimpleIoCContainer {
  public register<T>(token: string, instance: T): void {
    // TODO: Lưu trữ instance vào registry
  }

  public resolve<T>(token: string): T {
    // TODO: Trả về instance hoặc ném lỗi nếu không tìm thấy
    throw new Error('Not implemented');
  }
}
`,
        solution: `
export class SimpleIoCContainer {
  private readonly registry = new Map<string, unknown>();

  public register<T>(token: string, instance: T): void {
    this.registry.set(token, instance);
  }

  public resolve<T>(token: string): T {
    if (!this.registry.has(token)) {
      throw new Error(\`PROVIDER_NOT_FOUND: \${token}\`);
    }
    return this.registry.get(token) as T;
  }
}
`,
        testCases: [
          {
            name: 'Đăng ký và lấy thành công Service',
            input: ['AUTH_SERVICE', { login: () => true }],
            expected: true
          },
          {
            name: 'Ném lỗi khi resolve token chưa từng được đăng ký',
            input: ['UNKNOWN_TOKEN'],
            expected: 'THREW_ERROR'
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
# 1. ẨN DỤ TRỰC QUAN: 5 TRẠM KIỂM SOÁT TẠI SÂN BAY QUỐC TẾ

Khi một HTTP Request ập vào ứng dụng NestJS, nó giống như một hành khách quốc tế bước chân vào nhà ga sân bay:
* **Trạm 1 - Middleware (Cổng an ninh soi chiếu hành lý tổng quát):** Nằm ở rìa ngoài cùng. Bất kỳ ai bước vào đều phải đi qua cổng này. Middleware có thể kiểm tra định dạng gói tin, ghi log thời gian đến, giải mã cookie. Middleware không biết hành khách sẽ bay chuyến bay nào (chưa biết Controller hay Route Handler nào sẽ xử lý).
* **Trạm 2 - Guard (Cửa khẩu kiểm tra Hộ chiếu & Thị thực):** Hải quan đối chiếu danh tính. "Bạn có Visa hợp lệ để vào nước này không?" (Xác thực JWT Token & Phân quyền Role). Nếu không hợp lệ, lập tức chặn đứng và trục xuất về nước ngay tại chỗ (\`401 Unauthorized\` hoặc \`403 Forbidden\`) mà không tốn công cho hành khách bước tiếp vào sâu bên trong!
* **Trạm 3 - Interceptor (Tiếp viên hàng không kiêm đo đếm):** Tiếp viên bấm đồng hồ đo thời gian chuyến bay (Giai đoạn Pre-controller), sau đó theo dõi cho đến khi hành khách rời máy bay để phát quà hoặc biến đổi kết quả trả về (Giai đoạn Post-controller / RxJS Map).
* **Trạm 4 - Pipe (Máy đo hành lý & Khử trùng):** Cân hành lý xem có vượt quá số cân quy định không (Validation) và đổi tiền tệ sang đồng tiền bản địa (\`ParseIntPipe\`, ép kiểu DTO).
* **Controller Handler (Ghế ngồi máy bay):** Hành khách ngồi vào ghế và thưởng thức hành trình (Thực thi Business Logic).
* **Trạm 5 - Exception Filter (Đội ngũ y tế cấp cứu sân bay):** Nếu hành khách bị đột quỵ hoặc gặp sự cố ở bất kỳ chặng nào, đội ngũ y tế lập tức xuất hiện, sơ cứu và chuẩn hóa định dạng thông báo bệnh án (\`JSON Error Response\`) trước khi chuyển ra ngoài.

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
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

// Định dạng vỏ bọc phản hồi chuẩn mực (Envelope Pattern)
export interface StandardResponse<T> {
  statusCode: number;
  timestamp: string;
  durationMs: number;
  data: T;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>> {
  private readonly logger = new Logger(ResponseTransformInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<StandardResponse<T>> {
    const startTime = Date.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      // Biến đổi cấu trúc dữ liệu trả về cho toàn bộ client
      map((data) => ({
        statusCode: response.statusCode || 200,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        data,
      })),
      tap((envelope) => {
        this.logger.log(
          \`[\${request.method}] \${request.url} - Hoàn tất trong \${envelope.durationMs}ms\`
        );
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
            'Vì Guard có quyền truy cập vào ExecutionContext để đọc Metadata của Controller và Route Handler thông qua Reflector.',
            'Vì Guard được thực thi ở tầng nhân Linux kernel nên có tốc độ kiểm tra quyền nhanh hơn gấp mười lần middleware.',
            'Vì Middleware của Express không thể đọc được nội dung Authorization Header gửi kèm trong request của client.',
            'Vì Guard tự động mã hóa mật khẩu người dùng trước khi gửi thông tin xuống tầng xử lý của cơ sở dữ liệu quan hệ.'
          ],
          correctIndex: 0,
          explanation: 'Express Middleware chạy trước khi NestJS thực hiện định tuyến (Routing), do đó Middleware hoàn toàn không biết Request sắp được chuyển vào Controller hay Action nào. Ngược lại, Guard chạy sau khi router đã xác định đích đến, có thể truy cập ExecutionContext và Reflector để đọc các metadata như @Roles("ADMIN"), giúp phân quyền chính xác.'
        },
        {
          id: 'c4-l2-q2',
          question: 'Thứ tự thực thi nào sau đây mô tả đúng tuyệt đối chu trình xử lý một HTTP Request thành công trong kiến trúc NestJS?',
          options: [
            'Middleware -> Guards -> Interceptors (Pre) -> Pipes -> Route Handler -> Interceptors (Post).',
            'Pipes -> Middleware -> Guards -> Route Handler -> Interceptors -> Exception Filters.',
            'Guards -> Middleware -> Pipes -> Interceptors -> Route Handler -> Response Formatter.',
            'Interceptors -> Pipes -> Middleware -> Guards -> Route Handler -> Exception Filters.'
          ],
          correctIndex: 0,
          explanation: 'Theo chuẩn NestJS Request Lifecycle: Request đầu tiên đi qua Middleware (tầng ngoài cùng) -> Guards (kiểm tra quyền) -> Interceptors (phần pre-controller) -> Pipes (validate & transform dữ liệu params/body) -> Route Handler (Controller thực thi) -> Interceptors (phần post-controller xử lý kết quả trả về).'
        },
        {
          id: 'c4-l2-q3',
          question: 'Nếu một ngoại lệ (Exception) xảy ra bên trong một NestJS Pipe trong quá trình validate dữ liệu, thành phần nào tiếp theo sẽ xử lý lỗi này?',
          options: [
            'Exception Filter tương ứng sẽ bắt lấy ngoại lệ và định dạng lại cấu trúc lỗi trả về cho client mà không vào Controller.',
            'Controller Handler vẫn tiếp tục được thực thi với dữ liệu chưa được validate để đảm bảo hệ thống không bị gián đoạn.',
            'Pha Poll của Libuv Event Loop sẽ hủy bỏ socket kết nối và tự động khởi động lại tiến trình Node.js ngay lập tức.',
            'Interceptor phần Post-controller sẽ tự động gán dữ liệu mặc định vào request body và chuyển tiếp cho service.'
          ],
          correctIndex: 0,
          explanation: 'Khi Pipe phát hiện dữ liệu không hợp lệ (ví dụ BadRequestException từ ValidationPipe), nó lập tức ném ra ngoại lệ. Pipeline dừng ngay lập tức tại Pipe, bỏ qua hoàn toàn việc gọi Controller, và chuyển quyền xử lý trực tiếp sang Exception Filter để tạo mã lỗi 400 Bad Request trả về cho client.'
        },
        {
          id: 'c4-l2-q4',
          question: 'Khả năng độc đáo nào của NestJS Interceptor mà các thành phần khác như Guard hay Pipe hoàn toàn KHÔNG THỂ thực hiện được?',
          options: [
            'Bao bọc việc thực thi của hàm để can thiệp cả trước khi Controller chạy lẫn biến đổi kết quả trả về bằng RxJS Observable.',
            'Chuyển đổi kiểu dữ liệu từ chuỗi ký tự sang số nguyên nguyên thủy của các tham số đường dẫn URL trên trình duyệt.',
            'Chặn đứng ngay lập tức các yêu cầu chưa có thông tin xác thực danh tính người dùng trước khi tiến hành định tuyến.',
            'Bắt tất cả các lỗi cấp hệ điều hành khi máy chủ bị mất điện đột ngột trong các trung tâm lưu trữ dữ liệu đám mây.'
          ],
          correctIndex: 0,
          explanation: 'Chỉ có Interceptor được xây dựng trên nền tảng RxJS Observable stream. Nhờ phương thức next.handle(), Interceptor có khả năng thực thi code TRƯỚC khi controller chạy, và sử dụng các toán tử RxJS (map, tap, catchError, timeout) để biến đổi, đo đạc, hoặc ghi đè kết quả SAU KHI controller hoàn thành.'
        }
      ],
      codeChallenge: {
        id: 'c4-l2-c1',
        title: 'Mô Phỏng NestJS Execution Pipeline Chặn Lỗi Chuẩn Xác',
        description: 'Hiện thực hàm \`runPipeline(request: { token?: string; age?: number }): { status: number; body: unknown }\`. Pipeline gồm 3 bước: 1. Guard: nếu không có \`token\`, trả về \`{ status: 401, body: "UNAUTHORIZED" }\`. 2. Pipe: nếu \`age < 18\`, trả về \`{ status: 400, body: "INVALID_AGE" }\`. 3. Handler: nếu hợp lệ, trả về \`{ status: 200, body: { success: true } }\`. Không được gọi các bước sau nếu bước trước đã thất bại.',
        starterCode: `
export function runPipeline(request: { token?: string; age?: number }): {
  status: number;
  body: unknown;
} {
  // TODO: Hiện thực các trạm kiểm soát tuần tự
  return { status: 200, body: 'OK' };
}
`,
        solution: `
export function runPipeline(request: { token?: string; age?: number }): {
  status: number;
  body: unknown;
} {
  // Trạm 1: Guard kiểm tra quyền truy cập
  if (!request.token) {
    return { status: 401, body: 'UNAUTHORIZED' };
  }

  // Trạm 2: Pipe kiểm tra và thẩm định dữ liệu
  if (request.age === undefined || request.age < 18) {
    return { status: 400, body: 'INVALID_AGE' };
  }

  // Trạm 3: Controller Handler thực thi thành công
  return { status: 200, body: { success: true } };
}
`,
        testCases: [
          {
            name: 'Chặn tại Guard khi thiếu token',
            input: [{ age: 20 }],
            expected: { status: 401, body: 'UNAUTHORIZED' }
          },
          {
            name: 'Chặn tại Pipe khi age dưới 18 tuổi',
            input: [{ token: 'valid-jwt', age: 16 }],
            expected: { status: 400, body: 'INVALID_AGE' }
          },
          {
            name: 'Thực thi thành công qua toàn bộ pipeline',
            input: [{ token: 'valid-jwt', age: 25 }],
            expected: { status: 200, body: { success: true } }
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
# 1. ẨN DỤ TRỰC QUAN: CON GÀ QUẢ TRỨNG VS BÁC SĨ KHÁM RIÊNG TỪNG BỆNH NHÂN

Hai vấn đề hóc búa nhất trong kiến trúc NestJS nâng cao:
* **Circular Dependency (Vòng lặp Con Gà & Quả Trứng):** Service A cần Service B trong constructor (\`new ServiceA(b)\`). Nhưng Service B cũng đòi Service A trong constructor (\`new ServiceB(a)\`). IoC Container đứng hình: Muốn tạo A thì phải có B, muốn tạo B thì phải có A! Nếu không can thiệp, hệ thống sập ngay lúc khởi động với lỗi \`Nest can't resolve dependencies of...\`.
* **forwardRef() (Chiếc hộp giấy rỗng dán nhãn tương lai):** Giải pháp: Thay vì đòi đưa cả quả trứng ngay lập tức, nhà máy đưa cho con gà một chiếc hộp giấy rỗng có ghi địa chỉ: "Lát nữa quả trứng làm xong sẽ được bỏ vào đây, bây giờ hãy khởi tạo đi!". Khi cả hai hoàn thành, IoC liên kết con trỏ tham chiếu vào nhau.
* **Scope.REQUEST (Bác sĩ riêng cho từng người dân thành phố):** Mặc định (\`Scope.DEFAULT\`), bệnh viện có 1 bác sĩ duy nhất phục vụ toàn dân (Singleton: 1 instance trong RAM, dùng chung cho mọi request). Nếu đại ca đổi sang \`Scope.REQUEST\`: **Cứ mỗi bệnh nhân bước vào cửa, bệnh viện lại sinh sản vô tính một bác sĩ mới, cấp một phòng khám mới, rồi vứt bỏ vào thùng rác ngay sau khi khám xong!** Khi có 10,000 request ập đến, RAM nổ tung và Garbage Collector tê liệt vì phải dọn dẹp hàng trăm nghìn instance rác!

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
// GIẢI PHÁP 1: DÙNG SCOPE.REQUEST (Tốn tài nguyên bộ nhớ)
// =========================================================================
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedLoggerService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  log(message: string) {
    const traceId = this.request.headers['x-trace-id'];
    console.log(\`[Trace: \${traceId}] \${message}\`);
  }
}

// =========================================================================
// GIẢI PHÁP 2: DÙNG ASYNCLOCALSTORAGE (Singleton tối ưu hiệu năng cao nhất)
// =========================================================================
export const requestContextStorage = new AsyncLocalStorage<Map<string, unknown>>();

@Injectable() // Vẫn là SINGLETON mặc định 100% tiết kiệm tài nguyên!
export class HighPerformanceLoggerService {
  log(message: string) {
    const store = requestContextStorage.getStore();
    const traceId = store ? store.get('traceId') : 'N/A';
    console.log(\`[High-Perf Trace: \${traceId}] \${message}\`);
  }
}
`,
      quiz: [
        {
          id: 'c4-l3-q1',
          question: 'Hiện tượng "Scope Bubbling" trong NestJS Dependency Injection gây ra hậu quả tiêu cực nào về mặt hiệu năng hệ thống?',
          options: [
            'Nếu một Service cấp thấp dùng Scope.REQUEST, toàn bộ các Controller và Service phụ thuộc vào nó đều bị biến thành Scope.REQUEST theo.',
            'Các module bị dính Scope Bubbling sẽ tự động ngừng hoạt động sau khi phục vụ đủ một nghìn yêu cầu HTTP từ người dùng.',
            'Dữ liệu của người dùng này sẽ tự động ghi đè lên bộ nhớ của người dùng khác do các luồng bị gộp chung vào một instance.',
            'Trình biên dịch TypeScript sẽ báo lỗi đỏ toàn bộ dự án và từ chối xuất ra mã JavaScript cho các tệp tin liên quan.'
          ],
          correctIndex: 0,
          explanation: 'Scope.REQUEST có tính lan truyền ngược (Bubbling) lên toàn bộ chuỗi dependency. Nếu một Repository hoặc Service sâu bên dưới được cấu hình Scope.REQUEST, tất cả các Service và Controller gián tiếp hoặc trực tiếp inject nó bắt buộc phải được tái tạo lại trên mỗi HTTP request, làm bùng nổ số lượng instance và gây áp lực khủng khiếp lên Garbage Collector.'
        },
        {
          id: 'c4-l3-q2',
          question: 'Tại sao việc lạm dụng Scope.REQUEST để lấy thông tin người dùng (User Context) trong NestJS bị các Senior Architect coi là một "Anti-Pattern"?',
          options: [
            'Vì nó phá hủy ưu thế tái sử dụng bộ nhớ của Singleton, làm tăng vọt chi phí cấp phát và gây hiện tượng GC Thrashing làm chậm API.',
            'Vì Scope.REQUEST chỉ hỗ trợ giao thức HTTP/1.0 và hoàn toàn không tương thích với các kết nối mạng hiện đại HTTP/2.',
            'Vì đối tượng Request trong Node.js không cho phép truy cập vào các trường header xác thực như Authorization hay Cookie.',
            'Vì hệ điều hành Linux sẽ tự động khóa các cổng mạng TCP nếu phát hiện một tiến trình tạo quá nhiều biến cục bộ.'
          ],
          correctIndex: 0,
          explanation: 'Trong môi trường tải cao, việc khởi tạo lại hàng chục service instances cho mỗi request chỉ để đọc một trường userId/traceId gây lãng phí CPU và RAM cực lớn (GC Thrashing). Giải pháp chuẩn của các Senior Architect là giữ toàn bộ Service ở dạng Singleton (Scope.DEFAULT) và sử dụng Node.js AsyncLocalStorage để chia sẻ ngữ cảnh request.'
        },
        {
          id: 'c4-l3-q3',
          question: 'Bản chất kỹ thuật của hàm forwardRef() trong NestJS giúp giải quyết tình trạng Circular Dependency giữa hai Provider là gì?',
          options: [
            'Bọc tham chiếu class bên trong một hàm callback đóng gói (closure) để trì hoãn việc đọc định danh cho đến khi cả hai class đã nạp xong.',
            'Tự động sao chép mã nguồn của service thứ hai ghép vào service thứ nhất để biến hai class độc lập thành một class duy nhất.',
            'Chuyển một trong hai service sang thực thi trên một tiến trình Node.js hoàn toàn mới tách biệt ngoài hệ thống mạng.',
            'Tạo ra một bản sao lưu dữ liệu trong cơ sở dữ liệu Redis để hai service có thể trao đổi thông tin mà không cần constructor.'
          ],
          correctIndex: 0,
          explanation: 'forwardRef(() => TargetService) trả về một đối tượng chứa hàm callback. Khi file mã nguồn đang được nạp, tham chiếu chưa tồn tại (undefined). Bằng cách bọc trong hàm closure () => TargetService, NestJS trì hoãn việc đánh giá con trỏ cho đến khi toàn bộ các class đã được JavaScript nạp vào bộ nhớ, cho phép giải quyết vòng lặp phụ thuộc.'
        },
        {
          id: 'c4-l3-q4',
          question: 'Cách tốt nhất và chuẩn mực nhất để refactor triệt để lỗi Circular Dependency mà KHÔNG CẦN phải dùng đến forwardRef() là gì?',
          options: [
            'Tách phần logic chung mà cả hai service cùng cần sang một Service thứ ba, hoặc chuyển sang cơ chế giao tiếp hướng sự kiện Event-Driven.',
            'Chuyển toàn bộ các phương thức của cả hai service sang dạng hàm static đồng bộ để không cần sử dụng đến constructor.',
            'Khai báo tất cả các service bị vòng lặp thành biến toàn cục (global variables) gắn trực tiếp vào đối tượng global của Node.js.',
            'Tăng thời gian timeout khởi động của NestJS lên mười giây để hệ điều hành có đủ thời gian tự động gỡ rối vòng lặp.'
          ],
          correctIndex: 0,
          explanation: 'forwardRef() chỉ là giải pháp tạm thời (workaround). Cách refactor chuẩn mực trong kiến trúc phần mềm là: 1) Tách các phương thức dùng chung sang một Service trung gian thứ 3 (đưa đồ thị trở lại dạng DAG thuần túy), hoặc 2) Chuyển mối quan hệ gọi trực tiếp thành cơ chế phát sự kiện bất đồng bộ lỏng lẻo (Event-Driven với EventEmitter hoặc Message Broker).'
        }
      ],
      codeChallenge: {
        id: 'c4-l3-c1',
        title: 'Phát Hiện Vòng Lặp Phụ Thuộc Trong Đồ Thị Module (Cycle Detector)',
        description: 'Hiện thực hàm \`hasCircularDependency(graph: Record<string, string[]>): boolean\` nhận vào một đồ thị biểu diễn danh sách phụ thuộc giữa các module (key là tên module, value là mảng các module mà nó phụ thuộc vào). Trả về \`true\` nếu đồ thị có chứa chu trình khép kín (Circular Dependency), ngược lại trả về \`false\`. Sử dụng thuật toán DFS hoặc topological sort.',
        starterCode: `
export function hasCircularDependency(graph: Record<string, string[]>): boolean {
  // TODO: Phát hiện chu trình khép kín trong đồ thị phụ thuộc
  return false;
}
`,
        solution: `
export function hasCircularDependency(graph: Record<string, string[]>): boolean {
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
}
`,
        testCases: [
          {
            name: 'Đồ thị DAG tuyến tính không có vòng lặp',
            input: [{ A: ['B'], B: ['C'], C: [] }],
            expected: false
          },
          {
            name: 'Phát hiện vòng lặp trực tiếp giữa A và B (A -> B -> A)',
            input: [{ A: ['B'], B: ['A'] }],
            expected: true
          },
          {
            name: 'Phát hiện vòng lặp tam giác (A -> B -> C -> A)',
            input: [{ A: ['B'], B: ['C'], C: ['A'] }],
            expected: true
          }
        ]
      }
    }
  ]
};
