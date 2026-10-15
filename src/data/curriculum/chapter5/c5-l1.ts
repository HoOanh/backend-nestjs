import type { Lesson } from '../types.ts';

export const c5_l1: Lesson = {
  id: 'c5-l1',
  title: 'Bài 01: PostgreSQL Storage Engine: 8KB Slotted Page, Heap Tuple, WAL & Checkpoint',
  duration: '60 phút',
  tag: 'Database Storage Internals',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng động cơ lưu trữ PostgreSQL từ khối đĩa 8KB lên tới tính bền vững ACID cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Trang có khe (Slotted Page) và định danh vật lý \`ctid\`:** Hiểu bố cục Page Header, Line Pointer, Heap Tuple và Free Space; giải thích vì sao bản ghi độ dài thay đổi không làm vỡ căn chỉnh trang.
> 2. **Nhật ký ghi trước (Write-Ahead Logging - WAL) và Checkpoint:** Phân tích định lượng vì sao ghi tuần tự append-only thay thế ghi ngẫu nhiên lên data file; chứng minh cửa sổ REDO sau khi mất điện.
> 3. **Chẩn đoán Shared Buffers, FSM/VM và ngân sách WAL trên Production:** Đọc \`pg_statio_user_tables\`, \`pg_stat_bgwriter\` / \`pg_stat_checkpointer\`; quyết định \`shared_buffers\`, \`max_wal_size\`, \`synchronous_commit\`.

---

# 1. TRANG 8KB CÓ KHE, HEAP TUPLE VÀ CON TRỎ VẬT LÝ CTID

### 1.1 Khái niệm nền tảng: Vì sao PostgreSQL không ghi từng dòng xuống đĩa

Hệ điều hành và bộ điều khiển NVMe trao đổi dữ liệu theo **khối (block)**, không theo từng bản ghi SQL. PostgreSQL cố định kích thước khối logic là **8.192 byte (8KB Page)**, khớp bội số của trang bộ nhớ 4KB trên Linux và của sector 4KB trên SSD hiện đại.

1. **Một quan hệ (Relation) là một dãy page.** Tệp \`base/<db_oid>/<relfilenode>\` được cắt thành các page đánh số từ 0. Khi vượt 1GB, PostgreSQL tạo segment kế tiếp (\`relfilenode.1\`, \`.2\`).
2. **Heap không sắp thứ tự khóa.** Bảng heap chỉ là đống tuple. Thứ tự \`ORDER BY\` không tồn tại trên đĩa trừ khi có chỉ mục hoặc \`CLUSTER\`.
3. **Độ dài tuple thay đổi.** \`text\`, \`jsonb\`, \`numeric\` không có stride cố định. Cấp phát kiểu mảng C (\`tuple[i] = base + i * stride\`) sẽ phân mảnh ngay lần \`UPDATE\` đầu tiên kéo dài chuỗi.

Kiến trúc **trang có khe (Slotted Page)** giải quyết bài toán đó bằng hai con trỏ tăng ngược chiều nhau trong cùng một page 8KB.

### 1.2 Đối chiếu kiến trúc: Mảng stride cố định và Slotted Page

| Tiêu chí học thuật | Mảng stride cố định | Slotted Page PostgreSQL | Hệ quả khi UPDATE kéo dài tuple |
| :--- | :--- | :--- | :--- |
| **Vị trí bản ghi** | \`base + index * stride\` | Line Pointer 4 byte trỏ offset | Stride cũ bị vỡ căn chỉnh |
| **Header trang** | Thường không có LSN | 24 byte: \`pd_lsn\`, checksum, \`pd_lower\`, \`pd_upper\` | Không có mốc REDO |
| **Vùng trống** | Lỗ hổng giữa các stride | Free space nằm giữa pointer và tuple | Lỗ hổng không tái sử dụng tại chỗ |
| **Xóa bản ghi** | Dồn mảng hoặc để hole | Đánh \`xmax\`, pointer còn, VACUUM dọn sau | Chi phí dồn cả page |
| **Định danh ổn định** | Index logic thay đổi khi dồn | \`ctid = (blockNumber, offsetNumber)\` | Index chỉ cần sửa pointer nội bộ |
| **Khóa ngoài heap** | Không có | Index lưu \`ctid\`, không lưu cả dòng | Index scan phải heap fetch |

### 1.3 Cơ chế Line Pointer, Tuple Header 23 byte và bài toán HOT

Mỗi **con trỏ dòng (Line Pointer / ItemId)** chiếm 4 byte: offset 15 bit, cờ 2 bit, độ dài 15 bit. Chúng mọc từ sau Page Header đi xuống. **Heap Tuple** mọc từ đáy page đi lên. \`pd_lower\` và \`pd_upper\` kẹp vùng **không gian trống (Free Space)**.

Tuple header (\`HeapTupleHeaderData\`) chiếm 23 byte, căn 24 byte trên nhiều kiến trúc, và là nền của **điều khiển đồng thời đa phiên bản (Multi-Version Concurrency Control - MVCC)**:

- \`xmin\`: mã giao dịch đã chèn phiên bản này.
- \`xmax\`: mã giao dịch đã xóa hoặc tạo phiên bản kế, hoặc 0 nếu dòng còn sống.
- \`t_ctid\`: trỏ tới phiên bản kế tiếp trong cùng page khi xảy ra **cập nhật chỉ trên heap (Heap-Only Tuple - HOT)**.
- \`t_infomask\`: cờ đã commit, đã khóa, có thuộc tính null.

\`UPDATE\` không sửa byte tại chỗ. PostgreSQL chèn một tuple mới và gắn \`xmax\` cho tuple cũ. Nếu cột chỉ mục không đổi và page còn chỗ, HOT giữ nguyên \`ctid\` ở index: chỉ mục không phải ghi thêm. Nếu tuple mới không vừa page, dòng bị chuyển sang page khác và index phải cập nhật \`ctid\` mới.

\`\`\`typescript
// File: src/database/storage/slotted-page.inspector.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Coi bảng như mảng stride, bỏ qua header và line pointer
export class BrokenPageMath {
  public usedBytes(tupleSizes: number[]): number {
    return tupleSizes.reduce((sum, size) => sum + size, 0);
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION PATTERN): Page Header 24B + ItemId 4B + tuple đã căn
const PAGE_HEADER_BYTES = 24;
const ITEM_ID_BYTES = 4;

export class SlottedPageInspector {
  public freeBytes(pageSize: number, tupleSizes: number[]): number {
    const pointers = tupleSizes.length * ITEM_ID_BYTES;
    const tuples = tupleSizes.reduce((sum, size) => sum + Math.max(size, 0), 0);
    const used = PAGE_HEADER_BYTES + pointers + tuples;
    return used >= pageSize ? 0 : pageSize - used;
  }
}
\`\`\`

| Mốc thời gian | Luồng đang xử lý | Thao tác trên CPU / I/O | Trạng thái page 8KB | Hệ quả |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Backend chèn 1 tuple 200 byte | Đọc Free Space Map trong RAM | \`pd_upper - pd_lower = 6.400 byte\` | Chọn page 42, chưa đụng data file |
| **\`t = 1 ms\`** | Gắn ItemId slot 5 | Ghi 4 byte pointer + 224 byte tuple (kể cả header) | Free space còn 6.172 byte | \`ctid = (42, 5)\` |
| **\`t = 2 ms\`** | \`UPDATE\` không đổi khóa index | HOT: tuple cũ nhận \`xmax\`, tuple mới cùng page | \`t_ctid\` của bản cũ trỏ slot mới | Index không bị page split |
| **\`t = 4 ms\`** | Client nhận \`UPDATE 1\` | WAL đã \`fsync\`, data page vẫn dirty trong Shared Buffers | LSN page tăng, bit dirty bật | Data file trên NVMe chưa đổi byte |

### 1.4 Định lượng chỗ trống của một page

\`\`\`
freeBytes = pageSize - 24 - (linePointerCount * 4) - sum(tupleSizes)
Ví dụ page 8192, 2 pointer, tuple 100 + 200:
freeBytes = 8192 - 24 - 8 - 300 = 7860 byte
\`\`\`

> **Tổng kết học thuật Phần 1 (Bất biến Slotted Page):**
> 1. **Mọi heap tuple đều đi qua ItemId.** Ứng dụng không được giả định offset byte ổn định ngoài \`ctid\`.
> 2. **Header 23 byte là MVCC, không phải phần dữ liệu nghiệp vụ.** Một bảng hẹp 20 byte payload vẫn tốn khoảng 43 byte/dòng trước cả alignment và null bitmap.

---

# 2. WAL, CHECKPOINT VÀ CỬA SỔ PHỤC HỒI SAU MẤT ĐIỆN

### 2.1 Vì sao ghi ngẫu nhiên lên data file không đạt được durability ở tốc độ cao

Một \`COMMIT\` sửa vài byte trên nhiều page nằm rải rác trong tệp heap. Nếu mỗi commit gọi \`fsync\` đúng các page đó, NVMe phải hoàn tất nhiều ghi có địa chỉ xa nhau. Độ trễ của một lần \`fsync\` ngẫu nhiên trên SSD enterprise thường nằm trong khoảng 0,05–0,3 ms, nhưng hàng trăm page bẩn cùng lúc biến thành hàng đợi I/O.

**Nhật ký ghi trước (Write-Ahead Logging - WAL)** đổi bài toán: mô tả thay đổi được nối đuôi vào tệp \`pg_wal\` theo kiểu append-only. Một \`fsync\` tuần tự hoàn tất là mốc durability. Page dữ liệu trong **vùng đệm chia sẻ (Shared Buffers)** được đánh **dirty** và được hoãn tới Checkpoint.

| Đại lượng | Ghi thẳng data page mỗi commit | WAL append-only rồi Checkpoint | \`synchronous_commit = off\` |
| :--- | :--- | :--- | :--- |
| **Kiểu I/O** | Random write nhiều page | Sequential write 1 luồng WAL | Ghi WAL buffer trong RAM |
| **Mốc báo COMMIT** | Sau \`fsync\` data file | Sau \`fsync\` WAL | Sau khi vào WAL buffer |
| **Thông lượng điển hình** | Vài trăm tới vài nghìn TPS | Khoảng 1.000–10.000 TPS tùy \`fsync\` | Có thể vượt 30.000 TPS |
| **Mất dữ liệu khi rút điện** | 0 byte đã commit | 0 byte đã commit | Tối đa khoảng \`wal_writer_delay\` (mặc định 200 ms) |
| **Chi phí nền** | I/O spike mỗi commit | Full Page Image lần đầu page bẩn sau checkpoint | Ít \`fsync\`, cửa sổ mất log |

### 2.2 Công thức cửa sổ REDO

Tiến trình **Checkpointer** đọc \`pg_control\`, ghi một bản ghi checkpoint, rồi đẩy dirty page xuống data file. \`max_wal_size\` và \`checkpoint_timeout\` quyết định tần suất. Nếu WAL đầy trước timeout, checkpoint bị **cưỡng bức (requested)** và log xuất hiện \`checkpoints are occurring too frequently\`.

\`\`\`
recordsToReplay = crashLsn - checkpointLsn
walBytes = recordsToReplay * bytesPerRecord
segments = ceil(walBytes / segmentBytes)
replayMs ≈ recordsToReplay * 0,02
Ví dụ LSN 1000 → 5000, 200 byte/bản ghi, segment 16 MiB:
records = 4000, walBytes = 800.000, segments = 1, replayMs = 80
\`\`\`

### 2.3 Truy vết một INSERT từ backend process tới NVMe

1. Backend tra **bản đồ không gian trống (Free Space Map - FSM)** để chọn page còn \`pd_upper - pd_lower\` đủ chứa tuple.
2. Sửa page trong Shared Buffers, gắn ItemId, ghi WAL record vào WAL buffer, gắn LSN của page bằng LSN của record.
3. Nếu \`synchronous_commit = on\`, nhóm commit chờ \`wal_sync_method\` (\`fdatasync\`, \`fdatasync\` + \`O_DIRECT\`, hoặc \`open_datasync\`) trả về.
4. Client nhận \`INSERT 0 1\`. Byte trên \`base/\` vẫn có thể là bản cũ.
5. Checkpointer hoặc **Background Writer** mới gọi \`write\` + \`fsync\` data file. Sau checkpoint, các segment WAL cũ hơn redo pointer mới được tái chế.

### 2.4 Hai tệp phụ của mỗi heap: FSM và Visibility Map

- **FSM (\`_fsm\`)** lưu số byte trống theo cây, để \`INSERT\` không quét mọi page.
- **Bản đồ khả kiến (Visibility Map - VM, \`_vm\`)** đánh dấu page **all-visible**: mọi tuple trên page đều thấy được với mọi snapshot hiện hành. VACUUM bỏ qua page all-visible. Index-Only Scan chỉ được bỏ heap fetch khi bit VM của page heap còn all-visible.

> **Tổng kết học thuật Phần 2 (Bất biến WAL trước data file):**
> 1. **Không có bản ghi WAL đã \`fsync\` thì không có commit bền.** Dirty page trong RAM không phải durability.
> 2. **Phục hồi chỉ replay từ redo LSN của checkpoint gần nhất.** Tăng \`max_wal_size\` giảm I/O spike nhưng kéo dài REDO.

---

# 3. CHẨN ĐOÁN SHARED BUFFERS VÀ NGÂN SÁCH WAL TRÊN NESTJS

### 3.1 Shared Buffers không phải toàn bộ RAM máy

PostgreSQL dùng RAM cho Shared Buffers, WAL buffers, process backend (work_mem, maintenance_work_mem) và page cache của Linux. Đặt \`shared_buffers = 80%\` RAM đẩy kernel vào reclaim, double-cache giữa Shared Buffers và page cache trở nên nghẽn. Mốc thực dụng trên máy chủ chuyên PostgreSQL là khoảng **25% RAM**, và không vượt 40% nếu cùng máy còn chạy NestJS.

Tỉ lệ trúng đệm heap:

\`\`\`
cacheHitRatio = heap_blks_hit / (heap_blks_hit + heap_blks_read)
Ngưỡng vận hành: dưới 0,95 trên bảng nóng là tín hiệu shared_buffers hoặc working set lệch
\`\`\`

### 3.2 Đọc bộ đếm checkpoint từ dịch vụ NestJS

\`\`\`typescript
// File: src/database/health/checkpoint-pressure.ts
// Tỉ lệ checkpoint cưỡng bức = checkpoints_req / (checkpoints_req + checkpoints_timed)
export interface CheckpointCounters {
  readonly checkpointsTimed: number;
  readonly checkpointsReq: number;
}

export function forcedCheckpointRatio(counters: CheckpointCounters): number {
  const total = counters.checkpointsTimed + counters.checkpointsReq;
  if (total <= 0) {
    return 0;
  }
  return counters.checkpointsReq / total;
}
\`\`\`

Trên PostgreSQL 17, các cột checkpoint chuyển sang \`pg_stat_checkpointer\`. \`pg_stat_bgwriter\` giữ \`buffers_clean\`, \`buffers_backend\`. Một backend tự viết dirty page (\`buffers_backend\` tăng) nghĩa là checkpointer không theo kịp.

### 3.3 Ma trận triệu chứng Production

| Triệu chứng | Bộ đếm | Nguyên nhân gốc | Việc chỉnh |
| :--- | :--- | :--- | :--- |
| **I/O spike mỗi 1–2 phút** | \`checkpoints_req\` tăng nhanh | \`max_wal_size\` nhỏ hơn tốc độ sinh WAL | Tăng \`max_wal_size\`, giãn \`checkpoint_timeout\` |
| **Cache hit dưới 95%** | \`heap_blks_read\` cao | Working set lớn hơn Shared Buffers | Tăng \`shared_buffers\` về ~25% RAM |
| **Sort tràn đĩa** | temp file trong \`log_temp_files\` | \`work_mem\` 4MB không đủ hash/sort | Tăng \`work_mem\` theo session, không phải global mù |
| **Commit p99 trên 5 ms** | \`pg_stat_statements\` blk_write_time | \`synchronous_commit=on\` + đĩa chậm | Tách log/telemetry sang \`off\` hoặc group commit |
| **REDO vài phút sau crash** | WAL segment tồn từ checkpoint | \`max_wal_size\` 32GB | Chấp nhận replay, hoặc checkpoint dày hơn |

### 3.4 Quy tắc \`synchronous_commit\`

\`on\` là mặc định đúng cho đơn hàng, số dư, thanh toán. \`off\` chỉ hợp lệ khi mất khoảng 200 ms mẫu cuối cùng là chấp nhận được (sensor, click log). Nó không tắt WAL; nó chỉ không chờ \`fsync\` trước khi trả lời client.

> **Tổng kết học thuật Phần 3 (Ngân sách bộ nhớ và WAL):**
> \`shared_buffers\` phục vụ hit ratio, \`max_wal_size\` phục vụ tần suất checkpoint, \`synchronous_commit\` phục vụ cửa sổ mất dữ liệu. Ba núm này không thay thế nhau.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống PostgreSQL Storage (Heap Page, WAL, Checkpoint)
\`\`\`diagram
[TOPOLOGY: pipeline-feedback-loop]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG TIẾN TRÌNH BACKEND VÀ BỘ ĐỆM (BACKEND PROCESS & SHARED BUFFERS)       │
│    ├── Heap Page 8KB (Slotted Page): ItemId đi xuống, tuple đi lên            │
│    ├── Shared Buffers (Dirty Page): Bản sao RAM mới hơn data file             │
│    └── FSM & Visibility Map (Free Space / All-Visible): Chọn page và bỏ qua VACUUM │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Ghi WAL record trước khi công nhận COMMIT
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG NHẬT KÝ TUẦN TỰ (WRITE-AHEAD LOG & WAL WRITER)                        │
│    ├── WAL Buffer (XLog): Append-only, chưa phải durability                   │
│    ├── fsync / fdatasync (wal_sync_method): Mốc ACID durability               │
│    └── pg_wal Segment 16MB (LSN): Chuỗi redo sau checkpoint                   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Checkpointer flush dirty page rồi tiến redo pointer
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG TỆP DỮ LIỆU VÀ PHỤC HỒI (DATA FILE & CRASH RECOVERY)                  │
│    ├── base/relfilenode (Heap & Index Page): Chỉ cập nhật lúc checkpoint      │
│    ├── global/pg_control (Redo LSN): Mốc bắt đầu replay                       │
│    └── REDO Phase (WAL Replay): Áp lại mọi commit đã fsync                    │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Ghi Ngẫu Nhiên Data File Và WAL Append-Only
\`\`\`diagram
MÔ HÌNH CŨ: FSYNC TỪNG DATA PAGE NGAY KHI COMMIT (RANDOM WRITE PER COMMIT)
INSERT ──► [ Sửa nhiều Heap Page rải rác ] ──► [ fsync ngẫu nhiên từng page ] ──► HÀNG ĐỢI I/O
10.000 commit/s = hàng chục nghìn random write, TPS sụp xuống vài trăm, NVMe no queue depth.

MÔ HÌNH HIỆN ĐẠI: WAL APPEND-ONLY, DIRTY PAGE CHỜ CHECKPOINT
Commit A ──┐
Commit B ──┼──► [ WAL Buffer + một fsync tuần tự ] ──► Client nhận COMMIT
Commit C ──┘               │
                           └──► Checkpointer flush dirty page theo max_wal_size ────► REDO ngắn và data file nhất quán
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chọn núm shared_buffers, max_wal_size, synchronous_commit)
\`\`\`diagram
                      HỆ THỐNG POSTGRESQL NGHẼN Ở ĐÂU KHI GHI HOẶC SAU CRASH?
                                     │
                                     ▼
                         Bộ đếm nào đang lệch khỏi ngân sách?
                         /                          \\
           CACHE HIT HEAP DƯỚI 95%                  CHECKPOINT HOẶC CAM KẾT
                   /                                      \\
                  ▼                                        ▼
        [ TĂNG SHARED BUFFERS (CHUẨN) ]           Cửa sổ mất dữ liệu có được phép không?
        - Đặt khoảng 25% RAM dedicated            /                          \\
        - Không vượt 40% nếu cùng máy chạy API    CHO PHÉP MẤT ~200ms              KHÔNG ĐƯỢC MẤT COMMIT
        - Đo lại heap_blks_hit                           /                            \\
                                              ▼                                        ▼
                                    [ SYNCHRONOUS_COMMIT OFF ]              [ TĂNG MAX_WAL_SIZE (CHUẨN) ]
                                    - Chỉ cho telemetry                     - Giảm checkpoints_req
                                    - WAL vẫn ghi, không chờ fsync           - Chấp nhận REDO dài hơn
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Ngân sách lưu trữ PostgreSQL)

| Tiêu Chí So Sánh | \`shared_buffers\` ~25% RAM | \`max_wal_size\` lớn (16–32GB) | \`synchronous_commit = off\` |
| :--- | :--- | :--- | :--- |
| **Mục tiêu** | Tăng heap cache hit | Giảm checkpoint cưỡng bức | Tăng TPS ghi |
| **Tài nguyên đổi lại** | RAM không nhường hết cho OS cache | Đĩa \`pg_wal\` và thời gian REDO | Cửa sổ mất log ~\`wal_writer_delay\` |
| **Khi nào sai** | Nhỏ hơn working set hoặc nuốt hết RAM | Đĩa WAL chung volume với data bị đầy | Bảng thanh toán, số dư |
| **Tín hiệu đo** | \`heap_blks_hit / (hit+read)\` | \`checkpoints_req / (req+timed)\` | Commit latency p99 và WAL sync time |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Trước khi đọc \`PostgresStorageMetricsService\` và làm ba bài sandbox, giữ bốn định đề sau:

1. **Định đề 1 (Slotted Page và \`ctid\`):** Mọi dòng heap được định vị bằng \`(blockNumber, offsetNumber)\`. Index không nhúng cả dòng; nó lưu khóa và \`ctid\`. Chỗ trống page bằng \`pageSize - 24 - 4 * số ItemId - tổng byte tuple\`.
2. **Định đề 2 (WAL trước data file):** \`COMMIT\` bền khi bản ghi WAL đã \`fsync\`, không phải khi dirty page đã nằm trên \`base/\`. Crash recovery đọc redo LSN trong \`pg_control\` và replay tuần tự.
3. **Định đề 3 (Checkpoint là van I/O):** \`checkpoints_req\` cao nghĩa là \`max_wal_size\` nhỏ hơn tốc độ sinh WAL. Nới van làm REDO dài hơn; siết van làm spike ghi data file.
4. **Định đề 4 (Ba núm không hoán đổi):** \`shared_buffers\` lo hit ratio, \`max_wal_size\` lo tần suất flush, \`synchronous_commit\` lo cửa sổ mất commit. Tắt sync commit không chữa cache miss.
  `,
  realCodeSnippet: `// File: src/database/health/postgres-storage-metrics.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Đo cache hit, page 8KB và áp lực checkpoint
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CacheHitRecord {
  readonly cache_hit_ratio: string;
}

export interface TableStorageRecord {
  readonly table_name: string;
  readonly table_size: string;
  readonly total_size_with_indexes: string;
  readonly total_8kb_pages: number;
}

export interface CheckpointRecord {
  readonly checkpoints_timed: number;
  readonly checkpoints_req: number;
  readonly checkpoint_write_time: number;
  readonly checkpoint_sync_time: number;
}

export interface StorageDiagnostics {
  readonly cacheHitRatio: number;
  readonly forcedCheckpointRatio: number;
  readonly checkpoint: CheckpointRecord | undefined;
  readonly topTables: TableStorageRecord[];
}

/**
 * ADR-051: Storage health không đoán từ latency HTTP.
 * 1. heap_blks_hit / (hit + read) dưới 0,95 trên bảng nóng nghĩa là working set lệch Shared Buffers.
 * 2. relpages đếm page 8KB vật lý, tách bloat heap khỏi kích thước index.
 * 3. checkpoints_req / (req + timed) trên 0,10 nghĩa là max_wal_size đang bị WAL thực tế vượt.
 * Trên PostgreSQL 17, bộ đếm checkpoint nằm ở pg_stat_checkpointer; cụm này vẫn đọc pg_stat_bgwriter.
 */
@Injectable()
export class PostgresStorageMetricsService {
  private readonly logger = new Logger(PostgresStorageMetricsService.name);

  constructor(private readonly dataSource: DataSource) {}

  public async getEngineDiagnostics(): Promise<StorageDiagnostics> {
    const cacheRows = await this.dataSource.query<CacheHitRecord[]>(\`
      SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 0.0001) * 100
        AS cache_hit_ratio
      FROM pg_statio_user_tables;
    \`);

    const topTables = await this.dataSource.query<TableStorageRecord[]>(\`
      SELECT relname AS table_name,
             pg_size_pretty(pg_relation_size(relid)) AS table_size,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size_with_indexes,
             relpages AS total_8kb_pages
      FROM pg_stat_user_tables
      ORDER BY pg_relation_size(relid) DESC
      LIMIT 5;
    \`);

    const checkpointRows = await this.dataSource.query<CheckpointRecord[]>(\`
      SELECT checkpoints_timed, checkpoints_req, checkpoint_write_time, checkpoint_sync_time
      FROM pg_stat_bgwriter;
    \`);

    const cacheHitRatio = Number.parseFloat(cacheRows[0]?.cache_hit_ratio ?? '0');
    const checkpoint = checkpointRows[0];
    const timed = checkpoint?.checkpoints_timed ?? 0;
    const requested = checkpoint?.checkpoints_req ?? 0;
    const total = timed + requested;
    const forcedCheckpointRatio = total === 0 ? 0 : requested / total;

    if (cacheHitRatio < 95) {
      this.logger.warn(\`heap cache hit \${cacheHitRatio.toFixed(2)}% dưới 95\`);
    }
    if (forcedCheckpointRatio > 0.1) {
      this.logger.warn(\`forced checkpoint ratio \${forcedCheckpointRatio.toFixed(3)}\`);
    }

    return { cacheHitRatio, forcedCheckpointRatio, checkpoint, topTables };
  }
}
`,
  quiz: [
    {
      id: 'c5-l1-q1',
      question: 'Vì sao Line Pointer mọc từ đầu page xuống còn Heap Tuple mọc từ đáy page lên?',
      options: [
        'Để vùng Free Space ở giữa co giãn khi tuple có độ dài thay đổi, ItemId 4 byte vẫn giữ offset ổn định mà không dồn cả trang.',
        'Vì CPU chỉ đọc được bộ nhớ từ hai đầu page cùng một nhịp và từ chối mọi bố cục cấp phát một chiều trên NVMe.',
        'Để mã hóa hai nửa page bằng hai khóa khác nhau, chặn đọc trộm từng sector trên NVMe.',
        'Vì mỗi ItemId bắt buộc dài đúng một nửa tuple nên hai phía phải tăng ngược chiều.',
      ],
      correctIndex: 0,
      explanation: 'Slotted Page dành ItemId kích thước cố định 4 byte cho định vị, còn payload biến độ dài nằm ở đáy. pd_lower và pd_upper kẹp free space, nên INSERT và VACUUM không phải dồn stride cố định.',
    },
    {
      id: 'c5-l1-q2',
      question: 'WAL tạo thông lượng ghi cao hơn so với fsync từng data page bằng cơ chế nào?',
      options: [
        'Nén mọi ảnh và tệp nhị phân về 0 byte trước khi ghi bảng heap.',
        'Bỏ kiểm tra khóa ngoại để giảm số page phải đụng trong transaction.',
        'Đổi random write lên data file thành append-only lên pg_wal, COMMIT khi WAL đã fsync, data page để dirty.',
        'Đẩy cả cụm sang máy khác ngay mỗi commit nên đĩa local không còn ghi và WAL segment cũng biến mất.',
      ],
      correctIndex: 2,
      explanation: 'Ghi tuần tự một luồng WAL rẻ hơn nhiều lần fsync các heap page rải rác. Durability bám LSN đã fsync. Checkpointer mới flush dirty page xuống base/.',
    },
    {
      id: 'c5-l1-q3',
      question: 'ctid = (105, 12) chỉ điều gì trong heap PostgreSQL?',
      options: [
        'Khóa chính bằng 105 và dòng đã bị UPDATE đúng 12 lần trong ngày.',
        'Page số 105 của relation và ItemId số 12 trong header của page đó.',
        'Backend process 105 đang giữ dòng, bảng có đúng 12 cột khác null.',
        'User id 105, dữ liệu nằm trên volume NVMe thứ 12 của máy.',
      ],
      correctIndex: 1,
      explanation: 'ctid là địa chỉ vật lý (block number, offset number). Index leaf lưu khóa cộng ctid này. Nó không phải primary key logic và không phải số cột.',
    },
    {
      id: 'c5-l1-q4',
      question: 'max_wal_size quá nhỏ trên cụm ghi dày gây hiện tượng nào?',
      options: [
        'Mọi SELECT bị từ chối để nhường đĩa cho việc xóa WAL cũ.',
        'WAL cũ bị xóa cả phần chưa checkpoint nên không replay được.',
        'PostgreSQL tự chuyển bảng sang mô hình tài liệu để khỏi ghi log WAL.',
        'Checkpoint requested dồn dập, dirty page bị flush liên tục, I/O data file tăng vọt.',
      ],
      correctIndex: 3,
      explanation: 'Khi WAL chạm max_wal_size trước checkpoint_timeout, checkpointer bị gọi sớm. checkpoints_req tăng, đĩa phải viết data page liên tục thay vì viết tuần tự WAL.',
    },
    {
      id: 'c5-l1-q5',
      question: 'synchronous_commit = off đánh đổi điều gì?',
      options: [
        'Chặn SQL injection nhưng giảm một nửa nhịp CPU của backend.',
        'Không chờ fsync mỗi commit nên TPS tăng, có thể mất khoảng wal_writer_delay log cuối nếu mất điện.',
        'Giữ mọi ghi trong RAM vĩnh viễn và không tạo WAL segment.',
        'Khóa đọc của mọi session khác cho tới khi checkpoint kế tiếp chạy xong trên đĩa local.',
      ],
      correctIndex: 1,
      explanation: 'Tham số này không tắt WAL. Client được trả lời sau khi record vào WAL buffer. Nếu máy chết trước lần fsync của walwriter, các commit trong cửa sổ đó không còn để replay.',
    },
    {
      id: 'c5-l1-q6',
      question: 'FSM và Visibility Map đi cùng mỗi heap để làm gì?',
      options: [
        'FSM chọn page còn byte trống cho INSERT; VM đánh dấu page all-visible để VACUUM và Index-Only Scan bỏ qua heap fetch.',
        'FSM lưu mật khẩu, VM vẽ biểu đồ cho trang quản trị.',
        'FSM chứa plan đã cache, VM chứa danh sách role của user.',
        'Cả hai chỉ là bản sao tạm, bị xóa sạch mỗi lần postmaster khởi động lại cụm và không tham gia MVCC hay FSM.',
      ],
      correctIndex: 0,
      explanation: 'File _fsm giúp không quét tuần tự mọi page khi chèn. File _vm là bit all-visible. Index-Only Scan vẫn phải heap fetch nếu bit của page chưa all-visible vì MVCC.',
    },
    {
      id: 'c5-l1-q7',
      question: 'Crash recovery REDO của PostgreSQL bắt đầu từ đâu?',
      options: [
        'Xóa data directory và nạp bản dump đêm hôm trước.',
        'Đòi mật khẩu superuser để đọc lại Shared Buffers từ swap.',
        'Đọc redo LSN trong pg_control tại checkpoint gần nhất, replay WAL tới cuối segment rồi mới nhận kết nối.',
        'Trả 500 cho mọi client và khóa cụm ở chế độ read-only vĩnh viễn cho tới khi có dump đầy đủ.',
      ],
      correctIndex: 2,
      explanation: 'Dirty page trong RAM mất khi rút điện. pg_control giữ redo pointer. Mọi thay đổi đã commit nằm trong WAL sau pointer đó và được áp lại lên page trước khi mở phục vụ.',
    },
    {
      id: 'c5-l1-q8',
      question: '23 byte đầu của Heap Tuple Header phục vụ mục đích nào?',
      options: [
        'Chứa khóa công khai để mã hóa từng cột trên đĩa trước khi ghi page 8KB.',
        'Ghi tên kỹ sư đã chạy lệnh INSERT.',
        'Lưu địa chỉ IP của client gửi câu lệnh.',
        'Giữ xmin, xmax, t_ctid và infomask để MVCC biết phiên bản nào còn thấy được.',
      ],
      correctIndex: 3,
      explanation: 'xmin là giao dịch tạo phiên bản, xmax là giao dịch xóa hoặc thay thế, t_ctid nối HOT chain, infomask ghi đã commit hay đang khóa. Không có các trường này thì snapshot không đọc nhất quán được.',
    },
  ],
  codeChallenge: {
    id: 'c5-l1-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Tính Free Space còn lại trong Slotted Page 8KB',
    description: 'Hiện thực hàm `calculateFreeSpace(pageSize, linePointerCount, tupleSizes)`. Page tiêu tốn Page Header cố định 24 byte, mỗi Line Pointer 4 byte, và toàn bộ byte trong `tupleSizes` (bỏ qua phần tử <= 0). Trả về `pageSize - 24 - linePointerCount * 4 - tổng tuple`. Nếu `pageSize <= 0`, `linePointerCount < 0`, hoặc phần đã dùng >= pageSize, trả về 0.',
    guidedSteps: [
      'Bước 1 (Chặn đầu vào): Nếu pageSize <= 0 hoặc linePointerCount < 0 thì trả về 0 ngay.',
      'Bước 2 (Cộng tuple): Duyệt tupleSizes, chỉ cộng những phần tử > 0.',
      'Bước 3 (Công thức slotted page): used = 24 + linePointerCount * 4 + tổng tuple.',
      'Bước 4 (Free space): Nếu used >= pageSize trả về 0, ngược lại trả về pageSize - used.',
    ],
    hints: [
      'Đừng quên header 24 byte kể cả khi linePointerCount = 0 và mảng tuple rỗng.',
      'Trường hợp used == pageSize cũng là hết chỗ, trả về 0 chứ không trả số âm.',
    ],
    starterCode: `function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  return 0;
}`,
    solution: `function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  if (pageSize <= 0 || linePointerCount < 0) {
    return 0;
  }
  const HEADER_SIZE = 24;
  const LINE_POINTER_SIZE = 4;
  const totalTuplesSize = Array.isArray(tupleSizes)
    ? tupleSizes.reduce((acc, curr) => acc + (curr > 0 ? curr : 0), 0)
    : 0;
  const usedSpace = HEADER_SIZE + linePointerCount * LINE_POINTER_SIZE + totalTuplesSize;
  if (usedSpace >= pageSize) {
    return 0;
  }
  return pageSize - usedSpace;
}`,
    testCases: [
      {
        name: 'Page 8192 với 2 pointer và tuple 100 + 200',
        input: [8192, 2, [100, 200]],
        expected: 7860,
        hidden: false,
      },
      {
        name: 'Page 500 không đủ chứa header, pointer và tuple',
        input: [500, 10, [300, 200]],
        expected: 0,
        hidden: false,
      },
      {
        name: 'Page rỗng chỉ trừ header 24 byte',
        input: [8192, 0, []],
        expected: 8168,
        hidden: false,
      },
      {
        name: 'Khớp khít 128 byte nên free space bằng 0',
        input: [128, 1, [100]],
        expected: 0,
        hidden: true,
      },
      {
        name: '5 pointer nhưng chưa có payload',
        input: [8192, 5, []],
        expected: 8148,
        hidden: true,
      },
    ],
  },
  codeChallenges: [
    {
      id: 'c5-l1-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Tính Free Space còn lại trong Slotted Page 8KB',
      description: 'Hiện thực hàm `calculateFreeSpace(pageSize, linePointerCount, tupleSizes)`. Page tiêu tốn Page Header cố định 24 byte, mỗi Line Pointer 4 byte, và toàn bộ byte trong `tupleSizes` (bỏ qua phần tử <= 0). Trả về `pageSize - 24 - linePointerCount * 4 - tổng tuple`. Nếu `pageSize <= 0`, `linePointerCount < 0`, hoặc phần đã dùng >= pageSize, trả về 0.',
      guidedSteps: [
        'Bước 1 (Chặn đầu vào): Nếu pageSize <= 0 hoặc linePointerCount < 0 thì trả về 0 ngay.',
        'Bước 2 (Cộng tuple): Duyệt tupleSizes, chỉ cộng những phần tử > 0.',
        'Bước 3 (Công thức slotted page): used = 24 + linePointerCount * 4 + tổng tuple.',
        'Bước 4 (Free space): Nếu used >= pageSize trả về 0, ngược lại trả về pageSize - used.',
      ],
      hints: [
        'Đừng quên header 24 byte kể cả khi linePointerCount = 0 và mảng tuple rỗng.',
        'Trường hợp used == pageSize cũng là hết chỗ, trả về 0 chứ không trả số âm.',
      ],
      starterCode: `function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  return 0;
}`,
      solution: `function calculateFreeSpace(
  pageSize: number,
  linePointerCount: number,
  tupleSizes: number[]
): number {
  if (pageSize <= 0 || linePointerCount < 0) {
    return 0;
  }
  const HEADER_SIZE = 24;
  const LINE_POINTER_SIZE = 4;
  const totalTuplesSize = Array.isArray(tupleSizes)
    ? tupleSizes.reduce((acc, curr) => acc + (curr > 0 ? curr : 0), 0)
    : 0;
  const usedSpace = HEADER_SIZE + linePointerCount * LINE_POINTER_SIZE + totalTuplesSize;
  if (usedSpace >= pageSize) {
    return 0;
  }
  return pageSize - usedSpace;
}`,
      testCases: [
        {
          name: 'Page 8192 với 2 pointer và tuple 100 + 200',
          input: [8192, 2, [100, 200]],
          expected: 7860,
          hidden: false,
        },
        {
          name: 'Page 500 không đủ chứa header, pointer và tuple',
          input: [500, 10, [300, 200]],
          expected: 0,
          hidden: false,
        },
        {
          name: 'Page rỗng chỉ trừ header 24 byte',
          input: [8192, 0, []],
          expected: 8168,
          hidden: false,
        },
        {
          name: 'Khớp khít 128 byte nên free space bằng 0',
          input: [128, 1, [100]],
          expected: 0,
          hidden: true,
        },
        {
          name: '5 pointer nhưng chưa có payload',
          input: [8192, 5, []],
          expected: 8148,
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l1-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Ước lượng cửa sổ REDO sau Checkpoint',
      description: 'Hiện thực hàm `estimateReplayCost(checkpointLsn, crashLsn, bytesPerRecord, segmentBytes)`. Nếu `crashLsn < checkpointLsn` hoặc `bytesPerRecord <= 0` hoặc `segmentBytes <= 0`, trả về `{ records: 0, segments: 0, replayMs: 0 }`. Ngược lại: `records = crashLsn - checkpointLsn`, `segments = ceil(records * bytesPerRecord / segmentBytes)`, `replayMs = round(records * 0.02)`.',
      guidedSteps: [
        'Bước 1 (Cửa sổ âm hoặc tham số rỗng): Trả bộ ba số 0 khi crashLsn < checkpointLsn hoặc bytes/segment không dương.',
        'Bước 2 (Số bản ghi WAL): records = crashLsn - checkpointLsn.',
        'Bước 3 (Số segment 16MB): segments = Math.ceil(records * bytesPerRecord / segmentBytes).',
        'Bước 4 (Thời gian replay): replayMs = Math.round(records * 0.02), trả về object đủ 3 khóa.',
      ],
      hints: [
        'Math.ceil trên thương byte, không làm tròn segments xuống khi tổng byte vừa vượt một segment.',
        'replayMs dùng Math.round, nên 4 * 0.02 = 0.08 làm tròn thành 0.',
      ],
      starterCode: `function estimateReplayCost(
  checkpointLsn: number,
  crashLsn: number,
  bytesPerRecord: number,
  segmentBytes: number
): { records: number; segments: number; replayMs: number } {
  return { records: 0, segments: 0, replayMs: 0 };
}`,
      solution: `function estimateReplayCost(
  checkpointLsn: number,
  crashLsn: number,
  bytesPerRecord: number,
  segmentBytes: number
): { records: number; segments: number; replayMs: number } {
  if (crashLsn < checkpointLsn || bytesPerRecord <= 0 || segmentBytes <= 0) {
    return { records: 0, segments: 0, replayMs: 0 };
  }
  const records = crashLsn - checkpointLsn;
  const segments = Math.ceil((records * bytesPerRecord) / segmentBytes);
  const replayMs = Math.round(records * 0.02);
  return { records, segments, replayMs };
}`,
      testCases: [
        {
          name: '4000 record, 200 byte, segment 16MiB vừa một segment',
          input: [1000, 5000, 200, 16777216],
          expected: { records: 4000, segments: 1, replayMs: 80 },
          hidden: false,
        },
        {
          name: '100000 record * 512 byte tràn thành 4 segment',
          input: [0, 100000, 512, 16777216],
          expected: { records: 100000, segments: 4, replayMs: 2000 },
          hidden: false,
        },
        {
          name: 'crash LSN nhỏ hơn checkpoint thì không replay',
          input: [50, 10, 128, 16777216],
          expected: { records: 0, segments: 0, replayMs: 0 },
          hidden: false,
        },
        {
          name: 'Đúng một segment 4096 byte và replayMs làm tròn về 0',
          input: [0, 4, 1024, 4096],
          expected: { records: 4, segments: 1, replayMs: 0 },
          hidden: true,
        },
        {
          name: 'bytesPerRecord = 0 bị loại',
          input: [0, 10, 0, 4096],
          expected: { records: 0, segments: 0, replayMs: 0 },
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l1-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Chẩn đoán shared_buffers và checkpoint cưỡng bức',
      description: 'Hiện thực hàm `recommendBufferConfig(ramMb, sharedBuffersMb, checkpointsReq, checkpointsTimed)`. Nếu `ramMb` không hữu hạn hoặc <= 0, `throw new Error("INVALID_RAM")`. Nếu một trong ba tham số còn lại < 0, `throw new Error("INVALID_COUNTERS")`. `sharedBuffersPct = round((sharedBuffersMb / ramMb) * 1000) / 10` (một chữ số thập phân). `forcedRatio = 0` khi tổng checkpoint = 0, ngược lại `round((checkpointsReq / tổng) * 1000) / 1000`. `action` theo thứ tự: pct < 15 → `INCREASE_SHARED_BUFFERS`; else forcedRatio > 0.1 → `INCREASE_MAX_WAL_SIZE`; else pct > 40 → `DECREASE_SHARED_BUFFERS`; else `OK`.',
      guidedSteps: [
        'Bước 1 (Validate): Ném INVALID_RAM hoặc INVALID_COUNTERS trước khi chia.',
        'Bước 2 (Phần trăm RAM): sharedBuffersPct = Math.round((sharedBuffersMb / ramMb) * 1000) / 10.',
        'Bước 3 (Tỉ lệ requested): forcedRatio = tổng == 0 ? 0 : Math.round((checkpointsReq / tổng) * 1000) / 1000.',
        'Bước 4 (Thứ tự action): Ưu tiên buffer dưới 15%, rồi forcedRatio > 0.1, rồi buffer trên 40%, còn lại OK.',
      ],
      hints: [
        'Nhân 1000 rồi chia 10 để giữ một số thập phân; 512/8192 ra 6.3 chứ không phải 6.',
        'forcedRatio == 0.1 chưa vượt ngưỡng 0.1, không được chọn INCREASE_MAX_WAL_SIZE.',
      ],
      starterCode: `function recommendBufferConfig(
  ramMb: number,
  sharedBuffersMb: number,
  checkpointsReq: number,
  checkpointsTimed: number
): { sharedBuffersPct: number; action: string; forcedRatio: number } {
  return { sharedBuffersPct: 0, action: 'OK', forcedRatio: 0 };
}`,
      solution: `function recommendBufferConfig(
  ramMb: number,
  sharedBuffersMb: number,
  checkpointsReq: number,
  checkpointsTimed: number
): { sharedBuffersPct: number; action: string; forcedRatio: number } {
  if (!Number.isFinite(ramMb) || ramMb <= 0) {
    throw new Error('INVALID_RAM');
  }
  if (sharedBuffersMb < 0 || checkpointsReq < 0 || checkpointsTimed < 0) {
    throw new Error('INVALID_COUNTERS');
  }
  const sharedBuffersPct = Math.round((sharedBuffersMb / ramMb) * 1000) / 10;
  const totalCp = checkpointsReq + checkpointsTimed;
  const forcedRatio = totalCp === 0 ? 0 : Math.round((checkpointsReq / totalCp) * 1000) / 1000;
  let action = 'OK';
  if (sharedBuffersPct < 15) {
    action = 'INCREASE_SHARED_BUFFERS';
  } else if (forcedRatio > 0.1) {
    action = 'INCREASE_MAX_WAL_SIZE';
  } else if (sharedBuffersPct > 40) {
    action = 'DECREASE_SHARED_BUFFERS';
  }
  return { sharedBuffersPct, action, forcedRatio };
}`,
      testCases: [
        {
          name: '25% RAM và forced ratio 0.02',
          input: [16384, 4096, 2, 98],
          expected: { sharedBuffersPct: 25, action: 'OK', forcedRatio: 0.02 },
          hidden: false,
        },
        {
          name: '6.3% RAM bị thiếu buffer dù forced ratio đúng biên 0.1',
          input: [8192, 512, 1, 9],
          expected: { sharedBuffersPct: 6.3, action: 'INCREASE_SHARED_BUFFERS', forcedRatio: 0.1 },
          hidden: false,
        },
        {
          name: '25% RAM nhưng 40% checkpoint là requested',
          input: [32768, 8192, 40, 60],
          expected: { sharedBuffersPct: 25, action: 'INCREASE_MAX_WAL_SIZE', forcedRatio: 0.4 },
          hidden: false,
        },
        {
          name: 'ramMb = 0 phải ném INVALID_RAM',
          input: [0, 128, 0, 1],
          expected: 'ERROR_THROWN',
          hidden: true,
        },
        {
          name: '50% RAM và không có checkpoint requested',
          input: [16384, 8192, 0, 10],
          expected: { sharedBuffersPct: 50, action: 'DECREASE_SHARED_BUFFERS', forcedRatio: 0 },
          hidden: true,
        },
      ],
    },
  ],
};
