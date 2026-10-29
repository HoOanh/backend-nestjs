> Chỉ đạo29/10/2026: đã merge/push S02; bắt đầu US-010/S03 theo [execution contract](../../../../implementation/S03-REPORT.md). US-011/012 chưa triển khai trong lát cắt này; các gate lịch sử bên dưới được giữ để đối chiếu.

# S03 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md) là invariant dùng chung.

## Dữ liệu và semantic contract

TeachingPlanRevision objectives/sections/scripts/checkpoints/sourceRefs/inputHash; AiRun/Artifact/PromptVersion/QuotaReservation; ReviewDecision.

## Endpoint/protocol hoặc deliverable thiết kế

I/lessons/{id}/plan-jobs; I/ai/jobs/{id}; I/plan-artifacts/{id}/apply If-Match; I/teaching-plans/{id} PATCH; submit-review/approve/reject gắn hash.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-010 / FR-10 — Biên soạn giáo án có cấu trúc

- **AC-010-01**: Given lesson/source ready; When soạn giáo án; Then objective→script→visual intent→checkpoint trace được.
- **AC-010-02**: Given dangling source hoặc checkpoint schema sai; When lint; Then error có ref/block/rule cụ thể.
- **AC-010-03**: Given editor khác đã lưu; When autosave ETag cũ; Then 412, không overwrite buffer người soạn.

### US-011 / FR-11 — AI dựng giáo án từ content và nguồn

- **AC-011-01**: Given budget/source được phép; When chạy authoring job; Then artifact schema-valid có prompt/model/input hash và citation.
- **AC-011-02**: Given source chứa instruction injection hoặc chưa cấp quyền; When build context; Then không cấp tool/quyền mới, không dùng source ngoài scope.
- **AC-011-03**: Given provider timeout hoặc apply stale; When retry/reconcile; Then usage unknown hoặc412 rõ, không auto publish/double apply.

### US-012 / FR-12 — Review giáo án và kiến thức

- **AC-012-01**: Given draft có đủ objective/source/lint; When review/approve; Then decision gắn hash và human findings disposition.
- **AC-012-02**: Given AI bịa nguồn hoặc author tự duyệt trái policy; When approve; Then bị chặn hoặc cần xử lý findings theo quyền.
- **AC-012-03**: Given draft đổi sau approval; When đi publish; Then approval cũ không còn đủ điều kiện.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
