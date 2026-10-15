import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter5 } from '../curriculum/chapter5.ts';

const examQuestions: QuizQuestion[] = chapter5.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c5-challenge',
  title: 'Xây Dựng EXPLAIN Output Diagnostic Scanner',
  description: 'Hiện thực hàm `diagnoseQueryPerformance(planText)`. Nếu chuỗi chứa `Seq Scan` và `rows=` lớn hơn 1000, đẩy `UNINDEXED_LARGE_SEQ_SCAN`. Nếu chứa `external merge Disk`, đẩy `WORK_MEM_SPILL_TO_DISK`. `Index Only Scan` không tự sinh cảnh báo. `isSlow` bằng `warnings.length > 0`. Giữ đúng thứ tự: seq scan trước, spill sau.',
  guidedSteps: [
    'Bước 1: Tạo mảng warnings rỗng và chỉ push khi điều kiện đúng.',
    'Bước 2: Seq Scan chỉ cảnh báo khi parseInt(rows) > 1000.',
    'Bước 3: external merge Disk là cảnh báo độc lập, có thể cộng dồn.',
    'Bước 4: isSlow = warnings.length > 0.',
  ],
  hints: [
    'rows=1000 không vượt ngưỡng, không được push UNINDEXED_LARGE_SEQ_SCAN.',
    'Một plan có thể chứa cả Seq Scan lớn lẫn external merge Disk; giữ cả hai mã.',
  ],
  starterCode: `function diagnoseQueryPerformance(planText: string): { isSlow: boolean; warnings: string[] } {
  return { isSlow: false, warnings: [] };
}`,
  solution: `function diagnoseQueryPerformance(planText: string): { isSlow: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (planText.includes('Seq Scan')) {
    const rowMatch = planText.match(/rows=([0-9]+)/);
    if (rowMatch && Number.parseInt(rowMatch[1], 10) > 1000) {
      warnings.push('UNINDEXED_LARGE_SEQ_SCAN');
    }
  }
  if (planText.includes('external merge Disk')) {
    warnings.push('WORK_MEM_SPILL_TO_DISK');
  }
  return { isSlow: warnings.length > 0, warnings };
}`,
  testCases: [
    {
      name: 'Index Only Scan không cảnh báo',
      input: ['-> Index Only Scan on idx_users (cost=0.28..8.30 rows=1 width=32)'],
      expected: { isSlow: false, warnings: [] },
      hidden: false,
    },
    {
      name: 'Seq Scan 5000 dòng',
      input: ['-> Seq Scan on large_table (cost=10.00..450.00 rows=5000 width=64)'],
      expected: { isSlow: true, warnings: ['UNINDEXED_LARGE_SEQ_SCAN'] },
      hidden: false,
    },
    {
      name: 'Sort tràn đĩa',
      input: ['Sort Method: external merge Disk: 4096kB'],
      expected: { isSlow: true, warnings: ['WORK_MEM_SPILL_TO_DISK'] },
      hidden: false,
    },
    {
      name: 'Seq Scan đúng biên 1000 dòng không cảnh báo',
      input: ['-> Seq Scan on tiny (cost=0.00..1.00 rows=1000 width=8)'],
      expected: { isSlow: false, warnings: [] },
      hidden: true,
    },
    {
      name: 'Cả seq scan lớn và spill cùng lúc',
      input: ['-> Seq Scan on orders (rows=2000 width=16) Sort Method: external merge Disk: 10kB'],
      expected: { isSlow: true, warnings: ['UNINDEXED_LARGE_SEQ_SCAN', 'WORK_MEM_SPILL_TO_DISK'] },
      hidden: true,
    },
  ],
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
