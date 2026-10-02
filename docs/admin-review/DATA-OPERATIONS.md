# Dung lượng và vòng đời log — 02/10/2026

Trang `/admin/database` có thống kê dung lượng file DB thực tế, tổng bản ghi, dung lượng JSON ước tính từng bảng, dung lượng archive và tổng DB + archive. Con số không bao gồm backup thủ công, dung lượng host hoặc provider quota. Snapshot được cập nhật khi làm mới và sau command thành công.

## Quản lý log

- Trace AI: giữ mặc định 30 ngày, cho cấu hình 1–3650 ngày.
- Audit: giữ mặc định 365 ngày, cho cấu hình 365–3650 ngày; đây là mức sàn nghiệp vụ của bản triển khai này.
- Tự động dọn mặc định tắt. Khi bật, server kiểm tra mỗi 24 giờ tại request tiếp theo. Không có worker/cron độc lập; server nghỉ thì không chạy, request đầu sau đó xử lý các log quá hạn.
- Dọn thủ công chọn loại/mốc thời gian, xem trước số bản ghi và dung lượng, nhập lý do rồi xác nhận. Fingerprint kiểm tra dữ liệu chưa đổi trước khi thực hiện.
- Server ghi archive mode 0600 trước khi loại log khỏi kho active; giữ ID khi khôi phục, không nhân đôi. Khôi phục tắt automation để tránh log cũ vừa phục hồi bị dọn lại.
- Archive không tự xóa. Muốn giải phóng disk, admin chọn xóa bản lưu, nhập đúng mã bản lưu và lý do. Xóa vĩnh viễn không khôi phục được qua ứng dụng. Server lưu evidence yêu cầu xóa trước và request outcome sau thao tác.
- Dọn/cấu hình/khôi phục/xóa bản lưu đều kiểm tra admin và ghi evidence. Automation ghi source system. Không dọn users, certificates, learning_history, chat_messages hay quyền học.

Dữ liệu được lưu cạnh file DB tại `<store-file>.archives`. Cần backup cả file DB và thư mục này. File /tmp và các bản lưu cạnh nó đều có cùng giới hạn serverless; không thay thế DB production bền vững.

## Kiểm thử

`bun run test:admin`: PASS cả suite cũ và `test/dataOperations.test.ts`. Test mới kiểm tra bytes thực, admin guard, giới hạn retention, preview conflict, lưu bản khôi phục, restore idempotency/path validation, tự động dọn đúng tuổi không chạy lặp trong 24 giờ, giữ dữ liệu nghiệp vụ, xác nhận xóa và archive đã xóa không restore được. Fixture nằm trong thư mục tạm riêng, không dọn log thật.

`bun run build`, type-check backend và `git diff --check`: PASS. Vite vẫn cảnh báo main chunk lớn từ phần app/giáo trình.

UI local: 68.0 KB file DB tại thời điểm kiểm tra, 0 B archive. Preview trace cũ hiển thị 0 và khóa nút dọn; mobile 390px không tràn body. [Desktop](after/data-operations-1440.jpg), [mobile](after/data-operations-390.jpg).
