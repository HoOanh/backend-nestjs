# SPEC-01 — Content, tài liệu và giáo án

DRAFT 0.2 · S02/S03/S07/S10.

## 1. Model và trạng thái

Course: id/slug/title/description/category/status; Chapter: courseId/title/order; Lesson: chapterId/title/objectives/duration/publishedPackageId. CourseAssignment(accountId,courseId) và Enrollment biểu diễn quyền học. Roadmap gồm ordered milestones tham chiếu course/lesson. AuthoringWorkspace chứa working draft, không sửa published package.

SourceDocument có owner/scope/visibility/purpose; DocumentRevision có sha256/objectKey/mime/size/version/extractionVersion/status; AttachmentLink gắn course/lesson và vai trò reference/student-readable/author-only. Extraction pipeline: pending_upload→uploaded→validating→extracting→ready; lỗi→failed/quarantined/needs_ocr. PDF text, DOCX, Markdown, TXT thuộc allowlist ban đầu; tài liệu scan không đọc được phải hiển thị needs_ocr, không tạo text giả. Không tự thêm OCR service vào baseline.

SourceSpan chứa documentRevisionId/page nullable/sectionPath/charStart/charEnd/textHash; page chỉ tồn tại khi parser có page thật. DOCX không giữ pagination đáng tin thì citation dùng section/paragraph, không bịa page number. Extracted text giữ nguyên liên kết tới original, có parserVersion/language/warnings. Tài liệu dữ liệu cá nhân có visibility và redaction policy trước gửi provider.

TeachingPlanRevision có lessonRevisionId/schemaVersion/objectives/sections/slides/narration/checkpoints/sourceRefs/inputHash/provenance. Checkpoint question answer key private. NarrationScript có locale/voicePolicy/beat IDs; teaching objective phải có mapping tới explanation/visual/checkpoint, không chỉ một đoạn prose.

## 2. Proposed surface

| Endpoint | Semantic fields / constraints | Policy |
|---|---|---|
| I/courses, /chapters, /lessons, /roadmaps CRUD/reorder |slug scoped unique, parent FK, orderedIds đầy đủ + If-Match |content:* action/scope |
| POST I/documents/upload-tickets; POST I/documents/{id}/finalize |purpose/mime/size/sha256; signed PUT; finalize actual object check |documents:write, bounded size/type |
| POST I/documents/{id}/revisions; GET I/document-revisions/{id}/extraction |original object immutable, new revision + job; status/spans/warnings |documents:read/write đúng scope |
| POST I/lessons/{id}/attachments |documentRevisionId, visibility, usage |course/lesson owner scope và source usage permission |
| GET P/lessons/{id}/documents; GET .../{documentId}/download |learner-readable refs; signed original URL ngắn hạn |enrollment + publication pin + source visibility |
| POST I/lessons/{id}/plan-jobs |inputRevision/source refs/objectives/template/promptVersion, Idempotency-Key |ai:author và documents access, quota |
| POST I/plan-artifacts/{id}/apply |expectedDraftVersion/inputHash |Không auto merge khi stale;412 |
| PATCH I/teaching-plans/{id} |sections/scripts/checkpoints/sourceRefs + If-Match |mutable draft only, validation |

Upload limits đề xuất tài liệu20MiB/100pages, image10MiB; parser giới hạn CPU/RAM/text length/archive expansion. Values chờ D-03; vượt giới hạn trả413/validation có lý do. DOCX zip-bomb, external relationships và embedded content không được tự fetch. URL import không nằm R1 để tránh mở fetch arbitrary network.

## 3. AI và nguồn

Context builder chỉ lấy selected ready source revisions + lesson objectives. Text tài liệu là dữ liệu không tin cậy, không phải system prompt/tool instructions. R1 retrieval scoped lexical/section, budget theo task; không đưa toàn thư viện hoặc tài liệu của user khác vào prompt. Return plan draft + citation refs, missingSource report và generation metadata. Citation validator resolve ref/hash trước review; statement chưa có nguồn flag cần reviewer, không tự đưa thành facts đã xác minh.

Source update tạo revision mới và impact report các plan/package đang tham chiếu; published package không tự cập nhật. Editor tạo draft từ phiên bản mới, review lại before publish. Xóa source có active/published refs bị chặn; giữ tombstone/retention theo policy.

## 4. Nghiệm thu trọng yếu

Upload forged MIME/hash; parser timeout và file scan; DOCX page citation hợp lệ; source author-only không vào learner Q&A; AI input injection; duplicate extract/job; stale artifact apply; source đổi sau approval; failed extract không có trạng thái ready giả. Sample migrated c1-l1 dùng authored plan; bài khác needs_review, không copy một giáo án cho mọi bài.
