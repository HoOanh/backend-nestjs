# US-010 — Giáo án có cấu trúc

**4 PASS / 0 FAIL / 0 NOT_EXECUTED**, 10 ảnh thực tế, 15.8 giây.

[Gallery](index.html) · [Test cases](test-cases.csv) · [Machine results](test-results.json)

## Phạm vi

US-010 / AC-010-01..03. Browser Chromium desktop1440×1000, mobile390×844, OS dark/ứng dụng light-only; fixture tài khoản/nội dung local, đăng nhập password + TOTP thật. API3310/CMS5174/Web3002 và PostgreSQL, Redis, MinIO thật. Web production build; CMS Vite. Không response mocks, không inject sessions.

Working implementation chưa commit; SHA trong JSON là commit nền S02. `evidence-manifest.json` ghi hash mã nguồn và evidence, tránh hiểu SHA nền là code mới đã merge.

| Case | AC | Kết quả | Ảnh |
|---|---|---|---|
|PLAN01|AC-010-01|PASS|[1](images/PLAN01-editor-desktop.png) [2](images/PLAN01-editor-mobile.png)|
|PLAN02|AC-010-01|PASS|[1](images/PLAN02-web-preview-desktop.png) [2](images/PLAN02-web-preview-mobile.png) [3](images/PLAN02-web-preview-english.png) [4](images/PLAN02-student-denied.png)|
|PLAN03|AC-010-02|PASS|[1](images/PLAN03-lint-objective-missing.png) [2](images/PLAN03-reviewer-readonly.png)|
|PLAN04|AC-010-03|PASS|[1](images/PLAN04-offline.png) [2](images/PLAN04-conflict-buffer.png)|

## Kiểm chứng bổ sung

Backend quality: 74 tests PASS (gồm 46 HTTP/integration), coverage statements82.77%/branches64.19%/functions78.94%/lines84.63%. Kiểm nguồn ngoài scope/sai hash, revision/source-link append-only, audit rollback, lesson_changed/source_unavailable, delete lesson409, schema checkpoint sai, reviewer403, stale412. OpenAPI public/internal/preview schema closure và drift PASS; Bruno61 request templates (không coi collection manual đã chạy).

CMS/Web quality gates và builds PASS; browser editor/preview là bằng chứng flow mới, không suy luận unit coverage toàn frontend cao. CMS unit38 tests; Web unit43 tests. Các số này không phải phần trăm coverage.

Đã xem trực tiếp ảnh editor mobile, preview desktop, conflict; toàn bộ screenshot là Playwright thực. Bản editor cho thấy đáp án fixture vì staff có quyền; HTML/API preview không có answerKey hoặc explanation đáp án. Không ghi password, TOTP, recovery codes, cookies hoặc HAR/trace.

Browser phát hiện source picker ban đầu dùng document list summary không có spans; đã sửa sang extraction endpoint của ready revisions gắn vào lesson và chạy lại. Harness cũng khôi phục locale VI sau preview EN vì Web/CMS chia sẻ preference cookie; không thay ứng dụng để vô hiệu hoá preference.

## Giới hạn

US-011 AI jobs/quota/provider và US-012 human findings/approve/reject chưa triển khai trong lát cắt này. Chưa có publish giáo án, đồ hoạ render hay AI sinh bài; visualIntent hiện là bản mô tả cho bước đồ hoạ sau. Chưa production/deploy, physical mobile, WebKit/Firefox, load/crash/OOM. Human content/UAT sign-off chưa thực hiện.

## Chạy lại

Từ backend: tạo actor mới bằng script acceptance-browser-fixture đã guard loopback/test, môi trường `.local/s02.env`. Start API với PORT3310/APP_ORIGIN3002/CMS_ORIGIN5174, CMS VITE_API_PROXY_TARGET3310/VITE_WEB_ORIGIN3002, Web API_INTERNAL_URL3310/CMS_INTERNAL_URL5174. Không dùng `.env` remote.

Từ Web: `ARC_ACCEPTANCE_TEST=1 pnpm exec playwright test --config playwright.teaching-plans.config.ts`, rồi `node scripts/build-plan-acceptance-report.mjs`. Phải tạo actor mới trước mỗi run vì MFA enroll thật.
