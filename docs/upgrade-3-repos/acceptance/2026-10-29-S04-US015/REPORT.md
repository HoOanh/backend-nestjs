# US-015 — Lecture package/publish (backend slice)

Ngày30/10/2026. Phạm vi: backend LecturePackage, approve/publish transaction, public projection, preview exchange one-time code, outbox event. Chưa có CMS publish UI và Web learner render package.

## Evidence

- [backend-quality.log](backend-quality.log): 128 tests/21 suites; statements85.14%, branches66.46%, functions83.48%, lines87.76%; OpenAPI public23/internal70 paths,105 Bruno templates, reproducible.
- [cms-quality.log](cms-quality.log), [web-quality.log](web-quality.log): codegen sync + quality pass (CMS70 unit, Web45 unit); chưa có publish UI/learner page.
- Test: `test/lectures.e2e-spec.ts` (3): approve độc lập, publish idempotent + outbox, stale sau khi plan/visual đổi, public snapshot không answer key/private, preview exchange one-time/expired, draft không exchange.

## Hành vi

- Package pins plan/visual/document revisions + hashes; chỉ tạo khi plan có approval hợp lệ.
- Approve bắt buộc reviewer độc lập + đúng packageHash; publish chỉ package approved, creator không tự publish; publish lặp cùng package trả cùng publication, không tạo outbox trùng.
- Public `GET /p/v1/lessons/{id}/lecture-package` chỉ trả publication snapshot; không answer key/private text.
- Preview exchange: staff tạo code one-time 10 phút; redeem public một lần; hết hạn/đã dùng/draft →404.
- Outbox event `lecture.published` trong transaction; **worker cache invalidation chưa nối** (AC-015-03 mới test idempotent publish, chưa test retry worker).

## Giới hạn

- CMS chưa có màn publish/review package; Web chưa render package đã publish cho learner.
- AC-015-01/02 mới verified ở backend HTTP/Postgres; AC-015-03 partial (idempotent, chưa có worker retry).
- Chưa commit/push? (sẽ commit cùng lượt).
