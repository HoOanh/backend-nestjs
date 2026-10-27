# S06 — Trao đổi AI, checkpoint và resume đa thiết bị

DRAFT 0.2 · Phase P03 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Trao đổi AI, checkpoint và resume đa thiết bị. Phụ thuộc sprint: S05. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Instructor SSE/source scope/quota, server quiz grader/progress provenance, transcript/summary async.|
| arc-academy-cms |Giám sát phiên và review câu trả lời/citation, cấu hình prompt/quota tối thiểu, xem summary có quyền.|
| arc-academy-web |Contextual chat/STT/raise-hand, answer citations, reconnect/cancel, checkpoint quiz/resume/progress/summary.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-03](../../../../specs/03-CLASSROOM-AI.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-019, US-020, US-021.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Hội thoại AI theo checkpoint và nguồn: SSE answer/citations bám pinned objective/checkpoint.
- Checkpoint và tiến trình có evidence: server chấm và lưu progress provenance.
- Transcript và summary phiên học: transcript/summary có input hash/source, đọc đúng account.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
