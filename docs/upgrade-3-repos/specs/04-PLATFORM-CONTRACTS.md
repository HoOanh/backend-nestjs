# SPEC-04 — Nền tảng phục vụ core

DRAFT 0.2 · S01 và các sprint mở rộng capability.

## Identity/access

Email/Google student, invite/MFA staff, session rotate/revoke; account role đa capability. Password Argon2id mới, legacy PBKDF2 verify constant-time rồi rehash khi login. Không migrate sessions cũ. Refresh reuse family revoke; client single-flight/cross-tab coordination và backend atomic rotation, cần chi tiết retry context trước implementation.

Cookie audience staff/student tách, HttpOnly/Secure host-only; CSRF Origin check + session-bound token. Backend kiểm action+scope+assignment+module/state; token không là nguồn quyền cuối cùng. Course assignment/access grant biểu diễn quyền học. CMS menu/routes/buttons lấy known manifest+capability; direct URL không bypass backend.

## Contracts

P student vs I internal OpenAPI paths/schema closure; DTO rõ return/errors, stable operationId; Web không bundle internal spec/answer keys. `@arc-academy/contracts` chứa spec/error/permission/module metadata và versioned content/visual/source schema. Generated service adapters riêng Next server/browser, Query keys có actor/scope/resource/revision/params; logout invalidate private cache.

Envelope success data/meta requestId; pagination page20/max100, cursor cho events/transcripts; error error.code/message/details + requestId. Dates UTC ISO8601; null/missing semantic rõ; enum additions có thể breaking. Error codes:400 validation,401 unauthenticated,403 forbidden hoặc404 private out-of-scope,409 state/lease/idempotency conflict,412 stale If-Match,413size,428 missing precondition,429quota,503dependency. Không tự unwrap làm đổi return type generated.

Idempotency(actor,audience,route,key)+requestHash durable; duplicate same request→same operation/result, different request409. Job/event unique constraints tiếp tục bảo vệ sau TTL. Outbox/audit/business changes trong một transaction, dispatcher delivery at-least-once; consumers dedup, dead-letter/replay audit. CI spec validation/breaking diff/codegen clean/consumer compatibility; default current+previous contract window30days đề xuất.

## Module/settings/AI ops

Module code compiled, manifest key/version/deps/permissions/settingsSchema/data ownership. Install enable metadata/seeds idempotent, không DDL/download dynamic code. Lifecycle available→installing→enabled→draining→disabled, failure→failed retry. Auth/access/audit core không disable; dependency disable409 impact list, purge tách workflow retention.

Prompt registry version immutable, provider adapter capabilities/task limits, quota reserve/settle and usage/latency/error metrics. Model/provider names config, not scattered UI literals. AI authoring draft; human publish. Provider usage/cost tracking là metadata vận hành AI nội bộ.

## Quality gate

Unit cho policy/reducer/validator, integration Postgres/Redis cho scope/CAS/outbox/quota, API smoke thực qua edge và Playwright core flows. Metadata annotation coverage không thay ownership negative tests. TypeScript strict cấm any; runtime boundaries unknown→validate; generated code không sửa tay. Cụ thể ở standards và sprint DoD.
