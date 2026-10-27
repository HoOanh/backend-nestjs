# S07 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md); [SPEC-02](../../../../specs/02-GRAPHICS-LECTURES.md) là invariant dùng chung.

## Dữ liệu và semantic contract

VisualPreset version/renderer support; ImageArtifact provenance/asset; SourceImpact affectedPackage/refs/changeSeverity.

## Endpoint/protocol hoặc deliverable thiết kế

I/visual-presets; I/ai/image-jobs/status/apply; I/document-revisions/{id}/impact; I/plan-artifacts apply fork giữ source version.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-022 / FR-22 — Visual studio nâng cao

- **AC-022-01**: Given preset/schema được duyệt; When scrub/edit và preview; Then CMS/Web cùng rendererVersion và semantic content.
- **AC-022-02**: Given preset không hỗ trợ hoặc reduced motion; When render; Then báo lỗi/fallback giữ kiến thức, không mất nội dung.
- **AC-022-03**: Given visual được chỉnh khi phiên active; When publish mới; Then phiên cũ không bị thay đổi.

### US-023 / FR-23 — AI tạo ảnh minh hoạ có review

- **AC-023-01**: Given task/image capability và budget hợp lệ; When generate image; Then artifact có prompt/model/source/rights và alt draft.
- **AC-023-02**: Given ảnh có chữ kỹ thuật sai hoặc asset chưa ready; When review/publish; Then không tự publish, yêu cầu sửa/reject.
- **AC-023-03**: Given job cancel/retry sau provider charge; When settle usage; Then không giả phí0 hoặc tạo bản apply trùng.

### US-024 / FR-24 — Cập nhật nguồn có impact review

- **AC-024-01**: Given document có revision mới; When xem impact; Then liệt kê package/plan/visual refs và tạo draft fork.
- **AC-024-02**: Given revision mới chưa extract ready; When regenerate plan; Then bị chặn hoặc dùng nguồn cũ rõ ràng theo lựa chọn.
- **AC-024-03**: Given session đang pin nguồn cũ; When source mới publish; Then còn resolve citation cũ, không rewrite history.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
