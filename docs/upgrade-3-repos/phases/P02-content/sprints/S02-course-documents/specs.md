# S02 — specs lát cắt

DRAFT 0.2 · Pending approval · [SPEC-01](../../../../specs/01-CONTENT-DOCUMENTS.md) là invariant dùng chung.

## Dữ liệu và semantic contract

Course/Chapter/Lesson/AttachmentLink, SourceDocument/DocumentRevision/SourceSpan; MIME/hash/parser/version/visibility/state.

## Endpoint/protocol hoặc deliverable thiết kế

I/courses/chapters/lessons/roadmaps CRUD+reorder If-Match; I/documents upload-tickets/finalize/revisions/extraction; P/lessons/{id}/documents.

## Quyền và consistency

Actor từ session; action+scope+assignment/resource state ở backend. Draft dùng If-Match; published/source revisions immutable. Tác vụ dài dùng durable job/outbox/idempotency; không giữ DB transaction chờ provider. Student read model không answer keys hoặc private sources. Với S00, các mục này là nội dung phải review, chưa có API/code triển khai.

## Trường hợp nghiệm thu của sprint

### US-007 / FR-07 — Setup khoá/chương/bài/lộ trình

- **AC-007-01**: Given editor có quyền; When tạo/reorder course/chapter/lesson/roadmap; Then ID/slug/order/ref đúng và Web đọc published metadata.
- **AC-007-02**: Given slug trùng hoặc reorder thiếu ID; When lưu thay đổi; Then validation chặn và không mất cây nội dung.
- **AC-007-03**: Given hai editor reorder cùng version; When gửi If-Match cũ; Then 412, giữ draft để reconcile.

### US-008 / FR-08 — Đính kèm tài liệu theo scope

- **AC-008-01**: Given tài liệu allowlist và quyền hợp lệ; When upload/finalize/attach; Then original hash/version/visibility và usage refs được lưu.
- **AC-008-02**: Given file MIME/size sai hoặc source ngoài scope; When finalize/attach; Then reject/quarantine, không cho student đọc.
- **AC-008-03**: Given document có published ref; When yêu cầu xóa/replace; Then không phá snapshot, tạo revision hoặc impact report.

### US-009 / FR-09 — Trích xuất và truy nguồn tài liệu

- **AC-009-01**: Given PDFtext/DOCX/MD/TXT hỗ trợ; When extract; Then spans/parserVersion/warnings resolve về original revision.
- **AC-009-02**: Given PDFscan/zipbomb/parser timeout; When extract; Then needs_ocr/failed/quarantined rõ, không fake ready/text.
- **AC-009-03**: Given job extract retry; When xử lý cùng input/hash/version; Then không tạo spans/revisions trùng hoặc bịa page DOCX.

## Trước khi implementation

Refine field constraints/examples, permission keys và fixture cụ thể trong phạm vi này để ĐẠI CA duyệt; không tự bổ sung business rule trong code. S00 chỉ tạo/refine tài liệu/rules/skills draft. Các cấu hình/test/source implementation phải chờ G0 và sprint approval.
