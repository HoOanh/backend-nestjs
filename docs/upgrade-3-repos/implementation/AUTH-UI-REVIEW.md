# Auth UI review — 28/10/2026

Sửa theo ảnh review của ĐẠI CA: popup validation native tiếng Anh, language select native và auth layout quá trống.

- Auth layout bounded max-width, surface trắng, hierarchy/spacing rõ và mobile một cột.
- React Hook Form + Zod + noValidate; errors dịch theo locale hiện tại, aria-invalid/aria-describedby, focus lỗi đầu. Hint 12–128 ký tự hiển thị trước khi nhập; có hiện/ẩn mật khẩu.
- shadcn DropdownMenu radio items thay native language switch; checked state, Enter/Escape/focus return. Giữ query token và preference.
- CMS: quality gate/build pass, 8 browser tests pass. Web: quality/build, 9 browser flows pass trong run đầy đủ; test auth UX được sửa để nhập lại password sau locale navigation rồi chạy riêng pass. Tổng 10 browser cases đã pass, gồm 3 live full-stack flows. Không gọi fixture là integration thật.
- Web coverage runner gọi Node trực tiếp để tránh lỗi finalizer của executable shim trên máy local.
- Đã xem screenshot desktop + mobile: Web .local/screenshots/auth-register-{desktop,errors,mobile}.png.
- Không commit/push/deploy. Báo cáo foundation trước là lịch sử; NativeSelect language-switch decision đã được thay thế theo review này.

## Hợp nhất ghi chú29/10/2026

Bản Web/Backend trước đây có amendment mật khẩu8–128 ký tự; CMS vẫn giữ12–128 theo phạm vi chỉ đạo lúc đó. Xem [Web marketing/auth report](WEB-MARKETING-UI.md) để phân biệt phạm vi; không đồng nhất hai contract chỉ vì gom report.
