import type { Lesson } from '../types.ts';

export const c1_l3: Lesson = {
  id: 'c1-l3',
  title: 'Bài 03: V8 Garbage Collection Internals, Dominator Tree & Quản Trị Memory Leak Thực Chiến',
  duration: '60 phút',
  tag: 'Garbage Collection & Profiling',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Quản trị Bộ nhớ Tự động (Automated Memory Management) và Kỹ thuật Chẩn đoán Rò rỉ Bộ nhớ (Memory Leak Forensics) từ cấp độ thuật toán thu gom rác của V8 Engine đến môi trường vận hành Container cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Kiến trúc bộ nhớ phân tầng Orinoco GC và Thuật toán Thu gom rác đa thế hệ:** Hiểu rõ bản chất của Giả thuyết thế hệ yếu (\`Weak Generational Hypothesis\`) và hiện tượng Dừng toàn bộ luồng thực thi (\`Stop-The-World Latency\`); phân biệt cơ chế sao chép bán không gian (\`Cheney Scavenge\` trong \`Young Generation\`) với thuật toán Đánh dấu - Quét - Dồn trang ba màu (\`Tri-color Mark-Sweep-Compact\` trong \`Old Generation\`) cùng cơ chế Rào chắn ghi (\`Write Barrier & Remembered Set\`).
> 2. **Lý thuyết Đồ thị Thống trị (Dominator Tree), Kích thước giữ chân (Retained Size) và Quản trị bộ nhớ ngoài Heap:** Phân tích định lượng sự khác biệt giữa \`Shallow Size\` và \`Retained Size\` trên đồ thị tham chiếu gốc (\`GC Roots\`); chứng minh nguyên nhân vật lý khiến Container trên Kubernetes bị tiêu diệt (\`Linux cgroups OOMKilled - Exit Code 137\`) ngay cả khi \`heapUsed\` thấp, đồng thời làm chủ cơ chế tham chiếu yếu (\`WeakMap\`, \`WeakRef\`, \`FinalizationRegistry\`).
> 3. **Nhận diện mẫu code rò rỉ bộ nhớ trong NestJS và Quy trình săn lỗi Ba bản chụp (3-Snapshot Forensics):** Giải phẫu các mẫu thiết kế gây rò rỉ RAM kinh điển trong kiến trúc Singleton của NestJS (Bao đóng giữ ngữ cảnh, EventEmitter/RxJS không hủy đăng ký, Bộ đệm không giới hạn); nắm vững phương pháp đối chiếu 3 bản chụp \`Heap Snapshot\` và thiết lập ngân sách bộ nhớ an toàn trên Production.

---

# 1. KIẾN TRÚC BỘ NHỚ PHÂN TẦNG V8 (ORINOCO GC): GIẢ THUYẾT THẾ HỆ, SCAVENGE VÀ MARK-SWEEP-COMPACT

### 1.1 Khái niệm nền tảng: Quản trị bộ nhớ tự động, Độ trễ Dừng thế giới (Stop-The-World) và Giả thuyết thế hệ yếu

Trong các ngôn ngữ hệ thống cấp thấp như C hoặc C++, lập trình viên trực tiếp yêu cầu nhân hệ điều hành cấp phát và thu hồi các khối bộ nhớ trên vùng nhớ Heap thông qua cặp lời gọi hàm \`malloc()\` và \`free()\`. Mô hình quản trị thủ công này mang lại hiệu năng tối đa và độ trễ hoàn toàn có thể dự đoán trước, nhưng đánh đổi bằng rủi ro lỗi bộ nhớ nghiêm trọng: nếu quên gọi \`free()\` sẽ gây **Rò rỉ bộ nhớ (Memory Leak)**; nếu gọi \`free()\` quá sớm khi con trỏ khác vẫn đang trỏ tới sẽ gây lỗi **Truy cập vùng nhớ đã giải phóng (Use-After-Free)** hoặc **Giải phóng kép (Double Free)**.

Để loại bỏ toàn bộ lớp lỗi con trỏ nguy hiểm này, V8 Engine sử dụng cơ chế **Thu gom rác tự động theo đồ thị truy vết (Tracing Garbage Collection)** mang tên định danh nội bộ là **Orinoco**. Thay vì dựa vào lập trình viên, bộ thu gom rác định kỳ xuất phát từ tập hợp các **Điểm neo gốc (GC Roots — bao gồm các biến cục bộ đang nằm trên khung ngăn xếp \`Call Stack\`, thanh ghi CPU, đối tượng toàn cục \`globalThis\`, và các tham chiếu nội bộ của C++句柄 \`Persistent Handles\`)**, duyệt theo mọi liên kết con trỏ để xác định đối tượng nào **Có thể chạm tới (Reachable / Live Objects)** và thu hồi toàn bộ các vùng nhớ **Không thể chạm tới (Unreachable / Dead Objects)**.

Tuy nhiên, việc duyệt đồ thị bộ nhớ trong khi ứng dụng đang chạy đặt ra một thách thức kỹ thuật sống còn: nếu luồng thực thi JavaScript (**Mutator Thread**) vừa chạy vừa thay đổi liên kết con trỏ trong lúc Garbage Collector đang đánh dấu, bộ thu gom rác có thể nhìn thấy một đồ thị không nhất quán và xóa nhầm đối tượng đang sử dụng. Do đó, các pha quan trọng của GC bắt buộc phải kích hoạt cơ chế **Dừng toàn bộ luồng thực thi (Stop-The-World - STW)** — đóng băng hoàn toàn luồng chính của V8. Trong một dịch vụ Backend xử lý 10,000 yêu cầu/giây, một chu kỳ dừng \`Stop-The-World\` kéo dài \`200 ms\` đồng nghĩa với việc 2,000 yêu cầu HTTP bị treo cứng đồng loạt, làm vọt chỉ số độ trễ đuôi (**P99 Latency**).

Để triệt tiêu thời gian dừng luồng \`Stop-The-World\`, kiến trúc bộ nhớ của V8 được thiết kế xoay quanh một định luật thực nghiệm nổi tiếng trong Khoa học Máy tính gọi là **Giả thuyết thế hệ yếu (Weak Generational Hypothesis)**: *"Đại đa số các đối tượng trong phần mềm chỉ tồn tại trong một khoảng thời gian cực ngắn và trở thành rác ngay sau khi vừa được khởi tạo"*. Trong một máy chủ NestJS điển hình, phân bố vòng đời đối tượng trên V8 Heap được chia tách rõ rệt thành 4 phân vùng vật lý:

1. **Vùng nhớ Thế hệ trẻ (\`Young Generation / New Space\`, dung lượng mặc định \`16 MB – 64 MB\`):**
   Là nơi tiếp nhận hầu hết mọi đối tượng vừa được cấp phát bằng từ khóa \`new\` hoặc khởi tạo literal (\`Request DTO\`, tham số truy vấn URL, biến trung gian trong \`Pipe\`/\`Interceptor\`, chuỗi kết quả tạm thời). Hơn **95% đối tượng** tại đây sẽ mất toàn bộ tham chiếu ngay khi luồng xử lý trả xong gói tin HTTP Response (sau \`2 ms – 15 ms\`). Phân vùng này được chia đôi thành hai bán không gian có kích thước bằng nhau: **\`From-Space\` (Nursery)** và **\`To-Space\` (Intermediate)**.
2. **Vùng nhớ Thế hệ già chứa con trỏ (\`Old Pointer Space\`, dung lượng \`1 GB – 4 GB+\`):**
   Chứa các đối tượng đã sống sót qua ít nhất 2 chu kỳ thu gom rác ở \`Young Generation\` và bên trong chúng có chứa các con trỏ tham chiếu tới đối tượng khác (ví dụ: các \`Singleton Service\` của NestJS, bể kết nối \`Database Connection Pool\`, cấu trúc \`Metadata\` của Dependency Injection Container).
3. **Vùng nhớ Thế hệ già thuần dữ liệu (\`Old Data Space\`):**
   Chứa các khối dữ liệu sống lâu nhưng bên trong chỉ lưu byte thô mà không chứa bất kỳ con trỏ nào trỏ sang đối tượng JS khác (chẳng hạn các chuỗi văn bản dài, mảng số thực đã đóng hộp). Việc tách riêng \`Old Data Space\` giúp GC bỏ qua hoàn toàn bước duyệt con trỏ bên trong các khối dữ liệu này.
4. **Vùng nhớ Đối tượng khổng lồ (\`Large Object Space - LO_SPACE\`):**
   Bất kỳ đối tượng hoặc mảng nào có kích thước vượt quá ngưỡng trang bộ nhớ tiêu chuẩn (thường là **\`> 256 KB\`**) sẽ được cấp phát thẳng vào \`LO_SPACE\` ngay khi khởi tạo mà không đi qua \`Young Generation\`, nhằm tránh chi phí sao chép khối dữ liệu lớn giữa \`From-Space\` và \`To-Space\`. Các đối tượng trong \`LO_SPACE\` không bao giờ bị di dời địa chỉ vật lý trong suốt vòng đời.

### 1.2 Đối chiếu kiến trúc thu gom rác: Reference Counting, Cheney Scavenge (Minor GC) và Mark-Sweep-Compact (Major GC)

Tại sao V8 không dùng thuật toán Đếm tham chiếu đơn giản như Python/Swift mà lại kết hợp hai thuật toán hoàn toàn khác nhau cho \`Young Generation\` và \`Old Generation\`? Bảng dưới đây phân tích định lượng sự đánh đổi giữa 3 cơ chế:

| Tiêu chí học thuật | Đếm tham chiếu trực tiếp (Reference Counting) | Sao chép bán không gian Cheney Scavenge (V8 Minor GC) | Đánh dấu - Quét - Dồn trang 3 màu (V8 Major GC) |
| :--- | :--- | :--- | :--- |
| **Phân vùng bộ nhớ áp dụng** | Không được V8 sử dụng cho JS Heap (chỉ dùng trong một số cấu trúc C++ nội bộ) | Áp dụng độc quyền cho **\`Young Generation\`** (\`From-Space\` & \`To-Space\`, \`16 – 64 MB\`) | Áp dụng cho **\`Old Generation\`** (\`Old Pointer/Data Space\`, \`1 – 4 GB+\`) |
| **Cơ chế cấp phát bộ nhớ mới** | Duyệt danh sách vùng trống (\`Free-list\`); tốn chi phí cập nhật bộ đếm mỗi khi gán biến | **Tịnh tiến con trỏ (\`Bump-pointer Allocation\`)**: dịch địa chỉ đầu mút thêm \`N bytes\` với độ phức tạp \`O(1)\` | Cấp phát từ **\`Free-list\`** phân loại theo kích thước ô nhớ trống hoặc cấp phát tuyến tính trên trang đã dồn |
| **Độ phức tạp thời gian thu hồi** | Tức thì \`O(1)\` khi bộ đếm về \`0\`, nhưng gây hiệu ứng thác đổ nếu xóa cây đối tượng lớn | **Tỷ lệ thuận với số đối tượng SỐNG SÓT \`O(Live_Objects)\`**; hoàn toàn không tốn chi phí cho các đối tượng đã chết | Tỷ lệ thuận với tổng số đối tượng sống khi đánh dấu \`O(Live)\` cộng với kích thước trang khi quét \`O(Heap_Size)\` |
| **Xử lý Tham chiếu vòng (\`Circular Ref\`)** | **Thất bại hoàn toàn**: hai đối tượng trỏ lẫn nhau giữ \`count = 1\` vĩnh viễn gây rò rỉ bộ nhớ | **Giải quyết triệt để**: cụm đối tượng tự trỏ nhau nhưng mất liên kết từ \`GC Roots\` sẽ bị bỏ lại \`From-Space\` và xóa sạch | **Giải quyết triệt để**: cụm đối tượng cô lập giữ nguyên màu Trắng (\`White\`) và bị thu hồi toàn bộ ở pha \`Sweep\` |
| **Hiện tượng phân mảnh bộ nhớ** | Bị phân mảnh ngoại vi nghiêm trọng sau nhiều lần cấp phát và giải phóng kích thước lẻ | **Triệt tiêu 100% phân mảnh**: các đối tượng sống được xếp khít liền kề nhau khi chép sang \`To-Space\` | Chống phân mảnh chủ động thông qua pha **\`Compacting / Evacuation\`** trên các trang nhớ bị phân mảnh nặng |
| **Thời gian dừng luồng (\`STW Latency\`)** | Không có pha dừng tập trung nhưng làm chậm mọi thao tác gán con trỏ trên toàn hệ thống | **Cực ngắn (\`~0.5 ms – 2.5 ms\`)** nhờ chạy song song đa luồng (\`Parallel Scavenger\`) trên lượng dữ liệu sống rất nhỏ | **Từ \`10 ms – 150 ms+\`**, được giảm thiểu nhờ đánh dấu tăng tiến (\`Incremental\`) và quét đồng thời (\`Concurrent\`) |

### 1.3 Cơ chế Cheney Copying, Rào chắn ghi (Write Barriers) và Thuật toán Đánh dấu ba màu (Tri-color Marking)

Để hiểu cách V8 vận hành hai bộ thu gom rác này ở cấp độ con trỏ phần cứng, chúng ta đi sâu vào ba cơ chế cốt lõi bên dưới nắp ca-pô của Orinoco:

1. **Thuật toán Cheney Scavenge và Quy tắc Thăng cấp đối tượng (\`Object Promotion\`):**
   Trong \`Young Generation\`, mọi đối tượng mới đều được cấp phát liên tiếp vào bán vùng **\`From-Space\`** bằng cách dịch chuyển một con trỏ cấp phát (\`Allocation Pointer\`) — nhanh gần tương đương việc đẩy khung ngăn xếp Stack. Khi \`From-Space\` chạm ngưỡng đầy, **Minor GC (Scavenger)** kích hoạt:
   - Các luồng phụ trợ (\`Parallel Worker Threads\`) xuất phát từ \`GC Roots\`, sao chép nguyên khối những đối tượng còn sống sang bán vùng **\`To-Space\`** và xếp chúng nằm sát cạnh nhau.
   - Toàn bộ đối tượng rác (chiếm 95% dung lượng) bị bỏ mặc tại \`From-Space\`. Sau khi chép xong số ít đối tượng sống, V8 chỉ cần đặt lại con trỏ đầu mút của \`From-Space\` về vị trí 0 và **hoán đổi vai trò hai bán vùng (\`From-Space\` $\leftrightarrow$ \`To-Space\`)**.
   - Một đối tượng sẽ được **Thăng cấp (\`Promoted\`)** chuyển thẳng lên \`Old Generation\` nếu thỏa mãn một trong hai điều kiện: **(a)** Đối tượng đó đã sống sót qua **2 chu kỳ Minor GC** liên tiếp, hoặc **(b)** Tại thời điểm sao chép, bán vùng \`To-Space\` đã bị lấp đầy vượt quá **ngưỡng 25% dung lượng** (cơ chế bảo vệ nhằm giữ không gian trống cho chu kỳ cấp phát tiếp theo).

2. **Bài toán Tham chiếu xuyên thế hệ và Rào chắn ghi (\`Write Barrier & Remembered Set\`):**
   Một câu hỏi hóc búa trong thiết kế máy ảo: *Giả sử một đối tượng \`Singleton Cache\` nằm ở \`Old Generation\` (nặng 2GB) vừa được gán một thuộc tính trỏ tới một đối tượng \`userDto\` mới tạo ở \`Young Generation\`. Khi Minor GC chạy, làm sao nó biết \`userDto\` đang được giữ sống bởi \`Singleton Cache\` nếu không quét toàn bộ 2GB của \`Old Generation\`?*
   Nếu phải quét 2GB Old Gen, Minor GC sẽ mất hàng trăm mili-giây và phá sản hoàn toàn ý nghĩa của kiến trúc phân tầng. V8 giải quyết bài toán này bằng **Rào chắn ghi (\`Write Barrier\`)** và **Tập hợp ghi nhớ (\`Remembered Set / Card Table\`)**:
   - Mỗi khi mã máy thực hiện phép gán con trỏ \`oldObj.prop = youngObj\`, một đoạn mã kiểm tra siêu nhẹ đính kèm phép gán (\`Write Barrier\`) sẽ kiểm tra xem có phải đối tượng ở \`Old Gen\` đang trỏ sang đối tượng ở \`Young Gen\` hay không.
   - Nếu đúng, V8 ghi ngay địa chỉ khe nhớ đó vào một danh sách đặc biệt gọi là **\`Remembered Set\`**. Khi Minor GC kích hoạt, nó chỉ cần lấy \`GC Roots\` cộng với các địa chỉ trong \`Remembered Set\` làm gốc tìm kiếm mà hoàn toàn không cần chạm vào phần còn lại của \`Old Generation\`.

3. **Thuật toán Đánh dấu ba màu (\`Tri-color Marking\`) trong Major GC:**
   Khi dung lượng \`Old Generation\` vượt ngưỡng giới hạn động, **Major GC (Full Mark-Sweep-Compact)** được kích hoạt dựa trên mô hình đồ thị 3 màu của Edsger Dijkstra:
   - **Màu Trắng (\`White — Unvisited / Garbage Candidate\`):** Khi bắt đầu chu kỳ GC, toàn bộ đối tượng trên Heap đều được tô màu Trắng.
   - **Màu Xám (\`Grey — Discovered / Worklist Queue\`):** GC duyệt các đối tượng nối trực tiếp với \`GC Roots\`, tô chúng thành màu Xám và đẩy vào hàng đợi duyệt (\`Marking Worklist\`). Màu Xám có nghĩa là: *"Bản thân đối tượng này đã được xác nhận còn sống, nhưng các thuộc tính con mà nó trỏ tới chưa được kiểm tra hết"*.
   - **Màu Đen (\`Black — Fully Scanned / Retained\`):** Khi GC lấy một đối tượng màu Xám ra khỏi hàng đợi, tô màu Xám cho tất cả các đối tượng con trực tiếp của nó, thì đối tượng cha được chuyển sang màu Đen (chắc chắn sống sót và không có con trỏ trực tiếp nào nối với màu Trắng — **Tri-color Invariant**).
   - Khi hàng đợi màu Xám trống rỗng, toàn bộ đối tượng còn mang **Màu Trắng** chính là rác cô lập. Pha **\`Concurrent Sweeping\`** sẽ thu hồi các ô nhớ màu Trắng đưa vào \`Free-list\`, và pha **\`Parallel Compacting\`** sẽ dịch chuyển các đối tượng màu Đen trên các trang nhớ bị thủng lỗ chỗ về nằm sát nhau để chống phân mảnh.

Hãy đối chiếu hai thiết kế dịch vụ tổng hợp nhật ký giao dịch dưới đây để thấy hiện tượng **Thăng cấp sớm bất thường (\`Premature Promotion\`)** làm tê liệt Garbage Collector như thế nào:

\`\`\`typescript
// File: src/analytics/payload-aggregator.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Tạo mảng đối tượng trung gian khổng lồ gây Premature Promotion
@Injectable()
export class PayloadAggregatorBrokenService {
  // Giữ mảng lịch sử cấp phát tạm thời trên thuộc tính của Singleton (Old Generation)
  private lastProcessedBatch: Array<Record<string, unknown>> = [];

  aggregateTransactionBatch(rawItems: ReadonlyArray<{ amountCent: number; feeCent: number }>) {
    // Khởi tạo hàng trăm nghìn object tạm trong 1 tick làm tràn bán vùng From-Space (16MB)
    // Khiến To-Space vượt ngưỡng 25% và đẩy toàn bộ rác ngắn hạn lên Old Generation!
    const clonedObjects = rawItems.map((item, idx) => ({
      index: idx,
      netCent: item.amountCent - item.feeCent,
      auditPadding: new Array(64).fill(idx),
    }));

    // Gán vào thuộc tính của Singleton kích hoạt Write Barrier đưa vào Remembered Set
    this.lastProcessedBatch = clonedObjects;

    let totalNetCent = 0;
    for (const obj of this.lastProcessedBatch) {
      totalNetCent += Number(obj.netCent);
    }
    return { count: rawItems.length, totalNetCent };
  }
}

// 2. THIẾT KẾ CHUẨN (GC-FRIENDLY ZERO-ALLOCATION): Tính toán tại chỗ, không tạo rác trung gian
@Injectable()
export class PayloadAggregatorSafeService {
  aggregateTransactionBatch(rawItems: ReadonlyArray<{ amountCent: number; feeCent: number }>) {
    // Tính toán trực tiếp trên thanh ghi Smi/Float64, không cấp phát bất kỳ JSObject trung gian nào
    let totalNetCent = 0;
    const length = rawItems.length;

    for (let i = 0; i < length; i++) {
      const item = rawItems[i];
      totalNetCent += item.amountCent - item.feeCent;
    }

    // Chỉ cấp phát duy nhất 1 đối tượng kết quả nhỏ gọn (48 bytes) nằm gọn trong Nursery
    return { count: length, totalNetCent };
  }
}
\`\`\`

Bảng dưới đây truy vết chi tiết diễn biến vùng nhớ V8 Heap theo từng mili-giây khi \`PayloadAggregatorBrokenService\` xử lý liên tiếp các lô dữ liệu dưới tải cao:

| Mốc thời gian | Sự kiện thực thi trên V8 Main Thread | Trạng thái \`Young Gen\` (\`From-Space\` / \`To-Space\`) | Trạng thái \`Remembered Set\` & \`Old Generation\` | Hệ quả độ trễ (\`Stop-The-World Latency\`) |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | Request \`#1\` bắt đầu chạy \`rawItems.map()\` với \`50,000\` phần tử | Con trỏ cấp phát trong \`From-Space\` tăng vọt từ \`2 MB\` lên chạm trần \`16 MB\` | \`Old Gen\` ổn định ở mức \`120 MB\`; \`Remembered Set\` rỗng | Đang thực thi mã JS; chưa phát sinh dừng luồng |
| **\`t = 4 ms\`** | \`From-Space\` đầy ngay giữa vòng lặp \`.map()\` $\rightarrow$ Kích hoạt **Minor GC #1** | Toàn bộ \`35,000\` phần tử đã tạo vẫn đang nằm trong mảng \`clonedObjects\` trên Stack nên **100% còn sống** | Do lượng dữ liệu sống chép sang \`To-Space\` vượt ngưỡng **\`25%\`**, V8 ép thăng cấp sớm (**Premature Promotion**) thẳng lên \`Old Gen\` | Luồng chính bị đóng băng \`~6.5 ms\` để sao chép hàng chục MB dữ liệu sống |
| **\`t = 12 ms\`** | Gán \`this.lastProcessedBatch = clonedObjects\` và trả về HTTP Response | \`Young Gen\` được làm trống sau khi xong hàm | \`Write Barrier\` ghi nhận \`this\` (\`Old Gen\`) trỏ tới mảng dữ liệu; \`Old Gen\` phình thêm \`28 MB\` | Kết thúc Request \`#1\`, nhưng \`28 MB\` dữ liệu tạm đã bị kẹt lại trên \`Old Generation\` |
| **\`t = 15 ms\`** | Request \`#2\` đến \`#30\` tiếp tục gọi hàm tương tự | Liên tục tràn \`From-Space\` và đẩy dữ liệu ngắn hạn lên \`Old Gen\` do hiệu ứng dây chuyền | Dung lượng \`Old Gen\` leo thang từ \`148 MB\` lên chạm ngưỡng kích hoạt Major GC (\`~750 MB\`) | Xuất hiện các nhịp giật lag \`5 ms – 10 ms\` dày đặc ở mỗi request |
| **\`t = 180 ms\`** | **Major GC (Mark-Sweep-Compact)** buộc phải kích hoạt khẩn cấp | Đóng băng cấp phát mới | Phải duyệt đồ thị 3 màu và dồn trang trên hàng triệu đối tượng rác bị thăng cấp nhầm lên \`Old Gen\` | **Stop-The-World kéo dài \`95 ms\`**; toàn bộ API trên máy chủ ngừng phản hồi đồng loạt |

### 1.4 Định lượng hiệu năng thu gom rác và công thức tính chi phí Stop-The-World

Để chứng minh bằng toán học tại sao việc giữ các đối tượng ngắn hạn chết ngay trong \`Young Generation\` lại giúp thời gian dừng \`Minor GC\` gần như bằng 0, trong khi để chúng lọt lên \`Old Generation\` lại gây thảm họa, ta xét công thức định lượng thời gian thu gom rác:

\`\`\`
Thời gian Minor GC (Scavenge) = N_live_young × (T_copy_word + T_update_ptr) + (0 × N_dead_young)
Thời gian Major GC (Mark-Sweep-Compact) = (N_live_old × T_mark) + (Size_Old_Heap × T_sweep) + (N_fragmented_bytes × T_compact_move)
Ví dụ định lượng (Cấp phát 32 MB/chu kỳ): Nếu 98% chết trẻ (chỉ chép 0.64 MB sống) -> STW ≈ 0.8 ms | Nếu bị giữ tham chiếu sống 80% (chép 25.6 MB) -> STW vọt lên ≈ 32.0 ms (Chậm hơn 40 lần)
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc bảo toàn kiến trúc thu gom rác phân tầng):**
> 1. **Định luật chi phí bằng không cho đối tượng chết trẻ (Zero-Cost Short-Lived Mortality):** Trong \`Young Generation\`, thuật toán Cheney Scavenge hoàn toàn không duyệt qua các đối tượng đã chết; chi phí thu hồi tỷ lệ thuận 100% với **số byte còn sống sót**. Do đó, một đối tượng khởi tạo và mất tham chiếu trước khi \`From-Space\` đầy sẽ không tốn bất kỳ chu kỳ CPU nào để xóa bỏ.
> 2. **Ngăn chặn thăng cấp sớm và tham chiếu ngược (Anti-Premature Promotion & Write-Barrier Discipline):** Tuyệt đối không lưu tạm dữ liệu của từng HTTP Request vào thuộc tính của các \`Singleton Service\` (vốn nằm ở \`Old Generation\`), vì thao tác này kích hoạt \`Write Barrier\`, neo giữ đối tượng trẻ qua các chu kỳ Minor GC và đẩy rác ngắn hạn lên làm ngập \`Old Generation\`.

---

# 2. LÝ THUYẾT ĐỒ THỊ DOMINATOR TREE, RETAINED SIZE VÀ BỘ NHỚ NGOÀI HEAP (OFF-HEAP / RSS)

### 2.1 Cấu trúc Đồ thị tham chiếu (Reference Graph), Cây thống trị (Dominator Tree) và Khoảng cách gốc (Distance)

Khi phân tích bộ nhớ của một tiến trình Node.js/NestJS, toàn bộ vùng nhớ V8 Heap được biểu diễn dưới dạng một **Đồ thị có hướng (Directed Reference Graph)** $G = (V, E)$, trong đó tập đỉnh $V$ là các đối tượng trên Heap và tập cạnh có hướng $E$ là các con trỏ tham chiếu từ đối tượng cha sang thuộc tính con. Để xác định chính xác thủ phạm gây nghẽn bộ nhớ, các công cụ chẩn đoán như Chrome DevTools biến đổi đồ thị tham chiếu thành **Cây thống trị (Dominator Tree)** dựa trên lý thuyết đồ thị của Lengauer-Tarjan với 4 khái niệm định lượng bắt buộc phải phân biệt:

1. **Quan hệ Thống trị (\`Dominance Relation\`):**
   Trên đồ thị bộ nhớ xuất phát từ nút gốc **\`GC Roots\`**, một đối tượng $D$ được gọi là **Thống trị (\`Dominates\`)** đối tượng $N$ nếu và chỉ nếu **mọi đường đi** từ \`GC Roots\` đến $N$ đều bắt buộc phải đi qua $D$. Nếu nút $D$ bị xóa khỏi bộ nhớ, nút $N$ lập tức mất toàn bộ đường kết nối với \`GC Roots\` và chắc chắn bị Garbage Collector thu hồi. Nút thống trị gần $N$ nhất trên mọi đường đi gọi là **Nút thống trị trực tiếp (\`Immediate Dominator - IDOM\`)**.
2. **Kích thước nông (\`Shallow Size\`):**
   Là dung lượng bộ nhớ vật lý (tính bằng Bytes) mà **chính bản thân cấu trúc đối tượng đó** chiếm giữ để lưu trữ các trường đầu mục (\`Map Pointer\`, \`Properties Pointer\`, \`Elements Pointer\`) và các giá trị nguyên thủy trực tiếp (\`Smi\`, con trỏ 4/8 bytes). Một đối tượng điều phối hoặc một \`Array\` / \`Map\` quản lý hàng triệu phần tử thường chỉ có \`Shallow Size\` vỏn vẹn từ **\`32 bytes\` đến \`128 bytes\`**.
3. **Kích thước giữ chân (\`Retained Size\`):**
   Là tổng dung lượng bộ nhớ sẽ được giải phóng ngay lập tức nếu đối tượng $D$ bị gỡ bỏ tham chiếu — bằng **\`Shallow Size\` của chính đối tượng $D$ cộng với tổng \`Shallow Size\` của toàn bộ các nút con nằm trong nhánh cây thống trị (\`Dominator Subtree\`) độc quyền phụ thuộc vào $D$**. Lưu ý quan trọng: nếu một đối tượng con $X$ vừa được trỏ tới bởi $D$, vừa được trỏ tới bởi một đối tượng độc lập $K$ khác nối từ \`GC Roots\`, thì $X$ không nằm trong cây thống trị độc quyền của $D$ và dung lượng của $X$ sẽ **không** được cộng vào \`Retained Size\` của $D$.
4. **Khoảng cách tới gốc (\`Distance\`):**
   Là số bước nhảy con trỏ ngắn nhất (**Shortest Path Hops**) tính từ bất kỳ \`GC Root\` nào để chạm tới đối tượng đó. Khi truy vết rò rỉ bộ nhớ, đối tượng có **\`Retained Size\` khổng lồ** đi kèm chỉ số **\`Distance\` nhỏ** chính là điểm nút cổ chai đang neo giữ cả cụm rác trên RAM.

Để giám sát toàn diện các phân vùng bộ nhớ này trong lúc chạy, Node.js cung cấp hàm \`process.memoryUsage()\` trả về 5 chỉ số định lượng phản ánh từ tầng hệ điều hành xuống tầng V8 Heap:

| Chỉ số trong \`process.memoryUsage()\` | Tầng quản lý vật lý | Ý nghĩa kỹ thuật chuẩn xác | Có nằm trong giới hạn \`--max-old-space-size\`? | Dấu hiệu bất thường khi xảy ra sự cố |
| :--- | :--- | :--- | :--- | :--- |
| **\`rss\` (Resident Set Size)** | **Nhân Hệ điều hành (Linux Kernel Pages)** | Tổng dung lượng trang RAM vật lý thực tế mà tiến trình Node.js đang chiếm giữ (gồm V8 Heap + C++ Off-heap + Call Stack + Mã máy V8/Shared Libraries) | **Không** (\`rss\` luôn lớn hơn \`heapTotal\` cộng \`external\`) | Khi \`rss\` chạm giới hạn \`memory.limit_in_bytes\` của Container, Kernel kích hoạt **OOM Killer** tiêu diệt tiến trình tức khắc |
| **\`heapTotal\`** | **V8 Engine (Orinoco Virtual Allocator)** | Tổng dung lượng bộ nhớ ảo mà V8 đã xin cấp phát từ hệ điều hành (qua \`mmap\`) để dành riêng cho vùng nhớ đối tượng JS (\`Young Gen\` + \`Old Gen\`) | **Có** (Bị khống chế bởi giới hạn Heap của V8) | Tăng bậc thang sau mỗi đợt tải cao và giữ ở mức cao nếu V8 đánh giá cần dự trữ trang nhớ trống |
| **\`heapUsed\`** | **V8 Engine (Live & Uncollected JS Objects)** | Tổng dung lượng thực tế đang bị các đối tượng JavaScript (\`Object\`, \`String\`, \`Closure\`, \`Array\`) chiếm dụng trên cả \`Young Gen\` và \`Old Gen\` | **Có** (Khi chạm ngưỡng giới hạn sẽ nổ lỗi \`JavaScript heap out of memory\`) | Tạo hình **Răng cưa đi lên (\`Sawtooth Upward Trend\`)**: sau mỗi chu kỳ Major GC, đáy của răng cưa ngày càng cao hơn |
| **\`external\`** | **C++ Native Layer / Bindings** | Bộ nhớ của các đối tượng C++ được cấp phát ngoài V8 Heap bằng \`malloc\` nhưng có gắn liên kết vòng đời với đối tượng vỏ bọc JS (như luồng nén \`zlib\`, \`OpenSSL\`, \`Buffer\`) | **Không** (Nằm ngoài V8 Heap nhưng V8 có theo dõi lượng byte để kích hoạt GC hỗ trợ) | Tăng vọt hàng trăm MB khi xử lý tệp tin lớn, mã hóa hoặc gọi thư viện Native C++ (\`sharp\`, \`bcrypt\`) không giải phóng |
| **\`arrayBuffers\`** | **C++ Backing Store (\`ArrayBuffer\` / \`Buffer\`)** | Một tập con của \`external\`, đo riêng dung lượng bộ nhớ nhị phân thô của mọi \`ArrayBuffer\`, \`SharedArrayBuffer\` và \`Buffer\` trong Node.js | **Không** (Dữ liệu nhị phân nằm trên vùng nhớ C++, trên V8 Heap chỉ lưu vỏ bọc vài chục byte) | Tăng đột biến khi đọc toàn bộ tệp tin lớn vào RAM bằng \`fs.readFile\` hoặc tích tụ \`Buffer.concat()\` trên luồng mạng chậm |

### 2.2 Giới hạn vùng nhớ Container (Linux cgroups OOM Killer) và nghịch lý OOM khi Heap thấp

Trong môi trường triển khai Kubernetes hiện đại, mỗi Pod đều bị giới hạn dung lượng RAM vật lý nghiêm ngặt thông qua cơ chế **\`cgroups (Control Groups)\`** của nhân Linux (ví dụ: cấu hình \`resources.limits.memory: 1024Mi\`). Nhiều kỹ sư Backend gặp phải hai sự cố sập tiến trình hoàn toàn trái ngược nhau do không nắm vững mối quan hệ định lượng giữa \`RSS\`, \`V8 Heap\` và \`External Memory\`:

1. **Kịch bản 1 — V8 chưa kịp chạy Major GC đã bị Linux Kernel bắn chết (\`Exit Code 137 / OOMKilled\`):**
   Theo mặc định trên máy chủ vật lý có 32GB RAM, Node.js tự động đặt ngưỡng tối đa của \`Old Generation\` là khoảng \`2 GB – 4 GB\`. Khi đưa tiến trình này vào một Kubernetes Container chỉ được cấp giới hạn \`512 MB\` hoặc \`1024 MB\` mà không cấu hình cờ \`--max-old-space-size\`, V8 vẫn tưởng rằng nó có tới \`2 GB\` không gian thoải mái nên **lười kích hoạt Major GC**. Khi \`heapUsed\` mới tăng lên khoảng \`750 MB\`, cộng thêm \`Young Generation\` (\`64 MB\`), mã máy JIT (\`80 MB\`) và bộ nhớ \`external\` (\`150 MB\`), tổng **\`RSS\` đã vượt mốc \`1024 MB\`** của \`cgroups\`. Ngay lập tức, nhân Linux cử **OOM Killer** gửi tín hiệu \`SIGKILL (Signal 9)\` giết chết tiến trình từ bên ngoài mà không có bất kỳ dòng log stack trace nào của JavaScript.
2. **Kịch bản 2 — Nghịch lý \`heapUsed\` cực thấp (\`~150 MB\`) nhưng Container vẫn nổ OOM:**
   Xảy ra khi ứng dụng tải tệp tin lớn hoặc gom các mảnh dữ liệu mạng bằng \`Buffer.concat(chunks)\`. Một đối tượng \`Buffer\` dài \`500 MB\` trong Node.js được chia làm hai phần: **(a)** Khối dữ liệu nhị phân \`500 MB\` nằm ở vùng nhớ C++ ngoài Heap (\`external / arrayBuffers\`), và **(b)** Một đối tượng vỏ bọc (\`JSArrayBuffer Wrapper\`) nằm trên V8 Heap chỉ nặng có **\`64 bytes\`**. Nếu có 3 yêu cầu đồng thời giữ 3 \`Buffer\` như vậy, tổng \`heapUsed\` chỉ tăng thêm \`192 bytes\`, hoàn toàn không đủ áp lực để V8 chạy thu gom rác, nhưng vùng nhớ C++ đã ngốn thêm **\`1.5 GB\`**, làm nổ tung \`RSS\` của Container.

Để thiết lập ngân sách bộ nhớ an toàn tuyệt đối cho một Container chạy đơn tiến trình Node.js, kỹ sư hệ thống phải tính toán tham số \`--max-old-space-size\` theo công thức định lượng trừ lùi phần bù ngoài Heap:

\`\`\`
Tổng bộ nhớ tiến trình (RSS) = Old_Gen_Used + (2 × Semi_Space_Size) + Code_And_Stack_Space + Cpp_External_Buffers
Ngưỡng cấu hình an toàn: --max-old-space-size = (Container_Memory_Limit_MB × 0.70) đến (Container_Memory_Limit_MB × 0.75)
Ví dụ định lượng (Container Limit = 1024 MB): Đặt --max-old-space-size=768 (Dành 768 MB cho Old Gen, còn lại 256 MB dự phòng cho 64 MB Young Gen + 192 MB C++ Buffers/Code Space)
\`\`\`

### 2.3 Cơ chế Tham chiếu mạnh (Strong Reference) đối đầu Tham chiếu yếu (WeakMap, WeakRef và FinalizationRegistry)

Làm thế nào để lưu trữ siêu dữ liệu (Metadata, trạng thái theo dõi phiên, bộ đệm tính toán phụ trợ) gắn liền với một đối tượng nghiệp vụ (như \`Request\`, \`Socket\` hoặc \`Entity\`) mà đảm bảo khi đối tượng đó kết thúc vòng đời, siêu dữ liệu cũng tự động biến mất khỏi bộ nhớ?

1. **Bẫy giữ chân của Tham chiếu mạnh (\`Strong Reference Trap\`):**
   Khi ta đưa một đối tượng \`req\` làm khóa vào cấu trúc \`const metadataMap = new Map<object, AuditInfo>()\` nằm ở phạm vi Module/Singleton, \`Map\` sẽ tạo một **Liên kết tham chiếu mạnh (\`Strong Edge\`)** từ \`GC Roots\` $\rightarrow$ \`metadataMap\` $\rightarrow$ \`req\`. Ngay cả khi kết nối HTTP đã đóng và toàn bộ phần còn lại của ứng dụng không còn biến nào trỏ tới \`req\`, bộ thu gom rác vẫn thấy \`req\` có đường đi hợp lệ từ \`metadataMap\` nên **vĩnh viễn không bao giờ thu hồi \`req\` lẫn \`AuditInfo\`**, trừ khi lập trình viên chủ động gọi \`metadataMap.delete(req)\` trên mọi nhánh thành công và ngoại lệ.
2. **Cơ chế Tham chiếu yếu tự giải phóng (\`WeakMap\` và \`WeakSet\`):**
   Trong \`WeakMap<object, V>\`, các khóa bắt buộc phải là kiểu đối tượng (\`object\`) và liên kết từ \`WeakMap\` tới khóa là một **Tham chiếu yếu (\`Weak Reference / Ephemeron Edge\`)**. Trong pha đánh dấu 3 màu (\`Tri-color Marking\`), Garbage Collector **bỏ qua hoàn toàn liên kết khóa của \`WeakMap\`**: nếu đối tượng \`req\` không còn bất kỳ tham chiếu mạnh nào khác từ \`GC Roots\`, nó sẽ bị coi là đối tượng chết (màu Trắng). Ngay khi GC thu hồi \`req\`, mục từ \`(req, AuditInfo)\` bên trong \`WeakMap\` sẽ bị xóa sổ tự động mà không cần bất kỳ dòng code dọn dẹp thủ công nào.
3. **Con trỏ yếu trực tiếp (\`WeakRef<T>\`) và Sổ đăng ký hậu thu hồi (\`FinalizationRegistry\`):**
   Từ chuẩn ES2021, V8 cung cấp thêm hai công cụ cấp thấp cho phép kiểm soát vòng đời tài nguyên ngoại vi:
   - \`const ref = new WeakRef(targetObj)\`: Tạo một vỏ bọc tham chiếu yếu tới \`targetObj\`. Khi cần đọc đối tượng, ta gọi \`ref.deref()\` — hàm sẽ trả về đối tượng nếu nó còn sống, hoặc trả về \`undefined\` nếu GC đã thu hồi nó.
   - \`const registry = new FinalizationRegistry((heldValue) => { ... })\`: Cho phép đăng ký một hàm callback sẽ được V8 tự động đẩy vào hàng đợi thực thi **sau khi đối tượng mục tiêu đã bị Garbage Collector xóa khỏi Heap**, cực kỳ hữu ích để đóng các tài nguyên phụ trợ (như hủy bộ đếm metric, giải phóng khóa phân tán hoặc cảnh báo quên đóng luồng).

> **Tổng kết học thuật Phần 2 (Quy tắc quản trị đồ thị tham chiếu và ngân sách RAM Container):**
> 1. **Săn tìm theo Retained Size và Dominator Tree:** Khi phân tích bộ nhớ, đừng bị đánh lừa bởi các đối tượng có \`Shallow Size\` nhỏ; đối tượng gây rò rỉ bộ nhớ thực sự là nút gốc của nhánh \`Dominator Tree\` có **\`Retained Size\` tăng trưởng liên tục** theo thời gian.
> 2. **Đồng bộ hóa giới hạn V8 với Linux cgroups:** Luôn truyền tường minh cờ \`--max-old-space-size\` ở mức **\`70% – 75%\` dung lượng giới hạn của Container** để buộc V8 kích hoạt Major GC chủ động trước khi tổng \`RSS\` chạm ngưỡng tử thần của Linux OOM Killer.

---

# 3. CÁC MẪU RÒ RỈ BỘ NHỚ KINH ĐIỂN TRONG NESTJS VÀ QUY TRÌNH CHẨN ĐOÁN HEAP SNAPSHOT TRÊN PRODUCTION

### 3.1 Giải phẫu 4 mẫu thiết kế gây rò rỉ bộ nhớ (Memory Leak Anti-patterns) trong kiến trúc NestJS

Khác với ứng dụng Frontend (nơi người dùng chỉ cần tải lại trang trình duyệt là toàn bộ bộ nhớ được làm mới), một tiến trình Backend NestJS chạy liên tục hàng tuần lễ và mọi \`@Injectable() Service\` hay \`@Controller()\` mặc định đều được khởi tạo theo vòng đời **\`Scope.DEFAULT (Singleton)\`** — tức là tồn tại vĩnh viễn trong \`Old Generation\`. Chỉ cần một liên kết nhỏ từ Singleton trỏ ra dữ liệu của từng request, ứng dụng sẽ rò rỉ bộ nhớ theo 4 mẫu kinh điển sau:

1. **Bộ nhớ đệm nội bộ không giới hạn kích thước (\`Unbounded In-Memory Cache in Singleton\`):**
   Khai báo \`private readonly cache = new Map<string, UserProfile>()\` bên trong một Singleton Service và chỉ có hàm \`.set(key, val)\` mà không có cơ chế giới hạn số lượng phần tử tối đa (**Bounded Capacity / LRU Eviction**) hoặc thời gian hết hạn (**TTL**). Với mỗi khóa mới đi vào, cả chuỗi khóa lẫn đối tượng giá trị đều được thăng cấp lên \`Old Generation\` và nằm lại vĩnh viễn cho đến khi cạn kiệt Heap.
2. **Rò rỉ người lắng nghe sự kiện và luồng bất đồng bộ (\`EventEmitter Listener & RxJS Subscription Leak\`):**
   Đăng ký \`this.eventEmitter.on('order.updated', (payload) => { ... })\` hoặc \`this.stream$.subscribe(...)\` ngay bên trong phương thức xử lý của một HTTP Request / WebSocket Connection mà quên gọi \`removeListener()\` / \`unsubscribe()\` khi kết nối đóng lại. Do \`eventEmitter\` là Singleton, mảng \`listeners\` nội bộ của nó sẽ phình to sau mỗi request, giữ chặt toàn bộ hàm callback.
3. **Bao đóng vô tình giữ chân ngữ cảnh khổng lồ (\`Lexical Closure Context Retention\`):**
   Trong V8 Engine, khi một hàm con (Closure) truy cập dù chỉ 1 biến của hàm cha, đối tượng ngữ cảnh từ vựng (**\`Context\` object** trên V8 Heap) sẽ được chia sẻ giữa các hàm con trong cùng phạm vi. Nếu trong cùng một hàm vừa có một biến \`hugePayloadBuffer\` nặng \`20 MB\`, vừa tạo một hàm callback được lưu giữ lâu dài (như đẩy vào \`setInterval\`, hàng đợi retry, hoặc đăng ký listener), hàm callback đó có thể giữ sống toàn bộ \`Context\` chứa \`hugePayloadBuffer\` ngăn không cho GC thu hồi.
4. **Cắt chuỗi con giữ nguyên chuỗi gốc (\`SlicedString / ConsString Retention\`):**
   Để tối ưu tốc độ xử lý văn bản, khi lập trình viên gọi \`const token = rawHttpBody.slice(0, 32)\` trên một chuỗi \`rawHttpBody\` dài \`5 MB\`, V8 có thể không sao chép 32 ký tự đó ra vùng nhớ mới mà tạo ra một cấu trúc **\`SlicedString\`** chỉ lưu \`offset = 0, length = 32\` cùng một **con trỏ trỏ thẳng vào chuỗi mẹ \`5 MB\`**. Nếu ta lưu chiếc \`token\` dài 32 ký tự này vào bộ nhớ đệm toàn cục, toàn bộ chuỗi mẹ \`5 MB\` sẽ bị giữ chặt trên Heap (có \`Shallow Size\` rất nhỏ nhưng \`Retained Size\` lên tới \`5 MB\`).

### 3.2 Đối chiếu mã nguồn thực thi và Truy vết trạng thái Heap qua các chu kỳ GC

Hãy quan sát sự đối lập giữa thiết kế bị rò rỉ đa tầng và thiết kế phòng thủ chuẩn Production trong dịch vụ điều phối thông báo thời gian thực dưới đây:

\`\`\`typescript
// File: src/modules/notification/realtime-dispatcher.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Rò rỉ kép qua Unbounded Map, EventEmitter Listener và Closure Context
@Injectable()
export class RealtimeDispatcherBrokenService {
  private readonly sessionHistory = new Map<string, unknown>();

  constructor(private readonly globalEvents: EventEmitter2) {}

  handleClientSubscribe(clientId: string, rawLargeBody: string, sendFn: (msg: string) => void) {
    // LỖI 1: Cắt chuỗi trực tiếp có nguy cơ tạo SlicedString giữ chặt chuỗi mẹ rawLargeBody (vài MB)
    const tracePrefix = rawLargeBody.slice(0, 16);

    // LỖI 2: Lưu vào Map của Singleton mà không có giới hạn số lượng phần tử (Unbounded Cache)
    this.sessionHistory.set(clientId, { tracePrefix, connectedAt: Date.now() });

    // LỖI 3: Đăng ký listener vào Singleton EventEmitter trên mỗi request mà không bao giờ gỡ bỏ!
    // Hơn nữa, hàm callback này tạo Closure giữ luôn tham chiếu tới rawLargeBody trong phạm vi hàm!
    this.globalEvents.on('system.broadcast', (eventData: string) => {
      if (rawLargeBody.length > 0) {
        sendFn(\`[\${tracePrefix}] \${eventData}\`);
      }
    });
  }
}

// 2. THIẾT KẾ CHUẨN (MEMORY-SAFE PRODUCTION): Tách bản sao chuỗi, giới hạn LRU và trả hàm dọn dẹp
@Injectable()
export class RealtimeDispatcherSafeService implements OnModuleDestroy {
  private readonly maxSessions = 5000;
  private readonly sessionHistory = new Map<string, { tracePrefix: string; connectedAt: number }>();
  private readonly activeHandlers = new Map<string, (eventData: string) => void>();

  constructor(private readonly globalEvents: EventEmitter2) {}

  handleClientSubscribe(
    clientId: string,
    rawLargeBody: string,
    sendFn: (msg: string) => void,
  ): () => void {
    // Khử liên kết SlicedString bằng cách ép tạo chuỗi phẳng độc lập ( hoặc Buffer.from(...).toString() )
    const detachedPrefix = (' ' + rawLargeBody.slice(0, 16)).slice(1);

    // Đảm bảo giới hạn dung lượng (Bounded LRU Eviction): xóa khóa cũ nhất nếu chạm trần
    if (this.sessionHistory.has(clientId)) {
      this.sessionHistory.delete(clientId);
    } else if (this.sessionHistory.size >= this.maxSessions) {
      const oldestKey = this.sessionHistory.keys().next().value;
      if (oldestKey !== undefined) this.sessionHistory.delete(oldestKey);
    }
    this.sessionHistory.set(clientId, { tracePrefix: detachedPrefix, connectedAt: Date.now() });

    // Cô lập Closure: Không tham chiếu tới rawLargeBody bên trong listener để GC thu hồi ngay chuỗi lớn
    const listener = (eventData: string) => {
      sendFn(\`[\${detachedPrefix}] \${eventData}\`);
    };

    // Nếu clientId đăng ký lại, gỡ bỏ listener cũ trước khi gắn listener mới
    this.unsubscribeClient(clientId);
    this.activeHandlers.set(clientId, listener);
    this.globalEvents.on('system.broadcast', listener);

    // Trả về hàm Disposer để tầng Controller gắn vào sự kiện req.on('close', dispose)
    return () => this.unsubscribeClient(clientId);
  }

  public unsubscribeClient(clientId: string): void {
    const existingListener = this.activeHandlers.get(clientId);
    if (existingListener) {
      this.globalEvents.removeListener('system.broadcast', existingListener);
      this.activeHandlers.delete(clientId);
    }
  }

  public onModuleDestroy(): void {
    for (const clientId of this.activeHandlers.keys()) {
      this.unsubscribeClient(clientId);
    }
    this.sessionHistory.clear();
  }
}
\`\`\`

Bảng dưới đây truy vết các chỉ số bộ nhớ trên Chrome DevTools Heap Snapshot khi hai dịch vụ trên tiếp nhận lưu lượng \`100 kết nối/giây\` (mỗi kết nối gửi kèm chuỗi dữ liệu \`50 KB\` và đóng kết nối sau \`5 giây\`):

| Mốc thời gian | Tổng số kết nối đã đi qua | Trạng thái ở \`BrokenService\` (\`Retained Size\` & \`Listeners\`) | Trạng thái ở \`SafeService\` (\`Retained Size\` & \`Listeners\`) | Hệ quả vận hành trên Kubernetes Pod (\`Limit 512MB\`) |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | \`0\` kết nối (Khởi động máy chủ) | \`Old Gen = 45 MB\`; \`Listeners = 0\`; \`Map.size = 0\` | \`Old Gen = 45 MB\`; \`Listeners = 0\`; \`Map.size = 0\` | Cả hai dịch vụ hoạt động bình thường, độ trễ phản hồi \`~1 ms\` |
| **\`t = 10,000 ms\`** | \`1,000\` kết nối (\`500\` đang mở, \`500\` đã đóng) | \`Listeners = 1,000\` (Cảnh báo \`MaxListenersExceededWarning\`); Closure giữ sống \`1,000 × 50 KB ≈ 50 MB\` trên \`Old Gen\` | \`Listeners = 500\` (500 kết nối đóng đã gọi \`removeListener\`); \`50 KB\` chuỗi gốc được Minor GC dọn sạch tức thì | \`BrokenService\` tăng vọt lên \`110 MB\`; \`SafeService\` giữ ổn định ở \`48 MB\` |
| **\`t = 60,000 ms\`** | \`6,000\` kết nối (\`500\` đang mở, \`5,500\` đã đóng) | \`Retained Size\` của \`RealtimeDispatcherBrokenService\` đạt **\`315 MB\`**; mỗi lần phát sự kiện phải lặp qua 6,000 hàm chết | \`Map.size\` khóa chặt ở trần **\`5,000\`** mục nhỏ (\`~400 KB\`); \`Listeners\` luôn bằng đúng số kết nối đang mở (\`500\`) | \`BrokenService\` bắt đầu chạy Major GC liên tục gây giật lag \`120 ms\` |
| **\`t = 90,000 ms\`** | \`9,000\` kết nối | \`Old Gen\` vượt \`460 MB\`; V8 rơi vào trạng thái **GC Thrashing** (dành 85% thời gian CPU chỉ để quét đồ thị màu Đen không thể xóa) | \`Old Gen\` vẫn phẳng lặng ở mức **\`~49 MB\`**; biểu đồ bộ nhớ có dạng răng cưa ngang hoàn hảo | \`BrokenService\` nổ lỗi \`FATAL ERROR: Reached heap limit Allocation failed\` và làm sập Pod |

### 3.3 Quy trình săn tìm Memory Leak bằng Kỹ thuật Ba Bản Chụp (3-Snapshot Technique) và Cờ chẩn đoán Production

Trên môi trường Staging hoặc Production, việc chụp một bản \`Heap Snapshot\` đơn lẻ thường vô tác dụng vì một tiến trình NestJS bình thường luôn chứa hàng trăm nghìn đối tượng hợp lệ của framework. Để cô lập chính xác 100% đối tượng bị rò rỉ, kỹ sư hệ thống áp dụng **Quy trình Ba Bản Chụp (Three-Snapshot Forensics Technique)**:

1. **Bước 1 — Khởi làm ấm và Chụp bản cơ sở (\`Warm-up & Baseline Snapshot S1\`):**
   Khởi động ứng dụng, gửi vài chục request đầu tiên để NestJS và ORM khởi tạo xong toàn bộ các bộ đệm lười (Lazy Caches, Connection Pools, JIT Bytecode). Sau đó kích hoạt thu gom rác cưỡng bức (nút *Collect Garbage* trong DevTools) và chụp **\`Snapshot 1 (Baseline)\`**.
2. **Bước 2 — Bơm tải mục tiêu và Chụp bản trung gian (\`Target Load & Snapshot S2\`):**
   Chạy kịch bản gọi lặp lại khoảng \`500 – 1,000 lần\` vào API đang nghi ngờ bị rò rỉ bộ nhớ, chờ các request trả về hoàn tất, bấm thu gom rác cưỡng bức rồi chụp **\`Snapshot 2\`**.
3. **Bước 3 — Lặp lại tải và Lọc đối tượng kẹt (\`Comparison & Allocation Filter S3\`):**
   Gọi thêm một đợt tải nữa và chụp **\`Snapshot 3\`**. Trên giao diện Chrome DevTools, chọn \`Snapshot 3\` và đổi bộ lọc từ *"All objects"* sang chế độ ***"Objects allocated between Snapshot 1 and Snapshot 2"***.
   - **Nguyên lý khoa học:** Mọi đối tượng khởi tạo cố định của hệ thống đã nằm trong \`S1\`. Mọi đối tượng tạm thời đang phục vụ đợt tải cuối nằm giữa \`S2\` và \`S3\`. Do đó, bất kỳ đối tượng nào được tạo ra giữa \`S1\` và \`S2\` mà **vẫn còn sống sót ở thời điểm chụp \`S3\`** thì 99.9% chính là đối tượng bị rò rỉ! Sắp xếp cột **\`Retained Size\`** giảm dần và mở rộng bảng **\`Retainers\`** ở nửa dưới màn hình sẽ chỉ thẳng ra tên biến và số dòng code đang giữ chân đối tượng.

Bảng dưới đây tổng hợp các triệu chứng suy thoái bộ nhớ đặc trưng trên Production, công cụ thu thập bằng chứng và giải pháp xử lý ở tầng kiến trúc:

| Triệu chứng quan sát trên hệ thống giám sát | Cờ CLI / Công cụ chẩn đoán chuyên dụng | Dấu hiệu nhận diện trong Báo cáo / Heap Snapshot | Nguyên nhân gốc rễ điển hình | Phương pháp khắc phục chuẩn Production |
| :--- | :--- | :--- | :--- | :--- |
| **Biểu đồ \`heapUsed\` hình răng cưa dốc đứng lên mãi không hạ đáy** | Chụp 3 bản Snapshot qua \`v8.writeHeapSnapshot()\` hoặc cờ \`--heapsnapshot-signal=SIGUSR2\` | Cột \`# Delta\` dương liên tục cho các lớp \`Closure\`, \`Object\` hoặc mục từ trong \`Map\` / \`Array\` | Lưu tích lũy dữ liệu vào \`Map\`/\`Array\` toàn cục hoặc quên \`removeListener\` / \`unsubscribe\` | Thay thế bằng **Bounded LRU Cache**, dùng \`WeakMap\` cho metadata đối tượng, và hủy đăng ký trong \`req.on('close')\` |
| **Pod bị \`OOMKilled (Exit 137)\` đột ngột khi \`heapUsed\` chỉ ở mức \`< 25%\`** | Giám sát \`process.memoryUsage().external\` và \`arrayBuffers\` qua Prometheus | Chỉ số \`rss\` và \`external\` tăng vọt hàng trăm MB trong khi \`Heap Snapshot\` của V8 lại rất nhỏ | Nạp toàn bộ tệp tin lớn vào RAM (\`fs.readFile\`), tích tụ \`Buffer.concat\`, hoặc rò rỉ ở thư viện C++ (\`sharp\`) | Chuyển sang xử lý luồng chảy **\`Readable.pipe(Writable)\`** với \`highWaterMark\` cố định (\`64 KB\`) kèm cơ chế Backpressure |
| **CPU vọt lên \`100%\` và độ trễ API tăng gấp 20 lần trước khi sập tiến trình** | Khởi chạy với cờ \`node --trace-gc dist/main.js\` để đọc nhật ký thu gom rác | Nhật ký in liên tục \`[Mark-sweep ... 140.5 ms]\` cách nhau vài trăm mili-giây nhưng chỉ thu hồi được vài MB (**GC Thrashing**) | \`Old Generation\` đã đầy \`98%\` bởi các đối tượng còn liên kết mạnh; V8 tuyệt vọng chạy Full GC liên tục trong vô vọng | Tăng \`--max-old-space-size\` nếu là dữ liệu hợp lệ cần giữ, hoặc cắt đứt đường dẫn \`Retaining Path\` của bộ đệm gây rò rỉ |
| **Dung lượng lớp \`(sliced string)\` chiếm hàng trăm MB trong Snapshot** | Kiểm tra bảng \`Constructor -> (string) / (sliced string)\` trong Chrome DevTools | Hàng nghìn chuỗi ngắn (\`20 – 50 ký tự\`) có \`Shallow Size = 32 B\` nhưng \`Retained Size\` trỏ về các chuỗi mẹ \`> 1 MB\` | Trích xuất mã định danh/header bằng \`.slice()\` hoặc \`RegExp\` từ chuỗi JSON/HTML lớn rồi lưu vào bộ nhớ đệm | Ép V8 sao chép thành chuỗi phẳng độc lập trước khi lưu cache: \`Buffer.from(sub).toString('utf8')\` |
| **Thời gian dừng \`Scavenge (Minor GC)\` kéo dài bất thường (\`> 15 ms\`)** | Chạy \`node --trace-gc --trace-gc-nvp\` kiểm tra tỷ lệ \`promoted\` và kích thước \`new_space\` | Cột \`promoted\` chiếm tới \`60% – 80%\` tổng dung lượng \`From-Space\` ở mỗi chu kỳ Minor GC | Khởi tạo lô đối tượng quá lớn trong 1 vòng lặp vượt quá dung lượng \`Semi-space\` mặc định (\`16 MB\`) | Chia nhỏ lô xử lý (**Chunking / Cursor Pagination**) hoặc tăng kích thước bán không gian bằng \`--max-semi-space-size=64\` |

> **Tổng kết học thuật Phần 3 (Quy tắc vận hành và chẩn đoán không xâm lấn trên Production):**
> Tuyệt đối không mở cổng \`--inspect\` công khai ra mạng Internet trên môi trường Production. Thay vào đó, hãy cấu hình cờ **\`--heapsnapshot-signal=SIGUSR2\`** hoặc xây dựng một Admin Endpoint nội bộ được bảo vệ nghiêm ngặt gọi hàm \`v8.writeHeapSnapshot()\` kết hợp rút Pod ra khỏi Load Balancer (vì quá trình tuần tự hóa Heap Snapshot ra ổ đĩa sẽ khóa luồng chính \`Stop-The-World\` trong vài giây).

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Bộ Nhớ V8 & Thu Gom Rác (V8 Memory & GC Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG KHÔNG GIAN ĐỊA CHỈ TIẾN TRÌNH & CONTAINER (OS & CGROUPS RSS LAYER)    │
│    [ Linux cgroups Limit (Trần RAM Pod) ] ◄───► [ V8 JS Heap (Young & Old Gen) ] ◄───► [ C++ External Buffer (Ngoài Heap) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Phân bổ trang nhớ ảo (mmap) & Write Barrier
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG BỘ NHỚ ĐỐI TƯỢNG PHÂN THẾ HỆ (V8 GENERATIONAL HEAP SPACES LAYER)      │
│    ├── Young Gen (16-64MB): Chia đôi From-Space & To-Space cho đối tượng mới  │
│    ├── Old Gen (1-4GB): Chứa Singleton, Cache sống sót qua 2 chu kỳ Minor GC  │
│    └── Large Object Space (>256KB): Cấp phát thẳng, không di chuyển địa chỉ   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Truy vết đồ thị từ GC Roots & Dominator Tree
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG ĐỘNG CƠ THU GOM RÁC ORINOCO (ORINOCO GARBAGE COLLECTION ENGINE LAYER) │
│    ├── Minor GC (Cheney Scavenge): Sao chép đối tượng sống cực nhanh (~1-2ms) │
│    ├── Major GC (Tri-color Mark-Sweep-Compact): Đánh dấu 3 màu & chống mảnh   │
│    └── Weak References (WeakMap/WeakRef): Giữ liên kết yếu không chặn thu hồi │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Quản Trị Vòng Đời Đối Tượng (Unbounded Retaining Leak vs Bounded GC-Friendly Lifecycle)
\`\`\`diagram
MÔ HÌNH CŨ: NEO GIỮ THAM CHIẾU MẠNH TRONG SINGLETON (UNBOUNDED RETAINING LEAK)
Tạo Request ──► [ Đẩy vào Map / Emitter toàn cục ] ──► [ Lọt lên Old Gen ] ──► CRASH OOM (EXIT 137)
10,000 Requests = Giữ chặt Closure & Buffer, gây GC Thrashing treo cứng CPU 100%.

MÔ HÌNH HIỆN ĐẠI: CÔ LẬP PHẠM VI & GIỚI HẠN DUNG LƯỢNG (BOUNDED GC-FRIENDLY LIFECYCLE)
Request 1 ──┐
Request 2 ──┼──► [ Xử lý trong Young Gen & WeakMap ] ──► Minor GC dọn sạch trong 1ms
Request 3 ──┘                     │
                                  └──► Bounded LRU & Unsubscribe ────► RAM phẳng lặng 24/7
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chẩn Đoán Sự Cố Tràn Bộ Nhớ OOM & Rò Rỉ RAM Trên Production)
\`\`\`diagram
                  TIẾN TRÌNH NODE.JS TRÊN KUBERNETES POD BỊ TĂNG RAM HOẶC CRASH OOM?
                                                  │
                                                  ▼
                         Kiểm tra tương quan giữa heapUsed và rss / external?
                         /                                                  \\
       RSS TĂNG VỌT NHƯNG HEAPUSED THẤP                         HEAPUSED TĂNG DỐC ĐỨNG CHẠM TRẦN
                     /                                                                \\
                    ▼                                                                  ▼
   [ RÒ RỈ C++ BUFFER NGOÀI HEAP (LỖI) ]                      Phân tích 3 bản chụp Heap Snapshot (S1-S2-S3)?
   - Tích tụ Buffer.concat hoặc đọc file lớn                  /                                            \\
   - V8 không biết áp lực RAM để kích hoạt GC       RETAINED SIZE TẬP TRUNG Ở MAP/ARRAY          RETAINED SIZE Ở CLOSURE / EMITTER
   - Giải pháp: Chuyển sang dùng Stream.pipe()                /                                                      \\
                                                             ▼                                                        ▼
                                            [ ÁP DỤNG BOUNDED LRU / WEAKMAP (CHUẨN) ]                [ CẮT ĐỨT RETAINING PATH (TỐI ƯU) ]
                                            - Áp trần maxSize & maxBytes cho bộ đệm                  - Gọi removeListener / unsubscribe
                                            - Dùng WeakMap gắn metadata theo đối tượng               - Tách biến lớn khỏi phạm vi Closure
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Cơ Chế Thu Gom Rác & Quản Trị Tham Chiếu Trong V8)

| Tiêu Chí So Sánh | Minor GC (Cheney Scavenge - Young Gen) | Major GC (Mark-Sweep-Compact - Old Gen) | Quản Trị Chủ Động (WeakMap & Bounded LRU Cache) |
| :--- | :--- | :--- | :--- |
| **Mục tiêu xử lý cốt lõi** | Thu hồi siêu tốc 95% đối tượng ngắn hạn sinh ra trong vòng đời 1 HTTP Request | Thu hồi đối tượng sống lâu đã hết giá trị và dồn trang chống phân mảnh bộ nhớ | Ngăn chặn từ gốc việc đối tượng ngắn hạn bị neo giữ bất hợp pháp lên \`Old Generation\` |
| **Chi phí CPU & Độ trễ STW** | Rất thấp (\`~0.5 – 2.5 ms\`), tỷ lệ thuận với số lượng đối tượng sống sót | Cao (\`~10 – 150 ms+\`), tỷ lệ thuận với tổng quy mô đồ thị bộ nhớ \`Old Space\` | Chi phí \`O(1)\` ngay tại thời điểm truy cập; triệt tiêu hoàn toàn nguy cơ \`GC Thrashing\` |
| **Cơ chế giải phóng bộ nhớ** | Sao chép đối tượng sống sang \`To-Space\` rồi xóa trắng cả bán vùng \`From-Space\` | Duyệt đồ thị 3 màu (\`Trắng/Xám/Đen\`), đưa ô Trắng vào \`Free-list\` và dịch chuyển trang | Tự động đứt liên kết yếu khi mất tham chiếu gốc (\`WeakMap\`) hoặc trục xuất phần tử cũ nhất (\`LRU\`) |
| **Quy tắc cấu hình Production** | Tăng \`--max-semi-space-size=64\` nếu ứng dụng cấp phát nhiều đối tượng tạm trên mỗi request | Đặt \`--max-old-space-size\` ở mức \`70% – 75%\` giới hạn RAM của Container (\`cgroups\`) | Bắt buộc áp dụng cho mọi bộ đệm trong \`Singleton Service\` và quản lý kết nối \`SSE/WebSocket\` |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`SseConnectionLeakGuardService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề bất biến về chi phí thu gom thế hệ trẻ (\`Generational Scavenge Mortality Invariant\`):** Trong phân vùng \`Young Generation\`, thuật toán Cheney Scavenge chỉ tốn chi phí CPU để sao chép các đối tượng **còn sống sót** sang \`To-Space\`, còn các đối tượng đã chết được giải phóng với chi phí bằng không. Do đó, giữ cho các đối tượng trung gian của HTTP Request mất tham chiếu ngay trong hàm cục bộ là cách duy nhất để duy trì độ trễ \`Stop-The-World\` dưới \`2 ms\`.
2. **Định đề Cây thống trị và Kích thước giữ chân (\`Dominator Tree & Retained Size Invariant\`):** Dung lượng bộ nhớ rò rỉ thực sự của một đối tượng không nằm ở kích thước bản thân nó (\`Shallow Size\`), mà nằm ở tổng dung lượng của toàn bộ nhánh đồ thị con chỉ có thể chạm tới từ \`GC Roots\` duy nhất thông qua đối tượng đó (**\`Retained Size\`**). Cắt đứt liên kết tại nút thống trị trực tiếp (\`Immediate Dominator\`) sẽ giải phóng tức thì toàn bộ nhánh cây bên dưới.
3. **Định đề cân bằng ngân sách bộ nhớ Container (\`Container RSS & Off-Heap Budget Invariant\`):** Tổng bộ nhớ vật lý của tiến trình Node.js (\`RSS\`) luôn bằng tổng của \`V8 Heap\` cộng với vùng nhớ C++ ngoài Heap (\`external / Buffers\`) và \`Code/Stack Space\`. Nếu không khống chế \`--max-old-space-size\` ở mức \`70% – 75%\` giới hạn \`cgroups\` hoặc để rò rỉ \`Buffer\` ngoài Heap, nhân Linux sẽ kích hoạt **OOM Killer (\`SIGKILL - Exit Code 137\`)** trước cả khi V8 kịp chạy thu gom rác.
4. **Định đề kỷ luật vòng đời Singleton (\`Singleton Retaining Path Discipline\`):** Mọi \`Service\`, \`Controller\` và \`Gateway\` mặc định trong NestJS đều là đối tượng bất tử nằm ở \`Old Generation\`. Nghiêm cấm sử dụng cấu trúc dữ liệu không giới hạn (\`Unbounded Map/Array\`) hoặc đăng ký \`EventEmitter\` / \`RxJS Subscription\` trong Singleton mà không đi kèm cơ chế trục xuất (\`Bounded LRU Eviction\`), tham chiếu yếu (\`WeakMap\`) và móc dọn dẹp vòng đời (\`OnModuleDestroy\`).
  `,
  realCodeSnippet: `// File: src/infrastructure/streaming/sse-connection-leak-guard.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Hệ Thống Phòng Thủ Rò Rỉ Bộ Nhớ Kết Nối SSE & Tự Động Áp Lực Ngược Heap
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription } from 'rxjs';
import * as v8 from 'v8';

export interface ClientSessionContext {
  readonly clientId: string;
  readonly tenantId: string;
  readonly connectedAtMs: number;
}

export interface MemoryHealthReport {
  readonly activeClients: number;
  readonly heapUsedMb: number;
  readonly heapLimitMb: number;
  readonly heapPressurePct: number;
  readonly isBackpressureActive: boolean;
}

/**
 * Dịch vụ Quản trị Vòng đời Kết nối Server-Sent Events (SSE) chống Memory Leak (ADR-0019):
 * 1. Sử dụng WeakMap để lưu trữ siêu dữ liệu gắn với đối tượng phiên mà không tạo Strong Retaining Path.
 * 2. Áp dụng giới hạn dung lượng cứng (Bounded LRU Eviction) để ngăn chặn tràn Old Generation.
 * 3. Tích hợp FinalizationRegistry & OnModuleDestroy để dọn dẹp triệt để Closure và RxJS Subscription.
 */
@Injectable()
export class SseConnectionLeakGuardService implements OnModuleDestroy {
  private readonly logger = new Logger(SseConnectionLeakGuardService.name);
  private readonly maxActiveStreams = 2000;
  private readonly highWaterMarkPct = 80;

  private readonly activeStreams = new Map<string, Subject<string>>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly contextMetadata = new WeakMap<ClientSessionContext, { lastPingMs: number }>();

  private readonly finalizationRegistry = new FinalizationRegistry<string>((reclaimedClientId) => {
    this.logger.debug(\`GC đã thu hồi vùng nhớ của phiên [\${reclaimedClientId}], đảm bảo giải phóng stream.\`);
    this.unregisterClient(reclaimedClientId);
  });

  public registerClient(context: ClientSessionContext): Subject<string> {
    const { clientId } = context;

    // 1. Kiểm tra áp lực bộ nhớ V8 Heap trước khi cấp phát kết nối dài hạn mới
    const health = this.inspectHeapHealth();
    if (health.isBackpressureActive || this.activeStreams.size >= this.maxActiveStreams) {
      const oldestClientId = this.activeStreams.keys().next().value;
      if (oldestClientId !== undefined) {
        this.logger.warn(\`Đạt ngưỡng bộ nhớ/kết nối, trục xuất kết nối cũ nhất: [\${oldestClientId}]\`);
        this.unregisterClient(oldestClientId);
      }
    }

    // 2. Nếu clientId đã tồn tại, hủy kết nối cũ để tránh rò rỉ chồng lấp
    this.unregisterClient(clientId);

    const stream$ = new Subject<string>();
    this.activeStreams.set(clientId, stream$);

    // 3. Gắn metadata vào WeakMap và đăng ký theo dõi thu hồi rác tự động
    this.contextMetadata.set(context, { lastPingMs: Date.now() });
    this.finalizationRegistry.register(context, clientId);

    const sub = stream$.subscribe({
      error: () => this.unregisterClient(clientId),
      complete: () => this.unregisterClient(clientId),
    });
    this.subscriptions.set(clientId, sub);

    return stream$;
  }

  public unregisterClient(clientId: string): void {
    const sub = this.subscriptions.get(clientId);
    if (sub) {
      sub.unsubscribe(); // Cắt đứt hoàn toàn Closure Retaining Path
      this.subscriptions.delete(clientId);
    }

    const stream$ = this.activeStreams.get(clientId);
    if (stream$) {
      stream$.complete();
      this.activeStreams.delete(clientId);
    }
  }

  public inspectHeapHealth(): MemoryHealthReport {
    const stats = v8.getHeapStatistics();
    const heapUsedMb = Math.round((stats.used_heap_size / (1024 * 1024)) * 100) / 100;
    const heapLimitMb = Math.round((stats.heap_size_limit / (1024 * 1024)) * 100) / 100;
    const heapPressurePct = Math.round((stats.used_heap_size / stats.heap_size_limit) * 10000) / 100;

    return {
      activeClients: this.activeStreams.size,
      heapUsedMb,
      heapLimitMb,
      heapPressurePct,
      isBackpressureActive: heapPressurePct >= this.highWaterMarkPct,
    };
  }

  public onModuleDestroy(): void {
    this.logger.log(\`Đóng và giải phóng \${this.activeStreams.size} kết nối SSE trước khi dừng Pod...\`);
    for (const clientId of this.activeStreams.keys()) {
      this.unregisterClient(clientId);
    }
  }
}`,
  quiz: [
    {
      id: 'c1-l3-q1',
      question: 'Ý nghĩa kỹ thuật chính xác nhất của chỉ số Retained Size khi phân tích Heap Snapshot bằng Chrome DevTools là gì?',
      options: [
        'Dung lượng bộ nhớ thực tế chỉ do bản thân cấu trúc đầu mục và các trường nguyên thủy trực tiếp của đối tượng đó chiếm giữ trên V8 Heap (không tính tới các đối tượng con).',
        'Tổng dung lượng RAM vật lý (RSS) của toàn bộ tiến trình Node.js bao gồm cả vùng nhớ C++ ngoài Heap và khung ngăn xếp Call Stack tại thời điểm thực hiện chụp bản snapshot.',
        'Tổng dung lượng Heap được giải phóng ngay khi đối tượng này bị xóa cùng toàn bộ nhánh cây thống trị độc quyền phụ thuộc vào nó (Dominator Tree) được bộ thu gom rác thu hồi.',
        'Tổng dung lượng bộ nhớ của tất cả các đối tượng mà đối tượng này có liên kết trỏ tới, kể cả các đối tượng đang được dùng chung và giữ sống bởi các gốc GC Root độc lập khác.'
      ],
      correctIndex: 2,
      explanation: 'Shallow Size chỉ phản ánh kích thước của bản thân đối tượng. Ngược lại, Retained Size bằng Shallow Size của đối tượng đó cộng với toàn bộ các đối tượng con nằm trong nhánh cây thống trị độc quyền (Dominator Tree) chỉ có thể chạm tới từ GC Roots duy nhất thông qua nó. Đây là chỉ số quan trọng nhất để tìm thủ phạm gây Memory Leak.'
    },
    {
      id: 'c1-l3-q2',
      question: 'Tại sao thuật toán Cheney Scavenge trong phân vùng Young Generation (Semi-space) lại đạt tốc độ thu gom cực nhanh (~1-2ms) mà không cần duyệt qua các đối tượng đã chết?',
      options: [
        'Vì dựa trên Giả thuyết thế hệ yếu (95% đối tượng chết trẻ), nó chỉ sao chép số ít đối tượng còn sống từ From-Space sang To-Space rồi xóa trắng From-Space bằng phép đặt lại con trỏ.',
        'Vì nó gắn một bộ đếm tham chiếu phần cứng trên từng ô nhớ của Young Generation, giải phóng tức thì các đối tượng có bộ đếm về 0 ngay tại thời điểm kết thúc hàm mà không dừng luồng.',
        'Vì nó chuyển toàn bộ dữ liệu của Young Generation xuống bộ nhớ đệm L3 Cache của vi xử lý và sử dụng tập lệnh vector hóa SIMD để xóa các ô nhớ trống đồng thời trên 16 luồng phần cứng.',
        'Vì nó không bao giờ di chuyển địa chỉ vật lý của bất kỳ đối tượng nào trên thanh RAM mà chỉ đánh dấu các bit trạng thái vào bảng chỉ mục phân trang của nhân hệ điều hành Linux.'
      ],
      correctIndex: 0,
      explanation: 'Theo Giả thuyết thế hệ yếu (Weak Generational Hypothesis), đại đa số đối tượng sinh ra trong HTTP Request đều chết ngay lập tức. Thuật toán Cheney Scavenge chỉ duyệt từ GC Roots + Remembered Set để chép phần trăm rất nhỏ các đối tượng còn sống sang To-Space (vừa thu gom vừa chống phân mảnh), rồi hoán đổi hai bán vùng mà hoàn toàn không tốn chu kỳ CPU nào cho các đối tượng đã chết.'
    },
    {
      id: 'c1-l3-q3',
      question: 'Hiện tượng một Container Node.js trên Kubernetes bị tiêu diệt đột ngột với mã lỗi OOMKilled (Exit Code 137) dù chỉ số heapUsed giám sát được vẫn ở mức rất thấp (< 20% giới hạn) bắt nguồn từ nguyên nhân kiến trúc nào?',
      options: [
        'Thuật toán Mark-Sweep-Compact gặp hiện tượng khóa chết (Deadlock) giữa các luồng thu gom rác nền, khiến Kubernetes Liveness Probe hiểu lầm tiến trình bị treo và gửi tín hiệu hủy Pod.',
        'Bộ nhớ cấp phát ngoài V8 Heap ở tầng C++ (như Buffer, ArrayBuffer hoặc Stream chưa xả) tăng vọt làm tổng RSS vượt trần cgroups của Container mà V8 không chịu áp lực để chạy GC.',
        'Hiện tượng phân mảnh bộ nhớ trong phân vùng Young Generation khiến con trỏ cấp phát Bump-pointer không thể tìm được ô nhớ trống liên tục dù tổng dung lượng Old Generation vẫn còn dư dả.',
        'Khung ngăn xếp Call Stack của các luồng trong bể luồng Libuv Threadpool bị tràn do thực thi truy vấn cơ sở dữ liệu bất đồng bộ, buộc nhân Linux phải thu hồi toàn bộ tiến trình.'
      ],
      correctIndex: 1,
      explanation: 'Dữ liệu nhị phân của Buffer/ArrayBuffer được cấp phát ở vùng nhớ C++ ngoài V8 Heap (nằm trong chỉ số external và rss), trong khi trên V8 Heap chỉ lưu một đối tượng vỏ bọc nhỏ vài chục byte. Do heapUsed vẫn rất thấp, V8 không nhận thấy áp lực bộ nhớ để chạy Major GC, nhưng tổng dung lượng RAM vật lý (RSS) đã vượt trần cgroups của Container khiến Linux OOM Killer bắn tín hiệu SIGKILL.'
    },
    {
      id: 'c1-l3-q4',
      question: 'Cơ chế Rào chắn ghi (Write Barrier) và Tập hợp ghi nhớ (Remembered Set / Card Table) trong V8 Engine giải quyết bài toán kỹ thuật cốt lõi nào?',
      options: [
        'Ngăn chặn hai luồng Worker Threads cùng lúc ghi dữ liệu nhị phân vào một vùng nhớ SharedArrayBuffer gây ra lỗi xung đột dữ liệu (Data Race) ở tầng bộ nhớ đệm của vi xử lý.',
        'Mã hóa toàn bộ các con trỏ địa chỉ trên phân vùng Old Generation nhằm ngăn chặn các cuộc tấn công ghi đè tràn bộ đệm (Buffer Overflow) từ dữ liệu đầu vào bất hợp lệ của người dùng.',
        'Ghi nhận mọi vị trí mà đối tượng ở Old Generation trỏ sang đối tượng ở Young Generation, giúp Minor GC biết đối tượng trẻ nào còn sống mà không cần quét toàn bộ Old Generation.',
        'Đóng băng tạm thời toàn bộ các thuộc tính của đối tượng trong quá trình tuần tự hóa JSON.stringify để đảm bảo cấu trúc Hidden Class (Map) không bị biến đổi giữa chừng trên luồng chính.'
      ],
      correctIndex: 2,
      explanation: 'Nếu một đối tượng ở Old Generation (ví dụ một Singleton Service) có thuộc tính trỏ tới một đối tượng mới ở Young Generation, Minor GC bắt buộc phải biết liên kết này để không xóa nhầm đối tượng trẻ đó. Thay vì quét toàn bộ hàng GB của Old Gen, V8 dùng Write Barrier để chặn ngay tại lệnh gán con trỏ và ghi địa chỉ đó vào Remembered Set làm gốc tìm kiếm phụ trợ cho Minor GC.'
    },
    {
      id: 'c1-l3-q5',
      question: 'Trong thuật toán Đánh dấu ba màu (Tri-color Marking) của Major GC, một đối tượng mang "Màu Xám" (Grey) đại diện cho trạng thái kỹ thuật nào?',
      options: [
        'Đối tượng chưa từng được bộ thu gom rác duyệt tới kể từ đầu chu kỳ đánh dấu và là ứng viên sẽ bị thu hồi về danh sách vùng nhớ tự do Free-list khi chuyển sang pha Sweeping.',
        'Đối tượng đã được chạm tới từ GC Roots (xác nhận còn sống), nhưng các thuộc tính và đối tượng con trực tiếp mà nó trỏ tới vẫn chưa được kiểm tra xong trong Marking Worklist.',
        'Đối tượng đã được duyệt hoàn tất cả bản thân nó lẫn toàn bộ các con trỏ trực tiếp của nó, đảm bảo không còn bất kỳ liên kết trực tiếp nào nối sang các đối tượng mang màu Trắng.',
        'Đối tượng nằm ở vùng nhớ trung gian giữa V8 Heap và vùng nhớ C++ Off-heap, đang chờ nhân hệ điều hành Linux xác nhận quyền giải phóng trang nhớ ảo trước khi thu hồi vật lý.'
      ],
      correctIndex: 1,
      explanation: 'Trong mô hình Tri-color Marking của V8: Màu Trắng là đối tượng chưa được thăm (ứng viên rác); Màu Xám là biên giới tìm kiếm — đối tượng đã được phát hiện là còn sống nhưng các con trỏ bên trong nó chưa được duyệt hết; còn Màu Đen là đối tượng đã được quét xong toàn bộ liên kết con trực tiếp và chắc chắn được giữ lại.'
    },
    {
      id: 'c1-l3-q6',
      question: 'Tại sao việc cắt một chuỗi con ngắn (ví dụ 20 ký tự bằng .slice(0, 20)) từ một chuỗi JSON/HTML gốc nặng 10MB rồi lưu chuỗi con đó vào bộ nhớ đệm toàn cục lại có thể gây rò rỉ bộ nhớ nghiêm trọng?',
      options: [
        'Vì phương thức .slice() luôn nhân đôi toàn bộ chuỗi gốc 10MB sang phân vùng Large Object Space của V8 Heap mỗi khi được gọi và không bao giờ tự động giải phóng các bản sao này.',
        'Vì V8 tạo cấu trúc SlicedString chỉ lưu offset/length cùng con trỏ trỏ thẳng vào chuỗi mẹ 10MB; việc giữ sống chuỗi con 20 ký tự trong cache sẽ vô tình neo giữ cả 10MB chuỗi mẹ.',
        'Vì mọi chuỗi con được tạo ra từ phương thức .slice() đều tự động được đăng ký vào bảng hằng số chuỗi Interned String Table vĩnh viễn của bộ thông dịch Bytecode Ignition.',
        'Vì các chuỗi ngắn dưới 32 ký tự làm bẻ gãy cấu trúc Hidden Class của đối tượng bộ nhớ đệm Map, buộc V8 phải cấp phát thêm các bảng băm từ điển phụ trợ trên vùng Old Generation.'
      ],
      correctIndex: 1,
      explanation: 'Để tránh chi phí sao chép bộ nhớ khi cắt chuỗi, V8 tạo ra đối tượng SlicedString có Shallow Size chỉ vài chục byte nhưng bên trong chứa con trỏ parent trỏ về chuỗi gốc ban đầu. Khi chuỗi con này được lưu vào Cache của Singleton, nó trở thành nút thống trị (Dominator) giữ chặt chuỗi mẹ 10MB không cho GC thu hồi.'
    },
    {
      id: 'c1-l3-q7',
      question: 'Trong Quy trình săn tìm Memory Leak bằng Ba Bản Chụp (Three-Snapshot Forensics Technique: S1 -> S2 -> S3), tại sao việc lọc "Objects allocated between Snapshot 1 and Snapshot 2" khi đang xem Snapshot 3 lại giúp tìm ra chính xác đối tượng rò rỉ?',
      options: [
        'Vì bộ lọc này loại bỏ các đối tượng cố định (có trước S1) và đối tượng tạm thời (tạo giữa S2-S3), chỉ giữ lại các đối tượng sinh ra giữa S1-S2 mà lẽ ra phải chết nhưng vẫn tồn tại ở S3.',
        'Vì công cụ Chrome DevTools chỉ kích hoạt thuật toán tính toán chỉ số Retained Size và dựng cây Dominator Tree khi kỹ sư chọn chế độ so sánh khoảng cách giữa bản chụp S1 và bản chụp S2.',
        'Vì bản chụp S1 chỉ ghi nhận các đối tượng thuộc phân vùng Young Generation, bản chụp S2 chỉ ghi nhận phân vùng Old Generation, còn bản chụp S3 chỉ ghi nhận vùng nhớ C++ External Buffer.',
        'Vì thao tác chụp 3 bản liên tiếp buộc V8 Engine phải tạm ngừng trình biên dịch tối ưu TurboFan và chuyển đổi toàn bộ các đối tượng trên Heap về chế độ từ điển giúp đọc tên biến rõ hơn.'
      ],
      correctIndex: 0,
      explanation: 'Một bản chụp đơn lẻ chứa hàng trăm nghìn đối tượng hợp lệ của NestJS. Khi lấy S1 sau khi đã làm ấm hệ thống, chạy kịch bản nghi ngờ rồi chụp S2, sau đó chạy thêm tải và chụp S3, mọi đối tượng hợp lệ của request trong giai đoạn S1->S2 lẽ ra phải bị GC thu hồi trước khi chụp S3. Những đối tượng tạo giữa S1-S2 mà vẫn còn tồn tại ở S3 chính là các đối tượng bị rò rỉ.'
    },
    {
      id: 'c1-l3-q8',
      question: 'Dựa trên mẫu thiết kế phòng thủ trong lớp SseConnectionLeakGuardService (realCodeSnippet), sự kết hợp giữa WeakMap, Bounded LRU Map và Subscription.unsubscribe() bảo vệ bộ nhớ của máy chủ NestJS như thế nào?',
      options: [
        'Chuyển toàn bộ các luồng phát sự kiện RxJS Subject sang chạy trên các tiến trình con độc lập (Child Processes) để khi rò rỉ bộ nhớ xảy ra thì chỉ có tiến trình con bị khởi động lại.',
        'Dùng WeakMap để gắn metadata không cản trở GC, giới hạn số kết nối tối đa kèm trục xuất kết nối cũ nhất (LRU), và gọi unsubscribe() để cắt đứt hoàn toàn đường giữ tham chiếu Closure.',
        'Ép V8 Engine thực thi câu lệnh thu gom rác global.gc() đồng bộ ngay sau mỗi bản tin Server-Sent Events được gửi đi nhằm giữ cho dung lượng phân vùng Old Generation luôn ở mức tối thiểu.',
        'Lưu trữ toàn bộ trạng thái của các đối tượng Subject và Subscription dưới dạng chuỗi nhị phân đã nén trong Redis để tiến trình Node.js hoàn toàn không phải cấp phát bộ nhớ trên V8 Heap.'
      ],
      correctIndex: 1,
      explanation: 'Trong SseConnectionLeakGuardService, WeakMap giữ liên kết yếu tới ClientSessionContext để không gây rò rỉ metadata; Map activeStreams được kiểm soát bởi ngưỡng maxActiveStreams và áp lực bộ nhớ v8.getHeapStatistics() để tự động trục xuất kết nối cũ nhất theo thứ tự chèn (LRU); đồng thời unregisterClient luôn gọi sub.unsubscribe() và stream$.complete() để giải phóng toàn bộ hàm callback Closure.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Ngân Sách RAM Container & Chẩn Đoán Rủi Ro OOM (Container Memory Budget Analyzer)',
    description: 'Áp dụng công thức quản trị bộ nhớ tiến trình Node.js trên Kubernetes Container ở Phần 2. Viết hàm `evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb)` nhận vào các chỉ số bộ nhớ hiện tại (tính bằng Megabytes) để đánh giá sức khỏe bộ nhớ:\n1. Tính tỷ lệ phần trăm lấp đầy Container: `containerUsagePct = (rssMb / containerLimitMb) * 100` (làm tròn 2 chữ số thập phân).\n2. Tính tỷ lệ phần trăm áp lực trên V8 Heap: `heapPressurePct = (heapUsedMb / oldGenLimitMb) * 100` (làm tròn 2 chữ số thập phân).\n3. Tính ngưỡng cấu hình `--max-old-space-size` khuyến nghị theo quy tắc 75% dung lượng Container: `recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)`.\n4. Phân loại trạng thái `status` theo thứ tự ưu tiên từ nghiêm trọng nhất xuống bình thường:\n   - Nếu `containerUsagePct >= 90`: `status = "CRITICAL_OOM_IMMINENT"` (Sắp bị Linux Kernel OOM Killer bắn tín hiệu SIGKILL).\n   - Ngược lại, nếu `containerUsagePct >= 75 && heapPressurePct < 50`: `status = "OFF_HEAP_OOM_RISK"` (Nghịch lý Heap thấp nhưng RSS cao do rò rỉ C++ Buffer/External).\n   - Ngược lại, nếu `heapPressurePct >= 80`: `status = "OLD_GEN_GC_PRESSURE"` (Áp lực Major GC cao trên V8 Heap).\n   - Ngược lại: `status = "HEALTHY"`.\nTrả về `{ containerUsagePct, heapPressurePct, recommendedOldGenMb, status }`.',
    guidedSteps: [
      'Bước 1 (Tính tỷ lệ phần trăm và làm tròn): Tính `containerUsagePct = Math.round(((rssMb / containerLimitMb) * 100) * 100) / 100` và `heapPressurePct = Math.round(((heapUsedMb / oldGenLimitMb) * 100) * 100) / 100`.',
      'Bước 2 (Tính ngưỡng Old Gen khuyến nghị): Tính `recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)`.',
      'Bước 3 (Phân loại trạng thái status theo đúng thứ tự ưu tiên): Kiểm tra lần lượt `containerUsagePct >= 90` -> `"CRITICAL_OOM_IMMINENT"`, tiếp theo `containerUsagePct >= 75 && heapPressurePct < 50` -> `"OFF_HEAP_OOM_RISK"`, tiếp theo `heapPressurePct >= 80` -> `"OLD_GEN_GC_PRESSURE"`, còn lại -> `"HEALTHY"`.',
      'Bước 4 (Đóng gói kết quả): Trả về object `{ containerUsagePct, heapPressurePct, recommendedOldGenMb, status }`.'
    ],
    hints: [
      'Hãy tuân thủ đúng thứ tự `if / else if`: Kiểm tra `containerUsagePct >= 90` ở nhánh đầu tiên vì khi RSS đã chạm 90% giới hạn cgroups, nguy cơ bị Linux OOM Killer tiêu diệt là khẩn cấp nhất bất kể Heap cao hay thấp.',
      'Để làm tròn một số thực `x` đến 2 chữ số thập phân chuẩn xác trong JavaScript, luôn sử dụng `Math.round(x * 100) / 100`.'
    ],
    starterCode: `function evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb) {
  // Bước 1: Tính containerUsagePct và heapPressurePct (làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)
  
  // Bước 3: Phân loại status ("CRITICAL_OOM_IMMINENT" | "OFF_HEAP_OOM_RISK" | "OLD_GEN_GC_PRESSURE" | "HEALTHY")
  
  // Bước 4: Trả về { containerUsagePct, heapPressurePct, recommendedOldGenMb, status }
}`,
    solution: `function evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb) {
  const containerUsagePct = Math.round(((rssMb / containerLimitMb) * 100) * 100) / 100;
  const heapPressurePct = Math.round(((heapUsedMb / oldGenLimitMb) * 100) * 100) / 100;
  const recommendedOldGenMb = Math.floor(containerLimitMb * 0.75);

  let status = 'HEALTHY';
  if (containerUsagePct >= 90) {
    status = 'CRITICAL_OOM_IMMINENT';
  } else if (containerUsagePct >= 75 && heapPressurePct < 50) {
    status = 'OFF_HEAP_OOM_RISK';
  } else if (heapPressurePct >= 80) {
    status = 'OLD_GEN_GC_PRESSURE';
  }

  return {
    containerUsagePct,
    heapPressurePct,
    recommendedOldGenMb,
    status
  };
}`,
    testCases: [
      {
        name: 'Hệ thống hoạt động ổn định trong ngưỡng an toàn -> HEALTHY',
        input: [420, 280, 40, 1024, 768],
        expected: {
          containerUsagePct: 41.02,
          heapPressurePct: 36.46,
          recommendedOldGenMb: 768,
          status: 'HEALTHY'
        },
        hidden: false
      },
      {
        name: 'Nghịch lý Heap rất thấp (200MB) nhưng C++ External Buffer phình to đẩy RSS lên 820MB/1024MB -> OFF_HEAP_OOM_RISK',
        input: [820, 200, 550, 1024, 768],
        expected: {
          containerUsagePct: 80.08,
          heapPressurePct: 26.04,
          recommendedOldGenMb: 768,
          status: 'OFF_HEAP_OOM_RISK'
        },
        hidden: false
      },
      {
        name: 'V8 Old Generation đầy 85% gây áp lực thu gom rác Major GC -> OLD_GEN_GC_PRESSURE',
        input: [720, 652.8, 30, 1024, 768],
        expected: {
          containerUsagePct: 70.31,
          heapPressurePct: 85,
          recommendedOldGenMb: 768,
          status: 'OLD_GEN_GC_PRESSURE'
        },
        hidden: false
      },
      {
        name: 'RSS chạm 93.75% giới hạn Container 512MB -> Báo động đỏ CRITICAL_OOM_IMMINENT',
        input: [480, 350, 80, 512, 384],
        expected: {
          containerUsagePct: 93.75,
          heapPressurePct: 91.15,
          recommendedOldGenMb: 384,
          status: 'CRITICAL_OOM_IMMINENT'
        },
        hidden: true
      },
      {
        name: 'Biên chạm đúng 75% RSS với Heap thấp trên Container 2048MB -> OFF_HEAP_OOM_RISK',
        input: [1536, 400, 1000, 2048, 1536],
        expected: {
          containerUsagePct: 75,
          heapPressurePct: 26.04,
          recommendedOldGenMb: 1536,
          status: 'OFF_HEAP_OOM_RISK'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Ngân Sách RAM Container & Chẩn Đoán Rủi Ro OOM (Container Memory Budget Analyzer)',
      description: 'Áp dụng công thức quản trị bộ nhớ tiến trình Node.js trên Kubernetes Container ở Phần 2. Viết hàm `evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb)` nhận vào các chỉ số bộ nhớ hiện tại (tính bằng Megabytes) để đánh giá sức khỏe bộ nhớ:\n1. Tính tỷ lệ phần trăm lấp đầy Container: `containerUsagePct = (rssMb / containerLimitMb) * 100` (làm tròn 2 chữ số thập phân).\n2. Tính tỷ lệ phần trăm áp lực trên V8 Heap: `heapPressurePct = (heapUsedMb / oldGenLimitMb) * 100` (làm tròn 2 chữ số thập phân).\n3. Tính ngưỡng cấu hình `--max-old-space-size` khuyến nghị theo quy tắc 75% dung lượng Container: `recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)`.\n4. Phân loại trạng thái `status` theo thứ tự ưu tiên từ nghiêm trọng nhất xuống bình thường:\n   - Nếu `containerUsagePct >= 90`: `status = "CRITICAL_OOM_IMMINENT"` (Sắp bị Linux Kernel OOM Killer bắn tín hiệu SIGKILL).\n   - Ngược lại, nếu `containerUsagePct >= 75 && heapPressurePct < 50`: `status = "OFF_HEAP_OOM_RISK"` (Nghịch lý Heap thấp nhưng RSS cao do rò rỉ C++ Buffer/External).\n   - Ngược lại, nếu `heapPressurePct >= 80`: `status = "OLD_GEN_GC_PRESSURE"` (Áp lực Major GC cao trên V8 Heap).\n   - Ngược lại: `status = "HEALTHY"`.\nTrả về `{ containerUsagePct, heapPressurePct, recommendedOldGenMb, status }`.',
      guidedSteps: [
        'Bước 1 (Tính tỷ lệ phần trăm và làm tròn): Tính `containerUsagePct = Math.round(((rssMb / containerLimitMb) * 100) * 100) / 100` và `heapPressurePct = Math.round(((heapUsedMb / oldGenLimitMb) * 100) * 100) / 100`.',
        'Bước 2 (Tính ngưỡng Old Gen khuyến nghị): Tính `recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)`.',
        'Bước 3 (Phân loại trạng thái status theo đúng thứ tự ưu tiên): Kiểm tra lần lượt `containerUsagePct >= 90` -> `"CRITICAL_OOM_IMMINENT"`, tiếp theo `containerUsagePct >= 75 && heapPressurePct < 50` -> `"OFF_HEAP_OOM_RISK"`, tiếp theo `heapPressurePct >= 80` -> `"OLD_GEN_GC_PRESSURE"`, còn lại -> `"HEALTHY"`.',
        'Bước 4 (Đóng gói kết quả): Trả về object `{ containerUsagePct, heapPressurePct, recommendedOldGenMb, status }`.'
      ],
      hints: [
        'Hãy tuân thủ đúng thứ tự `if / else if`: Kiểm tra `containerUsagePct >= 90` ở nhánh đầu tiên vì khi RSS đã chạm 90% giới hạn cgroups, nguy cơ bị Linux OOM Killer tiêu diệt là khẩn cấp nhất bất kể Heap cao hay thấp.',
        'Để làm tròn một số thực `x` đến 2 chữ số thập phân chuẩn xác trong JavaScript, luôn sử dụng `Math.round(x * 100) / 100`.'
      ],
      starterCode: `function evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb) {
  // Bước 1: Tính containerUsagePct và heapPressurePct (làm tròn 2 chữ số thập phân)
  
  // Bước 2: Tính recommendedOldGenMb = Math.floor(containerLimitMb * 0.75)
  
  // Bước 3: Phân loại status ("CRITICAL_OOM_IMMINENT" | "OFF_HEAP_OOM_RISK" | "OLD_GEN_GC_PRESSURE" | "HEALTHY")
  
  // Bước 4: Trả về { containerUsagePct, heapPressurePct, recommendedOldGenMb, status }
}`,
      solution: `function evaluateGcHealthAndContainerBudget(rssMb, heapUsedMb, externalMb, containerLimitMb, oldGenLimitMb) {
  const containerUsagePct = Math.round(((rssMb / containerLimitMb) * 100) * 100) / 100;
  const heapPressurePct = Math.round(((heapUsedMb / oldGenLimitMb) * 100) * 100) / 100;
  const recommendedOldGenMb = Math.floor(containerLimitMb * 0.75);

  let status = 'HEALTHY';
  if (containerUsagePct >= 90) {
    status = 'CRITICAL_OOM_IMMINENT';
  } else if (containerUsagePct >= 75 && heapPressurePct < 50) {
    status = 'OFF_HEAP_OOM_RISK';
  } else if (heapPressurePct >= 80) {
    status = 'OLD_GEN_GC_PRESSURE';
  }

  return {
    containerUsagePct,
    heapPressurePct,
    recommendedOldGenMb,
    status
  };
}`,
      testCases: [
        {
          name: 'Hệ thống hoạt động ổn định trong ngưỡng an toàn -> HEALTHY',
          input: [420, 280, 40, 1024, 768],
          expected: {
            containerUsagePct: 41.02,
            heapPressurePct: 36.46,
            recommendedOldGenMb: 768,
            status: 'HEALTHY'
          },
          hidden: false
        },
        {
          name: 'Nghịch lý Heap rất thấp (200MB) nhưng C++ External Buffer phình to đẩy RSS lên 820MB/1024MB -> OFF_HEAP_OOM_RISK',
          input: [820, 200, 550, 1024, 768],
          expected: {
            containerUsagePct: 80.08,
            heapPressurePct: 26.04,
            recommendedOldGenMb: 768,
            status: 'OFF_HEAP_OOM_RISK'
          },
          hidden: false
        },
        {
          name: 'V8 Old Generation đầy 85% gây áp lực thu gom rác Major GC -> OLD_GEN_GC_PRESSURE',
          input: [720, 652.8, 30, 1024, 768],
          expected: {
            containerUsagePct: 70.31,
            heapPressurePct: 85,
            recommendedOldGenMb: 768,
            status: 'OLD_GEN_GC_PRESSURE'
          },
          hidden: false
        },
        {
          name: 'RSS chạm 93.75% giới hạn Container 512MB -> Báo động đỏ CRITICAL_OOM_IMMINENT',
          input: [480, 350, 80, 512, 384],
          expected: {
            containerUsagePct: 93.75,
            heapPressurePct: 91.15,
            recommendedOldGenMb: 384,
            status: 'CRITICAL_OOM_IMMINENT'
          },
          hidden: true
        },
        {
          name: 'Biên chạm đúng 75% RSS với Heap thấp trên Container 2048MB -> OFF_HEAP_OOM_RISK',
          input: [1536, 400, 1000, 2048, 1536],
          expected: {
            containerUsagePct: 75,
            heapPressurePct: 26.04,
            recommendedOldGenMb: 1536,
            status: 'OFF_HEAP_OOM_RISK'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Thuật Toán Cheney Scavenge & Quy Tắc Thăng Cấp Đối Tượng (Minor GC Promotion Simulator)',
      description: 'Áp dụng quy tắc hoạt động của **Minor GC (Cheney Scavenge)** và **Object Promotion** trong V8 Engine đã học ở Phần 1. Viết hàm `simulateGenerationalScavenge(objects, toSpaceCapacityKb)` nhận vào mảng các đối tượng đang nằm trong `From-Space` (`objects`, mỗi phần tử gồm `{ id, sizeKb, age, isReachable, isReferencedByOldGen }`) và tổng dung lượng của bán vùng `To-Space` (`toSpaceCapacityKb`). Hãy mô phỏng một chu kỳ thu gom rác tuần tự theo thứ tự trong mảng:\n1. **Xác định đối tượng còn sống (Live vs Dead):** Một đối tượng còn sống nếu `isReachable === true` (nối từ GC Roots) HOẶC `isReferencedByOldGen === true` (được ghi nhận trong `Remembered Set` qua `Write Barrier`). Nếu cả hai đều `false`, đối tượng đã chết -> cộng `sizeKb` của nó vào `reclaimedKb` (không tốn chi phí sao chép).\n2. **Xác định giới hạn lấp đầy 25% của To-Space:** Ngưỡng thăng cấp sớm là `promotionThresholdKb = toSpaceCapacityKb * 0.25`.\n3. **Duyệt tuần tự từng đối tượng còn sống:**\n   - Nếu đối tượng đã sống qua ít nhất 1 chu kỳ trước đó (`age >= 1`, tức là sau chu kỳ này đạt 2 chu kỳ) HOẶC nếu chép đối tượng này vào `To-Space` sẽ làm tổng dung lượng đã chép vượt ngưỡng 25% (`copiedToSpaceKb + obj.sizeKb > promotionThresholdKb`): đối tượng được **Thăng cấp lên Old Generation** -> cộng `obj.sizeKb` vào `promotedOldGenKb` và đẩy `obj.id` vào mảng `promotedIds`.\n   - Ngược lại: sao chép đối tượng sang `To-Space` -> cộng `obj.sizeKb` vào `copiedToSpaceKb` và đẩy `obj.id` vào mảng `survivingYoungIds`.\n4. Tính thời gian dừng luồng ước lượng `estimatedStwMs = ((copiedToSpaceKb + promotedOldGenKb) * 0.05)` (làm tròn 2 chữ số thập phân). Trả về `{ reclaimedKb, copiedToSpaceKb, promotedOldGenKb, survivingYoungIds, promotedIds, estimatedStwMs }`.',
      guidedSteps: [
        'Bước 1 (Khởi tạo biến thống kê): Khởi tạo `reclaimedKb = 0`, `copiedToSpaceKb = 0`, `promotedOldGenKb = 0`, `survivingYoungIds = []`, `promotedIds = []`, và tính ngưỡng `promotionThresholdKb = toSpaceCapacityKb * 0.25`.',
        'Bước 2 (Phân loại đối tượng chết): Duyệt từng `obj` trong `objects`. Nếu `!obj.isReachable && !obj.isReferencedByOldGen`, cộng `obj.sizeKb` vào `reclaimedKb` và chuyển sang phần tử tiếp theo.',
        'Bước 3 (Xét điều kiện Promotion hay chép sang To-Space): Với đối tượng còn sống, kiểm tra nếu `obj.age >= 1 || (copiedToSpaceKb + obj.sizeKb > promotionThresholdKb)` thì cộng `obj.sizeKb` vào `promotedOldGenKb` và `promotedIds.push(obj.id)`. Ngược lại, cộng `obj.sizeKb` vào `copiedToSpaceKb` và `survivingYoungIds.push(obj.id)`.',
        'Bước 4 (Tính độ trễ Stop-The-World): Tính `estimatedStwMs = Math.round(((copiedToSpaceKb + promotedOldGenKb) * 0.05) * 100) / 100` và trả về đầy đủ 6 trường theo đặc tả.'
      ],
      hints: [
        'Đừng quên kiểm tra `obj.isReferencedByOldGen`: Dù `obj.isReachable === false` từ Call Stack, nhưng nếu một Singleton ở Old Gen đang trỏ tới nó (`isReferencedByOldGen === true`), Write Barrier đã đưa nó vào Remembered Set nên nó VẪN CÒN SỐNG.',
        'Lưu ý điều kiện tràn ngưỡng 25% To-Space: So sánh `copiedToSpaceKb + obj.sizeKb > promotionThresholdKb` (dấu lớn hơn nghiêm ngặt `>`). Nếu bằng đúng ngưỡng 25% và `age < 1`, đối tượng vẫn ở lại `To-Space`.'
      ],
      starterCode: `function simulateGenerationalScavenge(objects, toSpaceCapacityKb) {
  // Bước 1: Khởi tạo các biến đếm và tính promotionThresholdKb = toSpaceCapacityKb * 0.25
  
  // Bước 2: Duyệt mảng objects, nếu chết (!isReachable && !isReferencedByOldGen) -> cộng vào reclaimedKb
  
  // Bước 3: Nếu còn sống -> kiểm tra điều kiện thăng cấp (age >= 1 hoặc vượt ngưỡng 25% To-Space)
  
  // Bước 4: Tính estimatedStwMs và trả về kết quả
}`,
      solution: `function simulateGenerationalScavenge(objects, toSpaceCapacityKb) {
  let reclaimedKb = 0;
  let copiedToSpaceKb = 0;
  let promotedOldGenKb = 0;
  const survivingYoungIds = [];
  const promotedIds = [];
  const promotionThresholdKb = toSpaceCapacityKb * 0.25;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const isAlive = Boolean(obj.isReachable) || Boolean(obj.isReferencedByOldGen);

    if (!isAlive) {
      reclaimedKb += obj.sizeKb;
      continue;
    }

    if (obj.age >= 1 || copiedToSpaceKb + obj.sizeKb > promotionThresholdKb) {
      promotedOldGenKb += obj.sizeKb;
      promotedIds.push(obj.id);
    } else {
      copiedToSpaceKb += obj.sizeKb;
      survivingYoungIds.push(obj.id);
    }
  }

  const estimatedStwMs =
    Math.round((copiedToSpaceKb + promotedOldGenKb) * 0.05 * 100) / 100;

  return {
    reclaimedKb,
    copiedToSpaceKb,
    promotedOldGenKb,
    survivingYoungIds,
    promotedIds,
    estimatedStwMs
  };
}`,
      testCases: [
        {
          name: 'Chu kỳ HTTP chuẩn: Đa số DTO chết trẻ, 1 đối tượng mới ở lại To-Space, 1 đối tượng đủ tuổi lên Old Gen',
          input: [
            [
              { id: 'req-dto-1', sizeKb: 120, age: 0, isReachable: false, isReferencedByOldGen: false },
              { id: 'req-dto-2', sizeKb: 180, age: 0, isReachable: false, isReferencedByOldGen: false },
              { id: 'active-ctx', sizeKb: 20, age: 0, isReachable: true, isReferencedByOldGen: false },
              { id: 'warm-cache', sizeKb: 30, age: 1, isReachable: true, isReferencedByOldGen: false }
            ],
            1024
          ],
          expected: {
            reclaimedKb: 300,
            copiedToSpaceKb: 20,
            promotedOldGenKb: 30,
            survivingYoungIds: ['active-ctx'],
            promotedIds: ['warm-cache'],
            estimatedStwMs: 2.5
          },
          hidden: false
        },
        {
          name: 'Hiệu ứng Write Barrier & Premature Promotion khi vượt ngưỡng 25% dung lượng To-Space (256KB)',
          input: [
            [
              { id: 'chunk-1', sizeKb: 200, age: 0, isReachable: true, isReferencedByOldGen: false },
              { id: 'chunk-2', sizeKb: 100, age: 0, isReachable: false, isReferencedByOldGen: true },
              { id: 'dead-buf', sizeKb: 500, age: 0, isReachable: false, isReferencedByOldGen: false }
            ],
            1024
          ],
          expected: {
            reclaimedKb: 500,
            copiedToSpaceKb: 200,
            promotedOldGenKb: 100,
            survivingYoungIds: ['chunk-1'],
            promotedIds: ['chunk-2'],
            estimatedStwMs: 15
          },
          hidden: false
        },
        {
          name: '100% đối tượng tạm đã chết -> Chi phí sao chép và thời gian STW bằng 0ms',
          input: [
            [
              { id: 'tmp-1', sizeKb: 400, age: 0, isReachable: false, isReferencedByOldGen: false },
              { id: 'tmp-2', sizeKb: 600, age: 0, isReachable: false, isReferencedByOldGen: false }
            ],
            2048
          ],
          expected: {
            reclaimedKb: 1000,
            copiedToSpaceKb: 0,
            promotedOldGenKb: 0,
            survivingYoungIds: [],
            promotedIds: [],
            estimatedStwMs: 0
          },
          hidden: false
        },
        {
          name: 'Biên chạm đúng ngưỡng 25% To-Space (256KB/1024KB) với age = 0 -> Vẫn được giữ lại To-Space',
          input: [
            [
              { id: 'exact-fit', sizeKb: 256, age: 0, isReachable: true, isReferencedByOldGen: false }
            ],
            1024
          ],
          expected: {
            reclaimedKb: 0,
            copiedToSpaceKb: 256,
            promotedOldGenKb: 0,
            survivingYoungIds: ['exact-fit'],
            promotedIds: [],
            estimatedStwMs: 12.8
          },
          hidden: true
        },
        {
          name: 'Nhiều đối tượng sau khi vượt ngưỡng 25%, đối tượng nhỏ tiếp theo vẫn vừa vặn trong phần còn lại của ngưỡng 25%',
          input: [
            [
              { id: 'small-1', sizeKb: 200, age: 0, isReachable: true, isReferencedByOldGen: false },
              { id: 'big-overflow', sizeKb: 150, age: 0, isReachable: true, isReferencedByOldGen: false },
              { id: 'small-2', sizeKb: 50, age: 0, isReachable: true, isReferencedByOldGen: false }
            ],
            1000
          ],
          expected: {
            reclaimedKb: 0,
            copiedToSpaceKb: 250,
            promotedOldGenKb: 150,
            survivingYoungIds: ['small-1', 'small-2'],
            promotedIds: ['big-overflow'],
            estimatedStwMs: 20
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Xây Dựng Bộ Đệm Giới Hạn Kép Chống Tràn Heap (Dual-Bounded Memory-Safe LRU Cache Engine)',
      description: 'Kết hợp kỹ thuật **Bounded LRU Cache** trong `SseConnectionLeakGuardService` (`realCodeSnippet`) và quản trị dung lượng byte trên V8 Heap. Viết hàm `executeBoundedLruCacheOps(maxItems, maxMemoryBytes, operations)` để thực thi chuỗi thao tác trên bộ nhớ đệm có giới hạn kép (vừa giới hạn số lượng phần tử `maxItems`, vừa giới hạn tổng dung lượng `maxMemoryBytes`):\n1. **Kiểm tra hợp lệ đầu vào (Defensive Guard):** Nếu `typeof maxItems !== "number" || !Number.isInteger(maxItems) || maxItems <= 0` hoặc `typeof maxMemoryBytes !== "number" || !Number.isFinite(maxMemoryBytes) || maxMemoryBytes <= 0` hoặc `!Array.isArray(operations)`, phải lập tức ném lỗi `throw new Error("INVALID_CACHE_CONFIG")`.\n2. **Thực thi tuần tự từng thao tác `op` trong `operations`:**\n   - Nếu `!op || typeof op !== "object" || typeof op.key !== "string" || op.key.trim().length === 0`: ném lỗi `throw new Error("INVALID_CACHE_CONFIG")`.\n   - Nếu `op.type === "GET"`: Nếu `op.key` tồn tại trong cache, tăng `hits` thêm 1, **cập nhật vị trí của `op.key` lên mới nhất (Most Recently Used)** và đẩy `entry.value` vào mảng `results`; nếu không tồn tại, tăng `misses` thêm 1 và đẩy `null` vào `results`.\n   - Nếu `op.type === "SET"`: Kiểm tra `typeof op.byteSize === "number" && Number.isFinite(op.byteSize) && op.byteSize > 0 && op.byteSize <= maxMemoryBytes` (nếu sai hoặc `op.byteSize > maxMemoryBytes`, ném lỗi `throw new Error("INVALID_CACHE_CONFIG")`). Nếu `op.key` đã có sẵn trong cache, trừ `usedBytes` đi kích thước cũ và xóa khóa cũ trước. Sau đó, dùng vòng lặp `while` kiểm tra: chừng nào `cache.size >= maxItems` HOẶC `usedBytes + op.byteSize > maxMemoryBytes`, hãy **trục xuất (evict) khóa cũ nhất (Least Recently Used)** ở đầu `Map`, trừ `usedBytes` tương ứng và đẩy tên khóa bị trục xuất vào mảng `evictedKeys`. Cuối cùng chèn `{ value: op.value, byteSize: op.byteSize }` vào `Map` và cộng `op.byteSize` vào `usedBytes`.\n   - Nếu `op.type` khác `"GET"` và `"SET"`: ném lỗi `throw new Error("INVALID_CACHE_CONFIG")`.\n3. Tính tỷ lệ trúng bộ đệm `hitRatePct`: nếu `hits + misses > 0` thì bằng `(hits / (hits + misses)) * 100` (làm tròn 2 chữ số thập phân), ngược lại bằng `0`. Trả về `{ results, evictedKeys, finalKeys: Array.from(cache.keys()), usedBytes, hitRatePct }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra cấu hình đầu vào): Kiểm tra `maxItems` (số nguyên dương), `maxMemoryBytes` (số dương hữu hạn) và `Array.isArray(operations)`. Nếu vi phạm bất kỳ điều kiện nào, `throw new Error("INVALID_CACHE_CONFIG")`. Khởi tạo `const cache = new Map()`, `usedBytes = 0`, `hits = 0`, `misses = 0`, `results = []`, `evictedKeys = []`.',
        'Bước 2 (Xử lý thao tác GET): Trong vòng lặp duyệt `operations`, kiểm tra `op` và `op.key` hợp lệ. Khi `op.type === "GET"`, nếu `cache.has(op.key)` thì lấy `entry = cache.get(op.key)`, gọi `cache.delete(op.key)` rồi `cache.set(op.key, entry)` để đưa lên vị trí mới nhất, tăng `hits++` và `results.push(entry.value)`. Nếu không có, tăng `misses++` và `results.push(null)`.',
        'Bước 3 (Xử lý thao tác SET và vòng lặp trục xuất LRU): Khi `op.type === "SET"`, kiểm tra `op.byteSize > 0 && op.byteSize <= maxMemoryBytes`. Nếu `cache.has(op.key)`, trừ `usedBytes` của bản ghi cũ và `cache.delete(op.key)`. Tiếp theo dùng `while (cache.size >= maxItems || usedBytes + op.byteSize > maxMemoryBytes)` lấy khóa đầu tiên `const oldestKey = cache.keys().next().value`, trừ `usedBytes`, xóa khỏi `cache` và `evictedKeys.push(oldestKey)`. Sau đó thêm mục mới vào `cache` và cộng `usedBytes`.',
        'Bước 4 (Tổng hợp báo cáo Telemetry): Tính `hitRatePct` (làm tròn 2 chữ số thập phân) và trả về `{ results, evictedKeys, finalKeys: Array.from(cache.keys()), usedBytes, hitRatePct }`.'
      ],
      hints: [
        'Đối tượng `Map` chuẩn trong JavaScript bảo toàn thứ tự chèn (Insertion Order): phần tử đầu tiên lấy từ `cache.keys().next().value` luôn là phần tử ít được sử dụng gần đây nhất (Least Recently Used). Khi đọc (`GET`) hoặc ghi đè (`SET`), xóa key đi rồi `set` lại sẽ đưa key đó xuống cuối `Map` (Most Recently Used).',
        'Hãy chú ý trường hợp ghi đè (`SET`) lên một `key` đã tồn tại: Bạn phải xóa bản ghi cũ và trừ `usedBytes` của bản ghi cũ TRƯỚC khi chạy vòng lặp `while` kiểm tra trục xuất, để tránh trục xuất nhầm các phần tử khác một cách oan uổng.'
      ],
      starterCode: `function executeBoundedLruCacheOps(maxItems, maxMemoryBytes, operations) {
  // Bước 1: Kiểm tra hợp lệ maxItems, maxMemoryBytes, operations (ném Error("INVALID_CACHE_CONFIG") nếu sai)
  
  // Bước 2 & 3: Duyệt operations, xử lý GET (cập nhật thứ tự LRU) và SET (trục xuất while vượt maxItems hoặc maxMemoryBytes)
  
  // Bước 4: Tính hitRatePct và trả về { results, evictedKeys, finalKeys, usedBytes, hitRatePct }
}`,
      solution: `function executeBoundedLruCacheOps(maxItems, maxMemoryBytes, operations) {
  if (
    typeof maxItems !== 'number' ||
    !Number.isInteger(maxItems) ||
    maxItems <= 0 ||
    typeof maxMemoryBytes !== 'number' ||
    !Number.isFinite(maxMemoryBytes) ||
    maxMemoryBytes <= 0 ||
    !Array.isArray(operations)
  ) {
    throw new Error("INVALID_CACHE_CONFIG");
  }

  const cache = new Map();
  let usedBytes = 0;
  let hits = 0;
  let misses = 0;
  const results = [];
  const evictedKeys = [];

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (
      !op ||
      typeof op !== 'object' ||
      typeof op.key !== 'string' ||
      op.key.trim().length === 0
    ) {
      throw new Error("INVALID_CACHE_CONFIG");
    }

    const key = op.key;

    if (op.type === 'GET') {
      if (cache.has(key)) {
        const entry = cache.get(key);
        cache.delete(key);
        cache.set(key, entry);
        hits++;
        results.push(entry.value);
      } else {
        misses++;
        results.push(null);
      }
    } else if (op.type === 'SET') {
      if (
        typeof op.byteSize !== 'number' ||
        !Number.isFinite(op.byteSize) ||
        op.byteSize <= 0 ||
        op.byteSize > maxMemoryBytes
      ) {
        throw new Error("INVALID_CACHE_CONFIG");
      }

      if (cache.has(key)) {
        const oldEntry = cache.get(key);
        usedBytes -= oldEntry.byteSize;
        cache.delete(key);
      }

      while (cache.size >= maxItems || usedBytes + op.byteSize > maxMemoryBytes) {
        const oldestKey = cache.keys().next().value;
        if (oldestKey === undefined) break;
        const oldestEntry = cache.get(oldestKey);
        usedBytes -= oldestEntry.byteSize;
        cache.delete(oldestKey);
        evictedKeys.push(oldestKey);
      }

      cache.set(key, { value: op.value, byteSize: op.byteSize });
      usedBytes += op.byteSize;
    } else {
      throw new Error("INVALID_CACHE_CONFIG");
    }
  }

  const totalReads = hits + misses;
  const hitRatePct =
    totalReads > 0 ? Math.round((hits / totalReads) * 100 * 100) / 100 : 0;

  return {
    results,
    evictedKeys,
    finalKeys: Array.from(cache.keys()),
    usedBytes,
    hitRatePct
  };
}`,
      testCases: [
        {
          name: 'Trục xuất LRU theo số lượng phần tử (maxItems = 2) và đổi thứ tự ưu tiên sau khi GET',
          input: [
            2,
            1000,
            [
              { type: 'SET', key: 'u1', value: 'Alice', byteSize: 200 },
              { type: 'SET', key: 'u2', value: 'Bob', byteSize: 300 },
              { type: 'GET', key: 'u1' },
              { type: 'SET', key: 'u3', value: 'Charlie', byteSize: 250 },
              { type: 'GET', key: 'u2' },
              { type: 'GET', key: 'u3' }
            ]
          ],
          expected: {
            results: ['Alice', null, 'Charlie'],
            evictedKeys: ['u2'],
            finalKeys: ['u1', 'u3'],
            usedBytes: 450,
            hitRatePct: 66.67
          },
          hidden: false
        },
        {
          name: 'Trục xuất nhiều phần tử liên tiếp do vượt trần dung lượng byte (maxMemoryBytes = 500)',
          input: [
            5,
            500,
            [
              { type: 'SET', key: 'k1', value: 10, byteSize: 200 },
              { type: 'SET', key: 'k2', value: 20, byteSize: 200 },
              { type: 'SET', key: 'k3', value: 30, byteSize: 350 }
            ]
          ],
          expected: {
            results: [],
            evictedKeys: ['k1', 'k2'],
            finalKeys: ['k3'],
            usedBytes: 350,
            hitRatePct: 0
          },
          hidden: false
        },
        {
          name: 'Ném lỗi INVALID_CACHE_CONFIG khi cấu hình maxItems <= 0 hoặc phần tử đơn lẻ lớn hơn maxMemoryBytes',
          input: [
            0,
            500,
            []
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Cập nhật lại (Overwrite) một khóa đã tồn tại không gây trục xuất nhầm phần tử khác',
          input: [
            2,
            500,
            [
              { type: 'SET', key: 'a', value: 'v1', byteSize: 250 },
              { type: 'SET', key: 'b', value: 'v2', byteSize: 200 },
              { type: 'SET', key: 'a', value: 'v1-updated', byteSize: 300 },
              { type: 'GET', key: 'a' }
            ]
          ],
          expected: {
            results: ['v1-updated'],
            evictedKeys: [],
            finalKeys: ['b', 'a'],
            usedBytes: 500,
            hitRatePct: 100
          },
          hidden: true
        },
        {
          name: 'Ném lỗi INVALID_CACHE_CONFIG khi một thao tác SET có byteSize vượt quá tổng maxMemoryBytes',
          input: [
            3,
            500,
            [
              { type: 'SET', key: 'huge-item', value: 'data', byteSize: 600 }
            ]
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
