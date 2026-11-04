# Audit hành trình khóa học và hai chế độ học — 04/11/2026

## Phạm vi và bằng chứng

Đối chiếu mã hiện có của MVP `backend-nestjs` với CMS, Web và backend mới: authoring khóa học, tài liệu, câu hỏi, bài code, lớp AI, catalog, quyền học và tiến độ. Đây là audit tĩnh trên source tại thời điểm kiểm tra, bao gồm các thay đổi chưa commit; chưa chạy browser, API integration, audio hoặc kiểm tra production. Không coi báo cáo sprint/test cũ là bằng chứng nghiệm thu cho trạng thái hiện tại.

## Kết luận

Chưa đủ điều kiện cho học viện sử dụng: mô hình hiện tại chưa thể author/publish một bài học có đủ tài liệu, quiz, code và lớp 1-1; UI học viên trộn bài giảng lớp vào trang đọc; chưa thấy luồng tự ghi danh/học thử, và progress chỉ có nguồn từ session lớp. MVP là tham chiếu hành vi, không mặc định sao chép các giới hạn localStorage hoặc hành vi tự ghi danh của nó.

## Phát hiện ưu tiên

### P0 — Import vượt quy trình xuất bản và nguy cơ ghi đè

- `arc-academy-backend/src/modules/content/content.controller.ts:91`: import chỉ yêu cầu `content:course:write`. `content.service.ts:454` tìm course theo slug và cập nhật mà không thấy kiểm tra owner trong nhánh import; chapter/lesson upsert theo ID. Cần negative integration test đối với course/ID thuộc người khác.
- `content.service.ts:520,792,870,894`: import tự tạo publication/package/room ở trạng thái published, gán `approvedBy` cùng tác giả, và cập nhật snapshot/room version đã publish; đi vòng luồng review độc lập và bất biến phiên bản. Các thao tác dùng nhiều lệnh DB riêng, không thấy transaction bao toàn bộ import. Cần xác nhận lỗi/rollback bằng test thật. Không dùng đường import này để publish trước khi khắc phục.
- Đường này và các thay đổi liên quan đang chưa commit. Không đánh đồng với bản production đã deploy.

### P0 — Mất nội dung học tài liệu

- MVP `src/data/curriculum/types.ts:9` có theory, video, code mẫu, quiz, code challenges, hints và test cases; `src/App.tsx:520` có các tab lý thuyết/quiz/code và trợ giảng riêng. CMS hiện `arc-academy-cms/src/modules/content/services/content.service.ts:33` chỉ mô tả metadata bài; `LessonSheet.tsx:86` thiên về plan/visual/room và tài liệu đính kèm, không có editor quiz/code.
- Backend `prisma/schema/content.prisma:35` chưa có mô hình bài đọc/quiz/bài code tương ứng; checkpoint của lớp không thay thế bài trắc nghiệm của chế độ tài liệu. Import DTO `content.dto.ts:246,299` cũng không chứa quiz/code per lesson.
- Web `src/app/[locale]/learn/courses/[courseId]/lessons/[lessonId]/page.tsx:10` chọn lecture khi đã publish và chỉ hiển thị tài liệu đính kèm trong nhánh fallback. Do đó publish lecture có thể làm mất đường xem danh sách tài liệu ở trang này. `LectureRenderer.tsx:93` đặt nội dung lớp, chặng và lời giảng trong luồng bài đọc. `lecture.service.ts:461` nhánh publish thông thường không đưa theory vào snapshot, trong khi đường import riêng có trường theory: dữ liệu không đồng nhất theo đường tạo.
- Chưa thấy giao diện tutor theo tài liệu, quiz hay code sandbox trong feature Web hiện hành. MVP có tutor tại `src/App.tsx:689`, quiz ở `src/components/lesson/QuizTab.tsx`, code tại `CodeSandboxTab.tsx`. Chưa kiểm tra hiệu lực provider hoặc tính đúng của toàn bộ MVP.

### P0 — Lớp 1-1 không đạt MVP và không có authoring tương ứng

- `arc-academy-web/src/features/learning/ClassroomRoom.tsx:473` vẽ nội dung cứng theo chỉ số chặng, không theo visual package; nội dung chỉ định bốn chặng và có thể sai chủ đề. Pause/giơ tay chỉ chuyển session, không điều khiển giọng (`:183,272,291`). Resume dùng checkpoint thay vì beat/câu (`:127`).
- `src/lib/tts/speech.ts:15` dùng browser speech, không phải ZeroTTS/audio clock MVP. MVP `backend-nestjs/src/components/classroom/AiInstructorClassroom.tsx:1000` có đồng hồ phát, focus theo câu, chuẩn bị audio và lưu điểm tiếp tục.
- CMS `src/modules/visuals/views/VisualEditorPage.tsx:758` chỉ sửa title/notes cho frame; schema backend `src/modules/visuals/visual.schema.ts:251` không biểu diễn đầy đủ scene/nét vẽ/bàn tay của MVP. Editor beat `VisualEditorPage.tsx:815` có action, segment, cue và target, nhưng classroom chưa chạy chúng. Web `VisualRenderer.tsx:139` báo media unavailable cho image annotation.
- `src/modules/lectures/lecture.service.ts:92` cho package không có visual; `ClassroomRoomEditorPage.tsx:261` chỉ chọn package, persona, voice mode, checkpoint policy; server TTS đang disabled. Khả năng publish không chứng minh tính sẵn sàng trình diễn.

### P1 — Catalog, học thử, ghi danh

- MVP `src/components/courses/LearningHubView.tsx:129` có filter, syllabus, trạng thái ghi danh và CTA riêng cho học thường/lớp. `src/App.tsx:258,293` cho thấy MVP cũng tự ghi danh khi chọn bài hoặc mở lớp; yêu cầu tách thao tác mới của ĐẠI CA cần được áp dụng rõ, không bê nguyên side effect này.
- Web `src/features/content/CatalogPage.tsx:46` liệt kê metadata và syllabus, nút dẫn vào route yêu cầu login; `CoursePage.tsx:25` chỉ liệt kê bài. Dashboard `src/features/learning/DashboardPage.tsx:6` chỉ đọc assignment. Không thấy CTA/quy trình học thử hay tự ghi danh khóa trong các feature/route đã kiểm tra. Đăng ký tài khoản khác với ghi danh khóa học.
- Student access controller `src/modules/platform/access/student-access.controller.ts:15` chỉ có GET assignments; cấp/thu hồi hiện có ở staff access controller. Chưa thấy chính sách trial/entitlement hoặc endpoint tự ghi danh trong phạm vi kiểm tra. Cần chốt quyền thử, dữ liệu xem được, thời hạn và chính sách chuyển đổi dựa trên yêu cầu sản phẩm; không suy ra từ MVP.

### P1 — Trạng thái hai chế độ chưa độc lập

- `prisma/schema/classroom.prisma:118`: `LessonProgress` có `sourceSessionId` bắt buộc và unique theo account/lesson, nên biểu diễn tiến độ có nguồn từ lớp; không có state/attempt cho đọc, quiz, code riêng trong mô hình đã kiểm tra. Không được suy kết quả quiz/code từ session lớp hoặc ngược lại.
- Cần các CTA và route rõ ràng cho hai chế độ, trạng thái riêng cho từng chế độ, chuyển chế độ có chủ đích, không bắt đầu session, đăng ký, đánh dấu hoàn thành hay thay đổi bài đang học chỉ vì xem/đổi chế độ. Chia sẻ course/lesson và nguồn được phép; không chia sẻ thao tác và kết quả một cách ngầm định.

### P1 — Thiếu gate và evidence thực tế

- `arc-academy-web/e2e/classroom.spec.ts` dùng fixture, kiểm tra luồng session/checkpoint cũ; không chứng minh giọng/ink/focus thật hoặc động bộ pause. Selector trong test có dấu hiệu lệch giao diện chưa commit; chưa chạy để xác nhận fail.
- Cần test hai khóa có chủ đề khác nhau, bài có/không có mỗi chế độ, reader + quiz + code, trial chưa đăng ký, đăng ký, direct URL, quyền source, hai mode độc lập, publish phiên bản mới giữa session, preview so với Web, audio thật, pause/raise hand/resume, reduced motion và mobile. Tách fixture UX khỏi integration API/DB và provider smoke thật.

## Phạm vi hoàn thiện cần có

1. Thiết kế và version hóa riêng nội dung học tài liệu, quiz và code (đáp án/test ẩn giữ server); editor CMS theo từng bài với preview và trạng thái review. Làm rõ sandbox thực thi và chính sách chấm trước khi triển khai.
2. Version hóa classroom storyboard/scene, asset và narration cues; CMS có thư viện/chọn/tạo asset, cấu hình scene và preview bằng renderer Web; lint, review và khóa version trước publish.
3. Hoàn thiện Web catalog → chi tiết → học thử hoặc đăng ký theo policy rõ ràng → hai entrypoint học riêng. Reader hiển thị tài liệu, tutor có nguồn, quiz/code theo nội dung đã publish; lớp dùng engine và audio MVP phù hợp contract mới.
4. Thiết kế entitlement và progress theo mode, có provenance, không làm lộ đáp án/private source; khôi phục phiên đúng beat. Migration và khả năng tương thích package/session cũ phải được kiểm tra trước rollout.
5. Sửa import thành draft, xác thực ownership/ID, transaction và review/publish tường minh; không thay đổi snapshot/version đã công bố. Tạo gate theo từng mode để không quảng cáo chức năng chưa sẵn sàng.

Tài liệu này là audit, không khẳng định các hạng mục đã triển khai hoặc hệ thống đã được nghiệm thu.

## Cập nhật import và dữ liệu local — 04/11/2026

- Đường import bundle cũ tạm bị chặn ở service bằng 503, bao gồm cả lời gọi từ script, vì tự duyệt/publish và sửa snapshot; CMS thông báo và vô hiệu nút import. Đây là biện pháp tạm thời, chưa phải importer bản nháp.
- Lần chạy `content.e2e-spec.ts` trước đó đã thực sự gọi import đối với course `backend-nestjs` trên database local. Audit log xác nhận lúc 02:39:55 UTC và `course.updatedAt` tương ứng; một assignment mới được tạo cho tài khoản editor của test. Mã import còn cập nhật metadata/chapter/lesson và snapshot lecture, nhưng không có bản trước đáng tin để so sánh hay tự khôi phục. Không khẳng định toàn bộ dữ liệu nào đã thay đổi giá trị.
- Test HTTP/Postgres dành riêng cho chặn import kiểm tra 503, metadata course và số assignment không đổi. Không chạy lại test import cũ có tác dụng ghi.
- Còn phải triển khai importer thực sự: validate schema và ownership trước ghi, nhập nguồn qua storage/extraction thật, tạo draft có version và transaction phù hợp, review độc lập rồi publish bằng quy trình chuẩn; kiểm thử negative/collision/rollback và fixture riêng biệt.

## Cập nhật draft cấu trúc — 04/11/2026

API import đã mở lại có giới hạn cho course/chapter/lesson mới: kiểm tra dữ liệu, slug/ID và vị trí trùng; tạo một draft nguyên tử, không xuất bản hoặc cấp quyền. Gói chứa giáo trình, giáo án, visual hoặc classroom bị từ chối toàn bộ. CMS chỉ bật import cho gói cấu trúc và hiển thị trạng thái chưa xuất bản; gói MVP đầy đủ vẫn chưa được hỗ trợ. Test HTTP/Postgres kiểm tra nhánh draft, collision và không mutation khi từ chối gói đầy đủ. Đây chưa phải importer đầy đủ cho học viện.

## Cập nhật tài liệu draft — 04/11/2026

Gói đúng một lesson có thể chứa tài liệu Markdown: bản gốc lưu object storage, revision ở trạng thái uploaded, outbox gọi worker extraction và link mặc định author-only. Spans do bundle cung cấp không được tin hoặc ghi trực tiếp. Test HTTP/Postgres/MinIO kiểm tra bản gốc, queue, extraction thực, visibility và không publish/cấp quyền; bundle nhiều lesson kèm tài liệu vẫn bị từ chối, bundle MVP đầy đủ vẫn chưa được hỗ trợ. Cần reconciliation object mồ côi cho trường hợp tiến trình dừng sau khi ghi S3 nhưng trước DB commit, hoặc xóa bù thất bại.

## Kiểm tra hành trình trên stack cô lập — 04/11/2026

- Web classroom dùng visual đọc từ snapshot phiên và renderer dùng chung; bỏ 4 sơ đồ gắn cứng. Thiếu visual hợp lệ thì hiển thị ý đồ đồ họa dạng chữ. Renderer này chưa port nét vẽ/bàn tay, ảnh asset thật, đồng bộ beat hoặc ZeroTTS của MVP.
- `arc-academy-web/e2e/journey-live.spec.ts` chạy Playwright trên CMS/Web và API thật, với Postgres, Redis và MinIO riêng, URL loopback. CMS UI nhập bundle 1 bài + Markdown; worker trích xuất, reviewer duyệt plan và package, publish course/room, staff cấp assignment; học viên đọc tài liệu, vào phòng, trả lời checkpoint và hoàn tất. Test xác nhận đọc tài liệu không tạo progress lớp, sau hoàn tất checkpoint có progress server.
- Kết quả ngày 04/11: 1 test live pass. Đăng nhập dùng session fixture, các thao tác cấu hình plan/visual, duyệt/publish và cấp assignment thực hiện qua API, không chứng minh các thao tác đó qua CMS UI. Không có đăng ký/học thử, tutor tài liệu, quiz/code, full MVP bundle hay giọng/vẽ thực trong kịch bản. Hai test browser fixture cho visual và trang tài liệu pass riêng; không tính fixture là live integration. Backend content và classroom: 32 test HTTP pass trên DB/Redis/MinIO cô lập.
- Chạy lại chỉ trên stack thử nghiệm riêng đã chuẩn bị, với CMS và Web loopback, tài khoản fixture trong file private do `scripts/content-browser-fixture.ts` tạo (đặt `ARC_TEST_ACTORS_FILE` sang file mới) và `ARC_JOURNEY_TEST=1`; lệnh `playwright test --config e2e/journey-playwright.config.ts`. Test ghi dữ liệu, không chạy trên database hay bucket đang dùng.

## Cập nhật tự ghi danh — 04/11/2026

CMS có cấu hình mở đăng ký miễn phí, mặc định đóng; policy chỉ có hiệu lực sau khi reviewer xuất bản metadata. Learner đăng ký rõ ràng từ catalog; endpoint chỉ cấp cho actor hiện tại, idempotent với assignment đang hoạt động và từ chối quyền đã thu hồi. Test HTTP/Postgres trên DB cô lập bao gồm chưa publish, policy đóng, đăng ký lặp và thu hồi. Kịch bản Playwright live bổ sung thao tác bật policy trong CMS, visitor thấy yêu cầu đăng nhập, học viên đăng ký rồi học tài liệu/lớp; pass trên stack cô lập. Session đăng nhập vẫn dùng fixture và duyệt plan/visual/room vẫn qua API. Học thử, thanh toán, quiz/code và engine MVP chưa có trong kết quả này.
