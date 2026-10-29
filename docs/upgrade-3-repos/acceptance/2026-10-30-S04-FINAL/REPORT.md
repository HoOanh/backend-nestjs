# S04 — Đóng 4 mục còn treo (gate + browser + worker + sign-off)

Ngày30/10/2026. Phạm vi: 4 việc được nêu sau khi S04 `locally_qualified`:

1. Browser E2E cho CMS publish panel.
2. Browser E2E cho Web learner published lecture.
3. Worker revalidate chạy end-to-end với Web thật.
4. Gói human content/visual sign-off.

Kết quả: mục1–3 đã chạy thật và có log/ảnh; mục4 đã được ĐẠI CA **APPROVED** ngày30/10/2026 sau khi chạy checklist trên stack thật (24/24 assertion).

## 1. Enrollment gate cho public lecture

- `GET /api/p/v1/lessons/{id}/lecture-package` bỏ `@Public`; yêu cầu learner session (`arc_p_at`) và `CourseAssignment` còn hiệu lực (`revokedAt = null`) trên khoá chứa lesson, khoá không archived.
- Không có session →401; không có assignment/đã thu hồi/sai lesson →404 (không leak tồn tại).
- `GET /p/v1/preview-exchanges/{code}` vẫn public có chủ đích: token one-time10 phút, đã dùng/hết hạn/draft →404.
- Web server loader dùng generated server client (forward đúng cookie learner), coi401/403/404 là "không có bài giảng" để fallback trang tài liệu; không nuốt lỗi5xx/contract.
- Quyết định phạm vi: gate theo assignment, **không** bắt buộc `CoursePublication`; bài giảng đã publish vẫn mở cho learner được gán kể cả khi metadata khoá chưa publish. Lý do: assignment là nguồn quyền truy cập, publication của lecture đã được review độc lập. Nếu muốn chặt hơn, thêm điều kiện `course.publications some` là một dòng trong `LectureService.published`.

## 2. Worker revalidate với Web thật

- Tách `dispatchLectureEvents` + `prismaLectureOutbox` khỏi `workers/main.ts`; HMAC ký đúng raw body `{"tags":["lesson:<id>"]}`.
- Retry exponential bounded5 lần, failed sau lần5; claim `pending→processing` chống xử lý trùng.
- Test opt-in `test/revalidate.e2e-spec.ts` chạy với Postgres thật + Web production build thật:
  - event được mark `processed`, Web trả `{revalidated:true,tags:[...]}`;
  - signature sai →401;
  - URL lỗi →event `pending`, attempts1, `availableAt` tương lai (không mất event).
- Lệnh tái lập:
  ```bash
  cd arc-academy-web && REVALIDATE_SECRET='arc-local-revalidate-secret-0123456789abcdef' PORT=3010 node scripts/start.mjs
  cd arc-academy-backend && NODE_ENV=test ARC_REVALIDATE_E2E=1 \
    WEB_REVALIDATE_URL='http://127.0.0.1:3010/api/revalidate' \
    REVALIDATE_SECRET='arc-local-revalidate-secret-0123456789abcdef' \
    pnpm test:revalidate
  ```

## 3. Browser E2E

- CMS `e2e/lecture-publish.spec.ts` (2 test, fixture HTTP): tạo gói → duyệt → xuất bản → mã preview; reviewer-only không thấy nút tạo gói. Ảnh: [cms-publish-panel.png](images/cms-publish-panel.png).
- Web `e2e/lecture-published.spec.ts` (1 test, fixture backend qua HTTP thật, Web production build): learner render đúng lesson/plan/checkpoint/visual pinned, light mode, mobile390px không tràn. Ảnh: [learner-lecture-mobile.png](images/learner-lecture-mobile.png).
- Sửa lỗi phát hiện bởi browser test: `VisualRenderer` render cả `<article>/<h1>` khi nhúng trong lecture → thêm `embedded` để learner page chỉ có một header; không dựng renderer thứ hai.
- Fixture server Web chỉ giả lập API; backend gate được chứng minh riêng bằng HTTP/Postgres thật (`test/lectures.e2e-spec.ts`).
- Sửa gate `e2e/teaching-plans.spec.ts`: suite full-stack trước đây throw trong `beforeAll` khi thiếu `ARC_ACCEPTANCE_TEST`, làm `pnpm test:e2e` fail dù test bị gate; nay skip đúng cách.

## 4. Gate

| Gate | Kết quả |
|---|---|
| Backend | 134 test/23 suite PASS; statements85.06%, branches66.31%, functions82.69%, lines87.68%; OpenAPI public23/internal70, preview2 path read-only, 105 Bruno, reproducible |
| Backend revalidate real Web | 2/2 PASS ([log](backend-revalidate-web.log)) |
| CMS | 70 unit/15 file PASS; 35/35 browser PASS; 881 messages; quality + build PASS |
| Web | 48 unit/12 file PASS; 12 browser PASS +20 skip có điều kiện; 275 messages; quality + build PASS |
| Human sign-off | **APPROVED** 30/10/2026 — [SIGNOFF.md](SIGNOFF.md), [signoff.json](signoff.json), [signoff-run.json](signoff-run.json) |

Log: [backend-quality.log](backend-quality.log), [backend-revalidate-web.log](backend-revalidate-web.log), [cms-quality.log](cms-quality.log), [cms-browser.log](cms-browser.log), [web-quality.log](web-quality.log), [web-browser.log](web-browser.log), [cms-build.log](cms-build.log), [web-build.log](web-build.log), [signoff-browser.log](signoff-browser.log).

## 5. Checklist sign-off trên stack thật

ĐẠI CA duyệt sau khi chạy lại toàn bộ checklist với dữ liệu thật: course/lesson US-012, plan v2 đã duyệt độc lập, visual flow2 beat, package đã publish, student có assignment và outsider không có.

- Nguồn: [signoff-run.json](signoff-run.json) — 24 assertion đều `ok: true`.
- Ảnh: [cms-publish-panel.png](images/cms-publish-panel.png), [learner-lecture-desktop.png](images/learner-lecture-desktop.png), [learner-lecture-mobile.png](images/learner-lecture-mobile.png), [narration-beats-preview.png](images/narration-beats-preview.png).
- Phát hiện và sửa trong lượt này: flow bị phóng quá lớn/nhiều khoảng trắng; `Pipe` bị ẩn ngay khi mở trang vì beat đầu active ở elapsed0. Nay diagram giới hạn `max-w-2xl`, cao130, và beat chỉ áp dụng sau khi bấm Phát; reset xoá trạng thái beat. Test DOM cập nhật theo hành vi mới.
- Creator API approve/publish đều403; reviewer UI không còn nút duyệt sau publish; creator UI không có nút approve/publish.
- Enrollment: outsider thấy trang "Trang không tồn tại", API404; thu hồi assignment → reload bị chặn ngay; phục hồi assignment sau test.

## Giới hạn còn lại

- Human sign-off đã APPROVED cho S04; production deploy/migration vẫn là gate riêng, chưa chạy.
- Browser E2E mặc định của Web vẫn dùng fixture API cho renderer; phiên sign-off30/10 chạy Postgres/backend/CMS/Web thật, còn401/404/403 được chứng minh thêm bằng backend e2e HTTP/Postgres.
- Plan US-012 có finding `objective_trace_incomplete` cho objective 2 ("Mục tiêu sẽ bổ sung phần giảng ở bản sau"); objective này không có section và không render cho learner. Sign-off chấp nhận vì đây là objective để dành, không phải nội dung bài đã publish.
- Chưa có UI CMS để cấp/thu hồi `CourseAssignment`; thao tác hiện qua API admin. Đây là khoảng trống vận hành của enrollment gate.
- Preview external frame, TTS/audio thật vẫn ngoài phạm vi.
