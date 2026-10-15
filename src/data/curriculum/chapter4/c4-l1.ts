import type { Lesson } from '../types.ts';

export const c4_l1: Lesson = {
  id: 'c4-l1',
  title: 'Bài 01: Inversion of Control (IoC), Dependency Injection & TypeScript Reflect Metadata Internals',
  duration: '60 phút',
  tag: 'NestJS Internals & DI',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Kiến trúc Đảo ngược Quyền điều khiển (Inversion of Control - IoC) và Cơ chế Phản chiếu Siêu dữ liệu (Metadata Reflection) từ tầng trình biên dịch TypeScript đến bộ máy phân giải của \`@nestjs/core\` thông qua 3 trục kiến thức cốt lõi:
> 1. **Nguyên lý Đảo ngược Quyền điều khiển (\`IoC\`), Tiêm Phụ thuộc (\`DI\`) và Nguyên tắc Đảo ngược Phụ thuộc (\`DIP — SOLID\`):** Hiểu rõ sự khác biệt bản chất giữa mẫu thiết kế \`Dependency Injection\` và nguyên lý kiến trúc \`Dependency Inversion Principle\`; phân tích hệ quả sụp đổ dây chuyền của Liên kết cứng (\`Tight Coupling\`) và phản mẫu \`Service Locator\`.
> 2. **Cơ chế Xóa kiểu TypeScript (\`Type Erasure\`), Cờ biên dịch \`emitDecoratorMetadata\` và Cấu trúc \`WeakMap\` của \`reflect-metadata\`:** Chứng minh tại sao \`Interface\` và \`Type Alias\` biến mất hoàn toàn ở Runtime; giải phẫu hàm \`__metadata("design:paramtypes", [...])\` và cách sử dụng \`Symbol\` / \`InjectionToken\` để vượt qua rào cản \`Type Erasure\`.
> 3. **Kiến trúc Nội tại của \`NestContainer\`, \`InstanceWrapper\`, Bốn Chiến lược \`Custom Providers\` và Đóng gói Module (\`Module Encapsulation\`):** Nắm vững thuật toán đệ quy phân giải đồ thị phụ thuộc lúc Bootstrap, sự khác biệt bộ nhớ giữa \`useClass\`, \`useValue\`, \`useFactory\`, \`useExisting\` và phương pháp chẩn đoán lỗi \`UnknownDependenciesException\` trên môi trường Production.

---

# 1. NGUYÊN LÝ ĐẢO NGƯỢC QUYỀN ĐIỀU KHIỂN (IOC), TIÊM PHỤ THUỘC (DI) VÀ NGUYÊN TẮC ĐẢO NGƯỢC PHỤ THUỘC (DIP - SOLID)

### 1.1 Khái niệm nền tảng: Liên kết cứng (Tight Coupling), Đảo ngược Quyền điều khiển (IoC) và Tiêm Phụ thuộc (DI)

Trong kỹ thuật phần mềm hệ thống lớn, chất lượng của một kiến trúc Backend được đo lường bằng mức độ **Liên kết lỏng (\`Loose Coupling\`)** giữa các thành phần và khả năng **Kiểm thử cô lập (\`Isolated Unit Testing\`)**. Khi xây dựng dịch vụ mà không có khung quản trị phụ thuộc, lập trình viên thường rơi vào 3 cấp độ tiến hóa kiến trúc sau:

1. **Khởi tạo Thủ công và Liên kết cứng (\`Manual Instantiation & Tight Coupling\`):**
   Khi một lớp nghiệp vụ bậc cao (ví dụ \`OrderService\`) trực tiếp gọi toán tử \`new StripePaymentGateway(new HttpClient(), process.env.STRIPE_KEY)\` ngay bên trong hàm khởi tạo của chính nó, lớp \`OrderService\` đã tự trói chặt vòng đời và mã nguồn của mình vào lớp thực thi vật lý \`StripePaymentGateway\`.
   - **Hệ quả về Vòng đời Bộ nhớ (\`Heap Duplication\`):** Nếu có 15 Service khác nhau cùng khởi tạo \`new StripePaymentGateway()\`, bộ nhớ V8 Heap phải cấp phát 15 bản sao dư thừa cùng giữ 15 bể kết nối TCP độc lập.
   - **Hệ quả Sụp đổ Dây chuyền (\`Cascading Breaking Changes\`):** Khi \`StripePaymentGateway\` cần thêm một tham số phụ thuộc thứ ba là \`MetricsLogger\` vào constructor, kỹ sư buộc phải mở toàn bộ 15 tệp tin gọi \`new StripePaymentGateway(...)\` trên khắp dự án để sửa đổi chữ ký hàm khởi tạo.
   - **Bất khả thi khi Kiểm thử Cô lập (\`Untestable Unit\`):** Khi chạy Unit Test cho \`OrderService\`, không có cách nào ngăn cản toán tử \`new\` bên trong hàm khởi tạo gọi thẳng ra mạng thật của Stripe.
2. **Nguyên lý Đảo ngược Quyền điều khiển (\`Inversion of Control — IoC\`):**
   **Đảo ngược Quyền điều khiển (\`IoC\`)** là nguyên lý thiết kế trong đó quyền chủ động tìm kiếm, khởi tạo, lắp ghép và hủy bỏ các đối tượng phụ thuộc được **tước bỏ khỏi lớp nghiệp vụ** và chuyển giao hoàn toàn cho một bộ điều phối trung tâm của Framework gọi là **Bộ chứa Đảo ngược Quyền điều khiển (\`IoC Container\` / \`DI Container\`)**. Lớp nghiệp vụ chuyển từ vai trò *"chủ động đi khởi tạo tài nguyên"* sang vai trò *"thụ động khai báo danh sách hợp đồng phụ thuộc cần thiết"*.
3. **Mẫu thiết kế Tiêm Phụ thuộc (\`Dependency Injection — DI\`) và Nguyên tắc Đảo ngược Phụ thuộc (\`Dependency Inversion Principle — DIP\`):**
   Rất nhiều kỹ sư đồng nhất hai khái niệm \`DI\` và \`DIP\`, nhưng trong Khoa học Máy tính chúng nằm ở hai tầng tư duy hoàn toàn khác nhau:
   - **Tiêm Phụ thuộc (\`Dependency Injection — DI\`):** Là một **Cơ chế Kỹ thuật cấp thấp (\`Wiring Mechanism / Design Pattern\`)** quy định cách thức truyền đối tượng phụ thuộc từ bên ngoài vào một lớp (qua \`Constructor Injection\`, \`Setter Injection\` hoặc \`Property Injection\`). Ngay cả khi bạn dùng \`DI\` (\`constructor(private stripe: StripeService)\`), nếu lớp cấp cao vẫn phụ thuộc trực tiếp vào tên lớp cụ thể \`StripeService\`, bạn mới chỉ đạt được \`DI\` nhưng **vẫn vi phạm nguyên tắc \`DIP\`**!
   - **Nguyên tắc Đảo ngược Phụ thuộc (\`Dependency Inversion Principle — DIP\`, chữ \`D\` trong \`SOLID\` của Robert C. Martin):** Là một **Định đề Kiến trúc Bậc cao** gồm 2 mệnh đề bất biến: **(a)** Các module cấp cao (chứa quy tắc nghiệp vụ cốt lõi) không được phép phụ thuộc vào các module cấp thấp (chứa chi tiết hạ tầng như SQL, Redis, Stripe SDK); cả hai bắt buộc phải phụ thuộc vào **Lớp Trừu tượng (\`Abstraction / Interface\`)**; và **(b)** Lớp trừu tượng không được phụ thuộc vào chi tiết thực thi, mà chi tiết thực thi phải phụ thuộc vào lớp trừu tượng.

### 1.2 Đối chiếu kiến trúc: Khởi tạo Thủ công (Tight Coupling), Service Locator Pattern và Constructor Dependency Injection

Nhiều hệ thống cũ cố gắng tránh \`Tight Coupling\` bằng cách tạo một kho lưu trữ toàn cục gọi là **Bộ định vị Dịch vụ (\`Service Locator Pattern\`, ví dụ \`Container.get('PAYMENT')\`)**. Tuy nhiên, \`Service Locator\` được coi là một phản mẫu (\`Anti-pattern\`) trong kiến trúc hiện đại vì nó che giấu các phụ thuộc vào sâu bên trong thân hàm, khiến lỗi thiếu phụ thuộc chỉ phát nổ ở thời điểm Runtime khi dòng lệnh đó vô tình được chạy tới. Bảng dưới đây đối chiếu định lượng 3 mô hình:

| Tiêu chí Kỹ thuật & Kiến trúc | Khởi tạo Thủ công (\`Tight Coupling / new\`) | Mẫu Bộ định vị Dịch vụ (\`Service Locator Pattern\`) | Tiêm Phụ thuộc qua Hàm khởi tạo + DIP (\`Constructor DI + DIP\`) |
| :--- | :--- | :--- | :--- |
| **1. Tính Minh bạch của Hợp đồng Phụ thuộc** | **Ẩn hoàn toàn**: Phụ thuộc bị chôn vùi bên trong mã khởi tạo nội bộ của lớp | **Ẩn hoàn toàn (Hidden Dependencies)**: Phải đọc từng dòng code trong thân hàm mới biết lớp gọi \`Locator.get()\` nào | **Tường minh 100%**: Toàn bộ phụ thuộc được phơi bày ngay tại chữ ký \`constructor(...)\` của lớp |
| **2. Thời điểm Phát hiện Lỗi Thiếu Phụ thuộc** | Phát hiện lúc biên dịch nhưng không thể thay thế hay cấu hình động | **Phát nổ muộn lúc Runtime**: Chỉ báo lỗi khi khách hàng gọi đúng nhánh \`if/else\` chứa lệnh \`Locator.get()\` bị thiếu | **Fail-Fast lúc Bootstrap (\`t = 0\`)**: \`IoC Container\` kiểm tra toàn bộ đồ thị và chặn khởi động ngay nếu thiếu bất kỳ token nào |
| **3. Mức độ Tiêu thụ Bộ nhớ V8 Heap** | Cấp phát trùng lặp $N$ bản sao đối tượng ở mọi nơi gọi toán tử \`new\` | Chia sẻ được \`Singleton\`, nhưng buộc mọi lớp phải phụ thuộc cứng vào lớp \`Locator\` toàn cục | Tối ưu tuyệt đối: **\`1 InstanceWrapper (Singleton)\`** duy nhất được chia sẻ qua con trỏ tham chiếu bộ nhớ (\`8 bytes/pointer\`) |
| **4. Khả năng Thay thế & Kiểm thử (\`Mocking\`)** | **Bất khả thi** nếu không can thiệp monkey-patch vào hệ thống \`require/import\` | Rủi ro nhiễm bẩn trạng thái (\`State Pollution\`) giữa các bài test chạy song song trên cùng Global Locator | **Cô lập tuyệt đối**: Truyền trực tiếp \`Mock Implementation\` qua constructor hoặc ghi đè bằng \`.overrideProvider()\` trong \`TestingModule\` |
| **5. Tuân thủ Nguyên lý Đóng/Mở (\`OCP\`) & \`DIP\`** | **Vi phạm nghiêm trọng**: Đổi từ Stripe sang PayPal phải sửa trực tiếp mã nguồn lớp nghiệp vụ | **Vi phạm \`DIP\`**: Lớp nghiệp vụ bị trói chặt vào API của \`ServiceLocator\` | **Tuân thủ hoàn toàn**: Đổi nhà cung cấp hạ tầng chỉ bằng 1 dòng cấu hình \`useClass\` ở tầng \`Module\` mà không chạm vào \`Service\` |

### 1.3 Phân biệt bản chất: Dependency Injection (DI Pattern) và Dependency Inversion Principle (DIP - Chữ D trong SOLID) qua Mã nguồn Thực tế

Hãy phân tích đoạn mã nguồn dưới đây để thấy rõ sự khác biệt giữa một lớp chỉ dùng \`DI\` bề nổi (vẫn bị khóa chặt vào hạ tầng cấp thấp) và một kiến trúc đạt chuẩn **\`DI + DIP\`** sử dụng \`Symbol Injection Token\` kết hợp \`Interface\` trừu tượng trong NestJS:

\`\`\`typescript
// File: src/modules/billing/payment-orchestrator.service.ts
import { Injectable, Inject } from '@nestjs/common';

// 1. THIẾT KẾ SAI (ANTI-PATTERN - VI PHẠM DIP & TIGHT COUPLING):
// Lớp nghiệp vụ cấp cao tự khởi tạo hoặc phụ thuộc trực tiếp vào lớp thực thi cấp thấp StripeSdkClient
export class StripeSdkClient {
  chargeCard(amountCents: number): string {
    return \`STRIPE_TX_\${amountCents}\`;
  }
}

@Injectable()
export class TightCoupledOrderService {
  // LỖI KIẾN TRÚC: Dù có @Injectable(), việc khai báo trực tiếp StripeSdkClient (hoặc gọi new)
  // khiến OrderService bị trói chặt vào Stripe, vi phạm nguyên lý Dependency Inversion (DIP)!
  private readonly stripeClient = new StripeSdkClient();

  processCheckout(orderId: string, amountCents: number): { orderId: string; txId: string } {
    const txId = this.stripeClient.chargeCard(amountCents);
    return { orderId, txId };
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION DIP PATTERN):
// Bước A: Định nghĩa Hợp đồng Trừu tượng (Interface) và Runtime Token bằng Symbol bất biến
export const PAYMENT_GATEWAY_TOKEN = Symbol('PAYMENT_GATEWAY_TOKEN');

export interface ChargeResult {
  readonly transactionId: string;
  readonly providerName: 'STRIPE' | 'VNPAY' | 'MOCK';
  readonly feeCents: number;
}

export interface IPaymentGateway {
  executeCharge(orderId: string, amountCents: number): Promise<ChargeResult>;
}

// Bước B: Module cấp thấp (Chi tiết hạ tầng) phụ thuộc vào Abstraction (implements IPaymentGateway)
@Injectable()
export class VnpayProductionGateway implements IPaymentGateway {
  async executeCharge(orderId: string, amountCents: number): Promise<ChargeResult> {
    const feeCents = Math.round(amountCents * 0.015);
    return {
      transactionId: \`VNPAY_\${orderId}_\${amountCents}\`,
      providerName: 'VNPAY',
      feeCents,
    };
  }
}

// Bước C: Module cấp cao (Nghiệp vụ lõi) chỉ phụ thuộc vào Abstraction thông qua @Inject(TOKEN)
@Injectable()
export class DecoupledOrderService {
  constructor(
    @Inject(PAYMENT_GATEWAY_TOKEN)
    private readonly paymentGateway: IPaymentGateway,
  ) {}

  async checkoutOrder(orderId: string, amountCents: number): Promise<ChargeResult> {
    if (amountCents <= 0) {
      throw new Error('INVALID_CHECKOUT_AMOUNT');
    }
    return this.paymentGateway.executeCharge(orderId, amountCents);
  }
}
\`\`\`

Khi ứng dụng NestJS khởi động qua lệnh \`await NestFactory.create(AppModule)\`, bộ máy \`NestContainer\` và \`Injector\` sẽ thực hiện chu trình quét siêu dữ liệu và cấp phát bộ nhớ theo từng mốc mili-giây như trong bảng truy vết thực thi dưới đây:

| Mốc thời gian | Giai đoạn trong \`@nestjs/core\` | Thao tác Thực thi trên CPU & \`Reflect Metadata\` | Trạng thái Cấu trúc Dữ liệu trên V8 Heap | Hệ quả Kiến trúc & An toàn Hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **Module Discovery** (\`DependenciesScanner\`) | Quét mảng \`imports\`, \`providers\`, \`controllers\` từ \`AppModule\` xuống các Module con | Khởi tạo \`Map<string, Module>\` trong \`NestContainer\`; tạo vỏ \`InstanceWrapper\` với \`isResolved = false\` | Toàn bộ danh mục Token được lập chỉ mục vào bảng băm với độ phức tạp tra cứu $O(1)$ |
| **\`t = 2 ms\`** | **Metadata Reflection** (\`Injector.reflectConstructorParams\`) | Gọi \`Reflect.getMetadata('design:paramtypes', DecoupledOrderService)\` và đọc \`self:paramtypes\` từ \`@Inject()\` | Phát hiện tham số vị trí \`index = 0\` được ghi đè bởi Custom Token \`Symbol(PAYMENT_GATEWAY_TOKEN)\` | Vượt qua hoàn toàn giới hạn \`Type Erasure\` của \`interface IPaymentGateway\` |
| **\`t = 5 ms\`** | **Recursive Leaf Resolution** (\`Injector.loadInstance\`) | Tra cứu \`Symbol(PAYMENT_GATEWAY_TOKEN)\` $\rightarrow$ ánh xạ tới lớp \`VnpayProductionGateway\` (0 tham số phụ thuộc) | Thực thi \`new VnpayProductionGateway()\`; lưu con trỏ đối tượng vào \`wrapper.instance\` (\`Old Generation Heap\`) | Khởi tạo các nút lá (\`Leaf Providers\`) trước tiên theo đúng thứ tự đồ thị phụ thuộc |
| **\`t = 9 ms\`** | **Parent Wiring** (\`Injector.instantiateClass\`) | Truyền con trỏ \`vnpayInstance\` vừa tạo vào \`new DecoupledOrderService(vnpayInstance)\` | Đánh dấu \`DecoupledOrderService\` có \`isResolved = true\`; tốn đúng \`8 bytes\` con trỏ tham chiếu trên 64-bit OS | Hàng chục Controller cùng inject \`DecoupledOrderService\` đều trỏ về duy nhất 1 vùng nhớ |
| **\`t = 14 ms\`** | **Lifecycle Hooks & Listen** (\`callInitHook\`) | Kích hoạt tuần tự \`onModuleInit()\` $\rightarrow$ \`onApplicationBootstrap()\` trước khi mở cổng TCP \`app.listen(3000)\` | Toàn bộ cây Singleton đã nằm cố định trong RAM; 0% chi phí phân giải DI phát sinh khi có HTTP Request đến | Đảm bảo **Fail-Fast**: Nếu thiếu bất kỳ Provider nào, tiến trình dừng ngay tại \`t = 2 ms\` trước khi nhận tải |

### 1.4 Định lượng Chi phí Cấp phát Bộ nhớ và Độ phức tạp Đồ thị Phụ thuộc khi Không dùng Singleton IoC Container

Chúng ta có thể chứng minh lợi ích vật lý của \`Singleton IoC Container\` so với việc khởi tạo đối tượng thủ công theo từng yêu cầu thông qua hệ công thức định lượng bộ nhớ và thời gian phân giải dưới đây:

\`\`\`
Tổng số đối tượng phải cấp phát nếu khởi tạo thủ công trên mỗi Request (Allocated_Objects_Per_Sec) = RPS × Avg_Dependency_Depth × Services_Per_Request
Dung lượng RAM tiết kiệm được nhờ Singleton IoC (Saved_Heap_Bytes_Per_Sec) = Allocated_Objects_Per_Sec × Avg_Service_Instance_Size_Bytes
Độ phức tạp thời gian phân giải Đồ thị Phụ thuộc lúc Bootstrap (T_Bootstrap_Resolution) = O(V + E) với V là số Provider (Vertices) và E là số cạnh @Inject (Edges)
Ví dụ định lượng: Với lưu lượng 2,000 RPS, mỗi Request đi qua 6 Services (mỗi Service kèm cấu hình/client nặng 4 KB):
-> Khởi tạo thủ công đốt cháy: 2,000 × 6 × 4 KB = 48,000 KB/s (~46.88 MB/giây rác thải trên V8 Young Generation!).
-> Với Singleton IoC Container: Toàn bộ 6 Services chỉ khởi tạo đúng 1 lần lúc Bootstrap (tốn 24 KB cố định), chi phí cấp phát DI khi chạy = 0 Bytes/giây!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc nền tảng về IoC, DI và DIP):**
> 1. **Sử dụng \`DI\` chưa chắc đã đạt được \`DIP\`:** Nếu một lớp nghiệp vụ cấp cao inject trực tiếp một lớp hạ tầng cụ thể (\`constructor(private readonly redisClient: RedisClient)\`), bạn mới chỉ dùng cơ chế nối dây \`DI\` nhưng vẫn vi phạm \`DIP\`. Để tuân thủ \`DIP\`, lớp nghiệp vụ chỉ được phép phụ thuộc vào một \`Interface\` trừu tượng được định danh bởi một \`Symbol\` hoặc \`Abstract Class Token\`.
> 2. **Nguyên tắc Fail-Fast tại thời điểm Bootstrap:** Mọi phụ thuộc bắt buộc phải được khai báo qua \`Constructor Injection\` để \`NestContainer\` thẩm định toàn bộ đồ thị $O(V + E)$ ngay khi khởi động máy chủ, tuyệt đối không dùng phản mẫu \`Service Locator\` để tránh lỗi nổ chậm lúc Runtime.

---

# 2. CƠ CHẾ XÓA KIỂU TYPESCRIPT (TYPE ERASURE), TRÌNH BIÊN DỊCH EMITDECORATORMETADATA VÀ CẤU TRÚC REFLECT METADATA TRONG V8 HEAP

### 2.1 Hiện tượng Xóa Kiểu tại Thời điểm Biên dịch (Compile-Time Type Erasure) và Bài toán Mất Dấu Phụ thuộc ở Runtime

Một câu hỏi cốt lõi thường xuất hiện trong các kỳ phỏng vấn Kiến trúc sư Hệ thống: *"Tại sao trong NestJS, khi viết \`constructor(private userService: UserService)\` thì không cần \`@Inject()\`, nhưng khi viết \`constructor(private payment: IPaymentGateway)\` với \`IPaymentGateway\` là một \`interface\` thì bắt buộc phải gắn \`@Inject(PAYMENT_TOKEN)\`?"*

Câu trả lời nằm ở bản chất của trình biên dịch TypeScript (\`tsc\` / \`SWC\`) và cơ chế **Xóa Kiểu (\`Compile-Time Type Erasure\`)**:
1. **Sự biến mất hoàn toàn của \`interface\` và \`type\` khi biên dịch sang JavaScript:**
   Động cơ thực thi V8 của Node.js chỉ hiểu mã nguồn JavaScript thuần túy theo chuẩn ECMAScript. Khi trình biên dịch TypeScript chuyển đổi tệp \`.ts\` sang \`.js\`, toàn bộ các cấu trúc chỉ tồn tại phục vụ kiểm tra kiểu tĩnh bao gồm \`interface\`, \`type alias\`, và các tham số kiểu tổng quát (\`Generics <T>\`) đều bị **xóa bỏ hoàn toàn (\`100% Erased\`)** khỏi cây cú pháp trừu tượng (\`AST\`). Chúng không để lại bất kỳ đối tượng, hàm hay biến nào trong bộ nhớ V8 ở thời điểm chạy (\`Runtime\`).
2. **Sự tồn tại vật lý của \`class\` ở Runtime:**
   Ngược lại, từ khóa \`class UserService {}\` trong TypeScript là một cấu trúc thực thi của chuẩn ES6: sau khi biên dịch sang JavaScript, \`UserService\` vẫn tồn tại trên V8 Heap dưới dạng một **Hàm Khởi tạo (\`Constructor Function Object\`)** có địa chỉ bộ nhớ cụ thể.
3. **Vai trò của cặp cờ \`experimentalDecorators\` và \`emitDecoratorMetadata\` trong \`tsconfig.json\`:**
   Nếu chỉ xóa kiểu thông thường, câu lệnh \`constructor(private userService: UserService)\` khi sang JavaScript sẽ biến thành \`constructor(userService) { this.userService = userService; }\` — làm mất sạch thông tin rằng tham số đầu tiên cần một bản thể của \`UserService\`. Để cứu vãn thông tin này trước khi bị xóa kiểu, khi bật cờ \`"emitDecoratorMetadata": true\` VÀ lớp đó có gắn ít nhất một Decorator (như \`@Injectable()\` hoặc \`@Controller()\`), trình biên dịch TypeScript sẽ tự động chèn thêm một lời gọi hàm đặc biệt là **\`__metadata("design:paramtypes", [UserService])\`** truyền thẳng tham chiếu hàm khởi tạo \`UserService\` vào bộ lưu trữ siêu dữ liệu Runtime!

Bảng dưới đây phân tích chính xác những gì trình biên dịch TypeScript phát sinh vào mảng \`design:paramtypes\` cho 6 loại kiểu dữ liệu khác nhau:

| Kiểu Khai báo Tham số trong TypeScript Constructor | Giá trị Phát sinh Thực tế trong \`design:paramtypes\` tại Runtime | Khả năng Tự động Phân giải của \`NestContainer\` | Nguyên nhân Kỹ thuật ở Tầng Trình biên dịch (\`tsc / SWC\`) | Giải pháp Khai báo Chuẩn trong NestJS |
| :--- | :--- | :--- | :--- | :--- |
| **1. Lớp Cụ thể (\`class UsersService\`)** | Tham chiếu hàm \`[UsersService]\` | **Tự động 100%** (Không cần \`@Inject\`) | \`class\` tồn tại ở Runtime dưới dạng \`Function\` nên được đưa thẳng vào mảng metadata | Dùng trực tiếp \`constructor(private readonly svc: UsersService)\` |
| **2. Lớp Trừu tượng (\`abstract class BaseRepo\`)** | Tham chiếu hàm \`[BaseRepo]\` | **Tự động 100%** khi đăng ký \`provide: BaseRepo\` | Dù là \`abstract\`, khi sang JS nó vẫn là một \`Function\` hợp lệ có địa chỉ bộ nhớ riêng | Có thể dùng \`abstract class\` làm Injection Token thay cho \`interface\` |
| **3. Giao diện (\`interface IPaymentGateway\`)** | Đối tượng gốc **\`[Object]\`** (Mất hoàn toàn tên Interface!) | **Thất bại (\`UnknownDependenciesException\`)** | \`interface\` bị xóa sạch (\`Type Erasure\`) nên \`tsc\` phải thế chỗ bằng hàm \`Object\` chung chung | **Bắt buộc** dùng \`@Inject(PAYMENT_TOKEN)\` đi kèm \`Symbol\` hoặc \`String\` |
| **4. Kiểu Hợp (\`Union Type: Stripe \\| Paypal\`)** | Đối tượng gốc **\`[Object]\`** | **Thất bại** nếu không chỉ định Token tường minh | Không thể biểu diễn phép hợp của 2 kiểu khác nhau bằng một hàm khởi tạo đơn lẻ ở Runtime | **Bắt buộc** dùng \`@Inject(CUSTOM_TOKEN)\` để chỉ định rõ nhánh cần tiêm |
| **5. Kiểu Nguyên thủy (\`string\`, \`number\`, \`boolean\`)** | Hàm bao \`[String]\`, \`[Number]\`, \`[Boolean]\` | **Thất bại** (Không thể gọi \`new String()\` làm Service) | \`tsc\` ánh xạ kiểu nguyên thủy sang các hàm khởi tạo Wrapper tương ứng của JS | Dùng \`@Inject('CONFIG_KEY')\` kết hợp \`useValue\` hoặc \`ConfigService\` |
| **6. Kiểu Tổng quát (\`Repository<UserEntity>\`)** | Chỉ còn lớp vỏ **\`[Repository]\`** (Mất \`<UserEntity>\`!) | **Lỗi trùng Token** giữa \`Repository<User>\` và \`Repository<Order>\` | Tham số kiểu Generic \`<T>\` bị xóa sạch lúc biên dịch, mọi Repository đều biến thành cùng 1 token \`Repository\` | Dùng hàm tạo Custom Token theo tên Entity (như \`@InjectRepository(UserEntity)\`) |

### 2.2 Giải phẫu Mã phát sinh \`__decorate\` và \`__metadata\` của TypeScript Compiler (\`emitDecoratorMetadata: true\`)

Để thấy tận mắt cơ chế hoạt động dưới lớp vỏ của NestJS, hãy quan sát đoạn mã nguồn dưới đây minh họa cách trình biên dịch TypeScript biến đổi một lớp có \`@Injectable()\` và \`@Inject()\` thành các lời gọi \`Reflect.defineMetadata\` và cách \`Injector\` của NestJS kết hợp hai khóa siêu dữ liệu **\`design:paramtypes\`** (tự động từ compiler) với **\`self:paramtypes\`** (ghi đè từ \`@Inject\`):

\`\`\`typescript
// File: src/core/ioc/emitted-metadata-inspection.ts
import 'reflect-metadata';

// Khóa metadata chuẩn mà trình biên dịch TypeScript và @nestjs/core sử dụng nội bộ:
export const PARAMTYPES_METADATA = 'design:paramtypes';
export const SELF_DECLARED_DEPS_METADATA = 'self:paramtypes';

export interface CustomParamMetadata {
  readonly index: number;
  readonly param: symbol | string | Function;
}

// Mô phỏng chính xác cách decorator @Inject(token) của @nestjs/common ghi đè siêu dữ liệu:
export function SimulatedInject(token: symbol | string | Function): ParameterDecorator {
  return (target: Object, _propertyKey: string | symbol | undefined, parameterIndex: number): void => {
    const existingSelfDeps: CustomParamMetadata[] =
      Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, target) || [];
    existingSelfDeps.push({ index: parameterIndex, param: token });
    Reflect.defineMetadata(SELF_DECLARED_DEPS_METADATA, existingSelfDeps, target);
  };
}

// Mô phỏng thuật toán kết hợp (Merge) giữa design:paramtypes và self:paramtypes của NestJS Injector:
export function resolveFinalConstructorTokens(targetClass: Function): Array<symbol | string | Function> {
  // Bước 1: Đọc mảng kiểu tham số do TypeScript Compiler tự động phát sinh (design:paramtypes)
  const compilerParamTypes: Function[] =
    Reflect.getMetadata(PARAMTYPES_METADATA, targetClass) || [];

  // Bước 2: Sao chép sang mảng kết quả
  const finalTokens: Array<symbol | string | Function> = [...compilerParamTypes];

  // Bước 3: Đọc danh sách các vị trí tham số được gắn @Inject(CUSTOM_TOKEN) tường minh
  const selfDeclaredDeps: CustomParamMetadata[] =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, targetClass) || [];

  // Bước 4: Ghi đè các vị trí có [Object] (do Interface bị xóa kiểu) bằng Custom Token tương ứng!
  for (const override of selfDeclaredDeps) {
    finalTokens[override.index] = override.param;
  }

  return finalTokens;
}
\`\`\`

### 2.3 Cấu trúc Bảng ánh xạ \`WeakMap\` nội tại của \`reflect-metadata\` trên V8 Heap và Cơ chế Định danh \`Symbol\` / \`InjectionToken\`

Khi thư viện \`reflect-metadata\` được nạp vào đầu tệp \`main.ts\`, nó khởi tạo một cấu trúc dữ liệu bậc 3 bên trong vùng nhớ toàn cục của V8 để lưu trữ toàn bộ siêu dữ liệu của mọi Class trong ứng dụng:

\`\`\`
Cấu trúc Lưu trữ Nội tại của Reflect Metadata: WeakMap<TargetObject, Map<PropertyKey | undefined, Map<MetadataKey, MetadataValue>>>
Độ phức tạp Tra cứu Metadata của 1 Class (T_Metadata_Lookup) = O(1) (3 bước băm liên tiếp: TargetObject -> undefined (Constructor) -> 'design:paramtypes')
Chi phí Bộ nhớ của mỗi Mục Metadata (Memory_Per_Decorated_Class) ≈ 120 Bytes (Map Headers) + (N_Params × 8 Bytes Pointer)
\`\`\`

1. **Tại sao \`reflect-metadata\` bắt buộc phải dùng \`WeakMap\` ở tầng ngoài cùng thay vì \`Map\` thông thường?**
   Trong \`WeakMap\`, khóa (\`TargetObject\` — tức là hàm khởi tạo của Class) được giữ bằng **Tham chiếu Yếu (\`Weak Reference\`)**. Nếu một lớp hoặc module động được tạo ra tạm thời rồi không còn bất kỳ biến nào trong chương trình tham chiếu tới nữa, bộ thu gom rác V8 (\`Garbage Collector\`) có thể thu hồi ngay lập tức cả Class đó lẫn toàn bộ nhánh \`Map\` siêu dữ liệu đi kèm mà không gây **Rò rỉ bộ nhớ vĩnh viễn (\`Memory Leak\`)**.
2. **Tại sao \`Symbol('TOKEN')\` ưu việt hơn chuỗi ký tự \`'TOKEN'\` khi làm Injection Token?**
   - Khi dùng chuỗi ký tự (\`provide: 'CACHE_CLIENT'\`), nếu hai module độc lập hoặc hai thư viện bên thứ ba vô tình đặt trùng tên chuỗi \`'CACHE_CLIENT'\`, sẽ xảy ra hiện tượng **Đụng độ Không gian tên (\`Token Namespace Collision\`)** khiến Provider đăng ký sau âm thầm ghi đè hoặc che khuất Provider đăng ký trước.
   - Ngược lại, theo đặc tả ECMAScript, mỗi lần gọi \`Symbol('CACHE_CLIENT')\` sẽ sinh ra một định danh nguyên thủy duy nhất tuyệt đối trên toàn bộ V8 Isolate (\`Symbol('A') !== Symbol('A')\`), loại bỏ 100% nguy cơ xung đột Token giữa các module.

> **Tổng kết học thuật Phần 2 (Hai quy tắc sống còn về Siêu dữ liệu Runtime):**
> 1. **Điều kiện Cần và Đủ để \`design:paramtypes\` được sinh ra:** Phải thỏa mãn đồng thời 2 điều kiện: **(a)** Tệp \`tsconfig.json\` bật cả \`"experimentalDecorators": true\` lẫn \`"emitDecoratorMetadata": true\`, và **(b)** Bản thân Class đó phải được gắn ít nhất một Class Decorator (như \`@Injectable()\`). Nếu thiếu \`@Injectable()\`, trình biên dịch TypeScript sẽ không phát sinh dòng \`__metadata("design:paramtypes", ...)\` nào cho lớp đó!
> 2. **Quy tắc Bù đắp Xóa kiểu (\`Type Erasure Compensation\`):** Mọi tham số constructor có kiểu là \`interface\`, \`type\`, \`primitive\` hoặc \`Generic <T>\` đều bị xóa thành \`Object\` hoặc lớp vỏ chung ở Runtime; do đó bắt buộc phải đi kèm decorator \`@Inject(TOKEN)\` để ghi đè vào \`self:paramtypes\`.

---

# 3. KIẾN TRÚC BỘ MÁY NESTCONTAINER, CÁC CHIẾN LƯỢC CUSTOM PROVIDERS VÀ CƠ CHẾ ĐÓNG GÓI MODULE (MODULE ENCAPSULATION)

### 3.1 Cấu trúc Nội tại của \`NestContainer\`, \`Module\` và \`InstanceWrapper\` trong \`@nestjs/core\`

Bên dưới bề mặt của các Decorator như \`@Module()\` và \`@Injectable()\`, mã nguồn lõi của \`@nestjs/core\` quản lý toàn bộ vòng đời ứng dụng thông qua 3 lớp cấu trúc dữ liệu trung tâm:

1. **\`NestContainer\` (Bộ chứa Gốc của Ứng dụng):**
   Nắm giữ một bảng băm trung tâm \`private readonly modules = new ModulesContainer()\` (thực chất là \`Map<string, Module>\`), trong đó khóa là mã băm định danh của từng Module và giá trị là đối tượng \`Module\` tương ứng. Ngoài ra, \`NestContainer\` duy trì danh sách các **Global Modules** (\`@Global()\`) để tự động gắn kết các Provider toàn cục vào phạm vi nhìn thấy của mọi Module khác trong hệ thống.
2. **\`Module\` (Đơn vị Đóng gói và Ranh giới Cô lập — Encapsulation Boundary):**
   Khác với Spring Boot (Java) nơi mọi \`@Component\` mặc định được gom vào một giỏ toàn cục duy nhất (\`Flat Application Context\`), NestJS thực thi **Kiến trúc Đồ thị Module Có Ranh giới Cô lập Nghiêm ngặt (\`Strict Module Encapsulation\`)**. Mỗi đối tượng \`Module\` sở hữu 4 tập hợp riêng biệt:
   - \`_providers: Map<InjectionToken, InstanceWrapper>\`: Bảng băm chứa các Provider nội bộ của riêng Module đó.
   - \`_controllers: Map<InjectionToken, InstanceWrapper>\`: Bảng băm chứa các Controller thuộc Module đó.
   - \`_imports: Set<Module>\`: Tập hợp các con trỏ trỏ tới các Module khác được Module hiện tại nhập vào.
   - \`_exports: Set<InjectionToken>\`: **Danh sách trắng (\`Whitelist\`)** quy định những Token nào trong \`_providers\` được phép lộ diện ra bên ngoài khi một Module khác import Module này.
3. **\`InstanceWrapper<T>\` (Vỏ bọc Quản trị Vòng đời Cá thể):**
   \`NestContainer\` không lưu trực tiếp đối tượng \`new UsersService()\` vào \`Map\`, mà bọc mỗi Provider trong một cấu trúc siêu dữ liệu gọi là \`InstanceWrapper\`. Đối tượng \`InstanceWrapper\` lưu trữ:
   - \`token\`: Định danh của Provider (Class, Symbol hoặc String).
   - \`metatype\`: Hàm khởi tạo Class hoặc hàm \`useFactory\`.
   - \`inject\`: Mảng các Token phụ thuộc (dùng cho Factory Provider).
   - \`values: WeakMap<ContextId, PerContextInstance<T>>\`: Lưu trữ bản thể Singleton mặc định tại khóa \`STATIC_CONTEXT\` (khởi tạo 1 lần lúc Bootstrap), đồng thời cho phép mở rộng lưu các bản thể theo từng Request nếu dùng \`Scope.REQUEST\`.

### 3.2 Bốn Chiến lược Đăng ký Custom Providers (\`useClass\`, \`useValue\`, \`useFactory\`, \`useExisting\`) và Ranh giới Đóng gói Module

Khi cú pháp rút gọn \`providers: [UsersService]\` (tương đương \`{ provide: UsersService, useClass: UsersService }\`) không đủ đáp ứng các kịch bản kiến trúc phức tạp, NestJS cung cấp 4 chiến lược đăng ký **Custom Providers** tường minh. Đoạn mã dưới đây minh họa cách kết hợp cả 4 chiến lược trong một Module hạ tầng thực tế:

\`\`\`typescript
// File: src/modules/database/database-connection.module.ts
import { Module, Injectable, Inject } from '@nestjs/common';

export const DB_CONFIG_OPTIONS = Symbol('DB_CONFIG_OPTIONS');
export const PRIMARY_DB_POOL = Symbol('PRIMARY_DB_POOL');
export const READONLY_DB_POOL_ALIAS = Symbol('READONLY_DB_POOL_ALIAS');
export const AUDIT_LOGGER_PORT = Symbol('AUDIT_LOGGER_PORT');

export interface DatabaseConfigOptions {
  readonly host: string;
  readonly port: number;
  readonly maxConnections: number;
  readonly enableTls: boolean;
}

export interface IDatabasePool {
  query(sql: string): Promise<{ rowCount: number }>;
}

export interface IAuditLogger {
  recordQuery(sql: string): void;
}

@Injectable()
export class ProductionStructuredLogger implements IAuditLogger {
  private readonly logs: string[] = [];
  recordQuery(sql: string): void {
    this.logs.push(\`[PROD_AUDIT] \${sql}\`);
  }
}

@Injectable()
export class InMemoryTestLogger implements IAuditLogger {
  recordQuery(_sql: string): void {
    // Không ghi ra I/O khi chạy kiểm thử tự động
  }
}

@Module({
  providers: [
    // 1. useValue: Tiêm một hằng số cấu hình bất biến (Object.freeze) hoặc Mock Object tạo sẵn
    {
      provide: DB_CONFIG_OPTIONS,
      useValue: Object.freeze<DatabaseConfigOptions>({
        host: 'pg-primary.internal.arc.tech',
        port: 5432,
        maxConnections: 25,
        enableTls: true,
      }),
    },

    // 2. useClass: Hoán đổi linh hoạt lớp thực thi (Strategy Pattern) theo môi trường mà không sửa Service
    {
      provide: AUDIT_LOGGER_PORT,
      useClass:
        process.env.NODE_ENV === 'production'
          ? ProductionStructuredLogger
          : InMemoryTestLogger,
    },

    // 3. useFactory: Khởi tạo bất đồng bộ (Async Bootstrapping) có tiêm phụ thuộc khác qua mảng inject: [...]
    {
      provide: PRIMARY_DB_POOL,
      useFactory: async (
        config: DatabaseConfigOptions,
        auditLogger: IAuditLogger,
      ): Promise<IDatabasePool> => {
        auditLogger.recordQuery(\`CONNECTING_TO_\${config.host}:\${config.port}\`);
        return {
          async query(sql: string): Promise<{ rowCount: number }> {
            auditLogger.recordQuery(sql);
            return { rowCount: 1 };
          },
        };
      },
      inject: [DB_CONFIG_OPTIONS, AUDIT_LOGGER_PORT],
    },

    // 4. useExisting: Tạo Bí danh (Alias Token) trỏ về CÙNG MỘT INSTANCE trong RAM (0 byte cấp phát thêm!)
    {
      provide: READONLY_DB_POOL_ALIAS,
      useExisting: PRIMARY_DB_POOL,
    },
  ],
  // Ranh giới đóng gói (Encapsulation): Chỉ xuất khẩu 2 Token kết nối, giấu kín DB_CONFIG_OPTIONS nội bộ!
  exports: [PRIMARY_DB_POOL, READONLY_DB_POOL_ALIAS],
})
export class DatabaseConnectionModule {}
\`\`\`

### 3.3 Phương pháp Chẩn đoán và Xử lý Sự cố Khởi tạo IoC Container trên Môi trường Production

Khi hệ thống mở rộng lên hàng trăm Module, các lỗi cấu hình đồ thị DI hoặc rò rỉ bộ nhớ từ cách đăng ký Provider sai lầm rất dễ xảy ra. Bảng dưới đây cung cấp cẩm nang chẩn đoán 5 sự cố điển hình nhất của \`NestContainer\`:

| Triệu chứng / Thông báo Lỗi Lúc Khởi động | Nguyên nhân Gốc rễ ở Tầng \`@nestjs/core\` & Compiler | Cách thức \`Injector\` Thực thi Nội bộ | Rủi ro Nếu Xử lý Sai cách (Workaround) | Giải pháp Khắc phục Triệt để Chuẩn Kiến trúc |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`Nest can't resolve dependencies of the XService (?). Please make sure that the argument Dependency at index [0] is available\`** | \`Module A\` chứa \`XService\` chưa \`imports: [ModuleB]\`, hoặc \`ModuleB\` quên khai báo \`Dependency\` trong mảng \`exports: [...]\` | \`Injector.lookupComponentInParentModules\` duyệt hết \`_imports\` và \`_exports\` nhưng không tìm thấy \`InstanceWrapper\` khớp Token | Tự ý khai báo lại \`providers: [Dependency]\` vào \`Module A\` $\rightarrow$ **Tạo ra 2 bản sao Singleton tách biệt trong RAM!** | Đưa \`Dependency\` vào \`exports\` của \`Module B\` và thêm \`Module B\` vào \`imports\` của \`Module A\` |
| **2. \`Nest can't resolve dependencies of the XService (Object, ...)\` (Xuất hiện chữ \`Object\` tại vị trí lỗi)** | Tham số tại vị trí đó có kiểu là \`interface\` hoặc \`type\` nhưng lập trình viên quên gắn decorator \`@Inject(TOKEN)\` | Do \`Type Erasure\`, \`design:paramtypes\` trả về hàm \`[Object]\` và không có mục ghi đè nào trong \`self:paramtypes\` | Đổi \`interface\` thành \`any\` (vẫn phát sinh \`[Object]\` và tiếp tục lỗi!) | Khởi tạo \`export const MY_TOKEN = Symbol('MY_TOKEN')\` và gắn \`@Inject(MY_TOKEN)\` vào tham số đó |
| **3. Toàn bộ các tham số của một Service đều báo lỗi \`(?)\` dù đã đăng ký đủ trong Module** | Lớp \`XService\` bị thiếu decorator \`@Injectable()\` trên đầu khai báo \`class\`, hoặc \`tsconfig.json\` tắt \`emitDecoratorMetadata\` | Không có Decorator gắn trên Class $\rightarrow$ Trình biên dịch TS không phát sinh \`__metadata("design:paramtypes", [...])\` | Gắn \`@Inject()\` thủ công lên từng tham số một cách dư thừa | Luôn gắn \`@Injectable()\` lên mọi lớp Provider và bật \`emitDecoratorMetadata: true\` trong \`tsconfig.json\` |
| **4. Ứng dụng bị treo cứng (\`Hang\`) ở bước \`NestFactory.create()\` không mở được cổng HTTP** | Một \`Async Factory Provider\` (\`useFactory: async () => ...\`) bị kẹt \`Promise\` không bao giờ \`resolve\` (ví dụ chờ kết nối DB/Broker chết) | \`Injector.loadInstance\` dùng \`await\` chờ hàm \`useFactory\` hoàn tất trước khi chuyển sang bước \`app.listen()\` | Bỏ \`await\` trong \`useFactory\` khiến ứng dụng mở cổng nhận Request khi DB chưa kết nối xong | Thiết lập \`connectionTimeoutMillis\` nghiêm ngặt (ví dụ \`5000 ms\`) trong mọi hàm \`async useFactory\` |
| **5. Hai Token khác nhau (\`InterfaceToken\` và \`ConcreteClass\`) tạo ra 2 kết nối Database độc lập** | Đăng ký \`{ provide: InterfaceToken, useClass: ConcreteClass }\` cùng với \`ConcreteClass\` trong mảng \`providers\` | \`useClass\` luôn gọi \`new ConcreteClass()\` tạo ra một bản thể mới hoàn toàn tách biệt với bản thể của token \`ConcreteClass\` | Chấp nhận tốn gấp đôi số lượng kết nối trong Connection Pool và lệch trạng thái nội bộ | Dùng **\`useExisting: ConcreteClass\`** để \`InterfaceToken\` tái sử dụng chính xác con trỏ bản thể của \`ConcreteClass\` |

> **Tổng kết học thuật Phần 3 (Quy tắc Vàng chống Nhân bản Singleton — Anti-Duplication Rule):**
> Tuyệt đối không bao giờ khai báo một \`Service\` của Module khác trực tiếp vào mảng \`providers: [ExternalService]\` của Module hiện tại để chữa cháy lỗi thiếu phụ thuộc! Hành động đó buộc \`NestContainer\` khởi tạo thêm một bản thể \`ExternalService\` thứ hai nằm ở vùng nhớ độc lập, phá vỡ tính chất \`Singleton\` toàn cục và làm nhân đôi số lượng kết nối Database/Redis hoặc làm sai lệch bộ nhớ đệm trong RAM.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống IoC Container Và Cơ Chế Reflect Metadata (NestJS IoC & Metadata Architecture Map)
\`\`\`diagram
[TOPOLOGY: orbital-cycle]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG ĐẶC TẢ METADATA & TOKEN (METADATA & INJECTION TOKENS)                 │
│    ├── compiler design:paramtypes: Lưu vết tham chiếu Class tại Runtime       │
│    ├── self:paramtypes (@Inject): Ghi đè vị trí Interface bị Type Erasure     │
│    └── Symbol / Abstract Token: Định danh duy nhất chống đụng độ Namespace    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Cung cấp Danh sách Token Phụ thuộc cho Bộ phân giải
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG BỘ MÁY PHÂN GIẢI IOC CONTAINER (IOC RESOLUTION ENGINE)                │
│    ├── DependenciesScanner: Quét cây Module và lập chỉ mục InstanceWrapper    │
│    ├── Recursive Injector: Duyệt đệ quy khởi tạo các nút lá (Leaf Nodes) trước│
│    └── Custom Provider Factories: Thực thi useClass, useValue, useFactory     │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Cấp phát Bản thể và Kiểm soát Ranh giới Truy cập
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG LƯU TRỮ INSTANCE & ĐÓNG GÓI MODULE (INSTANCE REGISTRY & ENCAPSULATION)│
│    ├── Singleton Cache (STATIC_CONTEXT): Lưu 1 bản thể cố định trên Old Gen   │
│    ├── Module Boundary (imports/exports): Cô lập phạm vi nhìn thấy giữa Module│
│    └── Alias Pointer (useExisting): Trỏ nhiều Token về cùng 1 vùng nhớ Heap   │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Khởi Tạo Phụ Thuộc Thủ Công (Tight Coupling) Và Phân Giải Qua IoC Container Với DIP Token
\`\`\`diagram
MÔ HÌNH CŨ: KHỞI TẠO THỦ CÔNG BẰNG TOÁN TỬ NEW (TIGHT COUPLING & HEAP DUPLICATION)
OrderService gọi new StripeService() ──► [ Cấp phát lặp lại trên mỗi nơi gọi ] ──► [ Khóa chặt vào Stripe SDK ] ──► BẤT KHẢ THI KHI UNIT TEST
15 Services gọi new = Nhân bản 15 instances dư thừa trên V8 Heap, đổi cổng thanh toán phải sửa code cả 15 tệp tin.

MÔ HÌNH HIỆN ĐẠI: INVERSION OF CONTROL (IOC) KẾT HỢP SYMBOL TOKEN & DEPENDENCY INVERSION (DIP)
OrderService (@Inject) ──┐
BillingService (@Inject) ─┼──► [ Token: PAYMENT_GATEWAY (IPaymentGateway) ] ──► IoC Container tiêm 1 Singleton duy nhất
RefundService (@Inject) ──┘                         │
                                                    └──► Hoán đổi Stripe / VNPay / Mock ────► 0 dòng code nghiệp vụ bị sửa đổi
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Lựa Chọn Cơ Chế Đăng Ký Provider Trong NestJS)
\`\`\`diagram
                 CẦN ĐĂNG KÝ MỘT PHỤ THUỘC (PROVIDER) VÀO MẢNG PROVIDERS CỦA NESTJS MODULE?
                                                      │
                                                      ▼
                       Quá trình khởi tạo đối tượng có cần chờ tác vụ bất đồng bộ (Async) hay cấu hình động không?
                       /                                                                                       \\
        CÓ (CẦN ĐỌC CONFIG BẤT ĐỒNG BỘ / KẾT NỐI DB)                                          KHÔNG (KHỞI TẠO ĐỒNG BỘ TỨC THÌ)
                        /                                                                                       \\
                       ▼                                                                                         ▼
     [ DÙNG ASYNC USEFACTORY PROVIDER (CHUẨN) ]                                  Bạn muốn tạo bản thể mới hay trỏ về bản thể đã có sẵn trong Container?
     - Khai báo useFactory: async (cfg) => ...                                   /                                                               \\
     - Truyền mảng inject: [ConfigService]                         TRỎ VỀ INSTANCE ĐÃ TỒN TẠI                                     TẠO INSTANCE MỚI HOẶC GIÁ TRỊ TĨNH
     - Luôn đặt timeout chống treo quá trình Bootstrap                         /                                                                   \\
                                                                              ▼                                                                     ▼
                                                           [ DÙNG USEEXISTING ALIAS (TỐI ƯU RAM) ]                   [ DÙNG USECLASS HOẶC USEVALUE (CHUẨN) ]
                                                           - Tạo bí danh (Alias Token) cho Service có sẵn            - Dùng useClass để đổi Class theo môi trường
                                                           - Tiết kiệm 100% RAM, không tạo bản sao thứ 2             - Dùng useValue cho hằng số Object.freeze()
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu useClass, useValue, useFactory Và useExisting)

| Tiêu Chí So Sánh | \`Standard / useClass\` | \`useValue\` (Value Provider) | \`useFactory\` (Factory Provider) | \`useExisting\` (Alias Provider) |
| :--- | :--- | :--- | :--- | :--- |
| **Cơ chế Cấp phát Bộ nhớ V8** | Gọi \`new TargetClass(...)\` tạo **1 bản thể mới** lưu vào \`InstanceWrapper\` | Lưu trực tiếp tham chiếu tới đối tượng/hằng số đã tạo sẵn bên ngoài | Lưu giá trị trả về từ hàm \`useFactory(...deps)\` vào \`InstanceWrapper\` | **\`0 Bytes\` cấp phát mới**: Trỏ thẳng tới \`InstanceWrapper\` của Token đích |
| **Hỗ trợ Khởi tạo Bất đồng bộ (\`Async\`)** | **Không**: Hàm \`constructor\` trong JS/TS không thể là \`async\` | **Không**: Nhận giá trị tĩnh đã tồn tại sẵn | **Có (\`async/await\`)**: Container tạm dừng chờ \`Promise\` hoàn tất lúc Bootstrap | Phụ thuộc vào bản thể gốc mà nó trỏ tới |
| **Cách thức Tiêm Phụ thuộc Con** | Tự động đọc qua \`Reflect.getMetadata('design:paramtypes')\` | Không tiêm phụ thuộc qua Container | Khai báo tường minh danh sách Token qua mảng \`inject: [TokenA, TokenB]\` | Không cần tiêm lại (tái sử dụng nguyên trạng bản thể gốc) |
| **Kịch bản Ứng dụng Chuẩn Production** | Dùng cho \`90%\` dịch vụ nghiệp vụ hoặc chuyển đổi chiến lược \`Prod\` vs \`Mock\` | Dùng cho cấu hình tĩnh đóng băng (\`Object.freeze\`) hoặc Mock trong Unit Test | Dùng để khởi tạo \`Database Pool\`, \`Redis Client\`, \`SDK\` cần đọc \`ConfigService\` | Dùng khi cung cấp nhiều \`Interface Narrowing\` (ISP) cho cùng một \`Service\` lớn |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`NotificationOrchestratorService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Phân tách Cơ chế \`DI\` và Nguyên lý \`DIP\` (\`DI vs DIP Separation Invariant\`):** \`Dependency Injection (DI)\` chỉ là kỹ thuật truyền phụ thuộc từ bên ngoài vào qua hàm khởi tạo, trong khi \`Dependency Inversion Principle (DIP)\` đòi hỏi module nghiệp vụ cấp cao tuyệt đối không được tham chiếu tới lớp thực thi cấp thấp. Trong TypeScript/NestJS, việc thực thi \`DIP\` bắt buộc phải đi qua bộ đôi **\`Interface\` (kiểm tra kiểu lúc Compile-time)** và **\`Symbol / Abstract Class Token\` (định danh lúc Runtime)**.
2. **Định đề Bù đắp Xóa kiểu bằng Siêu dữ liệu (\`Type Erasure & Metadata Compensation Invariant\`):** Trình biên dịch TypeScript xóa bỏ hoàn toàn mọi \`interface\`, \`type alias\` và tham số \`Generic <T>\` khi biên dịch sang JavaScript, khiến \`design:paramtypes\` chỉ nhận được hàm \`[Object]\` vô nghĩa. Do đó, mọi tham số constructor không phải là một \`Class\` cụ thể đều bắt buộc phải gắn decorator \`@Inject(TOKEN)\` để ghi đè định danh chính xác vào khóa \`self:paramtypes\`.
3. **Định đề Đóng gói Ranh giới Module (\`Strict Module Encapsulation Invariant\`):** Mọi Provider đăng ký trong một \`@Module()\` đều ở trạng thái cô lập riêng tư (\`Module-Private\`) theo mặc định. Một \`Module B\` chỉ có thể tiêm được \`Provider X\` của \`Module A\` khi và chỉ khi \`Module A\` xuất khẩu \`Provider X\` trong mảng \`exports: [X]\` và \`Module B\` nhập \`Module A\` trong mảng \`imports: [ModuleA]\`; việc khai báo lặp lại \`providers: [X]\` ở nhiều Module sẽ phá vỡ tính chất \`Singleton\` và gây nhân bản vùng nhớ trên V8 Heap.
4. **Định đề Đồng nhất Bản thể qua Bí danh (\`Alias Pointer Identity Invariant\`):** Khi một lớp thực thi cần được truy cập dưới nhiều Token khác nhau (ví dụ vừa truy cập qua tên lớp \`PostgresPoolService\`, vừa truy cập qua giao diện \`READ_DATABASE_PORT\`), kỹ sư bắt buộc phải sử dụng **\`useExisting\`** thay vì \`useClass\` để cả hai Token cùng trỏ về duy nhất một bản thể trong bộ nhớ.
  `,
  realCodeSnippet: `// File: src/modules/notification/notification-dip.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Kiến trúc Đa kênh Thông báo tuân thủ DIP & Custom Providers
import { Injectable, Inject, Module, Logger } from '@nestjs/common';

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
export const NOTIFICATION_CONFIG = Symbol('NOTIFICATION_CONFIG');
export const PRIMARY_SENDER_ALIAS = Symbol('PRIMARY_SENDER_ALIAS');

export interface NotificationConfig {
  readonly defaultSender: string;
  readonly maxRetryAttempts: number;
  readonly timeoutMs: number;
}

export interface NotificationEnvelope {
  readonly recipient: string;
  readonly subject: string;
  readonly content: string;
}

export interface NotificationReceipt {
  readonly delivered: boolean;
  readonly providerId: string;
  readonly attemptCount: number;
}

export interface INotificationPort {
  dispatch(envelope: NotificationEnvelope): Promise<NotificationReceipt>;
}

/**
 * ADR-0041: Tuân thủ Nguyên lý Đảo ngược Phụ thuộc (DIP) và Khởi tạo useFactory:
 * 1. Tầng nghiệp vụ (UserOnboardingService) chỉ giao tiếp với hợp đồng trừu tượng INotificationPort
 *    thông qua Symbol NOTIFICATION_PORT, hoàn toàn mù mờ về việc bên dưới dùng SendGrid hay AWS SES.
 * 2. Sử dụng useValue kết hợp Object.freeze() để cung cấp cấu hình bất biến an toàn.
 * 3. Sử dụng useExisting cho PRIMARY_SENDER_ALIAS để tạo bí danh mà không cấp phát thêm bản sao trên V8 Heap.
 */
@Injectable()
export class SesNotificationAdapter implements INotificationPort {
  private readonly logger = new Logger(SesNotificationAdapter.name);

  constructor(
    @Inject(NOTIFICATION_CONFIG)
    private readonly config: NotificationConfig,
  ) {}

  public async dispatch(envelope: NotificationEnvelope): Promise<NotificationReceipt> {
    if (!envelope.recipient || !envelope.recipient.includes('@')) {
      throw new Error('INVALID_RECIPIENT_EMAIL');
    }

    this.logger.log(
      \`[SES Adapter] Gửi từ \${this.config.defaultSender} tới \${envelope.recipient} (Timeout: \${this.config.timeoutMs}ms)\`,
    );

    return {
      delivered: true,
      providerId: \`SES_\${envelope.recipient.toLowerCase()}\`,
      attemptCount: 1,
    };
  }
}

@Injectable()
export class UserOnboardingService {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: INotificationPort,
  ) {}

  public async sendWelcomeEmail(email: string, fullName: string): Promise<NotificationReceipt> {
    return this.notificationPort.dispatch({
      recipient: email.trim(),
      subject: \`Chào mừng kỹ sư \${fullName} gia nhập hệ thống\`,
      content: 'Tài khoản của bạn đã được kích hoạt thành công trên hạ tầng Production.',
    });
  }
}

@Module({
  providers: [
    {
      provide: NOTIFICATION_CONFIG,
      useValue: Object.freeze<NotificationConfig>({
        defaultSender: 'noreply@arc-irobot.tech',
        maxRetryAttempts: 3,
        timeoutMs: 5000,
      }),
    },
    {
      provide: NOTIFICATION_PORT,
      useClass: SesNotificationAdapter,
    },
    {
      provide: PRIMARY_SENDER_ALIAS,
      useExisting: NOTIFICATION_PORT,
    },
    UserOnboardingService,
  ],
  exports: [NOTIFICATION_PORT, PRIMARY_SENDER_ALIAS, UserOnboardingService],
})
export class NotificationDipModule {}`,
  quiz: [
    {
      id: 'c4-l1-q1',
      question: 'Cơ chế kỹ thuật nào cho phép NestJS IoC Container tự động biết chính xác các Class phụ thuộc trong constructor của một Service tại thời điểm Runtime?',
      options: [
        'Sử dụng thư viện reflect-metadata kết hợp cờ emitDecoratorMetadata: true để trình biên dịch phát sinh mảng tham chiếu class vào khóa design:paramtypes.',
        'Sử dụng bộ phân tích cú pháp tĩnh của Webpack để đọc tên các biến trong hàm constructor rồi tự động tìm tệp tin tương ứng trong thư mục dist.',
        'Sử dụng cơ chế đồng bộ hóa lược đồ tự động qua kết nối mạng nội bộ tới dịch vụ TypeScript Runtime Schema Registry trong lúc khởi động máy chủ.',
        'Sử dụng biểu thức chính quy (Regular Expression) quét chuỗi văn bản của hàm constructor.toString() và ánh xạ theo quy ước đặt tên biến CamelCase.'
      ],
      correctIndex: 0,
      explanation: 'Khi bật cờ emitDecoratorMetadata: true trong tsconfig.json và gắn decorator như @Injectable() lên class, trình biên dịch TypeScript tự động sinh ra lệnh __metadata("design:paramtypes", [...]) lưu trực tiếp mảng tham chiếu Constructor Function của các tham số vào bảng WeakMap của reflect-metadata tại Runtime.'
    },
    {
      id: 'c4-l1-q2',
      question: 'Vì sao khi thực thi nguyên lý Dependency Inversion (DIP) với một TypeScript Interface trong constructor, kỹ sư bắt buộc phải dùng @Inject(CUSTOM_TOKEN)?',
      options: [
        'Vì NestJS IoC Container giới hạn bộ đệm chỉ cho phép tự động nạp các class cụ thể có dung lượng mã nguồn biên dịch nhỏ hơn ngưỡng 16 Kilobytes.',
        'Vì việc dùng trực tiếp Interface làm token mặc định sẽ gây xung đột khóa bộ nhớ trong bảng WeakMap của V8 Engine khi có nhiều luồng Worker chạy.',
        'Vì TypeScript thực hiện xóa kiểu (Type Erasure) khi biên dịch sang JavaScript khiến Interface biến mất hoàn toàn và chỉ còn lại hàm [Object] ở Runtime.',
        'Vì đặc tả ECMAScript thế hệ mới cấm các hàm khởi tạo trong chế độ Strict Mode truy cập vào nguyên mẫu (prototype) của một giao diện trừu tượng.'
      ],
      correctIndex: 2,
      explanation: 'Interface và Type Alias chỉ tồn tại ở giai đoạn kiểm tra kiểu lúc biên dịch (Compile-time). Khi chuyển sang mã JavaScript chạy trên V8, chúng bị xóa sạch hoàn toàn (Type Erasure), khiến design:paramtypes chỉ ghi nhận được hàm [Object] chung chung; do đó bắt buộc phải dùng @Inject(TOKEN) với Symbol hoặc String để ghi đè vào self:paramtypes.'
    },
    {
      id: 'c4-l1-q3',
      question: 'Sự khác biệt cốt lõi nhất giữa mẫu thiết kế Dependency Injection (DI) và nguyên lý kiến trúc Dependency Inversion Principle (DIP) trong SOLID là gì?',
      options: [
        'DI là một công cụ tiền xử lý mã nguồn ở tầng trình biên dịch TypeScript, còn DIP là một thư viện hỗ trợ tạo đối tượng giả lập trong kiểm thử tự động.',
        'DI là cơ chế kỹ thuật truyền phụ thuộc từ bên ngoài vào class, còn DIP yêu cầu module cấp cao và cấp thấp phải cùng phụ thuộc vào lớp trừu tượng.',
        'DI chỉ được phép áp dụng cho các dịch vụ kết nối cơ sở dữ liệu quan hệ SQL, trong khi DIP chỉ áp dụng cho các kết nối bất đồng bộ qua Message Queue.',
        'DI bắt buộc mọi đối tượng phải được khởi tạo lại mới hoàn toàn trên từng HTTP request, trong khi DIP bắt buộc mọi đối tượng phải là Singleton cố định.'
      ],
      correctIndex: 1,
      explanation: 'DI chỉ là kỹ thuật nối dây (wiring) đưa đối tượng phụ thuộc từ bên ngoài vào qua Constructor/Setter. Một hệ thống dùng DI vẫn vi phạm DIP nếu lớp nghiệp vụ cấp cao inject trực tiếp lớp hạ tầng cụ thể (ví dụ constructor(private stripe: StripeService)); để đạt DIP, cả hai phải phụ thuộc vào Abstraction (Interface/Abstract Class).'
    },
    {
      id: 'c4-l1-q4',
      question: 'Trong NestJS, chiến lược đăng ký Provider dạng useFactory giải quyết bài toán kiến trúc nào mà useClass và useValue không thể đáp ứng trực tiếp?',
      options: [
        'Khởi tạo một hằng số chuỗi văn bản tĩnh hoặc đối tượng cấu hình JSON đóng băng không bao giờ thay đổi trong suốt vòng đời của tiến trình máy chủ.',
        'Tự động nén dung lượng gói tin HTTP JSON trả về cho trình duyệt khách hàng thông qua thuật toán nén phần cứng trực tiếp trên card mạng máy chủ.',
        'Tạo ra một tên bí danh thứ hai trỏ trực tiếp vào cùng một vùng nhớ của một đối tượng Singleton đã tồn tại sẵn mà không tốn thêm bất kỳ byte RAM nào.',
        'Thực thi logic khởi tạo bất đồng bộ (async/await) hoặc tính toán cấu hình động dựa trên các Provider khác được truyền vào qua mảng inject: [...].'
      ],
      correctIndex: 3,
      explanation: 'Hàm constructor của một Class trong JavaScript không thể là hàm async. Khi cần chờ thiết lập kết nối bất đồng bộ (như tạo Database Pool, xác thực Vault) hoặc cần đọc thông số từ ConfigService trước khi quyết định cách khởi tạo đối tượng, useFactory kết hợp với mảng inject: [...] là giải pháp chuẩn mực duy nhất.'
    },
    {
      id: 'c4-l1-q5',
      question: 'Khi BillingModule muốn tiêm và sử dụng UsersService vốn được khai báo bên trong UsersModule, cấu hình nào sau đây tuân thủ đúng nguyên lý Module Encapsulation?',
      options: [
        'Khai báo trực tiếp class UsersService thêm một lần nữa vào bên trong mảng providers: [UsersService] của tệp tin cấu hình BillingModule hiện tại.',
        'UsersModule phải đưa UsersService vào mảng exports: [UsersService], đồng thời BillingModule phải khai báo UsersModule trong mảng imports: [UsersModule].',
        'Đặt cả hai tệp tin billing.module.ts và users.module.ts nằm trong cùng một thư mục con trên hệ thống tệp tin để trình biên dịch tự động chia sẻ quyền.',
        'Chuyển phạm vi hoạt động của UsersService từ chế độ mặc định Scope.DEFAULT sang chế độ Scope.TRANSIENT để vượt qua bức tường cô lập giữa các Module.'
      ],
      correctIndex: 1,
      explanation: 'NestJS áp dụng cơ chế cô lập Module nghiêm ngặt (Strict Module Encapsulation). Để chia sẻ cùng một bản thể Singleton của UsersService sang BillingModule, UsersModule phải chủ động xuất khẩu nó trong mảng exports và BillingModule phải nhập UsersModule trong mảng imports. Tuyệt đối không khai báo lại vào providers của BillingModule vì sẽ làm nhân bản thành 2 instance tách biệt.'
    },
    {
      id: 'c4-l1-q6',
      question: 'Quá trình quét siêu dữ liệu, xây dựng đồ thị phụ thuộc và khởi tạo toàn bộ các Singleton Providers trong NestJS diễn ra tại thời điểm nào?',
      options: [
        'Diễn ra một lần duy nhất tại giai đoạn Bootstrap ứng dụng (khi gọi NestFactory.create) trước khi máy chủ mở cổng TCP tiếp nhận kết nối mạng HTTP.',
        'Diễn ra theo cơ chế lười biếng (Lazy Initialization) ngay tại khoảnh khắc yêu cầu HTTP đầu tiên của người dùng chạm tới đường dẫn của Controller đó.',
        'Diễn ra hoàn toàn ở giai đoạn đóng gói mã nguồn tĩnh (Build-time) khi chạy lệnh npm run build để xuất các tệp tin sang thư mục đầu ra dist/.',
        'Diễn ra lặp đi lặp lại theo chu kỳ mỗi 30 giây một lần trên luồng phụ của Libuv để làm mới toàn bộ các đối tượng dịch vụ trong bộ nhớ V8 Heap.'
      ],
      correctIndex: 0,
      explanation: 'Toàn bộ quá trình quét Module, đọc Reflect Metadata, phân giải đồ thị phụ thuộc O(V + E) và gọi hàm khởi tạo của các Singleton Providers đều hoàn tất trong bước Bootstrap (NestFactory.create), trước cả khi các hook onModuleInit chạy và cổng mạng được mở. Nhờ đó, các yêu cầu HTTP thực tế chịu 0ms độ trễ cấp phát DI.'
    },
    {
      id: 'c4-l1-q7',
      question: 'Nếu một tham số trong constructor được gắn đồng thời @Optional() và @Inject(CACHE_TOKEN), hành vi của IoC Container sẽ là gì khi CACHE_TOKEN chưa được đăng ký?',
      options: [
        'IoC Container lập tức ném ra ngoại lệ UnknownDependenciesException và buộc tiến trình Node.js dừng khẩn cấp với mã lỗi khác không ngay lúc khởi động.',
        'IoC Container tự động sinh ra một đối tượng Proxy rỗng trả về giá trị true cho mọi lời gọi phương thức nhằm ngăn chặn lỗi con trỏ rỗng lúc thực thi.',
        'IoC Container bỏ qua việc báo lỗi thiếu phụ thuộc và truyền giá trị undefined vào vị trí tham số đó để lớp dịch vụ tự xử lý nhánh dự phòng an toàn.',
        'IoC Container tạm dừng quá trình khởi động và tự động tìm kiếm một Provider bất kỳ có cùng kiểu trả về trong các Module khác để điền thế chỗ vào.'
      ],
      correctIndex: 2,
      explanation: 'Mặc định NestContainer áp dụng nguyên tắc Fail-Fast: thiếu bất kỳ token nào cũng sẽ ném lỗi dừng ứng dụng. Khi kỹ sư chủ động gắn @Optional(), Injector hiểu rằng phụ thuộc này không bắt buộc; nếu tra cứu không thấy token trong Module Graph, nó sẽ truyền giá trị undefined vào constructor để code tự thực hiện fallback.'
    },
    {
      id: 'c4-l1-q8',
      question: 'Trong kiến trúc NestJS, việc đăng ký một Custom Provider bằng cú pháp { provide: READ_ONLY_REPO, useExisting: PrimaryUserRepository } mang lại lợi ích gì?',
      options: [
        'Tạo ra hai bản thể độc lập hoàn toàn trên hai phân vùng bộ nhớ khác nhau để tránh hiện tượng tranh chấp khóa đọc ghi khi xử lý các truy vấn song song.',
        'Tạo ra một Token bí danh (Alias) trỏ trực tiếp về cùng một bản thể Singleton đã được khởi tạo của PrimaryUserRepository với 0 byte cấp phát dư thừa.',
        'Tự động đóng băng toàn bộ các thuộc tính của đối tượng PrimaryUserRepository bằng hàm Object.freeze để ngăn chặn các câu lệnh ghi xuống cơ sở dữ liệu.',
        'Chuyển đổi các phương thức đồng bộ bên trong lớp PrimaryUserRepository thành các hàm bất đồng bộ chạy trên luồng Worker Threads hoàn toàn tự động.'
      ],
      correctIndex: 1,
      explanation: 'Khác với useClass (luôn gọi toán tử new để tạo ra một instance thứ hai riêng biệt), useExisting tạo ra một bí danh (Alias Token) trỏ thẳng vào đúng InstanceWrapper của PrimaryUserRepository. Cả hai token đều trả về chính xác cùng một địa chỉ vùng nhớ trên V8 Heap, giúp áp dụng Interface Segregation mà không làm nhân đôi kết nối hay bộ nhớ.'
    }
  ],
  codeChallenge: {
    id: 'c4-l1-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Hợp Nhất Siêu Dữ Liệu Constructor (design:paramtypes & @Inject Override)',
    description: 'Hiện thực hàm `mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps)` mô phỏng bước đầu tiên của `NestJS Injector`: kết hợp mảng kiểu tham số do TypeScript Compiler phát sinh (`compilerParamTypes`) với danh sách các vị trí gắn `@Inject(token)` (`selfDeclaredOverrides: Array<{ index: number; token: string }>`).\nQuy tắc:\n1. Tạo bản sao của mảng `compilerParamTypes` và ghi đè từng phần tử tại vị trí `item.index` bằng `item.token` (nếu `index >= 0` và `index < compilerParamTypes.length`).\n2. Sau khi ghi đè, kiểm tra xem trong mảng kết quả còn phần tử nào có giá trị là `"Object"` hoặc `"Interface"` (do bị xóa kiểu Type Erasure mà quên gắn `@Inject`) hay không. Đếm số lượng vị trí lỗi này vào `unresolvedCount`; nếu `unresolvedCount === 0` thì `isResolvable = true`, ngược lại `false`.\n3. Tính dung lượng bộ nhớ tiết kiệm được mỗi giây nhờ cơ chế Singleton (`savedMemoryKBPerSec`, làm tròn 2 chữ số thập phân): nếu không dùng Singleton mà gọi `new` trên mỗi request, hệ thống tốn `compilerParamTypes.length * SingletonMemoryKB * rps`. Trả về đối tượng `{ finalTokens, unresolvedCount, isResolvable, savedMemoryKBPerSec }`.',
    guidedSteps: [
      'Bước 1 (Sao chép và ghi đè Token từ self:paramtypes): Tạo mảng finalTokens = [...compilerParamTypes], sau đó duyệt qua selfDeclaredOverrides để gán finalTokens[item.index] = item.token.',
      'Bước 2 (Phát hiện lỗi Type Erasure chưa được bù đắp): Đếm số phần tử trong finalTokens có giá trị bằng "Object" hoặc "Interface" vào biến unresolvedCount.',
      'Bước 3 (Xác định khả năng phân giải): Đặt isResolvable = (unresolvedCount === 0).',
      'Bước 4 (Định lượng bộ nhớ tiết kiệm mỗi giây): Tính savedMemoryKBPerSec = Math.round((finalTokens.length * SingletonMemoryKB * rps) * 100) / 100 và trả về kết quả.'
    ],
    hints: [
      'Khi duyệt mảng selfDeclaredOverrides, nhớ kiểm tra điều kiện biên item.index >= 0 && item.index < finalTokens.length trước khi ghi đè.',
      'Sử dụng finalTokens.filter(t => t === "Object" || t === "Interface").length để đếm chính xác số tham số bị mất kiểu ở Runtime.'
    ],
    starterCode: `function mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps) {
  // Bước 1: Sao chép compilerParamTypes và ghi đè các vị trí có trong selfDeclaredOverrides
  
  // Bước 2: Đếm số lượng token vẫn còn là "Object" hoặc "Interface" (unresolvedCount)
  
  // Bước 3: Xác định isResolvable = (unresolvedCount === 0)
  
  // Bước 4: Tính savedMemoryKBPerSec và trả về { finalTokens, unresolvedCount, isResolvable, savedMemoryKBPerSec }
}`,
    solution: `function mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps) {
  const finalTokens = Array.isArray(compilerParamTypes) ? [...compilerParamTypes] : [];
  const overrides = Array.isArray(selfDeclaredOverrides) ? selfDeclaredOverrides : [];

  for (const item of overrides) {
    if (item && typeof item.index === 'number' && item.index >= 0 && item.index < finalTokens.length) {
      finalTokens[item.index] = item.token;
    }
  }

  const unresolvedCount = finalTokens.filter((t) => t === 'Object' || t === 'Interface').length;
  const isResolvable = unresolvedCount === 0;
  const savedMemoryKBPerSec =
    Math.round(finalTokens.length * SingletonMemoryKB * rps * 100) / 100;

  return {
    finalTokens,
    unresolvedCount,
    isResolvable,
    savedMemoryKBPerSec,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Ghi đè thành công vị trí Interface [Object] bằng Symbol Token PAYMENT_PORT',
        input: [['UsersService', 'Object', 'ConfigService'], [{ index: 1, token: 'Symbol(PAYMENT_PORT)' }], 4, 1000],
        expected: {
          finalTokens: ['UsersService', 'Symbol(PAYMENT_PORT)', 'ConfigService'],
          unresolvedCount: 0,
          isResolvable: true,
          savedMemoryKBPerSec: 12000
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Quên gắn @Inject cho tham số Interface tại index 0 -> Báo không thể phân giải',
        input: [['Object', 'LoggerService'], [], 2.5, 500],
        expected: {
          finalTokens: ['Object', 'LoggerService'],
          unresolvedCount: 1,
          isResolvable: false,
          savedMemoryKBPerSec: 2500
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Toàn bộ tham số đều là Class cụ thể, không cần @Inject override',
        input: [['AuthService', 'PrismaService'], [], 8, 250],
        expected: {
          finalTokens: ['AuthService', 'PrismaService'],
          unresolvedCount: 0,
          isResolvable: true,
          savedMemoryKBPerSec: 4000
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Ghi đè nhiều vị trí Interface và bỏ qua index nằm ngoài phạm vi mảng',
        input: [
          ['Interface', 'Object'],
          [
            { index: 0, token: 'CACHE_CLIENT' },
            { index: 1, token: 'QUEUE_CLIENT' },
            { index: 5, token: 'IGNORED_TOKEN' }
          ],
          1.25,
          300
        ],
        expected: {
          finalTokens: ['CACHE_CLIENT', 'QUEUE_CLIENT'],
          unresolvedCount: 0,
          isResolvable: true,
          savedMemoryKBPerSec: 750
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Constructor không có tham số phụ thuộc (Leaf Service)',
        input: [[], [], 4, 1000],
        expected: {
          finalTokens: [],
          unresolvedCount: 0,
          isResolvable: true,
          savedMemoryKBPerSec: 0
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      id: 'c4-l1-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Hợp Nhất Siêu Dữ Liệu Constructor (design:paramtypes & @Inject Override)',
      description: 'Hiện thực hàm `mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps)` mô phỏng bước đầu tiên của `NestJS Injector`: kết hợp mảng kiểu tham số do TypeScript Compiler phát sinh (`compilerParamTypes`) với danh sách các vị trí gắn `@Inject(token)` (`selfDeclaredOverrides: Array<{ index: number; token: string }>`).\nQuy tắc:\n1. Tạo bản sao của mảng `compilerParamTypes` và ghi đè từng phần tử tại vị trí `item.index` bằng `item.token` (nếu `index >= 0` && `index < compilerParamTypes.length`).\n2. Sau khi ghi đè, kiểm tra xem trong mảng kết quả còn phần tử nào có giá trị là `"Object"` hoặc `"Interface"` (do bị xóa kiểu Type Erasure mà quên gắn `@Inject`) hay không. Đếm số lượng vị trí lỗi này vào `unresolvedCount`; nếu `unresolvedCount === 0` thì `isResolvable = true`, ngược lại `false`.\n3. Tính dung lượng bộ nhớ tiết kiệm được mỗi giây nhờ cơ chế Singleton (`savedMemoryKBPerSec`, làm tròn 2 chữ số thập phân): nếu không dùng Singleton mà gọi `new` trên mỗi request, hệ thống tốn `compilerParamTypes.length * SingletonMemoryKB * rps`. Trả về đối tượng `{ finalTokens, unresolvedCount, isResolvable, savedMemoryKBPerSec }`.',
      guidedSteps: [
        'Bước 1 (Sao chép và ghi đè Token từ self:paramtypes): Tạo mảng finalTokens = [...compilerParamTypes], sau đó duyệt qua selfDeclaredOverrides để gán finalTokens[item.index] = item.token.',
        'Bước 2 (Phát hiện lỗi Type Erasure chưa được bù đắp): Đếm số phần tử trong finalTokens có giá trị bằng "Object" hoặc "Interface" vào biến unresolvedCount.',
        'Bước 3 (Xác định khả năng phân giải): Đặt isResolvable = (unresolvedCount === 0).',
        'Bước 4 (Định lượng bộ nhớ tiết kiệm mỗi giây): Tính savedMemoryKBPerSec = Math.round((finalTokens.length * SingletonMemoryKB * rps) * 100) / 100 và trả về kết quả.'
      ],
      hints: [
        'Khi duyệt mảng selfDeclaredOverrides, nhớ kiểm tra điều kiện biên item.index >= 0 && item.index < finalTokens.length trước khi ghi đè.',
        'Sử dụng finalTokens.filter(t => t === "Object" || t === "Interface").length để đếm chính xác số tham số bị mất kiểu ở Runtime.'
      ],
      starterCode: `function mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps) {
  // Bước 1: Sao chép compilerParamTypes và ghi đè các vị trí có trong selfDeclaredOverrides
  
  // Bước 2: Đếm số lượng token vẫn còn là "Object" hoặc "Interface" (unresolvedCount)
  
  // Bước 3: Xác định isResolvable = (unresolvedCount === 0)
  
  // Bước 4: Tính savedMemoryKBPerSec và trả về { finalTokens, unresolvedCount, isResolvable, savedMemoryKBPerSec }
}`,
      solution: `function mergeConstructorMetadata(compilerParamTypes, selfDeclaredOverrides, SingletonMemoryKB, rps) {
  const finalTokens = Array.isArray(compilerParamTypes) ? [...compilerParamTypes] : [];
  const overrides = Array.isArray(selfDeclaredOverrides) ? selfDeclaredOverrides : [];

  for (const item of overrides) {
    if (item && typeof item.index === 'number' && item.index >= 0 && item.index < finalTokens.length) {
      finalTokens[item.index] = item.token;
    }
  }

  const unresolvedCount = finalTokens.filter((t) => t === 'Object' || t === 'Interface').length;
  const isResolvable = unresolvedCount === 0;
  const savedMemoryKBPerSec =
    Math.round(finalTokens.length * SingletonMemoryKB * rps * 100) / 100;

  return {
    finalTokens,
    unresolvedCount,
    isResolvable,
    savedMemoryKBPerSec,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Ghi đè thành công vị trí Interface [Object] bằng Symbol Token PAYMENT_PORT',
          input: [['UsersService', 'Object', 'ConfigService'], [{ index: 1, token: 'Symbol(PAYMENT_PORT)' }], 4, 1000],
          expected: {
            finalTokens: ['UsersService', 'Symbol(PAYMENT_PORT)', 'ConfigService'],
            unresolvedCount: 0,
            isResolvable: true,
            savedMemoryKBPerSec: 12000
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Quên gắn @Inject cho tham số Interface tại index 0 -> Báo không thể phân giải',
          input: [['Object', 'LoggerService'], [], 2.5, 500],
          expected: {
            finalTokens: ['Object', 'LoggerService'],
            unresolvedCount: 1,
            isResolvable: false,
            savedMemoryKBPerSec: 2500
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Toàn bộ tham số đều là Class cụ thể, không cần @Inject override',
          input: [['AuthService', 'PrismaService'], [], 8, 250],
          expected: {
            finalTokens: ['AuthService', 'PrismaService'],
            unresolvedCount: 0,
            isResolvable: true,
            savedMemoryKBPerSec: 4000
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ghi đè nhiều vị trí Interface và bỏ qua index nằm ngoài phạm vi mảng',
          input: [
            ['Interface', 'Object'],
            [
              { index: 0, token: 'CACHE_CLIENT' },
              { index: 1, token: 'QUEUE_CLIENT' },
              { index: 5, token: 'IGNORED_TOKEN' }
            ],
            1.25,
            300
          ],
          expected: {
            finalTokens: ['CACHE_CLIENT', 'QUEUE_CLIENT'],
            unresolvedCount: 0,
            isResolvable: true,
            savedMemoryKBPerSec: 750
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Constructor không có tham số phụ thuộc (Leaf Service)',
          input: [[], [], 4, 1000],
          expected: {
            finalTokens: [],
            unresolvedCount: 0,
            isResolvable: true,
            savedMemoryKBPerSec: 0
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l1-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Kiểm Toán Ranh Giới Đóng Gói Module (Strict Module Encapsulation Verifier)',
      description: 'Hiện thực hàm `verifyModuleEncapsulation(consumerModule, allModules)` để mô phỏng thuật toán `lookupComponentInParentModules` của NestJS IoC Container.\nTham số:\n- `consumerModule`: `{ name: string; localProviders: string[]; imports: string[]; requiredTokens: string[] }`.\n- `allModules`: Mảng các module khác trong hệ thống `Array<{ name: string; providers: string[]; exports: string[]; isGlobal?: boolean }>`.\nQuy tắc phân giải cho từng `token` trong `consumerModule.requiredTokens`:\n1. Nếu `token` có trong `consumerModule.localProviders` -> Nguồn là `"LOCAL"`.\n2. Nếu không, tìm trong các module thuộc `allModules` mà có tên nằm trong `consumerModule.imports` VÀ module đó có chứa `token` trong cả `providers` lẫn `exports` -> Nguồn là `"IMPORTED:" + mod.name`.\n3. Nếu không, tìm trong các module thuộc `allModules` có cờ `isGlobal === true` VÀ có chứa `token` trong cả `providers` lẫn `exports` -> Nguồn là `"GLOBAL:" + mod.name`.\n4. Nếu vẫn không tìm thấy -> Đưa `token` vào mảng `missingTokens`.\nTrả về `{ resolvedMap, missingTokens, isBootstrappable: missingTokens.length === 0 }`, trong đó `resolvedMap` là object ánh xạ `token -> nguồn phân giải`.',
      guidedSteps: [
        'Bước 1 (Khởi tạo cấu trúc lưu trữ): Tạo đối tượng resolvedMap = {} và mảng missingTokens = [] để ghi nhận kết quả tra cứu từng token.',
        'Bước 2 (Kiểm tra Local Providers): Với mỗi token trong consumerModule.requiredTokens, nếu consumerModule.localProviders.includes(token) thì gán resolvedMap[token] = "LOCAL".',
        'Bước 3 (Kiểm tra Imported Modules và Global Modules): Nếu chưa thấy ở Local, tìm module đầu tiên trong allModules nằm trong consumerModule.imports có cả providers và exports chứa token ("IMPORTED:<name>"); nếu chưa thấy nữa thì tìm module có isGlobal === true thỏa điều kiện ("GLOBAL:<name>").',
        'Bước 4 (Tổng hợp kết quả): Nếu không nguồn nào thỏa mãn, đẩy token vào missingTokens. Cuối cùng trả về { resolvedMap, missingTokens, isBootstrappable: missingTokens.length === 0 }.'
      ],
      hints: [
        'Một Module được import nhưng chỉ khai báo token trong providers mà quên đưa vào exports thì vẫn KHÔNG hợp lệ! Hãy kiểm tra cả mod.providers.includes(token) && mod.exports.includes(token).',
        'Thứ tự ưu tiên chuẩn của NestJS là: LOCAL -> IMPORTED -> GLOBAL.'
      ],
      starterCode: `function verifyModuleEncapsulation(consumerModule, allModules) {
  // Bước 1: Khởi tạo resolvedMap = {} và missingTokens = []
  
  // Bước 2: Duyệt từng token trong consumerModule.requiredTokens và kiểm tra LOCAL trước
  
  // Bước 3: Kiểm tra các module nằm trong consumerModule.imports (phải có trong cả providers và exports), sau đó kiểm tra Global Modules
  
  // Bước 4: Trả về { resolvedMap, missingTokens, isBootstrappable }
}`,
      solution: `function verifyModuleEncapsulation(consumerModule, allModules) {
  const resolvedMap = {};
  const missingTokens = [];
  const modulesList = Array.isArray(allModules) ? allModules : [];
  const localSet = new Set(consumerModule.localProviders || []);
  const importedNames = new Set(consumerModule.imports || []);

  for (const token of consumerModule.requiredTokens || []) {
    if (localSet.has(token)) {
      resolvedMap[token] = 'LOCAL';
      continue;
    }

    const importedMatch = modulesList.find(
      (m) =>
        importedNames.has(m.name) &&
        Array.isArray(m.providers) &&
        m.providers.includes(token) &&
        Array.isArray(m.exports) &&
        m.exports.includes(token)
    );

    if (importedMatch) {
      resolvedMap[token] = \`IMPORTED:\${importedMatch.name}\`;
      continue;
    }

    const globalMatch = modulesList.find(
      (m) =>
        m.isGlobal === true &&
        Array.isArray(m.providers) &&
        m.providers.includes(token) &&
        Array.isArray(m.exports) &&
        m.exports.includes(token)
    );

    if (globalMatch) {
      resolvedMap[token] = \`GLOBAL:\${globalMatch.name}\`;
      continue;
    }

    missingTokens.push(token);
  }

  return {
    resolvedMap,
    missingTokens,
    isBootstrappable: missingTokens.length === 0,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Phân giải thành công kết hợp cả LOCAL, IMPORTED và GLOBAL',
          input: [
            {
              name: 'OrdersModule',
              localProviders: ['OrdersService'],
              imports: ['UsersModule'],
              requiredTokens: ['OrdersService', 'UsersService', 'ConfigService']
            },
            [
              { name: 'UsersModule', providers: ['UsersService', 'UserSecretHelper'], exports: ['UsersService'], isGlobal: false },
              { name: 'ConfigModule', providers: ['ConfigService'], exports: ['ConfigService'], isGlobal: true }
            ]
          ],
          expected: {
            resolvedMap: {
              OrdersService: 'LOCAL',
              UsersService: 'IMPORTED:UsersModule',
              ConfigService: 'GLOBAL:ConfigModule'
            },
            missingTokens: [],
            isBootstrappable: true
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Lỗi đóng gói khi UsersModule có Provider nhưng quên đưa vào mảng exports',
          input: [
            {
              name: 'OrdersModule',
              localProviders: [],
              imports: ['UsersModule'],
              requiredTokens: ['UserSecretHelper']
            },
            [
              { name: 'UsersModule', providers: ['UsersService', 'UserSecretHelper'], exports: ['UsersService'], isGlobal: false }
            ]
          ],
          expected: {
            resolvedMap: {},
            missingTokens: ['UserSecretHelper'],
            isBootstrappable: false
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Lỗi khi Provider đã được export nhưng Consumer quên khai báo Module đó trong mảng imports',
          input: [
            {
              name: 'BillingModule',
              localProviders: ['BillingService'],
              imports: [],
              requiredTokens: ['BillingService', 'PaymentGateway']
            },
            [
              { name: 'PaymentModule', providers: ['PaymentGateway'], exports: ['PaymentGateway'], isGlobal: false }
            ]
          ],
          expected: {
            resolvedMap: { BillingService: 'LOCAL' },
            missingTokens: ['PaymentGateway'],
            isBootstrappable: false
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ưu tiên LOCAL hơn IMPORTED và GLOBAL nếu cùng tên Token',
          input: [
            {
              name: 'CustomModule',
              localProviders: ['LoggerService'],
              imports: ['SharedModule'],
              requiredTokens: ['LoggerService']
            },
            [
              { name: 'SharedModule', providers: ['LoggerService'], exports: ['LoggerService'], isGlobal: true }
            ]
          ],
          expected: {
            resolvedMap: { LoggerService: 'LOCAL' },
            missingTokens: [],
            isBootstrappable: true
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Global Module nhưng quên export Token thì vẫn bị chặn bởi Encapsulation',
          input: [
            {
              name: 'AppModule',
              localProviders: [],
              imports: [],
              requiredTokens: ['InternalVaultKey']
            },
            [
              { name: 'SecurityModule', providers: ['InternalVaultKey'], exports: [], isGlobal: true }
            ]
          ],
          expected: {
            resolvedMap: {},
            missingTokens: ['InternalVaultKey'],
            isBootstrappable: false
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l1-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Bộ Máy Phân Giải Custom Providers (useValue, useClass, useFactory, useExisting)',
      description: 'Hiện thực hàm `resolveContainerTokens(definitions, targetTokens)` mô phỏng bộ máy `NestContainer` hỗ trợ cả 4 chiến lược Custom Providers cùng bộ nhớ đệm Singleton.\nTham số `definitions` là mảng các cấu hình Provider:\n- `{ provide: string; useValue: unknown }` -> Giá trị là `useValue` (không tăng bộ đếm cấp phát `instantiationCount`).\n- `{ provide: string; useClass: string; deps?: string[] }` -> Khởi tạo một lần duy nhất chuỗi `"Instance(" + useClass + ":" + resolvedDeps.join(",") + ")"` và tăng `instantiationCount` thêm 1.\n- `{ provide: string; useFactory: string; inject?: string[] }` -> Khởi tạo một lần duy nhất chuỗi `"Factory(" + useFactory + ":" + resolvedInject.join(",") + ")"` và tăng `instantiationCount` thêm 1.\n- `{ provide: string; useExisting: string }` -> Bí danh (Alias): trả về chính xác giá trị đã phân giải của token `useExisting` mà KHÔNG tăng `instantiationCount`.\nRàng buộc Phòng thủ (Defensive Guards):\n1. Nếu `definitions` không phải mảng hoặc rỗng, hoặc `targetTokens` không phải mảng, chủ động `throw new Error("INVALID_CONTAINER_DEFINITIONS")`.\n2. Khi phân giải bất kỳ token nào (hoặc dependency của nó) mà không tồn tại trong `definitions`, chủ động `throw new Error("UNKNOWN_DEPENDENCY_TOKEN")`.\n3. Nếu phát hiện vòng lặp phụ thuộc (ví dụ A cần B và B cần A), chủ động `throw new Error("CIRCULAR_DEPENDENCY_DETECTED")`.\nTrả về `{ resolvedValues, instantiationCount }`, trong đó `resolvedValues` là mảng kết quả tương ứng với `targetTokens`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra đầu vào và lập bảng băm): Nếu !Array.isArray(definitions) || definitions.length === 0 || !Array.isArray(targetTokens), throw new Error("INVALID_CONTAINER_DEFINITIONS"). Đưa các definition vào Map theo khóa provide.',
        'Bước 2 (Thiết lập Singleton Cache & Tập phát hiện chu trình): Khởi tạo singletonCache = new Map(), visiting = new Set() và biến đếm instantiationCount = 0.',
        'Bước 3 (Hiện thực hàm đệ quy resolve(token)): Nếu singletonCache.has(token) thì trả về ngay. Nếu visiting.has(token) thì throw new Error("CIRCULAR_DEPENDENCY_DETECTED"). Nếu không có trong definitionMap thì throw new Error("UNKNOWN_DEPENDENCY_TOKEN").',
        'Bước 4 (Xử lý 4 nhánh Provider và lưu Cache): Xử lý useValue, useExisting (gọi đệ quy resolve(def.useExisting)), useClass (tăng instantiationCount++) và useFactory (tăng instantiationCount++), lưu vào singletonCache rồi trả về { resolvedValues, instantiationCount }.'
      ],
      hints: [
        'Hãy đặt lệnh visiting.add(token) trước khi phân giải các dependencies con, và gọi visiting.delete(token) ngay sau khi đã lưu kết quả vào singletonCache.',
        'Lưu ý với useValue: dùng ("useValue" in def) để kiểm tra vì giá trị useValue có thể là số 0, chuỗi rỗng hoặc boolean false.'
      ],
      starterCode: `function resolveContainerTokens(definitions, targetTokens) {
  // Bước 1: Kiểm tra tính hợp lệ của definitions và targetTokens ("INVALID_CONTAINER_DEFINITIONS")
  
  // Bước 2: Khởi tạo Map định nghĩa, singletonCache, visiting Set và instantiationCount = 0
  
  // Bước 3: Viết hàm đệ quy resolveToken(token) kiểm tra Cache, Circular Dependency và Unknown Token
  
  // Bước 4: Phân giải toàn bộ targetTokens và trả về { resolvedValues, instantiationCount }
}`,
      solution: `function resolveContainerTokens(definitions, targetTokens) {
  if (
    !Array.isArray(definitions) ||
    definitions.length === 0 ||
    !Array.isArray(targetTokens)
  ) {
    throw new Error('INVALID_CONTAINER_DEFINITIONS');
  }

  const defMap = new Map();
  for (const def of definitions) {
    if (def && typeof def.provide === 'string') {
      defMap.set(def.provide, def);
    }
  }

  const singletonCache = new Map();
  const visiting = new Set();
  let instantiationCount = 0;

  function resolve(token) {
    if (singletonCache.has(token)) {
      return singletonCache.get(token);
    }
    if (visiting.has(token)) {
      throw new Error('CIRCULAR_DEPENDENCY_DETECTED');
    }
    const def = defMap.get(token);
    if (!def) {
      throw new Error('UNKNOWN_DEPENDENCY_TOKEN');
    }

    visiting.add(token);
    let instance;

    if ('useValue' in def) {
      instance = def.useValue;
    } else if (typeof def.useExisting === 'string') {
      instance = resolve(def.useExisting);
    } else if (typeof def.useClass === 'string') {
      const deps = Array.isArray(def.deps) ? def.deps.map((d) => resolve(d)) : [];
      instantiationCount += 1;
      instance = \`Instance(\${def.useClass}:\${deps.join(',')})\`;
    } else if (typeof def.useFactory === 'string') {
      const injected = Array.isArray(def.inject) ? def.inject.map((d) => resolve(d)) : [];
      instantiationCount += 1;
      instance = \`Factory(\${def.useFactory}:\${injected.join(',')})\`;
    } else {
      throw new Error('INVALID_CONTAINER_DEFINITIONS');
    }

    visiting.delete(token);
    singletonCache.set(token, instance);
    return instance;
  }

  const resolvedValues = targetTokens.map((t) => resolve(t));
  return {
    resolvedValues,
    instantiationCount,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Phân giải chuẩn xác kết hợp useValue, useFactory, useClass và useExisting (Singleton)',
          input: [
            [
              { provide: 'DB_HOST', useValue: 'pg.internal' },
              { provide: 'DB_POOL', useFactory: 'createPool', inject: ['DB_HOST'] },
              { provide: 'READ_POOL', useExisting: 'DB_POOL' },
              { provide: 'USER_REPO', useClass: 'UserRepository', deps: ['READ_POOL'] }
            ],
            ['USER_REPO', 'DB_POOL', 'READ_POOL']
          ],
          expected: {
            resolvedValues: [
              'Instance(UserRepository:Factory(createPool:pg.internal))',
              'Factory(createPool:pg.internal)',
              'Factory(createPool:pg.internal)'
            ],
            instantiationCount: 2
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Tái sử dụng Singleton khi nhiều Service cùng phụ thuộc vào một Provider chung',
          input: [
            [
              { provide: 'LOGGER', useClass: 'PinoLogger', deps: [] },
              { provide: 'AUTH_SVC', useClass: 'AuthService', deps: ['LOGGER'] },
              { provide: 'ORDER_SVC', useClass: 'OrderService', deps: ['LOGGER'] }
            ],
            ['AUTH_SVC', 'ORDER_SVC']
          ],
          expected: {
            resolvedValues: [
              'Instance(AuthService:Instance(PinoLogger:))',
              'Instance(OrderService:Instance(PinoLogger:))'
            ],
            instantiationCount: 3
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Ném lỗi UNKNOWN_DEPENDENCY_TOKEN khi thiếu Provider trong đồ thị',
          input: [
            [{ provide: 'ORDER_SVC', useClass: 'OrderService', deps: ['MISSING_GATEWAY'] }],
            ['ORDER_SVC']
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ném lỗi CIRCULAR_DEPENDENCY_DETECTED khi hai Provider phụ thuộc vòng quanh',
          input: [
            [
              { provide: 'SVC_A', useClass: 'ServiceA', deps: ['SVC_B'] },
              { provide: 'SVC_B', useClass: 'ServiceB', deps: ['SVC_A'] }
            ],
            ['SVC_A']
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Ném lỗi INVALID_CONTAINER_DEFINITIONS khi mảng definitions rỗng',
          input: [[], ['ANY_TOKEN']],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
