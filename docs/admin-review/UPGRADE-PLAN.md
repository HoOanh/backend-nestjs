# Kế hoạch nâng cấp admin

Trạng thái: đã triển khai đợt sửa auth/API, nghiệp vụ cốt lõi và UI ngày 01/10/2026. Phần DB production và các hạng mục mở rộng chưa hoàn tất; xem [bàn giao triển khai](IMPLEMENTATION.md). Đầu vào: [báo cáo](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/README.md), [21 probes](/Users/hominhoanh/Documents/source/backend-nestjs/docs/admin-review/api-probe-results.json), ảnh trong `evidence/`.

P0 = xác thực, tính đúng của kết quả, quyền đọc dữ liệu; P1 = nghiệp vụ/core UX phải đạt trước rollout; P2 = hiệu quả vận hành và mở rộng. Thứ tự triển khai dưới đây dựa trên dependency, không chỉ mức severity.

## 1. Phạm vi mục tiêu

Admin vận hành học viên, quyền học, chứng chỉ, cấu hình khóa học, lịch sử học và evidence thay đổi. Nền UI phải dùng chung cho toàn admin, hoạt động cả light/dark và màn nhỏ. Mỗi nghiệp vụ nguy hiểm phải có preview ảnh hưởng, reason và server authorization.

Không thêm thanh toán chỉ để làm đầy KPI. Nếu chưa có nguồn đơn/giao dịch, revenue tiếp tục hiển thị “Chưa tích hợp” hoặc bỏ khỏi KPI chính. CMS và AI editor đi sau nghiệp vụ cốt lõi; trước đó đổi tên thành “Xem giáo trình” và “Trạng thái AI” để đúng khả năng.

## 2. Kiến trúc UI đề xuất

### Navigation

| Nhóm | Trang | Mục tiêu |
| --- | --- | --- |
| Tổng quan | Overview | Học viên thực, hoạt động theo kỳ, chứng chỉ còn hiệu lực, việc cần xử lý |
| Đào tạo | Học viên; quyền học; chứng chỉ; giáo trình | Quản lý entity có detail và command theo nghiệp vụ |
| Hoạt động | Nhật ký học; lịch sử thao tác | Xem kết quả học và điều tra bằng chứng riêng biệt |
| Vận hành | AI; dữ liệu; sức khỏe hệ thống | Cho admin có permission tương ứng, tách chức năng kỹ thuật |

Giữ compatibility `/admin/trace`, `/admin/logs`, `/admin/database`; bổ sung route chi tiết/alias khi cần. URL chứa bộ lọc, trang và entity đang mở. Unknown route có 404 admin; login giữ `returnTo` đã kiểm tra là path nội bộ.

### Thành phần dùng chung

- `AdminShell`: sidebar desktop thu gọn, mobile drawer; topbar có breadcrumb, title, theme và menu tài khoản. Main `min-width: 0`, overflow ngang chỉ trong bảng.
- `AdminPageHeader`: title, mô tả ngắn, primary action duy nhất; không lặp heading và warning dài.
- `Button`, `IconButton`, `Field`, `Select`, `DateRange`, `Badge`, `Alert`, `Toast`: token theme, focus visible, hover/disabled/pending. Error toast khác success; warning dữ liệu test là warning, có link lọc.
- `DataTable` và `TableToolbar`: search debounce, filter chips, sort, page size 25/50/100, sticky header, thông tin tổng/đang hiển thị, column visibility; empty/loading/error riêng.
- `EntityDrawer`, `FormDialog`, `ConfirmActionDialog`: focus trap, Escape, restore focus; `aria-labelledby`, labels đúng; unsaved changes và field/server errors.
- `AuditDiff`: chỉ các trường đổi ở mặc định, full snapshot ở advanced detail; JSON viewer có wrap/scroll/copy, không disclosure cho mọi scalar.

Tên file có thể đổi khi triển khai; đây là hợp đồng component và hành vi, không yêu cầu thêm UI library trước khi cần.

### Token/layout

Thay màu hardcode trong admin bằng bộ token surface/text/border/status theo theme. Dùng `--bg-app` hoặc token canvas khai báo rõ. Font body 14px, label 12–13px, title 20–24px; monospace chỉ ID/code. Spacing 4/8/12/16/24/32; border radius 8/12.

Breakpoint nghiệm thu: 390, 768, 881, 1024, 1440px. KPI 1/2/4 cột theo không gian thực; vùng 2 cột thành 1 cột khi thiếu chỗ. Sidebar không chiếm cố định 260px trên mobile. Bảng wide cuộn ngang trong container, có header/action column hợp lý.

## 3. Giai đoạn A — P0: xác thực và hợp đồng API

**A1. Auth chuẩn nguồn nhận dạng**

- Public register bỏ `role`, mặc định student/free; không nhận plan trả phí từ payload khi không có entitlement.
- Google login chỉ nhận access/id token đã verify theo cấu hình provider; bỏ email-only và JWT decode-only fallback. Liên kết email không tự chuyển provider/account khi chưa xác thực đủ.
- Email login từ chối Google-only account hoặc account thiếu hash; không cấp token khi chưa verify credential.
- Bootstrap admin chuyển thành setup task có idempotency, không tự ghi/reset/recreate account mỗi request.
- Session expiry/logout/role changes phải thống nhất frontend/backend; role update không thể dựa vào role JWT cũ thay vì user hiện tại.

**A2. Authorization và DTO**

- Auth + ownership cho history/progress read và write; permission riêng cho users.write, plans.write, certificates.issue/revoke, audit.read/export, database.read.
- Validate normalize email, unique constraint; enums/foreign keys; score 0–100 nếu trường score tồn tại; giá không âm; whitelist field, cấm đổi id.
- Dùng response mapper whitelist cho create/update/list; không trả hash, salt, session token trong user entity.
- Self-delete/self-demote và mất admin cuối phải bị chặn trên server. Admin thường không mặc định là “Super Admin” nếu chưa có role đó.

**A3. Tính tin cậy kết quả học**

- Server nhận answers/attemptId và tính score/pass nếu chứng chỉ được dùng như bằng chứng hoàn thành. Payload score/pass của client không được quyết định quyền/cert.
- Trong giai đoạn chuyển tiếp, xác định rõ dữ liệu client-submitted là unverified; không tự cấp certificate đáng tin từ nó.

**Nghiệm thu A:** các probe REGISTER-ADMIN, GOOGLE-SPOOF, EMAIL-GOOGLE-PASSWORD, USER-RESPONSE-SECRETS, PROGRESS-READ-GUARD, HISTORY-READ-GUARD, EXAM-SERVER-GRADE chuyển PASS. Test anonymous/student/instructor/admin theo mỗi endpoint; account Google không đăng nhập bằng password bất kỳ; không secret trong response/audit.

## 4. Giai đoạn B — P1: lưu trữ và command nghiệp vụ

**B1. Kho dữ liệu durable**

Chọn DB bền vững dùng chung phù hợp host thực tế. Cần transaction, unique email, foreign keys, index cho time/actor/entity/request và version chống lost update. Không dùng `/tmp` làm kho evidence production. Provider/connection là đầu vào cần xác nhận khi triển khai, không thể suy ra từ repo hiện tại.

Migration có dry-run, backup, kiểm tra count/FK/unique; xử lý 2 account trùng email bằng quyết định có bằng chứng. Test records phải gắn `dataOrigin=test`, tách report default khỏi KPI thực; không tự xóa theo pattern tên/email. Lưu mapping nguồn/ID để tra audit sau migration.

**B2. Command độc lập và transaction**

| Command dự kiến | Input quan trọng | Ghi cùng transaction |
| --- | --- | --- |
| `POST /admin/users/invite` | name, email, role được phép, reason | user pending, invite lifecycle, audit |
| `PATCH /admin/users/:id` | field whitelist, expectedVersion, reason nếu đổi quyền | user, phiên/quyền liên quan theo policy, audit |
| `POST /admin/users/:id/entitlements` | scope bài/khóa học, expiresAt, reason, idempotencyKey | entitlement, audit; không sửa completedLessons |
| `POST /admin/certificates` | userId, type, eligibility hoặc manualReason, idempotencyKey | certificate, liên kết trạng thái học hợp lệ, audit |
| `POST /admin/certificates/:id/revoke` | reason, expectedVersion | status/revokedBy/revokedAt, audit |
| `POST /admin/users/:id/suspend` | reason, expectedVersion | trạng thái, session revocation, audit |

Đây là contract đề xuất, giữ alias API cũ khi migrate client nếu cần. Backend sinh actor/request/time; không cho client tự gửi bằng chứng như actor/before/after. Idempotency cho issue/grant; stale version trả 409 và UI có cách tải lại so sánh.

**B3. Ngữ nghĩa học viên/chứng chỉ**

- `completedLessons` = hoạt động học đã xác nhận; entitlement = quyền truy cập; override có lý do. Do bài học hiện luôn unlocked, xác định quyền học theo plan/scope thay vì giữ nút “mở hết” vô nghĩa.
- Cert exam/manual/honorary tách loại. Manual grant không ghi điểm thi 100 hoặc tạo attempt giả. Cert có code unique, status issued/revoked, issuedBy, reason, reference evidence và verify path.
- Thi trượt ghi attempt.failed; passed ghi attempt.passed; cert issued là sự kiện riêng. Dashboard phân biệt số học viên được cấp với số cert còn hiệu lực.
- Tạm khóa gói chặn đăng ký/cấp mới theo policy; quyền hiện có giữ hay thu hồi phải nói rõ, có preview trước action.

**Nghiệm thu B:** các probe USER-UNIQUE, USER-VALIDATE, USER-CREDENTIAL, USER-ENUMS, INACTIVE-PLAN, PLAN-PRICE, FAILED-EXAM-EVENT, ADMIN-CERT-LOOKUP, SELF-DELETE, BOOTSTRAP-RESURRECTION chuyển PASS. Retry cấp bằng không nhân bản; fail giữa command rollback business + evidence nhất quán; unlock không tăng completed count; cert verify được và thu hồi có hiệu lực. Restart/đa instance không mất dữ liệu.

## 5. Giai đoạn C — P1: shell và các trang vận hành chính

**C1. Nền UI**

Tách admin CSS theo phạm vi shell/component; không tái dùng CSS SQL cho business audit. Sửa light/dark, controls, responsive, keyboard và trạng thái load/error trước khi trang trí từng màn. Route lazy load tách admin khỏi bundle giáo trình khi dependency cho phép.

**C2. Học viên**

Danh sách tên/email, role, trạng thái, plan/quyền hiệu lực, ngày hoạt động; search + filter + sort server; mặc định dữ liệu thực, filter test explicit. Click row mở detail drawer: hồ sơ, quyền học, tiến độ thực, attempts, cert và audit liên quan. Hành động ít dùng đặt menu có tên rõ; không hiển thị cấp bằng/mở bài cho admin/instructor không đúng đối tượng. Suspend/restore ưu tiên hơn hard-delete.

Form create = invite rõ trạng thái; không password mặc định. Edit có field errors, permission/reason, dirty-state và pending. Confirm tác vụ phải hiện đúng tên/email, phạm vi ảnh hưởng, khác biệt, reason; không chỉ một `confirm()` chung.

**C3. Tổng quan và gói học**

KPI có định nghĩa/query và date range; active students phải có cutoff hoạt động. Test tách default. Recent students đúng nguồn; không nhãn “bán chạy” khi chỉ là cấu hình popular. Gói học có edit giá/quyền, người đang dùng và preview ảnh hưởng bật/tắt; billing chờ nguồn transaction thật.

**Nghiệm thu C:** UI-01..UI-08 được xử lý; body không tràn/cắt ở 5 breakpoint; text contrast chữ thường >=4.5:1, large text có ngoại lệ >=3:1 theo [W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Form keyboard Tab/Shift+Tab/Escape đúng; save double-click chỉ tạo một command; request lỗi giữ input và không báo success; data thật/test nhất quán giữa KPI/list.

## 6. Giai đoạn D — P1/P2: lịch sử học và audit evidence

**D1. Nhật ký học tập**

Tìm theo tên/email, bài/chương, loại sự kiện, kết quả, thời gian và data origin. Action có nhãn tiếng Việt; entity link sang detail, ID ở secondary/copy. Filter/query/page trên URL. Export có quyền, giới hạn, audit sự kiện xuất và cùng snapshot/filter đang xem.

**D2. Lịch sử thao tác**

Một dòng/request hoặc command: thời gian, người, hành động có nghĩa, đối tượng, kết quả và số thay đổi. Drawer chứa timeline request → các entity changes → response/error, before/after chỉ field đổi, full snapshot khi mở advanced. Cột đối tượng hiển thị tên người/gói, ID để copy. Search actor bằng tên/email, request ID exact, date range presets và saved filter.

Phân loại `business-change`, `access`, `auth`, `system`, `technical`. Không hiển thị autosave timestamp-only như thay đổi nghiệp vụ mặc định; giữ trong trace kỹ thuật có retention riêng. Bảo toàn event thất bại và requestId. Không gộp/xóa evidence cũ chỉ để giảm noise.

Audit schema bổ sung `operation`, `source`, `reason`, `target label`, `schemaVersion`, `correlation/commandId`, trạng thái request final. Request chứa nhiều thay đổi chỉ lưu body cần thiết đã redact. Actor/source system phải tách rõ bootstrap/background khỏi người dùng. Bản ghi lịch sử có target/actor bất thường phải được đánh dấu cần kiểm tra, không sửa bằng suy đoán.

**D3. Bảo toàn bằng chứng**

Quyền audit chỉ đọc ở UI thường; policy retention, export và truy cập. Transaction/outbox cho business events tùy storage; separate structured diagnostics cho lỗi rejected/rollback. Thêm cơ chế kiểm tra toàn vẹn nếu bằng chứng cần chống sửa: chữ ký/hash-chain với đầu chuỗi lưu bên ngoài cùng DB; hash-chain tự nằm trong file có thể bị viết lại nên không được quảng cáo là immutable. Backup và test restore thực tế.

**Nghiệm thu D:** tìm một user đã xóa vẫn thấy actor snapshot và changes; mọi command success/failure có requestId; export không lộ secrets; đổi filter không flash dữ liệu cũ như kết quả mới; timestamp-only noise không che các thay đổi role/plan; server filter có index/pagination, date range sai hiển thị validation.

## 7. Giai đoạn E — P2: vận hành và chức năng còn thiếu

- DB screen là “Dữ liệu & sức khỏe”: bảng cho phép xem, row drawer, column visibility, search/filter, update time/storage source, backup/migration status; không thêm arbitrary SQL write vào admin thường.
- Legacy browser data: detect presence trước query, empty/import preview rõ nguồn/tài khoản; nhập có ownership check, idempotency, kết quả/mapping/audit. Không coi parser SQL browser là SQLite thực.
- AI trước mắt là “Trạng thái AI”: config lấy từ server một nguồn; prompt version thật. Nếu cần edit: draft → test connection có quota/timeout → publish version → audit; không expose API key. Chat message/error trace là diagnostic riêng, không nhập chung audit nghiệp vụ.
- Giáo trình trước mắt view/search/preview đúng nguồn. Nếu cần CMS: draft/version/publish/archive, đồng bộ lesson IDs với attempt/progress, audit nội dung và rollback version; không edit trực tiếp module TS trong UI.
- Error dashboard: nhóm theo request/command, severity, entity và thời gian; link sang audit detail, không chỉ console log.

**Nghiệm thu E:** không nhãn chức năng giả, tab active rõ, legacy empty không lỗi SQL, prompt UI trùng version server, main bundle được phân tách có đo trước/sau; chưa đặt ngưỡng performance giả khi chưa có baseline tải.

## 8. Test và rollout

1. Giữ fixtures tách khỏi DB local; script review chạy temp. Đổi các probe đang FAIL thành regression asserts cho từng fix; không sửa expectation để hợp thức hóa hành vi sai.
2. Test API authorization, unique/DTO, transaction rollback, idempotency, stale edit, audit redaction/cascade và preservation sau soft-delete.
3. Test UI cho 8 trang, light/dark, breakpoint, keyboard, deep-link, back/forward, filter persistence, pending/errors/empty. Snapshot visual và kiểm tra computed contrast; build pass không thay cho UI verification.
4. Thử data volumes 100/1.000/10.000 entity/audit với pagination; đo API/render/read/write để đặt SLO thực tế. Không render snapshot tất cả trong list.
5. Migration staging: backup → dry-run → counts/unique/FK → apply → smoke test → rollback rehearsal. Chỉ deploy production sau khi DB/config và ownership rõ.
6. Rollout theo capability, giữ route compatibility; xác nhận các client cũ không thể gọi contract cho phép privilege/grade bypass.

## 9. Thứ tự thực thi đề xuất

| Chặng | Đầu ra review được | Dependency | Done |
| --- | --- | --- | --- |
| 1 | Auth/DTO/ownership + regression các lỗ hổng P0 | Không phụ thuộc redesign | Nhóm A pass, không bypass admin |
| 2 | DB migration + commands entitlement/cert + integrity | Quyết định DB/host và semantics | Nhóm B pass, evidence production durable |
| 3 | Shell/tokens/components + học viên/tổng quan/gói | Commands đã rõ; có thể chuẩn bị UI song song theo contract | Nhóm C pass, before/after screenshots |
| 4 | Audit request drawer + learning history filters | Schema/index audit và entity APIs | Nhóm D pass, điều tra một thao tác không cần đọc JSON thô |
| 5 | DB operations/AI status/giáo trình và tối ưu | Cốt lõi đã ổn | Nhóm E đúng khả năng và có đo lường |

Ưu tiên đầu tiên là **Chặng 1 + token/contrast/layout trong Chặng 3**. Không dành thời gian làm chart doanh thu trước khi có dữ liệu thanh toán. Chứng chỉ, quyền học và audit phải dùng command đúng nghiệp vụ trước khi đánh bóng UI tác vụ.

Đầu vào cần chốt khi triển khai: môi trường deploy/DB bền vững; policy quyền học (hiện tất cả bài luôn mở); tiêu chuẩn cấp chứng chỉ exam vs honorary; vai trò admin/instructor; dữ liệu test nào được phép loại sau backup. Chưa đưa ETA vì chưa có quyết định DB và scope CMS/billing.
