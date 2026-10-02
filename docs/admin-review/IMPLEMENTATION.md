# Bàn giao nâng cấp admin — 01/10/2026

Đã triển khai trên workspace local, chưa deploy và chưa tạo commit. Baseline trong README và api-probe-results.json được giữ nguyên để đối chiếu.

## Phạm vi đã làm

| Nhóm | Kết quả |
| --- | --- |
| UI/UX | Shell chung, light/dark, sidebar mobile, control/focus/disabled đồng nhất, dialog giữ focus và dữ liệu khi lỗi. Tách admin thành chunk lazy. |
| Tài khoản | Search/role/source/sort và phân trang server 25/50/100; hồ sơ chi tiết; tạo tài khoản có password rõ ràng; sửa với expectedVersion; khóa/mở khóa thay cho nút xóa trực tiếp. |
| Dữ liệu thật/test | Overview mặc định loại test; nguồn dữ liệu có bộ lọc và nhãn; đổi tên không làm mất nguồn test đã xác định. Không bịa doanh thu hoặc giao dịch. |
| Quyền học | Command cấp quyền riêng, reason, idempotency và audit; không đánh dấu bài học hoàn thành để giả quyền học. |
| Chứng chỉ | Cấp manual/honorary không giả điểm; khóa idempotency, người cấp/lý do, xác minh mã và thu hồi giữ lịch sử. |
| Audit | Lưu server người thực hiện, request ID, kết quả/lỗi, thay đổi trước/sau; nhóm theo request, lọc người/đối tượng/thời gian; mặc định ẩn autosave thuần kỹ thuật. Không dựa vào console.log. |
| Export | Snapshot theo bộ lọc có số bản ghi, thời điểm và request ID; che secrets; chính export được audit. Có preview/copy JSON và tải file. |
| DB | Explorer chỉ đọc, search/phân trang, chọn cột, xem đầy đủ bản ghi; health chỉ rõ JSON/local và email trùng; legacy browser DB có empty state. |
| AI/giáo trình | Hiển thị prompt/model/version thật và trace hiện có; menu ghi rõ chức năng xem, không giả editor/publish. |
| Auth/API | Chặn tự đăng ký admin, Google spoof/email-only, password login sai provider; kiểm tra ownership read/write; whitelist response; validate DTO và email; chống self-demote/self-delete; JWT của user bị khóa/xóa không còn dùng được. |
| Điểm client | Không tin score/pass do client gửi để cấp chứng chỉ. Attempt cũ được ghi unverified, UI nêu rõ giới hạn. |

Các mutation dùng reason và version khi áp dụng; bài kiểm thử kiểm tra retry, conflict và rollback khi ghi thất bại. JSON vẫn là kho một tiến trình, không có bảo đảm transaction/concurrency nhiều instance như PostgreSQL.

## Kiểm chứng

- `bun run test:admin`: PASS cả 5 script; 21/21 probes, E2E 24/24, command/audit/auth/ownership/redaction và legacy/chat persistence đều qua. Log: [test-results-after.log](test-results-after.log); kết quả probes: [api-probe-after.json](api-probe-after.json).
- `bun run build`: PASS TypeScript frontend và Vite. Admin JS ~54.71 KB (~15.40 KB gzip), CSS ~18.67 KB. Main còn ~1.42 MB và warning chunk >500 KB do phần app/giáo trình.
- Type-check riêng backend và `git diff --check`: PASS.
- Đăng nhập UI bằng tài khoản admin được ĐẠI CA cung cấp; kiểm tra 9 trang, light/dark, dialog, bộ lọc dữ liệu, export preview/copy, DB detail/column visibility.
- Breakpoint 390/768/881/1024/1440: không tràn body; sidebar mobile ẩn khi đóng. Kết quả: [layouts.json](after/layouts.json).
- API export đã kiểm tra bộ lọc và secrets; UI copy trả đúng 10 tài khoản test. IAB không xác nhận được sự kiện tải file, nên chưa khẳng định download native đã nghiệm thu.
- Tests dùng kho tạm riêng. Kho local thật được review và backup có checksum bằng `scripts/review-store.ts --backup`; không xóa/gộp dữ liệu thật.

Probe mang tên EXAM-SERVER-GRADE hiện PASS vì payload điểm ngoài phạm vi bị từ chối. Nó không chứng minh đã có engine chấm answers/code trên server.

## Dữ liệu thực đang có

Kho local có 14 tài khoản: 3 admin, 1 học viên thực và 10 tài khoản test. 26 nhật ký học và 8 chứng chỉ cũ thuộc tài khoản test; chưa có chat session/message/trace AI trong kho này. Vì vậy màn tổng quan nguồn thật hiển thị 0 hoạt động/chứng chỉ là đúng với dữ liệu hiện có. Có 1 bản ghi dư do email trùng (2 tài khoản cùng email), được giữ để quyết định migration.

## Phần chưa hoàn tất

1. **DB production bền vững dùng chung:** cần host và DB/connection được chọn. `ARC_STORE_PATH` chỉ giúp đặt file ở persistent disk; chưa chuyển PostgreSQL/Supabase, chưa deploy. Không thể coi file `/tmp` serverless là bền vững.
2. **Chấm thi đáng tin:** còn cần attempt/answers và grader server, sandbox code; hiện chặn cấp chứng chỉ tin cậy từ điểm client.
3. **Policy quyền học và RBAC chi tiết:** entitlement được lưu đúng nghiệp vụ; chưa hoàn thiện gating toàn khóa theo plan hoặc permission riêng từng nhóm admin.
4. **Email invite/reset và CMS/AI publish:** chưa có service gửi mail hoặc workflow xuất bản; giao diện hiện ghi rõ khả năng xem.
5. **Vận hành ở quy mô lớn:** history/cert và aggregate initial load còn tải danh sách; cần paging/index khi đổi DB, stress test, backup/restore production, retention và cơ chế evidence chống sửa ngoài ứng dụng.

## Bằng chứng giao diện

- [Tổng quan](after/overview-light-1440.jpg)
- [Tài khoản desktop](after/users-light-1440.jpg) / [mobile](after/users-light-390.jpg)
- [Audit light](after/audit-light-1440.jpg) / [dark và diff](after/audit-dark-1440.jpg)
- [DB explorer](after/database-light-1440.jpg)
- [Nhật ký test](after/learning-test-light-1440.jpg)
- [Export preview](after/export-preview-light.jpg)

## Bổ sung ngày 02/10/2026

Đã thêm thống kê dung lượng, cấu hình retention và quản lý bản lưu log; xem [DATA-OPERATIONS.md](DATA-OPERATIONS.md). Retention chạy theo request mỗi 24 giờ khi bật, không phải cron production độc lập.
