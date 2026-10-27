import type { InstructorSlide, InstructorVisual } from './types';
import { splitIntoVietnameseSentences } from '../../utils/speechText';

type ExampleVisual = Extract<InstructorVisual, { kind: 'worked-example' }>;

/** Author the explanation with the exact board entry it is explaining. */
export function guidedSlide(input: {
  id: string;
  title: string;
  subtitle: string;
  lead: string;
  intro: string;
  exhibit: ExampleVisual['exhibit'];
  storyboard?: ExampleVisual['storyboard'];
  steps: Array<ExampleVisual['steps'][number] & { speech: string }>;
  takeaway: string;
  conclusion: string;
}): InstructorSlide {
  const parts = [input.intro, ...input.steps.map((step) => step.speech), input.conclusion];
  // End every part at a sentence boundary so the player and author use the
  // same segmentation, including long clauses split for Vietnamese TTS.
  const sentences = parts.map((part) => splitIntoVietnameseSentences(`${part.trim().replace(/[.!?]+$/, '')}.`));
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    narration: sentences.flat().join(' '),
    takeaway: input.takeaway,
    presentationRole: 'detail',
    focusSequence: sentences.flatMap((part, index) => part.map(() => index)),
    focusPlan: parts.map(() => 'highlight'),
    visual: {
      kind: 'worked-example',
      storyboard: input.storyboard,
      lead: input.lead,
      exhibit: input.exhibit,
      steps: input.steps.map(({ title, detail, lines }) => ({ title, detail, lines })),
      result: input.takeaway
    }
  };
}
