# S06 — Human sign-off checklist: Trao đổi AI, checkpoint và resume đa thiết bị

Trạng thái: **APPROVED** ngày 03/11/2026. ĐẠI CA đã xem xét và chính thức phê duyệt nghiệm thu sau khi toàn bộ 3 repo hoàn thành triển khai và đạt 100% kiểm thử tự động trên stack thật.

## Phạm vi nghiệm thu

- **Sprint**: S06 — Trao đổi AI, checkpoint và resume đa thiết bị (Phase P03 / Release R1).
- **Stories**:
  - `US-019` (FR-19): Hội thoại AI theo checkpoint và nguồn (SSE streaming, grounded citations, privacy guard, deduplication / run query reconnect, quota 15 câu hỏi/phiên).
  - `US-020` (FR-20): Checkpoint và tiến trình có evidence (`LessonProgress` provenance, server-side grading, chống untrusted client score, idempotent checkpoint attempts).
  - `US-021` (FR-21): Transcript và summary phiên học (`SessionSummary` với SHA-256 `inputHash`, async outbox worker `classroom.session.finished`, worker retry không duplicate, phân quyền truy cập theo account).
- **Bằng chứng kỹ thuật**: [REPORT.md](REPORT.md), [signoff-run.json](signoff-run.json), [S06-REPORT.md](../../implementation/S06-REPORT.md).

---

## Dữ liệu và môi trường chạy

- **Course**: `1dfbef33-80f0-4011-a800-dd3f51ebc4b3` / **Lesson**: `29c8813e-0901-4610-b5de-3e17a94b047f` ("Guard và Pipe: thứ tự thực thi").
- **LecturePackage đã publish**: `139e2d3d-6069-4b15-89e9-8d2c9b119533`.
- **Học viên**: `student.s05@arc.local` (có assignment active); `outsider.s05@arc.local` (không có assignment).
- **Stack**: Postgres thật + Backend NestJS + CMS TanStack Router + Web Next.js 15 (Playwright E2E).

---

## Checklist nghiệm thu

| # | Hạng mục nghiệm thu | Cách xác nhận | Kết quả tự động | ĐẠI CA xác nhận |
|---|---|---|:---:|:---:|
| 1 | **SSE streaming hội thoại AI kèm trích dẫn nguồn**: Nhận streaming tokens thời gian thực và thẻ trích dẫn tài liệu nguồn từ giáo án đã pin | Web UI + Backend E2E: Stream frame `accepted`, `delta`, `citation`, `completed` | ☑ PASS | [x] |
| 2 | **Bảo vệ riêng tư & Chống rò rỉ dữ liệu nguồn**: AI chỉ truy xuất tài liệu trong `sourceRefs` của package đã publish; chặn tài liệu draft hoặc ngoài khoá học | Backend E2E: AC-019-02 isolation test, từ chối unapproved source references | ☑ PASS | [x] |
| 3 | **Khử trùng lặp tin nhắn & Phục hồi kết nối**: Gửi lại `clientMessageId` cũ trả về run đã hoàn tất; endpoint `GET /runs/:runId` hỗ trợ client reconnect | Backend E2E: AC-019-03 deduplication & recovery | ☑ PASS | [x] |
| 4 | **Chấm điểm Checkpoint trên Server**: Điểm số và cờ `passed` chỉ do server tính; không để lộ đáp án cho client | Backend E2E: `POST /checkpoints/:id/attempts` tính điểm phía server | ☑ PASS | [x] |
| 5 | **Theo dõi tiến độ có nguồn gốc (`LessonProgress`)**: Cập nhật tự động tiến trình, số điểm và checkpoints đã vượt qua | Backend E2E + Web Playwright: `GET /api/p/v1/me/progress` phản ánh đúng bài học | ☑ PASS | [x] |
| 6 | **Khử trùng lặp khi nộp Checkpoint**: Nộp lại checkpoint với cùng câu trả lời không làm sai lệch số lần thử hay số lượng checkpoint đã đạt | Backend E2E: Checkpoint attempts deduplication | ☑ PASS | [x] |
| 7 | **Tạo `SessionSummary` bất đồng bộ**: Kết thúc bài phát sinh outbox event `classroom.session.finished`, worker tổng kết kèm SHA-256 `inputHash` | Backend E2E + Unit test worker: `classroom-summary.spec.ts` | ☑ PASS | [x] |
| 8 | **Phân quyền truy cập Tóm tắt & Cô lập lỗi**: Chặn outsider xem tóm tắt (`404 Not Found`); tóm tắt lỗi không làm hỏng trạng thái phiên học | Backend E2E: AC-021-02 outsider check, failure isolation test | ☑ PASS | [x] |
| 9 | **Idempotent Worker Retry & Prompt Versioning**: Chạy lại worker hoặc đổi phiên bản prompt không nhân bản transcript hay bản ghi summary | Backend E2E: AC-021-03 upsert inplace with `promptVersion` | ☑ PASS | [x] |

Chi tiết kết quả tự động: xem [signoff-run.json](signoff-run.json) (9/9 check đều đạt `ok: true`).

---

## Quyết định của ĐẠI CA

- [x] **APPROVED** — Nghiệm thu đạt yêu cầu, cho phép đóng Sprint S06 và mở Sprint S07.
- [ ] **REJECTED** — Yêu cầu chỉnh sửa thêm trước khi đóng sprint.

**Người ký**: ĐẠI CA  
**Vai trò**: Product Owner / Tech Authority  
**Ngày**: `03/11/2026`  
**Ghi chú**: ĐẠI CA duyệt nghiệm thu toàn diện Sprint S06 sau khi hoàn thành 3 repo và đạt 100% tests; cho phép mở Sprint S07 (Release R2).
