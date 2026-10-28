> 28/10/2026: ĐẠI CA đã xác nhận mở P02/bắt đầu S02 và chốt default tài liệu. Xem [S02 report](S02-REPORT.md); giới hạn foundation-only phía dưới đã được thay bởi chỉ đạo mới.

> Chỉ đạo mới 28/10/2026: tiếp tục hardening nền tảng; chưa mở S02. Xem [Foundation quality](FOUNDATION-QUALITY.md). Nội dung handoff bên dưới là lịch sử chuẩn bị.

# Đầu vào S02

Ngày 28/10/2026 · Bám [S02](../phases/P02-content/sprints/S02-course-documents/README.md) và [SPEC-01](../specs/01-CONTENT-DOCUMENTS.md).

1. Tạo domain Course/Chapter/Lesson/Category/Roadmap đúng schema/version/order; nối CourseAssignment.courseId vào FK thật và thêm negative test course không tồn tại. Không lấy UUID fixture S01 làm dữ liệu curriculum; phải đối soát assignment dev cũ trước thêm constraint, không tự drop dữ liệu không xác định nguồn.
2. Document original/revision/hash/scope/attachment; MinIO private upload/finalize, actual size/MIME/hash checks. Extraction jobs/state/spans/citation theo source type đã duyệt; scanned PDF needs_ocr, không giả text/page.
3. CMS course tree/metadata/document library/viewer, form autosave/If-Match/conflict; Web published metadata/learner-readable document projection.
4. Giữ consumer client generation đúng envelope, actor scope, source visibility và API authorization. Update migration/specs/Bruno/contracts cùng feature; không mang pricing/plan logic vào course access.
5. Dữ liệu MVP dùng fixture authored c1-l1 và một bài chủ đề khác để kiểm schema; chưa full migration40 bài trước phase migration.

Thông tin nghiệp vụ cần xác nhận khi đụng tới quyết định tương ứng: giới hạn tài liệu cụ thể, confidentiality/retention policy và source-rights; không tự bật OCR, external URL fetching, AI provider hoặc xuất bản dữ liệu chưa review. Google credentials là cấu hình tách biệt, không chặn xây domain content.


Nền tảng hiện hành sau review: CMS file-based route, VI/EN xuyên UI/API/email, logo/palette MVP và frontend-design. Không dùng lại layout/logo/palette scaffold cũ. Thêm màn hình S02 phải có đủ translation resources, runtime API projection, permissions, empty/loading/error/conflict states và qua `product:check`; xem [Foundation rework](FOUNDATION-REWORK.md).
