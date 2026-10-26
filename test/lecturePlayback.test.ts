import { describe, expect, test } from 'bun:test';
import { scheduleLectureAdvance } from '../src/components/classroom/lecturePlayback.ts';

describe('lecture beat transitions', () => {
  test('continues promptly and respects pause or navigation during the transition', async () => {
    let advances = 0;
    let autoPlay = true;
    const cancelFirst = scheduleLectureAdvance(() => advances += 1, () => autoPlay);
    await Bun.sleep(350);
    expect(advances).toBe(1);
    cancelFirst();

    const cancelPaused = scheduleLectureAdvance(() => advances += 1, () => autoPlay);
    autoPlay = false;
    await Bun.sleep(350);
    expect(advances).toBe(1);
    cancelPaused();

    autoPlay = true;
    const cancelNavigation = scheduleLectureAdvance(() => advances += 1, () => autoPlay);
    cancelNavigation();
    await Bun.sleep(350);
    expect(advances).toBe(1);
  });
});
