import type { Sprint } from './types.ts';

export const chapter3: Sprint = {
  sprintId: 3,
  sprintTitle: 'Chương 3: Giao Thức Mạng Sâu Sắc: TCP Sockets, HTTP/1.1 Đến HTTP/3, TLS & An Toàn Web',
  sprintDesc: 'Làm chủ tầng mạng Backend: TCP 3-Way Handshake, Head-of-Line Blocking, HTTP/2 Multiplexing, HTTP/3 (QUIC/UDP), Idempotency Keys và Cơ chế CORS/Cookie Security',
  lessons: [
    {
      id: 'c3-l1',
      title: 'Bài 01: Tầng Giao Vận (Transport Layer): TCP Sockets, 3-Way Handshake, Head-of-Line Blocking & HTTP/3 QUIC',
      duration: '60 phút',
      tag: 'Networking & Transport Layer',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: ĐỘ TRỄ GIAO VẬN MẠNG & NGHẼN TẮC HEAD-OF-LINE BLOCKING

Khi lập trình viên frontend thực hiện một lời gọi API đơn giản như \`fetch('/api/v1/orders')\`, ở tầng mạng vật lý là cả một chuỗi thủ tục bắt tay và kiểm soát luồng phức tạp:

* **Chi phí Bắt tay 3 Bước TCP (3-Way Handshake Overhead):**
  - Trước khi bất kỳ byte dữ liệu HTTP nào được phép truyền đi, máy khách (Client) và máy chủ (Server) bắt buộc phải trải qua tiến trình đồng bộ hóa trạng thái tuần tự: SYN (Sequence Number từ Client) $\rightarrow$ SYN-ACK (Server xác nhận và gửi Seq của Server) $\rightarrow$ ACK (Client xác nhận hoàn tất kết nối).
  - Kết hợp với bước bắt tay bảo mật TLS 1.3 (Trao đổi khóa Diffie-Hellman và chứng chỉ SSL), tiến trình này tiêu tốn từ 2 đến 3 vòng lặp mạng (Round Trip Time — RTT).
  - **Tác động vật lý:** Nếu Client ở TP. Hồ Chí Minh gọi Server đặt tại Singapore (RTT ~35ms), chỉ riêng việc mở kết nối TCP đã tốn gần 100ms trước khi request được xử lý.

* **Nghịch lý Multiplexing trong HTTP/2 & Tắc nghẽn Head-of-Line (HoL) Blocking:**
  - HTTP/2 ra đời với đột phá kỹ thuật **Ghép luồng nhị phân (Binary Multiplexing)**: Cho phép hàng trăm request/response chạy song song trên cùng một kết nối TCP duy nhất, xóa bỏ giới hạn 6 kết nối TCP của HTTP/1.1.
  - Tuy nhiên, điểm yếu chết người của HTTP/2 nằm ở chính tầng truyền vận TCP bên dưới: TCP coi toàn bộ dữ liệu trên kết nối là một dòng byte liên tục có thứ tự nghiêm ngặt (In-order Byte Stream).
  - **Kịch bản mất gói (Packet Loss):** Khi có một gói tin TCP bị rớt trên đường truyền (do sóng Wifi chập chờn hoặc nghẽn router), toàn bộ nhân hệ điều hành (Kernel TCP Stack) buộc phải dừng lại, giữ toàn bộ các gói tin tiếp theo trong bộ nhớ đệm (Receive Buffer) để chờ gói tin mất được truyền lại (TCP Retransmission).
  - **Hệ quả kiến trúc:** Mặc dù 99 stream khác hoàn toàn không bị lỗi, chúng đều bị đóng băng chung trong kết nối TCP đó!

* **Đột phá Giao Thức HTTP/3 trên nền tảng QUIC (UDP):**
  - Để giải quyết dứt điểm rào cản 30 năm của TCP, giao thức HTTP/3 loại bỏ hoàn toàn TCP và chuyển sang chạy trên **QUIC (nền tảng UDP)**.
  - QUIC quản lý các luồng độc lập ở cấp độ giao thức ứng dụng: Mỗi stream HTTP/3 sở hữu bộ điều khiển luồng (Flow Control) và kiểm soát mất gói riêng biệt. Việc rớt packet ở Stream A hoàn toàn không ảnh hưởng tới Stream B, đưa độ trễ bắt tay mạng về mức tối ưu $0\text{-RTT}$ (Zero Round Trip Time) khi tái kết nối.

---

# 2. VÒNG ĐỜI KẾT NỐI TCP & CHI PHÍ BẮT TAY MẠNG (HANDSHAKE OVERHEAD)

Mọi yêu cầu HTTP/1.1 hoặc HTTP/2 đều bắt đầu bằng giao vận TCP:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TCP 3-WAY HANDSHAKE + TLS 1.3                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ CLIENT                                                         SERVER       │
│   │                                                              │          │
│   ├────── 1. SYN (Sequence = 100) ──────────────────────────────►│ (1/2 RTT)│
│   │                                                              │          │
│   │◄───── 2. SYN-ACK (Seq = 300, Ack = 101) ─────────────────────┤ (1 RTT)  │
│   │                                                              │          │
│   ├────── 3. ACK (Seq = 101, Ack = 301) + Client Hello (TLS) ───►│ (1.5 RTT)│
│   │                                                              │          │
│   │◄───── 4. Server Hello + Certificate + Key Exchange ──────────┤ (2 RTT)  │
│   │                                                              │          │
│   ├────── 5. HTTP GET /api/data (DỮ LIỆU ĐẦU TIÊN ĐƯỢC GỬI) ────►│ (2.5 RTT)│
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 2.1 Chi Phí Vật Lý Của Round Trip Time (RTT)
* Nếu người dùng ở London gửi request đến server tại Singapore: RTT đường truyền cáp quang biển tối thiểu là **~150ms**.
* Với TCP + TLS 1.2 cũ: Cần 3 RTT = **450ms chỉ để bắt tay**, người dùng phải chờ gần nửa giây trước khi server nhận được request!
* Với TLS 1.3: Rút ngắn handshake xuống còn 1 RTT.
* Với HTTP/3 (QUIC 0-RTT Reconnection): Nếu client đã từng kết nối trước đó, dữ liệu HTTP có thể được gửi đi ngay trong gói tin đầu tiên ($0\\text{ RTT}$)!

---

# 3. TIẾN HÓA TỪ HTTP/1.1, HTTP/2 ĐẾN HTTP/3

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BẢNG TIẾN HÓA CÁC THẾ HỆ GIAO THỨC                     │
├──────────────┬───────────────────┬──────────────────────────────────────────┤
│ Giao Thức    │ Tầng Giao Vận     │ Đặc Tính Kỹ Thuật Đột Phá                │
├──────────────┼───────────────────┼──────────────────────────────────────────┤
│ HTTP/1.1     │ TCP               │ Keep-Alive (tái sử dụng connection),     │
│              │                   │ Bị HTTP Head-of-Line Blocking            │
├──────────────┼───────────────────┼──────────────────────────────────────────┤
│ HTTP/2       │ TCP               │ Multiplexing (ghép kênh nhiều request    │
│              │                   │ trên 1 TCP stream), Nén Header HPACK,   │
│              │                   │ Bị TCP-level Head-of-Line Blocking       │
├──────────────┼───────────────────┼──────────────────────────────────────────┤
│ HTTP/3       │ UDP (QUIC Engine) │ Hoàn toàn miễn nhiễm với HoL Blocking,   │
│              │                   │ Connection Migration (Đổi IP không đứt)  │
└──────────────┴───────────────────┴──────────────────────────────────────────┘
\`\`\`

### 3.1 Khắc Phục Multiplexing Của HTTP/2
Trong HTTP/1.1, để tải 10 ảnh đồng thời, trình duyệt phải mở 6 kết nối TCP riêng biệt. Trong HTTP/2, chỉ cần **1 kết nối TCP duy nhất** chứa hàng trăm luồng nhị phân (Binary Streams).
Tuy nhiên, vì HTTP/2 vẫn chạy trên nền TCP: Nếu 1 packet bị mất trên đường truyền internet, **toàn bộ các stream khác trên kết nối TCP đó đều bị dừng lại chờ truyền lại (TCP HoL Blocking)**!
HTTP/3 giải quyết triệt để vấn đề này bằng cách chuyển nền tảng sang UDP kết hợp bộ máy QUIC kiểm soát lỗi độc lập trên từng Stream.

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Tầng Giao Thức Mạng (Network Protocol Stack Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. APPLICATION LAYER (Ứng dụng)                                             │
│    [ HTTP/1.1: Plaintext ]     [ HTTP/2: Binary Frames ]   [ HTTP/3: QPACK ]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. SECURITY LAYER (Mật mã)                                                  │
│    [ TLS 1.2 / TLS 1.3 ] ──────────────────────► [ QUIC Crypto Built-in ]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TRANSPORT LAYER (Giao vận)                                               │
│    [ TCP (Tin cậy, Bắt tay 3 bước, HoL Block) ]  [ UDP (QUIC Streams) ]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. INTERNET & LINK LAYER (Vật lý)                                           │
│    [ IPv4 / IPv6 Packets ] ◄───────────────────► [ Ethernet / Fiber Optic ] │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: So Sánh Xử Lý Khi Mất Gói Tin (Packet Loss Behavior)
\`\`\`diagram
HTTP/2 TRÊN NỀN TCP:
Gói 1 (Stream A) ──► Thành công
Gói 2 (Stream B) ──► BỊ MẤT PACKET! ──► DỪNG TOÀN BỘ ĐƯỜNG TRUYỀN!
Gói 3 (Stream C) ──► Đã tới nhưng bị Kernel giữ lại, không giao cho App!
(Stream C vô tội vẫn phải đợi Stream B truyền lại xong mới được xử lý).

HTTP/3 TRÊN NỀN QUIC (UDP):
Gói 1 (Stream A) ──► Thành công
Gói 2 (Stream B) ──► BỊ MẤT PACKET! ──► Chỉ có Stream B đợi truyền lại!
Gói 3 (Stream C) ──► Bàn giao ngay lập tức cho Application xử lý!
(Các Stream hoạt động độc lập hoàn toàn, không gây nghẽn chéo).
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Giao Thức (Protocol Selection Tree)
\`\`\`diagram
BẠN ĐANG THIẾT KẾ GIAO TIẾP MẠNG CHO HỆ THỐNG NÀO?
│
├── Giao tiếp giữa Trình duyệt (Browser / Mobile) đến Backend Gateway?
│   ├── Khách hàng dùng mạng di động (4G/5G, Wifi chập chờn, hay đổi IP)?
│   │   └──► BẮT BUỘC HTTP/3 (QUIC) để có Connection Migration & 0-RTT
│   └── Mạng cố định, đường truyền ổn định:
│       └──► HTTP/2 (Multiplexing, nén Header)
│
├── Giao tiếp nội bộ giữa các Microservices (Service-to-Service)?
│   ├── Yêu cầu độ trễ cực thấp, High Throughput:
│   │   └──► gRPC trên nền HTTP/2 (Protobuf nhị phân)
│   └── Giao tiếp đơn giản, dễ debug:
│       └──► HTTP/1.1 hoặc HTTP/2 kèm Keep-Alive connection pooling
│
└── Giao tiếp Real-time hai chiều liên tục (Chat, Giá vàng, Cổ phiếu)?
    └──► WebSockets (TCP Full-duplex) hoặc WebTransport (QUIC Datagrams)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Tiêu Chí Kỹ Thuật | HTTP/1.1 | HTTP/2 | HTTP/3 (QUIC) |
| :--- | :--- | :--- | :--- |
| **Định dạng dữ liệu** | Văn bản thô (Plaintext Text) | Nhị phân (Binary Frames) | Nhị phân (Binary Frames + QPACK) |
| **Số kết nối TCP cần thiết**| 6 kết nối trên mỗi domain | 1 kết nối duy nhất | 0 TCP (Chạy hoàn toàn trên UDP) |
| **Khả năng ghép kênh** | Không (Chỉ 1 req/res tại 1 thời điểm)| Multiplexing trên 1 TCP stream | Ghép kênh đa luồng độc lập hoàn toàn |
| **Nghẽn Head-of-Line** | Bị nghẽn ở tầng Application | Bị nghẽn ở tầng TCP khi mất gói | Hoàn toàn triệt tiêu HoL Blocking |
| **Chi phí tính toán CPU** | Rất thấp (dễ parse text) | Trung bình (parse frames) | Cao hơn ở tầng User Space (UDP crypto) |
`,
      realCodeSnippet: `// File: src/modules/network/http2/http2-multiplex-client.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - High-Concurrency HTTP/2 Multiplexing Client
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as http2 from 'http2';

export interface MultiplexResponse {
  path: string;
  statusCode: number;
  data: string;
  durationMs: number;
}

/**
 * ADR: Tối ưu hóa giao tiếp Microservices bằng HTTP/2 Multiplexing:
 * - Thay vì tạo hàng trăm kết nối TCP riêng lẻ (gây tốn RTT handshake và TIME_WAIT sockets),
 *   dịch vụ duy trì một ClientHttp2Session duy nhất và mở các luồng nhị phân (Streams) song song.
 * - Hỗ trợ tự động phục hồi kết nối khi session bị đứt và giám sát thời gian phản hồi từng stream.
 */
@Injectable()
export class Http2MultiplexClientService implements OnModuleDestroy {
  private readonly logger = new Logger(Http2MultiplexClientService.name);
  private activeSession: http2.ClientHttp2Session | null = null;

  public async fetchBatchMultiplexed(baseUrl: string, paths: string[]): Promise<MultiplexResponse[]> {
    if (!baseUrl || !Array.isArray(paths) || paths.length === 0) {
      throw new Error('INVALID_HTTP2_REQUEST_PARAMETERS');
    }

    const session = this.getOrCreateSession(baseUrl);

    const streamPromises = paths.map((path) => {
      return new Promise<MultiplexResponse>((resolve, reject) => {
        const startTime = Date.now();
        const req = session.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
          [http2.constants.HTTP2_HEADER_METHOD]: 'GET',
          [http2.constants.HTTP2_HEADER_PATH]: path,
        });

        let statusCode = 200;
        let responseData = '';

        req.on('response', (headers) => {
          const rawStatus = headers[http2.constants.HTTP2_HEADER_STATUS];
          statusCode = typeof rawStatus === 'number' ? rawStatus : 200;
        });

        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          responseData += chunk;
        });

        req.on('end', () => {
          resolve({
            path,
            statusCode,
            data: responseData,
            durationMs: Date.now() - startTime,
          });
        });

        req.on('error', (err) => {
          this.logger.error(\`Stream error on path \${path}: \${err.message}\`);
          reject(err);
        });

        req.end();
      });
    });

    return Promise.all(streamPromises);
  }

  private getOrCreateSession(baseUrl: string): http2.ClientHttp2Session {
    if (this.activeSession && !this.activeSession.closed && !this.activeSession.destroyed) {
      return this.activeSession;
    }

    this.activeSession = http2.connect(baseUrl);
    this.activeSession.on('error', (err) => {
      this.logger.error(\`HTTP/2 Session Error: \${err.message}\`);
      this.activeSession = null;
    });

    return this.activeSession;
  }

  onModuleDestroy(): void {
    if (this.activeSession && !this.activeSession.closed) {
      this.activeSession.close();
      this.activeSession = null;
    }
  }
}`,
      quiz: [
        {
          id: 'c3-l1-q1',
          question: 'Hiện tượng TCP Head-of-Line (HoL) Blocking trong giao thức HTTP/2 để lại hậu quả nghiêm trọng nhất nào khi đường truyền mạng xuất hiện tỷ lệ mất gói tin (Packet Loss)?',
          options: [
            'Trình duyệt web sẽ tự động ngắt kết nối TLS và chuyển sang truyền dữ liệu dạng văn bản không mã hóa qua cổng 80.',
            'Một packet của một stream duy nhất bị rớt sẽ khiến Kernel TCP Stack dừng việc bàn giao toàn bộ dòng byte tiếp theo vào Receive Buffer, làm đóng băng toàn bộ hàng chục stream độc lập khác đang chạy trên cùng kết nối TCP đó cho đến khi gói tin mất được truyền lại.',
            'Toàn bộ bảng nén tiêu đề HPACK bị hỏng khiến máy chủ phải khởi động lại toàn bộ tiến trình ứng dụng backend.',
            'Máy chủ sẽ gửi gói tin TCP RST và ép buộc tất cả các client phải thực hiện lại quy trình bắt tay 3 bước từ đầu.'
          ],
          correctIndex: 1,
          explanation: 'Điểm yếu cốt lõi của HTTP/2 là chạy multiplexing trên 1 kết nối TCP duy nhất. Vì TCP bảo đảm thứ tự byte nghiêm ngặt ở tầng giao vận, nếu 1 packet bị mất (dù thuộc stream nào), kernel phải giữ lại toàn bộ dữ liệu tiếp theo để chờ retransmission, làm tê liệt đồng loạt mọi stream khác trên kết nối đó.'
        },
        {
          id: 'c3-l1-q2',
          question: 'Giao thức HTTP/3 chuyển sang chạy trên nền tảng QUIC (sử dụng UDP) nhằm đạt được đột phá kiến trúc mang tính quyết định nào?',
          options: [
            'Loại bỏ hoàn toàn sự cần thiết của chứng chỉ số SSL/TLS giúp giảm chi phí mua chứng chỉ hàng năm cho doanh nghiệp.',
            'Cho phép máy chủ gửi dữ liệu trực tiếp vào bộ nhớ RAM của card mạng (NIC) mà không thông qua hệ điều hành.',
            'Tự động nhân bản các gói tin mạng gửi qua nhiều đường truyền song song nhằm tăng gấp 4 lần tốc độ tải trang.',
            'Quản lý các stream độc lập ở tầng ứng dụng (Application Layer Flow Control), cho phép mất gói ở một stream không ảnh hưởng đến các stream khác (triệt tiêu hoàn toàn HoL Blocking) và hỗ trợ Connection Migration (giữ nguyên kết nối khi đổi IP mạng).'
          ],
          correctIndex: 3,
          explanation: 'QUIC chạy trên UDP nên không bị ràng buộc bởi hàng đợi tuần tự tầng kernel của TCP. Từng stream trong HTTP/3 được kiểm soát lỗi và luồng độc lập, loại bỏ hoàn toàn TCP HoL Blocking. Hơn nữa, QUIC định danh kết nối bằng Connection ID thay vì bộ tứ IP/Port, cho phép người dùng chuyển từ Wifi sang 4G mà không đứt kết nối.'
        },
        {
          id: 'c3-l1-q3',
          question: 'Tính năng 0-RTT Connection Resumption trong TLS 1.3 và QUIC mang lại lợi ích gì vượt trội, đồng thời tiềm ẩn rủi ro an ninh mạng nào mà kỹ sư backend phải lưu ý?',
          options: [
            'Cho phép client gửi kèm dữ liệu HTTP ngay trong gói tin đầu tiên khi kết nối lại với máy chủ đã từng bắt tay, nhưng có nguy cơ bị tấn công phát lại (Replay Attack) đối với các request không có tính Idempotent.',
            'Tự động miễn trừ việc kiểm tra tường lửa Web Application Firewall (WAF), tiềm ẩn nguy cơ bị SQL Injection.',
            'Cho phép bỏ qua bước giải mã dữ liệu trên máy chủ, nhưng khiến CPU máy chủ phải chạy 100% công suất liên tục.',
            'Tăng kích thước gói tin tối đa lên 100MB, nhưng có thể làm tràn bộ nhớ đệm router mạng nội bộ.'
          ],
          correctIndex: 0,
          explanation: 'Với 0-RTT, client dùng lại khóa phiên cũ (Pre-Shared Key / Session Ticket) để mã hóa dữ liệu gửi ngay trong gói tin đầu tiên (tiết kiệm hoàn toàn 1 RTT). Tuy nhiên, kẻ tấn công có thể nghe lén và gửi lại chính gói tin 0-RTT đó (Replay Attack). Do đó, chuẩn RFC khuyến cáo chỉ cho phép 0-RTT cho các phương thức Safe/Idempotent (như GET), tuyệt đối không áp dụng cho POST thanh toán nếu không có cơ chế Anti-replay token.'
        },
        {
          id: 'c3-l1-q4',
          question: 'Trong giao tiếp mạng giữa các Microservices nội bộ chịu tải cao, việc duy trì HTTP Keep-Alive Connection Pooling đem lại giá trị hiệu năng cốt lõi nào?',
          options: [
            'Tự động nén tất cả các bản ghi cơ sở dữ liệu thành định dạng nhị phân Protobuf trước khi truyền đi.',
            'Giúp ứng dụng không bao giờ bị dính lỗi thiếu bộ nhớ RAM do hệ điều hành tự giải phóng Heap.',
            'Tái sử dụng các kết nối TCP đã bắt tay sẵn, loại bỏ độ trễ của 3-way handshake và TLS handshake cho từng request, đồng thời ngăn chặn cạn kiệt ephemeral ports và trạng thái TIME_WAIT socket trên OS.',
            'Cho phép microservice bỏ qua bước kiểm tra xác thực JWT để tăng tốc độ phản hồi API.'
          ],
          correctIndex: 2,
          explanation: 'Không dùng Connection Pooling đồng nghĩa mỗi HTTP request phải tạo một kết nối TCP mới: tốn 2-3 RTT handshake, tiêu tốn CPU mã hóa TLS, và khi đóng kết nối sẽ để lại socket ở trạng thái TIME_WAIT (thường 60 giây). Với hàng chục nghìn request/giây, server sẽ cạn kiệt ephemeral port (port exhaustion) và sập mạng.'
        },
        {
          id: 'c3-l1-q5',
          question: 'Trong chu trình TCP 3-Way Handshake, vai trò của gói tin SYN-ACK từ phía Server gửi về cho Client là gì?',
          options: [
            'Server xác nhận đã nhận được Sequence Number khởi tạo của Client (bằng cách gửi Ack = Client_Seq + 1) và đồng thời gửi Sequence Number khởi tạo của chính Server để Client đồng bộ.',
            'Server gửi toàn bộ nội dung HTML của trang chủ để Client bắt đầu render ngay lập tức trước khi xác nhận.',
            'Server thông báo đóng kết nối do Client chưa gửi thông tin chứng thực tài khoản người dùng hợp lệ.',
            'Server yêu cầu hệ điều hành của Client phải cấp quyền Root cho tiến trình mạng của ứng dụng.'
          ],
          correctIndex: 0,
          explanation: 'Bắt tay 3 bước là quá trình đồng bộ Sequence Number hai chiều: Bước 1: Client gửi SYN (seq=X). Bước 2: Server gửi SYN-ACK (ack=X+1 để xác nhận seq của Client, đồng thời seq=Y của Server). Bước 3: Client gửi ACK (ack=Y+1) để hoàn tất.'
        },
        {
          id: 'c3-l1-q6',
          question: 'Cơ chế Flow Control (Kiểm soát luồng) trong tầng giao vận TCP sử dụng giải thuật nào để ngăn không cho bên gửi (Sender) làm tràn ngập bộ nhớ đệm của bên nhận (Receiver)?',
          options: [
            'Token Bucket Algorithm kết hợp Leaky Bucket ở cấp độ phần cứng card mạng.',
            'Quét ngẫu nhiên các gói tin và tự động loại bỏ 50% số gói tin đến chậm hơn 10ms.',
            'Đóng băng tiến trình hệ điều hành của bên gửi mỗi khi bên nhận phát hiện CPU đạt 80%.',
            'Cửa sổ trượt (Sliding Window / Receive Window - rwnd) được bên nhận liên tục thông báo trong trường TCP Header để bên gửi biết lượng buffer còn trống.'
          ],
          correctIndex: 3,
          explanation: 'TCP Flow Control sử dụng cơ chế Sliding Window. Bên nhận thông báo giá trị Receive Window (rwnd) trong mỗi gói tin TCP ACK gửi về. Bên gửi chỉ được phép truyền tối đa số byte bằng kích thước rwnd đó. Nếu buffer bên nhận đầy (rwnd = 0), bên gửi phải tạm dừng truyền (Zero Window Probe) để tránh tràn bộ nhớ đệm.'
        },
        {
          id: 'c3-l1-q7',
          question: 'Tại sao kỹ thuật Header Compression (HPACK) trong HTTP/2 lại vượt trội hơn nhiều so với việc nén Gzip truyền thống được thử nghiệm trước đó trong SPDY?',
          options: [
            'Vì HPACK sử dụng trí tuệ nhân tạo để đoán trước các header mà client sắp gửi trong tương lai.',
            'Vì HPACK giải quyết lỗ hổng bảo mật nghiêm trọng CRIME attack vốn khai thác độ dài của chuỗi nén Gzip/Deflate để giải mã cookie phiên làm việc bí mật.',
            'Vì HPACK chỉ hỗ trợ nén các số nguyên mà không cho phép nén chuỗi ký tự text.',
            'Vì HPACK được xử lý trực tiếp trên GPU nên tốc độ nén nhanh hơn 1000 lần so với CPU.'
          ],
          correctIndex: 1,
          explanation: 'Trong giao thức SPDY cũ, việc nén HTTP Header bằng gzip/deflate dẫn đến lỗ hổng bảo mật CRIME: kẻ tấn công có thể tiêm nội dung dự đoán vào request và quan sát sự thay đổi độ dài byte của bản nén để dò từng ký tự cookie bí mật. HPACK ra đời dùng Static/Dynamic Huffman Table độc lập, triệt tiêu hoàn toàn rủi ro rò rỉ cookie qua compression oracle.'
        },
        {
          id: 'c3-l1-q8',
          question: 'Trạng thái kết nối TCP socket TIME_WAIT được hệ điều hành duy trì sau khi đóng kết nối nhằm phục vụ mục đích kỹ thuật sống còn nào?',
          options: [
            'Để hệ điều hành quét virus và mã độc còn sót lại trong gói tin trước khi giải phóng bộ nhớ.',
            'Để chờ người dùng đăng nhập lại mà không cần nhập lại mật khẩu trong vòng 2 phút.',
            'Đảm bảo các gói tin bị trễ (delayed/duplicate packets) trên mạng Internet có đủ thời gian biến mất (tối đa 2MSL), ngăn chúng bị nhận nhầm bởi một kết nối mới mở trùng IP/Port sau đó, đồng thời đảm bảo gói ACK cuối cùng tới được đối tác.',
            'Để cho phép máy chủ ghi toàn bộ nhật ký kết nối ra tệp tin log trên đĩa cứng mà không làm nghẽn RAM.'
          ],
          correctIndex: 2,
          explanation: 'Trạng thái TIME_WAIT (thường kéo dài 2 x Maximum Segment Lifetime, tức 1-2 phút) thuộc về bên chủ động đóng kết nối (Active Close). Nó bảo đảm 2 điều: (1) Nếu gói ACK cuối cùng bị rớt, bên kia gửi lại FIN thì bên này vẫn còn socket để gửi lại ACK; (2) Các gói tin cũ lạc trên mạng có đủ thời gian chết đi, không làm ô nhiễm kết nối mới được tạo cùng cặp IP/Port.'
        }
      ],
      codeChallenge: {
        id: 'c3-l1-c1',
        title: 'Xây Dựng Cơ Chế Tái Sử Dụng Kết Nối (Connection Pool Keep-Alive Simulator)',
        description: 'Hiện thực hàm \`simulateConnectionPool(maxSize: number, ops: Array<{ op: "acquire" } | { op: "release"; connId: string }>): string[]\`. Khi gặp \`"acquire"\`: nếu có kết nối trong danh sách nhàn rỗi (\`idle\`), tái sử dụng nó; nếu chưa đầy \`maxSize\`, tạo mới \`"conn_\${id}"\` (bắt đầu từ id = 1); đẩy ID kết nối nhận được vào mảng kết quả. Khi gặp \`"release"\`: đưa \`connId\` trở lại hàng đợi \`idle\`. Nếu \`maxSize <= 0\` hoặc \`ops\` rỗng, trả về mảng rỗng \`[]\`.',
        starterCode: `export function simulateConnectionPool(
  maxSize: number,
  ops: Array<{ op: 'acquire' } | { op: 'release'; connId: string }>
): string[] {
  // TODO: Hiện thực Connection Pool tái sử dụng
  return [];
}`,
        solution: `export function simulateConnectionPool(
  maxSize: number,
  ops: Array<{ op: 'acquire' } | { op: 'release'; connId: string }>
): string[] {
  if (typeof maxSize !== 'number' || maxSize <= 0 || !Array.isArray(ops) || ops.length === 0) {
    return [];
  }

  const idle: string[] = [];
  let currentId = 0;
  let active = 0;
  const results: string[] = [];

  for (const item of ops) {
    if (item.op === 'acquire') {
      if (idle.length > 0) {
        const reused = idle.pop()!;
        active++;
        results.push(reused);
      } else if (active < maxSize) {
        active++;
        currentId++;
        results.push(\`conn_\${currentId}\`);
      }
    } else if (item.op === 'release') {
      if (active > 0) {
        active--;
        idle.push(item.connId);
      }
    }
  }

  return results;
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Cấp phát connection mới khi pool chưa đầy',
            input: [2, [{ op: 'acquire' }]],
            expected: ['conn_1'],
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Tái sử dụng connection sau khi được release',
            input: [1, [
              { op: 'acquire' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' }
            ]],
            expected: ['conn_1', 'conn_1'],
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Cấp phát tối đa đến maxSize, khi pool đầy không tạo thêm',
            input: [2, [{ op: 'acquire' }, { op: 'acquire' }, { op: 'acquire' }]],
            expected: ['conn_1', 'conn_2'],
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): maxSize <= 0 hoặc ops rỗng -> Trả về mảng rỗng',
            input: [0, [{ op: 'acquire' }]],
            expected: [],
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Chu kỳ acquire và release xen kẽ liên tục',
            input: [2, [
              { op: 'acquire' },
              { op: 'acquire' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' },
              { op: 'release', connId: 'conn_2' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' }
            ]],
            expected: ['conn_1', 'conn_2', 'conn_1', 'conn_1'],
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c3-l2',
      title: 'Bài 02: HTTP Semantics Thực Chiến: Idempotency Keys, Connection Keep-Alive & Safe Methods',
      duration: '60 phút',
      tag: 'HTTP Protocols & Idempotency',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: NGUYÊN LÝ BẤT BIẾN (IDEMPOTENCY) TRONG HỆ THỐNG PHÂN TÁN

Trong một kiến trúc mạng phân tán không hoàn hảo (Unreliable Distributed Network), việc một HTTP request bị thất bại hoặc mất gói giữa chừng là điều hiển nhiên xảy ra:

* **Sự cố Mập Mờ Trạng Thái (The Two-Generals Network Paradox):**
  - Khi Client gửi một request trừ tiền hoặc tạo đơn hàng và gặp lỗi \`Socket Hang Up\` hoặc \`504 Gateway Timeout\`, Client hoàn toàn không thể biết được:
    1. Request chưa hề tới được Server (Server chưa làm gì).
    2. Hay Server đã xử lý thành công, trừ tiền trong DB xong xuôi, nhưng gói tin HTTP Response trên đường bay về Client bị rớt mạng!

* **Thảm họa Trừ Tiền Kép khi Retry (Double Billing Disaster):**
  - Nếu Client (hoặc Retry Interceptor của Axios) tự động gửi lại request đó lần 2 mà API không được thiết kế có tính Idempotent: Server sẽ thực hiện trừ tiền một lần nữa trong tài khoản người dùng!
  - Trong các hệ thống Fintech, Thương mại điện tử hoặc Đặt phòng, việc không đảm bảo tính Idempotency sẽ gây thất thoát tài chính và vi phạm nghiêm trọng tính toàn vẹn dữ liệu.

* **Giải pháp Chuẩn Mực: Khóa Bất Biến (Idempotency Key Architecture):**
  - Client sinh ra một mã định danh ngẫu nhiên duy nhất cấp UUIDv4 và đính kèm vào HTTP Header: \`Idempotency-Key: 7b2f4c91-...\`.
  - Backend sử dụng cơ chế Distributed Lock (Redis) hoặc Unique Constraint (Database) để bắt giữ key này:
    + **Lần đầu:** Thực thi logic nghiệp vụ, lưu kết quả response vào Cache với TTL tương ứng.
    + **Các lần Retry tiếp theo (cùng key):** Hệ thống phát hiện key đã được xử lý thành công, lập tức trả về nguyên vẹn response đã lưu trong Cache mà **hoàn toàn không thực thi lại logic trừ tiền hay ghi DB lần thứ hai**.

---

# 2. CHUẨN RFC VỀ TÍNH CHẤT PHƯƠNG THỨC HTTP (SAFE & IDEMPOTENT)

Theo chuẩn RFC 9110 (HTTP Semantics), các phương thức được phân loại rõ ràng:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MA TRẬN PHÂN LOẠI PHƯƠNG THỨC HTTP THEO RFC             │
├─────────┬──────────────┬──────────────────┬─────────────────────────────────┤
│ Method  │ Safe (An toàn│ Idempotent (Lũy  │ Bản chất tác động đến hệ thống  │
│         │ không đổi DB)│ kế cùng kết quả) │                                 │
├─────────┼──────────────┼──────────────────┼─────────────────────────────────┤
│ GET     │ CÓ           │ CÓ               │ Chỉ đọc tài nguyên, không đổi DB│
│ HEAD    │ CÓ           │ CÓ               │ Lấy header, không lấy body      │
│ PUT     │ KHÔNG        │ CÓ               │ Thay thế hoàn toàn bản ghi      │
│ DELETE  │ KHÔNG        │ CÓ               │ Xóa bản ghi (xóa 1 hay N lần)   │
│ POST    │ KHÔNG        │ KHÔNG            │ Tạo mới tài nguyên, trừ tiền... │
│ PATCH   │ KHÔNG        │ KHÔNG (thường)   │ Sửa đổi từng phần (increment...)│
└─────────┴──────────────┴──────────────────┴─────────────────────────────────┘
\`\`\`

> **Lưu ý của Kỹ sư Cấp cao:** \`DELETE\` là phương thức Idempotent! Xóa một bản ghi ID 123 lần đầu tiên trả về \`200 OK\` hoặc \`204 No Content\`. Lần thứ hai gọi lại có thể trả về \`404 Not Found\`, nhưng **trạng thái dữ liệu trong Database vẫn không đổi (bản ghi đó vẫn bị xóa)**! Mã HTTP trả về không bắt buộc phải giống nhau, bản chất là trạng thái hệ thống không bị biến đổi thêm.

---

# 3. KIẾN TRÚC IDEMPOTENCY KEY VỚI REDIS ATOMIC LOCK

Đối với các API nhạy cảm không có tính Idempotent tự nhiên (như \`POST /api/payments\`), chúng ta bắt buộc phải sử dụng **Khóa Lũy Kế (Idempotency-Key Header)**:

\`\`\`diagram
[ CLIENT ]                                [ BACKEND API ]               [ REDIS CLUSTER ]
    │                                            │                               │
    ├─ 1. POST /payments ───────────────────────►│                               │
    │     Header: Idempotency-Key: "uuid-123"    ├── 2. SETNX uuid-123 "PROCESSING"
    │                                            │   (Thời hạn TTL: 120s) ──────►│
    │                                            │                               │
    │                                            │◄── Khóa thành công (OK) ──────┤
    │                                            ├── 3. Gọi cổng thanh toán Stripe
    │                                            ├── 4. Ghi nhận Database Order  │
    │                                            ├── 5. Cập nhật Redis kết quả:  │
    │                                            │   SET uuid-123 {status: 200} ─►│
    │◄─ 6. Trả về 200 OK { txId: "TX999" } ──────┤                               │
    │                                            │                               │
    │  [ KỊCH BẢN RETRY: MẠNG LAG, CLIENT GỬI LẠI CÙNG KEY "uuid-123" ]         │
    │                                            │                               │
    ├─ 7. POST /payments (Retry) ───────────────►│                               │
    │     Header: Idempotency-Key: "uuid-123"    ├── 8. Kiểm tra Redis key ──────►│
    │                                            │◄── Phát hiện ĐÃ HOÀN TẤT! ────┤
    │◄─ 9. Trả về ngay kết quả cũ (Cached 200) ──┤ (KHÔNG TRỪ TIỀN LẦN HAI!)     │
\`\`\`

### 3.1 Xử Lý Các Trạng Thái Biên (Edge Cases) Cực Kỳ Nguy Hiểm
1. **Trạng thái Đang Xử Lý (Concurrent In-flight Request):** Nếu request 1 đang chạy (chưa xong), request 2 gửi đến cùng key: API phải trả về ngay mã **\`409 Conflict\`** kèm thông báo *"Giao dịch đang được xử lý, vui lòng không gửi lại"*.
2. **Payload Mismatch Attack:** Nếu kẻ tấn công dùng lại \`Idempotency-Key\` cũ nhưng thay đổi số tiền từ 10,000đ thành 10,000,000đ: API phải băm SHA-256 Request Body và lưu cùng key trong Redis. Nếu phát hiện Body Hash khác nhau, lập tức ném ra lỗi **\`422 Unprocessable Entity\`**!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Kiến Trúc Khóa Lũy Kế (Idempotency Taxonomy Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KIẾN TRÚC BẢO VỆ GIAO DỊCH PHÂN TÁN                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. TẦNG REQUEST INGESTION (NestJS Guard / Interceptor)                      │
│    └── Trích xuất Header: 'x-idempotency-key' (UUID v4)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. TẦNG KIỂM TRA TÍNH TOÀN VẸN (Integrity Hashing)                          │
│    └── crypto.createHash('sha256').update(req.body).digest('hex')           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TẦNG KHÓA NGUYÊN TỬ PHÂN TÁN (Redis Atomic Primitives)                   │
│    ├── SET key value NX EX 60 (Tạo lock chống race condition)              │
│    ├── Lưu trữ Response Cache: { statusCode: 201, body: {...} }             │
│    └── Xử lý Release Lock khi gặp lỗi hệ thống (Rollback)                   │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Ra Quyết Định Của Idempotency Interceptor (Lifecycle Flow)
\`\`\`diagram
Request đến kèm Header 'x-idempotency-key'
   │
   ▼
Khóa đã tồn tại trong Redis chưa?
   ├── [ ĐÃ TỒN TẠI ]
   │      │
   │      ├── Trạng thái là "PROCESSING"? ──► Ném lỗi 409 Conflict (Đang xử lý)
   │      │
   │      └── Trạng thái là "COMPLETED"?
   │             ├── Request Body Hash có khớp không?
   │             │     ├── [ KHÔNG KHỚP ] ──► Ném lỗi 422 (Gian lận đổi Body)
   │             │     └── [ KHỚP ] ────────► Trả về Response Cache cũ (200 OK)
   │
   └── [ CHƯA TỒN TẠI ]
          │
          ├── Ghi khóa tạm thời vào Redis: SET key 'PROCESSING' NX EX 120
          ├── Chuyển tiếp Request vào Controller thực thi logic nghiệp vụ (DB, Stripe)
          ├── Ghi đè khóa Redis: SET key { status: 200, body: resBody } EX 86400
          └── Trả kết quả về cho Client
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Triển Khai Idempotency (Implementation Tree)
\`\`\`diagram
API NÀY CÓ CẦN BẢO VỆ BẰNG IDEMPOTENCY KEY KHÔNG?
│
├── Là API đọc dữ liệu (GET, HEAD, OPTIONS)?
│   └──► KHÔNG CẦN (Đã có tính Safe và Idempotent tự nhiên theo chuẩn RFC)
│
├── Là API cập nhật thay thế hoàn toàn (PUT theo ID)?
│   └──► Thường không cần (Bản thân PUT đã là Idempotent nếu không có logic phụ)
│
└── Là API tạo mới tài nguyên hoặc thay đổi trạng thái tài chính (POST /payments, POST /orders)?
    ├── Khách hàng có thể bị trừ tiền hoặc gửi email trùng lặp nếu mạng lag?
    │   └──► BẮT BUỘC TRIỂN KHAI Idempotency Key kèm Redis Atomic Lock!
    └── Chỉ là gửi form liên hệ thông thường:
        └──► Có thể dùng cơ chế Rate Limiting đơn giản để hạn chế spam
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Cơ Chế Chống Trùng | Độ Phức Tạp Triển Khai | Mức Độ An Toàn Dữ Liệu | Tiêu Hao Tài Nguyên | Độ Trễ Bổ Sung (Overhead) |
| :--- | :--- | :--- | :--- | :--- |
| **Bỏ qua (Không xử lý)**| $0\\%$ (Không code) | Cực kỳ nguy hiểm, mất tiền | $0\\%$ | $0$ ms |
| **Unique DB Constraint**| Thấp (Duy nhất 1 cột DB) | Tốt cho tạo bản ghi, khó cache | Tăng tải kiểm tra Index DB | ~2ms - 5ms (DB Roundtrip) |
| **Redis Distributed Key**| Trung bình (Interceptor/Guard)| Hoàn hảo cho hệ thống lớn | Cần cụm Redis lưu trữ RAM | ~1ms (In-memory lookup) |
| **Two-Phase Commit (2PC)**| Rất cao (Distributed Tx) | An toàn tuyệt đối đa database | Khóa tài nguyên lâu, giảm throughput | ~50ms - 200ms |
`,
      realCodeSnippet: `// File: src/modules/common/interceptors/idempotency.interceptor.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - Distributed Idempotency Protection
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';

export interface IdempotencyRecord {
  status: 'PROCESSING' | 'COMPLETED';
  requestHash: string;
  statusCode: number;
  body: unknown;
  createdAt: number;
}

/**
 * ADR: Phòng chống trùng lặp giao dịch phân tán (Idempotency Key):
 * 1. Client bắt buộc gửi Header 'x-idempotency-key' dạng UUIDv4.
 * 2. Băm SHA-256 Request Body để phát hiện gian lận thay đổi dữ liệu (Payload Mismatch -> 422).
 * 3. Trạng thái 'PROCESSING' ngăn chặn Race Condition (409 Conflict).
 * 4. Trạng thái 'COMPLETED' trả về trực tiếp response trong Cache (200 OK) mà không ghi DB lại.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  // Mô phỏng cụm Redis Cache phân tán
  private readonly distributedStore = new Map<string, IdempotencyRecord>();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; headers: Record<string, string | undefined>; body: unknown }>();
    const res = http.getResponse<{ statusCode: number; status: (code: number) => void }>();

    const idempotencyKey = req.headers['x-idempotency-key'];
    // Chỉ áp dụng cho các phương thức Mutation (POST, PATCH) có truyền header
    if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD') {
      return next.handle();
    }

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');

    const existing = this.distributedStore.get(idempotencyKey);

    if (existing) {
      if (existing.status === 'PROCESSING') {
        this.logger.warn(\`Phát hiện giao dịch đang chạy trùng key: \${idempotencyKey}\`);
        throw new ConflictException('Giao dịch đang được xử lý. Vui lòng không bấm gửi lại liên tục.');
      }

      if (existing.requestHash !== payloadHash) {
        this.logger.error(\`Cảnh báo gian lận Payload Mismatch trên key: \${idempotencyKey}\`);
        throw new UnprocessableEntityException('Idempotency Key đã được sử dụng với payload dữ liệu khác.');
      }

      res.status(existing.statusCode);
      return of(existing.body);
    }

    // Đánh dấu khóa tạm thời (tương đương Redis SETNX key 'PROCESSING' EX 120)
    this.distributedStore.set(idempotencyKey, {
      status: 'PROCESSING',
      requestHash: payloadHash,
      statusCode: 200,
      body: null,
      createdAt: Date.now(),
    });

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          this.distributedStore.set(idempotencyKey, {
            status: 'COMPLETED',
            requestHash: payloadHash,
            statusCode: res.statusCode || 200,
            body,
            createdAt: Date.now(),
          });
        },
        error: () => {
          // Xóa lock nếu xử lý nghiệp vụ thất bại để cho phép retry
          this.distributedStore.delete(idempotencyKey);
        },
      }),
    );
  }
}`,
      quiz: [
        {
          id: 'c3-l2-q1',
          question: 'Theo chuẩn kỹ thuật RFC 9110 (HTTP Semantics), phương thức HTTP DELETE có được phân loại là Idempotent (Lũy kế) hay không và vì sao?',
          options: [
            'Có; vì tính chất Idempotent xét trên trạng thái tài nguyên của hệ thống máy chủ: sau lần xóa đầu tiên hay sau 10 lần gọi lại, tài nguyên đó vẫn ở trạng thái bị xóa khỏi hệ thống mà không sinh ra tác dụng phụ mới.',
            'Không; vì lần gọi đầu tiên trả về HTTP 200/204 trong khi các lần gọi tiếp theo trả về HTTP 404 Not Found nên mã phản hồi không đồng nhất.',
            'Không; vì mọi phương thức làm thay đổi cơ sở dữ liệu đều bị RFC coi là Non-idempotent.',
            'Có; nhưng chỉ khi máy chủ được cấu hình buộc phải trả về đúng mã trạng thái HTTP 200 cho tất cả mọi lần gọi lặp lại.'
          ],
          correctIndex: 0,
          explanation: 'Theo RFC 9110, tính chất Idempotent định nghĩa rằng tác động lên trạng thái máy chủ của N yêu cầu giống hệt nhau là tương đương với 1 yêu cầu duy nhất. Việc mã phản hồi là 200 (xóa lần đầu) hay 404 (các lần sau vì không còn bản ghi) không làm thay đổi bản chất rằng dữ liệu vẫn ở trạng thái đã bị xóa.'
        },
        {
          id: 'c3-l2-q2',
          question: 'Trong kịch bản Client gửi lại một request thanh toán với cùng một Idempotency-Key cũ nhưng cố tình sửa đổi số tiền trong Request Body (Payload Mismatch), hệ thống backend chuẩn mực cần phản hồi như thế nào?',
          options: [
            'Tự động ghi đè số tiền mới vào giao dịch cũ và trừ thêm phần tiền chênh lệch từ tài khoản người dùng.',
            'Xóa khóa cũ trong Redis và tiến hành tạo một đơn hàng thanh toán mới độc lập.',
            'Lập tức từ chối request với mã lỗi HTTP 422 Unprocessable Entity (hoặc 400 Bad Request) vì vi phạm tính toàn vẹn của khóa lũy kế.',
            'Trả về kết quả thành công của giao dịch cũ mà không cần kiểm tra tính khớp nối của Request Body.'
          ],
          correctIndex: 2,
          explanation: 'Mỗi Idempotency Key phải được gắn liền với một bản băm (SHA-256 hash) của Request Body tương ứng. Nếu cùng một key nhưng body khác nhau, đây là dấu hiệu của lỗi lập trình client hoặc hành vi gian lận (Tampering Attack). Server bắt buộc phải từ chối với mã 422 Unprocessable Entity để bảo toàn tính toàn vẹn giao dịch.'
        },
        {
          id: 'c3-l2-q3',
          question: 'Khi hai request thanh toán sử dụng chung một Idempotency-Key gửi đến đồng thời trong cùng một mili giây trên cụm máy chủ NestJS phân tán, kỹ thuật nào sau đây giải quyết triệt để bài toán Race Condition?',
          options: [
            'Bọc mã nguồn Controller trong khối synchronize của JavaScript để khóa Main Thread của tiến trình.',
            'Sử dụng lệnh nguyên tử SETNX (hoặc SET key value NX EX ttl) trên Redis; request đầu tiên chiếm khóa thành công sẽ thực thi logic, request thứ hai thấy khóa đang ở trạng thái PROCESSING sẽ lập tức bị chặn với HTTP 409 Conflict.',
            'Cho cả 2 request cùng ghi vào database rồi định kỳ 5 phút chạy cron job để hủy bản ghi trùng lặp.',
            'Sử dụng biến toàn cục Map trong bộ nhớ của từng instance máy chủ để ghi nhận request đã xử lý.'
          ],
          correctIndex: 1,
          explanation: 'Lệnh SETNX (Set if Not Exists) của Redis có tính nguyên tử tuyệt đối (atomic). Request nào đến trước mili giây đó sẽ chiếm được lock và ghi trạng thái "PROCESSING". Request đến sau sẽ thất bại khi gọi SETNX, phát hiện giao dịch đang được xử lý và lập tức trả về mã HTTP 409 Conflict, triệt tiêu hoàn toàn race condition trừ tiền hai lần.'
        },
        {
          id: 'c3-l2-q4',
          question: 'Sự khác biệt căn bản giữa phương thức PUT và PATCH theo đặc tả chuẩn HTTP là gì?',
          options: [
            'PUT là phương thức gửi dữ liệu dạng nhị phân, còn PATCH chỉ hỗ trợ gửi dữ liệu văn bản thuần UTF-8.',
            'PUT chỉ dùng cho cơ sở dữ liệu NoSQL, còn PATCH chỉ dùng cho cơ sở dữ liệu quan hệ SQL.',
            'PUT không bao giờ lưu log máy chủ, còn PATCH bắt buộc phải ghi log kiểm toán.',
            'PUT thay thế toàn bộ tài nguyên (Idempotent: gửi đi gửi lại toàn bộ đối tượng trạng thái cuối không đổi), trong khi PATCH sửa đổi từng phần tài nguyên (thường Non-idempotent: ví dụ tăng giá trị biến đếm nếu gửi nhiều lần sẽ làm sai lệch dữ liệu).'
          ],
          correctIndex: 3,
          explanation: 'Theo RFC, PUT thay thế toàn bộ biểu diễn của tài nguyên (Full Replacement), nên gọi N lần với cùng một representation đều cho ra trạng thái giống hệt (Idempotent). PATCH là Partial Modification (chỉ cập nhật một số trường hoặc áp dụng JSON Patch delta). Nếu PATCH áp dụng các thao tác tương đối (như { op: "increment", val: 5 }), việc gọi lại nhiều lần sẽ làm thay đổi trạng thái liên tục, do đó PATCH thường không mặc nhiên là Idempotent.'
        },
        {
          id: 'c3-l2-q5',
          question: 'Khi triển khai Idempotency Interceptor trong NestJS, tại sao kết quả phản hồi (Response Body & StatusCode) của request hoàn tất đầu tiên lại cần được lưu vào Cache (Redis) cùng với Idempotency Key?',
          options: [
            'Để khi client thực hiện Retry với cùng key, server có thể trả về ngay lập tức nguyên vẹn kết quả response trước đó mà không phải kích hoạt lại logic nghiệp vụ nặng hoặc ghi thêm vào cơ sở dữ liệu.',
            'Để trình duyệt của người dùng tự động xóa lịch sử duyệt web liên quan đến giao dịch đó.',
            'Để giảm kích thước của cơ sở dữ liệu chính bằng cách chuyển các bản ghi sang lưu vĩnh viễn trên RAM của Redis.',
            'Nhằm ngăn chặn tin tặc tấn công từ chối dịch vụ phân tán (DDoS) vào cổng mạng HTTP.'
          ],
          correctIndex: 0,
          explanation: 'Trọng tâm của cơ chế Idempotency là: Khi mạng chập chờn khiến client timeout không nhận được response, client sẽ retry. Server nhận ra key đã hoàn tất (COMPLETED), lấy ngay response đã cache (bao gồm cả StatusCode và Body cũ) trả về cho client. Client nhận được kết quả như mong đợi mà backend không hề chạy lại lệnh trừ tiền hay tạo đơn hàng lần 2.'
        },
        {
          id: 'c3-l2-q6',
          question: 'Thuật ngữ "Safe Methods" trong chuẩn RFC 9110 ám chỉ những phương thức HTTP nào và có ý nghĩa kỹ thuật gì đối với các bên trung gian (Proxies/CDNs)?',
          options: [
            'Các phương thức có mã hóa SSL 256-bit; giúp ngăn chặn virus máy tính lây lan qua proxy.',
            'Các phương thức POST và PUT khi có đính kèm JWT token hợp lệ; cho phép proxy đọc nội dung payload.',
            'Các phương thức chỉ đọc tài nguyên (như GET, HEAD, OPTIONS) mà không làm biến đổi trạng thái của hệ thống máy chủ; cho phép Proxies, Caches và CDNs tự do lưu trữ bộ đệm và tự động thử lại mà không lo ngại tác dụng phụ.',
            'Các phương thức chỉ dành riêng cho quản trị viên hệ thống có quyền truy cập root.'
          ],
          correctIndex: 2,
          explanation: 'Safe Methods (GET, HEAD, OPTIONS, TRACE) là các phương thức chỉ nhằm mục đích truy xuất thông tin mà không tạo ra bất kỳ thay đổi trạng thái nào trên server (read-only). Nhờ tính chất Safe, các bộ nhớ đệm (Browser Cache, CDN, Forward Proxies) có thể an tâm cache dữ liệu hoặc gửi lại request khi mạng chập chờn mà không sợ làm biến dạng dữ liệu người dùng.'
        },
        {
          id: 'c3-l2-q7',
          question: 'Tại sao việc đặt thời gian sống (TTL) cho Idempotency Key trong Redis là bắt buộc, và khoảng thời gian TTL bao lâu thường được coi là hợp lý trong các hệ thống thanh toán thực tế?',
          options: [
            'TTL bắt buộc phải là 500 mili giây để tránh làm nghẽn xung nhịp CPU của máy chủ Redis.',
            'TTL phải là vô hạn (không bao giờ hết hạn) vì dữ liệu thanh toán bắt buộc phải lưu vĩnh viễn trên RAM theo luật pháp.',
            'TTL chỉ cần thiết khi Redis chạy trên hệ điều hành Windows 32-bit.',
            'TTL giúp giải phóng bộ nhớ RAM cho Redis và dọn sạch các giao dịch cũ sau khi cửa sổ Retry của client kết thúc; thông thường TTL từ 24 giờ đến 72 giờ là chuẩn mực thực tế cho các luồng thanh toán.'
          ],
          correctIndex: 3,
          explanation: 'Nếu không đặt TTL, hàng triệu Idempotency Keys được tạo ra mỗi ngày sẽ nhanh chóng làm cạn kiệt RAM của Redis (Out Of Memory). Mặt khác, cửa sổ thử lại (Retry Window) của client hoặc hệ thống đối tác thanh toán (như Stripe/VNPay webhook) thường chỉ kéo dài tối đa 24-72 giờ. Đặt TTL 24-72h đảm bảo bắt được mọi đợt retry hợp lệ đồng thời tự động thu hồi RAM rác.'
        },
        {
          id: 'c3-l2-q8',
          question: 'Trong kịch bản request đầu tiên đang thực thi dang dở (chưa xong DB) mà tiến trình máy chủ NestJS bất ngờ bị Crash (OOM hoặc mất điện đột ngột), rủi ro lớn nhất với Idempotency Key trong Redis là gì nếu không có cơ chế Timeout thích hợp?',
          options: [
            'Toàn bộ dữ liệu trong cơ sở dữ liệu PostgreSQL sẽ tự động bị xóa sạch.',
            'Khóa trong Redis bị kẹt vĩnh viễn ở trạng thái "PROCESSING" (Zombie Lock); khiến tất cả các lần thử lại sau đó của client đều bị từ chối với lỗi 409 Conflict mãi mãi mà giao dịch không bao giờ được hoàn tất.',
            'Máy chủ Redis sẽ tự động khởi động lại toàn bộ cụm cluster và từ chối mọi kết nối mới.',
            'Client sẽ tự động được cấp quyền truy cập quản trị viên vào hệ thống backend.'
          ],
          correctIndex: 1,
          explanation: 'Nếu tiến trình chết khi đang xử lý mà khóa PROCESSING không có TTL ngắn (ví dụ lock timeout 60-120s), khóa đó sẽ thành "Zombie Lock" tồn tại mãi mãi trong Redis. Khi client retry, hệ thống vẫn thấy "PROCESSING" và liên tục ném lỗi 409 Conflict, khiến giao dịch bị đóng băng vĩnh viễn. Do đó, bước SETNX bắt buộc phải đi kèm expire time hợp lý.'
        }
      ],
      codeChallenge: {
        id: 'c3-l2-c1',
        title: 'Hiện Thực Cơ Chế Kiểm Tra Khóa Lũy Kế (Idempotent Request Validator)',
        description: 'Hiện thực hàm \`validateIdempotencyRequest(store: Map<string, { payloadStr: string; result: unknown }>, key: string, payload: unknown, action: () => unknown): { status: number; data: unknown }\`. Nếu \`store\` không hợp lệ, \`key\` rỗng hoặc \`action\` không phải là hàm, ném Error("INVALID_ARGUMENTS"). Nếu \`key\` chưa có trong \`store\`, thực thi \`action()\`, lưu kết quả vào store và trả về \`{ status: 200, data: result }\`. Nếu \`key\` đã tồn tại với cùng \`payload\` (so sánh qua JSON.stringify), trả về \`{ status: 200, data: existing.result }\` mà KHÔNG kích hoạt \`action()\`. Nếu \`key\` đã tồn tại nhưng \`payload\` bị thay đổi, ném Error("PAYLOAD_MISMATCH").',
        starterCode: `export function validateIdempotencyRequest(
  store: Map<string, { payloadStr: string; result: unknown }>,
  key: string,
  payload: unknown,
  action: () => unknown
): { status: number; data: unknown } {
  // TODO: Kiểm tra khóa và chống trùng lặp payload
  return { status: 200, data: null };
}`,
        solution: `export function validateIdempotencyRequest(
  store: Map<string, { payloadStr: string; result: unknown }>,
  key: string,
  payload: unknown,
  action: () => unknown
): { status: number; data: unknown } {
  if (!store || !(store instanceof Map) || typeof key !== 'string' || key.trim() === '' || typeof action !== 'function') {
    throw new Error('INVALID_ARGUMENTS');
  }

  const payloadStr = JSON.stringify(payload ?? {});
  const existing = store.get(key);

  if (existing) {
    if (existing.payloadStr !== payloadStr) {
      throw new Error('PAYLOAD_MISMATCH');
    }
    return { status: 200, data: existing.result };
  }

  const result = action();
  store.set(key, { payloadStr, result });
  return { status: 200, data: result };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Thực thi action lần đầu thành công',
            input: [
              new Map(),
              'key_1',
              { amount: 500 },
              () => ({ invoiceId: 'INV_001' })
            ],
            expected: { status: 200, data: { invoiceId: 'INV_001' } },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Gọi lại cùng key và payload không kích hoạt lại action',
            input: [
              new Map([['key_cached', { payloadStr: JSON.stringify({ amount: 100 }), result: 'FIRST_RESULT' }]]),
              'key_cached',
              { amount: 100 },
              () => 'SHOULD_NOT_BE_CALLED'
            ],
            expected: { status: 200, data: 'FIRST_RESULT' },
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Cùng key nhưng payload bị sửa đổi -> Ném lỗi PAYLOAD_MISMATCH',
            input: [
              new Map([['key_tampered', { payloadStr: JSON.stringify({ amount: 100 }), result: 'OLD_DATA' }]]),
              'key_tampered',
              { amount: 999999 },
              () => 'FAIL'
            ],
            expected: 'ERROR_THROWN',
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): Tham số key rỗng hoặc action không phải hàm -> Ném lỗi INVALID_ARGUMENTS',
            input: [new Map(), '', { amount: 100 }, null],
            expected: 'ERROR_THROWN',
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): store truyền vào null -> Ném lỗi INVALID_ARGUMENTS',
            input: [null, 'key_valid', {}, () => 123],
            expected: 'ERROR_THROWN',
            hidden: true
          }
        ]
      }
    },
    {
      id: 'c3-l3',
      title: 'Bài 03: Web Security Network Layer: CORS Preflight Protocol, Cookie Security Flag (SameSite/HttpOnly/Secure)',
      duration: '60 phút',
      tag: 'Web Security & Headers',
      theory: `
# 1. BỐI CẢNH KỸ THUẬT: CƠ CHẾ BẢO VỆ CLIENT-SIDE (SOP/CORS) & PHÒNG THỦ CHIỀU SÂU VỚI COOKIE FLAGS

Trong an ninh ứng dụng web, sự hiểu lầm về vai trò của CORS (Cross-Origin Resource Sharing) là một trong những lỗ hổng nhận thức phổ biến nhất của các lập trình viên:

* **Sự Thật Về CORS: Cơ chế bảo vệ User của Trình duyệt, KHÔNG PHẢI Firewall của Server:**
  - CORS được sinh ra để nới lỏng chính sách **Same-Origin Policy (SOP)** do Trình duyệt (Browser) thực thi nhằm ngăn chặn một website độc hại (\`evil-site.com\`) đọc trộm dữ liệu nhạy cảm từ phiên làm việc của người dùng tại (\`bank.com\`).
  - **CORS hoàn toàn không bảo vệ Server khỏi Hacker:** Hacker sử dụng công cụ dòng lệnh (cURL, Postman, Python, Go) không phải là trình duyệt web và không bị ràng buộc bởi SOP. Chúng có thể gửi bất kỳ HTTP request nào trực tiếp đến Backend mà CORS không thể ngăn chặn.
  - CORS chỉ có tác dụng hướng dẫn trình duyệt web của người dùng hợp lệ có được phép đọc dữ liệu response trả về từ một Origin khác hay không.

* **Cơ chế Thăm dò Trước (Preflight OPTIONS Protocol):**
  - Đối với các request có khả năng gây biến đổi dữ liệu (Phương thức PUT, DELETE, PATCH hoặc có chứa Header tùy chỉnh như \`Authorization\`, \`X-Tenant-Id\`), trình duyệt bắt buộc phải gửi một request thăm dò \`OPTIONS\` (Preflight) trước khi gửi request nghiệp vụ chính.
  - Nếu Server phản hồi header \`Access-Control-Allow-Origin\` và \`Access-Control-Allow-Methods\` không hợp lệ, trình duyệt sẽ lập tức chặn đứng request tại máy khách và không bao giờ truyền payload thực tế đi.

* **Phòng Thủ Chiều Sâu với Bộ 3 Cờ Cookie (HttpOnly, Secure, SameSite):**
  - **Lưu trữ JWT trong LocalStorage là một Anti-pattern nguy hiểm:** Bất kỳ đoạn mã JavaScript độc hại nào bị chèn qua lỗ hổng XSS (Cross-Site Scripting) đều có thể dễ dàng đọc trộm token qua lệnh \`localStorage.getItem()\` và gửi về máy chủ của hacker.
  - **Giải pháp chuẩn Enterprise:** Lưu trữ Session/JWT trong Cookie với bộ 3 cờ bảo vệ:
    + \`HttpOnly\`: Ngăn chặn hoàn toàn JavaScript của trình duyệt đọc cookie qua \`document.cookie\`, vô hiệu hóa 100% nguy cơ đánh cắp token từ XSS.
    + \`Secure\`: Bắt buộc cookie chỉ được truyền tải qua kênh mã hóa HTTPS, chống nghe lén dữ liệu trên đường truyền (Man-in-the-Middle).
    + \`SameSite=Strict/Lax\`: Ngăn trình duyệt tự động đính kèm cookie khi người dùng bấm vào các liên kết từ website khác, triệt tiêu nguy cơ tấn công Giả mạo yêu cầu (Cross-Site Request Forgery — CSRF).

---

# 2. GIAO THỨC CORS PREFLIGHT & CÁC HEADER SINH TỬ

Khi một trang web tại \`https://app.esmiles.vn\` gọi API tới \`https://api.esmiles.vn\`:
Trình duyệt phân loại request thành 2 nhóm:

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHÂN LOẠI REQUEST TRÌNH DUYỆT                         │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Yêu Cầu Đơn Giản (Simple)    │ Yêu Cầu Phức Tạp Cần Preflight (OPTIONS)    │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Methods: GET, HEAD, POST      │ Methods: PUT, PATCH, DELETE, custom methods │
│ Headers: Chỉ gồm Accept,      │ Headers: Có Authorization, x-api-key,       │
│ Accept-Language, Content-Type │ Content-Type: application/json              │
│ (chỉ text/plain, multipart,   │ (99% API Backend hiện đại dùng JSON đều     │
│ application/x-www-form)       │ bắt buộc phải kích hoạt Preflight OPTIONS!) │
└───────────────────────────────┴─────────────────────────────────────────────┘
\`\`\`

### 2.1 Chu Kỳ Giao Tiếp Của CORS Preflight Request
\`\`\`diagram
[ TRÌNH DUYỆT (BROWSER) ]                                  [ SERVER BACKEND ]
          │                                                        │
          ├─ 1. OPTIONS /api/orders ──────────────────────────────►│
          │     Origin: https://app.esmiles.vn                     │
          │     Access-Control-Request-Method: POST                │
          │     Access-Control-Request-Headers: authorization,json │
          │                                                        │
          │◄─ 2. Trả về Headers cho phép: ─────────────────────────┤
          │     Access-Control-Allow-Origin: https://app.esmiles.vn│
          │     Access-Control-Allow-Methods: POST, GET, OPTIONS   │
          │     Access-Control-Allow-Headers: authorization,json   │
          │     Access-Control-Max-Age: 86400 (Cache 24 giờ)       │
          │                                                        │
          │  [ NẾU HEADER HỢP LỆ -> TRÌNH DUYỆT MỚI GỬI REQUEST THỰC SỰ ]
          │                                                        │
          ├─ 3. POST /api/orders (Kèm Body JSON & Token) ─────────►│
          │◄─ 4. Trả về kết quả 201 Created ───────────────────────┤
\`\`\`

> **Cảnh báo Lỗ hổng Nguy hiểm:** TUYỆT ĐỐI KHÔNG dùng \`Access-Control-Allow-Origin: *\` khi bật \`credentials: true\`. Trình duyệt sẽ lập tức chặn đứng kết nối vì vi phạm chính sách bảo mật thông tin xác thực!

---

# 3. BẢO VỆ PHIÊN ĐĂNG NHẬP VỚI COOKIE SECURITY FLAGS

Khi lưu trữ Access Token hoặc Refresh Token trong Cookie, bắt buộc phải thiết lập đủ **Bộ Ba Cờ Bảo Mật**:

\`\`\`typescript
res.cookie('refreshToken', token, {
  httpOnly: true, // Chống XSS: JavaScript client không thể đọc được qua document.cookie
  secure: true,   // Chống Man-in-the-Middle: Chỉ gửi qua kết nối HTTPS mã hóa
  sameSite: 'strict', // Chống CSRF: Trình duyệt không gửi cookie khi bị chuyển hướng từ trang khác
  maxAge: 7 * 24 * 60 * 60 * 1000 // Hạn dùng 7 ngày
});
\`\`\`

### 3.1 Phân Biệt Các Chế Độ SameSite (Lax, Strict, None)
1. **SameSite=Strict:** Cookie chỉ được gửi đi nếu request xuất phát từ chính domain đó. An toàn tuyệt đối chống tấn công Cross-Site Request Forgery (CSRF).
2. **SameSite=Lax (Mặc định của Chrome):** Cookie được gửi khi người dùng click vào một đường link điều hướng từ bên ngoài vào (Top-level navigation), nhưng bị chặn trong các request ngầm của iframe, ajax hoặc post form.
3. **SameSite=None:** Bắt buộc phải có cờ \`Secure\` đi kèm. Dành cho các kịch bản nhúng iframe của bên thứ ba (Third-party widgets).

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Các Rào Chắn An Toàn Tầng Mạng (Network Security Perimeter Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VÙNG KHÔNG GIAN BROWSER                            │
│  ├── Same-Origin Policy (SOP): Cấm đọc dữ liệu chéo giữa các Domain         │
│  └── Content Security Policy (CSP): Chặn thực thi mã JavaScript độc hại     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Headers Trao Đổi
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                          VÙNG TRUNG CHUYỂN MẠNG                             │
│  ├── CORS Protocol: Preflight OPTIONS handshake                             │
│  └── TLS / SSL: Mã hóa dữ liệu đường truyền chống nghe lén                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Set-Cookie Directive
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                          VÙNG LƯU TRỮ TRÌNH DUYỆT                           │
│  ├── HttpOnly: Vô hiệu hóa truy cập từ document.cookie (Chống XSS)          │
│  ├── Secure: Chỉ truyền qua kênh mã hóa HTTPS                               │
│  └── SameSite: Ngăn chặn gửi cookie tự động từ website giả mạo (Chống CSRF) │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Kiểm Duyệt CORS Tại Trình Duyệt (Browser Decision Flowchart)
\`\`\`diagram
Client thực hiện gọi fetch('https://api.esmiles.vn/data')
   │
   ▼
Có phải cùng Origin (Protocol + Domain + Port) không?
   ├── [ CÙNG ORIGIN ] ──► Gửi request trực tiếp bình thường
   │
   └── [ KHÁC ORIGIN ]
          │
          ▼
       Có phải Simple Request (GET/POST với form thuần túy) không?
          ├── [ CÓ ] ──► Gửi thẳng request kèm Header 'Origin'
          │
          └── [ KHÔNG (Dùng JSON / Header tùy chỉnh) ]
                 │
                 ▼
              Gửi HTTP OPTIONS Preflight Request
                 │
                 ▼
              Server có trả về 'Access-Control-Allow-Origin' khớp không?
                 ├── [ KHÔNG ] ──► BROWSER CHẶN LẬP TỨC (Lỗi CORS Error trên Console)
                 └── [ CÓ ] ─────► Cho phép gửi Request thực sự tiếp theo
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Nơi Lưu Trữ Token Xác Thực (Storage Decision Tree)
\`\`\`diagram
BẠN CẦN LƯU TRỮ ACCESS TOKEN / REFRESH TOKEN Ở CLIENT?
│
├── Lưu vào LocalStorage hoặc SessionStorage?
│   └──► NGUY HIỂM: Rất dễ bị đánh cắp nếu dính lỗ hổng XSS (Mã độc đọc cắp token)
│
└── Lưu vào HttpOnly Cookie?
    ├── Cần bảo mật tối đa cho ứng dụng nội bộ / ngân hàng?
    │   └──► HttpOnly=true + Secure=true + SameSite='Strict'
    │
    └── Ứng dụng cần người dùng bấm link từ Email/Facebook vào tự động đăng nhập?
        └──► HttpOnly=true + Secure=true + SameSite='Lax'
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Vị Trí Lưu Token | Khả Năng Chống XSS | Khả Năng Chống CSRF | Hỗ Trợ Đa Domain | Độ Phức Tạp Triển Khai |
| :--- | :--- | :--- | :--- | :--- |
| **LocalStorage** | Kém (Mất token nếu dính XSS) | Miễn nhiễm tự nhiên với CSRF| Rất dễ (Gửi qua Authorization Header)| Cực kỳ đơn giản |
| **HttpOnly Cookie (Lax)**| Miễn nhiễm hoàn toàn với XSS | Rất cao (Chặn POST từ site khác) | Cần cấu hình CORS withCredentials | Trung bình |
| **HttpOnly Cookie (Strict)**| Miễn nhiễm hoàn toàn với XSS | Tuyệt đối (Không gửi khi đi link) | Khó (Bị logout nếu click link ngoài) | Trung bình |
| **In-Memory Variable** | Tốt (Mất khi F5 lại trang) | Tuyệt đối chống CSRF | Dễ dàng | Cần Refresh Token ngầm để phục hồi |
`,
      realCodeSnippet: `// File: src/modules/security/configuration/security-configuration.service.ts
// Trích dẫn từ kiến trúc Enterprise NestJS - Production Security Middleware & CORS Pipeline
import { Injectable, Logger, INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

export interface CorsSecurityConfig {
  allowedOrigins: string[];
  maxAgeSeconds: number;
}

/**
 * ADR: Thiết lập phòng thủ chiều sâu tầng mạng (Defense In Depth):
 * 1. Helmet: Kích hoạt HSTS (ép HTTPS 1 năm), CSP (chống XSS script injection).
 * 2. CookieParser: Ký mã và giải mã Cookie an toàn.
 * 3. Dynamic CORS: Kiểm tra Origin theo Whitelist động, cấm tuyệt đối '*' khi bật credentials: true.
 * 4. Cache Preflight OPTIONS: Thiết lập Max-Age 86400s để giảm độ trễ mạng cho client.
 */
@Injectable()
export class SecurityConfigurationService {
  private readonly logger = new Logger(SecurityConfigurationService.name);

  public applySecurityPolicies(app: INestApplication, config: CorsSecurityConfig): void {
    // 1. Phân tích Cookie
    app.use(cookieParser());

    // 2. Bảo vệ các Header HTTP bằng Helmet
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
          },
        },
        hsts: {
          maxAge: 31536000, // Ép buộc sử dụng HTTPS trong 1 năm
          includeSubDomains: true,
          preload: true,
        },
      }),
    );

    // 3. Cấu hình CORS chặt chẽ theo Whitelist
    const allowedSet = new Set(config.allowedOrigins);

    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Cho phép các request không có origin (mobile native apps, server-to-server microservices)
        if (!origin || allowedSet.has(origin)) {
          return callback(null, true);
        }

        this.logger.warn(\`Chặn đứng request CORS từ Origin chưa được cấp phép: \${origin}\`);
        callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
      },
      credentials: true, // Cho phép truyền Cookie an toàn (SameSite/HttpOnly)
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
      maxAge: config.maxAgeSeconds, // Cache kết quả Preflight OPTIONS
    });

    this.logger.log(\`Áp dụng chính sách bảo mật mạng thành công. Whitelist: \${config.allowedOrigins.join(', ')}\`);
  }
}`,
      quiz: [
        {
          id: 'c3-l3-q1',
          question: 'Bản chất cốt lõi của cơ chế Cross-Origin Resource Sharing (CORS) là gì và cơ chế này được thực thi bởi thành phần nào trong kiến trúc Web?',
          options: [
            'Là cơ chế kiểm duyệt do Trình duyệt (Browser) thực thi nhằm nới lỏng chính sách Same-Origin Policy (SOP), bảo vệ người dùng không bị trang web độc hại đọc trộm dữ liệu từ domain khác; CORS hoàn toàn không phải là tường lửa bảo vệ máy chủ backend khỏi hacker sử dụng cURL/Postman.',
            'Là tường lửa phần cứng do nhà cung cấp Cloud cài đặt để ngăn chặn các cuộc tấn công từ chối dịch vụ DDoS vào máy chủ backend.',
            'Là thuật toán mã hóa đối xứng của hệ điều hành dùng để bảo vệ các cổng kết nối TCP khỏi các cuộc tấn công nghe lén dữ liệu.',
            'Là giao thức mạng tầng giao vận do tổ chức IETF định nghĩa nhằm tự động nén dung lượng gói tin HTTP trước khi truyền qua Internet.'
          ],
          correctIndex: 0,
          explanation: 'CORS là một chính sách được Browser cưỡng chế (Browser-enforced policy). Nó không bảo vệ backend khỏi các công cụ gọi API trực tiếp (như Postman, cURL, script Python). Vai trò của CORS là bảo vệ phiên làm việc của người dùng trên trình duyệt, không cho website độc hại đọc kết quả trả về từ domain khác khi không được phép.'
        },
        {
          id: 'c3-l3-q2',
          question: 'Vì sao hầu hết các lời gọi API từ ứng dụng frontend hiện đại (React/Vue/Angular) đều kích hoạt một Preflight Request (OPTIONS) trước khi gửi request chính?',
          options: [
            'Vì các framework SPA bắt buộc phải gửi mã hash mã nguồn lên máy chủ để xác thực bản quyền phần mềm.',
            'Vì trình duyệt cần đo tốc độ ping mạng xem có đủ băng thông tải dữ liệu lớn về máy hay không.',
            'Vì request sử dụng Content-Type: application/json hoặc có đính kèm thêm các header tùy biến (như Authorization, x-api-key), khiến nó không còn thỏa mãn tiêu chí của một "Simple Request" theo đặc tả W3C.',
            'Vì máy chủ backend NestJS mặc định từ chối tất cả các yêu cầu gửi trực tiếp mà không thông qua bước đăng ký phiên.'
          ],
          correctIndex: 2,
          explanation: 'Theo chuẩn W3C CORS, một request chỉ là Simple Request nếu dùng GET/HEAD/POST với headers hạn chế và Content-Type chỉ là text/plain, multipart/form-data, hoặc application/x-www-form-urlencoded. 99% API hiện đại gửi JSON (Content-Type: application/json) hoặc có Authorization header, nên bắt buộc browser phải gửi OPTIONS Preflight xin phép trước.'
        },
        {
          id: 'c3-l3-q3',
          question: 'Thiết lập cờ HttpOnly: true cho Cookie chứa JWT Refresh Token đem lại giá trị bảo mật then chốt nào cho hệ thống?',
          options: [
            'Giúp cookie tự động gia hạn thời gian sống thêm 30 ngày mỗi khi người dùng tải lại trang web.',
            'Ngăn chặn tuyệt đối mã JavaScript chạy trong trình duyệt truy cập vào cookie qua document.cookie, vô hiệu hóa nguy cơ đánh cắp token nếu website không may dính lỗ hổng Cross-Site Scripting (XSS).',
            'Tự động mã hóa toàn bộ dữ liệu lưu trong cơ sở dữ liệu bằng thuật toán mã hóa bất đối xứng khóa công khai.',
            'Ép buộc người dùng phải xác thực sinh trắc học vân tay trước khi trình duyệt gửi cookie lên máy chủ backend.'
          ],
          correctIndex: 1,
          explanation: 'Khi cờ HttpOnly được bật, trình duyệt cấm hoàn toàn JavaScript truy cập cookie đó. Ngay cả khi hacker khai thác thành công lỗ hổng XSS và chèn được script độc hại vào trang, script đó cũng không thể đọc được document.cookie để gửi token về máy chủ của hacker.'
        },
        {
          id: 'c3-l3-q4',
          question: 'Vì sao việc cấu hình Access-Control-Allow-Origin: * kết hợp với Access-Control-Allow-Credentials: true bị trình duyệt coi là vi phạm nghiêm trọng và lập tức chặn đứng kết nối?',
          options: [
            'Vì ký tự dấu sao (*) không phải là chuỗi hợp lệ theo cú pháp ngôn ngữ C++ của nhân trình duyệt.',
            'Vì hệ thống máy chủ cơ sở dữ liệu không thể phân biệt được đâu là người dùng thật và đâu là bot tự động khi dùng dấu sao.',
            'Vì giao thức HTTP/2 và HTTP/3 đã loại bỏ hoàn toàn việc hỗ trợ ký tự đại diện trong các trường header phản hồi.',
            'Vì sự kết hợp này sẽ cho phép bất kỳ website độc hại nào trên Internet đều có thể gửi request ngầm kèm theo Cookie/Credentials của người dùng đến server và đọc trộm toàn bộ dữ liệu phản hồi riêng tư.'
          ],
          correctIndex: 3,
          explanation: 'Nếu cho phép * đi cùng Credentials: true, bất kỳ website nào người dùng ghé thăm đều có thể gửi request AJAX mang theo cookie đăng nhập đến ngân hàng/mạng xã hội của nạn nhân và đọc toàn bộ dữ liệu trả về. Chuẩn CORS cấm tuyệt đối điều này: nếu cho phép Credentials, Origin bắt buộc phải là một domain cụ thể tường minh.'
        },
        {
          id: 'c3-l3-q5',
          question: 'Sự khác biệt về hành vi giữa hai giá trị cờ SameSite=Lax và SameSite=Strict khi người dùng bấm vào một đường link liên kết từ trang mạng xã hội bên ngoài dẫn về website của bạn là gì?',
          options: [
            'SameSite=Lax không cho phép gửi cookie trong bất kỳ tình huống nào, còn Strict cho phép gửi nếu có HTTPS.',
            'SameSite=Lax chỉ hỗ trợ phương thức POST, còn Strict chỉ hỗ trợ phương thức GET.',
            'Với SameSite=Strict, trình duyệt KHÔNG gửi cookie trong request điều hướng từ trang ngoài vào (khiến người dùng thấy trạng thái chưa đăng nhập khi vừa click link); với SameSite=Lax, cookie vẫn được gửi theo các yêu cầu điều hướng cấp cao nhất (Top-level GET navigation).',
            'Cả hai giá trị đều có hành vi giống hệt nhau trong mọi trường hợp trên các trình duyệt hiện đại.'
          ],
          correctIndex: 2,
          explanation: 'SameSite=Strict chặn gửi cookie trong mọi request cross-site, kể cả khi người dùng click vào một link GET thông thường từ ngoài vào. SameSite=Lax an toàn chống CSRF (chặn cookie trong POST/PUT/iframe cross-site) nhưng vẫn cho phép gửi cookie khi người dùng bấm link điều hướng Top-level (GET), mang lại trải nghiệm tiện lợi khi mở link từ email/mạng xã hội mà vẫn giữ trạng thái đăng nhập.'
        },
        {
          id: 'c3-l3-q6',
          question: 'Giá trị của Header Access-Control-Max-Age trong phản hồi của Preflight OPTIONS request đóng vai trò gì trong việc tối ưu hóa hiệu năng mạng của ứng dụng frontend?',
          options: [
            'Quy định khoảng thời gian (tính bằng giây) mà trình duyệt được phép lưu trữ bộ đệm (cache) kết quả kiểm tra Preflight, giúp các request API tiếp theo không phải gửi thêm OPTIONS request thăm dò nữa.',
            'Xác định thời gian tối đa mà kết nối TCP được phép duy trì trạng thái Keep-Alive trước khi bị ngắt.',
            'Thiết lập thời gian hết hạn của Access Token trong bộ nhớ RAM của trình duyệt.',
            'Giới hạn thời gian tối đa mà máy chủ backend được phép xử lý một truy vấn cơ sở dữ liệu.'
          ],
          correctIndex: 0,
          explanation: 'Mỗi lần gọi API có Preflight OPTIONS sẽ tốn thêm 1 RTT mạng. Header Access-Control-Max-Age: 86400 báo cho trình duyệt cache lại quyền truy cập này trong 24 giờ. Trong khoảng thời gian đó, các request cùng method/header đến cùng endpoint sẽ được gửi thẳng mà không cần tốn thêm vòng lặp OPTIONS thăm dò.'
        },
        {
          id: 'c3-l3-q7',
          question: 'Header bảo mật Strict-Transport-Security (HSTS) do máy chủ gửi về cho trình duyệt nhằm ngăn chặn loại hình tấn công mạng nào?',
          options: [
            'Tấn công từ chối dịch vụ phân tán (DDoS Attack).',
            'Tấn công tiêm mã SQL Injection vào các form nhập liệu.',
            'Tấn công chiếm dụng bộ nhớ RAM (Memory Buffer Overflow).',
            'Tấn công hạ cấp giao thức (SSL Stripping) và nghe lén dữ liệu trên đường truyền không an toàn (Man-in-the-Middle), bằng cách ép buộc trình duyệt chỉ được phép giao tiếp qua kết nối HTTPS mã hóa trong suốt thời gian quy định.'
          ],
          correctIndex: 3,
          explanation: 'HSTS (HTTP Strict Transport Security) yêu cầu trình duyệt tự động chuyển đổi toàn bộ các liên kết http:// thành https:// trước khi gửi gói tin ra mạng, ngăn chặn kẻ tấn công trung gian (MITM) chặn gói tin bắt tay để ép trình duyệt hạ cấp giao thức xuống HTTP không mã hóa (SSL Stripping).'
        },
        {
          id: 'c3-l3-q8',
          question: 'Tại sao việc lưu trữ JWT Access Token trong localStorage lại bị coi là một rủi ro an ninh nghiêm trọng hơn nhiều so với việc lưu trong HttpOnly Cookie?',
          options: [
            'Vì localStorage tự động đồng bộ dữ liệu lên máy chủ của Google Drive khiến lộ token ra ngoài.',
            'Vì dữ liệu trong localStorage có thể bị đọc bởi bất kỳ đoạn mã JavaScript nào chạy trong cùng Origin; chỉ cần ứng dụng dính một lỗ hổng XSS nhỏ (từ thư viện npm bên thứ ba hoặc input chưa sanitize), toàn bộ token sẽ bị đánh cắp tức thì.',
            'Vì localStorage có dung lượng tối đa chỉ 512 bytes không đủ chứa chữ ký điện tử của JWT.',
            'Vì localStorage sẽ tự động xóa sạch dữ liệu sau mỗi 5 phút khiến phiên đăng nhập liên tục bị gián đoạn.'
          ],
          correctIndex: 1,
          explanation: 'localStorage hoàn toàn không có cơ chế bảo vệ khỏi JavaScript. Một đoạn script độc hại được chèn qua lỗ hổng XSS (hoặc chuỗi cung ứng npm supply chain attack) có thể gọi localStorage.getItem("token") và gửi về máy chủ từ xa trong 1 phần nghìn giây. Ngược lại, HttpOnly Cookie nằm ngoài tầm với của JavaScript, bảo vệ token an toàn trước XSS.'
        }
      ],
      codeChallenge: {
        id: 'c3-l3-c1',
        title: 'Xây Dựng CORS Origin Whitelist Checker',
        description: 'Hiện thực hàm \`validateCorsOrigin(requestOrigin: string | undefined, whitelist: string[]): { isAllowed: boolean; allowOriginHeader: string }\`. Nếu \`requestOrigin\` nằm trong danh sách \`whitelist\`, trả về \`{ isAllowed: true, allowOriginHeader: requestOrigin }\`. Nếu không có origin (server-to-server call), trả về \`{ isAllowed: true, allowOriginHeader: "" }\`. Nếu có origin nhưng không nằm trong whitelist hoặc whitelist không phải là mảng, trả về \`{ isAllowed: false, allowOriginHeader: "" }\`.',
        starterCode: `export function validateCorsOrigin(
  requestOrigin: string | undefined,
  whitelist: string[]
): { isAllowed: boolean; allowOriginHeader: string } {
  // TODO: Hiện thực kiểm tra whitelist an toàn CORS
  return { isAllowed: false, allowOriginHeader: '' };
}`,
        solution: `export function validateCorsOrigin(
  requestOrigin: string | undefined,
  whitelist: string[]
): { isAllowed: boolean; allowOriginHeader: string } {
  if (!requestOrigin) {
    return { isAllowed: true, allowOriginHeader: '' };
  }

  if (Array.isArray(whitelist) && whitelist.includes(requestOrigin)) {
    return { isAllowed: true, allowOriginHeader: requestOrigin };
  }

  return { isAllowed: false, allowOriginHeader: '' };
}`,
        testCases: [
          {
            name: 'Case 1 (Visible): Cho phép origin nằm trong whitelist',
            input: ['https://app.esmiles.vn', ['https://app.esmiles.vn', 'https://admin.esmiles.vn']],
            expected: { isAllowed: true, allowOriginHeader: 'https://app.esmiles.vn' },
            hidden: false
          },
          {
            name: 'Case 2 (Visible): Chặn origin lạ không nằm trong whitelist',
            input: ['https://evil-hacker.com', ['https://app.esmiles.vn']],
            expected: { isAllowed: false, allowOriginHeader: '' },
            hidden: false
          },
          {
            name: 'Case 3 (Visible): Cho phép request không có origin header (gọi server-to-server nội bộ)',
            input: [undefined, ['https://app.esmiles.vn']],
            expected: { isAllowed: true, allowOriginHeader: '' },
            hidden: false
          },
          {
            name: 'Case 4 (Hidden): whitelist rỗng -> Chặn tất cả các request có origin',
            input: ['https://app.esmiles.vn', []],
            expected: { isAllowed: false, allowOriginHeader: '' },
            hidden: true
          },
          {
            name: 'Case 5 (Hidden): Khớp chính xác origin của admin',
            input: ['https://admin.esmiles.vn', ['https://app.esmiles.vn', 'https://admin.esmiles.vn']],
            expected: { isAllowed: true, allowOriginHeader: 'https://admin.esmiles.vn' },
            hidden: true
          }
        ]
      }
    }
  ]
};
