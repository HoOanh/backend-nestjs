import type { Lesson } from '../types.ts';

export const c5_l2: Lesson = {
  id: 'c5-l2',
  title: 'Bài 02: B-Tree Index: Fan-out 8KB, Page Split, Covering Index & Index-Only Scan',
  duration: '60 phút',
  tag: 'B-Tree Index Internals',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị cấu trúc chỉ mục B+-Tree của PostgreSQL từ fan-out đĩa tới chi phí ghi cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Vì sao B+-Tree chứ không phải cây nhị phân:** Tính độ cao theo fan-out của page 8KB; phân biệt root, internal và leaf kèm danh sách liên kết đôi.
> 2. **Page Split, Index Bloat và khóa tăng dần:** Chứng minh UUID v4 ngẫu nhiên làm vỡ page giữa cây, trong khi bigint/UUIDv7 ghi append vào mép phải.
> 3. **Covering Index, Visibility Map và CREATE INDEX CONCURRENTLY:** Phân biệt Index Scan với Index-Only Scan; tạo index không giữ SHARE lock trên Production.

---

# 1. B+-TREE KHỚP KHỐI ĐĨA 8KB

### 1.1 Khái niệm nền tảng: Fan-out quyết định số lần random I/O

Cây nhị phân cân bằng (AVL, Red-Black) có **hệ số rẽ nhánh (fan-out)** bằng 2. Với 10 triệu khóa, độ cao khoảng log2(10^7) ≈ 24. Nếu mỗi nút là một lần đọc đĩa, một point query tốn 24 random read.

PostgreSQL đặt mỗi nút B-Tree vào **một page 8KB**. Một khóa bigint 8 byte cộng con trỏ trang 6 byte và metadata vẫn cho fan-out hàng trăm ở internal page. Leaf page lưu khóa, \`ctid\` và tùy chọn cột \`INCLUDE\`.

1. **Mọi lá cùng độ sâu.** B+-Tree tự cân bằng bằng split/merge, không bằng xoay từng nút như AVL.
2. **Khóa dữ liệu chỉ nằm ở lá.** Internal page chỉ chứa khóa phân tách (separator) và số trang con.
3. **Tìm điểm là O(log_f N) page**, với f là số khóa mỗi page, N là số lá. Root và tầng internal nóng thường nằm trong Shared Buffers, nên random read thật thường chỉ còn lá và heap.

### 1.2 Đối chiếu kiến trúc: Cây nhị phân trong RAM và B+-Tree trên page

| Tiêu chí học thuật | AVL / Red-Black | B+-Tree PostgreSQL | Hệ quả với 10^7 dòng |
| :--- | :--- | :--- | :--- |
| **Fan-out** | 2 | ~100–300 khóa / page 8KB | Độ cao 24 so với 3–4 |
| **Đơn vị nút** | Một object trên heap | Một page 8KB | Một miss cache là một I/O |
| **Dữ liệu** | Có thể nằm mọi nút | Chỉ leaf giữ \`ctid\` | Internal page rất nhỏ, dễ cache |
| **Range scan** | Duyệt trung tố, nhảy con trỏ | Đi ngang \`next\` giữa các lá | Không leo lại root mỗi khóa |
| **Chi phí chèn lệch** | Xoay cục bộ | Page split 50/50, có thể lan lên cha | Random key làm bloat |
| **Khóa trùng** | Tùy cài đặt | PostgreSQL cho phép duplicate, tách bằng \`ctid\` | Unique index vẫn có tie-break |

### 1.3 Cấu trúc lá và bài toán range

Các leaf page móc **danh sách liên kết đôi**. \`SELECT ... WHERE amount BETWEEN 100 AND 500\` tìm lá của 100 bằng đường từ root, rồi đi \`next\` tới khi khóa vượt 500. Không có đường ngang này thì mỗi khóa trong khoảng phải tìm lại từ root.

\`\`\`typescript
// File: src/database/index/btree-split.ts
// 1. THIẾT KẾ SAI: chèn vào mảng đã đầy bằng cách nối thêm, page 8KB không giãn được
export class BrokenLeaf {
  public insert(keys: number[], key: number): number[] {
    return [...keys, key];
  }
}

// 2. THIẾT KẾ CHUẨN: vượt sức chứa thì tách tại median và đẩy separator lên cha
export interface SplitResult {
  readonly splitOccurred: boolean;
  readonly leftKeys: number[];
  readonly rightKeys: number[];
  readonly promotedKey: number | null;
}

export function insertIntoBTreeNode(currentKeys: number[], newKey: number, maxCapacity: number): SplitResult {
  const combined = [...currentKeys, newKey].sort((a, b) => a - b);
  if (combined.length <= maxCapacity) {
    return { splitOccurred: false, leftKeys: combined, rightKeys: [], promotedKey: null };
  }
  const midIndex = Math.floor(combined.length / 2);
  return {
    splitOccurred: true,
    leftKeys: combined.slice(0, midIndex),
    rightKeys: combined.slice(midIndex + 1),
    promotedKey: combined[midIndex],
  };
}
\`\`\`

| Mốc thời gian | Luồng | Thao tác | Trạng thái lá | Hệ quả |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | INSERT uuid v4 vào lá đã 100% | Không còn chỗ trong page 8KB | Free space lá = 0 | Không ghi đè page |
| **\`t = 1 ms\`** | Page split | Cấp page mới, chuyển ~50% khóa | Hai lá ~50% đầy | WAL kèm full page image |
| **\`t = 2 ms\`** | Promote separator | Internal cha nhận khóa giữa | Cha đầy thì split lan lên | Có thể đụng root |
| **\`t = 4 ms\`** | Nối doubly-linked list | Sửa \`prev\`/\`next\` của hàng xóm | Ba lá cùng mức | Range scan vẫn đi ngang được |

### 1.4 Định lượng độ cao

\`\`\`
leafPages = ceil(rowCount / keysPerPage)
height = 1 khi leafPages <= 1
height = ceil(log(leafPages) / log(keysPerPage)) + 1 khi leafPages > 1
randomReads = height nếu không tầng nào nằm trong Shared Buffers
Ví dụ 1.000.000 dòng, 200 khóa/page:
leafPages = 5000, log(5000)/log(200) ≈ 1,61, height = 3
\`\`\`

> **Tổng kết học thuật Phần 1 (Fan-out trước thuật toán cây):**
> 1. **Độ cao B-Tree là hàm của số khóa nhét vừa một page 8KB**, không phải hàm của log2 số dòng.
> 2. **Split là thao tác ghi, không phải tối ưu đọc.** Nó để lại page nửa rỗng cho tới khi page merge hoặc REINDEX.

---

# 2. PAGE SPLIT, KHÓA NGẪU NHIÊN VÀ INDEX BLOAT

### 2.1 Append-only mép phải và chèn vào giữa cây

Khóa tăng đơn điệu (\`bigint GENERATED ALWAYS\`, \`timestamp\`, **UUIDv7**, ULID) luôn rơi vào lá cực phải. Split chỉ xảy ra ở mép phải; các lá bên trái đầy và ổn định.

**UUID v4** phân bố đều trên không gian 128 bit. Mỗi INSERT rơi vào một lá ngẫu nhiên. Lá đầy bị chẻ 50/50 liên tục. Hệ quả đo được:

- WAL tăng vì **full page image** (lần đầu một page bị dirty sau checkpoint, PostgreSQL ghi cả page vào WAL để torn-page protection).
- Tỉ lệ đầy trung bình của lá rơi về khoảng 50–70%, gọi là **index bloat**.
- Shared Buffers giữ nhiều page index nửa rỗng, đẩy heap page nóng ra khỏi cache.

### 2.2 Công thức mật độ sau split ngẫu nhiên

\`\`\`
Sau một split 50/50, hai page con đầy khoảng 50% cho tới khi có INSERT kế tiếp vào đúng nhánh.
UUID v4 làm gần như mọi INSERT ở tải cao chạm một lá đã đầy.
bigint tăng dần chỉ split lá cực phải: các lá đã đóng gần như không bị đụng lại.
\`\`\`

### 2.3 Partial index khi cardinality thấp

Cột \`status\` với vài giá trị không đáng một B-Tree đầy đủ nếu truy vấn luôn là \`status = 'FAILED'\` và FAILED chỉ chiếm ~1%. **Partial index** chỉ chứa hàng thỏa \`WHERE\`:

\`CREATE INDEX ... ON orders (created_at) WHERE status IN ('PENDING', 'PROCESSING');\`

Optimizer chỉ dùng partial index khi mệnh đề truy vấn suy ra được predicate của index. Truy vấn không lọc status sẽ bỏ index này và seq scan.

### 2.4 BRIN, GIN, GiST nằm ngoài B-Tree mặc định

| Loại chỉ mục | Bài toán khớp | Không làm được | Dung lượng tương đối |
| :--- | :--- | :--- | :--- |
| **B-Tree** | \`=\`, \`<\`, \`>\`, \`BETWEEN\`, \`ORDER BY\` khóa | Mảng, full-text, hình học | 20–40% heap nếu khóa rộng |
| **GIN** | \`jsonb\`, mảng, \`tsvector\` | Range trên scalar rẻ bằng B-Tree | Lớn, ghi chậm vì posting list |
| **GiST** | Range, PostGIS, nearest neighbour | Unique đẳng thức đơn giản | Tùy operator class |
| **BRIN** | Bảng append theo thời gian, tương quan vật lý với thứ tự dòng | Cột bị UPDATE xáo trang | Vài MB cho hàng trăm triệu dòng |
| **Hash** | Chỉ \`=\` | Range, unique trước PG 10 không durable | Nhỏ hơn B-Tree một phần |

> **Tổng kết học thuật Phần 2 (Khóa phải có tính cục bộ):**
> Primary key ghi nhiều phải có thứ tự gần với thứ tự chèn. UUID v4 trên bảng append-only là nguồn page split, không phải chuẩn phân tán bắt buộc.

---

# 3. INDEX-ONLY SCAN, VISIBILITY MAP VÀ TẠO INDEX KHÔNG KHÓA GHI

### 3.1 Index Scan vẫn là random heap fetch

B-Tree leaf trả \`ctid\`. Executor mở heap page đó để lấy cột không có trong index và để kiểm tra visibility MVCC. 10.000 \`ctid\` rải trên 10.000 page là 10.000 random read, có khi đắt hơn seq scan cả bảng.

**Index-Only Scan** bỏ heap fetch khi đồng thời đúng hai điều kiện:

1. Mọi cột trong \`SELECT\` và \`WHERE\` nằm trong index (khóa hoặc \`INCLUDE\`).
2. Bit **all-visible** của heap page tương ứng đang bật trên Visibility Map. Nếu bit tắt, executor vẫn heap fetch từng \`ctid\` để áp snapshot.

\`INCLUDE (full_name)\` đặt cột vào leaf nhưng **không** đưa vào separator của internal page, nên fan-out tầng trên không bị cột rộng kéo sập.

### 3.2 Mẫu lệnh và chi phí leaf

\`\`\`typescript
// File: src/database/migrations/covering-index.plan.ts
// Leaf phải chứa mọi cột của SELECT thì mới đủ điều kiện Index-Only Scan
export interface CoveringRequest {
  readonly indexedColumns: readonly string[];
  readonly includedColumns: readonly string[];
  readonly selectedColumns: readonly string[];
  readonly allVisible: boolean;
}

export function canIndexOnlyScan(request: CoveringRequest): boolean {
  const available = new Set([...request.indexedColumns, ...request.includedColumns]);
  const covered = request.selectedColumns.every((column) => available.has(column));
  return covered && request.allVisible;
}
\`\`\`

Cột \`INCLUDE\` rộng (jsonb, text dài) phình leaf, giảm số \`ctid\` mỗi page, tăng độ cao cây. Covering index chỉ đáng khi cột phụ hẹp và nằm trên đường nóng.

### 3.3 CREATE INDEX và SHARE lock

| Lệnh | Khóa | Ghi trong lúc xây | Khi nào dùng |
| :--- | :--- | :--- | :--- |
| **\`CREATE INDEX\`** | \`SHARE\` trên bảng, chặn INSERT/UPDATE/DELETE | Một lần quét | Bảng nhỏ, cửa sổ bảo trì |
| **\`CREATE INDEX CONCURRENTLY\`** | \`SHARE UPDATE EXCLUSIVE\`, vẫn cho DML | Hai lần quét, chờ transaction cũ | Production, bảng đang phục vụ |
| **\`REINDEX INDEX CONCURRENTLY\`** | Tương tự, xây bản mới rồi đổi tên | Ghi song song bản index mới | Bloat sau UUID hoặc sau bulk update |
| **\`DROP INDEX CONCURRENTLY\`** | Không khóa lâu như DROP thường | Không | Gỡ index sai giờ cao điểm |

\`CONCURRENTLY\` không chạy được bên trong một block transaction. Migration TypeORM phải tách \`transaction = false\` hoặc dùng \`queryRunner\` với session autocommit. Nếu lần quét thứ hai gặp lỗi, index ở trạng thái \`INVALID\` và bị planner bỏ qua cho tới khi \`DROP\` rồi tạo lại.

### 3.4 Chẩn đoán bloat và index không được dùng

- \`pg_stat_user_indexes.idx_scan = 0\` sau nhiều ngày: index chỉ tốn ghi.
- \`pg_stat_user_indexes.idx_blks_read\` cao so với \`idx_blks_hit\`: lá không nằm trong cache, fan-out hoặc working set đang lệch.
- \`EXPLAIN (ANALYZE, BUFFERS)\` hiện \`Heap Fetches: N\` lớn trong Index Only Scan: VM chưa all-visible, cần VACUUM.

> **Tổng kết học thuật Phần 3 (Index không miễn phí ở chiều ghi):**
> Mỗi index là một B-Tree phải sửa trong cùng WAL của \`INSERT\`/\`UPDATE\`/\`DELETE\`. Thêm covering index chỉ khi \`EXPLAIN\` chứng minh heap fetch là phần trội của latency.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống B+-Tree PostgreSQL (Root, Internal, Leaf)
\`\`\`diagram
[TOPOLOGY: taxonomy-tree]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG GỐC VÀ TẦNG TRONG (ROOT & INTERNAL PAGES)                             │
│    ├── Root Page (Separator Keys): Vài trăm khóa, gần như luôn trong RAM      │
│    ├── Internal Fan-out (Child Block Numbers): log_f(N) quyết định độ cao     │
│    └── High Key (Page Boundary): Khóa phải nhất dùng khi đi xuống             │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Đi xuống đúng một con theo khoảng khóa
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG LÁ LIÊN KẾT ĐÔI (LEAF PAGES & CTID)                                   │
│    ├── Leaf Keys + ctid (Heap Address): Khóa tìm thấy và địa chỉ dòng         │
│    ├── INCLUDE Columns (Covering Payload): Cột phụ không tham gia separator   │
│    └── Doubly Linked Leaves (Range Walk): next/prev cho BETWEEN               │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Heap fetch nếu thiếu cột hoặc VM chưa all-visible
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG HEAP VÀ BẢN ĐỒ KHẢ KIẾN (HEAP PAGE & VISIBILITY MAP)                  │
│    ├── Heap Tuple (MVCC xmin/xmax): Cột không có trong index                  │
│    ├── Visibility Map Bit (All-Visible): Cho phép bỏ heap fetch               │
│    └── WAL Full Page Image (Split Cost): Ghi cả page khi split sau checkpoint │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Index Scan Thường Và Index-Only Scan
\`\`\`diagram
MÔ HÌNH CŨ: INDEX SCAN RỒI RANDOM HEAP FETCH THEO CTID
Probe ──► [ Leaf trả ctid ] ──► [ Đọc heap page rải rác ] ──► RANDOM I/O THEO SỐ DÒNG
10.000 dòng trúng = 10.000 heap fetch, latency tiệm cận seq scan dù đã có B-Tree.

MÔ HÌNH HIỆN ĐẠI: COVERING INDEX VÀ VISIBILITY MAP ALL-VISIBLE
SELECT cột INCLUDE ──┐
Predicate trên khóa ──┼──► [ Leaf đã chứa đủ cột ] ──► Index Only Scan
VM all-visible ───────┘               │
                                      └──► Bit VM tắt thì heap fetch lại ────► VACUUM để bật all-visible
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Có đánh index hay không, loại nào)
\`\`\`diagram
                      BẢNG NÀY CÓ CẦN THÊM MỘT B-TREE KHÔNG?
                                     │
                                     ▼
                         Số dòng và độ chọn lọc của predicate?
                         /                          \\
           DƯỚI VÀI NGHÌN DÒNG HOẶC CHỌN LỌC THẤP    CỘT LỌC GẦN NHƯ DUY NHẤT
                   /                                      \\
                  ▼                                        ▼
        [ SEQ SCAN (CHUẨN) ]                      Query có lấy thêm cột hẹp không?
        - Page cache nuốt hết bảng                /                          \\
        - B-Tree chỉ thêm chi phí ghi             CÓ, CỘT PHỤ HẸP                 KHÔNG, CHỈ LỌC KHÓA
        - Partial index nếu chỉ một trạng thái hiếm     /                            \\
                                              ▼                                        ▼
                                    [ COVERING INCLUDE (TỐI ƯU) ]           [ B-TREE KHÓA (CHUẨN) ]
                                    - Không nhét INCLUDE vào separator      - Khóa tăng dần, tránh UUID v4
                                    - Cần VM all-visible                    - CREATE INDEX CONCURRENTLY
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Kiểu khóa và kiểu index)

| Tiêu Chí So Sánh | Không index | B-Tree khóa tăng dần | B-Tree UUID v4 | Covering INCLUDE |
| :--- | :--- | :--- | :--- | :--- |
| **Đọc point query** | O(N) page tuần tự | O(log_f N) + 1 heap | O(log_f N) nhưng cây cao hơn vì bloat | O(log_f N), heap fetch = 0 nếu VM bật |
| **Ghi INSERT** | Chỉ heap + WAL heap | Split ở mép phải | Split ngẫu nhiên, full page image dày | Thêm byte leaf mỗi lần sửa cột INCLUDE |
| **RAM cache** | Chỉ heap | Internal page nhỏ, ổn định | Nhiều lá 50% rỗng | Leaf to hơn, ít ctid mỗi page |
| **Vận hành** | Seq scan khi bảng lớn | \`CONCURRENTLY\` khi tạo mới | Cân nhắc UUIDv7 hoặc bigint | Bỏ INCLUDE nếu cột phụ là jsonb lớn |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

1. **Định đề 1 (Độ cao theo fan-out page):** \`leafPages = ceil(rowCount / keysPerPage)\`. Một lá thì height = 1. Nhiều lá thì \`height = ceil(log(leafPages) / log(keysPerPage)) + 1\`. Random read tối đa bằng height cộng heap fetch, không bằng log2(N).
2. **Định đề 2 (Split 50/50 là chi phí của khóa ngẫu nhiên):** Vượt sức chứa thì median bị promote, hai phía giữ phần còn lại. UUID v4 rải split khắp cây; khóa tăng dần chỉ chẻ lá cực phải.
3. **Định đề 3 (Index-Only Scan cần cả cột lẫn VM):** \`INCLUDE\` đưa cột vào leaf. Bit all-visible tắt thì executor vẫn đọc heap. VACUUM là một phần của kế hoạch covering, không phải việc tùy chọn.
4. **Định đề 4 (Khóa ghi khi xây index):** \`CREATE INDEX\` thường giữ SHARE lock chặn DML. Trên bảng đang phục vụ, dùng \`CREATE INDEX CONCURRENTLY\` ngoài transaction block và xử lý index \`INVALID\` nếu lần quét hai thất bại.
  `,
  realCodeSnippet: `// File: src/database/migrations/1700000000000-OptimizeHighThroughputIndexing.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Partial index và covering index không khóa ghi
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-052: Index trên bảng đang phục vụ.
 * 1. Partial index chỉ giữ đơn PENDING/PROCESSING (~1% heap) để worker kéo hàng theo created_at.
 * 2. Covering index (tenant_id, email) INCLUDE tên và cờ active cho đường đăng nhập,
 *    đủ cột để Index Only Scan khi Visibility Map all-visible.
 * 3. CONCURRENTLY tránh SHARE lock. transaction = false vì CONCURRENTLY cấm nằm trong BEGIN/COMMIT.
 * 4. down() cũng DROP CONCURRENTLY để không khóa ghi lúc rollback migration.
 */
export class OptimizeHighThroughputIndexing1700000000000 implements MigrationInterface {
  public transaction = false;

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
    await queryRunner.query(\`DROP INDEX CONCURRENTLY IF EXISTS idx_users_lookup_covering;\`);
    await queryRunner.query(\`DROP INDEX CONCURRENTLY IF EXISTS idx_orders_unprocessed;\`);
  }
}

export const INDEX_BUILD_LOCK = 'SHARE UPDATE EXCLUSIVE' as const;
`,
  quiz: [
    {
      id: 'c5-l2-q1',
      question: 'Page split của B-Tree PostgreSQL xảy ra khi nào và để lại gì?',
      options: [
        'Khi lá 8KB đã đầy: cấp page mới, chuyển khoảng một nửa khóa, promote separator, WAL có thể ghi full page image.',
        'Khi SELECT trả về quá 100 dòng, planner tự chẻ index thành hai file để đọc song song trên đĩa NVMe.',
        'Khi RAM dưới 1GB, postmaster xóa ngẫu nhiên một nửa khóa để giải phóng Shared Buffers.',
        'Khi chạy VACUUM FULL, mọi page bị nhân đôi dù không có INSERT mới.',
      ],
      correctIndex: 0,
      explanation: 'Page 8KB không giãn. Split cân bằng tạm thời quanh median rồi móc lại linked list. Trang cũ và trang mới đều khoảng nửa đầy, đó là nguồn index bloat nếu split lặp trên khóa ngẫu nhiên.',
    },
    {
      id: 'c5-l2-q2',
      question: 'Vì sao UUID v4 làm primary key ghi dày tệ hơn bigint tăng dần?',
      options: [
        'Vì UUID chiếm ít byte hơn bigint nên fan-out tăng và cây mất cân bằng ngược trên mọi INSERT.',
        'Vì giá trị v4 rơi đều khắp lá, mỗi INSERT dễ trúng page đầy và split giữa cây thay vì chỉ mép phải.',
        'Vì PostgreSQL từ chối so sánh UUID nên mọi lookup thành seq scan.',
        'Vì WAL không ghi được kiểu 16 byte nên mỗi INSERT thành một checkpoint.',
      ],
      correctIndex: 1,
      explanation: 'Tính cục bộ của khóa quyết định lá nào bị đụng. Khóa tăng dần chỉ làm nóng lá cực phải. UUID v4 phá cục bộ, nhân full page image và để lại lá thưa.',
    },
    {
      id: 'c5-l2-q3',
      question: 'Danh sách liên kết đôi giữa các leaf phục vụ truy vấn nào?',
      options: [
        'Chỉ các lệnh DDL như ALTER TABLE, không tham gia DML.',
        'Range như BETWEEN: tìm lá đầu bằng đường từ root rồi đi next cho tới khi vượt cận trên.',
        'Mọi JOIN hash, vì hash table được xây từ con trỏ next của index.',
        'Kết nối replication, gửi từng leaf page sang standby theo thứ tự prev của linked list.',
      ],
      correctIndex: 1,
      explanation: 'Point query dừng ở một lá. Range query không tìm lại từ root cho từng khóa. next/prev giữ thứ tự khóa giữa các page cùng mức.',
    },
    {
      id: 'c5-l2-q4',
      question: 'INCLUDE trong CREATE INDEX khác cột khóa ở điểm nào?',
      options: [
        'Cột INCLUDE được mã hóa và không bao giờ xuất hiện trong EXPLAIN.',
        'Cột INCLUDE chỉ nằm ở leaf để covering, không đi vào separator của internal page.',
        'Cột INCLUDE thay thế hoàn toàn khóa, planner không còn dùng cột đứng trước.',
        'Cột INCLUDE bị lưu ở heap phụ và mọi lần đọc vẫn là random I/O.',
      ],
      correctIndex: 1,
      explanation: 'Mục tiêu của INCLUDE là nhét payload hẹp vào leaf mà không làm giảm fan-out tầng trên. Cột này không dùng để tìm đường từ root và không có thứ tự riêng.',
    },
    {
      id: 'c5-l2-q5',
      question: 'Index-Only Scan vẫn heap fetch khi nào?',
      options: [
        'Khi bit all-visible của heap page trên Visibility Map đang tắt, dù leaf đã có đủ cột.',
        'Khi bảng có dưới 100 dòng vì planner cấm mọi index scan.',
        'Khi khóa là bigint, vì chỉ UUID mới được ở lại trong leaf và bỏ qua heap.',
        'Khi câu lệnh là SELECT không có WHERE.',
      ],
      correctIndex: 0,
      explanation: 'Leaf không lưu xmin/xmax của heap. Snapshot vẫn phải kiểm tra visibility. VM all-visible là lối tắt an toàn; bit tắt thì từng ctid bị mở heap page.',
    },
    {
      id: 'c5-l2-q6',
      question: 'Partial index trên status = FAILED có tác dụng khi nào?',
      options: [
        'Mọi SELECT trên bảng, kể cả khi không nhắc tới status.',
        'Khi predicate truy vấn chứng minh được hàng kết quả nằm trong WHERE của index, thường là giá trị hiếm.',
        'Chỉ khi chạy ANALYZE, còn lúc thực thi planner luôn bỏ qua partial index dù WHERE khớp.',
        'Khi FAILED chiếm 90% bảng, vì lúc đó index gần bằng heap.',
      ],
      correctIndex: 1,
      explanation: 'Partial index nhỏ vì chỉ chứa tập con. Planner đối chiếu WHERE của câu lệnh với predicate index. Không suy ra được thì index vô hình với câu đó.',
    },
    {
      id: 'c5-l2-q7',
      question: 'Fan-out vài trăm trên page 8KB thay đổi độ cao cây ra sao so với cây nhị phân?',
      options: [
        'Độ cao vẫn khoảng 24 với 10 triệu khóa vì mọi cây tìm kiếm đều là log2.',
        'Độ cao rơi xuống khoảng 3–4, root và internal thường nằm trong Shared Buffers.',
        'Cây trở thành một list, mọi tìm kiếm thành O(N) trong một page.',
        'Fan-out chỉ ảnh hưởng WAL, không ảnh hưởng số page phải đọc.',
      ],
      correctIndex: 1,
      explanation: 'Độ cao là logarit cơ số fan-out của số lá. Page 8KB nâng cơ số từ 2 lên hàng trăm nên số lần xuống page giảm một bậc độ lớn.',
    },
    {
      id: 'c5-l2-q8',
      question: 'Vì sao Production dùng CREATE INDEX CONCURRENTLY?',
      options: [
        'Vì lệnh thường giữ SHARE lock và chặn INSERT/UPDATE/DELETE cho tới khi quét xong.',
        'Vì CONCURRENTLY nén index bằng gzip nên file nhỏ hơn một nửa.',
        'Vì lệnh thường làm crash postmaster nếu có trên 10 kết nối.',
        'Vì CONCURRENTLY bỏ qua WAL nên xây index nhanh hơn trên replica vật lý.',
      ],
      correctIndex: 0,
      explanation: 'SHARE lock cho phép SELECT nhưng chặn DML. CONCURRENTLY quét hai pha, chờ transaction đang mở, và không được bọc trong transaction block. Index lỗi nằm ở trạng thái INVALID.',
    },
  ],
  codeChallenge: {
    id: 'c5-l2-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Chèn khóa vào nút B-Tree và phát hiện Page Split',
    description: 'Hiện thực hàm `insertIntoBTreeNode(currentKeys, newKey, maxCapacity)`. Nối `newKey` vào bản sao của `currentKeys` rồi sắp tăng dần. Nếu độ dài mới <= maxCapacity, trả về `{ splitOccurred: false, leftKeys: mảng đã sắp, rightKeys: [], promotedKey: null }`. Nếu vượt, `midIndex = Math.floor(len / 2)`, `promotedKey = combined[midIndex]`, `leftKeys = combined.slice(0, midIndex)`, `rightKeys = combined.slice(midIndex + 1)`, `splitOccurred: true`.',
    guidedSteps: [
      'Bước 1 (Gộp và sắp): combined = [...currentKeys, newKey].sort((a, b) => a - b).',
      'Bước 2 (Còn chỗ): Nếu combined.length <= maxCapacity thì không split, leftKeys = combined.',
      'Bước 3 (Median): midIndex = Math.floor(combined.length / 2), promotedKey = combined[midIndex].',
      'Bước 4 (Hai nhánh): leftKeys lấy trước mid, rightKeys lấy sau mid, bỏ chính phần tử được promote.',
    ],
    hints: [
      'Không sort tại chỗ trên currentKeys vì mảng đầu vào của test có thể được đối chiếu tiếp.',
      'Phần tử median không nằm trong leftKeys cũng không nằm trong rightKeys.',
    ],
    starterCode: `function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null } {
  return { splitOccurred: false, leftKeys: [], rightKeys: [], promotedKey: null };
}`,
    solution: `function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null } {
  const combined = Array.isArray(currentKeys) ? [...currentKeys, newKey] : [newKey];
  combined.sort((a, b) => a - b);
  if (combined.length <= maxCapacity) {
    return { splitOccurred: false, leftKeys: combined, rightKeys: [], promotedKey: null };
  }
  const midIndex = Math.floor(combined.length / 2);
  return {
    splitOccurred: true,
    leftKeys: combined.slice(0, midIndex),
    rightKeys: combined.slice(midIndex + 1),
    promotedKey: combined[midIndex],
  };
}`,
    testCases: [
      {
        name: 'Chèn 20 vào [10, 30] vẫn vừa sức chứa 3',
        input: [[10, 30], 20, 3],
        expected: { splitOccurred: false, leftKeys: [10, 20, 30], rightKeys: [], promotedKey: null },
        hidden: false,
      },
      {
        name: 'Chèn 30 vào lá đầy gây split, promote 30',
        input: [[10, 20, 40], 30, 3],
        expected: { splitOccurred: true, leftKeys: [10, 20], rightKeys: [40], promotedKey: 30 },
        hidden: false,
      },
      {
        name: 'Nút rỗng nhận khóa đầu',
        input: [[], 50, 2],
        expected: { splitOccurred: false, leftKeys: [50], rightKeys: [], promotedKey: null },
        hidden: false,
      },
      {
        name: 'Split với số âm và 0 tại median',
        input: [[-20, -10, 10, 20], 0, 4],
        expected: { splitOccurred: true, leftKeys: [-20, -10], rightKeys: [10, 20], promotedKey: 0 },
        hidden: true,
      },
      {
        name: 'Khóa trùng vẫn split khi vượt sức chứa',
        input: [[5, 10], 10, 2],
        expected: { splitOccurred: true, leftKeys: [5], rightKeys: [10], promotedKey: 10 },
        hidden: true,
      },
    ],
  },
  codeChallenges: [
    {
      id: 'c5-l2-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Chèn khóa vào nút B-Tree và phát hiện Page Split',
      description: 'Hiện thực hàm `insertIntoBTreeNode(currentKeys, newKey, maxCapacity)`. Nối `newKey` vào bản sao của `currentKeys` rồi sắp tăng dần. Nếu độ dài mới <= maxCapacity, trả về `{ splitOccurred: false, leftKeys: mảng đã sắp, rightKeys: [], promotedKey: null }`. Nếu vượt, `midIndex = Math.floor(len / 2)`, `promotedKey = combined[midIndex]`, `leftKeys = combined.slice(0, midIndex)`, `rightKeys = combined.slice(midIndex + 1)`, `splitOccurred: true`.',
      guidedSteps: [
        'Bước 1 (Gộp và sắp): combined = [...currentKeys, newKey].sort((a, b) => a - b).',
        'Bước 2 (Còn chỗ): Nếu combined.length <= maxCapacity thì không split, leftKeys = combined.',
        'Bước 3 (Median): midIndex = Math.floor(combined.length / 2), promotedKey = combined[midIndex].',
        'Bước 4 (Hai nhánh): leftKeys lấy trước mid, rightKeys lấy sau mid, bỏ chính phần tử được promote.',
      ],
      hints: [
        'Không sort tại chỗ trên currentKeys vì mảng đầu vào của test có thể được đối chiếu tiếp.',
        'Phần tử median không nằm trong leftKeys cũng không nằm trong rightKeys.',
      ],
      starterCode: `function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null } {
  return { splitOccurred: false, leftKeys: [], rightKeys: [], promotedKey: null };
}`,
      solution: `function insertIntoBTreeNode(
  currentKeys: number[],
  newKey: number,
  maxCapacity: number
): { splitOccurred: boolean; leftKeys: number[]; rightKeys: number[]; promotedKey: number | null } {
  const combined = Array.isArray(currentKeys) ? [...currentKeys, newKey] : [newKey];
  combined.sort((a, b) => a - b);
  if (combined.length <= maxCapacity) {
    return { splitOccurred: false, leftKeys: combined, rightKeys: [], promotedKey: null };
  }
  const midIndex = Math.floor(combined.length / 2);
  return {
    splitOccurred: true,
    leftKeys: combined.slice(0, midIndex),
    rightKeys: combined.slice(midIndex + 1),
    promotedKey: combined[midIndex],
  };
}`,
      testCases: [
        {
          name: 'Chèn 20 vào [10, 30] vẫn vừa sức chứa 3',
          input: [[10, 30], 20, 3],
          expected: { splitOccurred: false, leftKeys: [10, 20, 30], rightKeys: [], promotedKey: null },
          hidden: false,
        },
        {
          name: 'Chèn 30 vào lá đầy gây split, promote 30',
          input: [[10, 20, 40], 30, 3],
          expected: { splitOccurred: true, leftKeys: [10, 20], rightKeys: [40], promotedKey: 30 },
          hidden: false,
        },
        {
          name: 'Nút rỗng nhận khóa đầu',
          input: [[], 50, 2],
          expected: { splitOccurred: false, leftKeys: [50], rightKeys: [], promotedKey: null },
          hidden: false,
        },
        {
          name: 'Split với số âm và 0 tại median',
          input: [[-20, -10, 10, 20], 0, 4],
          expected: { splitOccurred: true, leftKeys: [-20, -10], rightKeys: [10, 20], promotedKey: 0 },
          hidden: true,
        },
        {
          name: 'Khóa trùng vẫn split khi vượt sức chứa',
          input: [[5, 10], 10, 2],
          expected: { splitOccurred: true, leftKeys: [5], rightKeys: [10], promotedKey: 10 },
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l2-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Ước lượng độ cao B+-Tree theo fan-out',
      description: 'Hiện thực hàm `estimateIndexDepth(rowCount, keysPerPage)`. Nếu `rowCount <= 0` hoặc `keysPerPage <= 1`, trả về `{ height: 0, leafPages: 0, randomReads: 0 }`. Ngược lại `leafPages = Math.ceil(rowCount / keysPerPage)`. Nếu `leafPages <= 1` thì `height = 1`, else `height = Math.ceil(Math.log(leafPages) / Math.log(keysPerPage)) + 1`. `randomReads = height`.',
      guidedSteps: [
        'Bước 1 (Loại fan-out vô nghĩa): keysPerPage <= 1 hoặc rowCount <= 0 trả về ba số 0.',
        'Bước 2 (Số lá): leafPages = Math.ceil(rowCount / keysPerPage).',
        'Bước 3 (Độ cao): Một lá thì height = 1; nhiều lá thì ceil(log(leafPages)/log(keysPerPage)) + 1.',
        'Bước 4 (I/O trần): randomReads bằng height, trả object đủ ba khóa.',
      ],
      hints: [
        'Math.log là log tự nhiên; tỉ số hai log cùng cơ số chính là log cơ số keysPerPage.',
        '100 lá với fan-out 100 cho height = 2 (root + lá), không phải 1.',
      ],
      starterCode: `function estimateIndexDepth(
  rowCount: number,
  keysPerPage: number
): { height: number; leafPages: number; randomReads: number } {
  return { height: 0, leafPages: 0, randomReads: 0 };
}`,
      solution: `function estimateIndexDepth(
  rowCount: number,
  keysPerPage: number
): { height: number; leafPages: number; randomReads: number } {
  if (rowCount <= 0 || keysPerPage <= 1) {
    return { height: 0, leafPages: 0, randomReads: 0 };
  }
  const leafPages = Math.ceil(rowCount / keysPerPage);
  const height = leafPages <= 1 ? 1 : Math.ceil(Math.log(leafPages) / Math.log(keysPerPage)) + 1;
  return { height, leafPages, randomReads: height };
}`,
      testCases: [
        {
          name: '100 dòng vừa một lá',
          input: [100, 100],
          expected: { height: 1, leafPages: 1, randomReads: 1 },
          hidden: false,
        },
        {
          name: '10.000 dòng, fan-out 100, root trỏ thẳng 100 lá',
          input: [10000, 100],
          expected: { height: 2, leafPages: 100, randomReads: 2 },
          hidden: false,
        },
        {
          name: '1.000.000 dòng, 200 khóa mỗi page, cao 3 tầng',
          input: [1000000, 200],
          expected: { height: 3, leafPages: 5000, randomReads: 3 },
          hidden: false,
        },
        {
          name: 'rowCount = 0 không dựng cây',
          input: [0, 100],
          expected: { height: 0, leafPages: 0, randomReads: 0 },
          hidden: true,
        },
        {
          name: '250 dòng thành 3 lá vẫn cần root',
          input: [250, 100],
          expected: { height: 2, leafPages: 3, randomReads: 2 },
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l2-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Phân loại khóa chính theo rủi ro Page Split',
      description: 'Hiện thực hàm `classifyPrimaryKey(keyType, insertRate, includeColumns)`. `keyType` chỉ được là `serial`, `uuidv7`, `uuidv4`, `ulid`; khác thì `throw new Error("UNKNOWN_KEY_TYPE")`. Nếu `insertRate < 0` hoặc `includeColumns < 0`, `throw new Error("INVALID_METRICS")`. `indexOnlyEligible = includeColumns > 0`. Nếu keyType là `uuidv4`, trả `{ recommendation: "AVOID_RANDOM_PK", splitRisk: "HIGH", indexOnlyEligible }`. Else nếu `insertRate > 8000`, trả `{ recommendation: "USE_TIME_ORDERED_KEY", splitRisk: "MEDIUM", indexOnlyEligible }`. Còn lại `{ recommendation: "BTREE_APPEND_OK", splitRisk: "LOW", indexOnlyEligible }`.',
      guidedSteps: [
        'Bước 1 (Tập khóa hợp lệ): Ngoài serial/uuidv7/uuidv4/ulid thì ném UNKNOWN_KEY_TYPE.',
        'Bước 2 (Tham số âm): insertRate hoặc includeColumns âm thì ném INVALID_METRICS.',
        'Bước 3 (UUID v4 ưu tiên cao nhất): AVOID_RANDOM_PK và splitRisk HIGH dù insertRate thấp.',
        'Bước 4 (Ngưỡng ghi): insertRate > 8000 thì MEDIUM, biên 8000 vẫn là BTREE_APPEND_OK nếu không phải uuidv4.',
      ],
      hints: [
        'Kiểm tra uuidv4 trước ngưỡng insertRate, vì khóa ngẫu nhiên không được cứu bởi việc ghi ít.',
        'includeColumns = 0 làm indexOnlyEligible false; số dương chỉ bật cờ, không đổi recommendation.',
      ],
      starterCode: `function classifyPrimaryKey(
  keyType: string,
  insertRate: number,
  includeColumns: number
): { recommendation: string; splitRisk: string; indexOnlyEligible: boolean } {
  return { recommendation: 'BTREE_APPEND_OK', splitRisk: 'LOW', indexOnlyEligible: false };
}`,
      solution: `function classifyPrimaryKey(
  keyType: string,
  insertRate: number,
  includeColumns: number
): { recommendation: string; splitRisk: string; indexOnlyEligible: boolean } {
  const allowed = ['serial', 'uuidv7', 'uuidv4', 'ulid'];
  if (!allowed.includes(keyType)) {
    throw new Error('UNKNOWN_KEY_TYPE');
  }
  if (insertRate < 0 || includeColumns < 0) {
    throw new Error('INVALID_METRICS');
  }
  const indexOnlyEligible = includeColumns > 0;
  if (keyType === 'uuidv4') {
    return { recommendation: 'AVOID_RANDOM_PK', splitRisk: 'HIGH', indexOnlyEligible };
  }
  if (insertRate > 8000) {
    return { recommendation: 'USE_TIME_ORDERED_KEY', splitRisk: 'MEDIUM', indexOnlyEligible };
  }
  return { recommendation: 'BTREE_APPEND_OK', splitRisk: 'LOW', indexOnlyEligible };
}`,
      testCases: [
        {
          name: 'serial ghi vừa, không INCLUDE',
          input: ['serial', 1000, 0],
          expected: { recommendation: 'BTREE_APPEND_OK', splitRisk: 'LOW', indexOnlyEligible: false },
          hidden: false,
        },
        {
          name: 'uuidv4 dù ghi ít vẫn rủi ro cao, INCLUDE bật index-only',
          input: ['uuidv4', 100, 2],
          expected: { recommendation: 'AVOID_RANDOM_PK', splitRisk: 'HIGH', indexOnlyEligible: true },
          hidden: false,
        },
        {
          name: 'uuidv7 vượt 8000 insert/s',
          input: ['uuidv7', 9000, 1],
          expected: { recommendation: 'USE_TIME_ORDERED_KEY', splitRisk: 'MEDIUM', indexOnlyEligible: true },
          hidden: false,
        },
        {
          name: 'snowflake không nằm trong tập khóa',
          input: ['snowflake', 10, 0],
          expected: 'ERROR_THROWN',
          hidden: true,
        },
        {
          name: 'ulid đúng biên 8000 vẫn append ổn',
          input: ['ulid', 8000, 0],
          expected: { recommendation: 'BTREE_APPEND_OK', splitRisk: 'LOW', indexOnlyEligible: false },
          hidden: true,
        },
      ],
    },
  ],
};
