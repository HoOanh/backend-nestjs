import type { QuizQuestion } from '../curriculum/types.ts';

export interface InstructorVisualNode {
  id: string;
  title: string;
  detail: string;
}

export type InstructorPresentationRole = 'title' | 'overview' | 'detail' | 'recap' | 'closing';
export type InstructorFocusCue = 'highlight' | 'pointer' | 'circle' | 'none';

export interface InstructorStoryboard {
  kind: 'process' | 'request-race' | 'event-loop' | 'queue' | 'multiplexing' | 'memory' | 'diagnosis';
  caption: string;
  variant?: 'isolated' | 'shared' | 'local' | 'blocked' | 'io' | 'threads' | 'fd';
}

export type InstructorVisual =
  | {
      kind: 'worked-example';
      storyboard?: InstructorStoryboard;
      lead: string;
      exhibit: {
        label: string;
        code?: string;
        language?: string;
        rows?: Array<{ label: string; value: string }>;
      };
      steps: Array<{ title: string; detail: string; lines?: number[] }>;
      result: string;
    }
  | {
      kind: 'text-slide';
      eyebrow?: string;
      lead: string;
      illustration?: { src: string; alt: string; caption?: string };
      metrics?: Array<{ value: string; label: string }>;
      points?: Array<{ title: string; detail: string }>;
      question?: string;
      note?: string;
    }
  | { kind: 'flow'; nodes: InstructorVisualNode[] }
  | {
      kind: 'cycle';
      centerLabel: string;
      nodes: InstructorVisualNode[];
    }
  | {
      kind: 'decision-tree';
      rootTitle: string;
      rootSubtitle: string;
      branches: Array<{
        condition: string;
        outcome: InstructorVisualNode;
        tone: 'recommended' | 'tradeoff' | 'neutral';
      }>;
      tradeoff?: string;
    }
  | {
      kind: 'architecture-comparison';
      left: { title: string; subtitle: string; steps: InstructorVisualNode[] };
      right: { title: string; subtitle: string; steps: InstructorVisualNode[] };
      bridge: string;
    }
  | {
      kind: 'comparison';
      columns: Array<{ title: string; points: string[] }>;
    }
  | {
      kind: 'latency-scale';
      items: Array<{ title: string; latencyNs: number; label: string }>;
    }
  | {
      kind: 'timeline';
      events: Array<{ time: string; actor: string; action: string }>;
    }
  | { kind: 'memory-map'; regions: InstructorVisualNode[] }
  | {
      kind: 'process-memory';
      regions: Array<InstructorVisualNode & { position: [number, number, number]; color: string }>;
    }
  | {
      kind: 'connection-model';
      strategies: Array<{ title: string; resource: string; limitation: string }>;
    };

export interface InstructorSlide {
  id: string;
  title: string;
  subtitle: string;
  narration: string;
  takeaway: string;
  visual: InstructorVisual;
  presentationRole?: InstructorPresentationRole;
  focusPlan?: InstructorFocusCue[];
  focusSequence?: number[];
}

export interface InstructorSection {
  id: string;
  title: string;
  objective: string;
  durationMinutes: number;
  slides: InstructorSlide[];
  check: QuizQuestion;
  explanation: string;
}

export interface InstructorLessonPlan {
  lessonId: string;
  title: string;
  durationMinutes: number;
  opening: InstructorSlide;
  roadmap?: InstructorSlide;
  sections: InstructorSection[];
  closing: InstructorSlide;
}
