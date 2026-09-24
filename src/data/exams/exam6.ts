import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter6 } from '../curriculum/chapter6.ts';

const examQuestions: QuizQuestion[] = chapter6.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c6-challenge',
  title: 'Xây Dựng Lock Ordering Deadlock Preventer',
  description: 'Hiện thực hàm \`getSortedResourceLocks(resourceIds: number[]): number[]\`. Nhận vào danh sách các ID tài nguyên cần khóa. Loại bỏ các ID trùng lặp và sắp xếp theo thứ tự số nguyên tăng dần. Nếu danh sách sau khi lọc rỗng, ném ra Error \`"NO_RESOURCES_TO_LOCK"\`. Trả về danh sách thứ tự khóa chuẩn xác.',
  starterCode: `
export function getSortedResourceLocks(resourceIds: number[]): number[] {
  // TODO: Hiện thực sắp xếp tài nguyên chống deadlock
  return [];
}
`,
  solution: `
export function getSortedResourceLocks(resourceIds: number[]): number[] {
  if (!resourceIds || resourceIds.length === 0) {
    throw new Error('NO_RESOURCES_TO_LOCK');
  }

  const unique = Array.from(new Set(resourceIds));
  if (unique.length === 0) {
    throw new Error('NO_RESOURCES_TO_LOCK');
  }

  return unique.sort((a, b) => a - b);
}
`,
  testCases: [
    {
      name: 'Sắp xếp tăng dần và loại bỏ ID trùng lặp',
      input: [[50, 10, 20, 50, 10]],
      expected: [10, 20, 50]
    },
    {
      name: 'Ném lỗi khi mảng tài nguyên rỗng',
      input: [[]],
      expected: 'THREW_ERROR'
    }
  ]
};

export const exam6: SprintExam = {
  sprintId: 6,
  title: 'Kỳ Thi Đánh Giá Chương 6: Transaction Isolation, Concurrency Control & Database Locking',
  description: 'Khảo thí chuyên sâu: 4 Cấp độ cô lập ACID, Hiện tượng đọc dị thường (Write Skew), MVCC xmin/xmax, Table Bloat & AutoVacuum, Khóa bi quan (SELECT FOR UPDATE) vs Khóa lạc quan và Sắp xếp khóa chống Deadlock.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
