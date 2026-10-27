export function resolveFocusSequenceIndex(
  plannedIndex: number | undefined,
  matchedIndex: number,
  visibleCount: number,
  previousIndex: number
): number {
  if (visibleCount <= 0) return -1;
  if (plannedIndex !== undefined) {
    return Math.max(previousIndex, Math.min(visibleCount - 1, Math.max(0, plannedIndex)));
  }
  if (matchedIndex < 0) return previousIndex;
  return Math.max(previousIndex, Math.min(matchedIndex, previousIndex + 1, visibleCount - 1));
}

export function buildStableFocusSequence(
  matchedIndexes: number[],
  visibleCount: number,
  authoredSequence?: number[]
): number[] {
  let previousIndex = -1;
  return matchedIndexes.map((matchedIndex, sentenceIndex) => {
    const focusIndex = resolveFocusSequenceIndex(
      authoredSequence?.[sentenceIndex],
      matchedIndex,
      visibleCount,
      previousIndex
    );
    previousIndex = focusIndex;
    return focusIndex;
  });
}

export function resolveFocusCue(
  focusPlan: Array<'highlight' | 'pointer' | 'circle' | 'none'> | undefined,
  focusIndex: number
): 'highlight' | 'pointer' | 'circle' | 'none' {
  if (focusIndex < 0) return 'none';
  return focusPlan?.[focusIndex] ?? 'highlight';
}
