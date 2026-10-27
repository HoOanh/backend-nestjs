# S09 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-03](../../../../specs/03-CLASSROOM-AI.md); [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md) là invariant dùng chung.

## Dữ liệu và semantic contract

Class/Roster/Occurrence/MentorAssignment; primary session unique occurrence+student; Notification dedup; Module settings versions.

## Endpoint/protocol hoặc deliverable thiết kế

I/classes/roster/occurrences; P/me/classes; I/classes/{id}/sessions; I/modules settings/enable/disable-drain; P/me/notifications.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-028 / FR-28 — Cohort/roster/lịch AI 1-1

- **AC-028-01**: Given class/roster/timezone hợp lệ; When publish lịch và student join; Then occurrenceUTC và một primary session/student.
- **AC-028-02**: Given roster CSV trùng hoặc ngoài join window; When import/join; Then report/chặn rõ, không shared AV.
- **AC-028-03**: Given reschedule/cancel/join retry; When xử lý lịch; Then không rewrite session cũ, notification dedup.

### US-029 / FR-29 — Mentor dashboard đúng assignment

- **AC-029-01**: Given mentor được gán lớp; When xem dashboard; Then progress/summary trong scope, transcript có quyền riêng+audit.
- **AC-029-02**: Given assignment vừa thu hồi; When request tiếp; Then backend chặn, UI không cấp dữ liệu mới từ cache cũ.
- **AC-029-03**: Given đổi học viên/lớp trong dashboard; When query data; Then query key đúng scope không lẫn account.

### US-030 / FR-30 — Module settings phục vụ content/classroom

- **AC-030-01**: Given module compiled/dependency/config hợp lệ; When enable/settings; Then validate version và capability/menu nhất quán.
- **AC-030-02**: Given dependency thiếu hoặc core auth bị disable; When thao tác; Then bị chặn có impact report, không DDL/xoá data.
- **AC-030-03**: Given classroom đang active; When disable drain; Then chặn new session, giữ/stop in-flight theo policy deadline có audit.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
