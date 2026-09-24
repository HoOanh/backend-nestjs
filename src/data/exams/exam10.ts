import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter10 } from '../curriculum/chapter10.ts';

const examQuestions: QuizQuestion[] = chapter10.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c10-challenge',
  title: 'Xây Dựng Distributed Tracing Span Context Injector',
  description: 'Hiện thực hàm \`generateTraceparent(traceId: string, spanId: string, isSampled: boolean): string\`. Trả về chuỗi định dạng chuẩn W3C: \`00-\${traceId}-\${spanId}-\${flags}\` trong đó \`flags\` là \`"01"\` nếu \`isSampled === true\`, hoặc \`"00"\` nếu \`false\`. Nếu \`traceId.length !== 32\` hoặc \`spanId.length !== 16\`, ném ra Error \`"INVALID_TRACE_OR_SPAN_ID_LENGTH"\`.',
  starterCode: `
export function generateTraceparent(
  traceId: string,
  spanId: string,
  isSampled: boolean
): string {
  // TODO: Hiện thực tạo W3C traceparent header
  return '';
}
`,
  solution: `
export function generateTraceparent(
  traceId: string,
  spanId: string,
  isSampled: boolean
): string {
  if (!traceId || traceId.length !== 32 || !spanId || spanId.length !== 16) {
    throw new Error('INVALID_TRACE_OR_SPAN_ID_LENGTH');
  }

  const flags = isSampled ? '01' : '00';
  return \`00-\${traceId}-\${spanId}-\${flags}\`;
}
`,
  testCases: [
    {
      name: 'Tạo traceparent hợp lệ có lấy mẫu (isSampled = true)',
      input: [
        '4bf92f3577b34da6a3ce929d0e0e4736',
        '00f067aa0ba902b7',
        true
      ],
      expected: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    },
    {
      name: 'Tạo traceparent không lấy mẫu (isSampled = false)',
      input: [
        '4bf92f3577b34da6a3ce929d0e0e4736',
        '00f067aa0ba902b7',
        false
      ],
      expected: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
    },
    {
      name: 'Ném lỗi khi traceId không đủ 32 ký tự hex',
      input: [
        'short-id',
        '00f067aa0ba902b7',
        true
      ],
      expected: 'THREW_ERROR'
    }
  ]
};

export const exam10: SprintExam = {
  sprintId: 10,
  title: 'Kỳ Thi Đánh Giá Chương 10: Distributed Systems, High Availability & Production Observability',
  description: 'Khảo thí chuyên sâu: Định lý CAP & PACELC, Mẫu hình Saga Orchestration với Compensating Transactions, Circuit Breaker State Machine, Sliding Window Rate Limiting, OpenTelemetry Distributed Tracing và Kubernetes Health Probes.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
