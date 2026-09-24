import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter7 } from '../curriculum/chapter7.ts';

const examQuestions: QuizQuestion[] = chapter7.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c7-challenge',
  title: 'Xây Dựng Distributed Lock Evaluator (Redlock Lua Simulation)',
  description: 'Hiện thực hàm \`simulateLockManager(action: "ACQUIRE" | "RELEASE", lockKey: string, token: string, currentStore: Record<string, string>): { success: boolean; updatedStore: Record<string, string> }\`. Với \`"ACQUIRE"\`: nếu key chưa có trong \`currentStore\`, ghi nhận \`updatedStore[lockKey] = token\` và \`success: true\`; nếu đã có, \`success: false\`. Với \`"RELEASE"\`: nếu \`currentStore[lockKey] === token\`, xóa key khỏi \`updatedStore\` và \`success: true\`; nếu không khớp hoặc không có key, \`success: false\`.',
  starterCode: `
export function simulateLockManager(
  action: 'ACQUIRE' | 'RELEASE',
  lockKey: string,
  token: string,
  currentStore: Record<string, string>
): { success: boolean; updatedStore: Record<string, string> } {
  // TODO: Hiện thực quản trị khóa phân tán
  return { success: false, updatedStore: { ...currentStore } };
}
`,
  solution: `
export function simulateLockManager(
  action: 'ACQUIRE' | 'RELEASE',
  lockKey: string,
  token: string,
  currentStore: Record<string, string>
): { success: boolean; updatedStore: Record<string, string> } {
  const store = { ...currentStore };

  if (action === 'ACQUIRE') {
    if (!store[lockKey]) {
      store[lockKey] = token;
      return { success: true, updatedStore: store };
    }
    return { success: false, updatedStore: store };
  }

  if (action === 'RELEASE') {
    if (store[lockKey] === token) {
      delete store[lockKey];
      return { success: true, updatedStore: store };
    }
    return { success: false, updatedStore: store };
  }

  return { success: false, updatedStore: store };
}
`,
  testCases: [
    {
      name: 'Chiếm khóa thành công khi key chưa có',
      input: ['ACQUIRE', 'lock:order:1', 'token_1', {}],
      expected: { success: true, updatedStore: { 'lock:order:1': 'token_1' } }
    },
    {
      name: 'Chiếm khóa thất bại khi key đã bị người khác chiếm',
      input: ['ACQUIRE', 'lock:order:1', 'token_2', { 'lock:order:1': 'token_1' }],
      expected: { success: false, updatedStore: { 'lock:order:1': 'token_1' } }
    },
    {
      name: 'Giải phóng khóa thành công khi token khớp đúng',
      input: ['RELEASE', 'lock:order:1', 'token_1', { 'lock:order:1': 'token_1' }],
      expected: { success: true, updatedStore: {} }
    },
    {
      name: 'Từ chối giải phóng khóa khi token không khớp (chống xóa nhầm)',
      input: ['RELEASE', 'lock:order:1', 'token_wrong', { 'lock:order:1': 'token_1' }],
      expected: { success: false, updatedStore: { 'lock:order:1': 'token_1' } }
    }
  ]
};

export const exam7: SprintExam = {
  sprintId: 7,
  title: 'Kỳ Thi Đánh Giá Chương 7: In-Memory Caching & Redis Internals',
  description: 'Khảo thí chuyên sâu: Redis Single-threaded Architecture, I/O Multiplexing, Cấu trúc dữ liệu nội tại (SDS, SkipList), Chiến lược Cache-Aside, Chống Cache Stampede/Penetration/Avalanche và Khóa phân tán Redlock/Lua.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
