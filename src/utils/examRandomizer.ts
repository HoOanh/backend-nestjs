import type { QuizQuestion } from '../data/curriculum.ts';

export interface RandomizedQuestion extends QuizQuestion {
  originalIndex: number;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffles the options of a single question and updates correctIndex accordingly
 */
export function shuffleQuestionOptions(question: QuizQuestion, originalIndex: number): RandomizedQuestion {
  const correctOptionText = question.options[question.correctIndex];
  const shuffledOptions = shuffleArray(question.options);
  const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);

  return {
    ...question,
    originalIndex,
    options: shuffledOptions,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0
  };
}

/**
 * Samples K random questions from a question pool of N items and shuffles their options
 */
export function generateRandomExamQuestions(
  pool: QuizQuestion[],
  countToPick: number
): RandomizedQuestion[] {
  if (!pool || pool.length === 0) return [];
  
  const count = Math.min(countToPick || pool.length, pool.length);
  const shuffledPool = shuffleArray(pool);
  const selectedQuestions = shuffledPool.slice(0, count);

  return selectedQuestions.map((q, idx) => shuffleQuestionOptions(q, idx));
}
