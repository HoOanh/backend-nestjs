---
name: "arc-content-pipeline"
description: "Design or modify Academy course content, source-document extraction, teaching plans and citation workflows. Use for content-to-lesson tasks; not for generic file uploads or runtime code setup without approval."
---

# Content-to-lesson workflow

DRAFT 0.2; staged in documentation, not installed. Preserve the current approval boundary; this skill never authorizes setup/code.

For the affected task, read [content spec](../../../specs/01-CONTENT-DOCUMENTS.md) and its sprint spec. When installed after approval, include that reference locally or update its path before validation.

- Identify course/lesson ownership, source document revisions and visibility before extracting or supplying context to AI. Distinguish author-only from learner-readable sources.
- Keep originals immutable. Capture parser version, extraction warnings and real page/section spans; do not invent page anchors for DOCX or scanned PDF.
- Build objectives → sections → narration → visuals → checkpoints with source mappings. Adapt the pedagogical template to the course, rather than forcing a Backend-specific file layout or fixed quiz count.
- AI creates a schema-validated draft with input hash, prompt/model provenance and unresolved citation findings. Applying it requires the current draft version; publishing requires human review.
- A source update produces an impact report/new draft; never rewrite the source revision of a published lecture or active session.
- Verify a valid import/authoring path and the relevant negative cases: wrong source scope, malformed extraction, stale apply or unsupported source. Report missing evidence rather than claiming success from a parser status alone.
