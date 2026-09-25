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
# 1. BỐI CẢNH KỸ THUẬT: MẬT MÃ HỌC ỨNG DỤNG, BẢO TOÀN DANH TÍNH VÀ CƠ CHẾ CHỮ KÝ BẤT ĐỐI XỨNG PHÂN TÁN (ARCHITECTURAL CONTEXT & IDENTITY CRYPTOGRAPHY)

Trong an toàn thông tin Backend cấp doanh nghiệp, mật mã học không phải là việc che giấu dữ liệu mà là bảo đảm toán học về **Tính Toàn Vẹn (Integrity)**, **Tính Bất Khả Chối Bỏ (Non-repudiation)** và **Tính Bất Khả Nghịch (One-way Irreversibility)**:
* **Bản Chất Của Hàm Băm Mật Khẩu (One-Way Cryptographic Hashing):**
  - Mật khẩu người dùng không bao giờ được phép lưu trữ dưới dạng thô hoặc mã hóa có thể đảo ngược (Two-way Encryption). Nó phải được băm một chiều qua các hàm toán học sao cho từ giá trị Hash không thể đảo ngược (infeasible) về mật khẩu gốc.
  - Các hàm băm thô (MD5, SHA-256) chỉ tốn chu kỳ xung nhịp CPU, hoàn toàn bị vô hiệu hóa trước các giàn máy đào GPU và mạch tích hợp chuyên dụng ASIC với năng lực thử hàng chục tỷ phép băm mỗi giây. Thuật toán Bcrypt phổ biến trong quá khứ cũng bộc lộ điểm yếu: Giới hạn độ dài mật khẩu chỉ 72 bytes và tiêu tốn rất ít bộ nhớ RAM, khiến nó vẫn có thể bị bẻ khóa bằng card đồ họa phân tán.
  - **Argon2id - Tiêu Chuẩn Vàng Hiện Đại:** Vô địch cuộc thi Password Hashing Competition (PHC). Argon2id kết hợp khả năng chống tấn công kênh bên (Side-channel Timing Attacks) của Argon2i và chống tấn công dò tìm phân tán GPU của Argon2d. Thuộc tính cốt tử của Argon2id là **Memory-Hardness**: Ép mỗi phép băm phải cấp phát và điền đầy hàng trăm megabyte RAM, khiến các bộ xử lý song song trên GPU bị cạn kiệt băng thông bộ nhớ và giảm tốc độ tấn công hàng triệu lần!
* **Kiến Trúc Ký Khóa Token: Đối Xứng (HS256) vs Bất Đối Xứng (RS256 / ES256):**
  - **Lỗ Hổng Của Khóa Đối Xứng HS256:** Cả bên ký (Auth Server) và bên thẩm định (Resource Services) đều dùng chung một chuỗi bí mật (Shared Secret). Trong hệ thống Microservices gồm hàng chục dịch vụ độc lập, nếu chỉ một dịch vụ cấp thấp bị lộ chuỗi bí mật trong tệp tin \`.env\`, kẻ tấn công có thể tự đóng giả làm Auth Server để ký giả mạo Token cho bất kỳ tài khoản quản trị nào!
  - **Cơ Chế Khóa Bất Đối Xứng Chuẩn Mực RS256/ES256:** Auth Server nắm giữ **Khóa Bí Mật (Private Key)** được bảo vệ nghiêm ngặt trong Hardware Security Module (HSM) hoặc Vault để ký Access Token. Tất cả các dịch vụ nội bộ và bên ngoài chỉ nắm giữ **Khóa Công Khai (Public Key)** (được công bố qua endpoint JWKS: \`/.well-known/jwks.json\`) để giải mã và thẩm định chữ ký. Kẻ tấn công dù chiếm đoạt được Public Key cũng tuyệt đối không thể tự sinh ra một Token giả mạo hợp lệ!

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
      realCodeSnippet: `import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';

/**
 * ADR: Dịch vụ Xác thực và Mật mã học cấp Doanh nghiệp
 * - Băm mật khẩu bằng Argon2id chống card đồ họa GPU / ASIC brute-force
 * - Ký JWT bằng khóa bất đối xứng RSA-2048 (RS256)
 * - Xác minh Token với Whitelist thuật toán nghiêm ngặt chống Key Confusion Attack
 */
export interface UserTokenPayload {
  userId: string;
  role: string;
  jti: string;
}

export interface VerifiedTokenClaims extends jwt.JwtPayload {
  userId: string;
  role: string;
  jti: string;
}

@Injectable()
export class EnterpriseAuthCryptoService {
  private readonly logger = new Logger(EnterpriseAuthCryptoService.name);
  private readonly rsaPrivateKey: string = process.env.JWT_PRIVATE_KEY || '';
  private readonly rsaPublicKey: string = process.env.JWT_PUBLIC_KEY || '';

  /**
   * Băm mật khẩu người dùng bằng Argon2id chống brute-force
   */
  public async hashPassword(plainText: string): Promise<string> {
    return await argon2.hash(plainText, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB RAM
      timeCost: 3,       // 3 iterations
      parallelism: 1,
    });
  }

  /**
   * So khớp mật khẩu người dùng với hash lưu trong database
   */
  public async verifyPassword(plainText: string, hash: string): Promise<boolean> {
    return await argon2.verify(hash, plainText);
  }

  /**
   * Ký Token bằng khóa bí mật Private Key với thuật toán RS256
   */
  public issueAccessToken(payload: UserTokenPayload): string {
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
  public verifyAccessToken(token: string): VerifiedTokenClaims {
    try {
      const decoded = jwt.verify(token, this.rsaPublicKey, {
        algorithms: ['RS256'], // Ép buộc chỉ chấp nhận RS256, cấm HS256 và none!
        issuer: 'https://auth.esmiles.vn',
        audience: 'https://api.esmiles.vn',
      });
      return decoded as VerifiedTokenClaims;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid Signature';
      this.logger.warn(\`Từ chối Access Token không hợp lệ: \${message}\`);
      throw new UnauthorizedException(\`Token không hợp lệ hoặc đã hết hạn: \${message}\`);
    }
  }
}`,
      quiz: [
        {
          id: 'c9-l1-q1',
          question: 'Vì sao trong kiến trúc Microservices phân tán, thuật toán ký JWT bất đối xứng (RS256/ES256) lại an toàn vượt trội so với thuật toán đối xứng (HS256)?',
          options: [
            'Vì các khóa bất đối xứng có khả năng tự động gia hạn thời gian sống của token mỗi khi người dùng gọi API.',
            'Chỉ có Auth Service nắm giữ Private Key để ký, các service nội bộ khác chỉ cần Public Key để xác minh độc lập mà không thể làm giả token.',
            'Vì thuật toán RS256 tự động sao lưu toàn bộ thông tin đăng nhập của người dùng vào bộ nhớ đệm đám mây.',
            'Vì thuật toán HS256 bị cấm sử dụng trên tất cả các trình duyệt web hiện đại theo quy chuẩn của tổ chức W3C.',
          ],
          correctIndex: 1,
          explanation: 'Với HS256, tất cả các Microservices muốn kiểm tra token đều phải chia sẻ chung một chuỗi bí mật (Shared Secret). Nếu một service phụ (như Analytics Service) bị tấn công lộ secret, hacker có thể tự tạo bất kỳ token Admin nào để chiếm quyền toàn bộ hệ thống. Với RS256, chỉ duy nhất Auth Service giữ Private Key; các service khác chỉ giữ Public Key để đọc, dù lộ Public Key cũng không ai có thể làm giả chữ ký.'
        },
        {
          id: 'c9-l1-q2',
          question: 'Lỗ hổng "Algorithm Confusion Attack" trong xác minh JWT token xảy ra khi nào và làm thế nào để phòng chống triệt để trong mã nguồn?',
          options: [
            'Khi người dùng nhập mật khẩu có chứa cả chữ hoa lẫn chữ thường khiến thuật toán băm bị xung đột bộ nhớ.',
            'Khi thời gian đồng hồ giữa hai máy chủ bị lệch nhau quá năm phút khiến cho hạn dùng exp của token bị sai.',
            'Khi máy chủ cơ sở dữ liệu bị mất kết nối mạng trong lúc đang kiểm tra quyền hạn của người dùng.',
            'Khi kẻ tấn công đổi header sang HS256 và dùng Public Key làm khóa bí mật đối xứng để ký token; phòng chống bằng cách ép cứng algorithms: ["RS256"].',
          ],
          correctIndex: 3,
          explanation: 'Nếu thư viện verify không ép buộc thuật toán, kẻ tấn công sẽ sửa Header của token từ RS256 sang HS256, và dùng chính Public Key của server (vốn là chuỗi công khai) làm khóa bí mật đối xứng để ký một payload giả mạo. Server ngây thơ dùng Public Key đưa vào hàm verify HS256 sẽ thấy chữ ký trùng khớp và chấp nhận! Phòng chống bằng cách luôn chỉ định danh sách thuật toán hợp lệ: algorithms: ["RS256"].'
        },
        {
          id: 'c9-l1-q3',
          question: 'Đặc tính "Memory-Hardness" của thuật toán băm Argon2id mang lại lợi thế phòng thủ cốt tử nào trước các cuộc tấn công bẻ khóa mật khẩu?',
          options: [
            'Bắt buộc mỗi lần băm phải tiêu tốn hàng chục megabyte bộ nhớ RAM khiến các chip chuyên dụng ASIC và GPU bị nghẽn bộ đệm không thể chạy song song hàng loạt.',
            'Tự động xóa sạch toàn bộ các bản ghi mật khẩu cũ trong cơ sở dữ liệu nếu phát hiện có hành vi đăng nhập sai quá năm lần.',
            'Cho phép giải mã mật khẩu ngược lại thành dạng văn bản thuần túy trong trường hợp người dùng bị quên mật khẩu.',
            'Giúp giảm kích thước của chuỗi mã băm xuống còn đúng tám ký tự nhị phân để tiết kiệm dung lượng lưu trữ trên đĩa cứng.',
          ],
          correctIndex: 0,
          explanation: 'Các card đồ họa GPU hoặc chip ASIC có hàng nghìn nhân tính toán song song có thể thử hàng tỷ mật khẩu SHA-256 mỗi giây vì mỗi phép toán chỉ tốn vài byte bộ nhớ. Argon2id được thiết kế dạng "Memory-Hard": ép mỗi phép tính băm phải tốn hàng chục MB RAM (ví dụ 64MB). Một GPU dù có 16GB RAM cũng chỉ có thể chạy song song vài chục phép toán cùng lúc, bẻ gãy hoàn toàn ưu thế tấn công bằng phần cứng mạnh của hacker.'
        },
        {
          id: 'c9-l1-q4',
          question: 'Nhược điểm cố hữu lớn nhất của thuật toán băm Bcrypt khiến nó dần bị thay thế bởi Argon2id trong các tiêu chuẩn bảo mật hiện đại là gì?',
          options: [
            'Bcrypt bắt buộc phải có kết nối mạng Internet trực tiếp tới máy chủ của tác giả thì mới có thể sinh ra chuỗi mã băm.',
            'Bcrypt không hỗ trợ việc thêm chuỗi muối ngẫu nhiên (Salt) vào trước mật khẩu của người dùng khi lưu trữ.',
            'Bcrypt âm thầm cắt ngắn mật khẩu đầu vào ở mức tối đa 72 bytes, mọi ký tự từ byte thứ 73 trở đi đều bị bỏ qua hoàn toàn.',
            'Bcrypt chỉ hoạt động trên các hệ thống tệp tin sử dụng bảng mã định dạng ASCII cổ điển của thập niên 1980.',
          ],
          correctIndex: 2,
          explanation: 'Bcrypt dựa trên thuật toán mã hóa khối Blowfish và có một hạn chế kỹ thuật rất nguy hiểm: Nó chỉ xử lý tối đa 72 bytes đầu tiên của mật khẩu! Nếu người dùng đặt mật khẩu dài 100 ký tự, 28 ký tự sau bị bỏ qua hoàn toàn mà người dùng không hề hay biết (hai mật khẩu giống nhau 72 ký tự đầu sẽ ra cùng mã hash). Argon2id không có giới hạn này và có khả năng chống tấn công phần cứng tốt hơn rất nhiều.'
        },
        {
          id: 'c9-l1-q5',
          question: 'Ưu thế kỹ thuật vượt trội nào giúp thuật toán ký đường cong Elliptic Ed25519 / ES256 dần chiếm ưu thế trước RSA-2048 trong các hệ thống hiện đại?',
          options: [
            'Kích thước khóa và chữ ký số siêu nhỏ gọn (~64 bytes so với ~256 bytes của RSA), tốc độ tạo và xác minh chữ ký nhanh hơn gấp nhiều lần với mức tiêu thụ CPU thấp.',
            'Ed25519 cho phép giải mã mật khẩu của người dùng khi có lệnh từ cơ quan quản lý.',
            'Ed25519 không cần sử dụng hàm toán học mà chỉ dùng bảng tra cứu tĩnh trong RAM.',
            'Ed25519 tự động đổi cổng kết nối của mạng nội bộ để đánh lừa hacker.',
          ],
          correctIndex: 0,
          explanation: 'So với RSA-2048, thuật toán chữ ký đường cong Elliptic (như ES256 / Ed25519) cung cấp độ an toàn tương đương với kích thước khóa và chữ ký số nhỏ hơn rất nhiều (chữ ký chỉ 64 bytes so với 256 bytes của RSA). Điều này giúp giảm đáng kể kích thước HTTP Header trên mỗi request và tăng tốc độ thẩm định chữ ký lên nhiều lần trên các thiết bị di động và máy chủ API.'
        },
        {
          id: 'c9-l1-q6',
          question: 'Endpoint JWKS (JSON Web Key Set, ví dụ: /.well-known/jwks.json) đóng vai trò gì trong kiến trúc xác thực phân tán của OAuth 2.0 / OpenID Connect?',
          options: [
            'Công khai danh sách các Public Key hợp lệ của Auth Server cùng với Key ID (kid), giúp các Microservices tự động tải và cập nhật Public Key để xác minh chữ ký mà không cần khởi động lại dịch vụ khi xoay vòng khóa (Key Rotation).',
            'Lưu trữ toàn bộ danh sách mật khẩu thô của tất cả người dùng trong hệ thống.',
            'Cho phép client gửi yêu cầu xóa tài khoản trực tiếp lên cổng thông tin bảo mật.',
            'Chuyển đổi giao thức mạng từ TCP sang UDP để tăng tốc độ kết nối internet.',
          ],
          correctIndex: 0,
          explanation: 'JWKS endpoint công khai tập hợp các Public Key (có trường kid - Key ID tương ứng). Khi Auth Server thực hiện xoay vòng khóa (Key Rotation: định kỳ đổi Private Key mới), nó cấp token mang kid mới. Các Microservices phát hiện kid mới sẽ tự động fetch lại JWKS để lấy Public Key mới mà không cần can thiệp cấu hình hay restart lại hệ thống.'
        },
        {
          id: 'c9-l1-q7',
          question: 'Để chống lại cuộc tấn công đo thời gian phản hồi (Side-Channel Timing Attack) khi so khớp hai chuỗi băm mã hóa hoặc chữ ký HMAC, hàm nào trong module crypto của Node.js bắt buộc phải được sử dụng?',
          options: [
            'Toán tử so sánh ba dấu bằng thông thường (===) để đảm bảo kiểm tra cả kiểu dữ liệu.',
            'Hàm so sánh chuỗi String.prototype.localeCompare().',
            'Hàm crypto.timingSafeEqual(): So sánh chuỗi với thời gian thực thi hằng số O(1), không ngắt sớm khi phát hiện ký tự sai đầu tiên.',
            'Hàm JSON.stringify() sau đó so sánh độ dài chuỗi ký tự.',
          ],
          correctIndex: 2,
          explanation: 'Toán tử so sánh thông thường (===) ngắt sớm (short-circuit) ngay khi gặp ký tự sai đầu tiên. Kẻ tấn công có thể đo thời gian phản hồi microsecond để đoán dần từng ký tự của chữ ký HMAC hoặc token. crypto.timingSafeEqual() thực hiện so sánh toàn bộ các byte với thời gian cố định độc lập với nội dung chuỗi, triệt tiêu hoàn toàn Timing Attack.'
        },
        {
          id: 'c9-l1-q8',
          question: 'Vì sao việc lưu trữ JWT Access Token trong HttpOnly, Secure, SameSite Cookie lại an toàn hơn vượt bậc so với việc lưu trữ trong LocalStorage của trình duyệt?',
          options: [
            'LocalStorage tự động gửi token sang máy chủ của bên thứ ba mỗi khi người dùng tải lại trang.',
            'HttpOnly Cookie ngăn chặn hoàn toàn mã JavaScript độc hại (XSS) đọc trộm Token, Secure đảm bảo truyền qua HTTPS, và SameSite bảo vệ chống tấn công CSRF.',
            'Trình duyệt web giới hạn dung lượng lưu trữ LocalStorage ở mức tối đa 10 bytes.',
            'LocalStorage chỉ lưu trữ được các con số nguyên và từ chối lưu chuỗi ký tự UTF-8.',
          ],
          correctIndex: 1,
          explanation: 'Nếu lưu Token trong LocalStorage, bất kỳ lỗ hổng XSS (Cross-Site Scripting) nào từ thư viện bên thứ ba (npm package) đều có thể chạy script document.localStorage và gửi trộm Token về máy chủ hacker. Với HttpOnly Cookie, JavaScript trên trình duyệt hoàn toàn bị cấm truy cập, triệt tiêu nguy cơ đánh cắp token qua XSS.'
        }
      ],
      codeChallenge: {
        id: 'c9-l1-c1',
        title: 'Bộ Thẩm Định Thuật Toán Header Chống Lỗi Key Confusion (JWT Alg Guard)',
        description: 'Hiện thực hàm \`validateJwtAlgorithm(headerAlg: string, allowedAlgorithms: string[]): { isAllowed: boolean; safeAlg: string | null }\`. Nếu \`headerAlg\` nằm trong danh sách \`allowedAlgorithms\` VÀ \`headerAlg.toLowerCase() !== "none"\`, trả về \`{ isAllowed: true, safeAlg: headerAlg }\`. Nếu là \`"none"\` hoặc không nằm trong danh sách cho phép, trả về \`{ isAllowed: false, safeAlg: null }\`.',
        starterCode: `export function validateJwtAlgorithm(
  headerAlg: string,
  allowedAlgorithms: string[]
): { isAllowed: boolean; safeAlg: string | null } {
  // TODO: Hiện thực kiểm tra thuật toán JWT an toàn
  return { isAllowed: false, safeAlg: null };
}`,
        solution: `export function validateJwtAlgorithm(
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
}`,
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
          },
          {
            name: 'Chặn đứng chuỗi thuật toán rỗng',
            input: ['', ['RS256']],
            expected: { isAllowed: false, safeAlg: null }
          },
          {
            name: 'Chấp nhận thuật toán ES256 khi nằm trong whitelist đa thuật toán',
            input: ['ES256', ['RS256', 'ES256', 'EdDSA']],
            expected: { isAllowed: true, safeAlg: 'ES256' }
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
# 1. BỐI CẢNH KỸ THUẬT: SỰ TIẾN HÓA CỦA MÔ HÌNH PHÂN QUYỀN RBAC SANG ABAC & BÀI TOÁN THU HỒI TOKEN VÔ TRẠNG THÁI (ARCHITECTURAL CONTEXT & AUTHORIZATION GOVERNANCE)

Khi quy mô nghiệp vụ của một tổ chức mở rộng, bài toán phân quyền truy cập (Authorization) vượt ra khỏi phạm vi kiểm tra vai trò đơn giản và trở thành thách thức lớn về mô hình hóa chính sách bảo mật:
* **Sự Bùng Nổ Vai Trò (Role Explosion) Của Mô Hình RBAC Truyền Thống:**
  - Mô hình Phân quyền Dựa trên Vai trò (Role-Based Access Control - RBAC) gán quyền hạn tĩnh vào các chức danh: \`ADMIN\`, \`MANAGER\`, \`USER\`.
  - Khi xuất hiện các yêu cầu phân quyền theo phân vùng dữ liệu và quan hệ sở hữu (ví dụ: Kế toán chi nhánh Đà Nẵng chỉ được xem hóa đơn của Đà Nẵng; người dùng chỉ được sửa bài viết do chính mình tạo ra; hoặc quản lý chỉ được duyệt đơn hàng có giá trị dưới 100 triệu), RBAC hoàn toàn bất lực.
  - Nếu cố chấp sử dụng RBAC, hệ thống sẽ rơi vào thảm họa **Role Explosion**: Sinh ra hàng trăm vai trò rời rạc như \`ACCOUNTANT_DN\`, \`ACCOUNTANT_HN\`, \`POST_OWNER\`, \`ORDER_APPROVER_TIER_1\`... khiến ma trận phân quyền trở nên hỗn loạn, không thể bảo trì và cực kỳ dễ phát sinh lỗ hổng bảo mật rò rỉ dữ liệu chéo (Cross-tenant Data Leak).
* **Mô Hình Phân Quyền Theo Thuộc Tính (Attribute-Based Access Control - ABAC):**
  - Đánh giá quyền truy cập động tại thời điểm chạy (Runtime Policy Evaluation) dựa trên 4 chiều thuộc tính:
    1. **Thuộc tính Chủ thể (Subject Attributes):** ID người dùng, phòng ban, chi nhánh, cấp bậc bảo mật.
    2. **Thuộc tính Hành động (Action Attributes):** Đọc (Read), Tạo mới (Create), Chỉnh sửa (Update), Xóa (Delete).
    3. **Thuộc tính Tài nguyên (Resource Attributes):** \`authorId\`, trạng thái bài viết (\`isPublished\`, \`isLocked\`), giá trị hóa đơn.
    4. **Thuộc tính Ngữ cảnh Môi trường (Environment Context):** Địa chỉ IP nội bộ, thời gian trong giờ hành chính, thiết bị truy cập có xác thực mTLS hay không.
  - Sử dụng các thư viện Policy Engine như **CASL**, hệ thống định nghĩa các luật kiểm soát quyền truy cập linh hoạt, chặt chẽ và có thể kiểm thử tự động một cách độc lập.
* **Nghịch Lý Token Vô Trạng Thái & Cơ Chế Thu Hồi (Stateless Token Revocation):**
  - JSON Web Token (JWT) được thiết kế vô trạng thái (Stateless) để không phải truy vấn Database mỗi lần xác thực. Nhưng đây cũng là điểm yếu chết người: Khi một nhân viên bị chấm dứt hợp đồng hoặc lộ Token, chiếc Access Token đã cấp vẫn có hiệu lực cho đến khi hết hạn (ví dụ sau 1-2 giờ)!
  - **Giải Pháp Enterprise Chuẩn Mực:** Kết hợp Access Token có thời gian sống siêu ngắn (10-15 phút) với **Token Revocation Blocklist** trên Redis (lưu danh sách các \`jti\` - JWT ID bị vô hiệu hóa hoặc mốc thời gian \`passwordChangedAt\`). Khi người dùng đăng xuất hoặc bị khóa tài khoản, Redis chỉ lưu vết trong đúng khoảng thời gian còn lại của Token, vừa bảo đảm tính tức thì vừa không làm nặng bộ nhớ đệm!

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
| **RBAC Đơn Giản** | Rất thấp (Cứng nhắc) | Cực kỳ đơn giản | 0% (Lưu sẵn trong Token) | Bùng nổ số lượng Role (Role Explosion) |
| **ABAC (CASL)** | Tối đa, không giới hạn | Trung bình / Cao | Cần query thêm đối tượng để check| Cần viết unit test chính sách chặt chẽ |
| **JWT Blacklist Redis**| Thu hồi token tức thì | Thấp | Tốn 1 lần GET Redis mỗi request | Phụ thuộc vào độ ổn định của Redis |
| **Token Versioning** | Thu hồi toàn bộ thiết bị| Rất thấp | Chỉ check số nguyên version | Không thu hồi được lẻ 1 thiết bị |
`,
      realCodeSnippet: `import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Redis from 'ioredis';

/**
 * ADR: Kiểm soát Phân quyền Doanh nghiệp kết hợp Thu hồi Token tức thì
 * - Kiểm tra jti trên Redis Blocklist với TTL động
 * - Hỗ trợ phân quyền RBAC tĩnh kết hợp ABAC kiểm tra ngữ cảnh người dùng
 * - Đảm bảo dọn dẹp kết nối Redis khi module bị hủy
 */
export interface AuthenticatedUser {
  userId: string;
  role: string;
  jti?: string;
  branchId?: string;
}

@Injectable()
export class EnterpriseAuthzGuard implements CanActivate, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(private readonly reflector: Reflector) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      lazyConnect: true,
    });
  }

  public async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Chưa xác thực danh tính.');
    }

    // 1. Kiểm tra Token Revocation Blocklist trên Redis qua jti claim
    if (user.jti) {
      const isBlacklisted = await this.redis.exists(\`blocklist:\${user.jti}\`);
      if (isBlacklisted === 1) {
        throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.');
      }
    }

    // 2. Kiểm tra quyền hạn theo vai trò tối thiểu (RBAC Check)
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Bạn không có đủ vai trò để truy cập tài nguyên này.');
      }
    }

    return true;
  }
}`,
      quiz: [
        {
          id: 'c9-l2-q1',
          question: 'Hiện tượng "Role Explosion" (Bùng nổ vai trò) là gì và vì sao kiến trúc ABAC lại giải quyết triệt để vấn đề này?',
          options: [
            'Hiện tượng số lượng role tăng theo cấp số nhân khi cố dùng RBAC cho các điều kiện dữ liệu chi tiết; ABAC giải quyết bằng quy tắc thuộc tính động.',
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
            'Để bảo đảm rằng người dùng sẽ tự động được phục hồi lại quyền hạn sau đúng mười lăm phút kể từ khi bị sa thải.',
            'Vì cơ sở dữ liệu Redis bắt buộc tất cả các khóa lưu trữ đều phải có tham số thời gian nếu không sẽ bị ném lỗi.',
            'Thời gian sống đúng bằng thời gian hết hạn còn lại của token giúp khóa tự biến mất khi token hết hạn, tránh phình to bộ nhớ RAM.',
            'Để hỗ trợ việc mã hóa lại token bằng các thuật toán khóa công khai theo tiêu chuẩn an toàn của bộ quốc phòng.',
          ],
          correctIndex: 2,
          explanation: 'Một JWT Token tự nó sẽ mất hiệu lực sau khi trôi qua mốc exp (Expiration Time). Do đó, ta chỉ cần lưu jti vào Redis Blocklist trong khoảng thời gian còn lại của token đó (TTL = exp - Date.now()). Khi token đã tự hết hạn tự nhiên, việc lưu jti trong Redis không còn ý nghĩa gì nữa; cờ TTL sẽ tự động xóa sạch jti khỏi RAM, giúp Redis không bao giờ bị tràn bộ nhớ.'
        },
        {
          id: 'c9-l2-q3',
          question: 'Trong mô hình phân quyền ABAC (Attribute-Based Access Control), bốn nhóm thuộc tính cơ bản nào được sử dụng để đưa ra quyết định cấp quyền?',
          options: [
            'Địa chỉ IP máy chủ, Số lượng lõi của vi xử lý CPU, Tốc độ đường truyền mạng và Dung lượng bộ nhớ RAM còn trống.',
            'Chủ thể (Subject), Hành động (Action), Tài nguyên đích (Resource) và Ngữ cảnh môi trường xung quanh (Environment Context).',
            'Tên đăng nhập của người dùng, Mật khẩu đã băm, Số điện thoại cá nhân và Mã số định danh căn cước công dân.',
            'Tên bảng cơ sở dữ liệu, Khóa chính của bản ghi, Số lượng cột dữ liệu và Phiên bản của hệ điều hành Linux máy chủ.',
          ],
          correctIndex: 1,
          explanation: 'ABAC ra quyết định dựa trên bộ tứ thuộc tính: 1) Subject Attributes (ai đang yêu cầu: role, phòng ban, điểm tín nhiệm); 2) Action Attributes (muốn làm gì: READ, UPDATE, DELETE); 3) Resource Attributes (lên đối tượng nào: chủ sở hữu, trạng thái bản ghi, độ nhạy cảm); 4) Environment/Context (trong điều kiện nào: giờ hành chính, mạng nội bộ VPN, thiết bị tin cậy).'
        },
        {
          id: 'c9-l2-q4',
          question: 'Kỹ thuật "Token Versioning" (Lưu phiên bản token trong bảng User) đem lại giải pháp tối ưu nào khi người dùng muốn "Đăng xuất khỏi tất cả thiết bị"?',
          options: [
            'Tự động gửi email yêu cầu người dùng phải gỡ bỏ cài đặt ứng dụng trên toàn bộ các thiết bị điện thoại thông minh.',
            'Ép buộc toàn bộ các máy chủ API phải khởi động lại để xóa sạch bộ nhớ đệm của các kết nối mạng hiện hành.',
            'Xóa vĩnh viễn tài khoản người dùng khỏi hệ thống và yêu cầu người dùng phải thực hiện đăng ký tài khoản mới.',
            'Chỉ cần tăng số token_version của User trong Database lên 1, toàn bộ các token cũ mang version cũ lập tức bị vô hiệu hóa đồng loạt.',
          ],
          correctIndex: 3,
          explanation: 'Khi cấp token, payload có thêm claim: { tokenVersion: 1 }. Khi người dùng bấm "Đăng xuất khỏi tất cả thiết bị" hoặc đổi mật khẩu, ta chỉ cần chạy 1 câu SQL: UPDATE users SET token_version = token_version + 1. Khi request đến, Guard đối chiếu tokenVersion trong token với Database: nếu version cũ (< 2), lập tức từ chối, vô hiệu hóa hàng loạt mọi thiết bị mà không cần lưu từng jti vào Redis.'
        },
        {
          id: 'c9-l2-q5',
          question: 'Mô hình Phân quyền Dựa trên Mối quan hệ (Relationship-Based Access Control - ReBAC, như Google Zanzibar) giải quyết bài toán nào mà RBAC và ABAC gặp khó khăn?',
          options: [
            'Quản lý đồ thị quan hệ phân quyền sâu (như Google Drive: "User A được xem file X vì User A thuộc Group Y, Group Y là Editor của Folder Z chứa File X").',
            'Tự động tăng tốc độ nén dữ liệu video của các cuộc gọi hội nghị truyền hình.',
            'Chuyển đổi giao thức truyền tải từ HTTPS sang Bluetooth tầm ngắn.',
            'Ngăn chặn người dùng nhập sai mật khẩu quá 3 lần bằng cách khóa máy tính.',
          ],
          correctIndex: 0,
          explanation: 'ReBAC mô hình hóa quyền hạn dưới dạng một đồ thị các mối quan hệ (Tuples: object#relation@user). Trong các hệ thống như Google Docs/Drive hay GitHub, việc một người có quyền truy cập vào một tài nguyên thường thừa kế qua cây phân cấp thư mục hoặc nhóm lồng nhau (Transitive Group Membership), điều mà ReBAC xử lý cực kỳ xuất sắc và có thể mở rộng tới hàng tỷ quan hệ.'
        },
        {
          id: 'c9-l2-q6',
          question: 'Trong kiến trúc chuẩn XACML / Policy-Based Access Control, thành phần "PEP" (Policy Enforcement Point) và "PDP" (Policy Decision Point) có vai trò phân công như thế nào?',
          options: [
            'PEP là nơi lưu trữ mật khẩu, còn PDP là nơi mã hóa tệp tin đa phương tiện.',
            'PEP là cổng chặn chặn đứng request và áp dụng quyết định (như Guard / Interceptor trong NestJS), còn PDP là bộ não logic tính toán và đưa ra phán quyết cấp quyền hay từ chối (như CASL / OPA Engine).',
            'PEP dành cho người dùng trên máy tính để bàn, PDP dành cho người dùng trên điện thoại di động.',
            'Cả hai thành phần này đều chạy trực tiếp trên card đồ họa máy chủ.',
          ],
          correctIndex: 1,
          explanation: 'Kiến trúc bảo mật doanh nghiệp tách rời: PEP (Policy Enforcement Point) là nơi chặn request ở cửa ngõ (NestJS Guard, API Gateway) để trích xuất thông tin; sau đó gửi tới PDP (Policy Decision Point - ví dụ CASL hay Open Policy Agent) để thẩm định quy tắc nghiệp vụ và trả về Allow/Deny. PEP dựa vào phán quyết đó để cho qua hoặc ném lỗi 403.'
        },
        {
          id: 'c9-l2-q7',
          question: 'Khi sử dụng thư viện CASL để phân quyền cho danh sách hàng triệu bản ghi, cách tiếp cận nào giúp tránh việc phải tải toàn bộ bản ghi lên bộ nhớ Node.js rồi mới kiểm tra quyền?',
          options: [
            'Tải toàn bộ dữ liệu vào biến mảng toàn cục của server rồi dùng vòng lặp for filter.',
            'Chuyển toàn bộ dữ liệu sang lưu trữ trên thẻ nhớ flash USB cắm ngoài.',
            'Tắt hoàn toàn cơ chế phân quyền đối với các câu lệnh xem danh sách.',
            'Sử dụng hàm accessibleBy của @casl/prisma hoặc @casl/typeorm để chuyển đổi trực tiếp các quy tắc quyền hạn thành mệnh đề WHERE trong câu lệnh SQL gửi xuống Database.',
          ],
          correctIndex: 3,
          explanation: 'Nếu tải 1 triệu bản ghi về RAM Node.js để chạy ability.can() từng dòng thì server sẽ sập vì OOM. CASL cung cấp công cụ @casl/prisma hoặc @casl/typeorm với hàm accessibleBy: Nó tự động biên dịch các quy tắc quyền (vd: authorId = user.id) thành điều kiện SQL WHERE tương ứng (WHERE author_id = 123), giúp Database chỉ trả về đúng những bản ghi mà user đó được phép thấy.'
        },
        {
          id: 'c9-l2-q8',
          question: 'Cơ chế "Refresh Token Rotation with Reuse Detection" bảo vệ người dùng như thế nào khi một Refresh Token bị kẻ tấn công đánh cắp?',
          options: [
            'Tự động tăng số dư tài khoản ngân hàng của người dùng lên gấp đôi để đền bù.',
            'Mỗi lần Refresh Token được dùng để lấy Access Token mới, nó sẽ bị hủy và thay thế bằng một Refresh Token mới; nếu Refresh Token cũ đã bị hủy lại được gửi lên lần hai (phát hiện rò rỉ), hệ thống lập tức thu hồi toàn bộ họ Token (Token Family) và đăng xuất mọi thiết bị.',
            'Hệ thống sẽ gửi tin nhắn SMS yêu cầu người dùng đổi tên đăng nhập.',
            'Chuyển toàn bộ các yêu cầu tiếp theo sang chế độ ẩn danh không lưu vết IP.',
          ],
          correctIndex: 1,
          explanation: 'Refresh Token Rotation (RTR): Mỗi lần gọi /refresh, server cấp cặp Token mới và đánh dấu token cũ là "đã dùng". Nếu kẻ tấn công đã ăn trộm token cũ và cố tình gọi /refresh lần nữa: Server phát hiện hành vi tái sử dụng (Reuse Detection). Vì không biết đâu là client thật đâu là kẻ cướp, server hủy diệt toàn bộ Token Family của tài khoản đó, buộc người dùng phải đăng nhập lại bằng mật khẩu.'
        }
      ],
      codeChallenge: {
        id: 'c9-l2-c1',
        title: 'Bộ Thẩm Định Quyền Truy Cập ABAC Động (Dynamic Policy Evaluator)',
        description: 'Hiện thực hàm \`evaluateAbacPolicy(user: { id: string; role: string }, action: string, resource: { ownerId: string; isLocked: boolean }): { granted: boolean; reason: string }\`. Quy tắc: 1. Nếu \`user.role === "ADMIN"\`, luôn luôn \`{ granted: true, reason: "ADMIN_OVERRIDE" }\`. 2. Nếu \`resource.isLocked === true\`, luôn luôn \`{ granted: false, reason: "RESOURCE_LOCKED" }\`. 3. Nếu \`action === "UPDATE"\` hoặc \`"DELETE"\`, chỉ cho phép nếu \`user.id === resource.ownerId\` (ngược lại từ chối \`"NOT_OWNER"\`). 4. Nếu \`action === "READ"\`, luôn \`{ granted: true, reason: "READ_ALLOWED" }\`. Mọi thao tác khác không hỗ trợ trả về \`{ granted: false, reason: "UNSUPPORTED_ACTION" }\`.',
        starterCode: `export function evaluateAbacPolicy(
  user: { id: string; role: string },
  action: string,
  resource: { ownerId: string; isLocked: boolean }
): { granted: boolean; reason: string } {
  // TODO: Hiện thực thẩm định quyền hạn theo thuộc tính ABAC
  return { granted: false, reason: '' };
}`,
        solution: `export function evaluateAbacPolicy(
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
}`,
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
          },
          {
            name: 'User thường bị từ chối thao tác khi tài nguyên đã bị khóa',
            input: [{ id: 'u1', role: 'USER' }, 'READ', { ownerId: 'u1', isLocked: true }],
            expected: { granted: false, reason: 'RESOURCE_LOCKED' }
          },
          {
            name: 'Từ chối các hành động không được hỗ trợ',
            input: [{ id: 'u1', role: 'USER' }, 'EXPORT', { ownerId: 'u1', isLocked: false }],
            expected: { granted: false, reason: 'UNSUPPORTED_ACTION' }
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
# 1. BỐI CẢNH KỸ THUẬT: PHÒNG THỦ CHIỀU SÂU (DEFENSE IN DEPTH) TRƯỚC CÁC LỖ HỔNG HỆ THỐNG OWASP TOP 10 (ARCHITECTURAL CONTEXT & SECURITY HARDENING)

Trong tư duy của một Kỹ sư Backend chuyên nghiệp, mọi dữ liệu nhận từ Client (HTTP Body, Query Params, Headers, Cookies) đều phải được mặc định coi là không đáng tin cậy (Untrusted Input). Lỗ hổng bảo mật không bắt nguồn từ thư viện mà bắt nguồn từ sự thiếu hiểu biết về ranh giới thực thi dữ liệu:
* **Bản Chất Của SQL Injection (Tách Biệt Ngăn Cách Giữa Dữ Liệu Và Mã Thực Thi):**
  - Xảy ra khi lập trình viên thực hiện ghép chuỗi thô (String Concatenation hoặc Template Strings) để xây dựng câu truy vấn SQL: \`"SELECT * FROM users WHERE email = '" + input + "'"\`.
  - Kẻ tấn công cung cấp chuỗi chứa các ký tự đặc biệt (\`' OR '1'='1' --\`), làm thay đổi cây cú pháp trừu tượng (Abstract Syntax Tree - AST) của bộ phân tích câu lệnh SQL, biến dữ liệu người dùng thành mã điều khiển thực thi.
  - **Phòng thủ Chuẩn mực:** Sử dụng **Parameterized Queries (Prepared Statements)**. Cơ sở dữ liệu biên dịch cấu trúc câu lệnh trước, sau đó nhận tham số dữ liệu riêng biệt qua giao thức nhị phân. Dữ liệu dù chứa ký tự gì cũng chỉ được đối xử như một giá trị chuỗi thuần túy, triệt tiêu $100\\%$ nguy cơ injection.
* **Hiểm Họa Mass Assignment & Ô Nhiễm Thuộc Tính (Object Injection / Property Overwriting):**
  - Xảy ra khi lập trình viên chuyển giao toàn bộ đối tượng \`req.body\` vào các phương thức cập nhật của ORM/Database: \`userRepository.update(id, req.body)\`.
  - Kẻ tấn công có thể chèn thêm các thuộc tính nhạy cảm không nằm trên giao diện UI: \`{ "role": "SUPER_ADMIN", "isVerified": true, "balance": 10000000 }\`.
  - Nếu tầng API không có bộ lọc danh sách trắng (Whitelist DTO), các giá trị độc hại này sẽ được ghi thẳng vào các cột nhạy cảm trong cơ sở dữ liệu. Trong NestJS, việc kích hoạt \`ValidationPipe\` với \`whitelist: true\` và \`forbidNonWhitelisted: true\` là yêu cầu bắt buộc tối thiểu để tự động tước bỏ hoặc ném lỗi ngay khi xuất hiện thuộc tính lạ.
* **Tấn Công Giả Mạo Yêu Cầu Chéo Trang (Cross-Site Request Forgery - CSRF):**
  - Khai thác cơ chế tự động đính kèm Cookie của trình duyệt khi thực hiện các yêu cầu chéo nguồn (Cross-Origin Requests).
  - Khi người dùng đã xác thực tại ngân hàng (\`bank.com\`), một trang web độc hại (\`evil.com\`) có thể ngầm kích hoạt request \`POST https://bank.com/transfer\` (thông qua thẻ \`<form>\` ẩn hoặc JavaScript). Trình duyệt tự động gửi kèm Session/Cookie xác thực, khiến ngân hàng tưởng đó là hành động hợp lệ của người dùng.
  - **Phòng vệ Đa lớp:** Sử dụng thuộc tính Cookie **\`SameSite=Lax\`** hoặc **\`SameSite=Strict\`**, kết hợp cơ chế **Anti-CSRF Token** (Double Submit Cookie Pattern hoặc Synchronizer Token Pattern) cho mọi phương thức thay đổi trạng thái (\`POST\`, \`PUT\`, \`PATCH\`, \`DELETE\`).

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
│  └── whitelist & forbidNonWhitelisted: Triệt tiêu Mass Assignment 100%      │
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
      realCodeSnippet: `import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * ADR: Phòng thủ chiều sâu chống SQL Injection và Mass Assignment cấp Doanh nghiệp
 * - Thực thi truy vấn 100% qua Parameterized Queries ($1, $2)
 * - Tự động thanh lọc Whitelist DTO, ném lỗi 400 Bad Request nếu phát hiện trường nhạy cảm
 */
export interface SafeUpdateUserPayload {
  fullName?: string;
  email?: string;
  bio?: string;
}

@Injectable()
export class EnterpriseSecuritySanitizationService {
  private readonly logger = new Logger(EnterpriseSecuritySanitizationService.name);
  private readonly ALLOWED_FIELDS = new Set(['fullName', 'email', 'bio']);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Cập nhật thông tin người dùng với cơ chế chống Mass Assignment và SQL Injection
   */
  public async updateUserSecurely(
    userId: string,
    rawPayload: Record<string, unknown>
  ): Promise<{ updated: boolean }> {
    // 1. Chống Mass Assignment: Thẩm định Whitelist trường dữ liệu
    const sanitizedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      if (!this.ALLOWED_FIELDS.has(key)) {
        this.logger.warn(\`[MASS ASSIGNMENT ATTEMPT] Phát hiện trường lạ: \${key}\`);
        throw new BadRequestException(\`Trường dữ liệu [\${key}] không được phép cập nhật.\`);
      }
      sanitizedData[key] = value;
    }

    if (Object.keys(sanitizedData).length === 0) {
      return { updated: false };
    }

    // 2. Chống SQL Injection: Xây dựng câu lệnh Parameterized động an toàn
    const setClauses: string[] = [];
    const parameters: unknown[] = [userId];
    let paramIndex = 2;

    for (const [col, val] of Object.entries(sanitizedData)) {
      setClauses.push(\`\${col} = $\${paramIndex}\`);
      parameters.push(val);
      paramIndex++;
    }

    const query = \`UPDATE users SET \${setClauses.join(', ')} WHERE id = $1\`;

    // 3. Thực thi an toàn qua Prepared Statement của PostgreSQL
    await this.dataSource.query(query, parameters);
    return { updated: true };
  }
}`,
      quiz: [
        {
          id: 'c9-l3-q1',
          question: 'Vì sao kỹ thuật Parameterized Queries (Truy vấn có tham số hóa) lại có thể triệt tiêu hoàn toàn nguy cơ tấn công SQL Injection?',
          options: [
            'Vì hệ quản trị cơ sở dữ liệu sẽ tự động xóa bỏ toàn bộ các ký tự nháy đơn và dấu chấm phẩy khỏi mã nguồn của dự án.',
            'Vì các truy vấn tham số hóa bắt buộc phải được mã hóa bằng khóa riêng tư của quản trị viên trước khi truyền qua mạng.',
            'Vì câu lệnh SQL được phân tích cú pháp (tạo cây AST) trước khi dữ liệu được nạp vào, biến toàn bộ dữ liệu đầu vào thành chuỗi ký tự thô không thể thực thi thành lệnh.',
            'Vì hệ điều hành Linux sẽ tự động ngắt kết nối mạng của bất kỳ người dùng nào nhập vào các từ khóa như DROP hoặc DELETE.',
          ],
          correctIndex: 2,
          explanation: 'Parameterized Query tách rời hoàn toàn bước Parse cú pháp (tạo cây AST) và bước Bind dữ liệu. Database biên dịch cấu trúc câu lệnh trước với các placeholder ($1, $2). Sau đó, tham số được truyền vào dưới dạng dữ liệu thuần túy (Data bytes). Cho dù tham số có chứa \' OR \'1\'=\'1\' hay DROP TABLE, Database chỉ coi đó là một chuỗi văn bản vô hại, không thể bị diễn giải thành lệnh SQL.'
        },
        {
          id: 'c9-l3-q2',
          question: 'Lỗ hổng "Mass Assignment" trong các ứng dụng web cho phép kẻ tấn công thực hiện hành vi nguy hiểm nào sau đây?',
          options: [
            'Chèn thêm các trường dữ liệu nhạy cảm vào payload (như isAdmin: true hoặc balance: 999999) mà hệ thống không có DTO lọc trắng, ghi đè trực tiếp vào DB.',
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
            'Tự động nén toàn bộ hình ảnh đại diện của người dùng trước khi lưu trữ vào hệ thống tệp tin của máy chủ đám mây.',
            'Tự động tước bỏ và ném lỗi 400 Bad Request nếu client gửi bất kỳ trường dữ liệu nào không được định nghĩa rõ ràng trong DTO.',
            'Cho phép tất cả các yêu cầu từ các trang web bên ngoài có thể truy cập tự do vào cơ sở dữ liệu mà không cần xác thực.',
            'Chuyển đổi toàn bộ các biến số nguyên sang định dạng số thực dấu phẩy động để nâng cao độ chính xác toán học.',
          ],
          correctIndex: 1,
          explanation: 'Tùy chọn whitelist: true sẽ tự động loại bỏ mọi thuộc tính nằm ngoài khai báo của DTO. Kết hợp với forbidNonWhitelisted: true, NestJS sẽ lập tức ném ra lỗi 400 Bad Request ngay khi phát hiện có bất kỳ trường lạ nào gửi lên, chặn đứng hoàn toàn mọi nỗ lực tấn công Mass Assignment và Parameter Tampering.'
        },
        {
          id: 'c9-l3-q4',
          question: 'Kỹ thuật phòng thủ nào sau đây là giải pháp hiệu quả nhất để ngăn chặn cuộc tấn công Replay Attack (Bắt gói tin và phát lại) trên các API nhạy cảm?',
          options: [
            'Tăng kích thước của bộ nhớ đệm CPU L3 lên mức tối đa để máy chủ có thể lưu trữ toàn bộ lịch sử các gói tin mạng.',
            'Yêu cầu tất cả các lập trình viên phải ký cam kết bảo mật thông tin trước khi bắt đầu viết các đoạn mã giao tiếp mạng.',
            'Vô hiệu hóa hoàn toàn giao thức mã hóa đường truyền HTTPS và chuyển sang sử dụng giao thức truyền văn bản thô HTTP/1.0.',
            'Sử dụng Timestamp kết hợp với số ngẫu nhiên dùng một lần (Nonce / Idempotency Key) có lưu trữ và kiểm tra thời hạn sống trong Redis.',
          ],
          correctIndex: 3,
          explanation: 'Trong Replay Attack, kẻ tấn công nghe lén bắt được một request hợp lệ (ví dụ: chuyển tiền 10 triệu) và gửi lại request y hệt nhiều lần. Phòng chống chuẩn bằng cách: Client gửi kèm Timestamp hiện tại và một chuỗi ngẫu nhiên dùng một lần (Nonce). Server kiểm tra: 1) Timestamp không được lệch quá 5 phút so với đồng hồ server; 2) Nonce chưa từng xuất hiện trong Redis (dùng SET nonce 1 NX EX 300). Nếu Nonce đã có, từ chối ngay.'
        },
        {
          id: 'c9-l3-q5',
          question: 'Cơ chế hoạt động của thuộc tính SameSite trong HTTP Cookie bảo vệ ứng dụng khỏi cuộc tấn công CSRF (Cross-Site Request Forgery) như thế nào?',
          options: [
            'Mã hóa toàn bộ các tệp tin đính kèm trước khi tải lên máy chủ lưu trữ S3.',
            'Tự động đổi mật khẩu người dùng sau mỗi lần gửi biểu mẫu.',
            'SameSite=Strict cấm hoàn toàn trình duyệt tự động gửi cookie khi request xuất phát từ trang web khác; SameSite=Lax cho phép gửi cookie khi click link GET điều hướng nhưng chặn khi submit POST/PUT chéo nguồn.',
            'Khóa bàn phím của người dùng nếu phát hiện có hành vi sao chép văn bản từ trang web khác.',
          ],
          correctIndex: 2,
          explanation: 'CSRF khai thác việc trình duyệt tự động đính kèm cookie của nạn nhân khi một trang web độc hại bí mật gửi request tới server. Với SameSite=Strict, trình duyệt tuyệt đối không bao giờ gửi cookie nếu nguồn gốc (origin) của trang web gọi khác với trang đích. Với SameSite=Lax (mặc định trình duyệt hiện đại), cookie chỉ được gửi với các thao tác chuyển trang GET an toàn, chặn hoàn toàn các lệnh POST/PUT chéo nguồn.'
        },
        {
          id: 'c9-l3-q6',
          question: 'Lỗ hổng Second-Order SQL Injection (SQL Injection bậc hai) có đặc điểm nguy hiểm gì khác biệt so với First-Order SQL Injection?',
          options: [
            'Dữ liệu độc hại được lưu trữ an toàn trong DB ở lần đầu tiên (qua câu lệnh chuẩn), nhưng sau đó được một tác vụ khác lấy ra và ghép chuỗi không an toàn vào một câu lệnh SQL thứ hai.',
            'Kẻ tấn công phải có mặt trực tiếp tại phòng máy chủ mới có thể khai thác được.',
            'Chỉ xảy ra khi cơ sở dữ liệu sử dụng bộ nhớ RAM dung lượng trên 128 gigabyte.',
            'Lỗ hổng này chỉ ảnh hưởng đến các ứng dụng viết bằng ngôn ngữ C++.',
          ],
          correctIndex: 0,
          explanation: 'First-order SQLi xảy ra ngay lập tức khi nhận input từ HTTP request. Second-order SQLi tinh vi hơn: Hacker đăng ký tài khoản với username là admin\'--. Câu lệnh INSERT dùng Parameterized nên lưu thành công vào DB. Sau đó, một tác vụ nền hoặc một trang Admin lấy username này ra và ghép chuỗi thô vào câu SQL khác: "SELECT * FROM audit WHERE user = " + username -> Kích hoạt injection tại bước thứ hai!'
        },
        {
          id: 'c9-l3-q7',
          question: 'Trong lỗ hổng Server-Side Request Forgery (SSRF), biện pháp phòng thủ nào sau đây là quan trọng nhất khi ứng dụng cần tải dữ liệu từ một URL do người dùng cung cấp?',
          options: [
            'Tăng thời gian timeout của kết nối HTTP lên mức tối đa một giờ.',
            'Phân giải DNS trước và chặn tuyệt đối các dải IP nội bộ/vòng lặp (127.0.0.1, 10.0.0.0/8, 192.168.0.0/16) và AWS/Cloud Metadata IP (169.254.169.254).',
            'Chuyển đổi giao thức truyền tải từ HTTP sang FTP.',
            'Yêu cầu người dùng phải xác thực danh tính bằng số chứng minh nhân dân trước khi nhập URL.',
          ],
          correctIndex: 1,
          explanation: 'SSRF xảy ra khi server bị lừa gửi request tới hạ tầng nội bộ của chính mình. Kẻ tấn công thường nhập URL như http://169.254.169.254/latest/meta-data/ để cướp IAM Token của máy chủ đám mây, hoặc http://localhost:6379 để tấn công Redis nội bộ. Phòng thủ: Phân giải DNS và kiểm tra IP (IP Blacklist): Cấm 127.0.0.1, localhost, các dải Private IP RFC 1918 và Cloud Metadata IP.'
        },
        {
          id: 'c9-l3-q8',
          question: 'Cơ chế Rate Limiting dạng "Sliding Window Counter" trên Redis khắc phục được nhược điểm chí mạng nào của thuật toán "Fixed Window Counter"?',
          options: [
            'Thuật toán Fixed Window hoàn toàn không thể chạy được trên các máy chủ đa nhân.',
            'Fixed Window chỉ cho phép lưu trữ tối đa 10 địa chỉ IP trong danh sách đen.',
            'Fixed Window đòi hỏi phải cài đặt thêm hệ điều hành Windows Server bên cạnh Linux.',
            'Fixed Window bị lỗ hổng bùng nổ tải gấp đôi ở ranh giới giữa hai cửa sổ (Boundary Burst Spike, ví dụ gửi 100 req ở giây thứ 59 và 100 req ở giây thứ 61).',
          ],
          correctIndex: 3,
          explanation: 'Fixed Window chia thời gian thành các khung cố định (vd: 12:00 - 12:01 tối đa 100 req). Kẻ tấn công gửi 100 req lúc 12:00:59 và gửi tiếp 100 req lúc 12:01:01. Về mặt kỹ thuật, mỗi cửa sổ đều thỏa mãn <= 100 req, nhưng trong thực tế hệ thống phải hứng chịu 200 requests chỉ trong vòng 2 giây! Sliding Window tính toán trung bình trượt, ngăn chặn triệt để hiện tượng bùng nổ tại ranh giới.'
        }
      ],
      codeChallenge: {
        id: 'c9-l3-c1',
        title: 'Bộ Lọc Trắng Dữ Liệu An Toàn Chống Mass Assignment (DTO Whitelist Stripper)',
        description: 'Hiện thực hàm \`sanitizePayload(rawInput: Record<string, unknown>, allowedKeys: string[]): Record<string, unknown>\`. Hàm nhận vào một object dữ liệu thô và danh sách các trường được phép (\`allowedKeys\`). Trả về một object mới CHỈ CHỨA các trường nằm trong \`allowedKeys\`. Tuyệt đối không được giữ lại bất kỳ trường lạ nào ngoài danh sách.',
        starterCode: `export function sanitizePayload(
  rawInput: Record<string, unknown>,
  allowedKeys: string[]
): Record<string, unknown> {
  // TODO: Hiện thực lọc trắng các trường an toàn
  return {};
}`,
        solution: `export function sanitizePayload(
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
}`,
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
          },
          {
            name: 'Xử lý payload rỗng trả về object rỗng',
            input: [{}, ['fullName', 'email']],
            expected: {}
          },
          {
            name: 'Tất cả các trường trong input đều nằm ngoài allowedKeys',
            input: [{ maliciousKey: 'val1', hackerSecret: 123 }, ['name', 'age']],
            expected: {}
          },
          {
            name: 'Danh sách allowedKeys rỗng tước bỏ toàn bộ trường đầu vào',
            input: [{ a: 1, b: 2, c: 3 }, []],
            expected: {}
          }
        ]
      }
    }
  ]
};
