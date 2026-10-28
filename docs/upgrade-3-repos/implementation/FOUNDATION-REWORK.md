# Foundation rework — kiến trúc, đa ngôn ngữ và UI

Ngày: 28/10/2026. Phạm vi: chỉ đạo bổ sung trực tiếp của ĐẠI CA sau review foundation S00/S01. Tài liệu này bổ sung, không xoá lịch sử qualification cũ. Không mở sprint tính năng tiếp theo, không thanh toán, không commit/push/deploy.

## Kiến trúc đã điều chỉnh

| Repo | Tổ chức |
|---|---|
| backend | AppModule chỉ composition. Auth HTTP controllers tách common/student/staff/Google; SessionService sở hữu session transaction/audit. AccessModule riêng có DTO/controller/service; controller không truy cập DB. Shared contracts import trực tiếp package, bỏ proxy `packages-contracts.ts`. Locale middleware/filter dùng chung, email templates và durable payload có locale. |
| cms | `src/routes` TanStack file-based (`__root`, login/invite/forbidden, pathless `_authenticated`, index/modules). Router plugin auto splitting, CLI sinh route tree trước build/typecheck. Module manifest chỉ navigation/capability metadata; auth guard tại layout route, permission guard tại module route. `app` composition/providers/layout; `core` API/session/access/i18n/brand/UI/query; `modules` feature ownership. |
| web | `app/[locale]` route adapters, localized layout/guards/status UI; composition màn hình trong `features/landing`, `features/learning`, `features/auth`. `core` transport SSR/browser tách biệt, typed i18n/navigation, brand và UI primitives. next-intl middleware dùng tên phù hợp Next15. |

Các use case authentication còn dùng facade AuthService, chưa áp DDD/repository wrapper rỗng lên Prisma. Tách service khi có ranh giới nghiệp vụ; không thêm nhiều tầng chỉ để tăng số file.

## Locale contract

- Hỗ trợ `vi`, `en`; Web URL luôn `/vi/...` hoặc `/en/...`. URL cũ không prefix chuyển tới locale đã chọn; fallback VI. Ưu tiên URL rõ ràng > cookie `ARC_LOCALE` > VI, không để Accept-Language mặc định browser tự đổi UI.
- CMS giữ `/cms/...`, locale từ cookie chung; chuyển ngôn ngữ không đổi route và giữ invitation token. Web switch giữ path, query, hash. HTML lang, metadata, label, auth/MFA/empty/loading/error/nav/footer cùng ngôn ngữ.
- API dùng `Accept-Language`, parse regional tag/q-value, trả `Content-Language` và `Vary: Accept-Language`. Stable error code giữ nguyên; message lấy catalog VI/EN, không expose nội dung exception.
- Client errors render từ code theo locale hiện tại. Error/log technical không đưa vào product copy. Account switch/logout clear query cache.
- Email action ghi locale vào outbox khi request; worker dùng payload, không dùng locale môi trường; link verify/reset có prefix locale. Staff invite giữ `/cms/invite`. OAuth lưu locale trong sealed flow và callback vào dashboard locale tương ứng, không nhận arbitrary redirect URL.
- Ngôn ngữ giao diện khác ngôn ngữ nội dung khoá học. Dịch UI không tự dịch/publish tài liệu, giáo án hay bài giảng. Content revision locale/sources vẫn theo specs sprint nội dung.
- Đăng nhập/đăng xuất Web dùng hard navigation qua ranh giới identity để SSR đọc cookie mới; tránh client Router Cache giữ redirect hoặc view của phiên trước.

## Generated code và chất lượng

- Không sửa tay OpenAPI client/Prisma/generated route tree. Ngoại lệ bắt buộc với cú pháp `any` chỉ trong output TanStack CLI do upstream tạo; application TypeScript vẫn cấm explicit any và bật strict/noImplicitAny. Generated output bị exclude formatter/linter; route source vẫn kiểm tra đầy đủ.
- Native Rollup 4.65.0 trên máy macOS gặp SIGSEGV ở finalizer sau build. CMS pin alias upstream `@rollup/wasm-node@4.65.0` qua pnpm overrides; cùng API, không native binary. Không bỏ qua exit code. Build mới phải kết thúc exit 0.
- Font được self-host, dependency locked. Next lint dùng plugin framework thực. Optional native next-intl message precompile dependencies không được bật script khi không sử dụng.
- Quy chuẩn thiết kế, nguồn logo/palette và kiểm tra CI ở [FRONTEND-DESIGN](../standards/FRONTEND-DESIGN.md).

## Evidence

Tổng **51 tests pass**, tách đúng loại evidence:

| Repo | Unit | HTTP integration thật | Browser | Kết quả |
|---|---:|---:|---:|---|
| backend | 12 | 21 (Postgres/Redis/MinIO thật) | — | Pass |
| cms | 5 | — | 5 (contract fixtures cho UI/guard/locale) | Pass |
| web | 1 | — | 7 (3 flow thật qua backend/worker/CMS/Mailpit; 4 UI/guard/error checks) | Pass |

Backend unit: error envelope, locale negotiation, email templates. Integration: auth/CSRF/ownership/role/session/audit, HTTP locale headers và error messages, durable email locale/link, actual dependencies. CMS browser: route guard, invitation query, switch/reload/mobile, MFA language và denied module không gọi data API. Web browser: VI signup→email→verify→login→access cookie recovery→reset→re-login→logout; staff MFA→CMS; EN signup/email→verify/login→SSR learner page→switch VI→CMS/Web shared preference; UI logo/footer/responsive/query retention/private redirect/localized error.

Lint + TypeScript + format checks pass cho cả ba repo. API audience/closure và export reproducibility pass; hai consumer codegen drift checks pass; 31 Bruno operations coverage pass (coverage validation, không đồng nghĩa đã chạy mọi request Bruno thủ công). Product check: **123 keys/ngôn ngữ**, cùng placeholders, byte hash logo và palette, không internal status trong source UI.

Build local CMS và Web pass exit 0; backend TypeScript/packages build pass. Cả ba Linux Docker images build thành công, tag `arc-academy-{backend,cms,web}:foundation-rework`; đây là build verification, chưa deploy/publish hoặc remote CI run. CMS auto split có chunk lớn nhất khoảng 224 kB minified, không còn bundle >500 kB; không coi kích thước này là đo hiệu năng người dùng thực tế.

Đã visual review screenshot desktop 1280px và mobile 390px, finite animations được fast-forward khi chụp; phiên staff/student dùng fixture local. Không lưu MFA key, recovery codes hay credential trong screenshot. Paths local trong Web `.local/screenshots`: `web-home-vi.png`, `web-home-mobile-en.png`, `cms-studio.png`, `web-learning-en.png`. Source/screenshot không có dữ liệu khách hàng.

Local preview: Web `http://localhost:3001/vi`, EN `/en`; CMS qua cùng origin `http://localhost:3001/cms/login` hoặc `http://localhost:5173/cms/login`. Backend/worker và hạ tầng dev tiếp tục phục vụ preview.

Giới hạn: provider Google thật chưa cấu hình/kiểm; course/document authoring, graphics engine và lớp AI 1-1 chưa được triển khai trong rework foundation này. Không tạo dữ liệu khoá học/room giả để che phần tính năng chưa triển khai. Warning upstream CJS CLI circular export/Zod annotation không ảnh hưởng kết quả build, không bỏ qua application error. Các tính năng nội dung tiếp tục theo S02 và các sprint đã lên kế hoạch.

[Acceptance checklist JSON](../phases/P01-foundation/sprints/S01-foundation/review-amendment.json) ghi nhận yêu cầu review, không làm thay đổi 36 story/108 AC baseline cũ. Hash approval ban đầu được giữ nguyên làm lịch sử; [hash amendment](foundation-rework-hashes.json) ghi snapshot tài liệu sau chỉ đạo bổ sung.
