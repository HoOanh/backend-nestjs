# S02 — Kết quả nghiệm thu 29/10/2026

**10 PASS / 0 FAIL / 0 chưa chạy**. Đây là kiểm chứng kỹ thuật local; human sign-off **chưa thực hiện**.

[Mở gallery ảnh và test case](index.html) · [CSV đầy đủ](test-cases.csv) · [Kết quả máy đọc](test-results.json)

## Môi trường và phạm vi

Browser Chromium qua Playwright, desktop1440×1000/mobile390×844/tablet820×1180, OS dark nhưng ứng dụng light-only. Real UI login; password + TOTP MFA; no session-cookie injection; no HTTP response mocks. Postgres/Redis/MinIO và worker extraction thật. Data/tài khoản là fixture local, không phải dữ liệu production.

Revisions: arc-academy-backend: 329f175; arc-academy-cms: 3ea928f; arc-academy-web: 2a4d378. Mã sửa UX và harness tại thời điểm chạy có working changes; SHA là commit nền, không suy luận working tree sạch từ SHA.

## Kết quả theo case

| Case | Nội dung | AC | Kết quả | Ảnh |
|---|---|---|---|---|
|TC01|Đăng nhập thật và thư viện trống|Foundation auth, AC-007-01|PASS|[1](images/TC01-login-invalid-password.png) [2](images/TC01-mfa-rejected-secret-masked.png) [3](images/TC01-cms-empty-desktop.png) [4](images/TC01-cms-empty-mobile.png) [5](images/TC01-learner-empty-desktop.png)|
|TC02|Cây khoá học, autosave và reorder|AC-007-01, AC-007-02|PASS|[1](images/TC02-course-tree-desktop.png) [2](images/TC02-course-tree-mobile.png)|
|TC03|Upload MD/TXT/PDF/DOCX và truy nguồn|AC-008-01, AC-009-01, AC-009-03|PASS|[1](images/TC03-md-source.png) [2](images/TC03-txt-source.png) [3](images/TC03-pdf-source.png) [4](images/TC03-docx-source.png) [5](images/TC03-library-desktop.png) [6](images/TC03-library-mobile.png)|
|TC04|Tệp không hợp lệ và trạng thái extraction lỗi|AC-008-02, AC-009-02|PASS|[1](images/TC04-unsupported-file.png) [2](images/TC04-oversized-file.png) [3](images/TC04-quarantined-forged-mime.png) [4](images/TC04-upload-rejected-english-mobile.png) [5](images/TC04-needs-ocr.png) [6](images/TC04-pdf-page-limit.png) [7](images/TC04-docx-expansion-rejected.png)|
|TC05|Scope và reviewer độc lập|AC-007-01, AC-008-01, AC-008-02|PASS|[1](images/TC05-foreign-editor-denied.png) [2](images/TC05-role-guard.png) [3](images/TC05-reviewer-readonly-desktop.png) [4](images/TC05-published-by-reviewer.png) [5](images/TC05-published-catalog-desktop.png)|
|TC06|Học viên đọc và tải đúng nguồn đã duyệt|AC-008-01, AC-008-02, AC-009-01|PASS|[1](images/TC06-learner-course-desktop.png) [2](images/TC06-learner-source-desktop.png) [3](images/TC06-learner-source-mobile.png) [4](images/TC06-learner-source-tablet.png) [5](images/TC06-learner-source-english.png)|
|TC07|Revision mới không phá snapshot đã xuất bản|AC-008-03, AC-009-03|PASS|[1](images/TC07-source-revision-two-draft.png) [2](images/TC07-published-source-still-revision-one.png)|
|TC08|Lộ trình CRUD và thứ tự milestone|AC-007-01, AC-007-02|PASS|[1](images/TC08-roadmap-desktop.png) [2](images/TC08-roadmap-mobile.png)|
|TC09|Offline, reconnect, conflict và export draft|AC-007-03|PASS|[1](images/TC09-offline-draft.png) [2](images/TC09-conflict-preserves-draft.png) [3](images/TC09-unsaved-navigation-blocker.png)|
|TC10|Thu hồi quyền có hiệu lực|AC-008-02|PASS|[1](images/TC10-assignment-revoked.png)|

## Kết luận và giới hạn

JavaScript pageerror quan sát được: 0. Mỗi case kiểm tra trạng thái UI cùng dữ liệu/API hoặc original file bytes khi phù hợp; không dùng ảnh để thay assertion dữ liệu.

Credentials local và TOTP/recovery material không đưa vào hồ sơ; không ghi HAR/trace. Fixture dùng forwarded IP thuộc dải benchmark dành riêng từng actor để tách counters localhost; không sửa production limiter hoặc bỏ MFA.

Chưa kiểm production/deployed edge, Google OAuth thật, email delivery của flow đăng ký/reset, mobile thiết bị vật lý, WebKit/Firefox, forced wall-timeout/OOM/crash recovery và load/performance. Các mục này là NOT_EXECUTED, không suy luận PASS từ các case trên. Không tự ký nghiệm thu nội dung thay ĐẠI CA.

## Điểm UX đã kiểm lại

**UX-01 / P2 — FIXED:** CMS phân biệt validation rejection với lỗi mạng, đóng viewer nguồn cũ khi upload và ghi rõ tên/revision đang đọc. TC04 kiểm lại thông báo VI/EN ở mobile, source viewer cũ không còn hiển thị. [Chi tiết tái hiện và điều kiện đóng](FINDINGS.md), [ảnh bằng chứng](images/TC04-quarantined-forged-mime.png). Các case PASS ở trên là functional assertions; chưa phải UAT được ký duyệt.

## Quan sát HTTP not-found

Case thu hồi quyền ban đầu kỳ vọng HTML404. Probe xác nhận API404, UI not-found không có nguồn, robots noindex; HTTP HTML200 vì response đã streaming. Test cuối kiểm đủ bốn dấu hiệu này, không coi HTTP200 riêng lẻ là được cấp quyền. Hành vi phù hợp [Next.js not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found). Không sửa application để ép assertion xanh.

## Chạy lại

Chuẩn bị local services API3310/CMS5174/Web3002 với cùng private `.local/s02.env`; không dùng `.env` remote. Backend:

```sh
ARC_CONTENT_TEST=1 node --env-file=.local/s02.env node_modules/typescript/bin/tsc -p tsconfig.tools.json
ARC_CONTENT_TEST=1 node --env-file=.local/s02.env .local/tools/scripts/acceptance-browser-fixture.js
node .local/tools/scripts/acceptance-document-fixtures.js
```

Web:

```sh
ARC_ACCEPTANCE_TEST=1 pnpm exec playwright test --config playwright.acceptance.config.ts
node scripts/build-acceptance-report.mjs
```

Tạo actor fixture mới trước mỗi lần chạy vì staff enroll MFA thật. Suite serial: case phụ thuộc sẽ là NOT_EXECUTED nếu prerequisite thất bại. Gallery/CSV/JSON được sinh từ kết quả lần chạy, không đánh dấu bằng tay.
