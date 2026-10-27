# S00 — Chốt sản phẩm, specs và bộ chuẩn

DRAFT 0.2 · Phase P00 · Release trước implementation · Gate chưa mở.

## Mục tiêu và đầu vào

Chốt sản phẩm, specs và bộ chuẩn. Phụ thuộc sprint: chỉ đạo sản phẩm hiện tại. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **4–7 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Chỉ thiết kế module/data/contracts và compatibility matrix; chưa tạo source/config.|
| arc-academy-cms |Duyệt workflow authoring/permissions/editor và rule templates.|
| arc-academy-web |Duyệt renderer/classroom/fallback và rule templates.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md); [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-001, US-002, US-003.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Duyệt baseline và sprint scope: ghi decision/version/scope; không tự mở G0 khi còn Pending.
- Chuẩn hoá rule trước setup: có owner và enforcement plan, chưa có config executable.
- Chọn và soạn skills cho core: frontmatter/reference/scope hợp lệ và không auto install.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
