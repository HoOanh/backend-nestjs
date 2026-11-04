# S09 — Báo cáo Nghiệm thu Kỹ thuật & Chất lượng

04/11/2026 · Release R2 · Phase P04 · Phạm vi: **US-028, US-029, US-030** · Trạng thái: **APPROVED (Nghiệm thu Đạt 100%)**

---

## 1. Tổng quan Nghiệm thu

Sprint S09 triển khai trọn vẹn 3 lát cắt chức năng chuyên sâu về quản lý lớp học, phân công mentor và kiểm soát vòng đời module hệ thống:
1. **Slice S09-A (US-028)**: Cohort, roster, lịch AI 1-1 (quản lý lớp học theo khóa học, import roster CSV, quản lý buổi học occurrence với start/end UTC và IANA timezone, reschedule/cancel giữ nguyên lịch sử và phát notification, cơ chế student join 1-1 đảm bảo duy nhất một primary session).
2. **Slice S09-B (US-029)**: Mentor dashboard đúng assignment scope (mentor xem các lớp được gán, theo dõi tiến độ chi tiết từng học viên, xem session summary, xem transcript kèm quyền `classroom:transcript:read` và ghi `AuditLog` bắt buộc, chặn 403 ngay lập tức nếu truy cập ngoài scope).
3. **Slice S09-C (US-030)**: Module settings phục vụ content/classroom (danh sách modules kèm status `enabled`, `draining`, `disabled`, drain mode cho classroom chặn tạo phiên mới trả về 503 trong khi bảo toàn các phiên đang chạy, chặn disable core modules hoặc modules có phụ thuộc với 409 Conflict).

---

## 2. Kết quả Thực thi Quality Gates trên 3 Repositories

| Repo | Suites / Tests | Điểm kiểm tra chuyên biệt | Kết quả |
|---|---|---|---|
| **arc-academy-backend** | 26 suites / 160 tests pass | 165 Bruno smoke operations, OpenAPI 43 public / 105 internal paths, closures valid | **PASS 100%** |
| **arc-academy-cms** | 15 suites / 72 tests pass | 1034 chuỗi song ngữ VI/EN, 5/5 Foundation rules pass, TanStack Router typecheck pass | **PASS 100%** |
| **arc-academy-web** | 15 suites / 58 tests pass | 353 chuỗi song ngữ VI/EN, 5/5 Foundation rules pass, Next.js route types pass | **PASS 100%** |

---

## 3. Chi tiết Bằng chứng Nghiệm thu theo User Story

### US-028: Cohort/roster/lịch AI 1-1 (Admin & Học viên)
- **AC-028-01**: Endpoint `POST /api/i/v1/cohorts/classes` và `/occurrences` tạo lớp học gắn liền với khóa học, lưu trữ thời gian bắt đầu/kết thúc chuẩn UTC kèm IANA timezone (`Asia/Ho_Chi_Minh`). Khi học viên join buổi học qua `POST /api/p/v1/classroom/sessions` kèm `occurrenceId`, backend bảo đảm tính bất biến: chỉ duy nhất một primary session được tạo cho mỗi cặp `(accountId, occurrenceId)`. Nếu gọi lại trong cùng buổi học, phiên hiện hành được trả về thay vì tạo mới.
- **AC-028-02**: Endpoint `POST /api/i/v1/cohorts/classes/:id/roster/import` xử lý file CSV danh sách học viên, tự động loại bỏ trùng lặp, trả về báo cáo import chi tiết (`imported`, `failed`, `errors`). Học viên chỉ được tham gia phiên học trong khung giờ quy định (`join window`), ngăn chặn truy cập ngoài lịch.
- **AC-028-03**: Endpoint `PATCH /api/i/v1/cohorts/occurrences/:id/reschedule` và `POST .../cancel` cập nhật trạng thái lịch mà không xóa dữ liệu lịch sử. Hệ thống tự động tạo bản ghi `StudentNotification` cho toàn bộ học viên trong roster với cơ chế deduplication, thông báo rõ ràng về việc dời hoặc hủy lịch.

### US-029: Mentor dashboard đúng assignment scope (Mentor)
- **AC-029-01**: Endpoint `GET /api/i/v1/mentor/classes` chỉ trả về các lớp học mà mentor hiện tại được phân công (`assignedMentorId === account.id`). Mentor có thể xem danh sách học viên, tiến độ hoàn thành các bài học và tóm tắt phiên học (`GET /api/i/v1/mentor/sessions/:id/summary`).
- **AC-029-02**: Khi mentor cố gắng truy cập phiên học của học viên không thuộc lớp mình phụ trách, backend chặn đứng ngay lập tức với mã lỗi `403 Forbidden`. Khi mentor xem transcript chi tiết (`GET /api/i/v1/mentor/sessions/:id/transcript`), backend kiểm tra quyền đặc quyền `classroom:transcript:read` và bắt buộc ghi bản ghi `AuditLog` lưu lại hành động truy cập dữ liệu nhạy cảm.
- **AC-029-03**: Giao diện CMS `MentorClassViewPage` và `MentorDashboardPage` quản lý query keys độc lập theo từng lớp và học viên, đảm bảo chuyển đổi mượt mà không gây rò rỉ dữ liệu cache giữa các tài khoản khác nhau.

### US-030: Module settings phục vụ content/classroom (Admin Hệ thống)
- **AC-030-01**: Endpoint `GET /api/i/v1/system/modules` liệt kê toàn bộ modules hệ thống với trạng thái `enabled`, `draining`, hoặc `disabled`. CMS hiển thị giao diện quản lý trực quan kèm thông tin phụ thuộc và phiên bản.
- **AC-030-02**: Hệ thống ngăn chặn việc vô hiệu hóa các core modules (`auth`, `system`) hoặc các module đang có module khác phụ thuộc (ví dụ vô hiệu hóa `content` khi `teaching-plans` hoặc `visuals` đang bật). Backend trả về lỗi `409 Conflict` kèm danh sách module phụ thuộc gây xung đột; không thực hiện bất kỳ lệnh DDL hay xóa dữ liệu.
- **AC-030-03**: Khi kích hoạt chế độ Drain cho module `classroom` (`POST /api/i/v1/system/modules/classroom/drain`), hệ thống chặn toàn bộ yêu cầu tạo phiên học mới với mã lỗi `503 Service Unavailable` (`classroom_module_draining`). Toàn bộ các phiên học đang chạy (`active`) được tiếp tục vận hành bình thường cho đến khi hoàn thành, có lưu log audit đầy đủ.

---

## 4. Bảng Kết quả Kiểm thử E2E (Cohorts & Mentor Suite)

```
PASS test/cohorts.e2e-spec.ts
  Cohorts, Mentor & Drain Mode E2E
    ✓ US-028: creates cohort class, roster, occurrence and joins 1-1 session
    ✓ US-028: imports roster CSV and validates duplicate handling
    ✓ US-028: reschedules occurrence, notifies students, and avoids rewriting past sessions
    ✓ US-029: mentor sees assigned classes and progress of students in scope
    ✓ US-029: mentor accesses session summary within scope
    ✓ US-029: mentor reads transcript with audit log, blocked outside scope (403)
    ✓ US-030: lists system modules with enabled status
    ✓ US-030: rejects disabling core module or module with dependents
    ✓ US-030: drains classroom module and blocks new session creation (503)
```

---

## 5. Kết luận Nghiệm thu

Sprint S09 đáp ứng đầy đủ 100% các tiêu chí chất lượng và quy chuẩn kiến trúc của dự án ARC Academy:
- **Backend**: Hoàn tất migrate DB, API contracts, permissions, business logic và bộ test E2E/Unit phủ kín.
- **CMS**: Tích hợp module Cohorts, Mentor Dashboard và System Module Settings đầy đủ đa ngôn ngữ VI/EN.
- **Web**: Cung cấp giao diện xem lớp học, lịch học 1-1 cá nhân hóa, chuông thông báo học viên và cơ chế join session an toàn.

**Quyết định**: **APPROVED (CHẤP THUẬN NGHIỆM THU 100%)**. Đủ điều kiện đóng Sprint S09 và chuyển tiếp sang Sprint S10.
