# S01 — Nền tảng ba repo phục vụ core

DRAFT 0.2 · Phase P01 · Release R1 · Gate chưa mở.

## Mục tiêu và đầu vào

Nền tảng ba repo phục vụ core. Phụ thuộc sprint: S00. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Repo arc-academy-backend, env/DB/storage/jobs/identity/action-scope/contracts và baseline audit.|
| arc-academy-cms |Vite/shadcn/router/query shell, staff auth/capability guard, generated client.|
| arc-academy-web |Next shell/student auth, server-safe/browser clients và lazy renderer boundary.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-004, US-005, US-006.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Setup3 repo sau G0: repo tên backend đúng và3build/test skeleton có evidence.
- Danh tính và quyền học theo phân công: session audience đúng, access/enrollment có audit.
- Contracts và module shell: diff sạch, CMS/Web type/build pass và route shell theo capability.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
