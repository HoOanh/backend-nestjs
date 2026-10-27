# S00 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-04](../../../../specs/04-PLATFORM-CONTRACTS.md); [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md) là invariant dùng chung.

## Dữ liệu và semantic contract

ApprovalRecord artifact/version/hash/scope/decision; SkillManifest name/source/ref/license/targetRepo/status.

## Endpoint/protocol hoặc deliverable thiết kế

Không có endpoint triển khai. Review baseline, sprint specs và skill format; G0 vẫn đóng đến khi ĐẠI CA duyệt.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-001 / FR-01 — Duyệt baseline và sprint scope

- **AC-001-01**: Given hồ sơ0.2 đầy đủ; When review từng artifact; Then ghi decision/version/scope; không tự mở G0 khi còn Pending.
- **AC-001-02**: Given chưa có duyệt đủ; When yêu cầu setup từ tài liệu; Then không chạy setup/code và nêu artifact còn thiếu.
- **AC-001-03**: Given scope thay đổi; When cập nhật hồ sơ; Then trace stories/specs/sprints và xin duyệt phần thay đổi.

### US-002 / FR-02 — Chuẩn hoá rule trước setup

- **AC-002-01**: Given rule templates đã soạn; When review TS/format/boundaries/workflow; Then có owner và enforcement plan, chưa có config executable.
- **AC-002-02**: Given rule khác chỉ đạo ĐẠI CA; When áp dụng precedence; Then giữ chỉ đạo ĐẠI CA và sửa template.
- **AC-002-03**: Given rule chung thay đổi; When đồng bộ manifest3 repo; Then version/hash được cập nhật, không âm thầm lệch.

### US-003 / FR-03 — Chọn và soạn skills cho core

- **AC-003-01**: Given local/official sources đã đọc; When soạn5 skill draft; Then frontmatter/reference/scope hợp lệ và không auto install.
- **AC-003-02**: Given external skill chưa pin hoặc có quyền ngoài scope; When review nguồn; Then không cài chỉ vì phổ biến.
- **AC-003-03**: Given skill sửa activation/reference; When validate lại; Then không broken link hoặc mở quyền code khi chưa duyệt.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
