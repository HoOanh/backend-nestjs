import type { Lesson } from '../types.ts';

export const c1_l2: Lesson = {
  id: 'c1-l2',
  title: 'Bài 02: V8 Pipeline: Ignition, TurboFan, Hidden Classes & Deoptimization',
  duration: '60 phút',
  tag: 'V8 Engine Internals',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Thiết kế Trình biên dịch (Compiler Design) và Kiến trúc Máy ảo V8 Engine từ cấp độ thanh ghi phần cứng đến tầng ứng dụng cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Đường ống biên dịch hai tầng (Two-Tier JIT Pipeline) và cơ chế Thoát lui ngoại lệ (Deoptimization):** Hiểu rõ bản chất của trình thông dịch Bytecode thanh ghi (\`Ignition\`), Vector phản hồi kiểu dữ liệu (\`Type Feedback Vector\`) và trình biên dịch tối ưu hóa phỏng đoán (\`TurboFan\`); phân biệt biểu diễn con trỏ gắn thẻ (\`Smi\` vs \`HeapObject\`) và giải thích cơ chế thay thế khung ngăn xếp (\`On-Stack Replacement - OSR\`) khi xảy ra lỗi suy thoái mã máy (\`Deoptimization Bailout\`).
> 2. **Cấu trúc Lớp ẩn (Hidden Classes / Maps), Bộ nhớ đệm nội tuyến (Inline Caching) và Phân loại mảng V8:** Phân tích định lượng cách V8 ánh xạ đối tượng động sang địa chỉ lệch cố định (\`Fixed Memory Offset\`) qua Cây chuyển đổi trạng thái (\`Transition Tree\`); chứng minh nguyên nhân vật lý khiến toán tử \`delete\` và trạng thái Siêu đa hình (\`Megamorphic IC\`) làm sụt giảm thông lượng CPU, đồng thời nắm vững lưới 6 cấp độ lưu trữ mảng (\`Elements Kinds Lattice\`).
> 3. **Thiết kế dữ liệu Đơn hình (Monomorphic Architecture) và Chẩn đoán hiệu năng V8 trên Production:** Nhận diện các mẫu code gây phân mảnh Lớp ẩn trong ứng dụng NestJS tải cao; làm chủ phương pháp đọc nhật ký biên dịch (\`--trace-opt\`, \`--trace-deopt\`) và thiết lập quy chuẩn khởi tạo thực thể (Entity/DTO) giữ vững tốc độ thực thi mã máy nguyên bản.

---

# 1. KIẾN TRÚC PIPELINE BIÊN DỊCH V8: IGNITION, TURBOFAN VÀ CƠ CHẾ DEOPTIMIZATION

### 1.1 Khái niệm nền tảng: Trình thông dịch (Interpreter), Biên dịch trước (AOT) và Biên dịch đúng lúc (JIT Compilation)

Ở cấp độ vi xử lý vật lý, đơn vị số học và logic (**ALU - Arithmetic Logic Unit**) chỉ hiểu và thực thi được các chỉ thị mã máy nhị phân thuộc kiến trúc tập lệnh phần cứng (**ISA - Instruction Set Architecture**, chẳng hạn như \`x86_64\` hoặc \`ARM64\`). Trong các ngôn ngữ định kiểu tĩnh (**Statically Typed Languages**) như C, C++ hoặc Rust, kiểu dữ liệu và kích thước byte của mọi biến đều được cố định tại thời điểm viết code. Nhờ đó, trình biên dịch thực hiện **Biên dịch trước khi chạy (Ahead-Of-Time Compilation - AOT)**: dịch thẳng phép cộng hai số nguyên \`a + b\` thành một chỉ thị Assembly duy nhất (\`ADD RAX, RBX\`) tốn đúng **1 chu kỳ xung nhịp CPU (~0.33 ns)**.

Ngược lại, JavaScript (và TypeScript sau khi đã xóa bỏ kiểu tĩnh để biên dịch ra JavaScript) là ngôn ngữ định kiểu động (**Dynamically Typed Language**) tuân theo đặc tả **ECMAScript (ECMA-262)**. Khi gặp biểu thức \`a + b\`, tại thời điểm phân tích mã nguồn, bộ máy thực thi hoàn toàn không biết \`a\` và \`b\` là số nguyên 32-bit, số thực dấu phẩy động 64-bit, chuỗi ký tự cần ghép nối, hay đối tượng phức hợp có cài đặt phương thức chuyển đổi nguyên thủy (\`Symbol.toPrimitive\` / \`valueOf()\`). Nếu thực thi hoàn toàn bằng một trình thông dịch tuần tự truyền thống, mỗi phép toán \`+\` phải đi qua hàng chục lệnh rẽ nhánh kiểm tra kiểu dữ liệu ở tầng C++, tiêu tốn từ **40 đến 100 chu kỳ xung nhịp CPU**.

Để dung hòa giữa tính linh hoạt của ngôn ngữ động và tốc độ thực thi của mã máy nguyên bản, V8 Engine sử dụng kiến trúc **Biên dịch đúng lúc đa tầng có tính phỏng đoán (Multi-Tier Speculative Just-In-Time Compilation)** gồm 4 thành phần nối tiếp nhau:

1. **Bộ phân tích từ vựng và cú pháp (Scanner & Parser):**
   Đọc luồng mã nguồn JavaScript dưới dạng chuỗi byte UTF-8/UTF-16, tách thành các đơn vị từ vựng (**Tokens**) và xây dựng **Cây cú pháp trừu tượng (Abstract Syntax Tree - AST)** kết hợp với cấu trúc phạm vi biến (**Scope Chain**). Để giảm thời gian khởi động ứng dụng, V8 áp dụng kỹ thuật **Phân tích lười (Lazy Parsing)**: chỉ phân tích cú pháp chi tiết các hàm cần chạy ngay lập tức và trì hoãn việc dựng AST cho các hàm chưa được gọi.
2. **Trình thông dịch Bytecode thanh ghi (Ignition Interpreter):**
   Thay vì biên dịch toàn bộ AST ra mã máy nặng nề ngay từ đầu, trình thông dịch **Ignition** chuyển đổi AST thành chuỗi mã trung gian gọi là **Bytecode**. Khác với máy ảo Java (JVM) sử dụng kiến trúc ngăn xếp (Stack-based VM), Ignition được thiết kế dưới dạng **Máy ảo dựa trên thanh ghi kết hợp thanh ghi tích lũy (Register-based VM with Accumulator Register \`r0\`)**. Các chỉ thị Bytecode của Ignition (như \`Ldar a0\` — nạp tham số vào thanh ghi tích lũy, \`Add a1\` — cộng với tham số thứ hai) có dung lượng bộ nhớ chỉ bằng **25% đến 50%** so với mã máy Assembly tương đương, giúp tiến trình máy chủ khởi động tức thì và tiết kiệm dung lượng RAM.
3. **Vector phản hồi kiểu dữ liệu (Type Feedback Vector / FeedbackLattice):**
   Đây là thành phần đóng vai trò cầu nối giữa thông dịch và biên dịch tối ưu. Mỗi khi một hàm được khởi tạo, V8 cấp phát kèm một mảng cấu trúc dữ liệu gọi là **Type Feedback Vector**. Tại từng vị trí thực hiện phép toán hoặc truy xuất thuộc tính trong Bytecode (**Feedback Slot**), Ignition âm thầm ghi chép lại kiểu dữ liệu thực tế đã đi qua vị trí đó theo một lưới trạng thái (**Type Lattice**): \`Uninitialized\` (chưa chạy) $\\rightarrow$ \`SignedSmall / Smi\` (chỉ gặp số nguyên nhỏ) $\\rightarrow$ \`Number\` (gặp thêm số thực dấu phẩy động) $\\rightarrow$ \`Any\` (hỗn hợp nhiều kiểu dữ liệu).
4. **Trình biên dịch tối ưu hóa phỏng đoán (TurboFan Optimizing JIT Compiler):**
   Khi một hàm được gọi lặp đi lặp lại hàng nghìn lần hoặc chứa vòng lặp lớn làm bộ đếm độ nóng (**Profiler Invocation / Loop Back-edge Counter**) chạm ngưỡng, V8 đẩy Bytecode của hàm đó cùng với \`Type Feedback Vector\` sang luồng biên dịch nền của **TurboFan**. Dựa trên lịch sử kiểu dữ liệu đã thu thập, TurboFan thực hiện **Tối ưu hóa phỏng đoán (Speculative Optimization)**: giả định rằng trong tương lai hàm vẫn sẽ nhận đúng kiểu dữ liệu như quá khứ, từ đó xây dựng đồ thị biểu diễn trung gian **Biển các nút (Sea of Nodes — kết hợp luồng điều khiển và luồng dữ liệu)**, cắt bỏ toàn bộ các nhánh kiểm tra kiểu dư thừa theo đặc tả ECMAScript và phát sinh mã máy \`x86_64\` / \`ARM64\` thuần túy chạy trực tiếp trên các thanh ghi phần cứng của CPU.

### 1.2 Đối chiếu kiến trúc thực thi: AOT Compilation, Ignition Interpreter và TurboFan Speculative JIT

Để hiểu rõ lý do V8 phải duy trì đồng thời cả trình thông dịch Ignition lẫn trình biên dịch TurboFan trong cùng một tiến trình, bảng dưới đây đối chiếu các thông số kỹ thuật cốt lõi giữa 3 mô hình thực thi:

| Tiêu chí học thuật | Biên dịch tĩnh trước khi chạy (AOT — C++ / Rust / Go) | Thông dịch Bytecode thanh ghi (V8 Ignition Interpreter) | Biên dịch tối ưu hóa phỏng đoán (V8 TurboFan JIT) |
| :--- | :--- | :--- | :--- |
| **Thời điểm biên dịch & Độ trễ khởi động** | Biên dịch toàn bộ trước khi triển khai; khởi động tiến trình tức thì (\`~1 ms\`) | Biên dịch từ AST sang Bytecode ngay khi hàm được gọi lần đầu; độ trễ khởi động rất thấp | Chỉ kích hoạt ngầm cho các hàm nóng (Hot Functions); tốn thời gian CPU để phân tích đồ thị và sinh mã máy |
| **Dung lượng bộ nhớ lưu mã lệnh** | Trung bình; mã máy được nạp cố định vào phân vùng \`Text Segment\` của tiến trình | Rất nhỏ gọn (chỉ bằng \`25% – 50%\` kích thước mã máy); tối ưu cho các hàm chỉ chạy một vài lần lúc khởi tạo | Lớn (mã máy \`x86_64\` đã mở rộng các hàm nội tuyến - Inlined Functions nằm trong vùng nhớ \`Code Space\` của V8) |
| **Chi phí thực thi phép toán trên CPU** | Tối ưu tuyệt đối (\`1 – 2 chu kỳ CPU\` cho phép tính số học trên thanh ghi) | Chậm (\`~30 – 60 chu kỳ CPU\`) do phải giải mã từng lệnh Bytecode (Dispatch Overhead) và cập nhật Type Feedback | Tương đương C++ (\`1 – 4 chu kỳ CPU\`) nhờ loại bỏ kiểm tra động và tính toán trực tiếp trên thanh ghi phần cứng |
| **Cơ chế kiểm tra kiểu dữ liệu** | Kiểm tra 100% lúc biên dịch (Compile-time); không tốn chi phí kiểm tra lúc chạy | Kiểm tra kiểu dữ liệu động ở từng lệnh Bytecode kết hợp ghi nhận vào \`Feedback Slot\` | Đặt các chốt kiểm tra bảo vệ cực nhẹ (\`Type/Map Guards\`) ở đầu hàm trước khi chạy chuỗi lệnh mã máy |
| **Khả năng tối ưu hóa xuyên hàm** | Tối ưu hóa tĩnh toàn cục (Link-Time Optimization - LTO) dựa trên khai báo kiểu | Không hỗ trợ nội tuyến hóa hàm; mỗi lời gọi hàm đều phải tạo \`Bytecode Frame\` mới | Nội tuyến hóa mạnh mẽ (**Function Inlining**), gộp nhiều hàm nhỏ vào cùng một khối mã máy dựa trên dữ liệu thực tế |
| **Rủi ro suy thoái tại Runtime** | Không xảy ra suy thoái kiểu dữ liệu trong quá trình chạy | Hiệu năng thấp nhưng ổn định, không bị sụt giảm khi kiểu dữ liệu đầu vào biến đổi | Bị hủy bỏ mã máy và thoát lui khẩn cấp (**Deoptimization Bailout**) nếu dữ liệu đầu vào vi phạm giả định ban đầu |

### 1.3 Cơ chế Gắn thẻ con trỏ (Pointer Tagging) và Thoát lui ngoại lệ (Deoptimization Bailout)

Làm thế nào TurboFan có thể kiểm tra kiểu dữ liệu với chi phí gần như bằng không, và chuyện gì xảy ra ở tầng ngăn xếp CPU khi giả định của nó bị phá vỡ? Câu trả lời nằm ở kỹ thuật **Biểu diễn con trỏ gắn thẻ (Pointer Tagging)** của V8 và cơ chế **Thay thế trên ngăn xếp (On-Stack Replacement - OSR)**.

Trên kiến trúc phần cứng, mọi đối tượng cấp phát trên V8 Heap đều được căn chỉnh địa chỉ bộ nhớ theo bội số của 4 byte hoặc 8 byte (**Word Alignment**), nghĩa là chữ số nhị phân cuối cùng (Least Significant Bit - LSB) của mọi địa chỉ ô nhớ luôn bằng \`0\`. V8 tận dụng đặc tính vật lý này để phân biệt hai nhóm dữ liệu ngay trong thanh ghi mà không cần tra cứu bảng kiểu dữ liệu:

1. **Số nguyên nhỏ (Smi - Small Integer):**
   Nếu bit cuối cùng của từ nhớ (Word) bằng **\`0\`**, V8 hiểu đây là một số nguyên có dấu 31-bit nằm trực tiếp ngay trên thanh ghi CPU hoặc Stack Frame. Phép cộng hai số \`Smi\` được thực hiện trực tiếp bằng một lệnh phần cứng mà không cần cấp phát bất kỳ byte nào trên V8 Heap.
2. **Con trỏ đối tượng trên Heap (HeapObject & HeapNumber):**
   Nếu bit cuối cùng bằng **\`1\`**, phần còn lại của từ nhớ là địa chỉ con trỏ trỏ sang một cấu trúc dữ liệu nằm trên V8 Heap. Nếu một biến số học nhận giá trị số thực dấu phẩy động (ví dụ \`19.99\`) hoặc số nguyên vượt quá giới hạn 31-bit (\`> 2^30 - 1\`), V8 buộc phải cấp phát một đối tượng **\`HeapNumber\`** (nặng \`16 bytes\` trên Heap để lưu số thực chuẩn IEEE-754 64-bit) và lưu con trỏ trỏ tới đối tượng đó. Quá trình này gọi là **Đóng hộp số thực (Number Boxing)**.

Khi một hàm xử lý tính toán trong ứng dụng Backend đã được TurboFan biên dịch sang mã máy tối ưu cho kiểu \`Smi\` hoặc \`Number\`, nếu một HTTP Request truyền vào dữ liệu chưa được chuẩn hóa (chẳng hạn một chuỗi số \`"500"\` lấy trực tiếp từ \`req.query\`), chốt kiểm tra kiểu ở đầu mã máy (**CheckSmi / CheckNumber Guard**) sẽ báo lỗi. Ngay lập tức, V8 phải thực thi quy trình **Thoát lui ngoại lệ (Eager Deoptimization Bailout)**:
- Dừng luồng thực thi mã máy của TurboFan ngay tại lệnh bị vi phạm.
- Đọc bảng ánh xạ **Deoptimization Translation Table** để trích xuất các giá trị đang nằm rải rác trên thanh ghi CPU (\`RAX\`, \`RBX\`...) và khung ngăn xếp mã máy.
- Tái cấu trúc thành các khung ngăn xếp thông dịch (**Ignition Bytecode Stack Frames**) tương ứng và chuyển quyền điều khiển về lại cho bộ thông dịch Ignition xử lý từ giữa hàm.

Hãy đối chiếu đoạn mã tính phí giao dịch dưới đây để thấy rõ nguyên nhân phát sinh lỗi **Deoptimization Bailout** trong thực tế:

\`\`\`typescript
// File: src/pricing/fee-calculator.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Hàm không đồng nhất kiểu đầu vào gây Deoptimization Bailout
@Injectable()
export class FeeCalculatorBrokenService {
  // Hàm tính phụ phí nằm trên đường nóng (Hot Path), được gọi hàng trăm nghìn lần/phút.
  // Do không chuẩn hóa dữ liệu từ tầng Controller, tham số 'surcharge' lúc là number (0),
  // lúc lại bị truyền chuỗi "0" hoặc undefined từ Query String.
  calculateTotalCent(baseCent: number, quantity: number, surcharge: number | string): number {
const subtotal = baseCent * quantity;
// Khi surcharge là string "50", phép '+' biến thành phép nối chuỗi (String Concatenation)
// phá vỡ hoàn toàn giả định số học Smi của TurboFan!
return Number(subtotal + (surcharge as number));
  }
}

// 2. THIẾT KẾ CHUẨN (TYPE-STABLE MONOMORPHIC): Ép kiểu biên (Boundary Coercion) giữ vững mã máy
@Injectable()
export class FeeCalculatorSafeService {
  // Đảm bảo 100% các lần gọi đi vào hàm tính toán lõi luôn giữ nguyên kiểu số nguyên Smi
  calculateTotalCent(baseCent: number, quantity: number, surchargeCent: number): number {
// Khử phần thập phân bằng phép dịch bit hoặc Math.trunc để giữ biến trong miền 31-bit Smi
const safeBase = Math.trunc(baseCent);
const safeQty = Math.trunc(quantity);
const safeSurcharge = Math.trunc(surchargeCent);
return safeBase * safeQty + safeSurcharge;
  }
}
\`\`\`

Bảng dưới đây truy vết chi tiết trạng thái đường ống V8 và thanh ghi CPU theo từng mốc thời gian khi hàm \`calculateTotalCent\` của lớp \`FeeCalculatorBrokenService\` vận hành dưới tải thực tế:

| Mốc thời gian | Lần gọi hàm & Tham số đầu vào | Tầng thực thi trong V8 Pipeline | Trạng thái Type Feedback & Thanh ghi CPU | Hệ quả hiệu năng trên tiến trình máy chủ |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Lần gọi \`#1\` (\`100, 2, 10\`) | **Ignition Interpreter** | Khởi tạo \`FeedbackVector\`; ghi nhận các khe toán tử \`*\` và \`+\` ở trạng thái \`SignedSmall (Smi)\` | Thực thi thông dịch tuần tự bình thường (\`~45 ns\`/lần gọi) |
| **\`t = 2 ms\`** | Lần gọi \`#2\` đến \`#4,000\` (toàn bộ là số nguyên) | **Ignition** $\\rightarrow$ Kích hoạt **TurboFan** chạy nền | Bộ đếm độ nóng chạm ngưỡng; \`FeedbackVector\` xác nhận 100% tham số lịch sử là \`Smi\` | Luồng biên dịch nền của V8 dựng đồ thị *Sea of Nodes* và sinh mã máy tối ưu có gắn chốt \`CheckSmi\` |
| **\`t = 15 ms\`** | Lần gọi \`#4,001\` đến \`#50,000\` (\`250, 4, 20\`) | **TurboFan Machine Code** | CPU kiểm tra bit cuối cùng (\`LSB == 0\`) và chạy lệnh nhân/cộng trực tiếp trên thanh ghi \`RAX\`, \`RCX\` | Tốc độ đạt cực đại (\`~2 ns\`/lần gọi), không phát sinh bất kỳ cấp phát bộ nhớ Heap nào |
| **\`t = 16 ms\`** | Lần gọi \`#50,001\` (\`250, 4, "0"\` — dính chuỗi từ Query Param) | **Bailout (OSR Deoptimization)** | Chốt \`CheckSmi\` tại tham số thứ 3 thất bại vì \`"0"\` là con trỏ \`HeapObject\` (\`LSB == 1\`) | V8 hủy thực thi mã máy, tra bảng \`Translation Table\` để dựng lại khung ngăn xếp Ignition; tiêu tốn hàng nghìn chu kỳ CPU |
| **\`t = 18 ms\`** | Các lần gọi tiếp theo sau nhiều lần bị Bailout | Rơi vĩnh viễn về **Ignition** hoặc mã máy đa hình | Khe phản hồi kiểu chuyển sang trạng thái hỗn tạp (\`Any\`); nếu vượt ngưỡng số lần thoát lui, V8 gắn cờ \`DoNotOptimize\` | Thông lượng xử lý của hàm sụt giảm hơn \`15–20 lần\`, kéo tăng độ trễ P99 của toàn bộ API |

### 1.4 Định lượng chi phí thực thi và công thức tính thiệt hại Deoptimization

Trong một hệ thống xử lý dữ liệu lô lớn (Batch Processing) hoặc luồng sự kiện thời gian thực thực hiện \`N\` lần gọi hàm trên đường nóng (Hot Path), nếu hàm giữ được trạng thái mã máy ổn định, mỗi lần gọi chỉ tiêu tốn thời gian thực thi mã máy \`T_mach\`. Ngược lại, khi xảy ra \`K\` lần thoát lui ngoại lệ (\`Deoptimization Bailout\`) buộc hàm phải chịu chi phí tháo dỡ khung ngăn xếp \`T_deopt\` và quay về chạy thông dịch \`T_interp\`, tổng thời gian CPU tiêu tốn được xác định bởi công thức:

\`\`\`
Tổng thời gian CPU khi bị Bailout = (N_opt × T_mach) + (K_deopt × T_deopt) + (N_fallback × T_interp)
Ví dụ định lượng (1,000,000 bản ghi): Chạy chuẩn TurboFan (2 ns/lần) = 2.0 ms | Bị hủy tối ưu rơi về Ignition (45 ns/lần) = 45.0 ms (Chậm hơn 22.5 lần)
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc bảo toàn đường ống biên dịch TurboFan):**
> 1. **Tính đơn điệu của kiểu dữ liệu đầu vào (Type Monotonicity Invariant):** Một hàm nằm trên đường nóng xử lý nghiệp vụ bắt buộc phải nhận vào các tham số có kiểu dữ liệu đồng nhất xuyên suốt vòng đời tiến trình. Tuyệt đối không dùng chung một biến hoặc một tham số hàm cho cả kiểu \`number\`, \`string\` và \`boolean\`.
> 2. **Nguyên tắc ép kiểu tại ranh giới hệ thống (System Boundary Coercion):** Mọi dữ liệu thô đi vào từ mạng (HTTP Query, URL Params, JSON Body, Message Queue) phải được xác thực và ép kiểu tường minh ngay tại tầng \`Controller\` / \`ValidationPipe\` trước khi truyền vào các hàm tính toán của \`Service\`.

---

# 2. CẤU TRÚC LỚP ẨN (HIDDEN CLASSES / MAPS), INLINE CACHING VÀ PHÂN LOẠI MẢNG V8

### 2.1 Bản chất vật lý của Đối tượng động và Cây chuyển đổi Lớp ẩn (Hidden Classes / Transition Trees)

Trong các ngôn ngữ biên dịch tĩnh như C++ hay Java, khi khai báo một lớp \`class Invoice { int id; double total; }\`, trình biên dịch biết chính xác thuộc tính \`id\` luôn nằm ở vị trí lệch **\`Offset +0 byte\`** và \`total\` luôn nằm ở **\`Offset +8 bytes\`** tính từ địa chỉ gốc của đối tượng. Mọi thao tác đọc \`invoice.total\` chỉ cần dịch thành một chỉ thị đọc bộ nhớ theo địa chỉ tương đối \`MOV XMM0, [RBX + 8]\` mà không cần lưu tên chuỗi \`"total"\` trong bộ nhớ.

Tuy nhiên, trong JavaScript, một đối tượng không bị ràng buộc bởi lớp tĩnh mà có thể được gắn thêm hoặc xóa bỏ thuộc tính bất kỳ lúc nào trong lúc chạy. Nếu V8 lưu trữ mọi đối tượng JavaScript như một bảng băm từ điển (**Hash Map / Dictionary**) ánh xạ từ chuỗi tên thuộc tính sang giá trị, mỗi lần đọc \`invoice.total\` CPU sẽ phải băm chuỗi \`"total"\`, tính toán vị trí thùng chứa (Bucket) và xử lý va chạm băm. Để loại bỏ chi phí tra cứu từ điển này, V8 biểu diễn mỗi đối tượng \`JSObject\` trên Heap bằng một cấu trúc đầu mục gồm **3 con trỏ ẩn (Object Header Words)** đi kèm cơ chế **Lớp ẩn (Hidden Classes, trong mã nguồn C++ của V8 gọi là \`Map\` và trong học thuật gọi là \`Shape\`)**:

1. **Con trỏ cấu trúc Lớp ẩn (\`Map Pointer\`):**
   Là từ nhớ đầu tiên của mọi đối tượng trên Heap, trỏ tới một đối tượng đặc biệt gọi là **\`Map\` (Hidden Class)**. Bản thân \`Map\` không chứa giá trị dữ liệu của đối tượng, mà lưu trữ siêu dữ liệu mô tả hình học của đối tượng đó: kích thước đối tượng và con trỏ trỏ tới **Bảng mô tả thuộc tính (\`Descriptor Array\`)** — nơi quy định thuộc tính tên \`"id"\` nằm ở khe nhớ (Offset) số \`0\`, thuộc tính tên \`"total"\` nằm ở khe nhớ số \`1\`.
2. **Con trỏ lưu trữ thuộc tính đặt tên (\`Properties Pointer / In-object Properties\`):**
   Để đạt tốc độ truy xuất nhanh nhất (nhấn mạnh tính cục bộ bộ nhớ đệm — **CPU Cache Locality**), V8 lưu trữ các thuộc tính đầu tiên ngay bên trong thân đối tượng (**In-object Properties**), nằm kế tiếp ngay sau 3 con trỏ đầu mục. Chỉ khi số lượng thuộc tính vượt quá dung lượng dự trữ ban đầu, các thuộc tính phát sinh thêm mới được đặt vào một mảng phụ trợ tuyến tính được trỏ tới bởi \`Properties Pointer\` (**Fast Properties**).
3. **Con trỏ lưu trữ phần tử đánh chỉ mục số (\`Elements Pointer\`):**
   Trỏ tới mảng lưu trữ riêng biệt (**Backing Store Array**) dành cho các khóa là số nguyên không âm (\`obj[0]\`, \`obj[1]\`... hoặc các phần tử của \`Array\`). Việc tách rời \`Properties\` (khóa chữ) và \`Elements\` (khóa số) giúp V8 tối ưu hóa các phép toán mảng độc lập với các thuộc tính của đối tượng.

Khi một đối tượng được khởi tạo và gán từng thuộc tính, V8 xây dựng một **Cây chuyển đổi trạng thái Lớp ẩn (Hidden Class Transition Tree)** theo nguyên tắc phụ thuộc nghiêm ngặt vào thứ tự gán:
- Khi khởi tạo đối tượng rỗng \`const u1 = {}\`, \`u1\` trỏ tới Lớp ẩn gốc **\`Map M0\`** (không có thuộc tính nào).
- Khi thực thi \`u1.id = 101\`, V8 tạo ra **\`Map M1\`** (ghi nhận \`id\` ở \`Offset 0\`), đồng thời tạo một liên kết chuyển tiếp trên \`M0\`: *"Nếu đối tượng đang ở \`M0\` được thêm thuộc tính \`id\`, hãy chuyển sang \`M1\`"*.
- Khi thực thi tiếp \`u1.code = 'VN'\`, V8 chuyển tiếp từ \`M1\` sang **\`Map M2\`** (\`id\` ở \`Offset 0\`, \`code\` ở \`Offset 1\`).
- Khi một đối tượng thứ hai \`const u2 = {}\` cũng gán \`u2.id = 102\` rồi \`u2.code = 'SG'\` theo **đúng thứ tự đó**, V8 đi theo nhánh chuyển tiếp có sẵn (\`M0\` $\\rightarrow$ \`M1\` $\\rightarrow$ \`M2\`). Kết quả là cả \`u1\` và \`u2\` cùng dùng chung một địa chỉ **\`Map M2\`** duy nhất.
- **Hệ quả khi gán ngược thứ tự hoặc dùng \`delete\`:** Nếu đối tượng \`u3\` gán \`u3.code = 'HN'\` trước rồi mới gán \`u3.id = 103\`, V8 buộc phải rẽ sang nhánh mới (\`M0\` $\\rightarrow$ \`M3\` $\\rightarrow$ \`M4\`) vì tại \`M4\`, \`code\` nằm ở \`Offset 0\` còn \`id\` nằm ở \`Offset 1\`. Nghiêm trọng hơn, nếu lập trình viên gọi lệnh **\`delete u1.code\`**, để tránh làm phình cây chuyển đổi với vô số nhánh xóa ngẫu nhiên, V8 sẽ **hủy bỏ chế độ Fast Properties** của đối tượng \`u1\` và chuyển nó về **Chế độ từ điển bảng băm (Dictionary Mode / Slow Properties)**, khiến mọi truy xuất thuộc tính về sau trên đối tượng đó chậm đi từ 10 đến 30 lần.

### 2.2 Cơ chế Bộ nhớ đệm nội tuyến tại điểm gọi (Inline Caching - IC) và Ma trận trạng thái đa hình

Lớp ẩn (\`Hidden Class\`) chỉ mới giải quyết được bài toán ánh xạ thuộc tính sang \`Offset\` số nguyên, nhưng nếu mỗi lần đọc \`user.code\` V8 vẫn phải đi từ đối tượng sang \`Map\`, rồi tìm trong \`Descriptor Array\` xem \`"code"\` nằm ở \`Offset\` mấy, thì chi phí vẫn còn cao. Do đó, V8 kết hợp Lớp ẩn với kỹ thuật **Bộ nhớ đệm nội tuyến tại điểm gọi (Inline Caching - IC)**.

Mỗi vị trí đọc hoặc ghi thuộc tính trong mã nguồn (ví dụ biểu thức \`record.diagnosis\` bên trong hàm \`processRecord(record)\`) được gọi là một **Điểm gọi (Call Site)** và được gắn một khe nhớ đệm (**LoadIC / StoreIC Slot**). Quá trình tiến hóa trạng thái của một \`Call Site\` diễn ra qua 4 cấp độ dựa trên số lượng \`Hidden Class (Map)\` khác nhau đi qua nó:

| Trạng thái Inline Cache | Số lượng Hidden Class (\`Map\`) ghi nhận | Cơ chế thực thi ở cấp độ mã máy CPU | Chi phí chu kỳ CPU xấp xỉ | Tác động lên trình biên dịch tối ưu TurboFan |
| :--- | :--- | :--- | :--- | :--- |
| **1. Uninitialized (Chưa khởi tạo)** | \`0 Shape\` (Chưa từng thực thi qua điểm gọi này) | Gọi hàm Runtime của V8 để tra cứu đầy đủ trên \`Descriptor Array\` của \`Map\` và nạp kết quả đầu tiên vào khe IC | ~100 – 200 chu kỳ (chỉ tốn 1 lần duy nhất lúc khởi chạy) | Chưa đủ dữ liệu phản hồi kiểu để TurboFan thực hiện tối ưu hóa |
| **2. Monomorphic (Đơn hình)** | **Đúng \`1 Shape\` duy nhất** xuyên suốt mọi lần gọi | So sánh trực tiếp địa chỉ \`Map\` (\`CMP\`); nếu khớp, đọc thẳng ô nhớ tại \`[base_addr + cached_offset]\` | **~1 – 2 chu kỳ CPU** (Tốc độ truy xuất bộ nhớ trực tiếp tương đương C++) | TurboFan nội tuyến hóa hoàn toàn (**Inlining**) và loại bỏ mọi lệnh tra cứu trung gian |
| **3. Polymorphic (Đa hình hữu hạn)** | Từ **\`2\` đến \`4 Shapes\`** khác nhau (Ngưỡng cứng \`kMaxPolymorphicMapCount = 4\`) | Sinh đoạn mã rẽ nhánh tuyến tính (**Polymorphic Stub**): kiểm tra tuần tự \`if (map == M1) return [base+o1]; else if (map == M2)...\` | ~6 – 15 chu kỳ CPU (tăng tuyến tính theo số nhánh từ 2 đến 4) | TurboFan phải chèn cây điều kiện phân nhánh kiểu (\`Type Switch\`) vào trong mã máy |
| **4. Megamorphic (Siêu đa hình)** | **Trên \`4 Shapes\`** khác nhau (\`>= 5\` cấu trúc đối tượng lệch nhau) | Xóa bỏ bộ đệm cục bộ tại điểm gọi; chuyển sang tra cứu trên **Bảng băm toàn cục (Megamorphic Stub Cache)** hoặc gọi hàm C++ Runtime | **~30 – 80 chu kỳ CPU** (Chậm hơn trạng thái đơn hình từ 15 đến 40 lần) | TurboFan từ bỏ tối ưu hóa phỏng đoán tại điểm gọi này, phát sinh lệnh gọi hàm động tốn kém |
| **5. Dictionary Mode (Chế độ từ điển)** | Đối tượng bị bẻ gãy \`Map\` (do dùng toán tử \`delete\` hoặc thêm hàng trăm khóa động) | Bỏ qua hoàn toàn Inline Cache; thực hiện thuật toán băm chuỗi khóa và dò tìm tuyến tính trên bảng băm nội bộ của đối tượng | **~50 – 150 chu kỳ CPU** kèm tỷ lệ trượt bộ nhớ đệm L1/L2 Cache rất cao | Phá hủy hoàn toàn khả năng tối ưu hóa truy xuất thuộc tính của TurboFan trên đối tượng đó |

Để thấy rõ sự chênh lệch định lượng khi xử lý một lô gồm \`10,000,000\` lượt đọc thuộc tính trong một dịch vụ tổng hợp báo cáo:

\`\`\`
Thời gian CPU ở chế độ Monomorphic (2 chu kỳ ≈ 0.66 ns/lần) = 10,000,000 × 0.66 ns = 6.6 ms
Thời gian CPU ở chế độ Megamorphic / Dictionary (45 ns/lần) = 10,000,000 × 45.0 ns = 450.0 ms (Gây nghẽn Event Loop gần nửa giây)
\`\`\`

### 2.3 Phân loại phần tử mảng nội bộ (Elements Kinds Lattice) và cái bẫy Mảng thưa (Holey Arrays)

Đối với kiểu dữ liệu mảng (\`Array\`), V8 không lưu trữ mọi mảng theo cùng một cách mà quản lý vùng nhớ \`Elements Backing Store\` thông qua một **Lưới trạng thái một chiều (Elements Kinds Lattice)**. Trong số 21 trạng thái nội bộ của V8, kỹ sư Backend bắt buộc phải nắm vững 6 trạng thái cốt lõi được phân chia theo **Kiểu dữ liệu phần tử** và **Độ lấp đầy của mảng (Packed vs Holey)**:

1. **\`PACKED_SMI_ELEMENTS\` (Trạng thái tối ưu nhất):**
   Mảng chứa liên tiếp các số nguyên nhỏ 31-bit (\`Smi\`), không có bất kỳ ô trống nào (ví dụ: \`const arr = [10, 20, 30]\`). Dữ liệu nằm liền kề nhau trên RAM giúp bộ nạp trước phần cứng của CPU (**Hardware Prefetcher**) nạp thẳng cả khối mảng vào **L1 Cache**.
2. **\`PACKED_DOUBLE_ELEMENTS\`:**
   Ngay khi chèn một số thực dấu phẩy động (ví dụ: \`arr.push(15.5)\`) hoặc số \`NaN\` / \`Infinity\`, V8 nâng cấp toàn bộ mảng sang mảng các số thực 64-bit IEEE-754 liền kề nhau (\`8 bytes\` mỗi phần tử). Nhờ vẫn lưu trữ trực tiếp giá trị số nguyên bản trong mảng liên tục (Unboxed Doubles), V8 tránh được việc phải cấp phát từng đối tượng \`HeapNumber\` rời rạc.
3. **\`PACKED_ELEMENTS\`:**
   Khi mảng chứa bất kỳ phần tử nào không phải số (như \`string\`, \`object\`, \`null\`, \`undefined\`), V8 chuyển mảng thành mảng chứa các con trỏ tham chiếu (**Tagged Pointers**). Lúc này, ngay cả các số thực bên trong mảng cũng phải bị đóng hộp thành các đối tượng \`HeapNumber\` nằm rải rác trên Heap.
4. **Nhóm trạng thái Mảng thưa (\`HOLEY_SMI_ELEMENTS\`, \`HOLEY_DOUBLE_ELEMENTS\`, \`HOLEY_ELEMENTS\`):**
   Một mảng bị chuyển sang trạng thái **\`HOLEY\` (Có lỗ thủng)** khi xuất hiện các chỉ mục chưa từng được gán giá trị (được V8 đánh dấu bằng giá trị nội bộ đặc biệt gọi là \`the_hole\`), xảy ra trong 3 trường hợp:
   - Khởi tạo mảng với kích thước trước mà chưa điền giá trị: \`new Array(1000)\`.
   - Gán phần tử vượt quá độ dài hiện tại của mảng: \`const a = [1, 2]; a[10] = 3;\` (các vị trí từ \`2\` đến \`9\` trở thành \`the_hole\`).
   - Sử dụng toán tử \`delete a[i]\` để xóa một phần tử giữa mảng thay vì dùng \`splice\` hoặc lọc mảng mới.

**Hai hệ quả kỹ thuật nghiêm trọng của Lưới phân loại mảng V8:**
- **Quy tắc chuyển dịch một chiều không thể đảo ngược (Irreversible Downward Transition):** Lưới trạng thái mảng chỉ có thể đi theo chiều giảm dần mức độ tối ưu (\`PACKED_SMI\` $\\rightarrow$ \`PACKED_DOUBLE\` $\\rightarrow$ \`PACKED_ELEMENTS\` $\\rightarrow$ \`HOLEY_ELEMENTS\`). Nếu một mảng \`PACKED_SMI_ELEMENTS\` vô tình bị đẩy vào một giá trị \`undefined\` hoặc bị tạo lỗ thủng, ngay cả khi lập trình viên xóa phần tử đó đi ngay dòng code sau, V8 **vẫn giữ nguyên trạng thái \`HOLEY_ELEMENTS\` vĩnh viễn** cho mảng đó.
- **Chi phí duyệt chuỗi nguyên mẫu trên mảng thưa (Prototype Chain Walk Penalty):** Khi đọc \`arr[i]\` trên một mảng \`PACKED\`, nếu \`0 <= i < arr.length\`, mã máy của TurboFan đọc thẳng giá trị tại \`[elements_ptr + i * 8]\`. Nhưng nếu mảng mang nhãn \`HOLEY\`, mã máy bắt buộc phải chèn thêm nhánh kiểm tra xem giá trị tại \`arr[i]\` có phải là \`the_hole\` hay không. Nếu gặp \`the_hole\`, theo đặc tả ngôn ngữ JavaScript, V8 không được trả về \`undefined\` ngay mà phải **duyệt ngược lên \`Array.prototype\` rồi lên tiếp \`Object.prototype\`** để kiểm tra xem có thuộc tính \`i\` nào được khai báo trên chuỗi nguyên mẫu hay không, làm tăng chi phí CPU gấp nhiều lần.

> **Tổng kết học thuật Phần 2 (Quy tắc thiết kế cấu trúc dữ liệu thân thiện với V8):**
> 1. **Đồng nhất hình học đối tượng (Monomorphic Shape Discipline):** Luôn khởi tạo tất cả các thuộc tính của đối tượng theo cùng một thứ tự cố định ngay trong \`constructor\` hoặc hàm khởi tạo; gán tường minh \`null\` cho các trường chưa có dữ liệu và tuyệt đối không dùng toán tử \`delete\`.
> 2. **Bảo toàn tính liên tục của mảng (Packed Array Preservation):** Khởi tạo mảng từ mảng rỗng \`[]\` và dùng \`.push()\` tuần tự hoặc dùng mảng định kiểu nhị phân (\`Int32Array\`, \`Float64Array\`) cho các tập dữ liệu số học lớn để ngăn chặn trạng thái \`HOLEY\` và hiện tượng đóng hộp số thực (\`HeapNumber Boxing\`).

---

# 3. ỨNG DỤNG TRONG KIẾN TRÚC NESTJS TẢI CAO VÀ CHẨN ĐOÁN DEOPTIMIZATION TRÊN PRODUCTION

### 3.1 Các mẫu thiết kế sai lệch (Anti-patterns) phá vỡ Hidden Class trong ứng dụng NestJS

Trong các hệ thống Backend doanh nghiệp xây dựng bằng NestJS, các điểm nghẽn hiệu năng liên quan đến V8 Pipeline thường không nằm ở các thuật toán phức tạp, mà xuất phát từ tầng **Chuyển đổi dữ liệu (Data Mapping / Serialization Layer)** — nơi hàng chục nghìn bản ghi từ cơ sở dữ liệu được biến đổi thành DTO trả về cho khách hàng mỗi giây:

1. **Khởi tạo đối tượng rỗng và gắn thuộc tính theo nhánh điều kiện (\`Conditional Property Mutation\`):**
   Nhiều lập trình viên có thói quen viết hàm mapper bằng cách tạo \`const dto: Record<string, unknown> = { id: row.id }\`, sau đó kiểm tra \`if (row.discount) dto.discount = row.discount;\`, \`if (row.taxCode) dto.taxCode = row.taxCode;\`, \`if (row.notes) dto.notes = row.notes;\`. Với \`k = 4\` câu lệnh \`if\` độc lập, hàm mapper này sẽ sản sinh ra tới **$2^4 = 16$ cấu trúc \`Hidden Class (Map)\` khác nhau** cho cùng một loại bản ghi hóa đơn. Ngay lập tức, mọi hàm xử lý bước tiếp theo (như hàm tính tổng thuế, hàm kiểm tra quyền truy cập và đặc biệt là bộ tuần tự hóa \`JSON.stringify\`) đều vượt ngưỡng \`4 Shapes\` và sụp đổ vào trạng thái **\`Megamorphic\`**.
2. **Xóa trường nhạy cảm bằng toán tử \`delete\` trước khi trả kết quả:**
   Khi truy vấn thông tin người dùng hoặc hồ sơ bệnh án từ ORM, lập trình viên thường dùng \`delete user.passwordHash; delete user.refreshTokenHash;\` để làm sạch dữ liệu. Thao tác này lập tức biến đổi mọi đối tượng \`user\` trong lô kết quả từ chế độ \`Fast Properties\` sang \`Dictionary Mode (Slow Properties)\`, làm chậm toàn bộ quá trình tuần tự hóa JSON ở tầng \`Interceptor\` của NestJS.
3. **Truyền tham số đa kiểu vào các hàm tiện ích dùng chung (Polymorphic Utility Functions):**
   Viết một hàm dùng chung như \`formatValue(val: string | number | Date | object)\` và gọi nó bên trong vòng lặp xử lý hàng trăm nghìn phần tử khiến các khe \`Type Feedback\` bên trong hàm luôn ở trạng thái \`Megamorphic / Any\`, ngăn cản TurboFan thực hiện nội tuyến hóa.

### 3.2 Đối chiếu mã nguồn thực thi và Truy vết trạng thái V8 trong Pipeline xử lý dữ liệu

Hãy quan sát sự đối lập giữa hai cách cài đặt dịch vụ chuẩn hóa hóa đơn tài chính trong NestJS dưới đây:

\`\`\`typescript
// File: src/modules/billing/invoice-mapper.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Gắn thuộc tính động theo điều kiện và dùng toán tử delete
@Injectable()
export class InvoiceMapperBrokenService {
  mapBatchBroken(rawRows: Array<Record<string, unknown>>) {
// Khởi tạo new Array(n) tạo ra mảng HOLEY_ELEMENTS ngay từ đầu
const results = new Array(rawRows.length);
for (let i = 0; i < rawRows.length; i++) {
  const row = rawRows[i];
  const dto: Record<string, unknown> = {
    id: row.id,
    internalSecretKey: row.internalSecretKey,
  };
  // Rẽ nhánh tạo ra hàng loạt Hidden Class (Map) khác nhau trên từng bản ghi
  if (row.discountAmount) dto.discountAmount = row.discountAmount;
  if (row.taxCode) dto.taxCode = row.taxCode;
  if (row.notes) dto.notes = row.notes;

  // Bẻ gãy Hidden Class, ép đối tượng rơi xuống Dictionary Mode (Slow Properties)
  delete dto.internalSecretKey;
  results[i] = dto;
}
return results;
  }
}

// 2. THIẾT KẾ CHUẨN (MONOMORPHIC DTO PATTERN): Cố định cấu trúc Shape qua Class Constructor
export class NormalizedInvoiceDto {
  public readonly id: number;
  public readonly discountAmount: number;
  public readonly taxCode: string | null;
  public readonly notes: string | null;

  constructor(
id: number,
discountAmount: number,
taxCode: string | null,
notes: string | null,
  ) {
// Luôn khởi tạo đủ 4 thuộc tính theo đúng thứ tự cố định (In-object Fast Properties)
// Tuyệt đối không đưa trường nhạy cảm (internalSecretKey) vào đối tượng rồi dùng delete
this.id = id;
this.discountAmount = discountAmount;
this.taxCode = taxCode;
this.notes = notes;
  }
}

@Injectable()
export class InvoiceMapperSafeService {
  mapBatchSafe(rawRows: Array<Record<string, unknown>>): NormalizedInvoiceDto[] {
const results: NormalizedInvoiceDto[] = [];
for (let i = 0; i < rawRows.length; i++) {
  const row = rawRows[i];
  results.push(
    new NormalizedInvoiceDto(
      Number(row.id) || 0,
      Number(row.discountAmount) || 0,
      typeof row.taxCode === 'string' ? row.taxCode : null,
      typeof row.notes === 'string' ? row.notes : null,
    ),
  );
}
return results;
  }
}
\`\`\`

Bảng dưới đây truy vết trạng thái nội bộ của V8 Engine khi hai dịch vụ trên xử lý một lô gồm \`50,000\` bản ghi hóa đơn và chuyển xuống bước tổng hợp doanh thu:

| Mốc thời gian | Giai đoạn xử lý lô 50,000 bản ghi | Trạng thái ở \`InvoiceMapperBrokenService\` | Trạng thái ở \`InvoiceMapperSafeService\` | Chênh lệch hiệu năng đo lường được |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Khởi tạo mảng chứa kết quả đầu ra | \`new Array(50000)\` khởi tạo mảng ở trạng thái \`HOLEY_SMI_ELEMENTS\` chứa 50,000 ô \`the_hole\` | \`const results = []\` khởi tạo mảng ở trạng thái \`PACKED_SMI_ELEMENTS\` | Mảng của \`SafeService\` giữ được cờ \`PACKED\` không cần kiểm tra chuỗi nguyên mẫu |
| **\`t = 1 ms\`** | Xử lý bản ghi thứ \`#1\` đến \`#100\` | Các nhánh \`if\` tạo ra 8 \`Map\` khác nhau; lệnh \`delete\` lập tức đẩy từng đối tượng về \`Dictionary Mode\` | Mọi đối tượng tạo qua \`new NormalizedInvoiceDto\` đều đi theo đúng 1 nhánh chuyển tiếp và chia sẻ chung **\`1 Map\`** duy nhất | \`SafeService\` lưu trữ cả 4 thuộc tính dưới dạng \`In-object Fast Properties\` liền kề trên RAM |
| **\`t = 3 ms\`** | Xử lý bản ghi thứ \`#101\` đến \`#5,000\` (TurboFan kích hoạt) | Các khe \`StoreIC\` bị bão hòa hoàn toàn; V8 phải gọi hàm C++ Runtime để xóa khóa trên bảng băm của từng đối tượng | Khe \`StoreIC\` trong constructor đạt trạng thái **\`Monomorphic\`**; TurboFan nội tuyến hóa toàn bộ hàm \`NormalizedInvoiceDto\` vào vòng lặp | Thời gian khởi tạo 1 đối tượng giảm từ \`~320 ns\` xuống còn \`~18 ns\` |
| **\`t = 8 ms\`** | Hoàn tất vòng lặp chuẩn hóa 50,000 bản ghi | \`BrokenService\` mới chỉ đi được \`35%\` chặng đường do CPU bị nghẽn bởi thao tác cấp phát và xóa trên Dictionary | \`SafeService\` hoàn tất toàn bộ 50,000 đối tượng Monomorphic và chuyển sang bước tính tổng cùng tuần tự hóa JSON | \`SafeService\` hoàn thành giai đoạn ánh xạ nhanh hơn gấp \`6.4 lần\` |
| **\`t = 25 ms\`** | Tuần tự hóa kết quả ra chuỗi JSON (\`JSON.stringify\`) | Bộ tuần tự hóa phải duyệt bảng băm riêng biệt của từng đối tượng trong 50,000 phần tử | Bộ tuần tự hóa của V8 tận dụng chung \`Descriptor Array\` của 1 \`Map\` duy nhất để đọc thẳng các \`Offset\` cố định | Tổng thời gian phản hồi API giảm từ \`~48 ms\` xuống còn \`~9 ms\`, giải phóng sớm Main Thread |

### 3.3 Phương pháp chẩn đoán, đọc nhật ký biên dịch V8 (\`--trace-opt\`, \`--trace-deopt\`) trên Production

Để xác minh thực nghiệm xem các dịch vụ trong dự án NestJS có đang bị suy thoái hiệu năng do \`Deoptimization\` hoặc \`Megamorphic IC\` hay không, kỹ sư hệ thống không được phỏng đoán cảm tính mà sử dụng bộ cờ chẩn đoán nội bộ của V8 truyền qua Node.js CLI trong quá trình kiểm thử tải (Load Testing):
- \`node --trace-opt dist/main.js\`: Ghi nhật ký mỗi khi trình biên dịch TurboFan tối ưu hóa một hàm sang mã máy.
- \`node --trace-deopt dist/main.js\`: Ghi nhật ký chi tiết mỗi khi một hàm bị thoát lui ngoại lệ (\`bailout\`), chỉ rõ tên hàm, số dòng, số cột và **Mã lý do kỹ thuật (Bailout Reason)**.
- \`node --prof dist/main.js\` (kết hợp \`node --prof-process\`): Phân tích tỷ lệ phần trăm chu kỳ CPU dành cho mã máy đã tối ưu (\`LazyCompile / *functionName\`) so với mã thông dịch (\`~functionName\`) và các hàm C++ Runtime của V8.

Bảng dưới đây tổng hợp 5 mã lý do thoát lui (\`Bailout Reasons\`) phổ biến nhất trong nhật ký \`--trace-deopt\` và phương pháp xử lý triệt để:

| Mã lý do trên nhật ký \`--trace-deopt\` | Nguyên nhân kỹ thuật ở tầng V8 Engine | Mẫu code TypeScript / NestJS gây lỗi điển hình | Phương pháp khắc phục kiến trúc triệt để |
| :--- | :--- | :--- | :--- |
| **\`wrong map\`** | Đối tượng truyền vào hàm có địa chỉ \`Hidden Class (Map)\` khác với \`Map\` mà TurboFan đã giả định trong chốt \`CheckMaps\` | Khởi tạo DTO bằng object literal rỗng rồi gắn thuộc tính theo nhánh \`if/else\` hoặc gán lệch thứ tự thuộc tính | Định nghĩa \`class\` với \`constructor\` gán đầy đủ mọi thuộc tính theo thứ tự cố định; dùng \`null\` cho các trường tùy chọn |
| **\`not a Smi\`** | Tham số hoặc biến kết quả được giả định là số nguyên nhỏ 31-bit (\`Smi\`), nhưng thực tế nhận vào số thực dấu phẩy động, chuỗi số hoặc vượt quá \`2^30 - 1\` | Đọc tham số phân trang \`page\`, \`limit\` hoặc tiền tệ từ \`req.query\` mà không ép kiểu số nguyên, hoặc phép chia tạo ra số thập phân | Sử dụng \`ValidationPipe({ transform: true })\` kết hợp \`Math.trunc()\` hoặc tính toán tiền tệ theo đơn vị nhỏ nhất (Cent / Đồng nguyên) |
| **\`not a HeapNumber\`** | Vị trí phép toán đang được tối ưu hóa cho số thực 64-bit (\`HeapNumber\`), nhưng bất ngờ nhận vào giá trị \`undefined\`, \`null\` hoặc chuỗi ký tự | Đọc trường số liệu thống kê có thể bị thiếu (\`optional number\`) từ Database và đưa thẳng vào công thức cộng/nhân mà không có giá trị mặc định | Chuẩn hóa giá trị thiếu về số thực mặc định \`0.0\` ngay khi đọc dữ liệu: \`const val = typeof raw === 'number' ? raw : 0;\` |
| **\`out of bounds\`** | Chỉ mục truy cập mảng \`arr[i]\` vượt quá độ dài thực tế \`arr.length\` hoặc truy cập vào ô trống trên mảng, phá vỡ chốt \`CheckBounds\` | Duyệt vòng lặp dùng điều kiện \`i <= arr.length\` (dư 1 phần tử cuối trả về \`undefined\`) hoặc đọc phần tử trên mảng thưa chưa khởi tạo | Luôn kiểm tra nghiêm ngặt \`0 <= i && i < arr.length\` và đảm bảo mảng được lấp đầy tuần tự (\`PACKED_*\`) |
| **\`Insufficient type feedback for generic named access\`** | TurboFan cố gắng biên dịch hàm nhưng tại vị trí truy xuất thuộc tính chưa có đủ thông tin kiểu hoặc đã bị bão hòa thành \`Megamorphic\` | Viết một hàm xử lý chung nhận vào quá nhiều loại Entity/Interface khác nhau cùng truy xuất các thuộc tính không đồng nhất | Tách hàm đa năng thành các hàm chuyên biệt cho từng thực thể hoặc chuẩn hóa về một cấu trúc trung gian đồng nhất trước khi đưa vào vòng lặp |

> **Tổng kết học thuật Phần 3 (Quy tắc vận hành và tối ưu hóa đường nóng - Hot Path Optimization):**
> Trong kiến trúc máy chủ NestJS, không cần tối ưu hóa cực đoan cho các đoạn mã chỉ chạy một lần lúc khởi động (như khởi tạo \`Module\`, đọc biến môi trường \`ConfigService\`). Tuy nhiên, đối với các **Đường nóng (Hot Paths)** — bao gồm các \`Guard\` xác thực chạy trên mọi request, các \`Interceptor\` tuần tự hóa dữ liệu, và các vòng lặp chuyển đổi hàng nghìn bản ghi trong \`Service\` — kỹ sư bắt buộc phải tuân thủ kỷ luật **Đơn hình hóa cấu trúc dữ liệu (Monomorphic Data Layout)** để giữ 100% thời gian thực thi nằm trên mã máy của TurboFan.

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Biên Dịch V8 (V8 Execution Pipeline Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG PHÂN TÍCH CÚ PHÁP & KHỞI TẠO (FRONTEND PARSING LAYER)                 │
│    [ Mã nguồn TS/JS ] ◄───► [ Scanner (Tokens) ] ◄───► [ Parser (Cây AST) ]   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                   │ Sinh mã Bytecode thanh ghi (Accumulator r0)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG THÔNG DỊCH & THU THẬP KIỂU (IGNITION INTERPRETER LAYER)               │
│    ├── Bytecode Handler: Thực thi tức thì với dung lượng bộ nhớ tối thiểu     │
│    ├── Type Feedback Vector: Ghi nhận kiểu Smi, HeapNumber và địa chỉ Map     │
│    └── Inline Cache (LoadIC/StoreIC): Lưu đệm Offset thuộc tính tại điểm gọi  │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                   │ Khi hàm nóng (Hot) & Kiểu ổn định (Monomorphic)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG BIÊN DỊCH TỐI ƯU HÓA MÃ MÁY (TURBOFAN JIT COMPILER LAYER)             │
│    ├── Sea of Nodes Graph: Cắt bỏ nhánh kiểm tra kiểu dư thừa & Inlining      │
│    ├── Native Machine Code (x86_64/ARM64): Chạy trực tiếp trên thanh ghi CPU  │
│    └── OSR Deoptimization Guard: Thoát lui về Ignition nếu vi phạm Map/Smi    │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Truy Xuất Thuộc Tính (Megamorphic Dictionary vs Monomorphic Inline Cache)
\`\`\`diagram
MÔ HÌNH CŨ: KHỞI TẠO ĐỘNG & DÙNG LỆNH DELETE (MEGAMORPHIC / DICTIONARY MODE)
Tạo Object ──► [ Gán lệch thứ tự / delete ] ──► [ Vỡ Hidden Class ] ──► TRA BẢNG BĂM CHẬM O(N)
50,000 Records = Tốn 48ms CPU, làm bão hòa Inline Cache và gây Deoptimization.

MÔ HÌNH HIỆN ĐẠI: CỐ ĐỊNH SHAPE QUA CONSTRUCTOR (MONOMORPHIC INLINE CACHE)
Record 1 ──┐
Record 2 ──┼──► [ Chung 1 Hidden Class Map ] ──► Đọc thẳng Offset bộ nhớ O(1)
Record 3 ──┘               │
                       └──► TurboFan Inlining ────► Xử lý 50,000 bản ghi trong 9ms
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chẩn Đoán Trạng Thái Inline Caching & Cấu Trúc Dữ Liệu V8)
\`\`\`diagram
                  ĐỐI TƯỢNG HOẶC ĐIỂM GỌI HÀM ĐANG ĐƯỢC V8 THỰC THI NHƯ THẾ NÀO?
                                                │
                                                ▼
                       Có sử dụng toán tử delete trên đối tượng không?
                       /                                             \\
          CÓ (DÙNG LỆNH DELETE)                                  KHÔNG DÙNG DELETE
                    /                                                     \\
                   ▼                                                       ▼
     [ DICTIONARY MODE (SLOW) ]                         Số lượng Shape (Map) đi qua điểm gọi?
     - Bẻ gãy cây Transition Tree                       /                                   \\
     - Tra cứu bảng băm tốn 50-150 chu kỳ         ĐÚNG 1 SHAPE                         TỪ 2 SHAPE TRỞ LÊN
     - Phá hủy tối ưu hóa của TurboFan                 /                                       \\
                                                      ▼                                         ▼
                                        [ MONOMORPHIC IC (CHUẨN) ]                [ POLYMORPHIC / MEGAMORPHIC ]
                                        - Đọc trực tiếp Offset O(1)               - 2-4 Shapes: Duyệt nhánh tuyến tính
                                        - Tốc độ 1-2 chu kỳ ngang C++             - >4 Shapes: Bão hòa, rơi về bảng băm
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Trạng Thái Inline Caching & Chế Độ Thuộc Tính V8)

| Tiêu Chí So Sánh | Monomorphic Fast Properties (1 Shape) | Polymorphic Inline Cache (2 – 4 Shapes) | Megamorphic / Dictionary Mode (>4 Shapes hoặc \`delete\`) |
| :--- | :--- | :--- | :--- |
| **Cấu trúc lưu trữ thuộc tính** | Mảng tuyến tính cố định ngay trong thân đối tượng (\`In-object Properties\`) | Mảng tuyến tính nhưng vị trí \`Offset\` thay đổi tùy theo từng nhánh \`Map\` | Bảng băm động (\`Hash Table Dictionary\`) hoặc tra cứu \`Megamorphic Stub Cache\` |
| **Chi phí chu kỳ CPU / lần đọc** | Tối ưu tuyệt đối (\`~1 – 2 chu kỳ xung nhịp\`) | Trung bình (\`~6 – 15 chu kỳ xung nhịp\`) | Rất cao (\`~30 – 150 chu kỳ xung nhịp\`) |
| **Khả năng nội tuyến hóa (Inlining)** | TurboFan nội tuyến hóa 100% mã lệnh vào hàm gọi | Nội tuyến hóa có điều kiện kèm các nhánh kiểm tra \`Type Switch\` | Không thể nội tuyến hóa trực tiếp; phải phát sinh lời gọi hàm C++ Runtime |
| **Khuyến nghị trong kiến trúc NestJS** | Bắt buộc áp dụng cho mọi Entity, DTO và vòng lặp xử lý lô lớn (Hot Paths) | Chấp nhận được ở tầng điều phối nghiệp vụ có kế thừa từ 2–3 lớp con | Mẫu thiết kế sai lệch (Anti-pattern); bắt buộc phải tái cấu trúc mã nguồn |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`MonomorphicRecordPipelineService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề tối ưu hóa phỏng đoán và thoát lui (\`Speculative JIT & Deoptimization Invariant\`):** Trình biên dịch TurboFan chỉ sinh được mã máy tốc độ cao khi dữ liệu phản hồi kiểu (\`Type Feedback Vector\`) từ trình thông dịch Ignition đạt tính ổn định. Bất kỳ sự đột biến kiểu dữ liệu nào (truyền chuỗi vào tham số số nguyên \`Smi\` hoặc truyền đối tượng sai lệch \`Map\`) đều kích hoạt cơ chế thoát lui \`On-Stack Replacement (OSR) Bailout\`, tiêu tốn hàng nghìn chu kỳ CPU để dựng lại khung ngăn xếp thông dịch.
2. **Định đề bất biến thứ tự Lớp ẩn (\`Hidden Class Transition Invariant\`):** V8 xác định hình học bộ nhớ của đối tượng thông qua chuỗi chuyển tiếp \`Hidden Class (Map)\`. Hai đối tượng có cùng tập hợp thuộc tính nhưng được gán theo thứ tự khác nhau sẽ sinh ra hai nhánh \`Map\` tách biệt, còn việc sử dụng toán tử \`delete\` sẽ bẻ gãy hoàn toàn cây chuyển tiếp và đẩy đối tượng về chế độ bảng băm chậm (\`Dictionary Mode\`).
3. **Định đề ngưỡng bão hòa Bộ nhớ đệm nội tuyến (\`Inline Cache Polymorphism Limit\`):** Mỗi điểm truy xuất thuộc tính (\`Call Site\`) chỉ đạt tốc độ đọc ô nhớ trực tiếp \`O(1)\` khi ở trạng thái **Đơn hình (\`Monomorphic\` — 1 Shape)**. Khi số lượng \`Hidden Class\` đi qua cùng một điểm gọi vượt quá ngưỡng cứng **\`4 Shapes\`**, điểm gọi đó rơi vào trạng thái **Siêu đa hình (\`Megamorphic\`)**, làm mất hiệu lực bộ đệm cục bộ và sụt giảm thông lượng xử lý hàng chục lần.
4. **Định đề chuyển dịch một chiều trên mảng (\`One-Way Array Elements Lattice Invariant\`):** Cấu trúc mảng trong V8 chuyển dịch một chiều từ đặc sang thưa (\`PACKED_SMI\` $\\rightarrow$ \`PACKED_DOUBLE\` $\\rightarrow$ \`PACKED_ELEMENTS\` $\\rightarrow$ \`HOLEY_ELEMENTS\`) và không bao giờ tự phục hồi theo chiều ngược lại. Việc khởi tạo mảng rỗng bằng \`new Array(N)\` hoặc gán phần tử ngắt quãng tạo ra các lỗ thủng (\`the_hole\`), buộc CPU phải duyệt ngược lên chuỗi nguyên mẫu (\`Prototype Chain\`) ở mỗi lần truy xuất.
  `,
  realCodeSnippet: `// File: src/modules/clinical/transformer/monomorphic-record.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Pipeline Chuẩn Hóa Bản Ghi Y Tế Đơn Hình (Monomorphic Data Pipeline)
import { Injectable, Logger } from '@nestjs/common';

export interface BatchTelemetryReport {
  readonly processedCount: number;
  readonly averageVitalScore: number;
  readonly executionTimeMs: number;
  readonly isMonomorphicGuaranteed: boolean;
}

/**
 * Thực thể bệnh án chuẩn hóa theo kiến trúc Monomorphic Hidden Class (ADR-0014):
 * 1. Cố định 100% thứ tự khởi tạo thuộc tính trong constructor (In-object Fast Properties).
 * 2. Các trường tùy chọn bắt buộc khởi tạo bằng giá trị null tường minh, tuyệt đối không bỏ trống.
 * 3. Sử dụng Object.seal() để khóa cấu trúc Map, ngăn chặn việc thêm/xóa thuộc tính động (delete).
 */
export class MedicalRecordEntity {
  public readonly id: number;
  public readonly patientCode: string;
  public readonly diagnosisCode: string;
  public readonly vitalScore: number;
  public readonly clinicalNotes: string | null;
  public readonly archivedAt: string | null;

  constructor(
id: number,
patientCode: string,
diagnosisCode: string,
vitalScore: number,
clinicalNotes: string | null,
archivedAt: string | null,
  ) {
this.id = id;
this.patientCode = patientCode;
this.diagnosisCode = diagnosisCode;
this.vitalScore = vitalScore;
this.clinicalNotes = clinicalNotes;
this.archivedAt = archivedAt;
Object.seal(this);
  }
}

@Injectable()
export class MonomorphicRecordPipelineService {
  private readonly logger = new Logger(MonomorphicRecordPipelineService.name);

  /**
   * Chuẩn hóa lô bản ghi thô từ Message Queue sang mảng PACKED_ELEMENTS chứa các thực thể đơn hình
   * và tính điểm sinh hiệu trung bình trên mảng số thực liên tục (Float64Array) để tối ưu L1/L2 CPU Cache.
   */
  public transformAndAnalyzeBatch(
rawPayloads: ReadonlyArray<Record<string, unknown>>,
  ): { records: MedicalRecordEntity[]; telemetry: BatchTelemetryReport } {
const startHrTime = process.hrtime.bigint();
const total = rawPayloads.length;

// Dùng mảng rỗng + push tuần tự để giữ vững trạng thái PACKED_ELEMENTS (không sinh the_hole)
const records: MedicalRecordEntity[] = [];
// Dùng Float64Array cho tính toán số học để tránh hoàn toàn hiện tượng đóng hộp HeapNumber Boxing
const vitalBuffer = new Float64Array(total);
let scoreSum = 0;

for (let i = 0; i < total; i++) {
  const raw = rawPayloads[i];
  // Ép kiểu tại ranh giới (Boundary Coercion): giữ id luôn là số nguyên 31-bit Smi
  const safeId = Math.trunc(Number(raw.id) || 0);
  const safeScore = Number(raw.vitalScore) || 0;

  const entity = new MedicalRecordEntity(
    safeId,
    typeof raw.patientCode === 'string' ? raw.patientCode.trim().toUpperCase() : 'UNKNOWN',
    typeof raw.diagnosisCode === 'string' ? raw.diagnosisCode.trim().toUpperCase() : 'UNSPECIFIED',
    safeScore,
    typeof raw.clinicalNotes === 'string' && raw.clinicalNotes.length > 0 ? raw.clinicalNotes : null,
    typeof raw.archivedAt === 'string' && raw.archivedAt.length > 0 ? raw.archivedAt : null,
  );

  records.push(entity);
  vitalBuffer[i] = entity.vitalScore;
  scoreSum += vitalBuffer[i];
}

const elapsedNs = Number(process.hrtime.bigint() - startHrTime);
const executionTimeMs = Math.round((elapsedNs / 1_000_000) * 100) / 100;
const averageVitalScore = total > 0 ? Math.round((scoreSum / total) * 100) / 100 : 0;

this.logger.debug(\`Processed \${total} monomorphic records in \${executionTimeMs}ms\`);

return {
  records,
  telemetry: {
    processedCount: total,
    averageVitalScore,
    executionTimeMs,
    isMonomorphicGuaranteed: true,
  },
};
  }
}`,
  quiz: [
    {
      id: 'c1-l2-q1',
      question: 'Kiến trúc thực thi hai tầng (Two-Tier Execution Pipeline) của V8 Engine phân chia vai trò giữa bộ thông dịch Ignition và trình biên dịch tối ưu TurboFan theo cơ chế kỹ thuật nào?',
      options: [
        'TurboFan biên dịch trước (AOT) toàn bộ mã nguồn sang mã máy x86_64 khi ứng dụng khởi động, còn Ignition chỉ đóng vai trò bộ thông dịch dự phòng khi phát hiện ngoại lệ cú pháp.',
        'Ignition dịch nhanh AST sang Bytecode thanh ghi để chạy tức thì và thu thập Type Feedback; TurboFan dùng dữ liệu này để dịch các hàm nóng (Hot Functions) sang mã máy tối ưu.',
        'Ignition chạy trên một luồng nhân hệ điều hành riêng biệt để phân tích cú pháp mã nguồn, trong khi TurboFan chạy trên luồng song song để ghi trực tiếp mã máy vào bộ nhớ chia sẻ.',
        'TurboFan kiểm tra tính tương thích của kiểu dữ liệu tĩnh TypeScript trong mã nguồn rồi gửi Bytecode đã xác thực về cho Ignition thực thi trực tiếp trên các thanh ghi phần cứng.'
      ],
      correctIndex: 1,
      explanation: 'V8 kết hợp hai tầng thực thi: Ignition là máy ảo thanh ghi dịch nhanh AST sang Bytecode (chỉ bằng 25-50% kích thước mã máy) để giảm độ trễ khởi động và gắn các khe thu thập phản hồi kiểu (Type Feedback Vector). Khi một hàm chạy đủ nhiều (Hot Function), TurboFan đọc Type Feedback để thực hiện tối ưu hóa phỏng đoán (Speculative Optimization) và sinh mã máy x86_64/ARM64.'
    },
    {
      id: 'c1-l2-q2',
      question: 'Cơ chế Thoát lui ngoại lệ (Deoptimization Bailout / On-Stack Replacement) trong V8 Engine xảy ra trong tình huống điển hình nào sau đây?',
      options: [
        'Khi độ sâu của ngăn xếp Call Stack vượt quá ngưỡng an toàn của V8 khiến tiến trình phải hủy bỏ khung hàm đang chạy và chuyển quyền điều khiển ngược về cho hàm gọi phía trên.',
        'Khi phân vùng bộ nhớ Young Generation bị lấp đầy hoàn toàn, buộc trình biên dịch JIT phải dừng thực thi mã máy để chờ thuật toán Cheney Scavenge dọn dẹp xong vùng nhớ.',
        'Khi một hàm đã được TurboFan biên dịch sang mã máy tối ưu dựa trên giả định kiểu (như CheckSmi hoặc CheckMaps) bất ngờ nhận vào tham số đầu vào vi phạm giả định đó.',
        'Khi một hàm đồng bộ thực thi vượt quá 50ms trên luồng chính, bộ điều phối tiến trình của Libuv buộc phải hủy mã máy để trả quyền kiểm soát về cho pha Poll của Event Loop.'
      ],
      correctIndex: 2,
      explanation: 'Mã máy do TurboFan sinh ra luôn đặt các chốt kiểm tra giả định ở đầu hàm (như CheckSmi để kiểm tra số nguyên 31-bit hoặc CheckMaps để kiểm tra địa chỉ Hidden Class). Nếu một request bất ngờ truyền vào chuỗi ký tự hoặc đối tượng lệch cấu trúc Map, chốt kiểm tra thất bại và V8 buộc phải thực hiện OSR Deoptimization: tháo dỡ khung ngăn xếp mã máy để dựng lại khung thông dịch Bytecode của Ignition.'
    },
    {
      id: 'c1-l2-q3',
      question: 'Tại sao việc khởi tạo các thuộc tính của cùng một loại đối tượng theo thứ tự khác nhau (ví dụ: { id: 1, code: "A" } so với { code: "A", id: 1 }) lại làm suy giảm hiệu năng truy xuất của V8?',
      options: [
        'Vì bộ xử lý trung tâm không thể căn chỉnh (memory alignment) các trường dữ liệu theo bội số của 64-bit, gây ra lỗi truy cập bộ nhớ lệch chuẩn ở tầng phần cứng vật lý.',
        'Vì V8 tạo ra hai nhánh Hidden Class (Maps) khác nhau trên Transition Tree với vị trí Offset bị đảo ngược, làm phá vỡ tính đơn hình (Monomorphic) tại các điểm gọi hàm.',
        'Vì bộ phân tích cú pháp (Parser) của V8 phải khởi tạo hai cây cú pháp trừu tượng (AST) độc lập, làm tăng gấp đôi dung lượng bộ nhớ dành cho mảng Bytecode của hàm.',
        'Vì Garbage Collector phải thiết lập thêm các rào chắn ghi nhớ (Write Barriers) giữa các thuộc tính để theo dõi con trỏ xuyên thế hệ từ Old Generation sang Young Generation.'
      ],
      correctIndex: 1,
      explanation: 'Cây chuyển đổi Lớp ẩn (Hidden Class Transition Tree) của V8 phụ thuộc nghiêm ngặt vào thứ tự gán thuộc tính để xác định vị trí lệch (Memory Offset) bên trong đối tượng. Khi gán ngược thứ tự, V8 phải rẽ sang nhánh Map mới vì ở đối tượng một thì id nằm tại Offset 0, còn ở đối tượng hai thì code mới nằm tại Offset 0, dẫn đến phá vỡ trạng thái Monomorphic Inline Cache.'
    },
    {
      id: 'c1-l2-q4',
      question: 'Việc sử dụng toán tử delete obj.property trong JavaScript gây ra hậu quả kiến trúc nào đối với các đối tượng cần xử lý với tần suất cao trên V8 Engine?',
      options: [
        'Nó tạo ra các lỗ hổng bộ nhớ phân mảnh cục bộ trên phân vùng Young Generation khiến thuật toán sao chép Cheney Scavenge của Minor GC bị rơi vào vòng lặp kiểm tra vô tận.',
        'Nó chỉ xóa giá trị của thuộc tính nhưng vẫn giữ nguyên khóa định danh trong bảng băm toàn cục của V8, gây ra hiện tượng rò rỉ bộ nhớ vĩnh viễn trên phân vùng Old Generation.',
        'Nó kích hoạt một chu kỳ thu gom rác Major GC đồng bộ làm tạm dừng toàn bộ luồng thực thi chính (Stop-The-World) để sắp xếp và dồn nén lại cấu trúc bộ nhớ của đối tượng.',
        'Nó bẻ gãy liên kết trên Transition Tree và giáng cấp đối tượng từ Fast Properties xuống Dictionary Mode (Slow Properties), biến việc đọc thuộc tính thành tra cứu bảng băm.'
      ],
      correctIndex: 3,
      explanation: 'Để tránh làm phình cây chuyển đổi Hidden Class với vô số tổ hợp xóa ngẫu nhiên, khi gặp lệnh delete obj.prop, V8 sẽ hủy bỏ cấu trúc mảng thuộc tính tuyến tính (Fast Properties) và chuyển đối tượng sang chế độ từ điển bảng băm (Dictionary Mode). Khi đó, mỗi lần đọc thuộc tính trên đối tượng phải thực hiện thuật toán băm khóa tốn từ 50 đến 150 chu kỳ CPU thay vì 1-2 chu kỳ đọc Offset.'
    },
    {
      id: 'c1-l2-q5',
      question: 'Điều gì xảy ra ở cấp độ cơ chế Inline Caching (IC) khi một vị trí truy xuất thuộc tính (Call Site) bắt gặp nhiều hơn 4 cấu trúc Hidden Class (Maps) khác nhau?',
      options: [
        'Điểm gọi hàm chuyển sang trạng thái Megamorphic (vượt ngưỡng 4 Maps), từ bỏ bộ đệm cục bộ tại điểm gọi và phải tra cứu qua Megamorphic Stub Cache toàn cục với chi phí cao.',
        'V8 tự động giáng cấp toàn bộ các đối tượng tham gia lời gọi hàm về lại phân vùng Young Generation để bộ thu gom rác Minor GC dọn dẹp và chuẩn hóa lại cấu trúc thuộc tính.',
        'Trình biên dịch TurboFan xóa bỏ hoàn toàn mảng mã Bytecode của hàm hiện tại trên vùng nhớ Code Space và chuyển về thông dịch trực tiếp từ cây cú pháp trừu tượng (AST) ban đầu.',
        'V8 tự động hợp nhất các nhánh Hidden Class đó thành một lớp cơ sở ảo (Virtual Superclass) duy nhất và lưu bảng con trỏ phương thức ảo vào các thanh ghi vector SIMD của CPU.'
      ],
      correctIndex: 0,
      explanation: 'Trong V8 Engine, trạng thái Polymorphic Inline Cache chỉ lưu trữ tối đa 4 địa chỉ Map khác nhau để kiểm tra nhánh tuyến tính. Ngay khi gặp cấu trúc Map thứ 5 trở lên, điểm gọi hàm bị chuyển sang trạng thái Megamorphic: V8 ngừng lưu cache cục bộ tại lệnh đó, hủy khả năng nội tuyến hóa của TurboFan và chuyển sang tra cứu trên Megamorphic Stub Cache toàn cục hoặc gọi hàm C++ Runtime.'
    },
    {
      id: 'c1-l2-q6',
      question: 'Tại sao việc khởi tạo Mảng thưa (Holey Array, chẳng hạn dùng new Array(1000) hoặc gán nhảy cóc arr[50] = 1) lại làm sụt giảm tốc độ truy xuất của V8 so với Mảng đặc (Packed Array)?',
      options: [
        'Vì V8 bắt buộc phải cấp phát toàn bộ mảng đó trên phân vùng Large Object Space của Heap và khóa vùng nhớ bằng cơ chế đồng bộ hóa Mutex ở tầng nhân hệ điều hành Linux.',
        'Vì V8 tự động chuyển đổi cấu trúc lưu trữ của mảng sang định dạng ma trận thưa nén (Compressed Sparse Row), đòi hỏi CPU phải giải nén lại mỗi khi thực hiện vòng lặp duyệt mảng.',
        'Vì mảng bị gắn nhãn HOLEY_ELEMENTS vĩnh viễn; khi gặp ô trống (the_hole), V8 không trả về kết quả ngay mà phải duyệt ngược lên chuỗi Array.prototype và Object.prototype.',
        'Vì các lỗ thủng bên trong mảng thưa liên tục kích hoạt pha dồn nén Compacting của bộ thu gom rác Major GC sau mỗi lần đọc phần tử nhằm dồn các ô nhớ hợp lệ về đầu mảng.'
      ],
      correctIndex: 2,
      explanation: 'Trên mảng đặc (PACKED_SMI / PACKED_DOUBLE), V8 biết chắc mọi chỉ mục hợp lệ từ 0 đến length - 1 đều có giá trị thực nên đọc thẳng ô nhớ trong 1 lệnh máy. Ngược lại, trên mảng thưa (HOLEY_*), nếu gặp giá trị nội bộ the_hole, đặc tả ECMAScript buộc V8 phải tra cứu ngược lên Array.prototype và Object.prototype để kiểm tra xem có thuộc tính nào được định nghĩa trên nguyên mẫu hay không. Hơn nữa, mảng đã chuyển sang HOLEY sẽ không bao giờ quay lại PACKED được.'
    },
    {
      id: 'c1-l2-q7',
      question: 'Khi chạy tiến trình Node.js với cờ chẩn đoán --trace-deopt, nếu nhật ký xuất hiện dòng cảnh báo bailout với lý do "wrong map" hoặc "not a Smi", nguyên nhân kỹ thuật gốc rễ là gì?',
      options: [
        'Các tệp tin ánh xạ mã nguồn Source Map (.js.map) do trình biên dịch TypeScript sinh ra bị lệch chỉ mục dòng lệnh so với các tệp tin thực thi JavaScript trong thư mục dist/.',
        'Hàm đã được TurboFan tối ưu hóa nhưng lúc chạy lại nhận đối tượng có Hidden Class khác biệt ("wrong map") hoặc nhận chuỗi/số thực tại vị trí kỳ vọng số nguyên 31-bit ("not a Smi").',
        'Vùng không gian địa chỉ bộ nhớ ảo được cấp phát bằng lời gọi hệ thống mmap() trên nhân hệ điều hành Linux đã chạm ngưỡng giới hạn trang nhớ tối đa của tiến trình trong container.',
        'Bể luồng Libuv Threadpool đã sử dụng hết toàn bộ 4 luồng xử lý I/O mặc định khiến các gói kết quả trả về cho hàng đợi sự kiện Event Loop bị đảo lộn thứ tự thời gian thực thi.'
      ],
      correctIndex: 1,
      explanation: 'Trong nhật ký của --trace-deopt, thuật ngữ "map" chính là tên nội bộ trong mã nguồn C++ của V8 dành cho Hidden Class (Shape), còn "Smi" là Small Integer 31-bit. Lỗi "wrong map" báo hiệu đối tượng truyền vào điểm gọi có cấu trúc thuộc tính không khớp với Map đã được biên dịch trong mã máy, còn "not a Smi" báo hiệu biến số nguyên bị truyền nhầm kiểu dữ liệu khác (như string hoặc số thập phân).'
    },
    {
      id: 'c1-l2-q8',
      question: 'Dựa trên mẫu thiết kế Production trong lớp MedicalRecordEntity (realCodeSnippet), quy tắc nào cần được áp dụng khi xây dựng các thực thể hoặc DTO xử lý dữ liệu hàng loạt trong NestJS?',
      options: [
        'Khởi tạo một đối tượng literal rỗng {} rồi chỉ gắn thêm các trường dữ liệu khác null bằng các câu lệnh điều kiện if/else nhằm tiết kiệm số lượng thuộc tính trên mỗi bản ghi.',
        'Sử dụng toán tử delete để gỡ bỏ trực tiếp các trường dữ liệu dư thừa hoặc trường nhạy cảm ngay trên đối tượng thực thể lấy từ cơ sở dữ liệu trước khi tuần tự hóa sang JSON.',
        'Chuyển đổi từng đối tượng qua hàm JSON.stringify rồi lập tức gọi JSON.parse ngay bên trong vòng lặp xử lý nhằm ép V8 Engine làm mới lại cấu trúc vùng nhớ Young Generation.',
        'Khởi tạo đủ mọi thuộc tính theo thứ tự cố định trong constructor, gán null tường minh cho trường tùy chọn thay vì bỏ trống, và dùng mảng định kiểu cho phép tính số học lớn.'
      ],
      correctIndex: 3,
      explanation: 'Như đã triển khai trong MedicalRecordEntity và MonomorphicRecordPipelineService, việc khởi tạo đầy đủ mọi thuộc tính theo đúng thứ tự cố định trong constructor (kể cả các trường tùy chọn gán bằng null) đảm bảo 100% các bản ghi dùng chung một Hidden Class (Map) duy nhất. Kết hợp với việc thêm phần tử tuần tự vào mảng PACKED và dùng Float64Array cho tính toán số thực giúp giữ vững mã máy tối ưu của TurboFan.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Phân Loại Trạng Thái Inline Cache & Ước Lượng Độ Trễ Truy Xuất',
    description: 'Trong V8 Engine, tốc độ truy xuất thuộc tính tại một điểm gọi hàm (Call Site) phụ thuộc trực tiếp vào số lượng cấu trúc Lớp ẩn (`uniqueShapesCount`) đi qua điểm gọi đó và việc đối tượng có bị xóa thuộc tính bằng toán tử `delete` (`hasDeleteOperator`) hay không. Hãy viết hàm `evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses)` để phân loại trạng thái `icState`, xác định chi phí thời gian mỗi lần truy xuất `nsPerAccess` (tính bằng nanosecond), và tính tổng thời gian thực thi `estimatedTimeMs` (tính bằng mili-giây, làm tròn 2 chữ số thập phân) theo quy tắc:\n- Nếu `hasDeleteOperator === true`: đối tượng rơi vào chế độ từ điển băm -> `icState = "DICTIONARY_MODE"`, `nsPerAccess = 45`.\n- Ngược lại, nếu `uniqueShapesCount === 1`: -> `icState = "MONOMORPHIC"`, `nsPerAccess = 2`.\n- Ngược lại, nếu `uniqueShapesCount >= 2 && uniqueShapesCount <= 4`: -> `icState = "POLYMORPHIC"`, `nsPerAccess = 8`.\n- Ngược lại (`uniqueShapesCount > 4`): -> `icState = "MEGAMORPHIC"`, `nsPerAccess = 30`.\nCông thức đổi sang mili-giây (`1 ms = 1,000,000 ns`): `estimatedTimeMs = (totalAccesses * nsPerAccess) / 1000000` (làm tròn 2 chữ số thập phân).',
    guidedSteps: [
      'Bước 1 (Xác định trạng thái icState và nsPerAccess): Dùng cấu trúc `if / else if / else` kiểm tra `hasDeleteOperator === true` trước tiên (`"DICTIONARY_MODE"`, `45`), sau đó kiểm tra `uniqueShapesCount === 1` (`"MONOMORPHIC"`, `2`), `uniqueShapesCount <= 4` (`"POLYMORPHIC"`, `8`), và trường hợp còn lại (`"MEGAMORPHIC"`, `30`).',
      'Bước 2 (Tính tổng thời gian theo nanosecond): Nhân tổng số lượt truy xuất `totalAccesses` với `nsPerAccess` vừa tìm được ở Bước 1.',
      'Bước 3 (Quy đổi sang mili-giây và làm tròn): Chia tổng nanosecond cho `1000000` (`1e6`), sau đó làm tròn 2 chữ số thập phân bằng công thức `Math.round(val * 100) / 100` để lưu vào biến `estimatedTimeMs`.',
      'Bước 4 (Đóng gói kết quả): Trả về object `{ icState, nsPerAccess, estimatedTimeMs }` đúng tên thuộc tính như đặc tả.'
    ],
    hints: [
      'Lưu ý thứ tự ưu tiên: Ngay cả khi `uniqueShapesCount === 1`, nếu `hasDeleteOperator === true` thì lệnh `delete` vẫn bẻ gãy Hidden Class và đẩy thẳng đối tượng về `"DICTIONARY_MODE"` (`nsPerAccess = 45`). Vì vậy hãy kiểm tra `hasDeleteOperator` ở nhánh `if` đầu tiên.',
      'Quy đổi đơn vị: `1 mili-giây (ms) = 1,000,000 nanosecond (ns)`. Ví dụ với `10,000,000` lượt truy xuất ở chế độ Monomorphic (`2 ns/lần`): `(10000000 * 2) / 1000000 = 20 ms`.'
    ],
    starterCode: `function evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses) {
  // Bước 1: Xác định icState và nsPerAccess theo thứ tự ưu tiên (hasDeleteOperator -> 1 Shape -> 2..4 Shapes -> >4 Shapes)
  
  // Bước 2 & 3: Tính estimatedTimeMs = (totalAccesses * nsPerAccess) / 1000000 và làm tròn 2 chữ số thập phân
  
  // Bước 4: Trả về { icState, nsPerAccess, estimatedTimeMs }
}`,
    solution: `function evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses) {
  let icState = 'MEGAMORPHIC';
  let nsPerAccess = 30;

  if (hasDeleteOperator === true) {
icState = 'DICTIONARY_MODE';
nsPerAccess = 45;
  } else if (uniqueShapesCount === 1) {
icState = 'MONOMORPHIC';
nsPerAccess = 2;
  } else if (uniqueShapesCount >= 2 && uniqueShapesCount <= 4) {
icState = 'POLYMORPHIC';
nsPerAccess = 8;
  }

  const rawMs = (totalAccesses * nsPerAccess) / 1000000;
  const estimatedTimeMs = Math.round(rawMs * 100) / 100;

  return {
icState,
nsPerAccess,
estimatedTimeMs
  };
}`,
    testCases: [
      {
        name: 'Trạng thái MONOMORPHIC chuẩn (1 Shape, không dùng delete, 10 triệu lượt đọc -> 20ms)',
        input: [1, false, 10000000],
        expected: { icState: 'MONOMORPHIC', nsPerAccess: 2, estimatedTimeMs: 20 },
        hidden: false
      },
      {
        name: 'Trạng thái POLYMORPHIC (3 Shapes, không dùng delete, 5 triệu lượt đọc -> 40ms)',
        input: [3, false, 5000000],
        expected: { icState: 'POLYMORPHIC', nsPerAccess: 8, estimatedTimeMs: 40 },
        hidden: false
      },
      {
        name: 'Trạng thái DICTIONARY_MODE do dùng lệnh delete (dù chỉ 1 Shape, 10 triệu lượt -> 450ms)',
        input: [1, true, 10000000],
        expected: { icState: 'DICTIONARY_MODE', nsPerAccess: 45, estimatedTimeMs: 450 },
        hidden: false
      },
      {
        name: 'Biên chạm ngưỡng tối đa của Polymorphic (4 Shapes, 2.5 triệu lượt đọc -> 20ms)',
        input: [4, false, 2500000],
        expected: { icState: 'POLYMORPHIC', nsPerAccess: 8, estimatedTimeMs: 20 },
        hidden: true
      },
      {
        name: 'Vượt ngưỡng sang MEGAMORPHIC (5 Shapes, 1.25 triệu lượt đọc -> 37.5ms)',
        input: [5, false, 1250000],
        expected: { icState: 'MEGAMORPHIC', nsPerAccess: 30, estimatedTimeMs: 37.5 },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Phân Loại Trạng Thái Inline Cache & Ước Lượng Độ Trễ Truy Xuất',
      description: 'Trong V8 Engine, tốc độ truy xuất thuộc tính tại một điểm gọi hàm (Call Site) phụ thuộc trực tiếp vào số lượng cấu trúc Lớp ẩn (`uniqueShapesCount`) đi qua điểm gọi đó và việc đối tượng có bị xóa thuộc tính bằng toán tử `delete` (`hasDeleteOperator`) hay không. Hãy viết hàm `evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses)` để phân loại trạng thái `icState`, xác định chi phí thời gian mỗi lần truy xuất `nsPerAccess` (tính bằng nanosecond), và tính tổng thời gian thực thi `estimatedTimeMs` (tính bằng mili-giây, làm tròn 2 chữ số thập phân) theo quy tắc:\n- Nếu `hasDeleteOperator === true`: đối tượng rơi vào chế độ từ điển băm -> `icState = "DICTIONARY_MODE"`, `nsPerAccess = 45`.\n- Ngược lại, nếu `uniqueShapesCount === 1`: -> `icState = "MONOMORPHIC"`, `nsPerAccess = 2`.\n- Ngược lại, nếu `uniqueShapesCount >= 2 && uniqueShapesCount <= 4`: -> `icState = "POLYMORPHIC"`, `nsPerAccess = 8`.\n- Ngược lại (`uniqueShapesCount > 4`): -> `icState = "MEGAMORPHIC"`, `nsPerAccess = 30`.\nCông thức đổi sang mili-giây (`1 ms = 1,000,000 ns`): `estimatedTimeMs = (totalAccesses * nsPerAccess) / 1000000` (làm tròn 2 chữ số thập phân).',
      guidedSteps: [
        'Bước 1 (Xác định trạng thái icState và nsPerAccess): Dùng cấu trúc `if / else if / else` kiểm tra `hasDeleteOperator === true` trước tiên (`"DICTIONARY_MODE"`, `45`), sau đó kiểm tra `uniqueShapesCount === 1` (`"MONOMORPHIC"`, `2`), `uniqueShapesCount <= 4` (`"POLYMORPHIC"`, `8`), và trường hợp còn lại (`"MEGAMORPHIC"`, `30`).',
        'Bước 2 (Tính tổng thời gian theo nanosecond): Nhân tổng số lượt truy xuất `totalAccesses` với `nsPerAccess` vừa tìm được ở Bước 1.',
        'Bước 3 (Quy đổi sang mili-giây và làm tròn): Chia tổng nanosecond cho `1000000` (`1e6`), sau đó làm tròn 2 chữ số thập phân bằng công thức `Math.round(val * 100) / 100` để lưu vào biến `estimatedTimeMs`.',
        'Bước 4 (Đóng gói kết quả): Trả về object `{ icState, nsPerAccess, estimatedTimeMs }` đúng tên thuộc tính như đặc tả.'
      ],
      hints: [
        'Lưu ý thứ tự ưu tiên: Ngay cả khi `uniqueShapesCount === 1`, nếu `hasDeleteOperator === true` thì lệnh `delete` vẫn bẻ gãy Hidden Class và đẩy thẳng đối tượng về `"DICTIONARY_MODE"` (`nsPerAccess = 45`). Vì vậy hãy kiểm tra `hasDeleteOperator` ở nhánh `if` đầu tiên.',
        'Quy đổi đơn vị: `1 mili-giây (ms) = 1,000,000 nanosecond (ns)`. Ví dụ với `10,000,000` lượt truy xuất ở chế độ Monomorphic (`2 ns/lần`): `(10000000 * 2) / 1000000 = 20 ms`.'
      ],
      starterCode: `function evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses) {
  // Bước 1: Xác định icState và nsPerAccess theo thứ tự ưu tiên (hasDeleteOperator -> 1 Shape -> 2..4 Shapes -> >4 Shapes)
  
  // Bước 2 & 3: Tính estimatedTimeMs = (totalAccesses * nsPerAccess) / 1000000 và làm tròn 2 chữ số thập phân
  
  // Bước 4: Trả về { icState, nsPerAccess, estimatedTimeMs }
}`,
      solution: `function evaluateInlineCacheState(uniqueShapesCount, hasDeleteOperator, totalAccesses) {
  let icState = 'MEGAMORPHIC';
  let nsPerAccess = 30;

  if (hasDeleteOperator === true) {
icState = 'DICTIONARY_MODE';
nsPerAccess = 45;
  } else if (uniqueShapesCount === 1) {
icState = 'MONOMORPHIC';
nsPerAccess = 2;
  } else if (uniqueShapesCount >= 2 && uniqueShapesCount <= 4) {
icState = 'POLYMORPHIC';
nsPerAccess = 8;
  }

  const rawMs = (totalAccesses * nsPerAccess) / 1000000;
  const estimatedTimeMs = Math.round(rawMs * 100) / 100;

  return {
icState,
nsPerAccess,
estimatedTimeMs
  };
}`,
      testCases: [
        {
          name: 'Trạng thái MONOMORPHIC chuẩn (1 Shape, không dùng delete, 10 triệu lượt đọc -> 20ms)',
          input: [1, false, 10000000],
          expected: { icState: 'MONOMORPHIC', nsPerAccess: 2, estimatedTimeMs: 20 },
          hidden: false
        },
        {
          name: 'Trạng thái POLYMORPHIC (3 Shapes, không dùng delete, 5 triệu lượt đọc -> 40ms)',
          input: [3, false, 5000000],
          expected: { icState: 'POLYMORPHIC', nsPerAccess: 8, estimatedTimeMs: 40 },
          hidden: false
        },
        {
          name: 'Trạng thái DICTIONARY_MODE do dùng lệnh delete (dù chỉ 1 Shape, 10 triệu lượt -> 450ms)',
          input: [1, true, 10000000],
          expected: { icState: 'DICTIONARY_MODE', nsPerAccess: 45, estimatedTimeMs: 450 },
          hidden: false
        },
        {
          name: 'Biên chạm ngưỡng tối đa của Polymorphic (4 Shapes, 2.5 triệu lượt đọc -> 20ms)',
          input: [4, false, 2500000],
          expected: { icState: 'POLYMORPHIC', nsPerAccess: 8, estimatedTimeMs: 20 },
          hidden: true
        },
        {
          name: 'Vượt ngưỡng sang MEGAMORPHIC (5 Shapes, 1.25 triệu lượt đọc -> 37.5ms)',
          input: [5, false, 1250000],
          expected: { icState: 'MEGAMORPHIC', nsPerAccess: 30, estimatedTimeMs: 37.5 },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Lưới Phân Loại Mảng V8 (Elements Kinds Lattice Analyzer)',
      description: 'Áp dụng quy tắc **Lưới phân loại phần tử mảng (V8 Elements Kinds Lattice)** đã học ở Phần 2. Viết hàm `analyzeArrayElementsKind(elements, allocatedLength)` nhận vào mảng các phần tử thực tế `elements` và độ dài cấp phát của mảng `allocatedLength` (`allocatedLength >= elements.length`). Hãy xác định cấu trúc nội bộ của mảng qua 4 bước:\n1. Kiểm tra mảng thưa (`isHoley`): Đặt `isHoley = true` nếu `allocatedLength > elements.length` (do khởi tạo `new Array(N)` dư chỗ trống) hoặc trong mảng `elements` có phần tử nào bằng `null` hay `undefined`; ngược lại `isHoley = false`.\n2. Xác định kiểu phần tử cơ sở (`baseKind`) dựa trên các phần tử khác `null`/`undefined` trong `elements`:\n   - Nếu mảng có ít nhất 1 phần tử hợp lệ và TẤT CẢ đều là kiểu `"number"` đồng thời là số nguyên (`Number.isInteger(x)`): `baseKind = "SMI_ELEMENTS"`.\n   - Ngược lại, nếu mảng có ít nhất 1 phần tử hợp lệ và TẤT CẢ đều là kiểu `"number"` (có chứa số thực thập phân): `baseKind = "DOUBLE_ELEMENTS"`.\n   - Ngược lại (chứa chuỗi, boolean, object... hoặc không có phần tử hợp lệ nào): `baseKind = "ELEMENTS"`.\n3. Ghép tiền tố `"HOLEY_"` (nếu `isHoley === true`) hoặc `"PACKED_"` (nếu `isHoley === false`) với `baseKind` để tạo thành `elementsKind`.\n4. Đặt `requiresPrototypeWalk = isHoley`, và tính hệ số phạt truy xuất `lookupPenaltyFactor`: bằng `6.5` nếu `isHoley === true`; ngược lại bằng `2.5` nếu `elementsKind === "PACKED_ELEMENTS"`; còn lại (`PACKED_SMI_ELEMENTS` hoặc `PACKED_DOUBLE_ELEMENTS`) bằng `1`. Trả về `{ elementsKind, isHoley, requiresPrototypeWalk, lookupPenaltyFactor }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra lỗ thủng isHoley): Kiểm tra xem `allocatedLength > elements.length` hay trong `elements` có phần tử nào `x === null || x === undefined` hay không (`elements.some(...)`). Nếu có thì `isHoley = true`, ngược lại `false`.',
        'Bước 2 (Phân loại kiểu cơ sở baseKind): Lọc ra mảng các phần tử hợp lệ `validItems = elements.filter((x) => x !== null && x !== undefined)`. Nếu `validItems.length > 0` và mọi phần tử đều thỏa `typeof x === "number" && Number.isInteger(x)` thì `baseKind = "SMI_ELEMENTS"`; ngược lại nếu mọi phần tử đều thỏa `typeof x === "number"` thì `baseKind = "DOUBLE_ELEMENTS"`; còn lại `baseKind = "ELEMENTS"`.',
        'Bước 3 (Ghép chuỗi elementsKind và cờ requiresPrototypeWalk): Đặt `elementsKind = (isHoley ? "HOLEY_" : "PACKED_") + baseKind` và `requiresPrototypeWalk = isHoley`.',
        'Bước 4 (Xác định hệ số phạt lookupPenaltyFactor): Nếu `isHoley` là `true` thì `lookupPenaltyFactor = 6.5`; ngược lại nếu `baseKind === "ELEMENTS"` thì `lookupPenaltyFactor = 2.5`; còn lại `lookupPenaltyFactor = 1`. Trả về object kết quả.'
      ],
      hints: [
        'Hãy dùng phương thức `validItems.every((x) => typeof x === "number" && Number.isInteger(x))` để kiểm tra toàn bộ mảng số nguyên `Smi`, nhưng nhớ kiểm tra `validItems.length > 0` trước vì `[].every(...)` trong JavaScript mặc định trả về `true`.',
        'Khi một mảng chứa toàn số nguyên `[10, 20]` nhưng được cấp phát với `allocatedLength = 5` (tương đương `const a = new Array(5); a[0] = 10; a[1] = 20;`), thì `isHoley = true` và `baseKind = "SMI_ELEMENTS"` -> kết quả là `"HOLEY_SMI_ELEMENTS"`.'
      ],
      starterCode: `function analyzeArrayElementsKind(elements, allocatedLength) {
  // Bước 1: Xác định isHoley (allocatedLength > elements.length hoặc có phần tử null/undefined)
  
  // Bước 2: Lọc validItems và xác định baseKind ("SMI_ELEMENTS" | "DOUBLE_ELEMENTS" | "ELEMENTS")
  
  // Bước 3: Ghép tiền tố PACKED_ / HOLEY_ thành elementsKind và gán requiresPrototypeWalk = isHoley
  
  // Bước 4: Tính lookupPenaltyFactor (6.5 nếu isHoley, 2.5 nếu PACKED_ELEMENTS, 1 nếu PACKED số) và trả về kết quả
}`,
      solution: `function analyzeArrayElementsKind(elements, allocatedLength) {
  const hasEmptySlot = elements.some((x) => x === null || x === undefined);
  const isHoley = allocatedLength > elements.length || hasEmptySlot;

  const validItems = elements.filter((x) => x !== null && x !== undefined);
  let baseKind = 'ELEMENTS';

  if (
validItems.length > 0 &&
validItems.every((x) => typeof x === 'number' && Number.isInteger(x))
  ) {
baseKind = 'SMI_ELEMENTS';
  } else if (
validItems.length > 0 &&
validItems.every((x) => typeof x === 'number')
  ) {
baseKind = 'DOUBLE_ELEMENTS';
  }

  const elementsKind = (isHoley ? 'HOLEY_' : 'PACKED_') + baseKind;
  const requiresPrototypeWalk = isHoley;

  let lookupPenaltyFactor = 1;
  if (isHoley) {
lookupPenaltyFactor = 6.5;
  } else if (baseKind === 'ELEMENTS') {
lookupPenaltyFactor = 2.5;
  }

  return {
elementsKind,
isHoley,
requiresPrototypeWalk,
lookupPenaltyFactor
  };
}`,
      testCases: [
        {
          name: 'Mảng số nguyên liên tục tối ưu nhất -> PACKED_SMI_ELEMENTS',
          input: [[10, 20, 30, 40], 4],
          expected: {
            elementsKind: 'PACKED_SMI_ELEMENTS',
            isHoley: false,
            requiresPrototypeWalk: false,
            lookupPenaltyFactor: 1
          },
          hidden: false
        },
        {
          name: 'Mảng có chứa số thực dấu phẩy động -> Nâng cấp lên PACKED_DOUBLE_ELEMENTS',
          input: [[10, 25.5, 30], 3],
          expected: {
            elementsKind: 'PACKED_DOUBLE_ELEMENTS',
            isHoley: false,
            requiresPrototypeWalk: false,
            lookupPenaltyFactor: 1
          },
          hidden: false
        },
        {
          name: 'Mảng khởi tạo dư kích thước new Array(10) -> Bị gắn nhãn HOLEY_SMI_ELEMENTS',
          input: [[1, 2, 3], 10],
          expected: {
            elementsKind: 'HOLEY_SMI_ELEMENTS',
            isHoley: true,
            requiresPrototypeWalk: true,
            lookupPenaltyFactor: 6.5
          },
          hidden: false
        },
        {
          name: 'Mảng đặc nhưng pha trộn chuỗi ký tự -> Giáng cấp xuống PACKED_ELEMENTS',
          input: [[10, 20, '30'], 3],
          expected: {
            elementsKind: 'PACKED_ELEMENTS',
            isHoley: false,
            requiresPrototypeWalk: false,
            lookupPenaltyFactor: 2.5
          },
          hidden: true
        },
        {
          name: 'Mảng có phần tử trống null ở giữa kèm chuỗi -> HOLEY_ELEMENTS',
          input: [['A', null, 'B'], 3],
          expected: {
            elementsKind: 'HOLEY_ELEMENTS',
            isHoley: true,
            requiresPrototypeWalk: true,
            lookupPenaltyFactor: 6.5
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Bộ Chuẩn Hóa Bản Ghi Đơn Hình (Monomorphic Batch Normalizer & IC Guard)',
      description: 'Kết hợp kỹ thuật thiết kế **Monomorphic Object Pipeline** từ `realCodeSnippet` và **Lập trình phòng thủ (Defensive Guard)**. Viết hàm `normalizeMonomorphicBatch(rawRecords)` nhận vào một mảng các bản ghi dữ liệu thô `rawRecords` có thứ tự thuộc tính lộn xộn để chuẩn hóa thành mảng các đối tượng có cùng cấu trúc Lớp ẩn (Hidden Class Shape) tuyệt đối:\n1. **Kiểm tra hợp lệ đầu vào (Defensive Guard):** Nếu `!Array.isArray(rawRecords)` hoặc `rawRecords.length === 0`, hoặc có bất kỳ phần tử `item` nào trong mảng không phải plain object (`!item || typeof item !== "object" || Array.isArray(item)`), hoặc `typeof item.id !== "number" || !Number.isFinite(item.id) || item.id <= 0`, hoặc `typeof item.code !== "string" || item.code.trim().length === 0`, phải lập tức ném lỗi `throw new Error("INVALID_BATCH_PAYLOAD")`.\n2. **Đo lường độ phân mảnh Shape đầu vào (`inputShapesCount`):** Với mỗi phần tử `item`, tạo chữ ký thứ tự thuộc tính bằng `Object.keys(item).join(",")`. Đếm số lượng chữ ký phân biệt xuất hiện trong toàn bộ mảng `rawRecords` (dùng `new Set()`).\n3. **Chuẩn hóa bản ghi đơn hình (`records`):** Biến đổi từng `item` thành object mới có **đúng 4 thuộc tính theo thứ tự cố định**:\n   - `id`: `Math.trunc(item.id)`\n   - `code`: `item.code.trim().toUpperCase()`\n   - `amount`: Nếu `typeof item.amount === "number" && Number.isFinite(item.amount)` thì làm tròn 2 chữ số thập phân `Math.round(item.amount * 100) / 100`, ngược lại gán `0`.\n   - `archivedAt`: Nếu `typeof item.archivedAt === "string" && item.archivedAt.trim().length > 0` thì lấy `item.archivedAt.trim()`, ngược lại gán `null`.\n4. Trả về `{ inputShapesCount, outputShapesCount: 1, wasPolymorphicInput: inputShapesCount > 1, records }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra mảng đầu vào): Nếu `!Array.isArray(rawRecords) || rawRecords.length === 0` thì lập tức `throw new Error("INVALID_BATCH_PAYLOAD")`. Khởi tạo `const shapeSet = new Set()` và mảng kết quả `const records = []`.',
        'Bước 2 (Kiểm tra từng phần tử trong vòng lặp): Duyệt qua từng `item` của `rawRecords`. Nếu `!item || typeof item !== "object" || Array.isArray(item)` hoặc `typeof item.id !== "number" || !Number.isFinite(item.id) || item.id <= 0` hoặc `typeof item.code !== "string" || item.code.trim().length === 0` thì `throw new Error("INVALID_BATCH_PAYLOAD")`.',
        'Bước 3 (Ghi nhận Shape đầu vào và chuẩn hóa đối tượng): Thêm `Object.keys(item).join(",")` vào `shapeSet`. Tạo object mới với đúng 4 key theo thứ tự `{ id, code, amount, archivedAt }` như quy tắc đề bài rồi `.push()` vào `records`.',
        'Bước 4 (Tổng hợp kết quả): Lấy `inputShapesCount = shapeSet.size`, đặt `outputShapesCount = 1`, `wasPolymorphicInput = inputShapesCount > 1`, và trả về `{ inputShapesCount, outputShapesCount, wasPolymorphicInput, records }`.'
      ],
      hints: [
        'Thứ tự xuất hiện của các key trong `Object.keys(item)` phản ánh chính xác thứ tự gán thuộc tính trên nhánh Transition Tree của V8. Ví dụ `{ id: 1, code: "a" }` có chữ ký `"id,code"`, khác với `{ code: "a", id: 1 }` có chữ ký `"code,id"`.',
        'Để kiểm tra một biến là plain object (không phải `null` và không phải `Array`), điều kiện đầy đủ trong JavaScript là: `Boolean(item) && typeof item === "object" && !Array.isArray(item)`.'
      ],
      starterCode: `function normalizeMonomorphicBatch(rawRecords) {
  // Bước 1: Kiểm tra mảng rawRecords hợp lệ và khác rỗng (ném Error("INVALID_BATCH_PAYLOAD") nếu sai)
  
  // Bước 2 & 3: Duyệt từng phần tử, kiểm tra id/code, thu thập chữ ký Object.keys(item).join(",") vào Set
  //            và đẩy bản ghi chuẩn hóa { id, code, amount, archivedAt } vào mảng records
  
  // Bước 4: Trả về { inputShapesCount, outputShapesCount: 1, wasPolymorphicInput, records }
}`,
      solution: `function normalizeMonomorphicBatch(rawRecords) {
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
throw new Error("INVALID_BATCH_PAYLOAD");
  }

  const shapeSet = new Set();
  const records = [];

  for (let i = 0; i < rawRecords.length; i++) {
const item = rawRecords[i];
if (!item || typeof item !== 'object' || Array.isArray(item)) {
  throw new Error("INVALID_BATCH_PAYLOAD");
}
if (
  typeof item.id !== 'number' ||
  !Number.isFinite(item.id) ||
  item.id <= 0 ||
  typeof item.code !== 'string' ||
  item.code.trim().length === 0
) {
  throw new Error("INVALID_BATCH_PAYLOAD");
}

shapeSet.add(Object.keys(item).join(','));

const safeAmount =
  typeof item.amount === 'number' && Number.isFinite(item.amount)
    ? Math.round(item.amount * 100) / 100
    : 0;
const safeArchivedAt =
  typeof item.archivedAt === 'string' && item.archivedAt.trim().length > 0
    ? item.archivedAt.trim()
    : null;

records.push({
  id: Math.trunc(item.id),
  code: item.code.trim().toUpperCase(),
  amount: safeAmount,
  archivedAt: safeArchivedAt
});
  }

  const inputShapesCount = shapeSet.size;

  return {
inputShapesCount,
outputShapesCount: 1,
wasPolymorphicInput: inputShapesCount > 1,
records
  };
}`,
      testCases: [
        {
          name: 'Chuẩn hóa lô 2 bản ghi bị ngược thứ tự thuộc tính và thiếu trường tùy chọn (2 Shapes -> 1 Shape)',
          input: [
            [
              { id: 101, code: ' inv-01 ', amount: 150.556 },
              { code: 'inv-02', id: 102, archivedAt: '2026-10-14' }
            ]
          ],
          expected: {
            inputShapesCount: 2,
            outputShapesCount: 1,
            wasPolymorphicInput: true,
            records: [
              { id: 101, code: 'INV-01', amount: 150.56, archivedAt: null },
              { id: 102, code: 'INV-02', amount: 0, archivedAt: '2026-10-14' }
            ]
          },
          hidden: false
        },
        {
          name: 'Lô dữ liệu đầu vào đã đồng nhất sẵn 1 Shape -> wasPolymorphicInput = false',
          input: [
            [
              { id: 1, code: 'med-a', amount: 20, archivedAt: null },
              { id: 2, code: 'med-b', amount: 40, archivedAt: '2026-01-01' }
            ]
          ],
          expected: {
            inputShapesCount: 1,
            outputShapesCount: 1,
            wasPolymorphicInput: false,
            records: [
              { id: 1, code: 'MED-A', amount: 20, archivedAt: null },
              { id: 2, code: 'MED-B', amount: 40, archivedAt: '2026-01-01' }
            ]
          },
          hidden: false
        },
        {
          name: 'Bản ghi có id không phải số dương -> Ném lỗi INVALID_BATCH_PAYLOAD',
          input: [[{ id: 0, code: 'INV-01' }]],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Truyền mảng rỗng [] hoặc null -> Ném lỗi INVALID_BATCH_PAYLOAD',
          input: [[]],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Bản ghi có code chỉ chứa khoảng trắng -> Ném lỗi INVALID_BATCH_PAYLOAD',
          input: [[{ id: 10, code: '   ' }]],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
