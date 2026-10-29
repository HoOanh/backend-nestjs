> Cập nhật29/10/2026 (lượt2): S04 mở theo chỉ đạo “push rồi mở next step”. US-013 đã có backend typed visual revision, CMS visual editor và Web renderer/preview cho8 kind. AC-013-03 vẫn partial vì lecture package/pinned render thuộc US-015. US-014/US-015 chưa triển khai; S04 chưa đóng.

# S04 — Bài giảng đồ hoạ, preview và xuất bản

Sprint mở ngày29/10/2026. Effort gốc14–22 person-days; hiện xong lát cắt US-013, chưa phải toàn sprint.

## Execution contract US-013 (đã triển khai)

- `VisualRevision` immutable: schemaVersion/rendererVersion/kind/contentHash/payload JSONB/author/createdAt. `visual` giữ version hiện hành; PATCH If-Match append revision, stale412, không last-writer-wins.
- `schemaVersion=1`, `rendererVersion=arc-visual-1` do server pin; client không gửi/không đổi.
- 8 kind: text-slide, image-annotation, flow, comparison, decision-tree, timeline, worked-example, whiteboard-storyboard. Discriminated union `.strict()`: semanticTitle/description/altText/sourceRefs/focusOrder/layout + payload typed.
- Không nhận arbitrary JSON/HTML/JS: unknown key bị từ chối; text chứa `<script>/<svg>/<iframe>/javascript:/data:text/html/on*=` bị từ chối400. Backend không execute; Web renderer dùng React text nodes, không `dangerouslySetInnerHTML`.
- Lint: duplicate id, dangling edge/root/focus, unknown/missing comparison cell, empty slide, missing alt/title, source_unavailable (attached/ready/hash khớp).
- Quyền đọc `content:lesson:read` + ownership/reviewer; ghi `visuals:write` + ownership; reviewer read-only; audit `visual.create|save`.
- Endpoint: `GET/POST /i/v1/lessons/{id}/visual`; `GET/PATCH /i/v1/visuals/{id}`; `POST /i/v1/visuals/{id}/lint`; `GET /i/v1/visuals/{id}/preview` (staff read model cho Web).
- CMS: visual editor typed theo8 kind, autosave If-Match, source picker, lint findings, preview link, mobile390px; không dựng renderer thứ hai ở CMS.
- Web: renderer shared8 kind (text/table/SVG timeline/flow/storyboard), preview route server-only `/preview/visuals/{id}`, transport chỉ cho teaching-plan/visual preview, noindex, staff-only; text/reduced-motion fallback tĩnh.

## AC status

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-013-01 | PASS local | Backend validate + CMS editor typed + browser autosave payload |
| AC-013-02 | PASS local | Lưu/lint từ chối script/SVG/kind lạ; renderer không execute nội dung |
| AC-013-03 | Partial | Revision immutable + rendererVersion pin; package pinned cũ chưa có (US-015) |

## Gates

| Gate | Kết quả |
|---|---|
| Backend quality | PASS;123/123 tests/20 suites; statements85.17%, branches66.94%, functions83.49%, lines87.53%; OpenAPI64 paths,97 Bruno ops, reproducible |
| CMS quality/build | PASS;70 unit/15 files;33/33 browser (2 visual editor); product844 messages; codegen reproducible; production build |
| Web quality/build | PASS;42 unit; preview transport allowlist teaching-plan/visual; codegen reproducible; production build |
| CMS visual browser với backend thật | NOT EXECUTED (fixture HTTP) |
| Web renderer screenshot/regression | NOT EXECUTED |
| US-014 narration beats/focus clock | NOT EXECUTED |
| US-015 package/preview exchange/publish | NOT EXECUTED |

Log/ảnh: [acceptance/2026-10-29-S04-US013](../acceptance/2026-10-29-S04-US013/REPORT.md).

## Bước tiếp theo

1. US-014: narration beat IDs, focus/reveal/draw/highlight theo narration clock, pause/resume không lệch wall time, lint missing target.
2. US-015: LecturePackage pin lesson/plan/visual/source/renderer, preview exchange one-time code, publish pointer + audit/outbox, cache invalidation retry, public projection không private source.
3. Browser thật cho visual editor + Web renderer (ảnh, reduced-motion, alt).

Không tuyên bố S04 exit.
