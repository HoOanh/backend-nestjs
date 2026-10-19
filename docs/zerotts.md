# ZeroTTS cho lớp học

Toàn bộ lời giảng dùng ZeroTTS với giọng `quangminh`; trình duyệt không tải bộ MP3 dựng sẵn. Audio dùng `/api/tts/stream` theo từng câu và phát từng frame PCM ngay khi nhận được, không chờ tải hết WAV. Khi beat kế tiếp đang được chuẩn bị, frame được đưa vào hàng đợi ngay khi ZeroTTS tạo ra; lúc chuyển beat, trình phát dùng phần đã có và tiếp tục nhận phần còn lại trong lúc phát. Ứng dụng giữ tối đa hai beat đã chuẩn bị trong bộ nhớ, không gộp cả bài thành một request.

## Chạy local

```sh
npm run dev
```

Vite khởi chạy sidecar ZeroTTS ở backend và trình duyệt gọi API cùng origin. Sidecar chỉ bind vào `127.0.0.1:4179`. Dependency Python nằm trong `requirements-zerotts.txt`.

GIF minh họa ở slide I/O được nhúng trực tiếp từ bài [Node.js animated: Event Loop của Andrew Hu / Node Doctors](https://dev.to/nodedoctors/an-animated-guide-to-nodejs-event-loop-3g62); ứng dụng không lưu bản GIF tự dựng trong assets.

## Production trên Vercel

Vercel chuyển `/api/tts` và `/api/tts/stream` tới Python Function trong `api/zerotts.py`. Function xác thực JWT `arc_session`, tải model ZeroTTS vào `/tmp` ở lần gọi đầu tiên, rồi giữ model trong bộ nhớ khi instance còn nóng. `requirements.txt` khai báo dependency cho Python runtime của Vercel; `.python-version` chọn Python 3.13. Luồng này không cần `ZEROTTS_URL` hay `ZEROTTS_API_KEY`.

Request đầu tiên trên instance mới có thể lâu do tải và làm nóng model. Audio beat kế tiếp được tổng hợp trong lúc beat hiện tại đang phát, nhờ vậy thời gian tạo TTS được chồng lên thời gian nghe. Nếu chưa có frame đầu tiên khi chuyển beat, người học vẫn nghe một khoảng đệm chờ ZeroTTS tạo frame đó; các frame sau được phát theo luồng, không đợi toàn bộ câu hoặc beat tải xong. Theo dõi Function Logs và Usage nếu cold start hoặc giới hạn tài nguyên Vercel ảnh hưởng thời gian phản hồi.
