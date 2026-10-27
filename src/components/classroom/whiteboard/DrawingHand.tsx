import { writingHand } from './writingHandAsset';
import { whiteboardDesign as design } from './designSystem';

/** Photographic cutout. The exposed nib at image pixel (117, 123) anchors the pen. */
export function DrawingHand() {
  const scale = design.handWidth / 1254;
  return <image aria-hidden="true" href={writingHand} x={-117 * scale} y={-123 * scale} width={design.handWidth} height={design.handWidth} preserveAspectRatio="xMidYMid meet" />;
}
