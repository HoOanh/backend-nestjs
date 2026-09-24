import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter8 } from '../curriculum/chapter8.ts';

const examQuestions: QuizQuestion[] = chapter8.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c8-challenge',
  title: 'Xây Dựng Dead Letter Queue (DLQ) Router Simulator',
  description: 'Hiện thực hàm \`routeFailedJob(job: { id: string; attemptsMade: number; maxAttempts: number }, error: { isFatal: boolean; message: string }): { action: "RETRY" | "SEND_TO_DLQ"; delayMs?: number }\`. Nếu \`error.isFatal === true\` HOẶC \`job.attemptsMade >= job.maxAttempts\`: lập tức trả về \`{ action: "SEND_TO_DLQ" }\`. Ngược lại nếu là lỗi tạm thời và còn lượt thử: trả về \`{ action: "RETRY", delayMs: 1000 * Math.pow(2, job.attemptsMade) }\`.',
  starterCode: `
export function routeFailedJob(
  job: { id: string; attemptsMade: number; maxAttempts: number },
  error: { isFatal: boolean; message: string }
): { action: 'RETRY' | 'SEND_TO_DLQ'; delayMs?: number } {
  // TODO: Hiện thực điều phối lỗi và chuyển vùng DLQ
  return { action: 'SEND_TO_DLQ' };
}
`,
  solution: `
export function routeFailedJob(
  job: { id: string; attemptsMade: number; maxAttempts: number },
  error: { isFatal: boolean; message: string }
): { action: 'RETRY' | 'SEND_TO_DLQ'; delayMs?: number } {
  if (error.isFatal || job.attemptsMade >= job.maxAttempts) {
    return { action: 'SEND_TO_DLQ' };
  }

  const delayMs = 1000 * Math.pow(2, job.attemptsMade);
  return { action: 'RETRY', delayMs };
}
`,
  testCases: [
    {
      name: 'Cho phép retry với exponential delay khi còn lượt thử (attemptsMade = 1)',
      input: [{ id: 'job_1', attemptsMade: 1, maxAttempts: 3 }, { isFatal: false, message: 'TIMEOUT' }],
      expected: { action: 'RETRY', delayMs: 2000 }
    },
    {
      name: 'Chuyển thẳng vào DLQ khi gặp lỗi vĩnh viễn (isFatal = true)',
      input: [{ id: 'job_2', attemptsMade: 0, maxAttempts: 5 }, { isFatal: true, message: 'BAD_SYNTAX' }],
      expected: { action: 'SEND_TO_DLQ' }
    },
    {
      name: 'Chuyển vào DLQ khi đã kiệt sức số lần retry (attemptsMade >= maxAttempts)',
      input: [{ id: 'job_3', attemptsMade: 3, maxAttempts: 3 }, { isFatal: false, message: 'TIMEOUT' }],
      expected: { action: 'SEND_TO_DLQ' }
    }
  ]
};

export const exam8: SprintExam = {
  sprintId: 8,
  title: 'Kỳ Thi Đánh Giá Chương 8: Message Brokers & Kiến Trúc Hàng Đợi Phân Tán BullMQ',
  description: 'Khảo thí chuyên sâu: Đồng bộ vs Bất đồng bộ, Cấp độ At-Least-Once, Kiến trúc BullMQ Redis ZSET, Vòng đời 6 trạng thái Job, Exponential Backoff + Jitter, Poison Pills và Dead Letter Queue (DLQ).',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
