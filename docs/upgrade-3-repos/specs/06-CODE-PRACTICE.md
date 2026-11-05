# Bài tập code và chấm bài — đặc tả đề xuất R1

Trạng thái: yêu cầu viết/chạy/chấm là core R1 theo chỉ đạo 05/11/2026. Lát cắt API → Docker runner → Web learner đã triển khai và có browser/API E2E evidence tại [MVP status](../implementation/MVP-STATUS-2026-11-05.md); toàn bộ thiết kế dưới đây chưa được nghiệm thu. Thiếu CMS author/reviewer UI, durable worker/quota/concurrency/adversarial isolation checks, draft sync, mobile/multi-device. Tham chiếu [BRD](../baseline/02-BRD.md), [ma trận hành trình J06/J08](../implementation/PRODUCT-GAP-MATRIX-2026-11-05.md).

## MVP hiện có — kiểm tra source, chưa chạy thực tế

- `backend-nestjs/src/components/lesson/CodeSandboxTab.tsx` chọn một hoặc nhiều challenge, lưu challenge đạt trong `localStorage`; editor hỗ trợ lời giải, lịch sử, gợi ý và đặt lại code.
- `CodeSandboxEditor.tsx:546` gọi evaluator với code và toàn bộ test; nút chạy thử chọn visible, nộp bài kèm hidden; kết quả đạt khi nộp kích hoạt callback hoàn thành. Lịch sử lưu local (`:569`).
- `src/services/codeEvaluator.ts:337` chạy trong Web Worker, bỏ một phần cú pháp TypeScript bằng xử lý chuỗi, dựng hàm từ code, so sánh kết quả và dừng worker sau 4 giây. Test hidden vẫn được gửi vào browser và chỉ che trong giao diện; tiến độ và kết quả local không phải bằng chứng chấm đáng tin cậy. Cơ chế giới hạn network trong worker không đủ để khẳng định cách ly an toàn. Chưa kiểm tra tính đúng của mọi challenge hoặc mức hỗ trợ TypeScript.

## Hành trình và dữ liệu

1. Editor tạo bài theo lesson: đề, hướng dẫn/gợi ý, ngôn ngữ/runtime, starter code, entrypoint, ví dụ, visible cases và hidden cases. Lưu draft, preview; reviewer kiểm đúng revision và publish qua quy trình độc lập. Thay đề, test, runtime hoặc đáp án tạo revision mới, không thay nội dung đã publish.
2. Học viên có quyền xem bài published, soạn và lưu bản nháp theo tài khoản/bài/version. **Chạy thử** chỉ dùng visible cases; **Nộp bài** chấm cả visible và hidden. Hiển thị trạng thái chờ/chạy/kết quả/lỗi, thông tin hữu ích của visible cases và kết quả tổng hợp hidden theo chính sách; không trả input, expected, source hay log có thể tiết lộ hidden cases.
3. Mỗi lần nộp pin lesson/challenge revision, runtime version, code và bộ test tương ứng; server lưu trạng thái, kết quả và nguồn xác minh. Reload/đổi thiết bị thấy lịch sử của chính mình. Thử lại sau lỗi mạng không tạo submission trùng; kết quả chấm chỉ được ghi một lần. Không dùng kết quả client tự báo để đánh dấu đạt.
4. Tiến độ bài code độc lập đọc, quiz và lớp AI; chỉ submission được server xác nhận đạt mới thay đổi tiến độ code theo quy tắc hoàn thành đã chốt. Bản publish mới không sửa kết quả cũ; chính sách tính lại hoàn thành khi bài đổi phải được quy định rõ.

## Thiết kế kỹ thuật cần chứng minh

- Backend kiểm tra danh tính, quyền course và version trước đọc bài, lưu draft, chạy thử, nộp và đọc kết quả. Payload học viên chỉ chứa visible cases; hidden cases và expected giữ server-side, không đưa vào asset, client API hoặc logs. Scope staff/reviewer và audit được kiểm riêng.
- Backend tạo job bền vững với idempotency key theo actor/challenge/action; worker chấm trong môi trường thực thi cô lập riêng, không cấp secrets hay quyền hạ tầng ứng dụng. Chặn network mặc định; filesystem tạm và huỷ sau job; giới hạn thời gian, CPU, RAM, process, output, kích thước code và concurrency. Các ngưỡng cụ thể phải benchmark và cấu hình theo runtime; không dùng Web Worker trình duyệt làm ranh giới tin cậy server.
- Dùng compiler/runtime thực có version pin thay việc xoá TypeScript bằng regex; xác định chính xác cú pháp, thư viện, entrypoint và loại bài được hỗ trợ từ dữ liệu MVP trước khi chọn cấu hình. Không tuyên bố hỗ trợ toàn bộ TypeScript/NestJS chỉ vì editor gợi ý cú pháp.
- Phân biệt lỗi compile, runtime, timeout, giới hạn tài nguyên và lỗi hạ tầng; lỗi hạ tầng không bị tính sai bài. Worker retry/lease phải tránh double finalization; dọn tài nguyên và xử lý job bị bỏ dở. Giới hạn output/log và loại bỏ thông tin bí mật.
- Version test và runner; ghi provenance đủ tái hiện kết quả, không lưu hoặc hiển thị quá mức dữ liệu học viên. Quy định retention, quota và chính sách retry trước pilot.

## Tiêu chí kiểm chứng R1

- CMS tạo, sửa, preview, review/publish challenge có visible/hidden; sửa sau duyệt không thay revision đã publish. Người không có quyền không đọc/sửa test ẩn.
- Với ít nhất hai bài khác nhau, học viên chạy đúng/sai visible, nộp đúng/sai hidden, gặp lỗi cú pháp/runtime và timeout; UI hiển thị đúng, không lộ nội dung test ẩn qua response, bundle hay log.
- Test integration dùng API/DB/worker thật kiểm idempotency, retry, worker crash, concurrency, quota, job quá hạn, lưu kết quả và isolation giữa tài khoản. Kiểm code vòng lặp vô hạn, output lớn, truy cập network/filesystem và resource exhaustion trên môi trường thử cô lập.
- Reload/đổi thiết bị giữ draft và lịch sử đúng actor; kết quả cũ giữ version khi publish mới; client giả mạo kết quả không cập nhật progress, mode khác không tự hoàn thành.
- Đối chiếu từng challenge MVP đại diện với runner mới, gồm input/expected, async và class nếu dữ liệu thực yêu cầu; ghi rõ các cú pháp chưa hỗ trợ. Test browser toàn hành trình và kiểm riêng quyền, accessibility, mobile và trạng thái lỗi.

## Công việc kế tiếp

Làm CMS author/reviewer UI trên API hiện có; bổ sung quota/concurrency và durable job handling; kiểm thử image/network/filesystem/output/resource isolation theo kế hoạch an toàn thực thi; kiểm kê signature và challenge MVP để quyết định phạm vi tương thích; sync draft và kiểm tra reload/multi-device. Chưa tuyên bố mọi cú pháp/challenge MVP được hỗ trợ.

## Chạy kiểm tra evaluator MVP — 05/11/2026

Chạy Chromium headless qua Playwright, Vite local `127.0.0.1` và import trực tiếp `CodeEvaluator` tại HEAD `1799502`; fixture gồm hàm nhân đôi, một visible và một hidden case. Kết quả: chạy visible 1/1; nộp đúng 2/2; lời giải chỉ đúng visible đạt 1/2 và tổng thể fail; cú pháp sai trả lỗi; vòng lặp vô hạn bị dừng sau giới hạn 4 giây. Năm nhánh cho kết quả đúng kỳ vọng. Vite dùng Node 22; Node 16 mặc định không khởi động được Vite hiện tại.

Đây là smoke test evaluator với dữ liệu dựng trong browser, không phải kiểm thử UI, challenge thực, isolation, lưu tiến độ hay runner mới. Hidden case có trong dữ liệu gửi evaluator ở browser; che chuỗi kết quả không tạo bảo mật test ẩn. Không dùng kết quả này làm nghiệm thu sản phẩm.
