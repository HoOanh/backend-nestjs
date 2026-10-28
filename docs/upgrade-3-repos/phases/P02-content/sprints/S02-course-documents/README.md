> 28/10/2026: ĐẠI CA đã mở P02/bắt đầu S02. Trạng thái thực thi và giới hạn tại [S02 report](../../../../implementation/S02-REPORT.md). Các ghi chú draft/gate cũ phía dưới là lịch sử baseline.

# S02 — Dữ liệu khoá học, bài và tài liệu nguồn

DRAFT 0.2 · Phase P02 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Dữ liệu khoá học, bài và tài liệu nguồn. Phụ thuộc sprint: S01. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Course/chapter/lesson/category/roadmap CRUD, assignment, asset/document revisions, extract jobs/source spans.|
| arc-academy-cms |Course tree, lesson metadata, document library/upload/extract status/scope và source viewer.|
| arc-academy-web |Catalog/course structure và learner-readable attached document viewer.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-007, US-008, US-009.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Setup khoá/chương/bài/lộ trình: ID/slug/order/ref đúng và Web đọc published metadata.
- Đính kèm tài liệu theo scope: original hash/version/visibility và usage refs được lưu.
- Trích xuất và truy nguồn tài liệu: spans/parserVersion/warnings resolve về original revision.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
