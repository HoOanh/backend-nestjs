import type { Lesson } from '../types.ts';

export const c3_l2: Lesson = {
  id: 'c3-l2',
  title: 'Bài 02: HTTP Semantics Thực Chiến: Idempotency Keys, Connection Keep-Alive & Safe Methods',
  duration: '60 phút',
  tag: 'HTTP Protocols & Idempotency',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Ngữ nghĩa Giao thức HTTP (RFC 9110 HTTP Semantics) và Kiến trúc Đảm bảo Tính Lũy đẳng Phân tán (Distributed Idempotency Engineering) từ lý thuyết Bài toán Hai Vị Tướng (Two-Generals Paradox) đến cơ chế Khóa Nguyên tử Redis và Tinh chỉnh Thời hạn Kết nối Keep-Alive cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Ngữ nghĩa Phương thức HTTP theo Chuẩn RFC 9110 (\`Safe\`, \`Idempotent\`, \`Cacheable\`) và Nghịch lý Mập mờ Trạng thái Mạng:** Hiểu rõ bản chất toán học của tính lũy đẳng $f(f(x)) = f(x)$, phân biệt sự bất biến trạng thái máy chủ với mã phản hồi HTTP (giải thích vì sao \`DELETE\` trả về \`200\` rồi \`404\` vẫn là \`Idempotent\`, còn \`PATCH\` thường là \`Non-Idempotent\`), và cơ chế phát sinh thảm họa **Trừ tiền Kép (\`Double Billing\`)** khi Client tự động thử lại (\`Retry\`) sau lỗi \`504 Gateway Timeout\` hoặc \`ECONNRESET\`.
> 2. **Kiến trúc Máy Trạng thái Khóa Lũy đẳng (\`Idempotency Key State Machine\`), Khóa Nguyên tử Redis (\`SET NX EX\`) và Băm Toàn vẹn \`SHA-256\`:** Làm chủ quy trình 3 pha (\`STARTED / PROCESSING\` $\rightarrow$ \`COMPLETED\` / \`FAILED_UNLOCK\`), xử lý triệt để các kịch bản biên nguy hiểm gồm **Đua tranh Đồng thời (\`Concurrent In-Flight Race Condition — HTTP 409 Conflict\`)**, **Giả mạo Tải trọng (\`Payload Mismatch Tampering — HTTP 422 Unprocessable Entity\`)** và **Khóa Xác sống (\`Zombie Lock\` khi Pod sập giữa chừng)**.
> 3. **Triển khai \`IdempotencyInterceptor\` trong NestJS và Giải quyết Đua tranh Đóng Kết nối Keep-Alive (\`502 Bad Gateway Race Condition\`):** Phân tích nguyên nhân vật lý khiến xung đột giữa \`keepAliveTimeout\` của Node.js và \`idle_timeout\` của AWS ALB / Nginx sinh ra lỗi \`502 Bad Gateway\` ngẫu nhiên trên Production; thiết lập bất đẳng thức cấu hình chuẩn **\`headersTimeout > keepAliveTimeout > LoadBalancer_IdleTimeout\`**.

---

# 1. NGỮ NGHĨA GIAO THỨC HTTP THEO CHUẨN RFC 9110: TÍNH AN TOÀN (SAFE), LŨY ĐẲNG (IDEMPOTENT) VÀ NGHỊCH LÝ HAI VỊ TƯỚNG

### 1.1 Khái niệm nền tảng: Bài toán Hai Vị Tướng (Two-Generals Paradox) và Sự Mập mờ Trạng thái khi Timeout Mạng

Trong Khoa học Máy tính và Hệ thống Phân tán, **Bài toán Hai Vị Tướng (\`Two-Generals Paradox\`)** chứng minh một định lý bất khả thi nền tảng: *Trên một kênh truyền thông tin không đáng tin cậy (có thể mất gói tin), không tồn tại bất kỳ giao thức hữu hạn bước nào giúp hai bên đạt được sự đồng thuận chắc chắn 100% mà không có rủi ro sai lệch trạng thái*.

Khi áp dụng vào giao tiếp giữa Ứng dụng Khách (\`Mobile App / Frontend / API Gateway\`) và Máy chủ Backend NestJS qua mạng Internet, định lý này biểu hiện trực tiếp qua **Sự Mập mờ Trạng thái Khi Đứt Kết nối (\`Network Timeout State Ambiguity\`)**:
1. **Ba Điểm Đứt gãy Vật lý của Một Yêu cầu HTTP:**
   Khi Client gửi một lệnh thanh toán \`POST /api/v1/payments\` để trừ \`5,000,000 VNĐ\` và sau \`5,000 ms\` nhận về lỗi \`ETIMEDOUT\` hoặc \`Socket Hang Up\`, đứng ở góc độ của Client, không có cách nào phân biệt được gói tin đã chết ở giai đoạn nào trong 3 giai đoạn sau:
   - **Trường hợp A — Chết trên Đường đi (\`Upstream Request Dropped\`):** Gói tin bị rớt tại bộ định tuyến trước khi chạm tới máy chủ NestJS. Máy chủ **chưa hề biết** có giao dịch này (Tiền chưa bị trừ $\rightarrow$ **Cần phải gửi lại / Retry**).
   - **Trường hợp B — Chết khi Đang Xử lý (\`In-Flight Server Crash\`):** Máy chủ vừa bắt đầu mở giao dịch Database thì bị quá tải hoặc khởi động lại. Giao dịch Database tự động \`Rollback\` (Tiền chưa bị trừ $\rightarrow$ **Có thể gửi lại sau khi máy chủ hồi phục**).
   - **Trường hợp C — Chết trên Đường về (\`Downstream Response Dropped\`):** Máy chủ NestJS đã gọi cổng thanh toán thành công, đã \`COMMIT\` trừ \`5,000,000 VNĐ\` vào Database và gửi gói tin \`HTTP 200 OK\` trả về, nhưng đúng lúc đó mạng Wifi của điện thoại bị rớt 1 giây khiến gói tin phản hồi bị mất! Nếu lúc này Client (hoặc thư viện Axios/Envoy Proxy) tự động thực hiện **Thử lại (\`Automatic Retry\`)** mà API không có cơ chế chống trùng lặp, máy chủ sẽ coi đó là một giao dịch mới hoàn toàn và **trừ tiếp \`5,000,000 VNĐ\` lần thứ hai (\`Double Billing Disaster\`)**!
2. **Định nghĩa Toán học của Tính Lũy đẳng (\`Idempotence\`):**
   Trong đại số và thiết kế hệ thống, một phép toán $f$ được gọi là **Lũy đẳng (\`Idempotent\`)** nếu việc áp dụng phép toán đó nhiều lần liên tiếp lên cùng một đầu vào luôn tạo ra **trạng thái hệ thống cuối cùng giống hệt như khi chỉ áp dụng một lần duy nhất**:
   $$f(f(\\dots f(S_0, x)\\dots)) = f(S_0, x)$$
   Lưu ý cực kỳ quan trọng theo chuẩn **\`RFC 9110 (Section 9.2.2)\`**: Tính lũy đẳng chỉ đánh giá trên **tác động làm thay đổi trạng thái dữ liệu tại máy chủ (\`Server-Side State Side Effects\`)**, hoàn toàn **không yêu cầu mã trạng thái HTTP phản hồi (\`HTTP Status Code\`) của các lần gọi sau phải giống hệt lần gọi đầu**!

### 1.2 Ma trận Phân loại Phương thức HTTP theo Chuẩn RFC 9110: Safe, Idempotent và Cacheable

Bảng dưới đây chuẩn hóa ngữ nghĩa kỹ thuật của 6 phương thức HTTP cốt lõi theo đặc tả \`RFC 9110\` và quy tắc xử lý thử lại tự động tại các tầng trung gian (API Gateway, Service Mesh Envoy, Browser):

| Phương thức HTTP | Tính An toàn (\`Safe / Read-Only\`) | Tính Lũy đẳng (\`Idempotent\`) | Cho phép Tự động Retry khi Timeout? | Phân tích Ngữ nghĩa Trạng thái Máy chủ & Trường hợp Biên |
| :--- | :--- | :--- | :--- | :--- |
| **\`GET\` / \`HEAD\` / \`OPTIONS\`** | **CÓ** (Chỉ đọc) | **CÓ** ($N$ lần gọi = 1 lần) | **Luôn an toàn** (Mặc định bật ở mọi Proxy/CDN) | Không được phép làm thay đổi bất kỳ bản ghi nghiệp vụ nào trên máy chủ |
| **\`PUT\`** (Thay thế Toàn bộ) | **KHÔNG** | **CÓ** (Theo chuẩn RFC) | **An toàn** (Nếu cài đặt đúng chuẩn ghi đè) | Thay thế toàn bộ biểu diễn của tài nguyên tại URI xác định (\`SET title="A", price=10\`); gọi 10 lần thì bản ghi vẫn mang đúng giá trị đó |
| **\`DELETE\`** (Xóa Tài nguyên) | **KHÔNG** | **CÓ** (Theo chuẩn RFC) | **An toàn** về mặt trạng thái dữ liệu | Lần 1 xóa bản ghi trả về \`200 OK\` / \`204 No Content\`; lần 2 gọi lại trả về \`404 Not Found\`, nhưng trạng thái DB vẫn bất biến (bản ghi đã biến mất!) |
| **\`POST\`** (Tạo mới / Xử lý) | **KHÔNG** | **KHÔNG** (Mặc định) | **CẤM TỰ ĐỘNG RETRY** nếu không có \`Idempotency-Key\` | Mỗi lần gọi \`POST /orders\` sẽ sinh ra một bản ghi mới với ID mới và trừ kho/trừ tiền thêm một lần nữa |
| **\`PATCH\`** (Cập nhật Từng phần) | **KHÔNG** | **KHÔNG** (Theo chuẩn RFC) | **CẤM TỰ ĐỘNG RETRY** nếu không có \`Idempotency-Key\` | Nếu payload là phép toán tương đối như \`{ "$inc": { "balance": -100 } }\` hoặc \`JSON Patch\`, gọi $N$ lần sẽ trừ tiền $N$ lần! |

### 1.3 Thảm họa Trừ tiền Kép (Double Billing) khi Retry Mù quáng và Đối chiếu Thiết kế API Đột biến Trạng thái

Tại sao ngay cả với các phương thức như \`PUT\` hay \`PATCH\` trong thực tế lập trình SQL, việc thiếu khóa định danh giao dịch hoặc điều kiện kiểm tra phiên bản vẫn dẫn đến sai lệch dữ liệu? Hãy đối chiếu hai đoạn mã xử lý ví điện tử dưới đây:

\`\`\`typescript
// File: src/modules/wallet/wallet-mutation-semantics.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Dùng phép cộng/trừ tương đối không có khóa lũy đẳng hoặc kiểm tra trạng thái
import { Injectable, ConflictException } from '@nestjs/common';

export interface WalletAccount {
  readonly accountId: string;
  balanceVnd: number;
  version: number;
}

@Injectable()
export class NonIdempotentWalletBrokenService {
  private readonly accounts = new Map<string, WalletAccount>();

  // LỖI NGHIÊM TRỌNG: Phép toán trừ tương đối (balance -= amount) KHÔNG CÓ TÍNH LŨY ĐẲNG!
  // Nếu lần gọi đầu tiên đã trừ tiền xong nhưng gói tin HTTP Response bị rớt trên mạng,
  // khi Client hoặc API Gateway tự động Retry lần 2, hàm này sẽ trừ tiền khách hàng thêm một lần nữa!
  deductBalanceUnsafe(accountId: string, amountVnd: number): WalletAccount {
    const acc = this.accounts.get(accountId);
    if (!acc || acc.balanceVnd < amountVnd) {
      throw new ConflictException('INSUFFICIENT_BALANCE');
    }
    acc.balanceVnd -= amountVnd;
    acc.version += 1;
    return acc;
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION IDEMPOTENT MUTATION): Gắn liền mỗi biến động số dư với Transaction Reference duy nhất
@Injectable()
export class IdempotentWalletSafeService {
  private readonly accounts = new Map<string, WalletAccount>();
  private readonly processedLedger = new Map<string, { accountId: string; amountVnd: number; resultingBalance: number }>();

  deductBalanceIdempotent(
    idempotencyKey: string,
    accountId: string,
    amountVnd: number,
  ): { isDuplicateReplay: boolean; resultingBalance: number } {
    // Nếu khóa giao dịch đã từng được xử lý thành công, trả về ngay kết quả cũ (f(f(x)) = f(x))
    const existingEntry = this.processedLedger.get(idempotencyKey);
    if (existingEntry) {
      return {
        isDuplicateReplay: true,
        resultingBalance: existingEntry.resultingBalance,
      };
    }

    const acc = this.accounts.get(accountId);
    if (!acc || acc.balanceVnd < amountVnd) {
      throw new ConflictException('INSUFFICIENT_BALANCE');
    }

    acc.balanceVnd -= amountVnd;
    acc.version += 1;
    this.processedLedger.set(idempotencyKey, {
      accountId,
      amountVnd,
      resultingBalance: acc.balanceVnd,
    });

    return {
      isDuplicateReplay: false,
      resultingBalance: acc.balanceVnd,
    };
  }
}
\`\`\`

Để thấy rõ cách một sự cố đứt kết nối mạng nhỏ biến thành thảm họa tài chính và cách \`Idempotency-Key\` cứu nguy cho hệ thống, hãy theo dõi bảng truy vết thực thi theo từng mốc mili-giây dưới đây:

| Mốc thời gian | Luồng / Yêu cầu HTTP | Thao tác tại Tầng Mạng & Backend NestJS | Trạng thái Kho Khóa Redis & Database | Hệ quả Nghiệp vụ Thực tế |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **Attempt #1** (\`POST /pay\`, \`Key: K1\`) | Client gửi lệnh thanh toán \`500,000đ\` kèm Header \`Idempotency-Key: K1\` | Redis chưa có \`K1\`; lệnh \`SET K1 "PROCESSING" NX EX 60\` thành công | Chiếm khóa thực thi độc quyền cho giao dịch \`K1\` |
| **\`t = 45 ms\`** | **Attempt #1** (Thực thi DB & Cổng TT) | Backend trừ \`500,000đ\` trong PostgreSQL (Số dư còn \`1,500,000đ\`), lưu kết quả vào Redis \`K1\` | DB: \`balance = 1,500,000đ\`; Redis \`K1 = COMPLETED { bal: 1500000 }\` | Giao dịch hoàn tất 100% tại phía Server |
| **\`t = 50 ms\`** | **Attempt #1** (Sự cố đứt mạng đường về) | Server gửi gói \`HTTP 200 OK\` về nhưng người dùng đi vào thang máy mất sóng 4G | Gói tin TCP Response bị rớt trên đường truyền vô tuyến | Client không nhận được phản hồi và báo lỗi \`Timeout\` |
| **\`t = 2,050 ms\`** | **Attempt #2 (Retry)** (\`POST /pay\`, \`Key: K1\`) | App tự động thử lại yêu cầu thanh toán với **đúng mã \`Idempotency-Key: K1\` cũ** | \`IdempotencyInterceptor\` tra cứu Redis thấy \`K1\` đã ở trạng thái \`COMPLETED\` | **Chặn đứng việc gọi lại Service/Database!** |
| **\`t = 2,052 ms\`** | **Attempt #2 (Hoàn tất An toàn)** | Backend lấy nguyên vẹn JSON \`{ bal: 1500000 }\` từ Redis trả về ngay lập tức sau \`2 ms\` | DB giữ nguyên \`1,500,000đ\` (Không bị trừ thêm \`500,000đ\` lần 2!) | Khách hàng nhận biên lai thành công, an toàn tuyệt đối |

### 1.4 Định lượng Khoảng chờ Thử lại (Exponential Backoff with Full Jitter) và Công thức Tính Hệ số Khuếch đại Tải

Khi Client cần thực hiện thử lại (\`Retry\`) một yêu cầu có đính kèm \`Idempotency-Key\`, tuyệt đối không được thử lại ngay lập tức (\`Immediate Retry Loop\`) vì sẽ gây ra hiện tượng **Bão Thử lại Đồng pha (\`Synchronized Retry Storm\`)** đập sập máy chủ vừa mới hồi phục. Chuẩn kiến trúc AWS và Google SRE quy định phải dùng thuật toán **Lùi Mũ kèm Nhiễu Ngẫu nhiên Toàn phần (\`Exponential Backoff with Full Jitter\`)**:

\`\`\`
Khoảng chờ lũy thừa cơ sở ở lần thử thứ k (Exponential_Cap_Ms) = min(Max_Backoff_Ms, Base_Delay_Ms × (2 ^ Attempt_Index))
Khoảng chờ thực tế có nhiễu ngẫu nhiên (Full_Jitter_Sleep_Ms) = random_uniform(0, Exponential_Cap_Ms)
Hệ số khuếch đại lưu lượng do thử lại (Retry_Amplification_Factor) = 1 / (1 - Failure_Rate) (Khi Retry vô hạn)
Ví dụ định lượng: Với Base_Delay = 100 ms, Max_Backoff = 10,000 ms, ở lần thử lại thứ 3 (Attempt_Index = 3):
-> Exponential_Cap_Ms = min(10000, 100 × (2^3)) = 800 ms -> Client lấy ngẫu nhiên từ [0 ms .. 800 ms] để rải đều tải!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc thiết kế Retry và Idempotency):**
> 1. **Không bao giờ Retry nếu chưa có Idempotency:** Mọi cơ chế tự động thử lại (\`Retry Interceptor\`) ở tầng Frontend, Mobile SDK hay API Gateway chỉ được phép kích hoạt cho các phương thức \`Safe / Idempotent\` tự nhiên (\`GET\`, \`HEAD\`, \`PUT\`, \`DELETE\`) hoặc các phương thức \`POST / PATCH\` đã đính kèm bắt buộc **\`Idempotency-Key\` (UUIDv4/v7 do chính Client sinh ra trước lần gửi đầu tiên)**.
> 2. **Lưu ý lỗi kinh điển khi sinh \`Idempotency-Key\`:** Mã \`UUID\` của \`Idempotency-Key\` bắt buộc phải được tạo ra và gắn với hành động nghiệp vụ (ví dụ khi người dùng bấm nút *"Thanh toán"* hoặc gắn với \`orderId + step\`), **tuyệt đối không được sinh \`uuidv4()\` mới bên trong hàm \`axios.interceptors.request\` chạy lại ở mỗi lần Retry** (vì nếu mỗi lần Retry lại sinh ra một UUID mới thì khóa lũy đẳng hoàn toàn vô tác dụng!).

---

# 2. KIẾN TRÚC KHÓA LŨY ĐẲNG PHÂN TÁN (IDEMPOTENCY KEY STATE MACHINE), REDIS ATOMIC LOCK VÀ BĂM TOÀN VẸN SHA-256

### 2.1 Máy trạng thái Hữu hạn của Khóa Lũy đẳng (Idempotency State Machine) và Nguyên lý Khóa Nguyên tử Redis SET NX EX

Trên hệ thống Backend chạy phân tán với hàng chục Pod Kubernetes đứng sau Load Balancer, hai yêu cầu mang cùng một \`Idempotency-Key\` có thể rơi vào hai Pod vật lý khác nhau ở cùng một mili-giây. Do đó, bạn không thể lưu khóa trong bộ nhớ RAM cục bộ (\`new Map()\`) của từng Pod, mà phải xây dựng một **Máy Trạng thái Hữu hạn Tập trung (\`Distributed Idempotency State Machine\`)** trên cụm bộ nhớ **\`Redis\`** kết hợp ràng buộc duy nhất (\`UNIQUE Constraint\`) trong cơ sở dữ liệu:

1. **Tại sao bắt buộc phải dùng lệnh nguyên tử \`SET key value NX EX ttl\` thay vì gọi \`GET\` rồi mới gọi \`SET\`?**
   Nếu lập trình viên viết hai lệnh tách rời: \`const val = await redis.get(key); if (!val) await redis.set(key, 'PROCESSING');\`, đây là lỗ hổng **\`TOCTOU Race Condition (Time-Of-Check to Time-Of-Use)\`** kinh điển!
   - Khi người dùng vô tình bấm đúp nút *"Chuyển tiền"* (\`Double-Click\`) tạo ra 2 HTTP Request cách nhau \`0.2 ms\`, cả Pod A và Pod B cùng chạy lệnh \`redis.get(key)\` tại một thời điểm và **cùng nhận được kết quả \`null\`**! Cả hai Pod đều tưởng mình là người đầu tiên và cùng đi tiếp vào phần trừ tiền!
   - Ngược lại, Redis thực thi các lệnh trên một luồng đơn nguyên tử (\`Single-Threaded Atomic Execution\`). Khi dùng lệnh hợp nhất **\`SET idemp:<key> <json_state> NX EX 90\`** (trong đó **\`NX\` = \`Not eXists\`** chỉ ghi khi khóa chưa tồn tại, và **\`EX 90\`** đặt thời gian tự hủy 90 giây ngay trong cùng 1 lệnh), Redis đảm bảo 100% chỉ có **duy nhất 1 Pod** nhận được phản hồi \`"OK"\`, còn Pod đến chậm hơn dù chỉ 1 nano-giây sẽ nhận về \`null\` và bị chặn lại ngay lập tức!
2. **Ba Trạng thái Vòng đời của Một Khóa Lũy đẳng Chuẩn Công nghiệp (Stripe Idempotency Pattern):**
   - **Pha 1 (\`IN_PROGRESS / PROCESSING\`):** Khóa vừa được chiếm giữ nguyên tử bằng \`SET ... NX EX 90\`. Thời gian sống ngắn (\`60s – 120s\`) đóng vai trò là **Hợp đồng Thuê Khóa (\`Lock Lease TTL\`)** phòng trường hợp Pod đang xử lý bị mất điện hoặc \`OOMKilled\` thì khóa sẽ tự giải phóng sau 90 giây chứ không bị kẹt vĩnh viễn (**Chống \`Zombie Lock\`**).
   - **Pha 2 (\`COMPLETED\`):** Khi Controller và Database Transaction hoàn tất thành công, Interceptor ghi đè bản ghi Redis bằng trạng thái \`COMPLETED\`, đính kèm **Mã trạng thái HTTP (\`statusCode\`)**, **Tiêu đề phản hồi**, **Nội dung JSON phản hồi (\`responseBody\`)** và gia hạn thời gian sống lên **\`TTL = 86,400 giây (24 giờ)\`** để phục vụ mọi đợt Retry muộn.
   - **Pha 3 (\`FAILED_RETRYABLE\` vs \`FAILED_TERMINAL\`):** Nếu quá trình xử lý gặp lỗi hạ tầng tạm thời (như \`Database Connection Timeout\` hoặc lỗi \`5xx\` từ cổng thanh toán), Interceptor phải **xóa ngay khóa (\`DEL idemp:<key>\`)** để lần Retry tiếp theo của Client được phép chạy lại. Ngược lại, nếu lỗi thuộc về logic dữ liệu không thể sửa đổi (như số dư không đủ \`400/422\`), có thể lưu kết quả lỗi đó hoặc giải phóng khóa tùy theo quy ước nghiệp vụ.

### 2.2 Đối chiếu các Chiến lược Đảm bảo Tính Lũy đẳng trong Hệ thống Phân tán

Bảng dưới đây đối chiếu 4 kiến trúc triển khai tính lũy đẳng phổ biến từ đơn giản đến cấp độ Ngân hàng/Fintech:

| Chiến lược Triển khai | Công nghệ & Cơ chế Cốt lõi | Khả năng Chống Đua tranh Đồng thời (\`Race Condition\`) | Khả năng Hoàn trả Nguyên vẹn Response Cũ | Đánh đổi Hiệu năng & Phạm vi Áp dụng Chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`In-Memory Map\` Cục bộ** | \`Map<string, Record>\` trong RAM của từng tiến trình Node.js | **Kém (0% trên Multi-Pod)**: Hai request rơi vào 2 Pod khác nhau sẽ lọt lưới hoàn toàn | Có (Nhưng mất sạch khi Pod khởi động lại hoặc mở rộng quy mô) | Độ trễ \`0.001 ms\`; **chỉ dùng cho môi trường thử nghiệm hoặc Single-Instance** |
| **2. \`Database Unique Index\`** | Cột \`idempotency_key UNIQUE\` trong bảng \`orders / transactions\` | **Tuyệt đối (100% ACID)**: Ràng buộc mức đĩa của PostgreSQL/MySQL chặn mọi bản ghi trùng | **Hạn chế**: Bắt được lỗi \`23505 Unique Violation\` nhưng phải viết thêm câu truy vấn đọc lại bản ghi cũ | Độ trễ \`2 ms – 8 ms\`; là **Chốt chặn Cuối cùng Bắt buộc (\`Last Line of Defense\`)** dưới tầng DB |
| **3. \`Redis Atomic SET NX EX\`** | Lệnh nguyên tử \`SET NX EX\` hoặc \`Lua Script\` tại tầng API Gateway / Interceptor | **Rất cao (Cấp độ cụm Redis)**: Chặn đứng request trùng ngay tại cửa ngõ trước khi chạm tới DB | **Hoàn hảo**: Lưu trọn vẹn \`{ statusCode, headers, body }\` với TTL 24 giờ | Độ trễ **\`~0.5 ms – 1.5 ms\`**; giảm tải tuyệt đối cho Database khi xảy ra bão Retry |
| **4. \`Hybrid Redis + DB Outbox\`** | Kết hợp khóa nhanh \`Redis SET NX\` ở tầng ngoài và \`UNIQUE Constraint\` trong cùng DB Transaction | **Tuyệt đối ở cả 2 tầng** (Ngay cả khi cụm Redis bị sập hoặc chuyển đổi dự phòng Failover) | **Hoàn hảo**: Tự động phục hồi Cache từ bảng \`idempotency_records\` của DB nếu Redis mất dữ liệu | Chuẩn mực vàng (**Golden Standard**) cho hệ thống Thanh toán, Ví điện tử và Ngân hàng lõi |

### 2.3 Xử lý 3 Kịch bản Biên Nguy hiểm: Concurrent In-flight (HTTP 409), Payload Tampering (HTTP 422) và Zombie Lock Recovery

Một hệ thống \`Idempotency\` sơ sài chỉ kiểm tra xem khóa đã có trong Redis hay chưa sẽ lập tức bị đánh bại bởi 3 kịch bản biên thực tế sau:

1. **Kịch bản Biên 1 — Đua tranh Đang bay (\`Concurrent In-Flight Request\` $\rightarrow$ Trả về \`HTTP 409 Conflict\`):**
   Khi Request #1 (mang khóa \`K1\`) đang chờ cổng thanh toán ngân hàng phản hồi (mất \`3 giây\`), ở giây thứ 1 người dùng sốt ruột bấm gửi lại Request #2 (cũng mang khóa \`K1\`).
   - Lúc này khóa \`K1\` trong Redis đang ở trạng thái **\`PROCESSING\`** (chưa có kết quả \`responseBody\` để trả về!).
   - Hệ thống tuyệt đối không được cho Request #2 chạy song song, cũng không thể trả về kết quả rỗng, mà phải lập tức ném mã lỗi **\`HTTP 409 Conflict\`** kèm tiêu đề **\`Retry-After: 2\`** để báo cho Client biết: *"Giao dịch gốc đang được xử lý, vui lòng chờ và thử lại sau 2 giây"*.
2. **Kịch bản Biên 2 — Tấn công Tráo đổi Nội dung (\`Payload Mismatch / Parameter Tampering\` $\rightarrow$ Trả về \`HTTP 422 Unprocessable Entity\`):**
   Giả sử do lỗi lập trình ở Frontend hoặc do kẻ tấn công cố tình dùng lại mã \`Idempotency-Key: K1\` của một giao dịch cũ, nhưng sửa đổi nội dung \`Request Body\` từ \`{ amount: 10000, to: "user_A" }\` thành \`{ amount: 99000000, to: "hacker_B" }\`.
   - Nếu Backend chỉ kiểm tra tên khóa \`K1\` mà không kiểm tra nội dung đi kèm, nó sẽ trả về kết quả của giao dịch cũ hoặc gây nhầm lẫn nghiêm trọng trong nhật ký đối soát!
   - **Giải pháp bắt buộc:** Ngay khi nhận request, Backend phải tính **Mã băm Mật mã \`SHA-256\` (\`Request Fingerprint\`)** trên tổ hợp \`Method + Path + Canonical_JSON(Body)\` và lưu mã băm \`requestHash\` này vào bản ghi Redis. Khi gặp lại khóa \`K1\`, nếu \`existing.requestHash !== currentRequestHash\`, hệ thống lập tức từ chối với mã lỗi **\`HTTP 422 Unprocessable Entity\`** (\`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH\`)!

\`\`\`
Dung lượng bộ nhớ RAM Redis cần cấp phát cho kho Idempotency (Total_Redis_RAM_MB) = (Write_RPS × TTL_Seconds × Avg_Record_Size_Bytes) / (1024 × 1024)
Kích thước trung bình 1 bản ghi Idempotency (Avg_Record_Size_Bytes) ≈ Key_Bytes (64B) + SHA256_Hash (64B) + Metadata (72B) + Cached_Response_JSON_Bytes
Ví dụ định lượng: Hệ thống có 500 giao dịch ghi/giây (Write_RPS = 500), giữ khóa trong 24 giờ (TTL = 86,400s), mỗi bản ghi nặng 1,024 Bytes (1 KB):
-> Tổng số khóa tồn tại đồng thời = 500 × 86,400 = 43,200,000 khóa -> Dung lượng RAM Redis cần dùng = 43,200,000 × 1 KB ≈ 41,198.73 MB (~41.2 GB RAM)!
\`\`\`

> **Tổng kết học thuật Phần 2 (Hai quy tắc bảo vệ Kho Khóa Lũy đẳng Redis):**
> 1. **Tối ưu hóa RAM Redis bằng cách Chỉ Lưu Các Trường Thiết yếu và Đặt TTL Hợp lý:** Như phép tính định lượng ở trên chỉ ra, nếu lưu toàn bộ JSON Response khổng lồ vào Redis với \`TTL = 24 giờ\` ở tốc độ cao, RAM sẽ tăng rất nhanh. Chỉ nên áp dụng \`Idempotency-Key\` cho các API đột biến quan trọng (\`POST /orders\`, \`POST /payments\`), giới hạn kích thước \`Cached Response <= 4 KB\` và cấu hình chính sách thu hồi bộ nhớ của Redis là **\`volatile-ttl\`** hoặc **\`noeviction\`** (tránh dùng \`allkeys-lru\` làm bay mất khóa đang ở trạng thái \`PROCESSING\`!).
> 2. **Chuẩn hóa Chuỗi JSON trước khi Băm (\`Canonical JSON Serialization\`):** Khi băm \`SHA-256\` cho \`req.body\`, hãy đảm bảo thứ tự các khóa (\`Object Keys\`) được sắp xếp nhất quán để tránh việc cùng một dữ liệu \`{ "a": 1, "b": 2 }\` và \`{ "b": 2, "a": 1 }\` sinh ra hai mã băm khác nhau gây lỗi \`422\` giả.

---

# 3. TRIỂN KHAI IDEMPOTENCY INTERCEPTOR TRONG NESTJS, QUẢN TRỊ KEEP-ALIVE TIMEOUT RACE CONDITION VÀ CHẨN ĐOÁN PRODUCTION

### 3.1 Bài toán Đua tranh Đóng kết nối Keep-Alive (\`502 Bad Gateway Race Condition\`) giữa Load Balancer và Node.js HTTP Server

Bên cạnh cơ chế \`Idempotency-Key\` ở tầng ứng dụng, một nguyên nhân cực kỳ phổ biến làm sản sinh ra hàng loạt lỗi \`502 Bad Gateway\` ngẫu nhiên trên Production (và kích hoạt bão Retry không đáng có!) chính là **Sự Lệch Pha Thời hạn Đóng Kết nối Nhàn rỗi (\`Keep-Alive Idle Timeout Race Condition\`)** giữa bộ cân bằng tải (**AWS ALB / Nginx / Cloudflare**) và máy chủ **Node.js / NestJS**:

1. **Giải phẫu Sự cố \`502 Bad Gateway\` do Node.js Đóng Kết nối Trước Load Balancer:**
   - Theo cấu hình mặc định của **AWS Application Load Balancer (ALB)** hoặc **Nginx Upstream**, thời gian giữ một kết nối TCP Keep-Alive nhàn rỗi (\`idle_timeout\`) thường là **\`60 giây (60,000 ms)\`**.
   - Trong khi đó, máy chủ HTTP mặc định của **Node.js** lại cài đặt thuộc tính **\`server.keepAliveTimeout = 5,000 ms (5 giây)\`**!
   - **Điều gì xảy ra tại mốc \`t = 5,000 ms\`?** Khi một kết nối giữa AWS ALB và Pod NestJS vừa nhàn rỗi đúng \`5.000 giây\`, tiến trình Node.js quyết định đóng kết nối đó lại bằng cách gửi gói tin **\`TCP FIN\`** về phía AWS ALB.
   - Nhưng đúng vào cùng mili-giây \`t = 5,000 ms\` đó (khi gói \`TCP FIN\` của Node.js còn đang bay trên dây mạng và chưa tới nơi), AWS ALB (vốn nghĩ kết nối vẫn còn hạn tới \`60 giây\`!) lại chọn đúng socket đó để đẩy một yêu cầu \`POST /api/payments\` mới của khách hàng xuống Pod NestJS!
   - Khi gói tin \`HTTP POST\` của ALB chạm tới Pod NestJS, vì socket trên Node.js đã đóng rồi nên nhân Linux của Pod lập tức bắn trả gói tin từ chối **\`TCP RST (Connection Reset by Peer)\`**! AWS ALB nhận được \`TCP RST\` liền trả về lỗi **\`HTTP 502 Bad Gateway\`** cho người dùng và khiến người dùng rơi vào trạng thái mập mờ không biết giao dịch đã chạy hay chưa!
2. **Bất đẳng thức Vàng khi Cấu hình Keep-Alive Timeout trong NestJS:**
   Để triệt tiêu 100% lỗi đua tranh \`502 Bad Gateway\` này, nguyên tắc kiến trúc bắt buộc là **Luôn để phía Client / Load Balancer chủ động đóng kết nối nhàn rỗi trước phía Server Node.js**. Cụ thể, thời hạn \`keepAliveTimeout\` của Node.js bắt buộc phải **lớn hơn** \`idle_timeout\` của Load Balancer tối thiểu \`5 giây\`, và \`headersTimeout\` của Node.js phải lớn hơn \`keepAliveTimeout\` thêm \`1 – 5 giây\`:
   $$\\text{Node.headersTimeout (66s)} > \\text{Node.keepAliveTimeout (65s)} > \\text{ALB.idle\\_timeout (60s)}$$

### 3.2 Truy vết qua Mã nguồn Thực thi: Cấu hình Keep-Alive Chuẩn Production và Idempotency Pipeline

Đoạn mã dưới đây trình bày cách thiết lập chuẩn xác các thông số thời hạn Socket ở tầng khởi tạo \`main.ts\` của NestJS để loại bỏ hoàn toàn lỗi \`502 Race Condition\` khi đứng sau AWS ALB hoặc Nginx Ingress:

\`\`\`typescript
// File: src/bootstrap/http-keepalive-tuning.bootstrap.ts
// Tinh chỉnh Keep-Alive Timeout trên NestJS HTTP Server chống lỗi 502 Bad Gateway Race Condition
import { INestApplication, Logger } from '@nestjs/common';
import type { Server } from 'node:http';

export interface KeepAliveTuningOptions {
  readonly loadBalancerIdleTimeoutMs: number;
  readonly safetyMarginMs: number;
  readonly headersGuardMarginMs: number;
}

export class HttpKeepAliveTuningBootstrap {
  private static readonly logger = new Logger(HttpKeepAliveTuningBootstrap.name);

  public static configureServerTimeouts(
    app: INestApplication,
    options: KeepAliveTuningOptions = {
      loadBalancerIdleTimeoutMs: 60000,
      safetyMarginMs: 5000,
      headersGuardMarginMs: 1000,
    },
  ): { keepAliveTimeoutMs: number; headersTimeoutMs: number } {
    const httpServer = app.getHttpServer() as Server;

    // Quy tắc bất biến: Node.keepAliveTimeout PHẢI LỚN HƠN LoadBalancer.idle_timeout (ví dụ 65s > 60s)
    // để đảm bảo AWS ALB / Nginx luôn là bên chủ động gửi gói FIN đóng kết nối nhàn rỗi trước!
    const keepAliveTimeoutMs = options.loadBalancerIdleTimeoutMs + options.safetyMarginMs;

    // Node.headersTimeout PHẢI LỚN HƠN keepAliveTimeout (ví dụ 66s > 65s)
    // để tránh bộ đếm đọc Header cắt ngang kết nối trước khi bộ đếm Keep-Alive kịp xử lý.
    const headersTimeoutMs = keepAliveTimeoutMs + options.headersGuardMarginMs;

    httpServer.keepAliveTimeout = keepAliveTimeoutMs;
    httpServer.headersTimeout = headersTimeoutMs;

    this.logger.log(
      \`Đã thiết lập HTTP Keep-Alive an toàn: LB=\${options.loadBalancerIdleTimeoutMs}ms < keepAliveTimeout=\${keepAliveTimeoutMs}ms < headersTimeout=\${headersTimeoutMs}ms\`,
    );

    return { keepAliveTimeoutMs, headersTimeoutMs };
  }
}
\`\`\`

### 3.3 Phương pháp Chẩn đoán Sự cố Lũy đẳng & Đứt kết nối Keep-Alive trên Production

Bảng dưới đây cung cấp quy trình chẩn đoán thực chiến cho các sự cố liên quan đến trùng lặp giao dịch và đứt kết nối giữa Load Balancer với cụm NestJS:

| Triệu chứng Sự cố trên Production | Chỉ số / Nhật ký Cần Kiểm tra | Nguyên nhân Gốc rễ ở Tầng Hệ thống | Giải pháp Khắc phục Chuẩn Kiến trúc |
| :--- | :--- | :--- | :--- |
| **Xuất hiện lỗi \`502 Bad Gateway\` ngẫu nhiên ở khoảng \`0.1%\` số request** | AWS ALB Log báo \`elb_status_code = 502\` và \`target_status_code = -\` kèm \`TCP RST\` | \`server.keepAliveTimeout\` của Node.js (\`5s\`) nhỏ hơn \`idle_timeout\` của ALB (\`60s\`) gây đua tranh đóng socket | Đặt \`httpServer.keepAliveTimeout = 65000\` và \`httpServer.headersTimeout = 66000\` trong \`main.ts\` |
| **Khách hàng bị trừ tiền 2 lần dù Frontend đã gửi \`Idempotency-Key\`** | Kiểm tra Access Log thấy 2 request của cùng 1 đơn hàng có **2 mã UUID khác nhau** | Frontend sinh mới \`uuidv4()\` bên trong hàm \`retry interceptor\` thay vì sinh cố định 1 lần lúc tạo đơn | Sinh và gắn chặt \`idempotencyKey\` vào trạng thái của lệnh/đơn hàng trước khi thực hiện lần gọi đầu tiên |
| **Một giao dịch bị kẹt ở lỗi \`409 Conflict\` suốt nhiều giờ không thể Retry** | Kiểm tra Redis bằng lệnh \`TTL idemp:<key>\` trả về \`-1\` (Không có hạn sử dụng) | Lập trình viên dùng \`SETNX\` nhưng quên đặt \`EX ttl\`, hoặc Pod bị Crash trước khi xóa khóa lỗi | Bắt buộc dùng lệnh nguyên tử hợp nhất \`SET key val NX EX 90\` để khóa \`PROCESSING\` tự hủy sau 90 giây |
| **Lỗi \`422 Payload Mismatch\` xảy ra dù Client gửi lại đúng dữ liệu cũ** | So sánh chuỗi JSON ở 2 lần gửi thấy thứ tự các trường (\`keys\`) bị đảo vị trí | Băm \`SHA-256\` trực tiếp trên chuỗi \`JSON.stringify\` chưa được sắp xếp thứ tự khóa (\`Non-canonical JSON\`) | Chuẩn hóa đối tượng bằng hàm sắp xếp đệ quy các \`Object.keys().sort()\` trước khi băm \`SHA-256\` |
| **Hai request bấm đúp (\`Double-Click\`) cách nhau \`1 ms\` cùng lọt qua tạo 2 đơn hàng** | Log ghi nhận cả 2 request đều đọc thấy khóa chưa tồn tại ở cùng một mili-giây | Kiểm tra khóa bằng 2 bước rời rạc (\`GET\` rồi mới \`SET\`) hoặc lưu khóa trên \`Map\` cục bộ của nhiều Pod | Chuyển sang lệnh nguyên tử \`Redis SET NX EX\` kết hợp ràng buộc \`UNIQUE (idempotency_key)\` trong Database |

> **Tổng kết học thuật Phần 3 (Quy tắc Bất biến Cấu hình \`keepAliveTimeout\` và Khóa hai tầng):**
> Khi triển khai dịch vụ NestJS đứng sau bất kỳ Reverse Proxy hay Load Balancer nào (AWS ALB, Google Cloud Load Balancer, Kong, Nginx), việc đầu tiên trong hàm \`bootstrap()\` là phải nâng \`keepAliveTimeout\` lên **\`65,000 ms\`** và \`headersTimeout\` lên **\`66,000 ms\`**. Đồng thời, với các giao dịch tài chính, luôn kết hợp **Khóa nhanh ở tầng Redis Interceptor** với **Ràng buộc \`UNIQUE\` ở tầng Database** để đảm bảo an toàn tuyệt đối ngay cả khi cụm Redis gặp sự cố.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Bảo Vệ Giao Dịch Lũy Đẳng Phân Tán (Distributed Idempotency Pipeline Map)
\`\`\`diagram
[TOPOLOGY: pipeline-feedback-loop]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG TIẾP NHẬN KẾT NỐI & ĐỊNH DANH YÊU CẦU (INGESTION & FINGERPRINT LAYER) │
│    [ Keep-Alive Gate (65s > LB 60s) ] ◄───► [ Header 'x-idempotency-key' (UUIDv4) ] ◄───► [ Canonical SHA-256 Hash (Body) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Kiểm tra & Chiếm giữ Khóa Nguyên tử trên Cụm Bộ nhớ
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG ĐIỀU PHỐI TRẠNG THÁI NGUYÊN TỬ REDIS (REDIS ATOMIC STATE LAYER)       │
│    ├── Lệnh SET key val NX EX 90: Chiếm khóa độc quyền chống Race Condition   │
│    ├── Phát hiện PROCESSING: Chặn ngay với mã HTTP 409 Conflict + Retry-After │
│    └── Phát hiện COMPLETED: So khớp SHA-256 (Sai -> 422; Đúng -> Trả Cache)   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Thực thi Giao dịch ACID & Phản hồi Lưu trữ (TTL 24h)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG THỰC THI NGHIỆP VỤ & CHỐT CHẶN CƠ SỞ DỮ LIỆU (ACID EXECUTION LAYER)  │
│    ├── Chốt chặn DB: Ràng buộc UNIQUE(idempotency_key) chống trùng mức đĩa    │
│    ├── Thành công (2xx): Lưu { statusCode, body } vào Redis với TTL 86,400s   │
│    └── Thất bại Tạm thời (5xx): Xóa khóa DEL key để cho phép Client thử lại   │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Giao Dịch Khi Mạng Timeout (Non-Idempotent Mutation vs Redis Atomic Idempotency Key)
\`\`\`diagram
MÔ HÌNH CŨ: API POST KHÔNG CÓ IDEMPOTENCY KEY KHI GẶP LỖI TIMEOUT ĐƯỜNG VỀ
Gửi POST trừ tiền ──► [ DB đã trừ 500k nhưng rớt mạng lúc trả về ] ──► [ Client tự động Retry lần 2 ] ──► TRỪ TIỀN KÉP (MẤT 1 TRIỆU)
2 lần gọi cùng 1 giao dịch = Server chạy lại toàn bộ logic, nhân đôi bản ghi đơn hàng và trừ tiền khách hàng 2 lần.

MÔ HÌNH HIỆN ĐẠI: BẢO VỆ BẰNG IDEMPOTENCY KEY KẾT HỢP KHÓA NGUYÊN TỬ REDIS SET NX EX
Attempt #1 (Gốc)   ──┐
Attempt #2 (Retry) ──┼──► [ Kiểm tra Khóa Redis & Đối chiếu Mã băm SHA-256 ] ──► Attempt #1 chạy DB & Lưu Cache 24h
Attempt #3 (Retry) ──┘                              │
                                                    └──► Attempt #2, #3 lấy thẳng Cache ────► Trả 200 OK trong 1ms (0 trừ tiền lại)
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Quy Trình Xét Duyệt Yêu Cầu Tại Tầng Idempotency Interceptor)
\`\`\`diagram
                    NHẬN YÊU CẦU ĐỘT BIẾN DỮ LIỆU (POST / PATCH) KÈM HEADER X-IDEMPOTENCY-KEY?
                                                        │
                                                        ▼
                            Thử chiếm khóa nguyên tử bằng lệnh Redis SET key "PROCESSING" NX EX 90?
                            /                                                                 \\
          CHIẾM KHÓA THÀNH CÔNG (KHÓA MỚI LẦN ĐẦU)                            CHIẾM KHÓA THẤT BẠI (KHÓA ĐÃ TỒN TẠI TRONG REDIS)
                        /                                                                             \\
                       ▼                                                                               ▼
   [ THỰC THI CONTROLLER & LƯU CACHE 24H (CHUẨN) ]                         Trạng thái hiện tại của bản ghi khóa trong Redis là gì?
   - Chạy nghiệp vụ, lưu { status, body, hash } EX 86400                   /                                                   \\
   - Nếu gặp lỗi hệ thống 5xx: Gọi DEL key để mở khóa        ĐANG XỬ LÝ DỞ DANG ("PROCESSING")                  ĐÃ HOÀN TẤT XỬ LÝ ("COMPLETED")
   - Đảm bảo an toàn bằng UNIQUE index dưới tầng DB                      /                                                       \\
                                                                        ▼                                                         ▼
                                                      [ TỪ CHỐI VỚI HTTP 409 CONFLICT (SLOW) ]             [ KIỂM TRA SHA-256 & HOÀN TRẢ CACHE (TỐI ƯU) ]
                                                      - Chặn đứng Race Condition bấm đúp                   - Nếu lệch mã băm Body: Ném lỗi 422 Tampering
                                                      - Đính kèm Header Retry-After: 2 giây                - Nếu khớp mã băm Body: Trả ngay Response cũ
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Cơ Chế Chống Trùng Lặp Giao Dịch Trong Hệ Thống Lớn)

| Tiêu Chí So Sánh | Không Xử Lý (\`No Protection\`) | Khóa Bộ nhớ Cục bộ (\`In-Memory Map\`) | Ràng buộc Duy nhất DB (\`DB Unique Index\`) | Khóa Nguyên tử Phân tán (\`Redis SET NX + DB\`) |
| :--- | :--- | :--- | :--- | :--- |
| **An toàn trên Cụm Multi-Pod K8s** | **Không (0%)**: Mọi lần Retry đều tạo bản ghi trùng lặp | **Không**: Sai lệch hoàn toàn khi Load Balancer chia tải qua nhiều Pod | **Có (100%)**: Được bảo vệ bởi cơ chế khóa chỉ mục B-Tree của Database | **Có (100%)**: Đồng bộ tập trung trên toàn bộ các Pod qua cụm Redis + DB |
| **Chống Đua tranh Mili-giây (\`Race\`)** | Hoàn toàn không có khả năng phòng vệ | Chỉ chặn được trong phạm vi 1 tiến trình đơn lẻ | Tốt, nhưng làm tăng tải khóa hàng (\`Row Lock Contention\`) trên Database | **Tuyệt đối**: Chặn đứng ngay tại tầng bộ nhớ RAM với lệnh nguyên tử \`SET NX\` |
| **Hoàn trả Nguyên vẹn Response Cũ** | Không thể; chạy lại logic gây tác dụng phụ kép | Mất sạch lịch sử khi ứng dụng triển khai bản mới hoặc khởi động lại | Phải tự thiết kế thêm bảng lưu trữ nội dung JSON phản hồi | **Tự động & Tức thì (\`~1 ms\`)**: Lưu sẵn \`{ statusCode, body }\` theo TTL 24h |
| **Bảo vệ chống Tráo đổi Payload** | Không có cơ chế phát hiện | Phụ thuộc cài đặt thủ công | Không tự động kiểm tra sự thay đổi của các cột không nằm trong Unique Index | **Chặt chẽ**: Đối chiếu chữ ký băm \`SHA-256\` của Payload và ném lỗi \`HTTP 422\` |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`IdempotencyInterceptor\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Bất biến Trạng thái của Tính Lũy đẳng (\`RFC 9110 Server-State Idempotence Invariant\`):** Theo chuẩn \`RFC 9110\`, một phương thức HTTP được coi là lũy đẳng (\`Idempotent\`) khi và chỉ khi tác động làm biến đổi trạng thái dữ liệu trên máy chủ của $N$ lần thực thi liên tiếp ($N \\ge 1$) là tương đương hoàn toàn với 1 lần thực thi duy nhất ($f(f(x)) = f(x)$), bất kể mã phản hồi HTTP ở các lần sau có thể thay đổi (như \`DELETE\` lần đầu trả về \`200 OK\` và lần thứ hai trả về \`404 Not Found\`). Các phương thức \`POST\` và \`PATCH\` mặc định không có tính lũy đẳng nên bắt buộc phải trang bị cơ chế **\`Idempotency-Key\`** trước khi cho phép bất kỳ cơ chế \`Retry\` tự động nào hoạt động.
2. **Định đề Chiếm Khóa Nguyên tử Kèm Hợp đồng Thuê (\`Atomic Lease Acquisition Invariant\`):** Để triệt tiêu hoàn toàn lỗi đua tranh kiểm tra-rồi-ghi (\`TOCTOU Race Condition\`) khi hai yêu cầu trùng khóa đến cùng lúc trên cụm máy chủ phân tán, thao tác kiểm tra sự tồn tại và khởi tạo trạng thái \`PROCESSING\` bắt buộc phải được gộp chung vào một lệnh nguyên tử duy nhất **\`SET key value NX EX lease_ttl\`** trên Redis. Việc gắn cứng thời hạn thuê ngắn (\`EX 60..120s\`) ngay lúc chiếm khóa là điều kiện bắt buộc để ngăn chặn hiện tượng **Khóa Xác sống (\`Zombie Lock\`)** nếu tiến trình xử lý bị sập đột ngột.
3. **Định đề Ràng buộc Chữ ký Băm Tải trọng (\`Cryptographic Payload Binding Invariant\`):** Một \`Idempotency-Key\` không bao giờ được tồn tại độc lập mà phải được ràng buộc bất biến với **Mã băm \`SHA-256\` của dữ liệu đầu vào đã chuẩn hóa (\`Canonical Request Fingerprint\`)**. Khi nhận yêu cầu thử lại có khóa trùng khớp, hệ thống phải kiểm tra trạng thái: nếu đang \`PROCESSING\` thì trả về **\`HTTP 409 Conflict\`**; nếu đã \`COMPLETED\` nhưng mã băm \`SHA-256\` bị sai lệch thì phải từ chối ngay với **\`HTTP 422 Unprocessable Entity\`** nhằm chặn đứng hành vi tráo đổi tham số giao dịch.
4. **Định đề Thứ tự Thời hạn Đóng Kết nối Keep-Alive (\`Keep-Alive Timeout Hierarchy Invariant\`):** Để ngăn chặn lỗi **\`502 Bad Gateway\`** do máy chủ Node.js gửi gói \`TCP FIN\` đóng kết nối nhàn rỗi đúng vào mili-giây mà Load Balancer (AWS ALB / Nginx) đang chuyển tiếp yêu cầu mới xuống, thời hạn giữ kết nối của tầng ứng dụng bắt buộc phải tuân thủ bất đẳng thức nghiêm ngặt: **\`Node.headersTimeout > Node.keepAliveTimeout > LoadBalancer.idle_timeout\`** (điển hình: \`66,000 ms > 65,000 ms > 60,000 ms\`).
  `,
  realCodeSnippet: `// File: src/modules/common/interceptors/idempotency.interceptor.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Distributed Idempotency Protection Interceptor
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'node:crypto';

export interface IdempotencyRecord {
  readonly status: 'PROCESSING' | 'COMPLETED';
  readonly requestHash: string;
  readonly statusCode: number;
  readonly body: unknown;
  readonly expiresAt: number;
}

/**
 * ADR-0032: Phòng chống trùng lặp giao dịch phân tán (Idempotency Key State Machine):
 * 1. Client bắt buộc gửi Header 'x-idempotency-key' dạng UUIDv4 cho các lệnh POST / PATCH nhạy cảm.
 * 2. Chuẩn hóa và băm SHA-256 Request Body để phát hiện hành vi sửa đổi dữ liệu (Payload Mismatch -> 422).
 * 3. Trạng thái 'PROCESSING' kèm thời hạn Lease TTL ngăn chặn Race Condition và Zombie Lock (409 Conflict).
 * 4. Trạng thái 'COMPLETED' trả về trực tiếp response trong Cache (TTL 24h) mà không thực thi lại nghiệp vụ.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  private readonly distributedStore = new Map<string, IdempotencyRecord>();
  private readonly processingLeaseTtlMs = 90_000;
  private readonly completedCacheTtlMs = 86_400_000;

  public async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      url: string;
      headers: Record<string, string | undefined>;
      body: unknown;
    }>();
    const res = http.getResponse<{
      statusCode: number;
      status: (code: number) => void;
      setHeader: (name: string, value: string) => void;
    }>();

    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next.handle();
    }

    const now = Date.now();
    const payloadHash = this.computeCanonicalHash(req.method, req.url, req.body);
    const existing = this.distributedStore.get(idempotencyKey);

    if (existing && existing.expiresAt > now) {
      if (existing.status === 'PROCESSING') {
        this.logger.warn(\`Chặn giao dịch đồng thời đang bay trên cùng khóa: \${idempotencyKey}\`);
        res.setHeader('Retry-After', '2');
        throw new ConflictException('IDEMPOTENCY_CONCURRENT_IN_FLIGHT');
      }

      if (existing.requestHash !== payloadHash) {
        this.logger.error(\`Phát hiện Payload Mismatch trên khóa lũy đẳng: \${idempotencyKey}\`);
        throw new UnprocessableEntityException('IDEMPOTENCY_PAYLOAD_MISMATCH');
      }

      res.setHeader('X-Idempotent-Replayed', 'true');
      res.status(existing.statusCode);
      return of(existing.body);
    }

    this.distributedStore.set(idempotencyKey, {
      status: 'PROCESSING',
      requestHash: payloadHash,
      statusCode: 200,
      body: null,
      expiresAt: now + this.processingLeaseTtlMs,
    });

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          this.distributedStore.set(idempotencyKey, {
            status: 'COMPLETED',
            requestHash: payloadHash,
            statusCode: res.statusCode || 200,
            body,
            expiresAt: Date.now() + this.completedCacheTtlMs,
          });
        },
        error: () => {
          this.distributedStore.delete(idempotencyKey);
        },
      }),
    );
  }

  private computeCanonicalHash(method: string, url: string, body: unknown): string {
    const normalizedPayload = JSON.stringify(body ?? {});
    return crypto
      .createHash('sha256')
      .update(\`\${method}:\${url}:\${normalizedPayload}\`)
      .digest('hex');
  }
}`,
  quiz: [
    {
      id: 'c3-l2-q1',
      question: 'Theo chuẩn kỹ thuật RFC 9110 (HTTP Semantics), phương thức HTTP DELETE có được phân loại là Idempotent (Lũy đẳng) hay không và dựa trên cơ sở lý luận nào?',
      options: [
        'Có; vì tính lũy đẳng xét trên trạng thái dữ liệu của máy chủ: xóa 1 lần hay gọi lặp lại 10 lần thì bản ghi đó vẫn ở trạng thái đã bị xóa mà không tạo ra tác dụng phụ mới.',
        'Không; vì lần gọi xóa đầu tiên trả về mã HTTP 200 hoặc 204 trong khi các lần gọi lặp lại tiếp theo lại trả về mã lỗi HTTP 404 Not Found nên kết quả phản hồi bị biến đổi.',
        'Không; vì theo định nghĩa của tổ chức IETF thì tất cả các phương thức có khả năng làm thay đổi dữ liệu trong ổ đĩa máy chủ đều bị coi là không có tính lũy đẳng tự nhiên.',
        'Có; nhưng chỉ đúng khi lập trình viên cấu hình ép buộc tầng Controller của máy chủ luôn phải trả về mã trạng thái HTTP 200 OK cho tất cả mọi lần gọi xóa bản ghi lặp lại.'
      ],
      correctIndex: 0,
      explanation: 'Theo RFC 9110 Section 9.2.2, tính chất Idempotent định nghĩa rằng hiệu ứng tác động lên trạng thái máy chủ của N yêu cầu giống hệt nhau là tương đương với 1 yêu cầu duy nhất. Mã phản hồi HTTP có thể khác nhau (lần đầu 200/204, các lần sau 404 vì bản ghi không còn), nhưng trạng thái dữ liệu trên server vẫn bất biến.'
    },
    {
      id: 'c3-l2-q2',
      question: 'Khi máy khách gửi lại một yêu cầu thanh toán với cùng mã Idempotency-Key cũ nhưng thay đổi số tiền trong Request Body (Payload Mismatch), máy chủ chuẩn mực phải xử lý ra sao?',
      options: [
        'Tự động ghi đè số tiền mới vào bản ghi giao dịch trước đó trong cơ sở dữ liệu và thực hiện lệnh thu thêm phần tiền chênh lệch từ tài khoản ngân hàng của người dùng.',
        'Xóa bỏ hoàn toàn khóa lũy đẳng cũ đang lưu trong bộ nhớ đệm Redis và tiến hành khởi tạo một quy trình thanh toán mới độc lập tương ứng với số tiền vừa được sửa đổi.',
        'Lập tức từ chối yêu cầu với mã lỗi HTTP 422 Unprocessable Entity (hoặc 400 Bad Request) do chữ ký băm SHA-256 của tải trọng không khớp với bản ghi gốc của khóa đó.',
        'Bỏ qua hoàn toàn nội dung Request Body mới và cứ thế trả về nguyên vẹn biên lai thành công của giao dịch cũ mà không cần thông báo bất kỳ cảnh báo sai lệch nào.'
      ],
      correctIndex: 2,
      explanation: 'Mỗi Idempotency Key phải được ràng buộc chặt chẽ với mã băm mật mã (SHA-256 fingerprint) của Request Body ban đầu. Nếu cùng một key nhưng nội dung body bị thay đổi, đó là lỗi logic nghiêm trọng ở client hoặc hành vi tấn công giả mạo tham số; server bắt buộc phải chặn đứng với mã HTTP 422 Unprocessable Entity.'
    },
    {
      id: 'c3-l2-q3',
      question: 'Khi hai yêu cầu mang cùng một Idempotency-Key chạm tới cụm máy chủ NestJS phân tán tại cùng một mili-giây, kỹ thuật nào giải quyết triệt để bài toán đua tranh (Race Condition)?',
      options: [
        'Bọc toàn bộ hàm xử lý của Controller bên trong một khối vòng lặp bận (Busy-Wait Spinlock) của JavaScript để khóa cứng luồng chính cho tới khi giao dịch đầu tiên chạy xong.',
        'Sử dụng lệnh nguyên tử SET key value NX EX ttl trên Redis; yêu cầu đầu tiên chiếm khóa thành công sẽ chạy nghiệp vụ, yêu cầu thứ hai thấy PROCESSING sẽ bị chặn với HTTP 409.',
        'Cho phép cả hai yêu cầu cùng thực thi lệnh trừ tiền vào cơ sở dữ liệu rồi thiết lập một tiến trình chạy ngầm định kỳ mỗi giờ một lần để tìm và hoàn tiền các giao dịch trùng.',
        'Lưu trữ danh sách các khóa đang xử lý vào một biến đối tượng Map toàn cục nằm trong bộ nhớ RAM V8 Heap riêng biệt của từng tiến trình máy chủ ứng dụng Node.js.'
      ],
      correctIndex: 1,
      explanation: 'Lệnh SET ... NX EX trên Redis được thực thi nguyên tử hoàn toàn. Request đến trước chiếm được khóa và đặt trạng thái PROCESSING kèm thời hạn thuê. Request thứ hai đến cùng mili-giây sẽ nhận kết quả thất bại từ lệnh NX, phát hiện trạng thái PROCESSING và lập tức bị từ chối với mã HTTP 409 Conflict.'
    },
    {
      id: 'c3-l2-q4',
      question: 'Sự khác biệt cốt lõi về mặt ngữ nghĩa học thuật giữa hai phương thức HTTP PUT và HTTP PATCH theo đặc tả RFC 9110 là gì?',
      options: [
        'Phương thức PUT bắt buộc phải mã hóa toàn bộ dữ liệu dưới dạng khung nhị phân Protobuf, trong khi phương thức PATCH chỉ cho phép truyền tải chuỗi văn bản thuần túy UTF-8.',
        'Phương thức PUT chỉ được phép sử dụng cho các hệ quản trị cơ sở dữ liệu tài liệu NoSQL, còn phương thức PATCH được thiết kế độc quyền cho các cơ sở dữ liệu quan hệ SQL.',
        'Phương thức PUT tự động bỏ qua toàn bộ các bộ lọc kiểm tra xác thực người dùng của NestJS, còn phương thức PATCH luôn bắt buộc phải kiểm tra chữ ký số của quản trị viên.',
        'PUT thay thế toàn bộ biểu diễn của tài nguyên nên có tính lũy đẳng tự nhiên, trong khi PATCH cập nhật từng phần (có thể chứa phép cộng/trừ tương đối) nên không mặc nhiên lũy đẳng.'
      ],
      correctIndex: 3,
      explanation: 'Theo RFC 9110, PUT thực hiện thay thế toàn bộ trạng thái tài nguyên đích bằng payload gửi lên (Full Replacement), nên gọi N lần vẫn cho ra cùng một trạng thái cuối (Idempotent). Ngược lại, PATCH chỉ mô tả một tập hợp các chỉ thị biến đổi từng phần (như tăng số dư hoặc nối mảng); nếu gọi lại nhiều lần có thể làm biến đổi trạng thái liên tục nên PATCH không mặc nhiên là Idempotent.'
    },
    {
      id: 'c3-l2-q5',
      question: 'Tại sao Idempotency Interceptor bắt buộc phải lưu trữ trọn vẹn cả mã trạng thái (StatusCode) và nội dung phản hồi (Response Body) của lần thực thi thành công đầu tiên vào Redis?',
      options: [
        'Để khi máy khách thực hiện thử lại (Retry) do đứt mạng ở lượt về, máy chủ trả lại ngay kết quả y hệt lần đầu trong 1ms mà không chạy lại logic nghiệp vụ hay ghi DB lần hai.',
        'Để trình duyệt web của người dùng cuối có thể tự động đồng bộ hóa lịch sử giao dịch vào bộ nhớ đệm ngoại tuyến IndexedDB mà không cần kết nối mạng Internet.',
        'Để thay thế hoàn toàn hệ quản trị cơ sở dữ liệu quan hệ PostgreSQL bằng cách biến cụm bộ nhớ RAM của Redis thành nơi lưu trữ sổ cái tài chính vĩnh viễn của doanh nghiệp.',
        'Để giúp bộ cân bằng tải phần cứng ở biên mạng tự động nén nhỏ kích thước gói tin phản hồi xuống còn một phần mười trước khi truyền qua đường cáp quang biển.'
      ],
      correctIndex: 0,
      explanation: 'Mục tiêu của Idempotency Key là giải quyết nghịch lý mạng đứt ở chiều về: server đã trừ tiền xong nhưng client bị timeout nên gửi lại request. Nhờ lưu sẵn StatusCode và Response Body trong Redis ở trạng thái COMPLETED, server trả lại ngay biên lai thành công cũ cho client mà không hề chạm vào Database hay cổng thanh toán lần thứ hai.'
    },
    {
      id: 'c3-l2-q6',
      question: 'Nhóm phương thức "Safe Methods" (GET, HEAD, OPTIONS) trong chuẩn RFC 9110 mang cam kết kỹ thuật nào đối với các tầng trung gian như CDN, Reverse Proxy và Trình duyệt?',
      options: [
        'Cam kết toàn bộ nội dung gói tin đã được ký số bằng thuật toán RSA 4096-bit để đảm bảo không có bất kỳ mã độc nào có thể lây nhiễm qua máy chủ trung gian.',
        'Cam kết yêu cầu đó chỉ được phát đi từ các thiết bị phần cứng đã được xác thực danh tính quản trị viên cấp cao nhất trong mạng nội bộ của trung tâm dữ liệu.',
        'Cam kết chỉ truy xuất dữ liệu mà không làm biến đổi trạng thái máy chủ, cho phép CDN và Proxy tự do lưu bộ đệm (Cache), nạp trước (Prefetch) và tự động Retry khi rớt mạng.',
        'Cam kết không bao giờ tiêu tốn quá 1 Megabyte bộ nhớ V8 Heap của máy chủ ứng dụng nhằm ngăn chặn hoàn toàn nguy cơ tràn bộ nhớ khi có lưu lượng truy cập lớn.'
      ],
      correctIndex: 2,
      explanation: 'Safe Methods (GET, HEAD, OPTIONS, TRACE) có ngữ nghĩa chỉ đọc (Read-only semantics) và không gây ra bất kỳ thay đổi trạng thái nào trên server. Nhờ cam kết này, trình duyệt, CDN và Reverse Proxy có thể an tâm lưu cache phản hồi hoặc tự động gửi lại request khi gặp lỗi kết nối mạng mà không sợ gây ra tác dụng phụ như đặt hàng kép.'
    },
    {
      id: 'c3-l2-q7',
      question: 'Tại sao việc đặt thời hạn sống ngắn (Lease TTL khoảng 60–120 giây) ngay trong lệnh chiếm khóa PROCESSING và xóa khóa khi gặp lỗi 5xx lại có ý nghĩa sống còn?',
      options: [
        'Để ép buộc bộ thu gom rác của máy chủ Redis phải giải phóng toàn bộ các trang nhớ vật lý sang ổ cứng SSD sau mỗi chu kỳ 60 giây nhằm tiết kiệm điện năng tiêu thụ.',
        'Để ngăn chặn thảm họa Khóa Xác sống (Zombie Lock): nếu Pod NestJS bị sập nguồn khi đang xử lý mà khóa không có TTL, mọi lần Retry sau đó sẽ bị kẹt vĩnh viễn ở lỗi 409 Conflict.',
        'Để đảm bảo mã băm mật mã SHA-256 của gói tin không bị suy giảm độ an toàn trước các thuật toán dò tìm va chạm của máy tính lượng tử sau khi tồn tại quá hai phút.',
        'Để cho phép một khách hàng có thể thực hiện lại việc trừ tiền nhiều lần trên cùng một hóa đơn ngay sau khi đồng hồ đếm ngược 60 giây trên màn hình điện thoại kết thúc.'
      ],
      correctIndex: 1,
      explanation: 'Nếu tiến trình NestJS bị OOMKilled hoặc mất mạng đúng lúc đang giữ khóa ở trạng thái PROCESSING mà khóa đó không được gắn TTL tự hủy (hoặc không được xóa khi catch lỗi 5xx), khóa đó sẽ biến thành Zombie Lock tồn tại mãi mãi trong Redis. Khi đó mọi lần Retry hợp lệ của khách hàng đều bị chặn bởi lỗi 409 Conflict và giao dịch bị treo vĩnh viễn.'
    },
    {
      id: 'c3-l2-q8',
      question: 'Nguyên nhân vật lý nào gây ra lỗi 502 Bad Gateway ngẫu nhiên khi đặt máy chủ Node.js/NestJS phía sau bộ cân bằng tải AWS ALB hoặc Nginx, và cách cấu hình khắc phục chuẩn là gì?',
      options: [
        'Do AWS ALB không hỗ trợ giao thức HTTP/1.1 Keep-Alive; bắt buộc phải tắt hoàn toàn chế độ tái sử dụng kết nối trên cả bộ cân bằng tải lẫn máy chủ ứng dụng NestJS.',
        'Do kích thước bộ đệm tiêu đề của Node.js quá lớn làm tràn RAM của bộ cân bằng tải; cần phải giảm headersTimeout xuống mức 1,000 ms để cắt đứt sớm các kết nối chậm.',
        'Do keepAliveTimeout mặc định của Node.js (5s) nhỏ hơn idle_timeout của ALB (60s) khiến Node gửi gói FIN đóng socket đúng lúc ALB đẩy request mới xuống; cần đặt 66s > 65s > 60s.',
        'Do thuật toán cân bằng tải Round-Robin gửi hai gói tin TCP SYN liên tiếp vào cùng một cổng mạng; cần chuyển toàn bộ giao tiếp nội bộ sang giao thức không kết nối UDP.'
      ],
      correctIndex: 2,
      explanation: 'Khi keepAliveTimeout của Node.js (mặc định 5,000ms) nhỏ hơn idle_timeout của AWS ALB (60,000ms), Node.js sẽ chủ động gửi gói FIN đóng kết nối nhàn rỗi ở giây thứ 5. Nếu đúng mili-giây đó ALB gửi một HTTP request mới trên chính socket đó, nhân Linux của Node.js sẽ bắn trả TCP RST khiến ALB báo lỗi 502 Bad Gateway. Phải cấu hình headersTimeout (66s) > keepAliveTimeout (65s) > ALB idle_timeout (60s).'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Cỡ Thời Hạn Keep-Alive Chống Lỗi 502 & Tính Dung Lượng Kho Khóa Redis',
    description: 'Viết hàm `calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes)` để kiểm tra lỗi đua tranh đóng kết nối 502 và ước tính bộ nhớ RAM Redis cần dùng:\n- Khuyến nghị cấu hình thời hạn an toàn cho Node.js:\n  + `recommendedKeepAliveMs = lbIdleTimeoutMs + 5000`\n  + `recommendedHeadersTimeoutMs = recommendedKeepAliveMs + 1000`\n- Kiểm tra xem cấu hình hiện tại có bị lỗi đua tranh `502 Bad Gateway` không: `has502RaceCondition = nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs`.\n- Tính dung lượng bộ nhớ RAM Redis cần cấp phát (đơn vị MB, làm tròn 2 chữ số thập phân): `estimatedRedisRamMb = (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024)`.',
    guidedSteps: [
      'Bước 1 (Tính ngưỡng Keep-Alive và Headers Timeout khuyến nghị): Cộng thêm 5000ms vào lbIdleTimeoutMs để có recommendedKeepAliveMs, rồi cộng tiếp 1000ms để có recommendedHeadersTimeoutMs.',
      'Bước 2 (Phát hiện rủi ro đua tranh 502 Bad Gateway): So sánh nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs để gán giá trị boolean cho biến has502RaceCondition.',
      'Bước 3 (Tính dung lượng RAM Redis lưu trữ Idempotency Keys): Tính (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024) và làm tròn 2 chữ số thập phân.',
      'Bước 4 (Trả về đối tượng kết quả): Trả về { has502RaceCondition, recommendedKeepAliveMs, recommendedHeadersTimeoutMs, estimatedRedisRamMb }.'
    ],
    hints: [
      'Một Megabyte (MB) bằng 1024 * 1024 = 1,048,576 Bytes.',
      'Bất đẳng thức chống lỗi 502 yêu cầu nodeKeepAliveTimeoutMs phải lớn hơn hẳn lbIdleTimeoutMs; nếu nhỏ hơn hoặc bằng nhau thì has502RaceCondition sẽ là true.'
    ],
    starterCode: `function calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes) {
  // Bước 1: Tính recommendedKeepAliveMs và recommendedHeadersTimeoutMs
  
  // Bước 2: Kiểm tra điều kiện xảy ra lỗi đua tranh has502RaceCondition
  
  // Bước 3: Tính dung lượng RAM Redis cần dùng (estimatedRedisRamMb, làm tròn 2 chữ số thập phân)
  
  // Bước 4: Trả về { has502RaceCondition, recommendedKeepAliveMs, recommendedHeadersTimeoutMs, estimatedRedisRamMb }
}`,
    solution: `function calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes) {
  const recommendedKeepAliveMs = lbIdleTimeoutMs + 5000;
  const recommendedHeadersTimeoutMs = recommendedKeepAliveMs + 1000;
  const has502RaceCondition = nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs;

  const rawRamMb = (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024);
  const estimatedRedisRamMb = Math.round(rawRamMb * 100) / 100;

  return {
    has502RaceCondition,
    recommendedKeepAliveMs,
    recommendedHeadersTimeoutMs,
    estimatedRedisRamMb,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Cấu hình mặc định của Node.js (5s) đứng sau AWS ALB (60s) bị lỗi 502 Race Condition',
        input: [60000, 5000, 500, 86400, 1024],
        expected: {
          has502RaceCondition: true,
          recommendedKeepAliveMs: 65000,
          recommendedHeadersTimeoutMs: 66000,
          estimatedRedisRamMb: 42187.5
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Cấu hình đã tinh chỉnh chuẩn (Node 65s > ALB 60s) và lưu lượng vừa phải',
        input: [60000, 65000, 100, 86400, 512],
        expected: {
          has502RaceCondition: false,
          recommendedKeepAliveMs: 65000,
          recommendedHeadersTimeoutMs: 66000,
          estimatedRedisRamMb: 4218.75
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Khi hai thời hạn bằng nhau (60s === 60s) vẫn xảy ra đua tranh đóng kết nối',
        input: [60000, 60000, 50, 3600, 2048],
        expected: {
          has502RaceCondition: true,
          recommendedKeepAliveMs: 65000,
          recommendedHeadersTimeoutMs: 66000,
          estimatedRedisRamMb: 351.56
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Nginx Ingress có idle_timeout = 75,000ms',
        input: [75000, 80000, 250, 43200, 1024],
        expected: {
          has502RaceCondition: false,
          recommendedKeepAliveMs: 80000,
          recommendedHeadersTimeoutMs: 81000,
          estimatedRedisRamMb: 10546.88
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Hệ thống nhỏ không có lưu lượng ghi',
        input: [30000, 20000, 0, 86400, 1024],
        expected: {
          has502RaceCondition: true,
          recommendedKeepAliveMs: 35000,
          recommendedHeadersTimeoutMs: 36000,
          estimatedRedisRamMb: 0
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Cỡ Thời Hạn Keep-Alive Chống Lỗi 502 & Tính Dung Lượng Kho Khóa Redis',
      description: 'Viết hàm `calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes)` để kiểm tra lỗi đua tranh đóng kết nối 502 và ước tính bộ nhớ RAM Redis cần dùng:\n- Khuyến nghị cấu hình thời hạn an toàn cho Node.js:\n  + `recommendedKeepAliveMs = lbIdleTimeoutMs + 5000`\n  + `recommendedHeadersTimeoutMs = recommendedKeepAliveMs + 1000`\n- Kiểm tra xem cấu hình hiện tại có bị lỗi đua tranh `502 Bad Gateway` không: `has502RaceCondition = nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs`.\n- Tính dung lượng bộ nhớ RAM Redis cần cấp phát (đơn vị MB, làm tròn 2 chữ số thập phân): `estimatedRedisRamMb = (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024)`.',
      guidedSteps: [
        'Bước 1 (Tính ngưỡng Keep-Alive và Headers Timeout khuyến nghị): Cộng thêm 5000ms vào lbIdleTimeoutMs để có recommendedKeepAliveMs, rồi cộng tiếp 1000ms để có recommendedHeadersTimeoutMs.',
        'Bước 2 (Phát hiện rủi ro đua tranh 502 Bad Gateway): So sánh nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs để gán giá trị boolean cho biến has502RaceCondition.',
        'Bước 3 (Tính dung lượng RAM Redis lưu trữ Idempotency Keys): Tính (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024) và làm tròn 2 chữ số thập phân.',
        'Bước 4 (Trả về đối tượng kết quả): Trả về { has502RaceCondition, recommendedKeepAliveMs, recommendedHeadersTimeoutMs, estimatedRedisRamMb }.'
      ],
      hints: [
        'Một Megabyte (MB) bằng 1024 * 1024 = 1,048,576 Bytes.',
        'Bất đẳng thức chống lỗi 502 yêu cầu nodeKeepAliveTimeoutMs phải lớn hơn hẳn lbIdleTimeoutMs; nếu nhỏ hơn hoặc bằng nhau thì has502RaceCondition sẽ là true.'
      ],
      starterCode: `function calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes) {
  // Bước 1: Tính recommendedKeepAliveMs và recommendedHeadersTimeoutMs
  
  // Bước 2: Kiểm tra điều kiện xảy ra lỗi đua tranh has502RaceCondition
  
  // Bước 3: Tính dung lượng RAM Redis cần dùng (estimatedRedisRamMb, làm tròn 2 chữ số thập phân)
  
  // Bước 4: Trả về { has502RaceCondition, recommendedKeepAliveMs, recommendedHeadersTimeoutMs, estimatedRedisRamMb }
}`,
      solution: `function calculateKeepAliveAndIdempotencyBudget(lbIdleTimeoutMs, nodeKeepAliveTimeoutMs, writeRps, ttlSeconds, avgRecordBytes) {
  const recommendedKeepAliveMs = lbIdleTimeoutMs + 5000;
  const recommendedHeadersTimeoutMs = recommendedKeepAliveMs + 1000;
  const has502RaceCondition = nodeKeepAliveTimeoutMs <= lbIdleTimeoutMs;

  const rawRamMb = (writeRps * ttlSeconds * avgRecordBytes) / (1024 * 1024);
  const estimatedRedisRamMb = Math.round(rawRamMb * 100) / 100;

  return {
    has502RaceCondition,
    recommendedKeepAliveMs,
    recommendedHeadersTimeoutMs,
    estimatedRedisRamMb,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Cấu hình mặc định của Node.js (5s) đứng sau AWS ALB (60s) bị lỗi 502 Race Condition',
          input: [60000, 5000, 500, 86400, 1024],
          expected: {
            has502RaceCondition: true,
            recommendedKeepAliveMs: 65000,
            recommendedHeadersTimeoutMs: 66000,
            estimatedRedisRamMb: 42187.5
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Cấu hình đã tinh chỉnh chuẩn (Node 65s > ALB 60s) và lưu lượng vừa phải',
          input: [60000, 65000, 100, 86400, 512],
          expected: {
            has502RaceCondition: false,
            recommendedKeepAliveMs: 65000,
            recommendedHeadersTimeoutMs: 66000,
            estimatedRedisRamMb: 4218.75
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Khi hai thời hạn bằng nhau (60s === 60s) vẫn xảy ra đua tranh đóng kết nối',
          input: [60000, 60000, 50, 3600, 2048],
          expected: {
            has502RaceCondition: true,
            recommendedKeepAliveMs: 65000,
            recommendedHeadersTimeoutMs: 66000,
            estimatedRedisRamMb: 351.56
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Nginx Ingress có idle_timeout = 75,000ms',
          input: [75000, 80000, 250, 43200, 1024],
          expected: {
            has502RaceCondition: false,
            recommendedKeepAliveMs: 80000,
            recommendedHeadersTimeoutMs: 81000,
            estimatedRedisRamMb: 10546.88
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Hệ thống nhỏ không có lưu lượng ghi',
          input: [30000, 20000, 0, 86400, 1024],
          expected: {
            has502RaceCondition: true,
            recommendedKeepAliveMs: 35000,
            recommendedHeadersTimeoutMs: 36000,
            estimatedRedisRamMb: 0
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Máy Trạng Thái Khóa Lũy Đẳng (Idempotency Key State Machine)',
      description: 'Viết hàm `processIdempotentBatch(requests)` nhận vào một mảng các sự kiện yêu cầu theo thứ tự thời gian `Array<{ key: string; payload: string; eventType: "START" | "COMPLETE" | "FAIL_5XX"; responseData?: string }>` và trả về mảng kết quả xử lý của từng sự kiện:\n- Duyệt tuần tự qua từng sự kiện cùng với một bộ nhớ trạng thái `store`:\n  + Khi `eventType === "START"`: Kiểm tra xem `key` đã có trong `store` chưa.\n    * Nếu chưa có: Lưu `{ status: "PROCESSING", payload, responseData: null }` vào `store` và đẩy `"LOCK_ACQUIRED_202"` vào mảng kết quả.\n    * Nếu đã có và `existing.payload !== payload`: Đẩy `"REJECT_422_PAYLOAD_MISMATCH"` vào mảng kết quả.\n    * Nếu đã có (cùng `payload`) và `existing.status === "PROCESSING"`: Đẩy `"REJECT_409_IN_PROGRESS"` vào mảng kết quả.\n    * Nếu đã có (cùng `payload`) và `existing.status === "COMPLETED"`: Đẩy chuỗi `"REPLAY_200:" + existing.responseData` vào mảng kết quả.\n  + Khi `eventType === "COMPLETE"`: Cập nhật bản ghi của `key` trong `store` sang `{ status: "COMPLETED", payload, responseData: item.responseData || "OK" }` và đẩy `"COMMITTED_200"` vào mảng kết quả.\n  + Khi `eventType === "FAIL_5XX"`: Xóa `key` khỏi `store` (giải phóng khóa để cho phép Retry) và đẩy `"UNLOCKED_ON_5XX"` vào mảng kết quả.',
      guidedSteps: [
        'Bước 1 (Khởi tạo kho trạng thái): Khai báo const store = new Map() và mảng const outcomes = [].',
        'Bước 2 (Xử lý sự kiện START): Tra cứu store.get(item.key). Nếu chưa có thì set trạng thái PROCESSING; nếu có rồi thì kiểm tra payload mismatch (422) trước, sau đó kiểm tra PROCESSING (409) và COMPLETED (REPLAY_200).',
        'Bước 3 (Xử lý sự kiện COMPLETE và FAIL_5XX): Với COMPLETE thì cập nhật status = "COMPLETED" kèm responseData; với FAIL_5XX thì gọi store.delete(item.key) để tránh Zombie Lock.',
        'Bước 4 (Hoàn trả kết quả): Trả về mảng outcomes sau khi duyệt hết danh sách sự kiện.'
      ],
      hints: [
        'Luôn kiểm tra điều kiện existing.payload !== item.payload đối với bản ghi đã tồn tại để bắt lỗi giả mạo tham số (422) hoặc kiểm tra theo thứ tự đề bài.',
        'Khi gặp FAIL_5XX, lệnh store.delete(item.key) giúp lần gọi START tiếp theo của cùng key đó được phép chiếm khóa lại từ đầu.'
      ],
      starterCode: `function processIdempotentBatch(requests) {
  // Bước 1: Khởi tạo Map lưu trạng thái khóa và mảng kết quả outcomes
  
  // Bước 2: Duyệt qua từng sự kiện trong mảng requests
  
  // Bước 3: Xử lý từng trường hợp START, COMPLETE và FAIL_5XX
  
  // Bước 4: Trả về mảng outcomes
}`,
      solution: `function processIdempotentBatch(requests) {
  if (!Array.isArray(requests)) {
    return [];
  }

  const store = new Map();
  const outcomes = [];

  for (const item of requests) {
    if (item.eventType === 'START') {
      const existing = store.get(item.key);
      if (!existing) {
        store.set(item.key, {
          status: 'PROCESSING',
          payload: item.payload,
          responseData: null,
        });
        outcomes.push('LOCK_ACQUIRED_202');
      } else if (existing.payload !== item.payload) {
        outcomes.push('REJECT_422_PAYLOAD_MISMATCH');
      } else if (existing.status === 'PROCESSING') {
        outcomes.push('REJECT_409_IN_PROGRESS');
      } else {
        outcomes.push(\`REPLAY_200:\${existing.responseData}\`);
      }
    } else if (item.eventType === 'COMPLETE') {
      store.set(item.key, {
        status: 'COMPLETED',
        payload: item.payload,
        responseData: item.responseData || 'OK',
      });
      outcomes.push('COMMITTED_200');
    } else if (item.eventType === 'FAIL_5XX') {
      store.delete(item.key);
      outcomes.push('UNLOCKED_ON_5XX');
    }
  }

  return outcomes;
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Luồng chuẩn chiếm khóa -> hoàn tất -> Retry nhận lại kết quả từ Cache',
          input: [
            [
              { key: 'k1', payload: '{"amt":100}', eventType: 'START' },
              { key: 'k1', payload: '{"amt":100}', eventType: 'COMPLETE', responseData: 'TX_01' },
              { key: 'k1', payload: '{"amt":100}', eventType: 'START' }
            ]
          ],
          expected: ['LOCK_ACQUIRED_202', 'COMMITTED_200', 'REPLAY_200:TX_01'],
          hidden: false
        },
        {
          name: 'Case 2 công khai: Chặn bấm đúp đồng thời khi đang xử lý (409) và chặn tráo đổi số tiền (422)',
          input: [
            [
              { key: 'k2', payload: '{"amt":50}', eventType: 'START' },
              { key: 'k2', payload: '{"amt":50}', eventType: 'START' },
              { key: 'k2', payload: '{"amt":9999}', eventType: 'START' }
            ]
          ],
          expected: [
            'LOCK_ACQUIRED_202',
            'REJECT_409_IN_PROGRESS',
            'REJECT_422_PAYLOAD_MISMATCH'
          ],
          hidden: false
        },
        {
          name: 'Case 3 công khai: Giải phóng khóa khi gặp lỗi hệ thống 5xx để cho phép Retry thành công',
          input: [
            [
              { key: 'k3', payload: '{"amt":200}', eventType: 'START' },
              { key: 'k3', payload: '{"amt":200}', eventType: 'FAIL_5XX' },
              { key: 'k3', payload: '{"amt":200}', eventType: 'START' },
              { key: 'k3', payload: '{"amt":200}', eventType: 'COMPLETE', responseData: 'TX_RECOVERED' }
            ]
          ],
          expected: [
            'LOCK_ACQUIRED_202',
            'UNLOCKED_ON_5XX',
            'LOCK_ACQUIRED_202',
            'COMMITTED_200'
          ],
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Tráo đổi payload sau khi giao dịch đã COMPLETED vẫn bị chặn 422',
          input: [
            [
              { key: 'k4', payload: '{"to":"A"}', eventType: 'START' },
              { key: 'k4', payload: '{"to":"A"}', eventType: 'COMPLETE', responseData: 'DONE_A' },
              { key: 'k4', payload: '{"to":"HACKER"}', eventType: 'START' }
            ]
          ],
          expected: ['LOCK_ACQUIRED_202', 'COMMITTED_200', 'REJECT_422_PAYLOAD_MISMATCH'],
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Nhiều khóa giao dịch khác nhau chạy đan xen độc lập',
          input: [
            [
              { key: 'ka', payload: 'p1', eventType: 'START' },
              { key: 'kb', payload: 'p2', eventType: 'START' },
              { key: 'ka', payload: 'p1', eventType: 'COMPLETE', responseData: 'RES_A' },
              { key: 'ka', payload: 'p1', eventType: 'START' }
            ]
          ],
          expected: ['LOCK_ACQUIRED_202', 'LOCK_ACQUIRED_202', 'COMMITTED_200', 'REPLAY_200:RES_A'],
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Cổng Kiểm Duyệt Idempotency Toàn Diện Có Thu Hồi Zombie Lock Theo Thời Gian (TTL Lease Eviction)',
      description: 'Hiện thực hàm `evaluateIdempotencyWithLeaseTtl(existingRecord, incomingRequest, leaseTtlMs)` để đưa ra quyết định điều phối chuẩn Production:\n1. **Kiểm tra hợp lệ đầu vào (Validation):**\n   - `incomingRequest` phải là object có `key` (chuỗi không rỗng sau khi trim), `payloadHash` (chuỗi không rỗng) và `timestampMs` (số `>= 0`), đồng thời `leaseTtlMs` phải là số `> 0`. Nếu vi phạm bất kỳ điều kiện nào, ném lỗi `throw new Error("INVALID_IDEMPOTENCY_INPUT")`.\n2. **Trường hợp chưa có bản ghi (`existingRecord === null` hoặc `existingRecord === undefined`):**\n   - Trả về `{ httpStatus: 201, decision: "ACQUIRE_NEW_LOCK", zombieEvicted: false, lockExpiresAtMs: incomingRequest.timestampMs + leaseTtlMs }`.\n3. **Trường hợp đã có `existingRecord` (`{ status: "PROCESSING" | "COMPLETED"; payloadHash: string; createdAtMs: number; cachedStatusCode?: number }`):**\n   - Kiểm tra xem khóa `PROCESSING` cũ có bị kẹt quá hạn thành **Zombie Lock** hay không: nếu `existingRecord.status === "PROCESSING"` VÀ `(incomingRequest.timestampMs - existingRecord.createdAtMs) >= leaseTtlMs`, tức là tiến trình cũ đã chết và khóa đã hết hạn thuê! Lúc này hệ thống thu hồi Zombie Lock và cấp khóa mới cho request hiện tại (bất kể `payloadHash` cũ): trả về `{ httpStatus: 201, decision: "RECOVER_EXPIRED_ZOMBIE_LOCK", zombieEvicted: true, lockExpiresAtMs: incomingRequest.timestampMs + leaseTtlMs }`.\n   - Ngược lại (khóa vẫn còn hiệu lực): kiểm tra tính toàn vẹn `existingRecord.payloadHash !== incomingRequest.payloadHash`. Nếu khác nhau, trả về `{ httpStatus: 422, decision: "REJECT_PAYLOAD_TAMPERING", zombieEvicted: false, lockExpiresAtMs: existingRecord.createdAtMs + leaseTtlMs }`.\n   - Nếu cùng `payloadHash` và `existingRecord.status === "PROCESSING"`, trả về `{ httpStatus: 409, decision: "REJECT_CONCURRENT_IN_FLIGHT", zombieEvicted: false, lockExpiresAtMs: existingRecord.createdAtMs + leaseTtlMs }`.\n   - Nếu cùng `payloadHash` và `existingRecord.status === "COMPLETED"`, trả về `{ httpStatus: existingRecord.cachedStatusCode || 200, decision: "RETURN_CACHED_RESPONSE", zombieEvicted: false, lockExpiresAtMs: existingRecord.createdAtMs + leaseTtlMs }`.',
      guidedSteps: [
        'Bước 1 (Xác thực tham số đầu vào): Kiểm tra incomingRequest, key.trim(), payloadHash.trim(), timestampMs >= 0 và leaseTtlMs > 0; nếu sai ném Error("INVALID_IDEMPOTENCY_INPUT").',
        'Bước 2 (Xử lý trường hợp khóa mới): Nếu !existingRecord, trả về ngay quyết định "ACQUIRE_NEW_LOCK" với httpStatus: 201 và lockExpiresAtMs = incomingRequest.timestampMs + leaseTtlMs.',
        'Bước 3 (Phát hiện và thu hồi Zombie Lock): Kiểm tra nếu existingRecord.status === "PROCESSING" và (incomingRequest.timestampMs - existingRecord.createdAtMs) >= leaseTtlMs thì trả về "RECOVER_EXPIRED_ZOMBIE_LOCK" với zombieEvicted: true.',
        'Bước 4 (Kiểm tra Payload Mismatch 422, Concurrent 409 và Replay 200): Đối chiếu payloadHash và status của bản ghi còn hiệu lực để trả về đúng cấu trúc yêu cầu.'
      ],
      hints: [
        'Thứ tự ưu tiên khi existingRecord tồn tại: Kiểm tra hết hạn Zombie Lock trước tiên -> Kiểm tra lệch mã băm payloadHash (422) -> Kiểm tra đang PROCESSING (409) -> Hoàn trả COMPLETED (200).',
        'Khi thu hồi Zombie Lock (zombieEvicted: true), thời hạn khóa mới lockExpiresAtMs được tính bằng incomingRequest.timestampMs + leaseTtlMs.'
      ],
      starterCode: `function evaluateIdempotencyWithLeaseTtl(existingRecord, incomingRequest, leaseTtlMs) {
  // Bước 1: Kiểm tra tính hợp lệ của incomingRequest và leaseTtlMs, ném Error("INVALID_IDEMPOTENCY_INPUT") nếu sai
  
  // Bước 2: Nếu chưa có existingRecord, cấp phát khóa mới (ACQUIRE_NEW_LOCK)
  
  // Bước 3: Kiểm tra nếu khóa PROCESSING đã quá hạn leaseTtlMs (RECOVER_EXPIRED_ZOMBIE_LOCK)
  
  // Bước 4: Xử lý REJECT_PAYLOAD_TAMPERING (422), REJECT_CONCURRENT_IN_FLIGHT (409) và RETURN_CACHED_RESPONSE
}`,
      solution: `function evaluateIdempotencyWithLeaseTtl(existingRecord, incomingRequest, leaseTtlMs) {
  if (
    !incomingRequest ||
    typeof incomingRequest.key !== 'string' ||
    incomingRequest.key.trim() === '' ||
    typeof incomingRequest.payloadHash !== 'string' ||
    incomingRequest.payloadHash.trim() === '' ||
    typeof incomingRequest.timestampMs !== 'number' ||
    incomingRequest.timestampMs < 0 ||
    typeof leaseTtlMs !== 'number' ||
    leaseTtlMs <= 0
  ) {
    throw new Error('INVALID_IDEMPOTENCY_INPUT');
  }

  const newExpiry = incomingRequest.timestampMs + leaseTtlMs;

  if (!existingRecord) {
    return {
      httpStatus: 201,
      decision: 'ACQUIRE_NEW_LOCK',
      zombieEvicted: false,
      lockExpiresAtMs: newExpiry,
    };
  }

  const elapsedMs = incomingRequest.timestampMs - existingRecord.createdAtMs;
  if (existingRecord.status === 'PROCESSING' && elapsedMs >= leaseTtlMs) {
    return {
      httpStatus: 201,
      decision: 'RECOVER_EXPIRED_ZOMBIE_LOCK',
      zombieEvicted: true,
      lockExpiresAtMs: newExpiry,
    };
  }

  const existingExpiry = existingRecord.createdAtMs + leaseTtlMs;

  if (existingRecord.payloadHash !== incomingRequest.payloadHash) {
    return {
      httpStatus: 422,
      decision: 'REJECT_PAYLOAD_TAMPERING',
      zombieEvicted: false,
      lockExpiresAtMs: existingExpiry,
    };
  }

  if (existingRecord.status === 'PROCESSING') {
    return {
      httpStatus: 409,
      decision: 'REJECT_CONCURRENT_IN_FLIGHT',
      zombieEvicted: false,
      lockExpiresAtMs: existingExpiry,
    };
  }

  return {
    httpStatus: existingRecord.cachedStatusCode || 200,
    decision: 'RETURN_CACHED_RESPONSE',
    zombieEvicted: false,
    lockExpiresAtMs: existingExpiry,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Phát hiện khóa PROCESSING đã bị treo quá hạn 90s (Zombie Lock) -> Tự động thu hồi và cấp khóa mới',
          input: [
            { status: 'PROCESSING', payloadHash: 'sha256_abc', createdAtMs: 1000 },
            { key: 'uuid_1', payloadHash: 'sha256_abc', timestampMs: 95000 },
            90000
          ],
          expected: {
            httpStatus: 201,
            decision: 'RECOVER_EXPIRED_ZOMBIE_LOCK',
            zombieEvicted: true,
            lockExpiresAtMs: 185000
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Khóa PROCESSING vẫn còn trong thời hạn thuê (mới qua 500ms) -> Chặn 409 Conflict',
          input: [
            { status: 'PROCESSING', payloadHash: 'sha256_abc', createdAtMs: 1000 },
            { key: 'uuid_1', payloadHash: 'sha256_abc', timestampMs: 1500 },
            90000
          ],
          expected: {
            httpStatus: 409,
            decision: 'REJECT_CONCURRENT_IN_FLIGHT',
            zombieEvicted: false,
            lockExpiresAtMs: 91000
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Khóa đã COMPLETED nhưng kẻ tấn công đổi nội dung Payload (khác SHA-256) -> Chặn 422',
          input: [
            { status: 'COMPLETED', payloadHash: 'sha256_original', createdAtMs: 1000, cachedStatusCode: 200 },
            { key: 'uuid_1', payloadHash: 'sha256_tampered', timestampMs: 5000 },
            90000
          ],
          expected: {
            httpStatus: 422,
            decision: 'REJECT_PAYLOAD_TAMPERING',
            zombieEvicted: false,
            lockExpiresAtMs: 91000
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Khóa đã COMPLETED và khớp mã băm SHA-256 -> Trả về kết quả đã Cache',
          input: [
            { status: 'COMPLETED', payloadHash: 'sha256_valid', createdAtMs: 2000, cachedStatusCode: 200 },
            { key: 'uuid_2', payloadHash: 'sha256_valid', timestampMs: 4000 },
            60000
          ],
          expected: {
            httpStatus: 200,
            decision: 'RETURN_CACHED_RESPONSE',
            zombieEvicted: false,
            lockExpiresAtMs: 62000
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Khóa rỗng hoặc leaseTtlMs <= 0 -> Ném lỗi INVALID_IDEMPOTENCY_INPUT',
          input: [
            null,
            { key: '   ', payloadHash: 'sha256_valid', timestampMs: 1000 },
            0
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
