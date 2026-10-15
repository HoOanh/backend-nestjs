import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter3 } from '../curriculum/chapter3.ts';

const examQuestions: QuizQuestion[] = chapter3.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c3-challenge',
  level: 'advanced',
  levelLabel: 'Bài thi Thực hành Chương 3 · Tổng hợp Giao vận & An ninh Mạng',
  title: 'Xây Dựng CORS & Cookie Security Header Validator',
  description: 'Hiện thực hàm `validateSecurityHeaders(headers, cookies)` để kiểm toán chính sách bảo mật tầng mạng của dịch vụ Backend. Kiểm tra tuần tự:\n1. Nếu `headers["access-control-allow-origin"] === "*"` VÀ `headers["access-control-allow-credentials"] === "true"`, thêm mã lỗi `"INVALID_CORS_WILDCARD_WITH_CREDENTIALS"` vào mảng `issues`.\n2. Duyệt qua mảng `cookies`: với các cookie nhạy cảm có tên (không phân biệt hoa thường) chứa `"token"` hoặc `"session"`, nếu `httpOnly !== true` thì thêm `"MISSING_HTTPONLY"`; nếu `secure !== true` thì thêm `"MISSING_SECURE"`.\n3. Trả về đối tượng `{ isSecure: issues.length === 0, issues }`.',
  guidedSteps: [
    'Bước 1 (Khởi tạo danh sách lỗi): Khai báo mảng const issues = [] để thu thập các mã vi phạm bảo mật.',
    'Bước 2 (Kiểm tra tổ hợp CORS nguy hiểm): Nếu headers["access-control-allow-origin"] === "*" và headers["access-control-allow-credentials"] === "true", đẩy "INVALID_CORS_WILDCARD_WITH_CREDENTIALS" vào issues.',
    'Bước 3 (Kiểm tra cờ HttpOnly và Secure của Cookie nhạy cảm): Duyệt qua mảng cookies, chuyển c.name về chữ thường; nếu chứa "token" hoặc "session" thì kiểm tra !c.httpOnly ("MISSING_HTTPONLY") và !c.secure ("MISSING_SECURE").',
    'Bước 4 (Hoàn trả báo cáo kiểm toán): Trả về { isSecure: issues.length === 0, issues }.'
  ],
  hints: [
    'Sử dụng c.name.toLowerCase().includes("token") || c.name.toLowerCase().includes("session") để nhận diện mọi cookie xác thực nhạy cảm.',
    'Đảm bảo kiểm tra lỗi CORS trước rồi mới duyệt mảng cookies để thứ tự mã lỗi trong issues khớp chính xác với bộ kiểm thử.'
  ],
  starterCode: `function validateSecurityHeaders(headers, cookies) {
  // Bước 1: Khởi tạo mảng issues = []
  
  // Bước 2: Kiểm tra lỗi CORS Wildcard kết hợp với Credentials = "true"
  
  // Bước 3: Duyệt qua các cookie nhạy cảm (token, session) để kiểm tra cờ httpOnly và secure
  
  // Bước 4: Trả về { isSecure: issues.length === 0, issues }
}`,
  solution: `function validateSecurityHeaders(headers, cookies) {
  const issues = [];
  const safeHeaders = headers || {};
  const safeCookies = Array.isArray(cookies) ? cookies : [];

  const origin = safeHeaders['access-control-allow-origin'];
  const credentials = safeHeaders['access-control-allow-credentials'];
  if (origin === '*' && credentials === 'true') {
    issues.push('INVALID_CORS_WILDCARD_WITH_CREDENTIALS');
  }

  for (const c of safeCookies) {
    const lowerName = String(c.name || '').toLowerCase();
    if (lowerName.includes('token') || lowerName.includes('session')) {
      if (!c.httpOnly) {
        issues.push('MISSING_HTTPONLY');
      }
      if (!c.secure) {
        issues.push('MISSING_SECURE');
      }
    }
  }

  return {
    isSecure: issues.length === 0,
    issues,
  };
}`,
  testCases: [
    {
      name: 'Case 1 công khai: Bảo mật hoàn hảo với Origin tường minh và Cookie đầy đủ cờ',
      input: [
        { 'access-control-allow-origin': 'https://app.arc-irobot.tech', 'access-control-allow-credentials': 'true' },
        [{ name: 'refreshToken', httpOnly: true, secure: true, sameSite: 'strict' }]
      ],
      expected: { isSecure: true, issues: [] },
      hidden: false
    },
    {
      name: 'Case 2 công khai: Phát hiện lỗ hổng CORS Wildcard đi cùng Credentials = true',
      input: [
        { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' },
        []
      ],
      expected: { isSecure: false, issues: ['INVALID_CORS_WILDCARD_WITH_CREDENTIALS'] },
      hidden: false
    },
    {
      name: 'Case 3 công khai: Phát hiện Cookie phiên đăng nhập thiếu cờ HttpOnly',
      input: [
        {},
        [{ name: 'user_session', httpOnly: false, secure: true }]
      ],
      expected: { isSecure: false, issues: ['MISSING_HTTPONLY'] },
      hidden: false
    },
    {
      name: 'Case 4 ẩn: Phát hiện đồng thời lỗi CORS Wildcard và Cookie thiếu cả HttpOnly lẫn Secure',
      input: [
        { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' },
        [{ name: 'AUTH_TOKEN', httpOnly: false, secure: false }]
      ],
      expected: {
        isSecure: false,
        issues: ['INVALID_CORS_WILDCARD_WITH_CREDENTIALS', 'MISSING_HTTPONLY', 'MISSING_SECURE']
      },
      hidden: true
    },
    {
      name: 'Case 5 ẩn: Cookie giao diện thông thường (theme_mode) không nhạy cảm được bỏ qua kiểm tra',
      input: [
        { 'access-control-allow-origin': 'https://app.arc-irobot.tech', 'access-control-allow-credentials': 'true' },
        [{ name: 'theme_mode', httpOnly: false, secure: false }]
      ],
      expected: { isSecure: true, issues: [] },
      hidden: true
    }
  ]
};

export const exam3: SprintExam = {
  sprintId: 3,
  title: 'Kỳ Thi Đánh Giá Chương 3: Giao Thức Mạng Sâu Sắc: TCP Sockets, HTTP/1-3 & An Toàn Web',
  description: 'Khảo thí chuyên sâu: TCP 3-Way Handshake, Head-of-Line Blocking, HTTP/2 Multiplexing, HTTP/3 QUIC, Idempotency Keys và Quy chuẩn an toàn mạng CORS/Cookie.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
