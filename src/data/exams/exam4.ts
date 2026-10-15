import type { QuizQuestion, CodeChallenge } from '../curriculum.ts';
import type { SprintExam } from '../sprintExams.ts';
import { chapter4 } from '../curriculum/chapter4.ts';

const examQuestions: QuizQuestion[] = chapter4.lessons.flatMap((l) => l.quiz);

const examChallenge: CodeChallenge = {
  id: 'exam-c4-challenge',
  level: 'advanced',
  levelLabel: 'Bài thi Thực hành Chương 4 · Tổng hợp IoC Container & Đồ thị DAG',
  title: 'Xây Dựng NestJS Dependency Resolver (DAG Topological Sort)',
  description: 'Hiện thực hàm `resolveDependencyOrder(modules)` nhận vào một đồ thị biểu diễn các module và mảng module phụ thuộc của nó (`Record<string, string[]>`). Trả về mảng thứ tự khởi tạo của các module (module không phụ thuộc ai khởi tạo trước, module phụ thuộc khởi tạo sau). Nếu phát hiện có vòng lặp phụ thuộc (Circular Dependency), chủ động ném ra `new Error("CIRCULAR_DEPENDENCY_DETECTED")`.',
  guidedSteps: [
    'Bước 1 (Khởi tạo trạng thái duyệt DFS): Khai báo mảng result = [] cùng hai bảng trạng thái visited = {} (đã hoàn tất) và visiting = {} (đang nằm trên ngăn xếp đệ quy).',
    'Bước 2 (Phát hiện chu trình khép kín): Trong hàm đệ quy visit(node), nếu visiting[node] === true thì lập tức throw new Error("CIRCULAR_DEPENDENCY_DETECTED").',
    'Bước 3 (Duyệt đệ quy Post-Order): Nếu !visited[node], đánh dấu visiting[node] = true, gọi đệ quy visit(dep) cho từng phụ thuộc trong modules[node], sau đó gỡ visiting[node] = false, đánh dấu visited[node] = true và đẩy node vào result.',
    'Bước 4 (Duyệt toàn bộ các đỉnh trong đồ thị): Lặp qua Object.keys(modules), gọi visit(mod) cho các đỉnh chưa visited và trả về mảng result.'
  ],
  hints: [
    'Sử dụng kỹ thuật DFS Post-Order: luôn đệ quy khởi tạo hết các phần tử trong modules[node] trước rồi mới gọi result.push(node).',
    'Nhớ đặt visiting[node] = false ngay sau khi kết thúc vòng lặp duyệt các phụ thuộc con của node đó.'
  ],
  starterCode: `function resolveDependencyOrder(modules) {
  // Bước 1: Khởi tạo mảng result = [], visited = {}, visiting = {}
  
  // Bước 2: Viết hàm đệ quy visit(node) kiểm tra visiting[node] để ném lỗi "CIRCULAR_DEPENDENCY_DETECTED"
  
  // Bước 3: Đệ quy duyệt qua từng dep của node trước khi đẩy node vào result
  
  // Bước 4: Duyệt qua toàn bộ Object.keys(modules) và trả về result
}`,
  solution: `function resolveDependencyOrder(modules) {
  const result = [];
  const visited = {};
  const visiting = {};

  function visit(node) {
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

  for (const mod of Object.keys(modules || {})) {
    if (!visited[mod]) {
      visit(mod);
    }
  }

  return result;
}`,
  testCases: [
    {
      name: 'Case 1 công khai: Khởi tạo theo thứ tự tô-pô chuẩn (Config -> Database -> Users)',
      input: [{ Users: ['Database'], Database: ['Config'], Config: [] }],
      expected: ['Config', 'Database', 'Users'],
      hidden: false
    },
    {
      name: 'Case 2 công khai: Đồ thị hình thoi (App phụ thuộc cả Auth và Billing, cả hai cùng phụ thuộc Config)',
      input: [{ App: ['Auth', 'Billing'], Auth: ['Config'], Billing: ['Config'], Config: [] }],
      expected: ['Config', 'Auth', 'Billing', 'App'],
      hidden: false
    },
    {
      name: 'Case 3 công khai: Ném lỗi CIRCULAR_DEPENDENCY_DETECTED khi phát hiện vòng lặp trực tiếp giữa A và B',
      input: [{ A: ['B'], B: ['A'] }],
      expected: 'ERROR_THROWN',
      hidden: false
    },
    {
      name: 'Case 4 ẩn: Ném lỗi khi phát hiện vòng lặp tam giác (Orders -> Payments -> Users -> Orders)',
      input: [{ Orders: ['Payments'], Payments: ['Users'], Users: ['Orders'] }],
      expected: 'ERROR_THROWN',
      hidden: true
    },
    {
      name: 'Case 5 ẩn: Đồ thị rỗng -> Trả về mảng rỗng an toàn',
      input: [{}],
      expected: [],
      hidden: true
    }
  ]
};

export const exam4: SprintExam = {
  sprintId: 4,
  title: 'Kỳ Thi Đánh Giá Chương 4: NestJS Core Architecture: IoC Container & Request Pipeline',
  description: 'Khảo thí chuyên sâu: Inversion of Control, Reflect Metadata, Kiến trúc PostgreSQL, Đồ thị DAG, Circular Dependency (forwardRef), Pipeline 5 bước (Middleware -> Guard -> Interceptor -> Pipe -> Filter) và Hiểm họa Scope.REQUEST.',
  timeLimitMinutes: 25,
  passingScore: 80,
  questionCountToPick: 10,
  questions: examQuestions,
  codeChallenge: examChallenge,
};
