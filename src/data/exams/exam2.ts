import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter2 } from '../curriculum/chapter2.ts';

const examQuestions: QuizQuestion[] = chapter2.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c2-challenge',
  title: 'Xây Dựng Event Loop Lag Monitor Alarm',
  description: 'Hiện thực hàm \`evaluateLagHealth(p99LagMs: number, maxThresholdMs: number): { status: "HEALTHY" | "DEGRADED" | "CRITICAL"; action: string }\`. Nếu \`p99LagMs <= maxThresholdMs\`, trả về \`{ status: "HEALTHY", action: "NONE" }\`. Nếu \`p99LagMs > maxThresholdMs\` nhưng \`<= maxThresholdMs * 2\`, trả về \`{ status: "DEGRADED", action: "THROTTLE_TRAFFIC" }\`. Nếu vượt quá gấp đôi \`maxThresholdMs\`, trả về \`{ status: "CRITICAL", action: "SHED_LOAD_CIRCUIT_OPEN" }\`.',
  starterCode: `
export function evaluateLagHealth(
  p99LagMs: number,
  maxThresholdMs: number
): { status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'; action: string } {
  // TODO: Hiện thực đánh giá sức khỏe Event Loop
  return { status: 'HEALTHY', action: 'NONE' };
}
`,
  solution: `
export function evaluateLagHealth(
  p99LagMs: number,
  maxThresholdMs: number
): { status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'; action: string } {
  if (p99LagMs <= maxThresholdMs) {
    return { status: 'HEALTHY', action: 'NONE' };
  }
  if (p99LagMs <= maxThresholdMs * 2) {
    return { status: 'DEGRADED', action: 'THROTTLE_TRAFFIC' };
  }
  return { status: 'CRITICAL', action: 'SHED_LOAD_CIRCUIT_OPEN' };
}
`,
  testCases: [
    {
      name: 'Lag an toàn trong ngưỡng cho phép (20ms <= 50ms)',
      input: [20, 50],
      expected: { status: 'HEALTHY', action: 'NONE' }
    },
    {
      name: 'Lag suy giảm khi vượt ngưỡng nhưng chưa gấp đôi (80ms > 50ms và <= 100ms)',
      input: [80, 50],
      expected: { status: 'DEGRADED', action: 'THROTTLE_TRAFFIC' }
    },
    {
      name: 'Lag nghiêm trọng vượt ngưỡng gấp đôi (150ms > 100ms)',
      input: [150, 50],
      expected: { status: 'CRITICAL', action: 'SHED_LOAD_CIRCUIT_OPEN' }
    }
  ]
};

export const exam2: SprintExam = {
  sprintId: 2,
  title: 'Kỳ Thi Đánh Giá Chương 2: Libuv, OS Kernel System Calls & Non-Blocking Architecture',
  description: 'Khảo thí chuyên sâu: The Single-Thread Illusion, 6 Pha Libuv Event Loop, Drain Microtasks, Linux epoll/kqueue vs Libuv Threadpool, và Giám sát Event Loop Lag với Worker Threads.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
