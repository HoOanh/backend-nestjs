# SPEC-02 — Bài giảng có đồ hoạ

DRAFT 0.2 · S04/S05/S07/S11.

## 1. Visual schema

VisualRevision có schemaVersion/rendererVersion/id/kind/semanticTitle/description/altText/layout/mediaRefs/sourceRefs/beats. Initial kinds: text-slide, image-annotation, flow, comparison, decision-tree, timeline, worked-example, whiteboard-storyboard. Dùng renderer MVP tương thích khi port; từng kind có payload validated, không JSON tuỳ ý hoặc source JS executable. Advanced3D preset editing nằm S07, không cho upload component/chạy code từ CMS.

NarrationBeat: beatId/scriptSegmentId/visualRef/startCue/endCue/focusTargets/action; action allowlist reveal/highlight/draw/pointer/clear. Timeline gắn narration clock, không dùng wall-clock timeout độc lập. Beat identity ổn định để resume/replay khi TTS chunks dài/ngắn hoặc user ngắt lời. Layout có focus order/responsive bounds; chỉ định semantic relations trước màu sắc/trang trí.

AI image artifact chứa promptVersion/model/source/review/rights metadata, không tự là diagram kỹ thuật đúng. Diagram kỹ thuật cần label/node/edge có nghĩa và reviewer kiểm tra, không thay bằng ảnh có chữ lỗi. Ảnh có alt, width/height, caption và reference usage.

## 2. Editor và preview

CMS slide/visual editor chọn kind, nhập semantic payload, attach media, thiết lập beats/focus/order; thao tác undo/redo và draft autosave/If-Match. S04 hỗ trợ chỉnh cấu hình cơ bản và preview; S07 timeline scrub/visual presets/refined authoring studio.

POST I/lessons/{id}/visual-revisions; PATCH I/visual-revisions/{id} với If-Match; POST validate; POST I/ai/image-jobs→artifact draft; POST I/visual-artifacts/{id}/apply. CMS chỉ dùng API metadata, renderer Web sở hữu code. POST I/previews/exchanges→one-time code scoped revision; Web preview exchange cookie no-store/noindex. Browser hỗ trợ preview external frame policy đúng origin CMS.

## 3. Review/publish

LecturePackage pin lessonRevisionId/planRevisionId/visualRevisionIds/documentRevisionIds/checkpointPolicyVersion/rendererSchemaVersion/hash. Workflow draft→in_review→approved→published; reviewer không tự duyệt bản của mình mặc định. Lint errors chặn: dangling visual/source ref, missing alt/narration mapping, unsupported kind/version, invalid focus target, leaked quiz keys, asset chưa ready. Warnings cần reviewer disposition. AI review chỉ hỗ trợ, không thay lint/human authority.

Publish transaction đổi pointer + review/audit/outbox. Web cache invalidate retry bounded/TTL fallback; room version mới explicit bind package mới. Session đang học không đổi. Rollback publication trỏ package trước còn hợp lệ, không mutate snapshot.

## 4. Nghiệm thu

Editor preview cùng package phải ra cùng slide/labels/narration trong Web; stale ETag412; unsupported visual kind báo lỗi; raise-hand dừng/resume narration không lệch focus; reduced-motion/text fallback vẫn thấy semantic content; screenshot regression chỉ cho fixture ổn định và tolerances đã review, không coi pixel equality là kiến thức đúng.
