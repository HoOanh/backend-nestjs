import type { QuizQuestion, CodeChallenge } from './curriculum.ts';

export interface SprintExam {
  sprintId: number;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questionCountToPick: number;
  questions: QuizQuestion[];
  codeChallenge: CodeChallenge;
}

export interface FinalExam {
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScore: number;
  questionCountToPick: number;
  questions: QuizQuestion[];
  codeChallenges: CodeChallenge[];
}

export interface ExamReviewData {
  examTitle: string;
  sprintId?: number;
  studentScore: number;
  passingScore: number;
  isPassed: boolean;
  totalQuestions: number;
  correctCount: number;
  wrongQuestions: Array<{
    id: string;
    question: string;
    studentAnswer: string;
    correctAnswer: string;
    explanation: string;
  }>;
  codeChallengeTitle?: string;
  codeSubmission?: string;
  passedTestsCount?: number;
  totalTestsCount?: number;
  evalOutput?: string;
}
