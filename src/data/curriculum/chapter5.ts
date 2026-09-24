import type { Sprint } from './types.ts';

export const chapter5: Sprint = {
  sprintId: 5,
  sprintTitle: 'Chương 5: Cơ Sở Dữ Liệu Quan Hệ: PostgreSQL Engine, B-Tree Internals & Query Optimizer',
  sprintDesc: 'Khám phá trái tim lưu trữ dữ liệu: Cấu trúc 8KB Page, WAL & Checkpoints, Cơ chế vận hành B-Tree Index, Page Splits và Kỹ thuật đọc EXPLAIN (ANALYZE, BUFFERS)',
  lessons: [
    {
      id: 'c5-l1',
      title: 'Bài 01: PostgreSQL Storage Engine: 8KB Pages, Heap Tuples, Write-Ahead Logging (WAL) & Checkpoints',
      duration: '60 phút',
      tag: 'Database Storage Internals',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: CUỐN SỔ TAY KẾ TOÁN GHI NỢ VS TỦ HỒ SƠ 8KB

Nhiều lập trình viên nghĩ cơ sở dữ liệu là một "chiếc bảng Excel thần kỳ" lưu các dòng dữ liệu vào ổ cứng:
* **Tủ hồ sơ chia ngăn 8KB (Slotted Page Architecture):** PostgreSQL không lưu dữ liệu thành từng file lẻ tẻ. Ổ cứng được chia thành các ngăn cố định có kích thước chính xác **8 Kilobytes (8192 bytes)** gọi là **Page (hoặc Block)**. Trong mỗi ngăn 8KB: Danh sách các con trỏ (Item Pointers / Line Pointers) mọc từ đầu trang đi xuống dưới, còn dữ liệu thực sự (Tuples) lại được nhồi từ đáy trang đi ngược lên trên! Khi hai đầu chạm nhau, ngăn đó đầy.
* **Cuốn sổ tay ghi nợ cấp tốc (Write-Ahead Logging - WAL):** Hãy tưởng tượng một tiệm vàng đông nghẹt khách. Mỗi khi có khách mua vàng, nếu chủ tiệm phải mở két sắt lớn ra, tìm đúng ngăn hồ sơ của khách, ghi chép cẩn thận rồi khóa két lại (Random Disk I/O vào Data Page), khách hàng sẽ xếp hàng dài hàng cây số vì quá chậm! Thay vào đó, chủ tiệm cầm cuốn sổ tay bỏ túi nhỏ: Khách vừa nói mua 1 lượng vàng, chủ tiệm quẹt bút ghi 1 dòng vào sổ (Append-only Sequential Write: "Khách A +1 lượng") rồi gật đầu nhận tiền. Cuốn sổ tay đó chính là **Write-Ahead Log (WAL)**!
* **Tiến trình Checkpoint (Dọn dẹp sổ sách định kỳ):** Đến cuối ngày khi vắng khách, người kế toán mới đem cuốn sổ tay đối chiếu với két sắt lớn để đồng bộ toàn bộ dữ liệu vào ngăn tủ chính thức (Dirty Pages Flushed to Disk). Dù mất điện đột ngột giữa ngày, chỉ cần đọc lại cuốn sổ tay WAL là phục hồi nguyên vẹn $100\\%$ số vàng!

---

# 2. CẤU TRÚC CHI TIẾT CỦA MỘT 8KB DATA PAGE TRONG POSTGRESQL

Trong mã nguồn C của PostgreSQL (\`src/include/storage/bufpage.h\`), mỗi Page 8KB có bố cục vật lý như sau:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       POSTGRESQL 8KB SLOTTED PAGE LAYOUT                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Page Header (24 bytes): Chứa LSN (Log Sequence Number), checksum, con trỏ│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Line Pointers (ItemIds - 4 bytes mỗi con trỏ):                            │
│    [ Id 1: offset, len ] ──► [ Id 2 ] ──► [ Id 3 ] ──► [ Id N ] (Đi XUỐNG)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                     VÙNG BỘ NHỚ TRỐNG (FREE SPACE)                          │
│                     (Thu hẹp dần khi thêm dữ liệu mới)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Heap Tuples (Dữ liệu thực tế của các dòng bản ghi - Đi LÊN TỪ ĐÁY):      │
│    [ Tuple 3 (Dữ liệu text, int, uuid...) ]                                 │
│    [ Tuple 2 (Dữ liệu text, int, uuid...) ]                                 │
│    [ Tuple 1 (Tuple Header 23 bytes: xmin, xmax, t_ctid...) ]               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Special Space (0 bytes cho Heap Table, dùng cho B-Tree sibling pointers) │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Con Trỏ Bản Ghi ctid (Current Tuple ID)
Mỗi dòng trong bảng PostgreSQL được định danh vật lý bằng một cặp số:
$$\\text{ctid} = (\\text{Page Number}, \\text{Line Pointer Index})$$
Ví dụ: \`ctid = (42, 5)\` nghĩa là bản ghi này nằm ở **Page thứ 42** trên đĩa cứng, và được trỏ bởi **Line Pointer thứ 5** trong header của Page đó. Chỉ mục (Index) thực chất chỉ là một cây lưu trữ ánh xạ: \`Giá trị tìm kiếm -> ctid\`!

---

# 3. WRITE-AHEAD LOGGING (WAL) & QUY TRÌNH CHECKPOINT

Nguyên lý bảo đảm tính bền vững (Durability) trong ACID mà vẫn đạt tốc độ ghi hàng chục nghìn TPS:

\`\`\`diagram
[ CLIENT: INSERT / UPDATE ]
             │
             ▼
   [ 1. Ghi WAL Buffer ] ──► Ghi tuần tự Append-only xuống đĩa: wal/00000001000000.log
             │               (Fsync cực nhanh, đĩa quay tuần tự, không tìm kiếm ngẫu nhiên)
             ▼
[ 2. Sửa đổi Data Page trong Shared Buffers (RAM) ] ──► Trở thành "DIRTY PAGE"
             │
             ▼
   [ BÁO CLIENT THÀNH CÔNG (COMMIT TRANSACTION) ! ]
             │
  (Dữ liệu thực tế trên tệp dữ liệu chính base/16384 VẪN CHƯA HỀ ĐƯỢC GHI XUỐNG ĐĨA!)
             │
             ▼  [ ĐẾN KỲ CHECKPOINT (sau max_wal_size hoặc checkpoint_timeout) ]
[ 3. Background Writer / Checkpointer Process ] ──► Quét Shared Buffers
             │
             └──► Đẩy (Flush) toàn bộ Dirty Pages xuống tệp tin Data File chính thức!
\`\`\`

### 3.1 Điều Gì Xảy Ra Khi Mất Điện Đột Ngột (Crash Recovery)?
Nếu máy chủ bị rút phích cắm đột ngột: Toàn bộ Dirty Pages trong RAM (Shared Buffers) tan biến.
Khi máy chủ bật lại:
1. PostgreSQL tìm vị trí **Checkpoint gần nhất** được ghi trong file \`global/pg_control\`.
2. Đọc toàn bộ các bản ghi nhật ký WAL phát sinh từ thời điểm Checkpoint đó đến thời điểm sập nguồn (REDO phase).
3. Áp dụng lại (Replay) toàn bộ các thay đổi lên các Data Pages. Cơ sở dữ liệu trở lại trạng thái nhất quán hoàn hảo $100\\%$!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Bộ Nhớ Và Tệp Tin PostgreSQL (Memory & Disk Taxonomy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BỘ NHỚ CHIA SẺ (SHARED MEMORY)                     │
│  ├── Shared Buffers: Lưu trữ các Data Pages 8KB (Cache dữ liệu)             │
│  ├── WAL Buffers: Bộ đệm ghi nhận nhật ký trước khi fsync xuống đĩa         │
│  └── Lock Space: Bảng khóa dòng, khóa bảng phục vụ Concurrency              │
├─────────────────────────────────────────────────────────────────────────────┤
│                          BỘ NHỚ RIÊNG TƯ MỖI TIẾN TRÌNH                     │
│  └── Work Mem: Cấp phát riêng cho mỗi câu lệnh SELECT để ORDER BY, HASH JOIN │
├─────────────────────────────────────────────────────────────────────────────┤
│                          KHÔNG GIAN LƯU TRỮ Ổ CỨNG                          │
│  ├── base/<db_id>/<table_oid>: Chứa các Page 8KB của bảng dữ liệu           │
│  └── pg_wal/: Chứa các file WAL có kích thước cố định 16MB mỗi file         │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Vòng Đời Một Câu Lệnh INSERT (Lifecycle of an Insert Query)
\`\`\`diagram
1. Client gửi INSERT INTO users (name) VALUES ('Ho Oanh')
   │
2. Backend Worker tìm kiếm Page còn khoảng trống (Free Space Map - FSM)
   │
3. Tạo Heap Tuple mới, tạo Line Pointer trong Shared Buffers (RAM)
   │
4. Ghi bản ghi WAL vào WAL Buffer và gọi lệnh system call: fsync() xuống đĩa
   │
5. Đánh dấu Data Page trong RAM là "DIRTY" (Dữ liệu trong RAM mới hơn ổ cứng)
   │
6. Trả về cho Client: "INSERT 0 1" (Thành công trong vài ms!)
   │
7. Định kỳ (5 phút): Tiến trình Checkpointer xả Dirty Page xuống Data File chính
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Tinh Chỉnh Tham Số Lưu Trữ (DB Tuning Decision Tree)
\`\`\`diagram
HỆ THỐNG GẶP NGHẼN I/O GHI DỮ LIỆU POSTGRESQL?
│
├── Do số lần Checkpoint xảy ra quá dồn dập (Cảnh báo "checkpoints occurring too frequently")?
│   └──► TĂNG: max_wal_size (từ 1GB lên 16GB-32GB) và checkpoint_timeout (15min - 30min)
│
├── Do câu lệnh SORT / GROUP BY bị tràn ra đĩa cứng (External Merge Disk Sort)?
│   └──► TĂNG: work_mem (từ 4MB lên 32MB - 64MB cho từng session)
│
└── Do kích thước Shared Buffers quá nhỏ khiến tỉ lệ Cache Hit thấp (<95%)?
    └──► THIẾT LẬP: shared_buffers = 25% tổng dung lượng RAM của máy chủ
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế / Tham Số | Tối Ưu Tốc Độ Ghi | Mức Tiêu Hao RAM / Ổ Cứng | Thời Gian Phục Hồi Khi Sập Nguồn | Đánh Đổi Kỹ Thuật |
| :--- | :--- | :--- | :--- | :--- |
| **max_wal_size nhỏ (1GB)** | Ghi đĩa dồn dập (Chậm hơn) | Tiết kiệm ổ cứng pg_wal | Cực nhanh (<30 giây) | Phù hợp máy chủ cấu hình thấp |
| **max_wal_size lớn (32GB)**| Tối ưu ghi tối đa (Ít Flush) | Tốn nhiều GB ổ cứng | Lâu hơn khi crash (vài phút replay)| Chuẩn cho máy chủ Production cao cấp |
| **synchronous_commit = on** | ~1,000 - 3,000 TPS | Bình thường | An toàn tuyệt đối $0\\%$ mất dữ liệu | Đợi fsync từng commit |
| **synchronous_commit = off**| Tăng vọt lên >30,000 TPS | Tiêu tốn ít I/O | Có thể mất vài trăm ms dữ liệu cuối | Dành cho log, sensor, analytics |
`,
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class PostgresStorageMetricsService {
  private readonly logger = new Logger(PostgresStorageMetricsService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Truy vấn thông số vật lý của Page 8KB và tỉ lệ Cache Hit của Shared Buffers
   */
  public async getEngineDiagnostics(): Promise<{
    cacheHitRatio: number;
    walActivity: unknown;
    topTableSizes: unknown[];
  }> {
    // 1. Kiểm tra tỉ lệ Cache Hit (Tỉ lệ đọc từ RAM so với đọc từ đĩa cứng)
    // Tỉ lệ này trên Production bắt buộc phải > 99%
    const cacheResult = await this.dataSource.query(\`
      SELECT 
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 0.0001) * 100 AS cache_hit_ratio
      FROM pg_statio_user_tables;
    \`);

    // 2. Kiểm tra dung lượng vật lý thực tế của bảng và các Page 8KB
    const tableSizes = await this.dataSource.query(\`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size_with_indexes,
        relpages AS total_8kb_pages
      FROM pg_stat_user_tables
      ORDER BY pg_relation_size(relid) DESC
      LIMIT 5;
    \`);

    // 3. Kiểm tra hoạt động của tiến trình Checkpointer và ghi WAL
    const walStats = await this.dataSource.query(\`
      SELECT checkpoints_timed, checkpoints_req, checkpoint_write_time, checkpoint_sync_time
      FROM pg_stat_bgwriter;
    \`);

    const hitRatio = parseFloat(cacheResult[0]?.cache_hit_ratio || '0');

    if (hitRatio < 95) {
      this.logger.warn(\`[DB WARNING] Cache Hit Ratio thấp: \${hitRatio.toFixed(2)}% - Cần tăng shared_buffers!\`);
    }

    return {
      cacheHitRatio: hitRatio,
      walActivity: walStats[0],
      topTableSizes: tableSizes,
    };
  }
}
`,
      quiz: [
        {
          id: 'c5-l1-q1',
          question: 'Vì sao trong kiến trúc PostgreSQL 8KB Page, Line Pointers lại được bố trí mọc từ đầu trang xuống trong khi Heap Tuples mọc từ đáy trang lên?',
          options: [
            'Để tận dụng tối đa vùng nhớ trống ở giữa và cho phép kích thước của các dòng bản ghi có độ dài co giãn linh hoạt.',
            'Vì phần cứng vi xử lý hiện đại chỉ cho phép đọc dữ liệu nhị phân từ hai đầu đối nghịch nhau cùng một thời điểm.',
            'Để hỗ trợ việc mã hóa hai lớp độc lập giúp ngăn chặn các cuộc tấn công đọc trộm dữ liệu trực tiếp từ đĩa cứng.',
            'Vì các con trỏ dòng bắt buộc phải có kích thước bằng đúng một nửa kích thước của dữ liệu bản ghi thực tế.'
          ],
          correctIndex: 0,
          explanation: 'Bố cục Slotted Page này giúp giải quyết bài toán dữ liệu có độ dài thay đổi (Variable-length data: chuỗi text, json). Các con trỏ Line Pointers có kích thước cố định (4 bytes) tăng dần từ trên xuống, còn dữ liệu bản ghi thực tế được nhét từ dưới lên. Khoảng trống ở giữa (Free Space) co hẹp dần cho đến khi gặp nhau, giúp không bị phân mảnh bộ nhớ tĩnh.'
        },
        {
          id: 'c5-l1-q2',
          question: 'Cơ chế Write-Ahead Logging (WAL) mang lại ưu thế vượt trội nào cho tốc độ ghi dữ liệu của hệ thống cơ sở dữ liệu quan hệ?',
          options: [
            'Chuyển các thao tác ghi ngẫu nhiên vào các data pages thành các thao tác ghi tuần tự liên tục vào tệp log nhật ký.',
            'Tự động nén tất cả các hình ảnh và tệp tin đa phương tiện xuống dung lượng bằng không trước khi lưu trữ.',
            'Cho phép cơ sở dữ liệu bỏ qua việc kiểm tra các ràng buộc khóa ngoại và tính toàn vẹn của dữ liệu quan hệ.',
            'Tự động sao lưu toàn bộ cơ sở dữ liệu lên các máy chủ điện toán đám mây từ xa theo thời gian thực.'
          ],
          correctIndex: 0,
          explanation: 'Ghi ngẫu nhiên (Random I/O) vào các tệp dữ liệu phân tán trên đĩa rất chậm. WAL giải quyết bài toán này bằng cách chỉ ghi tuần tự (Sequential Append-only) vào tệp tin nhật ký. Khi tệp nhật ký được ghi xuống đĩa thành công, transaction được coi là đã hoàn tất (commit), còn việc cập nhật các Data Page phức tạp được hoãn lại cho tiến trình Checkpoint.'
        },
        {
          id: 'c5-l1-q3',
          question: 'Con trỏ vật lý ctid mang giá trị (105, 12) trong một bảng dữ liệu PostgreSQL biểu thị ý nghĩa kỹ thuật chính xác là gì?',
          options: [
            'Bản ghi nằm ở Page thứ 105 của tệp dữ liệu trên đĩa và được định vị bởi Line Pointer thứ 12 của Page đó.',
            'Bản ghi có khóa chính ID bằng 105 và đã trải qua mười hai lần cập nhật trạng thái giao dịch trong ngày.',
            'Bản ghi đang được chiếm giữ bởi tiến trình máy chủ số 105 và có tổng cộng mười hai cột dữ liệu khác rỗng.',
            'Bản ghi thuộc về người dùng thứ 105 và được phân vùng trên ổ đĩa cứng thể rắn thứ mười hai của cụm máy chủ.'
          ],
          correctIndex: 0,
          explanation: 'ctid (Current Tuple ID) là con trỏ địa chỉ vật lý nội bộ của PostgreSQL có dạng (block_number, tuple_index). Giá trị (105, 12) chỉ ra rằng dòng bản ghi này nằm ở Page thứ 105 của bảng trên ổ đĩa và tương ứng với chỉ mục con trỏ số 12 bên trong Page đó.'
        },
        {
          id: 'c5-l1-q4',
          question: 'Nếu cấu hình max_wal_size quá nhỏ trên một cơ sở dữ liệu có cường độ ghi cao (Heavy Write Traffic), điều gì sẽ xảy ra?',
          options: [
            'Tiến trình Checkpoint sẽ bị kích hoạt liên tục làm quá tải I/O đĩa cứng và khiến tốc độ phản hồi của hệ thống bị sụt giảm.',
            'Cơ sở dữ liệu sẽ tự động từ chối tất cả các câu lệnh SELECT đọc dữ liệu để ưu tiên tài nguyên cho việc giải phóng ổ đĩa.',
            'Toàn bộ các tệp tin nhật ký giao dịch cũ sẽ bị xóa bỏ vĩnh viễn và không thể khôi phục lại khi gặp sự cố sập nguồn.',
            'PostgreSQL sẽ tự động chuyển đổi sang mô hình cơ sở dữ liệu NoSQL dạng tài liệu để tránh ghi nhật ký đĩa cứng.'
          ],
          correctIndex: 0,
          explanation: 'Khi lượng dữ liệu WAL phát sinh vượt quá ngưỡng max_wal_size, PostgreSQL buộc phải kích hoạt Checkpoint sớm hơn dự kiến. Nếu tham số này quá nhỏ, Checkpoint sẽ diễn ra dồn dập liên tục, buộc server phải xả Dirty Pages ra đĩa không ngừng nghỉ, gây nghẽn băng thông I/O (Disk I/O Spikes) làm chậm toàn bộ hệ thống.'
        }
      ],
      codeChallenge: {
        id: 'c5-l1-c1',
        title: 'Mô Phỏng Slotted Page Free Space Calculator',
        description: 'Hiện thực hàm \`calculateFreeSpace(pageSize: number, linePointerCount: number, tupleSizes: number[]): number\`. Cấu trúc Page gồm: Page Header cố định 24 bytes; mỗi Line Pointer chiếm 4 bytes; mỗi Tuple chiếm dung lượng tương ứng trong mảng \`tupleSizes\`. Trả về số byte trống còn lại trong Page. Nếu tổng kích thước vượt quá \`pageSize\`, trả về \`0\` (đã đầy).',
        starterCode: `
export function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  // TODO: Tính toán dung lượng Free Space còn lại trong một Page 8KB
  return 0;
}
`,
        solution: `
export function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  const HEADER_SIZE = 24;
  const LINE_POINTER_SIZE = 4;

  const totalLinePointersSize = linePointerCount * LINE_POINTER_SIZE;
  const totalTuplesSize = tupleSizes.reduce((acc, curr) => acc + curr, 0);

  const usedSpace = HEADER_SIZE + totalLinePointersSize + totalTuplesSize;

  if (usedSpace >= pageSize) {
    return 0;
  }

  return pageSize - usedSpace;
}
`,
        testCases: [
          {
            name: 'Tính toán Page 8192 bytes với 2 line pointers và 2 tuples (100b, 200b)',
            input: [8192, 2, [100, 200]],
            expected: 8192 - (24 + 8 + 300) // 7860
          },
          {
            name: 'Page bị tràn dung lượng',
            input: [500, 10, [300, 200]],
            expected: 0
          }
        ]
      }
    },
    {
      id: 'c5-l2',
      title: 'Bài 02: B-Tree Index Deep Dive: Cấu Trúc Nhị Phân Nâng Cao, B-Tree Page Splits & Covering Index',
      duration: '60 phút',
      tag: 'B-Tree Index Internals',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: CUỐN TỪ ĐIỂN BÁCH KHOA VS MỤC LỤC TRA CỨU NHANH

Nhiều lập trình viên cứ thấy câu query chậm là tự động gắn \`@Index()\` bừa bãi vào mọi cột:
* **Sequential Scan (Đọc sách từ trang 1 đến trang 1000):** Cần tìm định nghĩa từ "Zebra" trong cuốn từ điển 1,000 trang. Nếu không có mục lục, đại ca phải lật đọc từng trang từ trang 1 đến trang 1000 ($O(N)$ Disk I/O). Đọc hàng triệu dòng dữ liệu từ đĩa cứng mất hàng chục giây!
* **B-Tree Index (Cây mục lục đa phân tự cân bằng):** Cuốn từ điển có cấu trúc phân tầng: Trang đầu chia làm 3 nhóm lớn: [A-H], [I-P], [Q-Z] (Root Node). Chọn nhánh [Q-Z], lật tiếp thấy chia thành [Q-U] và [V-Z] (Internal Node). Lật tiếp một lần nữa là đến ngay trang chứa từ "Zebra" (Leaf Node). Chỉ cần **3 lần lật trang ($O(\\log N)$)** thay vì 1,000 lần!
* **B-Tree Page Split (Nỗi đau xé rách trang mục lục):** Hãy tưởng tượng một trang mục lục chỉ chứa được tối đa 100 từ và đã kín đặc. Đại ca muốn chèn thêm một từ mới vào giữa trang đó. Người biên tập không thể nhét thêm được nữa! Họ buộc phải: **Cắt đôi trang giấy ra làm hai trang mới (Mỗi trang chứa 50 từ), ghi từ mới vào, rồi chạy lên trang mục lục cấp trên để sửa lại con trỏ tham chiếu!** Quá trình này tiêu tốn gấp 3 lần Disk I/O và tạo ra các khoảng trống lãng phí phân mảnh bộ nhớ!

---

# 2. CẤU TRÚC ĐA TẦNG CỦA B-TREE TRONG POSTGRESQL

B-Tree trong PostgreSQL là biến thể **$B^+$-Tree** (Cây B-Tree cải tiến):

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CẤU TRÚC CÂY B-TREE INDEX TRONG RAM/DISK           │
├─────────────────────────────────────────────────────────────────────────────┤
│                             [ ROOT PAGE (Gốc) ]                             │
│                             ├── Keys: [ 100 | 500 ]                         │
│                             └── Pointers: [ Page 2 | Page 3 | Page 4 ]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                    [ INTERNAL PAGES (Các trang trung gian) ]                │
│    Page 2: Keys [<100]        Page 3: Keys [100-500]      Page 4: Keys [>500]
├─────────────────────────────────────────────────────────────────────────────┤
│                      [ LEAF PAGES (Các trang lá chứa ctid) ]                │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐ │
│  │ Leaf Page 10         │◄─►│ Leaf Page 11         │◄─►│ Leaf Page 12     │ │
│  │ Key: 10 -> (Page 1,2)│   │ Key: 150 -> (Page 5,1)│  │ Key: 600 ->...   │ │
│  │ Key: 25 -> (Page 1,9)│   │ Key: 200 -> (Page 5,8)│  │ (Linked List)    │ │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Điểm Đột Phá Của Leaf Node Doubly-Linked List
Tất cả các Leaf Pages ở đáy cây đều được liên kết với nhau bằng một danh sách liên kết đôi (Doubly-Linked List).
Điều này giúp các câu truy vấn khoảng giá trị (**Range Queries**) như:
\`\`\`sql
SELECT * FROM orders WHERE amount BETWEEN 100 AND 500;
\`\`\`
Chỉ cần tìm kiếm $O(\\log N)$ đến giá trị \`100\` tại Leaf Page đầu tiên, sau đó **chỉ việc đi bộ ngang (Sequential Traverse) qua con trỏ \`next_page\`** để lấy toàn bộ các giá trị cho đến \`500\` mà không cần phải leo ngược lại gốc cây!

---

# 3. KỸ THUẬT SENIOR: COVERING INDEX & INDEX-ONLY SCAN

Một hiểu lầm kinh điển: Tìm kiếm bằng Index luôn luôn nhanh nhất.
* **Thực tế:** Khi tìm kiếm qua Index, cơ sở dữ liệu làm 2 bước:
  1. Đọc B-Tree Index để lấy ra con trỏ \`ctid\` (Ví dụ \`(Page 42, Tuple 5)\`).
  2. Dùng \`ctid\` nhảy sang Heap Data File để đọc toàn bộ dòng dữ liệu đó (**Random Heap Read**).
  Nếu câu truy vấn trả về 10,000 dòng, cơ sở dữ liệu phải thực hiện 10,000 lần Random I/O nhảy vào Heap Table, làm câu lệnh chậm không kém gì Sequential Scan!

### 3.1 Giải Pháp Triệt Để: Covering Index với Mệnh Đề INCLUDE
Từ PostgreSQL 11+, ta có thể tạo **Chỉ mục bao phủ (Covering Index)**:
\`\`\`sql
CREATE INDEX idx_users_email_covering 
ON users (email) 
INCLUDE (full_name, phone_number);
\`\`\`
* Cột \`email\` nằm trong cây B-Tree dùng để tìm kiếm ($O(\\log N)$).
* Hai cột \`full_name\` và \`phone_number\` được đính kèm trực tiếp vào Leaf Page của Index nhưng **không tham gia vào việc sắp xếp cây**.
* Khi chạy:
\`\`\`sql
SELECT full_name, phone_number FROM users WHERE email = 'oanh@esmiles.vn';
\`\`\`
Database đọc thẳng dữ liệu từ Leaf Node của Index và trả về luôn cho Client!
Nó kích hoạt trạng thái thần thánh: **\`Index Only Scan\` ($0\\text{ Heap Lookups}$)**, nhanh gấp 10 lần Index thông thường!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Loại Các Kiểu Index Trong PostgreSQL (Index Taxonomy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HỆ THỐNG CHỈ MỤC POSTGRESQL                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. B-TREE INDEX (Mặc định - 90% trường hợp): Phù hợp so sánh =, <, >, BETWEEN│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. GIN (Generalized Inverted Index): Chuyên trị JSONB, Array, Full-text Search│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. GiST (Generalized Search Tree): Tọa độ địa lý GIS (PostGIS), Khoảng Range │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. BRIN (Block Range Index): Bảng cực lớn (hàng trăm triệu dòng) ghi theo    │
│    thứ tự thời gian (Log/Timeseries), dung lượng siêu nhỏ (~vài MB)         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. HASH INDEX: Chỉ hỗ trợ so sánh bằng (=), không hỗ trợ khoảng giá trị     │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Truy Vấn Index-Only Scan vs Index Scan Thường
\`\`\`diagram
CÂU LỆNH: SELECT email, full_name FROM users WHERE email = 'a@b.com'
│
├── KỊCH BẢN 1: INDEX THƯỜNG TRÊN CỘT (email)
│   ├── 1. Duyệt B-Tree tìm được Leaf Node chứa email 'a@b.com'
│   ├── 2. Rút trích ctid: (Page 89, Slot 4)
│   ├── 3. Nhảy sang Heap Data File đọc Page 89 (RANDOM DISK I/O!)
│   ├── 4. Lấy trường full_name từ Data Page
│   └── 5. Trả về kết quả: [Index Scan]
│
└── KỊCH BẢN 2: COVERING INDEX (email) INCLUDE (full_name)
    ├── 1. Duyệt B-Tree tìm được Leaf Node chứa email 'a@b.com'
    ├── 2. Thấy luôn giá trị 'full_name' nằm sẵn trong Leaf Node!
    ├── 3. Bỏ qua hoàn toàn việc nhảy sang Heap Data File (Zero Heap Access!)
    └── 4. Trả về kết quả ngay lập tức: [Index Only Scan - CỰC NHANH!]
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Tạo Index Chuẩn Mực (Indexing Decision Tree)
\`\`\`diagram
BẢNG DỮ LIỆU CÓ CẦN THÊM INDEX KHÔNG?
│
├── Bảng có ít hơn 1,000 dòng dữ liệu?
│   └──► TUYỆT ĐỐI KHÔNG (Sequential Scan đọc thẳng vào RAM nhanh hơn duyệt B-Tree!)
│
├── Cột có độ chọn lọc cao (High Cardinality: UUID, Email, Số điện thoại)?
│   └──► NÊN TẠO B-Tree Index thông thường
│
├── Cột chỉ có vài giá trị lặp lại (Low Cardinality: Gender, Status 'PENDING'/'DONE')?
│   ├── Thường chỉ query các dòng hiếm hoi (vd: status = 'FAILED' chiếm 1%)?
│   │   └──► DÙNG PARTIAL INDEX: CREATE INDEX ON orders (status) WHERE status = 'FAILED'
│   └── Query đều cả 2 giá trị:
│       └──► KHÔNG NÊN ĐÁNH INDEX (Optimizer sẽ bỏ qua và dùng Seq Scan)
│
└── Query thường xuyên lấy thêm 1-2 cột phụ kèm theo điều kiện lọc?
    └──► DÙNG COVERING INDEX: CREATE INDEX ON t (col1) INCLUDE (col2)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chỉ Mục (Index) | Tốc Độ Truy Vấn SELECT | Tốc Độ Ghi INSERT/UPDATE | Dung Lượng Ổ Cứng & RAM | Rủi Ro Vận Hành |
| :--- | :--- | :--- | :--- | :--- |
| **Không có Index** | $O(N)$ (Rất chậm khi dữ liệu lớn)| $O(1)$ (Cực nhanh, chỉ append)| Tối thiểu | Quá tải CPU khi quét toàn bảng |
| **B-Tree Tiêu Chuẩn**| $O(\\log N)$ (Rất nhanh) | Chậm hơn (Phải cập nhật cây)| Tăng thêm $20\\% - 40\\%$ RAM| Dễ bị Page Splits nếu chèn ngẫu nhiên |
| **Covering Index** | Siêu tốc (Index Only Scan) | Chậm hơn một chút | Tốn thêm dung lượng Leaf Node| Lãng phí nếu cột INCLUDE quá dài |
| **Partial Index** | Cực nhanh cho tập con | Nhanh hơn Index toàn bảng | Dung lượng cực nhỏ (~vài KB)| Không có tác dụng nếu query ngoài WHERE |
`,
      realCodeSnippet: `
import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeHighThroughputIndexing1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Partial Index: Chỉ lập chỉ mục cho các đơn hàng chưa xử lý
    // Tránh phình to Index với hàng triệu đơn đã hoàn thành
    await queryRunner.query(\`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_unprocessed
      ON orders (created_at ASC)
      WHERE status IN ('PENDING', 'PROCESSING');
    \`);

    // 2. Covering Index: Đính kèm thông tin hiển thị trực tiếp vào Leaf Node
    // Giúp câu query thông tin khách hàng đạt cảnh giới Index Only Scan 100%
    await queryRunner.query(\`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_lookup_covering
      ON users (tenant_id, email)
      INCLUDE (first_name, last_name, is_active);
    \`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`DROP INDEX CONCURRENTLY IF EXISTS idx_orders_unprocessed;\`);
    await queryRunner.query(\`DROP INDEX CONCURRENTLY IF EXISTS idx_users_lookup_covering;\`);
  }
}
`,
      quiz: [
        {
          id: 'c5-l2-q1',
          question: 'Hiện tượng "B-Tree Page Split" xảy ra khi nào và gây ảnh hưởng tiêu cực gì đến hiệu năng ghi dữ liệu của hệ thống cơ sở dữ liệu?',
          options: [
            'Khi một trang lá B-Tree bị đầy và cần chèn thêm khóa mới buộc phải tách đôi trang làm tăng số thao tác ghi đĩa và phân mảnh cây.',
            'Khi hai tiến trình cùng cố gắng đọc một trang dữ liệu khiến cho hệ điều hành phải chia sẻ xung nhịp xử lý của CPU.',
            'Khi cơ sở dữ liệu tự động xóa các bản ghi hết hạn làm cho kích thước của tệp tin bị co hẹp đột ngột trên hệ điều hành.',
            'Khi người dùng thực hiện câu lệnh xóa chỉ mục khiến cho bảng dữ liệu phải phân chia lại các cột khóa ngoại.'
          ],
          correctIndex: 0,
          explanation: 'B-Tree Page Split xảy ra khi một Node/Page trong cây chỉ mục không còn đủ khoảng trống để chứa thêm một phần tử mới. Hệ thống bắt buộc phải cấp phát một Page mới, chuyển 50% dữ liệu sang đó, chèn bản ghi mới và cập nhật lại con trỏ ở Node cha. Quá trình này tiêu tốn nhiều Disk I/O ngẫu nhiên và làm tăng độ phân mảnh của Index.'
        },
        {
          id: 'c5-l2-q2',
          question: 'Tính năng "Covering Index" với mệnh đề INCLUDE trong PostgreSQL mang lại lợi thế vượt trội nào so với một Composite Index thông thường?',
          options: [
            'Cho phép thực thi Index Only Scan mà không làm tăng kích cỡ của cây tìm kiếm do các cột trong INCLUDE không nằm ở các tầng trên.',
            'Tự động sao lưu toàn bộ các cột trong bảng sang một máy chủ dự phòng mà không tốn băng thông đường truyền mạng.',
            'Bắt buộc cơ sở dữ liệu phải lưu trữ toàn bộ các cột được chỉ định trong bộ nhớ đệm CPU L1 để truy xuất tức thì.',
            'Cho phép sử dụng các hàm toán học phức tạp như căn bậc hai hoặc lượng giác ngay bên trong cấu trúc của khóa chính.'
          ],
          correctIndex: 0,
          explanation: 'Với Covering Index (sử dụng từ khóa INCLUDE), các cột phụ chỉ được đính kèm tại các Leaf Pages dưới đáy cùng để phục vụ việc đọc dữ liệu (payload), chứ không hề tham gia vào cấu trúc sắp xếp của các tầng Root và Internal Nodes. Điều này giúp kích thước cây tìm kiếm nhỏ gọn, vừa đạt được Index Only Scan vừa không làm nặng cây.'
        },
        {
          id: 'c5-l2-q3',
          question: 'Trong trường hợp nào sau đây việc tạo một Partial Index (Chỉ mục bộ phận) là giải pháp tối ưu vượt bậc về cả dung lượng đĩa lẫn tốc độ ghi?',
          options: [
            'Khi đại ca chỉ cần truy vấn thường xuyên một tập con dữ liệu chiếm tỉ lệ rất nhỏ trong bảng ví dụ như các đơn hàng bị lỗi.',
            'Khi bảng dữ liệu có số lượng dòng rất ít dưới một trăm bản ghi và thường xuyên được đọc toàn bộ vào bộ nhớ ram.',
            'Khi đại ca muốn tạo một chỉ mục bao quát toàn bộ các cột của bảng để phục vụ cho mọi câu lệnh tìm kiếm có thể có.',
            'Khi cơ sở dữ liệu đang chạy trên hệ thống tệp tin mạng và không hỗ trợ các tính năng khóa hàng của giao dịch.'
          ],
          correctIndex: 0,
          explanation: 'Partial Index sử dụng mệnh đề WHERE khi tạo index (ví dụ: WHERE status = "FAILED"). Nếu trong 10 triệu đơn hàng chỉ có 10,000 đơn bị lỗi, Partial Index chỉ lưu 10,000 mục này, giúp kích thước index siêu nhỏ, nằm gọn trong RAM, và các thao tác INSERT đơn hàng thành công thông thường không hề bị chậm vì không phải cập nhật index này.'
        },
        {
          id: 'c5-l2-q4',
          question: 'Vì sao việc sử dụng UUID v4 ngẫu nhiên làm Khóa chính (Primary Key Clustered/B-Tree) lại là một nguyên nhân hàng đầu gây sụt giảm hiệu năng ghi dữ liệu?',
          options: [
            'Vì tính chất ngẫu nhiên của UUID v4 phân tán vị trí chèn khắp các trang khác nhau liên tục kích hoạt hiện tượng B-Tree Page Splits.',
            'Vì chuỗi ký tự UUID v4 không thể chuyển đổi thành các con số nhị phân để lưu trữ trên đĩa cứng thể rắn hiện đại.',
            'Vì các thuật toán băm của cơ sở dữ liệu từ chối tiếp nhận các giá trị có chứa dấu gạch ngang phân cách theo quy chuẩn RFC.',
            'Vì hệ quản trị cơ sở dữ liệu PostgreSQL chỉ cho phép tối đa một nghìn giá trị UUID ngẫu nhiên tồn tại trong một bảng.'
          ],
          correctIndex: 0,
          explanation: 'B-Tree sắp xếp các khóa theo thứ tự liên tục. Khi dùng BigInt tự tăng hoặc UUID v7 (Time-based), các bản ghi mới luôn được chèn tuần tự vào cuối trang lá cuối cùng (Right-most leaf). Ngược lại, UUID v4 hoàn toàn ngẫu nhiên sẽ chèn rải rác vào giữa bất kỳ trang nào trong hàng triệu trang của cây, liên tục gây vỡ trang (Page Splits) và xới tung bộ nhớ đệm Buffer Pool.'
        }
      ],
      codeChallenge: {
        id: 'c5-l2-c1',
        title: 'Mô Phỏng B-Tree Node Insertion & Page Split Detection',
        description: 'Hiện thực hàm \`insertIntoBTreeNode(currentKeys: number[], newKey: number, maxCapacity: number): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null }\`. Hàm nhận vào danh sách các khóa hiện có đã được sắp xếp tăng dần và chèn \`newKey\` vào đúng vị trí. Nếu số lượng sau khi chèn vượt quá \`maxCapacity\`, kích hoạt \`splitOccurred: true\`, tìm phần tử ở giữa (median index = Math.floor(len / 2)) làm \`promotedKey\`, phần còn lại chia thành \`leftKeys\` và \`rightKeys\`. Nếu không vượt ngưỡng, \`splitOccurred: false\`.',
        starterCode: `
export function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): {
  splitOccurred: boolean;
  leftKeys: number[];
  rightKeys: number[];
  promotedKey: number | null;
} {
  // TODO: Chèn phần tử có sắp xếp và tách node khi vượt ngưỡng dung lượng
  return { splitOccurred: false, leftKeys: [], rightKeys: [], promotedKey: null };
}
`,
        solution: `
export function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): {
  splitOccurred: boolean;
  leftKeys: number[];
  rightKeys: number[];
  promotedKey: number | null;
} {
  const combined = [...currentKeys, newKey].sort((a, b) => a - b);

  if (combined.length <= maxCapacity) {
    return {
      splitOccurred: false,
      leftKeys: combined,
      rightKeys: [],
      promotedKey: null,
    };
  }

  // Vượt ngưỡng -> Thực hiện Page Split
  const midIndex = Math.floor(combined.length / 2);
  const promotedKey = combined[midIndex];
  const leftKeys = combined.slice(0, midIndex);
  const rightKeys = combined.slice(midIndex + 1);

  return {
    splitOccurred: true,
    leftKeys,
    rightKeys,
    promotedKey,
  };
}
`,
        testCases: [
          {
            name: 'Chèn không vượt quá dung lượng (maxCapacity = 3)',
            input: [[10, 30], 20, 3],
            expected: { splitOccurred: false, leftKeys: [10, 20, 30], rightKeys: [], promotedKey: null }
          },
          {
            name: 'Chèn gây ra Page Split khi vượt ngưỡng 3 phần tử',
            input: [[10, 20, 40], 30, 3],
            expected: {
              splitOccurred: true,
              leftKeys: [10, 20],
              rightKeys: [40],
              promotedKey: 30
            }
          }
        ]
      }
    },
    {
      id: 'c5-l3',
      title: 'Bài 03: Giải Mã Query Optimizer: EXPLAIN (ANALYZE, BUFFERS), Sequential Scan vs Index Scan vs Bitmap Scan',
      duration: '60 phút',
      tag: 'Query Optimization & EXPLAIN',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: TƯ TƯỞNG CỦA MỘT TỔNG ĐẠI LÝ GIAO HÀNG

Khi đại ca bấm chạy một câu lệnh SQL, PostgreSQL không lập tức đi tìm dữ liệu ngay. Nó đưa câu lệnh vào **Bộ Tối Ưu Hóa Truy Vấn (Cost-Based Query Optimizer)**:
* **Người quản lý lộ trình vận tải (The Cost-based Optimizer):** Bạn cần giao 500 bưu kiện trong thành phố. Người quản lý mở bản đồ ra, tính toán chi phí (Cost) của từng phương án: Đi xe máy luồn lách qua ngõ nhỏ (Index Scan) hay thuê hẳn một chiếc xe tải lớn quét một vòng toàn bộ các trục đường chính (Sequential Scan)? Phương án nào có điểm chi phí dự toán (Total Estimated Cost) thấp nhất sẽ được chọn làm **Execution Plan**!
* **Sequential Scan (Xe tải lớn gom hàng toàn tuyến):** Khi số lượng kiện hàng chiếm tới $30\\%$ tổng số nhà trên đường, việc đi xe máy dừng lại từng nhà tra danh bạ (Random I/O của Index) chậm hơn nhiều so với việc xe tải cứ chạy thẳng một mạch từ đầu phố đến cuối phố gom sạch (Sequential Read tốc độ cao).
* **Bitmap Index Scan (Tấm lưới đánh dấu vị trí trước khi xuất phát):** Đi xe máy quét qua danh bạ (Index), nhưng thay vì chạy ngay đến từng nhà, nhân viên lấy bút dạ quang tô các chấm đỏ lên bản đồ đường đi (**Tạo Bitmap trong RAM**). Sau đó, xe chạy một mạch qua các chấm đỏ theo đúng thứ tự vật lý của con đường! Tránh được hoàn toàn việc chạy qua chạy lại lộn xộn.

---

# 2. GIẢI MÃ CÂU LỆNH VÀNG: EXPLAIN (ANALYZE, BUFFERS)

Đây là công cụ mạnh mẽ nhất trong kho vũ khí của một Senior Backend Engineer:
\`\`\`sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)
SELECT * FROM orders WHERE user_id = 42 AND status = 'COMPLETED';
\`\`\`

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CẤU TRÚC KẾT QUẢ CỦA MỘT KẾ HOẠCH EXPLAIN             │
├─────────────────────────────────────────────────────────────────────────────┤
│ -> Bitmap Heap Scan on orders (cost=4.85..32.10 rows=15 width=120)          │
│    (actual time=0.045..0.120 rows=12 loops=1)                               │
│    Buffers: shared hit=8 read=2                                             │
│    Recheck Cond: ((user_id = 42) AND (status = 'COMPLETED'))                │
│    -> Bitmap Index Scan on idx_orders_user_status (cost=0.00..4.85 rows=15) │
│       Buffers: shared hit=2                                                 │
│ Planning Time: 0.182 ms                                                     │
│ Execution Time: 0.165 ms                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Bóc Tách Các Chỉ Số Quan Trọng Bậc Nhất
1. **cost=4.85..32.10:**
   - \`4.85\` (Startup Cost): Chi phí ước tính để sinh ra dòng kết quả đầu tiên.
   - \`32.10\` (Total Cost): Tổng chi phí ước tính để đọc toàn bộ các dòng kết quả. (Đơn vị tính bằng tích số lần đọc Page đĩa \`seq_page_cost = 1.0\`).
2. **actual time=0.045..0.120:** Thời gian thực tế được đo bằng đồng hồ microsecond (Chỉ xuất hiện khi có cờ \`ANALYZE\`).
3. **Buffers: shared hit=8 read=2:**
   - \`shared hit=8\`: Đã đọc 8 Pages (64KB) từ trong **RAM (Shared Buffers)** ($0\\text{ ms}$ Disk I/O).
   - \`shared read=2\`: Phải đọc 2 Pages (16KB) từ **Ổ cứng vật lý (Disk Read)**!

---

# 3. BA CHIẾN THẦN QUÉT DỮ LIỆU: SEQ SCAN VS INDEX SCAN VS BITMAP SCAN

\`\`\`diagram
                              CÁCH THỨC QUÉT DỮ LIỆU CỦA POSTGRESQL
                                                │
             ┌──────────────────────────────────┼──────────────────────────────────┐
             ▼                                  ▼                                  ▼
    [ 1. SEQUENTIAL SCAN ]              [ 2. INDEX SCAN ]              [ 3. BITMAP INDEX SCAN ]
  Quét toàn bộ các Page từ đầu        Tra B-Tree lấy từng ctid rồi     Dùng Index tạo bản đồ Bitmap
  đến cuối bảng tuần tự.             nhảy ngay sang Heap đọc dòng.     trong RAM, sắp xếp ctid theo
             │                                  │                      thứ tự đĩa rồi mới đọc Heap.
             ▼                                  ▼                                  ▼
 Phù hợp: Bảng nhỏ, hoặc câu        Phù hợp: Lọc lấy rất ít dòng      Phù hợp: Lọc lấy số lượng dòng
 lệnh lấy > 15-20% tổng số dòng.    (1 - 5 dòng: SELECT by UUID/ID).  vừa phải (1% - 15% tổng bảng).
\`\`\`

### 3.1 Bẫy Nguy Hiểm: Tại Sao Có Index Nhưng Optimizer Vẫn Chọn Seq Scan?
1. **Bảng quá nhỏ (< vài trăm dòng):** Toàn bộ bảng nằm trọn trong 1 hoặc 2 Pages (16KB). Đọc thẳng 1 Page vào RAM nhanh hơn nhiều so với việc đọc Page của Index rồi mới đọc Page của Table!
2. **Dữ liệu lọc không đủ tính chọn lọc:** Nếu điều kiện \`WHERE is_active = true\` mà $90\\%$ người dùng đều là \`true\`, dùng Index sẽ gây ra hàng triệu lượt Random I/O, chậm gấp 5 lần đọc tuần tự!
3. **Thống kê dữ liệu bị sai lệch (Outdated Statistics):** Nếu bảng vừa được chèn 1 triệu dòng mới nhưng tiến trình AutoVacuum chưa chạy \`ANALYZE\`, Optimizer tưởng bảng vẫn rỗng nên chọn nhầm kế hoạch tồi tệ! Khắc phục: Chạy ngay lệnh \`ANALYZE table_name;\`.

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Cấp Các Nút Thực Thi Kế Hoạch (Plan Nodes Taxonomy)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CÁC LOẠI PHÉP TOÁN KẾ HOẠCH (NODES)                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. SCAN NODES (Đọc dữ liệu thô)                                             │
│    └── Seq Scan, Index Scan, Index Only Scan, Bitmap Scan                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. JOIN NODES (Ghép nối hai bảng quan hệ)                                   │
│    ├── Nested Loop Join: Tốt nhất cho tập dữ liệu nhỏ có Index              │
│    ├── Hash Join: Dùng bảng băm trong RAM cho tập dữ liệu trung bình/lớn     │
│    └── Merge Join: Ghép 2 tập dữ liệu đã được sắp xếp từ trước              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. AGGREGATE & SORT NODES (Gom nhóm và sắp xếp)                             │
│    ├── Sort: Sắp xếp trong work_mem (QuickSort) hoặc ngoài đĩa (External)   │
│    └── HashAggregate: Gom nhóm GROUP BY bằng bảng băm trong bộ nhớ          │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Quyết Định Của Bộ Tối Ưu Hóa (Cost Optimizer Flow)
\`\`\`diagram
Câu lệnh SQL được gửi đến
   │
   ▼
Parser & Rewriter: Kiểm tra cú pháp và biến đổi câu lệnh
   │
   ▼
Query Optimizer:
   ├── 1. Đọc số liệu thống kê từ bảng hệ thống pg_statistic
   ├── 2. Sinh ra hàng chục phương án khả thi (Plan Alternatives)
   ├── 3. Tính toán chi phí (CPU cost + I/O cost) cho từng phương án
   └── 4. Chọn phương án có Lowest Estimated Cost
   │
   ▼
Executor: Chạy kế hoạch thực tế và trả dữ liệu về cho ứng dụng
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Chẩn Đoán Query Chậm (Query Diagnostics Tree)
\`\`\`diagram
CÂU QUERY CHẠY CHẬM TRÊN PRODUCTION (>500MS)?
│
├── Chạy EXPLAIN (ANALYZE, BUFFERS)
│   ├── Thấy "Seq Scan on <Large Table>"?
│   │   ├── Có thiếu Index ở mệnh đề WHERE / JOIN không?
│   │   │   └──► TẠO INDEX: CREATE INDEX CONCURRENTLY
│   │   └── Đã có Index nhưng Optimizer không dùng?
│   │       └──► Chạy lệnh: ANALYZE <table_name> để cập nhật thống kê!
│   │
│   ├── Thấy "Sort Method: external merge Disk"?
│   │   └──► NGUY HIỂM: Tràn bộ nhớ RAM sắp xếp ra ổ cứng!
│   │        └──► TĂNG: work_mem (ví dụ: SET work_mem = '64MB')
│   │
│   └── Thấy "Buffers: shared read=..." chiếm số lượng rất lớn?
│       └──► Dữ liệu không có trong RAM, phải đọc từ đĩa chậm chạp!
│            └──► Tăng kích thước shared_buffers của máy chủ!
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Chiến Lược Quét | Kiểu Truy Xuất Ổ Cứng | Tốc Độ Cho Dữ Liệu Nhỏ | Tốc Độ Cho Dữ Liệu Lớn | Sử Dụng RAM Bổ Sung |
| :--- | :--- | :--- | :--- | :--- |
| **Sequential Scan** | Tuần tự (Sequential Read)| Cực nhanh | Rất chậm nếu bảng hàng chục GB| $0\\%$ RAM phụ trợ |
| **Index Scan** | Ngẫu nhiên (Random Heap Read)| Nhanh nhất ($1 - 5$ dòng) | Chậm nếu lấy nhiều dòng | Cần cache Leaf Pages |
| **Bitmap Scan** | Hỗn hợp (Tạo Map rồi gom đĩa)| Trung bình | Tối ưu xuất sắc cho $1\\% - 10\\%$ | Cần bộ nhớ lưu trữ Bitmap |
| **Index Only Scan** | Hoàn toàn không vào Heap | Nhanh tối thượng | Rất nhanh cho việc đếm COUNT() | Cần Visibility Map sạch rác |
`,
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface QueryPlanAnalysis {
  executionTimeMs: number;
  planningTimeMs: number;
  scanType: 'Seq Scan' | 'Index Scan' | 'Index Only Scan' | 'Bitmap Scan' | 'Other';
  sharedHitBlocks: number;
  sharedReadBlocks: number;
  rawPlan: string;
}

@Injectable()
export class DatabaseQueryProfilerService {
  private readonly logger = new Logger(DatabaseQueryProfilerService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Phân tích tự động kế hoạch thực thi của câu lệnh và phát hiện các bẫy hiệu năng
   */
  public async profileQuery(sqlQuery: string, params: unknown[] = []): Promise<QueryPlanAnalysis> {
    const explainQuery = \`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) \${sqlQuery}\`;
    const result = await this.dataSource.query(explainQuery, params);

    const planData = result[0]['QUERY PLAN'][0];
    const planNode = planData['Plan'];

    const executionTimeMs = planData['Execution Time'];
    const planningTimeMs = planData['Planning Time'];
    const nodeType = planNode['Node Type'];
    const sharedHit = planNode['Shared Hit Blocks'] || 0;
    const sharedRead = planNode['Shared Read Blocks'] || 0;

    let detectedScan: QueryPlanAnalysis['scanType'] = 'Other';
    if (nodeType.includes('Seq Scan')) detectedScan = 'Seq Scan';
    else if (nodeType.includes('Index Only Scan')) detectedScan = 'Index Only Scan';
    else if (nodeType.includes('Index Scan')) detectedScan = 'Index Scan';
    else if (nodeType.includes('Bitmap')) detectedScan = 'Bitmap Scan';

    if (detectedScan === 'Seq Scan' && planNode['Actual Rows'] > 1000) {
      this.logger.warn(\`[QUERY PERF ALERT] Phát hiện Seq Scan trên tập dữ liệu lớn: \${planNode['Actual Rows']} dòng!\`);
    }

    return {
      executionTimeMs,
      planningTimeMs,
      scanType: detectedScan,
      sharedHitBlocks: sharedHit,
      sharedReadBlocks: sharedRead,
      rawPlan: JSON.stringify(planData, null, 2),
    };
  }
}
`,
      quiz: [
        {
          id: 'c5-l3-q1',
          question: 'Trong kết quả của lệnh EXPLAIN (ANALYZE, BUFFERS), thông số "Buffers: shared hit=120 read=5" cung cấp thông tin kỹ thuật gì?',
          options: [
            'Hệ thống đã đọc một trăm hai mươi block từ trong RAM và chỉ phải đọc năm block từ ổ đĩa cứng vật lý.',
            'Hệ thống đã tìm thấy một trăm hai mươi bản ghi trùng khớp và loại bỏ năm bản ghi bị lỗi định dạng dữ liệu.',
            'Hệ thống đã sử dụng một trăm hai mươi luồng worker song song và gửi năm gói tin phản hồi về cho client.',
            'Hệ thống đã thực hiện khóa một trăm hai mươi hàng trong bảng và giải phóng năm kết nối nhàn rỗi trong pool.'
          ],
          correctIndex: 0,
          explanation: 'Chỉ số Buffers trong PostgreSQL phản ánh chính xác hoạt động của bộ nhớ: "shared hit=120" nghĩa là 120 blocks (mỗi block 8KB, tương đương 960KB) đã có sẵn trong Shared Buffers (RAM). "read=5" nghĩa là 5 blocks (40KB) chưa có trong cache và buộc hệ điều hành phải đọc trực tiếp từ ổ cứng.'
        },
        {
          id: 'c5-l3-q2',
          question: 'Vì sao một câu lệnh truy vấn có mệnh đề WHERE trên cột đã được đánh Index B-Tree nhưng Query Optimizer vẫn quyết định chọn Sequential Scan?',
          options: [
            'Vì tập dữ liệu thỏa mãn điều kiện lọc chiếm tỉ lệ phần trăm lớn trong bảng khiến việc đọc tuần tự nhanh hơn đọc ngẫu nhiên.',
            'Vì PostgreSQL không cho phép sử dụng chỉ mục đối với các bảng dữ liệu có chứa các trường kiểu văn bản text.',
            'Vì các chỉ mục B-Tree chỉ hoạt động khi câu lệnh SQL có đính kèm thêm mệnh đề sắp xếp bắt buộc ORDER BY.',
            'Vì hệ điều hành Linux tự động vô hiệu hóa việc tra cứu chỉ mục nếu dung lượng pin của máy chủ giảm xuống dưới một nửa.'
          ],
          correctIndex: 0,
          explanation: 'Nếu một câu query lấy ra lượng dòng lớn (thường > 15-20% tổng số bản ghi của bảng), việc dùng Index Scan sẽ buộc đầu đọc ổ đĩa phải nhảy ngẫu nhiên (Random I/O) hàng nghìn lần sang Heap Pages. Trong trường hợp này, quét tuần tự toàn bộ bảng (Sequential Read) tận dụng tốc độ đọc liên tục của ổ cứng lại nhanh hơn rất nhiều.'
        },
        {
          id: 'c5-l3-q3',
          question: 'Cơ chế hoạt động của Bitmap Index Scan trong PostgreSQL giải quyết nhược điểm nào của phương thức Index Scan truyền thống?',
          options: [
            'Nó xây dựng một bản đồ bit các con trỏ trang trong RAM để sắp xếp lại thứ tự đọc đĩa theo tuần tự vật lý tránh nhảy lộn xộn.',
            'Nó tự động mã hóa toàn bộ hình ảnh đại diện của người dùng thành các tệp nhị phân siêu nhỏ trước khi gửi qua mạng.',
            'Nó loại bỏ hoàn toàn nhu cầu sử dụng bộ nhớ chia sẻ Shared Buffers giúp giải phóng tài nguyên cho hệ điều hành.',
            'Nó cho phép thực thi câu lệnh SQL mà không cần thiết lập kết nối TCP đến cơ sở dữ liệu quan hệ trung tâm.'
          ],
          correctIndex: 0,
          explanation: 'Index Scan thông thường lấy từng ctid rồi lập tức truy cập ngay vào Heap Table (Random I/O). Bitmap Index Scan tối ưu hơn: Nó duyệt qua Index trước, đánh dấu các vị trí cần đọc vào một mảng Bitmap trong RAM, sắp xếp các vị trí này theo đúng thứ tự vật lý của các Page trên ổ đĩa, rồi mới tiến hành đọc Heap Table tuần tự, giảm thiểu tối đa hiện tượng nhảy đầu đọc ngẫu nhiên.'
        },
        {
          id: 'c5-l3-q4',
          question: 'Khi quan sát thấy dòng chữ "Sort Method: external merge Disk" trong kết quả EXPLAIN ANALYZE, giải pháp tối ưu hệ thống chuẩn nhất là gì?',
          options: [
            'Tăng giá trị tham số cấu hình work_mem để thuật toán sắp xếp có đủ dung lượng RAM thực thi mà không phải ghi tệp tạm ra đĩa.',
            'Xóa bỏ toàn bộ các bản ghi lịch sử trong bảng để giảm bớt số lượng dòng cần xử lý trong tương lai của cơ sở dữ liệu.',
            'Thay thế câu lệnh sắp xếp ORDER BY bằng một vòng lặp đồng bộ bên trong mã nguồn JavaScript của máy chủ NestJS.',
            'Chuyển toàn bộ cơ sở dữ liệu sang định dạng tệp tin văn bản thuần túy để hệ điều hành tự động sắp xếp nhanh hơn.'
          ],
          correctIndex: 0,
          explanation: '"Sort Method: external merge Disk" là dấu hiệu cho thấy dung lượng bộ nhớ được cấp phát cho phép toán sắp xếp (tham số work_mem) nhỏ hơn kích thước dữ liệu cần sort. Do đó, PostgreSQL buộc phải tạo các tệp tạm trên ổ cứng (Disk Spill) để chia nhỏ và merge sort, làm tốc độ chậm đi hàng chục lần. Tăng work_mem sẽ giúp sort hoàn toàn trong RAM.'
        }
      ],
      codeChallenge: {
        id: 'c5-l3-c1',
        title: 'Phân Tích Báo Cáo Chi Phí Query (Query Plan Cost Analyzer)',
        description: 'Hiện thực hàm \`analyzePlanCosts(planString: string): { startupCost: number; totalCost: number; isHighCost: boolean }\`. Chuỗi đầu vào có dạng \`"-> Seq Scan on orders (cost=10.50..450.80 rows=100 width=32)"\`. Trích xuất \`startupCost\` (số trước hai dấu chấm), \`totalCost\` (số sau hai dấu chấm). Trả về \`isHighCost: true\` nếu \`totalCost > 100\`, ngược lại trả về \`false\`.',
        starterCode: `
export function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  // TODO: Trích xuất chỉ số chi phí từ chuỗi kết quả EXPLAIN
  return { startupCost: 0, totalCost: 0, isHighCost: false };
}
`,
        solution: `
export function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  const match = planString.match(/cost=([0-9.]+)\.\.([0-9.]+)/);
  if (!match) {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }

  const startupCost = parseFloat(match[1]);
  const totalCost = parseFloat(match[2]);
  const isHighCost = totalCost > 100;

  return {
    startupCost,
    totalCost,
    isHighCost,
  };
}
`,
        testCases: [
          {
            name: 'Phân tích câu query có chi phí thấp',
            input: ['-> Index Scan on users (cost=0.28..8.30 rows=1 width=64)'],
            expected: { startupCost: 0.28, totalCost: 8.30, isHighCost: false }
          },
          {
            name: 'Phân tích câu query có chi phí cao vượt ngưỡng 100',
            input: ['-> Seq Scan on large_table (cost=10.50..580.40 rows=5000 width=128)'],
            expected: { startupCost: 10.50, totalCost: 580.40, isHighCost: true }
          }
        ]
      }
    }
  ]
};
