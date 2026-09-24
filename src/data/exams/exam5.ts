import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter5 } from '../curriculum/chapter5.ts';

const examQuestions: QuizQuestion[] = chapter5.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c5-challenge',
  title: 'Xây Dựng EXPLAIN Output Diagnostic Scanner',
  description: 'Hiện thực hàm \`diagnoseQueryPerformance(planText: string): { isSlow: boolean; warnings: string[] }\`. Quét chuỗi kế hoạch EXPLAIN: 1. Nếu chứa \`"Seq Scan"\` và số rows > 1000 (dạng \`rows=...\`), thêm cảnh báo \`"UNINDEXED_LARGE_SEQ_SCAN"\`. 2. Nếu chứa \`"external merge Disk"\`, thêm cảnh báo \`"WORK_MEM_SPILL_TO_DISK"\`. 3. Nếu chứa \`"Index Only Scan"\`, không cảnh báo. Trả về \`isSlow: warnings.length > 0\` và mảng \`warnings\`.',
  starterCode: `
export function diagnoseQueryPerformance(planText: string): { isSlow: boolean; warnings: string[] } {
  // TODO: Hiện thực phân tích kế hoạch query
  return { isSlow: false, warnings: [] };
}
`,
  solution: `
export function diagnoseQueryPerformance(planText: string): { isSlow: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (planText.includes('Seq Scan')) {
    const rowMatch = planText.match(/rows=([0-9]+)/);
    if (rowMatch && parseInt(rowMatch[1], 10) > 1000) {
      warnings.push('UNINDEXED_LARGE_SEQ_SCAN');
    }
  }

  if (planText.includes('external merge Disk')) {
    warnings.push('WORK_MEM_SPILL_TO_DISK');
  }

  return {
    isSlow: warnings.length > 0,
    warnings,
  };
}
`,
  testCases: [
    {
      name: 'Kế hoạch Index Only Scan tối ưu không có cảnh báo',
      input: ['-> Index Only Scan on idx_users (cost=0.28..8.30 rows=1 width=32)'],
      expected: { isSlow: false, warnings: [] }
    },
    {
      name: 'Cảnh báo khi quét toàn bảng dữ liệu lớn (5000 dòng)',
      input: ['-> Seq Scan on large_table (cost=10.00..450.00 rows=5000 width=64)'],
      expected: { isSlow: true, warnings: ['UNINDEXED_LARGE_SEQ_SCAN'] }
    },
    {
      name: 'Cảnh báo khi sắp xếp bị tràn bộ nhớ ra đĩa cứng',
      input: ['Sort Method: external merge Disk: 4096kB'],
      expected: { isSlow: true, warnings: ['WORK_MEM_SPILL_TO_DISK'] }
    }
  ]
};

export const exam5: SprintExam = {
  sprintId: 5,
  title: 'Kỳ Thi Đánh Giá Chương 5: Cơ Sở Dữ Liệu: PostgreSQL Engine & Query Optimizer',
  description: 'Khảo thí chuyên sâu: Cấu trúc 8KB Page, WAL & Checkpoint, B-Tree Page Splits, Covering Index (INCLUDE) và Giải mã EXPLAIN (ANALYZE, BUFFERS).',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
