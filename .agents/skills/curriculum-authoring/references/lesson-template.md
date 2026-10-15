# Reference Template & Smart MindMap Syntax Guide (`c1-l1` Standard)

This file provides the exact Markdown and TypeScript templates required by the `curriculum-authoring` skill.

---

## 0. Modular File Architecture Template (1 Lesson = 1 File)

### 0.1. Dedicated Lesson File (`src/data/curriculum/chapterX/cX-lY.ts`)
```typescript
import type { Lesson } from '../types.ts';

export const cX_lY: Lesson = {
  id: 'cX-lY',
  title: 'Bài 0Y: [Tiêu đề bài học]',
  duration: '60 phút',
  tag: '[Phân tầng kỹ thuật]',
  theory: `...`,
  realCodeSnippet: `...`,
  quiz: [ /* 8 questions */ ],
  codeChallenge: { /* Level 1 basic challenge */ },
  codeChallenges: [ /* Level 1 basic, Level 2 intermediate, Level 3 advanced */ ]
};
```

### 0.2. Chapter Barrel File (`src/data/curriculum/chapterX.ts`)
```typescript
import type { Sprint } from './types.ts';
import { cX_l1 } from './chapterX/cX-l1.ts';
import { cX_l2 } from './chapterX/cX-l2.ts';
import { cX_l3 } from './chapterX/cX-l3.ts';

export const chapterX: Sprint = {
  sprintId: X,
  sprintTitle: 'Chương X: [Tiêu đề chương]',
  sprintDesc: '[Mô tả chương]',
  lessons: [
    cX_l1,
    cX_l2,
    cX_l3,
  ],
};
```

---

## 1. Complete `theory` Markdown Skeleton

```markdown
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng [Chủ đề cốt lõi] từ cơ bản đến chuyên sâu cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **[Trục 1 - Mô hình & Cơ chế nền tảng]:** Hiểu rõ bản chất của [...]; phân biệt [...]; giải thích cơ chế phát sinh lỗi [...].
> 2. **[Trục 2 - Phân tích định lượng & Kiến trúc cấp thấp]:** Phân tích định lượng [...]; chứng minh nguyên nhân vật lý/kỹ thuật khiến [...] và cơ chế hoạt động của [...].
> 3. **[Trục 3 - Thực thi trong Runtime/NestJS & Chẩn đoán Production]:** Phân biệt [...]; nắm vững cơ chế [...] và phương pháp thiết lập ngân sách/chẩn đoán trên môi trường Production.

---

# 1. [TIÊU ĐỀ PHẦN 1 IN HOA - TRỤ CỘT KIẾN THỨC 1]

### 1.1 Khái niệm nền tảng: [Các khái niệm gốc]
[Giải thích từ nguyên lý gốc Khoa học Máy tính / Hệ điều hành bằng danh sách 1. 2. 3. và tiểu mục -]

### 1.2 Đối chiếu kiến trúc: [Mô hình A] và [Mô hình B]
[Đoạn dẫn nhập phân tích sự khác biệt]

| Tiêu chí học thuật | [Mô hình A] | [Mô hình B] |
| :--- | :--- | :--- |
| **[Tiêu chí 1]** | [Phân tích chi tiết] | [Phân tích chi tiết] |
| **[Tiêu chí 2]** | [Phân tích chi tiết] | [Phân tích chi tiết] |
| **[Tiêu chí 3]** | [Phân tích chi tiết] | [Phân tích chi tiết] |
| **[Tiêu chí 4]** | [Phân tích chi tiết] | [Phân tích chi tiết] |
| **[Tiêu chí 5]** | [Phân tích chi tiết] | [Phân tích chi tiết] |

### 1.3 Cơ chế [Tên cơ chế] và bài toán [Tên lỗi/bài toán thực tế]
[Giải thích cơ chế nội tại trước khi đưa ra code minh họa]

\`\`\`typescript
// File: src/<module>/<file-name>.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): [Mô tả lỗi]
@Injectable()
export class ExampleBrokenService {
  // ...
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION PATTERN): [Mô tả giải pháp]
@Injectable()
export class ExampleSafeService {
  // ...
}
\`\`\`

[Đoạn dẫn nhập bảng truy vết thực thi theo mốc thời gian]

| Mốc thời gian | Luồng / Yêu cầu đang xử lý | Thao tác thực thi trên CPU / I/O | Trạng thái vùng nhớ / Biến | Hệ quả hệ thống |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | ... | ... | ... | ... |
| **\`t = 1 ms\`** | ... | ... | ... | ... |
| **\`t = 4 ms\`** | ... | ... | ... | ... |

### 1.4 Định lượng hiệu năng và công thức tính toán

\`\`\`
[Tên đại lượng kết quả] = [Công thức toán học tường minh] = [Ví dụ tính số cụ thể]
\`\`\`

> **Tổng kết học thuật Phần 1 ([Tóm tắt quy tắc]):**
> 1. **[Quy tắc 1]:** [Nội dung quy tắc bất biến].
> 2. **[Quy tắc 2]:** [Nội dung quy tắc bất biến].

---

# 2. [TIÊU ĐỀ PHẦN 2 IN HOA - TRỤ CỘT KIẾN THỨC 2]

### 2.1 [Tiểu mục 2.1 - Phân cấp / Định lượng]
[Phân tích kèm bảng định lượng 5 cột]

### 2.2 [Tiểu mục 2.2 - Giới hạn của mô hình cũ]
[Phân tích kèm hộp công thức định lượng \`\`\`]

### 2.3 [Tiểu mục 2.3 - Cơ chế giải quyết ở tầng thấp]
[Phân tích tuần tự từng bước 1. 2. 3. 4.]

---

# 3. [TIÊU ĐỀ PHẦN 3 IN HOA - TRỤ CỘT KIẾN THỨC 3]

### 3.1 [Tiểu mục 3.1 - Cấu trúc kiến trúc / bộ nhớ]
[Phân tích chi tiết, có thể kèm sơ đồ \`\`\`diagram nếu mô tả cấu trúc bộ nhớ/phân vùng]

### 3.2 [Tiểu mục 3.2 - Truy vết qua mã nguồn thực thi]
\`\`\`typescript
// File: src/<module>/<trace-file>.ts
// Mã nguồn minh họa đường đi dữ liệu
\`\`\`

### 3.3 [Tiểu mục 3.3 - Phương pháp chẩn đoán & Giám sát trên Production]
[Bảng chẩn đoán triệu chứng & nguyên nhân gốc rễ trên Production]

> **Tổng kết học thuật Phần 3 ([Tên quy tắc vận hành]):**
> [Đúc kết công thức / quy tắc cấu hình Production].

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống ([Tên Tiếng Anh Tương Ứng Của Bài Học])
\`\`\`diagram
[TOPOLOGY: dual-cycle-loop | pipeline-feedback-loop | orbital-cycle | taxonomy-tree] (Tùy chọn: Khai báo tường minh hoặc để bộ phân loại tự động chọn theo nội dung bài học)
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG [TÊN TẦNG 1] ([ENGLISH LAYER 1])                                      │
│    [ Thành phần A (Thông số A) ] ◄───► [ Thành phần B (Thông số B) ]          │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ [Giao thức / Lời gọi kết nối / Cầu nối 1-2]
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG [TÊN TẦNG 2] ([ENGLISH LAYER 2])                                      │
│    ├── [Thành phần 2.1]: [Mô tả kỹ thuật ngắn]                                │
│    ├── [Thành phần 2.2]: [Mô tả kỹ thuật ngắn]                                │
│    └── [Thành phần 2.3]: [Mô tả kỹ thuật ngắn]                                │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ [Giao thức / Lời gọi kết nối / Cầu nối 2-3]
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG [TÊN TẦNG 3]                                                          │
│    ├── [Thành phần 3.1]: [Mô tả kỹ thuật ngắn]                                │
│    ├── [Thành phần 3.2]: [Mô tả kỹ thuật ngắn]                                │
│    └── [Thành phần 3.3]: [Mô tả kỹ thuật ngắn]                                │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh [Mô hình A vs Mô hình B]
\`\`\`diagram
MÔ HÌNH CŨ: [TÊN MÔ HÌNH CŨ / ANTI-PATTERN]
Bước 1 ──► [ Xử lý A ] ──► [ Điểm nghẽn ] ──► HỆ QUẢ XẤU
10,000 Requests = [Thiệt hại định lượng cụ thể].

MÔ HÌNH HIỆN ĐẠI: [TÊN MÔ HÌNH CHUẨN / PRODUCTION]
Request 1 ──┐
Request 2 ──┼──► [ Bộ Điều Phối Trung Tâm ] ──► Xử lý phi chặn / Tối ưu
Request 3 ──┘               │
                            └──► Luôn sẵn sàng ────► Phục vụ tải cao ổn định
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật ([Tên bài toán quyết định])
<!-- LƯU Ý QUAN TRỌNG: Trong file .ts (template literal), mọi dấu gạch chéo ngược phải gõ là \\ để không bị nuốt dòng! -->
\`\`\`diagram
                      [CÂU HỎI QUYẾT ĐỊNH GỐC IN HOA]?
                                     │
                                     ▼
                         [Tiêu chí phân nhánh cấp 1]?
                         /                          \\
           [NHÁNH TRÁI IN HOA]                  [NHÁNH PHẢI IN HOA]
                   /                                      \\
                  ▼                                        ▼
        [ KẾT QUẢ NHÁNH TRÁI (SLOW) ]           [Tiêu chí phân nhánh cấp 2]?
        - Đặc điểm kỹ thuật 1                   /                          \\
        - Đặc điểm kỹ thuật 2          [ĐIỀU KIỆN CON 1]            [ĐIỀU KIỆN CON 2]
        - Cấu hình khuyến nghị                 /                            \\
                                              ▼                              ▼
                                    [ KẾT QUẢ CON 1 (CHUẨN) ]      [ KẾT QUẢ CON 2 ]
                                    - Đặc điểm 1                   - Đặc điểm 1
                                    - Đặc điểm 2                   - Đặc điểm 2
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật ([Tên Ma Trận])

| Tiêu Chí So Sánh | [Phương án 1] | [Phương án 2] | [Phương án 3] |
| :--- | :--- | :--- | :--- |
| **[Tiêu chí 1]** | ... | ... | ... |
| **[Tiêu chí 2]** | ... | ... | ... |
| **[Tiêu chí 3]** | ... | ... | ... |
| **[Tiêu chí 4]** | ... | ... | ... |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề 1 ([Tên định đề]):** [Nội dung đúc kết chuẩn xác].
2. **Định đề 2 ([Tên định đề]):** [Nội dung đúc kết chuẩn xác].
3. **Định đề 3 ([Tên định đề]):** [Nội dung đúc kết chuẩn xác].
4. **Định đề 4 ([Tên định đề]):** [Nội dung đúc kết chuẩn xác].
```

---

## 2. Code Sandbox 3-Level Template (`codeChallenges`)

```typescript
codeChallenges: [
  {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: [Tên Bài Cơ Bản]',
    description: '[Mô tả bối cảnh, tên hàm, tham số, công thức, ngưỡng phân loại, quy tắc làm tròn 2 chữ số thập phân].',
    guidedSteps: [
      'Bước 1 (...): ...',
      'Bước 2 (...): ...',
      'Bước 3 (...): ...',
      'Bước 4 (...): ...'
    ],
    hints: [
      '[Gợi ý 1 về công thức & đơn vị].',
      '[Gợi ý 2 về làm tròn Math.round(x * 100) / 100 hoặc kiểu dữ liệu].'
    ],
    starterCode: `function basicFn(param1, param2) {
  // Bước 1: ...
  
  // Bước 2: ...
  
  // Bước 3: ...
  
  // Bước 4: ...
}`,
    solution: `function basicFn(param1, param2) {
  // Implementation
}`,
    testCases: [
      { name: 'Case 1 công khai', input: [1, 2], expected: { ... }, hidden: false },
      { name: 'Case 2 công khai', input: [3, 4], expected: { ... }, hidden: false },
      { name: 'Case 3 công khai', input: [5, 6], expected: { ... }, hidden: false },
      { name: 'Case 4 ẩn (kiểm tra biên)', input: [7, 8], expected: { ... }, hidden: true },
      { name: 'Case 5 ẩn (làm tròn số lẻ)', input: [9, 10], expected: { ... }, hidden: true }
    ]
  },
  // Lặp lại tương tự cho 'intermediate' (Mức 2) và 'advanced' (Mức 3 có kiểm tra lỗi 'ERROR_THROWN')
]
```
