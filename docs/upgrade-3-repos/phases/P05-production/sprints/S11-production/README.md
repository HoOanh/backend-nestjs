# S11 — Nghiệm thu core và chuyển production

DRAFT 0.2 · Phase P05 · Release R3 · Gate chưa mở.

## Mục tiêu và đầu vào

Nghiệm thu core và chuyển production. Phụ thuộc sprint: S08, S10. Entry: dependency đạt exit gate và specs/stories của sprint này được ĐẠI CA duyệt; S00 chỉ review tài liệu, không implementation.

Effort đề xuất **12–18 person-days**, không phải số ngày lịch hoặc cam kết sprint2 tuần. Owner cần có: developer phụ trách Backend/CMS/Web, content reviewer; operator cho việc vận hành. Chưa chỉ định người thật.

## Scope theo repo

| Repo | Công việc trong sprint |
|---|---|
| arc-academy-backend |Load/security/backup/restore/outbox reconcile/release manifest; cutover writer freeze và post-write incident runbook.|
| arc-academy-cms |UAT whole authoring chain, permissions/a11y, evidence dashboard và operational handover.|
| arc-academy-web |Real browser/perf/isolation/a11y/TTS-STT fallback/UAT class1-1, final cutover smoke.|

## Hồ sơ sprint

- [Specs lát cắt](specs.md), dùng kèm [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md).
- [Stories JSON đầy đủ của sprint](user-stories.json): US-034, US-035, US-036.
- Scope/story nguồn chuẩn: [JSON toàn dự án](../../../../user-stories.json); chưa approve/implement mục nào.

## Demo và exit gate

- Core UAT/performance/browser readiness: AC/perf/a11y/isolation có evidence và hardware context.
- Backup/restore và vận hành core: RPO/RTO đo thực, citations/assets/session refs kiểm đúng.
- Cutover production có cửa sổ ghi rõ: mở ghi mới chỉ sau approve, ghi watermark.

Bắt buộc kiểm negative/retry/version scenarios trong JSON; có evidence AC ID, cập nhật contract/schema/reference và release compatibility nếu liên quan. Reviewer kiểm nguồn/semantic graphics, không chỉ build xanh. Ghi not_executed cho checks chưa chạy. Exit sprint không tự cho phép setup/code sprint sau khi specs sprint sau chưa được duyệt.
