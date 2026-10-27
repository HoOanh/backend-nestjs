# S03 — Giáo án và AI soạn bài từ content

DRAFT 0.2 · Phase P02 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Giáo án và AI soạn bài từ content. Phụ thuộc sprint: S02. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |TeachingPlanRevision/schema/objective-source mapping; AI plan job/prompt/quota reservation; lint/review decisions.|
| arc-academy-cms |Plan editor sections/script/checkpoints, nguồn trích dẫn, AI draft diff/apply và review queue.|
| arc-academy-web |Preview read model cho sections/narration/checkpoints và source citation navigation.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-010, US-011, US-012.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Biên soạn giáo án có cấu trúc: objective→script→visual intent→checkpoint trace được.
- AI dựng giáo án từ content và nguồn: artifact schema-valid có prompt/model/input hash và citation.
- Review giáo án và kiến thức: decision gắn hash và human findings disposition.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
