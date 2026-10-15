import type { Lesson } from '../types.ts';

export const c4_l1b: Lesson = {
  id: 'c4-l1b',
  title: 'Bài 02: Chuyên Đề Toàn Diện: Hiểu Toàn Bộ PostgreSQL Trong 1h30p (Kiến Trúc, SQL & Tối Ưu Hóa)',
  duration: '98 phút',
  tag: 'PostgreSQL Architecture & Video Masterclass',
  videoUrl: 'https://www.youtube.com/watch?v=OUlLQK_gN8k',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học chuyên đề (kết hợp bài giảng Video Masterclass của chuyên gia Trần Quốc Huy — Wecommit) trang bị nền tảng Kiến trúc Cơ sở dữ liệu Quan hệ PostgreSQL từ tầng Lưu trữ Vật lý 8KB Page đến Bộ tối ưu hóa Truy vấn cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Kiến trúc Phân tầng Logic & Vật lý, Mô hình Tiến trình \`Process-per-Connection\` và Cơ chế Đa phiên bản \`MVCC\`:** Phân biệt rạch ròi 5 tầng logic (\`Cluster\`, \`Database\`, \`Schema\`, \`Table\`, \`Tablespace\`); hiểu rõ bố cục vật lý **\`8KB Slotted Page\`**, nguyên lý không khóa đọc/ghi của **\`MVCC (xmin/xmax)\`** và lý do bắt buộc phải giới hạn kích thước **\`Connection Pool\`** trong NestJS.
> 2. **Kiến trúc Bộ nhớ (\`shared_buffers\`, \`work_mem\`) và Hệ sinh thái Tiến trình Nền (\`bgwriter\`, \`Checkpointer\`, \`WAL Writer\`, \`Autovacuum\`):** Định lượng tỷ lệ trúng bộ đệm (\`Buffer Cache Hit Ratio\`), cơ chế tràn đĩa tạm (\`Temp File Spill\`) khi thiếu \`work_mem\`, quy trình bền vững hóa giao dịch qua **\`Write-Ahead Log (WAL)\`** và cơ chế dọn dẹp \`Dead Tuples\` chống phình bảng (\`Table Bloat\`).
> 3. **Phân tích Kế hoạch Thực thi \`EXPLAIN (ANALYZE, BUFFERS)\`, Chiến lược Đánh chỉ mục (\`B-Tree\`, \`GIN\`, \`BRIN\`) và Khôi phục Thảm họa \`PITR\`:** Nắm vững công thức tính chi phí của \`Query Planner\`, phân biệt \`Seq Scan\`, \`Index Scan\`, \`Bitmap Heap Scan\` và thiết lập quy trình **Khôi phục Điểm Thời gian (\`Point-In-Time Recovery — PITR\`)** trên môi trường Production.

---

# 1. KIẾN TRÚC PHÂN TẦNG LOGIC & VẬT LÝ CỦA POSTGRESQL: CLUSTER, TABLESPACE, 8KB SLOTTED PAGES VÀ MVCC

### 1.1 Tổng quan Chuyên đề Video Masterclass và Kiến trúc Phân cấp Logic 5 Tầng (Logical Architecture)

Chuyên đề này tổng hợp toàn bộ các khía cạnh cốt lõi của hệ quản trị cơ sở dữ liệu **PostgreSQL** ở cấp độ vận hành doanh nghiệp (\`Enterprise Production\`). Trước khi đi sâu vào giải phẫu từng cấu trúc bộ nhớ và đĩa cứng, kỹ sư có thể đối chiếu lộ trình bài giảng video theo bảng mốc thời gian dưới đây:

| Mốc Thời Gian Video | Chương Mục Trong Bài Giảng | Nội Dung Kỹ Thuật Trọng Tâm Cần Nắm Vững |
| :--- | :--- | :--- |
| **\`00:00:00\`** | **Phần 1: Tổng quan & Triết lý Thiết kế** | Lịch sử tiến hóa của PostgreSQL, chuẩn \`ACID\` và vị thế Object-Relational DBMS trong hệ thống lớn |
| **\`00:03:03\`** | **Phần 2: Cài đặt & Quản trị Định danh** | Thiết lập môi trường thực thi, phân quyền \`Role / User\` và thông số kết nối TCP Socket cổng \`5432\` |
| **\`00:07:40\`** | **Phần 3: Giải phẫu Kiến trúc PostgreSQL** | Kiến trúc Logic (\`Cluster\`, \`DB\`, \`Schema\`, \`Tablespace\`) & Kiến trúc Vật lý (\`Shared Buffers\`, \`WAL\`, \`Processes\`) |
| **\`00:36:04\`** | **Phần 4: Ngôn ngữ SQL & Tối ưu Truy vấn** | Ràng buộc toàn vẹn dữ liệu, cơ chế quét chỉ mục (\`B-Tree\`, \`GIN\`) và giải phẫu \`EXPLAIN ANALYZE\` |
| **\`01:16:03\`** | **Phần 5: Công cụ Quản trị & Vận hành** | Làm chủ giao diện dòng lệnh \`psql\`, kiểm tra danh mục hệ thống (\`pg_catalog\`) và giám sát kết nối |
| **\`01:18:04\`** | **Phần 6: Sao lưu & Phục hồi Thảm họa** | Sao lưu Logic (\`pg_dump\`), Sao lưu Vật lý (\`pg_basebackup\`) và Khôi phục Điểm thời gian (\`PITR\`) |
| **\`01:26:29\`** | **Phần 7: Sơ đồ Tư duy Luồng Dữ liệu** | Hệ thống hóa đường đi của một câu lệnh SQL từ ứng dụng Client qua RAM xuống các khối đĩa cứng |

Dưới góc nhìn kiến trúc tổ chức dữ liệu, PostgreSQL phân chia không gian lưu trữ theo **5 tầng phân cấp từ cao xuống thấp**:
1. **Cụm Cơ sở dữ liệu (\`Database Cluster\`):**
   Trong thuật ngữ chuẩn của PostgreSQL, \`Database Cluster\` **không phải** là một cụm nhiều máy chủ vật lý ghép lại, mà là **một thư mục dữ liệu gốc duy nhất (\`PGDATA\`)** được quản lý bởi một tiến trình \`Postmaster\` lắng nghe trên một cổng mạng (mặc định là cổng \`5432\`). Một \`Cluster\` chứa nhiều \`Database\` con cùng chia sẻ chung vùng nhớ \`shared_buffers\` và nhật ký giao dịch \`WAL\`.
2. **Cơ sở dữ liệu (\`Database\`):**
   Là ranh giới cô lập dữ liệu cấp cao bên trong \`Cluster\`. Các kết nối TCP từ ứng dụng NestJS bắt buộc phải chỉ định rõ tên \`Database\` ngay trong gói bắt tay đầu tiên, và một câu truy vấn SQL không thể trực tiếp \`JOIN\` hai bảng nằm ở hai \`Database\` khác nhau (trừ khi sử dụng phần mở rộng \`postgres_fdw\`).
3. **Không gian tên Lược đồ (\`Schema / Namespace\`):**
   Bên trong một \`Database\`, các bảng được phân nhóm vào các \`Schema\` (mặc định là \`public\`). Trong kiến trúc \`Modular Monolith\` hoặc \`Multi-tenant SaaS\`, kỹ sư thường chia một Database thành nhiều Schema theo miền nghiệp vụ (\`auth\`, \`billing\`, \`inventory\`) để phân tách quyền truy cập (\`GRANT USAGE ON SCHEMA\`) mà vẫn cho phép thực hiện giao dịch \`ACID\` xuyên các Schema trong cùng một kết nối.
4. **Đối tượng Quan hệ (\`Relations: Tables, Indexes, Views, Sequences\`):**
   Mọi bảng dữ liệu và chỉ mục đều được lưu trữ vật lý dưới dạng các tệp tin nhị phân được đặt tên theo mã định danh \`filenode\` (tra cứu qua hàm \`pg_relation_filepath('orders')\`). Khi một bảng vượt quá dung lượng **\`1 GB\`**, PostgreSQL tự động cắt bảng đó thành các tệp phân đoạn nối tiếp nhau (\`12345\`, \`12345.1\`, \`12345.2\`...) để tránh giới hạn kích thước tệp của hệ điều hành.
5. **Không gian Bảng Vật lý (\`Tablespace\`):**
   Là lớp cầu nối ánh xạ giữa đối tượng logic và ổ đĩa phần cứng vật lý. Thông qua \`Tablespace\`, kỹ sư cơ sở dữ liệu có thể đặt các bảng giao dịch nóng (\`orders\`, \`wallets\`) và toàn bộ \`B-Tree Index\` nằm trên phân vùng ổ đĩa **\`NVMe SSD\`** tốc độ cao (\`/mnt/nvme_fast\`), trong khi đẩy các bảng lịch sử kiểm toán (\`audit_logs_2024\`) sang phân vùng ổ đĩa lưu trữ dung lượng lớn giá rẻ (\`/mnt/ebs_cold\`).

### 1.2 Đối chiếu Kiến trúc Lưu trữ Vật lý: 8KB Slotted Pages, Con trỏ vật lý CTID và Cơ chế Đa phiên bản MVCC

Khác với MySQL (InnoDB) vốn tổ chức bảng dữ liệu như một cây chỉ mục cụm (\`Clustered B+Tree Index\` theo khóa chính và ghi đè dữ liệu cũ vào \`Undo Log\`), PostgreSQL lưu trữ dữ liệu bảng dưới dạng một **Đống không thứ tự (\`Heap File\`)** gồm các khối trang có kích thước cố định **\`8 Kilobytes (8,192 bytes)\`** và thực thi **Kiểm soát Đồng thời Đa phiên bản (\`MVCC — Multi-Version Concurrency Control\`)** bằng cách tạo bản ghi phiên bản mới ngay trên trang Heap:
- Khi bạn thực hiện lệnh \`UPDATE accounts SET balance = 500 WHERE id = 10\`, PostgreSQL **không bao giờ ghi đè trực tiếp** lên vùng nhớ của dòng cũ!
- Thay vào đó, nó đánh dấu mã giao dịch xóa (\`xmax = current_txid\`) vào dòng cũ (biến dòng cũ thành **Dòng dữ liệu chết — \`Dead Tuple\`** chỉ còn phục vụ cho các câu lệnh \`SELECT\` của các giao dịch cũ đang mở), đồng thời chèn thêm một **Dòng dữ liệu mới hoàn toàn (\`New Tuple\` với \`xmin = current_txid\`)** vào vùng trống của trang \`8KB Page\`!

Bảng dưới đây đối chiếu sự khác biệt kiến trúc cốt lõi giữa mô hình lưu trữ của PostgreSQL và MySQL InnoDB:

| Tiêu chí Kiến trúc Cấp thấp | PostgreSQL Storage Engine (\`Heap + Tuple Versioning\`) | MySQL InnoDB Engine (\`Clustered Index + Undo Log\`) | Hệ quả Vận hành Thực tế đối với Kỹ sư Backend |
| :--- | :--- | :--- | :--- |
| **1. Kích thước Khối Trang (\`Page Size\`)** | **\`8 KB (8,192 bytes)\`** cấu trúc \`Slotted Page\` (Header 24B ở đầu, Tuples xếp từ đáy lên) | **\`16 KB (16,384 bytes)\`** cấu trúc nút lá của cây \`Clustered B+Tree\` | Mọi phép đo I/O trong \`EXPLAIN (BUFFERS)\` của PostgreSQL đều tính bằng đơn vị khối \`8 KB\` |
| **2. Tổ chức Bảng & Chỉ mục Phụ** | Bảng là \`Heap\`; mọi Index đều là **Secondary Index** trỏ trực tiếp tới địa chỉ vật lý \`ctid = (Page, Slot)\` | Bảng chính là cây \`Primary Key\`; Secondary Index chỉ lưu giá trị \`PK\` nên đọc qua Secondary Index phải duyệt 2 cây | Trong PostgreSQL, nếu dùng \`UUID v4\` làm khóa chính thì các Index khác không bị phình to theo kích thước PK |
| **3. Cơ chế Thực thi \`UPDATE\` (\`MVCC\`)** | **Append-New-Tuple**: Giữ nguyên dòng cũ (gán \`xmax\`) và ghi thêm dòng mới (gán \`xmin\`) vào trang Heap | **In-Place / Undo Log**: Sửa trực tiếp trên trang B+Tree và đẩy bản sao cũ sang vùng \`Rollback Segment\` | Lệnh \`ROLLBACK\` trong PostgreSQL hoàn tất tức thì $O(1)$ (chỉ đánh dấu trạng thái txid), nhưng sinh ra \`Dead Tuples\` |
| **4. Tối ưu Cập nhật Nóng (\`HOT Update\`)** | **\`Heap-Only Tuple (HOT)\`**: Nếu cột bị \`UPDATE\` không nằm trong Index và trang 8KB còn chỗ trống, không cần sửa Index | Chỉ sửa Secondary Index nếu cột được đánh chỉ mục bị thay đổi giá trị | Đặt \`fillfactor = 80\` hoặc \`90\` cho bảng cập nhật liên tục trong PostgreSQL để chừa chỗ trống kích hoạt \`HOT Update\` |
| **5. Tiến trình Thu gom Rác Nội tại** | **Bắt buộc có \`Autovacuum\`** chạy ngầm để thu hồi không gian của các \`Dead Tuples\` và chống tràn \`Transaction ID\` | Luồng \`Purge Thread\` dọn dẹp các bản ghi \`Undo Log\` khi không còn giao dịch cũ nào cần đọc | Nếu một giao dịch bị treo (\`idle in transaction\`) hàng giờ trên PostgreSQL, \`Autovacuum\` bị chặn đứng gây phình bảng! |

### 1.3 Quản trị Kết nối trong NestJS: Hiểm họa Cạn kiệt Tiến trình Postmaster Fork và Bể Kết nối Connection Pool

Một sai lầm kiến trúc nghiêm trọng của lập trình viên Node.js là cấu hình số lượng kết nối tối đa trong \`TypeORM / Prisma\` lên tới \`max: 200\` cho mỗi Pod NestJS vì nghĩ rằng *"càng nhiều kết nối thì chạy càng nhanh"*.
- Khác với Node.js dùng 1 luồng đơn lẻ, kiến trúc của PostgreSQL là **Mỗi Kết nối Một Tiến trình Hệ điều hành (\`Process-per-Connection Architecture\`)**: mỗi khi ứng dụng mở một kết nối TCP tới cổng \`5432\`, tiến trình cha \`Postmaster\` buộc phải gọi syscall \`fork()\` để sinh ra một tiến trình con độc lập (\`postgres backend process\`) tiêu tốn tối thiểu **\`5 MB – 10 MB RAM\`** riêng biệt kèm theo chi phí chuyển ngữ cảnh CPU (\`Context Switching\`).
- Nếu bạn chạy 10 Pods NestJS mà mỗi Pod mở 100 kết nối, máy chủ PostgreSQL phải gánh **\`1,000 tiến trình OS\`**, khiến CPU của Database bị đốt sạch vào việc lập lịch tiến trình (\`Kernel Scheduler Thrashing\`) thay vì thực thi câu lệnh SQL!

Đoạn mã dưới đây đối chiếu phản mẫu mở kết nối bừa bãi và thiết kế bể kết nối chuẩn Production trong NestJS:

\`\`\`typescript
// File: src/modules/database/postgres-connection-pool.service.ts
import { Injectable } from '@nestjs/common';

export interface PoolConfigSpec {
  readonly maxConnections: number;
  readonly connectionTimeoutMs: number;
  readonly idleInTransactionSessionTimeoutMs: number;
  readonly statementTimeoutMs: number;
}

// 1. THIẾT KẾ SAI (ANTI-PATTERN): Đặt maxConnections quá lớn và không có Timeout bảo vệ
@Injectable()
export class OverprovisionedDbPoolBrokenService {
  getBrokenConfig(): PoolConfigSpec {
    // LỖI HỆ THỐNG:
    // - maxConnections: 250 trên mỗi Pod -> 8 Pods = 2,000 tiến trình postgres fork(), gây sập RAM & nghẽn Lock!
    // - Không đặt idleInTransactionSessionTimeoutMs -> Giao dịch treo chặn đứng Autovacuum gây Table Bloat!
    return {
      maxConnections: 250,
      connectionTimeoutMs: 0,
      idleInTransactionSessionTimeoutMs: 0,
      statementTimeoutMs: 0,
    };
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION POOL FORMULA): Tính toán theo số nhân CPU và khóa chặt Timeout
@Injectable()
export class TunedPostgresPoolSafeService {
  // Công thức vàng của PostgreSQL HikariCP/PgBouncer:
  // Tổng kết nối toàn cụm = (Số nhân CPU của DB Server × 2) + Số ổ đĩa SSD
  calculateOptimalPoolPerPod(dbCpuCores: number, activeAppPods: number): PoolConfigSpec {
    const safeCores = Math.max(1, dbCpuCores);
    const safePods = Math.max(1, activeAppPods);
    const clusterTotalLimit = safeCores * 2 + 2;
    const perPodMax = Math.max(4, Math.floor(clusterTotalLimit / safePods));

    return {
      maxConnections: perPodMax,
      connectionTimeoutMs: 3000,
      // Tự động cắt các giao dịch bị bỏ quên quá 15 giây để bảo vệ tiến trình Autovacuum:
      idleInTransactionSessionTimeoutMs: 15000,
      // Ngăn chặn các câu query thiếu Index chạy vô hạn làm cạn kiệt Pool:
      statementTimeoutMs: 10000,
    };
  }
}
\`\`\`

Hãy theo dõi bảng truy vết thực thi theo từng mốc mili-giây bên dưới để thấy rõ hành trình của một giao dịch \`UPDATE\` đi từ NestJS Connection Pool xuyên qua các vùng bộ nhớ của PostgreSQL:

| Mốc thời gian | Tầng Thực thi | Thao tác trên CPU, Bộ nhớ RAM & Đĩa NVMe | Trạng thái Trang 8KB & Nhật ký WAL | Hệ quả Toàn vẹn \`ACID\` & Hiệu năng |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **NestJS Pool** (\`pg.Pool\`) | Mượn 1 kết nối ấm đã bắt tay sẵn; gửi gói tin \`UPDATE orders SET status='PAID' WHERE id=99\` | Kết nối gắn với tiến trình \`postgres backend PID 4102\` | Tiết kiệm \`25 ms\` chi phí \`Postmaster fork()\` và xác thực \`SCRAM-SHA-256\` |
| **\`t = 1 ms\`** | **Shared Buffers** (\`RAM Pool\`) | Duyệt \`B-Tree Index\` tìm được \`ctid = (Page 12, Slot 4)\`; nạp \`Page 12\` vào \`shared_buffers\` | Đánh dấu \`xmax\` cho dòng cũ; ghi dòng mới vào \`Slot 5\` $\rightarrow$ \`Page 12\` thành **\`Dirty Page\`** | **Chưa ghi \`Page 12\` xuống đĩa ngay!** Tránh hoàn toàn độ trễ Random Disk I/O |
| **\`t = 2 ms\`** | **WAL Buffers & WAL Writer** | Ghi bản ghi thay đổi nhị phân (\`XLOG record\`) vào \`wal_buffers\`; khi gọi \`COMMIT\`, ép \`fsync()\` xuống tệp \`pg_wal\` | Tệp \`pg_wal/000000010000000A\` được ghi nối tiếp tuần tự (\`Sequential Append\`) trên NVMe | Ngay khi \`fsync(WAL)\` xong tại \`t = 2.4 ms\`, trả kết quả \`COMMIT OK\` về cho NestJS! |
| **\`t = 500 ms\`** | **Background Writer** (\`bgwriter\`) | Quét ngầm theo thuật toán \`Clock Sweep\`, đẩy dần các \`Dirty Pages\` ít dùng xuống tệp dữ liệu | Giữ cho \`shared_buffers\` luôn có sẵn các khung trang sạch (\`Clean Buffers\`) | Các câu lệnh \`SELECT\` mới không bao giờ phải chờ dọn chỗ trống trong RAM |
| **\`t = 300,000 ms\`** | **Checkpointer & Autovacuum** | \`Checkpointer\` đồng bộ toàn bộ \`Dirty Pages\` và ghi mốc an toàn; \`Autovacuum\` thu hồi \`Slot 4\` cũ | Không gian của \`Dead Tuple (Slot 4)\` trong \`Page 12\` được đánh dấu tái sử dụng (\`Free Space Map\`) | Nếu sập nguồn, hệ thống chỉ cần phát lại (\`Replay\`) WAL từ mốc Checkpoint gần nhất |

### 1.4 Định lượng Bộ nhớ Kết nối và Công thức Tính Kích thước Connection Pool Tối ưu

Kỹ sư hệ thống sử dụng công thức thực nghiệm chuẩn ngành dưới đây để định cỡ số lượng kết nối tối đa trên máy chủ PostgreSQL và phân bổ cho từng Pod ứng dụng NestJS:

\`\`\`
Số kết nối thực thi đồng thời tối ưu trên toàn máy chủ DB (Optimal_DB_Connections) = (DB_CPU_Cores × 2) + Effective_Spindle_Count
Số kết nối tối đa cấu hình trên mỗi Pod NestJS (Max_Pool_Size_Per_Pod) = floor((Optimal_DB_Connections - Reserved_Admin_Conns) / Total_App_Pods)
Tổng bộ nhớ RAM tiêu hao cho các tiến trình kết nối (Connection_Overhead_MB) = Total_Active_Connections × Avg_Backend_Process_RAM_MB
Ví dụ định lượng: Máy chủ DB có 16 vCPU (1 ổ NVMe -> Optimal = 16 × 2 + 1 = 33 kết nối), dành 3 kết nối cho Admin, chạy 6 Pods NestJS:
-> Mỗi Pod NestJS chỉ nên cấu hình max = floor((33 - 3) / 6) = 5 kết nối/Pod (hoặc đặt PgBouncer ở chế độ Transaction Pooling phía trước DB)!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc quản trị kết nối và MVCC):**
> 1. **Ít kết nối hơn nghĩa là Thông lượng cao hơn (\`Less Connections = Higher Throughput\`):** Trong PostgreSQL, việc giữ tổng số kết nối đang chạy gần với ngưỡng \`2 × CPU Cores\` giúp loại bỏ tranh chấp khóa nội bộ (\`LWLock Contention\`) và chuyển ngữ cảnh nhân OS; khi có hàng chục Pods Microservices, bắt buộc phải triển khai **\`PgBouncer (Transaction Pooling)\`** ở giữa.
> 2. **Tuyệt đối không giữ giao dịch mở khi gọi API bên thứ ba:** Vì cơ chế \`MVCC\` không thể dọn dẹp \`Dead Tuples\` nếu vẫn còn một giao dịch cũ đang mở (\`idle in transaction\`), việc mở \`BEGIN\` rồi gọi HTTP sang cổng thanh toán bên ngoài sẽ làm tê liệt \`Autovacuum\` và rút cạn \`Connection Pool\` trong vài giây.

---

# 2. KIẾN TRÚC BỘ NHỚ SHARED BUFFERS, LOCAL WORK_MEM VÀ CÁC TIẾN TRÌNH NỀN (BGWRITER, CHECKPOINTER, WAL, AUTOVACUUM)

### 2.1 Giải phẫu Phân vùng Bộ nhớ RAM: Shared Memory (\`shared_buffers\`, \`wal_buffers\`) và Local Backend Memory (\`work_mem\`, \`maintenance_work_mem\`)

Bộ nhớ RAM của PostgreSQL được chia thành hai miền hoàn toàn khác biệt: **Bộ nhớ Dùng chung Toàn cục (\`Shared Memory\` — cấp phát 1 lần lúc khởi động Cluster)** và **Bộ nhớ Cục bộ theo Từng Kết nối (\`Local Process Memory\` — cấp phát động bên trong từng tiến trình con)**. Việc cấu hình sai tỷ lệ giữa hai miền này là nguyên nhân số một dẫn tới lỗi tràn bộ nhớ (\`Linux OOM Killer\`) trên máy chủ cơ sở dữ liệu:

| Tham số Cấu hình (\`postgresql.conf\`) | Phạm vi Cấp phát Bộ nhớ | Vai trò Kỹ thuật Chính xác trong Engine | Rủi ro Khi Đặt Quá Thấp hoặc Quá Cao | Khuyến nghị Định cỡ Chuẩn Production |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`shared_buffers\`** | **Toàn cục** (1 vùng duy nhất cho cả máy chủ) | Bộ nhớ đệm lưu trữ các khối trang **\`8KB Data/Index Pages\`** đang được đọc/ghi tích cực | Quá thấp (\`128MB\` mặc định) khiến DB phải đọc đĩa liên tục; quá cao (\`> 50%\`) gây trùng lặp với Linux Page Cache | Đặt bằng **\`25% đến 40%\` tổng dung lượng RAM** của máy chủ chuyên dụng (ví dụ \`16 GB\` trên máy \`64 GB RAM\`) |
| **2. \`wal_buffers\`** | **Toàn cục** (1 vùng đệm chung cho nhật ký WAL) | Lưu tạm các bản ghi giao dịch \`Write-Ahead Log\` trước khi \`WAL Writer\` hoặc \`COMMIT\` xả xuống đĩa | Quá nhỏ khiến các giao dịch ghi đồng thời cao bị nghẽn chờ khóa vùng đệm (\`WALWriteLock\`) | Đặt \`-1\` (tự động lấy \`1/32\` của \`shared_buffers\`, tối đa thường từ **\`16 MB đến 64 MB\`**) |
| **3. \`work_mem\`** | **Cục bộ trên MỖI Thao tác Sort/Hash của MỖI Query** | Bộ nhớ RAM tối đa cho một phép \`ORDER BY\`, \`DISTINCT\`, \`Hash Join\` hoặc \`Merge Join\` trước khi tràn ra đĩa | Đặt quá thấp (\`4MB\`) gây tràn đĩa tạm (**\`External Disk Sort\`**); đặt quá cao (\`1GB\`) nhân với 200 kết nối sẽ gây **\`OOM Kill\`**! | Đặt từ **\`16 MB đến 64 MB\`**; luôn kiểm tra công thức \`Max_Connections × 3 × work_mem < Free_RAM\` |
| **4. \`maintenance_work_mem\`** | **Cục bộ cho Tác vụ Bảo trì** (\`VACUUM\`, \`CREATE INDEX\`) | Cấp phát cho tiến trình \`Autovacuum Worker\` và các lệnh tạo chỉ mục, thêm khóa ngoại | Quá thấp khiến việc tạo Index hoặc chạy \`VACUUM\` trên bảng lớn phải quét đi quét lại nhiều vòng | Đặt từ **\`512 MB đến 2 GB\`** để tăng tốc độ thu gom rác và dựng cây B-Tree |
| **5. \`effective_cache_size\`** | **Chỉ số Ước lượng** (Không cấp phát RAM thực tế!) | Báo cho \`Query Planner\` biết tổng lượng RAM ước tính có sẵn (gồm cả \`shared_buffers\` + \`OS Page Cache\`) | Nếu để quá thấp, \`Query Planner\` tưởng máy ít RAM nên sợ \`Index Scan\` và chọn nhầm \`Seq Scan\`! | Đặt bằng **\`75%\` tổng dung lượng RAM** của máy chủ để khuyến khích tối đa việc sử dụng Index |

### 2.2 Phối hợp Tiến trình Nền: Postmaster, Background Writer (\`bgwriter\`), Checkpointer, WAL Writer và Autovacuum

Để hiểu tại sao PostgreSQL vừa có thể trả lời \`COMMIT\` trong \`1 – 2 ms\` vừa đảm bảo không mất dữ liệu khi rút dây nguồn, kỹ sư cần nắm vững sự phân công lao động giữa 4 tiến trình nền cốt lõi và 2 công thức vận hành liên quan:

1. **Sự phân tách giữa \`Background Writer (bgwriter)\` và \`Checkpointer\`:**
   - **\`bgwriter\` (Mục tiêu: Tối ưu Hiệu năng Đọc/Ghi):** Chạy vòng lặp ngầm liên tục mỗi \`200 ms\` (\`bgwriter_delay\`), sử dụng thuật toán **\`Clock Sweep\`** để tìm một lượng nhỏ các trang bẩn (\`Dirty Pages\`) sắp bị đẩy khỏi bộ đệm và ghi trước xuống đĩa. Nhờ đó, khi một tiến trình \`Backend Worker\` cần nạp trang mới từ đĩa vào \`shared_buffers\`, nó luôn tìm thấy ngay trang sạch (\`Clean Buffer\`) có sẵn mà không phải tự mình đi ghi trang bẩn xuống đĩa!
   - **\`Checkpointer\` (Mục tiêu: Đảm bảo Toàn vẹn Khôi phục — Crash Recovery Bound):** Cứ mỗi \`5 – 15 phút\` (\`checkpoint_timeout\`) hoặc khi lượng nhật ký WAL tích lũy chạm ngưỡng \`max_wal_size\`, \`Checkpointer\` bắt buộc phải đồng bộ **100% toàn bộ các \`Dirty Pages\` hiện có tại thời điểm đó** xuống đĩa cứng (dàn trải đều theo hệ số \`checkpoint_completion_target = 0.9\` để tránh gây nghẽn đột biến I/O — \`I/O Spike\`) và đóng dấu mốc **\`REDO Point\`** vào tệp \`pg_control\`.
2. **Công thức Tính Tỷ lệ Trúng Bộ đệm (\`Buffer Cache Hit Ratio\`) và Ngưỡng Kích hoạt \`Autovacuum\`:**
   Trong hệ thống OLTP chuẩn Production, tối thiểu **\`99%\`** các thao tác đọc khối dữ liệu phải được phục vụ trực tiếp từ RAM (\`shared_buffers\`). Đồng thời, tiến trình \`Autovacuum\` chỉ tự động thức dậy dọn dẹp một bảng khi số lượng \`Dead Tuples\` vượt qua ngưỡng động tính theo công thức sau:

\`\`\`
Tỷ lệ Trúng Bộ đệm RAM (Buffer_Cache_Hit_Ratio_Pct) = (heap_blks_hit / (heap_blks_hit + heap_blks_read)) × 100
Ngưỡng Kích hoạt Autovacuum trên Bảng (Autovacuum_Trigger_Threshold) = autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor × Total_Live_Tuples)
Nguy cơ Đỉnh RAM do work_mem (Peak_Work_Mem_MB) = Active_Queries × Avg_Sort_Hash_Nodes_Per_Query × work_mem_MB
Ví dụ định lượng: Với cấu hình mặc định (threshold = 50, scale_factor = 0.20 = 20%) trên bảng orders có 10,000,000 dòng:
-> Phải chờ tích tụ tới: 50 + (0.20 × 10,000,000) = 2,000,050 Dead Tuples thì Autovacuum mới chạy! Với bảng lớn, bắt buộc phải hạ scale_factor xuống 0.01 (1%) hoặc 0.02 (2%)!
\`\`\`

### 2.3 Truy vết Sự cố Tràn bộ nhớ Sắp xếp (\`work_mem\` Spill to Temp Files) và Hiện tượng Phình bảng (\`Table Bloat\`)

Hai nguyên nhân phổ biến nhất làm suy giảm hiệu năng PostgreSQL âm thầm theo thời gian trên Production là:
1. **Hiện tượng Tràn dữ liệu Sắp xếp ra Đĩa tạm (\`External Merge Disk Sort\`):**
   Khi một câu truy vấn thực hiện \`ORDER BY created_at DESC\` hoặc \`Hash Join\` trên tập kết quả trung gian nặng \`25 MB\`, nhưng tham số \`work_mem\` đang để mặc định là \`4 MB\`, tiến trình thực thi không được phép dùng quá \`4 MB RAM\`. Nó buộc phải cắt dữ liệu thành các tệp tin tạm trên ổ đĩa cứng (\`base/pgsql_tmp\`), sắp xếp từng mảnh rồi trộn lại trên đĩa. Khi chạy \`EXPLAIN (ANALYZE, BUFFERS)\`, bạn sẽ thấy dòng cảnh báo đỏ: **\`Sort Method: external merge Disk: 24560kB\`** kèm theo \`temp read/written\` tăng vọt, làm thời gian truy vấn nhảy từ \`8 ms\` lên \`450 ms\`!
2. **Hiện tượng Phình đại Bảng (\`Table & Index Bloat\`) trên các bảng cập nhật tần suất cao:**
   Như đã chứng minh bằng công thức ở mục 2.2, cấu hình mặc định \`autovacuum_vacuum_scale_factor = 0.2\` (20%) hoàn toàn phù hợp cho bảng nhỏ nhưng là thảm họa cho bảng hàng chục triệu dòng. Khi 2 triệu \`Dead Tuples\` tích tụ trước khi được dọn, kích thước vật lý của bảng trên đĩa và trong \`shared_buffers\` bị phình to gấp đôi bởi các dòng rác, làm giảm mật độ dữ liệu thực trên mỗi trang \`8KB\` và kéo tụt tỷ lệ \`Buffer Cache Hit Ratio\`. Giải pháp bắt buộc là ghi đè cấu hình cấp bảng: \`ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_cost_limit = 2000);\`.

> **Tổng kết học thuật Phần 2 (Hai quy tắc cấu hình Bộ nhớ và Autovacuum):**
> 1. **Quy tắc Cân bằng \`shared_buffers\` và \`work_mem\`:** Luôn cấp phát \`25% – 40% RAM\` cho \`shared_buffers\`, nhưng chỉ tăng \`work_mem\` lên mức vừa phải (\`16 MB – 64 MB\`) hoặc tăng cục bộ cho từng phiên giao dịch báo cáo nặng bằng lệnh \`SET LOCAL work_mem = '256MB';\` bên trong Transaction để tránh nguy cơ cạn kiệt RAM toàn máy chủ.
> 2. **Tinh chỉnh \`Autovacuum\` riêng cho các bảng Nóng (\`Hot Tables\`):** Mọi bảng có trên \`1,000,000 dòng\` và tần suất \`UPDATE / DELETE\` cao đều phải được hạ \`autovacuum_vacuum_scale_factor\` từ \`0.20\` xuống \`0.01 – 0.02\` để thu hồi không gian trang \`8KB\` kịp thời.

---

# 3. TỐI ƯU HÓA TRUY VẤN VỚI EXPLAIN (ANALYZE, BUFFERS), CHIẾN LƯỢC INDEX (B-TREE, GIN, BRIN) VÀ KHÔI PHỤC THẢM HỌA PITR

### 3.1 Giải phẫu Kế hoạch Thực thi (\`Seq Scan\`, \`Index Scan\`, \`Bitmap Heap Scan\`) và Ba Kiểu Chỉ mục (\`B-Tree\`, \`GIN\`, \`BRIN\`)

Khi nhận một câu lệnh SQL, **Bộ Tối ưu hóa Truy vấn dựa trên Chi phí (\`Cost-Based Query Optimizer / Planner\`)** của PostgreSQL sẽ ước lượng tổng chi phí I/O và CPU để chọn ra một trong các chiến lược quét dữ liệu và cấu trúc chỉ mục sau:

1. **Ba Chiến lược Quét Bảng Cốt lõi và Điểm Đảo chiều Chi phí (\`Selectivity Crossover Point\`):**
   - **Quét Tuần tự Toàn bảng (\`Sequential Scan — Seq Scan\`):** Đọc liên tiếp toàn bộ các trang \`8KB\` của bảng từ đầu đến cuối. Rất tối ưu khi bảng cực nhỏ (vài trang) hoặc khi câu lệnh lấy ra **trên \`15% – 25%\` tổng số dòng của bảng** (vì đọc đĩa tuần tự liên tiếp rẻ hơn gấp nhiều lần so với đọc nhảy cóc ngẫu nhiên).
   - **Quét Chỉ mục Trực tiếp (\`Index Scan\` & \`Index Only Scan\`):** Duyệt cây chỉ mục tìm địa chỉ \`ctid\`, sau đó nhảy vào trang \`Heap\` tương ứng để lấy dòng dữ liệu. Nếu mọi cột trong mệnh đề \`SELECT\` đều đã nằm sẵn trong Index (nhờ từ khóa \`INCLUDE\`) và trang đó được đánh dấu sạch trên **\`Visibility Map\`**, PostgreSQL kích hoạt **\`Index Only Scan\`** — trả kết quả ngay từ Index với \`0 Heap Fetches\`!
   - **Quét Bản đồ Bit Hai pha (\`Bitmap Index Scan\` $\rightarrow$ \`Bitmap Heap Scan\`):** Khi điều kiện lọc trả về một lượng dòng vừa phải (ví dụ từ \`1,000 đến 50,000 dòng\` — quá nhiều để nhảy ngẫu nhiên bằng \`Index Scan\`, nhưng quá ít để đọc cả bảng bằng \`Seq Scan\`), PostgreSQL dùng pha 1 (\`Bitmap Index Scan\`) để gom toàn bộ các số hiệu trang \`Page Number\` thỏa mãn vào một mảng Bit trong RAM và **sắp xếp lại theo thứ tự vật lý tăng dần**, sau đó pha 2 (\`Bitmap Heap Scan\`) chỉ việc đọc một mạch tuần tự qua các trang đó và mỗi trang chỉ đọc đúng 1 lần!
2. **Ba Cấu trúc Chỉ mục Chuyên biệt (\`B-Tree\`, \`GIN\`, \`BRIN\`):**
   - **\`B-Tree Index\` (Mặc định):** Cây cân bằng đa nhánh cho phép tìm kiếm $O(\\log N)$ với các toán tử so sánh bằng (\`=\`), khoảng (\`<\`, \`<=\`, \`>\`, \`>=\`, \`BETWEEN\`), tiền tố chuỗi (\`LIKE 'ARC%'\`) và hỗ trợ trả dữ liệu đã sắp xếp sẵn cho \`ORDER BY\`.
   - **\`GIN (Generalized Inverted Index — Chỉ mục Đảo ngược)\`:** Thiết kế chuyên biệt cho các cột chứa nhiều phần tử con bên trong 1 ô dữ liệu như **\`JSONB\`**, mảng **\`ARRAY\`**, hoặc văn bản **\`Full-Text Search (tsvector)\`**. \`GIN\` bóc tách từng cặp \`key:value\` bên trong tài liệu \`JSONB\` thành các mục từ khóa và gắn với danh sách \`Posting List\` các \`ctid\`, giúp truy vấn \`WHERE metadata @> '{"tier": "PRO"}'\` trên 10 triệu dòng chỉ mất dưới \`2 ms\`!
   - **\`BRIN (Block Range Index — Chỉ mục Khoảng Khối)\`:** Thay vì lưu vị trí của từng dòng, \`BRIN\` chỉ lưu **Giá trị Nhỏ nhất (\`Min\`) và Lớn nhất (\`Max\`)** của mỗi cụm \`128 trang 8KB liên tiếp (1 MB)\`. Nhờ đó, kích thước của \`BRIN Index\` nhỏ hơn \`B-Tree\` tới **\`99.9%\`** (chỉ vài chục Kilobytes thay vì hàng chục Gigabytes), cực kỳ lý tưởng cho các bảng lịch sử giao dịch hoặc nhật ký thời gian (\`Time-Series / Append-only Logs\`) có cột \`created_at\` tăng tuyến tính theo thứ tự ghi vật lý.

### 3.2 Hiện thực Bộ Phân tích Tự động \`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)\` và Giám sát \`Buffer Hit Ratio\` trong NestJS

Đoạn mã dưới đây minh họa cách xây dựng một dịch vụ chẩn đoán hiệu năng truy vấn tự động trong NestJS, đọc trực tiếp đầu ra JSON của \`EXPLAIN (ANALYZE, BUFFERS)\` để tính toán tỷ lệ trúng bộ đệm và phát hiện sớm các điểm nghẽn \`Seq Scan\` hoặc \`Disk Sort\`:

\`\`\`typescript
// File: src/modules/database/pg-query-diagnostics.service.ts
import { Injectable } from '@nestjs/common';

export interface ExplainPlanMetrics {
  readonly rootNodeType: string;
  readonly executionTimeMs: number;
  readonly sharedHitBlocks: number;
  readonly sharedReadBlocks: number;
  readonly tempWrittenBlocks: number;
  readonly bufferHitRatioPct: number;
  readonly tuningRecommendations: string[];
}

export interface RawPostgresPlanNode {
  readonly 'Node Type': string;
  readonly 'Actual Rows': number;
  readonly 'Shared Hit Blocks'?: number;
  readonly 'Shared Read Blocks'?: number;
  readonly 'Temp Written Blocks'?: number;
  readonly 'Sort Space Type'?: 'Disk' | 'Memory';
}

@Injectable()
export class PgQueryDiagnosticsService {
  analyzeExplainOutput(
    rootNode: RawPostgresPlanNode,
    executionTimeMs: number,
  ): ExplainPlanMetrics {
    const hit = rootNode['Shared Hit Blocks'] ?? 0;
    const read = rootNode['Shared Read Blocks'] ?? 0;
    const tempWritten = rootNode['Temp Written Blocks'] ?? 0;
    const totalBlocks = hit + read;

    const bufferHitRatioPct =
      totalBlocks > 0
        ? Math.round((hit / totalBlocks) * 10000) / 100
        : 100;

    const recommendations: string[] = [];

    if (rootNode['Node Type'] === 'Seq Scan' && rootNode['Actual Rows'] >= 5000) {
      recommendations.push('ADD_BTREE_OR_GIN_INDEX_TO_AVOID_LARGE_SEQ_SCAN');
    }
    if (bufferHitRatioPct < 95 && read > 100) {
      recommendations.push('INCREASE_SHARED_BUFFERS_OR_REDUCE_TABLE_BLOAT');
    }
    if (rootNode['Sort Space Type'] === 'Disk' || tempWritten > 0) {
      recommendations.push('INCREASE_WORK_MEM_TO_PREVENT_TEMP_DISK_SPILL');
    }

    return {
      rootNodeType: rootNode['Node Type'],
      executionTimeMs: Math.round(executionTimeMs * 100) / 100,
      sharedHitBlocks: hit,
      sharedReadBlocks: read,
      tempWrittenBlocks: tempWritten,
      bufferHitRatioPct,
      tuningRecommendations: recommendations,
    };
  }
}
\`\`\`

### 3.3 Chiến lược Sao lưu Liên tục (\`WAL Archiving\`), Khôi phục Điểm thời gian (\`PITR\`) và Bảng Chẩn đoán Sự cố Production

Trong hệ thống tài chính và thương mại điện tử, việc chỉ chạy lệnh \`pg_dump\` mỗi đêm lúc \`02:00 sáng\` là không đủ an toàn: nếu ổ cứng sập hoặc có người chạy nhầm lệnh \`DELETE FROM orders;\` lúc \`14:30 chiều\`, doanh nghiệp sẽ mất trắng toàn bộ dữ liệu giao dịch của \`12.5 tiếng\` trong ngày (\`RPO = 12.5 hours\`).
- Để đạt mục tiêu mất mát dữ liệu bằng không (**\`RPO ≈ 0\`**), kiến trúc sư triển khai **Khôi phục Điểm Thời gian (\`Point-In-Time Recovery — PITR\`)** gồm 2 thành phần: **(1)** Bản chụp vật lý toàn bộ thư mục dữ liệu gốc (**\`Physical Base Backup\`** qua \`pg_basebackup\` hoặc \`pgBackRest\`), kết hợp với **(2)** Lưu trữ Liên tục các tệp nhật ký **\`WAL Archiving\`** (đẩy từng phân đoạn WAL \`16 MB\` từ thư mục \`pg_wal\` lên kho lưu trữ bất biến \`Amazon S3 / GCS\` ngay khi tệp đó đầy hoặc theo chu kỳ \`archive_timeout = 60s\`).
- Khi sự cố xảy ra lúc \`14:30:00\`, kỹ sư khôi phục bản \`Base Backup\` gần nhất và cấu hình \`recovery_target_time = '2026-10-15 14:29:59'\`: PostgreSQL sẽ tự động đọc và phát lại (\`Replay\`) từng bản ghi giao dịch trong chuỗi tệp \`WAL\` cho đến đúng giây cuối cùng trước thảm họa!

Bảng dưới đây tổng hợp 5 kịch bản sự cố PostgreSQL nghiêm trọng nhất trên Production và quy trình xử lý chuẩn mực:

| Triệu chứng Quan sát được trên Production | Chỉ số / Dấu hiệu trong \`EXPLAIN\` hoặc \`pg_stat_activity\` | Nguyên nhân Gốc rễ ở Tầng Engine | Rủi ro Nếu Xử lý Sai cách | Giải pháp Khắc phục Triệt để Chuẩn Kiến trúc |
| :--- | :--- | :--- | :--- | :--- |
| **1. Truy vấn lọc theo cột \`JSONB\` làm treo CPU 100% dù bảng mới có 500,000 dòng** | \`Seq Scan on products\` + \`Rows Removed by Filter: 499950\` | Đánh nhầm \`B-Tree Index\` lên cả cột \`JSONB\` hoặc chưa đánh chỉ mục cho toán tử \`@>\` | Tách cột JSONB ra thành hàng chục bảng phụ làm phức tạp hóa tầng ORM | Tạo chỉ mục đảo ngược: **\`CREATE INDEX CONCURRENTLY idx_json ON tbl USING GIN (data jsonb_path_ops);\`** |
| **2. Lệnh \`CREATE INDEX\` trên bảng lớn làm treo toàn bộ các API \`INSERT / UPDATE\`** | Hàng trăm kết nối bị kẹt ở trạng thái \`Lock: relation\` trong \`pg_stat_activity\` | Lệnh \`CREATE INDEX\` tiêu chuẩn áp đặt khóa \`SHARE Lock\` chặn mọi thao tác ghi trên bảng | Chạy migration tạo Index trực tiếp vào giờ cao điểm mà không có từ khóa \`CONCURRENTLY\` | Luôn bắt buộc dùng **\`CREATE INDEX CONCURRENTLY\`** để dựng Index ngầm mà không khóa thao tác ghi |
| **3. Dung lượng ổ đĩa của bảng tăng gấp 5 lần dù số dòng thực tế (\`COUNT(*)\`) không tăng** | \`n_dead_tup\` trong \`pg_stat_user_tables\` lên tới hàng triệu dòng; \`shared read\` tăng cao | **\`Table Bloat\`**: Có giao dịch \`idle in transaction\` bị treo chặn đứng \`Autovacuum\`, hoặc \`scale_factor\` quá lớn | Chạy \`VACUUM FULL\` vào giờ hành chính (lệnh này khóa cứng toàn bảng cả đọc lẫn ghi!) | Đặt \`idle_in_transaction_session_timeout = '15s'\`, hạ \`scale_factor = 0.01\` và dùng công cụ \`pg_repack\` |
| **4. Truy vấn \`ORDER BY\` hoặc \`HASH JOIN\` chạy chậm bất thường và tốn nhiều Disk I/O** | \`Sort Method: external merge Disk: 48200kB\` và xuất hiện \`Buffers: temp read/written\` | Tập dữ liệu sắp xếp vượt quá hạn mức \`work_mem\` của kết nối nên bị đẩy ra tệp tạm trên đĩa | Tăng \`work_mem\` toàn cục lên \`1 GB\` làm máy chủ bị \`Linux OOM Killer\` giết tiến trình | Tạo \`B-Tree Index\` khớp thứ tự \`ORDER BY\` hoặc dùng \`SET LOCAL work_mem = '128MB'\` cho riêng query đó |
| **5. Lỗi \`FATAL: sorry, too many clients already\` khi mở rộng số lượng Pod Kubernetes** | \`SELECT count(*) FROM pg_stat_activity\` chạm trần \`max_connections\` (mặc định \`100\`) | Tổng \`maxPoolSize\` của các Pods NestJS nhân lên vượt quá số kết nối tối đa của PostgreSQL | Tăng \`max_connections\` của DB lên \`2,000\` làm sập hiệu năng do tranh chấp bộ nhớ và \`fork()\` | Đặt **\`PgBouncer\`** ở chế độ \`Transaction Pooling\` phía trước DB và giảm \`max\` của mỗi Pod xuống \`5 – 10\` |

> **Tổng kết học thuật Phần 3 (Quy tắc An toàn Khi Thay đổi Cấu trúc Bảng — Zero-Downtime DDL Rule):**
> Trên môi trường Production có lưu lượng truy cập thực tế, mọi câu lệnh tạo hoặc xóa chỉ mục trên PostgreSQL bắt buộc phải sử dụng từ khóa **\`CONCURRENTLY\`** (\`CREATE INDEX CONCURRENTLY\` / \`DROP INDEX CONCURRENTLY\`), đồng thời phải thiết lập \`SET lock_timeout = '2s';\` trước các lệnh \`ALTER TABLE\` để ngăn chặn hiện tượng xếp hàng chờ khóa (\`Lock Queue Amplification\`) làm tê liệt toàn bộ dịch vụ Backend.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Cơ Sở Dữ Liệu PostgreSQL Enterprise (PostgreSQL Architecture Taxonomy)
\`\`\`diagram
[TOPOLOGY: taxonomy-tree]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG GIAO TIẾP KẾT NỐI & BỂ ĐIỀU PHỐI (CLIENT & CONNECTION POOLING LAYER)  │
│    [ NestJS TypeORM/Prisma (Pool max=10) ] ◄───► [ PgBouncer (Transaction Pool) ] ◄───► [ Postmaster Daemon (Port 5432) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Xác thực SCRAM-SHA-256 và Fork Tiến trình Backend Worker
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG BỘ NHỚ ĐỆM DÙNG CHUNG & CỤC BỘ (SHARED & LOCAL MEMORY SUBSYSTEM)      │
│    ├── Shared Buffers (25%-40% RAM): Lưu đệm các khối 8KB Data & Index Pages  │
│    ├── WAL Buffers (16MB-64MB): Đệm nhật ký giao dịch trước khi xả xuống đĩa  │
│    └── Local work_mem (16MB-64MB): Bộ nhớ riêng cho Sort/Hash chống tràn đĩa  │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Đồng bộ Trang Bẩn (Dirty Pages) và Thu gom Rác MVCC
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG TIẾN TRÌNH NỀN ĐIỀU PHỐI (BACKGROUND PROCESSES ORCHESTRATION)         │
│    ├── WAL Writer & Checkpointer: Bảo toàn ACID Durability và tạo mốc REDO    │
│    ├── Background Writer (bgwriter): Quét Clock Sweep giữ sẵn Clean Buffers   │
│    └── Autovacuum Daemon: Dọn Dead Tuples của MVCC và chạy ANALYZE thống kê   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Ghi Tuần tự Nhật ký WAL và Truy xuất Khối 8KB trên NVMe
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 4. TẦNG LƯU TRỮ VẬT LÝ & CHỈ MỤC (PHYSICAL STORAGE & INDEXING ENGINES)        │
│    ├── 8KB Slotted Pages (Heap): Line Pointers đi xuống, Tuples (xmin/xmax) lên│
│    ├── Index Engines: B-Tree (Khoảng/Bằng), GIN (JSONB/Array), BRIN (Time-Log)│
│    └── Continuous WAL Archiving (16MB Segments): Phục hồi thảm họa PITR RPO≈0 │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Quét Tuần Tự Toàn Bảng (Sequential Scan) Và Quét Chỉ Mục Kết Hợp Bộ Đệm (Index Scan & Shared Buffers)
\`\`\`diagram
MÔ HÌNH CŨ: TRUY VẤN THIẾU INDEX HOẶC TRÀN WORK_MEM GÂY QUÉT ĐĨA TOÀN BẢNG (SEQ SCAN & DISK SPILL)
Query thiếu Index ──► [ Đọc tuần tự 500,000 Pages 8KB từ đĩa ] ──► [ Đẩy sạch Cache nóng khỏi RAM ] ──► NGHẼN I/O TOÀN CỤC
10,000,000 Dòng = Đọc 4 GB dữ liệu thô từ đĩa + External Merge Disk Sort làm độ trễ vọt từ 2ms lên 3,500ms.

MÔ HÌNH HIỆN ĐẠI: TỐI ƯU HÓA B-TREE / GIN INDEX KẾT HỢP SHARED BUFFERS HIT & WORK_MEM TRONG RAM
Query có Index chuẩn ──┐
Trúng Shared Buffers ──┼──► [ Duyệt 3 tầng B-Tree lấy thẳng ctid ] ──► Đọc đúng 2 Pages 8KB trong RAM (0 Disk Read)
Sắp xếp trong RAM   ──┘                       │
                                              └──► Buffer Hit Ratio > 99% ────► Phản hồi ổn định dưới 1.5ms ở tải cao
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Lựa Chọn Cấu Trúc Index Trong PostgreSQL)
\`\`\`diagram
                CẦN LỰA CHỌN LOẠI CHỈ MỤC (INDEX) TỐI ƯU CHO CỘT DỮ LIỆU TRONG POSTGRESQL?
                                                     │
                                                     ▼
                    Kiểu dữ liệu và đặc tính truy vấn của cột cần đánh chỉ mục là gì?
                    /                                                                \\
       CỘT ĐA GIÁ TRỊ (JSONB, ARRAY, FULL-TEXT SEARCH)                CỘT ĐƠN GIÁ TRỊ (INT, UUID, VARCHAR, TIMESTAMP)
                     /                                                                  \\
                    ▼                                                                    ▼
     [ DÙNG CHỈ MỤC ĐẢO NGƯỢC GIN INDEX (CHUẨN) ]                     Bảng có phải dữ liệu lịch sử chỉ ghi nối tiếp theo thời gian không?
     - Tối ưu cho toán tử @>, ?, ?&, @@ trên JSONB                    /                                                                \\
     - Dùng jsonb_path_ops để giảm 50% dung lượng Index     BẢNG LOG / TIME-SERIES HÀNG TỶ DÒNG                            BẢNG NGHIỆP VỤ OLTP TRUY VẤN NGẪU NHIÊN
     - Chấp nhận chi phí ghi lớn hơn B-Tree thông thường             /                                                                    \\
                                                                    ▼                                                                      ▼
                                                  [ DÙNG CHỈ MỤC KHOẢNG KHỐI BRIN (TỐI ƯU) ]                     [ DÙNG CHỈ MỤC CÂY CÂN BẰNG B-TREE (CHUẨN) ]
                                                  - Chỉ lưu Min/Max của mỗi cụm 128 khối 8KB                     - Đa năng cho so sánh =, <, >, BETWEEN, ORDER BY
                                                  - Tiết kiệm 99.9% dung lượng đĩa so với B-Tree                 - Kết hợp INCLUDE để kích hoạt Index Only Scan
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu B-Tree Index, GIN Index, BRIN Index Và Sequential Scan)

| Tiêu Chí So Sánh | \`B-Tree Index\` (Mặc định) | \`GIN Index\` (Chỉ mục Đảo ngược) | \`BRIN Index\` (Chỉ mục Khoảng Khối) | \`Sequential Scan\` (Không dùng Index) |
| :--- | :--- | :--- | :--- | :--- |
| **Cấu trúc Dữ liệu Nội tại** | Cây cân bằng đa nhánh lưu giá trị khóa và con trỏ \`ctid\` ở nút lá | Cây từ khóa trỏ tới danh sách \`Posting List / Tree\` chứa các \`ctid\` | Mảng siêu nhỏ chỉ lưu \`(Min, Max)\` cho mỗi dải \`128 Pages (1 MB)\` | Duyệt trực tiếp từng khối \`8KB Heap Page\` từ đầu đến cuối tệp |
| **Toán tử Truy vấn Tối ưu** | \`=\`, \`<\`, \`<=\`, \`>\`, \`>=\`, \`BETWEEN\`, \`IN\`, \`LIKE 'abc%'\`, \`ORDER BY\` | Toán tử bao hàm \`JSONB\` (\`@>\`, \`?\`, \`?\\|\`, \`?&\`), mảng (\`&&\`), \`tsvector\` (\`@@\`) | Lọc theo khoảng thời gian \`WHERE created_at BETWEEN ...\` trên bảng tuần tự | Truy vấn lấy ra **\`> 20% – 30%\`** tổng số dòng hoặc bảng cực nhỏ |
| **Dung lượng Lưu trữ & RAM** | Trung bình (Thường chiếm \`15% – 30%\` dung lượng của bảng dữ liệu) | Lớn (Có thể chiếm \`30% – 80%\` bảng; giảm một nửa nếu dùng \`jsonb_path_ops\`) | **Siêu nhỏ (\`< 0.1%\` bảng)**: Bảng \`100 GB\` chỉ tốn vài trăm \`KB\` chỉ mục | \`0 Bytes\` chi phí lưu trữ chỉ mục phụ |
| **Chi phí Khi Ghi (\`INSERT/UPDATE\`)** | Thấp (Cập nhật 1 nút lá; được miễn hoàn toàn nếu thỏa điều kiện \`HOT Update\`) | Cao (Một tài liệu JSONB có 20 khóa phải cập nhật 20 vị trí trong cây GIN; hỗ trợ \`fastupdate\`) | Cực thấp (Chỉ cập nhật lại số \`Max\` của dải khối hiện tại) | Nhanh nhất khi nạp dữ liệu hàng loạt (\`Bulk Load / COPY\`) |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`PostgreSqlEngineService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Bền vững hóa Giao dịch qua Ghi Trước Tuần tự (\`Write-Ahead Logging & 8KB Page Invariant\`):** Mọi dữ liệu trong PostgreSQL đều được quản lý theo đơn vị khối trang **\`8KB Slotted Page\`** bên trong vùng đệm RAM (\`shared_buffers\`). Khi thực hiện \`COMMIT\`, PostgreSQL không cần đẩy ngay các trang dữ liệu bẩn (\`Dirty Pages\`) xuống tệp bảng (vốn gây Random I/O đắt đỏ), mà chỉ cần ghi nối tiếp tuần tự bản ghi thay đổi vào tệp nhật ký **\`WAL (pg_wal)\`** và gọi \`fsync()\`, đảm bảo đồng thời tốc độ phản hồi phần nghìn giây và tính bền vững tuyệt đối (\`ACID Durability\`).
2. **Định đề Đa phiên bản Không Khóa và Thu gom Rác (\`MVCC & Autovacuum Invariant\`):** Nhờ cơ chế \`MVCC\` sử dụng cặp nhãn giao dịch \`xmin / xmax\` trên từng dòng dữ liệu, các thao tác đọc (\`SELECT\`) không bao giờ chặn thao tác ghi (\`UPDATE/DELETE\`) và ngược lại. Tuy nhiên, vì \`UPDATE\` và \`DELETE\` luôn để lại các dòng dữ liệu chết (\`Dead Tuples\`) ngay trên trang \`8KB\`, hệ thống bắt buộc phải duy trì tiến trình **\`Autovacuum\`** thông suốt và nghiêm cấm để tồn tại các giao dịch treo (\`idle in transaction\`) làm phình đại bảng (\`Table Bloat\`).
3. **Định đề Giới hạn Tiến trình Kết nối (\`Process-per-Connection & Pool Sizing Invariant\`):** Do mỗi kết nối vật lý tới PostgreSQL đều khởi tạo một tiến trình hệ điều hành riêng biệt (\`postgres backend process\`), việc mở hàng trăm kết nối trực tiếp từ các Pods Microservices sẽ gây suy sụp hiệu năng do chuyển ngữ cảnh CPU và tranh chấp khóa bộ nhớ dùng chung. Tổng số kết nối thực thi đồng thời phải được giữ xoay quanh ngưỡng $\\approx 2 \\times \\text{CPU Cores}$ thông qua bể kết nối giới hạn chặt hoặc bộ ghép kênh \`PgBouncer\`.
4. **Định đề Khôi phục Không Mất Dữ liệu (\`Continuous WAL Archiving & PITR Invariant\`):** Sao lưu logic định kỳ (\`pg_dump\`) chỉ cung cấp ảnh chụp tại một thời điểm rời rạc và không thể bảo vệ hệ thống khỏi sự cố xóa nhầm dữ liệu giữa hai kỳ sao lưu. Để đạt khả năng khôi phục tới từng mili-giây bất kỳ trong quá khứ (\`PITR\`), hạ tầng Production bắt buộc phải kết hợp **Bản sao lưu Vật lý Nền tảng (\`Base Backup\`)** với **Lưu trữ Liên tục chuỗi tệp \`WAL\` (\`WAL Archiving\`)** sang kho lưu trữ độc lập.
  `,
  realCodeSnippet: `// File: src/modules/database/postgresql-engine.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Quản trị PostgreSQL Pool, EXPLAIN ANALYZE & Buffer Cache Hit Ratio
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

export interface DatabaseQueryRow {
  readonly [column: string]: unknown;
}

export interface DatabaseClientAdapter {
  query<T extends DatabaseQueryRow = DatabaseQueryRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  release(): void;
}

export interface DatabasePoolAdapter {
  connect(): Promise<DatabaseClientAdapter>;
  query<T extends DatabaseQueryRow = DatabaseQueryRow>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
  end(): Promise<void>;
}

export interface QueryAnalysisReport {
  readonly totalCost: number;
  readonly actualDurationMs: number;
  readonly bufferHitRatioPct: number;
  readonly hasLargeSeqScan: boolean;
}

/**
 * ADR-0042: Chuẩn hóa Kết nối PostgreSQL Enterprise và Kiểm toán Hiệu năng Truy vấn:
 * 1. Giới hạn kích thước Pool (max = 10 trên mỗi Pod) để bảo vệ tiến trình Postmaster khỏi quá tải fork().
 * 2. Thiết lập statement_timeout (10s) và idle_in_transaction_session_timeout (15s) ngay khi khởi tạo
 *    nhằm ngăn chặn các giao dịch treo làm tê liệt tiến trình Autovacuum (chống Table Bloat).
 * 3. Cung cấp phương thức kiểm toán EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) kết hợp đo lường
 *    tỷ lệ Buffer Cache Hit Ratio trực tiếp từ bảng hệ thống pg_statio_user_tables.
 */
@Injectable()
export class PostgreSqlEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgreSqlEngineService.name);
  private pool: DatabasePoolAdapter | null = null;

  public bindPoolAdapter(adapter: DatabasePoolAdapter): void {
    this.pool = adapter;
  }

  public async onModuleInit(): Promise<void> {
    if (!this.pool) {
      return;
    }
    const client = await this.pool.connect();
    try {
      const res = await client.query<{ version: string; shared_buffers: string }>(
        "SELECT version(), current_setting('shared_buffers') AS shared_buffers;",
      );
      const info = res.rows[0];
      this.logger.log(
        \`[PostgreSQL Ready] Version: \${info?.version ?? 'unknown'} | shared_buffers: \${info?.shared_buffers ?? 'default'}\`,
      );
    } finally {
      client.release();
    }
  }

  public async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Đã đóng toàn bộ kết nối trong PostgreSQL Pool an toàn.');
    }
  }

  public async inspectQueryPerformance(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryAnalysisReport> {
    if (!this.pool) {
      throw new Error('POSTGRES_POOL_NOT_INITIALIZED');
    }

    const explainSql = \`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) \${sql}\`;
    const explainRes = await this.pool.query<{
      'QUERY PLAN': Array<{
        Plan: { 'Node Type': string; 'Total Cost': number; 'Actual Rows': number };
        'Execution Time': number;
      }>;
    }>(explainSql, params);

    const planRoot = explainRes.rows[0]?.['QUERY PLAN']?.[0];
    const totalCost = planRoot?.Plan?.['Total Cost'] ?? 0;
    const actualDurationMs = planRoot?.['Execution Time'] ?? 0;
    const hasLargeSeqScan =
      planRoot?.Plan?.['Node Type'] === 'Seq Scan' &&
      (planRoot?.Plan?.['Actual Rows'] ?? 0) >= 1000;

    const ratioRes = await this.pool.query<{ buffer_hit_ratio: number }>(
      \`SELECT round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2) AS buffer_hit_ratio
       FROM pg_statio_user_tables;\`,
    );

    const bufferHitRatioPct = Number(ratioRes.rows[0]?.buffer_hit_ratio ?? 100);

    return {
      totalCost,
      actualDurationMs,
      bufferHitRatioPct,
      hasLargeSeqScan,
    };
  }
}`,
  quiz: [
    {
      id: 'c4-l1b-q1',
      question: 'Vùng bộ nhớ shared_buffers trong kiến trúc vật lý của PostgreSQL đảm nhiệm vai trò cốt lõi nào sau đây?',
      options: [
        'Lưu trữ mã nguồn biên dịch tĩnh của toàn bộ các hàm Stored Procedures, Triggers và Views của hệ thống cơ sở dữ liệu.',
        'Đóng vai trò là bộ nhớ đệm RAM dùng chung giữa mọi tiến trình kết nối để lưu trữ và thao tác trên các trang dữ liệu 8KB.',
        'Lưu trữ danh sách thông tin tài khoản, mật khẩu băm SCRAM-SHA-256 và bảng phân quyền Role của người dùng trên toàn cụm.',
        'Chứa các tệp tin sao lưu định kỳ do công cụ pg_dump xuất ra trước khi được nén và đẩy lên hệ thống lưu trữ đám mây.'
      ],
      correctIndex: 1,
      explanation: 'shared_buffers là vùng bộ nhớ RAM dùng chung quan trọng nhất của PostgreSQL (thường được cấp phát từ 25% đến 40% tổng RAM máy chủ), nơi nạp và lưu đệm các khối dữ liệu 8KB Page từ đĩa cứng để mọi tiến trình Backend Worker có thể đọc và sửa đổi với tốc độ nano-giây.'
    },
    {
      id: 'c4-l1b-q2',
      question: 'Sự khác biệt trách nhiệm cốt lõi giữa hai tiến trình nền Background Writer (bgwriter) và Checkpointer trong PostgreSQL là gì?',
      options: [
        'bgwriter chuyên ghi nhật ký giao dịch WAL xuống đĩa, trong khi Checkpointer chuyên thu gom các dòng dữ liệu chết Dead Tuples.',
        'bgwriter quét đẩy dần các trang bẩn để giữ sẵn vùng đệm sạch trong RAM, còn Checkpointer đồng bộ toàn bộ trang bẩn để tạo mốc khôi phục.',
        'bgwriter chỉ hoạt động trên các bảng tạm thời trong bộ nhớ, trong khi Checkpointer chỉ hoạt động trên các bảng có đánh chỉ mục B-Tree.',
        'bgwriter chịu trách nhiệm thực thi các câu lệnh INSERT mới, trong khi Checkpointer chịu trách nhiệm thực thi các câu lệnh SELECT.'
      ],
      correctIndex: 1,
      explanation: 'bgwriter chạy liên tục theo thuật toán Clock Sweep để ghi một phần các Dirty Pages xuống đĩa nhằm đảm bảo luôn có sẵn Clean Buffers cho các truy vấn mới. Ngược lại, Checkpointer định kỳ xả 100% các Dirty Pages hiện có xuống đĩa và ghi mốc REDO Point vào WAL để giới hạn thời gian phục hồi khi sập nguồn.'
    },
    {
      id: 'c4-l1b-q3',
      question: 'Trong tình huống nào bộ tối ưu hóa truy vấn (Query Planner) của PostgreSQL sẽ chủ động chọn Sequential Scan thay vì dùng B-Tree Index?',
      options: [
        'Khi bảng dữ liệu rất nhỏ hoặc khi điều kiện truy vấn lọc ra một tỷ lệ lớn dòng dữ liệu khiến đọc tuần tự rẻ hơn nhảy ngẫu nhiên.',
        'Khi câu truy vấn SQL được gửi tới từ một ứng dụng Node.js sử dụng thư viện kết nối bất đồng bộ thay vì trình dòng lệnh psql.',
        'Khi bảng dữ liệu được lưu trữ trên phân vùng ổ cứng chuẩn NVMe SSD có bật tính năng mã hóa phần cứng toàn phần ở tầng hệ điều hành.',
        'Khi mệnh đề WHERE trong câu truy vấn có sử dụng toán tử so sánh bằng trực tiếp trên cột khóa chính kiểu số nguyên 64-bit BIGINT.'
      ],
      correctIndex: 0,
      explanation: 'Index Scan đòi hỏi phải đọc qua cây chỉ mục rồi mới nhảy ngẫu nhiên (Random I/O) vào các trang Heap 8KB để lấy dòng dữ liệu. Khi bảng chỉ có vài trang hoặc điều kiện lọc trả về trên 15%-25% tổng số bản ghi của bảng, việc đọc tuần tự một mạch toàn bộ các trang (Sequential I/O) sẽ có tổng chi phí thấp hơn và nhanh hơn.'
    },
    {
      id: 'c4-l1b-q4',
      question: 'Để khôi phục cơ sở dữ liệu về đúng một mốc thời gian bất kỳ trước khi xảy ra sự cố xóa nhầm bảng (PITR), hệ thống bắt buộc phải có gì?',
      options: [
        'Một tệp tin xuất dữ liệu định dạng văn bản thuần túy được tạo ra từ câu lệnh pg_dumpall chạy vào thời điểm nửa đêm hôm trước.',
        'Một bản sao lưu vật lý nền tảng (Base Backup) kết hợp với chuỗi lưu trữ liên tục các tệp nhật ký giao dịch Write-Ahead Log (WAL).',
        'Danh sách toàn bộ các tệp tin kịch bản khởi tạo cấu trúc bảng (Migration Scripts) được lưu trữ trong kho mã nguồn Git của dự án.',
        'Nhật ký truy cập HTTP đầy đủ của máy chủ cân bằng tải Nginx đứng phía trước cụm ứng dụng vi dịch vụ Backend NestJS trong ngày.'
      ],
      correctIndex: 1,
      explanation: 'Khôi phục Điểm Thời gian (Point-In-Time Recovery - PITR) hoạt động bằng cách lấy bản chụp vật lý gốc (Physical Base Backup từ pg_basebackup) làm trạng thái xuất phát, sau đó đọc và phát lại (Replay) tuần tự từng bản ghi thay đổi trong chuỗi các tệp WAL đã lưu trữ cho đến đúng mili-giây mục tiêu.'
    },
    {
      id: 'c4-l1b-q5',
      question: 'Trong kiến trúc lưu trữ vật lý mặc định của PostgreSQL, mỗi trang dữ liệu (Data Page / Block) có kích thước chuẩn là bao nhiêu và bố cục ra sao?',
      options: [
        'Kích thước 4 KB, trong đó toàn bộ các bản ghi được sắp xếp cố định từ đầu trang đến cuối trang theo thứ tự chữ cái của khóa chính.',
        'Kích thước 8 KB theo cấu trúc Slotted Page: mảng con trỏ Line Pointers phát triển từ trên xuống, còn các Heap Tuples xếp từ đáy trang lên.',
        'Kích thước 16 KB theo cấu trúc danh sách liên kết đôi, không có phần Header mà lưu trực tiếp chuỗi văn bản JSON của từng bản ghi.',
        'Kích thước 64 KB thay đổi co giãn linh hoạt theo số lượng cột VARCHAR và được nén tự động bằng thuật toán Gzip sau mỗi câu lệnh INSERT.'
      ],
      correctIndex: 1,
      explanation: 'PostgreSQL chia mọi bảng và chỉ mục thành các khối cố định 8 KB (8,192 bytes) theo kiến trúc Slotted Page: đầu trang là Page Header (24 bytes) nối tiếp bởi mảng con trỏ Line Pointers (4 bytes/con trỏ) đi xuống, trong khi nội dung thực tế của các dòng (Heap Tuples) được chèn từ đáy trang đi ngược lên, ở giữa là vùng trống Free Space.'
    },
    {
      id: 'c4-l1b-q6',
      question: 'Tại sao cơ chế Kiểm soát Đồng thời Đa phiên bản (MVCC) của PostgreSQL lại bắt buộc tiến trình Autovacuum phải hoạt động liên tục và thông suốt?',
      options: [
        'Để định kỳ sắp xếp lại thứ tự vật lý của các thư mục trong hệ điều hành Linux nhằm ngăn chặn lỗi hỏng phân vùng đĩa cứng vật lý.',
        'Vì lệnh UPDATE và DELETE không xóa ngay bản ghi cũ mà để lại các Dead Tuples; Autovacuum giúp thu hồi chỗ trống và cập nhật thống kê.',
        'Để tự động làm mới lại mật khẩu kết nối của toàn bộ các ứng dụng vi dịch vụ đang kết nối vào cơ sở dữ liệu sau mỗi chu kỳ 60 phút.',
        'Để biên dịch lại các câu lệnh SQL thường dùng thành mã máy nhị phân lưu cố định vào bộ nhớ đệm L1 Cache của vi xử lý trung tâm CPU.'
      ],
      correctIndex: 1,
      explanation: 'Trong PostgreSQL, lệnh UPDATE thực chất là đánh dấu xmax vào dòng cũ và chèn thêm một dòng mới hoàn toàn; lệnh DELETE chỉ đánh dấu dòng cũ hết hiệu lực. Các dòng cũ này trở thành Dead Tuples chiếm chỗ trong trang 8KB. Tiến trình Autovacuum có nhiệm vụ thu hồi không gian của Dead Tuples để tái sử dụng (chống Table Bloat) và chạy ANALYZE cập nhật thống kê cho Query Planner.'
    },
    {
      id: 'c4-l1b-q7',
      question: 'Khi bảng dữ liệu có cột kiểu JSONB lưu cấu hình động và thường xuyên lọc bằng toán tử bao hàm (@>), loại Index nào mang lại hiệu năng tối ưu nhất?',
      options: [
        'Chỉ mục cây cân bằng B-Tree tiêu chuẩn đánh trực tiếp trên toàn bộ chuỗi văn bản thô của cột dữ liệu JSONB.',
        'Chỉ mục đảo ngược GIN (Generalized Inverted Index) giúp bóc tách từng cặp khóa và giá trị bên trong tài liệu JSONB.',
        'Chỉ mục băm Hash Index chỉ hỗ trợ phép so sánh tương đương tuyệt đối toàn bộ đối tượng JSON từ đầu đến cuối.',
        'Chỉ mục khoảng khối BRIN (Block Range Index) chỉ lưu giá trị nhỏ nhất và lớn nhất của mỗi cụm 128 trang dữ liệu.'
      ],
      correctIndex: 1,
      explanation: 'GIN (Generalized Inverted Index) được thiết kế chuyên biệt cho dữ liệu đa thành phần như JSONB, Array và Full-Text Search. Nó phân rã từng key/value hoặc đường dẫn bên trong tài liệu JSONB thành các mục từ trong cây chỉ mục kèm danh sách vị trí ctid, giúp các truy vấn chứa toán tử @>, ?, ?& đạt tốc độ phần nghìn giây.'
    },
    {
      id: 'c4-l1b-q8',
      question: 'Khi phân tích kết quả của câu lệnh EXPLAIN (ANALYZE, BUFFERS), thông số "Buffers: shared hit=1240" mang ý nghĩa kỹ thuật chính xác là gì?',
      options: [
        'Có 1,240 trang dữ liệu 8KB bị lỗi checksum phải đọc lại từ ổ cứng cơ học dự phòng trong quá trình thực thi câu truy vấn.',
        'Có 1,240 trang dữ liệu 8KB đã được tìm thấy và đọc trực tiếp từ bộ nhớ đệm RAM (shared_buffers) mà không tốn thao tác đọc đĩa.',
        'Có 1,240 tiến trình kết nối khác đang bị khóa cứng phải xếp hàng chờ câu truy vấn hiện tại giải phóng vùng nhớ dùng chung.',
        'Có 1,240 tệp tin tạm thời đã được ghi xuống thư mục đĩa cứng do dung lượng sắp xếp vượt quá hạn mức cấu hình của biến work_mem.'
      ],
      correctIndex: 1,
      explanation: 'Thông số "shared hit" cho biết số lượng khối trang 8KB đã nằm sẵn trong vùng đệm RAM (shared_buffers) tại thời điểm truy vấn, giúp tiến trình đọc dữ liệu ngay lập tức trong bộ nhớ mà không phải thực hiện lệnh đọc đĩa vật lý (shared read). Tỷ lệ shared hit càng cao so với shared read thì câu truy vấn càng nhanh.'
    }
  ],
  codeChallenge: {
    id: 'c4-l1b-c1',
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Tính Tỷ Lệ Trúng Bộ Đệm RAM (Buffer Cache Hit Ratio) & Dung Lượng Đọc Đĩa',
    description: 'Hiện thực hàm `calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks)` để phân tích thông số `Buffers` trích xuất từ câu lệnh `EXPLAIN (ANALYZE, BUFFERS)` của PostgreSQL.\nQuy tắc:\n1. Mỗi khối (`block / page`) trong PostgreSQL có kích thước chuẩn là **`8 KB`**.\n2. Tổng số khối truy xuất `totalBlocks = sharedHitBlocks + sharedReadBlocks`.\n3. Tính tỷ lệ trúng bộ đệm `hitRatioPct = (sharedHitBlocks / totalBlocks) * 100` (làm tròn 2 chữ số thập phân; nếu `totalBlocks === 0` thì `hitRatioPct = 100`).\n4. Tính dung lượng phải đọc từ đĩa cứng `diskReadKB = sharedReadBlocks * 8`.\n5. Phân loại trạng thái `status`: nếu `hitRatioPct >= 99` là `"OPTIMAL_RAM_HIT"`, nếu `hitRatioPct >= 90` là `"ACCEPTABLE_CACHE"`, ngược lại `< 90` là `"CRITICAL_DISK_IO"`.\nTrả về `{ totalBlocks, diskReadKB, hitRatioPct, status }`.',
    guidedSteps: [
      'Bước 1 (Tính tổng số trang 8KB và dung lượng đọc đĩa): Tính totalBlocks = sharedHitBlocks + sharedReadBlocks và diskReadKB = sharedReadBlocks * 8.',
      'Bước 2 (Tính tỷ lệ Buffer Cache Hit Ratio %): Nếu totalBlocks === 0 thì hitRatioPct = 100; ngược lại tính Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100.',
      'Bước 3 (Phân loại trạng thái hiệu năng I/O): So sánh hitRatioPct với các ngưỡng >= 99 ("OPTIMAL_RAM_HIT"), >= 90 ("ACCEPTABLE_CACHE"), và < 90 ("CRITICAL_DISK_IO").',
      'Bước 4 (Hoàn trả kết quả): Trả về đối tượng { totalBlocks, diskReadKB, hitRatioPct, status }.'
    ],
    hints: [
      'Đừng quên nhân sharedReadBlocks với 8 (vì 1 Page của PostgreSQL = 8 KB) để ra đúng diskReadKB.',
      'Sử dụng Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100 để làm tròn chính xác đến 2 chữ số thập phân.'
    ],
    starterCode: `function calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks) {
  // Bước 1: Tính totalBlocks và diskReadKB (mỗi block = 8 KB)
  
  // Bước 2: Tính hitRatioPct (làm tròn 2 chữ số thập phân, nếu totalBlocks === 0 thì bằng 100)
  
  // Bước 3: Xác định status ("OPTIMAL_RAM_HIT" | "ACCEPTABLE_CACHE" | "CRITICAL_DISK_IO")
  
  // Bước 4: Trả về { totalBlocks, diskReadKB, hitRatioPct, status }
}`,
    solution: `function calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks) {
  const totalBlocks = sharedHitBlocks + sharedReadBlocks;
  const diskReadKB = sharedReadBlocks * 8;
  const hitRatioPct =
    totalBlocks === 0
      ? 100
      : Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100;

  let status = 'CRITICAL_DISK_IO';
  if (hitRatioPct >= 99) {
    status = 'OPTIMAL_RAM_HIT';
  } else if (hitRatioPct >= 90) {
    status = 'ACCEPTABLE_CACHE';
  }

  return {
    totalBlocks,
    diskReadKB,
    hitRatioPct,
    status,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Tỷ lệ trúng RAM đạt 99.5% (1990 hit, 10 read) -> OPTIMAL_RAM_HIT',
        input: [1990, 10],
        expected: {
          totalBlocks: 2000,
          diskReadKB: 80,
          hitRatioPct: 99.5,
          status: 'OPTIMAL_RAM_HIT'
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Tỷ lệ trúng RAM đạt 95% (950 hit, 50 read) -> ACCEPTABLE_CACHE',
        input: [950, 50],
        expected: {
          totalBlocks: 1000,
          diskReadKB: 400,
          hitRatioPct: 95,
          status: 'ACCEPTABLE_CACHE'
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Truy vấn quét đĩa nặng chỉ đạt 50% hit (500 hit, 500 read) -> CRITICAL_DISK_IO',
        input: [500, 500],
        expected: {
          totalBlocks: 1000,
          diskReadKB: 4000,
          hitRatioPct: 50,
          status: 'CRITICAL_DISK_IO'
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Truy vấn không chạm vào block nào (0 hit, 0 read) -> Mặc định 100% OPTIMAL_RAM_HIT',
        input: [0, 0],
        expected: {
          totalBlocks: 0,
          diskReadKB: 0,
          hitRatioPct: 100,
          status: 'OPTIMAL_RAM_HIT'
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Kiểm tra làm tròn số thập phân lẻ (2 hit, 1 read -> 66.67%)',
        input: [2, 1],
        expected: {
          totalBlocks: 3,
          diskReadKB: 8,
          hitRatioPct: 66.67,
          status: 'CRITICAL_DISK_IO'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      id: 'c4-l1b-c1',
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Tính Tỷ Lệ Trúng Bộ Đệm RAM (Buffer Cache Hit Ratio) & Dung Lượng Đọc Đĩa',
      description: 'Hiện thực hàm `calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks)` để phân tích thông số `Buffers` trích xuất từ câu lệnh `EXPLAIN (ANALYZE, BUFFERS)` của PostgreSQL.\nQuy tắc:\n1. Mỗi khối (`block / page`) trong PostgreSQL có kích thước chuẩn là **`8 KB`**.\n2. Tổng số khối truy xuất `totalBlocks = sharedHitBlocks + sharedReadBlocks`.\n3. Tính tỷ lệ trúng bộ đệm `hitRatioPct = (sharedHitBlocks / totalBlocks) * 100` (làm tròn 2 chữ số thập phân; nếu `totalBlocks === 0` thì `hitRatioPct = 100`).\n4. Tính dung lượng phải đọc từ đĩa cứng `diskReadKB = sharedReadBlocks * 8`.\n5. Phân loại trạng thái `status`: nếu `hitRatioPct >= 99` là `"OPTIMAL_RAM_HIT"`, nếu `hitRatioPct >= 90` là `"ACCEPTABLE_CACHE"`, ngược lại `< 90` là `"CRITICAL_DISK_IO"`.\nTrả về `{ totalBlocks, diskReadKB, hitRatioPct, status }`.',
      guidedSteps: [
        'Bước 1 (Tính tổng số trang 8KB và dung lượng đọc đĩa): Tính totalBlocks = sharedHitBlocks + sharedReadBlocks và diskReadKB = sharedReadBlocks * 8.',
        'Bước 2 (Tính tỷ lệ Buffer Cache Hit Ratio %): Nếu totalBlocks === 0 thì hitRatioPct = 100; ngược lại tính Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100.',
        'Bước 3 (Phân loại trạng thái hiệu năng I/O): So sánh hitRatioPct với các ngưỡng >= 99 ("OPTIMAL_RAM_HIT"), >= 90 ("ACCEPTABLE_CACHE"), và < 90 ("CRITICAL_DISK_IO").',
        'Bước 4 (Hoàn trả kết quả): Trả về đối tượng { totalBlocks, diskReadKB, hitRatioPct, status }.'
      ],
      hints: [
        'Đừng quên nhân sharedReadBlocks với 8 (vì 1 Page của PostgreSQL = 8 KB) để ra đúng diskReadKB.',
        'Sử dụng Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100 để làm tròn chính xác đến 2 chữ số thập phân.'
      ],
      starterCode: `function calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks) {
  // Bước 1: Tính totalBlocks và diskReadKB (mỗi block = 8 KB)
  
  // Bước 2: Tính hitRatioPct (làm tròn 2 chữ số thập phân, nếu totalBlocks === 0 thì bằng 100)
  
  // Bước 3: Xác định status ("OPTIMAL_RAM_HIT" | "ACCEPTABLE_CACHE" | "CRITICAL_DISK_IO")
  
  // Bước 4: Trả về { totalBlocks, diskReadKB, hitRatioPct, status }
}`,
      solution: `function calculateBufferCacheMetrics(sharedHitBlocks, sharedReadBlocks) {
  const totalBlocks = sharedHitBlocks + sharedReadBlocks;
  const diskReadKB = sharedReadBlocks * 8;
  const hitRatioPct =
    totalBlocks === 0
      ? 100
      : Math.round((sharedHitBlocks / totalBlocks) * 10000) / 100;

  let status = 'CRITICAL_DISK_IO';
  if (hitRatioPct >= 99) {
    status = 'OPTIMAL_RAM_HIT';
  } else if (hitRatioPct >= 90) {
    status = 'ACCEPTABLE_CACHE';
  }

  return {
    totalBlocks,
    diskReadKB,
    hitRatioPct,
    status,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Tỷ lệ trúng RAM đạt 99.5% (1990 hit, 10 read) -> OPTIMAL_RAM_HIT',
          input: [1990, 10],
          expected: {
            totalBlocks: 2000,
            diskReadKB: 80,
            hitRatioPct: 99.5,
            status: 'OPTIMAL_RAM_HIT'
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Tỷ lệ trúng RAM đạt 95% (950 hit, 50 read) -> ACCEPTABLE_CACHE',
          input: [950, 50],
          expected: {
            totalBlocks: 1000,
            diskReadKB: 400,
            hitRatioPct: 95,
            status: 'ACCEPTABLE_CACHE'
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Truy vấn quét đĩa nặng chỉ đạt 50% hit (500 hit, 500 read) -> CRITICAL_DISK_IO',
          input: [500, 500],
          expected: {
            totalBlocks: 1000,
            diskReadKB: 4000,
            hitRatioPct: 50,
            status: 'CRITICAL_DISK_IO'
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Truy vấn không chạm vào block nào (0 hit, 0 read) -> Mặc định 100% OPTIMAL_RAM_HIT',
          input: [0, 0],
          expected: {
            totalBlocks: 0,
            diskReadKB: 0,
            hitRatioPct: 100,
            status: 'OPTIMAL_RAM_HIT'
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Kiểm tra làm tròn số thập phân lẻ (2 hit, 1 read -> 66.67%)',
          input: [2, 1],
          expected: {
            totalBlocks: 3,
            diskReadKB: 8,
            hitRatioPct: 66.67,
            status: 'CRITICAL_DISK_IO'
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l1b-c2',
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Hình Hoá Ngưỡng Kích Hoạt Autovacuum & Phân Bổ Connection Pool',
      description: 'Hiện thực hàm `planPostgresMaintenanceAndPool(liveTuples, deadTuples, scaleFactor, baseThreshold, dbCpuCores, appPods)` để tính toán đồng thời ngưỡng thu gom rác `Autovacuum` của cơ chế `MVCC` và hạn mức `Connection Pool` cho từng Pod NestJS.\nQuy tắc:\n1. Ngưỡng kích hoạt Autovacuum: `vacuumTriggerThreshold = Math.round(baseThreshold + (scaleFactor * liveTuples))`.\n2. Xác định bảng có cần chạy Vacuum ngay lập tức hay không: `shouldTriggerVacuum = deadTuples >= vacuumTriggerThreshold`.\n3. Tính tỷ lệ dòng chết (Bloat Ratio %): `deadTupleRatioPct = Math.round((deadTuples / (liveTuples + deadTuples)) * 10000) / 100` (nếu tổng số dòng bằng 0 thì bằng `0`).\n4. Tính tổng kết nối tối ưu của máy chủ DB: `optimalClusterConnections = (dbCpuCores * 2) + 2`, sau đó chia đều cho số Pod: `maxPoolPerPod = Math.max(2, Math.floor(optimalClusterConnections / appPods))`.\nTrả về `{ vacuumTriggerThreshold, shouldTriggerVacuum, deadTupleRatioPct, maxPoolPerPod }`.',
      guidedSteps: [
        'Bước 1 (Tính ngưỡng Autovacuum): Tính vacuumTriggerThreshold = Math.round(baseThreshold + scaleFactor * liveTuples).',
        'Bước 2 (Kiểm tra trạng thái kích hoạt Vacuum): Đặt shouldTriggerVacuum = (deadTuples >= vacuumTriggerThreshold).',
        'Bước 3 (Tính tỷ lệ Dead Tuple %): Tính totalTuples = liveTuples + deadTuples; nếu > 0 thì deadTupleRatioPct = Math.round((deadTuples / totalTuples) * 10000) / 100, ngược lại = 0.',
        'Bước 4 (Định cỡ Connection Pool trên mỗi Pod): Tính optimalClusterConnections = dbCpuCores * 2 + 2 và maxPoolPerPod = Math.max(2, Math.floor(optimalClusterConnections / appPods)).'
      ],
      hints: [
        'Công thức chuẩn của PostgreSQL Autovacuum là: baseThreshold (thường = 50) + scaleFactor * liveTuples.',
        'Khi tính deadTupleRatioPct, mẫu số là tổng toàn bộ các tuple trên trang Heap (liveTuples + deadTuples).'
      ],
      starterCode: `function planPostgresMaintenanceAndPool(liveTuples, deadTuples, scaleFactor, baseThreshold, dbCpuCores, appPods) {
  // Bước 1: Tính vacuumTriggerThreshold = Math.round(baseThreshold + scaleFactor * liveTuples)
  
  // Bước 2: Xác định shouldTriggerVacuum (deadTuples >= vacuumTriggerThreshold)
  
  // Bước 3: Tính deadTupleRatioPct (làm tròn 2 chữ số thập phân)
  
  // Bước 4: Tính maxPoolPerPod và trả về { vacuumTriggerThreshold, shouldTriggerVacuum, deadTupleRatioPct, maxPoolPerPod }
}`,
      solution: `function planPostgresMaintenanceAndPool(
  liveTuples,
  deadTuples,
  scaleFactor,
  baseThreshold,
  dbCpuCores,
  appPods
) {
  const vacuumTriggerThreshold = Math.round(
    baseThreshold + scaleFactor * liveTuples
  );
  const shouldTriggerVacuum = deadTuples >= vacuumTriggerThreshold;
  const totalTuples = liveTuples + deadTuples;
  const deadTupleRatioPct =
    totalTuples > 0
      ? Math.round((deadTuples / totalTuples) * 10000) / 100
      : 0;

  const optimalClusterConnections = dbCpuCores * 2 + 2;
  const maxPoolPerPod = Math.max(
    2,
    Math.floor(optimalClusterConnections / Math.max(1, appPods))
  );

  return {
    vacuumTriggerThreshold,
    shouldTriggerVacuum,
    deadTupleRatioPct,
    maxPoolPerPod,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Bảng 1,000,000 dòng đã tinh chỉnh scaleFactor = 0.02, có 25,000 dead tuples -> Kích hoạt Vacuum',
          input: [1000000, 25000, 0.02, 50, 8, 3],
          expected: {
            vacuumTriggerThreshold: 20050,
            shouldTriggerVacuum: true,
            deadTupleRatioPct: 2.44,
            maxPoolPerPod: 6
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Bảng 1,000,000 dòng để mặc định scaleFactor = 0.20, có 50,000 dead tuples -> Chưa đủ ngưỡng 200,050',
          input: [1000000, 50000, 0.2, 50, 16, 6],
          expected: {
            vacuumTriggerThreshold: 200050,
            shouldTriggerVacuum: false,
            deadTupleRatioPct: 4.76,
            maxPoolPerPod: 5
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Bảng nhỏ 1,000 dòng với 300 dead tuples và scaleFactor = 0.20 -> Kích hoạt Vacuum ngay',
          input: [1000, 300, 0.2, 50, 4, 2],
          expected: {
            vacuumTriggerThreshold: 250,
            shouldTriggerVacuum: true,
            deadTupleRatioPct: 23.08,
            maxPoolPerPod: 5
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Bảng mới tạo hoàn toàn rỗng (0 live, 0 dead)',
          input: [0, 0, 0.1, 50, 4, 10],
          expected: {
            vacuumTriggerThreshold: 50,
            shouldTriggerVacuum: false,
            deadTupleRatioPct: 0,
            maxPoolPerPod: 2
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Số deadTuples chạm đúng bằng biên vacuumTriggerThreshold (2050 === 2050)',
          input: [100000, 2050, 0.02, 50, 8, 2],
          expected: {
            vacuumTriggerThreshold: 2050,
            shouldTriggerVacuum: true,
            deadTupleRatioPct: 2.01,
            maxPoolPerPod: 9
          },
          hidden: true
        }
      ]
    },
    {
      id: 'c4-l1b-c3',
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Bộ Kiểm Toán Kế Hoạch Truy Vấn EXPLAIN (ANALYZE, BUFFERS) Chuẩn Production',
      description: 'Hiện thực hàm `evaluatePostgreSqlPlan(nodes, costThreshold)` để kiểm toán danh sách các nút thực thi (`nodes: Array<{ nodeType: string; relationName?: string; totalCost: number; actualRows: number; tempWrittenBlocks?: number }>`) trích xuất từ cây `EXPLAIN (ANALYZE, BUFFERS)`.\nRàng buộc Phòng thủ (Defensive Guards):\n1. Nếu `!Array.isArray(nodes)` hoặc `typeof costThreshold !== "number"` hoặc `costThreshold <= 0`, chủ động `throw new Error("INVALID_EXPLAIN_PLAN_INPUT")`.\n2. Nếu bất kỳ phần tử nào trong `nodes` có `totalCost < 0` hoặc `actualRows < 0`, chủ động `throw new Error("CORRUPTED_PLAN_NODE_METRICS")`.\nQuy tắc Phân tích:\n- Tìm `maxCost` là giá trị `totalCost` lớn nhất trong mảng (nếu mảng rỗng thì `maxCost = 0`).\n- Duyệt tuần tự qua từng `node` trong `nodes`:\n  + Nếu `node.nodeType === "Seq Scan"` và `node.actualRows >= 1000`: đặt `hasSeqScanOnLargeTable = true` và thêm `"WARNING_SEQ_SCAN: " + (node.relationName || "unknown")` vào mảng `warnings`.\n  + Nếu `node.totalCost > costThreshold`: thêm `"WARNING_HIGH_COST: " + node.totalCost` vào `warnings`.\n  + Nếu `(node.tempWrittenBlocks || 0) > 0`: đặt `hasDiskSpill = true` và thêm `"WARNING_TEMP_DISK_SPILL: " + node.tempWrittenBlocks` vào `warnings`.\nTrả về `{ hasSeqScanOnLargeTable, hasDiskSpill, maxCost, warnings }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra điều kiện biên đầu vào): Nếu !Array.isArray(nodes) || typeof costThreshold !== "number" || costThreshold <= 0, throw new Error("INVALID_EXPLAIN_PLAN_INPUT").',
        'Bước 2 (Khởi tạo biến tổng hợp và kiểm tra tính toàn vẹn của từng Node): Khởi tạo hasSeqScanOnLargeTable = false, hasDiskSpill = false, maxCost = 0, warnings = []. Trong vòng lặp, nếu node.totalCost < 0 || node.actualRows < 0 thì throw new Error("CORRUPTED_PLAN_NODE_METRICS").',
        'Bước 3 (Phát hiện Seq Scan bảng lớn, Chi phí cao và Tràn đĩa tạm): Cập nhật maxCost; kiểm tra tuần tự điều kiện Seq Scan (actualRows >= 1000), High Cost (totalCost > costThreshold) và Temp Disk Spill (tempWrittenBlocks > 0).',
        'Bước 4 (Trả về báo cáo chẩn đoán): Trả về đối tượng { hasSeqScanOnLargeTable, hasDiskSpill, maxCost, warnings }.'
      ],
      hints: [
        'Giữ đúng thứ tự kiểm tra 3 cảnh báo trong mỗi vòng lặp: (1) WARNING_SEQ_SCAN -> (2) WARNING_HIGH_COST -> (3) WARNING_TEMP_DISK_SPILL để mảng warnings khớp chính xác với bộ test.',
        'Khi mảng nodes hợp lệ nhưng rỗng ([]), hàm không ném lỗi mà trả về { hasSeqScanOnLargeTable: false, hasDiskSpill: false, maxCost: 0, warnings: [] }.'
      ],
      starterCode: `function evaluatePostgreSqlPlan(nodes, costThreshold) {
  // Bước 1: Kiểm tra tính hợp lệ của tham số đầu vào ("INVALID_EXPLAIN_PLAN_INPUT")
  
  // Bước 2: Duyệt từng node, kiểm tra số âm ("CORRUPTED_PLAN_NODE_METRICS") và cập nhật maxCost
  
  // Bước 3: Kiểm tra Seq Scan (>= 1000 rows), High Cost (> costThreshold) và Temp Disk Spill (> 0 blocks)
  
  // Bước 4: Trả về { hasSeqScanOnLargeTable, hasDiskSpill, maxCost, warnings }
}`,
      solution: `function evaluatePostgreSqlPlan(nodes, costThreshold) {
  if (
    !Array.isArray(nodes) ||
    typeof costThreshold !== 'number' ||
    Number.isNaN(costThreshold) ||
    costThreshold <= 0
  ) {
    throw new Error('INVALID_EXPLAIN_PLAN_INPUT');
  }

  let hasSeqScanOnLargeTable = false;
  let hasDiskSpill = false;
  let maxCost = 0;
  const warnings = [];

  for (const node of nodes) {
    if (
      !node ||
      typeof node.totalCost !== 'number' ||
      typeof node.actualRows !== 'number' ||
      node.totalCost < 0 ||
      node.actualRows < 0
    ) {
      throw new Error('CORRUPTED_PLAN_NODE_METRICS');
    }

    if (node.totalCost > maxCost) {
      maxCost = node.totalCost;
    }

    if (node.nodeType === 'Seq Scan' && node.actualRows >= 1000) {
      hasSeqScanOnLargeTable = true;
      warnings.push(\`WARNING_SEQ_SCAN: \${node.relationName || 'unknown'}\`);
    }

    if (node.totalCost > costThreshold) {
      warnings.push(\`WARNING_HIGH_COST: \${node.totalCost}\`);
    }

    if (typeof node.tempWrittenBlocks === 'number' && node.tempWrittenBlocks > 0) {
      hasDiskSpill = true;
      warnings.push(\`WARNING_TEMP_DISK_SPILL: \${node.tempWrittenBlocks}\`);
    }
  }

  return {
    hasSeqScanOnLargeTable,
    hasDiskSpill,
    maxCost,
    warnings,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Phát hiện đồng thời Seq Scan trên bảng lớn, Cost vượt ngưỡng và Tràn đĩa work_mem',
          input: [
            [
              { nodeType: 'Seq Scan', relationName: 'users', totalCost: 1500, actualRows: 5000 },
              { nodeType: 'Sort', totalCost: 1800, actualRows: 5000, tempWrittenBlocks: 320 }
            ],
            1000
          ],
          expected: {
            hasSeqScanOnLargeTable: true,
            hasDiskSpill: true,
            maxCost: 1800,
            warnings: [
              'WARNING_SEQ_SCAN: users',
              'WARNING_HIGH_COST: 1500',
              'WARNING_HIGH_COST: 1800',
              'WARNING_TEMP_DISK_SPILL: 320'
            ]
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Truy vấn tối ưu dùng Index Scan hoàn toàn trong RAM -> Không có cảnh báo',
          input: [
            [{ nodeType: 'Index Scan', relationName: 'orders', totalCost: 45, actualRows: 120, tempWrittenBlocks: 0 }],
            500
          ],
          expected: {
            hasSeqScanOnLargeTable: false,
            hasDiskSpill: false,
            maxCost: 45,
            warnings: []
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Ném lỗi INVALID_EXPLAIN_PLAN_INPUT khi costThreshold <= 0',
          input: [[{ nodeType: 'Index Scan', totalCost: 10, actualRows: 5 }], 0],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Ném lỗi CORRUPTED_PLAN_NODE_METRICS khi thông số totalCost bị âm',
          input: [[{ nodeType: 'Seq Scan', relationName: 'logs', totalCost: -50, actualRows: 200 }], 500],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Seq Scan trên bảng danh mục nhỏ (50 dòng < 1000) là hợp lệ, không báo lỗi Seq Scan',
          input: [[{ nodeType: 'Seq Scan', relationName: 'countries', totalCost: 12, actualRows: 50 }], 500],
          expected: {
            hasSeqScanOnLargeTable: false,
            hasDiskSpill: false,
            maxCost: 12,
            warnings: []
          },
          hidden: true
        }
      ]
    }
  ]
};
