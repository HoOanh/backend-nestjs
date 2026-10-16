import type { QuizQuestion } from '../curriculum/types.ts';

export interface InstructorVisualNode {
  id: string;
  title: string;
  detail: string;
}

export type InstructorVisual =
  | {
      kind: 'text-slide';
      eyebrow?: string;
      lead: string;
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
