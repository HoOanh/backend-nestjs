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

## Execution contract 0.2.0 — S02 được mở 28/10/2026

Authorization: ĐẠI CA xác nhận mở P02/bắt đầu S02 và chốt D-03 phần giới hạn/quyền mặc định trong chat. Semantic draft phía trên được cụ thể hoá như sau; OpenAPI producer `arc-academy-backend/openapi/{internal,public}.json` là DTO/protocol thực thi.

- `POST I/courses`, `GET I/courses`, `GET I/courses/{id}`; `PUT I/courses/{id}/draft` cập nhật aggregate course/chapter/lesson, category metadata, objectives/duration. Arrays biểu diễn thứ tự, ID UUID ổn định; `deletedIds` phải xác nhận đầy đủ các node bỏ khỏi cây. Không chấp nhận thiếu ID như một reorder ngầm xoá. Slug course unique toàn catalog. Chapter/lesson IDs khác aggregate không được adopt. Category ở S02 là nhãn metadata, chưa có taxonomy CRUD riêng.
- Draft/archive/roadmap update/delete và attach/detach nhận `If-Match: "N"` từ version integer trong response JSON. Thiếu428, sai cú pháp400, stale412. Write và audit cùng transaction; course CAS serialize cả draft/attachment/publish. Archive giữ lịch sử, ẩn catalog và chặn learner access.
- Roadmaps CRUD qua I/roadmaps, ordered milestones tham chiếu course/lesson đúng scope; xoá lesson có roadmap reference bị chặn409. Editor quản lý course thuộc mình; admin global, reviewer đọc scope phục vụ independent review.
- `POST I/courses/{id}/publish-metadata`: cần content:lesson:publish, reviewer khác owner kể cả admin. Snapshot metadata và learner document pins bất biến trong DB. Đây chưa phải lecture/package publication của S04. Thay draft, gỡ link hoặc tạo source revision không sửa snapshot cũ. Public catalog chỉ đọc bản đã review; private course/source read cần assignment active.
- SourceDocument scoped theo course; revisions giữ version/hash/MIME/size/parserVersion. Ticket PUT5phút tới staging riêng; finalize kiểm actual bounded bytes, SHA-256 và MIME signature/UTF8, sau đó lưu verified object key bằng conditional PUT. Browser ticket không có quyền ghi key gốc. Replay finalize dùng cùng outbox key, không tạo job trùng. Signed download60giây, Content-Disposition attachment/octet-stream. Cấu hình S3 endpoint phải browser-reachable; bucket vẫn private.
- Allowlist TXT/MD/PDF/DOCX,1byte–20MiB; PDF tối đa100trang. Parser isolate128MiB old heap/32MiB young heap/15giây wall timeout; extracted text tối đa2triệu ký tự. DOCX tối đa1000entries, tổng expanded40MiB, mỗi entry10MiB và expansion ratio100; không dereference external relationship/entity. TXT/MD phải UTF8 và không binary. MD được hiển thị như plain text đã escape, không render HTML.
- Durable extraction dùng DB outbox lease60giây, atomic claim và lease comparison khi commit; reclaim khi worker/API chết. Transient dependency errors retry có giới hạn; malformed/timeout thể hiện failed, MIME/size/hash mismatch quarantined, image-only PDF needs_ocr. `POST I/document-revisions/{id}/retry` chỉ retry failed với original/parser version hiện hành. Nhiều API instances có thể dispatch nhưng mỗi lease chỉ một writer; không giữ transaction lúc đọc storage/parse.
- SourceSpan char offsets theo concatenated span text của revision; textHash SHA-256 từng span; PDF page thật, DOCX/MD/TXT page null + paragraph path. Completed revisions/spans/publication rows được DB trigger bảo vệ.
- `POST I/lessons/{id}/attachments` cần ready revision cùng course, visibility explicit author-only/student-readable; `DELETE I/attachments/{id}` gỡ working link nhưng giữ published pins. `DELETE I/documents/{id}` hiện trả409 và audit blocked: chưa có retention policy để xoá physical originals/history. Tạo revision mới để thay nguồn.
- CMS có scoped queries, validation VI/EN, autosave unsaved/saving/saved/offline/conflict, export draft khi stale, navigation blocker. Reviewer read-only metadata form + publish action; nguồn upload/extraction/view/download/attach/detach và roadmap create/edit/reorder/delete. Web catalog SSR và learner structure/source reader dùng generated public clients; learner download kiểm lại assignment/publication/visibility mỗi lần.
- Lists hiện bounded100records, chưa cursor pagination/search library lớn. Đây là pilot limitation cần xử lý trước corpus lớn. Không tự import40bài, bật AI/OCR hoặc publish nguồn thật.
- Migration thêm FK `course_assignment.courseId` dưới dạng PostgreSQL **NOT VALID**: mọi insert/update mới bắt buộc course thật; assignments lịch sử chưa có domain course được giữ nguyên. Không sinh khoá giả, không drop assignment cũ. Operator phải reconcile rồi mới VALIDATE constraint; không tuyên bố toàn bộ lịch sử đã sạch.
