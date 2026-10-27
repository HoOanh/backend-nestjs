# C1-L1: cách dẫn dắt lớp học

**Trạng thái:** bản viết lại và layout hai cột đã bị phản hồi là chưa đúng tham chiếu.
Không coi các nguyên tắc trình bày dưới đây là thiết kế đã được chấp nhận.
Phân tích lại video và bản nháp dẫn dắt năm phút đầu nằm tại
[`REFERENCE_VIDEO_STYLE_ANALYSIS.md`](./REFERENCE_VIDEO_STYLE_ANALYSIS.md).

Phạm vi: giáo trình giảng trực tiếp tại `src/data/instructor-curriculum/chapter1/c1-l1.ts`.
Tài liệu lý thuyết, quiz và sandbox trong `src/data/curriculum/chapter1/c1-l1.ts` là tài liệu đọc riêng.

## Mạch bài

Dùng một API đặt lịch phòng khám xuyên suốt. Mỗi chặng đặt một câu hỏi có thể quan sát,
giải thích một mô hình vừa đủ, lần theo code hoặc số liệu, rồi kiểm tra bằng tình huống áp dụng.
Không đưa định nghĩa dày đặc lên slide rồi đọc lại. Chi tiết nằm trong lời giảng;
slide giữ bằng chứng, ba bước suy luận và một kết luận.

1. Chạy cùng file hai lần: xác định process bằng PID và cổng.
2. Hai request dùng cùng service: tái hiện và sửa tenant bị ghi đè qua await.
3. So I/O wait với CPU work: giải thích /health bị chậm và giới hạn của async.
4. Đổi đơn vị, tính Little, phân biệt mean và p95.
5. Phân biệt connection, readiness và callback; lần theo đường về của query.
6. Đọc RSS, heap, Buffer và giới hạn cgroup theo đúng phạm vi.
7. Chẩn đoán bằng trace, thử một can thiệp và đo trade-off.

## Hợp đồng đồng bộ lời giảng và bảng

`guidedSlide` chia lời dẫn, lời giải từng bước và kết luận bằng đúng bộ tách câu
`speechText` mà player sử dụng. Mỗi câu có focus index rõ ràng. Code được giữ trên bảng;
dòng liên quan được đánh dấu theo bước. Kết luận chỉ xuất hiện khi tới lời kết luận.
Khi viết thêm slide, dùng đoạn giới thiệu thuật ngữ trước khi dùng nó để suy luận;
không biến hình dung “biến cục bộ” thành khẳng định mọi biến JS đều nằm vật lý trên stack.

Tổng thời lượng 90 phút là ngân sách buổi học có câu hỏi và thực hành, không phải thời lượng
audio đo sẵn. Các con số latency, địa chỉ, PID và memory trong ví dụ được ghi rõ là minh hoạ.

## Nguồn đối chiếu

- Tham chiếu cách trình bày do người dùng cung cấp: https://www.youtube.com/watch?v=mKz1aQwkgZ8
  (lượt đầu chỉ quan sát các khung hình, chưa đủ để kết luận về style; lượt sau
  phát liên tục tới 5:41 và đối chiếu lời dẫn 0:00–5:00, xem phân tích bổ sung).
- Node.js, don't block the event loop: https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop
- NestJS, injection scopes: https://docs.nestjs.com/fundamentals/injection-scopes
- Node.js, memoryUsage: https://nodejs.org/api/process.html#processmemoryusage
- Linux, epoll: https://man7.org/linux/man-pages/man7/epoll.7.html

## Kiểm tra

`bun test test/instructorLesson.test.ts test/focusSequence.test.ts test/vietnameseVoiceService.test.ts test/lecturePlayback.test.ts`

Kiểm tra mọi câu có focus hợp lệ, mọi bước đều được reveal, dòng code đánh dấu tồn tại,
ID checkpoint ổn định và luồng phát/chuyển đoạn không hồi quy. Dùng browser kiểm tra
code dài, viewport nhỏ, bước đang nói và kết luận cuối. Không suy thời lượng audio thật từ test PCM giả lập.
