---
name: "arc-ai-classroom"
description: "Design or change Academy AI one-to-one sessions, voice and whiteboard playback, contextual conversation, checkpoints, resume and summaries. Excludes human video calling and unrelated chat apps."
---

# AI one-to-one classroom workflow

DRAFT 0.2; staged only. Read the affected protocol in [classroom spec](../../../specs/03-CLASSROOM-AI.md) and its sprint; carry local references when installing.

- Pin the room/lecture/source/persona versions at session creation. New publication must not mutate an active session.
- Keep server session state, single-writer lease, event IDs/version and last acknowledged checkpoint authoritative. The browser orchestrates playback and pending evidence, not verified pass flags.
- For questions, restrict context to the current objective/checkpoint and permitted source spans. Resolve citations and do not expose private documents, transcript or provider credentials.
- Raise-hand pauses lecture, handles question/answer, then resumes the intended beat. Cancellation, stream disconnect and provider timeout must not create duplicate messages or erase uncertain usage.
- Unsupported speech/ONNX/3D or provider outage must leave text/chat learning available. Clean up audio, workers, animation frames and WebGL resources when leaving the route.
- Check the changed risk: interruption/timing, lost ack, two devices/takeover, fake completion, stale package, source leakage or fallback. Summary failure does not undo a completed session.
