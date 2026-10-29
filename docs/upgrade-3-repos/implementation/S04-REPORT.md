> Cập nhật29/10/2026: ĐẠI CA chỉ đạo “push đi nhé rồi mở next step”. US-012 đã push main ở3 repo; S04 được mở. Lát cắt đầu: US-013 backend (typed visual revision + validate). CMS editor/Web renderer, US-014 và US-015 chưa triển khai. Không commit/push phần S04 trong lượt này.

# S04 — Bài giảng đồ hoạ, preview và xuất bản

Sprint mở ngày29/10/2026 theo chỉ đạo trực tiếp của ĐẠI CA, sau khi S03 có US-010/011/012 locally verified và đã push. Effort S04 gốc14–22 person-days; đây mới là lát cắt US-013 backend.

## Execution contract US-013 (lát cắt backend)

- `VisualRevision` immutable: `schemaVersion`, `rendererVersion`, `kind`, `contentHash`, payload JSONB validated, author, createdAt. `visual` giữ version hiện hành; PATCH If-Match append revision, stale412, không last-writer-wins.
- `schemaVersion=1`, `rendererVersion=arc-visual-1` do server pin; client không gửi/không đổi được.
- 8 kind ban đầu: text-slide, image-annotation, flow, comparison, decision-tree, timeline, worked-example, whiteboard-storyboard. Mỗi kind là discriminated union `.strict()`: semanticTitle, description, altText bắt buộc, sourceRefs, focusOrder, layout tuỳ chọn + payload typed (nodes/edges/slides/columns/rows/events/steps/frames/annotations/media).
- Không nhận arbitrary JSON/HTML/JS: unknown key bị từ chối; text chứa `<script`, `<svg`, `<iframe`, `javascript:`, `data:text/html`, handler `on*=` bị từ chối400. Không execute nội dung ở backend.
- Lint semantic: duplicate id, dangling relation (edge from/to), dangling root decision-tree, unknown/missing comparison cell, dangling focus target, missing alt/title, empty slide, source_unavailable (span phải attached/ready/hash khớp).
- Quyền: đọc `content:lesson:read` + ownership/reviewer; ghi `visuals:write` + ownership. Reviewer read-only. Audit `visual.create|save` trong transaction.
- Endpoint: `GET/POST /i/v1/lessons/{id}/visual`, `GET/PATCH /i/v1/visuals/{id}` (If-Match), `POST /i/v1/visuals/{id}/lint`.

## Đã triển khai

- Backend: `prisma/schema/visuals.prisma` + migration `20261029120000_visuals` (trigger immutable revision), module `src/modules/visuals` (schema/lint/service/controller/dto), đăng ký ContentModule. Migration mới chỉ chạy local `localhost:55433`.
- Contract: OpenAPI internal63 paths,96 Bruno templates; CMS codegen sync (chưa có UI dùng visual API).
- Test: unit schema/lint3 test; e2e HTTP/Postgres4 test (create/read pinned version, save/If-Match/source validation/immutability/audit, executable+unknown kind+fake source bị chặn không ghi revision, reviewer read-only/ownership/learner deny).

## AC status (không đánh dấu đạt toàn bộ)

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-013-01 | Partial | Backend validate labels/relations/source/alt/rendererVersion; CMS editor chưa có nên chưa chứng minh luồng soạn |
| AC-013-02 | Partial | Lưu/lint từ chối script/SVG/kind lạ; preview/renderer chưa kiểm vì Web chưa làm |
| AC-013-03 | Partial | Revision bất biến + rendererVersion pin; package-pinned render cũ thuộc US-015 chưa có |

## Gates

| Gate | Kết quả |
|---|---|
| Backend prettier/eslint/typecheck/foundation | PASS |
| Backend tests | 123/123, 20 suites; statements85.11%, branches66.98%, functions83.44%, lines87.47% |
| Backend OpenAPI/Bruno | PASS; internal63 paths,96 operations |
| CMS quality/build-after-codegen | PASS;68 unit; generated client reproducible; build không đổi |
| CMS/Web visual UI + renderer | NOT EXECUTED (chưa triển khai) |
| US-014 beats/narration clock | NOT EXECUTED |
| US-015 package/preview/publish | NOT EXECUTED |

Log: [acceptance/2026-10-29-S04-US013](../acceptance/2026-10-29-S04-US013/REPORT.md).

## Bước tiếp theo

1. CMS visual editor cơ bản (kind + typed fields + alt + source + If-Match/autosave), không dựng renderer thứ hai ở CMS.
2. Web renderer shared cho8 kind + preview pinned revision; text/reduced-motion fallback.
3. US-014 narration beats/focus clock; US-015 lecture package/preview exchange/publish outbox.

Không tuyên bố S04 exit; các story US-014/015 còn draft.
