# S00/S01 — báo cáo thực hiện

Ngày 28/10/2026 · Baseline0.2 · **Qualified locally; external OAuth configuration pending**.

## Quyền thực hiện và phạm vi

ĐẠI CA đã đồng ý hướng tài liệu0.2, sau đó chỉ đạo “ok thực hiện đi nhé” và “continue”. Đây là quyền bắt đầu setup/implementation S00/S01 theo baseline, thay trạng thái documentation-only trước đó. Không có quyền tự commit/push/deploy từ báo cáo này. Các quyết định cho sprint sau vẫn được ghi riêng; không tự nhận đã hoàn thành toàn bộ R1/R2/R3.

Ba local Git repositories độc lập trên `feat/foundation`:

- `/Users/hominhoanh/Documents/source/arc-academy-backend` — đã đổi tên từ scaffold backend cũ.
- `/Users/hominhoanh/Documents/source/arc-academy-cms`.
- `/Users/hominhoanh/Documents/source/arc-academy-web`.

Scaffold trước sửa được snapshot tại `/tmp/arc-academy-scaffolds-before-s01.tar.gz`; không có commit ban đầu hoặc remote bị ghi đè. MVP all-in-one chưa đổi runtime source/data, chỉ bổ sung hồ sơ upgrade.

## S00 đã thực hiện

- Cài rules cho từng repo và9 bản skill thuộc5 workflow đã soạn; links supporting references chuyển sang repo-local.
- Validator gốc `skill-creator/quick_validate.py` đã chạy thành công cho9 bản skill, dùng PyYAML trong venv `.local/skill-tools` của backend; không cài global. Đây là kiểm tra format, không chứng minh hành vi agent qua trial.
- Hồ sơ0.2 được kèm trong mỗi repo tại `docs/upgrade`; hashes của tài liệu trước update trạng thái và compatibility matrix nằm cạnh báo cáo này.
- Chốt runtime dùng để kiểm: Node 24.22.1, pnpm 11.23.0, Prisma 7.10.1. Lockfiles và `compatibility-matrix.json` ghi phiên bản dependency thực tế. `.nvmrc` yêu cầu24; không tự đổi Node global của máy.

## S01 đã triển khai

### Backend

NestJS + Prisma 7/adapter-pg + Postgres; schema/migration chạy được, audit append-only trigger; Redis cache/queue tách instance. MinIO build từ source commit ghim, bucket private; Mailpit và worker email/outbox dùng queue thật. Secrets dev sinh ngẫu nhiên, private config/backup/fixtures không vào Git hoặc Docker context.

Auth: register/verify-email/password login/forgot-reset/logout/sessions, Argon2id, cookie student/staff tách biệt, signed session-bound CSRF và Origin validation. Refresh rotation dùng transaction/row lock, retry cùng request key có kết quả ổn định, reuse khác key revoke session family. Staff invite/accept/MFA enrollment/TOTP/recovery codes có backend flow; MFA bắt buộc trước staff session. Quyền được đọc lại từ DB mỗi request; negative ownership/audience/permission tests.

Course assignment cấp/thu hồi và đọc self, audit trong transaction. Hiện courseId là UUID reference của foundation; domain Course và FK đầy đủ phải được nối ở S02, chưa có dữ liệu khoá học import. Catalog module chỉ platform/content/visuals/classroom; đọc capabilities/catalog thật, chưa làm activation UI của S09.

OpenAPI15 public paths/16 internal paths, envelope đúng runtime, public schema không có staff metadata/recovery-code fields. Contracts 0.1.0 có spec/error/permission/module metadata. API export/drift/schema closure và31 Bruno request examples đã có; check coverage không đồng nghĩa đã bấm chạy thủ công toàn collection.

### CMS

Vite/shadcn/TanStack Router+Query, `/cms/` basename, login/MFA/invite acceptance form, scoped query cache, route/capability/navigation guards. Dashboard và module catalog lấy đúng session/server capability; bỏ dữ liệu/trạng thái cài đặt giả của scaffold. Generated client giữ nguyên envelope, adapter validate contract và dịch error code theo metadata dùng chung.

### Web

Next App Router, register/email verification/password reset/login/logout và private server guard. Generated browser Query client và server-only read client riêng; server forward đúng cookie học viên, no-store. Browser refresh có single-flight/cross-tab coordination; phục hồi access cookie hết hạn qua refresh cookie mà không bắt nhập lại password. Auth links no-referrer/no-store; UI không hiển thị chứng chỉ giả từ tiền tố mã.

`pnpm start` phục vụ standalone output. Cùng origin proxy Backend/CMS đã được browser qualification; upstream Next rewrites chốt lúc build, Docker build args/runtime configuration được ghi trong README.

## Evidence đã chạy

| Nhóm | Kết quả local |
|---|---|
| Backend unit |3 tests pass — envelope, structured DB error redaction, dependency error/query-token logging |
| Backend HTTP integration |20 tests pass với Postgres/Redis/MinIO thật — email one-time, MFA, CSRF, audience, ownership, revoke, assignments, refresh retry/reuse, audit, spec envelope |
| CMS unit |5 tests pass |
| Web unit |1 test pass |
| CMS browser |2 tests pass — interactive login và private route guard (contract fixture) |
| Web full-stack browser |4 tests pass — public guard/header, signup→Mailpit→verify→login→refresh→reset→revoke/logout; CMS login→MFA→guarded pages→logout; landing |
| Types/lint/build |Đã chạy trên3 repo; production build CMS/Web và backend TypeScript build pass |
| Contract regeneration |Backend export reproducible, schema closure/audience checks pass; CMS/Web generated code và metadata không drift |
| Skill validation |9installed copies pass validator gốc, links repo-local tồn tại |
| Docker images |Backend/CMS/Web `:foundation` đều build local thành công; MinIO source image build thành công |
| Redis recovery |Readiness200→503→200 sau stop/start cache, không restart backend |
| Backup local |DB dev snapshot checksum, restore vào DB tạm và kiểm schema; DB tạm được drop, DB đang chạy không bị thay |

Tổng35 automated tests trong các nhóm test nêu trên. Qualification dùng fixture local; không gửi email ra bên ngoài hoặc gọi provider AI tính phí. Raw credential/MFA/recovery codes không được in trong log kiểm chứng. Docker image IDs lấy từ local daemon, không phải registry đã publish.

CI workflows dùng Node 24/frozen lockfiles, checks/build/container builds đã viết. **Chưa chạy GitHub Actions remote**, vì repos chưa có commit/push/remote. Lệnh tương ứng đã được chạy local; không gọi trạng thái này là remote CI xanh. Chưa có released contract baseline để chứng minh current/previous-release compatibility; policy release/breaking review tiếp tục theo SPEC-04.

## Còn lại / ranh giới nghiệm thu

- Google OIDC đã có code state/nonce/PKCE/server token validation và fail-closed503 khi chưa cấu hình; **chưa có credentials và chưa live-test Google**. UI mặc định tắt.
- Course/content/document/teaching-plan/visual/classroom thực sự thuộc S02 trở đi; dashboard hiện chưa có dataset khoá học. Không gọi S01 là sản phẩm thay MVP hoàn chỉnh.
- Backup vừa kiểm là local DB-only; chưa off-host/PITR/media/key recovery của R3. Chưa load test, pentest, full browser capability/a11y classroom hoặc cutover.
- Docker builds có warning không chặn build: CMS bundle size và Next chưa có plugin framework-specific trong ESLint; TypeScript/ESLint rules hiện hành vẫn pass. Tối ưu workspace/bundle và tăng framework checks theo feature/risk, không sửa generated code tay.
- Dữ liệu test được tạo trong DB dev để qualification; không migrate user/content/progress từ MVP.

## Chạy thử

- Web: http://localhost:3001
- CMS: http://localhost:3001/cms/login hoặc http://localhost:5173/cms/login
- Mailpit: http://localhost:58025
- Backend readiness: http://localhost:3100/readyz
- Dev admin credentials: backend `.local/bootstrap-credentials.json`, password không ghi trong tài liệu/chat; first login enroll MFA.

Xem README ở từng repo để build/start/check. Không có commit, push, image publish hoặc deployment do đợt thực hiện này tạo ra.
