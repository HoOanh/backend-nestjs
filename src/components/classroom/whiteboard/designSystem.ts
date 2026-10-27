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
    previewStageSeconds: 9,
    highlightTravelSeconds: 0.18,
    highlightSeconds: 0.65,
    handExitSeconds: 0.25
  }
} as const;
