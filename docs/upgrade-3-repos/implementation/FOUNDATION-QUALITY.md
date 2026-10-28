# Foundation quality amendment — 28/10/2026

Phạm vi ĐẠI CA yêu cầu: chuẩn hoá nền tảng ba repo, light mode, shadcn thật, rules, skills, MCP và kiểm thử trước mở rộng tính năng. Không mở sprint tính năng mới. Báo cáo này bổ sung lịch sử S00/S01 và foundation rework cũ; không coi các con số cũ là evidence của revision hiện tại.

## Đã sửa

- CMS/Web light-only từ tokens đến HTML, metadata viewport và Sonner. Không còn dark overrides/utilities trong application UI. Logo giữ byte gốc; action blue đậm hơn để chữ trắng dễ đọc. Brand manifests được rehash và hai token snapshots giống nhau.
- Thêm `components.json` cho CMS/Web; aliases đúng `src/core/ui`, local cn và global CSS. Root tsconfig CMS khai báo alias để CLI resolve được project references. Cài Button/Input/Label/NativeSelect/Card qua registry shadcn; dùng thật trong auth và locale switch. Map semantic tokens shadcn sang brand. Gỡ dependency `cn` không liên quan do registry thêm, dùng helper cn hiện có.
- `.codex/config.toml` trên cả ba repo: `pnpm dlx shadcn@4.23.0 mcp`. Backend dùng tra cứu UI contracts liên repo, không React/runtime UI, không `components.json` giả. Không thêm server DB/Redis có quyền ghi vì foundation này không cần nó.
- AGENTS.md bổ sung foundation authorization hiện tại; cài `arc-foundation-quality` trên ba repo. FE/CMS có upstream `frontend-design` nguyên bản, pinned revision, hash và license; `arc-frontend-workspaces` nối design với engineering. Đã kiểm local links của toàn bộ skill để resolve đúng tài liệu trong repo.
- ESLint AST chặn button/input/select/textarea/label viết tay ngoài core/ui; semantic document HTML vẫn dùng bình thường. Bốn tests/repo kiểm rule vi phạm, ngoại lệ primitive/layout hợp lệ, core import feature và explicit TypeScript any. Các control phức tạp khác phải tra registry theo skill; không tuyên bố lint đã hiểu mọi custom ARIA pattern.
- Unit tests cho CSRF, session refresh/dedup/error, không leak backend message, SSR chỉ forward learner cookie, locale preference và accessible form primitives. Vitest Web bật automatic JSX runtime để thực sự render component trong test.
- `pnpm quality:check` chạy foundation check, formatter, lint, types, **coverage có threshold**, product/contract/Bruno theo vai trò. CI gọi cùng command; thêm MCP smoke và upload coverage artifact. Build và browser vẫn là gates riêng.

## Kiểm chứng local

| Repo | Unit | HTTP integration thật | Browser | Rule tests | Coverage lines toàn application |
|---|---:|---:|---:|---:|---:|
| backend | 12 | 21 | — | — | 78.40% (unit + HTTP) |
| cms | 29 | — | 7 fixture UX | 4 | 41.22% (unit) |
| web | 32 | — | 9, gồm 3 flow full-stack thật | 4 | 24.30% (unit) |

Coverage không bỏ application chưa test để nâng %. Generated outputs/type declarations/test files được loại khỏi denominator. UI được kiểm browser nhưng **không cộng browser vào unit coverage**; frontend global còn thấp, không gọi là 80–90% coverage toàn codebase.

Các boundary quan trọng đã có threshold: CMS/Web browser transport ≥90% statements/lines/functions và ≥80% branches; Web SSR transport ≥95% statements/lines/functions và ≥90% branches; error presentation helpers 100%. Hiện CMS transport 95.87% lines / 84.37% branches; Web browser transport 100% / 85.71%; SSR transport 100% / 92.85%. Backend floor global 75% statements/lines, 70% functions, 60% branches. Threshold là regression floor, không thay correctness hay chứng minh scale.

MCP trên từng repo đã thực sự initialize → tools/list (7 tools) → tìm @shadcn/button qua stdio. Cấu hình mới cần client nạp lại khi mở chat/repo; transport smoke không đồng nghĩa mọi client đang chạy đã hot-reload. Skill repo mới được khám phá ở lượt tiếp theo.

Build backend/CMS/Web, format/lint/types, product brand/i18n và OpenAPI reproducibility/consumer drift đã chạy local. Browser 390px, keyboard label/focus, VI/EN/reload/action token retention, OS dark vẫn light. Full stack thật gồm signup→Mailpit→verify→login→refresh→reset→logout và staff MFA/CMS. Screenshots desktop/mobile light đã xem trực tiếp; lưu trong Web `.local/screenshots`. Đây là local verification; chưa remote CI/deploy hoặc Docker rebuild cho revision này.

Lần đầu browser live bị rate-limit register do các vòng test trước cùng Redis local (5/hour), không phải UI thành công giả. Đã thêm fixture reset **chỉ** counters register/forgot của loopback, explicit opt-in và Redis localhost, cấm production. Không FLUSHDB, không xoá sessions và không đổi production limiter. Full-stack suite chuẩn bị fixture trước run; rerun đã pass.

## Những phần chưa được chứng minh

- Unit toàn frontend chưa cover sâu screen orchestration, SSR layouts/guards và revalidation; browser là lớp bổ sung, không thay unit characterization khi tiếp tục sửa những vùng này.
- Google OAuth thật chưa cấu hình/kiểm. Backend worker process và failure/retry paths còn coverage thấp; browser xác nhận email delivery thành công, chưa chaos/recovery qualification.
- Chưa đo tải/concurrency dài hạn, restore drill hay production deployment. Không tuyên bố nền tảng đã sẵn sàng scale chỉ từ pass build/test.
- Ưu tiên tiếp theo vẫn là hardening những khoảng trống này trước sprint tính năng; chỉ đạo hiện tại không tự mở S02.

## Lệnh sử dụng

Node 24, pnpm 11.23.0. `pnpm quality:check`; `pnpm build`; `pnpm mcp:check`; frontend `pnpm test:e2e`. Backend quality coverage cần Postgres/Redis/MinIO local theo compose và Prisma generated/migrations. Web live qualification: backend/worker/Mailpit/CMS phải chạy rồi `ARC_FULL_STACK_TEST=1 pnpm test:e2e`. Không bật full-stack env chỉ chạy UX và skip 3 live flows, phải báo rõ.

Nguồn: [shadcn MCP](https://ui.shadcn.com/docs/mcp), [Codex project MCP](https://developers.openai.com/codex/mcp), [frontend-design snapshot](https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md).
