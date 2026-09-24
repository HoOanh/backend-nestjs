import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter4 } from '../curriculum/chapter4.ts';

const examQuestions: QuizQuestion[] = chapter4.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c4-challenge',
  title: 'Xây Dựng NestJS Dependency Resolver (DAG Topological Sort)',
  description: 'Hiện thực hàm \`resolveDependencyOrder(modules: Record<string, string[]>): string[]\`. Hàm nhận vào một đồ thị biểu diễn các module và mảng module phụ thuộc của nó. Trả về mảng thứ tự khởi tạo của các module (module không phụ thuộc ai khởi tạo trước, module phụ thuộc khởi tạo sau). Nếu phát hiện có vòng lặp phụ thuộc (Circular Dependency), ném ra Error \`"CIRCULAR_DEPENDENCY_DETECTED"\`.',
  starterCode: `
export function resolveDependencyOrder(modules: Record<string, string[]>): string[] {
  // TODO: Hiện thực thuật toán Topological Sort
  return [];
}
`,
  solution: `
export function resolveDependencyOrder(modules: Record<string, string[]>): string[] {
  const result: string[] = [];
  const visited: Record<string, boolean> = {};
  const visiting: Record<string, boolean> = {};

  function visit(node: string) {
    if (visiting[node]) {
      throw new Error('CIRCULAR_DEPENDENCY_DETECTED');
    }
    if (!visited[node]) {
      visiting[node] = true;
      const deps = modules[node] || [];
      for (const dep of deps) {
        visit(dep);
      }
      visiting[node] = false;
      visited[node] = true;
      result.push(node);
    }
  }

  for (const mod of Object.keys(modules)) {
    if (!visited[mod]) {
      visit(mod);
    }
  }

  return result;
}
`,
  testCases: [
    {
      name: 'Khởi tạo theo thứ tự tô-pô chuẩn (Config -> Database -> Users)',
      input: [{ Users: ['Database'], Database: ['Config'], Config: [] }],
      expected: ['Config', 'Database', 'Users']
    },
    {
      name: 'Ném lỗi khi phát hiện vòng lặp giữa A và B',
      input: [{ A: ['B'], B: ['A'] }],
      expected: 'THREW_ERROR'
    }
  ]
};

export const exam4: SprintExam = {
  sprintId: 4,
  title: 'Kỳ Thi Đánh Giá Chương 4: NestJS Core Architecture: IoC Container & Request Pipeline',
  description: 'Khảo thí chuyên sâu: Inversion of Control, Reflect Metadata, Đồ thị DAG, Circular Dependency (forwardRef), Pipeline 5 bước (Middleware -> Guard -> Interceptor -> Pipe -> Filter) và Hiểm họa Scope.REQUEST.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
