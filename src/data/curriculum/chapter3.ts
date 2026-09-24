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
      realCodeSnippet: `
import { Injectable, Logger } from '@nestjs/common';
import * as http2 from 'http2';

@Injectable()
export class Http2ClientService {
  private readonly logger = new Logger(Http2ClientService.name);

  /**
   * Minh họa gửi nhiều request đồng thời qua cơ chế Multiplexing
   * trên một kết nối HTTP/2 duy nhất mà không tốn công tạo nhiều TCP sockets
   */
  public async fetchMultipleStreamsMultiplexed(
    targetUrl: string,
    paths: string[]
  ): Promise<string[]> {
    return new Promise((resolve, reject) => {
      // Thiết lập duy nhất 1 phiên kết nối HTTP/2
      const client = http2.connect(targetUrl);
      const responses: string[] = [];
      let completedStreams = 0;

      client.on('error', (err) => {
        this.logger.error('HTTP/2 Session Error', err);
        reject(err);
      });

      paths.forEach((path, index) => {
        // Mở các stream nhị phân độc lập trên cùng 1 kết nối
        const req = client.request({
          [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
          [http2.constants.HTTP2_HEADER_METHOD]: 'GET',
          [http2.constants.HTTP2_HEADER_PATH]: path,
        });

        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
          data += chunk;
        });

        req.on('end', () => {
          responses[index] = data;
          completedStreams++;
          if (completedStreams === paths.length) {
            client.close();
            resolve(responses);
          }
        });

        req.end();
      });
    });
  }
}
`,
      quiz: [
        {
          id: 'c3-l1-q1',
          question: 'Hiện tượng TCP Head-of-Line Blocking trong HTTP/2 gây ra hậu quả tiêu cực nào khi gặp môi trường mạng có tỉ lệ mất gói tin (Packet Loss)?',
          options: [
            'Một gói tin của một luồng bị mất sẽ khiến hệ điều hành giữ lại tất cả các luồng khác trên cùng kết nối TCP đó.',
            'Toàn bộ kết nối TCP sẽ bị hủy ngay lập tức và client phải thực hiện lại quá trình bắt tay ba bước từ đầu.',
            'Máy chủ backend sẽ tự động hạ cấp giao thức xuống HTTP/1.0 để truyền tuần tự từng tệp tin văn bản thô.',
            'Dữ liệu của các luồng khác sẽ bị ghi đè lẫn lộn vào nhau do không có bảng định danh luồng nhị phân độc lập.'
          ],
          correctIndex: 0,
          explanation: 'Dù HTTP/2 phân chia các request thành nhiều stream nhị phân ở tầng ứng dụng, nhưng ở tầng giao vận, toàn bộ các stream này đều đi qua đúng một luồng byte tuần tự của giao thức TCP. Khi một packet TCP bị mất, TCP stack của hệ điều hành bắt buộc phải hoãn bàn giao mọi dữ liệu phía sau cho đến khi packet bị mất được truyền lại thành công, làm tắc nghẽn toàn bộ các stream khác.'
        },
        {
          id: 'c3-l1-q2',
          question: 'Vì sao giao thức HTTP/3 chuyển sang sử dụng giao thức UDP kết hợp với QUIC thay vì tiếp tục sử dụng TCP truyền thống?',
          options: [
            'Để triệt tiêu triệt để hiện tượng nghẽn luồng chéo giữa các stream và hỗ trợ chuyển mạng không gián đoạn kết nối.',
            'Vì UDP có khả năng mã hóa dữ liệu mặc định ở tầng phần cứng nhanh hơn giao thức bảo mật tầng truyền tải TLS.',
            'Vì các thiết bị định tuyến mạng trên thế giới chỉ cho phép băng thông cao nhất đối với các gói tin UDP không xác nhận.',
            'Để loại bỏ hoàn toàn các trường thông tin Header của HTTP nhằm giúp giảm kích thước gói tin xuống mức tối thiểu.'
          ],
          correctIndex: 0,
          explanation: 'QUIC chạy trên UDP cho phép kiểm soát việc truyền lại lỗi độc lập trên từng Stream mà không phụ thuộc vào hàng đợi tuần tự cứng nhắc của TCP, triệt tiêu hoàn toàn Head-of-Line Blocking. Ngoài ra, QUIC dùng Connection ID thay vì bộ tứ IP/Port, cho phép người dùng chuyển từ Wifi sang 4G (Connection Migration) mà không bị đứt kết nối hay phải bắt tay lại.'
        },
        {
          id: 'c3-l1-q3',
          question: 'Tính năng 0-RTT Connection Resumption trong giao thức TLS 1.3 và QUIC mang lại lợi ích gì lớn nhất cho trải nghiệm người dùng?',
          options: [
            'Cho phép client gửi kèm dữ liệu HTTP ngay trong gói tin đầu tiên nếu đã từng kết nối với server trước đó.',
            'Loại bỏ hoàn toàn sự cần thiết của chứng chỉ số SSL và giúp client kết nối thẳng tới cổng ứng dụng backend.',
            'Tự động tăng gấp đôi băng thông đường truyền mạng bằng cách kết hợp song song cả sóng vô tuyến và cáp quang.',
            'Miễn phí hoàn toàn tài nguyên CPU dùng cho việc giải mã các gói tin dữ liệu trên các máy chủ đám mây.'
          ],
          correctIndex: 0,
          explanation: 'Với 0-RTT (Zero Round Trip Time), nếu client đã bắt tay với server trước đó và còn lưu khóa phiên (Session Ticket), client có thể mã hóa và gửi dữ liệu HTTP (ví dụ GET request) ngay trong gói tin đầu tiên gửi đi, giúp giảm độ trễ phản hồi xuống đúng bằng 1 chiều truyền sóng thay vì phải đợi nhiều chu kỳ khứ hồi.'
        },
        {
          id: 'c3-l1-q4',
          question: 'Trong kiến trúc Microservices nội bộ chịu tải cao, việc duy trì HTTP Keep-Alive Connection Pooling mang lại giá trị nào sau đây?',
          options: [
            'Tái sử dụng các kết nối TCP đã mở sẵn giúp loại bỏ hoàn toàn chi phí bắt tay ba bước và khởi tạo khóa TLS cho từng request.',
            'Tự động nén tất cả các bản ghi cơ sở dữ liệu thành tệp nén zip trước khi truyền qua mạng nội bộ trung tâm dữ liệu.',
            'Bảo đảm tính toàn vẹn của dữ liệu bằng cách ép buộc máy chủ phải lưu trữ toàn bộ lịch sử các gói tin trong RAM.',
            'Cho phép một microservice đơn lẻ có thể phục vụ vô hạn số lượng kết nối mà không bị giới hạn bởi phần cứng máy chủ.'
          ],
          correctIndex: 0,
          explanation: 'Nếu không có Keep-Alive (Connection Pooling), mỗi lần Service A gọi Service B sẽ phải tạo một kết nối TCP mới: tốn 3-way handshake + TLS handshake + chi phí cấp phát File Descriptor và TIME_WAIT socket. Keep-Alive giữ kết nối mở để tái sử dụng cho các request sau, giảm tối đa độ trễ và tải CPU của hệ thống.'
        }
      ],
      codeChallenge: {
        id: 'c3-l1-c1',
        title: 'Xây Dựng Cơ Chế Tái Sử Dụng Kết Nối (Connection Pool Keep-Alive Simulator)',
        description: 'Hiện thực hàm \`simulateConnectionPool(maxSize: number, ops: Array<{ op: "acquire" } | { op: "release"; connId: string }>): string[]\`. Khi gặp \`"acquire"\`: nếu có kết nối trong \`idle\`, tái sử dụng nó; nếu chưa đầy \`maxSize\`, tạo mới \`"conn_\${id}"\`; đẩy ID kết nối nhận được vào mảng kết quả. Khi gặp \`"release"\`: đưa \`connId\` trở lại hàng đợi \`idle\`. Trả về mảng các kết nối đã acquire.',
        starterCode: `
export function simulateConnectionPool(
  maxSize: number,
  ops: Array<{ op: 'acquire' } | { op: 'release'; connId: string }>
): string[] {
  // TODO: Hiện thực Connection Pool tái sử dụng
  return [];
}
`,
        solution: `
export function simulateConnectionPool(
  maxSize: number,
  ops: Array<{ op: 'acquire' } | { op: 'release'; connId: string }>
): string[] {
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
      active--;
      idle.push(item.connId);
    }
  }

  return results;
}
`,
        testCases: [
          {
            name: 'Cấp phát connection mới khi pool chưa đầy',
            input: [2, [{ op: 'acquire' }]],
            expected: ['conn_1']
          },
          {
            name: 'Tái sử dụng connection sau khi được release',
            input: [1, [
              { op: 'acquire' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' }
            ]],
            expected: ['conn_1', 'conn_1']
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
      realCodeSnippet: `
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';

interface CachedResponse {
  status: 'PROCESSING' | 'COMPLETED';
  requestHash: string;
  statusCode?: number;
  body?: unknown;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // Giả lập lưu trữ phân tán Redis trong bộ nhớ
  private readonly redisStore = new Map<string, CachedResponse>();

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const idempotencyKey = request.headers['x-idempotency-key'];

    // Nếu không có header này hoặc là method GET thì bỏ qua
    if (!idempotencyKey || request.method === 'GET') {
      return next.handle();
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(request.body || {}))
      .digest('hex');

    const cached = this.redisStore.get(idempotencyKey);

    if (cached) {
      if (cached.status === 'PROCESSING') {
        throw new ConflictException(
          'Yêu cầu giao dịch đang được xử lý. Vui lòng không gửi lại liên tục.'
        );
      }

      if (cached.requestHash !== currentHash) {
        throw new UnprocessableEntityException(
          'Idempotency Key đã được sử dụng với payload dữ liệu khác.'
        );
      }

      // Trả lại nguyên vẹn kết quả cũ từ Cache
      response.status(cached.statusCode || 200);
      return of(cached.body);
    }

    // Đánh dấu trạng thái đang xử lý (SETNX)
    this.redisStore.set(idempotencyKey, {
      status: 'PROCESSING',
      requestHash: currentHash,
    });

    return next.handle().pipe(
      tap((body) => {
        // Lưu trữ kết quả thành công vào Redis Cache
        this.redisStore.set(idempotencyKey, {
          status: 'COMPLETED',
          requestHash: currentHash,
          statusCode: response.statusCode || 200,
          body,
        });
      })
    );
  }
}
`,
      quiz: [
        {
          id: 'c3-l2-q1',
          question: 'Theo chuẩn kỹ thuật RFC 9110, phương thức DELETE có được coi là Idempotent không và vì sao?',
          options: [
            'Có, vì dù gọi một lần hay nhiều lần thì trạng thái cuối cùng của tài nguyên trong database vẫn là bị xóa.',
            'Không, vì lần gọi đầu tiên trả về mã 200 còn các lần gọi tiếp theo trả về mã 404 nên không giống nhau.',
            'Không, vì phương thức DELETE luôn làm thay đổi dữ liệu máy chủ nên bị coi là phương thức không an toàn.',
            'Có, với điều kiện bắt buộc máy chủ phải trả về cùng một mã trạng thái HTTP 200 cho tất cả mọi lần gọi lại.'
          ],
          correctIndex: 0,
          explanation: 'Theo chuẩn RFC 9110, tính chất Idempotent (Lũy kế) xét trên trạng thái dữ liệu của hệ thống máy chủ, không phụ thuộc vào việc mã HTTP trả về giống hay khác nhau. Khi gọi DELETE /users/123 lần đầu, user bị xóa (200/204). Khi gọi tiếp, user vẫn ở trạng thái đã bị xóa (404), không có tác dụng phụ mới phát sinh.'
        },
        {
          id: 'c3-l2-q2',
          question: 'Nếu client gửi lại một request thanh toán với cùng Idempotency-Key cũ nhưng đã sửa đổi số tiền trong Request Body, hệ thống backend chuẩn phải xử lý thế nào?',
          options: [
            'Từ chối ngay lập tức với mã lỗi 422 Unprocessable Entity vì vi phạm tính toàn vẹn payload của khóa lũy kế.',
            'Tự động ghi đè số tiền mới và trừ thêm tiền từ tài khoản người dùng để phục vụ giao dịch mới nhất.',
            'Trả về kết quả thành công của giao dịch cũ mà không cần kiểm tra xem dữ liệu body có bị sửa đổi hay không.',
            'Xóa khóa cũ khỏi Redis và thực thi lại toàn bộ quy trình thanh toán từ đầu với thông tin số tiền mới.'
          ],
          correctIndex: 0,
          explanation: 'Idempotency Key gắn liền với một giao dịch cụ thể duy nhất. Nếu client gửi cùng key nhưng đổi payload (Request Body Mismatch), đây có thể là dấu hiệu tấn công gian lận hoặc lỗi phần mềm phía client. Hệ thống phải băm hash body để so sánh và ném ra lỗi 422 Unprocessable Entity để bảo vệ an toàn.'
        },
        {
          id: 'c3-l2-q3',
          question: 'Hiện tượng gì xảy ra nếu hai yêu cầu thanh toán POST có cùng một Idempotency-Key ập đến hệ thống cùng một mili giây trong kiến trúc phân tán?',
          options: [
            'Cần dùng lệnh nguyên tử SETNX của Redis; request đầu tiên chiếm được khóa còn request thứ hai bị từ chối 409 Conflict.',
            'Cả hai request cùng được đưa vào hàng đợi cơ sở dữ liệu và tự động gộp số tiền thanh toán làm một giao dịch duy nhất.',
            'Hệ điều hành Linux sẽ tự động ngắt kết nối mạng của request đến sau do phát hiện xung đột dữ liệu cổng mạng.',
            'Hệ thống NestJS sẽ tự động dừng toàn bộ tiến trình để chờ lập trình viên vào can thiệp thủ công bằng tay.'
          ],
          correctIndex: 0,
          explanation: 'Để tránh Race Condition khi 2 request đến cùng thời điểm, ta sử dụng thao tác nguyên tử (atomic) SETNX (Set if Not Exists) trên Redis. Request đầu tiên sẽ set key thành công và thực thi. Request thứ hai thấy key đã tồn tại ở trạng thái PROCESSING sẽ lập tức bị chặn với lỗi 409 Conflict.'
        },
        {
          id: 'c3-l2-q4',
          question: 'Vì sao trong giao thức HTTP, phương thức POST mặc định lại KHÔNG có tính chất Idempotent?',
          options: [
            'Vì mỗi lần gọi POST thường tạo ra một tài nguyên mới độc lập hoặc kích hoạt một chuỗi hành động có hiệu ứng phụ mới.',
            'Vì phương thức POST không hỗ trợ truyền dữ liệu trong phần thân body theo quy chuẩn của tổ chức W3C.',
            'Vì các máy chủ proxy và bộ nhớ đệm trình duyệt luôn tự động cache lại toàn bộ kết quả của mọi lệnh gọi POST.',
            'Vì phương thức POST bắt buộc phải đi kèm với chứng chỉ bảo mật SSL cấp doanh nghiệp mới được phép thực thi.'
          ],
          correctIndex: 0,
          explanation: 'Phương thức POST được thiết kế để tạo mới tài nguyên (mỗi lần gọi sinh ra 1 ID mới trong DB) hoặc thực hiện các hành động có hiệu ứng phụ (trừ tiền, gửi email). Do đó, gọi POST N lần sẽ tạo ra N bản ghi hoặc trừ tiền N lần, nên bản chất không bao giờ có tính Idempotent trừ khi chủ động cài đặt Idempotency Key.'
        }
      ],
      codeChallenge: {
        id: 'c3-l2-c1',
        title: 'Hiện Thực Idempotent Request Validator Bằng Memory Cache',
        description: 'Hiện thực class \`IdempotencyValidator\` với phương thức \`processRequest(key: string, payload: unknown, action: () => unknown): { status: number; data: unknown }\`. Nếu \`key\` chưa có, thực thi \`action()\`, lưu kết quả cache và trả về \`{ status: 200, data: result }\`. Nếu \`key\` đã tồn tại với cùng payload, trả về \`{ status: 200, data: cachedResult }\` mà KHÔNG gọi \`action()\`. Nếu \`key\` đã tồn tại nhưng payload bị thay đổi khác trước, ném ra Error \`"PAYLOAD_MISMATCH"\`.',
        starterCode: `
export class IdempotencyValidator {
  public processRequest(
    key: string,
    payload: unknown,
    action: () => unknown
  ): { status: number; data: unknown } {
    // TODO: Hiện thực kiểm tra khóa và chống trùng lặp payload
    return { status: 200, data: action() };
  }
}
`,
        solution: `
export class IdempotencyValidator {
  private readonly cache = new Map<string, { payloadStr: string; result: unknown }>();

  public processRequest(
    key: string,
    payload: unknown,
    action: () => unknown
  ): { status: number; data: unknown } {
    const payloadStr = JSON.stringify(payload);
    const existing = this.cache.get(key);

    if (existing) {
      if (existing.payloadStr !== payloadStr) {
        throw new Error('PAYLOAD_MISMATCH');
      }
      return { status: 200, data: existing.result };
    }

    const result = action();
    this.cache.set(key, { payloadStr, result });
    return { status: 200, data: result };
  }
}
`,
        testCases: [
          {
            name: 'Thực thi action lần đầu thành công',
            input: [
              'key_1',
              { amount: 500 },
              () => ({ invoiceId: 'INV_001' })
            ],
            expected: { status: 200, data: { invoiceId: 'INV_001' } }
          },
          {
            name: 'Gọi lại cùng key và payload không kích hoạt lại action',
            input: [
              'key_cached',
              { amount: 100 },
              () => 'SHOULD_NOT_BE_CALLED'
            ],
            expected: { status: 200, data: 'FIRST_RESULT' }
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
      realCodeSnippet: `
import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

/**
 * Cấu hình bảo mật mạng chuẩn Production cho NestJS
 */
export function configureSecurityMiddleware(app: INestApplication): void {
  // 1. Phân tích Cookie an toàn
  app.use(cookieParser());

  // 2. Bảo vệ các Header HTTP bằng Helmet
  app.use(
    helmet({
      contentSecurityPolicy: true, // Chống injection script XSS
      crossOriginEmbedderPolicy: true,
      hsts: {
        maxAge: 31536000, // Ép buộc sử dụng HTTPS trong 1 năm
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // 3. Cấu hình CORS chặt chẽ cho White-listed Domains
  const allowedOrigins = [
    'https://app.esmiles.vn',
    'https://admin.esmiles.vn',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (như mobile apps, server-to-server)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Chính sách CORS không cho phép truy cập từ Origin này.'));
      }
    },
    credentials: true, // Cho phép truyền Cookie an toàn
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
    maxAge: 86400, // Cache kết quả Preflight OPTIONS trong 24 giờ
  });
}
`,
      quiz: [
        {
          id: 'c3-l3-q1',
          question: 'Bản chất cốt lõi của cơ chế Cross-Origin Resource Sharing (CORS) là gì và cơ chế này được thực thi bởi thành phần nào?',
          options: [
            'Là cơ chế bảo mật do trình duyệt thực thi nhằm ngăn chặn trang web đọc trộm tài nguyên từ domain khác khi chưa được cho phép.',
            'Là tường lửa phần cứng do nhà cung cấp đám mây cài đặt để ngăn chặn các cuộc tấn công từ chối dịch vụ vào máy chủ backend.',
            'Là thuật toán mã hóa đối xứng của hệ điều hành dùng để bảo vệ các cổng kết nối TCP khỏi các cuộc tấn công nghe lén dữ liệu.',
            'Là giao thức mạng cấp thấp do tổ chức IETF định nghĩa nhằm tự động nén dung lượng gói tin HTTP trước khi truyền qua Internet.'
          ],
          correctIndex: 0,
          explanation: 'CORS hoàn toàn là một cơ chế kiểm duyệt phía trình duyệt (Browser-side mechanism). Trình duyệt áp dụng chính sách Same-Origin Policy để bảo vệ người dùng khỏi việc bị các website độc hại đọc trộm dữ liệu từ các dịch vụ khác. CORS không phải là tường lửa bảo vệ máy chủ backend khỏi hacker (hacker có thể dùng curl/postman bỏ qua CORS).'
        },
        {
          id: 'c3-l3-q2',
          question: 'Vì sao hầu hết các lời gọi API từ ứng dụng frontend hiện đại (React/Vue) đều kích hoạt một Preflight Request (OPTIONS) trước khi gửi request chính?',
          options: [
            'Vì request sử dụng định dạng JSON trong Content-Type hoặc có đính kèm thêm các header tùy chỉnh như Authorization.',
            'Vì trình duyệt cần kiểm tra tốc độ đường truyền mạng xem có đủ băng thông để tải dữ liệu lớn về máy hay không.',
            'Vì các framework frontend hiện đại bắt buộc phải gửi mã hash kiểm tra tính toàn vẹn của mã nguồn lên máy chủ backend.',
            'Vì máy chủ backend NestJS mặc định từ chối tất cả các yêu cầu gửi trực tiếp mà không thông qua bước đăng ký phiên.'
          ],
          correctIndex: 0,
          explanation: 'Một request chỉ được coi là "Simple Request" (không cần Preflight) nếu dùng GET/HEAD/POST với các Header chuẩn hạn chế và Content-Type chỉ là text/plain, multipart/form-data hoặc application/x-www-form-urlencoded. Các API hiện đại đều dùng Content-Type: application/json hoặc có Header Authorization, khiến trình duyệt bắt buộc phải gửi OPTIONS Preflight hỏi xin phép trước.'
        },
        {
          id: 'c3-l3-q3',
          question: 'Thiết lập cờ HttpOnly: true cho Cookie chứa JWT Refresh Token đem lại giá trị bảo mật then chốt nào?',
          options: [
            'Ngăn chặn tuyệt đối mã độc JavaScript trên trang web truy cập vào cookie giúp triệt tiêu nguy cơ đánh cắp token qua lỗ hổng XSS.',
            'Tự động mã hóa toàn bộ dữ liệu lưu trong cơ sở dữ liệu bằng thuật toán mã hóa bất đối xứng khóa công khai chuẩn quân sự.',
            'Ép buộc người dùng phải xác thực sinh trắc học vân tay trước khi trình duyệt cho phép gửi cookie lên máy chủ backend.',
            'Giúp cookie tự động gia hạn thời gian sống thêm ba mươi ngày mỗi khi người dùng thực hiện tải lại trang web.'
          ],
          correctIndex: 0,
          explanation: 'Khi Cookie được gán cờ HttpOnly, trình duyệt sẽ cấm mã JavaScript truy cập (qua document.cookie). Do đó, ngay cả khi website bị dính lỗ hổng Cross-Site Scripting (XSS) và kẻ tấn công chèn được mã độc JS vào trang, kẻ tấn công cũng không thể đọc hay đánh cắp được token lưu trong HttpOnly Cookie.'
        },
        {
          id: 'c3-l3-q4',
          question: 'Vì sao việc cấu hình Access-Control-Allow-Origin: * kết hợp với Access-Control-Allow-Credentials: true lại bị trình duyệt coi là vi phạm bảo mật và chặn đứng?',
          options: [
            'Vì cho phép mọi trang web bên thứ ba đều có thể tự động gửi kèm thông tin định danh và cookie của người dùng là quá nguy hiểm.',
            'Vì ký tự đại diện ngôi sao không phải là một chuỗi văn bản hợp lệ theo chuẩn định dạng cú pháp của ngôn ngữ lập trình C++.',
            'Vì hệ thống máy chủ cơ sở dữ liệu không thể phân biệt được đâu là người dùng thật và đâu là bot tự động khi dùng dấu sao.',
            'Vì giao thức HTTP/2 và HTTP/3 đã loại bỏ hoàn toàn việc hỗ trợ ký tự đại diện trong các trường header phản hồi.'
          ],
          correctIndex: 0,
          explanation: 'Nếu cho phép dấu sao (*) đi cùng Credentials=true, bất kỳ trang web độc hại nào cũng có thể gửi request ngầm mang theo Cookie/Session của người dùng đến server ngân hàng/mạng xã hội và đọc được phản hồi nhạy cảm. Để bảo vệ người dùng, chuẩn Web cấm tuyệt đối sự kết hợp này; nếu dùng Credentials=true, Origin bắt buộc phải là một tên miền cụ thể xác định.'
        }
      ],
      codeChallenge: {
        id: 'c3-l3-c1',
        title: 'Xây Dựng CORS Origin Whitelist Checker',
        description: 'Hiện thực hàm \`validateCorsOrigin(requestOrigin: string | undefined, whitelist: string[]): { isAllowed: boolean; allowOriginHeader: string }\`. Nếu \`requestOrigin\` nằm trong danh sách \`whitelist\`, trả về \`{ isAllowed: true, allowOriginHeader: requestOrigin }\`. Nếu không có origin (server-to-server call), trả về \`{ isAllowed: true, allowOriginHeader: "" }\`. Nếu có origin nhưng không nằm trong whitelist, trả về \`{ isAllowed: false, allowOriginHeader: "" }\`.',
        starterCode: `
export function validateCorsOrigin(
  requestOrigin: string | undefined,
  whitelist: string[]
): { isAllowed: boolean; allowOriginHeader: string } {
  // TODO: Hiện thực kiểm tra whitelist an toàn CORS
  return { isAllowed: false, allowOriginHeader: '' };
}
`,
        solution: `
export function validateCorsOrigin(
  requestOrigin: string | undefined,
  whitelist: string[]
): { isAllowed: boolean; allowOriginHeader: string } {
  if (!requestOrigin) {
    return { isAllowed: true, allowOriginHeader: '' };
  }

  if (whitelist.includes(requestOrigin)) {
    return { isAllowed: true, allowOriginHeader: requestOrigin };
  }

  return { isAllowed: false, allowOriginHeader: '' };
}
`,
        testCases: [
          {
            name: 'Cho phép origin nằm trong whitelist',
            input: ['https://app.esmiles.vn', ['https://app.esmiles.vn', 'https://admin.esmiles.vn']],
            expected: { isAllowed: true, allowOriginHeader: 'https://app.esmiles.vn' }
          },
          {
            name: 'Chặn origin lạ không nằm trong whitelist',
            input: ['https://evil-hacker.com', ['https://app.esmiles.vn']],
            expected: { isAllowed: false, allowOriginHeader: '' }
          },
          {
            name: 'Cho phép request không có origin header (gọi nội bộ)',
            input: [undefined, ['https://app.esmiles.vn']],
            expected: { isAllowed: true, allowOriginHeader: '' }
          }
        ]
      }
    }
  ]
};
