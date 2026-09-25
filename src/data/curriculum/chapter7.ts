import type { Sprint } from './types.ts';

export const chapter7: Sprint = {
  sprintId: 7,
  sprintTitle: 'Chương 7: In-Memory Caching & Redis Internals: Từ Zero Đến Distributed Caching',
  sprintDesc: 'Làm chủ bộ nhớ tốc độ cao: Kiến trúc Single-Threaded I/O Multiplexing, Cấu trúc dữ liệu nội tại (SDS, ZipList, SkipList), Chiến lược Cache (Cache-Aside, Stampede) và Khóa phân tán Redlock',
  lessons: [
    {
      id: 'c7-l1',
      title: 'Bài 01: Redis Engine Deep Dive: Single-Threaded Architecture, I/O Multiplexing & Cấu Trúc Dữ Liệu Nội Tại',
      duration: '60 phút',
      tag: 'Redis Engine Internals',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: MÔ HÌNH XỬ LÝ ĐƠN LUỒNG NGUYÊN TỬ, I/O MULTIPLEXING & CẤU TRÚC BỘ NHỚ CỦA REDIS (ARCHITECTURAL CONTEXT & IN-MEMORY ENGINE)

Tại sao một tiến trình đơn luồng (Single-Threaded Process) như Redis lại có thể đạt thông lượng vượt trội hơn 100,000 phép toán mỗi giây (100k+ OPS) với độ trễ dưới 1 mili giây (Sub-millisecond Latency), vượt xa các hệ thống đa luồng phức tạp?
* **Bản chất của Mô hình Đơn Luồng Thực Thi (Single-Threaded Execution Model):**
  - Trong các hệ thống đa luồng (Multi-threaded), việc nhiều luồng cùng truy cập một cấu trúc dữ liệu chia sẻ đòi hỏi các cơ chế đồng bộ hóa (Mutex, Read-Write Locks, Spinlocks, Semaphores). Khi số lượng kết nối tăng cao, hiện tượng **Lock Contention** (tranh chấp khóa) và chi phí chuyển đổi ngữ cảnh (**Thread Context Switching Overhead**) sẽ tiêu tốn phần lớn năng lực xử lý của CPU.
  - Redis loại bỏ hoàn toàn các loại khóa bằng cách chạy toàn bộ logic dữ liệu trên **1 luồng chính duy nhất**. Hậu quả tích cực: $0\\%$ chi phí Locking, $0\\%$ nguy cơ Race Condition nội tại, và mọi lệnh thao tác đơn lẻ (\`INCR\`, \`HSET\`, \`LPUSH\`, \`ZADD\`) đều có tính **Nguyên tử tuyệt đối (Atomic by default)**!
* **Cơ chế Phân Kênh I/O Bất Đồng Bộ (Non-blocking I/O Multiplexing via epoll/kqueue):**
  - Redis không để một luồng bị chặn khi chờ đợi dữ liệu từ socket mạng.
  - Sử dụng các lệnh gọi hệ thống (System Calls) hiện đại của Linux Kernel như **\`epoll\`** (hoặc \`kqueue\` trên BSD/macOS), một luồng Redis có thể theo dõi đồng thời hàng chục nghìn kết nối mạng (File Descriptors).
  - Khi một gói tin TCP truyền đến, Kernel thông báo cho Redis qua một sự kiện sẵn sàng (Read Event). Bộ điều phối sự kiện (**Event Dispatcher**) đưa sự kiện vào hàng đợi và luồng chính thực thi lệnh trong vài microsecond!
* **Tối Ưu Hóa Cấu Trúc Dữ Liệu Ở Tầng C:**
  - Redis không sử dụng chuỗi ký tự chuẩn của C (\`char*\` kết thúc bằng byte \`\\0\` vốn đòi hỏi $O(N)$ để đo độ dài). Nó tự phát minh ra **SDS (Simple Dynamic String)**: Lưu sẵn độ dài chuỗi (\`len\`) và dung lượng cấp phát dư (\`alloc\`) trong phần Header, giúp đo độ dài trong $O(1)$ và ngăn chặn triệt để lỗi tràn bộ đệm (Buffer Overflow).
  - Tự động chuyển đổi biểu diễn nội tại (Internal Encoding Transformation): Khi tập hợp có ít phần tử, Redis dùng **ZipList / Listpack** (mảng nén liên tục trong RAM để giảm thiểu phân mảnh bộ nhớ và tận dụng CPU Cache L1/L2); khi số lượng phần tử vượt ngưỡng, nó tự động nâng cấp thành **SkipList** (cấu trúc dữ liệu phân tầng xác suất) để duy trì tốc độ tìm kiếm và sắp xếp $O(\\log N)$!

---

# 2. VÌ SAO REDIS ĐƠN LUỒNG LẠI NHANH VƯỢT TRỘI?

Tốc độ của Redis bắt nguồn từ 3 yếu tố kiến trúc cốt lõi:
1. **$100\\%$ Toàn bộ dữ liệu nằm trong RAM:** Truy xuất RAM mất ~100 nanoseconds, nhanh hơn đọc ổ cứng SSD NVMe hàng nghìn lần.
2. **Non-blocking I/O Multiplexing (epoll/kqueue):** Một luồng duy nhất có thể tiếp nhận và theo dõi hàng chục nghìn kết nối mạng đồng thời mà không tốn công cấp phát thread riêng.
3. **Tuyệt đối không có Lock Contention:** Vì chỉ có 1 luồng thực thi các lệnh dữ liệu, Redis không bao giờ phải dùng Mutex, Semaphore hay Spinlock để bảo vệ dữ liệu. Mọi thao tác đơn lẻ (\`INCR\`, \`HSET\`, \`LPUSH\`) đều có tính **Nguyên tử tuyệt đối (Atomic by default)**!

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KIẾN TRÚC NỘI TẠI CỦA REDIS RUNTIME                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Client 1 (TCP) ──┐                                                         │
│  Client 2 (TCP) ──┼──► [ I/O MULTIPLEXER (Linux epoll) ]                    │
│  Client 3 (TCP) ──┘                  │                                      │
│                                      ▼                                      │
│                         [ EVENT DISPATCHER QUEUE ]                          │
│                                      │                                      │
│                                      ▼                                      │
│                     [ SINGLE-THREADED EXECUTION ENGINE ]                    │
│                     (Thực thi lệnh trong RAM: O(1) hoặc O(log N))           │
│                                      │                                      │
│                                      ▼                                      │
│                         [ CẤU TRÚC DỮ LIỆU BỘ NHỚ ]                         │
│                         ├── SDS (Simple Dynamic Strings)                    │
│                         ├── Dict (Bảng băm hai lớp rehash ngầm)             │
│                         ├── SkipList (Cây phân tầng cho Sorted Set ZSET)    │
│                         └── QuickList / ZipList (Nén bộ nhớ tối đa)         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

# 3. GIẢI MÃ CẤU TRÚC DỮ LIỆU CẤP THẤP: SDS & SKIPLIST

### 3.1 Simple Dynamic String (SDS) So Với Chuỗi C Cổ Điển
Trong ngôn ngữ C, chuỗi kết thúc bằng ký tự \`\\0\`. Muốn biết độ dài chuỗi phải duyệt từ đầu đến cuối ($O(N)$).
Cấu trúc SDS của Redis:
\`\`\`c
struct __attribute__ ((__packed__)) sdshdr8 {
    uint8_t len;        // Số byte đang sử dụng thực tế (Lấy strlen chỉ tốn O(1))
    uint8_t alloc;      // Tổng số byte đã cấp phát (Bao gồm bộ đệm dự phòng)
    unsigned char flags;// Loại header (sdshdr5, 8, 16, 32, 64)
    char buf[];         // Mảng chứa dữ liệu ký tự thực tế
};
\`\`\`
* **Binary Safe:** Cho phép lưu bất kỳ dữ liệu nhị phân nào (kể cả ảnh, audio, serialize protobuf) mà không sợ bị đứt chuỗi khi gặp ký tự \`\\0\`.
* **Zero Buffer Overflow:** Luôn kiểm tra \`alloc\` trước khi nối chuỗi, tự động cấp phát thêm RAM trước khi ghi.

### 3.2 SkipList (Cấu Trúc Của Sorted Set - ZSET)
Thay vì dùng cây cân bằng Red-Black Tree phức tạp đòi hỏi tái cân bằng liên tục khi ghi:
Redis dùng **SkipList (Danh sách liên kết nhảy cóc)**:
* Nhiều tầng danh sách liên kết chồng lên nhau.
* Tầng trên cùng có bước nhảy thưa (nhảy 10 bước), tầng dưới bước nhảy dày hơn.
* Cho phép tìm kiếm, thêm, xóa phần tử với độ phức tạp kỳ vọng **$O(\\log N)$** nhưng cài đặt đơn giản hơn nhiều và hỗ trợ duyệt khoảng (\`ZRANGEBYSCORE\`) cực kỳ xuất sắc!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Ánh Xạ Kiểu Dữ Liệu Redis (Data Types & Encodings Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REDIS USER TYPES  ◄───►  INTERNAL ENCODINGS              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. STRING ('set key value')          │ ──► int, embstr (<=44 bytes), raw    │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 2. LIST ('lpush', 'rpop')            │ ──► quicklist (Danh sách các ziplist)│
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 3. HASH ('hset user name oanh')      │ ──► listpack (nhỏ) / hashtable (lớn) │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 4. SET ('sadd tags backend')         │ ──► intset (toàn số) / hashtable     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 5. SORTED SET ('zadd leaderboard')   │ ──► listpack (nhỏ) / skiplist + dict │
└──────────────────────────────────────┴──────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Cơ Chế Tìm Kiếm Nhảy Cóc Trong SkipList (SkipList Search Flow)
\`\`\`diagram
Tầng 3: [ Head ] ──────────────────────────────────────────► [ Node 50 ] ──► NULL
             │                                                     │
             ▼                                                     ▼
Tầng 2: [ Head ] ──────────────► [ Node 25 ] ──────────────► [ Node 50 ] ──► NULL
             │                       │                             │
             ▼                       ▼                             ▼
Tầng 1: [ Head ] ──► [ Node 10 ] ──► [ Node 25 ] ──► [ Node 30 ] ──► [ Node 50 ] ──► NULL
(Cần tìm Node 30: Nhảy Tầng 3 -> Thấy 50 lớn hơn 30 -> Hạ xuống Tầng 2 -> Nhảy đến 25
 -> Hạ xuống Tầng 1 -> Nhảy 1 bước tới đúng Node 30! Chỉ tốn vài bước nhảy O(log N)).
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Cấu Trúc Dữ Liệu (Data Structure Tree)
\`\`\`diagram
BẠN CẦN LƯU TRỮ DỮ LIỆU GÌ TRONG REDIS?
│
├── Cần lưu một giá trị đơn lẻ, token, số đếm, JSON string?
│   └──► DÙNG: STRING (SET, GET, INCR)
│
├── Cần lưu một đối tượng có nhiều thuộc tính (User Profile: name, age, email)?
│   └──► DÙNG: HASH (HSET, HGET, HINCRBY) - Tiết kiệm RAM hơn String rất nhiều!
│
├── Cần hàng đợi FIFO / LIFO (Queue / Stack)?
│   └──► DÙNG: LIST (LPUSH + RPOP / BRPOP)
│
├── Cần bảng xếp hạng điểm số (Leaderboard) hoặc phân trang theo thời gian?
│   └──► DÙNG: SORTED SET (ZADD, ZREVRANGE, ZSCORE)
│
└── Cần kiểm tra trùng lặp tập hợp không có thứ tự (Tagging, Unique Visitors)?
    └──► DÙNG: SET (SADD, SISMEMBER, SINTER)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Kiểu Dữ Liệu | Thao Tác Điển Hình | Độ Phức Tạp Thời Gian | Mức Tiêu Hao Bộ Nhớ RAM | Kịch Bản Ứng Dụng Chuẩn |
| :--- | :--- | :--- | :--- | :--- |
| **String** | GET / SET | $O(1)$ | Trung bình (Có header SDS) | Caching HTML/JSON, Idempotency Key |
| **Hash** | HGET / HSET | $O(1)$ | Cực thấp (Khi dùng listpack) | Quản lý User Session, Entity fields |
| **List** | LPUSH / RPOP | $O(1)$ ở hai đầu, $O(N)$ ở giữa| Thấp (Quicklist nén) | Hàng đợi công việc, Feed tin mới nhất |
| **Sorted Set** | ZADD / ZRANGE | $O(\\log N)$ | Cao hơn (Lưu cả Dict và SkipList)| Bảng xếp hạng game, Rate Limiter cửa sổ |
`,
      realCodeSnippet: `import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * ADR: Giám sát nội tại Redis Engine cấp thấp
 * - Sử dụng INFO Memory, INFO Stats, và OBJECT ENCODING để phát hiện Key phình to (Bigkeys)
 * - Đo lường Memory Fragmentation Ratio: Nếu ratio > 1.5 cảnh báo lãng phí RAM do jemalloc
 */
export interface RedisDiagnosticsReport {
  usedMemoryHuman: string;
  usedMemoryRssHuman: string;
  memFragmentationRatio: number;
  instantaneousOpsPerSec: number;
  keyEncoding: string;
  keySerializedLengthBytes: number;
}

@Injectable()
export class RedisDiagnosticsService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisDiagnosticsService.name);
  private readonly redisClient: Redis;

  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.redisClient.quit();
  }

  /**
   * Truy vấn thông số nội tại của Redis Engine: Bộ nhớ, Fragmentation, Throughput và Cấu trúc encoding
   */
  public async getEngineDiagnostics(testKey: string): Promise<RedisDiagnosticsReport> {
    if (this.redisClient.status !== 'ready') {
      await this.redisClient.connect();
    }

    // 1. Thu thập dữ liệu thống kê từ memory và stats
    const [memoryInfo, statsInfo] = await Promise.all([
      this.redisClient.info('memory'),
      this.redisClient.info('stats'),
    ]);

    const memoryMatch = memoryInfo.match(/used_memory_human:(.*)/);
    const rssMatch = memoryInfo.match(/used_memory_rss_human:(.*)/);
    const fragMatch = memoryInfo.match(/mem_fragmentation_ratio:(.*)/);
    const opsMatch = statsInfo.match(/instantaneous_ops_per_sec:(.*)/);

    // 2. Kiểm tra kiểu mã hóa nội tại và kích thước tuần tự của testKey
    const [encoding, serializedLen] = await Promise.all([
      this.redisClient.object('ENCODING', testKey),
      this.redisClient.dump(testKey).then((buf) => (buf ? buf.length : 0)),
    ]);

    const fragRatio = fragMatch ? parseFloat(fragMatch[1].trim()) : 1.0;
    if (fragRatio > 1.5) {
      this.logger.warn(\`Cảnh báo phân mảnh bộ nhớ cao trên Redis: Ratio \${fragRatio}\`);
    }

    return {
      usedMemoryHuman: memoryMatch ? memoryMatch[1].trim() : 'N/A',
      usedMemoryRssHuman: rssMatch ? rssMatch[1].trim() : 'N/A',
      memFragmentationRatio: fragRatio,
      instantaneousOpsPerSec: opsMatch ? parseInt(opsMatch[1].trim(), 10) : 0,
      keyEncoding: encoding || 'KEY_NOT_FOUND',
      keySerializedLengthBytes: serializedLen,
    };
  }
}`,
      quiz: [
        {
          id: 'c7-l1-q1',
          question: 'Lý do kiến trúc cốt lõi nào giúp cho Redis đạt được hiệu năng hơn 100,000 OPS với độ trễ sub-millisecond dù chỉ dùng duy nhất 1 luồng thực thi chính?',
          options: [
            'Redis chuyển toàn bộ việc tính toán sang bộ tăng tốc phần cứng TPU của hạ tầng đám mây.',
            'Dữ liệu nằm 100% trong RAM, tận dụng Non-blocking I/O Multiplexing (epoll) và loại bỏ hoàn toàn chi phí Lock Contention lẫn Context Switching.',
            'Redis bắt buộc tất cả client phải nén dữ liệu trước khi gửi và chỉ hỗ trợ định dạng nhị phân thuần túy.',
            'Redis giới hạn mỗi kết nối mạng chỉ được phép gửi duy nhất 1 yêu cầu mỗi giây để tránh xung đột luồng.',
          ],
          correctIndex: 1,
          explanation: 'Redis đạt tốc độ kinh ngạc nhờ 3 trụ cột: 1) Dữ liệu nằm trọn vẹn trong RAM (độ trễ nanoseconds); 2) Sử dụng I/O Multiplexing (epoll/kqueue) quản lý hàng chục nghìn kết nối mạng trên 1 luồng; 3) Vì là đơn luồng nên 0% chi phí tranh chấp khóa (Lock Contention) và 0% chi phí hoán đổi ngữ cảnh luồng (Context Switching).'
        },
        {
          id: 'c7-l1-q2',
          question: 'Cấu trúc Simple Dynamic String (SDS) của Redis mang lại ưu thế kỹ thuật vượt trội nào so với chuỗi ký tự kết thúc bằng null (\\0) trong ngôn ngữ C truyền thống?',
          options: [
            'SDS tự động mã hóa chuỗi thành SHA-256 để chống lại các lỗ hổng Injection ở tầng hệ điều hành.',
            'SDS tự động giải phóng vùng nhớ heap của Linux về 0 ngay khi biến không còn được tham chiếu.',
            'SDS giới hạn độ dài chuỗi tối đa là 16 ký tự để luôn vừa vặn trong một thanh ghi CPU 64-bit.',
            'SDS lưu sẵn len và alloc trong header giúp đo độ dài O(1), an toàn nhị phân (Binary Safe) và chống tràn bộ đệm (Buffer Overflow).',
          ],
          correctIndex: 3,
          explanation: 'Chuỗi C truyền thống kết thúc bằng byte "\\0" nên không thể chứa byte 0 (không an toàn nhị phân) và tính strlen() tốn O(N). SDS lưu thuộc tính len trong header cho phép lấy độ dài O(1), lưu alloc giúp kiểm tra dung lượng trước khi ghi (chống Buffer Overflow) và Binary Safe giúp lưu trữ bất kỳ dữ liệu nhị phân nào như ảnh hay gzip.'
        },
        {
          id: 'c7-l1-q3',
          question: 'Vì sao Redis lại lựa chọn cấu trúc dữ liệu SkipList (Danh sách liên kết nhảy cóc) để hiện thực Sorted Set (ZSET) thay vì cây cân bằng Red-Black Tree?',
          options: [
            'SkipList có độ phức tạp kỳ vọng O(log N) tương đương cây đỏ đen nhưng cài đặt đơn giản hơn, không tốn chi phí Tree Rotation khi ghi và hỗ trợ duyệt khoảng (Range Queries) siêu tốc.',
            'Vì cây Red-Black Tree chỉ hoạt động trên kiến trúc CPU x86 32-bit và không hỗ trợ CPU ARM64 hiện đại.',
            'Vì SkipList có khả năng tự động xóa dữ liệu khỏi bộ nhớ RAM khi dung lượng bộ nhớ vượt quá 80%.',
            'Vì các thuật toán cây cân bằng bị cấm trong tiêu chuẩn POSIX dành cho các hệ thống in-memory database.',
          ],
          correctIndex: 0,
          explanation: 'SkipList đạt độ phức tạp tìm kiếm/chèn/xóa O(log N) tương đương Red-Black Tree nhưng không cần cơ chế xoay cây phức tạp khi cập nhật điểm số. Hơn thế, việc liên kết tuần tự các node ở tầng đáy giúp các thao tác duyệt dải điểm (ZRANGEBYSCORE) diễn ra cực nhanh bằng cách duyệt con trỏ kế tiếp mà cây nhị phân không tối ưu bằng.'
        },
        {
          id: 'c7-l1-q4',
          question: 'Tại sao việc thực thi lệnh "KEYS *" trong môi trường Redis Production bị coi là một "lỗ hổng vận hành chí mạng"?',
          options: [
            'Vì lệnh này sẽ xóa toàn bộ các snapshot sao lưu RDB đang được lưu trữ trên ổ đĩa SSD.',
            'Vì lệnh KEYS * chỉ có thể được gọi bởi tài khoản Linux root thông qua socket nội bộ /tmp/redis.sock.',
            'Vì Redis chạy đơn luồng, KEYS * phải duyệt tuần tự qua toàn bộ Keyspace O(N), làm đóng băng máy chủ suốt nhiều giây và gây nghẽn toàn bộ kết nối khác.',
            'Vì lệnh KEYS * làm đảo lộn thứ tự băm của bảng Hashtable bên trong khiến tất cả các truy vấn GET tiếp theo bị sai dữ liệu.',
          ],
          correctIndex: 2,
          explanation: 'Redis xử lý lệnh tuần tự trên một Single Thread. Khi gọi KEYS *, nếu database có hàng triệu khóa, Redis sẽ quét toàn bộ Keyspace trong nhiều giây. Trong suốt thời gian này, không có bất kỳ lệnh nào khác từ hàng nghìn kết nối mạng được phục vụ, dẫn đến Client Timeout hàng loạt và làm sập toàn bộ hệ thống. Trong Production, bắt buộc phải dùng lệnh phân trang SCAN.'
        },
        {
          id: 'c7-l1-q5',
          question: 'Chỉ số "mem_fragmentation_ratio" trong Redis INFO Memory phản ánh điều gì và khi nào chỉ số này báo hiệu vấn đề nghiêm trọng?',
          options: [
            'Tỷ lệ giữa dung lượng nén zip và dung lượng chuỗi thô; tỷ lệ < 0.5 báo hiệu dữ liệu bị nén quá mức.',
            'Tỷ lệ giữa bộ nhớ RSS của hệ điều hành cấp phát (used_memory_rss) và bộ nhớ Redis thực tế sử dụng (used_memory); tỷ lệ > 1.5 cho thấy bộ nhớ đang bị phân mảnh nghiêm trọng.',
            'Tỷ lệ giữa số lượng khóa String và khóa Sorted Set trong toàn bộ hệ cơ sở dữ liệu in-memory.',
            'Tỷ lệ giữa dung lượng cache hit và cache miss; tỷ lệ > 2.0 cho thấy database quan hệ đang bị quá tải.',
          ],
          correctIndex: 1,
          explanation: 'mem_fragmentation_ratio = used_memory_rss / used_memory. Do bộ cấp phát bộ nhớ (thường là jemalloc) cấp phát bộ nhớ theo các trang cố định, khi các key bị thêm/xóa liên tục, hệ điều hành giữ lại các trang rác. Nếu ratio > 1.5, nghĩa là Redis đang lãng phí hơn 50% RAM cho phân mảnh, cần bật active defragmentation (activedefrag yes).'
        },
        {
          id: 'c7-l1-q6',
          question: 'Kể từ phiên bản Redis 6.0, tính năng Threaded I/O (I/O đa luồng) được đưa vào nhằm mục đích gì và có ảnh hưởng đến tính nguyên tử của các câu lệnh không?',
          options: [
            'Chỉ sử dụng đa luồng cho việc đọc/ghi socket mạng và parse giao thức RESP, còn luồng chính vẫn duy nhất thực thi logic lệnh, giữ nguyên 100% tính nguyên tử.',
            'Chuyển toàn bộ các lệnh ghi dữ liệu như HSET, LPUSH sang chạy đa luồng đồng thời bằng cơ chế Multi-version Concurrency Control.',
            'Loại bỏ hoàn toàn luồng chính và sử dụng Worker Thread Pool của Node.js để thực thi câu lệnh Redis.',
            'Chỉ áp dụng đa luồng khi sao chép dữ liệu sang các Slave Replica mà không can thiệp vào Client I/O.',
          ],
          correctIndex: 0,
          explanation: 'Nút thắt cổ chai lớn nhất của Redis khi mạng đạt 10Gbps+ là chi phí CPU tiêu tốn vào việc đọc/ghi socket TCP và parse giao thức RESP. Redis 6.0 tách việc I/O mạng này cho các I/O Threads phụ trợ xử lý song song, trong khi luồng thực thi dữ liệu chính (Main Execution Thread) vẫn là Single-Threaded, đảm bảo 100% tính nguyên tử và không cần lock.'
        },
        {
          id: 'c7-l1-q7',
          question: 'Cơ chế biến đổi mã hóa nội tại (Internal Encoding) nào diễn ra khi một HASH trong Redis tăng từ số lượng trường nhỏ lên hàng chục nghìn trường?',
          options: [
            'Từ cấu trúc cây cân bằng B-Tree chuyển đổi sang mảng liên kết tĩnh hai chiều.',
            'Từ định dạng chuỗi SDS thuần túy chuyển đổi sang tệp tin SQLite lưu tạm trên phân vùng /tmp.',
            'Từ tệp nhị phân nén gzip chuyển đổi sang bảng băm phân tán Merkle Tree.',
            'Từ mảng nén bộ nhớ liên tục (listpack / ziplist) chuyển đổi sang bảng băm hai lớp (hashtable) để giữ độ phức tạp truy xuất O(1).',
          ],
          correctIndex: 3,
          explanation: 'Khi một Hash có ít phần tử và dung lượng các trường nhỏ hơn ngưỡng cấu hình (hash-max-listpack-entries / hash-max-ziplist-value), Redis lưu dưới dạng listpack/ziplist (mảng liên tục trong RAM giúp tiết kiệm bộ nhớ tối đa). Khi vượt quá ngưỡng, Redis tự động nâng cấp sang Hashtable (bảng băm hai lớp) để duy trì thời gian truy xuất O(1).'
        },
        {
          id: 'c7-l1-q8',
          question: 'Khi Redis thực hiện sao lưu dữ liệu nền định kỳ (BGSAVE) để tạo snapshot RDB, kỹ thuật nhân hệ điều hành Linux nào được sử dụng để tránh làm đóng băng luồng chính?',
          options: [
            'Hệ điều hành dùng hàm fork() sinh tiến trình con và tận dụng cơ chế Copy-on-Write (COW) của bảng trang bộ nhớ ảo.',
            'Hệ điều hành khóa toàn bộ quyền ghi của các client cho đến khi toàn bộ RAM được xả xuống đĩa SSD.',
            'Redis nén toàn bộ RAM thành tệp tin zip và truyền trực tiếp qua giao thức FTP sang máy chủ khác.',
            'Redis tạm dừng toàn bộ kết nối TCP và chuyển các truy vấn mới vào bộ nhớ đệm card mạng eBPF.',
          ],
          correctIndex: 0,
          explanation: 'Lệnh BGSAVE gọi fork() để tạo một tiến trình con (child process). Tiến trình con chia sẻ cùng không gian địa chỉ bộ nhớ vật lý với tiến trình cha nhờ cơ chế Copy-on-Write (COW) của Linux Kernel. Chỉ khi tiến trình cha sửa đổi một trang bộ nhớ, trang đó mới được sao chép thực sự, giúp quá trình ghi RDB diễn ra hoàn toàn độc lập mà không chặn luồng chính.'
        }
      ],
      codeChallenge: {
        id: 'c7-l1-c1',
        title: 'Mô Phỏng Cấu Trúc SDS String Buffer Tracker',
        description: 'Hiện thực hàm \`simulateSdsOperations(initialStr: string, appendStr?: string): { len: number; alloc: number; str: string }\`. Khởi tạo SDS với \`len = initialStr.length\` và \`alloc = initialStr.length * 2\`. Nếu có \`appendStr\`: kiểm tra nếu \`len + appendStr.length > alloc\` thì tăng \`alloc = (len + appendStr.length) * 2\`. Sau đó nối chuỗi, cập nhật \`len\` và trả về \`{ len, alloc, str }\`.',
        starterCode: `export function simulateSdsOperations(
  initialStr: string,
  appendStr?: string
): { len: number; alloc: number; str: string } {
  // TODO: Hiện thực quản trị SDS buffer
  return { len: 0, alloc: 0, str: '' };
}`,
        solution: `export function simulateSdsOperations(
  initialStr: string,
  appendStr?: string
): { len: number; alloc: number; str: string } {
  let len = initialStr.length;
  let alloc = initialStr.length * 2;
  let str = initialStr;

  if (appendStr !== undefined && appendStr.length > 0) {
    const requiredLen = len + appendStr.length;
    if (requiredLen > alloc) {
      alloc = requiredLen * 2;
    }
    str += appendStr;
    len = requiredLen;
  }

  return { len, alloc, str };
}`,
        testCases: [
          {
            name: 'Khởi tạo SDS với chuỗi ban đầu "hello"',
            input: ['hello'],
            expected: { len: 5, alloc: 10, str: 'hello' }
          },
          {
            name: 'Append chuỗi trong phạm vi alloc có sẵn ("hi" + "!")',
            input: ['hi', '!'],
            expected: { len: 3, alloc: 4, str: 'hi!' }
          },
          {
            name: 'Append chuỗi vượt quá alloc buộc phải mở rộng ("hi" + " world")',
            input: ['hi', ' world'],
            expected: { len: 8, alloc: 16, str: 'hi world' }
          },
          {
            name: 'Append chuỗi vào chuỗi khởi tạo rỗng ("" + "redis")',
            input: ['', 'redis'],
            expected: { len: 5, alloc: 10, str: 'redis' }
          },
          {
            name: 'Không truyền appendStr hoặc truyền chuỗi rỗng giữ nguyên kích thước',
            input: ['nestjs', ''],
            expected: { len: 6, alloc: 12, str: 'nestjs' }
          }
        ]
      }
    },
    {
      id: 'c7-l2',
      title: 'Bài 02: Chiến Lược Cache Phân Tán: Cache-Aside, Write-Through & Phòng Ngừa Cache Stampede / Penetration',
      duration: '60 phút',
      tag: 'Distributed Caching Strategies',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: CÁC MẪU HÌNH BỘ NHỚ ĐỆM PHÂN TÁN & CƠ CHẾ PHÒNG VỆ THẢM HỌA CACHE FAILURE (ARCHITECTURAL CONTEXT & CACHE RESILIENCE)

Trong kiến trúc Backend hiện đại, tầng In-Memory Cache (Redis) đóng vai trò lá chắn bảo vệ hệ cơ sở dữ liệu quan hệ (RDBMS) phía sau. Một thiết kế Cache cẩu thả không những không tăng tốc hệ thống mà còn có thể làm sập toàn bộ hạ tầng cơ sở dữ liệu khi xảy ra các thảm họa đồng thời:
* **Các Mẫu Hình Triển Khai Cache Phổ Biến:**
  - **Cache-Aside (Lazy Loading):** Ứng dụng đọc Cache trước. Nếu Cache Miss, ứng dụng truy vấn Database, sau đó nạp kết quả vào Cache và trả về cho Client. Đây là mô hình mặc định cho $90\\%$ hệ thống vì tính linh hoạt và khả năng phục hồi khi Cache bị sự cố (Fallback về DB).
  - **Write-Through:** Dữ liệu mới được ghi đồng thời vào Cache và Database trước khi trả về kết quả thành công. Đảm bảo tính nhất quán tuyệt đối giữa Cache và DB nhưng làm tăng độ trễ ghi (Write Latency).
  - **Write-Behind (Write-Back):** Ghi trực tiếp vào Cache và trả về thành công tức thì; một tiến trình nền gom nhóm các thay đổi và ghi bất đồng bộ xuống DB sau. Đạt thông lượng ghi tối đa nhưng tiềm ẩn nguy cơ mất dữ liệu nếu Redis sập nguồn trước khi xả đĩa.
* **3 Thảm Họa Độc Hại Khi Vận Hành Cache Trên Production:**
  - **1. Cache Stampede (Thundering Herd Problem):** Xảy ra khi một Hot Key có lưu lượng truy cập khổng lồ (ví dụ 50,000 req/s) bị hết hạn (TTL Expired) hoặc bị xóa. Trong cùng một tích tắc mili giây, 50,000 requests đồng loạt nhận kết quả Cache Miss và cùng lúc nện thẳng vào Database để tái tạo dữ liệu! Hồ bơi kết nối (Connection Pool) cạn kiệt, CPU của Database vọt lên $100\\%$ và sập nguồn tức khắc. Giải pháp: Áp dụng thuật toán **XFetch (Probabilistic Early Expiration)** hoặc sử dụng Mutex Lock / Singleflight để chỉ cho phép duy nhất 1 request đi vào DB, các request còn lại xếp hàng đợi.
  - **2. Cache Penetration (Xuyên Thủng Cache):** Kẻ tấn công cố tình quét các khóa không hề tồn tại trong cơ sở dữ liệu (ví dụ: \`id = -1\`, \`id = 9999999999\`). Vì dữ liệu không có trong DB nên cũng không bao giờ có trong Cache, khiến mọi request đều đâm xuyên qua lớp Cache và nện thẳng vào đĩa cứng Database! Giải pháp: Sử dụng **Bloom Filter** (cấu trúc dữ liệu xác suất trong RAM để kiểm tra phần tử có chắc chắn KHÔNG tồn tại hay không) hoặc chủ động Cache giá trị \`NULL\` kèm TTL ngắn (1-2 phút).
  - **3. Cache Avalanche (Lở Tuyết Cache):** Khi hàng triệu khóa Cache được nạp vào lúc khởi động hoặc được cấu hình cùng một thời gian hết hạn TTL (ví dụ: đúng 3600 giây). Đến đúng giây thứ 3600, toàn bộ hàng triệu khóa đồng loạt bốc hơi, dồn toàn bộ tải đọc của toàn bộ nền tảng xuống Database! Giải pháp: Bắt buộc cộng thêm một độ lệch ngẫu nhiên (**Jitter**): \`TTL = baseTTL + random(0, 300)\` để làm phẳng phân phối hết hạn của các khóa.

---

# 2. BA CHIẾN THẦN THIẾT KẾ BỘ NHỚ ĐỆM (CACHING PATTERNS)

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       3 MẪU HÌNH CACHE PHỔ BIẾN TRONG BACKEND               │
├─────────────────────┬───────────────────────────────────────────────────────┤
│ Mẫu Hình (Pattern)  │ Cơ Chế Hoạt Động & Dòng Dữ Liệu                       │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 1. Cache-Aside      │ Ứng dụng tự quản lý: Đọc Cache -> Miss -> Đọc DB ->   │
│    (Lazy Loading)   │ Ghi Cache. (Mặc định cho 90% ứng dụng).              │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Write-Through    │ Ứng dụng chỉ ghi vào Cache; Cache Provider tự động    │
│                     │ ghi đồng bộ xuống Database trước khi báo thành công.  │
├─────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Write-Behind     │ Ứng dụng ghi vào Cache và nhận thành công tức thì;    │
│    (Write-Back)     │ Cache gom nhóm và ghi ngầm bất đồng bộ xuống DB sau.  │
└─────────────────────┴───────────────────────────────────────────────────────┘
\`\`\`

---

# 3. BỘ BA NGUY HIỂM: PENETRATION, BREAKDOWN (STAMPEDE) & AVALANCHE

### 3.1 Cache Penetration (Thủng Lớp Đệm)
* **Hiện tượng:** Truy vấn các khóa hoàn toàn không tồn tại trong hệ thống (Hacker quét ID ngẫu nhiên).
* **Giải pháp 1 - Cache Null Object:** Nếu DB trả về \`null\`, lưu luôn giá trị \`"NULL"\` vào Redis với TTL ngắn (ví dụ: 60 giây).
* **Giải pháp 2 - Bloom Filter:** Đặt một mảng bit Bloom Filter ở trước Redis. Nếu Bloom Filter báo phần tử không tồn tại, từ chối ngay lập tức với xác suất chính xác $100\\%$!

### 3.2 Cache Breakdown / Stampede (Tê Liệt Khóa Hot-key)
* **Hiện tượng:** Một khóa cực kỳ "nóng" (ví dụ: Trang chủ Black Friday, Trang chi tiết iPhone 16) bị hết hạn (TTL Expired), hàng chục nghìn request cùng lúc tràn xuống DB để tính toán lại.
* **Giải pháp 1 - Mutex Lock (Khóa phân tán):** Request đầu tiên gặp Miss sẽ chiếm khóa Redis \`SET lock_key 1 NX EX 5\`. Chỉ DUY NHẤT một request này được quyền truy vấn Database để nạp lại Cache. Các request khác ngủ chờ vài chục ms rồi đọc lại Cache.
* **Giải pháp 2 - Logical Expiration:** Trong Cache lưu 2 trường: \`data\` và \`expireAt\`. Khi một request thấy \`Date.now() > expireAt\`, nó vẫn trả về dữ liệu cũ (Stale Data) cho khách hàng ngay lập tức, đồng thời đẩy một background job ngầm đi cập nhật dữ liệu mới!

### 3.3 Cache Avalanche (Tuyết Lở Toàn Hệ Thống)
* **Hiện tượng:** Hàng triệu khóa cùng được gán thời hạn TTL giống hệt nhau (ví dụ: cùng hết hạn sau đúng 3600 giây lúc 12:00 trưa). Toàn bộ Cache đồng loạt biến mất cùng một giây!
* **Giải pháp:** **Jitter Randomization!** Thêm một khoảng thời gian ngẫu nhiên vào TTL:
$$\\text{TTL} = \\text{Base TTL} + \\text{Random}(1, 300) \\text{ giây}$$

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Bộ Đệm Toàn Diện (Caching Architecture Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LỚP 1: BẢO VỆ PHÒNG NGỰ (BLOOM FILTER)             │
│  └── Chặn đứng 100% các ID không tồn tại trước khi chạm vào Cache          │
├─────────────────────────────────────────────────────────────────────────────┤
│                          LỚP 2: IN-MEMORY CACHE (REDIS CLUSTER)             │
│  ├── TTL với Jitter ngẫu nhiên (Chống Cache Avalanche tuyết lở)            │
│  └── Cache cả giá trị Rỗng có thời hạn ngắn (Chống Cache Penetration)       │
├─────────────────────────────────────────────────────────────────────────────┤
│                          LỚP 3: CƠ CHẾ MUTEX TÁI TẠO BỘ ĐỆM                 │
│  └── Khóa phân tán SETNX: Chỉ 1 tiến trình được xuống DB khi Cache Miss    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          LỚP 4: CƠ SỞ DỮ LIỆU GỐC (POSTGRESQL)              │
│  └── Được bảo vệ an toàn tuyệt đối, chịu tải ổn định                        │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Cache-Aside Có Khóa Mutex Chống Stampede (Mutex Cache Flow)
\`\`\`diagram
Request đến tìm kiếm dữ liệu Khóa K
   │
   ▼
Đọc Redis: Có dữ liệu không?
   ├── [ CACHE HIT ] ──► Trả về dữ liệu ngay trong 1ms!
   │
   └── [ CACHE MISS ]
          │
          ▼
       Thử chiếm khóa Mutex: SET lock:K 1 NX EX 10
          ├── [ CHIẾM KHÓA THẤT BÀI ]
          │      └──► Ngủ 50ms (Backoff) ──► Quay lại Đọc Redis từ đầu!
          │
          └── [ CHIẾM KHÓA THÀNH CÔNG ]
                 │
                 ├── 1. Truy vấn Cơ sở dữ liệu gốc (PostgreSQL)
                 ├── 2. Ghi kết quả vào Redis kèm TTL + Jitter
                 ├── 3. Giải phóng khóa: DEL lock:K
                 └── 4. Trả kết quả về cho người dùng
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Sự Cố Bộ Đệm (Cache Failure Decision Tree)
\`\`\`diagram
HỆ THỐNG GẶP SỰ CỐ VỀ CACHE?
│
├── Database bị nghẽn do hàng triệu ID lạ không tồn tại ập đến?
│   └──► BẬT: Bloom Filter và Cache Null Object (Chống Cache Penetration)
│
├── Database bị quá tải đúng vào thời điểm một Hot-key bị hết hạn?
│   └──► DÙNG: Khóa Mutex hoặc Cơ chế Hết hạn Logic (Logical Expiration)
│
└── Database bị sập định kỳ vào đúng một khung giờ cố định mỗi ngày?
    └──► Phát hiện Cache Avalanche! Thêm ngay: Math.random() vào TTL!
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược / Kỹ Thuật | Tính Nhất Quán Dữ Liệu | Khả Năng Bảo Vệ Database | Độ Phức Tạp Mã Nguồn | Độ Trễ Phản Hồi |
| :--- | :--- | :--- | :--- | :--- |
| **Cache-Aside Đơn Giản**| Eventual Consistency | Yếu trước các đợt Stampede| Cực kỳ đơn giản | Rất nhanh khi Hit, chậm khi Miss |
| **Mutex Lock Cache** | Rất cao | Tuyệt đối chống Stampede | Trung bình | Request sau phải đợi vài chục ms |
| **Logical Expiration** | Chấp nhận đọc dữ liệu cũ | Hoàn hảo ($0\\text{ ms}$ chờ đợi) | Cao (Cần background worker) | Nhanh $100\\%$ mọi thời điểm |
| **Write-Through** | Nhất quán mạnh mẽ | Rất tốt | Phức tạp ở tầng Storage | Chậm hơn khi ghi do phải cập nhật cả hai |
`,
      realCodeSnippet: `import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * ADR: Chiến lược Cache-Aside chuẩn Enterprise chống 3 thảm họa Cache
 * 1. Chống Cache Stampede: Dùng Mutex Lock (SET NX EX) để chỉ 1 request tái tạo dữ liệu
 * 2. Chống Cache Penetration: Cache Null Object với TTL ngắn (60s)
 * 3. Chống Cache Avalanche: Thêm Jitter ngẫu nhiên vào Base TTL
 */
@Injectable()
export class SafeCacheAsideService {
  private readonly logger = new Logger(SafeCacheAsideService.name);
  private readonly redis: Redis;
  private readonly NULL_SENTINEL = '__NULL_OBJECT__';

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
    });
  }

  public async getOrSetWithMutex<T>(
    key: string,
    fetchFromDb: () => Promise<T | null>,
    baseTtlSeconds: number = 3600,
    maxRetries: number = 3
  ): Promise<T | null> {
    // 1. Kiểm tra bộ nhớ đệm
    const cached = await this.redis.get(key);
    if (cached !== null) {
      if (cached === this.NULL_SENTINEL) {
        return null;
      }
      return JSON.parse(cached) as T;
    }

    // 2. Cache Miss: Cố gắng chiếm khóa Mutex độc quyền để truy vấn DB
    const lockKey = \`lock:\${key}\`;
    const acquiredLock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');

    if (!acquiredLock) {
      if (maxRetries <= 0) {
        // Fallback khẩn cấp: Truy vấn trực tiếp database nếu đã thử lại hết số lần
        this.logger.warn(\`Quá số lần retry lock cho key \${key}, truy vấn thẳng DB\`);
        return await fetchFromDb();
      }
      // Request khác đang tái tạo dữ liệu: Chờ 50ms với random jitter rồi thử lại
      const backoffMs = 40 + Math.floor(Math.random() * 20);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return this.getOrSetWithMutex(key, fetchFromDb, baseTtlSeconds, maxRetries - 1);
    }

    try {
      // 3. DUY NHẤT 1 request này được quyền chạm xuống Database
      const data = await fetchFromDb();

      // Jitter ngẫu nhiên chống Avalanche (phân tán 0 - 300s)
      const jitter = Math.floor(Math.random() * 300);
      const finalTtl = baseTtlSeconds + jitter;

      if (data === null) {
        // Chống Penetration: Cache Null Sentinel với TTL ngắn
        await this.redis.set(key, this.NULL_SENTINEL, 'EX', 60);
      } else {
        await this.redis.set(key, JSON.stringify(data), 'EX', finalTtl);
      }

      return data;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown Database Error';
      this.logger.error(\`Thất bại khi nạp dữ liệu từ DB cho key \${key}: \${message}\`);
      throw error;
    } finally {
      // 4. Giải phóng khóa Mutex an toàn
      await this.redis.del(lockKey);
    }
  }
}`,
      quiz: [
        {
          id: 'c7-l2-q1',
          question: 'Hiện tượng "Cache Stampede" (hay Thundering Herd) xảy ra trong bối cảnh nào và cơ chế kỹ thuật nào giúp ngăn chặn sập cơ sở dữ liệu?',
          options: [
            'Khi máy chủ Redis bị ngắt kết nối mạng Internet; khắc phục bằng cách thiết lập mạng riêng ảo VPN.',
            'Khi dữ liệu lưu trên Redis vượt quá kích thước 1GB; khắc phục bằng cách nâng cấp ổ cứng thể rắn SSD.',
            'Khi một Hot-Key có hàng chục nghìn lượt truy cập/giây bị hết hạn TTL; khắc phục bằng khóa Mutex (Singleflight) hoặc thuật toán XFetch (Early Expiration).',
            'Khi lập trình viên cấu hình nhầm cổng kết nối giữa NestJS và PostgreSQL thành cổng 3306.',
          ],
          correctIndex: 2,
          explanation: 'Cache Stampede xảy ra khi một Hot-key hết hạn. Hàng nghìn request đồng thời gặp Cache Miss và cùng lúc lao vào Database để truy vấn và tái tạo dữ liệu, làm cạn kiệt Connection Pool và sập DB. Giải pháp chuẩn là dùng Mutex Lock (chỉ 1 tiến trình được xuống DB, các request khác chờ) hoặc thuật toán xác suất XFetch tái tạo dữ liệu ngầm trước khi khóa hết hạn.'
        },
        {
          id: 'c7-l2-q2',
          question: 'Kẻ tấn công liên tục gửi các truy vấn với ID không hề tồn tại trong hệ thống (như id=-999999). Hiện tượng này được gọi là gì và cách phòng ngự tối ưu?',
          options: [
            'Cache Penetration (Xuyên thủng cache); phòng thủ bằng cách đặt Bloom Filter ở trước hoặc chủ động Cache giá trị NULL với TTL ngắn.',
            'SQL Injection; phòng thủ bằng cách mã hóa toàn bộ dữ liệu bảng users sang định dạng base64.',
            'Cache Avalanche; phòng thủ bằng cách giảm thời gian TTL của toàn bộ các khóa xuống còn 1 giây.',
            'Distributed Deadlock; phòng thủ bằng cách chạy lệnh KILL TRANSACTION trên cơ sở dữ liệu PostgreSQL.',
          ],
          correctIndex: 0,
          explanation: 'Cache Penetration là khi kẻ xấu truy vấn dữ liệu không hề có trong DB lẫn Cache. Vì không có dữ liệu, mọi request đều đâm xuyên qua Cache nện thẳng vào đĩa cứng Database. Cách phòng ngự: 1) Bloom Filter kiểm tra sự không tồn tại với độ chính xác 100%; 2) Cache Null Object: Lưu sentinel "__NULL__" vào Redis kèm TTL 60s để chặn các request tiếp theo.'
        },
        {
          id: 'c7-l2-q3',
          question: 'Kỹ thuật thêm "Jitter" (một số nguyên ngẫu nhiên) vào giá trị TTL khi ghi dữ liệu vào Cache giải quyết trực tiếp thảm họa nào?',
          options: [
            'Hiện tượng rò rỉ bộ nhớ Heap của tiến trình V8 trong môi trường Docker Container.',
            'Lỗi tràn số nguyên khi tính toán số dư tài khoản ngân hàng trong hệ thống tài chính.',
            'Nguy cơ xung đột địa chỉ IP giữa các Worker Pod trong cụm Kubernetes.',
            'Hiện tượng Cache Avalanche (Tuyết lở) do hàng loạt các khóa đồng loạt hết hạn tại cùng một thời điểm, dồn toàn bộ tải đọc vào Database.',
          ],
          correctIndex: 3,
          explanation: 'Nếu hàng trăm nghìn bản ghi được nạp cùng lúc với thời hạn TTL cố định (ví dụ 3600s), toàn bộ chúng sẽ cùng hết hạn tại giây thứ 3600. Tải đọc 100% lập tức đè sập Database (Cache Avalanche). Thêm Jitter: TTL = BaseTTL + Random(1, 300) giúp phân tán thời điểm hết hạn đều theo thời gian, xóa bỏ đỉnh nhọn truy vấn.'
        },
        {
          id: 'c7-l2-q4',
          question: 'Trong mô hình Write-Through Caching, luồng ghi dữ liệu diễn ra như thế nào so với mô hình Write-Behind (Write-Back)?',
          options: [
            'Write-Through không dùng đến RAM mà ghi trực tiếp vào ổ cứng quang học chuyên dụng.',
            'Write-Through ghi đồng bộ vào Cache và Database trước khi trả về thành công cho client, trong khi Write-Behind chỉ ghi vào Cache rồi ghi ngầm bất đồng bộ xuống DB sau.',
            'Write-Behind bắt buộc người dùng phải tải lại trình duyệt thì dữ liệu mới được đồng bộ.',
            'Write-Through chỉ áp dụng được cho cơ sở dữ liệu NoSQL như MongoDB và từ chối PostgreSQL.',
          ],
          correctIndex: 1,
          explanation: 'Write-Through đảm bảo tính nhất quán dữ liệu cao vì mọi thao tác ghi đều cập nhật đồng thời cả Cache và Database trước khi xác nhận thành công (đổi lại độ trễ ghi cao hơn). Write-Behind ghi vào Cache rồi báo thành công ngay lập tức, sau đó gom nhóm cập nhật xuống DB ngầm (đạt thông lượng ghi cực cao nhưng có rủi ro mất dữ liệu nếu Cache sập trước khi flush).'
        },
        {
          id: 'c7-l2-q5',
          question: 'Khi sử dụng chiến lược Cache-Aside, vì sao thứ tự thao tác chuẩn khi cập nhật dữ liệu là "Ghi vào Database trước rồi XÓA Khóa Cache sau (Update DB then Delete Cache)" thay vì Cập nhật Cache?',
          options: [
            'Vì lệnh xóa khóa trong Redis không tốn chi phí CPU so với lệnh ghi lại toàn bộ object.',
            'Vì việc cập nhật Cache trực tiếp có thể bị lỗi cú pháp JSON do NestJS không hỗ trợ serialize.',
            'Để tránh hiện tượng Dirty Read do Race Condition khi hai luồng ghi diễn ra xen kẽ; việc xóa khóa đảm bảo lần đọc tiếp theo luôn lấy dữ liệu mới nhất từ DB.',
            'Vì cơ sở dữ liệu PostgreSQL sẽ tự động khóa toàn bộ bảng nếu phát hiện Redis có dữ liệu mới.',
          ],
          correctIndex: 2,
          explanation: 'Nếu cập nhật Cache trực tiếp: Luồng 1 cập nhật DB -> Luồng 2 cập nhật DB -> Luồng 2 ghi Cache -> Luồng 1 ghi đè Cache (bị Race Condition khiến Cache chứa dữ liệu cũ của Luồng 1). Chuẩn mực là: Ghi DB trước, sau đó XÓA Cache. Việc xóa Cache biến request đọc tiếp theo thành Cache Miss và tái nạp dữ liệu chuẩn xác nhất từ DB.'
        },
        {
          id: 'c7-l2-q6',
          question: 'Chính sách giải phóng bộ nhớ (Eviction Policy) nào của Redis phù hợp nhất khi sử dụng Redis làm tầng Cache thuần túy và muốn loại bỏ các phần tử ít được sử dụng nhất?',
          options: [
            'allkeys-lru (Least Recently Used) hoặc allkeys-lfu (Least Frequently Used) để giải phóng các khóa ít dùng nhất trong toàn bộ Keyspace.',
            'noeviction để Redis ném lỗi OOM và từ chối toàn bộ các câu lệnh ghi khi bộ nhớ đầy.',
            'volatile-ttl để chỉ xóa những khóa sắp sửa hết hạn trong vòng 10 giây tiếp theo.',
            'random-key để xóa ngẫu nhiên bất kỳ một bảng dữ liệu nào của cơ sở dữ liệu PostgreSQL.',
          ],
          correctIndex: 0,
          explanation: 'Khi dùng Redis làm Cache chuyên dụng, maxmemory-policy nên đặt là allkeys-lru (xóa các khóa đã lâu không truy cập) hoặc allkeys-lfu (xóa các khóa có tần suất truy cập thấp nhất). Chính sách noeviction chỉ phù hợp khi dùng Redis làm Datastore chính không được phép mất dữ liệu.'
        },
        {
          id: 'c7-l2-q7',
          question: 'Đặc tính xác suất toán học cốt lõi của cấu trúc dữ liệu Bloom Filter là gì khi ứng dụng làm lá chắn chống Cache Penetration?',
          options: [
            'Có thể xảy ra False Negative (báo không có nhưng thực ra có) và không bao giờ xảy ra False Positive.',
            'Không bao giờ xảy ra sai số ở bất kỳ kịch bản nào, độ chính xác luôn là 100% tuyệt đối.',
            'Có thể xảy ra False Positive (báo có nhưng thực tế không có), nhưng KHÔNG BAO GIỜ xảy ra False Negative (nếu Bloom Filter báo không có thì chắc chắn 100% không có).',
            'Chỉ hỗ trợ kiểm tra các số nguyên chẵn và tự động trả về lỗi với chuỗi ký tự UTF-8.',
          ],
          correctIndex: 2,
          explanation: 'Đặc tính kinh điển của Bloom Filter: "False positive is possible, but false negative is impossible". Nghĩa là: Nếu Bloom Filter bảo một ID KHÔNG tồn tại, thì chắc chắn 100% nó không có trong DB (từ chối ngay lập tức, bảo vệ tuyệt đối DB). Nếu nó bảo có, thì có khả năng nhỏ là nó nhầm lẫn do hash collision (vẫn cho đi qua).'
        },
        {
          id: 'c7-l2-q8',
          question: 'Trong mô hình kiến trúc bộ nhớ đệm hai lớp (Multi-Level Cache: L1 In-Memory trong Node.js Heap, L2 Redis Cluster), thách thức lớn nhất là gì?',
          options: [
            'Node.js không thể chuyển đổi chuỗi JSON sang đối tượng JavaScript nếu không có thư viện bên thứ ba.',
            'Tính nhất quán của L1 Cache giữa nhiều Node.js Pod chạy song song; cần cơ chế vô hiệu hóa cache (như Redis Pub/Sub) để báo cho các Pod khác xóa L1 khi có cập nhật.',
            'Cụm Redis từ chối nhận các gói tin TCP truyền đến từ cùng một địa chỉ mạng VPC.',
            'Độ trễ của L1 Cache cao hơn rất nhiều so với việc truy vấn qua mạng tới Redis L2.',
          ],
          correctIndex: 1,
          explanation: 'L1 Cache nằm trong Heap memory của từng Pod Node.js (tốc độ nanoseconds). Khi Pod A cập nhật dữ liệu, L1 của Pod B và Pod C vẫn chứa dữ liệu cũ! Cần cơ chế Cache Invalidation đồng bộ: Khi Pod A sửa dữ liệu, nó publish một message qua Redis Pub/Sub để tất cả các Pod khác nhận được và xóa sạch L1 Cache tương ứng.'
        }
      ],
      codeChallenge: {
        id: 'c7-l2-c1',
        title: 'Bộ Sinh Khóa TTL Có Kèm Jitter Ngẫu Nhiên (TTL Jitter Generator)',
        description: 'Hiện thực hàm \`generateJitteredTtl(baseTtlSeconds: number, maxJitterSeconds: number, randomFn: () => number = Math.random): number\`. Hàm tính toán TTL bằng công thức: \`baseTtlSeconds + Math.floor(randomFn() * (maxJitterSeconds + 1))\`. Đảm bảo giá trị trả về luôn là số nguyên không âm. Nếu \`baseTtlSeconds <= 0\`, ném ra Error \`"INVALID_BASE_TTL"\`.',
        starterCode: `export function generateJitteredTtl(
  baseTtlSeconds: number,
  maxJitterSeconds: number,
  randomFn: () => number = Math.random
): number {
  // TODO: Hiện thực tính toán TTL kèm Jitter ngẫu nhiên
  return baseTtlSeconds;
}`,
        solution: `export function generateJitteredTtl(
  baseTtlSeconds: number,
  maxJitterSeconds: number,
  randomFn: () => number = Math.random
): number {
  if (baseTtlSeconds <= 0) {
    throw new Error('INVALID_BASE_TTL');
  }

  const safeJitterMax = Math.max(0, maxJitterSeconds);
  const jitter = Math.floor(randomFn() * (safeJitterMax + 1));
  return baseTtlSeconds + jitter;
}`,
        testCases: [
          {
            name: 'Tính toán TTL với random trả về 0.5 (Base 3600, Jitter Max 100)',
            input: [3600, 100, () => 0.5],
            expected: 3650
          },
          {
            name: 'Tính toán TTL với random trả về 0',
            input: [60, 30, () => 0],
            expected: 60
          },
          {
            name: 'Ném lỗi khi baseTtl không hợp lệ (<= 0)',
            input: [0, 50],
            expected: 'ERROR_THROWN'
          },
          {
            name: 'Tính toán TTL với random trả về 0.999 (Base 300, Jitter Max 50)',
            input: [300, 50, () => 0.999],
            expected: 350
          },
          {
            name: 'Xử lý an toàn khi maxJitterSeconds âm (< 0)',
            input: [120, -10, () => 0.75],
            expected: 120
          }
        ]
      }
    },
    {
      id: 'c7-l3',
      title: 'Bài 03: Redis Khóa Phân Tán (Distributed Locks): Redlock Algorithm, SetNX PX, Atomic Lua Scripting',
      duration: '60 phút',
      tag: 'Distributed Locks & Lua',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐỒNG THUẬN TÀI NGUYÊN PHÂN TÁN, NGUYÊN TẮC MUTUAL EXCLUSION VỚI REDIS & NGUY CƠ SPLIT-BRAIN (ARCHITECTURAL CONTEXT & DISTRIBUTED MUTEX)

Khi một hệ thống Backend được mở rộng theo chiều ngang (Horizontally Scaled) với hàng chục Pods chạy đồng thời trong Kubernetes, các cơ chế đồng bộ hóa bộ nhớ nội tại của Node.js (biến cờ, thư viện \`async-mutex\`) hoàn toàn mất tác dụng vì mỗi tiến trình sở hữu một vùng nhớ Heap cô lập:
* **Nhu cầu về Khóa Phân Tán (Distributed Locks):**
  - Cần bảo đảm tính **Loại Trừ Lẫn Nhau (Mutual Exclusion)** trên quy mô toàn cụm máy chủ: Tại một thời điểm, chỉ duy nhất một Worker được phép thực thi một tác vụ đặc quyền (ví dụ: chạy Cron Job kết toán số dư cuối ngày, xử lý trừ kho sản phẩm duy nhất còn lại, hoặc gọi đối tác thanh toán).
  - Vì Redis là một dịch vụ tập trung (Centralized In-Memory Datastore) có tính đơn luồng và độ trễ cực thấp, nó trở thành giải pháp tiêu chuẩn công nghiệp để hiện thực Distributed Lock.
* **Bài toán Sinh tử về Thời hạn Khóa (Lock TTL Expiration) & Cơ chế Tự Giải Phóng:**
  - Nếu một tiến trình chiếm được khóa nhưng sau đó bị sập nguồn đột ngột (Kernel Panic, OOM Killer) hoặc rơi vào trạng thái đóng băng kéo dài (V8 Garbage Collection Stop-The-World Pause): Nếu khóa không có thời gian tự hủy (TTL), toàn bộ hệ thống sẽ bị **Deadlock vĩnh viễn** vì không ai có thể chiếm được khóa nữa!
  - Do đó, khóa phân tán bắt buộc phải được gắn một giá trị thời gian sống hợp lý (ví dụ: \`PX 10000\` = 10 giây).
* **Hiểm họa Giải Phóng Khóa Nhầm Lẫn (Releasing Someone Else's Lock Disaster):**
  - Giả sử Worker A chiếm khóa với TTL 10 giây.
  - Do nghẽn mạng I/O hoặc GC Pause, tác vụ của Worker A kéo dài mất 15 giây.
  - Sau 10 giây, khóa của Worker A tự động hết hạn trên Redis.
  - Worker B nhảy vào chiếm khóa thành công và bắt đầu thực thi tác vụ.
  - Đúng lúc này, Worker A hoàn thành công việc và ngây thơ gọi lệnh \`DEL lock_key\`!
  - **Hậu quả thảm khốc:** Worker A đã vô tình **xóa mất khóa hợp lệ của Worker B**! Một Worker C thứ ba lập tức nhảy vào chiếm khóa, dẫn đến việc cả Worker B và Worker C cùng lúc thực thi tác vụ nhạy cảm, phá hủy hoàn toàn tính Mutual Exclusion!
  - **Giải pháp Bắt Buộc:** Mỗi Client khi chiếm khóa phải sinh ra một chuỗi ngẫu nhiên duy nhất (**UUID v4**) làm giá trị khóa (\`lockValue\`). Khi giải phóng, Client bắt buộc phải thực thi một đoạn **Lua Script nguyên tử**: Chỉ kiểm tra nếu giá trị trên Redis khớp chính xác với UUID của mình thì mới thực hiện lệnh \`DEL\`, bảo đảm an toàn phân tán tuyệt đối!

---

# 2. HIỆN THỰC KHÓA PHÂN TÁN AN TOÀN BẰNG LỆNH NGUYÊN TỬ SET NX PX

Để chiếm khóa an toàn trong Redis:
\`\`\`bash
SET resource_name my_random_value NX PX 30000
\`\`\`
* \`resource_name\`: Tên khóa đại diện cho tài nguyên cần bảo vệ (vd: \`lock:order:102\`).
* \`my_random_value\`: Một chuỗi ngẫu nhiên duy nhất (UUID v4) được sinh ra riêng cho mỗi request. **BẮT BUỘC PHẢI CÓ** để phân biệt chủ sở hữu khóa!
* \`NX\`: Chỉ gán nếu khóa chưa từng tồn tại (Set if Not eXists) - Đảm bảo tính loại trừ lẫn nhau (Mutual Exclusion).
* \`PX 30000\`: Hạn sử dụng tự động hủy sau 30,000 mili giây (30 giây) - Chống Deadlock khi server gặp sự cố.

---

# 3. GIẢI PHÓNG KHÓA NGUYÊN TỬ BẰNG LUA SCRIPT

Khi giải phóng khóa, tuyệt đối **KHÔNG ĐƯỢC PHÉP** gọi lệnh \`DEL lock_name\` một cách ngây thơ!
Bởi vì đại ca có thể vô tình xóa mất khóa của một tiến trình khác đã chiếm được sau khi khóa của đại ca bị quá hạn TTL.
Ta bắt buộc phải: **So sánh chuỗi ngẫu nhiên (UUID) xem có đúng là mình không, NẾU ĐÚNG thì mới được XÓA.**
Hai bước này phải được thực thi **Nguyên tử tuyệt đối (Atomic)** thông qua đoạn **Lua Script**:

\`\`\`lua
-- Lua script giải phóng khóa an toàn trong Redis
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
\`\`\`
* Vì Redis thực thi Lua Script trên một luồng duy nhất, không có bất kỳ lệnh nào khác có thể chen vào giữa lệnh \`GET\` và \`DEL\`. Đảm bảo an toàn phân tán $100\\%$!

---

# 4. THUẬT TOÁN REDLOCK TRÊN CỤM ĐA MÁY CHỦ (MULTI-NODE CLUSTER)

Nếu chỉ có 1 Redis Master: Khi Master sập ngay sau khi bạn chiếm khóa (dữ liệu chưa kịp replicate sang Replica), Replica lên làm Master mới và chưa có khóa đó, dẫn đến một tiến trình khác lại chiếm được khóa lần hai!
Để giải quyết bài toán này, tác giả của Redis (Antirez) đề xuất **Thuật toán Redlock**:
1. Triển khai $N$ máy chủ Redis Master hoàn toàn độc lập (thường $N = 5$).
2. Client cố gắng chiếm khóa trên tất cả 5 node với cùng một chuỗi UUID và một timeout nhỏ.
3. Nếu client chiếm được khóa thành công trên **đa số quá bán** (Majority: $\ge 3$ node trên 5 node), và tổng thời gian chiếm khóa nhỏ hơn thời gian sống (TTL), thì khóa được coi là **Hợp lệ và Thành công**!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Các Thành Phần Của Distributed Lock (Lock Architecture Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KIẾN TRÚC KHÓA PHÂN TÁN AN TOÀN                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. ĐỊNH DANH ĐỘC BẢN (Unique Ownership)                                     │
│    └── crypto.randomUUID() gắn chặt với từng lời gọi hàm                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. CHIẾM KHÓA NGUYÊN TỬ (Atomic Acquisition)                                │
│    └── Lệnh Redis chuẩn: SET key uuid NX PX <ttl_ms>                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. CƠ CHẾ GIA HẠN TỰ ĐỘNG (Watchdog Timer Extension)                        │
│    └── Tự động gia hạn thêm TTL nếu tác vụ nghiệp vụ chạy lâu chưa xong     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. GIẢI PHÓNG NGUYÊN TỬ (Atomic Release via Lua)                            │
│    └── if redis.get(key) == uuid then return redis.del(key) else return 0   │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Vòng Đời Chiếm & Giải Phóng Khóa (Distributed Lock Lifecycle)
\`\`\`diagram
[ Khởi tạo tác vụ cần bảo vệ ]
              │
              ├── 1. Sinh mã: const lockToken = randomUUID()
              │
              ├── 2. Chiếm khóa: SET lock:order:102 lockToken NX PX 5000
              │      ├── [ THẤT BÀI (Đã bị ai chiếm) ] ──► Chờ hoặc Báo bận
              │      └── [ THÀNH CÔNG ]
              │             │
              │             ▼
              ├── 3. Bật Timer Watchdog ngầm (Gia hạn TTL mỗi 2 giây)
              │             │
              │             ▼
              ├── 4. Thực thi logic thanh toán nhạy cảm (Stripe, DB)
              │             │
              │             ▼
              ├── 5. Dừng Timer Watchdog
              │             │
              │             ▼
              └── 6. Chạy Lua Script: So sánh lockToken & Xóa khóa!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Cơ Chế Khóa Phân Tán (Lock Decision Tree)
\`\`\`diagram
BẠN CẦN BẢO VỆ TÀI NGUYÊN ĐỒNG THỜI TRONG HỆ THỐNG PHÂN TÁN?
│
├── Toàn bộ hệ thống chạy chung trên một Database PostgreSQL duy nhất?
│   └──► DÙNG: PostgreSQL Advisory Locks (pg_advisory_xact_lock) - Không cần Redis!
│
├── Cần tốc độ cao, xử lý hàng chục nghìn lượt đặt vé/giây trên cụm Redis đơn?
│   └──► DÙNG: Redis SETNX PX + Lua Script (Thư viện: Redsync / ioredis)
│
└── Cần mức độ an toàn tuyệt đối chống sập node hạ tầng cho hệ thống ngân hàng?
    └──► DÙNG: Thuật toán Redlock trên cụm 5 Redis Nodes độc lập
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế Khóa | Tốc Độ Thực Thi | Mức Tiêu Tốn Tài Nguyên | Độ Tin Cậy Khi Sập Máy Chủ | Nguy Cơ Xóa Nhầm Khóa |
| :--- | :--- | :--- | :--- | :--- |
| **SETNX thông thường (không value)**| Cực nhanh | Thấp | Rất kém (Dễ dính Deadlock vĩnh viễn)| Rất cao |
| **SETNX PX + Lua Script** | ~1ms | Rất thấp | Tuyệt vời trên Single/Cluster Master| $0\\%$ (Nhờ UUID + Lua) |
| **Redlock (5 Nodes)** | ~5ms - 15ms | Cần duy trì 5 cụm Redis | Cao nhất trong các giải pháp NoSQL | $0\\%$ |
| **PostgreSQL Advisory Lock**| ~2ms - 5ms | Dùng chung Connection Pool| Tự động giải phóng khi đứt kết nối | $0\\%$ |
`,
      realCodeSnippet: `import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

/**
 * ADR: Khóa phân tán an toàn chuẩn Enterprise với Lua Scripting và Watchdog Heartbeat
 * - Bảo đảm Mutual Exclusion tuyệt đối giữa các Pods Kubernetes
 * - Chống xóa nhầm khóa của tiến trình khác bằng đối chiếu Token ngẫu nhiên (UUID v4)
 * - Tự động dọn dẹp Timer Watchdog khi tác vụ hoàn tất
 */
export interface LockHandle {
  lockKey: string;
  lockToken: string;
  leaseTimeMs: number;
}

@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: Redis;

  // Lua script chuẩn mực: Kiểm tra token trước khi xóa, thực thi nguyên tử trên 1 luồng Redis
  private readonly RELEASE_LOCK_LUA = \`
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  \`;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Bao bọc một hành động kinh doanh bằng Khóa Phân Tán chuẩn Enterprise
   */
  public async withDistributedLock<T>(
    resourceKey: string,
    ttlMs: number,
    action: (handle: LockHandle) => Promise<T>
  ): Promise<T> {
    const lockKey = \`distributed_lock:\${resourceKey}\`;
    const lockToken = crypto.randomUUID();

    // 1. Chiếm khóa nguyên tử với cờ NX (Not Exists) và PX (TTL tính theo mili giây)
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');

    if (!acquired) {
      throw new Error(
        \`Không thể chiếm khóa phân tán cho tài nguyên [\${resourceKey}]. Tác vụ đang được xử lý bởi tiến trình khác.\`
      );
    }

    const handle: LockHandle = { lockKey, lockToken, leaseTimeMs: ttlMs };

    try {
      // 2. Thực thi nghiệp vụ nhạy cảm
      return await action(handle);
    } finally {
      // 3. Giải phóng khóa an toàn bằng Lua Script
      try {
        const result = await this.redis.eval(this.RELEASE_LOCK_LUA, 1, lockKey, lockToken);
        if (result === 0) {
          this.logger.warn(\`Khóa [\${lockKey}] đã hết hạn hoặc bị tiến trình khác chiếm trước khi kịp giải phóng\`);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown Lua Error';
        this.logger.error(\`Lỗi khi giải phóng khóa phân tán: \${lockKey} - \${message}\`);
      }
    }
  }
}`,
      quiz: [
        {
          id: 'c7-l3-q1',
          question: 'Vì sao khi giải phóng một Distributed Lock trong Redis, việc sử dụng lệnh "DEL lock_key" đơn thuần lại bị coi là một lỗ hổng nguy hiểm chết người?',
          options: [
            'Vì nếu tác vụ chạy quá hạn TTL, khóa đã bị hết hạn và trao cho tiến trình khác; lệnh DEL lúc này sẽ xóa nhầm khóa của tiến trình mới đó.',
            'Vì lệnh DEL trong Redis chỉ có thể thực thi thành công nếu máy chủ cơ sở dữ liệu đang chạy ở chế độ đa luồng đồ họa.',
            'Vì lệnh DEL sẽ tự động kích hoạt tiến trình sao lưu toàn bộ RAM ra đĩa cứng làm tăng độ trễ mạng lên gấp hàng trăm lần.',
            'Vì giao thức mạng của Redis bắt buộc tất cả các thao tác xóa phải đi kèm với chữ ký số mật mã của tổ chức chứng thực SSL.',
          ],
          correctIndex: 0,
          explanation: 'Nếu một tiến trình A gặp sự cố (như GC pause, mạng lag) khiến thời gian chạy vượt quá thời hạn TTL của khóa, Redis sẽ tự động hủy khóa của A và cấp phát khóa cho tiến trình B. Khi tiến trình A tỉnh lại, nếu A gọi lệnh DEL mù quáng, A sẽ xóa mất chiếc khóa hoàn toàn hợp lệ mà tiến trình B đang nắm giữ, khiến các tiến trình C, D khác cùng nhảy vào và gây sai lệch dữ liệu nghiêm trọng.'
        },
        {
          id: 'c7-l3-q2',
          question: 'Vai trò cốt lõi của đoạn mã Lua Script trong việc giải phóng Khóa Phân Tán (Distributed Lock) trên Redis là gì?',
          options: [
            'Tự động tăng tốc độ đường truyền mạng giữa máy chủ ứng dụng NestJS và cụm máy chủ Redis lên mức tối đa.',
            'Cho phép giải mã các tệp tin nén nhị phân trực tiếp bên trong nhân hệ điều hành Linux của máy chủ đám mây.',
            'Bảo đảm việc kiểm tra giá trị token của khóa và hành động xóa khóa được diễn ra nguyên tử (atomic) trên cùng một luồng.',
            'Chuyển toàn bộ các biến cục bộ của mã nguồn TypeScript sang lưu trữ tại vùng nhớ không phân trang của CPU.',
          ],
          correctIndex: 2,
          explanation: 'Quy trình giải phóng an toàn gồm 2 bước: 1) Kiểm tra xem token đang lưu trong Redis có khớp với token của mình không (GET); 2) Nếu khớp thì mới xóa (DEL). Nếu viết 2 lệnh này riêng biệt từ phía client, một tiến trình khác có thể chen vào giữa 2 lệnh. Bằng cách đóng gói vào Lua Script, Redis đảm bảo cả 2 bước diễn ra nguyên tử (atomic) 100% không thể bị ngắt quãng.'
        },
        {
          id: 'c7-l3-q3',
          question: 'Trong thuật toán Redlock do tác giả Redis đề xuất, điều kiện tiên quyết nào để một client được coi là đã chiếm khóa thành công trên cụm 5 Redis Master độc lập?',
          options: [
            'Client phải kết nối thành công tới toàn bộ năm node thông qua giao thức truyền tin bảo mật tầng giao vận TLS 1.3.',
            'Client phải chiếm khóa thành công trên đa số quá bán (ít nhất 3 trên 5 node) và tổng thời gian chiếm khóa phải nhỏ hơn thời hạn TTL.',
            'Tất cả năm node máy chủ bắt buộc phải có cùng một địa chỉ IP vật lý và chạy chung một phiên bản hệ điều hành Linux.',
            'Client phải thực hiện xong toàn bộ các thao tác ghi dữ liệu vào cơ sở dữ liệu quan hệ PostgreSQL trước khi xin cấp khóa.',
          ],
          correctIndex: 1,
          explanation: 'Thuật toán Redlock yêu cầu client gửi yêu cầu chiếm khóa tới N node độc lập (ví dụ N = 5). Khóa chỉ được coi là thành công khi và chỉ khi: 1) Client chiếm được khóa trên đa số quá bán các node (ít nhất (N/2) + 1 = 3 node); 2) Tổng thời gian tiêu tốn để chiếm khóa trên các node phải nhỏ hơn rất nhiều so với thời hạn TTL của khóa (Validity Time).'
        },
        {
          id: 'c7-l3-q4',
          question: 'Cơ chế "Watchdog Timer" (Bộ hẹn giờ gia hạn khóa) trong các thư viện Khóa Phân Tán như Redisson giải quyết bài toán nào sau đây?',
          options: [
            'Tự động ngắt kết nối mạng của các client có hành vi gửi quá nhiều yêu cầu chiếm khóa trong một giây.',
            'Tự động xóa bỏ các bản ghi log nhật ký giao dịch cũ của Redis để giải phóng dung lượng đĩa cứng thể rắn.',
            'Chuyển đổi toàn bộ các khóa đang ở trạng thái bi quan sang trạng thái lạc quan khi hệ thống gặp lỗi phần cứng.',
            'Tự động gia hạn thời gian sống TTL của khóa định kỳ nếu nghiệp vụ đang xử lý tốn nhiều thời gian hơn dự kiến nhưng chưa hoàn tất.',
          ],
          correctIndex: 3,
          explanation: 'Nếu một tác vụ nghiệp vụ hợp lệ nhưng do xử lý dữ liệu phức tạp mà chạy lâu hơn thời hạn TTL ban đầu (ví dụ TTL 10s nhưng tác vụ cần 15s), nếu không có gì can thiệp thì khóa sẽ hết hạn giữa chừng và bị tiến trình khác cướp mất. Watchdog Timer chạy một vòng lặp ngầm: cứ sau một khoảng thời gian (ví dụ 1/3 TTL), nó lại tự động gửi lệnh gia hạn TTL cho Redis nếu tác vụ chính vẫn đang chạy.'
        },
        {
          id: 'c7-l3-q5',
          question: 'Trong bài tranh luận nổi tiếng giữa Martin Kleppmann và Salvatore Sanfilippo (Antirez), giải pháp nào được Kleppmann đề xuất để bảo vệ tài nguyên lưu trữ phía sau nếu khóa phân tán bị đứt quãng do Stop-the-world GC pause?',
          options: [
            'Tắt hoàn toàn cơ chế tự động dọn rác của máy ảo Java / V8 trong môi trường Production.',
            'Fencing Tokens: Một số nguyên tăng dần đơn điệu được cấp phát cùng với khóa, dịch vụ lưu trữ đích chỉ chấp nhận các thao tác có token lớn hơn token trước đó.',
            'Bắt buộc chạy Redis trên cùng một thanh ghi phần cứng với cơ sở dữ liệu quan hệ.',
            'Sử dụng thuật toán mã hóa bất đối xứng RSA 4096-bit để ký tên lên từng câu lệnh SQL.',
          ],
          correctIndex: 1,
          explanation: 'Martin Kleppmann chỉ ra rằng nếu một tiến trình dính GC pause kéo dài, khóa của nó sẽ hết hạn và tiến trình khác chiếm khóa. Khi tiến trình cũ tỉnh lại, nó có thể ghi đè dữ liệu rác. Giải pháp là Fencing Tokens: Mỗi lần cấp khóa, Redis sinh ra một số nguyên tăng dần (vd token 34, 35). Database đích sẽ từ chối bất kỳ gói ghi nào mang token <= token cao nhất đã ghi nhận.'
        },
        {
          id: 'c7-l3-q6',
          question: 'Tại sao mô hình Redis Sentinel với kiến trúc Master-Replica bất đồng bộ (Asynchronous Replication) không thể đảm bảo tính an toàn 100% cho Distributed Lock khi Master bị sập đột ngột?',
          options: [
            'Vì Replica được nâng cấp lên làm Master mới có thể chưa kịp nhận được khóa từ Master cũ trước khi sập (mất dữ liệu do độ trễ sao chép), dẫn đến client khác lại chiếm được khóa lần hai.',
            'Vì Redis Sentinel sẽ tự động xóa sạch toàn bộ các key có tiền tố "lock:" khi phát hiện máy chủ chính ngừng phản hồi ping.',
            'Vì các replica chỉ hỗ trợ các câu lệnh đọc và không cho phép client thực hiện câu lệnh giải phóng khóa.',
            'Vì các tiến trình ứng dụng Node.js sẽ tự động thoát với mã lỗi SIGSEGV khi mất kết nối tới Redis Master.',
          ],
          correctIndex: 0,
          explanation: 'Redis sao lưu sang Replica theo cơ chế bất đồng bộ (Asynchronous Replication) để giữ tốc độ. Nếu Client A chiếm khóa trên Master, nhưng trước khi Master kịp replicate sang Replica thì Master bị sập nguồn: Sentinel sẽ bầu Replica đó làm Master mới. Master mới này hoàn toàn không biết gì về khóa của Client A, do đó sẵn sàng cấp cùng khóa đó cho Client B, vi phạm tính Mutual Exclusion!'
        },
        {
          id: 'c7-l3-q7',
          question: 'Làm thế nào để hiện thực một Khóa Phân Tán Khả Tái Nhập (Reentrant Distributed Lock) trong Redis cho phép cùng một luồng có thể chiếm khóa nhiều lần mà không bị tự chặn chính mình?',
          options: [
            'Mỗi lần chiếm khóa thì tạo một key mới với tên gọi ngẫu nhiên và nối thêm số thứ tự vào đuôi.',
            'Bỏ qua bước kiểm tra TTL và đặt thời gian sống của khóa là vô hạn (-1).',
            'Chuyển sang sử dụng cơ chế WebSocket hai chiều giữa Redis Server và client NestJS.',
            'Sử dụng cấu trúc HASH: Lưu định danh Client ID làm trường (field) và số lần tái nhập làm giá trị (value), sử dụng lệnh HINCRBY để tăng/giảm số đếm nguyên tử qua Lua Script.',
          ],
          correctIndex: 3,
          explanation: 'Reentrant Lock cho phép cùng một tiến trình chiếm khóa nhiều lần lồng nhau. Để làm được điều này, Redis sử dụng cấu trúc Hash: Key là tên tài nguyên, Field là định danh Client (ví dụ PodID + ThreadID), Value là số lần tái nhập. Khi client đó xin khóa tiếp, Redis tăng giá trị value lên 1 (HINCRBY) và gia hạn TTL; khi giải phóng, giảm value đi 1, chỉ khi value = 0 thì mới xóa hẳn Key.'
        },
        {
          id: 'c7-l3-q8',
          question: 'Khi nào một kiến trúc sư hệ thống nên ưu tiên sử dụng PostgreSQL Advisory Locks thay vì triển khai Redis Distributed Locks?',
          options: [
            'Khi hệ thống cần xử lý hàng triệu phép toán khóa/giây với thông lượng cực cao.',
            'Khi toàn bộ dữ liệu nghiệp vụ nằm trong cùng 1 cơ sở dữ liệu PostgreSQL duy nhất, muốn tận dụng cơ chế tự động giải phóng khóa khi ngắt kết nối (Connection-bound) mà không cần duy trì hạ tầng Redis.',
            'Khi hệ thống không có quyền truy cập vào cổng mạng 5432 của PostgreSQL.',
            'Khi tất cả các dịch vụ microservices được viết bằng ngôn ngữ Golang và Python.',
          ],
          correctIndex: 1,
          explanation: 'PostgreSQL Advisory Locks (như pg_advisory_xact_lock) cung cấp khóa ở tầng ứng dụng do PostgreSQL quản lý. Ưu điểm lớn nhất là: Nếu hệ thống đã dùng Postgres và không có sẵn Redis, việc dùng Advisory Lock gắn chặt với Transaction/Session giúp khóa tự động giải phóng khi transaction kết thúc hoặc khi kết nối bị đứt, triệt tiêu 100% nguy cơ Deadlock do quên giải phóng khóa.'
        }
      ],
      codeChallenge: {
        id: 'c7-l3-c1',
        title: 'Bộ Thẩm Định Giải Phóng Khóa Phân Tán An Toàn (Safe Lock Release Evaluator)',
        description: 'Hiện thực hàm \`evaluateSafeRelease(currentStoredToken: string | null, callerToken: string): { canDelete: boolean; reason: string }\`. Nếu \`currentStoredToken === null\`, trả về \`{ canDelete: false, reason: "LOCK_EXPIRED" }\`. Nếu \`currentStoredToken !== callerToken\`, trả về \`{ canDelete: false, reason: "NOT_LOCK_OWNER" }\`. Nếu trùng khớp hoàn toàn, trả về \`{ canDelete: true, reason: "OK" }\`.',
        starterCode: `export function evaluateSafeRelease(
  currentStoredToken: string | null,
  callerToken: string
): { canDelete: boolean; reason: string } {
  // TODO: Hiện thực kiểm tra quyền giải phóng khóa phân tán
  return { canDelete: false, reason: '' };
}`,
        solution: `export function evaluateSafeRelease(
  currentStoredToken: string | null,
  callerToken: string
): { canDelete: boolean; reason: string } {
  if (currentStoredToken === null) {
    return { canDelete: false, reason: 'LOCK_EXPIRED' };
  }

  if (currentStoredToken !== callerToken) {
    return { canDelete: false, reason: 'NOT_LOCK_OWNER' };
  }

  return { canDelete: true, reason: 'OK' };
}`,
        testCases: [
          {
            name: 'Giải phóng hợp lệ khi đúng chủ sở hữu',
            input: ['token_abc_123', 'token_abc_123'],
            expected: { canDelete: true, reason: 'OK' }
          },
          {
            name: 'Từ chối giải phóng khi khóa đã hết hạn trên Redis',
            input: [null, 'my_token'],
            expected: { canDelete: false, reason: 'LOCK_EXPIRED' }
          },
          {
            name: 'Từ chối giải phóng khi token không khớp (đã bị người khác chiếm)',
            input: ['other_user_token', 'my_token'],
            expected: { canDelete: false, reason: 'NOT_LOCK_OWNER' }
          },
          {
            name: 'Xác thực thành công khi cả hai token rỗng trùng khớp',
            input: ['', ''],
            expected: { canDelete: true, reason: 'OK' }
          },
          {
            name: 'Từ chối khi caller truyền token rỗng nhưng trên Redis đang có token hợp lệ',
            input: ['valid_active_token', ''],
            expected: { canDelete: false, reason: 'NOT_LOCK_OWNER' }
          }
        ]
      }
    }
  ]
};
