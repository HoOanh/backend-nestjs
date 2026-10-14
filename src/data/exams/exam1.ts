import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter1 } from '../curriculum/chapter1.ts';

// Câu hỏi tổng hợp liên bài (Cross-lesson Synthesis Questions) dành riêng cho Kỳ Thi Sprint 1
const sprint1SynthesisQuestions: QuizQuestion[] = [
  {
    id: 'exam-c1-q1',
    question: 'Khi một endpoint trong NestJS vô tình thực thi cả hai lỗi: (1) dùng toán tử delete để xóa trường nhạy cảm trên 20,000 bản ghi DTO và (2) nối chuỗi vào biến mảng thuộc tính của Singleton Service, hiện tượng kép nào sẽ xuất hiện đồng thời trên hệ thống giám sát?',
    options: [
      'Độ trễ Event Loop tăng vọt do 20,000 đối tượng bị giáng cấp xuống Dictionary Mode (Slow Properties), đồng thời chỉ số heapUsed tăng theo hình răng cưa đi lên và gây tràn Old Generation.',
      'Bể luồng Libuv Threadpool bị khóa chết hoàn toàn ở cả 4 luồng xử lý I/O, đồng thời chỉ số arrayBuffers tăng đột biến làm nhân Linux kích hoạt cơ chế bảo vệ trang nhớ swap.',
      'Trình biên dịch TurboFan tự động chuyển toàn bộ 20,000 đối tượng sang vùng nhớ C++ External Buffer, đồng thời kích hoạt Minor GC Scavenge liên tục để giải phóng khung ngăn xếp Stack.',
      'Nhân hệ điều hành Linux lập tức đóng toàn bộ các kết nối TCP đang nằm trong danh sách Ready List của epoll, đồng thời gửi tín hiệu SIGTERM để khởi động lại tiến trình Node.js.'
    ],
    correctIndex: 0,
    explanation: 'Toán tử delete bẻ gãy Hidden Class khiến 20,000 bản ghi rơi xuống Dictionary Mode làm nghẽn CPU trên Main Thread khi serialize JSON. Cùng lúc đó, việc tích trữ dữ liệu vào thuộc tính của Singleton Service tạo liên kết tham chiếu mạnh từ GC Roots khiến các đối tượng được thăng cấp lên Old Generation và gây rò rỉ bộ nhớ vĩnh viễn.'
  },
  {
    id: 'exam-c1-q2',
    question: 'Một Pod chạy dịch vụ NestJS trên Kubernetes được cấu hình giới hạn memory.limits = 1024Mi nhưng kỹ sư quên đặt cờ --max-old-space-size. Tại sao Pod này thường bị chết đột ngột với Exit Code 137 (OOMKilled) mà không hề in ra lỗi "JavaScript heap out of memory"?',
    options: [
      'Vì Kubernetes tự động hủy mọi tiến trình Node.js nếu phát hiện dung lượng vùng nhớ Young Generation (Semi-space) vượt quá ngưỡng mặc định 16MB trong vòng 60 giây liên tiếp.',
      'Vì V8 mặc định đặt trần Old Generation tới ~1.4GB–2GB nên chưa vội chạy Major GC; khi tổng RSS (Heap + C++ External + Code/Stack) vượt mốc 1024Mi, Linux OOM Killer bắn SIGKILL ngay lập tức.',
      'Vì trình thông dịch Ignition tự động tắt cơ chế ghi nhật ký ngoại lệ ra luồng chuẩn stderr mỗi khi phát hiện tiến trình đang vận hành bên trong môi trường ảo hóa Linux cgroups.',
      'Vì thuật toán Cheney Scavenge tự động khóa toàn bộ bảng mô tả tệp tin File Descriptor Table khi bộ nhớ chạm ngưỡng 80%, khiến hệ điều hành không thể ghi dòng log cuối cùng ra đĩa.'
    ],
    correctIndex: 1,
    explanation: 'Khi không khai báo --max-old-space-size=768 trên Container 1024Mi, V8 tưởng rằng nó vẫn còn không gian Heap rộng rãi nên trì hoãn Major GC. Khi heapUsed cộng với Young Gen, Stack và C++ Buffers đẩy tổng RSS vượt 1024Mi, Linux Kernel cgroups lập tức gửi tín hiệu SIGKILL (Exit Code 137) tiêu diệt tiến trình từ bên ngoài trước khi V8 chạm ngưỡng giới hạn nội bộ.'
  },
  {
    id: 'exam-c1-q3',
    question: 'Trong kiến trúc Node.js Runtime, tại sao việc tạo ra hàng triệu đối tượng DTO ngắn hạn trong các vòng lặp Monomorphic lại gây áp lực rất thấp lên thời gian dừng (Stop-The-World Pause) của Garbage Collector?',
    options: [
      'Vì mọi đối tượng có cấu trúc Monomorphic đều được trình biên dịch TurboFan cấp phát toàn bộ trên thanh ghi phần cứng của CPU mà không bao giờ đi vào vùng nhớ V8 Heap.',
      'Vì các đối tượng ngắn hạn này chết ngay sau khi kết thúc request tại Young Generation; thuật toán Cheney Scavenge chỉ chép số ít đối tượng còn sống sang To-Space và bỏ qua toàn bộ đối tượng đã chết.',
      'Vì thư viện Libuv tự động chuyển toàn bộ các đối tượng DTO ngắn hạn sang dọn dẹp ngầm trên 4 luồng C++ của Threadpool mà không cần tạm dừng luồng thực thi JavaScript chính.',
      'Vì V8 Engine tự động nén các đối tượng có cùng Hidden Class thành một mảng nhị phân SharedArrayBuffer duy nhất và giải phóng tức thì qua con trỏ thanh ghi ngăn xếp RSP.'
    ],
    correctIndex: 1,
    explanation: 'Theo Giả thuyết thế hệ yếu (Weak Generational Hypothesis), các DTO sinh ra trong phạm vi một request sẽ mất toàn bộ tham chiếu ngay khi trả xong phản hồi. Khi Minor GC (Scavenger) chạy trên Young Generation, chi phí thời gian chỉ tỷ lệ thuận với số lượng đối tượng còn sống cần sao chép sang To-Space, còn hàng triệu đối tượng đã chết được xóa trắng trong O(1) khi đặt lại con trỏ From-Space.'
  },
  {
    id: 'exam-c1-q4',
    question: 'Khi khảo sát hiệu năng một hàm tính phí vận chuyển chạy 5 triệu lần/phút bằng cờ --trace-deopt, kỹ sư thấy thông báo bailout "not a Smi" tại phép tính weight * baseRate. Giải pháp kiến trúc nào xử lý triệt để nguyên nhân này tại tầng biên của NestJS?',
    options: [
      'Tăng gấp đôi kích thước bể luồng UV_THREADPOOL_SIZE=8 để hệ điều hành phân tải các phép nhân số thực sang các nhân CPU phụ trợ mà không làm gián đoạn luồng Event Loop.',
      'Chuẩn hóa và ép kiểu dữ liệu đầu vào ngay tại ValidationPipe/DTO (đảm bảo kiểu số đồng nhất, dùng đơn vị nguyên nhỏ nhất như gram/đồng hoặc chuẩn hóa số thực 0.0) trước khi đưa vào hàm tính toán.',
      'Bọc toàn bộ thân hàm tính phí vận chuyển bên trong khối lệnh try/catch lồng nhau để ngăn không cho trình biên dịch TurboFan gắn các chốt kiểm tra kiểu CheckSmi vào mã máy.',
      'Chuyển hàm tính phí vận chuyển sang phương thức bất đồng bộ async/await để V8 Engine tự động lưu trữ kết quả trung gian vào phân vùng Old Generation thay vì lưu trên thanh ghi.'
    ],
    correctIndex: 1,
    explanation: 'Lỗi bailout "not a Smi" xảy ra khi hàm đã được TurboFan biên dịch tối ưu cho số nguyên nhỏ 31-bit (Smi), nhưng sau đó một request lại truyền vào chuỗi số ("100") hoặc số thực thập phân từ req.query/req.body. Việc chuẩn hóa kiểu dữ liệu nghiêm ngặt ngay tại tầng biên (ValidationPipe / Constructor DTO) giữ cho Type Feedback ổn định và ngăn chặn hoàn toàn OSR Deoptimization.'
  },
  {
    id: 'exam-c1-q5',
    question: 'Tại sao việc đăng ký hàm lắng nghe sự kiện eventEmitter.on("data", (chunk) => ...) ngay bên trong phương thức xử lý HTTP Request của Controller mà không gỡ bỏ khi đóng kết nối lại gây ra hai hậu quả nghiêm trọng cùng lúc?',
    options: [
      'Nó vừa làm đầy mảng listener trong Singleton EventEmitter gây rò rỉ bộ nhớ Closure Context (giữ sống cả req/res), vừa làm tăng độ trễ CPU tuyến tính O(N) mỗi khi sự kiện "data" được phát ra.',
      'Nó vừa làm tràn vùng nhớ Stack Frame của luồng chính gây lỗi Maximum call stack size exceeded, vừa làm hỏng cấu trúc Cây Đỏ-Đen của hệ thống epoll bên trong nhân hệ điều hành Linux.',
      'Nó vừa ép V8 Engine phải chuyển toàn bộ vùng nhớ Old Generation sang Dictionary Mode, vừa khiến cơ chế Rào chắn ghi (Write Barrier) ngừng ghi nhận các con trỏ xuyên thế hệ.',
      'Nó vừa làm cạn kiệt toàn bộ số lượng cổng mạng Ephemeral Ports của máy chủ vật lý, vừa buộc bộ thu gom rác Minor GC phải sao chép toàn bộ các đối tượng sang vùng nhớ C++ External.'
    ],
    correctIndex: 0,
    explanation: 'Khi gắn listener vào một Singleton EventEmitter trên mỗi HTTP request mà không gọi removeListener/off, mảng nội bộ của EventEmitter sẽ phình to vô hạn. Mỗi hàm callback là một Closure giữ chặt ngữ cảnh từ vựng (Lexical Context) chứa đối tượng req/res trên Old Generation, đồng thời mỗi lần emit("data") CPU phải duyệt qua hàng chục nghìn hàm callback cũ làm tê liệt Event Loop.'
  },
  {
    id: 'exam-c1-q6',
    question: 'Khi phân tích Heap Snapshot để điều tra sự cố rò rỉ bộ nhớ trên máy chủ NestJS, dấu hiệu kết hợp nào giữa hai chỉ số Shallow Size và Retained Size chỉ điểm chính xác một đối tượng quản lý (như Map hoặc Array trong Singleton) đang là nút cổ chai giữ rác?',
    options: [
      'Đối tượng có chỉ số Shallow Size bằng đúng dung lượng tổng RSS của tiến trình, nhưng chỉ số Retained Size lại bằng 0 byte và khoảng cách Distance tới GC Roots bằng vô cùng.',
      'Đối tượng có Shallow Size rất nhỏ (chỉ vài chục đến vài trăm byte cho vỏ cấu trúc), nhưng Retained Size lại khổng lồ (hàng trăm MB) và đi kèm khoảng cách Distance rất ngắn tính từ GC Roots.',
      'Đối tượng có cả Shallow Size lẫn Retained Size đều cố định ở mức 32 bytes qua cả ba bản chụp S1, S2, S3 và nằm hoàn toàn bên trong phân vùng From-Space của Young Generation.',
      'Đối tượng không có đường dẫn Retaining Path nối về bất kỳ GC Root nào nhưng vẫn hiển thị màu Đen vĩnh viễn trên bảng thống kê của trình thông dịch Bytecode Ignition.'
    ],
    correctIndex: 1,
    explanation: 'Một đối tượng chứa như Map, Set hoặc đối tượng cấu hình trong Singleton Service chỉ tốn vài chục byte cho bản thân vỏ bọc của nó (Shallow Size nhỏ) và nằm rất gần GC Roots (Distance nhỏ). Tuy nhiên, vì nó nắm giữ các tham chiếu độc quyền tới hàng trăm nghìn đối tượng con bên dưới nhánh Dominator Tree, chỉ số Retained Size của nó sẽ phình lên hàng trăm Megabyte.'
  }
];

// Gom các câu hỏi từ 3 bài học của Chương 1 cùng bộ câu hỏi tổng hợp Sprint 1 (Tổng 30 câu)
const examQuestions: QuizQuestion[] = [
  ...chapter1.lessons.flatMap((l) => l.quiz),
  ...sprint1SynthesisQuestions
];

const examChallenge: CodeChallenge = {
  id: 'exam-c1-challenge',
  level: 'advanced',
  levelLabel: 'Cấp độ 3: Kiến Trúc & Production (Sprint 1 Capstone)',
  title: 'Xây Dựng Memory-Safe Event Emitter Guard Chống Rò Rỉ Listener (Max Listeners Protection)',
  description:
    'Trong kiến trúc NestJS Long-running Process, việc các thành phần đăng ký lắng nghe sự kiện (`on`) vào một Singleton `EventEmitter` mà không kiểm soát giới hạn hoặc quên gỡ bỏ (`off`) là nguyên nhân hàng đầu gây rò rỉ bộ nhớ Closure (`MaxListenersExceededWarning`). Hãy hiện thực hàm `simulateEventEmitter(maxListeners, ops)` mô phỏng bộ điều phối sự kiện an toàn bộ nhớ theo đặc tả kỹ thuật:\n' +
    '1. **Kiểm tra hợp lệ đầu vào (Defensive Validation):** Nếu `typeof maxListeners !== "number" || !Number.isInteger(maxListeners) || maxListeners <= 0 || !Array.isArray(ops)`, lập tức ném ngoại lệ `throw new Error("Invalid EventEmitter configuration")`.\n' +
    '2. **Chuẩn hóa tên sự kiện:** Với mỗi phần tử `item` trong mảng `ops`, chuẩn hóa tên sự kiện bằng `const evtName = String(item?.evt ?? "").trim()`. Nếu `evtName` rỗng thì bỏ qua thao tác đó.\n' +
    '3. **Xử lý 3 thao tác (`"on"` | `"off"` | `"count"`):**\n' +
    '   - `"on"`: Nếu số lượng listener hiện tại của `evtName` đã chạm hoặc vượt ngưỡng `current >= maxListeners`, **không** tăng bộ đếm mà đẩy chuỗi cảnh báo `"MAX_LISTENERS_EXCEEDED"` vào mảng kết quả. Ngược lại, tăng số lượng listener của `evtName` thêm `1`.\n' +
    '   - `"off"`: Nếu số lượng listener hiện tại của `evtName` lớn hơn `0`, giảm đi `1` (đảm bảo bộ đếm không bao giờ bị âm).\n' +
    '   - `"count"`: Đẩy số lượng listener hiện tại của `evtName` (mặc định là `0` nếu chưa có listener nào) vào mảng kết quả.\n' +
    '4. Trả về mảng kết quả `Array<number | string>` chứa toàn bộ các cảnh báo và kết quả truy vấn `"count"` theo đúng thứ tự thời gian.',
  guidedSteps: [
    'Bước 1 (Kiểm tra tham số phòng thủ): Kiểm tra `typeof maxListeners !== "number" || !Number.isInteger(maxListeners) || maxListeners <= 0 || !Array.isArray(ops)`. Nếu vi phạm, ném ngay `throw new Error("Invalid EventEmitter configuration")`.',
    'Bước 2 (Khởi tạo cấu trúc lưu trữ): Tạo `const listenerCounts = new Map<string, number>()` để theo dõi số lượng listener theo từng tên sự kiện độc lập và mảng `const results: Array<number | string> = []` để thu thập đầu ra.',
    'Bước 3 (Duyệt và thực thi chuỗi thao tác): Duyệt qua từng `item` trong `ops`, chuẩn hóa `const evtName = String(item?.evt ?? "").trim()`. Lấy `const current = listenerCounts.get(evtName) ?? 0`. Với `"on"`, nếu `current >= maxListeners` thì `results.push("MAX_LISTENERS_EXCEEDED")`, ngược lại cập nhật `current + 1`.',
    'Bước 4 (Xử lý gỡ bỏ và thống kê): Với `"off"`, nếu `current > 0` thì cập nhật `listenerCounts.set(evtName, current - 1)` (tránh âm). Với `"count"`, đẩy `current` vào `results`. Kết thúc vòng lặp, trả về mảng `results`.'
  ],
  hints: [
    'Sử dụng cấu trúc `Map<string, number>` giúp tra cứu và cập nhật số lượng listener của từng kênh sự kiện (`"data"`, `"close"`, `"error"`) với độ phức tạp `O(1)` và tránh hoàn toàn xung đột khóa trên `Object.prototype`.',
    'Khi xử lý thao tác `"off"`, hãy dùng `Math.max(0, current - 1)` hoặc kiểm tra `if (current > 0)` để đảm bảo việc gọi `"off"` dư thừa trên một sự kiện đã về `0` không làm bộ đếm bị lùi xuống `-1`.'
  ],
  starterCode: `function simulateEventEmitter(
  maxListeners: number,
  ops: Array<{ op: 'on' | 'off' | 'count'; evt: string }>
): Array<number | string> {
  // Bước 1: Kiểm tra hợp lệ maxListeners (số nguyên dương > 0) và mảng ops
  
  // Bước 2: Khởi tạo Map lưu số lượng listener theo từng sự kiện và mảng kết quả
  
  // Bước 3 & 4: Duyệt qua ops để xử lý 'on', 'off', 'count' an toàn bộ nhớ
  return [];
}`,
  solution: `function simulateEventEmitter(
  maxListeners: number,
  ops: Array<{ op: 'on' | 'off' | 'count'; evt: string }>
): Array<number | string> {
  if (
    typeof maxListeners !== 'number' ||
    !Number.isInteger(maxListeners) ||
    maxListeners <= 0 ||
    !Array.isArray(ops)
  ) {
    throw new Error('Invalid EventEmitter configuration');
  }

  const events = new Map<string, number>();
  const results: Array<number | string> = [];

  for (const item of ops) {
    if (!item || typeof item !== 'object') continue;
    const evtName = String(item.evt ?? '').trim();
    if (!evtName) continue;

    const current = events.get(evtName) ?? 0;
    if (item.op === 'on') {
      if (current >= maxListeners) {
        results.push('MAX_LISTENERS_EXCEEDED');
      } else {
        events.set(evtName, current + 1);
      }
    } else if (item.op === 'off') {
      if (current > 0) {
        events.set(evtName, current - 1);
      }
    } else if (item.op === 'count') {
      results.push(current);
    }
  }

  return results;
}`,
  testCases: [
    {
      name: 'Thêm và đếm listener hợp lệ trên cùng một sự kiện',
      input: [
        5,
        [
          { op: 'on', evt: 'data' },
          { op: 'on', evt: 'data' },
          { op: 'count', evt: 'data' }
        ]
      ],
      expected: [2],
      hidden: false
    },
    {
      name: 'Phát cảnh báo MAX_LISTENERS_EXCEEDED khi vượt ngưỡng maxListeners = 1',
      input: [
        1,
        [
          { op: 'on', evt: 'data' },
          { op: 'on', evt: 'data' },
          { op: 'count', evt: 'data' }
        ]
      ],
      expected: ['MAX_LISTENERS_EXCEEDED', 1],
      hidden: false
    },
    {
      name: 'Hủy đăng ký bằng off giúp giải phóng slot và không bao giờ giảm xuống số âm',
      input: [
        2,
        [
          { op: 'off', evt: 'order.created' },
          { op: 'on', evt: 'order.created' },
          { op: 'on', evt: 'order.created' },
          { op: 'off', evt: 'order.created' },
          { op: 'on', evt: 'order.created' },
          { op: 'count', evt: 'order.created' }
        ]
      ],
      expected: [2],
      hidden: false
    },
    {
      name: 'Cô lập bộ đếm giữa nhiều kênh sự kiện khác nhau và chuẩn hóa khoảng trắng tên sự kiện',
      input: [
        2,
        [
          { op: 'on', evt: ' stream.chunk ' },
          { op: 'on', evt: 'stream.chunk' },
          { op: 'on', evt: 'stream.close' },
          { op: 'on', evt: 'stream.chunk' },
          { op: 'count', evt: 'stream.chunk' },
          { op: 'count', evt: 'stream.close' },
          { op: 'count', evt: 'unknown.event' }
        ]
      ],
      expected: ['MAX_LISTENERS_EXCEEDED', 2, 1, 0],
      hidden: true
    },
    {
      name: 'Ném ngoại lệ phòng thủ khi cấu hình maxListeners <= 0 hoặc không hợp lệ',
      input: [
        0,
        [
          { op: 'on', evt: 'data' }
        ]
      ],
      expected: 'ERROR_THROWN',
      hidden: true
    }
  ]
};

export const exam1: SprintExam = {
  sprintId: 1,
  title: 'Kỳ Thi Đánh Giá Chương 1: Runtime Internals, V8 Engine & Quản Trị Bộ Nhớ',
  description:
    'Khảo thí chuyên sâu kiến trúc nền tảng: Bản chất Long-running Process, Giải pháp C10K với I/O Multiplexing (epoll/kqueue), V8 JIT Pipeline (Ignition/TurboFan), Hidden Classes & Inline Caching, cùng Cơ chế Thu gom rác (Scavenge / Mark-Sweep-Compact) và Phòng chống Memory Leak trên Production.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge
};

