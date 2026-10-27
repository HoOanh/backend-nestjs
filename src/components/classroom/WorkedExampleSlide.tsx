import type { MotionValue } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { InstructorVisual } from '../../data/instructor-curriculum/types';
import { IllustratedLessonSlide } from './IllustratedLessonSlide';

export function WorkedExampleSlide({ visual, title, subtitle, visibleCount, focusIndex, progress, playing }: {
  visual: Extract<InstructorVisual, { kind: 'worked-example' }>;
  title?: string;
  subtitle?: string;
  visibleCount: number;
  focusIndex: number;
  progress?: MotionValue<number>;
  playing?: boolean;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const activeLines = visual.steps[focusIndex - 1]?.lines ?? [];
  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [visual]);
  useEffect(() => {
    const container = containerRef.current;
    const focused = container?.querySelector<HTMLElement>('[data-teaching-focus]');
    if (!container || !focused) return;
    const bounds = container.getBoundingClientRect();
    const target = focused.getBoundingClientRect();
    if (target.bottom > bounds.bottom || target.top < bounds.top) {
      container.scrollBy({ top: target.top - bounds.top - 12, behavior: 'smooth' });
    }
  }, [focusIndex]);
  if (visual.storyboard) {
    return <IllustratedLessonSlide key={visual.storyboard.caption} visual={visual} title={title} subtitle={subtitle} focusIndex={focusIndex} progress={progress} playing={playing} />;
  }
  return (
    <section ref={containerRef} className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-3 py-3 sm:px-6 lg:px-8" aria-label="Ví dụ giải thích từng bước">
      <header className="shrink-0 border-b border-stone-200 pb-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-sky-700">Ví dụ thực tế · lần theo từng bước</p>
        <h2 className="text-xl font-bold leading-tight text-stone-900 sm:text-2xl lg:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-stone-600">{subtitle}</p>
      </header>
      <p className={`shrink-0 text-base font-medium leading-relaxed text-stone-800 ${visibleCount < 1 ? 'invisible' : ''}`}>{visual.lead}</p>
      <div className="grid flex-none grid-cols-1 gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[1.1fr_1fr]">
        <figure className="min-w-0 self-start overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
          <figcaption className="border-b border-stone-200 px-4 py-2 font-mono text-xs text-stone-600">{visual.exhibit.label}</figcaption>
          {visual.exhibit.code ? (
            <pre className="overflow-x-auto py-3 text-[12px] leading-6 text-stone-800 sm:text-sm" aria-label={visual.exhibit.language || 'Code minh hoạ'}><code>
              {visual.exhibit.code.split('\n').map((line, index) => (
                <span key={index} data-active-line={activeLines.includes(index + 1) || undefined} className={`flex min-w-max border-l-2 pr-4 ${activeLines.includes(index + 1) ? 'border-sky-600 bg-sky-100 font-semibold text-sky-950' : 'border-transparent'}`}>
                  <span className="w-10 shrink-0 select-none pr-3 text-right font-normal text-stone-400" aria-hidden="true">{index + 1}</span>
                  <span>{line || ' '}</span>
                </span>
              ))}
            </code></pre>
          ) : (
            <dl className="divide-y divide-stone-200 px-4">
              {visual.exhibit.rows?.map((row) => (
                <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 py-4">
                  <dt className="text-sm text-stone-600">{row.label}</dt>
                  <dd className="font-mono text-base font-semibold text-stone-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </figure>
        <ol className="space-y-3 self-start" aria-label="Các bước giải thích">
          {visual.steps.map((step, index) => {
            const revealed = visibleCount >= index + 2;
            const focused = focusIndex === index + 1;
            return (
              <li key={step.title} aria-hidden={!revealed} data-teaching-focus={focused || undefined} className={`flex gap-3 rounded-lg border-l-2 p-3 transition-opacity duration-300 ${revealed ? 'opacity-100' : 'invisible opacity-0'} ${focused ? 'border-sky-600 bg-sky-50' : 'border-stone-200'}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${focused ? 'bg-sky-700 text-white' : 'bg-stone-100 text-stone-500'}`}>{index + 1}</span>
                <div><h3 className="text-sm font-bold text-stone-900 sm:text-base">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-stone-600">{step.detail}</p></div>
              </li>
            );
          })}
        </ol>
      </div>
      <p data-teaching-focus={focusIndex === visual.steps.length + 1 || undefined} aria-hidden={visibleCount < visual.steps.length + 2} className={`shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 ${visibleCount < visual.steps.length + 2 ? 'invisible' : ''}`}>
        {visual.result}
      </p>
    </section>
  );
}
