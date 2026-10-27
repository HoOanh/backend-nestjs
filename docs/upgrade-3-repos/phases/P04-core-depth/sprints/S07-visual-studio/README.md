# S07 — Visual studio và giáo án có vòng đời nguồn

DRAFT 0.2 · Phase P04 · Release R2 · Gate chưa mở.

## Mục tiêu và đầu vào

Visual studio và giáo án có vòng đời nguồn. Phụ thuộc sprint: S06. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Visual timeline validation/presets, image jobs/provenance, source-impact diff và draft regeneration.|
| arc-academy-cms |Timeline scrub/focus layout, versioned3D presets, AI image draft/review, source update impact panel.|
| arc-academy-web |Renderer hỗ trợ approved presets, deterministic preview/scrub và fallback text/reduced motion.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md); [SPEC-02](../../../../specs/02-GRAPHICS-LECTURES.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-022, US-023, US-024.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Visual studio nâng cao: CMS/Web cùng rendererVersion và semantic content.
- AI tạo ảnh minh hoạ có review: artifact có prompt/model/source/rights và alt draft.
- Cập nhật nguồn có impact review: liệt kê package/plan/visual refs và tạo draft fork.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
