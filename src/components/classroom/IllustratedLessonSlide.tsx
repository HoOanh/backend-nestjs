import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from 'framer-motion';
import { Code2, PenLine } from 'lucide-react';
import type { InstructorVisual } from '../../data/instructor-curriculum/types';
import { WhiteboardIllustration } from './whiteboard/WhiteboardIllustration';

export function IllustratedLessonSlide({ visual, title, subtitle, focusIndex, progress, playing }: {
  visual: Extract<InstructorVisual, { kind: 'worked-example' }>;
  title?: string;
  subtitle?: string;
  focusIndex: number;
  progress?: MotionValue<number>;
  playing?: boolean;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const reducedMotion = useReducedMotion();
  const step = visual.steps[focusIndex - 1];
  const concluded = focusIndex >= visual.steps.length + 1;
  const storyboard = visual.storyboard;
  if (!storyboard) return null;
  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto px-3 py-3 sm:px-7 lg:px-10" aria-label="Bài giảng minh hoạ chuyển động">
      <header className="shrink-0">
        <h2 className="text-xl font-bold leading-tight text-stone-900 sm:text-2xl lg:text-3xl">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 sm:text-sm">{subtitle}</p>
      </header>
      <div className="flex min-h-[210px] flex-1 items-center justify-center py-2">
        {showEvidence ? (
          <figure className="max-h-full w-full overflow-auto rounded-lg border border-stone-200 bg-white p-4">
            <figcaption className="mb-3 font-mono text-xs text-stone-500">{visual.exhibit.label}</figcaption>
            {visual.exhibit.code ? (
              <pre className="overflow-x-auto font-mono text-xs leading-7 text-stone-800 sm:text-sm"><code>{visual.exhibit.code.split('\n').map((line, index) => <span key={index} data-active-line={step?.lines?.includes(index + 1) || undefined} className={`block px-3 ${step?.lines?.includes(index + 1) ? 'bg-sky-50 font-semibold text-sky-900' : ''}`}>{line || ' '}</span>)}</code></pre>
            ) : <dl className="space-y-4">{visual.exhibit.rows?.map((row) => <div key={row.label} className="flex flex-wrap justify-between gap-3 border-b border-stone-100 pb-3"><dt className="text-sm text-stone-600">{row.label}</dt><dd className="font-mono text-sm font-semibold text-stone-900">{row.value}</dd></div>)}</dl>}
          </figure>
        ) : <WhiteboardIllustration key={storyboard.caption} scene={storyboard} focusIndex={focusIndex} progress={progress} playing={playing} />}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-stone-200 pt-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-h-[58px] min-w-0 flex-1" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={focusIndex} initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}>
              <p className={`text-base font-semibold sm:text-lg ${concluded ? 'text-emerald-800' : 'text-stone-900'}`}>{concluded ? visual.result : step?.title || visual.lead}</p>
              {step && !concluded && <p className="mt-1 text-sm leading-relaxed text-stone-600">{step.detail}</p>}
            </motion.div>
          </AnimatePresence>
        </div>
        {(visual.exhibit.code || visual.exhibit.rows?.length) && <button type="button" aria-pressed={showEvidence} onClick={() => setShowEvidence((value) => !value)} className="inline-flex shrink-0 items-center gap-2 self-start rounded-md px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          {showEvidence ? <PenLine size={14} /> : <Code2 size={14} />}{showEvidence ? 'Xem minh hoạ' : visual.exhibit.code ? 'Xem code' : 'Xem số liệu'}
        </button>}
      </div>
    </section>
  );
}
