# Quan sát cần review trước ký nghiệm thu

## UX-01 · P2 · Upload bị từ chối nhưng thông báo hướng tới lỗi kết nối

**Trạng thái: FIXED — regression TC04 qua browser thật, VI/EN mobile; TC03 kiểm upload và viewer nguồn hợp lệ.**

- **Bước tái hiện:** mở một revision Markdown đã ready trong CMS; chọn file `forged-text.txt` chứa binary/NUL, upload qua UI.
- **Kết quả backend:** finalize HTTP400, revision bị quarantined; file không vào learner projection. Đây là phần chức năng đã PASS.
- **Quan sát UI:** thông báo “Tải lên chưa hoàn tất. Kiểm tra kết nối và chọn lại tệp để thử lại.” không phân biệt file bị từ chối với lỗi mạng. Source viewer bên dưới vẫn hiện `Sẵn sàng` của tài liệu đã chọn trước đó; phần viewer không có tên document/revision ngay tại tiêu đề nên dễ nhầm với file vừa upload.
- **Khắc phục:** thông báo từ chối tệp riêng cho HTTP400/413/415; lỗi mạng giữ hướng dẫn retry; đóng viewer khi bắt đầu upload; viewer hiện tên document và revision.
- **Ảnh sau sửa:** [TC04-quarantined-forged-mime](images/TC04-quarantined-forged-mime.png).
- **Phạm vi sửa đề xuất:** `arc-academy-cms/src/modules/content/views/DocumentsPanel.tsx` và VI/EN resources; phân biệt validation/quarantine và network failure, đồng thời ghi tên/revision của nguồn đang xem hoặc reset selection khi upload thất bại.
- **Điều kiện đóng:** upload MIME sai phải nêu rõ bị từ chối/kiểm tra định dạng; network failure vẫn có hướng dẫn retry; trạng thái ready phải nhận diện rõ nguồn; kiểm lại VI/EN và mobile. Không yêu cầu lộ thông tin lỗi parser nội bộ.
- **Tác động nghiệm thu:** không có bằng chứng vượt quyền hay nguồn độc hại được ready. Lỗi UX đã được sửa và kiểm lại; phê duyệt UAT nội dung vẫn thuộc ĐẠI CA.

## OBS-01 · HTTP200 của trang not-found đã streaming

Case thu hồi assignment ban đầu kỳ vọng HTML404, nhưng quan sát thực tế: API404; UI “Trang không tồn tại.”; không còn source text trong DOM; robots `noindex`; HTML200. Đây là hành vi streaming được [Next.js mô tả](https://nextjs.org/docs/app/api-reference/file-conventions/not-found), không phải bằng chứng học viên còn đọc được nguồn.

Test cuối giữ kiểm tra API404, UI not-found, noindex và nguồn vắng mặt. Không thay đổi application để ép test xanh. Yêu cầu hard HTTP404 ở edge nếu được đặt riêng sẽ cần một tiêu chí kiểm chứng riêng.

## Giới hạn không được coi là PASS

- Không chạy Google OAuth thật, đăng ký/reset qua email trong đợt này.
- Chưa chạy WebKit/Firefox, thiết bị mobile vật lý hoặc load/concurrency dài hạn.
- Chưa cưỡng bức wall-timeout/OOM/crash-recovery; đã kiểm parser từ chối PDF quá trang, DOCX expansion và PDF scan cần OCR.
- Chưa chạy production/deployed edge, retention/off-host restore hoặc cutover.
- TOTP secret/password được che trong ảnh, không xuất cookie/HAR/trace. Chỉ tài khoản và tài liệu fixture local được dùng.
