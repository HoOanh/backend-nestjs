import type { QuizQuestion, CodeChallenge } from './curriculum.ts';
import { exam1 } from './exams/exam1.ts';
import { exam2 } from './exams/exam2.ts';
import { exam3 } from './exams/exam3.ts';
import { exam4 } from './exams/exam4.ts';
import { exam5 } from './exams/exam5.ts';
import { exam6 } from './exams/exam6.ts';
import { exam7 } from './exams/exam7.ts';
import { exam8 } from './exams/exam8.ts';
import { exam9 } from './exams/exam9.ts';
import { exam10 } from './exams/exam10.ts';

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

export {
  exam1,
  exam2,
  exam3,
  exam4,
  exam5,
  exam6,
  exam7,
  exam8,
  exam9,
  exam10,
};

export const SPRINT_EXAMS: SprintExam[] = [
  exam1,
  exam2,
  exam3,
  exam4,
  exam5,
  exam6,
  exam7,
  exam8,
  exam9,
  exam10,
];
