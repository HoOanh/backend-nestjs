# S09 — Lớp, lịch và mentor theo dõi1-1

DRAFT 0.2 · Phase P04 · Release R2 · Gate chưa mở.

## Mục tiêu và đầu vào

Lớp, lịch và mentor theo dõi1-1. Phụ thuộc sprint: S06. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **10–16 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Class/roster/occurrences/timezone/mentor scopes; module configuration/dependency/drain và reminder in-app tối thiểu.|
| arc-academy-cms |Tạo lớp/roster/lịch, assigned session dashboard/summary/transcript permissions, module settings core.|
| arc-academy-web |My classes/schedule join vào session cá nhân, resume và thông báo lịch trong app.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-03](../../../../specs/03-CLASSROOM-AI.md); [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-028, US-029, US-030.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Cohort/roster/lịch AI 1-1: occurrenceUTC và một primary session/student.
- Mentor dashboard đúng assignment: progress/summary trong scope, transcript có quyền riêng+audit.
- Module settings phục vụ content/classroom: validate version và capability/menu nhất quán.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
