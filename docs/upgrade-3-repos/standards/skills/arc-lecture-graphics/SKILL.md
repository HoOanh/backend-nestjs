---
name: "arc-lecture-graphics"
description: "Design or adjust Academy lesson diagrams, slides, storyboard, narration cues and CMS-to-Web previews. Use when changing teaching visuals, not ordinary decorative UI or arbitrary image generation."
---

# Lesson graphics workflow

DRAFT 0.2; staged only. Follow the approved sprint and [graphics spec](../../../specs/02-GRAPHICS-LECTURES.md); relocate this reference with the skill when installing.

- Start with the learning objective and the relationship the visual must explain. Pick the appropriate supported visual kind; do not reuse one topology for every topic.
- Preserve semantic node/edge labels, source refs, alt text and renderer/schema versions. AI artwork is not evidence a technical diagram is correct.
- Bind reveal/draw/highlight/focus to narration beat IDs and the playback clock. Handle interruption/resume; do not add independent timers that drift from speech.
- CMS edits typed payload/config; Web owns the renderer. Preview and student playback must consume the same pinned package, not duplicated renderers.
- Do not execute JS, untrusted SVG/HTML, or dynamically uploaded components from content. Add a new visual kind only through a reviewed schema/renderer change.
- Check semantic correctness, text/reduced-motion fallback and deterministic timing on the affected fixture. Use visual screenshots only when stable and meaningful; they do not prove pedagogical accuracy.
