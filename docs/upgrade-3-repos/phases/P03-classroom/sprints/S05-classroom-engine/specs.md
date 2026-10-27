# S05 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-03](../../../../specs/03-CLASSROOM-AI.md) là invariant dùng chung.

## Dữ liệu và semantic contract

RoomVersion package/persona/policy refs; Session status/version/lease/lastAck/resumeBeat; SessionEvent eventId/sequence.

## Endpoint/protocol hoặc deliverable thiết kế

I/rooms/versions/publish; P/classroom/sessions POST/GET; lease/events/pause/finish theo CAS+Idempotency-Key, text fallback capabilities.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-016 / FR-16 — Room AI có phiên bản

- **AC-016-01**: Given package published và persona hợp lệ; When publish room version; Then pin package/persona/policy và học viên được gán vào được.
- **AC-016-02**: Given plan/source draft chưa publish; When bind room; Then bị chặn với reference cụ thể.
- **AC-016-03**: Given room publish phiên bản mới; When phiên cũ tiếp tục; Then vẫn dùng snapshot ban đầu.

### US-017 / FR-17 — Engine giảng/vẽ/voice có fallback

- **AC-017-01**: Given browser đủ capability; When vào phòng và giơ tay; Then narration/ink/focus pause và resume đúng beat.
- **AC-017-02**: Given ONNX/STT/TTS/3D lỗi hoặc unsupported; When học tiếp; Then text/chat hoặc serverTTS policy fallback, không chặn tài liệu.
- **AC-017-03**: Given rời route/quay lại; When cleanup/remount; Then không audio/worker/RAF/WebGL leak hoặc lecture chạy hai lần.

### US-018 / FR-18 — Session durable và single writer

- **AC-018-01**: Given event checkpoint đã ack; When mở thiết bị khác; Then resume đúng snapshot/checkpoint/lastAck.
- **AC-018-02**: Given writer lease bị takeover hoặc completed giả; When gửi event/finish; Then stale lease409 và không xác minh mastery giả.
- **AC-018-03**: Given event trùng hoặc mạng ngắt trước ack; When retry/reconcile; Then dedup eventId, pending không báo saved.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
