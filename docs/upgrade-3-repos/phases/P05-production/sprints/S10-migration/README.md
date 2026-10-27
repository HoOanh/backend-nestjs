# S10 — Migration content, nguồn và dữ liệu học tập

DRAFT 0.2 · Phase P05 · Release R3 · Gate chưa mở.

## Mục tiêu và đầu vào

Migration content, nguồn và dữ liệu học tập. Phụ thuộc sprint: S07, S09. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **10–16 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |ETL dry-run/idempotent/report/FK/map/provenance; legacy archive boundaries; export/retention fingerprints.|
| arc-academy-cms |Migration exception review, data quality reports, content grandfather/needs_review và retention dry-run UI.|
| arc-academy-web |Legacy deep-link aliases/fragment bridge; hiển thị đúng provenance và tài liệu/quyền sau import.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-031, US-032, US-033.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Migration content/source/progress đầy đủ: 5courses/40 lesson baseline kiểm lại và không record trùng.
- URL legacy và read-only archive: đến bài/package hợp lệ hoặc thông báo archive rõ.
- Data ops và retention tài liệu/phiên: count/refs/cutoff/policy fingerprint có report.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
