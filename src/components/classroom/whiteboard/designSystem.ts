/** Shared visual language for lesson illustrations, independent of page chrome. */
export const whiteboardDesign = {
  ink: '#29374b',
  blue: '#326fa3',
  green: '#378370',
  orange: '#bd824b',
  red: '#d93b4b',
  muted: '#82909e',
  paper: '#ffffff',
  handwriting: "'Patrick Hand', 'Playpen Sans', cursive",
  handWidth: 520,
  motion: {
    previewStageSeconds: 16,
    drawingEnd: 0.35,
    drawingEndWithoutHighlight: 0.35,
    highlightTravelEnd: 0.4,
    highlightEnd: 0.5,
    handExitEnd: 0.54
  }
} as const;
