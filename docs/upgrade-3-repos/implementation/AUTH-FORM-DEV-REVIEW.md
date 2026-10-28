# Form và đăng ký dev — 28/10/2026

Theo review tiếp theo: bỏ panel quảng bá, form một cột max460; label giữ ngắn gọn, dấu bắt buộc nằm riêng bên cạnh và control có aria-required. Errors chỉ rõ field còn thiếu; không hiển thị quy tắc tạo mật khẩu ở login. Dấu sao không được làm đổi accessible label của control. Backend validation/verification/MFA vẫn giữ nguyên.

Mailpit local đang chạy tại http://localhost:58025, SMTP51025. Đã dùng account learner.dev@arc.local qua register→worker→Mailpit→verify-email→login authenticated; không set ACTIVE trực tiếp và không dùng SMTP bên ngoài. Admin bootstrap credentials đã login kiểm tra, trả mfa_enrollment. Credentials chỉ lưu trong .local gitignored và trả riêng cho ĐẠI CA, không nằm trong tài liệu tracked.

Hướng dẫn local: backend docs/DEV-REGISTRATION.md. Đăng ký email @arc.local mới, mở Mailpit, chọn đúng người nhận và link xác minh, rồi login. Khi không có thư cần kiểm worker, không bỏ qua verification để che lỗi delivery.
