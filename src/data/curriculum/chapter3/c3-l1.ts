import type { Lesson } from '../types.ts';

export const c3_l1: Lesson = {
  id: 'c3-l1',
  title: 'Bài 01: Tầng Giao Vận (Transport Layer): TCP Sockets, 3-Way Handshake, Head-of-Line Blocking & HTTP/3 QUIC',
  duration: '60 phút',
  tag: 'Networking & Transport Layer',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Kỹ thuật Giao vận Mạng (Network Transport Engineering) từ cấp độ Bộ đệm Socket trong Nhân hệ điều hành Linux (Kernel TCP/UDP Stack) đến kiến trúc Đa luồng Ghép kênh (Multiplexing) của HTTP/2 và HTTP/3 QUIC cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Giải phẫu Vòng đời Kết nối TCP Sockets, Bắt tay 3 Bước (3-Way Handshake), TLS 1.3 và Quản trị Trạng thái \`TIME_WAIT\`:** Hiểu rõ cơ chế đồng bộ Số thứ tự gói tin (\`ISN — Initial Sequence Number\`), cấu trúc hai hàng đợi cấp nhân (\`SYN Queue\` và \`Accept Queue\`), chi phí vật lý của vòng lặp mạng (\`Round Trip Time — RTT\`), và nguyên nhân gây sập máy chủ do **Cạn kiệt Cổng Tạm thời (\`Ephemeral Port Exhaustion — EADDRNOTAVAIL\`)** khi thiếu bể tái sử dụng kết nối (\`Keep-Alive Connection Pool\`).
> 2. **Cơ chế Kiểm soát Luồng TCP (\`Sliding Window\`), Nén Tiêu đề \`HPACK\` và Nghịch lý Nghẽn Đầu Hàng (\`TCP Head-of-Line Blocking\`) trong HTTP/2:** Phân tích toán học công thức băng thông \`Mathis\` dưới tác động của mất gói tin (\`Packet Loss\`), xung đột giữa **Thuật toán Nagle (\`Nagle's Algorithm\`)** với **\`Delayed ACK\`** (và vai trò của cờ \`TCP_NODELAY\`), cũng như lý do tại sao một gói tin bị rớt lại làm đóng băng toàn bộ hàng trăm luồng \`HTTP/2 Streams\` độc lập.
> 3. **Kiến trúc Đột phá của Giao thức HTTP/3 trên nền tảng \`QUIC (UDP)\` và Điều phối Kết nối Thực chiến trong NestJS:** Nắm vững cách \`QUIC\` chuyển tầng kiểm soát luồng và sửa lỗi mất gói lên không gian người dùng (\`User Space\`) theo từng luồng độc lập, cơ chế **Di trú Kết nối Không Đứt quãng (\`Connection Migration\`)** bằng mã định danh \`Connection ID (CID)\`, rủi ro tấn công phát lại (\`Replay Attack\`) của \`0-RTT\`, và phương pháp chẩn đoán điểm nghẽn mạng trên môi trường Production.

---

# 1. GIẢI PHẪU TẦNG GIAO VẬN TCP SOCKETS, 3-WAY HANDSHAKE, TLS 1.3 VÀ TRẠNG THÁI KERNEL TIME_WAIT

### 1.1 Khái niệm nền tảng: Cấu trúc Kernel Socket, Bắt tay 3 bước TCP (3-Way Handshake) và Bắt tay Bảo mật TLS 1.3

Khi một dịch vụ Backend NestJS gọi API sang cổng thanh toán hoặc vi dịch vụ khác qua giao thức \`HTTPS\`, không một byte dữ liệu nghiệp vụ nào được phép rời khỏi card mạng cho đến khi hai máy tính hoàn tất quy trình thiết lập kênh truyền tin cậy ở **Tầng Giao vận (\`Transport Layer — Layer 4\`)** và **Tầng Bảo mật (\`TLS Layer\`)**. Dưới góc nhìn của nhân hệ điều hành Linux (\`Linux Kernel Networking Stack\`), quá trình này diễn ra qua các cấu trúc dữ liệu cấp thấp sau:

1. **Quy trình Bắt tay 3 Bước TCP (\`TCP 3-Way Handshake\`) và Hai Hàng đợi Cấp nhân:**
   Giao thức **TCP (\`Transmission Control Protocol\`)** là giao thức hướng kết nối, đảm bảo dữ liệu đến đúng thứ tự và không bị mất mát. Để khởi tạo kết nối, hai đầu mút phải đồng bộ hóa **Số thứ tự gói tin khởi đầu (\`ISN — Initial Sequence Number\`)** và kích thước bộ đệm nhận thông qua 3 bước tiêu tốn **\`1 RTT\` (\`Round Trip Time\`)**:
   - **Bước 1 (\`SYN\` — Client $\rightarrow$ Server):** Máy khách tạo một số ngẫu nhiên $\\text{ISN}_C = X$ và gửi phân đoạn TCP có bật cờ \`SYN (Seq = X)\`. Khi gói tin này chạm tới máy chủ, nhân Linux tạo một cấu trúc kết nối bán mở (\`request_sock\`), chuyển trạng thái sang \`SYN_RCVD\` và xếp vào **Hàng đợi Bán mở (\`SYN Queue\` / \`tcp_max_syn_backlog\`)**.
   - **Bước 2 (\`SYN-ACK\` — Server $\rightarrow$ Client):** Máy chủ sinh số thứ tự riêng $\\text{ISN}_S = Y$, gửi trả phân đoạn \`SYN-ACK (Seq = Y, Ack = X + 1)\` để xác nhận đã nhận được $\\text{ISN}$ của máy khách.
   - **Bước 3 (\`ACK\` — Client $\rightarrow$ Server):** Máy khách kiểm tra số xác nhận, chuyển sang trạng thái \`ESTABLISHED\` và gửi gói \`ACK (Seq = X + 1, Ack = Y + 1)\`. Ngay tại thời điểm gói \`ACK\` bước 3 vừa rời khỏi máy khách, máy khách đã có thể đính kèm ngay gói tin khởi đầu của tầng mã hóa (**\`TLS ClientHello\`**). Khi máy chủ nhận được gói \`ACK\` này, nhân Linux di chuyển kết nối từ \`SYN Queue\` sang **Hàng đợi Hoàn tất (\`Accept Queue\` / \`somaxconn\`)** để chờ vòng lặp \`Libuv\` của Node.js gọi lệnh hệ thống \`accept4()\` lấy ra xử lý!
2. **Đột phá rút ngắn Vòng lặp Bắt tay từ \`TLS 1.2 (2-RTT)\` xuống \`TLS 1.3 (1-RTT & 0-RTT)\`:**
   Sau khi xong \`1 RTT\` của TCP, hai bên phải thỏa thuận khóa mã hóa đối xứng trước khi truyền HTTP:
   - **Trong chuẩn cũ \`TLS 1.2\`:** Máy khách gửi \`ClientHello\`, máy chủ trả lời \`ServerHello + Certificate\`, sau đó hai bên phải tốn thêm **một vòng đi-về nữa** (\`ClientKeyExchange\` + \`ChangeCipherSpec\`) mới hoàn tất khóa phiên $\rightarrow$ Tiêu tốn **\`2 RTT\` cho TLS** + **\`1 RTT\` cho TCP** = **Tổng cộng \`3 RTT\`** trước khi gửi được byte HTTP đầu tiên!
   - **Trong chuẩn hiện đại \`TLS 1.3 (RFC 8446)\`:** Giao thức loại bỏ hoàn toàn các thuật toán trao đổi khóa tĩnh lỗi thời (như RSA Key Transport) và bắt buộc dùng **Trao đổi khóa Bất biến Tạm thời (\`ECDHE — Ephemeral Diffie-Hellman\`)**. Máy khách dự đoán trước thuật toán và đính kèm luôn khóa công khai tạm thời (\`Key Share\`) ngay trong gói \`ClientHello\` đầu tiên! Nhờ đó, máy chủ tính được ngay khóa phiên và hoàn tất bắt tay chỉ trong **\`1 RTT\`** (Tổng cộng \`TCP + TLS 1.3 = 2 RTT\`).
   - **Cơ chế Tái kết nối \`0-RTT Connection Resumption\` và Rủi ro \`Replay Attack\`:** Nếu máy khách đã từng kết nối với máy chủ trước đó và lưu giữ **Vé Phiên (\`Pre-Shared Key / Session Ticket\`)**, \`TLS 1.3\` và \`QUIC\` cho phép máy khách mã hóa và gửi kèm dữ liệu HTTP (\`Early Data\`) ngay trong gói \`ClientHello\` đầu tiên (**\`0-RTT\` cho tầng bảo mật**). Tuy nhiên, dữ liệu \`0-RTT\` không có tính chống phát lại tuyệt đối: nếu kẻ tấn công nghe lén trên mạng bắt được gói tin \`0-RTT\` đó và phát lại (\`Replay\`) 10 lần tới máy chủ, máy chủ có thể thực thi yêu cầu đó 10 lần! Vì vậy, chuẩn kỹ thuật **nghiêm cấm xử lý \`0-RTT Early Data\` cho các yêu cầu làm thay đổi dữ liệu không lũy đẳng (như \`POST\` chuyển tiền)**.

### 1.2 Đối chiếu các Thế hệ Thiết lập Kết nối và Quản trị Vòng đời Socket trên Nhân Linux

Bảng dưới đây phân tích định lượng chi phí thời gian bắt tay (giả định khoảng cách địa lý từ Việt Nam đi Mỹ có độ trễ vật lý \`1 RTT = 180 ms\`) và tác động lên tài nguyên nhân hệ điều hành của 5 mô hình kết nối:

| Mô hình Kết nối Giao vận | Số Vòng lặp Bắt tay (\`Handshake RTTs\`) | Độ trễ Trước Byte HTTP Đầu tiên (Với \`RTT = 180 ms\`) | Mức Tiêu thụ Cổng Tạm thời (\`Ephemeral Ports\`) | Rủi ro Vận hành & Điểm nghẽn Hệ thống Điển hình |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`HTTP/1.1\` Không Keep-Alive + \`TLS 1.2\`** | \`1 RTT (TCP) + 2 RTT (TLS 1.2) = 3 RTT\` | **\`540 ms\`** chỉ để bắt tay cho **mỗi request** (Chưa tính thời gian xử lý API!) | Cấp phát và hủy **\`1 port / request\`**; đẩy hàng vạn socket vào \`TIME_WAIT\` | Cạn kiệt toàn bộ 28,232 cổng tạm thời chỉ sau vài giây chịu tải cao (\`EADDRNOTAVAIL\`) |
| **2. \`HTTP/1.1\` Không Keep-Alive + \`TLS 1.3\`** | \`1 RTT (TCP) + 1 RTT (TLS 1.3) = 2 RTT\` | **\`360 ms\`** cho mỗi request mới | Cấp phát và hủy **\`1 port / request\`**; tích tụ \`TIME_WAIT\` trong 60 giây | Tiêu tốn CPU khổng lồ cho phép toán đường cong Elliptic (\`ECDHE\`) trên từng request |
| **3. \`HTTP/1.1 Keep-Alive Pool\` + \`TLS 1.3\`** | \`2 RTT\` ở lần đầu; **\`0 RTT\`** cho các request tái sử dụng tiếp theo | **\`0 ms\`** chi phí bắt tay trên các socket đang mở sẵn trong bể (\`Idle Pool\`) | Cố định theo kích thước Pool (ví dụ \`50 – 200 sockets\` trên mỗi instance) | Bị nghẽn đầu hàng ở tầng ứng dụng (**HTTP HoL Blocking**): 1 socket chỉ chạy được 1 request tại 1 thời điểm |
| **4. \`HTTP/2 Multiplexing\` (Trên nền TCP + \`TLS 1.3\`)** | \`2 RTT\` duy nhất cho **1 kết nối TCP** gánh hàng trăm luồng song song | **\`0 ms\`** bắt tay khi mở thêm các luồng nhị phân (\`Streams\`) mới trên kết nối cũ | Cực thấp: Chỉ tốn **\`1 socket TCP duy nhất\`** cho mỗi cặp \`Client - Upstream Host\` | Bị nghẽn đầu hàng ở tầng giao vận (**TCP HoL Blocking**) khi rớt dù chỉ 1 gói tin trên đường truyền |
| **5. \`HTTP/3 QUIC\` (Trên nền UDP + \`TLS 1.3 Tích hợp\`)** | **\`1 RTT\`** cho kết nối mới; **\`0 RTT\`** khi tái kết nối (\`Session Resumption\`) | **\`180 ms\`** (lần đầu) hoặc **\`0 ms\`** (tái kết nối gửi dữ liệu ngay trong gói đầu tiên) | Chạy trên **\`UDP Socket\`**, định danh bằng \`Connection ID\` độc lập với IP/Port | Tiêu tốn CPU ở \`User Space\` cao hơn TCP khoảng \`15% – 25%\` do xử lý mật mã và đóng gói theo từng gói UDP |

### 1.3 Hiện tượng Cạn kiệt Cổng Tạm thời (Ephemeral Port Exhaustion), Trạng thái TIME_WAIT (2MSL) và Bể Kết nối Keep-Alive trong NestJS

Một trong những sự cố sập hệ thống kinh điển nhất khi kiến trúc Microservices bước vào đợt cao điểm lưu lượng (\`Flash Sale\`) là lỗi **\`Error: connect EADDRNOTAVAIL\`** (Không còn địa chỉ/cổng cục bộ để mở kết nối đi). Tại sao máy chủ có tới 64 GB RAM và CPU mới dùng 30% mà lại không thể mở thêm kết nối TCP tới Database hay dịch vụ thanh toán?

1. **Giới hạn Vật lý của Bộ tứ Định danh TCP (\`4-Tuple\`) và Dải cổng Tạm thời (\`ip_local_port_range\`):**
   Mỗi kết nối TCP được nhân Linux định danh duy nhất bởi bộ 4 thông số: \`(Source IP, Source Port, Destination IP, Destination Port)\`. Khi máy chủ NestJS của bạn đóng vai trò là Client gọi sang một dịch vụ nội bộ cố định (ví dụ \`OrderService\` tại \`10.0.1.50:443\`), thì 3 thông số \`Source IP\`, \`Destination IP\` và \`Destination Port\` là **hằng số bất biến**.
   - Do đó, số lượng kết nối đồng thời tối đa tới đích đó phụ thuộc hoàn toàn vào số lượng **Cổng nguồn Tạm thời (\`Ephemeral Source Ports\`)** mà nhân Linux có thể cấp phát.
   - Theo cấu hình mặc định của Linux (\`/proc/sys/net/ipv4/ip_local_port_range\`), dải cổng tạm thời chỉ kéo dài từ **\`32768\` đến \`60999\`**, tức là chỉ có tổng cộng **\`60999 - 32768 + 1 = 28,232 cổng\`**!
2. **Cơ chế Bảo vệ Toàn vẹn Mạng của Trạng thái \`TIME_WAIT\` (\`2 × MSL = 60 giây\`):**
   Khi một request hoàn tất và ứng dụng **không tái sử dụng kết nối (\`Connection: close\`)**, bên chủ động gửi gói \`FIN\` đóng kết nối trước (\`Active Closer\`) sẽ buộc phải giữ cổng socket đó trong trạng thái **\`TIME_WAIT\`** suốt khoảng thời gian bằng **2 lần Tuổi thọ Tối đa của Phân đoạn (\`2 × MSL — Maximum Segment Lifetime\`, trên Linux cố định là \`60 giây\`)**.
   - **Tại sao nhân hệ điều hành không giải phóng cổng ngay lập tức?** Trạng thái \`TIME_WAIT\` giải quyết 2 bài toán sống còn: **(a)** Đảm bảo nếu gói \`ACK\` cuối cùng trong quy trình đóng 4 bước (\`4-Way Teardown\`) bị rớt trên mạng, khi phía bên kia gửi lại gói \`FIN\`, máy chủ vẫn còn thông tin socket để trả lời lại \`ACK\`; và **(b)** Đảm bảo mọi gói tin bị trễ hoặc nhân bản trên các bộ định tuyến Internet (\`Wandering Duplicate Packets\`) của kết nối cũ có đủ 60 giây để tự hủy hoàn toàn, tránh việc một kết nối mới vừa mở trùng đúng cặp \`IP:Port\` đó lại nhận nhầm gói dữ liệu rác của phiên giao dịch trước!
   - **Hệ quả định lượng:** Nếu dịch vụ NestJS của bạn thực hiện **\`600 yêu cầu HTTP/giây\`** sang một vi dịch vụ khác mà **không bật \`Keep-Alive\`**, mỗi giây bạn tạo ra \`600\` socket nằm chờ trong \`TIME_WAIT\`. Chỉ sau **\`28,232 / 600 ≈ 47 giây\`**, toàn bộ 28,232 cổng tạm thời bị khóa sạch sẽ và mọi request tiếp theo đều thất bại tức thì với mã lỗi \`EADDRNOTAVAIL\`!

Hãy đối chiếu hai thiết kế dịch vụ gọi HTTP ngoại vi trong NestJS dưới đây để thấy sự khác biệt giữa phản mẫu rò rỉ cổng \`TIME_WAIT\` và kiến trúc Bể kết nối \`Keep-Alive\` chuẩn Production:

\`\`\`typescript
// File: src/modules/network/upstream-http-pool.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Khởi tạo Agent không bật Keep-Alive hoặc đóng kết nối sau mỗi lần gọi
import { Injectable } from '@nestjs/common';
import * as https from 'node:https';

@Injectable()
export class EphemeralExhaustionBrokenService {
  // LỖI HỆ THỐNG: keepAlive: false khiến mỗi HTTP request phải thực hiện lại từ đầu:
  // -> Tốn 1 RTT (TCP 3-Way Handshake) + 1 RTT (TLS 1.3 ECDHE Handshake)
  // -> Sau khi xong request, socket bị đóng chủ động và rơi vào trạng thái TIME_WAIT suốt 60 giây!
  // -> Với lưu lượng > 470 req/s tới cùng 1 host, máy chủ cạn sạch 28,232 cổng tạm thời (EADDRNOTAVAIL)!
  private readonly transientAgent = new https.Agent({
    keepAlive: false,
  });

  getAgentForRequest(): https.Agent {
    return this.transientAgent;
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION KEEP-ALIVE POOL): Duy trì bể kết nối ấm có giới hạn và bật TCP_NODELAY
@Injectable()
export class KeepAlivePoolSafeService {
  // GIẢI PHÁP CHUẨN: Tái sử dụng một tập hợp cố định các kết nối TCP/TLS đã bắt tay sẵn:
  // -> keepAlive: true giữ socket ở trạng thái ESTABLISHED để phục vụ hàng vạn request liên tiếp (0 RTT)
  // -> maxSockets: 128 giới hạn số kết nối đồng thời tối đa tới mỗi host, triệt tiêu hoàn toàn lỗi TIME_WAIT
  // -> noDelay: true kích hoạt cờ TCP_NODELAY (tắt thuật toán Nagle) để gửi gói tin nhỏ đi ngay lập tức!
  private readonly persistentAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 128,
    maxFreeSockets: 32,
    scheduling: 'lifo',
    timeout: 15000,
  });

  getPersistentAgent(): https.Agent {
    return this.persistentAgent;
  }
}
\`\`\`

Để quan sát rõ sự chênh lệch về thời gian phản hồi trên đường truyền xuyên lục địa (giả sử \`RTT = 50 ms\`, thời gian xử lý tại Server là \`10 ms\`), hãy theo dõi bảng truy vết thực thi theo từng mốc mili-giây khi gửi 2 yêu cầu liên tiếp tới cùng một máy chủ đích:

| Mốc thời gian | Luồng / Mô hình Kết nối | Thao tác Thực thi tại Tầng Mạng & Nhân OS | Trạng thái Socket trong Nhân Linux | Độ trễ Tích lũy của Request |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **Request #1** (Khởi tạo kết nối mới) | Client cấp phát cổng tạm thời \`49152\`, gửi gói \`TCP SYN\` tới Server | \`SYN_SENT\` (Đang chờ bắt tay TCP) | \`0 ms\` (Chưa gửi được dữ liệu) |
| **\`t = 50 ms\`** | **Request #1** (Hoàn tất TCP, bắt đầu TLS) | Nhận \`SYN-ACK\` sau \`1 RTT\`; gửi \`ACK\` kèm luôn gói \`TLS 1.3 ClientHello + KeyShare\` | \`ESTABLISHED\` (Đang thương lượng khóa TLS) | \`50 ms\` (Đã tốn 1 RTT cho TCP) |
| **\`t = 100 ms\`** | **Request #1** (Hoàn tất TLS, gửi HTTP) | Nhận \`ServerHello + Finished\` sau \`1 RTT\` nữa; gửi bản tin \`HTTP GET /orders\` đã mã hóa | \`ESTABLISHED\` (Kênh TLS sẵn sàng) | \`100 ms\` (Đã tốn 2 RTT bắt tay) |
| **\`t = 160 ms\`** | **Request #1** (Nhận phản hồi HTTP) | Server xử lý mất \`10 ms\` + truyền về mất \`50 ms (1 RTT)\`; Client nhận đủ \`200 OK\` | Nếu đóng: Rơi vào **\`TIME_WAIT (60s)\`**; Nếu Keep-Alive: Đưa về **\`Idle Pool\`** | Tổng Request #1 = **\`160 ms\`** |
| **\`t = 165 ms\`** | **Request #2 (Nếu CÓ Keep-Alive)** | Lấy ngay socket \`49152\` đang ấm từ \`Idle Pool\`; **bỏ qua toàn bộ TCP & TLS Handshake**, bắn thẳng \`HTTP GET\`! | \`ESTABLISHED\` (Tái sử dụng 100%) | Bắt đầu gửi dữ liệu ngay tại \`0 ms\` chờ! |
| **\`t = 225 ms\`** | **Request #2 (Hoàn tất với Keep-Alive)** | Chỉ tốn đúng \`1 RTT (50 ms)\` truyền mạng + \`10 ms\` Server xử lý (So với \`160 ms\` nếu mở kết nối mới!) | Trả lại socket \`49152\` vào \`Idle Pool\` | Tổng Request #2 = **\`60 ms\` (Nhanh gấp 2.67 lần!)** |

### 1.4 Định lượng Độ trễ Bắt tay Mạng (Handshake Latency) và Công thức Tính Ngưỡng Cạn kiệt Cổng TCP

Kỹ sư hệ thống có thể tính toán chính xác tổng thời gian hoàn tất một yêu cầu HTTP và ngưỡng chịu tải tối đa trước khi cạn kiệt cổng tạm thời bằng hệ công thức định lượng sau:

\`\`\`
Tổng thời gian phản hồi lần đầu (T_total_cold_ms) = (N_Handshake_RTTs × RTT_ms) + RTT_ms + T_server_processing_ms + (Payload_KB / Bandwidth_KB_per_ms)
Tổng thời gian phản hồi khi tái sử dụng Keep-Alive (T_total_warm_ms) = RTT_ms + T_server_processing_ms + (Payload_KB / Bandwidth_KB_per_ms)
Ngưỡng RPS tối đa nếu KHÔNG dùng Keep-Alive (Max_Safe_RPS) = (Port_Range_End - Port_Range_Start + 1) / TIME_WAIT_Duration_Seconds
Ví dụ định lượng: Với dải cổng Linux mặc định (32768 -> 60999 = 28,232 cổng) và TIME_WAIT = 60 giây -> Max_Safe_RPS = 28232 / 60 = 470.53 requests/giây!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc quản trị Socket và Bể kết nối):**
> 1. **Bắt buộc dùng \`Keep-Alive Connection Pool\` theo chiến lược \`LIFO\`:** Mọi HTTP Client trong Backend (Axios, Fetch/Undici, gRPC) đều phải bật \`keepAlive: true\` với chiến lược cấp phát **\`LIFO (Last-In, First-Out)\`** để ưu tiên tái sử dụng các socket vừa mới dùng xong (còn ấm trong bảng NAT/Firewall), giúp các socket ít dùng tự động hết hạn và đóng lại êm ái khi lưu lượng giảm.
> 2. **Tắt Thuật toán Nagle (\`TCP_NODELAY\`) cho API Độ trễ Thấp:** Luôn kích hoạt \`noDelay: true\` (\`socket.setNoDelay(true)\`) trên các kết nối API/RPC để ngăn nhân hệ điều hành giữ gói tin nhỏ lại trong bộ đệm chờ gom đủ kích thước \`MSS (1,460 bytes)\`, loại bỏ triệt để độ trễ ẩn \`40 ms – 200 ms\` do xung đột giữa Nagle và \`Delayed ACK\`.

---

# 2. CƠ CHẾ KIỂM SOÁT LUỒNG TCP (SLIDING WINDOW), NGHỊCH LÝ HTTP/2 MULTIPLEXING VÀ NGHẼN TẮC HEAD-OF-LINE BLOCKING

### 2.1 Cơ chế Kiểm soát Luồng Cửa sổ Trượt (Receive Window - rwnd), Kiểm soát Tắc nghẽn (cwnd) và Thuật toán Nagle

Sau khi kết nối TCP đã ở trạng thái \`ESTABLISHED\`, tốc độ truyền dữ liệu thực tế không phải lúc nào cũng đạt mức tối đa của đường cáp quang, mà bị chi phối chặt chẽ bởi 2 cửa sổ điều tiết độc lập bên trong nhân hệ điều hành:

1. **Cửa sổ Kiểm soát Luồng phía Nhận (\`Flow Control — Receive Window / rwnd\`):**
   Mỗi socket trên máy nhận có một vùng nhớ đệm hữu hạn trong RAM của Kernel gọi là **\`Socket Receive Buffer\` (\`SO_RCVBUF\`)**. Khi ứng dụng Node.js đọc dữ liệu chậm hơn tốc độ card mạng nhận gói tin, vùng đệm này sẽ đầy dần lên.
   - Trong mỗi gói tin \`ACK\` gửi trả về bên gửi, máy nhận luôn đính kèm giá trị **\`rwnd\`** báo cáo chính xác số byte còn trống trong \`Receive Buffer\`.
   - Nếu ứng dụng bị treo hoặc chưa kịp đọc khiến \`rwnd = 0\` (**\`TCP Zero Window\`**), bên gửi bắt buộc phải dừng truyền dữ liệu ngay lập tức và chỉ định kỳ gửi các gói thăm dò nhỏ (**\`Zero Window Probe\`**) cho tới khi ứng dụng đọc bớt dữ liệu và mở lại cửa sổ \`rwnd > 0\`.
2. **Cửa sổ Kiểm soát Tắc nghẽn Mạng (\`Congestion Control — Congestion Window / cwnd\`):**
   Ngay cả khi máy nhận còn trống rất nhiều RAM (\`rwnd\` lớn), các bộ định tuyến (\`Routers / Switches\`) nằm giữa đường truyền Internet vẫn có thể bị quá tải. Vì vậy, bên gửi tự duy trì thêm một biến trạng thái thứ hai là **\`cwnd\`**:
   - Lượng dữ liệu tối đa được phép bay trên mạng mà chưa cần chờ \`ACK\` tại mọi thời điểm bị chặn bởi công thức: **\`Max_In_Flight_Bytes = min(rwnd, cwnd)\`**.
   - Khi mới mở kết nối, \`cwnd\` khởi đầu ở mức nhỏ (thường là \`10 × MSS ≈ 14.6 KB\` — giai đoạn **\`TCP Slow Start\`**) và tăng gấp đôi sau mỗi \`RTT\` không mất gói. Nhưng với các thuật toán dựa trên mất gói như **\`TCP CUBIC\`**, chỉ cần phát hiện rớt gói tin, \`cwnd\` sẽ lập tức bị cắt giảm mạnh (\`30% – 50%\`), làm sụt giảm đột ngột băng thông của kết nối đó!

Bảng dưới đây tổng hợp 5 cơ chế điều khiển cốt lõi của tầng TCP và ảnh hưởng trực tiếp của chúng tới hiệu năng Backend:

| Cơ chế / Tham số Kernel TCP | Tầng Thực thi & Lệnh Cấu hình | Vai trò Kỹ thuật Chính xác | Triệu chứng Khi Cấu hình Sai trên Production | Khuyến nghị Tinh chỉnh Chuẩn Kiến trúc |
| :--- | :--- | :--- | :--- | :--- |
| **1. \`Receive Window (rwnd)\`** | Tầng Receiver Kernel (\`net.ipv4.tcp_rmem\`) | Ngăn bên gửi làm tràn bộ nhớ đệm \`Socket Receive Buffer\` của bên nhận | Xuất hiện cờ \`[TCP ZeroWindow]\` trên Wireshark khi luồng chính Node.js bị nghẽn CPU không kịp đọc socket | Bật \`tcp_window_scaling = 1\` và giải phóng luồng chính V8 để tiêu thụ stream kịp thời |
| **2. \`Congestion Window (cwnd)\`** | Tầng Sender Kernel (\`TCP CUBIC\` / \`TCP BBR\`) | Thăm dò băng thông đường truyền và giảm tốc khi phát hiện nghẽn router | Với \`CUBIC\`, đường truyền xuyên quốc gia có tỷ lệ rớt gói \`1%\` bị tụt băng thông tới \`80%\` | Chuyển thuật toán kiểm soát tắc nghẽn của Linux sang **\`TCP BBR\`** (dựa trên băng thông và RTT thực tế) |
| **3. \`Nagle's Algorithm\` vs \`TCP_NODELAY\`** | Tầng Sender Socket (\`socket.setNoDelay(true)\`) | Gom các gói tin nhỏ (\`< MSS 1460B\`) lại chờ nhận \`ACK\` của gói trước mới gửi tiếp | Độ trễ API JSON nhỏ bị vọt lên thêm **\`40 ms – 200 ms\`** do chờ nhau với cơ chế \`Delayed ACK\` của bên nhận | **Luôn bật \`TCP_NODELAY\`** cho mọi kết nối HTTP, gRPC, Redis và Database |
| **4. \`SYN Queue\` & \`Accept Queue\`** | Tầng Listener Kernel (\`somaxconn\`, \`tcp_max_syn_backlog\`) | Đệm các kết nối đang bắt tay dở dang (\`SYN_RCVD\`) và đã bắt tay xong chờ \`accept()\` | Client bị lỗi \`Connection Reset\` hoặc \`SYN Timeout\` dù CPU máy chủ mới dùng \`20%\` | Tăng \`net.core.somaxconn = 65535\` và \`tcp_max_syn_backlog = 65535\` trên máy chủ cổng vào |
| **5. \`TCP Keepalive Probes\`** | Tầng OS Kernel (\`net.ipv4.tcp_keepalive_time\`) | Gửi gói tin rỗng thăm dò xem kết nối nhàn rỗi lâu có bị tường lửa cắt ngầm hay chưa | Kết nối TCP nhàn rỗi quá \`350 giây\` bị AWS NAT Gateway xóa trạng thái dẫn tới treo gói tin (\`Blackhole\`) | Đặt \`keepAliveInitialDelay\` của ứng dụng ở mức \`30s – 60s\` (nhỏ hơn ngưỡng cắt của NAT/Firewall) |

### 2.2 Sự tiến hóa từ HTTP/1.1 sang HTTP/2 Binary Framing, Nén tiêu đề HPACK và Lỗ hổng Bảo mật CRIME

Trong suốt hơn một thập kỷ, **\`HTTP/1.1 (RFC 2616 / RFC 9112)\`** bộc lộ hai hạn chế kiến trúc không thể khắc phục ở tầng ứng dụng:
1. **Nghẽn Đầu Hàng Cấp Ứng dụng (\`Application-Layer Head-of-Line Blocking\`):** Do \`HTTP/1.1\` phân tích cú pháp dựa trên văn bản thuần túy ngăn cách bởi ký tự xuống dòng (\`CRLF \\r\\n\`) và không có mã định danh luồng, trên một kết nối TCP tại một thời điểm chỉ có thể gửi **1 request và phải chờ nhận xong toàn bộ response đó** rồi mới được gửi request tiếp theo. Để tải 60 tài nguyên đồng thời, trình duyệt buộc phải lách luật bằng cách mở song song **6 kết nối TCP** tới mỗi tên miền (nhân gấp 6 lần chi phí bắt tay và bộ nhớ đệm!).
2. **Sự phình đại Tiêu đề Lặp lại (\`Redundant Header Bloat\`):** Mỗi request \`HTTP/1.1\` đều gửi đi gửi lại hàng trăm byte tiêu đề văn bản giống hệt nhau (\`User-Agent\`, \`Accept\`, \`Cookie\`, \`Authorization\`) mà không hề được nén.

Ra đời năm 2015, **\`HTTP/2 (RFC 7540 / RFC 9113)\`** giải quyết cả hai vấn đề trên bằng hai cải tiến cốt lõi:
- **Tầng Đóng khung Nhị phân (\`Binary Framing Layer\`):** \`HTTP/2\` chia nhỏ mọi bản tin HTTP thành các **Khung nhị phân (\`Frames\` — như \`HEADERS frame\`, \`DATA frame\`, \`SETTINGS frame\`, \`WINDOW_UPDATE frame\`)**. Mỗi khung đều mang một số nguyên 31-bit gọi là **\`Stream Identifier (Stream ID)\`**. Nhờ đó, hàng trăm request và response (\`Streams\`) có thể được cắt nhỏ, trộn lẫn các khung nhị phân đan xen nhau trên **duy nhất 1 kết nối TCP** rồi được lắp ghép lại chính xác ở đầu bên kia (**\`Multiplexing\`**)!
- **Thuật toán Nén Tiêu đề \`HPACK\` Chống Tấn công \`CRIME\`:** Tại sao \`HTTP/2\` không dùng thuật toán nén \`Gzip / Deflate (LZ77)\` thông thường để nén HTTP Header? Vào năm 2012, các nhà nghiên cứu bảo mật đã phát hiện ra lỗ hổng chí mạng **\`CRIME Attack\`** trên giao thức thử nghiệm \`SPDY\`: vì \`Deflate\` nén bằng cách thay thế các chuỗi ký tự trùng lặp bằng con trỏ tham chiếu độ dài, kẻ tấn công có thể tiêm các đoạn văn bản thử nghiệm (\`Cookie: session=a...\`, \`session=b...\`) vào cùng luồng nén và **quan sát sự thay đổi kích thước gói tin đã mã hóa TLS trên mạng**. Nếu kích thước gói tin co nhỏ lại 1 byte, kẻ tấn công biết chắc ký tự dự đoán đã trùng khớp với \`Cookie\` bí mật! Để triệt tiêu hoàn toàn kênh rò rỉ này (\`Compression Oracle Side-Channel\`), \`HTTP/2\` thiết kế chuẩn **\`HPACK (RFC 7541)\`** không dùng LZ77 mà sử dụng **Bảng Chỉ mục Tĩnh (61 tiêu đề phổ biến)** kết hợp **Bảng Chỉ mục Động (\`Dynamic Lookup Table\`)** và mã hóa ký tự cố định **\`Static Huffman Coding\`**, giúp giảm \`85%\` dung lượng Header mà vẫn an toàn tuyệt đối trước tấn công \`CRIME\`.

### 2.3 Nghịch lý Ghép kênh trên 1 Kết nối TCP và Cơ chế Đóng băng Toàn cục do TCP Head-of-Line (HoL) Blocking

Mặc dù \`HTTP/2\` đã xóa bỏ hoàn toàn hiện tượng nghẽn đầu hàng ở tầng ứng dụng, việc gom toàn bộ 100 luồng request vào chung **1 kết nối TCP duy nhất** lại vô tình tạo ra một điểm nghẽn chí mạng ở tầng thấp hơn khi mạng có hiện tượng rớt gói tin (**\`Packet Loss\`**), được gọi là **\`TCP-Level Head-of-Line (HoL) Blocking\`**:

1. **Sự mù mờ Ngữ nghĩa giữa Tầng Nhân TCP và Tầng Ứng dụng HTTP/2:**
   Nhân hệ điều hành Linux (nơi quản lý giao thức TCP) **hoàn toàn không biết gì về sự tồn tại của các \`HTTP/2 Streams\` bên trong gói tin**. Đối với nhân TCP, toàn bộ dữ liệu chảy qua socket chỉ là một dải byte duy nhất được đánh số thứ tự tăng dần nghiêm ngặt (\`Sequence Number từ byte 1 đến byte N\`).
2. **Kịch bản Đóng băng Toàn bộ Kết nối khi Rớt 1 Gói tin:**
   Giả sử trên một kết nối \`HTTP/2\` đang chạy đồng thời 3 luồng: \`Stream #1\` (tải ảnh sản phẩm, nằm ở gói TCP \`Seq = 100\`), \`Stream #3\` (lấy thông tin giỏ hàng JSON, nằm ở gói TCP \`Seq = 101\`), và \`Stream #5\` (kiểm tra trạng thái thanh toán, nằm ở gói TCP \`Seq = 102\`).
   - Trên đường truyền Wifi hoặc 4G, gói tin \`Seq = 100\` (thuộc \`Stream #1\`) chẳng may bị rớt, trong khi hai gói \`Seq = 101\` (\`Stream #3\`) và \`Seq = 102\` (\`Stream #5\`) vẫn đến máy nhận nguyên vẹn và đúng hạn!
   - Mặc dù dữ liệu của \`Stream #3\` và \`Stream #5\` đã nằm sẵn trong RAM của máy nhận, nhưng vì quy tắc bất biến của TCP là **không bao giờ được phép bàn giao các byte phía sau (\`Seq 101, 102\`) lên cho ứng dụng Node.js khi lỗ hổng ở phía trước (\`Seq 100\`) chưa được lấp đầy**, nhân hệ điều hành buộc phải giam giữ toàn bộ gói \`101\` và \`102\` trong hàng đợi \`Out-of-Order Queue\`!
   - Toàn bộ \`Stream #3\`, \`Stream #5\` và 98 luồng vô tội khác trên kết nối \`HTTP/2\` đó bị **đóng băng hoàn toàn** trong suốt \`1 – 2 RTT\` để chờ gói \`Seq = 100\` được phát hiện mất và truyền lại (\`TCP Retransmission\`).
3. **Định lý Mathias và Ngưỡng Đảo chiều Hiệu năng (\`HTTP/2\` Chậm hơn \`HTTP/1.1\` khi Mất gói > 1.5%):**
   Theo phương trình thông lượng vĩ mô của **Mathis, Semke, Mahdavi & Ott**, thông lượng tối đa của một kết nối TCP tỷ lệ nghịch với căn bậc hai của xác suất mất gói ($1 / \\sqrt{p}$). Khi \`HTTP/1.1\` mở 6 kết nối TCP song song, nếu 1 kết nối bị rớt gói và giảm một nửa cửa sổ \`cwnd\`, 5 kết nối còn lại vẫn chạy toàn tốc độ. Ngược lại, khi \`HTTP/2\` dồn tất cả trứng vào **1 giỏ TCP duy nhất**, mỗi lần rớt gói sẽ làm sụt giảm cửa sổ \`cwnd\` của toàn bộ 100 luồng cùng lúc!

\`\`\`
Thông lượng tối đa của 1 kết nối TCP theo Công thức Mathias (Throughput_Bps) = (MSS_Bytes / RTT_Seconds) × (1 / sqrt(Packet_Loss_Rate))
Độ trễ phạt do TCP HoL Blocking khi rớt gói (HoL_Penalty_Ms) = Affected_Streams_Count × Retransmission_RTT_Ms
Ví dụ định lượng: Với MSS = 1,460 bytes, RTT = 0.05s (50ms) và tỷ lệ rớt gói p = 0.01 (1% -> sqrt(p) = 0.1):
-> Thông lượng trần của 1 kết nối HTTP/2 bị kìm hãm ở mức: (1460 / 0.05) × (1 / 0.1) = 292,000 Bytes/s (~285.16 KB/s), bất kể băng thông cáp quang rộng 1 Gbps!
\`\`\`

> **Tổng kết học thuật Phần 2 (Hai quy tắc đánh giá hiệu năng \`HTTP/2\`):**
> 1. **\`HTTP/2\` chỉ tối ưu trên mạng ổn định hoặc khi có \`Connection Coalescing\` hợp lý:** Trên mạng nội bộ Data Center (\`Packet Loss < 0.001%\`), \`HTTP/2 Multiplexing\` phát huy hiệu suất tuyệt đối. Tuy nhiên, nếu dùng một \`ClientHttp2Session\` duy nhất để đẩy hàng chục nghìn request/giây trong Node.js, bạn sẽ chạm trần giới hạn cửa sổ \`cwnd\` và bộ đệm của 1 socket đơn lẻ; trong trường hợp tải cực lớn, kỹ sư cần phân bổ tải qua một bể nhỏ gồm \`2 – 4 phiên HTTP/2\` (\`Sharded HTTP/2 Session Pool\`).
> 2. **Nguyên nhân cốt lõi của \`TCP HoL Blocking\` nằm ở tầng Nhân OS:** Không thể sửa lỗi \`TCP HoL Blocking\` bằng mã nguồn ứng dụng nếu vẫn chạy trên TCP, bởi nhân hệ điều hành giam giữ gói tin trước cả khi sự kiện \`epoll\` báo cho Node.js biết có dữ liệu đến.

---

# 3. KIẾN TRÚC GIAO THỨC HTTP/3 TRÊN NỀN TẢNG QUIC (UDP), DI TRÚ KẾT NỐI VÀ ĐIỀU PHỐI MULTIPLEXING TRONG NESTJS

### 3.1 Giải phẫu Kiến trúc QUIC trên nền UDP: Độc lập Luồng (Per-Stream Flow Control) và Tích hợp TLS 1.3

Để giải quyết triệt để bài toán \`TCP HoL Blocking\` đã tồn tại suốt 40 năm, tổ chức IETF đã chuẩn hóa giao thức **\`QUIC (RFC 9000)\`** làm tầng giao vận mới cho **\`HTTP/3 (RFC 9114)\`**. Tại sao các kỹ sư IETF và Google không nâng cấp thẳng giao thức TCP để hỗ trợ đa luồng độc lập, mà lại phải vứt bỏ TCP để xây dựng \`QUIC\` trên nền tảng **\`UDP (User Datagram Protocol)\`**?

1. **Hiện tượng Hóa thạch Thiết bị Mạng Trung gian (\`Protocol Ossification by Middleboxes\`):**
   Giao thức TCP được cài đặt cứng bên trong nhân hệ điều hành (\`OS Kernel\`) của hàng tỷ thiết bị và bị kiểm tra sâu bởi hàng triệu tường lửa, bộ cân bằng tải, thiết bị NAT trên toàn cầu (\`Middleboxes\`). Bất kỳ gói tin TCP nào có định dạng Header lạ hoặc thay đổi hành vi đánh số \`Sequence Number\` đều bị các tường lửa doanh nghiệp và nhà mạng viễn thông coi là gói tin dị dạng và **chặn bỏ ngay lập tức**.
   - Ngược lại, **\`UDP\`** chỉ là một lớp vỏ bọc mỏng tối giản (Header đúng \`8 bytes\`: \`Source Port\`, \`Dest Port\`, \`Length\`, \`Checksum\`) không hề có trạng thái bắt tay hay thứ tự byte ở tầng nhân.
   - Bằng cách đóng gói toàn bộ logic kiểm soát luồng, truyền lại gói tin mất và ghép kênh của \`QUIC\` **bên trong phần tải trọng đã được mã hóa hoàn toàn của gói tin UDP ở không gian người dùng (\`User Space\`)**, \`HTTP/3\` có thể đi xuyên qua mọi thiết bị mạng trung gian hiện có mà không bị can thiệp hay làm hỏng!
2. **Triệt tiêu Hoàn toàn \`HoL Blocking\` nhờ Kiểm soát Thứ tự Độc lập theo Từng Luồng (\`Per-Stream Sequencing\`):**
   Trong \`QUIC\`, đơn vị truyền tải trên đường dây là các **Gói tin UDP độc lập (\`UDP Datagrams\`)** chứa một hoặc nhiều \`QUIC Frames\`.
   - Mỗi \`Stream\` trong \`HTTP/3\` có bộ đếm vị trí byte (\`Stream Offset\`) và cửa sổ kiểm soát luồng hoàn toàn tách biệt nhau.
   - Khi gói tin UDP mang dữ liệu của \`Stream #1\` bị rớt trên mạng, thư viện \`QUIC\` ở đầu nhận chỉ việc tạm dừng duy nhất \`Stream #1\` để chờ gói truyền lại, trong khi các gói tin UDP tiếp theo mang dữ liệu của \`Stream #3\` và \`Stream #5\` vẫn được **giải mã và bàn giao ngay lập tức lên cho tầng ứng dụng xử lý mà không phải chờ đợi bất kỳ mili-giây nào**!
   - Đồng thời, vì các khung tiêu đề có thể đến lệch thứ tự giữa các luồng, \`HTTP/3\` nâng cấp thuật toán nén từ \`HPACK\` lên **\`QPACK (RFC 9204)\`** để hỗ trợ giải nén tiêu đề không theo thứ tự (\`Out-of-Order Header Decompression\`) mà không gây nghẽn chéo.

### 3.2 Cơ chế Định danh Kết nối \`Connection ID (CID)\` và Di trú Mạng Không Gián đoạn (\`Connection Migration\`)

Một ưu thế vượt trội khác của \`HTTP/3 QUIC\` đối với các ứng dụng di động (Mobile Apps, thiết bị IoT, xe tự hành) là khả năng **Di trú Kết nối Không Đứt quãng (\`Seamless Connection Migration\`)**:

1. **Sự sụp đổ của Kết nối TCP khi Chuyển mạng (\`Wifi\` $\rightarrow$ \`4G/5G\`):**
   Khi người dùng đang thực hiện cuộc gọi video hoặc tải tệp lớn và bước ra khỏi tòa nhà, điện thoại chuyển từ mạng \`Wifi\` (IP \`113.161.x.x\`) sang mạng di động \`5G\` (IP \`27.68.y.y\`). Vì TCP định danh kết nối bằng bộ tứ \`(Src IP, Src Port, Dst IP, Dst Port)\`, ngay khi địa chỉ \`Src IP\` thay đổi, kết nối TCP cũ lập tức bị vô hiệu hóa hoàn toàn! Ứng dụng buộc phải hủy các request đang chạy, thực hiện lại từ đầu quy trình bắt tay \`TCP + TLS\` trên địa chỉ IP mới.
2. **Định danh Bất biến bằng \`Connection ID (CID)\` trong QUIC:**
   Giao thức \`QUIC\` tách rời hoàn toàn định danh kết nối khỏi địa chỉ IP và Port vật lý bằng cách gắn vào Header của mỗi gói tin một mã định danh ngẫu nhiên dài tới \`64-bit\` (hoặc \`160-bit\`) gọi là **\`Destination Connection ID (CID)\`**.
   - Khi điện thoại đổi từ \`Wifi\` sang \`5G\` làm thay đổi cả \`Source IP\` lẫn \`Source Port\`, các gói tin UDP gửi đi vẫn mang đúng mã **\`CID\`** cũ và được chứng thực bằng khóa mật mã \`TLS 1.3\` của phiên hiện tại.
   - Máy chủ Backend nhận diện ngay đây vẫn là phiên làm việc hợp lệ, thực hiện nhanh một bước xác thực đường dẫn mới (**\`Path Validation Challenge\`** để chống giả mạo IP) và tiếp tục truyền dữ liệu liền mạch với **\`0 ms\` gián đoạn**!

Trong hạ tầng Backend doanh nghiệp hiện đại, lưu lượng \`HTTP/3 (QUIC/UDP)\` từ người dùng cuối thường được chấm dứt tại lớp Cân bằng tải biên (**Edge Reverse Proxy / API Gateway** như Cloudflare, Nginx 1.25+, Envoy) và được chuyển tiếp vào cụm vi dịch vụ NestJS bên trong mạng nội bộ qua đường ống **\`HTTP/2 Multiplexing\`** hoặc **\`gRPC\`**. Đoạn mã dưới đây minh họa cách cấu hình máy chủ/máy khách \`HTTP/2\` trong NestJS đạt chuẩn hiệu năng cao và chống tấn công cạn kiệt tài nguyên (**\`HTTP/2 Rapid Reset — CVE-2023-44487\`**):

\`\`\`typescript
// File: src/modules/network/resilient-http2-session.service.ts
// Thiết lập phiên HTTP/2 Multiplexing nội bộ có kiểm soát MaxConcurrentStreams và TCP_NODELAY
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as http2 from 'node:http2';

export interface StreamHealthMetrics {
  readonly activeStreams: number;
  readonly maxAllowedStreams: number;
  readonly sessionSaturationRatio: number;
  readonly isHealthy: boolean;
}

@Injectable()
export class ResilientHttp2SessionService implements OnModuleDestroy {
  private session: http2.ClientHttp2Session | null = null;
  private activeStreams = 0;
  private readonly maxConcurrentStreams = 100;

  connectToUpstream(authorityUrl: string): http2.ClientHttp2Session {
    if (this.session && !this.session.closed && !this.session.destroyed) {
      return this.session;
    }

    // Khởi tạo phiên HTTP/2 với giới hạn nghiêm ngặt số luồng đồng thời trên 1 kết nối TCP
    // nhằm tránh làm tràn cửa sổ Flow Control và bảo vệ bộ nhớ đệm của cả hai đầu mút
    const clientSession = http2.connect(authorityUrl, {
      settings: {
        maxConcurrentStreams: this.maxConcurrentStreams,
        initialWindowSize: 65535,
        enablePush: false,
      },
    });

    clientSession.socket.setNoDelay(true);
    clientSession.socket.setKeepAlive(true, 30000);

    clientSession.on('error', () => {
      this.session = null;
      this.activeStreams = 0;
    });

    this.session = clientSession;
    return clientSession;
  }

  getHealthSnapshot(): StreamHealthMetrics {
    const ratio = Math.round((this.activeStreams / this.maxConcurrentStreams) * 100) / 100;
    return {
      activeStreams: this.activeStreams,
      maxAllowedStreams: this.maxConcurrentStreams,
      sessionSaturationRatio: ratio,
      isHealthy: Boolean(this.session && !this.session.closed && ratio < 0.9),
    };
  }

  onModuleDestroy(): void {
    if (this.session && !this.session.closed) {
      this.session.close();
      this.session = null;
    }
  }
}
\`\`\`

### 3.3 Phương pháp Chẩn đoán Điểm nghẽn Tầng Mạng trên Môi trường Production

Khi dịch vụ Backend xuất hiện độ trễ mạng bất thường hoặc tỷ lệ lỗi kết nối tăng cao, kỹ sư cần tra cứu bảng chẩn đoán cấp nhân hệ điều hành dưới đây để khoanh vùng chính xác nguyên nhân gốc rễ:

| Triệu chứng Quan sát được | Lệnh / Công cụ Chẩn đoán trên Linux | Chỉ số Báo động Đỏ (\`Red Flag Metric\`) | Nguyên nhân Gốc rễ ở Tầng Giao vận | Giải pháp Khắc phục Triệt để |
| :--- | :--- | :--- | :--- | :--- |
| **Lỗi \`connect EADDRNOTAVAIL\` khi gọi API sang dịch vụ khác** | \`ss -tan state time-wait \\| wc -l\` | Số lượng socket ở trạng thái \`TIME-WAIT\` tiệm cận **\`28,000\`** | Tạo mới kết nối TCP trên mỗi request mà không dùng bể tái sử dụng \`Keep-Alive Pool\` | Bật \`keepAlive: true\` trong \`http.Agent / Undici\`; kích hoạt \`net.ipv4.tcp_tw_reuse = 1\` |
| **Độ trễ P99 tăng vọt đúng bội số của \`40 ms\` hoặc \`200 ms\`** | \`strace -T -e trace=network\` hoặc bắt gói \`tcpdump\` | Gói tin phản hồi nhỏ bị giữ lại chờ gói \`ACK\` từ phía bên kia mới được đẩy đi | Xung đột giữa **Thuật toán Nagle** (bên gửi) và **\`Delayed ACK\`** (bên nhận) | Gọi \`socket.setNoDelay(true)\` (\`TCP_NODELAY\`) trên toàn bộ các socket HTTP/RPC |
| **Client báo lỗi \`Connection Timeout\` dù CPU máy chủ rất thấp** | \`netstat -s \\| grep -i "listen"\` hoặc \`ss -lnt\` | Chỉ số \`SYNs to LISTEN sockets dropped\` hoặc cột \`Recv-Q\` chạm trần \`Send-Q\` | Tràn hàng đợi **\`Accept Queue\` (\`somaxconn\`)** do Event Loop bị chặn hoặc cấu hình trần quá nhỏ | Tăng \`net.core.somaxconn = 65535\`, \`backlog = 4096\` và gỡ bỏ các tác vụ đồng bộ chặn luồng V8 |
| **Tốc độ \`HTTP/2\` qua mạng di động chậm hơn cả \`HTTP/1.1\`** | \`ss -ti\` (Kiểm tra tỷ lệ \`retrans\` và \`cwnd\`) | Tỷ lệ truyền lại gói tin \`retrans > 1.5%\` và cửa sổ \`cwnd\` liên tục bị cắt giảm | **\`TCP Head-of-Line Blocking\`** làm đóng băng toàn bộ các luồng trên kết nối TCP đơn lẻ | Bật **\`HTTP/3 (QUIC/UDP)\`** tại tầng Edge/CDN và chuyển thuật toán Kernel sang **\`TCP BBR\`** |
| **CPU máy chủ \`HTTP/2\` tăng 100% và hết RAM đột ngột** | Giám sát khung \`HEADERS\` và \`RST_STREAM\` trên Reverse Proxy | Hàng vạn khung \`HEADERS\` theo sau ngay lập tức bởi \`RST_STREAM\` trên 1 kết nối | Tấn công từ chối dịch vụ **\`HTTP/2 Rapid Reset (CVE-2023-44487)\`** vượt qua giới hạn luồng | Giới hạn \`maxConcurrentStreams <= 100\` và đặt ngưỡng cắt kết nối khi số lượng \`RST_STREAM\` vượt định mức |

> **Tổng kết học thuật Phần 3 (Quy tắc phối hợp \`HTTP/3\` ở Biên và \`HTTP/2\` ở Nội bộ):**
> Trên kiến trúc Production thực tế, mô hình tối ưu nhất là triển khai **\`HTTP/3 (QUIC/UDP)\` ở chặng nối từ Thiết bị Người dùng tới Edge Load Balancer/CDN** (nơi mạng Wifi/4G/5G chập chờn và hay đổi IP), đồng thời sử dụng **\`HTTP/2 Multiplexing\` hoặc \`gRPC\` trên nền TCP có bật \`TCP_NODELAY\` ở chặng nối giữa các Microservices trong cùng Data Center** (nơi đường truyền cáp quang nội bộ có tỷ lệ mất gói xấp xỉ \`0%\` và TCP được tăng tốc phần cứng trực tiếp trên card mạng \`NIC Checksum/TSO Offloading\`).

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Giao Vận Mạng Từ HTTP/1.1 Đến HTTP/3 QUIC (Network Transport Stack Taxonomy)
\`\`\`diagram
[TOPOLOGY: taxonomy-tree]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG GIAO THỨC ỨNG DỤNG & ĐÓNG KHUNG (APPLICATION & FRAMING LAYER)         │
│    [ HTTP/1.1 (Text + Keep-Alive) ] ◄───► [ HTTP/2 (Binary Frames + HPACK) ] ◄───► [ HTTP/3 (QUIC Frames + QPACK) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Ghép kênh các Stream và Mã hóa Bảo mật Đường truyền
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG MẬT MÃ BẢO MẬT & ĐỊNH DANH KẾT NỐI (SECURITY & SESSION LAYER)         │
│    ├── TLS 1.2 (2-RTT Handshake): Trao đổi khóa tách rời khỏi bắt tay TCP     │
│    ├── TLS 1.3 (1-RTT & 0-RTT): Gộp khóa ECDHE ngay trong gói ClientHello     │
│    └── QUIC Connection ID (CID 64-bit): Giữ nguyên kết nối khi đổi IP Wifi/5G │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Điều khiển Luồng (Flow Control) và Sửa lỗi Mất gói
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG GIAO VẬN HỆ ĐIỀU HÀNH (OS TRANSPORT LAYER: TCP VS QUIC/UDP)           │
│    ├── TCP Stack (Kernel): Bắt tay 3 bước, Thứ tự byte toàn cục, bị HoL Block │
│    ├── QUIC Engine (User Space UDP): Luồng độc lập 100%, miễn nhiễm HoL Block │
│    └── Quản trị Socket: Bể Keep-Alive chống cạn kiệt 28,232 cổng TIME_WAIT    │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Truyền tải Gói tin IP qua Card mạng Vật lý
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 4. TẦNG MẠNG & PHẦN CỨNG CARD MẠNG (NETWORK IP & NIC HARDWARE LAYER)          │
│    ├── SYN Queue & Accept Queue (somaxconn): Hàng đợi bắt tay trong Kernel    │
│    ├── TCP_NODELAY: Vô hiệu hóa thuật toán Nagle để gửi gói nhỏ tức thì       │
│    └── Congestion Control (BBR / CUBIC): Điều tiết cửa sổ cwnd theo băng thông│
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Xử Lý Mất Gói Tin Giữa HTTP/2 (TCP HoL Blocking) và HTTP/3 (QUIC UDP Streams)
\`\`\`diagram
MÔ HÌNH CŨ: HTTP/2 CHẠY TRÊN 1 KẾT NỐI TCP DUY NHẤT KHI MẠNG RỚT GÓI (TCP HOL BLOCKING)
Rớt 1 gói của Stream A ──► [ Kernel TCP giữ lại toàn bộ gói sau ] ──► [ Đóng băng cả 99 Stream khác ] ──► NGHẼN TOÀN CỤC
100 HTTP/2 Streams = Bị khóa cứng đồng loạt chờ truyền lại gói mất (Retransmission), thông lượng tụt dốc theo 1/sqrt(p).

MÔ HÌNH HIỆN ĐẠI: HTTP/3 CHẠY TRÊN NỀN QUIC (UDP) VỚI BỘ ĐIỀU KHIỂN LUỒNG ĐỘC LẬP
Stream A (Rớt gói) ──┐
Stream B (Đủ gói)  ──┼──► [ QUIC kiểm tra thứ tự riêng theo từng Stream ID ] ──► Chỉ riêng Stream A chờ truyền lại
Stream C (Đủ gói)  ──┘                              │
                                                    └──► Stream B & C lên thẳng App ────► 0ms nghẽn chéo (Zero HoL Block)
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Lựa Chọn Giao Thức Giao Vận Cho Kiến Trúc Backend)
\`\`\`diagram
                   CẦN LỰA CHỌN GIAO THỨC GIAO VẬN CHO KÊNH GIAO TIẾP MẠNG NÀO TRONG HỆ THỐNG?
                                                        │
                                                        ▼
                              Môi trường đường truyền vật lý giữa hai đầu mút có đặc tính gì?
                              /                                                             \\
        MẠNG INTERNET CÔNG CỘNG (MOBILE 4G/5G, WIFI CHẬP CHỜN)                 MẠNG NỘI BỘ DATA CENTER (LAN / K8S CLUSTER ỔN ĐỊNH)
                          /                                                                             \\
                         ▼                                                                               ▼
       [ BẬT HTTP/3 QUIC TRÊN UDP TẠI EDGE (TỐI ƯU) ]                           Đặc thù của luồng gọi nội bộ giữa các dịch vụ là gì?
       - Triệt tiêu hoàn toàn TCP Head-of-Line Blocking                         /                                                  \\
       - Hỗ trợ Connection Migration khi đổi IP di động        GỌI RPC ĐỘ TRỄ CỰC THẤP & TẢI CAO                   GỌI REST JSON THÔNG THƯỜNG
       - Cấm dùng 0-RTT cho các request POST không lũy đẳng                   /                                                      \\
                                                                             ▼                                                        ▼
                                                           [ DÙNG GRPC / HTTP/2 MULTIPLEXING (CHUẨN) ]              [ DÙNG HTTP/1.1 KEEP-ALIVE POOL (CHUẨN) ]
                                                           - Ghép kênh nhị phân + Nén tiêu đề HPACK                 - Bắt buộc bật keepAlive: true (LIFO Pool)
                                                           - Giới hạn maxConcurrentStreams <= 100                   - Bật TCP_NODELAY chống trễ Nagle 40ms
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu HTTP/1.1, HTTP/2, HTTP/3 QUIC và gRPC)

| Tiêu Chí So Sánh | \`HTTP/1.1\` (Keep-Alive Pool) | \`HTTP/2\` (Multiplexed TCP) | \`HTTP/3\` (QUIC trên nền UDP) | \`gRPC\` (Protobuf trên nền HTTP/2) |
| :--- | :--- | :--- | :--- | :--- |
| **Tầng Giao vận & Định dạng Khung** | \`TCP\` — Văn bản thuần túy phân cách bởi \`CRLF\` | \`TCP\` — Khung nhị phân (\`Binary Frames\`) có \`Stream ID\` | **\`UDP (QUIC)\`** — Khung nhị phân mã hóa độc lập từng luồng | \`TCP (HTTP/2)\` — Nhị phân **\`Protocol Buffers\`** siêu nhỏ gọn |
| **Chi phí Bắt tay Kết nối Mới** | \`2 RTT\` (\`1 TCP + 1 TLS 1.3\`) trên mỗi socket trong Pool | \`2 RTT\` duy nhất cho 1 kết nối TCP gánh hàng trăm luồng | **\`1 RTT\`** (lần đầu) và **\`0 RTT\`** (khi kết nối lại với vé phiên) | \`2 RTT\` khi khởi tạo kênh truyền (\`Channel\`) dài hạn |
| **Hiện tượng Nghẽn Đầu Hàng (\`HoL\`)** | Bị nghẽn nặng ở **Tầng Ứng dụng** (1 request/socket tại 1 lúc) | Triệt tiêu ở tầng ứng dụng, nhưng bị **Nghẽn ở Tầng TCP** khi rớt gói | **Miễn nhiễm 100%** cả ở tầng ứng dụng lẫn tầng giao vận | Chịu ảnh hưởng của **TCP HoL Blocking** nếu mạng nội bộ bị rớt gói |
| **Khả năng Giữ kết nối khi Đổi IP** | **Không**: Đổi từ Wifi sang 5G làm đứt kết nối ngay lập tức | **Không**: Phụ thuộc cứng vào bộ tứ \`(Src IP, Src Port, Dst IP, Dst Port)\` | **Có (\`Connection Migration\`)**: Định danh bằng \`64-bit Connection ID\` | **Không**: Phải khởi tạo lại Subchannel khi địa chỉ Pod thay đổi |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`Http2MultiplexClientService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Bảo toàn Cổng Tạm thời và Bể Kết nối (\`Ephemeral Port & Keep-Alive Pool Invariant\`):** Mỗi kết nối TCP đóng chủ động đều bị nhân hệ điều hành giữ lại trong trạng thái \`TIME_WAIT\` suốt \`2 × MSL\` (\`60 giây\` trên Linux), trong khi dải cổng tạm thời mặc định chỉ có \`28,232\` cổng. Vì vậy, mọi giao tiếp HTTP/RPC từ Backend ra bên ngoài bắt buộc phải đi qua **Bể Tái sử dụng Kết nối (\`Keep-Alive Pool\`)** có bật cờ **\`TCP_NODELAY\`**, giúp triệt tiêu đồng thời lỗi cạn kiệt cổng \`EADDRNOTAVAIL\` và chi phí \`2 RTT\` bắt tay \`TCP + TLS 1.3\`.
2. **Định đề Bất tương thích giữa Ghép kênh Ứng dụng và Thứ tự Byte TCP (\`TCP Head-of-Line Blocking Invariant\`):** Trong \`HTTP/2\`, dù các luồng (\`Streams\`) hoàn toàn độc lập ở tầng ứng dụng, việc dồn toàn bộ chúng vào chung một kết nối TCP duy nhất khiến chúng bị trói buộc bởi quy tắc bàn giao byte đúng thứ tự nghiêm ngặt của nhân TCP. Khi đường truyền có tỷ lệ mất gói $p > 0$, một gói tin bị rớt của một luồng bất kỳ sẽ làm đóng băng toàn bộ các luồng còn lại trong \`Socket Receive Buffer\` và kéo tụt thông lượng theo hệ số $1 / \\sqrt{p}$.
3. **Định đề Cô lập Luồng Giao vận Không Gian Người dùng của \`QUIC\` (\`QUIC Per-Stream Isolation & CID Invariant\`):** Giao thức \`HTTP/3\` chạy trên \`QUIC (UDP)\` giải quyết triệt để \`TCP HoL Blocking\` bằng cách quản lý thứ tự byte và kiểm soát luồng riêng biệt cho từng \`Stream ID\` bên trong không gian người dùng (\`User Space\`), đồng thời thay thế định danh bộ tứ \`IP:Port\` bằng **\`Connection ID (CID)\`** để cho phép thiết bị di động chuyển đổi mạng (\`Wifi\` $\leftrightarrow$ \`5G\`) mà không làm đứt kết nối đang truyền.
4. **Định đề Ràng buộc An ninh cho Dữ liệu Sớm \`0-RTT\` (\`Zero-RTT Replay Safety Invariant\`):** Cơ chế tái kết nối \`0-RTT\` trong \`TLS 1.3\` và \`HTTP/3 QUIC\` cho phép đính kèm dữ liệu HTTP ngay trong gói tin đầu tiên nhưng không chống được tấn công nghe lén và phát lại gói tin (\`Replay Attack\`). Do đó, máy chủ Backend chỉ được phép chấp nhận dữ liệu \`0-RTT Early Data\` cho các phương thức truy vấn không làm biến đổi trạng thái (\`Safe Methods\` như \`GET\`, \`HEAD\`) hoặc phải áp dụng bộ lọc chống phát lại nguyên tử (\`Single-Use Anti-Replay Nonce/Token\`).
  `,
  realCodeSnippet: `// File: src/modules/network/http2/http2-multiplex-client.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - High-Concurrency HTTP/2 Multiplexing Client
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as http2 from 'node:http2';

export interface MultiplexResponse {
  readonly path: string;
  readonly statusCode: number;
  readonly data: string;
  readonly durationMs: number;
}

/**
 * ADR-0031: Tối ưu hóa giao tiếp Microservices bằng HTTP/2 Multiplexing & TCP_NODELAY:
 * 1. Thay vì tạo hàng trăm kết nối TCP riêng lẻ (gây tốn 2-RTT handshake và tràn 28,232 cổng TIME_WAIT),
 *    dịch vụ duy trì một ClientHttp2Session đã bắt tay sẵn và mở các luồng nhị phân (Streams) song song.
 * 2. Kích hoạt socket.setNoDelay(true) (TCP_NODELAY) để tắt thuật toán Nagle, loại bỏ độ trễ 40ms-200ms.
 * 3. Giới hạn maxConcurrentStreams để bảo vệ cửa sổ Flow Control và chống quá tải bộ nhớ đệm.
 */
@Injectable()
export class Http2MultiplexClientService implements OnModuleDestroy {
  private readonly logger = new Logger(Http2MultiplexClientService.name);
  private activeSession: http2.ClientHttp2Session | null = null;
  private readonly maxConcurrentStreams = 100;

  public async fetchBatchMultiplexed(baseUrl: string, paths: string[]): Promise<MultiplexResponse[]> {
    if (!baseUrl || !Array.isArray(paths) || paths.length === 0) {
      throw new Error('INVALID_HTTP2_REQUEST_PARAMETERS');
    }

    if (paths.length > this.maxConcurrentStreams) {
      throw new Error('MAX_CONCURRENT_STREAMS_EXCEEDED');
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
        req.on('data', (chunk: string) => {
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

        req.on('error', (err: Error) => {
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

    const clientSession = http2.connect(baseUrl, {
      settings: {
        maxConcurrentStreams: this.maxConcurrentStreams,
        enablePush: false,
      },
    });

    clientSession.socket?.setNoDelay(true);
    clientSession.socket?.setKeepAlive(true, 30000);

    clientSession.on('error', (err: Error) => {
      this.logger.error(\`HTTP/2 Session Error: \${err.message}\`);
      this.activeSession = null;
    });

    this.activeSession = clientSession;
    return this.activeSession;
  }

  public onModuleDestroy(): void {
    if (this.activeSession && !this.activeSession.closed) {
      this.activeSession.close();
      this.activeSession = null;
    }
  }
}`,
  quiz: [
    {
      id: 'c3-l1-q1',
      question: 'Hiện tượng TCP Head-of-Line (HoL) Blocking trong giao thức HTTP/2 gây ra hệ quả gì ở tầng nhân hệ điều hành khi đường truyền xuất hiện mất gói tin (Packet Loss)?',
      options: [
        'Trình duyệt tự động hủy bỏ phiên mã hóa TLS 1.3 hiện tại và ép buộc toàn bộ các luồng dữ liệu đang chạy phải hạ cấp về giao thức HTTP/1.1 thuần túy trên cổng 80.',
        'Một gói tin bị rớt khiến Kernel TCP Stack giữ lại toàn bộ các byte đến sau trong bộ đệm nhận, làm đóng băng đồng loạt mọi HTTP/2 stream khác trên kết nối TCP đó.',
        'Bảng chỉ mục động của thuật toán nén tiêu đề HPACK bị xóa sạch trên RAM máy chủ, buộc tiến trình Node.js phải khởi động lại toàn bộ các kết nối socket đang mở.',
        'Máy chủ lập tức phát tín hiệu TCP RST tới tất cả máy khách đang kết nối và yêu cầu thực hiện lại quy trình bắt tay 3 bước đồng bộ Sequence Number ngay từ đầu.'
      ],
      correctIndex: 1,
      explanation: 'Điểm yếu cốt lõi của HTTP/2 là ghép hàng trăm stream trên 1 kết nối TCP duy nhất. Vì nhân TCP bắt buộc bàn giao byte theo đúng thứ tự tuần tự nghiêm ngặt, nếu 1 packet bị mất (dù thuộc bất kỳ stream nào), kernel phải giam giữ toàn bộ các gói tin đến sau trong Receive Buffer chờ truyền lại, làm tê liệt đồng loạt mọi stream khác.'
    },
    {
      id: 'c3-l1-q2',
      question: 'Giao thức HTTP/3 chuyển sang vận hành trên nền tảng QUIC (sử dụng UDP ở User Space) nhằm đạt được hai đột phá kiến trúc cốt lõi nào so với HTTP/2 trên nền TCP?',
      options: [
        'Loại bỏ hoàn toàn bước trao đổi khóa mật mã bất đối xứng của chứng chỉ số SSL/TLS nhằm tiết kiệm 100% chi phí tính toán CPU trên các cụm máy chủ cân bằng tải biên.',
        'Cho phép tiến trình ứng dụng ghi thẳng các khung dữ liệu nhị phân vào bộ nhớ phần cứng của card mạng vật lý mà không cần đi qua bất kỳ lời gọi hệ thống Kernel nào.',
        'Tự động nhân bản mọi gói tin HTTP thành bốn bản sao giống hệt nhau và phát đồng thời qua nhiều cổng mạng vật lý để tăng gấp bốn lần băng thông tải tệp tin lớn.',
        'Kiểm soát thứ tự và mất gói độc lập theo từng Stream ID để triệt tiêu hoàn toàn TCP HoL Blocking, đồng thời dùng Connection ID giúp giữ kết nối khi đổi IP mạng.'
      ],
      correctIndex: 3,
      explanation: 'QUIC chạy trên UDP nên không bị ràng buộc bởi hàng đợi byte toàn cục của TCP Kernel. Mỗi stream trong HTTP/3 có bộ đếm offset và kiểm soát lỗi riêng biệt, nên rớt gói ở Stream A không làm chặn Stream B. Ngoài ra, QUIC định danh phiên bằng Connection ID 64-bit thay vì bộ tứ IP:Port, cho phép chuyển từ Wifi sang 5G mà không đứt kết nối.'
    },
    {
      id: 'c3-l1-q3',
      question: 'Tính năng tái kết nối 0-RTT Connection Resumption trong TLS 1.3 và HTTP/3 QUIC mang lại lợi ích hiệu năng nào và đi kèm rủi ro an ninh mạng nào cần phòng chống?',
      options: [
        'Cho phép gửi kèm dữ liệu HTTP ngay trong gói tin đầu tiên khi kết nối lại bằng khóa phiên cũ, nhưng có nguy cơ bị tấn công phát lại (Replay Attack) trên các lệnh ghi.',
        'Tự động bỏ qua toàn bộ các quy tắc kiểm tra của tường lửa ứng dụng web (WAF), giúp giảm độ trễ mạng nhưng làm tăng nguy cơ bị tấn công tiêm mã độc SQL Injection.',
        'Cho phép máy chủ đọc trực tiếp dữ liệu mà không cần giải mã khối đối xứng AES-GCM, nhưng khiến toàn bộ các lõi CPU của máy chủ luôn bị chiếm dụng ở mức tối đa 100%.',
        'Mở rộng kích thước khung truyền tối đa của tầng Ethernet lên mức 64 Megabytes, giúp truyền tệp nhanh hơn nhưng dễ gây tràn bộ nhớ đệm tại các thiết bị định tuyến.'
      ],
      correctIndex: 0,
      explanation: 'Với 0-RTT, client dùng lại khóa phiên cũ (Pre-Shared Key / Session Ticket) để mã hóa dữ liệu gửi ngay trong gói đầu tiên (tiết kiệm 1 RTT). Tuy nhiên, kẻ tấn công có thể bắt gói tin 0-RTT đó và phát lại nhiều lần lên server (Replay Attack). Do đó chỉ được cho phép 0-RTT với các phương thức Safe/Idempotent hoặc phải có cơ chế Anti-replay token.'
    },
    {
      id: 'c3-l1-q4',
      question: 'Trong giao tiếp nội bộ giữa các Microservices chịu tải cao, việc không sử dụng HTTP Keep-Alive Connection Pool sẽ dẫn tới thảm họa hệ thống nào ở tầng nhân Linux?',
      options: [
        'Toàn bộ dữ liệu JSON truyền qua mạng bị tự động chuyển đổi sang định dạng văn bản ASCII 7-bit làm hỏng các ký tự tiếng Việt có dấu trong cơ sở dữ liệu.',
        'Bộ thu gom rác Orinoco của máy ảo V8 bị vô hiệu hóa hoàn toàn, khiến vùng nhớ Old Generation tăng trưởng không kiểm soát và gây tràn bộ nhớ RAM chỉ sau vài phút.',
        'Mỗi request phải tốn 2 RTT bắt tay TCP+TLS mới và khi đóng sẽ đẩy socket vào trạng thái TIME_WAIT (60s), làm cạn sạch 28,232 cổng tạm thời gây lỗi EADDRNOTAVAIL.',
        'Hệ điều hành tự động thu hồi quyền truy cập card mạng của tiến trình Node.js vì vi phạm chính sách giới hạn băng thông tối đa của bộ lập lịch Completely Fair Scheduler.'
      ],
      correctIndex: 2,
      explanation: 'Khi không dùng Keep-Alive Pool, mỗi HTTP request phải mở một kết nối TCP mới (tốn RTT bắt tay và CPU tính toán TLS), sau đó khi đóng chủ động sẽ bị nhân Linux giữ ở trạng thái TIME_WAIT suốt 60 giây. Với dải ip_local_port_range mặc định chỉ có 28,232 cổng, lưu lượng trên 471 req/s sẽ làm cạn sạch cổng tạm thời và ném lỗi EADDRNOTAVAIL.'
    },
    {
      id: 'c3-l1-q5',
      question: 'Trong quy trình bắt tay 3 bước TCP (3-Way Handshake), phân đoạn SYN-ACK do máy chủ gửi trả về máy khách ở bước thứ hai thực hiện nhiệm vụ kỹ thuật chính xác nào?',
      options: [
        'Xác nhận đã nhận Sequence Number khởi tạo của Client bằng trường Ack = Client_Seq + 1, đồng thời gửi kèm Sequence Number khởi tạo riêng của Server để hai bên đồng bộ.',
        'Truyền toàn bộ nội dung chứng chỉ số khóa công khai X.509 và dữ liệu trang chủ HTML về cho trình duyệt để bắt đầu hiển thị giao diện trước khi mở cổng giao vận.',
        'Thông báo từ chối thiết lập kênh truyền do địa chỉ IP của máy khách chưa được đăng ký trước trong bảng định tuyến tĩnh của card mạng vật lý trên máy chủ đích.',
        'Yêu cầu nhân hệ điều hành của máy khách phải nâng đặc quyền của tiến trình trình duyệt lên mức quản trị viên tối cao (Root) trước khi cho phép gửi gói tin tiếp theo.'
      ],
      correctIndex: 0,
      explanation: 'TCP 3-Way Handshake là quá trình đồng bộ Sequence Number hai chiều và thông báo kích thước cửa sổ nhận (rwnd): Bước 1 Client gửi SYN (Seq = X); Bước 2 Server gửi SYN-ACK (Ack = X + 1 để xác nhận Seq của Client, kèm Seq = Y của chính Server); Bước 3 Client gửi ACK (Ack = Y + 1) để hoàn tất trạng thái ESTABLISHED.'
    },
    {
      id: 'c3-l1-q6',
      question: 'Cơ chế Kiểm soát Luồng (Flow Control) trong giao thức TCP ngăn chặn bên gửi làm tràn bộ nhớ đệm Socket Receive Buffer của bên nhận thông qua tham số kỹ thuật nào?',
      options: [
        'Sử dụng thuật toán Xô Rò Rỉ (Leaky Bucket) được tích hợp cứng trong vi mạch điều khiển của cáp quang biển để tự động hủy bỏ một nửa số gói tin truyền quá tốc độ.',
        'Đính kèm trường kích thước Cửa sổ Nhận (Receive Window — rwnd) trong mỗi gói tin TCP Header phản hồi để báo chính xác dung lượng buffer còn trống tại phía máy nhận.',
        'Gửi tín hiệu ngắt phần cứng (Hardware Interrupt) qua đường truyền Internet để tạm dừng xung nhịp bộ vi xử lý của máy gửi mỗi khi bộ nhớ RAM của máy nhận vượt mức 70%.',
        'Tự động mã hóa lại các gói tin đến nhanh thành định dạng nén nhị phân có kích thước bằng không nhằm lưu trữ vô hạn gói tin bên trong thanh ghi L1 Cache của CPU.'
      ],
      correctIndex: 1,
      explanation: 'TCP Flow Control vận hành bằng cơ chế Cửa sổ Trượt (Sliding Window). Trong mỗi gói ACK gửi về, máy nhận luôn cập nhật giá trị Receive Window (rwnd) phản ánh số byte còn trống trong Socket Receive Buffer (SO_RCVBUF). Nếu ứng dụng đọc chậm làm rwnd = 0 (Zero Window), máy gửi phải ngừng truyền dữ liệu ngay lập tức để tránh tràn bộ đệm.'
    },
    {
      id: 'c3-l1-q7',
      question: 'Tại sao giao thức HTTP/2 phải thiết kế thuật toán nén tiêu đề chuyên biệt HPACK thay vì sử dụng trực tiếp thuật toán nén luồng Gzip/Deflate (LZ77) truyền thống?',
      options: [
        'Vì thuật toán HPACK tích hợp mô hình mạng nơ-ron nhân tạo giúp dự đoán chính xác 100% các trường tiêu đề mà máy khách sẽ gửi trong các phiên làm việc tiếp theo.',
        'Vì HPACK triệt tiêu hoàn toàn lỗ hổng bảo mật CRIME/BREACH vốn lợi dụng sự thay đổi độ dài bản nén LZ77 để dò tìm từng ký tự bí mật của Cookie hoặc Token xác thực.',
        'Vì chuẩn nén Gzip chỉ có thể xử lý được các con số nguyên 32-bit và hoàn toàn không có khả năng nén các chuỗi ký tự văn bản thuộc bảng mã chuẩn quốc tế UTF-8.',
        'Vì các phép toán tra cứu bảng của HPACK được thực thi độc quyền trên bộ xử lý đồ họa rời (GPU) nên đạt tốc độ giải nén nhanh gấp một vạn lần so với chạy trên CPU.'
      ],
      correctIndex: 1,
      explanation: 'Trong giao thức SPDY đời đầu, việc nén HTTP Header bằng Deflate (LZ77) dẫn đến lỗ hổng CRIME: kẻ tấn công tiêm chuỗi thử nghiệm vào request và quan sát độ dài gói tin mã hóa TLS; nếu chuỗi tiêm vào trùng với Cookie thật, bản nén sẽ ngắn lại. HPACK dùng bảng chỉ mục tĩnh/động và mã hóa Huffman tĩnh, ngăn chặn hoàn toàn tấn công Compression Oracle.'
    },
    {
      id: 'c3-l1-q8',
      question: 'Tại sao kỹ sư Backend cần kích hoạt cờ TCP_NODELAY (socket.setNoDelay(true)) trên các kết nối HTTP Keep-Alive và gRPC có yêu cầu độ trễ phản hồi thấp?',
      options: [
        'Để tắt cơ chế kiểm tra tổng kiểm (TCP Checksum) ở tầng card mạng, cho phép chấp nhận cả các gói tin bị nhiễu điện từ nhằm tăng tốc độ truyền tải thêm 50%.',
        'Để buộc nhân hệ điều hành bỏ qua hoàn toàn bước bắt tay 3 bước TCP và đẩy thẳng dữ liệu ứng dụng vào cáp mạng ngay từ mili-giây đầu tiên khi mở cổng kết nối.',
        'Để vô hiệu hóa thuật toán Nagle, buộc Kernel gửi ngay các gói tin API nhỏ ra mạng thay vì giữ lại trong bộ đệm chờ gom đủ kích thước MSS (tránh độ trễ 40ms–200ms).',
        'Để tự động nhân đôi dung lượng bộ nhớ đệm L3 Cache của vi xử lý trung tâm dành riêng cho tiến trình Node.js mỗi khi phát hiện lưu lượng truy cập tăng đột biến.'
      ],
      correctIndex: 2,
      explanation: 'Thuật toán Nagle mặc định trong TCP sẽ giữ các gói dữ liệu nhỏ (< MSS 1460 bytes) lại trong Send Buffer chờ đến khi nhận được ACK của gói trước hoặc gom đủ 1460 bytes mới gửi đi. Khi kết hợp với cơ chế Delayed ACK ở đầu nhận, nó gây ra độ trễ chết 40ms-200ms cho mỗi lệnh gọi API nhỏ. Bật TCP_NODELAY sẽ tắt Nagle và đẩy gói tin đi tức thì.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Độ Trễ Bắt Tay Mạng & Ngưỡng Cạn Kiệt Cổng TIME_WAIT',
    description: 'Viết hàm `calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec)` để tính toán độ trễ thiết lập kết nối và rủi ro cạn kiệt cổng tạm thời (với tổng số cổng tạm thời khả dụng trên Linux là `28232`). Trong đó:\n- Số vòng lặp bắt tay (`handshakeRtts`): nếu `tlsVersion === "TLS_1_2"` thì bằng `3` (1 TCP + 2 TLS); nếu `tlsVersion === "TLS_1_3"` thì bằng `2` (1 TCP + 1 TLS); nếu `tlsVersion === "QUIC_1RTT"` thì bằng `1`; nếu `tlsVersion === "QUIC_0RTT"` thì bằng `0`.\n- Độ trễ bắt tay (`handshakeLatencyMs`) = `handshakeRtts * rttMs` (làm tròn 2 chữ số thập phân).\n- Số cổng bị khóa trong trạng thái `TIME_WAIT` nếu không dùng Keep-Alive (`occupiedTimeWaitPorts`) = `Math.round(requestsPerSec * timeWaitSec)`.\n- Trạng thái cổng (`portStatus`): nếu `tlsVersion` bắt đầu bằng `"QUIC"` thì luôn là `"QUIC_UDP_IMMUNE"`; ngược lại nếu `occupiedTimeWaitPorts >= 28232` là `"PORT_EXHAUSTION_EADDRNOTAVAIL"`, nếu `occupiedTimeWaitPorts >= 20000` là `"WARNING_HIGH_PORT_PRESSURE"`, còn lại là `"HEALTHY"`.',
    guidedSteps: [
      'Bước 1 (Xác định số vòng lặp RTT bắt tay): Dựa vào chuỗi tlsVersion ("TLS_1_2" -> 3, "TLS_1_3" -> 2, "QUIC_1RTT" -> 1, "QUIC_0RTT" -> 0) để gán giá trị cho biến handshakeRtts.',
      'Bước 2 (Tính độ trễ bắt tay mạng): Tính handshakeLatencyMs = Math.round(handshakeRtts * rttMs * 100) / 100.',
      'Bước 3 (Tính số lượng cổng tích tụ ở trạng thái TIME_WAIT): Nhân tốc độ requestsPerSec với thời gian giữ cổng timeWaitSec và làm tròn số nguyên bằng Math.round(requestsPerSec * timeWaitSec).',
      'Bước 4 (Phân loại trạng thái cổng và trả về kết quả): Kiểm tra nếu tlsVersion bắt đầu bằng "QUIC" thì trả về "QUIC_UDP_IMMUNE", ngược lại đối chiếu occupiedTimeWaitPorts với các mốc 28232 và 20000 rồi trả về object { handshakeRtts, handshakeLatencyMs, occupiedTimeWaitPorts, portStatus }.'
    ],
    hints: [
      'Với giao thức QUIC (HTTP/3), vì chạy trên UDP và định danh kết nối bằng Connection ID nên không bị giới hạn cạn kiệt cổng TCP TIME_WAIT cho từng request lẻ.',
      'Sử dụng tlsVersion.startsWith("QUIC") để kiểm tra nhanh các chế độ QUIC_1RTT và QUIC_0RTT.'
    ],
    starterCode: `function calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec) {
  // Bước 1: Xác định số vòng lặp bắt tay (handshakeRtts) theo tlsVersion
  
  // Bước 2: Tính độ trễ bắt tay handshakeLatencyMs (làm tròn 2 chữ số thập phân)
  
  // Bước 3: Tính số cổng bị giữ trong trạng thái TIME_WAIT (occupiedTimeWaitPorts)
  
  // Bước 4: Đánh giá portStatus và trả về { handshakeRtts, handshakeLatencyMs, occupiedTimeWaitPorts, portStatus }
}`,
    solution: `function calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec) {
  let handshakeRtts = 2;
  if (tlsVersion === 'TLS_1_2') {
    handshakeRtts = 3;
  } else if (tlsVersion === 'TLS_1_3') {
    handshakeRtts = 2;
  } else if (tlsVersion === 'QUIC_1RTT') {
    handshakeRtts = 1;
  } else if (tlsVersion === 'QUIC_0RTT') {
    handshakeRtts = 0;
  }

  const handshakeLatencyMs = Math.round(handshakeRtts * rttMs * 100) / 100;
  const occupiedTimeWaitPorts = Math.round(requestsPerSec * timeWaitSec);

  let portStatus = 'HEALTHY';
  if (String(tlsVersion).startsWith('QUIC')) {
    portStatus = 'QUIC_UDP_IMMUNE';
  } else if (occupiedTimeWaitPorts >= 28232) {
    portStatus = 'PORT_EXHAUSTION_EADDRNOTAVAIL';
  } else if (occupiedTimeWaitPorts >= 20000) {
    portStatus = 'WARNING_HIGH_PORT_PRESSURE';
  }

  return {
    handshakeRtts,
    handshakeLatencyMs,
    occupiedTimeWaitPorts,
    portStatus,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Kết nối TCP + TLS 1.2 cũ với tải cao gây cạn kiệt cổng EADDRNOTAVAIL',
        input: [45, 'TLS_1_2', 550, 60],
        expected: {
          handshakeRtts: 3,
          handshakeLatencyMs: 135,
          occupiedTimeWaitPorts: 33000,
          portStatus: 'PORT_EXHAUSTION_EADDRNOTAVAIL'
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Kết nối TCP + TLS 1.3 ở mức tải vừa phải (An toàn)',
        input: [35, 'TLS_1_3', 200, 60],
        expected: {
          handshakeRtts: 2,
          handshakeLatencyMs: 70,
          occupiedTimeWaitPorts: 12000,
          portStatus: 'HEALTHY'
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Kết nối HTTP/3 QUIC 1-RTT miễn nhiễm hoàn toàn với giới hạn cổng TCP',
        input: [50, 'QUIC_1RTT', 1000, 60],
        expected: {
          handshakeRtts: 1,
          handshakeLatencyMs: 50,
          occupiedTimeWaitPorts: 60000,
          portStatus: 'QUIC_UDP_IMMUNE'
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Tái kết nối QUIC 0-RTT với độ trễ bắt tay bằng 0ms',
        input: [120.5, 'QUIC_0RTT', 800, 60],
        expected: {
          handshakeRtts: 0,
          handshakeLatencyMs: 0,
          occupiedTimeWaitPorts: 48000,
          portStatus: 'QUIC_UDP_IMMUNE'
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Ngưỡng cảnh báo áp lực cổng cao (20,000 <= occupied < 28,232)',
        input: [25.25, 'TLS_1_3', 400, 60],
        expected: {
          handshakeRtts: 2,
          handshakeLatencyMs: 50.5,
          occupiedTimeWaitPorts: 24000,
          portStatus: 'WARNING_HIGH_PORT_PRESSURE'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Độ Trễ Bắt Tay Mạng & Ngưỡng Cạn Kiệt Cổng TIME_WAIT',
      description: 'Viết hàm `calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec)` để tính toán độ trễ thiết lập kết nối và rủi ro cạn kiệt cổng tạm thời (với tổng số cổng tạm thời khả dụng trên Linux là `28232`). Trong đó:\n- Số vòng lặp bắt tay (`handshakeRtts`): nếu `tlsVersion === "TLS_1_2"` thì bằng `3` (1 TCP + 2 TLS); nếu `tlsVersion === "TLS_1_3"` thì bằng `2` (1 TCP + 1 TLS); nếu `tlsVersion === "QUIC_1RTT"` thì bằng `1`; nếu `tlsVersion === "QUIC_0RTT"` thì bằng `0`.\n- Độ trễ bắt tay (`handshakeLatencyMs`) = `handshakeRtts * rttMs` (làm tròn 2 chữ số thập phân).\n- Số cổng bị khóa trong trạng thái `TIME_WAIT` nếu không dùng Keep-Alive (`occupiedTimeWaitPorts`) = `Math.round(requestsPerSec * timeWaitSec)`.\n- Trạng thái cổng (`portStatus`): nếu `tlsVersion` bắt đầu bằng `"QUIC"` thì luôn là `"QUIC_UDP_IMMUNE"`; ngược lại nếu `occupiedTimeWaitPorts >= 28232` là `"PORT_EXHAUSTION_EADDRNOTAVAIL"`, nếu `occupiedTimeWaitPorts >= 20000` là `"WARNING_HIGH_PORT_PRESSURE"`, còn lại là `"HEALTHY"`.',
      guidedSteps: [
        'Bước 1 (Xác định số vòng lặp RTT bắt tay): Dựa vào chuỗi tlsVersion ("TLS_1_2" -> 3, "TLS_1_3" -> 2, "QUIC_1RTT" -> 1, "QUIC_0RTT" -> 0) để gán giá trị cho biến handshakeRtts.',
        'Bước 2 (Tính độ trễ bắt tay mạng): Tính handshakeLatencyMs = Math.round(handshakeRtts * rttMs * 100) / 100.',
        'Bước 3 (Tính số lượng cổng tích tụ ở trạng thái TIME_WAIT): Nhân tốc độ requestsPerSec với thời gian giữ cổng timeWaitSec và làm tròn số nguyên bằng Math.round(requestsPerSec * timeWaitSec).',
        'Bước 4 (Phân loại trạng thái cổng và trả về kết quả): Kiểm tra nếu tlsVersion bắt đầu bằng "QUIC" thì trả về "QUIC_UDP_IMMUNE", ngược lại đối chiếu occupiedTimeWaitPorts với các mốc 28232 và 20000 rồi trả về object { handshakeRtts, handshakeLatencyMs, occupiedTimeWaitPorts, portStatus }.'
      ],
      hints: [
        'Với giao thức QUIC (HTTP/3), vì chạy trên UDP và định danh kết nối bằng Connection ID nên không bị giới hạn cạn kiệt cổng TCP TIME_WAIT cho từng request lẻ.',
        'Sử dụng tlsVersion.startsWith("QUIC") để kiểm tra nhanh các chế độ QUIC_1RTT và QUIC_0RTT.'
      ],
      starterCode: `function calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec) {
  // Bước 1: Xác định số vòng lặp bắt tay (handshakeRtts) theo tlsVersion
  
  // Bước 2: Tính độ trễ bắt tay handshakeLatencyMs (làm tròn 2 chữ số thập phân)
  
  // Bước 3: Tính số cổng bị giữ trong trạng thái TIME_WAIT (occupiedTimeWaitPorts)
  
  // Bước 4: Đánh giá portStatus và trả về { handshakeRtts, handshakeLatencyMs, occupiedTimeWaitPorts, portStatus }
}`,
      solution: `function calculateTransportHandshakeMetrics(rttMs, tlsVersion, requestsPerSec, timeWaitSec) {
  let handshakeRtts = 2;
  if (tlsVersion === 'TLS_1_2') {
    handshakeRtts = 3;
  } else if (tlsVersion === 'TLS_1_3') {
    handshakeRtts = 2;
  } else if (tlsVersion === 'QUIC_1RTT') {
    handshakeRtts = 1;
  } else if (tlsVersion === 'QUIC_0RTT') {
    handshakeRtts = 0;
  }

  const handshakeLatencyMs = Math.round(handshakeRtts * rttMs * 100) / 100;
  const occupiedTimeWaitPorts = Math.round(requestsPerSec * timeWaitSec);

  let portStatus = 'HEALTHY';
  if (String(tlsVersion).startsWith('QUIC')) {
    portStatus = 'QUIC_UDP_IMMUNE';
  } else if (occupiedTimeWaitPorts >= 28232) {
    portStatus = 'PORT_EXHAUSTION_EADDRNOTAVAIL';
  } else if (occupiedTimeWaitPorts >= 20000) {
    portStatus = 'WARNING_HIGH_PORT_PRESSURE';
  }

  return {
    handshakeRtts,
    handshakeLatencyMs,
    occupiedTimeWaitPorts,
    portStatus,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Kết nối TCP + TLS 1.2 cũ với tải cao gây cạn kiệt cổng EADDRNOTAVAIL',
          input: [45, 'TLS_1_2', 550, 60],
          expected: {
            handshakeRtts: 3,
            handshakeLatencyMs: 135,
            occupiedTimeWaitPorts: 33000,
            portStatus: 'PORT_EXHAUSTION_EADDRNOTAVAIL'
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Kết nối TCP + TLS 1.3 ở mức tải vừa phải (An toàn)',
          input: [35, 'TLS_1_3', 200, 60],
          expected: {
            handshakeRtts: 2,
            handshakeLatencyMs: 70,
            occupiedTimeWaitPorts: 12000,
            portStatus: 'HEALTHY'
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Kết nối HTTP/3 QUIC 1-RTT miễn nhiễm hoàn toàn với giới hạn cổng TCP',
          input: [50, 'QUIC_1RTT', 1000, 60],
          expected: {
            handshakeRtts: 1,
            handshakeLatencyMs: 50,
            occupiedTimeWaitPorts: 60000,
            portStatus: 'QUIC_UDP_IMMUNE'
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Tái kết nối QUIC 0-RTT với độ trễ bắt tay bằng 0ms',
          input: [120.5, 'QUIC_0RTT', 800, 60],
          expected: {
            handshakeRtts: 0,
            handshakeLatencyMs: 0,
            occupiedTimeWaitPorts: 48000,
            portStatus: 'QUIC_UDP_IMMUNE'
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Ngưỡng cảnh báo áp lực cổng cao (20,000 <= occupied < 28,232)',
          input: [25.25, 'TLS_1_3', 400, 60],
          expected: {
            handshakeRtts: 2,
            handshakeLatencyMs: 50.5,
            occupiedTimeWaitPorts: 24000,
            portStatus: 'WARNING_HIGH_PORT_PRESSURE'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Bể Tái Sử Dụng Kết Nối Keep-Alive Chiến Lược LIFO (Connection Pool Simulator)',
      description: 'Hiện thực hàm `simulateConnectionPool(maxSize, ops)` để mô phỏng bộ điều phối kết nối TCP Keep-Alive theo chiến lược **LIFO (Last-In, First-Out)**.\n- Nếu `typeof maxSize !== "number" || maxSize <= 0 || !Array.isArray(ops) || ops.length === 0`, trả về mảng rỗng `[]`.\n- Duyệt qua từng phần tử trong mảng `ops`:\n  + Khi gặp `{ op: "acquire" }`: nếu danh sách kết nối nhàn rỗi (`idle`) không rỗng, lấy kết nối vừa mới trả về gần nhất (`idle.pop()`) để tái sử dụng, tăng số kết nối đang hoạt động (`active++`) và đẩy mã kết nối đó vào mảng kết quả `results`; ngược lại nếu `active < maxSize`, tạo mới kết nối `"conn_" + (++currentId)`, tăng `active++` và đẩy vào `results` (nếu `active >= maxSize` và `idle` rỗng thì bỏ qua).\n  + Khi gặp `{ op: "release", connId }`: nếu `active > 0`, giảm `active--` và đẩy `connId` vào cuối mảng `idle` (`idle.push(connId)`).\n- Trả về mảng `results` chứa lịch sử các mã kết nối đã được cấp phát thành công.',
      guidedSteps: [
        'Bước 1 (Kiểm tra điều kiện biên): Nếu maxSize <= 0 hoặc ops không phải mảng có phần tử, trả về ngay mảng rỗng [].',
        'Bước 2 (Khởi tạo trạng thái Pool): Khai báo mảng idle = [], biến đếm currentId = 0, biến đếm active = 0 và mảng kết quả results = [].',
        'Bước 3 (Xử lý thao tác acquire và release): Với "acquire", ưu tiên lấy từ idle.pop() trước; nếu idle rỗng và active < maxSize thì tăng currentId và tạo chuỗi `conn_${currentId}`. Với "release", nếu active > 0 thì giảm active và idle.push(item.connId).',
        'Bước 4 (Hoàn trả lịch sử cấp phát): Sau khi duyệt hết ops, trả về mảng results.'
      ],
      hints: [
        'Sử dụng cặp idle.push(connId) khi release và idle.pop() khi acquire sẽ tự động tạo thành hàng đợi LIFO (ưu tiên tái sử dụng socket ấm nhất vừa mới giải phóng).',
        'Đừng quên tăng biến active mỗi khi lấy socket từ idle hoặc khi tạo socket mới, và giảm active khi release.'
      ],
      starterCode: `function simulateConnectionPool(maxSize, ops) {
  // Bước 1: Kiểm tra tính hợp lệ của maxSize và ops
  
  // Bước 2: Khởi tạo mảng idle, biến currentId, active và results
  
  // Bước 3: Duyệt qua từng thao tác acquire / release trong ops
  
  // Bước 4: Trả về mảng results
}`,
      solution: `function simulateConnectionPool(maxSize, ops) {
  if (typeof maxSize !== 'number' || maxSize <= 0 || !Array.isArray(ops) || ops.length === 0) {
    return [];
  }

  const idle = [];
  let currentId = 0;
  let active = 0;
  const results = [];

  for (const item of ops) {
    if (item.op === 'acquire') {
      if (idle.length > 0) {
        const reused = idle.pop();
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
          name: 'Case 1 công khai: Cấp phát kết nối mới khi bể chưa đầy',
          input: [2, [{ op: 'acquire' }]],
          expected: ['conn_1'],
          hidden: false
        },
        {
          name: 'Case 2 công khai: Tái sử dụng ngay kết nối ấm sau khi được release (0 RTT)',
          input: [
            1,
            [
              { op: 'acquire' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' }
            ]
          ],
          expected: ['conn_1', 'conn_1'],
          hidden: false
        },
        {
          name: 'Case 3 công khai: Chặn tạo thêm kết nối khi số lượng active đã chạm trần maxSize',
          input: [2, [{ op: 'acquire' }, { op: 'acquire' }, { op: 'acquire' }]],
          expected: ['conn_1', 'conn_2'],
          hidden: false
        },
        {
          name: 'Case 4 ẩn: maxSize <= 0 hoặc danh sách thao tác rỗng trả về mảng rỗng',
          input: [0, [{ op: 'acquire' }]],
          expected: [],
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Chu kỳ acquire và release xen kẽ ưu tiên LIFO',
          input: [
            2,
            [
              { op: 'acquire' },
              { op: 'acquire' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' },
              { op: 'release', connId: 'conn_2' },
              { op: 'release', connId: 'conn_1' },
              { op: 'acquire' }
            ]
          ],
          expected: ['conn_1', 'conn_2', 'conn_1', 'conn_1'],
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Phân Tích Nghẽn Đầu Hàng (HoL Blocking) & Đánh Giá SLA Giữa HTTP/2 Và HTTP/3 QUIC',
      description: 'Viết hàm `evaluateMultiplexingUnderPacketLoss(concurrentStreams, rttMs, packetLossRate, nagleDelayEnabled)` để định lượng độ trễ nghẽn đầu hàng và khuyến nghị giao thức giao vận chuẩn Production:\n1. **Kiểm tra đầu vào (Validation):** Nếu `concurrentStreams <= 0` hoặc `rttMs <= 0` hoặc `packetLossRate < 0` hoặc `packetLossRate >= 1`, lập tức ném lỗi `throw new Error("INVALID_TRANSPORT_METRICS")`.\n2. **Tính thông lượng trần của 1 kết nối TCP theo công thức Mathias (KB/s):** Nếu `packetLossRate === 0` thì `tcpMaxThroughputKBps = 100000`; ngược lại tính `tcpMaxThroughputKBps = ((1460 / (rttMs / 1000)) * (1 / Math.sqrt(packetLossRate))) / 1024` (làm tròn 2 chữ số thập phân).\n3. **Tính tổng thời gian phạt do nghẽn đầu hàng trên toàn bộ các luồng (`http2HolBlockedStreamMs` vs `http3QuicBlockedStreamMs`):**\n   - Giả định khi có mất gói (`packetLossRate > 0`), trong HTTP/2 rớt gói sẽ làm đóng băng toàn bộ `concurrentStreams` luồng cùng lúc, cộng thêm độ trễ Nagle `40 ms` nếu `nagleDelayEnabled === true`: `http2HolBlockedStreamMs = packetLossRate > 0 ? concurrentStreams * rttMs * packetLossRate * 10 + (nagleDelayEnabled ? 40 : 0) : (nagleDelayEnabled ? 40 : 0)` (làm tròn 2 chữ số thập phân).\n   - Trong HTTP/3 QUIC (chạy trên UDP không có Nagle và cô lập từng luồng), chỉ những luồng thực sự bị mất gói mới phải chờ truyền lại: `http3QuicBlockedStreamMs = concurrentStreams * packetLossRate * rttMs` (làm tròn 2 chữ số thập phân).\n4. **Khuyến nghị kiến trúc (`recommendedProtocol`):** Nếu `packetLossRate >= 0.01` (tỷ lệ mất gói từ 1% trở lên) thì trả về `"SWITCH_TO_HTTP3_QUIC"`; ngược lại nếu `nagleDelayEnabled === true` thì trả về `"ENABLE_TCP_NODELAY_ON_HTTP2"`, còn lại trả về `"HTTP2_MULTIPLEXING_OPTIMAL"`.',
      guidedSteps: [
        'Bước 1 (Xác thực thông số mạng): Kiểm tra concurrentStreams <= 0, rttMs <= 0, packetLossRate < 0 hoặc packetLossRate >= 1 để throw new Error("INVALID_TRANSPORT_METRICS").',
        'Bước 2 (Tính thông lượng trần TCP theo Mathias): Nếu packetLossRate === 0 gán 100000; nếu > 0 áp dụng công thức ((1460 / (rttMs / 1000)) * (1 / Math.sqrt(packetLossRate))) / 1024 và làm tròn 2 chữ số thập phân.',
        'Bước 3 (Tính độ trễ nghẽn luồng tích lũy giữa HTTP/2 và HTTP/3): Tính http2HolBlockedStreamMs và http3QuicBlockedStreamMs theo công thức đề bài và làm tròn 2 chữ số thập phân.',
        'Bước 4 (Đưa ra quyết định giao thức): Kiểm tra packetLossRate >= 0.01 -> "SWITCH_TO_HTTP3_QUIC", tiếp theo kiểm tra nagleDelayEnabled -> "ENABLE_TCP_NODELAY_ON_HTTP2", mặc định "HTTP2_MULTIPLEXING_OPTIMAL".'
      ],
      hints: [
        'Chú ý đổi đơn vị rttMs sang giây bằng cách chia cho 1000 khi tính công thức Mathias: (1460 / (rttMs / 1000)), sau đó chia tiếp cho 1024 để đổi từ Bytes/s sang KB/s.',
        'Dùng hàm phụ round2(val) = Math.round(val * 100) / 100 để đảm bảo mọi số thực trả về đều chính xác tới 2 chữ số thập phân.'
      ],
      starterCode: `function evaluateMultiplexingUnderPacketLoss(concurrentStreams, rttMs, packetLossRate, nagleDelayEnabled) {
  // Bước 1: Kiểm tra tính hợp lệ của tham số, ném Error("INVALID_TRANSPORT_METRICS") nếu vi phạm
  
  // Bước 2: Tính thông lượng trần TCP theo phương trình Mathias (tcpMaxThroughputKBps)
  
  // Bước 3: Tính độ trễ phạt http2HolBlockedStreamMs và http3QuicBlockedStreamMs
  
  // Bước 4: Xác định recommendedProtocol và trả về kết quả
}`,
      solution: `function evaluateMultiplexingUnderPacketLoss(concurrentStreams, rttMs, packetLossRate, nagleDelayEnabled) {
  if (
    typeof concurrentStreams !== 'number' ||
    concurrentStreams <= 0 ||
    typeof rttMs !== 'number' ||
    rttMs <= 0 ||
    typeof packetLossRate !== 'number' ||
    packetLossRate < 0 ||
    packetLossRate >= 1
  ) {
    throw new Error('INVALID_TRANSPORT_METRICS');
  }

  const rawThroughputKBps =
    packetLossRate === 0
      ? 100000
      : ((1460 / (rttMs / 1000)) * (1 / Math.sqrt(packetLossRate))) / 1024;
  const tcpMaxThroughputKBps = Math.round(rawThroughputKBps * 100) / 100;

  const naglePenalty = nagleDelayEnabled ? 40 : 0;
  const rawHttp2Blocked =
    packetLossRate > 0
      ? concurrentStreams * rttMs * packetLossRate * 10 + naglePenalty
      : naglePenalty;
  const http2HolBlockedStreamMs = Math.round(rawHttp2Blocked * 100) / 100;

  const rawHttp3Blocked = concurrentStreams * packetLossRate * rttMs;
  const http3QuicBlockedStreamMs = Math.round(rawHttp3Blocked * 100) / 100;

  let recommendedProtocol = 'HTTP2_MULTIPLEXING_OPTIMAL';
  if (packetLossRate >= 0.01) {
    recommendedProtocol = 'SWITCH_TO_HTTP3_QUIC';
  } else if (nagleDelayEnabled) {
    recommendedProtocol = 'ENABLE_TCP_NODELAY_ON_HTTP2';
  }

  return {
    tcpMaxThroughputKBps,
    http2HolBlockedStreamMs,
    http3QuicBlockedStreamMs,
    recommendedProtocol,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Mạng di động 4G có tỷ lệ mất gói 1% (0.01) gây TCP HoL Blocking nặng -> Khuyến nghị HTTP/3 QUIC',
          input: [50, 50, 0.01, false],
          expected: {
            tcpMaxThroughputKBps: 285.16,
            http2HolBlockedStreamMs: 250,
            http3QuicBlockedStreamMs: 25,
            recommendedProtocol: 'SWITCH_TO_HTTP3_QUIC'
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Mạng nội bộ không mất gói nhưng quên tắt thuật toán Nagle -> Khuyến nghị bật TCP_NODELAY',
          input: [80, 10, 0, true],
          expected: {
            tcpMaxThroughputKBps: 100000,
            http2HolBlockedStreamMs: 40,
            http3QuicBlockedStreamMs: 0,
            recommendedProtocol: 'ENABLE_TCP_NODELAY_ON_HTTP2'
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Mạng Data Center ổn định và đã bật TCP_NODELAY -> HTTP/2 hoạt động tối ưu',
          input: [100, 5, 0.0004, false],
          expected: {
            tcpMaxThroughputKBps: 14257.81,
            http2HolBlockedStreamMs: 2,
            http3QuicBlockedStreamMs: 0.2,
            recommendedProtocol: 'HTTP2_MULTIPLEXING_OPTIMAL'
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Tỷ lệ mất gói cao 4% (0.04) kèm lỗi bật Nagle',
          input: [40, 100, 0.04, true],
          expected: {
            tcpMaxThroughputKBps: 71.29,
            http2HolBlockedStreamMs: 1640,
            http3QuicBlockedStreamMs: 160,
            recommendedProtocol: 'SWITCH_TO_HTTP3_QUIC'
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Tham số đầu vào âm hoặc tỷ lệ mất gói >= 1 -> Ném lỗi INVALID_TRANSPORT_METRICS',
          input: [0, -10, 1.2, false],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
