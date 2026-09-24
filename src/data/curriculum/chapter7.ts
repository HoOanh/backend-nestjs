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
# 1. ẨN DỤ TRỰC QUAN: ĐẦU BẾP ĐẠI TÀI VS TỦ GIA VỊ XẾP NGĂN CHÍNH XÁC

Tại sao một máy chủ đơn luồng như Redis lại có thể đạt tốc độ hơn 100,000 phép tính mỗi giây (100k+ OPS)?
* **Đầu bếp đại tài duy nhất (Single-threaded Execution):** Hãy tưởng tượng một nhà hàng buffet cao cấp có một đầu bếp sushi có đôi tay nhanh như chớp. Thay vì thuê 10 đầu bếp vụng về tranh giành cùng một con dao, chen chúc nhau trong gian bếp chật hẹp (Context Switching & Lock Contention), nhà hàng chỉ để đúng một đầu bếp đứng bếp. Mọi thao tác cắt cá, nắm cơm diễn ra liên tục không có một giây chờ đợi nào ($0\\%$ Locking overhead)!
* **Hệ thống Order điện tử (I/O Multiplexing):** Người phục vụ không đứng đợi khách gọi món. Khi khách hàng nhấn chuông tại bàn (epoll event), đơn gọi món được in ra tức thì cạnh thớt của đầu bếp. Đầu bếp chỉ việc bốc đơn và làm trong vài microsecond!
* **Tủ gia vị tối ưu cấp C (Cấu trúc dữ liệu nội tại):** Redis không dùng chuỗi văn bản thông thường của C (\`char*\`). Nó phát minh ra **SDS (Simple Dynamic String)**: Tự lưu độ dài chuỗi vào phần header để tra cứu độ dài trong $O(1)$ thay vì phải đếm ký tự $O(N)$! Khi danh sách ít phần tử, nó gói gọn vào **ZipList** để tiết kiệm từng byte RAM; khi dữ liệu phình to, nó tự động biến hóa thành **SkipList** để tìm kiếm siêu tốc độ $O(\\log N)$!

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
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisDiagnosticsService {
  private readonly logger = new Logger(RedisDiagnosticsService.name);
  private readonly redisClient: Redis;

  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
    });
  }

  /**
   * Truy vấn thông số nội tại của Redis Engine: Bộ nhớ, Số lượng lệnh/giây, và Cấu trúc encoding
   */
  public async getEngineDiagnostics(testKey: string): Promise<{
    usedMemoryHuman: string;
    instantaneousOpsPerSec: number;
    keyEncoding: string;
  }> {
    await this.redisClient.connect();

    // 1. Đọc thông số thống kê hiệu năng từ lệnh INFO
    const memoryInfo = await this.redisClient.info('memory');
    const statsInfo = await this.redisClient.info('stats');

    const memoryMatch = memoryInfo.match(/used_memory_human:(.*)/);
    const opsMatch = statsInfo.match(/instantaneous_ops_per_sec:(.*)/);

    // 2. Kiểm tra kiểu mã hóa nội tại cấp thấp của một Key cụ thể
    const encoding = await this.redisClient.object('ENCODING', testKey);

    return {
      usedMemoryHuman: memoryMatch ? memoryMatch[1].trim() : 'N/A',
      instantaneousOpsPerSec: opsMatch ? parseInt(opsMatch[1].trim(), 10) : 0,
      keyEncoding: encoding || 'KEY_NOT_FOUND',
    };
  }
}
`,
      quiz: [
        {
          id: 'c7-l1-q1',
          question: 'Lý do cốt lõi nào giúp cho Redis đạt được hiệu năng xử lý hơn một trăm nghìn thao tác trên giây dù chỉ sử dụng duy nhất một luồng thực thi chính?',
          options: [
            'Dữ liệu nằm hoàn toàn trong RAM kết hợp với mô hình Non-blocking I/O Multiplexing và loại bỏ triệt để chi phí tranh chấp khóa.',
            'Redis tự động chuyển đổi mã nguồn C sang thực thi trên các vi xử lý đồ họa GPU chuyên dụng của máy chủ đám mây.',
            'Redis bắt buộc tất cả các client phải gửi các câu lệnh dưới dạng mã hóa nén trước khi truyền qua mạng Internet.',
            'Redis từ chối tất cả các câu lệnh có thời gian thực thi dài hơn một microsecond để tránh làm chậm hệ thống.',
          ],
          correctIndex: 0,
          explanation: 'Redis đạt tốc độ kinh ngạc nhờ: 1) Toàn bộ dữ liệu nằm trong RAM (truy xuất nanosecond); 2) Sử dụng I/O Multiplexing (epoll/kqueue) để quản lý hàng chục nghìn kết nối mạng trên 1 luồng mà không cần tạo thread; 3) Vì là đơn luồng nên không bao giờ phải chịu chi phí Context Switching hay chờ đợi tranh chấp khóa (Locking Contention).'
        },
        {
          id: 'c7-l1-q2',
          question: 'Cấu trúc chuỗi động Simple Dynamic String (SDS) của Redis mang lại ưu thế vượt trội nào so với chuỗi văn bản truyền thống trong ngôn ngữ C?',
          options: [
            'Lưu trữ sẵn độ dài chuỗi trong header giúp lấy độ dài trong O(1) và an toàn nhị phân cho phép lưu trữ bất kỳ loại dữ liệu byte nào.',
            'Tự động mã hóa dữ liệu thành chuỗi số nguyên hexa để chống lại các cuộc tấn công giải mã mật mã từ hacker.',
            'Loại bỏ hoàn toàn sự cần thiết của bộ nhớ đệm RAM và lưu trực tiếp chuỗi vào các thanh ghi của vi xử lý CPU.',
            'Giới hạn kích thước của chuỗi ở mức tối đa không quá tám ký tự để đảm bảo tốc độ so sánh chuỗi nhanh nhất.',
          ],
          correctIndex: 0,
          explanation: 'Chuỗi C truyền thống kết thúc bằng byte "\\0" nên không an toàn nhị phân (Binary Safe - không thể lưu dữ liệu có chứa byte 0 như ảnh hay gzip) và việc tính độ dài strlen() tốn O(N). SDS lưu sẵn thuộc tính len trong header giúp lấy độ dài trong O(1) tức thì, và kiểm tra vùng đệm alloc giúp chống tràn bộ nhớ (Buffer Overflow).'
        },
        {
          id: 'c7-l1-q3',
          question: 'Vì sao Redis lại lựa chọn cấu trúc dữ liệu SkipList để hiện thực kiểu dữ liệu Sorted Set (ZSET) thay vì sử dụng cây cân bằng Red-Black Tree?',
          options: [
            'SkipList có độ phức tạp tìm kiếm tương đương O(log N) nhưng cài đặt đơn giản hơn và hỗ trợ duyệt khoảng giá trị cực kỳ hiệu quả.',
            'Vì cây Red-Black Tree chỉ hoạt động được trên các hệ điều hành 32-bit cũ và không tương thích với máy chủ 64-bit.',
            'Vì SkipList có khả năng tự động nén dữ liệu xuống dung lượng bằng không khi không có người dùng nào truy cập vào khóa.',
            'Vì các thuật toán cây cân bằng bị cấm sử dụng trong các hệ thống phần mềm mã nguồn mở theo quy định của tổ chức GPL.',
          ],
          correctIndex: 0,
          explanation: 'SkipList mang lại hiệu năng tìm kiếm, chèn, xóa $O(\\log N)$ ngang ngửa với cây đỏ đen (Red-Black Tree), nhưng thuật toán đơn giản hơn rất nhiều khi không phải thực hiện các phép xoay cây (Tree Rotation) phức tạp. Đặc biệt, SkipList liên kết các phần tử ở tầng đáy giúp các thao tác duyệt khoảng (Range queries như ZRANGEBYSCORE) diễn ra siêu tốc bằng cách đi bộ tuần tự.'
        },
        {
          id: 'c7-l1-q4',
          question: 'Lệnh KEYS * bị coi là một "Lệnh Cấm Tử (Deadly Command)" trong môi trường Redis Production vì nguyên nhân kỹ thuật sâu xa nào?',
          options: [
            'Vì Redis chạy đơn luồng, lệnh KEYS * sẽ quét toàn bộ hàng triệu khóa trong bộ nhớ làm đóng băng máy chủ suốt nhiều giây hoặc nhiều phút.',
            'Vì lệnh này sẽ tự động xóa sạch toàn bộ các bản ghi trong cơ sở dữ liệu nếu có một kết nối mạng bị gián đoạn giữa chừng.',
            'Vì lệnh KEYS * chỉ có thể được thực thi bởi tài khoản quản trị viên root của hệ điều hành Linux thông qua cổng SSH.',
            'Vì nó làm thay đổi toàn bộ các con trỏ bộ nhớ của cấu trúc SDS khiến cho dữ liệu của người dùng bị đảo lộn thứ tự.',
          ],
          correctIndex: 0,
          explanation: 'Vì Redis thực thi các lệnh trên duy nhất MỘT Main Thread: Khi gọi KEYS *, Redis phải duyệt tuần tự qua toàn bộ hàng triệu khóa trong Keyspace. Suốt thời gian quét này (có thể mất vài giây đến vài phút), toàn bộ các request khác từ tất cả client đều bị chặn đứng và timeout hoàn toàn, làm sập toàn bộ hệ thống! Trong Production, bắt buộc phải dùng SCAN (quét theo con trỏ cursor không chặn luồng).'
        }
      ],
      codeChallenge: {
        id: 'c7-l1-c1',
        title: 'Mô Phỏng Cấu Trúc SDS String Buffer Tracker',
        description: 'Hiện thực hàm \`simulateSdsOperations(initialStr: string, appendStr?: string): { len: number; alloc: number; str: string }\`. Khởi tạo SDS với \`len = initialStr.length\` và \`alloc = initialStr.length * 2\`. Nếu có \`appendStr\`: kiểm tra nếu \`len + appendStr.length > alloc\` thì tăng \`alloc = (len + appendStr.length) * 2\`. Sau đó nối chuỗi, cập nhật \`len\` và trả về \`{ len, alloc, str }\`.',
        starterCode: `
export function simulateSdsOperations(
  initialStr: string,
  appendStr?: string
): { len: number; alloc: number; str: string } {
  // TODO: Hiện thực quản trị SDS buffer
  return { len: 0, alloc: 0, str: '' };
}
`,
        solution: `
export function simulateSdsOperations(
  initialStr: string,
  appendStr?: string
): { len: number; alloc: number; str: string } {
  let len = initialStr.length;
  let alloc = initialStr.length * 2;
  let str = initialStr;

  if (appendStr) {
    const requiredLen = len + appendStr.length;
    if (requiredLen > alloc) {
      alloc = requiredLen * 2;
    }
    str += appendStr;
    len = requiredLen;
  }

  return { len, alloc, str };
}
`,
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
# 1. ẨN DỤ TRỰC QUAN: CHIẾC TỦ LẠNH GIA ĐÌNH VS CƠN ĐỘT QUỴ CỦA SIÊU THỊ

Tại sao việc dùng Cache không cẩn thận lại có thể giết chết Database nhanh hơn cả khi không dùng Cache?
* **Chiến lược Cache-Aside (Chiếc tủ lạnh gia đình):** Bạn muốn uống nước ngọt (Dữ liệu). Bạn mở tủ lạnh ra xem trước (Check Cache). Nếu có sẵn (Cache Hit), bạn lấy uống ngay trong 2 giây. Nếu tủ lạnh rỗng (Cache Miss), bạn phải đi bộ ra siêu thị cách nhà 1km mua nước về (Query Database), sau đó cất một chai mới vào tủ lạnh để lần sau uống tiếp (Populate Cache).
* **Thảm họa Cache Stampede (Cơn lốc siêu thị lúc nửa đêm):** Trận chung kết bóng đá thế giới diễn ra, 100,000 người cùng đang xem truyền hình trực tiếp. Chiếc tủ lạnh (Cache) chứa thông tin tỉ số trận đấu vừa hết hạn đúng giây thứ 90. Trong cùng một tích tắc, **toàn bộ 100,000 người cùng phát hiện tủ lạnh rỗng và cùng lúc tràn ra siêu thị (100k queries ập thẳng vào Database)!** Database bị nghẽn thở, sập nguồn và chết đứng tức thì!
* **Thảm họa Cache Penetration (Kẻ trộm tìm đồ không có thực):** Hacker cố tình gửi hàng triệu request tìm kiếm các sản phẩm có ID âm hoặc ID quái dị (\`id = -99999\`). Trong Cache chắc chắn không có. Toàn bộ các request này xuyên thủng qua lớp Cache và nện thẳng vào Database, khiến máy chủ cơ sở dữ liệu bị quá tải (Denial of Service)!

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
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class SafeCacheAsideService {
  private readonly logger = new Logger(SafeCacheAsideService.name);
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis();
  }

  /**
   * Kỹ thuật Cache-Aside chuẩn Senior: Có khóa Mutex chống Stampede
   * và có Jitter ngẫu nhiên chống Tuyết lở Avalanche
   */
  public async getOrSetWithMutex<T>(
    key: string,
    fetchFromDb: () => Promise<T | null>,
    baseTtlSeconds: number = 3600
  ): Promise<T | null> {
    // 1. Thử đọc từ Cache
    const cached = await this.redis.get(key);
    if (cached !== null) {
      if (cached === '__NULL_OBJECT__') return null;
      return JSON.parse(cached) as T;
    }

    // 2. Cache Miss: Cố gắng chiếm khóa Mutex độc quyền để truy vấn DB
    const lockKey = \`lock:\${key}\`;
    const acquiredLock = await this.redis.set(lockKey, '1', 'EX', 10, 'NX');

    if (!acquiredLock) {
      // Có request khác đang nạp dữ liệu: Ngủ 50ms rồi thử lại
      await new Promise((r) => setTimeout(r, 50));
      return this.getOrSetWithMutex(key, fetchFromDb, baseTtlSeconds);
    }

    try {
      // 3. DUY NHẤT 1 request này được quyền truy vấn Database
      const data = await fetchFromDb();

      // Thêm Jitter ngẫu nhiên từ 1 đến 300 giây vào TTL chống Avalanche
      const jitter = Math.floor(Math.random() * 300);
      const finalTtl = baseTtlSeconds + jitter;

      if (data === null) {
        // Chống Cache Penetration: Cache cả giá trị NULL trong 60s
        await this.redis.set(key, '__NULL_OBJECT__', 'EX', 60);
      } else {
        await this.redis.set(key, JSON.stringify(data), 'EX', finalTtl);
      }

      return data;
    } finally {
      // 4. Luôn giải phóng khóa Mutex
      await this.redis.del(lockKey);
    }
  }
}
`,
      quiz: [
        {
          id: 'c7-l2-q1',
          question: 'Hiện tượng "Cache Stampede" (hay Cache Breakdown) là gì và phương pháp kỹ thuật nào sau đây giải quyết triệt để vấn đề này?',
          options: [
            'Khi một khóa dữ liệu truy cập cao bị hết hạn khiến hàng loạt request cùng ập vào database; giải quyết bằng khóa Mutex hoặc Logical Expiration.',
            'Khi máy chủ Redis bị mất điện khiến toàn bộ dữ liệu trên thanh RAM bị biến mất; giải quyết bằng cách mua bộ lưu điện dự phòng.',
            'Khi các client liên tục gửi các chuỗi ký tự ngẫu nhiên vào ô tìm kiếm; giải quyết bằng cách chặn địa chỉ IP của người dùng.',
            'Khi số lượng bản ghi trong cơ sở dữ liệu vượt quá một triệu dòng; giải quyết bằng cách xóa bớt các bảng dữ liệu cũ.',
          ],
          correctIndex: 0,
          explanation: 'Cache Stampede xảy ra khi một Hot-key (khóa có lưu lượng đọc khổng lồ) hết hạn. Hàng nghìn request đồng thời gặp Cache Miss và cùng lúc lao vào Database để truy vấn và tính toán lại, gây sập cơ sở dữ liệu. Giải pháp triệt để là dùng Mutex Lock (chỉ cho phép 1 request đi vào DB nạp lại cache, các request khác chờ) hoặc dùng Logical Expiration (trả dữ liệu cũ và nạp ngầm).'
        },
        {
          id: 'c7-l2-q2',
          question: 'Hiện tượng "Cache Penetration" (Thủng lớp đệm) xảy ra do nguyên nhân nào và làm thế nào để ngăn chặn hiệu quả nhất?',
          options: [
            'Xảy ra khi client liên tục truy vấn các ID không hề tồn tại trong hệ thống; ngăn chặn bằng cách dùng Bloom Filter hoặc Cache giá trị rỗng (Null Object).',
            'Xảy ra khi tin tặc tìm ra mật khẩu kết nối của cổng Redis; ngăn chặn bằng cách đổi mật khẩu sang một chuỗi có độ dài ba mươi ký tự.',
            'Xảy ra khi ổ đĩa cứng của máy chủ cơ sở dữ liệu bị hỏng các cung từ vật lý; ngăn chặn bằng cách chuyển sang sử dụng ổ đĩa thể rắn.',
            'Xảy ra khi các lập trình viên quên không gọi lệnh đóng kết nối mạng sau mỗi lần thực hiện câu lệnh truy vấn dữ liệu.',
          ],
          correctIndex: 0,
          explanation: 'Cache Penetration là hiện tượng kẻ xấu cố tình truy vấn các khóa không hề tồn tại (ví dụ ID âm hoặc chuỗi ngẫu nhiên). Vì trong Cache không có và trong Database cũng không có, request luôn xuyên thủng lớp Cache và nện thẳng vào Database. Cách ngăn chặn chuẩn là đặt Bloom Filter ở trước, hoặc nếu DB trả về null thì lưu luôn giá trị NULL vào Cache với TTL ngắn để chặn các request tiếp theo.'
        },
        {
          id: 'c7-l2-q3',
          question: 'Kỹ thuật thêm "Jitter" (một khoảng thời gian ngẫu nhiên) vào thời gian sống TTL của các khóa trong Redis nhằm mục đích bảo vệ hệ thống khỏi thảm họa nào?',
          options: [
            'Chống lại hiện tượng Cache Avalanche (Tuyết lở) do hàng loạt các khóa cùng hết hạn tại đúng một thời điểm làm tê liệt Database.',
            'Chống lại hiện tượng rò rỉ bộ nhớ RAM của các tiến trình Node.js khi chạy các tác vụ tính toán thuật toán nặng.',
            'Chống lại việc các câu lệnh SQL bị tấn công tiêm mã độc thông qua các trường nhập liệu của biểu mẫu trên trang web.',
            'Tự động tăng gấp đôi dung lượng bộ nhớ chia sẻ của hệ điều hành Linux trong các đợt khuyến mãi bán hàng lớn.',
          ],
          correctIndex: 0,
          explanation: 'Cache Avalanche (Tuyết lở) xảy ra khi một lượng lớn các khóa trong Cache được thiết lập cùng một thời gian TTL (ví dụ cùng hết hạn sau 1 tiếng). Khi thời điểm đó đến, hàng trăm nghìn khóa đồng loạt bốc hơi cùng một giây, biến toàn bộ hệ thống từ Cache Hit thành Cache Miss 100%, đè bẹp Database. Thêm Jitter (TTL = Base + Random) giúp phân tán thời điểm hết hạn rải rác, tránh hiện tượng tuyết lở.'
        },
        {
          id: 'c7-l2-q4',
          question: 'Điểm khác biệt cốt lõi giữa hai chiến lược ghi dữ liệu Write-Through và Write-Behind (Write-Back) là gì?',
          options: [
            'Write-Through ghi đồng bộ vào cả Cache và Database trước khi báo thành công, còn Write-Behind chỉ ghi vào Cache rồi ghi ngầm bất đồng bộ xuống DB sau.',
            'Write-Through chỉ lưu trữ dữ liệu dưới dạng các con số nguyên, còn Write-Behind hỗ trợ lưu trữ toàn bộ các tệp tin đa phương tiện lớn.',
            'Write-Behind bắt buộc phải sử dụng các máy chủ đám mây chuyên dụng, trong khi Write-Through có thể chạy trên mọi máy tính cá nhân.',
            'Cả hai chiến lược này đều ghi trực tiếp vào đĩa cứng và hoàn toàn không sử dụng đến bộ nhớ đệm RAM của máy chủ Redis.',
          ],
          correctIndex: 0,
          explanation: 'Với Write-Through, ứng dụng cập nhật vào Cache và hệ thống Cache đảm bảo ghi đồng bộ xuống Database ngay lập tức rồi mới trả về thành công (đảm bảo tính nhất quán cao, nhưng độ trễ ghi lâu). Ngược lại, Write-Behind ghi vào Cache rồi trả về thành công ngay lập tức; sau đó một tiến trình nền gom các thay đổi và ghi bất đồng bộ (batch update) xuống DB sau (tốc độ ghi cực nhanh nhưng có rủi ro mất dữ liệu nếu Cache sập trước khi kịp flush).'
        }
      ],
      codeChallenge: {
        id: 'c7-l2-c1',
        title: 'Bộ Sinh Khóa TTL Có Kèm Jitter Ngẫu Nhiên (TTL Jitter Generator)',
        description: 'Hiện thực hàm \`generateJitteredTtl(baseTtlSeconds: number, maxJitterSeconds: number, randomFn: () => number = Math.random): number\`. Hàm tính toán TTL bằng công thức: \`baseTtlSeconds + Math.floor(randomFn() * (maxJitterSeconds + 1))\`. Đảm bảo giá trị trả về luôn là số nguyên không âm. Nếu \`baseTtlSeconds <= 0\`, ném ra Error \`"INVALID_BASE_TTL"\`.',
        starterCode: `
export function generateJitteredTtl(
  baseTtlSeconds: number,
  maxJitterSeconds: number,
  randomFn: () => number = Math.random
): number {
  // TODO: Hiện thực tính toán TTL kèm Jitter ngẫu nhiên
  return baseTtlSeconds;
}
`,
        solution: `
export function generateJitteredTtl(
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
}
`,
        testCases: [
          {
            name: 'Tính toán TTL với random trả về 0.5 (Base 3600, Jitter Max 100)',
            input: [3600, 100, () => 0.5],
            expected: 3600 + Math.floor(0.5 * 101) // 3650
          },
          {
            name: 'Tính toán TTL với random trả về 0',
            input: [60, 30, () => 0],
            expected: 60
          },
          {
            name: 'Ném lỗi khi baseTtl không hợp lệ (<= 0)',
            input: [0, 50],
            expected: 'THREW_ERROR'
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
# 1. ẨN DỤ TRỰC QUAN: CHIẾC VƯƠNG MIỆNG HOÀNG GIA DUY NHẤT VS MÁY CHÉM THỜI GIAN

Khi một hệ sinh thái Backend có 50 máy chủ Pods cùng chạy song song trong Kubernetes, các cơ chế khóa trong bộ nhớ của Node.js (\`Mutex\`, biến cờ) hoàn toàn vô dụng:
* **Chiếc vương miện hoàng gia duy nhất (Distributed Lock):** Cả vương quốc chỉ có duy nhất một chiếc vương miện. Ai đội chiếc vương miện lên đầu (\`SET lock_key uuid NX PX 10000\`) thì người đó là vua, có toàn quyền ra lệnh (Thực thi Cron Job, Trừ kho hàng, Phân bổ mã giảm giá). Bất kỳ ai khác muốn lên ngôi đều phải đợi nhà vua thoái vị.
* **Máy chém thời gian (TTL Lock Expiration):** Điều gì xảy ra nếu vị vua vừa đội vương miện xong thì bị đột quỵ (Server sập nguồn hoặc V8 Garbage Collector Pause)? Nếu không có cơ chế tự động thoái vị, cả vương quốc sẽ không bao giờ có vua mới (Hệ thống bị khóa chết mãi mãi)! Do đó, vương miện có gắn một quả bom hẹn giờ: Sau đúng 10 giây (TTL), chiếc vương miện tự động rụng khỏi đầu để người khác nhặt lấy.
* **Tai họa thoái vị nhầm (Releasing Someone Else's Lock):** Vị vua A làm việc quá chậm (bị mạng lag 15 giây). Quả bom nổ, chiếc vương miện rơi xuống, Vị vua B bước lên nhặt lấy đội vào đầu. Đúng lúc này, Vị vua A tỉnh lại, tưởng mình vẫn là vua, liền rút kiếm chém đứt vương miện của Vị vua B (\`DEL lock_key\`)! Kết quả: Hai vị vua cùng lúc điều hành vương quốc, gây ra thảm họa dữ liệu phân tán!

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
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redis: Redis;

  // Lua script chuẩn mực để giải phóng khóa phân tán có đối chiếu token
  private readonly RELEASE_LOCK_LUA = \`
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  \`;

  constructor() {
    this.redis = new Redis();
  }

  /**
   * Bao bọc một hành động kinh doanh bằng Khóa Phân Tán chuẩn Enterprise
   */
  public async withDistributedLock<T>(
    resourceKey: string,
    ttlMs: number,
    action: () => Promise<T>
  ): Promise<T> {
    const lockKey = \`distributed_lock:\${resourceKey}\`;
    const lockToken = crypto.randomUUID();

    // 1. Chiếm khóa nguyên tử với cờ NX và thời gian sống PX
    const acquired = await this.redis.set(lockKey, lockToken, 'PX', ttlMs, 'NX');

    if (!acquired) {
      throw new Error(
        \`Không thể chiếm khóa phân tán cho tài nguyên [\${resourceKey}]. Tác vụ đang được xử lý bởi tiến trình khác.\`
      );
    }

    try {
      // 2. Thực thi nghiệp vụ nhạy cảm
      return await action();
    } finally {
      // 3. Giải phóng khóa an toàn bằng Lua Script: Tuyệt đối không xóa nhầm của người khác
      try {
        await this.redis.eval(this.RELEASE_LOCK_LUA, 1, lockKey, lockToken);
      } catch (err) {
        this.logger.error(\`Lỗi khi giải phóng khóa phân tán: \${lockKey}\`, err);
      }
    }
  }
}
`,
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
            'Bảo đảm việc kiểm tra giá trị token của khóa và hành động xóa khóa được diễn ra nguyên tử (atomic) trên cùng một luồng.',
            'Tự động tăng tốc độ đường truyền mạng giữa máy chủ ứng dụng NestJS và cụm máy chủ Redis lên mức tối đa.',
            'Cho phép giải mã các tệp tin nén nhị phân trực tiếp bên trong nhân hệ điều hành Linux của máy chủ đám mây.',
            'Chuyển toàn bộ các biến cục bộ của mã nguồn TypeScript sang lưu trữ tại vùng nhớ không phân trang của CPU.',
          ],
          correctIndex: 0,
          explanation: 'Quy trình giải phóng an toàn gồm 2 bước: 1) Kiểm tra xem token đang lưu trong Redis có khớp với token của mình không (GET); 2) Nếu khớp thì mới xóa (DEL). Nếu viết 2 lệnh này riêng biệt từ phía client, một tiến trình khác có thể chen vào giữa 2 lệnh. Bằng cách đóng gói vào Lua Script, Redis đảm bảo cả 2 bước diễn ra nguyên tử (atomic) 100% không thể bị ngắt quãng.'
        },
        {
          id: 'c7-l3-q3',
          question: 'Trong thuật toán Redlock do tác giả Redis đề xuất, điều kiện tiên quyết nào để một client được coi là đã chiếm khóa thành công trên cụm 5 Redis Master độc lập?',
          options: [
            'Client phải chiếm khóa thành công trên đa số quá bán (ít nhất 3 trên 5 node) và tổng thời gian chiếm khóa phải nhỏ hơn thời hạn TTL.',
            'Client phải kết nối thành công tới toàn bộ năm node thông qua giao thức truyền tin bảo mật tầng giao vận TLS 1.3.',
            'Tất cả năm node máy chủ bắt buộc phải có cùng một địa chỉ IP vật lý và chạy chung một phiên bản hệ điều hành Linux.',
            'Client phải thực hiện xong toàn bộ các thao tác ghi dữ liệu vào cơ sở dữ liệu quan hệ PostgreSQL trước khi xin cấp khóa.',
          ],
          correctIndex: 0,
          explanation: 'Thuật toán Redlock yêu cầu client gửi yêu cầu chiếm khóa tới N node độc lập (ví dụ N = 5). Khóa chỉ được coi là thành công khi và chỉ khi: 1) Client chiếm được khóa trên đa số quá bán các node (ít nhất (N/2) + 1 = 3 node); 2) Tổng thời gian tiêu tốn để chiếm khóa trên các node phải nhỏ hơn rất nhiều so với thời hạn TTL của khóa (Validity Time).'
        },
        {
          id: 'c7-l3-q4',
          question: 'Cơ chế "Watchdog Timer" (Bộ hẹn giờ gia hạn khóa) trong các thư viện Khóa Phân Tán như Redisson giải quyết bài toán nào sau đây?',
          options: [
            'Tự động gia hạn thời gian sống TTL của khóa định kỳ nếu nghiệp vụ đang xử lý tốn nhiều thời gian hơn dự kiến nhưng chưa hoàn tất.',
            'Tự động ngắt kết nối mạng của các client có hành vi gửi quá nhiều yêu cầu chiếm khóa trong một giây.',
            'Tự động xóa bỏ các bản ghi log nhật ký giao dịch cũ của Redis để giải phóng dung lượng đĩa cứng thể rắn.',
            'Chuyển đổi toàn bộ các khóa đang ở trạng thái bi quan sang trạng thái lạc quan khi hệ thống gặp lỗi phần cứng.',
          ],
          correctIndex: 0,
          explanation: 'Nếu một tác vụ nghiệp vụ hợp lệ nhưng do xử lý dữ liệu phức tạp mà chạy lâu hơn thời hạn TTL ban đầu (ví dụ TTL 10s nhưng tác vụ cần 15s), nếu không có gì can thiệp thì khóa sẽ hết hạn giữa chừng và bị tiến trình khác cướp mất. Watchdog Timer chạy một vòng lặp ngầm: cứ sau một khoảng thời gian (ví dụ 1/3 TTL), nó lại tự động gửi lệnh gia hạn TTL cho Redis nếu tác vụ chính vẫn đang chạy.'
        }
      ],
      codeChallenge: {
        id: 'c7-l3-c1',
        title: 'Bộ Thẩm Định Giải Phóng Khóa Phân Tán An Toàn (Safe Lock Release Evaluator)',
        description: 'Hiện thực hàm \`evaluateSafeRelease(currentStoredToken: string | null, callerToken: string): { canDelete: boolean; reason: string }\`. Nếu \`currentStoredToken === null\`, trả về \`{ canDelete: false, reason: "LOCK_EXPIRED" }\`. Nếu \`currentStoredToken !== callerToken\`, trả về \`{ canDelete: false, reason: "NOT_LOCK_OWNER" }\`. Nếu trùng khớp hoàn toàn, trả về \`{ canDelete: true, reason: "OK" }\`.',
        starterCode: `
export function evaluateSafeRelease(
  currentStoredToken: string | null,
  callerToken: string
): { canDelete: boolean; reason: string } {
  // TODO: Hiện thực kiểm tra quyền giải phóng khóa phân tán
  return { canDelete: false, reason: '' };
}
`,
        solution: `
export function evaluateSafeRelease(
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
}
`,
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
          }
        ]
      }
    }
  ]
};
