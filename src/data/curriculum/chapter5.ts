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
# 1. BỐI CẢNH KỸ THUẬT: CẤU TRÚC LƯU TRỮ VẬT LÝ TRÊN ĐĨA CỦA POSTGRESQL & BẢO ĐẢM TÍNH BỀN VỮNG DURABILITY VỚI WAL (ARCHITECTURAL CONTEXT & ACID DURABILITY)

Hiệu năng và độ tin cậy của một hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) cấp doanh nghiệp phụ thuộc trực tiếp vào cách nó quản lý tầng vật lý giữa bộ nhớ RAM và ổ đĩa lưu trữ (Disk I/O Subsystem):
* **Nút thắt cổ chai của Random Disk I/O:** Trong các bảng dữ liệu hàng chục triệu dòng, mỗi thao tác INSERT, UPDATE hay DELETE nếu thực hiện ghi trực tiếp xuống các khối tệp tin phân tán trên đĩa sẽ gây ra hàng nghìn thao tác đọc/ghi ngẫu nhiên (Random Disk I/O). Đây là tác vụ có độ trễ cực cao (tính bằng mili giây trên HDD và micro giây trên NVMe SSD), nhanh chóng làm nghẽn kênh truyền I/O của hệ thống và giới hạn thông lượng ở mức vài trăm giao dịch/giây.
* **Kiến trúc Khối 8KB Slotted Page:** PostgreSQL không tổ chức dữ liệu thành các tệp tin văn bản tuyến tính mà phân mảnh toàn bộ bảng dữ liệu thành các khối nhị phân cố định có kích thước chuẩn **8 Kilobytes (8,192 bytes)** gọi là **Page (hoặc Block)**. Để hỗ trợ các bản ghi có chiều dài khả biến (Variable-length Records như \`VARCHAR\`, \`JSONB\`) và việc xóa/sửa bản ghi mà không để lại các lỗ hổng phân mảnh, PostgreSQL sử dụng kiến trúc **Slotted Page**:
  - Mảng con trỏ dòng (\`Line Pointers\` / \`ItemIds\`) được cấp phát tuần tự từ đầu trang chạy xuống dưới.
  - Dữ liệu bản ghi thực tế (\`Heap Tuples\`) được nhồi từ đáy trang chạy ngược lên trên.
  - Vùng nhớ trống (\`Free Space\`) nằm ở giữa sẽ co hẹp dần khi có dữ liệu mới và tự động mở rộng khi dữ liệu cũ được dọn dẹp bởi tiến trình VACUUM.
* **Cơ chế Write-Ahead Logging (WAL) & Tính Bền vững ACID:** Để đảm bảo tính bền vững (Durability) mà vẫn đạt thông lượng hàng chục nghìn giao dịch mỗi giây (TPS):
  - Khi một giao dịch thực hiện sửa đổi, PostgreSQL **không ghi đè ngay xuống Data File trên đĩa**. Dòng dữ liệu được sửa đổi trực tiếp trên bộ nhớ RAM đệm (**\`Shared Buffers\`**) và biến trang đó thành một **"Dirty Page"** (Trang bẩn).
  - Đồng thời, toàn bộ nhật ký thay đổi nhị phân tối giản được ghi tuần tự vào tệp nhật ký ghi trước (**\`Write-Ahead Log - WAL\`**) theo cơ chế **Append-only Sequential Write** và được gọi lệnh đồng bộ đĩa \`fsync()\`. Ghi tuần tự trên đĩa nhanh hơn hàng nghìn lần so với ghi ngẫu nhiên.
  - Ngay sau khi WAL được ghi xuống đĩa, hệ thống thông báo COMMIT thành công cho Client!
* **Tiến trình Checkpoint & Khả năng Phục hồi sau Sự cố (Crash Recovery):**
  - Định kỳ (theo \`checkpoint_timeout\` hoặc khi dung lượng WAL vượt \`max_wal_size\`), tiến trình **Checkpointer** sẽ chạy ngầm quét toàn bộ \`Shared Buffers\` và xả (flush) các Dirty Pages xuống tệp tin dữ liệu chính thức.
  - Nếu máy chủ bị sập nguồn đột ngột (Kernel Panic, mất điện): Toàn bộ Dirty Pages trong RAM bị mất. Khi khởi động lại, PostgreSQL chỉ việc mở tệp \`global/pg_control\` để tìm mốc **Checkpoint gần nhất**, sau đó đọc các bản ghi WAL phát sinh sau mốc đó để phát lại (REDO Phase / Replay changes). Hệ thống khôi phục hoàn hảo trạng thái nhất quán $100\\%$ mà không mất một byte dữ liệu đã commit nào!

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

export interface CacheHitRecord {
  cache_hit_ratio: string;
}

export interface TableStorageRecord {
  table_name: string;
  table_size: string;
  total_size_with_indexes: string;
  total_8kb_pages: number;
}

export interface BgWriterRecord {
  checkpoints_timed: number;
  checkpoints_req: number;
  checkpoint_write_time: number;
  checkpoint_sync_time: number;
}

/**
 * ADR: PostgreSQL Storage Diagnostics & Health Indicator
 * - Giám sát chỉ số Cache Hit Ratio của Shared Buffers (tiêu chuẩn Production > 99%).
 * - Đếm số lượng 8KB Pages vật lý thực tế của các bảng để phát hiện Bloat.
 * - Kiểm tra tỷ lệ Checkpoint cưỡng bức (checkpoints_req) vs định kỳ (checkpoints_timed)
 *   để tinh chỉnh tham số max_wal_size và checkpoint_timeout tránh nghẽn I/O đĩa.
 */
@Injectable()
export class PostgresStorageMetricsService {
  private readonly logger = new Logger(PostgresStorageMetricsService.name);

  constructor(private readonly dataSource: DataSource) {}

  public async getEngineDiagnostics(): Promise<{
    cacheHitRatio: number;
    walActivity: BgWriterRecord | undefined;
    topTableSizes: TableStorageRecord[];
  }> {
    const cacheResult = await this.dataSource.query<CacheHitRecord[]>(\`
      SELECT 
        sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 0.0001) * 100 AS cache_hit_ratio
      FROM pg_statio_user_tables;
    \`);

    const tableSizes = await this.dataSource.query<TableStorageRecord[]>(\`
      SELECT 
        relname AS table_name,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size_with_indexes,
        relpages AS total_8kb_pages
      FROM pg_stat_user_tables
      ORDER BY pg_relation_size(relid) DESC
      LIMIT 5;
    \`);

    const walStats = await this.dataSource.query<BgWriterRecord[]>(\`
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
            'Để tận dụng tối đa vùng nhớ trống ở giữa và cho phép kích thước của các dòng bản ghi có độ dài co giãn linh hoạt mà không gây phân mảnh bộ nhớ tĩnh.',
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
            'Tự động nén tất cả các hình ảnh và tệp tin đa phương tiện xuống dung lượng bằng không trước khi lưu trữ.',
            'Cho phép cơ sở dữ liệu bỏ qua việc kiểm tra các ràng buộc khóa ngoại và tính toàn vẹn của dữ liệu quan hệ.',
            'Chuyển các thao tác ghi ngẫu nhiên (Random I/O) trên các Data Pages thành các thao tác ghi tuần tự liên tục (Append-only Sequential Write) vào tệp log nhật ký, cho phép xác nhận COMMIT ngay khi WAL fsync thành công.',
            'Tự động sao lưu toàn bộ cơ sở dữ liệu lên các máy chủ điện toán đám mây từ xa theo thời gian thực.'
          ],
          correctIndex: 2,
          explanation: 'Ghi ngẫu nhiên (Random I/O) vào các tệp dữ liệu phân tán trên đĩa rất chậm. WAL giải quyết bài toán này bằng cách chỉ ghi tuần tự (Sequential Append-only) vào tệp tin nhật ký. Khi tệp nhật ký được ghi xuống đĩa thành công, transaction được coi là đã hoàn tất (commit), còn việc cập nhật các Data Page phức tạp được hoãn lại cho tiến trình Checkpoint.'
        },
        {
          id: 'c5-l1-q3',
          question: 'Con trỏ vật lý ctid mang giá trị (105, 12) trong một bảng dữ liệu PostgreSQL biểu thị ý nghĩa kỹ thuật chính xác là gì?',
          options: [
            'Bản ghi có khóa chính ID bằng 105 và đã trải qua mười hai lần cập nhật trạng thái giao dịch trong ngày.',
            'Bản ghi nằm ở Page thứ 105 của tệp dữ liệu trên đĩa và được định vị bởi Line Pointer thứ 12 bên trong Header của Page đó.',
            'Bản ghi đang được chiếm giữ bởi tiến trình máy chủ số 105 và có tổng cộng mười hai cột dữ liệu khác rỗng.',
            'Bản ghi thuộc về người dùng thứ 105 và được phân vùng trên ổ đĩa cứng thể rắn thứ mười hai của cụm máy chủ.'
          ],
          correctIndex: 1,
          explanation: 'ctid (Current Tuple ID) là con trỏ địa chỉ vật lý nội bộ của PostgreSQL có dạng (block_number, tuple_index). Giá trị (105, 12) chỉ ra rằng dòng bản ghi này nằm ở Page thứ 105 của bảng trên ổ đĩa và tương ứng với chỉ mục con trỏ số 12 bên trong Page đó.'
        },
        {
          id: 'c5-l1-q4',
          question: 'Nếu cấu hình max_wal_size quá nhỏ trên một cơ sở dữ liệu có cường độ ghi cao (Heavy Write Traffic), điều gì sẽ xảy ra?',
          options: [
            'Cơ sở dữ liệu sẽ tự động từ chối tất cả các câu lệnh SELECT đọc dữ liệu để ưu tiên tài nguyên cho việc giải phóng ổ đĩa.',
            'Toàn bộ các tệp tin nhật ký giao dịch cũ sẽ bị xóa bỏ vĩnh viễn và không thể khôi phục lại khi gặp sự cố sập nguồn.',
            'PostgreSQL sẽ tự động chuyển đổi sang mô hình cơ sở dữ liệu NoSQL dạng tài liệu để tránh ghi nhật ký đĩa cứng.',
            'Tiến trình Checkpoint sẽ bị kích hoạt dồn dập liên tục (checkpoints occurring too frequently), ép máy chủ phải xả Dirty Pages ra đĩa không ngừng nghỉ, gây nghẽn băng thông I/O (Disk I/O Spikes) làm sụt giảm nghiêm trọng hiệu năng toàn hệ thống.'
          ],
          correctIndex: 3,
          explanation: 'Khi lượng dữ liệu WAL phát sinh vượt quá ngưỡng max_wal_size, PostgreSQL buộc phải kích hoạt Checkpoint sớm hơn dự kiến. Nếu tham số này quá nhỏ, Checkpoint sẽ diễn ra dồn dập liên tục, buộc server phải xả Dirty Pages ra đĩa không ngừng nghỉ, gây nghẽn băng thông I/O (Disk I/O Spikes) làm chậm toàn bộ hệ thống.'
        },
        {
          id: 'c5-l1-q5',
          question: 'Trong kịch bản hệ thống xử lý Log hoặc Dữ liệu cảm biến IoT với lưu lượng cực lớn, việc thiết lập tham số synchronous_commit = off mang lại đánh đổi kỹ thuật nào?',
          options: [
            'Tăng tính bảo mật chống tấn công SQL Injection nhưng làm giảm 50% thông lượng CPU.',
            'Tăng vọt thông lượng ghi giao dịch lên gấp 10 lần (>30,000 TPS) do không phải chờ lệnh fsync() đĩa ở mỗi commit, nhưng chấp nhận rủi ro có thể mất vài trăm mili-giây dữ liệu đã commit gần nhất nếu máy chủ sập nguồn đột ngột.',
            'Làm cho cơ sở dữ liệu tự động chuyển dữ liệu sang bảng nháp RAM và không bao giờ ghi xuống đĩa.',
            'Ngăn chặn mọi tiến trình khác đọc dữ liệu trong suốt thời gian giao dịch đang diễn ra.'
          ],
          correctIndex: 1,
          explanation: 'Khi synchronous_commit = off, PostgreSQL báo thành công cho client ngay khi WAL được ghi vào WAL Buffer trong RAM mà không cần đợi lệnh fsync() xuống đĩa cứng hoàn tất. Điều này tăng vọt TPS nhưng chấp nhận cửa sổ rủi ro mất mát dữ liệu nhỏ (bằng wal_writer_delay, thường là 200ms) nếu hệ thống mất điện bất ngờ.'
        },
        {
          id: 'c5-l1-q6',
          question: 'Hai tệp tin phụ trợ Free Space Map (FSM) và Visibility Map (VM) đi kèm mỗi bảng dữ liệu trong PostgreSQL đảm nhiệm vai trò gì?',
          options: [
            'FSM theo dõi dung lượng trống còn lại của từng 8KB Page để backend worker nhanh chóng tìm trang còn chỗ chèn tuple mới; còn VM ghi nhận các Page hoàn toàn không chứa tuple đã chết (dead tuples) giúp tối ưu hóa tiến trình VACUUM và hỗ trợ Index-Only Scan.',
            'FSM dùng để mã hóa mật khẩu người dùng, còn VM dùng để hiển thị biểu đồ đồ thị trên trang quản trị pgAdmin.',
            'FSM dùng để lưu trữ các câu lệnh SQL đã biên dịch, còn VM dùng để quản lý phân quyền người dùng.',
            'Cả hai tệp tin này chỉ là bản sao lưu tạm thời và bị xóa bỏ hoàn toàn sau khi khởi động lại cơ sở dữ liệu.'
          ],
          correctIndex: 0,
          explanation: 'FSM (Free Space Map, đuôi _fsm) là cây nhị phân lưu trữ dung lượng còn trống của từng page giúp thao tác INSERT tìm chỗ nhanh mà không phải quét toàn bộ bảng. VM (Visibility Map, đuôi _vm) đánh dấu các page chỉ chứa dữ liệu nhìn thấy bởi mọi transaction, giúp Index-Only Scan không cần kiểm tra Heap Page để xác minh tính hiển thị.'
        },
        {
          id: 'c5-l1-q7',
          question: 'Quá trình Khôi phục sự cố (Crash Recovery / REDO Phase) của PostgreSQL diễn ra như thế nào khi máy chủ khởi động lại sau một sự cố sập nguồn đột ngột?',
          options: [
            'Hệ thống tự động xóa toàn bộ bảng dữ liệu và khôi phục từ bản sao lưu Dump của ngày hôm trước.',
            'PostgreSQL yêu cầu người quản trị nhập mật khẩu root để cấp quyền phục hồi dữ liệu từ bộ nhớ RAM ảo.',
            'Hệ thống mở tệp pg_control để xác định vị trí mốc Checkpoint gần nhất, sau đó đọc tuần tự toàn bộ các bản ghi nhật ký WAL phát sinh từ mốc Checkpoint đó đến thời điểm sập nguồn và áp dụng lại (replay) các thay đổi lên các Data Pages để tái thiết trạng thái nhất quán hoàn hảo.',
            'Hệ thống gửi thông báo lỗi 500 đến toàn bộ các ứng dụng kết nối và tự động chuyển sang chế độ Read-Only vĩnh viễn.'
          ],
          correctIndex: 2,
          explanation: 'Khi phục hồi sau crash, PostgreSQL dựa vào vị trí REDO LSN được ghi trong file global/pg_control tại mốc checkpoint gần nhất. Nó quét các bản ghi WAL từ điểm đó trở đi và phát lại (replay) toàn bộ thay đổi lên các Data Page, bảo đảm tính bền vững (Durability) của các giao dịch đã commit.'
        },
        {
          id: 'c5-l1-q8',
          question: 'Một Heap Tuple Header trong PostgreSQL chiếm dung lượng cố định 23 bytes nhằm mục đích kỹ thuật trọng yếu nào?',
          options: [
            'Lưu trữ khóa công khai RSA của bảng để mã hóa dữ liệu hàng.',
            'Chứa tên đăng nhập của lập trình viên đã tạo ra dòng bản ghi đó.',
            'Ghi nhận địa chỉ IP của client đã gửi câu lệnh INSERT đến cơ sở dữ liệu.',
            'Lưu trữ các trường metadata phục vụ cơ chế kiểm soát đồng thời đa phiên bản MVCC bao gồm xmin (Transaction ID tạo dòng), xmax (Transaction ID xóa/sửa dòng), t_ctid (con trỏ trỏ tới phiên bản kế tiếp) và infomask cờ trạng thái.'
          ],
          correctIndex: 3,
          explanation: 'Tuple Header (HeapTupleHeaderData) chiếm 23 bytes (hoặc 24 bytes do căn lề), chứa xmin, xmax, t_cid, t_ctid, và t_infomask. Đây là nền tảng cốt lõi của PostgreSQL MVCC: xmin xác định transaction nào chèn bản ghi, xmax xác định transaction nào xóa/update bản ghi, giúp các transaction đọc dữ liệu nhất quán không bị xung đột khóa.'
        }
      ],
      codeChallenge: {
        id: 'c5-l1-c1',
        title: 'Mô Phỏng Slotted Page Free Space Calculator',
        description: 'Hiện thực hàm \`calculateFreeSpace(pageSize: number, linePointerCount: number, tupleSizes: number[]): number\`. Cấu trúc Page chuẩn PostgreSQL gồm: Page Header cố định 24 bytes; mỗi Line Pointer chiếm 4 bytes; mỗi Tuple chiếm dung lượng tương ứng trong mảng \`tupleSizes\`. Trả về số byte trống còn lại trong Page. Nếu tổng kích thước vượt quá \`pageSize\` hoặc \`pageSize <= 0\`, trả về \`0\` (đã đầy hoặc không hợp lệ).',
        starterCode: `export function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  // TODO: Tính toán dung lượng Free Space còn lại trong một Page 8KB
  return 0;
}`,
        solution: `export function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  if (pageSize <= 0 || linePointerCount < 0) {
    return 0;
  }

  const HEADER_SIZE = 24;
  const LINE_POINTER_SIZE = 4;

  const totalLinePointersSize = linePointerCount * LINE_POINTER_SIZE;
  const totalTuplesSize = Array.isArray(tupleSizes)
    ? tupleSizes.reduce((acc, curr) => acc + (curr > 0 ? curr : 0), 0)
    : 0;

  const usedSpace = HEADER_SIZE + totalLinePointersSize + totalTuplesSize;

  if (usedSpace >= pageSize) {
    return 0;
  }

  return pageSize - usedSpace;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Tính toán Page 8192 bytes với 2 line pointers và 2 tuples (100b, 200b)',
            input: [8192, 2, [100, 200]],
            expected: 8192 - (24 + 8 + 300), // 7860
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Page bị tràn dung lượng',
            input: [500, 10, [300, 200]],
            expected: 0,
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Page rỗng chưa có tuple hay pointer nào',
            input: [8192, 0, []],
            expected: 8192 - 24, // 8168
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Page dung lượng vừa khớp tổng kích thước header + pointer + tuple',
            input: [128, 1, [100]],
            expected: 0, // 128 - (24 + 4 + 100) = 0
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Mảng tuple rỗng nhưng có 5 line pointers',
            input: [8192, 5, []],
            expected: 8192 - (24 + 20), // 8148
            hidden: true
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
# 1. BỐI CẢNH KỸ THUẬT: TỐI ƯU HÓA TRUY VẤN VỚI CẤU TRÚC $B^+$-TREE INDEX & ĐÁNH ĐỔI HIỆU NĂNG GHI (ARCHITECTURAL CONTEXT & DISK I/O OVERHEAD)

Trong thiết kế hệ thống dữ liệu, chỉ mục (Index) là công cụ cơ bản nhất để chuyển đổi độ phức tạp tìm kiếm từ Quét Toàn Bảng (Sequential Scan - $O(N)$ Disk I/O) sang Duyệt Cây Chỉ Mục ($O(\\log N)$). Tuy nhiên, việc lạm dụng Index mà không hiểu bản chất cấu trúc lưu trữ sẽ làm tê liệt hiệu năng ghi của hệ thống:
* **Tại sao RDBMS sử dụng $B^+$-Tree thay vì Cây Nhị Phân Cân Bằng (AVL / Red-Black Tree)?**
  - Cây nhị phân có hệ số rẽ nhánh (Fan-out) chỉ bằng 2. Với 10 triệu bản ghi, độ sâu của cây nhị phân lên tới $\\approx 24$ tầng. Mỗi lần tìm kiếm đòi hỏi 24 lần nhảy đĩa ngẫu nhiên (Random Disk Lookups).
  - Ngược lại, **$B^+$-Tree** là cây đa phân tự cân bằng (Multi-way Balanced Tree) được thiết kế riêng biệt để khớp hoàn hảo với kích thước khối đĩa 8KB. Mỗi Node 8KB có thể chứa hàng trăm khóa (Fan-out từ $100$ đến $300$). Nhờ đó, với 10 triệu bản ghi, độ sâu của cây $B^+$-Tree chỉ từ **3 đến 4 tầng**! Toàn bộ các tầng trên (Root & Internal Nodes) thường được nằm trọn trong RAM (\`Shared Buffers\`), giúp việc tìm kiếm chỉ tiêu tốn đúng 1 lần đọc đĩa duy nhất tại Leaf Node!
* **Bản chất của Hiện tượng B-Tree Page Split (Vỡ trang chỉ mục):**
  - Mỗi Leaf Node trong $B^+$-Tree là một trang 8KB cố định, lưu trữ các khóa theo thứ tự sắp xếp tăng dần.
  - Khi chèn một khóa mới vào một trang đã kín dung lượng ($100\\%$ Full), PostgreSQL không thể mở rộng trang đó. Hệ thống bắt buộc phải thực hiện thao tác **Page Split**:
    1. Cấp phát một trang 8KB mới trên đĩa.
    2. Di chuyển $50\\%$ số khóa từ trang cũ sang trang mới.
    3. Chèn khóa mới vào đúng vị trí logic.
    4. Cập nhật con trỏ danh sách liên kết đôi (Doubly-Linked List) giữa các trang lá.
    5. Đẩy (Promote) khóa phân chia lên Node cha (Internal Node) - nếu Node cha cũng đầy, Page Split sẽ lan truyền ngược lên trên (Cascading Split)!
  - **Hệ quả trên Production:** Thao tác Page Split làm phát sinh thêm các lệnh ghi đĩa ngẫu nhiên, sinh thêm các bản ghi nhật ký WAL khổng lồ (Full Page Image), và để lại các trang chỉ mục bị rỗng $50\\%$ gây lãng phí bộ nhớ đệm RAM (**Hiện tượng Index Bloat**). Đây chính là lý do vì sao việc dùng UUID v4 ngẫu nhiên làm Primary Key là thảm họa đối với các hệ thống ghi thông lượng lớn!

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

/**
 * ADR: Zero-Downtime High-Throughput Indexing Migration
 * 1. Partial Index (idx_orders_unprocessed):
 *    - Chỉ index các đơn hàng có status là PENDING hoặc PROCESSING (chiếm ~1% bảng).
 *    - Tiết kiệm 99% dung lượng bộ nhớ Index trong RAM, không làm chậm thao tác ghi đơn COMPLETED.
 * 2. Covering Index (idx_users_lookup_covering):
 *    - Index trên cặp khóa phân vùng (tenant_id, email).
 *    - INCLUDE các trường payload (first_name, last_name, is_active) ở Leaf Nodes.
 *    - Kích hoạt trạng thái Index-Only Scan (0 Heap Lookups), tăng tốc độ xác thực auth lên 10x.
 * 3. CREATE INDEX CONCURRENTLY:
 *    - Bắt buộc trên Production để tránh SHARE lock làm tê liệt thao tác ghi dữ liệu.
 */
export class OptimizeHighThroughputIndexing1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_unprocessed
      ON orders (created_at ASC)
      WHERE status IN ('PENDING', 'PROCESSING');
    \`);

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
            'Khi hai tiến trình cùng cố gắng đọc một trang dữ liệu khiến cho hệ điều hành phải chia sẻ xung nhịp xử lý của CPU.',
            'Khi người dùng thực hiện câu lệnh xóa chỉ mục khiến cho bảng dữ liệu phải phân chia lại các cột khóa ngoại.',
            'Khi một trang lá B-Tree 8KB bị đầy (100% Full) và cần chèn thêm khóa mới, hệ thống buộc phải cấp phát một trang mới, di chuyển 50% số khóa sang trang mới, cập nhật con trỏ danh sách liên kết đôi và đẩy khóa phân chia lên Node cha; thao tác này gây ra hàng loạt các đợt Random Disk I/O, phình to dung lượng WAL và gây phân mảnh index (Index Bloat).',
            'Khi cơ sở dữ liệu tự động xóa các bản ghi hết hạn làm cho kích thước của tệp tin bị co hẹp đột ngột trên hệ điều hành.'
          ],
          correctIndex: 2,
          explanation: 'B-Tree Page Split xảy ra khi một Node/Page trong cây chỉ mục không còn đủ khoảng trống để chứa thêm một phần tử mới. Hệ thống bắt buộc phải cấp phát một Page mới, chuyển 50% dữ liệu sang đó, chèn bản ghi mới và cập nhật lại con trỏ ở Node cha. Quá trình này tiêu tốn nhiều Disk I/O ngẫu nhiên và làm tăng độ phân mảnh của Index.'
        },
        {
          id: 'c5-l2-q2',
          question: 'Tính năng "Covering Index" với mệnh đề INCLUDE trong PostgreSQL mang lại lợi thế vượt trội nào so với một Composite Index thông thường?',
          options: [
            'Cho phép thực thi Index-Only Scan (0 Heap Lookups) mà không làm phình to các tầng Root và Internal Nodes của cây B-Tree, bởi các cột trong mệnh đề INCLUDE chỉ được lưu ở Leaf Pages và không tham gia vào cấu trúc sắp xếp của cây.',
            'Tự động sao lưu toàn bộ các cột trong bảng sang một máy chủ dự phòng mà không tốn băng thông đường truyền mạng.',
            'Bắt buộc cơ sở dữ liệu phải lưu trữ toàn bộ các cột được chỉ định trong bộ nhớ đệm CPU L1 để truy xuất tức thì.',
            'Cho phép sử dụng các hàm toán học phức tạp như căn bậc hai hoặc lượng giác ngay bên trong cấu trúc của khóa chính.'
          ],
          correctIndex: 0,
          explanation: 'Với Covering Index (sử dụng từ khóa INCLUDE), các cột phụ chỉ được đính kèm tại các Leaf Pages dưới đáy cùng để phục vụ việc đọc dữ liệu (payload), chứ không hề tham gia vào cấu trúc sắp xếp của các tầng Root và Internal Nodes. Điều này giúp kích thước cây tìm kiếm nhỏ gọn, vừa đạt được Index Only Scan vừa không làm nặng cây.'
        },
        {
          id: 'c5-l2-q3',
          question: 'Trong trường hợp nào sau đây việc tạo một Partial Index (Chỉ mục bộ phận với mệnh đề WHERE) là giải pháp tối ưu vượt bậc về cả dung lượng đĩa lẫn tốc độ ghi?',
          options: [
            'Khi bảng dữ liệu có số lượng dòng rất ít dưới một trăm bản ghi và thường xuyên được đọc toàn bộ vào bộ nhớ RAM.',
            'Khi muốn tạo một chỉ mục bao quát toàn bộ các cột của bảng để phục vụ cho mọi câu lệnh tìm kiếm có thể có.',
            'Khi cơ sở dữ liệu đang chạy trên hệ thống tệp tin mạng và không hỗ trợ các tính năng khóa hàng của giao dịch.',
            'Khi hệ thống thường xuyên truy vấn một tập con dữ liệu chiếm tỉ lệ rất nhỏ và có tính chọn lọc cao trong bảng (ví dụ: các đơn hàng lỗi WHERE status = "FAILED" chỉ chiếm 1% trong 10 triệu dòng); giúp Index siêu nhỏ gọn nằm trọn trong RAM và không làm chậm thao tác chèn các đơn hàng thành công thông thường.'
          ],
          correctIndex: 3,
          explanation: 'Partial Index sử dụng mệnh đề WHERE khi tạo index (ví dụ: WHERE status = "FAILED"). Nếu trong 10 triệu đơn hàng chỉ có 10,000 đơn bị lỗi, Partial Index chỉ lưu 10,000 mục này, giúp kích thước index siêu nhỏ, nằm gọn trong RAM, và các thao tác INSERT đơn hàng thành công thông thường không hề bị chậm vì không phải cập nhật index này.'
        },
        {
          id: 'c5-l2-q4',
          question: 'Vì sao việc sử dụng UUID v4 ngẫu nhiên làm Khóa chính (Primary Key Clustered/B-Tree) lại là một nguyên nhân hàng đầu gây sụt giảm nghiêm trọng hiệu năng ghi dữ liệu ở quy mô lớn?',
          options: [
            'Vì chuỗi ký tự UUID v4 không thể chuyển đổi thành các con số nhị phân để lưu trữ trên đĩa cứng thể rắn hiện đại.',
            'Vì tính chất ngẫu nhiên phân tán của UUID v4 khiến mỗi bản ghi mới được chèn rải rác vào giữa các trang bất kỳ trên toàn bộ cây B-Tree, liên tục kích hoạt hiện tượng Page Splits, gây phân mảnh ổ đĩa và phá vỡ cơ chế đệm cache của Buffer Pool; trái ngược với BIGINT tự tăng hoặc UUID v7 chèn tuần tự vào cuối trang lá ngoài cùng.',
            'Vì các thuật toán băm của cơ sở dữ liệu từ chối tiếp nhận các giá trị có chứa dấu gạch ngang phân cách theo quy chuẩn RFC.',
            'Vì hệ quản trị cơ sở dữ liệu PostgreSQL chỉ cho phép tối đa một nghìn giá trị UUID ngẫu nhiên tồn tại trong một bảng.'
          ],
          correctIndex: 1,
          explanation: 'B-Tree sắp xếp các khóa theo thứ tự liên tục. Khi dùng BigInt tự tăng hoặc UUID v7 (Time-based), các bản ghi mới luôn được chèn tuần tự vào cuối trang lá cuối cùng (Right-most leaf). Ngược lại, UUID v4 hoàn toàn ngẫu nhiên sẽ chèn rải rác vào giữa bất kỳ trang nào trong hàng triệu trang của cây, liên tục gây vỡ trang (Page Splits) và xới tung bộ nhớ đệm Buffer Pool.'
        },
        {
          id: 'c5-l2-q5',
          question: 'Vì sao các hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) lại ưu tiên sử dụng cấu trúc cây B+ Tree thay vì Cây nhị phân cân bằng (như AVL Tree hay Red-Black Tree) để tổ chức chỉ mục lưu trữ trên đĩa?',
          options: [
            'Vì Cây nhị phân có hệ số rẽ nhánh (Fan-out) chỉ bằng 2 khiến độ sâu của cây lên tới 20-30 tầng cho 10 triệu bản ghi, đòi hỏi hàng chục lần đọc đĩa ngẫu nhiên; trong khi B+ Tree có Fan-out lớn (100-300) khớp với kích thước 8KB Block, chỉ cần độ sâu 3-4 tầng là quản lý được hàng triệu bản ghi, giảm thiểu tối đa số lần Disk I/O.',
            'Vì Cây nhị phân chỉ lưu trữ được số nguyên mà không hỗ trợ các chuỗi ký tự UTF-8.',
            'Vì thuật toán cây nhị phân đã bị hết hạn bản quyền phần mềm mã nguồn mở từ năm 1995.',
            'Vì các hệ điều hành 64-bit hiện đại không hỗ trợ con trỏ nhị phân trên bộ nhớ RAM.'
          ],
          correctIndex: 0,
          explanation: 'Mỗi lần nhảy node trong cây là một lần đọc đĩa tiềm tàng nếu node đó không có trong cache. Cây nhị phân có độ sâu quá lớn (O(log2 N)), trong khi B+ Tree với Fan-out lớn (O(log_B N) với B=100-300) chỉ có độ sâu 3-4 tầng, giúp việc tìm kiếm chỉ tốn tối đa 1 lần đọc đĩa ở tầng lá (vì Root và Internal nodes luôn được cache trong RAM).'
        },
        {
          id: 'c5-l2-q6',
          question: 'Cấu trúc Danh sách liên kết đôi (Doubly-Linked List) kết nối giữa các Leaf Nodes ở đáy cây B+ Tree mang lại ưu thế đột phá nào cho các câu truy vấn cơ sở dữ liệu?',
          options: [
            'Cho phép xóa toàn bộ bảng dữ liệu trong thời gian O(1) mà không ghi nhật ký WAL.',
            'Tự động sao lưu dữ liệu sang máy chủ đám mây mỗi khi có một Node bị hỏng.',
            'Tối ưu hóa các câu truy vấn khoảng giá trị (Range Queries như BETWEEN, >, <): sau khi tìm kiếm nhị phân đến Leaf Page chứa giá trị cận dưới, cơ sở dữ liệu chỉ việc duyệt ngang tuần tự qua các con trỏ trang kế tiếp mà không bao giờ phải leo ngược lên các tầng trên của cây.',
            'Ngăn chặn tuyệt đối các cuộc tấn công DDoS vào cổng kết nối PostgreSQL.'
          ],
          correctIndex: 2,
          explanation: 'Nhờ các con trỏ liên kết đôi trỏ giữa các Leaf Page liền kề, một câu query tìm khoảng giá trị (ví dụ: WHERE amount BETWEEN 100 AND 500) chỉ cần tìm kiếm từ gốc xuống giá trị 100 một lần duy nhất, sau đó đi bộ ngang qua danh sách liên kết cho tới giá trị 500 với tốc độ quét tuần tự cực nhanh.'
        },
        {
          id: 'c5-l2-q7',
          question: 'Điều kiện tiên quyết nào phải được thỏa mãn để PostgreSQL có thể kích hoạt thành công chế độ quét Index-Only Scan thay vì phải quay về Index Scan thông thường?',
          options: [
            'Toàn bộ bảng dữ liệu phải có dung lượng nhỏ hơn 100 Megabytes.',
            'Mọi cột dữ liệu được câu lệnh truy vấn yêu cầu (SELECT, WHERE, ORDER BY) đều phải nằm trọn vẹn trong cấu trúc của Index, VÀ các 8KB Data Pages tương ứng phải được đánh dấu là "All-Visible" trong Visibility Map (chứng minh không có dead tuples chưa được dọn dẹp bởi VACUUM).',
            'Bảng dữ liệu bắt buộc phải không có bất kỳ khóa ngoại (Foreign Key) nào.',
            'Người thực thi câu truy vấn phải sở hữu quyền quản trị tối cao SUPERUSER trên database cluster.'
          ],
          correctIndex: 1,
          explanation: 'Để đạt được Index-Only Scan thực thụ (0 lần truy cập Heap), ngoài việc Index phải chứa đủ tất cả các cột được SELECT, PostgreSQL còn phải kiểm tra Visibility Map. Nếu một page được đánh dấu là All-Visible (nghĩa là mọi tuple trên page đều nhìn thấy bởi mọi transaction hiện tại), Postgres mới có thể bỏ qua việc đọc Heap Page để kiểm tra tính hiển thị của MVCC.'
        },
        {
          id: 'c5-l2-q8',
          question: 'Tại sao trên môi trường Production đang hoạt động với lưu lượng truy cập cao, các kỹ sư Backend bắt buộc phải sử dụng câu lệnh CREATE INDEX CONCURRENTLY thay vì lệnh CREATE INDEX thông thường?',
          options: [
            'Vì CREATE INDEX thông thường sẽ tự động xóa sạch dữ liệu của các cột không liên quan.',
            'Vì câu lệnh CREATE INDEX CONCURRENTLY sẽ ép buộc cơ sở dữ liệu nén dữ liệu bằng thuật toán gzip.',
            'Vì lệnh CREATE INDEX thông thường sẽ kích hoạt sự kiện crash hệ thống nếu có hơn 10 kết nối cùng lúc.',
            'Vì lệnh CREATE INDEX tiêu chuẩn sẽ chiếm giữ khóa độc quyền SHARE LOCK trên bảng, chặn đứng toàn bộ các thao tác ghi (INSERT, UPDATE, DELETE) của người dùng cho tới khi index tạo xong (có thể mất nhiều giờ); trong khi CONCURRENTLY tạo index qua 2 lượt quét ngầm mà không khóa bảng ghi, đảm bảo Zero Downtime.'
          ],
          correctIndex: 3,
          explanation: 'CREATE INDEX thông thường chiếm giữ SHARE lock, cho phép SELECT nhưng chặn đứng mọi thao tác INSERT, UPDATE, DELETE cho đến khi hoàn thành. Nếu bảng có hàng chục triệu dòng, việc tạo index có thể kéo dài hàng chục phút đến vài giờ, gây tê liệt toàn bộ ứng dụng. CONCURRENTLY tránh điều này bằng cách thực hiện 2 lượt quét không khóa ghi.'
        }
      ],
      codeChallenge: {
        id: 'c5-l2-c1',
        title: 'Mô Phỏng B-Tree Node Insertion & Page Split Detection',
        description: 'Hiện thực hàm \`insertIntoBTreeNode(currentKeys: number[], newKey: number, maxCapacity: number): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null }\`. Hàm nhận vào danh sách các khóa hiện có đã được sắp xếp tăng dần và chèn \`newKey\` vào đúng vị trí logic. Nếu số lượng sau khi chèn vượt quá \`maxCapacity\`, kích hoạt \`splitOccurred: true\`, tìm phần tử ở giữa (median index = Math.floor(len / 2)) làm \`promotedKey\`, phần còn lại chia thành \`leftKeys\` và \`rightKeys\`. Nếu không vượt ngưỡng, \`splitOccurred: false\`.',
        starterCode: `export function insertIntoBTreeNode(
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
}`,
        solution: `export function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): {
  splitOccurred: boolean;
  leftKeys: number[];
  rightKeys: number[];
  promotedKey: number | null;
} {
  const combined = Array.isArray(currentKeys) ? [...currentKeys, newKey] : [newKey];
  combined.sort((a, b) => a - b);

  if (combined.length <= maxCapacity) {
    return {
      splitOccurred: false,
      leftKeys: combined,
      rightKeys: [],
      promotedKey: null,
    };
  }

  // Vượt ngưỡng dung lượng -> Thực hiện Page Split
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
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Chèn không vượt quá dung lượng (maxCapacity = 3)',
            input: [[10, 30], 20, 3],
            expected: { splitOccurred: false, leftKeys: [10, 20, 30], rightKeys: [], promotedKey: null },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Chèn gây ra Page Split khi vượt ngưỡng 3 phần tử',
            input: [[10, 20, 40], 30, 3],
            expected: {
              splitOccurred: true,
              leftKeys: [10, 20],
              rightKeys: [40],
              promotedKey: 30
            },
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Chèn vào node rỗng ban đầu',
            input: [[], 50, 2],
            expected: { splitOccurred: false, leftKeys: [50], rightKeys: [], promotedKey: null },
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Chèn số âm và số 0 vào node gây split với maxCapacity = 4',
            input: [[-20, -10, 10, 20], 0, 4],
            expected: {
              splitOccurred: true,
              leftKeys: [-20, -10],
              rightKeys: [10, 20],
              promotedKey: 0
            },
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Chèn phần tử trùng lặp gây Page Split',
            input: [[5, 10], 10, 2],
            expected: {
              splitOccurred: true,
              leftKeys: [5],
              rightKeys: [10],
              promotedKey: 10
            },
            hidden: true
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
# 1. BỐI CẢNH KỸ THUẬT: ĐỘNG CƠ TỐI ƯU HÓA TRUY VẤN DỰA TRÊN CHI PHÍ (COST-BASED QUERY OPTIMIZER - CBO) & CHIẾN LƯỢC QUÉT DỮ LIỆU (ARCHITECTURAL CONTEXT & ACCESS PATH SELECTION)

Khi một câu lệnh SQL được gửi tới máy chủ PostgreSQL, hệ thống không thực thi nó một cách ngây thơ. Câu lệnh được đưa qua bộ phân tích cú pháp (Parser), bộ viết lại (Rewriter), và quan trọng nhất là **Bộ Tối Ưu Hóa Dựa Trên Chi Phí (Cost-Based Query Optimizer - CBO)**:
* **Bản chất của Mô hình Chi phí (Cost Model):**
  - CBO không đoán mò, nó dựa vào bảng thống kê nội bộ (\`pg_statistic\` / \`pg_stats\`) ghi nhận phân phối giá trị, tỉ lệ phần tử rỗng, số lượng phần tử phân biệt (Distinct Values) và biểu đồ tần suất (Histograms).
  - Optimizer tính toán điểm chi phí lý thuyết (\`Cost\`) cho hàng chục đường dẫn truy cập (Access Paths) khác nhau dựa trên 2 tham số vật lý then chốt:
    1. **Chi phí đọc khối đĩa:** Đọc tuần tự (\`seq_page_cost = 1.0\`) so với Đọc ngẫu nhiên (\`random_page_cost = 4.0\` trên HDD, $\\approx 1.1 - 1.5$ trên NVMe SSD).
    2. **Chi phí xử lý CPU:** Đánh giá biểu thức lọc điều kiện (\`cpu_tuple_cost = 0.01\`) và tính toán hàm so sánh (\`cpu_operator_cost = 0.0025\`).
  - Kế hoạch thực thi (Execution Plan) nào có tổng chi phí ước tính (\`Total Cost\`) thấp nhất sẽ được chọn để đưa xuống Executor.
* **Chiến lược Quét Dữ Liệu: Đánh đổi giữa Sequential Scan, Index Scan và Bitmap Scan:**
  - **Sequential Scan ($O(N)$):** Quét tuần tự toàn bộ các khối 8KB từ đầu đến cuối bảng. Tận dụng tối đa băng thông đọc đĩa tuần tự và cơ chế đọc trước của hệ điều hành (Kernel Read-Ahead Buffer). Tối ưu vượt trội khi bảng dữ liệu nhỏ (< vài nghìn dòng) hoặc câu truy vấn cần lấy một lượng lớn dữ liệu (> $15\\% - 20\\%$ tổng số dòng).
  - **Index Scan ($O(\\log N)$):** Duyệt cây $B^+$-Tree để lấy con trỏ \`ctid\`, sau đó ngay lập tức thực hiện một lệnh Random Disk I/O nhảy vào Heap Data Page để lấy dòng tương ứng. Cực kỳ tối ưu khi chỉ lấy từ 1 đến vài dòng cụ thể (Point Queries / High Cardinality). Nhưng nếu áp dụng cho hàng nghìn dòng, hàng nghìn lượt Random I/O sẽ bóp nghẹt Disk Controller!
  - **Bitmap Index Scan (Kỹ thuật Lai Đẳng Cấp):** Giải quyết tình trạng khó xử khi kết quả lọc chiếm từ $1\\%$ đến $15\\%$ bảng. Optimizer duyệt B-Tree để lấy danh sách \`ctid\`, nhưng **chưa nhảy vào đọc Heap ngay**. Nó dựng một mảng Bitmap trong RAM (mỗi bit đại diện cho một 8KB Page). Sau đó, nó sắp xếp các con trỏ theo đúng thứ tự vị trí vật lý trên đĩa cứng rồi mới thực hiện đọc một vòng tuần tự (**Sequential Heap Read**) các Page có đánh dấu bit! Tránh được $100\\%$ việc đầu đọc đĩa nhảy qua nhảy lại hỗn loạn.

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
  actualRows: number;
  rawPlan: string;
}

interface ExplainPlanNode {
  'Node Type': string;
  'Actual Rows'?: number;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  [key: string]: unknown;
}

interface ExplainResult {
  'QUERY PLAN': Array<{
    Plan: ExplainPlanNode;
    'Planning Time': number;
    'Execution Time': number;
  }>;
}

/**
 * ADR: Automated Query Plan Profiler & EXPLAIN Inspector
 * - Bóc tách kế hoạch thực thi EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) tại runtime.
 * - Phát hiện sớm các câu query bị thoái lui về Sequential Scan trên tập dữ liệu > 1,000 rows.
 * - Giám sát tỷ lệ Shared Hit Blocks vs Shared Read Blocks để đánh giá hiệu quả cache RAM.
 */
@Injectable()
export class DatabaseQueryProfilerService {
  private readonly logger = new Logger(DatabaseQueryProfilerService.name);

  constructor(private readonly dataSource: DataSource) {}

  public async profileQuery(sqlQuery: string, params: unknown[] = []): Promise<QueryPlanAnalysis> {
    const explainQuery = \`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) \${sqlQuery}\`;
    const result = await this.dataSource.query<ExplainResult[]>(explainQuery, params);

    const planData = result[0]?.['QUERY PLAN']?.[0];
    if (!planData) {
      throw new Error('FAILED_TO_PARSE_EXPLAIN_PLAN');
    }

    const planNode = planData.Plan;
    const executionTimeMs = planData['Execution Time'];
    const planningTimeMs = planData['Planning Time'];
    const nodeType = planNode['Node Type'] || '';
    const actualRows = planNode['Actual Rows'] || 0;
    const sharedHit = planNode['Shared Hit Blocks'] || 0;
    const sharedRead = planNode['Shared Read Blocks'] || 0;

    let detectedScan: QueryPlanAnalysis['scanType'] = 'Other';
    if (nodeType.includes('Seq Scan')) detectedScan = 'Seq Scan';
    else if (nodeType.includes('Index Only Scan')) detectedScan = 'Index Only Scan';
    else if (nodeType.includes('Index Scan')) detectedScan = 'Index Scan';
    else if (nodeType.includes('Bitmap')) detectedScan = 'Bitmap Scan';

    if (detectedScan === 'Seq Scan' && actualRows > 1000) {
      this.logger.warn(\`[QUERY PERF ALERT] Phát hiện Seq Scan trên tập dữ liệu lớn: \${actualRows} dòng!\`);
    }

    return {
      executionTimeMs,
      planningTimeMs,
      scanType: detectedScan,
      sharedHitBlocks: sharedHit,
      sharedReadBlocks: sharedRead,
      actualRows,
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
            'Hệ thống đã đọc 120 blocks (mỗi block 8KB, tương đương 960KB) trực tiếp từ bộ nhớ RAM đệm (Shared Buffers), và chỉ phải đọc 5 blocks (40KB) từ ổ đĩa cứng vật lý.',
            'Hệ thống đã tìm thấy một trăm hai mươi bản ghi trùng khớp và loại bỏ năm bản ghi bị lỗi định dạng dữ liệu.',
            'Hệ thống đã sử dụng một trăm hai mươi luồng worker song song và gửi năm gói tin phản hồi về cho client.',
            'Hệ thống đã thực hiện khóa một trăm hai mươi hàng trong bảng và giải phóng năm kết nối nhàn rỗi trong pool.'
          ],
          correctIndex: 0,
          explanation: 'Chỉ số Buffers trong PostgreSQL phản ánh chính xác hoạt động của bộ nhớ: "shared hit=120" nghĩa là 120 blocks (mỗi block 8KB, tương đương 960KB) đã có sẵn trong Shared Buffers (RAM). "read=5" nghĩa là 5 blocks (40KB) chưa có trong cache và buộc hệ điều hành phải đọc trực tiếp từ ổ cứng.'
        },
        {
          id: 'c5-l3-q2',
          question: 'Vì sao một câu lệnh truy vấn có mệnh đề WHERE trên cột đã được đánh Index B-Tree nhưng Query Optimizer của PostgreSQL vẫn quyết định chọn Sequential Scan?',
          options: [
            'Vì PostgreSQL không cho phép sử dụng chỉ mục đối với các bảng dữ liệu có chứa các trường kiểu văn bản text.',
            'Vì các chỉ mục B-Tree chỉ hoạt động khi câu lệnh SQL có đính kèm thêm mệnh đề sắp xếp bắt buộc ORDER BY.',
            'Vì tập dữ liệu thỏa mãn điều kiện lọc chiếm tỉ lệ phần trăm đáng kể trong bảng (thường > 15-20% tổng số bản ghi), khiến việc dùng Index Scan làm phát sinh hàng nghìn lượt Random Disk I/O nhảy vào Heap Table, chậm hơn rất nhiều so với việc quét tuần tự liên tục (Sequential Read) toàn bộ bảng.',
            'Vì hệ điều hành Linux tự động vô hiệu hóa việc tra cứu chỉ mục nếu dung lượng pin của máy chủ giảm xuống dưới một nửa.'
          ],
          correctIndex: 2,
          explanation: 'Nếu một câu query lấy ra lượng dòng lớn (thường > 15-20% tổng số bản ghi của bảng), việc dùng Index Scan sẽ buộc đầu đọc ổ đĩa phải nhảy ngẫu nhiên (Random I/O) hàng nghìn lần sang Heap Pages. Trong trường hợp này, quét tuần tự toàn bộ bảng (Sequential Read) tận dụng tốc độ đọc liên tục của ổ cứng lại nhanh hơn rất nhiều.'
        },
        {
          id: 'c5-l3-q3',
          question: 'Cơ chế hoạt động của Bitmap Index Scan trong PostgreSQL giải quyết nhược điểm nào của phương thức Index Scan truyền thống?',
          options: [
            'Nó tự động mã hóa toàn bộ hình ảnh đại diện của người dùng thành các tệp nhị phân siêu nhỏ trước khi gửi qua mạng.',
            'Nó duyệt qua Index để thu thập danh sách ctid, xây dựng một bản đồ Bitmap các con trỏ trang trong RAM, sắp xếp các vị trí này theo đúng thứ tự vật lý của các 8KB Page trên ổ đĩa, rồi mới tiến hành đọc Heap Table tuần tự, loại bỏ hiện tượng đầu đọc đĩa nhảy ngẫu nhiên lộn xộn.',
            'Nó loại bỏ hoàn toàn nhu cầu sử dụng bộ nhớ chia sẻ Shared Buffers giúp giải phóng tài nguyên cho hệ điều hành.',
            'Nó cho phép thực thi câu lệnh SQL mà không cần thiết lập kết nối TCP đến cơ sở dữ liệu quan hệ trung tâm.'
          ],
          correctIndex: 1,
          explanation: 'Index Scan thông thường lấy từng ctid rồi lập tức truy cập ngay vào Heap Table (Random I/O). Bitmap Index Scan tối ưu hơn: Nó duyệt qua Index trước, đánh dấu các vị trí cần đọc vào một mảng Bitmap trong RAM, sắp xếp các vị trí này theo đúng thứ tự vật lý của các Page trên ổ đĩa, rồi mới tiến hành đọc Heap Table tuần tự, giảm thiểu tối đa hiện tượng nhảy đầu đọc ngẫu nhiên.'
        },
        {
          id: 'c5-l3-q4',
          question: 'Khi quan sát thấy dòng chữ "Sort Method: external merge Disk" trong kết quả EXPLAIN ANALYZE, giải pháp tối ưu hệ thống chuẩn nhất là gì?',
          options: [
            'Xóa bỏ toàn bộ các bản ghi lịch sử trong bảng để giảm bớt số lượng dòng cần xử lý trong tương lai của cơ sở dữ liệu.',
            'Thay thế câu lệnh sắp xếp ORDER BY bằng một vòng lặp đồng bộ bên trong mã nguồn JavaScript của máy chủ NestJS.',
            'Chuyển toàn bộ cơ sở dữ liệu sang định dạng tệp tin văn bản thuần túy để hệ điều hành tự động sắp xếp nhanh hơn.',
            'Tăng giá trị tham số cấu hình work_mem (ví dụ từ 4MB lên 32MB-64MB) để thuật toán sắp xếp QuickSort có đủ dung lượng bộ nhớ RAM thực thi mà không bị tràn tệp tạm ra đĩa cứng (Disk Spill).'
          ],
          correctIndex: 3,
          explanation: '"Sort Method: external merge Disk" là dấu hiệu cho thấy dung lượng bộ nhớ được cấp phát cho phép toán sắp xếp (tham số work_mem) nhỏ hơn kích thước dữ liệu cần sort. Do đó, PostgreSQL buộc phải tạo các tệp tạm trên ổ cứng (Disk Spill) để chia nhỏ và merge sort, làm tốc độ chậm đi hàng chục lần. Tăng work_mem sẽ giúp sort hoàn toàn trong RAM.'
        },
        {
          id: 'c5-l3-q5',
          question: 'Điểm khác biệt cốt tử giữa câu lệnh "EXPLAIN" và câu lệnh "EXPLAIN ANALYZE" trong PostgreSQL là gì?',
          options: [
            'EXPLAIN chỉ hỗ trợ ngôn ngữ Python, còn EXPLAIN ANALYZE chỉ hỗ trợ ngôn ngữ TypeScript.',
            'EXPLAIN chỉ dựa vào số liệu thống kê nội bộ pg_statistic để ước tính chi phí (Estimated Cost) và số dòng (Estimated Rows) mà HOÀN TOÀN KHÔNG thực thi câu query; trong khi EXPLAIN ANALYZE THỰC SỰ CHẠY câu query trên cơ sở dữ liệu để đo đạc thời gian thực thi chính xác (Actual Time) và số dòng trả về thực tế.',
            'EXPLAIN sẽ tự động tối ưu hóa câu query thành công, còn EXPLAIN ANALYZE chỉ in ra lỗi cú pháp.',
            'EXPLAIN ANALYZE sẽ tự động rollback dữ liệu nhưng EXPLAIN sẽ tự động commit vĩnh viễn.'
          ],
          correctIndex: 1,
          explanation: 'Lệnh EXPLAIN thuần túy chỉ kích hoạt Planner/Optimizer đưa ra phán đoán lý thuyết mà không chạy truy vấn, do đó có thể dùng an toàn cho các câu lệnh DELETE/UPDATE lớn. Lệnh EXPLAIN ANALYZE sẽ thực sự cho chạy câu query trong engine để lấy số liệu thực tế đo bằng microsecond.'
        },
        {
          id: 'c5-l3-q6',
          question: 'Trong chuỗi kế hoạch "(cost=10.50..450.80 rows=100 width=32)", hai con số 10.50 và 450.80 thể hiện điều gì theo mô hình chi phí của PostgreSQL CBO?',
          options: [
            '10.50 là Startup Cost (chi phí ước tính để tạo ra dòng kết quả đầu tiên); 450.80 là Total Cost (tổng chi phí ước tính để đọc toàn bộ tập kết quả), tính theo đơn vị chuẩn hóa dựa trên seq_page_cost = 1.0.',
            '10.50 là số mili-giây tối thiểu và 450.80 là số mili-giây tối đa để hoàn thành câu truy vấn.',
            '10.50 là số lượng Megabytes RAM tiêu thụ và 450.80 là số lượng Kilobytes log ghi vào WAL.',
            '10.50 là số lượng index hits và 450.80 là số lượng disk reads.'
          ],
          correctIndex: 0,
          explanation: 'Chỉ số cost trong PostgreSQL không phải là đơn vị thời gian (giây hay mili-giây) mà là đơn vị chi phí tùy biến quy đổi theo seq_page_cost = 1.0. Số trước dấu .. là Startup Cost (chi phí khởi động trước khi dòng đầu tiên được trả về), số sau dấu .. là Total Cost (tổng chi phí để hoàn tất node).'
        },
        {
          id: 'c5-l3-q7',
          question: 'Khi nào PostgreSQL Optimizer ưu tiên lựa chọn thuật toán Hash Join thay vì Nested Loop Join khi thực hiện ghép nối 2 bảng dữ liệu?',
          options: [
            'Khi câu lệnh SQL không chứa mệnh đề ON chỉ định điều kiện ghép nối.',
            'Khi cả hai bảng dữ liệu đều có số lượng dòng dưới 10 bản ghi.',
            'Khi ghép nối 2 tập dữ liệu có kích thước trung bình đến lớn mà bảng trong (inner table) không có chỉ mục phù hợp trên cột join; Optimizer sẽ tạo một bảng băm (Hash Table) trong RAM từ bảng nhỏ hơn rồi quét bảng lớn để đối chiếu tìm kiếm trong thời gian O(1) trung bình.',
            'Khi cơ sở dữ liệu đang chạy trên ổ đĩa quang CD-ROM.'
          ],
          correctIndex: 2,
          explanation: 'Nested Loop Join cực nhanh nếu bảng ngoài nhỏ và bảng trong có Index. Nhưng nếu cả 2 bảng đều lớn hoặc thiếu index, Nested Loop sẽ có độ phức tạp O(M * N) cực chậm. Optimizer sẽ chuyển sang Hash Join: dựng một bảng băm trong bộ nhớ (work_mem) từ bảng nhỏ hơn, sau đó quét bảng lớn để tra cứu hash, đạt độ phức tạp xấp xỉ O(M + N).'
        },
        {
          id: 'c5-l3-q8',
          question: 'Hiện tượng nào sau đây giải thích vì sao một bảng vừa được nhập thêm 5 triệu bản ghi mới (Bulk Insert) lại đột ngột khiến các câu truy vấn SELECT trở nên chậm chạp bất thường, và giải pháp kỹ thuật là gì?',
          options: [
            'Do cơ sở dữ liệu bị hết dung lượng RAM và phải tự động giảm xung nhịp CPU.',
            'Do các bản ghi mới chưa được gán ID nên hệ thống phải tìm kiếm bằng cách so sánh từng chuỗi nhị phân.',
            'Do các ổ đĩa NVMe SSD bị giảm tốc độ đọc sau khi ghi dữ liệu liên tục.',
            'Do bảng thống kê nội bộ pg_statistic chưa kịp cập nhật phân phối dữ liệu mới (Outdated Statistics), khiến Cost Optimizer phán đoán sai lệch nghiêm trọng và chọn nhầm kế hoạch thực thi tồi tệ (như dùng nhầm Index Scan thay vì Seq Scan hoặc ngược lại); giải pháp là chủ động chạy ngay lệnh "ANALYZE <table_name>;" để tái tính toán thống kê.'
          ],
          correctIndex: 3,
          explanation: 'Optimizer hoạt động dựa trên các thông số thống kê trong pg_statistic (được thu thập bởi ANALYZE). Sau khi bulk insert lượng lớn dữ liệu, nếu autovacuum chưa kịp chạy ANALYZE, bảng thống kê vẫn coi bảng là nhỏ hoặc có phân phối cũ, dẫn đến việc chọn các Access Path hoàn toàn lệch lạc. Chạy ANALYZE ngay lập tức sẽ giải quyết triệt để.'
        }
      ],
      codeChallenge: {
        id: 'c5-l3-c1',
        title: 'Phân Tích Báo Cáo Chi Phí Query (Query Plan Cost Analyzer)',
        description: 'Hiện thực hàm \`analyzePlanCosts(planString: string): { startupCost: number; totalCost: number; isHighCost: boolean }\`. Chuỗi đầu vào có dạng \`"-> Seq Scan on orders (cost=10.50..450.80 rows=100 width=32)"\`. Trích xuất \`startupCost\` (số trước hai dấu chấm), \`totalCost\` (số sau hai dấu chấm). Trả về \`isHighCost: true\` nếu \`totalCost > 100\`, ngược lại trả về \`false\`. Xử lý an toàn nếu chuỗi không hợp lệ bằng cách trả về \`{ startupCost: 0, totalCost: 0, isHighCost: false }\`.',
        starterCode: `export function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  // TODO: Trích xuất chỉ số chi phí từ chuỗi kết quả EXPLAIN
  return { startupCost: 0, totalCost: 0, isHighCost: false };
}`,
        solution: `export function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  if (typeof planString !== 'string') {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }

  const match = planString.match(/cost=([0-9.]+)\.\.([0-9.]+)/);
  if (!match) {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }

  const startupCost = parseFloat(match[1]);
  const totalCost = parseFloat(match[2]);
  const isHighCost = totalCost > 100;

  return {
    startupCost: isNaN(startupCost) ? 0 : startupCost,
    totalCost: isNaN(totalCost) ? 0 : totalCost,
    isHighCost,
  };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Phân tích câu query có chi phí thấp',
            input: ['-> Index Scan on users (cost=0.28..8.30 rows=1 width=64)'],
            expected: { startupCost: 0.28, totalCost: 8.30, isHighCost: false },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Phân tích câu query có chi phí cao vượt ngưỡng 100',
            input: ['-> Seq Scan on large_table (cost=10.50..580.40 rows=5000 width=128)'],
            expected: { startupCost: 10.50, totalCost: 580.40, isHighCost: true },
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Chuỗi không hợp lệ không chứa cost',
            input: ['Invalid plan string without cost metadata'],
            expected: { startupCost: 0, totalCost: 0, isHighCost: false },
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Đúng bằng biên 100.00 (không vượt quá 100)',
            input: ['-> Bitmap Heap Scan (cost=0.00..100.00 rows=50 width=16)'],
            expected: { startupCost: 0, totalCost: 100, isHighCost: false },
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Chi phí lớn với số thực phức tạp',
            input: ['-> Hash Join (cost=1250.75..99876.50 rows=200000 width=256)'],
            expected: { startupCost: 1250.75, totalCost: 99876.50, isHighCost: true },
            hidden: true
          }
        ]
      }
    }
  ]
};
