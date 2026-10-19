# ZeroTTS cho lớp học

Toàn bộ lời giảng dùng ZeroTTS với giọng `quangminh`; trình duyệt không tải bộ MP3 dựng sẵn. Audio dùng `/api/tts/stream` theo từng câu và phát từng frame PCM ngay khi nhận được, không chờ tải hết WAV. Khi beat kế tiếp đang được chuẩn bị, frame được đưa vào hàng đợi ngay khi ZeroTTS tạo ra; lúc chuyển beat, trình phát dùng phần đã có và tiếp tục nhận phần còn lại trong lúc phát. Ứng dụng giữ tối đa hai beat đã chuẩn bị trong bộ nhớ, không gộp cả bài thành một request.

## Chạy local

```sh
npm run dev
```

Vite khởi chạy sidecar ZeroTTS ở backend và trình duyệt gọi API cùng origin. Sidecar chỉ bind vào `127.0.0.1:4179`. Dependency Python nằm trong `requirements-zerotts.txt`.

GIF minh họa ở slide I/O được nhúng trực tiếp từ bài [Node.js animated: Event Loop của Andrew Hu / Node Doctors](https://dev.to/nodedoctors/an-animated-guide-to-nodejs-event-loop-3g62); ứng dụng không lưu bản GIF tự dựng trong assets.

## Production: Cloud Run + Vercel

ZeroTTS chạy trong container Cloud Run; Docker build tải model vào `/opt/zerotts-model`, vì vậy request không tải model vào `/tmp`. Hướng dẫn tạo image và deploy nằm trong repo riêng `zerotts-cloudrun`.

Vercel tiếp tục xác thực `arc_session` ở `/api/tts` và `/api/tts/stream`, sau đó proxy request sang Cloud Run. Sau khi deploy Cloud Run, cấu hình các biến trong Vercel:

- `ZEROTTS_URL`: URL HTTPS của Cloud Run service.
- `ZEROTTS_API_KEY`: cùng khóa bí mật đã cấu hình cho Cloud Run.
- `VITE_ZEROTTS_ENABLED=true`: bật lời đọc ZeroTTS trên frontend production; cần redeploy frontend để áp dụng.

Nếu chưa bật `VITE_ZEROTTS_ENABLED`, production tiếp tục dùng giọng tiếng Việt cài trong trình duyệt. Local dev vẫn khởi chạy sidecar ZeroTTS như trước.
