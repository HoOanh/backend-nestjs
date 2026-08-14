import type { QuizQuestion, CodeChallenge } from './curriculum.ts';

export interface SprintExam {
  sprintId: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questions: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export const SPRINT_EXAMS: SprintExam[] = [
  {
    sprintId: 0,
    title: 'Bài Kiểm Tra Sprint 0: Cầu Nối React/Next.js → Backend Mental Model',
    description: 'Đánh giá chuyên sâu kiến thức chuyển đổi tư duy: Long-running Process, Concurrency, Event Loop, Non-blocking I/O và Giao thức HTTP RFC.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's0-q1',
        question: 'Tại sao việc lưu trữ state của người dùng vào biến thuộc tính của NestJS Service (Singleton) là lỗi nghiêm trọng?',
        options: [
          'Vì Service là Singleton được chia sẻ cho toàn bộ hàng nghìn người dùng, request của người sau sẽ ghi đè và làm lộ dữ liệu sang người trước (Race Condition)',
          'Vì TypeScript compiler sẽ báo lỗi không cho build',
          'Vì làm chậm tốc độ mạng',
          'Không có rủi ro gì'
        ],
        correctIndex: 0,
        explanation: 'Singleton Service chia sẻ 1 instance duy nhất trong RAM cho toàn bộ ứng dụng, mọi request đều dùng chung các biến thuộc tính của nó.'
      },
      {
        id: 's0-q2',
        question: 'Để không làm nghẽn (block) Node.js Event Loop, các tác vụ I/O (Query DB, gọi API ngoài) phải được thực thi như thế nào?',
        options: [
          'Dùng vòng lặp while',
          'Dùng bất đồng bộ (Non-blocking I/O) với async/await hoặc Promise',
          'Chạy đồng bộ trên Main Thread',
          'Tắt Node.js'
        ],
        correctIndex: 1,
        explanation: 'Async/await non-blocking I/O cho phép Node.js phục vụ các request khác trong khi chờ kết quả từ Database/Mạng.'
      },
      {
        id: 's0-q3',
        question: 'Khi client gọi API gửi request body sai định dạng, mã HTTP Status Code chuẩn nào cần trả về?',
        options: [
          '400 Bad Request',
          '500 Internal Server Error',
          '200 OK',
          '401 Unauthorized'
        ],
        correctIndex: 0,
        explanation: '400 Bad Request là mã chuẩn cho lỗi validation phía client.'
      },
      {
        id: 's0-q4',
        question: 'Tại sao Refresh Token nên được lưu trong HttpOnly Cookie thay vì localStorage?',
        options: [
          'Vì JavaScript trên trình duyệt không thể đọc được HttpOnly Cookie, bảo vệ phiên đăng nhập khỏi bị đánh cắp khi web bị dính mã độc XSS',
          'Vì Cookie có dung lượng lớn hơn 100MB',
          'Vì Cookie giúp tải trang nhanh hơn',
          'Không có sự khác biệt'
        ],
        correctIndex: 0,
        explanation: 'HttpOnly ngăn JavaScript đọc cookie nên giảm token exfiltration qua XSS; nó không ngăn XSS thực hiện authenticated request và cần kết hợp CSP/CSRF defense phù hợp.'
      },
      {
        id: 's0-q5',
        question: 'Khi lập trình API trả về một mảng danh sách người dùng, nếu bảng users trong DB có 1 triệu dòng, việc gọi `const users = await db.users.find()` mà không có LIMIT/OFFSET sẽ gây ra điều gì?',
        options: [
          'Tràn bộ nhớ RAM (OOM) của ứng dụng Node.js và làm sập server do phải load toàn bộ 1 triệu bản ghi vào memory cùng lúc',
          'Tự động phân trang thành các block 1000 records để bảo vệ server',
          'Không sao cả, Node.js đủ mạnh để xử lý nhanh',
          'Gây lỗi trình duyệt của người dùng'
        ],
        correctIndex: 0,
        explanation: 'Việc query lượng lớn dữ liệu mà không phân trang sẽ khiến Node.js nạp toàn bộ vào RAM, dẫn đến Out Of Memory (OOM) crash.'
      },
      {
        id: 's0-q6',
        question: 'Tại sao việc dùng `setTimeout` hoặc `setInterval` để xử lý các công việc định kỳ (cron jobs) trong NestJS trên môi trường Production thường là một anti-pattern?',
        options: [
          'Vì khi scale hệ thống lên nhiều instance (chạy nhiều server cùng lúc), cron job sẽ bị kích hoạt lặp lại nhiều lần trùng lặp',
          'Vì nó làm chậm request HTTP',
          'Vì Node.js không hỗ trợ setTimeout tốt',
          'Vì nó vi phạm quy tắc REST'
        ],
        correctIndex: 0,
        explanation: 'Mỗi instance của ứng dụng sẽ chạy một bộ hẹn giờ riêng, gây ra sự trùng lặp (duplicate execution) nếu không có Distributed Lock hoặc External Queue (BullMQ).'
      },
      {
        id: 's0-q7',
        question: 'Khi một API cần gọi sang 3 dịch vụ ngoại vi khác nhau (ví dụ: SMS, Email, Push Notification) và kết quả của chúng KHÔNG phụ thuộc vào nhau, cách viết nào là tối ưu hiệu năng nhất?',
        options: [
          'Dùng `await Promise.all([sendSms(), sendEmail(), sendPush()])` để chạy song song (concurrently)',
          'Dùng `await sendSms(); await sendEmail(); await sendPush();` để chạy tuần tự (sequentially)',
          'Không dùng await mà gọi bình thường',
          'Tạo 3 API riêng và bắt frontend tự gọi'
        ],
        correctIndex: 0,
        explanation: 'Promise.all giúp các tác vụ I/O không phụ thuộc nhau được thực thi đồng thời, giảm tổng thời gian chờ bằng thời gian của tác vụ lâu nhất.'
      },
      {
        id: 's0-q8',
        question: 'Đâu là sự khác biệt lớn nhất giữa `PUT` và `PATCH` trong HTTP/REST?',
        options: [
          'PUT được dùng để thay thế (replace) toàn bộ resource gốc, còn PATCH dùng để cập nhật một phần (partial update) resource đó',
          'PUT dùng để tạo mới, PATCH dùng để lấy dữ liệu',
          'PUT bảo mật hơn PATCH',
          'Không có sự khác biệt, dùng cái nào cũng được'
        ],
        correctIndex: 0,
        explanation: 'Mặc dù đôi khi dev dùng nhầm lẫn, nhưng chuẩn REST định nghĩa PUT mang tính lũy đẳng cao thay thế toàn bộ entity, PATCH sửa các trường được chỉ định.'
      },
      {
        id: 's0-q9',
        question: 'Một Node.js server bị nghẽn (CPU ở mức 100%) và không nhận thêm request nào nữa. Nguyên nhân có khả năng cao nhất là gì?',
        options: [
          'Một vòng lặp `while(true)` hoặc hàm tính toán số lớn (mã hóa/giải mã, regex phức tạp) đang chạy đồng bộ trên Main Thread',
          'Server có quá nhiều kết nối từ người dùng',
          'Tốc độ mạng bị chậm',
          'Lỗi kết nối tới Database'
        ],
        correctIndex: 0,
        explanation: 'Node.js có một Main Thread duy nhất. Nếu Main Thread phải tính toán nặng mà không nhường quyền (block), toàn bộ server sẽ bị tê liệt.'
      },
      {
        id: 's0-q10',
        question: 'Trong kiến trúc ứng dụng web hiện đại, thuật ngữ "Stateless" đối với Backend Server có nghĩa là gì?',
        options: [
          'Server không lưu trữ trạng thái người dùng (ví dụ: Session) trong RAM của chính nó, mà dùng token (JWT) hoặc lưu vào external store (Redis) để dễ dàng scale ngang',
          'Server không dùng bất kỳ cơ sở dữ liệu nào',
          'Server không có bộ nhớ RAM',
          'Server không phản hồi lỗi'
        ],
        correctIndex: 0,
        explanation: 'Stateless backend là chìa khóa để triển khai container và auto-scaling, vì mọi request tới bất kỳ node nào cũng có đủ thông tin để xử lý.'
      },
      {
        id: 's0-q11',
        question: 'Trong giao thức HTTP, tại sao không nên gửi dữ liệu nhạy cảm qua query parameters trong phương thức GET?',
        options: [
          'Vì query parameters sẽ bị lưu lại trong lịch sử trình duyệt, server logs và có thể dễ dàng bị đánh cắp',
          'Vì phương thức GET không hỗ trợ SSL/TLS',
          'Vì query parameters chỉ nhận số, không nhận chữ',
          'Vì NestJS chặn việc đọc query string'
        ],
        correctIndex: 0,
        explanation: 'Mặc dù HTTPS mã hóa đường truyền, URL (bao gồm query params) vẫn bị lưu dạng cleartext trong access log của Server (Nginx, Apache) và lịch sử trình duyệt.'
      },
      {
        id: 's0-q12',
        question: 'Lỗi CORS (Cross-Origin Resource Sharing) xảy ra ở đâu và mục đích là gì?',
        options: [
          'Do trình duyệt (Browser) chặn lại để bảo vệ người dùng, ngăn không cho trang web này tự động gọi API của trang web khác khi chưa được phép',
          'Do Database chặn kết nối từ nhiều server Node.js',
          'Do Backend Server bị sập, không phản hồi được',
          'Do mạng Internet bị đứt cáp quang'
        ],
        correctIndex: 0,
        explanation: 'CORS là cơ chế bảo mật của trình duyệt. Trình duyệt gửi request `OPTIONS` (Preflight) để hỏi Server có cho phép domain hiện tại gọi API hay không.'
      },
      {
        id: 's0-q13',
        question: 'Trong Node.js, `Worker Threads` được sử dụng để giải quyết bài toán nào tốt nhất?',
        options: [
          'Xử lý các tác vụ tính toán nặng (CPU-bound) như mã hóa, nén file, xử lý ảnh mà không làm nghẽn Main Thread',
          'Xử lý nhiều kết nối database cùng lúc',
          'Giảm dung lượng RAM của ứng dụng',
          'Tạo giao diện người dùng'
        ],
        correctIndex: 0,
        explanation: 'Node.js thuần túy dùng 1 thread. Khi có tác vụ CPU nặng, Worker Threads cho phép tạo luồng xử lý riêng biệt để không block Event Loop chính.'
      },
      {
        id: 's0-q14',
        question: 'Tại sao cần middleware (ví dụ express.json()) trong Node.js/NestJS để đọc request body?',
        options: [
          'Vì dữ liệu HTTP body truyền tới Server dưới dạng luồng dữ liệu (Data Stream/Buffer) chia nhỏ, middleware giúp thu thập và parse thành JSON object hoàn chỉnh',
          'Vì nếu không có middleware, dữ liệu sẽ bị mã hóa',
          'Để dịch tiếng Anh sang tiếng Việt tự động',
          'Để tăng tốc độ mạng'
        ],
        correctIndex: 0,
        explanation: 'HTTP truyền payload lớn qua stream. Middleware có nhiệm vụ lắng nghe các chunk data, ghép lại và dùng `JSON.parse` để tạo ra req.body cho Controller.'
      },
      {
        id: 's0-q15',
        question: 'Sự khác biệt chính giữa HTTP Long-polling và WebSockets là gì?',
        options: [
          'WebSockets tạo một kết nối duy trì liên tục hai chiều (bi-directional), trong khi Long-polling là client gửi request và server giữ nó chờ đến khi có dữ liệu mới trả về, sau đó client phải tạo kết nối mới',
          'Long-polling nhanh hơn WebSockets',
          'WebSockets chỉ chạy được trên điện thoại',
          'Long-polling dùng giao thức UDP'
        ],
        correctIndex: 0,
        explanation: 'WebSockets duy trì 1 socket TCP mở, cho phép đẩy dữ liệu real-time với overhead cực thấp so với việc tạo mới request liên tục của Long-polling.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 0: Safe Async Execution Wrapper',
      description: 'Viết hàm `safeAsyncExecutor(asyncFn)`: gọi `await asyncFn()`. Nếu thành công trả về `{ ok: true, data: result }`, nếu ném lỗi thì trả về `{ ok: false, error: err.message }` mà không làm crash app.',
      starterCode: `async function safeAsyncExecutor(asyncFn) {
  // Viết logic bọc async an toàn
  
}`,
      solution: `async function safeAsyncExecutor(asyncFn) {
  try {
    const data = await asyncFn();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || 'ERROR' };
  }
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Thực thi async thành công',
          input: [async () => 'OK_DATA'],
          expected: { ok: true, data: 'OK_DATA' },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Có lỗi -> Bắt an toàn không sập app',
          input: [async () => { throw new Error('DB_DOWN'); }],
          expected: { ok: false, error: 'DB_DOWN' },
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Hàm trả về object',
          input: [async () => ({ user: "test" })],
          expected: { ok: true, data: { user: "test" } },
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): Hàm ném custom exception',
          input: [async () => { throw new Error("CUSTOM_ERROR"); }],
          expected: { ok: false, error: "CUSTOM_ERROR" },
          hidden: true
        },
        {
          name: 'Case 5 (Hidden): Timeout reject',
          input: [async () => await new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), 10))],
          expected: { ok: false, error: "TIMEOUT" },
          hidden: true
        },
        {
          name: 'Case 6 (Hidden): Return false still valid data',
          input: [async () => false],
          expected: { ok: true, data: false },
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 1,
    title: 'Bài Kiểm Tra Sprint 1: NestJS Core & Clean Architecture',
    description: 'Đánh giá kiến thức về Bootstrapping, IoC Container, Dependency Injection, Controller routing và DTO Validation Pipe.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's1-q1',
        question: 'Trong NestJS, thứ tự thực thi chính xác của các thành phần khi một HTTP request đi vào là gì?',
        options: [
          'Controller -> Service -> Guard -> Pipe',
          'Middleware -> Guard -> Interceptor (Pre) -> Pipe -> Controller -> Service -> Interceptor (Post) -> Exception Filter',
          'Pipe -> Guard -> Middleware -> Controller -> Service',
          'Service -> Repository -> Controller -> Guard'
        ],
        correctIndex: 1,
        explanation: 'Vòng đời chuẩn của NestJS: Middleware -> Guard -> Interceptor -> Pipe -> Controller/Service -> Filter.'
      },
      {
        id: 's1-q2',
        question: 'Tại sao DTO trong NestJS nên dùng Class thay vì TypeScript Interface?',
        options: [
          'Vì Interface bị xóa bỏ sau khi compile sang JS, còn Class được giữ lại ở runtime giúp class-validator và Swagger hoạt động',
          'Vì Interface tốn nhiều RAM hơn',
          'Vì NestJS cấm dùng Interface',
          'Để code chạy nhanh hơn'
        ],
        correctIndex: 0,
        explanation: 'Class được giữ lại ở runtime JavaScript cho phép reflect-metadata và class-validator thực thi validation.'
      },
      {
        id: 's1-q3',
        question: 'Muốn chia sẻ một Service cho các Module khác trong NestJS, ta bắt buộc phải làm gì?',
        options: [
          'Khai báo service đó vào mảng exports của module sở hữu và import module đó vào nơi cần dùng',
          'Khai báo service đó vào mảng controllers',
          'Tạo biến global',
          'Dùng new Service()'
        ],
        correctIndex: 0,
        explanation: 'Chỉ các provider nằm trong mảng exports mới có thể được các module khác sử dụng.'
      },
      {
        id: 's1-q4',
        question: 'Cờ "whitelist: true" trong ValidationPipe có tác dụng bảo vệ gì?',
        options: [
          'Tự động loại bỏ tất cả các trường dữ liệu mà client gửi lên nếu trường đó không được định nghĩa trong DTO (chống Mass Assignment)',
          'Cho phép mọi người dùng truy cập API không cần mật khẩu',
          'Bật giao diện màu trắng cho Swagger',
          'Tắt kiểm tra dữ liệu'
        ],
        correctIndex: 0,
        explanation: 'Whitelist lọc sạch các trường lạ, ngăn chặn hacker chèn thêm các quyền giả mạo.'
      },
      {
        id: 's1-q5',
        question: 'Trong NestJS, Scope.TRANSIENT có nghĩa là gì?',
        options: [
          'Mỗi khi một class (Controller/Service) yêu cầu provider này, NestJS sẽ tạo ra một instance MỚI hoàn toàn',
          'Instance sẽ tồn tại vĩnh viễn trong suốt vòng đời của app (Singleton)',
          'Tạo một instance duy nhất cho mỗi HTTP request',
          'Provider chỉ được dùng cho GraphQL'
        ],
        correctIndex: 0,
        explanation: 'Khác với Singleton (mặc định), Transient scope đảm bảo tính độc lập bằng cách khởi tạo lại (new instance) mỗi lần được inject.'
      },
      {
        id: 's1-q6',
        question: 'Mục đích chính của Exception Filter trong NestJS là gì?',
        options: [
          'Đón (catch) tất cả các lỗi chưa được bắt (Unhandled Exceptions) ném ra trong quá trình xử lý request và định dạng lại cấu trúc Response Error trả về cho Client',
          'Lọc dữ liệu rác trước khi đưa vào Database',
          'Bảo vệ chống lại tấn công DDOS',
          'Dịch tự động ngôn ngữ API'
        ],
        correctIndex: 0,
        explanation: 'Exception Filter ở lớp ngoài cùng vòng đời request, chuyên chuẩn hóa mọi lỗi thành JSON thống nhất cho frontend dễ parse.'
      },
      {
        id: 's1-q7',
        question: 'Tính năng nào giúp kết nối nhiều Module trong NestJS để tránh tạo ra cấu trúc Circular Dependency (Phụ thuộc vòng)?',
        options: [
          'Sử dụng `forwardRef()`',
          'Xóa module và viết chung vào một file',
          'Dùng `import * as` của ES6',
          'NestJS tự động sửa lỗi này'
        ],
        correctIndex: 0,
        explanation: 'Khi Module A cần Module B và ngược lại, forwardRef() cho phép trì hoãn việc resolve dependency cho đến khi cả hai class đã định nghĩa xong.'
      },
      {
        id: 's1-q8',
        question: 'Nếu muốn thêm metadata tùy chỉnh cho một Route (ví dụ: đánh dấu route cần quyền admin) để Guard đọc được, ta dùng decorator nào?',
        options: [
          '@SetMetadata() hoặc custom decorator kết hợp với Reflector',
          '@Param()',
          '@Injectable()',
          '@Req()'
        ],
        correctIndex: 0,
        explanation: 'NestJS cung cấp Reflector để đọc các metadata được gắn trên class/method qua @SetMetadata, nền tảng cho Role/Permission Guards.'
      },
      {
        id: 's1-q9',
        question: 'Bạn muốn đọc giá trị chuỗi truy vấn (query string) như `?page=1&limit=10` từ request. Decorator nào của NestJS làm việc này?',
        options: [
          '@Query()',
          '@Param()',
          '@Body()',
          '@Header()'
        ],
        correctIndex: 0,
        explanation: '@Query() ánh xạ trực tiếp query parameters từ URL vào tham số của controller method.'
      },
      {
        id: 's1-q10',
        question: 'Khi sử dụng thư viện `class-validator`, decorator nào xác nhận một trường bắt buộc phải là số nguyên dương?',
        options: [
          '@IsPositive() kết hợp @IsInt()',
          '@IsString()',
          '@MinLength(1)',
          '@IsNumber()'
        ],
        correctIndex: 0,
        explanation: '@IsInt() đảm bảo số nguyên, @IsPositive() đảm bảo lớn hơn 0. @IsNumber() chấp nhận cả số thực (float/decimal).'
      },
      {
        id: 's1-q11',
        question: 'Custom Decorator được tạo bằng `createParamDecorator` trong NestJS thường dùng để làm gì?',
        options: [
          'Trích xuất một phần dữ liệu cụ thể từ Request (như thông tin User từ token) và truyền thẳng vào tham số của Controller method để code gọn hơn',
          'Tạo giao diện HTML',
          'Cấu hình kết nối Database',
          'Thêm CSS cho các API'
        ],
        correctIndex: 0,
        explanation: 'Thay vì dùng `@Req() req` và phải gọi `req.user` ở mọi chỗ, ta có thể viết `@CurrentUser() user` để lấy ra trực tiếp, giúp code sạch và dễ test hơn.'
      },
      {
        id: 's1-q12',
        question: 'Sự khác biệt rõ ràng nhất giữa Middleware và Interceptor trong NestJS là gì?',
        options: [
          'Middleware xử lý ở mức giao thức HTTP thô (Express req/res), trong khi Interceptor gắn với RxJS, có quyền can thiệp vào quá trình thực thi method, thay đổi kết quả trả về (Response) và kiểm soát lỗi',
          'Middleware chạy nhanh hơn Interceptor',
          'Interceptor chỉ chạy trước khi request vào Controller',
          'Middleware có thể thay đổi dữ liệu trả về dễ dàng hơn Interceptor'
        ],
        correctIndex: 0,
        explanation: 'Interceptor là một công cụ mạnh mẽ dựa trên RxJS, cho phép tap() hoặc map() stream dữ liệu sau khi Controller xử lý xong.'
      },
      {
        id: 's1-q13',
        question: 'Việc cấu hình `useValue` trong Custom Provider của module NestJS có ý nghĩa gì?',
        options: [
          'Cung cấp một đối tượng hằng số, cấu hình tĩnh hoặc Mock object có sẵn vào hệ thống Dependency Injection thay vì khởi tạo một class mới',
          'Dùng để trả về giá trị HTTP mặc định',
          'Xóa biến ra khỏi bộ nhớ',
          'Ép kiểu dữ liệu của biến'
        ],
        correctIndex: 0,
        explanation: '`useValue` là cách đơn giản nhất để chèn một config object (ví dụ: mã API key) vào provider để các class khác `@Inject()`.'
      },
      {
        id: 's1-q14',
        question: 'Decorator `@Global()` gắn trên một Module trong NestJS sẽ có hiệu ứng gì?',
        options: [
          'Làm cho các providers được export của module đó trở nên có sẵn ở bất kỳ module nào khác mà không cần phải import module này vào mảng `imports`',
          'Phát tán module lên mạng Internet',
          'Tạo một biến Global trong JavaScript',
          'Cho phép mọi người dùng gọi API mà không cần đăng nhập'
        ],
        correctIndex: 0,
        explanation: '`@Global()` hữu ích cho các cấu hình lõi (Database, Config), giúp tránh việc phải import quá nhiều ở khắp mọi module con.'
      },
      {
        id: 's1-q15',
        question: 'Cờ `transform: true` trong ValidationPipe của NestJS có tác dụng gì quan trọng nhất?',
        options: [
          'Tự động chuyển đổi kiểu dữ liệu từ chuỗi (string) trên mạng thành đúng loại kiểu dữ liệu được khai báo trong DTO (như Date, số nguyên, boolean) hoặc biến DTO class thô thành Instance thật',
          'Dịch tự động nội dung request sang ngôn ngữ khác',
          'Thay đổi tên các trường trong JSON',
          'Nén request lại cho nhỏ gọn hơn'
        ],
        correctIndex: 0,
        explanation: 'Dữ liệu gửi lên từ HTTP thường luôn là dạng chuỗi (query string hoặc params). `transform: true` giúp tự cast sang Number/Boolean/Date theo Type của DTO.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 1: Clean DTO Normalizer',
      description: 'Viết hàm `processItemCreation(rawInput)`: trim `code` và `name`. Nếu thiếu `code` hoặc `name` ném `Error("INVALID_PAYLOAD")`. Trả về `{ code: code.toUpperCase(), name, price: rawInput.price || 0, isActive: rawInput.isActive ?? true }`.',
      starterCode: `function processItemCreation(rawInput) {
  // Viết logic chuẩn hóa
  
}`,
      solution: `function processItemCreation(rawInput) {
  if (!rawInput || typeof rawInput !== 'object') throw new Error("INVALID_PAYLOAD");
  const code = (rawInput.code || '').trim();
  const name = (rawInput.name || '').trim();
  if (!code || !name) throw new Error("INVALID_PAYLOAD");
  return {
    code: code.toUpperCase(),
    name: name,
    price: typeof rawInput.price === 'number' ? rawInput.price : 0,
    isActive: typeof rawInput.isActive === 'boolean' ? rawInput.isActive : true
  };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Chuẩn hóa thành công',
          input: [{ code: '  vtth-01 ', name: ' Bông gòn ', price: 15000 }],
          expected: { code: 'VTTH-01', name: 'Bông gòn', price: 15000, isActive: true },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Thiếu code -> Báo lỗi',
          input: [{ name: 'Bông gòn' }],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Chỉ chứa khoảng trắng -> Lỗi',
          input: [{ code: '   ', name: '   ' }],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): Input null -> Lỗi',
          input: [null],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 (Hidden): Bỏ qua price không phải số',
          input: [{ code: 'A', name: 'B', price: '100' }],
          expected: { code: 'A', name: 'B', price: 0, isActive: true },
          hidden: true
        },
        {
          name: 'Case 6 (Hidden): isActive false được giữ nguyên',
          input: [{ code: 'A', name: 'B', isActive: false }],
          expected: { code: 'A', name: 'B', price: 0, isActive: false },
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 2,
    title: 'Bài Kiểm Tra Sprint 2: PostgreSQL & Prisma 7',
    description: 'Đánh giá kiến thức về Database Schema, Quan hệ 1-N, Transaction ACID, Concurrency Locking và Multi-Tenancy.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's2-q1',
        question: 'Nguyên tắc vàng nào bắt buộc phải tuân theo khi viết mọi hàm query trong tầng Service của eSmiles?',
        options: [
          'Luôn luôn ép điều kiện where: { unitId } để cô lập dữ liệu phòng khám (Tenant Isolation)',
          'Luôn luôn trả về kiểu any',
          'Dùng console.log()',
          'Không bao giờ dùng async/await'
        ],
        correctIndex: 0,
        explanation: 'Multi-tenancy bắt buộc mọi truy vấn phải có unitId để đảm bảo dữ liệu của các phòng khám không bị rò rỉ lẫn nhau.'
      },
      {
        id: 's2-q2',
        question: 'Khi thực hiện xóa một Danh mục đang có Sản phẩm liên kết với khóa ngoại onDelete: Restrict, lỗi DB sẽ được map thành mã HTTP nào?',
        options: [
          '409 Conflict',
          '200 OK',
          '500 Internal Server Error',
          '401 Unauthorized'
        ],
        correctIndex: 0,
        explanation: 'Khóa ngoại Restrict ngăn chặn xóa cha khi còn con và được map thành 409 Conflict.'
      },
      {
        id: 's2-q3',
        question: 'Trong Prisma, khi chỉ cần lấy một số cột cần thiết từ bảng quan hệ, ta dùng tùy chọn nào để tối ưu băng thông?',
        options: [
          'select',
          'include',
          'where',
          'orderBy'
        ],
        correctIndex: 0,
        explanation: 'select cho phép chỉ định chính xác các cột cần lấy từ DB, giảm dung lượng truyền tải.'
      },
      {
        id: 's2-q4',
        question: 'Tính chất Atomicity (Nguyên tử) trong Transaction Database đảm bảo điều gì?',
        options: [
          'Tất cả các câu lệnh trong transaction cùng thành công, hoặc nếu 1 câu lỗi thì toàn bộ tự động Rollback về như cũ',
          'Dữ liệu tự động nhân đôi',
          'Database không bao giờ bị tắt',
          'Tăng tốc độ mạng'
        ],
        correctIndex: 0,
        explanation: 'Atomicity đảm bảo tính toàn vẹn tuyệt đối: Tất cả cùng thành công hoặc không có gì thay đổi.'
      },
      {
        id: 's2-q5',
        question: 'Trong PostgreSQL, khi muốn truy vấn tên nhân viên và đếm số lượng cuộc hẹn của họ trong cùng một câu lệnh, hàm nào thường dùng kết hợp với GROUP BY?',
        options: [
          'COUNT()',
          'SUM()',
          'MAX()',
          'JOIN()'
        ],
        correctIndex: 0,
        explanation: 'COUNT() là hàm aggregate đếm số dòng, rất phổ biến cho các báo cáo kết hợp GROUP BY.'
      },
      {
        id: 's2-q6',
        question: 'Khóa chính tổng hợp (Composite Primary Key) trong Prisma được định nghĩa như thế nào?',
        options: [
          'Bằng thuộc tính `@@id([field1, field2])` ở mức model',
          'Dùng @id trên nhiều trường cùng lúc',
          'Prisma không hỗ trợ Composite Primary Key',
          'Dùng @unique'
        ],
        correctIndex: 0,
        explanation: '@@id định nghĩa mức block-level cho nhiều trường đóng vai trò khóa chính kết hợp.'
      },
      {
        id: 's2-q7',
        question: 'Khi nhiều Transaction cùng cạnh tranh sửa một row, cách tiếp cận "Pessimistic Locking" (Khóa bi quan) hoạt động ra sao?',
        options: [
          'Dùng câu lệnh `SELECT ... FOR UPDATE` để khóa chặt dòng dữ liệu đó, các transaction khác muốn sửa hoặc đọc phải đợi đến khi transaction này hoàn tất (COMMIT/ROLLBACK)',
          'Cho phép tất cả cùng sửa, ai lưu cuối cùng thì thắng',
          'Thêm một cột `version` vào bảng và kiểm tra lúc UPDATE (Optimistic Locking)',
          'Tắt Database tạm thời'
        ],
        correctIndex: 0,
        explanation: 'Khóa bi quan ngăn ngừa Data Race ở cấp độ DB Engine, rất cần thiết cho các tác vụ nhạy cảm như trừ số dư kho.'
      },
      {
        id: 's2-q8',
        question: 'Tác dụng của `cascade` (OnDelete: Cascade) trong khóa ngoại của Prisma/Postgres là gì?',
        options: [
          'Khi record cha bị xóa, toàn bộ các record con liên kết với nó cũng tự động bị xóa theo',
          'Ngăn không cho xóa cha nếu còn con',
          'Đổi giá trị con thành NULL',
          'Đổi tên cha'
        ],
        correctIndex: 0,
        explanation: 'Cascade giúp dọn dẹp dữ liệu thừa thãi một cách tự động, nhưng cần cẩn thận ở các hệ thống không được phép xóa thật (Hard delete).'
      },
      {
        id: 's2-q9',
        question: 'Lỗi N+1 Query trong ORM là hiện tượng gì?',
        options: [
          'Lấy 1 danh sách gồm N phần tử, sau đó với mỗi phần tử lại gọi 1 câu query DB để lấy thông tin liên kết, tổng cộng mất 1 + N queries rất chậm',
          'Viết sai cú pháp SQL',
          'Query 1 lần trả về quá nhiều dữ liệu',
          'Database bị restart N+1 lần'
        ],
        correctIndex: 0,
        explanation: 'N+1 là lỗi hiệu năng kinh điển của ORM. Thay vì nạp lười (Lazy Load), ta phải dùng Dataloader hoặc include/JOIN để gom thành 1 query.'
      },
      {
        id: 's2-q10',
        question: 'Lệnh Prisma Migration (`npx prisma migrate dev`) làm nhiệm vụ gì?',
        options: [
          'So sánh lược đồ prisma schema với DB hiện tại, sinh ra file SQL chứa các thay đổi (ALTER TABLE), lưu vào lịch sử và thực thi vào DB',
          'Chỉ để sinh ra file PrismaClient',
          'Reset toàn bộ cơ sở dữ liệu về 0',
          'Format lại code TypeScript'
        ],
        correctIndex: 0,
        explanation: 'Migration system giúp theo dõi và áp dụng các thay đổi cấu trúc bảng một cách có tổ chức trên nhiều môi trường.'
      },
      {
        id: 's2-q11',
        question: 'Tại sao việc đánh Index (Chỉ mục) nhiều lại làm chậm thao tác Insert/Update trên cơ sở dữ liệu?',
        options: [
          'Vì mỗi khi có dữ liệu mới được chèn hoặc sửa đổi, Database phải tính toán và cập nhật lại tất cả các cấu trúc cây B-Tree của các Index liên quan, gây tốn tài nguyên',
          'Vì Index chiếm dụng đường truyền mạng',
          'Vì Index làm khóa dữ liệu không cho sửa',
          'Vì Index tự động kiểm tra lỗi chính tả'
        ],
        correctIndex: 0,
        explanation: 'Index là con dao hai lưỡi. Nó tăng tốc độ READ cực nhanh (tìm kiếm) nhưng đánh đổi bằng việc làm chậm các thao tác WRITE (thêm/sửa/xóa).'
      },
      {
        id: 's2-q12',
        question: 'Khác biệt giữa Transaction thông thường và `interactiveTransaction` trong Prisma là gì?',
        options: [
          'Interactive Transaction cho phép chạy các đoạn code JavaScript/TypeScript xen kẽ giữa các câu lệnh DB, kết quả của query trước có thể dùng làm input cho query sau',
          'Interactive Transaction chạy nhanh hơn',
          'Interactive Transaction có giao diện người dùng',
          'Interactive Transaction không bị khóa bảng'
        ],
        correctIndex: 0,
        explanation: 'Prisma hỗ trợ `prisma.$transaction(async (tx) => { ... })` cho phép thực thi logic nghiệp vụ phức tạp ở giữa các lệnh gọi DB mà vẫn đảm bảo tính nguyên tử ACID.'
      },
      {
        id: 's2-q13',
        question: 'Mối quan hệ Many-to-Many ẩn (Implicit) trong Prisma khác với Explicit như thế nào?',
        options: [
          'Implicit cho phép Prisma tự động quản lý một bảng trung gian ẩn ở dưới DB, ta không cần khai báo model cho bảng trung gian đó và không thể thêm các trường bổ sung vào nó',
          'Implicit không sử dụng bảng trung gian',
          'Implicit lưu mảng trực tiếp vào cột',
          'Implicit chỉ hỗ trợ MySQL'
        ],
        correctIndex: 0,
        explanation: 'Implicit m-n tiện lợi khi chỉ cần liên kết đơn giản. Nhưng nếu cần lưu thêm thông tin (như thời gian liên kết, vai trò), ta phải chuyển sang Explicit m-n có model riêng.'
      },
      {
        id: 's2-q14',
        question: 'Để đảm bảo tuyệt đối không có hai tài khoản đăng ký cùng một số điện thoại, biện pháp phòng vệ an toàn nhất tại tầng Database là gì?',
        options: [
          'Tạo một ràng buộc Unique Index trên cột số điện thoại, Database sẽ tự động ném lỗi nếu có luồng cố ý ghi trùng',
          'Sử dụng Transaction khóa toàn bộ database mỗi khi đăng ký',
          'Kiểm tra bảng xem số điện thoại đã tồn tại chưa bằng code trước khi chèn (Race condition có thể lọt)',
          'Tự động thêm timestamp vào sau số điện thoại'
        ],
        correctIndex: 0,
        explanation: 'Kiểm tra bằng code (find rồi mới create) luôn tiềm ẩn rủi ro Race Condition khi có 2 request đến cùng lúc. Unique Constraint ở DB engine là lá chắn thép cuối cùng.'
      },
      {
        id: 's2-q15',
        question: 'Rủi ro lớn nhất khi thực hiện lệnh xóa cột (Drop Column) bằng Prisma Migration trên môi trường Production là gì?',
        options: [
          'Làm mất vĩnh viễn dữ liệu thật nếu không sao lưu, và làm sập ứng dụng đang chạy nếu source code phiên bản cũ vẫn đang query cột đó',
          'Phải trả thêm tiền bản quyền Prisma',
          'Làm ổ cứng bị đầy rác',
          'Không có rủi ro, Prisma sẽ ngăn chặn tự động'
        ],
        correctIndex: 0,
        explanation: 'Luôn phải có quy trình Roll-forward, xóa cột là thao tác nguy hiểm. Phải cập nhật code ngưng sử dụng cột đó trước, sau đó mới deploy migration xóa cột.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 2: Safe Tenant Updater',
      description: 'Viết hàm `safeUpdateItem(dbMock, unitId, itemId, updateData)`: 1. Tìm item với `where: { id: itemId, unitId }`. 2. Nếu không tìm thấy, ném `Error("NOT_FOUND")`. 3. Nếu tìm thấy, gọi `dbMock.update({ where: { id: itemId }, data: updateData })` và trả về kết quả.',
      starterCode: `async function safeUpdateItem(dbMock, unitId, itemId, updateData) {
  // Viết logic cập nhật an toàn
  
}`,
      solution: `async function safeUpdateItem(dbMock, unitId, itemId, updateData) {
  const existing = await dbMock.findFirst({
    where: { id: itemId, unitId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  return dbMock.update({
    where: { id: itemId },
    data: updateData
  });
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Cập nhật thành công',
          input: [
            {
              findFirst: async () => ({ id: 'i1', unitId: 'u1' }),
              update: async (args: any) => ({ id: args.where.id, ...args.data })
            },
            'u1',
            'i1',
            { name: 'Kim tiêm 5ml' }
          ],
          expected: { id: 'i1', name: 'Kim tiêm 5ml' },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Sai unitId -> Ném lỗi NOT_FOUND',
          input: [
            { findFirst: async () => null },
            'u-hacker',
            'i1',
            { name: 'Kim tiêm 5ml' }
          ],
          expected: 'ERROR_THROWN',
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): UpdateData có nhiều trường',
          input: [
            { findFirst: async () => ({ id: 'i2', unitId: 'u2' }), update: async (args: any) => ({ id: args.where.id, ...args.data }) },
            'u2',
            'i2',
            { name: 'Găng tay', price: 200 }
          ],
          expected: { id: 'i2', name: 'Găng tay', price: 200 },
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): throw error từ db',
          input: [
            { findFirst: async () => { throw new Error('DB_CONN_FAIL'); } },
            'u3',
            'i3',
            {}
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 5 (Hidden): Error in update',
          input: [
            { findFirst: async () => ({ id: 'i4', unitId: 'u4' }), update: async () => { throw new Error('UNIQUE_FAIL'); } },
            'u4',
            'i4',
            {}
          ],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 6 (Hidden): Return null on update',
          input: [
            { findFirst: async () => ({ id: 'i5', unitId: 'u5' }), update: async () => null },
            'u5',
            'i5',
            {}
          ],
          expected: null,
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 3,
    title: 'Bài Kiểm Tra Sprint 3: Xử Lý Lỗi, Bảo Mật & Xác Thực',
    description: 'Đánh giá kiến thức về AllExceptionsFilter, JWT Bearer/Cookie, CASL Permission Guard và Multi-surface Architecture.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's3-q1',
        question: 'Cấu trúc chuẩn của một mã quyền (Permission) trong hệ thống eSmiles gồm 3 phần là gì?',
        options: [
          'module:resource:action',
          'ROLE:ADMIN:USER',
          'GET:POST:DELETE',
          'URL:CONTROLLER:METHOD'
        ],
        correctIndex: 0,
        explanation: 'eSmiles áp dụng định dạng chuẩn module:resource:action (vd: inventory:category:create).'
      },
      {
        id: 's3-q2',
        question: 'Endpoint nào sau đây thuộc về bề mặt dành riêng cho Quản trị viên nền tảng (Platform Admin)?',
        options: [
          '/api/i/admin/v1/tenants',
          '/api/p/v1/profile',
          '/api/i/v1/appointments',
          '/api/v1/health'
        ],
        correctIndex: 0,
        explanation: '/api/i/admin/v1 là prefix dành cho Platform Admin.'
      },
      {
        id: 's3-q3',
        question: 'Khi Bác sĩ đăng nhập thành công nhưng truy cập vào tính năng không có quyền, Server trả về mã HTTP nào?',
        options: [
          '403 Forbidden',
          '401 Unauthorized',
          '404 Not Found',
          '500 Internal Error'
        ],
        correctIndex: 0,
        explanation: '403 Forbidden là mã chuẩn khi tài khoản đã xác thực nhưng bị từ chối quyền truy cập.'
      },
      {
        id: 's3-q4',
        question: 'Lỗi Prisma P2002 (Unique constraint violation) được Filter toàn cục map thành mã HTTP nào?',
        options: [
          '409 Conflict',
          '200 OK',
          '500 Internal Error',
          '400 Bad Request'
        ],
        correctIndex: 0,
        explanation: 'Trùng mã khóa duy nhất được map thành 409 Conflict.'
      },
      {
        id: 's3-q5',
        question: 'Một trong những nguyên tắc quan trọng khi băm (hash) mật khẩu là phải có "Salt". Salt có tác dụng gì?',
        options: [
          'Thêm một chuỗi ngẫu nhiên vào mật khẩu trước khi băm để đảm bảo hai user có mật khẩu giống hệt nhau cũng sinh ra hash khác nhau, chống lại Rainbow Table',
          'Làm mật khẩu dài ra để khó đoán hơn',
          'Để giải mã lại mật khẩu khi user quên',
          'Làm đẹp cơ sở dữ liệu'
        ],
        correctIndex: 0,
        explanation: 'Salt ngăn chặn hacker dùng từ điển các mã hash pre-computed (Rainbow tables) để đảo ngược hàng loạt mật khẩu cùng lúc.'
      },
      {
        id: 's3-q6',
        question: 'Cơ chế xác thực Access Token (JWT) khác biệt thế nào với Session-based (Cookies/SessionID)?',
        options: [
          'JWT mang toàn bộ thông tin xác thực bên trong bản thân nó (stateless), server không cần truy vấn Database hay Redis để kiểm tra hợp lệ, chỉ cần verify chữ ký',
          'JWT bắt buộc phải lưu trong database',
          'Session-based an toàn hơn JWT',
          'JWT không thể hết hạn'
        ],
        correctIndex: 0,
        explanation: 'Chữ ký số của JWT giúp server có thể tin tưởng nội dung payload mà không cần lookup DB, tối ưu tốc độ.'
      },
      {
        id: 's3-q7',
        question: 'Role-Based Access Control (RBAC) kết hợp với Attribute-Based Access Control (ABAC) trong eSmiles giải quyết bài toán gì?',
        options: [
          'Kiểm soát quyền không chỉ ở mức độ thao tác (như quyền Edit) mà còn ở mức tài nguyên cụ thể (như chỉ được Edit bệnh án của TÔI tạo ra)',
          'Làm cho code dài hơn',
          'Thay thế hoàn toàn mật khẩu',
          'Ngăn chặn SQL Injection'
        ],
        correctIndex: 0,
        explanation: 'Sự kết hợp này mang lại khả năng phân quyền mịn (fine-grained), cần thiết cho hệ thống y tế đa chiều.'
      },
      {
        id: 's3-q8',
        question: 'Tại sao lại dùng 2 loại Token: Access Token (sống ngắn 15p) và Refresh Token (sống dài 30 ngày)?',
        options: [
          'Hạn chế rủi ro lộ token. Access Token bị lộ cũng chỉ xài được 15p. Refresh Token an toàn hơn (trong HttpOnly) dùng để đổi token mới',
          'Vì JWT giới hạn dung lượng',
          'Vì Apple và Google bắt buộc',
          'Để theo dõi người dùng'
        ],
        correctIndex: 0,
        explanation: 'Cơ chế Dual-Token cân bằng giữa hiệu năng (không cần check DB mỗi request) và bảo mật (có thể thu hồi phiên làm việc qua Refresh Token).'
      },
      {
        id: 's3-q9',
        question: 'Trong mô hình phân quyền eSmiles, khi tạo mới một Role cho Unit, Role này có hiển thị cho Unit khác không?',
        options: [
          'Không, Role bị giới hạn trong phạm vi của Unit thông qua unitId, đảm bảo Tenant Isolation (cô lập chi nhánh)',
          'Có, Role là Global',
          'Tùy chỉnh trong cấu hình',
          'Có, nhưng bị ẩn giao diện'
        ],
        correctIndex: 0,
        explanation: 'Multi-tenant áp dụng mạnh mẽ ngay cả trên thiết lập quyền (Role), các chi nhánh không được thấy thiết lập của nhau.'
      },
      {
        id: 's3-q10',
        question: 'Thuật toán mã hóa AES-256 thường được sử dụng ở đâu trong bảo mật dữ liệu y tế?',
        options: [
          'Mã hóa thông tin bệnh án nhạy cảm ở cấp độ database hoặc file trước khi ghi ra đĩa (Encryption at Rest)',
          'Mã hóa mật khẩu người dùng',
          'Tạo Access Token JWT',
          'Thay thế HTTPS'
        ],
        correctIndex: 0,
        explanation: 'AES-256 là thuật toán mã hóa đối xứng, lý tưởng để bảo mật dữ liệu "At Rest" (trên đĩa) để khi bị lộ database, hacker cũng không đọc được PII.'
      },
      {
        id: 's3-q11',
        question: 'Tại sao thuật toán Argon2 hiện nay được ưu tiên hơn bcrypt cho việc băm (hashing) mật khẩu?',
        options: [
          'Argon2 có cơ chế kháng cự cả GPU (memory-hard), khiến hacker dùng card đồ họa để crack mật khẩu cũng cực kỳ tốn chi phí và thời gian',
          'Argon2 chạy nhanh hơn bcrypt 100 lần',
          'Argon2 là thuật toán mã hóa có thể giải mã',
          'Bcrypt đã bị lộ key giải mã'
        ],
        correctIndex: 0,
        explanation: 'Argon2 (đặc biệt là Argon2id) được thiết kế Memory-hard, chống lại các cuộc tấn công dùng phần cứng chuyên dụng ASIC hay GPU mà bcrypt chưa tối ưu tốt.'
      },
      {
        id: 's3-q12',
        question: 'Khi sử dụng Cookie để chứa JWT, hệ thống dễ bị tấn công CSRF (Cross-Site Request Forgery). Cách phòng thủ đơn giản và hiệu quả nhất cho API hiện đại là gì?',
        options: [
          'Sử dụng thuộc tính SameSite=Strict hoặc SameSite=Lax cho Cookie',
          'Cấm hoàn toàn việc dùng Cookie',
          'Tắt Javascript trên trình duyệt',
          'Dùng giao thức UDP'
        ],
        correctIndex: 0,
        explanation: 'SameSite Attribute hướng dẫn trình duyệt không gửi kèm Cookie nếu request bắt nguồn từ một domain khác, ngăn chặn hiệu quả CSRF mà không cần token rườm rà.'
      },
      {
        id: 's3-q13',
        question: 'Thư viện CASL giúp phân quyền kiểm soát truy cập thuộc tính (Attribute-based) như thế nào?',
        options: [
          'Cho phép định nghĩa rule phức tạp: VD User A chỉ được SỬA Bài viết B NẾU Bài viết B thuộc quyền sở hữu của User A, thay vì chỉ kiểm tra quyền SỬA chung chung',
          'Chặn IP của hacker tự động',
          'Thay thế JWT Token',
          'Mã hóa đường truyền'
        ],
        correctIndex: 0,
        explanation: 'CASL nổi bật ở khả năng define các policy phụ thuộc vào giá trị của thực thể (Subject) ở runtime, rất thích hợp cho Row-level Security và ABAC.'
      },
      {
        id: 's3-q14',
        question: 'Rủi ro bảo mật chính khi cấu hình thời gian sống (Expiration) của Access Token quá dài (ví dụ 1 tháng) là gì?',
        options: [
          'Khi Token bị đánh cắp hoặc khi tài khoản bị khóa/thu quyền, hacker vẫn có thể tiếp tục truy cập API trong thời gian dài vì Access Token không cần check DB',
          'Làm đầy bộ nhớ của Redis',
          'Làm chậm quá trình ký Token',
          'Trình duyệt từ chối lưu token'
        ],
        correctIndex: 0,
        explanation: 'Stateless JWT không lưu session ở DB, do đó rất khó để "thu hồi" (revoke) ngay lập tức. Vì thế, Access Token phải có thời hạn thật ngắn (15-30p) để hạn chế rủi ro.'
      },
      {
        id: 's3-q15',
        question: 'Vì sao không bao giờ được gửi thông báo lỗi DB gốc (ví dụ: Prisma error details, SQL queries) trực tiếp về cho Client trong Exception Filter?',
        options: [
          'Vì thông báo lỗi gốc có thể làm lộ cấu trúc bảng, tên trường và công nghệ DB, tạo cơ sở cho hacker thực hiện tấn công (Information Disclosure)',
          'Vì lỗi gốc quá dài làm tốn băng thông mạng',
          'Vì Client không biết đọc tiếng Anh',
          'Vì lỗi gốc sẽ làm crash trình duyệt'
        ],
        correctIndex: 0,
        explanation: 'Lộ thông tin nội bộ (Information Leakage) là lỗ hổng phổ biến. Exception Filter phải luôn che giấu chi tiết (chỉ log ở server) và trả về thông báo lỗi chung chung (vd: 500 Internal Error) trên môi trường Prod.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 3: Multi-Role Authorization Filter',
      description: 'Viết hàm `authorizeUserAction(user, requiredModule, requiredAction)`: nếu `user.isSuperAdmin` hoặc `user.permissions` có `<requiredModule>:<requiredAction>` hoặc `<requiredModule>:*` hoặc `*` thì trả về `{ allowed: true }`, ngược lại trả về `{ allowed: false, reason: "FORBIDDEN" }`.',
      starterCode: `function authorizeUserAction(user, requiredModule, requiredAction) {
  // Viết logic phân quyền
  
}`,
      solution: `function authorizeUserAction(user, requiredModule, requiredAction) {
  if (user?.isSuperAdmin) return { allowed: true };
  const perms = user?.permissions || [];
  const exact = requiredModule + ':' + requiredAction;
  const modWild = (requiredModule.split(':')[0] || '') + ':*';
  if (perms.includes('*') || perms.includes(modWild) || perms.includes(exact) || perms.includes(requiredModule + ':*')) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'FORBIDDEN' };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Quyền chính xác',
          input: [{ permissions: ['inventory:item:create'] }, 'inventory:item', 'create'],
          expected: { allowed: true },
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Quyền wildcard module',
          input: [{ permissions: ['inventory:*'] }, 'inventory:item', 'delete'],
          expected: { allowed: true },
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Quyền sao cho toàn bộ hệ thống (*)',
          input: [{ permissions: ["*"] }, "hr:employee", "delete"],
          expected: { allowed: true },
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): Quyền bị từ chối do module khác',
          input: [{ permissions: ["hr:employee:*"] }, "inventory:item", "create"],
          expected: { allowed: false, reason: "FORBIDDEN" },
          hidden: true
        },
        {
          name: 'Case 5 (Hidden): IsSuperAdmin luôn true',
          input: [{ isSuperAdmin: true, permissions: [] }, "some:module", "action"],
          expected: { allowed: true },
          hidden: true
        },
        {
          name: 'Case 6 (Hidden): Thiếu user object',
          input: [null, "inventory:item", "create"],
          expected: { allowed: false, reason: "FORBIDDEN" },
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 4,
    title: 'Bài Kiểm Tra Sprint 4: Queue, Redis, Presigned S3 & Realtime',
    description: 'Đánh giá kiến thức về Redis Caching, BullMQ Queue, MinIO Presigned URLs và WebSocket Rooms.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's4-q1',
        question: 'Tại sao việc upload file X-Quang 500MB nên dùng Presigned URL bắn trực tiếp lên MinIO/S3 thay vì gửi qua NestJS Server?',
        options: [
          'Để giải phóng hoàn toàn băng thông và RAM của máy chủ Backend NestJS, tránh nghẽn luồng xử lý của các bác sĩ khác',
          'Vì MinIO bắt buộc',
          'Để làm ảnh nét hơn',
          'Không có lý do'
        ],
        correctIndex: 0,
        explanation: 'Presigned URL đẩy tải truyền dữ liệu nặng sang Object Storage chuyên dụng.'
      },
      {
        id: 's4-q2',
        question: 'Ưu điểm lớn nhất của việc sử dụng Message Queue (BullMQ) cho tác vụ gửi SMS là gì?',
        options: [
          'API phản hồi ngay lập tức cho người dùng trong 5ms và tự động retry nếu dịch vụ SMS bên thứ ba bị mất mạng',
          'Để thay thế database',
          'Làm ngắn code',
          'Không có tác dụng'
        ],
        correctIndex: 0,
        explanation: 'Queue tách biệt luồng xử lý nặng ra khỏi luồng HTTP chính.'
      },
      {
        id: 's4-q3',
        question: 'Cơ chế Cache Invalidation trong Redis cần được thực hiện khi nào?',
        options: [
          'Ngay khi dữ liệu tương ứng trong Database bị thay đổi (Create/Update/Delete)',
          'Khởi động lại server',
          'Mỗi ngày 1 lần',
          'Không cần xóa'
        ],
        correctIndex: 0,
        explanation: 'Xóa cache khi dữ liệu thay đổi đảm bảo tính nhất quán giữa Redis và Database.'
      },
      {
        id: 's4-q4',
        question: 'WebSocket Rooms phân chia theo "unit:{unitId}" nhằm mục đích gì?',
        options: [
          'Đảm bảo thông báo chỉ phát cho các bác sĩ trong đúng phòng khám đó, tránh lộ dữ liệu sang phòng khám khác',
          'Tăng độ phân giải màn hình',
          'Làm ngắn code',
          'Không có tác dụng'
        ],
        correctIndex: 0,
        explanation: 'Rooms phân vùng sự kiện theo từng Tenant phòng khám.'
      },
      {
        id: 's4-q5',
        question: 'Redis hỗ trợ cấu trúc dữ liệu nào RẤT HỮU ÍCH cho việc triển khai chức năng "Bảng xếp hạng (Leaderboard)"?',
        options: [
          'Sorted Sets (ZSET)',
          'Hashes',
          'Lists',
          'Strings'
        ],
        correctIndex: 0,
        explanation: 'Sorted Sets lưu phần tử kèm theo điểm số (score), tự động sắp xếp và truy xuất rank nhanh chóng O(log(N)).'
      },
      {
        id: 's4-q6',
        question: 'Trong Redis Pub/Sub, nếu một subscriber bị mất mạng lúc tin nhắn gửi đến, chuyện gì xảy ra?',
        options: [
          'Tin nhắn bị mất đối với subscriber đó, Pub/Sub của Redis là Fire-and-Forget không có lưu trữ',
          'Redis tự động lưu lại và gửi bù (Retry) khi có mạng',
          'Toàn bộ server Redis bị treo chờ kết nối',
          'Tin nhắn được chuyển sang BullMQ'
        ],
        correctIndex: 0,
        explanation: 'Khác với Message Queue chuyên nghiệp, Redis Pub/Sub cơ bản không có tính năng Reliability (đảm bảo giao phát).'
      },
      {
        id: 's4-q7',
        question: 'BullMQ sử dụng Redis dưới nền tảng. Tính năng "Delayed Jobs" (Ví dụ: Gửi email sau 3 ngày) hoạt động nhờ cấu trúc nào của Redis?',
        options: [
          'Sorted Sets: Lưu timestamp thời điểm cần chạy dưới dạng điểm số (score) và có worker thường xuyên kiểm tra quét (polling) để đưa vào Queue chính',
          'Lệnh SLEEP của Redis',
          'Hàm setTimeout của Node.js',
          'BullMQ không làm được việc này'
        ],
        correctIndex: 0,
        explanation: 'BullMQ lợi dụng ZSET lưu thời điểm thực thi. Khi timestamp tới, Lua script sẽ bốc job đó ném vào danh sách chờ.'
      },
      {
        id: 's4-q8',
        question: 'Lợi ích bảo mật của S3 Presigned URL so với Public URL là gì?',
        options: [
          'URL chỉ có giá trị trong khoảng thời gian rất ngắn (ví dụ: 5 phút), sau đó sẽ vô hiệu hóa (Expired), giúp ngăn chia sẻ link trái phép',
          'URL tự động mã hóa dữ liệu thành zip',
          'Không ai khác đọc được ngoại trừ admin',
          'Tránh việc bị crawl dữ liệu'
        ],
        correctIndex: 0,
        explanation: 'Presigned URL sử dụng chữ ký mã hóa kết hợp với thời hạn TTL, giúp chia sẻ an toàn file riêng tư.'
      },
      {
        id: 's4-q9',
        question: 'Khi triển khai Socket.io trên 2 server (Node.js Instances) đứng sau một Load Balancer, ta bắt buộc phải cấu hình thêm công cụ gì để tin nhắn chat truyền được từ User ở server 1 sang User ở server 2?',
        options: [
          'Redis Adapter (Redis Pub/Sub) để đồng bộ sự kiện giữa các máy chủ Socket',
          'Không cần cấu hình gì',
          'Dùng Database PostgreSQL để lưu log chat',
          'Sử dụng HTTPS thay cho HTTP'
        ],
        correctIndex: 0,
        explanation: 'Các instance Node.js độc lập nhau. Redis Adapter đứng giữa làm cầu nối Pub/Sub để phát broadcast event sang các instance khác.'
      },
      {
        id: 's4-q10',
        question: 'Khái niệm "Idempotent Consumer" trong Message Queue nghĩa là gì?',
        options: [
          'Hàm xử lý (worker) phải được thiết kế sao cho dù nhận CÙNG MỘT JOB nhiều lần (do retry/trùng lặp mạng), kết quả cuối cùng vẫn giống nhau (không tính tiền 2 lần, không spam 2 tin)',
          'Hàm xử lý luôn báo lỗi',
          'Consumer luôn chờ người dùng đồng ý',
          'Consumer làm chậm Queue'
        ],
        correctIndex: 0,
        explanation: 'At-least-once delivery là chuẩn của Queue. Vì vậy phía xử lý phải chịu trách nhiệm tính lũy đẳng (Idempotency) để tránh duplicate data.'
      },
      {
        id: 's4-q11',
        question: 'Sự khác biệt cốt lõi giữa Redis Pub/Sub và BullMQ (Redis-based Queue) là gì?',
        options: [
          'Pub/Sub đẩy message ngay lập tức và mất đi (fire-and-forget), nếu không ai nghe thì mất. BullMQ lưu lại job bền vững, có trạng thái (pending, failed), và hỗ trợ retry/delay',
          'Pub/Sub lưu trữ vĩnh viễn, BullMQ bị xóa ngay sau 1 giây',
          'Pub/Sub dùng giao thức MQTT, BullMQ dùng HTTP',
          'Không có khác biệt gì, chúng là một'
        ],
        correctIndex: 0,
        explanation: 'Redis Pub/Sub phù hợp cho real-time chat (nhanh, rẻ). BullMQ phù hợp cho các task quan trọng cần đảm bảo không bị thất thoát như gửi email, xử lý đơn hàng.'
      },
      {
        id: 's4-q12',
        question: 'Tại sao khi triển khai hệ thống WebSockets (như Socket.io) trên nhiều server Node.js (Load Balancing), ta thường cần cơ chế "Sticky Session" hoặc "Redis Adapter"?',
        options: [
          'Bởi vì WebSocket giữ kết nối TCP dai dẳng ở 1 server cụ thể. Các server khác không biết client đó. Cần Redis Pub/Sub để các server nội bộ trò chuyện và phát sóng thông điệp cho nhau',
          'Vì WebSocket tiêu tốn quá nhiều CPU',
          'Vì Node.js không hỗ trợ WebSocket mặc định',
          'Để nén gói tin nhỏ lại'
        ],
        correctIndex: 0,
        explanation: 'Khi Client A nối vào Server 1, Client B nối Server 2. Khi A nhắn cho B, Server 1 phải dùng Redis (Adapter) để broadcast tin nhắn đó sang Server 2 gửi cho B.'
      },
      {
        id: 's4-q13',
        question: 'Hiện tượng "Cache Stampede" (Bão Cache) trong Redis xảy ra khi nào?',
        options: [
          'Khi một dữ liệu Cache cực hot bất ngờ hết hạn (TTL expires), hàng ngàn luồng request cùng lúc xuyên thủng Cache và đổ dồn truy vấn thẳng vào Database, gây sập DB',
          'Khi dữ liệu lưu vào Cache bị lỗi định dạng JSON',
          'Khi RAM của server Redis bị hỏng phần cứng',
          'Khi có quá nhiều Key được tạo ra cùng lúc'
        ],
        correctIndex: 0,
        explanation: 'Cache Stampede là mối đe dọa lớn. Có thể phòng ngừa bằng kỹ thuật Locking (chỉ cho 1 request query DB update Cache) hoặc background refresh trước khi hết hạn.'
      },
      {
        id: 's4-q14',
        question: 'BullMQ hỗ trợ tính năng Delayed Jobs (ví dụ: gửi email nhắc nhở sau 24h) bằng cách nào dưới nền tảng Redis?',
        options: [
          'Sử dụng dữ liệu kiểu Sorted Set (ZSET) của Redis, lấy timestamp làm điểm số (score) để ưu tiên lấy các Job đến hạn ra thực thi',
          'Sử dụng setTimeout của JavaScript treo liên tục',
          'Lưu thời gian vào Database và gọi vòng lặp while liên tục để kiểm tra',
          'Chờ hệ điều hành tự gọi lại'
        ],
        correctIndex: 0,
        explanation: 'BullMQ sử dụng ZSET mạnh mẽ của Redis. ZREVRANGEBYSCORE giúp tìm kiếm cực nhanh các job có timestamp bé hơn thời điểm hiện tại.'
      },
      {
        id: 's4-q15',
        question: 'Để cấp quyền truy cập file tạm thời (ví dụ: link tải xuống) trên MinIO/S3 mà không cần Public Bucket, ta dùng gì?',
        options: [
          'Presigned URL (URL có chứa tham số chữ ký bảo mật và thời gian hết hạn TTL)',
          'Sử dụng mật khẩu root của AWS',
          'Sửa cấu hình Bucket thành Public-Read',
          'Gửi file nén zip có mật khẩu'
        ],
        correctIndex: 0,
        explanation: 'Presigned URL là cách chuẩn nhất để Delegate Access, cho phép client thao tác an toàn với S3 trong khung thời gian hẹp mà không lộ key.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 4: Job Retry Calculator',
      description: 'Viết hàm `calculateBackoffDelay(attempt, baseDelay, maxDelay)` tính: `delay = baseDelay * (2 ** (attempt - 1))`. Nếu `delay > maxDelay` thì lấy `maxDelay`.',
      starterCode: `function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  // Tính delay
  
}`,
      solution: `function calculateBackoffDelay(attempt, baseDelay, maxDelay) {
  const calculated = baseDelay * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(calculated, maxDelay);
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Lần 1: 1000ms',
          input: [1, 1000, 10000],
          expected: 1000,
          hidden: false
        },
        {
          name: 'Case 2 (Visible): Lần 3: 4000ms',
          input: [3, 1000, 10000],
          expected: 4000,
          hidden: false
        },
        {
          name: 'Case 3 (Hidden): Chạm ngưỡng maxDelay',
          input: [10, 1000, 10000],
          expected: 10000,
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): attempt 0 -> min 1',
          input: [0, 1000, 10000],
          expected: 1000,
          hidden: true
        },
        {
          name: 'Case 5 (Hidden): attempt 5 -> 16000 nhưng max là 5000',
          input: [5, 1000, 5000],
          expected: 5000,
          hidden: true
        },
        {
          name: 'Case 6 (Hidden): attempt âm -> coi như 0/1',
          input: [-2, 1000, 10000],
          expected: 1000,
          hidden: true
        },
        {
          name: 'Case 7 (Hidden): base cao hơn max ngay từ đầu',
          input: [2, 20000, 10000],
          expected: 10000,
          hidden: true
        }
      ]
    }
  },
  {
    sprintId: 5,
    title: 'Bài Kiểm Tra Sprint 5: Testing, Audit Log & Production Gate',
    description: 'Đánh giá kiến thức về Audit Logging, Kiểm thử API sống với Bruno, Unit Test Jest và E2E Testing.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questions: [
      {
        id: 's5-q1',
        question: 'Công cụ nào trong dự án eSmiles được dùng để lưu trữ và chạy thử nghiệm trực tiếp các API request được track trong Git?',
        options: [
          'Bruno (.bru)',
          'Postman Cloud',
          'Swagger UI chỉ để xem',
          'Excel'
        ],
        correctIndex: 0,
        explanation: 'eSmiles sử dụng Bruno (.bru) lưu trực tiếp trong thư mục bruno/ của repo Git.'
      },
      {
        id: 's5-q2',
        question: 'Lệnh nào dùng để kiểm tra tự động xem có Controller endpoint nào bị thiếu file .bru trước khi tạo Pull Request?',
        options: [
          'pnpm bruno:check',
          'pnpm test',
          'pnpm build',
          'pnpm lint'
        ],
        correctIndex: 0,
        explanation: 'pnpm bruno:check đối chiếu toàn bộ router với collection Bruno và báo lỗi nếu có endpoint thiếu tài liệu test.'
      },
      {
        id: 's5-q3',
        question: 'Bảng Audit Log trong cơ sở dữ liệu có được phép UPDATE hoặc DELETE không?',
        options: [
          'Tuyệt đối CẤM: Bảng Audit Log là Append-Only (chỉ cho phép INSERT) để đảm bảo tính pháp lý và chống chối bỏ trách nhiệm',
          'Cho phép sửa thoải mái',
          'Tự động xóa sau 1 ngày',
          'Admin được xóa'
        ],
        correctIndex: 0,
        explanation: 'Tính bất biến của Audit Log là nguyên tắc pháp lý cốt lõi trong y tế và tài chính.'
      },
      {
        id: 's5-q4',
        question: 'Khi viết Unit Test cho Service, tại sao nên Mock PrismaService thay vì kết nối Database thật?',
        options: [
          'Để test chạy độc lập, siêu nhanh trong vài ms và không làm thay đổi dữ liệu thật khi chạy trên CI/CD',
          'Vì Jest không có internet',
          'Vì database bị khóa',
          'Không có lý do'
        ],
        correctIndex: 0,
        explanation: 'Mocking giúp unit test chạy nhanh, cô lập và ổn định ở mọi môi trường.'
      },
      {
        id: 's5-q5',
        question: 'Mục đích của việc viết Unit Test cho một Service độc lập hoàn toàn khỏi Database là gì?',
        options: [
          'Xác minh riêng lẽ logic xử lý nghiệp vụ, kiểm soát mọi trường hợp edge-cases (lỗi) bằng cách giả lập (mocking) dữ liệu mà không sợ DB bị treo hay thay đổi',
          'Để không tốn tiền mua Database',
          'Vì Unit test không cho phép kết nối DB',
          'Để test giao diện frontend'
        ],
        correctIndex: 0,
        explanation: 'Sức mạnh của Unit Test là kiểm tra nhanh logic thuật toán và các flow điều kiện if/else mà không bị vướng mắc cơ sở hạ tầng (I/O).'
      },
      {
        id: 's5-q6',
        question: 'E2E (End-to-End) Testing trong NestJS (bằng Supertest) khác biệt như thế nào so với Unit Testing?',
        options: [
          'E2E khởi chạy TOÀN BỘ ứng dụng (bootstrap NestJS app, kết nối test DB, nạp guards/pipes) và bắn một HTTP request ảo vào ứng dụng để kiểm tra từ ngọn đến gốc',
          'E2E chỉ kiểm tra các hàm private',
          'E2E chạy trên trình duyệt web thật của người dùng',
          'Không có sự khác biệt'
        ],
        correctIndex: 0,
        explanation: 'E2E đảm bảo tất cả các lớp (Controller, Service, Middleware, DB) hoạt động trơn tru với nhau khi có request thực tế.'
      },
      {
        id: 's5-q7',
        question: 'Trong Continuous Integration (CI), tại sao bước chạy Test tự động (như pnpm test) thường được đặt làm điều kiện BẮT BUỘC (Required Check) trước khi cho phép Merge Code vào nhánh Main?',
        options: [
          'Để phát hiện và chặn đứng (gate) mã nguồn lỗi, đảm bảo code mới không làm hỏng (regression) các tính năng cũ trước khi đưa lên Production',
          'Để làm chậm quá trình deploy',
          'Để ghi log ra Github',
          'Bắt buộc bởi pháp luật'
        ],
        correctIndex: 0,
        explanation: 'CI Pipeline đóng vai trò "Người gác cổng" tự động, bảo vệ nhánh main khỏi lỗi con người.'
      },
      {
        id: 's5-q8',
        question: 'Một tính năng tạo Audit Log tốt cần bao gồm những thông tin tối thiểu nào?',
        options: [
          'Ai đã làm (User ID), Làm hành động gì (Action), Vào lúc nào (Timestamp), Trên tài nguyên nào (Resource ID), và Kết quả ra sao (Success/Fail)',
          'Chỉ cần User ID và Action',
          'Chỉ ghi thông tin lỗi',
          'Ghi lại mật khẩu của người dùng'
        ],
        correctIndex: 0,
        explanation: 'Nhật ký truy vết phải trả lời được câu hỏi "5W": Who, What, When, Where, Why/Outcome.'
      },
      {
        id: 's5-q9',
        question: 'Trong quy trình CI/CD, "Code Coverage" (Độ bao phủ mã nguồn) đo lường điều gì?',
        options: [
          'Tỷ lệ phần trăm số dòng code (lines), nhánh điều kiện (branches) hoặc hàm (functions) đã thực sự được chạy qua trong quá trình thực thi Test',
          'Tỷ lệ lỗi trên tổng số dòng code',
          'Khối lượng code do AI sinh ra',
          'Tốc độ tải ứng dụng'
        ],
        correctIndex: 0,
        explanation: 'Coverage giúp định lượng xem ta đã kiểm thử được bao nhiêu % hệ thống, chỉ ra những vùng "điểm mù" (blind spots) chưa được test.'
      },
      {
        id: 's5-q10',
        question: 'Tại sao việc "Mocking" hệ thống gửi Email (vd: AWS SES) trong quá trình chạy Test là đặc biệt quan trọng?',
        options: [
          'Để ngăn chặn việc tự động gửi hàng ngàn Email giả mạo/rác tới khách hàng thực mỗi khi Developer chạy lệnh kiểm thử trên máy của họ',
          'Để email gửi đi đẹp hơn',
          'Vì AWS SES luôn thu phí quá đắt',
          'Không có rủi ro nào'
        ],
        correctIndex: 0,
        explanation: 'Việc vô tình gọi các External API làm thay đổi trạng thái thật (gửi email, trừ tiền thẻ) trong lúc test là một sự cố nguy hiểm cần Mock chặn lại.'
      },
      {
        id: 's5-q11',
        question: 'Sự khác biệt cốt lõi giữa Unit Test (Kiểm thử đơn vị) và E2E Test (Kiểm thử đầu cuối) trong NestJS là gì?',
        options: [
          'Unit test cô lập và test duy nhất 1 class/hàm bằng Mock (không cần DB). E2E khởi động toàn bộ app, gọi vào HTTP API, tương tác thực tế với Database để test trọn vẹn luồng',
          'Unit Test dùng Jest, E2E không dùng Jest',
          'Unit test để tìm lỗi giao diện, E2E để tìm lỗi backend',
          'Unit test luôn chạy chậm hơn E2E'
        ],
        correctIndex: 0,
        explanation: 'Unit test cung cấp độ chi tiết, phản hồi nhanh để sửa lỗi. E2E (với Supertest) mô phỏng chính xác cách người dùng sử dụng API, đảm bảo cả hệ thống tích hợp chạy đúng.'
      },
      {
        id: 's5-q12',
        question: 'Chỉ số "Test Coverage" trong quá trình kiểm thử phần mềm đo lường điều gì?',
        options: [
          'Tỉ lệ phần trăm các dòng code (Lines), nhánh (Branches) và hàm (Functions) trong source code đã thực sự được thực thi ít nhất một lần khi chạy test',
          'Đo lường số lượng user truy cập app',
          'Tính toán số thời gian để chạy xong bộ test',
          'Kiểm tra độ bảo mật của cơ sở dữ liệu'
        ],
        correctIndex: 0,
        explanation: 'Test Coverage là metric quan trọng giúp đội ngũ Dev biết còn góc khuất code nào (các mệnh đề if/else ít gặp, catch error) chưa được viết test bảo vệ.'
      },
      {
        id: 's5-q13',
        question: 'Tại sao việc ghi chép nhật ký hành động (Audit Log) thường được thiết kế theo cơ chế Event-Driven (Phát sự kiện bất đồng bộ)?',
        options: [
          'Để tách rời logic ghi log ra khỏi luồng xử lý chính. API trả kết quả ngay cho người dùng mà không cần đợi thao tác Insert DB log, đảm bảo tính Non-blocking nhanh nhẹn',
          'Vì Audit Log là dữ liệu rác, không quan trọng',
          'Vì NestJS bắt buộc dùng EventEmitter cho log',
          'Để giảm chi phí lưu trữ'
        ],
        correctIndex: 0,
        explanation: 'Event-driven architecture (như @nestjs/event-emitter) giúp decouple hệ thống. Tác vụ phụ trợ như log/notify sẽ chạy ngầm sau khi request chính kết thúc.'
      },
      {
        id: 's5-q14',
        question: 'Mục đích của việc sử dụng công cụ Husky cấu hình "pre-push" trong luồng CI/CD là gì?',
        options: [
          'Tự động chạy linter, format hoặc unit tests tại máy tính cục bộ trước khi cho phép đẩy code lên Git server, ngăn chặn các lỗi ngớ ngẩn lọt vào remote repo',
          'Tự động deploy code lên server Production',
          'Tự động nén database thành file zip',
          'Sinh ra báo cáo Excel'
        ],
        correctIndex: 0,
        explanation: 'Pre-push/pre-commit hooks tạo ra "Quality Gate" vòng ngoài cùng, giảm thiểu thời gian chạy CI trên server và giữ cho git tree luôn sạch đẹp.'
      },
      {
        id: 's5-q15',
        question: 'Trong thư viện Jest, hàm `jest.spyOn()` được dùng phổ biến để làm gì?',
        options: [
          'Theo dõi âm thầm một phương thức của Object để đếm số lần nó được gọi, hoặc tạm thời thay đổi hành vi (mockImplementation) trả về kết quả giả (mock) trong môi trường test',
          'Quét virus source code',
          'Giám sát hành vi của Hacker trên website',
          'Theo dõi CPU và RAM của Node.js'
        ],
        correctIndex: 0,
        explanation: 'spyOn() vô cùng quyền lực khi viết Unit Test. Nó cho phép chặn đứng các side effects (như gọi DB, gọi API) và verify (expect) rằng chúng đã được gọi đúng thông số hay chưa.'
      }
    ],
    codeChallenge: {
      title: 'Lab Thực Hành Sprint 5: Comprehensive Audit Dispatcher',
      description: 'Viết hàm `dispatchAuditEvent(logServiceMock, event)`: gọi `await logServiceMock.log({ ...event, timestamp: Date.now() })`. Trả về `{ success: true, loggedEvent: event }`.',
      starterCode: `async function dispatchAuditEvent(logServiceMock, event) {
  // Viết logic dispatch audit
  
}`,
      solution: `async function dispatchAuditEvent(logServiceMock, event) {
  await logServiceMock.log({ ...event, timestamp: Date.now() });
  return { success: true, loggedEvent: event };
}`,
      testCases: [
        {
          name: 'Case 1 (Visible): Ghi audit thành công',
          input: [
            { log: async () => ({ success: true }) },
            { action: 'UPDATE', userId: 'u1', unitId: 'unit-10' }
          ],
          expected: { success: true, loggedEvent: { action: 'UPDATE', userId: 'u1', unitId: 'unit-10' } },
          hidden: false
        },
        {
          name: 'Case 2 (Hidden): Trả về fail từ logger mock',
          input: [{ log: async () => ({ success: false }) }, { action: "DELETE", userId: "u2", unitId: "unit-11" }],
          expected: { success: true, loggedEvent: { action: "DELETE", userId: "u2", unitId: "unit-11" } },
          hidden: true
        },
        {
          name: 'Case 3 (Hidden): Logger mock throws error',
          input: [{ log: async () => { throw new Error("LOGGER_DOWN"); } }, { action: "CREATE" }],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Case 4 (Hidden): Missing event',
          input: [{ log: async () => true }, null],
          expected: { success: true, loggedEvent: null },
          hidden: true
        }
      ]
    }
  }
];
