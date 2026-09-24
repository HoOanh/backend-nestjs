import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter1 } from '../curriculum/chapter1.ts';

// Gom các câu hỏi từ 3 bài học của Chương 1
const examQuestions: QuizQuestion[] = chapter1.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c1-challenge',
  title: 'Xây Dựng Memory Safe Event Emitter Chống Rò Rỉ Bộ Nhớ (Max Listeners Warning)',
  description: 'Hiện thực hàm \`simulateEventEmitter(maxListeners: number, ops: Array<{ op: "on" | "off" | "count"; evt: string }>): Array<number | string>\`. Nếu thêm quá \`maxListeners\`, đẩy chuỗi \`"MAX_LISTENERS_EXCEEDED"\` vào kết quả. Với \`"count"\`, đẩy số lượng listener hiện tại. Trả về mảng kết quả.',
  starterCode: `
export function simulateEventEmitter(
  maxListeners: number,
  ops: Array<{ op: 'on' | 'off' | 'count'; evt: string }>
): Array<number | string> {
  // TODO: Hiện thực quản trị listener an toàn chống memory leak
  return [];
}
`,
  solution: `
export function simulateEventEmitter(
  maxListeners: number,
  ops: Array<{ op: 'on' | 'off' | 'count'; evt: string }>
): Array<number | string> {
  const events = new Map<string, number>();
  const results: Array<number | string> = [];

  for (const item of ops) {
    const current = events.get(item.evt) || 0;
    if (item.op === 'on') {
      if (current >= maxListeners) {
        results.push('MAX_LISTENERS_EXCEEDED');
      } else {
        events.set(item.evt, current + 1);
      }
    } else if (item.op === 'off') {
      if (current > 0) {
        events.set(item.evt, current - 1);
      }
    } else if (item.op === 'count') {
      results.push(current);
    }
  }

  return results;
}
`,
  testCases: [
    {
      name: 'Thêm và đếm listener hợp lệ',
      input: [
        5,
        [
          { op: 'on', evt: 'data' },
          { op: 'on', evt: 'data' },
          { op: 'count', evt: 'data' }
        ]
      ],
      expected: [2]
    },
    {
      name: 'Ném cảnh báo khi vượt quá ngưỡng maxListeners = 1',
      input: [
        1,
        [
          { op: 'on', evt: 'data' },
          { op: 'on', evt: 'data' }
        ]
      ],
      expected: ['MAX_LISTENERS_EXCEEDED']
    }
  ]
};

export const exam1: SprintExam = {
  sprintId: 1,
  title: 'Kỳ Thi Đánh Giá Chương 1: Runtime Internals, V8 Engine & Quản Trị Bộ Nhớ',
  description: 'Khảo thí chuyên sâu: Bản chất Long-running Process, Giới hạn C10K, V8 Pipeline (Ignition/TurboFan), Inline Cache Deoptimization, V8 Garbage Collection và Kỹ thuật Profiling Memory Leak.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
