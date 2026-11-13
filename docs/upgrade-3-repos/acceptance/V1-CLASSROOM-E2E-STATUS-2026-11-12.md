# V1 classroom E2E status — 2026-11-12

## Verified locally

- Full local Playwright journey passed **1/1 in 6.3 minutes** on CMS `5173`, Web `3011`, API `3100`, and the local DB: bundle import, CMS review/publish, learner enrollment, materials/document tutor, quiz/code, all 31 CMS visual preview routes, ZeroTTS classroom and AI TTS opt-in classroom.
- The journey inspected all 31 imported visual previews. Their lookup APIs returned 200 on the passing run, and the presentation animation assertions passed.
- ZeroTTS remained the default mode; browser E2E observed real PCM playback, hand/board animation, and worker cancellation on classroom navigation. ZeroTTS classroom video export passed on the short `Guard → Pipe` lesson fixture; `ffprobe` found both video and non-silent audio tracks.
- AI TTS opt-in was published from CMS and verified as generated WAV audio (`RIFF`/`WAVE`) with classroom playback. A direct AI TTS browser export downloaded a playable MP4 (1,598,151 bytes); `ffprobe` found H.264 video and AAC audio tracks.
- Lesson C1-L1 is **7,096 narration words**; the live classroom estimates **42:14** at its configured 2.8 words/second pace. Counting all 31 plans gives 62,428 narration words, with estimated durations from 3.1 to 42.2 minutes (median 5.8). The distribution is inconsistent, and full video export of this long imported lesson has not been verified.
- Screenshot evidence: `arc-academy-web/test-results/journey-live-CMS-draft-imp-7177f-erials-and-pinned-classroom/learner-classroom-continuous-board.png`.
- The previous E2E failure was the CSS back-link locator; role-based link selection now passes. The cancellation stress input is bounded to 8 copies of one synthesis request. Checks passed before this edit: web TypeScript, targeted ESLint, four whiteboard layout tests, backend TypeScript. Re-run the Web check set after final edits.

## Reproduce

Use loopback services and a fresh actor fixture because actor sessions rotate/expire. Do not check the actor file into Git.

```sh
cd arc-academy-backend
ARC_CONTENT_TEST=1 ARC_TEST_ACTORS_FILE=../arc-academy-web/.local/journey-actors.json \
  /Users/hominhoanh/.nvm/versions/node/v26.12.1/bin/node .local/tools/scripts/content-browser-fixture.js

cd ../arc-academy-web
ARC_JOURNEY_TEST=1 \
ARC_JOURNEY_CMS=http://localhost:5173 \
ARC_JOURNEY_WEB=http://localhost:3011 \
ARC_JOURNEY_BROWSER_PROFILE=.local/arc-v1-brave-profile-run2 \
ARC_TEST_ACTORS_FILE=.local/journey-actors.json \
ARC_PLAYWRIGHT_EXECUTABLE_PATH='/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' \
/Users/hominhoanh/.nvm/versions/node/v26.12.1/bin/node node_modules/@playwright/test/cli.js test -c e2e/journey-playwright.config.ts --reporter=line
```

The latest passing run used the already-running local Web `3011`, API `3100`, and CMS `5173`; it used Node `26.12.1` because the shell default Node 16 cannot load the local Prisma query compiler. The actors file is local-only and contains credentials; never print or commit it.

## Open V1 risks

- Browser ZeroTTS uses the ONNX backend and downloads roughly 862 MB on a cold cache. In the temporary Playwright context Cache API persistence was rejected, so assets were usable for that session but not persisted there. Verify persistence and cold-start time in a normal persistent browser profile before release; consider a smaller supported runtime or lesson-audio pre-generation.
- Full ZeroTTS export of imported C1-L1 (42:14 estimated narration) remains unverified. The current `MediaRecorder` captures the presentation while the narration plays, so export time is expected to track the full audio duration; provide clear progress and decide whether this duration is acceptable or the lesson script needs editorial compression before release.
- First-use ZeroTTS still downloads roughly 862 MB; verify cold-start, persistent-cache reuse, and the complete lesson media-preparation state in a normal browser profile.
- Imported lesson content beyond the exercised learner target still needs content QA across the full 31-lesson course (accuracy, pacing, and each visual's alignment to narration).

## Working tree

Changes remain uncommitted and undeployed. Current code edits are in `arc-academy-web`, `arc-academy-backend`, `arc-academy-cms`, and `backend-nestjs`. Do not claim V1 is fully released based on this local acceptance run.

## User acceptance direction — 2026-11-13

- Classroom voice must default to ZeroTTS. Do not use browser-native speech synthesis. AI TTS is opt-in through the CMS voice setting; when it is off, use ZeroTTS.
- On classroom entry, show a real preparation state while lesson narration, sound, and visual assets load. The learner should start a coherent, continuous lesson after preparation; avoid an empty board, silent gaps caused by just-in-time synthesis, and arbitrary instructional chunking.
- Match the approved MVP classroom composition and pacing shown in the user's reference screenshots: full-width visual board, coordinated drawing/animation and narration, steady controls, transcript, learner interaction, and polished audio. The current implementation does not meet this acceptance bar despite the technical E2E pass.
- The current turn did not complete a cold-cache ZeroTTS speed benchmark. Do not report that benchmark, full C1-L1 media preparation, or the 42-minute lesson video export as passed.
- Next: first reproduce a cold and warm classroom entry in the persistent Brave profile and measure time to prepared narration; then implement whole-lesson audio/visual preparation with progress and cancellation, preserving ZeroTTS default and CMS AI TTS opt-in. Compare the live page against the approved MVP screenshots and iterate until the board, hand animation, timing, voice, and layout are acceptable. Re-run the complete live browser journey and report measured cold/warm readiness and export duration separately.
