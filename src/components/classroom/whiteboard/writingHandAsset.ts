import writingHand from '../../../assets/classroom/writing-hand.png';

let pending: Promise<void> | undefined;
let retainedImage: HTMLImageElement | undefined;

/** Keep the decoded image available for the SVG throughout the classroom session. */
export function preloadWritingHand(): Promise<void> {
  if (pending) return pending;
  pending = new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
      decoded.then(() => { retainedImage = image; resolve(); }, reject);
    };
    image.onerror = () => reject(new Error('Không tải được hình bàn tay.'));
    image.src = writingHand;
  }).catch((error: unknown) => {
    pending = undefined;
    retainedImage = undefined;
    throw error;
  });
  return pending;
}

export { writingHand };
