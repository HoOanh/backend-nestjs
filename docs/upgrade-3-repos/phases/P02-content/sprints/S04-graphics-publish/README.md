> Cập nhật29/10/2026: S04 được mở theo chỉ đạo “push đi nhé rồi mở next step”. US-013 đã có backend typed revision, CMS visual editor và Web renderer/preview8 kind (AC-013-03 partial vì package thuộc US-015). US-014 đã có backend beat schema/lint, CMS beat editor và Web narration clock (clock mô phỏng, chưa nối TTS thật). US-015 chưa làm; S04 chưa đóng.

# S04 — Bài giảng đồ hoạ, preview và xuất bản

DRAFT 0.2 · Phase P02 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Bài giảng đồ hoạ, preview và xuất bản. Phụ thuộc sprint: S03. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **14–22 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Typed visual schema/media refs/beats, publication package, preview exchange và cache invalidation outbox.|
| arc-academy-cms |Visual editor cơ bản, diagrams/ảnh/storyboard, narration/focus cues, preview/review/publish.|
| arc-academy-web |Renderer shared, preview đúng snapshot, student lesson read/captions/alt và source projection.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-02](../../../../specs/02-GRAPHICS-LECTURES.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-013, US-014, US-015.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Đồ hoạ giảng dạy có semantic schema: labels/relations/source/alt/rendererVersion được validate.
- Đồng bộ narration với bảng/focus: reveal/draw/highlight theo narration clock.
- Preview/review/publish lecture package: immutable package pins refs, audit/outbox và Web renderer đúng.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
