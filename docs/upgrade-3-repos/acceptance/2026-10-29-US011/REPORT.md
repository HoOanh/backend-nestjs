# US-011 — Gemini soạn giáo án

**5 PASS / 0 FAIL / 0 NOT_EXECUTED**, 14 ảnh thực tế, 21.3 giây.

[Gallery](index.html) · [Test cases](test-cases.csv) · [Machine results](test-results.json)

## Phạm vi

US-010 regression + US-011 / AC-011-01..03. Browser Chromium desktop1440×1000, mobile390×844, OS dark/ứng dụng light-only; fixture tài khoản/nội dung local, đăng nhập password + TOTP thật. API3310/CMS5174/Web3002 và PostgreSQL, Redis, MinIO thật. Web production build; CMS Vite. Không response mocks, không inject sessions.

SHA trong JSON là commit nền; code đang làm chưa commit. evidence-manifest.json ghi hash mã nguồn và evidence. Mọi report/evidence chỉ nằm tại nguồn canonical backend-nestjs/docs/upgrade-3-repos.

| Case | AC | Kết quả | Ảnh |
|---|---|---|---|
|PLAN01|AC-010-01|PASS|[1](images/PLAN01-editor-desktop.png) [2](images/PLAN01-editor-mobile.png)|
|PLAN02|AC-010-01|PASS|[1](images/PLAN02-web-preview-desktop.png) [2](images/PLAN02-web-preview-mobile.png) [3](images/PLAN02-web-preview-english.png) [4](images/PLAN02-student-denied.png)|
|PLAN03|AC-010-02|PASS|[1](images/PLAN03-lint-objective-missing.png) [2](images/PLAN03-reviewer-readonly.png)|
|PLAN04|AC-010-03|PASS|[1](images/PLAN04-offline.png) [2](images/PLAN04-conflict-buffer.png)|
|PLAN05|AC-011-01 / AC-011-02 / AC-011-03|PASS|[1](images/PLAN05-gemini-draft-desktop.png) [2](images/PLAN05-gemini-draft-mobile.png) [3](images/PLAN05-gemini-applied.png) [4](images/PLAN05-gemini-web-preview.png)|

## Kiểm chứng bổ sung

Backend quality:86 tests PASS, gồm53 HTTP/integration; statement83.73%, branches65.45%, functions79.80%, lines85.85%. Unit/integration dùng controlled provider, test PLAN05 dùng Gemini thật. Quota/idempotency/claim/timeout/permission/citation/stale-apply/immutable provenance đều có negative assertions. OpenAPI public/internal/preview + generated CMS clients reproducible; Bruno66 operation templates, không coi manual collection đã chạy.

CMS/Web quality gates và builds PASS; browser editor/preview là bằng chứng flow mới, không suy luận unit coverage toàn frontend cao. CMS unit38 tests; Web unit43 tests. Các số này không phải phần trăm coverage.

Đã xem trực tiếp ảnh editor mobile, preview desktop, conflict; toàn bộ screenshot là Playwright thực. Bản editor cho thấy đáp án fixture vì staff có quyền; HTML/API preview không có answerKey hoặc explanation đáp án. Không ghi password, TOTP, recovery codes, cookies hoặc HAR/trace.

Browser phát hiện source picker ban đầu dùng document list summary không có spans; đã sửa sang extraction endpoint của ready revisions gắn vào lesson và chạy lại. Harness cũng khôi phục locale VI sau preview EN vì Web/CMS chia sẻ preference cookie; không thay ứng dụng để vô hiệu hoá preference.

## Gemini thực tế

```json
{
  "jobId": "b75622ae-449b-402d-a224-f79005d5d1c2",
  "model": "gemini-3.5-flash-lite",
  "modelVersion": "gemini-3.5-flash-lite",
  "promptVersion": "arc-plan-authoring-2",
  "inputHash": "53eb44730218116c1f54cd63bb9463d76a1970d36d9e36da6b3d8e14715be505",
  "outputHash": "f759f2e36137b8a2d3b3b28f98a12a1df2642638321d397f6f96e8e435e27e62",
  "providerRequestId": "jL3iavf7Btuw4-EPhfuJsAU",
  "usageUnits": 780,
  "sourceRefs": [
    {
      "id": "5ae0ad50-4b0b-42a1-aa1b-948483b81509",
      "spanId": "0bc44f77-8723-47fa-bb6d-017ac501ab57",
      "textHash": "5de71f4174e17527b9217c2560c239568e9fe49a182c116224d8f9be10b8288d"
    }
  ],
  "beforeVersion": 6,
  "afterVersion": 7,
  "duplicateApplyVersionUnchanged": true,
  "autoPublished": false
}
```

[Đối soát DB read-only](db-verification.json): usage đã settle, reservation về0, revision và publication được kiểm độc lập với ảnh. Budget UI polling5giây nên ảnh vừa nhận artifact có thể còn hiển thị reservation của lần poll trước.

Lần live đầu bị provider từ chối; job giữ usage_unknown/reservation và không tự retry. Bản cuối dùng responseFormat và wire schema để model chỉ sinh nội dung; ID/metadata do server gắn, local schema/citation/UUID validation vẫn đầy đủ. Một lần live trung gian bị invalid_artifact đã bị chặn và usage ghi đúng; harness từng kỳ vọng404 bằng staff cookie ở endpoint student, đã đổi sang kiểm catalog public không có course thay vì sửa app để ép assertion.

## Giới hạn

US-012 human findings/approve/reject chưa triển khai. Không publish giáo án; visualIntent vẫn là mô tả cho bước đồ hoạ sau. Live Gemini cuối xác nhận780 token và version6→7; chỉ một fixture kỹ thuật, không chứng minh chất lượng sư phạm toàn bộ hoặc robustness mọi injection. Không tự ký UAT, không production deploy, không load/physical mobile/WebKit/Firefox.

## Chạy lại

Từ backend: tạo actor mới bằng script acceptance-browser-fixture đã guard loopback/test, môi trường `.local/s02.env`. Start API với PORT3310/APP_ORIGIN3002/CMS_ORIGIN5174, CMS VITE_API_PROXY_TARGET3310/VITE_WEB_ORIGIN3002, Web API_INTERNAL_URL3310/CMS_INTERNAL_URL5174. Không dùng `.env` remote.

Từ Web: ARC_ACCEPTANCE_TEST=1 ARC_GEMINI_LIVE_TEST=1 pnpm exec playwright test --config playwright.plan-ai.config.ts; node scripts/build-plan-acceptance-report.mjs --live-gemini. API phải bật AI_AUTHOR_ENABLED và GEMINI_API_KEY trong env private; quality:local chủ động tắt provider thật. Tạo actor mới trước mỗi run vì MFA enroll thật.
