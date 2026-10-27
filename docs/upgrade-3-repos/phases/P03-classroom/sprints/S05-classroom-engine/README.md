# S05 — Room và engine AI 1-1 có state bền vững

DRAFT 0.2 · Phase P03 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Room và engine AI 1-1 có state bền vững. Phụ thuộc sprint: S04. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **16–24 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Room versions/session single writer/lease/events/checkpoint state; entitlement bằng assignment.|
| arc-academy-cms |Room/persona/voice/checkpoint policy config và preview phiên.|
| arc-academy-web |Port narration/ink/focus/3D, preparation/raise-hand/pause/resume, text/server-TTS fallback và resource cleanup.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-03](../../../../specs/03-CLASSROOM-AI.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-016, US-017, US-018.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Room AI có phiên bản: pin package/persona/policy và học viên được gán vào được.
- Engine giảng/vẽ/voice có fallback: narration/ink/focus pause và resume đúng beat.
- Session durable và single writer: resume đúng snapshot/checkpoint/lastAck.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
