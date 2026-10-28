# S02 — Course structure and source documents

28/10/2026 · Contract **0.2.0** · **Implemented and qualified locally; human acceptance pending**.

## Authorization and scope

ĐẠI CA confirmed **“Mở P02, bắt đầu S02”**, then **“Chốt giới hạn và quyền mặc định đề xuất”**:20MiB/doc,100PDFpages, author-only default, explicit learner-readable links. This supersedes the foundation-only restriction in earlier reports. Implementation covers US-007/008/009 across backend/CMS/Web on `feat/s02-content`. No commit, push, remote CI, deployment, production migration, source import, AI call or OCR was performed. S03/S04 remain future work.

Existing `.env` contains remote configuration. Qualification used a separate private `.local/s02.env`, loopback Postgres/Redis/MinIO and isolated API3310/CMS5174/Web3002; the existing application on3001 was preserved. No credentials are recorded here. Integration suites reject a non-loopback database; fixture setup/actors require explicit local opt-in.

## Delivered behavior

- Relational Course/Chapter/Lesson, immutable CoursePublication metadata snapshot, Roadmap milestones, SourceDocument/DocumentRevision/SourceSpan/AttachmentLink. Course category is a metadata label; dedicated taxonomy CRUD is not included.
- Course draft aggregate CRUD/reorder with stable UUIDs, explicit deletion acknowledgments, unique slug, validated roadmap references and server CAS/If-Match. Missing428, stale412; version/audit/source-link writes are transactional. Archive retains history and removes learner access. Roadmap create/edit/reorder/delete and working source attach/detach are implemented.
- Independent reviewer publishes metadata; self-review is forbidden even for admin. Snapshot copies metadata and learner-readable revision pins. Later draft/source/link changes preserve older snapshots. This is metadata publication, not the lecture package flow of S04.
- Private signed upload to temporary staging; bounded actual-byte size, UTF8/MIME signature and SHA-256 checks before verified immutable copy. Reusing the browser upload ticket cannot overwrite the original. Downloads are signed60seconds and delivered as attachment/octet-stream; JSON never exposes storage keys.
- Durable DB outbox extraction with atomic lease/claim/commit and restart reclamation, bounded retry and manual failed-job retry. Parsing runs in a separate worker isolate with15second deadline and heap caps. PDF text/DOCX/MD/TXT supported; scan/image-only PDF needs_ocr; malformed input does not become ready. DOCX archive expansion/entity limits and paragraph citations preserve real source provenance.
- DB triggers protect published snapshots, original revision metadata, completed extraction and spans. Physical source/history deletion is blocked with409 pending retention policy; replacement creates a new revision. Published references remain readable when a working attachment is detached.
- CMS URL-addressable course editor, autosave statuses, local buffer preservation/export on412, navigation blocker, course metadata/chapter/lesson editing/reorder/delete, source upload/revision/extraction/view/download/attach/detach, and roadmap workspace. Existing shadcn primitives reused; Textarea added through pinned registry CLI with local cn/light adaptations.
- Web published catalog and assigned course structure, objective/document reader with original revision/hash and real citation anchors. Server read adapters and generated browser download client enforce the public audience; backend checks assignment, publication and source visibility again.
- VI/EN, mobile390px, keyboard labels, OS-dark/light-only behavior, scoped query state and errors. Content module is enabled by the S02 migration; an explicitly disabled installation is preserved and APIs fail closed.
- Producer OpenAPI0.2.0 regenerated and consumed by CMS/Web. Contract manifests derive version from spec. Both audiences are closed over their schemas; public output excludes authoring/internal source DTOs.56Bruno templates cover documented operation names; these templates were not manually executed as a collection.

## Data migration boundary

Migration creates a **NOT VALID** FK on existing `course_assignment.courseId`. PostgreSQL immediately enforces the FK for new/updated assignments; API grant also checks a real, unarchived course. Pre-domain orphan assignments are preserved, without deleting unknown records or creating fake course rows. An operator must reconcile them and run VALIDATE before claiming historical integrity. All three new migrations were applied only to the local development database.

## Acceptance evidence

| AC | Evidence |
|---|---|
|AC-007-01|HTTP creates/reads ordered course/chapter/lesson and roadmap references; browser creates course/lesson, autosaves, reviewer publishes and learner navigates published metadata. SQL-index fixtures also validate schema/projections beyond the NestJS topic.|
|AC-007-02|HTTP duplicate slug409; missing/duplicate tree IDs400; foreign aggregate ID adoption400; version and tree unchanged after rejected write.|
|AC-007-03|Two concurrent HTTP writes produce200/412. Two real browser pages prove stale editor keeps its local title, offers draft export and blocks navigation until an explicit choice.|
|AC-008-01|Browser uploads Markdown through private MinIO ticket, polls actual extraction, selects learner-readable link and reviewer publishes; HTTP validates immutable hashes/version and source download.|
|AC-008-02|HTTP hash mismatch quarantined, unsupported MIME/oversize ticket rejected, foreign editor direct source revision404; learner requires active assignment and exact publication pin. Text parser rejects forged PDF/binary/invalidUTF8.|
|AC-008-03|New revision preserves original; overwrite of still-valid staging URL leaves original bytes unchanged; DB rejects revision/publication mutation. Physical delete409; browser and HTTP detach working link while published learner source remains available.|
|AC-009-01|Actual isolate tests use PDF text with page1/2, text/Markdown source spans and DOCX paragraph citations with page=null; reader displays those anchors.|
|AC-009-02|Actual isolate returns needs_ocr for image-only PDF and rejects101pages; DOCX fixture rejects zip expansion; invalid/empty/oversized extracted text rejected. Forced wall-timeout/OOM and live crash-recovery drills were not executed.|
|AC-009-03|Repeated finalize creates one outbox key; repeated completed dispatch leaves exactly two source spans and no duplicate revision. DOCX never invents pages.|

## Local checks

| Gate | Result |
|---|---|
|Backend quality + build|Pass;66tests =41HTTP integration (21foundation +20content) and25unit/parser; OpenAPI reproducibility/audience closure and56operation Bruno coverage pass.|
|CMS quality + build|Pass;38unit tests,4architecture/rule tests, brand/i18n and generated-client drift gates.8existing browser UX/guard tests pass.|
|Web quality + build|Pass;41unit tests,4architecture/rule tests, brand/i18n and generated-client drift gates.7browser regressions pass;3existing live-auth/email flows explicitly skipped for this S02 qualification.|
|S02 browser full stack|2tests pass against API3310/CMS5174/Web3002: author→upload→extract→attach→independent reviewer→detach draft→student still reads/downloads published pin; stale autosave/export/navigation. VI/EN/reload/mobile/light checks included. Actor sessions are local fixtures; this does not replace full-stack login/MFA qualification.|
|Visual QA|Desktop CMS,390px CMS and390px learner screenshots opened and inspected. Stored under Web `.local/screenshots/s02-*.png`; artifacts remain local/ignored.|
|Git hygiene|`git diff --check` clean across implementation repos; no commit/push/deploy.|

Coverage counts all application code except generated/test/declaration files. Backend lines **82.31%**, branches63.24%; CMS lines **26.39%**; Web lines **16.44%**. Frontend new screen orchestration is principally browser-verified, not covered by unit tests. Existing critical transport thresholds remain enforced and pass. Parser worker child-isolate execution is tested but not merged into the parent Jest coverage map. No exclusions or lower thresholds were added to inflate coverage.

A repeated foundation run initially exhausted the shared localhost registration limiter; fixtures now use a unique reserved-range forwarded IP per run. Production limits and existing Redis/session data were not weakened or flushed. A browser attempt against a still-running pre-rebuild Next process failed hydration; restarting the isolated process against the final standalone build resolved it, and both browser suites then passed.

## Remaining boundaries

- Human content/permission UX acceptance and pilot source-rights/confidentiality/retention decisions remain pending. Default access/limits above are approved; this does not authorize sending sources to AI or ingesting real private documents.
- Lists currently return at most100records. Large-corpus search/cursor pagination, storage lifecycle cleanup for abandoned staging, forced timeout/OOM/crash drills and load/security qualification remain before production-scale adoption. Originals stay private and retained until policy is defined.
- Off-host restore, production cutover, real Google OAuth and all AI/lecture/classroom capabilities are not claimed by this S02 report. No remote CI or Docker image qualification was run for this revision; local builds and actual local dependency/browser checks are the evidence.
- No40-lesson migration, published lecture renderer, teaching-plan generation or learner mastery/progress was introduced. Those belong to later sprints.

## Reproduce

Use Node24 and pnpm11.23.0. With the existing local compose services running:

```sh
ARC_CONTENT_TEST=1 node scripts/setup-content-qualification.mjs
node scripts/run-local-qualification.mjs prisma:deploy
pnpm quality:local
pnpm build
ARC_CONTENT_TEST=1 node scripts/run-local-qualification.mjs content:fixtures
```

The fixture file and environment are private under backend `.local/`. `parser:build` is part of test scripts so a fresh checkout does not depend on an old dist worker. CMS/Web: `pnpm quality:check && pnpm build`; CMS browser: `pnpm test:e2e`. For S02 live qualification start the API with the private environment and APP_ORIGIN3002/CMS_ORIGIN5174, CMS with `VITE_API_PROXY_TARGET=http://localhost:3310` on5174, and build/start Web with `API_INTERNAL_URL=http://localhost:3310`, `CMS_INTERNAL_URL=http://localhost:5174`, PORT3002. Then run in Web:

```sh
ARC_CONTENT_TEST=1 pnpm exec playwright test --config playwright.content.config.ts
```

Signed uploads require the storage endpoint to be browser-reachable and storage CORS to allow the CMS origin. This was exercised with local MinIO; production origins/storage policy require deployment qualification.

Implementation references: [execution contract](../phases/P02-content/sprints/S02-course-documents/specs.md), [approval](../baseline/06-DECISIONS-APPROVAL.md). Parser/storage references consulted: [PDF.js](https://github.com/mozilla/pdf.js), [fflate](https://github.com/101arrowz/fflate), [S3 presigned upload semantics](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html).
