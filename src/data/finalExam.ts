import type { QuizQuestion, CodeChallenge } from './curriculum.ts';

export interface FinalExam {
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questionCountToPick: number; // Bốc ngẫu nhiên 15 câu từ ngân hàng 30 câu
  questions: QuizQuestion[];
  codeChallenges: CodeChallenge[];
}

export const FINAL_EXAM: FinalExam = {
  title: 'Khảo Thí Tốt Nghiệp: Master NestJS 11, Prisma 7 & High-Concurrency Systems',
  description: 'Đánh giá toàn diện năng lực Kỹ sư Backend thực chiến: Dependency Injection, Request Lifecycle, Prisma Concurrency, Multi-tenancy Scoping, Async Queues và Resilience.',
  timeLimitMinutes: 45,
  passingScore: 80,
  questionCountToPick: 15,
  questions: [
    {
      id: 'final-q1',
      question: 'Một Singleton Service gán `this.activeUnitId = req.user.unitId` rồi thực hiện `await prisma.patient.findMany(...)`. Hậu quả thực tế xảy ra khi có 100 request đồng thời là gì?',
      options: [
        'Dữ liệu `activeUnitId` bị ghi đè chéo giữa các request, dẫn đến câu query chạy dưới `unitId` của người dùng khác gây rò rỉ dữ liệu.',
        'TypeScript compiler sẽ tự động phát hiện và chặn quá trình khởi động server ngay tại bước bootstrap IoC Container.',
        'Prisma Client sẽ tự động tạo một vùng nhớ RAM độc lập cho mỗi câu query nên không có nguy cơ rò rỉ dữ liệu.',
        'Server sẽ tự động chuyển các request đó vào hàng đợi Redis để thực thi tuần tự từng người một.'
      ],
      correctIndex: 0,
      explanation: 'Node.js đơn luồng nhưng xử lý đồng thời qua Event Loop. Khi hàm await, luồng chính chuyển sang phục vụ request khác ghi đè lên `this.activeUnitId`. Khi request đầu resume, nó sẽ dùng giá trị bị ghi đè. Scope data bắt buộc phải truyền qua function arguments.'
    },
    {
      id: 'final-q2',
      question: 'Khi thực hiện cập nhật danh mục vật tư chỉ thuộc quyền sở hữu của một `unitId`, câu lệnh mutation nào sau đây vừa bảo vệ Tenant Scope vừa không làm lộ sự tồn tại của ID ở chi nhánh khác?',
      options: [
        '`prisma.category.updateMany({ where: { id, unitId }, data })` và trả về mã lỗi 404 Not Found chung nếu `count === 0`.',
        '`prisma.category.findUnique({ where: { id } })` rồi kiểm tra nếu khác `unitId` thì ném lỗi 403 Forbidden.',
        '`prisma.category.update({ where: { id }, data })` rồi sau khi update xong mới kiểm tra `unitId` trong response.',
        'Tin tưởng hoàn toàn vào header `x-unit-id` do client tự gửi lên trong request mà không đối chiếu token.'
      ],
      correctIndex: 0,
      explanation: 'Dùng updateMany với `{ id, unitId }`. Nếu count === 0, trả về 404 Not Found chung chung. Cách này ngăn chặn kẻ xấu thăm dò (ID Enumeration Attack) để biết được ID đó có tồn tại ở chi nhánh của người khác hay không.'
    },
    {
      id: 'final-q3',
      question: 'Sau khi Backend cấp Presigned Upload URL cho Frontend tải file X-Quang trực tiếp lên S3/MinIO, bước nào sau đây là bắt buộc trước khi gắn file vào Hồ Sơ Bệnh Án?',
      options: [
        'Backend xác thực kích thước file, định dạng MIME thực tế, áp dụng quota dung lượng chi nhánh và gán key bất biến.',
        'Frontend gửi toàn bộ file nhị phân đó lên backend NestJS thêm một lần nữa để lưu vào thư mục /tmp.',
        'Lưu trực tiếp đường link tạm thời vào database mà không cần kiểm tra xem file đã thực sự được tải lên hay chưa.',
        'Tự động gửi email đính kèm file ảnh X-Quang đó tới toàn bộ các bác sĩ trong phòng khám.'
      ],
      correctIndex: 0,
      explanation: 'Client có thể upload file giả mạo hoặc độc hại lên S3. Backend cần webhook/callback xác nhận: kiểm tra object tồn tại, verify size/magic bytes, kiểm tra quota chi nhánh rồi mới lưu metadata vào database.'
    },
    {
      id: 'final-q4',
      question: 'Để trừ tồn kho an toàn trước hàng trăm request đặt hàng đồng thời, cách viết nào thể hiện đúng tính bất biến và nguyên tử (Atomicity)?',
      options: [
        '`updateMany({ where: { id, unitId, quantity: { gte: count } }, data: { quantity: { decrement: count } } })` và kiểm tra `count === 1`.',
        'Đọc `quantity` ra bộ nhớ bằng `findUnique`, dùng lệnh `if (quantity >= count)` của JavaScript rồi mới gọi `update`.',
        'Thực hiện câu lệnh `update` trừ không điều kiện, nếu kết quả trả về số âm thì tiếp tục gọi câu lệnh cộng bù lại.',
        'Lưu toàn bộ số lượng tồn kho vào biến toàn cục của Singleton Service để tăng tốc độ kiểm tra.'
      ],
      correctIndex: 0,
      explanation: 'Atomic Conditional Update ở cấp độ Database: Điều kiện `quantity: { gte: count }` được cơ sở dữ liệu kiểm tra và trừ ngay trong một thao tác nguyên tử duy nhất, chống 100% Race Condition (Lost Update / Overselling).'
    },
    {
      id: 'final-q5',
      question: 'Trong kiến trúc Multi-Surface của eSmiles, khi một request gửi tới endpoint `/api/i/v1/patients`, hệ thống bảo mật phải xác thực các yếu tố nào?',
      options: [
        'User đã đăng nhập hợp lệ, có quyền truy cập vào Surface nội bộ, và `unitId` trong Token phải khớp với ngữ cảnh chi nhánh đang thao tác.',
        'Chỉ cần kiểm tra xem người dùng có gửi kèm địa chỉ email có đuôi `@gmail.com` hay không.',
        'Mặc định cấp toàn quyền nếu request được gửi từ một địa chỉ IP thuộc dải mạng văn phòng.',
        'Chỉ kiểm tra quyền nếu request gửi lên có phương thức là DELETE hoặc PUT.'
      ],
      correctIndex: 0,
      explanation: 'Internal Surface (`/api/i/v1`) yêu cầu: 1. Authenticated User; 2. Internal Staff/Doctor role; 3. Active Unit Scoping (phải có quyền trên chi nhánh đó). Bất kỳ sự sai lệch tenant nào đều phải bị chặn 403.'
    },
    {
      id: 'final-q6',
      question: 'Khi xử lý một Job trong BullMQ (ví dụ: trừ tiền ví điện tử MoMo), cách thiết kế nào đảm bảo tính Idempotency khi worker bị crash và khởi động lại?',
      options: [
        'Lưu trạng thái giao dịch với `idempotencyKey`; kiểm tra nếu key đã ở trạng thái `SUCCESS` thì bỏ qua việc trừ tiền lần 2.',
        'Tăng số lần retry của job lên 100 lần để đảm bảo worker luôn có cơ hội chạy lại từ đầu.',
        'Xóa toàn bộ các job trong hàng đợi mỗi khi phát hiện có một worker bị ngắt kết nối đột ngột.',
        'Bắt buộc người dùng phải nhập lại mã OTP trên ứng dụng di động mỗi khi worker bị lỗi.'
      ],
      correctIndex: 0,
      explanation: 'Khi Worker crash sau khi gọi MoMo nhưng trước khi ack Redis, Redis sẽ giao job cho worker khác. Nhờ kiểm tra `idempotencyKey` trong DB, worker mới phát hiện giao dịch đã thành công và return ngay lập tức.'
    },
    {
      id: 'final-q7',
      question: 'Trong NestJS, decorator `@Injectable({ scope: Scope.REQUEST })` nếu bị lạm dụng ở tầng Repository/Service sâu sẽ gây ra vấn đề gì?',
      options: [
        'Lan truyền (bubble up) Request-scope lên toàn bộ các Controller và Service phụ thuộc, làm tăng chi phí cấp phát bộ nhớ và giảm thông lượng hệ thống.',
        'Làm cho toàn bộ các câu lệnh SQL trong Repository đó bị chuyển đổi thành các hàm đồng bộ chặn luồng.',
        'Tự động ngắt kết nối giữa ứng dụng NestJS và cơ sở dữ liệu PostgreSQL sau mỗi 10 request.',
        'Làm mất toàn bộ các decorator validation đã được khai báo trong các file DTO của ứng dụng.'
      ],
      correctIndex: 0,
      explanation: 'Request Scope lan truyền ngược lên toàn bộ dependency graph. Mỗi HTTP request phải khởi tạo lại hàng chục object instance trong RAM, gây áp lực lớn cho V8 Garbage Collector và làm giảm throughput rõ rệt.'
    },
    {
      id: 'final-q8',
      question: 'Trong Prisma 7, tại sao không nên bọc một lời gọi API bên thứ ba (như gửi SMS hoặc gọi Cổng Thanh Toán) bên trong một Interactive Transaction (`prisma.$transaction`)?',
      options: [
        'Vì API bên ngoài có thể phản hồi chậm, giữ kết nối DB và khóa dòng quá lâu dẫn đến Transaction Timeout và nghẽn Connection Pool.',
        'Vì Prisma sẽ tự động hủy bỏ lời gọi API đó nếu thời gian thực thi vượt quá 100 mili-giây.',
        'Vì các hàm gọi API bên ngoài bắt buộc phải sử dụng thư viện Axios phiên bản mới nhất.',
        'Vì cơ sở dữ liệu PostgreSQL không cho phép truyền dữ liệu ra mạng Internet từ bên trong transaction.'
      ],
      correctIndex: 0,
      explanation: 'Database Transaction là tài nguyên đắt đỏ. Giữ transaction mở trong lúc chờ mạng ngoại vi (3-10s) sẽ giữ connection và lock DB, làm tê liệt các request khác. Cần gọi API ngoài trước hoặc sau transaction.'
    },
    {
      id: 'final-q9',
      question: 'Khi sử dụng `class-validator`, sự kết hợp giữa `whitelist: true` và `forbidNonWhitelisted: true` trong `ValidationPipe` mang lại giá trị bảo mật gì?',
      options: [
        'Chống tấn công Mass Assignment: từ chối các request chứa các trường lạ (như `role: "admin"` hay `isVerified: true`) không có trong DTO.',
        'Tự động mã hóa toàn bộ dữ liệu của request body bằng thuật toán RSA trước khi lưu vào cơ sở dữ liệu.',
        'Cho phép người dùng gửi bất kỳ trường dữ liệu nào mà không cần khai báo trong DTO.',
        'Tự động tăng gấp đôi thời gian sống của token JWT của người gửi request.'
      ],
      correctIndex: 0,
      explanation: 'Mass Assignment xảy ra khi kẻ tấn công cố tình gửi thêm `{ role: "admin", balance: 999999 }`. Cấu hình forbidNonWhitelisted sẽ chặn đứng request ngay tại cửa khẩu Pipe với lỗi 400 Bad Request.'
    },
    {
      id: 'final-q10',
      question: 'Trong thiết kế cơ sở dữ liệu cho phòng khám nha khoa eSmiles, trường `isLocked = true` trong bảng `treatment_options` phục vụ nguyên tắc nghiệp vụ nào?',
      options: [
        'Bảo toàn tính bất biến (Immutability) của phương án điều trị đã chốt với bệnh nhân, ngăn chặn việc sửa đổi đơn giá hoặc thủ thuật sau khi đã ký duyệt.',
        'Tự động ẩn phương án điều trị đó khỏi màn hình của bác sĩ và chỉ hiển thị cho nhân viên kế toán.',
        'Cho phép bệnh nhân tự do chỉnh sửa lại danh mục thuốc mà không cần thông qua bác sĩ điều trị.',
        'Tự động xóa vĩnh viễn toàn bộ hồ sơ bệnh án cũ của bệnh nhân khỏi cơ sở dữ liệu.'
      ],
      correctIndex: 0,
      explanation: 'Phương án điều trị đã duyệt có giá trị pháp lý và tài chính. Backend phải khóa cứng (`isLocked = true`) và cấm mọi thao tác UPDATE/DELETE trực tiếp để đảm bảo tính minh bạch.'
    },
    {
      id: 'final-q11',
      question: 'Trong NestJS Exception Handling, mục đích của việc tạo Custom Exception Filter kế thừa `BaseExceptionFilter` là gì?',
      options: [
        'Bắt toàn bộ các lỗi unhandled, ẩn giấu chi tiết nhạy cảm (database error, stack trace) khỏi client và format response đồng nhất.',
        'Tự động thử lại câu lệnh bị lỗi thêm 3 lần trước khi trả về kết quả cho người dùng.',
        'Chuyển toàn bộ các mã lỗi HTTP 500 thành mã HTTP 200 để giao diện không bị gián đoạn.',
        'Xóa toàn bộ các bản ghi bị lỗi trong cơ sở dữ liệu PostgreSQL để tránh xung đột.'
      ],
      correctIndex: 0,
      explanation: 'Custom Exception Filter chuẩn hóa cấu trúc lỗi (`{ success: false, statusCode, errorCode, message, timestamp, path }`) và che giấu các thông tin nhạy cảm của hệ thống khỏi hacker.'
    },
    {
      id: 'final-q12',
      question: 'Khi triển khai cơ chế Rate Limiting phân tán (Distributed Rate Limiting) với Redis, thuật toán nào thường được ưu tiên để tránh hiện tượng dồn cục (Burst Traffic) ở đầu mỗi phút?',
      options: [
        'Sliding Window Log hoặc Sliding Window Counter (Cửa sổ trượt) chia nhỏ khoảng thời gian theo timestamp thực tế.',
        'Fixed Window Counter (Cửa sổ cố định) reset bộ đếm về 0 ở đầu mỗi phút theo đồng hồ hệ thống.',
        'First-In First-Out Queue (Hàng đợi vào trước ra trước) xóa bỏ toàn bộ request cũ sau 1 giây.',
        'Random Drop (Hủy ngẫu nhiên) tự động từ chối 50% số lượng request gửi tới server.'
      ],
      correctIndex: 0,
      explanation: 'Fixed Window bị lỗi: gửi 100 req ở 00:59 và 100 req ở 01:01 (tổng 200 req trong 2 giây). Sliding Window tính toán số lượng request dựa trên cửa sổ thời gian trượt liên tục, loại bỏ hoàn toàn hiện tượng Spike.'
    },
    {
      id: 'final-q13',
      question: 'Trong Prisma Schema, khi nào bạn nên sử dụng Composite Index `@@index([unitId, status, createdAt])` thay vì các index đơn lẻ?',
      options: [
        'Khi câu query thường xuyên lọc đồng thời theo `unitId`, `status` và sắp xếp theo `createdAt` (Compound Filtering & Sorting).',
        'Khi bảng dữ liệu có ít hơn 10 dòng và chỉ dùng để lưu trữ cấu hình hệ thống.',
        'Khi muốn tự động xóa các bản ghi có trạng thái status là INACTIVE sau mỗi 30 ngày.',
        'Khi cơ sở dữ liệu không hỗ trợ việc tạo khóa chính trên một cột đơn lẻ.'
      ],
      correctIndex: 0,
      explanation: 'Composite Index tối ưu cho các câu lệnh có nhiều điều kiện kết hợp (`WHERE unitId = ? AND status = ? ORDER BY createdAt DESC`), giúp database tìm kiếm trong 1 lần duyệt B-Tree duy nhất.'
    },
    {
      id: 'final-q14',
      question: 'Khái niệm "Graceful Degradation" (Thoái lui mềm) trong hệ thống Backend được thể hiện như thế nào khi Redis Cache gặp sự cố?',
      options: [
        'Backend bắt ngoại lệ kết nối Redis, chuyển tạm sang query trực tiếp Database và ghi log cảnh báo thay vì làm sập toàn bộ API.',
        'Tự động tắt nguồn máy chủ backend ngay lập tức để bảo vệ dữ liệu không bị hỏng.',
        'Trả về mã lỗi HTTP 500 cho toàn bộ người dùng đang truy cập vào ứng dụng.',
        'Tự động xóa toàn bộ dữ liệu trong Database PostgreSQL để giải phóng bộ nhớ.'
      ],
      correctIndex: 0,
      explanation: 'Graceful Degradation đảm bảo nếu một thành phần phụ trợ (như Cache/Recommender) bị lỗi, hệ thống vẫn duy trì các chức năng cốt lõi (Core Business) bằng cách fallback về DB an toàn.'
    },
    {
      id: 'final-q15',
      question: 'Khi triển khai cơ chế Phân quyền động (PBAC) trong eSmiles, tại sao không nên kiểm tra trực tiếp chuỗi `user.role === "admin"` trong logic của Service?',
      options: [
        'Vì kiểm tra Role làm code bị cứng nhắc (hardcoded), không thể tạo thêm vai trò mới (như "Bác Sĩ Trưởng", "Kế Toán Trưởng") mà không phải sửa code.',
        'Vì TypeScript không hỗ trợ so sánh chuỗi ký tự trong các câu lệnh điều kiện if/else.',
        'Vì biến role sẽ tự động bị đổi thành số nguyên sau khi nạp vào bộ nhớ RAM của máy chủ.',
        'Vì việc kiểm tra Role sẽ làm cho tốc độ truy vấn cơ sở dữ liệu bị chậm đi 10 lần.'
      ],
      correctIndex: 0,
      explanation: 'Phân quyền dựa trên Permission (`can("inventory.item:update")`) cho phép người quản trị tự do tạo các vai trò mới và gán quyền linh hoạt trên UI quản trị mà không cần kỹ sư phải sửa code hay deploy lại server.'
    },
    {
      id: 'final-q16',
      question: 'Tại sao việc sử dụng HTTP Status Code 200 OK cho tất cả các phản hồi (kể cả khi có lỗi) kèm body `{ error: "Not Found" }` bị coi là vi phạm chuẩn RESTful?',
      options: [
        'Vì nó phá vỡ khả năng xử lý tự động của các hạ tầng mạng (API Gateway, CDN Cache, Monitoring, Load Balancer) dựa trên mã HTTP chuẩn.',
        'Vì trình duyệt web sẽ từ chối hiển thị nội dung nếu nhận được status code 200 cho một request bị lỗi.',
        'Vì cơ sở dữ liệu PostgreSQL sẽ tự động rollback toàn bộ dữ liệu nếu nhận được mã HTTP 200.',
        'Vì TypeScript compiler không cho phép trả về đối tượng có chứa trường error trong mã HTTP 200.'
      ],
      correctIndex: 0,
      explanation: 'Hạ tầng mạng (Nginx, Datadog, Cloudflare, Axios) dựa vào HTTP Status Code (4xx, 5xx) để cảnh báo lỗi, đo tỷ lệ lỗi (Error Rate) và quyết định retry/cache. Trả về 200 cho request lỗi khiến việc giám sát hệ thống bị tê liệt.'
    },
    {
      id: 'final-q17',
      question: 'Trong Prisma, khi thực hiện câu lệnh `prisma.patient.findMany({ select: { id: true, name: true } })`, lợi ích về mặt hiệu năng là gì?',
      options: [
        'Chỉ yêu cầu DB đọc và truyền tải các cột cần thiết qua mạng, giảm đáng kể dung lượng bộ nhớ RAM và băng thông IO của Database.',
        'Tự động tăng tốc độ xử lý của CPU máy tính cá nhân của người lập trình viên.',
        'Cho phép người dùng sửa đổi trực tiếp dữ liệu của các cột không được chọn trong câu lệnh.',
        'Tự động chuyển toàn bộ kết quả tìm kiếm sang dạng file âm thanh MP3 để lưu trữ.'
      ],
      correctIndex: 0,
      explanation: 'Column Projection (`select` thay vì lấy tất cả cột): Tránh việc nạp các trường dữ liệu nặng (như JSON bệnh án, file ảnh Base64) vào RAM khi không cần dùng, tối ưu hóa triệt để băng thông giữa App Server và DB.'
    },
    {
      id: 'final-q18',
      question: 'Khi triển khai kiến trúc Multi-Tenant dạng Separate Database (Mỗi phòng khám 1 Database riêng), kỹ thuật nào được dùng để kết nối đúng DB?',
      options: [
        'Dùng Dynamic Database Connection Pool Factory: trích xuất `tenantId` từ request để cấp phát hoặc lấy Prisma Client instance tương ứng từ Map cache.',
        'Tạo 100 file main.ts khác nhau và chạy 100 ứng dụng NestJS trên 100 cổng mạng khác nhau.',
        'Gộp toàn bộ các database vào làm một file duy nhất và sử dụng mật khẩu chung.',
        'Bắt buộc người dùng phải nhập chuỗi kết nối Database URL trực tiếp vào ô đăng nhập.'
      ],
      correctIndex: 0,
      explanation: 'Dynamic Tenant Connection Manager duy trì một Map các PrismaClient instances được cache theo `tenantId`. Khi có request, middleware xác định tenant và inject đúng Client tương ứng.'
    },
    {
      id: 'final-q19',
      question: 'Trong NestJS, mục đích của việc sử dụng `app.useLogger()` kết hợp với các dịch vụ Structured Logging (như Winston, Pino, Datadog) là gì?',
      options: [
        'Ghi log có cấu trúc chuẩn JSON (kèm traceId, userId, tenantId, executionTime) giúp tập trung hóa log và dễ dàng truy vết sự cố trên Grafana/Kibana.',
        'Tự động xóa bỏ toàn bộ các câu lệnh console.log có trong mã nguồn của ứng dụng.',
        'Tăng dung lượng lưu trữ của ổ đĩa cứng máy chủ lên gấp 5 lần khi hệ thống chạy quá tải.',
        'Gửi tin nhắn thông báo cho người dùng mỗi khi một hàm trong Controller thực thi xong.'
      ],
      correctIndex: 0,
      explanation: 'Structured JSON Logging cho phép các công cụ phân tích log (Elasticsearch, Loki, CloudWatch) bóc tách trường tự động (filter theo `traceId` hoặc `tenantId`) để kỹ sư debug luồng đi của một request trong vài giây.'
    },
    {
      id: 'final-q20',
      question: 'Khi một API cần thực hiện 5 bước nghiệp vụ phức tạp và bước thứ 4 bị lỗi, cơ chế Database Transaction đảm bảo điều gì?',
      options: [
        'Tính nguyên tử (Atomicity): Tự động Rollback toàn bộ các thay đổi của bước 1, 2, 3 để đưa dữ liệu về trạng thái sạch sẽ ban đầu như chưa có gì xảy ra.',
        'Tiếp tục thực thi bước 5 và bỏ qua bước 4 để không làm gián đoạn trải nghiệm của người dùng.',
        'Tự động gửi email thông báo cho toàn bộ nhân viên trong công ty biết hệ thống đang gặp sự cố.',
        'Lưu tạm các thay đổi của bước 1, 2, 3 vào một file văn bản trên màn hình Desktop của máy chủ.'
      ],
      correctIndex: 0,
      explanation: 'Nguyên lý ACID (Atomicity): Giao dịch là "Tất cả hoặc không có gì" (All or Nothing). Nếu có bất kỳ lỗi nào xảy ra giữa chừng, toàn bộ các câu lệnh trước đó đều bị hoàn tác (Rollback), bảo vệ 100% tính toàn vẹn dữ liệu.'
    },
    {
      id: 'final-q21',
      question: 'Trong quy trình CI/CD, bước kiểm tra tĩnh (Static Analysis & Type Checking) bằng `tsc --noEmit` nhằm mục đích gì?',
      options: [
        'Kiểm tra toàn bộ tính toàn vẹn của hệ thống kiểu dữ liệu TypeScript mà không cần mất thời gian xuất ra các file JavaScript trung gian.',
        'Tự động deploy ứng dụng lên môi trường production nếu không có lỗi chính tả trong comment.',
        'Tối ưu hóa các hình ảnh có trong thư mục assets để giảm dung lượng file nén.',
        'Xóa toàn bộ các thư mục node_modules cũ để giải phóng bộ nhớ cho máy chủ build.'
      ],
      correctIndex: 0,
      explanation: '`tsc --noEmit` chỉ chạy trình biên dịch để phân tích lỗi kiểu dữ liệu tĩnh (Type Error) trên toàn bộ dự án với tốc độ nhanh nhất, là chốt chặn quan trọng đầu tiên trong mọi pipeline CI/CD.'
    },
    {
      id: 'final-q22',
      question: 'Khái niệm "Zero Trust Architecture" trong lập trình Backend yêu cầu điều gì đối với dữ liệu nhận từ Client?',
      options: [
        'Không bao giờ tin tưởng dữ liệu đầu vào từ Client; bắt buộc phải Validate, Sanitize, và xác thực quyền hạn ở mọi tầng ứng dụng.',
        'Từ chối toàn bộ các kết nối mạng gửi từ các thiết bị di động thông minh của người dùng.',
        'Bắt buộc người dùng phải nhập lại mật khẩu tài khoản ở mỗi lần bấm chuột trên trang web.',
        'Mã hóa toàn bộ cơ sở dữ liệu bằng một mật khẩu chỉ có duy nhất Giám đốc công ty biết.'
      ],
      correctIndex: 0,
      explanation: 'Zero Trust (Không bao giờ tin tưởng, luôn luôn xác thực): Mọi payload gửi từ client đều có thể bị chỉnh sửa bởi hacker. Backend phải tự mình kiểm tra tính hợp lệ và quyền hạn ở mọi bước.'
    },
    {
      id: 'final-q23',
      question: 'Khi sử dụng Redis làm bộ nhớ đệm (Cache), cơ chế "Cache Aside" (Lazy Loading) hoạt động theo trình tự nào?',
      options: [
        'Đọc từ Cache → Nếu có (Hit) thì trả về ngay; Nếu không có (Miss) thì đọc từ DB → Ghi kết quả vào Cache với TTL → Trả về dữ liệu cho Client.',
        'Ghi dữ liệu vào Cache trước rồi định kỳ 1 tiếng sau mới đồng bộ dữ liệu vào cơ sở dữ liệu chính.',
        'Xóa toàn bộ cơ sở dữ liệu mỗi khi bộ nhớ đệm Cache của Redis bị đầy dung lượng.',
        'Bắt buộc client phải gửi request trực tiếp tới Redis trước khi gửi request tới NestJS Backend.'
      ],
      correctIndex: 0,
      explanation: 'Cache-Aside Pattern: 1. Check cache. 2. If Miss: Query DB, set cache with TTL, return. 3. When mutate (Update/Delete): Invalidate/evict cache key tương ứng để tránh stale data.'
    },
    {
      id: 'final-q24',
      question: 'Tại sao việc thiết lập `TTL` (Time-To-Live) cho mọi Key lưu trong Redis Cache là bắt buộc?',
      options: [
        'Tránh việc dữ liệu rác tồn tại vĩnh viễn làm cạn kiệt bộ nhớ RAM của Redis, và đảm bảo dữ liệu tự động làm mới sau một khoảng thời gian.',
        'Bắt buộc Redis phải khởi động lại máy chủ sau khi thời gian TTL đếm ngược kết thúc.',
        'Tăng tốc độ mã hóa của các khóa bảo mật JWT được lưu trữ trong bộ nhớ đệm.',
        'Ngăn không cho các lập trình viên khác đọc được nội dung của các key trong Redis.'
      ],
      correctIndex: 0,
      explanation: 'Nếu không có TTL, các key không bao giờ hết hạn sẽ tích tụ theo thời gian khiến RAM bị đầy (OOM Crash). TTL cũng là cơ chế cứu cánh giúp dữ liệu tự động đồng bộ lại nếu lỡ quên xóa cache khi update.'
    },
    {
      id: 'final-q25',
      question: 'Trong NestJS, kỹ thuật "Custom Pipe Transformation" thường được ứng dụng để làm sạch dữ liệu đầu vào như thế nào?',
      options: [
        'Tự động cắt bỏ khoảng trắng thừa (trim), chuyển email về chữ thường (lowercase) và loại bỏ các thẻ HTML độc hại (Sanitize XSS).',
        'Tự động dịch nội dung của bài viết sang 5 thứ tiếng phổ biến nhất trên thế giới.',
        'Tự động nén toàn bộ hình ảnh đính kèm thành định dạng WebP chất lượng cao.',
        'Gửi tin nhắn cảnh báo tới số điện thoại của người dùng nếu phát hiện có ký tự số trong tên.'
      ],
      correctIndex: 0,
      explanation: 'Pipes không chỉ validate mà còn transform dữ liệu trước khi vào Controller: chuẩn hóa chuỗi (`email.trim().toLowerCase()`), loại bỏ mã độc XSS (`sanitize-html`), và ép kiểu tham số an toàn.'
    },
    {
      id: 'final-q26',
      question: 'Khi triển khai API phân trang với lượng dữ liệu lớn (Big Data > 10 triệu dòng), tại sao "Cursor-based Pagination" lại tối ưu hơn "Offset-based Pagination"?',
      options: [
        'Cursor-based tận dụng chỉ mục B-Tree (ví dụ: `WHERE id > lastId LIMIT 20`) để nhảy thẳng đến vị trí cần lấy, không phải quét qua hàng triệu dòng như `OFFSET 5000000`.',
        'Cursor-based tự động chia nhỏ cơ sở dữ liệu thành 100 bảng con chạy trên các máy chủ khác nhau.',
        'Offset-based chỉ hỗ trợ phân trang cho các bảng dữ liệu có chứa ít hơn 100 dòng.',
        'Cursor-based không yêu cầu cơ sở dữ liệu phải có khóa chính hay chỉ mục index.'
      ],
      correctIndex: 0,
      explanation: 'OFFSET 5.000.000 ép DB phải đọc và duyệt qua 5 triệu dòng rồi vứt bỏ trước khi lấy 20 dòng tiếp theo (rất chậm). Cursor-based dùng Index Seek nhảy thẳng vào vị trí `id > lastSeenId` với độ phức tạp O(log N).'
    },
    {
      id: 'final-q27',
      question: 'Trong kiến trúc Event-Driven, "Outbox Pattern" được thiết kế nhằm mục đích gì?',
      options: [
        'Đảm bảo việc cập nhật Database và xuất bản Event ra Message Queue luôn đồng nhất (Atomic), không bị mất Event kể cả khi Message Broker bị sập lúc commit DB.',
        'Tự động gửi email thông báo cho toàn bộ khách hàng mỗi khi có sản phẩm mới ra mắt.',
        'Tăng tốc độ tải trang của giao diện web bằng cách lưu trữ toàn bộ tin nhắn vào cookie trình duyệt.',
        'Tự động xóa các tài khoản người dùng không hoạt động trong vòng 6 tháng khỏi hệ thống.'
      ],
      correctIndex: 0,
      explanation: 'Outbox Pattern lưu event vào bảng `outbox` trong cùng DB Transaction với nghiệp vụ chính. Một tiến trình riêng sẽ đọc bảng outbox và publish sang Queue, đảm bảo không bao giờ có chuyện DB lưu nhưng Event bị mất.'
    },
    {
      id: 'final-q28',
      question: 'Khi thiết kế hệ thống Microservices, nguyên lý "Single Responsibility Principle" ở tầng Database khuyến nghị điều gì?',
      options: [
        'Mỗi Microservice nên sở hữu và quản lý cơ sở dữ liệu riêng của mình (Database-per-Service), không truy cập trực tiếp vào DB của service khác.',
        'Tất cả các Microservices trong công ty bắt buộc phải dùng chung một bảng cơ sở dữ liệu duy nhất.',
        'Chỉ cho phép duy nhất 1 người lập trình viên được quyền viết mã nguồn cho cơ sở dữ liệu đó.',
        'Mỗi cơ sở dữ liệu chỉ được phép chứa tối đa 1 bảng dữ liệu duy nhất.'
      ],
      correctIndex: 0,
      explanation: 'Database-per-Service ngăn ngừa việc các service bị dính chặt vào schema của nhau (Loose Coupling). Giao tiếp liên service bắt buộc phải thông qua API hoặc Event Contracts được định nghĩa rõ ràng.'
    },
    {
      id: 'final-q29',
      question: 'Trong bảo mật ứng dụng Web, kỹ thuật "Content Security Policy" (CSP) Header có tác dụng gì?',
      options: [
        'Quy định rõ những nguồn domain nào được phép tải script, hình ảnh, stylesheet và kết nối socket, ngăn chặn tấn công XSS và Data Injection.',
        'Tự động tăng dung lượng bộ nhớ RAM của máy tính người dùng khi truy cập trang web.',
        'Chuyển toàn bộ nội dung của trang web thành định dạng văn bản thô không có màu sắc.',
        'Bắt buộc người dùng phải sử dụng trình duyệt Google Chrome thì mới được phép truy cập.'
      ],
      correctIndex: 0,
      explanation: 'CSP Header là lớp bảo vệ vững chắc do trình duyệt thực thi, chỉ cho phép thực thi JavaScript từ các nguồn tin cậy (trusted domains), vô hiệu hóa các đoạn script độc hại bị chèn qua XSS.'
    },
    {
      id: 'final-q30',
      question: 'Hành trình trở thành một Kỹ sư Backend Master NestJS & High-Concurrency Systems đòi hỏi phẩm chất kỹ thuật cốt lõi nào?',
      options: [
        'Hiểu sâu bản chất hoạt động bên dưới (Event Loop, Concurrency, Database Locks, Network RFC) và luôn thiết kế hệ thống có tính bền bỉ, an toàn dữ liệu và mở rộng cao.',
        'Chỉ cần học thuộc lòng cú pháp của các decorator mà không cần hiểu cơ chế vận hành bên dưới.',
        'Copy code từ Internet về dự án mà không cần kiểm tra tính toàn vẹn và độ an toàn của mã nguồn.',
        'Chỉ tập trung vào giao diện người dùng và phó mặc toàn bộ logic bảo mật cho bên thứ ba.'
      ],
      correctIndex: 0,
      explanation: 'Kỹ sư Backend thực thụ không chỉ viết code chạy được, mà phải hiểu sâu cơ chế chịu tải, chống rò rỉ dữ liệu đa chi nhánh, kiểm soát concurrency và thiết kế hệ thống hoạt động ổn định 24/7 dưới áp lực cao.'
    }
  ],
  codeChallenges: [
    {
      id: 'final-capstone-1',
      title: 'Capstone 1: Atomic Stock Transfer với Tenant Isolation Scoping',
      description: 'Hiện thực hàm `executeStockTransfer(prismaMock, unitId, payload)`: 1. Validate `unitId`, `fromItemId`, `toItemId`, `quantity > 0` và hai kho khác nhau; 2. Trong transaction: Dùng `updateMany` conditional debit theo `unitId` và `quantity: { gte: quantity }`; nếu `count !== 1` ném lỗi `INSUFFICIENT_STOCK`; 3. Cộng kho đích; 4. Ghi audit log bằng `tx.auditLog.create`. Trả về `{ success: true, transferId: payload.idempotencyKey }`.',
      starterCode: `async function executeStockTransfer(prismaMock, unitId, payload) {
  // TODO: Hiện thực chuyển kho nguyên tử (Atomic Stock Transfer)
  // payload: { fromItemId: string, toItemId: string, quantity: number, idempotencyKey: string }
  // 1. Kiểm tra validation (unitId, fromItemId, toItemId, quantity > 0)
  // 2. Chạy prismaMock.$transaction thực hiện conditional decrement và audit log
  // 3. Trả về: { success: true, transferId: payload.idempotencyKey }

}`,
      testCases: [
        {
          input: [
            {
              $transaction: async (cb) => cb({
                inventoryItem: {
                  updateMany: async () => ({ count: 1 }),
                  update: async () => ({})
                },
                auditLog: {
                  create: async () => ({})
                }
              })
            },
            'unit-esmiles-1',
            { fromItemId: 'kho-A', toItemId: 'kho-B', quantity: 10, idempotencyKey: 'idemp-001' }
          ],
          expected: { success: true, transferId: 'idemp-001' },
          description: 'Chuyển kho hợp lệ với đủ tồn kho phải thành công và trả về transferId'
        }
      ]
    },
    {
      id: 'final-capstone-2',
      title: 'Capstone 2: Implement Request Pipeline với Validation, Status Code & Error Handling',
      description: 'Hiện thực hàm `handleCreatePatient(req, res, next)`: Trích xuất `name` và `age` từ `req.body`. Nếu `name` rỗng hoặc `age < 0` hoặc `age > 150`, gọi `res.status(400).json({ error: "BAD_INPUT" })`. Nếu hợp lệ, gọi `res.status(201).json({ success: true, patient: { name: name.trim(), age: Number(age) } })`. Bọc toàn bộ trong khối `try/catch` và gọi `next(error)` nếu có ngoại lệ bất ngờ.',
      starterCode: `async function handleCreatePatient(req, res, next) {
  // TODO: Hiện thực Pipeline xử lý tạo hồ sơ bệnh nhân
  // 1. Lấy name, age từ req.body
  // 2. Validate dữ liệu: name không rỗng, age hợp lệ từ 0 đến 150
  // 3. Nếu sai: res.status(400).json({ error: 'BAD_INPUT', message: '...' })
  // 4. Nếu đúng: res.status(201).json({ success: true, patient: { name, age } })
  // 5. Bắt lỗi ngoại lệ và chuyển tiếp cho next(error)

}`,
      testCases: [
        {
          input: [
            { body: { name: '  Nguyễn Văn A  ', age: '25' } },
            {
              status(code) { this.statusCode = code; return this; },
              json(payload) { return { statusCode: this.statusCode, ...payload }; }
            },
            () => {}
          ],
          expected: {
            statusCode: 201,
            success: true,
            patient: { name: 'Nguyễn Văn A', age: 25 }
          },
          description: 'Payload hợp lệ phải trả về status 201 và dữ liệu bệnh nhân đã được làm sạch'
        },
        {
          input: [
            { body: { name: '', age: 20 } },
            {
              status(code) { this.statusCode = code; return this; },
              json(payload) { return { statusCode: this.statusCode, ...payload }; }
            },
            () => {}
          ],
          expected: {
            statusCode: 400,
            error: 'BAD_INPUT',
            message: 'Tên bệnh nhân không hợp lệ'
          },
          description: 'Tên rỗng phải lập tức trả về status 400 Bad Request'
        }
      ]
    },
    {
      id: 'final-capstone-3',
      title: 'Capstone 3: Thiết Kế Robust Background Job Với Exponential Backoff Retry',
      description: 'Hiện thực hàm `processJobWithRetry(job, processFn, maxRetries)`: Thực thi `processFn(job)`. Nếu gặp lỗi, tăng bộ đếm `job.attempts`. Thử lại tối đa `maxRetries` lần. Nếu vượt quá, ném lỗi cuối cùng nhận được. Trả về kết quả nếu thành công.',
      starterCode: `async function processJobWithRetry(job, processFn, maxRetries = 3) {
  // TODO: Hiện thực cơ chế Exponential Backoff Retry cho Job
  // 1. Thực thi processFn(job), cập nhật job.attempts ở mỗi lần chạy
  // 2. Nếu thành công: trả về { success: true, result: res, attempts: job.attempts }
  // 3. Nếu thất bại sau maxRetries: ném lỗi Error('Job failed after ...')

}`,
      testCases: [
        {
          input: [
            { id: 'job-01', data: { orderId: 'ord-123' } },
            async (job) => {
              if (job.attempts < 2) throw new Error('Gateway Timeout');
              return { charged: true, amount: 500000 };
            },
            3
          ],
          expected: {
            success: true,
            result: { charged: true, amount: 500000 },
            attempts: 2
          },
          description: 'Job lỗi ở lần 1 nhưng thành công ở lần 2 phải trả về kết quả và attempts = 2'
        }
      ]
    }
  ]
};
