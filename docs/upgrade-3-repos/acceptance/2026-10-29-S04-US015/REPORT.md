# US-015 — Lecture package/publish (backend slice)

Ngày30/10/2026. Phạm vi: backend LecturePackage, approve/publish transaction, public projection, preview exchange one-time code, outbox event. Chưa có CMS publish UI và Web learner render package.

## Evidence

- [backend-quality.log](backend-quality.log): 128 tests/21 suites; statements85.14%, branches66.46%, functions83.48%, lines87.76%; OpenAPI public23/internal70 paths,105 Bruno templates, reproducible.
- [cms-quality.log](cms-quality.log): CMS70 unit +33 browser, build PASS; publish panel trong plan editor.
- [web-quality.log](web-quality.log): Web45 unit, build PASS; learner page render package đã publish.
- Worker: `lecture-outbox.spec.ts` backoff bounded (2 test); chưa chạy worker với Web thật.
- Test: `test/lectures.e2e-spec.ts` (3): approve độc lập, publish idempotent + outbox, stale sau khi plan/visual đổi, public snapshot không answer key/private, preview exchange one-time/expired, draft không exchange.

## Hành vi

- Package pins plan/visual/document revisions + hashes; chỉ tạo khi plan có approval hợp lệ.
- Approve bắt buộc reviewer độc lập + đúng packageHash; publish chỉ package approved, creator không tự publish; publish lặp cùng package trả cùng publication, không tạo outbox trùng.
- Public `GET /p/v1/lessons/{id}/lecture-package` chỉ trả publication snapshot; không answer key/private text.
- Preview exchange: staff tạo code one-time 10 phút; redeem public một lần; hết hạn/đã dùng/draft →404.
- Outbox event `lecture.published` trong transaction; **worker cache invalidation chưa nối** (AC-015-03 mới test idempotent publish, chưa test retry worker).

## Giới hạn

- CMS: panel tạo/duyệt/xuất bản gói + tạo mã preview trong plan editor (theo quyền).
- Web: learner lesson đọc public published package, render objectives/sections/checkpoints/visual; private source text không nằm trong snapshot.
- Worker: claim outbox `lecture.published`, gọi Web revalidate có HMAC, retry backoff bounded5 lần rồi failed; publish lặp không tạo event trùng.
- AC-015-01/02 PASS local (HTTP/Postgres + Web build); AC-015-03 PASS local unit/idempotent, **chưa chạy worker end-to-end với Web thật**. Chưa có browser E2E cho learner published page và CMS panel.

## Follow-up30/10 — superseded

Báo cáo này giữ nguyên lát cắt backend ban đầu. Các giới hạn "chưa browser E2E/chưa worker với Web thật" đã được đóng và có bằng chứng mới tại [acceptance/2026-10-30-S04-FINAL/REPORT.md](../2026-10-30-S04-FINAL/REPORT.md). Human sign-off đã `approved` ngày30/10/2026.
