# Hệ minh hoạ chuyển động cho lớp học

Yêu cầu: nét vẽ xuất hiện dần, bàn tay vẽ, hình minh hoạ, chuyển động dẫn mắt.
Không áp dụng nền vàng. Đây là triển khai theo yêu cầu được người dùng mô tả;
không khẳng định các hoạt ảnh này đã được quan sát trong đoạn video tham chiếu.

## Ngôn ngữ hình ảnh

- Một sân khấu trắng cho hình minh hoạ; nội dung đang giải thích ở phía dưới.
- Nét mực tròn, nhãn viết tay, xanh cho request A, cam cho B, xanh lá cho context
  tách biệt, đỏ cho kết quả sai. Hình minh hoạ kỹ thuật là SVG gốc, không dùng emoji.
- Bàn tay SVG gốc cầm bút. Điểm neo đầu bút đi theo `getPointAtLength` của nét đang vẽ.
- Thời lượng nét và reveal chữ được quản lý tại `whiteboard/designSystem.ts`.
- Mỗi lượt focus chỉ vẽ phần mới; các nét cũ được giữ để người học theo mạch.
  Điểm dữ liệu đi theo mũi tên một lần; không có hiệu ứng lặp vô hạn khi đang nghe.

## Scene và tín hiệu phát

`c1-l1-storyboards.ts` gắn scene tường minh cho từng slide, gồm process, request race,
event loop, queue, multiplexing, memory và diagnosis. Không đoán scene từ tiêu đề.
Scene thread và FD có biến thể riêng để tránh minh hoạ sai bằng hai process hoặc epoll.

`focusSequence` của lời giảng đưa focus index vào scene. Các stroke có `at` xác định
giai đoạn xuất hiện. Timer chỉ có trong trang demo tạm, không điều khiển scene trong
lớp học. Scene dùng bước lời giảng hiện tại, không dựa vào thời gian tải hoặc suy luận
âm lượng. Đây là đồng bộ theo bước, chưa phải đồng bộ nét bút tới từng âm tiết.

## Chế độ xem và khả năng tiếp cận

Code/số liệu mở bằng nút riêng; dòng code liên quan vẫn được đánh dấu theo focus.
Tiêu đề, caption và trạng thái bước hiện tại là text DOM. Scene có nhãn truy cập.
Khi `prefers-reduced-motion` được bật, nét và nhãn hiện ngay theo bước, bàn tay và
điểm di chuyển không chạy. Chuyển động không làm gián đoạn hoặc chờ thêm vào audio.

## Kiểm tra

- Test scene có đủ các giai đoạn, không trùng ID nét, giữ nguyên hình đã vẽ.
- Test cảnh lỗi tenant và cảnh sửa có kết quả khác nhau.
- Browser: quan sát đầu bút ở nhiều vị trí; mở code kiểm tra đúng dòng truy vấn;
  kiểm tra bố cục 768px không tràn ngang.
- Bản ghi demo minh hoạ chuyển động không có audio; nó không thay thế phép kiểm tra
  phát toàn bài với model thật.
