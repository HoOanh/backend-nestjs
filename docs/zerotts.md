# ZeroTTS cho lớp học

Toàn bộ lời giảng dùng ZeroTTS với giọng `quangminh`; trình duyệt không tải bộ MP3 dựng sẵn. Ở production mặc định, ZeroTTS chạy trực tiếp bằng WebAssembly trong worker của trình duyệt; lần đầu tải khoảng 900 MB từ Hugging Face và lưu vào cache. Khi cấu hình `VITE_ZEROTTS_ENABLED=true`, app dùng `/api/tts/stream` theo từng câu và phát từng frame PCM từ API. Local dev vẫn dùng sidecar ZeroTTS như trước.

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
- `VITE_ZEROTTS_ENABLED=true`: dùng API ZeroTTS từ Cloud Run; cần redeploy frontend để áp dụng.

Nếu không bật `VITE_ZEROTTS_ENABLED`, production chạy model ZeroTTS thật trong trình duyệt với voice `quangminh`; lần đầu tải khoảng 900 MB và lưu cache trên thiết bị. Đây không phải `window.speechSynthesis` của hệ điều hành. Local dev vẫn khởi chạy sidecar ZeroTTS như trước.
