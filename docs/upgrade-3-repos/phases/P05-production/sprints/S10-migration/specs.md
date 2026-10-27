# S10 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-05](../../../../specs/05-MIGRATION-QUALITY.md) là invariant dùng chung.

## Dữ liệu và semantic contract

MigrationManifest/sourceHash/transformVersion; LegacyMap; ExceptionReport; RetentionPlan fingerprint/cutoff/refs.

## Endpoint/protocol hoặc deliverable thiết kế

Operator import CLI thiết kế (chưa thực thi); I/migration-reports/read/resolve; I/exports/retention dry-run; Web legacy alias resolution.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-031 / FR-31 — Migration content/source/progress đầy đủ

- **AC-031-01**: Given snapshot freeze và scope duyệt; When dry-run/import2lần; Then 5courses/40 lesson baseline kiểm lại và không record trùng.
- **AC-031-02**: Given ID/FK/email/source refs xung đột; When ETL chạy; Then exception report/quarantine rõ, không silently drop.
- **AC-031-03**: Given localStorage-only progress/legacy result; When đối soát; Then giữ provenance/giới hạn bảo toàn, không tự verified.

### US-032 / FR-32 — URL legacy và read-only archive

- **AC-032-01**: Given legacy route được map; When mở deep link; Then đến bài/package hợp lệ hoặc thông báo archive rõ.
- **AC-032-02**: Given hash fragment server không thấy; When resolve old URL; Then client bridge đúng, không giả301 mọi link.
- **AC-032-03**: Given legacy feature ngoài core chưa có replacement; When cutover scope review; Then archive/read-only policy được duyệt, không mất âm thầm.

### US-033 / FR-33 — Data ops và retention tài liệu/phiên

- **AC-033-01**: Given export/retention quyền hợp lệ; When preview scope; Then count/refs/cutoff/policy fingerprint có report.
- **AC-033-02**: Given asset/source đang published dùng hoặc fingerprint cũ; When execute purge; Then bị chặn cần review/repreview.
- **AC-033-03**: Given retry export/purge batch; When reconcile; Then idempotent, signed download expires, audit redact.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
