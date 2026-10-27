# S06 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-03](../../../../specs/03-CLASSROOM-AI.md) là invariant dùng chung.

## Dữ liệu và semantic contract

Conversation/Message/Run source refs; CheckpointAttempt server result; LessonProgress provenance; Summary inputHash/status.

## Endpoint/protocol hoặc deliverable thiết kế

P/classroom/sessions/{id}/messages SSE; checkpoints/{id}/attempts; runs/{id}; summary GET; P/me/progress. New session pin current package, existing retain old.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-019 / FR-19 — Hội thoại AI theo checkpoint và nguồn

- **AC-019-01**: Given session hợp lệ có permitted sources; When gửi câu hỏi; Then SSE answer/citations bám pinned objective/checkpoint.
- **AC-019-02**: Given cố đọc tài liệu author-only/người khác; When ask/source retrieval; Then không leak private text hoặc source metadata.
- **AC-019-03**: Given stream ngắt/cancel/provider timeout; When query run status; Then không tạo message/run duplicate và không xoá usage unknown.

### US-020 / FR-20 — Checkpoint và tiến trình có evidence

- **AC-020-01**: Given answer hợp lệ của checkpoint pinned; When submit; Then server chấm và lưu progress provenance.
- **AC-020-02**: Given client gửi pass/score hoặc foreign checkpoint; When submit; Then không được coi trusted và không lộ answer keys.
- **AC-020-03**: Given duplicate submit hoặc offline pending; When sync lại; Then cùng attempt ack, không tăng pass/lượt trùng.

### US-021 / FR-21 — Transcript và summary phiên học

- **AC-021-01**: Given session finish đủ evidence; When summary job chạy; Then transcript/summary có input hash/source, đọc đúng account.
- **AC-021-02**: Given summary provider fail hoặc actor ngoài scope; When xem summary; Then completion vẫn giữ, lỗi/forbidden rõ.
- **AC-021-03**: Given worker retry hoặc prompt version đổi; When xử lý lại; Then không duplicate transcript, run pin prompt/source version.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
