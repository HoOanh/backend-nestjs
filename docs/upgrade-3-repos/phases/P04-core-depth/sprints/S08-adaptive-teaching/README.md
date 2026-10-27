# S08 — Giải thích thích ứng và phân tích phiên học

DRAFT 0.2 · Phase P04 · Release R2 · Gate chưa mở.

## Mục tiêu và đầu vào

Giải thích thích ứng và phân tích phiên học. Phụ thuộc sprint: S07. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Adaptive explanation context/policy, citation validation/evaluation, confusion insights và prompt rollback.|
| arc-academy-cms |Review rubric, question/citation/error panels; insights theo objective, draft improvements từ feedback.|
| arc-academy-web |Alternate explanation/visual theo objective, hỏi kiểm tra hiểu, quay lại đúng beat; citations truy nguồn.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-03](../../../../specs/03-CLASSROOM-AI.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-025, US-026, US-027.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Giải thích thích ứng theo objective: AI dùng approved objective/visual schema và đưa check-understanding.
- Đánh giá grounding và prompt rollback: findings groundedness và severity có evidence refs.
- Insights học tập để cải thiện bài giảng: aggregate questions/dropoff/summary theo objective.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
