import type { Lesson } from '../types.ts';

export const c4_l3: Lesson = {
  id: 'c4-l3',
  title: 'Bài 04: Đồ Thị DAG, Circular Dependency (forwardRef) & Hiểm Họa Hiệu Năng Scope.REQUEST',
  duration: '60 phút',
  tag: 'DAG Graph & Scopes Danger',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Lý thuyết Đồ thị Phụ thuộc (Dependency Graph Theory), Quản trị Vòng đời Phạm vi (Injection Scopes) và Kỹ thuật Truyền Ngữ cảnh Không Cấp phát (Zero-Allocation Context Propagation) trong NestJS thông qua 3 trục kiến thức cốt lõi:
> 1. **Đồ thị Có hướng Không chu trình (\`DAG\`), Thuật toán Sắp xếp Tô-pô (\`Topological Sort\`) và Cơ chế Phá vỡ Chu trình (\`Circular Dependency\`)**: Hiểu rõ thuật toán \`Kahn's Algorithm (In-degree = 0)\` và \`DFS 3-Color Cycle Detection\`; giải thích tại sao hệ thống nạp module của JavaScript trả về \`undefined\` khi có vòng lặp và cách tái cấu trúc triệt tiêu \`forwardRef()\`.
> 2. **Giải phẫu Ba Phạm vi Vòng đời (\`Scope.DEFAULT\`, \`Scope.TRANSIENT\`, \`Scope.REQUEST\`) và Thảm họa Hiệu ứng Lan truyền Ngược (\`Scope Bubbling\`)**: Chứng minh định lượng cách một \`Provider\` ở tầng thấp gắn \`Scope.REQUEST\` lây nhiễm ngược lên toàn bộ cây \`Service\` và \`Controller\`, gây bão thu gom rác **\`V8 GC Thrashing\`** ở tải cao.
> 3. **Kiến trúc Truyền Ngữ cảnh Không Cấp phát với \`Node.js AsyncLocalStorage\` (\`async_hooks\`) và Chẩn đoán Sự cố Production**: Nắm vững cách giữ 100% \`Service\` ở chế độ \`Singleton (Scope.DEFAULT)\` trên \`Old Generation Heap\` mà vẫn truy xuất cô lập \`traceId\`, \`tenantId\`, \`userId\` của từng yêu cầu HTTP với độ phức tạp $O(1)$.

---

# 1. ĐỒ THỊ PHỤ THUỘC CÓ HƯỚNG KHÔNG CHU TRÌNH (DAG), THUẬT TOÁN TOPOLOGICAL SORT VÀ BẾ TẮC CIRCULAR DEPENDENCY

### 1.1 Khái niệm nền tảng: Đồ thị DAG (Directed Acyclic Graph), Thuật toán Sắp xếp Tô-pô (Kahn's Topological Sort) và Bậc vào (In-Degree)

Khi khởi động ứng dụng (\`NestFactory.create(AppModule)\`), bộ máy \`NestContainer\` mô hình hóa toàn bộ các \`Modules\` và \`Providers\` thành một **Đồ thị Có hướng Không chu trình (\`DAG — Directed Acyclic Graph\`)** $G = (V, E)$, trong đó:
- Tập đỉnh $V$ (\`Vertices\`) biểu diễn các \`Providers / Modules\` cần khởi tạo.
- Tập cạnh có hướng $E$ (\`Directed Edges\`) biểu diễn quan hệ phụ thuộc: nếu \`OrderService\` cần tiêm \`UserService\` trong hàm khởi tạo, ta có cạnh có hướng đi từ \`UserService\` $\rightarrow$ \`OrderService\` (nghĩa là \`UserService\` bắt buộc phải được khởi tạo hoàn tất trước \`OrderService\`).

Để xác định thứ tự khởi tạo tuần tự hợp lệ sao cho mọi phụ thuộc đều có sẵn trước khi lớp tiêu thụ gọi hàm \`constructor\`, \`IoC Container\` thực thi **Thuật toán Sắp xếp Tô-pô (\`Topological Sort — Kahn's Algorithm\`)** dựa trên khái niệm **Bậc phụ thuộc (\`Dependency Out-Degree / In-Degree\`)**:
1. **Xác định các Đỉnh Lá Độc lập (\`Zero-Dependency Leaf Nodes\`):**
   Các lớp không phụ thuộc vào bất kỳ lớp nào khác (ví dụ \`ConfigService\`, \`LoggerService\` có \`constructor()\`) có số lượng phụ thuộc chưa giải quyết bằng \`0\`. Chúng được đẩy vào hàng đợi khởi tạo đầu tiên (\`Ready Queue\`).
2. **Lan truyền Khởi tạo và Giảm Bậc Phụ thuộc:**
   Khi một đỉnh lá $U$ đã được khởi tạo thành bản thể trong RAM, \`Injector\` duyệt qua tất cả các đỉnh $W$ phụ thuộc vào $U$ và giảm số lượng phụ thuộc đang chờ của $W$ đi \`1\`. Ngay khi số phụ thuộc đang chờ của $W$ chạm mốc \`0\`, $W$ lập tức được đẩy vào \`Ready Queue\` để gọi \`new W(...resolvedDeps)\`.
3. **Điểm Bế tắc Vô hạn khi Xuất hiện Chu trình (\`Cyclic Deadlock — Circular Dependency\`):**
   Giả sử \`UserService\` yêu cầu \`OrderService\`, đồng thời \`OrderService\` lại yêu cầu ngược lại \`UserService\` ($A \\leftrightarrow B$), hoặc xảy ra vòng lặp tam giác ($A \\rightarrow B \\rightarrow C \\rightarrow A$). Khi đó, mọi đỉnh nằm trong chu trình đều có số phụ thuộc đang chờ $\\ge 1$ và chờ đợi lẫn nhau! Hàng đợi \`Ready Queue\` trở nên rỗng trong khi các đỉnh trong chu trình vẫn chưa được khởi tạo $\rightarrow$ Đồ thị vi phạm tính chất **Không chu trình (\`Acyclic\`)**, buộc \`NestContainer\` ném ra ngoại lệ \`Nest can't resolve dependencies\` hoặc \`Circular dependency detected\`.

### 1.2 Đối chiếu kiến trúc: Cơ chế Nạp Module của CommonJS/ESM, Lỗi Tham chiếu \`undefined\` và Các Chiến lược Phá vỡ Chu trình

Tại sao khi hai tệp \`user.service.ts\` và \`order.service.ts\` \`import\` lẫn nhau ở đầu tệp tin, hàm \`Reflect.getMetadata('design:paramtypes', UserService)\` lại trả về mảng **\`[undefined]\`** thay vì \`[OrderService]\`?
- Trong hệ thống nạp tệp của Node.js (\`CommonJS require\` hoặc \`ES Modules\`), khi tệp \`user.service.ts\` đang chạy đến dòng \`import { OrderService } from './order.service'\`, Node.js tạm dừng tệp \`user.service.ts\` (khi \`export class UserService\` **chưa kịp thực thi!**) để nhảy sang nạp tệp \`order.service.ts\`.
- Tại tệp \`order.service.ts\`, nó lại gọi ngược \`import { UserService } from './user.service'\`. Để chống đệ quy vô tận, Node.js trả về đối tượng \`exports\` đang làm dở của \`user.service.ts\` — lúc này \`exports.UserService\` vẫn đang là **\`undefined\`**!
- Ngay tại khoảnh khắc đó, trình biên dịch TypeScript thực thi \`__metadata("design:paramtypes", [user_service_1.UserService])\` trên đầu lớp \`OrderService\` và ghi chết giá trị **\`[undefined]\`** vào bảng siêu dữ liệu!

Bảng dưới đây đối chiếu 5 phương pháp xử lý \`Circular Dependency\` từ giải pháp tình thế đến tái cấu trúc kiến trúc chuẩn mực:

| Phương pháp Xử lý Chu trình | Cơ chế Kỹ thuật ở Tầng Runtime | Tác động Lên Cấu trúc Đồ thị \`DAG\` | Ưu điểm Vận hành | Nhược điểm & Rủi ro Kiến trúc |
| :--- | :--- | :--- | :--- | :--- |
| **1. Bao đóng \`forwardRef(() => Class)\`** | Bọc tham chiếu class trong hàm mũi tên \`() => Target\` để trì hoãn việc đọc biến cho tới khi cả 2 tệp đã nạp xong | **Không xóa được chu trình**: Đồ thị vẫn có vòng lặp hai chiều $A \\leftrightarrow B$ | Sửa nhanh mà không cần tách tệp hay thay đổi chữ ký hàm hiện có | Che giấu mùi hôi mã nguồn (**\`Code Smell\`** — vi phạm \`SRP\`), khó bảo trì và dễ lỗi thứ tự \`onModuleInit\` |
| **2. Tách Lớp Trung gian (\`Mediator / Facade Extraction\`)** | Rút phần logic dùng chung hoặc điều phối ra lớp thứ 3 (\`UserOrderCoordinator\`) hoặc \`SharedService\` | **Khôi phục 100% đồ thị \`DAG\` chuẩn**: $A \\rightarrow C$ và $B \\rightarrow C$ (hoặc $M \\rightarrow A, B$) | Thiết kế sạch tuyệt đối, dễ viết Unit Test cô lập từng lớp | Đòi hỏi phân tích lại ranh giới trách nhiệm nghiệp vụ giữa 2 miền |
| **3. Hướng Sự kiện Nội bộ (\`Domain Events / EventEmitter2\`)** | \`OrderService\` phát sự kiện \`order.created\`; \`UserService\` lắng nghe qua \`@OnEvent('order.created')\` | **Khôi phục 100% đồ thị \`DAG\`**: Hai lớp hoàn toàn không biết sự tồn tại của nhau | Liên kết cực lỏng (\`Decoupled\`), dễ dàng mở rộng thêm nhiều bên lắng nghe mới | Luồng thực thi trở thành gián tiếp, cần quản lý giao dịch (\`Transaction\`) cẩn thận |
| **4. Tra cứu Động qua \`ModuleRef.get()\`** | Không tiêm qua Constructor mà tiêm \`ModuleRef\`, sau đó gọi \`this.moduleRef.get(OrderService)\` khi chạy hàm | Cắt cạnh phụ thuộc ở thời điểm Bootstrap, chuyển sang tra cứu lúc Runtime | Tránh được vòng lặp Constructor lúc khởi động | Rơi vào phản mẫu **\`Service Locator\`**: che giấu phụ thuộc và mất an toàn kiểm tra lúc khởi động |
| **5. Phụ thuộc Giao diện Một chiều (\`DIP Port Inversion\`)** | \`Module A\` định nghĩa \`interface IOrderQueryPort\`; \`Module B\` hiện thực và tiêm ngược qua Token | Đảo chiều mũi tên phụ thuộc ở tầng biên dịch | Giữ cho miền nghiệp vụ cốt lõi (\`Core Domain\`) không phụ thuộc vào module phụ | Vẫn cần cấu hình \`imports / exports\` cẩn thận ở tầng \`Module\` để tránh chu trình Module |

### 1.3 Giải phẫu Cơ chế \`forwardRef(() => Target)\` và Kỹ thuật Tái cấu trúc Triệt tiêu Vòng lặp Phụ thuộc trong NestJS

Hãy đối chiếu đoạn mã sử dụng \`forwardRef()\` (giải pháp tình thế) với kiến trúc tái cấu trúc chuẩn mực dùng **Lớp Điều phối Trung gian (\`Coordinator / Mediator Service\`)** để đưa đồ thị trở lại trạng thái \`DAG\` thuần khiết:

\`\`\`typescript
// File: src/modules/commerce/circular-dependency-refactoring.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';

// ============================================================================
// 1. THIẾT KẾ TẠM THỜI (WORKAROUND VỚI FORWARDREF - ĐỒ THỊ VẪN BỊ CHU TRÌNH):
// ============================================================================
@Injectable()
export class CyclicUserService {
  constructor(
    // Phải bọc trong hàm closure () => CyclicOrderService để tránh lỗi [undefined] khi nạp file
    @Inject(forwardRef(() => CyclicOrderService))
    private readonly orderService: CyclicOrderService,
  ) {}

  getUserTier(userId: string): string {
    const totalSpent = this.orderService.getTotalSpentByUser(userId);
    return totalSpent >= 10000 ? 'VIP' : 'STANDARD';
  }
}

@Injectable()
export class CyclicOrderService {
  constructor(
    @Inject(forwardRef(() => CyclicUserService))
    private readonly userService: CyclicUserService,
  ) {}

  getTotalSpentByUser(_userId: string): number {
    return 12500;
  }
}

// ============================================================================
// 2. THIẾT KẾ CHUẨN KIẾN TRÚC (DAG REFACTORING - TRIỆT TIÊU HOÀN TOÀN CHU TRÌNH):
// Tách biệt rõ các Leaf Services (chỉ quản lý dữ liệu miền của mình) và lớp Coordinator bậc cao!
// ============================================================================
@Injectable()
export class DagUserService {
  // Bậc phụ thuộc = 0 (Leaf Node trong đồ thị DAG)
  calculateTierFromAmount(totalSpent: number): 'VIP' | 'STANDARD' {
    return totalSpent >= 10000 ? 'VIP' : 'STANDARD';
  }
}

@Injectable()
export class DagOrderService {
  // Bậc phụ thuộc = 0 (Leaf Node trong đồ thị DAG)
  getTotalSpentByUser(_userId: string): number {
    return 12500;
  }
}

@Injectable()
export class CustomerLoyaltyCoordinatorService {
  // Đồ thị DAG 1 chiều hoàn hảo: Coordinator -> DagUserService & DagOrderService
  constructor(
    private readonly userService: DagUserService,
    private readonly orderService: DagOrderService,
  ) {}

  evaluateCustomerLoyalty(userId: string): { userId: string; totalSpent: number; tier: string } {
    const totalSpent = this.orderService.getTotalSpentByUser(userId);
    const tier = this.userService.calculateTierFromAmount(totalSpent);
    return { userId, totalSpent, tier };
  }
}
\`\`\`

Bảng truy vết thực thi dưới đây đối chiếu những gì diễn ra bên trong bộ nạp JavaScript và \`NestContainer\` khi gặp chu trình không có \`forwardRef\`, khi dùng \`forwardRef\`, và khi đã tái cấu trúc về chuẩn \`DAG\`:

| Mốc thời gian | Kịch bản Đồ thị Phụ thuộc | Giá trị Trong \`design:paramtypes\` | Hành động của Thuật toán Tô-pô trong \`Injector\` | Kết quả Khởi tạo & Trạng thái Hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **Kịch bản 1: Chu trình Trực tiếp ($A \\leftrightarrow B$) quên \`forwardRef\`** | Tệp B nạp khi A chưa định nghĩa xong $\rightarrow$ \`[undefined]\` | \`Injector\` đọc thấy tham số thứ 0 của B là \`undefined\` | **Sập ngay lập tức (\`Crash\`)**: \`Nest can't resolve dependencies of B (?)\` |
| **\`t = 1 ms\`** | **Kịch bản 2: Chu trình có gắn \`forwardRef(() => B)\`** | Lưu đối tượng \`{ forwardRef: () => B }\` vào \`self:paramtypes\` | Sau khi cả 2 tệp nạp xong, \`Injector\` gọi hàm \`forwardRef()\` lấy ra \`Class B\` thật | Vẫn khởi tạo được, nhưng một trong hai bên có nguy cơ nhận con trỏ chưa chạy xong \`onModuleInit\` |
| **\`t = 2 ms\`** | **Kịch bản 3 (Chuẩn DAG): Bước 1 — Quét Đỉnh Lá** | \`DagUserService: []\`, \`DagOrderService: []\` | Phát hiện 2 đỉnh có \`Out-degree = 0\`, đưa cả hai vào \`Ready Queue\` | Khởi tạo song song \`new DagUserService()\` và \`new DagOrderService()\` an toàn 100% |
| **\`t = 4 ms\`** | **Kịch bản 3 (Chuẩn DAG): Bước 2 — Giải phóng Đỉnh Cha** | \`Coordinator: [DagUserService, DagOrderService]\` | Sau khi 2 đỉnh lá hoàn tất, bậc phụ thuộc chờ của \`Coordinator\` giảm từ \`2\` về \`0\` | Gọi \`new CustomerLoyaltyCoordinatorService(userSvc, orderSvc)\` |
| **\`t = 6 ms\`** | **Kịch bản 3 (Chuẩn DAG): Bước 3 — Kích hoạt Lifecycle** | Toàn bộ cây DAG hoàn tất theo đúng thứ tự Tô-pô | Gọi \`onModuleInit()\` từ tầng lá lên tầng điều phối bậc cao | Đảm bảo khi \`Coordinator.onModuleInit()\` chạy, mọi dịch vụ cấp dưới đã sẵn sàng 100%! |

### 1.4 Định lượng Độ phức tạp Duyệt Đồ thị Kahn's Algorithm và Phát hiện Chu trình DFS Ba màu

Để kiểm tra xem đồ thị phụ thuộc $G = (V, E)$ có chứa chu trình (\`Cycle\`) hay không, các bộ kiểm tra kiến trúc sử dụng thuật toán **Tìm kiếm Theo Chiều sâu Ba màu (\`3-Color Depth-First Search\`)** hoặc **Thuật toán Kahn (\`Kahn's Topological Sort\`)** với độ phức tạp tuyến tính:
- **Trạng thái \`0 (WHITE — Unvisited)\`:** Đỉnh chưa từng được duyệt tới.
- **Trạng thái \`1 (GRAY — Visiting / In Recursion Stack)\`:** Đỉnh đang nằm trên ngăn xếp đệ quy hiện tại (đang đi tìm các phụ thuộc con của nó). Nếu trong lúc duyệt các phụ thuộc con mà gặp lại một đỉnh đang có màu **\`GRAY (1)\`**, ta khẳng định **100% đồ thị có chu trình khép kín (\`Back-Edge Detected\`)**!
- **Trạng thái \`2 (BLACK — Visited / Resolved)\`:** Đỉnh và toàn bộ cây phụ thuộc con của nó đã được chứng minh an toàn, không có chu trình.

\`\`\`
Độ phức tạp Thời gian Phát hiện Chu trình và Sắp xếp Tô-pô (T_DAG_Sort) = O(|V| + |E|)
Độ phức tạp Không gian Bộ nhớ Ngăn xếp Đệ quy (Space_DFS_Stack) = O(|V|)
Điều kiện Cần và Đủ để Đồ thị là DAG Hợp lệ: Số lượng Đỉnh được lấy ra khỏi Hàng đợi Kahn (Resolved_Vertices_Count) === Tổng số Đỉnh |V|
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc quản trị Đồ thị Phụ thuộc):**
> 1. **Xem \`forwardRef()\` là Nợ Kỹ thuật (\`Technical Debt\`) chứ không phải Giải pháp Chuẩn:** Chỉ dùng \`forwardRef()\` như biện pháp cứu hỏa tạm thời; về mặt kiến trúc, hai Service phụ thuộc vòng tròn chứng tỏ ranh giới miền (\`Bounded Context\`) bị chia sai và cần được tách thành mô hình \`Coordinator -> Leaf Services\` hoặc giao tiếp qua \`EventEmitter2\`.
> 2. **Trật tự \`onModuleInit\` phụ thuộc vào tính chất \`DAG\`:** Chỉ khi đồ thị không có chu trình, NestJS mới có thể đảm bảo gọi \`onModuleInit()\` của dịch vụ cấp dưới hoàn tất trước khi gọi \`onModuleInit()\` của dịch vụ cấp trên.

---

# 2. BA PHẠM VI VÒNG ĐỜI INJECTION SCOPES (DEFAULT, TRANSIENT, REQUEST), HIỆN TƯỢNG LAN TRUYỀN NGƯỢC (SCOPE BUBBLING) VÀ SỰ SỤP ĐỔ V8 GARBAGE COLLECTOR

### 2.1 Giải phẫu Ba Phạm vi Cấp phát: \`Scope.DEFAULT\` (Singleton), \`Scope.TRANSIENT\` và \`Scope.REQUEST\`

Mỗi Provider trong NestJS có thể được cấu hình một trong 3 phạm vi vòng đời (\`Injection Scopes\`): **\`Scope.DEFAULT\`**, **\`Scope.TRANSIENT\`** và **\`Scope.REQUEST\`**. Sự lựa chọn này quyết định trực tiếp việc đối tượng sẽ nằm yên ổn trong vùng nhớ già (**\`V8 Old Generation Heap\`**) hay bị tạo mới và phá hủy liên tục hàng vạn lần mỗi giây trên vùng nhớ trẻ (**\`V8 Young Generation / Semi-space\`**):

| Tiêu chí Kỹ thuật & Bộ nhớ | \`Scope.DEFAULT\` (\`Singleton\` — Mặc định) | \`Scope.TRANSIENT\` (Cấp phát theo Nơi tiêm) | \`Scope.REQUEST\` (Cấp phát theo Từng Request) |
| :--- | :--- | :--- | :--- |
| **1. Thời điểm Khởi tạo (\`Instantiation\`)** | **1 lần duy nhất** tại thời điểm Bootstrap (\`NestFactory.create\`) | Khởi tạo lúc Bootstrap (nếu cha là Singleton), mỗi nơi tiêm (\`Injection Site\`) nhận 1 bản riêng | **Khởi tạo lại từ đầu trên MỖI HTTP Request** đi vào hệ thống! |
| **2. Số lượng Bản thể trong RAM** | **\`1 bản thể duy nhất\`** trên toàn bộ tiến trình Node.js | Bằng số lượng các lớp khác có khai báo tiêm Provider này ($K$ nơi tiêm = $K$ bản thể) | Bằng **\`RPS × Số lượng Lớp bị lây nhiễm\`** trên mỗi giây hoạt động |
| **3. Phân vùng Lưu trữ trên V8 Heap** | Sống lâu dài trong **\`Old Generation Space\`** (0% áp lực lên bộ thu gom rác Minor GC) | Sống trong **\`Old Generation Space\`** theo vòng đời của lớp cha chứa nó | Cấp phát dồn dập trên **\`Young Generation (Nursery)\`**, biến thành rác ngay khi xong Request |
| **4. Cấu trúc Lưu trong \`InstanceWrapper\`** | Lưu cố định tại khóa tĩnh \`STATIC_CONTEXT\` trong bảng \`values\` | Tạo \`InstanceWrapper\` riêng cho từng \`InquirerId\` tại lúc khởi động | Tạo một \`ContextId = createContextId()\` mới cho mỗi Request trong \`WeakMap\` |
| **5. An toàn Trạng thái (\`State Safety\`)** | **Phải viết Stateless**: Nếu lưu biến \`this.currentUser\` sẽ bị ghi đè chéo giữa các khách hàng! | Cô lập trạng thái giữa các \`Controller/Service\` khác nhau (ví dụ \`Logger\` gắn sẵn tên Context) | Cô lập giữa các Request, nhưng **phá hủy hiệu năng CPU và bộ nhớ ở tải cao**! |

### 2.2 Cơ chế Lây nhiễm Ngược Chuỗi Phụ thuộc (\`Scope Bubbling / Viral Propagation\`) và Định lượng Chi phí Cấp phát Bộ nhớ

Tại sao một thay đổi tưởng chừng vô hại là thêm \`@Injectable({ scope: Scope.REQUEST })\` vào một lớp nhỏ ở tầng dưới cùng (ví dụ \`TenantAuditHelper\` hoặc \`BaseRepository\`) lại có thể đánh sập toàn bộ cụm máy chủ Production khi lưu lượng tăng cao?

Nguyên nhân nằm ở định luật vật lý của đồ thị phụ thuộc mang tên **Hiện tượng Lan truyền Ngược Phạm vi (\`Scope Bubbling / Viral Scope Infection\`)**:
1. **Tại sao \`Singleton\` không thể giữ con trỏ cố định tới một đối tượng \`Scope.REQUEST\`?**
   Giả sử \`OrdersController\` (mặc định là \`Singleton\`) tiêm \`OrdersService\` (\`Singleton\`), và \`OrdersService\` lại tiêm \`TenantContextHelper\` (được gắn \`Scope.REQUEST\`).
   - Nếu \`OrdersService\` vẫn giữ nguyên là \`Singleton\` (chỉ khởi tạo 1 lần lúc Bootstrap), thì thuộc tính \`this.tenantHelper\` bên trong \`OrdersService\` sẽ bị đóng đinh vĩnh viễn vào một bản thể duy nhất, làm mất hoàn toàn ý nghĩa tạo mới theo từng Request của \`TenantContextHelper\`!
   - Do đó, để \`TenantContextHelper\` có thể nhận bản thể mới trên mỗi Request, **\`NestContainer\` buộc phải tự động ép \`OrdersService\` biến thành \`Scope.REQUEST\`**, và tiếp tục **ép ngược lên \`OrdersController\` cũng biến thành \`Scope.REQUEST\`**!
2. **Sự bùng nổ Cấp số Nhân trên V8 Young Generation và Bão Thu gom Rác (\`GC Thrashing\`):**
   Chỉ vì **1 lớp lá** ở dưới đáy bật \`Scope.REQUEST\`, toàn bộ nhánh cây gồm \`Controller\`, \`Service A\`, \`Service B\`, \`Repository\` phía trên nó đều bị lây nhiễm biến thành \`Scope.REQUEST\`. Trên mỗi yêu cầu HTTP đi vào, \`NestJS Injector\` phải duyệt lại nhánh cây phụ thuộc đó, cấp phát mới hàng loạt đối tượng trên vùng nhớ \`Nursery (Young Generation)\` của V8. Khi vùng nhớ \`Nursery\` (thường chỉ rộng \`16 MB – 64 MB\`) bị lấp đầy chỉ sau vài chục mili-giây, bộ thu gom rác **\`V8 Scavenger (Minor GC)\`** buộc phải kích hoạt liên tục cơ chế **Tạm dừng Toàn bộ Luồng Chính (\`Stop-The-World Pause\`)** để quét và dọn rác!

\`\`\`
Tổng số Đối tượng Bị Tái Cấp phát mỗi Giây do Scope Bubbling (Bubbled_Allocations_Per_Sec) = RPS × (1 + Infected_Upstream_Chain_Count)
Tốc độ Đốt Bộ nhớ V8 Nursery (Heap_Churn_KB_Per_Sec) = Bubbled_Allocations_Per_Sec × Avg_Wrapper_And_Instance_Size_KB
Tần suất Bão Thu gom Rác Minor GC (GC_Cycles_Per_Sec) = Heap_Churn_KB_Per_Sec / V8_SemiSpace_Capacity_KB
Ví dụ định lượng: Một chuỗi DI có 12 classes bị lây nhiễm Scope.REQUEST (mỗi instance + metadata closure tốn 2.5 KB) ở mức tải 3,000 RPS:
-> Hệ thống phải tạo mới: 3,000 × 12 = 36,000 instances/giây, xả ra 36,000 × 2.5 KB = 90,000 KB/giây (~87.89 MB rác/giây) làm độ trễ P99 tăng gấp 8 lần!
\`\`\`

### 2.3 Tại sao \`Scope.REQUEST\` làm suy sụp Thông lượng API từ 5,000 RPS xuống 400 RPS ở Tải cao?

Ngoài chi phí rác bộ nhớ V8 Heap, việc sử dụng \`Scope.REQUEST\` còn gây ra **2 điểm nghẽn CPU nghiêm trọng** bên trong \`@nestjs/core\`:
1. **Chi phí Duyệt lại Đồ thị DI trên Từng Request (\`Per-Request DI Tree Traversal\`):**
   Với \`Scope.DEFAULT (Singleton)\`, toàn bộ lời gọi phương thức \`this.ordersService.create()\` chỉ là một phép truy cập con trỏ bộ nhớ trực tiếp mất \`~1 nano-giây\`. Nhưng với \`Scope.REQUEST\`, trên mỗi yêu cầu HTTP đến, \`RouterExecutionContext\` phải khởi tạo một đối tượng \`contextId\`, tra cứu bảng \`WeakMap\` trong từng \`InstanceWrapper\`, kiểm tra các phụ thuộc con và gọi chuỗi hàm khởi tạo \`new Service(...)\` tốn hàng trăm micro-giây CPU trên luồng chính đơn lẻ của Node.js!
2. **Mất tối ưu hóa \`Inline Caching (IC)\` của trình biên dịch V8 TurboFan:**
   Khi hàng vạn bản thể \`Controller\` và \`Service\` mới liên tục được tạo ra và hủy đi trên mỗi yêu cầu, bộ đệm đường ống thực thi của V8 và cơ chế lưu trữ theo \`ContextId\` phải làm việc liên tục, kéo tụt thông lượng tối đa của máy chủ NestJS giảm đi từ **\`40% đến 75%\`**.

> **Tổng kết học thuật Phần 2 (Quy tắc Cấm \`Scope.REQUEST\` cho Ngữ cảnh Yêu cầu):**
> Trong kiến trúc Backend chịu tải cao (\`High-Concurrency Systems\`), việc đổi một Service sang \`Scope.REQUEST\` chỉ để đọc \`req.headers['x-trace-id']\` hoặc \`req.user.tenantId\` bị coi là một **Phản mẫu Nghiêm trọng (\`Critical Performance Anti-Pattern\`)**. Toàn bộ các Service nghiệp vụ bắt buộc phải được giữ ở \`Scope.DEFAULT (Singleton)\` và sử dụng \`AsyncLocalStorage\` để đọc ngữ cảnh yêu cầu.

---

# 3. KIẾN TRÚC THAY THẾ ZERO-ALLOCATION VỚI NODE.JS ASYNCLOCALSTORAGE (ASYNC_HOOKS) VÀ CHẨN ĐOÁN PRODUCTION

### 3.1 Nguyên lý Hoạt động của \`AsyncLocalStorage\` trong Nhân Node.js (\`AsyncResource\` Execution Context Propagation)

Làm thế nào một \`OrdersService\` ở chế độ **\`Singleton (Scope.DEFAULT)\`** (chỉ có duy nhất 1 bản thể dùng chung cho cả 10,000 người dùng đang gọi cùng lúc) lại có thể biết chính xác câu lệnh \`this.logger.log()\` hiện tại đang phục vụ cho \`traceId\` và \`tenantId\` của người dùng nào mà không cần truyền tham số \`traceId\` qua từng hàm?

Câu trả lời chuẩn mực trong Node.js hiện đại là sử dụng lớp **\`AsyncLocalStorage<T>\`** thuộc mô-đun lõi \`node:async_hooks\`:
1. **Bản chất Tương đương \`Thread-Local Storage (TLS)\` cho Môi trường Đơn luồng Bất đồng bộ:**
   Trong Java hoặc C++, mỗi yêu cầu chạy trên 1 luồng OS riêng nên có thể lưu dữ liệu vào biến cục bộ của luồng (\`ThreadLocal\`). Trong Node.js, hàng nghìn yêu cầu chạy đan xen trên 1 luồng V8 duy nhất thông qua các bước nhảy \`Promise / async-await / Timer\`.
2. **Cơ chế Lan truyền tự động qua Cây Tài nguyên Bất đồng bộ (\`AsyncResource Propagation\`):**
   Khi yêu cầu HTTP vừa chạm vào tầng **\`Middleware\`** đầu tiên, ta tạo một đối tượng ngữ cảnh nhẹ \`store = { traceId, userId, tenantId }\` và gọi \`asyncLocalStorage.run(store, () => next())\`.
   - Bên dưới nhân C++ của Node.js (\`v8::Isolate\` & \`AsyncWrap\`), mỗi khi hàm \`next()\` sinh ra một \`Promise\` mới, một truy vấn Database hay một \`setTimeout\`, con trỏ tới đối tượng \`store\` sẽ được **tự động gắn kèm vào khung ngữ cảnh thực thi bất đồng bộ (\`ExecutionAsyncResource\`)** của nhánh đó và khôi phục lại chính xác mỗi khi callback của \`Promise\` đó được V8 đưa lên \`Call Stack\` thực thi!
   - Nhờ đó, bất kỳ \`Singleton Service\` nào nằm sâu 10 tầng bên dưới chỉ cần gọi \`asyncLocalStorage.getStore()\` là lấy được ngay đúng \`traceId / tenantId\` của yêu cầu hiện tại với độ phức tạp $O(1)$, trong khi **100% cây \`Controller -> Service -> Repository\` vẫn giữ nguyên là \`Singleton\` (0 byte tái cấp phát DI!)**.

### 3.2 Hiện thực \`RequestContextService\` 100% Singleton (\`Scope.DEFAULT\`) Thay thế Hoàn toàn \`@Inject(REQUEST)\`

Đoạn mã dưới đây đối chiếu trực tiếp phản mẫu \`Scope.REQUEST\` và kiến trúc chuẩn Production sử dụng \`AsyncLocalStorage\` trong NestJS:

\`\`\`typescript
// File: src/common/context/async-local-storage-context.service.ts
import { Injectable, Scope, Inject, NestMiddleware } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { AsyncLocalStorage } from 'node:async_hooks';

// 1. THIẾT KẾ SAI (ANTI-PATTERN): Dùng Scope.REQUEST gây lây nhiễm Scope Bubbling toàn hệ thống!
@Injectable({ scope: Scope.REQUEST })
export class BubblingRequestLoggerBrokenService {
  // CẢNH BÁO ĐỎ: Mọi Service và Controller nào tiêm lớp này đều bị ép biến thành Scope.REQUEST!
  constructor(
    @Inject(REQUEST)
    private readonly req: { headers?: Record<string, string> },
  ) {}

  getTraceIdBroken(): string {
    return this.req.headers?.['x-trace-id'] ?? 'UNKNOWN';
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION PATTERN): 100% Singleton (Scope.DEFAULT) + AsyncLocalStorage
export interface EnterpriseRequestStore {
  readonly traceId: string;
  readonly tenantId: string;
  readonly userId?: string;
  readonly requestStartMs: number;
}

@Injectable() // Mặc định là Scope.DEFAULT (Singleton tuyệt đối trên Old Generation Heap!)
export class EnterpriseAlsContextService {
  private readonly als = new AsyncLocalStorage<EnterpriseRequestStore>();

  runWithContext<R>(store: EnterpriseRequestStore, callback: () => R): R {
    return this.als.run(store, callback);
  }

  getTraceId(): string {
    return this.als.getStore()?.traceId ?? 'SYSTEM_BACKGROUND';
  }

  getTenantId(): string {
    const tenantId = this.als.getStore()?.tenantId;
    if (!tenantId) {
      throw new Error('MISSING_TENANT_CONTEXT');
    }
    return tenantId;
  }
}

@Injectable()
export class AlsContextIngressMiddleware implements NestMiddleware {
  constructor(private readonly contextService: EnterpriseAlsContextService) {}

  use(
    req: { headers?: Record<string, string> },
    _res: unknown,
    next: () => void,
  ): void {
    const store: EnterpriseRequestStore = {
      traceId: req.headers?.['x-trace-id'] ?? 'TRACE_GENERATED_01',
      tenantId: req.headers?.['x-tenant-id'] ?? 'DEFAULT_TENANT',
      requestStartMs: Date.now(),
    };

    // Bọc toàn bộ chuỗi thực thi phía sau (Guards -> Interceptors -> Pipes -> Controllers -> Services)
    this.contextService.runWithContext(store, () => next());
  }
}
\`\`\`

### 3.3 Phương pháp Chẩn đoán Sự cố \`Scope Bubbling\`, \`Circular Dependency\` và Rò rỉ Ngữ cảnh trên Production

Bảng dưới đây cung cấp quy trình chẩn đoán thực chiến cho 5 sự cố kiến trúc liên quan đến đồ thị phụ thuộc và phạm vi vòng đời trong NestJS:

| Triệu chứng Sự cố trên Production | Công cụ / Dấu hiệu Chẩn đoán Kỹ thuật | Nguyên nhân Gốc rễ ở Tầng Kiến trúc | Rủi ro Nếu Xử lý Sai cách | Giải pháp Khắc phục Triệt để Chuẩn Production |
| :--- | :--- | :--- | :--- | :--- |
| **1. Khi tải đạt \`1,500 RPS\`, CPU vọt lên 100%, thời gian dừng \`GC Pause\` cao và độ trễ P99 nhảy vọt** | Chạy \`node --trace-gc\`: thấy \`Scavenge (Minor GC)\` chạy dồn dập mỗi \`10–20 ms\` | **\`Scope Bubbling\`**: Một Service cấp thấp dùng \`Scope.REQUEST\` hoặc \`@Inject(REQUEST)\` làm lây nhiễm cả cây DI | Tăng thêm RAM cho Container (chỉ làm thời gian dừng của mỗi đợt Major GC lâu hơn!) | Gỡ bỏ hoàn toàn \`Scope.REQUEST\`, chuyển sang **\`AsyncLocalStorage\`** với \`Scope.DEFAULT\` (hoặc dùng thư viện \`nestjs-cls\`) |
| **2. Lỗi \`Cannot read properties of undefined\` bên trong hàm \`onModuleInit()\` của Service A** | Kiểm tra Constructor của Service A và Service B thấy cả hai đều dùng \`forwardRef()\` | Khi có chu trình $A \\leftrightarrow B$, một trong hai Service phải chạy \`onModuleInit()\` trước khi bên kia hoàn tất khởi tạo | Đặt \`setTimeout(..., 1000)\` bên trong \`onModuleInit\` (gây lỗi Race Condition ngẫu nhiên) | Tách phần logic khởi tạo chung sang một \`CoordinatorService\` hoặc dùng hook \`onApplicationBootstrap()\` |
| **3. Lỗi \`AsyncLocalStorage.getStore()\` trả về \`undefined\` bên trong một hàm xử lý sự kiện hoặc Callback cũ** | Xảy ra khi gọi thư viện C++/Callback kiểu cũ hoặc dùng chung một \`EventEmitter\`/Pool không gắn ngữ cảnh | Một số thư viện quản lý hàng đợi nội bộ làm đứt chuỗi liên kết \`AsyncResource\` của \`async_hooks\` | Quay lại dùng biến toàn cục \`global.currentTenantId\` (gây **Rò rỉ Dữ liệu Chéo** giữa 2 khách hàng!) | Bọc hàm callback bằng **\`AsyncResource.bind(fn)\`** để khóa chặt ngữ cảnh \`ALS\` vào hàm đó |
| **4. Hai Controller cùng gọi \`this.logger.setContext('Name')\` làm ghi đè tên module của nhau trong Log** | Nhật ký của \`UsersController\` lại in ra tiền tố \`[OrdersController]\` trên Console | \`CustomLogger\` đang để ở \`Scope.DEFAULT (Singleton)\` nhưng lại lưu biến trạng thái \`private contextName: string\` | Đổi \`CustomLogger\` sang \`Scope.REQUEST\` (gây lây nhiễm \`Scope Bubbling\` toàn bộ dự án!) | Chuyển \`CustomLogger\` sang **\`Scope.TRANSIENT\`** (chỉ tạo 1 bản riêng cho mỗi Controller lúc Bootstrap, **không gây Bubbling**!) |
| **5. Lỗi \`Nest cannot create the module instance... The module at index [0] of the XModule "imports" array is undefined\`** | \`Module A\` có \`imports: [ModuleB]\` và \`Module B\` có \`imports: [ModuleA]\` | Chu trình nạp tệp ở cấp độ **Module** khiến một trong hai biến Class Module nhận giá trị \`undefined\` | Gộp toàn bộ 50 Services của cả 2 Module vào chung trong \`AppModule\` | Tách các Provider dùng chung ra một \`SharedDomainModule\` độc lập để cả \`Module A\` và \`Module B\` cùng \`import\` một chiều |

> **Tổng kết học thuật Phần 3 (Khi nào dùng \`Scope.TRANSIENT\` vs \`AsyncLocalStorage\`):**
> - Dùng **\`Scope.TRANSIENT\`** khi một dịch vụ tiện ích (như \`CustomLogger\`) cần lưu cấu hình tĩnh riêng biệt cho từng lớp cha chứa nó (\`Controller A\` vs \`Controller B\`) — vì \`Scope.TRANSIENT\` được cấp phát lúc Bootstrap và **không gây hiệu ứng lây nhiễm thành \`Scope.REQUEST\`** khi cha của nó là Singleton!
> - Dùng **\`AsyncLocalStorage\` (kết hợp \`Scope.DEFAULT\`)** cho mọi dữ liệu động thay đổi theo từng yêu cầu mạng (\`traceId\`, \`tenantId\`, \`currentUser\`).

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Đồ Thị Phụ Thuộc DAG, Vòng Đời Scopes Và AsyncLocalStorage (DAG & Scopes Memory Architecture)
\`\`\`diagram
[TOPOLOGY: dual-cycle-loop]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG KHỞI TẠO ĐỒ THỊ DAG & SINGLETON CỐ ĐỊNH (BOOTSTRAP DAG & OLD-GEN)     │
│    [ Kahn Topological Sort (In-degree = 0) ] ◄───► [ Scope.DEFAULT Singleton (0 Byte/Req) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Phân nhánh Vòng đời: Giữ Nguyên Singleton hay Lây nhiễm Request Scope
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG LÂY NHIỄM SCOPE BUBBLING & VÒNG LẶP RÁC (REQUEST BUBBLING & GC LOOP)  │
│    ├── Viral Scope Bubbling: 1 Leaf Scope.REQUEST ép toàn bộ chuỗi cha đổi theo│
│    ├── Per-Request Tree Instantiation: Cấp phát mới hàng chục Object mỗi Req  │
│    └── V8 Nursery GC Thrashing: Bão thu gom rác Scavenger làm vọt độ trễ P99  │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Giải pháp Thay thế Không Cấp phát qua Ngữ cảnh Bất đồng bộ
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG TRUYỀN NGỮ CẢNH KHÔNG CẤP PHÁT (ZERO-ALLOCATION ASYNCLOCALSTORAGE)    │
│    ├── Ingress Middleware (als.run): Khởi tạo Store chứa traceId & tenantId   │
│    ├── Node.js async_hooks Propagation: Tự động truyền qua chuỗi Promise/Await│
│    └── Singleton Service Lookup (als.getStore): Truy xuất O(1) an toàn 100%   │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Hiệu Ứng Lây Nhiễm Scope.REQUEST (Scope Bubbling) Và Truyền Ngữ Cảnh Qua AsyncLocalStorage Singleton
\`\`\`diagram
MÔ HÌNH CŨ: DÙNG SCOPE.REQUEST Ở TẦNG THẤP GÂY LÂY NHIỄM NGƯỢC (VIRAL SCOPE BUBBLING)
Logger (Scope.REQUEST) ──► [ Ép OrderService thành REQUEST ] ──► [ Ép OrderController thành REQUEST ] ──► BÃO RÁC V8 GC THRASHING
3,000 Requests/giây = Cấp phát và hủy 36,000 instances/giây trên Young Gen, đốt cháy CPU và làm P99 nhảy từ 8ms lên 450ms.

MÔ HÌNH HIỆN ĐẠI: 100% SINGLETON (SCOPE.DEFAULT) KẾT HỢP NODE.JS ASYNCLOCALSTORAGE
Middleware (als.run) ──┐
OrderController (1)  ──┼──► [ Toàn bộ Service giữ nguyên Singleton trên Old Gen ] ──► Đọc als.getStore().traceId trong O(1)
OrderService (1)     ──┘                            │
                                                    └──► 0 Byte tái cấp phát DI ────► Duy trì thông lượng đỉnh với 0% GC Thrashing
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Lựa Chọn Phạm Vi Provider Scope Và Xử Lý Circular Dependency)
\`\`\`diagram
              CẦN QUYẾT ĐỊNH PHẠM VI VÒNG ĐỜI (SCOPE) HOẶC XỬ LÝ PHỤ THUỘC CHO PROVIDER TRONG NESTJS?
                                                         │
                                                         ▼
                       Bài toán kỹ thuật bạn đang cần giải quyết trong kiến trúc là gì?
                       /                                                               \\
       HAI SERVICE / MODULE BỊ LỖI CIRCULAR DEPENDENCY                   CẦN LƯU TRỮ TRẠNG THÁI HOẶC NGỮ CẢNH TRONG SERVICE
                       /                                                                 \\
                      ▼                                                                   ▼
     [ TÁCH MEDIATOR SERVICE HOẶC DÙNG EVENT (CHUẨN) ]                   Dữ liệu cần lưu gắn với từng Request mạng hay gắn tĩnh với từng Class cha?
     - Đưa đồ thị phụ thuộc trở lại chuẩn DAG (In-degree = 0)            /                                                                        \\
     - Chỉ dùng forwardRef() làm giải pháp tạm thời        THEO TỪNG HTTP REQUEST (TRACE-ID, TENANT-ID)                         THEO TỪNG CLASS TIÊM NÓ (LOGGER CONTEXT NAME)
     - Giúp thứ tự onModuleInit() luôn xác định 100%                     /                                                                            \\
                                                                        ▼                                                                              ▼
                                                      [ DÙNG ASYNCLOCALSTORAGE + SINGLETON (TỐI ƯU) ]                                [ DÙNG SCOPE.TRANSIENT (CHUẨN) ]
                                                      - Tuyệt đối KHÔNG dùng Scope.REQUEST ở tải cao                                 - Tạo 1 bản riêng cho mỗi Injection Site lúc khởi động
                                                      - Tránh 100% hiệu ứng lây nhiễm Scope Bubbling                                 - Không gây lây nhiễm Scope Bubbling lên Controller
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu Scope.DEFAULT, Scope.TRANSIENT, Scope.REQUEST Và AsyncLocalStorage)

| Tiêu Chí So Sánh | \`Scope.DEFAULT\` (Singleton) | \`Scope.TRANSIENT\` | \`Scope.REQUEST\` | \`Scope.DEFAULT\` + \`AsyncLocalStorage\` |
| :--- | :--- | :--- | :--- | :--- |
| **Chi phí Cấp phát DI trên mỗi Request** | **\`0 Bytes\`** (Đã khởi tạo xong lúc Bootstrap) | **\`0 Bytes\`** (Nếu lớp cha là Singleton) | **Cực cao**: Tái tạo toàn bộ nhánh cây bị lây nhiễm | **\`0 Bytes\`** cho DI (Chỉ tốn 1 object \`store\` nhỏ nhẹ) |
| **Hiệu ứng Lây nhiễm (\`Scope Bubbling\`)** | Không lây nhiễm | **Không lây nhiễm** lên lớp cha Singleton | **Lây nhiễm ngược 100%** lên mọi lớp cha dọc chuỗi DI | **Không lây nhiễm**: Giữ nguyên 100% đồ thị là Singleton |
| **Khả năng Đọc Ngữ cảnh (\`traceId/userId\`)** | Không đọc được nếu không truyền qua tham số hàm | Không đọc được ngữ cảnh động của từng Request | Đọc được trực tiếp qua \`@Inject(REQUEST)\` | **Đọc trực tiếp $O(1)$** qua \`als.getStore()\` ở mọi tầng sâu |
| **Ảnh hưởng Thông lượng (Throughput RPS)** | **Đạt 100% công suất tối đa** của máy chủ | Đạt ~100% công suất tối đa | **Sụt giảm nghiêm trọng (\`40% – 75%\`)** do GC Thrashing | Đạt **\`97% – 99%\`** công suất tối đa với độ trễ P99 phẳng |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`EnterpriseAlsContextService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Bất biến Đồ thị Không Chu trình (\`DAG Topological Ordering Invariant\`):** Quá trình khởi tạo của \`NestContainer\` dựa trên thuật toán Sắp xếp Tô-pô (\`Topological Sort\`), đòi hỏi luôn phải tồn tại các đỉnh lá có bậc phụ thuộc bằng \`0\` để khởi tạo trước. Khi xuất hiện chu trình khép kín ($A \\rightarrow B \\rightarrow A$), hệ thống nạp tệp của JavaScript trả về tham chiếu \`undefined\` làm sập quá trình đọc \`design:paramtypes\`; giải pháp kiến trúc triệt để nhất là tách lớp điều phối trung gian (\`Mediator\`) hoặc phát sự kiện bất đồng bộ để khôi phục tính chất \`DAG\`.
2. **Định đề Lây nhiễm Ngược Phạm vi Yêu cầu (\`Viral Scope Bubbling Invariant\`):** Một lớp \`Singleton\` không thể giữ tham chiếu tĩnh tới một lớp có vòng đời ngắn hơn nó (\`Scope.REQUEST\`). Do đó, bất kỳ Provider nào chuyển sang \`Scope.REQUEST\` sẽ tự động ép buộc toàn bộ các \`Services\` và \`Controllers\` phụ thuộc trực tiếp hoặc gián tiếp vào nó dọc theo chuỗi DI phải biến thành \`Scope.REQUEST\`.
3. **Định đề Suy thoái Bộ thu gom Rác do Tái cấp phát (\`Per-Request Allocation & GC Thrashing Invariant\`):** Khi hiệu ứng \`Scope Bubbling\` lan rộng trên hệ thống có lưu lượng hàng nghìn RPS, việc khởi tạo lại hàng chục đối tượng dịch vụ trên mỗi yêu cầu sẽ làm tràn vùng nhớ \`V8 Young Generation (Nursery)\` liên tục, kích hoạt bão thu gom rác \`Stop-The-World Scavenger\` và làm suy sụp thông lượng toàn máy chủ.
4. **Định đề Cô lập Ngữ cảnh Không Cấp phát (\`Zero-Allocation AsyncLocalStorage Invariant\`):** Để truy xuất thông tin định danh của từng yêu cầu (\`traceId\`, \`tenantId\`, \`userId\`) tại các tầng \`Service / Repository\` sâu bên dưới mà không phá vỡ kiến trúc \`Singleton\`, kỹ sư bắt buộc phải khởi tạo ngữ cảnh bằng **\`AsyncLocalStorage.run()\`** tại tầng \`Ingress Middleware\` và đọc qua **\`AsyncLocalStorage.getStore()\`** bên trong các \`Scope.DEFAULT\` Providers.
  `,
  realCodeSnippet: `// File: src/common/als/enterprise-als-context.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Truyền Ngữ Cảnh Đa Thuê Bao (Multi-Tenant ALS) 100% Singleton
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestExecutionStore {
  readonly traceId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly startedAtMs: number;
}

export interface IncomingHttpHeaders {
  readonly [headerName: string]: string | undefined;
}

export interface RawHttpRequest {
  readonly headers?: IncomingHttpHeaders;
}

/**
 * ADR-0044: Loại bỏ hoàn toàn Scope.REQUEST bằng Node.js AsyncLocalStorage:
 * 1. Giữ EnterpriseAlsContextService và toàn bộ Repository/Service ở chế độ Scope.DEFAULT (Singleton),
 *    triệt tiêu 100% hiện tượng Scope Bubbling và bão thu gom rác V8 GC Thrashing ở tải cao.
 * 2. Bọc mỗi HTTP Request vào một không gian lưu trữ bất đồng bộ cô lập thông qua als.run() tại Middleware.
 * 3. Cho phép mọi tầng dịch vụ truy xuất traceId và tenantId trong thời gian O(1) mà không cần truyền tham số.
 */
@Injectable()
export class EnterpriseAlsContextService {
  private readonly storage = new AsyncLocalStorage<RequestExecutionStore>();

  public runInIsolatedContext<T>(store: RequestExecutionStore, next: () => T): T {
    return this.storage.run(store, next);
  }

  public getCurrentStore(): RequestExecutionStore | undefined {
    return this.storage.getStore();
  }

  public getRequiredTenantId(): string {
    const store = this.storage.getStore();
    if (!store || !store.tenantId) {
      throw new Error('TENANT_CONTEXT_NOT_INITIALIZED');
    }
    return store.tenantId;
  }

  public getTraceId(): string {
    return this.storage.getStore()?.traceId ?? 'UNTRACED_EXECUTION';
  }
}

@Injectable()
export class MultiTenantAlsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MultiTenantAlsMiddleware.name);

  constructor(private readonly alsContext: EnterpriseAlsContextService) {}

  public use(req: RawHttpRequest, _res: unknown, next: () => void): void {
    const traceId = req.headers?.['x-trace-id']?.trim() || 'TRACE_AUTO_GEN';
    const tenantId = req.headers?.['x-tenant-id']?.trim() || 'PUBLIC_TENANT';
    const actorId = req.headers?.['x-actor-id']?.trim() || 'ANONYMOUS';

    const store: RequestExecutionStore = Object.freeze({
      traceId,
      tenantId,
      actorId,
      startedAtMs: Date.now(),
    });

    this.alsContext.runInIsolatedContext(store, () => {
      this.logger.debug(\`[ALS Bound] traceId=\${traceId} | tenantId=\${tenantId}\`);
      next();
    });
  }
}`,
  quiz: [
    {
      id: 'c4-l3-q1',
      question: 'Hiện tượng "Scope Bubbling" (Lan truyền ngược phạm vi) trong NestJS Dependency Injection gây ra hệ quả gì đối với kiến trúc ứng dụng?',
      options: [
        'Trình biên dịch TypeScript sẽ lập tức báo lỗi cú pháp và từ chối xuất các tệp tin mã nguồn liên quan sang thư mục đích dist/.',
        'Khi một Service cấp thấp đặt Scope.REQUEST, mọi Service và Controller phụ thuộc vào nó dọc chuỗi DI đều bị ép biến thành Scope.REQUEST.',
        'Các Module bị ảnh hưởng sẽ tự động ngắt kết nối cơ sở dữ liệu sau khi xử lý đủ một nghìn yêu cầu đồng thời từ phía người dùng.',
        'Trạng thái dữ liệu của các yêu cầu khác nhau sẽ bị gộp chung vào một vùng nhớ tĩnh duy nhất làm rò rỉ thông tin giữa các khách hàng.'
      ],
      correctIndex: 1,
      explanation: 'Vì một đối tượng Singleton không thể giữ con trỏ cố định tới một đối tượng tạo mới theo từng Request, Scope.REQUEST có tính lây nhiễm ngược (Viral Bubbling): bất kỳ Service hay Controller nào trực tiếp hoặc gián tiếp tiêm một Provider có Scope.REQUEST đều bị NestContainer tự động ép chuyển sang Scope.REQUEST.'
    },
    {
      id: 'c4-l3-q2',
      question: 'Tại sao việc dùng Scope.REQUEST để lấy thông tin yêu cầu (như traceId, userId) lại bị coi là phản mẫu hiệu năng nghiêm trọng ở tải cao?',
      options: [
        'Vì chế độ Scope.REQUEST chỉ hoạt động được trên giao thức cũ HTTP/1.0 và hoàn toàn không tương thích với chuẩn ghép kênh HTTP/2.',
        'Vì đối tượng Request được tiêm vào qua @Inject(REQUEST) bị tước bỏ hoàn toàn các trường tiêu đề bảo mật như Authorization và Cookie.',
        'Vì nhân hệ điều hành Linux sẽ tự động khóa cổng mạng TCP nếu phát hiện một tiến trình ứng dụng khởi tạo quá một trăm đối tượng mỗi giây.',
        'Vì nó buộc hệ thống cấp phát và hủy hàng vạn đối tượng mới mỗi giây trên V8 Young Generation, gây bão thu gom rác GC Thrashing và vọt độ trễ.'
      ],
      correctIndex: 3,
      explanation: 'Ở mức tải hàng nghìn RPS, hiệu ứng Scope Bubbling khiến mỗi request phải khởi tạo lại cả chục đối tượng Service/Controller trên vùng nhớ Young Generation của V8, gây ra hiện tượng GC Thrashing (bộ thu gom rác Scavenger chạy Stop-the-World liên tục) và làm độ trễ P99 tăng vọt gấp nhiều lần.'
    },
    {
      id: 'c4-l3-q3',
      question: 'Cơ chế kỹ thuật bên dưới của hàm forwardRef(() => TargetService) giúp giải quyết lỗi phụ thuộc vòng tròn giữa hai tệp tin là gì?',
      options: [
        'Bọc tham chiếu class trong một hàm closure để trì hoãn việc đánh giá biến cho đến khi cả hai tệp tin đã được nạp xong vào bộ nhớ Runtime.',
        'Tự động gộp mã nguồn của hai tệp tin bị phụ thuộc vòng tròn thành một lớp duy nhất trong quá trình đóng gói bằng công cụ Webpack.',
        'Di chuyển một trong hai lớp dịch vụ sang thực thi trên một tiến trình máy chủ phụ trợ độc lập thông qua giao thức truyền tin nội bộ.',
        'Lưu trữ toàn bộ bảng phương thức của cả hai lớp vào bộ nhớ đệm Redis để gọi hàm từ xa mà không cần truyền qua tham số constructor.'
      ],
      correctIndex: 0,
      explanation: 'Khi hai tệp import lẫn nhau, một trong hai biến Class sẽ nhận giá trị undefined tại thời điểm decorator chạy. Bằng cách bọc trong hàm mũi tên () => TargetService, forwardRef trì hoãn việc đọc giá trị biến cho tới khi cả hai tệp mã nguồn đã thực thi xong lệnh khai báo class và sẵn sàng trong bộ nhớ.'
    },
    {
      id: 'c4-l3-q4',
      question: 'Phương pháp tái cấu trúc (Refactoring) chuẩn mực nhất để triệt tiêu hoàn toàn lỗi Circular Dependency giữa UserService và OrderService là gì?',
      options: [
        'Khai báo cả hai đối tượng dịch vụ thành các biến toàn cục gắn trực tiếp vào đối tượng globalThis của tiến trình thực thi Node.js.',
        'Chuyển đổi toàn bộ các phương thức nghiệp vụ bên trong cả hai lớp sang dạng phương thức tĩnh (static methods) để không cần dùng hàm khởi tạo.',
        'Tách phần logic chung sang một Service điều phối thứ ba (đưa đồ thị trở lại chuẩn DAG một chiều) hoặc chuyển sang giao tiếp qua EventEmitter.',
        'Tăng giới hạn bộ nhớ ngăn xếp đệ quy của động cơ V8 Engine lên mức tối đa để cho phép hai lớp gọi khởi tạo vòng tròn nhiều lần.'
      ],
      correctIndex: 2,
      explanation: 'forwardRef() chỉ là giải pháp tình thế giữ nguyên chu trình. Để khôi phục đồ thị về chuẩn Directed Acyclic Graph (DAG), kỹ sư cần tách phần logic giao thoa ra một lớp thứ 3 (Mediator / Coordinator Service hoặc Shared Service) sao cho mũi tên phụ thuộc chỉ đi một chiều, hoặc dùng EventEmitter2 để phát sự kiện bất đồng bộ.'
    },
    {
      id: 'c4-l3-q5',
      question: 'Thuật toán Sắp xếp Tô-pô (Kahn Topological Sort) xác định thứ tự khởi tạo các Provider trong đồ thị DAG của NestJS dựa trên quy tắc nào?',
      options: [
        'Tìm và khởi tạo trước các đỉnh lá không phụ thuộc vào ai (bậc phụ thuộc chờ = 0), sau đó gỡ cạnh phụ thuộc và lặp lại cho các đỉnh kế tiếp.',
        'Sắp xếp danh sách toàn bộ các Provider theo thứ tự bảng chữ cái tên lớp từ A đến Z rồi lần lượt gọi hàm khởi tạo từ đầu đến cuối.',
        'Ưu tiên khởi tạo các tệp tin có dung lượng mã nguồn nhỏ nhất trước để tiết kiệm bộ nhớ đệm cho các tệp tin lớn khởi tạo phía sau.',
        'Gọi hàm khởi tạo của toàn bộ mọi Provider cùng một lúc bằng Promise.all và tự động thử lại nếu gặp lỗi thiếu tham số phụ thuộc.'
      ],
      correctIndex: 0,
      explanation: 'Trong đồ thị DAG, thuật toán Sắp xếp Tô-pô luôn bắt đầu từ các nút lá không có phụ thuộc (Out-degree = 0 / không cần chờ ai). Ngay khi các nút lá này được khởi tạo xong, các lớp bậc cao hơn chỉ phụ thuộc vào chúng sẽ thỏa mãn đủ điều kiện và tiếp tục được khởi tạo tuần tự lên tới đỉnh gốc AppModule.'
    },
    {
      id: 'c4-l3-q6',
      question: 'Sự khác biệt quan trọng nhất về mặt hiệu năng giữa Scope.TRANSIENT và Scope.REQUEST khi được tiêm vào các lớp Singleton là gì?',
      options: [
        'Scope.TRANSIENT chỉ được phép dùng cho Controller, trong khi Scope.REQUEST chỉ được phép dùng cho các lớp kết nối cơ sở dữ liệu.',
        'Scope.TRANSIENT tạo bản thể riêng cho từng nơi tiêm ngay lúc Bootstrap và KHÔNG gây lây nhiễm Scope Bubbling trên mỗi HTTP Request như Scope.REQUEST.',
        'Scope.TRANSIENT lưu trữ đối tượng trên ổ đĩa cứng, trong khi Scope.REQUEST lưu trữ đối tượng trực tiếp trong bộ nhớ đệm L1 của CPU.',
        'Scope.TRANSIENT tự động xóa đối tượng sau mỗi 5 giây, trong khi Scope.REQUEST giữ đối tượng tồn tại vĩnh viễn cho đến khi tắt máy chủ.'
      ],
      correctIndex: 1,
      explanation: 'Khi một Provider có Scope.TRANSIENT (ví dụ CustomLogger) được tiêm vào 10 Singleton Services, NestContainer sẽ khởi tạo 10 bản thể riêng biệt cho 10 nơi tiêm đó ngay tại thời điểm Bootstrap và giữ cố định trong Old Generation Heap. Nó hoàn toàn không gây lây nhiễm Scope Bubbling và không tái cấp phát trên từng HTTP Request như Scope.REQUEST.'
    },
    {
      id: 'c4-l3-q7',
      question: 'Khi sử dụng Node.js AsyncLocalStorage để lưu trữ ngữ cảnh yêu cầu (traceId, tenantId) thay cho Scope.REQUEST, ta nên gọi hàm als.run() ở đâu?',
      options: [
        'Gọi bên trong phương thức dọn dẹp tài nguyên onModuleDestroy() của lớp AppModule khi ứng dụng nhận tín hiệu tắt máy chủ.',
        'Gọi ở dòng cuối cùng bên trong phương thức xử lý của Controller sau khi đã hoàn tất việc truy vấn cơ sở dữ liệu và trả kết quả.',
        'Gọi bên trong lớp Exception Filter khi hệ thống phát hiện có lỗi kết nối mạng hoặc lỗi truy vấn cơ sở dữ liệu không mong muốn.',
        'Gọi ngay tại tầng Ingress Middleware đầu tiên tiếp nhận yêu cầu để bao bọc toàn bộ chuỗi thực thi phía sau vào ngữ cảnh lưu trữ.'
      ],
      correctIndex: 3,
      explanation: 'Middleware là trạm đầu tiên trong vòng đời Request. Khi gọi asyncLocalStorage.run(store, () => next()) ngay trong Middleware, toàn bộ các bước tiếp theo chạy bên trong hàm callback next() (bao gồm Guards, Interceptors, Pipes, Controllers, Singleton Services và Repositories) đều tự động kế thừa và đọc được store đó.'
    },
    {
      id: 'c4-l3-q8',
      question: 'Nếu Module A khai báo imports: [ModuleB] và Module B cũng khai báo ngược lại imports: [ModuleA] mà không dùng forwardRef(), điều gì sẽ xảy ra?',
      options: [
        'NestJS sẽ tự động gộp cả hai Module thành một Module toàn cục duy nhất và tiếp tục khởi động máy chủ bình thường không có cảnh báo.',
        'Ứng dụng vẫn khởi động thành công nhưng toàn bộ các API thuộc hai Module này sẽ bị giảm một nửa tốc độ phản hồi do xung đột bộ nhớ.',
        'Một trong hai biến Class Module sẽ nhận giá trị undefined lúc nạp tệp, gây lỗi sập tiến trình ngay lập tức khi khởi tạo đồ thị Module.',
        'Bộ thu gom rác của V8 Engine sẽ tự động xóa bỏ một trong hai Module khỏi bộ nhớ RAM để giải phóng vòng lặp phụ thuộc cho hệ thống.'
      ],
      correctIndex: 2,
      explanation: 'Tương tự như chu trình giữa hai Service, khi hai tệp Module import trực tiếp lẫn nhau, hệ thống nạp module của JavaScript sẽ gán undefined cho một trong hai biến Class tại thời điểm thực thi decorator @Module({ imports: [undefined] }), khiến NestFactory.create() lập tức ném lỗi sập ứng dụng ngay lúc khởi động.'
    }
  ],
  codeChallenge: {
    id: 'c4-l3-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Thảm Họa Bộ Nhớ Do Lây Nhiễm Scope.REQUEST (Scope Bubbling Calculator)',
    description: 'Hiện thực hàm `calculateScopeBubblingImpact(rps, totalServices, infectedServicesCount, instanceSizeKB)` để định lượng sự chênh lệch bộ nhớ cấp phát mỗi giây giữa kiến trúc có lây nhiễm `Scope.REQUEST` và kiến trúc chuẩn `100% Singleton + AsyncLocalStorage`.\nQuy tắc:\n1. Với các dịch vụ bị lây nhiễm `Scope.REQUEST` (`infectedServicesCount`): mỗi giây hệ thống phải cấp phát mới `allocatedInstancesPerSec = rps * infectedServicesCount` bản thể trên V8 Young Generation.\n2. Tốc độ xả rác bộ nhớ mỗi giây do `Scope.REQUEST`: `heapChurnKBPerSec = Math.round((allocatedInstancesPerSec * instanceSizeKB) * 100) / 100`.\n3. Nếu chuyển sang dùng `AsyncLocalStorage` (giữ toàn bộ `totalServices` là Singleton, chỉ tạo 1 đối tượng `store` nhỏ nhẹ nặng `0.25 KB` trên mỗi request): dung lượng cấp phát mỗi giây chỉ là `alsStoreKBPerSec = Math.round((rps * 0.25) * 100) / 100`.\n4. Tính lượng bộ nhớ tiết kiệm được mỗi giây: `savedKBPerSec = Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100`.\nTrả về `{ allocatedInstancesPerSec, heapChurnKBPerSec, alsStoreKBPerSec, savedKBPerSec }`.',
    guidedSteps: [
      'Bước 1 (Tính số bản thể bị tạo mới mỗi giây): Tính allocatedInstancesPerSec = rps * infectedServicesCount.',
      'Bước 2 (Tính tốc độ xả rác V8 Heap của Scope.REQUEST): Tính heapChurnKBPerSec = Math.round(allocatedInstancesPerSec * instanceSizeKB * 100) / 100.',
      'Bước 3 (Tính chi phí của AsyncLocalStorage Store): Tính alsStoreKBPerSec = Math.round(rps * 0.25 * 100) / 100.',
      'Bước 4 (Tính dung lượng RAM tiết kiệm được mỗi giây): Tính savedKBPerSec = Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100 và trả về kết quả.'
    ],
    hints: [
      'Lưu ý rằng các dịch vụ giữ được trạng thái Singleton (totalServices - infectedServicesCount) tốn 0 KB cấp phát mới khi xử lý request!',
      'Áp dụng Math.round(val * 100) / 100 cho các phép tính KB để tránh sai số dấu phẩy động.'
    ],
    starterCode: `function calculateScopeBubblingImpact(rps, totalServices, infectedServicesCount, instanceSizeKB) {
  // Bước 1: Tính allocatedInstancesPerSec = rps * infectedServicesCount
  
  // Bước 2: Tính heapChurnKBPerSec
  
  // Bước 3: Tính alsStoreKBPerSec (mỗi request tốn 0.25 KB cho ALS store)
  
  // Bước 4: Tính savedKBPerSec và trả về { allocatedInstancesPerSec, heapChurnKBPerSec, alsStoreKBPerSec, savedKBPerSec }
}`,
    solution: `function calculateScopeBubblingImpact(
  rps,
  _totalServices,
  infectedServicesCount,
  instanceSizeKB
) {
  const allocatedInstancesPerSec = rps * infectedServicesCount;
  const heapChurnKBPerSec =
    Math.round(allocatedInstancesPerSec * instanceSizeKB * 100) / 100;
  const alsStoreKBPerSec = Math.round(rps * 0.25 * 100) / 100;
  const savedKBPerSec =
    Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100;

  return {
    allocatedInstancesPerSec,
    heapChurnKBPerSec,
    alsStoreKBPerSec,
    savedKBPerSec,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: 2,000 RPS với 10 classes bị lây nhiễm Scope.REQUEST (mỗi class 2 KB)',
        input: [2000, 25, 10, 2],
        expected: {
          allocatedInstancesPerSec: 20000,
          heapChurnKBPerSec: 40000,
          alsStoreKBPerSec: 500,
          savedKBPerSec: 39500
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: 500 RPS với 4 classes bị lây nhiễm (mỗi class 1.5 KB)',
        input: [500, 10, 4, 1.5],
        expected: {
          allocatedInstancesPerSec: 2000,
          heapChurnKBPerSec: 3000,
          alsStoreKBPerSec: 125,
          savedKBPerSec: 2875
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Hệ thống 100% Singleton (0 class bị nhiễm Scope.REQUEST)',
        input: [1000, 15, 0, 3],
        expected: {
          allocatedInstancesPerSec: 0,
          heapChurnKBPerSec: 0,
          alsStoreKBPerSec: 250,
          savedKBPerSec: -250
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Tải cao 5,000 RPS với 12 classes bị lây nhiễm nặng 2.25 KB/instance',
        input: [5000, 20, 12, 2.25],
        expected: {
          allocatedInstancesPerSec: 60000,
          heapChurnKBPerSec: 135000,
          alsStoreKBPerSec: 1250,
          savedKBPerSec: 133750
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Khi rps = 0 (Hệ thống đang nhàn rỗi)',
        input: [0, 10, 5, 2],
        expected: {
          allocatedInstancesPerSec: 0,
          heapChurnKBPerSec: 0,
          alsStoreKBPerSec: 0,
          savedKBPerSec: 0
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      id: 'c4-l3-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Thảm Họa Bộ Nhớ Do Lây Nhiễm Scope.REQUEST (Scope Bubbling Calculator)',
      description: 'Hiện thực hàm `calculateScopeBubblingImpact(rps, totalServices, infectedServicesCount, instanceSizeKB)` để định lượng sự chênh lệch bộ nhớ cấp phát mỗi giây giữa kiến trúc có lây nhiễm `Scope.REQUEST` và kiến trúc chuẩn `100% Singleton + AsyncLocalStorage`.\nQuy tắc:\n1. Với các dịch vụ bị lây nhiễm `Scope.REQUEST` (`infectedServicesCount`): mỗi giây hệ thống phải cấp phát mới `allocatedInstancesPerSec = rps * infectedServicesCount` bản thể trên V8 Young Generation.\n2. Tốc độ xả rác bộ nhớ mỗi giây do `Scope.REQUEST`: `heapChurnKBPerSec = Math.round((allocatedInstancesPerSec * instanceSizeKB) * 100) / 100`.\n3. Nếu chuyển sang dùng `AsyncLocalStorage` (giữ toàn bộ `totalServices` là Singleton, chỉ tạo 1 đối tượng `store` nhỏ nhẹ nặng `0.25 KB` trên mỗi request): dung lượng cấp phát mỗi giây chỉ là `alsStoreKBPerSec = Math.round((rps * 0.25) * 100) / 100`.\n4. Tính lượng bộ nhớ tiết kiệm được mỗi giây: `savedKBPerSec = Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100`.\nTrả về `{ allocatedInstancesPerSec, heapChurnKBPerSec, alsStoreKBPerSec, savedKBPerSec }`.',
      guidedSteps: [
        'Bước 1 (Tính số bản thể bị tạo mới mỗi giây): Tính allocatedInstancesPerSec = rps * infectedServicesCount.',
        'Bước 2 (Tính tốc độ xả rác V8 Heap của Scope.REQUEST): Tính heapChurnKBPerSec = Math.round(allocatedInstancesPerSec * instanceSizeKB * 100) / 100.',
        'Bước 3 (Tính chi phí của AsyncLocalStorage Store): Tính alsStoreKBPerSec = Math.round(rps * 0.25 * 100) / 100.',
        'Bước 4 (Tính dung lượng RAM tiết kiệm được mỗi giây): Tính savedKBPerSec = Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100 và trả về kết quả.'
      ],
      hints: [
        'Lưu ý rằng các dịch vụ giữ được trạng thái Singleton (totalServices - infectedServicesCount) tốn 0 KB cấp phát mới khi xử lý request!',
        'Áp dụng Math.round(val * 100) / 100 cho các phép tính KB để tránh sai số dấu phẩy động.'
      ],
      starterCode: `function calculateScopeBubblingImpact(rps, totalServices, infectedServicesCount, instanceSizeKB) {
  // Bước 1: Tính allocatedInstancesPerSec = rps * infectedServicesCount
  
  // Bước 2: Tính heapChurnKBPerSec
  
  // Bước 3: Tính alsStoreKBPerSec (mỗi request tốn 0.25 KB cho ALS store)
  
  // Bước 4: Tính savedKBPerSec và trả về { allocatedInstancesPerSec, heapChurnKBPerSec, alsStoreKBPerSec, savedKBPerSec }
}`,
      solution: `function calculateScopeBubblingImpact(
  rps,
  _totalServices,
  infectedServicesCount,
  instanceSizeKB
) {
  const allocatedInstancesPerSec = rps * infectedServicesCount;
  const heapChurnKBPerSec =
    Math.round(allocatedInstancesPerSec * instanceSizeKB * 100) / 100;
  const alsStoreKBPerSec = Math.round(rps * 0.25 * 100) / 100;
  const savedKBPerSec =
    Math.round((heapChurnKBPerSec - alsStoreKBPerSec) * 100) / 100;

  return {
    allocatedInstancesPerSec,
    heapChurnKBPerSec,
    alsStoreKBPerSec,
    savedKBPerSec,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: 2,000 RPS với 10 classes bị lây nhiễm Scope.REQUEST (mỗi class 2 KB)',
          input: [2000, 25, 10, 2],
          expected: {
            allocatedInstancesPerSec: 20000,
            heapChurnKBPerSec: 40000,
            alsStoreKBPerSec: 500,
            savedKBPerSec: 39500
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: 500 RPS với 4 classes bị lây nhiễm (mỗi class 1.5 KB)',
          input: [500, 10, 4, 1.5],
          expected: {
            allocatedInstancesPerSec: 2000,
            heapChurnKBPerSec: 3000,
            alsStoreKBPerSec: 125,
            savedKBPerSec: 2875
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Hệ thống 100% Singleton (0 class bị nhiễm Scope.REQUEST)',
          input: [1000, 15, 0, 3],
          expected: {
            allocatedInstancesPerSec: 0,
            heapChurnKBPerSec: 0,
            alsStoreKBPerSec: 250,
            savedKBPerSec: -250
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Tải cao 5,000 RPS với 12 classes bị lây nhiễm nặng 2.25 KB/instance',
          input: [5000, 20, 12, 2.25],
          expected: {
            allocatedInstancesPerSec: 60000,
            heapChurnKBPerSec: 135000,
            alsStoreKBPerSec: 1250,
            savedKBPerSec: 133750
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Khi rps = 0 (Hệ thống đang nhàn rỗi)',
          input: [0, 10, 5, 2],
          expected: {
            allocatedInstancesPerSec: 0,
            heapChurnKBPerSec: 0,
            alsStoreKBPerSec: 0,
            savedKBPerSec: 0
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l3-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Sự Lây Nhiễm Ngược Phạm Vi (Viral Scope Bubbling Simulator)',
      description: 'Hiện thực hàm `simulateScopeBubbling(providers)` để tính toán phạm vi vòng đời thực tế (`effectiveScopes`) của toàn bộ các Provider trong đồ thị sau khi hiệu ứng `Scope Bubbling` lan truyền.\nTham số `providers` là mảng `Array<{ name: string; declaredScope: "DEFAULT" | "TRANSIENT" | "REQUEST"; deps: string[] }>`.\nQuy tắc Lan truyền Ngược (Bubbling Rules):\n1. Nếu một Provider có `declaredScope === "REQUEST"`, thì phạm vi thực tế của nó chắc chắn là `"REQUEST"`.\n2. Nếu một Provider khai báo `"DEFAULT"` hoặc `"TRANSIENT"`, nhưng trong cây phụ thuộc `deps` (trực tiếp hoặc gián tiếp nhiều tầng) của nó có BẤT KỲ một Provider nào mang phạm vi thực tế là `"REQUEST"`, thì nó cũng bị ép biến thành `"REQUEST"`!\n3. Lưu ý quan trọng: `declaredScope === "TRANSIENT"` **KHÔNG** gây lây nhiễm thành `"REQUEST"` (nếu một lớp `"DEFAULT"` phụ thuộc vào lớp `"TRANSIENT"`, lớp `"DEFAULT"` vẫn giữ nguyên là `"DEFAULT"`).\nTrả về `{ effectiveScopes, requestScopedList, bubbledCount }`, trong đó:\n- `effectiveScopes`: Object ánh xạ `name -> phạm vi thực tế ("DEFAULT" | "TRANSIENT" | "REQUEST")`.\n- `requestScopedList`: Mảng tên các Provider có phạm vi thực tế là `"REQUEST"` (giữ theo thứ tự khai báo trong `providers`).\n- `bubbledCount`: Số lượng Provider ban đầu khai báo khác `"REQUEST"` nhưng bị lây nhiễm thành `"REQUEST"`.',
      guidedSteps: [
        'Bước 1 (Lập bảng tra cứu Provider): Đưa các phần tử trong mảng providers vào Map theo khóa name để tra cứu nhanh.',
        'Bước 2 (Viết hàm đệ quy kiểm tra lây nhiễm hasRequestDep(name, visited)): Một node trở thành REQUEST nếu declaredScope === "REQUEST" hoặc bất kỳ dep nào trong node.deps có hasRequestDep(dep) === true.',
        'Bước 3 (Tính toán effectiveScopes cho toàn bộ danh sách): Duyệt qua mảng providers; nếu hasRequestDep(p.name) === true thì gán "REQUEST", ngược lại giữ nguyên p.declaredScope.',
        'Bước 4 (Thống kê requestScopedList và bubbledCount): Đếm số provider có p.declaredScope !== "REQUEST" nhưng effectiveScopes[p.name] === "REQUEST" vào bubbledCount và trả về kết quả.'
      ],
      hints: [
        'Hãy truyền thêm một tập Set visited vào hàm đệ quy hasRequestDep(name, visited) để tránh bị lặp vô hạn nếu đồ thị dữ liệu test có chu trình.',
        'Nhớ phân biệt rõ: bubbledCount chỉ đếm những lớp bị LÂY NHIỄM (tức ban đầu khai báo là DEFAULT hoặc TRANSIENT nhưng bị ép thành REQUEST), không đếm lớp gốc vốn đã khai báo REQUEST.'
      ],
      starterCode: `function simulateScopeBubbling(providers) {
  // Bước 1: Tạo Map tra cứu các provider theo name
  
  // Bước 2: Viết hàm đệ quy kiểm tra xem một provider có phụ thuộc trực tiếp/gián tiếp vào REQUEST scope không
  
  // Bước 3: Xác định effectiveScopes cho từng provider
  
  // Bước 4: Tổng hợp requestScopedList, bubbledCount và trả về { effectiveScopes, requestScopedList, bubbledCount }
}`,
      solution: `function simulateScopeBubbling(providers) {
  const list = Array.isArray(providers) ? providers : [];
  const providerMap = new Map();
  for (const p of list) {
    providerMap.set(p.name, p);
  }

  const memo = new Map();

  function isInfectedWithRequest(name, visiting) {
    if (memo.has(name)) {
      return memo.get(name);
    }
    const node = providerMap.get(name);
    if (!node) {
      return false;
    }
    if (node.declaredScope === 'REQUEST') {
      memo.set(name, true);
      return true;
    }
    if (visiting.has(name)) {
      return false;
    }

    visiting.add(name);
    const deps = Array.isArray(node.deps) ? node.deps : [];
    for (const dep of deps) {
      if (isInfectedWithRequest(dep, visiting)) {
        visiting.delete(name);
        memo.set(name, true);
        return true;
      }
    }
    visiting.delete(name);
    memo.set(name, false);
    return false;
  }

  const effectiveScopes = {};
  const requestScopedList = [];
  let bubbledCount = 0;

  for (const p of list) {
    const isReq = isInfectedWithRequest(p.name, new Set());
    const finalScope = isReq ? 'REQUEST' : p.declaredScope;
    effectiveScopes[p.name] = finalScope;

    if (finalScope === 'REQUEST') {
      requestScopedList.push(p.name);
      if (p.declaredScope !== 'REQUEST') {
        bubbledCount += 1;
      }
    }
  }

  return {
    effectiveScopes,
    requestScopedList,
    bubbledCount,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: 1 Logger ở đáy dùng REQUEST làm lây nhiễm ngược lên Repository, Service và Controller',
          input: [
            [
              { name: 'OrdersController', declaredScope: 'DEFAULT', deps: ['OrdersService'] },
              { name: 'OrdersService', declaredScope: 'DEFAULT', deps: ['OrdersRepo', 'PricingService'] },
              { name: 'PricingService', declaredScope: 'DEFAULT', deps: [] },
              { name: 'OrdersRepo', declaredScope: 'DEFAULT', deps: ['TenantLogger'] },
              { name: 'TenantLogger', declaredScope: 'REQUEST', deps: [] }
            ]
          ],
          expected: {
            effectiveScopes: {
              OrdersController: 'REQUEST',
              OrdersService: 'REQUEST',
              PricingService: 'DEFAULT',
              OrdersRepo: 'REQUEST',
              TenantLogger: 'REQUEST'
            },
            requestScopedList: ['OrdersController', 'OrdersService', 'OrdersRepo', 'TenantLogger'],
            bubbledCount: 3
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Scope.TRANSIENT không gây lây nhiễm lên lớp cha DEFAULT',
          input: [
            [
              { name: 'UsersController', declaredScope: 'DEFAULT', deps: ['UsersService'] },
              { name: 'UsersService', declaredScope: 'DEFAULT', deps: ['TransientHelper'] },
              { name: 'TransientHelper', declaredScope: 'TRANSIENT', deps: [] }
            ]
          ],
          expected: {
            effectiveScopes: {
              UsersController: 'DEFAULT',
              UsersService: 'DEFAULT',
              TransientHelper: 'TRANSIENT'
            },
            requestScopedList: [],
            bubbledCount: 0
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Lớp TRANSIENT nhưng bên dưới lại tiêm một lớp REQUEST -> Cả nhánh bị biến thành REQUEST',
          input: [
            [
              { name: 'PaymentService', declaredScope: 'DEFAULT', deps: ['AuditAdapter'] },
              { name: 'AuditAdapter', declaredScope: 'TRANSIENT', deps: ['RequestContext'] },
              { name: 'RequestContext', declaredScope: 'REQUEST', deps: [] }
            ]
          ],
          expected: {
            effectiveScopes: {
              PaymentService: 'REQUEST',
              AuditAdapter: 'REQUEST',
              RequestContext: 'REQUEST'
            },
            requestScopedList: ['PaymentService', 'AuditAdapter', 'RequestContext'],
            bubbledCount: 2
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Hai nhánh độc lập, chỉ nhánh có REQUEST bị lây nhiễm',
          input: [
            [
              { name: 'HealthController', declaredScope: 'DEFAULT', deps: ['PingService'] },
              { name: 'PingService', declaredScope: 'DEFAULT', deps: [] },
              { name: 'ProfileController', declaredScope: 'DEFAULT', deps: ['ReqUserExtractor'] },
              { name: 'ReqUserExtractor', declaredScope: 'REQUEST', deps: [] }
            ]
          ],
          expected: {
            effectiveScopes: {
              HealthController: 'DEFAULT',
              PingService: 'DEFAULT',
              ProfileController: 'REQUEST',
              ReqUserExtractor: 'REQUEST'
            },
            requestScopedList: ['ProfileController', 'ReqUserExtractor'],
            bubbledCount: 1
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Danh sách rỗng -> Trả về kết quả mặc định an toàn',
          input: [[]],
          expected: {
            effectiveScopes: {},
            requestScopedList: [],
            bubbledCount: 0
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l3-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Bộ Phát Hiện Chu Trình & Sắp Xếp Tô-Pô Đồ Thị DAG (Topological Sort & Cycle Detector)',
      description: 'Hiện thực hàm `buildModuleBootstrapPlan(graph)` nhận vào đồ thị phụ thuộc `graph: Record<string, string[]>` (trong đó khóa là tên Module/Provider và giá trị là mảng các Module/Provider mà nó phụ thuộc vào) để lập thứ tự khởi tạo tuần tự chuẩn `NestContainer`.\nRàng buộc Phòng thủ (Defensive Guards):\n1. Nếu `!graph` hoặc `typeof graph !== "object"` hoặc `Array.isArray(graph)` hoặc `Object.keys(graph).length === 0`, chủ động `throw new Error("EMPTY_OR_INVALID_DEPENDENCY_GRAPH")`.\n2. Nếu bất kỳ phụ thuộc con nào trong mảng `graph[node]` chưa được khai báo làm khóa trong `graph`, chủ động `throw new Error("UNREGISTERED_DEPENDENCY_NODE")`.\n3. Nếu phát hiện đồ thị có chu trình khép kín (Circular Dependency, bao gồm cả tự phụ thuộc vào chính mình `A -> A` hoặc chu trình nhiều bước `A -> B -> C -> A`), chủ động `throw new Error("CIRCULAR_DEPENDENCY_DETECTED")`.\nQuy tắc Sắp xếp Tô-pô (DFS Post-Order):\n- Duyệt qua các khóa của `Object.keys(graph)` theo đúng thứ tự xuất hiện; với mỗi đỉnh, đệ quy khởi tạo toàn bộ các phụ thuộc trong `graph[node]` của nó trước rồi mới đẩy `node` vào mảng `bootstrapOrder`.\n- Trả về `{ bootstrapOrder, leafNodes, totalNodes: bootstrapOrder.length }`, trong đó `leafNodes` là danh sách các đỉnh có `graph[node].length === 0`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra tính hợp lệ của đồ thị): Nếu !graph || typeof graph !== "object" || Array.isArray(graph) || Object.keys(graph).length === 0, throw new Error("EMPTY_OR_INVALID_DEPENDENCY_GRAPH").',
        'Bước 2 (Kiểm tra mọi phụ thuộc đều tồn tại trong graph): Duyệt mọi neighbor trong graph[node]; nếu !(neighbor in graph) thì throw new Error("UNREGISTERED_DEPENDENCY_NODE").',
        'Bước 3 (Thực thi DFS 3 màu phát hiện chu trình & sắp xếp Post-Order): Dùng tập visiting (GRAY) và visited (BLACK). Trong visit(node): nếu visiting.has(node) -> throw new Error("CIRCULAR_DEPENDENCY_DETECTED"). Nếu chưa visited -> đánh dấu visiting, gọi đệ quy visit(dep) cho từng dep, bỏ visiting, thêm vào visited và đẩy node vào bootstrapOrder.',
        'Bước 4 (Trích xuất leafNodes và hoàn trả kết quả): Lọc các khóa có graph[k].length === 0 vào leafNodes và trả về { bootstrapOrder, leafNodes, totalNodes: bootstrapOrder.length }.'
      ],
      hints: [
        'Hãy thực hiện bước kiểm tra UNREGISTERED_DEPENDENCY_NODE trên toàn bộ đồ thị hoặc ngay khi bắt đầu duyệt cạnh để không bỏ sót các đỉnh chưa đăng ký.',
        'Trong DFS Post-Order, lệnh bootstrapOrder.push(node) luôn nằm SAU vòng lặp for (const dep of graph[node]) { visit(dep); }, đảm bảo mọi dependency đều đứng trước lớp tiêu thụ nó.'
      ],
      starterCode: `function buildModuleBootstrapPlan(graph) {
  // Bước 1: Kiểm tra đồ thị hợp lệ ("EMPTY_OR_INVALID_DEPENDENCY_GRAPH")
  
  // Bước 2: Kiểm tra mọi node phụ thuộc đều đã được đăng ký làm khóa trong graph ("UNREGISTERED_DEPENDENCY_NODE")
  
  // Bước 3: Duyệt DFS phát hiện chu trình ("CIRCULAR_DEPENDENCY_DETECTED") và thu thập bootstrapOrder
  
  // Bước 4: Trả về { bootstrapOrder, leafNodes, totalNodes }
}`,
      solution: `function buildModuleBootstrapPlan(graph) {
  if (
    !graph ||
    typeof graph !== 'object' ||
    Array.isArray(graph) ||
    Object.keys(graph).length === 0
  ) {
    throw new Error('EMPTY_OR_INVALID_DEPENDENCY_GRAPH');
  }

  const keys = Object.keys(graph);
  const keySet = new Set(keys);
  const leafNodes = [];

  for (const node of keys) {
    const deps = graph[node];
    if (!Array.isArray(deps)) {
      throw new Error('EMPTY_OR_INVALID_DEPENDENCY_GRAPH');
    }
    if (deps.length === 0) {
      leafNodes.push(node);
    }
    for (const dep of deps) {
      if (!keySet.has(dep)) {
        throw new Error('UNREGISTERED_DEPENDENCY_NODE');
      }
    }
  }

  const visited = new Set();
  const visiting = new Set();
  const bootstrapOrder = [];

  function dfs(node) {
    if (visiting.has(node)) {
      throw new Error('CIRCULAR_DEPENDENCY_DETECTED');
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    for (const dep of graph[node]) {
      dfs(dep);
    }
    visiting.delete(node);
    visited.add(node);
    bootstrapOrder.push(node);
  }

  for (const node of keys) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return {
    bootstrapOrder,
    leafNodes,
    totalNodes: bootstrapOrder.length,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Sắp xếp Tô-pô chuẩn xác cho đồ thị DAG nhiều tầng (Config & Logger -> Database -> Users -> App)',
          input: [
            {
              AppModule: ['UsersModule', 'OrdersModule'],
              UsersModule: ['DatabaseModule'],
              OrdersModule: ['DatabaseModule', 'UsersModule'],
              DatabaseModule: ['ConfigModule', 'LoggerModule'],
              ConfigModule: [],
              LoggerModule: []
            }
          ],
          expected: {
            bootstrapOrder: [
              'ConfigModule',
              'LoggerModule',
              'DatabaseModule',
              'UsersModule',
              'OrdersModule',
              'AppModule'
            ],
            leafNodes: ['ConfigModule', 'LoggerModule'],
            totalNodes: 6
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Ném lỗi CIRCULAR_DEPENDENCY_DETECTED khi phát hiện chu trình tam giác (A -> B -> C -> A)',
          input: [
            {
              ServiceA: ['ServiceB'],
              ServiceB: ['ServiceC'],
              ServiceC: ['ServiceA']
            }
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 3 công khai: Ném lỗi UNREGISTERED_DEPENDENCY_NODE khi phụ thuộc vào một Module chưa đăng ký',
          input: [
            {
              OrdersModule: ['GhostPaymentModule']
            }
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ném lỗi CIRCULAR_DEPENDENCY_DETECTED khi một Service tự phụ thuộc vào chính nó (Self-Loop)',
          input: [
            {
              SelfService: ['SelfService']
            }
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Ném lỗi EMPTY_OR_INVALID_DEPENDENCY_GRAPH khi truyền vào đồ thị rỗng {}',
          input: [{}],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
