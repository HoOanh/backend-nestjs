/** A short breath between narrated beats; assessment pauses are handled by the caller. */
export function scheduleLectureAdvance(
  advance: () => void,
  canAdvance: () => boolean
): () => void {
  const timer = setTimeout(() => {
    if (canAdvance()) advance();
  }, 250);
  return () => clearTimeout(timer);
}
