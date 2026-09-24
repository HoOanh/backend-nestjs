import type { Sprint } from './types.ts';

export const chapter9: Sprint = {
  sprintId: 9,
  sprintTitle: 'Chương 9: Security Hardening & Mật Mã Học Cấp Doanh Nghiệp',
  sprintDesc: 'Bảo vệ hệ thống backend trước các cuộc tấn công tinh vi: Mật mã học (Argon2id vs Bcrypt, RS256 vs HS256), Phân quyền RBAC vs ABAC & Token Revocation, và Phòng chống SQLi/Mass Assignment/CSRF',
  lessons: [
    {
      id: 'c9-l1',
      title: 'Bài 01: Mật Mã Học Ứng Dụng & Xác Thực: Argon2id Hashing, JWT Secret vs Cặp Khóa Bất Đối Xứng RS256/ES256',
      duration: '60 phút',
      tag: 'Applied Cryptography & JWT',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: ỐNG MÁY XAY THỊT MỘT CHIỀU VS CON DẤU HOÀNG GIA

Mật mã học trong Backend không phải là giấu dữ liệu cho người khác không thấy, mà là bài toán bảo đảm tính bất khả nghịch và tính toàn vẹn:
* **Hàm băm mật khẩu (Máy xay thịt một chiều - One-Way Hashing):** Bạn bỏ một miếng thịt bò (Mật khẩu "Pass123!") vào cối xay. Chiếc cối xay ra đĩa thịt xay nhuyễn ($hash$). Bất kỳ ai nhìn vào đĩa thịt xay cũng không bao giờ có thể "xay ngược" lại thành miếng thịt bò nguyên vẹn! Nếu hacker dùng card đồ họa GPU cực mạnh để thử hàng tỷ mật khẩu mỗi giây: **Argon2id chính là chiếc cối xay đổ thêm cát và xi măng (Memory-hard)**, ép card đồ họa phải tốn hàng trăm megabyte RAM cho mỗi lần xay, làm tốc độ giải mã của hacker chậm đi hàng triệu lần!
* **JWT Khóa Đối xứng HS256 (Mật mã dùng chung giữa hai điệp viên):** Server Auth và Server Resource cùng giữ chung một mật khẩu bí mật (Shared Secret). Nếu Server Resource bị hacker xâm nhập đọc trộm file \`.env\`, hacker có thể tự đóng giả Server Auth để in tiền và ký token giả mạo cho mọi tài khoản!
* **JWT Khóa Bất đối xứng RS256/ES256 (Con dấu sáp hoàng gia):** Hoàng đế (Auth Server) giữ chiếc nhẫn khắc dấu duy nhất trong két sắt (Private Key) để đóng dấu lên chiếu chỉ (Access Token). Hàng trăm vị tướng ngoài biên ải (Microservices) chỉ cầm bản in hình con dấu (Public Key) để soi xem chiếu chỉ có đúng do hoàng đế ký hay không. Dù tướng giặc có cướp được Public Key, chúng cũng không tài nào tự khắc được con dấu giả!

---

# 2. CUỘC CHIẾN BĂM MẬT KHẨU: TẠI SAO BCRYPT BỊ ARGON2ID VƯỢT MẶT?

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SỰ TIẾN HÓA CỦA CÁC THUẬT TOÁN BĂM MẬT KHẨU        │
├──────────────┬──────────────────┬───────────────────────────────────────────┤
│ Thuật Toán   │ Cơ Chế Bảo Vệ    │ Lỗ Hổng / Điểm Yếu Thực Tế                │
├──────────────┼──────────────────┼───────────────────────────────────────────┤
│ MD5 / SHA-256│ CPU Hashing thô  │ Bị phá trong vài giây bằng GPU / ASIC     │
│ PBKDF2       │ CPU Iterations   │ Vẫn bị GPU bẻ khóa nhanh vì tốn rất ít RAM│
│ Bcrypt       │ Eksblowfish      │ Giới hạn độ dài mật khẩu 72 bytes!        │
│ Argon2id     │ Memory-Hardness  │ Chuẩn vô địch Password Hashing Competition│
│ (Khuyên Dùng)│ + Side-channel   │ Chống cả tấn công GPU, ASIC lẫn Cache     │
└──────────────┴──────────────────┴───────────────────────────────────────────┘
\`\`\`

### 2.1 Cấu Hình Chuẩn Của Argon2id Trong Doanh Nghiệp
\`\`\`typescript
import * as argon2 from 'argon2';

// Băm mật khẩu với cơ chế ngốn RAM (Memory-hard) chống ASIC
const hash = await argon2.hash(plainPassword, {
  type: argon2.argon2id, // Kết hợp cả Argon2i (chống timing attack) và Argon2d (chống GPU)
  memoryCost: 2 ** 16,   // 64 MB RAM cho mỗi lần hash
  timeCost: 3,           // 3 vòng lặp tính toán
  parallelism: 1,        // 1 luồng xử lý
});
\`\`\`

---

# 3. KÝ TOKEN BẤT ĐỐI XỨNG: TẠI SAO MICROSERVICES BẮT BUỘC PHẢI DÙNG RS256 HOẶC ES256?

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KIẾN TRÚC XÁC THỰC MICROSERVICES VỚI RS256         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ AUTH SERVICE (Trung tâm định danh) ]                                     │
│    ├── Giữ PRIVATE KEY (Tuyệt mật trong KMS / Vault)                        │
│    └── Ký Token: jwt.sign(payload, privateKey, { algorithm: 'RS256' })      │
│                                                                             │
│  [ CÁC MICROSERVICES NỘI BỘ (Orders, Payments, Billing, Analytics...) ]      │
│    ├── Chỉ nạp PUBLIC KEY (Công khai an toàn, đọc qua JWKS endpoint)        │
│    └── Tự xác minh Token độc lập:                                           │
│        jwt.verify(token, publicKey, { algorithms: ['RS256'] })              │
│        (100% Offline verification, 0 ms gọi mạng ngược về AuthService!)     │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

> **Cảnh báo Lỗ hổng Nguy hiểm - "None" Algorithm & Key Confusion Attack:** Khi gọi hàm verify token, nếu đại ca không chỉ định rõ \`algorithms: ['RS256']\`, kẻ tấn công có thể sửa Header thành \`"alg": "none"\` (bỏ qua xác minh chữ ký) hoặc dùng chính Public Key của bạn để ký giả mạo bằng thuật toán HS256!

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Phối Mật Mã Học Ứng Dụng (Cryptography Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MẬT MÃ HỌC ỨNG DỤNG CHO BACKEND                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. ONE-WAY HASHING (Lưu trữ mật khẩu, checksum dữ liệu)                     │
│    ├── Lưu Password người dùng: Argon2id, Scrypt, Bcrypt                     │
│    └── Checksum / Idempotency Fingerprint: SHA-256, BLAKE3                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. SYMMETRIC ENCRYPTION (Mã hóa đối xứng 2 chiều: Dùng chung 1 Key)         │
│    └── AES-256-GCM, ChaCha20-Poly1305: Mã hóa thẻ tín dụng trong Database   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. ASYMMETRIC CRYPTOGRAPHY (Mã hóa bất đối xứng: Cặp Private/Public Key)    │
│    ├── Chữ ký số xác thực Token: RSA-2048 (RS256), ECDSA (ES256), Ed25519   │
│    └── Trao đổi khóa đường truyền: TLS 1.3 Diffie-Hellman                   │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Ký Và Xác Minh JWT Token Bất Đối Xứng (JWT RS256 Flow)
\`\`\`diagram
[ NGƯỜI DÙNG ĐĂNG NHẬP: POST /auth/login ]
                    │
                    ▼
[ AUTH SERVICE: Kiểm tra Argon2id password ] ──► [ HỢP LỆ ]
                    │
                    ▼
Nạp Private Key (PEM) ──► Ký JWT: Sign(Header + Payload, PrivateKey)
                    │
                    ▼ Trả về Access Token cho Client
[ CLIENT: Gửi Token đến Orders Service (Header: Bearer xxx) ]
                    │
                    ▼
[ ORDERS SERVICE: Xác minh hoàn toàn cục bộ bằng Public Key ]
                    │
     Chữ ký số có khớp với Public Key?
     ├── [ KHỚP ] ──────► Cho phép tiếp tục xử lý nghiệp vụ đơn hàng!
     └── [ KHÔNG KHỚP ] ─► Ném lỗi 401 Unauthorized trục xuất ngay!
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Thuật Toán Ký Token (Algorithm Tree)
\`\`\`diagram
BẠN CẦN CHỌN THUẬT TOÁN KÝ TOKEN CHO HỆ THỐNG?
│
├── Ứng dụng Monolith đơn lẻ, chỉ có đúng 1 backend duy nhất tự tạo tự check?
│   └──► DÙNG: HS256 (Mật khẩu bí mật dài >= 64 ký tự ngẫu nhiên)
│
└── Kiến trúc Microservices hoặc cho phép bên thứ ba xác thực?
    ├── Chuẩn doanh nghiệp tương thích rộng rãi nhất:
    │   └──► DÙNG: RS256 (RSA 2048/4096 bits)
    └── Yêu cầu tốc độ ký/verify cực nhanh, kích thước token siêu nhỏ gọn:
        └──► DÙNG: ES256 (ECDSA P-256) hoặc Ed25519
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Thuật Toán | Kiểu Khóa | Tốc Độ Verify | Kích Thước Chữ Ký | Rủi Ro Rò Rỉ Khóa |
| :--- | :--- | :--- | :--- | :--- |
| **HS256** | Đối xứng (Shared Secret) | Siêu nhanh | Nhỏ gọn | Rất cao (Lộ secret ở 1 service là toang cả cụm) |
| **RS256** | Bất đối xứng (Private/Public) | Trung bình | Khá lớn (~256 bytes) | Rất an toàn (Private Key giấu kín ở Auth) |
| **ES256** | Đường cong Elliptic | Nhanh hơn RS256 | Siêu nhỏ (~64 bytes) | Rất an toàn, chuẩn hiện đại |
| **Bcrypt** | Băm mật khẩu | Chậm cố ý (Cost) | Chuỗi 60 ký tự | Bị giới hạn độ dài 72 ký tự |
| **Argon2id**| Băm mật khẩu | Chậm ngốn RAM | Chuỗi có salt tự sinh | Chống tấn công phần cứng tốt nhất |
`,
      realCodeSnippet: `
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';

@Injectable()
export class EnterpriseAuthCryptoService {
  // Cặp khóa bất đối xứng RSA (Trong thực tế nạp từ AWS KMS hoặc file .pem bí mật)
  private readonly rsaPrivateKey: string = process.env.JWT_PRIVATE_KEY || '';
  private readonly rsaPublicKey: string = process.env.JWT_PUBLIC_KEY || '';

  /**
   * Băm mật khẩu người dùng bằng Argon2id chống card đồ họa GPU brute-force
   */
  public async hashPassword(plainText: string): Promise<string> {
    return await argon2.hash(plainText, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Ký Token bằng khóa bí mật Private Key với thuật toán RS256
   */
  public issueAccessToken(payload: { userId: string; role: string }): string {
    return jwt.sign(payload, this.rsaPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '15m',
      issuer: 'https://auth.esmiles.vn',
      audience: 'https://api.esmiles.vn',
    });
  }

  /**
   * Xác minh Token bằng Public Key: Chặn đứng Key Confusion và 'none' algorithm
   */
  public verifyAccessToken(token: string): jwt.JwtPayload {
    try {
      const decoded = jwt.verify(token, this.rsaPublicKey, {
        algorithms: ['RS256'], // Ép buộc chỉ chấp nhận RS256, cấm HS256 và none!
        issuer: 'https://auth.esmiles.vn',
        audience: 'https://api.esmiles.vn',
      });
      return decoded as jwt.JwtPayload;
    } catch (err: any) {
      throw new UnauthorizedException(\`Token không hợp lệ hoặc đã hết hạn: \${err.message}\`);
    }
  }
}
`,
      quiz: [
        {
          id: 'c9-l1-q1',
          question: 'Vì sao trong kiến trúc Microservices phân tán, thuật toán ký JWT bất đối xứng (RS256/ES256) lại an toàn vượt trội so với thuật toán đối xứng (HS256)?',
          options: [
            'Chỉ có Auth Service nắm giữ Private Key để ký, các service nội bộ khác chỉ cần Public Key để xác minh mà không thể tạo token giả.',
            'Vì thuật toán RS256 tự động sao lưu toàn bộ thông tin đăng nhập của người dùng vào bộ nhớ đệm đám mây.',
            'Vì các khóa bất đối xứng có khả năng tự động gia hạn thời gian sống của token mỗi khi người dùng gọi API.',
            'Vì thuật toán HS256 bị cấm sử dụng trên tất cả các trình duyệt web hiện đại theo quy chuẩn của tổ chức W3C.',
          ],
          correctIndex: 0,
          explanation: 'Với HS256, tất cả các Microservices muốn kiểm tra token đều phải chia sẻ chung một chuỗi bí mật (Shared Secret). Nếu một service phụ (như Analytics Service) bị tấn công lộ secret, hacker có thể tự tạo bất kỳ token Admin nào để chiếm quyền toàn bộ hệ thống. Với RS256, chỉ duy nhất Auth Service giữ Private Key; các service khác chỉ giữ Public Key để đọc, dù lộ Public Key cũng không ai có thể làm giả chữ ký.'
        },
        {
          id: 'c9-l1-q2',
          question: 'Lỗ hổng "Algorithm Confusion Attack" trong xác minh JWT token xảy ra khi nào và làm thế nào để phòng chống triệt để trong mã nguồn?',
          options: [
            'Khi kẻ tấn công đổi header sang HS256 và dùng Public Key làm bí mật ký token; phòng chống bằng cách ép cứng algorithms: ["RS256"].',
            'Khi người dùng nhập mật khẩu có chứa cả chữ hoa lẫn chữ thường khiến thuật toán băm bị xung đột bộ nhớ.',
            'Khi thời gian đồng hồ giữa hai máy chủ bị lệch nhau quá năm phút khiến cho hạn dùng exp của token bị sai.',
            'Khi máy chủ cơ sở dữ liệu bị mất kết nối mạng trong lúc đang kiểm tra quyền hạn của người dùng.',
          ],
          correctIndex: 0,
          explanation: 'Nếu thư viện verify không ép buộc thuật toán, kẻ tấn công sẽ sửa Header của token từ RS256 sang HS256, và dùng chính Public Key của server (vốn là chuỗi công khai) làm khóa bí mật đối xứng để ký một payload giả mạo. Server ngây thơ dùng Public Key đưa vào hàm verify HS256 sẽ thấy chữ ký trùng khớp và chấp nhận! Phòng chống bằng cách luôn chỉ định danh sách thuật toán hợp lệ: algorithms: ["RS256"].'
        },
        {
          id: 'c9-l1-q3',
          question: 'Đặc tính "Memory-Hardness" của thuật toán băm Argon2id mang lại lợi thế phòng thủ cốt tử nào trước các cuộc tấn công bẻ khóa mật khẩu?',
          options: [
            'Bắt buộc mỗi lần băm phải tiêu tốn hàng chục megabyte bộ nhớ RAM khiến các chip chuyên dụng ASIC và GPU bị nghẽn bộ đệm không thể chạy song song.',
            'Tự động xóa sạch toàn bộ các bản ghi mật khẩu cũ trong cơ sở dữ liệu nếu phát hiện có hành vi đăng nhập sai quá năm lần.',
            'Cho phép giải mã mật khẩu ngược lại thành dạng văn bản thuần túy trong trường hợp người dùng bị quên mật khẩu.',
            'Giúp giảm kích thước của chuỗi mã băm xuống còn đúng tám ký tự nhị phân để tiết kiệm dung lượng lưu trữ trên đĩa cứng.',
          ],
          correctIndex: 0,
          explanation: 'Các card đồ họa GPU hoặc chip ASIC có hàng nghìn nhân tính toán song song có thể thử hàng tỷ mật khẩu SHA-256 mỗi giây vì mỗi phép toán chỉ tốn vài byte bộ nhớ. Argon2id được thiết kế dạng "Memory-Hard": ép mỗi phép tính băm phải tốn hàng chục MB RAM (ví dụ 64MB). Một GPU dù có 16GB RAM cũng chỉ có thể chạy song song vài chục phép toán cùng lúc, bẻ gãy hoàn toàn ưu thế tấn công bằng phần cứng mạnh của hacker.'
        },
        {
          id: 'c9-l1-q4',
          question: 'Nhược điểm cố hữu lớn nhất của thuật toán băm Bcrypt mà khiến nó dần bị thay thế bởi Argon2id trong các tiêu chuẩn bảo mật hiện đại là gì?',
          options: [
            'Bcrypt âm thầm cắt ngắn mật khẩu đầu vào ở mức tối đa 72 bytes, mọi ký tự từ byte thứ 73 trở đi đều bị bỏ qua hoàn toàn.',
            'Bcrypt bắt buộc phải có kết nối mạng Internet trực tiếp tới máy chủ của tác giả thì mới có thể sinh ra chuỗi mã băm.',
            'Bcrypt không hỗ trợ việc thêm chuỗi muối ngẫu nhiên (Salt) vào trước mật khẩu của người dùng khi lưu trữ.',
            'Bcrypt chỉ hoạt động trên các hệ thống tệp tin sử dụng bảng mã định dạng ASCII cổ điển của thập niên 1980.',
          ],
          correctIndex: 0,
          explanation: 'Bcrypt dựa trên thuật toán mã hóa khối Blowfish và có một hạn chế kỹ thuật rất nguy hiểm: Nó chỉ xử lý tối đa 72 bytes đầu tiên của mật khẩu! Nếu người dùng đặt mật khẩu dài 100 ký tự, 28 ký tự sau bị bỏ qua hoàn toàn mà người dùng không hề hay biết (hai mật khẩu giống nhau 72 ký tự đầu sẽ ra cùng mã hash). Argon2id không có giới hạn này và có khả năng chống tấn công phần cứng tốt hơn rất nhiều.'
        }
      ],
      codeChallenge: {
        id: 'c9-l1-c1',
        title: 'Bộ Thẩm Định Thuật Toán Header Chống Lỗi Key Confusion (JWT Alg Guard)',
        description: 'Hiện thực hàm \`validateJwtAlgorithm(headerAlg: string, allowedAlgorithms: string[]): { isAllowed: boolean; safeAlg: string | null }\`. Nếu \`headerAlg\` nằm trong danh sách \`allowedAlgorithms\` VÀ \`headerAlg.toLowerCase() !== "none"\`, trả về \`{ isAllowed: true, safeAlg: headerAlg }\`. Nếu là \`"none"\` hoặc không nằm trong danh sách cho phép, trả về \`{ isAllowed: false, safeAlg: null }\`.',
        starterCode: `
export function validateJwtAlgorithm(
  headerAlg: string,
  allowedAlgorithms: string[]
): { isAllowed: boolean; safeAlg: string | null } {
  // TODO: Hiện thực kiểm tra thuật toán JWT an toàn
  return { isAllowed: false, safeAlg: null };
}
`,
        solution: `
export function validateJwtAlgorithm(
  headerAlg: string,
  allowedAlgorithms: string[]
): { isAllowed: boolean; safeAlg: string | null } {
  if (!headerAlg || headerAlg.toLowerCase() === 'none') {
    return { isAllowed: false, safeAlg: null };
  }

  if (allowedAlgorithms.includes(headerAlg)) {
    return { isAllowed: true, safeAlg: headerAlg };
  }

  return { isAllowed: false, safeAlg: null };
}
`,
        testCases: [
          {
            name: 'Chấp nhận thuật toán RS256 hợp lệ trong whitelist',
            input: ['RS256', ['RS256', 'ES256']],
            expected: { isAllowed: true, safeAlg: 'RS256' }
          },
          {
            name: 'Chặn đứng thuật toán "none" nguy hiểm',
            input: ['none', ['RS256', 'none']],
            expected: { isAllowed: false, safeAlg: null }
          },
          {
            name: 'Chặn thuật toán HS256 khi server chỉ cho phép RS256 (Chống Key Confusion)',
            input: ['HS256', ['RS256']],
            expected: { isAllowed: false, safeAlg: null }
          }
        ]
      }
    },
    {
      id: 'c9-l2',
      title: 'Bài 02: Kiến Trúc Phân Quyền Doanh Nghiệp: RBAC vs ABAC (CASL) & Cơ Chế Thu Hồi Token (Revocation Blocklist)',
      duration: '60 phút',
      tag: 'Authorization & RBAC/ABAC',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: THẺ ĐEO PHÒNG BAN VS LUẬT PHÁP HIẾN PHÁP LINH HOẠT

Khi hệ thống doanh nghiệp lớn dần, câu hỏi "Ai được quyền làm gì?" không còn đơn giản là kiểm tra xem bạn là Admin hay User:
* **Phân quyền theo vai trò (Role-Based Access Control - RBAC - Chiếc thẻ đeo phòng ban):** Bạn đeo chiếc thẻ ghi chữ "KẾ TOÁN" (\`Role.ACCOUNTANT\`). Bạn được vào phòng kế toán, được xem sổ cái. Nhưng nếu công ty có 100 chi nhánh: Kế toán chi nhánh Cần Thơ có được sửa sổ cái của chi nhánh Hà Nội không? Kế toán viên có được tự duyệt hóa đơn do chính mình tạo ra không? **RBAC hoàn toàn bất lực!** Nếu cố dùng RBAC, bạn sẽ bị bùng nổ số lượng vai trò: \`ACCOUNTANT_HN\`, \`ACCOUNTANT_CT\`, \`ACCOUNTANT_LEAD\`... ma trận vai trò biến thành mớ bòng bong không thể quản lý!
* **Phân quyền theo thuộc tính (Attribute-Based Access Control - ABAC / CASL - Điều luật hiến pháp):** Thay vì nhìn vào chức danh, người gác cổng đối chiếu 4 thuộc tính: **Chủ thể (Subject - Ai?)**, **Hành động (Action - Làm gì?)**, **Tài nguyên (Resource - Lên cái gì?)**, và **Ngữ cảnh (Context - Ở đâu, khi nào?)**. Ví dụ: *"Người dùng X được quyền SỬA bài viết Y NẾU X là TÁC GIẢ của Y VÀ bài viết Y ĐANG Ở TRẠNG THÁI DRAFT VÀ thời gian hiện tại nằm trong giờ hành chính"*. Cực kỳ uyển chuyển và chuẩn mực!
* **Cơ chế thu hồi Token (Token Revocation Blocklist):** JWT là vô trạng thái (Stateless). Bạn vừa cấp Access Token sống 2 giờ cho nhân viên. 5 phút sau, nhân viên đó bị đuổi việc vì làm rò rỉ dữ liệu. Token vẫn còn hạn 1 tiếng 55 phút! Nếu không có sổ đen thu hồi (Revocation Blocklist trên Redis), cựu nhân viên vẫn có thể gọi API phá hoại công ty suốt 2 giờ đó!

---

# 2. KIẾN TRÚC ABAC VỚI THƯ VIỆN CASL TRONG NESTJS

CASL cho phép định nghĩa các quy tắc quyền hạn dưới dạng ngôn ngữ tự nhiên:
\`\`\`typescript
import { AbilityBuilder, createMongoAbility } from '@casl/ability';

export function defineAbilityFor(user: User) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (user.role === 'ADMIN') {
    can('manage', 'all'); // Admin toàn quyền
  } else {
    can('read', 'Article'); // Mọi người đều được đọc bài viết
    can('update', 'Article', { authorId: user.id }); // Chỉ tác giả mới được sửa bài của mình
    cannot('delete', 'Article', { isPublished: true }); // Bài đã xuất bản thì cấm xóa!
  }

  return build();
}
\`\`\`

---

# 3. GIẢI QUYẾT BÀI TOÁN THU HỒI TOKEN (JWT REVOCATION) VỚI REDIS

Làm thế nào để thu hồi ngay lập tức một Access Token vô trạng thái (Stateless JWT)?

\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CHIẾN LƯỢC QUẢN LÝ THU HỒI TOKEN TRÊN REDIS           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. KHI CẤP TOKEN (Auth Service):                                            │
│    └── Gắn thêm claim định danh duy nhất vào Payload: jti: uuid_v4          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. KHI NGƯỜI DÙNG BẤM "LOGOUT" HOẶC ĐỔI MẬT KHẨU:                           │
│    └── Đẩy jti vào Redis Blocklist:                                         │
│        SET blocklist:<jti> "1" EX <thời_gian_còn_lại_của_token>             │
│        (Hết hạn token thì Redis tự động xóa jti khỏi RAM, không tốn bộ nhớ!)│
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. TRONG NESTJS AUTH GUARD:                                                 │
│    ├── 1. Xác minh chữ ký RSA token (Hợp lệ)                                │
│    └── 2. Tra cứu Redis: EXISTS blocklist:<payload.jti>                     │
│           ├── [ CÓ TRONG BLOCKLIST ] ──► Ném lỗi 401: Token đã bị thu hồi!  │
│           └── [ KHÔNG CÓ ] ───────────► Cho phép tiếp tục request!          │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Phân Cấp Các Cơ Chế Kiểm Soát Truy Cập (Access Control Taxonomy)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HỆ THỐNG KIỂM SOÁT TRUY CẬP                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. DAC (Discretionary): Chủ tài nguyên tự gán quyền cho người khác (Unix)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. MAC (Mandatory): Phân loại mật theo cấp bậc quân sự (Top Secret, Secret) │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. RBAC (Role-Based): Phân quyền theo chức danh vai trò tĩnh (Admin, User)  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. ABAC / PBAC (Policy/Attribute-Based): Phân quyền động theo ngữ cảnh      │
│    ├── Thuộc tính người dùng: Department, Clearances, Location              │
│    ├── Thuộc tính tài nguyên: OwnerId, Status, SensitivityLevel             │
│    └── Thuộc tính môi trường: TimeOfDay, IP Subnet, Device Trust            │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: Dòng Chảy Thẩm Định Quyền Hạn ABAC (Policy Decision Point Flow)
\`\`\`diagram
User gửi request: PATCH /articles/42
   │
   ▼
Guard trích xuất: User Object + Target Article (id: 42, authorId: 99, status: 'PUBLISHED')
   │
   ▼
Khởi tạo CASL Ability cho User hiện tại
   │
   ▼
Kiểm tra: ability.can('update', subject('Article', targetArticle))
   ├── [ THỎA MÃN TẤT CẢ QUY TẮC ]
   │      └──► Cho phép Controller thực thi cập nhật!
   │
   └── [ VI PHẠM (Ví dụ: Không phải tác giả hoặc bài đã Publish) ]
          └──► Ném lỗi 403 Forbidden: "Bạn không có quyền chỉnh sửa tài nguyên này!"
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Lựa Chọn Mô Hình Phân Quyền (Authz Decision Tree)
\`\`\`diagram
BẠN CẦN THIẾT KẾ HỆ THỐNG PHÂN QUYỀN?
│
├── Hệ thống đơn giản, chỉ cần phân biệt quyền theo menu (Admin xem hết, User xem ít)?
│   └──► DÙNG: RBAC (Role-Based Access Control với Decorator @Roles('ADMIN'))
│
└── Hệ thống có phân quyền đa chi nhánh, sở hữu dữ liệu, ràng buộc trạng thái nghiệp vụ?
    └──► BẮT BUỘC DÙNG: ABAC (Attribute-Based với CASL hoặc Open Policy Agent)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Mô Hình Phân Quyền | Tính Linh Hoạt | Độ Phức Tạp Triển Khai | Chi Phí Truy Vấn DB | Rủi Ro Vận Hành |
| :--- | :--- | :--- | :--- | :--- |
| **RBAC Đơn Giản** | Rất thấp (Cứng nhắc) | Cực kỳ đơn giản | $0\\%$ (Lưu sẵn trong Token) | Bùng nổ số lượng Role (Role Explosion) |
| **ABAC (CASL)** | Tối đa, không giới hạn | Trung bình / Cao | Cần query thêm đối tượng để check| Cần viết unit test chính sách chặt chẽ |
| **JWT Blacklist Redis**| Thu hồi token tức thì | Thấp | Tốn 1 lần GET Redis mỗi request | Phụ thuộc vào độ ổn định của Redis |
| **Token Versioning** | Thu hồi toàn bộ thiết bị| Rất thấp | Chỉ check số nguyên version | Không thu hồi được lẻ 1 thiết bị |
`,
      realCodeSnippet: `
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

@Injectable()
export class EnterpriseAuthzGuard implements CanActivate {
  private readonly redis = new Redis();

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Đã được giải mã từ JWT

    if (!user) {
      throw new UnauthorizedException('Chưa xác thực danh tính.');
    }

    // 1. Kiểm tra Token Revocation Blocklist trên Redis qua jti claim
    if (user.jti) {
      const isBlacklisted = await this.redis.exists(\`blocklist:\${user.jti}\`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
      }
    }

    // 2. Kiểm tra quyền hạn theo vai trò tối thiểu (RBAC Check)
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Bạn không có đủ vai trò để truy cập tài nguyên này.');
    }

    return true;
  }
}
`,
      quiz: [
        {
          id: 'c9-l2-q1',
          question: 'Hiện tượng "Role Explosion" (Bùng nổ vai trò) là gì và vì sao kiến trúc ABAC lại giải quyết triệt để vấn đề này?',
          options: [
            'Hiện tượng số lượng role tăng theo cấp số nhân khi cố dùng RBAC cho các điều kiện dữ liệu chi tiết; ABAC giải quyết bằng quy tắc động.',
            'Hiện tượng người dùng tự động được nâng cấp lên quyền quản trị viên tối cao khi máy chủ bị mất điện đột ngột.',
            'Hiện tượng cơ sở dữ liệu bị phân mảnh ổ cứng khi tạo quá nhiều bảng dữ liệu quan hệ trong cùng một lược đồ.',
            'Hiện tượng trình duyệt tự động xóa bỏ các vai trò của người dùng nếu không đăng nhập trong vòng ba mươi ngày.',
          ],
          correctIndex: 0,
          explanation: 'Khi hệ thống phức tạp, nếu chỉ dùng RBAC, để xử lý các nghiệp vụ như "Kế toán chi nhánh Hà Nội chỉ xem đơn Hà Nội", ta buộc phải tạo ra hàng loạt role mới: ACCOUNTANT_HN, ACCOUNTANT_HCM, MANAGER_HN... dẫn đến hàng trăm role không thể kiểm soát (Role Explosion). ABAC giải quyết triệt để bằng cách chỉ giữ 1 role ACCOUNTANT, và dùng quy tắc động: user.branchId === record.branchId.'
        },
        {
          id: 'c9-l2-q2',
          question: 'Vì sao khi đưa một Token ID (jti) vào Redis Blocklist để thu hồi quyền truy cập, ta bắt buộc phải gán thời gian sống (TTL) cho khóa đó?',
          options: [
            'Thời gian sống đúng bằng thời gian hết hạn còn lại của token giúp khóa tự biến mất khi token hết hạn, tránh phình to bộ nhớ RAM.',
            'Để bảo đảm rằng người dùng sẽ tự động được phục hồi lại quyền hạn sau đúng mười lăm phút kể từ khi bị sa thải.',
            'Vì cơ sở dữ liệu Redis bắt buộc tất cả các khóa lưu trữ đều phải có tham số thời gian nếu không sẽ bị ném lỗi.',
            'Để hỗ trợ việc mã hóa lại token bằng các thuật toán khóa công khai theo tiêu chuẩn an toàn của bộ quốc phòng.',
          ],
          correctIndex: 0,
          explanation: 'Một JWT Token tự nó sẽ mất hiệu lực sau khi trôi qua mốc exp (Expiration Time). Do đó, ta chỉ cần lưu jti vào Redis Blocklist trong khoảng thời gian còn lại của token đó (TTL = exp - Date.now()). Khi token đã tự hết hạn tự nhiên, việc lưu jti trong Redis không còn ý nghĩa gì nữa; cờ TTL sẽ tự động xóa sạch jti khỏi RAM, giúp Redis không bao giờ bị tràn bộ nhớ.'
        },
        {
          id: 'c9-l2-q3',
          question: 'Trong mô hình phân quyền ABAC (Attribute-Based Access Control), bốn nhóm thuộc tính cơ bản nào được sử dụng để đưa ra quyết định cấp quyền?',
          options: [
            'Chủ thể (Subject), Hành động (Action), Tài nguyên đích (Resource) và Ngữ cảnh môi trường xung quanh (Environment Context).',
            'Địa chỉ IP máy chủ, Số lượng lõi của vi xử lý CPU, Tốc độ đường truyền mạng và Dung lượng bộ nhớ RAM còn trống.',
            'Tên đăng nhập của người dùng, Mật khẩu đã băm, Số điện thoại cá nhân và Mã số định danh căn cước công dân.',
            'Tên bảng cơ sở dữ liệu, Khóa chính của bản ghi, Số lượng cột dữ liệu và Phiên bản của hệ điều hành Linux máy chủ.',
          ],
          correctIndex: 0,
          explanation: 'ABAC ra quyết định dựa trên bộ tứ thuộc tính: 1) Subject Attributes (ai đang yêu cầu: role, phòng ban, điểm tín nhiệm); 2) Action Attributes (muốn làm gì: READ, UPDATE, DELETE); 3) Resource Attributes (lên đối tượng nào: chủ sở hữu, trạng thái bản ghi, độ nhạy cảm); 4) Environment/Context (trong điều kiện nào: giờ hành chính, mạng nội bộ VPN, thiết bị tin cậy).'
        },
        {
          id: 'c9-l2-q4',
          question: 'Kỹ thuật "Token Versioning" (Lưu phiên bản token trong bảng User) đem lại giải pháp tối ưu nào khi người dùng muốn "Đăng xuất khỏi tất cả thiết bị"?',
          options: [
            'Chỉ cần tăng số token_version của User trong Database lên 1, toàn bộ các token cũ mang version cũ lập tức bị vô hiệu hóa đồng loạt.',
            'Tự động gửi email yêu cầu người dùng phải gỡ bỏ cài đặt ứng dụng trên toàn bộ các thiết bị điện thoại thông minh.',
            'Ép buộc toàn bộ các máy chủ API phải khởi động lại để xóa sạch bộ nhớ đệm của các kết nối mạng hiện hành.',
            'Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống và yêu cầu người dùng phải thực hiện đăng ký tài khoản mới.',
          ],
          correctIndex: 0,
          explanation: 'Khi cấp token, payload có thêm claim: { tokenVersion: 1 }. Khi người dùng bấm "Đăng xuất khỏi tất cả thiết bị" hoặc đổi mật khẩu, ta chỉ cần chạy 1 câu SQL: UPDATE users SET token_version = token_version + 1. Khi request đến, Guard đối chiếu tokenVersion trong token với Database: nếu version cũ (< 2), lập tức từ chối, vô hiệu hóa hàng loạt mọi thiết bị mà không cần lưu từng jti vào Redis.'
        }
      ],
      codeChallenge: {
        id: 'c9-l2-c1',
        title: 'Bộ Thẩm Định Quyền Truy Cập ABAC Động (Dynamic Policy Evaluator)',
        description: 'Hiện thực hàm \`evaluateAbacPolicy(user: { id: string; role: string }, action: string, resource: { ownerId: string; isLocked: boolean }): { granted: boolean; reason: string }\`. Quy tắc: 1. Nếu \`user.role === "ADMIN"\`, luôn luôn \`{ granted: true, reason: "ADMIN_OVERRIDE" }\`. 2. Nếu \`resource.isLocked === true\`, luôn luôn \`{ granted: false, reason: "RESOURCE_LOCKED" }\`. 3. Nếu \`action === "UPDATE"\` hoặc \`"DELETE"\`, chỉ cho phép nếu \`user.id === resource.ownerId\` (ngược lại từ chối \`"NOT_OWNER"\`). 4. Nếu \`action === "READ"\`, luôn \`{ granted: true, reason: "READ_ALLOWED" }\`.',
        starterCode: `
export function evaluateAbacPolicy(
  user: { id: string; role: string },
  action: string,
  resource: { ownerId: string; isLocked: boolean }
): { granted: boolean; reason: string } {
  // TODO: Hiện thực thẩm định quyền hạn theo thuộc tính ABAC
  return { granted: false, reason: '' };
}
`,
        solution: `
export function evaluateAbacPolicy(
  user: { id: string; role: string },
  action: string,
  resource: { ownerId: string; isLocked: boolean }
): { granted: boolean; reason: string } {
  // 1. Admin toàn quyền
  if (user.role === 'ADMIN') {
    return { granted: true, reason: 'ADMIN_OVERRIDE' };
  }

  // 2. Tài nguyên bị khóa
  if (resource.isLocked) {
    return { granted: false, reason: 'RESOURCE_LOCKED' };
  }

  // 3. Thao tác sửa hoặc xóa
  if (action === 'UPDATE' || action === 'DELETE') {
    if (user.id === resource.ownerId) {
      return { granted: true, reason: 'OWNER_ALLOWED' };
    }
    return { granted: false, reason: 'NOT_OWNER' };
  }

  // 4. Đọc dữ liệu
  if (action === 'READ') {
    return { granted: true, reason: 'READ_ALLOWED' };
  }

  return { granted: false, reason: 'UNSUPPORTED_ACTION' };
}
`,
        testCases: [
          {
            name: 'Admin luôn được cấp quyền bất kể tài nguyên bị khóa',
            input: [{ id: 'u1', role: 'ADMIN' }, 'DELETE', { ownerId: 'u2', isLocked: true }],
            expected: { granted: true, reason: 'ADMIN_OVERRIDE' }
          },
          {
            name: 'User thường bị từ chối sửa tài nguyên của người khác',
            input: [{ id: 'u1', role: 'USER' }, 'UPDATE', { ownerId: 'u2', isLocked: false }],
            expected: { granted: false, reason: 'NOT_OWNER' }
          },
          {
            name: 'Chính chủ được phép sửa bài viết khi chưa bị khóa',
            input: [{ id: 'u1', role: 'USER' }, 'UPDATE', { ownerId: 'u1', isLocked: false }],
            expected: { granted: true, reason: 'OWNER_ALLOWED' }
          }
        ]
      }
    },
    {
      id: 'c9-l3',
      title: 'Bài 03: Phòng Chống Lỗ Hổng Web Cấp Hệ Thống: SQL Injection Bắc Cầu, Mass Assignment, CSRF & Replay Attacks',
      duration: '60 phút',
      tag: 'Web System Vulnerabilities',
      theory: `
# 1. ẨN DỤ TRỰC QUAN: LÁ PHIẾU BỎ VÀO HÒM VS MÓN QUÀ CÓ CHÈN CHẤT CẤM

Bảo mật Web không chỉ là viết code chạy được, mà là tư duy phản diện trước mọi dữ liệu đầu vào:
* **SQL Injection (Đổi nghĩa câu lệnh trong hòm thư):** Thay vì điền tên "Minh Oanh", kẻ xấu điền tên: \`' OR '1'='1'; DROP TABLE users; --\`. Nếu bạn ghép chuỗi thô (\`string concatenation\`), bộ máy SQL bị lừa: Từ một người dùng hiền lành biến thành một chỉ thị phá hoại xóa sạch cơ sở dữ liệu!
* **Mass Assignment (Món quà có giấu thêm chất cấm):** Bạn tạo một form cho phép người dùng sửa thông tin cá nhân (name, phone, address). Bạn ngây thơ lấy toàn bộ \`req.body\` ném thẳng vào Database (\`update(req.body)\`). Kẻ tấn công tinh vi chèn thêm một trường ẩn: \`{ "isAdmin": true, "balance": 999999999 }\`. Nếu không có DTO lọc trắng (Whitelist DTO), kẻ tấn công tự nâng mình thành Hoàng đế chỉ bằng một nút bấm!
* **CSRF Attack (Bức thư giả mạo chữ ký):** Bạn đang đăng nhập vào trang ngân hàng. Bạn vô tình bấm vào một đường link xem ảnh mèo dễ thương trên một trang web lạ. Trang web lạ đó ngầm gửi một request \`POST /api/transfer\` sang ngân hàng. Vì bạn đang đăng nhập, trình duyệt tự động đính kèm Cookie ngân hàng của bạn vào request! Tiền của bạn bốc hơi trong tích tắc mà bạn không hề hay biết!

---

# 2. BẢO VỆ TUYỆT ĐỐI CHỐNG MASS ASSIGNMENT VỚI NESTJS VALIDATIONPIPE

Trong NestJS, lỗ hổng Mass Assignment xảy ra khi ta không thanh lọc các trường dữ liệu ngoài ý muốn.
Giải pháp chuẩn quốc tế là cấu hình **\`ValidationPipe\`** với 2 cờ bảo mật bắt buộc:

\`\`\`typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // TỰ ĐỘNG TƯỚC BỎ mọi thuộc tính không có trong DTO!
    forbidNonWhitelisted: true,  // NÉM LỖI 400 Bad Request nếu phát hiện có thuộc tính lạ!
    transform: true,            // Tự động ép kiểu nguyên thủy sang Class DTO
  })
);
\`\`\`

---

# 3. SQL INJECTION BẮC CẦU (PARAMETERIZED QUERIES)

Tại sao Parameterized Query (Truy vấn có tham số hóa) lại miễn nhiễm $100\\%$ với SQL Injection?
* **Cơ chế hoạt động:** Trình biên dịch SQL tách rời hoàn toàn 2 giai đoạn:
  1. **Giai đoạn phân tích cú pháp (Parsing Phase):** Database nhận câu lệnh \`SELECT * FROM users WHERE email = $1\`. Cây cú pháp (AST) được đóng băng cứng ngắc.
  2. **Giai đoạn truyền dữ liệu (Data Binding Phase):** Giá trị của \`$1\` được đưa vào như một chuỗi byte văn bản thuần túy, tuyệt đối không bao giờ được thông dịch thành mã lệnh!

\`\`\`typescript
// TUYỆT ĐỐI CẤM (Vulnerable SQL Injection):
await db.query(\`SELECT * FROM users WHERE email = '\${userInput}'\`);

// CHUẨN MỰC AN TOÀN (Parameterized Query):
await db.query('SELECT * FROM users WHERE email = $1', [userInput]);
\`\`\`

---

# 🧠 HỆ THỐNG HÓA KIẾN THỨC & SƠ ĐỒ TƯ DUY (ENGINEERING MIND MAP)

### 🗺️ Sơ đồ 1: Bản Đồ Các Tầng Phòng Ngự Ứng Dụng (Application Defense-in-Depth Map)
\`\`\`diagram
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TẦNG MẠNG & HEADER BẢO MẬT                         │
│  ├── Helmet: Chống Clickjacking (X-Frame-Options), XSS-Protection           │
│  └── CORS: Chặn nguồn gốc web lạ gọi API trái phép                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG DTO VALIDATION PIPELINE                       │
│  ├── class-validator: Kiểm tra format email, uuid, độ dài chuỗi             │
│  └── whitelist & forbidNonWhitelisted: Triệt tiêu Mass Assignment $100\\%$   │
├─────────────────────────────────────────────────────────────────────────────┤
│                          TẦNG TRUY VẤN DỮ LIỆU DATABASE                     │
│  ├── TypeORM / Prisma ORM: Parameterized Queries tự động                    │
│  └── Nguyên tắc đặc quyền tối thiểu (Least Privilege DB User)               │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### 🔄 Sơ đồ 2: So Sánh Xử Lý Câu Lệnh Ghép Chuỗi vs Parameterized Query
\`\`\`diagram
GHÉP CHUỖI NGUY HIỂM:
Input: 'admin@b.com' OR '1'='1'
SQL Parser: SELECT * FROM users WHERE email = 'admin@b.com' OR '1'='1'
(Biểu thức logic '1'='1' luôn đúng -> TRẢ VỀ TOÀN BỘ DATABASE NGƯỜI DÙNG!)

PARAMETERIZED QUERY AN TOÀN:
Template: SELECT * FROM users WHERE email = $1
Input: 'admin@b.com' OR '1'='1'
SQL Parser: Đi tìm đúng người có địa chỉ email là toàn bộ chuỗi ký tự thô đó!
(Không ai có email như vậy -> KẾT QUẢ RỖNG, AN TOÀN TUYỆT ĐỐI 100%).
\`\`\`

### 🌳 Sơ đồ 3: Cây Quyết Định Xử Lý Dữ Liệu Đầu Vào (Input Sanitization Tree)
\`\`\`diagram
DỮ LIỆU ĐƯỢC GỬI LÊN TỪ CLIENT QUA HTTP BODY / QUERY?
│
├── Là câu lệnh truy vấn Database?
│   └──► BẮT BUỘC dùng Parameterized Query ($1, $2) hoặc ORM chuẩn!
│
├── Là Payload cập nhật bản ghi?
│   └──► BẬT: ValidationPipe { whitelist: true, forbidNonWhitelisted: true }
│
└── Là Cookie phiên làm việc nhạy cảm?
    └──► BẬT BỘ BA: HttpOnly=true + Secure=true + SameSite='Strict' (Chống CSRF)
\`\`\`

### ⚖️ Sơ đồ 4: Bảng Đánh Đổi Kỹ Thuật (Engineering Trade-off Matrix)
| Lỗ Hổng / Kỹ Thuật | Phương Thức Tấn Công | Giải Pháp Chuẩn Bắt Buộc | Độ Phức Tạp |
| :--- | :--- | :--- | :--- |
| **SQL Injection** | Chèn ký tự nháy đơn phá vỡ cú pháp | Parameterized Queries ($1, $2) | Cực thấp (Viết đúng chuẩn) |
| **Mass Assignment** | Bơm thêm thuộc tính role/balance | Whitelist DTO + ValidationPipe | Rất thấp |
| **CSRF Attack** | Lợi dụng cookie gửi tự động từ web lạ | SameSite Cookie + CSRF Token Header | Trung bình |
| **Replay Attack** | Bắt gói tin và gửi lại lần hai | Timestamp Window + Nonce / Idempotency Key | Trung bình |
`,
      realCodeSnippet: `
import { IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';

// 1. DTO Chuẩn mực: Chỉ cho phép các trường an toàn
export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // TUYỆT ĐỐI KHÔNG KHAI BÁO CÁC TRƯỜNG NHẠY CẢM Ở ĐÂY:
  // isAdmin, role, balance, isVerified...
  // Nếu hacker cố tình gửi { "isAdmin": true }, ValidationPipe sẽ chặn đứng và báo lỗi 400!
}
`,
      quiz: [
        {
          id: 'c9-l3-q1',
          question: 'Vì sao kỹ thuật Parameterized Queries (Truy vấn có tham số hóa) lại có thể triệt tiêu hoàn toàn nguy cơ tấn công SQL Injection?',
          options: [
            'Vì câu lệnh SQL được phân tích cú pháp trước khi dữ liệu được nạp vào, biến toàn bộ dữ liệu đầu vào thành chuỗi ký tự thô không thể thực thi.',
            'Vì hệ quản trị cơ sở dữ liệu sẽ tự động xóa bỏ toàn bộ các ký tự nháy đơn và dấu chấm phẩy khỏi mã nguồn của dự án.',
            'Vì các truy vấn tham số hóa bắt buộc phải được mã hóa bằng khóa riêng tư của quản trị viên trước khi truyền qua mạng.',
            'Vì hệ điều hành Linux sẽ tự động ngắt kết nối mạng của bất kỳ người dùng nào nhập vào các từ khóa như DROP hoặc DELETE.',
          ],
          correctIndex: 0,
          explanation: 'Parameterized Query tách rời hoàn toàn bước Parse cú pháp (tạo cây AST) và bước Bind dữ liệu. Database biên dịch cấu trúc câu lệnh trước với các placeholder ($1, $2). Sau đó, tham số được truyền vào dưới dạng dữ liệu thuần túy (Data bytes). Cho dù tham số có chứa \' OR \'1\'=\'1\' hay DROP TABLE, Database chỉ coi đó là một chuỗi văn bản vô hại, không thể bị diễn giải thành lệnh SQL.'
        },
        {
          id: 'c9-l3-q2',
          question: 'Lỗ hổng "Mass Assignment" trong các ứng dụng web cho phép kẻ tấn công thực hiện hành vi nguy hiểm nào sau đây?',
          options: [
            'Chèn thêm các trường dữ liệu nhạy cảm vào payload (như isAdmin: true hoặc balance: 999999) mà hệ thống không có DTO lọc trắng.',
            'Tự động tăng tốc độ tải trang web của các đối thủ cạnh tranh bằng cách gửi hàng triệu gói tin thăm dò cổng mạng.',
            'Đọc trộm toàn bộ mã nguồn của ứng dụng backend thông qua các tệp tin hình ảnh đại diện của người dùng.',
            'Thay đổi địa chỉ vật lý MAC của card mạng máy chủ từ xa thông qua giao thức truyền tệp tin không bảo mật.',
          ],
          correctIndex: 0,
          explanation: 'Mass Assignment xảy ra khi lập trình viên chuyển toàn bộ req.body vào hàm cập nhật Database (như repo.update(id, req.body)). Kẻ tấn công phân tích thấy bảng có cột isAdmin hoặc balance, liền chèn thêm { "isAdmin": true } vào request body. Nếu không có Whitelist DTO lọc bỏ, đối tượng Database sẽ bị ghi đè thuộc tính nhạy cảm, cấp quyền Admin cho hacker.'
        },
        {
          id: 'c9-l3-q3',
          question: 'Trong NestJS, việc thiết lập tùy chọn { whitelist: true, forbidNonWhitelisted: true } trong ValidationPipe toàn cục đem lại giá trị phòng thủ gì?',
          options: [
            'Tự động tước bỏ và ném lỗi 400 Bad Request nếu client gửi bất kỳ trường dữ liệu nào không được định nghĩa rõ ràng trong DTO.',
            'Tự động nén toàn bộ hình ảnh đại diện của người dùng trước khi lưu trữ vào hệ thống tệp tin của máy chủ đám mây.',
            'Cho phép tất cả các yêu cầu từ các trang web bên ngoài có thể truy cập tự do vào cơ sở dữ liệu mà không cần xác thực.',
            'Chuyển đổi toàn bộ các biến số nguyên sang định dạng số thực dấu phẩy động để nâng cao độ chính xác toán học.',
          ],
          correctIndex: 0,
          explanation: 'Tùy chọn whitelist: true sẽ tự động loại bỏ mọi thuộc tính nằm ngoài khai báo của DTO. Kết hợp với forbidNonWhitelisted: true, NestJS sẽ lập tức ném ra lỗi 400 Bad Request ngay khi phát hiện có bất kỳ trường lạ nào gửi lên, chặn đứng hoàn toàn mọi nỗ lực tấn công Mass Assignment và Parameter Tampering.'
        },
        {
          id: 'c9-l3-q4',
          question: 'Kỹ thuật phòng thủ nào sau đây là giải pháp hiệu quả nhất để ngăn chặn cuộc tấn công Replay Attack (Bắt gói tin và phát lại) trên các API nhạy cảm?',
          options: [
            'Sử dụng Timestamp kết hợp với số ngẫu nhiên dùng một lần (Nonce / Idempotency Key) có lưu trữ và kiểm tra thời hạn sống trong Redis.',
            'Tăng kích thước của bộ nhớ đệm CPU L3 lên mức tối đa để máy chủ có thể lưu trữ toàn bộ lịch sử các gói tin mạng.',
            'Yêu cầu tất cả các lập trình viên phải ký cam kết bảo mật thông tin trước khi bắt đầu viết các đoạn mã giao tiếp mạng.',
            'Vô hiệu hóa hoàn toàn giao thức mã hóa đường truyền HTTPS và chuyển sang sử dụng giao thức truyền văn bản thô HTTP/1.0.',
          ],
          correctIndex: 0,
          explanation: 'Trong Replay Attack, kẻ tấn công nghe lén bắt được một request hợp lệ (ví dụ: chuyển tiền 10 triệu) và gửi lại request y hệt nhiều lần. Phòng chống chuẩn bằng cách: Client gửi kèm Timestamp hiện tại và một chuỗi ngẫu nhiên dùng một lần (Nonce). Server kiểm tra: 1) Timestamp không được lệch quá 5 phút so với đồng hồ server; 2) Nonce chưa từng xuất hiện trong Redis (dùng SET nonce 1 NX EX 300). Nếu Nonce đã có, từ chối ngay.'
        }
      ],
      codeChallenge: {
        id: 'c9-l3-c1',
        title: 'Bộ Lọc Trắng Dữ Liệu An Toàn Chống Mass Assignment (DTO Whitelist Stripper)',
        description: 'Hiện thực hàm \`sanitizePayload(rawInput: Record<string, unknown>, allowedKeys: string[]): Record<string, unknown>\`. Hàm nhận vào một object dữ liệu thô và danh sách các trường được phép (\`allowedKeys\`). Trả về một object mới CHỈ CHỨA các trường nằm trong \`allowedKeys\`. Tuyệt đối không được giữ lại bất kỳ trường lạ nào ngoài danh sách.',
        starterCode: `
export function sanitizePayload(
  rawInput: Record<string, unknown>,
  allowedKeys: string[]
): Record<string, unknown> {
  // TODO: Hiện thực lọc trắng các trường an toàn
  return {};
}
`,
        solution: `
export function sanitizePayload(
  rawInput: Record<string, unknown>,
  allowedKeys: string[]
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(rawInput, key)) {
      sanitized[key] = rawInput[key];
    }
  }

  return sanitized;
}
`,
        testCases: [
          {
            name: 'Lọc bỏ trường isAdmin và balance bị hacker chèn trộm',
            input: [
              { fullName: 'Ho Oanh', email: 'oanh@esmiles.vn', isAdmin: true, balance: 1000000 },
              ['fullName', 'email']
            ],
            expected: { fullName: 'Ho Oanh', email: 'oanh@esmiles.vn' }
          },
          {
            name: 'Giữ nguyên khi payload chỉ chứa các trường hợp lệ',
            input: [
              { title: 'Learn NestJS', content: 'In-depth' },
              ['title', 'content']
            ],
            expected: { title: 'Learn NestJS', content: 'In-depth' }
          }
        ]
      }
    }
  ]
};
