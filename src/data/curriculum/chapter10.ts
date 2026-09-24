import type { Sprint } from './types.ts';

export const chapter10: Sprint = {
  sprintId: 10,
  sprintTitle: 'Chương 10: Distributed Systems, High Availability & Production Observability',
  sprintDesc: 'Đỉnh cao kiến trúc kỹ sư hệ thống: Định lý CAP & PACELC, Khả năng chịu lỗi (Circuit Breaker, Rate Limiting Sliding Window), và Giám sát toàn diện (OpenTelemetry, Structured Tracing)',
  lessons: [
    {
      id: 'c10-l1',
      title: 'Bài 01: Nền Tảng Hệ Thống Phân Tán: Định Lý CAP, PACELC & Thiết Kế Eventual Consistency',
      duration: '60 phút',
      tag: 'Distributed Systems & CAP',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐỊNH LÝ CAP, MỞ RỘNG PACELC & BẢO ĐẢM TÍNH NHẤT QUÁN CUỐI CÙNG TRONG HỆ THỐNG PHÂN TÁN (ARCHITECTURAL CONTEXT & DISTRIBUTED TRADE-OFFS)

Khi một hệ thống phần mềm vượt quá giới hạn của một máy chủ vật lý đơn lẻ và mở rộng thành một cụm nút phân tán (Distributed Cluster), kỹ sư hệ thống bắt buộc phải đối mặt với thực tế nghiệt ngã của **8 Ngộ Nhận Về Điện Toán Phân Tán (The 8 Fallacies of Distributed Computing)**, trong đó ngộ nhận nguy hiểm nhất là "Mạng luôn luôn tin cậy và không có độ trễ":
* **Tính Tất Yếu Của Phân Vùng Mạng (Network Partitions - Chữ 'P' Trong CAP):**
  - Trong môi trường mạng thực tế (đặc biệt là Cloud Data Centers), việc đứt kết nối cáp quang, nghẽn switch, độ trễ tăng vọt hoặc sập DNS giữa các vùng khả dụng (Availability Zones) là sự kiện chắc chắn sẽ xảy ra theo thời gian.
  - Khi một phân vùng mạng xuất hiện, cụm máy chủ bị chia cắt thành các phân vùng độc lập không thể trao đổi thông tin với nhau.
* **Sự Lựa Chọn Bắt Buộc Giữa CP và AP:**
  - **Hệ Thống CP (Consistency + Partition Tolerance):** Ưu tiên tính đúng đắn toán học tuyệt đối của dữ liệu. Nếu một Node bị cô lập khỏi mạng hoặc không thể đạt được sự đồng thuận Quorum (đa số phiếu bầu) từ cụm, Node đó sẽ **từ chối phục vụ (Fast-fail hoặc Timeout)** để ngăn chặn thảm họa Split-Brain và sai lệch số dư. Đại diện: PostgreSQL Clustered, ZooKeeper, etcd, Redis Sentinel/Cluster Master.
  - **Hệ Thống AP (Availability + Partition Tolerance):** Ưu tiên tính sẵn sàng phục vụ người dùng. Dù bị chia cắt mạng, từng phân vùng vẫn tiếp tục tiếp nhận thao tác đọc và ghi, chấp nhận rằng các Node ở các vùng khác nhau có thể tạm thời chứa các trạng thái dữ liệu mâu thuẫn nhau. Dữ liệu sẽ dần dần được đồng bộ hội tụ về một trạng thái đồng nhất sau khi mạng được khôi phục thông qua cơ chế **Tính Nhất Quán Cuối Cùng (Eventual Consistency)** và các giải thuật giải quyết xung đột như Vector Clocks hoặc Last-Write-Wins (LWW). Đại diện: Apache Cassandra, Amazon DynamoDB, CouchDB.
* **Định Lý Mở Rộng PACELC:**
  - Định lý CAP chỉ giải thích hành vi khi có sự cố mạng ($P$). Định lý **PACELC** của Daniel Abadi mở rộng: **P** (nếu có Partition) chọn giữa **A** và **C**; **E**lse (trong điều kiện vận hành bình thường không có lỗi mạng), hệ thống buộc phải đánh đổi giữa **L**atency (Độ trễ phản hồi) và **C**onsistency (Tính nhất quán của dữ liệu đọc).

---

# 2. ĐỊNH LÝ CAP VÀ BẢN MỞ RỘNG TOÀN DIỆN PACELC

Định lý CAP của Eric Brewer phát biểu rằng trong một hệ thống phân tán, khi xảy ra phân vùng mạng (Partition), bạn chỉ có thể chọn một trong hai: **C (Consistency)** hoặc **A (Availability)**.

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TAM GIÁC ĐỊNH LÝ CAP KINH ĐIỂN                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                  [ P ]                                      │
│                           Partition Tolerance                               │
│                         (BẮT BUỘC TRONG ĐỜI THỰC)                           │
│                                  ▲     ▲                                    │
│                     ┌────────────┘     └────────────┐                       │
│                     ▼                               ▼                       │
│                   [ CP ]                          [ AP ]                    │
│             Consistency + Partition         Availability + Partition        │
│             (PostgreSQL, Redis Master)      (Cassandra, DynamoDB, CouchDB)  │
│             Thà báo lỗi chứ không sai       Thà trả lời chậm/cũ chứ không   │
│             lệch dữ liệu tài chính!         bao giờ từ chối khách hàng!     │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Định Lý PACELC (Hiểu Rõ Trạng Thái Bình Thường)
Định lý CAP chỉ nói về lúc **GẶP SỰ CỐ MẠNG (If Partition)**. Nhưng $99.9\\%$ thời gian mạng hoàn toàn bình thường, hệ thống đánh đổi cái gì?
**Định lý PACELC trả lời:**
$$\\text{If } \\mathbf{P} \\text{ (Partition) } \\longrightarrow \\text{Choose } \\mathbf{A} \\text{ or } \\mathbf{C}; \\quad \\mathbf{E}\\text{lse } \\longrightarrow \\text{Choose } \\mathbf{L} \\text{ (Latency) or } \\mathbf{C} \\text{ (Consistency)}$$
* Khi mạng bình thường: Muốn dữ liệu đồng bộ tức thì sang 5 châu lục (**Consistency**), bạn phải chờ gói tin bay vòng quanh trái đất (**Chấp nhận Latency cao**).
* Muốn phản hồi siêu tốc trong 2 mili giây (**Low Latency**), bạn phải chấp nhận đọc từ Cache chi nhánh gần nhất (**Chấp nhận dữ liệu có thể trễ vài giây - Eventual Consistency**).

---

# 3. MẪU THIẾT KẾ GIAO DỊCH PHÂN TÁN: SAGA PATTERN (ORCHESTRATION)

Trong Microservices, chúng ta không thể dùng câu lệnh \`BEGIN TRANSACTION\` của SQL để khóa xuyên suốt 4 dịch vụ độc lập (Order, Payment, Inventory, Shipping):
* **Saga Pattern:** Chia giao dịch lớn thành một chuỗi các **Giao dịch cục bộ (Local Transactions)**.
* **Compensating Transactions (Giao dịch bù trừ / Hoàn tác logic):** Nếu bước 3 (Trừ kho) thất bại: Hệ thống không thể "Rollback" bước 2 (Đã trừ tiền thẻ tín dụng Stripe). Thay vào đó, nó kích hoạt **Giao dịch bù trừ: Gọi API Stripe Refund lại tiền** cho khách hàng!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Phân Tán (Distributed Ecosystem Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MÔ HÌNH HỆ THỐNG PHÂN TÁN                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. STRONG CONSISTENCY (CP): Consensus Protocols (Raft, Paxos, Etcd, ZK)     │
│    └── Mọi node đồng thanh nhất trí một giá trị duy nhất trước khi trả lời  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. EVENTUAL CONSISTENCY (AP): Dynamo-style, Gossip Protocol, CRDTs          │
│    └── Chấp nhận dữ liệu đồng bộ dần dần, ưu tiên tối đa tính sẵn sàng      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. SAGA ORCHESTRATOR: Điều phối giao dịch phân tán cấp ứng dụng             │
│    └── Quản lý chuỗi trạng thái: Pending -> Processed -> Compensated        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Giao Dịch Bù Trừ Của Saga Pattern (Compensating Flow)
\`\`\`diagram
[ Khách Hàng Đặt Mua Hàng ]
            │
            ├── 1. Order Service: Tạo đơn hàng PENDING ──► Thành công
            │
            ├── 2. Payment Service: Trừ tiền thẻ tín dụng ──► Thành công
            │
            ├── 3. Inventory Service: Trừ kho hàng ──────► THẤT BÀI (HẾT HÀNG TRONG KHO!)
            │                                                      │
            │  [ KÍCH HOẠT CHUỖI GIAO DỊCH BÙ TRỪ HOÀN TÁC ]       │
            │                                                      ▼
            ├── 4. Bù trừ 1: Payment Service ◄── HOÀN LẠI TIỀN (Stripe Refund)
            │
            └── 5. Bù trừ 2: Order Service ◄──── ĐỔI TRẠNG THÁI: CANCELLED
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Kiến Trúc Nhất Quán (Consistency Decision Tree)
\`\`\`diagram
BẠN ĐANG THIẾT KẾ LƯU TRỮ PHÂN TÁN CHO TÀI NGUYÊN NÀO?
│
├── Là Số dư tài khoản ngân hàng, Vé xem phim, Hàng tồn kho hữu hạn?
│   └──► BẮT BUỘC: CP (Strong Consistency với Raft / PostgreSQL Master)
│
└── Là Lượt Like Facebook, Số view video Youtube, Giỏ hàng thương mại điện tử?
    └──► CHỌN: AP (Eventual Consistency: Cho phép hiển thị chậm vài giây để đạt High Scale)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Hệ Quản Trị / Cơ Chế | Phân Loại CAP | Đặc Tính Bình Thường (PACELC) | Phù Hợp Nghiệp Vụ | Điểm Cần Chú Ý |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Master** | CP | PC/EC (Ưu tiên nhất quán) | Tài chính, kế toán, hóa đơn | Không scale ghi đa vùng (Multi-write) |
| **Cassandra / ScyllaDB**| AP | PA/EL (Ưu tiên độ trễ thấp) | Time-series, IoT, Chat log | Có thể đọc phải dữ liệu cũ nếu trễ sync |
| **MongoDB (Default)** | CP | PC/EC (Chỉ ghi Master) | Document CRUD chuẩn | Phải cấu hình w:majority |
| **Saga Orchestrator** | Ứng dụng | Quản lý bằng State Machine | E-commerce checkout đa dịch vụ | Bắt buộc các API bù trừ phải Idempotent |
`,
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';

export enum OrderStepStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Injectable()
export class SagaOrderOrchestrator {
  private readonly logger = new Logger(SagaOrderOrchestrator.name);

  /**
   * Minh họa chuỗi điều phối Saga có giao dịch bù trừ (Compensating Transactions)
   */
  public async executeOrderSaga(orderId: string, amount: number): Promise<boolean> {
    this.logger.log(\`[SAGA START] Bắt đầu điều phối đơn hàng: \${orderId}\`);

    // Bước 1: Trừ tiền khách hàng
    const paymentSuccess = await this.chargePayment(orderId, amount);
    if (!paymentSuccess) {
      this.logger.error(\`[SAGA FAIL] Trừ tiền thất bại. Hủy đơn!\`);
      return false;
    }

    // Bước 2: Trừ hàng tồn kho
    const inventorySuccess = await this.reserveInventory(orderId);
    if (!inventorySuccess) {
      this.logger.warn(\`[SAGA ALERT] Hết hàng trong kho! Kích hoạt giao dịch bù trừ...\`);

      // BÙ TRỪ: Hoàn lại tiền đã trừ ở Bước 1
      await this.refundPayment(orderId, amount);
      return false;
    }

    this.logger.log(\`[SAGA SUCCESS] Giao dịch phân tán hoàn tất mỹ mãn!\`);
    return true;
  }

  private async chargePayment(orderId: string, amount: number): Promise<boolean> {
    this.logger.log(\`Đã trừ \${amount}đ cho đơn hàng \${orderId}\`);
    return true;
  }

  private async reserveInventory(orderId: string): Promise<boolean> {
    // Giả lập kho hàng bị hết hàng
    this.logger.warn(\`Kho hàng hết sản phẩm cho đơn \${orderId}\`);
    return false;
  }

  private async refundPayment(orderId: string, amount: number): Promise<void> {
    this.logger.log(\`[COMPENSATION] Đã hoàn trả lại \${amount}đ cho đơn \${orderId}\`);
  }
}
`,
      quiz: [
        {
          id: 'c10-l1-q1',
          question: 'Theo định lý CAP, vì sao trong một hệ thống phân tán thực tế chúng ta KHÔNG THỂ đồng thời có cả tính Nhất quán hoàn hảo (C) và tính Sẵn sàng 100% (A)?',
          options: [
            'Vì khi xảy ra phân vùng mạng (Partition), hệ thống buộc phải chọn giữa việc từ chối để bảo vệ dữ liệu hoặc phục vụ nhưng chấp nhận sai lệch.',
            'Vì các đường dây cáp quang biển quốc tế chỉ hỗ trợ truyền tải dữ liệu theo một chiều duy nhất trong suốt thời gian có giông bão.',
            'Vì các máy chủ đám mây hiện đại bị giới hạn bởi luật an ninh mạng quốc tế không cho phép chạy quá ba tiến trình cùng lúc.',
            'Vì chi phí mua bản quyền phần mềm cho cả hai tính năng cùng lúc vượt quá khả năng tài chính của các tập đoàn công nghệ lớn.',
          ],
          correctIndex: 0,
          explanation: 'Phân vùng mạng (Partition Tolerance - P) là hiện tượng vật lý chắc chắn sẽ xảy ra (đứt cáp, rớt gói tin). Khi mạng giữa 2 node bị đứt: Nếu cho phép ghi ở Node A, Node B sẽ không thể biết -> vi phạm Nhất quán (C). Nếu muốn giữ Nhất quán (C), Node B buộc phải từ chối phục vụ -> hy sinh Tính sẵn sàng (A). Do đó chỉ có thể chọn CP hoặc AP khi có sự cố mạng.'
        },
        {
          id: 'c10-l1-q2',
          question: 'Định lý PACELC mở rộng định lý CAP bằng cách giải thích sự đánh đổi cốt tử nào của hệ thống trong điều kiện bình thường (khi mạng KHÔNG bị đứt)?',
          options: [
            'Đánh đổi giữa độ trễ phản hồi (Latency) và tính nhất quán dữ liệu (Consistency) khi đồng bộ qua các khoảng cách địa lý.',
            'Đánh đổi giữa chi phí tiền điện của trung tâm dữ liệu và số lượng quạt làm mát gắn trên các thanh RAM máy chủ.',
            'Đánh đổi giữa dung lượng bộ nhớ đệm CPU L1 và tốc độ quay vòng của ổ đĩa cứng cơ học truyền thống.',
            'Đánh đổi giữa việc sử dụng ngôn ngữ lập trình TypeScript và việc sử dụng ngôn ngữ lập trình Python trong dự án.',
          ],
          correctIndex: 0,
          explanation: 'Định lý PACELC nêu rõ: Nếu có phân vùng (If Partition) thì chọn Availability hay Consistency; ELSE (bình thường) thì chọn Latency (L) hay Consistency (C). Trong điều kiện bình thường, muốn dữ liệu nhất quán tức thì giữa Mỹ và Việt Nam thì phải chờ gói tin truyền qua nửa vòng trái đất (chấp nhận Latency cao); muốn phản hồi tức thì (Low Latency) thì phải chấp nhận đọc dữ liệu cũ trễ vài giây (Eventual Consistency).'
        },
        {
          id: 'c10-l1-q3',
          question: 'Trong mẫu kiến trúc Saga Pattern điều phối giao dịch phân tán giữa các Microservices, "Giao dịch bù trừ" (Compensating Transaction) đóng vai trò gì?',
          options: [
            'Là hành động hoàn tác logic nghiệp vụ (như hoàn tiền, hủy vé) để đưa hệ thống về trạng thái nhất quán khi một bước phía sau bị thất bại.',
            'Là việc cơ sở dữ liệu tự động phục hồi lại các tệp tin hình ảnh đã bị người dùng xóa nhầm khỏi thùng rác máy tính.',
            'Là câu lệnh SQL Rollback truyền thống khóa cứng toàn bộ các bảng dữ liệu trên tất cả các máy chủ đám mây của doanh nghiệp.',
            'Là cơ chế tự động trả thêm tiền thưởng cho các kỹ sư trực đêm khi hệ thống gặp sự cố mất kết nối mạng ngoài giờ.',
          ],
          correctIndex: 0,
          explanation: 'Trong Microservices, mỗi service có Database riêng nên không thể dùng SQL Rollback xuyên service. Khi Bước 3 (trừ kho) bị lỗi sau khi Bước 2 (trừ tiền) đã commit thành công, ta bắt buộc phải chạy một Compensating Transaction: một hành động nghiệp vụ đảo ngược (như gọi Stripe Refund lại số tiền đã trừ ở Bước 2) để đưa toàn hệ thống về trạng thái cân bằng.'
        },
        {
          id: 'c10-l1-q4',
          question: 'Khái niệm "Eventual Consistency" (Tính nhất quán cuối cùng) trong các hệ thống NoSQL quy mô lớn biểu thị đặc tính vận hành nào?',
          options: [
            'Dữ liệu có thể tạm thời không đồng nhất giữa các bản sao tại thời điểm đọc, nhưng chắc chắn sẽ hội tụ về cùng một giá trị sau một khoảng thời gian.',
            'Hệ thống đảm bảo dữ liệu sẽ biến mất vĩnh viễn khỏi các máy chủ sau đúng hai mươi bốn giờ kể từ khi được tạo ra.',
            'Người dùng chỉ có thể thực hiện các câu lệnh đọc dữ liệu vào những ngày cuối cùng của mỗi tháng theo lịch dương.',
            'Tất cả các giao dịch tài chính bắt buộc phải có sự phê duyệt thủ công bằng văn bản giấy tờ có chữ ký của giám đốc.',
          ],
          correctIndex: 0,
          explanation: 'Eventual Consistency là mô hình nhất quán trong đó các bản sao (Replicas) không đảm bảo phản ánh dữ liệu mới nhất ngay lập tức tại cùng một mili giây. Tuy nhiên, nếu không có cập nhật mới nào phát sinh, sau một khoảng thời gian ngắn (vài ms đến vài giây để sync qua mạng), toàn bộ các bản sao sẽ hội tụ và đạt được sự đồng nhất hoàn hảo $100\\%$.'
        }
      ],
      codeChallenge: {
        id: 'c10-l1-c1',
        title: 'Mô Phỏng Saga Compensating Transaction Runner',
        description: 'Hiện thực hàm \`executeSagaSteps(steps: Array<{ name: string; execute: () => boolean; compensate: () => void }>): { success: boolean; executedSteps: string[]; compensatedSteps: string[] }\`. Thực thi tuần tự từng bước trong mảng. Nếu một bước trả về \`false\` (thất bại): lập tức dừng lại, chạy các hàm \`compensate()\` của toàn bộ các bước đã thành công trước đó theo THỨ TỰ ĐẢO NGƯỢC (LIFO) và trả về \`success: false\`. Nếu tất cả đều thành công, trả về \`success: true\`.',
        starterCode: `
export function executeSagaSteps(
  steps: Array<{ name: string; execute: () => boolean; compensate: () => void }>
): {
  success: boolean;
  executedSteps: string[];
  compensatedSteps: string[]
} {
  // TODO: Hiện thực điều phối chuỗi Saga và bù trừ đảo ngược khi có lỗi
  return { success: false, executedSteps: [], compensatedSteps: [] };
}
`,
        solution: `
export function executeSagaSteps(
  steps: Array<{ name: string; execute: () => boolean; compensate: () => void }>
): {
  success: boolean;
  executedSteps: string[];
  compensatedSteps: string[];
} {
  const executedSteps: string[] = [];
  const successfulSteps: Array<{ name: string; compensate: () => void }> = [];

  for (const step of steps) {
    executedSteps.push(step.name);
    const isOk = step.execute();

    if (!isOk) {
      // Thất bại: Chạy bù trừ cho các bước đã thành công trước đó theo thứ tự đảo ngược
      const compensatedSteps: string[] = [];
      while (successfulSteps.length > 0) {
        const toCompensate = successfulSteps.pop()!;
        toCompensate.compensate();
        compensatedSteps.push(toCompensate.name);
      }

      return {
        success: false,
        executedSteps,
        compensatedSteps,
      };
    }

    successfulSteps.push(step);
  }

  return {
    success: true,
    executedSteps,
    compensatedSteps: [],
  };
}
`,
        testCases: [
          {
            name: 'Thực thi chuỗi Saga thành công hoàn toàn 3 bước',
            input: [[
              { name: 'Step1', execute: () => true, compensate: () => {} },
              { name: 'Step2', execute: () => true, compensate: () => {} },
              { name: 'Step3', execute: () => true, compensate: () => {} }
            ]],
            expected: {
              success: true,
              executedSteps: ['Step1', 'Step2', 'Step3'],
              compensatedSteps: []
            }
          },
          {
            name: 'Bước 3 thất bại kích hoạt bù trừ ngược Bước 2 rồi Bước 1',
            input: [[
              { name: 'Step1', execute: () => true, compensate: () => {} },
              { name: 'Step2', execute: () => true, compensate: () => {} },
              { name: 'Step3', execute: () => false, compensate: () => {} }
            ]],
            expected: {
              success: false,
              executedSteps: ['Step1', 'Step2', 'Step3'],
              compensatedSteps: ['Step2', 'Step1']
            }
          }
        ]
      }
    },
    {
      id: 'c10-l2',
      title: 'Bài 02: Resiliency Patterns: Circuit Breaker, Rate Limiting (Token Bucket / Sliding Window) & Bulkhead',
      duration: '60 phút',
      tag: 'System Resiliency & Rate Limiting',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: NGUYÊN LÝ THIẾT KẾ KHẢ NĂNG CHỊU LỖI (DESIGN FOR FAILURE) & CÁC MẪU HÌNH KHẢ NĂNG PHỤC HỒI (ARCHITECTURAL CONTEXT & RESILIENCE PATTERNS)

Trong kiến trúc Microservices phân tán gồm hàng chục dịch vụ phụ thuộc chéo nhau, lỗi phần cứng, nghẽn mạng và suy giảm hiệu năng của các dịch vụ bên thứ ba (Third-party APIs) không phải là ngoại lệ hiếm hoi mà là quy luật hoạt động thường nhật. Một hệ thống không có cơ chế tự vệ sẽ nhanh chóng sụp đổ dây chuyền khi một mắt xích gặp sự cố:
* **Hiểm Họa Cạn Kiệt Tài Nguyên Do Dịch Vụ Cấp Dưới Suy Thoái (Downstream Degradation & Resource Exhaustion):**
  - Giả sử Cổng thanh toán đối tác bị chậm và mất 30 giây mới phản hồi hoặc bị timeout.
  - Khi người dùng gửi yêu cầu, mỗi kết nối HTTP tới cổng thanh toán sẽ giam lỏng một Socket kết nối, một luồng bộ đệm và một kết nối trong Hồ bơi kết nối (Connection Pool).
  - Với lưu lượng vài nghìn requests, toàn bộ tài nguyên CPU, bộ nhớ RAM và Connection Pool của dịch vụ phía trên (Upstream Service) bị vắt kiệt. Hậu quả: Dịch vụ chính bị tê liệt hoàn toàn, không thể phục vụ ngay cả những tính năng cơ bản không liên quan đến thanh toán!
* **Mẫu Hình Ngắt Mạch Tự Động (Circuit Breaker Pattern):**
  - Giám sát tỉ lệ lỗi và độ trễ phản hồi của các lệnh gọi dịch vụ bên ngoài trong một cửa sổ thời gian trượt (Sliding Time Window).
  - Khi tỉ lệ lỗi vượt ngưỡng tới hạn (ví dụ $> 50\\%$), Circuit Breaker lập tức chuyển sang trạng thái **\`OPEN\` (Mở mạch / Ngắt cầu chì)**: Mọi yêu cầu tiếp theo bị từ chối ngay lập tức tại chỗ trong $0\\text{ ms}$ (**Fast-fail**), bảo vệ tuyệt đối Connection Pool và bộ nhớ của hệ thống.
  - Sau một khoảng thời gian chờ hồi phục (\`sleepWindowInMilliseconds\`), Circuit Breaker chuyển sang trạng thái **\`HALF-OPEN\` (Nửa mở)**: Cho phép một lượng nhỏ request thăm dò đi qua. Nếu các request này thành công, mạch tự động đóng lại (**\`CLOSED\`**); nếu vẫn thất bại, mạch tiếp tục ngắt để bảo vệ hệ thống.
* **Mẫu Hình Phân Vùng Cách Ly Tài Nguyên (Bulkhead Pattern):**
  - Lấy cảm hứng từ các vách ngăn kín nước trong thân tàu thủy: Ngăn không cho nước từ một khoang bị thủng tràn sang làm chìm toàn bộ con tàu.
  - Trong kiến trúc phần mềm, Bulkhead cô lập tài nguyên độc lập (chia nhỏ Connection Pools, Worker Pools, và CPU/RAM Limits) cho từng phân hệ nghiệp vụ khác nhau. Sự cố nghẽn mạng ở phân hệ Xuất báo cáo dung lượng lớn (Report Generation) bị giới hạn trong phân vùng tài nguyên của nó, bảo đảm $100\\%$ không ảnh hưởng đến phân hệ Đặt hàng và Đăng nhập của người dùng.

---

# 2. BA TRẠNG THÁI CỦA CẦU CHÌ CIRCUIT BREAKER

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3 TRẠNG THÁI CỦA CIRCUIT BREAKER                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                               [ CLOSED ]                                    │
│                 (Mạch đóng: Trạng thái bình thường)                         │
│                 Mọi request được chuyển tiếp tới đối tác.                   │
│                                    │                                        │
│                                    ▼ (Tỉ lệ lỗi > 50% trong cửa sổ đo)      │
│                                [ OPEN ]                                     │
│                 (Mạch mở: Ngắt cầu dao khẩn cấp!)                           │
│                 Chặn đứng 100% request, trả lỗi ngay trong 0ms (Fast-fail).  │
│                                    │                                        │
│                                    ▼ (Sau thời gian hồi phục: vd 30s)       │
│                              [ HALF-OPEN ]                                  │
│                 (Mạch nửa mở: Cho 1-2 request thăm dò)                      │
│                                    │                                        │
│               ┌────────────────────┴────────────────────┐                   │
│               ▼ (Thăm dò thành công)                    ▼ (Vẫn còn lỗi)     │
│          [ CLOSED ]                                  [ OPEN ]               │
│     (Bình phục hoàn toàn)                     (Tiếp tục ngắt thêm 30s)      │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

# 3. THUẬT TOÁN GIỚI HẠN TỐC ĐỘ: SLIDING WINDOW LOG VỚI REDIS ZSET

So với thuật toán Fixed Window bị lỗi x2 tải ở ranh giới phút:
**Sliding Window Log (Cửa sổ trượt chính xác tuyệt đối)** dùng Redis Sorted Set:

\`\`\`diagram
[ REDIS SORTED SET: rate_limit:user_123 ]
Keys: User IP/ID | Members: uuid | Scores: Timestamp hiện tại (Epoch Millis)
│
├── 1. Xóa các request cũ nằm ngoài cửa sổ:
│      ZREMRANGEBYSCORE rate_limit:user_123 0 (Now - 60000)
│
├── 2. Đếm số lượng request còn lại trong 60 giây qua:
│      ZCARD rate_limit:user_123
│
├── 3. Nếu ZCARD >= 100 ──► Ném lỗi HTTP 429 Too Many Requests!
│
└── 4. Nếu ZCARD < 100  ──► Cho phép đi tiếp và ghi nhận request mới:
       ZADD rate_limit:user_123 Now uuid
       EXPIRE rate_limit:user_123 60
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Các Mẫu Hình Chịu Lỗi Hệ Thống (Resiliency Patterns Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KIẾN TRÚC HỆ THỐNG TỰ PHỤC HỒI                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. TRAFFIC GOVERNANCE (Điều tiết lưu lượng đầu vào)                         │
│    └── Rate Limiting (Token Bucket / Sliding Window Log), Concurrency Limit  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. FAILURE ISOLATION (Cách ly thảm họa lan truyền)                          │
│    ├── Circuit Breaker: Ngắt kết nối các dịch vụ đang suy sụp (Fail-fast)   │
│    └── Bulkhead: Tách rời Thread Pool và Database Pool giữa các miền         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TRANSIENT TOLERANCE (Khắc phục lỗi tạm thời)                             │
│    ├── Retry with Exponential Backoff + Jitter                              │
│    └── Timeouts & Deadlines: Luôn đặt hạn thời gian cho mọi lệnh I/O         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Quyết Định Của Sliding Window Rate Limiter (Limiter Flow)
\`\`\`diagram
Request từ IP: 1.2.3.4 gửi đến
   │
   ▼
Dọn dẹp Redis: ZREMRANGEBYSCORE key 0 (Now - WindowMs)
   │
   ▼
Lấy tổng số request trong cửa sổ: count = ZCARD key
   │
   ├── [ count >= MaxAllowedRequests ]
   │      └──► NÉM LỖI 429 TOO MANY REQUESTS! (Kèm Retry-After Header)
   │
   └── [ count < MaxAllowedRequests ]
          ├── Ghi nhận request: ZADD key Now uniqueId
          ├── Thiết lập TTL tự động dọn dẹp RAM
          └── Chuyển tiếp request vào Controller xử lý bình thường!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Thuật Toán Rate Limiting (Limiter Decision Tree)
\`\`\`diagram
BẠN CẦN GIỚI HẠN TỐC ĐỘ TRUY CẬP (RATE LIMITING)?
│
├── Cần độ chính xác tuyệt đối từng mili giây, không chấp nhận burst ở biên giới?
│   └──► DÙNG: Sliding Window Log (Dùng Redis ZSET)
│
├── Cần xử lý hàng triệu request/giây với chi phí bộ nhớ RAM thấp nhất?
│   └──► DÙNG: Token Bucket / Leaky Bucket (Thư viện Redis Token Bucket)
│
└── Ứng dụng nội bộ đơn giản, chấp nhận sai số nhỏ?
    └──► DÙNG: Fixed Window Counter (INCR key + EXPIRE 60)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế Chịu Lỗi | Tiêu Tốn Bộ Nhớ | Mức Độ Bảo Vệ Máy Chủ | Độ Phức Tạp Thuật Toán | Kịch Bản Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **Circuit Breaker** | Cực thấp (Đếm lỗi) | Bảo vệ $100\\%$ chống sập dây chuyền| Trung bình (State Machine)| Mọi lời gọi HTTP/RPC ngoại vi |
| **Sliding Window Log** | Cao hơn (Lưu timestamp ZSET)| Hoàn hảo nhất | Trung bình (Lua Script) | Bảo vệ cổng Payment, Login |
| **Token Bucket** | Cực thấp (Chỉ lưu 2 số) | Xuất sắc, hỗ trợ traffic burst| Thấp | Rate Limit API Gateway tổng |
| **Bulkhead Pool** | Cần chia nhỏ tài nguyên | Ngăn chặn cạn kiệt tài nguyên chéo| Rất dễ cấu hình | Tách Pool cho tác vụ VIP và thường |
`,
      realCodeSnippet: `
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

@Injectable()
export class CircuitBreakerService {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 3; // 3 lần lỗi là mở cầu chì
  private readonly cooldownPeriodMs = 10000; // 10 giây hồi phục

  public async executeWithBreaker<T>(action: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // 1. Kiểm tra trạng thái OPEN: Đã hết thời gian làm nguội chưa?
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.cooldownPeriodMs) {
        this.state = CircuitState.HALF_OPEN; // Chuyển sang thăm dò
      } else {
        throw new HttpException(
          'Dịch vụ tạm thời không khả dụng (Circuit Breaker OPEN). Vui lòng thử lại sau.',
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
    }

    try {
      const result = await action();

      // Nếu thăm dò thành công ở trạng thái HALF_OPEN -> Đóng cầu chì bình thường trở lại
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // Vượt ngưỡng lỗi -> Mở cầu dao Circuit Breaker!
      if (this.failureCount >= this.failureThreshold) {
        this.state = CircuitState.OPEN;
      }

      throw error;
    }
  }
}
`,
      quiz: [
        {
          id: 'c10-l2-q1',
          question: 'Hiện tượng "Cascading Failure" (Sập đổ dây chuyền) trong kiến trúc Microservices xảy ra do nguyên nhân nào và được ngăn chặn bởi mẫu thiết kế nào?',
          options: [
            'Một service bị chậm khiến các service gọi nó bị nghẽn connection pool và sập hàng loạt; ngăn chặn bằng mẫu Circuit Breaker.',
            'Do các máy chủ bị mất điện đồng thời trên toàn bộ các quốc gia; ngăn chặn bằng cách chuyển đổi sang sử dụng năng lượng mặt trời.',
            'Do các lập trình viên sử dụng các biến toàn cục trong mã nguồn JavaScript; ngăn chặn bằng cách cài đặt công cụ ESLint.',
            'Do các bảng dữ liệu trong cơ sở dữ liệu quan hệ bị thiếu các khóa ngoại; ngăn chặn bằng cách viết lại các câu lệnh CREATE TABLE.',
          ],
          correctIndex: 0,
          explanation: 'Cascading Failure xảy ra khi Service C bị chậm/chết. Service B gọi C phải chờ timeout (ví dụ 30s). Hàng nghìn request dồn vào B làm cạn kiệt toàn bộ luồng và RAM của B khiến B sập. Tiếp tục Service A gọi B cũng bị sập theo, làm toàn bộ hệ thống sụp đổ dây chuyền. Circuit Breaker chặn đứng thảm họa này bằng cách tự động ngắt mạch (OPEN), trả lỗi ngay lập tức mà không chờ đợi, cứu sống các service phía trước.'
        },
        {
          id: 'c10-l2-q2',
          question: 'Thuật toán Sliding Window Log (Cửa sổ trượt) giải quyết nhược điểm nguy hiểm nào của thuật toán Fixed Window Counter trong Rate Limiting?',
          options: [
            'Khắc phục hiện tượng lưu lượng truy cập bị tăng đột biến gấp đôi ở ranh giới giữa hai khung thời gian cố định liên tiếp.',
            'Tự động tăng tốc độ xử lý của CPU máy chủ lên gấp mười lần bằng cách loại bỏ việc kết nối tới cơ sở dữ liệu Redis.',
            'Cho phép người dùng có thể gửi vô hạn số lượng yêu cầu trong một giây mà không bị giới hạn bởi phần cứng máy tính.',
            'Chuyển đổi toàn bộ các yêu cầu HTTP bị từ chối thành các thông báo quảng cáo thương mại có trả phí cho doanh nghiệp.',
          ],
          correctIndex: 0,
          explanation: 'Với Fixed Window (ví dụ giới hạn 100 req/phút): Nếu người dùng gửi 100 request ở giây thứ 59, và tiếp tục gửi 100 request ở giây thứ 01 của phút tiếp theo, thì trong khoảng thời gian chỉ 2 giây hệ thống phải chịu tới 200 requests (gấp đôi giới hạn!). Sliding Window Log tính toán chính xác cửa sổ 60 giây trượt liên tục theo thời gian thực, triệt tiêu hoàn toàn lỗi ranh giới này.'
        },
        {
          id: 'c10-l2-q3',
          question: 'Mẫu thiết kế "Bulkhead Pattern" (Vách ngăn khoang tàu) trong kiến trúc hệ thống hoạt động dựa trên nguyên lý kỹ thuật nào?',
          options: [
            'Phân chia và cô lập tài nguyên phần cứng như Thread Pool và Connection Pool thành các phân vùng độc lập để sự cố ở một vùng không làm chìm toàn bộ hệ thống.',
            'Tự động sao lưu toàn bộ mã nguồn của dự án lên các kho lưu trữ trực tuyến công khai để ngăn chặn nguy cơ mất mát dữ liệu.',
            'Ép buộc tất cả các lập trình viên phải sử dụng cùng một phiên bản trình duyệt web khi tiến hành kiểm thử các chức năng phần mềm.',
            'Chuyển đổi toàn bộ các kết nối mạng sang sử dụng các đường truyền vệ tinh quỹ đạo thấp để giảm bớt độ trễ đường truyền.',
          ],
          correctIndex: 0,
          explanation: 'Lấy cảm hứng từ vách ngăn chống chìm của tàu thủy: Bulkhead Pattern chia tách tài nguyên (như Database Connection Pool hay Thread Pool) thành các khoang riêng biệt. Ví dụ: Dành riêng 20 kết nối cho các API thanh toán cốt lõi, và 10 kết nối cho tính năng xuất báo cáo nặng. Khi tính năng báo cáo làm nghẽn sạch 10 kết nối của nó, 20 kết nối thanh toán vẫn hoàn toàn an toàn và hoạt động bình thường.'
        },
        {
          id: 'c10-l2-q4',
          question: 'Khi Circuit Breaker đang ở trạng thái HALF-OPEN (Nửa mở), hệ thống sẽ hành xử như thế nào đối với các yêu cầu tiếp theo từ người dùng?',
          options: [
            'Cho phép một số lượng nhỏ yêu cầu thăm dò đi qua tới dịch vụ đích để kiểm tra xem dịch vụ đó đã thực sự bình phục hay chưa.',
            'Tự động từ chối một trăm phần trăm tất cả các yêu cầu và yêu cầu người dùng phải khởi động lại máy tính cá nhân.',
            'Chuyển toàn bộ các yêu cầu sang thực thi trên một máy chủ dự phòng đặt tại một quốc gia khác trên thế giới.',
            'Tự động gửi thông báo tin nhắn văn bản SMS tới số điện thoại của tất cả các khách hàng đang sử dụng dịch vụ.',
          ],
          correctIndex: 0,
          explanation: 'Trạng thái HALF-OPEN là trạng thái thử nghiệm: Sau một khoảng thời gian làm nguội (cooldown period), Circuit Breaker cho phép một vài request thăm dò (trial requests) đi qua tới dịch vụ đích. Nếu các request này thành công mỹ mãn, nó nhận định dịch vụ đã bình phục và chuyển về CLOSED. Nếu vẫn thất bại, nó lập tức bật ngược về OPEN và tiếp tục ngắt mạch.'
        }
      ],
      codeChallenge: {
        id: 'c10-l2-c1',
        title: 'Mô Phỏng Circuit Breaker State Machine Tracker',
        description: 'Hiện thực hàm \`simulateCircuitBreaker(events: Array<"SUCCESS" | "FAIL">, failureThreshold: number): { finalState: "CLOSED" | "OPEN"; failuresRecorded: number }\`. Bắt đầu từ trạng thái \`"CLOSED"\` với \`failuresRecorded = 0\`. Với mỗi event: nếu là \`"FAIL"\`, tăng \`failuresRecorded\`; nếu \`failuresRecorded >= failureThreshold\`, chuyển trạng thái thành \`"OPEN"\`. Nếu là \`"SUCCESS"\` khi đang \`"CLOSED"\`, reset \`failuresRecorded = 0\`. Khi đã ở \`"OPEN"\`, các event sau giữ nguyên trạng thái \`"OPEN"\`. Trả về kết quả cuối cùng.',
        starterCode: `
export function simulateCircuitBreaker(
  events: Array<'SUCCESS' | 'FAIL'>,
  failureThreshold: number
): { finalState: 'CLOSED' | 'OPEN'; failuresRecorded: number } {
  // TODO: Hiện thực chuyển đổi trạng thái Circuit Breaker
  return { finalState: 'CLOSED', failuresRecorded: 0 };
}
`,
        solution: `
export function simulateCircuitBreaker(
  events: Array<'SUCCESS' | 'FAIL'>,
  failureThreshold: number
): { finalState: 'CLOSED' | 'OPEN'; failuresRecorded: number } {
  let state: 'CLOSED' | 'OPEN' = 'CLOSED';
  let failuresRecorded = 0;

  for (const event of events) {
    if (state === 'OPEN') {
      // Khi đã ngắt mạch thì giữ nguyên
      continue;
    }

    if (event === 'FAIL') {
      failuresRecorded++;
      if (failuresRecorded >= failureThreshold) {
        state = 'OPEN';
      }
    } else if (event === 'SUCCESS') {
      failuresRecorded = 0;
    }
  }

  return { finalState: state, failuresRecorded };
}
`,
        testCases: [
          {
            name: 'Hoạt động bình thường với vài lỗi rải rác xen kẽ thành công (threshold = 3)',
            input: [['FAIL', 'SUCCESS', 'FAIL', 'SUCCESS'], 3],
            expected: { finalState: 'CLOSED', failuresRecorded: 0 }
          },
          {
            name: 'Mở cầu chì khi gặp 3 lỗi liên tiếp đạt ngưỡng threshold = 3',
            input: [['FAIL', 'FAIL', 'FAIL', 'SUCCESS'], 3],
            expected: { finalState: 'OPEN', failuresRecorded: 3 }
          }
        ]
      }
    },
    {
      id: 'c10-l3',
      title: 'Bài 03: Production Observability: Structured Logging, Distributed Tracing (OpenTelemetry) & Health Probes',
      duration: '60 phút',
      tag: 'Observability & OpenTelemetry',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: BA TRỤ CỘT CỦA PRODUCTION OBSERVABILITY & TRUY VẾT PHÂN TÁN VỚI OPENTELEMETRY (ARCHITECTURAL CONTEXT & OBSERVABILITY)

Khi một hệ thống phân tán bao gồm hàng chục dịch vụ chạy trên các cụm Kubernetes phục vụ hàng triệu người dùng, việc điều tra sự cố (Troubleshooting) và phân tích nguyên nhân gốc rễ (Root Cause Analysis) không thể dựa vào phương pháp ghi log văn bản tự do truyền thống (\`console.log\`):
* **Sự Thất Bại Của Plaintext Logs Trong Môi Trường Cloud-Native:**
  - Giữa một cụm gồm 100 Container in ra hàng triệu dòng text ngẫu nhiên mỗi phút: Khi một người dùng phản ánh "Đơn hàng bị trừ tiền nhưng không nhận được vé", kỹ sư hoàn toàn không thể biết lỗi phát sinh từ request nào, do Worker nào xử lý và đã đi qua những mắt xích nào trong mạng lưới.
  - Plaintext logs không thể tìm kiếm, không thể lọc theo trường (Field Indexing), không thể tổng hợp chỉ số (Aggregation) và tiêu tốn dung lượng lưu trữ khổng lồ mà không mang lại giá trị chẩn đoán.
* **Ba Trụ Cột Của Khả Năng Quan Sát Toàn Diện (The Three Pillars of Observability):**
  - **1. Structured Logging (Ghi log có cấu trúc chuẩn hóa):** Toàn bộ nhật ký ứng dụng bắt buộc phải xuất ra định dạng JSON chuẩn: \`{ timestamp, level, traceId, spanId, service, userId, durationMs, error }\`. Cho phép các hệ thống thu thập log tập trung (Grafana Loki, Elasticsearch/ELK, Datadog) lập chỉ mục trường dữ liệu, vẽ biểu đồ cảnh báo và lọc lỗi trong nháy mắt.
  - **2. Metrics (Chỉ số đo lường hiệu năng):** Các bộ đếm định lượng (Counters, Gauges, Histograms) phản ánh sức khỏe hệ thống: Tần suất yêu cầu (RPS), tỉ lệ lỗi ($4\\text{xx}/5\\text{xx}$ Rate), mức tiêu thụ CPU/RAM, và độ trễ phân vị (**P95/P99 Latency**) cung cấp qua endpoint Prometheus (\`/metrics\`).
  - **3. Distributed Tracing (Truy vết phân tán theo chuẩn W3C TraceContext):** Khi một HTTP Request chạm vào API Gateway, một định danh duy nhất (**\`traceId\`**) được sinh ra. Mã định danh này được truyền tuần tự qua mọi gói tin mạng (qua HTTP Header \`traceparent\`), xuyên suốt các dịch vụ: \`Gateway -> OrderService -> PaymentService -> Database -> Redis\`. Thông qua công cụ chuẩn hóa **OpenTelemetry (OTel)** và Jaeger, kỹ sư có thể quan sát một biểu đồ Gantt chi tiết: Biết chính xác câu lệnh SQL nào ở tầng cuối cùng chiếm mất $1.2$ giây trong tổng số $1.5$ giây của toàn bộ luồng yêu cầu!
* **Kubernetes Health Probes (Cơ Chế Phục Hồi Tự Động):**
  - **Liveness Probe:** Giám sát xem tiến trình Node.js có bị kẹt (Deadlock, Event Loop Lag vô hạn) hay không. Nếu Liveness Probe thất bại, Kubernetes lập tức khai tử và tái sinh Container (Pod Restart).
  - **Readiness Probe:** Giám sát xem Pod đã sẵn sàng tiếp nhận lưu lượng mạng từ người dùng hay chưa (đã kết nối xong Database, nạp xong Cache và tải xong cấu hình). Nếu Readiness Probe thất bại, Pod tạm thời bị rút khỏi Load Balancer (Service Endpoint), ngăn chặn việc người dùng nhận lỗi $502/503$ trong quá trình khởi động hoặc triển khai phiên bản mới (Zero-Downtime Rolling Deployment).

---

# 2. CHUẨN MẬT MÃ TRUY VẾT W3C TRACE CONTEXT (TRACEPARENT HEADER)

Để các hệ thống phân tán đa ngôn ngữ (Node.js, Go, Java, Python) có thể cùng theo dõi một luồng dữ liệu, tổ chức W3C đã chuẩn hóa Header **\`traceparent\`**:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ĐỊNH DẠNG W3C TRACEPARENT HEADER                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Ví dụ: traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01│
├─────────┬──────────────────────────────────┬──────────────────┬─────────────┤
│ Version │ Trace ID (16 bytes = 32 hex chars│ Parent Span ID   │ Trace Flags │
│ (00)    │ Định danh xuyên suốt toàn chuỗi) │ (8 bytes = 16 hex│ (01 = Sample│
└─────────┴──────────────────────────────────┴──────────────────┴─────────────┘
\`\`\`

---

# 3. KUBERNETES PROBES: LIVENESS VS READINESS VS STARTUP

Trong môi trường container hóa (Docker / K8s), nếu không hiểu rõ 3 loại Probe, máy chủ của bạn sẽ bị khởi động lại liên tục hoặc làm mất kết nối của khách hàng:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3 LOẠI HEALTH PROBE TRONG KUBERNETES               │
├─────────────────┬──────────────────────────────────┬────────────────────────┤
│ Loại Probe      │ Mục Đích Kiểm Tra                │ Hành Động Khi Thất Bại │
├─────────────────┼──────────────────────────────────┼────────────────────────┤
│ 1. Startup      │ Kiểm tra ứng dụng đã khởi động   │ Chờ đợi, nếu timeout   │
│    Probe        │ xong chưa (nạp DB, warm cache).  │ thì Restart Container. │
├─────────────────┼──────────────────────────────────┼────────────────────────┤
│ 2. Liveness     │ Kiểm tra ứng dụng có bị Deadlock │ RESTART LẬP TỨC!       │
│    Probe        │ hoặc nghẽn Event Loop không.     │ (Khởi động lại Pod)    │
├─────────────────┼──────────────────────────────────┼────────────────────────┤
│ 3. Readiness    │ Kiểm tra ứng dụng có sẵn sàng    │ NGẮT LƯỢNG TRUY CẬP!   │
│    Probe        │ nhận traffic không (DB rảnh?).   │ (Không nhận HTTP mới)  │
└─────────────────┴──────────────────────────────────┴────────────────────────┘
\`\`\`

> **Quy Tắc Sống Còn Của Kỹ Sư Hạ Tầng:** Tuyệt đối KHÔNG kiểm tra kết nối Database bên trong \`Liveness Probe\`! Nếu Database bị nghẽn chậm 5 giây, Kubernetes sẽ tưởng toàn bộ 50 Pods Node.js đều bị chết và đồng loạt **Restart sạch cả 50 Pods cùng lúc**, biến một sự cố database nhỏ thành thảm họa sập toàn diện hệ thống! Kết nối Database chỉ được kiểm tra trong \`Readiness Probe\`!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Ba Trụ Cột Của Khả Năng Quan Sát (Three Pillars of Observability)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          3 TRỤ CỘT OBSERVABILITY TOÀN DIỆN                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. METRICS (Các con số tổng hợp theo thời gian: Prometheus / Grafana)       │
│    └── CPU %, Heap Memory, Request Count, P99 Latency, Error Rate (RED)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LOGS (Hồ sơ sự kiện chi tiết: Winston / Pino / Elastic / Loki)           │
│    └── Structured JSON Logs đính kèm TraceID, UserID, Error Stack           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TRACES (Dòng chảy hành trình phân tán: OpenTelemetry / Jaeger)           │
│    └── Sợi chỉ đỏ xuyên suốt các Microservices với Spans và Durations        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Lan Truyền Ngữ Cảnh Truy Vết (Context Propagation Flow)
\`\`\`diagram
Client gửi HTTP GET /checkout
   │
   ▼
[ API GATEWAY: Tạo TraceId = "abc-123", SpanId = "span-1" ]
   │
   ├── Gửi HTTP Header sang Service tiếp theo:
   │   traceparent: 00-abc-123-span-1-01
   │
   ▼
[ ORDER SERVICE: Đọc TraceId = "abc-123", Tạo Child Span = "span-2" ]
   │
   ├── Ghi log: { traceId: "abc-123", message: "Đang kiểm tra tồn kho" }
   │
   ▼
[ DATABASE POSTGRESQL: SQL Query (Span = "span-3") ]
   │
   └── Mọi chỉ số thời gian được đẩy về OpenTelemetry Collector hiển thị đồ thị!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xây Dựng Health Check (Health Check Decision Tree)
\`\`\`diagram
BẠN ĐANG THIẾT KẾ HEALTH CHECK ENDPOINT CHO KUBERNETES?
│
├── Endpoint /health/liveness (Kiểm tra tiến trình còn sống)?
│   └──► CHỈ KIỂM TRA: V8 Event Loop Lag (<1000ms), Heap Memory còn trống
│        (TUYỆT ĐỐI KHÔNG ping Database hay Redis ở đây!)
│
├── Endpoint /health/readiness (Kiểm tra đã sẵn sàng nhận khách)?
│   └──► KIỂM TRA: Kết nối Database OK, Redis OK, Message Broker OK
│
└── Endpoint /health/startup (Kiểm tra khởi động ban đầu)?
    └──► KIỂM TRA: Đã chạy xong Migration, nạp xong Model AI / Cache
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Thành Phần | Định Dạng Chuẩn | Tần Suất Thu Thập | Tiêu Hao Băng Thông | Giá Trị Khi Xảy Ra Sự Cố |
| :--- | :--- | :--- | :--- | :--- |
| **Metrics** | Time-series (Gauge, Counter) | Mỗi 10s - 15s | Rất thấp | Phát hiện bất thường sớm nhất qua Alert |
| **Structured Logs**| JSON Schema chuẩn hóa | Từng sự kiện / Request | Trung bình / Cao | Điều tra chi tiết nguyên nhân gốc rễ (RCA)|
| **Tracing (100%)** | Spans & Call Graphs | Mọi request | Rất cao | Thấy được điểm nghẽn độ trễ chính xác |
| **Tracing (Sample 5%)**| Lấy mẫu ngẫu nhiên | 5% tổng request | Thấp, tiết kiệm | Đủ để đo đạc P99 Latency hệ thống lớn |
`,
      realCodeSnippet: `
import { Injectable } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Injectable()
export class SystemHealthIndicatorService {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator
  ) {}

  /**
   * Liveness Check: Chỉ kiểm tra nội tại tiến trình Node.js có bị kẹt RAM/Loop không
   * KHÔNG được kiểm tra kết nối Database ở đây!
   */
  @HealthCheck()
  public checkLiveness() {
    return this.health.check([
      // Đảm bảo Heap Memory không vượt quá 1.5GB
      () => this.memory.checkHeap('memory_heap', 1500 * 1024 * 1024),
    ]);
  }

  /**
   * Readiness Check: Kiểm tra khả năng kết nối cơ sở dữ liệu để nhận traffic
   */
  @HealthCheck()
  public checkReadiness() {
    return this.health.check([
      () => this.db.pingCheck('database_connection', { timeout: 1500 }),
    ]);
  }
}
`,
      quiz: [
        {
          id: 'c10-l3-q1',
          question: 'Vì sao các chuyên gia kỹ thuật khuyến cáo TUYỆT ĐỐI KHÔNG NÊN kiểm tra kết nối cơ sở dữ liệu bên trong endpoint Liveness Probe của Kubernetes?',
          options: [
            'Vì khi cơ sở dữ liệu gặp sự cố chậm tạm thời, Kubernetes sẽ hiểu lầm toàn bộ các Pod ứng dụng đều bị chết và khởi động lại đồng loạt.',
            'Vì giao thức TCP cấm sử dụng các cổng mạng số nguyên tố cho các mục đích kiểm tra trạng thái hoạt động của hệ thống.',
            'Vì việc ping cơ sở dữ liệu sẽ tự động xóa sạch toàn bộ các bản ghi trong bộ nhớ chia sẻ Shared Buffers của máy chủ.',
            'Vì Kubernetes chỉ cho phép gửi các yêu cầu kiểm tra sức khỏe thông qua giao thức truyền tệp tin nhị phân không mã hóa.',
          ],
          correctIndex: 0,
          explanation: 'Liveness Probe có nhiệm vụ quyết định: Có cần KILL và RESTART Pod này hay không. Nếu kiểm tra Database trong Liveness Probe: Khi DB bị nghẽn chậm, toàn bộ hàng chục Pod đồng loạt fail probe và bị Kubernetes khởi động lại cùng lúc. Việc khởi động lại 50 Pods cùng lúc sẽ tạo ra cơn bão kết nối (Connection Storm) nện vào Database đang thoi thóp, làm sập hoàn toàn hệ thống! Kiểm tra Database chỉ được đặt ở Readiness Probe (tạm ngắt traffic).'
        },
        {
          id: 'c10-l3-q2',
          question: 'Trong tiêu chuẩn truy vết phân tán W3C Trace Context, giá trị "Trace ID" đóng vai trò quan trọng nào trong việc điều tra sự cố của hệ thống?',
          options: [
            'Là một chuỗi định danh duy nhất xuyên suốt toàn bộ chuỗi hành trình từ API Gateway đi qua tất cả các Microservices cho một HTTP request.',
            'Là mật khẩu bí mật dùng để mã hóa toàn bộ dữ liệu phản hồi trả về cho trình duyệt của người dùng cuối cùng.',
            'Là số thứ tự của tiến trình Node.js đang chạy bên trong nhân hệ điều hành Linux của máy chủ đám mây.',
            'Là thời gian chính xác tính bằng pico giây mà tại đó máy chủ bắt đầu nạp tệp tin cấu hình package.json.',
          ],
          correctIndex: 0,
          explanation: 'Trace ID là một chuỗi định danh duy nhất 16-byte (32 ký tự hex) đại diện cho toàn bộ một hành trình giao dịch (End-to-End Transaction). Dù request có đi qua 10 microservices khác nhau và sinh ra hàng chục Span ID cục bộ, tất cả các log và span đó đều mang chung một Trace ID, cho phép kỹ sư gom toàn bộ lịch sử của request đó lại trên một màn hình duy nhất.'
        },
        {
          id: 'c10-l3-q3',
          question: 'Kỹ thuật "Structured Logging" (Ghi log có cấu trúc dạng JSON) mang lại ưu thế vượt trội nào so với việc ghi log văn bản thô truyền thống?',
          options: [
            'Cho phép các công cụ phân tích log tự động bóc tách các trường dữ liệu để lọc, đếm, vẽ đồ thị và kích hoạt cảnh báo tức thì.',
            'Tự động tăng tốc độ xử lý của vi xử lý CPU lên gấp hai lần bằng cách vô hiệu hóa việc ghi tệp tin ra ổ cứng thể rắn.',
            'Bảo đảm tính toàn vẹn của mã nguồn bằng cách cấm tất cả các nhà phát triển sử dụng câu lệnh console.error trong dự án.',
            'Giúp giảm dung lượng của các tệp tin hình ảnh đại diện người dùng xuống còn đúng một byte trước khi truyền qua mạng.',
          ],
          correctIndex: 0,
          explanation: 'Log văn bản thô (Plaintext) như "User 123 failed login after 50ms" rất khó tìm kiếm tự động khi có hàng triệu dòng log. Structured Logging xuất ra JSON: {"userId": 123, "durationMs": 50, "event": "LOGIN_FAILED", "level": "WARN"}. Các hệ thống như Elasticsearch, Loki hay Datadog có thể index từng trường, cho phép query tức thì: "Đếm số lần LOGIN_FAILED có durationMs > 100 trong 5 phút qua".'
        },
        {
          id: 'c10-l3-q4',
          question: 'Trong kiến trúc giám sát hệ thống, phương pháp thu thập mẫu dấu vết "Trace Sampling" (ví dụ chỉ lấy mẫu 5% request) được áp dụng nhằm mục đích gì?',
          options: [
            'Giảm thiểu chi phí tiêu hao băng thông mạng và tài nguyên lưu trữ dung lượng đĩa cứng khổng lồ của hệ thống giám sát phân tán.',
            'Ngăn chặn các cuộc tấn công từ chối dịch vụ phân tán bằng cách tự động ngắt kết nối mạng của chín mươi lăm phần trăm người dùng.',
            'Tự động tăng tốc độ nạp trang web của khách hàng lên gấp hai mươi lần trong các khung giờ cao điểm bán hàng.',
            'Bảo đảm rằng tất cả các bản ghi cơ sở dữ liệu đều được sao lưu dự phòng sang năm châu lục khác nhau trên thế giới.',
          ],
          correctIndex: 0,
          explanation: 'Trên các hệ thống lớn xử lý hàng trăm nghìn request mỗi giây, nếu lưu trữ 100% trace data (bao gồm mọi header, spans, timing), chi phí lưu trữ và băng thông đẩy trace có thể lớn hơn cả chi phí vận hành dịch vụ chính! Bằng cách áp dụng Trace Sampling (ví dụ: ngẫu nhiên 5% request thành công và 100% request có lỗi), hệ thống vẫn có đủ số liệu thống kê chuẩn xác mà tiết kiệm được 95% chi phí hạ tầng.'
        }
      ],
      codeChallenge: {
        id: 'c10-l3-c1',
        title: 'Bộ Trích Xuất W3C Traceparent Header Parser',
        description: 'Hiện thực hàm \`parseW3cTraceparent(headerValue: string): { isValid: boolean; version: string | null; traceId: string | null; parentSpanId: string | null; traceFlags: string | null }\`. Tiêu chuẩn Header có 4 phần phân cách bởi dấu gạch ngang \`-\`: \`version\` (2 hex), \`traceId\` (32 hex), \`parentSpanId\` (16 hex), \`traceFlags\` (2 hex). Nếu đúng định dạng chuẩn 4 phần, trả về \`isValid: true\` và các trường tương ứng. Nếu sai định dạng, trả về \`isValid: false\` và các trường là \`null\`.',
        starterCode: `
export function parseW3cTraceparent(headerValue: string): {
  isValid: boolean;
  version: string | null;
  traceId: string | null;
  parentSpanId: string | null;
  traceFlags: string | null;
} {
  // TODO: Hiện thực kiểm tra và bóc tách W3C Traceparent header
  return { isValid: false, version: null, traceId: null, parentSpanId: null, traceFlags: null };
}
`,
        solution: `
export function parseW3cTraceparent(headerValue: string): {
  isValid: boolean;
  version: string | null;
  traceId: string | null;
  parentSpanId: string | null;
  traceFlags: string | null;
} {
  if (!headerValue || typeof headerValue !== 'string') {
    return { isValid: false, version: null, traceId: null, parentSpanId: null, traceFlags: null };
  }

  const parts = headerValue.trim().split('-');
  if (parts.length !== 4) {
    return { isValid: false, version: null, traceId: null, parentSpanId: null, traceFlags: null };
  }

  const [version, traceId, parentSpanId, traceFlags] = parts;

  // Kiểm tra độ dài chuẩn theo quy định W3C
  const isHex = (str: string) => /^[0-9a-fA-F]+$/.test(str);
  if (
    version.length === 2 && isHex(version) &&
    traceId.length === 32 && isHex(traceId) &&
    parentSpanId.length === 16 && isHex(parentSpanId) &&
    traceFlags.length === 2 && isHex(traceFlags)
  ) {
    return {
      isValid: true,
      version,
      traceId,
      parentSpanId,
      traceFlags,
    };
  }

  return { isValid: false, version: null, traceId: null, parentSpanId: null, traceFlags: null };
}
`,
        testCases: [
          {
            name: 'Phân tích W3C traceparent hợp lệ chuẩn mực',
            input: ['00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'],
            expected: {
              isValid: true,
              version: '00',
              traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
              parentSpanId: '00f067aa0ba902b7',
              traceFlags: '01'
            }
          },
          {
            name: 'Từ chối chuỗi header sai định dạng thiếu trường',
            input: ['invalid-header-string'],
            expected: {
              isValid: false,
              version: null,
              traceId: null,
              parentSpanId: null,
              traceFlags: null
            }
          }
        ]
      }
    }
  ]
};
