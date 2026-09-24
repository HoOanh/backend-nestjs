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
  title: 'Khảo Thí Tốt Nghiệp: Master NestJS 11, High-Concurrency & Distributed Systems',
  description: 'Đánh giá toàn diện năng lực Kỹ sư Backend Senior/Architect: V8 & Libuv Runtime, Network Protocols, NestJS IoC Architecture, PostgreSQL Storage & MVCC, Concurrency & Locking, Redis & BullMQ Queues, Cryptography, Distributed Systems và Production Observability.',
  timeLimitMinutes: 45,
  passingScore: 80,
  questionCountToPick: 15,
  questions: [
    // ----------------------------------------------------
    // CHƯƠNG 1: RUNTIME & CORE EXECUTION ENGINE
    // ----------------------------------------------------
    {
      id: 'final-q1',
      question: 'Trong kiến trúc Event Loop của Node.js, thứ tự ưu tiên xả các hàng đợi bất đồng bộ khi một I/O callback vừa hoàn tất là gì?',
      options: [
        'process.nextTick queue được xả đầu tiên, kế đến microtask queue (Promise), rồi mới đến Check phase (setImmediate callbacks).',
        'setImmediate callback được xả đầu tiên trong Check phase, kế đến process.nextTick queue, rồi mới đến các microtask của Promise.',
        'Promise microtask queue được xả đầu tiên, sau đó Event Loop chuyển ngay sang Timers phase để thực thi toàn bộ setTimeout pending.',
        'I/O poll phase sẽ giữ quyền ưu tiên xử lý toàn bộ các macro task tiếp theo trước khi cho phép bất kỳ microtask nào được kích hoạt.'
      ],
      correctIndex: 0,
      explanation: 'Trong Node.js runtime, process.nextTick sở hữu hàng đợi ưu tiên cao nhất (nextTickQueue), được drain sạch ngay sau mỗi bước chuyển giao tác vụ, tiếp theo là microtask queue (Promise.then/catch/finally), sau đó mới tới các phase của Libuv (Check phase cho setImmediate).'
    },
    {
      id: 'final-q2',
      question: 'Cơ chế Garbage Collector (Orinoco / V8) phân chia bộ nhớ Heap thành Young Generation và Old Generation nhằm tối ưu hóa điều gì?',
      options: [
        'Giảm thời gian dừng luồng (Stop-The-World) bằng cách dùng Scavenger dọn dẹp các object ngắn hạn mà không cần duyệt toàn bộ Heap.',
        'Cho phép ứng dụng cấp phát biến toàn cục không giới hạn dung lượng RAM mà không bao giờ gặp lỗi ngoại lệ JavaScript Heap Out Of Memory.',
        'Tự động nén toàn bộ các chuỗi ký tự dài thành mã nhị phân trước khi lưu vào Old Generation để tiết kiệm băng thông bus dữ liệu CPU.',
        'Bắt buộc lập trình viên phải giải phóng thủ công con trỏ bộ nhớ bằng lệnh delete trước khi object được chuyển giao sang Old Space.'
      ],
      correctIndex: 0,
      explanation: 'Theo giả thuyết Weak Generational Hypothesis, đại đa số object chết ngay sau khi sinh ra. V8 chia Young Gen (Nursery/Intermediate) dùng Scavenger (Copying GC) siêu nhanh để dọn dẹp các object ngắn ngày, chỉ những object sống sót qua 2 chu kỳ mới thăng hạng lên Old Gen (Mark-Sweep-Compact), hạn chế tối đa độ trễ Stop-The-World.'
    },
    {
      id: 'final-q3',
      question: 'Khi biến môi trường `UV_THREADPOOL_SIZE` mặc định là 4, điều gì sẽ xảy ra nếu có 8 tác vụ tính toán mã hóa `crypto.pbkdf2` gọi đồng thời?',
      options: [
        '8 tác vụ sẽ được phân bổ đồng đều sang 8 nhân CPU của hệ điều hành máy chủ để thực thi song song hoàn toàn trong cùng 1 tích tắc.',
        '4 tác vụ đầu tiên chiếm giữ 4 worker threads trong pool, 4 tác vụ còn lại phải nằm chờ ở hàng đợi Libuv cho đến khi có thread rảnh.',
        'Event Loop sẽ bị treo cứng hoàn toàn và từ chối tiếp nhận toàn bộ các request HTTP mới từ client cho đến khi cả 8 tác vụ kết thúc.',
        'Node.js sẽ tự động chuyển đổi 4 tác vụ bị tràn sang xử lý trên card đồ họa GPU nhằm tránh làm tắc nghẽn hàng đợi của Libuv.'
      ],
      correctIndex: 1,
      explanation: 'Các hàm crypto đồng bộ ngầm (như pbkdf2, scrypt) và fs được Libuv offload sang Thread Pool nội bộ (mặc định size = 4). Khi 8 tác vụ gọi đồng thời, 4 tác vụ đầu chiếm trọn 4 worker threads, 4 tác vụ sau phải xếp hàng chờ trong pending queue của Libuv cho tới khi có thread hoàn tất.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 2: GIAO THỨC MẠNG & THIẾT KẾ GIAO TIẾP
    // ----------------------------------------------------
    {
      id: 'final-q4',
      question: 'Vấn đề Head-of-Line (HoL) Blocking ở tầng truyền vận (Transport Layer) của HTTP/2 được giao thức HTTP/3 khắc phục như thế nào?',
      options: [
        'HTTP/3 bắt buộc client phải mở 6 kết nối TCP song song đến máy chủ cho mỗi domain nhằm chia nhỏ tải truyền nhận gói tin media.',
        'HTTP/3 sử dụng giao thức QUIC chạy trên nền UDP, giúp các stream dữ liệu độc lập hoàn toàn và việc mất gói ở 1 stream không chặn stream khác.',
        'HTTP/3 nén tiêu đề HTTP bằng thuật toán HPACK tĩnh thay vì QPACK nhằm loại bỏ hoàn toàn hiện tượng nghẽn hàng đợi trên mạng LAN.',
        'HTTP/3 loại bỏ cơ chế xác thực bắt tay TLS để đẩy tốc độ truyền tải các gói tin nhị phân đạt mức tối đa trên toàn bộ hạ tầng mạng.'
      ],
      correctIndex: 1,
      explanation: 'Trong HTTP/2, nhiều stream được ghép vào 1 kết nối TCP duy nhất (multiplexing). Khi 1 packet TCP bị rớt, toàn bộ kết nối TCP phải chờ truyền lại (TCP HoL Blocking). HTTP/3 chạy trên QUIC (nền UDP), mỗi stream quản lý flow và packet riêng biệt, mất packet ở stream A hoàn toàn không ảnh hưởng đến stream B.'
    },
    {
      id: 'final-q5',
      question: 'Tại sao việc thiết kế API thanh toán bắt buộc phải sử dụng cơ chế Idempotency Key thay vì chỉ dựa vào tính năng Retry của HTTP Client?',
      options: [
        'Vì Retry từ client khi gặp sự cố Network Timeout có thể khiến máy chủ xử lý trừ tiền 2 lần nếu giao dịch đầu tiên đã ghi nhận thành công.',
        'Vì chuẩn RESTful quy định phương thức HTTP POST bắt buộc phải có tính Idempotent tự nhiên mà không cần bất kỳ khóa định danh nào.',
        'Vì Idempotency Key giúp tăng tốc độ xử lý của câu lệnh SQL UPDATE trong cơ sở dữ liệu lên gấp hai lần nhờ cơ chế bỏ qua khóa dòng.',
        'Vì trình duyệt web sẽ tự động từ chối gửi lại các request thanh toán nếu trong header của HTTP request không chứa trường Idempotency.'
      ],
      correctIndex: 0,
      explanation: 'Khi Client gọi API thanh toán nhưng bị timeout mạng (Socket Hang Up), giao dịch thực chất có thể đã commit thành công trên server. Nếu client tự tiện retry mà không kèm Idempotency-Key để server kiểm tra và deduplicate, tài khoản khách hàng sẽ bị trừ tiền lần thứ hai.'
    },
    {
      id: 'final-q6',
      question: 'Trạng thái `TIME_WAIT` trong vòng đời kết nối TCP đóng vai trò cốt lõi nào đối với sự an toàn của hệ thống mạng backend?',
      options: [
        'Duy trì kết nối mở thêm 2MSL để đảm bảo gói tin ACK cuối cùng đến được bên đối tác và các gói tin lạc của kết nối cũ không làm hỏng kết nối mới.',
        'Tự động giải phóng ngay lập tức toàn bộ địa chỉ IP và Port của máy chủ về cho hệ điều hành tái sử dụng cho các kết nối tiếp theo.',
        'Ngăn chặn kẻ tấn công thực hiện kỹ thuật quét cổng bí mật (Port Scanning) bằng cách khóa toàn bộ các socket đang mở trên máy chủ.',
        'Tăng tốc độ bắt tay 3 bước (Three-way Handshake) cho các request HTTP tiếp theo bằng cách bỏ qua giai đoạn trao đổi cờ SYN và ACK.'
      ],
      correctIndex: 0,
      explanation: 'Trạng thái TIME_WAIT (kéo dài 2MSL, thường 1-2 phút) thuộc về bên chủ động đóng kết nối (Active Close). Nó bảo đảm gói tin ACK cuối cùng được bên kia nhận (nếu mất thì gửi lại), đồng thời để các gói tin tồn đọng/lạc đường trên mạng tan biến hoàn toàn, tránh làm sai lệch dữ liệu của kết nối mới trùng IP/Port.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 3: KIẾN TRÚC LÕI NESTJS & REQUEST LIFECYCLE
    // ----------------------------------------------------
    {
      id: 'final-q7',
      question: 'Khi khai báo `@Injectable({ scope: Scope.REQUEST })` trên một Service trung tâm, tác động tiêu cực nguy hiểm nhất đối với ứng dụng là gì?',
      options: [
        'Toàn bộ các Controller và Service phụ thuộc vào nó đều bị biến thành Request Scope, gây áp lực cấp phát RAM và hủy rác liên tục trên V8 GC.',
        'Toàn bộ các kết nối Database Connection Pool của ứng dụng sẽ tự động bị ngắt và phải mở lại từ đầu ở mỗi lượt request gửi lên.',
        'Trình biên dịch TypeScript Compiler sẽ lập tức báo lỗi cú pháp và từ chối tiến trình build mã nguồn của toàn bộ dự án NestJS.',
        'Mọi decorator bảo vệ phân quyền như @UseGuards() sẽ bị vô hiệu hóa hoàn toàn do IoC container không thể nhận diện được Context.'
      ],
      correctIndex: 0,
      explanation: 'Request Scope có tính chất lan truyền ngược (bubble up) lên toàn bộ dependency chain: nếu 1 service là Request-scoped, mọi service và controller phụ thuộc vào nó cũng bị kéo thành Request-scoped. Mỗi request phải khởi tạo lại hàng tá object instances, gây áp lực khủng khiếp lên V8 Heap và GC, làm tụt thảm hại throughput.'
    },
    {
      id: 'final-q8',
      question: 'Trật tự thực thi chuẩn xác của các thành phần trong Request Pipeline của NestJS khi một HTTP request đi vào là gì?',
      options: [
        'Global Middleware → Module Middleware → Guards → Interceptors (Pre-controller) → Pipes → Controller Handler → Interceptors (Post) → Exception Filters.',
        'Pipes → Guards → Global Middleware → Controller Handler → Interceptors → Module Middleware → Exception Filters.',
        'Guards → Pipes → Interceptors (Pre) → Global Middleware → Module Middleware → Controller Handler → Exception Filters.',
        'Interceptors (Pre) → Pipes → Guards → Global Middleware → Controller Handler → Module Middleware → Exception Filters.'
      ],
      correctIndex: 0,
      explanation: 'Vòng đời NestJS: Middleware (chạy đầu tiên theo chuẩn Express/Fastify) → Guards (xác thực AuthN/AuthZ) → Interceptors (pre-controller hook) → Pipes (parse & validate payload DTO) → Route Handler → Interceptors (post-controller transform response) → Exception Filters (nếu có ngoại lệ).'
    },
    {
      id: 'final-q9',
      question: 'Cấu hình `{ whitelist: true, forbidNonWhitelisted: true }` trong `ValidationPipe` của NestJS mang lại giá trị bảo mật then chốt nào?',
      options: [
        'Ngăn chặn triệt để lỗ hổng Mass Assignment bằng cách từ chối request nếu client gửi kèm các trường dữ liệu lạ không được định nghĩa trong DTO.',
        'Tự động mã hóa toàn bộ dữ liệu nhạy cảm trong body của request bằng thuật toán AES-256 trước khi chuyển tiếp cho tầng Service xử lý.',
        'Cho phép người dùng tự do gửi bất kỳ trường dữ liệu JSON mở rộng nào mà không cần phải khai báo trước các thuộc tính trong lớp DTO.',
        'Tự động chuyển đổi toàn bộ chuỗi ký tự hoa thành chữ thường để chuẩn hóa dữ liệu đầu vào cho các câu lệnh truy vấn cơ sở dữ liệu.'
      ],
      correctIndex: 0,
      explanation: 'Mass Assignment xảy ra khi kẻ tấn công chèn thêm các trường nguy hiểm như `{ role: "admin", isVerified: true, balance: 999999 }`. Cấu hình `whitelist: true, forbidNonWhitelisted: true` sẽ lập tức ném lỗi 400 Bad Request ngay tại Pipe nếu phát hiện bất kỳ key lạ nào ngoài DTO.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 4: HỆ QUẢN TRỊ RDBMS & POSTGRESQL CHUYÊN SÂU
    // ----------------------------------------------------
    {
      id: 'final-q10',
      question: 'Trong kiến trúc lưu trữ của PostgreSQL, cơ chế Write-Ahead Logging (WAL) đảm bảo tính Bền Vững (Durability) theo nguyên lý nào?',
      options: [
        'Mọi thay đổi dữ liệu phải được ghi tuần tự và flush xuống file log WAL trên đĩa cứng trước khi các data page bẩn trong Shared Buffers được ghi.',
        'Cơ sở dữ liệu sẽ giữ toàn bộ dữ liệu trong bộ nhớ RAM và chỉ ghi xuống đĩa cứng vào lúc nửa đêm khi máy chủ không còn request nào.',
        'Hệ quản trị sẽ tự động sao chép toàn bộ bảng dữ liệu sang một máy chủ dự phòng trên Cloud trước khi phản hồi kết quả cho câu lệnh INSERT.',
        'PostgreSQL bỏ qua hoàn toàn việc ghi xuống ổ đĩa nếu dung lượng bộ nhớ đệm Shared Buffers vẫn còn hơn 50% khoảng trống khả dụng.'
      ],
      correctIndex: 0,
      explanation: 'Nguyên tắc cơ bản của WAL (Write-Ahead Logging): Trước khi một page dữ liệu bị sửa đổi (dirty buffer) được ghi xuống file dữ liệu chính, bản ghi mô tả thay đổi đó PHẢI được ghi và fsync xuống WAL log trước. Nhờ đó, nếu server sập nguồn đột ngột, quá trình Crash Recovery sẽ replay WAL để khôi phục 100% dữ liệu đã commit.'
    },
    {
      id: 'final-q11',
      question: 'Khi tạo Composite Index `CREATE INDEX idx_user_status_created ON users (tenant_id, status, created_at)`, câu query nào sau đây KHÔNG THỂ tận dụng triệt để index này?',
      options: [
        '`WHERE status = \'ACTIVE\' AND created_at > \'2026-01-01\'` (thiếu cột tiền tố `tenant_id` dẫn đến vi phạm quy tắc Leftmost Prefix).',
        '`WHERE tenant_id = \'t1\' AND status = \'ACTIVE\' AND created_at > \'2026-01-01\'` (sử dụng đầy đủ và chính xác tất cả các cột theo đúng thứ tự).',
        '`WHERE tenant_id = \'t1\' AND status = \'ACTIVE\' ORDER BY created_at DESC` (tận dụng index cho cả điều kiện lọc và sắp xếp không cần sort bộ nhớ).',
        '`WHERE tenant_id = \'t1\'` (tận dụng index tìm kiếm theo cột tiền tố đầu tiên với chi phí duyệt cây B-Tree cực thấp).'
      ],
      correctIndex: 0,
      explanation: 'Quy tắc Leftmost Prefix của cây B-Tree: Index được sắp xếp tuần tự theo cột 1, rồi đến cột 2, rồi đến cột 3. Nếu câu query bỏ qua cột tiền tố đầu tiên (`tenant_id`), database engine không thể nhảy vào cây B-Tree để tìm kiếm nhị phân được mà phải duyệt toàn bộ bảng (Seq Scan) hoặc duyệt toàn bộ index (Index Full Scan).'
    },
    {
      id: 'final-q12',
      question: 'Hiện tượng "Table Bloat" (Phình to bảng) trong PostgreSQL sinh ra do nguyên nhân cốt lõi nào trong cơ chế MVCC?',
      options: [
        'Các thao tác UPDATE và DELETE tạo ra các dead tuples chiếm dụng không gian đĩa cứng và cần tiến trình VACUUM thu hồi lại.',
        'Hệ quản trị tự động nhân bản bảng thành nhiều bản sao để phục vụ các câu lệnh SELECT đồng thời từ nhiều client khác nhau.',
        'Do lập trình viên sử dụng quá nhiều kiểu dữ liệu số nguyên INT thay vì kiểu dữ liệu BIGINT khiến bộ nhớ bị tràn phân trang.',
        'Do hệ thống mạng bị nghẽn khiến các gói tin kết quả của câu lệnh truy vấn bị ứ đọng lại bên trong các phân vùng lưu trữ của bảng.'
      ],
      correctIndex: 0,
      explanation: 'Trong mô hình MVCC của Postgres, DELETE chỉ đánh dấu xmax cho tuple (không xóa vật lý ngay), còn UPDATE là ghi 1 tuple mới và đánh dấu tuple cũ là dead. Nếu autovacuum chạy không kịp hoặc bị chặn bởi long-running transactions, các dead tuple này tích tụ làm dung lượng bảng phình to (Table Bloat), làm chậm I/O.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 5: ĐỒNG THỜI, GIAO DỊCH & KIỂM SOÁT KHÓA
    // ----------------------------------------------------
    {
      id: 'final-q13',
      question: 'Để giải quyết triệt để vấn đề Lost Update khi hàng nghìn người cùng bấm nút đặt mua sản phẩm có số lượng tồn kho giới hạn, giải pháp nào tối ưu nhất?',
      options: [
        'Sử dụng Atomic Conditional Update: `UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty` và kiểm tra affected rows.',
        'Đọc số lượng tồn kho ra biến JavaScript trong RAM bằng hàm findUnique, dùng lệnh if kiểm tra rồi gọi hàm UPDATE ghi đè giá trị mới.',
        'Thiết lập mức cô lập giao dịch Transaction Isolation Level về mức READ UNCOMMITTED để các transaction không phải chờ đợi khóa lẫn nhau.',
        'Khởi tạo một biến toàn cục trong Singleton Service để lưu trữ số lượng tồn kho và đồng bộ định kỳ mỗi 5 phút một lần xuống cơ sở dữ liệu.'
      ],
      correctIndex: 0,
      explanation: 'Atomic Conditional Update ở mức Engine DB (`WHERE id = :id AND stock >= :qty`) là giải pháp nguyên tử, hiệu năng cao nhất: Không cần mở transaction dài, DB tự acquire row exclusive lock trong vài micro-giây, trừ tồn kho an toàn và trả về affected rows = 1 (thành công) hoặc 0 (hết hàng), triệt tiêu 100% race condition.'
    },
    {
      id: 'final-q14',
      question: 'Hiện tượng Deadlock (Khóa chết) giữa 2 transaction xảy ra khi nào và biện pháp phòng ngừa kiến trúc hiệu quả nhất là gì?',
      options: [
        'T1 giữ Resource A đòi Resource B, trong khi T2 giữ Resource B đòi Resource A; phòng ngừa bằng cách chuẩn hóa thứ tự chiếm khóa (Lock Ordering).',
        'Khi một transaction chạy quá 5 giây mà không commit; phòng ngừa bằng cách khởi động lại cơ sở dữ liệu sau mỗi 1000 lượt query.',
        'Khi hai client cùng gửi request sử dụng cùng một địa chỉ IP; phòng ngừa bằng cách chặn địa chỉ IP đó thông qua tường lửa mạng.',
        'Khi bảng dữ liệu có hơn 1 triệu dòng và không có index; phòng ngừa bằng cách chia nhỏ cơ sở dữ liệu thành các file Excel độc lập.'
      ],
      correctIndex: 0,
      explanation: 'Deadlock kinh điển phát sinh từ sự phụ thuộc vòng tròn về tài nguyên khóa (Circular Wait). Biện pháp phòng chống triệt để nhất từ tầng ứng dụng là áp dụng Strict Lock Ordering: Mọi transaction khi cần thao tác trên nhiều bản ghi (ví dụ: chuyển tiền tài khoản A và B) đều phải sắp xếp ID tăng dần trước khi khóa (`SELECT ... FOR UPDATE ORDER BY id ASC`).'
    },
    {
      id: 'final-q15',
      question: 'Sự khác biệt căn bản giữa hai mức cô lập giao dịch `READ COMMITTED` và `REPEATABLE READ` trong PostgreSQL là gì?',
      options: [
        'READ COMMITTED tạo Snapshot mới cho mỗi câu query, trong khi REPEATABLE READ tạo Snapshot một lần duy nhất tại thời điểm bắt đầu transaction.',
        'READ COMMITTED cho phép đọc các dữ liệu chưa được commit của transaction khác, trong khi REPEATABLE READ thì hoàn toàn nghiêm cấm.',
        'REPEATABLE READ sẽ tự động khóa toàn bộ bảng dữ liệu không cho bất kỳ ai đọc, trong khi READ COMMITTED chỉ khóa trên từng dòng dữ liệu.',
        'READ COMMITTED bắt buộc mọi câu lệnh truy vấn phải chạy qua bộ nhớ đệm Redis, trong khi REPEATABLE READ truy vấn trực tiếp vào ổ đĩa.'
      ],
      correctIndex: 0,
      explanation: 'Trong PostgreSQL: Ở mức READ COMMITTED, mỗi câu lệnh SQL bên trong transaction nhận một Snapshot mới (thấy dữ liệu commit bởi transaction khác giữa 2 lần SELECT). Ở mức REPEATABLE READ, Snapshot được cố định từ đầu transaction, đảm bảo đọc lặp lại luôn ra kết quả nhất quán (chống Non-repeatable Read).'
    },

    // ----------------------------------------------------
    // CHƯƠNG 6: REDIS CACHING & IN-MEMORY ARCHITECTURE
    // ----------------------------------------------------
    {
      id: 'final-q16',
      question: 'Khi triển khai Distributed Caching, hiện tượng "Cache Stampede" (hoặc Cache Breakdown) xảy ra trong kịch bản nào?',
      options: [
        'Một Hot Key chứa dữ liệu đắt đỏ bị hết hạn (TTL Expire), khiến hàng nghìn request đồng thời đổ dồn xuống DB cùng lúc để tính toán lại.',
        'Dung lượng RAM của máy chủ Redis bị cạn kiệt khiến tiến trình Redis bị hệ điều hành tiêu diệt bằng tín hiệu Out-Of-Memory Killer.',
        'Hacker liên tục gửi các request tìm kiếm các ID không hề tồn tại trong hệ thống nhằm làm tràn bộ nhớ đệm của máy chủ ứng dụng.',
        'Hai máy chủ backend cùng ghi đè một key trên Redis với hai kiểu dữ liệu khác nhau dẫn đến lỗi xung đột phiên bản dữ liệu nhị phân.'
      ],
      correctIndex: 0,
      explanation: 'Cache Stampede (hoặc Thundering Herd): Khi 1 hot key có hàng nghìn req/sec bất ngờ hết hạn TTL, toàn bộ các request này thấy cache miss và đồng loạt truy vấn xuống DB để tính toán lại cùng một dữ liệu đắt đỏ, dẫn đến CPU database tăng vọt 100% và làm tê liệt hệ thống. Giải pháp: Distributed Lock, Mutex hoặc XFetch probabilistic early expiration.'
    },
    {
      id: 'final-q17',
      question: 'Tại sao việc xóa khóa phân tán (Distributed Lock) trong Redis bắt buộc phải sử dụng đoạn mã Lua Script thay vì lệnh DEL thông thường?',
      options: [
        'Để đảm bảo tính nguyên tử: chỉ xóa khóa nếu giá trị ngẫu nhiên (UUID Token) của khóa trong Redis khớp chính xác với Token của caller hiện tại.',
        'Vì lệnh DEL của Redis không hỗ trợ xóa các khóa có chứa thời gian sống TTL được thiết lập lớn hơn 60 giây.',
        'Vì mã Lua Script chạy đa luồng trên toàn bộ các nhân của CPU giúp tăng tốc độ giải phóng bộ nhớ RAM cho hệ thống máy chủ.',
        'Để ngăn không cho các lập trình viên khác có thể theo dõi được lịch sử các thao tác xóa dữ liệu trên công cụ Redis Insight.'
      ],
      correctIndex: 0,
      explanation: 'Nếu lock hết hạn trước khi worker xử lý xong, một worker khác có thể acquire lock mới. Nếu worker cũ kết thúc và gọi `DEL lock_key`, nó sẽ vô tình giải phóng lock của worker mới! Dùng Lua Script giúp so sánh `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end` nguyên tử trong 1 bước.'
    },
    {
      id: 'final-q18',
      question: 'Chính sách đào thải dữ liệu `volatile-lru` trong Redis hoạt động dựa trên nguyên tắc nào khi bộ nhớ RAM đạt ngưỡng `maxmemory`?',
      options: [
        'Chỉ đào thải các key ít được sử dụng gần đây nhất (LRU) trong số những key CÓ thiết lập thời gian sống (TTL).',
        'Tự động xóa ngẫu nhiên bất kỳ key nào trong toàn bộ cơ sở dữ liệu kể cả những key không được thiết lập thời gian sống.',
        'Từ chối toàn bộ các câu lệnh ghi mới và trả về mã lỗi OOM mà không xóa bất kỳ key nào đang tồn tại trong bộ nhớ.',
        'Chuyển toàn bộ các key cũ sang lưu tạm trên ổ cứng SSD của máy chủ để giải phóng không gian cho các key mới được ghi vào.'
      ],
      correctIndex: 0,
      explanation: 'Cấu hình maxmemory-policy `volatile-lru` chỉ áp dụng thuật toán Least Recently Used trên tập hợp các key có cài đặt thời gian sống (has TTL). Các key vĩnh viễn (no expire) sẽ được giữ an toàn. Nếu muốn áp dụng LRU trên tất cả key thì dùng `allkeys-lru`.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 7: ASYNC QUEUES & BULLMQ BACKGROUND JOBS
    // ----------------------------------------------------
    {
      id: 'final-q19',
      question: 'Trong kiến trúc BullMQ, cơ chế "Stalled Job" được kích hoạt khi nào và nhằm mục đích gì?',
      options: [
        'Phát hiện worker đang xử lý job bị crash đột ngột hoặc mất kết nối mạng quá lâu để đưa job trở lại hàng đợi cho worker khác xử lý.',
        'Tự động tăng số lần retry của một job lên vô hạn nếu job đó bị lỗi do cơ sở dữ liệu PostgreSQL từ chối kết nối.',
        'Xóa bỏ toàn bộ các job có dung lượng payload lớn hơn 1MB ra khỏi bộ nhớ Redis để tránh làm nghẽn đường truyền dữ liệu.',
        'Chuyển đổi các job ưu tiên thấp thành các job ưu tiên cao khi phát hiện hàng đợi có số lượng job chờ lớn hơn 10.000 tác vụ.'
      ],
      correctIndex: 0,
      explanation: 'Trong BullMQ, worker định kỳ gia hạn lock cho job đang chạy qua heartbeat (lock renewal). Nếu worker bị OOM crash, segfault hoặc đứt mạng, lock bị hết hạn. BullMQ stall checker sẽ phát hiện job bị stalled, chuyển nó về trạng thái active/wait để worker khác nhận lại, bảo đảm nguyên lý At-least-once processing.'
    },
    {
      id: 'final-q20',
      question: 'Khi thiết kế hệ thống xử lý tác vụ nền với BullMQ, tại sao Job Processor bắt buộc phải có tính Idempotent (Bất biến)?',
      options: [
        'Vì BullMQ đảm bảo cam kết phân phối At-least-once (ít nhất một lần), một job có thể bị thực thi lại nếu xảy ra mạng chập chờn hoặc stall.',
        'Vì cơ chế của Redis Streams chỉ cho phép mỗi tin nhắn được gửi đi duy nhất một lần và không bao giờ cho phép thực thi lại.',
        'Vì việc xử lý bất biến giúp giảm thời gian chạy của các hàm mã hóa dữ liệu trong thư viện crypto của Node.js xuống một nửa.',
        'Vì các thư viện NestJS bắt buộc mọi hàm xử lý trong service phải trả về giá trị null nếu phát hiện có sự trùng lặp tham số đầu vào.'
      ],
      correctIndex: 0,
      explanation: 'Trong hệ thống phân tán, cơ chế giao vận tin nhắn tiêu chuẩn là "At-least-once". Khi worker xử lý xong nghiệp vụ (ví dụ trừ tiền) nhưng bị đứt mạng đúng lúc chuẩn bị gửi xác nhận ack về Redis, job sẽ bị đẩy lại cho worker khác chạy lại. Nếu processor không có tính Idempotent, lỗi double-processing sẽ xảy ra.'
    },
    {
      id: 'final-q21',
      question: 'Mục đích của việc sử dụng Dead Letter Queue (DLQ) trong hệ thống Message Queue là gì?',
      options: [
        'Cách ly các job bị lỗi liên tục sau khi đã thử lại hết số lần retry tối đa, bảo vệ hàng đợi chính không bị tắc nghẽn và cho phép kỹ sư điều tra.',
        'Tự động gửi email xin lỗi khách hàng mỗi khi có một tác vụ gửi thông báo đẩy bị thất bại do người dùng tắt mạng di động.',
        'Tự động xóa vĩnh viễn toàn bộ các bản ghi nhật ký hệ thống cũ hơn 30 ngày để giải phóng không gian lưu trữ cho máy chủ database.',
        'Tăng tốc độ xử lý của hàng đợi chính bằng cách bỏ qua toàn bộ các bước kiểm tra tính hợp lệ của dữ liệu trước khi đẩy vào hàng đợi.'
      ],
      correctIndex: 0,
      explanation: 'Dead Letter Queue (DLQ) là chốt chặn an toàn: Khi một job bị lỗi (Poison Message) và đã retry hết hạn ngạch (max retries), nó được chuyển sang DLQ để không làm nghẽn hàng đợi chính, đồng thời lưu giữ toàn bộ context, stack trace để kỹ sư phân tích nguyên nhân gốc (Root Cause) và replay lại khi đã fix bug.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 8: CRYPTOGRAPHY & AN NINH BACKEND
    // ----------------------------------------------------
    {
      id: 'final-q22',
      question: 'Tại sao thuật toán băm mật khẩu `Argon2id` được khuyến nghị vượt trội hơn so với `MD5` và `SHA-256` truyền thống?',
      options: [
        'Argon2id được thiết kế tốn kém bộ nhớ (Memory-Hard), chống lại hiệu quả các cuộc tấn công bẻ khóa hàng loạt bằng phần cứng chuyên dụng GPU/ASIC.',
        'Argon2id có tốc độ thực thi nhanh gấp 100 lần SHA-256 giúp máy chủ xử lý hàng triệu request đăng nhập trong cùng 1 giây.',
        'Argon2id cho phép người quản trị hệ thống có thể dễ dàng dịch ngược chuỗi băm để lấy lại mật khẩu gốc cho người dùng khi bị quên.',
        'Argon2id không sử dụng chuỗi muối ngẫu nhiên (Salt) nên dung lượng chuỗi băm ngắn hơn và tiết kiệm không gian lưu trữ trong DB.'
      ],
      correctIndex: 0,
      explanation: 'MD5 và SHA-256 là các hàm băm tốc độ cao được thiết kế cho checksum dữ liệu, khiến hacker có thể dùng GPU/ASIC thử hàng tỷ mật khẩu mỗi giây. Argon2id (kết hợp Argon2i chống Side-channel và Argon2d chống GPU) bắt buộc tiêu tốn cả RAM (Memory-Hard) và CPU time, vô hiệu hóa khả năng tấn công brute-force phần cứng.'
    },
    {
      id: 'final-q23',
      question: 'Trong cơ chế Refresh Token Rotation với Reuse Detection (Phát hiện tái sử dụng), điều gì xảy ra nếu kẻ xấu cố tình dùng lại một Refresh Token cũ đã bị xoay vòng?',
      options: [
        'Hệ thống phát hiện token cũ đã bị thu hồi, lập tức vô hiệu hóa toàn bộ chuỗi token (Family) của phiên đăng nhập đó và bắt user đăng nhập lại.',
        'Hệ thống tự động cấp phát một Access Token mới với thời hạn sử dụng vĩnh viễn để hỗ trợ người dùng không bị gián đoạn trải nghiệm.',
        'Máy chủ sẽ tự động chuyển hướng toàn bộ các kết nối mạng của kẻ tấn công sang một website khác để đánh lạc hướng.',
        'Cơ sở dữ liệu sẽ tự động xóa tài khoản của người dùng đó ra khỏi hệ thống để đảm bảo an toàn tuyệt đối cho các tài khoản khác.'
      ],
      correctIndex: 0,
      explanation: 'Refresh Token Rotation cấp 1 token mới và invalidate token cũ ở mỗi lần cấp lại. Nếu token cũ đã invalidated bị gửi lên lần nữa, hệ thống nhận diện token đã bị lộ (bị chặn bắt hoặc rò rỉ). Cơ chế Token Family Revocation lập tức thu hồi toàn bộ token liên quan trong gia đình token đó, buộc người dùng thực sự phải đăng nhập lại.'
    },
    {
      id: 'final-q24',
      question: 'Để bảo vệ cookie phiên làm việc (Session/Auth Cookie) chống lại hoàn toàn các cuộc tấn công XSS và Man-in-the-Middle, tổ hợp cờ nào là bắt buộc?',
      options: [
        '`HttpOnly; Secure; SameSite=Strict` (hoặc Lax)',
        '`Domain=*; Path=/; MaxAge=Infinity`',
        '`AllowScriptAccess=true; Secure=false; SameSite=None`',
        '`HttpOnly=false; Encrypt=AES; SameSite=CrossSite`'
      ],
      correctIndex: 0,
      explanation: 'Tổ hợp phòng thủ chiều sâu cho Cookie: `HttpOnly` ngăn chặn JavaScript đọc cookie qua `document.cookie` (chống XSS đánh cắp session), `Secure` bảo đảm cookie chỉ được truyền qua kênh mã hóa HTTPS (chống MitM eavesdropping), `SameSite=Strict/Lax` ngăn trình duyệt tự động đính kèm cookie trong các request cross-site (chống CSRF).'
    },

    // ----------------------------------------------------
    // CHƯƠNG 9: HỆ THỐNG PHÂN TÁN & MỞ RỘNG
    // ----------------------------------------------------
    {
      id: 'final-q25',
      question: 'Định lý CAP phát biểu rằng khi xảy ra Phân vùng mạng (Network Partition - P), một hệ thống phân tán bắt buộc phải lựa chọn đánh đổi giữa hai yếu tố nào?',
      options: [
        'Tính Nhất Quán (Consistency - C) và Tính Sẵn Sàng (Availability - A).',
        'Tính Hiệu Năng (Performance) và Khả Năng Mở Rộng Dung Lượng (Scalability).',
        'Độ An Toàn Dữ Liệu (Security) và Tốc Độ Bắt Tay Mạng (Latency).',
        'Chi Phí Thuê Máy Chủ (Cost) và Độ Bền Bỉ Của Phần Cứng Lưu Trữ (Durability).'
      ],
      correctIndex: 0,
      explanation: 'Theo định lý CAP của Eric Brewer: Khi có sự cố đứt đoạn mạng giữa các nodes (Partition Tolerance - P là thực tế không thể tránh khỏi trong mạng phân tán), hệ thống buộc phải chọn: Hoặc là từ chối phục vụ một số node để bảo toàn tính nhất quán (CP - Consistency), hoặc là tiếp tục phục vụ với nguy cơ dữ liệu không đồng nhất (AP - Availability).'
    },
    {
      id: 'final-q26',
      question: 'Kỹ thuật Consistent Hashing (Băm nhất quán) giải quyết nhược điểm chí mạng nào của thuật toán băm modulo truyền thống `hash(key) % N` khi mở rộng cụm node?',
      options: [
        'Hạn chế tối đa số lượng key phải di chuyển (Rehash) khi thêm hoặc bớt một node trong cụm từ N sang N+1.',
        'Tăng tốc độ mã hóa dữ liệu người dùng lên gấp 10 lần nhờ việc phân bổ các key vào cùng một phân vùng duy nhất.',
        'Cho phép lưu trữ dữ liệu không giới hạn trên một máy chủ duy nhất mà không cần phải kết nối thêm các máy chủ phụ trợ.',
        'Tự động đồng bộ toàn bộ dữ liệu của cơ sở dữ liệu quan hệ sang định dạng NoSQL Document mà không cần viết script chuyển đổi.'
      ],
      correctIndex: 0,
      explanation: 'Với thuật toán `hash(key) % N`, khi số lượng node thay đổi từ N sang N+1, hầu như toàn bộ vị trí các key đều bị thay đổi (`k % N != k % (N+1)`), gây ra hiện tượng 100% cache miss làm sập DB. Consistent Hashing sắp xếp node và key trên một vòng tròn (Hash Ring), khi thêm/bớt 1 node chỉ có trung bình `K/N` keys phải di dời.'
    },
    {
      id: 'final-q27',
      question: 'Khi thực hiện giao dịch phân tán trên nhiều Microservices, mẫu thiết kế Saga (Orchestration/Choreography) xử lý thất bại bằng cơ chế nào?',
      options: [
        'Thực thi chuỗi các Giao dịch bù trừ (Compensating Transactions) theo thứ tự ngược lại để hoàn tác trạng thái nghiệp vụ.',
        'Khóa cứng toàn bộ các bảng cơ sở dữ liệu trên tất cả các microservices cho đến khi toàn bộ mạng hoạt động ổn định trở lại.',
        'Tự động hủy bỏ việc triển khai mã nguồn của các microservices liên quan và quay trở lại phiên bản cũ trên môi trường staging.',
        'Gửi thông báo lỗi cho người dùng và yêu cầu người dùng phải tự liên hệ với ngân hàng để lấy lại số tiền đã bị trừ trong tài khoản.'
      ],
      correctIndex: 0,
      explanation: 'Mô hình 2PC (Two-Phase Commit) dễ gây block tài nguyên diện rộng và không phù hợp với microservices độc lập. Mẫu kiến trúc Saga phân rã giao dịch thành chuỗi các local transactions. Nếu một bước thất bại (ví dụ: kho hết hàng), Saga sẽ kích hoạt chuỗi Compensating Transactions (ví dụ: hoàn tiền vào ví khách) theo chiều ngược lại.'
    },

    // ----------------------------------------------------
    // CHƯƠNG 10: QUAN SÁT & VẬN HÀNH HỆ THỐNG SẢN XUẤT
    // ----------------------------------------------------
    {
      id: 'final-q28',
      question: 'Trong chuẩn Distributed Tracing (OpenTelemetry / W3C TraceContext), hai header `traceparent` và `tracestate` phục vụ mục đích cốt lõi nào?',
      options: [
        'Lan truyền ngữ cảnh vết (Trace ID và Span ID) xuyên suốt qua các tầng mạng và các microservices khác nhau để liên kết toàn bộ hành trình của 1 request.',
        'Lưu trữ thông tin thẻ tín dụng của khách hàng để phục vụ việc thanh toán tự động cho các request tiếp theo.',
        'Xác thực mật khẩu quản trị viên cấp cao của hệ thống hạ tầng Kubernetes cluster nhằm ngăn chặn việc thâm nhập trái phép.',
        'Chuyển đổi toàn bộ các câu lệnh SQL trong database thành định dạng GraphQL trước khi gửi dữ liệu về cho client hiển thị.'
      ],
      correctIndex: 0,
      explanation: 'W3C TraceContext chuẩn hóa việc truyền Trace Context qua HTTP headers: `traceparent` mang version, TraceId (định danh toàn bộ hành trình), ParentSpanId (định danh bước gọi trước) và TraceFlags (lấy mẫu hay không). Nhờ đó, công cụ APM (Jaeger, Tempo) có thể vẽ nên toàn bộ Waterfall Trace xuyên qua 20 microservices.'
    },
    {
      id: 'final-q29',
      question: 'Chiến lược triển khai "Blue-Green Deployment" giúp đạt được mục tiêu Zero-Downtime Deployment dựa trên nguyên lý vận hành nào?',
      options: [
        'Duy trì song song hai môi trường sản xuất giống hệt nhau (Blue đang chạy, Green cập nhật mới), sau khi test pass thì chuyển router/load-balancer sang Green.',
        'Tắt toàn bộ hệ thống vào lúc 2 giờ sáng, cập nhật mã nguồn mới trong 30 phút rồi bật lại máy chủ để người dùng truy cập.',
        'Xóa toàn bộ cơ sở dữ liệu cũ và yêu cầu người dùng phải tạo lại tài khoản mới sau mỗi đợt phát hành phiên bản tính năng lớn.',
        'Triển khai mã nguồn trực tiếp lên máy chủ đang chạy mà không cần khởi động lại tiến trình Node.js nhằm giảm độ trễ của mạng nội bộ.'
      ],
      correctIndex: 0,
      explanation: 'Blue-Green Deployment chạy 2 cụm môi trường độc lập hoàn toàn. Bản Blue đang phục vụ live traffic, bản Green được deploy version mới và kiểm thử kỹ lưỡng (smoke test). Khi đã sẵn sàng, Load Balancer chỉ việc trỏ router sang cụm Green trong tích tắc. Nếu có sự cố, rollback chỉ tốn vài mili-giây bằng cách trỏ ngược lại Blue.'
    },
    {
      id: 'final-q30',
      question: 'Sự khác biệt cốt lõi giữa "Liveness Probe" và "Readiness Probe" trong hạ tầng điều phối container (Kubernetes) là gì?',
      options: [
        'Liveness kiểm tra container còn sống không để khởi động lại nếu bị treo; Readiness kiểm tra ứng dụng đã sẵn sàng tiếp nhận traffic mạng hay chưa.',
        'Readiness kiểm tra container còn sống không để khởi động lại nếu bị treo; Liveness kiểm tra ứng dụng đã sẵn sàng tiếp nhận traffic mạng hay chưa.',
        'Liveness chỉ dùng cho các ứng dụng cơ sở dữ liệu; Readiness chỉ dùng cho các ứng dụng giao diện người dùng viết bằng React.',
        'Cả hai probe đều thực hiện cùng một chức năng là tự động scale tăng số lượng container khi lượng truy cập mạng tăng đột biến.'
      ],
      correctIndex: 0,
      explanation: 'Trong Kubernetes: `Liveness Probe` phát hiện deadlock/freeze: nếu fail liên tục, Kubelet sẽ tiêu diệt và restart pod. `Readiness Probe` kiểm tra ứng dụng đã hoàn tất warmup/kết nối DB chưa: nếu fail, Kubelet tạm thời rút pod khỏi danh sách Endpoint của Service để không gửi traffic đến, pod không bị restart.'
    }
  ],
  codeChallenges: [
    {
      id: 'final-capstone-1',
      title: 'Capstone 1: Atomic Stock Transfer Với Idempotency & Tenant Scoping',
      description: 'Hiện thực hàm `executeStockTransfer(prismaMock, unitId, payload)`: Chuyển tồn kho giữa hai kho hàng nội bộ. Yêu cầu: 1. Validate `unitId`, `fromItemId`, `toItemId`, `quantity > 0` và hai kho phải khác nhau; 2. Trong transaction: Dùng `updateMany` trừ tồn kho có điều kiện `{ id: fromItemId, unitId, stock: { gte: quantity } }`, nếu `count !== 1` ném lỗi `INSUFFICIENT_STOCK`; 3. Cộng tồn kho kho đích bằng `updateMany`; 4. Ghi nhận nhật ký chuyển kho `tx.transferLog.create`. Trả về `{ success: true, transferId: payload.idempotencyKey }`.',
      starterCode: `async function executeStockTransfer(prismaMock, unitId, payload) {
  // TODO: Hiện thực chuyển kho nguyên tử an toàn Concurrency
  // payload: { fromItemId: string, toItemId: string, quantity: number, idempotencyKey: string }
  // 1. Kiểm tra validation (unitId, fromItemId, toItemId, quantity > 0, from !== to)
  // 2. Chạy prismaMock.$transaction:
  //    - Trừ kho nguồn với điều kiện stock >= quantity
  //    - Cộng kho đích
  //    - Tạo transferLog ghi nhận idempotencyKey
  // 3. Trả về: { success: true, transferId: payload.idempotencyKey }

}`,
      testCases: [
        {
          input: [
            {
              $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
                inventoryItem: {
                  updateMany: async (args: { where: { id: string; stock?: { gte: number } } }) => {
                    if (args.where.stock && args.where.stock.gte > 50) {
                      return { count: 0 }; // Không đủ hàng
                    }
                    return { count: 1 };
                  }
                },
                transferLog: {
                  create: async () => ({ id: 'log-01' })
                }
              })
            },
            'tenant-hanoi-01',
            { fromItemId: 'kho-A', toItemId: 'kho-B', quantity: 20, idempotencyKey: 'idemp-tx-1001' }
          ],
          expected: { success: true, transferId: 'idemp-tx-1001' },
          description: 'Chuyển kho hợp lệ với số lượng tồn kho đáp ứng phải thành công'
        },
        {
          input: [
            {
              $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({
                inventoryItem: {
                  updateMany: async () => ({ count: 0 })
                },
                transferLog: {
                  create: async () => ({})
                }
              })
            },
            'tenant-hanoi-01',
            { fromItemId: 'kho-A', toItemId: 'kho-B', quantity: 9999, idempotencyKey: 'idemp-tx-1002' }
          ],
          expected: 'INSUFFICIENT_STOCK',
          description: 'Số lượng tồn kho không đủ phải bị từ chối với lỗi INSUFFICIENT_STOCK'
        }
      ]
    },
    {
      id: 'final-capstone-2',
      title: 'Capstone 2: Request Pipeline Interceptor, Validation & Custom Error Sanitizer',
      description: 'Hiện thực hàm `handleCreateOrder(req, res, next)`: 1. Trích xuất `items` (mảng) và `customerEmail` từ `req.body`; 2. Nếu `customerEmail` không hợp lệ (không chứa `@`) hoặc `items` rỗng/không phải mảng, trả về `res.status(400).json({ error: "BAD_INPUT", message: "Invalid order payload" })`; 3. Nếu hợp lệ, tính `totalItems = items.reduce((sum, i) => sum + i.quantity, 0)`, trả về `res.status(201).json({ success: true, order: { email: customerEmail.trim().toLowerCase(), totalItems } })`; 4. Bắt mọi ngoại lệ bất ngờ bằng khối try/catch và chuyển cho `next(error)`.',
      starterCode: `async function handleCreateOrder(req, res, next) {
  // TODO: Hiện thực Pipeline xử lý đơn hàng an toàn
  // 1. Validate email và mảng items
  // 2. Trả về 400 nếu dữ liệu không hợp lệ
  // 3. Tính toán và trả về 201 cùng dữ liệu đã được làm sạch
  // 4. Bọc try/catch và chuyển tiếp lỗi cho next(error)

}`,
      testCases: [
        {
          input: [
            {
              body: {
                customerEmail: '  KHONGMINH@GMAIL.COM  ',
                items: [{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 3 }]
              }
            },
            {
              statusCode: 200,
              status(code: number) { this.statusCode = code; return this; },
              json(payload: Record<string, unknown>) { return { statusCode: this.statusCode, ...payload }; }
            },
            () => {}
          ],
          expected: {
            statusCode: 201,
            success: true,
            order: {
              email: 'khongminh@gmail.com',
              totalItems: 5
            }
          },
          description: 'Payload đơn hàng hợp lệ phải trả về status 201 và email được sanitize chuẩn'
        },
        {
          input: [
            { body: { customerEmail: 'invalid-email', items: [] } },
            {
              statusCode: 200,
              status(code: number) { this.statusCode = code; return this; },
              json(payload: Record<string, unknown>) { return { statusCode: this.statusCode, ...payload }; }
            },
            () => {}
          ],
          expected: {
            statusCode: 400,
            error: 'BAD_INPUT',
            message: 'Invalid order payload'
          },
          description: 'Email sai định dạng hoặc mảng items rỗng phải trả về status 400'
        }
      ]
    },
    {
      id: 'final-capstone-3',
      title: 'Capstone 3: Resilient Job Processor Với Exponential Backoff Retry',
      description: 'Hiện thực hàm `processJobWithBackoff(job, processFn, maxRetries = 3)`: Thực thi `processFn(job)`. Mỗi lần thử, tăng `job.attempts = (job.attempts || 0) + 1`. Nếu thành công, trả về `{ success: true, result: res, attempts: job.attempts }`. Nếu thất bại và chưa vượt quá `maxRetries`, đợi một khoảng thời gian tăng dần và thử lại. Nếu vượt quá `maxRetries`, ném lỗi hoặc trả về `{ success: false, error: err.message, attempts: job.attempts, deadLetter: true }`.',
      starterCode: `async function processJobWithBackoff(job, processFn, maxRetries = 3) {
  // TODO: Hiện thực Background Job Processor có cơ chế Retry & Dead Letter Queue
  // 1. Lặp qua các lần thử từ 1 đến maxRetries
  // 2. Cập nhật job.attempts ở mỗi vòng lặp
  // 3. Nếu thành công: return { success: true, result: ..., attempts: job.attempts }
  // 4. Nếu vượt quá maxRetries: return { success: false, error: ..., attempts: job.attempts, deadLetter: true }

}`,
      testCases: [
        {
          input: [
            { id: 'job-payout-01', data: { amount: 1500000 }, attempts: 0 },
            async (job: { attempts: number }) => {
              if (job.attempts < 2) {
                throw new Error('Bank Gateway 504 Timeout');
              }
              return { transactionId: 'TX-BANK-8899', status: 'PAID' };
            },
            3
          ],
          expected: {
            success: true,
            result: { transactionId: 'TX-BANK-8899', status: 'PAID' },
            attempts: 2
          },
          description: 'Job gặp lỗi timeout ở lần 1 nhưng thành công ở lần 2 phải ghi nhận attempts = 2'
        },
        {
          input: [
            { id: 'job-payout-02', data: { amount: 500000 }, attempts: 0 },
            async () => {
              throw new Error('Account Frozen by Compliance');
            },
            3
          ],
          expected: {
            success: false,
            error: 'Account Frozen by Compliance',
            attempts: 3,
            deadLetter: true
          },
          description: 'Job thất bại liên tục vượt quá 3 lần phải bị đánh dấu chuyển vào deadLetter'
        }
      ]
    }
  ]
};
