import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter9 } from '../curriculum/chapter9.ts';

const examQuestions: QuizQuestion[] = chapter9.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c9-challenge',
  title: 'Xây Dựng SQL Injection & Parameter Tampering Detector',
  description: "Hiện thực hàm `detectMaliciousInput(inputString: string): { isSuspicious: boolean; detectedPatterns: string[] }`. Quét chuỗi: nếu chứa các mẫu SQLi kinh điển như `' OR '1'='1` (không phân biệt hoa thường), `DROP TABLE`, `UNION SELECT`, hoặc `--`, thêm vào danh sách `detectedPatterns`. Trả về `isSuspicious: detectedPatterns.length > 0` và mảng `detectedPatterns`.",
  starterCode: `
export function detectMaliciousInput(inputString: string): {
  isSuspicious: boolean;
  detectedPatterns: string[];
} {
  // TODO: Hiện thực phát hiện mẫu tấn công SQL Injection
  return { isSuspicious: false, detectedPatterns: [] };
}
`,
  solution: `
export function detectMaliciousInput(inputString: string): {
  isSuspicious: boolean;
  detectedPatterns: string[];
} {
  const patterns = [
    { name: 'SQLI_TAUTOLOGY', regex: /'\\s*OR\\s*['"]?1['"]?\\s*=\\s*['"]?1/i },
    { name: 'DROP_TABLE', regex: /DROP\\s+TABLE/i },
    { name: 'UNION_SELECT', regex: /UNION\\s+SELECT/i },
    { name: 'SQL_COMMENT', regex: /--/ },
  ];

  const detectedPatterns: string[] = [];

  for (const p of patterns) {
    if (p.regex.test(inputString)) {
      detectedPatterns.push(p.name);
    }
  }

  return {
    isSuspicious: detectedPatterns.length > 0,
    detectedPatterns,
  };
}
`,
  testCases: [
    {
      name: 'Chuỗi đầu vào an toàn bình thường',
      input: ['admin@esmiles.vn'],
      expected: { isSuspicious: false, detectedPatterns: [] }
    },
    {
      name: 'Phát hiện câu lệnh SQL Tautology tiêm mã độc',
      input: ["' OR '1'='1' --"],
      expected: { isSuspicious: true, detectedPatterns: ['SQLI_TAUTOLOGY', 'SQL_COMMENT'] }
    },
    {
      name: 'Phát hiện lệnh DROP TABLE phá hoại dữ liệu',
      input: ['test; DROP TABLE users;'],
      expected: { isSuspicious: true, detectedPatterns: ['DROP_TABLE'] }
    }
  ]
};

export const exam9: SprintExam = {
  sprintId: 9,
  title: 'Kỳ Thi Đánh Giá Chương 9: Security Hardening & Mật Mã Học Cấp Doanh Nghiệp',
  description: 'Khảo thí chuyên sâu: Argon2id Memory-hardness, Chữ ký số bất đối xứng RS256/ES256, Chống Key Confusion, Phân quyền RBAC vs ABAC (CASL), Token Revocation Blocklist và Phòng thủ SQL Injection/Mass Assignment.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
