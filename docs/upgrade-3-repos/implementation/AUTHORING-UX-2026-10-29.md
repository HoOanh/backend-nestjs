# Nâng cấp UX biên soạn khoá học & giáo án — 29/10/2026

ĐẠI CA phản hồi: module khoá học khó dùng/khó hiểu, bài đã soạn không thấy cách xem lại hay sửa (chỉ thấy nút thêm), soạn giáo án rườm rà. ĐẠI CA chốt hướng **Outline + Sheet** cho khoá học, **AI-first, dàn ý 3 cột** cho giáo án, cho phép thêm API backend; sau đó yêu cầu làm tiếp kéo-thả, mobile, danh sách khoá học và tài liệu. Đây là nâng cấp UX trên US-007/US-010/US-011 đã có, không đổi AC, không mở US-012. Chưa commit.

## Nguyên nhân đã xác nhận trong source

- `CourseEditorPage` render mọi chương/bài thành form mở sẵn (tên, mục tiêu dạng textarea mỗi dòng một mục, thời lượng) trên một trang dài; không có điểm "mở bài để xem/sửa", nên người dùng chỉ nhận ra nút Thêm.
- Nút "Soạn giáo án" bị ẩn khi `dirty` hoặc bài chưa lưu (`!dirty && knownIds.has(id)`); autosave 900ms khiến nút chớp tắt.
- Giáo án không có menu cấp cao (`teachingPlansModule.navigation = []`, cố ý) và danh sách bài không hiển thị trạng thái giáo án vì backend chưa có read model theo khoá.
- `PlanEditorPage` dồn ngôn ngữ, mục tiêu, nguồn, panel AI (model, chọn nguồn, xác nhận, lịch sử, provenance, so sánh), phần giảng, checkpoint, kết quả lint và nhập JSON trên một trang. AI chỉ dùng được sau khi tác giả tự thêm từng span vào "Nguồn trích dẫn".
- Danh sách khoá học là table `min-w-[42rem]` (cuộn ngang trên mobile); toggle "khoá lưu trữ" là UI chết vì `GET /courses` lọc `archived: false`.
- Xoá bài đã có giáo án bị backend chặn 409 nhưng UI chỉ hiện lỗi lưu chung chung.

## Backend (arc-academy-backend)

| Endpoint | Quyền | Mô tả |
|---|---|---|
| `GET /api/i/v1/courses/:id/teaching-plans` | `content:lesson:read` + ownership (reviewer đọc được) | Tóm tắt giáo án theo bài: planId, version, sectionCount, checkpointCount, findingCount, updatedAt. Finding tính cùng rule với `read()` (lint + source availability + lesson_changed) nhưng gom query theo khoá, không N+1. |
| `GET /api/i/v1/teaching-plans/coverage` | `content:lesson:read` | Số bài có giáo án theo khoá, cùng phạm vi với `ContentService.list` (admin/reviewer: tất cả, editor: khoá sở hữu, bỏ khoá lưu trữ). |

Không đổi schema/migration. OpenAPI internal export lại (56 paths), CMS codegen đồng bộ, Bruno 87 operations. E2E `test/teaching-plans.e2e-spec.ts` thêm case: 401/404 theo ownership, reviewer đọc được, findingCount khớp `lookup` khi gỡ attachment, coverage không lộ khoá của người khác.

## CMS (arc-academy-cms)

**Danh sách khoá học** — card responsive thay table: tiêu đề, chủ đề, mô tả 1 dòng, số chương/bài/phút, thanh tiến độ giáo án (`role=progressbar`). Thống kê tổng (khoá, bài, % bài có giáo án), lọc chủ đề, sắp xếp (mới tạo, tên, ít giáo án nhất), skeleton khi tải. Bỏ toggle lưu trữ chết.

**Khoá học** — tab *Chương & bài học / Thông tin / Tài liệu nguồn*.
- Outline: mỗi bài là một dòng (số thứ tự, tên, phút, badge giáo án, nút Soạn/Mở giáo án, menu ⋯). Thêm bài/chương bằng gõ tên + Enter. Đổi tên chương inline.
- Bấm bài → Sheet: tên, thời lượng, mục tiêu từng ô (thêm/xoá), tài liệu đã gắn, tóm tắt giáo án, Xem trước, Soạn/Mở giáo án.
- Kéo-thả (`@dnd-kit/core` 6.3.1, `sortable` 10.0.0, `utilities` 3.2.2): kéo chương, kéo bài trong chương và sang chương khác (backend upsert cập nhật `chapterId/position`, không có unique position). Kéo bằng tay nắm riêng, có DragOverlay, bàn phím (Space/mũi tên/Space/Escape) và announcements VI/EN. Kéo chỉ đổi preview cục bộ, thả mới commit một lần vào draft → autosave. Menu Lên/Xuống giữ làm phương án thay thế.
- Mở giáo án luôn khả dụng: chờ lượt autosave đang chạy, lưu phần còn dirty rồi điều hướng (ref, không closure cũ). Lưu thất bại thì ở lại, giữ bản nháp.
- Xoá có AlertDialog; xoá bài/chương có giáo án bị khoá trong UI kèm lý do; 409 hiển thị thông điệp riêng. Lưu trữ khoá đưa vào menu ⋯ có xác nhận.
- Tài liệu nguồn: 2 cột (upload/danh sách/liên kết | nội dung trích xuất).

**Giáo án**
- Chưa có giáo án: hai lựa chọn *Tạo bằng AI từ tài liệu* / *Tự soạn*; chọn AI thì tạo plan và mở ngay panel AI.
- Desktop: dàn ý trái (Mục tiêu, phần giảng kèm số lỗi, Thêm phần, Nguồn, Kết quả kiểm tra) + nội dung phần đang chọn. Mobile: thanh dính *Phần trước · dàn ý · Phần sau*, dàn ý mở bằng Sheet trái.
- Phần giảng: tiêu đề lớn tự xuống dòng, lời giảng có bộ đếm, chip mục tiêu/nguồn, gợi ý đồ hoạ, câu hỏi dạng card (câu hỏi, đáp án, giải thích, nguồn).
- AI (Sheet): chọn tài liệu theo file hoặc từng đoạn (mặc định nguồn đã có, nếu chưa có thì tất cả), model mặc định của server, checkbox xác nhận gửi nguồn, nút Tạo. Đoạn chọn chưa có trong giáo án được thêm vào `sourceRefs` và lưu revision trước khi tạo job — If-Match/Idempotency-Key/pinned version giữ nguyên. Kết quả: badge trạng thái, tab Đề xuất/Bản trước, findings, Áp dụng; provenance trong dialog.
- Lỗi lint mở trong Sheet, bấm để nhảy tới phần/câu hỏi. Kiểm tra lại, ngôn ngữ, xuất/nhập JSON gom vào menu ⋯.
- Xoá mục tiêu/nguồn tự gỡ tham chiếu trong phần/câu hỏi (không sinh `dangling_ref`). Xoá phần giảng có xác nhận.

## Kiểm chứng

Log và ảnh: [acceptance/AUTHORING-UX-2026-10-29](../acceptance/AUTHORING-UX-2026-10-29/).

| Gate | Kết quả |
|---|---|
| Backend typecheck, lint, prettier, api:check, bruno:check, foundation:check | PASS |
| Backend e2e `teaching-plans` trên Postgres local | 6/6 PASS |
| CMS `quality:check` (foundation, structure, format, lint, typecheck, coverage, product 725 messages, api reproducible, rules) | PASS |
| CMS unit | 64/64 PASS |
| CMS production build | PASS |
| CMS browser (Playwright, API fixture có state), gồm regression studio/smoke/auth/light | 26/26 PASS (41.8s) |

Spec mới `e2e/course-authoring.spec.ts` (7 test): outline + sheet + autosave payload; bắt đầu giáo án thủ công + PATCH; dàn ý, nhảy lỗi, AI gửi đúng nguồn/model/If-Match (lưu nguồn trước, job sau); 390px không tràn; danh sách: coverage, lọc, xoá lọc, mobile; kéo bài sang chương khác bằng chuột và kéo chương bằng bàn phím → payload thứ tự đúng; thanh dàn ý mobile.

## Giới hạn

- Browser test dùng API fixture có state, không phải backend thật; chưa chạy flow này với DB/Gemini thật sau nâng cấp.
- Coverage là số đếm bài có plan, không phản ánh chất lượng/duyệt giáo án (US-012 chưa làm).
- Kéo-thả không auto-scroll tối ưu cho khoá rất dài; bài có giáo án vẫn kéo được sang chương khác (đúng nghiệp vụ hiện tại).
- Lượt chạy đầu khi máy tải nặng (load average ~30, 13.7 phút) có 2 test timeout chờ UI (kéo-thả, mở panel AI): `cms-e2e-run1-under-load.log`. Chạy lại spec 7/7 và toàn bộ 26/26 khi tải bình thường; không sửa code giữa các lượt. Không coi lượt đầu là PASS.
- Kéo chương bằng bàn phím trong test cần chờ announcement "Đang ở vị trí" trước phím mũi tên (KeyboardSensor gắn listener sau khi nhấc).
