# S01 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md) là invariant dùng chung.

## Dữ liệu và semantic contract

Account/Identity/Session/Permission/CourseAssignment skeleton; Outbox/Idempotency/ModuleInstallation core; contracts version manifest.

## Endpoint/protocol hoặc deliverable thiết kế

P/auth register/login/Google/refresh/logout/me; I/auth login/MFA/invite; I/capabilities; spec p/i export. Cookie/session/CSRF và forbidden conventions theo SPEC-04.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-004 / FR-04 — Setup3 repo sau G0

- **AC-004-01**: Given G0 đã được duyệt rõ; When audit scaffold rồi setup phần được phép; Then repo tên backend đúng và3build/test skeleton có evidence.
- **AC-004-02**: Given scaffold tồn tại có thay đổi khác; When chuẩn bị setup; Then không overwrite/reset, có report giữ/sửa/thay.
- **AC-004-03**: Given compatibility spike lệch ADR; When báo kết quả; Then review thay đổi trước phần implementation phụ thuộc.

### US-005 / FR-05 — Danh tính và quyền học theo phân công

- **AC-005-01**: Given staff/student có credential hợp lệ; When login và gán course; Then session audience đúng, access/enrollment có audit.
- **AC-005-02**: Given student hoặc mentor ngoài assignment; When đọc internal/foreign session; Then server từ chối, không chỉ ẩn menu.
- **AC-005-03**: Given quyền vừa revoke hoặc token rotate đồng thời; When gọi request kế tiếp; Then không giữ quyền cũ và không revoke sai do refresh race.

### US-006 / FR-06 — Contracts và module shell

- **AC-006-01**: Given spec audience/version cố định; When codegen2lần; Then diff sạch, CMS/Web type/build pass và route shell theo capability.
- **AC-006-02**: Given public spec lộ private schema/answer; When chạy contract check; Then gate fail trước publish.
- **AC-006-03**: Given breaking contract hoặc module dependency đổi; When review release; Then có compatibility/impact plan, không runtime install code.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
