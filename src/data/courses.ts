import { CURRICULUM } from './curriculum.ts';
import type {
  CourseDefinition,
  CareerPathDefinition,
  Lesson,
  Sprint,
  TeachingCheckpoint
} from './curriculum/types.ts';

const TYPESCRIPT_COURSE_SPRINT_1: Sprint = {
  sprintId: 101,
  sprintTitle: 'Chương 1: TypeScript Type System, Generics & Decorator Metadata',
  sprintDesc: 'Làm chủ hệ thống kiểu tĩnh, Structural Typing, Conditional Types và cơ chế Reflect Metadata phục vụ Dependency Injection.',
  lessons: [
    {
      id: 'ts-c1-l1',
      title: 'Bài 01: Structural Typing, Type Erasure & Bảo Toàn Runtime Contract',
      duration: '45 phút',
      tag: 'TypeScript Internals',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu rõ sự khác biệt giữa **Structural Type System** (TypeScript) và **Nominal Type System** (Java/C#).
> 2. Giải thích hiện tượng **Type Erasure** sau khi biên dịch sang JavaScript và tại sao dữ liệu từ I/O mạng bắt buộc phải có Runtime Schema Validation.
> 3. Thiết kế các hàm Type Guard (\`x is T\`) và Discriminated Unions để xử lý kết quả trả về an toàn tuyệt đối mà không dùng \`any\`.

---

# 1. BẢN CHẤT STRUCTURAL TYPING VÀ HIỆN TƯỢNG TYPE ERASURE

### 1.1 Structural Typing vs Nominal Typing
Trong TypeScript, hai kiểu dữ liệu được coi là tương thích nếu chúng có **cùng cấu trúc thuộc tính (Shape)** thay vì phải kế thừa cùng một lớp định danh:

\`\`\`diagram
┌──────────────────────────────────────────────────────────┐
│            TYPESCRIPT COMPILE-TIME PIPELINE              │
├──────────────────────────────────────────────────────────┤
│  Source (.ts)  ──►  AST & Type Checker  ──►  Type Erasure│
│  interface DTO       Kiểm tra hình thái       Xóa sạch   │
│  type Guard<T>       Structural Shape         type/iface │
└──────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────┐
│               NODE.JS V8 RUNTIME (.js)                   │
├──────────────────────────────────────────────────────────┤
│  Chỉ còn lại Object/Function thuần trên V8 Heap          │
│  Mọi JSON từ HTTP Request đều là dữ liệu chưa kiểm chứng │
└──────────────────────────────────────────────────────────┘
\`\`\`

### 1.2 Tại sao cấm tuyệt đối \`any\` và ép kiểu mù \`as T\` ở biên mạng?
Khi biên dịch từ \`.ts\` sang \`.js\`, toàn bộ \`interface\` và \`type\` bị xóa bỏ hoàn toàn (**Type Erasure**). Nếu kỹ sư viết \`const body = req.body as CreateOrderDto\`, trình biên dịch sẽ tin tưởng mù quáng, nhưng tại thời điểm chạy thực tế trên V8 Engine, \`req.body\` có thể thiếu trường hoặc sai kiểu dữ liệu dẫn tới lỗi \`TypeError\` hoặc lỗ hổng Injection.

| Cơ chế | Thời điểm kiểm tra | Chi phí CPU Runtime | Mức độ an toàn với dữ liệu ngoại vi (HTTP/Queue) |
| :--- | :--- | :--- | :--- |
| **Type Assertion (\`as T\`)** | Compile-time (chỉ đánh lừa compiler) | 0 ms | Rất nguy hiểm — không kiểm tra dữ liệu thật |
| **Type Guard (\`val is T\`)** | Compile-time + Runtime | ~0.01 ms | An toàn cao — thu hẹp kiểu dựa trên kiểm tra thật |
| **Discriminated Union** | Compile-time Exhaustiveness + Runtime tag | ~0.005 ms | Chuẩn kiến trúc Enterprise cho Result/Event |

# 2. THIẾT KẾ TYPE GUARD VÀ DISCRIMINATED UNION TRONG PRODUCTION

### 2.1 Xây dựng Custom Type Guard thu hẹp kiểu \`unknown\`
Thay vì nhận đầu vào kiểu \`any\`, mọi hàm nhận payload từ bên ngoài phải khai báo \`unknown\` và đi qua hàm kiểm định cấu trúc:

\`\`\`typescript
// File: src/common/guards/payload-guard.ts
export interface PaymentWebhookPayload {
  transactionId: string;
  amountCents: number;
  currency: 'VND' | 'USD';
}

export function isPaymentWebhookPayload(input: unknown): input is PaymentWebhookPayload {
  if (typeof input !== 'object' || input === null) return false;
  const candidate = input as Record<string, unknown>;
  return (
    typeof candidate.transactionId === 'string' &&
    candidate.transactionId.trim().length > 0 &&
    typeof candidate.amountCents === 'number' &&
    Number.isInteger(candidate.amountCents) &&
    candidate.amountCents > 0 &&
    (candidate.currency === 'VND' || candidate.currency === 'USD')
  );
}
\`\`\`
`,
      realCodeSnippet: `// File: src/core/result-monad.ts
export type ServiceResult<T> =
  | { ok: true; data: T; code: 'SUCCESS' }
  | { ok: false; error: string; code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' };

export function validateOrderPayload(raw: unknown): ServiceResult<{ orderId: string; total: number }> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Payload phải là một Object hợp lệ', code: 'VALIDATION_ERROR' };
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.orderId !== 'string' || !record.orderId.startsWith('ORD-')) {
    return { ok: false, error: 'Mã đơn hàng phải bắt đầu bằng ORD-', code: 'VALIDATION_ERROR' };
  }
  if (typeof record.total !== 'number' || !Number.isFinite(record.total) || record.total <= 0) {
    return { ok: false, error: 'Tổng tiền phải là số dương hợp lệ', code: 'VALIDATION_ERROR' };
  }
  return {
    ok: true,
    code: 'SUCCESS',
    data: { orderId: record.orderId, total: record.total }
  };
}`,
      quiz: [
        {
          id: 'ts-q1',
          question: 'Hiện tượng Type Erasure trong quá trình biên dịch TypeScript sang JavaScript mang ý nghĩa gì?',
          options: [
            'Trình biên dịch tự động sinh code kiểm tra kiểu dữ liệu ở mọi hàm tại Runtime',
            'Toàn bộ khai báo interface, type alias và generic bị xóa sạch khỏi file JavaScript đầu ra, không tồn tại ở Runtime',
            'TypeScript tự động đóng băng (Object.freeze) mọi đối tượng khi chạy trên V8',
            'TypeScript chuyển đổi mọi interface thành class C++ trong nhân Node.js'
          ],
          correctIndex: 1,
          explanation: 'Sau khi qua trình biên dịch tsc hoặc esbuild, các thông tin kiểu tĩnh bị xóa bỏ hoàn toàn (Type Erasure). Do đó cần Runtime Validation ở biên nhận dữ liệu.'
        },
        {
          id: 'ts-q2',
          question: 'Khi nhận dữ liệu JSON chưa rõ cấu trúc từ Webhook hoặc HTTP Request, kiểu dữ liệu nào nên được khai báo ở tham số đầu vào?',
          options: [
            'any để truy cập thuộc tính nhanh nhất',
            'Object viết hoa',
            'unknown kết hợp với hàm Type Guard hoặc Schema Validator để thu hẹp kiểu an toàn',
            'Function'
          ],
          correctIndex: 2,
          explanation: 'Kiểu unknown buộc lập trình viên phải thực hiện kiểm tra kiểu (Type Narrowing) trước khi thao tác trên thuộc tính, ngăn chặn hoàn toàn lỗi truy cập thuộc tính trên undefined/null.'
        }
      ],
      codeChallenge: {
        id: 'ts-c1-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Kiểm định Runtime Payload',
        title: 'Xây dựng bộ kiểm định Runtime cho Webhook Thanh Toán',
        description: 'Viết hàm verifyWebhookPayload(raw) kiểm tra dữ liệu đầu vào: phải là object có transactionId (string bắt đầu bằng "TX-"), amount (số nguyên dương > 0). Trả về { valid: true, normalizedId, amount } hoặc { valid: false, reason }.',
        starterCode: `function verifyWebhookPayload(raw) {
  // Kiểm tra kiểu dữ liệu tại Runtime và chuẩn hóa kết quả
  if (!raw || typeof raw !== 'object') {
    return { valid: false, reason: 'INVALID_OBJECT' };
  }
  const txId = typeof raw.transactionId === 'string' ? raw.transactionId.trim() : '';
  if (!txId.startsWith('TX-')) {
    return { valid: false, reason: 'INVALID_TX_ID' };
  }
  if (typeof raw.amount !== 'number' || !Number.isInteger(raw.amount) || raw.amount <= 0) {
    return { valid: false, reason: 'INVALID_AMOUNT' };
  }
  return {
    valid: true,
    normalizedId: txId,
    amount: raw.amount
  };
}`,
        testCases: [
          {
            name: 'Hợp lệ với payload chuẩn',
            input: [{ transactionId: '  TX-9001 ', amount: 500000 }],
            expected: { valid: true, normalizedId: 'TX-9001', amount: 500000 }
          },
          {
            name: 'Từ chối khi sai tiền tố TX-',
            input: [{ transactionId: 'ORD-100', amount: 500000 }],
            expected: { valid: false, reason: 'INVALID_TX_ID' }
          },
          {
            name: 'Từ chối khi amount <= 0 hoặc không phải số nguyên',
            input: [{ transactionId: 'TX-9002', amount: -50 }],
            expected: { valid: false, reason: 'INVALID_AMOUNT' }
          }
        ]
      }
    },
    {
      id: 'ts-c1-l2',
      title: 'Bài 02: Generics Chuyên Sâu, Mapped Types & Decorator Metadata dưới Đáy IoC',
      duration: '50 phút',
      tag: 'Compiler & Reflection',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Nắm vững cơ chế hoạt động của **Generics Constraints** (\`T extends keyof U\`) và **Mapped Types** (\`Partial\`, \`Pick\`, \`Omit\`, \`Readonly\`).
> 2. Hiểu rõ cách TypeScript phát sinh siêu dữ liệu kiểu (**\`emitDecoratorMetadata\`**) thông qua \`Reflect.metadata\` để IoC Container của NestJS tự động khởi tạo Dependency.

---

# 1. CƠ CHẾ HOẠT ĐỘNG CỦA DECORATOR VÀ REFLECT METADATA

### 1.1 Bản chất của Decorator ở tầng JavaScript Runtime
Một Class hoặc Method Decorator thực chất là một hàm bậc cao (Higher-Order Function) được gọi ngay tại thời điểm nạp file (Module Evaluation Time) để gắn Metadata lên \`prototype\` hoặc \`constructor\` của Class:

\`\`\`diagram
┌───────────────────────────────────────────────────────────┐
│        @Injectable() & emitDecoratorMetadata              │
├───────────────────────────────────────────────────────────┤
│  class OrderService {                                     │
│    constructor(private repo: OrderRepo) {}                │
│  }                                                        │
│         │                                                 │
│         ▼  Biên dịch với emitDecoratorMetadata: true      │
│  Reflect.metadata("design:paramtypes", [OrderRepo])       │
│         │                                                 │
│         ▼  Lúc khởi chạy ứng dụng (Bootstrap)             │
│  IoC Container đọc "design:paramtypes" ──► new OrderRepo()│
└───────────────────────────────────────────────────────────┘
\`\`\`

### 1.2 Tại sao Interface không thể dùng làm Token tiêm phụ thuộc tự động?
Vì \`interface\` bị xóa bỏ ở giai đoạn Type Erasure, nên trong mảng \`design:paramtypes\`, TypeScript chỉ có thể ghi nhận \`Object\` thay vì kiểu cụ thể. Do đó, khi dùng Interface làm hợp đồng giữa các tầng, ta phải cung cấp **Injection Token tường minh** (Symbol hoặc chuỗi hằng số).
`,
      realCodeSnippet: `// File: src/core/di/metadata-registry.ts
const METADATA_STORE = new WeakMap<object, Map<string, unknown>>();

export function defineClassMetadata(key: string, value: unknown) {
  return function <T extends new (...args: never[]) => unknown>(target: T): T {
    let bag = METADATA_STORE.get(target);
    if (!bag) {
      bag = new Map<string, unknown>();
      METADATA_STORE.set(target, bag);
    }
    bag.set(key, value);
    return target;
  };
}

export function getClassMetadata<V = unknown>(target: object, key: string): V | undefined {
  return METADATA_STORE.get(target)?.get(key) as V | undefined;
}`,
      quiz: [
        {
          id: 'ts-q2-1',
          question: 'Khi bật cờ emitDecoratorMetadata trong tsconfig.json, khóa metadata nào được trình biên dịch phát sinh để lưu danh sách kiểu tham số của constructor?',
          options: [
            'design:returntype',
            'design:paramtypes',
            'runtime:interfaces',
            'v8:constructor:args'
          ],
          correctIndex: 1,
          explanation: 'TypeScript phát sinh siêu dữ liệu design:paramtypes chứa mảng các Constructor Function tương ứng với các tham số trong hàm khởi tạo.'
        }
      ],
      codeChallenge: {
        id: 'ts-c1-l2-ch1',
        level: 'intermediate',
        levelLabel: 'Cấp độ 1: Bộ lọc thuộc tính an toàn (Safe Pick)',
        title: 'Cài đặt hàm pickDefinedFields lọc bỏ trường nhạy cảm và undefined',
        description: 'Viết hàm pickDefinedFields(record, allowedKeys) trả về object mới chỉ chứa các khóa nằm trong mảng allowedKeys và có giá trị khác undefined.',
        starterCode: `function pickDefinedFields(record, allowedKeys) {
  const output = {};
  if (!record || typeof record !== 'object' || !Array.isArray(allowedKeys)) {
    return output;
  }
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && typeof record[key] !== 'undefined') {
      output[key] = record[key];
    }
  }
  return output;
}`,
        testCases: [
          {
            name: 'Chỉ giữ lại các trường cho phép và loại bỏ passwordHash',
            input: [{ id: 'u1', email: 'a@b.c', passwordHash: 'secret', role: undefined }, ['id', 'email', 'role']],
            expected: { id: 'u1', email: 'a@b.c' }
          }
        ]
      }
    }
  ]
};

const SQL_COURSE_SPRINT_1: Sprint = {
  sprintId: 201,
  sprintTitle: 'Chương 1: Kiến Trúc Lưu Trữ B-Tree, MVCC & Tối Ưu Hóa Truy Vấn PostgreSQL',
  sprintDesc: 'Hiểu sâu cách dữ liệu được lưu trên trang nhớ 8KB (Heap Page), cơ chế đánh chỉ mục B-Tree và phòng chống Deadlock dưới tải cao.',
  lessons: [
    {
      id: 'sql-c1-l1',
      title: 'Bài 01: Cấu Trúc Trang Nhớ 8KB, B-Tree Index & Composite Index Leftmost Prefix',
      duration: '55 phút',
      tag: 'Database Internals',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu rõ cách PostgreSQL lưu trữ bản ghi trong các trang nhớ 8KB (**Heap Pages**) và chi phí của **Sequential Scan** so với **Index Scan**.
> 2. Nắm vững quy tắc **Leftmost Prefix (Tiền tố bên trái)** khi thiết kế Composite Index nhiều cột.
> 3. Phân biệt **Index Scan**, **Index-Only Scan** và **Bitmap Heap Scan**.

---

# 1. KIẾN TRÚC B-TREE INDEX VÀ QUY TẮC TIỀN TỐ TRÁI (LEFTMOST PREFIX)

### 1.1 Tại sao truy vấn thiếu Index lại gây sập CPU và Disk I/O?
Khi không có chỉ mục phù hợp, bộ thực thi truy vấn phải đọc tuần tự toàn bộ các trang 8KB từ đĩa vào vùng đệm \`Shared Buffers\` (**Sequential Scan**), độ phức tạp là $O(N)$. Với cấu trúc cây cân bằng **B-Tree**, số lần đọc trang giảm xuống $O(\\log_B N)$ — chỉ mất tối đa 3 đến 4 bước nhảy cho bảng 100 triệu dòng.

\`\`\`diagram
┌──────────────────────────────────────────────────────────┐
│        COMPOSITE B-TREE INDEX: (clinic_id, status)       │
├──────────────────────────────────────────────────────────┤
│                     [Root Node]                          │
│                   /             \\                        │
│     (clinic_A, PAID)           (clinic_B, PENDING)       │
│            │                             │               │
│            ▼                             ▼               │
│   Leaf Page (Sorted by clinic_id THEN status)            │
└──────────────────────────────────────────────────────────┘
\`\`\`

### 1.2 Quy tắc sắp xếp thứ tự cột trong Composite Index
Một chỉ mục kép trên \`(clinic_id, status, created_at)\` được sắp xếp ưu tiên theo \`clinic_id\` trước, sau đó những bản ghi cùng \`clinic_id\` mới được sắp xếp theo \`status\`:

| Câu truy vấn (WHERE / ORDER BY) | Có tận dụng được Index \`(clinic_id, status, created_at)\`? | Giải thích cơ chế |
| :--- | :--- | :--- |
| \`WHERE clinic_id = 'C1' AND status = 'PAID'\` | **Có (Tối ưu 100%)** | Khớp đúng thứ tự tiền tố từ trái sang phải |
| \`WHERE status = 'PAID'\` | **Không (Rơi về Seq Scan)** | Bỏ qua cột dẫn đầu \`clinic_id\` nên cây B-Tree không thể định vị nhánh |
| \`WHERE clinic_id = 'C1' ORDER BY created_at DESC\` | **Một phần (Phải Sort thêm)** | Lọc được \`clinic_id\`, nhưng bị đứt quãng cột \`status\` nên phải tốn bước Sort trên RAM |
`,
      realCodeSnippet: `// File: src/database/query-plan-analyzer.ts
export interface IndexDefinition {
  name: string;
  columns: string[];
}

export function evaluateIndexEfficiency(
  index: IndexDefinition,
  equalityFilterColumns: string[],
  sortColumn?: string
): { scanType: 'INDEX_OPTIMAL' | 'INDEX_PARTIAL_SORT' | 'SEQ_SCAN_FALLBACK'; matchedColumns: string[] } {
  const matched: string[] = [];
  for (const col of index.columns) {
    if (equalityFilterColumns.includes(col)) {
      matched.push(col);
    } else {
      break;
    }
  }
  if (matched.length === 0) {
    return { scanType: 'SEQ_SCAN_FALLBACK', matchedColumns: [] };
  }
  const nextColAfterPrefix = index.columns[matched.length];
  if (!sortColumn || sortColumn === nextColAfterPrefix || matched.includes(sortColumn)) {
    return { scanType: 'INDEX_OPTIMAL', matchedColumns: matched };
  }
  return { scanType: 'INDEX_PARTIAL_SORT', matchedColumns: matched };
}`,
      quiz: [
        {
          id: 'sql-q1',
          question: 'Với bảng invoices có Composite Index trên (clinic_id, status, created_at), truy vấn nào dưới đây KHÔNG tận dụng được tiền tố của Index này?',
          options: [
            "WHERE clinic_id = 'c1' AND status = 'PAID'",
            "WHERE clinic_id = 'c1'",
            "WHERE status = 'PAID' AND created_at > '2026-01-01'",
            "WHERE clinic_id = 'c1' AND status = 'PAID' ORDER BY created_at DESC"
          ],
          correctIndex: 2,
          explanation: 'Do truy vấn thiếu điều kiện lọc trên cột đầu tiên (clinic_id), cây B-Tree không thể thu hẹp phạm vi tìm kiếm từ nút gốc.'
        }
      ],
      codeChallenge: {
        id: 'sql-c1-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Đánh giá độ phủ Leftmost Prefix',
        title: 'Kiểm tra số cột khớp tiền tố trái của Composite Index',
        description: 'Viết hàm countPrefixMatchedColumns(indexColumns, filterColumns) trả về số lượng cột liên tiếp tính từ đầu mảng indexColumns xuất hiện trong filterColumns.',
        starterCode: `function countPrefixMatchedColumns(indexColumns, filterColumns) {
  if (!Array.isArray(indexColumns) || !Array.isArray(filterColumns)) return 0;
  const filterSet = new Set(filterColumns);
  let matched = 0;
  for (const col of indexColumns) {
    if (filterSet.has(col)) {
      matched++;
    } else {
      break;
    }
  }
  return matched;
}`,
        testCases: [
          {
            name: 'Khớp cả 2 cột đầu tiên',
            input: [['clinic_id', 'status', 'created_at'], ['status', 'clinic_id']],
            expected: 2
          },
          {
            name: 'Đứt quãng cột đầu tiên -> trả về 0',
            input: [['clinic_id', 'status', 'created_at'], ['status', 'created_at']],
            expected: 0
          }
        ]
      }
    }
  ]
};

const REACT_COURSE_SPRINT_1: Sprint = {
  sprintId: 301,
  sprintTitle: 'Chương 1: Kiến Trúc React 19, Reconciliation & Quản Lý State Hiệu Năng Cao',
  sprintDesc: 'Hiểu sâu Fiber Tree, nguyên lý bất biến (Immutability), đồng bộ Server State và tối ưu hóa chu kỳ Render.',
  lessons: [
    {
      id: 'react-c1-l1',
      title: 'Bài 01: Fiber Reconciliation, Immutability & Tránh Stale Closure Trong Hooks',
      duration: '45 phút',
      tag: 'Frontend Architecture',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu rõ cách bộ điều phối **React Fiber** so sánh tham chiếu bộ nhớ (\`Object.is\`) để quyết định có cần vẽ lại nhánh giao diện hay không.
> 2. Giải thích nguyên nhân gốc rễ gây lỗi **Stale Closure (Bao đóng cũ)** trong \`useEffect\` / \`useCallback\` và cách xử lý bằng Functional State Update.

---

# 1. CƠ CHẾ SO SÁNH THAM CHIẾU (\`Object.is\`) VÀ TÍNH BẤT BIẾN (IMMUTABILITY)

### 1.1 Tại sao đột biến trực tiếp (\`state.push()\`) không kích hoạt Re-render?
Để đạt tốc độ khung hình 60fps (16.6ms/frame), React không so sánh sâu từng thuộc tính của Object ($O(N)$), mà chỉ so sánh **địa chỉ con trỏ tham chiếu trên Heap** bằng \`Object.is(prevState, nextState)\` với chi phí $O(1)$.

\`\`\`diagram
┌───────────────────────────────────────────────────────────┐
│          IMMUTABLE UPDATE vs DIRECT MUTATION              │
├───────────────────────────────────────────────────────────┤
│  Direct Mutation:   cart.items.push(newItem)              │
│  Object.is(prev, next) === true  ──► BỎ QUA RENDER!       │
│                                                           │
│  Immutable Update:  setCart(prev => ({ ...prev, ... }))   │
│  Object.is(prev, next) === false ──► CẬP NHẬT FIBER TREE! │
└───────────────────────────────────────────────────────────┘
\`\`\`
`,
      realCodeSnippet: `// File: src/state/optimistic-reducer.ts
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
}

export function toggleTodoImmutable(list: readonly TodoItem[], targetId: string): TodoItem[] {
  return list.map((item) =>
    item.id === targetId ? { ...item, completed: !item.completed } : item
  );
}`,
      quiz: [
        {
          id: 'react-q1',
          question: 'Vì sao React sử dụng Object.is (so sánh tham chiếu nông) thay vì Deep Equality khi kiểm tra thay đổi của State?',
          options: [
            'Vì JavaScript không hỗ trợ đệ quy qua các thuộc tính của Object',
            'Để đảm bảo độ phức tạp kiểm tra thay đổi là O(1), giữ tốc độ phản hồi giao diện mượt mà ở 60fps',
            'Vì trình duyệt tự động xóa các thuộc tính con của Object sau mỗi lần render',
            'Để buộc lập trình viên phải dùng biến toàn cục window'
          ],
          correctIndex: 1,
          explanation: 'So sánh tham chiếu con trỏ bằng Object.is tốn thời gian hằng số O(1), giúp Fiber đi qua cây component cực nhanh mà không bị nghẽn Main Thread.'
        }
      ],
      codeChallenge: {
        id: 'react-c1-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Cập nhật State Bất Biến (Immutable State)',
        title: 'Viết hàm cập nhật số lượng sản phẩm trong giỏ hàng mà không làm đột biến mảng gốc',
        description: 'Viết hàm updateCartQuantity(items, sku, delta) trả về mảng mới đã cộng thêm delta vào quantity của sản phẩm có mã sku. Nếu quantity sau khi cộng <= 0 thì loại bỏ sản phẩm đó khỏi mảng.',
        starterCode: `function updateCartQuantity(items, sku, delta) {
  if (!Array.isArray(items)) return [];
  const next = [];
  for (const item of items) {
    if (item.sku === sku) {
      const updatedQty = item.quantity + delta;
      if (updatedQty > 0) {
        next.push({ ...item, quantity: updatedQty });
      }
    } else {
      next.push({ ...item });
    }
  }
  return next;
}`,
        testCases: [
          {
            name: 'Tăng số lượng sản phẩm đúng chuẩn bất biến',
            input: [[{ sku: 'BOOK-1', quantity: 2 }, { sku: 'PEN-2', quantity: 1 }], 'BOOK-1', 3],
            expected: [{ sku: 'BOOK-1', quantity: 5 }, { sku: 'PEN-2', quantity: 1 }]
          },
          {
            name: 'Loại bỏ sản phẩm khi số lượng về 0',
            input: [[{ sku: 'BOOK-1', quantity: 1 }], 'BOOK-1', -1],
            expected: []
          }
        ]
      }
    }
  ]
};

const DOCKER_COURSE_SPRINT_1: Sprint = {
  sprintId: 401,
  sprintTitle: 'Chương 1: Containerization, Linux Cgroups & Kiến Trúc Microservices Chịu Lỗi',
  sprintDesc: 'Làm chủ Docker Multi-stage Build, giới hạn tài nguyên Cgroups/Namespaces, Outbox Pattern và Circuit Breaker.',
  lessons: [
    {
      id: 'docker-c1-l1',
      title: 'Bài 01: Bản Chất Linux Namespaces, Cgroups & Phòng Chống OOMKill Trong Container',
      duration: '50 phút',
      tag: 'DevOps & Cloud Native',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu rõ Container không phải là máy ảo (VM) mà là tiến trình Linux thông thường được cô lập bởi **Namespaces** (tầm nhìn) và **Control Groups - cgroups** (ngân sách phần cứng).
> 2. Tính toán chính xác thông số \`--max-old-space-size\` cho Node.js tương ứng với giới hạn \`memory.limit_in_bytes\` của Docker/Kubernetes để tránh lỗi \`SIGKILL (Exit Code 137)\`.

---

# 1. CƠ CHẾ CGROUPS MEMORY LIMIT VÀ QUY TẮC 75% V8 HEAP

### 1.1 Tại sao Container Node.js hay bị chết đột ngột với Exit Code 137?
Tổng bộ nhớ vật lý của một tiến trình Node.js (\`RSS\`) = \`V8 Heap\` + \`Stack\` + \`C++ External Buffers\`. Nếu kỹ sư cấu hình giới hạn Container là \`512MB\` nhưng để mặc định V8 Heap tràn quá \`450MB\`, cộng thêm \`80MB\` Buffer xử lý file sẽ vượt ngưỡng \`512MB\` của \`cgroups\`. Ngay lập tức **Linux Kernel OOM Killer** sẽ bắn tín hiệu \`SIGKILL (9)\` làm sập tiến trình mà không kịp chạy \`onApplicationShutdown\`.

\`\`\`diagram
┌───────────────────────────────────────────────────────────┐
│        CONTAINER MEMORY BUDGET (cgroups = 512 MB)         │
├───────────────────────────────────────────────────────────┤
│  [ V8 Old + New Space: Max 384 MB (75%) ]                 │
│  [ C++ Buffers / Prisma Engine / Code: 128 MB (25%) ]     │
└───────────────────────────────────────────────────────────┘
\`\`\`
`,
      realCodeSnippet: `// File: src/infra/container-budget.ts
export interface ContainerBudgetPlan {
  containerLimitMb: number;
  recommendedMaxOldSpaceMb: number;
  headroomMb: number;
  nodeOptionsFlag: string;
}

export function calculateNodeContainerBudget(containerLimitMb: number): ContainerBudgetPlan {
  const safeLimit = Math.max(128, Math.floor(containerLimitMb));
  const recommendedMaxOldSpaceMb = Math.floor(safeLimit * 0.75);
  const headroomMb = safeLimit - recommendedMaxOldSpaceMb;
  return {
    containerLimitMb: safeLimit,
    recommendedMaxOldSpaceMb,
    headroomMb,
    nodeOptionsFlag: \`--max-old-space-size=\${recommendedMaxOldSpaceMb}\`
  };
}`,
      quiz: [
        {
          id: 'docker-q1',
          question: 'Khi một Container trên Kubernetes bị dừng đột ngột với mã thoát Exit Code 137, nguyên nhân gốc rễ ở tầng Hệ điều hành là gì?',
          options: [
            'Ứng dụng tự gọi hàm process.exit(0)',
            'Tiến trình vượt quá giới hạn RAM của cgroups nên bị Linux Kernel OOM Killer gửi tín hiệu SIGKILL (128 + 9 = 137)',
            'Lỗi cú pháp trong Dockerfile',
            'Cổng mạng HTTP bị trùng lặp'
          ],
          correctIndex: 1,
          explanation: 'Exit Code 137 tương ứng với 128 + 9 (SIGKILL), thường do nhân Linux kích hoạt OOM Killer khi tiến trình vượt ngưỡng bộ nhớ cgroups.'
        }
      ],
      codeChallenge: {
        id: 'docker-c1-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Tính toán Ngân sách RAM Container',
        title: 'Tính toán --max-old-space-size theo chuẩn an toàn 75% Container Memory',
        description: 'Viết hàm computeV8HeapBudget(containerLimitMb) trả về { maxOldSpaceMb, headroomMb, isSafeForProduction } với maxOldSpaceMb = Math.floor(containerLimitMb * 0.75), headroomMb là phần còn lại, và isSafeForProduction = true nếu containerLimitMb >= 256.',
        starterCode: `function computeV8HeapBudget(containerLimitMb) {
  const maxOldSpaceMb = Math.floor(containerLimitMb * 0.75);
  const headroomMb = containerLimitMb - maxOldSpaceMb;
  return {
    maxOldSpaceMb,
    headroomMb,
    isSafeForProduction: containerLimitMb >= 256
  };
}`,
        testCases: [
          {
            name: 'Tính đúng ngân sách cho Container 512MB',
            input: [512],
            expected: { maxOldSpaceMb: 384, headroomMb: 128, isSafeForProduction: true }
          },
          {
            name: 'Cảnh báo không an toàn khi Container chỉ có 128MB',
            input: [128],
            expected: { maxOldSpaceMb: 96, headroomMb: 32, isSafeForProduction: false }
          }
        ]
      }
    }
  ]
};

const TYPESCRIPT_COURSE_SPRINT_2: Sprint = {
  sprintId: 102,
  sprintTitle: 'Chương 2: Asynchronous Type Contracts, Result Pattern & Compiler Diagnostics',
  sprintDesc: 'Thiết kế luồng bất đồng bộ an toàn kiểu với Promise<Result<T, E>>, Exhaustive Switch và tối ưu hóa cấu hình tsconfig.',
  lessons: [
    {
      id: 'ts-c2-l1',
      title: 'Bài 03: Exhaustive Pattern Matching với kiểu never & Thiết kế Result<T, E>',
      duration: '45 phút',
      tag: 'Type-Safe Control Flow',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Sử dụng kiểu đáy (**Bottom Type \`never\`**) để ép trình biên dịch báo lỗi ngay lập tức khi thiếu nhánh xử lý trong \`switch-case\`.
> 2. Thay thế cơ chế \`throw new Error()\` mất kiểm soát bằng mẫu thiết kế **Result Pattern (\`Result<T, E>\`)** tường minh.

---

# 1. KIỂM TRA Vét CẠN (EXHAUSTIVENESS CHECKING) VỚI KIỂU \`never\`

Khi hệ thống mở rộng thêm trạng thái mới trong Union Type (ví dụ thêm trạng thái \`REFUNDED\` vào \`PaymentStatus\`), hàm \`assertNever(x: never)\` ở nhánh \`default\` sẽ buộc trình biên dịch TypeScript báo lỗi tại mọi nơi chưa xử lý trạng thái mới.
`,
      realCodeSnippet: `// File: src/common/types/exhaustive.ts
export type OrderStatus = 'CREATED' | 'PAID' | 'SHIPPED';

export function assertUnreachable(value: never): never {
  throw new Error(\`Trạng thái chưa được xử lý: \${JSON.stringify(value)}\`);
}

export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'CREATED':
      return 'Mới khởi tạo';
    case 'PAID':
      return 'Đã thanh toán';
    case 'SHIPPED':
      return 'Đang vận chuyển';
    default:
      return assertUnreachable(status);
  }
}`,
      quiz: [
        {
          id: 'ts-c2-q1',
          question: 'Tác dụng chính của việc gán biến vào kiểu never trong nhánh default của câu lệnh switch là gì?',
          options: [
            'Để tăng tốc độ vòng lặp for trong V8',
            'Để trình biên dịch báo lỗi ngay tại Compile-time nếu có một thành viên của Union Type chưa được xử lý ở các nhánh case phía trên',
            'Để tự động bắt ngoại lệ mạng',
            'Để chuyển đổi chuỗi sang số nguyên'
          ],
          correctIndex: 1,
          explanation: 'Khi mọi thành viên của Union đã được xử lý, kiểu còn lại ở default thu hẹp về never. Nếu sót một trường hợp, kiểu đó không thể gán cho never và trình biên dịch sẽ báo lỗi.'
        }
      ],
      codeChallenge: {
        id: 'ts-c2-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Ánh xạ trạng thái thanh toán toàn vẹn',
        title: 'Viết hàm phân loại trạng thái giao dịch',
        description: 'Viết hàm mapPaymentState(state) trả về mã số: PENDING -> 1, COMPLETED -> 2, FAILED -> 3. Nếu truyền trạng thái khác trả về -1.',
        starterCode: `function mapPaymentState(state) {
  switch (state) {
    case 'PENDING':
      return 1;
    case 'COMPLETED':
      return 2;
    case 'FAILED':
      return 3;
    default:
      return -1;
  }
}`,
        testCases: [
          { name: 'Trạng thái COMPLETED trả về 2', input: ['COMPLETED'], expected: 2 },
          { name: 'Trạng thái lạ trả về -1', input: ['UNKNOWN'], expected: -1 }
        ]
      }
    }
  ]
};

const SQL_COURSE_SPRINT_2: Sprint = {
  sprintId: 202,
  sprintTitle: 'Chương 2: MVCC, Isolation Levels & Xử Lý Tranh Chấp Khóa (Locking)',
  sprintDesc: 'Hiểu rõ cơ chế Multi-Version Concurrency Control, chống Lost Update và giải quyết Deadlock trong giao dịch tài chính.',
  lessons: [
    {
      id: 'sql-c2-l1',
      title: 'Bài 02: Cơ Chế MVCC (xmin/xmax), Isolation Levels & Pessimistic Locking',
      duration: '50 phút',
      tag: 'Transactions & Locking',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu cách PostgreSQL dùng đa phiên bản (**MVCC** qua \`xmin\`, \`xmax\`) để đọc không khóa ghi và ghi không khóa đọc.
> 2. Ngăn chặn lỗi **Lost Update** khi trừ số dư ví hoặc tồn kho bằng \`SELECT ... FOR UPDATE\` hoặc Atomic Update.

---

# 1. PHÒNG CHỐNG LOST UPDATE DƯỚI TẢI ĐỒNG THỜI CAO

Khi hai giao dịch cùng đọc số dư \`balance = 100\` rồi trừ \`80\`, nếu chỉ dùng mức cô lập mặc định \`READ COMMITTED\` mà không khóa dòng hoặc kiểm tra điều kiện nguyên tử, cả hai giao dịch đều có thể thành công gây âm quỹ.
`,
      realCodeSnippet: `// File: src/wallet/atomic-deduct.sql.ts
export function buildAtomicDeductSql(walletId: string, amount: number): {
  sql: string;
  params: [number, string, number];
} {
  return {
    sql: 'UPDATE wallets SET balance = balance - $1, version = version + 1 WHERE id = $2 AND balance >= $3 RETURNING id, balance, version',
    params: [amount, walletId, amount]
  };
}`,
      quiz: [
        {
          id: 'sql-c2-q1',
          question: 'Cơ chế nào giúp câu lệnh UPDATE trừ tiền tránh được lỗi trừ âm số dư khi có nhiều request chạy song song trên mức cô lập READ COMMITTED?',
          options: [
            'Đọc số dư ra biến JavaScript rồi dùng setTimeout trước khi UPDATE',
            'Đặt điều kiện kiểm tra trực tiếp trong mệnh đề WHERE của câu lệnh UPDATE nguyên tử (WHERE id = $1 AND balance >= $2)',
            'Tắt hoàn toàn cơ chế WAL của PostgreSQL',
            'Chỉ kiểm tra số dư ở phía giao diện React'
          ],
          correctIndex: 1,
          explanation: 'Câu lệnh UPDATE kèm điều kiện WHERE balance >= amount buộc PostgreSQL khóa dòng và đánh giá lại điều kiện trên bản ghi mới nhất sau khi khóa.'
        }
      ],
      codeChallenge: {
        id: 'sql-c2-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Sắp xếp thứ tự khóa chống Deadlock',
        title: 'Chuẩn hóa thứ tự khóa tài khoản khi chuyển tiền hai chiều',
        description: 'Viết hàm getOrderedLockIds(fromAccountId, toAccountId) trả về mảng 2 ID đã được sắp xếp theo thứ tự từ điển tăng dần để mọi giao dịch luôn xin khóa theo cùng một chiều, triệt tiêu vòng lặp Deadlock.',
        starterCode: `function getOrderedLockIds(fromAccountId, toAccountId) {
  return [String(fromAccountId), String(toAccountId)].sort((a, b) => a.localeCompare(b));
}`,
        testCases: [
          {
            name: 'Luôn sắp xếp thứ tự khóa nhất quán bất kể chiều chuyển tiền',
            input: ['ACC-900', 'ACC-100'],
            expected: ['ACC-100', 'ACC-900']
          }
        ]
      }
    }
  ]
};

const REACT_COURSE_SPRINT_2: Sprint = {
  sprintId: 302,
  sprintTitle: 'Chương 2: Đồng Bộ Bất Đồng Bộ, AbortController & Tối Ưu Hóa Web Vitals',
  sprintDesc: 'Xử lý triệt để Race Condition khi tìm kiếm/chuyển trang và tối ưu hóa thời gian phản hồi tương tác (INP).',
  lessons: [
    {
      id: 'react-c2-l1',
      title: 'Bài 02: Phòng Chống Race Condition Trong Fetch Effect & Quản Lý Request Lifecycle',
      duration: '45 phút',
      tag: 'Async UI Patterns',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Giải thích hiện tượng **Out-of-Order Response (Phản hồi mạng về lệch thứ tự)** khi người dùng chuyển đổi bộ lọc hoặc tab liên tục.
> 2. Sử dụng cờ \`cancelled\` hoặc \`AbortController\` trong hàm dọn dẹp (\`cleanup\`) của \`useEffect\` để đảm bảo dữ liệu cũ không bao giờ ghi đè lên dữ liệu mới.
`,
      realCodeSnippet: `// File: src/hooks/useSafeResource.ts
export function createRequestGuard() {
  let latestRequestId = 0;
  return {
    nextRequestId(): number {
      latestRequestId += 1;
      return latestRequestId;
    },
    isLatest(id: number): boolean {
      return id === latestRequestId;
    }
  };
}`,
      quiz: [
        {
          id: 'react-c2-q1',
          question: 'Khi người dùng chuyển nhanh từ bài học A sang bài học B nhưng request mạng của bài A phản hồi chậm hơn bài B, giải pháp chuẩn trong useEffect là gì?',
          options: [
            'Không làm gì cả vì trình duyệt tự xóa response cũ',
            'Sử dụng hàm cleanup của useEffect để đánh dấu cancelled = true hoặc gọi controller.abort() cho request của bài A',
            'Tắt hoàn toàn bộ nhớ đệm HTTP',
            'Gọi window.location.reload() mỗi lần bấm chuột'
          ],
          correctIndex: 1,
          explanation: 'Hàm cleanup chạy ngay khi dependency thay đổi, giúp hủy hoặc bỏ qua kết quả trả về muộn của lần gọi trước.'
        }
      ],
      codeChallenge: {
        id: 'react-c2-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Bộ lọc phản hồi mạng theo Request ID mới nhất',
        title: 'Chỉ chấp nhận dữ liệu từ Request ID mới nhất',
        description: 'Viết hàm pickLatestResponse(responses, latestId) tìm và trả về phần tử trong mảng responses có requestId === latestId, nếu không có trả về null.',
        starterCode: `function pickLatestResponse(responses, latestId) {
  if (!Array.isArray(responses)) return null;
  return responses.find((item) => item && item.requestId === latestId) || null;
}`,
        testCases: [
          {
            name: 'Chọn đúng gói tin của request mới nhất',
            input: [[{ requestId: 1, data: 'old' }, { requestId: 2, data: 'fresh' }], 2],
            expected: { requestId: 2, data: 'fresh' }
          }
        ]
      }
    }
  ]
};

const DOCKER_COURSE_SPRINT_2: Sprint = {
  sprintId: 402,
  sprintTitle: 'Chương 2: Transactional Outbox, Idempotency & Graceful Shutdown',
  sprintDesc: 'Đảm bảo không mất thông điệp giữa Database và Message Broker, cùng quy trình dừng dịch vụ không rớt kết nối.',
  lessons: [
    {
      id: 'docker-c2-l1',
      title: 'Bài 02: Mẫu Thiết Kế Transactional Outbox & Xử Lý Tín Hiệu SIGTERM',
      duration: '50 phút',
      tag: 'Distributed Reliability',
      theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> 1. Hiểu bài toán **Dual-Write Problem** khi vừa ghi vào PostgreSQL vừa bắn sự kiện sang RabbitMQ/Kafka.
> 2. Triển khai bảng \`outbox_events\` trong cùng một giao dịch ACID với dữ liệu nghiệp vụ để đảm bảo tính nhất quán tuyệt đối.
`,
      realCodeSnippet: `// File: src/messaging/outbox-dispatcher.ts
export interface OutboxRecord {
  id: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  retryCount: number;
}

export function selectPublishableBatch(records: OutboxRecord[], maxRetries = 5): OutboxRecord[] {
  return records.filter(
    (r) => (r.status === 'PENDING' || r.status === 'FAILED') && r.retryCount < maxRetries
  );
}`,
      quiz: [
        {
          id: 'docker-c2-q1',
          question: 'Mục đích cốt lõi của mẫu thiết kế Transactional Outbox trong kiến trúc Microservices là gì?',
          options: [
            'Để thay thế hoàn toàn cơ sở dữ liệu quan hệ bằng file văn bản',
            'Đảm bảo việc lưu thay đổi nghiệp vụ vào Database và việc ghi nhận sự kiện cần phát đi diễn ra nguyên tử trong cùng một Local Transaction',
            'Để giảm dung lượng ảnh Docker xuống 0MB',
            'Để bỏ qua bước xác thực người dùng'
          ],
          correctIndex: 1,
          explanation: 'Ghi bản ghi nghiệp vụ và bản ghi outbox_events trong cùng một DB Transaction giúp tránh tình trạng DB đã commit nhưng Message Broker bị lỗi mạng làm mất sự kiện.'
        }
      ],
      codeChallenge: {
        id: 'docker-c2-l1-ch1',
        level: 'basic',
        levelLabel: 'Cấp độ 1: Lọc sự kiện Outbox hợp lệ để phát lại',
        title: 'Lọc danh sách sự kiện Outbox chưa vượt quá số lần thử tối đa',
        description: 'Viết hàm filterPendingOutbox(events, maxRetries) trả về mảng các sự kiện có published === false và retries < maxRetries.',
        starterCode: `function filterPendingOutbox(events, maxRetries) {
  if (!Array.isArray(events)) return [];
  return events.filter((ev) => ev && ev.published === false && ev.retries < maxRetries);
}`,
        testCases: [
          {
            name: 'Chỉ lấy các sự kiện chưa phát và còn lượt thử',
            input: [[{ id: 'e1', published: false, retries: 1 }, { id: 'e2', published: false, retries: 5 }, { id: 'e3', published: true, retries: 0 }], 3],
            expected: [{ id: 'e1', published: false, retries: 1 }]
          }
        ]
      }
    }
  ]
};

export const COURSES: CourseDefinition[] = [
  {
    id: 'backend-nestjs',
    slug: 'backend-nestjs',
    title: 'Master Backend Engineering với NestJS 11 & Prisma 7',
    shortTitle: 'Backend NestJS 11',
    subtitle: 'Từ Kiến Trúc Phần Cứng, Event Loop, IoC Container đến Hệ Thống Phân Tán Chịu Tải Cao',
    description:
      'Khóa học chủ lực đào tạo kỹ sư Backend cấp độ Production: đi xuyên từ nhân hệ điều hành (C10K, epoll, V8 Heap), Dependency Injection, Request Lifecycle, Prisma 7 Transaction/Locking cho tới Redis Caching, BullMQ và Observability.',
    category: 'Backend Engineering',
    level: 'Master',
    requiredPlan: 'free',
    estimatedHours: 65,
    accentColor: '#0ea5e9',
    badgeText: 'KHÓA HỌC CHỦ LỰC • FULL 10 CHƯƠNG',
    techStack: ['NestJS 11', 'Prisma 7', 'Node.js V8', 'PostgreSQL', 'Redis & BullMQ', 'System Design'],
    outcomes: [
      'Làm chủ cơ chế vận hành của Node.js V8, Event Loop và phòng chống Data Bleed / OOMKill',
      'Thiết kế kiến trúc Modular Monolith & Clean Architecture với NestJS IoC Container',
      'Xử lý Race Condition, Pessimistic/Optimistic Locking và tối ưu hóa truy vấn Prisma 7',
      'Triển khai Bảo mật đa tầng, Caching chống Thundering Herd, Queue bất đồng bộ & Graceful Shutdown'
    ],
    status: 'active',
    curriculum: CURRICULUM
  },
  {
    id: 'typescript-core',
    slug: 'typescript-core',
    title: 'TypeScript Engine, Hệ Thống Kiểu Tĩnh & Decorator Internals',
    shortTitle: 'TypeScript Internals',
    subtitle: 'Nền tảng cốt lõi về Structural Typing, Generics, Type Guards & Reflect Metadata',
    description:
      'Làm chủ trình biên dịch TypeScript, phân biệt rạch ròi Compile-time và Runtime, thiết kế hệ thống kiểu không dùng any, và hiểu sâu cơ chế Decorator phục vụ các Framework hiện đại.',
    category: 'Core Computer Science',
    level: 'Foundation',
    requiredPlan: 'free',
    estimatedHours: 24,
    accentColor: '#0284c7',
    badgeText: 'NỀN TẢNG BẮT BUỘC',
    techStack: ['TypeScript 5.7', 'V8 Runtime', 'Reflect Metadata', 'Type Guards', 'AST'],
    outcomes: [
      'Hiểu bản chất Structural Typing và hiện tượng Type Erasure khi biên dịch sang JS',
      'Viết Custom Type Guards, Discriminated Unions và Generic Constraints chuẩn Production',
      'Hiểu cơ chế emitDecoratorMetadata dưới đáy các IoC Container như NestJS'
    ],
    status: 'active',
    curriculum: [TYPESCRIPT_COURSE_SPRINT_1, TYPESCRIPT_COURSE_SPRINT_2]
  },
  {
    id: 'sql-database-internals',
    slug: 'sql-database-internals',
    title: 'PostgreSQL Internals, B-Tree Indexing, MVCC & Tối Ưu Truy Vấn',
    shortTitle: 'PostgreSQL & Indexing',
    subtitle: 'Giải phẫu trang nhớ 8KB, Composite Index, Isolation Levels và chống Deadlock',
    description:
      'Đi sâu vào tầng lưu trữ vật lý của hệ quản trị cơ sở dữ liệu quan hệ: cách thiết kế chỉ mục B-Tree tối ưu, phân tích EXPLAIN ANALYZE, cơ chế MVCC và kiểm soát đồng thời.',
    category: 'Database & Storage',
    level: 'Intermediate',
    requiredPlan: 'free',
    estimatedHours: 32,
    accentColor: '#10b981',
    badgeText: 'CỐT LÕI DỮ LIỆU',
    techStack: ['PostgreSQL 17', 'B-Tree Index', 'MVCC & WAL', 'EXPLAIN ANALYZE', 'ACID Locking'],
    outcomes: [
      'Thiết kế Composite Index theo đúng quy tắc Leftmost Prefix và Index-Only Scan',
      'Đọc hiểu kế hoạch thực thi truy vấn và loại bỏ nút thắt Sequential Scan',
      'Làm chủ các mức cô lập giao dịch (Isolation Levels) và xử lý tranh chấp khóa'
    ],
    status: 'active',
    curriculum: [SQL_COURSE_SPRINT_1, SQL_COURSE_SPRINT_2]
  },
  {
    id: 'react-modern-frontend',
    slug: 'react-modern-frontend',
    title: 'Modern React 19, Fiber Reconciliation & Kiến Trúc Frontend Hiệu Năng Cao',
    shortTitle: 'Modern React 19',
    subtitle: 'Xây dựng ứng dụng Web quy mô lớn với React 19, State Machine và Tối ưu Render',
    description:
      'Hiểu rõ cách React Fiber điều phối giao diện ở 60fps, quản lý bất biến (Immutability), triệt tiêu lỗi Stale Closure và kiến trúc hóa tầng giao diện kết nối chặt chẽ với Backend.',
    category: 'Frontend & UI Architecture',
    level: 'Intermediate',
    requiredPlan: 'free',
    estimatedHours: 28,
    accentColor: '#f59e0b',
    badgeText: 'FULLSTACK UI',
    techStack: ['React 19', 'Fiber Engine', 'TypeScript UI', 'State Synchronization', 'Web Vitals'],
    outcomes: [
      'Nắm vững cơ chế Reconciliation, Object.is và nguyên tắc bất biến dữ liệu',
      'Xử lý triệt để Race Condition khi gọi API và lỗi Stale Closure trong Hooks',
      'Thiết kế kiến trúc Component tách biệt rõ ràng giữa View và Domain Logic'
    ],
    status: 'active',
    curriculum: [REACT_COURSE_SPRINT_1, REACT_COURSE_SPRINT_2]
  },
  {
    id: 'docker-microservices',
    slug: 'docker-microservices',
    title: 'Distributed Systems, Docker, Linux Cgroups & Kiến Trúc Microservices',
    shortTitle: 'Docker & Microservices',
    subtitle: 'Đóng gói Container chuẩn Production, quản trị ngân sách RAM/CPU và Event-Driven Saga',
    description:
      'Trang bị tư duy vận hành hệ thống phân tán thực chiến: từ cơ chế cô lập nhân Linux (Namespaces, Cgroups) đến chống OOMKill, thiết kế giao tiếp bất đồng bộ và chịu lỗi.',
    category: 'DevOps & Distributed Systems',
    level: 'Advanced',
    requiredPlan: 'free',
    estimatedHours: 36,
    accentColor: '#0ea5e9',
    badgeText: 'KIẾN TRÚC SƯ HỆ THỐNG',
    techStack: ['Docker & Cgroups', 'Kubernetes', 'Message Queue', 'Outbox & Saga', 'SRE'],
    outcomes: [
      'Tính toán chính xác ngân sách bộ nhớ Container và thông số V8 tránh lỗi Exit 137',
      'Thiết kế Multi-stage Dockerfile tối giản, bảo mật non-root và Graceful Shutdown',
      'Áp dụng mẫu thiết kế Outbox, Idempotency và Circuit Breaker cho hệ thống phân tán'
    ],
    status: 'active',
    curriculum: [DOCKER_COURSE_SPRINT_1, DOCKER_COURSE_SPRINT_2]
  }
];

export const CAREER_PATHS: CareerPathDefinition[] = [
  {
    id: 'path-backend-architect',
    title: 'Lộ Trình Kỹ Sư Backend & System Architect',
    subtitle: 'Từ nền tảng Ngôn ngữ & Cơ sở dữ liệu đến Thiết kế Hệ thống Backend Chịu tải cao',
    roleTarget: 'Senior Backend Engineer / System Architect',
    levelRange: 'Fresher → Senior / Architect',
    estimatedMonths: '4 – 6 tháng',
    description:
      'Lộ trình toàn diện giúp lập trình viên xây dựng gốc rễ vững chắc từ TypeScript Engine, tối ưu hóa tầng dữ liệu PostgreSQL, làm chủ toàn diện hệ sinh thái NestJS 11 & Prisma 7 đến đóng gói vận hành trên hạ tầng Container phân tán.',
    accentColor: '#0ea5e9',
    badgeText: 'LỘ TRÌNH TRỌNG ĐIỂM',
    courseIds: ['typescript-core', 'sql-database-internals', 'backend-nestjs', 'docker-microservices'],
    milestones: [
      {
        step: 1,
        title: 'Chặng 1: Làm chủ Ngôn ngữ & Hệ thống Kiểu tĩnh',
        roleMilestone: 'Solid Foundation Developer',
        courseId: 'typescript-core',
        outcome: 'Loại bỏ hoàn toàn tư duy dùng any; làm chủ Type Guards, Generics và cơ chế Decorator Metadata.',
        skills: ['Structural Typing', 'Type Narrowing', 'Reflect Metadata']
      },
      {
        step: 2,
        title: 'Chặng 2: Giải phẫu Cơ sở dữ liệu & Tối ưu Truy vấn',
        roleMilestone: 'Data-Aware Backend Developer',
        courseId: 'sql-database-internals',
        outcome: 'Thiết kế lược đồ chuẩn, đánh chỉ mục B-Tree chính xác và xử lý giao dịch đồng thời không rò rỉ dữ liệu.',
        skills: ['B-Tree Indexing', 'Leftmost Prefix', 'MVCC & Locking']
      },
      {
        step: 3,
        title: 'Chặng 3: Kiến trúc Backend Enterprise với NestJS 11 & Prisma 7',
        roleMilestone: 'Production Backend Engineer',
        courseId: 'backend-nestjs',
        outcome: 'Xây dựng và bảo vệ hệ thống API chịu tải cao qua 10 chương chuyên sâu từ OS Runtime đến Queue & Caching.',
        skills: ['NestJS IoC', 'Request Pipeline', 'Redis & BullMQ', 'Prisma 7']
      },
      {
        step: 4,
        title: 'Chặng 4: Hạ tầng Container & Kiến trúc Phân tán',
        roleMilestone: 'Backend System Architect',
        courseId: 'docker-microservices',
        outcome: 'Đóng gói dịch vụ chuẩn Production, kiểm soát ngân sách Cgroups RAM/CPU và thiết kế Microservices chịu lỗi.',
        skills: ['Linux Cgroups', 'OOM Prevention', 'Distributed Reliability']
      }
    ]
  },
  {
    id: 'path-fullstack-engineer',
    title: 'Lộ Trình Kỹ Sư Fullstack Modern Web (React 19 + NestJS 11)',
    subtitle: 'Làm chủ trọn vẹn từ Giao diện Tương tác Hiệu năng cao đến Lõi API & Database',
    roleTarget: 'Senior Fullstack Product Engineer',
    levelRange: 'Junior → Senior Fullstack',
    estimatedMonths: '4 – 5 tháng',
    description:
      'Kết hợp sức mạnh của TypeScript xuyên suốt cả hai đầu hệ thống: xây dựng Frontend mượt mà với React 19 Fiber và kết nối liền mạch với Backend NestJS 11 + PostgreSQL.',
    accentColor: '#f59e0b',
    badgeText: 'TOÀN DIỆN ĐẦU-CUỐI',
    courseIds: ['typescript-core', 'react-modern-frontend', 'backend-nestjs', 'sql-database-internals'],
    milestones: [
      {
        step: 1,
        title: 'Chặng 1: Nền tảng TypeScript Xuyên suốt (End-to-End Type Safety)',
        roleMilestone: 'Type-Safe Developer',
        courseId: 'typescript-core',
        outcome: 'Chia sẻ hợp đồng dữ liệu (DTO / Discriminated Unions) an toàn tuyệt đối giữa Client và Server.',
        skills: ['Shared Contracts', 'Type Guards', 'Generics']
      },
      {
        step: 2,
        title: 'Chặng 2: Kiến trúc Giao diện Hiện đại với React 19',
        roleMilestone: 'Frontend Architecture Specialist',
        courseId: 'react-modern-frontend',
        outcome: 'Kiểm soát chu kỳ Reconciliation, State bất biến và đồng bộ trạng thái bất đồng bộ không lỗi.',
        skills: ['React 19 Fiber', 'Immutable State', 'Hook Concurrency']
      },
      {
        step: 3,
        title: 'Chặng 3: Xây dựng Lõi Hệ thống với NestJS 11',
        roleMilestone: 'Fullstack Engineer',
        courseId: 'backend-nestjs',
        outcome: 'Thiết kế REST API, xác thực đa tầng, phân quyền RBAC và xử lý tác vụ nền.',
        skills: ['NestJS 11', 'Auth & RBAC', 'Background Jobs']
      },
      {
        step: 4,
        title: 'Chặng 4: Tối ưu hóa Tầng Lưu trữ PostgreSQL',
        roleMilestone: 'Senior Fullstack Engineer',
        courseId: 'sql-database-internals',
        outcome: 'Đảm bảo ứng dụng vận hành nhanh và nhất quán ngay cả khi dữ liệu tăng trưởng lên hàng chục triệu bản ghi.',
        skills: ['Query Tuning', 'Composite Index', 'Transactions']
      }
    ]
  },
  {
    id: 'path-system-devops',
    title: 'Lộ Trình Kỹ Sư Hạ Tầng, Hiệu Năng & Distributed Systems',
    subtitle: 'Tập trung sâu vào Tối ưu Database, Runtime Internals và Vận hành Container',
    roleTarget: 'Platform / Performance & Reliability Engineer',
    levelRange: 'Mid-level → Principal / SRE',
    estimatedMonths: '3 – 5 tháng',
    description:
      'Dành cho lập trình viên muốn đào sâu vào tầng hệ thống: giải quyết các bài toán nghẽn cổ chai Database, rò rỉ bộ nhớ V8 Heap, và vận hành cụm Container ổn định 99.99%.',
    accentColor: '#ec4899',
    badgeText: 'CHUYÊN SÂU HẠ TẦNG',
    courseIds: ['sql-database-internals', 'backend-nestjs', 'docker-microservices'],
    milestones: [
      {
        step: 1,
        title: 'Chặng 1: Tối ưu hóa Tầng Dữ liệu & Khóa Đồng thời',
        roleMilestone: 'Database Performance Specialist',
        courseId: 'sql-database-internals',
        outcome: 'Chẩn đoán và xử lý triệt để Slow Queries, Lock Contention và Deadlock.',
        skills: ['Storage Pages', 'Index Internals', 'Lock Diagnostics']
      },
      {
        step: 2,
        title: 'Chặng 2: Kiến trúc Runtime & Chịu tải Backend NestJS',
        roleMilestone: 'High-Concurrency Backend Engineer',
        courseId: 'backend-nestjs',
        outcome: 'Kiểm soát Event Loop lag, quản trị bộ nhớ V8 và thiết kế hệ thống chống Thundering Herd.',
        skills: ['C10K & epoll', 'V8 Garbage Collector', 'Resilience Patterns']
      },
      {
        step: 3,
        title: 'Chặng 3: Vận hành Container & Hệ thống Phân tán',
        roleMilestone: 'Distributed Systems Engineer',
        courseId: 'docker-microservices',
        outcome: 'Thiết lập ngân sách tài nguyên Cgroups chuẩn xác và kiến trúc Microservices bất đồng bộ.',
        skills: ['Linux Cgroups', 'Zero-Downtime Deploy', 'Event-Driven']
      }
    ]
  }
];

export const DEFAULT_COURSE_ID = 'backend-nestjs';
export const DEFAULT_CAREER_PATH_ID = 'path-backend-architect';

export function getCourseById(courseId?: string | null): CourseDefinition {
  if (!courseId) return COURSES[0];
  return COURSES.find((c) => c.id === courseId || c.slug === courseId) || COURSES[0];
}

export function getCareerPathById(pathId?: string | null): CareerPathDefinition {
  if (!pathId) return CAREER_PATHS[0];
  return CAREER_PATHS.find((p) => p.id === pathId) || CAREER_PATHS[0];
}

export function findCourseByLessonId(lessonId: string, preferredCourseId?: string): {
  course: CourseDefinition;
  sprint: Sprint;
  lesson: Lesson;
} | null {
  if (preferredCourseId) {
    const preferred = getCourseById(preferredCourseId);
    for (const sprint of preferred.curriculum) {
      const found = sprint.lessons.find((l) => l.id === lessonId);
      if (found) return { course: preferred, sprint, lesson: found };
    }
  }

  for (const course of COURSES) {
    for (const sprint of course.curriculum) {
      const found = sprint.lessons.find((l) => l.id === lessonId);
      if (found) return { course, sprint, lesson: found };
    }
  }
  return null;
}

export function getCourseTotalLessons(course: CourseDefinition): number {
  return course.curriculum.reduce((sum, sp) => sum + sp.lessons.length, 0);
}

export function getCourseCompletedCount(
  course: CourseDefinition,
  completedLessons: Record<string, { completedAt: string }> = {}
): number {
  let count = 0;
  for (const sprint of course.curriculum) {
    for (const lesson of sprint.lessons) {
      if (completedLessons[lesson.id]) count++;
    }
  }
  return count;
}

function formatCleanHeading(raw: string): string {
  const cleaned = raw.replace(/^[0-9.]+\s*/, '').replace(/\*\*/g, '').trim();
  const upperLetters = (cleaned.match(/[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/g) || []).length;
  const totalLetters = (cleaned.match(/[a-zA-ZÀ-ỹ]/g) || []).length;
  if (totalLetters > 8 && upperLetters / totalLetters > 0.7) {
    const lower = cleaned.toLowerCase();
    return lower
      .charAt(0)
      .toUpperCase() +
      lower
        .slice(1)
        .replace(/\b(cpu|ram|i\/o|os|v8|rss|gc|http|tcp|udp|tls|jwt|rbac|sql|mvcc|wal|acid|ioc|di|dto|api|orm|redis|oom|ttl|ast|ui|sre)\b/gi, (m) => m.toUpperCase());
  }
  return cleaned;
}

function extractKeyPointsFromSection(sectionText: string, fallbackHeading: string): string[] {
  const points: string[] = [];

  // 1. Subheadings (### ...)
  const subMatches = Array.from(sectionText.matchAll(/^###\s+([^\n]+)/gm));
  for (const m of subMatches) {
    const text = m[1].replace(/^[0-9.]+\s*/, '').replace(/\*\*/g, '').trim();
    if (text.length > 6 && points.length < 4) {
      points.push(text);
    }
  }

  // 2. Bullet / numbered items
  const bulletMatches = Array.from(
    sectionText.matchAll(/^(?:[-*]|[0-9]+\.)\s+([^\n]+)/gm)
  );
  for (const m of bulletMatches) {
    const text = m[1]
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim();
    if (text.length > 15 && points.length < 4) {
      points.push(text.length > 160 ? `${text.slice(0, 157)}...` : text);
    }
  }

  // 3. Fallback sentences from paragraphs
  if (points.length < 2) {
    const cleanProse = sectionText
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^#{1,4}\s+[^\n]+/gm, '')
      .replace(/^\|[^\n]+\|/gm, '')
      .replace(/^>\s*/gm, '')
      .trim();
    const sentences = cleanProse
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\*\*/g, '').trim())
      .filter((s) => s.length > 25);
    for (const s of sentences) {
      if (points.length < 3) {
        points.push(s.length > 160 ? `${s.slice(0, 157)}...` : s);
      }
    }
  }

  if (points.length === 0) {
    points.push(`Nắm vững nguyên lý cốt lõi của ${fallbackHeading}`);
  }
  return points.slice(0, 4);
}

function extractVisualBlocksOnly(sectionText: string): {
  visualMarkdown: string;
  codeExcerpt?: string;
} {
  const blocks: string[] = [];
  let firstCode: string | undefined;

  // Extract fenced blocks (diagram, typescript, etc.)
  const fencedRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedRegex.exec(sectionText)) !== null) {
    const lang = (match[1] || '').toLowerCase();
    const body = match[2] || '';
    blocks.push(match[0]);
    if (lang !== 'diagram' && !firstCode && body.trim().length > 0) {
      firstCode = body.trim();
    }
  }

  // Extract markdown tables
  const tableRegex = /(?:^\|[^\n]+\|\r?\n)+/gm;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(sectionText)) !== null) {
    if (tableMatch[0].includes('---')) {
      blocks.push(tableMatch[0].trim());
    }
  }

  return {
    visualMarkdown: blocks.join('\n\n'),
    codeExcerpt: firstCode
  };
}

/**
 * Decomposes any Lesson into structured 1-on-1 AI Instructor Teaching Checkpoints
 * with Visual-Only Artifacts, Key Takeaway Cards, and 1-Click Interactive Quizzes.
 */
export function buildLessonCheckpoints(lesson: Lesson): TeachingCheckpoint[] {
  const checkpoints: TeachingCheckpoint[] = [];
  const rawTheory = (lesson.theory || '').trim();

  // Split by top-level # or ## sections (or fallback to ### if no #/## exists)
  const majorParts = rawTheory
    .split(/(?=\n#{1,2}\s+[^\n]+)/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (majorParts.length <= 1) {
    const subParts = rawTheory
      .split(/(?=\n###\s+[^\n]+)/g)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (subParts.length > 1) {
      majorParts.splice(0, majorParts.length, ...subParts);
    }
  }

  let stepIdx = 1;
  const quizzes = lesson.quiz || [];

  for (const sectionText of majorParts.slice(0, 5)) {
    const headingMatch = sectionText.match(/^#{1,3}\s+([^\n]+)/m);
    const rawHeading = headingMatch
      ? formatCleanHeading(headingMatch[1])
      : stepIdx === 1
        ? 'Mục tiêu cốt lõi & Bối cảnh bài toán'
        : `Trọng tâm kiến thức bước ${stepIdx}`;

    const shortTitle =
      rawHeading.length > 32 ? `${rawHeading.slice(0, 30).trim()}…` : rawHeading;

    const hasDiagram =
      sectionText.includes('```diagram') ||
      sectionText.includes('┌') ||
      sectionText.includes('──►');

    const checkpointType: TeachingCheckpoint['type'] = hasDiagram
      ? 'architecture'
      : 'concept';

    const keyPoints = extractKeyPointsFromSection(sectionText, rawHeading);
    const { visualMarkdown, codeExcerpt } = extractVisualBlocksOnly(sectionText);
    const mappedQuiz = quizzes.length > 0 ? quizzes[(stepIdx - 1) % quizzes.length] : undefined;

    const summary = keyPoints[0] || rawHeading;
    const socraticQuestion = mappedQuiz
      ? mappedQuiz.question
      : `Khi áp dụng "${rawHeading}" vào hệ thống thực tế, đâu là rủi ro lớn nhất nếu thiết kế sai?`;

    const instructorLeadIn =
      `**Bước ${stepIdx}: ${rawHeading}**\n\n` +
      `Trọng tâm cốt lõi ở phần này là: **${summary}**\n\n` +
      `Em đã tóm tắt **${keyPoints.length} ý chính** và chiếu sơ đồ/bảng biểu trực quan ở **Bảng Kỹ Thuật bên phải**. ĐẠI CA nhìn sơ đồ bên phải rồi thử bấm trả lời nhanh câu hỏi phản xạ 1-chạm hoặc hỏi sâu thêm bất kỳ chỗ nào nhé!`;

    checkpoints.push({
      id: `${lesson.id}-cp-${stepIdx}`,
      index: stepIdx,
      title: `Bước ${stepIdx}: ${rawHeading}`,
      shortTitle,
      summary,
      keyPoints,
      visualMarkdown,
      boardMarkdown: sectionText,
      codeExcerpt: codeExcerpt || lesson.realCodeSnippet,
      instructorLeadIn,
      interactiveQuiz: mappedQuiz,
      socraticQuestion,
      quickReplies: [
        'Giải thích phần này bằng ví dụ thực tế dễ hiểu',
        'Lỗi Production hay gặp nhất ở đây là gì?',
        'Giải thích chi tiết sơ đồ bên phải giúp em'
      ],
      type: checkpointType
    });
    stepIdx++;
  }

  // Dedicated Real Code Walkthrough Checkpoint
  if (lesson.realCodeSnippet && lesson.realCodeSnippet.trim().length > 0) {
    const codeQuiz = quizzes.length > 0 ? quizzes[(stepIdx - 1) % quizzes.length] : undefined;
    checkpoints.push({
      id: `${lesson.id}-cp-code`,
      index: stepIdx,
      title: `Bước ${stepIdx}: Mổ xẻ Code Production (Code X-Ray)`,
      shortTitle: 'Code X-Ray Production',
      summary: 'Bấm vào bất kỳ dòng code nào bên phải để mổ xẻ cơ chế hoạt động và các bẫy Anti-pattern.',
      keyPoints: [
        'Quan sát cấu trúc tách tầng và cách kiểm soát trạng thái bất biến trong đoạn mã mẫu',
        'Bấm trực tiếp vào từng dòng lệnh ở tab Code X-Ray bên phải để nhờ AI Giảng viên giải thích sâu',
        'Đối chiếu cách xử lý ngoại lệ và bảo vệ tài nguyên hệ thống trên môi trường Production'
      ],
      visualMarkdown: `\`\`\`typescript\n${lesson.realCodeSnippet.trim()}\n\`\`\``,
      boardMarkdown: `### Phân Tích Mã Nguồn Production Thực Tế\n\n\`\`\`typescript\n${lesson.realCodeSnippet.trim()}\n\`\`\``,
      codeExcerpt: lesson.realCodeSnippet,
      instructorLeadIn:
        `**Bước ${stepIdx}: Mổ xẻ Code Production Thực Tế**\n\n` +
        `Bây giờ thầy trò mình chuyển sang soi trực tiếp mã nguồn Production ở **khung Code X-Ray bên phải**.\n\n` +
        `ĐẠI CA có thể **bấm chuột vào bất kỳ dòng code nào** bên phải để hỏi em ngay về dòng đó, hoặc bấm nút phân tích tổng thể bên dưới nhé!`,
      interactiveQuiz: codeQuiz,
      socraticQuestion: 'Nhìn vào đoạn code Production bên phải, dòng xử lý nào đóng vai trò chốt chặn quan trọng nhất?',
      quickReplies: [
        'Phân tích luồng chạy từng dòng của đoạn code này',
        'Nếu bỏ qua bước kiểm tra trong code này thì hậu quả gì xảy ra?',
        'Code này chịu tải 10.000 request/giây như thế nào?'
      ],
      type: 'code-walkthrough'
    });
    stepIdx++;
  }

  // Final Interactive Practice & Verification Checkpoint
  checkpoints.push({
    id: `${lesson.id}-cp-practice`,
    index: stepIdx,
    title: `Bước ${stepIdx}: Thực Hành Live Sandbox & Chốt Bài`,
    shortTitle: 'Thực Hành Sandbox',
    summary: `Viết code giải quyết bài toán "${lesson.codeChallenge.title}" ngay trên trình soạn thảo tương tác bên phải.`,
    keyPoints: [
      `Đề bài: ${lesson.codeChallenge.title}`,
      lesson.codeChallenge.description,
      `Vượt qua ${lesson.codeChallenge.testCases.length} bộ kiểm thử tự động (Test Cases) để ghi nhận hoàn tất tiết học`
    ],
    visualMarkdown: '',
    boardMarkdown: `### Thử Thách Thực Hành: ${lesson.codeChallenge.title}\n\n> ${lesson.codeChallenge.description}`,
    codeExcerpt: lesson.codeChallenge.starterCode,
    instructorLeadIn:
      `**Bước ${stepIdx}: Thực Hành Live Code Sandbox**\n\n` +
      `Chặng cuối cùng để biến lý thuyết thành phản xạ thực chiến! Em đã mở sẵn trình soạn thảo **Live Sandbox** bên phải với thử thách: **${lesson.codeChallenge.title}**.\n\n` +
      `ĐẠI CA hãy chạy thử Test Cases bên phải, hoặc bấm **"Gợi ý từng bước"** nếu muốn em dẫn đường nhé!`,
    socraticQuestion: `ĐẠI CA hãy hoàn thành thử thách "${lesson.codeChallenge.title}" trên bảng Sandbox bên phải để chốt sổ tiết học hôm nay nhé!`,
    quickReplies: [
      'Gợi ý cho em thuật toán giải bài tập này (không lộ đáp án)',
      'Giải thích các Test Cases của bài tập này giúp em',
      'Tổng kết lại 3 kiến thức đắt giá nhất của buổi học hôm nay'
    ],
    type: 'final-practice'
  });

  return checkpoints;
}

