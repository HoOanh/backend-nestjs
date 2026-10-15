import type { Lesson } from '../types.ts';

export const c2_l2: Lesson = {
  id: 'c2-l2',
  title: 'Bài 02: OS Kernel Non-Blocking I/O: Socket Multiplexing, Linux epoll vs Libuv Threadpool',
  duration: '60 phút',
  tag: 'Kernel Syscalls & Libuv',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng Giao tiếp Hệ thống Cấp thấp (Low-level Operating System Syscalls) từ cơ chế ngắt phần cứng Card mạng (NIC DMA Interrupts) đến kiến trúc ghép kênh sự kiện của nhân Linux và bể luồng C++ của Libuv cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Cơ chế Ghép kênh Ngõ vào/ra Cấp Nhân (Kernel I/O Multiplexing) và Giải phẫu Linux \`epoll\`:** Hiểu rõ ranh giới vật lý giữa \`User Space\` và \`Kernel Space\`, cấu trúc \`File Descriptor (FD)\`; chứng minh sự suy thoái tuyến tính \`O(N)\` của các lời gọi hệ thống cổ điển (\`select\`, \`poll\`) và cách \`Linux epoll\` đạt độ phức tạp \`O(1)\` thông qua sự kết hợp giữa **Cây Đỏ-Đen (\`Red-Black Tree\`)** và **Danh sách Liên kết Sẵn sàng (\`Ready List\`)**.
> 2. **Ranh giới Phân tách Kiến trúc trong Libuv: Kernel Event Demultiplexer đối đầu Worker Threadpool:** Xóa bỏ ngộ nhận phổ biến cho rằng mọi thao tác bất đồng bộ trong Node.js đều dùng chung Threadpool; phân định rạch ròi nhóm tác vụ thuần Kernel không tốn luồng (\`TCP/UDP Socket\`, \`HTTP\`, \`c-ares DNS\`) với nhóm tác vụ bắt buộc phải chuyển giao sang **4 luồng C++ của Libuv Threadpool** (\`File System fs.*\`, \`dns.lookup / getaddrinfo\`, \`crypto.pbkdf2/scrypt\`, \`zlib\`).
> 3. **Chẩn đoán Tắc nghẽn Bể luồng (Threadpool Starvation) và Tối ưu hóa \`UV_THREADPOOL_SIZE\` trên Production:** Phân tích hiệu ứng dây chuyền khi các tác vụ băm mật khẩu hoặc đọc tệp làm tê liệt khả năng phân giải tên miền \`dns.lookup\` của Database/HTTP Client; làm chủ kỹ thuật cô lập hạn ngạch luồng (\`Concurrency Semaphore\`), bộ nhớ đệm DNS và công thức định cỡ \`UV_THREADPOOL_SIZE\` theo số lõi vCPU của Container.

---

# 1. CƠ CHẾ GHÉP KÊNH I/O CẤP NHÂN (KERNEL I/O MULTIPLEXING): TỪ SELECT/POLL ĐẾN ĐỘT PHÁ LINUX EPOLL

### 1.1 Khái niệm nền tảng: File Descriptor (FD), Ranh giới User/Kernel Space và Cờ \`O_NONBLOCK\`

Để một tiến trình Backend Node.js có thể nhận gói tin HTTP từ người dùng hoặc đọc dữ liệu từ ổ cứng NVMe, nó không được phép truy cập trực tiếp vào phần cứng Card mạng (**NIC — Network Interface Card**) vì lý do bảo mật phần cứng của vi xử lý (chế độ đặc quyền **CPU Ring 0 — Kernel Mode** so với **CPU Ring 3 — User Mode**). Thay vào đó, mọi giao tiếp I/O trên hệ điều hành họ Unix/Linux đều xoay quanh khái niệm trừu tượng hóa mang tên **Mô tả Tệp tin (\`File Descriptor — FD\`)**:

1. **Bản chất của \`File Descriptor (FD)\` và Bảng Mô tả Mở (\`Open File Table\`):**
   Trong triết lý thiết kế của Unix (*"Everything is a file"*), mỗi kết nối mạng TCP, mỗi đường ống dẫn (\`Pipe\`), mỗi tệp tin trên đĩa khi được mở ra đều được nhân hệ điều hành cấp cho một số nguyên không âm (\`0, 1, 2, 3...\`) gọi là **\`File Descriptor\`**. Số nguyên này thực chất là chỉ mục (\`Index\`) trỏ vào bảng quản lý tài nguyên của tiến trình trong không gian Kernel, nơi chứa con trỏ dẫn tới vùng đệm nhận mạng (**Kernel Socket Receive Buffer — \`sk_buff\`**).
2. **Mô hình Chặn truyền thống (\`Blocking I/O\`) và Cờ Phi chặn (\`O_NONBLOCK\`):**
   Theo mặc định, khi một tiến trình gọi lệnh hệ thống \`read(fd, buf, size)\` trên một socket chưa có dữ liệu gửi tới, nhân Linux sẽ lập tức chuyển trạng thái của luồng đó từ \`TASK_RUNNING\` sang \`TASK_INTERRUPTIBLE\` (ngủ đông) và tước quyền CPU cho đến khi có gói tin đến.
   - Để tránh bị ngủ đông, Libuv cấu hình mọi socket mạng với cờ **\`O_NONBLOCK\`** thông qua lời gọi \`fcntl(fd, F_SETFL, O_NONBLOCK)\`. Khi có cờ này, nếu gọi \`read(fd)\` mà vùng đệm Kernel đang trống, nhân OS **không làm ngủ luồng** mà trả về ngay lập tức mã lỗi **\`-EAGAIN\` (hoặc \`EWOULDBLOCK\`)** chỉ sau vài trăm nano-giây.
3. **Thách thức Ghép kênh 100,000 Kết nối (\`The C100K Multiplexing Problem\`):**
   Mặc dù cờ \`O_NONBLOCK\` giúp luồng chính không bị chặn, nhưng nếu có \`50,000\` kết nối TCP đang mở, luồng chính không thể chạy một vòng lặp \`while(true)\` gọi \`read()\` thử vận may qua cả \`50,000\` socket liên tục (**Busy-Waiting Polling**), vì làm vậy sẽ đốt cháy \`100% CPU\` chỉ để nhận về hàng triệu mã lỗi \`EAGAIN\` vô nghĩa. Hệ thống cần một cơ chế **Ghép kênh I/O (\`I/O Multiplexing\`)**: giao toàn bộ \`50,000\` FD cho Kernel canh gác giúp, và chỉ đánh thức luồng chính dậy khi thực sự có ít nhất 1 socket nhận được dữ liệu.

### 1.2 Đối chiếu kiến trúc các thế hệ System Call Ghép kênh I/O trên Hệ điều hành

Trải qua 40 năm tiến hóa của nhân hệ điều hành, cơ chế ghép kênh I/O đã đi từ phương pháp quét mảng thô sơ đến kiến trúc hướng sự kiện và vòng đệm chia sẻ bộ nhớ. Bảng dưới đây đối chiếu định lượng 4 cơ chế này:

| Tiêu chí học thuật | \`select()\` (POSIX 1983) | \`poll()\` (System V 1997) | \`epoll\` (Linux 2.5.44+) / \`kqueue\` (BSD/macOS) | \`io_uring\` (Linux 5.1+ Modern Async) |
| :--- | :--- | :--- | :--- | :--- |
| **Cấu trúc truyền dữ liệu từ User xuống Kernel** | Mảng bit tĩnh \`fd_set\` kích thước cố định; phải sao chép lại toàn bộ mảng ở **mỗi vòng lặp** | Mảng động các cấu trúc \`struct pollfd\`; vẫn phải sao chép toàn bộ mảng từ User vào Kernel mỗi lần gọi | **Lưu trú lâu dài trong Kernel**: Chỉ đăng ký 1 lần qua \`epoll_ctl\`, không cần truyền lại mảng khi chờ | Hai vòng đệm bộ nhớ chia sẻ (**Submission / Completion Ring Buffer**) dùng chung giữa User và Kernel |
| **Giới hạn số lượng Socket tối đa (\`Max FDs\`)** | **Bị khóa cứng ở \`1024\` FD** do hằng số biên dịch \`FD_SETSIZE = 1024\` | Không giới hạn cứng về mặt cấu trúc (phụ thuộc vào \`ulimit -n\` của hệ thống) | **Hàng trăm nghìn đến hàng triệu FD** (chỉ giới hạn bởi dung lượng RAM vật lý và \`fs.file-max\`) | Hàng triệu FD và yêu cầu đọc/ghi đồng thời |
| **Độ phức tạp CPU khi thu hoạch sự kiện** | **Tuyến tính \`O(N)\`**: Cả Kernel lẫn User đều phải quét đủ \`N\` bit để tìm xem bit nào bật | **Tuyến tính \`O(N)\`**: Kernel phải duyệt tuần tự qua toàn bộ \`N\` phần tử \`pollfd\` ở mỗi chu kỳ | **Hằng số \`O(1)\` theo số kết nối tổng (hoặc \`O(K)\` theo số socket thực sự có dữ liệu)** | **\`O(1)\` hoàn toàn**: Đọc trực tiếp từ hàng đợi hoàn tất mà không tốn cả chi phí chuyển ngữ cảnh Syscall |
| **Phạm vi hỗ trợ loại tài nguyên** | Chỉ hỗ trợ Network Sockets, Pipes, TTY (vô tác dụng với Regular Disk Files) | Chỉ hỗ trợ Network Sockets, Pipes, TTY (vô tác dụng với Regular Disk Files) | Hỗ trợ hoàn hảo Sockets, Pipes, Timers (\`timerfd\`), Signals (**nhưng KHÔNG hỗ trợ Regular Disk Files**) | Hỗ trợ thống nhất **cả Network Sockets LẪN Regular Disk Files** bất đồng bộ thực sự |
| **Mức độ sử dụng trong Libuv / Node.js** | Chỉ dùng làm phương án dự phòng cuối cùng trên các hệ thống nhúng cổ lỗ | Không dùng cho vòng lặp chính nếu hệ điều hành đã có \`epoll\` hoặc \`kqueue\` | **Cơ chế mặc định cốt lõi của Libuv Pha 4 (\`Poll\`)** trên mọi máy chủ Linux và macOS hiện nay | Đang được tích hợp dần vào các phiên bản Libuv mới cho thao tác tệp tin trên Linux Kernel hiện đại |

### 1.3 Giải phẫu nội tại của Linux \`epoll\`: Cây Đỏ-Đen (\`Red-Black Tree\`), \`Ready List\` và Ngắt Phần cứng NIC

Tại sao khi có \`100,000\` kết nối WebSocket đang mở nhưng chỉ có \`5\` người dùng gửi tin nhắn cùng lúc, \`select()\` và \`poll()\` phải bắt CPU thực hiện \`100,000\` phép kiểm tra, trong khi \`epoll\` lại trả về ngay tức khắc đúng \`5\` kết nối đó với độ phức tạp **\`O(1)\`**? Bí mật nằm ở cấu trúc đối tượng **\`struct eventpoll\`** bên trong nhân Linux cùng sự phối hợp của 3 lời gọi hệ thống (\`epoll_create1\`, \`epoll_ctl\`, \`epoll_wait\`):

1. **Bước 1 — Khởi tạo không gian theo dõi nội nhân (\`epoll_create1\`):**
   Khi tiến trình Node.js vừa khởi động và tạo \`uv_loop_t\`, Libuv gọi \`epoll_create1(EPOLL_CLOEXEC)\`. Nhân Linux cấp phát một cấu trúc \`struct eventpoll\` nằm ngay trong bộ nhớ Kernel Space. Bên trong cấu trúc này có hai thành phần dữ liệu tách biệt:
   - **\`rbr\` (Cây tìm kiếm nhị phân cân bằng Đỏ-Đen — \`Red-Black Tree\`):** Dùng làm danh bạ lưu trữ toàn bộ các File Descriptor mà tiến trình Node.js muốn theo dõi.
   - **\`rdllist\` (Danh sách liên kết đôi Sẵn sàng — \`Doubly-Linked Ready List\`):** Chỉ chứa những File Descriptor **đã thực sự có dữ liệu mạng vừa tới** và đang chờ Node.js lấy lên đọc.
2. **Bước 2 — Đăng ký Socket vào Cây Đỏ-Đen (\`epoll_ctl\` — Độ phức tạp \`O(log N)\`):**
   Mỗi khi có một kết nối HTTP/WebSocket mới được chấp nhận (\`accept4\`), Libuv gọi \`epoll_ctl(epfd, EPOLL_CTL_ADD, client_fd, &event)\` đúng một lần để chèn \`client_fd\` vào **Cây Đỏ-Đen \`rbr\`** với độ phức tạp \`O(log N)\`. Quan trọng hơn, Kernel gắn luôn một hàm móc phản hồi nội bộ (\`ep_poll_callback\`) vào hàng đợi chờ của chính chiếc socket đó.
3. **Bước 3 — Ngắt Phần cứng Card mạng (\`NIC DMA & Hardware Interrupt\`) đẩy thẳng vào \`Ready List\`:**
   Khi luồng chính của Node.js bước vào Pha 4 (\`Poll\`), nó gọi \`epoll_wait(epfd, events, maxevents, timeout)\`. Nếu danh sách \`rdllist\` đang trống, luồng chính nhường CPU.
   - Ngay khoảnh khắc một gói tin TCP từ Internet chạm tới cổng vật lý của Card mạng (**NIC**), bộ điều khiển **DMA (\`Direct Memory Access\`)** trên Card mạng tự động chép thẳng khung dữ liệu vào RAM của Kernel (vùng nhớ \`Ring Buffer / sk_buff\`) mà không cần phiền đến CPU.
   - Chép xong, Card mạng phát tín hiệu **Ngắt Phần cứng (\`Hardware IRQ / SoftIRQ\`)**. Trình xử lý mạng của nhân Linux xác định gói tin thuộc về \`client_fd #48210\`, lập tức kích hoạt hàm móc \`ep_poll_callback\` để **nối trực tiếp nút \`#48210\` vào danh sách liên kết \`rdllist (Ready List)\`** với chi phí **\`O(1)\`**!
   - Lúc này, hàm \`epoll_wait()\` của Libuv chỉ việc chép các phần tử có sẵn trong \`rdllist\` trả về cho không gian người dùng (\`User Space\`) mà hoàn toàn không cần đụng chạm hay duyệt qua \`99,995\` nút đang ngủ yên trên Cây Đỏ-Đen!

### 1.4 Định lượng hiệu năng Ghép kênh và Công thức tính Chi phí Quét Hệ thống

Để thấy rõ sự chênh lệch hàng nghìn lần về tiêu thụ CPU giữa mô hình quét tuyến tính cổ điển và mô hình hướng sự kiện của \`epoll\`, ta áp dụng công thức định lượng chi phí chu kỳ lệnh trên mỗi vòng Tick:

\`\`\`
Chi phí CPU mỗi vòng Poll với select/poll (Cycles_Linear) = N_total_connections × (Cost_copy_fd + Cost_kernel_scan_fd)
Chi phí CPU mỗi vòng Poll với Linux epoll (Cycles_Epoll) = K_active_events × Cost_harvest_ready_node + (0 × N_idle_connections)
Ví dụ định lượng (N = 100,000 kết nối mở, chỉ K = 20 kết nối có gói tin mới/ms, 50 cycles/FD):
-> select/poll tốn: 100,000 × 50 = 5,000,000 CPU cycles/ms (Quá tải 100% lõi CPU!) | epoll chỉ tốn: 20 × 50 = 1,000 CPU cycles/ms (Tiết kiệm 5,000 lần!)
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc cốt lõi về Ghép kênh Socket Cấp Nhân):**
> 1. **Định luật Độc lập với Kết nối Nhàn rỗi (Idle-Connection Independence Law):** Nhờ cấu trúc \`Ready List\` được nuôi trực tiếp bởi ngắt phần cứng Card mạng (\`NIC Interrupt\`), chi phí thực thi của \`epoll_wait()\` chỉ phụ thuộc vào **số lượng kết nối thực sự có gói tin mới (\`O(K_active)\`)** chứ hoàn toàn độc lập với tổng số kết nối đang mở (\`N_total\`).
> 2. **Không tốn Luồng cho Network I/O (Zero-Thread Network Multiplexing):** Toàn bộ các thao tác mạng (\`HTTP Server\`, \`TCP Client\`, \`PostgreSQL/MongoDB/Redis Socket\`, \`WebSocket\`) đều được ghép kênh trực tiếp trên 1 luồng thông qua \`epoll\` / \`kqueue\` và **tuyệt đối không sử dụng bất kỳ luồng nào trong Libuv Threadpool**.

---

# 2. RANH GIỚI PHÂN TÁCH KIẾN TRÚC: KERNEL EVENT DEMULTIPLEXER ĐỐI ĐẦU LIBUV WORKER THREADPOOL

### 2.1 Tại sao Nhân Linux không hỗ trợ \`epoll\` cho Tệp tin Đĩa (\`Regular Files\`) và \`dns.lookup\`?

Một trong những câu hỏi phân loại trình độ Kỹ sư Hệ thống sắc bén nhất là: *"Nếu \`epoll\` ưu việt như vậy, tại sao Libuv vẫn phải khởi tạo một Bể luồng C++ (\`Worker Threadpool\` gồm 4 luồng mặc định) ở phía sau lưng V8 Engine? Và tại sao đọc tệp tin (\`fs.readFile\`) lại không đưa vào \`epoll\` được?"*

Câu trả lời nằm ở giới hạn lịch sử của kiến trúc hệ điều hành POSIX/Linux đối với 4 nhóm tác vụ không thể ghép kênh sự kiện:

1. **Nhóm 1 — Mọi thao tác Hệ thống Tệp tin trên Đĩa (\`File System Operations — fs.*\`):**
   Trong thiết kế của nhân Linux truyền thống, một tệp tin thông thường trên ổ cứng (\`Regular File\` trên hệ thống tệp \`ext4\`, \`XFS\`) luôn được truy xuất thông qua tầng **Bộ nhớ Đệm Trang của Nhân (\`Kernel Page Cache\`)**.
   - Đối với nhân Linux, một tệp tin trên đĩa luôn được coi là *"luôn luôn sẵn sàng để đọc/ghi ngay lập tức"* (nếu thử gắn FD của tệp tin thường vào \`epoll_ctl\`, nhân Linux sẽ lập tức trả về lỗi **\`EPERM — Operation not permitted\`**!).
   - Tuy nhiên, trên thực tế, khi gọi \`read(file_fd)\` mà khối dữ liệu đó chưa nằm sẵn trong RAM (\`Page Cache Miss\`), nhân Linux sẽ **chặn cứng (Block)** luồng gọi hàm để chờ bộ điều khiển ổ đĩa NVMe/SSD đọc dữ liệu vật lý nạp lên RAM (mất từ \`0.1 ms\` đến vài chục \`ms\` trên đĩa mạng NFS/EBS). Nếu thực hiện lệnh \`read()\` này trên luồng chính V8, toàn bộ Event Loop sẽ bị đóng băng! Do đó, Libuv bắt buộc phải đẩy mọi lệnh \`fs.open\`, \`fs.read\`, \`fs.write\`, \`fs.stat\` sang cho các luồng phụ trong **Libuv Threadpool** chịu trận blocking thay cho luồng chính.
2. **Nhóm 2 — Phân giải Tên miền qua Thư viện C Hệ thống (\`dns.lookup\` / \`getaddrinfo\`):**
   Trong Node.js có hai cơ chế phân giải tên miền hoàn toàn khác nhau mà kỹ sư rất hay nhầm lẫn:
   - **\`dns.lookup(hostname)\` (Mặc định được dùng bởi \`http.request\`, \`axios\`, \`fetch\`, và các Database Drivers):** Hàm này gọi trực tiếp hàm \`getaddrinfo(3)\` của thư viện chuẩn \`glibc\` trên hệ điều hành để đọc tệp \`/etc/hosts\`, \`/etc/nsswitch.conf\`, và dịch vụ \`systemd-resolved\`. Vì đặc tả POSIX quy định hàm \`getaddrinfo()\` là **hàm đồng bộ chặn luồng (Synchronous Blocking Call)**, Libuv bắt buộc phải đẩy mọi lời gọi \`dns.lookup()\` vào **Libuv Threadpool**!
   - **\`dns.resolve4() / dns.resolve()\` (Thư viện \`c-ares\`):** Không đi qua \`getaddrinfo()\` của OS mà sử dụng thư viện C chuyên dụng \`c-ares\` để tự đóng gói bản tin UDP/TCP gửi thẳng tới máy chủ DNS. Vì giao tiếp qua UDP/TCP Socket, \`dns.resolve*()\` chạy hoàn toàn trên **Kernel \`epoll/kqueue\`** và không tốn một luồng nào của Threadpool (nhưng nhược điểm là nó bỏ qua tệp \`/etc/hosts\`).
3. **Nhóm 3 — Thuật toán Mật mã học Nặng bằng C++ (\`CPU-Intensive Cryptography\`):**
   Các hàm dẫn xuất khóa và sinh số ngẫu nhiên bất đồng bộ như \`crypto.pbkdf2()\`, \`crypto.scrypt()\`, \`crypto.randomBytes()\` (bản có callback), \`crypto.generateKeyPair()\` thực hiện hàng trăm nghìn vòng băm SHA-512/AES bằng mã C++ của OpenSSL. Để không làm nghẽn V8 Call Stack, Libuv chuyển giao chúng xuống **Libuv Threadpool**.
4. **Nhóm 4 — Nén và Giải nén Luồng Dữ liệu (\`Zlib Compression\`):**
   Các hàm bất đồng bộ trong module \`zlib\` (\`zlib.gzip\`, \`zlib.gunzip\`, \`zlib.deflate\`, \`zlib.brotliCompress\`) tiêu tốn rất nhiều chu kỳ CPU để tính bảng mã Huffman và cửa sổ trượt LZ77 ở tầng C++, nên cũng được thực thi bên trong **Libuv Threadpool**.

### 2.2 Bảng Phân loại Toàn diện các API của Node.js theo Tầng Thực thi Vật lý

Để thiết kế hệ thống không bị nghẽn chéo tài nguyên, kỹ sư phải nắm thuộc lòng bảng phân bổ hạ tầng thực thi dưới đây:

| Nhóm API trong Node.js / NestJS | Ví dụ Phương thức Cụ thể | Nơi Thực thi Thực tế | Tiêu thụ Luồng trong \`Libuv Threadpool\`? | Nguy cơ Gây Nghẽn nếu Gọi 1,000 Lần Đồng thời |
| :--- | :--- | :--- | :--- | :--- |
| **Giao tiếp Mạng thuần túy (\`Network Sockets\`)** | \`http.Server\`, \`fetch\`, \`net.Socket\`, \`pg\` / \`mysql2\` / \`ioredis\` queries | **OS Kernel (\`epoll\` / \`kqueue\` / \`IOCP\`)** | **Không (\`0 Threads\`)** | Chỉ tốn vài KB bộ nhớ Kernel mỗi socket; xử lý êm ru hàng chục nghìn kết nối (trừ bước \`dns.lookup\` ban đầu) |
| **Phân giải DNS Trực tiếp (\`c-ares\`)** | \`dns.resolve()\`, \`dns.resolve4()\`, \`dns.resolveSrv()\` | **OS Kernel (\`epoll\` qua UDP Socket)** | **Không (\`0 Threads\`)** | Hoàn toàn phi chặn; không bao giờ làm kẹt bể luồng của hệ thống |
| **Phân giải DNS Hệ thống (\`Libc Resolver\`)** | **\`dns.lookup()\`** (mặc định khi gọi \`axios.get('https://...')\`) | **\`Libuv Threadpool\`** (4 luồng mặc định) | **Có (Chiếm 1 luồng/lần gọi)** | **Rất nguy hiểm**: Nếu máy chủ DNS nội bộ phản hồi chậm, 4 lệnh \`dns.lookup\` sẽ khóa chết toàn bộ Threadpool! |
| **Hệ thống Tệp tin (\`File System\`)** | \`fs.promises.readFile\`, \`fs.writeFile\`, \`fs.stat\`, \`fs.createReadStream\` | **\`Libuv Threadpool\`** (4 luồng mặc định) | **Có (Chiếm 1 luồng/thao tác I/O)** | Làm đầy hàng đợi \`uv__work\`, khiến các lệnh đọc tệp cấu hình và ghi nhật ký bị xếp hàng chờ dài |
| **Mật mã học & Nén C++ (\`Crypto & Zlib\`)** | \`crypto.pbkdf2\`, \`crypto.scrypt\`, \`zlib.gzip\`, \`zlib.brotliCompress\` | **\`Libuv Threadpool\`** (4 luồng mặc định) | **Có (Chiếm giữ luồng với 100% CPU)** | Gây **Threadpool Starvation** nghiêm trọng; làm tê liệt cả \`fs.*\` lẫn \`dns.lookup()\` đang dùng chung bể luồng |
| **Xử lý Chuỗi & Dữ liệu Thuần JS (\`V8 Native\`)** | \`JSON.parse\`, \`JSON.stringify\`, \`RegExp.exec\`, \`Array.prototype.sort\` | **\`V8 Main Thread\`** (Đơn luồng trực tiếp) | **Không (\`0 Threads\`)** | **Nguy hiểm nhất**: Đóng băng trực tiếp \`V8 Call Stack\`, làm tê liệt toàn bộ 6 pha của Event Loop! |

### 2.3 Giải phẫu Kiến trúc Hàng đợi Công việc \`uv__work\` và Đường ống Báo thức \`async / eventfd\`

Làm thế nào một luồng công nhân C++ trong \`Libuv Threadpool\` sau khi băm xong mật khẩu (\`crypto.pbkdf2\`) có thể gửi kết quả quay ngược về cho \`V8 Main Thread\` mà không gây xung đột bộ nhớ (**Race Condition**)? Quy trình 5 bước cấp thấp diễn ra bên trong tệp \`src/threadpool.c\` của Libuv như sau:

1. **Bước 1 — Đóng gói Yêu cầu và Bảo vệ bằng Khóa \`Mutex\`:**
   Khi mã JavaScript gọi \`crypto.pbkdf2(...)\`, luồng chính khởi tạo một cấu trúc công việc \`struct uv__work\`, lấy khóa tương tranh toàn cục của bể luồng (\`uv_mutex_lock(&mutex)\`), đẩy con trỏ công việc vào cuối hàng đợi liên kết đôi chung (\`wq — Work Queue\`), rồi phát tín hiệu đánh thức biến điều kiện (\`uv_cond_signal(&cond)\`).
2. **Bước 2 — Luồng Công nhân C++ Thức giấc và Lấy việc:**
   Một trong 4 luồng công nhân C++ đang ngủ chờ trên \`uv_cond_wait(&cond, &mutex)\` sẽ thức dậy, rút phần tử \`uv__work\` ra khỏi đầu hàng đợi \`wq\`, nhả khóa \`mutex\` và bắt đầu chạy hàm tính toán nặng \`work_cb()\` hoàn toàn song song trên một lõi CPU vật lý khác.
3. **Bước 3 — Đẩy vào Hàng đợi Hoàn tất và Bắn Tín hiệu \`eventfd\`:**
   Khi tính toán xong, luồng công nhân C++ **tuyệt đối không được phép gọi thẳng vào V8 Engine** (vì V8 Isolate không an toàn đa luồng — *Not Thread-Safe*). Thay vào đó, luồng công nhân chèn kết quả vào hàng đợi hoàn tất \`loop->wq\` và gọi hàm **\`uv_async_send(&loop->wq_async)\`**.
4. **Bước 4 — Đánh thức \`epoll_wait\` qua Mô tả Tệp Sự kiện (\`Linux eventfd\`):**
   Bên dưới hàm \`uv_async_send\`, Libuv ghi một số nguyên \`8 bytes\` vào một File Descriptor đặc biệt của nhân Linux gọi là **\`eventfd\`** (đã được đăng ký sẵn vào Cây Đỏ-Đen của \`epoll\` từ lúc khởi tạo vòng lặp!).
5. **Bước 5 — Thu hoạch tại Pha 4 (\`Poll\`) trên Luồng chính V8:**
   Nhân Linux thấy \`eventfd\` có dữ liệu mới liền đẩy nó vào \`Ready List\`, đánh thức hàm \`epoll_wait()\` của luồng chính V8 đang chờ ở **Pha 4 (\`Poll\`)**. Luồng chính thức dậy, rút kết quả từ \`loop->wq\` và thực thi hàm callback JavaScript một cách an toàn tuyệt đối trên \`V8 Call Stack\`!

\`\`\`
Thời gian phản hồi của Tác vụ Threadpool (Total_Task_Latency_Ms) = Queue_Wait_Time_Ms + Worker_Execution_Time_Ms + Epoll_Wakeup_Overhead_Ms
Trong đó: Queue_Wait_Time_Ms = floor(Position_In_Work_Queue / UV_THREADPOOL_SIZE) × Avg_Worker_Execution_Time_Ms
Ví dụ định lượng: UV_THREADPOOL_SIZE = 4, có 12 yêu cầu pbkdf2 cùng đến (mỗi yêu cầu tốn 100 ms):
-> Đợt 1 (yêu cầu 1..4): Chờ 0 ms, xong ở 100 ms | Đợt 2 (yêu cầu 5..8): Chờ 100 ms, xong ở 200 ms | Đợt 3 (yêu cầu 9..12): Chờ 200 ms, xong ở 300 ms
\`\`\`

> **Tổng kết học thuật Phần 2 (Hai quy tắc bất biến về Bể luồng Libuv Threadpool):**
> 1. **Một Hàng đợi Chung cho Mọi Loại Việc (Single Shared FIFO Queue Invariant):** Toàn bộ các tác vụ \`fs.*\`, \`dns.lookup\`, \`crypto.*\` và \`zlib.*\` đều xếp chung vào **duy nhất một hàng đợi FIFO (\`wq\`)** của Libuv. Không có sự ưu tiên tự động nào giữa lệnh đọc tệp cấu hình nhỏ với lệnh băm mật khẩu nặng.
> 2. **Cơ chế Đồng bộ hóa qua \`eventfd\` tại Pha Poll:** Dù tác vụ chạy trên luồng C++ phụ, nhưng việc kích hoạt hàm callback JavaScript trả kết quả về **luôn luôn diễn ra tại Pha 4 (\`Poll\`)** trên luồng chính V8 thông qua tín hiệu ngắt từ \`eventfd\`.

---

# 3. CHẨN ĐOÁN TẮC NGHẼN BỂ LUỒNG (THREADPOOL STARVATION) VÀ TỐI ƯU HÓA TRÊN PRODUCTION

### 3.1 Giải phẫu Sự cố Dây chuyền: Khi \`crypto.pbkdf2\` làm Đứt Kết nối Database và HTTP Client

Trong kiến trúc Microservices thực tế, nhiều kỹ sư gặp một sự cố cực kỳ khó hiểu: *Khi có một đợt người dùng đăng nhập đồng loạt (gọi hàm băm mật khẩu), đột nhiên các API khác chỉ gọi sang dịch vụ Thanh toán qua \`axios/fetch\` hoặc mở kết nối mới tới Database lại bị lỗi \`ETIMEDOUT\` hàng loạt, mặc dù CPU của V8 Main Thread vẫn rảnh và Event Loop Lag bằng 0ms!*

Nguyên nhân gốc rễ nằm ở **Hiệu ứng Chặn Đầu Hàng Đợi trên Bể luồng Chung (\`Threadpool Head-of-Line Blocking\`)**:
1. Giả sử cấu hình mặc định \`UV_THREADPOOL_SIZE = 4\`. Khi có \`20\` người dùng gửi yêu cầu đăng nhập cùng lúc, \`20\` tác vụ \`crypto.pbkdf2\` (mỗi tác vụ mất \`150 ms\`) được đẩy vào hàng đợi \`wq\` của Libuv. \`4\` tác vụ đầu chiếm giữ toàn bộ 4 luồng C++, \`16\` tác vụ còn lại nằm xếp hàng trong \`wq\`.
2. Đúng lúc đó (\`t = 10 ms\`), một API Thanh toán gọi \`axios.post('https://payment-gateway.internal/charge')\`. Trước khi có thể mở TCP Socket (vốn dùng \`epoll\` không tốn luồng), \`axios\` phải gọi **\`dns.lookup('payment-gateway.internal')\`** để lấy địa chỉ IP!
3. Vì \`dns.lookup()\` dùng hàm \`getaddrinfo()\` trên Libuv Threadpool, yêu cầu phân giải tên miền này bị đẩy vào **vị trí thứ 21** ở cuối hàng đợi \`wq\` — phải đứng chờ cả \`20\` lệnh băm mật khẩu chạy xong (mất \`5 × 150 ms = 750 ms\`) mới tới lượt lấy được địa chỉ IP! Tương tự, mọi lệnh \`fs.readFile\` đọc chứng chỉ TLS hay mẫu email cũng bị đóng băng theo.

### 3.2 Đối chiếu Mã nguồn Thực thi và Truy vết Trạng thái Bể luồng

Hãy đối chiếu hai thiết kế dịch vụ Xác thực và Gọi cổng thanh toán dưới đây để thấy cách cô lập hạn ngạch luồng (**Bulkhead / Concurrency Semaphore**) và loại bỏ sự phụ thuộc của \`dns.lookup\` vào Threadpool:

\`\`\`typescript
// File: src/modules/auth/auth-gateway-orchestrator.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Để Crypto làm ngập toàn bộ 4 luồng khiến dns.lookup và fs bị chết đói
@Injectable()
export class AuthGatewayBrokenService {
  async loginAndFetchProfile(password: string, salt: string, templatePath: string): Promise<string> {
    // LỖI 1: Không giới hạn số lượng pbkdf2 chạy đồng thời -> 4 yêu cầu là chiếm sạch 100% Threadpool!
    const derivedKey = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
        if (err) return reject(err);
        resolve(key.toString('hex'));
      });
    });

    // LỖI 2: Khi có 20 người đang login, lệnh đọc file này phải xếp hàng ở cuối hàng đợi wq!
    const banner = await fs.promises.readFile(templatePath, 'utf8');
    return \`\${derivedKey.slice(0, 8)}:\${banner.length}\`;
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION BULKHEAD): Giới hạn hạn ngạch Crypto để luôn chừa luồng trống cho FS/DNS
@Injectable()
export class AuthGatewaySafeService {
  // Với UV_THREADPOOL_SIZE = 8, khóa hạn ngạch Crypto tối đa 5 luồng -> Luôn dành riêng 3 luồng cho FS & DNS!
  private readonly maxCryptoConcurrency = 5;
  private activeCryptoCount = 0;
  private readonly waitQueue: Array<() => void> = [];

  async loginAndFetchProfile(password: string, salt: string, templatePath: string): Promise<string> {
    await this.acquireCryptoSlot();
    let derivedKey = '';
    try {
      derivedKey = await new Promise<string>((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, key) => {
          if (err) return reject(err);
          resolve(key.toString('hex'));
        });
      });
    } finally {
      this.releaseCryptoSlot();
    }

    // Nhờ luôn còn 3 luồng trống trong Libuv Threadpool, thao tác đọc file và dns.lookup đi qua tức thì!
    const banner = await fs.promises.readFile(templatePath, 'utf8');
    return \`\${derivedKey.slice(0, 8)}:\${banner.length}\`;
  }

  private acquireCryptoSlot(): Promise<void> {
    if (this.activeCryptoCount < this.maxCryptoConcurrency) {
      this.activeCryptoCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.waitQueue.push(resolve));
  }

  private releaseCryptoSlot(): void {
    const nextResolver = this.waitQueue.shift();
    if (nextResolver) {
      nextResolver();
    } else {
      this.activeCryptoCount--;
    }
  }
}
\`\`\`

Bảng dưới đây truy vết trạng thái của 4 luồng công nhân Libuv (\`Worker #1..#4\`) và hàng đợi \`wq\` khi hệ thống nhận đồng thời \`8\` yêu cầu \`pbkdf2\` (mỗi yêu cầu tốn \`100 ms\`) và tại \`t = 5 ms\` có \`1\` yêu cầu \`dns.lookup\` (tốn \`2 ms\`) đi vào:

| Mốc thời gian | Sự kiện đi vào Hệ thống | Trạng thái ở \`BrokenService\` (Không giới hạn) | Trạng thái ở \`SafeService\` (Giới hạn tối đa 2 luồng cho Crypto trên Pool 4) | Độ trễ của lệnh \`dns.lookup\` (2ms) |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | \`8\` yêu cầu \`pbkdf2\` (\`C1..C8\`) đến cùng lúc | \`W1..W4\` bị chiếm kín bởi \`C1..C4\`; hàng đợi Libuv \`wq = [C5, C6, C7, C8]\` | \`W1, W2\` chạy \`C1, C2\`; **\`W3, W4\` được giữ trống**; \`C3..C8\` chờ ở mảng JS \`waitQueue\` | Chưa phát sinh truy vấn DNS |
| **\`t = 5 ms\`** | Yêu cầu thanh toán gọi \`dns.lookup()\` | Bị đẩy vào cuối hàng đợi Libuv: \`wq = [C5, C6, C7, C8, DNS_REQ]\` | Đi thẳng vào luồng trống **\`W3\`** của Libuv ngay lập tức mà không phải chờ! | \`Broken\`: Đang kẹt cứng; \`Safe\`: Đang thực thi trên \`W3\` |
| **\`t = 7 ms\`** | Luồng \`W3\` xử lý xong \`2 ms\` của DNS | \`W1..W4\` vẫn đang băm mật khẩu đợt 1 (\`C1..C4\`) | **\`DNS_REQ\` hoàn tất sau đúng \`2 ms\`**, mở tiếp kết nối TCP qua \`epoll\`! | \`SafeService\` hoàn thành DNS ở \`t = 7 ms\` (Độ trễ chờ = \`0 ms\`) |
| **\`t = 100 ms\`** | Đợt \`pbkdf2\` đầu tiên hoàn thành | \`W1..W4\` lấy tiếp \`C5..C8\` từ \`wq\` ra chạy; \`DNS_REQ\` vẫn đứng chờ ở đầu hàng đợi! | \`W1, W2\` lấy tiếp \`C3, C4\` từ \`waitQueue\` xuống chạy | \`Broken\`: \`DNS_REQ\` đã bị giam cầm oan uổng suốt \`95 ms\` |
| **\`t = 202 ms\`** | Đợt \`pbkdf2\` thứ hai hoàn thành | Lúc này \`W1\` mới lấy \`DNS_REQ\` ra chạy và xong ở \`t = 202 ms\` | Toàn bộ các truy vấn DNS và \`fs.readFile\` khác đều đã hoàn tất từ lâu | \`BrokenService\` làm tăng độ trễ DNS từ \`2 ms\` lên **\`197 ms\` (Chậm gấp 98 lần!)** |

### 3.3 Quy tắc Tinh chỉnh \`UV_THREADPOOL_SIZE\` và Bảng Chẩn đoán Sự cố Production

Để cấu hình và vận hành bể luồng Libuv chuẩn xác trên môi trường Container/Kubernetes, kỹ sư bắt buộc phải tuân thủ 3 quy tắc kỹ thuật sau:

1. **Thời điểm Khởi tạo Bất biến của \`UV_THREADPOOL_SIZE\`:**
   Hàm \`init_threads()\` trong tệp \`src/threadpool.c\` của Libuv chỉ đọc biến môi trường \`UV_THREADPOOL_SIZE\` **đúng một lần duy nhất** khi tác vụ đầu tiên dùng Threadpool được gọi (thường xảy ra ngay trong quá trình bootstrap của Node.js trước khi vào hàm \`bootstrap()\` của \`main.ts\`).
   - Do đó, việc gán \`process.env.UV_THREADPOOL_SIZE = '16'\` bên trong mã nguồn TypeScript của NestJS thường **vô tác dụng hoàn toàn** nếu trước đó đã có bất kỳ module nào đọc tệp cấu hình hoặc phân giải DNS.
   - **Cách cấu hình chuẩn duy nhất:** Khai báo trực tiếp ở cấp độ biến môi trường của Container / Shell trước khi khởi chạy binary \`node\`: \`UV_THREADPOOL_SIZE=16 node dist/main.js\` (Giá trị hợp lệ từ \`1\` đến tối đa **\`1024\`**; mặc định là **\`4\`**).
2. **Định cỡ theo Bản chất Tác vụ (CPU-bound C++ đối đầu I/O-bound Blocking):**
   Không được tăng mù quáng \`UV_THREADPOOL_SIZE=128\` cho mọi dịch vụ!
   - Nếu bể luồng chủ yếu chạy **Tác vụ I/O chờ đợi (\`fs.readFile\` trên đĩa mạng hoặc \`dns.lookup\`)**: Các luồng chủ yếu nằm ngủ chờ Kernel trả dữ liệu mà không đốt CPU. Lúc này, có thể đặt \`UV_THREADPOOL_SIZE\` ở mức **\`16 – 64\`** kể cả trên Container chỉ có \`2 – 4 vCPU\`.
   - Ngược lại, nếu bể luồng chủ yếu chạy **Tác vụ đốt CPU 100% (\`crypto.pbkdf2\`, \`crypto.scrypt\`, \`zlib.brotliCompress\`)**: Nếu Container chỉ được cấp **\`4 vCPU\`** mà đặt \`UV_THREADPOOL_SIZE = 64\`, cả 64 luồng C++ sẽ tranh giành 4 lõi vật lý, làm bùng nổ chi phí **Chuyển đổi Ngữ cảnh (\`OS Thread Context Switching\`)** và xóa sạch bộ nhớ đệm L1/L2 Cache (**CPU Thrashing**), khiến tổng thông lượng giảm sụt thảm hại! Với tác vụ nặng CPU, tổng số luồng hoạt động không bao giờ được vượt quá số lõi \`vCPU\` vật lý được cấp phát.

Bảng dưới đây tổng hợp các triệu chứng nghẽn tầng Kernel/Threadpool trên Production và giải pháp khắc phục triệt để:

| Triệu chứng quan sát trên Hệ thống | Công cụ / Lệnh Chẩn đoán Cấp thấp | Dấu hiệu Nhận diện Kỹ thuật | Nguyên nhân Gốc rễ (\`Root Cause\`) | Giải pháp Kiến trúc Chuẩn Production |
| :--- | :--- | :--- | :--- | :--- |
| **Lỗi \`getaddrinfo EAI_AGAIN\` hoặc \`ETIMEDOUT\` hàng loạt khi gọi API ngoài dù mạng tốt** | Theo dõi thời gian phân giải DNS qua \`perf_hooks\` hoặc \`strace -f -e trace=network\` | Bước \`dnsLookup\` trên HTTP Agent vọt từ \`1 ms\` lên \`500 ms – 2,000 ms\` | \`dns.lookup()\` bị nghẽn trong \`Libuv Threadpool\`4 luồng do cạnh tranh với \`fs.*\` hoặc \`crypto.*\` | Tích hợp bộ đệm DNS trong bộ nhớ (**\`cacheable-lookup\`**), bật \`keepAlive: true\` trên \`http.Agent\`, và tăng \`UV_THREADPOOL_SIZE=16\` |
| **Event Loop Lag = \`0 ms\` nhưng các lệnh \`fs.readFile\` và \`bcrypt/pbkdf2\` phản hồi cực chậm** | Chạy \`ps -T -p <pid>\` hoặc dùng \`clinic bubbleprof\` phân tích độ trễ I/O | Tất cả 4 luồng \`node\` worker đều ở trạng thái \`R (Running 100%)\` hoặc \`D (Uninterruptible Disk Sleep)\` | Toàn bộ 4 luồng của \`Libuv Threadpool\` đã bị bão hòa bởi các tác vụ kéo dài | Áp dụng **Semaphore Bulkhead** giới hạn số tác vụ Crypto đồng thời và tách sang \`Worker Threads\` chuyên dụng |
| **Gán \`process.env.UV_THREADPOOL_SIZE = '32'\` trong \`main.ts\` nhưng hệ thống vẫn chỉ chạy 4 luồng** | Kiểm tra số luồng hệ điều hành thực tế bằng \`ls /proc/<pid>/task \| wc -l\` | Tổng số luồng của tiến trình vẫn giữ nguyên ở mức \`11\` (1 Main + 4 V8 Background + 4 Libuv + 1 Watchdog...) | Biến môi trường được gán sau khi Libuv đã gọi \`uv_once(&once, init_threads)\` ở bước nạp module | Chuyển cấu hình ra biến môi trường của Kubernetes Deployment YAML (\`env: [{ name: "UV_THREADPOOL_SIZE", value: "16" }]\`) |
| **Lỗi \`EMFILE: too many open files\` hoặc \`ENFILE\` khi chạm ngưỡng 1,024 kết nối WebSocket** | Kiểm tra giới hạn tiến trình qua \`cat /proc/<pid>/limits\` và \`lsof -p <pid>\` | Giới hạn \`Max open files (ulimit -n)\` đang để mặc định là \`1024\` FD | Nhân Linux từ chối cấp phát File Descriptor mới cho \`accept4()\` hoặc \`fs.open()\` | Nâng giới hạn \`nofile\` trong cấu hình Container/Systemd lên **\`65,535\` – \`1,048,576\`** và kiểm tra rò rỉ \`FileHandle\` quên đóng |
| **Tăng \`UV_THREADPOOL_SIZE=128\` trên Pod \`2 vCPU\` khiến thời gian băm mật khẩu chậm hơn gấp đôi** | Giám sát chỉ số \`system.cpu.context_switches\` và \`vmstat 1\` (cột \`cs\`) | Hàng trăm nghìn lần chuyển đổi ngữ cảnh (\`Context Switches\`) mỗi giây; \`System CPU %\` tăng cao | 128 luồng C++ chạy thuật toán \`pbkdf2\` tranh chấp 2 lõi CPU vật lý gây hiện tượng **CPU Thrashing** | Giảm \`UV_THREADPOOL_SIZE\` về sát số lõi \`vCPU\` (ví dụ \`4\` hoặc \`8\`) và kiểm soát hàng đợi ở tầng ứng dụng |

> **Tổng kết học thuật Phần 3 (Quy tắc Vàng tối ưu hóa HTTP Client và Database Connection trong NestJS):**
> Trong mọi dịch vụ NestJS giao tiếp qua HTTP/HTTPS nội bộ, bắt buộc phải khởi tạo \`http.Agent({ keepAlive: true, maxSockets: 100 })\` kết hợp bộ nhớ đệm phân giải tên miền (\`DNS Caching\`). Việc tái sử dụng kết nối TCP (\`Keep-Alive\`) không chỉ bỏ qua bước bắt tay 3 bước (\`TCP 3-Way Handshake + TLS Handshake\`) mà quan trọng hơn cả là **loại bỏ hoàn toàn lời gọi \`dns.lookup()\` trên mỗi request**, giải phóng vĩnh viễn Libuv Threadpool khỏi nguy cơ tắc nghẽn tên miền!

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống I/O Từ Node.js Xuống Nhân Linux (Kernel Multiplexing & Threadpool Taxonomy Map)
\`\`\`diagram
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (NODE.JS & NESTJS RUNTIME API LAYER)     │
│    [ Network I/O (http, net, pg, redis) ] ◄───► [ Blocking APIs (fs, crypto) ]│
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Phân luồng điều phối bên trong thư viện C++ Libuv
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG ĐIỀU PHỐI BẤT ĐỒNG BỘ LIBUV (LIBUV SUBSYSTEM ROUTING LAYER)           │
│    ├── Nhánh Phi chặn (0 Threads): Đăng ký thẳng Socket FD với OS Multiplexer │
│    ├── Nhánh Bể luồng (Worker Pool 4-1024 Threads): Chạy fs.*, dns.lookup     │
│    └── Cơ chế Báo thức (eventfd / uv_async_t): Báo tin từ Worker về Pha Poll  │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Giao tiếp System Calls qua ranh giới User/Kernel
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG NHÂN HỆ ĐIỀU HÀNH & PHẦN CỨNG (LINUX KERNEL & NIC HARDWARE LAYER)     │
│    ├── Linux epoll (eventpoll): Cây Đỏ-Đen O(log N) & Ready List O(1)         │
│    ├── NIC DMA & Hardware Interrupt: Chép gói tin vào RAM & đánh thức epoll   │
│    └── Kernel Page Cache & NVMe Driver: Xử lý đọc/ghi khối đĩa cho Threadpool │
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Cơ Chế Ghép Kênh Mạng (Linear Scan select/poll vs Event-Driven Linux epoll)
\`\`\`diagram
MÔ HÌNH CŨ: QUÉT TUYẾN TÍNH MẢNG SOCKET (SELECT / POLL O(N) LINEAR SCAN)
Mỗi vòng Tick ──► [ Copy 50,000 FD xuống Kernel ] ──► [ Quét tuần tự 1..50,000 ] ──► CHÁY 100% CPU
50,000 Kết nối (chỉ 10 socket có tin mới) = Vẫn phải kiểm tra vô ích 49,990 socket đang rảnh rỗi.

MÔ HÌNH HIỆN ĐẠI: ĐÁNH THỨC HƯỚNG SỰ KIỆN QUA NGẮT PHẦN CỨNG (LINUX EPOLL O(1) READY LIST)
Gói tin đến NIC ──┐
DMA chép vào RAM ─┼──► [ Ngắt IRQ đẩy FD vào Ready List ] ──► epoll_wait() lấy đúng 10 FD trong O(1)
Báo ep_callback ──┘                    │
                                       └──► Không quét socket rảnh ────► Phục vụ >100,000 kết nối nhẹ nhàng
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Phân Loại Tác Vụ I/O & Cấu Hình Libuv Threadpool Trên Production)
\`\`\`diagram
                   TÁC VỤ BẤT ĐỒNG BỘ TRONG BACKEND NODE.JS THUỘC NHÓM HẠ TẦNG NÀO?
                                                   │
                                                   ▼
                          Tác vụ có được nhân OS hỗ trợ ghép kênh sự kiện trực tiếp không?
                          /                                                       \\
        CÓ: GIAO TIẾP MẠNG (TCP/HTTP/DB/REDIS/C-ARES)             KHÔNG: TỆP TIN (FS), DNS.LOOKUP, CRYPTO, ZLIB
                      /                                                                       \\
                     ▼                                                                         ▼
    [ THUẦN KERNEL EPOLL / KQUEUE (TỐI ƯU) ]                        Bản chất của tác vụ chạy trên Libuv Threadpool là gì?
    - Chiếm 0 luồng trong Libuv Threadpool                          /                                                   \\
    - Bật HTTP Keep-Alive & DNS Cache để tránh dns.lookup    CHỜ ĐĨA / MẠNG (FS.*, DNS.LOOKUP)                ĐỐT 100% CPU (PBKDF2, SCRYPT, ZLIB)
    - Tăng giới hạn ulimit -n lên >= 65,535 FDs                     /                                                     \\
                                                                   ▼                                                       ▼
                                                  [ TĂNG UV_THREADPOOL_SIZE=16..64 (CHUẨN) ]             [ GIỚI HẠN SEMAPHORE <= SỐ VCPU (CHUẨN) ]
                                                  - Đặt biến môi trường trước khi chạy tiến trình        - Tránh đặt Pool quá lớn gây CPU Thrashing
                                                  - Dùng Stream cho tệp lớn để bảo vệ bộ nhớ RAM         - Chừa luồng trống trong Pool cho FS và DNS
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Các Phương Án Xử Lý I/O & Tác Vụ Nền Trong Node.js)

| Tiêu Chí So Sánh | Kernel \`epoll\` / \`kqueue\` (Network I/O) | \`Libuv Threadpool\` Mặc định (\`Size = 4\`) | \`Libuv Threadpool\` Mở rộng (\`Size = 16 – 64\`) | \`Worker Threads\` Cô lập (Dành cho CPU-bound) |
| :--- | :--- | :--- | :--- | :--- |
| **Cơ chế vận hành cốt lõi** | Quản lý FD bằng Cây Đỏ-Đen và thu hoạch sự kiện qua \`Ready List\` ở Pha 4 (\`Poll\`) | 4 luồng C++ chia sẻ chung 1 hàng đợi \`wq\` cho \`fs\`, \`dns.lookup\`, \`crypto\`, \`zlib\` | Mở rộng số luồng C++ thông qua biến môi trường khởi động \`UV_THREADPOOL_SIZE\` | Khởi tạo các V8 Isolate độc lập chạy mã JS/WASM song song trên các lõi CPU riêng |
| **Chi phí tài nguyên bộ nhớ & CPU** | Cực thấp (\`~vài KB\` bộ nhớ Kernel cho mỗi kết nối socket; \`O(1)\` CPU) | Rất thấp (\`~8 MB\` vùng nhớ Stack cho 4 luồng hệ điều hành) | Trung bình (\`~32 MB – 128 MB\` Stack); có nguy cơ **Context Switch** nếu chạy việc nặng CPU | Cao (\`~20 MB – 40 MB\` V8 Heap cho mỗi Worker Isolate); cần quản lý bằng Worker Pool |
| **Điểm nghẽn chí mạng (\`Bottleneck\`)** | Chỉ bị giới hạn bởi băng thông Card mạng và trần File Descriptor (\`ulimit -n\`) | **Dễ bị bão hòa hoàn toàn** chỉ bởi 4 tác vụ băm mật khẩu hoặc 4 truy vấn DNS bị treo | Không tách biệt được hàng đợi ưu tiên giữa tác vụ \`crypto\` nặng với tác vụ \`fs\` nhẹ | Chi phí tuần tự hóa dữ liệu qua \`MessagePort\` nếu không dùng \`SharedArrayBuffer\` |
| **Khuyến nghị Kiến trúc Production** | Luôn kết hợp \`keepAlive\` và \`dns.resolve\` / bộ đệm DNS để giữ luồng thuần \`epoll\` | Chỉ phù hợp cho dịch vụ ít đọc ghi tệp tin và không băm mật mã nặng | Khuyên dùng ở mức \`16 – 32\` cho các dịch vụ xử lý nhiều tệp tin (\`fs\`) trên ổ đĩa mạng | Tách riêng mọi thuật toán nặng hoặc áp dụng **Bulkhead Semaphore** để bảo vệ Libuv Pool |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`ThreadpoolBulkheadGuardService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Độ phức tạp \`O(1)\` của Linux \`epoll\` (\`Epoll Event-Driven Complexity Invariant\`):** Khác với \`select()\` và \`poll()\` phải sao chép và quét tuyến tính toàn bộ mảng \`N\` kết nối ở mỗi vòng lặp (\`O(N)\`), \`epoll\` lưu danh bạ FD lâu dài trong nhân bằng **Cây Đỏ-Đen (\`O(log N)\`)** và nhờ ngắt phần cứng Card mạng đẩy thẳng các socket có dữ liệu vào **\`Ready List\`**, giúp Pha \`Poll\` của Libuv thu hoạch sự kiện mạng với chi phí **\`O(1)\`** bất chấp hàng trăm nghìn kết nối đang nhàn rỗi.
2. **Định đề Phân tách Hạ tầng Bất đồng bộ (\`Kernel vs Threadpool Dichotomy Invariant\`):** Không phải mọi hàm bất đồng bộ trong Node.js đều dùng chung một cơ chế. Mọi giao tiếp mạng (\`TCP\`, \`UDP\`, \`HTTP\`, \`Database/Redis Socket\`, \`dns.resolve\`) đều chạy hoàn toàn phi chặn trên **Kernel \`epoll/kqueue\` (0 luồng)**; ngược lại, mọi thao tác tệp tin (\`fs.*\`), phân giải tên miền hệ thống (**\`dns.lookup\`**), mật mã học (\`crypto.pbkdf2/scrypt\`) và nén (\`zlib.*\`) đều bắt buộc phải xếp hàng chạy trên **\`Libuv Worker Threadpool\`**.
3. **Định đề Bất biến Khởi tạo và Định cỡ \`UV_THREADPOOL_SIZE\` (\`Threadpool Bootstrap & Sizing Invariant\`):** Kích thước bể luồng Libuv (mặc định \`4\`, tối đa \`1024\`) được khóa cứng ở tầng C++ ngay khi khởi tạo, nên biến môi trường \`UV_THREADPOOL_SIZE\` bắt buộc phải được truyền từ tiến trình cha/Container trước khi khởi chạy Node.js. Việc tăng kích thước bể luồng chỉ giúp tăng thông lượng cho các tác vụ chờ I/O (\`fs\`, \`dns.lookup\`), nhưng nếu tăng vượt quá số lõi \`vCPU\` cho các tác vụ đốt CPU (\`crypto\`, \`zlib\`) sẽ gây phản tác dụng do hiện tượng **CPU Context Switching Thrashing**.
4. **Định đề Vách ngăn Chống Đói Chéo Bể luồng (\`Threadpool Bulkhead Isolation Invariant\`):** Vì Libuv chỉ duy trì duy nhất một hàng đợi FIFO chung cho cả \`crypto\`, \`zlib\`, \`fs\` và \`dns.lookup\`, một đợt tăng đột biến các tác vụ băm mật khẩu hoặc nén dữ liệu sẽ chiếm sạch toàn bộ luồng và làm tê liệt khả năng phân giải tên miền hoặc đọc tệp của hệ thống. Kỹ sư bắt buộc phải áp dụng **Hạn ngạch Đồng thời (\`Concurrency Semaphore\`)** ở tầng ứng dụng để luôn giữ lại các luồng dự phòng rảnh rỗi cho các thao tác I/O thiết yếu.
  `,
  realCodeSnippet: `// File: src/infrastructure/concurrency/threadpool-bulkhead-guard.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Hệ Thống Vách Ngăn (Bulkhead) Bảo Vệ Libuv Threadpool Khỏi Bão Hòa Chéo
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'node:crypto';

export interface ThreadpoolBudgetSnapshot {
  readonly configuredPoolSize: number;
  readonly reservedIoThreads: number;
  readonly maxCryptoConcurrency: number;
  readonly activeCryptoTasks: number;
  readonly queuedCryptoTasks: number;
  readonly availableIoHeadroom: number;
}

/**
 * Dịch vụ Quản trị Vách ngăn Bể luồng Libuv (ADR-0029):
 * - Ngăn chặn các tác vụ CPU-bound C++ (pbkdf2, scrypt, zlib) chiếm trọn 100% số luồng trong Libuv Threadpool.
 * - Luôn bảo toàn tối thiểu 25% số luồng (ít nhất 1-2 luồng) hoàn toàn rảnh rỗi để phục vụ tức thì
 *   các lời gọi fs.* và dns.lookup() của Database/HTTP Client, triệt tiêu lỗi EAI_AGAIN / ETIMEDOUT.
 */
@Injectable()
export class ThreadpoolBulkheadGuardService implements OnModuleInit {
  private readonly logger = new Logger(ThreadpoolBulkheadGuardService.name);
  private readonly configuredPoolSize: number;
  private readonly reservedIoThreads: number;
  private readonly maxCryptoConcurrency: number;
  private readonly maxQueueCapacity = 500;

  private activeCryptoTasks = 0;
  private readonly pendingResolvers: Array<() => void> = [];

  constructor() {
    const rawEnvSize = Number.parseInt(process.env.UV_THREADPOOL_SIZE ?? '4', 10);
    this.configuredPoolSize = Number.isFinite(rawEnvSize) && rawEnvSize >= 1 ? Math.min(rawEnvSize, 1024) : 4;
    this.reservedIoThreads = Math.max(1, Math.ceil(this.configuredPoolSize * 0.25));
    this.maxCryptoConcurrency = Math.max(1, this.configuredPoolSize - this.reservedIoThreads);
  }

  public onModuleInit(): void {
    this.logger.log(
      \`Khởi tạo Bulkhead Guard: PoolSize=\${this.configuredPoolSize}, MaxCrypto=\${this.maxCryptoConcurrency}, ReservedForFS/DNS=\${this.reservedIoThreads}\`,
    );
  }

  public async deriveKeyProtected(password: string, salt: string, iterations = 120000): Promise<string> {
    if (!password || !salt || iterations <= 0) {
      throw new Error('INVALID_PBKDF2_PARAMETERS');
    }

    await this.acquireBulkheadSlot();
    try {
      return await new Promise<string>((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, 64, 'sha512', (err, derivedKey) => {
          if (err) {
            return reject(err);
          }
          resolve(derivedKey.toString('hex'));
        });
      });
    } finally {
      this.releaseBulkheadSlot();
    }
  }

  public getBudgetSnapshot(): ThreadpoolBudgetSnapshot {
    return {
      configuredPoolSize: this.configuredPoolSize,
      reservedIoThreads: this.reservedIoThreads,
      maxCryptoConcurrency: this.maxCryptoConcurrency,
      activeCryptoTasks: this.activeCryptoTasks,
      queuedCryptoTasks: this.pendingResolvers.length,
      availableIoHeadroom: this.configuredPoolSize - this.activeCryptoTasks,
    };
  }

  private acquireBulkheadSlot(): Promise<void> {
    if (this.activeCryptoTasks < this.maxCryptoConcurrency) {
      this.activeCryptoTasks++;
      return Promise.resolve();
    }
    if (this.pendingResolvers.length >= this.maxQueueCapacity) {
      throw new Error('CRYPTO_BULKHEAD_QUEUE_OVERFLOW');
    }
    return new Promise<void>((resolve) => {
      this.pendingResolvers.push(resolve);
    });
  }

  private releaseBulkheadSlot(): void {
    const nextTask = this.pendingResolvers.shift();
    if (nextTask) {
      nextTask();
    } else {
      this.activeCryptoTasks--;
    }
  }
}`,
  quiz: [
    {
      id: 'c2-l2-q1',
      question: 'Vì sao cơ chế Linux epoll vượt trội hơn hẳn các system call thế hệ cũ như select() hay poll() khi máy chủ phải duy trì hàng chục nghìn kết nối mạng đồng thời?',
      options: [
        'Vì epoll tự động nén toàn bộ các gói tin TCP ngay tại bộ vi xử lý của Card mạng vật lý (NIC) trước khi sao chép dữ liệu thông qua kênh DMA vào không gian bộ nhớ RAM của nhân hệ điều hành.',
        'Vì epoll tự động khởi tạo một luồng hệ điều hành riêng biệt cho từng File Descriptor được mở, giúp tận dụng tối đa khả năng xử lý song song đa nhân của các bộ vi xử lý máy chủ hiện đại.',
        'Vì epoll lưu danh bạ FD bằng Cây Đỏ-Đen trong Kernel và nhờ ngắt phần cứng đẩy các socket có dữ liệu vào Ready List để thu hoạch trong O(1), thay vì quét tuyến tính O(N) qua toàn bộ mảng.',
        'Vì epoll bỏ qua hoàn toàn tầng kiểm tra bảo mật của Kernel Space và cho phép mã JavaScript trong V8 Engine đọc trực tiếp dữ liệu từ cáp quang mạng mà không cần dùng tới File Descriptor.'
      ],
      correctIndex: 2,
      explanation: 'Với select() và poll(), ở mỗi vòng lặp ứng dụng đều phải truyền toàn bộ danh sách N socket xuống Kernel để duyệt tuyến tính O(N) tìm socket có dữ liệu. Ngược lại, epoll duy trì Cây Đỏ-Đen lâu dài trong Kernel và sử dụng callback từ ngắt phần cứng Card mạng để đẩy riêng những socket thực sự có gói tin mới vào Ready List, giúp epoll_wait trả kết quả về trong thời gian O(1).'
    },
    {
      id: 'c2-l2-q2',
      question: 'Những nhóm tác vụ bất đồng bộ nào sau đây trong Node.js bắt buộc phải được chuyển giao (offload) sang chạy trên Libuv Worker Threadpool thay vì dùng cơ chế ghép kênh epoll/kqueue của Kernel?',
      options: [
        'Tiếp nhận kết nối HTTP/HTTPS mới từ người dùng, đọc ghi dữ liệu qua TCP Socket với cơ sở dữ liệu PostgreSQL/Redis và duy trì kênh truyền tin hai chiều liên tục cho WebSocket.',
        'Thao tác đọc/ghi tệp tin trên ổ đĩa (fs.*), phân giải tên miền qua hàm dns.lookup(), các hàm băm mật mã nặng (crypto.pbkdf2, scrypt) và các thuật toán nén dữ liệu (zlib.*).',
        'Phân tích cú pháp chuỗi JSON.parse(), tuần tự hóa đối tượng JSON.stringify(), kiểm tra khớp biểu thức chính quy RegExp và sắp xếp mảng lớn trực tiếp trong bộ nhớ V8 Heap.',
        'Các hàm điều phối hàng đợi ưu tiên cao như process.nextTick(), Promise.resolve().then(), queueMicrotask() và quản lý các bộ hẹn giờ setTimeout() bên trong cấu trúc pha Timers.'
      ],
      correctIndex: 1,
      explanation: 'Nhân Linux truyền thống không hỗ trợ ghép kênh epoll phi chặn cho các tệp tin thông thường trên đĩa (regular files) và hàm phân giải tên miền hệ thống getaddrinfo() của dns.lookup() là hàm đồng bộ chặn luồng. Do đó, Libuv bắt buộc phải đẩy fs.*, dns.lookup(), cùng các tác vụ tính toán C++ nặng như crypto.pbkdf2/scrypt và zlib.* sang chạy trên Libuv Threadpool (mặc định 4 luồng).'
    },
    {
      id: 'c2-l2-q3',
      question: 'Nếu một kỹ sư viết câu lệnh process.env.UV_THREADPOOL_SIZE = "32" bên trong hàm bootstrap() của tệp main.ts sau khi ứng dụng NestJS đã nạp cấu hình và khởi tạo kết nối, kết quả thực tế tại runtime sẽ như thế nào?',
      options: [
        'Không có tác dụng mở rộng bể luồng nếu trước đó bất kỳ thao tác fs hoặc dns.lookup nào đã kích hoạt hàm init_threads() khóa cứng kích thước bể luồng ở mức mặc định là 4.',
        'Libuv Threadpool lập tức khởi tạo thêm 28 luồng công nhân C++ mới ngay tại thời điểm thực thi câu lệnh gán và tự động phân bổ lại các tác vụ đang xếp hàng trong hàng đợi.',
        'Node.js lập tức ném ra ngoại lệ bảo mật ERR_IMMUTABLE_ENV_VARIABLE và buộc tiến trình phải dừng hoạt động khẩn cấp để ngăn chặn việc thay đổi cấu trúc luồng khi đang chạy.',
        'Kích thước bể luồng được nâng lên 32 luồng nhưng chỉ có hiệu lực cho các tác vụ mã hóa crypto, trong khi các tác vụ đọc ghi tệp tin fs vẫn bị giới hạn ở mức 4 luồng cũ.'
      ],
      correctIndex: 0,
      explanation: 'Trong mã nguồn C của Libuv (src/threadpool.c), bể luồng được khởi tạo đúng một lần duy nhất thông qua cơ chế uv_once(&once, init_threads) ngay khi tác vụ đầu tiên cần tới Threadpool được gọi. Việc gán process.env.UV_THREADPOOL_SIZE bên trong code JS sau khi tiến trình đã khởi chạy và nạp module là quá muộn; biến này bắt buộc phải được truyền từ môi trường shell/Container trước khi khởi chạy node.'
    },
    {
      id: 'c2-l2-q4',
      question: 'Tại sao khi hệ thống đang xử lý đồng thời 20 yêu cầu băm mật khẩu bằng crypto.pbkdf2() (với UV_THREADPOOL_SIZE = 4 mặc định), một yêu cầu HTTP Client gọi ra dịch vụ bên ngoài qua axios/fetch lại có nguy cơ bị treo và lỗi ETIMEDOUT?',
      options: [
        'Vì hàm crypto.pbkdf2() khóa chặt toàn bộ khung ngăn xếp Call Stack của luồng chính V8 Engine khiến vòng lặp sự kiện không thể tiến vào pha Poll để gửi các gói tin mạng đi ra ngoài.',
        'Vì các hàm của thư viện mật mã OpenSSL tự động bật tường lửa cấp độ nhân hệ điều hành để tạm khóa toàn bộ các cổng mạng TCP trong suốt quá trình thực hiện sinh khóa dẫn xuất.',
        'Vì trước khi mở kết nối TCP, axios/fetch phải gọi dns.lookup() để phân giải tên miền; tác vụ dns.lookup() này bị xếp vào cuối hàng đợi chung của Libuv Threadpool sau cả 20 lệnh pbkdf2.',
        'Vì 20 yêu cầu băm mật khẩu làm tràn hoàn toàn phân vùng Young Generation của V8 Heap, buộc trình biên dịch tối ưu TurboFan phải hủy bỏ toàn bộ các kết nối mạng đang đứng chờ.'
      ],
      correctIndex: 2,
      explanation: 'Mặc dù bản thân việc truyền nhận dữ liệu qua socket HTTP dùng epoll không tốn luồng nào trong Threadpool, nhưng bước đầu tiên khi gọi một tên miền mới là phân giải DNS qua hàm mặc định dns.lookup(). Vì dns.lookup() dùng chung hàng đợi FIFO của Libuv Threadpool với crypto.pbkdf2(), khi 4 luồng đã bị 20 tác vụ crypto chiếm giữ, truy vấn DNS bị chặn ở cuối hàng đợi gây ra hiện tượng Head-of-Line Blocking và dẫn tới ETIMEDOUT.'
    },
    {
      id: 'c2-l2-q5',
      question: 'Nguyên nhân kỹ thuật cốt lõi nào khiến nhân hệ điều hành Linux truyền thống không cho phép đăng ký File Descriptor của một tệp tin đĩa thông thường (Regular File) vào cơ chế ghép kênh epoll?',
      options: [
        'Vì các tệp tin trên ổ cứng SSD/NVMe luôn được mã hóa phần cứng ở tầng điều khiển BIOS nên nhân hệ điều hành không thể tính toán trước được tổng kích thước byte của tệp tin.',
        'Vì kiến trúc Unix/Linux truy xuất tệp tin qua tầng Page Cache và luôn coi tệp tin ở trạng thái sẵn sàng đọc ngay; nếu xảy ra Cache Miss, lời gọi read() buộc phải chặn luồng chờ nạp đĩa.',
        'Vì các tệp tin trên hệ thống tệp Ext4 và XFS không được nhân hệ điều hành cấp số nguyên File Descriptor mà chỉ có thể truy cập trực tiếp thông qua chuỗi đường dẫn tuyệt đối.',
        'Vì cấu trúc dữ liệu Cây Đỏ-Đen của epoll chỉ chấp nhận các khóa tìm kiếm là địa chỉ mạng IPv4 hoặc IPv6 chứ không thể lưu trữ được mã định danh inode của tệp tin cục bộ.'
      ],
      correctIndex: 1,
      explanation: 'Khác với socket mạng (dữ liệu đến bất ngờ từ bên ngoài), nhân Linux quản lý tệp tin đĩa thông qua Kernel Page Cache và định nghĩa rằng tệp tin thông thường luôn sẵn sàng đọc/ghi (nếu gọi epoll_ctl trên regular file sẽ bị trả về lỗi EPERM). Khi trang dữ liệu chưa có trong RAM (Page Cache Miss), nhân Linux sẽ chặn đứng luồng gọi hàm để chờ ổ đĩa nạp dữ liệu, buộc Libuv phải ủy thác các lệnh fs.* sang Worker Threadpool.'
    },
    {
      id: 'c2-l2-q6',
      question: 'Trong module dns của Node.js, sự khác biệt căn bản về kiến trúc thực thi và hành vi hệ thống giữa dns.lookup() và dns.resolve4() là gì?',
      options: [
        'dns.lookup() gọi hàm getaddrinfo() của OS trên Libuv Threadpool (có đọc tệp /etc/hosts), còn dns.resolve4() dùng thư viện c-ares gửi gói tin mạng trực tiếp qua epoll/kqueue (bỏ qua /etc/hosts).',
        'dns.lookup() thực hiện truy vấn qua giao thức UDP không kết nối, trong khi dns.resolve4() bắt buộc phải thiết lập kết nối TCP có mã hóa chứng chỉ TLS hai chiều với máy chủ tên miền gốc.',
        'dns.lookup() chỉ hỗ trợ phân giải các tên miền dịch vụ nội bộ bên trong cụm Kubernetes, trong khi dns.resolve4() chỉ hoạt động được với các tên miền công cộng ngoài mạng Internet.',
        'dns.lookup() chạy hoàn toàn phi chặn trên luồng chính của V8 Engine, còn dns.resolve4() phải khởi tạo một tiến trình con Child Process riêng biệt cho mỗi lần thực hiện phân giải tên miền.'
      ],
      correctIndex: 0,
      explanation: 'dns.lookup() sử dụng hàm getaddrinfo(3) của thư viện C hệ điều hành nên tuân thủ đầy đủ cấu hình hệ thống (/etc/hosts, /etc/nsswitch.conf), nhưng vì getaddrinfo là hàm chặn luồng nên phải chạy trên Libuv Threadpool. Ngược lại, nhóm hàm dns.resolve*() sử dụng thư viện c-ares giao tiếp thẳng với DNS Server qua socket UDP/TCP bằng epoll/kqueue hoàn toàn phi chặn và không dùng Threadpool.'
    },
    {
      id: 'c2-l2-q7',
      question: 'Nếu một Pod Kubernetes chỉ được cấp giới hạn 2 vCPU, việc thiết lập UV_THREADPOOL_SIZE=128 để xử lý đồng thời hàng trăm yêu cầu băm mật khẩu crypto.scrypt/pbkdf2 sẽ gây ra hậu quả tiêu cực nào?',
      options: [
        'Bộ thu gom rác Orinoco của V8 sẽ tự động bị vô hiệu hóa hoàn toàn để nhường toàn bộ dung lượng bộ nhớ đệm trên vi xử lý cho 128 luồng công nhân C++ của Libuv hoạt động.',
        'Không có bất kỳ tác dụng phụ tiêu cực nào; tốc độ hoàn thành của 128 yêu cầu băm mật khẩu sẽ tăng nhanh gấp 64 lần so với khi giữ nguyên cấu hình mặc định 4 luồng.',
        'Gây suy thoái hiệu năng nghiêm trọng (CPU Thrashing) do 128 luồng tính toán nặng tranh giành 2 lõi vCPU vật lý, làm bùng nổ chi phí Context Switching và xóa bẩn bộ nhớ đệm L1/L2 Cache.',
        'Nhân hệ điều hành Linux sẽ tự động từ chối khởi tạo các luồng vượt quá số lõi CPU vật lý và buộc toàn bộ tiến trình Node.js phải quay về chế độ thực thi đơn luồng an toàn.'
      ],
      correctIndex: 2,
      explanation: 'Đối với các tác vụ tiêu thụ 100% chu kỳ CPU như crypto.pbkdf2 hoặc scrypt, tốc độ xử lý bị giới hạn cứng bởi số lõi CPU vật lý. Khi cho 128 luồng C++ cùng chạy phép toán nặng trên 2 vCPU, bộ lập lịch của Linux phải liên tục ngắt luồng này để nạp luồng kia (Preemptive Context Switching), làm mất hiệu lực bộ nhớ đệm L1/L2 Cache và tiêu tốn phần lớn thời gian CPU cho việc chuyển ngữ cảnh thay vì tính toán thực sự.'
    },
    {
      id: 'c2-l2-q8',
      question: 'Sau khi một luồng công nhân C++ trong Libuv Threadpool hoàn thành xong tác vụ đọc tệp tin hoặc băm mật khẩu, nó làm cách nào để đánh thức và chuyển kết quả về lại luồng chính V8 một cách an toàn?',
      options: [
        'Luồng công nhân C++ tự động tạm dừng khung ngăn xếp V8 Call Stack từ bên ngoài và chép thẳng đối tượng kết quả vào phân vùng Young Generation của bộ nhớ V8 Heap.',
        'Luồng công nhân đẩy kết quả vào hàng đợi hoàn tất có khóa Mutex rồi gọi uv_async_send() ghi tín hiệu vào mô tả tệp eventfd để đánh thức hàm epoll_wait() của luồng chính tại Pha Poll.',
        'Luồng công nhân mở một kết nối HTTP nội bộ qua cổng loopback 127.0.0.1 và gửi kết quả dưới dạng chuỗi văn bản JSON tới tầng Controller của ứng dụng NestJS đang lắng nghe.',
        'Luồng công nhân ghi kết quả ra một tệp tin nhị phân tạm trong thư mục /tmp để luồng chính định kỳ quét kiểm tra sau mỗi 10ms thông qua bộ hẹn giờ hệ thống setInterval.'
      ],
      correctIndex: 1,
      explanation: 'Vì V8 Isolate không an toàn đa luồng (not thread-safe), các luồng công nhân C++ trong Libuv Threadpool tuyệt đối không được gọi trực tiếp vào V8. Khi hoàn tất công việc, luồng công nhân đưa kết quả vào hàng đợi hoàn tất của vòng lặp (loop->wq) và gọi uv_async_send() — thao tác này ghi dữ liệu vào một eventfd (trên Linux) hoặc self-pipe đã được đăng ký sẵn với epoll, qua đó đánh thức epoll_wait() ở Pha 4 (Poll) để luồng chính tự lấy kết quả và chạy callback JS.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Định Lượng Chi Phí Ghép Kênh Kernel & Thời Gian Chờ Libuv Threadpool (Kernel & Threadpool Cost Analyzer)',
    description: 'Áp dụng các công thức định lượng ở Phần 1 và Phần 2 để so sánh hiệu năng giữa `select/poll` với `epoll` và tính độ trễ xếp hàng trên `Libuv Threadpool`. Viết hàm `analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs)` nhận vào:\n- `totalSockets`: Tổng số kết nối TCP đang mở trên máy chủ.\n- `activeSockets`: Số kết nối thực sự có gói tin mới trong vòng Tick hiện tại.\n- `cyclesPerSocket`: Số chu kỳ CPU tiêu tốn để kiểm tra/thu hoạch 1 socket.\n- `threadpoolSize`: Kích thước cấu hình `UV_THREADPOOL_SIZE` (ví dụ `4`).\n- `concurrentCryptoTasks`: Số lượng tác vụ `crypto.pbkdf2` được gửi vào cùng lúc.\n- `singleCryptoDurationMs`: Thời gian thực thi của 1 tác vụ `crypto.pbkdf2` trên 1 luồng (ms).\n\nYêu cầu tính toán:\n1. Chi phí chu kỳ CPU của `select/poll` (quét tuyến tính toàn bộ): `linearScanCycles = totalSockets * cyclesPerSocket`.\n2. Chi phí chu kỳ CPU của `Linux epoll` (chỉ thu hoạch từ Ready List): `epollReadyCycles = activeSockets * cyclesPerSocket`.\n3. Tổng số đợt (batches/waves) cần thiết để `Libuv Threadpool` xử lý hết `concurrentCryptoTasks`: `totalThreadpoolWaves = concurrentCryptoTasks === 0 ? 0 : Math.ceil(concurrentCryptoTasks / threadpoolSize)`.\n4. Thời gian hoàn thành của tác vụ `pbkdf2` cuối cùng: `lastCryptoCompletionMs = Math.round((totalThreadpoolWaves * singleCryptoDurationMs) * 100) / 100`.\n5. Phân loại trạng thái bể luồng `poolStatus`:\n   - Nếu `concurrentCryptoTasks > threadpoolSize * 2`: `"POOL_STARVATION_CRITICAL"`.\n   - Ngược lại, nếu `concurrentCryptoTasks >= threadpoolSize`: `"POOL_SATURATED"`.\n   - Ngược lại: `"POOL_HEALTHY"`.\nTrả về `{ linearScanCycles, epollReadyCycles, totalThreadpoolWaves, lastCryptoCompletionMs, poolStatus }`.',
    guidedSteps: [
      'Bước 1 (Tính chi phí chu kỳ CPU của select/poll và epoll): Tính `linearScanCycles = totalSockets * cyclesPerSocket` và `epollReadyCycles = activeSockets * cyclesPerSocket`.',
      'Bước 2 (Tính số đợt xử lý trên Threadpool): Nếu `concurrentCryptoTasks === 0` thì `totalThreadpoolWaves = 0`, ngược lại dùng `Math.ceil(concurrentCryptoTasks / threadpoolSize)`.',
      'Bước 3 (Tính thời gian hoàn thành đợt cuối): Tính `lastCryptoCompletionMs = Math.round((totalThreadpoolWaves * singleCryptoDurationMs) * 100) / 100`.',
      'Bước 4 (Phân loại poolStatus và trả về): Kiểm tra `concurrentCryptoTasks > threadpoolSize * 2` -> `"POOL_STARVATION_CRITICAL"`, `>= threadpoolSize` -> `"POOL_SATURATED"`, còn lại `"POOL_HEALTHY"`, rồi trả về object kết quả.'
    ],
    hints: [
      'Vì `threadpoolSize` luồng xử lý song song được tối đa `threadpoolSize` tác vụ trong mỗi đợt, nên tổng số đợt chính là phép chia làm tròn lên `Math.ceil(concurrentCryptoTasks / threadpoolSize)`.',
      'Chú ý phân biệt dấu `>` ở điều kiện `"POOL_STARVATION_CRITICAL"` (`concurrentCryptoTasks > threadpoolSize * 2`) và dấu `>=` ở điều kiện `"POOL_SATURATED"` (`concurrentCryptoTasks >= threadpoolSize`).'
    ],
    starterCode: `function analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs) {
  // Bước 1: Tính linearScanCycles và epollReadyCycles
  
  // Bước 2: Tính totalThreadpoolWaves = Math.ceil(concurrentCryptoTasks / threadpoolSize)
  
  // Bước 3: Tính lastCryptoCompletionMs (làm tròn 2 chữ số thập phân)
  
  // Bước 4: Phân loại poolStatus ("POOL_STARVATION_CRITICAL" | "POOL_SATURATED" | "POOL_HEALTHY") và trả về kết quả
}`,
    solution: `function analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs) {
  const linearScanCycles = totalSockets * cyclesPerSocket;
  const epollReadyCycles = activeSockets * cyclesPerSocket;
  const totalThreadpoolWaves =
    concurrentCryptoTasks === 0 ? 0 : Math.ceil(concurrentCryptoTasks / threadpoolSize);
  const lastCryptoCompletionMs =
    Math.round(totalThreadpoolWaves * singleCryptoDurationMs * 100) / 100;

  let poolStatus = 'POOL_HEALTHY';
  if (concurrentCryptoTasks > threadpoolSize * 2) {
    poolStatus = 'POOL_STARVATION_CRITICAL';
  } else if (concurrentCryptoTasks >= threadpoolSize) {
    poolStatus = 'POOL_SATURATED';
  }

  return {
    linearScanCycles,
    epollReadyCycles,
    totalThreadpoolWaves,
    lastCryptoCompletionMs,
    poolStatus
  };
}`,
    testCases: [
      {
        name: 'Hệ thống 50,000 kết nối với 2 tác vụ crypto trên Pool 4 luồng -> POOL_HEALTHY',
        input: [50000, 10, 40, 4, 2, 85],
        expected: {
          linearScanCycles: 2000000,
          epollReadyCycles: 400,
          totalThreadpoolWaves: 1,
          lastCryptoCompletionMs: 85,
          poolStatus: 'POOL_HEALTHY'
        },
        hidden: false
      },
      {
        name: '6 tác vụ crypto cùng lúc trên Pool 4 luồng (2 đợt xử lý) -> POOL_SATURATED',
        input: [10000, 25, 50, 4, 6, 120],
        expected: {
          linearScanCycles: 500000,
          epollReadyCycles: 1250,
          totalThreadpoolWaves: 2,
          lastCryptoCompletionMs: 240,
          poolStatus: 'POOL_SATURATED'
        },
        hidden: false
      },
      {
        name: '20 tác vụ crypto dồn dập trên Pool 4 luồng (5 đợt = 500ms) -> POOL_STARVATION_CRITICAL',
        input: [100000, 50, 30, 4, 20, 100],
        expected: {
          linearScanCycles: 3000000,
          epollReadyCycles: 1500,
          totalThreadpoolWaves: 5,
          lastCryptoCompletionMs: 500,
          poolStatus: 'POOL_STARVATION_CRITICAL'
        },
        hidden: false
      },
      {
        name: 'Test biên ẩn: Không có tác vụ crypto nào (concurrentCryptoTasks = 0)',
        input: [2000, 0, 50, 8, 0, 100],
        expected: {
          linearScanCycles: 100000,
          epollReadyCycles: 0,
          totalThreadpoolWaves: 0,
          lastCryptoCompletionMs: 0,
          poolStatus: 'POOL_HEALTHY'
        },
        hidden: true
      },
      {
        name: 'Test biên ẩn: Chạm đúng ngưỡng 2x threadpoolSize (8 tác vụ trên Pool 4) -> Vẫn là POOL_SATURATED',
        input: [5000, 5, 20, 4, 8, 33.333],
        expected: {
          linearScanCycles: 100000,
          epollReadyCycles: 100,
          totalThreadpoolWaves: 2,
          lastCryptoCompletionMs: 66.67,
          poolStatus: 'POOL_SATURATED'
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Định Lượng Chi Phí Ghép Kênh Kernel & Thời Gian Chờ Libuv Threadpool (Kernel & Threadpool Cost Analyzer)',
      description: 'Áp dụng các công thức định lượng ở Phần 1 và Phần 2 để so sánh hiệu năng giữa `select/poll` với `epoll` và tính độ trễ xếp hàng trên `Libuv Threadpool`. Viết hàm `analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs)` nhận vào:\n- `totalSockets`: Tổng số kết nối TCP đang mở trên máy chủ.\n- `activeSockets`: Số kết nối thực sự có gói tin mới trong vòng Tick hiện tại.\n- `cyclesPerSocket`: Số chu kỳ CPU tiêu tốn để kiểm tra/thu hoạch 1 socket.\n- `threadpoolSize`: Kích thước cấu hình `UV_THREADPOOL_SIZE` (ví dụ `4`).\n- `concurrentCryptoTasks`: Số lượng tác vụ `crypto.pbkdf2` được gửi vào cùng lúc.\n- `singleCryptoDurationMs`: Thời gian thực thi của 1 tác vụ `crypto.pbkdf2` trên 1 luồng (ms).\n\nYêu cầu tính toán:\n1. Chi phí chu kỳ CPU của `select/poll` (quét tuyến tính toàn bộ): `linearScanCycles = totalSockets * cyclesPerSocket`.\n2. Chi phí chu kỳ CPU của `Linux epoll` (chỉ thu hoạch từ Ready List): `epollReadyCycles = activeSockets * cyclesPerSocket`.\n3. Tổng số đợt (batches/waves) cần thiết để `Libuv Threadpool` xử lý hết `concurrentCryptoTasks`: `totalThreadpoolWaves = concurrentCryptoTasks === 0 ? 0 : Math.ceil(concurrentCryptoTasks / threadpoolSize)`.\n4. Thời gian hoàn thành của tác vụ `pbkdf2` cuối cùng: `lastCryptoCompletionMs = Math.round((totalThreadpoolWaves * singleCryptoDurationMs) * 100) / 100`.\n5. Phân loại trạng thái bể luồng `poolStatus`:\n   - Nếu `concurrentCryptoTasks > threadpoolSize * 2`: `"POOL_STARVATION_CRITICAL"`.\n   - Ngược lại, nếu `concurrentCryptoTasks >= threadpoolSize`: `"POOL_SATURATED"`.\n   - Ngược lại: `"POOL_HEALTHY"`.\nTrả về `{ linearScanCycles, epollReadyCycles, totalThreadpoolWaves, lastCryptoCompletionMs, poolStatus }`.',
      guidedSteps: [
        'Bước 1 (Tính chi phí chu kỳ CPU của select/poll và epoll): Tính `linearScanCycles = totalSockets * cyclesPerSocket` và `epollReadyCycles = activeSockets * cyclesPerSocket`.',
        'Bước 2 (Tính số đợt xử lý trên Threadpool): Nếu `concurrentCryptoTasks === 0` thì `totalThreadpoolWaves = 0`, ngược lại dùng `Math.ceil(concurrentCryptoTasks / threadpoolSize)`.',
        'Bước 3 (Tính thời gian hoàn thành đợt cuối): Tính `lastCryptoCompletionMs = Math.round((totalThreadpoolWaves * singleCryptoDurationMs) * 100) / 100`.',
        'Bước 4 (Phân loại poolStatus và trả về): Kiểm tra `concurrentCryptoTasks > threadpoolSize * 2` -> `"POOL_STARVATION_CRITICAL"`, `>= threadpoolSize` -> `"POOL_SATURATED"`, còn lại `"POOL_HEALTHY"`, rồi trả về object kết quả.'
      ],
      hints: [
        'Vì `threadpoolSize` luồng xử lý song song được tối đa `threadpoolSize` tác vụ trong mỗi đợt, nên tổng số đợt chính là phép chia làm tròn lên `Math.ceil(concurrentCryptoTasks / threadpoolSize)`.',
        'Chú ý phân biệt dấu `>` ở điều kiện `"POOL_STARVATION_CRITICAL"` (`concurrentCryptoTasks > threadpoolSize * 2`) và dấu `>=` ở điều kiện `"POOL_SATURATED"` (`concurrentCryptoTasks >= threadpoolSize`).'
      ],
      starterCode: `function analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs) {
  // Bước 1: Tính linearScanCycles và epollReadyCycles
  
  // Bước 2: Tính totalThreadpoolWaves = Math.ceil(concurrentCryptoTasks / threadpoolSize)
  
  // Bước 3: Tính lastCryptoCompletionMs (làm tròn 2 chữ số thập phân)
  
  // Bước 4: Phân loại poolStatus ("POOL_STARVATION_CRITICAL" | "POOL_SATURATED" | "POOL_HEALTHY") và trả về kết quả
}`,
      solution: `function analyzeKernelAndThreadpoolMetrics(totalSockets, activeSockets, cyclesPerSocket, threadpoolSize, concurrentCryptoTasks, singleCryptoDurationMs) {
  const linearScanCycles = totalSockets * cyclesPerSocket;
  const epollReadyCycles = activeSockets * cyclesPerSocket;
  const totalThreadpoolWaves =
    concurrentCryptoTasks === 0 ? 0 : Math.ceil(concurrentCryptoTasks / threadpoolSize);
  const lastCryptoCompletionMs =
    Math.round(totalThreadpoolWaves * singleCryptoDurationMs * 100) / 100;

  let poolStatus = 'POOL_HEALTHY';
  if (concurrentCryptoTasks > threadpoolSize * 2) {
    poolStatus = 'POOL_STARVATION_CRITICAL';
  } else if (concurrentCryptoTasks >= threadpoolSize) {
    poolStatus = 'POOL_SATURATED';
  }

  return {
    linearScanCycles,
    epollReadyCycles,
    totalThreadpoolWaves,
    lastCryptoCompletionMs,
    poolStatus
  };
}`,
      testCases: [
        {
          name: 'Hệ thống 50,000 kết nối với 2 tác vụ crypto trên Pool 4 luồng -> POOL_HEALTHY',
          input: [50000, 10, 40, 4, 2, 85],
          expected: {
            linearScanCycles: 2000000,
            epollReadyCycles: 400,
            totalThreadpoolWaves: 1,
            lastCryptoCompletionMs: 85,
            poolStatus: 'POOL_HEALTHY'
          },
          hidden: false
        },
        {
          name: '6 tác vụ crypto cùng lúc trên Pool 4 luồng (2 đợt xử lý) -> POOL_SATURATED',
          input: [10000, 25, 50, 4, 6, 120],
          expected: {
            linearScanCycles: 500000,
            epollReadyCycles: 1250,
            totalThreadpoolWaves: 2,
            lastCryptoCompletionMs: 240,
            poolStatus: 'POOL_SATURATED'
          },
          hidden: false
        },
        {
          name: '20 tác vụ crypto dồn dập trên Pool 4 luồng (5 đợt = 500ms) -> POOL_STARVATION_CRITICAL',
          input: [100000, 50, 30, 4, 20, 100],
          expected: {
            linearScanCycles: 3000000,
            epollReadyCycles: 1500,
            totalThreadpoolWaves: 5,
            lastCryptoCompletionMs: 500,
            poolStatus: 'POOL_STARVATION_CRITICAL'
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Không có tác vụ crypto nào (concurrentCryptoTasks = 0)',
          input: [2000, 0, 50, 8, 0, 100],
          expected: {
            linearScanCycles: 100000,
            epollReadyCycles: 0,
            totalThreadpoolWaves: 0,
            lastCryptoCompletionMs: 0,
            poolStatus: 'POOL_HEALTHY'
          },
          hidden: true
        },
        {
          name: 'Test biên ẩn: Chạm đúng ngưỡng 2x threadpoolSize (8 tác vụ trên Pool 4) -> Vẫn là POOL_SATURATED',
          input: [5000, 5, 20, 4, 8, 33.333],
          expected: {
            linearScanCycles: 100000,
            epollReadyCycles: 100,
            totalThreadpoolWaves: 2,
            lastCryptoCompletionMs: 66.67,
            poolStatus: 'POOL_SATURATED'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Mô Phỏng Phân Luồng Tác Vụ Kernel epoll vs Libuv Threadpool (Subsystem Task Router & Queue Simulator)',
      description: 'Mô phỏng cách Libuv phân luồng một danh sách các tác vụ bất đồng bộ vào **Kernel epoll** (chạy song song tức thì không tốn luồng) hoặc **Libuv Worker Threadpool** (xếp hàng trên `poolSize` luồng C++). Viết hàm `simulateLibuvSubsystemRouting(operations, poolSize)` nhận vào danh sách `operations` gồm các đối tượng `{ id: string, type: "TCP_SOCKET" | "HTTP_KEEPALIVE" | "DNS_RESOLVE_CARES" | "DNS_LOOKUP" | "FS_READ" | "CRYPTO_PBKDF2" | "ZLIB_GZIP", durationMs: number }` (giả sử tất cả được gọi tại thời điểm `t = 0 ms`) và số luồng `poolSize`.\n\nQuy tắc định tuyến và lập lịch:\n1. **Nhóm thuần Kernel `epoll` (0 Threads)**: Gồm các `type` thuộc `["TCP_SOCKET", "HTTP_KEEPALIVE", "DNS_RESOLVE_CARES"]`. Các tác vụ này không đi vào Threadpool mà hoàn tất ngay ở mốc `completionMs = durationMs`.\n2. **Nhóm `Libuv Threadpool`**: Gồm các `type` thuộc `["DNS_LOOKUP", "FS_READ", "CRYPTO_PBKDF2", "ZLIB_GZIP"]`. Khởi tạo một mảng `workerFreeAt = new Array(poolSize).fill(0)` biểu diễn thời điểm rảnh của từng luồng trong bể luồng.\n   - Duyệt tuần tự từng tác vụ thuộc nhóm Threadpool theo đúng thứ tự xuất hiện: tìm luồng công nhân có thời điểm rảnh sớm nhất `minFreeTime = Math.min(...workerFreeAt)` (chọn chỉ số nhỏ nhất nếu bằng nhau).\n   - Tác vụ đó sẽ bắt đầu chạy tại `startMs = minFreeTime` và hoàn tất tại `completionMs = minFreeTime + op.durationMs`. Cập nhật lại `workerFreeAt[workerIdx] = completionMs`.\n\nTrả về `{ epollTaskIds, threadpoolTaskIds, maxDnsLookupWaitMs, poolMakespanMs }`, trong đó:\n- `epollTaskIds`: Mảng `id` của các tác vụ chạy trên Kernel `epoll`.\n- `threadpoolTaskIds`: Mảng `id` của các tác vụ chạy trên `Libuv Threadpool`.\n- `maxDnsLookupWaitMs`: Thời gian phải đứng chờ trong hàng đợi (`startMs`) lớn nhất trong số các tác vụ có `type === "DNS_LOOKUP"` (nếu không có `DNS_LOOKUP` nào thì bằng `0`, làm tròn 2 chữ số thập phân).\n- `poolMakespanMs`: Thời điểm hoàn tất muộn nhất của toàn bộ bể luồng `Math.max(...workerFreeAt)` (làm tròn 2 chữ số thập phân).',
      guidedSteps: [
        'Bước 1 (Khởi tạo biến theo dõi): Tạo mảng `epollTaskIds = []`, `threadpoolTaskIds = []`, `workerFreeAt = new Array(poolSize).fill(0)` và `maxDnsLookupWaitMs = 0`.',
        'Bước 2 (Phân loại từng tác vụ trong operations): Nếu `op.type` thuộc `["TCP_SOCKET", "HTTP_KEEPALIVE", "DNS_RESOLVE_CARES"]`, đẩy `op.id` vào `epollTaskIds`.',
        'Bước 3 (Lập lịch trên Libuv Threadpool): Ngược lại, đẩy `op.id` vào `threadpoolTaskIds`. Tìm luồng `bestWorkerIdx` có `workerFreeAt[bestWorkerIdx]` nhỏ nhất. Thời gian chờ của tác vụ này là `waitMs = workerFreeAt[bestWorkerIdx]`. Nếu `op.type === "DNS_LOOKUP"` và `waitMs > maxDnsLookupWaitMs`, cập nhật `maxDnsLookupWaitMs = waitMs`. Cộng thêm `op.durationMs` vào `workerFreeAt[bestWorkerIdx]`.',
        'Bước 4 (Tính poolMakespanMs và trả về): Tính `poolMakespanMs = Math.round(Math.max(0, ...workerFreeAt) * 100) / 100`, làm tròn `maxDnsLookupWaitMs` 2 chữ số thập phân và trả về kết quả.'
      ],
      hints: [
        'Chú ý phân biệt rõ `DNS_RESOLVE_CARES` (dùng c-ares qua UDP socket -> thuộc nhóm `epoll`) với `DNS_LOOKUP` (dùng `getaddrinfo` -> thuộc nhóm `Threadpool`).',
        'Thời gian chờ trong hàng đợi của một tác vụ Threadpool (khi gửi vào lúc `t = 0`) chính bằng giá trị `workerFreeAt[bestWorkerIdx]` ngay trước khi cộng `op.durationMs`.'
      ],
      starterCode: `function simulateLibuvSubsystemRouting(operations, poolSize) {
  // Bước 1: Khởi tạo epollTaskIds, threadpoolTaskIds, workerFreeAt (độ dài poolSize) và maxDnsLookupWaitMs
  
  // Bước 2: Duyệt operations, tách các tác vụ thuần Kernel epoll (TCP_SOCKET, HTTP_KEEPALIVE, DNS_RESOLVE_CARES)
  
  // Bước 3: Cấp phát các tác vụ Threadpool (DNS_LOOKUP, FS_READ, CRYPTO_PBKDF2, ZLIB_GZIP) vào worker rảnh sớm nhất
  
  // Bước 4: Tính maxDnsLookupWaitMs, poolMakespanMs và trả về { epollTaskIds, threadpoolTaskIds, maxDnsLookupWaitMs, poolMakespanMs }
}`,
      solution: `function simulateLibuvSubsystemRouting(operations, poolSize) {
  const epollTypes = new Set(['TCP_SOCKET', 'HTTP_KEEPALIVE', 'DNS_RESOLVE_CARES']);
  const epollTaskIds = [];
  const threadpoolTaskIds = [];
  const workerFreeAt = new Array(poolSize).fill(0);
  let maxDnsLookupWaitMs = 0;

  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (epollTypes.has(op.type)) {
      epollTaskIds.push(op.id);
    } else {
      threadpoolTaskIds.push(op.id);
      let bestIdx = 0;
      for (let w = 1; w < poolSize; w++) {
        if (workerFreeAt[w] < workerFreeAt[bestIdx]) {
          bestIdx = w;
        }
      }
      const waitMs = workerFreeAt[bestIdx];
      if (op.type === 'DNS_LOOKUP' && waitMs > maxDnsLookupWaitMs) {
        maxDnsLookupWaitMs = waitMs;
      }
      workerFreeAt[bestIdx] = waitMs + op.durationMs;
    }
  }

  const rawMakespan = workerFreeAt.length > 0 ? Math.max(...workerFreeAt) : 0;

  return {
    epollTaskIds,
    threadpoolTaskIds,
    maxDnsLookupWaitMs: Math.round(maxDnsLookupWaitMs * 100) / 100,
    poolMakespanMs: Math.round(rawMakespan * 100) / 100
  };
}`,
      testCases: [
        {
          name: '4 tác vụ CRYPTO_PBKDF2 (100ms) làm nghẽn DNS_LOOKUP phía sau, trong khi TCP_SOCKET và DNS_RESOLVE_CARES đi qua epoll',
          input: [
            [
              { id: 'DB_QUERY', type: 'TCP_SOCKET', durationMs: 15 },
              { id: 'CARES_DNS', type: 'DNS_RESOLVE_CARES', durationMs: 5 },
              { id: 'HASH_1', type: 'CRYPTO_PBKDF2', durationMs: 100 },
              { id: 'HASH_2', type: 'CRYPTO_PBKDF2', durationMs: 100 },
              { id: 'HASH_3', type: 'CRYPTO_PBKDF2', durationMs: 100 },
              { id: 'HASH_4', type: 'CRYPTO_PBKDF2', durationMs: 100 },
              { id: 'AXIOS_DNS', type: 'DNS_LOOKUP', durationMs: 3 }
            ],
            4
          ],
          expected: {
            epollTaskIds: ['DB_QUERY', 'CARES_DNS'],
            threadpoolTaskIds: ['HASH_1', 'HASH_2', 'HASH_3', 'HASH_4', 'AXIOS_DNS'],
            maxDnsLookupWaitMs: 100,
            poolMakespanMs: 103
          },
          hidden: false
        },
        {
          name: 'Tăng poolSize lên 8 giúp AXIOS_DNS và FS_READ có luồng trống chạy ngay (waitMs = 0)',
          input: [
            [
              { id: 'HASH_1', type: 'CRYPTO_PBKDF2', durationMs: 120 },
              { id: 'HASH_2', type: 'CRYPTO_PBKDF2', durationMs: 120 },
              { id: 'HASH_3', type: 'CRYPTO_PBKDF2', durationMs: 120 },
              { id: 'HASH_4', type: 'CRYPTO_PBKDF2', durationMs: 120 },
              { id: 'AXIOS_DNS', type: 'DNS_LOOKUP', durationMs: 4 },
              { id: 'READ_CFG', type: 'FS_READ', durationMs: 10 }
            ],
            8
          ],
          expected: {
            epollTaskIds: [],
            threadpoolTaskIds: ['HASH_1', 'HASH_2', 'HASH_3', 'HASH_4', 'AXIOS_DNS', 'READ_CFG'],
            maxDnsLookupWaitMs: 0,
            poolMakespanMs: 120
          },
          hidden: false
        },
        {
          name: 'Toàn bộ tác vụ đều là Network Socket và HTTP Keep-Alive -> Không dùng bất kỳ luồng nào trong Threadpool',
          input: [
            [
              { id: 'HTTP_1', type: 'HTTP_KEEPALIVE', durationMs: 25 },
              { id: 'REDIS_1', type: 'TCP_SOCKET', durationMs: 2 }
            ],
            4
          ],
          expected: {
            epollTaskIds: ['HTTP_1', 'REDIS_1'],
            threadpoolTaskIds: [],
            maxDnsLookupWaitMs: 0,
            poolMakespanMs: 0
          },
          hidden: false
        },
        {
          name: 'Test biên ẩn: Nhiều đợt tác vụ không đồng đều trên Pool 2 luồng',
          input: [
            [
              { id: 'Z1', type: 'ZLIB_GZIP', durationMs: 30 },
              { id: 'F1', type: 'FS_READ', durationMs: 50 },
              { id: 'D1', type: 'DNS_LOOKUP', durationMs: 5 },
              { id: 'D2', type: 'DNS_LOOKUP', durationMs: 5 }
            ],
            2
          ],
          expected: {
            epollTaskIds: [],
            threadpoolTaskIds: ['Z1', 'F1', 'D1', 'D2'],
            maxDnsLookupWaitMs: 35,
            poolMakespanMs: 50
          },
          hidden: true
        },
        {
          name: 'Test ẩn: Danh sách tác vụ rỗng',
          input: [[], 4],
          expected: {
            epollTaskIds: [],
            threadpoolTaskIds: [],
            maxDnsLookupWaitMs: 0,
            poolMakespanMs: 0
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Thiết Kế Bộ Điều Phối Vách Ngăn Bảo Vệ Libuv Threadpool (Production Threadpool Bulkhead Planner)',
      description: 'Hiện thực hóa thuật toán trong `ThreadpoolBulkheadGuardService` (từ `realCodeSnippet`) để phân bổ vách ngăn bảo vệ `fs.*` và `dns.lookup` khỏi bị các tác vụ `crypto/zlib` làm nghẽn. Viết hàm `evaluateBulkheadThreadpoolPlan(configuredPoolSize, vCpuCount, reserveIoRatio, heavyCpuTasksMs, criticalIoTasksMs)` nhận vào:\n- `configuredPoolSize`: Giá trị `UV_THREADPOOL_SIZE` (phải là số nguyên trong đoạn `[1, 1024]`).\n- `vCpuCount`: Số lõi `vCPU` của Container (số nguyên `>= 1`).\n- `reserveIoRatio`: Tỷ lệ luồng tối thiểu dành riêng cho I/O (`fs` & `dns.lookup`), là số thực trong khoảng `(0, 0.9]` (ví dụ `0.25` tức 25%).\n- `heavyCpuTasksMs`: Mảng thời gian thực thi (ms) của các tác vụ nặng (`crypto.pbkdf2`, `zlib`).\n- `criticalIoTasksMs`: Mảng thời gian thực thi (ms) của các tác vụ I/O thiết yếu (`fs.readFile`, `dns.lookup`).\n\nQuy tắc kiểm tra đầu vào (Validation):\n- Nếu `!Number.isInteger(configuredPoolSize) || configuredPoolSize < 1 || configuredPoolSize > 1024`, hoặc `!Number.isInteger(vCpuCount) || vCpuCount < 1`, hoặc `typeof reserveIoRatio !== "number" || reserveIoRatio <= 0 || reserveIoRatio > 0.9`, hoặc `!Array.isArray(heavyCpuTasksMs)` hoặc `!Array.isArray(criticalIoTasksMs)` hoặc có phần tử nào trong 2 mảng `<= 0` hay không phải số hữu hạn: Ném lỗi `throw new Error("INVALID_BULKHEAD_CONFIG")`.\n\nQuy tắc tính toán Vách ngăn (Bulkhead Allocation):\n1. Số luồng dành riêng cho I/O thiết yếu: `reservedIoThreads = configuredPoolSize === 1 ? 0 : Math.max(1, Math.ceil(configuredPoolSize * reserveIoRatio))`.\n2. Hạn ngạch luồng tối đa cho phép các tác vụ nặng (`heavyCpuTasksMs`) chạy đồng thời: `maxHeavyConcurrency = Math.max(1, configuredPoolSize - reservedIoThreads)`.\n3. Mô phỏng thời gian hoàn thành toàn bộ `heavyCpuTasksMs` khi chỉ được chạy trên tối đa `maxHeavyConcurrency` luồng (theo quy tắc luồng rảnh sớm nhất): `heavyMakespanMs` (làm tròn 2 chữ số thập phân).\n4. Mô phỏng thời gian hoàn thành toàn bộ `criticalIoTasksMs` trên các luồng dành riêng `effectiveIoThreads = Math.max(1, reservedIoThreads)`: `criticalIoMakespanMs` (làm tròn 2 chữ số thập phân).\n5. Đánh giá cảnh báo kiến trúc `tuningRecommendation`:\n   - Nếu `configuredPoolSize === 1`: `"SINGLE_THREAD_BOTTLENECK"`.\n   - Ngược lại, nếu `maxHeavyConcurrency > vCpuCount * 2`: `"THRASHING_RISK_REDUCE_HEAVY_CONCURRENCY"` (Quá nhiều luồng CPU-bound tranh chấp ít lõi vCPU).\n   - Ngược lại, nếu `configuredPoolSize === 4 && criticalIoMakespanMs > 50`: `"INCREASE_UV_THREADPOOL_SIZE"`.\n   - Ngược lại: `"OPTIMAL_BULKHEAD"`.\nTrả về `{ reservedIoThreads, maxHeavyConcurrency, heavyMakespanMs, criticalIoMakespanMs, tuningRecommendation }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra tính hợp lệ của đầu vào): Kiểm tra đầy đủ điều kiện của `configuredPoolSize` (`1..1024`), `vCpuCount >= 1`, `0 < reserveIoRatio <= 0.9`, và mọi phần tử trong `heavyCpuTasksMs`, `criticalIoTasksMs` đều là số dương hữu hạn. Nếu sai, `throw new Error("INVALID_BULKHEAD_CONFIG")`.',
        'Bước 2 (Tính kích thước vách ngăn): Tính `reservedIoThreads = configuredPoolSize === 1 ? 0 : Math.max(1, Math.ceil(configuredPoolSize * reserveIoRatio))` và `maxHeavyConcurrency = Math.max(1, configuredPoolSize - reservedIoThreads)`.',
        'Bước 3 (Mô phỏng lập lịch trên 2 nhóm luồng): Viết hàm phụ `calcMakespan(tasks, concurrency)` dùng mảng `workers = new Array(concurrency).fill(0)`, gán từng task vào worker có giá trị nhỏ nhất rồi trả về `Math.round(Math.max(0, ...workers) * 100) / 100`. Gọi cho `heavyCpuTasksMs` với `maxHeavyConcurrency` và cho `criticalIoTasksMs` với `Math.max(1, reservedIoThreads)`.',
        'Bước 4 (Xác định tuningRecommendation và trả về): Kiểm tra lần lượt các điều kiện của `tuningRecommendation` và trả về object kết quả.'
      ],
      hints: [
        'Hàm phụ tính makespan cho `N` luồng rất ngắn gọn: khởi tạo `const w = new Array(threads).fill(0)`, với mỗi `d` trong mảng, tìm chỉ số `minIdx` có `w[minIdx]` nhỏ nhất rồi cộng `w[minIdx] += d`. Cuối cùng lấy `Math.max(...w)`.',
        'Nhớ kiểm tra `Number.isInteger(configuredPoolSize)` và giới hạn trần `configuredPoolSize <= 1024` của Libuv.'
      ],
      starterCode: `function evaluateBulkheadThreadpoolPlan(configuredPoolSize, vCpuCount, reserveIoRatio, heavyCpuTasksMs, criticalIoTasksMs) {
  // Bước 1: Kiểm tra tính hợp lệ của các tham số đầu vào; ném Error("INVALID_BULKHEAD_CONFIG") nếu vi phạm
  
  // Bước 2: Tính reservedIoThreads và maxHeavyConcurrency
  
  // Bước 3: Tính heavyMakespanMs (trên maxHeavyConcurrency luồng) và criticalIoMakespanMs (trên Math.max(1, reservedIoThreads) luồng)
  
  // Bước 4: Đánh giá tuningRecommendation và trả về kết quả
}`,
      solution: `function evaluateBulkheadThreadpoolPlan(configuredPoolSize, vCpuCount, reserveIoRatio, heavyCpuTasksMs, criticalIoTasksMs) {
  if (
    !Number.isInteger(configuredPoolSize) ||
    configuredPoolSize < 1 ||
    configuredPoolSize > 1024 ||
    !Number.isInteger(vCpuCount) ||
    vCpuCount < 1 ||
    typeof reserveIoRatio !== 'number' ||
    !Number.isFinite(reserveIoRatio) ||
    reserveIoRatio <= 0 ||
    reserveIoRatio > 0.9 ||
    !Array.isArray(heavyCpuTasksMs) ||
    !Array.isArray(criticalIoTasksMs)
  ) {
    throw new Error('INVALID_BULKHEAD_CONFIG');
  }

  for (let i = 0; i < heavyCpuTasksMs.length; i++) {
    const v = heavyCpuTasksMs[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new Error('INVALID_BULKHEAD_CONFIG');
    }
  }
  for (let i = 0; i < criticalIoTasksMs.length; i++) {
    const v = criticalIoTasksMs[i];
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new Error('INVALID_BULKHEAD_CONFIG');
    }
  }

  const reservedIoThreads =
    configuredPoolSize === 1 ? 0 : Math.max(1, Math.ceil(configuredPoolSize * reserveIoRatio));
  const maxHeavyConcurrency = Math.max(1, configuredPoolSize - reservedIoThreads);
  const effectiveIoThreads = Math.max(1, reservedIoThreads);

  const computeMakespan = (tasks, threads) => {
    if (tasks.length === 0) return 0;
    const workers = new Array(threads).fill(0);
    for (let i = 0; i < tasks.length; i++) {
      let best = 0;
      for (let w = 1; w < threads; w++) {
        if (workers[w] < workers[best]) {
          best = w;
        }
      }
      workers[best] += tasks[i];
    }
    return Math.round(Math.max(...workers) * 100) / 100;
  };

  const heavyMakespanMs = computeMakespan(heavyCpuTasksMs, maxHeavyConcurrency);
  const criticalIoMakespanMs = computeMakespan(criticalIoTasksMs, effectiveIoThreads);

  let tuningRecommendation = 'OPTIMAL_BULKHEAD';
  if (configuredPoolSize === 1) {
    tuningRecommendation = 'SINGLE_THREAD_BOTTLENECK';
  } else if (maxHeavyConcurrency > vCpuCount * 2) {
    tuningRecommendation = 'THRASHING_RISK_REDUCE_HEAVY_CONCURRENCY';
  } else if (configuredPoolSize === 4 && criticalIoMakespanMs > 50) {
    tuningRecommendation = 'INCREASE_UV_THREADPOOL_SIZE';
  }

  return {
    reservedIoThreads,
    maxHeavyConcurrency,
    heavyMakespanMs,
    criticalIoMakespanMs,
    tuningRecommendation
  };
}`,
      testCases: [
        {
          name: 'Cấu hình chuẩn UV_THREADPOOL_SIZE=8 trên 4 vCPU (25% dự phòng = 2 luồng I/O, 6 luồng Crypto) -> OPTIMAL_BULKHEAD',
          input: [8, 4, 0.25, [100, 100, 100, 100, 100, 100], [10, 15, 12, 8]],
          expected: {
            reservedIoThreads: 2,
            maxHeavyConcurrency: 6,
            heavyMakespanMs: 100,
            criticalIoMakespanMs: 23,
            tuningRecommendation: 'OPTIMAL_BULKHEAD'
          },
          hidden: false
        },
        {
          name: 'Đặt UV_THREADPOOL_SIZE=32 trên Pod chỉ có 2 vCPU -> Cảnh báo THRASHING_RISK_REDUCE_HEAVY_CONCURRENCY',
          input: [32, 2, 0.25, [80, 80, 80, 80], [5, 5]],
          expected: {
            reservedIoThreads: 8,
            maxHeavyConcurrency: 24,
            heavyMakespanMs: 80,
            criticalIoMakespanMs: 5,
            tuningRecommendation: 'THRASHING_RISK_REDUCE_HEAVY_CONCURRENCY'
          },
          hidden: false
        },
        {
          name: 'Giữ mặc định Pool=4 nhưng tải FS/DNS cao (criticalIoMakespanMs = 75ms > 50ms) -> INCREASE_UV_THREADPOOL_SIZE',
          input: [4, 4, 0.25, [120, 120, 120], [25, 25, 25]],
          expected: {
            reservedIoThreads: 1,
            maxHeavyConcurrency: 3,
            heavyMakespanMs: 120,
            criticalIoMakespanMs: 75,
            tuningRecommendation: 'INCREASE_UV_THREADPOOL_SIZE'
          },
          hidden: false
        },
        {
          name: 'Test ẩn: Cấu hình vượt trần 1024 của Libuv -> Ném lỗi INVALID_BULKHEAD_CONFIG',
          input: [2048, 8, 0.25, [50], [10]],
          expected: 'ERROR_THROWN',
          hidden: true
        },
        {
          name: 'Test ẩn: Tỷ lệ reserveIoRatio không hợp lệ (> 0.9 hoặc <= 0) -> Ném lỗi INVALID_BULKHEAD_CONFIG',
          input: [8, 4, 0.95, [50], [10]],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
