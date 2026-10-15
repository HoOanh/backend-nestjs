export interface TestCase {
  name?: string;
  description?: string;
  input: unknown[];
  expected: unknown;
  hidden?: boolean;
}

export interface CodeChallenge {
  id?: string;
  level?: 'basic' | 'intermediate' | 'advanced';
  levelLabel?: string;
  title: string;
  description: string;
  guidedSteps?: string[];
  hints?: string[];
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
  videoUrl?: string;
  theory: string;
  realCodeSnippet: string;
  quiz: QuizQuestion[];
  codeChallenge: CodeChallenge;
  codeChallenges?: CodeChallenge[];
}

export interface Sprint {
  sprintId: number;
  sprintTitle: string;
  sprintDesc: string;
  lessons: Lesson[];
}

export interface TeachingCheckpoint {
  id: string;
  index: number;
  title: string;
  shortTitle?: string;
  summary: string;
  keyPoints?: string[];
  visualMarkdown?: string;
  boardMarkdown: string;
  codeExcerpt?: string;
  instructorLeadIn?: string;
  interactiveQuiz?: QuizQuestion;
  socraticQuestion: string;
  quickReplies: string[];
  type: 'concept' | 'architecture' | 'code-walkthrough' | 'final-practice';
}

export type CourseCategory =
  | 'Backend Engineering'
  | 'Frontend & UI Architecture'
  | 'Database & Storage'
  | 'DevOps & Distributed Systems'
  | 'Core Computer Science';

export type CourseLevel = 'Foundation' | 'Intermediate' | 'Advanced' | 'Master';

export interface CourseDefinition {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  requiredPlan: 'free' | 'pro' | 'enterprise';
  estimatedHours: number;
  accentColor: string;
  badgeText: string;
  techStack: string[];
  outcomes: string[];
  status: 'active' | 'early-access';
  curriculum: Sprint[];
}

export interface CareerPathMilestone {
  step: number;
  title: string;
  roleMilestone: string;
  courseId: string;
  outcome: string;
  skills: string[];
}

export interface CareerPathDefinition {
  id: string;
  title: string;
  subtitle: string;
  roleTarget: string;
  levelRange: string;
  estimatedMonths: string;
  description: string;
  accentColor: string;
  badgeText: string;
  courseIds: string[];
  milestones: CareerPathMilestone[];
}

