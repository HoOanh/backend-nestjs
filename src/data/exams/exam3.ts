import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter3 } from '../curriculum/chapter3.ts';

const examQuestions: QuizQuestion[] = chapter3.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c3-challenge',
  title: 'Xây Dựng CORS & Cookie Security Header Validator',
  description: 'Hiện thực hàm \`validateSecurityHeaders(headers: Record<string, string>, cookies: Array<{ name: string; httpOnly?: boolean; secure?: boolean; sameSite?: string }>): { isSecure: boolean; issues: string[] }\`. Kiểm tra: 1. Nếu \`headers["access-control-allow-origin"] === "*"\` VÀ \`headers["access-control-allow-credentials"] === "true"\`, thêm lỗi \`"INVALID_CORS_WILDCARD_WITH_CREDENTIALS"\`. 2. Với các cookie nhạy cảm (\`token\`, \`session\`), nếu thiếu \`httpOnly === true\`, thêm \`"MISSING_HTTPONLY"\`; nếu thiếu \`secure === true\`, thêm \`"MISSING_SECURE"\`. Trả về \`isSecure: issues.length === 0\` và danh sách \`issues\`.',
  starterCode: `
export function validateSecurityHeaders(
  headers: Record<string, string>,
  cookies: Array<{ name: string; httpOnly?: boolean; secure?: boolean; sameSite?: string }>
): { isSecure: boolean; issues: string[] } {
  // TODO: Hiện thực kiểm tra bảo mật Header & Cookie
  return { isSecure: false, issues: [] };
}
`,
  solution: `
export function validateSecurityHeaders(
  headers: Record<string, string>,
  cookies: Array<{ name: string; httpOnly?: boolean; secure?: boolean; sameSite?: string }>
): { isSecure: boolean; issues: string[] } {
  const issues: string[] = [];

  const origin = headers['access-control-allow-origin'];
  const credentials = headers['access-control-allow-credentials'];
  if (origin === '*' && credentials === 'true') {
    issues.push('INVALID_CORS_WILDCARD_WITH_CREDENTIALS');
  }

  for (const c of cookies) {
    const lowerName = c.name.toLowerCase();
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
}
`,
  testCases: [
    {
      name: 'Bảo mật hoàn hảo với origin cụ thể và cookie có đầy đủ cờ',
      input: [
        { 'access-control-allow-origin': 'https://app.esmiles.vn', 'access-control-allow-credentials': 'true' },
        [{ name: 'refreshToken', httpOnly: true, secure: true, sameSite: 'strict' }]
      ],
      expected: { isSecure: true, issues: [] }
    },
    {
      name: 'Phát hiện lỗ hổng CORS Wildcard đi cùng Credentials = true',
      input: [
        { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' },
        []
      ],
      expected: { isSecure: false, issues: ['INVALID_CORS_WILDCARD_WITH_CREDENTIALS'] }
    },
    {
      name: 'Phát hiện cookie thiếu cờ HttpOnly',
      input: [
        {},
        [{ name: 'user_session', httpOnly: false, secure: true }]
      ],
      expected: { isSecure: false, issues: ['MISSING_HTTPONLY'] }
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
