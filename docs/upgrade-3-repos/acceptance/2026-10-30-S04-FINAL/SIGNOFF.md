# S04 — Human sign-off checklist

Trạng thái: **APPROVED** ngày30/10/2026. ĐẠI CA duyệt sau khi checklist được chạy trên stack thật (Postgres + backend + CMS + Web production build), không dùng fixture cho luồng learner.

## Phạm vi ký

- Sprint: S04 — Bài giảng đồ hoạ, preview và xuất bản.
- Story: US-013 (typed visual), US-014 (narration beats), US-015 (package/publish/learner).
- Bằng chứng kỹ thuật: [REPORT.md](REPORT.md), [signoff-run.json](signoff-run.json), log/ảnh cùng thư mục.
- Không bao gồm: production deploy/migration, TTS/audio thật, preview external frame.

## Dữ liệu chạy

- Course `1dfbef33-80f0-4011-a800-dd3f51ebc4b3` / lesson `29c8813e-0901-4610-b5de-3e17a94b047f` ("Guard và Pipe: thứ tự thực thi").
- Plan v2 đã được reviewer độc lập duyệt; visual flow có2 beat; package `139e2d3d-6069-4b15-89e9-8d2c9b119533` đã publish.
- Học viên `student.s04@arc.local` có assignment active; `outsider.s04@arc.local` không có.

## Checklist

| # | Hạng mục | Cách xác nhận | Kết quả |
|---|---|---|---|
| 1 | Tiêu đề, mục tiêu, lời giảng khớp nội dung đã duyệt | Web learner + snapshot; objective 2 chưa có section là finding đã biết, không render | ☑ |
| 2 | Đồ hoạ đúng ý đồ sư phạm, không gây hiểu sai | Flow Guard → Pipe hiển thị đủ trước khi play; alt text đúng | ☑ |
| 3 | Câu hỏi kiểm tra không lộ đáp án/giải thích riêng | DOM + API snapshot không có `answerKey`/explanation | ☑ |
| 4 | Nguồn trích dẫn hiển thị đúng, không lộ private source | "Nguồn: NestJS request lifecycle.md" | ☑ |
| 5 | Narration beat khớp lời giảng (timing/focus) | Play → Guard focus; pause giữ 1.3s; resume tăng; beat2 highlight Pipe | ☑ |
| 6 | Phân quyền publish: creator không tự duyệt/publish | Creator API approve/publish đều403; UI không có nút | ☑ |
| 7 | Enrollment gate: chỉ assignment active xem được; thu hồi chặn ngay | Outsider404/không thấy title; thu hồi → chặn; API404 | ☑ |
| 8 | Light mode + mobile390px không tràn, không cắt nhãn | `color-scheme: light`, không overflow | ☑ |
| 9 | Worker revalidate không mất event khi Web lỗi | Real Web 3001: processed, tampered401, lỗi URL giữ pending | ☑ |

Chi tiết từng assertion: [signoff-run.json](signoff-run.json) (24 check đều `ok: true`).

## Quyết định

- [x] APPROVED — cho phép coi S04 đạt human acceptance.
- [ ] REJECTED

Người ký: ĐẠI CA  
Vai trò: Product owner  
Ngày: 30/10/2026  
Ghi chú: Duyệt trong phiên làm việc sau khi chạy lại checklist trên stack thật; giới hạn production/TTS/external frame vẫn giữ nguyên.

Đã cập nhật `signoff.json`, `signoff-run.json`, `sprint-index.json` và US-015 verification.
