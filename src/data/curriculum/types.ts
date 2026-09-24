export interface TestCase {
  name?: string;
  description?: string;
  input: unknown[];
  expected: unknown;
  hidden?: boolean;
}

export interface CodeChallenge {
  id?: string;
  title: string;
  description: string;
  starterCode: string;
  solution?: string;
  testCases: TestCase[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  tag: string;
  theory: string;
  realCodeSnippet: string;
  quiz: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export interface Sprint {
  sprintId: number;
  sprintTitle: string;
  sprintDesc: string;
  lessons: Lesson[];
}
