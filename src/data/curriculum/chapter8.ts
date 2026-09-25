import type { Sprint } from './types.ts';

export const chapter8: Sprint = {
  sprintId: 8,
  sprintTitle: 'Chương 8: Message Brokers & Kiến Trúc Xử Lý Hàng Đợi Phân Tán BullMQ',
  sprintDesc: 'Chinh phục xử lý bất đồng bộ quy mô lớn: Đồng bộ vs Bất đồng bộ, Cấu trúc Redis Stream/Sorted Sets của BullMQ, Job Lifecycle, Retry với Exponential Backoff và Dead Letter Queue (DLQ)',
  lessons: [
    {
      id: 'c8-l1',
      title: 'Bài 01: Kiến Trúc Hàng Đợi Bất Đồng Bộ: Synchronous HTTP vs Message Queue & Delivery Guarantees',
      duration: '60 phút',
      tag: 'Message Queues & Architecture',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐÁNH ĐỔI GIỮA ĐỒNG BỘ HTTP VÀ HÀNG ĐỢI BẤT ĐỒNG BỘ TRONG HỆ THỐNG PHÂN TÁN (ARCHITECTURAL CONTEXT & ASYNC DECOUPLING)

Trong kiến trúc hệ thống phân tán, việc lựa chọn giữa giao tiếp đồng bộ (Synchronous Request-Response qua HTTP/gRPC) và giao tiếp bất đồng bộ qua hàng đợi (Asynchronous Message Queues) quyết định trực tiếp khả năng chịu lỗi, độ trễ và tính sẵn sàng của toàn bộ nền tảng:
* **Hạn chế Chí mạng của Giao Tiếp Đồng Bộ (Synchronous Bottlenecks):**
  - **Cascading Latency (Độ trễ cộng dồn):** Khi một thao tác nghiệp vụ (như "Thanh toán đơn hàng") đòi hỏi gọi tuần tự 4 dịch vụ khác nhau (Trừ kho -> Tính điểm -> Gửi SMS -> Xuất hóa đơn), độ trễ tổng thể bằng tổng thời gian phản hồi của cả 4 dịch vụ.
  - **Sự cố Sụp Đổ Dây Chuyền (Cascading Failures):** Nếu dịch vụ Gửi SMS bên thứ ba bị quá tải hoặc phản hồi chậm (Timeout 30 giây), các Worker của dịch vụ Thanh toán sẽ bị giam lỏng kết nối, cạn kiệt Connection Pool và khiến toàn bộ luồng thanh toán chính bị sập theo. Hệ thống bị giới hạn độ tin cậy bởi mắt xích yếu nhất trong chuỗi.
* **Kiến Trúc Hàng Đợi Bất Đồng Bộ (Message-Driven Decoupling):**
  - **Cắt giảm Độ trễ & San phẳng Tải (Load Leveling / Traffic Spike Smoothing):** Thay vì bắt Client chờ đợi toàn bộ các tác vụ phụ, máy chủ chỉ việc đẩy một thông điệp (Message Payload) vào Broker và trả ngay phản hồi \`202 Accepted\` cho Client trong vòng dưới 10 mili giây.
  - **Mô hình Consumer Pull (Kéo công việc chủ động):** Các Worker Consumer sẽ chủ động kéo việc từ hàng đợi theo đúng năng lực xử lý thực tế của chúng (ví dụ 100 jobs/giây). Khi có đợt bùng nổ truy cập (Flash Sale với 10,000 requests/giây), toàn bộ tải dư thừa được tích tụ an toàn trong Broker mà không làm tràn bộ nhớ hay làm sập các dịch vụ xử lý phía sau!
  - **Bảo toàn Tính Bền vững (Message Persistence):** Dù các tiến trình Worker có bị khởi động lại, gặp sự cố sập nguồn hoặc đang triển khai phiên bản mới, các tin nhắn vẫn được lưu trữ bền vững trên đĩa hoặc bộ nhớ Redis, sẵn sàng được xử lý ngay khi Worker hoạt động trở lại.

---

# 2. CÁC CẤP ĐỘ BẢO ĐẢM PHÂN PHỐI TIN NHẮN (DELIVERY GUARANTEES)

Trong các hệ thống phân tán, do độ trễ mạng, mất kết nối, hoặc máy chủ sập nguồn giữa chừng, không có một phép màu nào đảm bảo gửi tin nhắn một cách tuyệt đối dễ dàng:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                    3 CẤP ĐỘ BẢO ĐẢM PHÂN PHỐI TIN NHẮN                      │
├────────────────────┬────────────────────┬───────────────────────────────────┤
│ Cấp Độ Phân Phối   │ Ý Nghĩa Kỹ Thuật   │ Bản Chất Vận Hành                 │
├────────────────────┼────────────────────┼───────────────────────────────────┤
│ At-Most-Once       │ Tối đa 1 lần       │ Bắn và Quên (Fire and Forget).    │
│                    │ (Có thể mất tin)   │ Gặp lỗi mạng là mất vĩnh viễn!    │
├────────────────────┼────────────────────┼───────────────────────────────────┤
│ At-Least-Once      │ Ít nhất 1 lần      │ Có cơ chế Retry + Ack. Đảm bảo    │
│ (Chuẩn Quốc Dân)   │ (KHÔNG BAO GIỜ MẤT)│ 0% mất tin, nhưng có thể bị duplicate! │
├────────────────────┼────────────────────┼───────────────────────────────────┤
│ Exactly-Once       │ Chính xác 1 lần    │ Cực kỳ tốn kém (2PC). Trên thực tế│
│ (Ảo tưởng thuần túy│ (Lý tưởng toán học)│ là: At-Least-Once + Idempotency!  │
└────────────────────┴────────────────────┴───────────────────────────────────┘
\`\`\`

> **Chân Lý Bất Biến Của Kỹ Sư Hệ Thống:** Trong thế giới thực, $99.9\\%$ các Message Broker uy tín (RabbitMQ, Kafka, BullMQ, AWS SQS) đều hoạt động theo mô hình **\`At-Least-Once Delivery\`**.
> Do đó, **TRÁCH NHIỆM BẢO VỆ DỮ LIỆU THUỘC VỀ CONSUMER!** Consumer bắt buộc phải được thiết kế có tính **Lũy kế (Idempotent Consumer)** để xử lý an toàn khi một tin nhắn bị gửi lặp lại 2 lần do mạng lag!

---

# 3. KỸ THUẬT LÀM MỀM TẢI (TRAFFIC PEAK SHAVING)

Khi diễn ra sự kiện săn Voucher khuyến mãi lúc 00:00:
* **Hệ thống không có Queue:** 50,000 requests/giây cùng lúc đập vào Database. Database quá tải CPU $100\\%$, sập toàn diện.
* **Hệ thống có Message Queue:** API Gateway chỉ làm nhiệm vụ cực nhẹ: Đẩy 50,000 tin nhắn vào Redis Queue trong vòng 1 giây ($0\\%$ áp lực lên DB). Đội ngũ 10 Workers phía sau ung dung rút dần các job ra xử lý với tốc độ ổn định 1,000 jobs/giây (Peak Shaving). Hệ thống êm ả vượt qua bão tải!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Hàng Đợi (Queue Ecosystem Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRODUCERS (TẦNG TIẾP NHẬN REQUEST)                 │
│  └── NestJS HTTP Controller: Đẩy Job vào Queue trong 2ms rồi trả 202 Accepted│
├─────────────────────────────────────────────────────────────────────────────┤
│                          MESSAGE BROKER (TẦNG TRUNG CHUYỂN BẢO VỆ)          │
│  ├── In-Memory High Speed: Redis Streams / BullMQ                           │
│  ├── Advanced AMQP: RabbitMQ (Routing keys, Exchange bindings)              │
│  └── Big Data Event Streaming: Apache Kafka (Distributed Partition Logs)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                          CONSUMERS (TẦNG CÔNG NHÂN XỬ LÝ)                   │
│  └── Worker Pool: Rút tin, xử lý nặng (Send Mail, Gen PDF, Trừ tiền)        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: So Sánh Dòng Chảy Ghép Nối Chặt vs Bất Đồng Bộ (Flowchart)
\`\`\`diagram
MÔ HÌNH GHÉP NỐI CHẶT (HTTP ĐỒNG BỘ):
Client ──► [ Order API ] ──► [ Payment API ] ──► [ Email API (CHẬM/CHẾT) ]
(Client phải đợi 5 giây, nếu Email API sập thì cả đơn hàng bị báo lỗi thất bại!)

MÔ HÌNH HÀNG ĐỢI BẤT ĐỒNG BỘ (MESSAGE QUEUE):
Client ──► [ Order API ] ──► Lưu DB Order ──► Đẩy Job vào Queue ──► [ Báo 201 Ngay! ]
                                                     │
                                                     ▼
                                            [ Background Worker ]
                                            └── Rút Job ra gửi Email độc lập!
                                                (Email sập thì Queue tự retry sau)
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Công Nghệ Queue (Broker Selection Tree)
\`\`\`diagram
BẠN CẦN CHỌN MESSAGE BROKER CHO HỆ THỐNG?
│
├── Ứng dụng Node.js/NestJS cần giải pháp nhanh, dễ dùng, có sẵn Redis?
│   └──► CHỌN: BullMQ (Tối ưu xuất sắc cho Delayed Jobs, Retries, Cron)
│
├── Cần định tuyến phức tạp (Topic, Direct, Fanout, Headers Exchange đa ngôn ngữ)?
│   └──► CHỌN: RabbitMQ (Chuẩn công nghiệp AMQP 0-9-1)
│
└── Cần lưu trữ hàng trăm triệu sự kiện/ngày, replay dữ liệu, Big Data Analytics?
    └──► CHỌN: Apache Kafka / Redpanda (Lưu trữ Log trên ổ đĩa theo Partition)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Tiêu Chí So Sánh | HTTP REST Đồng Bộ | BullMQ (Redis) | RabbitMQ | Apache Kafka |
| :--- | :--- | :--- | :--- | :--- |
| **Độ trễ tiếp nhận** | Phụ thuộc downstream | ~1ms - 2ms | ~2ms - 5ms | ~2ms - 5ms |
| **Độ phức tạp hạ tầng** | Không có (Gọi trực tiếp) | Rất thấp (Dùng lại Redis)| Trung bình | Rất cao (Cần KRaft) |
| **Khả năng làm mềm tải**| 0% (Dễ quá tải DB) | Rất xuất sắc | Cực kỳ xuất sắc | Tối thượng (Hàng triệu msg/s) |
| **Hỗ trợ Delayed Job** | Khó (Cần DB polling) | Tự nhiên (100% mượt mà) | Cần plugin x-delayed | Không hỗ trợ tự nhiên |
`,
      realCodeSnippet: `import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

/**
 * ADR: Thiết kế Hàng đợi Bất đồng bộ chuẩn Enterprise
 * - Producer trả về phản hồi 202 Accepted tức thì, không bắt Client chờ downstream
 * - Áp dụng Job Deduplication (jobId) chống đẩy trùng đơn hàng vào Queue
 * - Cấu hình Exponential Backoff Retry và tự động dọn dẹp bộ nhớ (removeOnComplete)
 */
export interface OrderJobPayload {
  orderId: string;
  amount: number;
  userId: string;
}

@Injectable()
export class OrderProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(OrderProducerService.name);
  private readonly orderQueue: Queue<OrderJobPayload>;

  constructor() {
    this.orderQueue = new Queue<OrderJobPayload>('order-processing-queue', {
      connection: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        lazyConnect: true,
      },
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.orderQueue.close();
  }

  /**
   * Đẩy tác vụ xử lý đơn hàng vào hàng đợi với cấu hình At-Least-Once an toàn
   */
  public async enqueueOrderJob(orderData: OrderJobPayload): Promise<string> {
    const job = await this.orderQueue.add('process-invoice', orderData, {
      jobId: \`order_\${orderData.orderId}\`, // Chống trùng lặp tin nhắn (Deduplication)
      attempts: 5, // Thử lại tối đa 5 lần nếu thất bại
      backoff: {
        type: 'exponential', // Tăng dần thời gian chờ: 2s, 4s, 8s, 16s...
        delay: 2000,
      },
      removeOnComplete: true, // Tự dọn dẹp job thành công để tiết kiệm RAM Redis
      removeOnFail: {
        count: 1000, // Lưu tối đa 1000 job lỗi để kỹ sư phân tích điều tra
      },
    });

    this.logger.log(\`[QUEUE] Đã đẩy đơn hàng \${orderData.orderId} vào hàng đợi. Job ID: \${job.id}\`);
    return job.id ?? \`order_\${orderData.orderId}\`;
  }
}`,
      quiz: [
        {
          id: 'c8-l1-q1',
          question: 'Vì sao trong hệ thống phân tán, cấp độ phân phối "At-Least-Once Delivery" là tiêu chuẩn thực tế phổ biến nhất thay vì "Exactly-Once Delivery"?',
          options: [
            'Vì các viện nghiên cứu khoa học máy tính cấm việc triển khai cơ chế Exactly-Once trên nền tảng đám mây.',
            'Do vấn đề mạng phân tán (Two Generals Problem): gói tin ACK có thể bị rớt trên đường về, buộc Broker phải gửi lại tin nhắn để bảo đảm không bao giờ mất dữ liệu.',
            'Vì Redis và RabbitMQ chỉ hỗ trợ lưu trữ tối đa 100 tin nhắn trong bộ nhớ tại cùng một thời điểm.',
            'Vì giao thức TCP tự động nhân bản toàn bộ các gói tin lên gấp ba lần khi xảy ra hiện tượng nghẽn mạng.',
          ],
          correctIndex: 1,
          explanation: 'Trong môi trường mạng phân tán, nếu Consumer đã xử lý xong nhưng gói tin xác nhận ACK gửi về Broker bị rớt mạng, Broker không thể phân biệt được Consumer bị chết hay mạng lag. Để đảm bảo không bao giờ mất dữ liệu (Zero Data Loss), Broker bắt buộc phải gửi lại tin nhắn đó, dẫn đến At-Least-Once Delivery. Consumer do đó bắt buộc phải có tính Idempotent.'
        },
        {
          id: 'c8-l1-q2',
          question: 'Cơ chế "Traffic Peak Shaving" (Làm mềm đỉnh tải) của Message Queue bảo vệ cơ sở dữ liệu quan hệ (RDBMS) như thế nào trong các đợt Flash Sale?',
          options: [
            'API Gateway tiếp nhận hàng chục nghìn request/giây và đẩy nhanh vào Queue, sau đó Worker Pool chủ động kéo dần các Job ra xử lý với tốc độ ổn định an toàn cho DB.',
            'Hệ thống tự động từ chối phục vụ toàn bộ các khách hàng mới đăng ký tài khoản trong vòng 24 giờ qua.',
            'Database tự động tạm dừng mọi thao tác kiểm tra khóa ngoại (Foreign Keys) để tăng tốc độ ghi đĩa.',
            'Tất cả các câu lệnh SQL INSERT được chuyển đổi sang thực thi đồng bộ trên GPU của máy chủ.',
          ],
          correctIndex: 0,
          explanation: 'Khi có đợt bùng nổ truy cập (ví dụ 50,000 req/s), nếu nện thẳng vào DB thì DB sẽ cạn kiệt Connection Pool và sập ngay lập tức. Message Queue đóng vai trò hồ chứa đệm: API Gateway tiếp nhận cực nhanh vào Queue (tốn 1ms), sau đó Consumer chủ động rút việc theo tốc độ chịu đựng của DB (ví dụ 1,000 req/s), giúp hệ thống vượt qua bão tải êm ả.'
        },
        {
          id: 'c8-l1-q3',
          question: 'Khi chuyển đổi một API từ mô hình đồng bộ HTTP sang xử lý bất đồng bộ qua Queue, mã trạng thái HTTP chuẩn mực theo RFC 9110 trả về cho Client là gì?',
          options: [
            'HTTP 200 OK kèm thông báo toàn bộ nghiệp vụ phức tạp đã được lưu xong trong cơ sở dữ liệu.',
            'HTTP 301 Moved Permanently để chuyển hướng người dùng sang trang kiểm tra kết quả giao dịch.',
            'HTTP 504 Gateway Timeout để thông báo hệ thống đang quá tải và cần thử lại sau mười phút.',
            'HTTP 202 Accepted kèm thông tin Job ID / Status URI để báo hiệu yêu cầu đã được tiếp nhận hợp lệ và đang xếp hàng xử lý.',
          ],
          correctIndex: 3,
          explanation: 'HTTP 202 Accepted là mã tiêu chuẩn quốc tế biểu thị: Yêu cầu của bạn đã được máy chủ tiếp nhận hợp lệ và đưa vào hàng đợi xử lý ngầm, nhưng quá trình xử lý chưa hoàn tất. Phản hồi thường trả kèm { jobId, statusUrl } để client có thể chủ động thăm dò (polling) hoặc chờ thông báo Webhook.'
        },
        {
          id: 'c8-l1-q4',
          question: 'Lợi ích vận hành to lớn nhất của tính chất "Decoupling" (Tách rời liên kết) giữa Producer và Consumer là gì?',
          options: [
            'Cho phép lập trình viên có thể viết mã nguồn mà không cần khai báo kiểu dữ liệu trong TypeScript.',
            'Tự động tăng gấp đôi dung lượng bộ nhớ RAM của cụm máy chủ Redis mà không cần trả thêm chi phí.',
            'Dịch vụ tiếp nhận đơn hàng (Producer) vẫn hoạt động và nhận đơn bình thường của khách hàng ngay cả khi dịch vụ xử lý xuất hóa đơn (Consumer) đang bảo trì hoặc bị sập.',
            'Loại bỏ hoàn toàn sự cần thiết của việc cấu hình biến môi trường và tệp tin Dockerfile trong dự án.',
          ],
          correctIndex: 2,
          explanation: 'Decoupling giúp tách rời hoàn toàn thời gian sống và trạng thái giữa Producer và Consumer. Nếu dịch vụ gửi Email hoặc In hóa đơn bị sập suốt 2 tiếng, Producer vẫn nhận đơn hàng của khách hàng trên Web và tích lũy vào Queue mà không bị lỗi. Khi dịch vụ Consumer được khởi động lại, nó xử lý sạch sẽ các tin nhắn tồn đọng mà không làm mất bất kỳ đơn nào.'
        },
        {
          id: 'c8-l1-q5',
          question: 'Trong mô hình kiến trúc điều phối thông điệp, cơ chế "Consumer Pull" (như trong BullMQ / Kafka) có ưu điểm gì vượt trội so với "Broker Push"?',
          options: [
            'Tự động mã hóa nội dung tin nhắn sang chuẩn RSA 2048-bit trước khi truyền qua mạng.',
            'Consumer chủ động kiểm soát tốc độ xử lý (Backpressure Control) dựa trên năng lực thực tế của mình, không bị Broker đẩy dồn dập làm tràn bộ nhớ (Out-Of-Memory).',
            'Loại bỏ hoàn toàn sự cần thiết của card mạng vật lý trên các máy chủ đám mây.',
            'Giúp hệ thống không cần lưu trữ dữ liệu tin nhắn trên ổ đĩa hay bộ nhớ RAM.',
          ],
          correctIndex: 1,
          explanation: 'Với mô hình Broker Push, Broker có thể bắn ồ ạt tin nhắn xuống Consumer nhanh hơn tốc độ xử lý của nó, làm tràn bộ đệm RAM của Worker và gây sập tiến trình. Với mô hình Consumer Pull, Worker chỉ chủ động kéo thêm việc khi nó đã xử lý xong tác vụ hiện tại, giải quyết hoàn hảo bài toán áp lực ngược (Backpressure).'
        },
        {
          id: 'c8-l1-q6',
          question: 'Khi nào một kiến trúc sư hệ thống nên lựa chọn Apache Kafka thay vì BullMQ hoặc RabbitMQ?',
          options: [
            'Khi hệ thống cần lưu trữ lượng sự kiện khổng lồ (hàng trăm triệu event/ngày), cần khả năng Replay dữ liệu lịch sử nhiều lần và phục vụ Big Data Analytics.',
            'Khi ứng dụng chỉ chạy trên một máy tính cá nhân duy nhất và không có kết nối internet.',
            'Khi hệ thống cần tính năng Delayed Jobs lên lịch sau 3 ngày một cách đơn giản nhất.',
            'Khi toàn bộ hệ thống được xây dựng bằng kiến trúc Monolith và sử dụng SQLite.',
          ],
          correctIndex: 0,
          explanation: 'Apache Kafka được thiết kế như một Distributed Commit Log bền vững. Khác với RabbitMQ hay BullMQ (xóa tin nhắn sau khi tiêu thụ), Kafka lưu trữ sự kiện trên đĩa theo phân vùng (Partitions) trong nhiều ngày/tháng, cho phép nhiều nhóm Consumer khác nhau đọc và tua lại (Replay) dữ liệu lịch sử cho các bài toán phân tích dữ liệu lớn và Event Sourcing.'
        },
        {
          id: 'c8-l1-q7',
          question: 'Vấn đề "Thứ tự xử lý thông điệp (Message Ordering Guarantee)" trong hệ thống phân tán đa Worker thường được giải quyết như thế nào mà không làm tắc nghẽn toàn bộ hàng đợi?',
          options: [
            'Khóa toàn bộ hệ thống lại chỉ cho phép 1 Worker duy nhất trên toàn thế giới hoạt động.',
            'Chuyển đổi toàn bộ cơ sở dữ liệu sang kiến trúc Blockchain phân tán.',
            'Sử dụng phân vùng theo khóa (Partitioning by Key, ví dụ: partition theo customerId): Đảm bảo các tin nhắn của cùng một khách hàng luôn đến cùng một Worker theo đúng thứ tự, trong khi các khách hàng khác nhau vẫn xử lý song song.',
            'Bắt buộc client phải gửi kèm dấu vân tay điện tử của người dùng vào từng tin nhắn HTTP.',
          ],
          correctIndex: 2,
          explanation: 'Bảo đảm thứ tự toàn cục (Global Ordering) trên toàn bộ hệ thống sẽ phá hủy hoàn toàn khả năng mở rộng quy mô (Scale). Giải pháp chuẩn là phân vùng theo khóa (Key-based Partitioning): Mọi sự kiện của Order #123 luôn vào cùng 1 Partition/Worker để bảo đảm thứ tự tuần tự, trong khi Order #124, #125 được xử lý song song trên các Partition khác.'
        },
        {
          id: 'c8-l1-q8',
          question: 'Mẫu thiết kế "Transactional Outbox Pattern" giải quyết bài toán hóc búa nào khi kết hợp Cơ sở dữ liệu quan hệ với Message Broker?',
          options: [
            'Tự động tăng tốc độ nén tệp tin hình ảnh đại diện của người dùng trước khi lưu đĩa.',
            'Giải quyết lỗi Dual-Write: Đảm bảo việc cập nhật cơ sở dữ liệu và việc xuất bản tin nhắn vào Broker diễn ra nguyên tử (hoặc cùng thành công, hoặc cùng thất bại), không bị tình trạng DB đã commit nhưng Broker sập làm mất tin.',
            'Tự động chuyển đổi các câu lệnh SQL viết hoa thành viết thường trước khi thực thi.',
            'Cho phép truy vấn cơ sở dữ liệu PostgreSQL trực tiếp từ giao diện dòng lệnh của Redis.',
          ],
          correctIndex: 1,
          explanation: 'Bài toán Dual-Write: Nếu lưu DB thành công nhưng Broker bị sập trước khi gửi tin nhắn, sự kiện bị mất; nếu gửi Broker trước nhưng DB rollback, Broker gửi tin nhắn rác! Outbox Pattern giải quyết bằng cách lưu luôn tin nhắn vào một bảng "outbox" trong cùng DB Transaction với dữ liệu chính. Một worker riêng biệt (CDC hoặc poller) sau đó đọc bảng outbox và publish vào Broker, đảm bảo tính nguyên tử tuyệt đối.'
        }
      ],
      codeChallenge: {
        id: 'c8-l1-c1',
        title: 'Mô Phỏng Hàng Đợi FIFO Cơ Bản (FIFO Queue Simulator)',
        description: 'Hiện thực hàm \`simulateFifoQueue(operations: Array<{ op: "enqueue" | "dequeue"; val?: string }>): Array<string | null>\`. Hàm nhận vào danh sách các thao tác: với \`"enqueue"\`, thêm \`val\` vào cuối hàng đợi; với \`"dequeue"\`, lấy phần tử đầu tiên ra khỏi hàng đợi và đẩy vào mảng kết quả (nếu hàng đợi rỗng, đẩy \`null\`). Trả về mảng các giá trị đã dequeue.',
        starterCode: `export function simulateFifoQueue(
  operations: Array<{ op: 'enqueue' | 'dequeue'; val?: string }>
): Array<string | null> {
  // TODO: Hiện thực mô phỏng hàng đợi FIFO
  return [];
}`,
        solution: `export function simulateFifoQueue(
  operations: Array<{ op: 'enqueue' | 'dequeue'; val?: string }>
): Array<string | null> {
  const queue: string[] = [];
  const results: Array<string | null> = [];

  for (const item of operations) {
    if (item.op === 'enqueue') {
      if (item.val !== undefined) {
        queue.push(item.val);
      }
    } else if (item.op === 'dequeue') {
      if (queue.length === 0) {
        results.push(null);
      } else {
        results.push(queue.shift()!);
      }
    }
  }

  return results;
}`,
        testCases: [
          {
            name: 'Dequeue khi hàng đợi rỗng trả về null',
            input: [[{ op: 'dequeue' }]],
            expected: [null]
          },
          {
            name: 'Enqueue và Dequeue đúng thứ tự FIFO ("A", "B", "C")',
            input: [[
              { op: 'enqueue', val: 'A' },
              { op: 'enqueue', val: 'B' },
              { op: 'enqueue', val: 'C' },
              { op: 'dequeue' },
              { op: 'dequeue' }
            ]],
            expected: ['A', 'B']
          },
          {
            name: 'Enqueue hàng loạt rồi dequeue cạn sạch hàng đợi',
            input: [[
              { op: 'enqueue', val: 'X' },
              { op: 'enqueue', val: 'Y' },
              { op: 'dequeue' },
              { op: 'dequeue' }
            ]],
            expected: ['X', 'Y']
          },
          {
            name: 'Enqueue không truyền val (bỏ qua), sau đó dequeue khi rỗng trả về null',
            input: [[
              { op: 'enqueue' },
              { op: 'dequeue' }
            ]],
            expected: [null]
          },
          {
            name: 'Xen kẽ enqueue và dequeue liên tục',
            input: [[
              { op: 'enqueue', val: '1' },
              { op: 'dequeue' },
              { op: 'enqueue', val: '2' },
              { op: 'enqueue', val: '3' },
              { op: 'dequeue' },
              { op: 'dequeue' }
            ]],
            expected: ['1', '2', '3']
          }
        ]
      }
    },
    {
      id: 'c8-l2',
      title: 'Bài 02: BullMQ Engine Deep Dive: Redis Stream/Sorted Sets, Job Lifecycle, Delayed & Retries with Exponential Backoff',
      duration: '60 phút',
      tag: 'BullMQ Internals & Retries',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐIỀU PHỐI TÁC VỤ PHÂN TÁN TRÊN NỀN TẢNG REDIS DATA STRUCTURES & CHIẾN LƯỢC TỰ PHỤC HỒI (ARCHITECTURAL CONTEXT & REDIS-BACKED QUEUES)

BullMQ là giải pháp hàng đầu trong hệ sinh thái Node.js/NestJS để điều phối các tác vụ nền quy mô lớn (Background Job Processing). Khác với các hệ thống cồng kềnh, BullMQ tận dụng tối đa sức mạnh của **Cấu trúc Dữ liệu Nguyên tử trong Redis** để vận hành mà không cần thêm một Message Broker độc lập:
* **Ánh Xạ Cấu Trúc Dữ Liệu Redis Vào Quản Trị Hàng Đợi (Redis-backed Primitive Mapping):**
  - **Hàng đợi Chờ (Wait Queue):** Sử dụng cấu trúc **Redis List** (với lệnh nguyên tử \`BRPOPLPUSH\` hoặc \`RPOPLPUSH\`) hoặc **Redis Streams** (\`XREADGROUP\`). Cơ chế này đảm bảo khi một Job được lấy ra khỏi hàng đợi \`wait\`, nó được lập tức chuyển sang hàng đợi \`active\` một cách nguyên tử. Dù Worker có bị crash đúng tại thời điểm nhận Job, Job đó vẫn không bao giờ bị mất!
  - **Tác vụ Hẹn giờ & Trì hoãn (Delayed Jobs):** Thay vì sử dụng vòng lặp \`setInterval\` kiểm tra mỗi giây (gây lãng phí CPU và nghẽn Event Loop), BullMQ lưu trữ các tác vụ cần trì hoãn trong một **Redis Sorted Set (ZSET)** với **Score chính là Epoch Timestamp tương lai** (\`executeAt\`). Một tiến trình điều phối sử dụng Lua Script định kỳ quét: Chỉ cần gọi lệnh \`ZRANGEBYSCORE key 0 current_timestamp\`, bốc các Job đã đến hạn và trượt thẳng xuống hàng đợi \`wait\` trong độ phức tạp $O(\\log N + M)$!
* **Chiến Lược Thử Lại Lũy Thừa (Exponential Backoff Resilience):**
  - Khi một tác vụ gọi sang dịch vụ bên thứ ba (như cổng thanh toán ngân hàng) bị lỗi gián đoạn mạng tạm thời, việc thử lại ngay lập tức (Immediate Retry) sẽ gây ra thảm họa **Retry Storm**, làm quá tải thêm hệ thống đang gặp sự cố.
  - BullMQ áp dụng công thức giãn cách thời gian lũy thừa:
    $$T_{\\text{wait}} = \\text{delay} \\times 2^{\\text{attempts} - 1} + \\text{jitter}$$
    Khoảng thời gian chờ tăng từ 2s -> 4s -> 8s -> 16s, cho phép các dịch vụ phụ trợ có đủ khoảng lặng để tự phục hồi trước khi tiếp nhận yêu cầu mới.

---

# 2. VÒNG ĐỜI 6 TRẠNG THÁI CỦA MỘT JOB TRONG BULLMQ

Trong Redis, BullMQ duy trì trạng thái của Job qua các cấu trúc dữ liệu riêng biệt:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VÒNG ĐỜI CHUYỂN TRẠNG THÁI CỦA BULLMQ JOB             │
├─────────────────────────────────────────────────────────────────────────────┤
│                               [ DELAYED ]                                   │
│                              (Lưu trong ZSET)                               │
│                                     │                                       │
│                                     ▼ (Hết thời gian trễ)                   │
│  [ ADD JOB ] ───────────────►  [ WAITING ] ◄──────────────┐                 │
│                                     │                     │                 │
│                                     ▼ Worker bốc Job      │                 │
│                                [ ACTIVE ]                 │                 │
│                              (Đang xử lý)                 │ (Thất bại và    │
│                                     │                     │  còn lượt thử)  │
│                   ┌─────────────────┴─────────────────┐   │                 │
│                   ▼                                   ▼   │                 │
│             [ COMPLETED ]                        [ FAILED ] ┘                 │
│           (Xử lý thành công)                 (Hết số lần Retry)             │
│                                                       │                     │
│                                                       ▼                     │
│                                             [ DEAD LETTER QUEUE ]           │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

# 3. CHIẾN LƯỢC EXPONENTIAL BACKOFF VỚI JITTER

Công thức tính thời gian chờ thử lại giữa các lần thất bại:
$$\\text{Delay}(n) = \\text{Base Delay} \\times 2^{n-1} + \\text{Jitter}$$
* **Lần 1 (n=1):** $2000 \\times 2^0 = 2000\\text{ ms}$ (2 giây).
* **Lần 2 (n=2):** $2000 \\times 2^1 = 4000\\text{ ms}$ (4 giây).
* **Lần 3 (n=3):** $2000 \\times 2^2 = 8000\\text{ ms}$ (8 giây).
* **Lần 4 (n=4):** $2000 \\times 2^3 = 16000\\text{ ms}$ (16 giây).

> **Hiểm họa nếu không có Jitter:** Nếu 1,000 jobs cùng thất bại tại đúng 1 thời điểm (do mạng chập chờn), cả 1,000 jobs sẽ cùng được Retry tại đúng giây thứ 2, rồi lại cùng ập vào tại đúng giây thứ 4... gây ra **Hiện tượng Thundering Herd (Đàn trâu dẫm đạp)**! Bắt buộc phải cộng thêm Jitter ngẫu nhiên để phân tán đều các đợt retry.

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Cấu Trúc Khóa Redis Của BullMQ (Redis Key Structure Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BỐ CỤC KHÓA BỘ NHỚ TRONG REDIS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ bull:<queue-name>:wait       ──► List / Stream chứa Job ID đang xếp hàng    │
│ bull:<queue-name>:active     ──► List chứa Job ID đang được Worker xử lý     │
│ bull:<queue-name>:delayed    ──► Sorted Set (ZSET) với Score = Epoch Millis │
│ bull:<queue-name>:failed     ──► Set / ZSET chứa các Job ID đã bị lỗi       │
│ bull:<queue-name>:completed  ──► Set / ZSET chứa các Job ID đã thành công   │
│ bull:<queue-name>:<jobId>    ──► Hash (HSET) chứa payload dữ liệu và retry  │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Xử Lý Lỗi Và Tự Động Thử Lại (Error Retry Flow)
\`\`\`diagram
Worker xử lý Job ném ra Ngoại lệ (Throw Error)
   │
   ▼
BullMQ Worker bắt lấy ngoại lệ và tăng số lần thử: attemptsMade++
   │
   ▼
Đã vượt quá số lần thử tối đa (attemptsMade >= opts.attempts)?
   ├── [ ĐÃ VƯỢT QUÁ ] ──► Chuyển Job sang danh sách FAILED (Gửi vào Dead Letter Queue)
   │
   └── [ CÒN LƯỢT ]
          │
          ├── Tính toán thời gian hoãn: Delay = Base * (2 ^ attemptsMade) + Jitter
          ├── Đưa Job vào Sorted Set: bull:queue:delayed (Score = Now + Delay)
          └── Khi đến giờ: Bộ đếm Redis tự động chuyển Job ngược về WAIT để chạy lại!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Thất Bại Trong Worker (Worker Failure Tree)
\`\`\`diagram
JOB XỬ LÝ TRONG WORKER BỊ LỖI?
│
├── Lỗi tạm thời (Network timeout, Third-party Rate Limit 429, DB Connection spike)?
│   └──► NÉM LỖI (THROW ERROR) để BullMQ tự động kích hoạt Exponential Backoff Retry!
│
└── Lỗi nghiệp vụ vĩnh viễn (Email không tồn tại, Tài khoản bị khóa, Thẻ giả mạo)?
    └──► TUYỆT ĐỐI KHÔNG RETRY (Sẽ chỉ làm tốn tài nguyên vô ích)!
         └──► Bắt lỗi, ghi log cảnh báo, và return thành công hoặc ném lỗi Unrecoverable!
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược Retry | Mức Độ An Toàn Đối Tác | Thời Gian Xử Lý Tổng Thể | Nguy Cơ Thundering Herd | Ứng Dụng Chuẩn Khuyên Dùng |
| :--- | :--- | :--- | :--- | :--- |
| **Fixed Delay (Cố định)** | Kém (Bắn dồn dập mỗi 2s)| Ngắn | Rất cao | Tác vụ nội bộ đọc file đĩa |
| **Exponential Backoff** | Rất tốt (Dãn cách thời gian)| Dài hơn qua từng lần thử| Trung bình | Gọi các API bên ngoài (Stripe, Zalo) |
| **Exponential + Jitter** | Hoàn hảo nhất | Dài hơn, phân tán mượt mà| Hoàn toàn 0% | Tiêu chuẩn bắt buộc cho Production |
| **Không Retry (0 attempts)**| 0% | Kết thúc ngay lập tức | 0% | Tác vụ gửi thông báo quảng cáo rác |
`,
      realCodeSnippet: `import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

/**
 * ADR: Phân loại lỗi và điều phối Retry trong BullMQ Worker
 * - Lỗi Tạm thời (Transient Error: Timeout, 503, 429): Ném lỗi để BullMQ kích hoạt Exponential Backoff
 * - Lỗi Vĩnh viễn (Permanent Error: Cú pháp sai, tài khoản đóng): Hủy bỏ retry ngay lập tức
 * - Không sử dụng 'any', áp dụng type guard an toàn cho Exception handling
 */
export interface EmailJobData {
  recipient: string;
  subject: string;
  templateId: string;
}

export class UnrecoverableDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnrecoverableDataError';
  }
}

@Processor('email-notification-queue')
export class EmailNotificationConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailNotificationConsumer.name);

  async process(job: Job<EmailJobData>): Promise<{ sentAt: string }> {
    this.logger.log(
      \`[WORKER] Bắt đầu xử lý Job \${job.id} (Lần thử \${job.attemptsMade + 1}/\${job.opts.attempts})\`
    );

    try {
      await this.sendEmailViaProvider(job.data);
      this.logger.log(\`[WORKER] Gửi email thành công cho Job \${job.id}\`);
      return { sentAt: new Date().toISOString() };
    } catch (error: unknown) {
      if (error instanceof UnrecoverableDataError) {
        this.logger.error(\`[FATAL] Dữ liệu sai, hủy bỏ retry cho Job \${job.id}: \${error.message}\`);
        throw error; // Ngắt retry nếu là lỗi không thể phục hồi
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown Network Failure';
      this.logger.warn(\`[TRANSIENT ERROR] Lỗi mạng khi gửi mail Job \${job.id}: \${errorMessage}. Đang retry...\`);
      throw error;
    }
  }

  private async sendEmailViaProvider(data: EmailJobData): Promise<void> {
    if (!data.recipient || !data.recipient.includes('@')) {
      throw new UnrecoverableDataError('INVALID_EMAIL_SYNTAX');
    }
    // Giả lập logic gửi email qua third-party SMTP/SendGrid API
  }
}`,
      quiz: [
        {
          id: 'c8-l2-q1',
          question: 'Bộ máy BullMQ sử dụng cấu trúc dữ liệu nào của Redis để hiện thực tính năng các tác vụ trì hoãn (Delayed Jobs) mà không làm lãng phí CPU của hệ thống?',
          options: [
            'Sorted Set (ZSET) với Score chính là dấu thời gian (Epoch Timestamp) mà tại đó tác vụ dự kiến sẽ được kích hoạt.',
            'Một danh sách liên kết kép thông thường và một vòng lặp setInterval đồng bộ quét liên tục mỗi một mili giây.',
            'Cấu trúc bảng băm Dict hai lớp với khóa là chuỗi ngẫu nhiên và giá trị là con trỏ bộ nhớ của tiến trình Node.js.',
            'Cơ chế tệp tin nhật ký WAL của hệ quản trị cơ sở dữ liệu quan hệ PostgreSQL thông qua kết nối mạng nội bộ.',
          ],
          correctIndex: 0,
          explanation: 'BullMQ sử dụng Sorted Set (ZSET) cho các Delayed Jobs. Điểm số (Score) của mỗi phần tử trong ZSET chính là thời điểm tương lai (timestamp tính bằng mili giây) mà job cần được thực thi. Khi thời gian hiện tại vượt qua Score đó, BullMQ dùng Lua script trích xuất các job đã "chín" và đẩy sang danh sách Wait của hàng đợi cực kỳ tối ưu mà không cần polling CPU.'
        },
        {
          id: 'c8-l2-q2',
          question: 'Vì sao trong chiến lược tự động thử lại (Retry) của hàng đợi, kỹ thuật Exponential Backoff bắt buộc nên được kết hợp thêm thành phần Jitter ngẫu nhiên?',
          options: [
            'Để bảo đảm rằng các tác vụ công việc quan trọng luôn luôn được hoàn thành trước các tác vụ công việc phụ của hệ thống.',
            'Để tự động giải phóng toàn bộ các khóa phân tán trong bộ nhớ RAM của Redis trước khi tiến trình worker bị đóng lại.',
            'Để phân tán thời điểm thử lại của hàng nghìn tác vụ bị lỗi đồng thời tránh gây ra hiện tượng đàn trâu dẫm đạp (Thundering Herd) làm sập dịch vụ bên thứ ba.',
            'Để mã hóa toàn bộ dữ liệu nội dung công việc thành các chuỗi nhị phân an toàn chống lại các cuộc tấn công mạng.',
          ],
          correctIndex: 2,
          explanation: 'Nếu một sự cố mạng khiến 10,000 jobs cùng thất bại tại một giây, nếu chỉ dùng Exponential Backoff thuần túy, tất cả 10,000 jobs sẽ cùng thức giấc và cùng nện vào hệ thống đích tại đúng giây thứ 2, rồi cùng lặp lại tại giây thứ 4... (Thundering Herd Problem). Thêm Jitter ngẫu nhiên sẽ phân tán 10,000 jobs này rải rác trong khoảng thời gian, giúp hệ thống đích không bị sốc tải.'
        },
        {
          id: 'c8-l2-q3',
          question: 'Trường hợp nào sau đây là lỗi vĩnh viễn (Fatal/Unrecoverable Error) mà Worker TUYỆT ĐỐI KHÔNG NÊN tiếp tục kích hoạt cơ chế thử lại (Retry)?',
          options: [
            'Cổng kết nối mạng của dịch vụ thanh toán bên ngoài tạm thời bị nghẽn và trả về mã lỗi 429 Too Many Requests.',
            'Dữ liệu payload của công việc bị sai cú pháp (như email không có dấu @) hoặc tài khoản người dùng đích đã bị xóa vĩnh viễn khỏi cơ sở dữ liệu.',
            'Cơ sở dữ liệu đang thực hiện quá trình tái cấu trúc bảng định kỳ và tạm thời từ chối kết nối mới trong năm giây.',
            'Đường truyền internet quốc tế bị chập chờn do đứt cáp quang biển khiến gói tin TCP bị mất trên đường đi.',
          ],
          correctIndex: 1,
          explanation: 'Retry chỉ có ý nghĩa đối với các lỗi tạm thời (Transient Errors) như nghẽn mạng, timeout, hoặc rate limit. Đối với các lỗi vĩnh viễn do dữ liệu sai bản chất (dữ liệu payload thiếu trường bắt buộc, tài khoản không tồn tại, cú pháp email sai), việc thử lại 100 lần nữa kết quả vẫn chắc chắn thất bại 100%, chỉ làm lãng phí CPU, RAM và tốn quota của hệ thống.'
        },
        {
          id: 'c8-l2-q4',
          question: 'Trong cấu hình tùy chọn của một Job trong BullMQ, cờ "removeOnComplete: true" đóng vai trò quan trọng nào đối với sự ổn định lâu dài của máy chủ Redis?',
          options: [
            'Tự động sao lưu toàn bộ thông tin chi tiết của tác vụ vào một tệp nén zip trên máy chủ lưu trữ đám mây của doanh nghiệp.',
            'Ngăn chặn tuyệt đối việc người dùng có thể gửi thêm các yêu cầu mới vào hàng đợi trong suốt thời gian hệ thống vận hành.',
            'Chuyển đổi toàn bộ các tác vụ đang chờ xử lý sang định dạng nhị phân siêu nhỏ để giảm bớt băng thông mạng.',
            'Tự động xóa sạch dữ liệu của các tác vụ đã hoàn thành thành công khỏi Redis giúp ngăn chặn việc cạn kiệt bộ nhớ RAM (OOM) theo thời gian.',
          ],
          correctIndex: 3,
          explanation: 'Nếu không bật removeOnComplete, mỗi job xử lý xong vẫn tiếp tục tồn tại vĩnh viễn dưới dạng một HSET trong RAM của Redis để phục vụ việc xem lại lịch sử. Khi hệ thống xử lý hàng chục triệu jobs mỗi ngày, hàng chục GB RAM của Redis sẽ bị lấp đầy bởi xác các job cũ, dẫn tới lỗi OOM (Out Of Memory) làm sập Redis.'
        },
        {
          id: 'c8-l2-q5',
          question: 'Cơ chế "Stalled Job Detection" trong BullMQ hoạt động như thế nào để phục hồi một tác vụ khi tiến trình Worker bị sập đột ngột (Kernel OOM Killer)?',
          options: [
            'Worker định kỳ gia hạn một khóa Lock (Lock Renewal/Heartbeat) trên Redis khi đang xử lý Job; nếu Worker chết, khóa hết hạn và BullMQ chuyển Job đó về trạng thái Wait để Worker khác xử lý lại.',
            'Hệ điều hành Linux tự động gửi tín hiệu IPC sang tất cả các máy chủ khác trong cùng mạng LAN.',
            'Redis tự động xóa bỏ toàn bộ hàng đợi và yêu cầu Producer gửi lại toàn bộ từ đầu.',
            'Node.js khởi động lại toàn bộ máy chủ vật lý thông qua giao thức IPMI.',
          ],
          correctIndex: 0,
          explanation: 'Khi Worker bốc Job sang trạng thái active, nó chiếm một khóa Lock trên Redis kèm hạn sử dụng (lockDuration ví dụ 30s). Trong lúc xử lý, Worker gửi heartbeat gia hạn khóa liên tục. Nếu Worker bị crash đột ngột, heartbeat dừng lại và lock hết hạn. Một tiến trình Stalled Checker sẽ phát hiện Job active nhưng không có lock hợp lệ, tự động di chuyển Job về hàng đợi Wait để Worker khác cứu nạn.'
        },
        {
          id: 'c8-l2-q6',
          question: 'Khi Worker xử lý các tác vụ tiêu tốn nặng năng lực CPU (như mã hóa video, nén ảnh, xử lý tệp PDF hàng gigabyte), giải pháp nào giúp tránh làm tắc nghẽn Event Loop của Node.js trong BullMQ?',
          options: [
            'Sử dụng các biến cờ toàn cục boolean trong cùng một tệp tin Controller.',
            'Tăng giá trị thread_pool_size của cơ sở dữ liệu PostgreSQL lên 10,000.',
            'Giảm tần số quét của màn hình máy chủ điều hành trung tâm dữ liệu.',
            'Sử Sandboxed Processors (chạy logic xử lý trong các tiến trình con child_process hoặc worker_threads độc lập) được BullMQ hỗ trợ tự nhiên.',
          ],
          correctIndex: 3,
          explanation: 'Nếu chạy tác vụ nặng CPU trực tiếp trong luồng chính của Node.js, Event Loop sẽ bị nghẽn (Block), khiến Worker không thể gửi heartbeat gia hạn lock lên Redis (dẫn đến Job bị coi là Stalled nhầm) và không thể nhận HTTP request mới. BullMQ cung cấp cơ chế Sandboxed Processor: Đưa đường dẫn file xử lý vào Worker, BullMQ tự fork tiến trình con riêng biệt để chạy tác vụ nặng mà không chạm vào Event Loop chính.'
        },
        {
          id: 'c8-l2-q7',
          question: 'Tính năng FlowProducer trong BullMQ mang lại khả năng kiến trúc nâng cao nào cho hệ thống?',
          options: [
            'Chuyển đổi giao diện người dùng của trang web sang chế độ tối tự động.',
            'Xây dựng cây phụ thuộc công việc phức tạp (Job Tree / Directed Acyclic Graph - DAG), trong đó một Job cha chỉ được kích hoạt khi tất cả các Job con (Children) đã hoàn tất thành công.',
            'Tự động tăng tốc độ đường truyền internet của người dùng lên mức gigabit.',
            'Tự động tạo các bản sao lưu hàng ngày của toàn bộ bảng tính Excel trong doanh nghiệp.',
          ],
          correctIndex: 1,
          explanation: 'FlowProducer cho phép mô hình hóa các đồ thị công việc (DAG): Ví dụ, Job "Xuất Báo Cáo Tổng Hợp" phụ thuộc vào 3 Job con: "Lấy dữ liệu Bán Hàng", "Lấy dữ liệu Kho", và "Lấy dữ liệu Nhân sự". FlowProducer đảm bảo 3 Job con chạy song song trên các Worker khác nhau, và chỉ khi cả 3 Job con hoàn tất thì Job cha mới được tự động nạp vào hàng đợi Wait để thực thi.'
        },
        {
          id: 'c8-l2-q8',
          question: 'Khi triển khai phiên bản mã nguồn mới (Rolling Deployment) trên Kubernetes, làm thế nào để đảm bảo Worker Node.js tắt một cách êm ái (Graceful Shutdown) mà không làm đứt đoạn các Job đang chạy dở?',
          options: [
            'Gửi tín hiệu SIGKILL lập tức để giải phóng tài nguyên CPU ngay trong 1 mili giây.',
            'Lắng nghe tín hiệu SIGTERM/SIGINT, gọi await worker.close() để ngừng nhận thêm Job mới, kiên nhẫn chờ các Job đang active hoàn thành nốt trong thời gian ân hạn trước khi tiến trình thoát.',
            'Xóa sạch toàn bộ khóa của Redis để các Job đang chạy tự động hủy bỏ.',
            'Chặn tất cả các địa chỉ IP của mạng nội bộ trong tường lửa iptables.',
          ],
          correctIndex: 1,
          explanation: 'Khi Kubernetes dừng một Pod, nó gửi tín hiệu SIGTERM và cho Pod một khoảng thời gian ân hạn (terminationGracePeriodSeconds, vd 30s). Worker cần hook vào SIGTERM, gọi worker.close(): Lúc này Worker dừng bốc Job mới từ hàng đợi Wait, nhưng vẫn tiếp tục chờ các Job đang active chạy nốt và gửi ACK về Redis rồi mới đóng kết nối, đảm bảo không có giao dịch nào bị đứt gánh giữa chừng.'
        }
      ],
      codeChallenge: {
        id: 'c8-l2-c1',
        title: 'Bộ Tính Toán Thời Gian Chờ Thử Lại (Exponential Backoff Delay Calculator)',
        description: 'Hiện thực hàm \`calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number\`. Hàm tính toán thời gian chờ theo công thức lũy thừa: \`delay = baseDelayMs * Math.pow(2, attempt - 1)\`. Kết quả không bao giờ được vượt quá \`maxDelayMs\` (dùng \`Math.min\`). Nếu \`attempt < 1\` hoặc \`baseDelayMs <= 0\` hoặc \`maxDelayMs <= 0\`, ném ra Error \`"INVALID_INPUT"\`.',
        starterCode: `export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // TODO: Hiện thực thuật toán tính delay lũy thừa có chặn trần maxDelay
  return 0;
}`,
        solution: `export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  if (attempt < 1 || baseDelayMs <= 0 || maxDelayMs <= 0) {
    throw new Error('INVALID_INPUT');
  }

  const rawDelay = baseDelayMs * Math.pow(2, attempt - 1);
  return Math.min(rawDelay, maxDelayMs);
}`,
        testCases: [
          {
            name: 'Tính toán lần thử 1 với base 1000ms (phải ra 1000ms)',
            input: [1, 1000, 30000],
            expected: 1000
          },
          {
            name: 'Tính toán lần thử 4 với base 1000ms (1000 * 2^3 = 8000ms)',
            input: [4, 1000, 30000],
            expected: 8000
          },
          {
            name: 'Thời gian delay bị chạm trần maxDelayMs (15000ms)',
            input: [10, 1000, 15000],
            expected: 15000
          },
          {
            name: 'Ném lỗi khi attempt không hợp lệ (< 1)',
            input: [0, 1000, 10000],
            expected: 'ERROR_THROWN'
          },
          {
            name: 'Ném lỗi khi baseDelayMs hoặc maxDelayMs không hợp lệ (<= 0)',
            input: [2, -500, 10000],
            expected: 'ERROR_THROWN'
          }
        ]
      }
    },
    {
      id: 'c8-l3',
      title: 'Bài 03: Dead Letter Queues (DLQ), Idempotent Consumer & Chiến Lược Chống Trùng Tin Nhắn',
      duration: '60 phút',
      tag: 'DLQ & Idempotency',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: CƠ CHẾ PHÒNG VỆ THẢM HỌA POISON PILL, BẢO TOÀN TÍNH TOÀN VẸN VỚI DEAD LETTER QUEUE & IDEMPOTENT CONSUMER (ARCHITECTURAL CONTEXT & RESILIENCE)

Trong các hệ sinh thái xử lý thông điệp quy mô hàng triệu sự kiện mỗi ngày, hai vấn đề sống còn về độ tin cậy kiến trúc luôn đe dọa sự ổn định của hệ thống:
* **Thảm họa Thông Điệp Độc Hại (Poison Pill Messages) & Hiện Tượng Nghẽn Cổ Chai (Head-of-Line Blocking):**
  - Xảy ra khi một tin nhắn chứa Payload bị hỏng (corrupted schema), mã hóa sai, hoặc kích hoạt một nhánh lỗi logic chưa được xử lý (Uncaught Exception) trong mã nguồn Consumer.
  - Mỗi khi Worker nhận tin nhắn này, tiến trình bị crash hoặc ném lỗi, kích hoạt cơ chế tự động thử lại (Retry). Worker lại tiếp tục nhận lại chính tin nhắn đó, lại sập và lại thử lại vô hạn lần!
  - **Hậu quả trên Production:** Toàn bộ năng lực tính toán của Worker Pool bị giam lỏng bởi một vài tin nhắn độc hại. Hàng trăm nghìn tin nhắn hợp lệ phía sau bị đóng băng tại chỗ (**Head-of-Line Blocking**), độ trễ hàng đợi tăng vọt từ vài giây lên nhiều giờ, và hệ thống rơi vào trạng thái tê liệt hoàn toàn.
* **Kiến Trúc Cô Lập Thảm Họa: Dead Letter Queue (DLQ):**
  - Để bảo vệ hàng đợi chính, BullMQ cấu hình một ngưỡng thử lại tối đa (ví dụ: \`attempts: 5\`).
  - Khi một Job thất bại đủ 5 lần, nó không bị vứt bỏ ngẫu nhiên mà được tự động chuyển hướng sang một hàng đợi độc lập chuyên dụng: **Dead Letter Queue (DLQ)**.
  - Hàng đợi chính lập tức được giải phóng để tiếp tục phục vụ các đơn hàng bình thường. Tin nhắn trong DLQ được làm giàu (Enriched) với toàn bộ Stack Trace, lý do lỗi, và số lần đã thử, giúp đội ngũ kỹ sư vận hành có thể phân tích nguyên nhân gốc rễ (Root Cause Analysis), sửa lỗi mã nguồn, và nhấn nút **Replay (Phát lại)** để phục hồi dữ liệu trọn vẹn $100\\%$!
* **Nguyên Lý Bất Biến Của Consumer (Idempotent Consumer Pattern):**
  - Trong mạng máy tính phân tán, cơ chế giao nhận tin cậy tuân theo chuẩn **At-Least-Once Delivery**: Tin nhắn không bao giờ bị mất, nhưng hoàn toàn có thể bị gửi trùng lặp (ví dụ: Worker đã xử lý xong nhưng kết nối mạng bị đứt trước khi gửi tín hiệu Acknowledgment về Broker, Broker tưởng Worker bị chết nên gửi lại tin nhắn đó cho một Worker khác).
  - Do đó, mọi Consumer xử lý các tác vụ nhạy cảm tài chính (trừ tiền, gửi hóa đơn, tạo tài khoản) **BẮT BUỘC PHẢI CÓ TÍNH CHẤT BẤT BIẾN (IDEMPOTENT)**: Sử dụng Khóa Idempotency Key (hoặc Unique Job ID) kết hợp kiểm tra trạng thái trên Redis hoặc Database Unique Constraint để đảm bảo: **Dù một tin nhắn có bị gửi lại 100 lần, hành động nghiệp vụ cũng chỉ được thực thi duy nhất đúng 1 lần!**

---

# 2. KIẾN TRÚC DEAD LETTER QUEUE (DLQ) CHUẨN DOANH NGHIỆP

DLQ không phải là thùng rác để vứt bỏ dữ liệu, mà là **Một mạng lưới an toàn phục hồi thảm họa (Disaster Recovery Net)**:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KIẾN TRÚC DEAD LETTER QUEUE HOÀN CHỈNH             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ MAIN QUEUE: payments ]                                                   │
│        │                                                                    │
│        ▼ Worker xử lý thất bại 5 lần liên tiếp                              │
│  [ FAILED HOOK EVENT ]                                                      │
│        │                                                                    │
│        ▼ Tự động chuyển tiếp toàn bộ Payload + Error Stack Trace            │
│  [ DEAD LETTER QUEUE: payments-dlq ] ──► Lưu trữ an toàn 14 ngày            │
│        │                                                                    │
│        ├── 1. Gửi cảnh báo khẩn cấp: Slack Alert / PagerDuty                │
│        ├── 2. Kỹ sư Backend sửa lỗi logic trong mã nguồn                    │
│        └── 3. Bấm nút replay: Đẩy ngược các Job từ DLQ về Main Queue!        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Các Thành Phần Bắt Buộc Khi Đẩy Vào DLQ
Mỗi tin nhắn khi rơi vào DLQ phải được làm giàu (Enriched) thêm các trường thông tin chuẩn đoán:
\`\`\`typescript
interface DeadLetterPayload<T> {
  originalJobId: string;
  originalPayload: T;
  failedReason: string;
  stackTrace?: string;
  failedAt: string;
  attemptsMade: number;
}
\`\`\`

---

# 3. MẪU THIẾT KẾ IDEMPOTENT CONSUMER (CHỐNG TRÙNG TIN NHẮN)

Bất kỳ Worker nào cũng có thể nhận cùng 1 tin nhắn 2 lần. Để chống trùng lặp dữ liệu, ta áp dụng mẫu hình **Idempotent Consumer Pattern**:

\`\`\`diagram
[ CONSUMER TIẾP NHẬN JOB: orderId = 100 ]
                     │
                     ▼
           [ BẮT ĐẦU TRANSACTION ]
                     │
                     ▼
     Kiểm tra bảng processed_messages trong Database:
     SELECT 1 FROM processed_messages WHERE message_id = 'order_100' FOR UPDATE
                     │
          Bản ghi đã tồn tại chưa?
          ├── [ ĐÃ TỒN TẠI ]
          │      └──► Tin nhắn này ĐÃ TỪNG ĐƯỢC XỬ LÝ!
          │           Bỏ qua logic trừ tiền, commit transaction và trả về thành công ngay!
          │
          └── [ CHƯA TỒN TẠI ]
                 │
                 ├── 1. Thực hiện trừ tiền trong bảng balances
                 ├── 2. Tạo hóa đơn trong bảng invoices
                 ├── 3. Chèn bản ghi đánh dấu:
                 │      INSERT INTO processed_messages (message_id) VALUES ('order_100')
                 └── 4. COMMIT TRANSACTION! (Hoàn tất an toàn tuyệt đối)
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Các Rào Chắn Toàn Vẹn Tin Nhắn (Message Integrity Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG PRODUCER: DEDUPLICATION                       │
│  └── Gán jobId cố định (vd: hash payload hoặc UUID) chống đẩy trùng vào Queue│
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG BROKER: RETRY & DLQ ROUTING                   │
│  ├── Exponential Backoff Retry (Thử lại dãn cách thời gian)                │
│  └── Dead Letter Queue routing (Chuyển vùng an toàn khi kiệt sức retry)     │
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG CONSUMER: IDEMPOTENT EXECUTION                │
│  ├── Database Unique Constraint / processed_messages table                 │
│  └── Atomic Status Transitions (UPDATE orders SET status='DONE' WHERE ... ) │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Cứu Hộ Tin Nhắn Lỗi (DLQ Recovery Lifecycle)
\`\`\`diagram
Job hỏng ──► Rơi vào DLQ ──► Bắn Slack Alert ──► Kỹ sư điều tra lỗi
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
              [ Do Bug trong Code ]                                        [ Do Dữ liệu rác của Hacker ]
                       │                                                             │
              Sửa code & Deploy bản vá                                              Xóa bỏ vĩnh viễn khỏi DLQ
                       │
              Chạy Script Replay:
              Chuyển toàn bộ Job từ DLQ
              ngược về Hàng đợi chính!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Trùng Lặp Tin Nhắn (Deduplication Tree)
\`\`\`diagram
LÀM THẾ NÀO ĐỂ BẢO VỆ CONSUMER KHÔNG BỊ XỬ LÝ LẶP LẠI?
│
├── Thao tác tự nhiên đã có tính Idempotent (vd: UPDATE status = 'INACTIVE')?
│   └──► KHÔNG CẦN LÀM GÌ THÊM (Chạy 1 lần hay 10 lần kết quả vẫn y hệt nhau)
│
├── Thao tác cộng dồn tài chính (vd: balance = balance + 100,000đ)?
│   ├── Có chung một cơ sở dữ liệu quan hệ (PostgreSQL)?
│   │   └──► BẮT BUỘC: Dùng Transaction chèn bảng processed_messages (Message ID)
│   └── Kiến trúc phân tán nhiều Database khác nhau?
│       └──► DÙNG: Redis Atomic Lock (SET processed:id 1 NX EX 86400)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược Chống Trùng | Chi Phí Bộ Nhớ | Mức Độ An Toàn Dữ Liệu | Độ Phức Tạp Kiến Trúc | Rủi Ro Vận Hành |
| :--- | :--- | :--- | :--- | :--- |
| **Không kiểm tra** | 0% | Cực kỳ nguy hiểm, mất tiền | 0% | Khách hàng bị trừ tiền nhiều lần |
| **Job ID Deduplication** | Rất thấp (Redis Set) | Tốt ở tầng Ingestion | Thấp | Không bảo vệ được khi Consumer lỗi |
| **DB processed_messages**| Tốn thêm dung lượng bảng| Tuyệt đối 100% ACID | Trung bình | Cần dọn dẹp các ID cũ định kỳ |
| **Dead Letter Queue** | Tốn RAM/Đĩa lưu Job lỗi | Ngăn chặn mất mát dữ liệu | Cần viết script Replay | Phải theo dõi và xử lý trước khi đầy |
`,
      realCodeSnippet: `import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * ADR: Idempotent Consumer Pattern trong xử lý thanh toán tài chính
 * - Bảo đảm tính lũy kế (Idempotent): Dù tin nhắn bị gửi lại nhiều lần do mạng chập chờn,
 *   tài khoản người dùng cũng chỉ bị trừ tiền duy nhất 1 lần.
 * - Kiểm tra và lưu vết message_id trong cùng một Transaction nguyên tử của PostgreSQL.
 */
export interface PaymentJobPayload {
  transactionId: string;
  accountId: number;
  amount: number;
}

export interface ProcessedRecord {
  message_id: string;
}

@Injectable()
export class IdempotentPaymentConsumerService {
  private readonly logger = new Logger(IdempotentPaymentConsumerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Xử lý tin nhắn thanh toán đảm bảo tính Lũy kế tuyệt đối
   */
  public async processPaymentMessage(payload: PaymentJobPayload): Promise<boolean> {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Khóa và kiểm tra xem Transaction ID này đã từng được ghi nhận xử lý thành công chưa
      const existing: ProcessedRecord[] = await manager.query(
        \`SELECT message_id FROM processed_messages WHERE message_id = $1 FOR UPDATE\`,
        [payload.transactionId]
      );

      if (existing.length > 0) {
        this.logger.warn(
          \`[DUPLICATE MESSAGE] Tin nhắn \${payload.transactionId} đã được xử lý trước đó. Bỏ qua!\`
        );
        return true; // Trả về thành công ngay lập tức để Queue xóa job
      }

      // 2. Thực hiện trừ tiền trong bảng số dư
      await manager.query(
        \`UPDATE accounts SET balance = balance - $1 WHERE id = $2\`,
        [payload.amount, payload.accountId]
      );

      // 3. Đánh dấu tin nhắn đã được xử lý thành công vĩnh viễn
      await manager.query(
        \`INSERT INTO processed_messages (message_id, processed_at) VALUES ($1, NOW())\`,
        [payload.transactionId]
      );

      this.logger.log(\`[SUCCESS] Đã hoàn tất thanh toán cho giao dịch: \${payload.transactionId}\`);
      return true;
    });
  }
}`,
      quiz: [
        {
          id: 'c8-l3-q1',
          question: 'Vai trò cốt lõi và giá trị vận hành then chốt của một Dead Letter Queue (DLQ) trong kiến trúc hướng sự kiện là gì?',
          options: [
            'Tự động xóa vĩnh viễn tất cả các bản ghi có kích thước lớn hơn một megabyte để tiết kiệm tài nguyên cho hệ thống cơ sở dữ liệu.',
            'Tự động tăng tốc độ xử lý của các worker lên gấp mười lần bằng cách vô hiệu hóa hoàn toàn cơ chế kiểm tra tính toàn vẹn gói tin.',
            'Cô lập các tin nhắn bị lỗi sau nhiều lần thử lại để giải phóng hàng đợi chính, tránh Head-of-Line Blocking và bảo toàn dữ liệu phục vụ điều tra, sửa lỗi.',
            'Chuyển đổi toàn bộ các tin nhắn văn bản thuần túy sang định dạng nhị phân không thể giải mã để nâng cao tính bảo mật.',
          ],
          correctIndex: 2,
          explanation: 'Dead Letter Queue (DLQ) đóng vai trò như một khu vực cách ly: Khi một tin nhắn bị lỗi lặp đi lặp lại nhiều lần (Poison Pill), nó được chuyển sang DLQ để không làm tắc nghẽn hàng đợi chính. Đồng thời, toàn bộ payload và stack trace lỗi được lưu giữ an toàn trong DLQ, cho phép các kỹ sư sửa bug và phát lại (replay) các tin nhắn đó mà không làm mất dữ liệu của khách hàng.'
        },
        {
          id: 'c8-l3-q2',
          question: 'Vì sao trong kiến trúc Message Queue, lập trình viên bắt buộc phải thiết kế Consumer theo mẫu hình "Idempotent Consumer"?',
          options: [
            'Vì broker chỉ đảm bảo cấp độ At-Least-Once, các lỗi gián đoạn mạng xác nhận ack có thể khiến một tin nhắn bị gửi lại nhiều lần.',
            'Vì các trình thông dịch JavaScript không hỗ trợ việc thực thi các câu lệnh điều kiện rẽ nhánh bên trong các hàm xử lý hàng đợi.',
            'Vì hệ điều hành Linux sẽ tự động xóa bỏ các tiến trình worker nếu phát hiện chúng xử lý quá một nghìn tin nhắn trong một giờ.',
            'Vì các chuẩn giao thức mạng bắt buộc mỗi gói tin phải được nhân bản thành ba bản sao lưu trữ trên các máy chủ khác nhau.',
          ],
          correctIndex: 0,
          explanation: 'Bởi vì các Message Broker hoạt động theo cơ chế At-Least-Once Delivery. Khi Worker xử lý xong nhưng mạng bị lag khiến gói tin ACK không về được Broker, Broker sẽ gửi lại tin nhắn đó cho Worker khác. Nếu Consumer không có tính Idempotent (không kiểm tra trùng lặp), hành động trừ tiền hoặc tạo hóa đơn sẽ bị thực thi lặp lại 2 lần, gây sai lệch nghiêm trọng.'
        },
        {
          id: 'c8-l3-q3',
          question: 'Phương pháp nào sau đây là giải pháp kỹ thuật chuẩn mực nhất để biến một Consumer xử lý đơn hàng tài chính thành Idempotent Consumer?',
          options: [
            'Sử dụng một biến mảng toàn cục trong bộ nhớ RAM của tiến trình Node.js để lưu trữ danh sách các mã đơn hàng đã xử lý.',
            'Sử dụng bảng processed_messages trong cùng một Transaction cơ sở dữ liệu để ghi nhận và kiểm tra tính duy nhất của message_id.',
            'Khởi động lại máy chủ cơ sở dữ liệu sau mỗi lần hoàn thành một đơn hàng để giải phóng toàn bộ các kết nối mạng.',
            'Bỏ qua việc lưu trữ lịch sử giao dịch và chỉ cập nhật số dư cuối cùng của người dùng vào lúc nửa đêm.',
          ],
          correctIndex: 1,
          explanation: 'Giải pháp chuẩn mực nhất là sử dụng bảng processed_messages (hoặc cột idempotent_key có UNIQUE constraint) nằm trong cùng Database Transaction với câu lệnh trừ tiền. Khi nhận tin nhắn, Consumer kiểm tra message_id: nếu đã có thì bỏ qua; nếu chưa có thì vừa trừ tiền vừa chèn message_id trong cùng một Transaction nguyên tử, đảm bảo tuyệt đối không bao giờ bị trừ tiền 2 lần.'
        },
        {
          id: 'c8-l3-q4',
          question: 'Một tin nhắn mang dữ liệu sai schema hoặc lỗi logic nghiêm trọng (Poison Pill Message) nếu không có Dead Letter Queue sẽ gây ra thảm họa nào?',
          options: [
            'Worker sẽ liên tục xử lý lỗi, ném ngoại lệ và đẩy lại vào hàng đợi, tạo thành vòng lặp vô tận (Infinite Crash Loop) làm tắc nghẽn toàn bộ hàng trăm nghìn tin nhắn bình thường phía sau (Head-of-Line Blocking).',
            'Toàn bộ ổ đĩa cứng của cụm máy chủ cơ sở dữ liệu sẽ bị xóa sạch dữ liệu do cơ chế bảo vệ phần cứng tự động kích hoạt.',
            'Hệ thống mạng internet của trung tâm dữ liệu sẽ bị ngắt kết nối vật lý để ngăn chặn việc lan truyền mã độc sang máy chủ khác.',
            'Hệ quản trị Redis sẽ tự động chuyển đổi toàn bộ các khóa dữ liệu sang định dạng văn bản thô không thể phục hồi.',
          ],
          correctIndex: 0,
          explanation: 'Một Poison Pill là tin nhắn mà mã nguồn của bạn chắc chắn sẽ bị crash khi đọc. Nếu không có giới hạn retry và DLQ, Worker sẽ thất bại -> ném lỗi -> Queue đưa tin nhắn quay lại đầu hàng đợi -> Worker lại bốc chính tin nhắn đó và lại crash... tạo thành vòng lặp vô tận (Infinite Crash Loop), làm tê liệt hoàn toàn Worker và ngăn chặn mọi tin nhắn bình thường phía sau.'
        },
        {
          id: 'c8-l3-q5',
          question: 'Sau khi đội ngũ kỹ sư sửa xong lỗi bug trong mã nguồn Consumer, quy trình "DLQ Replay" (Phát lại tin nhắn lỗi) thường diễn ra như thế nào?',
          options: [
            'Yêu cầu khách hàng nhập lại toàn bộ thông tin thanh toán từ đầu trên ứng dụng di động.',
            'Xóa bỏ toàn bộ database và khôi phục từ bản sao lưu tuần trước.',
            'Sử dụng script đọc tuần tự các Job đang lưu trong DLQ, làm sạch nếu cần, và đẩy ngược lại vào hàng đợi chính (Main Queue) để các Worker phiên bản mới xử lý.',
            'Tự động tăng số tiền trong tài khoản của toàn bộ khách hàng lên 10%.',
          ],
          correctIndex: 2,
          explanation: 'Mục đích tối thượng của DLQ là bảo toàn dữ liệu. Khi bug đã được vá và deploy lên production, kỹ sư chạy một tác vụ Replay: Bốc các tin nhắn từ hàng đợi DLQ đẩy ngược lại vào hàng đợi chính (Main Queue). Các Worker với phiên bản code mới đã sửa lỗi sẽ tiêu thụ bình thường, bảo đảm 100% dữ liệu không bị thất thoát.'
        },
        {
          id: 'c8-l3-q6',
          question: 'Trong cơ chế Change Data Capture (CDC) kết hợp Outbox Pattern, công cụ như Debezium theo dõi thành phần nào của Database để bắn sự kiện vào Kafka?',
          options: [
            'Database Transaction Log (như WAL trong PostgreSQL hoặc Binlog trong MySQL), hoàn toàn không cần can thiệp hay khóa bảng ở tầng ứng dụng.',
            'Mỗi phút chạy câu lệnh SELECT * FROM outbox một lần.',
            'Quét các tệp tin log trong thư mục /var/log/syslog của hệ điều hành Linux.',
            'Theo dõi các yêu cầu HTTP gửi đến cổng mạng 80 của máy chủ web Nginx.',
          ],
          correctIndex: 0,
          explanation: 'CDC engine (như Debezium) đọc trực tiếp Write-Ahead Log (WAL trong PostgreSQL hoặc Binlog trong MySQL) của database. Mọi thay đổi dữ liệu đã commit vào bảng outbox đều được stream ngay lập tức vào Kafka với độ trễ vài mili giây mà không cần polling DB bằng lệnh SELECT, triệt tiêu 100% chi phí CPU của database.'
        },
        {
          id: 'c8-l3-q7',
          question: 'Thời gian sống (TTL / Retention Policy) của bảng ghi nhận tin nhắn đã xử lý (processed_messages) nên được thiết lập như thế nào?',
          options: [
            'Lưu trữ đúng 5 giây rồi xóa ngay lập tức.',
            'Lưu trữ vĩnh viễn không bao giờ xóa cho đến khi ổ cứng đầy.',
            'Lưu trữ tối thiểu bằng thời gian lưu trữ tin nhắn tối đa của Message Broker (ví dụ: 7 đến 14 ngày) kèm tiến trình dọn dẹp nền định kỳ.',
            'Chỉ lưu trữ trong biến bộ nhớ heap của Node.js mà không lưu xuống đĩa.',
          ],
          correctIndex: 2,
          explanation: 'Nếu xóa quá sớm (ví dụ 10 phút), một tin nhắn bị gửi lại sau 15 phút sẽ bị xử lý trùng. Nếu lưu vĩnh viễn, bảng processed_messages sẽ phình to hàng trăm triệu dòng làm chậm database. Chuẩn mực là lưu bằng hoặc lớn hơn thời gian tối đa mà broker có thể retry hoặc giữ message (ví dụ 7-14 ngày), sau đó chạy cron job dọn dẹp các bản ghi cũ.'
        },
        {
          id: 'c8-l3-q8',
          question: 'Khi triển khai mô hình Saga phân tán (Distributed Saga Pattern) qua Message Queue, cơ chế nào được dùng để hủy bỏ các giao dịch đã hoàn tất nếu một bước ở giữa bị lỗi?',
          options: [
            'Giao dịch bù trừ (Compensating Transactions): Khi bước thanh toán hoặc giao hàng thất bại, một chuỗi sự kiện rollback được phát ra để hoàn tiền và khôi phục kho.',
            'Gọi lệnh ROLLBACK SQL trên toàn bộ các microservices qua một kết nối JDBC duy nhất.',
            'Tắt toàn bộ máy chủ cơ sở dữ liệu để hệ thống tự động đưa số dư về 0.',
            'Gửi thông báo cảnh báo màu đỏ lên màn hình của lập trình viên trực ca.',
          ],
          correctIndex: 0,
          explanation: 'Trong kiến trúc Microservices phân tán với các database độc lập, không thể dùng 2PC (Two-Phase Commit) vì quá chậm và khóa tài nguyên. Thay vào đó, Saga Pattern sử dụng các Giao dịch bù trừ (Compensating Transactions): Ví dụ nếu bước Ship hàng lỗi, một event OrderFailed được phát đi để kích hoạt dịch vụ Payment thực hiện hành động bù (Refund tiền cho khách).'
        }
      ],
      codeChallenge: {
        id: 'c8-l3-c1',
        title: 'Bộ Lọc Tin Nhắn Trùng Lặp Idempotent Consumer (Message Deduplicator)',
        description: 'Hiện thực hàm \`processIdempotentMessages(messages: Array<{ messageId: string; amount: number }>): Array<{ messageId: string; executed: boolean }>\` nhận vào một danh sách các tin nhắn. Với mỗi tin nhắn, nếu \`messageId\` chưa từng xuất hiện, đánh dấu \`executed: true\` và ghi nhớ \`messageId\`. Nếu \`messageId\` đã xuất hiện trước đó trong danh sách, đánh dấu \`executed: false\`. Trả về mảng kết quả tương ứng.',
        starterCode: `export function processIdempotentMessages(
  messages: Array<{ messageId: string; amount: number }>
): Array<{ messageId: string; executed: boolean }> {
  // TODO: Hiện thực kiểm tra tính lũy kế của tin nhắn
  return [];
}`,
        solution: `export function processIdempotentMessages(
  messages: Array<{ messageId: string; amount: number }>
): Array<{ messageId: string; executed: boolean }> {
  const seen = new Set<string>();
  const results: Array<{ messageId: string; executed: boolean }> = [];

  for (const msg of messages) {
    if (seen.has(msg.messageId)) {
      results.push({ messageId: msg.messageId, executed: false });
    } else {
      seen.add(msg.messageId);
      results.push({ messageId: msg.messageId, executed: true });
    }
  }

  return results;
}`,
        testCases: [
          {
            name: 'Xử lý tin nhắn đơn lẻ thành công',
            input: [[{ messageId: 'msg_001', amount: 50 }]],
            expected: [{ messageId: 'msg_001', executed: true }]
          },
          {
            name: 'Chặn tin nhắn trùng lặp xuất hiện lần thứ hai',
            input: [[
              { messageId: 'msg_001', amount: 50 },
              { messageId: 'msg_001', amount: 100 },
              { messageId: 'msg_002', amount: 200 }
            ]],
            expected: [
              { messageId: 'msg_001', executed: true },
              { messageId: 'msg_001', executed: false },
              { messageId: 'msg_002', executed: true }
            ]
          },
          {
            name: 'Xử lý mảng rỗng trả về kết quả rỗng',
            input: [[]],
            expected: []
          },
          {
            name: 'Chặn tin nhắn bị lặp lại liên tiếp nhiều lần',
            input: [[
              { messageId: 'dup_key', amount: 10 },
              { messageId: 'dup_key', amount: 20 },
              { messageId: 'dup_key', amount: 30 },
              { messageId: 'dup_key', amount: 40 }
            ]],
            expected: [
              { messageId: 'dup_key', executed: true },
              { messageId: 'dup_key', executed: false },
              { messageId: 'dup_key', executed: false },
              { messageId: 'dup_key', executed: false }
            ]
          },
          {
            name: 'Xử lý chuỗi tin nhắn với các ID hoàn toàn khác nhau',
            input: [[
              { messageId: 'id_1', amount: 100 },
              { messageId: 'id_2', amount: 200 },
              { messageId: 'id_3', amount: 300 }
            ]],
            expected: [
              { messageId: 'id_1', executed: true },
              { messageId: 'id_2', executed: true },
              { messageId: 'id_3', executed: true }
            ]
          }
        ]
      }
    }
  ]
};
