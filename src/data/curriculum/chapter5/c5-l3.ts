import type { Lesson } from '../types.ts';

export const c5_l3: Lesson = {
  id: 'c5-l3',
  title: 'Bài 03: Cost-Based Optimizer: EXPLAIN (ANALYZE, BUFFERS), Seq Scan, Index Scan & Bitmap Scan',
  duration: '60 phút',
  tag: 'Query Optimization & EXPLAIN',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị bộ tối ưu theo chi phí của PostgreSQL và cách đọc kế hoạch thực thi cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Mô hình chi phí (Cost Model) và thống kê \`pg_statistic\`:** Phân biệt startup cost với total cost; hiểu \`seq_page_cost\`, \`random_page_cost\`, \`cpu_tuple_cost\`.
> 2. **Ba đường đọc heap:** Sequential Scan, Index Scan, Bitmap Scan; chọn theo độ chọn lọc và kích thước bảng, không theo thói quen "có index là nhanh".
> 3. **EXPLAIN (ANALYZE, BUFFERS) trên NestJS:** Đối chiếu rows ước tính với rows thực, đọc shared hit/read, và biết khi nào phải ANALYZE lại sau bulk load.

---

# 1. BỘ TỐI ƯU THEO CHI PHÍ

### 1.1 Khái niệm nền tảng: Planner không chạy câu lệnh để thử

Một câu SQL đi qua **parser** (cú pháp), **rewriter** (luật, view, RLS) rồi **planner**. Planner dựng nhiều **đường truy cập (Access Path)** và nhiều thứ tự nối bảng, gán mỗi phương án một số **cost** không có đơn vị thời gian tường minh. Executor chỉ chạy phương án có total cost thấp nhất.

Cost được cộng từ hai họ hệ số trong \`postgresql.conf\`:

1. **I/O:** \`seq_page_cost = 1.0\` cho đọc tuần tự một page 8KB, \`random_page_cost = 4.0\` mặc định (giả định HDD). Trên NVMe, random và seq xích lại gần nhau; nhiều cụm đặt \`random_page_cost\` trong khoảng 1,1–1,5.
2. **CPU:** \`cpu_tuple_cost = 0.01\` mỗi dòng đi qua node, \`cpu_operator_cost = 0.0025\` mỗi lần so sánh, \`cpu_index_tuple_cost = 0.005\` mỗi mục index.

Planner **không biết** millisecond. Nó biết số page từ \`relpages\`, số dòng từ \`reltuples\`, và phân phối từ \`pg_statistic\` (histogram, most common values, null fraction, n_distinct). \`ANALYZE\` (hoặc autovacuum) là thứ làm mới các số đó.

### 1.2 Đối chiếu kiến trúc: Ước tính trước khi chạy và số đo sau khi chạy

| Tiêu chí học thuật | \`EXPLAIN\` | \`EXPLAIN ANALYZE\` | \`EXPLAIN (ANALYZE, BUFFERS)\` |
| :--- | :--- | :--- | :--- |
| **Có chạy câu lệnh không** | Không | Có, đủ vòng lặp thật | Có |
| **Số hiện** | cost, rows ước tính, width | Thêm actual time, actual rows, loops | Thêm shared hit/read, dirtied, written |
| **Tác dụng phụ** | Không đổi dữ liệu | \`UPDATE\`/\`DELETE\` chạy thật | Giống ANALYZE, cần transaction rollback nếu chỉ muốn đo ghi |
| **Đọc lệch thống kê** | Chỉ thấy plan "đẹp" trên giấy | \`rows=\` ước tính lệch \`actual rows\` hàng chục lần | Hit thấp giải thích vì sao actual time xấu dù plan đúng |
| **Nơi dùng** | Xem shape trên staging | Đo một câu an toàn | Production có kiểm soát, câu đọc |

### 1.3 Startup cost, total cost và bài toán LIMIT

Dòng plan dạng \`cost=startup..total\`. **Startup** là chi phí trước khi trả dòng đầu. **Total** là chi phí để trả hết số dòng ước tính.

Sort và Hash Aggregate có startup cao vì phải tiêu thụ hết nhánh con trước khi xuất dòng. Nested Loop và Index Scan point có startup thấp. \`LIMIT 10\` làm planner ưa plan startup thấp dù total cost của plan đó cao hơn nếu phải chạy đến hết.

\`\`\`typescript
// File: src/database/explain/plan-cost.parser.ts
// 1. THIẾT KẾ SAI: so sánh chuỗi EXPLAIN bằng mắt, không tách hai vế cost
export class BrokenExplainReader {
  public slow(planLine: string): boolean {
    return planLine.includes('Seq Scan');
  }
}

// 2. THIẾT KẾ CHUẨN: tách startup..total, ngưỡng total cost là quy ước vận hành
export function analyzePlanCosts(planLine: string): { startupCost: number; totalCost: number; isHighCost: boolean } {
  const match = typeof planLine === 'string' ? planLine.match(/cost=([0-9.]+)\.\.([0-9.]+)/) : null;
  if (!match) {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }
  const startupCost = Number.parseFloat(match[1]);
  const totalCost = Number.parseFloat(match[2]);
  return {
    startupCost: Number.isNaN(startupCost) ? 0 : startupCost,
    totalCost: Number.isNaN(totalCost) ? 0 : totalCost,
    isHighCost: totalCost > 100,
  };
}
\`\`\`

| Mốc thời gian | Luồng | Việc planner / executor | Bộ đếm | Hệ quả |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | SELECT theo user_id | Đọc \`pg_statistic\` của cột | n_distinct, MCV | Chọn lọc ước tính 0,1% |
| **\`t = 1 ms\`** | So sánh path | Seq cost 2.000, index cost 40 | Chưa đụng heap | Chọn index vì selectivity < 1% |
| **\`t = 4 ms\`** | Executor chạy | actual rows = 4.000 thay vì 100 | shared read tăng | Thống kê cũ, plan đúng công thức nhưng sai đầu vào |
| **\`t = 8 ms\`** | \`ANALYZE orders\` | Lấy mẫu lại histogram | reltuples mới | Lần sau planner đổi sang bitmap hoặc seq |

### 1.4 Công thức cost rút gọn dùng trong bài tập

Đây không phải công thức đầy đủ của \`costsize.c\`, nhưng đủ để thấy random page đắt hơn seq page và vì sao bảng nhỏ không cần index:

\`\`\`
seqCost = pages * seqPageCost
indexPages = max(1, ceil(pages * selectivity))
indexCost = indexPages * randomPageCost
bitmapPages = min(pages, max(1, ceil(pages * selectivity * 5)))
bitmapCost = bitmapPages * seqPageCost
Chọn path theo dải: pages < 32 hoặc selectivity >= 0,20 → SEQ_SCAN
selectivity >= 0,01 → BITMAP_SCAN
còn lại → INDEX_SCAN
\`\`\`

> **Tổng kết học thuật Phần 1 (Cost là thứ tự, không phải millisecond):**
> 1. **Hai plan chỉ so được với nhau khi cùng một bộ \`*_page_cost\`.** Đổi \`random_page_cost\` từ 4 xuống 1,1 có thể lật Seq Scan thành Index Scan.
> 2. **Rows ước tính sai thì cost đúng công thức vẫn chọn nhầm path.**

---

# 2. SEQ SCAN, INDEX SCAN VÀ BITMAP SCAN

### 2.1 Sequential Scan tận dụng đọc trước của kernel

Seq Scan đọc page từ đầu relation tới \`relpages\`. Kernel readahead gom các page liên tiếp thành một lần DMA lớn. Với bảng nằm gọn trong Shared Buffers, seq scan còn rẻ hơn bước xuống B-Tree. Ngưỡng thực dụng: bảng dưới vài chục page, hoặc predicate trả về khoảng **15–20%** số dòng trở lên.

### 2.2 Index Scan đổi log_f(N) lấy random heap I/O

Index Scan đi từ root tới lá, lấy \`ctid\`, rồi đọc heap **ngay** theo từng \`ctid\`. Point query chọn lọc cao (email, id) thường trúng một hoặc vài page. Khi selectivity khoảng vài phần trăm, hàng nghìn \`ctid\` rải ngẫu nhiên làm queue NVMe đầy những đọc 8KB không tuần tự.

### 2.3 Bitmap Scan tách pha tìm ctid và pha đọc heap

Bitmap Index Scan duyệt index, **chưa** mở heap. Nó bật bit cho từng heap page (và có thể lossy thành bit theo đoạn page khi bitmap không còn nằm trong \`work_mem\`). Bitmap Heap Scan sau đó đọc các page đã bật **theo thứ tự vật lý**, gần với seq scan có lỗ. Recheck xuất hiện khi bitmap lossy hoặc khi predicate không được index chứng minh hết.

Dải làm việc điển hình của bitmap là selectivity khoảng **1% tới dưới 15–20%**, bảng đủ lớn để seq scan đắt và đủ nhiều trang trúng để random từng \`ctid\` đắt hơn đọc tuần tự có chọn.

### 2.4 Ba kiểu join mà cost model cũng chọn

| Kiểu join | Khi planner ưa | Bộ nhớ | Sụp khi |
| :--- | :--- | :--- | :--- |
| **Nested Loop** | Outer nhỏ, inner có index point | Thấp | Outer lớn và inner seq scan, thành O(M·N) |
| **Hash Join** | Hai tập lớn, có \`work_mem\` cho hash bảng nhỏ hơn | \`work_mem\`, tràn temp file nếu thiếu | Lệch thống kê khiến bảng "nhỏ" thực ra khổng lồ |
| **Merge Join** | Hai nhánh đã sắp theo khóa join | Sort nếu chưa có index đúng thứ tự | Sort tràn đĩa |

> **Tổng kết học thuật Phần 2 (Path theo dải chọn lọc):**
> Index không phải mặc định. Seq Scan thắng bảng nhỏ và predicate rộng. Bitmap thắng khoảng giữa. Index Scan thắng điểm chọn lọc cao.

---

# 3. ĐỌC BUFFERS, LỆCH THỐNG KÊ VÀ GỌI ANALYZE TỪ ỨNG DỤNG

### 3.1 shared hit và shared read

\`Buffers: shared hit=980 read=20\` nghĩa là 980 page lấy từ Shared Buffers, 20 page phải đọc từ OS (page cache hoặc đĩa). \`read\` cao trên câu chạy lặp lại là working set lệch cache, không phải bằng chứng index sai. \`dirtied\` và \`written\` trên câu SELECT là bất thường (gợi ý hint bit hoặc query ghi).

Tỉ lệ hit của một node:

\`\`\`
cacheHit = sharedHit / (sharedHit + sharedRead)
Nếu cả hai bằng 0, coi như 1 (không có I/O để kết tội)
Ngưỡng vận hành trong bài: hit < 0,95 và read > 0 → cân nhắc shared_buffers hoặc câu đang kéo quá nhiều page
\`\`\`

### 3.2 Lệch rows là tín hiệu pg_statistic cũ

Sau \`COPY\` vài triệu dòng, autovacuum có thể chưa kịp \`ANALYZE\`. Planner vẫn tin \`reltuples\` cũ.

\`\`\`typescript
// File: src/database/explain/estimate-drift.ts
export interface ExplainCounters {
  readonly estimatedRows: number;
  readonly actualRows: number;
  readonly sharedHit: number;
  readonly sharedRead: number;
}

export function diagnoseExplain(input: ExplainCounters): { ratio: number; cacheHit: number; action: string } {
  if (input.estimatedRows <= 0) {
    throw new Error('INVALID_ESTIMATE');
  }
  const ratio = Math.round((input.actualRows / input.estimatedRows) * 100) / 100;
  const buf = input.sharedHit + input.sharedRead;
  const cacheHit = buf === 0 ? 1 : Math.round((input.sharedHit / buf) * 1000) / 1000;
  if (ratio >= 10 || ratio <= 0.1) {
    return { ratio, cacheHit, action: 'RUN_ANALYZE' };
  }
  if (cacheHit < 0.95 && input.sharedRead > 0) {
    return { ratio, cacheHit, action: 'RAISE_SHARED_BUFFERS' };
  }
  return { ratio, cacheHit, action: 'OK' };
}
\`\`\`

Quy ước bài: \`ratio = actual / estimated\`, làm tròn 2 chữ số. \`ratio >= 10\` hoặc \`ratio <= 0.1\` thì \`RUN_ANALYZE\` trước khi kết luận index. Chỉ khi ratio còn trong dải đó mà hit dưới 0,95 mới \`RAISE_SHARED_BUFFERS\`.

### 3.3 Ma trận đọc một plan xấu

| Dấu hiệu trong EXPLAIN | Ý nghĩa cơ học | Việc làm |
| :--- | :--- | :--- |
| **actual rows gấp ≥ 10 lần rows=** | Histogram / n_distinct cũ hoặc tương quan cột bị bỏ qua | \`ANALYZE table\` ngay, rồi đo lại |
| **actual rows ≤ 0,1 lần ước tính** | Cùng bệnh, planner tưởng tập lớn | \`ANALYZE\`, tránh hash join khổng lồ |
| **Heap Fetches cao trong Index Only Scan** | Visibility Map chưa all-visible | \`VACUUM\` bảng, không phải tạo thêm index |
| **shared read cao, hit thấp, rows khớp** | Working set không nằm trong Shared Buffers | Ngân sách RAM, không phải thêm index mù |
| **Bitmap Heap Scan Recheck** | Bitmap lossy vì \`work_mem\` hoặc predicate dư | Tăng \`work_mem\` cho session, hoặc index đủ cột |
| **Sort Method: external merge** | \`work_mem\` không đủ | Tăng cục bộ, xem temp file |

### 3.4 Nested loop giả khi thiếu index phía trong

Nếu inner không có index, mỗi dòng outer là một seq scan inner. Planner chuyển sang Hash Join khi ước tính cho thấy xây hash một lần rồi dò O(1) trung bình rẻ hơn. Ước tính sai (bảng inner "nhỏ" nhưng thực tế hàng triệu dòng) làm hash tràn \`work_mem\` ra temp file và chậm hơn cả nested loop có index.

> **Tổng kết học thuật Phần 3 (Đo rồi mới thêm index):**
> \`ANALYZE\` sửa đầu vào của cost. \`BUFFERS\` cho biết đau ở cache hay ở path. Thêm B-Tree khi path đã đúng mà heap fetch vẫn là phần trội.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Query Planner PostgreSQL (Parse, Cost, Execute)
\`\`\`diagram
[TOPOLOGY: pipeline-feedback-loop]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG PHÂN TÍCH VÀ VIẾT LẠI (PARSER & REWRITER)                             │
│    ├── Parser (Raw Parse Tree): Cú pháp SQL, chưa biết path                   │
│    ├── Rewriter (Rules & Views): RLS, view, rule                              │
│    └── Query Tree (Range Table): Danh sách quan hệ và predicate               │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Đưa selectivity từ pg_statistic vào cost
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG TỐI ƯU THEO CHI PHÍ (PLANNER & COST MODEL)                            │
│    ├── pg_statistic (MCV, Histogram): n_distinct và null_frac                  │
│    ├── Path Costs (seq vs random page): startup..total                         │
│    └── Chosen Plan (Cheapest Total): Seq, Index, Bitmap hoặc Join             │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ actual rows lệch ≥ 10 lần thì ANALYZE rồi lập kế hoạch lại
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG THỰC THI VÀ BỘ ĐỆM (EXECUTOR & SHARED BUFFERS)                        │
│    ├── Executor Nodes (loops, actual time): Đo millisecond thật               │
│    ├── Shared Hit / Read (BUFFERS): Phân biệt cache và I/O                    │
│    └── Visibility Recheck (MVCC): Bitmap lossy và heap fetch                  │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Index Scan Từng CTID Và Bitmap Heap Scan
\`\`\`diagram
MÔ HÌNH CŨ: INDEX SCAN MỞ HEAP NGAY MỖI CTID KHI CHỌN LỌC TRUNG BÌNH
Index ──► [ ctid ngẫu nhiên ] ──► [ random read từng page ] ──► HÀNG ĐỢI NVMe
5% của 100.000 page = hàng nghìn seek 8KB, chậm hơn đọc tuần tự có lỗ.

MÔ HÌNH HIỆN ĐẠI: BITMAP GOM PAGE RỒI ĐỌC THEO THỨ TỰ VẬT LÝ
Index A ──┐
Index B ──┼──► [ Bitmap AND/OR trong work_mem ] ──► Bitmap Heap Scan tuần tự
Predicate ─┘               │
                           └──► Recheck nếu lossy ────► Đủ work_mem thì bit chính xác
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Đọc EXPLAIN trước khi thêm index)
\`\`\`diagram
                      ACTUAL ROWS VÀ BUFFERS CỦA PLAN ĐANG LỆCH THẾ NÀO?
                                     │
                                     ▼
                         actual / estimated nằm ngoài dải 0,1 đến 10?
                         /                          \\
           LỆCH TỪ 10 LẦN TRỞ LÊN                   ROWS KHỚP NHƯNG VẪN CHẬM
                   /                                      \\
                  ▼                                        ▼
        [ RUN ANALYZE (CHUẨN) ]                   shared hit có dưới 95% và còn read?
        - Bulk load làm cũ pg_statistic           /                          \\
        - Đo lại EXPLAIN sau ANALYZE              HIT THẤP                         HIT CAO, PATH VẪN ĐẮT
        - Đừng thêm index trên thống kê sai              /                            \\
                                              ▼                                        ▼
                                    [ TĂNG SHARED BUFFERS ]                 [ ĐỔI ACCESS PATH (TỐI ƯU) ]
                                    - Working set lớn hơn cache             - Seq, Bitmap hoặc Index theo selectivity
                                    - Không chữa histogram                  - Index chỉ khi heap fetch là phần trội
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Ba đường đọc heap)

| Tiêu Chí So Sánh | Sequential Scan | Index Scan | Bitmap Scan |
| :--- | :--- | :--- | :--- |
| **Khi thắng** | Bảng nhỏ hoặc selectivity ≥ ~0,2 | Điểm chọn lọc dưới ~0,01 | Khoảng giữa, nhiều trang nhưng đọc được theo thứ tự |
| **Kiểu I/O** | Tuần tự, readahead | Random theo \`ctid\` | Tuần tự có lỗ trên các page bật bit |
| **Startup** | Thấp | Thấp với point query | Trung bình, phải dựng bitmap trước |
| **Thất bại điển hình** | Bảng trăm triệu dòng, trả 1 dòng | Hàng nghìn \`ctid\` rải | \`work_mem\` quá nhỏ làm bitmap lossy và recheck |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

1. **Định đề 1 (Cost sắp xếp phương án, ANALYZE mới đo thời gian):** \`cost=startup..total\` dùng \`seq_page_cost\`, \`random_page_cost\` và thống kê. Đổi hệ số trang hoặc để \`pg_statistic\` cũ sẽ đổi plan dù SQL không đổi.
2. **Định đề 2 (Dải selectivity chọn path):** Bảng dưới 32 page hoặc selectivity ≥ 0,20 nghiêng Seq Scan. Từ 0,01 đến dưới 0,20 nghiêng Bitmap Scan. Dưới 0,01 nghiêng Index Scan. Công thức cost trong bài tập là mô hình giảng, thứ tự dải mới là luật chọn.
3. **Định đề 3 (Bitmap tách tìm và đọc):** Index chỉ bật bit page; heap được đọc sau theo thứ tự vật lý. Recheck là hệ quả của bitmap lossy hoặc predicate chưa được index bao hết.
4. **Định đề 4 (Lệch rows trước, cache sau):** \`actual/estimated >= 10\` hoặc \`<= 0,1\` thì \`ANALYZE\` trước. Chỉ khi ratio còn hợp lý mà \`shared hit / (hit+read) < 0,95\` mới xem \`shared_buffers\`. Thêm index là bước sau khi hai việc đó đã loại.
  `,
  realCodeSnippet: `// File: src/database/explain/query-plan-budget.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Chụp EXPLAIN BUFFERS và phát hiện thống kê lệch
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PlanCapture {
  readonly statement: string;
  readonly planText: string;
  readonly estimatedRows: number;
  readonly actualRows: number;
  readonly sharedHit: number;
  readonly sharedRead: number;
}

export interface PlanDiagnosis {
  readonly ratio: number;
  readonly cacheHit: number;
  readonly action: 'OK' | 'RUN_ANALYZE' | 'RAISE_SHARED_BUFFERS';
}

/**
 * ADR-053: Không thêm index từ latency HTTP.
 * 1. EXPLAIN (ANALYZE, BUFFERS) chạy trên câu SELECT đã chuẩn hóa, trong timeout riêng.
 * 2. ratio = actualRows / estimatedRows. Ngoài [0.1, 10) thì việc đầu tiên là ANALYZE bảng.
 * 3. cacheHit = sharedHit / (sharedHit + sharedRead). Dưới 0.95 mà vẫn còn read thì xem working set.
 */
@Injectable()
export class QueryPlanBudgetService {
  private readonly logger = new Logger(QueryPlanBudgetService.name);

  constructor(private readonly dataSource: DataSource) {}

  public diagnose(capture: PlanCapture): PlanDiagnosis {
    if (capture.estimatedRows <= 0) {
      throw new Error('INVALID_ESTIMATE');
    }
    if (capture.actualRows < 0 || capture.sharedHit < 0 || capture.sharedRead < 0) {
      throw new Error('INVALID_COUNTERS');
    }
    const ratio = Math.round((capture.actualRows / capture.estimatedRows) * 100) / 100;
    const buffers = capture.sharedHit + capture.sharedRead;
    const cacheHit = buffers === 0 ? 1 : Math.round((capture.sharedHit / buffers) * 1000) / 1000;
    let action: PlanDiagnosis['action'] = 'OK';
    if (ratio >= 10 || ratio <= 0.1) {
      action = 'RUN_ANALYZE';
    } else if (cacheHit < 0.95 && capture.sharedRead > 0) {
      action = 'RAISE_SHARED_BUFFERS';
    }
    if (action !== 'OK') {
      this.logger.warn(\`plan action=\${action} ratio=\${ratio} hit=\${cacheHit} sql=\${capture.statement}\`);
    }
    return { ratio, cacheHit, action };
  }

  public async captureSelect(sql: string): Promise<string> {
    const rows = await this.dataSource.query<{ 'QUERY PLAN': string }[]>(
      \`EXPLAIN (ANALYZE, BUFFERS) \${sql}\`,
    );
    return rows.map((row) => row['QUERY PLAN']).join('\\n');
  }
}
`,
  quiz: [
    {
      id: 'c5-l3-q1',
      question: 'Cost trong planner PostgreSQL là đại lượng gì?',
      options: [
        'Số millisecond đã đo trên phần cứng, lấy từ lần chạy ANALYZE gần nhất của bảng.',
        'Điểm tương đối cộng từ page cost và CPU cost, dùng để sắp xếp các path chứ không phải đồng hồ.',
        'Số byte WAL mà câu lệnh sẽ ghi nếu được chọn để thực thi.',
        'Số kết nối đang chờ trên bảng, lấy từ pg_stat_activity.',
      ],
      correctIndex: 1,
      explanation: 'Planner không chạy thử từng path. Nó nhân số page ước tính với seq_page_cost hoặc random_page_cost rồi cộng cpu_tuple_cost. EXPLAIN ANALYZE mới có actual time.',
    },
    {
      id: 'c5-l3-q2',
      question: 'startup cost khác total cost ở điểm nào?',
      options: [
        'Startup là chi phí tới dòng đầu tiên; total là chi phí để trả hết số dòng planner ước tính.',
        'Startup luôn bằng 0 với mọi node, total mới là số duy nhất có nghĩa.',
        'Startup tính bằng millisecond, total tính bằng số page.',
        'Startup chỉ xuất hiện khi câu lệnh có LIMIT, total chỉ xuất hiện khi không có WHERE.',
      ],
      correctIndex: 0,
      explanation: 'Sort và hash phải tiêu thụ hết input trước khi xuất dòng nên startup cao. Index Scan point xuất dòng sớm. LIMIT làm planner thiên về plan startup thấp.',
    },
    {
      id: 'c5-l3-q3',
      question: 'Vì sao bảng vài chục page thường bị chọn Seq Scan dù đã có index?',
      options: [
        'Vì index bị planner cấm trên mọi bảng dưới một triệu dòng dù selectivity cực thấp.',
        'Vì đọc tuần tự cả bảng trong cache rẻ hơn bước xuống B-Tree rồi random heap fetch.',
        'Vì B-Tree không lưu được khóa của bảng nhỏ.',
        'Vì Seq Scan không cần MVCC nên bỏ được xmin/xmax.',
      ],
      correctIndex: 1,
      explanation: 'Độ trễ cố định của việc mở index cộng random I/O không được bù khi relation nằm gọn trong vài chục page. Cost model phản ánh điều đó qua seq_page_cost nhân số page nhỏ.',
    },
    {
      id: 'c5-l3-q4',
      question: 'Bitmap Scan giảm random I/O bằng cách nào?',
      options: [
        'Nén heap xuống một page rồi đọc duy nhất page đó.',
        'Bật bit các heap page trúng index, sau đó đọc các page đó theo thứ tự vật lý thay vì theo từng ctid.',
        'Bỏ qua Visibility Map và luôn tin leaf index.',
        'Chuyển câu lệnh sang worker song song bất kể kích thước bảng và không đọc heap pages.',
      ],
      correctIndex: 1,
      explanation: 'Pha index chỉ dựng bitmap. Pha heap đi tuần tự trên các bit đã bật. Khi bitmap không đủ work_mem nó thành lossy và executor phải recheck predicate.',
    },
    {
      id: 'c5-l3-q5',
      question: 'shared hit và shared read trong BUFFERS nói gì?',
      options: [
        'hit là page lấy từ Shared Buffers; read là page phải xin từ hệ điều hành vì không có trong shared pool.',
        'hit là số dòng trả về, read là số dòng bị WHERE loại.',
        'hit là index scan, read là seq scan, không liên quan bộ nhớ Shared Buffers của postmaster.',
        'hit là WAL đã fsync, read là WAL còn trong buffer.',
      ],
      correctIndex: 0,
      explanation: 'read không đồng nghĩa đĩa vật lý vì OS page cache vẫn có thể phục vụ. Nó đồng nghĩa miss ở Shared Buffers của PostgreSQL. hit cao với read gần 0 là working set đang nằm trong cache.',
    },
    {
      id: 'c5-l3-q6',
      question: 'random_page_cost = 1.1 trên NVMe có thể đổi plan ra sao?',
      options: [
        'Mọi Seq Scan biến thành Bitmap Scan bất kể selectivity.',
        'Index Scan và Bitmap Scan rẻ hơn tương đối so với lúc random_page_cost = 4, có thể lật path.',
        'Planner ngừng dùng pg_statistic và chỉ nhìn kích thước file trên đĩa data directory.',
        'WAL bị tắt vì đĩa đã đủ nhanh để ghi ngẫu nhiên data file.',
      ],
      correctIndex: 1,
      explanation: 'Hệ số 4 giả định seek của HDD. Khi random gần seq, chi phí từng ctid giảm. Vẫn phải đo lại bằng EXPLAIN vì selectivity và kích thước bảng không biến mất.',
    },
    {
      id: 'c5-l3-q7',
      question: 'Hash Join được chọn thay Nested Loop trong tình huống nào?',
      options: [
        'Khi hai tập đủ lớn và inner không có index point, xây hash một lần rẻ hơn quét inner lặp lại.',
        'Khi cả hai bảng dưới 10 dòng, vì hash luôn có startup bằng 0 và không cần work_mem.',
        'Khi câu lệnh không có điều kiện nối.',
        'Khi đĩa là CD-ROM nên cấm nested loop.',
      ],
      correctIndex: 0,
      explanation: 'Nested loop với inner seq scan là tích số dòng. Hash build trên tập nhỏ hơn rồi probe tập còn lại gần O(M+N), miễn là hash nằm trong work_mem. Ước tính sai kích thước làm hash tràn temp.',
    },
    {
      id: 'c5-l3-q8',
      question: 'Bulk insert vài triệu dòng rồi SELECT đột ngột chọn sai path vì đâu?',
      options: [
        'Vì CPU tự giảm xung khi COPY kết thúc.',
        'Vì dòng mới chưa có ctid nên index bị bỏ qua vĩnh viễn cho tới khi REINDEX.',
        'Vì NVMe giảm tốc đọc sau khi ghi đầy.',
        'Vì pg_statistic còn phân phối cũ; chạy ANALYZE để planner thấy reltuples và histogram mới.',
      ],
      correctIndex: 3,
      explanation: 'Planner không đếm lại bảng mỗi câu lệnh. Autovacuum có độ trễ. ANALYZE lấy mẫu và ghi pg_statistic, lần kế tiếp cost mới phản ánh kích thước thật.',
    },
  ],
  codeChallenge: {
    id: 'c5-l3-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Tách startup cost và total cost từ một dòng EXPLAIN',
    description: 'Hiện thực hàm `analyzePlanCosts(planString)`. Tìm mẫu `cost=<startup>..<total>` bằng số thực. Trả về `{ startupCost, totalCost, isHighCost }` với `isHighCost = totalCost > 100`. Nếu `planString` không phải chuỗi hoặc không khớp mẫu, trả về `{ startupCost: 0, totalCost: 0, isHighCost: false }`. Biên `totalCost === 100` thì `isHighCost` là false.',
    guidedSteps: [
      'Bước 1 (Kiểu đầu vào): Không phải string thì trả bộ ba an toàn.',
      'Bước 2 (Regex): Khớp /cost=([0-9.]+)\\.\\.([0-9.]+)/.',
      'Bước 3 (parseFloat): Vế trước dấu .. là startup, vế sau là total. NaN thì đưa về 0.',
      'Bước 4 (Ngưỡng): isHighCost chỉ true khi totalCost > 100, không phải >=.',
    ],
    hints: [
      'Dấu chấm trong regex phải escape, nếu không `..` ăn luôn chữ số.',
      '100.00 không được làm tròn thành high cost; phép so sánh là strict >.',
    ],
    starterCode: `function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  return { startupCost: 0, totalCost: 0, isHighCost: false };
}`,
    solution: `function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  if (typeof planString !== 'string') {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }
  const match = planString.match(/cost=([0-9.]+)\\.\\.([0-9.]+)/);
  if (!match) {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }
  const startupCost = Number.parseFloat(match[1]);
  const totalCost = Number.parseFloat(match[2]);
  return {
    startupCost: Number.isNaN(startupCost) ? 0 : startupCost,
    totalCost: Number.isNaN(totalCost) ? 0 : totalCost,
    isHighCost: totalCost > 100,
  };
}`,
    testCases: [
      {
        name: 'Index Scan cost thấp',
        input: ['-> Index Scan on users (cost=0.28..8.30 rows=1 width=64)'],
        expected: { startupCost: 0.28, totalCost: 8.3, isHighCost: false },
        hidden: false,
      },
      {
        name: 'Seq Scan vượt ngưỡng 100',
        input: ['-> Seq Scan on large_table (cost=10.50..580.40 rows=5000 width=128)'],
        expected: { startupCost: 10.5, totalCost: 580.4, isHighCost: true },
        hidden: false,
      },
      {
        name: 'Chuỗi không có cost',
        input: ['Invalid plan string without cost metadata'],
        expected: { startupCost: 0, totalCost: 0, isHighCost: false },
        hidden: false,
      },
      {
        name: 'Đúng biên 100 không bị coi là high',
        input: ['-> Bitmap Heap Scan (cost=0.00..100.00 rows=50 width=16)'],
        expected: { startupCost: 0, totalCost: 100, isHighCost: false },
        hidden: true,
      },
      {
        name: 'Hash Join cost lớn',
        input: ['-> Hash Join (cost=1250.75..99876.50 rows=200000 width=256)'],
        expected: { startupCost: 1250.75, totalCost: 99876.5, isHighCost: true },
        hidden: true,
      },
    ],
  },
  codeChallenges: [
    {
      id: 'c5-l3-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Tách startup cost và total cost từ một dòng EXPLAIN',
      description: 'Hiện thực hàm `analyzePlanCosts(planString)`. Tìm mẫu `cost=<startup>..<total>` bằng số thực. Trả về `{ startupCost, totalCost, isHighCost }` với `isHighCost = totalCost > 100`. Nếu `planString` không phải chuỗi hoặc không khớp mẫu, trả về `{ startupCost: 0, totalCost: 0, isHighCost: false }`. Biên `totalCost === 100` thì `isHighCost` là false.',
      guidedSteps: [
        'Bước 1 (Kiểu đầu vào): Không phải string thì trả bộ ba an toàn.',
        'Bước 2 (Regex): Khớp /cost=([0-9.]+)\\.\\.([0-9.]+)/.',
        'Bước 3 (parseFloat): Vế trước dấu .. là startup, vế sau là total. NaN thì đưa về 0.',
        'Bước 4 (Ngưỡng): isHighCost chỉ true khi totalCost > 100, không phải >=.',
      ],
      hints: [
        'Dấu chấm trong regex phải escape, nếu không `..` ăn luôn chữ số.',
        '100.00 không được làm tròn thành high cost; phép so sánh là strict >.',
      ],
      starterCode: `function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  return { startupCost: 0, totalCost: 0, isHighCost: false };
}`,
      solution: `function analyzePlanCosts(planString: string): {
  startupCost: number;
  totalCost: number;
  isHighCost: boolean;
} {
  if (typeof planString !== 'string') {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }
  const match = planString.match(/cost=([0-9.]+)\\.\\.([0-9.]+)/);
  if (!match) {
    return { startupCost: 0, totalCost: 0, isHighCost: false };
  }
  const startupCost = Number.parseFloat(match[1]);
  const totalCost = Number.parseFloat(match[2]);
  return {
    startupCost: Number.isNaN(startupCost) ? 0 : startupCost,
    totalCost: Number.isNaN(totalCost) ? 0 : totalCost,
    isHighCost: totalCost > 100,
  };
}`,
      testCases: [
        {
          name: 'Index Scan cost thấp',
          input: ['-> Index Scan on users (cost=0.28..8.30 rows=1 width=64)'],
          expected: { startupCost: 0.28, totalCost: 8.3, isHighCost: false },
          hidden: false,
        },
        {
          name: 'Seq Scan vượt ngưỡng 100',
          input: ['-> Seq Scan on large_table (cost=10.50..580.40 rows=5000 width=128)'],
          expected: { startupCost: 10.5, totalCost: 580.4, isHighCost: true },
          hidden: false,
        },
        {
          name: 'Chuỗi không có cost',
          input: ['Invalid plan string without cost metadata'],
          expected: { startupCost: 0, totalCost: 0, isHighCost: false },
          hidden: false,
        },
        {
          name: 'Đúng biên 100 không bị coi là high',
          input: ['-> Bitmap Heap Scan (cost=0.00..100.00 rows=50 width=16)'],
          expected: { startupCost: 0, totalCost: 100, isHighCost: false },
          hidden: true,
        },
        {
          name: 'Hash Join cost lớn',
          input: ['-> Hash Join (cost=1250.75..99876.50 rows=200000 width=256)'],
          expected: { startupCost: 1250.75, totalCost: 99876.5, isHighCost: true },
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l3-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Chấm cost Seq, Index, Bitmap và chọn path theo dải selectivity',
      description: 'Hiện thực hàm `scoreAccessPaths(pages, selectivity, seqPageCost, randomPageCost)`. Làm tròn mỗi cost bằng `Math.round(n * 100) / 100`. `seqCost = pages * seqPageCost`. `indexPages = max(1, ceil(pages * selectivity))`, `indexCost = indexPages * randomPageCost`. `bitmapPages = min(pages, max(1, ceil(pages * selectivity * 5)))`, `bitmapCost = bitmapPages * seqPageCost`. `chosen`: nếu `pages < 32` hoặc `selectivity >= 0.2` thì `SEQ_SCAN`; else nếu `selectivity >= 0.01` thì `BITMAP_SCAN`; else `INDEX_SCAN`.',
      guidedSteps: [
        'Bước 1 (Seq): seqCost = round2(pages * seqPageCost).',
        'Bước 2 (Index): indexPages = Math.max(1, Math.ceil(pages * selectivity)), nhân randomPageCost.',
        'Bước 3 (Bitmap): bitmapPages = Math.min(pages, Math.max(1, Math.ceil(pages * selectivity * 5))), nhân seqPageCost.',
        'Bước 4 (Dải): pages < 32 hoặc selectivity >= 0.2 → SEQ_SCAN; selectivity >= 0.01 → BITMAP_SCAN; còn lại INDEX_SCAN.',
      ],
      hints: [
        'Path không phải argmin của ba cost. Dải selectivity quyết định chosen, cost chỉ để trả về.',
        'ceil trước khi nhân giá page, rồi mới round 2 chữ số trên tích.',
      ],
      starterCode: `function scoreAccessPaths(
  pages: number,
  selectivity: number,
  seqPageCost: number,
  randomPageCost: number
): { seqCost: number; indexCost: number; bitmapCost: number; chosen: string } {
  return { seqCost: 0, indexCost: 0, bitmapCost: 0, chosen: 'SEQ_SCAN' };
}`,
      solution: `function scoreAccessPaths(
  pages: number,
  selectivity: number,
  seqPageCost: number,
  randomPageCost: number
): { seqCost: number; indexCost: number; bitmapCost: number; chosen: string } {
  const round2 = (value: number): number => Math.round(value * 100) / 100;
  const seqCost = round2(pages * seqPageCost);
  const indexPages = Math.max(1, Math.ceil(pages * selectivity));
  const indexCost = round2(indexPages * randomPageCost);
  const bitmapPages = Math.min(pages, Math.max(1, Math.ceil(pages * selectivity * 5)));
  const bitmapCost = round2(bitmapPages * seqPageCost);
  let chosen = 'INDEX_SCAN';
  if (pages < 32 || selectivity >= 0.2) {
    chosen = 'SEQ_SCAN';
  } else if (selectivity >= 0.01) {
    chosen = 'BITMAP_SCAN';
  }
  return { seqCost, indexCost, bitmapCost, chosen };
}`,
      testCases: [
        {
          name: 'Selectivity 0.001 trên 10000 page chọn Index Scan',
          input: [10000, 0.001, 1, 4],
          expected: { seqCost: 10000, indexCost: 40, bitmapCost: 50, chosen: 'INDEX_SCAN' },
          hidden: false,
        },
        {
          name: 'Bảng 20 page ép Seq Scan dù selectivity rất thấp',
          input: [20, 0.001, 1, 4],
          expected: { seqCost: 20, indexCost: 4, bitmapCost: 1, chosen: 'SEQ_SCAN' },
          hidden: false,
        },
        {
          name: 'Selectivity 0.05 chọn Bitmap, random cost 1.1',
          input: [4000, 0.05, 1, 1.1],
          expected: { seqCost: 4000, indexCost: 220, bitmapCost: 1000, chosen: 'BITMAP_SCAN' },
          hidden: false,
        },
        {
          name: 'Selectivity 0.25 trên 500 page là Seq Scan',
          input: [500, 0.25, 1, 4],
          expected: { seqCost: 500, indexCost: 500, bitmapCost: 500, chosen: 'SEQ_SCAN' },
          hidden: true,
        },
        {
          name: '64 page, selectivity 0.009 vẫn Index Scan',
          input: [64, 0.009, 1, 4],
          expected: { seqCost: 64, indexCost: 4, bitmapCost: 3, chosen: 'INDEX_SCAN' },
          hidden: true,
        },
      ],
    },
    {
      id: 'c5-l3-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Chẩn đoán lệch rows và cache hit từ EXPLAIN BUFFERS',
      description: 'Hiện thực hàm `diagnoseExplain(input)` với `input` gồm `estimatedRows`, `actualRows`, `sharedHit`, `sharedRead`. Nếu `estimatedRows <= 0`, `throw new Error("INVALID_ESTIMATE")`. Nếu `actualRows < 0` hoặc `sharedHit < 0` hoặc `sharedRead < 0`, `throw new Error("INVALID_COUNTERS")`. `ratio = round((actualRows / estimatedRows) * 100) / 100`. `cacheHit = 1` khi hit+read = 0, ngược lại `round((sharedHit / (hit+read)) * 1000) / 1000`. Nếu `ratio >= 10` hoặc `ratio <= 0.1` thì `action = "RUN_ANALYZE"`. Else nếu `cacheHit < 0.95` và `sharedRead > 0` thì `action = "RAISE_SHARED_BUFFERS"`. Else `action = "OK"`.',
      guidedSteps: [
        'Bước 1 (Ước tính): estimatedRows <= 0 ném INVALID_ESTIMATE trước khi chia.',
        'Bước 2 (Bộ đếm âm): actualRows, sharedHit hoặc sharedRead âm thì ném INVALID_COUNTERS.',
        'Bước 3 (Ratio và hit): ratio 2 chữ số thập phân, cacheHit 3 chữ số, mẫu số 0 thì cacheHit = 1.',
        'Bước 4 (Ưu tiên action): Lệch rows thắng cache. Chỉ xét shared buffers khi ratio còn trong (0.1, 10).',
      ],
      hints: [
        'ratio = 0.1 đúng biên vẫn là RUN_ANALYZE vì điều kiện là <= 0.1.',
        'sharedRead = 0 và hit > 0 cho cacheHit = 1, không rơi vào RAISE_SHARED_BUFFERS.',
      ],
      starterCode: `function diagnoseExplain(input: {
  estimatedRows: number;
  actualRows: number;
  sharedHit: number;
  sharedRead: number;
}): { ratio: number; cacheHit: number; action: string } {
  return { ratio: 0, cacheHit: 0, action: 'OK' };
}`,
      solution: `function diagnoseExplain(input: {
  estimatedRows: number;
  actualRows: number;
  sharedHit: number;
  sharedRead: number;
}): { ratio: number; cacheHit: number; action: string } {
  if (input.estimatedRows <= 0) {
    throw new Error('INVALID_ESTIMATE');
  }
  if (input.actualRows < 0 || input.sharedHit < 0 || input.sharedRead < 0) {
    throw new Error('INVALID_COUNTERS');
  }
  const ratio = Math.round((input.actualRows / input.estimatedRows) * 100) / 100;
  const buffers = input.sharedHit + input.sharedRead;
  const cacheHit = buffers === 0 ? 1 : Math.round((input.sharedHit / buffers) * 1000) / 1000;
  let action = 'OK';
  if (ratio >= 10 || ratio <= 0.1) {
    action = 'RUN_ANALYZE';
  } else if (cacheHit < 0.95 && input.sharedRead > 0) {
    action = 'RAISE_SHARED_BUFFERS';
  }
  return { ratio, cacheHit, action };
}`,
      testCases: [
        {
          name: 'Rows khớp và hit 0.99',
          input: [{ estimatedRows: 100, actualRows: 120, sharedHit: 990, sharedRead: 10 }],
          expected: { ratio: 1.2, cacheHit: 0.99, action: 'OK' },
          hidden: false,
        },
        {
          name: 'Actual gấp 50 lần ước tính',
          input: [{ estimatedRows: 10, actualRows: 500, sharedHit: 100, sharedRead: 0 }],
          expected: { ratio: 50, cacheHit: 1, action: 'RUN_ANALYZE' },
          hidden: false,
        },
        {
          name: 'Rows khớp nhưng một nửa buffer là read',
          input: [{ estimatedRows: 1000, actualRows: 900, sharedHit: 50, sharedRead: 50 }],
          expected: { ratio: 0.9, cacheHit: 0.5, action: 'RAISE_SHARED_BUFFERS' },
          hidden: false,
        },
        {
          name: 'estimatedRows = 0 phải ném INVALID_ESTIMATE',
          input: [{ estimatedRows: 0, actualRows: 10, sharedHit: 1, sharedRead: 1 }],
          expected: 'ERROR_THROWN',
          hidden: true,
        },
        {
          name: 'Ratio 0.05 ưu tiên ANALYZE dù hit cũng thấp',
          input: [{ estimatedRows: 200, actualRows: 10, sharedHit: 10, sharedRead: 1 }],
          expected: { ratio: 0.05, cacheHit: 0.909, action: 'RUN_ANALYZE' },
          hidden: true,
        },
      ],
    },
  ],
};
