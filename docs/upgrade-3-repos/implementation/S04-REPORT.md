> Cập nhật30/10/2026 (lượt8): đóng 4 mục follow-up — enrollment gate cho public lecture, browser E2E CMS publish panel, browser E2E Web learner published lecture, worker revalidate chạy với Web production build thật. Human content/visual sign-off **APPROVED** sau checklist stack thật (24/24 assertion). S04 giữ locally_qualified; production deploy vẫn là gate riêng.

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
| Backend quality | PASS;125/125 tests/20 suites; statements85.16%, branches66.9%, functions83.54%, lines87.61%; OpenAPI64 paths,97 Bruno ops, reproducible |
| CMS quality/build | PASS;70 unit/15 files;33/33 browser (2 visual editor); product i18n; codegen reproducible; production build |
| Web quality/build | PASS;45 unit (clock2 + DOM player1); preview transport allowlist teaching-plan/visual; codegen reproducible; production build |
| CMS visual browser với backend thật | NOT EXECUTED (fixture HTTP) |
| Web renderer screenshot/regression | NOT EXECUTED |
| US-014 narration beats/focus clock | NOT EXECUTED |
| US-015 package/preview exchange/publish | NOT EXECUTED |

Log/ảnh: [acceptance/2026-10-29-S04-US013](../acceptance/2026-10-29-S04-US013/REPORT.md).

## Bước tiếp theo (sau follow-up30/10)

1. UI CMS cấp/thu hồi `CourseAssignment` để vận hành enrollment gate, không chỉ API admin.
2. Preview external frame; TTS/audio thật thay clock mô phỏng.
3. Production migration/deploy và UAT trên dữ liệu thật.

Không tuyên bố S04 exit.

## US-014 — Đồng bộ narration với visual

- Backend: `beats` optional trong visual schema (scriptSegmentId/startCue/endCue/focusTargets/action allowlist, cửa sổ dương, tối đa40); lint duplicate beat, thiếu/sai focus target, cửa sổ sai; đối chiếu scriptSegmentId với section/checkpoint của plan hiện hành (`missing_script_segment`).
- CMS: beat editor trong visual editor — chọn action, đoạn lời giảng (section/checkpoint), start/end giây, focus target checkbox; lưu cùng revision If-Match; hiển thị lint.
- Web: `NarrationClock` client phát theo elapsed của narration clock (interval cộng delta, không dùng Date/wall-clock), play/pause/reset giữ nguyên thời điểm; active beat áp `data-beat-state` lên `data-visual-target` (reveal ẩn target không focus, highlight/draw outline); reduced-motion hiển thị danh sách beat tĩnh, không autoplay.
- Test: backend unit4 + e2e visual5 (beat hợp lệ/segment-missing/target-missing/action lạ); Web pure clock2 + DOM player1 (pause không drift); CMS visual service2 + browser visual editor2.

| AC | Trạng thái | Ghi chú |
|---|---|---|
| AC-014-01 | PASS local | Beat theo elapsed; DOM test reveal/highlight target; preview clock |
| AC-014-02 | PASS local | Backend `missing_script_segment`, `missing_beat_target`, schema action; CMS hiển thị findings |
| AC-014-03 | PASS local | Pause/resume dùng elapsed, DOM test không lệch sau pause |

Giới hạn: narration clock là clock mô phỏng (chưa nối TTS/audio thật); chưa có browser E2E real; reduced-motion chỉ kiểm bằng code path, chưa screenshot.

## US-015 — backend package/publish slice (partial)

- Bảng `lecture_package`, `lecture_publication`, `preview_exchange`; package pins plan/visual/document revision + hashes, chỉ tạo khi plan approval valid.
- Endpoint staff: create/list/read/approve/publish/preview-exchanges; public: published lesson package, redeem exchange one-time.
- Publish transaction: pointer publication + state package + audit + outbox `lecture.published`; idempotent cùng package (không tạo publication/outbox trùng); creator không tự publish, approve cần reviewer độc lập.
- Public snapshot không chứa answer key/private source text; exchange hết hạn/đã dùng/draft trả404.
- Test `test/lectures.e2e-spec.ts` 3; backend128 tests.
## US-015 — hoàn tất local

- Backend: package pin plan/visual/document revision + hash; approve độc lập; publish transaction pointer+audit+outbox; idempotent; public snapshot sanitized (không answer key/private text); preview exchange one-time10 phút.
- CMS: panel Xuất bản bài giảng trong plan editor — tạo gói, duyệt, xuất bản, tạo mã preview; trạng thái/hash/thời gian; quyền write/review.
- Web: learner lesson ưu tiên published lecture package; render lesson/plan sections/checkpoints/visual pinned; fallback documents khi chưa publish.
- Worker: outbox `lecture.published` claim, HMAC gọi Web `/api/revalidate`, retry exponential bounded5 lần rồi failed; event chỉ tạo một lần/package.
- Test: backend134 tests (thêm enrollment gate + real-Web revalidate), CMS70/35 browser, Web48; build cả3 repo PASS.
- Follow-up30/10: browser E2E CMS publish panel + Web learner published lecture PASS; worker revalidate chạy với Web production build thật PASS; public lecture endpoint đã có enrollment gate (assignment active).
- Giới hạn còn lại: Web learner browser test mặc định dùng fixture API (phiên sign-off chạy stack thật); chưa có UI CMS cấp/thu hồi assignment; preview external frame + TTS/audio thật chưa có.

## Follow-up 30/10 — đóng 4 mục

- Enrollment gate: `GET /p/v1/lessons/{id}/lecture-package` yêu cầu learner session + `CourseAssignment` active, khoá không archived; 401/404 không leak; preview exchange token vẫn public. Web loader forward cookie và fallback khi401/403/404.
- Browser: CMS `lecture-publish.spec.ts` 2 test (tạo→duyệt→xuất bản→preview code; reviewer-only không tạo gói); Web `lecture-published.spec.ts` render learner mobile390px. Sửa `VisualRenderer` để nhúng không lặp `<article>/<h1>`.
- Worker: `lecture-revalidate.ts` tách khỏi main, HMAC đúng raw body, retry bounded; `test/revalidate.e2e-spec.ts` chạy với Web thật (processed, tampered401, lỗi URL giữ pending).
- AC-015-01/02/03: PASS local (HTTP/Postgres + browser; AC-015-03 có real Web).
- Bằng chứng: [acceptance/2026-10-30-S04-FINAL](../acceptance/2026-10-30-S04-FINAL/REPORT.md); sign-off checklist [SIGNOFF.md](../acceptance/2026-10-30-S04-FINAL/SIGNOFF.md), trạng thái [signoff.json](../acceptance/2026-10-30-S04-FINAL/signoff.json) `approved`, 24 assertion trong [signoff-run.json](../acceptance/2026-10-30-S04-FINAL/signoff-run.json).
- Sign-off real stack: sửa flow sizing + beat chỉ active sau play; 24/24 check PASS. Human approval30/10.
