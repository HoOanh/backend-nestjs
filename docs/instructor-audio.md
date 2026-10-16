# Giọng giảng viên ZeroTTS

Toàn bộ phần đọc dùng một giọng nam ZeroTTS cố định `quangminh`, không lấy voice từ Windows, macOS hay trình duyệt của học viên. Lời giảng cố định của bài 1 được dựng sẵn thành MP3; lời đáp hỏi bài và nội dung chưa có clip được tổng hợp bởi dịch vụ ZeroTTS của ứng dụng. Âm thanh động truyền PCM theo luồng, phát khung đầu trong lúc các khung sau đang được tổng hợp. Gemini TTS không còn được gọi.

## Tạo lại audio cho bài 1

Cần có `uv` và `ffmpeg`. Chạy:

```sh
npm run audio:generate:c1-l1
```

Lần đầu, lệnh tải ZeroTTS và bộ trọng số khoảng 900 MB; các lần tiếp theo dùng cache. Audio MP3 và manifest nằm trong `public/assets/instructor-audio/c1-l1/` và được đưa vào bản build. Khi sửa narration hoặc đổi voice, chạy lại lệnh để cập nhật các clip tương ứng.

## Chạy giọng đọc động trong local

Vite khởi chạy và làm nóng sidecar ZeroTTS ở backend ngay khi dev server lên, không đợi học viên gửi câu hỏi mới bắt đầu tải model. Lần đầu model được tải và cache trên máy chạy backend (xấp xỉ 900 MB); các lượt sau dùng lại model đã cache. Sidecar giữ model trong bộ nhớ để các câu hỏi tiếp theo không phải tải model lại. Route `/api/tts/stream` chuyển PCM ngay khi ZeroTTS tạo từng khung; `/api/tts` vẫn là fallback tương thích. Hỏi đáp bắt đầu đọc câu đã hoàn chỉnh trong lúc AI còn tạo phần sau; nghe tiếp cũng dùng luồng này khi không có clip dựng sẵn.

```sh
npm run dev
```

Yêu cầu có `uv`, Python 3.13 và các dependency trong `requirements-instructor-audio.txt`. Sidecar chỉ bind vào `127.0.0.1:4179`, còn trình duyệt gọi `/api/tts/stream` cùng origin của ứng dụng.

## Production

ZeroTTS là model chạy trên backend, không phải dịch vụ inference miễn phí do nhà cung cấp host. Với Vercel, cần chạy sidecar trên một máy chủ có thể giữ model trong bộ nhớ rồi cấu hình `ZEROTTS_URL` trỏ tới URL backend đó. Đặt cùng một giá trị bí mật cho `ZEROTTS_API_KEY` ở Vercel và sidecar. Vercel function chỉ proxy audio; không tải model vào function. Route kiểm tra đăng nhập trước khi chuyển tiếp; sidecar cũng kiểm tra shared key. Nếu chưa cấu hình backend, route trả lỗi rõ ràng và không rơi về voice hệ điều hành hay Gemini. Function được đặt timeout 60 giây; giới hạn thực tế còn phụ thuộc gói hosting và tốc độ máy inference.
