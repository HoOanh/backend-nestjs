# S08 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-03](../../../../specs/03-CLASSROOM-AI.md) là invariant dùng chung.

## Dữ liệu và semantic contract

ExplanationRun objective/source/prompt pins; EvaluationFinding; LearningInsight aggregate/no raw transcript leak.

## Endpoint/protocol hoặc deliverable thiết kế

P/classroom/sessions/{id}/explanations; I/ai/reviews; I/learning-insights scoped aggregate; prompt version rollback theo quyền.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-025 / FR-25 — Giải thích thích ứng theo objective

- **AC-025-01**: Given checkpoint đang học và source được phép; When yêu cầu giải thích khác; Then AI dùng approved objective/visual schema và đưa check-understanding.
- **AC-025-02**: Given AI muốn tự thay plan/pass checkpoint; When trả adaptive response; Then không sửa published package hoặc tự pass.
- **AC-025-03**: Given kết thúc trao đổi phụ; When resume lecture; Then quay lại beat gốc đúng version.

### US-026 / FR-26 — Đánh giá grounding và prompt rollback

- **AC-026-01**: Given fixture objective/source/answer có kỳ vọng; When chạy review evaluation; Then findings groundedness và severity có evidence refs.
- **AC-026-02**: Given citation sai revision hoặc không resolve; When validate answer; Then flag/reject, không expose nguồn giả.
- **AC-026-03**: Given prompt mới chất lượng giảm; When rollback active pointer; Then run cũ giữ version, run mới dùng version đã duyệt.

### US-027 / FR-27 — Insights học tập để cải thiện bài giảng

- **AC-027-01**: Given có sessions được cấp scope; When mở insights; Then aggregate questions/dropoff/summary theo objective.
- **AC-027-02**: Given ít dữ liệu hoặc actor ngoài scope; When query analytics; Then không khẳng định kết quả học chưa có bằng chứng, không leak transcript.
- **AC-027-03**: Given event dedup/reprocess; When rebuild projection; Then insight không đếm trùng hoặc đổi nguồn lịch sử.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
