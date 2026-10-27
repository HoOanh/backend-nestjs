# Hệ minh hoạ chuyển động cho lớp học

Yêu cầu: nét vẽ xuất hiện dần, bàn tay vẽ, hình minh hoạ, chuyển động dẫn mắt.
Không áp dụng nền vàng. Đây là triển khai theo yêu cầu được người dùng mô tả;
không khẳng định các hoạt ảnh này đã được quan sát trong đoạn video tham chiếu.

## Ngôn ngữ hình ảnh

- Một sân khấu trắng cho hình minh hoạ; nội dung đang giải thích ở phía dưới.
- Nét mực tròn, nhãn viết tay, xanh cho request A, cam cho B, xanh lá cho context
  tách biệt, đỏ cho kết quả sai. Hình minh hoạ kỹ thuật là SVG gốc, không dùng emoji.
- Bàn tay là ảnh PNG cắt nền `src/assets/classroom/writing-hand.png`, tạo bằng
  imagegen. Đầu bút tại pixel (117, 123) neo vào `getPointAtLength` của nét.
  Prompt và nguồn gốc được lưu ở `docs/WRITING_HAND_ASSET.md`.
- Bảng màu mực dịu, lớp tô pastel và chiều rộng sprite tay (520 đơn vị) nằm tại
  `whiteboard/designSystem.ts`. Tay lớn rút khỏi bảng khi vẽ xong hoặc tạm dừng.
- Chỉ một đường khoanh đỏ, không tô nền hoặc khoanh chồng nhau.
- Mỗi lượt focus chỉ vẽ phần mới; các nét cũ được giữ để người học theo mạch.
  Nhãn xuất hiện theo cụm; lớp màu chỉ hiện sau khi đường bao đã vẽ gần xong.
- `penTimeline` tách lệnh SVG `M` thành từng nét. Bút nhấc và di chuyển theo cung
  giữa các nét, có tăng/giảm tốc nhẹ. Khoảng 55% tiến độ lời giảng dành cho hình,
  tiếp đó bút di chuyển, khoanh đỏ và rút tay ở khoảng 80%, để lại thời gian
  quan sát hình trong khi nghe. Không chạy hạt sáng cùng lúc.

## Scene và tín hiệu phát

`c1-l1-storyboards.ts` gắn scene tường minh cho từng slide, gồm process, request race,
event loop, queue, multiplexing, memory và diagnosis. Không đoán scene từ tiêu đề.
Scene thread và FD có biến thể riêng để tránh minh hoạ sai bằng hai process hoặc epoll.

`focusSequence` của lời giảng đưa focus index vào scene. Các stroke có `at` xác định
giai đoạn xuất hiện. Trong lớp học, `NarrationPlaybackClock` đo các đoạn PCM đã lên lịch bằng
`AudioContext.currentTime`, tính cả tốc độ phát và loại thời gian chờ buffer.
`narrationStageProgress` chia mỗi bước theo các câu đang nói; nét bút, nhãn,
đường khoanh đỏ dùng chung MotionValue này. Không còn giới hạn 2.8 giây
cho một lượt vẽ. Tạm dừng giữ nguyên nét đã vẽ. Đây là đồng bộ theo tiến độ câu;
khi câu còn đang sinh audio, thời lượng tạm ước lượng rồi cập nhật bằng PCM,
chưa phải căn từng âm tiết. Trang xem độc lập không có audio dùng preview 16 giây.

## Chuẩn bị tài nguyên

Màn chuẩn bị giữ qua tải model, khởi tạo ONNX và sinh/buffer lời giảng đầu tiên.
Chỉ `onAudioReady` tại thời điểm audio thực sự bắt đầu phát mới mở lớp và chạy
đồng hồ buổi học. Stream rỗng báo lỗi để thử lại; có nút quay lại màn bắt đầu.

## Chế độ xem và khả năng tiếp cận

Code/số liệu mở bằng nút riêng; dòng code liên quan vẫn được đánh dấu theo focus.
Tiêu đề, caption và trạng thái bước hiện tại là text DOM. Scene có nhãn truy cập.
Khi `prefers-reduced-motion` được bật, nét và nhãn hiện ngay theo bước, bàn tay không chạy. Chuyển động không làm gián đoạn hoặc chờ thêm vào audio.

## Kiểm tra

- Test scene có đủ các giai đoạn, không trùng ID nét, giữ nguyên hình đã vẽ.
- Test cảnh lỗi tenant và cảnh sửa có kết quả khác nhau.
- Browser: quan sát đầu bút ở nhiều vị trí; mở code kiểm tra đúng dòng truy vấn;
  kiểm tra bố cục 768px không tràn ngang.
- Browser local: phát ZeroTTS thật, ghi hình nét vẽ cùng giọng, kiểm tra pause
  giữ nguyên các stroke và mở lớp học thật. Đây không phải kiểm tra toàn bài
  hoặc xác nhận bản production đã deploy.
