# S11 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md) là invariant dùng chung.

## Dữ liệu và semantic contract

ReleaseManifest image/schema/contracts/config hash; BackupManifest DB/media/keys; UAT/RestoreReport; CutoverWatermark.

## Endpoint/protocol hoặc deliverable thiết kế

healthz/readyz/metrics nội bộ, operational runbooks; rehearsal→freeze→snapshot→import→read-only smoke→approve→new write; no blind reverse to legacy JSON.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-034 / FR-34 — Core UAT/performance/browser readiness

- **AC-034-01**: Given staging workload/fixture duyệt; When chạy authoring→graphics→AI 1-1→resume UAT; Then AC/perf/a11y/isolation có evidence và hardware context.
- **AC-034-02**: Given Safari/STT/ONNX/provider lỗi; When fallback smoke; Then text/chat vẫn học được, trạng thái degraded rõ.
- **AC-034-03**: Given test có flaky provider/timing; When phân tích failure; Then tách deterministic fixture và real smoke, không bỏ test để giả pass.

### US-035 / FR-35 — Backup/restore và vận hành core

- **AC-035-01**: Given off-host backup/keys available; When restore blank environment; Then RPO/RTO đo thực, citations/assets/session refs kiểm đúng.
- **AC-035-02**: Given Redis hoặc AI provider outage; When reconcile/degrade; Then outbox/jobs durable, theory/documents không mất.
- **AC-035-03**: Given daily dump chưa có PITR; When review RPO 15m; Then không claim15m, đổi strategy/target trước approve.

### US-036 / FR-36 — Cutover production có cửa sổ ghi rõ

- **AC-036-01**: Given UAT/exceptions/runbooks đã ký; When freeze/import/read-only smoke; Then mở ghi mới chỉ sau approve, ghi watermark.
- **AC-036-02**: Given fail trước mở ghi mới; When rollback routing; Then MVP cùng snapshot không mất write.
- **AC-036-03**: Given sự cố sau mở ghi mới; When incident response; Then roll-forward hoặc read-only/reconcile, không quay JSON cũ mù.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
