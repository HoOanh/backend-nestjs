import type { QuizQuestion, CodeChallenge } from './curriculum.ts';

export interface SprintExam {
  sprintId: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questionCountToPick: number; // Số lượng câu bốc ngẫu nhiên mỗi lần thi (VD: 10 câu từ pool 20 câu)
  questions: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export const SPRINT_EXAMS: SprintExam[] = [
  // =========================================================================
  // SPRINT 0: CẦU NỐI REACT/NEXT.JS -> BACKEND MENTAL MODEL
  // =========================================================================
  {
    sprintId: 0,
    title: 'Bài Kiểm Tra Sprint 0: Cầu Nối React/Next.js → Backend Mental Model',
    description: 'Đánh giá chuyển đổi tư duy: Long-running Process, Concurrency, Event Loop, Non-blocking I/O, Race Condition và Giao thức HTTP RFC.',
    timeLimitMinutes: 25,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's0-q1',
        question: 'Tại sao việc lưu trữ state của người dùng vào biến thuộc tính của NestJS Service (mặc định Singleton) là một lỗi bảo mật & logic nghiêm trọng?',
        options: [
          'Vì biến Singleton được chia sẻ cho mọi request, dữ liệu người sau sẽ ghi đè và làm lộ thông tin sang người trước.',
          'Vì TypeScript compiler sẽ chặn quá trình build nếu phát hiện biến state nằm trong class có gắn decorator @Injectable.',
          'Vì Node.js V8 Engine sẽ tự động giải phóng bộ nhớ (garbage collect) của biến này sau khi hoàn tất HTTP request đầu tiên.',
          'Vì mỗi request trong Node.js đều chạy trong một process riêng biệt nên biến đó sẽ luôn bị undefined ở request tiếp theo.'
        ],
        correctIndex: 0,
        explanation: 'NestJS Provider mặc định là Singleton (1 instance duy nhất trong RAM). Nếu lưu state người dùng vào thuộc tính class (this.currentUser), hàng nghìn request đồng thời sẽ đọc/ghi đè lên nhau gây Race Condition và rò rỉ dữ liệu chéo giữa các tài khoản.'
      },
      {
        id: 's0-q2',
        question: 'Để không làm nghẽn (block) Node.js Event Loop, các tác vụ I/O nặng (Database query, gọi Third-party HTTP API) phải được viết như thế nào?',
        options: [
          'Dùng hàm đồng bộ fs.readFileSync và vòng lặp while để đợi kết quả trả về trước khi xử lý tiếp.',
          'Dùng cơ chế bất đồng bộ Non-blocking I/O với async/await hoặc Promise để trả thread cho Event Loop.',
          'Chạy các tác vụ tính toán đó bên trong khối try/catch đồng bộ để bắt ngoại lệ trước khi luồng bị block.',
          'Gọi trực tiếp hàm setTimeout() với thời gian 0ms để chuyển hoàn toàn tác vụ sang Web Worker trình duyệt.'
        ],
        correctIndex: 1,
        explanation: 'Node.js chạy Main Thread đơn luồng. Khi thực hiện I/O bất đồng bộ (Non-blocking I/O với async/await), libuv sẽ ủy thác tác vụ cho hệ điều hành/thread pool và giải phóng Event Loop để tiếp tục nhận request từ các client khác.'
      },
      {
        id: 's0-q3',
        question: 'Khi client gửi request có Payload vi phạm quy tắc validation (thiếu trường bắt buộc hoặc sai định dạng email), server NestJS nên trả về status code nào?',
        options: [
          '400 Bad Request kèm chi tiết danh sách các trường dữ liệu không hợp lệ.',
          '422 Unprocessable Entity nhưng bắt buộc phải trả về body trống theo chuẩn REST.',
          '500 Internal Server Error để báo hiệu backend gặp sự cố trong quá trình parse JSON.',
          '200 OK kèm cờ { success: false, message: "Validation failed" } trong JSON payload.'
        ],
        correctIndex: 0,
        explanation: 'HTTP 400 Bad Request là mã chuẩn RFC chỉ định client đã gửi request sai cú pháp hoặc dữ liệu không thỏa mãn validation (ValidationPipe). Không bao giờ trả 200 OK cho request lỗi hoặc 500 cho lỗi phía người dùng.'
      },
      {
        id: 's0-q4',
        question: 'Tại sao Refresh Token nên được lưu trữ trong HttpOnly Cookie thay vì Web Storage (localStorage/sessionStorage)?',
        options: [
          'Vì HttpOnly Cookie có dung lượng lưu trữ tối đa lên đến 50MB, lớn hơn nhiều so với 5MB của localStorage.',
          'Vì JavaScript trên trình duyệt không thể đọc được HttpOnly Cookie, giúp ngăn ngừa việc đánh cắp token khi dính XSS.',
          'Vì HttpOnly Cookie tự động mã hóa toàn bộ payload bằng thuật toán RSA trước khi gửi qua đường truyền mạng.',
          'Vì localStorage chỉ hoạt động trên giao thức HTTP thường, còn HttpOnly Cookie bắt buộc phải có chứng chỉ HTTPS.'
        ],
        correctIndex: 1,
        explanation: 'Cờ HttpOnly ngăn chặn mã JavaScript độc hại (XSS) truy cập vào cookie thông qua document.cookie, hạn chế nguy cơ bị đánh cắp token phiên làm việc (Token Exfiltration).'
      },
      {
        id: 's0-q5',
        question: 'Nếu bảng patients có 1.000.000 bản ghi, việc viết câu lệnh `await prisma.patient.findMany()` không có phân trang sẽ dẫn tới hậu quả gì?',
        options: [
          'Prisma sẽ tự động giới hạn 100 bản ghi mặc định nên không có nguy cơ gì đối với hệ thống.',
          'Node.js sẽ nạp toàn bộ 1 triệu bản ghi vào RAM, gây tràn bộ nhớ (Out Of Memory) và sập server.',
          'Database PostgreSQL sẽ từ chối truy vấn và tự động chuyển sang chế độ Read-Only tạm thời.',
          'Client sẽ nhận dữ liệu theo dạng Stream từng phần mà không tốn dung lượng RAM của backend.'
        ],
        correctIndex: 1,
        explanation: 'findMany() không có take/skip sẽ ép Database serialize toàn bộ 1 triệu record và nạp vào Heap Memory của Node.js, nhanh chóng vượt ngưỡng giới hạn RAM (mặc định ~1.4GB - 2GB) dẫn đến OOM Crash.'
      },
      {
        id: 's0-q6',
        question: 'Tại sao việc dùng `setInterval` trực tiếp trong NestJS Service để chạy tác vụ định kỳ lại là anti-pattern trên môi trường Production chạy nhiều bản sao (Multi-instance)?',
        options: [
          'Vì mỗi instance sẽ chạy bộ đếm riêng độc lập, dẫn đến tác vụ bị thực thi trùng lặp nhiều lần cùng thời điểm.',
          'Vì hàm setInterval của JavaScript sẽ bị dừng hoàn toàn ngay khi có một HTTP request gửi tới server.',
          'Vì Node.js Event Loop không cho phép chạy timer quá 60 giây trên môi trường container Docker.',
          'Vì NestJS cấm sử dụng các hàm built-in của Node.js bên trong các class có gắn decorator @Injectable.'
        ],
        correctIndex: 0,
        explanation: 'Khi ứng dụng được scale horizontal (nhiều container/pod), mỗi instance sẽ kích hoạt setInterval riêng, dẫn đến gửi trùng email hoặc trừ tiền trùng lặp nếu không có cơ chế Distributed Lock (Redis/BullMQ).'
      },
      {
        id: 's0-q7',
        question: 'Khi backend cần gửi thông báo qua 3 kênh độc lập (Email, SMS, Web Push) không phụ thuộc dữ liệu vào nhau, cách viết nào tối ưu thời gian phản hồi nhất?',
        options: [
          'Chạy tuần tự từng hàm: `await sendEmail(); await sendSms(); await sendPush();`',
          'Chạy song song bằng `await Promise.all([sendEmail(), sendSms(), sendPush()]);`',
          'Bỏ toàn bộ từ khóa `await` để các promise tự chạy ngầm mà không cần bắt lỗi.',
          'Tạo 3 endpoint API riêng biệt trên backend và bắt phía client React gọi lần lượt 3 lần.'
        ],
        correctIndex: 1,
        explanation: 'Promise.all kích hoạt đồng thời cả 3 I/O request ra mạng, tổng thời gian phản hồi chỉ bằng thời gian của tác vụ lâu nhất (Max(T1, T2, T3)) thay vì tổng thời gian (T1 + T2 + T3).'
      },
      {
        id: 's0-q8',
        question: 'Sự khác biệt cốt lõi giữa kiến trúc Stateless Server và Stateful Server là gì?',
        options: [
          'Stateless server không lưu phiên người dùng trong RAM server, mọi request đều mang đủ thông tin xác thực (JWT/Session ID).',
          'Stateless server không được phép kết nối với Database bên ngoài, chỉ xử lý dữ liệu tính toán thuần túy.',
          'Stateful server xử lý nhanh hơn vì không cần kiểm tra quyền của người dùng ở mỗi request HTTP gửi lên.',
          'Stateless server yêu cầu client phải duy trì kết nối WebSocket liên tục 24/7 để không bị mất kết nối.'
        ],
        correctIndex: 0,
        explanation: 'Stateless backend không lưu trạng thái phiên trong bộ nhớ cục bộ của server, cho phép cân bằng tải (Load Balancer) định tuyến request bất kỳ đến bất kỳ server instance nào mà không sợ mất phiên.'
      },
      {
        id: 's0-q9',
        question: 'Header HTTP `Idempotency-Key` được sử dụng nhằm mục đích chính nào trong các giao dịch thanh toán hoặc tạo đơn hàng?',
        options: [
          'Mã hóa nội dung của request body để bên thứ ba không thể đọc trộm trên đường truyền Internet.',
          'Xác thực quyền Admin của người gửi request thay thế cho token Bearer Authorization truyền thống.',
          'Đảm bảo nếu client gửi lại request do rớt mạng, server chỉ thực thi thanh toán đúng 1 lần duy nhất.',
          'Tăng tốc độ nén dữ liệu gzip của gói tin HTTP gửi từ frontend lên server backend.'
        ],
        correctIndex: 2,
        explanation: 'Idempotency Key là định danh duy nhất cho một ý định giao dịch. Nếu client bị timeout mạng và gửi lại request cùng key đó, server nhận diện và trả về kết quả đã xử lý trước đó thay vì thực hiện trừ tiền lần 2.'
      },
      {
        id: 's0-q10',
        question: 'Trong giao thức HTTP/1.1, hiện tượng "Head-of-Line Blocking" xảy ra ở tầng ứng dụng khi nào?',
        options: [
          'Khi nhiều request gửi trên cùng 1 kết nối TCP phải chờ request phía trước xử lý xong mới đến lượt.',
          'Khi dung lượng của phần Header HTTP vượt quá giới hạn 8KB của web server Nginx.',
          'Khi cơ sở dữ liệu bị deadlock do hai transaction cùng cập nhật một dòng dữ liệu.',
          'Khi trình duyệt từ chối render HTML vì chưa tải xong file JavaScript chặn luồng (blocking script).'
        ],
        correctIndex: 0,
        explanation: 'HTTP/1.1 pipelining yêu cầu các response phải được trả về theo đúng thứ tự của request trên kết nối TCP. Nếu request đầu tiên xử lý lâu, tất cả request phía sau đều bị block.'
      },
      {
        id: 's0-q11',
        question: 'Mã HTTP Status Code 429 Too Many Requests thường được backend trả về trong tình huống nào?',
        options: [
          'Khi tài khoản của người dùng đã bị khóa vĩnh viễn do vi phạm điều khoản dịch vụ.',
          'Khi client gửi số lượng request vượt quá hạn mức Rate Limit cho phép trong một khoảng thời gian.',
          'Khi file tải lên server có kích thước vượt quá giới hạn cấu hình trong multer middleware.',
          'Khi client cố gắng truy cập vào một route API đã bị xóa khỏi hệ thống backend.'
        ],
        correctIndex: 1,
        explanation: '429 Too Many Requests được dùng cho cơ chế Rate Limiting / Throttling để bảo vệ server khỏi bị tấn công DoS hoặc spam request liên tục từ một IP/User.'
      },
      {
        id: 's0-q12',
        question: 'Cơ chế Connection Pooling trong kết nối Database (PostgreSQL/MySQL) giải quyết vấn đề gì?',
        options: [
          'Tự động sao lưu dữ liệu sang máy chủ dự phòng mỗi khi có truy vấn ghi mới phát sinh.',
          'Tái sử dụng các kết nối TCP có sẵn tới DB, tránh chi phí tốn kém khi phải tạo mới kết nối ở mỗi request.',
          'Chuyển đổi các câu lệnh SQL thô thành các hàm JavaScript an toàn không bị dính SQL Injection.',
          'Nén toàn bộ bảng dữ liệu vào bộ nhớ đệm Redis để tăng tốc độ truy vấn tìm kiếm.'
        ],
        correctIndex: 1,
        explanation: 'Tạo mới một kết nối TCP + TLS + Authentication tới Database tốn nhiều mili-giây và tài nguyên. Connection Pool duy trì sẵn một nhóm kết nối để các request dùng chung và trả lại sau khi query xong.'
      },
      {
        id: 's0-q13',
        question: 'Tại sao việc đặt mật khẩu hoặc Secret Key cứng (hardcoded) trong mã nguồn Git là sai lầm nguy hiểm?',
        options: [
          'Vì TypeScript compiler sẽ từ chối đóng gói mã nguồn nếu chuỗi có chứa các ký tự đặc biệt.',
          'Vì lịch sử commit của Git lưu vĩnh viễn chuỗi đó, bất kỳ ai có quyền truy cập repo đều có thể đọc được.',
          'Vì Node.js không cho phép đọc biến chuỗi dài quá 32 ký tự nếu không khai báo qua file .env.',
          'Vì hệ thống CI/CD sẽ tự động đổi toàn bộ mật khẩu đó thành chuỗi ngẫu nhiên khi deploy lên server.'
        ],
        correctIndex: 1,
        explanation: 'Secret hardcoded trong code sẽ lưu vào Git history. Kể cả khi commit sau xóa đi, kẻ xấu vẫn có thể xem lại commit cũ để lấy key. Secret bắt buộc phải nạp qua Environment Variables (.env).'
      },
      {
        id: 's0-q14',
        question: 'Khi xử lý một tác vụ tiêu tốn nhiều CPU (CPU-bound task như mã hóa video, băm mật khẩu 1 triệu vòng), cách giải quyết chuẩn trong Node.js là gì?',
        options: [
          'Chạy trực tiếp trên Main Thread vì Node.js có tốc độ xử lý số học tương đương ngôn ngữ C++.',
          'Đẩy tác vụ sang Worker Thread (worker_threads) hoặc tiến trình con (Child Process) để không block Event Loop.',
          'Bọc hàm tính toán đó vào một Promise bất đồng bộ với từ khóa async/await trên Main Thread.',
          'Tăng dung lượng RAM của máy chủ lên gấp đôi để CPU xử lý nhanh hơn trên luồng chính.'
        ],
        correctIndex: 1,
        explanation: 'Async/await chỉ hữu ích cho I/O-bound tasks. Đối với CPU-bound tasks, việc tính toán liên tục trên Main Thread sẽ làm treo Event Loop. Cần dùng Worker Threads hoặc Microservice riêng.'
      },
      {
        id: 's0-q15',
        question: 'Header `Content-Type: application/json` trong HTTP Request mang ý nghĩa gì đối với backend NestJS?',
        options: [
          'Yêu cầu backend phải trả về kết quả dưới dạng file đính kèm để trình duyệt tự động tải về máy.',
          'Thông báo cho body-parser middleware biết payload gửi lên là chuỗi JSON để parse thành JavaScript Object.',
          'Kích hoạt tính năng tự động mã hóa AES-256 hai chiều giữa trình duyệt frontend và server backend.',
          'Xác nhận client đã đăng nhập thành công và có quyền gửi dữ liệu dạng cấu trúc bảng.'
        ],
        correctIndex: 1,
        explanation: 'Content-Type thông báo MIME type của body. Khi có application/json, middleware (như express.json()) sẽ parse chuỗi text thành Object gán vào req.body.'
      },
      {
        id: 's0-q16',
        question: 'Khái niệm "Graceful Shutdown" trong ứng dụng backend NestJS Production có ý nghĩa gì?',
        options: [
          'Tự động khởi động lại ứng dụng ngay lập tức mỗi khi có một ngoại lệ runtime chưa được bắt (unhandled).',
          'Dừng nhận request mới, hoàn tất các request đang dở dang và đóng an toàn kết nối DB/Queue trước khi tiến trình tắt.',
          'Xóa toàn bộ dữ liệu tạm trong thư mục /tmp và giải phóng bộ nhớ đệm Redis khi máy chủ tắt nguồn.',
          'Gửi email thông báo cho toàn bộ người dùng đang online biết hệ thống chuẩn bị bảo trì trong 5 phút.'
        ],
        correctIndex: 1,
        explanation: 'Graceful Shutdown lắng nghe tín hiệu SIGTERM/SIGINT, ngừng nhận kết nối mới, đợi các request/job đang xử lý hoàn thành và ngắt kết nối DB an toàn để không làm hỏng dữ liệu (data corruption).'
      },
      {
        id: 's0-q17',
        question: 'Sự khác biệt giữa HTTP PUT và HTTP PATCH theo chuẩn thiết kế RESTful API là gì?',
        options: [
          'PUT dùng để thay thế toàn bộ tài nguyên (full replace), còn PATCH dùng để cập nhật một phần tài nguyên (partial update).',
          'PUT chỉ dùng cho các thao tác tạo mới dữ liệu, còn PATCH dùng cho các thao tác chỉnh sửa dữ liệu đã có.',
          'PUT không có tính chất Idempotent (gọi nhiều lần sinh kết quả khác nhau), còn PATCH luôn có tính chất Idempotent.',
          'PUT bắt buộc phải gửi dữ liệu qua Query Params, còn PATCH bắt buộc phải gửi dữ liệu qua Request Body.'
        ],
        correctIndex: 0,
        explanation: 'PUT thay thế toàn bộ record (nếu trường nào không gửi sẽ bị set null/default), còn PATCH chỉ cập nhật những trường được gửi lên trong payload.'
      },
      {
        id: 's0-q18',
        question: 'Cơ chế CORS (Cross-Origin Resource Sharing) được thực thi và kiểm tra ở đâu?',
        options: [
          'Do Database PostgreSQL thực thi khi nhận câu lệnh query từ một địa chỉ IP lạ.',
          'Do Trình duyệt (Browser) thực thi để bảo vệ người dùng khỏi các script độc hại gọi chéo origin.',
          'Do Router mạng của nhà mạng Internet tự động lọc gói tin HTTP trước khi tới server.',
          'Do Hệ điều hành của máy chủ server chặn đứng kết nối TCP ở tầng Socket mạng.'
        ],
        correctIndex: 1,
        explanation: 'CORS là cơ chế bảo mật do trình duyệt ép buộc. Trình duyệt gửi Preflight request (OPTIONS) để hỏi server xem có cho phép origin hiện tại truy cập tài nguyên hay không.'
      },
      {
        id: 's0-q19',
        question: 'Tại sao việc sử dụng thuật toán mã hóa đối xứng (Symmetric) hoặc hàm băm nhanh (như MD5/SHA1) để lưu mật khẩu người dùng là không an toàn?',
        options: [
          'Vì các thuật toán này có tốc độ tính toán quá nhanh, tạo điều kiện cho hacker tấn công Brute-force/Rainbow Table.',
          'Vì Node.js không hỗ trợ thư viện crypto để giải mã các chuỗi hash dạng MD5 hoặc SHA1.',
          'Vì chiều dài chuỗi sau khi băm bằng MD5 vượt quá giới hạn số ký tự của kiểu dữ liệu VARCHAR trong SQL.',
          'Vì trình duyệt frontend sẽ tự động giải mã được chuỗi hash này khi nhận qua giao thức HTTPS.'
        ],
        correctIndex: 0,
        explanation: 'Mật khẩu bắt buộc phải dùng thuật toán băm chậm có Salt và Work Factor (như bcrypt, argon2, pbkdf2) để ngăn chặn kẻ tấn công dùng GPU tính hàng tỷ phép thử mỗi giây.'
      },
      {
        id: 's0-q20',
        question: 'Trong kiến trúc Microservices, "Dead Letter Queue" (DLQ) được sử dụng để làm gì?',
        options: [
          'Lưu trữ các message bị lỗi sau khi đã thử lại (retry) hết số lần cấu hình, phục vụ việc điều tra và xử lý sự cố.',
          'Tăng tốc độ truyền tải các gói tin khẩn cấp lên đầu hàng đợi để worker ưu tiên xử lý trước.',
          'Tự động xóa vĩnh viễn toàn bộ các tin nhắn đã tồn tại trong hàng đợi quá 24 giờ mà chưa có worker nhận.',
          'Mã hóa toàn bộ nội dung của tin nhắn trước khi lưu tạm thời vào ổ đĩa cứng của message broker.'
        ],
        correctIndex: 0,
        explanation: 'Khi một job/message bị lỗi liên tục và vượt quá Max Retries, hệ thống đẩy message đó vào DLQ để không làm nghẽn hàng đợi chính, đồng thời giữ lại dữ liệu để kỹ sư debug nguyên nhân gốc rễ.'
      }
    ],
    codeChallenge: {
      id: 's0-code',
      title: 'Lab Thực Hành Sprint 0: Safe In-Memory Rate Limiter & Concurrency Guard',
      description: 'Hiện thực hàm `checkRateLimit(tracker, ip, maxRequests, windowMs)` để kiểm soát tần suất gọi API từ một địa chỉ IP. Nếu số request trong cửa sổ thời gian vượt quá `maxRequests`, trả về `{ allowed: false, remaining: 0, retryAfterMs }`. Nếu hợp lệ, ghi nhận timestamp và trả về `{ allowed: true, remaining }`.',
      starterCode: `function checkRateLimit(tracker, ip, maxRequests, windowMs) {
  // TODO: Hiện thực thuật toán sliding window rate limiting
  // tracker: Object lưu state { [ip]: number[] (mảng timestamps) }
  // 1. Lọc bỏ các timestamp cũ đã nằm ngoài windowMs (now - t < windowMs)
  // 2. Nếu số request >= maxRequests: trả về { allowed: false, remaining: 0, retryAfterMs }
  // 3. Nếu được phép: thêm timestamp hiện tại và trả về { allowed: true, remaining }

}`,
      testCases: [
        {
          input: [{}, '1.2.3.4', 2, 60000],
          expected: { allowed: true, remaining: 1 },
          description: 'Lần gọi đầu tiên từ IP mới phải được phép và còn 1 lượt'
        },
        {
          input: [{ '1.2.3.4': [Date.now() - 1000] }, '1.2.3.4', 2, 60000],
          expected: { allowed: true, remaining: 0 },
          description: 'Lần gọi thứ hai đạt mức tối đa và còn 0 lượt'
        },
        {
          input: [{ '1.2.3.4': [Date.now() - 2000, Date.now() - 1000] }, '1.2.3.4', 2, 60000],
          expected: { allowed: false, remaining: 0 },
          description: 'Lần gọi thứ ba vượt quá giới hạn và bị từ chối'
        },
        {
          input: [{ '1.2.3.4': [Date.now() - 70000] }, '1.2.3.4', 2, 60000],
          expected: { allowed: true, remaining: 1 },
          description: 'Timestamp cũ ngoài cửa sổ 60s phải được dọn dẹp và cấp phép lại'
        }
      ]
    }
  },

  // =========================================================================
  // SPRINT 1: CORE ARCHITECTURE & DEPENDENCY INJECTION
  // =========================================================================
  {
    sprintId: 1,
    title: 'Bài Kiểm Tra Sprint 1: NestJS Core Architecture & Dependency Injection',
    description: 'Kiểm tra năng lực: IoC Container, Custom Providers (useClass, useValue, useFactory), Lifecycle Hooks và Request Scopes.',
    timeLimitMinutes: 25,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's1-q1',
        question: 'Trong NestJS, mục đích chính của Dependency Injection (DI) và Inversion of Control (IoC) là gì?',
        options: [
          'Tách rời việc khởi tạo đối tượng khỏi nơi sử dụng, giúp code lỏng lẻo (loose coupling) và dễ viết Unit Test.',
          'Tự động biên dịch mã nguồn TypeScript sang WebAssembly để tăng tốc độ xử lý các phép toán phức tạp.',
          'Tự động tạo các bảng cơ sở dữ liệu tương ứng với các class được khai báo trong thư mục entities.',
          'Chuyển đổi toàn bộ các hàm bất đồng bộ trong service thành các hàm chạy song song trên nhiều CPU Core.'
        ],
        correctIndex: 0,
        explanation: 'DI cho phép IoC Container quản lý vòng đời và tự động inject các dependencies vào constructor, giúp code không bị phụ thuộc cứng vào việc `new Class()` và dễ dàng mock khi viết Unit Test.'
      },
      {
        id: 's1-q2',
        question: 'Khi khai báo một Provider với `@Injectable({ scope: Scope.REQUEST })`, điều gì sẽ xảy ra ở tầng vận hành của ứng dụng?',
        options: [
          'Provider đó sẽ được tạo mới ở mỗi HTTP request gửi tới, làm tăng chi phí tạo object và giảm hiệu năng ứng dụng.',
          'Provider đó sẽ tồn tại vĩnh viễn trong RAM từ khi server khởi động cho đến khi tiến trình tắt hoàn toàn.',
          'Mỗi Module trong ứng dụng sẽ dùng chung 1 instance duy nhất của Provider đó để tiết kiệm tài nguyên.',
          'NestJS sẽ tự động lưu kết quả trả về của tất cả các hàm trong Provider đó vào bộ nhớ đệm Redis.'
        ],
        correctIndex: 0,
        explanation: 'Scope.REQUEST tạo một instance mới cho mỗi request và lan truyền (bubble up) lên toàn bộ chuỗi dependency phụ thuộc nó, gây tốn bộ nhớ và giảm thông lượng (throughput) so với Singleton mặc định.'
      },
      {
        id: 's1-q3',
        question: 'Khi cần inject một cấu hình động từ môi trường hoặc một thư viện bên ngoài chưa có decorator NestJS, loại Custom Provider nào là phù hợp nhất?',
        options: [
          'Dùng `useFactory` kết hợp với mảng `inject` để lấy các dependencies cấu hình cần thiết.',
          'Dùng `useClass` để ép kiểu đối tượng bên ngoài thành một class có sẵn trong mã nguồn.',
          'Tạo một biến toàn cục `global.config` bên trong file main.ts và import trực tiếp vào service.',
          'Sử dụng decorator `@Global()` bên trên hàm constructor của Service để tự động nạp cấu hình.'
        ],
        correctIndex: 0,
        explanation: 'useFactory cho phép tạo provider động thông qua hàm factory, có thể nhận các provider khác qua thuộc tính `inject` và hỗ trợ trả về Promise bất đồng bộ (Async Provider).'
      },
      {
        id: 's1-q4',
        question: 'Để giải quyết lỗi phụ thuộc vòng (Circular Dependency) giữa ServiceA và ServiceB trong NestJS, kỹ thuật chuẩn nào được áp dụng?',
        options: [
          'Sử dụng hàm helper `forwardRef(() => ServiceName)` kết hợp với decorator `@Inject(forwardRef(...))`.',
          'Chuyển cả hai Service sang Scope.TRANSIENT để NestJS không kiểm tra cây phụ thuộc khi khởi động.',
          'Gộp hai Service vào làm một class duy nhất và xóa bỏ một trong hai Module khỏi ứng dụng.',
          'Khai báo một trong hai Service là `@Global()` để NestJS tự động bỏ qua kiểm tra phụ thuộc vòng.'
        ],
        correctIndex: 0,
        explanation: 'forwardRef cho phép NestJS trì hoãn việc resolve tham chiếu của class cho đến khi cả hai module/service đều đã được tải xong vào IoC Container.'
      },
      {
        id: 's1-q5',
        question: 'Lifecycle hook nào trong NestJS được gọi ngay sau khi toàn bộ dependencies của module đã được resolve và kết nối sẵn sàng?',
        options: [
          '`onModuleInit()` hoặc `onApplicationBootstrap()` để khởi tạo dữ liệu ban đầu hoặc kết nối socket.',
          '`beforeApplicationShutdown()` để dọn dẹp các kết nối đang mở trước khi server tắt.',
          '`constructor()` của Module class để định nghĩa các route API mới cho ứng dụng.',
          '`onModuleDestroy()` để xóa các bản ghi tạm thời trong cơ sở dữ liệu khi restart.'
        ],
        correctIndex: 0,
        explanation: 'onModuleInit() được kích hoạt ngay khi các dependencies của module đó được khởi tạo xong; onApplicationBootstrap() được gọi sau khi toàn bộ ứng dụng đã bootstrap hoàn tất.'
      },
      {
        id: 's1-q6',
        question: 'Trong NestJS, decorator `@Global()` đặt trước một Module mang lại tác dụng gì và cần lưu ý điều gì khi sử dụng?',
        options: [
          'Biến các provider được export của module thành dùng chung toàn app, nhưng lạm dụng sẽ phá vỡ tính đóng gói (encapsulation).',
          'Tự động xuất khẩu toàn bộ database schema sang OpenAPI Swagger mà không cần cấu hình thêm.',
          'Cho phép client gọi thẳng tới các service bên trong module mà không cần thông qua Controller.',
          'Tự động tăng gấp đôi số lượng worker threads dành riêng cho các tác vụ bên trong module đó.'
        ],
        correctIndex: 0,
        explanation: '@Global() làm cho các provider trong module có sẵn ở khắp mọi nơi mà không cần import module ở các module khác. Chỉ nên dùng cho core modules (như DatabaseModule, ConfigModule) để tránh biến mã nguồn thành spaghetti.'
      },
      {
        id: 's1-q7',
        question: 'Khi muốn mock một DatabaseService trong Unit Test bằng một object giả lập, cú pháp Custom Provider nào trong Test.createTestingModule là chuẩn xác?',
        options: [
          '`{ provide: DatabaseService, useValue: mockDatabaseService }`',
          '`{ provide: DatabaseService, useClass: DatabaseService }`',
          '`{ provide: "MOCK_DB", useExisting: DatabaseService }`',
          '`{ provide: DatabaseService, useFactory: () => DatabaseService }`'
        ],
        correctIndex: 0,
        explanation: 'useValue cung cấp trực tiếp một instance cụ thể (object mock với các hàm jest.fn()) để thay thế cho token của DatabaseService gốc trong IoC Container.'
      },
      {
        id: 's1-q8',
        question: 'Nếu Module A export ServiceA, Module B muốn sử dụng ServiceA thì Module B bắt buộc phải làm gì?',
        options: [
          'Khai báo `imports: [ModuleA]` bên trong decorator `@Module` của Module B.',
          'Khai báo lại `providers: [ServiceA]` bên trong decorator `@Module` của Module B.',
          'Khai báo `exports: [ServiceA]` bên trong decorator `@Module` của Module B.',
          'Gọi trực tiếp `new ServiceA()` bên trong constructor của ServiceB.'
        ],
        correctIndex: 0,
        explanation: 'Để dùng provider từ module khác, Module A phải export provider đó, và Module B phải import Module A. Khai báo lại ServiceA trong providers của Module B sẽ tạo một instance độc lập thứ hai, làm hỏng tính Singleton.'
      },
      {
        id: 's1-q9',
        question: 'Sự khác biệt giữa `Scope.DEFAULT` (Singleton) và `Scope.TRANSIENT` trong NestJS là gì?',
        options: [
          'DEFAULT chia sẻ 1 instance toàn app, còn TRANSIENT tạo 1 instance mới cho mỗi class inject nó.',
          'DEFAULT tạo instance mới ở mỗi HTTP request, còn TRANSIENT tồn tại vĩnh viễn trong RAM.',
          'DEFAULT chỉ dùng được trong Controller, còn TRANSIENT chỉ dùng được trong Service và Repository.',
          'DEFAULT tự động mã hóa dữ liệu trong RAM, còn TRANSIENT lưu dữ liệu thô không mã hóa.'
        ],
        correctIndex: 0,
        explanation: 'Scope.DEFAULT chia sẻ 1 instance duy nhất trên toàn ứng dụng. Scope.TRANSIENT tạo một instance chuyên dụng riêng biệt cho mỗi consumer (class) inject provider đó.'
      },
      {
        id: 's1-q10',
        question: 'Cơ chế Dynamic Module trong NestJS (như `ConfigModule.forRoot({ isGlobal: true })`) thường được sử dụng khi nào?',
        options: [
          'Khi module cần nhận các tham số cấu hình tùy biến từ bên ngoài trước khi cung cấp các provider.',
          'Khi module chỉ được phép tải vào RAM sau khi có request HTTP đầu tiên của người dùng gửi tới.',
          'Khi module cần tự động xóa bỏ mã nguồn của chính nó sau khi hoàn tất quá trình khởi động.',
          'Khi muốn thay thế hoàn toàn giao thức HTTP bằng giao thức truyền tin nhị phân TCP thô.'
        ],
        correctIndex: 0,
        explanation: 'Dynamic Module cung cấp các phương thức tĩnh (forRoot, forFeature, register) để truyền cấu hình (options) vào module và sinh ra đối tượng module definition động theo nhu cầu.'
      },
      {
        id: 's1-q11',
        question: 'Decorator `@Optional()` đặt trước một dependency trong constructor của Service có ý nghĩa gì?',
        options: [
          'Nếu IoC Container không tìm thấy provider tương ứng, nó sẽ gán giá trị undefined thay vì ném lỗi crash app.',
          'Cho phép người dùng truyền giá trị null vào hàm API mà không bị chặn bởi ValidationPipe.',
          'Đánh dấu tham số đó không bắt buộc phải nhập khi sinh tài liệu Swagger OpenAPI.',
          'Tự động gán một instance rỗng với tất cả các phương thức trả về Promise.resolve().'
        ],
        correctIndex: 0,
        explanation: '@Optional() thông báo cho NestJS IoC Container rằng dependency này là tùy chọn. Nếu không tìm thấy provider đã đăng ký, container sẽ inject undefined mà không làm dừng quá trình bootstrap.'
      },
      {
        id: 's1-q12',
        question: 'Thứ tự thực thi nào sau đây là đúng trong vòng đời khởi động (Bootstrap Lifecycle) của ứng dụng NestJS?',
        options: [
          'Constructor của Providers → onModuleInit → onApplicationBootstrap → Lắng nghe cổng HTTP (listen).',
          'Lắng nghe cổng HTTP (listen) → onApplicationBootstrap → onModuleInit → Constructor của Providers.',
          'onModuleInit → Lắng nghe cổng HTTP (listen) → Constructor của Providers → onApplicationBootstrap.',
          'onApplicationBootstrap → onModuleInit → Lắng nghe cổng HTTP (listen) → Constructor của Providers.'
        ],
        correctIndex: 0,
        explanation: 'NestJS khởi tạo các instance qua constructor trước, sau đó kích hoạt hook onModuleInit trên từng module, tiếp đến là onApplicationBootstrap trên toàn app, và cuối cùng mới mở port lắng nghe request.'
      },
      {
        id: 's1-q13',
        question: 'Khi sử dụng `useExisting` trong Custom Provider, mục đích chính là gì?',
        options: [
          'Tạo một alias (tên định danh phụ) trỏ tới một Provider đã tồn tại sẵn trong IoC Container.',
          'Ép buộc IoC Container phải tái sử dụng một instance đã bị đánh dấu hủy bỏ trước đó.',
          'Tự động sao chép toàn bộ phương thức của một class sang một class hoàn toàn mới.',
          'Kết nối tới một cơ sở dữ liệu đã có sẵn bảng dữ liệu mà không cần chạy migration.'
        ],
        correctIndex: 0,
        explanation: 'useExisting cho phép tạo bí danh (alias) cho một provider đã đăng ký, giúp truy cập cùng một instance thông qua nhiều token khác nhau.'
      },
      {
        id: 's1-q14',
        question: 'Trong NestJS, `ModuleRef` class được sử dụng cho mục đích kỹ thuật nào?',
        options: [
          'Truy xuất hoặc khởi tạo động các Provider trực tiếp từ IoC Container theo cơ chế Service Locator.',
          'Tự động kiểm tra tính hợp lệ của cú pháp decorator trước khi biên dịch bằng TypeScript.',
          'Đo lường thời gian thực thi của từng phương thức bên trong Controller để ghi log hiệu năng.',
          'Tạo ra một bản sao lưu toàn bộ bộ nhớ RAM của ứng dụng khi gặp sự cố crash.'
        ],
        correctIndex: 0,
        explanation: 'ModuleRef cho phép lập trình viên truy vấn nội bộ IoC Container bằng code để lấy instance của provider theo token (get) hoặc khởi tạo instance scoped động (resolve).'
      },
      {
        id: 's1-q15',
        question: 'Tại sao việc inject `REQUEST` object vào một Singleton Service lại biến Service đó thành Request-scoped?',
        options: [
          'Vì đối tượng REQUEST thay đổi theo từng request, nên service chứa nó bắt buộc phải tạo mới theo từng request để đảm bảo đúng dữ liệu.',
          'Vì NestJS compiler sẽ báo lỗi cú pháp nếu một Singleton Service chứa tham chiếu tới biến đối tượng.',
          'Vì giao thức HTTP bắt buộc mọi tầng xử lý dữ liệu phải bị hủy bỏ sau khi gửi xong response về client.',
          'Vì thư viện Express bên dưới không hỗ trợ việc chia sẻ context giữa các hàm xử lý bất đồng bộ.'
        ],
        correctIndex: 0,
        explanation: 'Một Singleton (sống vĩnh viễn) không thể chứa trực tiếp một đối tượng Request (chỉ sống trong vài mili-giây của 1 người dùng). NestJS buộc phải nâng scope của Service lên Request Scope để tránh race condition.'
      },
      {
        id: 's1-q16',
        question: 'Trong NestJS, file `main.ts` thường thực hiện nhiệm vụ cốt lõi nào?',
        options: [
          'Khởi tạo NestFactory để bootstrap Root Module, cấu hình Global Pipes/Interceptors và lắng nghe port.',
          'Chứa toàn bộ logic xử lý nghiệp vụ thanh toán và truy vấn cơ sở dữ liệu của ứng dụng.',
          'Định nghĩa các bảng dữ liệu Prisma Schema và thực thi các câu lệnh migration tự động.',
          'Xác thực quyền truy cập của người dùng trước khi chuyển tiếp request vào Controller.'
        ],
        correctIndex: 0,
        explanation: 'main.ts là entry point của ứng dụng, chịu trách nhiệm gọi NestFactory.create(AppModule), cài đặt middleware toàn cục (ValidationPipe, CORS, Swagger) và gọi app.listen(port).'
      },
      {
        id: 's1-q17',
        question: 'Điều gì xảy ra nếu hai Module khác nhau cùng cung cấp (provide) một Provider có cùng chuỗi Token mà không export?',
        options: [
          'Mỗi Module sẽ sở hữu một instance Singleton độc lập của Provider đó trong phạm vi nội bộ module của mình.',
          'Ứng dụng NestJS sẽ crash ngay lập tức khi bootstrap do xung đột trùng tên token định danh.',
          'NestJS sẽ tự động gộp hai Provider đó lại thành một instance duy nhất trong IoC Container.',
          'Provider của Module nào được import sau sẽ ghi đè hoàn toàn lên Provider của Module import trước.'
        ],
        correctIndex: 0,
        explanation: 'Các provider không được export sẽ có phạm vi cục bộ (encapsulated) bên trong module khai báo chúng. Hai module có thể dùng chung tên token nội bộ mà không bị xung đột.'
      },
      {
        id: 's1-q18',
        question: 'Decorator `@Inject("CUSTOM_TOKEN")` bắt buộc phải sử dụng trong trường hợp nào?',
        options: [
          'Khi Provider được đăng ký bằng một chuỗi string token (hoặc Symbol) thay vì dùng class type thông thường.',
          'Khi muốn inject một Service có phạm vi hoạt động là Request Scope vào một Controller.',
          'Khi Service được định nghĩa bên trong một file có đuôi mở rộng là `.js` thay vì `.ts`.',
          'Khi muốn tắt bỏ tính năng kiểm tra kiểu dữ liệu tĩnh của TypeScript trong constructor.'
        ],
        correctIndex: 0,
        explanation: 'Khi inject bằng Class Type, TypeScript metadata tự động cung cấp token. Nhưng khi dùng string hoặc Symbol token (như useValue/useFactory), bắt buộc phải dùng @Inject(TOKEN) để báo cho NestJS biết cần inject cái gì.'
      },
      {
        id: 's1-q19',
        question: 'Phương thức `app.enableShutdownHooks()` trong file `main.ts` có tác dụng gì?',
        options: [
          'Lắng nghe các tín hiệu hệ điều hành (SIGTERM, SIGINT) để kích hoạt các hook onApplicationShutdown của service.',
          'Tự động ngắt kết nối Internet của máy chủ khi phát hiện có cuộc tấn công mạng nguy hiểm.',
          'Khởi động lại toàn bộ tiến trình ứng dụng mỗi khi dung lượng RAM vượt quá 80%.',
          'Xóa toàn bộ các file log cũ trong hệ thống sau khi ứng dụng kết thúc phiên làm việc.'
        ],
        correctIndex: 0,
        explanation: 'Mặc định shutdown hooks bị tắt vì lý do hiệu năng. Gọi app.enableShutdownHooks() sẽ kích hoạt việc lắng nghe tín hiệu OS để gọi onModuleDestroy, beforeApplicationShutdown và onApplicationShutdown.'
      },
      {
        id: 's1-q20',
        question: 'Kỹ thuật Async Provider trong NestJS (`useFactory` trả về một `Promise`) thường được ứng dụng vào việc gì?',
        options: [
          'Chờ kết nối Database hoặc nạp cấu hình từ Secret Manager bất đồng bộ trước khi server bắt đầu nhận request.',
          'Chạy các vòng lặp vô tận trong background để quét virus định kỳ cho máy chủ lưu trữ.',
          'Tự động gửi email kích hoạt tài khoản cho người dùng mà không cần người dùng yêu cầu.',
          'Tối ưu hóa dung lượng file bundle JavaScript khi đóng gói ứng dụng bằng Webpack.'
        ],
        correctIndex: 0,
        explanation: 'Async Provider trì hoãn quá trình bootstrap của ứng dụng cho đến khi Promise được resolve, đảm bảo các kết nối quan trọng (như DB connection, Redis client, Vault secrets) sẵn sàng 100% trước khi mở port.'
      }
    ],
    codeChallenge: {
      id: 's1-code',
      title: 'Lab Thực Hành Sprint 1: Mini IoC Container & Dependency Resolver',
      description: 'Hiện thực hàm `resolveDependencies(container, token)` mô phỏng NestJS IoC Container. Hàm nhận vào danh sách đăng ký provider và trả về instance đã được resolve đệ quy các dependencies phụ thuộc. Hỗ trợ cả `useClass` và `useValue`.',
      starterCode: `function resolveDependencies(container, token, resolvedCache = new Map()) {
  // TODO: Hiện thực hàm resolve dependency injection theo chuẩn IoC Container
  // 1. Kiểm tra cache singleton trong resolvedCache
  // 2. Tìm provider trong container (ném Error nếu không tìm thấy)
  // 3. Xử lý 'useValue' hoặc 'useClass' (resolve đệ quy các dependencies trong provider.inject)
  // 4. Lưu instance vào resolvedCache và trả về

}`,
      testCases: [
        {
          input: [
            {
              CONFIG: { useValue: { port: 3000, db: 'postgres' } }
            },
            'CONFIG'
          ],
          expected: { port: 3000, db: 'postgres' },
          description: 'useValue provider phải trả về đúng object cấu hình'
        },
        {
          input: [
            {
              DB: { useValue: { connected: true } },
              USER_SERVICE: {
                useClass: class UserService {
                  db: unknown;
                  constructor(db: unknown) { this.db = db; }
                },
                inject: ['DB']
              }
            },
            'USER_SERVICE'
          ],
          expected: { db: { connected: true } },
          description: 'useClass provider phải inject đúng DB dependency vào constructor'
        },
        {
          input: [
            {
              LOGGER: { useValue: { log: true } },
              AUTH: {
                useClass: class AuthService { logger: unknown; constructor(logger: unknown) { this.logger = logger; } },
                inject: ['LOGGER']
              },
              APP: {
                useClass: class AppService { auth: unknown; constructor(auth: unknown) { this.auth = auth; } },
                inject: ['AUTH']
              }
            },
            'APP'
          ],
          expected: { auth: { logger: { log: true } } },
          description: 'Hệ thống phải resolve đệ quy chuỗi dependencies lồng nhau (Nested DI)'
        }
      ]
    }
  },

  // =========================================================================
  // SPRINT 2: CONTROLLERS, DTOs & VALIDATION PIPES
  // =========================================================================
  {
    sprintId: 2,
    title: 'Bài Kiểm Tra Sprint 2: Controllers, DTOs & Validation Pipes',
    description: 'Đánh giá chuyên sâu: Request Lifecycle, class-validator, Custom Decorators, Global Pipes và Transformation.',
    timeLimitMinutes: 25,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's2-q1',
        question: 'Trong NestJS Request Lifecycle, thứ tự thực thi chính xác từ khi nhận request đến khi trả về response là gì?',
        options: [
          'Middleware → Guards → Interceptors (pre) → Pipes → Controller Handler → Interceptors (post) → Exception Filters.',
          'Guards → Middleware → Pipes → Interceptors (pre) → Controller Handler → Exception Filters → Interceptors (post).',
          'Pipes → Middleware → Guards → Controller Handler → Interceptors (pre) → Interceptors (post) → Exception Filters.',
          'Middleware → Pipes → Guards → Interceptors (pre) → Controller Handler → Exception Filters → Interceptors (post).'
        ],
        correctIndex: 0,
        explanation: 'Thứ tự chuẩn của NestJS: 1. Middleware → 2. Guards → 3. Interceptors (pre-controller) → 4. Pipes → 5. Controller Route Handler → 6. Interceptors (post-controller) → 7. Exception Filters (nếu có lỗi ném ra).'
      },
      {
        id: 's2-q2',
        question: 'Khi cấu hình `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`, hành vi của server là gì?',
        options: [
          'Tự động từ chối request (HTTP 400) nếu body gửi lên chứa bất kỳ trường nào không được khai báo trong DTO.',
          'Tự động xóa các trường lạ và âm thầm chấp nhận request mà không báo lỗi cho client biết.',
          'Tự động thêm các trường bị thiếu vào database với giá trị mặc định là null hoặc chuỗi rỗng.',
          'Bắt buộc client phải gửi kèm một danh sách IP whitelist trong header HTTP Authorization.'
        ],
        correctIndex: 0,
        explanation: '`whitelist: true` loại bỏ các trường không có trong DTO. Kết hợp `forbidNonWhitelisted: true` sẽ lập tức ném lỗi 400 Bad Request nếu phát hiện có bất kỳ trường lạ (unrecognized property) nào được gửi lên.'
      },
      {
        id: 's2-q3',
        question: 'Tại sao tùy chọn `transform: true` trong ValidationPipe lại cực kỳ quan trọng đối với các tham số `@Param("id")` hoặc `@Query("page")`?',
        options: [
          'Tự động ép kiểu chuỗi (string) từ URL thành kiểu dữ liệu khai báo trong DTO (như number, boolean) dựa trên TypeScript type.',
          'Tự động dịch các chuỗi văn bản tiếng Việt có dấu thành tiếng Việt không dấu trước khi lưu vào cơ sở dữ liệu.',
          'Mã hóa toàn bộ các tham số trên đường dẫn URL thành chuỗi Base64 an toàn để tránh lộ thông tin.',
          'Tự động kiểm tra tính duy nhất của ID trong database trước khi chuyển tiếp vào hàm xử lý của Controller.'
        ],
        correctIndex: 0,
        explanation: 'Mọi query param và route param trên URL đều là chuỗi (string). `transform: true` sử dụng class-transformer để tự động ép kiểu "123" thành số 123 hoặc "true" thành boolean true theo đúng định nghĩa DTO.'
      },
      {
        id: 's2-q4',
        question: 'Khi nào nên sử dụng `ParseUUIDPipe` hoặc `ParseIntPipe` trực tiếp trên tham số của `@Param()`?',
        options: [
          'Để validate và ép kiểu dữ liệu ngay tại route param, ném lỗi 400 ngay lập tức nếu ID không đúng định dạng UUID/Integer.',
          'Để tự động mã hóa ID thành một chuỗi token bí mật trước khi gửi tiếp xuống tầng Service xử lý.',
          'Để tự động tăng giá trị của ID lên 1 đơn vị mỗi khi có request mới truy cập vào route đó.',
          'Để thay thế hoàn toàn việc kiểm tra quyền truy cập của người dùng đối với tài nguyên đó.'
        ],
        correctIndex: 0,
        explanation: 'ParseUUIDPipe/ParseIntPipe là các Built-in Pipes thực hiện việc kiểm tra định dạng và chuyển đổi kiểu dữ liệu cho param. Nếu client truyền ID không hợp lệ (ví dụ: /users/abc), Pipe sẽ lập tức ngắt và trả về 400 Bad Request.'
      },
      {
        id: 's2-q5',
        question: 'Decorator `@UseGuards(AuthGuard)` có thể được áp dụng ở những phạm vi (scope) nào trong ứng dụng NestJS?',
        options: [
          'Có thể áp dụng ở cấp độ Method (Route), cấp độ Controller (Class), hoặc cấp độ Toàn cục (Global Scope).',
          'Chỉ có thể áp dụng ở cấp độ Method bên trong Controller, không thể áp dụng cho toàn bộ Controller.',
          'Chỉ có thể áp dụng trực tiếp bên trong file main.ts thông qua hàm app.use() của thư viện Express.',
          'Chỉ có thể áp dụng cho các Service tầng nghiệp vụ, không thể áp dụng trực tiếp cho Controller.'
        ],
        correctIndex: 0,
        explanation: 'Trong NestJS, Guards (và Interceptors, Pipes, Filters) đều có thể gắn ở 3 cấp độ: từng Route Handler (@UseGuards), toàn bộ Controller Class (@UseGuards trên class), hoặc Global (app.useGlobalGuards).'
      },
      {
        id: 's2-q6',
        question: 'Tại sao việc dùng `@Res()` trong Controller method (`@Res() res: Response`) mà không có `{ passthrough: true }` lại là một rủi ro?',
        options: [
          'Nó chuyển Controller sang chế độ thủ công (Manual Mode), làm vô hiệu hóa các tính năng tự động như Interceptors, HTTP Status Code và Response Mapping của NestJS.',
          'Nó làm cho ứng dụng bị rò rỉ bộ nhớ RAM và tự động đóng kết nối TCP của toàn bộ các request khác.',
          'Nó khiến cho TypeScript compiler không thể kiểm tra kiểu dữ liệu trả về của hàm trong Controller.',
          'Nó bắt buộc client phải gửi kèm header X-Response-Type: Express trong mọi request gửi lên.'
        ],
        correctIndex: 0,
        explanation: 'Khi inject @Res(), NestJS nhường quyền xử lý response cho bạn (bắt buộc phải gọi res.send/res.json). Nếu muốn can thiệp response header/cookie mà vẫn để NestJS tự động return dữ liệu, bắt buộc phải dùng `@Res({ passthrough: true })`.'
      },
      {
        id: 's2-q7',
        question: 'Mục đích của việc tạo Custom Param Decorator bằng `createParamDecorator` (ví dụ: `@CurrentUser()`) là gì?',
        options: [
          'Trích xuất thông tin người dùng từ request object một cách sạch sẽ, tái sử dụng và tránh lặp lại `req.user` ở các Controller.',
          'Tự động truy vấn database để nạp toàn bộ lịch sử mua hàng của người dùng vào bộ nhớ đệm RAM.',
          'Xác thực mật khẩu của người dùng bằng thuật toán JWT trước khi cho phép vào Controller.',
          'Tự động sinh ra các endpoint API mới tương ứng với các trường có trong thông tin của người dùng.'
        ],
        correctIndex: 0,
        explanation: 'createParamDecorator cho phép tạo decorator tùy biến để trích xuất dữ liệu từ ExecutionContext (như req.user, req.headers, tenantId) giúp code Controller ngắn gọn, dễ đọc và dễ mock khi test.'
      },
      {
        id: 's2-q8',
        question: 'Decorator `@HttpCode(HttpStatus.NO_CONTENT)` đặt trên một route handler `@Delete(":id")` sẽ trả về mã HTTP status nào khi thực thi thành công?',
        options: [
          '204 No Content và không có body dữ liệu trả về.',
          '200 OK kèm theo thông điệp { deleted: true } trong JSON body.',
          '202 Accepted thông báo request đã được tiếp nhận vào hàng đợi.',
          '404 Not Found thông báo tài nguyên đã bị xóa hoàn toàn khỏi DB.'
        ],
        correctIndex: 0,
        explanation: 'HTTP 204 No Content là mã chuẩn REST biểu thị thao tác thành công và server không cần trả về bất kỳ nội dung nào trong body.'
      },
      {
        id: 's2-q9',
        question: 'Trong class DTO, decorator `@Type(() => Number)` của thư viện `class-transformer` có tác dụng gì khi kết hợp với mảng object lồng nhau?',
        options: [
          'Chỉ định rõ kiểu dữ liệu cụ thể để class-transformer có thể khởi tạo đúng class instance cho các object con lồng nhau.',
          'Tự động kiểm tra giá trị của số đó có nằm trong khoảng từ 0 đến 100 hay không.',
          'Mã hóa toàn bộ các trường số trong object thành chuỗi nhị phân trước khi lưu vào DB.',
          'Chuyển đổi số nguyên thành số thực có độ chính xác 64-bit theo chuẩn IEEE 754.'
        ],
        correctIndex: 0,
        explanation: 'Do TypeScript xóa bỏ type information khi biên dịch sang JS, class-transformer cần decorator @Type(() => TargetClass) để biết chính xác class nào cần khởi tạo khi deserialize các mảng hoặc object lồng nhau.'
      },
      {
        id: 's2-q10',
        question: 'Khi cần áp dụng ValidationPipe cho một tham số cụ thể thay vì toàn bộ Controller, cú pháp nào là chính xác?',
        options: [
          '`@Body(new ValidationPipe({ whitelist: true })) body: CreateUserDto`',
          '`@UsePipes(ValidationPipe) @Body() body: CreateUserDto`',
          '`@Body({ pipe: ValidationPipe }) body: CreateUserDto`',
          '`@Validate(CreateUserDto) @Body() body: CreateUserDto`'
        ],
        correctIndex: 0,
        explanation: 'NestJS cho phép truyền trực tiếp Pipe instance hoặc Class vào decorator của tham số như `@Body(ValidationPipe)` hoặc `@Query(new DefaultValuePipe(1), ParseIntPipe)`.'
      },
      {
        id: 's2-q11',
        question: 'Decorator `@Header("Cache-Control", "no-store")` đặt trên một Controller method có tác dụng gì?',
        options: [
          'Thiết lập Response Header tĩnh để chỉ thị cho trình duyệt và proxy không được lưu trữ cache của response này.',
          'Yêu cầu client phải gửi kèm header Cache-Control: no-store trong request thì mới được phép truy cập.',
          'Xóa toàn bộ cache Redis của ứng dụng backend ngay sau khi hàm này thực thi xong.',
          'Tự động nén toàn bộ response body bằng thuật toán Brotli trước khi truyền qua mạng.'
        ],
        correctIndex: 0,
        explanation: '@Header() là decorator tiện ích của NestJS giúp định nghĩa các HTTP Response Headers tĩnh trả về cho client một cách trực quan.'
      },
      {
        id: 's2-q12',
        question: 'Khi nào một Exception Filter (gắn qua `@UseFilters`) được kích hoạt trong NestJS?',
        options: [
          'Khi có một ngoại lệ (Exception/Error) được ném ra từ bất kỳ đâu trong chuỗi xử lý (Guards, Pipes, Interceptors, Controllers).',
          'Chỉ khi cơ sở dữ liệu bị mất kết nối mạng và không thể thực thi câu lệnh SQL.',
          'Khi người dùng bấm nút Cancel trên trình duyệt và ngắt kết nối HTTP giữa chừng.',
          'Chỉ khi có lỗi cú pháp syntax error xảy ra trong quá trình khởi động server.'
        ],
        correctIndex: 0,
        explanation: 'Exception Layer của NestJS bắt toàn bộ các unhandled exceptions ném ra trong request pipeline để format lại thành response chuẩn (HTTP status code, error message, timestamp, path).'
      },
      {
        id: 's2-q13',
        question: 'Trong class-validator, sự khác biệt giữa `@IsOptional()` và việc đặt dấu hỏi `?` trong TypeScript (`name?: string`) là gì?',
        options: [
          '`@IsOptional()` là decorator runtime báo cho validator bỏ qua kiểm tra nếu giá trị là null/undefined, còn dấu `?` chỉ có ý nghĩa khi kiểm tra kiểu tĩnh lúc viết code.',
          '`@IsOptional()` bắt buộc trường đó phải có giá trị rỗng, còn dấu `?` cho phép nhận giá trị bất kỳ.',
          'Dấu `?` tự động biến trường đó thành optional ở runtime mà không cần dùng bất kỳ decorator nào.',
          '`@IsOptional()` chỉ hoạt động trên môi trường production, còn dấu `?` chỉ hoạt động trên môi trường development.'
        ],
        correctIndex: 0,
        explanation: 'TypeScript types và dấu `?` bị loại bỏ hoàn toàn sau khi compile sang JavaScript. class-validator chạy ở runtime, bắt buộc phải có decorator `@IsOptional()` thì mới không báo lỗi khi trường đó không được gửi lên.'
      },
      {
        id: 's2-q14',
        question: 'Khi sử dụng decorator `@Redirect("https://esmiles.vn", 301)`, hành vi mặc định của server là gì?',
        options: [
          'Trả về HTTP Status 301 Moved Permanently kèm Header `Location: https://esmiles.vn` để trình duyệt tự động chuyển hướng.',
          'Tự động tải nội dung trang web https://esmiles.vn về server và render trả về cho client dưới dạng proxy.',
          'Gửi một thông báo WebSocket tới trình duyệt yêu cầu người dùng bấm vào đường link mới.',
          'Lưu địa chỉ URL https://esmiles.vn vào cơ sở dữ liệu và chuyển tiếp request tới Controller tiếp theo.'
        ],
        correctIndex: 0,
        explanation: '@Redirect() là decorator cấu hình phản hồi HTTP chuyển hướng (HTTP 301/302 Redirection) với URL đích và status code tương ứng.'
      },
      {
        id: 's2-q15',
        question: 'Mục đích chính của Interceptor trong NestJS là gì?',
        options: [
          'Can thiệp và biến đổi logic trước khi vào hàm (pre) và sau khi hàm trả về kết quả (post), biến đổi response hoặc đo thời gian thực thi.',
          'Kiểm tra quyền truy cập và vai trò của người dùng trước khi cho phép vào Controller.',
          'Kiểm tra tính hợp lệ của dữ liệu đầu vào và ép kiểu các tham số trong request body.',
          'Tự động tạo các bản ghi audit log trong cơ sở dữ liệu mỗi khi có lỗi database xảy ra.'
        ],
        correctIndex: 0,
        explanation: 'Interceptors dựa trên mô hình AOP (Aspect-Oriented Programming). Chúng có thể bọc quanh execution context để bind extra logic, transform kết quả trả về bằng RxJS operators, hoặc log thời gian thực thi (execution time).'
      },
      {
        id: 's2-q16',
        question: 'Khi một class DTO kế thừa từ class khác bằng helper `PartialType(CreateUserDto)` của `@nestjs/swagger` hoặc `@nestjs/mapped-types`, điều gì xảy ra?',
        options: [
          'Tất cả các trường của CreateUserDto đều được sao chép sang DTO mới nhưng được tự động chuyển thành `@IsOptional()`.',
          'Toàn bộ các decorator validation của CreateUserDto bị xóa bỏ và thay thế bằng kiểm tra chuỗi thuần túy.',
          'DTO mới sẽ chỉ chứa 50% số lượng trường được chọn ngẫu nhiên từ CreateUserDto.',
          'DTO mới sẽ tự động nạp toàn bộ các trường của bảng User trong cơ sở dữ liệu Prisma Schema.'
        ],
        correctIndex: 0,
        explanation: 'PartialType() tự động copy toàn bộ validation rules của class cha và áp dụng thêm @IsOptional() cho tất cả các field, rất hữu ích cho các DTO cập nhật (UpdateUserDto).'
      },
      {
        id: 's2-q17',
        question: 'Trong một Custom Validation Pipe, interface nào của NestJS bắt buộc class đó phải hiện thực (implement)?',
        options: [
          '`PipeTransform<T, R>` với phương thức `transform(value: T, metadata: ArgumentMetadata): R`',
          '`NestInterceptor` với phương thức `intercept(context: ExecutionContext, next: CallHandler)`',
          '`CanActivate` với phương thức `canActivate(context: ExecutionContext): boolean`',
          '`ExceptionFilter` với phương thức `catch(exception: any, host: ArgumentsHost)`'
        ],
        correctIndex: 0,
        explanation: 'Mọi Pipe trong NestJS bắt buộc phải implement interface `PipeTransform` và cung cấp phương thức `transform(value, metadata)` để trả về giá trị đã được validate/biến đổi.'
      },
      {
        id: 's2-q18',
        question: 'Decorator `@Ip()` trên Controller method dùng để lấy thông tin gì?',
        options: [
          'Địa chỉ IP của client gửi request đến server (lấy từ req.ip hoặc header X-Forwarded-For).',
          'Địa chỉ IP nội bộ của máy chủ cơ sở dữ liệu PostgreSQL đang kết nối.',
          'Tự động quét và lấy danh sách toàn bộ các IP trong cùng mạng LAN của người dùng.',
          'Chặn địa chỉ IP hiện tại và đưa vào danh sách đen (blacklist) của hệ thống.'
        ],
        correctIndex: 0,
        explanation: '@Ip() là decorator tiện ích của NestJS giúp trích xuất IP address của client từ request một cách nhanh chóng mà không cần bóc tách thủ công từ req object.'
      },
      {
        id: 's2-q19',
        question: 'Tại sao việc dùng `class-validator` với các custom validation rule bất đồng bộ (Async Custom Constraint) cần phải cẩn trọng?',
        options: [
          'Vì nếu custom validator gọi query database mà không có cache/timeout, nó có thể làm nghẽn request và tạo lỗ hổng DoS.',
          'Vì TypeScript compiler sẽ từ chối biên dịch các hàm async bên trong thư viện class-validator.',
          'Vì class-validator chỉ cho phép tối đa 1 hàm async duy nhất được chạy trong toàn bộ ứng dụng.',
          'Vì các hàm async validation sẽ tự động hủy bỏ phiên đăng nhập của người dùng nếu chạy quá 100ms.'
        ],
        correctIndex: 0,
        explanation: 'Custom async validator (như @IsUniqueEmail) gọi trực tiếp DB ở tầng pipe. Nếu bị spam request, DB sẽ bị quá tải bởi hàng nghìn câu query lặp đi lặp lại. Cần xử lý cẩn thận hoặc chuyển vào tầng service.'
      },
      {
        id: 's2-q20',
        question: 'Khi muốn loại bỏ một trường nhạy cảm (như `password` hoặc `salt`) khỏi response trả về cho client một cách tự động, kỹ thuật chuẩn trong NestJS là gì?',
        options: [
          'Sử dụng `@Exclude()` của `class-transformer` trên entity kết hợp với `@UseInterceptors(ClassSerializerInterceptor)`.',
          'Dùng hàm delete `user.password` trực tiếp trong từng controller method trước khi return.',
          'Đặt tên biến của trường đó bắt đầu bằng dấu gạch dưới `_password` để trình duyệt tự động ẩn đi.',
          'Không lưu mật khẩu trong database mà chỉ lưu trữ tạm thời trong bộ nhớ cache Redis.'
        ],
        correctIndex: 0,
        explanation: 'ClassSerializerInterceptor tự động áp dụng các quy tắc `@Exclude()` và `@Expose()` của thư viện class-transformer trên class trả về, đảm bảo các trường nhạy cảm không bao giờ bị lọt ra ngoài response.'
      }
    ],
    codeChallenge: {
      id: 's2-code',
      title: 'Lab Thực Hành Sprint 2: Request Pipeline Validator & Sanitizer Engine',
      description: 'Hiện thực hàm `validateAndTransformDto(payload, schema)` mô phỏng ValidationPipe của NestJS. Hàm nhận vào `payload` và `schema` (quy định kiểu `string`, `number`, `email`, `optional`, `min`, `max`). Nếu hợp lệ, trả về `{ valid: true, data: sanitizedData }`. Nếu có lỗi, trả về `{ valid: false, errors: string[] }`.',
      starterCode: `function validateAndTransformDto(payload, schema) {
  // TODO: Hiện thực Request Validation & Data Transformation Pipeline
  // schema: { [fieldName]: { type: 'string' | 'number', isEmail?: boolean, min?: number, max?: number, optional?: boolean } }
  // Nếu hợp lệ: trả về { valid: true, data: sanitizedPayload }
  // Nếu có lỗi: trả về { valid: false, errors: string[] }

}`,
      testCases: [
        {
          input: [
            { name: '  Ho Oanh  ', email: 'oanh@esmiles.vn', age: '28' },
            {
              name: { type: 'string' },
              email: { type: 'string', isEmail: true },
              age: { type: 'number', min: 18 }
            }
          ],
          expected: {
            valid: true,
            data: { name: 'Ho Oanh', email: 'oanh@esmiles.vn', age: 28 }
          },
          description: 'Dữ liệu hợp lệ phải được trim string và ép kiểu string age thành number 28'
        },
        {
          input: [
            { email: 'invalid-email', age: 15 },
            {
              name: { type: 'string' },
              email: { type: 'string', isEmail: true },
              age: { type: 'number', min: 18 }
            }
          ],
          expected: {
            valid: false,
            errors: [
              'name is required',
              'email must be a valid email address',
              'age must be at least 18'
            ]
          },
          description: 'Dữ liệu sai phải tổng hợp đầy đủ danh sách các trường lỗi validation'
        },
        {
          input: [
            { name: 'Admin' },
            {
              name: { type: 'string' },
              note: { type: 'string', optional: true }
            }
          ],
          expected: {
            valid: true,
            data: { name: 'Admin' }
          },
          description: 'Trường optional vắng mặt không được báo lỗi validation'
        }
      ]
    }
  },

  // =========================================================================
  // SPRINT 3: DATABASE DESIGN & PRISMA 7 ADVANCED
  // =========================================================================
  {
    sprintId: 3,
    title: 'Bài Kiểm Tra Sprint 3: Database Design, Concurrency & Prisma 7',
    description: 'Khảo thí chuyên sâu: Transaction Isolation, Prisma 7 Client Extensions, Optimistic Concurrency, Indexing và Soft Delete.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's3-q1',
        question: 'Trong Prisma 7, sự khác biệt giữa Sequential Transaction (`prisma.$transaction([op1, op2])`) và Interactive Transaction (`prisma.$transaction(async (tx) => { ... })`) là gì?',
        options: [
          'Sequential gửi một mảng query thực thi tuần tự, còn Interactive cho phép viết code logic có điều kiện phụ thuộc vào kết quả của câu query trước.',
          'Sequential tự động rollback khi gặp lỗi, còn Interactive không bao giờ rollback được kể cả khi có ngoại lệ phát sinh.',
          'Sequential chỉ dùng được cho lệnh SELECT, còn Interactive bắt buộc phải dùng cho lệnh INSERT và UPDATE.',
          'Sequential chạy trên nhiều kết nối database khác nhau, còn Interactive chỉ chạy trên môi trường local memory.'
        ],
        correctIndex: 0,
        explanation: 'Sequential Transaction nhận mảng các Promise độc lập. Interactive Transaction mở một transaction thực sự trên DB và truyền đối tượng `tx` vào callback để bạn có thể đọc kết quả bước 1 rồi mới quyết định logic cho bước 2.'
      },
      {
        id: 's3-q2',
        question: 'Khi triển khai cơ chế Optimistic Concurrency Control (OCC) để chống ghi đè dữ liệu đồng thời (Lost Update), kỹ thuật chuẩn nào được áp dụng?',
        options: [
          'Thêm trường `version Int @default(1)` và cập nhật theo điều kiện: `where: { id, version: currentVersion }, data: { version: { increment: 1 } }`.',
          'Khóa toàn bộ bảng cơ sở dữ liệu bằng lệnh `LOCK TABLE` trước khi thực hiện câu lệnh UPDATE.',
          'Chuyển toàn bộ database sang chế độ Single-Thread để các câu lệnh update xếp hàng tuần tự.',
          'Tự động từ chối tất cả các request update nếu người dùng không gửi kèm mã OTP qua tin nhắn SMS.'
        ],
        correctIndex: 0,
        explanation: 'Optimistic Locking kiểm tra phiên bản dữ liệu lúc cập nhật (`version == oldVersion`). Nếu có request khác đã sửa trước đó (version đã tăng), câu lệnh update sẽ không khớp dòng nào (count = 0), từ đó ném lỗi Conflict (409) yêu cầu reload.'
      },
      {
        id: 's3-q3',
        question: 'Trong hệ thống đa chi nhánh (Multi-tenancy) dùng chung 1 database (Shared Database, Shared Schema), nguy cơ rò rỉ dữ liệu lớn nhất là gì?',
        options: [
          'Lập trình viên quên thêm điều kiện `unitId` (hoặc `tenantId`) vào mệnh đề `where` của câu lệnh truy vấn tìm kiếm hoặc cập nhật.',
          'Cơ sở dữ liệu PostgreSQL sẽ tự động gộp các chi nhánh có cùng tên vào làm một bảng dữ liệu duy nhất.',
          'Dung lượng ổ cứng của server sẽ bị quá tải nhanh gấp đôi so với mô hình Separate Database.',
          'Client của chi nhánh A có thể đọc trộm mã nguồn TypeScript của chi nhánh B thông qua header HTTP.'
        ],
        correctIndex: 0,
        explanation: 'Mô hình Shared DB phân tách dữ liệu bằng cột `unitId`. Nếu câu lệnh SELECT/UPDATE quên `where: { unitId }`, dữ liệu của phòng khám này sẽ bị lộ hoặc ghi đè sang phòng khám khác.'
      },
      {
        id: 's3-q4',
        question: 'Để giải quyết triệt để nguy cơ quên gắn `unitId` trong toàn bộ các truy vấn Prisma, kỹ thuật kiến trúc nào là tối ưu nhất?',
        options: [
          'Sử dụng Prisma Client Extensions (`$extends`) với query extension để tự động inject `unitId` vào mọi mệnh đề `where`.',
          'Viết ghi chú nhắc nhở các lập trình viên kiểm tra code thủ công trước khi tạo Pull Request trên GitHub.',
          'Tạo 100 hàm helper riêng biệt và bắt buộc lập trình viên phải nhớ gọi helper đó ở mọi Service.',
          'Chuyển toàn bộ database sang lưu trữ dạng file JSON trên ổ cứng máy chủ để dễ quản lý.'
        ],
        correctIndex: 0,
        explanation: 'Prisma 7 Client Extension cho phép can thiệp vào tầng query lifecycle (`query: { $allModels: { async $allOperations({ args, query }) { ... } } }`) để tự động ép buộc tenant filter một cách tập trung và an toàn 100%.'
      },
      {
        id: 's3-q5',
        question: 'Trong thiết kế cơ sở dữ liệu, một Composite Unique Index (ví dụ: `@@unique([unitId, code])`) mang lại lợi ích gì?',
        options: [
          'Đảm bảo mã `code` là duy nhất trong phạm vi từng chi nhánh (`unitId`), cho phép các chi nhánh khác nhau dùng chung mã code mà không bị xung đột.',
          'Tự động tăng tốc độ của tất cả các câu lệnh INSERT lên gấp 10 lần nhờ cơ chế nén dữ liệu B-Tree.',
          'Ngăn không cho người dùng xóa bản ghi nếu bản ghi đó chưa tồn tại quá 30 ngày trong cơ sở dữ liệu.',
          'Cho phép lưu trữ các giá trị NULL mà không bị tính vào dung lượng bộ nhớ của bảng.'
        ],
        correctIndex: 0,
        explanation: 'Composite Unique Index áp dụng tính duy nhất trên tổ hợp nhiều cột. Chi nhánh 1 có mã "THUOC_01", chi nhánh 2 vẫn có thể tạo mã "THUOC_01" hợp lệ mà không vi phạm tính toàn vẹn.'
      },
      {
        id: 's3-q6',
        question: 'Khi triển khai tính năng Soft Delete (xóa mềm) bằng trường `deletedAt DateTime?`, thách thức kỹ thuật lớn nhất khi kết hợp với Unique Constraint là gì?',
        options: [
          'Nếu cột `code` có unique constraint đơn lẻ, sau khi xóa mềm một bản ghi, bạn sẽ không thể tạo lại bản ghi mới có cùng mã `code` đó.',
          'Cơ sở dữ liệu PostgreSQL sẽ tự động xóa vĩnh viễn dòng đó sau 24 giờ kể từ khi gán giá trị cho deletedAt.',
          'Các câu lệnh SELECT thông thường sẽ tự động lọc bỏ các bản ghi đã xóa mềm mà không cần thêm điều kiện where.',
          'Không thể sử dụng tính năng Foreign Key (Khóa ngoại) trỏ tới bảng có chứa trường deletedAt.'
        ],
        correctIndex: 0,
        explanation: 'Nếu `code` là Unique, bản ghi cũ dù đã có `deletedAt != null` thì giá trị `code` vẫn tồn tại trong DB, khiến câu lệnh INSERT bản ghi mới có cùng code bị dính lỗi Unique Violation (P2002). Cần dùng Partial Index hoặc tổ hợp deletedAt.'
      },
      {
        id: 's3-q7',
        question: 'Mục đích của việc thiết lập `timeout` trong Interactive Transaction của Prisma (`{ timeout: 5000, maxWait: 2000 }`) là gì?',
        options: [
          'Ngăn chặn việc một transaction bị treo (hang) giữ khóa (lock) quá lâu gây nghẽn kết nối và deadlock cho toàn bộ hệ thống.',
          'Tự động chia nhỏ transaction lớn thành các transaction nhỏ chạy song song trên nhiều CPU Core.',
          'Tăng thời gian chờ phản hồi của trình duyệt frontend từ 30 giây lên 60 giây khi mạng yếu.',
          'Ép cơ sở dữ liệu phải lưu tạm toàn bộ transaction vào bộ nhớ đệm RAM của máy chủ backend.'
        ],
        correctIndex: 0,
        explanation: 'Interactive Transaction giữ một kết nối DB riêng và các dòng bị khóa. Nếu callback chạy quá lâu (ví dụ gọi API bên ngoài), timeout sẽ tự động abort transaction để giải phóng kết nối và tránh nghẽn pool.'
      },
      {
        id: 's3-q8',
        question: 'Hiện tượng "N+1 Query Problem" trong ORM/Database xảy ra khi nào và cách khắc phục trong Prisma là gì?',
        options: [
          'Xảy ra khi query danh sách N bản ghi rồi lặp qua từng bản ghi để query thêm dữ liệu quan hệ; khắc phục bằng cách dùng `include` hoặc `select`.',
          'Xảy ra khi database có hơn 1 triệu dòng dữ liệu; khắc phục bằng cách xóa bớt các bảng không dùng.',
          'Xảy ra khi có N người dùng cùng đăng nhập vào hệ thống cùng một lúc; khắc phục bằng Redis cache.',
          'Xảy ra khi câu lệnh SQL có chứa nhiều hơn 1 mệnh đề JOIN; khắc phục bằng cách tách thành các bảng phẳng.'
        ],
        correctIndex: 0,
        explanation: 'N+1 xảy ra khi lấy 1 danh sách (1 query), sau đó chạy vòng for gọi DB N lần để lấy thông tin liên kết (tổng cộng 1 + N queries). Prisma giải quyết bằng `include: { relation: true }` để nạp dữ liệu bằng 1 hoặc 2 query tối ưu.'
      },
      {
        id: 's3-q9',
        question: 'Mã lỗi `P2002` trong Prisma Client biểu thị cho sự cố cơ sở dữ liệu nào?',
        options: [
          'Unique constraint failed (Vi phạm ràng buộc giá trị duy nhất trên một hoặc nhiều cột).',
          'Foreign key constraint failed (Không tìm thấy bản ghi cha tương ứng trong bảng quan hệ).',
          'Record to update not found (Không tìm thấy bản ghi cần cập nhật hoặc xóa thỏa mãn điều kiện where).',
          'Database connection timeout (Hết thời gian chờ kết nối tới máy chủ cơ sở dữ liệu).'
        ],
        correctIndex: 0,
        explanation: 'P2002 là mã lỗi kinh điển của Prisma cho biết câu lệnh INSERT/UPDATE đã vi phạm Unique Index (trùng email, trùng mã code, v.v.).'
      },
      {
        id: 's3-q10',
        question: 'Trong Prisma Schema, quan hệ Many-to-Many tự quản (Implicit Many-to-Many) có đặc điểm gì nổi bật?',
        options: [
          'Prisma tự động tạo và quản lý bảng trung gian ngầm dưới database mà không cần khai báo model bảng phụ trong schema.',
          'Không hỗ trợ tạo khóa ngoại giữa hai bảng dữ liệu để tăng tốc độ ghi dữ liệu.',
          'Bắt buộc cả hai bảng phải có cùng số lượng cột và cùng kiểu dữ liệu khóa chính.',
          'Chỉ hoạt động được trên hệ quản trị cơ sở dữ liệu SQLite, không dùng được trên PostgreSQL.'
        ],
        correctIndex: 0,
        explanation: 'Implicit m-n (ví dụ: `posts Post[]` và `categories Category[]`) giúp Prisma tự sinh bảng trung gian `_CategoryToPost` với các index và foreign key tối ưu mà bạn không cần tạo model thủ công.'
      },
      {
        id: 's3-q11',
        question: 'Khi thực hiện câu lệnh trừ tồn kho: `updateMany({ where: { id, quantity: { gte: count } }, data: { quantity: { decrement: count } } })`, nếu kết quả trả về `{ count: 0 }` thì có ý nghĩa gì?',
        options: [
          'Không có bản ghi nào thỏa mãn điều kiện (sản phẩm không tồn tại hoặc số lượng tồn kho không đủ để trừ).',
          'Thao tác trừ tồn kho đã hoàn tất thành công và số lượng tồn kho mới trong kho chính xác bằng 0.',
          'Cơ sở dữ liệu đã tự động chuyển số lượng âm thành 0 để bảo toàn tính toàn vẹn dữ liệu.',
          'Câu lệnh update đã bị hủy bỏ do phát hiện có hai người dùng cùng đặt mua sản phẩm đó.'
        ],
        correctIndex: 0,
        explanation: 'Atomic Conditional Update: Nếu quantity < count, điều kiện `gte: count` không khớp, `count: 0` trả về giúp ta phát hiện ngay lập tức tình trạng cháy hàng (Insufficient Stock) mà không sợ Race Condition.'
      },
      {
        id: 's3-q12',
        question: 'Lệnh `prisma migrate dev` khác với `prisma db push` như thế nào trong quy trình phát triển chuyên nghiệp?',
        options: [
          '`migrate dev` tạo file lịch sử migration SQL có thể kiểm soát phiên bản (version control), còn `db push` chỉ đồng bộ trực tiếp schema mà không lưu lịch sử.',
          '`migrate dev` chỉ chạy được trên môi trường production, còn `db push` chỉ chạy được trên máy tính cá nhân.',
          '`db push` tự động sao lưu toàn bộ dữ liệu ra file backup trước khi thay đổi cấu trúc bảng.',
          '`migrate dev` không cho phép thêm các trường dữ liệu mới vào bảng đã có dữ liệu.'
        ],
        correctIndex: 0,
        explanation: 'migrate dev sinh các file .sql theo mốc thời gian (migration history) để CI/CD có thể chạy tự động trên staging/production. db push chỉ dùng để prototype nhanh khi thử nghiệm schema.'
      },
      {
        id: 's3-q13',
        question: 'Tại sao việc đánh chỉ mục Index dạng `B-Tree` trên một cột có độ chọn lọc rất thấp (Low Cardinality như cột `gender` chỉ có 2 giá trị MALE/FEMALE) thường không hiệu quả?',
        options: [
          'Vì số lượng dòng khớp với mỗi giá trị chiếm tỷ lệ quá lớn trong bảng, Query Optimizer sẽ ưu tiên quét toàn bộ bảng (Full Table Scan) nhanh hơn duyệt index.',
          'Vì cây B-Tree không thể lưu trữ các giá trị dạng chuỗi ký tự ngắn hơn 10 ký tự.',
          'Vì PostgreSQL chỉ cho phép tạo tối đa 1 index duy nhất trên mỗi bảng dữ liệu.',
          'Vì cột có độ chọn lọc thấp sẽ làm cho file cơ sở dữ liệu bị hỏng sau khi khởi động lại.'
        ],
        correctIndex: 0,
        explanation: 'Index chỉ hiệu quả khi giúp thu hẹp phạm vi tìm kiếm xuống một tỷ lệ nhỏ (High Cardinality). Nếu 1 giá trị chiếm 50% số dòng của bảng, duyệt Index rồi đọc Table còn chậm hơn đọc tuần tự (Sequential Scan).'
      },
      {
        id: 's3-q14',
        question: 'Trong PostgreSQL/Prisma, kiểu dữ liệu `Decimal` (hoặc `Decimal(15, 2)`) khác với kiểu `Float` như thế nào khi lưu trữ số tiền giao dịch?',
        options: [
          'Decimal lưu trữ số thập phân có độ chính xác cố định (Fixed-point), không bao giờ bị sai số làm tròn như số thực dấu phẩy động (Float).',
          'Float lưu trữ được số tiền lớn hơn Decimal nhưng bắt buộc phải có giá trị dương.',
          'Decimal tự động quy đổi tiền tệ sang tỷ giá USD theo thời gian thực khi lưu vào database.',
          'Float có tốc độ truy vấn chậm hơn Decimal 100 lần do phải giải mã chuỗi nhị phân.'
        ],
        correctIndex: 0,
        explanation: 'Float dùng chuẩn IEEE 754 (nhị phân xấp xỉ) nên 0.1 + 0.2 = 0.30000000000000004 gây lệch tiền kế toán. Tiền tệ bắt buộc phải dùng Decimal (hoặc lưu số nguyên Integer dạng đơn vị nhỏ nhất: cents/đồng).'
      },
      {
        id: 's3-q15',
        question: 'Cơ chế Connection Pool của Prisma được cấu hình qua tham số nào trong chuỗi kết nối Database URL?',
        options: [
          'Tham số `connection_limit=20&pool_timeout=10` gắn ở cuối chuỗi kết nối PostgreSQL URL.',
          'Khai báo thuộc tính `poolSize: 20` bên trong file cấu hình tsconfig.json của dự án.',
          'Tự động tăng giảm theo số lượng CPU Core của máy chủ mà không thể cấu hình thủ công.',
          'Bắt buộc phải cài đặt một phần mềm trung gian riêng biệt như PgBouncer thì mới có connection pool.'
        ],
        correctIndex: 0,
        explanation: 'Prisma Client cho phép tinh chỉnh connection pool trực tiếp trong connection string: `postgresql://user:pwd@host:5432/db?connection_limit=20&pool_timeout=10`.'
      },
      {
        id: 's3-q16',
        question: 'Khái niệm "Pessimistic Locking" (`SELECT ... FOR UPDATE`) khác với "Optimistic Locking" ở điểm nào?',
        options: [
          'Pessimistic Locking khóa cứng các dòng dữ liệu ở cấp độ DB ngay khi đọc, buộc các giao dịch khác phải chờ cho đến khi transaction hoàn tất.',
          'Pessimistic Locking không bao giờ gây ra hiện tượng Deadlock giữa các transaction đồng thời.',
          'Optimistic Locking chỉ hoạt động được trên các bảng dữ liệu không có khóa chính.',
          'Pessimistic Locking có tốc độ xử lý nhanh hơn Optimistic Locking trong mọi tình huống.'
        ],
        correctIndex: 0,
        explanation: 'Pessimistic Lock giả định xung đột luôn xảy ra nên lock cứng dòng dữ liệu (`FOR UPDATE`). Optimistic Lock giả định ít xung đột nên cho phép đọc thoải mái và chỉ kiểm tra version ở bước UPDATE cuối cùng.'
      },
      {
        id: 's3-q17',
        question: 'Khi sử dụng Prisma 7, tính năng "Driver Adapters" (như `@prisma/adapter-pg` hoặc `@prisma/adapter-neon`) mang lại lợi thế gì?',
        options: [
          'Cho phép Prisma Client sử dụng các driver kết nối serverless over HTTP/WebSockets, tối ưu cho môi trường Edge và Serverless Functions.',
          'Tự động dịch các câu lệnh SQL của PostgreSQL sang MySQL mà không cần thay đổi schema.',
          'Tăng dung lượng lưu trữ tối đa của cơ sở dữ liệu lên không giới hạn trên ổ đĩa mạng.',
          'Thay thế hoàn toàn việc phải định nghĩa các quan hệ khóa ngoại giữa các bảng.'
        ],
        correctIndex: 0,
        explanation: 'Driver Adapters trong Prisma cho phép tích hợp các thư viện kết nối database hiện đại (như node-postgres, Neon serverless driver, Planetscale) hoạt động mượt mà trên môi trường Cloudflare Workers/Vercel Edge.'
      },
      {
        id: 's3-q18',
        question: 'Trong Prisma, khi thực hiện lệnh `prisma.user.delete({ where: { id } })` trên một bản ghi có quan hệ `onDelete: Cascade` với bảng `orders`, điều gì sẽ xảy ra?',
        options: [
          'Bản ghi user đó bị xóa, đồng thời tất cả các đơn hàng (orders) liên kết với user đó cũng tự động bị xóa theo.',
          'Câu lệnh bị chặn lại và ném lỗi Foreign Key Violation vì vẫn còn dữ liệu con trong bảng orders.',
          'Tất cả các đơn hàng trong bảng orders sẽ được gán trường userId thành giá trị null.',
          'Hệ thống sẽ tạo một bản sao lưu của các đơn hàng đó sang bảng lưu trữ tạm thời trước khi xóa user.'
        ],
        correctIndex: 0,
        explanation: '`onDelete: Cascade` chỉ định tính năng xóa dây chuyền: khi bản ghi cha bị xóa, toàn bộ bản ghi con phụ thuộc vào khóa ngoại của nó sẽ tự động bị xóa sạch.'
      },
      {
        id: 's3-q19',
        question: 'Tại sao việc sử dụng câu lệnh Raw SQL trong Prisma (`prisma.$queryRaw\`SELECT * FROM users WHERE email = \${email}\``) lại an toàn trước SQL Injection?',
        options: [
          'Vì $queryRaw sử dụng Tagged Template Literals để tự động chuyển các biến truyền vào thành Parameterized Query (tham số hóa $1, $2).',
          'Vì Prisma sẽ tự động xóa bỏ tất cả các ký tự dấu ngoặc kép và dấu chấm phẩy khỏi câu lệnh SQL.',
          'Vì Raw SQL chỉ được phép thực thi trên các bảng dữ liệu thử nghiệm, không áp dụng cho bảng chính.',
          'Vì database PostgreSQL có sẵn trí tuệ nhân tạo để tự động nhận diện và chặn mã độc SQL Injection.'
        ],
        correctIndex: 0,
        explanation: 'Prisma `$queryRaw` tận dụng Tagged Template của JavaScript để bóc tách câu SQL tĩnh và các biến động, chuyển thành Prepared Statements an toàn với tham số hóa ($1, $2) ngăn ngừa 100% SQL Injection.'
      },
      {
        id: 's3-q20',
        question: 'Mục đích của việc sử dụng UUID v7 (Timestamp-based UUID) thay thế cho UUID v4 (Random UUID) làm khóa chính (Primary Key) trong database là gì?',
        options: [
          'UUID v7 được sắp xếp theo thời gian (Time-ordered), giúp tăng hiệu năng ghi vào chỉ mục B-Tree và giảm phân mảnh trang dữ liệu (Page Fragmentation).',
          'UUID v7 có độ dài ngắn hơn UUID v4 một nửa nên tiết kiệm được dung lượng lưu trữ trên ổ đĩa.',
          'UUID v7 chỉ chứa các chữ số từ 0 đến 9 nên dễ nhớ và dễ nhập hơn đối với người dùng.',
          'UUID v7 có thể tự động giải mã ngược lại thành mật khẩu ban đầu của tài khoản người dùng.'
        ],
        correctIndex: 0,
        explanation: 'UUID v4 hoàn toàn ngẫu nhiên khiến việc chèn vào B-Tree Index phải nhảy vị trí liên tục gây phân mảnh page. UUID v7 chứa timestamp ở đầu nên các bản ghi mới luôn được chèn tuần tự vào cuối cây index.'
      }
    ],
    codeChallenge: {
      id: 's3-code',
      title: 'Lab Thực Hành Sprint 3: Idempotent & Atomic Stock Transfer Transaction',
      description: 'Hiện thực hàm `transferInventory(prismaMock, unitId, payload)` chuyển hàng giữa 2 kho an toàn. Hàm phải kiểm tra: 1. `unitId` và `quantity > 0`; 2. Trừ tồn kho nguồn có điều kiện (`quantity >= count`); 3. Cộng tồn kho đích; 4. Ghi nhận `transferLog` có kèm `idempotencyKey`. Nếu trùng key, trả về log cũ mà không thực hiện trừ tiền lại.',
      starterCode: `async function transferInventory(prismaMock, unitId, payload) {
  // TODO: Hiện thực giao dịch chuyển kho an toàn với Multi-Tenant Isolation
  // payload: { fromItemId: string, toItemId: string, quantity: number, idempotencyKey: string }
  // 1. Kiểm tra validation (unitId, fromItemId, toItemId, quantity > 0)
  // 2. Kiểm tra idempotency qua transferLog
  // 3. Thực thi transaction: updateMany conditional decrement, cộng kho đích, tạo transferLog
  // 4. Trả về: { success: true, transferId: string, duplicate: boolean }

}`,
      testCases: [
        {
          input: [
            {
              transferLog: { findUnique: async () => null, create: async ({ data }) => ({ id: 'tf_1', ...data }) },
              item: { updateMany: async () => ({ count: 1 }), update: async () => ({}) },
              $transaction: async (cb) => cb({
                item: { updateMany: async () => ({ count: 1 }), update: async () => ({}) },
                transferLog: { create: async ({ data }) => ({ id: 'tf_1', ...data }) }
              })
            },
            'unit-101',
            { fromItemId: 'item-A', toItemId: 'item-B', quantity: 5, idempotencyKey: 'key-123' }
          ],
          expected: { success: true, transferId: 'tf_1', duplicate: false },
          description: 'Giao dịch chuyển kho hợp lệ phải thành công và ghi log mới'
        },
        {
          input: [
            {
              transferLog: { findUnique: async () => ({ id: 'tf_old', idempotencyKey: 'key-123' }) }
            },
            'unit-101',
            { fromItemId: 'item-A', toItemId: 'item-B', quantity: 5, idempotencyKey: 'key-123' }
          ],
          expected: { success: true, transferId: 'tf_old', duplicate: true },
          description: 'Idempotency Key đã tồn tại phải trả về kết quả cũ và không trừ kho lại'
        }
      ]
    }
  },

  // =========================================================================
  // SPRINT 4: ASYNC PROCESSING, QUEUES & RESILIENCE
  // =========================================================================
  {
    sprintId: 4,
    title: 'Bài Kiểm Tra Sprint 4: Async Processing, Queues & Resilience',
    description: 'Đánh giá chuyên sâu: BullMQ, Redis Queues, Job Idempotency, Exponential Backoff, Dead Letter Queues và Rate Limiting.',
    timeLimitMinutes: 25,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's4-q1',
        question: 'Tại sao việc đẩy tác vụ gửi Email kích hoạt tài khoản hoặc xuất hóa đơn PDF vào Message Queue (BullMQ) lại cải thiện trải nghiệm người dùng?',
        options: [
          'Giải phóng HTTP request ngay lập tức trong vài mili-giây, còn tác vụ nặng được worker xử lý ngầm trong background mà không bắt client chờ.',
          'Tự động tăng dung lượng pin cho thiết bị di động của người dùng khi truy cập vào ứng dụng web.',
          'Giúp email không bao giờ bị rơi vào hòm thư rác (Spam Box) của các nhà cung cấp Gmail/Outlook.',
          'Cho phép gửi email đến người nhận kể cả khi máy chủ backend hoàn toàn không có kết nối Internet.'
        ],
        correctIndex: 0,
        explanation: 'Gửi email/tạo PDF tốn từ 1 đến 5 giây. Nếu chạy đồng bộ trong request, client sẽ bị lag. Đẩy vào Queue giúp trả về HTTP 200/202 ngay lập tức, Worker ở background sẽ tiêu thụ job tuần tự.'
      },
      {
        id: 's4-q2',
        question: 'Thuật toán "Exponential Backoff" (ví dụ: delay = 1000 * 2^attempt) trong cơ chế Retry của BullMQ giải quyết vấn đề gì?',
        options: [
          'Tăng dần khoảng thời gian chờ giữa các lần thử lại để tránh dồn dập tấn công (stampede) làm sập dịch vụ bên ngoài đang gặp sự cố.',
          'Tự động giảm kích thước dung lượng của file đính kèm sau mỗi lần gửi thất bại.',
          'Chuyển đổi các job bị lỗi thành các job chạy song song trên nhiều CPU Core khác nhau.',
          'Tự động đổi mật khẩu API key của dịch vụ bên thứ ba sau mỗi lần nhận mã lỗi HTTP 500.'
        ],
        correctIndex: 0,
        explanation: 'Khi Third-party service (SMS gateway, Payment) bị quá tải, nếu retry liên tục ngay lập tức sẽ khiến dịch vụ càng sập nặng hơn. Exponential Backoff giãn cách lần thử lại (1s, 2s, 4s, 8s, 16s...) cho đối tác thời gian hồi phục.'
      },
      {
        id: 's4-q3',
        question: 'Khái niệm "Job Idempotency" trong xử lý hàng đợi Worker mang ý nghĩa kỹ thuật gì?',
        options: [
          'Đảm bảo rằng nếu một Job bị thực thi lại nhiều lần do lỗi mạng, kết quả cuối cùng đối với hệ thống vẫn chỉ như được thực thi 1 lần duy nhất.',
          'Bắt buộc mỗi Job chỉ được phép chứa tối đa 1 tham số duy nhất dạng chuỗi ký tự trong payload.',
          'Tự động xóa toàn bộ các job trong hàng đợi nếu worker không hoàn thành công việc trong vòng 10 giây.',
          'Chỉ cho phép duy nhất 1 worker được quyền kết nối vào Redis Server tại một thời điểm.'
        ],
        correctIndex: 0,
        explanation: 'Trong mạng phân tán, worker có thể xử lý xong job nhưng bị rớt mạng lúc ack về Redis, khiến Redis coi như job failed và giao cho worker khác chạy lại. Job phải được thiết kế Idempotent (check trạng thái trước khi trừ tiền/tạo đơn).'
      },
      {
        id: 's4-q4',
        question: 'Khi một Job trong BullMQ đã retry vượt quá số lần tối đa (`attempts: 5`) mà vẫn thất bại, số phận của Job đó là gì?',
        options: [
          'Job được chuyển vào trạng thái `failed` (Dead Letter Queue) để kỹ sư có thể kiểm tra log lỗi và kích hoạt retry thủ công khi cần.',
          'Redis sẽ tự động xóa vĩnh viễn Job đó khỏi bộ nhớ mà không để lại bất kỳ dấu vết nào.',
          'Toàn bộ ứng dụng NestJS sẽ tự động tắt nguồn (shutdown) để bảo vệ tính toàn vẹn dữ liệu.',
          'Worker sẽ tiếp tục thử lại vô hạn mỗi giây cho đến khi dịch vụ bên ngoài hoạt động trở lại.'
        ],
        correctIndex: 0,
        explanation: 'Khi cạn lượt retry, BullMQ đánh dấu job vào tập hợp failed (DLQ), emit event `failed` để hệ thống bắn alert (Slack/Telegram) cho kỹ sư trực hệ thống vào phân tích payload và error stack.'
      },
      {
        id: 's4-q5',
        question: 'Tại sao Redis lại là sự lựa chọn phổ biến hàng đầu làm Message Broker cho các thư viện hàng đợi như BullMQ?',
        options: [
          'Vì Redis lưu trữ dữ liệu trong RAM với cấu trúc dữ liệu phong phú (Streams, Sorted Sets, Lists) mang lại độ trễ cực thấp và thông lượng cao.',
          'Vì Redis là cơ sở dữ liệu quan hệ hoàn chỉnh hỗ trợ đầy đủ các câu lệnh SQL JOIN phức tạp.',
          'Vì Redis không yêu cầu máy chủ phải có hệ điều hành Linux hay Docker để hoạt động.',
          'Vì Redis có dung lượng lưu trữ trên ổ đĩa cứng không giới hạn hoàn toàn miễn phí.'
        ],
        correctIndex: 0,
        explanation: 'Redis xử lý in-memory với các lệnh nguyên tử (Atomic Redis commands & Lua scripts), cho phép BullMQ lock job, schedule delayed job (Sorted Sets) và push/pop job với độ trễ dưới 1 mili-giây.'
      },
      {
        id: 's4-q6',
        question: 'Trong NestJS với module `@nestjs/bullmq`, decorator nào được sử dụng để định nghĩa một class chuyên xử lý (consume) các jobs từ hàng đợi?',
        options: [
          '`@Processor("queue-name")` đặt trước class và `@Process()` hoặc `extends WorkerHost` cho hàm xử lý.',
          '`@QueueHandler("queue-name")` đặt trước class và `@InjectQueue()` cho hàm xử lý.',
          '`@Consumer("queue-name")` đặt trước class và `@Listen()` cho hàm xử lý.',
          '`@MessagePattern("queue-name")` đặt trước class và `@EventHandler()` cho hàm xử lý.'
        ],
        correctIndex: 0,
        explanation: 'NestJS BullMQ sử dụng `@Processor("queue-name")` để đánh dấu class WorkerHost xử lý job của queue đó, và hiện thực phương thức `process(job: Job)`.'
      },
      {
        id: 's4-q7',
        question: 'Khi muốn lên lịch một Job thực hiện sau 15 phút nữa (Delayed Job), tùy chọn nào trong BullMQ là chuẩn xác?',
        options: [
          '`await myQueue.add("sendReminder", data, { delay: 15 * 60 * 1000 });`',
          '`await myQueue.add("sendReminder", data, { timeout: 15 * 60 * 1000 });`',
          '`await myQueue.add("sendReminder", data, { backoff: 15 * 60 * 1000 });`',
          '`await myQueue.add("sendReminder", data, { ttl: 15 * 60 * 1000 });`'
        ],
        correctIndex: 0,
        explanation: 'Tùy chọn `delay` (tính bằng mili-giây) đưa job vào trạng thái delayed trong Redis Sorted Set; BullMQ sẽ tự động chuyển sang trạng thái waiting khi thời gian đếm ngược kết thúc.'
      },
      {
        id: 's4-q8',
        question: 'Pattern "Circuit Breaker" trong kiến trúc Microservices được thiết kế nhằm mục đích gì?',
        options: [
          'Tự động ngắt kết nối (Open State) tới một dịch vụ đang bị sự cố liên tục để tránh làm cạn kiệt tài nguyên của hệ thống gọi.',
          'Tăng gấp đôi điện áp của chip xử lý CPU máy chủ khi tải của ứng dụng vượt quá 90%.',
          'Tự động mã hóa toàn bộ dữ liệu đường truyền mạng khi phát hiện có gói tin HTTP lạ.',
          'Xóa toàn bộ các bản ghi tạm thời trong cơ sở dữ liệu khi có lỗi xảy ra ở tầng Controller.'
        ],
        correctIndex: 0,
        explanation: 'Circuit Breaker ngắt luồng gọi tới service đang chết (Fail Fast) mà không cần đợi timeout, sau một khoảng thời gian sẽ cho thử vài request (Half-Open) trước khi đóng mạch bình thường (Closed).'
      },
      {
        id: 's4-q9',
        question: 'Trong BullMQ, tính năng "Job Deduplication" (chống trùng lặp job) được thực hiện thông qua tham số cấu hình nào?',
        options: [
          'Thuộc tính `jobId` trong Job Options — nếu gửi thêm job có cùng `jobId`, BullMQ sẽ từ chối thêm vào hàng đợi.',
          'Thuộc tính `deduplicate: true` trong file cấu hình main.ts của ứng dụng NestJS.',
          'Tự động quét toàn bộ nội dung của payload và xóa nếu phát hiện 100% trường giống nhau.',
          'Bắt buộc client phải gửi kèm chữ ký điện tử RSA trong mỗi request thêm job.'
        ],
        correctIndex: 0,
        explanation: 'Gán `jobId: "send-welcome-" + userId` đảm bảo trong cùng một thời điểm, chỉ có duy nhất 1 job với ID đó tồn tại trong hàng đợi, ngăn ngừa việc gửi 2 email kích hoạt cùng lúc.'
      },
      {
        id: 's4-q10',
        question: 'Khi triển khai Worker xử lý hàng đợi, tại sao việc inject `PrismaService` cần chú ý tới số lượng `concurrency` của worker?',
        options: [
          'Vì mỗi worker thread xử lý đồng thời có thể chiếm 1 kết nối DB, nếu concurrency vượt quá connection_limit sẽ gây nghẽn pool.',
          'Vì Prisma chỉ cho phép duy nhất 1 worker được phép truy vấn dữ liệu tại một thời điểm nhất định.',
          'Vì số lượng concurrency cao sẽ làm cho mã nguồn TypeScript bị biên dịch lại liên tục.',
          'Vì worker không thể sử dụng chung PrismaService với các Controller trong ứng dụng NestJS.'
        ],
        correctIndex: 0,
        explanation: 'Nếu đặt concurrency: 50 trên mỗi worker instance trong khi DB connection pool chỉ có 20 connections, 30 jobs còn lại sẽ phải xếp hàng chờ kết nối DB, dẫn đến timeout lỗi.'
      },
      {
        id: 's4-q11',
        question: 'Sự khác biệt giữa BullMQ "Repeatable Job" (Cron Job) và `setInterval` thông thường là gì?',
        options: [
          'Repeatable Job lưu trạng thái lịch trình trong Redis, đảm bảo chỉ có đúng 1 job được tạo ra trên toàn cụm server (Multi-instance safe).',
          'Repeatable Job chỉ có thể chạy được vào ban đêm khi lưu lượng truy cập của người dùng giảm xuống 0.',
          'setInterval có độ chính xác cao hơn 100 lần so với các tác vụ chạy qua hàng đợi BullMQ.',
          'Repeatable Job bắt buộc phải được kích hoạt thủ công từ giao diện Swagger của người quản trị.'
        ],
        correctIndex: 0,
        explanation: 'Repeatable Jobs của BullMQ sử dụng Redis để phối hợp lịch trình, đảm bảo dù bạn chạy 10 instances của app thì cron job vẫn chỉ chạy chính xác 1 lần theo đúng chu kỳ (Distributed Cron).'
      },
      {
        id: 's4-q12',
        question: 'Trong kiến trúc hàng đợi, khái niệm "Backpressure" (áp lực ngược) xuất hiện khi nào?',
        options: [
          'Khi tốc độ sản xuất (produce) message của hệ thống nhanh hơn nhiều so với tốc độ tiêu thụ (consume) của các worker.',
          'Khi dung lượng của database vượt quá giới hạn cho phép của ổ đĩa cứng máy chủ.',
          'Khi người dùng bấm nút Refresh trình duyệt liên tục nhiều lần trong một giây.',
          'Khi toàn bộ các worker đồng loạt hoàn thành công việc và rơi vào trạng thái rảnh rỗi.'
        ],
        correctIndex: 0,
        explanation: 'Backpressure xảy ra khi hàng đợi bị phình to do Producer đẩy việc quá nhanh trong khi Worker không kịp xử lý. Hệ thống cần cơ chế điều tiết (Rate limit producer, scale thêm worker, hoặc drop bớt job không quan trọng).'
      },
      {
        id: 's4-q13',
        question: 'Khi xử lý một Job dài (ví dụ: import file Excel 100.000 dòng mất 2 phút), worker nên làm gì để báo cáo tiến độ và không bị coi là treo (stalled)?',
        options: [
          'Gọi hàm `await job.updateProgress(percent)` định kỳ để cập nhật % tiến độ cho client theo dõi.',
          'Chạy toàn bộ file Excel trong một câu lệnh SQL duy nhất mà không cần chia nhỏ dữ liệu.',
          'Tắt tính năng kiểm tra lỗi của BullMQ để worker không bị ngắt kết nối giữa chừng.',
          'Gửi email thông báo cho người dùng sau mỗi 10 dòng dữ liệu được import thành công.'
        ],
        correctIndex: 0,
        explanation: 'updateProgress() cập nhật tiến độ (0 - 100%) vào Redis để frontend có thể polling hoặc nhận qua WebSocket, đồng thời gửi tín hiệu heartbeat báo cho BullMQ biết worker vẫn đang hoạt động bình thường.'
      },
      {
        id: 's4-q14',
        question: 'Lệnh `job.remove()` trong BullMQ có tác dụng gì?',
        options: [
          'Xóa bỏ hoàn toàn job khỏi hàng đợi nếu job đó đang ở trạng thái waiting hoặc delayed.',
          'Dừng ngay lập tức tiến trình CPU của máy chủ đang thực thi job đó.',
          'Xóa toàn bộ dữ liệu của người dùng liên quan đến job đó trong cơ sở dữ liệu.',
          'Tự động gửi thông báo lỗi đến email của người tạo ra job đó trong hệ thống.'
        ],
        correctIndex: 0,
        explanation: 'remove() cho phép hủy và xóa một job khỏi hàng đợi nếu nó chưa được worker bốc (đang chờ hoặc đang delayed).'
      },
      {
        id: 's4-q15',
        question: 'Tại sao việc lưu trữ dữ liệu nhị phân lớn (như file ảnh/video dung lượng 50MB) trực tiếp vào payload của Job trong Redis là điều cấm kỵ?',
        options: [
          'Vì nó làm phình to bộ nhớ RAM của Redis, làm chậm tốc độ truyền mạng và giảm nghiêm trọng thông lượng của hàng đợi.',
          'Vì Redis chỉ hỗ trợ lưu trữ các chuỗi ký tự có độ dài tối đa không quá 256 ký tự.',
          'Vì các file nhị phân sẽ tự động bị xóa khỏi Redis sau khi server hoạt động được 1 giờ.',
          'Vì thư viện BullMQ không cho phép giải mã các file nhị phân sang định dạng JSON.'
        ],
        correctIndex: 0,
        explanation: 'Redis là bộ nhớ RAM đắt đỏ. Payload của job chỉ nên chứa metadata (fileId, s3Url, userId). File thực tế phải được lưu trên Cloud Storage (S3, MinIO) và worker chỉ cần đọc URL để tải về xử lý.'
      },
      {
        id: 's4-q16',
        question: 'Trong kiến trúc Event-Driven với NestJS EventEmitter (`@nestjs/event-emitter`), sự khác biệt giữa Event nội bộ và Message Queue là gì?',
        options: [
          'EventEmitter chạy in-memory trong cùng 1 process (nếu app crash sẽ mất event), còn Queue lưu trên Redis độc lập (bền vững và scale được).',
          'EventEmitter có thể truyền tin nhắn qua Internet tới các máy chủ khác, còn Queue chỉ chạy được trên máy local.',
          'EventEmitter bắt buộc phải có chứng chỉ bảo mật SSL, còn Queue không cần bảo mật.',
          'Queue không hỗ trợ việc truyền dữ liệu dạng object giữa các hàm trong cùng một ứng dụng.'
        ],
        correctIndex: 0,
        explanation: 'EventEmitter phù hợp cho các tác vụ phụ nhẹ trong cùng 1 server instance. Khi cần độ tin cậy cao (không mất việc khi restart), retry tự động, hoặc phân tải sang nhiều máy chủ worker khác, bắt buộc phải dùng Queue (BullMQ).'
      },
      {
        id: 's4-q17',
        question: 'Khi cấu hình `removeOnComplete: true` và `removeOnFail: 1000` trong BullMQ Job Options, mục đích là gì?',
        options: [
          'Tự động dọn dẹp các job thành công để tiết kiệm RAM, và giữ lại tối đa 1000 job lỗi gần nhất để phục vụ debug.',
          'Tự động xóa toàn bộ cơ sở dữ liệu sau khi hoàn thành 1000 công việc đầu tiên.',
          'Giới hạn số lượng người dùng có thể đăng ký tài khoản mới trong một ngày tối đa là 1000 người.',
          'Bắt buộc worker phải hoàn thành công việc trong thời gian tối đa là 1000 mili-giây.'
        ],
        correctIndex: 0,
        explanation: 'Nếu không cấu hình dọn dẹp, hàng triệu job completed sẽ nằm lại mãi mãi trong Redis gây tràn RAM (OOM). Giữ lại số lượng cố định các failed job giúp kỹ sư có dữ liệu điều tra mà không lo quá tải bộ nhớ.'
      },
      {
        id: 's4-q18',
        question: 'Khi triển khai Rate Limiter phân tán (Distributed Rate Limiting) cho hệ thống có nhiều instance, giải pháp nào là chuẩn xác?',
        options: [
          'Sử dụng Redis kết hợp thuật toán Sliding Window hoặc Token Bucket để chia sẻ bộ đếm giữa mọi instance.',
          'Lưu số lượng request vào một biến toàn cục trong bộ nhớ RAM của từng server riêng biệt.',
          'Tạo một bảng cơ sở dữ liệu trong PostgreSQL và thực hiện câu lệnh SELECT COUNT(*) ở mỗi request.',
          'Yêu cầu trình duyệt frontend tự đếm số lần bấm nút và tự khóa giao diện nếu bấm quá nhanh.'
        ],
        correctIndex: 0,
        explanation: 'Biến in-memory chỉ có tác dụng trên từng server riêng lẻ (vào server khác sẽ bị reset). Dùng Redis làm bộ đếm tập trung giúp mọi server cùng kiểm tra và thực thi chung một hạn mức Rate Limit.'
      },
      {
        id: 's4-q19',
        question: 'Trong NestJS, decorator `@OnWorkerEvent("completed")` hoặc `@OnQueueEvent("failed")` dùng để làm gì?',
        options: [
          'Lắng nghe các sự kiện vòng đời của job để ghi log, cập nhật trạng thái đơn hàng hoặc gửi thông báo cho người dùng.',
          'Tự động khởi động lại máy chủ mỗi khi có một công việc xử lý xong trong hàng đợi.',
          'Ngăn không cho worker nhận thêm các công việc mới từ hàng đợi trong vòng 5 phút.',
          'Xóa toàn bộ các file đính kèm trong thư mục tạm sau khi công việc hoàn tất.'
        ],
        correctIndex: 0,
        explanation: 'Queue Events cho phép hệ thống hook vào các thời điểm quan trọng (job active, completed, failed, progress) để cập nhật trạng thái vào DB hoặc bắn socket thông báo cho frontend.'
      },
      {
        id: 's4-q20',
        question: 'Kỹ thuật "Graceful Worker Shutdown" trong hệ thống Queue đảm bảo điều gì khi deploy phiên bản mới?',
        options: [
          'Worker ngừng nhận job mới từ Redis, đợi các job đang xử lý dở dang hoàn thành xong xuôi rồi mới tắt tiến trình.',
          'Tự động hủy bỏ và xóa sạch toàn bộ các job đang chạy dở dang để deploy ứng dụng nhanh nhất có thể.',
          'Chuyển toàn bộ các job trong hàng đợi sang trạng thái hoàn thành ảo để không bị báo lỗi.',
          'Gửi email xin lỗi toàn bộ người dùng vì hệ thống phải tạm dừng dịch vụ trong 1 phút.'
        ],
        correctIndex: 0,
        explanation: 'Khi restart/deploy, Worker lắng nghe SIGTERM, ngừng fetch job mới, chờ các job đang chạy hoàn tất (trong giới hạn timeout) và đóng kết nối Redis an toàn, tránh tình trạng job bị đứt gãy nửa chừng.'
      }
    ],
    codeChallenge: {
      id: 's4-code',
      title: 'Lab Thực Hành Sprint 4: Robust Exponential Backoff & Retry Pipeline',
      description: 'Hiện thực hàm `executeJobWithRetry(jobFn, maxRetries, baseDelayMs, maxDelayMs)` thực thi một async task. Nếu gặp lỗi, tính toán delay theo Exponential Backoff (`delay = min(maxDelayMs, baseDelayMs * 2^(attempt - 1))`) và thử lại. Nếu vượt quá `maxRetries`, ném lỗi cuối cùng nhận được.',
      starterCode: `async function executeJobWithRetry(jobFn, maxRetries = 3, baseDelayMs = 100, maxDelayMs = 1000) {
  // TODO: Hiện thực thuật toán Exponential Backoff Retry
  // 1. Thực thi jobFn(attempt), lặp từ attempt = 1 đến maxRetries
  // 2. Nếu thành công: trả về { success: true, data: result, attempts: attempt }
  // 3. Nếu thất bại và chưa hết lượt: delay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
  // 4. Nếu hết lượt retry: ném lỗi Error('Job failed after ...')

}`,
      testCases: [
        {
          input: [
            async (attempt) => {
              if (attempt < 2) throw new Error('Transient Network Flake');
              return 'OK_DATA';
            },
            3,
            10,
            50
          ],
          expected: { success: true, data: 'OK_DATA', attempts: 2 },
          description: 'Job bị lỗi lần 1 nhưng thành công ở lần 2 phải trả về kết quả và số lần thử = 2'
        },
        {
          input: [
            async () => 'INSTANT_SUCCESS',
            3,
            10,
            50
          ],
          expected: { success: true, data: 'INSTANT_SUCCESS', attempts: 1 },
          description: 'Job thành công ngay lần đầu không được delay và có số lần thử = 1'
        }
      ]
    }
  },

  // =========================================================================
  // SPRINT 5: MULTI-SURFACE, TENANT ISOLATION & CAPSTONE
  // =========================================================================
  {
    sprintId: 5,
    title: 'Bài Kiểm Tra Sprint 5: Multi-Surface Architecture, Tenant Isolation & Capstone',
    description: 'Khảo thí chuyên sâu: Phân vùng API Surface (/api/i/v1, /api/i/admin/v1, /api/p/v1), Data Scoping (Group → Unit → Branch) và RBAC/PBAC.',
    timeLimitMinutes: 30,
    passingScore: 80,
    questionCountToPick: 10,
    questions: [
      {
        id: 's5-q1',
        question: 'Trong kiến trúc Multi-Surface của eSmiles, tiền tố URL `/api/p/v1/...` được quy hoạch dành riêng cho đối tượng người dùng nào?',
        options: [
          'Bệnh nhân và khách hàng công cộng truy cập qua Patient Portal hoặc Mobile App.',
          'Bác sĩ và y tá nội bộ thao tác các nghiệp vụ điều trị tại phòng khám chi nhánh.',
          'Quản trị viên cấp cao của tập đoàn nha khoa (Platform Super Admin).',
          'Các kỹ sư DevOps kiểm tra trạng thái sức khỏe máy chủ (Health Check).'
        ],
        correctIndex: 0,
        explanation: 'Chuẩn phân vùng eSmiles: `/api/p/v1` = Patient / Public Portal; `/api/i/v1` = Internal Clinic Staff / Doctor; `/api/i/admin/v1` = Platform Admin.'
      },
      {
        id: 's5-q2',
        question: 'Mô hình phân cấp quản trị đa chi nhánh trong hệ sinh thái eSmiles tuân theo thứ tự phân tầng nào?',
        options: [
          'Tập đoàn / Chuỗi nha khoa (`Group`) → Chi nhánh độc lập (`Unit`) → Ghế khám / Phòng ban nội bộ (`Branch/Chair`).',
          'Chi nhánh độc lập (`Unit`) → Tập đoàn (`Group`) → Khách hàng cá nhân (`Patient`).',
          'Ghế khám (`Chair`) → Bác sĩ trưởng (`Doctor`) → Phòng khám (`Clinic`) → Tập đoàn (`Group`).',
          'Bộ Y Tế (`Government`) → Bệnh viện (`Hospital`) → Bác sĩ (`Doctor`) → Bệnh nhân (`Patient`).'
        ],
        correctIndex: 0,
        explanation: 'Cấu trúc Tenant của eSmiles: Group (Chuỗi nha khoa nắm bản quyền) quản lý nhiều Unit (Phòng khám chi nhánh với database/kho riêng), trong Unit có các Branch/Chair (ghế điều trị).'
      },
      {
        id: 's5-q3',
        question: 'Khi một Bác sĩ thuộc Chi nhánh A gửi request cập nhật hồ sơ bệnh án có `patientId` thuộc Chi nhánh B, hệ thống Tenant Guard phải phản ứng thế nào?',
        options: [
          'Chặn đứng request và trả về lỗi 403 Forbidden hoặc 404 Not Found để ngăn chặn việc xem/sửa dữ liệu chéo chi nhánh.',
          'Tự động chuyển quyền sở hữu của bệnh nhân đó từ Chi nhánh B sang Chi nhánh A.',
          'Gửi thông báo email cho Giám đốc chi nhánh B xin phép rồi mới thực hiện câu lệnh update.',
          'Chấp nhận request nếu Bác sĩ đó có chức danh là Trưởng khoa hoặc Giáo sư y khoa.'
        ],
        correctIndex: 0,
        explanation: 'Tenant Isolation bắt buộc mọi truy vấn phải scoped theo `unitId`. Bác sĩ chi nhánh A không bao giờ được phép thao tác trên dữ liệu của chi nhánh B, bảo đảm tuân thủ luật bảo mật dữ liệu y tế (HIPAA/GDPR).'
      },
      {
        id: 's5-q4',
        question: 'Khái niệm "Single ID Account" trong hệ thống eSmiles mang lại tính năng gì cho nhân sự?',
        options: [
          'Một tài khoản đăng nhập duy nhất (`Account`) có thể được gán các vai trò và quyền hạn khác nhau ở nhiều chi nhánh (`UnitUserMapping`).',
          'Mỗi nhân viên bắt buộc phải tạo một địa chỉ email và mật khẩu mới cho mỗi chi nhánh mà họ làm việc.',
          'Tất cả nhân viên trong cùng một phòng khám đều dùng chung một tài khoản đăng nhập admin.',
          'Tự động đăng nhập vào hệ thống bằng vân tay hoặc nhận diện khuôn mặt mà không cần mật khẩu.'
        ],
        correctIndex: 0,
        explanation: 'Single ID cho phép 1 bác sĩ (1 Account) làm việc tại nhiều phòng khám khác nhau. Khi đổi chi nhánh trên giao diện, token/session sẽ chuyển ngữ cảnh (Context Switching) sang Unit tương ứng với đúng Role của chi nhánh đó.'
      },
      {
        id: 's5-q5',
        question: 'Khi xây dựng API cho Patient Portal (`/api/p/v1/appointments`), tại sao không được dùng trực tiếp DTO của Internal API (`/api/i/v1/appointments`)?',
        options: [
          'Vì Internal DTO có thể chứa các trường nhạy cảm nội bộ (như giá vốn vật tư, ghi chú riêng của bác sĩ) không được phép lộ cho bệnh nhân.',
          'Vì Patient Portal bắt buộc phải sử dụng giao thức GraphQL thay vì REST API.',
          'Vì TypeScript không cho phép hai file Controller khác nhau cùng import chung một file DTO.',
          'Vì bệnh nhân không có trình duyệt hỗ trợ việc giải mã các trường dữ liệu kiểu JSON.'
        ],
        correctIndex: 0,
        explanation: 'Multi-surface yêu cầu tách biệt Surface DTOs: Patient Surface chỉ nhìn thấy các thông tin công khai (ngày hẹn, tên bác sĩ), tránh rò rỉ dữ liệu tài chính/nội bộ phòng khám.'
      },
      {
        id: 's5-q6',
        question: 'Trong cơ chế phân quyền RBAC (Role-Based Access Control) kết hợp PBAC (Permission-Based), điều nào sau đây là chuẩn thiết kế?',
        options: [
          'Gán quyền chi tiết (`Permission: inventory.item:create`) cho từng `Role`, và Controller chỉ kiểm tra Permission thay vì hardcode tên Role.',
          'Viết cứng điều kiện `if (user.role === "admin")` trong toàn bộ các hàm của tầng Service.',
          'Cho phép bất kỳ người dùng nào đã đăng nhập đều có toàn quyền xóa dữ liệu trong hệ thống.',
          'Chỉ phân quyền dựa trên địa chỉ IP của máy tính mà nhân viên đang sử dụng tại phòng khám.'
        ],
        correctIndex: 0,
        explanation: 'Kiểm tra Permission (`can("inventory.item:update")`) giúp hệ thống linh hoạt tùy biến quyền hạn cho các vai trò mới mà không cần sửa lại code backend, tránh việc hardcode role name khắp nơi.'
      },
      {
        id: 's5-q7',
        question: 'Decorator `@RequirePermissions("patients:read", "patients:write")` kết hợp với `PermissionsGuard` hoạt động dựa trên cơ chế nào?',
        options: [
          'Đọc metadata gắn trên route qua `Reflector`, so sánh với mảng permissions trong token/session của user để quyết định cho phép hay chặn.',
          'Tự động gửi câu lệnh SQL kiểm tra quyền vào bảng Users ở mỗi request HTTP gửi lên.',
          'Mã hóa toàn bộ các tham số của hàm Controller bằng mã khóa của người quản trị.',
          'Tự động cấp toàn bộ quyền cho người dùng nếu người dùng đó đăng nhập bằng tài khoản Google.'
        ],
        correctIndex: 0,
        explanation: 'Custom decorator dùng `SetMetadata` để lưu permissions yêu cầu, Guard sử dụng `Reflector` lấy metadata đó ra và đối chiếu với danh sách quyền hạn đã nạp sẵn trong `req.user.permissions`.'
      },
      {
        id: 's5-q8',
        question: 'Trong quy trình khám chữa bệnh tại phòng khám nha khoa eSmiles, khi một `TreatmentOption` đã được khách hàng chốt và ký duyệt (`isLocked = true`), hành vi đúng của backend là gì?',
        options: [
          'Khóa cứng không cho phép chỉnh sửa danh mục thủ thuật/đơn giá của phương án đó nữa; nếu muốn đổi phải tạo phương án mới.',
          'Cho phép lễ tân thoải mái chỉnh sửa lại giá tiền bất kỳ lúc nào mà không cần ghi log audit.',
          'Tự động xóa toàn bộ các phương án điều trị khác của bệnh nhân đó khỏi cơ sở dữ liệu.',
          'Tự động gửi hóa đơn thanh toán toàn bộ chi phí điều trị sang cổng thanh toán ngân hàng.'
        ],
        correctIndex: 0,
        explanation: 'Tính bất biến (Immutability): Kế hoạch điều trị đã chốt với khách hàng (`isLocked = true`) mang giá trị pháp lý và tài chính, backend phải chặn mọi thao tác UPDATE/DELETE để đảm bảo tính minh bạch y khoa.'
      },
      {
        id: 's5-q9',
        question: 'Tại sao việc lưu trữ log kiểm toán (Audit Log) cho các hành động nhạy cảm (như xem bệnh án, xóa hồ sơ bệnh nhân) là bắt buộc trong phần mềm y tế?',
        options: [
          'Để ghi nhận chính xác ai đã làm gì, vào thời điểm nào, trên bản ghi nào, phục vụ công tác thanh tra và truy vết trách nhiệm pháp lý.',
          'Để tự động tính toán tiền hoa hồng cho nhân viên bán hàng vào cuối mỗi tháng.',
          'Để tăng tốc độ load dữ liệu của trang danh sách bệnh nhân trên giao diện web.',
          'Để giảm bớt dung lượng lưu trữ của các bảng dữ liệu chính trong PostgreSQL.'
        ],
        correctIndex: 0,
        explanation: 'Quy chuẩn phần mềm y tế (Medical Record Compliance) bắt buộc lưu vết Audit Log bất biến (Immutable Audit Trail) cho mọi thao tác đọc/sửa/xóa dữ liệu nhạy cảm của bệnh nhân.'
      },
      {
        id: 's5-q10',
        question: 'Trong thiết kế API Đa ngôn ngữ (i18n), cách lưu trữ các trường bản dịch (như tên dịch vụ, mô tả gói khám) chuẩn trong database là gì?',
        options: [
          'Lưu dạng cấu trúc JSON (ví dụ: `{ vi: "Niềng răng", en: "Invisalign" }`) hoặc bảng quan hệ translations riêng biệt.',
          'Tạo 10 cột khác nhau trên cùng một bảng (name_vi, name_en, name_fr, name_jp, name_kr...).',
          'Bắt buộc client frontend phải tự dịch tự động bằng Google Translate API trước khi hiển thị.',
          'Chỉ lưu duy nhất một ngôn ngữ tiếng Anh và cấm sử dụng các ngôn ngữ khác trong hệ thống.'
        ],
        correctIndex: 0,
        explanation: 'Lưu JSON đa ngữ `{ vi: "...", en: "..." }` hoặc bảng dịch `ServiceTranslation` cho phép mở rộng thêm ngôn ngữ mới linh hoạt mà không cần phải thay đổi cấu trúc bảng (ALTER TABLE).'
      },
      {
        id: 's5-q11',
        question: 'Khi triển khai cơ chế Phân vùng dữ liệu (Data Isolation) ở cấp độ Controller, cách làm nào là an toàn nhất?',
        options: [
          'Trích xuất `unitId` từ JWT Token của người dùng đã xác thực, không bao giờ tin tưởng `unitId` do client tự gửi lên trong body/query.',
          'Cho phép client tự truyền `unitId` bất kỳ trong request body để server dễ dàng xử lý.',
          'Lấy `unitId` từ địa chỉ IP của người dùng thông qua dịch vụ định vị địa lý GeoIP.',
          'Mặc định gán toàn bộ request về chi nhánh trung tâm nếu không có tham số unitId.'
        ],
        correctIndex: 0,
        explanation: 'Nguyên tắc Zero Trust: Client có thể can thiệp payload. `unitId` bắt buộc phải được giải mã từ chữ ký số của JWT Token do server cấp sau khi đăng nhập thành công.'
      },
      {
        id: 's5-q12',
        question: 'Trong mô hình NestJS, "Interceptor Transformation" thường được áp dụng ở tầng API Response để làm gì?',
        options: [
          'Chuẩn hóa toàn bộ cấu trúc phản hồi của mọi API về một định dạng thống nhất: `{ success: true, data: ..., meta: ... }`.',
          'Tự động xóa bỏ toàn bộ các trường dữ liệu có giá trị là số chẵn trong JSON response.',
          'Nén toàn bộ file ảnh trong response thành file nén .zip trước khi gửi về cho trình duyệt.',
          'Tự động gửi một bản sao của response tới email của quản trị viên hệ thống.'
        ],
        correctIndex: 0,
        explanation: 'TransformInterceptor bọc dữ liệu trả về theo format chuẩn chung của nền tảng (`{ success: true, statusCode: 200, data, timestamp }`), giúp frontend dễ dàng xử lý đồng bộ ở mọi màn hình.'
      },
      {
        id: 's5-q13',
        question: 'Khi triển khai API Export báo cáo doanh thu ra file Excel dung lượng lớn (100.000 dòng), kiến trúc nào là tối ưu nhất?',
        options: [
          'Tạo một background job xuất file, lưu file vào Cloud Storage và gửi thông báo kèm đường link tải về cho người dùng khi hoàn tất.',
          'Xử lý trực tiếp trên HTTP request của Controller và trả về file buffer đồng bộ cho trình duyệt tải về.',
          'Gửi toàn bộ 100.000 dòng dữ liệu thô về cho frontend React tự render và tự xuất file bằng thư viện xlsx trên trình duyệt.',
          'Chia nhỏ dữ liệu thành 1.000 file nhỏ và yêu cầu người dùng tải lần lượt từng file một.'
        ],
        correctIndex: 0,
        explanation: 'Export dữ liệu lớn tốn nhiều CPU và thời gian. Chạy trên HTTP request dễ bị timeout (30s của Cloudflare/Load Balancer). Cần chuyển sang Async Job + S3 Presigned URL download.'
      },
      {
        id: 's5-q14',
        question: 'Trong kiến trúc Clean Architecture / Hexagonal, tầng Domain Entity có đặc điểm gì quan trọng?',
        options: [
          'Chứa các quy tắc nghiệp vụ cốt lõi (Business Rules), hoàn toàn độc lập và không phụ thuộc vào framework (NestJS) hay database (Prisma).',
          'Chứa toàn bộ các câu lệnh truy vấn SQL thô và cấu hình kết nối tới cơ sở dữ liệu PostgreSQL.',
          'Chứa các decorator của Swagger OpenAPI để sinh tài liệu giao tiếp cho lập trình viên frontend.',
          'Chịu trách nhiệm định tuyến các gói tin HTTP từ mạng Internet vào các Controller tương ứng.'
        ],
        correctIndex: 0,
        explanation: 'Domain Layer là trung tâm của ứng dụng, chứa các thực thể và quy tắc nghiệp vụ thuần túy TypeScript, không bị dính chặt vào bất kỳ thư viện bên ngoài hay cơ sở dữ liệu nào.'
      },
      {
        id: 's5-q15',
        question: 'Khi một bệnh nhân đặt lịch hẹn khám trên Patient Portal (`POST /api/p/v1/appointments`), luồng xử lý chuẩn của hệ thống là gì?',
        options: [
          'Kiểm tra tính khả dụng của ghế khám/bác sĩ, tạo lịch hẹn ở trạng thái `PENDING`, gửi event thông báo cho lễ tân chi nhánh duyệt.',
          'Tự động xác nhận lịch hẹn và trừ tiền trong thẻ tín dụng của bệnh nhân mà không cần kiểm tra lịch bác sĩ.',
          'Tạo tài khoản bác sĩ mới cho bệnh nhân đó và cấp toàn quyền truy cập vào hệ thống nội bộ.',
          'Gửi thông báo tới toàn bộ các bệnh nhân khác trong phòng khám biết khung giờ đó đã có người đặt.'
        ],
        correctIndex: 0,
        explanation: 'Quy trình đặt khám: Validate khung giờ trống (không trùng slot ghế/bác sĩ) → Tạo bản ghi PENDING → Bắn Event/Notification cho lễ tân phòng khám xác nhận.'
      },
      {
        id: 's5-q16',
        question: 'Decorator `@PlatformAdminController("tenants")` trong eSmiles Framework tự động áp dụng những cấu hình nào?',
        options: [
          'Gán tiền tố đường dẫn `/api/i/admin/v1/tenants` và áp dụng `PlatformAdminGuard` kiểm tra quyền Super Admin tối cao.',
          'Cho phép bất kỳ người dùng công cộng nào trên mạng Internet đều có thể xem danh sách các chi nhánh.',
          'Tự động chuyển toàn bộ cơ sở dữ liệu sang chế độ chỉ đọc (Read-Only) để bảo vệ an toàn.',
          'Tự động tăng gấp đôi dung lượng bộ nhớ RAM của server mỗi khi route này được gọi.'
        ],
        correctIndex: 0,
        explanation: 'Custom Controller Decorator của eSmiles tự động đóng gói tiền tố URL chuẩn (`/api/i/admin/v1`) và gắn sẵn các Guard bảo mật đặc thù cho phân vùng quản trị nền tảng.'
      },
      {
        id: 's5-q17',
        question: 'Tại sao việc sử dụng UUID v4 ngẫu nhiên cho các mã số hiển thị người dùng (như Mã Bệnh Nhân, Mã Hóa Đơn) lại bị coi là UX kém?',
        options: [
          'Vì chuỗi UUID quá dài và khó đọc/ghi nhớ đối với nhân viên và khách hàng; nên dùng mã nghiệp vụ thân thiện (ví dụ: `BN-2026-08123`).',
          'Vì UUID không thể lưu trữ được trong các cơ sở dữ liệu quan hệ như PostgreSQL.',
          'Vì trình duyệt web sẽ tự động chuyển đổi chuỗi UUID thành số âm khi hiển thị lên màn hình.',
          'Vì việc in chuỗi UUID lên hóa đơn giấy sẽ tốn nhiều mực in hơn bình thường.'
        ],
        correctIndex: 0,
        explanation: 'Khách hàng và lễ tân cần đọc mã số qua điện thoại hoặc in trên thẻ khám (`BN-2608-0012`). UUID chỉ dùng làm khóa chính nội bộ (Internal PK), mã hiển thị cần có định dạng thân thiện và có ý nghĩa.'
      },
      {
        id: 's5-q18',
        question: 'Trong NestJS, mục đích của việc kết hợp `SwaggerModule` với các DTO có gắn `@ApiProperty()` là gì?',
        options: [
          'Tự động sinh tài liệu API tương tác (OpenAPI Specification) giúp Frontend nắm bắt chính xác request/response schema mà không cần hỏi Backend.',
          'Tự động viết code Unit Test cho toàn bộ các hàm xử lý bên trong Controller và Service.',
          'Mã hóa toàn bộ các gói tin API truyền giữa Frontend và Backend bằng thuật toán HTTPS.',
          'Tự động tăng tốc độ xử lý của các câu lệnh truy vấn cơ sở dữ liệu lên gấp hai lần.'
        ],
        correctIndex: 0,
        explanation: 'SwaggerModule tự động đọc Type và decorator `@ApiProperty()` trên DTO để render giao diện Swagger UI tương tác, là cầu nối giao tiếp chuẩn mực giữa Backend và Frontend.'
      },
      {
        id: 's5-q19',
        question: 'Khi triển khai cơ chế Health Check (`/api/v1/health`) với `@nestjs/terminus`, hệ thống cần kiểm tra những thành phần nào?',
        options: [
          'Trạng thái kết nối sống còn của Database PostgreSQL, Redis Cache, Message Queue và dung lượng ổ đĩa/RAM khả dụng.',
          'Kiểm tra xem toàn bộ nhân viên phòng khám đã chấm công buổi sáng đầy đủ hay chưa.',
          'Kiểm tra tốc độ gõ bàn phím trung bình của các lập trình viên trong nhóm phát triển.',
          'Tự động gửi email chúc mừng sinh nhật cho các bệnh nhân có ngày sinh nhật trong ngày.'
        ],
        correctIndex: 0,
        explanation: 'Health Check (Liveness/Readiness Probe) cho Kubernetes/Load Balancer biết dịch vụ có khỏe mạnh hay không bằng cách ping DB, Redis, Disk Space và Memory Heap.'
      },
      {
        id: 's5-q20',
        question: 'Nguyên tắc vàng "Defense in Depth" (Phòng thủ theo chiều sâu) trong ứng dụng Backend thể hiện như thế nào?',
        options: [
          'Áp dụng bảo mật ở mọi tầng: Network (CORS/RateLimit) → Gateway (AuthGuard) → Controller (ValidationPipe) → Service (Tenant Scope) → DB (Constraints).',
          'Chỉ cần dựa vào duy nhất một lớp bảo vệ Firewall bên ngoài máy chủ là đủ an toàn 100%.',
          'Khóa toàn bộ mã nguồn của dự án bằng mật khẩu phức tạp và không cho ai đọc code.',
          'Tắt toàn bộ các cổng kết nối mạng của máy chủ và chỉ cho phép truy cập qua bàn phím trực tiếp.'
        ],
        correctIndex: 0,
        explanation: 'Phòng thủ nhiều lớp đảm bảo nếu kẻ tấn công vượt qua được tầng này (ví dụ bypass được pipe), các tầng sau (Tenant Guard, Service Business Rules, DB Unique Constraint) vẫn chặn đứng nguy cơ rò rỉ hoặc phá hoại dữ liệu.'
      }
    ],
    codeChallenge: {
      id: 's5-code',
      title: 'Lab Thực Hành Sprint 5: Multi-Surface Tenant Guard & Context Dispatcher',
      description: 'Hiện thực hàm `dispatchMultiSurfaceRequest(req, userContext)` phân luồng request theo chuẩn kiến trúc eSmiles. Quy tắc: 1. Nếu route `/api/p/v1/*` -> Bệnh nhân/Public; 2. Nếu `/api/i/admin/v1/*` -> Bắt buộc `userContext.role === "admin"`; 3. Nếu `/api/i/v1/*` -> Bắt buộc `userContext.unitId` khớp với header `x-unit-id`. Trả về `{ authorized: true, surface, tenantId }` hoặc ném lỗi tương ứng.',
      starterCode: `function dispatchMultiSurfaceRequest(req, userContext) {
  // TODO: Hiện thực Gateway Router phân luồng theo client surface & role
  // 1. Nếu route /api/p/v1/* -> surface: 'patient', tenantId: x-unit-id || 'public'
  // 2. Nếu /api/i/admin/v1/* -> yêu cầu role admin, surface: 'platform_admin', tenantId: 'global'
  // 3. Nếu /api/i/v1/* -> yêu cầu unitId khớp x-unit-id, surface: 'internal_clinic', tenantId: x-unit-id
  // 4. Trả về { authorized: true, surface, tenantId } hoặc ném lỗi Error

}`,
      testCases: [
        {
          input: [
            { path: '/api/p/v1/appointments', headers: { 'x-unit-id': 'unit-1' } },
            null
          ],
          expected: { authorized: true, surface: 'patient', tenantId: 'unit-1' },
          description: 'Patient Surface cho phép truy cập mà không yêu cầu userContext nội bộ'
        },
        {
          input: [
            { path: '/api/i/admin/v1/tenants', headers: {} },
            { id: 'u1', role: 'admin' }
          ],
          expected: { authorized: true, surface: 'platform_admin', tenantId: 'global' },
          description: 'Platform Admin Surface cho phép tài khoản có role admin truy cập'
        },
        {
          input: [
            { path: '/api/i/v1/patients', headers: { 'x-unit-id': 'unit-hcm' } },
            { id: 'u2', role: 'doctor', unitId: 'unit-hcm' }
          ],
          expected: { authorized: true, surface: 'internal_clinic', tenantId: 'unit-hcm' },
          description: 'Internal Surface cho phép bác sĩ truy cập đúng chi nhánh unitId của mình'
        }
      ]
    }
  }
];
